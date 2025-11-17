using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using static XocDiaLiveHit2.Tasks.TaskUtil;

namespace XocDiaLiveHit2.Tasks
{
    public sealed class PatternParityTask : IBetTask
    {
        public string DisplayName => "2) Thế cầu C/L tự nhập";
        public string Id => "pattern-cl";           // 2) Thế cầu C/L tự nhập

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
                    string a = new string(kv[0].Where(c => c == 'C' || c == 'L').ToArray());
                    string b = new string(kv[1].Where(c => c == 'C' || c == 'L').ToArray());
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
            if (patterns.Count == 0) throw new InvalidOperationException("Chưa nhập CÁC THẾ CẦU (dạng CLL-LLC;LL-L;...)");

            var planned = new Queue<char>(); // hàng đợi các lệnh 'C'/'L' cần đánh
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

                string baseSeq = snap?.seq ?? string.Empty;
                char plan = planned.Dequeue();
                string side = ParityCharToSide(plan);
                var stake = money.GetStakeForThisBet();
                await PlaceBet(ctx, side, stake, ct);

                bool win = await WaitRoundFinishAndJudge(ctx, side, baseSeq, ct);
                await ctx.UiDispatcher.InvokeAsync(() => ctx.UiAddWin?.Invoke(win ? stake : -stake));
                money.OnRoundResult(win);

                lastSeqLen = ctx.GetSnap()?.seq?.Length ?? lastSeqLen;
            }
        }
    }
}
