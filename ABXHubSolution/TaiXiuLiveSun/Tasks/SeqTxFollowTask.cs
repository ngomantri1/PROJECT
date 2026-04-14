using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using static TaiXiuLiveSun.Tasks.TaskUtil;

namespace TaiXiuLiveSun.Tasks
{
    public sealed class SeqTxFollowTask : IBetTask
    {
        public string DisplayName => "2) Chuoi cau T/X (tai/xiu tu nhap)";
        public string Id => "seq-tx-follow";

        public async Task RunAsync(GameContext ctx, CancellationToken ct)
        {
            var money = new MoneyManager(ctx.StakeSeq, ctx.MoneyStrategyId);
            var raw = (ctx.BetSeq ?? "").Trim().ToUpperInvariant().Replace(" ", "");
            if (string.IsNullOrEmpty(raw)) throw new InvalidOperationException("Chưa nhập CHUỖI CẦU (T/X).");

            // Cho phép nhập T/X hoặc số 0..6, chuẩn hoá về T/X
            char[] seq = raw
                .Select(DigitToTx)
                .Where(ch => ch == 'X' || ch == 'T')
                .ToArray();
            if (seq.Length == 0) throw new InvalidOperationException("CHUỖI CẦU không hợp lệ.");

            int k = 0;
            while (true)
            {
                ct.ThrowIfCancellationRequested();

                // chờ tới cửa đặt
                await WaitUntilNewRoundStart(ctx, ct);

                var snap = ctx.GetSnap();
                string baseSeq = snap?.seq ?? string.Empty;

                string side = TxCharToSide(seq[k]);
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

                bool win = await WaitRoundFinishAndJudge(ctx, side, baseSeq, ct);
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

                // quay chuỗi
                k = (k + 1) % seq.Length;
            }
        }
    }
}
