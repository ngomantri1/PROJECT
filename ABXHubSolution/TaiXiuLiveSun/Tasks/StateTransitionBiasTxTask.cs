using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using static TaiXiuLiveSun.Tasks.TaskUtil;

namespace TaiXiuLiveSun.Tasks
{
    /// <summary>
    /// 8) Xu hướng chuyển trạng thái: nhìn các TRANSITION gần nhất (same vs flip).
    /// - Nếu "đảo" xuất hiện nhiều hơn → đánh ngược ván cuối.
    /// - Nếu "lặp" nhiều hơn (hay bằng) → đánh theo ván cuối.
    /// - Luôn đánh liên tục (không bỏ nhịp).
    /// </summary>
    public sealed class StateTransitionBiasTxTask : IBetTask
    {
        public string DisplayName => "16) Xu huong chuyen trang thai cho tai xiu";
        public string Id => "state-trans-bias-tx";

        private const int WindowK = 6; // số chuyển động gần nhất để thống kê

        private static char DecideNext(char last, string seq)
        {
            // seq: chỉ 'X'/'T', cũ->mới
            if (seq.Length < 2) return last;

            int consider = Math.Min(WindowK + 1, seq.Length);
            int same = 0, flip = 0;
            for (int i = seq.Length - consider + 1; i < seq.Length; i++)
            {
                if (seq[i] == seq[i - 1]) same++;
                else flip++;
            }
            return (flip > same) ? Opp(last) : last;
        }

        private static char Opp(char c) => c == 'X' ? 'T' : 'X';
        private static string ToSide(char c) => (c == 'X') ? "XIU" : "TAI";

        public async Task RunAsync(GameContext ctx, CancellationToken ct)
        {
            var money = new MoneyManager(ctx.StakeSeq, ctx.MoneyStrategyId);
            ctx.Log?.Invoke($"[StateTrans] Start: k={WindowK}");

            while (true)
            {
                ct.ThrowIfCancellationRequested();
                await WaitUntilNewRoundStart(ctx, ct);

                var snap = ctx.GetSnap();
                var tx = SeqToTxString(snap?.seq ?? "");
                if (tx.Length == 0) tx = "C";

                char last = tx[^1];
                char next = DecideNext(last, tx);

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
                ctx.Log?.Invoke($"[StateTrans] next={side}, stake={stake:N0}");

                await PlaceBet(ctx, side, stake, ct);
                bool win = await WaitRoundFinishAndJudge(ctx, side, snap?.seq ?? "", ct);
                await TaskUtil.ApplyMoneyAfterRoundAsync(ctx, money, win, win ? stake : -stake);
            }
        }
    }
}
