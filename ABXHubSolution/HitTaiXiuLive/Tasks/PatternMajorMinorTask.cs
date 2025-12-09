using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using static HitTaiXiuLive.Tasks.TaskUtil;

namespace HitTaiXiuLive.Tasks
{
    /// <summary>
    /// 4) Thế cầu N/I tự nhập
    /// - Dùng chuỗi N/I thực tế lấy từ snapshot: snap.niSeq (N = bên nhiều tiền, I = bên ít tiền).
    /// - Ưu tiên dò các pattern có phần nhận diện (lhs) dài hơn trước.
    /// - Khi khớp lhs, xếp hàng các ký tự ở rhs (N/I) để đánh lần lượt.
    /// - Tại thời điểm đặt, N/I được quy đổi thành CHAN/LE dựa theo totals hiện tại.
    /// </summary>
    public sealed class PatternMajorMinorTask : IBetTask
    {
        public string DisplayName => "4) Thế cầu N/I tự nhập";
        public string Id => "pattern-ni";

        // Parse "NII-I;III-IN,NNN-NNNI" -> danh sách (lhs, rhs), ưu tiên lhs dài trước
        private static List<(string lhs, string rhs)> Parse(string s)
        {
            var items = new List<(string lhs, string rhs)>();
            if (string.IsNullOrWhiteSpace(s)) return items;

            // Thêm '\n' và '\r' để split theo dòng (Unix/Windows)
            var parts = s
               .Replace("->", "-")           // 'cc->ll' == 'cc-ll'
               .Replace("→", "-")            // hỗ trợ ký tự mũi tên
               .Replace("–", "-")            // en-dash
               .Replace("—", "-")            // em-dash
               .ToUpperInvariant()
               .Replace(" ", "")
               .Split(new[] { ';', '|', ',', '\n', '\r' }, StringSplitOptions.RemoveEmptyEntries);

            foreach (var p in parts)
            {
                var kv = p.Split('-', StringSplitOptions.RemoveEmptyEntries);
                if (kv.Length == 2)
                {
                    string a = new string(kv[0].Where(c => c == 'N' || c == 'I').ToArray());
                    string b = new string(kv[1].Where(c => c == 'N' || c == 'I').ToArray());
                    if (a.Length > 0 && b.Length > 0) items.Add((a, b));
                }
            }
            return items.OrderByDescending(x => x.lhs.Length).ToList();
        }

        private static string NOrIToSide(char ch, HitTaiXiuLive.CwTotals totals)
        {
            // Chuyển N/I thành CHAN/LE theo tổng tiền "ngay thời điểm đặt"
            long t = totals?.T ?? 0, x = totals?.X ?? 0;
            if (ch == 'N') return (t >= x) ? "TAI" : "XIU"; // hòa coi như N
            return (t < x) ? "TAI" : "XIU";                 // 'I'
        }

        public async Task RunAsync(GameContext ctx, CancellationToken ct)
        {
            var money = new MoneyManager(ctx.StakeSeq, ctx.MoneyStrategyId);
            var patterns = Parse(ctx.BetPatterns);
            if (patterns.Count == 0)
                throw new InvalidOperationException("Chưa nhập CÁC THẾ CẦU (dạng NII-I;III-IN,NNN-NNNI).");

            var planned = new Queue<char>(); // N/I theo rhs
            string activeLhs = null;         // LHS đã match để sinh planned

            while (true)
            {
                ct.ThrowIfCancellationRequested();

                // Luôn lấy ảnh chụp mới nhất
                var snap = ctx.GetSnap();
                var seqNI = snap?.niSeq ?? string.Empty;

                // Nếu chưa có kế hoạch → dò cầu theo đuôi niSeq (ưu tiên LHS dài)
                if (planned.Count == 0 && seqNI.Length > 0)
                {
                    activeLhs = null;
                    foreach (var (lhs, rhs) in patterns)
                    {
                        if (seqNI.EndsWith(lhs))
                        {
                            foreach (var ch in rhs) planned.Enqueue(ch);
                            activeLhs = lhs;              // ghi nhớ LHS nguồn
                            break;
                        }
                    }
                }
                // Không khớp/cũng không có kế hoạch → bỏ qua ván này
                if (planned.Count == 0)
                {
                    await Task.Delay(120, ct);
                    continue;
                }
                // Chờ tới “cửa vào muộn” (Task 4 phụ thuộc DecisionPercent)
                await WaitUntilBetWindow(ctx, ct);
                // ======= TÁI-KIỂM CẦU TRƯỚC KHI ĐẶT =======
                var snapNow = ctx.GetSnap();
                var seqNiNow = snapNow?.niSeq ?? string.Empty;

                // Nếu đuôi niSeq hiện tại KHÔNG còn khớp LHS đã match → hủy kế hoạch & bỏ qua
                if (string.IsNullOrEmpty(activeLhs) || !seqNiNow.EndsWith(activeLhs))
                {
                    planned.Clear();
                    activeLhs = null;
                    await Task.Delay(80, ct);
                    continue;
                }
                // Lấy baseSeq NGAY TRƯỚC khi đặt (ảnh chụp mới nhất)
                string baseSession = snap?.session ?? string.Empty;
                // Lấy 1 ký tự N/I theo kế hoạch và quy đổi N/I -> CHAN/LE theo totals GIỜ NÀY
                char planNI = planned.Dequeue();
                string side = NOrIToSide(planNI, snapNow?.totals);

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

                // Đặt cược
                await PlaceBet(ctx, side, stake, ct);

                // Chờ ván xong & chấm kết quả so với baseSeq NGAY TRƯỚC KHI ĐẶT
                bool win = await WaitRoundFinishAndJudge(ctx, side, baseSession, ct);

                // Cập nhật lũy kế & quản lý vốn
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
