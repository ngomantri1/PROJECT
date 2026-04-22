using System;
using System.Threading;
using System.Threading.Tasks;
using static TaiXiuLiveSun.Tasks.TaskUtil;

namespace TaiXiuLiveSun.Tasks
{
    /// <summary>
    /// 9) Run-length bias:
    /// - Nếu run hiện tại (độ dài chuỗi cùng ký tự cuối) >= T --> ĐÁNH NGƯỢC (mean-revert)
    /// - Ngược lại --> THEO ván cuối (momentum)
    /// </summary>
    public sealed class RunLengthBiasTxTask : IBetTask
    {
        public string DisplayName => "18) Run-length cho tai xiu";
        public string Id => "run-length-bias-tx";

        private const int T = 3; // ngưỡng run-length

        private static char Opp(char c) => c == 'X' ? 'T' : 'X';
        private static string ToSide(char c) => (c == 'X') ? "XIU" : "TAI";

        private static char DecideNext(string tx)
        {
            if (string.IsNullOrEmpty(tx)) return 'X';
            char last = tx[^1];
            // đếm run-length của last từ cuối ngược về
            int run = 1;
            for (int i = tx.Length - 2; i >= 0 && tx[i] == last; i--) run++;
            return (run >= T) ? Opp(last) : last;
        }

        public async Task RunAsync(GameContext ctx, CancellationToken ct)
        {
            var money = new MoneyManager(ctx.StakeSeq, ctx.MoneyStrategyId);
            ctx.Log?.Invoke($"[RunLen] Start: T={T}");

            while (true)
            {
                ct.ThrowIfCancellationRequested();
                await WaitUntilNewRoundStart(ctx, ct);

                var snap = ctx.GetSnap();
                var tx = SeqToTxString(snap?.seq ?? "");

                char next = DecideNext(tx);
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
                ctx.Log?.Invoke($"[RunLen] next={side}, stake={stake:N0}");

                await PlaceBet(ctx, side, stake, ct);
                bool win = await WaitRoundFinishAndJudge(ctx, side, snap?.seq ?? "", ct);
                await TaskUtil.ApplyMoneyAfterRoundAsync(ctx, money, win, win ? stake : -stake);
            }
        }
    }
}
