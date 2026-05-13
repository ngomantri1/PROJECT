using System.Threading;
using System.Threading.Tasks;
using static TaiXiuLiveHit.Tasks.TaskUtil;

namespace TaiXiuLiveHit.Tasks
{
    public sealed class SmartPrevAdvancedTask : IBetTask
    {
        public string DisplayName => "18) Bám cầu trước nâng cao";
        public string Id => "smart-prev-advanced";

        private static (int seg1, int seg2, int seg3) SplitSegments(string parity)
        {
            // Lấy 3 đoạn liên tiếp tính từ RIGHT (kết quả mới nhất):
            // seg3 = chuỗi cùng dấu với kết quả vừa về
            // seg2 = chuỗi trái dấu
            // seg1 = chuỗi cùng dấu tiếp theo
            if (string.IsNullOrEmpty(parity)) return (0, 0, 0);

            int i = parity.Length - 1;
            char last = parity[i];
            int seg3 = 0; while (i >= 0 && parity[i] == last) { seg3++; i--; }
            int seg2 = 0; while (i >= 0 && parity[i] != last) { seg2++; i--; }
            int seg1 = 0; while (i >= 0 && parity[i] == last) { seg1++; i--; }

            return (seg1, seg2, seg3);
        }

        private static string DecideNextSide(string parity)
        {
            if (parity.Length == 0) return "TAI"; // mặc định

            char lastParity = parity[^1]; // 'T' hoặc 'X'
            var (seg1, _, seg3) = SplitSegments(parity);

            // Luật Task 18:
            // - seg1 == 1 và seg3 == 1 => đánh đảo
            // - seg1 == 1 và seg3 >= 2 => đánh theo
            // - seg1 >= 2 => luôn đánh theo
            // - fallback seg1 == 0 => đánh theo
            bool sameAsLast = true;
            if (seg1 == 1 && seg3 == 1)
                sameAsLast = false;

            char pick = sameAsLast ? lastParity : (lastParity == 'T' ? 'X' : 'T');
            return ParityCharToSide(pick);
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
                string parity = SeqToParityString(snap?.seq ?? "");
                string baseSession = snap?.session ?? string.Empty;

                string side = DecideNextSide(parity);
                long stake;
                if (ctx.MoneyStrategyId == "MultiChain")
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

                bool win = await WaitRoundFinishAndJudge(ctx, side, baseSession, ct);
                await TaskUtil.ApplyPostRoundMoneyAsync(ctx, money, win, win ? stake : -stake, ct);
            }
        }
    }
}
