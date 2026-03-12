using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using static TaiXiuLiveHit.Tasks.TaskUtil;

namespace TaiXiuLiveHit.Tasks
{
    public sealed class JackpotMultiSideTask : IBetTask
    {
        public string DisplayName => "17) Danh cac cua an no hu";
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
                case "TAI":
                case "XIU":
                    return stake * 0.98;
                default:
                    return 0;
            }
        }

        public async Task RunAsync(GameContext ctx, CancellationToken ct)
        {
            if (!SideRateParser.TryParse(ctx.SideRateText ?? SideRateParser.DefaultText, out var plan, out var err))
                throw new InvalidOperationException("Cua dat & ti le khong hop le: " + err);

            var money = new MoneyManager(ctx.StakeSeq, ctx.MoneyStrategyId);

            while (true)
            {
                ct.ThrowIfCancellationRequested();
                await WaitUntilNewRoundStart(ctx, ct);

                var snap = ctx.GetSnap();
                string baseSeq = snap?.seq ?? string.Empty;

                long baseStake = ctx.MoneyStrategyId == "MultiChain"
                    ? MoneyHelper.CalcAmountMultiChain(
                        ctx.StakeChains,
                        ctx.MoneyChainIndex,
                        ctx.MoneyChainStep)
                    : money.GetStakeForThisBet();
                if (baseStake < 0) baseStake = 0;

                var placed = new List<(string side, long stake)>(plan.Count);

                async Task<bool> PlaceWithRetry(string side, long stake)
                {
                    if (stake <= 0) return false;

                    try
                    {
                        return await PlaceBet(ctx, side, stake, ct, ignoreCooldown: true);
                    }
                    catch
                    {
                        return false;
                    }
                }

                foreach (var p in plan)
                {
                    long stake = baseStake * p.Ratio;
                    ctx.UiSetChainLevel?.Invoke(ctx.MoneyChainIndex, ctx.MoneyChainStep);
                    bool ok = await PlaceWithRetry(p.Side, stake);
                    if (ok)
                    {
                        placed.Add((p.Side, stake));
                    }
                    else
                    {
                        ctx.Log?.Invoke($"[Task17] FAIL {p.Side} stake={stake}");
                    }

                    await Task.Delay(220, ct);
                }

                ctx.Log?.Invoke($"[Task17] Da dat {placed.Count}/{plan.Count} cua");

                var resultChar = await WaitForResultAsync(ctx, baseSeq, ct);
                var winners = SideRateParser.GetWinningSides(resultChar);
                string resultDisplay = resultChar switch
                {
                    'T' => "TAI",
                    'X' => "XIU",
                    _ => resultChar.ToString()
                };

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
                await ctx.UiDispatcher.InvokeAsync(() => ctx.UiFinalizeMultiBet?.Invoke(winners, resultDisplay));
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
