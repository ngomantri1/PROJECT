using System;
using System.IO;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using Microsoft.Web.WebView2.Core;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Security.Cryptography;
using static System.Net.Mime.MediaTypeNames;
using static System.Runtime.InteropServices.JavaScript.JSType;
using BaccaratPPRR88;
using BaccaratPPRR88.Tasks;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Globalization;
using System.Windows.Documents;
using System.Reflection;
using System.Diagnostics;
using System.IO.Compression;
using Microsoft.Web.WebView2.Wpf;  // <-- cái này để có CoreWebView2Creation
using System.Net.Http;
using System.Net.Http.Json;
using System.ComponentModel;
using System.Linq;
using System.Collections.ObjectModel;
using System.Windows.Data;
using static BaccaratPPRR88.MainWindow;
using System.Windows.Input;




namespace BaccaratPPRR88
{
    // Fallback loader: nếu SharedIcons chưa có, nạp từ Assets (pack URI).
    // Fallback loader: nếu SharedIcons chưa có, nạp từ Resources (pack URI).
    internal static class FallbackIcons
    {
        private const string SideChanPng = "Assets/side/CHAN.png";
        private const string SideLePng = "Assets/side/LE.png";
        private const string ResultChanPng = "Assets/side/CHAN.png";
        private const string ResultLePng = "Assets/side/LE.png";
        private const string WinPng = "Assets/kq/THANG.png";
        private const string LossPng = "Assets/kq/THUA.png";

        private static ImageSource? _sideChan, _sideLe, _resultChan, _resultLe, _win, _loss;

        public static ImageSource? GetSideChan() => SharedIcons.SideChan ?? (_sideChan ??= Load(SideChanPng));
        public static ImageSource? GetSideLe() => SharedIcons.SideLe ?? (_sideLe ??= Load(SideLePng));
        public static ImageSource? GetResultChan() => SharedIcons.ResultChan ?? (_resultChan ??= Load(ResultChanPng));
        public static ImageSource? GetResultLe() => SharedIcons.ResultLe ?? (_resultLe ??= Load(ResultLePng));
        public static ImageSource? GetWin() => SharedIcons.Win ?? (_win ??= Load(WinPng));
        public static ImageSource? GetLoss() => SharedIcons.Loss ?? (_loss ??= Load(LossPng));

        private static ImageSource? Load(string relativePath)
        {
            try
            {
                // Nếu ảnh nằm trong cùng assembly và Build Action = Resource:
                var uri = new Uri($"pack://application:,,,/{relativePath}", UriKind.Absolute);

                var bi = new BitmapImage();
                bi.BeginInit();
                bi.UriSource = uri;
                bi.CacheOption = BitmapCacheOption.OnLoad;
                bi.EndInit();
                bi.Freeze();
                return bi;
            }
            catch
            {
                // Quan trọng: trả null để DataTemplate trigger sang hiển thị chữ.
                return null;
            }
        }
    }


    static class TextNorm
    {
        public static string RemoveDiacritics(string s)
        {
            if (string.IsNullOrEmpty(s)) return s;
            var norm = s.Normalize(NormalizationForm.FormD);
            var sb = new StringBuilder();
            foreach (var ch in norm)
                if (CharUnicodeInfo.GetUnicodeCategory(ch) != UnicodeCategory.NonSpacingMark)
                    sb.Append(ch);
            return sb.ToString().Normalize(NormalizationForm.FormC);
        }
        public static string U(string s) => RemoveDiacritics(s ?? "").Trim().ToUpperInvariant();
    }

    public sealed class SideToIconConverter : IValueConverter
    {
        public object Convert(object value, Type t, object p, CultureInfo c)
        {
            var u = TextNorm.U(value?.ToString() ?? "");
            if (u == "CHAN" || u == "C") return FallbackIcons.GetSideChan();
            if (u == "LE" || u == "L") return FallbackIcons.GetSideLe();
            return null;
        }
        public object ConvertBack(object v, Type t, object p, CultureInfo c) => Binding.DoNothing;
    }

    public sealed class KetQuaToIconConverter : IValueConverter
    {
        public object Convert(object value, Type t, object p, CultureInfo c)
        {
            var u = TextNorm.U(value?.ToString() ?? "");
            if (u == "CHAN" || u == "C") return FallbackIcons.GetResultChan();
            if (u == "LE" || u == "L") return FallbackIcons.GetResultLe();
            return null;
        }
        public object ConvertBack(object v, Type t, object p, CultureInfo c) => Binding.DoNothing;
    }

    public sealed class WinLossToIconConverter : IValueConverter
    {
        public object Convert(object value, Type t, object p, CultureInfo c)
        {
            var u = TextNorm.U(value?.ToString() ?? "");
            if (u.StartsWith("THANG")) return FallbackIcons.GetWin();
            if (u.StartsWith("THUA")) return FallbackIcons.GetLoss();
            return null;
        }
        public object ConvertBack(object v, Type t, object p, CultureInfo c) => Binding.DoNothing;
    }

    public sealed class RoomEntry
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = "";
        [JsonPropertyName("name")]
        public string Name { get; set; } = "";

        public override string ToString() => Name;
    }

    public sealed class RoomOption : INotifyPropertyChanged
    {
        public string Id { get; set; } = "";
        public string Name { get; set; } = "";

        private bool _isSelected;
        public bool IsSelected
        {
            get => _isSelected;
            set
            {
                if (_isSelected == value) return;
                _isSelected = value;
                PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(nameof(IsSelected)));
            }
        }

        public event PropertyChangedEventHandler? PropertyChanged;
    }

    public partial class MainWindow : Window
    {
        private const string AppLocalDirName = "BaccaratPPRR88"; // đổi thành tên bạn muốn
        // ====== App paths ======
        private readonly string _appDataDir;
        private readonly string _cfgPath;
        private readonly string _logDir;

        // ====== State ======
        // ---- Auto-login state ----
        private bool _autoLoginBusy = false;
        private DateTime _autoLoginLast = DateTime.MinValue;

        private bool _uiReady = false;
        private bool _didStartupNav = false;
        private bool _webHooked = false;
        private CancellationTokenSource? _navCts, _userCts, _passCts, _stakeCts, _verifyCts;


        // ====== JS Awaiters ======
        private readonly ConcurrentDictionary<string, TaskCompletionSource<string>> _jsAwaiters =
            new ConcurrentDictionary<string, TaskCompletionSource<string>>();

        // ====== CDP / Packet tap ======
        private bool _cdpNetworkOn = false;
        private readonly ConcurrentDictionary<string, string> _wsUrlByRequestId = new();
        private readonly string[] _pktInterestingHints = new[] { "wss://", "websocket", "hytsocesk", "xoc", "live", "socket" };

        // ==== Auto-login watcher ====
        private CancellationTokenSource? _autoLoginWatchCts;

        // === Fields ================================================================
        private volatile CwSnapshot _lastSnap;
        private readonly object _snapLock = new();
        private readonly Dictionary<string, TableTaskState> _tableTasks = new(StringComparer.OrdinalIgnoreCase);
        private readonly object _tableTasksGate = new();
        private readonly SemaphoreSlim _domActionLock = new(1, 1);
        private readonly SemaphoreSlim _gameReadyGate = new(1, 1);
        private readonly SemaphoreSlim _licenseGate = new(1, 1);
        private Task<bool>? _licenseCheckTask;
        private string? _licenseCheckUser;
        private int _runAllInProgress = 0;
        private const int NiSeqMax = 50;
        private readonly System.Text.StringBuilder _niSeq = new(NiSeqMax);

        // Tổng C/L của ván đang diễn ra (để dùng khi ván vừa khép lại)
        private long _roundTotalsC = 0;
        private long _roundTotalsL = 0;
        private int _lastSeqLenNi = 0;
        private bool _lockMajorMinorUpdates = false;
        private string _baseSession = "";

        private long[] _stakeSeq = Array.Empty<long>();
        private System.Collections.Generic.List<long[]> _stakeChains = new();
        private long[] _stakeChainTotals = Array.Empty<long>();

        private double _decisionPercent = 0.15; // 15% (0.15)

        // Chống bắn trùng khi vừa cược

        // Cache & cờ để không inject lặp lại
        private string? _appJs;
        private string? _homeJs;  // nội dung js_home_v2.js
        private bool _webMsgHooked; // đã gắn WebMessageReceived đúng 1 lần
        private string? _lastForcedLobbyUrl; // luu URL lobby PP da force navigate
        private string? _topForwardId, _appJsRegId;           // id script TOP_FORWARD
                                                              // ID riêng cho autostart của trang Home (đừng dùng chung với _homeJsRegId)
        private string? _homeAutoStartId;
        private string? _homeJsRegId;
        private bool _frameHooked;               // đã gắn FrameCreated?
        private string? _lastDocKey;             // key document hiện tại (performance.timeOrigin)
                                                 // Bridge đăng ký toàn cục
        private string? _autoStartId;        // id script FRAME_AUTOSTART (đăng ký toàn cục)
        private bool _domHooked;             // đã gắn DOMContentLoaded cho top chưa

        // === License/Trial run state ===

        private System.Threading.Timer? _expireTimer;      // timer tick mỗi giây để cập nhật đếm ngược
        private DateTimeOffset? _runExpiresAt;             // mốc hết hạn của phiên đang chạy (trial hoặc license)
        private string _expireMode = "";                   // "trial" | "license"
        private string _leaseClientId = "";
        public string TrialUntil { get; set; } = "";
        // === License periodic re-check (5 phút/lần) ===
        private System.Threading.Timer? _licenseCheckTimer;
        private int _licenseCheckBusy = 0; // guard chống chồng lệnh
        // === Username lấy từ Home (authoritative) ===
        private string? _homeUsername;                 // username chuẩn lấy từ home_tick
        private DateTime _homeUsernameAt = DateTime.MinValue;
        private string? _homeBalance;
        private DateTime _homeBalanceAt = DateTime.MinValue; // mốc thời gian bắt được
        private bool _homeLoggedIn = false; // chỉ true khi phát hiện có nút Đăng xuất (đã login)
        private bool _navModeHooked = false;   // đã gắn handler NavigationCompleted để cập nhật UI nhanh về Home?



        private readonly SemaphoreSlim _cfgWriteGate = new(1, 1);// Khoá ghi config để không bao giờ ghi song song
                                                                 // --- UI mode monitor ---
        private DateTime _lastGameTickUtc = DateTime.MinValue;
        private DateTime _lastHomeTickUtc = DateTime.MinValue;
        private bool _lockGameUi = false;// NEW: khóa tạm để khỏi bị timer kéo về home sau khi mình chủ động vào game
        private System.Windows.Threading.DispatcherTimer? _uiModeTimer;

        private bool _lastUiIsGame = false;



        private readonly ObservableCollection<RoomEntry> _roomList = new();
        private readonly HashSet<string> _selectedRooms = new(StringComparer.OrdinalIgnoreCase);
        private readonly HashSet<string> _overlayActiveRooms = new(StringComparer.OrdinalIgnoreCase);

        public ObservableCollection<RoomEntry> RoomList => _roomList;

        private int _roomListLoading = 0;
        private DateTime _roomListLastLoaded = DateTime.MinValue;

        private readonly ObservableCollection<RoomOption> _roomOptions = new();
        public ObservableCollection<RoomOption> RoomOptions => _roomOptions;
        private readonly ObservableCollection<RoomOption> _roomOptionsCol1 = new();
        private readonly ObservableCollection<RoomOption> _roomOptionsCol2 = new();
        public ObservableCollection<RoomOption> RoomOptionsCol1 => _roomOptionsCol1;
        public ObservableCollection<RoomOption> RoomOptionsCol2 => _roomOptionsCol2;

        private CancellationTokenSource? _roomSaveCts;
        private string _lastSavedRoomsSignature = "";
        private CancellationTokenSource? _pinSyncCts;
        private string _lastPinSyncSignature = "";
        private bool _suppressRoomOptionEvents = false;

        private static readonly TimeSpan GameTickFresh = TimeSpan.FromSeconds(3);
        private static readonly TimeSpan HomeTickFresh = TimeSpan.FromSeconds(1.5);
        // Master switch: đặt false để bỏ qua kiểm tra Trial/License (không UI, không config, true kiểm tra bình thường)
        private bool CheckLicense = true;

        // 2) Bộ nhớ và phân trang
        private readonly List<BetRow> _betAll = new();                  // tất cả bản ghi (tối đa 1000 khi load)
        private readonly ObservableCollection<BetRow> _betPage = new(); // trang hiện tại
        private int _pageIndex = 0;
        private int PageSize = 10;// Cho phép đổi PageSize từ UI
        private bool _autoFollowNewest = true;// true = đang bám trang mới nhất (trang 1); false = đang xem trang cũ, KHÔNG auto nhảy

        // 3) Giữ pending bet để chờ kết quả
        private BetRow? _pendingRow;
        private const int MaxHistory = 1000;   // tổng số bản ghi giữ trong bộ nhớ & khi load



        private const string DEFAULT_URL = "rr5309.com"; // URL mặc định bạn muốn
        // === License repo/worker settings (CHỈNH LẠI CHO PHÙ HỢP) ===
        const string LicenseOwner = "ngomantri1";    // <- đổi theo repo của bạn
        const string LicenseRepo = "licenses";  // <- đổi theo repo của bạn
        const string LicenseBranch = "main";          // <- nhánh
        const string LicenseNameGame = "kh24";          // <- nhánh
        const string LeaseBaseUrl = "https://net88.ngomantri1.workers.dev/lease/kh24";

        // ===================== TOOLTIP TEXTS =====================
        const string TIP_SEQ_CL =
        @"Chuỗi CẦU (C/L) — Chiến lược 1
• Ý nghĩa: C = CHẴN, L = LẺ (không phân biệt hoa/thường).
• Cú pháp: chỉ gồm ký tự C hoặc L; ký tự khác không hợp lệ.
• Khoảng trắng/tab/xuống dòng: được phép; hệ thống tự bỏ qua.
• Thứ tự đọc: từ trái sang phải; hết chuỗi sẽ lặp lại từ đầu.
• Độ dài khuyến nghị: 2–50 ký tự.
Ví dụ hợp lệ:
  - CLLC
  - C L L C
Ví dụ không hợp lệ:
  - C,X,L     (có dấu phẩy)
  - CL1C      (có số)
  - C L _ C   (ký tự ngoài C/L).";

        const string TIP_SEQ_NI =
        @"Chuỗi CẦU (Ít/Nhiều) — Chiến lược 3
• Ý nghĩa: I = bên ÍT tiền, N = bên NHIỀU tiền (không phân biệt hoa/thường).
• Cú pháp: chỉ gồm ký tự I hoặc N; mọi ký tự khác đều không hợp lệ.
• Dấu phân tách: khoảng trắng/tab/xuống dòng được phép và sẽ bị bỏ qua.
• Thứ tự đọc: từ trái sang phải; hết chuỗi sẽ lặp lại từ đầu.
• Độ dài khuyến nghị: 2–50 ký tự.
Ví dụ hợp lệ:
  - INNI
  - I N N I
Ví dụ không hợp lệ:
  - I,K,N     (có dấu phẩy)
  - IN1I      (có số)
  - I _ N I   (ký tự ngoài I/N).";

        const string TIP_THE_CL =
        @"Thế CẦU (C/L) — Chiến lược 2
• Ý nghĩa: C = CHẴN, L = LẺ (không phân biệt hoa/thường).
• Một quy tắc (mỗi dòng): <mẫu_quá_khứ> -> <cửa_kế_tiếp>  (hoặc dùng dấu - thay cho ->).
• Phân tách nhiều quy tắc: bằng dấu ',', ';', '|', hoặc xuống dòng.
• Khoảng trắng: được phép quanh ký hiệu và giữa các quy tắc; 
  Cho phép khoảng trắng BÊN TRONG <cửa_kế_tiếp>.
• So khớp: xét K kết quả gần nhất với K = độ dài <mẫu_quá_khứ>; nếu khớp thì đặt theo <cửa_kế_tiếp>.
• <cửa_kế_tiếp>: có thể là 1 ký tự (C/L) hoặc một chuỗi C/L (ví dụ: CLL).
• Độ dài khuyến nghị cho <mẫu_quá_khứ>: 1–10 ký tự.
Ví dụ hợp lệ:
  CCL -> C
  LLL -> L C
  CL  -> CLL
Ví dụ không hợp lệ:
  C, X, L -> C
  CL -> C L
  CL -> C1";


        const string TIP_THE_NI =
        @"Thế CẦU (Ít/Nhiều) — Chiến lược 4
• Ý nghĩa: I = bên ÍT tiền, N = bên NHIỀU tiền (không phân biệt hoa/thường).
• Một quy tắc (mỗi dòng): <mẫu_quá_khứ> -> <cửa_kế_tiếp>  (hoặc dùng dấu - thay cho ->).
• Phân tách nhiều quy tắc: bằng dấu ',', ';', '|', hoặc xuống dòng.
• Khoảng trắng: được phép quanh ký hiệu và giữa các quy tắc; 
  Cho phép khoảng trắng BÊN TRONG <cửa_kế_tiếp>.
• So khớp: xét K kết quả gần nhất với K = độ dài <mẫu_quá_khứ>; nếu khớp thì đặt theo <cửa_kế_tiếp>.
• <cửa_kế_tiếp>: có thể là 1 ký tự (I/N) hoặc một chuỗi I/N (ví dụ: INNN).
• Độ dài khuyến nghị cho <mẫu_quá_khứ>: 1–10 ký tự.
Ví dụ hợp lệ:
  INN -> I
  NNN -> N I
  IN  -> INNN
Ví dụ không hợp lệ:
  I, K, N -> I
  IN -> I  N
  IN -> I1";


        const string TIP_STAKE_CSV =
         @"Chuỗi TIỀN (StakeCsv)
• Có thể nhập 1 chuỗi hoặc NHIỀU chuỗi tiền.
• Nếu nhập NHIỀU chuỗi: MỖI CHUỖI 1 DÒNG. Ví dụ:
  1000-2000-4000-8000
  2000-4000-8000-16000
  4000-8000-16000-32000
• Nếu chỉ nhập 1 chuỗi thì dùng như cũ: 1000,1000,2000,3000,5000
• Phân tách chấp nhận: dấu phẩy ',', dấu gạch '-', dấu chấm phẩy ';' hoặc khoảng trắng.
• Đơn vị: VNĐ (số nguyên). Cho phép trùng giá trị.
• Hết chuỗi sẽ quay lại đầu (nếu chiến lược dùng lặp).
• Dùng cho quản lý vốn ""5. Đa tầng chuỗi tiền"": thua hết 1 dòng → sang dòng kế; chuỗi sau thắng đủ tổng chuỗi trước → quay về chuỗi trước.
• Ví dụ hợp lệ:
  1000,1000,2000,3000,5000
  1000-1000-2000-3000-5000
  1000 1000 2000 3000 5000
  1000-2000-4000-8000
  2000-4000-8000-16000
• Ví dụ sai: 1k, 2k, 3k (không dùng chữ k).";


        const string TIP_CUT_PROFIT =
        @"CẮT LÃI
• Nhập số tiền (>= 0). Khi tổng lãi tích lũy ≥ giá trị này → tự động dừng đặt cược.
• Để trống hoặc 0 = không dùng cắt lãi.
• Ví dụ: 200000 (khi lãi ≥ 200.000đ thì dừng).";

        const string TIP_CUT_LOSS =
        @"CẮT LỖ
• Nhập số tiền (>= 0). Khi tổng lãi tích lũy ≤ -giá trị này → tự động dừng đặt cược.
• Để trống hoặc 0 = không dùng cắt lỗ.
• Ví dụ: 150000 (khi lỗ ≥ 150.000đ thì dừng).";

        const string TIP_DECISION_PERCENT_GENERAL =
        @"ĐẶT KHI CÒN % THỜI GIAN
• Nhập phần trăm (0–100). Hệ thống quy về 0.00–1.00 nội bộ.
• Ý nghĩa: chỉ đặt cược khi thanh thời gian còn lại ≤ giá trị % này.
• Ví dụ: 25 = đặt khi còn ~25% thời gian phiên.";

        const string TIP_DECISION_PERCENT_NI =
        @"ĐẶT KHI CÒN % THỜI GIAN (khuyến nghị cho chiến lược Ít/Nhiều)
• Nhập phần trăm (0–100), KHÔNG phải giây.
• Nên để khoảng 15% để bám sát dòng tiền hai cửa.
• Ví dụ: 15 = đặt khi còn ~15% thời gian phiên.";
        // =========================================================





        // ====== CONFIG ======
        private record AppConfig
        {
            public string Url { get; set; } = "";
            [Obsolete] public string Username { get; set; } = "";
            public string StakeCsv { get; set; } = "1000-3000-7000-15000-33000-69000-142000-291000-595000-1215000";
            public int DecisionSeconds { get; set; } = 10;

            // Remember creds (DPAPI)
            public bool RememberCreds { get; set; } = true;
            public string EncUser { get; set; } = "";
            public string EncPass { get; set; } = "";
            public bool LockMouse { get; set; } = false;
            public bool UseTrial { get; set; } = false;
            public string LeaseClientId { get; set; } = "";
            public string LastHomeUsername { get; set; } = "";
            public string TrialUntil { get; set; } = "";
            public int BetStrategyIndex { get; set; } = 4; // mặc định "5. Theo cầu trước thông minh"
            public string BetSeq { get; set; } = "";       // giá trị ô "CHUỖI CẦU"
            public string BetPatterns { get; set; } = "";  // giá trị ô "CÁC THẾ CẦU"
            public string MoneyStrategy { get; set; } = "IncreaseWhenLose";//IncreaseWhenLose
            public bool S7ResetOnProfit { get; set; } = true;
            public double CutProfit { get; set; } = 0; // 0 = tắt cắt lãi
            public double CutLoss { get; set; } = 0; // 0 = tắt cắt lỗ
            public string BetSeqCL { get; set; } = "";        // cho Chiến lược 1
            public string BetSeqNI { get; set; } = "";        // cho Chiến lược 3
            public string BetPatternsCL { get; set; } = "";   // cho Chiến lược 2
            public string BetPatternsNI { get; set; } = "";   // cho Chiến lược 4

            // Lưu chuỗi tiền theo từng MoneyStrategy
            public Dictionary<string, string> StakeCsvByMoney { get; set; } = new();
            public List<string> SelectedRooms { get; set; } = new();

            /// <summary>Du?ng d?n file luu tr?ng th?i AI n-gram (JSON). B? tr?ng => d-ng m?c d?nh %LOCALAPPDATA%\Automino\ai_gram_state_v1.json</summary>
            public string AiNGramStatePath { get; set; } = "";




        }

        private sealed class TableSettingsFile
        {
            public int Version { get; set; } = 1;
            public List<TableSetting> Tables { get; set; } = new();
        }

        private sealed class TableSetting
        {
            public string Id { get; set; } = "";
            public string Name { get; set; } = "";

            public int BetStrategyIndex { get; set; } = 4;
            public string BetSeq { get; set; } = "";
            public string BetPatterns { get; set; } = "";
            public string BetSeqCL { get; set; } = "";
            public string BetSeqNI { get; set; } = "";
            public string BetPatternsCL { get; set; } = "";
            public string BetPatternsNI { get; set; } = "";

            public string MoneyStrategy { get; set; } = "IncreaseWhenLose";
            public string StakeCsv { get; set; } = "";
            public Dictionary<string, string> StakeCsvByMoney { get; set; } = new(StringComparer.OrdinalIgnoreCase);
            public bool S7ResetOnProfit { get; set; } = true;

            public double CutProfit { get; set; } = 0;
            public double CutLoss { get; set; } = 0;
        }

        private sealed class TableTaskState
        {
            public string TableId { get; init; } = "";
            public string TableName { get; set; } = "";
            public CancellationTokenSource? Cts;
            public IBetTask? Task;
            public DecisionState Decision = new();
            public bool Cooldown;
            public int StakeLevelIndexForUi = -1;
            public double WinTotal;
            public int MoneyChainIndex;
            public int MoneyChainStep;
            public double MoneyChainProfit;
            public int StartInProgress;
        }

        // 1) Model 1 dòng log đặt cược
        private sealed class BetRow
        {
            public DateTime At { get; set; }                 // Thời gian đặt
            public string Game { get; set; } = "Xóc đĩa live";
            public long Stake { get; set; }                  // Tiền cược
            public string Side { get; set; } = "";           // CHAN/LE
            public string Result { get; set; } = "";         // Kết quả "CHAN"/"LE"
            public string WinLose { get; set; } = "";        // "Thắng"/"Thua"
            public long Account { get; set; }                // Số dư sau ván
        }

        public static class SharedIcons
        {
            public static ImageSource? SideChan, SideLe;        // ảnh “Cửa đặt” CHẴN/LẺ
            public static ImageSource? ResultChan, ResultLe;    // ảnh “Kết quả” CHẴN/LẺ
            public static ImageSource? Win, Loss;               // ảnh “Thắng/Thua”
        }



        private AppConfig _cfg = new();
        private AppConfig _globalCfgSnapshot = new();
        private TableSettingsFile _tableSettings = new();

        private readonly string _tableSettingsPath;
        private readonly SemaphoreSlim _tableSettingsWriteGate = new(1, 1);
        private CancellationTokenSource? _tableSettingsSaveCts;
        private string? _activeTableId;
        private bool _suppressTableSync = false;
        // JsonOptions cho log: giữ nguyên ký tự Unicode (tiếng Việt) thay vì \uXXXX
        private static readonly JsonSerializerOptions LogJsonOptions = new JsonSerializerOptions
        {
            Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping
        };

        private static readonly JsonSerializerOptions TableSettingsJsonOptions = new JsonSerializerOptions
        {
            WriteIndented = true,
            Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping
        };


        // ====== LOGGING (mới: batch, không đơ UI) ======
        // UI
        private readonly ConcurrentQueue<string> _uiLogQueue = new();
        private readonly LinkedList<string> _uiLines = new(); // buffer giữ tối đa N dòng
        private const int UI_MAX_LINES = 3000;
        private const int UI_FLUSH_MS = 300;

        // File
        private readonly ConcurrentQueue<string> _fileLogQueue = new();
        private const int FILE_FLUSH_MS = 500;

        // Pump
        private CancellationTokenSource? _logPumpCts;

        // Packet lines -> UI? (tắt để tránh tràn UI, chỉ log file)
        private const bool SHOW_PACKET_LINES_IN_UI = false;
        private const int PACKET_UI_SAMPLE_EVERY_N = 2;
        private int _pktUiSample = 0;
        private bool _lockJsRegistered = false;
        // Map ảnh cho từng ký tự
        private readonly Dictionary<char, ImageSource> _seqIconMap = new();

        private string _lastSeqTailShown = "";
        // Tổng tiền thắng lũy kế của phiên hiện tại
        private double _winTotal = 0;
        private CoreWebView2Environment? _webEnv;
        private bool _webInitDone;
        private const string Wv2ZipResNameX64 = "BaccaratPPRR88.ThirdParty.WebView2Fixed_win-x64.zip";
        // Thư mục cache bền vững cho runtime (không bị dọn như %TEMP%)
        private static string Wv2BaseDir =>
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                         AppLocalDirName, "WebView2Fixed");
        public static string Wv2UserDataDir =>
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                 AppLocalDirName, "WebView2UserData");

        private const string TOP_FORWARD = @"
(function(){
  try{
    if (window.__abxTopForward) return; window.__abxTopForward = 1;
    window.addEventListener('message', function(ev){
      try{
        var d = ev && ev.data; if(!d) return;
        var s = (typeof d==='string') ? d : JSON.stringify(d);
        if (window.chrome && window.chrome.webview && window.chrome.webview.postMessage){
          window.chrome.webview.postMessage(s);
        }
      }catch(_){}
    }, true);
  }catch(_){}
})();";

        private const string FRAME_SHIM = @"
(function(){
  try{
    if (window.__abxShim) return; window.__abxShim = 1;
    try{
      if (window.chrome && window.chrome.webview && typeof window.chrome.webview.postMessage === 'function'){
        var __orig = window.chrome.webview.postMessage.bind(window.chrome.webview);
        window.chrome.webview.postMessage = function(p){
          try{ __orig(p); }
          catch(e){
            try{ parent.postMessage((typeof p==='string'? JSON.parse(p):p), '*'); }
            catch(_){ try{ parent.postMessage({abx:'raw', value:String(p)}, '*'); }catch(__){} }
          }
        };
      }
    }catch(_){}
    try{
      window.addEventListener('message', function(ev){
        try{
          var d = ev && ev.data; if(!d) return;
          var s = (typeof d==='string') ? d : JSON.stringify(d);
          if (window.chrome && window.chrome.webview) {
            window.chrome.webview.postMessage(s);
          } else {
            try { parent.postMessage(d, '*'); } catch(_){}
          }
        }catch(_){}
      }, true);
    }catch(_){}
  }catch(_){}
})();";

        private const string FRAME_AUTOSTART = @"
(function(){
  try{
    var key = String((performance && performance.timeOrigin) || Date.now());
    if (window.__cw_autostart_key === key) return;
    window.__cw_autostart_key = key;
    var delay=300, tries=0;
    (function tick(){
      try{
        if (window.__cw_startPush && window.cc && cc.director && cc.director.getScene){
          try{ window.__cw_startPush(240); }catch(_){}
          return;
        }
      }catch(_){}
      tries++; delay = Math.min(5000, delay + (tries<10?100:500));
      setTimeout(tick, delay);
    })();
  }catch(_){}
})();";

        private const string HOME_AUTOSTART_TEMPLATE = @"
(function(){
  try{
    var key = String((performance && performance.timeOrigin) || Date.now());
    if (window.__hw_autostart_key === key) return;
    window.__hw_autostart_key = key;
    // MỚI: 1-shot báo hiệu đã ở trang game/đang có iframe game
    if (!window.__abx_gameHintSent) window.__abx_gameHintSent = 0;
    function sendGameHint(){
      try{
        if (window.__abx_gameHintSent) return;
        window.__abx_gameHintSent = 1;
        var msg = JSON.stringify({abx:'game_hint'});
        if (window.chrome && window.chrome.webview && window.chrome.webview.postMessage){
          window.chrome.webview.postMessage(msg);
        } else {
          try { parent.postMessage({abx:'game_hint'}, '*'); } catch(_){}
        }
      }catch(_){}
    }
    // ⬇️ MỚI: phát hiện xem top-page có iframe games.* không
    function hasGameFrame(){
      try{
        var ifs = Array.from(document.querySelectorAll('iframe'));
        for (var i=0;i<ifs.length;i++){
          var f = ifs[i];
          try{
            var u = new URL(f.src || '', location.href);
            if (/^games\./i.test(u.hostname)) return true;
          }catch(_){}
        }
      }catch(_){}
      return false;
    }

    var delay=300, tries=0;
    (function tick(){
      try{
        var h = String(location.hostname||'');
        // Nếu bản thân đang ở games.* => bắn hint ngay (không cần home-push)
        if (/^games\./i.test(h)) { sendGameHint(); return; }
        // Nếu còn ở Home nhưng đã nhúng iframe game => bắn hint để C# chuyển UI tức thì
        if (hasGameFrame()) { sendGameHint(); /* vẫn không start home_push */ }
        // ⬇️ CHỈ start push khi KHÔNG phải games.* VÀ cũng KHÔNG có iframe games.*
        if (!/^games\./i.test(h) && !hasGameFrame() && typeof window.__abx_hw_startPush==='function'){
          try{ window.__abx_hw_startPush(__INTERVAL__); }catch(_){}
          return;
        }
      }catch(_){}
      tries++; delay = Math.min(5000, delay + (tries<10?100:500));
      setTimeout(tick, delay);
    })();
  }catch(_){}
})();";
        private const string CONSOLE_HOOK_JS = @"
(function(){
  try{
    if (window.__abx_console_hooked) return;
    window.__abx_console_hooked = 1;

    // Giới hạn tối đa số log gửi sang host để tránh bắn vô hạn
    var LIMIT = 1000;
    var count = 0;

    // Chỉ forward log của HomeWatch / scan tool
    // Ví dụ: '[HomeWatch] ...', '[HW][BAL] ...', '[link] Scan...', '[text] ...', '[popup] ...'
    var PREFIX_RE = /^\s*\[(?:HomeWatch|HW|link|text|popup)\b/i;

    function shouldForward(level, args){
      try{
        if (!args || !args.length) return false;

        // Cho phép tắt tap runtime: window.__abx_console_tap = 0;
        if (window.__abx_console_tap === 0) return false;

        var head = args[0];
        if (head == null) return false;

        var s;
        if (typeof head === 'string') {
          s = head;
        } else if (head && head.message) {
          s = String(head.message);
        } else {
          s = String(head);
        }

        return PREFIX_RE.test(s);
      } catch(e){
        return false;
      }
    }

    function send(level, args){
      try{
        if (count >= LIMIT) return; // quá LIMIT thì ngừng forward thêm
        count++;

        var parts = [];
        for (var i = 0; i < args.length; i++){
          var v = args[i];
          try{
            if (typeof v === 'object') {
              parts.push(JSON.stringify(v));
            } else {
              parts.push(String(v));
            }
          } catch(e){
            parts.push(String(v));
          }
        }
        var msg = parts.join(' ');

        if (window.chrome && window.chrome.webview &&
            typeof window.chrome.webview.postMessage === 'function'){
          window.chrome.webview.postMessage(JSON.stringify({
            abx: 'console',
            level: level,
            message: msg
          }));
        }
      } catch(e){}
    }

    var origLog   = console.log   ? console.log.bind(console)   : function(){};
    var origWarn  = console.warn  ? console.warn.bind(console)  : origLog;
    var origError = console.error ? console.error.bind(console) : origWarn;
    var origDebug = console.debug ? console.debug.bind(console) : origLog;

    console.log = function(){
      try{ if (shouldForward('log', arguments))   send('log',   arguments); }catch(e){}
      return origLog.apply(console, arguments);
    };

    console.warn = function(){
      try{ if (shouldForward('warn', arguments))  send('warn',  arguments); }catch(e){}
      return origWarn.apply(console, arguments);
    };

    console.error = function(){
      try{ if (shouldForward('error', arguments)) send('error', arguments); }catch(e){}
      return origError.apply(console, arguments);
    };

    console.debug = function(){
      try{ if (shouldForward('debug', arguments)) send('debug', arguments); }catch(e){}
      return origDebug.apply(console, arguments);
    };
  } catch(e){}
})();";




        // Guard chống re-entrancy (đặt ở class level)
        private bool _ensuringWeb = false;

        private WebView2LiveBridge? _bridge;
        private bool _inputEventsHooked;
        // Interval push của Home (ms)
        private int _homePushMs = 800;
        // Home-flow state flags (per-document)
        private bool _homeAutoLoginDone = false;
        private bool _homeAutoPlayDone = false;
        private CancellationTokenSource? _leaseHbCts;



        // ====== ctor ======
        public MainWindow()
        {
            // 1) Khởi tạo đường dẫn trước khi WPF dựng UI (tránh event sớm)
            _appDataDir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                AppLocalDirName);
            Directory.CreateDirectory(_appDataDir);

            _cfgPath = Path.Combine(_appDataDir, "config.json");
            _tableSettingsPath = Path.Combine(_appDataDir, "tablesettings.json");

            _logDir = Path.Combine(_appDataDir, "logs");
            Directory.CreateDirectory(_logDir);
            CleanupOldLogs();

            // 2) Sau đó mới dựng UI
            InitializeComponent();
            this.ShowInTaskbar = true;                       // có icon riêng
            this.WindowStartupLocation = WindowStartupLocation.CenterScreen; // tuỳ, cho đẹp
            // đảm bảo về Home UI lúc khởi động
            SetModeUi(false);
            BetGrid.ItemsSource = _betPage;
            this.PreviewKeyDown += MainWindow_PreviewKeyDown;
            this.PreviewMouseDown += MainWindow_PreviewMouseDown_CloseRoomPopup;
            this.StateChanged += MainWindow_StateChanged_CloseRoomPopup;
            this.Deactivated += MainWindow_Deactivated_CloseRoomPopup;
            this.IsVisibleChanged += MainWindow_IsVisibleChanged_CloseRoomPopup;
            // gọi async sau khi cửa sổ đã load
            this.Loaded += MainWindow_Loaded;
            InitRoomDropdown();

        }

        private void MainWindow_PreviewKeyDown(object sender, KeyEventArgs e)
        {
            if (e.Key == Key.F12)
            {
                try
                {
                    // Web là WebView2 của bạn trong XAML
                    if (Web?.CoreWebView2 != null)
                    {
                        Web.CoreWebView2.OpenDevToolsWindow();
                        e.Handled = true;
                    }
                }
            catch (Exception ex)
                {
                    Log("[DevTools] " + ex.Message);
                }
            }
        }


        // ====== Log helpers (batch) ======

        // Clear log (UI + file log hôm nay)
        // Clear log (UI + file log hôm nay)
        private void BtnClearLog_Click(object sender, RoutedEventArgs e)
        {
            // 1) Xóa ngay nội dung đang hiển thị
            TxtLog.Clear();

            // 2) Xóa buffer / queue trong bộ nhớ để vòng pump không đổ lại log cũ
            try
            {
                // Danh sách dòng đang giữ để build lại UI
                _uiLines.Clear();

                // Hàng đợi log chờ đẩy lên UI
                while (_uiLogQueue.TryDequeue(out _)) { }

                // Hàng đợi log chờ ghi file
                while (_fileLogQueue.TryDequeue(out _)) { }
            }
            catch
            {
                // nuốt lỗi, tránh crash app
            }

            // 3) Xóa nội dung file log của hôm nay
            try
            {
                var logFile = Path.Combine(_logDir, $"{DateTime.Now:yyyyMMdd}.log");
                if (File.Exists(logFile))
                {
                    File.WriteAllText(logFile, string.Empty);
                }
                }
            catch (Exception)
            {
                // ignore lỗi xoá file, tránh crash app
            }
        }


        private void BtnCopyLog_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                if (TxtLog != null && !string.IsNullOrEmpty(TxtLog.Text))
                {
                    Clipboard.SetText(TxtLog.Text);
                }
                }
            catch (Exception ex)
            {
                Log("[CopyLog] " + ex.Message);
            }
        }


        private void EnqueueUi(string line)
        {
            _uiLogQueue.Enqueue(line);
        }
        // Tắt log ra file: không enqueue nữa, chỉ giữ log trên UI (txtLog)
        private void EnqueueFile(string line)
        {
            _fileLogQueue.Enqueue(line);
        }

        private void StartLogPump()
        {
            if (_logPumpCts != null) return;
            _logPumpCts = new CancellationTokenSource();

            // UI pump
            _ = Task.Run(async () =>
            {
                var cts = _logPumpCts!;
                while (!cts.IsCancellationRequested)
                {
                    try
                    {
                        bool hadItem = false;
                        while (_uiLogQueue.TryDequeue(out var line))
                        {
                            _uiLines.AddLast(line);
                            if (_uiLines.Count > UI_MAX_LINES) _uiLines.RemoveFirst();
                            hadItem = true;
                        }

                        if (hadItem && TxtLog != null)
                        {
                            var sb = new StringBuilder(_uiLines.Count * 64);
                            foreach (var ln in _uiLines)
                                sb.AppendLine(ln);

                            var text = sb.ToString();
                            await Dispatcher.InvokeAsync(() =>
                            {
                                try
                                {
                                    TxtLog.Text = text;
                                    TxtLog.CaretIndex = TxtLog.Text.Length;
                                    TxtLog.ScrollToEnd();
                                }
                                catch { }
                            });
                        }
                }
            catch { }
                    await Task.Delay(UI_FLUSH_MS);
                }
            });


            // File pump
            _ = Task.Run(async () =>
            {
                var cts = _logPumpCts!;
                while (!cts.IsCancellationRequested)
                {
                    try
                    {
                        if (!_fileLogQueue.IsEmpty)
                        {
                            var sb = new StringBuilder(4096);
                            while (_fileLogQueue.TryDequeue(out var line))
                            {
                                sb.AppendLine(line);
                                if (sb.Length > 32 * 1024) break; // flush chunk
                            }
                            if (sb.Length > 0)
                            {
                                var f = Path.Combine(_logDir, $"{DateTime.Today:yyyyMMdd}.log");
                                File.AppendAllText(f, sb.ToString(), Encoding.UTF8);
                            }
                        }
                }
            catch { }
                    await Task.Delay(FILE_FLUSH_MS);
                }
            });
        }
        private void StopLogPump()
        {
            try { _logPumpCts?.Cancel(); } catch { }
            _logPumpCts = null;
        }

        private void Log(string msg)
        {
            var line = $"[{DateTime.Now:HH:mm:ss}] {msg}";
            EnqueueUi(line);
            EnqueueFile(line);
        }

        private bool HasAnyWebTick()
        {
            bool hasGame = _lastGameTickUtc != DateTime.MinValue;
            bool hasHome = _lastHomeTickUtc != DateTime.MinValue;

            Log($"[HasAnyWebTick] hasGame={hasGame} ({_lastGameTickUtc:O}), hasHome={hasHome} ({_lastHomeTickUtc:O})");

            return hasGame || hasHome;
        }


        private void SetModeUi(bool isGame)
        {
            try
            {
                if (isGame)
                {
                    if (GroupLoginNav != null)
                        GroupLoginNav.Visibility = Visibility.Collapsed;

                    if (GroupStrategyMoney != null)
                        GroupStrategyMoney.Visibility = Visibility.Visible;
                    if (GroupConsole != null)
                        GroupConsole.Visibility = Visibility.Visible;
                    if (GroupStatus != null)
                        GroupStatus.Visibility = Visibility.Visible;
                    if (GroupRoomList != null)
                        GroupRoomList.Visibility = Visibility.Visible;

                    var now = DateTime.UtcNow;
                    if (_roomListLoading == 0 &&
                        (_roomList.Count == 0 || (now - _roomListLastLoaded) > TimeSpan.FromSeconds(10)))
                    {
                        _roomListLastLoaded = now;
                        _ = RefreshRoomListAsync();
                    }
                }
                else
                {
                    if (GroupLoginNav != null)
                        GroupLoginNav.Visibility = Visibility.Visible;

                    if (GroupStrategyMoney != null)
                        GroupStrategyMoney.Visibility = Visibility.Collapsed;   // <--- sửa về Collapsed
                    if (GroupConsole != null)
                        GroupConsole.Visibility = Visibility.Collapsed;
                    if (GroupStatus != null)
                        GroupStatus.Visibility = Visibility.Collapsed;
                    if (GroupRoomList != null)
                        GroupRoomList.Visibility = Visibility.Collapsed;
                }
                }
            catch (Exception ex)
            {
                Log("[SetModeUi] " + ex);
            }
        }




        private string GetAiNGramStatePath()
        {
            // _appDataDir bạn đã tạo ở Startup: %LOCALAPPDATA%\BaccaratPPRR88
            var aiDir = System.IO.Path.Combine(_appDataDir, "ai");
            System.IO.Directory.CreateDirectory(aiDir);
            return System.IO.Path.Combine(aiDir, "ngram_state_v1.json");
        }

        private bool GetIsGameByUrlFallback()
        {
            try
            {
                var src = Web?.Source?.ToString() ?? "";
                if (string.IsNullOrWhiteSpace(src)) return false;

                var uri = new Uri(src);
                var host = uri.Host.ToLowerInvariant();

                // Nhận diện trang game theo host của nhà cung cấp
                if (host.StartsWith("games.", StringComparison.OrdinalIgnoreCase) ||
                    host.Contains("pragmaticplaylive"))
                    return true;    // game

                return false;       // home
            }
            catch { return false; }
        }

        private void RecomputeUiMode()
        {
            var nextIsGame = GetIsGameByUrlFallback(); // quyết định UI thuần theo URL
            ApplyUiMode(nextIsGame);
        }



        // Khóa/mở cấu hình khi Start/Stop:
        // - enabled = true  => đang "Bắt Đầu Cược" (chưa chạy)  => mở hết để sửa
        // - enabled = false => đang "Dừng Đặt Cược" (đang chạy) => chỉ khóa chiến lược, chuỗi/thế cầu, combo quản lý vốn
        private void SetConfigEditable(bool enabled)
        {
            // Nhóm Chiến lược
            if (CmbBetStrategy != null) CmbBetStrategy.IsEnabled = enabled;   // KHÓA khi đang chạy
            if (TxtChuoiCau != null) TxtChuoiCau.IsReadOnly = !enabled;   // KHÓA khi đang chạy
            if (TxtTheCau != null) TxtTheCau.IsReadOnly = !enabled;   // KHÓA khi đang chạy

            // Nhóm Quản lý vốn
            if (CmbMoneyStrategy != null) CmbMoneyStrategy.IsEnabled = enabled; // KHÓA khi đang chạy (chỉ khóa chọn chiến lược vốn)

            // Các ô dưới đây LUÔN cho phép nhập (kể cả khi đang chạy)
            if (TxtStakeCsv != null) TxtStakeCsv.IsReadOnly = false; // Chuỗi tiền
            if (TxtDecisionSecond != null) TxtDecisionSecond.IsReadOnly = false; // Đặt khi còn %
            if (TxtCutProfit != null) TxtCutProfit.IsReadOnly = false; // Cắt lãi
            if (TxtCutLoss != null) TxtCutLoss.IsReadOnly = false; // Cắt lỗ
        }

        private void ApplyUiMode(bool isGame)
        {
            SetModeUi(isGame);
        }

        private async Task RefreshRoomListAsync(bool userTriggered = false)
        {
            try
            {
                if (Interlocked.Exchange(ref _roomListLoading, 1) == 1)
                {
                    if (userTriggered) Log("[ROOM] Đang tải danh sách bàn, vui lòng chờ...");
                    return;
                }

                _roomListLastLoaded = DateTime.UtcNow;

                if (Web == null)
                {
                    if (userTriggered) Log("[ROOM] WebView chưa sẵn sàng.");
                    return;
                }

                await EnsureWebReadyAsync();
                if (Web?.CoreWebView2 == null)
                {
                    if (userTriggered) Log("[ROOM] CoreWebView2 chưa khởi tạo.");
                    return;
                }

                var js = @"(function(){
  try{
    const titleSelectors = ['span.rC_rT','span.rW_sl','span.rY_sn','span.qL_qM.qL_qN','.tile-name','.game-title'];
    const idAttrs = ['id','data-table-id','data-id','data-game-id','data-tableid','data-table','data-table-name','data-tablename'];
    const nameAttrs = ['data-table-name','data-tablename','data-tabletitle','data-table-title','data-title','data-name','data-display-name','data-displayname','data-label','aria-label','title','alt'];
    const seen = new Set();
    const rooms = [];
    const clean = (s)=> (s||'').trim();
    const resolveRoot = (el)=>{
      if(!el) return null;
      return el.closest('div.he_hf.he_hi') ||
             el.closest('div.hC_hE') ||
             el.closest('div.jF_jJ') ||
             el.closest('div.ec_F') ||
             el.closest('div.rW_rX') ||
             el.closest('div.mx_G') ||
             el.closest('div.kx_ky') ||
             el.closest('div.kx_ca') ||
             el;
    };
    const extractId = (root)=>{
      if(!root) return '';
      const directId = clean(root.id);
      if(directId) return directId;
      for(const a of idAttrs){
        try{
          const v = clean(root.getAttribute && root.getAttribute(a));
          if(v) return v;
        }catch(_){}
      }
      return '';
    };
    const extractName = (el)=>{
      if(!el) return '';
      for(const a of nameAttrs){
        try{
          const v = clean(el.getAttribute && el.getAttribute(a));
          if(v) return v;
        }catch(_){}
      }
      const text = clean(el.innerText || el.textContent || '');
      return text;
    };
    const addRoom = (id, name)=>{
      const rid = clean(id) || clean(name);
      const rname = clean(name);
      if(!rid || !rname) return;
      const key = rid.toLowerCase();
      if(seen.has(key)) return;
      seen.add(key);
      rooms.push({ id: rid, name: rname });
    };
    const collectRoots = (root)=>{
      const list=[];
      const stack=[root];
      const visited=new Set();
      while(stack.length){
        const r=stack.pop();
        if(!r || visited.has(r)) continue;
        visited.add(r);
        list.push(r);
        try{
          if(r.querySelectorAll){
            r.querySelectorAll('*').forEach(el=>{
              if(el && el.shadowRoot) stack.push(el.shadowRoot);
            });
          }
        }catch(_){}
      }
      return list;
    };
    const scanDocument = (root)=>{
      if(!root) return;
      const roots = collectRoots(root);
      roots.forEach(rt=>{
        titleSelectors.forEach(sel=>{
          try{
            rt.querySelectorAll(sel).forEach(el=>{
              const name = extractName(el);
              if(!name) return;
              const card = resolveRoot(el);
              const id = extractId(card) || extractId(el);
              addRoom(id, name);
            });
          }catch(_){}
        });
      });
    };
    scanDocument(document);
    const iframes = Array.from(document.querySelectorAll('iframe'));
    for(const fr of iframes){
      try{
        const doc = fr.contentDocument || fr.contentWindow?.document;
        scanDocument(doc);
      }catch(_){}
    }
    return rooms;
  }catch(e){ return []; }
})();";

                List<RoomEntry> list = new();
                const int maxAttempts = 15;
                for (int attempt = 0; attempt < maxAttempts; attempt++)
                {
                    var raw = await Web.ExecuteScriptAsync(js);
                    list = string.IsNullOrWhiteSpace(raw)
                        ? new List<RoomEntry>()
                        : (JsonSerializer.Deserialize<List<RoomEntry>>(raw) ?? new List<RoomEntry>());

                    if (list.Count > 0) break;
                    await Task.Delay(600); // chờ DOM lobby load
                }

                var clean = list
                    .Select(r =>
                    {
                        var name = (r?.Name ?? "").Trim();
                        var id = (r?.Id ?? "").Trim();
                        if (string.IsNullOrWhiteSpace(id))
                            id = name;
                        return new RoomEntry { Id = id, Name = name };
                    })
                    .Where(x => !string.IsNullOrWhiteSpace(x.Name))
                    .GroupBy(x => string.IsNullOrWhiteSpace(x.Id) ? x.Name : x.Id, StringComparer.OrdinalIgnoreCase)
                    .Select(g => g.First())
                    .OrderBy(x => x.Name, StringComparer.CurrentCultureIgnoreCase)
                    .ToList();

                var filtered = clean.Where(room => !IsLobbyNoiseName(room.Name)).ToList();
                if (clean.Count != filtered.Count)
                    Log($"[ROOMDBG][RefreshRoomList] filtered out {clean.Count - filtered.Count} noise names");
                string Sample(IEnumerable<string> xs, int take = 6)
                {
                    var arr = xs?.Where(s => !string.IsNullOrWhiteSpace(s)).Select(s => s.Trim()).Take(take).ToArray() ?? Array.Empty<string>();
                    return arr.Length == 0 ? "(rỗng)" : string.Join(" | ", arr);
                }
                Log($"[ROOMDBG][RefreshRoomList] clean={filtered.Count} sample={Sample(filtered.Select(r => r.Name))}");

                if (filtered.Count == 0)
                {
                    Log("[ROOM] Không tìm thấy bàn (DOM lobby chưa sẵn). Hãy thử bấm 'Lấy danh sách bàn' sau khi lobby load xong.");
                }
                else
                {
                    bool accepted = false;
                    bool changed = false;
                    var src = Web?.Source?.ToString() ?? "";
                    var srcLower = src.ToLowerInvariant();
                    bool pathLooksLikeLobby =
                        srcLower.Contains("/lobby") ||
                        srcLower.Contains("/lobby2") ||
                        (srcLower.Contains("/desktop/") && srcLower.Contains("multibaccarat"));
                    var inLobby = srcLower.Contains("pragmaticplaylive") && pathLooksLikeLobby;
                    var looksLikeBaccarat = filtered.Any(n => TextNorm.U(n.Name).Contains("BACCARAT"));
                    var beforeSig = BuildRoomsSignature(_selectedRooms);

                    await Dispatcher.InvokeAsync(() =>
                    {
                        if (!inLobby || !looksLikeBaccarat)
                        {
                            accepted = false;
                            var reason = !inLobby ? "không phải lobby Pragmatic" : "không thấy Baccarat";
                            Log($"[ROOMDBG][RefreshRoomList] skip clean={filtered.Count} reason={reason} src={src}");
                            return;
                        }

                        accepted = true;

                        _roomList.Clear();
                        foreach (var room in filtered) _roomList.Add(room);

                        var idSet = new HashSet<string>(_roomList
                            .Select(x => x.Id)
                            .Where(x => !string.IsNullOrWhiteSpace(x)),
                            StringComparer.OrdinalIgnoreCase);

                        var normToId = _roomList
                            .Where(x => !string.IsNullOrWhiteSpace(x.Name))
                            .GroupBy(x => TextNorm.U(x.Name), StringComparer.Ordinal)
                            .ToDictionary(g => g.Key, g => g.First().Id, StringComparer.Ordinal);

                        var oldSel = _selectedRooms.ToList();
                        var nextSel = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

                        foreach (var s in oldSel)
                        {
                            if (string.IsNullOrWhiteSpace(s)) continue;
                            if (idSet.Contains(s))
                            {
                                nextSel.Add(s);
                                continue;
                            }
                            var norm = TextNorm.U(s);
                            if (normToId.TryGetValue(norm, out var canonicalId))
                                nextSel.Add(canonicalId);
                        }

                        _selectedRooms.Clear();
                        foreach (var s in nextSel) _selectedRooms.Add(s);

                        RebuildRoomOptions();
                        UpdateRoomSummary();

                        var afterSig = BuildRoomsSignature(_selectedRooms);
                        changed = !string.Equals(beforeSig, afterSig, StringComparison.Ordinal);
                    });

                    if (!accepted)
                    {
                        if (userTriggered)
                        {
                            var sample = string.Join(" | ", filtered.Select(r => r.Name).Take(6));
                            Log("[ROOM] Bỏ qua danh sách (không phải lobby Baccarat): " + sample);
                        }
                        return;
                    }

                    if (changed)
                    {
                        _cfg.SelectedRooms = _selectedRooms.ToList();
                        _ = TriggerRoomSaveDebouncedAsync();
                    }

                    Log($"[ROOM] Đã lấy {filtered.Count} bàn.");
                    _roomListLastLoaded = DateTime.UtcNow;
                }
                }
            catch (Exception ex)
            {
                Log("[ROOM] Lỗi khi lấy danh sách bàn: " + ex.Message);
            }
            finally
            {
                Interlocked.Exchange(ref _roomListLoading, 0);
            }
        }

        private static bool IsLobbyNoiseName(string name)
        {
            if (string.IsNullOrWhiteSpace(name)) return true;
            var lower = name.Trim().ToLowerInvariant();
            if (lower.StartsWith("tileheight-")) return true;
            if (lower.Contains("tileheight-")) return true;
            if (lower.StartsWith("group ")) return true;
            if (lower.StartsWith("group-")) return true;
            if (lower.StartsWith("ellipse")) return true;
            return false;
        }

        // ====== Helpers ======
        private static string T(TextBox tb, string def = "") => (tb?.Text ?? def).Trim();
        private static string P(PasswordBox? pb, string def = "") => pb?.Password ?? def;
        private static int I(string? s, int def = 0) => int.TryParse(s, out var n) ? n : def;

        // DPAPI
        private static string ProtectString(string? s)
        {
            try
            {
                if (string.IsNullOrEmpty(s)) return "";
                var bytes = Encoding.UTF8.GetBytes(s);
                var prot = ProtectedData.Protect(bytes, null, DataProtectionScope.CurrentUser);
                return Convert.ToBase64String(prot);
            }
            catch { return ""; }
        }
        private static string UnprotectString(string? s)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(s)) return "";
                var raw = Convert.FromBase64String(s);
                var clear = ProtectedData.Unprotect(raw, null, DataProtectionScope.CurrentUser);
                return Encoding.UTF8.GetString(clear);
            }
            catch { return ""; }
        }

        // ====== Config I/O ======
        private void LoadConfig()
        {
            try
            {
                if (File.Exists(_cfgPath))
                {
                    var json = File.ReadAllText(_cfgPath, Encoding.UTF8);
                    _cfg = JsonSerializer.Deserialize<AppConfig>(json) ?? new AppConfig();
                    Log("Loaded config: " + _cfgPath);
                }
                _homeUsername = _cfg.LastHomeUsername;
                // Sinh / nạp clientId cố định cho lease
                _leaseClientId = string.IsNullOrWhiteSpace(_cfg.LeaseClientId)
                    ? (_cfg.LeaseClientId = Guid.NewGuid().ToString("N"))
                    : _cfg.LeaseClientId;

                if (string.IsNullOrWhiteSpace(_cfg.Url))
                    _cfg.Url = DEFAULT_URL;
                if (TxtUrl != null) TxtUrl.Text = _cfg.Url;
                if (TxtStakeCsv != null)
                {
                    TxtStakeCsv.Text = _cfg.StakeCsv;
                    RebuildStakeSeq(_cfg.StakeCsv);
                    Log($"[StakeCsv] loaded: {_cfg.StakeCsv} -> {_stakeSeq.Length} mức");

                }
                if (CmbBetStrategy != null)
                    CmbBetStrategy.SelectedIndex = (_cfg.BetStrategyIndex >= 0 && _cfg.BetStrategyIndex <= 13) ? _cfg.BetStrategyIndex : 15;
                SyncStrategyFieldsToUI();
                UpdateTooltips();
                UpdateBetStrategyUi();


                if (TxtDecisionSecond != null) TxtDecisionSecond.Text = _cfg.DecisionSeconds.ToString();
                if (CmbMoneyStrategy != null) ApplyMoneyStrategyToUI(_cfg.MoneyStrategy ?? "IncreaseWhenLose");
                LoadStakeCsvForCurrentMoneyStrategy();// NEW: nạp chuỗi tiền theo “Quản lý vốn” hiện tại
                if (ChkS7ResetOnProfit != null) ChkS7ResetOnProfit.IsChecked = _cfg.S7ResetOnProfit;
                MoneyHelper.S7ResetOnProfit = _cfg.S7ResetOnProfit;
                UpdateS7ResetOptionUI();


                if (ChkRemember != null) ChkRemember.IsChecked = _cfg.RememberCreds;

                if (_cfg.RememberCreds)
                {
                    var user = UnprotectString(_cfg.EncUser);
                    var pass = UnprotectString(_cfg.EncPass);
                    if (TxtUser != null) TxtUser.Text = user;
                    if (TxtPass != null) TxtPass.Password = pass;
                }
                else
                {
                    if (!string.IsNullOrEmpty(_cfg.Username) && TxtUser != null)
                        TxtUser.Text = _cfg.Username;
                }

                if (ChkTrial != null) ChkTrial.IsChecked = _cfg.UseTrial;
                ApplyCutUiFromConfig();

                _selectedRooms.Clear();
                if (_cfg.SelectedRooms != null)
                {
                    foreach (var r in _cfg.SelectedRooms)
                    {
                        var name = (r ?? "").Trim();
                        if (!string.IsNullOrWhiteSpace(name))
                            _selectedRooms.Add(name);
                    }
                }

                RebuildRoomOptions();
                UpdateRoomSummary();


                _globalCfgSnapshot = CloneConfig(_cfg);
            }
            catch (Exception ex) { Log("[LoadConfig] " + ex); }
        }

        private async Task SaveConfigAsync()
        {
            if (string.IsNullOrEmpty(_cfgPath))
            {
                Log("[SaveConfig] skipped: cfgPath is empty (UI not ready yet)");
                return;
            }

            await _cfgWriteGate.WaitAsync();
            try
            {
                _cfg.Url = T(TxtUrl);
                _cfg.StakeCsv = T(TxtStakeCsv, "1000,2000,4000,8000,16000");
                _cfg.DecisionSeconds = I(T(TxtDecisionSecond, "10"), 10);
                _cfg.BetStrategyIndex = CmbBetStrategy?.SelectedIndex ?? _cfg.BetStrategyIndex;
                _cfg.BetSeq = T(TxtChuoiCau, _cfg.BetSeq);
                _cfg.BetPatterns = T(TxtTheCau, _cfg.BetPatterns);

                var remember = (ChkRemember?.IsChecked == true);
                _cfg.RememberCreds = remember;
                if (remember)
                {
                    _cfg.EncUser = ProtectString(T(TxtUser));
                    _cfg.EncPass = ProtectString(P(TxtPass));
                    _cfg.Username = "";
                }
                else { _cfg.EncUser = ""; _cfg.EncPass = ""; _cfg.Username = ""; }

                _cfg.LockMouse = (ChkLockMouse?.IsChecked == true);
                _cfg.UseTrial = (ChkTrial?.IsChecked == true);
                _cfg.LeaseClientId = _leaseClientId;
                _cfg.MoneyStrategy = GetMoneyStrategyFromUI();
                if (ChkS7ResetOnProfit != null)
                    _cfg.S7ResetOnProfit = (ChkS7ResetOnProfit.IsChecked == true);
                _cfg.SelectedRooms = _selectedRooms.ToList();


                var dir = Path.GetDirectoryName(_cfgPath);
                if (!string.IsNullOrEmpty(dir)) Directory.CreateDirectory(dir);

                var cfgToSave = BuildConfigForSave();
                var json = JsonSerializer.Serialize(cfgToSave, new JsonSerializerOptions { WriteIndented = true });

                // Ghi an toàn: file tạm -> move (atomic)
                var tmp = _cfgPath + ".tmp";
                await File.WriteAllTextAsync(tmp, json, Encoding.UTF8);
                File.Move(tmp, _cfgPath, true);

                Log("Saved config");
                if (string.IsNullOrWhiteSpace(_activeTableId))
                    _globalCfgSnapshot = CloneConfig(_cfg);
            }
            catch (Exception ex) { Log("[SaveConfig] " + ex); }
            finally { _cfgWriteGate.Release(); }
        }

        private static AppConfig CloneConfig(AppConfig cfg)
        {
            return cfg with
            {
                StakeCsvByMoney = cfg.StakeCsvByMoney != null
                    ? new Dictionary<string, string>(cfg.StakeCsvByMoney, StringComparer.OrdinalIgnoreCase)
                    : new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase),
                SelectedRooms = cfg.SelectedRooms != null
                    ? new List<string>(cfg.SelectedRooms)
                    : new List<string>()
            };
        }

        private AppConfig BuildConfigForSave()
        {
            var snapshot = CloneConfig(_cfg);
            if (!string.IsNullOrWhiteSpace(_activeTableId))
            {
                snapshot.BetStrategyIndex = _globalCfgSnapshot.BetStrategyIndex;
                snapshot.BetSeq = _globalCfgSnapshot.BetSeq ?? "";
                snapshot.BetPatterns = _globalCfgSnapshot.BetPatterns ?? "";
                snapshot.BetSeqCL = _globalCfgSnapshot.BetSeqCL ?? "";
                snapshot.BetSeqNI = _globalCfgSnapshot.BetSeqNI ?? "";
                snapshot.BetPatternsCL = _globalCfgSnapshot.BetPatternsCL ?? "";
                snapshot.BetPatternsNI = _globalCfgSnapshot.BetPatternsNI ?? "";
                snapshot.MoneyStrategy = _globalCfgSnapshot.MoneyStrategy ?? "IncreaseWhenLose";
                snapshot.StakeCsv = _globalCfgSnapshot.StakeCsv ?? "";
                snapshot.StakeCsvByMoney = _globalCfgSnapshot.StakeCsvByMoney != null
                    ? new Dictionary<string, string>(_globalCfgSnapshot.StakeCsvByMoney, StringComparer.OrdinalIgnoreCase)
                    : new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                snapshot.S7ResetOnProfit = _globalCfgSnapshot.S7ResetOnProfit;
            }
            return snapshot;
        }

        private void LoadTableSettings()
        {
            try
            {
                if (File.Exists(_tableSettingsPath))
                {
                    var json = File.ReadAllText(_tableSettingsPath, Encoding.UTF8);
                    var loaded = JsonSerializer.Deserialize<TableSettingsFile>(json) ?? new TableSettingsFile();
                    loaded.Tables ??= new List<TableSetting>();

                    var map = new Dictionary<string, TableSetting>(StringComparer.OrdinalIgnoreCase);
                    foreach (var it in loaded.Tables)
                    {
                        if (it == null) continue;
                        var id = (it.Id ?? "").Trim();
                        if (string.IsNullOrWhiteSpace(id)) continue;
                        it.Id = id;
                        it.Name = (it.Name ?? "").Trim();
                        it.StakeCsvByMoney = it.StakeCsvByMoney != null
                            ? new Dictionary<string, string>(it.StakeCsvByMoney, StringComparer.OrdinalIgnoreCase)
                            : new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                        if (!map.ContainsKey(id))
                            map[id] = it;
                    }

                    _tableSettings = new TableSettingsFile
                    {
                        Version = loaded.Version,
                        Tables = map.Values.ToList()
                    };
                    Log("Loaded table settings: " + _tableSettingsPath);
                }
            }
            catch (Exception ex)
            {
                Log("[LoadTableSettings] " + ex);
                _tableSettings = new TableSettingsFile();
            }
        }

        private async Task SaveTableSettingsAsync()
        {
            if (string.IsNullOrEmpty(_tableSettingsPath))
            {
                Log("[SaveTableSettings] skipped: path is empty");
                return;
            }

            await _tableSettingsWriteGate.WaitAsync();
            try
            {
                _tableSettings.Tables ??= new List<TableSetting>();
                var dir = Path.GetDirectoryName(_tableSettingsPath);
                if (!string.IsNullOrEmpty(dir)) Directory.CreateDirectory(dir);

                var json = JsonSerializer.Serialize(_tableSettings, TableSettingsJsonOptions);
                var tmp = _tableSettingsPath + ".tmp";
                await File.WriteAllTextAsync(tmp, json, Encoding.UTF8);
                File.Move(tmp, _tableSettingsPath, true);
                Log("Saved tablesettings");
            }
            catch (Exception ex) { Log("[SaveTableSettings] " + ex); }
            finally { _tableSettingsWriteGate.Release(); }
        }

        private async Task TriggerTableSettingsSaveDebouncedAsync()
        {
            _tableSettingsSaveCts = await DebounceAsync(_tableSettingsSaveCts, 600, SaveTableSettingsAsync);
        }

        private TableSetting? FindTableSetting(string tableId)
        {
            if (string.IsNullOrWhiteSpace(tableId)) return null;
            return _tableSettings.Tables.FirstOrDefault(t =>
                string.Equals(t.Id, tableId, StringComparison.OrdinalIgnoreCase));
        }

        private TableSetting CaptureTableSettingFromUi(string tableId, string? tableName)
        {
            var setting = new TableSetting
            {
                Id = tableId,
                Name = (tableName ?? ResolveRoomName(tableId)).Trim()
            };

            setting.BetStrategyIndex = _cfg.BetStrategyIndex;
            setting.BetSeq = _cfg.BetSeq ?? "";
            setting.BetPatterns = _cfg.BetPatterns ?? "";
            setting.BetSeqCL = _cfg.BetSeqCL ?? "";
            setting.BetSeqNI = _cfg.BetSeqNI ?? "";
            setting.BetPatternsCL = _cfg.BetPatternsCL ?? "";
            setting.BetPatternsNI = _cfg.BetPatternsNI ?? "";

            setting.MoneyStrategy = _cfg.MoneyStrategy ?? "IncreaseWhenLose";
            setting.StakeCsv = _cfg.StakeCsv ?? "";
            setting.StakeCsvByMoney = _cfg.StakeCsvByMoney != null
                ? new Dictionary<string, string>(_cfg.StakeCsvByMoney, StringComparer.OrdinalIgnoreCase)
                : new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            setting.S7ResetOnProfit = _cfg.S7ResetOnProfit;

            return setting;
        }

        private TableSetting GetOrCreateTableSetting(string tableId, string? tableName, out bool created)
        {
            created = false;
            var existing = FindTableSetting(tableId);
            if (existing != null)
            {
                if (!string.IsNullOrWhiteSpace(tableName) &&
                    !string.Equals(existing.Name, tableName, StringComparison.Ordinal))
                {
                    existing.Name = tableName.Trim();
                }
                return existing;
            }

            var setting = CaptureTableSettingFromUi(tableId, tableName);
            _tableSettings.Tables.Add(setting);
            created = true;
            return setting;
        }

        private TableSetting? GetActiveTableSetting()
        {
            return string.IsNullOrWhiteSpace(_activeTableId) ? null : FindTableSetting(_activeTableId);
        }

        private void UpdateTableSettingFromUi(string tableId)
        {
            if (_suppressTableSync) return;
            var setting = FindTableSetting(tableId);
            if (setting == null) return;

            setting.BetStrategyIndex = _cfg.BetStrategyIndex;
            setting.BetSeq = _cfg.BetSeq ?? "";
            setting.BetPatterns = _cfg.BetPatterns ?? "";
            setting.BetSeqCL = _cfg.BetSeqCL ?? "";
            setting.BetSeqNI = _cfg.BetSeqNI ?? "";
            setting.BetPatternsCL = _cfg.BetPatternsCL ?? "";
            setting.BetPatternsNI = _cfg.BetPatternsNI ?? "";
            setting.MoneyStrategy = _cfg.MoneyStrategy ?? "IncreaseWhenLose";
            setting.StakeCsv = _cfg.StakeCsv ?? "";
            setting.StakeCsvByMoney = _cfg.StakeCsvByMoney != null
                ? new Dictionary<string, string>(_cfg.StakeCsvByMoney, StringComparer.OrdinalIgnoreCase)
                : new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            setting.S7ResetOnProfit = _cfg.S7ResetOnProfit;

            if (string.IsNullOrWhiteSpace(setting.Name))
                setting.Name = ResolveRoomName(setting.Id);

            _ = TriggerTableSettingsSaveDebouncedAsync();
        }

        private void ApplyTableSettingToUi(TableSetting setting)
        {
            if (setting == null) return;

            _suppressTableSync = true;
            try
            {
                _cfg.BetStrategyIndex = setting.BetStrategyIndex;
                _cfg.BetSeq = setting.BetSeq ?? "";
                _cfg.BetPatterns = setting.BetPatterns ?? "";
                _cfg.BetSeqCL = setting.BetSeqCL ?? "";
                _cfg.BetSeqNI = setting.BetSeqNI ?? "";
                _cfg.BetPatternsCL = setting.BetPatternsCL ?? "";
                _cfg.BetPatternsNI = setting.BetPatternsNI ?? "";
                _cfg.MoneyStrategy = setting.MoneyStrategy ?? "IncreaseWhenLose";
                _cfg.StakeCsv = setting.StakeCsv ?? "";
                _cfg.StakeCsvByMoney = setting.StakeCsvByMoney != null
                    ? new Dictionary<string, string>(setting.StakeCsvByMoney, StringComparer.OrdinalIgnoreCase)
                    : new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                _cfg.S7ResetOnProfit = setting.S7ResetOnProfit;

                if (CmbBetStrategy != null)
                {
                    var idx = setting.BetStrategyIndex;
                    if (idx < 0 || idx > 15) idx = 4;
                    CmbBetStrategy.SelectedIndex = idx;
                }

                UpdateBetStrategyUi();
                SyncStrategyFieldsToUI();
                UpdateTooltips();

                if (CmbMoneyStrategy != null)
                    ApplyMoneyStrategyToUI(_cfg.MoneyStrategy ?? "IncreaseWhenLose");
                LoadStakeCsvForCurrentMoneyStrategy();
                UpdateS7ResetOptionUI();
                if (ChkS7ResetOnProfit != null)
                    ChkS7ResetOnProfit.IsChecked = _cfg.S7ResetOnProfit;
            }
            finally
            {
                _suppressTableSync = false;
            }
        }

        private void ApplyGlobalConfigSnapshotToUi()
        {
            _suppressTableSync = true;
            try
            {
                _cfg.BetStrategyIndex = _globalCfgSnapshot.BetStrategyIndex;
                _cfg.BetSeq = _globalCfgSnapshot.BetSeq ?? "";
                _cfg.BetPatterns = _globalCfgSnapshot.BetPatterns ?? "";
                _cfg.BetSeqCL = _globalCfgSnapshot.BetSeqCL ?? "";
                _cfg.BetSeqNI = _globalCfgSnapshot.BetSeqNI ?? "";
                _cfg.BetPatternsCL = _globalCfgSnapshot.BetPatternsCL ?? "";
                _cfg.BetPatternsNI = _globalCfgSnapshot.BetPatternsNI ?? "";
                _cfg.MoneyStrategy = _globalCfgSnapshot.MoneyStrategy ?? "IncreaseWhenLose";
                _cfg.StakeCsv = _globalCfgSnapshot.StakeCsv ?? "";
                _cfg.StakeCsvByMoney = _globalCfgSnapshot.StakeCsvByMoney != null
                    ? new Dictionary<string, string>(_globalCfgSnapshot.StakeCsvByMoney, StringComparer.OrdinalIgnoreCase)
                    : new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                _cfg.S7ResetOnProfit = _globalCfgSnapshot.S7ResetOnProfit;

                if (CmbBetStrategy != null)
                {
                    var idx = _cfg.BetStrategyIndex;
                    if (idx < 0 || idx > 15) idx = 4;
                    CmbBetStrategy.SelectedIndex = idx;
                }

                UpdateBetStrategyUi();
                SyncStrategyFieldsToUI();
                UpdateTooltips();

                if (CmbMoneyStrategy != null)
                    ApplyMoneyStrategyToUI(_cfg.MoneyStrategy ?? "IncreaseWhenLose");
                LoadStakeCsvForCurrentMoneyStrategy();
                UpdateS7ResetOptionUI();
                if (ChkS7ResetOnProfit != null)
                    ChkS7ResetOnProfit.IsChecked = _cfg.S7ResetOnProfit;
            }
            finally
            {
                _suppressTableSync = false;
            }
        }

        private void ClearActiveTableFocus()
        {
            if (string.IsNullOrWhiteSpace(_activeTableId)) return;
            UpdateTableSettingFromUi(_activeTableId);
            _activeTableId = "";
            ApplyGlobalConfigSnapshotToUi();
        }

        private void ApplyUiConfigToTableSetting(TableSetting setting, bool resetCuts)
        {
            if (setting == null) return;

            setting.BetStrategyIndex = _cfg.BetStrategyIndex;
            setting.BetSeq = _cfg.BetSeq ?? "";
            setting.BetPatterns = _cfg.BetPatterns ?? "";
            setting.BetSeqCL = _cfg.BetSeqCL ?? "";
            setting.BetSeqNI = _cfg.BetSeqNI ?? "";
            setting.BetPatternsCL = _cfg.BetPatternsCL ?? "";
            setting.BetPatternsNI = _cfg.BetPatternsNI ?? "";
            setting.MoneyStrategy = _cfg.MoneyStrategy ?? "IncreaseWhenLose";
            setting.StakeCsv = _cfg.StakeCsv ?? "";
            setting.StakeCsvByMoney = _cfg.StakeCsvByMoney != null
                ? new Dictionary<string, string>(_cfg.StakeCsvByMoney, StringComparer.OrdinalIgnoreCase)
                : new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            setting.S7ResetOnProfit = _cfg.S7ResetOnProfit;

            if (resetCuts)
            {
                setting.CutProfit = 0;
                setting.CutLoss = 0;
            }

            if (string.IsNullOrWhiteSpace(setting.Name))
                setting.Name = ResolveRoomName(setting.Id);
        }

        private string ResolveRoomName(string tableId)
        {
            if (string.IsNullOrWhiteSpace(tableId)) return "";
            var hit = _roomList.FirstOrDefault(r => string.Equals(r.Id, tableId, StringComparison.OrdinalIgnoreCase));
            if (hit != null && !string.IsNullOrWhiteSpace(hit.Name))
                return hit.Name;
            var opt = _roomOptions.FirstOrDefault(r => string.Equals(r.Id, tableId, StringComparison.OrdinalIgnoreCase));
            if (opt != null && !string.IsNullOrWhiteSpace(opt.Name))
                return opt.Name;
            return tableId;
        }

        private async Task HandleTableFocusAsync(string tableId, string? tableName)
        {
            if (string.IsNullOrWhiteSpace(tableId)) return;
            if (!_overlayActiveRooms.Contains(tableId) && !_selectedRooms.Contains(tableId))
                return;

            if (!string.Equals(_activeTableId, tableId, StringComparison.OrdinalIgnoreCase))
            {
                if (!string.IsNullOrWhiteSpace(_activeTableId))
                    UpdateTableSettingFromUi(_activeTableId);
            }

            var created = false;
            var setting = GetOrCreateTableSetting(tableId, tableName, out created);
            _activeTableId = setting.Id;
            ApplyTableSettingToUi(setting);
            await PushTableCutValuesToOverlayAsync(setting.Id, setting.CutProfit, setting.CutLoss);
            if (created)
                _ = TriggerTableSettingsSaveDebouncedAsync();
        }

        private async Task PushTableCutValuesToOverlayAsync(string tableId, double cutProfit, double cutLoss)
        {
            if (Web?.CoreWebView2 == null || string.IsNullOrWhiteSpace(tableId)) return;
            var idJson = JsonSerializer.Serialize(tableId);
            var cp = cutProfit.ToString(CultureInfo.InvariantCulture);
            var cl = cutLoss.ToString(CultureInfo.InvariantCulture);
            var script = $"window.__abxTableOverlay && window.__abxTableOverlay.setCutValues && window.__abxTableOverlay.setCutValues({idJson}, {cp}, {cl});";
            try { await Web.ExecuteScriptAsync(script); } catch { }
        }

        private async Task SyncTableCutValuesForRoomsAsync(IEnumerable<string> roomIds)
        {
            if (roomIds == null) return;
            foreach (var id in roomIds)
            {
                var setting = FindTableSetting(id);
                if (setting == null) continue;
                await PushTableCutValuesToOverlayAsync(setting.Id, setting.CutProfit, setting.CutLoss);
            }
        }

        private bool TryPrepareWebMessage(CoreWebView2WebMessageReceivedEventArgs e, out string display, out JsonDocument? doc)
        {
            display = "";
            doc = null;
            try
            {
                var json = e.WebMessageAsJson;
                if (!string.IsNullOrWhiteSpace(json))
                {
                    display = json;
                    var parsed = JsonDocument.Parse(json);
                    if (parsed.RootElement.ValueKind == JsonValueKind.String)
                    {
                        var inner = parsed.RootElement.GetString() ?? "";
                        parsed.Dispose();
                        display = inner;
                        if (!LooksLikeJson(inner))
                            return false;
                        doc = JsonDocument.Parse(inner);
                        return true;
                    }
                    doc = parsed;
                    return true;
                }

                var text = e.TryGetWebMessageAsString();
                if (string.IsNullOrWhiteSpace(text))
                    return false;
                display = text;
                if (!LooksLikeJson(text))
                    return false;
                doc = JsonDocument.Parse(text);
                return true;
            }
            catch (Exception ex)
            {
                Log("[WebMessageReceived] parse error: " + ex.Message);
                doc?.Dispose();
                doc = null;
                return false;
            }
        }

        private static bool LooksLikeJson(string? payload)
        {
            if (string.IsNullOrWhiteSpace(payload))
                return false;
            var trimmed = payload.TrimStart();
            return trimmed.Length > 0 && (trimmed[0] == '{' || trimmed[0] == '[');
        }

        // ====== WebView2 ======
        private async Task EnsureWebReadyAsync()
        {
            if (Web == null || _ensuringWeb) return;
            _ensuringWeb = true;
            try
            {
                // 1) Khởi tạo CoreWebView2 (ưu tiên fixed runtime, fallback Evergreen)
                if (Web.CoreWebView2 == null)
                {
                    if (_webEnv == null)
                    {
                        try
                        {
                            var fixedDir = await EnsureFixedRuntimePresentAsync();
                            Directory.CreateDirectory(Wv2UserDataDir);

                            _webEnv = await CoreWebView2Environment.CreateAsync(
                                browserExecutableFolder: fixedDir,
                                userDataFolder: Wv2UserDataDir,
                                options: null
                            );
                        }
                        catch (Exception ex)
                        {
                            Log("[Web] Create fixed env failed, fallback Evergreen: " + ex.Message);
                            Directory.CreateDirectory(Wv2UserDataDir);

                            _webEnv = await CoreWebView2Environment.CreateAsync(
                                browserExecutableFolder: null,
                                userDataFolder: Wv2UserDataDir,
                                options: null
                            );
                        }
                    }

                    try
                    {
                        await Web.EnsureCoreWebView2Async(_webEnv);
                    }
                    catch (ArgumentException ex) when (ex.Message.Contains("already initialized"))
                    {
                        Log("[Web] CoreWebView2 already initialized (use existing).");
                    }

                    Log("[Web] ready");
                    HookWebViewEventsOnce(); // gắn các hook hạ tầng (có _webHooked guard)
                }

                if (Web.CoreWebView2 == null) return;

                // 2) Gắn WebMessageReceived đúng 1 lần
                if (!_webMsgHooked)
                {
                    _webMsgHooked = true;
                    Web.CoreWebView2.WebMessageReceived += async (s, e) =>
                    {
                        JsonDocument? parsedDoc = null;
                        try
                        {
                            if (!TryPrepareWebMessage(e, out var display, out parsedDoc))
                            {
                                if (!string.IsNullOrWhiteSpace(display))
                                    EnqueueUi($"[JS] {display}");
                                return;
                            }

                            EnqueueUi($"[JS] {display}"); // chỉ hiển thị UI, không ghi ra file
                            var root = parsedDoc.RootElement.Clone();

                                if (root.TryGetProperty("overlay", out var overlayEl) &&
                                    string.Equals(overlayEl.GetString(), "table", StringComparison.OrdinalIgnoreCase) &&
                                    root.TryGetProperty("event", out var eventEl))
                                {
                                    var ev = (eventEl.GetString() ?? "").ToLowerInvariant();
                                    if (ev == "closed" && root.TryGetProperty("id", out var overlayIdEl))
                                    {
                                        OnTableClosed(overlayIdEl.GetString() ?? "");
                                    }
                                    if (ev == "focus" && root.TryGetProperty("id", out var focusIdEl))
                                    {
                                        var id = focusIdEl.GetString() ?? "";
                                        var name = root.TryGetProperty("name", out var nameEl) ? (nameEl.GetString() ?? "") : "";
                                        await HandleTableFocusAsync(id, name);
                                    }
                                    if (ev == "play" && root.TryGetProperty("id", out var playIdEl))
                                    {
                                        var id = playIdEl.GetString() ?? "";
                                        var name = root.TryGetProperty("name", out var nameEl2) ? (nameEl2.GetString() ?? "") : "";
                                        await ToggleTablePlayAsync(id, name);
                                    }
                                    if (ev == "blur")
                                    {
                                        ClearActiveTableFocus();
                                    }
                                    return;
                                }

                                if (root.TryGetProperty("overlay", out var pinOverlayEl) &&
                                    string.Equals(pinOverlayEl.GetString(), "pin", StringComparison.OrdinalIgnoreCase) &&
                                    root.TryGetProperty("event", out var pinEventEl))
                                {
                                    var ev = (pinEventEl.GetString() ?? "").ToLowerInvariant();
                                    if (ev == "pinlist" && root.TryGetProperty("ids", out var idsEl) &&
                                        idsEl.ValueKind == JsonValueKind.Array)
                                    {
                                        var list = new List<string>();
                                        foreach (var it in idsEl.EnumerateArray())
                                        {
                                            if (it.ValueKind == JsonValueKind.String)
                                                list.Add(it.GetString() ?? "");
                                        }
                                        await ApplyPinnedRoomsFromWebAsync(list);
                                    }
                                    return;
                                }

                                if (!root.TryGetProperty("abx", out var abxEl)) return;
                                var abxStr = abxEl.GetString() ?? "";
                                string ui = "";
                                if (root.TryGetProperty("ui", out var uiEl))
                                    ui = uiEl.GetString() ?? "";
                                var uname = root.TryGetProperty("username", out var uEl) ? (uEl.GetString() ?? "") : "";


                                if (!string.IsNullOrWhiteSpace(uname))
                                {
                                    var normalized = uname.Trim().ToLowerInvariant();
                                    if (_homeUsername != normalized)
                                    {
                                        _homeUsername = normalized;

                                        if (_cfg != null && _cfg.LastHomeUsername != _homeUsername)
                                        {
                                            _cfg.LastHomeUsername = _homeUsername;
                                            _ = SaveConfigAsync(); // fire-and-forget
                                        }
                                    }

                                    _homeUsernameAt = DateTime.UtcNow;
                                    _ = Dispatcher.BeginInvoke(new Action(() =>
                                    {
                                        if (LblUserName != null)
                                            LblUserName.Text = uname;
                                    }));
                                }
                                var bal = root.TryGetProperty("balance", out var bEl)
                                    ? (bEl.ValueKind == JsonValueKind.Number ? bEl.GetRawText() : (bEl.GetString() ?? ""))
                                    : "";
                                if (!string.IsNullOrWhiteSpace(bal))
                                {
                                    var balVal = ParseMoneyOrZero(bal);
                                    var balText = (balVal > 0 || bal.Trim() == "0")
                                        ? ((long)balVal).ToString("N0", System.Globalization.CultureInfo.InvariantCulture)
                                        : bal.Trim();

                                    if (_homeBalance != balText)
                                    {
                                        _homeBalance = balText;
                                        _homeBalanceAt = DateTime.UtcNow;
                                    }

                                    _ = Dispatcher.BeginInvoke(new Action(() =>
                                    {
                                        if (LblAmount != null)
                                            LblAmount.Text = balText;
                                    }));
                                }

                                // 1) result: EvalJsAwaitAsync bridge
                                if (abxStr == "result" && root.TryGetProperty("id", out var idEl))
                                {
                                    var id = idEl.GetString() ?? "";
                                    string val = root.TryGetProperty("value", out var vEl) ? vEl.ToString() : root.ToString();
                                    if (_jsAwaiters.TryRemove(id, out var waiter))
                                        waiter.TrySetResult(val);
                                    return;
                                }

                                // 2) tick: cập nhật snapshot + UI + (NI & finalize khi đuôi đổi)
                                if (abxStr == "tick")
                                {
                                    try
                                    {
                                        var payloadJson = display ?? root.GetRawText();
                                        using var jdocTick = System.Text.Json.JsonDocument.Parse(payloadJson);
                                        var jrootTick = jdocTick.RootElement;

                                        var snap = System.Text.Json.JsonSerializer.Deserialize<CwSnapshot>(payloadJson);
                                        if (snap != null)
                                        {
                                            // === NI-SEQUENCE & finalize đúng thời điểm (đuôi seq đổi) ===
                                            try
                                            {
                                                double progNow = snap.prog ?? 0;
                                                var sessionStr = snap.session ?? "";
                                                var seqStr = snap.seq ?? "";

                                                // Nếu đang khóa theo dõi và phiên đã thay đổi so với _baseSession => ván cũ khép
                                                if (_lockMajorMinorUpdates == true &&
                                                    !string.Equals(sessionStr, _baseSession, StringComparison.Ordinal))
                                                {
                                                    char tail = (seqStr.Length > 0) ? seqStr[^1] : '\0';
                                                    bool winIsChan = (tail == '0' || tail == '2' || tail == '4');

                                                    // ✅ CHỐT DÒNG BET đang chờ NGAY TẠI THỜI ĐIỂM VÁN KHÉP
                                                    var kqStr = winIsChan ? "CHAN" : "LE";
                                                    long? accNow2 = snap?.totals?.A;
                                                    if (_pendingRow != null && accNow2.HasValue)
                                                    {
                                                        FinalizeLastBet(kqStr, accNow2.Value);
                                                    }

                                                    _lockMajorMinorUpdates = false; // xong chu kỳ này
                                                }

                                                // Khi vào ván mới (prog == 0) → lấy mốc base & totals để so sánh cho ván sắp khép
                                                if (_lockMajorMinorUpdates == false && progNow == 0)
                                                {
                                                    _baseSession = sessionStr;
                                                    _lockMajorMinorUpdates = true;
                                                }
                                            }
                                            catch { /* an toàn */ }

                                            // Ghi lại niSeq vào snapshot cho UI
                                            snap.niSeq = _niSeq.ToString();
                                            lock (_snapLock) _lastSnap = snap;

                                            // --- NEW: lấy status từ JSON (JS đã bơm vào tick) ---
                                            string statusUi = jrootTick.TryGetProperty("status", out var stEl) ? (stEl.GetString() ?? "") : "";
                                            string statusUiT = statusUi switch
                                            {
                                                "open" => "Cho phép đặt cược",
                                                "locked" => "Đợi kết quả",
                                                _ => ""          // các trạng thái khác (nếu có) thì để trống
                                            };
                                            // --- Cập nhật UI ---
                                            _ = Dispatcher.BeginInvoke(new Action(() =>
                                            {
                                                try
                                                {
                                                    // Progress / % thời gian
                                                    if (snap.prog.HasValue)
                                                    {
                                                        var p = Math.Max(0, Math.Min(1, snap.prog.Value));
                                                        if (PrgBet != null) PrgBet.Value = p;
                                                        if (LblProg != null) LblProg.Text = $"{(int)Math.Round(p * 100)}%";
                                                    }
                                                    else
                                                    {
                                                        if (PrgBet != null) PrgBet.Value = 0;
                                                        if (LblProg != null) LblProg.Text = "-";
                                                    }
                                                    //Cập nhật Tên nhân vật
                                                    if (LblUserName != null && !string.IsNullOrWhiteSpace(uname)) LblUserName.Text = uname;
                                                    // Kết quả gần nhất từ chuỗi seq
                                                    var seqStrLocal = snap.seq ?? "";
                                                    char last = (seqStrLocal.Length > 0) ? seqStrLocal[^1] : '\0';
                                                    var kq = (last == '0' || last == '2' || last == '4') ? "CHAN"
                                                             : (last == '1' || last == '3') ? "LE" : "";
                                                    SetLastResultUI(kq);

                                                    // Tổng tiền
                                                    var amt = snap?.totals?.A;
                                                    if (LblAmount != null)
                                                    {
                                                        if (!string.IsNullOrWhiteSpace(_homeBalance))
                                                            LblAmount.Text = _homeBalance;
                                                        else if (amt.HasValue)
                                                            LblAmount.Text = amt.Value.ToString("N0", System.Globalization.CultureInfo.InvariantCulture);
                                                        else
                                                            LblAmount.Text = "-";
                                                    }

                                                    // Chuỗi kết quả
                                                    UpdateSeqUI(snap.seq ?? "");

                                                    // 🔸 Trạng thái: "Phiên mới" / "Ngừng đặt cược" / "Đang chờ kết quả"
                                                    if (LblStatusText != null)
                                                    {
                                                        if (!string.IsNullOrWhiteSpace(statusUiT))
                                                        {
                                                            LblStatusText.Text = statusUiT;
                                                            LblStatusText.Visibility = Visibility.Visible;
                                                        }
                                                        else
                                                        {
                                                            LblStatusText.Text = "";
                                                            LblStatusText.Visibility = Visibility.Collapsed;
                                                        }
                                                    }
                                                }
                                                catch { }
                                            }));
                                        }

                                        if (ui == "game")
                                        {
                                            _lastGameTickUtc = DateTime.UtcNow;
                                        }
                                        else
                                        {
                                            _lastHomeTickUtc = DateTime.UtcNow;
                                            _lastGameTickUtc = DateTime.MinValue; // cho chắc
                                            _lockGameUi = false;                  // cho quay lại home
                                            Dispatcher.BeginInvoke(new Action(() => ApplyUiMode(false)));
                                        }
                                        return;
                                    }
                                    catch
                                    {
                                        // ignore non-JSON
                                    }
                                }

                                // 2.b) game_hint: Home báo đã có game/iframe → chuyển UI tức thì
                                if (abxStr == "game_hint")
                                {
                                    var now = DateTime.UtcNow;

                                    // nếu VỪA nhận được home_tick trong khoảng tươi thì coi như vẫn đang ở màn home
                                    // HomeTickFresh của bạn đang dùng cho chỗ khác rồi, tận dụng luôn
                                    if ((now - _lastHomeTickUtc) <= HomeTickFresh)
                                    {
                                        // chỉ ghi nhận là "có thể có game" thôi
                                        _lastGameTickUtc = now;
                                        return;    // QUAN TRỌNG: không gọi ApplyUiMode(true);
                                    }

                                    _lastGameTickUtc = now;
                                    _ = Dispatcher.BeginInvoke(new Action(() => ApplyUiMode(true)));
                                    return;
                                }

                                // 3) bet ok → tạo dòng placeholder (Result/WinLose = "-") và SHOW TRANG 1
                                if (abxStr == "bet")
                                {
                                    string sideRaw = root.TryGetProperty("side", out var se) ? (se.GetString() ?? "") : "";
                                    long amount = root.TryGetProperty("amount", out var ae) ? ae.GetInt64() : 0;
                                    string side = sideRaw.Equals("CHAN", StringComparison.OrdinalIgnoreCase) ? "CHAN"
                                                : sideRaw.Equals("LE", StringComparison.OrdinalIgnoreCase) ? "LE"
                                                : sideRaw.ToUpperInvariant();

                                    Log($"[BET] {side} {amount:N0}");

                                    long accNow = 0;
                                    try { accNow = (long)ParseMoneyOrZero(LblAmount?.Text ?? "0"); } catch { }

                                    _pendingRow = new BetRow
                                    {
                                        At = DateTime.Now,
                                        Game = "Xóc đĩa live",
                                        Stake = amount,
                                        Side = side,
                                        Result = "-",
                                        WinLose = "-",
                                        Account = accNow
                                    };

                                    // MỚI NHẤT Ở ĐẦU DANH SÁCH (trang 1)
                                    _betAll.Insert(0, _pendingRow);
                                    if (_betAll.Count > MaxHistory) _betAll.RemoveAt(_betAll.Count - 1);
                                    // Chỉ về trang 1 nếu đang bám trang mới nhất; còn đang xem trang cũ thì giữ nguyên
                                    if (_autoFollowNewest)
                                    {
                                        ShowFirstPage();
                                    }
                                    else
                                    {
                                        RefreshCurrentPage();   // (mục 3 bên dưới)
                                    }
                                    return;
                                }


                                // 4) bet_error
                                if (abxStr == "bet_error")
                                {
                                    string side = root.TryGetProperty("side", out var se) ? (se.GetString() ?? "?") : "?";
                                    long amount = root.TryGetProperty("amount", out var ae) ? ae.GetInt64() : 0;
                                    string error = root.TryGetProperty("error", out var ee) ? (ee.GetString() ?? "") : "";
                                    Log($"[BET][ERR] {side} {amount} :: {error}");
                                    return;
                                }

                                // 5) home_tick: username/balance/url từ Home
                                //if (abxStr == "home_tick")
                                //{
                                //    // đã về màn hình login trong web → gỡ khóa và chuyển về UI login
                                //    _lastHomeTickUtc = DateTime.UtcNow;
                                //    _lockGameUi = false;
                                //    Dispatcher.BeginInvoke(new Action(() => ApplyUiMode(false)));
                                //    var uname = root.TryGetProperty("username", out var uEl) ? (uEl.GetString() ?? "") : "";
                                // if (!string.IsNullOrWhiteSpace(uname))
                                //    {
                                //        var normalized = uname.Trim().ToLowerInvariant();
                                //        if (_homeUsername != normalized)
                                //        {
                                //            _homeUsername = normalized;
                                //            _homeUsernameAt = DateTime.UtcNow;

                                //            if (_cfg != null && _cfg.LastHomeUsername != _homeUsername)
                                //            {
                                //                _cfg.LastHomeUsername = _homeUsername;
                                //                _ = SaveConfigAsync(); // fire-and-forget
                                //            }
                                //        }
                                //    }

                                //    var bal = root.TryGetProperty("balance", out var bEl) ? (bEl.GetString() ?? "") : "";
                                //    var href = root.TryGetProperty("href", out var hEl) ? (hEl.GetString() ?? "") : "";

                                //    try
                                //    {
                                //        await Dispatcher.InvokeAsync(() =>
                                //        {
                                //            if (!string.IsNullOrWhiteSpace(uname) && TxtUser != null)
                                //            {
                                //                if (string.IsNullOrWhiteSpace(TxtUser.Text) || TxtUser.Text != uname)
                                //                    TxtUser.Text = uname;
                                //            }
                                //            if (LblUserName != null && !string.IsNullOrWhiteSpace(uname)) LblUserName.Text = uname;
                                //            if (LblAmount != null) LblAmount.Text = bal;
                                //        });

                                //        // cập nhật trạng thái đã đăng nhập dựa trên nút Logout/Login
                                //        try
                                //        {
                                //            var jsLogged = @"
                                //              (function(){
                                //                try{
                                //                  const rm=s=>{try{return (s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'');}catch(_){return s||'';}}; 
                                //                  const low=s=>rm(String(s||'').trim().toLowerCase());
                                //                  const vis=el=>{if(!el)return false; const r=el.getBoundingClientRect(), cs=getComputedStyle(el);
                                //                                 return r.width>4&&r.height>4&&cs.display!=='none'&&cs.visibility!=='hidden'&&cs.pointerEvents!=='none';};
                                //                  const qa=(s,d)=>Array.from((d||document).querySelectorAll(s));

                                //                  const hasLogoutVis = qa('a,button,[role=""button""],.btn,.base-button')
                                //                      .some(el => vis(el) && /dang\\s*xuat|đăng\\s*xuất|logout|sign\\s*out/i.test(low(el.textContent)));
                                //                  const hasLoginVis = qa('a,button,[role=""button""],.btn,.base-button')
                                //                      .some(el => vis(el) && /dang\\s*nhap|đăng\\s*nhập|login|sign\\s*in/i.test(low(el.textContent)));

                                //                  return (hasLogoutVis && !hasLoginVis) ? '1' : '0';
                                //                }catch(e){ return '0'; }
                                //              })();";
                                //            var st = await ExecJsAsyncStr(jsLogged);
                                //            _homeLoggedIn = (st == "1");
                                //        }
                                //        catch { /* ignore */ }
                                //    }
                                //    catch { }

                                //    _lastHomeTickUtc = DateTime.UtcNow;
                                //    return;
                                //}
                }
            catch (Exception ex2)
                        {
                            Log("[WebMessageReceived] " + ex2);
                        }
                    };
                }
                // 3) Hook NavigationCompleted để chuyển UI theo URL ngay khi điều hướng xong
                if (!_navModeHooked && Web != null)
                {
                    _navModeHooked = true;
                    Web.NavigationCompleted += async (_, __) =>
                    {
                        try
                        {
                            // nếu chưa có tick thì thôi
                            if (!HasAnyWebTick())
                                return;

                            // nếu vừa có tick tươi thì cũng thôi
                            var now = DateTime.UtcNow;
                            bool recentGame = (now - _lastGameTickUtc) <= GameTickFresh;
                            bool recentHome = (now - _lastHomeTickUtc) <= HomeTickFresh;
                            if (recentGame || recentHome)
                                return;

                            // nếu muốn thật sự bỏ ép UI, thì dừng ở đây luôn
                            return;

                            // phần dưới coi như bỏ
                        }
                        catch { }
                    };

                }
                }
            catch (Exception ex)
            {
                Log("[Web] EnsureWebReadyAsync " + ex);
                throw;
            }
            finally
            {
                _ensuringWeb = false;
            }
        }



        private async Task NavigateIfNeededAsync(string? url)
        {
            if (string.IsNullOrWhiteSpace(url) || Web == null) return;
            await EnsureWebReadyAsync();

            try
            {
                if (!Regex.IsMatch(url, @"^\w+://", RegexOptions.IgnoreCase))
                    url = "https://" + url;

                var target = new Uri(url);
                bool needNav = Web.Source == null ||
                               !string.Equals(Web.Source.ToString(), target.ToString(), StringComparison.OrdinalIgnoreCase);

                if (needNav)
                {
                    var tcs = new TaskCompletionSource<bool>();
                    void Handler(object? s, CoreWebView2NavigationCompletedEventArgs e)
                    {
                        Web.NavigationCompleted -= Handler;
                        Log("[Web] NavigationCompleted: " + (e.IsSuccess ? "OK" : ("Err " + e.WebErrorStatus)));
                        tcs.TrySetResult(true);
                    }
                    Web.NavigationCompleted += Handler;
                    Log("[Web] Navigate: " + target);
                    Web.Source = target;
                    await tcs.Task;

                    await AutoFillLoginAsync();
                }
                }
            catch (Exception ex) { Log("[NavigateIfNeededAsync] " + ex); }
        }


        private async Task ApplyBackgroundForStateAsync()
        {
            // Chưa có CoreWebView2 ⇒ để nền đen (WebHost đang Black)

            if (Web?.CoreWebView2 == null)
                return;

            var url = (TxtUrl?.Text ?? "").Trim();

            if (string.IsNullOrWhiteSpace(url))
            {
                // Đã có WebView2 nhưng chưa nhập URL ⇒ nền trắng
                SetWebViewBackground(System.Windows.Media.Colors.White);
                await ShowBlankWhiteAsync();   // trang trắng gợi ý
            }
            else
            {
                // Đang/đã điều hướng ⇒ để trang quyết định (trong suốt)
                SetWebViewBackground(System.Windows.Media.Colors.Transparent);
            }
        }


        // Hiển thị một trang trắng tối giản trong WebView2
        private async Task ShowBlankWhiteAsync(string? message = null)
        {
            if (Web?.CoreWebView2 == null) return;

            // Trang HTML trắng, có dòng gợi ý nhỏ ở giữa (tuỳ chọn)
            string note = string.IsNullOrWhiteSpace(message) ? "Chưa có URL / Nhập URL để điều hướng" : message;
            string html = @"<!doctype html>
<html><head><meta charset='utf-8'>
<style>
  html,body{height:100%;margin:0;background:#fff;color:#444;
            display:flex;align-items:center;justify-content:center;
            font:14px/1.4 -apple-system,Segoe UI,Roboto,Arial;}
  .note{opacity:.6}
</style></head>
<body><div class='note'>" + System.Net.WebUtility.HtmlEncode(note) + @"</div></body></html>";

            try { Web.CoreWebView2.NavigateToString(html); } catch { /* ignore */ }
        }


        private void SetWebViewBackground(System.Windows.Media.Color c)
        {
            try
            {
                // chuyển Media.Color -> Drawing.Color
                var d = System.Drawing.Color.FromArgb(c.A, c.R, c.G, c.B);
                Web.DefaultBackgroundColor = d;
            }
            catch { }
        }


        // Gọi hàm này TRƯỚC mọi EnsureCoreWebView2Async
        private async Task InitWebView2WithFixedRuntimeAsync()
        {
            // Nếu đã init hoặc đã có CoreWebView2 thì bỏ qua
            if (_webInitDone || Web?.CoreWebView2 != null) return;

            // 1) Bảo đảm fixed runtime được bung ra và lấy thư mục (có thể null nếu thiếu resource)
            string? fixedDir = null;
            try
            {
                fixedDir = await EnsureFixedRuntimePresentAsync();
            }
            catch (Exception ex)
            {
                Log("[WV2] EnsureFixedRuntimePresentAsync failed, fallback Evergreen: " + ex.Message);
                fixedDir = null;
            }

            // 2) Bảo đảm thư mục user-data tồn tại (khớp với XAML)
            System.IO.Directory.CreateDirectory(Wv2UserDataDir);

            try
            {
                // 3) Tạo environment trỏ tới fixed runtime + user-data riêng
                _webEnv = await CoreWebView2Environment.CreateAsync(
                    browserExecutableFolder: fixedDir,
                    userDataFolder: Wv2UserDataDir,
                    options: null /* tránh trùng "--disable-gpu" vì XAML đã set */
                );

                // Dùng overload có _webEnv để chắc chắn dùng fixed runtime
                await Web!.EnsureCoreWebView2Async(_webEnv);
            }
            catch (ArgumentException ex) when (ex.Message.Contains("already initialized"))
            {
                // Đã bị init trước bằng env khác → dùng luôn env hiện có
                Log("[WV2] Already initialized with another environment → use existing.");
                _webEnv = null; // để nơi khác không cố ép env khác
                                // Caller sẽ tiếp tục flow (HookWebViewEventsOnce/EnsureWebReadyAsync) sau.
            }
            catch (Exception ex)
            {
                // 4) Fallback: dùng Evergreen, nhưng vẫn cố định user-data (không sinh *.exe.WebView2)
                Log("[WV2] Fixed runtime failed → fallback system: " + ex.Message);
                _webEnv = await CoreWebView2Environment.CreateAsync(
                    browserExecutableFolder: null,
                    userDataFolder: Wv2UserDataDir,
                    options: null
                );
                await Web!.EnsureCoreWebView2Async(_webEnv);
            }

            // 5) Gắn event 1 lần (đã có _webHooked guard bên trong)
            HookWebViewEventsOnce();
            _webInitDone = true;
        }



        private void HookWebViewEventsOnce()
        {
            if (_webHooked || Web?.CoreWebView2 == null) return;
            _webHooked = true;

            try
            {
                // Bật WebMessages (đảm bảo chrome.webview.postMessage hoạt động từ trang & iframe)
                var settings = Web.CoreWebView2.Settings;
                if (settings != null)
                {
                    settings.IsWebMessageEnabled = true;
                    // (tuỳ chọn khác, giữ nguyên nếu bạn không cần)
                    settings.AreDefaultContextMenusEnabled = false;
                    settings.AreDevToolsEnabled = true;
                }

                // THAY CHO ConsoleMessageReceived:
                // inject JS hook console.* để gửi log JS về C# qua WebMessage
                _ = Web.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(CONSOLE_HOOK_JS);

                // Không gắn WebMessageReceived ở đây (đã gắn trong EnsureWebReadyAsync)
                // Điều hướng mọi window.open về cùng WebView2
                _ = Web.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(@"
            (function(){
                try { window.open = function(u){ try { location.href = u; } catch(e){} }; } catch(e){}
            })();
        ");

                // Chặn mở cửa sổ mới → điều hướng trong cùng control
                Web.CoreWebView2.NewWindowRequested += NewWindowRequested;

                // Theo dõi điều hướng để đồng bộ nền/trạng thái
                Web.NavigationCompleted += Web_NavigationCompleted;

                // Bật CDP network tap (không cần await)
                _ = EnableCdpNetworkTapAsync();

                // Cập nhật nền ngay theo trạng thái hiện tại
                _ = ApplyBackgroundForStateAsync();
            }
            catch (Exception ex)
            {
                Log("[HookWebViewEventsOnce] " + ex);
            }
        }




        private async Task<string> EnsureFixedRuntimePresentAsync()
        {
            // 0) Nếu đang chạy như plugin trong AutoBetHub ⇒ ưu tiên dùng runtime dùng chung
            try
            {
                var entryName = Assembly.GetEntryAssembly()?.GetName().Name;
                if (!string.IsNullOrEmpty(entryName) &&
                    string.Equals(entryName, "AutoBetHub", StringComparison.OrdinalIgnoreCase))
                {
                    var hubDir = Path.Combine(
                        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                        "AutoBetHub", "ThirdParty", "WebView2Fixed_win-x64");

                    var hubExe = Path.Combine(hubDir, "msedgewebview2.exe");
                    if (File.Exists(hubExe))
                    {
                        Log("[Web] Using host fixed runtime from AutoBetHub: " + hubDir);
                        return hubDir;
                    }

                    Log("[Web] Host fixed runtime not found at: " + hubDir);
                }
            }
            catch
            {
                // Bỏ qua lỗi detect host, sẽ fallback sang runtime riêng bên dưới
            }

            // 1) Runtime riêng của BaccaratPPRR88 (dùng khi chạy EXE độc lập)
            var baseDir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                AppLocalDirName, "WebView2Fixed");
            var targetDir = Path.Combine(baseDir, "fixed");

            // Nếu đã có exe chính => coi như đã bung
            if (File.Exists(Path.Combine(targetDir, "msedgewebview2.exe")))
                return targetDir;

            Directory.CreateDirectory(targetDir);

            var resName = FindResourceName("ThirdParty.WebView2Fixed_win-x64.zip")
                          ?? Wv2ZipResNameX64;

            using var s = Assembly.GetExecutingAssembly().GetManifestResourceStream(resName)
                           ?? throw new FileNotFoundException("Missing embedded resource: " + resName);
            using var za = new System.IO.Compression.ZipArchive(
                s, System.IO.Compression.ZipArchiveMode.Read);

            foreach (var e in za.Entries)
            {
                var outPath = Path.Combine(targetDir, e.FullName);
                var dir = Path.GetDirectoryName(outPath);
                if (!string.IsNullOrEmpty(dir)) Directory.CreateDirectory(dir);
                if (string.IsNullOrEmpty(e.Name)) continue; // bỏ folder rỗng

                using var es = e.Open();
                using var fs = File.Create(outPath);
                es.CopyTo(fs);
            }

            return targetDir;
        }

                private bool CheckWebView2RuntimeOrNotify()
        {
            var ver = Microsoft.Web.WebView2.Core.CoreWebView2Environment.GetAvailableBrowserVersionString();
            if (string.IsNullOrEmpty(ver))
            {
                MessageBox.Show(
                    "Thiếu Microsoft Edge WebView2 Runtime.\nHãy cài Evergreen x64 rồi mở lại ứng dụng.",
                    "Thiếu WebView2", MessageBoxButton.OK, MessageBoxImage.Warning);
                return false;
            }
            return true;
        }

private async Task<CancellationTokenSource> DebounceAsync(
            CancellationTokenSource? oldCts, int delayMs, Func<Task> action)
        {
            oldCts?.Cancel();
            var cts = new CancellationTokenSource();
            try
            {
                await Task.Delay(delayMs, cts.Token);
                if (!cts.Token.IsCancellationRequested) await action();
            }
            catch (TaskCanceledException) { }
            return cts;
        }

        // ====== Auto fill ======
        // Điền cả 2 trường (nhanh + chắc chắn), KHÔNG dùng postMessage
        // ====== Auto fill ======
        // Gửi user/pass sang game (Cocos) và bảo JS mở popup + điền + click
        // ====== Auto fill ======
        // Chỉ tự động điền tên nhân vật và mật khẩu vào popup Cocos
        // KHÔNG click nút Đăng nhập trong popup
        private async Task AutoFillLoginAsync()
        {
            // 1. webview chưa sẵn sàng thì thôi
            if (!IsWebAlive)
            {
                Log("[AutoFill] skipped (web not ready)");
                return;
            }

            // 2. đảm bảo web đã init CoreWebView2
            await EnsureWebReadyAsync();
            if (!IsWebAlive)
            {
                Log("[AutoFill] stopped (web lost after EnsureWebReadyAsync)");
                return;
            }

            // 3. lấy user/pass/mã xác minh + trạng thái nhớ mật khẩu từ panel WPF
            var u = T(TxtUser);              // T(...) lấy TextBox.Text
            var p = P(TxtPass);              // P(...) lấy PasswordBox.Password
            var c = T(TxtVerify);            // NEW: mã xác minh (có thể rỗng)
            var remember = (ChkRemember?.IsChecked == true);

            // 4. Gửi credential sang JS bridge cũ (giữ nguyên logic __cw_cmd để không phá code đang chạy)
            var payload = new
            {
                __cw_cmd = "set_login",
                user = u ?? "",
                pass = p ?? "",
                code = c ?? "",              // NEW
                remember,                    // NEW
                autoSubmit = false           // KHÔNG cho JS tự bấm
            };
            string json = System.Text.Json.JsonSerializer.Serialize(payload);
            Web.CoreWebView2.PostWebMessageAsJson(json);
            Log("[AutoFill] sent set_login to webview");

            // 5. Mở popup và tự điền trực tiếp vào form login của RR88 (kể cả mã xác minh + checkbox nhớ mật khẩu)
            var jsUser = System.Text.Json.JsonSerializer.Serialize(u ?? "");
            var jsPass = System.Text.Json.JsonSerializer.Serialize(p ?? "");
            var jsCode = System.Text.Json.JsonSerializer.Serialize(c ?? "");
            var jsRemember = remember ? "true" : "false";

            var js = $@"
        (async function(){{
            try {{
                // mở popup nếu đang còn nút đăng nhập trên header
                if (window.__cw_clickLoginIfNeed) {{
                    window.__cw_clickLoginIfNeed();
                }}

                // đợi popup render ra
                await new Promise(r => setTimeout(r, 200));

                // cho bridge cũ (nếu có) tự điền user/pass
                if (window.__cw_fillLoginPopup) {{
                    window.__cw_fillLoginPopup();
                }}

                // NEW: tự điền user/pass/mã xác minh + tick 'Ghi nhớ mật khẩu' vào popup RR88
                try {{
                    var user = {jsUser};
                    var pass = {jsPass};
                    var code = {jsCode};
                    var remember = {jsRemember};

                    var form = document.querySelector('form.login-form');
                    if (form) {{
                        // USER
                        var uInput = form.querySelector('input[autocomplete=""username""], input[name*=""user"" i], input[type=""text""], input[placeholder*=""tên người dùng"" i]');
                        if (uInput) {{
                            uInput.value = user || '';
                            uInput.dispatchEvent(new Event('input',{{ bubbles:true }}));
                            uInput.dispatchEvent(new Event('change',{{ bubbles:true }}));
                        }}

                        // PASS
                        var pInput = form.querySelector('input[type=""password""], input[name*=""pass"" i]');
                        if (pInput) {{
                            pInput.value = pass || '';
                            pInput.dispatchEvent(new Event('input',{{ bubbles:true }}));
                            pInput.dispatchEvent(new Event('change',{{ bubbles:true }}));
                        }}

                        // VERIFY CODE (Mã xác minh)
                        var cInput = form.querySelector('input[name*=""code"" i], input[placeholder*=""mã xác minh"" i]');
                        if (cInput) {{
                            cInput.value = code || '';
                            cInput.dispatchEvent(new Event('input',{{ bubbles:true }}));
                            cInput.dispatchEvent(new Event('change',{{ bubbles:true }}));
                        }}

                        // Ghi nhớ mật khẩu (checkbox remPass_checkbox)
                        var rem = form.querySelector('input.remPass_checkbox');
                        if (rem) {{
                            rem.checked = !!remember;
                            rem.dispatchEvent(new Event('input',{{ bubbles:true }}));
                            rem.dispatchEvent(new Event('change',{{ bubbles:true }}));
                        }}
                    }}
                }} catch(_){{
                    // bỏ qua lỗi DOM nhỏ
                }}

                // KHÔNG tự click nút login ở đây
            }} catch (e) {{
                console.warn('[AutoFillLoginAsync js] error', e);
            }}
        }})();";
            await Web.CoreWebView2.ExecuteScriptAsync(js);

            Log("[AutoFill] done (filled only, no click)");
        }

        private async Task SyncRememberCheckboxAsync()
        {
            try
            {
                if (!IsWebAlive) return;
                await EnsureWebReadyAsync();
                if (!IsWebAlive) return;

                var remember = (ChkRemember?.IsChecked == true) ? "true" : "false";

                var js = $@"
        (function(){{
            try {{
                var form = document.querySelector('form.login-form');
                if (!form) return;
                var rem = form.querySelector('input.remPass_checkbox');
                if (!rem) return;
                rem.checked = {remember};
                rem.dispatchEvent(new Event('input',{{ bubbles:true }}));
                rem.dispatchEvent(new Event('change',{{ bubbles:true }}));
            }} catch(e) {{
                console.warn('[SyncRememberCheckboxAsync]', e);
            }}
        }})();";
                await Web.CoreWebView2.ExecuteScriptAsync(js);
            }
            catch (Exception ex)
            {
                Log("[SyncRememberCheckboxAsync] " + ex);
            }
        }


        // Bấm 'Chơi Xóc Đĩa Live' từ Home:
        // 1) Ưu tiên gọi API JS nếu có (__abx_hw_clickPlayXDL), 
        // 2) fallback sang C# ClickXocDiaTitleAsync(timeout)
        private async Task<bool> TryPlayXocDiaFromHomeAsync()
        {
            try
            {
                Log("[HOME] Play Xóc Đĩa Live: try js api");
                var js = @"
        (function(){
          try{
            if (typeof window.__abx_hw_clickPlayXDL === 'function'){
              var r = window.__abx_hw_clickPlayXDL();
              return (r===true||r==='ok') ? 'ok' : String(r||'no-fn');
            }
            return 'no-fn';
          }catch(e){ return 'err:'+ (e && e.message || e); }
        })();";
                var r = await Web.CoreWebView2.ExecuteScriptAsync(js) ?? "\"\"";
                if (r.Contains("ok", StringComparison.OrdinalIgnoreCase))
                {
                    Log("[HOME] Play XDL via JS: ok");
                    return true;
                }

                Log("[HOME] Play XDL via JS not available, fallback C#");
                var r2 = await ClickXocDiaTitleAsync(12000); // hàm C# bạn đã có
                Log("[HOME] Play XDL via C#: " + r2);
                return string.Equals(r2, "clicked", StringComparison.OrdinalIgnoreCase);
            }
            catch (Exception ex)
            {
                Log("[HOME] Play XDL: error " + ex.Message);
                return false;
            }
        }




        // ====== UI events ======
        private async void Window_Loaded(object sender, RoutedEventArgs e)
        {
            _uiReady = false;

            try
            {
                StartLogPump();
                MoneyHelper.Logger = Log;
                LoadConfig();
                LoadTableSettings();
                InitSeqIcons();

                // NEW: đồng bộ nội dung theo chiến lược đang chọn + gắn tooltip ngay khi mở app
                // (các helper đã gửi: SyncStrategyFieldsToUI(), UpdateTooltips())
                SyncStrategyFieldsToUI();     // đổ đúng Chuỗi/Thế theo chiến lược 1/2/3/4
                UpdateTooltips();             // gắn TIP_* cho Chuỗi/Thế + StakeCsv/Cắt lãi/Cắt lỗ/% thời gian

                // NEW: nạp chuỗi tiền theo “Quản lý vốn” hiện tại để UI hiển thị đúng ngay từ đầu
                // (helper đã gửi: LoadStakeCsvForCurrentMoneyStrategy())
                LoadStakeCsvForCurrentMoneyStrategy();

                // gắn handler input như trước
                if (!_inputEventsHooked)
                {
                    if (TxtUrl != null) TxtUrl.TextChanged += TxtUrl_TextChanged;
                    if (TxtUser != null) TxtUser.TextChanged += TxtUser_TextChanged;
                    if (TxtPass != null) TxtPass.PasswordChanged += TxtPass_PasswordChanged;
                    if (TxtVerify != null) TxtVerify.TextChanged += TxtVerify_TextChanged;
                    if (TxtStakeCsv != null) TxtStakeCsv.TextChanged += TxtStakeCsv_TextChanged;
                    if (CmbBetStrategy != null) CmbBetStrategy.SelectionChanged += CmbBetStrategy_SelectionChanged;
                    if (TxtChuoiCau != null) TxtChuoiCau.TextChanged += TxtChuoiCau_TextChanged;
                    if (TxtTheCau != null) TxtTheCau.TextChanged += TxtTheCau_TextChanged;
                    if (CmbMoneyStrategy != null) CmbMoneyStrategy.SelectionChanged += CmbMoneyStrategy_SelectionChanged;

                    _inputEventsHooked = true;
                }

                if (ChkLockMouse != null)
                    ChkLockMouse.IsChecked = _cfg.LockMouse;

                // giữ nguyên 2 hàm cũ
                await InitWebView2WithFixedRuntimeAsync();
                await ApplyBackgroundForStateAsync();

                // WebView2 ready (giữ hook cũ của bạn)
                await EnsureWebReadyAsync();

                await EnsureBridgeRegisteredAsync();
                await InjectOnNewDocAsync();

                // Bridge dùng chung
                if (_bridge == null)
                {
                    // Dùng lại _appJs đã nạp 1 lần (embedded)
                    _bridge = new WebView2LiveBridge(Web, _appJs ?? "", msg => Log(msg));
                    await _bridge.EnsureAsync();
                    await _bridge.InjectIfNewDocAsync();
                }

                //StartAutoLoginWatcher();

                var start = string.IsNullOrWhiteSpace(_cfg.Url) ? (TxtUrl?.Text ?? "") : _cfg.Url;
                if (!string.IsNullOrWhiteSpace(start) && !_didStartupNav)
                {
                    _didStartupNav = true;
                    await NavigateIfNeededAsync(start.Trim());
                    await AutoFillLoginAsync();

                    await ApplyBackgroundForStateAsync(); // đúng hành vi cũ sau khi có URL
                }

                SetPlayButtonState(HasRunningTasks());
                UpdateRunAllButtonState(); // (nếu trong SetPlayButtonState có SetConfigEditable thì sẽ khóa/mở các ô)
                ApplyMouseShieldFromCheck();

                // --- BẮT ĐẦU GIÁM SÁT UI MODE ---
                _uiModeTimer = new System.Windows.Threading.DispatcherTimer
                {
                    Interval = TimeSpan.FromMilliseconds(300)
                };
                _uiModeTimer.Tick += (_, __) =>
                {
                    try
                    {
                        RecomputeUiMode();
                    }
                    catch
                    {
                        // ignore
                    }
                };
                _uiModeTimer.Start();


            }
            catch (Exception ex)
            {
                Log("[Window_Loaded] " + ex);
            }
            finally
            {
                _uiReady = true;
                _ = TriggerPinSyncDebouncedAsync(true);
            }
        }








        private async void Window_Closing(object? sender, System.ComponentModel.CancelEventArgs e)
        {
            try { await SaveConfigAsync(); } catch { }
            try { await SaveTableSettingsAsync(); } catch { }
            try { await DisableCdpNetworkTapAsync(); } catch { }
            StopLogPump();       // <-- tắt pump
            StopAutoLoginWatcher();
            StopExpiryCountdown();

        }

        private async void OpenUrl_Click(object sender, RoutedEventArgs e)
        {
            await SaveConfigAsync();
            await NavigateIfNeededAsync(T(TxtUrl).Trim());
        }

        private async void BtnGoHome_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                // Reset force-lobby guard when returning to home
                _lastForcedLobbyUrl = null;

                var home = (_cfg?.Url ?? DEFAULT_URL)?.Trim();
                if (string.IsNullOrWhiteSpace(home))
                    home = DEFAULT_URL;
                if (!Regex.IsMatch(home, @"^[a-zA-Z][a-zA-Z0-9+.-]*://", RegexOptions.IgnoreCase))
                    home = "https://" + home;

                await NavigateIfNeededAsync(home);
            }
            catch (Exception ex)
            {
                Log("[GoHome] " + ex.Message);
            }
        }
        private void Exit_Click(object sender, RoutedEventArgs e) => Close();
        private void StartLoop_Click(object sender, RoutedEventArgs e)
        {
            PlayXocDia_Click(sender, e); // delegate sang nút Bắt Đầu Cược
        }

        private void StopLoop_Click(object sender, RoutedEventArgs e)
        {
            StopXocDia_Click(sender, e);
        }


        // Checkbox Remember (đã thêm ở XAML)
        private async void ChkRemember_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                await SaveConfigAsync();
                Log("[Remember] " + ((ChkRemember?.IsChecked == true) ? "ON" : "OFF"));
                await SyncRememberCheckboxAsync(); // đồng bộ ô Ghi nhớ mật khẩu trên web
            }
            catch (Exception ex) { Log("[Remember] " + ex); }
        }

        private void Web_NavigationCompleted(object? sender, CoreWebView2NavigationCompletedEventArgs e)
        {
            try
            {
                Log("[Web] NavigationCompleted event: " + (e.IsSuccess ? "OK" : ("Err " + e.WebErrorStatus)));
                SetWebViewBackground(System.Windows.Media.Colors.Transparent);
                if (!e.IsSuccess) return;

                // BỔ SUNG: đảm bảo cầu nối và tiêm nếu doc mới
                _ = EnsureBridgeRegisteredAsync();
                _ = InjectOnNewDocAsync();

                // HÀNH VI CŨ
                _ = AutoFillLoginAsync();
                _ = TriggerPinSyncDebouncedAsync(true);
                //StartAutoLoginWatcher();
                Dispatcher.BeginInvoke(new Action(ApplyMouseShieldFromCheck));
            }
            catch (Exception ex)
            {
                Log("[Web_NavigationCompleted] " + ex);
            }
        }



        private async void TxtUrl_TextChanged(object sender, TextChangedEventArgs e)
        {
            if (!_uiReady) return;

            _navCts = await DebounceAsync(_navCts, 300, async () =>
            {
                await SaveConfigAsync();
                var url = T(TxtUrl).Trim();
                if (string.IsNullOrWhiteSpace(url))
                {
                    await ApplyBackgroundForStateAsync();   // URL trống -> nền trắng + about:blank
                }
                else
                {
                    await NavigateIfNeededAsync(url);
                }
            });
        }

        private async void TxtUser_TextChanged(object sender, TextChangedEventArgs e)
        {
            if (!_uiReady) return;
            _userCts = await DebounceAsync(_userCts, 150, async () =>
            {
                await SaveConfigAsync();
                await AutoFillLoginAsync();
            });
        }
        private async void TxtPass_PasswordChanged(object sender, RoutedEventArgs e)
        {
            if (!_uiReady) return;
            _passCts = await DebounceAsync(_passCts, 150, async () =>
            {
                await SaveConfigAsync();
                await AutoFillLoginAsync();
            });
        }

        private async void TxtVerify_TextChanged(object sender, TextChangedEventArgs e)
        {
            if (!_uiReady) return;
            _verifyCts = await DebounceAsync(_verifyCts, 150, async () =>
            {
                // Mã xác minh không cần lưu config – chỉ sync sang web
                await AutoFillLoginAsync();
            });
        }


        private async void ChkTrial_Click(object sender, RoutedEventArgs e)
        {
            try { await SaveConfigAsync(); }
            catch (Exception ex) { Log("[ChkTrial] " + ex.Message); }
        }

        private async void BtnReloadRoomList_Click(object sender, RoutedEventArgs e)
        {
            await RefreshRoomListAsync(true);
        }

        // ====== Dropdown đa chọn danh sách bàn ======
        private void InitRoomDropdown()
        {
            RebuildRoomOptions();
            UpdateRoomSummary();
        }

        private void RoomHeader_MouseLeftButtonUp(object sender, MouseButtonEventArgs e)
        {
            if ((_roomOptions.Count == 0 || _roomList.Count == 0) && _roomListLoading == 0)
            {
                _ = RefreshRoomListAsync(true);
            }
            if (RoomPopup != null)
            {
                RoomPopup.IsOpen = !RoomPopup.IsOpen;
                if (!RoomPopup.IsOpen && _uiReady)
                    _ = ScrollLobbyTopAsync("toggle-close");
                e.Handled = true;
            }
        }

        private void BtnCreateOverlay_Click(object sender, RoutedEventArgs e)
        {
            _ = SpawnTableOverlayAsync();
        }

        private async void BtnResetOverlay_Click(object sender, RoutedEventArgs e)
        {
            if (Web?.CoreWebView2 == null)
            {
                Log("[TABLE] WebView chưa sẵn sàng.");
                return;
            }

            try
            {
                await Web.ExecuteScriptAsync("window.__abxTableOverlay && window.__abxTableOverlay.reset();");
                Log("[TABLE] Reset layout overlay.");
            }
            catch (Exception ex)
            {
                Log("[TABLE] Lỗi reset overlay: " + ex.Message);
            }
        }

        private async Task SpawnTableOverlayAsync()
        {
            var selectedRooms = _roomOptions
                .Where(it => it.IsSelected)
                .Select(it => new
                {
                    id = string.IsNullOrWhiteSpace(it.Id) ? it.Name : it.Id,
                    name = it.Name
                })
                .ToList();

            if (selectedRooms.Count == 0)
            {
                Log("[TABLE] Vui lòng chọn ít nhất một bàn trước khi tạo overlay.");
                return;
            }


            var createdAny = false;
            foreach (var room in selectedRooms)
            {
                var created = false;
                GetOrCreateTableSetting(room.id, room.name, out created);
                if (created)
                    createdAny = true;
            }
            if (createdAny)
                _ = TriggerTableSettingsSaveDebouncedAsync();

            if (Web?.CoreWebView2 == null)
            {
                Log("[TABLE] WebView chưa sẵn sàng.");
                return;
            }

            var roomsJson = JsonSerializer.Serialize(selectedRooms);
            var optionsJson = JsonSerializer.Serialize(new
            {
                baseSelector = ".rW_sl,.rY_sn,[data-table-name],[data-tablename],[data-table-id],[data-tabletitle],[data-table-title],[data-title],[data-name]"
            });
            var script = $"window.__abxTableOverlay && window.__abxTableOverlay.openRooms({roomsJson}, {optionsJson});";
            try
            {
                await Web.ExecuteScriptAsync(script);
                _overlayActiveRooms.Clear();
                foreach (var room in selectedRooms)
                    _overlayActiveRooms.Add(room.id);
                await SyncTableCutValuesForRoomsAsync(selectedRooms.Select(r => r.id));
                Log($"[TABLE] Tạo overlay cho {selectedRooms.Count} bàn.");
            }
            catch (Exception ex)
            {
                Log("[TABLE] Lỗi tạo overlay: " + ex.Message);
            }
        }

        private void OnTableClosed(string tableId)
        {
            if (string.IsNullOrWhiteSpace(tableId))
                return;
            StopTableTask(tableId, "closed");
            if (_overlayActiveRooms.Remove(tableId))
                Log($"[TABLE] Bàn '{tableId}' đã đóng.");
            if (string.Equals(_activeTableId, tableId, StringComparison.OrdinalIgnoreCase))
                ClearActiveTableFocus();
        }

        private void MainWindow_StateChanged_CloseRoomPopup(object? sender, EventArgs e)
        {
            if (WindowState == WindowState.Minimized)
                CloseRoomPopup();
        }

        private void MainWindow_Deactivated_CloseRoomPopup(object? sender, EventArgs e)
        {
            CloseRoomPopup();
        }

        private void MainWindow_IsVisibleChanged_CloseRoomPopup(object sender, DependencyPropertyChangedEventArgs e)
        {
            if (e.NewValue is bool visible && !visible)
                CloseRoomPopup();
        }

        private void CloseRoomPopup()
        {
            if (RoomPopup != null && RoomPopup.IsOpen)
            {
                RoomPopup.IsOpen = false;
                if (_uiReady)
                    _ = ScrollLobbyTopAsync("close");
            }
        }

        private void MainWindow_PreviewMouseDown_CloseRoomPopup(object sender, MouseButtonEventArgs e)
        {
            if (RoomPopup == null || !RoomPopup.IsOpen || RoomPopup.Child == null)
                return;

            if (IsDescendantOf(e.OriginalSource as DependencyObject, RoomPopup.Child) ||
                IsDescendantOf(e.OriginalSource as DependencyObject, RoomHeader))
            {
                return;
            }

            RoomPopup.IsOpen = false;
            if (_uiReady)
                _ = ScrollLobbyTopAsync("outside-click");
        }

        private static bool IsDescendantOf(DependencyObject? source, DependencyObject? target)
        {
            if (source == null || target == null)
                return false;

            DependencyObject? current = source;
            while (current != null)
            {
                if (current == target)
                    return true;
                current = VisualTreeHelper.GetParent(current);
            }
            return false;
        }

        private void RoomItem_PropertyChanged(object? sender, PropertyChangedEventArgs e)
        {
            if (e.PropertyName == nameof(RoomOption.IsSelected))
            {
                if (_suppressRoomOptionEvents)
                    return;
                UpdateRoomSummary();
            }
        }

        private void RoomItemCheck_Click(object sender, RoutedEventArgs e)
        {
            if (sender is CheckBox cb && cb.DataContext is RoomOption opt)
            {
                var targetId = !string.IsNullOrWhiteSpace(opt.Id) ? opt.Id : opt.Name;
                if (cb.IsChecked == true && _uiReady)
                    _ = ScrollRoomIntoViewAsync(targetId);
                // Binding updates opt.IsSelected; SyncSelectedRoomsFromOptions() will persist selection.
            }
            UpdateRoomSummary();
        }

        private void ChkRoomAll_Click(object sender, RoutedEventArgs e)
        {
            var target = ChkRoomAll?.IsChecked == true;
            foreach (var it in _roomOptions)
                it.IsSelected = target;

            var changed = SyncSelectedRoomsFromOptions();
            UpdateRoomSummary();
            if (changed) _ = TriggerRoomSaveDebouncedAsync();
        }

        private void RebuildRoomOptions()
        {
            _roomOptions.Clear();
            _roomOptionsCol1.Clear();
            _roomOptionsCol2.Clear();
            foreach (var room in _roomList)
            {
                var item = new RoomOption { Id = room.Id, Name = room.Name, IsSelected = _selectedRooms.Contains(room.Id) };
                item.PropertyChanged += RoomItem_PropertyChanged;
                _roomOptions.Add(item);
            }

            if (_roomOptions.Count > 0)
            {
                var half = (_roomOptions.Count + 1) / 2;
                for (int i = 0; i < _roomOptions.Count; i++)
                {
                    if (i < half) _roomOptionsCol1.Add(_roomOptions[i]);
                    else _roomOptionsCol2.Add(_roomOptions[i]);
                }
            }
            try
            {
                var roomSample = Sample(_roomList.Select(r => r.Name));
                var selectedSample = Sample(_selectedRooms);
                var roomSet = new HashSet<string>(_roomList.Select(r => r.Id), StringComparer.OrdinalIgnoreCase);
                var missing = _selectedRooms.Where(n => !roomSet.Contains(n)).ToArray();
                var selectedInOptions = _roomOptions.Count(it => it.IsSelected);
                Log("[ROOMDBG][RebuildRoomOptions] roomList=" + _roomList.Count +
                    " selectedRooms=" + _selectedRooms.Count +
                    " selectedOptions=" + selectedInOptions +
                    " roomSample=" + roomSample +
                    " selectedSample=" + selectedSample +
                    " missing=" + Sample(missing));
            }
            catch { }
        }

        private static string Sample(IEnumerable<string> items, int take = 4)
        {
            var arr = items?
                .Where(s => !string.IsNullOrWhiteSpace(s))
                .Select(s => s.Trim())
                .Take(take)
                .ToArray() ?? Array.Empty<string>();
            return arr.Length == 0 ? "(rỗng)" : string.Join(" | ", arr);
        }

        private bool SyncSelectedRoomsFromOptions()
        {
            var before = BuildRoomsSignature(_selectedRooms);
            if (_roomOptions.Count == 0)
                return false;
            _selectedRooms.Clear();
            foreach (var it in _roomOptions)
                if (it.IsSelected) _selectedRooms.Add(it.Id);

            _cfg.SelectedRooms = _selectedRooms.ToList();
            var after = BuildRoomsSignature(_selectedRooms);
            return !string.Equals(before, after, StringComparison.Ordinal);
        }

        private void UpdateRoomSummary()
        {
            var changed = SyncSelectedRoomsFromOptions();

            var hasLoadedRooms = _roomListLastLoaded != DateTime.MinValue;
            int total = hasLoadedRooms ? _roomOptions.Count : 0;
            int sel = hasLoadedRooms ? _roomOptions.Count(i => i.IsSelected) : 0;

            if (TxtRoomSummary != null)
            {
                if (sel <= 0)
                    TxtRoomSummary.Text = "Không có mục nào";
                else if (sel >= total && total > 0)
                    TxtRoomSummary.Text = "Đã chọn tất cả";
                else
                    TxtRoomSummary.Text = $"Đã chọn {sel} / {total}";
            }

            if (TxtRoomCount != null)
                TxtRoomCount.Text = $"{sel}/{total} đã chọn";

            if (ChkRoomAll != null)
            {
                try { ChkRoomAll.Click -= ChkRoomAll_Click; } catch { }
                if (sel == 0) ChkRoomAll.IsChecked = false;
                else if (sel == total) ChkRoomAll.IsChecked = true;
                else ChkRoomAll.IsChecked = null;
                try { ChkRoomAll.Click += ChkRoomAll_Click; } catch { }
            }

            UpdateCreateOverlayButtonState();

            if (_uiReady && changed)
                _ = TriggerRoomSaveDebouncedAsync();

            if (_uiReady)
                _ = TriggerPinSyncDebouncedAsync();
        }

        private void UpdateCreateOverlayButtonState()
        {
            if (BtnCreateOverlay == null)
                return;
            BtnCreateOverlay.IsEnabled = _selectedRooms.Count > 0;
        }

        private async Task TriggerRoomSaveDebouncedAsync()
        {
            if (!_uiReady) return;
            _roomSaveCts = await DebounceAsync(_roomSaveCts, 300, async () =>
            {
                try
                {
                    var sig = BuildRoomsSignature(_selectedRooms);
                    if (!string.Equals(sig, _lastSavedRoomsSignature, StringComparison.Ordinal))
                    {
                        _lastSavedRoomsSignature = sig;
                        await SaveConfigAsync();
                    }
                }
            catch { }
            });
        }

        private async Task TriggerPinSyncDebouncedAsync(bool force = false)
        {
            if (!_uiReady) return;
            _pinSyncCts = await DebounceAsync(_pinSyncCts, 350, async () =>
            {
                try
                {
                    await SyncSelectedRoomsPinsAsync(force);
                }
                catch (Exception ex)
                {
                    Log("[PIN] " + ex.Message);
                }
            });
        }

        private async Task SyncSelectedRoomsPinsAsync(bool force = false)
        {
            if (!_uiReady) return;
            if (Web?.CoreWebView2 == null) return;

            var sig = BuildRoomsSignature(_selectedRooms);
            if (!force && string.Equals(sig, _lastPinSyncSignature, StringComparison.Ordinal))
                return;

            _lastPinSyncSignature = sig;
            var roomsJson = JsonSerializer.Serialize(_selectedRooms.ToList());
            var script = $"window.__abxTableOverlay && window.__abxTableOverlay.pinRooms({roomsJson});";
            await Web.ExecuteScriptAsync(script);
        }

        private async Task ScrollRoomIntoViewAsync(string? roomName)
        {
            if (!_uiReady) return;
            if (Web?.CoreWebView2 == null) return;
            var name = (roomName ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(name))
                return;

            var nameJson = JsonSerializer.Serialize(name);
            var script = $"window.__abxTableOverlay && window.__abxTableOverlay.scrollToRoom({nameJson});";
            try
            {
                await Web.ExecuteScriptAsync(script);
            }
            catch (Exception ex)
            {
                Log("[PIN][SCROLL] " + ex.Message);
            }
        }

        private async Task ScrollLobbyTopAsync(string reason)
        {
            if (!_uiReady) return;
            if (Web?.CoreWebView2 == null) return;
            var script = "window.__abxTableOverlay && window.__abxTableOverlay.scrollToTop && window.__abxTableOverlay.scrollToTop({behavior:'auto'});";
            try
            {
                await Web.ExecuteScriptAsync(script);
            }
            catch (Exception ex)
            {
                Log("[PIN][SCROLLTOP] " + reason + " " + ex.Message);
            }
        }

        private async Task ApplyPinnedRoomsFromWebAsync(IEnumerable<string> pinned)
        {
            var incoming = (pinned ?? Array.Empty<string>())
                .Select(s => (s ?? "").Trim())
                .Where(s => !string.IsNullOrWhiteSpace(s))
                .ToList();

            await Dispatcher.InvokeAsync(() =>
            {
                var currentSig = BuildRoomsSignature(_selectedRooms);
                var incomingSig = BuildRoomsSignature(incoming);
                if (string.Equals(currentSig, incomingSig, StringComparison.Ordinal))
                    return;

                if (_roomOptions.Count > 0)
                {
                    var idSet = new HashSet<string>(_roomList
                        .Select(x => x.Id)
                        .Where(x => !string.IsNullOrWhiteSpace(x)),
                        StringComparer.OrdinalIgnoreCase);

                    var normToId = _roomList
                        .Where(x => !string.IsNullOrWhiteSpace(x.Name))
                        .GroupBy(x => TextNorm.U(x.Name), StringComparer.Ordinal)
                        .ToDictionary(g => g.Key, g => g.First().Id, StringComparer.Ordinal);

                    var nextSel = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                    foreach (var s in incoming)
                    {
                        if (idSet.Contains(s))
                        {
                            nextSel.Add(s);
                            continue;
                        }
                        var norm = TextNorm.U(s);
                        if (normToId.TryGetValue(norm, out var canonicalId))
                            nextSel.Add(canonicalId);
                    }

                    _suppressRoomOptionEvents = true;
                    try
                    {
                        foreach (var it in _roomOptions)
                        {
                            var should = nextSel.Contains(it.Id);
                            if (it.IsSelected != should)
                                it.IsSelected = should;
                        }
                    }
                    finally
                    {
                        _suppressRoomOptionEvents = false;
                    }

                    _lastPinSyncSignature = BuildRoomsSignature(nextSel);
                    UpdateRoomSummary();
                }
                else
                {
                    _selectedRooms.Clear();
                    foreach (var s in incoming)
                        _selectedRooms.Add(s);
                    _cfg.SelectedRooms = _selectedRooms.ToList();
                    _lastPinSyncSignature = BuildRoomsSignature(_selectedRooms);
                    UpdateRoomSummary();
                    _ = TriggerRoomSaveDebouncedAsync();
                }
            });
        }

        private static string BuildRoomsSignature(IEnumerable<string> rooms)
        {
            return string.Join("|", rooms.OrderBy(x => x, StringComparer.OrdinalIgnoreCase));
        }



        private void ApplyMoneyStrategyToUI(string id)
        {
            if (CmbMoneyStrategy == null) return;
            foreach (var it in CmbMoneyStrategy.Items.OfType<ComboBoxItem>())
            {
                var tag = (it.Tag as string) ?? "";
                if (string.Equals(tag, id, StringComparison.OrdinalIgnoreCase))
                {
                    CmbMoneyStrategy.SelectedItem = it;
                    return;
                }
            }
            CmbMoneyStrategy.SelectedIndex = 0; // fallback
        }

        private string GetMoneyStrategyFromUI()
        {
            return (CmbMoneyStrategy?.SelectedItem as ComboBoxItem)?.Tag as string
                   ?? "IncreaseWhenLose";
        }

        private void UpdateS7ResetOptionUI()
        {
            try
            {
                var isS7 = string.Equals(GetMoneyStrategyFromUI(), "WinUpLoseKeep", StringComparison.OrdinalIgnoreCase);
                if (ChkS7ResetOnProfit != null)
                {
                    ChkS7ResetOnProfit.Visibility = isS7 ? Visibility.Visible : Visibility.Collapsed;
                    if (isS7)
                        ChkS7ResetOnProfit.IsChecked = _cfg.S7ResetOnProfit;
                }
                MoneyHelper.S7ResetOnProfit = _cfg.S7ResetOnProfit;
            }
            catch { }
        }

        private async void ChkS7ResetOnProfit_Changed(object sender, RoutedEventArgs e)
        {
            if (!_uiReady || _suppressTableSync) return;
            _cfg.S7ResetOnProfit = (ChkS7ResetOnProfit?.IsChecked == true);
            MoneyHelper.S7ResetOnProfit = _cfg.S7ResetOnProfit;
            MoneyHelper.ResetTempProfitForWinUpLoseKeep();
            if (!string.IsNullOrWhiteSpace(_activeTableId))
                UpdateTableSettingFromUi(_activeTableId);
            else
                await SaveConfigAsync();
        }

        async void CmbMoneyStrategy_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (!_uiReady || _suppressTableSync) return;
            _cfg.MoneyStrategy = GetMoneyStrategyFromUI();
            MoneyHelper.ResetTempProfitForWinUpLoseKeep();
            // NEW: mỗi “Quản lý vốn” có chuỗi tiền riêng → nạp lại ô StakeCsv
            LoadStakeCsvForCurrentMoneyStrategy();
            UpdateS7ResetOptionUI();
            if (!string.IsNullOrWhiteSpace(_activeTableId))
                UpdateTableSettingFromUi(_activeTableId);
            else
                await SaveConfigAsync();
            Log($"[MoneyStrategy] updated: {_cfg.MoneyStrategy}");
        }


        // === REPLACE: thay toàn bộ hàm UpdateTooltips() bằng bản này ===
        private void UpdateTooltips()
        {
            // Nhóm Quản lý vốn
            AttachTip(TxtStakeCsv, TIP_STAKE_CSV);
            AttachTip(TxtCutProfit, TIP_CUT_PROFIT);
            AttachTip(TxtCutLoss, TIP_CUT_LOSS);

            // % thời gian
            int idx = CmbBetStrategy?.SelectedIndex ?? 4;
            AttachTip(TxtDecisionSecond,
                (idx == 2 || idx == 3) ? TIP_DECISION_PERCENT_NI : TIP_DECISION_PERCENT_GENERAL);

            // Chuỗi/Thế cầu
            AttachTip(TxtChuoiCau,
                (idx == 0) ? TIP_SEQ_CL :
                (idx == 2) ? TIP_SEQ_NI :
                "Chọn chiến lược 1 hoặc 3 để nhập Chuỗi cầu.");

            AttachTip(TxtTheCau,
                (idx == 1) ? TIP_THE_CL :
                (idx == 3) ? TIP_THE_NI :
                "Chọn chiến lược 2 hoặc 4 để nhập Thế cầu.");
            // ==== BẮT ĐẦU: Tooltip cho chiến lược đặt cược ====
            string tip = idx switch
            {
                0 => "1) Chuỗi C/L tự nhập: So khớp chuỗi C/L cấu hình thủ công (cũ→mới); khi khớp mẫu gần nhất sẽ đặt theo cửa chỉ định; không khớp dùng logic mặc định.",
                1 => "2) Thế cầu C/L tự nhập: Ánh xạ 'mẫu quá khứ → cửa kế tiếp' theo danh sách quy tắc; ưu tiên mẫu dài và khớp gần nhất; hỗ trợ ',', ';', '|', hoặc xuống dòng.",
                2 => "3) Chuỗi I/N: So khớp dãy Ít/Nhiều (I/N) cấu hình thủ công; khớp thì đặt theo chỉ định; không khớp dùng logic mặc định.",
                3 => "4) Thế cầu I/N: Ánh xạ mẫu I/N → cửa kế tiếp; ưu tiên mẫu dài; cho phép nhiều luật trong cùng danh sách.",
                4 => "5) Theo cầu trước (thông minh): Dựa vào ván gần nhất và heuristics nội bộ; đánh liên tục; quản lý vốn theo chuỗi tiền, cut_profit/cut_loss.",
                5 => "6) Cửa đặt ngẫu nhiên: Mỗi ván chọn CHẴN/LẺ ngẫu nhiên; vẫn tuân theo MoneyManager và ngưỡng cắt lãi/lỗ.",
                6 => "7) Bám cầu C/L (thống kê): Duyệt k từ lớn→nhỏ (k=6 mặc định); đếm tần suất C/L sau các lần khớp đuôi; chọn phía đa số; hòa → đảo 1–1; không có mẫu → theo ván cuối; đánh liên tục.",
                7 => "8) Xu hướng chuyển trạng thái: Thống kê 6 chuyển gần nhất giữa các ván ('lặp' vs 'đảo'); nếu 'đảo' nhiều hơn → đánh ngược ván cuối; ngược lại → theo ván cuối; đánh liên tục.",
                8 => "9) Run-length (dài chuỗi): Tính độ dài chuỗi ký tự cuối; nếu run ≥ T (mặc định T=3) → đảo để mean-revert; nếu run ngắn → theo đà (momentum); đánh liên tục.",
                9 => "10) Chuyên gia bỏ phiếu: Kết hợp 5 chuyên gia (theo-last, đảo-last, run-length, transition, AI-stat); chọn phía đa số; hòa → đảo; đánh liên tục để phủ nhiều kịch bản.",
                10 => "11) Lịch chẻ 10 tay: Tay 1–5 theo ván cuối, tay 6–10 đảo ván cuối; lặp lại block cố định; đơn giản, dễ dự báo nhịp.",
                11 => "12) KNN chuỗi con: So khớp gần đúng tail k (k=6..3) với Hamming ≤ 1; exact-match tính 2 điểm, near-match 1 điểm; chọn phía điểm cao hơn; hòa → đảo; không match → theo ván cuối; đánh liên tục.",
                12 => "13) Lịch hai lớp: Lịch pha trộn 10 bước (1–3 theo-last, 4 đảo, 5–7 AI-stat, 8 đảo, 9 theo, 10 AI-stat); lặp lại; cân bằng giữa momentum/mean-revert/thống kê; đánh liên tục.",
                13 => "14) AI học tại chỗ (n-gram): Học dần từ kết quả thật; dùng tần suất có làm mịn + backoff; hòa → đảo 1–1; bộ nhớ cố định, không phình.",
                14 => "15) Bỏ phiếu Top10 có điều kiện; Loss-Guard động; Hard-guard tự bật khi L≥5 và tự gỡ khi thắng 2 ván liên tục hoặc w20>55%; hòa 5–5 đánh ngẫu nhiên; 6–4 nhưng conf<0.60 thì fallback theo Regime (ZIGZAG=ZigFollow, còn lại=FollowPrev). Ưu tiên “ăn trend” khi guard ON. Re-seed sau mỗi ván (tối đa 50 tay)",
                15 => "16) TOP10 TÍCH LŨY (khởi từ 50 C/L). Khởi tạo thống kê từ 50 kết quả đầu vào (C/L). Mỗi kết quả mới: cộng dồn cho chuỗi dài 10 “mới về”. Luôn đánh theo chuỗi có bộ đếm lớn nhất; chỉ chuyển chuỗi khi THẮNG và chuỗi mới có đếm ≥ hiện tại.",
                _ => "Chiến lược chưa xác định."
            };

            if (CmbBetStrategy != null)
            {
                CmbBetStrategy.ToolTip = tip;

                // Tuỳ chọn: tinh chỉnh thời gian hiển thị tooltip
                System.Windows.Controls.ToolTipService.SetShowDuration(CmbBetStrategy, 20000);
                System.Windows.Controls.ToolTipService.SetInitialShowDelay(CmbBetStrategy, 300);
            }

            // Nếu có label/panel bao ngoài (ví dụ LblBetStrategy hoặc GridBetStrategy), set kèm:
            AttachTip(CmbBetStrategy, tip);
            // ==== KẾT THÚC: Tooltip cho chiến lược đặt cược ====
        }

        private static string GetStrategyTooltipText(int idx)
        {
            return idx switch
            {
                0 => "1) Chuỗi C/L tự nhập: So khớp chuỗi C/L cấu hình thủ công (cũ→mới); khi khớp mẫu gần nhất sẽ đặt theo cửa chỉ định; không khớp dùng logic mặc định.",
                1 => "2) Thế cầu C/L tự nhập: Ánh xạ 'mẫu quá khứ → cửa kế tiếp' theo danh sách quy tắc; ưu tiên mẫu dài và khớp gần nhất; hỗ trợ ',', ';', '|', hoặc xuống dòng.",
                2 => "3) Chuỗi I/N: So khớp dãy Ít/Nhiều (I/N) cấu hình thủ công; khớp thì đặt theo chỉ định; không khớp dùng logic mặc định.",
                3 => "4) Thế cầu I/N: Ánh xạ mẫu I/N → cửa kế tiếp; ưu tiên mẫu dài; cho phép nhiều luật trong cùng danh sách.",
                4 => "5) Theo cầu trước (thông minh): Dựa vào ván gần nhất và heuristics nội bộ; đánh liên tục; quản lý vốn theo chuỗi tiền, cut_profit/cut_loss.",
                5 => "6) Cửa đặt ngẫu nhiên: Mỗi ván chọn CHẴN/LẺ ngẫu nhiên; vẫn tuân theo MoneyManager và ngưỡng cắt lãi/lỗ.",
                6 => "7) Bám cầu C/L (thống kê): Duyệt k từ lớn→nhỏ (k=6 mặc định); đếm tần suất C/L sau các lần khớp đuôi; chọn phía đa số; hòa → đảo 1–1; không có mẫu → theo ván cuối; đánh liên tục.",
                7 => "8) Xu hướng chuyển trạng thái: Thống kê 6 chuyển gần nhất giữa các ván ('lặp' vs 'đảo'); nếu 'đảo' nhiều hơn → đánh ngược ván cuối; ngược lại → theo ván cuối; đánh liên tục.",
                8 => "9) Run-length (dài chuỗi): Tính độ dài chuỗi ký tự cuối; nếu run ≥ T (mặc định T=3) → đảo để mean-revert; nếu run ngắn → theo đà (momentum); đánh liên tục.",
                9 => "10) Chuyên gia bỏ phiếu: Kết hợp 5 chuyên gia (theo-last, đảo-last, run-length, transition, AI-stat); chọn phía đa số; hòa → đảo; đánh liên tục để phủ nhiều kịch bản.",
                10 => "11) Lịch chẻ 10 tay: Tay 1–5 theo ván cuối, tay 6–10 đảo ván cuối; lặp lại block cố định; đơn giản, dễ dự báo nhịp.",
                11 => "12) KNN chuỗi con: So khớp gần đúng tail k (k=6..3) với Hamming ≤ 1; exact-match tính 2 điểm, near-match 1 điểm; chọn phía điểm cao hơn; hòa → đảo; không match → theo ván cuối; đánh liên tục.",
                12 => "13) Lịch hai lớp: Lịch pha trộn 10 bước (1–3 theo-last, 4 đảo, 5–7 AI-stat, 8 đảo, 9 theo, 10 AI-stat); lặp lại; cân bằng giữa momentum/mean-revert/thống kê; đánh liên tục.",
                13 => "14) AI học tại chỗ (n-gram): Học dần từ kết quả thật; dùng tần suất có làm mịn + backoff; hòa → đảo 1–1; bộ nhớ cố định, không phình.",
                14 => "15) Bỏ phiếu Top10 có điều kiện; Loss-Guard động; Hard-guard tự bật khi L≥5 và tự gỡ khi thắng 2 ván liên tục hoặc w20>55%; hòa 5–5 đánh ngẫu nhiên; 6–4 nhưng conf<0.60 thì fallback theo Regime (ZIGZAG=ZigFollow, còn lại=FollowPrev). Ưu tiên “ăn trend” khi guard ON. Re-seed sau mỗi ván (tối đa 50 tay)",
                15 => "16) TOP10 TÍCH LŨY (khởi từ 50 C/L). Khởi tạo thống kê từ 50 kết quả đầu vào (C/L). Mỗi kết quả mới: cộng dồn cho chuỗi dài 10 “mới về”. Luôn đánh theo chuỗi có bộ đếm lớn nhất; chỉ chuyển chuỗi khi THẮNG và chuỗi mới có đếm ≥ hiện tại.",
                _ => "Chiến lược chưa xác định."
            };
        }


        private void NewWindowRequested(object? s, CoreWebView2NewWindowRequestedEventArgs e)
        {
            try
            {
                e.Handled = true;
                if (!string.IsNullOrWhiteSpace(e.Uri))
                    Web.CoreWebView2.Navigate(e.Uri);
            }
            catch (Exception ex) { Log("[NewWindowRequested] " + ex); }
        }


        // ====== Auto-login runner ======
        private async Task TryAutoLoginAsync(int delayMs = 500, bool force = false)
        {
            try
            {
                var u = T(TxtUser);
                var p = P(TxtPass);
                if (string.IsNullOrWhiteSpace(u) || string.IsNullOrWhiteSpace(p))
                    return;

                if (!force && (DateTime.UtcNow - _autoLoginLast).TotalSeconds < 2) return;
                if (_autoLoginBusy) return;
                _autoLoginBusy = true;

                if (delayMs > 0) await Task.Delay(delayMs);
                var res = await ClickLoginButtonAsync();
                Log("[AutoLogin] " + res);
                _autoLoginLast = DateTime.UtcNow;
            }
            catch (Exception ex)
            {
                Log("[AutoLogin] " + ex);
            }
            finally
            {
                _autoLoginBusy = false;
            }
        }

        // Bấm nút "Đăng nhập" TRONG POPUP COCOS
        private async Task<string> ClickLoginButtonAsync()
        {
            if (!IsWebAlive)
                return "web-dead";

            await EnsureWebReadyAsync();
            if (!IsWebAlive)
                return "web-dead-after-ensure";

            // gọi đúng hàm JS bạn đã tạo trong js_home_v2.js
            var js = @"
    (function(){
        try {
            if (window.__cw_clickPopupLogin) {
                var ok = window.__cw_clickPopupLogin();
                return ok ? 'clicked' : 'no-node';
            }
            return 'no-fn';
        } catch (e) {
            return 'err:' + (e && e.message ? e.message : e);
        }
    })();";

            // bạn đã có helper ExecJsAsyncStr(...) nên dùng luôn để bỏ dấu ngoặc kép
            var res = await ExecJsAsyncStr(js);
            Log("[GAME] Popup-login (cocos): " + res);
            return res;
        }




        // Gọi Login từ HOME:
        // - Ưu tiên gọi API JS (__abx_hw_clickLogin)
        // - Fallback: gửi lệnh kiểu "ấn nút" xuống trang (home_click_login)
        private async Task<bool> HomeClickLoginAsync()
        {
            try
            {
                await EnsureWebReadyAsync();
                var r = await Web.CoreWebView2.ExecuteScriptAsync(
                    "(typeof window.__abx_hw_clickLogin==='function') ? window.__abx_hw_clickLogin() : 'no-fn';"
                ) ?? "\"\"";
                if (r.Contains("ok", StringComparison.OrdinalIgnoreCase))
                {
                    Log("[HOME] click login via JS: ok");
                    return true;
                }

                // fallback: gọi theo "nút" (host -> page)
                var msg = JsonSerializer.Serialize(new { cmd = "home_click_login" });
                Web.CoreWebView2.PostWebMessageAsJson(msg);
                Log("[HOME] sent host cmd: home_click_login");
                return true;
            }
            catch (Exception ex)
            {
                Log("[HOME] click login error: " + ex.Message);
                return false;
            }
        }

        // Gọi Play Xóc Đĩa từ HOME:
        // - Ưu tiên gọi API JS (__abx_hw_clickPlayXDL)
        // - Fallback: gửi lệnh kiểu "nút" (home_click_xoc)
        private async Task<bool> HomeClickPlayAsync()
        {
            try
            {
                // Allow forcing lobby again on each home-start flow
                _lastForcedLobbyUrl = null;

                await EnsureWebReadyAsync();
                var r = await Web.CoreWebView2.ExecuteScriptAsync(
                    "(typeof window.__abx_hw_clickPlayXDL==='function') ? window.__abx_hw_clickPlayXDL() : 'no-fn';"
                ) ?? "\"\"";
                if (r.Contains("ok", StringComparison.OrdinalIgnoreCase))
                {
                    Log("[HOME] play via JS: ok");
                    return true;
                }

                // fallback: gọi theo "nút" (host -> page)
                var msg = JsonSerializer.Serialize(new { cmd = "home_click_xoc" });
                Web.CoreWebView2.PostWebMessageAsJson(msg);
                Log("[HOME] sent host cmd: home_click_xoc");
                return true;
            }
            catch (Exception ex)
            {
                Log("[HOME] play click error: " + ex.Message);
                return false;
            }
        }

        private async Task<(string Username, string Balance)> WaitForHomeUserAsync(int timeoutMs, DateTime sinceUtc)
        {
            var sw = System.Diagnostics.Stopwatch.StartNew();
            while (sw.ElapsedMilliseconds < timeoutMs)
            {
                var u = _homeUsername;
                var b = _homeBalance;
                var uOk = !string.IsNullOrWhiteSpace(u) && _homeUsernameAt >= sinceUtc;
                var bOk = !string.IsNullOrWhiteSpace(b) && _homeBalanceAt >= sinceUtc;
                if (uOk && bOk)
                    return (u, b);

                await Task.Delay(250);
            }

            return (string.Empty, string.Empty);
        }

        // (tuỳ chọn) kích hoạt push thủ công từ C# với ms tùy ý
        private void HomeStartPush(int ms = 800)
        {
            try
            {
                var msg = JsonSerializer.Serialize(new { cmd = "home_start_push", ms });
                Web.CoreWebView2.PostWebMessageAsJson(msg);
                Log($"[HOME] cmd home_start_push ms={ms}");
            }
            catch { }
        }



        // ====== ExecJs string ======
        private bool IsWebAlive =>
    Web != null && Web.CoreWebView2 != null;

        private async Task<string> ExecJsAsyncStr(string js)
        {
            // nếu cửa sổ đã bị host đóng thì Web sẽ = null
            if (!IsWebAlive)
            {
                Log("**Web** was null. Skip ExecJsAsyncStr.");
                return "";
            }

            await EnsureWebReadyAsync();

            if (!IsWebAlive)
            {
                Log("**Web** lost after EnsureWebReadyAsync. Skip.");
                return "";
            }

            var raw = await Web.ExecuteScriptAsync(js);
            if (string.IsNullOrEmpty(raw)) return "";
            if (raw.Length >= 2 && raw[0] == '"')
                raw = Regex.Unescape(raw).Trim('"');
            return raw;
        }


        // ====== CDP tap ======
        private async Task EnableCdpNetworkTapAsync()
        {
            if (_cdpNetworkOn || Web?.CoreWebView2 == null) return;
            try
            {
                await Web.CoreWebView2.CallDevToolsProtocolMethodAsync("Network.enable", "{}");
                _cdpNetworkOn = true;

                Web.CoreWebView2
                   .GetDevToolsProtocolEventReceiver("Network.webSocketCreated")
                   .DevToolsProtocolEventReceived += (s, e) =>
                   {
                       try
                       {
                           using var doc = JsonDocument.Parse(e.ParameterObjectAsJson);
                           var root = doc.RootElement;
                           var reqId = root.GetProperty("requestId").GetString() ?? "";
                           var url = root.TryGetProperty("url", out var u) ? (u.GetString() ?? "") : "";
                           if (!string.IsNullOrEmpty(reqId)) _wsUrlByRequestId[reqId] = url;
                           if (IsInteresting(url)) LogPacket("WS.created", url, "", false);
                       }
                       catch (Exception ex) { Log("[CDP wsCreated] " + ex.Message); }
                   };

                Web.CoreWebView2
                   .GetDevToolsProtocolEventReceiver("Network.webSocketFrameReceived")
                   .DevToolsProtocolEventReceived += (s, e) =>
                   {
                       try
                       {
                           using var doc = JsonDocument.Parse(e.ParameterObjectAsJson);
                           var root = doc.RootElement;
                           var reqId = root.GetProperty("requestId").GetString() ?? "";
                           _wsUrlByRequestId.TryGetValue(reqId, out var url);
                           var resp = root.GetProperty("response");
                           var payload = resp.TryGetProperty("payloadData", out var pd) ? (pd.GetString() ?? "") : "";
                           var opcode = resp.TryGetProperty("opcode", out var op) ? op.GetInt32() : 1;
                           var isBin = opcode != 1;
                           //if (IsInteresting(url)) LogPacket("WS.recv", url, PreviewPayload(payload, isBin), isBin);
                       }
                       catch (Exception ex) { Log("[CDP wsRecv] " + ex.Message); }
                   };

                Web.CoreWebView2
                   .GetDevToolsProtocolEventReceiver("Network.webSocketFrameSent")
                   .DevToolsProtocolEventReceived += (s, e) =>
                   {
                       try
                       {
                           using var doc = JsonDocument.Parse(e.ParameterObjectAsJson);
                           var root = doc.RootElement;
                           var reqId = root.GetProperty("requestId").GetString() ?? "";
                           _wsUrlByRequestId.TryGetValue(reqId, out var url);
                           var resp = root.GetProperty("response");
                           var payload = resp.TryGetProperty("payloadData", out var pd) ? (pd.GetString() ?? "") : "";
                           var opcode = resp.TryGetProperty("opcode", out var op) ? op.GetInt32() : 1;
                           var isBin = opcode != 1;
                           //if (IsInteresting(url)) LogPacket("WS.send", url, PreviewPayload(payload, isBin), isBin);
                       }
                       catch (Exception ex) { Log("[CDP wsSend] " + ex.Message); }
                   };

                Log("[CDP] Network tap enabled");
            }
            catch (Exception ex)
            {
                Log("[CDP] Enable failed: " + ex.Message);
            }
        }

        private async Task DisableCdpNetworkTapAsync()
        {
            if (!_cdpNetworkOn || Web?.CoreWebView2 == null) return;
            try
            {
                await Web.CoreWebView2.CallDevToolsProtocolMethodAsync("Network.disable", "{}");
                _cdpNetworkOn = false;
                Log("[CDP] Network tap disabled");
            }
            catch (Exception ex) { Log("[CDP] Disable failed: " + ex.Message); }
        }

        private bool IsInteresting(string? url)
        {
            if (string.IsNullOrWhiteSpace(url)) return true;
            foreach (var hint in _pktInterestingHints)
                if (url.IndexOf(hint, StringComparison.OrdinalIgnoreCase) >= 0) return true;
            return false;
        }

        private string PreviewPayload(string payload, bool isBinary)
        {
            if (string.IsNullOrEmpty(payload)) return "";
            try
            {
                if (!isBinary)
                {
                    var s = payload.Trim();
                    if (s.StartsWith("{") || s.StartsWith("["))
                    {
                        if (s.Length > 2000) s = s.Substring(0, 2000) + "…";
                        return s;
                    }
                    if (s.Length > 2000) s = s.Substring(0, 2000) + "…";
                    return s;
                }
                var bytes = Encoding.UTF8.GetBytes(payload);
                int n = Math.Min(bytes.Length, 64);
                var sb = new StringBuilder(n * 3);
                for (int i = 0; i < n; i++) sb.Append(bytes[i].ToString("X2")).Append(' ');
                if (bytes.Length > n) sb.Append("…");
                return "BIN[" + bytes.Length + "]: " + sb.ToString();
            }
            catch
            {
                var s = payload;
                if (s.Length > 2000) s = s.Substring(0, 2000) + "…";
                return s;
            }
        }

        private void LogPacket(string kind, string? url, string preview, bool isBinary)
        {
            var line = $"[PKT] {DateTime.Now:HH:mm:ss} {kind} {url ?? ""} {preview}";
            // Ghi file luôn (không chọn)
            EnqueueFile(line);

            // UI: mặc định tắt, hoặc lấy mẫu 1/N
            if (SHOW_PACKET_LINES_IN_UI)
            {
                _pktUiSample++;
                if (_pktUiSample % PACKET_UI_SAMPLE_EVERY_N == 0)
                {
                    _pktUiSample = 0;

                    var sb = new StringBuilder();
                    sb.Append("[PKT] ").Append(kind).Append(' ');
                    sb.Append(isBinary ? "bin" : "txt").Append(' ');
                    sb.Append(url ?? "");
                    sb.AppendLine();
                    sb.Append(preview);
                    var text = sb.ToString();
                    _ = Dispatcher.InvokeAsync(() =>
                    {
                        try
                        {
                            TxtLog.Text = text;
                            TxtLog.CaretIndex = TxtLog.Text.Length;
                            TxtLog.ScrollToEnd();
                        }
                        catch { }
                    });
                }
            }
        }


        /// <summary>
        /// Mở live theo index trong .livestream-section__live (0-based).
        /// Chỉ nhắm đúng item-live[index], click overlay/play và chờ video mở.
        /// </summary>
        private async Task<string> OpenLiveItemImmediatelyAsync(int zeroBasedIndex, int timeoutMs = 20000)
        {
            if (Web == null) return "web-null";
            await EnsureWebReadyAsync();

            string js = $@"(async function(idx, timeoutMs){{
  const sleep=t=>new Promise(r=>setTimeout(r,t));
  const isVis=el=>{{ if(!el) return false; const r=el.getBoundingClientRect(); const cs=getComputedStyle(el);
                     return r.width>4 && r.height>4 && cs.display!=='none' && cs.visibility!=='hidden' && cs.pointerEvents!=='none'; }};

  function root(){{ return document.querySelector('.livestream-section__live'); }}
  function items(){{ const rt=root(); return rt?Array.from(rt.querySelectorAll('.item-live')):[]; }}

  function pickByIndex(i){{
    const arr = items();
    if(!arr.length) return null;
    const k = Math.max(0, Math.min(i, arr.length-1));
    return arr[k] || null;
  }}

  function overlayHidden(w){{
    const o = w.querySelector('.play-overlay');
    if(!o) return true;
    const cs = getComputedStyle(o);
    return cs.display==='none' || cs.opacity==='0' || cs.pointerEvents==='none' || cs.visibility==='hidden';
  }}

  function playing(w){{
    const v = w.querySelector('video');
    if(v && (v.readyState>=2 || !v.paused)) return true;
    if(overlayHidden(w)) return true;
    return false;
  }}

  function fireAll(w){{
    if(!w) return 'no-wrapper';
    try{{ w.scrollIntoView({{block:'center', inline:'center'}}); }}catch(_){{
    }}
    const targets = [
      w.querySelector('.play-overlay .base-button'),
      w.querySelector('.play-overlay'),
      w.querySelector('.play-button'),
      w.querySelector('.pause-area'),
      w
    ].filter(Boolean);

    // bắn sự kiện + click 2 lần để vượt overlay
    for(let rep=0; rep<2; rep++){{
      for(const el of targets){{
        const r = el.getBoundingClientRect();
        const cx = Math.max(0, Math.floor(r.left + r.width/2));
        const cy = Math.max(0, Math.floor(r.top  + r.height/2));
        const top = document.elementFromPoint(cx, cy) || el;
        const seq = ['pointerover','mouseover','pointerenter','mouseenter','pointerdown','mousedown','pointerup','mouseup','click'];
        for(const t of seq){{
          top.dispatchEvent(new MouseEvent(t,{{bubbles:true,cancelable:true,clientX:cx,clientY:cy,view:window}}));
        }}
        try{{ top.click(); }}catch(_){{
        }}
      }}
    }}
    return 'clicked';
  }}

  // Chờ item mount và visible, rồi click
  const t0 = Date.now();
  while((Date.now()-t0) < timeoutMs){{
    const it = pickByIndex(idx);
    if(it && isVis(it)){{
      const w = it.querySelector('.player-wrapper') || it;
      fireAll(w);

      // chờ mở
      const t1 = Date.now();
      while((Date.now()-t1) < timeoutMs){{
        if(playing(w)) return 'opened';
        await sleep(200);
      }}
      return 'open-timeout';
    }}
    await sleep(250);
  }}
  return 'live-item-not-found';
}})({zeroBasedIndex}, {timeoutMs})";

            try
            {
                var res = await ExecJsAsyncStr(js);
                Log("[OpenLiveItemImmediately] " + res);
                return res;
            }
            catch (Exception ex)
            {
                Log("[OpenLiveItemImmediately] " + ex);
                return "err:" + ex.Message;
            }
        }


        // Bấm vào "Xóc Đĩa Live" theo tiêu đề/trang HOME.
        // Trả về: "clicked" nếu đã bấm/mở được, hoặc chuỗi lỗi/trạng thái khác.
        private async Task<string> ClickXocDiaTitleAsync(int timeoutMs = 20000)
        {
            if (Web == null) return "web-null";
            await EnsureWebReadyAsync();

            // 1) Thử bấm trực tiếp anchor/button có text "xóc đĩa" (khử dấu)
            const string clickTitleJs = @"
(function(){
  try{
    const rm=s=>{try{return (s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'');}catch(_){return s||'';}};
    const low=s=>rm(String(s||'').trim().toLowerCase());
    const vis=el=>{ if(!el) return false;
      const r=el.getBoundingClientRect(), cs=getComputedStyle(el);
      return r.width>4 && r.height>4 && cs.display!=='none' && cs.visibility!=='hidden' && cs.pointerEvents!=='none';
    };
    const qa=(s,d)=>Array.from((d||document).querySelectorAll(s));

    function fire(el){
      try{
        el.scrollIntoView({block:'center', inline:'center'});
      }catch(_){}
      const r=el.getBoundingClientRect();
      const cx=Math.max(0, Math.floor(r.left+r.width/2));
      const cy=Math.max(0, Math.floor(r.top +r.height/2));
      const top=document.elementFromPoint(cx,cy) || el;
      const seq=['pointerover','mouseover','pointerenter','mouseenter','pointerdown','mousedown','pointerup','mouseup','click'];
      for(const t of seq){ top.dispatchEvent(new MouseEvent(t,{bubbles:true,cancelable:true,clientX:cx,clientY:cy,view:window})); }
      try{ top.click(); }catch(_){}
    }

    // Quét các anchor/button
    const cands = qa('a,button,[role=""button""],.btn,.base-button,.el-button,.v-btn, .item-live a, .item-live .title, .item-live');
    for(const el of cands){
      const txt = low(el.textContent || el.innerText || el.getAttribute('aria-label') || el.getAttribute('title') || '');
      if (!txt) continue;
      // cần đồng thời có 'xoc' và 'dia'
      if (txt.includes('xoc') && txt.includes('dia') && vis(el)){
        fire(el);
        return 'clicked';
      }
    }
    return 'no-title';
  }catch(e){ return 'err:'+ (e && e.message || e); }
})();";
            try
            {
                var r = await ExecJsAsyncStr(clickTitleJs);
                Log("[ClickXocDiaTitle/anchor] " + r);
                if (r == "clicked") return "clicked";
            }
            catch (Exception ex)
            {
                Log("[ClickXocDiaTitle/anchor ERR] " + ex.Message);
            }

            // 2) Không có anchor rõ ràng -> tìm index trong danh sách .livestream-section__live .item-live
            const string findIndexJs = @"
(function(){
  try{
    const rm=s=>{try{return (s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'');}catch(_){return s||'';}};
    const low=s=>rm(String(s||'').trim().toLowerCase());

    const root = document.querySelector('.livestream-section__live');
    if(!root) return '-1';
    const items = Array.from(root.querySelectorAll('.item-live'));
    for(let i=0;i<items.length;i++){
      const it = items[i];
      let txt = '';
      const title = it.querySelector('.title,.item-live__title,[class*=""title""]');
      if (title) txt = title.textContent || title.innerText || '';
      else txt = it.textContent || '';
      txt = low(txt);
      if (txt.includes('xoc') && txt.includes('dia')) return String(i);
    }
    return '-1';
  }catch(e){ return '-1'; }
})();";
            try
            {
                var idxStr = await ExecJsAsyncStr(findIndexJs);
                if (int.TryParse(idxStr, out var idx) && idx >= 0)
                {
                    Log("[ClickXocDiaTitle/index] found idx=" + idx);
                    var openRes = await OpenLiveItemImmediatelyAsync(idx, timeoutMs);
                    Log("[ClickXocDiaTitle/open by idx] " + openRes);
                    if (openRes == "opened" || openRes.StartsWith("clicked", StringComparison.OrdinalIgnoreCase))
                        return "clicked";
                    return openRes;
                }
                }
            catch (Exception ex)
            {
                Log("[ClickXocDiaTitle/find index ERR] " + ex.Message);
            }

            // 3) Fallback cuối: mở item index 1 (giống VaoXocDia_Click đang dùng)
            try
            {
                var res2 = await OpenLiveItemImmediatelyAsync(1, timeoutMs);
                Log("[ClickXocDiaTitle/fallback idx=1] " + res2);
                if (res2 == "opened" || res2.StartsWith("clicked", StringComparison.OrdinalIgnoreCase))
                    return "clicked";
                return res2;
            }
            catch (Exception ex)
            {
                Log("[ClickXocDiaTitle/fallback ERR] " + ex.Message);
                return "err:" + ex.Message;
            }
        }




        private async void VaoXocDia_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                await SaveConfigAsync();
                await EnsureWebReadyAsync();

                // 1) Ưu tiên gọi API JS: click Login trước
                var res = await ClickLoginButtonAsync();
                Log("[AutoLoginWatch] " + res);

                // đợi nhẹ để trang xử lý login (nếu có)
                await Task.Delay(400);

                // 2) Đợi tối đa 10s để lấy username + balance mới sau khi bấm login
                var waitFrom = DateTime.UtcNow;
                HomeStartPush(240);
                var homeUser = await WaitForHomeUserAsync(10000, waitFrom);
                if (string.IsNullOrWhiteSpace(homeUser.Username) || string.IsNullOrWhiteSpace(homeUser.Balance))
                {
                    try
                    {
                        await Web.ExecuteScriptAsync(
                            "alert('Không lấy được tên đăng nhập, hãy click vào nút \"Đăng nhập & Baccarat nhiều bàn\" lại');");
                    }
                    catch { }
                    return;
                }

                // 3) Sau khi lấy được username/balance thì dùng HomeClickPlayAsync để mở Baccarat nhiều bàn
                var okPlay = await HomeClickPlayAsync();
                Log("[HOME] play baccarat-nhieu-ban via HomeClickPlayAsync => " + okPlay);

                // 4) Không dùng fallback C# vào Xóc Đĩa nữa để tránh mở sai game


                // 4) Không dùng fallback C# vào Xóc Đĩa nữa để tránh mở sai game


                // 4) Cầu nối: đồng bộ & autostart khi đã vào bàn
                //if (_bridge != null)
                //{
                //    // nếu bạn có sửa JS ngoài, nạp lại và re-register
                //    var latestJs = await LoadAppJsAsyncFallback();
                //    if (!string.IsNullOrEmpty(latestJs))
                //        await _bridge.UpdateAppJsAsync(latestJs);

                //    await _bridge.ForceRefreshAsync();
                //}

                // 5) Poll cocos sẵn sàng (giữ nguyên như cũ)
                //var ok = false;
                //for (int i = 0; i < 100; i++)
                //{
                //    var ready = await Web.ExecuteScriptAsync(@"
                //(function(){ try{ return !!(window.cc && cc.director && cc.director.getScene); }
                //             catch(e){ return false; } })()");
                //    Log("[VaoXocDia_Click -> load xoc dia live] " + ready);
                //    if (bool.TryParse(ready, out var b) && b) { ok = true; break; }
                //    await Task.Delay(300);
                //}
                //if (!ok) Log("[CW] Game not ready (Cocos scene not found)");

                // 6) Bật push tick bên canvas (như cũ)
                await Web.ExecuteScriptAsync("window.__cw_startPush && window.__cw_startPush(240);");
                Log("[CW] start push 240ms");
                // NEW: đánh dấu là mình CHỦ ĐỘNG vào game
                _lockGameUi = true;
                _lastGameTickUtc = DateTime.UtcNow;     // để timer thấy cũng hợp lý
                ApplyUiMode(true);
            }
            catch (Exception ex)
            {
                Log("[VaoXocDia_Click] " + ex);
            }
        }




        // Bật watcher: khi thấy nút "Đăng nhập" hoặc ô user/pass hiển thị → tự login
        private void StartAutoLoginWatcher()
        {
            StopAutoLoginWatcher();
            _autoLoginWatchCts = new CancellationTokenSource();
            var cts = _autoLoginWatchCts;

            _ = Task.Run(async () =>
            {
                while (cts != null && !cts.IsCancellationRequested)
                {
                    try
                    {
                        // Không đủ thông tin thì thôi
                        var u = T(TxtUser);
                        var p = P(TxtPass);
                        if (string.IsNullOrWhiteSpace(u) || string.IsNullOrWhiteSpace(p))
                        {
                            await Task.Delay(500, cts.Token);
                            continue;
                        }

                        // JS: phát hiện “cần login” (nút Đăng nhập visible hoặc ô user/pass visible trong bất kỳ iframe nào)
                        string needJs =
        @"(function(){
  const rm=s=>{try{return (s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'');}catch(_){return s||'';}};
  const low=s=>rm(String(s||'').trim().toLowerCase());
  const vis=el=>{if(!el)return false;const r=el.getBoundingClientRect(),cs=getComputedStyle(el);
                 return r.width>4&&r.height>4&&cs.display!=='none'&&cs.visibility!=='hidden'&&cs.pointerEvents!=='none';};
  const qa=(s,d)=>Array.from((d||document).querySelectorAll(s));

  const hasLogin = qa('a,button,[role=""button""],.btn,.base-button')
     .some(el => vis(el) && /dang\\s*nhap|đăng\\s*nhập|login|sign\\s*in/i.test(low(el.textContent)||low(el.value)));

  let userVis=false, passVis=false;
  const frames=[window].concat(Array.from(document.querySelectorAll('iframe'))
                    .map(i=>{try{return i.contentWindow;}catch(_){return null;}}).filter(Boolean));
  for(const w of frames){
    try{
      const d=w.document;
      const u=d.querySelector('input[autocomplete=""username""],input[name*=""user"" i],input[type=""text""],input[type=""email""]');
      const p=d.querySelector('input[type=""password""],input[autocomplete=""current-password""]');
      if(u && vis(u)) userVis = true;
      if(p && vis(p)) passVis = true;
      if(userVis || passVis) break;
    }catch(_){}
  }
  return (hasLogin || userVis || passVis) ? '1' : '0';
})();";

                        var need = await ExecJsAsyncStr(needJs);
                        if (need == "1")
                        {
                            // throttle & mutex
                            if (!_autoLoginBusy && (DateTime.UtcNow - _autoLoginLast).TotalSeconds > 3)
                            {
                                _autoLoginBusy = true;
                                try
                                {
                                    Log("[AutoLoginWatch] need-login → auto-fill + click");
                                    await AutoFillLoginAsync(); // hàm này đã có fallback và tự gọi TryAutoLoginAsync
                                                                // Trong trường hợp trang không mở form, ép Click thêm lần nữa:
                                    var res = await ClickLoginButtonAsync();
                                    Log("[AutoLoginWatch] " + res);
                                    _autoLoginLast = DateTime.UtcNow;
                                }
                                catch (Exception ex) { Log("[AutoLoginWatch] " + ex); }
                                finally { _autoLoginBusy = false; }
                            }
                        }
                }
            catch { }
                    await Task.Delay(400, cts.Token); // nhịp kiểm tra
                }
            }, cts.Token);
        }

        private void StopAutoLoginWatcher()
        {
            try { _autoLoginWatchCts?.Cancel(); } catch { }
            _autoLoginWatchCts = null;
        }














        // Về trang chủ NET88 (Nuxt/Vue) – click logo + dọn overlay + ép SPA + ép điều hướng + fallback C#
        private async Task<string> ClickHomeLogoAsync(int timeoutMs = 12000)
        {
            await EnsureWebReadyAsync();

            string js = @"
(function(timeoutMs){
  return (async () => {
    const sleep=t=>new Promise(r=>setTimeout(r,t));
    const qa=(s,d)=>Array.from((d||document).querySelectorAll(s));
    const vis=el=>{ if(!el) return false; const r=el.getBoundingClientRect(), cs=getComputedStyle(el);
                    return r.width>4 && r.height>4 && cs.display!='none' && cs.visibility!='hidden' && cs.pointerEvents!='none'; };

    function atHome(){
      try{
        let p=(location.pathname||'/').replace(/\/+$/,''); if(p==='') p='/';
        p=p.toLowerCase();
        if (p==='/'||p==='/vi'||p==='/vn') return true;
      }catch(_){}
      // Nuxt/Vue: logo active khi đang ở /
      if (document.querySelector('a.main-logo.router-link-exact-active[aria-current=""page""]')) return true;
      return false;
    }

    function unblockHeader(){
      const header=document.querySelector('#page header, header'); if(!header) return;
      const hr=header.getBoundingClientRect();
      for(const el of qa('body *')){
        if (header.contains(el)) continue;
        const cs=getComputedStyle(el);
        if (!vis(el)) continue;
        if (!/fixed|absolute|sticky/i.test(cs.position)) continue;
        const zi=parseInt(cs.zIndex||'0',10);
        if (isNaN(zi)||zi<100) continue;
        const r=el.getBoundingClientRect();
        // overlap đơn giản
        if (!(r.right<hr.left||r.left>hr.right||r.bottom<hr.top||r.top>hr.bottom)){
          try{ el.style.pointerEvents='none'; }catch(_){}
        }
      }
      try{ header.style.zIndex='99999'; }catch(_){}
    }

    function tryClickLogo(){
      const sels=[
        '#page header a.main-logo',
        'header a.main-logo',
        'a.main-logo',
        'header a[href=""\/""]',
        'a[href=""\/""]',
        'a:has(img[alt*=""net88"" i])',
        'a:has(img[src*=""logo"" i])'
      ];
      for(const s of sels){
        const a=document.querySelector(s);
        if (a && vis(a)){
          try{ a.removeAttribute('target'); a.target='_self'; a.href='/'; }catch(_){}
          try{ a.click(); return true; }catch(_){}
        }
      }
      return false;
    }

    function tempAnchor(){
      try{
        const a=document.createElement('a');
        a.href=location.origin + '/' + '?via=temp&_=' + Date.now();
        a.target='_self'; a.rel='noopener'; a.style.display='none';
        document.body.appendChild(a); a.click();
        setTimeout(()=>{ try{ a.remove(); }catch(_){ } },1500);
        return true;
      }catch(_){ return false; }
    }

    function hardNav(){
      const home = location.origin + '/' + '?_=' + Date.now();
      // 1) Router (Nuxt)
      try{ if (window.$nuxt?.$router?.replace){ window.$nuxt.$router.replace('/'); } }catch(_){}
      // 2) Popstate để kích SPA
      try{ history.replaceState({},'', '/'); dispatchEvent(new PopStateEvent('popstate')); }catch(_){}
      // 3) Điều hướng cứng
      try{ location.replace(home); }catch(_){}
    }

    // ---- chạy ----
    if (atHome()) return 'home-ok(already)';
    const end=Date.now()+timeoutMs;
    window.scrollTo({top:0, behavior:'auto'});

    while(Date.now()<end){
      if (atHome()) return 'home-ok';

      unblockHeader();

      if (tryClickLogo()){
        await sleep(700);
        if (atHome()) return 'home-ok(click)';
      }

      tempAnchor();
      await sleep(700);
      if (atHome()) return 'home-ok(temp-a)';

      hardNav();
      await sleep(900);
      if (atHome()) return 'home-ok(hard)';

      await sleep(200);
    }
    return 'home-timeout';
  })().catch(e => 'err:' + (e && e.message ? e.message : String(e)));
})(" + timeoutMs + @");
";

            try
            {
                var res = await ExecJsAsyncStr(js);
                if (string.IsNullOrWhiteSpace(res)) res = "home-null";
                Log("[ClickHomeLogo] " + res);

                // Fallback cuối từ C#: nếu JS không điều hướng được, tự điều hướng về origin + "/"
                if (res == "home-null" || res.StartsWith("err:") || res == "home-timeout")
                {
                    try
                    {
                        var src = Web?.CoreWebView2?.Source;
                        if (!string.IsNullOrEmpty(src))
                        {
                            var u = new Uri(src);
                            var home = $"{u.Scheme}://{u.Host}/";
                            Web?.CoreWebView2?.Navigate(home);
                            return res + " + csharp-nav";
                        }
                    }
                    catch { /* b? qua */ }
                }

                return res;
            }
            catch (Exception ex)
            {
                Log("[ClickHomeLogo] " + ex);
                return "err:" + ex.Message;
            }
        }

        private static void BuildStakeSeqFromCsv(string? csv, out long[] stakeSeq, out List<long[]> stakeChains, out long[] stakeChainTotals)
        {
            stakeChains = new List<long[]>();

            csv ??= "";
            var lines = csv.Replace("\r", "").Split('\n');
            var flat = new List<long>();

            foreach (var rawLine in lines)
            {
                var line = (rawLine ?? "").Trim();
                if (line.Length == 0) continue;

                var parts = Regex.Split(line, @"[,\s;\-]+");
                var oneChain = new List<long>();

                foreach (var p in parts)
                {
                    if (string.IsNullOrWhiteSpace(p)) continue;
                    if (long.TryParse(p, out var v) && v >= 0)
                    {
                        oneChain.Add(v);
                    }
                }

                if (oneChain.Count > 0)
                {
                    stakeChains.Add(oneChain.ToArray());
                    flat.AddRange(oneChain);
                }
            }

            stakeSeq = flat.Count > 0 ? flat.ToArray() : new long[] { 1000 };
            stakeChainTotals = stakeChains
                .Select(ch => ch.Aggregate(0L, (s, x) => s + x))
                .ToArray();
        }

        private void RebuildStakeSeq(string? csv)
        {
            BuildStakeSeqFromCsv(csv, out _stakeSeq, out _stakeChains, out _stakeChainTotals);
            ShowSeqError(null);
        }




        private async void TxtStakeCsv_TextChanged(object sender, TextChangedEventArgs e)
        {
            if (!_uiReady || _suppressTableSync) return;

            _stakeCts = await DebounceAsync(_stakeCts, 150, async () =>
            {
                var csv = (TxtStakeCsv?.Text ?? "1000,2000,4000,8000,16000").Trim();

                RebuildStakeSeq(csv);

                var id = GetMoneyStrategyFromUI();
                _cfg.StakeCsv = csv; // vẫn lưu bản hiện hành
                _cfg.StakeCsvByMoney ??= new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                if (!string.IsNullOrWhiteSpace(id)) _cfg.StakeCsvByMoney[id] = csv;

                var activeId = _activeTableId;
                if (!string.IsNullOrWhiteSpace(activeId))
                    UpdateTableSettingFromUi(activeId);
                else
                    await SaveConfigAsync();
                Log($"[StakeCsv] updated[{id}]: {csv} -> seq[{_stakeSeq.Length}]");
            });

        }

        private void UpdateBetStrategyUi()
        {
            try
            {
                var idx = CmbBetStrategy?.SelectedIndex ?? 4;
                if (RowChuoiCau != null)
                    RowChuoiCau.Visibility = (idx == 0) ? Visibility.Visible : Visibility.Collapsed; // 1 
                if (RowTheCau != null)
                    RowTheCau.Visibility = (idx == 1) ? Visibility.Visible : Visibility.Collapsed;   // 2
            }
            catch { }
        }

        async void CmbBetStrategy_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            UpdateBetStrategyUi();
            SyncStrategyFieldsToUI();
            UpdateTooltips();
            ShowErrorsForCurrentStrategy();   // <— thêm dòng này

            if (!_uiReady || _suppressTableSync) return;
            _cfg.BetStrategyIndex = CmbBetStrategy?.SelectedIndex ?? 4;
            if (!string.IsNullOrWhiteSpace(_activeTableId))
                UpdateTableSettingFromUi(_activeTableId);
            else
                await SaveConfigAsync();
        }

        private Task<string> EvalJsLockedAsync(string js)
        {
            if (Web == null)
                return Task.FromResult("");

            return Dispatcher.InvokeAsync(async () =>
            {
                await _domActionLock.WaitAsync();
                try
                {
                    return await Web.ExecuteScriptAsync(js);
                }
                finally
                {
                    _domActionLock.Release();
                }
            }).Task.Unwrap();
        }

        private static int ResolveStakeLevelIndex(long[] seq, int currentIndex, long stake)
        {
            if (seq.Length == 0)
                return -1;

            if (currentIndex >= 0 && currentIndex < seq.Length && seq[currentIndex] == stake)
                return currentIndex;

            var next = currentIndex + 1;
            if (next >= seq.Length) next = 0;

            if (currentIndex >= 0 && seq[next] == stake)
                return next;

            for (int i = 0; i < seq.Length; i++)
            {
                int j = (next + i) % seq.Length;
                if (seq[j] == stake)
                    return j;
            }

            return -1;
        }

        private string ResolveStakeCsvForSetting(TableSetting setting)
        {
            var moneyStrategyId = setting.MoneyStrategy ?? "IncreaseWhenLose";
            if (setting.StakeCsvByMoney != null &&
                setting.StakeCsvByMoney.TryGetValue(moneyStrategyId, out var saved) &&
                !string.IsNullOrWhiteSpace(saved))
                return saved;
            if (!string.IsNullOrWhiteSpace(setting.StakeCsv))
                return setting.StakeCsv;
            if (_cfg != null && !string.IsNullOrWhiteSpace(_cfg.StakeCsv))
                return _cfg.StakeCsv;
            return "1000-3000-7000-15000-33000-69000-142000-291000-595000-1215000";
        }

        private static void NormalizeTableStrategy(TableSetting setting, out string betSeq, out string betPatterns)
        {
            betSeq = setting.BetSeq ?? "";
            betPatterns = setting.BetPatterns ?? "";
            var idx = setting.BetStrategyIndex;
            if (idx == 0) betSeq = setting.BetSeqCL ?? "";
            else if (idx == 2) betSeq = setting.BetSeqNI ?? "";
            if (idx == 1) betPatterns = setting.BetPatternsCL ?? "";
            else if (idx == 3) betPatterns = setting.BetPatternsNI ?? "";
        }

        private void UpdateStakeIndexForTable(TableTaskState state, long[] seq, double stake)
        {
            try
            {
                var rounded = (long)Math.Round(stake);
                state.StakeLevelIndexForUi = ResolveStakeLevelIndex(seq, state.StakeLevelIndexForUi, rounded);
            }
            catch
            {
                state.StakeLevelIndexForUi = -1;
            }
        }

        private void RecomputeGlobalWinTotal()
        {
            double total = 0;
            lock (_tableTasksGate)
            {
                foreach (var kv in _tableTasks)
                {
                    var state = kv.Value;
                    if (state?.Cts == null) continue;
                    if (state.Cts.IsCancellationRequested) continue;
                    total += state.WinTotal;
                }
            }
            _winTotal = total;
        }

        private void CheckTableCutAndStopIfNeeded(TableSetting setting, TableTaskState state)
        {
            if (setting == null || state == null) return;

            var cutProfit = setting.CutProfit;
            var cutLoss = setting.CutLoss;

            if (cutProfit <= 0 && cutLoss <= 0) return;

            if (cutProfit > 0 && state.WinTotal >= cutProfit)
            {
                StopTableTask(setting.Id, $"Dat CAT LAI ban {ResolveRoomName(setting.Id)}: {state.WinTotal:N0} >= {cutProfit:N0}");
                return;
            }

            if (cutLoss > 0)
            {
                var lossThreshold = -cutLoss;
                if (state.WinTotal <= lossThreshold)
                {
                    StopTableTask(setting.Id, $"Dat CAT LO ban {ResolveRoomName(setting.Id)}: {state.WinTotal:N0} <= {lossThreshold:N0}");
                }
            }
        }

        private GameContext BuildContextForTable(TableSetting setting, TableTaskState state)
        {
            var moneyStrategyId = setting.MoneyStrategy ?? "IncreaseWhenLose";
            var stakeCsv = ResolveStakeCsvForSetting(setting);
            BuildStakeSeqFromCsv(stakeCsv, out var stakeSeq, out var stakeChains, out var stakeChainTotals);
            NormalizeTableStrategy(setting, out var betSeq, out var betPatterns);
            var tableId = setting.Id ?? "";

            return new GameContext
            {
                TableId = tableId,
                GetSnap = () => { lock (_snapLock) return _lastSnap; },
                EvalJsAsync = EvalJsLockedAsync,
                Log = s => Log(s),

                StakeSeq = stakeSeq,
                StakeChains = stakeChains.Select(a => a.ToArray()).ToArray(),
                StakeChainTotals = stakeChainTotals,

                DecisionPercent = _decisionPercent,
                State = state.Decision,
                UiDispatcher = Dispatcher,
                GetCooldown = () => state.Cooldown,
                SetCooldown = v => state.Cooldown = v,
                MoneyStrategyId = moneyStrategyId,
                BetSeq = betSeq,
                BetPatterns = betPatterns,
                MoneyChainIndex = state.MoneyChainIndex,
                MoneyChainStep = state.MoneyChainStep,
                MoneyChainProfit = state.MoneyChainProfit,

                UiSetSide = s => Dispatcher.Invoke(() =>
                {
                    if (!IsActiveTable(tableId)) return;
                    SetLastSideUI(s);
                }),
                UiSetStake = v => Dispatcher.Invoke(() =>
                {
                    UpdateStakeIndexForTable(state, stakeSeq, v);
                    if (!IsActiveTable(tableId))
                        return;

                    if (LblStake != null)
                        LblStake.Text = v.ToString("N0");

                    if (LblLevel != null)
                    {
                        LblLevel.Text = (state.StakeLevelIndexForUi >= 0 && stakeSeq.Length > 0)
                            ? $"{state.StakeLevelIndexForUi + 1}/{stakeSeq.Length}"
                            : "";
                    }
                }),

                UiAddWin = delta => Dispatcher.InvokeAsync(() =>
                {
                    var net = (delta > 0) ? Math.Round(delta * 0.98) : delta;
                    state.WinTotal += net;
                    try { MoneyHelper.NotifyTempProfit(moneyStrategyId, net); } catch { }
                    RecomputeGlobalWinTotal();
                    if (LblWin != null) LblWin.Text = _winTotal.ToString("N0");
                    CheckTableCutAndStopIfNeeded(setting, state);
                    CheckCutAndStopIfNeeded();
                }),
                UiWinLoss = s => Dispatcher.Invoke(() =>
                {
                    if (!IsActiveTable(tableId)) return;
                    SetWinLossUI(s);
                }),
            };
        }

        private async Task RunTableTaskAsync(TableSetting setting, TableTaskState state, IBetTask task, CancellationToken ct)
        {
            var ctx = BuildContextForTable(setting, state);
            for (int i = 0; i < 25; i++)
            {
                ct.ThrowIfCancellationRequested();
                var check = await ctx.EvalJsAsync("(function(){return (typeof window.__cw_bet==='function')?'ok':'no';})()");
                if (string.Equals(check, "ok", StringComparison.OrdinalIgnoreCase))
                    break;
                await Task.Delay(200, ct);
            }

            await task.RunAsync(ctx, ct);

            state.MoneyChainIndex = ctx.MoneyChainIndex;
            state.MoneyChainStep = ctx.MoneyChainStep;
            state.MoneyChainProfit = ctx.MoneyChainProfit;
        }

        private bool IsActiveTable(string tableId)
        {
            if (string.IsNullOrWhiteSpace(tableId))
                return false;
            return string.Equals(_activeTableId, tableId, StringComparison.OrdinalIgnoreCase);
        }

        private TableTaskState GetOrCreateTableTaskState(string tableId, string? tableName = null)
        {
            lock (_tableTasksGate)
            {
                if (!_tableTasks.TryGetValue(tableId, out var state))
                {
                    state = new TableTaskState
                    {
                        TableId = tableId,
                        TableName = !string.IsNullOrWhiteSpace(tableName) ? tableName : ResolveRoomName(tableId)
                    };
                    _tableTasks[tableId] = state;
                }
                else if (!string.IsNullOrWhiteSpace(tableName))
                {
                    state.TableName = tableName;
                }

                return state;
            }
        }

        private static bool IsTableRunning(TableTaskState state)
        {
            return state.Cts != null && !state.Cts.IsCancellationRequested;
        }

        private bool HasRunningTasks()
        {
            lock (_tableTasksGate)
            {
                foreach (var state in _tableTasks.Values)
                {
                    if (state != null && IsTableRunning(state))
                        return true;
                }
            }

            return false;
        }

        private void UpdateRunAllButtonState()
        {
            if (BtnRunAllTables == null) return;

            var anyRunning = HasRunningTasks();
            if (anyRunning)
            {
                BtnRunAllTables.Content = "D?ng t?t c? b?n";
                var danger = TryFindResource("DangerButton") as Style;
                if (danger != null) BtnRunAllTables.Style = danger;
            }
            else
            {
                BtnRunAllTables.Content = "Ch?y t?t c? b?n";
                var primary = TryFindResource("PrimaryButton") as Style;
                if (primary != null) BtnRunAllTables.Style = primary;
            }

            BtnRunAllTables.IsEnabled = true;
            SetPlayButtonState(anyRunning);
        }

        private async Task SetOverlayPlayStateAsync(string tableId, bool isRunning)
        {
            if (Web?.CoreWebView2 == null || string.IsNullOrWhiteSpace(tableId))
                return;

            var idJson = JsonSerializer.Serialize(tableId);
            var flag = isRunning ? "true" : "false";
            var script = $"window.__abxTableOverlay && window.__abxTableOverlay.setPlayState && window.__abxTableOverlay.setPlayState({idJson}, {flag});";
            try { await EvalJsLockedAsync(script); } catch { }
        }

        private async Task ToggleTablePlayAsync(string tableId, string? tableName = null)
        {
            if (string.IsNullOrWhiteSpace(tableId)) return;
            var state = GetOrCreateTableTaskState(tableId, tableName);
            if (IsTableRunning(state))
            {
                StopTableTask(tableId, "manual");
                return;
            }

            await StartTableTaskAsync(tableId, tableName);
        }

        private async Task<bool> EnsureGameReadyForBetAsync()
        {
            if (Web?.CoreWebView2 == null) return false;

            await _gameReadyGate.WaitAsync();
            try
            {
                var typeBetJson = await EvalJsLockedAsync("typeof window.__cw_bet");
                var typeBet = typeBetJson?.Trim('\"');
                if (!string.Equals(typeBet, "function", StringComparison.OrdinalIgnoreCase))
                {
                    Log("[DEC] missing __cw_bet, open game + inject.");
                    VaoXocDia_Click(this, new RoutedEventArgs());

                    var t0 = DateTime.UtcNow;
                    const int timeoutBetMs = 30000;
                    while ((DateTime.UtcNow - t0).TotalMilliseconds < timeoutBetMs)
                    {
                        await Task.Delay(400);
                        try
                        {
                            typeBetJson = await EvalJsLockedAsync("typeof window.__cw_bet");
                            typeBet = typeBetJson?.Trim('\"');
                            if (string.Equals(typeBet, "function", StringComparison.OrdinalIgnoreCase))
                                break;
                        }
                        catch { }
                    }

                    if (!string.Equals(typeBet, "function", StringComparison.OrdinalIgnoreCase))
                    {
                        Log("[DEC] cannot find __cw_bet in time.");
                        return false;
                    }
                }

                return true;
            }
            finally
            {
                _gameReadyGate.Release();
            }
        }

        private async Task<bool> EnsureLicenseOnceAsync()
        {
            if (!CheckLicense) return true;

            var username = (_homeUsername ?? "").Trim().ToLowerInvariant();
            if (string.IsNullOrWhiteSpace(username))
            {
                MessageBox.Show("Chua xac dinh duoc tai khoan game tu trang Home.", "Automino",
                    MessageBoxButton.OK, MessageBoxImage.Warning);
                return false;
            }

            Task<bool>? task;
            await _licenseGate.WaitAsync();
            try
            {
                if (_licenseCheckTask != null && string.Equals(_licenseCheckUser, username, StringComparison.OrdinalIgnoreCase))
                {
                    task = _licenseCheckTask;
                }
                else
                {
                    _licenseCheckUser = username;
                    _licenseCheckTask = RunLicenseCheckAsync(username);
                    task = _licenseCheckTask;
                }
            }
            finally
            {
                _licenseGate.Release();
            }

            var ok = await task;
            if (!ok)
            {
                await _licenseGate.WaitAsync();
                try
                {
                    if (_licenseCheckTask == task)
                    {
                        _licenseCheckTask = null;
                        _licenseCheckUser = null;
                    }
                }
                finally
                {
                    _licenseGate.Release();
                }
            }

            return ok;
        }

        private async Task<bool> RunLicenseCheckAsync(string username)
        {
            bool isTrial = (ChkTrial?.IsChecked == true);

            if (isTrial)
            {
                try
                {
                    if (DateTimeOffset.TryParse(_cfg.TrialUntil, out var trialUntilUtc) &&
                        trialUntilUtc > DateTimeOffset.UtcNow)
                    {
                        Log("[Trial] resume until " + trialUntilUtc.ToString("u"));
                        try { await ReleaseLeaseAsync(username); } catch { }
                        var okLease = await AcquireLeaseOnceAsync(username);
                        if (!okLease) return false;
                        StartExpiryCountdown(trialUntilUtc, "trial");
                        return true;
                    }

                    var clientId = _leaseClientId;
                    using var http = new HttpClient(new HttpClientHandler
                    {
                        SslProtocols = System.Security.Authentication.SslProtocols.Tls12
                    });

                    var url = $"{LeaseBaseUrl}/trial/{Uri.EscapeDataString(username)}";
                    var json = JsonSerializer.Serialize(new { clientId });
                    var res = await http.PostAsync(
                        url,
                        new StringContent(json, Encoding.UTF8, "application/json"));

                    var payload = await res.Content.ReadAsStringAsync();
                    if (res.IsSuccessStatusCode)
                    {
                        DateTimeOffset trialEndsAt;
                        try
                        {
                            using var doc = JsonDocument.Parse(payload);
                            trialEndsAt = DateTimeOffset.Parse(doc.RootElement.GetProperty("trialEndsAt").GetString());
                        }
                        catch { trialEndsAt = DateTimeOffset.UtcNow.AddMinutes(5); }

                        _cfg.TrialUntil = trialEndsAt.ToString("o");
                        _ = SaveConfigAsync();

                        StartExpiryCountdown(trialEndsAt, "trial");
                        Log("[Trial] started until: " + trialEndsAt.ToString("u"));
                        return true;
                    }

                    string error = null;
                    try
                    {
                        using var doc = JsonDocument.Parse(payload);
                        if (doc.RootElement.TryGetProperty("error", out var errEl))
                            error = errEl.GetString();
                    }
                    catch { }

                    if (string.Equals(error, "in-use", StringComparison.OrdinalIgnoreCase))
                    {
                        MessageBox.Show("Tai khoan dang chay o noi khac. Vui long dung o may kia truoc.",
                            "Automino", MessageBoxButton.OK, MessageBoxImage.Warning);
                    }
                    else if (string.Equals(error, "trial-consumed", StringComparison.OrdinalIgnoreCase))
                    {
                        MessageBox.Show("Het luot dung thu. Hay lien he 0978.248.822.",
                            "Automino", MessageBoxButton.OK, MessageBoxImage.Information);
                    }
                    else
                    {
                        MessageBox.Show("Khong the bat dau che do dung thu. Vui long thu lai.",
                            "Automino", MessageBoxButton.OK, MessageBoxImage.Warning);
                    }
                    return false;
                }
                catch (Exception ex)
                {
                    Log("[Trial ERR] " + ex.Message);
                    MessageBox.Show("Khong the ket noi che do dung thu.", "Automino",
                        MessageBoxButton.OK, MessageBoxImage.Warning);
                    return false;
                }
            }

            var lic = await FetchLicenseAsync(username);
            if (lic == null)
            {
                MessageBox.Show("Không tìm thấy license cho tài khoản này. Hãy liên hệ 0978.248.822.",
                    "Automino", MessageBoxButton.OK, MessageBoxImage.Warning);
                return false;
            }
            if (!DateTimeOffset.TryParse(lic.exp, out var expUtc))
            {
                MessageBox.Show("License không hợp lệ", "Automino",
                    MessageBoxButton.OK, MessageBoxImage.Warning);
                return false;
            }
            if (DateTimeOffset.UtcNow >= expUtc)
            {
                MessageBox.Show("Tool đã hết hạn. Hãy liên hệ 0978.248.822 để gia hạn.",
                    "Automino", MessageBoxButton.OK, MessageBoxImage.Warning);
                return false;
            }

            var okLease2 = await AcquireLeaseOnceAsync(username);
            if (!okLease2) return false;

            StartExpiryCountdown(expUtc, "license");
            StartLicenseRecheckTimer(username);
            Log("[License] valid until: " + expUtc.ToString("u"));
            return true;
        }

        private bool ValidateInputsForTable(TableSetting setting)
        {
            int idx = setting.BetStrategyIndex;
            if (idx == 0)
            {
                var seq = setting.BetSeqCL ?? setting.BetSeq ?? "";
                if (!ValidateSeqCL(seq, out var err))
                {
                    Log($"[TABLE] invalid BetSeqCL for {setting.Id}: {err}");
                    return false;
                }
            }
            else if (idx == 1)
            {
                var pat = setting.BetPatternsCL ?? setting.BetPatterns ?? "";
                if (!ValidatePatternsCL(pat, out var err))
                {
                    Log($"[TABLE] invalid BetPatternsCL for {setting.Id}: {err}");
                    return false;
                }
            }

            return true;
        }

        private IBetTask CreateBetTask(int strategyIndex)
        {
            return strategyIndex switch
            {
                0 => new BaccaratPPRR88.Tasks.SeqParityFollowTask(),
                1 => new BaccaratPPRR88.Tasks.PatternParityTask(),
                2 => new BaccaratPPRR88.Tasks.SmartPrevTask(),
                3 => new BaccaratPPRR88.Tasks.RandomParityTask(),
                4 => new BaccaratPPRR88.Tasks.AiStatParityTask(),
                5 => new BaccaratPPRR88.Tasks.StateTransitionBiasTask(),
                6 => new BaccaratPPRR88.Tasks.RunLengthBiasTask(),
                7 => new BaccaratPPRR88.Tasks.EnsembleMajorityTask(),
                8 => new BaccaratPPRR88.Tasks.TimeSlicedHedgeTask(),
                9 => new BaccaratPPRR88.Tasks.KnnSubsequenceTask(),
                10 => new BaccaratPPRR88.Tasks.DualScheduleHedgeTask(),
                11 => new BaccaratPPRR88.Tasks.AiOnlineNGramTask(GetAiNGramStatePath()),
                12 => new BaccaratPPRR88.Tasks.AiExpertPanelTask(),
                13 => new BaccaratPPRR88.Tasks.Top10PatternFollowTask(),
                _ => new BaccaratPPRR88.Tasks.SmartPrevTask(),
            };
        }

        private async Task StartTableTaskAsync(string tableId, string? tableName = null)
        {
            if (string.IsNullOrWhiteSpace(tableId))
                return;

            var state = GetOrCreateTableTaskState(tableId, tableName);
            if (Interlocked.Exchange(ref state.StartInProgress, 1) == 1)
            {
                Log("[TASK] start already in progress: " + tableId);
                return;
            }

            try
            {
                if (IsTableRunning(state))
                {
                    Log("[TASK] table already running: " + tableId);
                    return;
                }

                bool created;
                var setting = GetOrCreateTableSetting(tableId, tableName, out created);
                if (created)
                    _ = TriggerTableSettingsSaveDebouncedAsync();

                if (!ValidateInputsForTable(setting))
                {
                    Log("[TASK] invalid config, skip start: " + tableId);
                    return;
                }

                await EnsureWebReadyAsync();

                if (!await EnsureGameReadyForBetAsync())
                    return;

                if (CheckLicense)
                {
                    var ok = await EnsureLicenseOnceAsync();
                    if (!ok) return;
                }

                await EvalJsLockedAsync("window.__cw_startPush && window.__cw_startPush(240);");
                Log("[CW] ensure push 240ms");

                var ready = await WaitForBridgeAndGameDataAsync(15000);
                if (!ready)
                {
                    Log("[DEC] data not ready, retry push.");
                    await EvalJsLockedAsync("window.__cw_startPush && window.__cw_startPush(240);");
                    ready = await WaitForBridgeAndGameDataAsync(15000);
                    if (!ready)
                    {
                        Log("[DEC] data still not ready, skip start.");
                        return;
                    }
                }

                state.Decision = new DecisionState();
                state.Cooldown = false;
                state.StakeLevelIndexForUi = -1;
                state.WinTotal = 0;
                state.MoneyChainIndex = 0;
                state.MoneyChainStep = 0;
                state.MoneyChainProfit = 0;

                RecomputeGlobalWinTotal();
                if (LblWin != null) LblWin.Text = _winTotal.ToString("N0");

                if (!HasRunningTasks())
                {
                    _cutStopTriggered = false;
                    _winTotal = 0;
                }

                if (IsActiveTable(tableId))
                    ResetBetMiniPanel();

                var task = CreateBetTask(setting.BetStrategyIndex);
                state.Cts = new CancellationTokenSource();
                state.Task = task;

                _ = SetOverlayPlayStateAsync(tableId, true);
                UpdateRunAllButtonState();

                var running = Task.Run(() => RunTableTaskAsync(setting, state, task, state.Cts.Token));
                running.ContinueWith(t =>
                {
                    Dispatcher.BeginInvoke(new Action(() =>
                    {
                        state.Cts = null;
                        state.Task = null;
                        state.Cooldown = false;

                        if (t.IsFaulted)
                            Log("[Task ERR] " + (t.Exception?.GetBaseException().Message ?? "Unknown error"));
                        else if (t.IsCanceled)
                            Log("[Task] canceled");
                        else
                            Log("[Task] completed");

                        _ = SetOverlayPlayStateAsync(tableId, false);
                        RecomputeGlobalWinTotal();
                        if (LblWin != null) LblWin.Text = _winTotal.ToString("N0");
                        UpdateRunAllButtonState();
                    }));
                }, TaskScheduler.Default);

                Log("[Loop] started task: " + task.DisplayName + " (" + tableId + ")");
            }
            catch (Exception ex)
            {
                Log("[StartTableTask] " + ex.Message);
            }
            finally
            {
                Interlocked.Exchange(ref state.StartInProgress, 0);
            }
        }

        private void StopTableTask(string tableId, string? reason = null)
        {
            if (string.IsNullOrWhiteSpace(tableId))
                return;

            TableTaskState? state;
            lock (_tableTasksGate)
            {
                _tableTasks.TryGetValue(tableId, out state);
            }

            if (state == null)
                return;

            try { state.Cts?.Cancel(); } catch { }

            if (!string.IsNullOrWhiteSpace(reason))
                Log("[TASK] stop " + reason);

            _ = SetOverlayPlayStateAsync(tableId, false);
            AfterStopTasksUpdate();
        }

        private void StopAllTables(string? reason = null)
        {
            List<string> ids;
            lock (_tableTasksGate)
            {
                ids = _tableTasks.Keys.ToList();
            }

            foreach (var id in ids)
            {
                if (string.IsNullOrWhiteSpace(id)) continue;
                try { StopTableTaskInternal(id, reason); } catch { }
            }

            AfterStopTasksUpdate();
        }

        private void StopTableTaskInternal(string tableId, string? reason)
        {
            TableTaskState? state;
            lock (_tableTasksGate)
            {
                _tableTasks.TryGetValue(tableId, out state);
            }

            if (state == null)
                return;

            try { state.Cts?.Cancel(); } catch { }

            if (!string.IsNullOrWhiteSpace(reason))
                Log("[TASK] stop " + reason);

            _ = SetOverlayPlayStateAsync(tableId, false);
        }

        private void AfterStopTasksUpdate()
        {
            RecomputeGlobalWinTotal();
            if (LblWin != null) LblWin.Text = _winTotal.ToString("N0");
            UpdateRunAllButtonState();

            if (!HasRunningTasks())
            {
                TaskUtil.ClearBetCooldown();
                StopExpiryCountdown();
                StopLicenseRecheckTimer();
                StopLeaseHeartbeat();
                var uname = (_homeUsername ?? "").Trim().ToLowerInvariant();
                                // if (!string.IsNullOrWhiteSpace(uname))
                    _ = ReleaseLeaseAsync(uname);
            }
        }

        private async void ResetStrategyAll_Click(object sender, RoutedEventArgs e)
        {
            if (!_uiReady) return;

            try
            {
                var selectedRooms = _roomOptions
                    .Where(it => it.IsSelected)
                    .Select(it => new
                    {
                        id = string.IsNullOrWhiteSpace(it.Id) ? it.Name : it.Id,
                        name = it.Name
                    })
                    .Where(it => !string.IsNullOrWhiteSpace(it.id))
                    .ToList();

                var targets = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                foreach (var room in selectedRooms)
                {
                    if (!targets.ContainsKey(room.id))
                        targets[room.id] = room.name ?? "";
                }

                if (targets.Count == 0)
                {
                    foreach (var t in _tableSettings.Tables)
                    {
                        if (t == null) continue;
                        var id = (t.Id ?? "").Trim();
                        if (string.IsNullOrWhiteSpace(id)) continue;
                        if (!targets.ContainsKey(id))
                            targets[id] = t.Name ?? "";
                    }
                }

                if (targets.Count == 0)
                {
                    Log("[TABLE] Khong co ban nao de dat lai chien luoc.");
                    return;
                }

                foreach (var kv in targets)
                {
                    var created = false;
                    var setting = GetOrCreateTableSetting(kv.Key, kv.Value, out created);
                    ApplyUiConfigToTableSetting(setting, resetCuts: true);
                }

                await SyncTableCutValuesForRoomsAsync(targets.Keys);
                _ = TriggerTableSettingsSaveDebouncedAsync();
                Log($"[TABLE] Da dat lai chien luoc cho {targets.Count} ban.");
            }
            catch (Exception ex)
            {
                Log("[ResetStrategyAll] " + ex.Message);
            }
        }

        private async void BtnRunAllTables_Click(object sender, RoutedEventArgs e)
        {
            if (!_uiReady) return;
            if (Interlocked.Exchange(ref _runAllInProgress, 1) == 1) return;
            try
            {
                if (HasRunningTasks())
                {
                    StopAllTables("manual");
                    return;
                }

                var targets = _overlayActiveRooms.ToList();
                if (targets.Count == 0)
                {
                    Log("[TABLE] Khong co ban dang mo de chay.");
                    return;
                }

                foreach (var id in targets)
                {
                    await StartTableTaskAsync(id, ResolveRoomName(id));
                }
            }
            finally
            {
                Interlocked.Exchange(ref _runAllInProgress, 0);
                UpdateRunAllButtonState();
            }
        }

        private async void PlayXocDia_Click(object sender, RoutedEventArgs e)
        {
            var tableId = _activeTableId ?? "";
            if (string.IsNullOrWhiteSpace(tableId))
            {
                Log("[TASK] no active table for Play");
                return;
            }

            var state = GetOrCreateTableTaskState(tableId, ResolveRoomName(tableId));
            if (IsTableRunning(state))
            {
                Log("[TASK] table already running, ignore Play");
                return;
            }

            await StartTableTaskAsync(tableId, ResolveRoomName(tableId));
        }


        private int _stopInProgress = 0;
        private void StopXocDia_Click(object sender, RoutedEventArgs e)
        {
            if (Interlocked.Exchange(ref _stopInProgress, 1) == 1) return;
            try
            {
                if (!string.IsNullOrWhiteSpace(_activeTableId))
                {
                    var state = GetOrCreateTableTaskState(_activeTableId, ResolveRoomName(_activeTableId));
                    if (IsTableRunning(state))
                    {
                        StopTableTask(_activeTableId, "manual");
                        return;
                    }
                }

                if (HasRunningTasks())
                    StopAllTables("manual");
            }
            finally { Interlocked.Exchange(ref _stopInProgress, 0); }
        }




        private void SetPlayButtonState(bool isRunning)
        {
            if (BtnPlay == null) return;

            if (string.Equals(BtnPlay.Tag as string, "reset-strategy", StringComparison.OrdinalIgnoreCase))
            {
                BtnPlay.Click -= PlayXocDia_Click;
                BtnPlay.Click -= StopXocDia_Click;
                BtnPlay.Click -= ResetStrategyAll_Click;
                BtnPlay.Click += ResetStrategyAll_Click;
                BtnPlay.Content = "Đặt lại chiến lược";
                var primary = TryFindResource("PrimaryButton") as Style;
                if (primary != null) BtnPlay.Style = primary;
                BtnPlay.IsEnabled = true;
                SetConfigEditable(!isRunning);
                UpdateTooltips();
                return;
            }

            BtnPlay.Click -= PlayXocDia_Click;
            BtnPlay.Click -= StopXocDia_Click;

            if (isRunning)
            {
                BtnPlay.Content = "Dừng Đặt Cược";
                BtnPlay.Click += StopXocDia_Click;
                var danger = TryFindResource("DangerButton") as Style;
                if (danger != null) BtnPlay.Style = danger;
            }
            else
            {
                BtnPlay.Content = "Bắt Đầu Cược";
                BtnPlay.Click += PlayXocDia_Click;
                var primary = TryFindResource("PrimaryButton") as Style;
                if (primary != null) BtnPlay.Style = primary;
            }

            BtnPlay.IsEnabled = true;
            SetConfigEditable(!isRunning);

            // NEW: refresh tooltip ngay theo trạng thái mới
            UpdateTooltips();
        }





        private async void ApplyMouseShieldFromCheck()
        {
            bool locked = (ChkLockMouse?.IsChecked == true);

            try
            {
                // Chỉ chạy khi WebView2 đã sẵn sàng
                if (Web?.CoreWebView2 == null)
                {
                    if (MouseShield != null)
                        MouseShield.Visibility = locked ? Visibility.Visible : Visibility.Collapsed;
                    return;
                }

                await EnsureMouseLockScriptAsync(); // đảm bảo có __abx_lockMouse trong trang

                // Khoá/mở chuột bằng overlay bên trong DOM (an toàn trên VPS/RDP)
                await Web.ExecuteScriptAsync(
                    $"window.__abx_lockMouse && window.__abx_lockMouse({(locked ? "true" : "false")});");
            }
            catch (Exception ex)
            {
                Log("[LockMouse] " + ex.Message);
            }

            // (tuỳ chọn) overlay WPF để hiển thị tooltip/cursor trên app
            if (MouseShield != null)
                MouseShield.Visibility = locked ? Visibility.Visible : Visibility.Collapsed;

            // ❗ Quan trọng: KHÔNG đụng Web.IsEnabled để tránh crash WebView2 trên VPS/RDP
            if (Web != null)
                Web.IsHitTestVisible = !locked;
        }



        private async void ChkLockMouse_Checked(object sender, RoutedEventArgs e)
        {
            if (!_uiReady) return;               // ⬅️ chặn event khởi động sớm
            ApplyMouseShieldFromCheck();
            _ = SaveConfigAsync();
            Log("[UI] Khoá chuột web: ON");
        }

        private async void ChkLockMouse_Unchecked(object sender, RoutedEventArgs e)
        {
            if (!_uiReady) return;               // ⬅️ chặn event khởi động sớm
            ApplyMouseShieldFromCheck();
            _ = SaveConfigAsync();
            Log("[UI] Khoá chuột web: OFF");
        }


        private async Task EnsureMouseLockScriptAsync()
        {
            if (Web?.CoreWebView2 == null) return;

            const string LOCK_JS = @"
(function(){
  try{
    const KEY = '__abx_mouse_lock_div__';
    function ensureCss(){
      try{
        const id='__abx_lock_css';
        if(document.getElementById(id)) return;
        const st=document.createElement('style'); st.id=id;
        st.textContent = `
          #${KEY} {
            position: fixed; inset: 0; z-index: 2147483647;
            background: rgba(0,0,0,0);
            pointer-events: auto; /* nhận mọi click để chặn xuống dưới */
          }`;
        (document.head || document.documentElement).appendChild(st);
      }catch(_){}
    }
    function add(){
      try{
        ensureCss();
        if(document.getElementById(KEY)) return true;
        const d = document.createElement('div');
        d.id = KEY; d.setAttribute('role','presentation');
        d.title = 'Đang khoá chuột';
        const stop = e => { e.stopPropagation(); e.preventDefault(); };
        ['click','mousedown','mouseup','pointerdown','pointerup','wheel','touchstart','touchend','contextmenu']
          .forEach(t => d.addEventListener(t, stop, {capture:true}));
        (document.body || document.documentElement).appendChild(d);
        return true;
      }catch(e){ return 'err:'+e; }
    }
    function remove(){
      try{ const d=document.getElementById(KEY); if(d) d.remove(); return true; }
      catch(e){ return 'err:'+e; }
    }
    window.__abx_lockMouse = function(on){
      try{ return on ? add() : remove(); } catch(e){ return 'err:'+e; }
    };
  }catch(_){} 
})();";

            // Đăng ký cho mọi document trong tương lai (1 lần)
            if (!_lockJsRegistered)
            {
                await Web.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(LOCK_JS);
                _lockJsRegistered = true;
            }
            // Tiêm ngay cho document hiện tại
            await Web.ExecuteScriptAsync(LOCK_JS);
        }

        private static string Tail(string s, int take)
        {
            if (string.IsNullOrEmpty(s)) return "";
            if (take <= 0) return "";
            return (s.Length <= take) ? s : s.Substring(s.Length - take, take);
        }

        // đặt trong MainWindow.xaml.cs (project BaccaratPPRR88)

        // load thử lần lượt các uri, cái nào được thì dùng, không được thì trả về null
        private static ImageSource? LoadImgSafe(params string[] uris)
        {
            foreach (var uri in uris)
            {
                try
                {
                    var bi = new BitmapImage();
                    bi.BeginInit();
                    bi.UriSource = new Uri(uri, UriKind.RelativeOrAbsolute);
                    bi.CacheOption = BitmapCacheOption.OnLoad;
                    bi.EndInit();
                    bi.Freeze();
                    return bi;
                }
                catch
                {
                    // thử uri tiếp theo
                }
            }
            return null;
        }


        private void InitSeqIcons()
        {
            // đã có rồi thì thôi
            if (_seqIconMap.Count > 0)
                return;

            // tên assembly thực tế của DLL hiện tại
            string asm = GetType().Assembly.GetName().Name!;

            // mỗi cái cho 2-3 đường dẫn để chạy được cả khi làm plugin và khi chạy độc lập
            _seqIconMap['0'] = LoadImgSafe(
                $"pack://application:,,,/{asm};component/Assets/Seq/ball0.png",
                "pack://application:,,,/Assets/Seq/ball0.png",
                "pack://application:,/Assets/Seq/ball0.png"
            );
            _seqIconMap['1'] = LoadImgSafe(
                $"pack://application:,,,/{asm};component/Assets/Seq/ball1.png",
                "pack://application:,,,/Assets/Seq/ball1.png",
                "pack://application:,/Assets/Seq/ball1.png"
            );
            _seqIconMap['2'] = LoadImgSafe(
                $"pack://application:,,,/{asm};component/Assets/Seq/ball2.png",
                "pack://application:,,,/Assets/Seq/ball2.png",
                "pack://application:,/Assets/Seq/ball2.png"
            );
            _seqIconMap['3'] = LoadImgSafe(
                $"pack://application:,,,/{asm};component/Assets/Seq/ball3.png",
                "pack://application:,,,/Assets/Seq/ball3.png",
                "pack://application:,/Assets/Seq/ball3.png"
            );
            _seqIconMap['4'] = LoadImgSafe(
                $"pack://application:,,,/{asm};component/Assets/Seq/ball4.png",
                "pack://application:,,,/Assets/Seq/ball4.png",
                "pack://application:,/Assets/Seq/ball4.png"
            );
        }



        void UpdateSeqUI(string fullSeq)
        {
            var tail = (fullSeq.Length <= 15) ? fullSeq : fullSeq.Substring(fullSeq.Length - 15, 15);
            if (tail == _lastSeqTailShown) return; // QUAN TRỌNG: đừng reset animation

            var items = new List<SeqIconVM>(tail.Length);
            for (int i = 0; i < tail.Length; i++)
            {
                var ch = tail[i];
                if (_seqIconMap.TryGetValue(ch, out var img))
                    items.Add(new SeqIconVM { Img = img, IsLatest = (i == tail.Length - 1) });
            }
            SeqIcons.ItemsSource = items;
            SeqIcons.ToolTip = fullSeq;
            _lastSeqTailShown = tail;
        }



        private void SetLastResultUI(string? result)
        {
            // Chuẩn hoá & chấp nhận cả tail số '0'..'4'
            string sRaw = result ?? string.Empty;
            string s = sRaw.Trim().ToUpperInvariant();

            bool isChan = false, isLe = false;

            if (s.Length == 1 && char.IsDigit(s[0]))
            {
                // tail số từ chuỗi kết quả: 0/2/4 => CHẴN, 1/3 => LẺ
                char d = s[0];
                isChan = (d == '0' || d == '2' || d == '4');
                isLe = (d == '1' || d == '3');
            }
            else
            {
                isChan = (s == "CHAN" || s == "CHẴN" || s == "C");
                isLe = (s == "LE" || s == "LẺ" || s == "L");
            }

            // Helper: fallback hiển thị chữ
            void ShowText(string text)
            {
                if (ImgKetQua != null) ImgKetQua.Visibility = Visibility.Collapsed;
                if (LblKetQua != null)
                {
                    LblKetQua.Visibility = Visibility.Visible;
                    LblKetQua.Text = string.IsNullOrWhiteSpace(text) ? "-" : text;
                }
            }

            if (!isChan && !isLe)
            {
                ShowText("");
                return;
            }

            // Ưu tiên lấy ảnh trong Resource (ImgCHAN/ImgLE) -> nếu không có thì dùng SharedIcons
            string resKey = isLe ? "ImgLE" : "ImgCHAN";
            var resImg = TryFindResource(resKey) as ImageSource;

            ImageSource? icon =
                resImg
                ?? (isChan ? (SharedIcons.ResultChan ?? SharedIcons.SideChan)
                           : (SharedIcons.ResultLe ?? SharedIcons.SideLe));

            if (icon != null && ImgKetQua != null)
            {
                // Hiển thị ảnh + ẩn chữ
                ImgKetQua.Source = icon;
                ImgKetQua.Visibility = Visibility.Visible;
                if (LblKetQua != null) LblKetQua.Visibility = Visibility.Collapsed;

                // Cache lại để DataGrid (converters) có thể "kế thừa" từ trạng thái
                if (isChan) SharedIcons.ResultChan = icon;
                else SharedIcons.ResultLe = icon;
            }
            else
            {
                // Không có ảnh -> fallback chữ có dấu
                ShowText(isChan ? "CHẴN" : "LẺ");
            }
        }


        private void SetLastSideUI(string? result)
        {
            // Chuẩn hoá
            var s = (result ?? "").Trim().ToUpperInvariant();
            bool isLe = s == "LE" || s == "LẺ" || s == "L";
            bool isChan = s == "CHAN" || s == "CHẴN" || s == "C";

            void ShowText(string text)
            {
                if (ImgSide != null) ImgSide.Visibility = Visibility.Collapsed;
                if (LblSide != null)
                {
                    LblSide.Visibility = Visibility.Visible;
                    LblSide.Text = string.IsNullOrWhiteSpace(text) ? "" : text;
                }
            }

            if (isLe || isChan)
            {
                var key = isLe ? "ImgLE" : "ImgCHAN";
                var img = TryFindResource(key) as ImageSource;
                if (img != null && ImgSide != null)
                {
                    ImgSide.Source = img;
                    ImgSide.Visibility = Visibility.Visible;
                    if (LblSide != null) LblSide.Visibility = Visibility.Collapsed;
                    return;
                }
            }

            ShowText(s);
        }

        // === RESET MINI PANEL: THẮNG/THUA, CỬA ĐẶT, TIỀN CƯỢC, MỨC TIỀN ===
        private void ResetBetMiniPanel()
        {
            try
            {
                // THẮNG/THUA: bool? -> null để xoá
                SetWinLossUI(null);

                // CỬA ĐẶT: string? -> null/"" đều xoá
                SetLastSideUI(null);

                // KẾT QUẢ (nếu có hiển thị)
                SetLastResultUI(null);

                // TIỀN CƯỢC & MỨC TIỀN
                if (LblStake != null) LblStake.Text = "";  // TIỀN CƯỢC
                if (LblLevel != null) LblLevel.Text = "";  // MỨC TIỀN

                // Lưu ý: KHÔNG reset tổng lãi ở đây để ông chủ còn nhìn sau khi dừng.
            }
            catch (Exception ex)
            {
                Log("[UI] ResetBetMiniPanel error: " + ex.Message);
            }
        }


        // Cho code nền (TaskUtil) gọi đúng hàm reset gốc
        public void ResetBetMiniPanel_External()
        {
            // GIỮ NGUYÊN NGHIỆP VỤ: gọi đúng hàm gốc
            ResetBetMiniPanel();
        }



        private void SetWinLossUI(bool? result)
        {
            void ShowText(string text)
            {
                if (ImgThangThua != null) ImgThangThua.Visibility = Visibility.Collapsed;
                if (LblWinLoss != null)
                {
                    LblWinLoss.Visibility = Visibility.Visible;
                    LblWinLoss.Text = string.IsNullOrWhiteSpace(text) ? "" : text;
                }
            }

            if (result.HasValue)
            {
                var key = result.Value ? "ImgTHANG" : "ImgTHUA";
                var img = TryFindResource(key) as ImageSource;
                if (img != null && ImgThangThua != null)
                {
                    ImgThangThua.Source = img;
                    ImgThangThua.Visibility = Visibility.Visible;
                    if (LblWinLoss != null) LblWinLoss.Visibility = Visibility.Collapsed;
                    return;
                }

                // Thiếu resource → fallback chữ
                ShowText(result.Value ? "THẮNG" : "THUA");
                return;
            }

            // Chưa có kết quả
            ShowText("");
        }




        /// <summary>
        /// Bật timer re-check license: cứ sau 5 phút sẽ kiểm tra hạn license từ GitHub.
        /// </summary>
        private void StartLicenseRecheckTimer(string username)
        {
            StopLicenseRecheckTimer(); // đảm bảo không nhân bản timer

            // Chạy sau 5 phút, lặp lại mỗi 5 phút (không chạy ngay vì lúc start đã check rồi)
            _licenseCheckTimer = new System.Threading.Timer(async _ =>
            {
                try
                {
                    await CheckLicenseNowAsync(username);
                }
                catch { /* giữ timer sống, không throw ra ngoài */ }
            }, null, TimeSpan.FromMinutes(5), TimeSpan.FromMinutes(5));

            Log("[LicenseCheck] timer started (every 5 minutes)");
        }

        /// <summary>
        /// Tắt timer re-check license (gọi khi dừng cược/thoát app).
        /// </summary>
        private void StopLicenseRecheckTimer()
        {
            try { _licenseCheckTimer?.Change(Timeout.Infinite, Timeout.Infinite); } catch { }
            try { _licenseCheckTimer?.Dispose(); } catch { }
            _licenseCheckTimer = null;
            Log("[LicenseCheck] timer stopped");
        }

        /// <summary>
        /// Kiểm tra license tức thời: fetch GitHub, cập nhật countdown; hết hạn thì dừng cược.
        /// </summary>
        private async Task CheckLicenseNowAsync(string username)
        {
            if (!HasRunningTasks()) return;
            if (Interlocked.Exchange(ref _licenseCheckBusy, 1) == 1) return; // đang chạy -> bỏ qua
            try
            {
                var lic = await FetchLicenseAsync(username);
                if (lic == null || !DateTimeOffset.TryParse(lic.exp, out var expUtc))
                {
                    Log("[LicenseCheck] invalid license payload");
                    await Dispatcher.InvokeAsync(() =>
                    {
                        MessageBox.Show("Không xác thực được license. Dừng đặt cược.", "Automino",
                            MessageBoxButton.OK, MessageBoxImage.Warning);
                        StopAllTables("license-expired");
                    });
                    return;
                }

                if (DateTimeOffset.UtcNow >= expUtc)
                {
                    Log("[LicenseCheck] license expired");
                    await Dispatcher.InvokeAsync(() =>
                    {
                        MessageBox.Show("License đã hết hạn. Dừng đặt cược.", "Automino",
                            MessageBoxButton.OK, MessageBoxImage.Warning);
                        StopAllTables("license-expired");
                    });
                    return;
                }

                // OK: cập nhật lại countdown nếu có gia hạn trên GitHub
                await Dispatcher.InvokeAsync(() =>
                {
                    StartExpiryCountdown(expUtc, "license");
                });
                Log("[LicenseCheck] ok until " + expUtc.ToString("u"));
            }
            catch (Exception ex)
            {
                Log("[LicenseCheck] error " + ex.Message);
                // Lỗi mạng tạm thời: KHÔNG dừng cược, lần sau timer sẽ thử lại.
            }
            finally
            {
                Interlocked.Exchange(ref _licenseCheckBusy, 0);
            }
        }


        // Tìm đúng tên resource (tránh đoán sai namespace)
        private static string? FindResourceName(string fileName)
        {
            var asm = Assembly.GetExecutingAssembly();
            foreach (var n in asm.GetManifestResourceNames())
                if (n.EndsWith(fileName, StringComparison.OrdinalIgnoreCase))
                    return n;
            return null;
        }

        private static string ReadEmbeddedText(string resName)
        {
            var asm = Assembly.GetExecutingAssembly();
            using var s = asm.GetManifestResourceStream(resName)
                ?? throw new FileNotFoundException($"Resource not found: {resName}");
            using var r = new StreamReader(s, Encoding.UTF8, true);
            return r.ReadToEnd();
        }



        private static string RemoveUtf8Bom(string s)
        {
            // Nếu chuỗi bắt đầu bằng BOM (U+FEFF) thì bỏ đi
            return (!string.IsNullOrEmpty(s) && s[0] == '\uFEFF') ? s.Substring(1) : s;
        }

        private async Task<string> LoadHomeJsAsync()
        {
            // Ưu tiên đọc file ngoài (cùng thư mục exe) để thay nóng không cần rebuild
            try
            {
                var diskPath = Path.Combine(AppContext.BaseDirectory, "js_home_v2.js");
                if (File.Exists(diskPath))
                {
                    var text = RemoveUtf8Bom(await File.ReadAllTextAsync(diskPath, Encoding.UTF8));
                    Log($"[Bridge] Loaded HOME JS from disk: {diskPath} (len={text.Length})");
                    if (!string.IsNullOrWhiteSpace(text))
                        return text;
                    Log("[Bridge] HOME JS on disk is empty: " + diskPath);
                }
            }
            catch (Exception ex)
            {
                Log("[Bridge] Read HOME JS on disk failed: " + ex.Message);
            }

            try
            {
                var resName = FindResourceName("js_home_v2.js")
                              ?? "BaccaratPPRR88.js_home_v2.js"; // fallback tên logic
                var text = ReadEmbeddedText(resName);   // helper sẵn có
                text = RemoveUtf8Bom(text);             // helper sẵn có

                if (!string.IsNullOrWhiteSpace(text))
                {
                    Log($"[Bridge] Loaded HOME JS from embedded: {resName} (len={text.Length})");
                    return text;
                }
                Log("[Bridge] Embedded HOME JS empty: " + resName);
            }
            catch (Exception ex)
            {
                Log("[Bridge] Read embedded HOME JS failed: " + ex.Message);
            }
            return "";
        }




        private async Task EnsureBridgeRegisteredAsync()
        {
            await EnsureWebReadyAsync();
            if (Web?.CoreWebView2 == null) return;

            _homeJs ??= await LoadHomeJsAsync();

            if (_topForwardId == null)
                _topForwardId = await Web.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(TOP_FORWARD);

            if (_appJsRegId == null && !string.IsNullOrEmpty(_appJs))
                _appJsRegId = await Web.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(_appJs);

            // NEW: đăng ký Home JS
            if (_homeJsRegId == null && !string.IsNullOrEmpty(_homeJs))
                _homeJsRegId = await Web.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(_homeJs);

            if (_autoStartId == null)
                _autoStartId = await Web.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(FRAME_AUTOSTART);
            if (_homeAutoStartId == null)
            {
                // Đăng ký autostart Home với interval mặc định (_homePushMs)
                var homeAuto = BuildHomeAutostartJs(_homePushMs);
                _homeAutoStartId = await Web.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(homeAuto);
            }


            if (!_frameHooked)
            {
                Web.CoreWebView2.FrameCreated += CoreWebView2_FrameCreated_Bridge;
                _frameHooked = true;
            }

            if (!_domHooked)
            {
                Web.CoreWebView2.DOMContentLoaded += async (_, __) =>
                {
                    try { await InjectOnNewDocAsync(); } catch { }
                };
                _domHooked = true;
            }
        }


        private void ResetHomeFlowFlags()
        {
            _homeAutoLoginDone = false;
            _homeAutoPlayDone = false;
        }



        private async Task InjectOnNewDocAsync()
        {
            if (Web?.CoreWebView2 == null) return;

            string key = "";
            try
            {
                var json = await Web.CoreWebView2.ExecuteScriptAsync(
                    "(function(){try{return String(performance.timeOrigin)}catch(_){return String(Date.now())}})()");
                key = JsonSerializer.Deserialize<string>(json) ?? "";
            }
            catch { }

            if (!string.IsNullOrEmpty(key) && key != _lastDocKey)
            {
                ResetHomeFlowFlags();
                // Tiêm lại ngay trên tài liệu hiện tại (phòng khi AddScript chưa kịp chạy vì timing)
                await Web.CoreWebView2.ExecuteScriptAsync(TOP_FORWARD);
                if (!string.IsNullOrEmpty(_appJs))
                    await Web.CoreWebView2.ExecuteScriptAsync(_appJs);

                // NEW: tiêm Home JS luôn (an toàn trên Game vì nó tự no-op)
                if (!string.IsNullOrEmpty(_homeJs))
                    await Web.CoreWebView2.ExecuteScriptAsync(_homeJs);

                // Kích autostart trên top (idempotent – nếu không có __cw_startPush thì không sao)
                await Web.CoreWebView2.ExecuteScriptAsync(FRAME_AUTOSTART);
                // Nếu KHÔNG phải host games.* thì khởi động push của js_home_v2
                await Web.CoreWebView2.ExecuteScriptAsync(BuildHomeAutostartJs(_homePushMs));


                _lastDocKey = key;
                Log("[Bridge] Injected on current doc, key=" + key);
            }


        }


        private void CoreWebView2_FrameCreated_Bridge(object? sender, CoreWebView2FrameCreatedEventArgs e)
        {
            try
            {
                var f = e.Frame;

                // Tiêm ngay (idempotent)
                _ = f.ExecuteScriptAsync(FRAME_SHIM);
                if (!string.IsNullOrEmpty(_appJs))
                    _ = f.ExecuteScriptAsync(_appJs);
                // NEW: inject Home JS vào frame
                if (!string.IsNullOrEmpty(_homeJs))
                    _ = f.ExecuteScriptAsync(_homeJs);
                _ = f.ExecuteScriptAsync(FRAME_AUTOSTART);
                Log("[Bridge] Frame injected + autostart armed.");

                // Hook lifecycle của CHÍNH frame này
                string lastFrameNavUri = "";
                f.NavigationStarting += (s2, e2) =>
                {
                    try
                    {
                        lastFrameNavUri = e2.Uri ?? "";
                        Log($"[Frame NavStart] id={f.Name} uri={lastFrameNavUri}");

                        // Neu iframe vao lobby PP thi dieu huong top window sang cung URL de cung origin
                        // chi force 1 lan: neu da force hoac top da o host pragmaticplaylive thi bo qua
                        if (!string.IsNullOrEmpty(_lastForcedLobbyUrl))
                        {
                            // da force roi, khong lam tiep
                        }
                        else if (Web?.CoreWebView2 != null &&
                                 Uri.TryCreate(Web.CoreWebView2.Source, UriKind.Absolute, out var topUri) &&
                                 topUri.Host.Contains("pragmaticplaylive.net"))
                        {
                            // top da o pragmaticplaylive, bo qua
                        }
                        else if (!string.IsNullOrEmpty(lastFrameNavUri) &&
                            Uri.TryCreate(lastFrameNavUri, UriKind.Absolute, out var u))
                        {
                            var host = u.Host.ToLowerInvariant();
                            var path = u.AbsolutePath.ToLowerInvariant();
                            if (host.Contains("client.pragmaticplaylive.net") && path.Contains("/desktop/lobby"))
                            {
                                if (!string.Equals(_lastForcedLobbyUrl, u.ToString(), StringComparison.Ordinal))
                                {
                                    _lastForcedLobbyUrl = u.ToString();
                                    try
                                    {
                                        Web?.CoreWebView2?.Navigate(_lastForcedLobbyUrl);
                                        Log("[Frame NavStart] force top navigate to lobby: " + _lastForcedLobbyUrl);
                                    }
                                    catch (Exception ex)
                                    {
                                        Log("[Frame NavStart] force lobby err: " + ex.Message);
                                    }
                                }
                            }
                        }
                }
            catch { }
                };
                f.DOMContentLoaded += Frame_DOMContentLoaded_Bridge;
                f.NavigationCompleted += Frame_NavigationCompleted_Bridge;
                f.NavigationCompleted += (s2, e2) =>
                {
                    try
                    {
                        Log($"[Frame NavDone] id={f.Name} uri={lastFrameNavUri}");
                    }
                    catch { }
                };
            }
            catch (Exception ex)
            {
                Log("[Bridge.FrameCreated] " + ex.Message);
            }
        }


        private CoreWebView2Frame? TryGetFrameByIdSafe(ulong frameId)
        {
            try
            {
                var t = Web!.CoreWebView2.GetType();

                // API mới: GetFrameById
                var mi = t.GetMethod("GetFrameById");
                if (mi != null)
                    return (CoreWebView2Frame?)mi.Invoke(Web.CoreWebView2, new object[] { frameId });

                // Một số runtime có TryGetFrame(ulong, out CoreWebView2Frame)
                mi = t.GetMethod("TryGetFrame");
                if (mi != null)
                {
                    var args = new object?[] { frameId, null };
                    var ok = (bool)(mi.Invoke(Web.CoreWebView2, args) ?? false);
                    if (ok) return (CoreWebView2Frame?)args[1];
                }
                }
            catch { }
            return null;
        }

        private void Frame_DOMContentLoaded_Bridge(object? sender, CoreWebView2DOMContentLoadedEventArgs e)
        {
            try
            {
                var f = sender as CoreWebView2Frame;
                if (f == null) return;

                _ = f.ExecuteScriptAsync(FRAME_SHIM);
                if (!string.IsNullOrEmpty(_appJs))
                    _ = f.ExecuteScriptAsync(_appJs);
                _ = f.ExecuteScriptAsync(FRAME_AUTOSTART);

                Log("[Bridge] Frame DOMContentLoaded -> reinjected + autostart.");
            }
            catch (Exception ex)
            {
                Log("[Bridge.Frame DOMContentLoaded] " + ex.Message);
            }
        }

        private void Frame_NavigationCompleted_Bridge(object? sender, CoreWebView2NavigationCompletedEventArgs e)
        {
            try
            {
                if (!e.IsSuccess) return;
                var f = sender as CoreWebView2Frame;
                if (f == null) return;

                _ = f.ExecuteScriptAsync(FRAME_SHIM);
                if (!string.IsNullOrEmpty(_appJs))
                    _ = f.ExecuteScriptAsync(_appJs);
                _ = f.ExecuteScriptAsync(FRAME_AUTOSTART);

                Log("[Bridge] Frame NavigationCompleted -> reinjected + autostart.");
            }
            catch (Exception ex)
            {
                Log("[Bridge.Frame NavigationCompleted] " + ex.Message);
            }
        }


        private async Task<bool> WaitForBridgeAndGameDataAsync(int timeoutMs = 20000)
        {
            var t0 = DateTime.UtcNow;
            while ((DateTime.UtcNow - t0).TotalMilliseconds < timeoutMs)
            {
                try
                {
                    // 1) __cw_bet có chưa
                    var typeBet = (await Web.ExecuteScriptAsync("typeof window.__cw_bet"))?.Trim('"');
                    bool hasBet = string.Equals(typeBet, "function", StringComparison.OrdinalIgnoreCase);

                    // 3) Đã có tick chưa (ít nhất 1 ký tự seq)
                    bool hasTick = false;
                    lock (_snapLock)
                    {
                        hasTick = _lastSnap?.seq != null && _lastSnap.seq.Length > 0;
                    }

                    if (hasBet && hasTick)
                        return true;
                }
                catch { /* tiếp tục đợi */ }

                await Task.Delay(300);
            }
            return false;
        }


        // JSON license đơn giản trên GitHub
        private record LicenseDoc(string tool, string user, string exp, int maxConcurrent, string? note);

        private async Task<LicenseDoc?> FetchLicenseAsync(string username)
        {
            try
            {
                // ÉP TLS 1.2 + tăng timeout cho các VPS/máy cũ
                using var http = new HttpClient(
                    new HttpClientHandler
                    {
                        SslProtocols = System.Security.Authentication.SslProtocols.Tls12
                    })
                {
                    Timeout = TimeSpan.FromSeconds(20)
                };

                // Một số nơi GitHub yêu cầu User-Agent rõ ràng
                http.DefaultRequestHeaders.TryAddWithoutValidation(
                    "User-Agent",
                    "Automino-LicenseChecker/1.0");

                var uname = Uri.EscapeDataString(username);
                var url =
                    $"https://raw.githubusercontent.com/{LicenseOwner}/{LicenseRepo}/{LicenseBranch}/{LicenseNameGame}/{uname}.json";

                var json = await http.GetStringAsync(url);

                return JsonSerializer.Deserialize<LicenseDoc>(
                    json,
                    new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            }
            catch (TaskCanceledException ex)
            {
                // Bắt riêng timeout để nhìn log cho rõ
                Log("[License] fetch timeout: " + ex.Message);
                return null; // phía trên vẫn xử lý lic == null như cũ
            }
            catch (Exception ex)
            {
                Log("[License] fetch error: " + ex.Message);
                return null;
            }
        }



        // Acquire lease 1 lần (KHÔNG renew theo yêu cầu)
        private async Task<bool> AcquireLeaseOnceAsync(string username)
        {
            if (string.IsNullOrWhiteSpace(LeaseBaseUrl)) return true; // chưa cấu hình -> bỏ qua
            try
            {
                using var http = new HttpClient() { Timeout = TimeSpan.FromSeconds(6) };
                var uname = Uri.EscapeDataString(username);
                var resp = await http.PostAsJsonAsync($"{LeaseBaseUrl}/acquire/{uname}", new { clientId = _leaseClientId });
                var body = await resp.Content.ReadAsStringAsync();
                Log($"[Lease] acquire -> {(int)resp.StatusCode} {resp.ReasonPhrase} | {body}");
                if (!resp.IsSuccessStatusCode)
                {
                    MessageBox.Show($"Lease bị từ chối [{(int)resp.StatusCode}] — {body}", "Automino",
                        MessageBoxButton.OK, MessageBoxImage.Warning);
                    return false;
                }
                if (resp.IsSuccessStatusCode) return true;
                if ((int)resp.StatusCode == 409)
                {
                    // tài khoản đang chạy nơi khác
                    body = await resp.Content.ReadAsStringAsync();
                    Log("[Lease] 409 in-use: " + body);
                    MessageBox.Show("Tài khoản đang chạy nơi khác. Vui lòng thử lại sau.", "Automino", MessageBoxButton.OK, MessageBoxImage.Warning);
                    return false;
                }
                MessageBox.Show("Không lấy được quyền chạy (lease).", "Automino", MessageBoxButton.OK, MessageBoxImage.Warning);
            }
            catch (Exception ex)
            {
                Log("[Lease] acquire error: " + ex.Message);
                MessageBox.Show("Không kết nối được trung tâm lease. Vui lòng kiểm tra mạng.", "Automino", MessageBoxButton.OK, MessageBoxImage.Warning);
            }
            return false;
        }

        private async Task ReleaseLeaseAsync(string username)
        {
            if (string.IsNullOrWhiteSpace(LeaseBaseUrl)) return;
            try
            {
                using var http = new HttpClient() { Timeout = TimeSpan.FromSeconds(4) };
                var uname = Uri.EscapeDataString(username);
                var resp = await http.PostAsJsonAsync($"{LeaseBaseUrl}/release/{uname}", new { clientId = _leaseClientId });
                // không cần xử lý gì thêm; cứ fire-and-forget
                Log("[Lease] release sent: " + (int)resp.StatusCode);
            }
            catch (Exception ex)
            {
                Log("[Lease] release error: " + ex.Message);
            }
        }


        // Khởi động đếm ngược hiển thị dưới nút và auto stop khi hết giờ
        // Khởi động đếm ngược hiển thị dưới nút và auto stop khi hết giờ
        // Khởi động đếm ngược hiển thị dưới nút và auto stop khi hết giờ
        private void StartExpiryCountdown(DateTimeOffset until, string mode)
        {
            // ✅ Chuẩn hoá về LOCAL để hiển thị & tính giờ cho đúng với đồng hồ máy
            var localUntil = until.ToLocalTime();
            _runExpiresAt = localUntil;
            _expireMode = mode;

            // Cập nhật ngay 1 lần
            Dispatcher.Invoke(() => UpdateExpireLabelUI());

            // Tick mỗi giây
            _expireTimer?.Dispose();
            _expireTimer = new System.Threading.Timer(_ =>
            {
                try
                {
                    var now = DateTimeOffset.Now;          // ❗ Dùng Now (local), không dùng UtcNow nữa
                    var left = (_runExpiresAt ?? now) - now;

                    if (left <= TimeSpan.Zero)
                    {
                        _expireTimer?.Dispose();
                        _expireTimer = null;

                        Dispatcher.BeginInvoke(new Action(() =>
                        {
                            // Tự dừng vòng chơi nếu còn đang chạy
                            if (HasRunningTasks())
            {
                StopAllTables("expired");
            }

                            // Thông báo theo mode
                            if (_expireMode == "trial")
                            {
                                MessageBox.Show("Bạn đang dùng tool dùng thử. Hãy liên hệ 0978.248.822", "Automino", MessageBoxButton.OK, MessageBoxImage.Information);
                            }
                            else
                            {
                                MessageBox.Show("Tool của bạn hết hạn ! Hãy liên hệ 0978.248.822 để gia hạn", "Automino", MessageBoxButton.OK, MessageBoxImage.Warning);
                            }

                            // Xoá nhãn
                            if (LblExpire != null) LblExpire.Text = "";
                            _runExpiresAt = null;
                            // nếu là trial thì huỷ vé local để lần sau không resume nữa
                            try { if (_expireMode == "trial") { _cfg.TrialUntil = ""; _ = SaveConfigAsync(); } } catch { }

                            // Ngắt heartbeat trước khi trả lease
                            StopLeaseHeartbeat();
                            // Thử trả lease luôn để nhường slot
                            var uname = (_homeUsername ?? "").Trim().ToLowerInvariant();
                                // if (!string.IsNullOrWhiteSpace(uname))
                                _ = ReleaseLeaseAsync(uname);

                        }));
                        return;
                    }

                    Dispatcher.BeginInvoke(new Action(UpdateExpireLabelUI));
                }
                catch { }
            }, null, TimeSpan.FromSeconds(1), TimeSpan.FromSeconds(1));
        }



        private void StopExpiryCountdown()
        {
            try { _expireTimer?.Dispose(); } catch { }
            _expireTimer = null;
            _runExpiresAt = null;
            _expireMode = "";
            if (LblExpire != null) LblExpire.Text = "";
        }

        private void UpdateExpireLabelUI()
        {
            if (LblExpire == null)
                return;

            if (_runExpiresAt == null)
            {
                LblExpire.Text = "";
                return;
            }

            // ❗ Dùng Now (local) để đồng bộ với _runExpiresAt (đã ToLocalTime ở trên)
            var now = DateTimeOffset.Now;
            var left = _runExpiresAt.Value - now;

            if (left <= TimeSpan.Zero)
            {
                LblExpire.Text = "Hết hạn";
                return;
            }

            string line;
            if (left.TotalDays >= 1)
            {
                // Ví dụ: "Còn lại: 1 ngày 07:12:34  |  Hết hạn: 17/11/2025 20:30"
                line = $"Còn lại: {Math.Floor(left.TotalDays)} ngày {left:hh\\:mm\\:ss}  |  Hết hạn: {_runExpiresAt:dd/MM/yyyy HH:mm}";
            }
            else
            {
                // Dưới 1 ngày chỉ hiện giờ/phút/giây
                line = $"Còn lại: {left:hh\\:mm\\:ss}";
            }
            LblExpire.Text = line;
        }


        // Helper build script với tham số interval (ms)
        private static string BuildHomeAutostartJs(int intervalMs)
        {
            var ms = Math.Max(300, intervalMs);
            return HOME_AUTOSTART_TEMPLATE.Replace("__INTERVAL__", ms.ToString());
        }

        private async void BtnHomeLogin_Click(object sender, RoutedEventArgs e)
        {
            await HomeClickLoginAsync();
        }

        private async void BtnHomePlay_Click(object sender, RoutedEventArgs e)
        {
            await HomeClickPlayAsync();
        }

        private void StartLeaseHeartbeat(string username)
        {
            StopLeaseHeartbeat();
            _leaseHbCts = new CancellationTokenSource();
            var cts = _leaseHbCts;
            var uname = Uri.EscapeDataString(username);

            Task.Run(async () =>
            {
                while (!cts.IsCancellationRequested)
                {
                    try
                    {
                        using var http = new HttpClient() { Timeout = TimeSpan.FromSeconds(4) };
                        var resp = await http.PostAsJsonAsync($"{LeaseBaseUrl}/heartbeat/{uname}",
                                                              new { clientId = _leaseClientId });
                        // chỉ log nhẹ cho debug
                        Log("[Lease] hb: " + (int)resp.StatusCode);
                    }
                    catch (Exception ex) { Log("[Lease] hb err: " + ex.Message); }

                    await Task.Delay(TimeSpan.FromSeconds(60), cts.Token)
                              .ContinueWith(_ => { }); // nuốt TaskCanceled
                }
            }, cts.Token);
        }

        private void StopLeaseHeartbeat()
        {
            try { _leaseHbCts?.Cancel(); } catch { }
            _leaseHbCts = null;
        }

        protected override void OnClosing(CancelEventArgs e)
        {
            try
            {
                StopLogPump();
                try { _uiModeTimer?.Stop(); _uiModeTimer = null; } catch { }
                StopLeaseHeartbeat();
                StopExpiryCountdown();

                // 🔴 thêm dòng này
                CleanupWebStuff();

                var uname = (_homeUsername ?? "").Trim().ToLowerInvariant();
                                // if (!string.IsNullOrWhiteSpace(uname))
                    _ = ReleaseLeaseAsync(uname);
            }
            catch { }
            base.OnClosing(e);
        }

        private readonly CancellationTokenSource _shutdownCts = new();
        public CancellationToken ShutdownToken => _shutdownCts.Token;

        public void ShutdownFromHost()
        {
            try
            {
                _shutdownCts.Cancel();   // bạn đã có
                _ = SaveTableSettingsAsync();
                CleanupWebStuff();       // 🔴 thêm
            }
            catch { }
        }



        private void CleanupWebStuff()
        {
            // 1) hủy các CTS liên quan đến web / auto login
            try { _navCts?.Cancel(); } catch { }
            _navCts = null;

            try { _userCts?.Cancel(); } catch { }
            _userCts = null;

            try { _passCts?.Cancel(); } catch { }
            _passCts = null;

            try { _stakeCts?.Cancel(); } catch { }
            _stakeCts = null;

            try { _autoLoginWatchCts?.Cancel(); } catch { }
            _autoLoginWatchCts = null;

            // 2) tắt timer license nếu có
            try { _licenseCheckTimer?.Dispose(); } catch { }
            _licenseCheckTimer = null;

            // 3) gỡ được cái nào có tên thì gỡ cái đó
            try
            {
                if (Web != null)
                {
                    // cái này CÓ tên nên gỡ được
                    try { Web.NavigationCompleted -= Web_NavigationCompleted; } catch { }

                    // đẩy web về trắng trước khi dispose để nó ngưng mấy request nền
                    try
                    {
                        if (Web.CoreWebView2 != null)
                            Web.CoreWebView2.Navigate("about:blank");
                    }
                    catch { }

                    // dispose hẳn control
                    try { Web.Dispose(); } catch { }
                    Web = null;
                }
                }
            catch { }

            // 4) reset các cờ đã hook để nếu mở lại thì hook lại từ đầu
            _webHooked = false;
            _webMsgHooked = false;
            _frameHooked = false;
            _domHooked = false;
        }






        private void SetStatusText(string? status)
        {
            try
            {
                if (LblStatusText == null) return;
                status = (status ?? "").Trim();
                if (string.IsNullOrEmpty(status))
                {
                    LblStatusText.Text = "";
                    LblStatusText.Visibility = Visibility.Collapsed;
                }
                else
                {
                    LblStatusText.Text = status;
                    LblStatusText.Visibility = Visibility.Visible;
                }
                }
            catch { /* ignore */ }
        }


        // Dùng lại cờ này nếu bạn đã có, hoặc thêm mới:
        private bool _cutStopTriggered = false;

        // Parse tiền: cho phép số âm ở đầu, bỏ dấu chấm phẩy khoảng trắng
        private static double ParseMoney(string s)
        {
            if (string.IsNullOrWhiteSpace(s)) return 0;
            var cleaned = new string(s.Where(c => char.IsDigit(c) || (c == '-' && s.IndexOf(c) == 0)).ToArray());
            return double.TryParse(cleaned, out var v) ? v : 0;
        }

        // Gán UI từ config (gọi ở nơi bạn đã áp config ra UI, ví dụ sau LoadConfig)
        private void ApplyCutUiFromConfig()
        {
            if (TxtCutProfit != null) TxtCutProfit.Text = (_cfg?.CutProfit ?? 0).ToString("N0");
            if (TxtCutLoss != null) TxtCutLoss.Text = (_cfg?.CutLoss ?? 0).ToString("N0");
        }

        private static double ParseMoneyOrZero(string s)
        {
            if (string.IsNullOrWhiteSpace(s)) return 0;            // ⬅️ rỗng = 0 (tắt)
                                                                   // Cho phép số âm ở đầu, bỏ dấu ngăn cách
            var cleaned = new string(s.Where(c => char.IsDigit(c) || (c == '-' && s.IndexOf(c) == 0)).ToArray());
            return double.TryParse(cleaned, out var v) ? v : 0;
        }

        private async void TxtCut_LostFocus(object sender, RoutedEventArgs e)
        {
            if (!_uiReady) return;

            // Đọc & chuẩn hoá (chuỗi rỗng = 0 => tắt)
            var newCutProfit = ParseMoneyOrZero(T(TxtCutProfit));
            var newCutLoss = ParseMoneyOrZero(T(TxtCutLoss));

            // Tránh ghi file khi không đổi
            if (_cfg != null && _cfg.CutProfit == newCutProfit && _cfg.CutLoss == newCutLoss)
            {
                // vẫn format lại UI cho đẹp số
                ApplyCutUiFromConfig();
                return;
            }

            // Cập nhật _cfg và lưu cho lần sau
            _cfg.CutProfit = newCutProfit;
            _cfg.CutLoss = newCutLoss;
            await SaveConfigAsync();

            // Format lại UI theo "N0"
            ApplyCutUiFromConfig();

            // Nếu đang chạy thì kiểm tra & cắt ngay nếu đủ điều kiện
            CheckCutAndStopIfNeeded();
        }


        private void CheckCutAndStopIfNeeded()
        {
            if (_cutStopTriggered) return;

            double cutProfit = _cfg?.CutProfit ?? 0;   // dương ⇒ bật cắt lãi
            double cutLoss = _cfg?.CutLoss ?? 0;   // dương ⇒ bật cắt lỗ (ngưỡng là -cutLoss)

            // ⬇️ Không nhập (rỗng/0) ⇒ hoạt động bình thường (không cắt)
            if (cutProfit <= 0 && cutLoss <= 0) return;

            // Ưu tiên cắt lãi
            if (cutProfit > 0 && _winTotal >= cutProfit)
            {
                _cutStopTriggered = true;
                StopTaskAndNotify($"Đạt CẮT LÃI: Tiền thắng = {_winTotal:N0} ≥ {cutProfit:N0}");
                return;
            }

            // Cắt lỗ: hiểu cutLoss là số dương → ngưỡng thực tế = -cutLoss
            if (cutLoss > 0)
            {
                var lossThreshold = -cutLoss;
                if (_winTotal <= lossThreshold)
                {
                    _cutStopTriggered = true;
                    StopTaskAndNotify($"Đạt CẮT LỖ: Tiền thắng = {_winTotal:N0} ≤ {lossThreshold:N0}");
                    return;
                }
            }
        }


        private void StopTaskAndNotify(string reason)
        {
            try
            {
                StopAllTables("cut");
                MessageBox.Show(reason, "Automino", MessageBoxButton.OK, MessageBoxImage.Information);
                Log("[CUT] " + reason);
            }
            catch { /* ignore */ }
        }


        private void FinalizeLastBet(string? result, long balanceAfter)
        {
            if (_pendingRow == null || string.IsNullOrWhiteSpace(result)) return;

            _pendingRow.Result = result!.ToUpperInvariant();
            bool win = string.Equals(_pendingRow.Side, _pendingRow.Result, StringComparison.OrdinalIgnoreCase);
            _pendingRow.WinLose = win ? "Thắng" : "Thua";
            _pendingRow.Account = balanceAfter;

            // ❗KHÔNG Add lại vào _betAll (đã chèn ở thời điểm BET)
            try { AppendBetCsv(_pendingRow); } catch { /* ignore IO */ }

            // Chỉ về trang 1 nếu đang bám trang mới nhất; còn đang xem trang cũ thì giữ nguyên
            if (_autoFollowNewest)
            {
                ShowFirstPage();
            }
            else
            {
                RefreshCurrentPage();   // (mục 3 bên dưới)
            }

            _pendingRow = null; // sẵn sàng ván tiếp theo
        }




        private async Task LoadBetHistoryAsync(int maxTotal)
        {
            try
            {
                var files = Directory.EnumerateFiles(_logDir, "bets-*.csv")
                                     .OrderByDescending(f => f)
                                     .ToList();

                var tmp = new List<BetRow>(maxTotal);

                foreach (var f in files)
                {
                    using var sr = new StreamReader(f, Encoding.UTF8);
                    string? line; bool first = true;

                    while ((line = await sr.ReadLineAsync()) != null)
                    {
                        if (first) { first = false; if (line.StartsWith("At,")) continue; }

                        var cols = line.Split(',');
                        if (cols.Length < 7) continue;
                        if (!DateTime.TryParse(cols[0], out var at)) continue;

                        string normSide = NormalizeSide(cols[3]);
                        string normResult = NormalizeSide(cols[4]);
                        string normWL = NormalizeWL(cols[5]);

                        var row = new BetRow
                        {
                            At = at,
                            Game = cols[1]?.Trim() ?? "",
                            Stake = long.TryParse(cols[2], out var st) ? st : 0,
                            Side = normSide,
                            Result = normResult,
                            WinLose = normWL,
                            Account = long.TryParse(cols[6], out var ac) ? ac : 0,
                        };
                        tmp.Add(row);
                        if (tmp.Count >= maxTotal) break;
                    }
                    if (tmp.Count >= maxTotal) break;
                }

                _betAll.Clear();
                _betAll.AddRange(tmp.OrderByDescending(r => r.At).Take(maxTotal));
                // Chỉ về trang 1 nếu đang bám trang mới nhất; còn đang xem trang cũ thì giữ nguyên
                if (_autoFollowNewest)
                {
                    ShowFirstPage();
                }
                else
                {
                    RefreshCurrentPage();   // (mục 3 bên dưới)
                }
                }
            catch { /* ignore */ }
        }

        private static string NormalizeSide(string s)
        {
            var u = TextNorm.U(s);
            if (u == "C" || u == "CHAN") return "CHAN";
            if (u == "L" || u == "LE") return "LE";
            return (s ?? "").Trim();
        }
        private static string NormalizeWL(string s)
        {
            var u = TextNorm.U(s);
            if (u.StartsWith("THANG")) return "Thắng";
            if (u.StartsWith("THUA")) return "Thua";
            return (s ?? "").Trim();
        }





        private void RefreshBetPage()
        {
            _betPage.Clear();

            int total = _betAll.Count;
            int pageCount = Math.Max(1, (int)Math.Ceiling(total / (double)PageSize));

            // chốt _pageIndex trong biên
            _pageIndex = Math.Max(0, Math.Min(_pageIndex, pageCount - 1));

            // vì _betAll đang sắp MỚI → CŨ, trang 1 là index 0
            int start = _pageIndex * PageSize;
            var slice = _betAll.Skip(start).Take(PageSize);

            foreach (var r in slice) _betPage.Add(r);

            if (LblPage != null) LblPage.Text = $"{_pageIndex + 1}/{pageCount}";
            BuildPager();
        }

        private void ShowFirstPage()
        {
            _pageIndex = 0;      // trang 1
            RefreshBetPage();
            _autoFollowNewest = true;
        }


        private void ShowLastPage()
        {
            int total = _betAll.Count;
            int pageCount = Math.Max(1, (int)Math.Ceiling(total / (double)PageSize));
            _pageIndex = pageCount - 1;
            RefreshBetPage();
            _autoFollowNewest = false;
        }

        private void RefreshCurrentPage() => RefreshBetPage();


        // sự kiện nút
        private void BtnPrevPage_Click(object sender, RoutedEventArgs e)
        {
            // trang 1 là 0 → không lùi được nữa
            if (_pageIndex > 0)
            {
                _pageIndex--;
                RefreshBetPage();
            }
        }


        private void BtnNextPage_Click(object sender, RoutedEventArgs e)
        {
            int pageCount = Math.Max(1, (int)Math.Ceiling(_betAll.Count / (double)PageSize));
            if (_pageIndex < pageCount - 1)
            {
                _pageIndex++;
                RefreshBetPage();
                _autoFollowNewest = false;
            }
        }


        private void AppendBetCsv(BetRow r)
        {
            try
            {
                var file = Path.Combine(_logDir, $"bets-{DateTime.Today:yyyyMMdd}.csv");
                bool exists = File.Exists(file);
                using var sw = new StreamWriter(file, append: true, Encoding.UTF8);
                if (!exists)
                    sw.WriteLine("At,Game,Stake,Side,Result,WinLose,Account");
                // CSV đơn giản, At lưu ISO để dễ parse
                sw.WriteLine($"{r.At:O},{r.Game},{r.Stake},{r.Side},{r.Result},{r.WinLose},{r.Account}");
            }
            catch { }
        }

        private async void MainWindow_Loaded(object? sender, RoutedEventArgs e)
        {
            await LoadBetHistoryAsync(maxTotal: MaxHistory);  // đọc tối đa MaxHistory bản ghi nhiều ngày
            ShowFirstPage();                            // hiển thị 10 dòng mới nhất (trang cuối)
            UpdateTooltips();
        }

        private void BtnFirstPage_Click(object sender, RoutedEventArgs e)
        {
            _pageIndex = 0;
            RefreshBetPage();
        }
        private void BtnLastPage_Click(object sender, RoutedEventArgs e)
        {
            int pageCount = Math.Max(1, (int)Math.Ceiling(_betAll.Count / (double)PageSize));
            _pageIndex = pageCount - 1;
            RefreshBetPage();
        }

        /// <summary>Dựng dãy số trang: 1 … 4 5 [6] 7 8 … 20</summary>
        private void BuildPager()
        {
            // chỉ còn dùng để cập nhật LblPage
            int total = _betAll.Count;
            int pageCount = Math.Max(1, (int)Math.Ceiling(total / (double)PageSize));
            if (LblPage != null) LblPage.Text = $"{_pageIndex + 1}/{pageCount}";
            // không dựng các nút số nữa
        }



        private void CleanupOldLogs()
        {
            try
            {
                if (!Directory.Exists(_logDir)) return;
                string today = DateTime.Today.ToString("yyyyMMdd", System.Globalization.CultureInfo.InvariantCulture);

                // Chỉ đụng tới *.log (C#), KHÔNG đụng "bets-*.csv"
                foreach (var f in Directory.EnumerateFiles(_logDir, "*.log", SearchOption.TopDirectoryOnly))
                {
                    var name = Path.GetFileName(f);
                    bool isTodayLog = name.Equals($"{today}.log", StringComparison.OrdinalIgnoreCase);
                    if (!isTodayLog)
                    {
                        try { File.Delete(f); } catch { /* ignore IO */ }
                    }
                }
                }
            catch { /* ignore */ }
        }

        // ⟲ Mới nhất
        private void BtnGoNewest_Click(object sender, RoutedEventArgs e)
        {
            ShowFirstPage();   // trang 1 là mới nhất trong kiến trúc hiện tại
        }

        // Combo chọn "số dòng / trang"
        private void CmbPageSize_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (CmbPageSize?.SelectedItem is ComboBoxItem it
                && int.TryParse(it.Tag?.ToString(), out var n)
                && n > 0)
            {
                PageSize = n;

                ShowFirstPage();   // trang 1 là mới nhất trong kiến trúc hiện tại
            }
        }

        // Ô "Tới trang …"
        private void BtnGoto_Click(object sender, RoutedEventArgs e)
        {
            if (int.TryParse(TxtGoto?.Text, out var userPage))
            {
                int total = _betAll.Count;
                int pageCount = Math.Max(1, (int)Math.Ceiling(total / (double)PageSize));
                _pageIndex = Math.Max(0, Math.Min(userPage - 1, pageCount - 1)); // user 1-based
                RefreshBetPage();
            }
        }

        private void TxtGoto_KeyDown(object sender, KeyEventArgs e)
        {
            if (e.Key == Key.Enter) BtnGoto_Click(sender, e);
        }


        private static string NormalizeSeq(string raw) =>
    TextNorm.U(Regex.Replace(raw ?? "", @"[,\s\-]+", "")); // bỏ , khoảng trắng, -

        // --- Chuỗi C/L: C,L; 2..50 ký tự sau khi bỏ phân tách ---
        private static bool ValidateSeqCL(string s, out string err)
        {
            err = "";
            if (string.IsNullOrWhiteSpace(s))
            {
                err = "Vui lòng nhập chuỗi C/L.";
                return false;
            }

            int count = 0;
            foreach (var ch in s)
            {
                if (char.IsWhiteSpace(ch)) continue;          // chỉ cho phép khoảng trắng
                char u = char.ToUpperInvariant(ch);
                if (u == 'C' || u == 'L') { count++; continue; }  // và C/L
                err = "Chỉ cho phép khoảng trắng và ký tự C hoặc L (không dùng dấu phẩy/gạch/chấm phẩy/gạch dưới, số, ký tự khác).";
                return false;
            }

            if (count < 2 || count > 100)
            {
                err = "Độ dài 2–50 ký tự (tính theo C/L, bỏ qua khoảng trắng).";
                return false;
            }

            return true;
        }

        // --- Chuỗi I/N: I,N; 2..50 ký tự ---
        private static bool ValidateSeqNI(string s, out string err)
        {
            err = "";
            if (string.IsNullOrWhiteSpace(s))
            {
                err = "Vui lòng nhập chuỗi I/N.";
                return false;
            }

            int count = 0;
            foreach (var ch in s)
            {
                if (char.IsWhiteSpace(ch)) continue;          // chỉ cho phép khoảng trắng
                char u = char.ToUpperInvariant(ch);
                if (u == 'I' || u == 'N') { count++; continue; }  // và I/N
                err = "Chỉ cho phép khoảng trắng và ký tự I hoặc N (không dùng dấu phẩy/gạch/chấm phẩy/gạch dưới, số, ký tự khác).";
                return false;
            }

            if (count < 2 || count > 100)
            {
                err = "Độ dài 2–50 ký tự (tính theo I/N, bỏ qua khoảng trắng).";
                return false;
            }

            return true;
        }

        // --- Thế cầu C/L: từng dòng "<mẫu> - <đặt>", mẫu gồm C/L/?, đặt là C hoặc L ---
        private static bool ValidatePatternsCL(string s, out string err)
        {
            err = "";
            if (string.IsNullOrWhiteSpace(s))
            {
                err = "Vui lòng nhập các thế cầu C/L.";
                return false;
            }

            // Tách nhiều quy tắc: ',', ';', '|', hoặc xuống dòng
            var rules = System.Text.RegularExpressions.Regex.Split(s.Replace("\r", ""), @"[,\;\|
]+");
            int idx = 0;

            foreach (var raw in rules)
            {
                var line = raw.Trim();
                if (line.Length == 0) continue;
                idx++;

                // <mẫu> (C/L, cho phép khoảng trắng)  -> hoặc -  <chuỗi cầu> (C/L, CHO PHÉP khoảng trắng)
                var m = System.Text.RegularExpressions.Regex.Match(
                    line,
                    @"^\s*([CLcl\s]+)\s*(?:->|-)\s*([CLcl\s]+)\s*$",
                    System.Text.RegularExpressions.RegexOptions.IgnoreCase);

                if (!m.Success)
                {
                    err = $"Quy tắc {idx} không hợp lệ: “{line}”. Dạng đúng: <mẫu> -> <chuỗi cầu> hoặc <mẫu>-<chuỗi cầu>; chỉ dùng C/L; <chuỗi cầu> có thể có khoảng trắng.";
                    return false;
                }

                // LHS: chỉ C/L + khoảng trắng; độ dài 1–10 sau khi bỏ khoảng trắng
                var lhsRaw = m.Groups[1].Value;
                var lhsBuf = new System.Text.StringBuilder(lhsRaw.Length);
                foreach (char ch in lhsRaw)
                {
                    if (char.IsWhiteSpace(ch)) continue;
                    char u = char.ToUpperInvariant(ch);
                    if (u == 'C' || u == 'L') lhsBuf.Append(u);
                    else { err = $"Quy tắc {idx}: <mẫu_quá_khứ> chỉ gồm C/L (cho phép khoảng trắng giữa các ký tự)."; return false; }
                }
                var lhs = lhsBuf.ToString();
                if (lhs.Length < 1 || lhs.Length > 10)
                {
                    err = $"Quy tắc {idx}: độ dài <mẫu_quá_khứ> phải 1–10 ký tự (C/L).";
                    return false;
                }

                // RHS: chuỗi cầu C/L (>=1), CHO PHÉP khoảng trắng (bị bỏ qua khi kiểm tra)
                var rhsRaw = m.Groups[2].Value;
                var rhsBuf = new System.Text.StringBuilder(rhsRaw.Length);
                foreach (char ch in rhsRaw)
                {
                    if (char.IsWhiteSpace(ch)) continue;
                    char u = char.ToUpperInvariant(ch);
                    if (u == 'C' || u == 'L') rhsBuf.Append(u);
                    else { err = $"Quy tắc {idx}: <chuỗi cầu> chỉ gồm C/L (có thể nhiều ký tự), cho phép khoảng trắng."; return false; }
                }
                if (rhsBuf.Length < 1)
                {
                    err = $"Quy tắc {idx}: <chuỗi cầu> tối thiểu 1 ký tự C/L.";
                    return false;
                }
            }

            return true;
        }




        // --- Thế cầu I/N: từng dòng "<mẫu> - <đặt>", mẫu gồm I/N/?, đặt là I hoặc N ---
        private static bool ValidatePatternsNI(string s, out string err)
        {
            err = "";
            if (string.IsNullOrWhiteSpace(s))
            {
                err = "Vui lòng nhập các thế cầu I/N.";
                return false;
            }

            // Tách nhiều quy tắc: ',', ';', '|', hoặc xuống dòng
            var rules = System.Text.RegularExpressions.Regex.Split(s.Replace("\r", ""), @"[,\;\|
]+");
            int idx = 0;

            foreach (var raw in rules)
            {
                var line = raw.Trim();
                if (line.Length == 0) continue;
                idx++;

                // <mẫu> (I/N, cho phép khoảng trắng)  -> hoặc -  <chuỗi cầu> (I/N, CHO PHÉP khoảng trắng)
                var m = System.Text.RegularExpressions.Regex.Match(
                    line,
                    @"^\s*([INin\s]+)\s*(?:->|-)\s*([INin\s]+)\s*$",
                    System.Text.RegularExpressions.RegexOptions.IgnoreCase);

                if (!m.Success)
                {
                    err = $"Quy tắc {idx} không hợp lệ: “{line}”. Dạng đúng: <mẫu> -> <chuỗi cầu> hoặc <mẫu>-<chuỗi cầu>; chỉ dùng I/N; <chuỗi cầu> có thể có khoảng trắng.";
                    return false;
                }

                // LHS: chỉ I/N + khoảng trắng; độ dài 1–10 sau khi bỏ khoảng trắng
                var lhsRaw = m.Groups[1].Value;
                var lhsBuf = new System.Text.StringBuilder(lhsRaw.Length);
                foreach (char ch in lhsRaw)
                {
                    if (char.IsWhiteSpace(ch)) continue;
                    char u = char.ToUpperInvariant(ch);
                    if (u == 'I' || u == 'N') lhsBuf.Append(u);
                    else { err = $"Quy tắc {idx}: <mẫu_quá_khứ> chỉ gồm I/N (cho phép khoảng trắng giữa các ký tự)."; return false; }
                }
                var lhs = lhsBuf.ToString();
                if (lhs.Length < 1 || lhs.Length > 10)
                {
                    err = $"Quy tắc {idx}: độ dài <mẫu_quá_khứ> phải 1–10 ký tự (I/N).";
                    return false;
                }

                // RHS: chuỗi cầu I/N (>=1), CHO PHÉP khoảng trắng (bị bỏ qua khi kiểm tra)
                var rhsRaw = m.Groups[2].Value;
                var rhsBuf = new System.Text.StringBuilder(rhsRaw.Length);
                foreach (char ch in rhsRaw)
                {
                    if (char.IsWhiteSpace(ch)) continue;
                    char u = char.ToUpperInvariant(ch);
                    if (u == 'I' || u == 'N') rhsBuf.Append(u);
                    else { err = $"Quy tắc {idx}: <chuỗi cầu> chỉ gồm I/N (có thể nhiều ký tự), cho phép khoảng trắng."; return false; }
                }
                if (rhsBuf.Length < 1)
                {
                    err = $"Quy tắc {idx}: <chuỗi cầu> tối thiểu 1 ký tự I/N.";
                    return false;
                }
            }

            return true;
        }


        private void ShowSeqError(string? msg)
        {
            if (LblSeqError == null) return;
            if (string.IsNullOrWhiteSpace(msg)) { LblSeqError.Visibility = Visibility.Collapsed; LblSeqError.Text = ""; }
            else { LblSeqError.Text = msg; LblSeqError.Visibility = Visibility.Visible; }
        }

        // --- Validate cuối cùng khi bấm "Bắt Đầu Cược" ---
        private bool ValidateInputsForCurrentStrategy()
        {
            ShowErrorsForCurrentStrategy(); // cập nhật UI trước

            int idx = CmbBetStrategy?.SelectedIndex ?? 4;
            if (idx == 0) // 1. Chuỗi C/L
            {
                if (!ValidateSeqCL(T(TxtChuoiCau), out var err))
                {
                    SetError(LblSeqError, err);
                    BringBelow(TxtChuoiCau);
                    return false;
                }
            }
            //else if (idx == 2) // 3. Chuỗi I/N
            //{
            //    if (!ValidateSeqNI(T(TxtChuoiCau), out var err))
            //    {
            //        SetError(LblSeqError, err);
            //        BringBelow(TxtChuoiCau);
            //        return false;
            //    }
            //}
            else if (idx == 1) // 2. Thế C/L
            {
                if (!ValidatePatternsCL(T(TxtTheCau), out var err))
                {
                    SetError(LblPatError, err);
                    BringBelow(TxtTheCau);
                    return false;
                }
            }
            //else if (idx == 3) // 4. Thế I/N
            //{
            //    if (!ValidatePatternsNI(T(TxtTheCau), out var err))
            //    {
            //        SetError(LblPatError, err);
            //        BringBelow(TxtTheCau);
            //        return false;
            //    }
            //}

            // Chiến lược 5 không cần input
            return true;
        }

        private void SyncStrategyFieldsToUI()
        {
            int idx = CmbBetStrategy?.SelectedIndex ?? 4;
            if (idx == 0) { if (TxtChuoiCau != null) TxtChuoiCau.Text = _cfg.BetSeqCL ?? ""; }
            else if (idx == 2) { if (TxtChuoiCau != null) TxtChuoiCau.Text = _cfg.BetSeqNI ?? ""; }

            if (idx == 1) { if (TxtTheCau != null) TxtTheCau.Text = _cfg.BetPatternsCL ?? ""; }
            else if (idx == 3) { if (TxtTheCau != null) TxtTheCau.Text = _cfg.BetPatternsNI ?? ""; }
        }

        private void LoadStakeCsvForCurrentMoneyStrategy()
        {
            try
            {
                var id = GetMoneyStrategyFromUI();                    // ví dụ: "Victor2" / "IncreaseWhenLose" ...
                string csv = _cfg.StakeCsv;                           // fallback
                if (_cfg.StakeCsvByMoney != null &&
                    !string.IsNullOrWhiteSpace(id) &&
                    _cfg.StakeCsvByMoney.TryGetValue(id, out var saved) &&
                    !string.IsNullOrWhiteSpace(saved))
                {
                    csv = saved;
                }

                if (TxtStakeCsv != null) TxtStakeCsv.Text = csv;      // -> sẽ kích TextChanged để rebuild _stakeSeq
                RebuildStakeSeq(csv);
                Log($"[StakeCsv.load] id={id} => {csv} -> {_stakeSeq.Length}");
            }
            catch { /* ignore */ }
        }



        private async void TxtChuoiCau_TextChanged(object sender, TextChangedEventArgs e)
        {
            if (!_uiReady || _suppressTableSync) return;

            var idx = CmbBetStrategy?.SelectedIndex ?? -1;       // 0: CL, 2: N/I
            var txt = (TxtChuoiCau?.Text ?? "").Trim();

            // Lưu tách bạch cho từng chiến lược
            if (idx == 0) _cfg.BetSeqCL = txt;    // Chiến lược 1: Chuỗi C/L
            if (idx == 2) _cfg.BetSeqNI = txt;    // Chiến lược 3: Chuỗi N/I

            // Bản “chung” để engine đọc khi chạy
            _cfg.BetSeq = txt;

            if (!string.IsNullOrWhiteSpace(_activeTableId))
                UpdateTableSettingFromUi(_activeTableId);
            else
                await SaveConfigAsync();              // <- GHI config.json
            ShowErrorsForCurrentStrategy();       // (nếu bạn có hiển thị lỗi dưới ô)
        }


        private async void TxtTheCau_TextChanged(object sender, TextChangedEventArgs e)
        {
            if (!_uiReady || _suppressTableSync) return;

            var idx = CmbBetStrategy?.SelectedIndex ?? -1;       // 1: CL, 3: N/I
            var txt = (TxtTheCau?.Text ?? "").Trim();

            // Lưu tách bạch cho từng chiến lược
            if (idx == 1) _cfg.BetPatternsCL = txt;  // Chiến lược 2: Thế C/L
            if (idx == 3) _cfg.BetPatternsNI = txt;  // Chiến lược 4: Thế N/I

            // Bản “chung” để engine đọc khi chạy
            _cfg.BetPatterns = txt;

            if (!string.IsNullOrWhiteSpace(_activeTableId))
                UpdateTableSettingFromUi(_activeTableId);
            else
                await SaveConfigAsync();                // <- GHI config.json
            ShowErrorsForCurrentStrategy();         // (nếu có)
        }



        // ====== TOOLTIP HELPERS ======
        private static ToolTip MakeTip(string text)
        {
            return new ToolTip
            {
                Content = new TextBlock
                {
                    Text = text,
                    TextWrapping = TextWrapping.Wrap,
                    MaxWidth = 420,
                    FontSize = 12
                },
                // KHÔNG set StaysOpen=false (WPF sẽ quăng NotSupported khi gán qua .ToolTip)
                Placement = System.Windows.Controls.Primitives.PlacementMode.Mouse
            };
        }
        private static void AttachTip(Control? c, string? text)
        {
            if (c == null) return;

            if (string.IsNullOrWhiteSpace(text))
            {
                c.ClearValue(FrameworkElement.ToolTipProperty);
                return;
            }

            // Hiện tooltip ngay cả khi control/parent bị IsEnabled=false
            ToolTipService.SetShowOnDisabled(c, true);
            ToolTipService.SetInitialShowDelay(c, 120);
            ToolTipService.SetBetweenShowDelay(c, 120);
            ToolTipService.SetShowDuration(c, 30000);

            c.ToolTip = MakeTip(text);
        }

        private static void SetError(TextBlock? tb, string? msg)
        {
            if (tb == null) return;
            if (string.IsNullOrWhiteSpace(msg))
            {
                tb.Text = "";
                tb.Visibility = Visibility.Collapsed;
            }
            else
            {
                tb.Text = msg;
                tb.Visibility = Visibility.Visible;
            }
        }
        private static void BringBelow(FrameworkElement? fe)
        {
            try { fe?.BringIntoView(); } catch { }
            try { fe?.Focus(); } catch { }
        }

        // --- Hiển thị lỗi live theo chiến lược đang chọn ---
        private void ShowErrorsForCurrentStrategy()
        {
            int idx = CmbBetStrategy?.SelectedIndex ?? 4;

            // Chuỗi cầu (chiến lược 1,3)
            if (idx == 0 || idx == 2)
            {
                string s = (TxtChuoiCau?.Text ?? "");
                bool ok = (idx == 0)
                    ? ValidateSeqCL(s, out var e1)
                    : ValidateSeqNI(s, out e1);
                SetError(LblSeqError, ok ? null : e1);
            }
            else
            {
                SetError(LblSeqError, null);
            }

            // Thế cầu (chiến lược 2,4)
            if (idx == 1 || idx == 3)
            {
                string s = (TxtTheCau?.Text ?? "");
                bool ok = (idx == 1)
                    ? ValidatePatternsCL(s, out var e2)
                    : ValidatePatternsNI(s, out e2);
                SetError(LblPatError, ok ? null : e2);
            }
            else
            {
                SetError(LblPatError, null);
            }
        }

















    }

}
