using System;
using System.Threading;
using System.Threading.Tasks;
using static TaiXiuLiveSun.Tasks.TaskUtil;

namespace TaiXiuLiveSun.Tasks
{
    /// <summary>6) Cửa đặt ngẫu nhiên (random) – giữ nguyên quản lý vốn như SmartPrevTask</summary>
    public sealed class RandomTxTask : IBetTask
    {
        public string DisplayName => "12) Cua dat ngau nhien cho tai xiu";
        public string Id => "random-tx";

        private static readonly ThreadLocal<Random> _rng =
            new(() => new Random(unchecked(Environment.TickCount * 31 + Environment.CurrentManagedThreadId)));

        private static string DecideRandomSide() => (_rng.Value!.Next(2) == 0) ? "XIU" : "TAI";

        public async Task RunAsync(GameContext ctx, CancellationToken ct)
        {
            var money = new MoneyManager(ctx.StakeSeq, ctx.MoneyStrategyId);
            ctx.Log?.Invoke($"[RandomCL] Khởi chạy: vốn={ctx.MoneyStrategyId}");

            while (true)
            {
                ct.ThrowIfCancellationRequested();

                await WaitUntilNewRoundStart(ctx, ct);

                var snap = ctx.GetSnap();
                string baseSeq = snap?.seq ?? string.Empty;

                string side = DecideRandomSide();
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
                ctx.Log?.Invoke($"[RandomCL] Chọn ngẫu nhiên: {side}, stake={stake:N0}");

                await PlaceBet(ctx, side, stake, ct);

                bool win = await WaitRoundFinishAndJudge(ctx, side, baseSeq, ct);
                await TaskUtil.ApplyMoneyAfterRoundAsync(ctx, money, win, win ? stake : -stake);
            }
        }
    }
}
