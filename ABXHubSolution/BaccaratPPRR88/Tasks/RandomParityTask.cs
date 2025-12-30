using System;
using System.Threading;
using System.Threading.Tasks;
using static BaccaratPPRR88.Tasks.TaskUtil;

namespace BaccaratPPRR88.Tasks
{
    /// <summary>6) Cửa đặt ngẫu nhiên (random) – giữ nguyên quản lý vốn như SmartPrevTask</summary>
    public sealed class RandomParityTask : IBetTask
    {
        public string DisplayName => "6) Cửa đặt ngẫu nhiên";
        public string Id => "random-pb"; // 6) Ngẫu nhiên

        private static readonly ThreadLocal<Random> _rng =
            new(() => new Random(unchecked(Environment.TickCount * 31 + Environment.CurrentManagedThreadId)));

        private static string DecideRandomSide() => (_rng.Value!.Next(2) == 0) ? "P" : "B";

        public async Task RunAsync(GameContext ctx, CancellationToken ct)
        {
            var money = new MoneyManager(ctx.StakeSeq, ctx.MoneyStrategyId);
            ctx.Log?.Invoke($"[RandomPB] Khởi chạy: vốn={ctx.MoneyStrategyId}");

            while (true)
            {
                ct.ThrowIfCancellationRequested();

                await WaitUntilNewRoundStart(ctx, ct);

                var snap = ctx.GetSnap();
                string baseSession = snap?.session ?? string.Empty;

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
                ctx.Log?.Invoke($"[RandomPB] Chọn ngẫu nhiên: {side}, stake={stake:N0}");

                await PlaceBet(ctx, side, stake, ct);

                bool? win = await WaitRoundFinishAndJudge(ctx, side, baseSession, ct);
                if (win.HasValue)
                    await ctx.UiDispatcher.InvokeAsync(() => ctx.UiAddWin?.Invoke(win.Value ? stake : -stake));
                if (ctx.MoneyStrategyId == "MultiChain")
                {
                    // cần biến local để truyền ref
                    int chainIndex = ctx.MoneyChainIndex;
                    int chainStep = ctx.MoneyChainStep;
                    double chainProfit = ctx.MoneyChainProfit;

                    if (win.HasValue)
                    {
                        MoneyHelper.UpdateAfterRoundMultiChain(
                            ctx.StakeChains,
                            ctx.StakeChainTotals,
                            ref chainIndex,
                            ref chainStep,
                            ref chainProfit,
                            win.Value);
                    }

                    // gán ngược lại vào context
                    ctx.MoneyChainIndex = chainIndex;
                    ctx.MoneyChainStep = chainStep;
                    ctx.MoneyChainProfit = chainProfit;
                }
                else
                {
                    // 4 kiểu cũ vẫn đi qua MoneyManager
                    if (win.HasValue)
                        money.OnRoundResult(win.Value);
                }
            }
        }
    }
}
