using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using static TaiXiuLiveHit.Tasks.TaskUtil;

namespace TaiXiuLiveHit.Tasks
{
    public sealed class PatternParityTask : IBetTask
    {
        public string DisplayName => "2) Thế cầu T/X tự nhập";
        public string Id => "pattern-cl";           // 2) Thế cầu T/X tự nhập

        private static List<(string lhs, string rhs)> Parse(string s)
        {
            var items = new List<(string lhs, string rhs)>();
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
                    string a = new string(kv[0].Where(tx => tx == 'T' || tx == 'X').ToArray());
                    string b = new string(kv[1].Where(tx => tx == 'T' || tx == 'X').ToArray());
                    if (a.Length > 0 && b.Length > 0) items.Add((a, b));
                }
            }
            // duyệt pattern dài trước
            return items.OrderByDescending(x => x.Item1.Length).ToList();
        }

        public async Task RunAsync(GameContext ctx, CancellationToken ct)
        {
            var money = new MoneyManager(ctx.StakeSeq, ctx.MoneyStrategyId);
            var patterns = Parse(ctx.BetPatterns);
            if (patterns.Count == 0) throw new InvalidOperationException("Chưa nhập CÁC THẾ CẦU (dạng TXX-XXT;XX-X;...)");

            var planned = new Queue<char>(); // hàng đợi các lệnh 'T'/'X' cần đánh
            int lastSeqLen = ctx.GetSnap()?.seq?.Length ?? 0;

            while (true)
            {
                ct.ThrowIfCancellationRequested();
                var snap = ctx.GetSnap();
                var parity = SeqToParityString(snap?.seq ?? "");

                // nếu không còn kế hoạch → dò pattern
                if (planned.Count == 0)
                {
                    foreach (var kv in patterns)
                    {
                        var lhs = kv.Item1; var rhs = kv.Item2;
                        if (parity.EndsWith(lhs))
                        {
                            foreach (var ch in rhs) planned.Enqueue(ch);
                            break;
                        }
                    }

                }

                if (planned.Count == 0)
                {
                    // không khớp thế cầu nào → bỏ qua ván này
                    await Task.Delay(150, ct);
                    // cập nhật chốt ván khi có kết quả mới
                    var len = ctx.GetSnap()?.seq?.Length ?? 0;
                    if (len > lastSeqLen) lastSeqLen = len;
                    continue;
                }

                // có plan → chờ đến lúc vào tiền
                await WaitUntilNewRoundStart(ctx, ct);

                var snapNow = ctx.GetSnap();
                string baseSession = snapNow?.session ?? string.Empty;
                char plan = planned.Dequeue();
                string side = ParityCharToSide(plan);
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

                lastSeqLen = ctx.GetSnap()?.seq?.Length ?? lastSeqLen;
            }
        }
    }
}
