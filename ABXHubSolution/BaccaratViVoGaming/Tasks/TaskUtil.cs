using System;
using System.Threading;
using System.Threading.Tasks;
using System.Collections.Concurrent;
using System.Windows.Input;
using System.Windows.Threading;
using System.Linq;
using System.Windows;
using System.Windows.Controls;

namespace BaccaratViVoGaming.Tasks
{
    internal static class TaskUtil
    {
        internal enum RoundOutcome
        {
            Win,
            Lose,
            Push
        }

        // Khóa chống gửi lặp: sau khi đã gửi 1 lệnh, chặn gửi tiếp trong một cửa sổ an toàn
        private static readonly ConcurrentDictionary<string, long> _lastBetOkMsByTab = new();
        private static readonly ConcurrentDictionary<string, int> _lastBetRoundByTab = new();
        private static readonly ConcurrentDictionary<string, string> _lastBetSideByTab = new();
        private static readonly ConcurrentDictionary<string, string> _lastAcceptedRawSeqByTab = new();
        private static readonly ConcurrentDictionary<string, (long B, long P, long T)> _lastAcceptedBoardCountsByTab = new();
        private static readonly ConcurrentDictionary<string, byte> _betInFlightByTab = new();
        private const long SendOnlyCooldownMs = 3000;
        private const int BetSendTimeoutMs = 2500;

        // (tuỳ chọn) reset khi dừng task
        public static void ClearBetCooldown()
        {
            _lastBetOkMsByTab.Clear();
            _lastBetRoundByTab.Clear();
            _lastBetSideByTab.Clear();
            _lastAcceptedRawSeqByTab.Clear();
            _lastAcceptedBoardCountsByTab.Clear();
            _betInFlightByTab.Clear();
        }

        public static string ParityCharToSide(char ch) => (ch == 'B') ? "BANKER" : "PLAYER";
        public static char DigitToParity(char d) => (d == 'B') ? 'B' : 'P';
        // TaskUtil.cs (trong class TaskUtil)
        private static readonly object _betLock = new object();
        private static string _lastBetSeq = "";
        private static long _lastBetMs = 0;
        // Reset UI 1 lần ngay khi vào cửa sổ đặt (p >= DecisionPercent)
        private static bool _uiRoundResetDone = false;
        public static string SeqToParityString(string digitSeq)
        {
            if (string.IsNullOrEmpty(digitSeq)) return "";
            char[] a = new char[digitSeq.Length];
            for (int i = 0; i < digitSeq.Length; i++) a[i] = DigitToParity(digitSeq[i]);
            return new string(a);
        }

        public static string SeqCharToResult(char lastDigit)
        {
            char u = char.ToUpperInvariant(lastDigit);
            if (u == 'B') return "BANKER";
            if (u == 'P') return "PLAYER";
            if (u == 'T') return "TIE";
            return "";
        }

        private static string NormalizeResultSeq(string? raw)
        {
            if (string.IsNullOrWhiteSpace(raw)) return "";
            var arr = raw.Where(ch =>
            {
                char u = char.ToUpperInvariant(ch);
                return u == 'B' || u == 'P' || u == 'T';
            }).Select(char.ToUpperInvariant).ToArray();
            return arr.Length == 0 ? "" : new string(arr);
        }

        private static string PickBestSettleSeq(CwSnapshot? snap)
        {
            if (snap == null) return "";
            var rawSeq = NormalizeResultSeq(snap.rawSeq);
            var seq = NormalizeResultSeq(snap.seq);
            return rawSeq.Length >= seq.Length ? rawSeq : seq;
        }

        private static (long B, long P, long T) CountBptFromSeq(string? raw)
        {
            long b = 0, p = 0, t = 0;
            foreach (var ch in NormalizeResultSeq(raw))
            {
                switch (ch)
                {
                    case 'B': b++; break;
                    case 'P': p++; break;
                    case 'T': t++; break;
                }
            }
            return (b, p, t);
        }

        private static bool TryGetSnapshotBoardCounts(CwSnapshot? snap, out long b, out long p, out long t)
        {
            b = snap?.boardCountB ?? -1;
            p = snap?.boardCountP ?? -1;
            t = snap?.boardCountT ?? -1;
            return b >= 0 && p >= 0 && t >= 0;
        }

        public static bool? IsWin(string betSide, char lastDigit)
        {
            var result = SeqCharToResult(lastDigit);
            if (string.IsNullOrEmpty(result)) return null;
            if (string.Equals(result, "TIE", StringComparison.OrdinalIgnoreCase)) return null;
            return string.Equals(betSide, result, StringComparison.OrdinalIgnoreCase);
        }

        public static double CalcNetDelta(string betSide, long stake, bool? win)
        {
            if (win == null) return 0;
            if (win == false) return -stake;
            return string.Equals(betSide, "BANKER", StringComparison.OrdinalIgnoreCase)
                ? Math.Round(stake * 0.95, 0, MidpointRounding.AwayFromZero)
                : stake;
        }

        private static void UiResetRoundControls()
        {
            var app = Application.Current;
            if (app == null) return;

            app.Dispatcher.InvokeAsync(() =>
            {
                if (app.MainWindow is null) return;

                // Gọi wrapper công khai trong MainWindow (tránh reflection, tránh tự clear)
                var mi = app.MainWindow.GetType().GetMethod("ResetBetMiniPanel_External",
                            System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.Public);
                if (mi != null)
                {
                    mi.Invoke(app.MainWindow, null);
                }
            }, DispatcherPriority.Render);
        }




        // Gọi khi đã có p (percent) để reset đúng 1 lần
        public static void UiRoundMaybeReset(double p, double decisionPercent)
        {
            if (_uiRoundResetDone) return;
            if (p >= decisionPercent)
            {
                _uiRoundResetDone = true;
                UiResetRoundControls();
            }
        }

        // Gọi khi kết thúc ván (đã chấm THẮNG/THUA) để ván sau reset tiếp
        public static void UiRoundAllowNextReset() => _uiRoundResetDone = false;

        public static async Task WaitUntilBetWindow(GameContext ctx, CancellationToken ct)
        {
            // Quy ước: prog = % thời gian còn lại (0..100).
            // Vào tiền khi về ngưỡng “<= DecisionPercent” (ví dụ 15% cuối).
            while (true)
            {
                ct.ThrowIfCancellationRequested();
                var s = ctx.GetSnap?.Invoke();
                double p = s?.prog ?? 100.0;
                //TaskUtil.UiRoundMaybeReset(p, ctx.DecisionPercent);
                if (p <= ctx.DecisionPercent && p > 0) break;
                await Task.Delay(80, ct);
            }
        }

        // Chờ sang phiên mới rồi đặt NGAY khi mở cửa (đặt sớm, KHÔNG phụ thuộc DecisionPercent)
        public static async Task WaitUntilNewRoundStart(GameContext ctx, CancellationToken ct)
        {
            while (true)
            {
                ct.ThrowIfCancellationRequested();
                var s = ctx.GetSnap?.Invoke();
                double p = s?.prog ?? 100.0;
                if (p >= ctx.DecisionPercent && p <= 100) break;
                await Task.Delay(80, ct);
            }
        }


        public static async Task<bool> PlaceBet(GameContext ctx, string side, long amount, CancellationToken ct, bool ignoreCooldown = false)
        {
            var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            var tabKey = string.IsNullOrWhiteSpace(ctx?.TabId) ? "_default" : ctx.TabId;
            var runTag = ctx != null && ctx.RunId > 0 ? $" | run={ctx.RunId}" : "";

            if (ctx?.IsRunActive != null && !ctx.IsRunActive())
            {
                ctx.Log?.Invoke($"[BET][BLOCK] stale-run | tab={tabKey}{runTag} | side={side} | amount={amount:N0}");
                return false;
            }

            if (ctx?.GetBetPipeReady != null)
            {
                var ready = ctx.GetBetPipeReady();
                if (!ready.ok)
                {
                    ctx.Log?.Invoke($"[BET][BLOCK] bet-pipe-not-ready | tab={tabKey}{runTag} | reason={ready.reason} | side={side} | amount={amount:N0}");
                    return false;
                }
            }

            var playableSnap = ctx.GetSnap?.Invoke();
            var snap = ctx.GetRawSnap?.Invoke() ?? playableSnap;
            var rawSeq = PickBestSettleSeq(snap);
            var roundId = 0;
            try
            {
                var seqVer = snap?.seqVersion;
                if (seqVer.HasValue && seqVer.Value > 0)
                {
                    if (seqVer.Value > int.MaxValue) roundId = int.MaxValue;
                    else roundId = (int)seqVer.Value;
                }
                else
                {
                    roundId = (snap?.seq ?? "").Length;
                }
            }
            catch { roundId = 0; }

            var last = _lastBetOkMsByTab.TryGetValue(tabKey, out var v) ? v : 0;
            var lastRound = _lastBetRoundByTab.TryGetValue(tabKey, out var r) ? r : -1;
            var lastSide = _lastBetSideByTab.TryGetValue(tabKey, out var s) ? s : "";
            var sameRound = lastRound == roundId;
            var sameSide = string.Equals(lastSide, side, StringComparison.OrdinalIgnoreCase);
            if (!ignoreCooldown)
            {
                if (_betInFlightByTab.ContainsKey(tabKey))
                {
                    ctx.Log?.Invoke($"[BET][BLOCK] pending settle | tab={tabKey}{runTag} | side={side} | amount={amount:N0}");
                    return false;
                }

                if (sameRound && sameSide && now - last < SendOnlyCooldownMs)
                {
                    ctx.Log?.Invoke($"[BET][BLOCK] skip duplicate send | tab={tabKey}{runTag} | side={side} | amount={amount:N0}");
                    return false;
                }
            }

            // Optimistic mode giống XocDiaTuLinhZoWin: qua được chặn local thì coi như đã bắn.
            var js =
                "(async function(){try{" +
                " var intent = { tabId: '" + tabKey + "', roundId: " + roundId + ", side: '" + side + "', amount: " + amount + " };" +
                " if (typeof window.__cw_bet_enqueue==='function'){" +
                "   return String(await window.__cw_bet_enqueue(intent));" +
                " } else if (typeof window.__cw_bet==='function'){" +
                "   return String(await window.__cw_bet('" + side + "', " + amount + "));" +
                " } else { return 'no'; }" +
                "}catch(e){ return 'err:' + (e && e.message ? e.message : e); }})();";

            ctx.Log?.Invoke($"[BET-SEND][BEGIN] tab={tabKey}{runTag} | round={roundId} | side={side} | amount={amount:N0}");

            string rRaw = "";
            var sendAt = DateTime.UtcNow;
            try
            {
                var evalTask = ctx.EvalJsAsync(js);
                var completed = await Task.WhenAny(evalTask, Task.Delay(BetSendTimeoutMs, ct));
                if (completed != evalTask)
                {
                    var ms = (int)(DateTime.UtcNow - sendAt).TotalMilliseconds;
                    ctx.Log?.Invoke($"[BET-SEND][TIMEOUT] tab={tabKey}{runTag} | round={roundId} | side={side} | amount={amount:N0} | waitMs={ms}");
                    return false;
                }
                rRaw = await evalTask;
            }
            catch (Exception ex)
            {
                var ms = (int)(DateTime.UtcNow - sendAt).TotalMilliseconds;
                ctx.Log?.Invoke($"[BET-SEND][ERR] tab={tabKey}{runTag} | round={roundId} | side={side} | amount={amount:N0} | waitMs={ms} | err={ex.Message}");
                return false;
            }

            var resultNorm = (rRaw ?? "").Trim().Trim('"');
            bool ok = !(string.IsNullOrWhiteSpace(resultNorm) ||
                        string.Equals(resultNorm, "no", StringComparison.OrdinalIgnoreCase) ||
                        resultNorm.StartsWith("err:", StringComparison.OrdinalIgnoreCase));
            var elapsedMs = (int)(DateTime.UtcNow - sendAt).TotalMilliseconds;
            ctx.Log?.Invoke($"[BET-JS] tab={tabKey}{runTag} round={roundId} result={rRaw}");
            if (ok)
                ctx.Log?.Invoke($"[BET-SEND][OK] tab={tabKey}{runTag} | round={roundId} | side={side} | amount={amount:N0} | waitMs={elapsedMs}");
            else
                ctx.Log?.Invoke($"[BET-SEND][FAIL] tab={tabKey}{runTag} | round={roundId} | side={side} | amount={amount:N0} | waitMs={elapsedMs} | result={resultNorm}");

            if (ok)
            {
                if (ctx.UiRecordBetIssued != null)
                {
                    await ctx.UiDispatcher.InvokeAsync(() =>
                    {
                        ctx.UiRecordBetIssued?.Invoke(side, amount, roundId);
                        if (string.Equals(ctx.MoneyStrategyId, "MultiChain", StringComparison.OrdinalIgnoreCase))
                            ctx.UiSetChainLevel?.Invoke(ctx.MoneyChainIndex, ctx.MoneyChainStep);
                    });
                }
                else
                {
                    await ctx.UiDispatcher.InvokeAsync(() =>
                    {
                        ctx.UiSetSide?.Invoke(side);
                        ctx.UiSetStake?.Invoke(amount);
                        if (string.Equals(ctx.MoneyStrategyId, "MultiChain", StringComparison.OrdinalIgnoreCase))
                            ctx.UiSetChainLevel?.Invoke(ctx.MoneyChainIndex, ctx.MoneyChainStep);
                    });
                }
                _lastBetOkMsByTab[tabKey] = now;
                _lastBetRoundByTab[tabKey] = roundId;
                _lastBetSideByTab[tabKey] = side ?? "";
                _lastAcceptedRawSeqByTab[tabKey] = rawSeq;
                if (TryGetSnapshotBoardCounts(snap, out var acceptedB, out var acceptedP, out var acceptedT))
                    _lastAcceptedBoardCountsByTab[tabKey] = (acceptedB, acceptedP, acceptedT);
                else
                    _lastAcceptedBoardCountsByTab[tabKey] = CountBptFromSeq(rawSeq);
                _betInFlightByTab[tabKey] = 1;
            }
            return ok;
        }
        public static async Task<bool?> WaitRoundFinishAndJudge(GameContext ctx, string betSide, string baseSeq, CancellationToken ct)
        {
            var tabKey = string.IsNullOrWhiteSpace(ctx?.TabId) ? "_default" : ctx.TabId;
            if (!_lastAcceptedBoardCountsByTab.TryGetValue(tabKey, out var acceptedCounts))
            {
                acceptedCounts = CountBptFromSeq(baseSeq);
                if ((acceptedCounts.B + acceptedCounts.P + acceptedCounts.T) <= 0)
                {
                    ctx.Log?.Invoke($"[BET][SKIP] no accepted board count for settle | tab={tabKey}");
                    _betInFlightByTab.TryRemove(tabKey, out _);
                    return null;
                }
                ctx.Log?.Invoke($"[BET][FALLBACK] missing accepted settle counts -> use baseSeq counts | tab={tabKey} | B={acceptedCounts.B} | P={acceptedCounts.P} | T={acceptedCounts.T}");
            }

            // Baccarat settle theo boardCount B/P/T để đồng nhất với authority/UI.
            while (true)
            {
                ct.ThrowIfCancellationRequested();
                var s = ctx.GetRawSnap?.Invoke() ?? ctx.GetSnap?.Invoke();
                if (!TryGetSnapshotBoardCounts(s, out var curB, out var curP, out var curT))
                {
                    await Task.Delay(80, ct);
                    continue;
                }

                long deltaB = curB - acceptedCounts.B;
                long deltaP = curP - acceptedCounts.P;
                long deltaT = curT - acceptedCounts.T;
                if (deltaB <= 0 && deltaP <= 0 && deltaT <= 0)
                {
                    await Task.Delay(80, ct);
                    continue;
                }

                char seqResultChar = '\0';
                if (deltaB > 0 && deltaP == 0 && deltaT == 0)
                    seqResultChar = 'B';
                else if (deltaB == 0 && deltaP > 0 && deltaT == 0)
                    seqResultChar = 'P';
                else if (deltaB == 0 && deltaP == 0 && deltaT > 0)
                    seqResultChar = 'T';

                if (seqResultChar == '\0')
                {
                    ctx.Log?.Invoke($"[BET][WAIT] count-delta-not-single-source | tab={tabKey} | dB={deltaB} | dP={deltaP} | dT={deltaT} | curB={curB} | curP={curP} | curT={curT} | baseB={acceptedCounts.B} | baseP={acceptedCounts.P} | baseT={acceptedCounts.T}");
                    await Task.Delay(80, ct);
                    continue;
                }

                bool? win = IsWin(betSide, seqResultChar);
                string settleResult = SeqCharToResult(seqResultChar);
                ctx.Log?.Invoke($"[BET][SETTLE] tab={tabKey} | result={settleResult} | dB={deltaB} | dP={deltaP} | dT={deltaT} | curB={curB} | curP={curP} | curT={curT} | baseB={acceptedCounts.B} | baseP={acceptedCounts.P} | baseT={acceptedCounts.T}");

                await ctx.UiDispatcher.InvokeAsync(() =>
                {
                    if (win.HasValue)
                    {
                        ctx.UiWinLoss?.Invoke(win.Value);
                        ctx.UiSetWinLossText?.Invoke(win.Value ? "Thắng" : "Thua");
                    }
                    else
                    {
                        ctx.UiSetWinLossText?.Invoke("Hòa");
                    }
                    if (!string.IsNullOrWhiteSpace(settleResult))
                        ctx.UiFinalizeBetResult?.Invoke(settleResult, s, "task-count-settle");
                });
                _lastAcceptedRawSeqByTab.TryRemove(tabKey, out _);
                _lastAcceptedBoardCountsByTab.TryRemove(tabKey, out _);
                _betInFlightByTab.TryRemove(tabKey, out _);
                return win;

                await Task.Delay(80, ct);
            }
        }
    }
}


