using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using static TaiXiuThuongKF.Tasks.TaskUtil;

namespace TaiXiuThuongKF.Tasks
{
    /// <summary>
    /// 8) Xu hướng chuyển trạng thái: nhìn các TRANSITION gần nhất (same vs flip).
    /// - Nếu "đảo" xuất hiện nhiều hơn → đánh ngược ván cuối.
    /// - Nếu "lặp" nhiều hơn (hay bằng) → đánh theo ván cuối.
    /// - Luôn đánh liên tục (không bỏ nhịp).
    /// </summary>
    public sealed class StateTransitionBiasTask : IBetTask
    {
        public string DisplayName => "8) Xu hướng chuyển trạng thái";
        public string Id => "state-trans-bias";

        private const int WindowK = 6; // số chuyển động gần nhất để thống kê

        private static char DecideNext(char last, string seq)
        {
            // seq: chỉ 'C'/'L', cũ->mới
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

        private static char Opp(char t) => t == 'T' ? 'X' : 'T';
        private static string ToSide(char t) => (t == 'T') ? "TAI" : "XIU";

        public async Task RunAsync(GameContext ctx, CancellationToken ct)
        {
            var money = new MoneyManager(ctx.StakeSeq, ctx.MoneyStrategyId);
            ctx.Log?.Invoke($"[StateTrans] Start: k={WindowK}");

            while (true)
            {
                ct.ThrowIfCancellationRequested();
                await WaitUntilNewRoundStart(ctx, ct);

                var snap = ctx.GetSnap();
                var parity = SeqToParityString(snap?.seq ?? "");
                if (parity.Length == 0) parity = "T";

                char last = parity[^1];
                char next = DecideNext(last, parity);

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
                bool win = await WaitRoundFinishAndJudge(ctx, side, snap?.session ?? "", ct);
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
            }
        }
    }
}
