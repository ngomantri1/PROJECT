// Tasks/AiOnlineNGramTask.cs
using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using static XocDiaLiveHit.Tasks.TaskUtil;

namespace XocDiaLiveHit.Tasks
{
    /// <summary>
    /// 14) AI học tại chỗ (n-gram) — chỉ thích nghi khi chuỗi thua ≥ 5.
    /// - Warm-start 50 kết quả khi bật và lưu state ngay.
    /// - Dự đoán: n-gram + Laplace + backoff; Hòa -> theo bệt; momentum guard cho bệt dài.
    /// - Học online từng ván. THAM SỐ chỉ điều chỉnh khi lossStreak >= 5 (>=8 siết mạnh hơn).
    /// - Lưu state n-gram & tham số để kế thừa lần chạy sau.
    /// </summary>
    public sealed class AiOnlineNGramTask : IBetTask
    {
        public string DisplayName => "14) AI học tại chỗ (n-gram)";
        public string Id => "ai-online-ngram";

        private readonly NGramOnlineModel _model;
        private readonly string _statePath;
        private readonly int _warmSteps;
        private readonly bool _saveAfterWarm;

        // tham số động (persist)
        private readonly AdaptiveParamController _ap;

        // runtime
        private bool _warmed = false;
        private int _updatesSinceLastSave = 0;
        private int _lossStreak = 0;
        private int _antiStreakRoundsLeft = 0;

        // ngưỡng (chỉ dùng để kích hoạt điều chỉnh; <5 không điều chỉnh)
        private const int SAFETY_TRIGGER = 5;  // kích hoạt siết
        private const int SAFETY_STRONG = 8;  // siết mạnh hơn
        private const int SAVE_EVERY_UPDATES = 5;

        private static readonly Random _rng = new Random();

        public AiOnlineNGramTask() : this(null, warmStartSteps: 50, saveImmediatelyAfterWarm: true) { }

        public AiOnlineNGramTask(string statePath, int warmStartSteps = 50, bool saveImmediatelyAfterWarm = true)
        {
            _model = new NGramOnlineModel(
                kMax: 6,
                alpha: 1.0,
                minSupport: 3,
                rescaleThreshold: 1000,
                tieUsesOppLast: false // HÒA -> THEO BỆT
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

            // nạp tham số động
            _ap = new AdaptiveParamController(GetParamPath());
            ApplyAdaptiveParamsToModel();
        }

        // ===== đường dẫn =====
        private static string AppLocalDir()
            => Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "XocDiaLiveHit", "ai");

        private static string GetDefaultStatePath()
        {
            var dir = AppLocalDir();
            Directory.CreateDirectory(dir);
            return Path.Combine(dir, "ngram_state_v1.json");
        }

        private static string GetParamPath()
        {
            var dir = AppLocalDir();
            Directory.CreateDirectory(dir);
            return Path.Combine(dir, "ngram_params_v1.json");
        }

        private void ApplyAdaptiveParamsToModel()
        {
            var p = _ap.Current;
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

        public async Task RunAsync(GameContext ctx, CancellationToken ct)
        {
            ctx.Log?.Invoke($"[AI-NGram] Start. state='{_statePath}', params='{GetParamPath()}'");
            ctx.Log?.Invoke($"[AI-NGram] Using: {_ap.Current}");

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
                char last = preParity.Length > 0 ? preParity[^1] : 'C';

                // 1) Dự đoán có độ tự tin & k dùng
                var (pick, conf, usedK) = _model.PredictWithConfidence(preParity);

                // 2) Gating & chống thua dây (không điều chỉnh tham số nếu s<5)
                var par = _ap.Current;
                char finalPick = pick;

                if (_antiStreakRoundsLeft > 0)
                {
                    finalPick = last; // trong anti-hold -> theo bệt
                }
                else if (conf < par.ConfFollowThreshold)
                {
                    finalPick = last; // p yếu -> theo bệt
                }

                // 3) Epsilon-greedy theo bệt (chỉ có tác dụng nếu EpsGreedyBase > 0 — do đã điều chỉnh ở s≥5)
                if (par.EpsGreedyBase > 0 && _rng.NextDouble() < par.EpsGreedyBase)
                {
                    finalPick = last;
                }

                string side = ToSide(finalPick);
                long stake = money.GetStakeForThisBet();

                ctx.Log?.Invoke($"[AI-NGram] k={usedK}, conf={conf:0.000}, raw={ToSide(pick)} -> final={side}, stake={stake:N0}, lossStreak={_lossStreak}, antiHold={_antiStreakRoundsLeft}; {par.Compact()}");

                await PlaceBet(ctx, side, stake, ct);

                // 4) Kết quả ván
                bool win = await WaitRoundFinishAndJudge(ctx, side, preSeq, ct);
                await ctx.UiDispatcher.InvokeAsync(() => ctx.UiAddWin?.Invoke(win ? stake : -stake));
                money.OnRoundResult(win);

                // 5) cập nhật loss streak & anti-hold
                if (win)
                {
                    _lossStreak = 0;
                    _antiStreakRoundsLeft = 0;
                }
                else
                {
                    _lossStreak++;
                    if (_lossStreak >= par.AntiStreakTrigger)
                        _antiStreakRoundsLeft = par.AntiStreakHold;
                    else if (_antiStreakRoundsLeft > 0)
                        _antiStreakRoundsLeft--;
                }

                // 6) Học online từ kết quả thực
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

                // 7) CHỈ điều chỉnh tham số khi chuỗi thua >= 5
                if (_lossStreak >= SAFETY_TRIGGER)
                {
                    bool changed = _ap.AdaptForLossStreak(_lossStreak, strong: _lossStreak >= SAFETY_STRONG);
                    if (changed)
                    {
                        ApplyAdaptiveParamsToModel();
                        ctx.Log?.Invoke($"[AI-NGram] Safety adapt (s={_lossStreak}) -> {_ap.Current}");
                        _ap.Save(); // lưu ngay tham số để kế thừa
                    }
                }
                // NOTE: s < 5 -> không điều chỉnh gì (giữ nguyên tham số), vẫn học n-gram bình thường.
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

        // ================== MÔ HÌNH N-GRAM ==================
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

            private static char Opp(char c) => c == 'C' ? 'L' : 'C';

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

            public char Predict(string parity)
            {
                var (next, _, _) = PredictWithConfidence(parity);
                return next;
            }

            public (char next, double conf, int usedK) PredictWithConfidence(string parity)
            {
                if (string.IsNullOrEmpty(parity)) return ('C', 0.0, 0);
                char last = parity[^1];

                // bệt dài -> theo bệt
                int run = TailRunLength(parity);
                if (run >= _momentumGuard) return (last, 1.0, -1);

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

                            // hòa đúng 0.5
                            if (Math.Abs(pC - 0.5) < 1e-12)
                                return (_tieUsesOppLast ? Opp(last) : last, 0.5, k);

                            // vùng hòa -> theo bệt
                            if (Math.Abs(pC - 0.5) <= _tieBand)
                                return (last, 0.5, k);

                            double conf = Math.Abs(pC - 0.5) * 2.0; // 0..1
                            return (pC >= 0.5) ? ('C', conf, k) : ('L', conf, k);
                        }
                    }
                }

                // không đủ support -> theo bệt
                return (last, 0.0, 0);
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

        // ================== THAM SỐ ĐỘNG (persist) ==================
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

            /// <summary>
            /// Chỉ điều chỉnh khi s >= 5. s>=8 siết mạnh hơn. s<5 -> không đổi.
            /// </summary>
            public bool AdaptForLossStreak(int lossStreak, bool strong)
            {
                if (lossStreak < 5) return false;

                var p = _state.Current;
                var before = p.ToString();

                if (strong) // s >= 8
                {
                    p.TieBand = Math.Min(0.10, Math.Max(p.TieBand, 0.08)); // mở rộng vùng hòa -> theo bệt
                    p.ConfFollowThreshold = Math.Min(0.72, Math.Max(p.ConfFollowThreshold, 0.66));
                    p.MomentumGuard = Math.Max(3, Math.Min(p.MomentumGuard, 4)); // theo bệt sớm hơn
                    p.MinSupport = Math.Max(p.MinSupport, 5);
                    p.KUseMax = Math.Min(p.KUseMax, 4);
                    p.RescaleThreshold = Math.Min(p.RescaleThreshold, 500);
                    p.AntiStreakHold = Math.Max(p.AntiStreakHold, 4);
                    p.EpsGreedyBase = Math.Max(p.EpsGreedyBase, 0.10); // tăng xác suất theo bệt ngẫu nhiên nhẹ
                }
                else // 5 <= s < 8
                {
                    p.TieBand = Math.Min(0.07, Math.Max(p.TieBand, 0.05));
                    p.ConfFollowThreshold = Math.Min(0.66, Math.Max(p.ConfFollowThreshold, 0.62));
                    p.MomentumGuard = Math.Max(4, Math.Min(p.MomentumGuard, 5));
                    p.MinSupport = Math.Max(p.MinSupport, 4);
                    p.KUseMax = Math.Min(p.KUseMax, 5);
                    p.RescaleThreshold = Math.Min(p.RescaleThreshold, 700);
                    p.AntiStreakHold = Math.Max(p.AntiStreakHold, 3);
                    p.EpsGreedyBase = Math.Max(p.EpsGreedyBase, 0.06);
                }

                p.Clamp();
                bool changed = (before != p.ToString());
                if (changed) Save();
                return changed;
            }

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
                catch { /* ignore */ }
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
            // mô hình
            public int KUseMax { get; set; } = 6;
            public double Alpha { get; set; } = 1.0;
            public int MinSupport { get; set; } = 3;
            public double RescaleThreshold { get; set; } = 1000;
            public double TieBand { get; set; } = 0.02;
            public int MomentumGuard { get; set; } = 5;

            // gating & chống thua dây
            public double ConfFollowThreshold { get; set; } = 0.58;
            public int AntiStreakTrigger { get; set; } = 3;
            public int AntiStreakHold { get; set; } = 2;

            // epsilon-greedy theo bệt (chỉ phát huy sau khi đã siết ở s>=5)
            public double EpsGreedyBase { get; set; } = 0.0;

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
                AntiStreakHold = Math.Clamp(AntiStreakHold, 1, 5);
                EpsGreedyBase = Math.Clamp(EpsGreedyBase, 0.0, 0.20);
            }

            public override string ToString()
                => $"kUseMax={KUseMax}, α={Alpha}, minSup={MinSupport}, rescale={RescaleThreshold}, tieBand={TieBand}, momGuard={MomentumGuard}, confGate={ConfFollowThreshold}, eps={EpsGreedyBase}, anti({AntiStreakTrigger},{AntiStreakHold})";

            public string Compact()
                => $"P[k={KUseMax},ms={MinSupport},rb={RescaleThreshold},tb={TieBand:0.00},mg={MomentumGuard},cg={ConfFollowThreshold:0.00},eg={EpsGreedyBase:0.00},as={AntiStreakTrigger}/{AntiStreakHold}]";
        }

        private sealed class AdaptiveState
        {
            public AdaptiveParams Current { get; set; } = new AdaptiveParams();
            public AdaptiveParams Baseline { get; set; } = new AdaptiveParams(); // mốc ban đầu (không tự động quay về khi s<5)
            public static AdaptiveState Default() => new AdaptiveState();
        }
    }
}
