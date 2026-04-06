using System;
using System.Collections.Concurrent;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Input;
using System.Windows.Threading;
using System.Linq;
using System.Windows;
using System.Windows.Controls;

namespace TaiXiuLiveHit.Tasks
{
    internal static class TaskUtil
    {
        // Khóa chống bắn đúp theo từng tab: 3s kể từ lần place bet THÀNH CÔNG gần nhất
        private static readonly ConcurrentDictionary<string, long> _lastBetOkMsByTab = new();
        private static readonly ConcurrentDictionary<string, string> _lastBetSessionByTab = new();
        private static readonly ConcurrentDictionary<string, string> _lastBetSideByTab = new();
        private static readonly ConcurrentDictionary<string, SemaphoreSlim> _betGateByTab = new();

        // (tuỳ chọn) reset khi dừng task
        public static void ClearBetCooldown()
        {
            _lastBetOkMsByTab.Clear();
            _lastBetSessionByTab.Clear();
            _lastBetSideByTab.Clear();
            _betGateByTab.Clear();
        }

        public static string ParityCharToSide(char ch) => (ch == 'T') ? "TAI" : "XIU";
        public static char DigitToParity(char d) => (d == 'T') ? 'T' : 'X';
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

        public static bool IsWin(string betSide, char lastDigit)
        {
            var lastSide = (lastDigit == 'T') ? "TAI" : "XIU";
            return string.Equals(betSide, lastSide, StringComparison.OrdinalIgnoreCase);
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
                var p = s?.prog ?? 1.0;   // prog = 0..1 (thời gian còn lại)
                // Sau khi đã thấy prog thấp rồi, lần đầu prog nhảy cao trở lại => phiên mới
                if (p >= ctx.DecisionPercent && p <= 0.97)
                    break;
                await Task.Delay(120, ct);
            }
        }



        public static async Task<bool> PlaceBet(GameContext ctx, string side, long amount, CancellationToken ct, bool ignoreCooldown = false)
        {
            var tabKey = string.IsNullOrWhiteSpace(ctx?.TabId) ? "_default" : ctx.TabId;
            var gate = _betGateByTab.GetOrAdd(tabKey, _ => new SemaphoreSlim(1, 1));
            if (!await gate.WaitAsync(0, ct))
            {
                ctx.Log?.Invoke($"[BET] tab={tabKey} đang có lệnh bet khác chạy, bỏ qua để tránh bắn đúp");
                return false;
            }

            try
            {
                var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
                var snap = ctx.GetSnap?.Invoke();
                var session = snap?.session ?? "";

                var last = _lastBetOkMsByTab.TryGetValue(tabKey, out var lastMs) ? lastMs : 0;
                var lastSession = _lastBetSessionByTab.TryGetValue(tabKey, out var sessionVal) ? sessionVal : "";
                var lastSide = _lastBetSideByTab.TryGetValue(tabKey, out var sideVal) ? sideVal : "";
                var sameSession = !string.IsNullOrWhiteSpace(session) &&
                                  string.Equals(lastSession, session, StringComparison.Ordinal);
                var sameSide = string.Equals(lastSide, side, StringComparison.OrdinalIgnoreCase);

                if (!ignoreCooldown && sameSession && sameSide && now - last < 3000)
                {
                    ctx.Log?.Invoke($"[BET] tab={tabKey} cooldown 3s active, skip ({3000 - (now - last)}ms left)");
                    return false;
                }

                // Cập nhật UI chỉ khi thực sự được phép bắn
                await ctx.UiDispatcher.InvokeAsync(() => ctx.UiSetSide?.Invoke(side));
                await ctx.UiDispatcher.InvokeAsync(() => ctx.UiSetStake?.Invoke(amount));

                // Giữ contract gọi bet xuống JS như hiện tại
                var js =
                    "(async function(){try{" +
                    " if (typeof window.__cw_bet==='function'){" +
                    "   return String(await window.__cw_bet('" + side + "', " + amount + "));" +
                    " } else { return 'no'; }" +
                    "}catch(e){ return 'err:' + (e && e.message ? e.message : e); }})();";

                var rRaw = await ctx.EvalJsAsync(js);
                ctx.Log?.Invoke($"[BET-JS] tab={tabKey} session={session} result={rRaw}");

                bool ok = true;
                if (ok)
                {
                    _lastBetOkMsByTab[tabKey] = now;
                    _lastBetSessionByTab[tabKey] = session;
                    _lastBetSideByTab[tabKey] = side ?? "";
                }

                return ok;
            }
            finally
            {
                try { gate.Release(); } catch { }
            }
        }



        public static async Task<bool> WaitRoundFinishAndJudge(GameContext ctx, string betSide, string baseSession, CancellationToken ct)
        {
            // chờ seq tăng độ dài → có kết quả mới
            while (true)
            {
                ct.ThrowIfCancellationRequested();
                var s = ctx.GetSnap?.Invoke();
                var curSeq = s?.seq ?? "";
                var curSession = s?.session ?? "";
                if (!string.Equals(curSession, baseSession, StringComparison.Ordinal))
                {
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



