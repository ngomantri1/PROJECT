using System;
using System.Threading;
using System.Threading.Tasks;
using static XocDiaLiveHit1.Tasks.TaskUtil;

namespace XocDiaLiveHit1.Tasks
{
    public sealed class SeqParityFollowTask : IBetTask
    {
        public string DisplayName => "1) Chuỗi C/L tự nhập";
        public string Id => "seq-parity";               // 1) Chuỗi C/L tự nhập

        public async Task RunAsync(GameContext ctx, CancellationToken ct)
        {
            var money = new MoneyManager(ctx.StakeSeq, ctx.MoneyStrategyId);
            var raw = (ctx.BetSeq ?? "").Trim().ToUpperInvariant().Replace(" ", "");
            if (string.IsNullOrEmpty(raw)) throw new InvalidOperationException("Chưa nhập CHUỖI CẦU (C/L).");

            // chỉ giữ C hoặc L
            char[] seq = Array.FindAll(raw.ToCharArray(), ch => ch == 'C' || ch == 'L');
            if (seq.Length == 0) throw new InvalidOperationException("CHUỖI CẦU không hợp lệ.");

            int k = 0;
            while (true)
            {
                ct.ThrowIfCancellationRequested();

                // chờ tới cửa đặt
                await WaitUntilNewRoundStart(ctx, ct);

                var snap = ctx.GetSnap();
                string baseSeq = snap?.seq ?? string.Empty;

                string side = ParityCharToSide(seq[k]);
                var stake = money.GetStakeForThisBet();
                await PlaceBet(ctx, side, stake, ct);

                bool win = await WaitRoundFinishAndJudge(ctx, side, baseSeq, ct);
                await ctx.UiDispatcher.InvokeAsync(() => ctx.UiAddWin?.Invoke(win ? stake : -stake));
                money.OnRoundResult(win);

                // quay chuỗi
                k = (k + 1) % seq.Length;
            }
        }
    }
}
