using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using static XocDiaLiveHit.Tasks.TaskUtil;

namespace XocDiaLiveHit.Tasks
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
                case "SAP_DOI":
                    return stake * 0.98;
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

                    for (int attempt = 0; attempt < 8; attempt++)
                    {
                        try
                        {
                            _ = ctx.EvalJsAsync("if(window.__cwBetLockFix){window.__cwBetLockFix.busy=false;} window.tryOpenChipPanel && window.tryOpenChipPanel();");
                        }
                        catch { }
                        await Task.Delay(80, ct);

                        bool ok = await PlaceBet(ctx, side, stake, ct, ignoreCooldown: true);
                        if (ok) return true;

                        await Task.Delay(260 + attempt * 60, ct);
                    }
                    return false;
                }

                foreach (var p in plan)
                {
                    long stake = baseStake * p.Ratio;
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

                bool winAny = false;
                double delta = 0;
                foreach (var (side, stake) in placed)
                {
                    if (winners.Contains(side))
                    {
                        winAny = true;
                        delta += CalcProfit(side, stake);
                    }
                    else
                    {
                        delta -= stake;
                    }
                }

                await ctx.UiDispatcher.InvokeAsync(() => ctx.UiAddWin?.Invoke(delta));
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
