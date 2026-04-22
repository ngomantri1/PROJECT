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

        private sealed class AcceptedBetIssue
        {
            public long SettleSerial { get; init; }
            public long IssueSeqVersion { get; init; }
            public long RoundId { get; init; }
            public string IssueSeqDisplay { get; init; } = "";
        }

        // Khóa chống gửi lặp: sau khi đã gửi 1 lệnh, chặn gửi tiếp trong một cửa sổ an toàn
        private static readonly ConcurrentDictionary<string, long> _lastBetOkMsByTab = new();
        private static readonly ConcurrentDictionary<string, int> _lastBetRoundByTab = new();
        private static readonly ConcurrentDictionary<string, string> _lastBetSideByTab = new();
        private static readonly ConcurrentDictionary<string, AcceptedBetIssue> _lastAcceptedIssueByTab = new();
        private static readonly ConcurrentDictionary<string, byte> _betInFlightByTab = new();
        private const long SendOnlyCooldownMs = 3000;
        private const int BetSendTimeoutMs = 2500;

        // (tuỳ chọn) reset khi dừng task
        public static void ClearBetCooldown()
        {
            _lastBetOkMsByTab.Clear();
            _lastBetRoundByTab.Clear();
            _lastBetSideByTab.Clear();
            _lastAcceptedIssueByTab.Clear();
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
            double lowerBound = Math.Max(0, ctx.DecisionPercent);
            double upperBound = Math.Clamp(ctx.BetWhenRemainingPercent, 5, 100);
            if (lowerBound >= upperBound)
                lowerBound = 0;

            while (true)
            {
                ct.ThrowIfCancellationRequested();
                var s = ctx.GetSnap?.Invoke();
                double p = s?.prog ?? 100.0;
                if (p > lowerBound && p <= upperBound) break;
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
            var roundId = 0;
            var issueSeqDisplay = snap?.seq ?? "";
            var issueSeqVersion = 0L;
            try
            {
                var seqVer = snap?.seqVersion;
                if (seqVer.HasValue && seqVer.Value > 0)
                {
                    if (seqVer.Value > int.MaxValue) roundId = int.MaxValue;
                    else roundId = (int)seqVer.Value;
                    issueSeqVersion = seqVer.Value;
                }
                else
                {
                    roundId = (snap?.seq ?? "").Length;
                    issueSeqVersion = roundId;
                }
            }
            catch
            {
                roundId = 0;
                issueSeqVersion = 0;
            }

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
                _lastAcceptedIssueByTab[tabKey] = new AcceptedBetIssue
                {
                    SettleSerial = ctx.GetAuthoritySettleSerial?.Invoke() ?? 0,
                    IssueSeqVersion = issueSeqVersion > 0 ? issueSeqVersion : roundId,
                    RoundId = roundId,
                    IssueSeqDisplay = issueSeqDisplay ?? ""
                };
                _betInFlightByTab[tabKey] = 1;
            }
            return ok;
        }

        public static async Task ApplyPostRoundMoneyAsync(
            GameContext ctx,
            MoneyManager money,
            bool? win,
            double netDelta,
            CancellationToken ct)
        {
            ct.ThrowIfCancellationRequested();

            await ctx.UiDispatcher.InvokeAsync(() => ctx.UiAddWin?.Invoke(netDelta));

            bool isMultiChain = string.Equals(ctx.MoneyStrategyId, "MultiChain", StringComparison.OrdinalIgnoreCase);
            if (isMultiChain)
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
                    win,
                    netDelta);

                ctx.MoneyChainIndex = chainIndex;
                ctx.MoneyChainStep = chainStep;
                ctx.MoneyChainProfit = chainProfit;
            }
            else
            {
                money.OnRoundResult(win);
            }

            bool shouldReset =
                ctx.AutoResetStakeOnNonNegativeWin &&
                (ctx.ConsumeAutoResetStakeRequest?.Invoke() == true);
            if (!shouldReset)
                return;

            long nextStake;
            if (isMultiChain)
            {
                ctx.MoneyChainIndex = 0;
                ctx.MoneyChainStep = 0;
                ctx.MoneyChainProfit = 0;
                nextStake = MoneyHelper.CalcAmountMultiChain(ctx.StakeChains, 0, 0);
            }
            else
            {
                money.ResetToLevel1();
                nextStake = money.CurrentUnit;
            }

            await ctx.UiDispatcher.InvokeAsync(() =>
            {
                ctx.UiSetStake?.Invoke(nextStake);
                if (isMultiChain)
                    ctx.UiSetChainLevel?.Invoke(0, 0);
            });

            ctx.Log?.Invoke($"[MONEY][AUTO-RESET-NONNEG][APPLY] strategy={(string.IsNullOrWhiteSpace(ctx.MoneyStrategyId) ? "-" : ctx.MoneyStrategyId)} | stake={nextStake:N0} | multi={(isMultiChain ? 1 : 0)}");
        }

        public static async Task<bool?> WaitRoundFinishAndJudge(GameContext ctx, string betSide, string baseSeq, CancellationToken ct)
        {
            var tabKey = string.IsNullOrWhiteSpace(ctx?.TabId) ? "_default" : ctx.TabId;
            if (ctx?.WaitAuthoritySettleAsync == null)
            {
                ctx?.Log?.Invoke($"[BET][SKIP] authority-settle-wait-not-available | tab={tabKey}");
                _betInFlightByTab.TryRemove(tabKey, out _);
                _lastAcceptedIssueByTab.TryRemove(tabKey, out _);
                return null;
            }

            if (!_lastAcceptedIssueByTab.TryGetValue(tabKey, out var acceptedIssue))
            {
                ctx.Log?.Invoke($"[BET][SKIP] missing accepted authority issue | tab={tabKey} | baseLen={(baseSeq ?? "").Length}");
                _betInFlightByTab.TryRemove(tabKey, out _);
                return null;
            }

            long waitAfterSerial = acceptedIssue.SettleSerial;
            long issueVersion = acceptedIssue.IssueSeqVersion > 0 ? acceptedIssue.IssueSeqVersion : (baseSeq ?? "").Length;
            ctx.Log?.Invoke($"[BET][WAIT][AUTH] tab={tabKey} | afterSerial={waitAfterSerial} | issueSeqVer={issueVersion} | issueRound={acceptedIssue.RoundId} | issueLen={acceptedIssue.IssueSeqDisplay.Length}");

            while (true)
            {
                ct.ThrowIfCancellationRequested();
                var settle = await ctx.WaitAuthoritySettleAsync(waitAfterSerial, ct);
                if (settle == null)
                    continue;

                waitAfterSerial = Math.Max(waitAfterSerial, settle.Serial);
                if (settle.SeqVersion > 0 && settle.SeqVersion <= issueVersion)
                {
                    ctx.Log?.Invoke($"[BET][WAIT][AUTH-SKIP] reason=stale-settle | tab={tabKey} | serial={settle.Serial} | settleSeqVer={settle.SeqVersion} | issueSeqVer={issueVersion} | result={settle.ResultText}");
                    continue;
                }

                bool? win = IsWin(betSide, settle.ResultChar);
                string settleResult = !string.IsNullOrWhiteSpace(settle.ResultText)
                    ? settle.ResultText
                    : SeqCharToResult(settle.ResultChar);
                ctx.Log?.Invoke($"[BET][SETTLE] tab={tabKey} | result={settleResult} | serial={settle.Serial} | settleSeqVer={settle.SeqVersion} | settleEvt={(string.IsNullOrWhiteSpace(settle.SeqEvent) ? "-" : settle.SeqEvent)} | settleTable={(settle.TableId > 0 ? settle.TableId.ToString() : "-")} | settleShoe={(settle.GameShoe > 0 ? settle.GameShoe.ToString() : "-")} | settleRound={(settle.GameRound > 0 ? settle.GameRound.ToString() : "-")} | issueSeqVer={issueVersion} | reason={(string.IsNullOrWhiteSpace(settle.Reason) ? "-" : settle.Reason)}");

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
                });
                _lastAcceptedIssueByTab.TryRemove(tabKey, out _);
                _betInFlightByTab.TryRemove(tabKey, out _);
                return win;
            }
        }
    }
}


