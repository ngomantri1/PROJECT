using System.Threading;
using System.Threading.Tasks;
using static TaiXiuLiveSun.Tasks.TaskUtil;

namespace TaiXiuLiveSun.Tasks
{
    /// <summary>
    /// 11) Time-sliced hedge (block 10 tay):
    /// - Tay 1..5: theo ván cuối
    /// - Tay 6..10: đảo ván cuối
    /// - Lặp lại block (1..10)
    /// </summary>
    public sealed class TimeSlicedHedgeTxTask : IBetTask
    {
        public string DisplayName => "22) Lich che 10 tay cho tai xiu";
        public string Id => "time-sliced-hedge-tx";

        private int _roundInBlock = 0; // 0..9

        private static char Opp(char c) => c == 'X' ? 'T' : 'X';
        private static string ToSide(char c) => (c == 'X') ? "XIU" : "TAI";

        private char Decide(string tx)
        {
            char last = (tx.Length == 0) ? 'X' : tx[^1];
            int idx = (_roundInBlock % 10); // 0..9
            return (idx < 5) ? last : Opp(last);
        }

        public async Task RunAsync(GameContext ctx, CancellationToken ct)
        {
            var money = new MoneyManager(ctx.StakeSeq, ctx.MoneyStrategyId);
            ctx.Log?.Invoke("[TimeSliced] Start: 5 follow + 5 opp");

            while (true)
            {
                ct.ThrowIfCancellationRequested();
                await WaitUntilNewRoundStart(ctx, ct);

                var snap = ctx.GetSnap();
                var tx = SeqToTxString(snap?.seq ?? "");

                char next = Decide(tx);
                long stake;
                if (ctx.MoneyStrategyId == "MultiChain")   // đặt đúng id bạn đặt ở combobox
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
                string side = ToSide(next);
                ctx.Log?.Invoke($"[TimeSliced] r={_roundInBlock % 10 + 1}/10 next={side}, stake={stake:N0}");

                await PlaceBet(ctx, side, stake, ct);
                bool win = await WaitRoundFinishAndJudge(ctx, side, snap?.seq ?? "", ct);
                await TaskUtil.ApplyMoneyAfterRoundAsync(ctx, money, win, win ? stake : -stake);

                _roundInBlock = (_roundInBlock + 1) % 10;
            }
        }
    }
}
