// AiExpertPanelTask.cs
// GPT-5 Thinking — trợ lý ảo
//
// Điểm chính phiên bản này:
// - CONTRARIAN: Đặt cửa đảo so với quyết định panel (ContrarianEnabled=true).
// - FEEDBACK SIMULATED: AI học/guard/ewma cập nhật theo "thắng/thua GIẢ LẬP của panel gốc",
//   không theo kết quả thực tế của cửa đã đặt (để tránh poison khi đánh ngược).
// - SEQ: luôn lấy trực tiếp từ snap.seq mỗi vòng, chuyển về T/X theo quy tắc:
//     + Chữ: 'X'/'x' => X ; 'T'/'t' => T
//   Bỏ qua ký tự khác. Chỉ lấy TỐI ĐA 50 phần tử cuối. An toàn khi chuỗi < 50.
// - Không còn tự "append" kết quả vào st.lastHands; thay vào đó mỗi vòng luôn refresh từ snap.
// - Log rõ ràng: REFRESH from snap.seq, BEAUTY-SCAN, quyết định panel vs cửa đặt (đảo), ok thực,
//   panelWin (giả lập), trainingWin (dùng để học).
//
// Giữ nguyên khung IBetTask, TaskUtil, MoneyManager… như file gốc dự án.

using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using static HitTaiXiuLive.Tasks.TaskUtil;

namespace HitTaiXiuLive.Tasks
{
    public sealed class AiExpertPanelTask : IBetTask
    {
        public string Id => "ai15.expert.panel";
        public string DisplayName => "14) AI Expert Panel (Top10, Guard, Regime)";

        // ======================= Config ============================
        private sealed class Ai15Config
        {
            public int WarmSeedMax { get; set; } = 50;
            public double EwmaAlpha { get; set; } = 0.30;

            // Guard
            public int BaseLossGuardTrigger { get; set; } = 4;
            public int HardGuardOnLoseStreak { get; set; } = 4;
            public int HardGuardReleaseWins { get; set; } = 3;
            public double HardGuardReleaseW20 { get; set; } = 0.58;

            // Voting
            public double VoteMinConf { get; set; } = 0.62;
            public bool RandomOnTie { get; set; } = true;

            // Beauty Bias
            public bool BeautyPrefEnabled { get; set; } = true;
            public bool BeautyOverrideWhenGuardOn { get; set; } = false;
            public int BeautyRequireMarginWhenNoGuard { get; set; } = 3;
            public int BeautyOverrideCooldown { get; set; } = 3;
            public int BeautyStreakMin { get; set; } = 3;

            // Contrarian đặt đảo cửa nhưng học theo panel gốc (giả lập)
            public bool ContrarianEnabled { get; set; } = true;
        }

        // AppData\Local\HitTaiXiuLive\a15\ai15.config.json
        private static readonly string ConfigDir =
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                         "HitTaiXiuLive", "a15");
        private static readonly string ConfigFile =
            Path.Combine(ConfigDir, "ai15.config.json");

        private static Ai15Config Cfg = LoadOrCreateConfigAtStartup();

        private static Ai15Config LoadOrCreateConfigAtStartup()
        {
            try
            {
                Directory.CreateDirectory(ConfigDir);
                if (!File.Exists(ConfigFile))
                {
                    var def = new Ai15Config();
                    var jsonDefault = JsonSerializer.Serialize(def, new JsonSerializerOptions { WriteIndented = true });
                    File.WriteAllText(ConfigFile, jsonDefault);
                    return def;
                }
                else
                {
                    var json = File.ReadAllText(ConfigFile);
                    var obj = JsonSerializer.Deserialize<Ai15Config>(json);
                    if (obj != null) return obj;
                }
            }
            catch { }
            return new Ai15Config();
        }

        private static void LogConfigPath(GameContext ctx)
        {
            try
            {
                Log(ctx, $"[AI15] Start Expert Panel — cfgDir={ConfigDir}");
                if (File.Exists(ConfigFile))
                    Log(ctx, $"[AI15] Config loaded: {ConfigFile}");
                else
                    Log(ctx, $"[AI15] Config file missing, defaults in-memory will be used.");
            }
            catch { }
        }

        // ======================= State =============================
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
            // Đây là chuỗi kết quả CHAN/LE thực tế, luôn refresh từ snap.seq mỗi vòng
            public List<int> lastHands = new();

            // Các trạng thái học/guard/ewma dựa trên trainingWin (giả lập)
            public int winStreak = 0;
            public int loseStreak = 0;
            public int maxLoseStreak = 0;
            public double ewma = 0.5;

            // Lưu quyết định/pick vòng trước (để log)
            public int lastPanelPick = -1;     // pick của panel
            public int lastPlacedPick = -1;    // pick thực tế đã đặt (sau khi đảo)
            public bool? lastOk = null;        // thắng/thua thực tế

            public bool lossGuardOn = false;
            public bool hardGuardOn = false;
            public int hardGuardAge = 0;
            public int hardGuardConsecWins = 0;

            public int beautyCooldown = 0;

            // Để tránh spam log, chỉ log REFRESH khi chuỗi thay đổi
            public string lastSeqStr = "";
        }

        // ====================== Entry ==============================
        public async Task RunAsync(GameContext ctx, CancellationToken ct)
        {
            LogConfigPath(ctx);

            var rnd = new Random();
            var st = new PanelState();
            var money = new MoneyManager(ctx.StakeSeq, ctx.MoneyStrategyId);

            // EWMA/mode reset
            await WarmSeedAsync(st);

            // Lần đầu: cố gắng lấy seq ngay nếu có
            SafeRefreshLastHandsFromSnap(ctx, st, firstLog: true);

            while (true)
            {
                ct.ThrowIfCancellationRequested();

                await WaitUntilNewRoundStart(ctx, ct);

                // Luôn refresh từ snap.seq MỖI VÒNG, an toàn chiều dài < 50
                SafeRefreshLastHandsFromSnap(ctx, st);

                var w20 = WinRate(st.lastHands, 20);
                var w50 = WinRate(st.lastHands, 50);
                var majDiff12 = MajorityDiff(st.lastHands, 12);
                var regime = ClassifyRegime(st, w20, w50, majDiff12);
                int dynLossTrig = DynamicGuardTrigger(Cfg.BaseLossGuardTrigger, w50, majDiff12);

                // Lấy Top10 votes (mock/glue)
                var votes = await GetTop10VotesAsync(st, regime);

                // Quyết định panel pick (0=CHAN, 1=LE)
                int panelPick = DecidePickByConditionalVoting(ctx, votes, st, regime, dynLossTrig, rnd);

                // CONTRARIAN: đặt đảo cửa nếu bật
                int placedPick = Cfg.ContrarianEnabled ? 1 - panelPick : panelPick;

                // Chọn signer (chỉ để log)
                var signer = ChooseSigner(votes, panelPick, regime);

                // Header + votes
                LogRoundHeader(ctx, regime, w20, w50, dynLossTrig, st, panelPick, placedPick);
                LogVotes(ctx, votes, panelPick, signer);

                // Đặt cược theo placedPick
                string side = (placedPick == 0) ? "TAI" : "XIU";
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
                Log(ctx, $"[AI15] BET side={side} stake={stake:N0} (panelPick={(panelPick == 0 ? "T" : "X")}, contrarian={(Cfg.ContrarianEnabled ? "ON" : "OFF")})");
                await PlaceBet(ctx, side, stake, ct);

                // Chấm điểm thực tế theo cửa đã đặt
                var snapBefore = ctx.GetSnap();
                string baseSession = snapBefore?.session ?? string.Empty;
                bool ok = await WaitRoundFinishAndJudge(ctx, side, baseSession, ct);

                // P&L theo kết quả thực
                await ctx.UiDispatcher.InvokeAsync(() => ctx.UiAddWin?.Invoke(ok ? stake : -stake));
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
                        ok);

                    // gán ngược lại vào context
                    ctx.MoneyChainIndex = chainIndex;
                    ctx.MoneyChainStep = chainStep;
                    ctx.MoneyChainProfit = chainProfit;
                }
                else
                {
                    // 4 kiểu cũ vẫn đi qua MoneyManager
                    money.OnRoundResult(ok);
                }

                // TÍNH panelWin (giả lập) và trainingWin (cho học)
                // trueWinSide: 0/1 là CHAN/LE thực tế thắng
                int trueWinSide = ok ? placedPick : 1 - placedPick;
                bool panelWin = (trueWinSide == panelPick);

                bool trainingWin = panelWin;       // HỌC THEO PANEL GỐC (GIẢ LẬP)
                int trainingPick = panelPick;     // pick dùng để học

                Log(ctx, $"[AI15] RESULT ok={(ok ? "WIN" : "LOSE")} | trueWin={(trueWinSide == 0 ? "T" : "X")} | panelPick={(panelPick == 0 ? "T" : "X")} -> panelWin={(panelWin ? "WIN" : "LOSE")} | trainingWin={(trainingWin ? "WIN" : "LOSE")}");

                // Cập nhật trạng thái học/guard/ewma theo trainingWin
                UpdateAfterTraining(st, trainingWin, trainingPick);

                // Reseed + hard-guard release
                ReseedMetrics(st);
                HandleHardGuardRelease(st, w20);

                // Lưu để log vòng tới
                st.lastPanelPick = panelPick;
                st.lastPlacedPick = placedPick;
                st.lastOk = ok;
            }
        }

        // ===================== Helpers =============================
        private static Task WarmSeedAsync(PanelState st)
        {
            st.ewma = 0.5;
            st.winStreak = 0;
            st.loseStreak = 0;
            st.maxLoseStreak = 0;
            st.lossGuardOn = false;
            st.hardGuardOn = false;
            st.hardGuardAge = 0;
            st.hardGuardConsecWins = 0;
            st.beautyCooldown = 0;
            return Task.CompletedTask;
        }

        // Đọc snap.seq -> chuẩn hoá về danh sách 0/1 (T/X) và chuỗi chữ 'T'/'X' để log
        private static void SafeRefreshLastHandsFromSnap(GameContext ctx, PanelState st, bool firstLog = false)
        {
            try
            {
                var snap = ctx.GetSnap();
                var raw = snap?.seq ?? string.Empty;

                // Parse: nhận cả số (0..4) lẫn chữ (T/X), lọc ký tự khác
                var tmp = new List<int>(50);
                var sb = new System.Text.StringBuilder(60);

                foreach (char ch in raw)
                {
                    int? bit = null;
                    switch (ch)
                    {
                        // chữ
                        case 'T': case 't': bit = 0; break;
                        case 'X': case 'x': bit = 1; break;
                        default: break; // bỏ qua
                    }

                    if (bit.HasValue)
                    {
                        tmp.Add(bit.Value);
                    }
                }

                // Chỉ lấy tối đa 50 phần tử cuối
                if (tmp.Count > 50)
                    tmp = tmp.Skip(tmp.Count - 50).ToList();

                // Xây chuỗi T/X để log
                foreach (var b in tmp)
                    sb.Append(b == 0 ? 'T' : 'X');
                string seqTX = sb.ToString();

                if (tmp.Count == 0)
                {
                    if (firstLog) Log(ctx, "[AI15] SEED: snap.seq chưa sẵn.");
                    return;
                }

                // Chỉ update khi thay đổi để tránh spam log
                if (!string.Equals(seqTX, st.lastSeqStr, StringComparison.Ordinal))
                {
                    st.lastHands = tmp;
                    st.lastSeqStr = seqTX;
                    Log(ctx, $"[AI15] REFRESH from snap.seq -> n={tmp.Count} | {seqTX}");
                }
                else if (firstLog)
                {
                    // Lần đầu có chuỗi nhưng không thay đổi so với st.lastSeqStr (hiếm)
                    Log(ctx, $"[AI15] REFRESH from snap.seq -> n={tmp.Count} | {seqTX}");
                }
            }
            catch (Exception ex)
            {
                Log(ctx, $"[AI15] REFRESH error: {ex.Message}");
            }
        }

        private static double WinRate(List<int> seq, int window)
        {
            if (seq.Count == 0) return 0.5;
            int take = Math.Min(window, seq.Count);
            var tail = seq.Skip(Math.Max(0, seq.Count - take)).ToArray();
            double p1 = tail.Average(x => x);   // tỉ lệ 1 (LE)
            return Math.Max(p1, 1.0 - p1);
        }

        private static double MajorityDiff(List<int> seq, int window)
        {
            int take = Math.Min(window, seq.Count);
            if (take == 0) return 0.0;
            var tail = seq.Skip(Math.Max(0, seq.Count - take));
            int ones = tail.Sum();
            int zeros = take - ones;
            return Math.Abs(ones - zeros) / (double)take;
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
            if (w50 < 0.45 || majDiff12 <= 0.05) return Math.Max(3, baseTrig - 1);
            return baseTrig;
        }

        // ---------- Beauty helpers ----------
        private static (int len, int side) CurrentStreakLen(List<int> seq)
        {
            if (seq.Count == 0) return (0, -1);
            int last = seq[^1], i = seq.Count - 1, len = 0;
            while (i >= 0 && seq[i] == last) { len++; i--; }
            return (len, last);
        }

        private static (int curLen, int curSide, int prevLen, int prevSide, int prev2Len, int prev2Side)
        GetTail3Blocks(List<int> seq)
        {
            int n = seq.Count;
            if (n == 0) return (0, -1, 0, -1, 0, -1);

            int i = n - 1;
            int curSide = seq[i], curLen = 0;
            while (i >= 0 && seq[i] == curSide) { curLen++; i--; }
            if (i < 0) return (curLen, curSide, 0, -1, 0, -1);

            int prevSide = seq[i], prevLen = 0;
            while (i >= 0 && seq[i] == prevSide) { prevLen++; i--; }
            if (i < 0) return (curLen, curSide, prevLen, prevSide, 0, -1);

            int prev2Side = seq[i], prev2Len = 0;
            while (i >= 0 && seq[i] == prev2Side) { prev2Len++; i--; }

            return (curLen, curSide, prevLen, prevSide, prev2Len, prev2Side);
        }

        private static string BitsCL(List<int> seq, int take = 24)
        {
            if (seq.Count == 0) return "-";
            var tail = seq.Skip(Math.Max(0, seq.Count - take)).Select(t => t == 1 ? 'T' : 'X').ToArray();
            return new string(tail);
        }
        private static string BlockSig(List<int> seq)
        {
            if (seq.Count == 0) return "[]";
            var parts = new List<string>();
            int i = seq.Count - 1;
            int blocks = 0;
            while (i >= 0 && blocks < 3)
            {
                int side = seq[i];
                int len = 0;
                while (i >= 0 && seq[i] == side) { len++; i--; }
                parts.Add($"{side}x{len}");
                blocks++;
            }
            parts.Reverse();
            return "[" + string.Join(" | ", parts) + "]";
        }

        private static bool IsBeautyLen(int len) => len >= 1 && len <= 4;

        // ================== Decision (panel pick) ===================
        private static int DecidePickByConditionalVoting(
            GameContext ctx, List<Vote> votes, PanelState st, Regime regime, int dynLossTrig, Random rnd)
        {
            int ones = votes.Count(v => v.pick == 1);
            int zeros = votes.Count - ones;
            int margin = Math.Abs(ones - zeros);
            double avgConf = votes.Count > 0 ? votes.Average(v => v.conf) : 0.0;

            // cập nhật guard (dựa trên training streak, đã update sau mỗi ván)
            if (st.loseStreak + 1 >= dynLossTrig) st.lossGuardOn = true;
            if (st.loseStreak == 0 && st.winStreak >= 2) st.lossGuardOn = false;

            if (!st.hardGuardOn && st.loseStreak >= Cfg.HardGuardOnLoseStreak)
            {
                st.hardGuardOn = true;
                st.hardGuardAge = 0;
                st.hardGuardConsecWins = 0;
            }

            // Beauty scan trên chuỗi thực tế từ snap.seq
            var (curLen, curSide, prevLen, prevSide, prev2Len, prev2Side) = GetTail3Blocks(st.lastHands);
            var (streakLen, streakSide) = CurrentStreakLen(st.lastHands);

            bool guardOn = st.hardGuardOn || st.lossGuardOn;
            bool beautyWindowOk =
                (!guardOn && margin <= Cfg.BeautyRequireMarginWhenNoGuard) ||
                (guardOn && Cfg.BeautyOverrideWhenGuardOn);

            bool beautyAllowed = Cfg.BeautyPrefEnabled
                                 && st.beautyCooldown == 0
                                 && beautyWindowOk;

            // X–Y–X (độ dài 1..4 bằng nhau 2 đầu) → theo block giữa (prevSide)
            string cand = null; int candSide = -1;
            if (IsBeautyLen(prev2Len) && IsBeautyLen(prevLen) && IsBeautyLen(curLen) && prev2Len == curLen)
            {
                cand = $"PAT{prev2Len}-{prevLen}-{curLen}";
                candSide = prevSide;
            }
            else if (streakLen >= Cfg.BeautyStreakMin)
            {
                cand = "STREAK";
                candSide = streakSide;
            }

            Log(ctx,
                $"[AI15] BEAUTY-SCAN seq={BitsCL(st.lastHands, 50)} blocks={BlockSig(st.lastHands)} " +
                $"streak={streakLen}(side={(streakSide == -1 ? "-" : streakSide.ToString())}) cand={(cand ?? "-")} side={(candSide == -1 ? "-" : candSide.ToString())} " +
                $"allowed={(beautyAllowed ? "YES" : "NO")} cd={st.beautyCooldown} LG={(st.lossGuardOn ? "ON" : "OFF")} LOCK={(st.hardGuardOn ? "ON" : "OFF")} margin={margin}");

            // Beauty override nếu được phép
            if (beautyAllowed && cand != null)
            {
                st.beautyCooldown = Cfg.BeautyOverrideCooldown;
                Log(ctx, $"[AI15] BEAUTY-OVERRIDE {cand} pick={candSide}");
                return candSide;
            }
            else if (Cfg.BeautyPrefEnabled && st.beautyCooldown > 0)
            {
                Log(ctx, $"[AI15] BEAUTY-OVERRIDE SKIP (cooldown={st.beautyCooldown})");
            }

            // Hard-guard: chỉ theo đa số rất mạnh
            if (st.hardGuardOn)
            {
                bool strongMajority = (margin >= 4) && (avgConf >= Math.Max(0.65, Cfg.VoteMinConf));
                if (strongMajority)
                {
                    int pk = ones > zeros ? 1 : 0;
                    Log(ctx, $"[AI15] DECISION reason=MAJ_STRONG_HARDGUARD pick={pk} detail=\"margin={margin} avgConf={avgConf:0.00}\"");
                    return pk;
                }
                int fb = FallbackByRegime(st, regime, rnd);
                Log(ctx, $"[AI15] DECISION reason=REGIME_FALLBACK default pick={fb}");
                return fb;
            }

            // Loss-guard: nâng ngưỡng đa số
            if (st.lossGuardOn)
            {
                bool guardedOk = (margin >= 3) && (avgConf >= Math.Max(0.62, Cfg.VoteMinConf));
                if (guardedOk)
                {
                    int pk = ones > zeros ? 1 : 0;
                    Log(ctx, $"[AI15] DECISION reason=MAJ_GUARDED pick={pk} detail=\"margin={margin} avgConf={avgConf:0.00}\"");
                    return pk;
                }
                int fb = FallbackByRegime(st, regime, rnd);
                Log(ctx, $"[AI15] DECISION reason=REGIME_FALLBACK default pick={fb}");
                return fb;
            }

            // Bình thường
            if ((ones >= 6 || zeros >= 6) && avgConf >= Cfg.VoteMinConf)
            {
                int pk = ones > zeros ? 1 : 0;
                Log(ctx, $"[AI15] DECISION reason=MAJ pick={pk} detail=\"margin={margin} avgConf={avgConf:0.00}\"");
                return pk;
            }

            if (zeros == ones && votes.Count == 10 && Cfg.RandomOnTie)
            {
                int pk = rnd.Next(2);
                Log(ctx, $"[AI15] DECISION reason=RANDOM_ON_TIE pick={pk}");
                return pk;
            }

            if ((ones == 6 && zeros == 4) || (zeros == 6 && ones == 4))
            {
                if (avgConf < Cfg.VoteMinConf)
                {
                    int fb = FallbackByRegime(st, regime, rnd);
                    Log(ctx, $"[AI15] DECISION reason=REGIME_FALLBACK default pick={fb} detail=\"6-4 but avgConf<{Cfg.VoteMinConf:0.00}\"");
                    return fb;
                }
                int pk = ones > zeros ? 1 : 0;
                Log(ctx, $"[AI15] DECISION reason=MAJ pick={pk} detail=\"6-4 avgConf={avgConf:0.00}\"");
                return pk;
            }

            {
                int fb = FallbackByRegime(st, regime, rnd);
                Log(ctx, $"[AI15] DECISION reason=REGIME_FALLBACK default pick={fb}");
                return fb;
            }
        }

        private static int FallbackByRegime(PanelState st, Regime regime, Random rnd)
        {
            int last = st.lastHands.Count > 0 ? st.lastHands[^1] : rnd.Next(2);
            return regime == Regime.ZIGZAG ? 1 - last : last;
        }

        private static string ChooseSigner(List<Vote> votes, int pick, Regime regime)
        {
            var primary = votes.FirstOrDefault(v => v.pick == pick);
            if (!string.IsNullOrEmpty(primary.expert) && primary.pick == pick)
                return primary.expert;

            string[] zigPrefs = { "ZigFollow24", "ZigFollow20", "ZigFollow16", "FlipPrev", "Cau 1-1" };
            string[] normPrefs = { "FollowRun", "FollowPrev", "Majority", "FollowTrend" };

            foreach (var p in (regime == Regime.ZIGZAG ? zigPrefs : normPrefs))
            {
                var v = votes.FirstOrDefault(x => string.Equals(x.plan, p, StringComparison.OrdinalIgnoreCase));
                if (!string.IsNullOrEmpty(v.expert)) return v.expert;
            }
            return votes.OrderByDescending(v => v.conf).Select(v => v.expert).FirstOrDefault() ?? "panel";
        }

        private static void UpdateAfterTraining(PanelState st, bool trainingWin, int trainingPick)
        {
            // Update streak theo KẾT QUẢ HỌC (giả lập panel)
            if (trainingWin)
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

            // EWMA theo “thắng=1, thua=0” dựa trên trainingWin
            double x = trainingWin ? 1.0 : 0.0;
            st.ewma = Cfg.EwmaAlpha * x + (1 - Cfg.EwmaAlpha) * st.ewma;

            // Cooldown beauty giảm dần
            if (st.beautyCooldown > 0) st.beautyCooldown--;
        }

        private static void ReseedMetrics(PanelState st)
        {
            // EWMA clamp
            st.ewma = Math.Clamp(st.ewma, 0.0, 1.0);
        }

        private static void HandleHardGuardRelease(PanelState st, double w20)
        {
            if (!st.hardGuardOn) return;
            st.hardGuardAge++;
            if (st.hardGuardConsecWins >= Cfg.HardGuardReleaseWins || w20 > Cfg.HardGuardReleaseW20)
            {
                st.hardGuardOn = false;
                st.hardGuardAge = 0;
                st.hardGuardConsecWins = 0;
            }
        }

        private static void LogRoundHeader(GameContext ctx, Regime regime, double w20, double w50, int dynLossTrig, PanelState st, int panelPick, int placedPick)
        {
            string lockState = st.hardGuardOn ? $"LOCK ON age={st.hardGuardAge}" : "LOCK OFF";
            string lgState = st.lossGuardOn ? "LG=ON" : "LG=OFF";
            string metrics = $"w20={w20:0.00} w50={w50:0.00} Lmax={st.maxLoseStreak} Lcurr={st.loseStreak}";
            string mode = "MODE=NORMAL";
            string picks = $"panel={(panelPick == 0 ? "T" : "X")} placed={(placedPick == 0 ? "T" : "X")} contrarian={(Cfg.ContrarianEnabled ? "ON" : "OFF")}";
            Log(ctx, $"[AI15] REG={regime} | dynTrig={dynLossTrig} | {lgState} | {lockState} | {mode} | {metrics} | {picks}");
        }

        private static void LogVotes(GameContext ctx, List<Vote> votes, int finalPick, string signer)
        {
            int ones = votes.Count(v => v.pick == 1);
            int zeros = votes.Count - ones;
            double avgConf = votes.Count > 0 ? votes.Average(v => v.conf) : 0.0;

            Log(ctx, $"[AI15] VOTE: 0={zeros}, 1={ones}, avgConf={avgConf:0.00} → PANEL_PICK={finalPick} (by {signer})");
            foreach (var v in votes)
                Log(ctx, $"   - {v.expert.PadRight(14)} plan={v.plan.PadRight(12)} pick={v.pick} conf={v.conf:0.00}");
        }

        // ================= Top10 mock/glue =========================
        private static Task<List<Vote>> GetTop10VotesAsync(PanelState st, Regime regime)
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

                conf = Math.Clamp(conf, 0.50, 0.90);
                votes.Add(new Vote { pick = pick, conf = conf, expert = name, plan = plan });
            }
            return Task.FromResult(votes);
        }

        private static int MajorityPick(List<int> seq)
        {
            if (seq.Count == 0) return 1;
            int ones = seq.Sum();
            int zeros = seq.Count - ones;
            return ones >= zeros ? 1 : 0;
        }

        // ================= Logging adapters ========================
        private static void Log(GameContext ctx, string msg) => ctx.Log?.Invoke(msg);
    }
}
