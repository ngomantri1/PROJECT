using System;
using System.Threading;
using System.Threading.Tasks;
using System.Collections.Concurrent;
using System.Windows.Input;
using System.Windows.Threading;
using System.Linq;
using System.Windows;
using System.Windows.Controls;

namespace XocDiaB52.Tasks
{
    internal static class TaskUtil
    {
        // Khóa chống bắn đúp: 3s kể từ lần place bet THÀNH CÔNG gần nhất
        private static readonly ConcurrentDictionary<string, long> _lastBetOkMsByTab = new();
        private static readonly ConcurrentDictionary<string, int> _lastBetRoundByTab = new();
        private static readonly ConcurrentDictionary<string, string> _lastBetSideByTab = new();

        // (tuỳ chọn) reset khi dừng task
        public static void ClearBetCooldown()
        {
            _lastBetOkMsByTab.Clear();
            _lastBetRoundByTab.Clear();
            _lastBetSideByTab.Clear();
        }

        public static char NormalizeParityChar(char ch)
        {
            ch = char.ToUpperInvariant(ch);
            if (ch == 'C' || ch == 'B') return 'C';
            if (ch == 'L' || ch == 'P') return 'L';
            return '\0';
        }

        public static string ParityCharToSide(char ch)
        {
            var p = NormalizeParityChar(ch);
            if (p == 'C') return "CHAN";
            if (p == 'L') return "LE";
            return string.Empty;
        }
        public static char DigitToParity(char d)
        {
            d = char.ToUpperInvariant(d);
            if (d == '0' || d == '2' || d == '4') return 'C';
            if (d == '1' || d == '3') return 'L';
            return NormalizeParityChar(d) == 'C' ? 'C' : 'L';
        }

        public static string DisplayResultChar(char ch)
        {
            var parity = NormalizeParityChar(ch);
            return parity == 'C' ? "B" : (parity == 'L' ? "P" : "");
        }

        public static string DisplayResultName(char ch)
        {
            var parity = NormalizeParityChar(ch);
            return parity == 'C' ? "BANKER" : (parity == 'L' ? "PLAYER" : "");
        }
        // TaskUtil.cs (trong class TaskUtil)
        private static readonly object _betLock = new object();
        private static string _lastBetSeq = "";
        private static long _lastBetMs = 0;
        // Reset UI 1 lần ngay khi vào cửa sổ đặt
        private static bool _uiRoundResetDone = false;
        public static string SeqToParityString(string digitSeq)
        {
            if (string.IsNullOrEmpty(digitSeq)) return "";
            char[] a = new char[digitSeq.Length];
            int k = 0;
            for (int i = 0; i < digitSeq.Length; i++)
            {
                var p = NormalizeParityChar(digitSeq[i]);
                if (p == 'C' || p == 'L') a[k++] = p;
            }
            return new string(a, 0, k);
        }

        public static bool IsWin(string betSide, char lastDigit)
        {
            var lastSide = ParityCharToSide(lastDigit);
            return string.Equals(betSide, lastSide, StringComparison.OrdinalIgnoreCase);
        }

        public static bool TryGetSeqAdvance(string? baseSeq, string? currentSeq, out char lastDigit)
        {
            baseSeq ??= string.Empty;
            currentSeq ??= string.Empty;
            lastDigit = '\0';

            if (currentSeq.Length <= baseSeq.Length)
                return false;
            if (!currentSeq.StartsWith(baseSeq, StringComparison.Ordinal))
                return false;

            lastDigit = currentSeq[^1];
            return lastDigit != '\0';
        }

        public static bool IsSeqResetOrRebuilt(string? baseSeq, string? currentSeq)
        {
            baseSeq ??= string.Empty;
            currentSeq ??= string.Empty;

            if (string.IsNullOrEmpty(baseSeq))
                return false;
            if (string.Equals(baseSeq, currentSeq, StringComparison.Ordinal))
                return false;
            if (currentSeq.Length < baseSeq.Length)
                return true;

            return !currentSeq.StartsWith(baseSeq, StringComparison.Ordinal);
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




        // Gọi khi đã có số giây còn lại để reset đúng 1 lần
        public static void UiRoundMaybeReset(double remainingSeconds, double decisionSeconds)
        {
            if (_uiRoundResetDone) return;
            if (remainingSeconds <= decisionSeconds && remainingSeconds > 0)
            {
                _uiRoundResetDone = true;
                UiResetRoundControls();
            }
        }

        // Gọi khi kết thúc ván (đã chấm THẮNG/THUA) để ván sau reset tiếp
        public static void UiRoundAllowNextReset() => _uiRoundResetDone = false;

        public static async Task WaitUntilBetWindow(GameContext ctx, CancellationToken ct)
        {
            // Quy ước: snap.prog = số giây còn lại của cửa đặt cược.
            while (true)
            {
                ct.ThrowIfCancellationRequested();
                var s = ctx.GetSnap?.Invoke();
                double remainingSeconds = s?.prog ?? -1;
                if (remainingSeconds <= ctx.DecisionSeconds && remainingSeconds > 0)
                    break;
                await Task.Delay(120, ct);
            }
        }

        // Chờ sang phiên mới rồi chỉ vào lệnh khi countdown chạm ngưỡng DecisionSeconds.
        public static async Task WaitUntilNewRoundStart(GameContext ctx, CancellationToken ct)
        {
            var firstSnap = ctx.GetSnap?.Invoke();
            var baseSession = firstSnap?.session ?? "";
            double lastSeconds = firstSnap?.prog ?? -1;
            bool roundChanged = string.IsNullOrWhiteSpace(baseSession);

            while (true)
            {
                ct.ThrowIfCancellationRequested();
                var s = ctx.GetSnap?.Invoke();
                if (s == null)
                {
                    await Task.Delay(120, ct);
                    continue;
                }

                var session = s.session ?? "";
                var remainingSeconds = s.prog ?? -1;

                if (!roundChanged)
                {
                    if (!string.IsNullOrWhiteSpace(baseSession) &&
                        !string.Equals(session, baseSession, StringComparison.Ordinal))
                    {
                        roundChanged = true;
                    }
                    else if (remainingSeconds >= 0 && lastSeconds >= 0 && remainingSeconds > lastSeconds + 1.5)
                    {
                        // Fallback khi session chưa đổi nhưng countdown đã reset lên đầu ván mới.
                        roundChanged = true;
                    }
                }

                if (roundChanged && remainingSeconds <= ctx.DecisionSeconds && remainingSeconds > 0)
                    break;

                if (remainingSeconds >= 0)
                    lastSeconds = remainingSeconds;

                await Task.Delay(120, ct);
            }
        }


        public static async Task<bool> PlaceBet(GameContext ctx, string side, long amount, CancellationToken ct, bool ignoreCooldown = false)
        {
            var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            var tabKey = string.IsNullOrWhiteSpace(ctx?.TabId) ? "_default" : ctx.TabId;

            // C?p nh?t UI ch? khi th?c s? du?c ph?p b?n
            await ctx.UiDispatcher.InvokeAsync(() => ctx.UiSetSide?.Invoke(side));
            await ctx.UiDispatcher.InvokeAsync(() => ctx.UiSetStake?.Invoke(amount));

            var snap = ctx.GetSnap?.Invoke();
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
                    ctx.Log?.Invoke($"[BET] cooldown 3s active, skip ({3000 - (now - last)}ms left)");
                    return false;
                }
            }

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

            var rRaw = await ctx.EvalJsAsync(js);
            ctx.Log?.Invoke($"[BET-JS] tab={tabKey} round={roundId} result={rRaw}");

            // Kh?ng ki?m tra th?nh c?ng/th?t b?i d? tr?nh b?n l?p; ch? d?y l?nh m?t l?n
            bool ok = true;

            if (ok)
            {
                _lastBetOkMsByTab[tabKey] = now; // k?ch ho?t kh?a 3s
                _lastBetRoundByTab[tabKey] = roundId;
                _lastBetSideByTab[tabKey] = side ?? "";
            }

            return ok;
        }
        public static async Task<bool> WaitRoundFinishAndJudge(GameContext ctx, string betSide, string baseSeq, CancellationToken ct)
        {
            // Chỉ chốt khi chuỗi thực sự được append thêm kết quả mới.
            while (true)
            {
                ct.ThrowIfCancellationRequested();
                var s = ctx.GetSnap?.Invoke();
                var curSeq = s?.seq ?? "";
                if (TryGetSeqAdvance(baseSeq, curSeq, out var lastDigit))
                {
                    bool win = IsWin(betSide, lastDigit);
                    await ctx.UiDispatcher.InvokeAsync(() => ctx.UiWinLoss?.Invoke(win));
                    return win;
                }

                if (IsSeqResetOrRebuilt(baseSeq, curSeq))
                {
                    ctx.Log?.Invoke($"[SEQ] reset/rebuild detected while waiting result: baseLen={baseSeq.Length}, curLen={curSeq.Length}");
                    baseSeq = curSeq;
                }

                await Task.Delay(120, ct);
            }
        }
    }
}
