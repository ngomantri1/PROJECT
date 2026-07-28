using System;
using System.Threading;
using System.Threading.Tasks;
using System.Collections.Concurrent;
using System.Windows.Input;
using System.Windows.Threading;
using System.Linq;
using System.Windows;
using System.Windows.Controls;

namespace BaccaratSexyCasino2.Tasks
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
        // Chuỗi tại thời điểm gửi lệnh, lấy nguyên từ snapshot legacy Chrome.
        private static readonly ConcurrentDictionary<string, string> _lastAcceptedLegacySeqByTab = new();
        private static readonly ConcurrentDictionary<string, byte> _betInFlightByTab = new();
        private static readonly ConcurrentDictionary<string, int> _lastAttemptRoundByTab = new();
        private static readonly ConcurrentDictionary<string, string> _lastAttemptSideByTab = new();
        private static readonly ConcurrentDictionary<string, int> _attemptCountByTab = new();
        private static readonly ConcurrentDictionary<string, long> _firstAttemptMsByTab = new();
        private static readonly ConcurrentDictionary<string, long> _lastAttemptMsByTab = new();
        private static readonly ConcurrentDictionary<string, long> _firstAttemptAmountByTab = new();
        private const long SendOnlyCooldownMs = 3000;
        private const int BetSendTimeoutMs = 2500;

        // (tuỳ chọn) reset khi dừng task
        public static void ClearBetCooldown()
        {
            _lastBetOkMsByTab.Clear();
            _lastBetRoundByTab.Clear();
            _lastBetSideByTab.Clear();
            _lastAcceptedLegacySeqByTab.Clear();
            _betInFlightByTab.Clear();
            _lastAttemptRoundByTab.Clear();
            _lastAttemptSideByTab.Clear();
            _attemptCountByTab.Clear();
            _firstAttemptMsByTab.Clear();
            _lastAttemptMsByTab.Clear();
            _firstAttemptAmountByTab.Clear();
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
            // Quy ước: prog là số GIÂY còn lại (UI hiển thị dạng "Xs").
            // Chỉ cho phép đặt cược khi thời gian còn lại <= ngưỡng giây cấu hình.
            while (true)
            {
                ct.ThrowIfCancellationRequested();
                var s = ctx.GetSnap?.Invoke();
                double p = s?.prog ?? double.NaN;
                if (double.IsNaN(p) || double.IsInfinity(p))
                {
                    await Task.Delay(80, ct);
                    continue;
                }
                //TaskUtil.UiRoundMaybeReset(p, ctx.DecisionPercent);
                if (p <= ctx.DecisionPercent && p > 0) break;
                await Task.Delay(80, ct);
            }
        }

        // Với logic GIÂY còn lại: điều kiện cho phép đặt giống WaitUntilBetWindow.
        public static async Task WaitUntilNewRoundStart(GameContext ctx, CancellationToken ct)
        {
            while (true)
            {
                ct.ThrowIfCancellationRequested();
                var s = ctx.GetSnap?.Invoke();
                double p = s?.prog ?? double.NaN;
                if (double.IsNaN(p) || double.IsInfinity(p))
                {
                    await Task.Delay(80, ct);
                    continue;
                }
                if (p <= ctx.DecisionPercent && p > 0) break;
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

            // Chrome mode chỉ dùng snapshot legacy đã được JS game đồng bộ chuẩn.
            // Không đọc, không fallback và không trộn với raw/network snapshot.
            var snap = ctx.GetSnap?.Invoke();
            var rawSeq = snap?.seq ?? "";
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

            var duplicateAttemptDetected = false;
            var duplicateAttemptNo = 1;
            var duplicateFirstAmount = amount;
            var duplicateFirstAgoMs = 0L;
            var duplicateSincePrevMs = 0L;
            lock (_betLock)
            {
                var prevRound = _lastAttemptRoundByTab.TryGetValue(tabKey, out var ar) ? ar : -1;
                var prevSide = _lastAttemptSideByTab.TryGetValue(tabKey, out var aside) ? aside : "";
                var sameAttemptContext = prevRound == roundId &&
                                         string.Equals(prevSide, side, StringComparison.OrdinalIgnoreCase);

                if (sameAttemptContext)
                {
                    var prevCount = _attemptCountByTab.TryGetValue(tabKey, out var c) ? c : 1;
                    var prevLastMs = _lastAttemptMsByTab.TryGetValue(tabKey, out var lm) ? lm : now;
                    var firstMs = _firstAttemptMsByTab.TryGetValue(tabKey, out var fm) ? fm : now;
                    var firstAmount = _firstAttemptAmountByTab.TryGetValue(tabKey, out var fa) ? fa : amount;

                    duplicateAttemptNo = prevCount + 1;
                    duplicateFirstAmount = firstAmount;
                    duplicateSincePrevMs = Math.Max(0, now - prevLastMs);
                    duplicateFirstAgoMs = Math.Max(0, now - firstMs);
                    duplicateAttemptDetected = duplicateAttemptNo > 1;

                    _attemptCountByTab[tabKey] = duplicateAttemptNo;
                }
                else
                {
                    _lastAttemptRoundByTab[tabKey] = roundId;
                    _lastAttemptSideByTab[tabKey] = side ?? "";
                    _attemptCountByTab[tabKey] = 1;
                    _firstAttemptMsByTab[tabKey] = now;
                    _firstAttemptAmountByTab[tabKey] = amount;
                }

                _lastAttemptMsByTab[tabKey] = now;
            }
            if (duplicateAttemptDetected)
            {
                var inFlight = _betInFlightByTab.ContainsKey(tabKey) ? 1 : 0;
                ctx.Log?.Invoke(
                    $"[BET-DUPE][WARN] same-round duplicate-detected | tab={tabKey}{runTag} | round={roundId} | side={side} | amount={amount:N0} | attempt={duplicateAttemptNo} | firstAmount={duplicateFirstAmount:N0} | firstAgoMs={duplicateFirstAgoMs} | sincePrevMs={duplicateSincePrevMs} | ignoreCooldown={ignoreCooldown} | inFlight={inFlight}");
            }

            var last = _lastBetOkMsByTab.TryGetValue(tabKey, out var v) ? v : 0;
            var lastRound = _lastBetRoundByTab.TryGetValue(tabKey, out var r) ? r : -1;
            var lastSide = _lastBetSideByTab.TryGetValue(tabKey, out var s) ? s : "";
            var sameRound = lastRound == roundId;
            var sameSide = string.Equals(lastSide, side, StringComparison.OrdinalIgnoreCase);
            if (!ignoreCooldown && sameRound && sameSide && now - last < SendOnlyCooldownMs)
            {
                ctx.Log?.Invoke($"[BET][INFO] duplicate-send-allowed | tab={tabKey}{runTag} | round={roundId} | side={side} | amount={amount:N0}");
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

            // WebView2 cũ coi một lệnh đã giao cho JavaScript là một cược đã gửi.
            // Chrome bridge giữ đúng quy ước đó: "queued" chỉ xác nhận lệnh đã
            // được ghi xuống Native Host để chuyển vào JS; kết quả confirm muộn từ
            // trang game chỉ là chẩn đoán, không được đảo ngược vòng cược C#.
            var usesChromeBridge = ctx.SendChromeBetAsync is not null;
            string rRaw = "";
            var sendAt = DateTime.UtcNow;
            try
            {
                var evalTask = usesChromeBridge
                    ? ctx.SendChromeBetAsync(side, amount, roundId, ct)
                    : ctx.EvalJsAsync(js);
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
            // Nhánh Chrome tuyệt đối không chờ/diễn giải kết quả xác nhận từ game.
            // Việc ghi thành công command place_bet vào pipe là mốc "đã gửi" giống
            // lúc WebView2 cũ gọi __cw_bet_enqueue. Chỉ lỗi transport mới là lỗi gửi.
            bool ok = usesChromeBridge
                ? !string.IsNullOrWhiteSpace(resultNorm) &&
                  !resultNorm.StartsWith("err:", StringComparison.OrdinalIgnoreCase)
                : !(string.IsNullOrWhiteSpace(resultNorm) ||
                    string.Equals(resultNorm, "no", StringComparison.OrdinalIgnoreCase) ||
                    resultNorm.StartsWith("err:", StringComparison.OrdinalIgnoreCase));
            var elapsedMs = (int)(DateTime.UtcNow - sendAt).TotalMilliseconds;
            ctx.Log?.Invoke($"[BET-JS] tab={tabKey}{runTag} round={roundId} result={rRaw}");
            if (ok)
            {
                ctx.Log?.Invoke($"[BET-SEND][OK] tab={tabKey}{runTag} | round={roundId} | side={side} | amount={amount:N0} | waitMs={elapsedMs}");
                if (usesChromeBridge)
                    ctx.Log?.Invoke($"[BET-SEND][LEGACY-OPTIMISTIC] tab={tabKey}{runTag} | round={roundId} | command=place_bet | state=sent-to-js");
            }
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
                _lastAcceptedLegacySeqByTab[tabKey] = rawSeq;
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
            if (!_lastAcceptedLegacySeqByTab.TryGetValue(tabKey, out var acceptedLegacySeq))
            {
                ctx.Log?.Invoke($"[BET][SKIP] no accepted legacy seq for settle | tab={tabKey}");
                _betInFlightByTab.TryRemove(tabKey, out _);
                return null;
            }

            var waitSeq = acceptedLegacySeq ?? string.Empty;
            ctx.Log?.Invoke($"[BET][SETTLE][ARM] tab={tabKey} | source=chrome-legacy | seqLen={waitSeq.Length} | tail={(waitSeq.Length > 0 ? waitSeq[^1] : '-')}");

            // Baccarat settle chỉ theo chuỗi legacy Chrome, kể cả T.
            while (true)
            {
                ct.ThrowIfCancellationRequested();
                // Chỉ dùng snapshot legacy Chrome. Không fallback sang raw/network.
                var s = ctx.GetSnap?.Invoke();
                var curSeqRaw = s?.seq ?? string.Empty;
                if (!string.Equals(curSeqRaw, waitSeq, StringComparison.Ordinal) && curSeqRaw.Length > 0)
                {
                    var seqResultChar = char.ToUpperInvariant(curSeqRaw[^1]);
                    if (seqResultChar != 'B' && seqResultChar != 'P' && seqResultChar != 'T')
                    {
                        await Task.Delay(80, ct);
                        continue;
                    }

                    bool? win = IsWin(betSide, seqResultChar);

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
                    ctx.Log?.Invoke($"[BET][SETTLE][DONE] tab={tabKey} | source=chrome-legacy | prevLen={waitSeq.Length} | curLen={curSeqRaw.Length} | result={seqResultChar}");
                    _lastAcceptedLegacySeqByTab.TryRemove(tabKey, out _);
                    _betInFlightByTab.TryRemove(tabKey, out _);
                    // cộng tiền lũy kế: +amount khi thắng, -amount khi thua (đơn giản)
                    //TaskUtil.UiRoundAllowNextReset();
                    return win;
                }
                await Task.Delay(80, ct);
            }
        }
    }
}


