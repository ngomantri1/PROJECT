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

        private const int PatternLen = 4;
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
            for (int i = 0; i < 16; i++)
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

        private static string? PickPatternFromSeq(string seq, Action<string>? log, out int remain)
        {
            remain = 0;
            var filtered = FilterSeqCL(seq);
            if (filtered.Length < PatternLen) return null;

            log?.Invoke($"[SeqHotCL] seqRaw={seq}");
            log?.Invoke($"[SeqHotCL] seqCL={filtered} (len={filtered.Length})");

            if (filtered.Length > MaxSeqLen)
            {
                log?.Invoke($"[SeqHotCL] trim last {MaxSeqLen} from len={filtered.Length}");
                filtered = filtered.Substring(filtered.Length - MaxSeqLen);
            }

            var latestFirst = ReverseString(filtered);
            int windowCount = latestFirst.Length - PatternLen + 1;
            if (windowCount <= 0) return null;

            var candidates = BuildAllPatterns();
            for (int i = 0; i < windowCount; i++)
            {
                string w = latestFirst.Substring(i, PatternLen);
                string wRev = ReverseString(w);
                bool removed = candidates.Remove(wRev);
                log?.Invoke($"[SeqHotCL] win#{i + 1:00} {w} -> rev {wRev} {(removed ? "remove" : "skip")}");
            }

            remain = candidates.Count;
            if (remain > 0)
            {
                var remainList = new List<string>(candidates);
                remainList.Sort(StringComparer.Ordinal);
                log?.Invoke($"[SeqHotCL] remain={remain} set={string.Join(",", remainList)}");
            }
            else
            {
                log?.Invoke("[SeqHotCL] remain=0");
            }
            if (remain == 0) return null;

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

            while (true)
            {
                ct.ThrowIfCancellationRequested();

                await WaitUntilNewRoundStart(ctx, ct);

                var snap = ctx.GetSnap();
                string baseSeq = snap?.seq ?? string.Empty;

                if (string.IsNullOrEmpty(pattern) || patternIndex >= PatternLen)
                {
                    pattern = PickPatternFromSeq(baseSeq, ctx.Log, out int remain);
                    patternIndex = 0;
                    if (string.IsNullOrEmpty(pattern))
                        ctx.Log?.Invoke("[SeqHotCL] khong con chuoi phu hop, fallback ngau nhien");
                    else
                        ctx.Log?.Invoke($"[SeqHotCL] chon_mau={pattern} -> {PatternToSideSeq(pattern)} (con={remain})");
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

                if (!string.IsNullOrEmpty(pattern))
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
