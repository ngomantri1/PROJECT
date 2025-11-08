using System;
using System.Threading;
using System.Threading.Tasks;
using static XocDiaSoiLiveKH24.Tasks.TaskUtil;

namespace XocDiaSoiLiveKH24.Tasks
{
    /// <summary>
    /// 9) Run-length bias:
    /// - Nếu run hiện tại (độ dài chuỗi cùng ký tự cuối) >= T --> ĐÁNH NGƯỢC (mean-revert)
    /// - Ngược lại --> THEO ván cuối (momentum)
    /// </summary>
    public sealed class RunLengthBiasTask : IBetTask
    {
        public string DisplayName => "9) Run-length (dài-chuỗi)";
        public string Id => "run-length-bias";

        private const int T = 3; // ngưỡng run-length

        private static char Opp(char c) => c == 'C' ? 'L' : 'C';
        private static string ToSide(char c) => (c == 'C') ? "CHAN" : "LE";

        private static char DecideNext(string parity)
        {
            if (string.IsNullOrEmpty(parity)) return 'C';
            char last = parity[^1];
            // đếm run-length của last từ cuối ngược về
            int run = 1;
            for (int i = parity.Length - 2; i >= 0 && parity[i] == last; i--) run++;
            return (run >= T) ? Opp(last) : last;
        }

        public async Task RunAsync(GameContext ctx, CancellationToken ct)
        {
            var money = new MoneyManager(ctx.StakeSeq, ctx.MoneyStrategyId);
            ctx.Log?.Invoke($"[RunLen] Start: T={T}");

            while (true)
            {
                ct.ThrowIfCancellationRequested();
                await WaitUntilNewRoundStart(ctx, ct);

                var snap = ctx.GetSnap();
                var parity = SeqToParityString(snap?.seq ?? "");

                char next = DecideNext(parity);
                var stake = money.GetStakeForThisBet();
                string side = ToSide(next);
                ctx.Log?.Invoke($"[RunLen] next={side}, stake={stake:N0}");

                await PlaceBet(ctx, side, stake, ct);
                bool win = await WaitRoundFinishAndJudge(ctx, side, snap?.seq ?? "", ct);
                await ctx.UiDispatcher.InvokeAsync(() => ctx.UiAddWin?.Invoke(win ? stake : -stake));
                money.OnRoundResult(win);
            }
        }
    }
}
