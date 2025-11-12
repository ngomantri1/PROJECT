using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using static XocDiaSoiLiveKH24.Tasks.TaskUtil;

namespace XocDiaSoiLiveKH24.Tasks
{
    /// <summary>
    /// 10) Ensemble majority: 5 "chuyên gia" bỏ phiếu:
    /// - Expert A: theo ván cuối
    /// - Expert B: đảo ván cuối
    /// - Expert C: run-length bias (T=3)
    /// - Expert D: state-transition bias (k=6)
    /// - Expert E: AI-stat (exact-match tần suất; hòa -> đảo; no-match -> theo ván cuối)
    /// Quyết định = bên có nhiều phiếu; nếu hoà (hiếm) -> đảo ván cuối.
    /// </summary>
    public sealed class EnsembleMajorityTask : IBetTask
    {
        public string DisplayName => "10) Chuyên gia bỏ phiếu";
        public string Id => "ensemble-majority";

        private const int RunLenT = 3;
        private const int TransK = 6;
        private const int AiK = 6;

        private static char Opp(char c) => c == 'C' ? 'L' : 'C';
        private static string ToSide(char c) => (c == 'C') ? "CHAN" : "LE";

        private static char ExpertA_FollowLast(string p) => p.Length == 0 ? 'C' : p[^1];
        private static char ExpertB_OppLast(string p) => p.Length == 0 ? 'L' : Opp(p[^1]);

        private static char ExpertC_RunLen(string p)
        {
            if (p.Length == 0) return 'C';
            char last = p[^1];
            int run = 1; for (int i = p.Length - 2; i >= 0 && p[i] == last; i--) run++;
            return (run >= RunLenT) ? Opp(last) : last;
        }

        private static char ExpertD_Trans(string p)
        {
            if (p.Length < 2) return p.Length == 0 ? 'C' : p[^1];
            int consider = Math.Min(TransK + 1, p.Length);
            int same = 0, flip = 0;
            for (int i = p.Length - consider + 1; i < p.Length; i++)
                if (p[i] == p[i - 1]) same++; else flip++;
            return (flip > same) ? Opp(p[^1]) : p[^1];
        }

        private static char ExpertE_Ai(string p)
        {
            // exact-match như AiStat: k từ AiK -> 1; đếm tần suất next; hòa->đảo; không có mẫu->theo cuối
            int n = p.Length; if (n <= 1) return n == 0 ? 'C' : p[^1];
            for (int k = Math.Min(AiK, n - 1); k >= 1; k--)
            {
                var tail = p.Substring(n - k, k);
                int c = 0, l = 0;
                for (int i = 0; i <= n - k - 1; i++)
                {
                    if (p.AsSpan(i, k).SequenceEqual(p.AsSpan(n - k, k)))
                    {
                        char next = p[i + k];
                        if (next == 'C') c++; else if (next == 'L') l++;
                    }
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

        private static char Decide(string parity)
        {
            char a = ExpertA_FollowLast(parity);
            char b = ExpertB_OppLast(parity);
            char c = ExpertC_RunLen(parity);
            char d = ExpertD_Trans(parity);
            char e = ExpertE_Ai(parity);

            int vc = (a == 'C' ? 1 : 0) + (b == 'C' ? 1 : 0) + (c == 'C' ? 1 : 0) + (d == 'C' ? 1 : 0) + (e == 'C' ? 1 : 0);
            int vl = 5 - vc;
            if (vc > vl) return 'C';
            if (vl > vc) return 'L';
            return parity.Length == 0 ? 'C' : Opp(parity[^1]); // tie safeguard
        }

        public async Task RunAsync(GameContext ctx, CancellationToken ct)
        {
            var money = new MoneyManager(ctx.StakeSeq, ctx.MoneyStrategyId);
            ctx.Log?.Invoke("[Ensemble] Start: experts=5");

            while (true)
            {
                ct.ThrowIfCancellationRequested();
                await WaitUntilNewRoundStart(ctx, ct);

                var snap = ctx.GetSnap();
                var parity = SeqToParityString(snap?.seq ?? "");

                char next = Decide(parity);
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
                string side = ToSide(next);
                ctx.Log?.Invoke($"[Ensemble] next={side}, stake={stake:N0}");

                await PlaceBet(ctx, side, stake, ct);
                bool win = await WaitRoundFinishAndJudge(ctx, side, snap?.seq ?? "", ct);
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
