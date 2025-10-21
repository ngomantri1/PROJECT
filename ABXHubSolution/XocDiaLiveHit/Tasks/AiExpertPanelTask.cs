// AiExpertPanelTask.cs
// GPT-5 Thinking — trợ lý ảo Siri
// Sử dụng GameContext (không dùng IGameHostContext).
// Logic: Loss-Guard động, Hard-guard tự điều chỉnh (thận trọng), Top10 có điều kiện,
// Beauty Bias (bắt sớm 2 nhịp: bệt>=2, zigzag>=4), fallback theo Regime,
// ưu tiên “ăn trend” khi guard ON, re-seed mỗi ván,
// log REG/w20/w50/dynTrig/LG/LOCK/Metrics + BEAUTY-OVERRIDE.
// Cấu hình ở %LOCALAPPDATA%\XocDiaLiveHit\a15\ai15.config.json

using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using static XocDiaLiveHit.Tasks.TaskUtil;

namespace XocDiaLiveHit.Tasks
{
    public sealed class AiExpertPanelTask : IBetTask
    {
        public string Id => "ai15.expert.panel";
        public string DisplayName => "14) AI Expert Panel (Top10, Guard, Regime)";

        // ======================= Config & Tunables ====================
        private sealed class Ai15Config
        {
            public int WarmSeedMax { get; set; } = 50;
            public double EwmaAlpha { get; set; } = 0.30;

            // Guard
            public int BaseLossGuardTrigger { get; set; } = 4;      // Loss-Guard mặc định bật khi L>=4 (động hạ 3 khi thị trường lộn xộn)
            public int HardGuardOnLoseStreak { get; set; } = 5;     // Hard-guard bật khi L>=5
            public int HardGuardReleaseWins { get; set; } = 2;      // gỡ hard-guard khi thắng liên tiếp 2 ván
            public double HardGuardReleaseW20 { get; set; } = 0.55; // hoặc khi w20 > 55%

            // Voting
            public double VoteMinConf { get; set; } = 0.60;         // ngưỡng conf tối thiểu ở chế độ thường
            public bool RandomOnTie { get; set; } = true;           // 5–5 thì random

            // Beauty Bias (ưu tiên cầu đẹp — “bắt sớm 2 nhịp”)
            public bool BeautyPrefEnabled { get; set; } = true;
            public int BeautyStreakMin { get; set; } = 2;           // bệt: chỉ cần 2 dấu liên tiếp
            public int BeautyZigzagMin { get; set; } = 4;           // 1–1: 2 chu kỳ (0101/1010) = 4 bước
            public bool BeautyOverrideWhenGuardOn { get; set; } = true; // cho phép override khi guard ON
            public int BeautyOverrideCooldown { get; set; } = 2;    // sau khi override, chờ X ván mới override lại
            public int BeautyRequireMarginWhenNoGuard { get; set; } = 1; // khi không guard: chỉ override nếu margin ≤ 1
        }

        // AppData\Local\XocDiaLiveHit\a15\ai15.config.json
        private static readonly string ConfigDir =
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                         "XocDiaLiveHit", "a15");
        private static readonly string ConfigFile =
            Path.Combine(ConfigDir, "ai15.config.json");

        private static Ai15Config Cfg = LoadConfig();

        private static Ai15Config LoadConfig()
        {
            try
            {
                Directory.CreateDirectory(ConfigDir);
                if (File.Exists(ConfigFile))
                {
                    var json = File.ReadAllText(ConfigFile);
                    var obj = JsonSerializer.Deserialize<Ai15Config>(json);
                    if (obj != null) return obj;
                }
            }
            catch { }
            return new Ai15Config();
        }

        private static void SaveDefaultConfigIfMissing()
        {
            try
            {
                Directory.CreateDirectory(ConfigDir);
                if (!File.Exists(ConfigFile))
                {
                    var def = new Ai15Config();
                    var json = JsonSerializer.Serialize(def, new JsonSerializerOptions { WriteIndented = true });
                    File.WriteAllText(ConfigFile, json);
                }
            }
            catch { }
        }

        // ================ Runtime State & Metrics =====================
        private enum Regime { CHAOTIC, DRIFT, STREAK, ZIGZAG }

        private struct Vote
        {
            public int pick;       // 0=CHAN, 1=LE
            public double conf;    // 0..1
            public string expert;  // tên chuyên gia
            public string plan;    // chiến lược
        }

        private sealed class PanelState
        {
            public List<int> lastHands = new(); // 0=CHAN,1=LE (kết quả ra)
            public int winStreak = 0;
            public int loseStreak = 0;
            public int maxLoseStreak = 0;
            public double ewma = 0.5;
            public int lastPick = -1;
            public int lastResult = -1;
            public bool lossGuardOn = false;    // Loss-Guard
            public bool hardGuardOn = false;    // Hard-Guard (LOCK)
            public int hardGuardAge = 0;
            public int hardGuardConsecWins = 0;

            // Beauty Bias control
            public int beautyCooldown = 0;      // >0 thì tạm không override theo cầu đẹp
        }

        // ================= Entry Point ===============================
        public async Task RunAsync(GameContext ctx, CancellationToken ct)
        {
            SaveDefaultConfigIfMissing();

            var rnd = new Random();
            var st = new PanelState();
            var money = new MoneyManager(ctx.StakeSeq, ctx.MoneyStrategyId);

            Log(ctx, $"[AI15] Start Expert Panel — cfgDir={ConfigDir}");

            await WarmSeedAsync(ctx, st, ct);

            while (true)
            {
                ct.ThrowIfCancellationRequested();

                // Chờ tới cửa sổ quyết định đặt cược
                await WaitUntilNewRoundStart(ctx, ct);

                // Ảnh chụp chuỗi trước khi đặt (để judge)
                var snap = ctx.GetSnap();
                string baseSeq = snap?.seq ?? string.Empty;

                // 1) Tính regime + trigger động từ lịch sử nội bộ (st.lastHands)
                var w20 = WinRate(st.lastHands, 20);
                var w50 = WinRate(st.lastHands, 50);
                var majDiff12 = MajorityDiff(st.lastHands, 12);
                var regime = ClassifyRegime(st, w20, w50, majDiff12);
                int dynLossTrig = DynamicGuardTrigger(Cfg.BaseLossGuardTrigger, w50, majDiff12);

                // 2) Lấy Top10 votes (mock hoặc nối nguồn thật)
                var topVotes = await GetTop10VotesAsync(ctx, st, regime, ct);

                // 3) Quyết định pick (đã vá: thận trọng khi guard ON + Beauty Bias sớm 2 nhịp)
                var pick = DecidePickByConditionalVoting(ctx, topVotes, st, regime, dynLossTrig, rnd);

                // 4) Chọn “chuyên gia đứng tên”
                var signer = ChooseSigner(topVotes, pick, regime);

                // 5) Log
                LogRoundHeader(ctx, regime, w20, w50, dynLossTrig, st);
                LogVotes(ctx, topVotes, pick, signer);

                // 6) Đặt cược
                string side = (pick == 0) ? "CHAN" : "LE";
                var stake = money.GetStakeForThisBet();
                Log(ctx, $"[AI15] BET side={side} stake={stake:N0}");
                await PlaceBet(ctx, side, stake, ct);

                // 7) Chờ kết quả
                bool ok = await WaitRoundFinishAndJudge(ctx, side, baseSeq, ct);
                await ctx.UiDispatcher.InvokeAsync(() => ctx.UiAddWin?.Invoke(ok ? stake : -stake));
                money.OnRoundResult(ok);

                // 8) Cập nhật state theo “nếu thắng thì result==pick, thua thì result=1-pick”
                UpdateAfterResult(st, ok, pick);

                // 9) Re-seed metrics + hard-guard release
                ReseedMetrics(st);
                HandleHardGuardRelease(st, w20);
            }
        }

        // ================= Helper Logic ==============================

        private static async Task WarmSeedAsync(GameContext ctx, PanelState st, CancellationToken ct)
        {
            st.ewma = 0.5;
            st.lastHands.Clear();
            st.winStreak = 0;
            st.loseStreak = 0;
            st.maxLoseStreak = 0;
            st.lossGuardOn = false;
            st.hardGuardOn = false;
            st.hardGuardAge = 0;
            st.hardGuardConsecWins = 0;
            st.beautyCooldown = 0;
            await Task.CompletedTask;
        }

        private static double WinRate(List<int> seq, int window)
        {
            if (seq.Count == 0) return 0.5;
            int take = Math.Min(window, seq.Count);
            var tail = seq.Skip(Math.Max(0, seq.Count - take)).ToArray();
            double p1 = tail.Average(x => x);   // tỉ lệ 1 (LE)
            return Math.Max(p1, 1.0 - p1);      // “độ thắng” của bên đa số
        }

        private static double MajorityDiff(List<int> seq, int window)
        {
            int take = Math.Min(window, seq.Count);
            if (take == 0) return 0.0;
            var tail = seq.Skip(Math.Max(0, seq.Count - take));
            int ones = tail.Sum();
            int zeros = take - ones;
            return Math.Abs(ones - zeros) / (double)take; // 0..1
        }

        private static Regime ClassifyRegime(PanelState st, double w20, double w50, double majDiff12)
        {
            if (majDiff12 <= 0.10 && RecentZig(st.lastHands)) return Regime.ZIGZAG;
            if (st.winStreak >= 3 || st.loseStreak >= 3 || majDiff12 >= 0.40) return Regime.STREAK;
            if (majDiff12 >= 0.20 && majDiff12 < 0.40) return Regime.DRIFT;
            return Regime.CHAOTIC;
        }

        private static bool RecentZig(List<int> seq)
        {
            int n = Math.Min(8, seq.Count);
            if (n < 6) return false;
            var tail = seq.Skip(seq.Count - n).ToArray();
            int flips = 0;
            for (int i = 1; i < tail.Length; i++) if (tail[i] != tail[i - 1]) flips++;
            return flips >= n - 2;
        }

        private static int DynamicGuardTrigger(int baseTrig, double w50, double majDiff12)
        {
            // Loss-Guard động: mặc định 4; hạ 3 nếu w50 < 45% hoặc majDiff12 ≤ 0.05
            if (w50 < 0.45 || majDiff12 <= 0.05) return Math.Max(3, baseTrig - 1);
            return baseTrig;
        }

        // ======= BEAUTY HELPERS (bắt sớm 2 nhịp) =====================
        private static (int len, int side) CurrentStreakLen(List<int> seq)
        {
            if (seq.Count == 0) return (0, -1);
            int last = seq[^1], i = seq.Count - 1, len = 0;
            while (i >= 0 && seq[i] == last) { len++; i--; }
            return (len, last); // side=0/1
        }

        private static int CurrentZigzagLen(List<int> seq)
        {
            int n = seq.Count; if (n < 2) return 0;
            int len = 1; // bắt đầu từ phần tử cuối
            for (int i = n - 1; i >= 1; i--)
            {
                if (seq[i] != seq[i - 1]) len++;
                else break;
            }
            return len; // số bước đảo tay liên tiếp ở cuối
        }

        // ======= QUYẾT ĐỊNH (thận trọng + Beauty 2 nhịp + LOG) ======
        private static int DecidePickByConditionalVoting(
            GameContext ctx, List<Vote> votes, PanelState st, Regime regime, int dynLossTrig, Random rnd)
        {
            int ones = votes.Count(v => v.pick == 1);
            int zeros = votes.Count - ones;
            int margin = Math.Abs(ones - zeros);
            double avgConf = votes.Count > 0 ? votes.Average(v => v.conf) : 0.0;

            // ---- cập nhật guard ----
            if (st.loseStreak + 1 >= dynLossTrig) st.lossGuardOn = true;
            if (st.loseStreak == 0 && st.winStreak >= 2) st.lossGuardOn = false;

            if (!st.hardGuardOn && st.loseStreak >= Cfg.HardGuardOnLoseStreak)
            {
                st.hardGuardOn = true;
                st.hardGuardAge = 0;
                st.hardGuardConsecWins = 0;
            }

            // ===================== BEAUTY BIAS (2 nhịp) =====================
            if (Cfg.BeautyPrefEnabled && st.beautyCooldown == 0)
            {
                var (streakLen, streakSide) = CurrentStreakLen(st.lastHands);
                int zigLen = CurrentZigzagLen(st.lastHands);

                bool earlyStreak = streakLen >= Cfg.BeautyStreakMin; // >=2
                bool earlyZigzag = zigLen >= Cfg.BeautyZigzagMin;    // >=4 (= 2 chu kỳ 1–1)

                bool mayOverride =
                    (st.hardGuardOn && Cfg.BeautyOverrideWhenGuardOn) ||
                    (st.lossGuardOn && Cfg.BeautyOverrideWhenGuardOn) ||
                    (!st.lossGuardOn && !st.hardGuardOn && margin <= Cfg.BeautyRequireMarginWhenNoGuard);

                if (mayOverride && (earlyStreak || earlyZigzag))
                {
                    int beautyPick = -1;
                    string pattern = "";

                    if (earlyStreak)
                    {
                        // Follow bệt rất sớm (2 dấu)
                        beautyPick = streakSide;
                        pattern = "STREAK";
                    }
                    else if (earlyZigzag)
                    {
                        // ZigFollow rất sớm (2 chu kỳ = 4 bước)
                        int last = st.lastHands.Count > 0 ? st.lastHands[^1] : rnd.Next(2);
                        beautyPick = 1 - last;
                        pattern = "ZIGZAG";
                    }

                    if (beautyPick != -1)
                    {
                        // Nếu thua dài và beautyPick trùng lastPick → tránh đuổi sai chiều
                        if (st.loseStreak >= 6 && st.lastPick == beautyPick)
                        {
                            int fb = FallbackByRegime(st, regime, rnd);
                            Log(ctx, $"[AI15] BEAUTY-OVERRIDE BLOCKED (anti-chase) pattern={pattern} " +
                                     $"beautyPick={beautyPick} lastPick={st.lastPick} loseStreak={st.loseStreak} → fallback={fb}");
                            st.beautyCooldown = Cfg.BeautyOverrideCooldown;
                            return fb;
                        }

                        Log(ctx, $"[AI15] BEAUTY-OVERRIDE {pattern} pick={beautyPick} " +
                                 $"(streakLen={streakLen}, zigLen={zigLen}, margin={margin}, avgConf={avgConf:0.00}, " +
                                 $"LG={(st.lossGuardOn ? "ON" : "OFF")}, LOCK={(st.hardGuardOn ? "ON" : "OFF")}, cd={st.beautyCooldown})");

                        st.beautyCooldown = Cfg.BeautyOverrideCooldown;
                        return beautyPick;
                    }
                }
            }
            else
            {
                if (Cfg.BeautyPrefEnabled && st.beautyCooldown > 0)
                    Log(ctx, $"[AI15] BEAUTY-OVERRIDE SKIP (cooldown={st.beautyCooldown})");
            }
            // =================== HẾT BEAUTY BIAS ============================

            // ---- Hard-Guard ON: chỉ theo đa số rất mạnh ----
            if (st.hardGuardOn)
            {
                bool strongMajority = (margin >= 4) && (avgConf >= Math.Max(0.65, Cfg.VoteMinConf));
                if (strongMajority) return ones > zeros ? 1 : 0;
                return FallbackByRegime(st, regime, rnd);
            }

            // ---- Loss-Guard ON: nâng ngưỡng đa số ----
            if (st.lossGuardOn)
            {
                bool guardedOk = (margin >= 3) && (avgConf >= Math.Max(0.62, Cfg.VoteMinConf));
                if (guardedOk) return ones > zeros ? 1 : 0;
                return FallbackByRegime(st, regime, rnd);
            }

            // ---- Thường: theo đa số chuẩn ----
            if ((ones >= 6 || zeros >= 6) && avgConf >= Cfg.VoteMinConf)
            {
                if (st.loseStreak >= 6 && st.lastPick == (ones > zeros ? 1 : 0))
                    return FallbackByRegime(st, regime, rnd);
                return ones > zeros ? 1 : 0;
            }

            if (zeros == ones && votes.Count == 10 && Cfg.RandomOnTie)
                return rnd.Next(2);

            if ((ones == 6 && zeros == 4) || (zeros == 6 && ones == 4))
                return (avgConf < Cfg.VoteMinConf)
                    ? FallbackByRegime(st, regime, rnd)
                    : (ones > zeros ? 1 : 0);

            return FallbackByRegime(st, regime, rnd);
        }

        private static int FallbackByRegime(PanelState st, Regime regime, Random rnd)
        {
            // Regime → hành vi:
            // CHAOTIC/DRIFT/STREAK: FollowPrev (theo tay gần nhất)
            // ZIGZAG: ZigFollow (flip tay gần nhất)
            int last = st.lastHands.Count > 0 ? st.lastHands[^1] : rnd.Next(2);
            return regime == Regime.ZIGZAG ? 1 - last : last;
        }

        private static string ChooseSigner(List<Vote> votes, int pick, Regime regime)
        {
            // Ưu tiên expert có plan == pick
            var primary = votes.FirstOrDefault(v => v.pick == pick);
            if (!string.IsNullOrEmpty(primary.expert) && primary.pick == pick)
                return primary.expert;

            // Nếu không có, chọn neutral phù hợp chế độ
            string[] zigPrefs = { "ZigFollow24", "ZigFollow20", "ZigFollow16", "FlipPrev", "Cau 1-1" };
            string[] normPrefs = { "FollowRun", "FollowPrev", "Majority", "FollowTrend" };

            foreach (var p in (regime == Regime.ZIGZAG ? zigPrefs : normPrefs))
            {
                var v = votes.FirstOrDefault(x => string.Equals(x.plan, p, StringComparison.OrdinalIgnoreCase));
                if (!string.IsNullOrEmpty(v.expert)) return v.expert;
            }
            return votes.OrderByDescending(v => v.conf).Select(v => v.expert).FirstOrDefault() ?? "panel";
        }

        private static void UpdateAfterResult(PanelState st, bool ok, int pickPlayed)
        {
            st.lastPick = pickPlayed;
            st.lastResult = ok ? pickPlayed : 1 - pickPlayed;

            if (ok)
            {
                st.winStreak++;
                st.loseStreak = 0;
                if (st.hardGuardOn) st.hardGuardConsecWins++;
            }
            else
            {
                st.loseStreak++;
                st.maxLoseStreak = Math.Max(st.maxLoseStreak, st.loseStreak);
                st.winStreak = 0;
                if (st.hardGuardOn) st.hardGuardConsecWins = 0;
            }

            // EWMA theo “1 = thắng, 0 = thua”
            double x = ok ? 1.0 : 0.0;
            st.ewma = Cfg.EwmaAlpha * x + (1 - Cfg.EwmaAlpha) * st.ewma;

            // Lưu kết quả vào chuỗi tay gần nhất (0/1)
            if (st.lastResult >= 0) st.lastHands.Add(st.lastResult);

            // Giảm cooldown cho Beauty Bias nếu đang đợi
            if (st.beautyCooldown > 0) st.beautyCooldown--;
        }

        private static void ReseedMetrics(PanelState st)
        {
            if (st.lastHands.Count > Cfg.WarmSeedMax)
                st.lastHands = st.lastHands.Skip(st.lastHands.Count - Cfg.WarmSeedMax).ToList();
            st.ewma = Math.Clamp(st.ewma, 0.0, 1.0);
        }

        private static void HandleHardGuardRelease(PanelState st, double w20)
        {
            if (!st.hardGuardOn) return;
            st.hardGuardAge++;
            // gỡ khi có 2 ván thắng liên tục hoặc w20 > 55%
            if (st.hardGuardConsecWins >= Cfg.HardGuardReleaseWins || w20 > Cfg.HardGuardReleaseW20)
            {
                st.hardGuardOn = false;
                st.hardGuardAge = 0;
                st.hardGuardConsecWins = 0;
            }
        }

        private static void LogRoundHeader(GameContext ctx, Regime regime, double w20, double w50, int dynLossTrig, PanelState st)
        {
            string lockState = st.hardGuardOn ? $"LOCK ON age={st.hardGuardAge}" : "LOCK OFF";
            string lgState = st.lossGuardOn ? "LG=ON" : "LG=OFF";
            string metrics = $"w20={w20:0.00} w50={w50:0.00} Lmax={st.maxLoseStreak} Lcurr={st.loseStreak}";
            Log(ctx, $"[AI15] REG={regime} | dynTrig={dynLossTrig} | {lgState} | {lockState} | {metrics}");
        }

        private static void LogVotes(GameContext ctx, List<Vote> votes, int finalPick, string signer)
        {
            int ones = votes.Count(v => v.pick == 1);
            int zeros = votes.Count - ones;
            double avgConf = votes.Count > 0 ? votes.Average(v => v.conf) : 0.0;

            Log(ctx, $"[AI15] VOTE: 0={zeros}, 1={ones}, avgConf={avgConf:0.00} → PICK={finalPick} (by {signer})");
            foreach (var v in votes)
                LogDebug(ctx, $"   - {v.expert.PadRight(14)} plan={v.plan.PadRight(12)} pick={v.pick} conf={v.conf:0.00}");
        }

        // ================== Mock/Glue for Top10 ======================
        private static async Task<List<Vote>> GetTop10VotesAsync(GameContext ctx, PanelState st, Regime regime, CancellationToken ct)
        {
            var votes = new List<Vote>(10);
            int last = st.lastHands.Count > 0 ? st.lastHands[^1] : 0;

            string[] experts = { "Maj", "EWMA", "Run", "Prev", "Flip", "Zig16", "Zig20", "Zig24", "AntiMaj", "Noise" };
            for (int i = 0; i < 10; i++)
            {
                var name = experts[i];
                int pick = last;
                string plan = "FollowPrev";
                double conf = 0.55;

                switch (name)
                {
                    case "Maj":
                        pick = MajorityPick(st.lastHands); plan = "Majority"; conf = 0.60; break;
                    case "EWMA":
                        pick = st.ewma >= 0.5 ? 1 : 0; plan = "FollowTrend";
                        conf = 0.60 + Math.Abs(st.ewma - 0.5); break;
                    case "Run":
                        pick = st.winStreak >= st.loseStreak ? last : 1 - last; plan = "FollowRun";
                        conf = 0.58 + 0.02 * Math.Max(st.winStreak, st.loseStreak); break;
                    case "Prev":
                        pick = last; plan = "FollowPrev"; conf = 0.56; break;
                    case "Flip":
                        pick = 1 - last; plan = "FlipPrev"; conf = 0.54; break;
                    case "Zig16":
                        pick = 1 - last; plan = "ZigFollow16"; conf = regime == Regime.ZIGZAG ? 0.66 : 0.57; break;
                    case "Zig20":
                        pick = 1 - last; plan = "ZigFollow20"; conf = regime == Regime.ZIGZAG ? 0.67 : 0.57; break;
                    case "Zig24":
                        pick = 1 - last; plan = "ZigFollow24"; conf = regime == Regime.ZIGZAG ? 0.68 : 0.57; break;
                    case "AntiMaj":
                        pick = 1 - MajorityPick(st.lastHands); plan = "AntiMajority"; conf = 0.53; break;
                    case "Noise":
                        pick = (i + last) % 2; plan = "Noise"; conf = 0.50; break;
                }

                // Ưu tiên “ăn trend” khi guard ON:
                double lastOK = (st.winStreak > 0 ? 1 : 0);
                double ws = Math.Max(st.winStreak, 0);
                double trendScore = st.lossGuardOn ? (3 * lastOK + 2 * ws + st.ewma)
                                                   : (2 * lastOK + ws + st.ewma);
                if (pick == (st.ewma >= 0.5 ? 1 : 0)) conf += 0.02 * trendScore;

                conf = Math.Clamp(conf, 0.50, 0.90);
                votes.Add(new Vote { pick = pick, conf = conf, expert = name, plan = plan });
            }
            await Task.CompletedTask;
            return votes;
        }

        private static int MajorityPick(List<int> seq)
        {
            if (seq.Count == 0) return 1;
            int ones = seq.Sum();
            int zeros = seq.Count - ones;
            return ones >= zeros ? 1 : 0;
        }

        // =================== Logging Adapters ========================
        private static void Log(GameContext ctx, string msg) => ctx.Log?.Invoke(msg);
        private static void LogDebug(GameContext ctx, string msg) => ctx.Log?.Invoke(msg);
    }
}
