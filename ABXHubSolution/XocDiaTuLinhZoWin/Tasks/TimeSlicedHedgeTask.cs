using System.Threading;
using System.Threading.Tasks;
using static XocDiaTuLinhZoWin.Tasks.TaskUtil;

namespace XocDiaTuLinhZoWin.Tasks
{
    /// <summary>
    /// 11) Time-sliced hedge (block 10 tay):
    /// - Tay 1..5: theo ván cuối
    /// - Tay 6..10: đảo ván cuối
    /// - Lặp lại block (1..10)
    /// </summary>
    public sealed class TimeSlicedHedgeTask : IBetTask
    {
        public string DisplayName => "11) Lịch chẻ 10 tay";
        public string Id => "time-sliced-hedge";

        private int _roundInBlock = 0; // 0..9

        private static char Opp(char c) => c == 'C' ? 'L' : 'C';
        private static string ToSide(char c) => (c == 'C') ? "CHAN" : "LE";

        private char Decide(string parity)
        {
            char last = (parity.Length == 0) ? 'C' : parity[^1];
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
                var parity = SeqToParityString(snap?.seq ?? "");

                char next = Decide(parity);
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
                await ctx.UiDispatcher.InvokeAsync(() => ctx.UiAddWin?.Invoke(win ? stake : -stake));
                if (ctx.MoneyStrategyId == "MultiChain")
                {
                    // cần biến local để truyền ref
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

                    // gán ngược lại vào context
                    ctx.MoneyChainIndex = chainIndex;
                    ctx.MoneyChainStep = chainStep;
                    ctx.MoneyChainProfit = chainProfit;
                }
                else
                {
                    // 4 kiểu cũ vẫn đi qua MoneyManager
                    money.OnRoundResult(win);
                }

                _roundInBlock = (_roundInBlock + 1) % 10;
            }
        }
    }
}
