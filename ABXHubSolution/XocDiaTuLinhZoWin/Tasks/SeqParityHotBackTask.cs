using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using static XocDiaTuLinhZoWin.Tasks.TaskUtil;

namespace XocDiaTuLinhZoWin.Tasks
{
    public sealed class SeqParityHotBackTask : IBetTask
    {
        public string DisplayName => "18) Chuỗi cầu C/L hay về";
        public string Id => "seq-cl-hotback";

        private const int PatternLen = 5;
        private const int MaxSeqLen = 52;

        private static readonly ThreadLocal<Random> _rng =
            new(() => new Random(unchecked(Environment.TickCount * 31 + Environment.CurrentManagedThreadId)));

        private static string DecideRandomSide() => (_rng.Value!.Next(2) == 0) ? "CHAN" : "LE";

        private static string FilterSeqCL(string seq)
        {
            if (string.IsNullOrEmpty(seq)) return string.Empty;
            var buf = new char[seq.Length];
            int n = 0;
            foreach (var ch in seq)
            {
                char u = char.ToUpperInvariant(ch);
                if (u == 'C' || u == 'L') buf[n++] = u;
            }
            return n == 0 ? string.Empty : new string(buf, 0, n);
        }

        private static string ReverseString(string s)
        {
            if (string.IsNullOrEmpty(s)) return string.Empty;
            var arr = s.ToCharArray();
            Array.Reverse(arr);
            return new string(arr);
        }

        private static string FlipCL(string s)
        {
            if (string.IsNullOrEmpty(s)) return string.Empty;
            var arr = s.ToCharArray();
            for (int i = 0; i < arr.Length; i++)
            {
                arr[i] = arr[i] == 'C' ? 'L' : 'C';
            }
            return new string(arr);
        }

        private static string PatternToSideSeq(string pattern)
        {
            if (string.IsNullOrEmpty(pattern)) return string.Empty;
            var parts = new string[pattern.Length];
            for (int i = 0; i < pattern.Length; i++)
                parts[i] = (pattern[i] == 'C') ? "CHAN" : "LE";
            return string.Join("-", parts);
        }

        private static HashSet<string> BuildAllPatterns()
        {
            var set = new HashSet<string>(StringComparer.Ordinal);
            for (int i = 0; i < (1 << PatternLen); i++)
            {
                var p = new char[PatternLen];
                for (int b = 0; b < PatternLen; b++)
                {
                    int bit = (i >> (PatternLen - 1 - b)) & 1;
                    p[b] = (bit == 0) ? 'C' : 'L';
                }
                set.Add(new string(p));
            }
            return set;
        }

        private static bool TryGetLatestWindow(string seq, out string w, out string wRev)
        {
            var filtered = FilterSeqCL(seq);
            if (filtered.Length < PatternLen) { w = ""; wRev = ""; return false; }

            if (filtered.Length > MaxSeqLen)
            {
                filtered = filtered.Substring(filtered.Length - MaxSeqLen);
            }

            var latestFirst = ReverseString(filtered);
            if (latestFirst.Length < PatternLen) { w = ""; wRev = ""; return false; }

            string wBase = latestFirst.Substring(0, PatternLen);
            w = ReverseString(wBase);
            wRev = FlipCL(w);
            return true;
        }

        private static void LogRemainSet(HashSet<string> candidates, Action<string>? log)
        {
            int remain = candidates.Count;
            if (remain <= 0)
            {
                log?.Invoke("[SeqHotCL] remain=0");
                return;
            }
            var remainList = new List<string>(candidates);
            remainList.Sort(StringComparer.Ordinal);
            log?.Invoke($"[SeqHotCL] remain={remain} set={string.Join(",", remainList)}");
        }

        private static HashSet<string> BuildRemainingSetFromSeq(string seq, Action<string>? log)
        {
            var candidates = BuildAllPatterns();
            var filtered = FilterSeqCL(seq);
            if (filtered.Length < PatternLen) return candidates;

            log?.Invoke("[SeqHotCL] scan=full");
            log?.Invoke($"[SeqHotCL] seqRaw={seq}");
            log?.Invoke($"[SeqHotCL] seqCL={filtered} (len={filtered.Length})");

            if (filtered.Length > MaxSeqLen)
            {
                log?.Invoke($"[SeqHotCL] trim last {MaxSeqLen} from len={filtered.Length}");
                filtered = filtered.Substring(filtered.Length - MaxSeqLen);
            }

            var latestFirst = ReverseString(filtered);
            int windowCount = latestFirst.Length - PatternLen + 1;
            if (windowCount <= 0) return candidates;

            for (int i = 0; i < windowCount; i++)
            {
                string wBase = latestFirst.Substring(i, PatternLen);
                string w = ReverseString(wBase);
                string wRev = FlipCL(w);
                bool removed = candidates.Remove(wRev);
                log?.Invoke($"[SeqHotCL] win#{i + 1:00} {w} -> rev {wRev} {(removed ? "remove" : "skip")}");
            }

            LogRemainSet(candidates, log);
            return candidates;
        }

        private static bool RemoveLatestWindowFromSet(HashSet<string> candidates, string w, string wRev, Action<string>? log, string tag)
        {
            bool removed = candidates.Remove(wRev);
            log?.Invoke($"[SeqHotCL]{tag} win#01 {w} -> rev {wRev} {(removed ? "remove" : "skip")}");
            return removed;
        }

        private static string? PickPatternFromSet(HashSet<string> candidates)
        {
            int remain = candidates.Count;
            if (remain <= 0) return null;
            int pick = _rng.Value!.Next(remain);
            int idx = 0;
            foreach (var pat in candidates)
            {
                if (idx == pick) return pat;
                idx++;
            }
            return null;
        }

        public async Task RunAsync(GameContext ctx, CancellationToken ct)
        {
            var money = new MoneyManager(ctx.StakeSeq, ctx.MoneyStrategyId);
            string? pattern = null;
            int patternIndex = 0;
            HashSet<string>? candidates = null;
            string lastWindow = "";
            string lastWindowRev = "";
            bool hasLastWindow = false;

            while (true)
            {
                ct.ThrowIfCancellationRequested();

                await WaitUntilNewRoundStart(ctx, ct);

                var snap = ctx.GetSnap();
                string baseSeq = snap?.seq ?? string.Empty;

                if (string.IsNullOrEmpty(pattern) || patternIndex >= PatternLen)
                {
                    if (candidates == null)
                    {
                        candidates = BuildRemainingSetFromSeq(baseSeq, ctx.Log);
                    }
                    else if (candidates.Count == 0)
                    {
                        candidates = BuildAllPatterns();
                        ctx.Log?.Invoke("[SeqHotCL] tap A rong -> tao lai");
                        if (hasLastWindow)
                            RemoveLatestWindowFromSet(candidates, lastWindow, lastWindowRev, ctx.Log, " reapply");
                        LogRemainSet(candidates, ctx.Log);
                    }

                    pattern = PickPatternFromSet(candidates);
                    patternIndex = 0;
                    if (string.IsNullOrEmpty(pattern))
                        ctx.Log?.Invoke("[SeqHotCL] khong con chuoi phu hop, fallback ngau nhien");
                    else
                        ctx.Log?.Invoke($"[SeqHotCL] chon_mau={pattern} -> {PatternToSideSeq(pattern)} (con={candidates?.Count ?? 0})");
                }

                string side = string.IsNullOrEmpty(pattern)
                    ? DecideRandomSide()
                    : ParityCharToSide(pattern[patternIndex]);

                long stake;
                if (ctx.MoneyStrategyId == "MultiChain")
                {
                    stake = MoneyHelper.CalcAmountMultiChain(
                        ctx.StakeChains,
                        ctx.MoneyChainIndex,
                        ctx.MoneyChainStep);
                }
                else
                {
                    stake = money.GetStakeForThisBet();
                }

                await PlaceBet(ctx, side, stake, ct);

                bool win = await WaitRoundFinishAndJudge(ctx, side, baseSeq, ct);
                await ctx.UiDispatcher.InvokeAsync(() => ctx.UiAddWin?.Invoke(win ? stake : -stake));
                if (ctx.MoneyStrategyId == "MultiChain")
                {
                    int chainIndex = ctx.MoneyChainIndex;
                    int chainStep = ctx.MoneyChainStep;
                    double chainProfit = ctx.MoneyChainProfit;

                    MoneyHelper.UpdateAfterRoundMultiChain(
                        ctx.StakeChains,
                        ctx.StakeChainTotals,
                        ref chainIndex,
                        ref chainStep,
                        ref chainProfit,
                        win);

                    ctx.MoneyChainIndex = chainIndex;
                    ctx.MoneyChainStep = chainStep;
                    ctx.MoneyChainProfit = chainProfit;
                }
                else
                {
                    money.OnRoundResult(win);
                }

                var snapAfter = ctx.GetSnap();
                string latestSeq = snapAfter?.seq ?? baseSeq;
                hasLastWindow = TryGetLatestWindow(latestSeq, out lastWindow, out lastWindowRev);
                if (hasLastWindow && candidates != null && candidates.Count > 0)
                {
                    ctx.Log?.Invoke("[SeqHotCL] scan=latest");
                    RemoveLatestWindowFromSet(candidates, lastWindow, lastWindowRev, ctx.Log, "");
                }

                if (!string.IsNullOrEmpty(pattern))
                {
                    if (win)
                    {
                        pattern = null;
                        patternIndex = 0;
                    }
                    else
                    {
                        patternIndex++;
                        if (patternIndex >= PatternLen)
                        {
                            patternIndex = 0;
                            pattern = null;
                        }
                    }
                }
            }
        }
    }
}
