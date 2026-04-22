using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using static TaiXiuLiveSun.Tasks.TaskUtil;

namespace TaiXiuLiveSun.Tasks
{
    public sealed class JackpotMultiSideTask : IBetTask
    {
        public string DisplayName => "17) ÄÃ¡nh cÃ¡c cá»­a Äƒn ná»• hÅ©";
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
                throw new InvalidOperationException("Cá»­a Ä‘áº·t & tá»‰ lá»‡ khÃ´ng há»£p lá»‡: " + err);

            var money = new MoneyManager(ctx.StakeSeq, ctx.MoneyStrategyId);

            while (true)
            {
                ct.ThrowIfCancellationRequested();
                await WaitUntilNewRoundStart(ctx, ct);
                // táº¯t chá» waitForTotalsChange Ä‘á»ƒ Ä‘áº·t nhanh nhiá»u cá»­a
                try { _ = ctx.EvalJsAsync("window.waitForTotalsChange = null;"); } catch { }

                var snap = ctx.GetSnap();
                string baseSeq = snap?.seq ?? string.Empty;

                // má»Ÿ sáºµn báº£ng chip Ä‘á»ƒ giáº£m thá»i gian cho nhiá»u lá»‡nh liÃªn tiáº¿p
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
                        // váº«n gá»­i xuá»‘ng JS vá»›i tiá»n 0 Ä‘á»ƒ giá»¯ Ä‘á»§ 7 cá»­a
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

                ctx.Log?.Invoke($"[Task17] ÄÃ£ Ä‘áº·t {successes.Count}/{plan.Count} cá»­a; cÃ²n láº¡i: {Math.Max(0, plan.Count - successes.Count)}");

                var lastDigit = await WaitForResultAsync(ctx, baseSeq, ct);
                var winners = SideRateParser.GetWinningSides(lastDigit);
                // hiá»ƒn thá»‹ káº¿t quáº£ dáº¡ng ball0..ball4 cho lá»‹ch sá»­
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

                // cáº­p nháº­t lá»‹ch sá»­ cho tá»«ng cá»­a
                await ctx.UiDispatcher.InvokeAsync(() => ctx.UiFinalizeMultiBet?.Invoke(winners, resultDisplay));
                // Chá»‰ hiá»ƒn thá»‹ WIN/LOSS tá»•ng há»£p má»™t láº§n cho cáº£ vÃ²ng
                await ctx.UiDispatcher.InvokeAsync(() => ctx.UiWinLoss?.Invoke(winAny));

                await TaskUtil.ApplyMoneyAfterRoundAsync(ctx, money, winAny, delta);
            }
        }
    }
}

