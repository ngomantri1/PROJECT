// Tasks/AiOnlineNGramTask.cs
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;
using static XocDiaLiveHit1.Tasks.TaskUtil;

namespace XocDiaLiveHit1.Tasks
{
    /// <summary>
    /// 14) AI học tại chỗ (n-gram) — đặt liên tục, học online, nâng có kiểm soát khi s≥SafetyTrigger/s≥8.
    /// - Warm-start 50 kết quả khi bật, lưu state ngay.
    /// - Quyết định: N-gram + Laplace + backoff; chỉ RANDOM khi undecidable.
    /// - Escalate 1 lần/episode tại s≥SafetyTrigger (+1 lần nếu s≥8), ease-in theo tổng episode; auto-decay khi ổn định (lenient).
    /// - Persist n-gram & tham số/state (v2) để kế thừa lần sau.
    /// </summary>
    public sealed class AiOnlineNGramTask : IBetTask
    {
        public string DisplayName => "14) AI học tại chỗ (n-gram)";
        public string Id => "ai-online-ngram";

        private readonly NGramModel _model;
        private readonly string _statePath;
        private readonly int _warmSteps;
        private readonly bool _saveAfterWarm;

        // Tham số + trạng thái thích nghi (persist)
        private readonly AdaptiveParams _ap;
        private readonly AdaptiveState _st;

        // runtime
        private bool _warmed = false;
        private int _updatesSinceLastSave = 0;
        private int _lossStreak = 0;

        private const int SAVE_EVERY_UPDATES = 5;
        private static readonly Random _rng = new Random();

        public AiOnlineNGramTask() : this(null, warmStartSteps: 50, saveImmediatelyAfterWarm: true) { }

        public AiOnlineNGramTask(string statePath, int warmStartSteps = 50, bool saveImmediatelyAfterWarm = true)
        {
            _model = new NGramModel(
                kMax: 6,
                alpha: 1.0,
                rescaleThreshold: 600   // GIẢM từ 1000 xuống 600 để bám trend nhanh hơn
            );

            _statePath = !string.IsNullOrWhiteSpace(statePath) ? statePath : GetDefaultStatePath();
            _warmSteps = Math.Max(1, warmStartSteps);
            _saveAfterWarm = saveImmediatelyAfterWarm;

            // nạp state n-gram nếu có
            if (File.Exists(_statePath))
            {
                try { _model.LoadFromFile(_statePath); }
                catch (Exception ex) { System.Diagnostics.Debug.WriteLine($"[AI-NGram] Load state failed: {ex.Message}"); }
            }

            // nạp params/state thích nghi (v2) & clamp
            _ap = AdaptiveParams.LoadOrDefault(GetParamPath());
            _st = AdaptiveState.LoadOrDefault(GetStatePathV2());
            _ap.Clamp();
            _st.Clamp();
        }

        // ===== đường dẫn =====
        private static string AppLocalDir()
            => Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "XocDiaLiveHit1", "ai");

        private static string GetDefaultStatePath()
        {
            var dir = AppLocalDir();
            Directory.CreateDirectory(dir);
            return Path.Combine(dir, "ngram_state_v2.json");
        }

        private static string GetParamPath()
        {
            var dir = AppLocalDir();
            Directory.CreateDirectory(dir);
            return Path.Combine(dir, "ngram_params_v2.json");
        }

        private static string GetStatePathV2()
        {
            var dir = AppLocalDir();
            Directory.CreateDirectory(dir);
            return Path.Combine(dir, "ngram_adaptive_state_v2.json");
        }

        private static string ToSide(char c) => c == 'C' ? "CHAN" : "LE";

        // ======================== RUN LOOP ========================
        public async Task RunAsync(GameContext ctx, CancellationToken ct)
        {
            ctx.Log?.Invoke($"[AI-NGram] Start. state='{_statePath}', params='{GetParamPath()}', ast='{GetStatePathV2()}'");
            ctx.Log?.Invoke($"[AI-NGram] Base: {_ap.BaseCompact()} | SafetyTrigger={_ap.SafetyTrigger} | Caps S5/S8 | EaseIn τ={_ap.TauEaseIn}");

            // --- Warm-start 50 & lưu ngay (mỗi lần bật) ---
            if (!_warmed)
            {
                var initSnap = ctx.GetSnap?.Invoke();
                string fullParity = SeqToParityString(initSnap?.seq ?? "");
                if (fullParity.Length >= 2)
                {
                    _model.WarmStart(fullParity, maxSteps: _warmSteps);
                    if (_saveAfterWarm) TrySaveModel();
                    ctx.Log?.Invoke($"[AI-NGram] Warm-start: learned last {Math.Min(_warmSteps, fullParity.Length - 1)} results & saved.");
                }
                else
                {
                    ctx.Log?.Invoke("[AI-NGram] Warm-start skipped (history < 2).");
                }
                _warmed = true;
            }

            var money = new MoneyManager(ctx.StakeSeq, ctx.MoneyStrategyId);

            // ===== vòng đánh liên tục =====
            while (true)
            {
                ct.ThrowIfCancellationRequested();

                await WaitUntilNewRoundStart(ctx, ct);

                var preSnap = ctx.GetSnap();
                string preSeq = preSnap?.seq ?? "";
                string preParity = SeqToParityString(preSeq);

                // 1) Tính tham số hiệu lực (ease-in theo SafetyEscalations & S5/S8 flags)
                var eff = EffectiveFrom(_ap, _st);

                // 2) Tính score/conf/kUsed/support theo N-gram
                var (score, conf, usedK, support) = _model.ScoreAndConfidence(preParity, eff.KUseMax, eff.MinSupport);

                // 3) Xác định undecidable (gating)
                bool undecidable =
                    usedK <= 0 || usedK > eff.KUseMax ||
                    support < eff.MinSupport ||
                    Math.Abs(score) < eff.TieBand ||
                    conf < eff.ConfFollowThreshold ||
                    double.IsNaN(score) || double.IsNaN(conf);

                // 4) Chọn cửa: N-gram bình thường; chỉ random khi undecidable
                char finalPick;
                if (undecidable)
                {
                    finalPick = _rng.NextDouble() < 0.5 ? 'C' : 'L';
                }
                else
                {
                    finalPick = (score >= 0) ? 'C' : 'L';
                }

                string side = ToSide(finalPick);
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

                ctx.Log?.Invoke($"[AI-NGram] k={usedK}, sup={support}, score={score:0.000}, conf={conf:0.000} -> final={side}, stake={stake:N0}, lossStreak={_lossStreak}; Eff[{eff.Compact()}] Esc(E={_st.SafetyEscalations},S5={_st.DidEscS5ThisEpisode},S8={_st.DidEscS8ThisEpisode},Hold={_st.SafetyHoldLeft})");

                await PlaceBet(ctx, side, stake, ct);

                // 5) Kết quả ván
                bool win = await WaitRoundFinishAndJudge(ctx, side, preSeq, ct);
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

                // 6) cập nhật loss streak
                _lossStreak = win ? 0 : _lossStreak + 1;

                // 7) Học online từ kết quả thực
                var postSnap = ctx.GetSnap?.Invoke();
                string postParity = SeqToParityString(postSnap?.seq ?? "");
                if (postParity.Length >= preParity.Length + 1)
                {
                    char actual = postParity[^1];
                    _model.Update(preParity, actual);
                    _updatesSinceLastSave++;
                    if (_updatesSinceLastSave >= SAVE_EVERY_UPDATES)
                    {
                        TrySaveModel();
                        _updatesSinceLastSave = 0;
                    }
                }
                else
                {
                    ctx.Log?.Invoke("[AI-NGram] warn: cannot observe actual parity for online update.");
                }

                // 8) Cập nhật thích nghi (episode escalate, auto-decay, persist)
                OnJudgedAndAdapt(ctx, win, undecidable);
            }
        }

        public void SaveNow() => TrySaveModel();

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
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[AI-NGram] Save state failed: {ex.Message}");
            }
        }

        // ================== THÍCH NGHI: escalate + ease-in + auto-decay ==================
        private void OnJudgedAndAdapt(GameContext ctx, bool win, bool lastUndecidable)
        {
            // 1) Cửa sổ undecidable 50 ván (1=undecidable, 0=decidable)
            PushUndBit(lastUndecidable, _ap.UndWindowLen);

            // 2) Quản lý episode & escalate (1 lần S5, +1 lần S8 trong cùng episode)
            if (win)
            {
                _st.LossStreak = 0;

                if (_st.SafetyHoldLeft > 0)
                {
                    _st.SafetyHoldLeft--;
                    if (_st.SafetyHoldLeft == 0)
                    {
                        _st.InEpisode = false;
                        _st.DidEscS5ThisEpisode = false;
                        _st.DidEscS8ThisEpisode = false;
                        ctx.Log?.Invoke("[AI-NGram] Safety OFF.");
                    }
                }
            }
            else
            {
                _st.LossStreak++;

                if (_st.LossStreak >= _ap.SafetyTrigger)   // dùng SafetyTrigger (mặc định 4)
                {
                    if (!_st.InEpisode)
                    {
                        _st.InEpisode = true;
                        _st.DidEscS5ThisEpisode = false;
                        _st.DidEscS8ThisEpisode = false;
                    }

                    if (!_st.DidEscS5ThisEpisode)
                    {
                        _st.SafetyEscalations++;
                        _st.DidEscS5ThisEpisode = true;
                        _st.SafetyHoldLeft = Math.Max(_st.SafetyHoldLeft, Math.Max(_ap.BaseAntiStreakHold, _ap.AntiStreakHoldMinS5));
                        ctx.Log?.Invoke($"[AI-NGram] Escalate S5 (E={_st.SafetyEscalations}).");
                    }

                    if (_st.LossStreak >= 8 && !_st.DidEscS8ThisEpisode)
                    {
                        _st.SafetyEscalations++;
                        _st.DidEscS8ThisEpisode = true;
                        _st.SafetyHoldLeft = Math.Max(_st.SafetyHoldLeft, Math.Max(_ap.BaseAntiStreakHold, _ap.AntiStreakHoldMinS8));
                        ctx.Log?.Invoke($"[AI-NGram] Escalate S8 (E={_st.SafetyEscalations}).");
                    }
                }
            }

            // 3) Auto-decay khi ổn định (lenient: LossStreak ≤ 1), có cooldown, và điều kiện phụ UndRate ≤ 30% (cửa sổ 50)
            bool stableNow = !_st.InSafety && (_st.LossStreak <= _ap.LenientAllowLosses);
            if (stableNow)
            {
                if (_st.SafeCooldownLeft > 0) _st.SafeCooldownLeft--;
                else _st.SafeRounds++;
            }
            else
            {
                _st.SafeRounds = 0;
                if (_st.InSafety) _st.SafeCooldownLeft = 0;
            }

            double undRate = GetUndRate();
            bool okUnd = undRate <= _ap.TargetUndecidableRate;

            if (_st.SafeRounds >= _ap.SafeRoundsToDecay && _st.SafetyEscalations > 0 && okUnd)
            {
                _st.SafetyEscalations--;
                _st.SafeRounds = 0;
                _st.SafeCooldownLeft = _ap.SafeDecayCooldown;
                ctx.Log?.Invoke($"[AI-NGram] Auto-decay: Escalations → {_st.SafetyEscalations} (undRate={undRate:P0})");
            }

            // 4) Persist params/state mỗi ván (nhẹ)
            _ap.SaveNow();
            _st.SaveNow();
        }

        private void PushUndBit(bool undecidable, int maxLen)
        {
            if (maxLen <= 0) return;
            char bit = undecidable ? '1' : '0';
            if (string.IsNullOrEmpty(_st.UndWindowBits)) _st.UndWindowBits = new string(bit, 1);
            else
            {
                _st.UndWindowBits = _st.UndWindowBits + bit;
                if (_st.UndWindowBits.Length > maxLen)
                    _st.UndWindowBits = _st.UndWindowBits[^maxLen..];
            }
        }
        private double GetUndRate()
        {
            if (string.IsNullOrEmpty(_st.UndWindowBits)) return 0.0;
            int ones = 0;
            foreach (var c in _st.UndWindowBits) if (c == '1') ones++;
            return (double)ones / _st.UndWindowBits.Length;
        }

        // ================== THAM SỐ HIỆU LỰC (ease-in) ==================
        private sealed class Effective
        {
            public double TieBand;
            public double ConfFollowThreshold;
            public int MinSupport;
            public int KUseMax;
            public int AntiStreakHold;

            public string Compact() =>
                $"tb={TieBand:0.00},cg={ConfFollowThreshold:0.00},kMax={KUseMax},minSup={MinSupport},hold={AntiStreakHold}";
        }

        private static double EaseUp(double baseVal, double cap, int E, double tau)
        {
            if (cap <= baseVal) return baseVal;
            return Math.Min(cap, baseVal + (cap - baseVal) * (1.0 - Math.Exp(-E / tau)));
        }
        private static int EaseDownInt(int baseVal, int capLower, int E, double tau)
        {
            if (capLower >= baseVal) return baseVal;
            var v = baseVal - (baseVal - capLower) * (1.0 - Math.Exp(-E / tau));
            return Math.Max(capLower, (int)Math.Round(v, MidpointRounding.AwayFromZero));
        }

        private static Effective EffectiveFrom(AdaptiveParams ap, AdaptiveState st)
        {
            bool useS8 = st.DidEscS8ThisEpisode || st.LossStreak >= 8;
            bool useS5 = !useS8 && (st.DidEscS5ThisEpisode || st.LossStreak >= ap.SafetyTrigger); // dùng SafetyTrigger

            int E = st.SafetyEscalations;
            double tau = ap.TauEaseIn;

            if (useS8)
            {
                return new Effective
                {
                    TieBand = EaseUp(ap.BaseTieBand, ap.TieBandCapS8, E, tau),
                    ConfFollowThreshold = EaseUp(ap.BaseConfFollowThreshold, ap.ConfCapS8, E, tau),
                    MinSupport = Math.Max(ap.MinSupportMinS8, ap.BaseMinSupport),
                    KUseMax = EaseDownInt(ap.BaseKUseMax, ap.KUseMaxCapS8, E, tau),
                    AntiStreakHold = Math.Max(ap.AntiStreakHoldMinS8, ap.BaseAntiStreakHold),
                };
            }
            else if (useS5)
            {
                return new Effective
                {
                    TieBand = EaseUp(ap.BaseTieBand, ap.TieBandCapS5, E, tau),
                    ConfFollowThreshold = EaseUp(ap.BaseConfFollowThreshold, ap.ConfCapS5, E, tau),
                    MinSupport = Math.Max(ap.MinSupportMinS5, ap.BaseMinSupport),
                    KUseMax = EaseDownInt(ap.BaseKUseMax, ap.KUseMaxCapS5, E, tau),
                    AntiStreakHold = Math.Max(ap.AntiStreakHoldMinS5, ap.BaseAntiStreakHold),
                };
            }
            else
            {
                return new Effective
                {
                    TieBand = ap.BaseTieBand,
                    ConfFollowThreshold = ap.BaseConfFollowThreshold,
                    MinSupport = ap.BaseMinSupport,
                    KUseMax = ap.BaseKUseMax,
                    AntiStreakHold = ap.BaseAntiStreakHold,
                };
            }
        }

        // ================== MÔ HÌNH N-GRAM (đếm & dự đoán) ==================
        private sealed class NGramModel
        {
            private readonly int _kMax;
            private double _alpha;
            private double _rescaleThreshold;

            // tables[k][key] => (c:count_C, l:count_L)
            private readonly Dictionary<int, (double c, double l)>[] _tables;

            public NGramModel(int kMax, double alpha, double rescaleThreshold)
            {
                _kMax = Math.Max(1, kMax);
                _alpha = Math.Max(0.0, alpha);
                _rescaleThreshold = Math.Max(10.0, rescaleThreshold);

                _tables = new Dictionary<int, (double c, double l)>[_kMax + 1];
                for (int k = 0; k <= _kMax; k++)
                    _tables[k] = new Dictionary<int, (double c, double l)>(capacity: 1 << Math.Min(k, 12));
            }

            public (double score, double conf, int usedK, int support) ScoreAndConfidence(string parity, int kUseMax, int minSupport)
            {
                if (string.IsNullOrEmpty(parity)) return (0.0, 0.0, 0, 0);

                for (int k = Math.Min(Math.Min(kUseMax, _kMax), parity.Length); k >= 1; k--)
                {
                    int key = EncodeTailBits(parity, k);
                    var tab = _tables[k];

                    if (tab.TryGetValue(key, out var cnt))
                    {
                        int sup = (int)(cnt.c + cnt.l);
                        if (sup >= minSupport)
                        {
                            double pC = (cnt.c + _alpha) / (sup + 2.0 * _alpha);
                            double score = pC - 0.5;                                // [-0.5..+0.5]
                            double conf = Math.Min(1.0, Math.Abs(score) * 2.0)     // 0..1 (theo edge)
                                         * (1.0 - Math.Exp(-sup / 12.0));           // tăng theo support
                            return (score, conf, k, sup);
                        }
                    }
                }
                return (0.0, 0.0, 0, 0); // undecidable
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

            // ====== JSON persist (bảng đếm) ======
            private sealed class TableDTO { public Dictionary<string, double[]> Rows { get; set; } = new(); }
            private sealed class StateDTO
            {
                public int KMax { get; set; }
                public double Alpha { get; set; }
                public double RescaleThreshold { get; set; }
                public long UpdatedAtUtc { get; set; }
                public List<TableDTO> Tables { get; set; } = new();
            }

            public void SaveToFile(string path)
            {
                var dto = new StateDTO
                {
                    KMax = _kMax,
                    Alpha = _alpha,
                    RescaleThreshold = _rescaleThreshold,
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

                // khôi phục tham số lõi
                _alpha = dto.Alpha;
                _rescaleThreshold = dto.RescaleThreshold;
            }

            private static int EncodeTailBits(string parity, int k)
            {
                int bits = 0, n = parity.Length;
                for (int i = Math.Max(0, n - k); i < n; i++)
                    bits = (bits << 1) | (parity[i] == 'L' ? 1 : 0); // C=0, L=1
                return bits;
            }
        }

        // ================== PARAMS + STATE THÍCH NGHI (persist v2) ==================
        private sealed class AdaptiveParams
        {
            // Base (khi chưa căng thẳng)
            public double BaseTieBand { get; set; } = 0.02;
            public double BaseConfFollowThreshold { get; set; } = 0.58;
            public int BaseMinSupport { get; set; } = 3;
            public int BaseKUseMax { get; set; } = 6;
            public int BaseAntiStreakHold { get; set; } = 2;

            // Caps S5 / S8
            public double TieBandCapS5 { get; set; } = 0.05;
            public double TieBandCapS8 { get; set; } = 0.10;
            public double ConfCapS5 { get; set; } = 0.62;
            public double ConfCapS8 { get; set; } = 0.72;
            public int MinSupportMinS5 { get; set; } = 4;
            public int MinSupportMinS8 { get; set; } = 5;
            public int KUseMaxCapS5 { get; set; } = 5;
            public int KUseMaxCapS8 { get; set; } = 4;
            public int AntiStreakHoldMinS5 { get; set; } = 3;
            public int AntiStreakHoldMinS8 { get; set; } = 4;

            // Ease-in
            public double TauEaseIn { get; set; } = 4.0;

            // Auto-decay & lenient & điều kiện phụ
            public int LenientAllowLosses { get; set; } = 1;    // 0=strict, 1=lenient
            public int SafeRoundsToDecay { get; set; } = 30;
            public int SafeDecayCooldown { get; set; } = 10;
            public int UndWindowLen { get; set; } = 50;
            public double TargetUndecidableRate { get; set; } = 0.30;

            // NEW: Ngưỡng kích hoạt safety (mặc định 4)
            public int SafetyTrigger { get; set; } = 4;

            [JsonIgnore] public string SavePath { get; set; }

            public static AdaptiveParams LoadOrDefault(string path)
            {
                try
                {
                    if (File.Exists(path))
                    {
                        var txt = File.ReadAllText(path);
                        var obj = JsonSerializer.Deserialize<AdaptiveParams>(txt);
                        if (obj != null) { obj.SavePath = path; return obj; }
                    }
                }
                catch { /* ignore */ }
                var p = new AdaptiveParams { SavePath = path }; p.Clamp(); return p;
            }

            public void SaveNow()
            {
                try
                {
                    Directory.CreateDirectory(Path.GetDirectoryName(SavePath)!);
                    File.WriteAllText(SavePath, JsonSerializer.Serialize(this, new JsonSerializerOptions { WriteIndented = true }));
                }
                catch { /* ignore */ }
            }

            public void Clamp()
            {
                BaseTieBand = Math.Clamp(BaseTieBand, 0.0, 0.2);
                BaseConfFollowThreshold = Math.Clamp(BaseConfFollowThreshold, 0.50, 0.80);
                BaseMinSupport = Math.Clamp(BaseMinSupport, 1, 8);
                BaseKUseMax = Math.Clamp(BaseKUseMax, 2, 8);
                BaseAntiStreakHold = Math.Clamp(BaseAntiStreakHold, 1, 6);

                TieBandCapS5 = Math.Clamp(TieBandCapS5, BaseTieBand, 0.10);
                TieBandCapS8 = Math.Clamp(TieBandCapS8, TieBandCapS5, 0.12);

                ConfCapS5 = Math.Clamp(ConfCapS5, BaseConfFollowThreshold, 0.75);
                ConfCapS8 = Math.Clamp(ConfCapS8, ConfCapS5, 0.80);

                MinSupportMinS5 = Math.Clamp(MinSupportMinS5, BaseMinSupport, 8);
                MinSupportMinS8 = Math.Clamp(MinSupportMinS8, MinSupportMinS5, 8);

                KUseMaxCapS5 = Math.Clamp(KUseMaxCapS5, 2, BaseKUseMax);
                KUseMaxCapS8 = Math.Clamp(KUseMaxCapS8, 2, KUseMaxCapS5);

                AntiStreakHoldMinS5 = Math.Clamp(AntiStreakHoldMinS5, BaseAntiStreakHold, 6);
                AntiStreakHoldMinS8 = Math.Clamp(AntiStreakHoldMinS8, AntiStreakHoldMinS5, 6);

                TauEaseIn = Math.Clamp(TauEaseIn, 2.0, 8.0);

                LenientAllowLosses = Math.Clamp(LenientAllowLosses, 0, 2);
                SafeRoundsToDecay = Math.Clamp(SafeRoundsToDecay, 10, 100);
                SafeDecayCooldown = Math.Clamp(SafeDecayCooldown, 5, 50);

                UndWindowLen = Math.Clamp(UndWindowLen, 20, 200);
                TargetUndecidableRate = Math.Clamp(TargetUndecidableRate, 0.10, 0.50);

                SafetyTrigger = Math.Clamp(SafetyTrigger, 3, 6); // ràng buộc ngưỡng safety
            }

            public string BaseCompact() =>
                $"tb={BaseTieBand:0.00},cg={BaseConfFollowThreshold:0.00},kMax={BaseKUseMax},minSup={BaseMinSupport},hold={BaseAntiStreakHold}";
        }

        private sealed class AdaptiveState
        {
            public int LossStreak { get; set; } = 0;
            public int SafetyHoldLeft { get; set; } = 0;

            public bool InEpisode { get; set; } = false;
            public bool DidEscS5ThisEpisode { get; set; } = false;
            public bool DidEscS8ThisEpisode { get; set; } = false;

            public int SafetyEscalations { get; set; } = 0;

            public int SafeRounds { get; set; } = 0;
            public int SafeCooldownLeft { get; set; } = 0;

            public string UndWindowBits { get; set; } = "";

            [JsonIgnore] public string SavePath { get; set; }

            public static AdaptiveState LoadOrDefault(string path)
            {
                try
                {
                    if (File.Exists(path))
                    {
                        var txt = File.ReadAllText(path);
                        var obj = JsonSerializer.Deserialize<AdaptiveState>(txt);
                        if (obj != null) { obj.SavePath = path; obj.Clamp(); return obj; }
                    }
                }
                catch { /* ignore */ }
                var st = new AdaptiveState { SavePath = path }; st.Clamp(); return st;
            }

            public void SaveNow()
            {
                try
                {
                    Directory.CreateDirectory(Path.GetDirectoryName(SavePath)!);
                    File.WriteAllText(SavePath, JsonSerializer.Serialize(this, new JsonSerializerOptions { WriteIndented = true }));
                }
                catch { /* ignore */ }
            }

            public void Clamp()
            {
                LossStreak = Math.Max(0, LossStreak);
                SafetyHoldLeft = Math.Max(0, SafetyHoldLeft);
                SafetyEscalations = Math.Max(0, SafetyEscalations);
                SafeRounds = Math.Max(0, SafeRounds);
                SafeCooldownLeft = Math.Max(0, SafeCooldownLeft);
                if (UndWindowBits == null) UndWindowBits = "";
            }

            [JsonIgnore] public bool InSafety => SafetyHoldLeft > 0;
        }
    }
}
