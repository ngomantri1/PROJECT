using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using static BaccaratPPRR88.Tasks.TaskUtil;

namespace BaccaratPPRR88.Tasks
{
    /// <summary>
    /// 16) Theo chuỗi Top10 từ cửa sổ 50 phiên (P/B)
    /// - KHÔNG CHỜ tích lũy: 50 P/B đã có sẵn khi load → build đếm ban đầu ngay.
    /// - Quét ban đầu: lấy các đoạn độ dài 10 theo thứ tự (50..41), (49..40), ..., (10..1).
    ///   Nếu đã có trong list thì +1, chưa có thì thêm với count=1. (Ưu tiên độ tươi bằng lastTick)
    /// - Sau mỗi KẾT QUẢ (chuỗi 50 đổi — trượt sang phải), lấy “10 phiên mới về” (41..50) để +1.
    /// - Mỗi lần cược: đánh theo CHUỖI có count lớn nhất (hòa → chọn chuỗi mới nhất).
    /// - Khi THẮNG: được phép CHUYỂN sang chuỗi mới nếu count(new) >= count(current).
    /// - Quản lý vốn: MoneyManager như các task khác; vào cửa theo DecisionPercent.
    /// </summary>
    public sealed class Top10PatternFollowTask : IBetTask
    {
        public string DisplayName => "16) Top10 tích lũy (khởi từ 50 P/B)";
        public string Id => "top10-50-cl";

        private const int WindowLen = 10;
        private const int FrameLen = 50; // cửa sổ 50 phiên gần nhất

        // key: chuỗi 10 ký tự 'C'/'L'
        // value: (count, lastTick) → tie-break theo độ tươi (tick lớn hơn = mới hơn)
        private static (int count, long lastTick) GetOrDefault(Dictionary<string, (int, long)> dict, string k)
            => dict.TryGetValue(k, out var v) ? v : (0, 0);

        private static string TakeLast50CL(string cl)
        {
            if (string.IsNullOrEmpty(cl)) return "";
            return (cl.Length <= FrameLen) ? cl : cl.Substring(cl.Length - FrameLen, FrameLen);
        }

        /// <summary>
        /// Quét khởi tạo theo thứ tự yêu cầu:
        /// (50..41) → (49..40) → ... → (10..1)
        /// Với chuỗi cl50 theo thứ tự cũ→mới, thì (50..41) chính là Substring(40,10), sau đó start 39, 38, ... đến 0.
        /// </summary>
        private static void BuildInitialCounts(string cl50, Dictionary<string, (int count, long lastTick)> counts, ref long tick)
        {
            if (cl50.Length < FrameLen) return; // an toàn nếu dữ liệu đầu vào ngắn hơn (dù ông chủ nói luôn đủ 50)
            for (int start = FrameLen - WindowLen; start >= 0; start--) // 40 → 0
            {
                string seg = cl50.Substring(start, WindowLen);
                var cur = GetOrDefault(counts, seg);
                counts[seg] = (cur.count + 1, ++tick); // ++tick để mẫu xử lý trước (mới hơn) có tick lớn hơn
            }
        }

        /// <summary>+1 cho “10 phiên mới về” (41..50) của cl50 hiện tại.</summary>
        private static void AddRightmost10(string cl50, Dictionary<string, (int count, long lastTick)> counts, ref long tick)
        {
            if (cl50.Length < FrameLen) return;
            string seg = cl50.Substring(FrameLen - WindowLen, WindowLen); // 41..50
            var cur = GetOrDefault(counts, seg);
            counts[seg] = (cur.count + 1, ++tick);
        }

        private static (string pattern, int count) PickBest(Dictionary<string, (int count, long lastTick)> counts)
        {
            if (counts.Count == 0) return ("", 0);

            // 1) Max count
            int max = counts.Values.Max(v => v.count);

            // 2) Tie-break: lastTick lớn nhất (mẫu xuất hiện “tươi” hơn)
            var best = counts
                .Where(kv => kv.Value.count == max)
                .OrderBy(kv => kv.Value.lastTick) // tăng dần
                .Last(); // lấy cái mới nhất

            return (best.Key, best.Value.count);
        }

        public async Task RunAsync(GameContext ctx, CancellationToken ct)
        {
            var money = new MoneyManager(ctx.StakeSeq, ctx.MoneyStrategyId);
            ctx.Log?.Invoke("[Top10-50] Khởi chạy (không chờ — dùng 50 P/B sẵn có)…");

            // === KHỞI TẠO NGAY từ 50 P/B sẵn có ===
            var counts = new Dictionary<string, (int count, long lastTick)>(StringComparer.Ordinal);
            long tick = 0;

            var snap0 = ctx.GetSnap?.Invoke();
            string clAll0 = SeqToParityString(snap0?.seq ?? "");
            string cl50 = TakeLast50CL(clAll0);

            // Ông chủ nói luôn có sẵn 50 → không chờ; nhưng vẫn an toàn nếu ngắn hơn.
            if (cl50.Length >= FrameLen)
            {
                BuildInitialCounts(cl50, counts, ref tick);
            }
            else
            {
                // fallback an toàn nếu dữ liệu ít hơn 50 (hiếm khi xảy ra)
                int len = cl50.Length;
                for (int start = Math.Max(0, len - WindowLen); start >= 0; start--)
                {
                    string seg = cl50.Substring(start, Math.Min(WindowLen, len - start));
                    if (seg.Length == WindowLen)
                    {
                        var cur = GetOrDefault(counts, seg);
                        counts[seg] = (cur.count + 1, ++tick);
                    }
                }
            }

            string lastSeenCl50 = cl50;

            // Chọn chuỗi đang đánh = chuỗi có count lớn nhất (tie → mới nhất)
            var (curPattern, curCount) = PickBest(counts);
            int curIdx = 0; // vị trí trong chuỗi 10 (0..9)

            ctx.Log?.Invoke($"[Top10-50] Init: best='{curPattern}', count={curCount}");

            while (true)
            {
                ct.ThrowIfCancellationRequested();

                // Vào cửa theo ngưỡng DecisionPercent
                await WaitUntilNewRoundStart(ctx, ct);

                var snap = ctx.GetSnap?.Invoke();
                string baseSeq = snap?.seq ?? string.Empty;
                string baseSession = snap?.session ?? string.Empty;

                // Nếu chưa có best (đề phòng), pick lại
                if (string.IsNullOrEmpty(curPattern))
                {
                    (curPattern, curCount) = PickBest(counts);
                    curIdx = 0;

                    if (string.IsNullOrEmpty(curPattern))
                    {
                        // fallback an toàn: theo ván gần nhất
                        char lastCl = SeqToParityString(baseSeq).LastOrDefault();
                        string fallbackSide = (lastCl == 'C') ? "CHAN" : "LE";
                        var stake0 = money.GetStakeForThisBet();
                        await PlaceBet(ctx, fallbackSide, stake0, ct);

                        bool win0 = await WaitRoundFinishAndJudge(ctx, fallbackSide, baseSession, ct);
                        await ctx.UiDispatcher.InvokeAsync(() => ctx.UiAddWin?.Invoke(win0 ? stake0 : -stake0));
                        money.OnRoundResult(win0);

                        // Cập nhật lại list 10 mới về
                        var s2 = ctx.GetSnap?.Invoke();
                        string clAll2 = SeqToParityString(s2?.seq ?? "");
                        string cl50_2 = TakeLast50CL(clAll2);
                        if (!string.Equals(cl50_2, lastSeenCl50, StringComparison.Ordinal))
                        {
                            AddRightmost10(cl50_2, counts, ref tick);
                            lastSeenCl50 = cl50_2;
                        }
                        continue;
                    }
                }

                // Đặt theo ký tự hiện tại của "chuỗi top" (P/B)
                char ch = curPattern[curIdx];
                string side = ParityCharToSide(ch);
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

                ctx.Log?.Invoke($"[Top10-50] bet={side} (pat='{curPattern}', pos={curIdx + 1}/10, count={curCount})");
                await PlaceBet(ctx, side, stake, ct);

                // Chờ KẾT QUẢ: WaitRoundFinishAndJudge so sánh phiên
                bool win = await WaitRoundFinishAndJudge(ctx, side, baseSession, ct);
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

                // Sau khi có kết quả: cập nhật CL50 & +1 cho "10 mới về" (41..50)
                var sAfter = ctx.GetSnap?.Invoke();
                string clAll = SeqToParityString(sAfter?.seq ?? "");
                string cl50_now = TakeLast50CL(clAll);
                if (!string.Equals(cl50_now, lastSeenCl50, StringComparison.Ordinal))
                {
                    AddRightmost10(cl50_now, counts, ref tick);
                    lastSeenCl50 = cl50_now;
                }

                // Nếu THẮNG → được chuyển chuỗi mới nếu count(new) >= count(current)
                bool switched = false;
                if (win)
                {
                    var (bestPat, bestCnt) = PickBest(counts);
                    if (!string.IsNullOrEmpty(bestPat) && (bestCnt >= curCount) && bestPat != curPattern)
                    {
                        ctx.Log?.Invoke($"[Top10-50] WIN → chuyển chuỗi: '{curPattern}'({curCount}) → '{bestPat}'({bestCnt})");
                        curPattern = bestPat;
                        curCount = bestCnt;
                        curIdx = 0;      // reset về vị trí 1 của chuỗi mới
                        switched = true; // đánh dấu vừa chuyển để KHÔNG tăng bước
                    }
                }

                // Nếu vừa chuyển chuỗi → bỏ increment để vòng sau đánh pos=1/10
                if (switched)
                    continue;

                // Không chuyển thì mới tăng vị trí trong chuỗi hiện tại
                curIdx = (curIdx + 1) % WindowLen;
            }
        }
    }
}
