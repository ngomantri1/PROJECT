using System;
using System.Threading;
using System.Threading.Tasks;

namespace TaiXiuLiveHit.Tasks
{
    public sealed class SeqMajorMinorTask : IBetTask
    {
        public string DisplayName => "3) Chuỗi N/I tự nhập";
        public string Id => "seq-ni";               // 3) Chuỗi N/I tự nhập

        private static string PickSideByNI(char ni, TaiXiuLiveHit.CwTotals t)
        {
            // N = đánh cửa có tổng tiền NHIỀU hơn; I = đánh cửa có tổng tiền ÍT hơn
            long tt = t?.T ?? 0, xx = t?.X ?? 0;
            if (ni == 'N') return (tt >= xx) ? "TAI" : "XIU";
            return (tt < xx) ? "TAI" : "XIU";
        }

        public async Task RunAsync(GameContext ctx, CancellationToken ct)
        {
            var money = new MoneyManager(ctx.StakeSeq, ctx.MoneyStrategyId);
            var raw = (ctx.BetSeq ?? "").Trim().ToUpperInvariant().Replace(" ", "");
            char[] seq = Array.FindAll(raw.ToCharArray(), ch => ch == 'N' || ch == 'I');
            if (seq.Length == 0) throw new InvalidOperationException("Chuỗi N/I không hợp lệ.");

            int k = 0;
            while (true)
            {
                ct.ThrowIfCancellationRequested();
                await Task.Delay(60, ct);

                await TaskUtil.WaitUntilBetWindow(ctx, ct);

                var snap = ctx.GetSnap();
                string baseSession = snap?.session ?? string.Empty;

                string side = PickSideByNI(seq[k], snap?.totals);
                long stake;
                if (ctx.MoneyStrategyId == "MultiChain")   // đặt đúng id bạn đặt ở combobox
                {
                    stake = MoneyHelper.CalcAmountMultiChain(
                        ctx.StakeChains,
                        ctx.MoneyChainIndex,
                        ctx.MoneyChainStep,
                        ctx.MoneyChainWaitForWin);
                }
                else
                {
                    stake = money.GetStakeForThisBet();
                }
                await TaskUtil.PlaceBet(ctx, side, stake, ct);

                bool win = await TaskUtil.WaitRoundFinishAndJudge(ctx, side, baseSession, ct);
                await ctx.UiDispatcher.InvokeAsync(() => ctx.UiAddWin?.Invoke(win ? stake : -stake));
                if (ctx.MoneyStrategyId == "MultiChain")
                {
                    // cần biến local để truyền ref
                    int chainIndex = ctx.MoneyChainIndex;
                    int chainStep = ctx.MoneyChainStep;
                    double chainProfit = ctx.MoneyChainProfit;
                    bool waitForWin = ctx.MoneyChainWaitForWin;

                    MoneyHelper.UpdateAfterRoundMultiChain(
                        ctx.StakeChains,
                        ctx.StakeChainTotals,
                        ref chainIndex,
                        ref chainStep,
                        ref chainProfit,
                        ref waitForWin,
                        win);

                    // gán ngược lại vào context
                    ctx.MoneyChainIndex = chainIndex;
                    ctx.MoneyChainStep = chainStep;
                    ctx.MoneyChainProfit = chainProfit;
                    ctx.MoneyChainWaitForWin = waitForWin;
                }
                else
                {
                    // 4 kiểu cũ vẫn đi qua MoneyManager
                    money.OnRoundResult(win);
                }

                k = (k + 1) % seq.Length;
            }
        }
    }
}
