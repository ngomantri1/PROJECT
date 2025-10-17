﻿using System.Threading;
using System.Threading.Tasks;
using static XocDiaLiveHit.Tasks.TaskUtil;

namespace XocDiaLiveHit.Tasks
{
    /// <summary>
    /// 13) Lịch hai lớp (10 tay):
    /// 1–3: theo-last; 4: đảo; 5–7: AI-Stat; 8: đảo; 9: theo-last; 10: AI-Stat.
    /// Mục tiêu: trộn 3 vị thế khác nhau trong 1 block.
    /// </summary>
    public sealed class DualScheduleHedgeTask : IBetTask
    {
        public string DisplayName => "13) Lịch hai lớp";
        public string Id => "dual-schedule-hedge";

        private int _roundInBlock = 0;

        private static char Opp(char c) => c == 'C' ? 'L' : 'C';
        private static string ToSide(char c) => (c == 'C') ? "CHAN" : "LE";

        // Mini predictor (giống bản AiStat rút gọn: exact-match; hòa->đảo; no-match->theo cuối)
        private static char AiStatMini(string p, int kmax = 6)
        {
            int n = p.Length; if (n <= 1) return n == 0 ? 'C' : p[^1];
            for (int k = System.Math.Min(kmax, n - 1); k >= 1; k--)
            {
                int c = 0, l = 0;
                for (int i = 0; i <= n - k - 1; i++)
                    if (p.AsSpan(i, k).SequenceEqual(p.AsSpan(n - k, k)))
                    {
                        char next = p[i + k];
                        if (next == 'C') c++; else if (next == 'L') l++;
                    }
                if (c + l > 0)
                {
                    if (c > l) return 'C';
                    if (l > c) return 'L';
                    return Opp(p[^1]); // hòa
                }
            }
            return p[^1]; // không có mẫu
        }

        private char Decide(string parity)
        {
            char last = parity.Length == 0 ? 'C' : parity[^1];
            int i = _roundInBlock % 10; // 0..9

            if (i <= 2) return last;            // 1..3
            if (i == 3) return Opp(last);       // 4
            if (i >= 4 && i <= 6) return AiStatMini(parity); // 5..7
            if (i == 7) return Opp(last);       // 8
            if (i == 8) return last;            // 9
            return AiStatMini(parity);          // 10
        }

        public async Task RunAsync(GameContext ctx, CancellationToken ct)
        {
            var money = new MoneyManager(ctx.StakeSeq, ctx.MoneyStrategyId);
            ctx.Log?.Invoke("[DualSched] Start: 10-step mixed schedule");

            while (true)
            {
                ct.ThrowIfCancellationRequested();
                await WaitUntilNewRoundStart(ctx, ct);

                var snap = ctx.GetSnap();
                var parity = SeqToParityString(snap?.seq ?? "");

                char next = Decide(parity);
                var stake = money.GetStakeForThisBet();
                string side = ToSide(next);
                ctx.Log?.Invoke($"[DualSched] r={_roundInBlock % 10 + 1}/10 next={side}, stake={stake:N0}");

                await PlaceBet(ctx, side, stake, ct);
                bool win = await WaitRoundFinishAndJudge(ctx, side, snap?.seq ?? "", ct);
                await ctx.UiDispatcher.InvokeAsync(() => ctx.UiAddWin?.Invoke(win ? stake : -stake));
                money.OnRoundResult(win);

                _roundInBlock = (_roundInBlock + 1) % 10;
            }
        }
    }
}
