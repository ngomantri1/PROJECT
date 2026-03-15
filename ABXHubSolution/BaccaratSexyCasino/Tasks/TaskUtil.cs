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

        // Khóa chống gửi lặp: sau khi đã gửi 1 lệnh, chặn gửi tiếp trong một cửa sổ an toàn
        private static readonly ConcurrentDictionary<string, long> _lastBetOkMsByTab = new();
        private static readonly ConcurrentDictionary<string, int> _lastBetRoundByTab = new();
        private static readonly ConcurrentDictionary<string, string> _lastBetSideByTab = new();
        private static readonly ConcurrentDictionary<string, string> _lastAcceptedRawSeqByTab = new();
        private static readonly ConcurrentDictionary<string, string> _lastAcceptedTotalsMarkerByTab = new();
        private static readonly ConcurrentDictionary<string, byte> _betInFlightByTab = new();
        private const long SendOnlyCooldownMs = 3000;

        // (tuỳ chọn) reset khi dừng task
        public static void ClearBetCooldown()
        {
            _lastBetOkMsByTab.Clear();
            _lastBetRoundByTab.Clear();
            _lastBetSideByTab.Clear();
            _lastAcceptedRawSeqByTab.Clear();
            _lastAcceptedTotalsMarkerByTab.Clear();
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

        private static string BuildTotalsMarker(CwSnapshot? snap)
        {
            var t = snap?.totals;
            var b = t?.B ?? 0;
            var p = t?.P ?? 0;
            var tie = t?.T ?? 0;
            return $"{b}|{p}|{tie}";
        }

        private static (long B, long P, long T) ReadTotals(CwSnapshot? snap)
        {
            var t = snap?.totals;
            return (t?.B ?? 0, t?.P ?? 0, t?.T ?? 0);
        }

        private static (long B, long P, long T) ParseTotalsMarker(string? marker)
        {
            if (string.IsNullOrWhiteSpace(marker)) return (0, 0, 0);
            var parts = marker.Split('|');
            if (parts.Length != 3) return (0, 0, 0);
            long.TryParse(parts[0], out var b);
            long.TryParse(parts[1], out var p);
            long.TryParse(parts[2], out var t);
            return (b, p, t);
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
                double p = s?.prog ?? 1.0;
                if (p >= ctx.DecisionPercent) break;
                await Task.Delay(80, ct);
            }
        }


        public static async Task<bool> PlaceBet(GameContext ctx, string side, long amount, CancellationToken ct, bool ignoreCooldown = false)
        {
            var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            var tabKey = string.IsNullOrWhiteSpace(ctx?.TabId) ? "_default" : ctx.TabId;

            var playableSnap = ctx.GetSnap?.Invoke();
            var snap = ctx.GetRawSnap?.Invoke() ?? playableSnap;
            var rawSeq = snap?.seq ?? "";
            var totalsMarker = BuildTotalsMarker(snap);
            var roundId = 0;
            try { roundId = (snap?.seq ?? "").Length; } catch { roundId = 0; }

            var last = _lastBetOkMsByTab.TryGetValue(tabKey, out var v) ? v : 0;
            var lastRound = _lastBetRoundByTab.TryGetValue(tabKey, out var r) ? r : -1;
            var lastSide = _lastBetSideByTab.TryGetValue(tabKey, out var s) ? s : "";
            var sameRound = lastRound == roundId && roundId > 0;
            var sameSide = string.Equals(lastSide, side, StringComparison.OrdinalIgnoreCase);
            if (!ignoreCooldown)
            {
                if (_betInFlightByTab.ContainsKey(tabKey))
                {
                    ctx.Log?.Invoke($"[BET][BLOCK] pending settle | tab={tabKey} | side={side} | amount={amount:N0}");
                    return false;
                }

                if (sameRound && sameSide && now - last < SendOnlyCooldownMs)
                {
                    ctx.Log?.Invoke($"[BET][BLOCK] skip duplicate send | tab={tabKey} | side={side} | amount={amount:N0}");
                    return false;
                }
            }

            // Optimistic mode: chỉ cần đẩy intent xuống JS là coi như thành công.
            var js =
                "(function(){try{" +
                " var intent = { tabId: '" + tabKey + "', roundId: " + roundId + ", side: '" + side + "', amount: " + amount + " };" +
                " if (typeof window.__cw_bet_enqueue==='function'){" +
                "   window.__cw_bet_enqueue(intent); return 'sent';" +
                " } else if (typeof window.__cw_bet==='function'){" +
                "   window.__cw_bet('" + side + "', " + amount + "); return 'sent';" +
                " } else { return 'no'; }" +
                "}catch(e){ return 'err:' + (e && e.message ? e.message : e); }})()";

            var rRaw = await ctx.EvalJsAsync(js);
            ctx.Log?.Invoke($"[BET-JS] tab={tabKey} round={roundId} result={rRaw}");

            var normalized = (rRaw ?? "").Trim();
            if (!string.IsNullOrWhiteSpace(normalized))
                normalized = normalized.Trim().Trim('"');
            bool ok =
                !string.Equals(normalized, "no", StringComparison.OrdinalIgnoreCase) &&
                !(normalized.StartsWith("err:", StringComparison.OrdinalIgnoreCase));

            if (ok)
            {
                if (ctx.UiRecordBetIssued != null)
                {
                    await ctx.UiDispatcher.InvokeAsync(() =>
                    {
                        ctx.UiRecordBetIssued?.Invoke(side, amount, roundId);
                    });
                }
                else
                {
                    await ctx.UiDispatcher.InvokeAsync(() =>
                    {
                        ctx.UiSetSide?.Invoke(side);
                        ctx.UiSetStake?.Invoke(amount);
                    });
                }
                _lastBetOkMsByTab[tabKey] = now;
                _lastBetRoundByTab[tabKey] = roundId;
                _lastBetSideByTab[tabKey] = side ?? "";
                _lastAcceptedRawSeqByTab[tabKey] = rawSeq;
                _lastAcceptedTotalsMarkerByTab[tabKey] = totalsMarker;
                _betInFlightByTab[tabKey] = 1;
            }
            else
            {
                _lastAcceptedRawSeqByTab.TryRemove(tabKey, out _);
                _lastAcceptedTotalsMarkerByTab.TryRemove(tabKey, out _);
                _betInFlightByTab.TryRemove(tabKey, out _);
            }

            return ok;
        }
        public static async Task<bool?> WaitRoundFinishAndJudge(GameContext ctx, string betSide, string baseSeq, CancellationToken ct)
        {
            var tabKey = string.IsNullOrWhiteSpace(ctx?.TabId) ? "_default" : ctx.TabId;
            if (!_lastAcceptedTotalsMarkerByTab.TryGetValue(tabKey, out var waitTotalsMarker) ||
                string.IsNullOrWhiteSpace(waitTotalsMarker))
            {
                ctx.Log?.Invoke($"[BET][SKIP] no accepted totals marker for settle | tab={tabKey}");
                _betInFlightByTab.TryRemove(tabKey, out _);
                return null;
            }

            var waitTotals = ParseTotalsMarker(waitTotalsMarker);

            // Chờ totals B/P/T đổi so với mốc đã chụp tại thời điểm PlaceBet.
            while (true)
            {
                ct.ThrowIfCancellationRequested();
                var s = ctx.GetRawSnap?.Invoke() ?? ctx.GetSnap?.Invoke();
                var curTotalsMarker = BuildTotalsMarker(s);
                if (!string.Equals(curTotalsMarker, waitTotalsMarker, StringComparison.Ordinal))
                {
                    var curTotals = ReadTotals(s);
                    var curSeqRaw = s?.seq ?? string.Empty;
                    var curTailRaw = curSeqRaw.Length > 0
                        ? char.ToUpperInvariant(curSeqRaw[^1])
                        : '\0';
                    bool? win;

                    // Ưu tiên raw tail 'T' để đồng bộ với luồng finalize/history.
                    // Một số tick có thể lệch tạm thời giữa seq và totals; nếu seq đã báo TIE
                    // thì không được chấm thành thắng/thua chỉ vì totals B/P cập nhật sớm hơn.
                    if (curTailRaw == 'T')
                    {
                        win = null;
                    }
                    else if (curTotals.T > waitTotals.T)
                    {
                        win = null;
                    }
                    else if (curTotals.B > waitTotals.B)
                    {
                        win = string.Equals(betSide, "BANKER", StringComparison.OrdinalIgnoreCase);
                    }
                    else if (curTotals.P > waitTotals.P)
                    {
                        win = string.Equals(betSide, "PLAYER", StringComparison.OrdinalIgnoreCase);
                    }
                    else
                    {
                        var curSeq = curSeqRaw;
                        if (curSeq.Length == 0)
                        {
                            await Task.Delay(120, ct);
                            continue;
                        }
                        win = IsWin(betSide, curSeq[^1]);
                    }

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
                    _lastAcceptedRawSeqByTab.TryRemove(tabKey, out _);
                    _lastAcceptedTotalsMarkerByTab.TryRemove(tabKey, out _);
                    _betInFlightByTab.TryRemove(tabKey, out _);
                    // cộng tiền lũy kế: +amount khi thắng, -amount khi thua (đơn giản)
                    //TaskUtil.UiRoundAllowNextReset();
                    return win;
                }
                await Task.Delay(120, ct);
            }
        }
    }
}


