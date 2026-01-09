using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using static XocDiaTuLinhZoWin.Tasks.TaskUtil;

namespace XocDiaTuLinhZoWin.Tasks
{
    public sealed class JackpotMultiSideTask : IBetTask
    {
        public string DisplayName => "17) Đánh các cửa ăn nổ hũ";
        public string Id => "jackpot-multi-side";

        private static async Task<char> WaitForResultAsync(GameContext ctx, string baseSeq, CancellationToken ct)
        {
            while (true)
            {
                ct.ThrowIfCancellationRequested();
                var curSeq = ctx.GetSnap?.Invoke()?.seq ?? "";
                if (!string.Equals(curSeq, baseSeq, StringComparison.Ordinal))
                {
                    if (!string.IsNullOrEmpty(curSeq))
                        return curSeq[^1];
                }
                await Task.Delay(120, ct);
            }
        }

        private static double CalcProfit(string side, long stake)
        {
            switch (side.ToUpperInvariant())
            {
                case "CHAN":
                case "LE":
                    return stake * 0.98;
                case "SAP_DOI":
                case "SAPDOI":
                case "2DO2TRANG":
                    // SAP_DOI: nếu đặt mức A thì tiền thắng nhận được = A * 1.617
                    // Dùng decimal để ra đúng hệ số 1.617, rồi trả về double cho delta
                    return (double)((decimal)stake * 1617m / 1000m);
                case "TRANG3_DO1":
                case "DO3_TRANG1":
                    return stake * 3 * 0.97;
                case "TU_TRANG":
                case "TU_DO":
                    return stake * 15 * 0.96;
                default:
                    return 0;
            }
        }

        public async Task RunAsync(GameContext ctx, CancellationToken ct)
        {
            if (!SideRateParser.TryParse(ctx.SideRateText ?? SideRateParser.DefaultText, out var plan, out var err))
                throw new InvalidOperationException("Cửa đặt & tỉ lệ không hợp lệ: " + err);

            var money = new MoneyManager(ctx.StakeSeq, ctx.MoneyStrategyId);

            while (true)
            {
                ct.ThrowIfCancellationRequested();
                await WaitUntilNewRoundStart(ctx, ct);
                // tắt chờ waitForTotalsChange để đặt nhanh nhiều cửa
                try { _ = ctx.EvalJsAsync("window.waitForTotalsChange = null;"); } catch { }

                var snap = ctx.GetSnap();
                string baseSeq = snap?.seq ?? string.Empty;

                // mở sẵn bảng chip để giảm thời gian cho nhiều lệnh liên tiếp
                try { _ = ctx.EvalJsAsync("window.tryOpenChipPanel && window.tryOpenChipPanel();"); } catch { }

                long baseStake = ctx.MoneyStrategyId == "MultiChain"
                    ? MoneyHelper.CalcAmountMultiChain(
                        ctx.StakeChains,
                        ctx.MoneyChainIndex,
                        ctx.MoneyChainStep)
                    : money.GetStakeForThisBet();
                if (baseStake < 0) baseStake = 0;

                var placed = new List<(string side, long stake)>(plan.Count);
                var successes = new List<(string side, long stake)>();
                placed.Clear();

                async Task<bool> PlaceWithRetry(string side, long stake)
                {
                    if (stake <= 0)
                    {
                        // vẫn gửi xuống JS với tiền 0 để giữ đủ 7 cửa
                        try { await PlaceBet(ctx, side, stake, ct, ignoreCooldown: true); } catch { }
                        return true;
                    }

                    try { _ = ctx.EvalJsAsync("window.tryOpenChipPanel && window.tryOpenChipPanel();"); } catch { }
                    await Task.Delay(180, ct);
                    try { await PlaceBet(ctx, side, stake, ct, ignoreCooldown: true); } catch { return false; }
                    return true;
                }

                foreach (var p in plan)
                {
                    long stake = baseStake * p.Ratio;
                    ctx.UiSetChainLevel?.Invoke(ctx.MoneyChainIndex, ctx.MoneyChainStep);
                    bool ok = await PlaceWithRetry(p.Side, stake);
                    if (ok)
                    {
                        successes.Add((p.Side, stake));
                        placed.Add((p.Side, stake));
                    }
                    else
                    {
                        ctx.Log?.Invoke($"[Task17] FAIL {p.Side} stake={stake}");
                    }
                    await Task.Delay(220, ct);
                }

                ctx.Log?.Invoke($"[Task17] Đã đặt {successes.Count}/{plan.Count} cửa; còn lại: {Math.Max(0, plan.Count - successes.Count)}");

                var lastDigit = await WaitForResultAsync(ctx, baseSeq, ct);
                var winners = SideRateParser.GetWinningSides(lastDigit);
                // hiển thị kết quả dạng ball0..ball4 cho lịch sử
                string resultDisplay = $"BALL{lastDigit}";

                bool winAny = false;
                double delta = 0;
                foreach (var (side, stake) in placed)
                {
                    if (winners.Contains(side))
                    {
                        winAny = true;
                        delta += CalcProfit(side, stake);
                        ctx.Log?.Invoke($"[Task17][WIN] {side} +{CalcProfit(side, stake):N0}");
                    }
                    else
                    {
                        delta -= stake;
                        ctx.Log?.Invoke($"[Task17][LOSS] {side} -{stake:N0}");
                    }
                }

                await ctx.UiDispatcher.InvokeAsync(() => ctx.UiAddWin?.Invoke(delta));
                // cập nhật lịch sử cho từng cửa
                await ctx.UiDispatcher.InvokeAsync(() => ctx.UiFinalizeMultiBet?.Invoke(winners, resultDisplay));
                // Chỉ hiển thị WIN/LOSS tổng hợp một lần cho cả vòng
                await ctx.UiDispatcher.InvokeAsync(() => ctx.UiWinLoss?.Invoke(winAny));

                if (ctx.MoneyStrategyId == "MultiChain")
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
                        winAny);

                    ctx.MoneyChainIndex = chainIndex;
                    ctx.MoneyChainStep = chainStep;
                    ctx.MoneyChainProfit = chainProfit;
                }
                else
                {
                    money.OnRoundResult(winAny);
                }
            }
        }
    }
}
