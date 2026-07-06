using System;
using System.Threading;
using System.Threading.Tasks;

namespace XocDiaTuLinhHit.Tasks
{
    public sealed class SeqMajorMinorTask : IBetTask
    {
        public string DisplayName => "3) Chuỗi N/I tự nhập";
        public string Id => "seq-ni";               // 3) Chuỗi N/I tự nhập

        private static string PickSideByNI(char ni, XocDiaTuLinhHit.CwTotals t)
        {
            // N = đánh cửa có tổng tiền NHIỀU hơn; I = đánh cửa có tổng tiền ÍT hơn
            long c = t?.C ?? 0, l = t?.L ?? 0;
            if (ni == 'N') return (c >= l) ? "CHAN" : "LE";
            return (c < l) ? "CHAN" : "LE";
        }

        public async Task RunAsync(GameContext ctx, CancellationToken ct)
        {
            var money = new MoneyManager(() => ctx.StakeSeq, ctx.MoneyStrategyId);
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
                string baseSeq = snap?.seq ?? string.Empty;

                char pick = seq[k];
                string side = PickSideByNI(pick, snap?.totals);
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
                var remainSec = snap?.progSec ?? ((snap?.prog ?? 0) * 20.0);
                ctx.Log?.Invoke($"[Seq-NI] bet-window k={k} pick={pick} side={side} stake={stake:N0} remain={remainSec:0.0}s seq={baseSeq} totals C={snap?.totals?.C ?? 0:N0} L={snap?.totals?.L ?? 0:N0}");
                await TaskUtil.PlaceBet(ctx, side, stake, ct);
                ctx.Log?.Invoke($"[Seq-NI] sent PlaceBet side={side} stake={stake:N0} seq={baseSeq}");

                bool win = await TaskUtil.WaitRoundFinishAndJudge(ctx, side, baseSeq, ct);
                ctx.Log?.Invoke($"[Seq-NI] round-finish side={side} stake={stake:N0} win={win}");
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

                k = (k + 1) % seq.Length;
            }
        }
    }
}
