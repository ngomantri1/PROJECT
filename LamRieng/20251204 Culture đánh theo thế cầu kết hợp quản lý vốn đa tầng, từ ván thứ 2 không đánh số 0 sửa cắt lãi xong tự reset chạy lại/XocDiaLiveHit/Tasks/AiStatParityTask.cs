using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using static XocDiaLiveHit.Tasks.TaskUtil;

namespace XocDiaLiveHit.Tasks
{
    /// <summary>
    /// 7) Bám cầu C/L theo thống kê AI — phiên bản đánh LIÊN TỤC
    /// - Mỗi ván đều vào lệnh (không bỏ nhịp).
    /// - Nếu thua (gãy cầu), vòng sau tính lại mẫu và đánh tiếp.
    /// - Nếu không khớp được mẫu nào → ĐÁNH THEO KẾT QUẢ VỪA VỀ (không đảo 1–1).
    /// - Quản lý vốn: dùng MoneyManager giống SmartPrevTask.
    /// </summary>
    public sealed class AiStatParityTask : IBetTask
    {
        public string DisplayName => "7) Bám cầu C/L theo thống kê AI";
        public string Id => "ai-stat-cl";

        private const int DefaultMaxPatternLen = 6;

        private static string ParityCharToSideSafe(char ch) => (ch == 'C') ? "CHAN" : "LE";

        /// <summary>
        /// Dự đoán ký tự C/L ván kế + confidence (0..1).
        /// Luật:
        /// - k từ k_max→1: match tail; đếm C_count/L_count sau vị trí match.
        /// - C_count ≠ L_count: chọn bên nhiều hơn và conf = |C-L|/(C+L).
        /// - Hòa: ưu tiên lần xuất hiện gần nhất; nếu không có → ĐÁNH NGƯỢC so với ván cuối (cầu 1–1).
        /// - KHÔNG CÓ MẪU NÀO: Fallback = THEO VÁN CUỐI (đánh đúng kết quả vừa về).
        /// </summary>
        private static (char next, double conf) PredictNextWithConfidence(string input, int maxPatternLen = DefaultMaxPatternLen)
        {
            if (string.IsNullOrWhiteSpace(input)) return ('C', 0);

            var seq = new string(input
                .Where(ch => ch == 'C' || ch == 'c' || ch == 'L' || ch == 'l')
                .Select(char.ToUpperInvariant)
                .ToArray());

            int n = seq.Length;
            if (n == 0) return ('C', 0);
            if (n == 1) return (seq[0], 0); // theo đúng kết quả vừa về

            for (int k = Math.Min(maxPatternLen, n - 1); k >= 1; k--)
            {
                var tail = seq.Substring(n - k, k);

                int cCount = 0, lCount = 0;
                int mostRecentIdx = -1;
                char mostRecentNext = '\0';

                for (int i = 0; i <= n - k - 1; i++)
                {
                    if (seq.AsSpan(i, k).SequenceEqual(seq.AsSpan(n - k, k)))
                    {
                        char next = seq[i + k];
                        if (next == 'C') cCount++;
                        else if (next == 'L') lCount++;

                        if (i > mostRecentIdx)
                        {
                            mostRecentIdx = i;
                            mostRecentNext = next;
                        }
                    }
                }

                if (cCount + lCount > 0)
                {
                    if (cCount > lCount)
                        return ('C', (double)(cCount - lCount) / (cCount + lCount));
                    if (lCount > cCount)
                        return ('L', (double)(lCount - cCount) / (cCount + lCount));

                    // HÒA tần suất:
                    // - Nếu có "lần xuất hiện gần nhất" -> dùng nó.
                    // - Nếu không có -> ĐÁNH NGƯỢC so với ván cuối (cầu 1–1), conf=0 để log.
                    if (mostRecentNext != '\0')
                        return (mostRecentNext, 0.0);

                    char last = seq[n - 1];
                    char opposite = (last == 'C') ? 'L' : 'C'; // cầu 1–1
                    return (opposite, 0.0);
                }
            }

            // KHÔNG tìm được mẫu nào: theo VÁN CUỐI (đánh đúng kết quả vừa về)
            return (seq[n - 1], 0.0);
        }

        public async Task RunAsync(GameContext ctx, CancellationToken ct)
        {
            var money = new MoneyManager(ctx.StakeSeq, ctx.MoneyStrategyId);
            ctx.Log?.Invoke($"[AI-Stat-CL] Khởi chạy liên tục: k_max={DefaultMaxPatternLen}, vốn={ctx.MoneyStrategyId}");

            while (true)
            {
                ct.ThrowIfCancellationRequested();

                await WaitUntilBetWindow(ctx, ct);

                // Ảnh chụp chuỗi trước khi đặt (để chấm thắng/thua)
                var snap = ctx.GetSnap();
                string baseSeq = snap?.seq ?? string.Empty;

                // Chuyển lịch sử sang C/L (cũ->mới)
                string parity = SeqToParityString(baseSeq);

                // Luôn quyết định và vào lệnh — không bỏ nhịp
                var (next, conf) = PredictNextWithConfidence(parity, DefaultMaxPatternLen);
                string side = ParityCharToSideSafe(next);
                long stake;
                if (ctx.MoneyStrategyId == "MultiChain")   // đặt đúng id bạn đặt ở combobox
                {
                    stake = MoneyHelper.CalcAmountMultiChain(ctx);
                    MoneyHelper.UpdateUiLevel(ctx);
                }
                else
                {
                    stake = money.GetStakeForThisBet();
                }
                ctx.Log?.Invoke($"[AI-Stat-CL] pick={side}, conf={conf:F2}, stake={stake:N0}");
                bool placed = await PlaceBet(ctx, side, stake, ct);
                if (!placed) continue;
                bool win = await WaitRoundFinishAndJudge(ctx, side, baseSeq, ct);
                await ctx.UiDispatcher.InvokeAsync(() => ctx.UiAddWin?.Invoke(win ? stake : -stake));
                if (ctx.MoneyStrategyId == "MultiChain")
                {
                    // cần biến local để truyền ref
                    int chainIndex = ctx.MoneyChainIndex;
                    int chainStep = ctx.MoneyChainStep;
                    double chainProfit = ctx.MoneyChainProfit;
                    bool skipZero = ctx.SkipZeroAfterPositiveWin;

                    MoneyHelper.UpdateAfterRoundMultiChain(
                        ctx.StakeChains,
                        ctx.StakeChainTotals,
                        ref chainIndex,
                        ref chainStep,
                        ref chainProfit,
                        ref skipZero,
                        stake,
                        win);

                    // gán ngược lại vào context
                    ctx.MoneyChainIndex = chainIndex;
                    ctx.MoneyChainStep = chainStep;
                    ctx.MoneyChainProfit = chainProfit;
                    ctx.SkipZeroAfterPositiveWin = skipZero;
                }
                else
                {
                    // 4 kiểu cũ vẫn đi qua MoneyManager
                    money.OnRoundResult(win);
                }

                // Không nghỉ nhịp: vòng sau tự tính lại cầu dựa trên lịch sử mới
                if (!win)
                {
                    ctx.Log?.Invoke("[AI-Stat-CL] Gãy cầu → tính lại cầu mới và đánh tiếp (không dừng).");
                }
            }
        }
    }
}
