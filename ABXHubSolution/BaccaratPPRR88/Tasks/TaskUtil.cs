using System;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Input;
using System.Windows.Threading;
using System.Linq;
using System.Collections.Concurrent;
using System.Windows;
using System.Windows.Controls;
using System.Text.Json;

namespace BaccaratPPRR88.Tasks
{
    internal static class TaskUtil
    {
        // Khóa chống bắn đúp: 3s kể từ lần place bet THÀNH CÔNG gần nhất
        private static readonly ConcurrentDictionary<string, long> _lastBetOkByTable = new ConcurrentDictionary<string, long>(StringComparer.OrdinalIgnoreCase);
        private static readonly SemaphoreSlim _betQueue = new SemaphoreSlim(1, 1);

        // (tuỳ chọn) reset khi dừng task
        public static void ClearBetCooldown() => _lastBetOkByTable.Clear();

        public static string ParityCharToSide(char ch) => (ch == 'P') ? "P" : "B";
        public static char DigitToParity(char d)
        {
            if (d == 'P' || d == 'B') return d;
            if (char.IsDigit(d))
                return ((d - '0') % 2 == 0) ? 'P' : 'B';
            return 'P';
        }
        // TaskUtil.cs (trong class TaskUtil)
        private static readonly object _betLock = new object();
        private static string _lastBetSeq = "";
        private static long _lastBetMs = 0;
        // Reset UI 1 lần ngay khi vào cửa sổ đặt (countdown >= DecisionPercent)
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
            var lastSide = ParityCharToSide(DigitToParity(lastDigit));
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




        // Gọi khi đã có countdown (giây) để reset đúng 1 lần
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

        private static void ApplyGlobalResetIfNeeded(GameContext ctx)
        {
            if (ctx == null) return;
            var resetVersion = MoneyHelper.GetGlobalResetVersion();
            if (ctx.MoneyResetVersion == resetVersion) return;

            ctx.MoneyResetVersion = resetVersion;
            ctx.MoneyChainIndex = 0;
            ctx.MoneyChainStep = 0;
            ctx.MoneyChainProfit = 0;
        }

        public static async Task WaitUntilBetWindow(GameContext ctx, CancellationToken ct)
        {
            // Quy ước: prog = countdown (giây). Chờ tới khi còn <= DecisionPercent giây thì vào tiền trễ.
            while (true)
            {
                ct.ThrowIfCancellationRequested();
                ApplyGlobalResetIfNeeded(ctx);
                var s = ctx.GetSnap?.Invoke();
                double p = s?.prog ?? 0.0;
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
                ApplyGlobalResetIfNeeded(ctx);
                var s = ctx.GetSnap?.Invoke();
                double p = s?.prog ?? 0.0;
                //TaskUtil.UiRoundMaybeReset(p, ctx.DecisionPercent);
                if (p >= ctx.DecisionPercent) break;
                await Task.Delay(120, ct);
            }
        }


        public static async Task<bool> PlaceBet(GameContext ctx, string side, long amount, CancellationToken ct)
        {
            // Cập nhật UI chỉ khi thực sự được phép bắn
            await ctx.UiDispatcher.InvokeAsync(() => ctx.UiSetSide?.Invoke(side));
            await ctx.UiDispatcher.InvokeAsync(() => ctx.UiSetStake?.Invoke(amount));

            var tableId = ctx.TableId ?? "";
            if (string.IsNullOrWhiteSpace(tableId))
            {
                ctx.Log?.Invoke("[BET] missing tableId");
                return false;
            }

            await _betQueue.WaitAsync(ct);
            try
            {
                var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
                var last = _lastBetOkByTable.TryGetValue(tableId, out var lastMs) ? lastMs : 0;
                if (now - last < 3000)  // 3 giây khoá sau lần bet OK gần nhất
                {
                    ctx.Log?.Invoke($"[BET] cooldown 3s active, skip ({3000 - (now - last)}ms left)");
                    return false;
                }

                var tableIdJson = JsonSerializer.Serialize(tableId);
                var sideJson = JsonSerializer.Serialize(side ?? "");

            // GỌI __cw_bet AN TOÀN (giữ nguyên như code hiện tại)
            var js =
                "(function(){try{" +
                " if (typeof window.__cw_bet==='function'){" +
                "   return window.__cw_bet(" + tableIdJson + ", " + sideJson + ", " + amount + ");" +
                " } else { return 'no'; }" +
                "}catch(e){ return 'err:' + (e && e.message ? e.message : e); }})();";

            var r = await ctx.EvalJsAsync(js);
            ctx.Log?.Invoke($"[BET-JS] result={r}");

            // Chỉ coi là thành công khi JS trả về 'ok'
            bool ok = string.Equals(r, "ok", StringComparison.OrdinalIgnoreCase);

            if (ok)
                _lastBetOkByTable[tableId] = now; // kích hoạt khoá 3s

            return ok;
            }
            finally
            {
                _betQueue.Release();
            }
        }



        public static async Task<bool> WaitRoundFinishAndJudge(GameContext ctx, string betSide, string baseSession, CancellationToken ct)
        {
            // chờ seq tăng độ dài → có kết quả mới
            while (true)
            {
                ct.ThrowIfCancellationRequested();
                ApplyGlobalResetIfNeeded(ctx);
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


