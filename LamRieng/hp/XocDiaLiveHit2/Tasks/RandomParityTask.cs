using System;
using System.Threading;
using System.Threading.Tasks;
using static XocDiaLiveHit2.Tasks.TaskUtil;

namespace XocDiaLiveHit2.Tasks
{
    /// <summary>6) Cửa đặt ngẫu nhiên (random) – giữ nguyên quản lý vốn như SmartPrevTask</summary>
    public sealed class RandomParityTask : IBetTask
    {
        public string DisplayName => "6) Cửa đặt ngẫu nhiên";
        public string Id => "random-cl"; // 6) Ngẫu nhiên

        private static readonly ThreadLocal<Random> _rng =
            new(() => new Random(unchecked(Environment.TickCount * 31 + Environment.CurrentManagedThreadId)));

        private static string DecideRandomSide() => (_rng.Value!.Next(2) == 0) ? "CHAN" : "LE";

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
                var stake = money.GetStakeForThisBet();
                ctx.Log?.Invoke($"[RandomCL] Chọn ngẫu nhiên: {side}, stake={stake:N0}");

                await PlaceBet(ctx, side, stake, ct);

                bool win = await WaitRoundFinishAndJudge(ctx, side, baseSeq, ct);
                await ctx.UiDispatcher.InvokeAsync(() => ctx.UiAddWin?.Invoke(win ? stake : -stake));
                money.OnRoundResult(win);
            }
        }
    }
}
