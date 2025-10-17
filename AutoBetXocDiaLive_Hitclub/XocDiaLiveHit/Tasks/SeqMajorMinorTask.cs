using System;
using System.Threading;
using System.Threading.Tasks;

namespace XocDiaLiveHit.Tasks
{
    public sealed class SeqMajorMinorTask : IBetTask
    {
        public string DisplayName => "3) Chuỗi N/I tự nhập";
        public string Id => "seq-ni";               // 3) Chuỗi N/I tự nhập

        private static string PickSideByNI(char ni, XocDiaLiveHit.CwTotals t)
        {
            // N = đánh cửa có tổng tiền NHIỀU hơn; I = đánh cửa có tổng tiền ÍT hơn
            long c = t?.C ?? 0, l = t?.L ?? 0;
            if (ni == 'N') return (c >= l) ? "CHAN" : "LE";
            return (c < l) ? "CHAN" : "LE";
        }

        public async Task RunAsync(GameContext ctx, CancellationToken ct)
        {
            var money = new MoneyManager(ctx.StakeSeq, ctx.MoneyStrategyId);
            var raw = (ctx.BetSeq ?? "").Trim().ToUpperInvariant().Replace(" ", "");
            char[] seq = Array.FindAll(raw.ToCharArray(), ch => ch == 'N' || ch == 'I');
            if (seq.Length == 0) throw new InvalidOperationException("Chuỗi N/I không hợp lệ.");

            int k = 0;
            while (true)
            {
                ct.ThrowIfCancellationRequested();
                await Task.Delay(60, ct);

                await TaskUtil.WaitUntilBetWindow(ctx, ct);

                var snap = ctx.GetSnap();
                string baseSeq = snap?.seq ?? string.Empty;

                string side = PickSideByNI(seq[k], snap?.totals);
                var stake = money.GetStakeForThisBet();
                await TaskUtil.PlaceBet(ctx, side, stake, ct);

                bool win = await TaskUtil.WaitRoundFinishAndJudge(ctx, side, baseSeq, ct);
                await ctx.UiDispatcher.InvokeAsync(() => ctx.UiAddWin?.Invoke(win ? stake : -stake));
                money.OnRoundResult(win);

                k = (k + 1) % seq.Length;
            }
        }
    }
}
