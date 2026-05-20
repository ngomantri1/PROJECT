using System;
using System.Threading;
using System.Threading.Tasks;
using System.Collections.Concurrent;
using System.Windows.Input;
using System.Windows.Threading;
using System.Linq;
using System.Windows;
using System.Windows.Controls;

namespace XocDiaSoiVIP389.Tasks
{
    internal static class TaskUtil
    {
        // Khóa chống bắn đúp: 3s kể từ lần place bet THÀNH CÔNG gần nhất
        private static readonly ConcurrentDictionary<string, long> _lastBetOkMsByTab = new();
        private static readonly ConcurrentDictionary<string, int> _lastBetRoundByTab = new();
        private static readonly ConcurrentDictionary<string, string> _lastBetSideByTab = new();
        // Mỗi tab chỉ cho phép 1 lệnh trong cùng một cửa sổ "Đang cược"
        private static readonly ConcurrentDictionary<string, bool> _betIssuedInOpenWindowByTab = new();
        // Đánh dấu ván vừa kết thúc là hòa (chỉ áp dụng cho cửa TÀI/XỈU)
        private static readonly ConcurrentDictionary<string, bool> _lastRoundDrawByTab = new();

        // (tuỳ chọn) reset khi dừng task
        public static void ClearBetCooldown()
        {
            _lastBetOkMsByTab.Clear();
            _lastBetRoundByTab.Clear();
            _lastBetSideByTab.Clear();
            _betIssuedInOpenWindowByTab.Clear();
            _lastRoundDrawByTab.Clear();
        }

        public static string ParityCharToSide(char ch) => (DigitToParity(ch) == 'C') ? "CHAN" : "LE";
        public static char DigitToParity(char d)
        {
            return d switch
            {
                'C' or 'c' or '0' or '2' or '4' => 'C',
                'L' or 'l' or '1' or '3' => 'L',
                _ => '\0'
            };
        }
        public static string TxCharToSide(char ch) => (DigitToTx(ch) == 'X') ? "XIU" : "TAI";
        public static char DigitToTx(char d)
        {
            return d switch
            {
                'X' or 'x' or '0' or '1' => 'X',
                // Rule: 2 là hòa, không phải TÀI cũng không phải XỈU.
                'T' or 't' or '3' or '4' or '5' or '6' => 'T',
                _ => '\0'
            };
        }
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
            int n = 0;
            for (int i = 0; i < digitSeq.Length; i++)
            {
                var p = DigitToParity(digitSeq[i]);
                if (p == 'C' || p == 'L')
                    a[n++] = p;
            }
            return (n == a.Length) ? new string(a) : new string(a, 0, n);
        }
        public static string SeqToTxString(string digitSeq)
        {
            if (string.IsNullOrEmpty(digitSeq)) return "";
            char[] a = new char[digitSeq.Length];
            int n = 0;
            for (int i = 0; i < digitSeq.Length; i++)
            {
                var p = DigitToTx(digitSeq[i]);
                if (p == 'X' || p == 'T')
                    a[n++] = p;
            }
            return (n == a.Length) ? new string(a) : new string(a, 0, n);
        }

        public static bool IsWin(string betSide, char lastDigit)
        {
            var side = (betSide ?? "").Trim().ToUpperInvariant();
            if (side == "CHAN" || side == "LE")
            {
                var p = DigitToParity(lastDigit);
                if (p != 'C' && p != 'L') return false;
                var lastSide = (p == 'C') ? "CHAN" : "LE";
                return string.Equals(side, lastSide, StringComparison.OrdinalIgnoreCase);
            }
            if (side == "TAI" || side == "XIU")
            {
                var t = DigitToTx(lastDigit);
                if (t != 'T' && t != 'X') return false;
                var lastSide = (t == 'T') ? "TAI" : "XIU";
                return string.Equals(side, lastSide, StringComparison.OrdinalIgnoreCase);
            }
            return false;
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
            // Quy ước: prog = phần trăm thời gian đã trôi/hoặc còn lại. Ở code bạn set LblProg = p*100,
            // ta chọn ngưỡng “<= DecisionPercent” để vào tiền trễ (15% cuối).
            var tabKey = string.IsNullOrWhiteSpace(ctx?.TabId) ? "_default" : ctx.TabId;
            while (true)
            {
                ct.ThrowIfCancellationRequested();
                var s = ctx.GetSnap?.Invoke();
                double p = s?.prog ?? 1.0;
                var status = (s?.status ?? "").Trim();
                bool isOpen = p > 0 || status.IndexOf("Đang cược", StringComparison.OrdinalIgnoreCase) >= 0;
                if (!isOpen) _betIssuedInOpenWindowByTab[tabKey] = false;
                //TaskUtil.UiRoundMaybeReset(p, ctx.DecisionPercent);
                if (p <= ctx.DecisionPercent && p > 0) break;
                await Task.Delay(60, ct);
            }
        }

        // Chờ sang phiên mới rồi đặt NGAY khi mở cửa (đặt sớm, KHÔNG phụ thuộc DecisionPercent)
        public static async Task WaitUntilNewRoundStart(GameContext ctx, CancellationToken ct)
        {
            var tabKey = string.IsNullOrWhiteSpace(ctx?.TabId) ? "_default" : ctx.TabId;
            while (true)
            {
                ct.ThrowIfCancellationRequested();
                var s = ctx.GetSnap?.Invoke();
                double p = s?.prog ?? 1.0;
                if (p >= ctx.DecisionPercent) break;
                await Task.Delay(60, ct);
            }
        }


        public static async Task<bool> PlaceBet(GameContext ctx, string side, long amount, CancellationToken ct, bool ignoreCooldown = false)
        {
            var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            var tabKey = string.IsNullOrWhiteSpace(ctx?.TabId) ? "_default" : ctx.TabId;

            var snap = ctx.GetSnap?.Invoke();

            var roundId = 0;
            try
            {
                roundId = snap?.roundId ?? 0;
            }
            catch { roundId = 0; }

            // G?I intent xu?ng JS queue
            var js =
                "(async function(){try{" +
                " var intent = { tabId: '" + tabKey + "', roundId: " + roundId + ", side: '" + side + "', amount: " + amount + " };" +
                " if (typeof window.__cw_bet_enqueue==='function'){" +
                "   return String(await window.__cw_bet_enqueue(intent));" +
                " } else if (typeof window.__cw_bet==='function'){" +
                "   return String(await window.__cw_bet('" + side + "', " + amount + "));" +
                " } else { return 'no'; }" +
                "}catch(e){ return 'err:' + (e && e.message ? e.message : e); }})();";

            try
            {
                _ = ctx.EvalJsAsync(js);
            }
            catch (Exception ex)
            {
                ctx.Log?.Invoke($"[BET-JS][FIRE-ERR] tab={tabKey} round={roundId} err={ex.Message}");
            }
            ctx.Log?.Invoke($"[BET-JS] tab={tabKey} round={roundId} result=fire-and-forget");

            // C# enqueue xong là ghi pending history ngay; gom một lượt UI để không làm chậm nhịp bet.
            await ctx.UiDispatcher.InvokeAsync(() =>
            {
                ctx.UiRecordBetIssued?.Invoke(side, amount, tabKey, roundId);
                ctx.UiSetSide?.Invoke(side);
                ctx.UiSetStake?.Invoke(amount);
            });

            _lastBetOkMsByTab[tabKey] = now;
            _lastBetRoundByTab[tabKey] = roundId;
            _lastBetSideByTab[tabKey] = side ?? "";
            _betIssuedInOpenWindowByTab[tabKey] = true;

            return true;
        }

        public static async Task ApplyMoneyAfterRoundAsync(GameContext ctx, MoneyManager money, bool win, double netDelta)
        {
            var tabKey = string.IsNullOrWhiteSpace(ctx?.TabId) ? "_default" : ctx.TabId;
            if (_lastRoundDrawByTab.TryGetValue(tabKey, out var isDraw) && isDraw)
            {
                _lastRoundDrawByTab[tabKey] = false;
                ctx.Log?.Invoke("[ROUND] Hòa (digit=2): không cộng/trừ tiền, không đổi mức.");
                return;
            }

            bool isMultiChain = string.Equals(ctx.MoneyStrategyId, "MultiChain", StringComparison.OrdinalIgnoreCase);

            await ctx.UiDispatcher.InvokeAsync(() => ctx.UiAddWin?.Invoke(netDelta));

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
                    win);

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
                if (ctx.UiSetStakeDisplay != null)
                    ctx.UiSetStakeDisplay.Invoke(nextStake);
                else
                    ctx.UiSetStake?.Invoke(nextStake);
                if (isMultiChain)
                    ctx.UiSetChainLevel?.Invoke(0, 0);
            });

            ctx.Log?.Invoke($"[MONEY][AUTO-RESET-NONNEG][APPLY] strategy={(string.IsNullOrWhiteSpace(ctx.MoneyStrategyId) ? "-" : ctx.MoneyStrategyId)} | stake={nextStake:N0} | multi={(isMultiChain ? 1 : 0)}");
        }

        public static async Task<bool> WaitRoundFinishAndJudge(GameContext ctx, string betSide, string baseSeq, CancellationToken ct)
        {
            var tabKey = string.IsNullOrWhiteSpace(ctx?.TabId) ? "_default" : ctx.TabId;
            var snap0 = ctx.GetSnap?.Invoke();
            var baseRoundId = snap0?.roundId ?? 0;
            var baseSeqSafe = string.IsNullOrEmpty(baseSeq) ? (snap0?.seq ?? "") : baseSeq;

            // Ưu tiên chờ đổi roundId; fallback seq nếu roundId chưa khả dụng.
            while (true)
            {
                ct.ThrowIfCancellationRequested();
                var s = ctx.GetSnap?.Invoke();
                var curRoundId = s?.roundId ?? 0;
                var curSeq = s?.seq ?? "";

                bool roundChanged;
                if (baseRoundId > 0 && curRoundId > 0)
                    roundChanged = curRoundId != baseRoundId;
                else
                    roundChanged = !string.Equals(curSeq, baseSeqSafe, StringComparison.Ordinal);

                if (roundChanged)
                {
                    if (string.IsNullOrEmpty(curSeq))
                    {
                        await Task.Delay(120, ct);
                        continue;
                    }

                    var sideNorm = (betSide ?? "").Trim().ToUpperInvariant();
                    if ((sideNorm == "TAI" || sideNorm == "XIU") && DigitToTx(curSeq[^1]) == '\0')
                    {
                        _lastRoundDrawByTab[tabKey] = true;
                        ctx.Log?.Invoke($"[ROUND] Draw detected for {sideNorm} at digit={curSeq[^1]}");
                        return false;
                    }

                    _lastRoundDrawByTab[tabKey] = false;
                    bool win = IsWin(betSide, curSeq[^1]);
                    await ctx.UiDispatcher.InvokeAsync(() => ctx.UiWinLoss?.Invoke(win));
                    // cộng tiền lũy kế: +amount khi thắng, -amount khi thua (đơn giản)
                    //TaskUtil.UiRoundAllowNextReset();
                    return win;
                }
                await Task.Delay(120, ct);
            }
        }
    }
}
