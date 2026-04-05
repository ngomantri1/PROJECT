using System.Threading;
using System.Threading.Tasks;
using static AviatorHit.Tasks.TaskUtil;

namespace AviatorHit.Tasks
{
    public sealed class AutoCashoutTask : IBetTask
    {
        public string DisplayName => "1) Chạy ăn hũ";
        public string Id => "aviator-auto-cashout";

        public async Task RunAsync(GameContext ctx, CancellationToken ct)
        {
            var money = new MoneyManager(ctx.StakeSeq, ctx.MoneyStrategyId);
            ctx.Log?.Invoke("Chiến lược: Chạy ăn hũ");

            while (true)
            {
                ct.ThrowIfCancellationRequested();

                await WaitUntilNewRoundStart(ctx, ct);

                var snap = ctx.GetSnap();
                var baseSeq = snap?.seq ?? string.Empty;

                var current = ResolveCurrentEntry(ctx, money);
                var stake = current.Stake > 0 ? current.Stake : 1000L;
                var target = current.Target > 1.0 ? current.Target : 1.01;

                await PlaceBet(ctx, stake, target, ct);

                var win = await WaitRoundFinishAndJudge(ctx, baseSeq, target, ct);
                await ctx.UiDispatcher.InvokeAsync(() => ctx.UiAddWin?.Invoke(win ? stake : -stake));

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
                        win);

                    ctx.MoneyChainIndex = chainIndex;
                    ctx.MoneyChainStep = chainStep;
                    ctx.MoneyChainProfit = chainProfit;
                }
                else
                {
                    money.OnRoundResult(win);
                }
            }
        }

        private static AviatorStakeEntry ResolveCurrentEntry(GameContext ctx, MoneyManager money)
        {
            if (ctx.MoneyStrategyId == "MultiChain")
            {
                var chains = ctx.StakeEntryChains;
                if (chains != null && chains.Length > 0)
                {
                    var chainIndex = ctx.MoneyChainIndex;
                    if (chainIndex < 0) chainIndex = 0;
                    if (chainIndex >= chains.Length) chainIndex = chains.Length - 1;

                    var chain = chains[chainIndex];
                    if (chain != null && chain.Length > 0)
                    {
                        var levelIndex = ctx.MoneyChainStep;
                        if (levelIndex < 0) levelIndex = 0;
                        if (levelIndex >= chain.Length) levelIndex = chain.Length - 1;
                        return chain[levelIndex];
                    }
                }
            }
            else
            {
                var seq = ctx.StakeEntries;
                if (seq != null && seq.Length > 0)
                {
                    var idx = money.CurrentIndex;
                    if (idx < 0) idx = 0;
                    if (idx >= seq.Length) idx = seq.Length - 1;
                    return seq[idx];
                }
            }

            return new AviatorStakeEntry { Stake = money.GetStakeForThisBet(), Target = 1.01, Raw = "1000:1.01" };
        }
    }
}
