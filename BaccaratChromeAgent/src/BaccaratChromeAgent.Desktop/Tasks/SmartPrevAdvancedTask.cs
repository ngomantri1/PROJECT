using System.Threading;
using System.Threading.Tasks;
using static BaccaratSexyCasino2.Tasks.TaskUtil;

namespace BaccaratSexyCasino2.Tasks
{
    public sealed class SmartPrevAdvancedTask : IBetTask
    {
        public string DisplayName => "18) Bam cau truoc nang cao";
        public string Id => "smart-prev-advanced";

        private static (int seg1, int seg2, int seg3) SplitSegments(string parity)
        {
            if (string.IsNullOrEmpty(parity)) return (0, 0, 0);

            int i = parity.Length - 1;
            char last = parity[i];
            int seg3 = 0; while (i >= 0 && parity[i] == last) { seg3++; i--; }
            int seg2 = 0; while (i >= 0 && parity[i] != last) { seg2++; i--; }
            int seg1 = 0; while (i >= 0 && parity[i] == last) { seg1++; i--; }
            return (seg1, seg2, seg3);
        }

        private static string DecideNextSide(string parity)
        {
            if (parity.Length == 0) return "BANKER";

            char lastParity = parity[^1];
            var (seg1, _, seg3) = SplitSegments(parity);

            // Rule:
            // - seg3 == 1: seg1 == 1 => reverse, seg1 > 1 => follow last
            // - seg3 > 1: always follow last
            bool sameAsLast = seg3 > 1 || seg1 > 1;
            char pick = sameAsLast ? lastParity : (lastParity == 'B' ? 'P' : 'B');
            return ParityCharToSide(pick);
        }

        public async Task RunAsync(GameContext ctx, CancellationToken ct)
        {
            var money = new MoneyManager(ctx.StakeSeq, ctx.MoneyStrategyId);
            ctx.Log?.Invoke("Chien luoc: " + ctx.MoneyStrategyId);

            while (true)
            {
                ct.ThrowIfCancellationRequested();

                await WaitUntilNewRoundStart(ctx, ct);

                var snap = ctx.GetSnap();
                string parity = SeqToParityString(snap?.seq ?? "");
                string baseSeq = snap?.seq ?? string.Empty;

                string side = DecideNextSide(parity);
                long stake;
                if (ctx.MoneyStrategyId == "MultiChain")
                {
                    stake = MoneyHelper.CalcAmountMultiChain(
                        ctx.StakeChains,
                        ctx.MoneyChainIndex,
                        ctx.MoneyChainStep);
                }
                else
                {
                    stake = money.GetStakeForThisBet();
                }

                await PlaceBet(ctx, side, stake, ct);

                bool? win = await WaitRoundFinishAndJudge(ctx, side, baseSeq, ct);
                var netDelta = CalcNetDelta(side, stake, win);
                await TaskUtil.ApplyPostRoundMoneyAsync(ctx, money, win, netDelta, ct);
            }
        }
    }
}
