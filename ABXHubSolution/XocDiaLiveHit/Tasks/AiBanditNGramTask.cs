// Tasks/AiBanditNGramTask.cs
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
    /// <summary>
    /// 15) AI bandit n-gram (đa profile)
    /// - Học online n-gram + warm-start 50 khi bật app (mỗi lần bật).
    /// - 10 profile chạy song song: mỗi ván đều "ra kèo" (plan) và được cập nhật win/loss (counterfactual).
    /// - Chỉ khi THUA mới xét đổi profile cho ván sau, dùng Thompson Sampling (bandit) + switchMargin động.
    /// - Bản này thêm:
    ///   + ApplyProfilePolicy: đa dạng hóa kế hoạch theo từng profile khi conf yếu.
    ///   + Diversity guard: khi tất cả plan giống nhau & conf yếu → ép 1–2 profile đi ngược để phủ.
    ///   + Regret trong 12 ván cho profile đang chạy: regret cao → giảm switchMargin → chuyển nhanh hơn khi thua.
    ///   + Adaptive Beta discount + Rebase Beta tránh “ì”; khi thua dây ≥4 rebase mạnh hơn.
    /// - antiHold RIÊNG từng profile: antiHold>0 -> theo bệt cưỡng bức N ván.
    /// - Zigzag (cầu 1–1): conf yếu/hòa -> bẻ (đảo last) theo rule của từng profile; bệt thật -> theo bệt.
    /// - Drift detector (Page-Hinkley nhẹ) trên kết quả đặt thật: ưu tiên nhóm theo bệt một số ván khi drift bật.
    /// - Random mode: khi tất cả conf yếu & phiếu 10 profile gần 50–50.
    /// - Siết an toàn THEO TỪNG PROFILE khi CurrLossStreak ≥5 (≥8 siết mạnh hơn). Thắng lại -> decay siết.
    /// - Lưu/kế thừa vào %LOCALAPPDATA%\XocDiaLiveHit\ai15\* (tách hẳn so với chiến lược 14).
    /// </summary>
    public sealed class AiBanditNGramTask : IBetTask
    {
        public string DisplayName => "15) AI bandit n-gram (đa profile)";
        public string Id => "ai-bandit-ngram";

        private readonly NGramOnlineModel _model;
        private readonly string _statePath;
        private readonly int _warmSteps;
        private readonly bool _saveAfterWarm;

        private readonly AdaptiveParamController _ap; // giữ tương thích baseline tham số
        private readonly ProfileManager _pm;

        private bool _warmed = false;
        private int _updatesSinceLastSave = 0;
        private int _currProfile = -1;
        private bool _lastRoundWin = false;

        private readonly DriftDetector _drift = new DriftDetector();
        private const int SAVE_EVERY_UPDATES = 5;
        private static readonly Random _rng = new Random();

        public AiBanditNGramTask() : this(null, 50, true) { }

        public AiBanditNGramTask(string statePath, int warmStartSteps, bool saveImmediatelyAfterWarm)
        {
            _model = new NGramOnlineModel(
                kMax: 6, alpha: 1.0, minSupport: 3, rescaleThreshold: 1000,
                tieUsesOppLast: false // hòa -> THEO BỆT
            );

            _statePath = !string.IsNullOrWhiteSpace(statePath) ? statePath : GetDefaultStatePath();
            _warmSteps = Math.Max(1, warmStartSteps);
            _saveAfterWarm = saveImmediatelyAfterWarm;

            // Load n-gram (nếu có)
            if (File.Exists(_statePath))
            {
                try { _model.LoadFromFile(_statePath); }
                catch (Exception ex) { System.Diagnostics.Debug.WriteLine($"[AI15] Load state failed: {ex.Message}"); }
            }

            _ap = new AdaptiveParamController(GetParamPath());
            _pm = new ProfileManager(GetProfilesPath());

            ApplyAdaptiveParamsToModel(_ap.Current);
        }

        // ===== PATHS (tách riêng ai15) =====
        private static string AppLocalDir()
            => Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "XocDiaLiveHit", "ai15");

        private static string GetDefaultStatePath()
        {
            var dir = AppLocalDir();
            Directory.CreateDirectory(dir);
            return Path.Combine(dir, "ngram15_state_v1.json");
        }
        private static string GetParamPath()
        {
            var dir = AppLocalDir();
            Directory.CreateDirectory(dir);
            return Path.Combine(dir, "ngram15_params_v1.json");
        }
        private static string GetProfilesPath()
        {
            var dir = AppLocalDir();
            Directory.CreateDirectory(dir);
            return Path.Combine(dir, "ngram15_profiles_v1.json");
        }

        private void ApplyAdaptiveParamsToModel(AdaptiveParams p)
        {
            _model.SetHyperparams(
                kUseMax: p.KUseMax,
                alpha: p.Alpha,
                minSupport: p.MinSupport,
                rescaleThreshold: p.RescaleThreshold,
                tieBand: p.TieBand,
                momentumGuard: p.MomentumGuard
            );
        }

        private static string ToSide(char c) => c == 'C' ? "CHAN" : "LE";
        private static char Opp(char c) => c == 'C' ? 'L' : 'C';

        // Zigzag (cầu 1–1): run-length đuôi = 1 + tỉ lệ đổi cửa cao
        private static bool IsZigZag(ReadOnlySpan<char> p, int window = 12, double thr = 0.70)
        {
            int n = p.Length; if (n < 3) return false;
            int start = Math.Max(1, n - window + 1), switches = 0, pairs = 0;
            char prev = p[start - 1];
            for (int i = start; i < n; i++)
            {
                pairs++;
                if (p[i] != prev) switches++;
                prev = p[i];
            }
            if (pairs < 4) return false;
            int run = 1; for (int i = n - 2; i >= 0 && p[i] == p[n - 1]; i--) run++;
            double rate = (double)switches / pairs;
            return run == 1 && rate >= thr;
        }

        // ==== Chính sách đa dạng theo từng profile (áp cho bước PLAN) ====
        private char ApplyProfilePolicy(int profIdx, char rawPick, double conf, char last, bool isZigZag, AdaptiveParams par)
        {
            bool strong = conf >= par.ConfFollowThreshold;
            switch (profIdx)
            {
                case 0: // P0 Balanced: theo raw, yếu -> theo bệt
                    return strong ? rawPick : last;

                case 1: // P1 Follow-Lite: theo bệt rõ rệt
                    return strong ? rawPick : last;

                case 2: // P2 Follow-Heavy: theo bệt, bỏ zigzag
                    return strong ? rawPick : last;

                case 3: // P3 Flip-Lite: đảo nhẹ
                    return strong ? Opp(rawPick) : Opp(last);

                case 4: // P4 Flip-Aggr: đảo mạnh; yếu -> vẫn đảo
                    return strong ? Opp(rawPick) : Opp(last);

                case 5: // P5 ShortTail: yếu -> ưu tiên cầu 1–1 (đảo last)
                    return strong ? rawPick : Opp(last);

                case 6: // P6 DeepTail: yếu -> theo bệt
                    return strong ? rawPick : last;

                case 7: // P7 HighConf: yếu -> theo zigzag (nếu zigzag thì bẻ)
                    return strong ? rawPick : (isZigZag ? Opp(last) : last);

                case 8: // P8 Epsilon: yếu -> random
                    if (!strong) return (_rng.Next(2) == 0) ? 'C' : 'L';
                    return rawPick;

                case 9: // P9 Parachute: “dù phụ” — yếu -> theo bệt, nếu lossStreak riêng ≥3 thì đảo bệt
                    var st = _pm.GetStats(profIdx).CurrLossStreak;
                    return strong ? rawPick : (st >= 3 ? Opp(last) : last);
            }
            return rawPick;
        }

        public async Task RunAsync(GameContext ctx, CancellationToken ct)
        {
            ctx.Log?.Invoke($"[AI15] Start. state='{_statePath}', params='{GetParamPath()}', profiles='{GetProfilesPath()}'");

            // Warm-start 50 khi bật
            if (!_warmed)
            {
                var initSnap = ctx.GetSnap?.Invoke();
                string fullParity = SeqToParityString(initSnap?.seq ?? "");
                if (fullParity.Length >= 2)
                {
                    _model.WarmStart(fullParity, maxSteps: _warmSteps);
                    if (_saveAfterWarm) TrySaveModel();
                    ctx.Log?.Invoke($"[AI15] Warm-start: learned last {Math.Min(_warmSteps, fullParity.Length - 1)} & saved.");
                }
                else ctx.Log?.Invoke("[AI15] Warm-start skipped (history < 2).");
                _warmed = true;
            }

            var money = new MoneyManager(ctx.StakeSeq, ctx.MoneyStrategyId);

            // Đảm bảo save khi thoát/cancel
            try
            {
                while (true)
                {
                    ct.ThrowIfCancellationRequested();
                    await WaitUntilBetWindow(ctx, ct);

                    // ===== Lấy chuỗi trước khi đặt & CẮT VỀ 50 =====
                    var preSnap = ctx.GetSnap();
                    string preSeq = preSnap?.seq ?? "";
                    string preParityFull = SeqToParityString(preSeq);
                    string preParity = preParityFull.Length > 50 ? preParityFull[^50..] : preParityFull;

                    char last = preParity.Length > 0 ? preParity[^1] : 'C';
                    bool isZigZag = IsZigZag(preParity.AsSpan(), window: 12, thr: 0.70);

                    // 1) PLAN cho 10 profile
                    int P = _pm.Count;
                    var plannedPick = new char[P];
                    var plannedConf = new double[P];
                    for (int i = 0; i < P; i++)
                    {
                        var parTmp = _ap.Current.Copy();
                        _pm.ApplyProfile(i, parTmp);

                        if (_pm.GetAntiHold(i) > 0) // antiHold => theo bệt cưỡng bức
                        {
                            plannedPick[i] = last;
                            plannedConf[i] = 1.0;
                            continue;
                        }

                        _model.SetHyperparams(parTmp.KUseMax, parTmp.Alpha, parTmp.MinSupport,
                                              parTmp.RescaleThreshold, parTmp.TieBand, parTmp.MomentumGuard);

                        var (pi, ci, _) = _model.PredictWithConfidence(preParity);

                        // Chính sách theo profile
                        char gPick = ApplyProfilePolicy(i, pi, ci, last, isZigZag, parTmp);

                        // Giữ Epsilon riêng của profile (nếu có) để tăng đa dạng
                        if (parTmp.EpsGreedyBase > 0 && _rng.NextDouble() < parTmp.EpsGreedyBase)
                            gPick = (_rng.Next(2) == 0) ? 'C' : 'L';

                        plannedPick[i] = gPick;
                        plannedConf[i] = ci;
                    }

                    // Diversity guard: tất cả giống nhau & conf yếu -> ép P3/P4 đi ngược
                    if (plannedPick.Distinct().Count() == 1 && plannedConf.Count(c => c < 0.55) >= _pm.Count - 1)
                    {
                        if (P >= 5)
                        {
                            plannedPick[3] = Opp(plannedPick[3]);
                            plannedPick[4] = Opp(plannedPick[4]);
                            ctx.Log?.Invoke("[AI15] Diversity guard: force P3/P4 contrarian");
                        }
                    }

                    // LOG snapshot kế hoạch
                    LogProfilesSnapshot(ctx, plannedPick, plannedConf);

                    // 2) CHỌN PROFILE (chỉ đổi nếu ván trước thua) — Thompson Sampling + switchMargin ĐỘNG + regret
                    double driftBias = _drift.FollowBias();
                    int prevProfile = _currProfile;
                    int curLossStreak = (_currProfile >= 0) ? _pm.GetStats(_currProfile).CurrLossStreak : 0;
                    double regret = (_currProfile >= 0) ? _pm.GetStats(_currProfile).RegretRate12 : 0.0;

                    double switchMargin;
                    if (curLossStreak >= 4) switchMargin = -0.015;
                    else if (curLossStreak == 3) switchMargin = -0.010;
                    else if (curLossStreak == 2) switchMargin = 0.000;
                    else switchMargin = 0.010;

                    // Regret cao -> giảm margin thêm nữa (đổi nhanh hơn)
                    if (regret >= 0.50) switchMargin -= 0.015;
                    else if (regret >= 0.33) switchMargin -= 0.010;

                    if (_currProfile < 0)
                    {
                        _currProfile = _pm.SelectProfileIndexTS(driftBias);
                    }
                    else if (_lastRoundWin)
                    {
                        // win -> bám profile
                    }
                    else
                    {
                        _currProfile = _pm.SelectProfileIndexTSWithMargin(
                            driftBiasFollow: driftBias,
                            currentIdx: _currProfile,
                            switchMargin: switchMargin
                        );
                    }
                    int profIdx = _currProfile;

                    if (prevProfile != profIdx)
                    {
                        ctx.Log?.Invoke($"[AI15] SwitchProfile: {prevProfile} -> {profIdx} (lastWin={_lastRoundWin}, curStreak={curLossStreak}, regret={regret:0.00}, margin={switchMargin:0.000}, driftBias={driftBias:0.000})");
                    }
                    else
                    {
                        ctx.Log?.Invoke($"[AI15] KeepProfile: {profIdx} (lastWin={_lastRoundWin}, curStreak={curLossStreak}, regret={regret:0.00}, margin={switchMargin:0.000})");
                    }

                    // LOG profile đang dùng
                    LogActiveProfile(ctx, _currProfile);

                    // 3) ÁP THAM SỐ VÀ RA LỆNH ĐẶT
                    var parUsed = _ap.Current.Copy();
                    _pm.ApplyProfile(profIdx, parUsed);

                    if (_pm.GetStats(profIdx).CurrLossStreak >= 7) // parachute cấp 2
                    {
                        parUsed.TieBand = Math.Min(0.12, parUsed.TieBand + 0.03);
                        parUsed.ConfFollowThreshold = Math.Min(0.75, parUsed.ConfFollowThreshold + 0.03);
                        parUsed.MomentumGuard = Math.Max(3, parUsed.MomentumGuard - 1);
                    }
                    ApplyAdaptiveParamsToModel(parUsed);

                    char finalPick;
                    if (_pm.GetAntiHold(profIdx) > 0) finalPick = last; // cưỡng theo bệt
                    else
                    {
                        var (pick, conf, usedK) = _model.PredictWithConfidence(preParity);
                        finalPick = pick;

                        if (conf < parUsed.ConfFollowThreshold) finalPick = IsZigZag(preParity.AsSpan(), 12, 0.70) ? Opp(last) : last;
                        if (parUsed.EpsGreedyBase > 0 && _rng.NextDouble() < parUsed.EpsGreedyBase)
                            finalPick = (_rng.Next(2) == 0) ? 'C' : 'L';

                        ctx.Log?.Invoke($"[AI15] Prof[{profIdx}:{_pm.GetProfileName(profIdx)}] k={usedK}, conf={conf:0.000}, raw={ToSide(pick)} -> final={ToSide(finalPick)}, antiHold={_pm.GetAntiHold(profIdx)}; par={parUsed.Compact()}");
                    }

                    // 4) Random mode (yếu & gần 50–50)
                    const double CONF_WEAK = 0.55;
                    const double VOTE_TIE_BAND = 0.20;
                    int cVotes = plannedPick.Count(ch => ch == 'C');
                    int lVotes = plannedPick.Length - cVotes;
                    bool allWeak = plannedConf.All(c => c < CONF_WEAK);
                    bool nearTie = Math.Abs(cVotes - lVotes) <= (int)Math.Round(plannedPick.Length * VOTE_TIE_BAND);
                    if (allWeak && nearTie)
                    {
                        finalPick = (_rng.Next(2) == 0) ? 'C' : 'L';
                        ctx.Log?.Invoke($"[AI15] Random mode (weak & near-tie): votes C={cVotes}, L={lVotes}.");
                    }

                    string side = ToSide(finalPick);
                    long stake = money.GetStakeForThisBet();
                    await PlaceBet(ctx, side, stake, ct);

                    // 5) KẾT QUẢ
                    bool win = await WaitRoundFinishAndJudge(ctx, side, preSeq, ct);
                    _drift.Observe(win ? 1 : 0);
                    await ctx.UiDispatcher.InvokeAsync(() => ctx.UiAddWin?.Invoke(win ? stake : -stake));
                    money.OnRoundResult(win);

                    // 6) HỌC ONLINE — CHUẨN CỬA SỔ 50: so sánh trước–sau
                    var postSnap = ctx.GetSnap?.Invoke();
                    string postParityFull = SeqToParityString(postSnap?.seq ?? "");
                    string postParity = postParityFull.Length > 50 ? postParityFull[^50..] : postParityFull;

                    char actual;
                    if (!string.Equals(postParity, preParity, StringComparison.Ordinal))
                    {
                        // Chuỗi 50 đã "trôi" -> có ván mới, lấy ký tự cuối
                        actual = postParity[^1];
                        ctx.Log?.Invoke($"[AI15] observe parity diff: actual={ToSide(actual)}");
                    }
                    else
                    {
                        // UI chưa kịp đưa chuỗi 50 mới -> fallback từ kết quả đặt
                        actual = win ? finalPick : Opp(finalPick);
                        ctx.Log?.Invoke($"[AI15] fallback actual from bet: actual={ToSide(actual)} (window=50 unchanged)");
                    }

                    // Cập nhật mô hình với trạng thái TRƯỚC (preParity) & lịch lưu
                    _model.Update(preParity, actual);
                    _updatesSinceLastSave++;
                    if (_updatesSinceLastSave >= SAVE_EVERY_UPDATES)
                    {
                        TrySaveModel();
                        _pm.Save();
                        _updatesSinceLastSave = 0;
                    }

                    // 7) CẬP NHẬT 10 PROFILE (counterfactual: plays/wins/streak, Bayes, antiHold)
                    _pm.UpdateAfterRoundAll(plannedPick, actual);
                    _pm.UpdateBetaAll(plannedPick, actual);          // adaptive discount + rebase ở đây
                    _pm.UpdateAntiHoldAll(plannedPick, actual, _ap.Current);
                    LogRoundUpdate(ctx, actual, plannedPick);

                    // 7b) Cập nhật REGRET cho profile đang chạy
                    if (profIdx >= 0 && profIdx < _pm.Count)
                    {
                        bool activeWin = (plannedPick[profIdx] == actual);
                        bool someOtherWin = false;
                        for (int i = 0; i < _pm.Count; i++) { if (i != profIdx && plannedPick[i] == actual) { someOtherWin = true; break; } }
                        _pm.GetStats(profIdx).PushRegret(!activeWin && someOtherWin);
                    }

                    // 8) SIẾT profile có streak riêng ≥5; THẮNG -> decay siết
                    int tightened = _pm.TightenProfilesIfNeeded();
                    if (tightened > 0)
                    {
                        var idxs = Enumerable.Range(0, _pm.Count)
                                             .Where(i => _pm.GetStats(i).CurrLossStreak >= 5)
                                             .Select(i => $"{i}:{_pm.GetStats(i).CurrLossStreak}")
                                             .ToArray();
                        ctx.Log?.Invoke($"[AI15] Tighten profiles (>=5): {string.Join(", ", idxs)}");
                    }
                    if (win) _pm.DecayProfile(profIdx);

                    if (_drift.ShouldBiasFollow())
                        ctx.Log?.Invoke("[AI15] Drift detected -> bias Follow profiles for a few rounds.");

                    _lastRoundWin = win;
                    _pm.TickAntiHold(profIdx, win);
                }
            }
            finally
            {
                try
                {
                    SaveNow();
                    ctx.Log?.Invoke("[AI15] Save-on-exit done.");
                }
                catch { }
            }
        }

        public void SaveNow()
        {
            TrySaveModel();
            _pm.Save();
            _ap.Save();
        }

        private void TrySaveModel()
        {
            try
            {
                Directory.CreateDirectory(Path.GetDirectoryName(_statePath)!);
                var tmp = _statePath + ".tmp";
                _model.SaveToFile(tmp);
                if (File.Exists(_statePath)) File.Delete(_statePath);
                File.Move(tmp, _statePath);
            }
            catch (Exception ex) { System.Diagnostics.Debug.WriteLine($"[AI15] Save state failed: {ex.Message}"); }
        }

        // ====== LOG HELPERS ======
        private void LogActiveProfile(GameContext ctx, int idx)
        {
            if (ctx.Log == null) return;
            if (idx < 0) { ctx.Log("[AI15] ActiveProfile: <none>"); return; }

            var s = _pm.GetStats(idx);
            ctx.Log($"[AI15] ActiveProfile [{idx}:{_pm.GetProfileName(idx)}] " +
                    $"plays={s.Plays}, wins={s.Wins}, wr={s.WinRate:0.000}, " +
                    $"streak={s.CurrLossStreak}/{s.MaxLossStreak}, bayes={s.BayesMean:0.000}, " +
                    $"antiHold={_pm.GetAntiHold(idx)}, regret12={s.RegretRate12:0.00}");
        }

        private void LogProfilesSnapshot(GameContext ctx, char[] plannedPick, double[] plannedConf)
        {
            if (ctx.Log == null || plannedPick == null || plannedConf == null) return;
            int P = plannedPick.Length;
            ctx.Log("[AI15] --- Profiles PLAN snapshot ---");
            for (int i = 0; i < P; i++)
            {
                var st = _pm.GetStats(i);
                ctx.Log($"[AI15]  [{i}:{_pm.GetProfileName(i)}] " +
                        $"plan={ToSide(plannedPick[i])}@{plannedConf[i]:0.000}, " +
                        $"plays={st.Plays}, wins={st.Wins}, wr={st.WinRate:0.000}, " +
                        $"streak={st.CurrLossStreak}/{st.MaxLossStreak}, bayes={st.BayesMean:0.000}, " +
                        $"antiHold={_pm.GetAntiHold(i)}, regret12={st.RegretRate12:0.00}");
            }
        }

        private void LogRoundUpdate(GameContext ctx, char actual, char[] plannedPick)
        {
            if (ctx.Log == null || plannedPick == null) return;
            int P = plannedPick.Length;
            var winners = new List<string>();
            var losers = new List<string>();
            for (int i = 0; i < P; i++)
            {
                bool w = (plannedPick[i] == actual);
                var st = _pm.GetStats(i);
                var cell = $"{i}:{(w ? "W" : "L")}({st.CurrLossStreak})";
                if (w) winners.Add(cell); else losers.Add(cell);
            }
            ctx.Log($"[AI15] RoundResult actual={ToSide(actual)} | winners=[{string.Join(", ", winners)}] | losers=[{string.Join(", ", losers)}]");
        }

        // ================== N-GRAM MODEL ==================
        private sealed class NGramOnlineModel
        {
            private readonly int _kMax;
            private int _kUseMax;
            private double _alpha;
            private int _minSupport;
            private double _rescaleThreshold;
            private readonly bool _tieUsesOppLast;

            private int _momentumGuard = 5;
            private double _tieBand = 0.02;

            private readonly Dictionary<int, (double c, double l)>[] _tables;

            public NGramOnlineModel(int kMax, double alpha, int minSupport, double rescaleThreshold, bool tieUsesOppLast)
            {
                _kMax = Math.Max(1, kMax);
                _kUseMax = _kMax;
                _alpha = Math.Max(0.0, alpha);
                _minSupport = Math.Max(0, minSupport);
                _rescaleThreshold = Math.Max(10.0, rescaleThreshold);
                _tieUsesOppLast = tieUsesOppLast;

                _tables = new Dictionary<int, (double c, double l)>[_kMax + 1];
                for (int k = 0; k <= _kMax; k++)
                    _tables[k] = new Dictionary<int, (double c, double l)>(capacity: 1 << Math.Min(k, 12));
            }

            public void SetHyperparams(int kUseMax, double alpha, int minSupport, double rescaleThreshold, double tieBand, int momentumGuard)
            {
                _kUseMax = Math.Max(1, Math.Min(kUseMax, _kMax));
                _alpha = Math.Max(0.0, alpha);
                _minSupport = Math.Max(0, minSupport);
                _rescaleThreshold = Math.Max(10.0, rescaleThreshold);
                _tieBand = Math.Clamp(tieBand, 0.0, 0.5);
                _momentumGuard = Math.Max(1, momentumGuard);
            }

            private static int EncodeTailBits(ReadOnlySpan<char> p, int k)
            {
                int bits = 0, n = p.Length;
                for (int i = Math.Max(0, n - k); i < n; i++)
                    bits = (bits << 1) | (p[i] == 'L' ? 1 : 0); // C=0, L=1
                return bits;
            }

            private static int TailRunLength(ReadOnlySpan<char> p)
            {
                int n = p.Length; if (n == 0) return 0;
                char last = p[n - 1]; int run = 0;
                for (int i = n - 1; i >= 0 && p[i] == last; i--) run++;
                return run;
            }

            public (char next, double conf, int usedK) PredictWithConfidence(string parity)
            {
                if (string.IsNullOrEmpty(parity)) return ('C', 0.0, 0);
                char last = parity[^1];

                int run = TailRunLength(parity);
                if (run >= _momentumGuard) return (last, 1.0, -1); // bệt dài -> theo bệt

                for (int k = Math.Min(_kUseMax, parity.Length); k >= 1; k--)
                {
                    if (parity.Length < k) continue;
                    int key = EncodeTailBits(parity, k);
                    var tab = _tables[k];

                    if (tab.TryGetValue(key, out var cnt))
                    {
                        double total = cnt.c + cnt.l;
                        if (total >= _minSupport)
                        {
                            double pC = (cnt.c + _alpha) / (total + 2.0 * _alpha);

                            if (Math.Abs(pC - 0.5) < 1e-12) return (last, 0.5, k); // hòa tuyệt đối -> THEO BỆT
                            if (Math.Abs(pC - 0.5) <= _tieBand) return (last, 0.5, k);

                            double conf = Math.Abs(pC - 0.5) * 2.0;
                            return (pC >= 0.5) ? ('C', conf, k) : ('L', conf, k);
                        }
                    }
                }
                return (last, 0.0, 0); // không đủ support -> THEO BỆT
            }

            public void Update(string preParity, char actual)
            {
                if (preParity.Length == 0) return;

                for (int k = 1; k <= _kMax; k++)
                {
                    if (preParity.Length < k) break;
                    int key = EncodeTailBits(preParity, k);
                    var tab = _tables[k];
                    if (!tab.TryGetValue(key, out var cnt)) cnt = (0, 0);

                    if (actual == 'C') cnt.c += 1.0; else cnt.l += 1.0;

                    double total = cnt.c + cnt.l;
                    if (total >= _rescaleThreshold) { cnt.c *= 0.5; cnt.l *= 0.5; }
                    tab[key] = cnt;
                }
            }

            public void WarmStart(string fullParity, int maxSteps = 50)
            {
                if (string.IsNullOrEmpty(fullParity)) return;
                int n = fullParity.Length; if (n <= 1) return;

                int start = Math.Max(1, n - maxSteps);
                for (int t = start; t < n; t++)
                {
                    string pre = fullParity.Substring(0, t);
                    char actual = fullParity[t];
                    Update(pre, actual);
                }
            }

            // persist JSON
            private sealed class TableDTO { public Dictionary<string, double[]> Rows { get; set; } = new(); }
            private sealed class StateDTO
            {
                public int KMax { get; set; }
                public double Alpha { get; set; }
                public int MinSupport { get; set; }
                public double RescaleThreshold { get; set; }
                public bool TieUsesOppLast { get; set; }
                public long UpdatedAtUtc { get; set; }
                public List<TableDTO> Tables { get; set; } = new();
            }

            public void SaveToFile(string path)
            {
                var dto = new StateDTO
                {
                    KMax = _kMax,
                    Alpha = _alpha,
                    MinSupport = _minSupport,
                    RescaleThreshold = _rescaleThreshold,
                    TieUsesOppLast = _tieUsesOppLast,
                    UpdatedAtUtc = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
                };
                for (int k = 0; k <= _kMax; k++)
                {
                    var t = new TableDTO();
                    foreach (var kv in _tables[k])
                        t.Rows[kv.Key.ToString()] = new[] { kv.Value.c, kv.Value.l };
                    dto.Tables.Add(t);
                }
                var json = JsonSerializer.Serialize(dto, new JsonSerializerOptions { WriteIndented = false });
                File.WriteAllText(path, json);
            }

            public void LoadFromFile(string path)
            {
                var json = File.ReadAllText(path);
                var dto = JsonSerializer.Deserialize<StateDTO>(json);
                if (dto == null) throw new InvalidDataException("State JSON empty.");

                int kLoad = Math.Min(_kMax, dto.KMax);
                for (int k = 0; k <= _kMax; k++) _tables[k].Clear();

                for (int k = 0; k <= kLoad; k++)
                {
                    var t = (dto.Tables != null && dto.Tables.Count > k) ? dto.Tables[k] : null;
                    if (t == null || t.Rows == null) continue;

                    foreach (var kv in t.Rows)
                        if (int.TryParse(kv.Key, out int key) && kv.Value is { Length: >= 2 })
                            _tables[k][key] = (kv.Value[0], kv.Value[1]);
                }
            }
        }

        // ===== Adaptive params (giữ tương thích) =====
        private sealed class AdaptiveParamController
        {
            private readonly string _path;
            private AdaptiveState _state;

            public AdaptiveParamController(string path)
            {
                _path = path;
                _state = LoadFromFile(path) ?? AdaptiveState.Default();
                _state.Current.Clamp();
                _state.Baseline.Clamp();
            }

            public AdaptiveParams Current => _state.Current;

            public void Save()
            {
                try
                {
                    Directory.CreateDirectory(Path.GetDirectoryName(_path)!);
                    var tmp = _path + ".tmp";
                    var json = JsonSerializer.Serialize(_state, new JsonSerializerOptions { WriteIndented = false });
                    File.WriteAllText(tmp, json);
                    if (File.Exists(_path)) File.Delete(_path);
                    File.Move(tmp, _path);
                }
                catch { }
            }

            private static AdaptiveState? LoadFromFile(string path)
            {
                try
                {
                    if (!File.Exists(path)) return null;
                    var json = File.ReadAllText(path);
                    return JsonSerializer.Deserialize<AdaptiveState>(json);
                }
                catch { return null; }
            }
        }

        private sealed class AdaptiveParams
        {
            public int KUseMax { get; set; } = 6;
            public double Alpha { get; set; } = 1.0;
            public int MinSupport { get; set; } = 3;
            public double RescaleThreshold { get; set; } = 1000;
            public double TieBand { get; set; } = 0.02;
            public int MomentumGuard { get; set; } = 5;

            public double ConfFollowThreshold { get; set; } = 0.58;
            public int AntiStreakTrigger { get; set; } = 3;
            public int AntiStreakHold { get; set; } = 2;

            public double EpsGreedyBase { get; set; } = 0.0;

            public AdaptiveParams Copy() => (AdaptiveParams)MemberwiseClone();

            public void Clamp()
            {
                KUseMax = Math.Clamp(KUseMax, 1, 6);
                Alpha = Math.Clamp(Alpha, 0.0, 3.0);
                MinSupport = Math.Clamp(MinSupport, 1, 6);
                RescaleThreshold = Math.Clamp(RescaleThreshold, 100, 10000);
                TieBand = Math.Clamp(TieBand, 0.0, 0.2);
                MomentumGuard = Math.Clamp(MomentumGuard, 1, 10);
                ConfFollowThreshold = Math.Clamp(ConfFollowThreshold, 0.50, 0.80);
                AntiStreakTrigger = Math.Clamp(AntiStreakTrigger, 2, 6);
                AntiStreakHold = Math.Clamp(AntiStreakHold, 1, 6);
                EpsGreedyBase = Math.Clamp(EpsGreedyBase, 0.0, 0.20);
            }

            public string Compact()
                => $"P[k={KUseMax},ms={MinSupport},rb={RescaleThreshold},tb={TieBand:0.00},mg={MomentumGuard},cg={ConfFollowThreshold:0.00},eg={EpsGreedyBase:0.00},as={AntiStreakTrigger}/{AntiStreakHold}]";
        }

        private sealed class AdaptiveState
        {
            public AdaptiveParams Current { get; set; } = new AdaptiveParams();
            public AdaptiveParams Baseline { get; set; } = new AdaptiveParams();
            public static AdaptiveState Default() => new AdaptiveState();
        }

        // ===== Profile + Stats + Bandit (TS) + antiHold =====
        private sealed class ProfileSpec
        {
            public string Name { get; set; } = "Profile";
            public double WKUseMax { get; set; } = 1.0;
            public int AddMinSupport { get; set; } = 0;
            public double WRescale { get; set; } = 1.0;
            public double AddTieBand { get; set; } = 0.0;
            public int AddMomentumGuard { get; set; } = 0;
            public double AddConfGate { get; set; } = 0.0;
            public double Eps { get; set; } = 0.0;
            public int AddAntiHold { get; set; } = 0;

            // Siết tích lũy (khi thua dây)
            public double TightenTieBand { get; set; } = 0.0;
            public double TightenConfGate { get; set; } = 0.0;
            public int TightenMomentum { get; set; } = 0;
            public double TightenRescaleW { get; set; } = 1.0;
            public double TightenKUseW { get; set; } = 1.0;
            public int TightenAntiHold { get; set; } = 0;

            public void Apply(AdaptiveParams p)
            {
                p.KUseMax = (int)Math.Round(Math.Clamp(p.KUseMax * (WKUseMax * TightenKUseW), 1, 6));
                p.MinSupport = Math.Clamp(p.MinSupport + AddMinSupport, 1, 6);
                p.RescaleThreshold = Math.Clamp(p.RescaleThreshold * (WRescale * TightenRescaleW), 100, 10000);
                p.TieBand = Math.Clamp(p.TieBand + AddTieBand + TightenTieBand, 0.0, 0.2);
                p.MomentumGuard = Math.Clamp(p.MomentumGuard + AddMomentumGuard + TightenMomentum, 1, 10);
                p.ConfFollowThreshold = Math.Clamp(p.ConfFollowThreshold + AddConfGate + TightenConfGate, 0.50, 0.80);
                p.AntiStreakHold = Math.Clamp(p.AntiStreakHold + AddAntiHold + TightenAntiHold, 1, 6);
                p.EpsGreedyBase = Math.Clamp(Math.Max(p.EpsGreedyBase, Eps), 0.0, 0.20);
            }

            public void Tighten(bool strong)
            {
                if (strong)
                {
                    TightenTieBand = Math.Max(TightenTieBand, 0.08); TightenConfGate = Math.Max(TightenConfGate, 0.06);
                    TightenMomentum = Math.Min(TightenMomentum, -2); TightenRescaleW = Math.Min(TightenRescaleW, 0.70);
                    TightenKUseW = Math.Min(TightenKUseW, 0.80); TightenAntiHold = Math.Max(TightenAntiHold, 2);
                }
                else
                {
                    TightenTieBand = Math.Max(TightenTieBand, 0.05); TightenConfGate = Math.Max(TightenConfGate, 0.02);
                    TightenMomentum = Math.Min(TightenMomentum, -1); TightenRescaleW = Math.Min(TightenRescaleW, 0.85);
                    TightenKUseW = Math.Min(TightenKUseW, 0.90); TightenAntiHold = Math.Max(TightenAntiHold, 1);
                }
            }
            public void DecayTighten()
            {
                TightenTieBand = Math.Max(0.0, TightenTieBand - 0.01);
                TightenConfGate = Math.Max(0.0, TightenConfGate - 0.01);
                if (TightenMomentum < 0) TightenMomentum += 1;
                TightenRescaleW = Math.Min(1.0, TightenRescaleW + 0.02);
                TightenKUseW = Math.Min(1.0, TightenKUseW + 0.02);
                if (TightenAntiHold > 0) TightenAntiHold -= 1;
            }
        }

        private sealed class ProfileStats
        {
            public string Name { get; set; } = "Profile";
            public int Plays { get; set; } = 0;
            public int Wins { get; set; } = 0;
            public int CurrLossStreak { get; set; } = 0;
            public int MaxLossStreak { get; set; } = 0;

            public double BetaA { get; set; } = 1.0; // TS
            public double BetaB { get; set; } = 1.0;

            // Regret trong 12 ván gần nhất (khi active thua nhưng có profile khác đúng)
            public int RegretSum12 { get; set; } = 0;
            private readonly Queue<int> _rg = new Queue<int>(12);
            public double RegretRate12 => _rg.Count == 0 ? 0.0 : (double)RegretSum12 / _rg.Count;

            public double WinRate => Plays > 0 ? (double)Wins / Plays : 0.5;
            public double BayesMean => (BetaA) / (BetaA + BetaB);

            public void PushRegret(bool regret)
            {
                int v = regret ? 1 : 0;
                _rg.Enqueue(v); RegretSum12 += v;
                if (_rg.Count > 12) RegretSum12 -= _rg.Dequeue();
            }

            public void OnRound(bool win)
            {
                Plays++;
                if (win) { Wins++; CurrLossStreak = 0; }
                else { CurrLossStreak++; if (CurrLossStreak > MaxLossStreak) MaxLossStreak = CurrLossStreak; }
            }

            public void BetaDiscount(double gamma)
            {
                BetaA = 1.0 + (BetaA - 1.0) * gamma;
                BetaB = 1.0 + (BetaB - 1.0) * gamma;
            }

            public void BetaUpdate(bool win)
            {
                if (win) BetaA += 1.0;
                else BetaB += 1.0;
            }

            // Chặn Beta phình quá to -> giữ “ký ức hiệu dụng” hữu hạn
            public void RebaseBeta(int maxEff = 200)
            {
                double eff = (BetaA - 1.0) + (BetaB - 1.0);
                if (eff <= maxEff) return;
                double scale = maxEff / eff;
                BetaA = 1.0 + (BetaA - 1.0) * scale;
                BetaB = 1.0 + (BetaB - 1.0) * scale;
            }
        }

        private sealed class ProfileManager
        {
            private readonly string _path;
            private readonly List<ProfileSpec> _profiles;
            private readonly List<ProfileStats> _stats;
            private readonly int[] _antiHold;

            // Phạt rủi ro (tăng nhẹ) để bớt ì
            private const double LAMBDA_CURR = 0.20;  // phạt chuỗi thua hiện tại
            private const double MU_MAX = 0.12;       // phạt chuỗi thua lớn nhất lịch sử
            private const int STREAK_NORM = 10;       // chuẩn hóa chuỗi thua

            // mặc định trước kia: 0.995 — nay dùng adaptive, nhưng vẫn giữ fallback
            private const double BETA_DISCOUNT_DEFAULT = 0.993;

            public int Count => 10;

            public ProfileManager(string path)
            {
                _path = path;
                var loaded = Load(path);
                if (loaded != null) { _profiles = loaded.Value.profiles; _stats = loaded.Value.stats; _antiHold = loaded.Value.antiHold; }
                else { _profiles = BuildDefaultProfiles(); _stats = BuildDefaultStats(); _antiHold = new int[10]; }

                while (_profiles.Count < 10) _profiles.Add(new ProfileSpec { Name = $"P{_profiles.Count}" });
                while (_stats.Count < 10) _stats.Add(new ProfileStats { Name = _profiles[_stats.Count].Name });
                if (_antiHold.Length < 10) Array.Resize(ref _antiHold, 10);

                for (int i = 0; i < 10; i++) _stats[i].Name = _profiles[i].Name;
            }

            public int GetAntiHold(int idx) => _antiHold[idx];
            public ProfileStats GetStats(int idx) => _stats[idx];
            public string GetProfileName(int idx) => _profiles[idx].Name;

            public void ApplyProfile(int idx, AdaptiveParams p) => _profiles[idx].Apply(p);

            public AdaptiveParams BuildParamsForProfile(int idx, AdaptiveParams baseline)
            {
                var p = baseline.Copy(); _profiles[idx].Apply(p); return p;
            }

            // ====== Thompson Sampling chọn profile lần tới ======
            public int SelectProfileIndexTS(double driftBiasFollow)
            {
                int bestIdx = 0; double bestScore = double.NegativeInfinity;
                var rng = new Random();

                for (int i = 0; i < 10; i++)
                {
                    var s = _stats[i];
                    // mẫu beta
                    double theta = SampleBeta(s.BetaA, s.BetaB, rng);
                    // phạt rủi ro
                    double pen = LAMBDA_CURR * s.CurrLossStreak / STREAK_NORM
                               + MU_MAX * s.MaxLossStreak / STREAK_NORM;
                    // bias drift cho nhóm theo bệt (P1/P2/P9)
                    double bias = (driftBiasFollow > 0 && (i == 1 || i == 2 || i == 9)) ? driftBiasFollow : 0.0;

                    double score = theta - pen + bias;
                    if (score > bestScore) { bestScore = score; bestIdx = i; }
                }
                return bestIdx;
            }

            public int SelectProfileIndexTSWithMargin(double driftBiasFollow, int currentIdx, double switchMargin)
            {
                int bestIdx = SelectProfileIndexTS(driftBiasFollow);
                if (currentIdx < 0 || currentIdx >= 10) return bestIdx;

                // So sánh "kỳ vọng" (BayesMean - penalties) để tránh đổi do nhiễu
                double currBase = ExpectedScore(currentIdx, driftBiasFollow);
                double bestBase = ExpectedScore(bestIdx, driftBiasFollow);

                return (bestBase >= currBase + switchMargin) ? bestIdx : currentIdx;
            }

            private double ExpectedScore(int i, double driftBiasFollow)
            {
                var s = _stats[i];
                double mean = s.BayesMean;
                double pen = LAMBDA_CURR * s.CurrLossStreak / STREAK_NORM
                           + MU_MAX * s.MaxLossStreak / STREAK_NORM;
                double bias = (driftBiasFollow > 0 && (i == 1 || i == 2 || i == 9)) ? driftBiasFollow : 0.0;
                return mean - pen + bias;
            }

            private static double SampleBeta(double a, double b, Random rng)
            {
                // Marsaglia-Tsang gamma sampling (shape > 0)
                double x = SampleGamma(a, rng);
                double y = SampleGamma(b, rng);
                return (x <= 0 && y <= 0) ? 0.5 : (x / (x + y));
            }

            private static double SampleGamma(double shape, Random rng)
            {
                if (shape < 1.0)
                {
                    // Johnk's generator
                    while (true)
                    {
                        double u = rng.NextDouble();
                        double v = rng.NextDouble();
                        double x = Math.Pow(u, 1.0 / shape);
                        double y = Math.Pow(v, 1.0 / (1.0 - shape));
                        if (x + y <= 1.0) return -Math.Log(rng.NextDouble()) * x / (x + y);
                    }
                }
                // Marsaglia-Tsang for k >= 1
                double d = shape - 1.0 / 3.0;
                double c = 1.0 / Math.Sqrt(9.0 * d);
                while (true)
                {
                    double z, u;
                    do
                    {
                        // standard normal via Box-Muller
                        double u1 = rng.NextDouble();
                        double u2 = rng.NextDouble();
                        z = Math.Sqrt(-2.0 * Math.Log(u1)) * Math.Cos(2.0 * Math.PI * u2);
                        u = rng.NextDouble();
                    } while (double.IsNaN(z));

                    double v = 1.0 + c * z;
                    if (v <= 0) continue;
                    v = v * v * v;
                    if (u < 1.0 - 0.331 * z * z * z * z) return d * v;
                    if (Math.Log(u) < 0.5 * z * z + d * (1 - v + Math.Log(v))) return d * v;
                }
            }

            public void UpdateAfterRoundAll(char[] planned, char actual)
            {
                if (planned == null || planned.Length < 10) return;
                for (int i = 0; i < 10; i++)
                {
                    bool w = (planned[i] == actual);
                    _stats[i].OnRound(w);
                }
            }

            // === ADAPTIVE DISCOUNT + REBASE: tránh ì khi dữ liệu cũ quá lớn ===
            public void UpdateBetaAll(char[] planned, char actual)
            {
                if (planned == null || planned.Length < 10) return;
                for (int i = 0; i < 10; i++)
                {
                    // 1) Adaptive discount theo chuỗi thua hiện tại của profile i
                    int s = _stats[i].CurrLossStreak;
                    double gamma =
                        s >= 4 ? 0.975 :
                        s == 3 ? 0.980 :
                        s == 2 ? 0.985 :
                                 BETA_DISCOUNT_DEFAULT;

                    _stats[i].BetaDiscount(gamma);

                    // 2) Cập nhật kết quả
                    bool w = (planned[i] == actual);
                    _stats[i].BetaUpdate(w);

                    // 3) Rebase Beta để tránh phình quá lớn
                    _stats[i].RebaseBeta(maxEff: 200);
                    if (s >= 4) _stats[i].RebaseBeta(maxEff: 160); // thua dây mạnh -> co ký ức mạnh hơn
                }
            }

            public void UpdateAntiHoldAll(char[] planned, char actual, AdaptiveParams baseline)
            {
                if (planned == null || planned.Length < 10) return;
                for (int i = 0; i < 10; i++)
                {
                    bool w = (planned[i] == actual);
                    var p = BuildParamsForProfile(i, baseline);
                    if (w) _antiHold[i] = Math.Max(0, _antiHold[i] - 1);
                    else
                    {
                        if (_stats[i].CurrLossStreak >= p.AntiStreakTrigger)
                            _antiHold[i] = Math.Max(_antiHold[i], p.AntiStreakHold);
                        else if (_antiHold[i] > 0) _antiHold[i] -= 1;
                    }
                }
            }

            public void TickAntiHold(int profIdx, bool winPlaced)
            {
                if (profIdx < 0 || profIdx >= 10) return;
                if (winPlaced) _antiHold[profIdx] = Math.Max(0, _antiHold[profIdx] - 1);
                else if (_antiHold[profIdx] > 0) _antiHold[profIdx] -= 1;
            }

            public int TightenProfilesIfNeeded()
            {
                int cnt = 0;
                for (int i = 0; i < 10; i++)
                {
                    int s = _stats[i].CurrLossStreak;
                    if (s >= 5)
                    {
                        bool strong = s >= 8;
                        _profiles[i].Tighten(strong);
                        cnt++;
                    }
                }
                if (cnt > 0) Save();
                return cnt;
            }

            public void DecayProfile(int idx)
            {
                if (idx < 0 || idx >= 10) return;
                _profiles[idx].DecayTighten();
                Save();
            }

            public void Save()
            {
                try
                {
                    Directory.CreateDirectory(Path.GetDirectoryName(_path)!);
                    var dto = new PersistDTO { Profiles = _profiles, Stats = _stats, AntiHold = _antiHold };
                    var tmp = _path + ".tmp";
                    File.WriteAllText(tmp, JsonSerializer.Serialize(dto, new JsonSerializerOptions { WriteIndented = false }));
                    if (File.Exists(_path)) File.Delete(_path);
                    File.Move(tmp, _path);
                }
                catch { }
            }

            private static (List<ProfileSpec> profiles, List<ProfileStats> stats, int[] antiHold)? Load(string path)
            {
                try
                {
                    if (!File.Exists(path)) return null;
                    var dto = JsonSerializer.Deserialize<PersistDTO>(File.ReadAllText(path));
                    if (dto?.Profiles == null || dto.Stats == null || dto.AntiHold == null) return null;
                    return (dto.Profiles, dto.Stats, dto.AntiHold);
                }
                catch { return null; }
            }

            private static List<ProfileSpec> BuildDefaultProfiles()
            {
                return new List<ProfileSpec>
                {
                    new ProfileSpec { Name="P0-Balanced" },

                    new ProfileSpec { Name="P1-Follow-Lite",  AddTieBand=0.02, AddConfGate=0.02, AddMomentumGuard=-1, AddMinSupport=+1 },
                    new ProfileSpec { Name="P2-Follow-Heavy", AddTieBand=0.06, AddConfGate=0.06, AddMomentumGuard=-2, AddMinSupport=+2, WKUseMax=0.8, WRescale=0.7 },

                    new ProfileSpec { Name="P3-Flip-Lite",    AddConfGate=-0.02, AddMomentumGuard=+1 },
                    new ProfileSpec { Name="P4-Flip-Aggr",    AddTieBand=-0.01, AddConfGate=-0.04, AddMomentumGuard=+2, WRescale=1.2 },

                    new ProfileSpec { Name="P5-ShortTail",    WKUseMax=0.6, AddMinSupport=+1, WRescale=0.7 },
                    new ProfileSpec { Name="P6-DeepTail",     WKUseMax=1.0, AddMinSupport=+2, WRescale=1.3 },

                    new ProfileSpec { Name="P7-HighConf",     AddConfGate=+0.08, AddTieBand=+0.04, AddMinSupport=+2 },
                    new ProfileSpec { Name="P8-Epsilon",      Eps=0.08, AddTieBand=+0.02 },
                    new ProfileSpec { Name="P9-Parachute",    AddTieBand=+0.08, AddConfGate=+0.06, AddMomentumGuard=-2, AddAntiHold=+2, WKUseMax=0.8, WRescale=0.7 }
                };
            }

            private static List<ProfileStats> BuildDefaultStats()
            {
                var names = BuildDefaultProfiles().Select(p => p.Name).ToList();
                return names.Select(n => new ProfileStats { Name = n }).ToList();
            }

            private sealed class PersistDTO
            {
                public List<ProfileSpec> Profiles { get; set; } = new();
                public List<ProfileStats> Stats { get; set; } = new();
                public int[] AntiHold { get; set; } = new int[10];
            }
        }

        // ===== Drift detector (Page-Hinkley nhẹ) =====
        private sealed class DriftDetector
        {
            private double _mean = 0.5;
            private double _sum = 0.0;
            private double _minSum = 0.0;
            private int _biasRounds = 0;

            private const double ALPHA = 0.01;
            private const double DELTA = 0.05;
            private const double LAMBDA = 0.20;
            private const int BIAS_HOLD_ROUNDS = 12;

            public void Observe(int win01)
            {
                _mean = (1 - ALPHA) * _mean + ALPHA * win01;
                double x = (_mean - win01) - DELTA;
                _sum += x;
                if (_sum < _minSum) _minSum = _sum;

                if ((_sum - _minSum) > LAMBDA)
                {
                    _biasRounds = BIAS_HOLD_ROUNDS;
                    _sum = 0.0; _minSum = 0.0;
                }

                if (_biasRounds > 0) _biasRounds--;
            }

            public double FollowBias() => _biasRounds > 0 ? 0.02 : 0.0;
            public bool ShouldBiasFollow() => _biasRounds > 0;
        }
    }
}
