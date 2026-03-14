using System;
using System.Threading;
using System.Threading.Tasks;
using System.Collections.Concurrent;
using System.Windows.Input;
using System.Windows.Threading;
using System.Linq;
using System.Windows;
using System.Windows.Controls;

namespace BaccaratSexyCasino.Tasks
{
    internal static class TaskUtil
    {
        internal enum RoundOutcome
        {
            Win,
            Lose,
            Push
        }

        // Khóa chống bắn đúp: 3s kể từ lần place bet THÀNH CÔNG gần nhất
        private static readonly ConcurrentDictionary<string, long> _lastBetOkMsByTab = new();
        private static readonly ConcurrentDictionary<string, int> _lastBetRoundByTab = new();
        private static readonly ConcurrentDictionary<string, string> _lastBetSideByTab = new();
        private static readonly ConcurrentDictionary<string, string> _lastAcceptedPlayableSeqByTab = new();

        // (tuỳ chọn) reset khi dừng task
        public static void ClearBetCooldown()
        {
            _lastBetOkMsByTab.Clear();
            _lastBetRoundByTab.Clear();
            _lastBetSideByTab.Clear();
            _lastAcceptedPlayableSeqByTab.Clear();
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
            // Quy ước: prog = phần trăm thời gian đã trôi/hoặc còn lại. Ở code bạn set LblProg = p*100,
            // ta chọn ngưỡng “<= DecisionPercent” để vào tiền trễ (15% cuối).
            while (true)
            {
                ct.ThrowIfCancellationRequested();
                var s = ctx.GetSnap?.Invoke();
                double p = s?.prog ?? 1.0;
                //TaskUtil.UiRoundMaybeReset(p, ctx.DecisionPercent);
                if (p <= ctx.DecisionPercent && p > 0) break;
                await Task.Delay(120, ct);
            }
        }

        // Chờ sang phiên mới rồi đặt NGAY khi mở cửa (đặt sớm, KHÔNG phụ thuộc DecisionPercent)
        public static async Task WaitUntilNewRoundStart(GameContext ctx, CancellationToken ct)
        {
            while (true)
            {
                ct.ThrowIfCancellationRequested();
                var s = ctx.GetSnap?.Invoke();
                double p = s?.prog ?? 1.0;
                //TaskUtil.UiRoundMaybeReset(p, ctx.DecisionPercent);
                if (p >= ctx.DecisionPercent) break;
                await Task.Delay(120, ct);
            }
        }


        public static async Task<bool> PlaceBet(GameContext ctx, string side, long amount, CancellationToken ct, bool ignoreCooldown = false)
        {
            var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            var tabKey = string.IsNullOrWhiteSpace(ctx?.TabId) ? "_default" : ctx.TabId;

            var playableSnap = ctx.GetSnap?.Invoke();
            var snap = ctx.GetRawSnap?.Invoke() ?? playableSnap;
            var playableSeq = playableSnap?.seq ?? "";
            var roundId = 0;
            try { roundId = (snap?.seq ?? "").Length; } catch { roundId = 0; }

            var last = _lastBetOkMsByTab.TryGetValue(tabKey, out var v) ? v : 0;
            var lastRound = _lastBetRoundByTab.TryGetValue(tabKey, out var r) ? r : -1;
            var lastSide = _lastBetSideByTab.TryGetValue(tabKey, out var s) ? s : "";
            var sameRound = lastRound == roundId && roundId > 0;
            var sameSide = string.Equals(lastSide, side, StringComparison.OrdinalIgnoreCase);

            // Allow multi-side in same round; keep cooldown for same side only
            if (!ignoreCooldown)
            {
                if (sameRound && sameSide && now - last < 3000)
                {
                    _lastAcceptedPlayableSeqByTab.TryRemove(tabKey, out _);
                    return false;
                }
            }

            // Gửi intent xuống JS queue; với WebView2 phải chờ kết quả qua postMessage vì ExecuteScriptAsync không await Promise JS.
            var js =
                "(async function(){try{" +
                " var intent = { tabId: '" + tabKey + "', roundId: " + roundId + ", side: '" + side + "', amount: " + amount + " };" +
                " if (typeof window.__cw_bet_enqueue==='function'){" +
                "   return await window.__cw_bet_enqueue(intent);" +
                " } else if (typeof window.__cw_bet==='function'){" +
                "   return await window.__cw_bet('" + side + "', " + amount + ");" +
                " } else { return 'no'; }" +
                "}catch(e){ return 'err:' + (e && e.message ? e.message : e); }})()";

            var eval = ctx.EvalJsAwaitResultAsync ?? ctx.EvalJsAsync;
            var rRaw = await eval(js);
            ctx.Log?.Invoke($"[BET-JS] tab={tabKey} round={roundId} result={rRaw}");

            var normalized = (rRaw ?? "").Trim();
            if (!string.IsNullOrWhiteSpace(normalized))
                normalized = normalized.Trim().Trim('"');
            bool ok =
                string.Equals(normalized, "ok", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(normalized, "true", StringComparison.OrdinalIgnoreCase);

            if (ok)
            {
                await ctx.UiDispatcher.InvokeAsync(() =>
                {
                    ctx.UiSetSide?.Invoke(side);
                    ctx.UiSetStake?.Invoke(amount);
                });
                _lastBetOkMsByTab[tabKey] = now; // kích hoạt khóa 3s
                _lastBetRoundByTab[tabKey] = roundId;
                _lastBetSideByTab[tabKey] = side ?? "";
                _lastAcceptedPlayableSeqByTab[tabKey] = playableSeq;
            }
            else
            {
                _lastAcceptedPlayableSeqByTab.TryRemove(tabKey, out _);
            }

            return ok;
        }
        public static async Task<bool?> WaitRoundFinishAndJudge(GameContext ctx, string betSide, string baseSeq, CancellationToken ct)
        {
            var tabKey = string.IsNullOrWhiteSpace(ctx?.TabId) ? "_default" : ctx.TabId;
            if (!_lastAcceptedPlayableSeqByTab.TryGetValue(tabKey, out var acceptedSeq) ||
                !string.Equals(acceptedSeq ?? "", baseSeq ?? "", StringComparison.Ordinal))
            {
                ctx.Log?.Invoke($"[BET][SKIP] no accepted bet for settle | tab={tabKey} | seq={baseSeq ?? ""}");
                while (true)
                {
                    ct.ThrowIfCancellationRequested();
                    var skippedSnap = ctx.GetSnap?.Invoke();
                    var skippedSeq = skippedSnap?.seq ?? "";
                    if (!string.Equals(skippedSeq, baseSeq ?? "", StringComparison.Ordinal))
                        break;
                    await Task.Delay(120, ct);
                }
                return null;
            }

            // chờ seq tăng độ dài → có kết quả mới
            while (true)
            {
                ct.ThrowIfCancellationRequested();
                var s = ctx.GetSnap?.Invoke();
                var curSeq = s?.seq ?? "";
                if (!string.Equals(curSeq, baseSeq, StringComparison.Ordinal))
                {
                    bool? win = IsWin(betSide, curSeq[^1]);
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
                    if (_lastAcceptedPlayableSeqByTab.TryGetValue(tabKey, out var pendingSeq) &&
                        string.Equals(pendingSeq ?? "", baseSeq ?? "", StringComparison.Ordinal))
                    {
                        _lastAcceptedPlayableSeqByTab.TryRemove(tabKey, out _);
                    }
                    // cộng tiền lũy kế: +amount khi thắng, -amount khi thua (đơn giản)
                    //TaskUtil.UiRoundAllowNextReset();
                    return win;
                }
                await Task.Delay(120, ct);
            }
        }
    }
}


