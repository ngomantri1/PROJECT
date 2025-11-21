using System;
using System.Threading;
using System.Threading.Tasks;
using static TaiXiuLiveHit.Tasks.TaskUtil;

namespace TaiXiuLiveHit.Tasks
{
    /// <summary>
    /// 9) Run-length bias:
    /// - Nếu run hiện tại (độ dài chuỗi cùng ký tự cuối) >= T --> ĐÁNH NGƯỢC (mean-revert)
    /// - Ngược lại --> THEO ván cuối (momentum)
    /// </summary>
    public sealed class RunLengthBiasTask : IBetTask
    {
        public string DisplayName => "9) Run-length (dài-chuỗi)";
        public string Id => "run-length-bias";

        private const int T = 3; // ngưỡng run-length

        private static char Opp(char t) => t == 'T' ? 'X' : 'T';
        private static string ToSide(char t) => (t == 'T') ? "TAI" : "XIU";

        private static char DecideNext(string parity)
        {
            if (string.IsNullOrEmpty(parity)) return 'T';
            char last = parity[^1];
            // đếm run-length của last từ cuối ngược về
            int run = 1;
            for (int i = parity.Length - 2; i >= 0 && parity[i] == last; i--) run++;
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
                var parity = SeqToParityString(snap?.seq ?? "");

                char next = DecideNext(parity);
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
