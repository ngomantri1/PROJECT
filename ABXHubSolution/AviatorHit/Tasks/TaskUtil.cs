using System;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Input;
using System.Windows.Threading;
using System.Linq;
using System.Windows;
using System.Windows.Controls;

namespace AviatorHit.Tasks
{
    internal static class TaskUtil
    {
        // Khóa chống bắn đúp: 3s kể từ lần place bet THÀNH CÔNG gần nhất
        private static long _lastBetOkMs = 0;

        // (tuỳ chọn) reset khi dừng task
        public static void ClearBetCooldown() => Volatile.Write(ref _lastBetOkMs, 0);

        public static string ParityCharToSide(char ch) => (ch == 'C') ? "CHAN" : "LE";
        public static char DigitToParity(char d) => (d == '0' || d == '2' || d == '4') ? 'C' : 'L';
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
            var lastSide = (lastDigit == '0' || lastDigit == '2' || lastDigit == '4') ? "CHAN" : "LE";
            return string.Equals(betSide, lastSide, StringComparison.OrdinalIgnoreCase);
        }

        public static bool TryParseMultiplier(string? raw, out double value)
        {
            value = 0;
            var s = (raw ?? "").Trim();
            if (string.IsNullOrWhiteSpace(s)) return false;
            if (s.EndsWith("x", StringComparison.OrdinalIgnoreCase))
                s = s[..^1];
            s = s.Replace(",", "");
            return double.TryParse(s, System.Globalization.NumberStyles.Float,
                System.Globalization.CultureInfo.InvariantCulture, out value);
        }

        public static string GetLatestAviatorResult(string? seq)
        {
            if (string.IsNullOrWhiteSpace(seq)) return "";
            var parts = seq.Split('|', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            return parts.Length == 0 ? "" : parts[^1];
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
            var last = Volatile.Read(ref _lastBetOkMs);
            if (!ignoreCooldown && now - last < 3000)  // 3 giây khoá sau lần bet OK gần nhất
            {
                ctx.Log?.Invoke($"[BET] cooldown 3s active, skip ({3000 - (now - last)}ms left)");
                return false;
            }

            // Cập nhật UI chỉ khi thực sự được phép bắn
            await ctx.UiDispatcher.InvokeAsync(() => ctx.UiSetSide?.Invoke(side));
            await ctx.UiDispatcher.InvokeAsync(() => ctx.UiSetStake?.Invoke(amount));

            // GỌI __cw_bet AN TOÀN (giữ nguyên như code hiện tại)
            var js =
                "(async function(){try{" +
                " if (typeof window.__cw_bet==='function'){" +
                "   return String(await window.__cw_bet('" + side + "', " + amount + "));" +
                " } else { return 'no'; }" +
                "}catch(e){ return 'err:' + (e && e.message ? e.message : e); }})();";

            var rRaw = await ctx.EvalJsAsync(js);
            ctx.Log?.Invoke($"[BET-JS] result={rRaw}");

            // Không kiểm tra thành công/thất bại để tránh bắn lặp; chỉ đẩy lệnh một lần
            bool ok = true;

            if (ok)
                Volatile.Write(ref _lastBetOkMs, now); // kích hoạt khoá 3s

            return ok;
        }

        public static async Task<bool> PlaceBet(GameContext ctx, long amount, double target, CancellationToken ct, bool ignoreCooldown = false)
        {
            var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            var last = Volatile.Read(ref _lastBetOkMs);
            if (!ignoreCooldown && now - last < 3000)
            {
                ctx.Log?.Invoke($"[BET] cooldown 3s active, skip ({3000 - (now - last)}ms left)");
                return false;
            }

            await ctx.UiDispatcher.InvokeAsync(() => ctx.UiSetSide?.Invoke("AUTO"));
            await ctx.UiDispatcher.InvokeAsync(() => ctx.UiSetStake?.Invoke(amount));
            await ctx.UiDispatcher.InvokeAsync(() => ctx.UiSetTarget?.Invoke(target));

            var js =
                "(async function(){try{" +
                " if (typeof window.__cw_bet==='function'){" +
                "   return String(await window.__cw_bet(" + amount + ", " + target.ToString(System.Globalization.CultureInfo.InvariantCulture) + "));" +
                " } else { return 'no'; }" +
                "}catch(e){ return 'err:' + (e && e.message ? e.message : e); }})();";

            var rRaw = await ctx.EvalJsAsync(js);
            ctx.Log?.Invoke($"[AVIATOR-BET-JS] result={rRaw} amount={amount:N0} target={target:0.00}x");

            var ok = !string.IsNullOrWhiteSpace(rRaw) &&
                     rRaw.IndexOf("fail", StringComparison.OrdinalIgnoreCase) < 0 &&
                     rRaw.IndexOf("err:", StringComparison.OrdinalIgnoreCase) < 0 &&
                     rRaw.IndexOf("no", StringComparison.OrdinalIgnoreCase) < 0;

            if (ok)
                Volatile.Write(ref _lastBetOkMs, now);

            return ok;
        }



        public static async Task<bool> WaitRoundFinishAndJudge(GameContext ctx, string betSide, string baseSeq, CancellationToken ct)
        {
            // chờ seq tăng độ dài → có kết quả mới
            while (true)
            {
                ct.ThrowIfCancellationRequested();
                var s = ctx.GetSnap?.Invoke();
                var curSeq = s?.seq ?? "";
                if (!string.Equals(curSeq, baseSeq, StringComparison.Ordinal))
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

        public static async Task<bool> WaitRoundFinishAndJudge(GameContext ctx, string baseSeq, double target, CancellationToken ct)
        {
            while (true)
            {
                ct.ThrowIfCancellationRequested();
                var s = ctx.GetSnap?.Invoke();

                var curSeq = s?.seq ?? "";
                if (!string.Equals(curSeq, baseSeq, StringComparison.Ordinal))
                {
                    var latest = GetLatestAviatorResult(curSeq);
                    var finalValue = TryParseMultiplier(latest, out var parsedFinal) ? parsedFinal : 0;
                    var win = finalValue >= target;
                    await ctx.UiDispatcher.InvokeAsync(() => ctx.UiWinLoss?.Invoke(win));
                    await ctx.UiDispatcher.InvokeAsync(() => ctx.UiFinalizeAviatorBet?.Invoke(latest, win));
                    ctx.Log?.Invoke($"[AVIATOR-ROUND] final={latest} target={target:0.00}x win={win}");
                    return win;
                }

                await Task.Delay(80, ct);
            }
        }
    }
}
