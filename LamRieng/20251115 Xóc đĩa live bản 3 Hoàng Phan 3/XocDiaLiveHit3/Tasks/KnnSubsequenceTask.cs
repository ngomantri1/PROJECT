using System;
using System.Threading;
using System.Threading.Tasks;
using static XocDiaLiveHit3.Tasks.TaskUtil;

namespace XocDiaLiveHit3.Tasks
{
    /// <summary>
    /// 12) KNN chuỗi con (Hamming <= 1):
    /// - Lấy tail độ dài k (k=6..3). Tìm các vị trí lịch sử có khoảng cách Hamming <= 1.
    /// - Mỗi match đóng góp 1 phiếu (exact=2 phiếu). Chọn bên nhiều phiếu.
    /// - Hòa -> đảo ván cuối; Không match -> theo ván cuối.
    /// - Luôn đánh liên tục.
    /// </summary>
    public sealed class KnnSubsequenceTask : IBetTask
    {
        public string DisplayName => "12) KNN chuỗi con";
        public string Id => "knn-subseq";

        private const int KMax = 6;
        private const int KMin = 3;

        private static char Opp(char c) => (c == 'C') ? 'L' : 'C';
        private static string ToSide(char c) => (c == 'C') ? "CHAN" : "LE";

        private static int Hamming(ReadOnlySpan<char> a, ReadOnlySpan<char> b)
        {
            int d = 0;
            for (int i = 0; i < a.Length; i++) if (a[i] != b[i]) d++;
            return d;
        }

        private static char Decide(string p)
        {
            int n = p.Length;
            if (n <= 1) return (n == 0) ? 'C' : p[^1];

            for (int k = Math.Min(KMax, n - 1); k >= KMin; k--)
            {
                var tail = p.AsSpan(n - k, k);
                int scoreC = 0, scoreL = 0;

                for (int i = 0; i <= n - k - 1; i++)
                {
                    var cand = p.AsSpan(i, k);
                    int d = Hamming(tail, cand);
                    if (d <= 1)
                    {
                        char next = p[i + k];
                        int w = (d == 0) ? 2 : 1;
                        if (next == 'C') scoreC += w; else if (next == 'L') scoreL += w;
                    }
                }

                if (scoreC + scoreL > 0)
                {
                    if (scoreC > scoreL) return 'C';
                    if (scoreL > scoreC) return 'L';
                    return Opp(p[^1]); // hòa
                }
            }

            return p[^1]; // không match
        }

        public async Task RunAsync(GameContext ctx, CancellationToken ct)
        {
            var money = new MoneyManager(ctx.StakeSeq, ctx.MoneyStrategyId);
            ctx.Log?.Invoke($"[KNN] Start: K={KMin}..{KMax}");

            while (true)
            {
                ct.ThrowIfCancellationRequested();
                await WaitUntilNewRoundStart(ctx, ct);

                var snap = ctx.GetSnap();
                var parity = SeqToParityString(snap?.seq ?? "");

                char next = Decide(parity);
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
                string side = ToSide(next);
                ctx.Log?.Invoke($"[KNN] next={side}, stake={stake:N0}");

                await PlaceBet(ctx, side, stake, ct);
                bool win = await WaitRoundFinishAndJudge(ctx, side, snap?.seq ?? "", ct);
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
            }
        }
    }
}
