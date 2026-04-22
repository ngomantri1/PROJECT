using System;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Input;
using static TaiXiuLiveSun.Tasks.TaskUtil;

namespace TaiXiuLiveSun.Tasks
{
    public sealed class SmartPrevTxTask : IBetTask
    {
        public string DisplayName => "10) Bam cau truoc (thong minh) cho tai xiu";
        public string Id => "smart-prev-tx";

        private static (int seg1, int seg2, int seg3) SplitSegments(string tx)
        {
            // Lấy 3 đoạn liên tiếp tính từ RIGHT (kết quả mới nhất): 
            // seg3 = chuỗi cùng dấu với kết quả vừa về
            // seg2 = chuỗi trái dấu
            // seg1 = chuỗi cùng dấu tiếp theo
            if (string.IsNullOrEmpty(tx)) return (0, 0, 0);

            int i = tx.Length - 1;
            char last = tx[i];
            int seg3 = 0; while (i >= 0 && tx[i] == last) { seg3++; i--; }
            int seg2 = 0; while (i >= 0 && tx[i] != last) { seg2++; i--; }
            int seg1 = 0; while (i >= 0 && tx[i] == last) { seg1++; i--; }

            return (seg1, seg2, seg3);
        }

        private static string DecideNextSide(string tx)
        {
            if (tx.Length == 0) return "XIU"; // mặc định
            char lastParity = tx[^1];          // 'X' hoặc 'T'
            var (seg1, _, seg3) = SplitSegments(tx);

            // Theo yêu cầu của bạn:
            // - seg1 == seg3 → ĐÁNH NGƯỢC kết quả vừa về
            // - seg1 < seg3  → ĐÁNH GIỐNG kết quả vừa về
            // - seg1 > seg3  → ĐÁNH GIỐNG kết quả vừa về
            bool sameAsLast = (seg1 != seg3);
            char pick = sameAsLast ? lastParity : (lastParity == 'X' ? 'T' : 'X');
            return TxCharToSide(pick);
        }

        public async Task RunAsync(GameContext ctx, CancellationToken ct)
        {
            var money = new MoneyManager(ctx.StakeSeq, ctx.MoneyStrategyId);
            ctx.Log?.Invoke("Chiến lược: " + ctx.MoneyStrategyId);

            while (true)
            {
                ct.ThrowIfCancellationRequested();

                await WaitUntilNewRoundStart(ctx, ct);

                var snap = ctx.GetSnap();
                string tx = SeqToTxString(snap?.seq ?? "");
                string baseSeq = snap?.seq ?? string.Empty;

                string side = DecideNextSide(tx);
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
                await TaskUtil.ApplyMoneyAfterRoundAsync(ctx, money, win, win ? stake : -stake);
            }
        }
    }
}
