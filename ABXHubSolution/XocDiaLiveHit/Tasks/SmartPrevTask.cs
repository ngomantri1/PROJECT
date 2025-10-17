﻿using System;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Input;
using static XocDiaLiveHit.Tasks.TaskUtil;

namespace XocDiaLiveHit.Tasks
{
    public sealed class SmartPrevTask : IBetTask
    {
        public string DisplayName => "5) Theo cầu trước thông minh";
        public string Id => "smart-prev";           // 5) Theo cầu trước thông minh

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
            if (parity.Length == 0) return "CHAN"; // mặc định
            char lastParity = parity[^1];          // 'C' hoặc 'L'
            var (seg1, _, seg3) = SplitSegments(parity);

            // Theo yêu cầu của bạn:
            // - seg1 == seg3 → ĐÁNH NGƯỢC kết quả vừa về
            // - seg1 < seg3  → ĐÁNH GIỐNG kết quả vừa về
            // - seg1 > seg3  → ĐÁNH GIỐNG kết quả vừa về
            bool sameAsLast = (seg1 != seg3);
            char pick = sameAsLast ? lastParity : (lastParity == 'C' ? 'L' : 'C');
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
                string baseSeq = snap?.seq ?? string.Empty;

                string side = DecideNextSide(parity);
                var stake = money.GetStakeForThisBet();
                await PlaceBet(ctx, side, stake, ct);

                bool win = await WaitRoundFinishAndJudge(ctx, side, baseSeq, ct);
                await ctx.UiDispatcher.InvokeAsync(() => ctx.UiAddWin?.Invoke(win ? stake : -stake));
                money.OnRoundResult(win);
            }
        }
    }
}
