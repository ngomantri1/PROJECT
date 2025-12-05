using System;
using System.Threading;
using System.Threading.Tasks;
using static XocDiaLiveHit.Tasks.TaskUtil;

namespace XocDiaLiveHit.Tasks
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

        private static char Opp(char c) => c == 'C' ? 'L' : 'C';
        private static string ToSide(char c) => (c == 'C') ? "CHAN" : "LE";

        private static char DecideNext(string parity)
        {
            if (string.IsNullOrEmpty(parity)) return 'C';
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
                    stake = MoneyHelper.CalcAmountMultiChain(ctx);
                }
                else
                {
                    stake = money.GetStakeForThisBet();
                }
                string side = ToSide(next);
                ctx.Log?.Invoke($"[RunLen] next={side}, stake={stake:N0}");
                bool placed = await PlaceBet(ctx, side, stake, ct);
                if (!placed) continue;
                bool win = await WaitRoundFinishAndJudge(ctx, side, snap?.seq ?? "", ct);
                await ctx.UiDispatcher.InvokeAsync(() => ctx.UiAddWin?.Invoke(win ? stake : -stake));
                if (ctx.MoneyStrategyId == "MultiChain")
                {
                    // cần biến local để truyền ref
                    int chainIndex = ctx.MoneyChainIndex;
                    int chainStep = ctx.MoneyChainStep;
                    double chainProfit = ctx.MoneyChainProfit;
                    bool skipZero = ctx.SkipZeroAfterPositiveWin;

                    MoneyHelper.UpdateAfterRoundMultiChain(
                        ctx.StakeChains,
                        ctx.StakeChainTotals,
                        ref chainIndex,
                        ref chainStep,
                        ref chainProfit,
                        ref skipZero,
                        stake,
                        win);

                    // gán ngược lại vào context
                    ctx.MoneyChainIndex = chainIndex;
                    ctx.MoneyChainStep = chainStep;
                    ctx.MoneyChainProfit = chainProfit;
                    ctx.SkipZeroAfterPositiveWin = skipZero;
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
