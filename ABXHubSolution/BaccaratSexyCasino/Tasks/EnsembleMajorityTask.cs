using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using static BaccaratSexyCasino.Tasks.TaskUtil;

namespace BaccaratSexyCasino.Tasks
{
    /// <summary>
    /// 10) Chuyên gia bỏ phiếu:
    /// - 5 expert luôn dự đoán mỗi ván
    /// - Chấm điểm theo rolling 10 ván gần nhất của từng expert
    /// - Weighted vote theo base weight * performance weight * regime weight
    /// - Vẫn đánh liên tục từng ván, không bỏ kèo
    /// </summary>
    public sealed class EnsembleMajorityTask : IBetTask
    {
        public string DisplayName => "10) Chuyên gia bỏ phiếu";
        public string Id => "ensemble-majority";

        private const int RunLenT = 3;
        private const int TransK = 6;
        private const int AiK = 6;
        private const int PerfWindow = 10;
        private const int PerfWarmup = 5;
        private const double VoteTieThreshold = 0.20;

        private static char Opp(char c) => c == 'B' ? 'P' : 'B';
        private static string ToSide(char c) => c == 'B' ? "BANKER" : "PLAYER";

        private sealed class ExpertTracker
        {
            public string Name { get; }
            public double BaseWeight { get; }
            public Func<string, char> Predictor { get; }
            private readonly Queue<int> _recent = new();

            public ExpertTracker(string name, double baseWeight, Func<string, char> predictor)
            {
                Name = name;
                BaseWeight = baseWeight;
                Predictor = predictor;
            }

            public int Score => _recent.Sum();
            public int Count => _recent.Count;

            public void Push(bool correct)
            {
                _recent.Enqueue(correct ? 1 : 0);
                while (_recent.Count > PerfWindow)
                    _recent.Dequeue();
            }
        }

        private sealed class ExpertDecision
        {
            public ExpertTracker Expert { get; init; } = null!;
            public char Pick { get; init; }
            public int Score { get; init; }
            public int Count { get; init; }
            public double PerfWeight { get; init; }
            public double RegimeWeight { get; init; }
            public double FinalWeight { get; init; }
        }

        private sealed class DecisionBundle
        {
            public string Regime { get; init; } = "NEUTRAL";
            public double FlipRate { get; init; }
            public double VoteB { get; init; }
            public double VoteP { get; init; }
            public char Next { get; init; }
            public bool WasTieBreak { get; init; }
            public IReadOnlyList<ExpertDecision> Experts { get; init; } = Array.Empty<ExpertDecision>();
        }

        private static char ExpertA_FollowLast(string p) => p.Length == 0 ? 'B' : p[^1];
        private static char ExpertB_OppLast(string p) => p.Length == 0 ? 'P' : Opp(p[^1]);

        private static char ExpertC_RunLen(string p)
        {
            if (p.Length == 0) return 'B';
            char last = p[^1];
            int run = 1;
            for (int i = p.Length - 2; i >= 0 && p[i] == last; i--) run++;
            return run >= RunLenT ? Opp(last) : last;
        }

        private static char ExpertD_Trans(string p)
        {
            if (p.Length < 2) return p.Length == 0 ? 'B' : p[^1];
            int consider = Math.Min(TransK + 1, p.Length);
            int same = 0, flip = 0;
            for (int i = p.Length - consider + 1; i < p.Length; i++)
            {
                if (p[i] == p[i - 1]) same++;
                else flip++;
            }
            return flip > same ? Opp(p[^1]) : p[^1];
        }

        private static char ExpertE_Ai(string p)
        {
            int n = p.Length;
            if (n <= 1) return n == 0 ? 'B' : p[^1];

            for (int k = Math.Min(AiK, n - 1); k >= 1; k--)
            {
                var tail = p.Substring(n - k, k);
                int b = 0, c = 0;
                for (int i = 0; i <= n - k - 1; i++)
                {
                    if (!p.AsSpan(i, k).SequenceEqual(tail.AsSpan()))
                        continue;

                    char next = p[i + k];
                    if (next == 'B') b++;
                    else if (next == 'P') c++;
                }

                int total = b + c;
                if (total < 3)
                    continue;
                if (b > c) return 'B';
                if (c > b) return 'P';
                return Opp(p[^1]);
            }

            return p[^1];
        }

        private static string NormalizeBpHistory(string? rawSeq)
        {
            if (string.IsNullOrWhiteSpace(rawSeq)) return "";
            var sb = new StringBuilder(rawSeq.Length);
            foreach (char ch in rawSeq)
            {
                char u = char.ToUpperInvariant(ch);
                if (u == 'B' || u == 'P')
                    sb.Append(u);
            }
            return sb.ToString();
        }

        private static char? GetLastResultChar(string? rawSeq)
        {
            if (string.IsNullOrWhiteSpace(rawSeq)) return null;
            for (int i = rawSeq.Length - 1; i >= 0; i--)
            {
                char u = char.ToUpperInvariant(rawSeq[i]);
                if (u == 'B' || u == 'P' || u == 'T')
                    return u;
            }
            return null;
        }

        private static (string regime, double flipRate) DetectRegime(string history)
        {
            int n = Math.Min(10, history.Length);
            if (n < 4) return ("NEUTRAL", 0.5);

            string recent = history.Substring(history.Length - n, n);
            int flips = 0;
            for (int i = 1; i < recent.Length; i++)
            {
                if (recent[i] != recent[i - 1])
                    flips++;
            }

            double flipRate = recent.Length > 1 ? flips / (double)(recent.Length - 1) : 0;
            if (flipRate >= 0.67) return ("CHOP", flipRate);
            if (flipRate <= 0.33) return ("TREND", flipRate);
            return ("NEUTRAL", flipRate);
        }

        private static double Clamp(double min, double value, double max)
            => Math.Max(min, Math.Min(max, value));

        private static double GetPerfWeight(ExpertTracker tracker)
        {
            if (tracker.Count < PerfWarmup)
                return 1.0;

            double baseline = tracker.Count / 2.0;
            return Clamp(0.40, 1.0 + (tracker.Score - baseline) * 0.18, 1.90);
        }

        private static double GetRegimeWeight(string regime, string expertName)
        {
            return regime switch
            {
                "TREND" => expertName switch
                {
                    "RunLength" => 1.25,
                    "FollowLast" => 1.25,
                    "Transition" => 0.85,
                    "OppLast" => 0.75,
                    _ => 1.00
                },
                "CHOP" => expertName switch
                {
                    "Transition" => 1.25,
                    "OppLast" => 1.25,
                    "RunLength" => 0.80,
                    "FollowLast" => 0.75,
                    _ => 1.00
                },
                _ => 1.00
            };
        }

        private static char ResolveTieBreak(
            string regime,
            string history,
            IReadOnlyList<ExpertDecision> decisions)
        {
            var exact = decisions.FirstOrDefault(x => string.Equals(x.Expert.Name, "ExactMatch", StringComparison.Ordinal));
            if (exact != null)
                return exact.Pick;

            var best = decisions
                .OrderByDescending(x => x.Score)
                .ThenByDescending(x => x.FinalWeight)
                .FirstOrDefault();
            if (best != null)
                return best.Pick;

            return regime switch
            {
                "TREND" => ExpertA_FollowLast(history),
                "CHOP" => ExpertB_OppLast(history),
                _ => history.Length == 0 ? 'B' : history[^1]
            };
        }

        private static DecisionBundle Decide(string history, IReadOnlyList<ExpertTracker> experts)
        {
            var (regime, flipRate) = DetectRegime(history);
            var decisions = new List<ExpertDecision>(experts.Count);
            double voteB = 0, voteP = 0;

            foreach (var expert in experts)
            {
                char pick = expert.Predictor(history);
                int score = expert.Score;
                int count = expert.Count;
                double perfWeight = GetPerfWeight(expert);
                double regimeWeight = GetRegimeWeight(regime, expert.Name);
                double finalWeight = expert.BaseWeight * perfWeight * regimeWeight;

                var decision = new ExpertDecision
                {
                    Expert = expert,
                    Pick = pick,
                    Score = score,
                    Count = count,
                    PerfWeight = perfWeight,
                    RegimeWeight = regimeWeight,
                    FinalWeight = finalWeight
                };
                decisions.Add(decision);

                if (pick == 'B') voteB += finalWeight;
                else voteP += finalWeight;
            }

            bool tieBreak = Math.Abs(voteB - voteP) < VoteTieThreshold;
            char next = tieBreak
                ? ResolveTieBreak(regime, history, decisions)
                : (voteB > voteP ? 'B' : 'P');

            return new DecisionBundle
            {
                Regime = regime,
                FlipRate = flipRate,
                VoteB = voteB,
                VoteP = voteP,
                Next = next,
                WasTieBreak = tieBreak,
                Experts = decisions
            };
        }

        private static string BuildDecisionLog(DecisionBundle bundle)
        {
            var sb = new StringBuilder();
            sb.Append("[Ensemble] regime=")
              .Append(bundle.Regime)
              .Append(" flip=")
              .Append(bundle.FlipRate.ToString("0.00"))
              .Append(" voteB=")
              .Append(bundle.VoteB.ToString("0.00"))
              .Append(" voteP=")
              .Append(bundle.VoteP.ToString("0.00"))
              .Append(" next=")
              .Append(ToSide(bundle.Next));
            if (bundle.WasTieBreak)
                sb.Append(" tieBreak=1");

            foreach (var d in bundle.Experts)
            {
                sb.Append(" | ")
                  .Append(d.Expert.Name)
                  .Append(':')
                  .Append(d.Pick)
                  .Append(" s=")
                  .Append(d.Score)
                  .Append('/')
                  .Append(d.Count)
                  .Append(" w=")
                  .Append(d.FinalWeight.ToString("0.00"));
            }

            return sb.ToString();
        }

        public async Task RunAsync(GameContext ctx, CancellationToken ct)
        {
            var money = new MoneyManager(ctx.StakeSeq, ctx.MoneyStrategyId);
            var experts = new List<ExpertTracker>
            {
                new("ExactMatch", 1.30, ExpertE_Ai),
                new("Transition", 1.05, ExpertD_Trans),
                new("RunLength", 1.00, ExpertC_RunLen),
                new("FollowLast", 0.90, ExpertA_FollowLast),
                new("OppLast", 0.90, ExpertB_OppLast),
            };

            ctx.Log?.Invoke("[Ensemble] Start: experts=5, perfWindow=10, weighted=1");

            while (true)
            {
                ct.ThrowIfCancellationRequested();
                await WaitUntilNewRoundStart(ctx, ct);

                var snap = ctx.GetRawSnap?.Invoke() ?? ctx.GetSnap();
                var rawSeqBefore = snap?.seq ?? "";
                var history = NormalizeBpHistory(rawSeqBefore);
                var bundle = Decide(history, experts);
                ctx.Log?.Invoke(BuildDecisionLog(bundle));

                long stake;
                if (ctx.MoneyStrategyId == "MultiChain")
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

                string side = ToSide(bundle.Next);
                ctx.Log?.Invoke($"[Ensemble] next={side}, stake={stake:N0}");

                await PlaceBet(ctx, side, stake, ct);
                bool? win = await WaitRoundFinishAndJudge(ctx, side, rawSeqBefore, ct);

                var snapAfter = ctx.GetRawSnap?.Invoke() ?? ctx.GetSnap();
                var actualResult = GetLastResultChar(snapAfter?.seq);
                if (actualResult == 'B' || actualResult == 'P')
                {
                    foreach (var d in bundle.Experts)
                        d.Expert.Push(d.Pick == actualResult.Value);
                }
                else
                {
                    ctx.Log?.Invoke("[Ensemble] score-update skipped: actual=TIE");
                }

                var netDelta = CalcNetDelta(side, stake, win);
                await ctx.UiDispatcher.InvokeAsync(() => ctx.UiAddWin?.Invoke(netDelta));
                if (ctx.MoneyStrategyId == "MultiChain")
                {
                    int chainIndex = ctx.MoneyChainIndex;
                    int chainStep = ctx.MoneyChainStep;
                    double chainProfit = ctx.MoneyChainProfit;

                    MoneyHelper.UpdateAfterRoundMultiChain(
                        ctx.StakeChains,
                        ctx.StakeChainTotals,
                        ref chainIndex,
                        ref chainStep,
                        ref chainProfit,
                        win,
                        netDelta);

                    ctx.MoneyChainIndex = chainIndex;
                    ctx.MoneyChainStep = chainStep;
                    ctx.MoneyChainProfit = chainProfit;
                }
                else
                {
                    money.OnRoundResult(win);
                }
            }
        }
    }
}
