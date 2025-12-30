using System;
using System.Threading;
using System.Threading.Tasks;
using static BaccaratPPRR88.Tasks.TaskUtil;

namespace BaccaratPPRR88.Tasks
{
    public sealed class SeqParityFollowTask : IBetTask
    {
        public string DisplayName => "1) Chuỗi P/B tự nhập";
        public string Id => "seq-parity";               // 1) Chuỗi P/B tự nhập

        public async Task RunAsync(GameContext ctx, CancellationToken ct)
        {
            var money = new MoneyManager(ctx.StakeSeq, ctx.MoneyStrategyId);
            var raw = (ctx.BetSeq ?? "").Trim().ToUpperInvariant().Replace(" ", "");
            if (string.IsNullOrEmpty(raw)) throw new InvalidOperationException("Chưa nhập CHUỖI CẦU (P/B).");

            // chỉ giữ P hoặc B
            char[] seq = Array.FindAll(raw.ToCharArray(), ch => ch == 'P' || ch == 'B');
            if (seq.Length == 0) throw new InvalidOperationException("CHUỖI CẦU không hợp lệ.");

            int k = 0;
            while (true)
            {
                ct.ThrowIfCancellationRequested();

                // chờ tới cửa đặt
                await WaitUntilNewRoundStart(ctx, ct);

                var snap = ctx.GetSnap();
                string baseSession = snap?.session ?? string.Empty;

                string side = ParityCharToSide(seq[k]);
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

                // quay chuỗi
                k = (k + 1) % seq.Length;
            }
        }
    }
}
