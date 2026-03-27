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
using BaccaratWM;
using BaccaratWM.Tasks;
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
using Microsoft.Win32;
using System.Net.NetworkInformation;
using System.Collections.ObjectModel;
using System.Windows.Data;
using static BaccaratWM.MainWindow;
using System.Windows.Input;




namespace BaccaratWM
{
    // Fallback loader: nếu SharedIcons chưa có, nạp từ Assets (pack URI).
    // Fallback loader: nếu SharedIcons chưa có, nạp từ Resources (pack URI).
    internal static class FallbackIcons
    {
        private const string SidePlayerPng = "Assets/side/PLAYER.png";
        private const string SideBankerPng = "Assets/side/BANKER.png";
        private const string ResultPlayerPng = "Assets/side/PLAYER.png";
        private const string ResultBankerPng = "Assets/side/BANKER.png";
        private const string ResultTiePng = "Assets/side/HOA.png";
        private const string WinPng = "Assets/kq/THANG.png";
        private const string LossPng = "Assets/kq/THUA.png";
        private const string TiePng = "Assets/kq/HOA.png";

        private static ImageSource? _sidePlayer, _sideBanker, _resultPlayer, _resultBanker, _resultTie, _win, _loss, _tie;

        public static ImageSource? GetSidePlayer() => SharedIcons.SidePlayer ?? (_sidePlayer ??= Load(SidePlayerPng));
        public static ImageSource? GetSideBanker() => SharedIcons.SideBanker ?? (_sideBanker ??= Load(SideBankerPng));
        public static ImageSource? GetResultPlayer() => SharedIcons.ResultPlayer ?? (_resultPlayer ??= Load(ResultPlayerPng));
        public static ImageSource? GetResultBanker() => SharedIcons.ResultBanker ?? (_resultBanker ??= Load(ResultBankerPng));
        public static ImageSource? GetResultTie() => SharedIcons.ResultTie ?? (_resultTie ??= Load(ResultTiePng));
        public static ImageSource? GetWin() => SharedIcons.Win ?? (_win ??= Load(WinPng));
        public static ImageSource? GetLoss() => SharedIcons.Loss ?? (_loss ??= Load(LossPng));
        public static ImageSource? GetTie() => SharedIcons.Tie ?? (_tie ??= Load(TiePng));

        public static ImageSource? TryGetResource(string key)
        {
            try
            {
                var res = System.Windows.Application.Current?.Resources;
                if (res != null && res.Contains(key))
                    return res[key] as ImageSource;
            }
            catch { }
            return null;
        }

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
            if (u == "P" || u == "PLAYER") return FallbackIcons.GetSidePlayer();
            if (u == "B" || u == "BANKER") return FallbackIcons.GetSideBanker();
            return null;
        }
        public object ConvertBack(object v, Type t, object p, CultureInfo c) => Binding.DoNothing;
    }

    public sealed class KetQuaToIconConverter : IValueConverter
    {
        public object Convert(object value, Type t, object p, CultureInfo c)
        {
            var raw = value?.ToString() ?? "";
            var u = TextNorm.U(raw);
            var clean = new string(u.Where(char.IsLetterOrDigit).ToArray());
            if (u == "P" || u == "PLAYER") return FallbackIcons.GetResultPlayer();
            if (u == "B" || u == "BANKER") return FallbackIcons.GetResultBanker();
            if (u == "T" || u == "TIE" || u.Contains("HOA") || clean == "HA")
                return FallbackIcons.GetResultTie()
                    ?? FallbackIcons.TryGetResource("ImgTie")
                    ?? FallbackIcons.TryGetResource("ImgHOA");
            return null;
        }
        public object ConvertBack(object v, Type t, object p, CultureInfo c) => Binding.DoNothing;
    }

    public sealed class WinLossToIconConverter : IValueConverter
    {
        public object Convert(object value, Type t, object p, CultureInfo c)
        {
            var raw = value?.ToString() ?? "";
            var u = TextNorm.U(raw);
            var clean = new string(u.Where(char.IsLetterOrDigit).ToArray());
            if (u.StartsWith("THANG")) return FallbackIcons.GetWin();
            if (u.StartsWith("THUA")) return FallbackIcons.GetLoss();
            if (u.StartsWith("HOA") || u == "T" || u == "TIE" || clean == "HA")
                return FallbackIcons.GetTie()
                    ?? FallbackIcons.TryGetResource("ImgHOA")
                    ?? FallbackIcons.TryGetResource("ImgTie");
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
        private sealed class Protocol21RoomState
        {
            public string CacheKey { get; set; } = "";
            public string Id { get; set; } = "";
            public string Name { get; set; } = "";
            public int Sort { get; set; } = int.MaxValue;
            public int GameId { get; set; } = -1;
            public int GroupType { get; set; } = -1;
        }

        private sealed class PopupServerRoadState
        {
            public string RouteKey { get; set; } = "";
            public string TableId { get; set; } = "";
            public string TableName { get; set; } = "";
            public int GameId { get; set; } = -1;
            public string HostTag { get; set; } = "";
            public int? GameStage { get; set; }
            public bool? WantShuffle { get; set; }
            public bool? WantEnd { get; set; }
            public int? KeyStatus { get; set; }
            public int? TableStatus { get; set; }
            public int? PlayerScore { get; set; }
            public int? BankerScore { get; set; }
            public Dictionary<int, int> CardValueByArea { get; set; } = new();
            public List<string> History { get; set; } = new();
            public List<PopupRoadNode> HistoryRaw { get; set; } = new();
            public string HistoryText { get; set; } = "";
            public string CenterResult { get; set; } = "";
            public string Text { get; set; } = "";
            public string SessionKey { get; set; } = "";
            public double? BetPlayer { get; set; }
            public double? BetBanker { get; set; }
            public double? BetTie { get; set; }
            public double? TableBetPlayer { get; set; }
            public double? TableBetBanker { get; set; }
            public double? TableBetTie { get; set; }
            public double? Countdown { get; set; }
            public DateTime LastCountdownUpdatedUtc { get; set; } = DateTime.MinValue;
            public string LastPushSig { get; set; } = "";
            public DateTime LastUpdatedUtc { get; set; } = DateTime.MinValue;
            public DateTime LastHistoryUpdatedUtc { get; set; } = DateTime.MinValue;
            public string LastFinalizedSessionKey { get; set; } = "";
        }

        private sealed class PopupRoadNode
        {
            public int Row { get; set; }
            public int Col { get; set; }
            public string Code { get; set; } = "";
            public int TieCount { get; set; }
        }

        private const string AppLocalDirName = "BaccaratWM"; // đổi thành tên bạn muốn
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
        private bool _cdpNetworkOnMain = false;
        private bool _cdpNetworkOnPopup = false;
        private readonly ConcurrentDictionary<string, string> _wsUrlByRequestId = new();
        private readonly ConcurrentDictionary<string, string> _respUrlByRequestId = new();
        private readonly ConcurrentDictionary<string, string> _respMimeByRequestId = new();
        private readonly object _roomFeedGate = new();
        private List<RoomEntry> _latestNetworkRooms = new();
        private DateTime _latestNetworkRoomsAt = DateTime.MinValue;
        private string _latestNetworkRoomsSource = "";
        private string _latestNetworkRoomsSig = "";
        private DateTime _lastTableUpdateAt = DateTime.MinValue;
        private readonly Dictionary<string, Protocol21RoomState> _protocol21Rooms = new(StringComparer.OrdinalIgnoreCase);
        private readonly Dictionary<string, PopupServerRoadState> _popupServerRoadStates = new(StringComparer.OrdinalIgnoreCase);
        private readonly Dictionary<string, string> _popupPreferredRoadRouteByTableId = new(StringComparer.OrdinalIgnoreCase);
        private readonly object _popupServerRoadGate = new();
        private readonly string[] _pktInterestingHints = new[] { "wss://", "websocket", "hytsocesk", "xoc", "live", "socket", "lobby", "baccarat", "game", "table", "multibaccarat", "pragmaticplaylive" };

        // ==== Auto-login watcher ====
        private CancellationTokenSource? _autoLoginWatchCts;

        // === Fields ================================================================
        private volatile CwSnapshot _lastSnap;
        private readonly object _snapLock = new();
        private readonly Dictionary<string, TableTaskState> _tableTasks = new(StringComparer.OrdinalIgnoreCase);
        private readonly object _tableTasksGate = new();
        private readonly Dictionary<string, TableOverlayState> _tableOverlayStates = new(StringComparer.OrdinalIgnoreCase);
        private readonly object _tableOverlayGate = new();
        private readonly SemaphoreSlim _domActionLock = new(1, 1);
        private readonly SemaphoreSlim _gameReadyGate = new(1, 1);
        private readonly SemaphoreSlim _licenseGate = new(1, 1);
        private Task<bool>? _licenseCheckTask;
        private string? _licenseCheckUser;
        private int _runAllInProgress = 0;
        private const int NiSeqMax = 50;
        private readonly System.Text.StringBuilder _niSeq = new(NiSeqMax);

        private int _lastSeqLenNi = 0;
        private bool _lockMajorMinorUpdates = false;
        private string _baseSession = "";

        private long[] _stakeSeq = Array.Empty<long>();
        private System.Collections.Generic.List<long[]> _stakeChains = new();
        private long[] _stakeChainTotals = Array.Empty<long>();

        private double _decisionPercent = 3; // 3s

        // Chống bắn trùng khi vừa cược

        // Cache & cờ để không inject lặp lại
        private string? _appJs;
        private string? _homeJs;  // nội dung js_home_v2.js
        private bool _webMsgHooked; // đã gắn WebMessageReceived đúng 1 lần
        private WebView2? _popupWeb;
        private bool _popupWebHooked;
        private bool _popupBridgeRegistered;
        private bool _popupWebMsgHooked;
        private string? _popupLastDocKey;
        private string? _lastForcedLobbyUrl; // luu URL lobby PP da force navigate
        private string? _topForwardId, _appJsRegId;           // id script TOP_FORWARD
                                                              // ID riêng cho autostart của trang Home (đừng dùng chung với _homeJsRegId)
        private string? _homeAutoStartId;
        private string? _homeJsRegId;
        private string? _gameRoomPushRegId;
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
        private string _deviceId = "";
        private string _trialKey = "";
        private string _leaseSessionId = "";
        public string TrialUntil { get; set; } = "";
        // === License periodic re-check (5 phút/lần) ===
        private System.Threading.Timer? _licenseCheckTimer;
        private int _licenseCheckBusy = 0; // guard chống chồng lệnh
        // === Username lấy từ Home (authoritative) ===
        private string? _homeUsername;                 // username chuẩn lấy từ home_tick
        private DateTime _homeUsernameAt = DateTime.MinValue;
        private string? _homeBalance;
        private DateTime _homeBalanceAt = DateTime.MinValue; // mốc thời gian bắt được
        private string? _gameUsername;
        private DateTime _gameUsernameAt = DateTime.MinValue;
        private DateTime _lastGameUsernameProbeAt = DateTime.MinValue;
        private int _gameUsernameProbeBusy = 0;
        private string? _gameBalance;
        private DateTime _gameBalanceAt = DateTime.MinValue;
        private string? _gameTotalBet;
        private DateTime _gameTotalBetAt = DateTime.MinValue;
        private string _lastHomeTickSig = "";
        private string _lastDashboardAccountSig = "";
        private bool _homeLoggedIn = false; // chỉ true khi phát hiện có nút Đăng xuất (đã login)
        private bool _navModeHooked = false;   // đã gắn handler NavigationCompleted để cập nhật UI nhanh về Home?



        private bool _manualDashboardOpened = false;
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
        private int _roomFeedRefreshPending = 0;
        private DateTime _lastRoomFeedRefreshAt = DateTime.MinValue;

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
        private readonly Dictionary<string, BetRow> _pendingBetsByTable = new(StringComparer.OrdinalIgnoreCase);
        private readonly object _pendingBetGate = new();
        private string _lastBetSig = "";
        private long _lastBetSigAtMs = 0;
        private const int MaxHistory = 1000;   // tổng số bản ghi giữ trong bộ nhớ & khi load



        private const string DEFAULT_URL = "https://new.wencheng.cc/"; // URL mặc định bạn muốn
        // === License repo/worker settings (CHỈNH LẠI CHO PHÙ HỢP) ===
        const string LicenseOwner = "ngomantri1";    // <- đổi theo repo của bạn
        const string LicenseRepo = "licenses";  // <- đổi theo repo của bạn
        const string LicenseBranch = "main";          // <- nhánh
        const string LicenseNameGame = "auto";          // <- nhánh
        const string LeaseBaseUrl = "https://net88.ngomantri1.workers.dev/lease/auto";
        private const bool EnableLeaseCloudflare = true; // true=bật gọi Cloudflare
        private const string TrialConsumedTodayMessage = "Hết lượt dùng thử trong ngày. Hãy quay lại dùng thử vào ngày mai.";

        // ===================== TOOLTIP TEXTS =====================
        const string TIP_SEQ_PB =
        @"Chuỗi CẦU (P/B) — Chiến lược 1
• Ý nghĩa: P = PLAYER, B = BANKER (không phân biệt hoa/thường).
• Cú pháp: chỉ gồm ký tự P hoặc B; ký tự khác không hợp lệ.
• Khoảng trắng/tab/xuống dòng: được phép; hệ thống tự bỏ qua.
• Thứ tự đọc: từ trái sang phải; hết chuỗi sẽ lặp lại từ đầu.
• Độ dài khuyến nghị: 2–100 ký tự.
Ví dụ hợp lệ:
  - PBBP
  - P B B P
Ví dụ không hợp lệ:
  - P,X,B     (có dấu phẩy)
  - PB1P      (có số)
  - P B _ P   (ký tự ngoài P/B).";

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

        const string TIP_THE_PB =
        @"Thế CẦU (P/B) — Chiến lược 2
• Ý nghĩa: P = PLAYER, B = BANKER (không phân biệt hoa/thường).
• Một quy tắc (mỗi dòng): <mẫu_quá_khứ> -> <cửa_kế_tiếp>  (hoặc dùng dấu - thay cho ->).
• Phân tách nhiều quy tắc: bằng dấu ',', ';', '|', hoặc xuống dòng.
• Khoảng trắng: được phép quanh ký hiệu và giữa các quy tắc; 
  Cho phép khoảng trắng BÊN TRONG <cửa_kế_tiếp>.
• So khớp: xét K kết quả gần nhất với K = độ dài <mẫu_quá_khứ>; nếu khớp thì đặt theo <cửa_kế_tiếp>.
• <cửa_kế_tiếp>: có thể là 1 ký tự (P/B) hoặc một chuỗi P/B (ví dụ: PBB).
• Độ dài khuyến nghị cho <mẫu_quá_khứ>: 1–20 ký tự.
Ví dụ hợp lệ:
  PPB -> P
  BBB -> B P
  PB  -> PBB
Ví dụ không hợp lệ:
  P, X, B -> P
  PB -> P B
  PB -> P1";


        const string TIP_THE_NI =
        @"Thế CẦU (Ít/Nhiều) — Chiến lược 4
• Ý nghĩa: I = bên ÍT tiền, N = bên NHIỀU tiền (không phân biệt hoa/thường).
• Một quy tắc (mỗi dòng): <mẫu_quá_khứ> -> <cửa_kế_tiếp>  (hoặc dùng dấu - thay cho ->).
• Phân tách nhiều quy tắc: bằng dấu ',', ';', '|', hoặc xuống dòng.
• Khoảng trắng: được phép quanh ký hiệu và giữa các quy tắc; 
  Cho phép khoảng trắng BÊN TRONG <cửa_kế_tiếp>.
• So khớp: xét K kết quả gần nhất với K = độ dài <mẫu_quá_khứ>; nếu khớp thì đặt theo <cửa_kế_tiếp>.
• <cửa_kế_tiếp>: có thể là 1 ký tự (I/N) hoặc một chuỗi I/N (ví dụ: INNN).
• Độ dài khuyến nghị cho <mẫu_quá_khứ>: 1–20 ký tự.
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
            [JsonExtensionData]
            public Dictionary<string, JsonElement>? Extra { get; set; }

            // Remember creds (DPAPI)
            public bool RememberCreds { get; set; } = true;
            public string EncUser { get; set; } = "";
            public string EncPass { get; set; } = "";
            public bool LockMouse { get; set; } = false;
            public bool UseTrial { get; set; } = false;
            public string LeaseClientId { get; set; } = "";
            public string LastHomeUsername { get; set; } = "";
            public string TrialUntil { get; set; } = "";
            public string TrialSessionKey { get; set; } = "";
            public int BetStrategyIndex { get; set; } = 4; // mặc định "5. Theo cầu trước thông minh"
            public string BetSeq { get; set; } = "";       // giá trị ô "CHUỖI CẦU"
            public string BetPatterns { get; set; } = "";  // giá trị ô "CÁC THẾ CẦU"
            public string MoneyStrategy { get; set; } = "IncreaseWhenLose";//IncreaseWhenLose
            public bool S7ResetOnProfit { get; set; } = true;
            public double CutProfit { get; set; } = 0; // 0 = tắt cắt lãi
            public double CutLoss { get; set; } = 0; // 0 = tắt cắt lỗ
            public bool AutoResetOnCut { get; set; } = false; // đủ cắt lãi/lỗ -> reset về mức đầu
            public bool AutoResetOnWinGeTotal { get; set; } = false; // tiền thắng >= tổng cược -> reset về mức đầu
            public bool WaitCutLossBeforeBet { get; set; } = false; // wait cut loss before real bet
            public string BetSeqPB { get; set; } = "";        // cho Chiến lược 1
            public string BetSeqNI { get; set; } = "";        // cho Chiến lược 3
            public string BetPatternsPB { get; set; } = "";   // cho Chiến lược 2
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
            [JsonExtensionData]
            public Dictionary<string, JsonElement>? Extra { get; set; }

            public int BetStrategyIndex { get; set; } = 4;
            public string BetSeq { get; set; } = "";
            public string BetPatterns { get; set; } = "";
            public string BetSeqPB { get; set; } = "";
            public string BetSeqNI { get; set; } = "";
            public string BetPatternsPB { get; set; } = "";
            public string BetPatternsNI { get; set; } = "";

            public string MoneyStrategy { get; set; } = "IncreaseWhenLose";
            public string StakeCsv { get; set; } = "";
            public Dictionary<string, string> StakeCsvByMoney { get; set; } = new(StringComparer.OrdinalIgnoreCase);
            public bool S7ResetOnProfit { get; set; } = true;

            public double CutProfit { get; set; } = 0;
            public double CutLoss { get; set; } = 0;
        }

        private record StatsRoot
        {
            public List<StatsItem> Tables { get; set; } = new();
        }

        private record StatsItem
        {
            public string TableId { get; set; } = "";
            public TabStats Stats { get; set; } = new();
        }

        private sealed class TabStats
        {
            public int CurrentWinStreak { get; set; }
            public int CurrentLossStreak { get; set; }
            public int MaxWinStreak { get; set; }
            public int MaxLossStreak { get; set; }
            public int TotalWinCount { get; set; }
            public int TotalLossCount { get; set; }
            public long TotalBetAmount { get; set; }
            public double TotalProfit { get; set; }
        }

        private sealed class TableTaskState
        {
            public string TableId { get; init; } = "";
            public string TableName { get; set; } = "";
            public CancellationTokenSource? Cts;
            public IBetTask? Task;
            public bool AutoStartRequested;
            public int DeferredStartScheduled;
            public DecisionState Decision = new();
            public bool Cooldown;
            public int StakeLevelIndexForUi = -1;
            public double WinTotal;
            public double WinTotalFromJs;
            public bool HasJsProfit;
            public int MoneyChainIndex;
            public int MoneyChainStep;
            public double MoneyChainProfit;
            public long MoneyResetVersion;
            public int StartInProgress;
            public string LastBetSide = "";
            public long LastBetAmount;
            public long RunTotalBet;
            public string LastBetLevelText = "";
            public int WinCount;
            public int LossCount;
            public long LastWinAmount;
            public long WinTotalOverlay;
            public bool HoldWinTotalUntilLevel1;
            public bool HoldWinTotalSkipLogged;
            public bool ForceStakeLevel1;
            public bool ForceStakeLevel1Applied;
            public TabStats Stats { get; set; } = new TabStats();
        }

        private sealed class TableOverlayState
        {
            public string TableId { get; set; } = "";
            public string TableName { get; set; } = "";
            public string HistoryRaw { get; set; } = "";
            public string HistoryPB { get; set; } = "";
            public string SeqDigits { get; set; } = "";
            public string LastToken { get; set; } = "";
            public string SessionKey { get; set; } = "";
            public string LastFinalizedSessionKey { get; set; } = "";
            public double Countdown { get; set; }
            public double CountdownMax { get; set; }
            public DateTime LastUpdate { get; set; } = DateTime.MinValue;
            public string LastLogSig { get; set; } = "";
        }

        // 1) Model 1 dòng log đặt cược
        private sealed class BetRow
        {
            public DateTime At { get; set; }                 // Thời gian đặt
            public string Game { get; set; } = "Xóc đĩa live";
            public string TableId { get; set; } = "";
            public string Table { get; set; } = "";          // Bàn chơi
            public long Stake { get; set; }                  // Tiền cược
            public string Side { get; set; } = "";           // P/B
            public string Result { get; set; } = "";         // Kết quả P/B
            public string WinLose { get; set; } = "";        // "Thắng"/"Thua"
            public double Account { get; set; }                // Số dư sau ván
            public int PendingGameId { get; set; } = 0;
            public string PendingKey { get; set; } = "";
        }

        public static class SharedIcons
        {
            public static ImageSource? SidePlayer, SideBanker;        // ảnh “Cửa đặt” P/B
            public static ImageSource? ResultPlayer, ResultBanker, ResultTie;    // ảnh “Kết quả” P/B/T
            public static ImageSource? Win, Loss, Tie;               // ảnh “Thắng/Thua/Hòa”
        }



        private AppConfig _cfg = new();
        private AppConfig _globalCfgSnapshot = new();
        private TableSettingsFile _tableSettings = new();
        private StatsRoot _statsRoot = new();
        private readonly Dictionary<string, TabStats> _statsByTable = new(StringComparer.OrdinalIgnoreCase);

        private readonly string _tableSettingsPath;
        private readonly string _statsPath;
        private readonly SemaphoreSlim _tableSettingsWriteGate = new(1, 1);
        private readonly SemaphoreSlim _statsWriteGate = new(1, 1);
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
        private bool _mainLockJsRegistered = false;
        private bool _popupLockJsRegistered = false;
        // Map ảnh cho từng ký tự
        private readonly Dictionary<char, ImageSource> _seqIconMap = new();

        private string _lastSeqTailShown = "";
        // Tổng tiền thắng lũy kế của phiên hiện tại
        private double _winTotal = 0;
        private CoreWebView2Environment? _webEnv;
        private bool _webInitDone;
        private const string Wv2ZipResNameX64 = "BaccaratWM.ThirdParty.WebView2Fixed_win-x64.zip";
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

        private const string GAME_TABLE_PUSH_JS = @"
(function(){
  try{
    if (window.__abxGameRoomPusher && typeof window.__abxGameRoomPusher.start === 'function') {
      try { window.__abxGameRoomPusher.start(1500); } catch (_) {}
      return;
    }
    var TITLE_SELECTORS = [
      'span.rY_sn','span.qL_qM.qL_qN','span.rC_rT','span.rW_sl',
      'div.ls_by','.tile-name','.game-title','div.abx-table-title'
    ];
    var ROOT_SELECTORS = [
      'div[id^=""TileHeight-""]','[data-table-id]','[data-tableid]',
      'div.gC_gE.gC_gH.gC_gI','div.hu_hv.hu_hy','div.he_hf.he_hi',
      'div.hC_hE','div.jF_jJ','div.ec_F','div.rW_rX','div.mx_G','div.kx_ky','div.kx_ca'
    ];
    var ROOT_SELECTOR = ROOT_SELECTORS.join(',');
    var lastSig = '';
    var lastPushAt = 0;
    var timerId = 0;
    var observer = null;
    var pending = 0;

    function cleanText(value){
      return String(value || '').replace(/\s+/g, ' ').trim();
    }

    function normText(value){
      try{
        return cleanText(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      }catch(_){
        return cleanText(value).toLowerCase();
      }
    }

    function isVisible(el){
      try{
        if (!el || !el.getBoundingClientRect) return false;
        var cur = el;
        while (cur && cur.nodeType === 1) {
          var st = window.getComputedStyle ? window.getComputedStyle(cur) : null;
          if (st && (st.display === 'none' || st.visibility === 'hidden' || st.opacity === '0')) return false;
          cur = cur.parentElement;
        }
        var rect = el.getBoundingClientRect();
        return rect.width >= 80 && rect.height >= 40 && rect.bottom >= 0 && rect.right >= 0;
      }catch(_){
        return false;
      }
    }

    function looksLikeRoomName(value){
      var text = cleanText(value);
      if (!text || text.length < 3 || text.length > 40) return false;
      var norm = normText(text);
      if (!norm) return false;
      if (/^no\s*:/.test(norm)) return false;
      if (/^(player|banker|tie|good trend|next p|next b|di vao|xu ly|quyet toan|settings?|options?)$/.test(norm)) return false;
      if (/^(so|b|p|t)\s*\d+$/i.test(text)) return false;
      if (/^\d+\s*-\s*\d+k$/i.test(text)) return false;
      if (/\d{6,}/.test(norm)) return false;
      if (/(sexy|bac|rong ho|roulette|tai xiu|nguu nguu|fantan|xoc dia|d&t|sd)/.test(norm)) return true;
      return /[a-zA-Z\u00C0-\u1EF9]/.test(text);
    }

    function extractRoomNameFromText(value){
      var text = cleanText(value);
      if (!text) return '';
      var norm = normText(text);
      if (!norm) return '';
      var patterns = [
        /\((?:sexy|speed)\)\s*bac\s*\d+/i,
        /\((?:sexy|speed)\)\s*sd\s*\d+/i,
        /\((?:sexy|speed)\)\s*d&?t\s*\d+/i,
        /rong\s*ho\s*\d+/i,
        /roulette\s*\d+/i,
        /tai\s*xiu\s*\d+/i,
        /nguu\s*nguu\s*\d+/i,
        /fantan\s*\d+/i,
        /xoc\s*dia\s*\d+/i,
        /bac\s*\d+/i
      ];
      for (var i = 0; i < patterns.length; i++) {
        var m = norm.match(patterns[i]);
        if (!m || !m[0]) continue;
        return cleanText(m[0]);
      }
      return looksLikeRoomName(text) ? text : '';
    }

    function rootOf(node){
      try{
        if (!node || !node.closest) return null;
        return node.closest(ROOT_SELECTOR) || node;
      }catch(_){
        return null;
      }
    }

    function readTitle(card){
      if (!card || !card.querySelectorAll) return '';
      for (var i = 0; i < TITLE_SELECTORS.length; i++) {
        try{
          var nodes = card.querySelectorAll(TITLE_SELECTORS[i]);
          for (var j = 0; j < nodes.length; j++) {
            var node = nodes[j];
            if (!isVisible(node)) continue;
            var text = cleanText(node.textContent || '');
            if (looksLikeRoomName(text)) return text;
          }
        }catch(_){}
      }
      var best = '';
      try{
        var fallbacks = card.querySelectorAll('span,div,small,button');
        for (var k = 0; k < fallbacks.length; k++) {
          var el = fallbacks[k];
          if (el.children && el.children.length > 0) continue;
          if (!isVisible(el)) continue;
          var value = cleanText(el.textContent || '');
          if (!looksLikeRoomName(value)) continue;
          if (!best || value.length < best.length) best = value;
        }
      }catch(_){}
      return best;
    }

    function collectRooms(){
      var rooms = [];
      var seen = new Set();
      var roots = new Set();
      function addRoomName(name){
        var roomName = extractRoomNameFromText(name);
        if (!roomName) return;
        var key = normText(roomName);
        if (!key || seen.has(key)) return;
        seen.add(key);
        rooms.push({ id: roomName, name: roomName });
      }

      try{
        document.querySelectorAll(ROOT_SELECTOR).forEach(function(card){
          if (card) roots.add(card);
        });
      }catch(_){}

      try{
        TITLE_SELECTORS.forEach(function(sel){
          document.querySelectorAll(sel).forEach(function(node){
            var card = rootOf(node);
            if (card) roots.add(card);
          });
        });
      }catch(_){}

      roots.forEach(function(card){
        try{
          if (!isVisible(card)) return;
          var name = readTitle(card);
          addRoomName(name);
        }catch(_){}
      });

      if (!rooms.length) {
        try{
          document.querySelectorAll('span,div,small,button').forEach(function(node){
            if (!node || (node.children && node.children.length > 0)) return;
            if (!isVisible(node)) return;
            addRoomName(node.textContent || '');
          });
        }catch(_){}
      }

      rooms.sort(function(a, b){
        return a.name.localeCompare(b.name);
      });
      return rooms;
    }

    function postRooms(force){
      try{
        var rooms = collectRooms();
        if (!rooms.length) return 0;
        var sig = rooms.map(function(room){ return room.id + '::' + room.name; }).join('|');
        var now = Date.now();
        if (!force && sig === lastSig && (now - lastPushAt) < 8000) return rooms.length;
        lastSig = sig;
        lastPushAt = now;
        var payload = {
          abx: 'table_update',
          ui: 'game',
          source: 'visible_cards',
          href: String(location.href || ''),
          title: String(document.title || ''),
          tables: rooms,
          ts: now
        };
        var text = JSON.stringify(payload);
        try{
          if (window.chrome && window.chrome.webview && typeof window.chrome.webview.postMessage === 'function') {
            window.chrome.webview.postMessage(text);
            return rooms.length;
          }
        }catch(_){}
        try{
          if (window.top && window.top !== window && typeof window.top.postMessage === 'function') {
            window.top.postMessage(payload, '*');
            return rooms.length;
          }
        }catch(_){}
        try{
          if (window.parent && window.parent !== window && typeof window.parent.postMessage === 'function') {
            window.parent.postMessage(payload, '*');
            return rooms.length;
          }
        }catch(_){}
        return rooms.length;
      }catch(_){
        return 0;
      }
    }

    function schedulePush(delay){
      try{
        if (pending) return;
        pending = setTimeout(function(){
          pending = 0;
          try { postRooms(false); } catch (_) {}
        }, Math.max(150, delay || 250));
      }catch(_){}
    }

    function start(ms){
      try{
        var interval = Math.max(1200, Math.floor(+ms || 1500));
        if (timerId) clearInterval(timerId);
        timerId = setInterval(function(){ try { postRooms(false); } catch (_) {} }, interval);
        if (!observer && window.MutationObserver && document.documentElement) {
          observer = new MutationObserver(function(){ schedulePush(250); });
          observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true });
        }
        schedulePush(50);
        return true;
      }catch(_){
        return false;
      }
    }

    function stop(){
      try{
        if (timerId) {
          clearInterval(timerId);
          timerId = 0;
        }
        if (observer) {
          observer.disconnect();
          observer = null;
        }
        if (pending) {
          clearTimeout(pending);
          pending = 0;
        }
      }catch(_){}
    }

    window.__abxGameRoomPusher = {
      start: start,
      stop: stop,
      pushNow: function(){ return postRooms(true); },
      collect: collectRooms
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function(){ try { start(1500); } catch (_) {} }, { once: true });
    }
    start(1500);
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
            _leaseSessionId = Guid.NewGuid().ToString("N");
            _tableSettingsPath = Path.Combine(_appDataDir, "tablesettings.json");
            _statsPath = Path.Combine(_appDataDir, "stats.json");

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
                    var targetWeb = GetActiveRoomHostWebView();
                    if (targetWeb?.CoreWebView2 != null)
                    {
                        var targetName = ReferenceEquals(targetWeb, _popupWeb) ? "PopupWeb" : "Web";
                        Log("[DevTools] open on " + targetName + ": " + (targetWeb.Source?.ToString() ?? "(null)"));
                        targetWeb.CoreWebView2.OpenDevToolsWindow();
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
            //EnqueueUi(line);
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
                var showTrialBadge = IsTrialModeRequestedOrActive();
                var showPanels = _manualDashboardOpened;

                if (showPanels)
                {
                    if (GroupLoginNav != null)
                        GroupLoginNav.Visibility = Visibility.Collapsed;

                    if (GroupStrategyMoney != null)
                        GroupStrategyMoney.Visibility = Visibility.Visible;
                    if (GroupConsole != null)
                        GroupConsole.Visibility = Visibility.Visible;
                    if (GroupStatus != null)
                        GroupStatus.Visibility = Visibility.Visible;
                    if (GroupStats != null)
                        GroupStats.Visibility = Visibility.Visible;
                    if (GroupRoomList != null)
                        GroupRoomList.Visibility = Visibility.Visible;

                    if (ChkTrial != null)
                        ChkTrial.Visibility = showTrialBadge ? Visibility.Visible : Visibility.Collapsed;

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

                    if (BtnVaoXocDia != null && !Equals(BtnVaoXocDia.Content as string, "Đăng Nhập Tool"))
                        BtnVaoXocDia.Content = "Đăng Nhập Tool";

                    if (GroupStrategyMoney != null)
                        GroupStrategyMoney.Visibility = Visibility.Collapsed;   // <--- sửa về Collapsed
                    if (GroupConsole != null)
                        GroupConsole.Visibility = Visibility.Collapsed;
                    if (GroupStatus != null)
                        GroupStatus.Visibility = Visibility.Collapsed;
                    if (GroupStats != null)
                        GroupStats.Visibility = Visibility.Collapsed;
                    if (GroupRoomList != null)
                        GroupRoomList.Visibility = Visibility.Collapsed;
                    if (ChkTrial != null)
                        ChkTrial.Visibility = Visibility.Collapsed;
                }
                }
            catch (Exception ex)
            {
                Log("[SetModeUi] " + ex);
            }
        }




        private string GetAiNGramStatePath()
        {
            // _appDataDir bạn đã tạo ở Startup: %LOCALAPPDATA%\BaccaratWM
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
            return;
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
            SetModeUi(false);
        }

        private WebView2? GetActiveRoomHostWebView()
        {
            if (PopupHost?.Visibility == Visibility.Visible && _popupWeb?.CoreWebView2 != null)
                return _popupWeb;
            return Web?.CoreWebView2 != null ? Web : null;
        }

        private async Task<bool> ExecuteOverlayScriptAsync(string script)
        {
            if (string.IsNullOrWhiteSpace(script))
                return false;

            var candidates = new List<WebView2?>();
            var active = GetActiveRoomHostWebView();
            if (active != null) candidates.Add(active);
            if (!ReferenceEquals(Web, active)) candidates.Add(Web);
            if (!ReferenceEquals(_popupWeb, active) && !ReferenceEquals(_popupWeb, Web)) candidates.Add(_popupWeb);

            foreach (var web in candidates)
            {
                if (web?.CoreWebView2 == null)
                    continue;
                try
                {
                    var scriptJson = JsonSerializer.Serialize(script);
                    var wrapped = $"(function(){{try{{return !!eval({scriptJson});}}catch(_ ){{return false;}}}})();";
                    var res = await web.ExecuteScriptAsync(wrapped);
                    var ok = string.Equals((res ?? "").Trim(), "true", StringComparison.OrdinalIgnoreCase);
                    if (ok)
                        return true;
                }
                catch { }
            }

            return false;
        }

        private async Task TryRequestVisibleRoomPushAsync(WebView2? targetWeb)
        {
            try
            {
                if (targetWeb?.CoreWebView2 == null)
                    return;

                const string js = @"(function(){
  try{
    var pushed = 0;
    try{
      if (window.__abxGameRoomPusher && typeof window.__abxGameRoomPusher.pushNow === 'function')
        pushed += (+window.__abxGameRoomPusher.pushNow() || 0);
    }catch(_){}
    try{
      Array.from(document.querySelectorAll('iframe')).forEach(function(fr){
        try{
          var w = fr.contentWindow;
          if (w && w.__abxGameRoomPusher && typeof w.__abxGameRoomPusher.pushNow === 'function')
            pushed += (+w.__abxGameRoomPusher.pushNow() || 0);
        }catch(_){}
      });
    }catch(_){}
    return String(pushed);
  }catch(_){
    return '0';
  }
})();";

                await targetWeb.ExecuteScriptAsync(js);
            }
            catch { }
        }

        private async Task<(List<RoomEntry> Rooms, string Source)> TryCollectRoomsViaInjectedCollectorsAsync(WebView2? targetWeb)
        {
            try
            {
                if (targetWeb?.CoreWebView2 == null)
                    return (new List<RoomEntry>(), "");

                const string js = @"(function(){
  try{
    function pickTables(raw){
      if (!raw) return [];
      if (Array.isArray(raw)) return raw;
      if (Array.isArray(raw.tables)) return raw.tables;
      return [];
    }
    function collect(win, label){
      var out = { source: label, tables: [], error: '', href: '', title: '', hw: false, gp: false };
      try{
        if (!win) return out;
        try{ out.href = String((win.location && win.location.href) || ''); }catch(_){}
        try{ out.title = String((win.document && win.document.title) || ''); }catch(_){}
        out.hw = !!(win && typeof win.__abx_hw_collectTables === 'function');
        out.gp = !!(win && win.__abxGameRoomPusher && typeof win.__abxGameRoomPusher.collect === 'function');
        if (typeof win.__abx_hw_collectTables === 'function'){
          var hw = pickTables(win.__abx_hw_collectTables());
          if (hw.length){
            out.source = label + '/__abx_hw_collectTables';
            out.tables = hw;
            return out;
          }
        }
        if (win.__abxGameRoomPusher && typeof win.__abxGameRoomPusher.collect === 'function'){
          var gp = pickTables(win.__abxGameRoomPusher.collect());
          if (gp.length){
            out.source = label + '/__abxGameRoomPusher.collect';
            out.tables = gp;
            return out;
          }
        }
      }catch(err){
        out.error = String((err && err.message) || err || '');
      }
      return out;
    }
    var results = [];
    results.push(collect(window, 'top'));
    try{
      Array.from(document.querySelectorAll('iframe')).forEach(function(fr, idx){
        try{
          results.push(collect(fr.contentWindow, 'iframe[' + idx + ']'));
        }catch(err){
          results.push({ source: 'iframe[' + idx + ']', tables: [], error: String((err && err.message) || err || '') });
        }
      });
    }catch(err){
      results.push({ source: 'iframes', tables: [], error: String((err && err.message) || err || '') });
    }
    var best = { source: '', tables: [], error: '' };
    results.forEach(function(item){
      if ((item.tables || []).length > (best.tables || []).length)
        best = item;
    });
    return { best: best, results: results };
  }catch(err){
    return { best: { source: 'collector-error', tables: [], error: String((err && err.message) || err || '') }, results: [] };
  }
})();";

                var raw = await targetWeb.ExecuteScriptAsync(js);
                if (string.IsNullOrWhiteSpace(raw))
                    return (new List<RoomEntry>(), "");

                using var doc = JsonDocument.Parse(raw);
                if (!doc.RootElement.TryGetProperty("best", out var best))
                    return (new List<RoomEntry>(), "");

                var source = best.TryGetProperty("source", out var sourceEl)
                    ? (sourceEl.GetString() ?? "").Trim()
                    : "";

                var rooms = new List<RoomEntry>();
                if (best.TryGetProperty("tables", out var tablesEl) && tablesEl.ValueKind == JsonValueKind.Array)
                {
                    foreach (var it in tablesEl.EnumerateArray())
                    {
                        var id = it.TryGetProperty("id", out var idEl) ? (idEl.GetString() ?? "").Trim() : "";
                        var name = it.TryGetProperty("name", out var nameEl) ? (nameEl.GetString() ?? "").Trim() : "";
                        if (string.IsNullOrWhiteSpace(id) && string.IsNullOrWhiteSpace(name))
                            continue;
                        rooms.Add(new RoomEntry
                        {
                            Id = string.IsNullOrWhiteSpace(id) ? name : id,
                            Name = string.IsNullOrWhiteSpace(name) ? id : name
                        });
                    }
                }

                if (doc.RootElement.TryGetProperty("results", out var resultsEl) && resultsEl.ValueKind == JsonValueKind.Array)
                {
                    var parts = new List<string>();
                    foreach (var item in resultsEl.EnumerateArray())
                    {
                        var label = item.TryGetProperty("source", out var labelEl) ? (labelEl.GetString() ?? "").Trim() : "?";
                        var count = item.TryGetProperty("tables", out var arrEl) && arrEl.ValueKind == JsonValueKind.Array ? arrEl.GetArrayLength() : 0;
                        var err = item.TryGetProperty("error", out var errEl) ? (errEl.GetString() ?? "").Trim() : "";
                        var href = item.TryGetProperty("href", out var hrefEl) ? (hrefEl.GetString() ?? "").Trim() : "";
                        var hw = item.TryGetProperty("hw", out var hwEl) && hwEl.ValueKind is JsonValueKind.True or JsonValueKind.False && hwEl.GetBoolean();
                        var gp = item.TryGetProperty("gp", out var gpEl) && gpEl.ValueKind is JsonValueKind.True or JsonValueKind.False && gpEl.GetBoolean();
                        var msg = $"{label}:{count} hw={(hw ? 1 : 0)} gp={(gp ? 1 : 0)}";
                        if (!string.IsNullOrWhiteSpace(href))
                            msg += " href=" + href;
                        if (!string.IsNullOrWhiteSpace(err))
                            msg += " err=" + err;
                        parts.Add(msg);
                    }
                    Log("[ROOMDBG][DirectCollect] " + string.Join(" | ", parts.Take(8)));
                }

                if (rooms.Count == 0)
                    return (new List<RoomEntry>(), "");

                return (rooms, string.IsNullOrWhiteSpace(source) ? "direct/table_update" : ("direct:" + source + " via table_update"));
            }
            catch
            {
                return (new List<RoomEntry>(), "");
            }
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

                var targetWeb = GetActiveRoomHostWebView();
                if (targetWeb == null)
                {
                    if (userTriggered) Log("[ROOM] WebView chưa sẵn sàng.");
                    return;
                }

                if (ReferenceEquals(targetWeb, Web))
                    await EnsureWebReadyAsync();

                targetWeb = GetActiveRoomHostWebView();
                if (targetWeb?.CoreWebView2 == null)
                {
                    if (userTriggered) Log("[ROOM] CoreWebView2 chưa khởi tạo.");
                    return;
                }

                var popupRoomHost = ReferenceEquals(targetWeb, _popupWeb) && PopupHost?.Visibility == Visibility.Visible;

                var js = @"(function(){
  try{
    const titleSelectors = ['span.rC_rT','span.rW_sl','span.rY_sn','span.qL_qM.qL_qN','.tile-name','.game-title','.ls_by'];
    const cardSelectors = ['div[id^=""TileHeight-""]','div.gC_gE.gC_gH.gC_gI','div.hu_hv.hu_hy'];
    const heuristicSelectors = ['div.pu_pv','div.uH_gQ','svg use[href^=""#bigroad-""]','svg use[*|href^=""#bigroad-""]','svg [href^=""#bigroad-""]'];
    const idAttrs = ['id','data-table-id','data-id','data-game-id','data-tableid','data-table','data-table-name','data-tablename'];
    const nameAttrs = ['data-table-name','data-tablename','data-tabletitle','data-table-title','data-title','data-name','data-display-name','data-displayname','data-label','aria-label','title','alt'];
    const noiseWords = ['PLAYER','BANKER','TIE','BET','BETTING','RESULT','WIN','LOSS','TOTAL','ODDS','PAIR','TABLE SETTINGS','SETTINGS','SETTING','OPTIONS'];
    const overlaySkipSelector = '.abx-homewatch-root,[data-abx-root=""homewatch""],#__abx_hw_root,#__abx_table_overlay_root';
    const normalizeText = (s)=> clean(s).replace(/\s+/g,' ').trim();
    const normalizeKey = (s)=>{
      try{
        return normalizeText(s).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
      }catch(_){
        return normalizeText(s).toLowerCase();
      }
    };
    const isNameCandidate = (t)=>{
      if(!t) return false;
      const u = t.toUpperCase();
      if(u.length < 3 || u.length > 40) return false;
      if(/\d{6,}/.test(u)) return false;
      for(const w of noiseWords){
        if(u.includes(w)) return false;
      }
      return true;
    };
    const findNameFromAttrs = (card)=>{
      if(!card || !card.querySelectorAll) return '';
      let best = '';
      const nodes = card.querySelectorAll('[data-table-name],[data-tablename],[data-tabletitle],[data-table-title],[data-title],[data-name],[data-display-name],[data-displayname],[data-label],[aria-label],[title],[alt]');
      for(const el of nodes){
        if(el.closest && el.closest(overlaySkipSelector)) continue;
        const val = extractName(el, false);
        if(!val) continue;
        const key = normalizeKey(val);
        if(key.includes('baccarat')) return val;
        if(!isNameCandidate(val)) continue;
        if(!best || val.length < best.length) best = val;
      }
      return best;
    };
    const findNameFromTextNodes = (card)=>{
      if(!card || !card.querySelectorAll) return '';
      let best = '';
      let bestKeyword = '';
      const nodes = card.querySelectorAll('span,div,small,button');
      for(const el of nodes){
        if(el.children && el.children.length) continue;
        if(el.closest && el.closest(overlaySkipSelector)) continue;
        const t = normalizeText(el.textContent || '');
        if(!t) continue;
        const u = t.toUpperCase();
        const k = normalizeKey(t);
        if(k.includes('baccarat')){
          if(!bestKeyword || t.length < bestKeyword.length) bestKeyword = t;
          continue;
        }
        if(!isNameCandidate(t)) continue;
        if(!best || t.length < best.length) best = t;
      }
      return bestKeyword || best;
    };
    const seen = new Set();
    const rooms = [];
    const clean = (s)=> (s||'').trim();
    const resolveRoot = (el)=>{
      if(!el) return null;
      return el.closest('div[id^=""TileHeight-""]') ||
             el.closest('div.gC_gE.gC_gH.gC_gI') ||
             el.closest('div.he_hf.he_hi') ||
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
    const extractName = (el, allowText)=>{
      if(!el) return '';
      for(const a of nameAttrs){
        try{
          const v = clean(el.getAttribute && el.getAttribute(a));
          if(v) return v;
        }catch(_){}
      }
      if(allowText){
        const text = normalizeText(el.innerText || el.textContent || '');
        return text;
      }
      return '';
    };
    const extractNameFromCard = (card)=>{
      if(!card || !card.querySelector) return '';
      for(const sel of titleSelectors){
        try{
          const node = card.querySelector(sel);
          const name = extractName(node, true);
          if(name) return name;
        }catch(_){}
      }
      const attrName = findNameFromAttrs(card);
      if(attrName) return attrName;
      const fallback = findNameFromTextNodes(card);
      if(fallback) return fallback;
      return '';
    };
    const addRoom = (id, name)=>{
      const rid = clean(id) || clean(name);
      const rname = clean(name) || clean(id);
      if(!rid || !rname) return;
      const key = rid.toLowerCase();
      if(seen.has(key)) return;
      seen.add(key);
      rooms.push({ id: rid, name: rname });
    };
    const addRoomFromCard = (card)=>{
      if(!card) return;
      const id = extractId(card);
      const name = extractNameFromCard(card);
      addRoom(id, name || id);
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
              const name = extractName(el, true);
              if(!name) return;
              const card = resolveRoot(el);
              const id = extractId(card) || extractId(el);
              addRoom(id, name);
            });
          }catch(_){}
        });
      });
    };
    const scanCards = (root)=>{
      if(!root) return;
      try{
        cardSelectors.forEach(sel=>{
          root.querySelectorAll(sel).forEach(card=>{
            addRoomFromCard(card);
          });
        });
      }catch(_){}
    };
    const scanHeuristic = (root)=>{
      if(!root) return;
      try{
        const sel = heuristicSelectors.join(',');
        root.querySelectorAll(sel).forEach(node=>{
          const card = (node.closest && node.closest(cardSelectors.join(','))) || resolveRoot(node);
          if(card) addRoomFromCard(card);
        });
      }catch(_){}
    };
    scanDocument(document);
    scanCards(document);
    if(rooms.length < 5) scanHeuristic(document);
    const iframes = Array.from(document.querySelectorAll('iframe'));
    for(const fr of iframes){
      try{
        const doc = fr.contentDocument || fr.contentWindow?.document;
        scanDocument(doc);
        scanCards(doc);
        if(rooms.length < 5) scanHeuristic(doc);
      }catch(_){}
    }
    return rooms;
  }catch(e){ return []; }
})();";

                List<RoomEntry> list = new();
                var roomSource = "protocol21-mapped";

                const int networkAttempts = 10;
                for (int attempt = 0; attempt < networkAttempts; attempt++)
                {
                    if (popupRoomHost && TryGetVisibleProtocol21Rooms(out var seededRooms, out var seededSource))
                    {
                        list = seededRooms;
                        roomSource = seededSource;
                        break;
                    }

                    await Task.Delay(350);
                }

                if (list.Count == 0 && !popupRoomHost)
                {
                    if (popupRoomHost && TryGetVisibleProtocol21Rooms(out var protocolRooms, out var protocolSource))
                    {
                        list = protocolRooms;
                        roomSource = protocolSource;
                    }


                    const int maxAttempts = 15;
                    for (int attempt = 0; attempt < maxAttempts; attempt++)
                    {
                        if (list.Count > 0)
                            break;

                        var raw = await targetWeb.ExecuteScriptAsync(js);
                        list = string.IsNullOrWhiteSpace(raw)
                            ? new List<RoomEntry>()
                            : (JsonSerializer.Deserialize<List<RoomEntry>>(raw) ?? new List<RoomEntry>());

                        if (list.Count > 0) break;
                        await Task.Delay(600); // chờ DOM lobby load
                    }

                    if (list.Count == 0 && popupRoomHost)
                    {
                        list = await TryGetVisibleLobbyRoomsAsync(targetWeb);
                        if (list.Count > 0)
                            roomSource = "dom-visible-text";
                    }
                }

                if (!popupRoomHost && list.Count > 0 && roomSource.IndexOf("protocol21", StringComparison.OrdinalIgnoreCase) >= 0)
                {
                    var visibleRooms = await TryGetVisibleLobbyRoomsAsync(targetWeb);
                    if (visibleRooms.Count > 0)
                    {
                        var visibleByKey = visibleRooms
                            .Select(r => new { Room = r, Key = BuildRoomMatchKey(r.Id, r.Name) })
                            .Where(x => !string.IsNullOrWhiteSpace(x.Key))
                            .GroupBy(x => x.Key, StringComparer.Ordinal)
                            .ToDictionary(g => g.Key, g => g.First().Room, StringComparer.Ordinal);

                        var matched = list
                            .Select(room =>
                            {
                                var key = BuildRoomMatchKey(room.Id, room.Name);
                                if (string.IsNullOrWhiteSpace(key))
                                    return null;
                                if (!visibleByKey.TryGetValue(key, out var visible))
                                    return null;
                                return new RoomEntry
                                {
                                    Id = string.IsNullOrWhiteSpace(visible.Id) ? room.Id : visible.Id,
                                    Name = string.IsNullOrWhiteSpace(visible.Name) ? room.Name : visible.Name
                                };
                            })
                            .Where(room => room != null)
                            .Cast<RoomEntry>()
                            .ToList();

                        Log($"[ROOMDBG][VisibleFilter] protocol21 raw={list.Count} visible={visibleRooms.Count} matched={matched.Count} sample={Sample(matched.Select(r => r.Name))}");
                        if (matched.Count > 0)
                        {
                            list = matched;
                            roomSource += " +visible";
                        }
                    }
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
                    .GroupBy(x => TextNorm.U(x.Name), StringComparer.Ordinal)
                    .Select(g =>
                    {
                        if (g.Count() == 1)
                            return g.First();
                        RoomEntry? best = null;
                        int bestScore = int.MinValue;
                        foreach (var item in g)
                        {
                            var score = 0;
                            if (!string.IsNullOrWhiteSpace(item.Id) && !string.Equals(item.Id, item.Name, StringComparison.OrdinalIgnoreCase))
                                score += 2;
                            if (!string.IsNullOrWhiteSpace(item.Id) && item.Id.StartsWith("TileHeight-", StringComparison.OrdinalIgnoreCase))
                                score += 1;
                            if (score > bestScore)
                            {
                                bestScore = score;
                                best = item;
                            }
                        }
                        return best ?? g.First();
                    })
                    .Where(x => x != null)
                    .OrderBy(x => BuildRoomDisplaySortKey(x.Name), StringComparer.Ordinal)
                    .ToList();

                var filtered = clean.Where(room => !IsLobbyNoiseName(room.Name)).ToList();
                if (clean.Count != filtered.Count)
                    Log($"[ROOMDBG][RefreshRoomList] filtered out {clean.Count - filtered.Count} noise names");
                string Sample(IEnumerable<string> xs, int take = 6)
                {
                    var arr = xs?.Where(s => !string.IsNullOrWhiteSpace(s)).Select(s => s.Trim()).Take(take).ToArray() ?? Array.Empty<string>();
                    return arr.Length == 0 ? "(rỗng)" : string.Join(" | ", arr);
                }
                Log($"[ROOMDBG][RefreshRoomList] source={roomSource} clean={filtered.Count} sample={Sample(filtered.Select(r => r.Name))}");

                if (filtered.Count == 0)
                {
                    Log("[ROOM] Không tìm thấy bàn từ feed protocol35/protocol21. Hãy thử bấm 'Lấy danh sách bàn' sau khi sàn tải xong.");
                }
                else
                {
                    bool accepted = false;
                    bool changed = false;
                    var src = targetWeb?.CoreWebView2?.Source ?? targetWeb?.Source?.ToString() ?? "";
                    var srcLower = src.ToLowerInvariant();
                    var protocol21Feed = roomSource.IndexOf("protocol21", StringComparison.OrdinalIgnoreCase) >= 0;
                    var tableUpdateFeed = roomSource.IndexOf("table_update", StringComparison.OrdinalIgnoreCase) >= 0;
                    var popupVisibleDomFeed = popupRoomHost &&
                        (string.Equals(roomSource, "dom", StringComparison.OrdinalIgnoreCase) ||
                         roomSource.IndexOf("dom-visible", StringComparison.OrdinalIgnoreCase) >= 0);
                    bool pathLooksLikeLobby =
                        srcLower.Contains("/lobby") ||
                        srcLower.Contains("/lobby2") ||
                        (srcLower.Contains("/desktop/") && srcLower.Contains("multibaccarat"));
                    var inLobby = srcLower.Contains("pragmaticplaylive") && pathLooksLikeLobby;
                    var looksLikeBaccarat = filtered.Any(n => TextNorm.U(n.Name).Contains("BACCARAT"));
                    if (!looksLikeBaccarat)
                        looksLikeBaccarat = filtered.Any(n => (n.Id ?? "").StartsWith("TileHeight-", StringComparison.OrdinalIgnoreCase));
                    if (!looksLikeBaccarat && inLobby && filtered.Count >= 10)
                        looksLikeBaccarat = true;
                    var beforeSig = BuildRoomsSignature(_selectedRooms);

                    await Dispatcher.InvokeAsync(() =>
                    {
                        if (!protocol21Feed && !tableUpdateFeed && !popupVisibleDomFeed && (!inLobby || !looksLikeBaccarat))
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

        private async Task<List<RoomEntry>> TryGetVisibleLobbyRoomsAsync(WebView2 targetWeb)
        {
            try
            {
                if (targetWeb?.CoreWebView2 == null)
                    return new List<RoomEntry>();

                var js = @"(function(){
  try{
    const cardSelectors = [
      '[data-table-id]','[data-tableid]','div[id^=""TileHeight-""]',
      'div.gC_gE.gC_gH.gC_gI','div.hu_hv.hu_hy','div.he_hf.he_hi',
      'div.hC_hE','div.hC_hE.hC_hH','div.jF_jJ','div.ec_F','div.rW_rX','div.mx_G',
      'div.kx_ky','div.kx_ca','div.eB_eC.tile-container-wrapper','div.ep_bn',
      'div.hu_hw','div.hq_hr','div.cU_cV','.qW_rl'
    ];
    const titleSelectors = ['.rC_rT','.rC_rE span','.rY_sn','.rW_sl','.tile-name','.title','.game-title','.ls_by','div.abx-table-title','span.qL_qM.qL_qN'];
    const clean = (s)=>(s||'').replace(/\s+/g,' ').trim();
    const norm = (s)=>{
      try{
        return clean(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
      }catch(_){
        return clean(s).toLowerCase();
      }
    };
    const rooms = [];
    const seen = new Set();
    const isVisible = (el)=>{
      try{
        if(!el) return false;
        const st = window.getComputedStyle ? window.getComputedStyle(el) : null;
        if(st && (st.display === 'none' || st.visibility === 'hidden' || st.opacity === '0')) return false;
        const rect = el.getBoundingClientRect();
        return rect.width >= 40 && rect.height >= 40;
      }catch(_){ return false; }
    };
    const getId = (el)=>{
      if(!el) return '';
      return clean(el.getAttribute && el.getAttribute('data-table-id')) ||
             clean(el.getAttribute && el.getAttribute('data-tableid')) ||
             clean(el.dataset && (el.dataset.tableId || el.dataset.tableid)) ||
             clean(el.id);
    };
    const getName = (card)=>{
      if(!card) return '';
      for(const sel of titleSelectors){
        try{
          const nodes = Array.from(card.querySelectorAll(sel));
          for(const node of nodes){
            const text = clean(node && node.textContent);
            if(text) return text;
          }
        }catch(_){}
      }
      return clean(card.getAttribute && (card.getAttribute('data-table-name') || card.getAttribute('data-name') || card.getAttribute('title')));
    };
    const extractRoomName = (value)=>{
      const raw = clean(value);
      if(!raw) return '';
      const text = norm(raw);
      const patterns = [
        /\((?:sexy|speed)\)\s*bac\s*\d+/i,
        /\((?:sexy|speed)\)\s*sd\s*\d+/i,
        /\((?:sexy|speed)\)\s*d&?t\s*\d+/i,
        /rong\s*ho\s*\d+/i,
        /roulette\s*\d+/i,
        /tai\s*xiu\s*\d+/i,
        /nguu\s*nguu\s*\d+/i,
        /fantan\s*\d+/i,
        /xoc\s*dia\s*\d+/i,
        /bac\s*\d+/i
      ];
      for(const re of patterns){
        const m = text.match(re);
        if(m && m[0]) return clean(m[0]);
      }
      return '';
    };
    const addRoom = (id, name)=>{
      const roomName = extractRoomName(name || id || '');
      if(!roomName) return;
      const roomId = clean(id) || roomName;
      const key = norm(roomName);
      if(!key || seen.has(key)) return;
      seen.add(key);
      rooms.push({ id: roomId, name: roomName });
    };
    const roots = new Set();
    for(const sel of cardSelectors){
      try{
        document.querySelectorAll(sel).forEach(el=>{
          const card = (el.closest && (el.closest('div[id^=""TileHeight-""]') || el.closest('[data-table-id]') || el.closest('[data-tableid]'))) || el;
          if(card) roots.add(card);
        });
      }catch(_){}
    }
    roots.forEach(card=>{
      if(!isVisible(card)) return;
      const id = getId(card);
      const name = getName(card);
      addRoom(id, name);
    });
    if(!rooms.length){
      document.querySelectorAll('span,div,small,button').forEach(node=>{
        if(!node || (node.children && node.children.length > 0)) return;
        if(!isVisible(node)) return;
        addRoom('', node.textContent || '');
      });
    }
    return rooms;
  }catch(_){
    return [];
  }
})();";

                var raw = await targetWeb.ExecuteScriptAsync(js);
                var list = string.IsNullOrWhiteSpace(raw)
                    ? new List<RoomEntry>()
                    : (JsonSerializer.Deserialize<List<RoomEntry>>(raw) ?? new List<RoomEntry>());

                return list
                    .Where(r => !string.IsNullOrWhiteSpace(r.Id) || !string.IsNullOrWhiteSpace(r.Name))
                    .ToList();
            }
            catch
            {
                return new List<RoomEntry>();
            }
        }

        private static string BuildRoomMatchKey(string? id, string? name)
        {
            var rawId = (id ?? "").Trim();
            if (!string.IsNullOrWhiteSpace(rawId))
            {
                var digits = new string(rawId.Where(char.IsDigit).ToArray());
                if (!string.IsNullOrWhiteSpace(digits))
                {
                    digits = digits.TrimStart('0');
                    return "ID:" + (string.IsNullOrWhiteSpace(digits) ? "0" : digits);
                }

                return "IDTXT:" + TextNorm.U(rawId);
            }

            var normName = TextNorm.U(name ?? "");
            return string.IsNullOrWhiteSpace(normName) ? "" : "NM:" + normName;
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
                if (MigrateLegacySeqToPb(_cfg))
                    _ = SaveConfigAsync();
                _homeUsername = _cfg.LastHomeUsername;
                // Sinh / nạp clientId cố định cho lease
                _leaseClientId = string.IsNullOrWhiteSpace(_cfg.LeaseClientId)
                    ? (_cfg.LeaseClientId = Guid.NewGuid().ToString("N"))
                    : _cfg.LeaseClientId;
                EnsureDeviceId();
                EnsureTrialKey();

                if (string.IsNullOrWhiteSpace(_cfg.Url))
                    _cfg.Url = DEFAULT_URL;
                var normalizedStartupUrl = NormalizePreferredStartupUrl(_cfg.Url, logChange: !string.IsNullOrWhiteSpace(_cfg.Url));
                if (!string.Equals(normalizedStartupUrl, _cfg.Url, StringComparison.OrdinalIgnoreCase))
                {
                    _cfg.Url = normalizedStartupUrl;
                    _ = SaveConfigAsync();
                }
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
                if (ChkAutoResetOnCut != null) ChkAutoResetOnCut.IsChecked = _cfg.AutoResetOnCut;
                if (ChkAutoResetOnWinGeTotal != null) ChkAutoResetOnWinGeTotal.IsChecked = _cfg.AutoResetOnWinGeTotal;
                if (ChkWaitCutLossBeforeBet != null) ChkWaitCutLossBeforeBet.IsChecked = _cfg.WaitCutLossBeforeBet;


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

                if (ChkTrial != null) ChkTrial.IsChecked = IsTrialModeRequestedOrActive();
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
                _cfg.UseTrial = IsTrialModeRequestedOrActive();
                _cfg.LeaseClientId = _leaseClientId;
                _cfg.MoneyStrategy = GetMoneyStrategyFromUI();
                if (ChkS7ResetOnProfit != null)
                    _cfg.S7ResetOnProfit = (ChkS7ResetOnProfit.IsChecked == true);
                if (ChkAutoResetOnCut != null)
                    _cfg.AutoResetOnCut = (ChkAutoResetOnCut.IsChecked == true);
                if (ChkAutoResetOnWinGeTotal != null)
                    _cfg.AutoResetOnWinGeTotal = (ChkAutoResetOnWinGeTotal.IsChecked == true);
                if (ChkWaitCutLossBeforeBet != null)
                    _cfg.WaitCutLossBeforeBet = (ChkWaitCutLossBeforeBet.IsChecked == true);
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
                Extra = null,
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
                snapshot.BetSeqPB = _globalCfgSnapshot.BetSeqPB ?? "";
                snapshot.BetSeqNI = _globalCfgSnapshot.BetSeqNI ?? "";
                snapshot.BetPatternsPB = _globalCfgSnapshot.BetPatternsPB ?? "";
                snapshot.BetPatternsNI = _globalCfgSnapshot.BetPatternsNI ?? "";
                snapshot.MoneyStrategy = _globalCfgSnapshot.MoneyStrategy ?? "IncreaseWhenLose";
                snapshot.StakeCsv = _globalCfgSnapshot.StakeCsv ?? "";
                snapshot.StakeCsvByMoney = _globalCfgSnapshot.StakeCsvByMoney != null
                    ? new Dictionary<string, string>(_globalCfgSnapshot.StakeCsvByMoney, StringComparer.OrdinalIgnoreCase)
                    : new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                snapshot.S7ResetOnProfit = _globalCfgSnapshot.S7ResetOnProfit;
            }
            snapshot.AutoResetOnCut = _cfg?.AutoResetOnCut ?? false;
            snapshot.AutoResetOnWinGeTotal = _cfg?.AutoResetOnWinGeTotal ?? false;
            snapshot.WaitCutLossBeforeBet = _cfg?.WaitCutLossBeforeBet ?? false;
            return snapshot;
        }

        private static string? ReadExtensionString(Dictionary<string, JsonElement>? extra, string key)
        {
            if (extra == null || !extra.TryGetValue(key, out var el))
                return null;
            return el.ValueKind == JsonValueKind.String ? el.GetString() : el.ToString();
        }

        private static bool MigrateLegacySeqToPb(AppConfig cfg)
        {
            bool changed = false;
            const string LegacySeqKey = "BetSeqCL";
            const string LegacyPatternKey = "BetPatternsCL";
            var oldSeq = ReadExtensionString(cfg.Extra, LegacySeqKey);
            var oldPat = ReadExtensionString(cfg.Extra, LegacyPatternKey);

            if (string.IsNullOrWhiteSpace(cfg.BetSeqPB) && !string.IsNullOrWhiteSpace(oldSeq))
            {
                cfg.BetSeqPB = NormalizePBInput(oldSeq);
                changed = true;
            }
            if (string.IsNullOrWhiteSpace(cfg.BetPatternsPB) && !string.IsNullOrWhiteSpace(oldPat))
            {
                cfg.BetPatternsPB = NormalizePBInput(oldPat);
                changed = true;
            }

            if (cfg.Extra != null)
            {
                cfg.Extra.Remove(LegacySeqKey);
                cfg.Extra.Remove(LegacyPatternKey);
                if (cfg.Extra.Count == 0)
                    cfg.Extra = null;
            }

            return changed;
        }

        private static bool MigrateLegacySeqToPb(TableSetting setting)
        {
            bool changed = false;
            const string LegacySeqKey = "BetSeqCL";
            const string LegacyPatternKey = "BetPatternsCL";
            var oldSeq = ReadExtensionString(setting.Extra, LegacySeqKey);
            var oldPat = ReadExtensionString(setting.Extra, LegacyPatternKey);

            if (string.IsNullOrWhiteSpace(setting.BetSeqPB) && !string.IsNullOrWhiteSpace(oldSeq))
            {
                setting.BetSeqPB = NormalizePBInput(oldSeq);
                changed = true;
            }
            if (string.IsNullOrWhiteSpace(setting.BetPatternsPB) && !string.IsNullOrWhiteSpace(oldPat))
            {
                setting.BetPatternsPB = NormalizePBInput(oldPat);
                changed = true;
            }

            if (setting.Extra != null)
            {
                setting.Extra.Remove(LegacySeqKey);
                setting.Extra.Remove(LegacyPatternKey);
                if (setting.Extra.Count == 0)
                    setting.Extra = null;
            }

            return changed;
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
                    bool migrated = false;
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
                        if (MigrateLegacySeqToPb(it))
                            migrated = true;
                        if (!map.ContainsKey(id))
                            map[id] = it;
                    }

                    _tableSettings = new TableSettingsFile
                    {
                        Version = loaded.Version,
                        Tables = map.Values.ToList()
                    };
                    Log("Loaded table settings: " + _tableSettingsPath);
                    if (migrated)
                        _ = TriggerTableSettingsSaveDebouncedAsync();
                }
            }
            catch (Exception ex)
            {
                Log("[LoadTableSettings] " + ex);
                _tableSettings = new TableSettingsFile();
            }
        }

        private TabStats GetOrCreateStatsForTable(string tableId)
        {
            if (string.IsNullOrWhiteSpace(tableId))
                return new TabStats();
            if (_statsByTable.TryGetValue(tableId, out var stats))
                return stats;
            stats = new TabStats();
            _statsByTable[tableId] = stats;
            return stats;
        }

        private void SyncStatsRootFromTables()
        {
            _statsRoot.Tables ??= new List<StatsItem>();
            _statsRoot.Tables = _statsByTable
                .Select(kv => new StatsItem { TableId = kv.Key, Stats = kv.Value ?? new TabStats() })
                .ToList();
        }

        private void LoadStats()
        {
            try
            {
                if (!string.IsNullOrEmpty(_statsPath) && File.Exists(_statsPath))
                {
                    var json = File.ReadAllText(_statsPath, Encoding.UTF8);
                    _statsRoot = JsonSerializer.Deserialize<StatsRoot>(json) ?? new StatsRoot();
                    Log("Loaded stats: " + _statsPath);
                }
            }
            catch (Exception ex)
            {
                Log("[LoadStats] " + ex);
            }

            _statsRoot ??= new StatsRoot();
            _statsRoot.Tables ??= new List<StatsItem>();
            _statsByTable.Clear();
            foreach (var item in _statsRoot.Tables)
            {
                if (string.IsNullOrWhiteSpace(item?.TableId)) continue;
                _statsByTable[item.TableId] = item.Stats ?? new TabStats();
            }

            UpdateStatsUiForActiveTable();
        }

        private async Task SaveStatsAsync()
        {
            if (string.IsNullOrEmpty(_statsPath)) return;

            await _statsWriteGate.WaitAsync();
            try
            {
                SyncStatsRootFromTables();

                var dir = Path.GetDirectoryName(_statsPath);
                if (!string.IsNullOrEmpty(dir)) Directory.CreateDirectory(dir);

                var json = JsonSerializer.Serialize(_statsRoot, new JsonSerializerOptions { WriteIndented = true });
                var tmp = _statsPath + ".tmp";
                await File.WriteAllTextAsync(tmp, json, Encoding.UTF8);
                File.Move(tmp, _statsPath, true);
            }
            catch (Exception ex) { Log("[SaveStats] " + ex); }
            finally { _statsWriteGate.Release(); }
        }

        private void UpdateStatsUiForActiveTable()
        {
            UpdateStatsUiAggregated();
        }

        private void UpdateStatsUi(TableTaskState state)
        {
            UpdateStatsUiAggregated();
        }

        private void UpdateStatsUi(TabStats s)
        {
            if (LblStatStreak != null)
                LblStatStreak.Text = $"{s.MaxWinStreak}/{s.MaxLossStreak}";
            if (LblStatTotalWinLoss != null)
                LblStatTotalWinLoss.Text = $"{s.TotalWinCount}/{s.TotalLossCount}";
            if (LblStatTotalBet != null)
                LblStatTotalBet.Text = s.TotalBetAmount.ToString("N0");
            if (LblStatTotalProfit != null)
                LblStatTotalProfit.Text = s.TotalProfit.ToString("N0");
        }

        private TabStats BuildAggregatedStats()
        {
            var agg = new TabStats();
            foreach (var stats in _statsByTable.Values)
            {
                agg.TotalWinCount += stats.TotalWinCount;
                agg.TotalLossCount += stats.TotalLossCount;
                agg.TotalBetAmount += stats.TotalBetAmount;
                agg.TotalProfit += stats.TotalProfit;
                if (stats.MaxWinStreak > agg.MaxWinStreak)
                    agg.MaxWinStreak = stats.MaxWinStreak;
                if (stats.MaxLossStreak > agg.MaxLossStreak)
                    agg.MaxLossStreak = stats.MaxLossStreak;
            }
            return agg;
        }

        private void UpdateStatsUiAggregated()
        {
            var s = BuildAggregatedStats();
            UpdateStatsUi(s);
        }

        private void UpdateTableStatsStake(TableTaskState state, double amount)
        {
            var rounded = (long)Math.Round(amount);
            if (rounded > 0)
                state.Stats.TotalBetAmount += rounded;
            _statsByTable[state.TableId] = state.Stats;
            UpdateStatsUiAggregated();
            _ = SaveStatsAsync();
        }

        private void UpdateTableStatsWin(TableTaskState state, double net)
        {
            state.Stats.TotalProfit += net;
            _statsByTable[state.TableId] = state.Stats;
            UpdateStatsUiAggregated();
            _ = SaveStatsAsync();
        }

        private void UpdateTableStatsWinLoss(TableTaskState state, bool? result)
        {
            if (!result.HasValue) return;
            if (result.Value)
            {
                state.Stats.TotalWinCount++;
                state.Stats.CurrentWinStreak++;
                state.Stats.CurrentLossStreak = 0;
                if (state.Stats.CurrentWinStreak > state.Stats.MaxWinStreak)
                    state.Stats.MaxWinStreak = state.Stats.CurrentWinStreak;
            }
            else
            {
                state.Stats.TotalLossCount++;
                state.Stats.CurrentLossStreak++;
                state.Stats.CurrentWinStreak = 0;
                if (state.Stats.CurrentLossStreak > state.Stats.MaxLossStreak)
                    state.Stats.MaxLossStreak = state.Stats.CurrentLossStreak;
            }
            _statsByTable[state.TableId] = state.Stats;
            UpdateStatsUiAggregated();
        }

        private void ResetStatsForActiveTable()
        {
            foreach (var state in _tableTasks.Values)
                state.Stats = new TabStats();
            _statsByTable.Clear();
            _statsRoot.Tables = new List<StatsItem>();
            UpdateStatsUiAggregated();
        }

        private async void BtnStatsReset_Click(object sender, RoutedEventArgs e)
        {
            ResetStatsForActiveTable();
            await SaveStatsAsync();
            Log("[Stats] reset: " + (_activeTableId ?? ""));
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
            setting.BetSeqPB = _cfg.BetSeqPB ?? "";
            setting.BetSeqNI = _cfg.BetSeqNI ?? "";
            setting.BetPatternsPB = _cfg.BetPatternsPB ?? "";
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
            setting.BetSeqPB = _cfg.BetSeqPB ?? "";
            setting.BetSeqNI = _cfg.BetSeqNI ?? "";
            setting.BetPatternsPB = _cfg.BetPatternsPB ?? "";
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
                _cfg.BetSeqPB = setting.BetSeqPB ?? "";
                _cfg.BetSeqNI = setting.BetSeqNI ?? "";
                _cfg.BetPatternsPB = setting.BetPatternsPB ?? "";
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
                _cfg.BetSeqPB = _globalCfgSnapshot.BetSeqPB ?? "";
                _cfg.BetSeqNI = _globalCfgSnapshot.BetSeqNI ?? "";
                _cfg.BetPatternsPB = _globalCfgSnapshot.BetPatternsPB ?? "";
                _cfg.BetPatternsNI = _globalCfgSnapshot.BetPatternsNI ?? "";
                _cfg.MoneyStrategy = _globalCfgSnapshot.MoneyStrategy ?? "IncreaseWhenLose";
                _cfg.StakeCsv = _globalCfgSnapshot.StakeCsv ?? "";
                _cfg.StakeCsvByMoney = _globalCfgSnapshot.StakeCsvByMoney != null
                    ? new Dictionary<string, string>(_globalCfgSnapshot.StakeCsvByMoney, StringComparer.OrdinalIgnoreCase)
                    : new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                _cfg.S7ResetOnProfit = _globalCfgSnapshot.S7ResetOnProfit;
                _cfg.AutoResetOnCut = _globalCfgSnapshot.AutoResetOnCut;
                _cfg.AutoResetOnWinGeTotal = _globalCfgSnapshot.AutoResetOnWinGeTotal;
                _cfg.WaitCutLossBeforeBet = _globalCfgSnapshot.WaitCutLossBeforeBet;

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
                if (ChkAutoResetOnCut != null)
                    ChkAutoResetOnCut.IsChecked = _cfg.AutoResetOnCut;
                if (ChkAutoResetOnWinGeTotal != null)
                    ChkAutoResetOnWinGeTotal.IsChecked = _cfg.AutoResetOnWinGeTotal;
                if (ChkWaitCutLossBeforeBet != null)
                    ChkWaitCutLossBeforeBet.IsChecked = _cfg.WaitCutLossBeforeBet;
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
            UpdateStatsUiForActiveTable();
        }

        private void ApplyUiConfigToTableSetting(TableSetting setting, bool resetCuts)
        {
            if (setting == null) return;

            setting.BetStrategyIndex = _cfg.BetStrategyIndex;
            setting.BetSeq = _cfg.BetSeq ?? "";
            setting.BetPatterns = _cfg.BetPatterns ?? "";
            setting.BetSeqPB = _cfg.BetSeqPB ?? "";
            setting.BetSeqNI = _cfg.BetSeqNI ?? "";
            setting.BetPatternsPB = _cfg.BetPatternsPB ?? "";
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

        private static readonly Regex RoundIdRegex = new(@"\b(?:ID|No)\s*:\s*(\d+)", RegexOptions.IgnoreCase | RegexOptions.Compiled);

        private static char? NormalizeHistoryToken(string? token)
        {
            if (string.IsNullOrWhiteSpace(token)) return null;
            var t = TextNorm.U(token);
            if (t.Length == 0) return null;
            if (t.StartsWith("P") || t.Contains("PLAYER")) return 'P';
            if (t.StartsWith("B") || t.Contains("BANKER")) return 'B';
            if (t.StartsWith("T") || t.Contains("HOA") || t.Contains("TIE")) return 'T';
            var c = char.ToUpperInvariant(t[0]);
            if (c == 'P' || c == 'B' || c == 'T') return c;
            return null;
        }

        private static List<char> BuildHistoryTokens(JsonElement historyEl, string? historyText)
        {
            var list = new List<char>();
            if (historyEl.ValueKind == JsonValueKind.Array)
            {
                foreach (var it in historyEl.EnumerateArray())
                {
                    if (it.ValueKind != JsonValueKind.String) continue;
                    var c = NormalizeHistoryToken(it.GetString());
                    if (c.HasValue) list.Add(c.Value);
                }
            }

            if (list.Count == 0 && !string.IsNullOrWhiteSpace(historyText))
            {
                var parts = historyText.Split(new[] { ' ', '\t', '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);
                foreach (var part in parts)
                {
                    var c = NormalizeHistoryToken(part);
                    if (c.HasValue) list.Add(c.Value);
                }
            }

            return list;
        }

        private static string BuildSeqDigits(string historyPb)
        {
            if (string.IsNullOrWhiteSpace(historyPb)) return "";
            var sb = new System.Text.StringBuilder(historyPb.Length);
            foreach (var ch in historyPb)
            {
                var u = char.ToUpperInvariant(ch);
                if (u == 'P') sb.Append('0');
                else if (u == 'B') sb.Append('1');
            }
            return sb.ToString();
        }

        private static string ExtractRoundId(string? text)
        {
            if (string.IsNullOrWhiteSpace(text)) return "";
            var m = RoundIdRegex.Match(text);
            return m.Success ? m.Groups[1].Value : "";
        }

        private void UpdateOverlayStateFromJs(string tableId, string? tableName, string? text, JsonElement historyEl, string? historyText, double countdown)
        {
            if (string.IsNullOrWhiteSpace(tableId)) return;

            var tokens = BuildHistoryTokens(historyEl, historyText);
            var historyRaw = tokens.Count > 0 ? string.Join(" ", tokens) : "";
            var historyPb = new string(tokens.Where(c => c == 'P' || c == 'B').ToArray());
            var seqDigits = BuildSeqDigits(historyPb);
            var sessionKey = ExtractRoundId(text);
            var lastToken = tokens.Count > 0 ? tokens[^1] : (char?)null;

            if (countdown < 0) countdown = 0;

            TableOverlayState state;
            bool shouldFinalize = false;
            lock (_tableOverlayGate)
            {
                if (!_tableOverlayStates.TryGetValue(tableId, out state))
                {
                    state = new TableOverlayState
                    {
                        TableId = tableId,
                        TableName = !string.IsNullOrWhiteSpace(tableName) ? tableName : ResolveRoomName(tableId)
                    };
                    _tableOverlayStates[tableId] = state;
                }
                else if (!string.IsNullOrWhiteSpace(tableName))
                {
                    state.TableName = tableName;
                }

                var prevSessionKey = state.SessionKey;
                if (!string.IsNullOrWhiteSpace(historyRaw))
                    state.HistoryRaw = historyRaw;
                if (!string.IsNullOrWhiteSpace(historyPb))
                    state.HistoryPB = historyPb;
                if (!string.IsNullOrWhiteSpace(seqDigits))
                    state.SeqDigits = seqDigits;
                if (lastToken.HasValue)
                    state.LastToken = lastToken.Value.ToString();
                if (!string.IsNullOrWhiteSpace(sessionKey))
                    state.SessionKey = sessionKey;

                state.Countdown = countdown;
                if (countdown > 0 && countdown > state.CountdownMax)
                    state.CountdownMax = countdown;
                state.LastUpdate = DateTime.UtcNow;

                var logSig = $"{state.SessionKey}|{state.HistoryPB}|{state.Countdown:0.###}";
                if (logSig != state.LastLogSig)
                {
                    Log($"[SEQ] {tableId} id={state.SessionKey} raw={state.HistoryRaw} pb={state.HistoryPB} countdown={state.Countdown:0.###}");
                    state.LastLogSig = logSig;
                }

                if (!string.IsNullOrWhiteSpace(sessionKey) &&
                    !string.Equals(prevSessionKey, sessionKey, StringComparison.Ordinal) &&
                    !string.Equals(state.LastFinalizedSessionKey, sessionKey, StringComparison.Ordinal))
                {
                    state.LastFinalizedSessionKey = sessionKey;
                    shouldFinalize = true;
                }
            }

            if (shouldFinalize && lastToken.HasValue)
            {
                double accNow = 0;
                try
                {
                    if (!string.IsNullOrWhiteSpace(_gameBalance))
                        accNow = ParseMoneyOrZero(_gameBalance);
                    else
                        accNow = ParseMoneyOrZero(LblAmount?.Text ?? "0");
                }
                catch { /* ignore parse */ }

                var expectedGameId = InferExpectedGameIdByTable(tableId);
                if (TryPopPendingBet(tableId, expectedGameId, out var row, strictGame: expectedGameId > 0))
                {
                    if (accNow <= 0 && row.Account > 0)
                        accNow = row.Account;
                    FinalizeBetRow(row, lastToken.Value.ToString(), accNow);
                    if (!string.IsNullOrWhiteSpace(tableId))
                    {
                        ApplyBetStatsForTable(tableId, row);
                        var st = GetOrCreateTableTaskState(tableId);
                        st.LastBetAmount = 0;
                        st.LastBetLevelText = "";
                        _ = PushBetPlanToOverlayAsync(tableId, "", 0, "");
                    }
                }
                else
                {
                    Log($"[HIST][MISS] table={tableId} game={expectedGameId} session={sessionKey} result={lastToken.Value} source=popup-road");
                }
            }
        }

        private bool TryGetOverlaySnapshot(string tableId, out CwSnapshot snap)
        {
            snap = new CwSnapshot
            {
                abx = "overlay_state",
                seq = "",
                last = "",
                session = "",
                ts = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                prog = 0
            };

            if (string.IsNullOrWhiteSpace(tableId))
                return false;

            TableOverlayState? state;
            lock (_tableOverlayGate)
            {
                _tableOverlayStates.TryGetValue(tableId, out state);
                if (state == null || string.IsNullOrWhiteSpace(state.SessionKey))
                    return false;

                var prog = state.Countdown > 0 ? state.Countdown : 0;
                snap = new CwSnapshot
                {
                    abx = "overlay_state",
                    seq = state.SeqDigits ?? "",
                    last = state.LastToken ?? "",
                    session = state.SessionKey ?? "",
                    prog = prog,
                    ts = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
                };
                return true;
            }
        }

        private bool TryGetPopupRoadSnapshot(string tableId, out CwSnapshot snap)
        {
            snap = new CwSnapshot
            {
                abx = "popup_road",
                seq = "",
                last = "",
                session = "",
                ts = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                prog = 0
            };

            if (string.IsNullOrWhiteSpace(tableId))
                return false;

            PopupServerRoadState? best = null;
            var expectedGameId = InferGameIdFromRoomName(ResolveRoomName(tableId));
            lock (_popupServerRoadGate)
            {
                if (expectedGameId > 0 &&
                    _popupPreferredRoadRouteByTableId.TryGetValue(BuildPopupPreferredRoadKey(expectedGameId, tableId), out var preferredRoute) &&
                    !string.IsNullOrWhiteSpace(preferredRoute) &&
                    _popupServerRoadStates.TryGetValue(preferredRoute, out var preferred))
                {
                    best = preferred;
                }

                foreach (var state in _popupServerRoadStates.Values)
                {
                    if (state == null || !string.Equals(state.TableId, tableId, StringComparison.OrdinalIgnoreCase))
                        continue;
                    if (expectedGameId > 0 && state.GameId > 0 && state.GameId != expectedGameId)
                        continue;
                    if (best == null || ScorePopupServerRoadState(state) > ScorePopupServerRoadState(best))
                        best = state;
                }

                if (best == null)
                    return false;

                var historyTokens = new List<char>();
                if (best.History != null)
                {
                    foreach (var item in best.History)
                    {
                        var token = NormalizeHistoryToken(item);
                        if (token.HasValue)
                            historyTokens.Add(token.Value);
                    }
                }

                if (historyTokens.Count == 0 && !string.IsNullOrWhiteSpace(best.HistoryText))
                {
                    foreach (var part in best.HistoryText.Split(new[] { ' ', '\t', '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries))
                    {
                        var token = NormalizeHistoryToken(part);
                        if (token.HasValue)
                            historyTokens.Add(token.Value);
                    }
                }

                var historyPb = new string(historyTokens.Where(c => c == 'P' || c == 'B').ToArray());
                var seqDigits = BuildSeqDigits(historyPb);
                var lastToken = historyTokens.Count > 0 ? historyTokens[^1].ToString() : "";
                var prog = best.Countdown.GetValueOrDefault() > 0 ? best.Countdown.GetValueOrDefault() : 0;

                snap = new CwSnapshot
                {
                    abx = "popup_road",
                    seq = seqDigits,
                    last = lastToken,
                    session = best.SessionKey ?? "",
                    prog = prog,
                    ts = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
                };

                return !string.IsNullOrWhiteSpace(snap.session)
                    || !string.IsNullOrWhiteSpace(snap.seq)
                    || (snap.prog.GetValueOrDefault() > 0);
            }
        }

        private bool TryGetTaskSnapshot(string tableId, out CwSnapshot snap)
        {
            var hasOverlay = TryGetOverlaySnapshot(tableId, out var overlaySnap);
            var hasPopupRoad = TryGetPopupRoadSnapshot(tableId, out var popupRoadSnap);

            // Overlay state is useful for rendered history/session, but its countdown is often 0
            // while popup-road still has the real open-bet countdown. Prefer popup-road whenever it
            // can drive the wait gate, otherwise keep the richer overlay snapshot.
            if (hasPopupRoad && popupRoadSnap.prog.GetValueOrDefault() > 0 &&
                (!hasOverlay || overlaySnap.prog.GetValueOrDefault() <= 0))
            {
                snap = popupRoadSnap;
                return true;
            }

            if (hasOverlay)
            {
                snap = overlaySnap;
                return true;
            }

            if (hasPopupRoad)
            {
                snap = popupRoadSnap;
                return true;
            }

            snap = new CwSnapshot
            {
                abx = "overlay_state",
                seq = "",
                last = "",
                session = "",
                ts = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                prog = 0
            };
            return false;
        }

        private static string GetLastPopupRoadResultToken(PopupServerRoadState? state)
        {
            if (state == null)
                return "";

            if (state.History != null)
            {
                for (int i = state.History.Count - 1; i >= 0; i--)
                {
                    var token = NormalizeHistoryToken(state.History[i]);
                    if (token.HasValue)
                        return token.Value.ToString();
                }
            }

            if (state.HistoryRaw != null)
            {
                for (int i = state.HistoryRaw.Count - 1; i >= 0; i--)
                {
                    var node = state.HistoryRaw[i];
                    if (node == null)
                        continue;
                    if (node.TieCount > 0)
                        return "T";
                    var token = NormalizeHistoryToken(node.Code);
                    if (token.HasValue)
                        return token.Value.ToString();
                }
            }

            var centerToken = NormalizeHistoryToken(state.CenterResult);
            return centerToken.HasValue ? centerToken.Value.ToString() : "";
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
            UpdateStatsUi(GetOrCreateTableTaskState(setting.Id, setting.Name));
            await PushTableCutValuesToOverlayAsync(setting.Id, setting.CutProfit, setting.CutLoss);
            if (created)
                _ = TriggerTableSettingsSaveDebouncedAsync();
        }

        private async Task PushTableCutValuesToOverlayAsync(string tableId, double cutProfit, double cutLoss)
        {
            if (string.IsNullOrWhiteSpace(tableId)) return;
            var idJson = JsonSerializer.Serialize(tableId);
            var cp = cutProfit.ToString(CultureInfo.InvariantCulture);
            var cl = cutLoss.ToString(CultureInfo.InvariantCulture);
            var script = $"window.__abxTableOverlay && window.__abxTableOverlay.setCutValues && window.__abxTableOverlay.setCutValues({idJson}, {cp}, {cl});";
            try { await ExecuteOverlayScriptAsync(script); } catch { }
        }

        private async Task PushBetPlanToOverlayAsync(string tableId, string? side, long amount, string? levelText)
        {
            if (string.IsNullOrWhiteSpace(tableId)) return;
            var idJson = JsonSerializer.Serialize(tableId);
            var sideJson = JsonSerializer.Serialize(side ?? "");
            var levelJson = JsonSerializer.Serialize(levelText ?? "");
            var amt = amount.ToString(CultureInfo.InvariantCulture);
            var script = $"window.__abxTableOverlay && window.__abxTableOverlay.setBetPlan && window.__abxTableOverlay.setBetPlan({idJson}, {sideJson}, {amt}, {levelJson});";
            try { await ExecuteOverlayScriptAsync(script); } catch { }
        }

        private async Task PushBetStatsToOverlayAsync(string tableId, long winAmount, int winCount, int lossCount, string? outcome = null)
        {
            if (string.IsNullOrWhiteSpace(tableId)) return;
            var idJson = JsonSerializer.Serialize(tableId);
            var winAmt = winAmount.ToString(CultureInfo.InvariantCulture);
            var winC = winCount.ToString(CultureInfo.InvariantCulture);
            var lossC = lossCount.ToString(CultureInfo.InvariantCulture);
            var outcomeJson = JsonSerializer.Serialize(outcome ?? "");
            var script = $"window.__abxTableOverlay && window.__abxTableOverlay.setBetStats && window.__abxTableOverlay.setBetStats({idJson}, {winAmt}, {winC}, {lossC}, {outcomeJson});";
            try { await ExecuteOverlayScriptAsync(script); } catch { }
        }

        private async Task ShowCenterWebAlertAsync(string message)
        {
            if (Web?.CoreWebView2 == null) return;
            if (string.IsNullOrWhiteSpace(message)) return;
            var msgJson = JsonSerializer.Serialize(message);
            var script = $"window.__abx_hw_showCenterAlert && window.__abx_hw_showCenterAlert({msgJson});";
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
                                    //EnqueueUi($"[JS] {display}");
                                return;
                            }

                            //EnqueueUi($"[JS] {display}"); // chỉ hiển thị UI, không ghi ra file
                            var root = parsedDoc.RootElement.Clone();

                                if (await TryHandleOverlayBridgeMessageAsync(root))
                                    return;

                                if (TryHandleBetBridgeMessage(root))
                                    return;

                                if (!root.TryGetProperty("abx", out var abxEl)) return;
                                var abxStr = abxEl.GetString() ?? "";
                                string ui = "";
                                if (root.TryGetProperty("ui", out var uiEl))
                                    ui = uiEl.GetString() ?? "";
                                var uname = root.TryGetProperty("username", out var uEl) ? (uEl.GetString() ?? "") : "";
                                var isGameUi = string.Equals(ui, "game", StringComparison.OrdinalIgnoreCase);
                                var isGameBalanceMsg = string.Equals(abxStr, "game_balance", StringComparison.OrdinalIgnoreCase);


                                if (!string.IsNullOrWhiteSpace(uname) && (isGameUi || isGameBalanceMsg))
                                {
                                    var normalizedGame = uname.Trim();
                                    if (!string.IsNullOrWhiteSpace(normalizedGame) && !string.Equals(_gameUsername, normalizedGame, StringComparison.Ordinal))
                                        _gameUsername = normalizedGame;
                                    _gameUsernameAt = DateTime.UtcNow;
                                    _ = Dispatcher.BeginInvoke(new Action(() =>
                                    {
                                        RefreshDashboardAccountUi(uname, null, "game-username");
                                    }));
                                }
                                else if (!string.IsNullOrWhiteSpace(uname))
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
                                        RefreshDashboardAccountUi(uname, null, "home-username");
                                    }));
                                }
                                var bal = root.TryGetProperty("balance", out var bEl)
                                    ? (bEl.ValueKind == JsonValueKind.Number ? bEl.GetRawText() : (bEl.GetString() ?? ""))
                                    : "";
                                if (!string.IsNullOrWhiteSpace(bal))
                                {
                                    if (isGameUi || isGameBalanceMsg)
                                    {
                                        var balText = NormalizeGameBalanceText(bal);
                                        if (!string.IsNullOrWhiteSpace(balText))
                                        {
                                            if (_gameBalance != balText)
                                            {
                                                _gameBalance = balText;
                                                _gameBalanceAt = DateTime.UtcNow;
                                            }
                                            _ = Dispatcher.BeginInvoke(new Action(() =>
                                            {
                                                RefreshDashboardAccountUi(null, null, "game-balance");
                                            }));
                                            if (string.IsNullOrWhiteSpace(_gameUsername))
                                                _ = TryRefreshGameUsernameFromActiveHostAsync("probe-game-user");
                                        }
                                    }
                                    else
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
                                            RefreshDashboardAccountUi(uname, null, "home-balance");
                                        }));
                                    }
                                }

                                var totalBet = root.TryGetProperty("total_bet", out var tbEl)
                                    ? (tbEl.ValueKind == JsonValueKind.Number ? tbEl.GetRawText() : (tbEl.GetString() ?? ""))
                                    : "";
                                if (!string.IsNullOrWhiteSpace(totalBet) && (isGameUi || isGameBalanceMsg))
                                {
                                    var totalText = NormalizeGameBalanceText(totalBet);
                                    if (!string.IsNullOrWhiteSpace(totalText))
                                    {
                                        totalText = NormalizeGameTotalBetText(totalText);
                                        if (_gameTotalBet != totalText)
                                        {
                                            _gameTotalBet = totalText;
                                            _gameTotalBetAt = DateTime.UtcNow;
                                        }
                                        _ = Dispatcher.BeginInvoke(new Action(() =>
                                        {
                                            if (LblTotalStake != null)
                                                LblTotalStake.Text = totalText;
                                            CheckWinGeTotalBetResetIfNeeded();
                                        }));
                                    }
                                }

                                if (isGameBalanceMsg)
                                    return;

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
                                                    bool winIsPlayer = (tail == '0' || tail == '2' || tail == '4');

                                                    // ✅ CHỐT DÒNG BET đang chờ NGAY TẠI THỜI ĐIỂM VÁN KHÉP
                                                    var kqStr = winIsPlayer ? "P" : "B";
                                                    double accNow2 = 0;
                                                    if (!string.IsNullOrWhiteSpace(_gameBalance))
                                                        accNow2 = ParseMoneyOrZero(_gameBalance);
                                                    else if (snap?.totals?.A != null)
                                                        accNow2 = snap.totals.A.Value;
                                                    else if (_pendingRow != null)
                                                        accNow2 = _pendingRow.Account;

                                                    bool hasTablePending = false;
                                                    lock (_pendingBetGate)
                                                    {
                                                        hasTablePending = _pendingBetsByTable.Count > 0;
                                                    }
                                                    if (!hasTablePending && _pendingRow != null)
                                                    {
                                                        FinalizeLastBet(kqStr, accNow2);
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
                                                        var seconds = Math.Max(0, snap.prog.Value);
                                                        if (PrgBet != null) PrgBet.Value = seconds > 0 ? 1 : 0;
                                                        if (LblProg != null) LblProg.Text = $"{seconds.ToString("0.#", CultureInfo.InvariantCulture)}s";
                                                    }
                                                    else
                                                    {
                                                        if (PrgBet != null) PrgBet.Value = 0;
                                                        if (LblProg != null) LblProg.Text = "-";
                                                    }
                                                    var amt = snap?.totals?.A;
                                                    RefreshDashboardAccountUi(uname, amt, "tick");
                                                    // Kết quả gần nhất từ chuỗi seq
                                                    var seqStrLocal = snap.seq ?? "";
                                                    char last = (seqStrLocal.Length > 0) ? seqStrLocal[^1] : '\0';
                                                    var kq = (last == '0' || last == '2' || last == '4') ? "P"
                                                             : (last == '1' || last == '3') ? "B" : "";
                                                    SetLastResultUI(kq);

                                                    var hasFreshGameTotalBet = !string.IsNullOrWhiteSpace(_gameTotalBet) &&
                                                                               (DateTime.UtcNow - _gameTotalBetAt) <= TimeSpan.FromSeconds(10);
                                                    if (LblTotalStake != null)
                                                    {
                                                        if (hasFreshGameTotalBet)
                                                            LblTotalStake.Text = _gameTotalBet;
                                                        else
                                                            LblTotalStake.Text = "-";
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

                                if (abxStr == "home_tick")
                                {
                                    var homeUname = root.TryGetProperty("username", out var homeUserEl) ? (homeUserEl.GetString() ?? "") : "";
                                    if (!string.IsNullOrWhiteSpace(homeUname))
                                    {
                                        var normalized = homeUname.Trim().ToLowerInvariant();
                                        if (_homeUsername != normalized)
                                        {
                                            _homeUsername = normalized;
                                            _homeUsernameAt = DateTime.UtcNow;

                                            if (_cfg != null && _cfg.LastHomeUsername != _homeUsername)
                                            {
                                                _cfg.LastHomeUsername = _homeUsername;
                                                _ = SaveConfigAsync();
                                            }
                                        }
                                    }

                                    var homeBal = root.TryGetProperty("balance", out var homeBalEl) ? (homeBalEl.GetString() ?? "") : "";
                                    if (!string.IsNullOrWhiteSpace(homeBal))
                                    {
                                        var homeBalVal = ParseMoneyOrZero(homeBal);
                                        var homeBalText = (homeBalVal > 0 || homeBal.Trim() == "0")
                                            ? ((long)homeBalVal).ToString("N0", CultureInfo.InvariantCulture)
                                            : homeBal.Trim();
                                        if (_homeBalance != homeBalText)
                                        {
                                            _homeBalance = homeBalText;
                                            _homeBalanceAt = DateTime.UtcNow;
                                        }
                                    }
                                    var href = root.TryGetProperty("href", out var hEl) ? (hEl.GetString() ?? "") : "";
                                    var title = root.TryGetProperty("title", out var titleEl) ? (titleEl.GetString() ?? "") : "";
                                    var sig = $"{homeUname}|{homeBal}|{href}";
                                    if (!string.Equals(_lastHomeTickSig, sig, StringComparison.Ordinal))
                                    {
                                        _lastHomeTickSig = sig;
                                        Log($"[HomeTick] user={homeUname} | balance={homeBal} | href={href} | title={title}");
                                    }

                                    try
                                    {
                                        await Dispatcher.InvokeAsync(() =>
                                        {
                                            RefreshDashboardAccountUi(homeUname, null, "home_tick");
                                        });

                                        try
                                        {
                                            var jsLogged = @"
(function(){
  try{
    const rm=s=>{try{return (s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'');}catch(_){return s||'';}};
    const low=s=>rm(String(s||'').trim().toLowerCase());
    const vis=el=>{if(!el)return false; const r=el.getBoundingClientRect(), cs=getComputedStyle(el);
                   return r.width>4&&r.height>4&&cs.display!=='none'&&cs.visibility!=='hidden'&&cs.pointerEvents!=='none';};
    const qa=(s,d)=>Array.from((d||document).querySelectorAll(s));

    const hasLogoutVis = qa('a,button,[role=""button""],.btn,.base-button')
        .some(el => vis(el) && /dang\s*xuat|đăng\s*xuất|logout|sign\s*out/i.test(low(el.textContent)));
    const hasLoginVis = qa('a,button,[role=""button""],.btn,.base-button')
        .some(el => vis(el) && /dang\s*nhap|đăng\s*nhập|login|sign\s*in/i.test(low(el.textContent)));

    return (hasLogoutVis && !hasLoginVis) ? '1' : '0';
  }catch(e){ return '0'; }
})();";
                                            var st = await ExecJsAsyncStr(jsLogged);
                                            _homeLoggedIn = (st == "1");
                                        }
                                        catch { }
                                    }
                                    catch { }

                                    _lastHomeTickUtc = DateTime.UtcNow;
                                    _lastGameTickUtc = DateTime.MinValue;
                                    _lockGameUi = false;
                                    Dispatcher.BeginInvoke(new Action(() => ApplyUiMode(false)));
                                    return;
                                }
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



        private static bool IsHomeIndexLikePath(string? path)
        {
            var p = (path ?? "").Trim();
            return string.Equals(p, "/home/index.html", StringComparison.OrdinalIgnoreCase)
                || string.Equals(p, "/home/index.htm", StringComparison.OrdinalIgnoreCase)
                || string.Equals(p, "/home/index", StringComparison.OrdinalIgnoreCase);
        }

        private string NormalizePreferredStartupUrl(string? url, bool logChange = true)
        {
            var raw = string.IsNullOrWhiteSpace(url) ? DEFAULT_URL : url.Trim();
            if (!Regex.IsMatch(raw, @"^\w+://", RegexOptions.IgnoreCase))
                raw = "https://" + raw;

            if (!Uri.TryCreate(raw, UriKind.Absolute, out var uri))
                return raw;

            if (!IsHomeIndexLikePath(uri.AbsolutePath))
                return uri.ToString();

            var root = new UriBuilder(uri)
            {
                Path = "/",
                Query = "",
                Fragment = ""
            }.Uri.ToString();

            if (logChange)
                Log($"[StartupUrl] normalize home shell -> root: {uri} => {root}");

            return root;
        }

        private async Task LogTopDocumentSnapshotAsync(string reason)
        {
            if (Web?.CoreWebView2 == null) return;

            const string js = @"(function(){
  try{
    var d=document, e=d.documentElement, b=d.body;
    var text=((b&&b.innerText)||'').replace(/\s+/g,' ').trim();
    var nav=null, redirectCount=-1, navType='';
    try{
      nav=(performance && performance.getEntriesByType) ? performance.getEntriesByType('navigation')[0] : null;
      redirectCount = nav && typeof nav.redirectCount==='number' ? nav.redirectCount : -1;
      navType = nav && nav.type ? String(nav.type) : '';
    }catch(_){}
    var cookiesLen=-1;
    try{ cookiesLen=String(d.cookie||'').length; }catch(_){}
    var bodyStyle=null;
    try{ bodyStyle=b?getComputedStyle(b):null; }catch(_){}
    var frameHref='', frameTitle='', frameTextSample='', frameError='';
    var frameBodyLen=0, frameTextLen=0;
    try{
      var frame = d.querySelector('iframe');
      var frameDoc = frame && frame.contentDocument ? frame.contentDocument : null;
      var frameWin = frame && frame.contentWindow ? frame.contentWindow : null;
      if (frameWin && frameWin.location) frameHref = String(frameWin.location.href || '');
      if (frameDoc) {
        var fb = frameDoc.body;
        var ftext = ((fb && fb.innerText) || '').replace(/\s+/g,' ').trim();
        frameTitle = String(frameDoc.title || '');
        frameBodyLen = (fb && fb.innerHTML ? fb.innerHTML.length : 0);
        frameTextLen = ftext.length;
        frameTextSample = ftext.slice(0, 160);
      }
    }catch(ex){
      frameError = String(ex && ex.message || ex);
    }
    return JSON.stringify({
      href: location.href || '',
      title: d.title || '',
      readyState: d.readyState || '',
      htmlLen: (e && e.innerHTML ? e.innerHTML.length : 0),
      bodyLen: (b && b.innerHTML ? b.innerHTML.length : 0),
      textLen: text.length,
      textSample: text.slice(0, 180),
      iframeCount: d.querySelectorAll ? d.querySelectorAll('iframe').length : 0,
      scriptCount: d.scripts ? d.scripts.length : 0,
      cookieLen: cookiesLen,
      visibility: d.visibilityState || '',
      bodyDisplay: bodyStyle ? bodyStyle.display : '',
      bodyVisibility: bodyStyle ? bodyStyle.visibility : '',
      bodyBg: bodyStyle ? bodyStyle.backgroundColor : '',
      navType: navType,
      redirectCount: redirectCount,
      frameHref: frameHref,
      frameTitle: frameTitle,
      frameBodyLen: frameBodyLen,
      frameTextLen: frameTextLen,
      frameTextSample: frameTextSample,
      frameError: frameError,
      hasPassword: !!d.querySelector('input[type=""password""]'),
      hasLoginHint: /dang\s*nhap|đăng\s*nhập|login|sign\s*in/i.test(text),
      hasLogoutHint: /dang\s*xuat|đăng\s*xuất|logout|sign\s*out/i.test(text),
      hasLoadingHint: /loading|please wait|wait a moment|đang tải|vui lòng chờ/i.test(text)
    });
  }catch(err){
    return JSON.stringify({ error: String(err && err.message || err) });
  }
})();";

            try
            {
                var raw = await Web.ExecuteScriptAsync(js);
                if (string.IsNullOrWhiteSpace(raw))
                {
                    Log($"[DocDiag][{reason}] empty-result");
                    return;
                }

                if (raw.Length >= 2 && raw[0] == '"')
                    raw = Regex.Unescape(raw).Trim('"');

                using var doc = JsonDocument.Parse(raw);
                var root = doc.RootElement;
                if (root.TryGetProperty("error", out var errEl))
                {
                    Log($"[DocDiag][{reason}] error={errEl.GetString()}");
                    return;
                }

                string href = root.TryGetProperty("href", out var hrefEl) ? (hrefEl.GetString() ?? "") : "";
                string title = root.TryGetProperty("title", out var titleEl) ? (titleEl.GetString() ?? "") : "";
                string ready = root.TryGetProperty("readyState", out var readyEl) ? (readyEl.GetString() ?? "") : "";
                int htmlLen = root.TryGetProperty("htmlLen", out var htmlEl) ? htmlEl.GetInt32() : 0;
                int bodyLen = root.TryGetProperty("bodyLen", out var bodyEl) ? bodyEl.GetInt32() : 0;
                int textLen = root.TryGetProperty("textLen", out var textLenEl) ? textLenEl.GetInt32() : 0;
                int iframeCount = root.TryGetProperty("iframeCount", out var iframeEl) ? iframeEl.GetInt32() : 0;
                int scriptCount = root.TryGetProperty("scriptCount", out var scriptEl) ? scriptEl.GetInt32() : 0;
                int cookieLen = root.TryGetProperty("cookieLen", out var cookieEl) ? cookieEl.GetInt32() : -1;
                int redirectCount = root.TryGetProperty("redirectCount", out var redirectEl) ? redirectEl.GetInt32() : -1;
                string navType = root.TryGetProperty("navType", out var navTypeEl) ? (navTypeEl.GetString() ?? "") : "";
                string bodyDisplay = root.TryGetProperty("bodyDisplay", out var displayEl) ? (displayEl.GetString() ?? "") : "";
                string bodyVisibility = root.TryGetProperty("bodyVisibility", out var visibilityEl) ? (visibilityEl.GetString() ?? "") : "";
                string bodyBg = root.TryGetProperty("bodyBg", out var bgEl) ? (bgEl.GetString() ?? "") : "";
                string frameHref = root.TryGetProperty("frameHref", out var frameHrefEl) ? (frameHrefEl.GetString() ?? "") : "";
                string frameTitle = root.TryGetProperty("frameTitle", out var frameTitleEl) ? (frameTitleEl.GetString() ?? "") : "";
                int frameBodyLen = root.TryGetProperty("frameBodyLen", out var frameBodyEl) ? frameBodyEl.GetInt32() : 0;
                int frameTextLen = root.TryGetProperty("frameTextLen", out var frameTextLenEl) ? frameTextLenEl.GetInt32() : 0;
                string frameTextSample = root.TryGetProperty("frameTextSample", out var frameSampleEl) ? (frameSampleEl.GetString() ?? "") : "";
                string frameError = root.TryGetProperty("frameError", out var frameErrEl) ? (frameErrEl.GetString() ?? "") : "";
                bool hasPassword = root.TryGetProperty("hasPassword", out var passEl) && passEl.ValueKind == JsonValueKind.True;
                bool hasLoginHint = root.TryGetProperty("hasLoginHint", out var loginEl) && loginEl.ValueKind == JsonValueKind.True;
                bool hasLogoutHint = root.TryGetProperty("hasLogoutHint", out var logoutEl) && logoutEl.ValueKind == JsonValueKind.True;
                bool hasLoadingHint = root.TryGetProperty("hasLoadingHint", out var loadingEl) && loadingEl.ValueKind == JsonValueKind.True;
                string textSample = root.TryGetProperty("textSample", out var sampleEl) ? (sampleEl.GetString() ?? "") : "";
                if (textSample.Length > 140) textSample = textSample.Substring(0, 140);
                if (frameTextSample.Length > 120) frameTextSample = frameTextSample.Substring(0, 120);

                Log($"[DocDiag][{reason}] href={href} | title={title} | ready={ready} | html={htmlLen} | body={bodyLen} | text={textLen} | iframes={iframeCount} | scripts={scriptCount} | cookies={cookieLen} | redirects={redirectCount} | navType={navType} | body={bodyDisplay}/{bodyVisibility}/{bodyBg} | hints=login:{hasLoginHint} logout:{hasLogoutHint} loading:{hasLoadingHint} pass:{hasPassword} | frameHref={frameHref} | frameTitle={frameTitle} | frameBody={frameBodyLen} | frameText={frameTextLen} | frameErr={frameError} | sample={textSample} | frameSample={frameTextSample}");
            }
            catch (Exception ex)
            {
                Log($"[DocDiag][{reason}] {ex.Message}");
            }
        }

        private async Task LogNoTickDiagnosisAsync(string reason, int delayMs)
        {
            await Task.Delay(delayMs);
            bool hasGame = _lastGameTickUtc != DateTime.MinValue;
            bool hasHome = _lastHomeTickUtc != DateTime.MinValue;
            if (hasGame || hasHome)
                return;

            Log($"[DocDiag][{reason}] no web tick after {delayMs}ms");
            await LogTopDocumentSnapshotAsync($"{reason}+{delayMs}ms");
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
                // Giữ nguyên luồng window.open/new-window để route sang PopupWeb như BaccaratSexyCasino.
                Web.CoreWebView2.NewWindowRequested += NewWindowRequested;
                Web.CoreWebView2.NavigationStarting += (_, e) =>
                {
                    try
                    {
                        ClearLatestNetworkRooms("main-nav-start");
                        Log("[Web] NavigationStarting: " + (e.Uri ?? ""));
                    }
                    catch { }
                };
                Web.CoreWebView2.SourceChanged += (_, __) =>
                {
                    try { Log("[Web] SourceChanged: " + (Web.Source?.ToString() ?? "(null)")); } catch { }
                };
                Web.CoreWebView2.ContentLoading += (_, e) =>
                {
                    try { Log($"[Web] ContentLoading: isError={e.IsErrorPage} navId={e.NavigationId}"); } catch { }
                };

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

            // 1) Runtime riêng của BaccaratWM (dùng khi chạy EXE độc lập)
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
            Log("[AutoFill] skipped (sync disabled)");
            return;

            // 1. webview chưa sẵn sàng thì thôi
            if (!IsWebAlive)
            {
                Log("[AutoFill] skipped (web not ready)");
                return;        }            // 2. đảm bảo web đã init CoreWebView2
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


        // Luồng cũ: thử tự động mở game live từ Home.
        // 1) Ưu tiên gọi API JS nếu có (__abx_hw_clickPlayXDL),
        // 2) fallback sang C# ClickXocDiaTitleAsync(timeout)
        private async Task<bool> TryPlayXocDiaFromHomeAsync()
        {
            try
            {
                Log("[HOME][LEGACY] auto-open live game: try js api");
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
                LoadStats();
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
                    var preferredStart = NormalizePreferredStartupUrl(start.Trim());
                    if (_cfg != null && !string.Equals(_cfg.Url, preferredStart, StringComparison.OrdinalIgnoreCase))
                        _cfg.Url = preferredStart;
                    if (TxtUrl != null && !string.Equals(TxtUrl.Text?.Trim(), preferredStart, StringComparison.OrdinalIgnoreCase))
                        TxtUrl.Text = preferredStart;
                    await NavigateIfNeededAsync(preferredStart);

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

                _ = LogTopDocumentSnapshotAsync("nav-complete");
                _ = LogNoTickDiagnosisAsync("nav-complete", 1500);
                _ = LogNoTickDiagnosisAsync("nav-complete", 4000);

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
            });
        }
        private async void TxtPass_PasswordChanged(object sender, RoutedEventArgs e)
        {
            if (!_uiReady) return;
            _passCts = await DebounceAsync(_passCts, 150, async () =>
            {
                await SaveConfigAsync();
            });
        }

        private async void TxtVerify_TextChanged(object sender, TextChangedEventArgs e)
        {
            if (!_uiReady) return;
            _verifyCts = await DebounceAsync(_verifyCts, 150, async () =>
            {
                // Mã xác minh không cần lưu config – chỉ sync sang web
            });
        }


        private async void BtnReloadRoomList_Click(object sender, RoutedEventArgs e)
        {
            await RefreshRoomListAsync(true);
            if (RoomPopup != null && _roomOptions.Count > 0)
                RoomPopup.IsOpen = true;
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

        private async void BtnCloseAllOverlay_Click(object sender, RoutedEventArgs e)
        {
            var ids = _overlayActiveRooms.Where(id => !string.IsNullOrWhiteSpace(id)).ToList();
            if (ids.Count == 0)
            {
                Log("[TABLE] Chưa có overlay nào đang mở.");
                return;
            }

            foreach (var id in ids)
            {
                try { StopTableTask(id); } catch { }
            }

            if (GetActiveRoomHostWebView()?.CoreWebView2 == null && Web?.CoreWebView2 == null && _popupWeb?.CoreWebView2 == null)
            {
                Log("[TABLE] WebView chưa sẵn sàng.");
                return;
            }

            try
            {
                var idsJson = JsonSerializer.Serialize(ids);
                var script = $"(function(){{ if (!window.__abxTableOverlay || !window.__abxTableOverlay.close) return; var ids = {idsJson}; ids.forEach(function(id){{ try{{ window.__abxTableOverlay.close(id); }}catch(e){{}} }}); }})();";
                await ExecuteOverlayScriptAsync(script);
                Log($"[TABLE] Đã đóng overlay {ids.Count} bàn.");
            }
            catch (Exception ex)
            {
                Log("[TABLE] Lỗi đóng overlay: " + ex.Message);
            }
        }

        private async void BtnResetOverlay_Click(object sender, RoutedEventArgs e)
        {
            if (GetActiveRoomHostWebView()?.CoreWebView2 == null && Web?.CoreWebView2 == null && _popupWeb?.CoreWebView2 == null)
            {
                Log("[TABLE] WebView chưa sẵn sàng.");
                return;
            }

            try
            {
                await ExecuteOverlayScriptAsync("window.__abxTableOverlay && window.__abxTableOverlay.reset();");
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

            if (GetActiveRoomHostWebView()?.CoreWebView2 == null && Web?.CoreWebView2 == null && _popupWeb?.CoreWebView2 == null)
            {
                Log("[TABLE] WebView chưa sẵn sàng.");
                return;
            }

            var roomsJson = JsonSerializer.Serialize(selectedRooms);
            var optionsJson = JsonSerializer.Serialize(new
            {
                baseSelector = ".rW_sl,.rY_sn,.ls_by,[data-table-name],[data-tablename],[data-table-id],[data-tabletitle],[data-table-title],[data-title],[data-name]",
                resetTotals = true
            });
            var script = $"window.__abxTableOverlay && window.__abxTableOverlay.openRooms({roomsJson}, {optionsJson});";
            try
            {
                await ExecuteOverlayScriptAsync(script);
                _overlayActiveRooms.Clear();
                foreach (var room in selectedRooms)
                    _overlayActiveRooms.Add(room.id);
                await PushCachedPopupServerRoadStatesAsync(selectedRooms.Select(r => (r.id, r.name)));
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
                // Không scroll vào đúng bàn khi tick; để JS scroll top sau khi ghim xong.
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
                if (total <= 0)
                    TxtRoomSummary.Text = "Không có mục nào";
                else if (sel <= 0)
                    TxtRoomSummary.Text = $"{total} bàn, chưa chọn";
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
            await ExecuteOverlayScriptAsync(script);
        }

        private async Task ScrollRoomIntoViewAsync(string? roomName)
        {
            if (!_uiReady) return;
            if (GetActiveRoomHostWebView()?.CoreWebView2 == null && Web?.CoreWebView2 == null && _popupWeb?.CoreWebView2 == null) return;
            var name = (roomName ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(name))
                return;

            var nameJson = JsonSerializer.Serialize(name);
            var script = $"window.__abxTableOverlay && window.__abxTableOverlay.scrollToRoom({nameJson});";
            try
            {
                await ExecuteOverlayScriptAsync(script);
            }
            catch (Exception ex)
            {
                Log("[PIN][SCROLL] " + ex.Message);
            }
        }

        private async Task ScrollLobbyTopAsync(string reason)
        {
            if (!_uiReady) return;
            if (GetActiveRoomHostWebView()?.CoreWebView2 == null && Web?.CoreWebView2 == null && _popupWeb?.CoreWebView2 == null) return;
            var script = "window.__abxTableOverlay && window.__abxTableOverlay.scrollToTop && window.__abxTableOverlay.scrollToTop({behavior:'auto'});";
            try
            {
                await ExecuteOverlayScriptAsync(script);
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

        private async void ChkAutoResetOnCut_Changed(object sender, RoutedEventArgs e)
        {
            if (!_uiReady || _suppressTableSync) return;
            if (_cfg == null) return;
            _cfg.AutoResetOnCut = (ChkAutoResetOnCut?.IsChecked == true);
            if (_globalCfgSnapshot != null)
                _globalCfgSnapshot.AutoResetOnCut = _cfg.AutoResetOnCut;
            await SaveConfigAsync();
        }

        private async void ChkAutoResetOnWinGeTotal_Changed(object sender, RoutedEventArgs e)
        {
            if (!_uiReady || _suppressTableSync) return;
            if (_cfg == null) return;
            _cfg.AutoResetOnWinGeTotal = (ChkAutoResetOnWinGeTotal?.IsChecked == true);
            if (_globalCfgSnapshot != null)
                _globalCfgSnapshot.AutoResetOnWinGeTotal = _cfg.AutoResetOnWinGeTotal;
            await SaveConfigAsync();
            CheckWinGeTotalBetResetIfNeeded();
        }

        private async void ChkWaitCutLossBeforeBet_Changed(object sender, RoutedEventArgs e)
        {
            if (!_uiReady || _suppressTableSync) return;
            if (_cfg == null) return;
            _cfg.WaitCutLossBeforeBet = (ChkWaitCutLossBeforeBet?.IsChecked == true);
            if (_globalCfgSnapshot != null)
                _globalCfgSnapshot.WaitCutLossBeforeBet = _cfg.WaitCutLossBeforeBet;
            if (_cfg.WaitCutLossBeforeBet)
            {
                if (HasRunningTasks())
                    EnterVirtualBettingMode();
                else
                    Log("[VIRTUAL] enabled: pending until tasks start");
            }
            else
            {
                _virtualBettingActive = false;
                Log("[VIRTUAL] disabled: real bet mode");
            }
            await SaveConfigAsync();
            CheckCutAndStopIfNeeded();
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
                (idx == 0) ? TIP_SEQ_PB :
                (idx == 2) ? TIP_SEQ_NI :
                "Chọn chiến lược 1 hoặc 3 để nhập Chuỗi cầu.");

            AttachTip(TxtTheCau,
                (idx == 1) ? TIP_THE_PB :
                (idx == 3) ? TIP_THE_NI :
                "Chọn chiến lược 2 hoặc 4 để nhập Thế cầu.");
            // ==== BẮT ĐẦU: Tooltip cho chiến lược đặt cược ====
            string tip = idx switch
            {
                0 => "1) Chuỗi P/B tự nhập: So khớp chuỗi P/B cấu hình thủ công (cũ→mới); khi khớp mẫu gần nhất sẽ đặt theo cửa chỉ định; không khớp dùng logic mặc định.",
                1 => "2) Thế cầu P/B tự nhập: Ánh xạ 'mẫu quá khứ → cửa kế tiếp' theo danh sách quy tắc; ưu tiên mẫu dài và khớp gần nhất; hỗ trợ ',', ';', '|', hoặc xuống dòng.",
                2 => "3) Chuỗi I/N: So khớp dãy Ít/Nhiều (I/N) cấu hình thủ công; khớp thì đặt theo chỉ định; không khớp dùng logic mặc định.",
                3 => "4) Thế cầu I/N: Ánh xạ mẫu I/N → cửa kế tiếp; ưu tiên mẫu dài; cho phép nhiều luật trong cùng danh sách.",
                4 => "5) Theo cầu trước (thông minh): Dựa vào ván gần nhất và heuristics nội bộ; đánh liên tục; quản lý vốn theo chuỗi tiền, cut_profit/cut_loss.",
                5 => "6) Cửa đặt ngẫu nhiên: Mỗi ván chọn P/B ngẫu nhiên; vẫn tuân theo MoneyManager và ngưỡng cắt lãi/lỗ.",
                6 => "7) Bám cầu P/B (thống kê): Duyệt k từ lớn→nhỏ (k=6 mặc định); đếm tần suất P/B sau các lần khớp đuôi; chọn phía đa số; hòa → đảo 1–1; không có mẫu → theo ván cuối; đánh liên tục.",
                7 => "8) Xu hướng chuyển trạng thái: Thống kê 6 chuyển gần nhất giữa các ván ('lặp' vs 'đảo'); nếu 'đảo' nhiều hơn → đánh ngược ván cuối; ngược lại → theo ván cuối; đánh liên tục.",
                8 => "9) Run-length (dài chuỗi): Tính độ dài chuỗi ký tự cuối; nếu run ≥ T (mặc định T=3) → đảo để mean-revert; nếu run ngắn → theo đà (momentum); đánh liên tục.",
                9 => "10) Chuyên gia bỏ phiếu: Kết hợp 5 chuyên gia (theo-last, đảo-last, run-length, transition, AI-stat); chọn phía đa số; hòa → đảo; đánh liên tục để phủ nhiều kịch bản.",
                10 => "11) Lịch chẻ 10 tay: Tay 1–5 theo ván cuối, tay 6–10 đảo ván cuối; lặp lại block cố định; đơn giản, dễ dự báo nhịp.",
                11 => "12) KNN chuỗi con: So khớp gần đúng tail k (k=6..3) với Hamming ≤ 1; exact-match tính 2 điểm, near-match 1 điểm; chọn phía điểm cao hơn; hòa → đảo; không match → theo ván cuối; đánh liên tục.",
                12 => "13) Lịch hai lớp: Lịch pha trộn 10 bước (1–3 theo-last, 4 đảo, 5–7 AI-stat, 8 đảo, 9 theo, 10 AI-stat); lặp lại; cân bằng giữa momentum/mean-revert/thống kê; đánh liên tục.",
                13 => "14) AI học tại chỗ (n-gram): Học dần từ kết quả thật; dùng tần suất có làm mịn + backoff; hòa → đảo 1–1; bộ nhớ cố định, không phình.",
                14 => "15) Bỏ phiếu Top10 có điều kiện; Loss-Guard động; Hard-guard tự bật khi L≥5 và tự gỡ khi thắng 2 ván liên tục hoặc w20>55%; hòa 5–5 đánh ngẫu nhiên; 6–4 nhưng conf<0.60 thì fallback theo Regime (ZIGZAG=ZigFollow, còn lại=FollowPrev). Ưu tiên “ăn trend” khi guard ON. Re-seed sau mỗi ván (tối đa 50 tay)",
                15 => "16) TOP10 TÍCH LŨY (khởi từ 50 P/B). Khởi tạo thống kê từ 50 kết quả đầu vào (P/B). Mỗi kết quả mới: cộng dồn cho chuỗi dài 10 “mới về”. Luôn đánh theo chuỗi có bộ đếm lớn nhất; chỉ chuyển chuỗi khi THẮNG và chuỗi mới có đếm ≥ hiện tại.",
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
                0 => "1) Chuỗi P/B tự nhập: So khớp chuỗi P/B cấu hình thủ công (cũ→mới); khi khớp mẫu gần nhất sẽ đặt theo cửa chỉ định; không khớp dùng logic mặc định.",
                1 => "2) Thế cầu P/B tự nhập: Ánh xạ 'mẫu quá khứ → cửa kế tiếp' theo danh sách quy tắc; ưu tiên mẫu dài và khớp gần nhất; hỗ trợ ',', ';', '|', hoặc xuống dòng.",
                2 => "3) Chuỗi I/N: So khớp dãy Ít/Nhiều (I/N) cấu hình thủ công; khớp thì đặt theo chỉ định; không khớp dùng logic mặc định.",
                3 => "4) Thế cầu I/N: Ánh xạ mẫu I/N → cửa kế tiếp; ưu tiên mẫu dài; cho phép nhiều luật trong cùng danh sách.",
                4 => "5) Theo cầu trước (thông minh): Dựa vào ván gần nhất và heuristics nội bộ; đánh liên tục; quản lý vốn theo chuỗi tiền, cut_profit/cut_loss.",
                5 => "6) Cửa đặt ngẫu nhiên: Mỗi ván chọn P/B ngẫu nhiên; vẫn tuân theo MoneyManager và ngưỡng cắt lãi/lỗ.",
                6 => "7) Bám cầu P/B (thống kê): Duyệt k từ lớn→nhỏ (k=6 mặc định); đếm tần suất P/B sau các lần khớp đuôi; chọn phía đa số; hòa → đảo 1–1; không có mẫu → theo ván cuối; đánh liên tục.",
                7 => "8) Xu hướng chuyển trạng thái: Thống kê 6 chuyển gần nhất giữa các ván ('lặp' vs 'đảo'); nếu 'đảo' nhiều hơn → đánh ngược ván cuối; ngược lại → theo ván cuối; đánh liên tục.",
                8 => "9) Run-length (dài chuỗi): Tính độ dài chuỗi ký tự cuối; nếu run ≥ T (mặc định T=3) → đảo để mean-revert; nếu run ngắn → theo đà (momentum); đánh liên tục.",
                9 => "10) Chuyên gia bỏ phiếu: Kết hợp 5 chuyên gia (theo-last, đảo-last, run-length, transition, AI-stat); chọn phía đa số; hòa → đảo; đánh liên tục để phủ nhiều kịch bản.",
                10 => "11) Lịch chẻ 10 tay: Tay 1–5 theo ván cuối, tay 6–10 đảo ván cuối; lặp lại block cố định; đơn giản, dễ dự báo nhịp.",
                11 => "12) KNN chuỗi con: So khớp gần đúng tail k (k=6..3) với Hamming ≤ 1; exact-match tính 2 điểm, near-match 1 điểm; chọn phía điểm cao hơn; hòa → đảo; không match → theo ván cuối; đánh liên tục.",
                12 => "13) Lịch hai lớp: Lịch pha trộn 10 bước (1–3 theo-last, 4 đảo, 5–7 AI-stat, 8 đảo, 9 theo, 10 AI-stat); lặp lại; cân bằng giữa momentum/mean-revert/thống kê; đánh liên tục.",
                13 => "14) AI học tại chỗ (n-gram): Học dần từ kết quả thật; dùng tần suất có làm mịn + backoff; hòa → đảo 1–1; bộ nhớ cố định, không phình.",
                14 => "15) Bỏ phiếu Top10 có điều kiện; Loss-Guard động; Hard-guard tự bật khi L≥5 và tự gỡ khi thắng 2 ván liên tục hoặc w20>55%; hòa 5–5 đánh ngẫu nhiên; 6–4 nhưng conf<0.60 thì fallback theo Regime (ZIGZAG=ZigFollow, còn lại=FollowPrev). Ưu tiên “ăn trend” khi guard ON. Re-seed sau mỗi ván (tối đa 50 tay)",
                15 => "16) TOP10 TÍCH LŨY (khởi từ 50 P/B). Khởi tạo thống kê từ 50 kết quả đầu vào (P/B). Mỗi kết quả mới: cộng dồn cho chuỗi dài 10 “mới về”. Luôn đánh theo chuỗi có bộ đếm lớn nhất; chỉ chuyển chuỗi khi THẮNG và chuỗi mới có đếm ≥ hiện tại.",
                _ => "Chiến lược chưa xác định."
            };
        }


        private async void NewWindowRequested(object? s, CoreWebView2NewWindowRequestedEventArgs e)
        {
            var deferral = e.GetDeferral();
            try
            {
                var target = (e.Uri ?? "").Trim();
                Log("[NewWindowRequested] " + (string.IsNullOrWhiteSpace(target) ? "<empty>" : target));

                var popupWeb = await EnsurePopupWebReadyAsync();
                if (popupWeb?.CoreWebView2 != null)
                {
                    await Dispatcher.InvokeAsync(() =>
                    {
                        if (Web != null)
                            Web.Visibility = Visibility.Collapsed;
                        if (PopupHost != null)
                            PopupHost.Visibility = Visibility.Visible;
                    });

                    e.NewWindow = popupWeb.CoreWebView2;
                    popupWeb.Focus();
                }
                else
                {
                    e.Handled = true;
                    if (!string.IsNullOrWhiteSpace(target))
                        Web?.CoreWebView2?.Navigate(target);
                }
            }
            catch (Exception ex) { Log("[NewWindowRequested] " + ex); }
            finally
            {
                try { deferral.Complete(); } catch { }
            }
        }

        private async Task<WebView2?> EnsurePopupWebReadyAsync()
        {
            if (PopupWebHost == null) return null;

            WebView2? popupWeb = null;
            await Dispatcher.InvokeAsync(() =>
            {
                if (_popupWeb == null)
                {
                    _popupWeb = new WebView2
                    {
                        CreationProperties = new CoreWebView2CreationProperties
                        {
                            AdditionalBrowserArguments = "--disable-gpu",
                            UserDataFolder = Wv2UserDataDir
                        }
                    };
                    PopupWebHost.Children.Clear();
                    PopupWebHost.Children.Add(_popupWeb);
                }

                popupWeb = _popupWeb;
            });

            if (popupWeb == null) return null;

            if (popupWeb.CoreWebView2 == null)
            {
                if (_webEnv == null)
                    await EnsureWebReadyAsync();

                if (_webEnv != null)
                    await popupWeb.EnsureCoreWebView2Async(_webEnv);
                else
                    await popupWeb.EnsureCoreWebView2Async();
            }

            if (popupWeb.CoreWebView2 == null) return popupWeb;

            var settings = popupWeb.CoreWebView2.Settings;
            if (settings != null)
            {
                settings.IsWebMessageEnabled = true;
                settings.AreDefaultContextMenusEnabled = false;
                settings.AreDevToolsEnabled = true;
            }

            if (!_popupBridgeRegistered)
            {
                await EnsurePopupBridgeRegisteredAsync();
                _popupBridgeRegistered = true;
            }

            if (!_popupWebMsgHooked)
            {
                popupWeb.CoreWebView2.WebMessageReceived += PopupWeb_WebMessageReceived;
                _popupWebMsgHooked = true;
            }

            if (!_popupWebHooked)
            {
                popupWeb.CoreWebView2.NewWindowRequested += PopupWeb_NewWindowRequested;
                popupWeb.CoreWebView2.WindowCloseRequested += PopupWeb_WindowCloseRequested;
                popupWeb.CoreWebView2.SourceChanged += PopupWeb_SourceChanged;
                popupWeb.CoreWebView2.ContentLoading += PopupWeb_ContentLoading;
                popupWeb.NavigationStarting += PopupWeb_NavigationStarting;
                popupWeb.NavigationCompleted += PopupWeb_NavigationCompleted;
                _popupWebHooked = true;
            }

            _ = EnableCdpNetworkTapAsync(popupWeb, "popup");
            Log("[PopupWeb] ready");
            return popupWeb;
        }

        private async Task EnsurePopupBridgeRegisteredAsync()
        {
            if (_popupWeb?.CoreWebView2 == null) return;

            _homeJs ??= await LoadHomeJsAsync();

            await _popupWeb.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(TOP_FORWARD);

            if (!string.IsNullOrEmpty(_appJs))
                await _popupWeb.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(_appJs);

            if (!string.IsNullOrEmpty(_homeJs))
                await _popupWeb.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(_homeJs);
            await _popupWeb.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(GAME_TABLE_PUSH_JS);

            await _popupWeb.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(FRAME_AUTOSTART);
            await _popupWeb.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(BuildHomeAutostartJs(_homePushMs));
            _popupWeb.CoreWebView2.FrameCreated += PopupCoreWebView2_FrameCreated_Bridge;
            _popupWeb.CoreWebView2.DOMContentLoaded += PopupCore_DOMContentLoaded_Bridge;
            Log("[PopupWeb] bridge registered");
        }

        private async void PopupWeb_WebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
        {
            JsonDocument? parsedDoc = null;
            try
            {
                if (!TryPrepareWebMessage(e, out var display, out parsedDoc))
                    return;

                var root = parsedDoc.RootElement.Clone();
                if (TryPublishRoomsFromTableUpdate(root, "popup/webmsg"))
                    return;
                if (await TryHandleOverlayBridgeMessageAsync(root))
                    return;
                if (TryHandleBetBridgeMessage(root))
                    return;
            }
            catch (Exception ex)
            {
                Log("[PopupWeb.WebMessageReceived] " + ex.Message);
            }
            finally
            {
                parsedDoc?.Dispose();
            }
        }

        private async Task InjectOnPopupDocAsync()
        {
            if (_popupWeb?.CoreWebView2 == null) return;

            string key = "";
            try
            {
                var json = await _popupWeb.CoreWebView2.ExecuteScriptAsync(
                    "(function(){try{return String(performance.timeOrigin)}catch(_){return String(Date.now())}})()");
                key = JsonSerializer.Deserialize<string>(json) ?? "";
            }
            catch { }

            if (!string.IsNullOrEmpty(key) && key != _popupLastDocKey)
            {
                await _popupWeb.CoreWebView2.ExecuteScriptAsync(TOP_FORWARD);
                if (!string.IsNullOrEmpty(_appJs))
                    await _popupWeb.CoreWebView2.ExecuteScriptAsync(_appJs);
                if (!string.IsNullOrEmpty(_homeJs))
                    await _popupWeb.CoreWebView2.ExecuteScriptAsync(_homeJs);
                await _popupWeb.CoreWebView2.ExecuteScriptAsync(GAME_TABLE_PUSH_JS);
                await _popupWeb.CoreWebView2.ExecuteScriptAsync(FRAME_AUTOSTART);
                await _popupWeb.CoreWebView2.ExecuteScriptAsync(BuildHomeAutostartJs(_homePushMs));
                _popupLastDocKey = key;
                Log("[PopupWeb] bridge injected, key=" + key);
            }
        }

        private void PopupCoreWebView2_FrameCreated_Bridge(object? sender, CoreWebView2FrameCreatedEventArgs e)
        {
            try
            {
                var f = e.Frame;
                _ = f.ExecuteScriptAsync(FRAME_SHIM);
                if (!string.IsNullOrEmpty(_appJs))
                    _ = f.ExecuteScriptAsync(_appJs);
                if (!string.IsNullOrEmpty(_homeJs))
                    _ = f.ExecuteScriptAsync(_homeJs);
                _ = f.ExecuteScriptAsync(GAME_TABLE_PUSH_JS);
                _ = f.ExecuteScriptAsync(FRAME_AUTOSTART);
                Log("[PopupWeb] frame injected + autostart armed.");

                f.DOMContentLoaded += PopupFrame_DOMContentLoaded_Bridge;
                f.NavigationCompleted += PopupFrame_NavigationCompleted_Bridge;
            }
            catch (Exception ex)
            {
                Log("[PopupWeb.FrameCreated] " + ex.Message);
            }
        }

        private async void PopupCore_DOMContentLoaded_Bridge(object? sender, CoreWebView2DOMContentLoadedEventArgs e)
        {
            try
            {
                await InjectOnPopupDocAsync();
                Dispatcher.BeginInvoke(new Action(ApplyMouseShieldFromCheck));
            }
            catch (Exception ex)
            {
                Log("[PopupWeb.DOMContentLoaded] " + ex.Message);
            }
        }

        private void PopupFrame_DOMContentLoaded_Bridge(object? sender, CoreWebView2DOMContentLoadedEventArgs e)
        {
            try
            {
                var f = sender as CoreWebView2Frame;
                if (f == null) return;

                _ = f.ExecuteScriptAsync(FRAME_SHIM);
                if (!string.IsNullOrEmpty(_appJs))
                    _ = f.ExecuteScriptAsync(_appJs);
                if (!string.IsNullOrEmpty(_homeJs))
                    _ = f.ExecuteScriptAsync(_homeJs);
                _ = f.ExecuteScriptAsync(GAME_TABLE_PUSH_JS);
                _ = f.ExecuteScriptAsync(FRAME_AUTOSTART);
                Log("[PopupWeb] frame DOMContentLoaded -> reinjected + autostart.");
            }
            catch (Exception ex)
            {
                Log("[PopupWeb.FrameDOMContentLoaded] " + ex.Message);
            }
        }

        private void PopupFrame_NavigationCompleted_Bridge(object? sender, CoreWebView2NavigationCompletedEventArgs e)
        {
            try
            {
                if (!e.IsSuccess) return;
                var f = sender as CoreWebView2Frame;
                if (f == null) return;

                _ = f.ExecuteScriptAsync(FRAME_SHIM);
                if (!string.IsNullOrEmpty(_appJs))
                    _ = f.ExecuteScriptAsync(_appJs);
                if (!string.IsNullOrEmpty(_homeJs))
                    _ = f.ExecuteScriptAsync(_homeJs);
                _ = f.ExecuteScriptAsync(GAME_TABLE_PUSH_JS);
                _ = f.ExecuteScriptAsync(FRAME_AUTOSTART);
                Log("[PopupWeb] frame NavigationCompleted -> reinjected + autostart.");
            }
            catch (Exception ex)
            {
                Log("[PopupWeb.FrameNavigationCompleted] " + ex.Message);
            }
        }

        private void PopupWeb_NewWindowRequested(object? sender, CoreWebView2NewWindowRequestedEventArgs e)
        {
            try
            {
                var target = (e.Uri ?? "").Trim();
                Log("[PopupWeb.NewWindowRequested] " + (string.IsNullOrWhiteSpace(target) ? "<empty>" : target));
                if (!string.IsNullOrWhiteSpace(target))
                {
                    e.Handled = true;
                    _popupWeb?.CoreWebView2?.Navigate(target);
                }
            }
            catch (Exception ex)
            {
                Log("[PopupWeb.NewWindowRequested] " + ex.Message);
            }
        }

        private void PopupWeb_SourceChanged(object? sender, object e)
        {
            try
            {
                Log("[PopupWeb] SourceChanged: " + (_popupWeb?.Source?.ToString() ?? "(null)"));
            }
            catch { }
        }

        private void PopupWeb_ContentLoading(object? sender, CoreWebView2ContentLoadingEventArgs e)
        {
            try
            {
                Log($"[PopupWeb] ContentLoading: isError={e.IsErrorPage} navId={e.NavigationId}");
            }
            catch { }
        }

        private void PopupWeb_NavigationStarting(object? sender, CoreWebView2NavigationStartingEventArgs e)
        {
            try
            {
                ClearLatestNetworkRooms("popup-nav-start");
                Log("[PopupWeb] NavigationStarting: " + (e.Uri ?? ""));
            }
            catch { }
        }

        private async void PopupWeb_NavigationCompleted(object? sender, CoreWebView2NavigationCompletedEventArgs e)
        {
            try
            {
                var src = _popupWeb?.CoreWebView2?.Source ?? "";
                Log("[PopupWeb] NavigationCompleted: " + (e.IsSuccess ? "OK" : ("Err " + e.WebErrorStatus)) + " | " + src);
                if (e.IsSuccess)
                {
                    await InjectOnPopupDocAsync();
                    Dispatcher.BeginInvoke(new Action(ApplyMouseShieldFromCheck));
                }
            }
            catch (Exception ex)
            {
                Log("[PopupWeb.NavigationCompleted] " + ex.Message);
            }
        }

        private async void BtnClosePopup_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                if (_popupWeb?.CoreWebView2 != null)
                {
                    Log("[PopupWeb] close requested by button");
                    try
                    {
                        await _popupWeb.CoreWebView2.ExecuteScriptAsync("try { window.close(); } catch(e) { 'close-error'; }");
                    }
                    catch { }
                    await Task.Delay(150);
                }
            }
            catch (Exception ex)
            {
                Log("[PopupWeb.CloseButton] " + ex.Message);
            }

            ClosePopupHost();
        }

        private void PopupWeb_WindowCloseRequested(object? sender, object e)
        {
            try
            {
                Log("[PopupWeb] WindowCloseRequested");
                Dispatcher.BeginInvoke(new Action(ClosePopupHost));
            }
            catch (Exception ex)
            {
                Log("[PopupWeb.WindowCloseRequested] " + ex.Message);
            }
        }

        private bool TryPublishRoomsFromTableUpdate(JsonElement root, string source)
        {
            try
            {
                if (!root.TryGetProperty("abx", out var abxEl) ||
                    !string.Equals(abxEl.GetString(), "table_update", StringComparison.OrdinalIgnoreCase))
                    return false;

                if (!root.TryGetProperty("tables", out var tablesEl) || tablesEl.ValueKind != JsonValueKind.Array)
                    return false;

                var rooms = new List<RoomEntry>();
                foreach (var it in tablesEl.EnumerateArray())
                {
                    var id = it.TryGetProperty("id", out var idEl) ? (idEl.GetString() ?? "").Trim() : "";
                    var name = it.TryGetProperty("name", out var nameEl) ? (nameEl.GetString() ?? "").Trim() : "";
                    if (string.IsNullOrWhiteSpace(name) && string.IsNullOrWhiteSpace(id))
                        continue;
                    if (string.IsNullOrWhiteSpace(id))
                        id = name;
                    if (string.IsNullOrWhiteSpace(name))
                        name = id;
                    rooms.Add(new RoomEntry { Id = id, Name = name });
                }

                rooms = rooms
                    .Where(r => !string.IsNullOrWhiteSpace(r.Name))
                    .Where(r => !IsLobbyNoiseName(r.Name))
                    .GroupBy(r => string.IsNullOrWhiteSpace(r.Id) ? r.Name : r.Id, StringComparer.OrdinalIgnoreCase)
                    .Select(g => g.First())
                    .OrderBy(r => BuildRoomDisplaySortKey(r.Name), StringComparer.Ordinal)
                    .ToList();

                if (rooms.Count == 0)
                    return false;

                _lastTableUpdateAt = DateTime.UtcNow;
                Log("[ROOMMSG] table_update rooms=" + rooms.Count + " source=" + source + " sample=" + Sample(rooms.Select(r => r.Name), 6));
                PublishLatestNetworkRooms(rooms, $"{source} via table_update");
                return true;
            }
            catch
            {
                return false;
            }
        }

        private bool TryHandleBetBridgeMessage(JsonElement root)
        {
            if (!root.TryGetProperty("abx", out var abxEl))
                return false;

            var abxStr = abxEl.GetString() ?? "";
            if (abxStr == "bet")
            {
                string tableId = root.TryGetProperty("tableId", out var tidEl) ? (tidEl.GetString() ?? "") : "";
                if (string.IsNullOrWhiteSpace(tableId) && root.TryGetProperty("id", out var idEl2))
                    tableId = idEl2.GetString() ?? "";
                string tableName = root.TryGetProperty("name", out var tnameEl) ? (tnameEl.GetString() ?? "") : "";
                if (string.IsNullOrWhiteSpace(tableName) && !string.IsNullOrWhiteSpace(tableId))
                    tableName = ResolveRoomName(tableId);
                var expectedGameId = InferExpectedGameIdByTable(tableId, tableName);
                var pendingKey = BuildPendingBetKey(expectedGameId, tableId);
                if (string.IsNullOrWhiteSpace(pendingKey) && !string.IsNullOrWhiteSpace(tableId))
                    pendingKey = tableId.Trim();

                string sideRaw = root.TryGetProperty("side", out var se) ? (se.GetString() ?? "") : "";
                long amount = root.TryGetProperty("amount", out var ae) ? ReadJsonLong(ae) : 0;
                string side = NormalizeSide(sideRaw);
                if (string.IsNullOrWhiteSpace(side))
                    side = sideRaw.ToUpperInvariant();

                var sig = $"{tableId}|{side}|{amount}";
                var nowMs = Environment.TickCount64;
                if (sig == _lastBetSig && (nowMs - _lastBetSigAtMs) < 500)
                {
                    Log($"[HIST][SKIP] duplicate table={tableId} side={side} amount={amount:N0} deltaMs={nowMs - _lastBetSigAtMs}");
                    return true;
                }
                _lastBetSig = sig;
                _lastBetSigAtMs = nowMs;

                var tableIdLog = string.IsNullOrWhiteSpace(tableId) ? "?" : tableId;
                Log($"[BET] {tableIdLog} {side} {amount:N0}");

                if (!string.IsNullOrWhiteSpace(tableId))
                {
                    var taskState = GetOrCreateTableTaskState(tableId, tableName);
                    taskState.RunTotalBet += Math.Max(0, amount);
                    _ = Dispatcher.BeginInvoke(new Action(RefreshRuntimeStatusTotalsUi));
                }

                double accNow = 0;
                try { accNow = ParseMoneyOrZero(LblAmount?.Text ?? "0"); } catch { }

                _pendingRow = new BetRow
                {
                    At = DateTime.Now,
                    Game = "Baccarat WM",
                    TableId = tableId,
                    Table = tableName,
                    Stake = amount,
                    Side = side,
                    Result = "-",
                    WinLose = "-",
                    Account = accNow,
                    PendingGameId = expectedGameId,
                    PendingKey = pendingKey
                };

                if (!string.IsNullOrWhiteSpace(pendingKey))
                {
                    lock (_pendingBetGate)
                    {
                        if (_pendingBetsByTable.TryGetValue(pendingKey, out var prev) && prev != null)
                            Log($"[HIST][REPLACE] table={tableId} key={pendingKey} prevSide={prev.Side} prevStake={prev.Stake:N0} newSide={side} newStake={amount:N0}");
                        _pendingBetsByTable[pendingKey] = _pendingRow;
                    }
                }

                _betAll.Insert(0, _pendingRow);
                if (_betAll.Count > MaxHistory) _betAll.RemoveAt(_betAll.Count - 1);
                Log($"[HIST][ADD] table={tableIdLog} game={expectedGameId} key={pendingKey} name={tableName} side={side} amount={amount:N0} total={_betAll.Count}");
                if (_autoFollowNewest)
                    ShowFirstPage();
                else
                    RefreshCurrentPage();
                return true;
            }

            if (abxStr == "bet_error")
            {
                string side = root.TryGetProperty("side", out var se) ? (se.GetString() ?? "?") : "?";
                long amount = root.TryGetProperty("amount", out var ae) ? ReadJsonLong(ae) : 0;
                string error = root.TryGetProperty("error", out var ee) ? (ee.GetString() ?? "") : "";
                Log($"[BET][ERR] {side} {amount} :: {error}");
                return true;
            }

            return false;
        }

        private async Task<bool> TryHandleOverlayBridgeMessageAsync(JsonElement root)
        {
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
                    Log("[OVERLAY] play click id=" + id + " name=" + name);
                    await ToggleTablePlayAsync(id, name);
                }
                if (ev == "state")
                {
                    if (root.TryGetProperty("tables", out var tablesEl) &&
                        tablesEl.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var it in tablesEl.EnumerateArray())
                        {
                            var id = it.TryGetProperty("id", out var idElState) ? (idElState.GetString() ?? "") : "";
                            if (string.IsNullOrWhiteSpace(id)) continue;
                            var name = it.TryGetProperty("name", out var nElState) ? (nElState.GetString() ?? "") : "";
                            var text = it.TryGetProperty("text", out var textEl) ? (textEl.GetString() ?? "") : "";
                            var historyText = it.TryGetProperty("historyText", out var htEl) ? (htEl.GetString() ?? "") : "";
                            var historyEl = it.TryGetProperty("history", out var hEl) ? hEl : default;

                            double countdown = 0;
                            if (it.TryGetProperty("countdown", out var cEl))
                            {
                                if (cEl.ValueKind == JsonValueKind.Number)
                                    countdown = cEl.GetDouble();
                                else if (cEl.ValueKind == JsonValueKind.String &&
                                         double.TryParse(cEl.GetString(), NumberStyles.Any, CultureInfo.InvariantCulture, out var cval))
                                    countdown = cval;
                            }

                            UpdateOverlayStateFromJs(id, name, text, historyEl, historyText, countdown);
                        }
                    }
                    return true;
                }
                if (ev == "profit")
                {
                    // Ignore overlay text-derived profit snapshots.
                    // Current-run profit is tracked from finalized bet results in C# and is more reliable.
                    return true;
                }
                if (ev == "blur")
                {
                    ClearActiveTableFocus();
                }
                return true;
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
                return true;
            }

            return false;
        }

        private void ClosePopupHost()
        {
            try
            {
                ClearLatestNetworkRooms("popup-close");
                if (PopupHost != null)
                    PopupHost.Visibility = Visibility.Collapsed;
                if (Web != null)
                    Web.Visibility = Visibility.Visible;
                DestroyPopupWeb();
                Web?.Focus();
                Log("[PopupWeb] closed");
            }
            catch (Exception ex)
            {
                Log("[PopupWeb.Close] " + ex.Message);
            }
        }

        private void DestroyPopupWeb()
        {
            var popupWeb = _popupWeb;
            _popupWeb = null;
            _popupWebHooked = false;
            _popupBridgeRegistered = false;
            _popupLastDocKey = null;
            _cdpNetworkOnPopup = false;

            if (popupWeb == null)
                return;

            try
            {
                if (popupWeb.CoreWebView2 != null)
                {
                    _ = DisableCdpNetworkTapAsync(popupWeb, "popup");
                    popupWeb.CoreWebView2.NewWindowRequested -= PopupWeb_NewWindowRequested;
                    popupWeb.CoreWebView2.WindowCloseRequested -= PopupWeb_WindowCloseRequested;
                    popupWeb.CoreWebView2.WebMessageReceived -= PopupWeb_WebMessageReceived;
                    popupWeb.CoreWebView2.SourceChanged -= PopupWeb_SourceChanged;
                    popupWeb.CoreWebView2.ContentLoading -= PopupWeb_ContentLoading;
                    popupWeb.CoreWebView2.FrameCreated -= PopupCoreWebView2_FrameCreated_Bridge;
                    popupWeb.CoreWebView2.DOMContentLoaded -= PopupCore_DOMContentLoaded_Bridge;
                    try { popupWeb.CoreWebView2.Navigate("about:blank"); } catch { }
                    try { popupWeb.CoreWebView2.Stop(); } catch { }
                }
            }
            catch { }

            try { popupWeb.NavigationStarting -= PopupWeb_NavigationStarting; } catch { }
            try { popupWeb.NavigationCompleted -= PopupWeb_NavigationCompleted; } catch { }

            try
            {
                if (PopupWebHost != null)
                    PopupWebHost.Children.Remove(popupWeb);
            }
            catch { }

            try { popupWeb.Dispose(); } catch { }
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

        // Luồng cũ: gọi tự động mở game live từ HOME.
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
                    Log("[HOME][LEGACY] play via JS: ok");
                    return true;
                }

                // fallback: gọi theo "nút" (host -> page)
                var msg = JsonSerializer.Serialize(new { cmd = "home_click_xoc" });
                Web.CoreWebView2.PostWebMessageAsJson(msg);
                Log("[HOME][LEGACY] sent host cmd: home_click_xoc");
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
        private Task EnableCdpNetworkTapAsync()
            => EnableCdpNetworkTapAsync(Web, "main");

        private async Task EnableCdpNetworkTapAsync(WebView2? targetWeb, string scope)
        {
            var core = targetWeb?.CoreWebView2;
            if (core == null) return;

            bool alreadyOn = string.Equals(scope, "popup", StringComparison.OrdinalIgnoreCase)
                ? _cdpNetworkOnPopup
                : _cdpNetworkOnMain;
            if (alreadyOn) return;

            try
            {
                await core.CallDevToolsProtocolMethodAsync("Network.enable", "{}");
                if (string.Equals(scope, "popup", StringComparison.OrdinalIgnoreCase))
                    _cdpNetworkOnPopup = true;
                else
                    _cdpNetworkOnMain = true;

                core.GetDevToolsProtocolEventReceiver("Network.webSocketCreated")
                   .DevToolsProtocolEventReceived += (s, e) =>
                   {
                       try
                       {
                           using var doc = JsonDocument.Parse(e.ParameterObjectAsJson);
                           var root = doc.RootElement;
                           var reqId = root.GetProperty("requestId").GetString() ?? "";
                           var url = root.TryGetProperty("url", out var u) ? (u.GetString() ?? "") : "";
                           if (!string.IsNullOrEmpty(reqId)) _wsUrlByRequestId[scope + "|" + reqId] = url;
                           if (IsInteresting(url)) LogPacket($"{scope}.WS.created", url, "", false);
                       }
                       catch (Exception ex) { Log($"[CDP {scope} wsCreated] " + ex.Message); }
                   };

                core.GetDevToolsProtocolEventReceiver("Network.webSocketFrameReceived")
                   .DevToolsProtocolEventReceived += (s, e) =>
                   {
                       try
                       {
                           using var doc = JsonDocument.Parse(e.ParameterObjectAsJson);
                           var root = doc.RootElement;
                           var reqId = root.GetProperty("requestId").GetString() ?? "";
                           _wsUrlByRequestId.TryGetValue(scope + "|" + reqId, out var url);
                           var resp = root.GetProperty("response");
                           var payload = resp.TryGetProperty("payloadData", out var pd) ? (pd.GetString() ?? "") : "";
                           var opcode = resp.TryGetProperty("opcode", out var op) ? op.GetInt32() : 1;
                           var isBin = opcode != 1;
                           if (ShouldLogPacketPayload(url, "", payload, isBin))
                               LogPacket($"{scope}.WS.recv", url, PreviewPayload(payload, isBin), isBin);
                           TryUpdateOverlayServerStateFromPayload(scope, "WS.recv", url, payload, isBin);
                           TryUpdateLatestNetworkRoomsFromPayload(scope, "WS.recv", url, payload, isBin);
                       }
                       catch (Exception ex) { Log($"[CDP {scope} wsRecv] " + ex.Message); }
                   };

                core.GetDevToolsProtocolEventReceiver("Network.webSocketFrameSent")
                   .DevToolsProtocolEventReceived += (s, e) =>
                   {
                       try
                       {
                           using var doc = JsonDocument.Parse(e.ParameterObjectAsJson);
                           var root = doc.RootElement;
                           var reqId = root.GetProperty("requestId").GetString() ?? "";
                           _wsUrlByRequestId.TryGetValue(scope + "|" + reqId, out var url);
                           var resp = root.GetProperty("response");
                           var payload = resp.TryGetProperty("payloadData", out var pd) ? (pd.GetString() ?? "") : "";
                           var opcode = resp.TryGetProperty("opcode", out var op) ? op.GetInt32() : 1;
                           var isBin = opcode != 1;
                           if (ShouldLogPacketPayload(url, "", payload, isBin))
                               LogPacket($"{scope}.WS.send", url, PreviewPayload(payload, isBin), isBin);
                       }
                       catch (Exception ex) { Log($"[CDP {scope} wsSend] " + ex.Message); }
                   };

                core.GetDevToolsProtocolEventReceiver("Network.responseReceived")
                   .DevToolsProtocolEventReceived += (s, e) =>
                   {
                       try
                       {
                           using var doc = JsonDocument.Parse(e.ParameterObjectAsJson);
                           var root = doc.RootElement;
                           var reqId = root.GetProperty("requestId").GetString() ?? "";
                           var resp = root.GetProperty("response");
                           var url = resp.TryGetProperty("url", out var u) ? (u.GetString() ?? "") : "";
                           var mime = resp.TryGetProperty("mimeType", out var m) ? (m.GetString() ?? "") : "";
                           var status = resp.TryGetProperty("status", out var st) ? st.ToString() : "";
                           if (!string.IsNullOrEmpty(reqId))
                           {
                               _respUrlByRequestId[scope + "|" + reqId] = url;
                               _respMimeByRequestId[scope + "|" + reqId] = mime;
                           }
                           if (IsInteresting(url) || IsInterestingMime(mime))
                               LogPacket($"{scope}.HTTP.response", url, $"status={status} mime={mime}", false);
                       }
                       catch (Exception ex) { Log($"[CDP {scope} responseReceived] " + ex.Message); }
                   };

                core.GetDevToolsProtocolEventReceiver("Network.loadingFinished")
                   .DevToolsProtocolEventReceived += async (s, e) =>
                   {
                       try
                       {
                           using var doc = JsonDocument.Parse(e.ParameterObjectAsJson);
                           var root = doc.RootElement;
                           var reqId = root.GetProperty("requestId").GetString() ?? "";
                           var key = scope + "|" + reqId;
                           _respUrlByRequestId.TryGetValue(key, out var url);
                           _respMimeByRequestId.TryGetValue(key, out var mime);
                           if (!ShouldFetchResponseBody(url, mime))
                               return;

                           var bodyRaw = await core.CallDevToolsProtocolMethodAsync("Network.getResponseBody",
                               JsonSerializer.Serialize(new { requestId = reqId }));
                           if (string.IsNullOrWhiteSpace(bodyRaw))
                               return;

                           using var bodyDoc = JsonDocument.Parse(bodyRaw);
                           var bodyRoot = bodyDoc.RootElement;
                           var body = bodyRoot.TryGetProperty("body", out var bodyEl) ? (bodyEl.GetString() ?? "") : "";
                           var base64Encoded = bodyRoot.TryGetProperty("base64Encoded", out var b64El) && b64El.ValueKind == JsonValueKind.True;
                           if (base64Encoded)
                           {
                               try { body = Encoding.UTF8.GetString(Convert.FromBase64String(body)); } catch { }
                           }

                           if (ShouldLogPacketPayload(url, mime, body, false))
                               LogPacket($"{scope}.HTTP.body", url, PreviewPayload(body, false), false);
                           TryUpdateLatestNetworkRoomsFromPayload(scope, "HTTP.body", url, body, false);
                       }
                       catch (Exception ex) { Log($"[CDP {scope} loadingFinished] " + ex.Message); }
                   };

                Log($"[CDP] Network tap enabled ({scope})");
            }
            catch (Exception ex)
            {
                Log($"[CDP] Enable failed ({scope}): " + ex.Message);
            }
        }

        private Task DisableCdpNetworkTapAsync()
            => DisableCdpNetworkTapAsync(Web, "main");

        private async Task DisableCdpNetworkTapAsync(WebView2? targetWeb, string scope)
        {
            var core = targetWeb?.CoreWebView2;
            bool isOn = string.Equals(scope, "popup", StringComparison.OrdinalIgnoreCase)
                ? _cdpNetworkOnPopup
                : _cdpNetworkOnMain;
            if (!isOn || core == null) return;
            try
            {
                await core.CallDevToolsProtocolMethodAsync("Network.disable", "{}");
                if (string.Equals(scope, "popup", StringComparison.OrdinalIgnoreCase))
                    _cdpNetworkOnPopup = false;
                else
                    _cdpNetworkOnMain = false;
                Log($"[CDP] Network tap disabled ({scope})");
            }
            catch (Exception ex) { Log($"[CDP] Disable failed ({scope}): " + ex.Message); }
        }

        private bool IsInteresting(string? url)
        {
            if (string.IsNullOrWhiteSpace(url)) return true;
            foreach (var hint in _pktInterestingHints)
                if (url.IndexOf(hint, StringComparison.OrdinalIgnoreCase) >= 0) return true;
            return false;
        }

        private bool IsInterestingMime(string? mime)
        {
            if (string.IsNullOrWhiteSpace(mime)) return false;
            mime = mime.ToLowerInvariant();
            return mime.Contains("json") || mime.Contains("javascript") || mime.Contains("text/plain") || mime.Contains("octet-stream");
        }

        private bool ShouldFetchResponseBody(string? url, string? mime)
        {
            if (string.IsNullOrWhiteSpace(url)) return false;
            if (IsInteresting(url) && IsInterestingMime(mime)) return true;
            var lower = url.ToLowerInvariant();
            return lower.Contains("lobby") || lower.Contains("table") || lower.Contains("baccarat") || lower.Contains("game");
        }

        private bool ShouldLogPacketPayload(string? url, string? mime, string payload, bool isBinary)
        {
            if (string.IsNullOrWhiteSpace(payload)) return false;
            var lower = NormalizePacketPayload(payload, isBinary).ToLowerInvariant();
            if (string.IsNullOrWhiteSpace(lower))
                return IsInteresting(url);
            if (lower.Contains("baccarat") || lower.Contains("\"table") || lower.Contains("\"game") || lower.Contains("\"room") || lower.Contains("multibaccarat"))
                return true;
            return IsInteresting(url) || IsInterestingMime(mime);
        }

        private string PreviewPayload(string payload, bool isBinary)
        {
            if (string.IsNullOrEmpty(payload)) return "";
            try
            {
                var normalized = NormalizePacketPayload(payload, isBinary);
                if (!isBinary)
                {
                    var s = normalized.Trim();
                    if (s.StartsWith("{") || s.StartsWith("["))
                    {
                        if (s.Length > 2000) s = s.Substring(0, 2000) + "…";
                        return s;
                    }
                    if (s.Length > 2000) s = s.Substring(0, 2000) + "…";
                    return s;
                }
                if (!string.IsNullOrWhiteSpace(normalized) && normalized != payload)
                {
                    var s = normalized.Trim();
                    if (s.Length > 2000) s = s.Substring(0, 2000) + "â€¦";
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

        private string NormalizePacketPayload(string payload, bool isBinary)
        {
            var raw = (payload ?? "").Trim();
            if (string.IsNullOrWhiteSpace(raw))
                return "";
            if (!isBinary)
                return raw;
            if (!LooksLikeBase64Packet(raw))
                return raw;
            try
            {
                return Encoding.UTF8.GetString(Convert.FromBase64String(raw));
            }
            catch
            {
                return raw;
            }
        }

        private bool LooksLikeBase64Packet(string text)
        {
            if (string.IsNullOrWhiteSpace(text) || text.Length < 8 || (text.Length % 4) != 0)
                return false;
            foreach (var ch in text)
            {
                if ((ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9') || ch == '+' || ch == '/' || ch == '=')
                    continue;
                return false;
            }
            return true;
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

        private void TryUpdateOverlayServerStateFromPayload(string scope, string kind, string? url, string payload, bool isBinary)
        {
            if (!string.Equals(scope, "popup", StringComparison.OrdinalIgnoreCase))
                return;
            if (!string.Equals(kind, "WS.recv", StringComparison.OrdinalIgnoreCase))
                return;
            if (string.IsNullOrWhiteSpace(payload))
                return;

            var normalized = NormalizePacketPayload(payload, isBinary);
            if (string.IsNullOrWhiteSpace(normalized))
                return;

            foreach (var candidate in ExtractPossibleJsonPayloads(normalized))
            {
                try
                {
                    using var doc = JsonDocument.Parse(candidate);
                    var root = doc.RootElement;
                    if (root.ValueKind != JsonValueKind.Object)
                        continue;
                    var protocol = I(FindKnownString(root, new[] { "protocol" }, 0), -1);
                    if (!root.TryGetProperty("data", out var data) || data.ValueKind != JsonValueKind.Object)
                        continue;

                    if (protocol == 30)
                    {
                        var balanceRaw = data.TryGetProperty("balance", out var balanceEl30)
                            ? (balanceEl30.ValueKind == JsonValueKind.Number ? balanceEl30.GetRawText() : (balanceEl30.GetString() ?? ""))
                            : "";
                        var balanceText = NormalizeWmServerBalanceText(balanceRaw);
                        if (!string.IsNullOrWhiteSpace(balanceText))
                        {
                            _gameBalance = balanceText;
                            _gameBalanceAt = DateTime.UtcNow;
                            _ = Dispatcher.BeginInvoke(new Action(() =>
                            {
                                RefreshDashboardAccountUi(null, null, "protocol30");
                            }));
                            _ = TryRefreshGameUsernameFromActiveHostAsync("probe-game-user");
                        }
                        continue;
                    }

                    if (protocol == 23)
                    {
                        var gameUser = FindKnownString(data, new[] { "userName", "account" }, 1).Trim();
                        var balanceRaw = data.TryGetProperty("balance", out var balanceEl23)
                            ? (balanceEl23.ValueKind == JsonValueKind.Number ? balanceEl23.GetRawText() : (balanceEl23.GetString() ?? ""))
                            : "";
                        var balanceText = NormalizeWmServerBalanceText(balanceRaw);
                        var totalBetRaw = data.TryGetProperty("totalBetMoney", out var totalBetEl23)
                            ? (totalBetEl23.ValueKind == JsonValueKind.Number ? totalBetEl23.GetRawText() : (totalBetEl23.GetString() ?? ""))
                            : "";
                        var totalBetText = NormalizeWmServerBalanceText(totalBetRaw);

                        if (!string.IsNullOrWhiteSpace(gameUser))
                        {
                            _gameUsername = gameUser;
                            _gameUsernameAt = DateTime.UtcNow;
                        }
                        if (!string.IsNullOrWhiteSpace(balanceText))
                        {
                            _gameBalance = balanceText;
                            _gameBalanceAt = DateTime.UtcNow;
                        }
                        if (!string.IsNullOrWhiteSpace(totalBetText))
                        {
                            _gameTotalBet = totalBetText;
                            _gameTotalBetAt = DateTime.UtcNow;
                        }

                        if (!string.IsNullOrWhiteSpace(gameUser) || !string.IsNullOrWhiteSpace(balanceText))
                        {
                            _ = Dispatcher.BeginInvoke(new Action(() =>
                            {
                                RefreshDashboardAccountUi(gameUser, null, "protocol23");
                            }));
                        }
                        else
                        {
                            _ = TryRefreshGameUsernameFromActiveHostAsync("probe-game-user");
                        }
                    }

                    var gameId = I(FindKnownString(data, new[] { "gameID", "gameId" }, 1), -1);
                    var tableId = FindKnownString(data, new[] { "groupID", "groupId" }, 1);
                    if (gameId <= 0 || string.IsNullOrWhiteSpace(tableId))
                        continue;
                    if (!TryResolvePopupServerTable(gameId, tableId, url, out var routeKey, out var resolvedId, out var resolvedName))
                        continue;

                    if (protocol == 26)
                    {
                        var history = ExtractHistoryTokensFromProtocol26(data);
                        var historyRaw = ExtractHistoryRawNodesFromProtocol26(data);
                        UpdatePopupServerRoadState(routeKey, resolvedId, resolvedName, gameId, state =>
                        {
                            state.History = history;
                            state.HistoryRaw = historyRaw;
                            state.HistoryText = string.Join(" ", history);
                            if (string.IsNullOrWhiteSpace(state.Text) && !string.IsNullOrWhiteSpace(state.SessionKey))
                                state.Text = "ID: " + state.SessionKey;
                        }, "protocol26");
                        continue;
                    }

                    if (protocol == 25)
                    {
                        var result = I(FindKnownString(data, new[] { "result" }, 1), 0);
                        var centerResult = MapWmResultDisplay(result);
                        if (string.IsNullOrWhiteSpace(centerResult))
                            continue;
                        int? playerScore = null;
                        if (data.TryGetProperty("playerScore", out var playerScoreEl) && playerScoreEl.ValueKind == JsonValueKind.Number)
                            playerScore = playerScoreEl.GetInt32();
                        int? bankerScore = null;
                        if (data.TryGetProperty("bankerScore", out var bankerScoreEl) && bankerScoreEl.ValueKind == JsonValueKind.Number)
                            bankerScore = bankerScoreEl.GetInt32();
                        UpdatePopupServerRoadState(routeKey, resolvedId, resolvedName, gameId, state =>
                        {
                            state.CenterResult = centerResult;
                            state.PlayerScore = playerScore;
                            state.BankerScore = bankerScore;
                            state.Countdown = null;
                            state.LastCountdownUpdatedUtc = DateTime.MinValue;
                        }, "protocol25");
                        continue;
                    }

                    if (protocol == 21)
                    {
                        var round = FindKnownString(data, new[] { "gameNoRound" }, 1);
                        if (string.IsNullOrWhiteSpace(round))
                            continue;
                        int? keyStatus = null;
                        if (data.TryGetProperty("keyStatus", out var ksEl) && ksEl.ValueKind == JsonValueKind.Number)
                            keyStatus = ksEl.GetInt32();
                        int? tableStatus = null;
                        if (data.TryGetProperty("tableStatus", out var tsEl) && tsEl.ValueKind == JsonValueKind.Number)
                            tableStatus = tsEl.GetInt32();
                        bool? wantShuffle = null;
                        if (data.TryGetProperty("bWantToShuffle", out var shuffleEl) && (shuffleEl.ValueKind == JsonValueKind.True || shuffleEl.ValueKind == JsonValueKind.False))
                            wantShuffle = shuffleEl.GetBoolean();
                        bool? wantEnd = null;
                        if (data.TryGetProperty("bWantToEnd", out var endEl) && (endEl.ValueKind == JsonValueKind.True || endEl.ValueKind == JsonValueKind.False))
                            wantEnd = endEl.GetBoolean();
                        UpdatePopupServerRoadState(routeKey, resolvedId, resolvedName, gameId, state =>
                        {
                            var isNewRound = !string.Equals(state.SessionKey, round, StringComparison.OrdinalIgnoreCase);
                            var shouldClearRoad = wantShuffle == true || string.Equals(round, "0", StringComparison.OrdinalIgnoreCase);
                            state.SessionKey = round;
                            state.Text = "ID: " + round;
                            state.KeyStatus = keyStatus;
                            state.TableStatus = tableStatus;
                            state.WantShuffle = wantShuffle;
                            state.WantEnd = wantEnd;
                            if (shouldClearRoad)
                            {
                                state.History.Clear();
                                state.HistoryRaw.Clear();
                                state.HistoryText = "";
                            }
                            if (isNewRound)
                            {
                                state.CenterResult = "";
                                state.PlayerScore = null;
                                state.BankerScore = null;
                                state.CardValueByArea.Clear();
                                state.BetPlayer = null;
                                state.BetBanker = null;
                                state.BetTie = null;
                                state.TableBetPlayer = null;
                                state.TableBetBanker = null;
                                state.TableBetTie = null;
                                state.Countdown = null;
                                state.LastCountdownUpdatedUtc = DateTime.MinValue;
                            }
                        }, "protocol21");
                        continue;
                    }

                    if (protocol == 22)
                    {
                        if (gameId != 101)
                            continue;
                        if (!data.TryGetProperty("betArr", out var betArrEl) || betArrEl.ValueKind != JsonValueKind.Array)
                            continue;

                        double banker = 0;
                        double player = 0;
                        double tie = 0;
                        foreach (var item in betArrEl.EnumerateArray())
                        {
                            if (item.ValueKind != JsonValueKind.Object)
                                continue;
                            int betArea = 0;
                            if (item.TryGetProperty("betArea", out var areaEl) && areaEl.ValueKind == JsonValueKind.Number)
                                betArea = areaEl.GetInt32();
                            if (betArea <= 0)
                                continue;
                            double addBetMoney = 0;
                            if (item.TryGetProperty("addBetMoney", out var moneyEl) && moneyEl.ValueKind == JsonValueKind.Number)
                            {
                                try { addBetMoney = moneyEl.GetDouble(); }
                                catch { addBetMoney = 0; }
                            }
                            if (addBetMoney <= 0)
                                continue;
                            switch (betArea)
                            {
                                case 1:
                                    banker += addBetMoney;
                                    break;
                                case 2:
                                    player += addBetMoney;
                                    break;
                                case 3:
                                    tie += addBetMoney;
                                    break;
                            }
                        }

                        if (banker <= 0 && player <= 0 && tie <= 0)
                            continue;

                        UpdatePopupServerRoadState(routeKey, resolvedId, resolvedName, gameId, state =>
                        {
                            state.BetBanker = banker > 0 ? banker : null;
                            state.BetPlayer = player > 0 ? player : null;
                            state.BetTie = tie > 0 ? tie : null;
                        }, "protocol22");
                        continue;
                    }

                    if (protocol == 24)
                    {
                        if (gameId != 101)
                            continue;
                        int? cardArea = null;
                        if (data.TryGetProperty("cardArea", out var cardAreaEl) && cardAreaEl.ValueKind == JsonValueKind.Number)
                            cardArea = cardAreaEl.GetInt32();
                        int? cardId = null;
                        if (data.TryGetProperty("cardID", out var cardIdEl) && cardIdEl.ValueKind == JsonValueKind.Number)
                            cardId = cardIdEl.GetInt32();
                        if (!cardArea.HasValue || !cardId.HasValue || cardArea.Value < 1 || cardArea.Value > 6)
                            continue;
                        var point = DecodeWmBaccaratCardPoint(cardId.Value);
                        if (!point.HasValue)
                            continue;
                        UpdatePopupServerRoadState(routeKey, resolvedId, resolvedName, gameId, state =>
                        {
                            state.CardValueByArea[cardArea.Value] = point.Value;
                            state.PlayerScore = SumWmBaccaratScore(state.CardValueByArea, 1, 3, 5);
                            state.BankerScore = SumWmBaccaratScore(state.CardValueByArea, 2, 4, 6);
                        }, "protocol24");
                        continue;
                    }

                    if (protocol == 20)
                    {
                        int? gameStage = null;
                        if (data.TryGetProperty("gameStage", out var stageEl) && stageEl.ValueKind == JsonValueKind.Number)
                            gameStage = stageEl.GetInt32();
                        if (!gameStage.HasValue)
                            continue;
                        UpdatePopupServerRoadState(routeKey, resolvedId, resolvedName, gameId, state =>
                        {
                            state.GameStage = gameStage;
                            if (gameStage == 2 || gameStage == 3)
                            {
                                state.Countdown = null;
                                state.LastCountdownUpdatedUtc = DateTime.MinValue;
                            }
                        }, "protocol20");
                        continue;
                    }

                    if (protocol == 33)
                    {
                        if (gameId != 101)
                            continue;
                        if (!data.TryGetProperty("dtNowBet", out var nowBetEl) || nowBetEl.ValueKind != JsonValueKind.Object)
                            continue;

                        double? banker = null;
                        double? player = null;
                        double? tie = null;

                        static double? ReadBetAreaValue(JsonElement obj, string key)
                        {
                            if (!obj.TryGetProperty(key, out var item) || item.ValueKind != JsonValueKind.Object)
                                return null;
                            if (!item.TryGetProperty("value", out var valueEl) || valueEl.ValueKind != JsonValueKind.Number)
                                return null;
                            try
                            {
                                return valueEl.GetDouble();
                            }
                            catch
                            {
                                return null;
                            }
                        }

                        banker = ReadBetAreaValue(nowBetEl, "1");
                        player = ReadBetAreaValue(nowBetEl, "2");
                        tie = ReadBetAreaValue(nowBetEl, "3");

                        if (!banker.HasValue && !player.HasValue && !tie.HasValue)
                            continue;

                        UpdatePopupServerRoadState(routeKey, resolvedId, resolvedName, gameId, state =>
                        {
                            state.TableBetBanker = banker;
                            state.TableBetPlayer = player;
                            state.TableBetTie = tie;
                        }, "protocol33");
                        continue;
                    }

                    if (protocol == 38)
                    {
                        double countdown = 0;
                        if (data.TryGetProperty("timeMillisecond", out var msEl) && msEl.ValueKind == JsonValueKind.Number)
                            countdown = Math.Max(0, msEl.GetDouble() / 1000.0);
                        else if (data.TryGetProperty("betTimeCount", out var btEl) && btEl.ValueKind == JsonValueKind.Number)
                            countdown = Math.Max(0, btEl.GetDouble());
                        if (countdown <= 0)
                            continue;
                        UpdatePopupServerRoadState(routeKey, resolvedId, resolvedName, gameId, state =>
                        {
                            state.Countdown = countdown;
                            state.LastCountdownUpdatedUtc = DateTime.UtcNow;
                        }, "protocol38");
                    }
                }
                catch { }
            }
        }

        private static string GetPopupRoadHostTag(string? url)
        {
            var lowerUrl = (url ?? "").ToLowerInvariant();
            if (lowerUrl.Contains("qqhrsbjx"))
                return "qqhrsbjx";
            if (lowerUrl.Contains("hip288"))
                return "hip288";
            return "popup";
        }

        private static string BuildPopupRoadRouteKey(string? url, int gameId, string tableId)
        {
            return $"{GetPopupRoadHostTag(url)}:{gameId}:{(tableId ?? "").Trim()}";
        }

        private static string BuildPopupPreferredRoadKey(int gameId, string tableId)
        {
            return $"{gameId}:{(tableId ?? "").Trim()}";
        }

        private static int InferGameIdFromRoomName(string? name)
        {
            var normalized = TextNorm.U(name ?? "");
            if (string.IsNullOrWhiteSpace(normalized))
                return 0;
            if (normalized.Contains("(SEXY)BAC") || normalized.Contains("(SPEED)BAC") || normalized.Contains("(SITE)BAC"))
                return 101;
            if (normalized.Contains("RONG HO") || normalized.Contains("D&T"))
                return 102;
            if (normalized.Contains("ROULETTE"))
                return 103;
            if (normalized.Contains("TAI XIU"))
                return 104;
            if (normalized.Contains("NGUU NGUU"))
                return 105;
            if (normalized.Contains("FANTAN"))
                return 107;
            if (normalized.Contains("(SEXY)SD") || normalized.Contains("XOC DIA"))
                return 108;
            return 0;
        }

        private static string BuildPendingBetKey(int gameId, string tableId)
        {
            var tid = (tableId ?? "").Trim();
            if (string.IsNullOrWhiteSpace(tid))
                return "";
            return gameId > 0 ? $"{gameId}:{tid}" : tid;
        }

        private int InferExpectedGameIdByTable(string tableId, string? tableName = null)
        {
            if (string.IsNullOrWhiteSpace(tableId))
                return 0;
            var name = !string.IsNullOrWhiteSpace(tableName) ? tableName : ResolveRoomName(tableId);
            return InferGameIdFromRoomName(name);
        }

        private bool TryResolvePopupServerTable(int gameId, string groupId, string? url, out string routeKey, out string tableId, out string tableName)
        {
            routeKey = "";
            tableId = (groupId ?? "").Trim();
            tableName = "";
            if (string.IsNullOrWhiteSpace(tableId))
                return false;
            var localTableId = tableId;
            routeKey = BuildPopupRoadRouteKey(url, gameId, localTableId);

            lock (_roomFeedGate)
            {
                var match = _protocol21Rooms.Values.FirstOrDefault(r =>
                    r.GameId == gameId &&
                    string.Equals(r.Id, localTableId, StringComparison.OrdinalIgnoreCase));
                if (match != null)
                    tableName = match.Name ?? "";
            }

            if (string.IsNullOrWhiteSpace(tableName))
                tableName = ResolveRoomName(localTableId);
            if (string.IsNullOrWhiteSpace(tableName))
                tableName = localTableId;
            return true;
        }

        private static List<string> ExtractHistoryTokensFromProtocol26(JsonElement data)
        {
            var list = new List<string>();
            if (!data.TryGetProperty("historyArr", out var historyArr) || historyArr.ValueKind != JsonValueKind.Array)
                return list;

            foreach (var item in historyArr.EnumerateArray())
            {
                int result = 0;
                if (item.ValueKind == JsonValueKind.Number)
                    result = item.GetInt32();
                else if (item.ValueKind == JsonValueKind.String)
                    int.TryParse(item.GetString(), NumberStyles.Any, CultureInfo.InvariantCulture, out result);
                var token = DecodeWmResultToken(result);
                if (token.HasValue)
                    list.Add(token.Value.ToString());
            }
            return list;
        }

        private static List<PopupRoadNode> ExtractHistoryRawNodesFromProtocol26(JsonElement data)
        {
            var list = new List<PopupRoadNode>();
            if (!data.TryGetProperty("historyData", out var historyData) || historyData.ValueKind != JsonValueKind.Object)
                return list;
            if (!historyData.TryGetProperty("dataArr2", out var dataArr2) || dataArr2.ValueKind != JsonValueKind.Array)
                return list;

            var col = 0;
            foreach (var colEl in dataArr2.EnumerateArray())
            {
                if (colEl.ValueKind != JsonValueKind.Array)
                {
                    col++;
                    continue;
                }

                var row = 0;
                foreach (var item in colEl.EnumerateArray())
                {
                    int result = 0;
                    if (item.ValueKind == JsonValueKind.Number)
                        result = item.GetInt32();
                    else if (item.ValueKind == JsonValueKind.String)
                        int.TryParse(item.GetString(), NumberStyles.Any, CultureInfo.InvariantCulture, out result);

                    var code = DecodeWmPrimaryRoadCode(result);
                    var tieCount = (result & 4) != 0 ? 1 : 0;
                    if (!string.IsNullOrWhiteSpace(code))
                    {
                        list.Add(new PopupRoadNode
                        {
                            Row = row,
                            Col = col,
                            Code = code,
                            TieCount = tieCount
                        });
                    }
                    row++;
                }
                col++;
            }

            return list;
        }

        private static char? DecodeWmResultToken(int result)
        {
            if ((result & 4) != 0) return 'T';
            if ((result & 2) != 0) return 'P';
            if ((result & 1) != 0) return 'B';
            return null;
        }

        private static string DecodeWmPrimaryRoadCode(int result)
        {
            if ((result & 2) != 0) return "P";
            if ((result & 1) != 0) return "B";
            return "";
        }

        private static int? DecodeWmBaccaratCardPoint(int cardId)
        {
            if (cardId <= 0)
                return null;
            var rank = cardId % 20;
            if (rank <= 0 || rank > 13)
                return null;
            return rank >= 10 ? 0 : rank;
        }

        private static int? SumWmBaccaratScore(Dictionary<int, int> cardsByArea, params int[] areas)
        {
            if (cardsByArea == null || cardsByArea.Count == 0 || areas == null || areas.Length == 0)
                return null;
            var total = 0;
            var count = 0;
            foreach (var area in areas)
            {
                if (!cardsByArea.TryGetValue(area, out var val))
                    continue;
                total += val;
                count++;
            }
            return count > 0 ? total % 10 : (int?)null;
        }

        private static string MapWmResultDisplay(int result)
        {
            var token = DecodeWmResultToken(result);
            return token switch
            {
                'P' => "Người Chơi",
                'B' => "Nhà Cái",
                'T' => "Hòa",
                _ => ""
            };
        }

        private void UpdatePopupServerRoadState(string routeKey, string tableId, string tableName, int gameId, Action<PopupServerRoadState> apply, string source)
        {
            PopupServerRoadState snapshot;
            bool shouldFinalize = false;
            string finalizeToken = "";
            var now = DateTime.UtcNow;
            lock (_popupServerRoadGate)
            {
                if (!_popupServerRoadStates.TryGetValue(routeKey, out var state))
                {
                    state = new PopupServerRoadState
                    {
                        RouteKey = routeKey,
                        TableId = tableId,
                        TableName = tableName,
                        GameId = gameId,
                        HostTag = GetPopupRoadHostTag(routeKey)
                    };
                    _popupServerRoadStates[routeKey] = state;
                }
                else
                {
                    state.TableId = tableId;
                    state.GameId = gameId;
                    if (!string.IsNullOrWhiteSpace(tableName))
                        state.TableName = tableName;
                }

                var prevSessionKey = state.SessionKey;
                apply(state);
                state.LastUpdatedUtc = now;
                var preferredKey = BuildPopupPreferredRoadKey(gameId, tableId);
                if (string.Equals(source, "protocol26", StringComparison.OrdinalIgnoreCase))
                {
                    state.LastHistoryUpdatedUtc = now;
                    _popupPreferredRoadRouteByTableId[preferredKey] = routeKey;
                }
                else if (!_popupPreferredRoadRouteByTableId.ContainsKey(preferredKey))
                {
                    _popupPreferredRoadRouteByTableId[preferredKey] = routeKey;
                }

                if (!string.IsNullOrWhiteSpace(state.SessionKey) &&
                    !string.Equals(prevSessionKey, state.SessionKey, StringComparison.Ordinal) &&
                    !string.Equals(state.LastFinalizedSessionKey, state.SessionKey, StringComparison.Ordinal))
                {
                    finalizeToken = GetLastPopupRoadResultToken(state);
                    if (!string.IsNullOrWhiteSpace(finalizeToken))
                    {
                        state.LastFinalizedSessionKey = state.SessionKey;
                        shouldFinalize = true;
                    }
                }

                if (_popupPreferredRoadRouteByTableId.TryGetValue(preferredKey, out var preferredRoute) &&
                    !string.IsNullOrWhiteSpace(preferredRoute) &&
                    !string.Equals(preferredRoute, routeKey, StringComparison.OrdinalIgnoreCase))
                {
                    return;
                }

                var sig = string.Join("|", new[]
                {
                    state.TableName ?? "",
                    state.SessionKey ?? "",
                    state.Text ?? "",
                    state.CenterResult ?? "",
                    state.GameStage?.ToString(CultureInfo.InvariantCulture) ?? "",
                    state.WantShuffle?.ToString() ?? "",
                    state.WantEnd?.ToString() ?? "",
                    state.KeyStatus?.ToString(CultureInfo.InvariantCulture) ?? "",
                    state.TableStatus?.ToString(CultureInfo.InvariantCulture) ?? "",
                    state.PlayerScore?.ToString(CultureInfo.InvariantCulture) ?? "",
                    state.BankerScore?.ToString(CultureInfo.InvariantCulture) ?? "",
                    state.BetPlayer?.ToString("0.##", CultureInfo.InvariantCulture) ?? "",
                    state.BetBanker?.ToString("0.##", CultureInfo.InvariantCulture) ?? "",
                    state.BetTie?.ToString("0.##", CultureInfo.InvariantCulture) ?? "",
                    state.TableBetPlayer?.ToString("0.##", CultureInfo.InvariantCulture) ?? "",
                    state.TableBetBanker?.ToString("0.##", CultureInfo.InvariantCulture) ?? "",
                    state.TableBetTie?.ToString("0.##", CultureInfo.InvariantCulture) ?? "",
                    state.Countdown?.ToString("0.###", CultureInfo.InvariantCulture) ?? "",
                    string.Join(";", state.HistoryRaw.Select(n => $"{n.Col},{n.Row},{n.Code},{n.TieCount}")),
                    state.HistoryText ?? ""
                });
                if (string.Equals(sig, state.LastPushSig, StringComparison.Ordinal))
                    return;
                state.LastPushSig = sig;
                snapshot = new PopupServerRoadState
                {
                    RouteKey = state.RouteKey,
                    TableId = state.TableId,
                    TableName = state.TableName,
                    GameId = state.GameId,
                    HostTag = state.HostTag,
                    GameStage = state.GameStage,
                    WantShuffle = state.WantShuffle,
                    WantEnd = state.WantEnd,
                    KeyStatus = state.KeyStatus,
                    TableStatus = state.TableStatus,
                    PlayerScore = state.PlayerScore,
                    BankerScore = state.BankerScore,
                    CardValueByArea = state.CardValueByArea.ToDictionary(kv => kv.Key, kv => kv.Value),
                    History = state.History.ToList(),
                    HistoryRaw = state.HistoryRaw.Select(n => new PopupRoadNode
                    {
                        Row = n.Row,
                        Col = n.Col,
                        Code = n.Code,
                        TieCount = n.TieCount
                    }).ToList(),
                    HistoryText = state.HistoryText,
                    CenterResult = state.CenterResult,
                    Text = state.Text,
                    SessionKey = state.SessionKey,
                    BetPlayer = state.BetPlayer,
                    BetBanker = state.BetBanker,
                    BetTie = state.BetTie,
                    TableBetPlayer = state.TableBetPlayer,
                    TableBetBanker = state.TableBetBanker,
                    TableBetTie = state.TableBetTie,
                    Countdown = state.Countdown,
                    LastCountdownUpdatedUtc = state.LastCountdownUpdatedUtc,
                    LastPushSig = state.LastPushSig,
                    LastUpdatedUtc = state.LastUpdatedUtc,
                    LastHistoryUpdatedUtc = state.LastHistoryUpdatedUtc,
                    LastFinalizedSessionKey = state.LastFinalizedSessionKey
                };
            }

            var expectedGameId = InferExpectedGameIdByTable(tableId);
            if (expectedGameId > 0 && snapshot.GameId > 0 && snapshot.GameId != expectedGameId)
            {
                Log($"[ROADNET][SKIP-GAME] table={tableId} expectedGame={expectedGameId} gotGame={snapshot.GameId} route={snapshot.RouteKey} source={source}");
                return;
            }

            if (shouldFinalize && !string.IsNullOrWhiteSpace(tableId) && !string.IsNullOrWhiteSpace(finalizeToken))
            {
                double accNow = 0;
                try
                {
                    if (!string.IsNullOrWhiteSpace(_gameBalance))
                        accNow = ParseMoneyOrZero(_gameBalance);
                    else
                        accNow = ParseMoneyOrZero(LblAmount?.Text ?? "0");
                }
                catch { /* ignore parse */ }

                if (TryPopPendingBet(tableId, expectedGameId, out var row, strictGame: expectedGameId > 0))
                {
                    if (accNow <= 0 && row.Account > 0)
                        accNow = row.Account;
                    Log($"[ROAD-FINAL] table={tableId} game={snapshot.GameId} session={snapshot.SessionKey} result={finalizeToken} source={source}");
                    FinalizeBetRow(row, finalizeToken, accNow);
                    ApplyBetStatsForTable(tableId, row);
                    var st = GetOrCreateTableTaskState(tableId);
                    st.LastBetAmount = 0;
                    st.LastBetLevelText = "";
                    _ = PushBetPlanToOverlayAsync(tableId, "", 0, "");
                }
                else
                {
                    Log($"[HIST][MISS] table={tableId} expectedGame={expectedGameId} game={snapshot.GameId} session={snapshot.SessionKey} result={finalizeToken} source={source}");
                }
            }

            Log($"[ROADNET] {tableId} route={snapshot.RouteKey} source={source} hist={snapshot.HistoryText} center={snapshot.CenterResult} shuffle={(snapshot.WantShuffle == true ? "1" : "0")} scoreP={snapshot.PlayerScore?.ToString(CultureInfo.InvariantCulture) ?? ""} scoreB={snapshot.BankerScore?.ToString(CultureInfo.InvariantCulture) ?? ""} botBetP={snapshot.BetPlayer?.ToString("0.##", CultureInfo.InvariantCulture) ?? ""} botBetT={snapshot.BetTie?.ToString("0.##", CultureInfo.InvariantCulture) ?? ""} botBetB={snapshot.BetBanker?.ToString("0.##", CultureInfo.InvariantCulture) ?? ""} tableBetP={snapshot.TableBetPlayer?.ToString("0.##", CultureInfo.InvariantCulture) ?? ""} tableBetT={snapshot.TableBetTie?.ToString("0.##", CultureInfo.InvariantCulture) ?? ""} tableBetB={snapshot.TableBetBanker?.ToString("0.##", CultureInfo.InvariantCulture) ?? ""} countdown={snapshot.Countdown?.ToString("0.###", CultureInfo.InvariantCulture) ?? ""}");
            _ = Dispatcher.InvokeAsync(async () => await PushPopupServerRoadStateAsync(snapshot));
        }

        private async Task PushPopupServerRoadStateAsync(PopupServerRoadState state)
        {
            try
            {
                if (GetActiveRoomHostWebView()?.CoreWebView2 == null && Web?.CoreWebView2 == null && _popupWeb?.CoreWebView2 == null)
                    return;

                var idJson = JsonSerializer.Serialize(state.TableId ?? "", LogJsonOptions);
                var patchJson = JsonSerializer.Serialize(new
                {
                    history = state.History,
                    historyRaw = state.HistoryRaw,
                    historyText = state.HistoryText,
                    countdown = state.Countdown,
                    countdownUpdatedUtc = state.LastCountdownUpdatedUtc > DateTime.MinValue ? state.LastCountdownUpdatedUtc : (DateTime?)null,
                    centerResult = state.CenterResult,
                    text = state.Text,
                    sessionKey = state.SessionKey,
                    gameStage = state.GameStage,
                    wantShuffle = state.WantShuffle,
                    wantEnd = state.WantEnd,
                    keyStatus = state.KeyStatus,
                    tableStatus = state.TableStatus,
                    playerScore = state.PlayerScore,
                    bankerScore = state.BankerScore,
                    betPlayer = state.BetPlayer,
                    betBanker = state.BetBanker,
                    betTie = state.BetTie,
                    tableBetPlayer = state.TableBetPlayer,
                    tableBetBanker = state.TableBetBanker,
                    tableBetTie = state.TableBetTie,
                    source = "server",
                    tableName = state.TableName,
                    gameId = state.GameId,
                    routeKey = state.RouteKey
                }, LogJsonOptions);
                var script = $"window.__abxTableOverlay && window.__abxTableOverlay.setServerState && window.__abxTableOverlay.setServerState({idJson}, {patchJson});";
                await ExecuteOverlayScriptAsync(script);
            }
            catch { }
        }

        private static PopupServerRoadState ClonePopupServerRoadState(PopupServerRoadState state)
        {
            return new PopupServerRoadState
            {
                RouteKey = state.RouteKey,
                TableId = state.TableId,
                TableName = state.TableName,
                GameId = state.GameId,
                HostTag = state.HostTag,
                GameStage = state.GameStage,
                WantShuffle = state.WantShuffle,
                WantEnd = state.WantEnd,
                KeyStatus = state.KeyStatus,
                TableStatus = state.TableStatus,
                PlayerScore = state.PlayerScore,
                BankerScore = state.BankerScore,
                CardValueByArea = state.CardValueByArea?.ToDictionary(kv => kv.Key, kv => kv.Value) ?? new Dictionary<int, int>(),
                History = state.History?.ToList() ?? new List<string>(),
                HistoryRaw = state.HistoryRaw?.Select(n => new PopupRoadNode
                {
                    Row = n.Row,
                    Col = n.Col,
                    Code = n.Code,
                    TieCount = n.TieCount
                }).ToList() ?? new List<PopupRoadNode>(),
                HistoryText = state.HistoryText,
                CenterResult = state.CenterResult,
                Text = state.Text,
                SessionKey = state.SessionKey,
                BetPlayer = state.BetPlayer,
                BetBanker = state.BetBanker,
                BetTie = state.BetTie,
                TableBetPlayer = state.TableBetPlayer,
                TableBetBanker = state.TableBetBanker,
                TableBetTie = state.TableBetTie,
                Countdown = state.Countdown,
                LastCountdownUpdatedUtc = state.LastCountdownUpdatedUtc,
                LastPushSig = state.LastPushSig,
                LastUpdatedUtc = state.LastUpdatedUtc,
                LastHistoryUpdatedUtc = state.LastHistoryUpdatedUtc,
                LastFinalizedSessionKey = state.LastFinalizedSessionKey
            };
        }

        private static int ScorePopupServerRoadState(PopupServerRoadState? state)
        {
            if (state == null)
                return int.MinValue;
            var score = 0;
            if (state.History != null && state.History.Count > 0)
                score += 1000 + state.History.Count;
            if (!string.IsNullOrWhiteSpace(state.HistoryText))
                score += 100;
            if (!string.IsNullOrWhiteSpace(state.CenterResult))
                score += 10;
            if (state.Countdown.HasValue && state.Countdown.Value > 0)
                score += 5;
            if (!string.IsNullOrWhiteSpace(state.SessionKey))
                score += 2;
            if (state.LastHistoryUpdatedUtc != DateTime.MinValue)
            {
                var age = (int)Math.Max(0, (DateTime.UtcNow - state.LastHistoryUpdatedUtc).TotalSeconds);
                score += Math.Max(0, 300 - age);
            }
            return score;
        }

        private async Task PushCachedPopupServerRoadStatesAsync(IEnumerable<(string Id, string Name)> rooms)
        {
            try
            {
                var targets = rooms?
                    .Select(r => ((r.Id ?? "").Trim(), (r.Name ?? "").Trim()))
                    .Where(r => !string.IsNullOrWhiteSpace(r.Item1) || !string.IsNullOrWhiteSpace(r.Item2))
                    .ToList() ?? new List<(string, string)>();
                if (targets.Count == 0)
                    return;

                List<PopupServerRoadState> snapshots;
                lock (_popupServerRoadGate)
                {
                    var picked = new List<PopupServerRoadState>();
                    foreach (var target in targets)
                    {
                        var id = target.Item1;
                        var name = target.Item2;
                        var resolvedName = !string.IsNullOrWhiteSpace(id) ? ResolveRoomName(id) : "";
                        var expectedGameId = InferGameIdFromRoomName(!string.IsNullOrWhiteSpace(name) ? name : resolvedName);

                        PopupServerRoadState? best = null;
                        if (!string.IsNullOrWhiteSpace(id) &&
                            expectedGameId > 0 &&
                            _popupPreferredRoadRouteByTableId.TryGetValue(BuildPopupPreferredRoadKey(expectedGameId, id), out var preferredRoute) &&
                            !string.IsNullOrWhiteSpace(preferredRoute) &&
                            _popupServerRoadStates.TryGetValue(preferredRoute, out var preferred))
                        {
                            best = preferred;
                        }

                        if ((best == null || ScorePopupServerRoadState(best) <= 0) && !string.IsNullOrWhiteSpace(id))
                        {
                            foreach (var state in _popupServerRoadStates.Values)
                            {
                                if (state == null || !string.Equals(state.TableId, id, StringComparison.OrdinalIgnoreCase))
                                    continue;
                                if (expectedGameId > 0 && state.GameId > 0 && state.GameId != expectedGameId)
                                    continue;
                                if (best == null || ScorePopupServerRoadState(state) > ScorePopupServerRoadState(best))
                                    best = state;
                            }
                        }

                        if (best != null && ScorePopupServerRoadState(best) > 0)
                            picked.Add(best);
                    }

                    snapshots = picked
                        .GroupBy(s => s.TableId, StringComparer.OrdinalIgnoreCase)
                        .Select(g => g.OrderByDescending(ScorePopupServerRoadState).First())
                        .Select(ClonePopupServerRoadState)
                        .ToList();
                }

                foreach (var snapshot in snapshots)
                    await PushPopupServerRoadStateAsync(snapshot);

                var targetDesc = string.Join(" | ", targets.Select(t => !string.IsNullOrWhiteSpace(t.Item2) ? t.Item2 : t.Item1));
                Log($"[ROADNET] bootstrap cache -> overlay: matched={snapshots.Count}/{targets.Count} targets={targetDesc}");
            }
            catch (Exception ex)
            {
                Log("[ROADNET] bootstrap cache lỗi: " + ex.Message);
            }
        }

        private void ClearLatestNetworkRooms(string reason)
        {
            lock (_roomFeedGate)
            {
                _latestNetworkRooms.Clear();
                _latestNetworkRoomsAt = DateTime.MinValue;
                _latestNetworkRoomsSource = "";
                _latestNetworkRoomsSig = "";
                _lastTableUpdateAt = DateTime.MinValue;
                _protocol21Rooms.Clear();
            }
            lock (_popupServerRoadGate)
            {
                _popupServerRoadStates.Clear();
                _popupPreferredRoadRouteByTableId.Clear();
            }
            Log("[ROOMNET] cleared: " + reason);
        }

        private bool TryGetLatestNetworkRooms(out List<RoomEntry> rooms, out string source, TimeSpan? maxAge = null)
        {
            lock (_roomFeedGate)
            {
                var ageLimit = maxAge ?? TimeSpan.FromSeconds(20);
                if (_latestNetworkRoomsAt == DateTime.MinValue || (DateTime.UtcNow - _latestNetworkRoomsAt) > ageLimit || _latestNetworkRooms.Count == 0)
                {
                    rooms = new List<RoomEntry>();
                    source = "";
                    return false;
                }

                rooms = _latestNetworkRooms
                    .Select(r => new RoomEntry { Id = r.Id, Name = r.Name })
                    .ToList();
                source = _latestNetworkRoomsSource;
                return true;
            }
        }

        private void TryUpdateLatestNetworkRoomsFromPayload(string scope, string kind, string? url, string payload, bool isBinary)
        {
            if (string.IsNullOrWhiteSpace(payload))
                return;

            var normalizedPayload = NormalizePacketPayload(payload, isBinary);
            if (string.IsNullOrWhiteSpace(normalizedPayload))
                return;

            if (TryUpdateLatestNetworkRoomsFromProtocol35Snapshot(scope, kind, url, normalizedPayload))
                return;

            if (TryUpdateLatestNetworkRoomsFromProtocol21(scope, kind, url, normalizedPayload))
                return;

            if (!TryExtractRoomsFromPayload(normalizedPayload, out var rooms, out var reason))
                return;

            rooms = rooms
                .Where(r => !string.IsNullOrWhiteSpace(r.Name))
                .Where(r => !IsLobbyNoiseName(r.Name))
                .GroupBy(r => string.IsNullOrWhiteSpace(r.Id) ? r.Name : r.Id, StringComparer.OrdinalIgnoreCase)
                .Select(g => g.First())
                .OrderBy(r => BuildRoomDisplaySortKey(r.Name), StringComparer.Ordinal)
                .ToList();
            if (rooms.Count == 0)
                return;

            PublishLatestNetworkRooms(rooms, $"{scope}/{kind}/{url} via {reason}");
        }

        private bool TryUpdateLatestNetworkRoomsFromProtocol21(string scope, string kind, string? url, string payload)
        {
            if (!string.Equals(scope, "popup", StringComparison.OrdinalIgnoreCase))
                return false;
            if (!string.Equals(kind, "WS.recv", StringComparison.OrdinalIgnoreCase))
                return false;

            var matched = false;
            foreach (var candidate in ExtractPossibleJsonPayloads(payload))
            {
                try
                {
                    using var doc = JsonDocument.Parse(candidate);
                    var root = doc.RootElement;
                    if (root.ValueKind != JsonValueKind.Object)
                        continue;

                    var protocol = I(FindKnownString(root, new[] { "protocol" }, 0), -1);
                    if (protocol != 21)
                        continue;

                    if (!root.TryGetProperty("data", out var data) || data.ValueKind != JsonValueKind.Object)
                        continue;

                    if (!TryExtractRoomFromProtocol21(data, url, out var roomState))
                        continue;

                    matched = true;
                    lock (_roomFeedGate)
                    {
                        _protocol21Rooms[roomState.CacheKey] = roomState;
                    }
                }
                catch { }
            }

            if (!matched)
                return false;

            List<RoomEntry> rooms;
            lock (_roomFeedGate)
            {
                rooms = _protocol21Rooms.Values
                    .Where(r => !string.IsNullOrWhiteSpace(r.Name))
                    .Where(r => !IsLobbyNoiseName(r.Name))
                    .OrderBy(r => r.Sort <= 0 ? int.MaxValue : r.Sort)
                    .ThenBy(r => BuildRoomDisplaySortKey(r.Name), StringComparer.Ordinal)
                    .Select(r => new RoomEntry { Id = r.Id, Name = r.Name })
                    .ToList();
            }

            if (rooms.Count == 0)
                return true;

            var popupVisible = false;
            try
            {
                popupVisible = PopupHost?.Visibility == Visibility.Visible;
            }
            catch { }

            if (!popupVisible)
                PublishLatestNetworkRooms(rooms, $"{scope}/{kind}/{url} via protocol21");
            return true;
        }

        private bool TryUpdateLatestNetworkRoomsFromProtocol35Snapshot(string scope, string kind, string? url, string payload)
        {
            if (!string.Equals(scope, "popup", StringComparison.OrdinalIgnoreCase))
                return false;
            if (!string.Equals(kind, "WS.recv", StringComparison.OrdinalIgnoreCase))
                return false;

            var matched = false;
            foreach (var candidate in ExtractPossibleJsonPayloads(payload))
            {
                try
                {
                    using var doc = JsonDocument.Parse(candidate);
                    var root = doc.RootElement;
                    if (root.ValueKind != JsonValueKind.Object)
                        continue;

                    var protocol = I(FindKnownString(root, new[] { "protocol" }, 0), -1);
                    if (protocol != 35)
                        continue;

                    if (!root.TryGetProperty("data", out var data) || data.ValueKind != JsonValueKind.Object)
                        continue;
                    if (!data.TryGetProperty("gameArr", out var gameArr) || gameArr.ValueKind != JsonValueKind.Array)
                        continue;

                    foreach (var gameNode in gameArr.EnumerateArray())
                    {
                        if (gameNode.ValueKind != JsonValueKind.Object)
                            continue;

                        var gameId = I(FindKnownString(gameNode, new[] { "gameID", "gameId" }, 0), -1);
                        if (!gameNode.TryGetProperty("groupArr", out var groupArr) || groupArr.ValueKind != JsonValueKind.Array)
                            continue;

                        foreach (var groupNode in groupArr.EnumerateArray())
                        {
                            if (groupNode.ValueKind != JsonValueKind.Object)
                                continue;
                            if (!TryExtractRoomFromProtocol21(groupNode, url, out var roomState, gameId))
                                continue;
                            matched = true;
                            lock (_roomFeedGate)
                            {
                                _protocol21Rooms[roomState.CacheKey] = roomState;
                            }
                        }
                    }
                }
                catch { }
            }

            return matched;
        }

        private bool TryExtractRoomFromProtocol21(JsonElement data, string? url, out Protocol21RoomState roomState, int fallbackGameId = -1)
        {
            roomState = new Protocol21RoomState();

            var gameId = I(FindKnownString(data, new[] { "gameID", "gameId" }, 1), fallbackGameId);
            var groupIdText = FindKnownString(data, new[] { "groupID", "groupId" }, 1);
            var groupId = I(groupIdText, -1);
            if (groupId <= 0)
                return false;

            var groupType = I(FindKnownString(data, new[] { "groupType", "tableType" }, 1), -1);
            var tableSort = I(FindKnownString(data, new[] { "tableSort", "tableSort2" }, 1), int.MaxValue);
            var tableSort2 = I(FindKnownString(data, new[] { "tableSort2" }, 1), int.MaxValue);
            var tableStatus = I(FindKnownString(data, new[] { "tableStatus" }, 1), -1);
            var lowerUrl = (url ?? "").ToLowerInvariant();
            var hostTag = lowerUrl.Contains("qqhrsbjx") ? "qqhrsbjx"
                : lowerUrl.Contains("hip288") ? "hip288"
                : "popup";

            if (!TryMapVisibleRoomNameFromProtocol21(gameId, groupType, groupId, tableSort, tableSort2, tableStatus, out var name, out var sort))
                return false;

            roomState = new Protocol21RoomState
            {
                CacheKey = $"{hostTag}:{gameId}:{groupId}",
                Id = groupId.ToString(CultureInfo.InvariantCulture),
                Name = name,
                Sort = sort,
                GameId = gameId,
                GroupType = groupType
            };
            return true;
        }

        private bool TryMapVisibleRoomNameFromProtocol21(int gameId, int groupType, int groupId, int tableSort, int tableSort2, int tableStatus, out string name, out int sort)
        {
            name = "";
            sort = int.MaxValue;

            if (tableStatus <= 0)
                return false;

            if (gameId == 101)
            {
                if (tableSort <= 0)
                    return false;

                if (groupType is 36 or 12 or 18 or 19 or 22)
                {
                    name = $"(Sexy)Bac{tableSort}";
                    sort = tableSort;
                    return true;
                }

                if (groupType == 5)
                {
                    name = $"(Sexy)Bac{tableSort}";
                    sort = tableSort;
                    return true;
                }

                return false;
            }

            if (gameId == 102 && tableSort > 0)
            {
                name = tableSort switch
                {
                    1 => "(Sexy)D&T1",
                    2 => "Rồng Hổ2",
                    3 => "Rồng Hổ3",
                    _ => ""
                };
                sort = 100 + tableSort;
                return !string.IsNullOrWhiteSpace(name);
            }

            if (gameId == 103 && tableSort == 1)
            {
                name = "Roulette1";
                sort = 200 + tableSort;
                return true;
            }

            if (gameId == 104 && tableSort == 1)
            {
                name = "Tài xỉu1";
                sort = 300 + tableSort;
                return true;
            }

            if (gameId == 105 && tableSort == 1)
            {
                name = "Ngưu Ngưu1";
                sort = 400 + tableSort;
                return true;
            }

            if (gameId == 107 && tableSort == 1)
            {
                name = "Fantan1";
                sort = 500 + tableSort;
                return true;
            }

            if (gameId == 108 && tableSort > 0)
            {
                if (groupType == 67 && tableSort == 1)
                {
                    name = "(Sexy)SD1";
                    sort = 600 + tableSort;
                    return true;
                }

                if (groupType == 0 && tableSort is 2 or 3)
                {
                    name = $"xóc đĩa{tableSort}";
                    sort = 600 + tableSort;
                    return true;
                }
            }

            return false;
        }

        private bool TryGetVisibleProtocol21Rooms(out List<RoomEntry> rooms, out string source)
        {
            source = "protocol21-mapped";
            lock (_roomFeedGate)
            {
                rooms = _protocol21Rooms.Values
                    .Where(r => !string.IsNullOrWhiteSpace(r.Name))
                    .Where(r => !IsLobbyNoiseName(r.Name))
                    .OrderBy(r => BuildRoomDisplaySortKey(r.Name), StringComparer.Ordinal)
                    .Select(r => new RoomEntry { Id = r.Id, Name = r.Name })
                    .ToList();
            }
            return rooms.Count > 0;
        }

        private static string BuildRoomAlphaKey(string? raw)
        {
            var text = TextNorm.U(raw ?? "");
            return Regex.Replace(text, @"\d+", m => m.Value.PadLeft(6, '0'));
        }

        private static string BuildRoomDisplaySortKey(string? raw)
        {
            var text = TextNorm.U(raw ?? "");
            if (string.IsNullOrWhiteSpace(text))
                return "999|" + text;

            static string Key(int bucket, string number)
            {
                var n = int.TryParse(number, out var parsed) ? parsed : int.MaxValue;
                return bucket.ToString("D3", CultureInfo.InvariantCulture) + "|" + n.ToString("D6", CultureInfo.InvariantCulture);
            }

            Match m;
            m = Regex.Match(text, @"^\((SEXY|SITE|SPEED)\)\s*BAC\s*(\d+)$", RegexOptions.IgnoreCase);
            if (m.Success) return Key(10, m.Groups[2].Value);

            m = Regex.Match(text, @"^BAC\s*(\d+)$", RegexOptions.IgnoreCase);
            if (m.Success) return Key(10, m.Groups[1].Value);

            m = Regex.Match(text, @"^\((SEXY|SITE)\)\s*D&?T\s*(\d+)$", RegexOptions.IgnoreCase);
            if (m.Success) return Key(20, m.Groups[2].Value);

            m = Regex.Match(text, @"^D&?T\s*(\d+)$", RegexOptions.IgnoreCase);
            if (m.Success) return Key(20, m.Groups[1].Value);

            m = Regex.Match(text, @"^RONG\s*HO\s*(\d+)$", RegexOptions.IgnoreCase);
            if (m.Success) return Key(21, m.Groups[1].Value);

            m = Regex.Match(text, @"^ROULETTE\s*(\d+)$", RegexOptions.IgnoreCase);
            if (m.Success) return Key(30, m.Groups[1].Value);

            m = Regex.Match(text, @"^TAI\s*XIU\s*(\d+)$", RegexOptions.IgnoreCase);
            if (m.Success) return Key(40, m.Groups[1].Value);

            m = Regex.Match(text, @"^NGUU\s*NGUU\s*(\d+)$", RegexOptions.IgnoreCase);
            if (m.Success) return Key(50, m.Groups[1].Value);

            m = Regex.Match(text, @"^FANTAN\s*(\d+)$", RegexOptions.IgnoreCase);
            if (m.Success) return Key(60, m.Groups[1].Value);

            m = Regex.Match(text, @"^\((SEXY|SITE)\)\s*SD\s*(\d+)$", RegexOptions.IgnoreCase);
            if (m.Success) return Key(70, m.Groups[2].Value);

            m = Regex.Match(text, @"^SD\s*(\d+)$", RegexOptions.IgnoreCase);
            if (m.Success) return Key(70, m.Groups[1].Value);

            m = Regex.Match(text, @"^XOC\s*DIA\s*(\d+)$", RegexOptions.IgnoreCase);
            if (m.Success) return Key(80, m.Groups[1].Value);

            return "900|" + BuildRoomAlphaKey(text);
        }

        private void PublishLatestNetworkRooms(List<RoomEntry> rooms, string source)
        {
            var sig = string.Join("|", rooms.Select(r => $"{r.Id}::{r.Name}"));
            var changed = false;
            lock (_roomFeedGate)
            {
                var currentPriority = GetRoomFeedPriority(_latestNetworkRoomsSource);
                var nextPriority = GetRoomFeedPriority(source);
                if (currentPriority > nextPriority)
                    return;
                if (string.Equals(_latestNetworkRoomsSig, sig, StringComparison.Ordinal))
                    return;
                _latestNetworkRooms = rooms.Select(r => new RoomEntry { Id = r.Id, Name = r.Name }).ToList();
                _latestNetworkRoomsAt = DateTime.UtcNow;
                _latestNetworkRoomsSource = source;
                _latestNetworkRoomsSig = sig;
                changed = true;
            }

            Log("[ROOMNET] rooms=" + rooms.Count + " source=" + source + " sample=" + Sample(rooms.Select(r => r.Name), 6));
            if (changed)
                ScheduleRoomListRefreshFromNetworkFeed(source, rooms.Count);
        }

        private void ScheduleRoomListRefreshFromNetworkFeed(string source, int roomCount)
        {
            try
            {
                if (roomCount <= 0)
                    return;
                var priority = GetRoomFeedPriority(source);
                if (priority < 2)
                    return;

                var now = DateTime.UtcNow;
                var hasUiRooms = false;
                try
                {
                    hasUiRooms = _roomList.Count > 0 && _roomOptions.Count > 0;
                }
                catch { }

                var immediate = !hasUiRooms || (now - _roomListLastLoaded) > TimeSpan.FromSeconds(2);
                var minGap = immediate ? TimeSpan.FromMilliseconds(120) : TimeSpan.FromMilliseconds(600);
                var due = immediate ? TimeSpan.Zero : TimeSpan.FromMilliseconds(250);

                if (_roomListLoading == 0 && (now - _lastRoomFeedRefreshAt) >= minGap)
                {
                    _lastRoomFeedRefreshAt = now;
                    _ = Dispatcher.InvokeAsync(async () => await RefreshRoomListAsync());
                    return;
                }

                if (Interlocked.Exchange(ref _roomFeedRefreshPending, 1) == 1)
                    return;

                _ = Task.Run(async () =>
                {
                    try
                    {
                        if (due > TimeSpan.Zero)
                            await Task.Delay(due);
                        _lastRoomFeedRefreshAt = DateTime.UtcNow;
                        await Dispatcher.InvokeAsync(async () => await RefreshRoomListAsync());
                    }
                    catch { }
                    finally
                    {
                        Interlocked.Exchange(ref _roomFeedRefreshPending, 0);
                    }
                });
            }
            catch { }
        }

        private static int GetRoomFeedPriority(string? source)
        {
            var text = source ?? "";
            if (text.IndexOf("table_update", StringComparison.OrdinalIgnoreCase) >= 0)
                return 3;
            if (text.IndexOf("protocol21", StringComparison.OrdinalIgnoreCase) >= 0)
                return 2;
            return 1;
        }

        private bool TryExtractRoomsFromPayload(string payload, out List<RoomEntry> rooms, out string reason)
        {
            var bestRooms = new List<RoomEntry>();
            var bestReason = "";
            var candidates = ExtractPossibleJsonPayloads(payload);
            var bestScore = int.MinValue;

            foreach (var candidate in candidates)
            {
                try
                {
                    using var doc = JsonDocument.Parse(candidate);
                    VisitJsonForRoomArrays(doc.RootElement, "$", 0);
                }
                catch { }
            }

            rooms = bestRooms;
            reason = bestReason;
            return rooms.Count > 0;

            void VisitJsonForRoomArrays(JsonElement node, string path, int depth)
            {
                if (depth > 6)
                    return;

                if (node.ValueKind == JsonValueKind.Array)
                {
                    if (TryExtractRoomsFromArray(node, path, out var arrRooms, out var arrScore, out var arrReason) && arrScore > bestScore)
                    {
                        bestScore = arrScore;
                        bestRooms = arrRooms;
                        bestReason = arrReason;
                    }

                    var idx = 0;
                    foreach (var item in node.EnumerateArray())
                        VisitJsonForRoomArrays(item, $"{path}[{idx++}]", depth + 1);
                    return;
                }

                if (node.ValueKind == JsonValueKind.Object)
                {
                    foreach (var prop in node.EnumerateObject())
                    {
                        if (prop.Value.ValueKind == JsonValueKind.Object || prop.Value.ValueKind == JsonValueKind.Array)
                            VisitJsonForRoomArrays(prop.Value, $"{path}.{prop.Name}", depth + 1);
                        else if (prop.Value.ValueKind == JsonValueKind.String)
                        {
                            foreach (var nested in ExtractPossibleJsonPayloads(prop.Value.GetString() ?? ""))
                            {
                                try
                                {
                                    using var nestedDoc = JsonDocument.Parse(nested);
                                    VisitJsonForRoomArrays(nestedDoc.RootElement, $"{path}.{prop.Name}#json", depth + 1);
                                }
                                catch { }
                            }
                        }
                    }
                }
            }
        }

        private bool TryExtractRoomsFromArray(JsonElement array, string path, out List<RoomEntry> rooms, out int score, out string reason)
        {
            rooms = new List<RoomEntry>();
            score = 0;
            reason = path;

            if (array.ValueKind != JsonValueKind.Array)
                return false;

            var pathUpper = TextNorm.U(path);
            if (pathUpper.Contains("HISTORYDATA.RESULTOBJARR") || (pathUpper.Contains("RESULTOBJARR") && pathUpper.Contains("HISTORY")))
                return false;

            foreach (var item in array.EnumerateArray())
            {
                if (item.ValueKind != JsonValueKind.Object)
                    continue;
                if (!TryExtractRoomFromObject(item, out var room))
                    continue;
                rooms.Add(room);
            }

            rooms = rooms
                .Where(r => !string.IsNullOrWhiteSpace(r.Name))
                .GroupBy(r => string.IsNullOrWhiteSpace(r.Id) ? r.Name : r.Id, StringComparer.OrdinalIgnoreCase)
                .Select(g => g.First())
                .ToList();

            if (rooms.Count == 0)
                return false;

            score = rooms.Count * 4;
            if (pathUpper.Contains("TABLE")) score += 8;
            if (pathUpper.Contains("ROOM")) score += 8;
            if (pathUpper.Contains("GAME")) score += 4;
            if (rooms.Count >= 5) score += 10;
            if (rooms.Any(r => LooksLikeBaccaratRoom(r.Name) || LooksLikeBaccaratRoom(r.Id))) score += 20;
            if (rooms.Count < 3 && !rooms.Any(r => LooksLikeBaccaratRoom(r.Name))) score -= 12;
            return score > 0;
        }

        private bool TryExtractRoomFromObject(JsonElement obj, out RoomEntry room)
        {
            room = new RoomEntry();
            if (obj.ValueKind != JsonValueKind.Object)
                return false;

            var id = FindKnownString(obj, new[] { "id", "tableId", "tableID", "table_id", "tableCode", "table_code", "gameId", "gameID", "game_id", "deskId", "desk_id", "instanceId", "instance_id", "code", "key" }, 2);
            var name = FindKnownString(obj, new[] { "name", "tableName", "table_name", "gameName", "game_name", "displayName", "display_name", "title", "tableTitle", "table_title", "tableLabel", "table_label", "nickName", "nick_name" }, 2);

            if (string.IsNullOrWhiteSpace(name))
            {
                var shortText = FindFirstShortString(obj, 2);
                if (LooksLikeRoomLabel(shortText))
                    name = shortText;
            }

            if (string.IsNullOrWhiteSpace(id) && string.IsNullOrWhiteSpace(name))
                return false;

            if (string.IsNullOrWhiteSpace(name))
                name = id;
            if (string.IsNullOrWhiteSpace(id))
                id = name;

            name = (name ?? "").Trim();
            id = (id ?? "").Trim();
            if (!LooksLikeRoomLabel(name) && !LooksLikeBaccaratRoom(name) && !LooksLikeBaccaratRoom(id))
                return false;

            room = new RoomEntry { Id = id, Name = name };
            return true;
        }

        private string FindKnownString(JsonElement node, IEnumerable<string> names, int depth)
        {
            if (depth < 0 || node.ValueKind != JsonValueKind.Object)
                return "";

            foreach (var prop in node.EnumerateObject())
            {
                if (names.Any(n => string.Equals(prop.Name, n, StringComparison.OrdinalIgnoreCase)))
                {
                    var text = JsonElementToString(prop.Value);
                    if (!string.IsNullOrWhiteSpace(text))
                        return text;
                }
            }

            foreach (var prop in node.EnumerateObject())
            {
                if (prop.Value.ValueKind == JsonValueKind.Object)
                {
                    var nested = FindKnownString(prop.Value, names, depth - 1);
                    if (!string.IsNullOrWhiteSpace(nested))
                        return nested;
                }
            }

            return "";
        }

        private string FindFirstShortString(JsonElement node, int depth)
        {
            if (depth < 0 || node.ValueKind != JsonValueKind.Object)
                return "";

            foreach (var prop in node.EnumerateObject())
            {
                if (prop.Value.ValueKind == JsonValueKind.String)
                {
                    var text = (prop.Value.GetString() ?? "").Trim();
                    if (text.Length >= 2 && text.Length <= 32)
                        return text;
                }
            }

            foreach (var prop in node.EnumerateObject())
            {
                if (prop.Value.ValueKind == JsonValueKind.Object)
                {
                    var nested = FindFirstShortString(prop.Value, depth - 1);
                    if (!string.IsNullOrWhiteSpace(nested))
                        return nested;
                }
            }
            return "";
        }

        private string JsonElementToString(JsonElement value)
        {
            return value.ValueKind switch
            {
                JsonValueKind.String => (value.GetString() ?? "").Trim(),
                JsonValueKind.Number => value.ToString(),
                JsonValueKind.True => "true",
                JsonValueKind.False => "false",
                _ => ""
            };
        }

        private bool LooksLikeRoomLabel(string? text)
        {
            var raw = (text ?? "").Trim();
            if (string.IsNullOrWhiteSpace(raw)) return false;
            if (raw.Length < 2 || raw.Length > 40) return false;
            if (IsLobbyNoiseName(raw)) return false;
            var upper = TextNorm.U(raw);
            if (upper.Contains("STATUS") || upper.Contains("COUNTDOWN") || upper.Contains("RESULT") || upper.Contains("PLAYER") || upper.Contains("BANKER"))
                return false;
            return raw.Any(char.IsLetter);
        }

        private bool LooksLikeBaccaratRoom(string? text)
        {
            var upper = TextNorm.U(text ?? "");
            if (string.IsNullOrWhiteSpace(upper)) return false;
            return upper.Contains("BACCARAT")
                || upper.Contains(" BAC")
                || upper.StartsWith("BAC")
                || upper.Contains("SEXY")
                || upper.Contains("SPEED")
                || upper.Contains("SQUEEZE");
        }

        private IEnumerable<string> ExtractPossibleJsonPayloads(string payload)
        {
            var raw = (payload ?? "").Trim();
            if (string.IsNullOrWhiteSpace(raw))
                yield break;

            if (raw.StartsWith("{") || raw.StartsWith("["))
            {
                yield return raw;
                yield break;
            }

            var brace = raw.IndexOf('{');
            var bracket = raw.IndexOf('[');
            var start = -1;
            if (brace >= 0 && bracket >= 0) start = Math.Min(brace, bracket);
            else start = Math.Max(brace, bracket);
            if (start > 0 && start < raw.Length - 1)
                yield return raw.Substring(start);
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


        // Luồng cũ: bấm mở game live theo tiêu đề/trang HOME.
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

            // 3) Fallback cuối: mở item index 1 của luồng cũ
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
                _manualDashboardOpened = true;
                SetModeUi(true);
                _cfg.UseTrial = false;
                if (ChkTrial != null) ChkTrial.IsChecked = false;
                await SaveConfigAsync();
                await EnsureWebReadyAsync();

                if (!await EnsureLicenseOnceAsync())
                    return;

                await EnsureToolBridgeInjectedAsync();
            }
            catch (Exception ex)
            {
                Log("[VaoXocDia_Click] " + ex);
            }
        }

        private async void BtnTrialTool_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                _manualDashboardOpened = true;
                SetModeUi(true);
                _cfg.UseTrial = true;
                if (ChkTrial != null) ChkTrial.IsChecked = true;
                await SaveConfigAsync();
                await EnsureWebReadyAsync();

                if (!await EnsureTrialAsync())
                {
                    _cfg.UseTrial = false;
                    if (ChkTrial != null) ChkTrial.IsChecked = false;
                    return;
                }

                await EnsureToolBridgeInjectedAsync();
            }
            catch (Exception ex)
            {
                _cfg.UseTrial = false;
                if (ChkTrial != null) ChkTrial.IsChecked = false;
                Log("[BtnTrialTool_Click] " + ex);
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
                                    Log("[AutoLoginWatch] need-login → auto-fill + click"); // hàm này đã có fallback và tự gọi TryAutoLoginAsync
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

        private Task<string> EvalJsActiveRoomHostLockedAsync(string js)
        {
            return Dispatcher.InvokeAsync(async () =>
            {
                await _domActionLock.WaitAsync();
                try
                {
                    var candidates = new List<WebView2?>();
                    var active = GetActiveRoomHostWebView();
                    if (active != null) candidates.Add(active);
                    if (!ReferenceEquals(Web, active)) candidates.Add(Web);
                    if (!ReferenceEquals(_popupWeb, active) && !ReferenceEquals(_popupWeb, Web)) candidates.Add(_popupWeb);

                    foreach (var web in candidates)
                    {
                        if (web?.CoreWebView2 == null)
                            continue;
                        try
                        {
                            return await web.ExecuteScriptAsync(js);
                        }
                        catch { }
                    }

                    return "";
                }
                finally
                {
                    _domActionLock.Release();
                }
            }).Task.Unwrap();
        }

        private async Task TryRefreshGameUsernameFromActiveHostAsync(string source)
        {
            if (!string.IsNullOrWhiteSpace(_gameUsername))
                return;
            if (Interlocked.Exchange(ref _gameUsernameProbeBusy, 1) == 1)
                return;
            try
            {
                var now = DateTime.UtcNow;
                if ((now - _lastGameUsernameProbeAt) < TimeSpan.FromSeconds(2))
                    return;
                _lastGameUsernameProbeAt = now;

                const string js = @"
(function(){
  try{
    const vis=el=>{ if(!el) return false; const r=el.getBoundingClientRect(), cs=getComputedStyle(el);
                    return r.width>4 && r.height>4 && cs.display!=='none' && cs.visibility!=='hidden'; };
    const textOf=el=>{ try{return (el.innerText||el.textContent||'').replace(/\s+/g,' ').trim();}catch(_){ return ''; } };
    const isCandidate=t=>{
      t=String(t||'').replace(/\s+/g,' ').trim();
      if(!t) return false;
      const low=t.toLowerCase();
      if(/vndk|so du|balance|vip|wm casino|casino|baccarat|dang nhap|login|quang cao|pho bien|thoi gian|tat ca|don gian/.test(low)) return false;
      if(t.length < 4 || t.length > 40) return false;
      return /^[a-z0-9][a-z0-9._-]{3,}$/i.test(t);
    };
    const sels = [
      '.user-logged__info .base-dropdown-header__user__name',
      '.base-dropdown-header__user__name',
      '.user__name',
      '.menu-account__info--user .display-name .full-name span',
      '.menu-account__info--user .username .full-name span',
      '[data-username]',
      '[data-user]'
    ];
    for (const sel of sels){
      try{
        const el=document.querySelector(sel);
        const t=textOf(el) || ((el && (el.getAttribute('data-username') || el.getAttribute('data-user'))) || '').trim();
        if(isCandidate(t)) return t;
      }catch(_){}
    }
    const roots = document.querySelectorAll('.user-logged, .logined_wrap, .base-dropdown-header, button.btn.btn-secondary');
    for(const root of roots){
      const nodes = root.querySelectorAll('span,p,div,b,strong');
      for(const el of nodes){
        if(!vis(el)) continue;
        const t=textOf(el);
        if(isCandidate(t)) return t;
      }
    }
    return '';
  }catch(e){ return ''; }
})();";

                var raw = await EvalJsActiveRoomHostLockedAsync(js);
                if (string.IsNullOrWhiteSpace(raw))
                    return;
                if (raw.Length >= 2 && raw[0] == '"')
                    raw = Regex.Unescape(raw).Trim('"');
                var username = raw.Trim();
                if (string.IsNullOrWhiteSpace(username))
                    return;

                _gameUsername = username;
                _gameUsernameAt = DateTime.UtcNow;
                await Dispatcher.InvokeAsync(() => RefreshDashboardAccountUi(username, null, source));
            }
            catch { }
            finally
            {
                Interlocked.Exchange(ref _gameUsernameProbeBusy, 0);
            }
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

        private long ResolveLevel1StakeForSetting(TableSetting? setting)
        {
            var moneyStrategyId = setting?.MoneyStrategy ?? _cfg?.MoneyStrategy ?? "IncreaseWhenLose";
            var csv = setting != null ? ResolveStakeCsvForSetting(setting) : (_cfg?.StakeCsv ?? "");
            BuildStakeSeqFromCsv(csv, out var stakeSeq, out var stakeChains, out _);

            if (string.Equals(moneyStrategyId, "MultiChain", StringComparison.OrdinalIgnoreCase))
            {
                if (stakeChains != null && stakeChains.Count > 0 && stakeChains[0].Length > 0)
                    return stakeChains[0][0];
            }

            if (stakeSeq != null && stakeSeq.Length > 0)
                return stakeSeq[0];

            return 1000;
        }

        private void TryForceStakeLevel1OnJs(string tableId, long amount)
        {
            if (string.IsNullOrWhiteSpace(tableId) || amount <= 0)
                return;

            try
            {
                var idJson = JsonSerializer.Serialize(tableId);
                var js = "(function(){try{if(window.__cw_forceStakeLevel1){return window.__cw_forceStakeLevel1(" + idJson + "," + amount + ");}}catch(_){}})();";
                _ = EvalJsLockedAsync(js);
            }
            catch { }
        }

        private static void NormalizeTableStrategy(TableSetting setting, out string betSeq, out string betPatterns)
        {
            betSeq = setting.BetSeq ?? "";
            betPatterns = setting.BetPatterns ?? "";
            var idx = setting.BetStrategyIndex;
            if (idx == 0) betSeq = setting.BetSeqPB ?? "";
            else if (idx == 2) betSeq = setting.BetSeqNI ?? "";
            if (idx == 1) betPatterns = setting.BetPatternsPB ?? "";
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
                    var tableTotal = state.HasJsProfit ? state.WinTotalFromJs : state.WinTotal;
                    total += tableTotal;
                }
            }
            _winTotal = total;
        }

        private void RefreshRuntimeStatusTotalsUi()
        {
            long runtimeTotalBet = 0;
            lock (_tableTasksGate)
            {
                foreach (var kv in _tableTasks)
                {
                    var state = kv.Value;
                    if (state?.Cts == null) continue;
                    if (state.Cts.IsCancellationRequested) continue;
                    runtimeTotalBet += Math.Max(0, state.RunTotalBet);
                }
            }

            if (LblTotalStake != null)
            {
                if (runtimeTotalBet > 0)
                    LblTotalStake.Text = runtimeTotalBet.ToString("N0");
                else
                {
                    var hasFreshGameTotalBet = !string.IsNullOrWhiteSpace(_gameTotalBet) &&
                                               (DateTime.UtcNow - _gameTotalBetAt) <= TimeSpan.FromSeconds(10);
                    LblTotalStake.Text = hasFreshGameTotalBet ? _gameTotalBet : "0";
                }
            }

            if (LblWin != null)
                LblWin.Text = _winTotal.ToString("N0");
        }

        private void CheckTableCutAndStopIfNeeded(TableSetting setting, TableTaskState state)
        {
            if (setting == null || state == null) return;
            if (_virtualBettingActive) return;

            var cutProfit = setting.CutProfit;
            var cutLoss = setting.CutLoss;
            var tableTotal = state.HasJsProfit ? state.WinTotalFromJs : state.WinTotal;

            if (cutProfit <= 0 && cutLoss <= 0) return;

            if (cutProfit > 0 && tableTotal >= cutProfit)
            {
                StopTableTask(setting.Id, $"Dat CAT LAI ban {ResolveRoomName(setting.Id)}: {tableTotal:N0} >= {cutProfit:N0}");
                return;
            }

            if (cutLoss > 0)
            {
                var lossThreshold = -cutLoss;
                if (tableTotal <= lossThreshold)
                {
                    StopTableTask(setting.Id, $"Dat CAT LO ban {ResolveRoomName(setting.Id)}: {tableTotal:N0} <= {lossThreshold:N0}");
                }
            }
        }

        private GameContext BuildContextForTable(TableSetting setting, TableTaskState state)
        {
            var moneyStrategyId = setting.MoneyStrategy ?? "IncreaseWhenLose";
            var stakeCsv = ResolveStakeCsvForSetting(setting);
            BuildStakeSeqFromCsv(stakeCsv, out var stakeSeq, out var stakeChains, out var stakeChainTotals);
            var level1Stake = 1000L;
            if (string.Equals(moneyStrategyId, "MultiChain", StringComparison.OrdinalIgnoreCase))
            {
                if (stakeChains != null && stakeChains.Count > 0 && stakeChains[0].Length > 0)
                    level1Stake = stakeChains[0][0];
            }
            else if (stakeSeq.Length > 0)
            {
                level1Stake = stakeSeq[0];
            }
            NormalizeTableStrategy(setting, out var betSeq, out var betPatterns);
            var tableId = setting.Id ?? "";

            return new GameContext
            {
                TableId = tableId,
                GetSnap = () =>
                {
                    if (TryGetTaskSnapshot(tableId, out var snap))
                        return snap;
                    return new CwSnapshot
                    {
                        abx = "overlay_state",
                        seq = "",
                        session = "",
                        prog = 0,
                        ts = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
                    };
                },
                EvalJsAsync = EvalJsActiveRoomHostLockedAsync,
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
                MoneyResetVersion = state.MoneyResetVersion,
                IsVirtualBettingActive = () => _virtualBettingActive,

                UiSetSide = s => Dispatcher.Invoke(() =>
                {
                    state.LastBetSide = (s ?? "").Trim().ToUpperInvariant();
                    _ = PushBetPlanToOverlayAsync(tableId, state.LastBetSide, state.LastBetAmount, state.LastBetLevelText);
                    if (!IsActiveTable(tableId)) return;
                    SetLastSideUI(s);
                }),
                UiSetStake = v => Dispatcher.Invoke(() =>
                {
                    if (state.ForceStakeLevel1Applied && !state.ForceStakeLevel1)
                        state.ForceStakeLevel1Applied = false;
                    var stakeValue = v;
                    if (state.ForceStakeLevel1 && v > 0)
                    {
                        state.ForceStakeLevel1 = false;
                        state.ForceStakeLevel1Applied = true;
                        stakeValue = level1Stake;
                        TryForceStakeLevel1OnJs(tableId, level1Stake);
                        Log($"[RESET-L1] table={tableId} amount={level1Stake:N0}");
                    }
                    UpdateStakeIndexForTable(state, stakeSeq, stakeValue);
                    if (state.HoldWinTotalUntilLevel1 && state.StakeLevelIndexForUi == 0 && stakeValue > 0)
                    {
                        state.HoldWinTotalUntilLevel1 = false;
                        state.HoldWinTotalSkipLogged = false;
                        Log($"[WINHOLD] resume accumulate at level 1 ({tableId})");
                    }
                    var rounded = (long)Math.Round(stakeValue);
                    state.LastBetAmount = rounded;
                    state.LastBetLevelText = (state.StakeLevelIndexForUi >= 0 && stakeSeq.Length > 0)
                        ? $"{state.StakeLevelIndexForUi + 1}/{stakeSeq.Length}"
                        : "";
                    UpdateTableStatsStake(state, state.LastBetAmount);
                    _ = PushBetPlanToOverlayAsync(tableId, state.LastBetSide, state.LastBetAmount, state.LastBetLevelText);
                    if (!IsActiveTable(tableId))
                        return;

                    if (LblStake != null)
                        LblStake.Text = stakeValue.ToString("N0");
                }),

                UiAddWin = delta => Dispatcher.InvokeAsync(() =>
                {
                    if (state.HoldWinTotalUntilLevel1 && state.StakeLevelIndexForUi != 0)
                    {
                        if (!state.HoldWinTotalSkipLogged)
                        {
                            state.HoldWinTotalSkipLogged = true;
                            Log($"[WINHOLD] skip accumulate until level 1 ({tableId})");
                        }
                        return;
                    }
                    var stake = Math.Abs(delta);
                    if (state.ForceStakeLevel1Applied && state.LastBetAmount > 0)
                    {
                        stake = state.LastBetAmount;
                        state.ForceStakeLevel1Applied = false;
                    }
                    var isWin = delta > 0;
                    var side = (state.LastBetSide ?? "").Trim().ToUpperInvariant();
                    double net;
                    if (isWin)
                    {
                        if (side == "B" || side == "BANKER")
                            net = Math.Round(stake * 0.95);
                        else
                            net = stake;
                    }
                    else
                    {
                        net = -stake;
                    }
                    if (!state.HasJsProfit)
                        state.WinTotal += net;
                    try { MoneyHelper.NotifyTempProfit(moneyStrategyId, net); } catch { }
                    RecomputeGlobalWinTotal();
                    RefreshRuntimeStatusTotalsUi();
                    CheckTableCutAndStopIfNeeded(setting, state);
                    CheckCutAndStopIfNeeded();
                    CheckWinGeTotalBetResetIfNeeded();
                    UpdateTableStatsWin(state, net);
                }),
                UiWinLoss = s => Dispatcher.Invoke(() =>
                {
                    UpdateTableStatsWinLoss(state, s);
                    var outcome = s.HasValue
                        ? (s.Value ? "win" : "loss")
                        : "tie";
                    _ = PushBetStatsToOverlayAsync(tableId, state.WinTotalOverlay, state.WinCount, state.LossCount, outcome);
                    if (!IsActiveTable(tableId)) return;
                    SetWinLossUI(s);
                }),
            };
        }

        private async Task RunTableTaskAsync(TableSetting setting, TableTaskState state, IBetTask task, CancellationToken ct)
        {
            var ctx = BuildContextForTable(setting, state);

            try
            {
                var snap = ctx.GetSnap?.Invoke();
                Log($"[TASKDBG] table={setting.Id} strategy={task.DisplayName} snapSrc={snap?.abx ?? ""} session={snap?.session ?? ""} seqLen={snap?.seq?.Length ?? 0} prog={snap?.prog?.ToString() ?? ""}");
            }
            catch (Exception ex)
            {
                Log($"[TASKDBG] table={setting.Id} snapshot error: {ex.Message}");
            }

            await task.RunAsync(ctx, ct);

            state.MoneyChainIndex = ctx.MoneyChainIndex;
            state.MoneyChainStep = ctx.MoneyChainStep;
            state.MoneyChainProfit = ctx.MoneyChainProfit;
            state.MoneyResetVersion = ctx.MoneyResetVersion;
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
                    state.Stats = GetOrCreateStatsForTable(tableId);
                    _tableTasks[tableId] = state;
                }
                else if (!string.IsNullOrWhiteSpace(tableName))
                {
                    state.TableName = tableName;
                }
                else if (state.Stats == null)
                {
                    state.Stats = GetOrCreateStatsForTable(tableId);
                }

                return state;
            }
        }

        private static double ReadJsonMoney(JsonElement el)
        {
            if (el.ValueKind == JsonValueKind.Number)
                return el.GetDouble();
            if (el.ValueKind == JsonValueKind.String)
                return ParseMoneyOrZero(el.GetString() ?? "");
            return 0;
        }

        private static long ReadJsonLong(JsonElement el)
        {
            if (el.ValueKind == JsonValueKind.Number)
            {
                if (el.TryGetInt64(out var v))
                    return v;
                return (long)Math.Round(el.GetDouble(), MidpointRounding.AwayFromZero);
            }
            if (el.ValueKind == JsonValueKind.String)
            {
                var d = ParseMoneyOrZero(el.GetString() ?? "");
                return (long)Math.Round(d, MidpointRounding.AwayFromZero);
            }
            return 0;
        }

        private void ApplyProfitUpdate(string tableId, string? tableName, double profit)
        {
            if (string.IsNullOrWhiteSpace(tableId))
                return;

            Dispatcher.BeginInvoke(new Action(() =>
            {
                var state = GetOrCreateTableTaskState(tableId, tableName);
                if (!IsTableRunning(state))
                    return;
                if (_virtualBettingActive)
                    return;
                if (state.HoldWinTotalUntilLevel1 && state.StakeLevelIndexForUi != 0)
                {
                    if (!state.HoldWinTotalSkipLogged)
                    {
                        state.HoldWinTotalSkipLogged = true;
                        Log($"[WINHOLD] skip accumulate until level 1 ({tableId})");
                    }
                    return;
                }

                var next = profit;
                if (Math.Abs(state.WinTotalFromJs - next) < 0.001 && state.HasJsProfit)
                    return;

                state.WinTotalFromJs = next;
                state.WinTotal = next;
                state.HasJsProfit = true;

                RecomputeGlobalWinTotal();
                if (LblWin != null) LblWin.Text = _winTotal.ToString("N0");

                var setting = FindTableSetting(tableId);
                if (setting != null)
                    CheckTableCutAndStopIfNeeded(setting, state);
                CheckCutAndStopIfNeeded();
                CheckWinGeTotalBetResetIfNeeded();
            }));
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

        private bool HasActiveTableRequests()
        {
            lock (_tableTasksGate)
            {
                foreach (var state in _tableTasks.Values)
                {
                    if (state == null)
                        continue;
                    if (IsTableRunning(state) || state.AutoStartRequested)
                        return true;
                }
            }

            return false;
        }

        private bool HasRunnableTableGameData(string tableId, out CwSnapshot snap)
        {
            if (TryGetPopupRoadSnapshot(tableId, out var popupSnap))
            {
                var popupSeqLen = popupSnap.seq?.Length ?? 0;
                var popupHasHistory = popupSeqLen > 0 || !string.IsNullOrWhiteSpace(popupSnap.last);
                if (!string.IsNullOrWhiteSpace(popupSnap.session) && popupHasHistory)
                {
                    snap = popupSnap;
                    return true;
                }
            }

            if (TryGetOverlaySnapshot(tableId, out var overlaySnap))
            {
                var overlaySeqLen = overlaySnap.seq?.Length ?? 0;
                var overlayHasHistory = overlaySeqLen > 0 || !string.IsNullOrWhiteSpace(overlaySnap.last);
                if (!string.IsNullOrWhiteSpace(overlaySnap.session) && overlayHasHistory)
                {
                    snap = overlaySnap;
                    return true;
                }
            }

            snap = new CwSnapshot
            {
                abx = "overlay_state",
                seq = "",
                last = "",
                session = "",
                ts = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                prog = 0
            };
            return false;
        }

        private bool ShouldKeepDeferredStart(TableTaskState state)
        {
            if (state == null || string.IsNullOrWhiteSpace(state.TableId))
                return false;
            if (!state.AutoStartRequested)
                return false;
            if (IsTableRunning(state))
                return false;
            if (!_overlayActiveRooms.Contains(state.TableId))
                return false;
            return true;
        }

        private void ScheduleDeferredTableStart(TableTaskState state, string? tableName, bool skipGlobalChecks)
        {
            if (state == null || string.IsNullOrWhiteSpace(state.TableId))
                return;
            if (Interlocked.Exchange(ref state.DeferredStartScheduled, 1) == 1)
                return;

            var tableId = state.TableId;
            Log($"[TASK] defer start until synced: {tableId}");

            _ = Task.Run(async () =>
            {
                try
                {
                    while (true)
                    {
                        await Task.Delay(1500);

                        if (!ShouldKeepDeferredStart(state))
                            return;

                        if (!HasRunnableTableGameData(tableId, out var readySnap))
                            continue;

                        Log($"[TASK] synced -> auto start table={tableId} src={readySnap.abx} session={readySnap.session} seqLen={readySnap.seq?.Length ?? 0} prog={readySnap.prog?.ToString() ?? ""}");
                        await Dispatcher.InvokeAsync(async () =>
                        {
                            if (ShouldKeepDeferredStart(state))
                                await StartTableTaskAsync(tableId, tableName, skipGlobalChecks);
                        });
                        return;
                    }
                }
                catch (Exception ex)
                {
                    Log("[TASK] deferred start error " + tableId + ": " + ex.Message);
                }
                finally
                {
                    Interlocked.Exchange(ref state.DeferredStartScheduled, 0);
                }
            });
        }

        private void UpdateRunAllButtonState()
        {
            if (BtnRunAllTables == null) return;

            var anyActive = HasActiveTableRequests();
            if (anyActive)
            {
                BtnRunAllTables.Content = "Dừng chạy tất cả";
                var danger = TryFindResource("DangerButton") as Style;
                if (danger != null) BtnRunAllTables.Style = danger;
            }
            else
            {
                BtnRunAllTables.Content = "Chạy tất cả bàn";
                var primary = TryFindResource("PrimaryButton") as Style;
                if (primary != null) BtnRunAllTables.Style = primary;
            }

            BtnRunAllTables.IsEnabled = true;
            SetPlayButtonState(anyActive);
        }

        private async Task SetOverlayPlayStateAsync(string tableId, bool isRunning)
        {
            if (string.IsNullOrWhiteSpace(tableId))
                return;

            var idJson = JsonSerializer.Serialize(tableId);
            var flag = isRunning ? "true" : "false";
            var script = $"window.__abxTableOverlay && window.__abxTableOverlay.setPlayState && window.__abxTableOverlay.setPlayState({idJson}, {flag});";
            try { await ExecuteOverlayScriptAsync(script); } catch { }
        }

        private async Task ToggleTablePlayAsync(string tableId, string? tableName = null)
        {
            if (string.IsNullOrWhiteSpace(tableId)) return;
            var state = GetOrCreateTableTaskState(tableId, tableName);
            if (IsTableRunning(state))
            {
                Log("[OVERLAY] toggle stop table=" + tableId);
                StopTableTask(tableId, "manual");
                return;
            }

            Log("[OVERLAY] toggle start table=" + tableId + " name=" + (tableName ?? ""));
            state.AutoStartRequested = true;
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
                    Log("[DEC] missing __cw_bet, ensure tool/game bridge.");
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

        private bool IsTrialModeRequestedOrActive()
        {
            return (ChkTrial?.IsChecked == true)
                || (_cfg?.UseTrial == true)
                || string.Equals(_expireMode, "trial", StringComparison.OrdinalIgnoreCase);
        }

        private async Task<bool> EnsureLicenseOnceAsync()
        {
            if (!CheckLicense) return true;

            var trialMode = IsTrialModeRequestedOrActive();
            Log($"[AccessGate] trial={trialMode} | chk={(ChkTrial?.IsChecked == true)} | cfg={(_cfg?.UseTrial == true)} | mode={_expireMode}");

            if (trialMode)
                return await EnsureTrialAsync();

            var username = (T(TxtUser) ?? "").Trim().ToLowerInvariant();
            if (string.IsNullOrWhiteSpace(username))
            {
                MessageBox.Show("Chưa nhập tên đăng nhập.", "Automino",
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
            var lic = await FetchLicenseAsync(username);
            if (lic == null)
            {
                MessageBox.Show("Không tìm thấy license cho tài khoản này. Hãy liên hệ Telegram: @minoauto.",
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
                MessageBox.Show("Tool đã hết hạn. Hãy liên hệ Telegram: @minoauto để gia hạn.",
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

        private async Task<bool> EnsureTrialAsync()
        {
            if (!CheckLicense) return true;

            EnsureDeviceId();
            EnsureTrialKey();
            if (string.IsNullOrWhiteSpace(_trialKey))
            {
                MessageBox.Show("Không xác định được DeviceId để dùng thử.", "Automino",
                    MessageBoxButton.OK, MessageBoxImage.Warning);
                return false;
            }

            if (_runExpiresAt != null)
            {
                var now = DateTimeOffset.Now;
                bool sameMode = string.Equals(_expireMode, "trial", StringComparison.OrdinalIgnoreCase);
                if (sameMode && _runExpiresAt.Value > now)
                    return true;
            }

            DateTimeOffset? localTrialUntil = null;

            try
            {
                var savedTrialKey = (_cfg.TrialSessionKey ?? "").Trim();
                if (string.Equals(savedTrialKey, _trialKey, StringComparison.OrdinalIgnoreCase) &&
                    DateTimeOffset.TryParse(_cfg.TrialUntil, out var trialUntilUtc) &&
                    trialUntilUtc > DateTimeOffset.UtcNow)
                {
                    localTrialUntil = trialUntilUtc;
                    Log("[Trial] found local session until " + trialUntilUtc.ToString("u"));
                }
                else if (!string.IsNullOrWhiteSpace(_cfg.TrialUntil) || !string.IsNullOrWhiteSpace(_cfg.TrialSessionKey))
                {
                    ClearLocalTrialState(saveAsync: false);
                }

                var sessionId = _leaseSessionId;
                using var http = new HttpClient(new HttpClientHandler
                {
                    SslProtocols = System.Security.Authentication.SslProtocols.Tls12
                });

                if (!EnableLeaseCloudflare)
                {
                    MessageBox.Show("Chế độ dùng thử cần Cloudflare. Vui lòng bật lại để dùng thử.", "Automino",
                        MessageBoxButton.OK, MessageBoxImage.Warning);
                    return false;
                }

                var url = $"{LeaseBaseUrl}/trial/{Uri.EscapeDataString(_trialKey)}";
                var json = JsonSerializer.Serialize(new { clientId = _trialKey, sessionId, deviceId = _deviceId, appId = AppLocalDirName });
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
                    catch { trialEndsAt = DateTimeOffset.UtcNow.AddMinutes(30); }

                    _cfg.TrialUntil = trialEndsAt.ToString("o");
                    _cfg.TrialSessionKey = _trialKey;
                    _cfg.UseTrial = true;
                    _ = SaveConfigAsync();

                    StartExpiryCountdown(trialEndsAt, "trial");
                    StartLeaseHeartbeat(_trialKey, _trialKey);
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
                    MessageBox.Show("Thiết bị đang chạy ở nơi khác. Vui lòng dừng ở máy kia trước.",
                        "Automino", MessageBoxButton.OK, MessageBoxImage.Warning);
                }
                else if (string.Equals(error, "trial-consumed", StringComparison.OrdinalIgnoreCase))
                {
                    ClearLocalTrialState(saveAsync: true);
                    MessageBox.Show(TrialConsumedTodayMessage,
                        "Automino", MessageBoxButton.OK, MessageBoxImage.Information);
                }
                else
                {
                    if (localTrialUntil.HasValue)
                    {
                        _cfg.TrialUntil = localTrialUntil.Value.ToString("o");
                        _cfg.TrialSessionKey = _trialKey;
                        _cfg.UseTrial = true;
                        _ = SaveConfigAsync();

                        StartExpiryCountdown(localTrialUntil.Value, "trial");
                        StartLeaseHeartbeat(_trialKey, _trialKey);
                        Log("[Trial] fallback local session until " + localTrialUntil.Value.ToString("u"));
                        return true;
                    }

                    MessageBox.Show("Không thể bắt đầu chế độ dùng thử. Vui lòng thử lại.",
                        "Automino", MessageBoxButton.OK, MessageBoxImage.Warning);
                }
                return false;
            }
            catch (Exception ex)
            {
                Log("[Trial ERR] " + ex.Message);
                if (localTrialUntil.HasValue)
                {
                    _cfg.TrialUntil = localTrialUntil.Value.ToString("o");
                    _cfg.TrialSessionKey = _trialKey;
                    _cfg.UseTrial = true;
                    _ = SaveConfigAsync();

                    StartExpiryCountdown(localTrialUntil.Value, "trial");
                    StartLeaseHeartbeat(_trialKey, _trialKey);
                    Log("[Trial] fallback local after error until " + localTrialUntil.Value.ToString("u"));
                    return true;
                }

                MessageBox.Show("Không thể kết nối chế độ dùng thử.", "Automino",
                    MessageBoxButton.OK, MessageBoxImage.Warning);
                return false;
            }
        }

        private bool ValidateInputsForTable(TableSetting setting)
        {
            int idx = setting.BetStrategyIndex;
            if (idx == 0)
            {
                var seq = setting.BetSeqPB ?? setting.BetSeq ?? "";
                if (!ValidateSeqPB(seq, out var err))
                {
                    Log($"[TABLE] invalid BetSeqPB for {setting.Id}: {err}");
                    return false;
                }
            }
            else if (idx == 1)
            {
                var pat = setting.BetPatternsPB ?? setting.BetPatterns ?? "";
                if (!ValidatePatternsPB(pat, out var err))
                {
                    Log($"[TABLE] invalid BetPatternsPB for {setting.Id}: {err}");
                    return false;
                }
            }

            return true;
        }

        private IBetTask CreateBetTask(int strategyIndex)
        {
            return strategyIndex switch
            {
                0 => new BaccaratWM.Tasks.SeqParityFollowTask(),
                1 => new BaccaratWM.Tasks.PatternParityTask(),
                2 => new BaccaratWM.Tasks.SmartPrevTask(),
                3 => new BaccaratWM.Tasks.RandomParityTask(),
                4 => new BaccaratWM.Tasks.AiStatParityTask(),
                5 => new BaccaratWM.Tasks.StateTransitionBiasTask(),
                6 => new BaccaratWM.Tasks.RunLengthBiasTask(),
                7 => new BaccaratWM.Tasks.EnsembleMajorityTask(),
                8 => new BaccaratWM.Tasks.TimeSlicedHedgeTask(),
                9 => new BaccaratWM.Tasks.KnnSubsequenceTask(),
                10 => new BaccaratWM.Tasks.DualScheduleHedgeTask(),
                11 => new BaccaratWM.Tasks.AiOnlineNGramTask(GetAiNGramStatePath()),
                12 => new BaccaratWM.Tasks.AiExpertPanelTask(),
                13 => new BaccaratWM.Tasks.Top10PatternFollowTask(),
                _ => new BaccaratWM.Tasks.SmartPrevTask(),
            };
        }

        private async Task StartTableTaskAsync(string tableId, string? tableName = null, bool skipGlobalChecks = false)
        {
            if (string.IsNullOrWhiteSpace(tableId))
                return;

            _stopCleanupDone = false;
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

                if (!skipGlobalChecks)
                {
                    await EnsureWebReadyAsync();

                    if (!await EnsureGameReadyForBetAsync())
                        return;

                    if (CheckLicense)
                    {
                        var ok = await EnsureLicenseOnceAsync();
                        if (!ok) return;
                    }
                }

                state.AutoStartRequested = true;
                _ = SetOverlayPlayStateAsync(tableId, true);
                UpdateRunAllButtonState();

                await EvalJsLockedAsync("window.__cw_startPush && window.__cw_startPush(240);");
                Log("[CW] ensure push 240ms");

                var ready = await WaitForBridgeAndGameDataAsync(tableId, 15000);
                if (!ready)
                {
                    Log("[DEC] data not ready, retry push.");
                    await EvalJsLockedAsync("window.__cw_startPush && window.__cw_startPush(240);");
                    ready = await WaitForBridgeAndGameDataAsync(tableId, 15000);
                    if (!ready)
                    {
                        Log("[DEC] data still syncing, defer start.");
                        ScheduleDeferredTableStart(state, tableName, skipGlobalChecks);
                        return;
                    }
                }

                state.Decision = new DecisionState();
                state.Cooldown = false;
                state.StakeLevelIndexForUi = -1;
                state.WinTotal = 0;
                state.WinTotalFromJs = 0;
                state.HasJsProfit = false;
                state.WinTotalOverlay = 0;
                state.WinCount = 0;
                state.LossCount = 0;
                state.LastWinAmount = 0;
                state.RunTotalBet = 0;
                state.MoneyChainIndex = 0;
                    state.MoneyChainStep = 0;
                    state.MoneyChainProfit = 0;
                    state.MoneyResetVersion = MoneyHelper.GetGlobalResetVersion();
                    state.HoldWinTotalUntilLevel1 = false;
                    state.HoldWinTotalSkipLogged = false;

                RecomputeGlobalWinTotal();
                RefreshRuntimeStatusTotalsUi();
                _ = PushBetStatsToOverlayAsync(tableId, 0, 0, 0);

                if (!HasRunningTasks())
                {
                    _cutStopTriggered = false;
                    _winTotal = 0;
                    _virtualBettingActive = _cfg?.WaitCutLossBeforeBet == true;
                    if (_virtualBettingActive)
                        Log("[VIRTUAL] start: wait cut loss before real bet");
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

                        state.AutoStartRequested = false;
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
                if (!IsTableRunning(state) && Interlocked.CompareExchange(ref state.DeferredStartScheduled, 0, 0) == 0)
                {
                    state.AutoStartRequested = false;
                    _ = SetOverlayPlayStateAsync(tableId, false);
                    UpdateRunAllButtonState();
                }
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
            state.AutoStartRequested = false;
            state.HasJsProfit = false;
            state.WinTotalFromJs = 0;
            state.WinTotal = 0;

            if (!string.IsNullOrWhiteSpace(reason))
                Log("[TASK] stop " + reason);

            _ = SetOverlayPlayStateAsync(tableId, false);
            AfterStopTasksUpdate();
        }

        private void StopAllTables(string? reason = null)
        {
            if (Interlocked.Exchange(ref _stopAllInProgress, 1) == 1)
                return;
            List<string> ids;
            lock (_tableTasksGate)
            {
                ids = _tableTasks.Keys.ToList();
            }
            try
            {
                if (!string.IsNullOrWhiteSpace(reason))
                    Log("[STOP] all tables, reason=" + reason);
                foreach (var id in ids)
                {
                    if (string.IsNullOrWhiteSpace(id)) continue;
                    try { StopTableTaskInternal(id, reason); } catch { }
                }

                AfterStopTasksUpdate();
            }
            finally
            {
                Interlocked.Exchange(ref _stopAllInProgress, 0);
            }
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
            state.AutoStartRequested = false;

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
                _virtualBettingActive = false;
                Log("[VIRTUAL] disabled: no running tasks");
                if (_stopCleanupDone)
                    return;
                _stopCleanupDone = true;
                TaskUtil.ClearBetCooldown();
                StopExpiryCountdown();
                StopLicenseRecheckTimer();
                StopLeaseHeartbeat();
                _licenseCheckTask = null;
                _licenseCheckUser = null;
                var uname = ResolveLeaseUsername();
                if (!string.IsNullOrWhiteSpace(uname))
                    _ = ReleaseLeaseAsync(uname);
                Log("[STOP] cleanup done");
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

                await EnsureWebReadyAsync();
                if (!await EnsureGameReadyForBetAsync())
                    return;
                if (CheckLicense)
                {
                    var ok = await EnsureLicenseOnceAsync();
                    if (!ok) return;
                }

                async Task StartOneAsync(string id, string name, int delayMs)
                {
                    if (delayMs > 0)
                        await Task.Delay(delayMs);
                    await StartTableTaskAsync(id, name, skipGlobalChecks: true);
                }

                var tasks = new List<Task>();
                var idx = 0;
                foreach (var id in targets)
                {
                    var name = ResolveRoomName(id);
                    var delayMs = idx * 60;
                    tasks.Add(StartOneAsync(id, name, delayMs));
                    idx++;
                }
                await Task.WhenAll(tasks);
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
        private int _stopAllInProgress = 0;
        private bool _stopCleanupDone = false;
        private long _leaseReleaseLastAt = 0;
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
            bool popupVisible = PopupHost?.Visibility == Visibility.Visible && _popupWeb?.CoreWebView2 != null;
            var popupWeb = popupVisible ? _popupWeb : null;

            try
            {
                // Chỉ chạy khi WebView2 đã sẵn sàng
                if (Web?.CoreWebView2 == null && popupWeb?.CoreWebView2 == null)
                {
                    return;
                }

                await EnsureMouseLockScriptAsync(); // đảm bảo có __abx_lockMouse trong trang

                // Khoá/mở chuột bằng overlay bên trong DOM (an toàn trên VPS/RDP)
                await SetMouseLockAsync(Web, false);
                await SetMouseLockAsync(popupWeb, locked);
            }
            catch (Exception ex)
            {
                Log("[LockMouse] " + ex.Message);
            }

            // (tuỳ chọn) overlay WPF để hiển thị tooltip/cursor trên app
            if (MouseShield != null)
                MouseShield.Visibility = (locked && popupVisible) ? Visibility.Visible : Visibility.Collapsed;

            // ❗ Quan trọng: KHÔNG đụng Web.IsEnabled để tránh crash WebView2 trên VPS/RDP
            if (Web != null)
                Web.IsHitTestVisible = true;
            if (_popupWeb != null)
                _popupWeb.IsHitTestVisible = !(locked && popupVisible);
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


        private async Task SetMouseLockAsync(WebView2? web, bool locked)
        {
            if (web?.CoreWebView2 == null) return;
            await EnsureMouseLockScriptAsync(web);
            await web.ExecuteScriptAsync(
                $"window.__abx_lockMouse && window.__abx_lockMouse({(locked ? "true" : "false")});");
        }

        private async Task EnsureMouseLockScriptAsync(WebView2? targetWeb)
        {
            if (targetWeb?.CoreWebView2 == null) return;
            if (ReferenceEquals(targetWeb, Web))
                await EnsureMouseLockScriptAsync();
            else if (ReferenceEquals(targetWeb, _popupWeb))
            {
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
            pointer-events: auto;
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
        d.title = 'Dang khoa chuot';
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

                if (!_popupLockJsRegistered)
                {
                    await targetWeb.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(LOCK_JS);
                    _popupLockJsRegistered = true;
                }
                await targetWeb.ExecuteScriptAsync(LOCK_JS);
            }
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
            if (!_mainLockJsRegistered)
            {
                await Web.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(LOCK_JS);
                _mainLockJsRegistered = true;
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

        // đặt trong MainWindow.xaml.cs (project BaccaratWM)

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
            string u = TextNorm.U(sRaw);

            bool isPlayer = false, isBanker = false, isTie = false;

            if (s.Length == 1 && char.IsDigit(s[0]))
            {
                // tail số từ chuỗi kết quả: 0/2/4 => PLAYER, 1/3 => BANKER
                char d = s[0];
                isPlayer = (d == '0' || d == '2' || d == '4');
                isBanker = (d == '1' || d == '3');
            }
            else
            {
                isPlayer = (s == "P" || s == "PLAYER");
                isBanker = (s == "B" || s == "BANKER");
                isTie = (s == "T" || s == "TIE" || u.Contains("HOA"));
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

            if (!isPlayer && !isBanker && !isTie)
            {
                ShowText("");
                return;
            }

            // Ưu tiên lấy ảnh trong Resource (ImgPlayer/ImgBanker) -> nếu không có thì dùng SharedIcons
            string resKey = isTie ? "ImgTie" : (isBanker ? "ImgBanker" : "ImgPlayer");
            var resImg = TryFindResource(resKey) as ImageSource;

            ImageSource? icon =
                resImg
                ?? (isTie ? (SharedIcons.ResultTie ?? FallbackIcons.GetResultTie())
                          : (isPlayer ? (SharedIcons.ResultPlayer ?? SharedIcons.SidePlayer)
                                      : (SharedIcons.ResultBanker ?? SharedIcons.SideBanker)));

            if (icon != null && ImgKetQua != null)
            {
                // Hiển thị ảnh + ẩn chữ
                ImgKetQua.Source = icon;
                ImgKetQua.Visibility = Visibility.Visible;
                if (LblKetQua != null) LblKetQua.Visibility = Visibility.Collapsed;

                // Cache lại để DataGrid (converters) có thể "kế thừa" từ trạng thái
                if (isTie) SharedIcons.ResultTie = icon;
                else if (isPlayer) SharedIcons.ResultPlayer = icon;
                else SharedIcons.ResultBanker = icon;
            }
            else
            {
                // Không có ảnh -> fallback chữ có dấu
                ShowText(isTie ? "HÒA" : (isPlayer ? "PLAYER" : "BANKER"));
            }
        }


        private void SetLastSideUI(string? result)
        {
            // Chuẩn hoá
            var s = (result ?? "").Trim().ToUpperInvariant();
            bool isBanker = s == "B" || s == "BANKER";
            bool isPlayer = s == "P" || s == "PLAYER";

            void ShowText(string text)
            {
                if (ImgSide != null) ImgSide.Visibility = Visibility.Collapsed;
                if (LblSide != null)
                {
                    LblSide.Visibility = Visibility.Visible;
                    LblSide.Text = string.IsNullOrWhiteSpace(text) ? "" : text;
                }
            }

            if (isBanker || isPlayer)
            {
                var key = isBanker ? "ImgBanker" : "ImgPlayer";
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

                // TIỀN CƯỢC
                if (LblStake != null) LblStake.Text = "";  // TIỀN CƯỢC

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
            if (_licenseCheckTimer == null)
                return;
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

        private void EnsureDeviceId()
        {
            if (!string.IsNullOrWhiteSpace(_deviceId)) return;
            try
            {
                _deviceId = BuildDeviceId();
            }
            catch
            {
                _deviceId = HashSha256(Environment.MachineName ?? "unknown-device");
            }
            if (!string.IsNullOrWhiteSpace(_deviceId))
                Log("[DeviceId] ready");
        }

        private void EnsureTrialKey()
        {
            EnsureDeviceId();
            var deviceKey = (_deviceId ?? "").Trim().ToLowerInvariant();
            if (string.IsNullOrWhiteSpace(deviceKey))
                return;
            if (string.Equals(_trialKey, deviceKey, StringComparison.OrdinalIgnoreCase))
                return;
            _trialKey = deviceKey;
            Log("[TrialKey] " + _trialKey);
        }

        private void ClearLocalTrialState(bool saveAsync = true)
        {
            _cfg.TrialUntil = "";
            _cfg.TrialSessionKey = "";
            _cfg.UseTrial = false;
            if (saveAsync)
                _ = SaveConfigAsync();
        }

        private static string BuildDeviceId()
        {
            var parts = new List<string>();
            AddPart(parts, ReadMachineGuid());
            AddPart(parts, ReadWmiValue("SELECT UUID FROM Win32_ComputerSystemProduct", "UUID"));
            AddPart(parts, ReadWmiValue("SELECT ProcessorId FROM Win32_Processor", "ProcessorId"));
            var disk = ReadWmiValue("SELECT SerialNumber FROM Win32_PhysicalMedia", "SerialNumber")
                       ?? ReadWmiValue("SELECT SerialNumber FROM Win32_DiskDrive", "SerialNumber");
            AddPart(parts, disk);
            AddPart(parts, ReadMacAddress());

            var raw = string.Join("|", parts.Where(p => !string.IsNullOrWhiteSpace(p)));
            if (string.IsNullOrWhiteSpace(raw))
                raw = Environment.MachineName;
            return HashSha256(raw);
        }

        private static void AddPart(List<string> parts, string? value)
        {
            var v = (value ?? "").Trim();
            if (!string.IsNullOrWhiteSpace(v))
                parts.Add(v);
        }

        private static string HashSha256(string input)
        {
            using var sha = SHA256.Create();
            var bytes = sha.ComputeHash(Encoding.UTF8.GetBytes(input));
            return Convert.ToHexString(bytes).ToLowerInvariant();
        }

        private static string? ReadMachineGuid()
        {
            try
            {
                using var key = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Cryptography");
                return key?.GetValue("MachineGuid")?.ToString();
            }
            catch { return null; }
        }

        private static string? ReadWmiValue(string query, string propName)
        {
            try
            {
                var searcherType = Type.GetType("System.Management.ManagementObjectSearcher, System.Management", throwOnError: false);
                if (searcherType == null)
                    return null;

                using var searcher = Activator.CreateInstance(searcherType, query) as IDisposable;
                if (searcher == null)
                    return null;

                var getMethod = searcherType.GetMethod("Get", Type.EmptyTypes);
                var results = getMethod?.Invoke(searcher, null) as System.Collections.IEnumerable;
                if (results == null)
                    return null;

                foreach (var obj in results)
                {
                    var val = obj?.GetType().InvokeMember(
                        propName,
                        BindingFlags.GetProperty,
                        binder: null,
                        target: obj,
                        args: null)?.ToString();
                    if (!string.IsNullOrWhiteSpace(val))
                        return val.Trim();
                }
            }
            catch { }
            return null;
        }

        private static string? ReadMacAddress()
        {
            try
            {
                foreach (var ni in NetworkInterface.GetAllNetworkInterfaces())
                {
                    if (ni.NetworkInterfaceType == NetworkInterfaceType.Loopback)
                        continue;
                    if (ni.OperationalStatus != OperationalStatus.Up)
                        continue;
                    var mac = ni.GetPhysicalAddress()?.ToString();
                    if (!string.IsNullOrWhiteSpace(mac))
                        return mac;
                }
            }
            catch { }
            return null;
        }

        private async Task<string> LoadHomeJsAsync()
        {
            var diskCandidates = new List<string>();
            try
            {
                void AddCandidate(string? dir)
                {
                    if (string.IsNullOrWhiteSpace(dir))
                        return;
                    var path = Path.Combine(dir, "js_home_v2.js");
                    if (!diskCandidates.Any(x => string.Equals(x, path, StringComparison.OrdinalIgnoreCase)))
                        diskCandidates.Add(path);
                }

                AddCandidate(AppContext.BaseDirectory);
                AddCandidate(Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location));
                AddCandidate(Path.GetDirectoryName(Assembly.GetEntryAssembly()?.Location));
                AddCandidate(Environment.CurrentDirectory);
            }
            catch { }

            foreach (var diskPath in diskCandidates)
            {
                try
                {
                    if (!File.Exists(diskPath))
                        continue;

                    var text = RemoveUtf8Bom(await File.ReadAllTextAsync(diskPath, Encoding.UTF8));
                    Log($"[Bridge] Loaded HOME JS from disk: {diskPath} (len={text.Length})");
                    if (!string.IsNullOrWhiteSpace(text))
                        return text;
                    Log("[Bridge] HOME JS on disk is empty: " + diskPath);
                }
                catch (Exception ex)
                {
                    Log("[Bridge] Read HOME JS on disk failed: " + diskPath + " :: " + ex.Message);
                }
            }
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
                              ?? "BaccaratWM.js_home_v2.js"; // fallback tên logic
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
            if (_gameRoomPushRegId == null)
                _gameRoomPushRegId = await Web.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(GAME_TABLE_PUSH_JS);

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
                await Web.CoreWebView2.ExecuteScriptAsync(GAME_TABLE_PUSH_JS);

                // Kích autostart trên top (idempotent – nếu không có __cw_startPush thì không sao)
                await Web.CoreWebView2.ExecuteScriptAsync(FRAME_AUTOSTART);
                // Nếu KHÔNG phải host games.* thì khởi động push của js_home_v2
                await Web.CoreWebView2.ExecuteScriptAsync(BuildHomeAutostartJs(_homePushMs));


                _lastDocKey = key;
                Log("[Bridge] Injected on current doc, key=" + key);
            }


        }

        private async Task EnsureToolBridgeInjectedAsync()
        {
            await EnsureWebReadyAsync();
            await EnsureBridgeRegisteredAsync();
            await InjectOnNewDocAsync();
            Log("[Bridge] Explicit tool injection requested on main WebView");
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
                _ = f.ExecuteScriptAsync(GAME_TABLE_PUSH_JS);
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
                _ = f.ExecuteScriptAsync(GAME_TABLE_PUSH_JS);
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
                _ = f.ExecuteScriptAsync(GAME_TABLE_PUSH_JS);
                _ = f.ExecuteScriptAsync(FRAME_AUTOSTART);

                Log("[Bridge] Frame NavigationCompleted -> reinjected + autostart.");
            }
            catch (Exception ex)
            {
                Log("[Bridge.Frame NavigationCompleted] " + ex.Message);
            }
        }


        private async Task<bool> WaitForBridgeAndGameDataAsync(string tableId, int timeoutMs = 20000)
        {
            var t0 = DateTime.UtcNow;
            bool lastHasBet = false;
            bool lastHasState = false;
            string lastSrc = "";
            string lastSession = "";
            int lastSeqLen = 0;
            double lastProg = 0;
            while ((DateTime.UtcNow - t0).TotalMilliseconds < timeoutMs)
            {
                try
                {
                    // 1) __cw_bet có chưa
                    var typeBet = (await EvalJsLockedAsync("typeof window.__cw_bet"))?.Trim('"');
                    bool hasBet = string.Equals(typeBet, "function", StringComparison.OrdinalIgnoreCase);

                    // 2) Đã có dữ liệu state theo bàn chưa (overlay hoặc popup server road)
                    bool hasState = HasRunnableTableGameData(tableId, out var snap);

                    lastHasBet = hasBet;
                    lastHasState = hasState;
                    lastSrc = snap.abx ?? "";
                    lastSession = snap.session ?? "";
                    lastSeqLen = snap.seq?.Length ?? 0;
                    lastProg = snap.prog.GetValueOrDefault();
                    if (hasBet && hasState)
                        return true;
                }
                catch { /* tiếp tục đợi */ }

                await Task.Delay(300);
            }
            Log($"[DEC] data not ready (bet={lastHasBet}, state={lastHasState}, src={lastSrc}, session={lastSession}, seqLen={lastSeqLen}, prog={lastProg:0.###}).");
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
            EnsureDeviceId();
            if (!EnableLeaseCloudflare) return true;
            if (string.IsNullOrWhiteSpace(LeaseBaseUrl)) return true; // chưa cấu hình -> bỏ qua
            try
            {
                using var http = new HttpClient() { Timeout = TimeSpan.FromSeconds(6) };
                var uname = Uri.EscapeDataString(username);
                var resp = await http.PostAsJsonAsync($"{LeaseBaseUrl}/acquire/{uname}", new { clientId = _leaseClientId, sessionId = _leaseSessionId, deviceId = _deviceId, appId = AppLocalDirName });
                var body = await resp.Content.ReadAsStringAsync();
                Log($"[Lease] acquire -> {(int)resp.StatusCode} {resp.ReasonPhrase} | {body}");
                if ((int)resp.StatusCode == 409)
                {
                    Log("[Lease] 409 in-use: " + body);
                    MessageBox.Show("Tài khoản đang chạy ở nơi khác. Vui lòng dừng ở máy kia trước.",
                        "Automino", MessageBoxButton.OK, MessageBoxImage.Warning);
                    return false;
                }
                if (!resp.IsSuccessStatusCode)
                {
                    MessageBox.Show($"Lease bị từ chối [{(int)resp.StatusCode}] - {body}", "Automino",
                        MessageBoxButton.OK, MessageBoxImage.Warning);
                    return false;
                }
                return true;
            }
            catch (Exception ex)
            {
                Log("[Lease] acquire error: " + ex.Message);
                MessageBox.Show("Không kết nối được trung tâm lease. Vui lòng kiểm tra mạng.", "Automino",
                    MessageBoxButton.OK, MessageBoxImage.Warning);
            }
            return false;
        }



        private async Task ReleaseLeaseAsync(string username)
        {
            EnsureDeviceId();
            if (!EnableLeaseCloudflare) return;
            if (string.IsNullOrWhiteSpace(LeaseBaseUrl)) return;
            var nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            var last = Interlocked.Read(ref _leaseReleaseLastAt);
            if (nowMs - last < 3000)
                return;
            Interlocked.Exchange(ref _leaseReleaseLastAt, nowMs);
            try
            {
                using var http = new HttpClient() { Timeout = TimeSpan.FromSeconds(4) };
                var uname = Uri.EscapeDataString(username);
                var resp = await http.PostAsJsonAsync($"{LeaseBaseUrl}/release/{uname}", new { clientId = _leaseClientId, sessionId = _leaseSessionId, deviceId = _deviceId, appId = AppLocalDirName });
                // không cần xử lý gì thêm; cứ fire-and-forget
                Log("[Lease] release sent: " + (int)resp.StatusCode);
            }
            catch (Exception ex)
            {
                Log("[Lease] release error: " + ex.Message);
            }
        }

        private string ResolveLeaseUsername()
        {
            return T(TxtUser).Trim().ToLowerInvariant();
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

            try { Dispatcher.BeginInvoke(new Action(() => ApplyUiMode(GetIsGameByUrlFallback()))); } catch { }

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
                                MessageBox.Show(TrialConsumedTodayMessage, "Automino", MessageBoxButton.OK, MessageBoxImage.Information);
                            }
                            else
                            {
                                MessageBox.Show("Tool của bạn hết hạn ! Hãy liên hệ Telegram: @minoauto để gia hạn", "Automino", MessageBoxButton.OK, MessageBoxImage.Warning);
                            }

                            if (ChkTrial != null) ChkTrial.IsChecked = false;
                            // Xoá nhãn
                            if (LblExpire != null) LblExpire.Text = "";
                            _runExpiresAt = null;
                            // nếu là trial thì huỷ vé local để lần sau không resume nữa
                            try { if (_expireMode == "trial") { ClearLocalTrialState(saveAsync: true); } } catch { }

                            // Ngắt heartbeat trước khi trả lease
                            StopLeaseHeartbeat();
                            // Thử trả lease luôn để nhường slot
                            var uname = ResolveLeaseUsername();
                            if (!string.IsNullOrWhiteSpace(uname))
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
            if (ChkTrial != null) ChkTrial.IsChecked = false;
            try { Dispatcher.BeginInvoke(new Action(() => ApplyUiMode(GetIsGameByUrlFallback()))); } catch { }
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
            var script = HOME_AUTOSTART_TEMPLATE.Replace("__INTERVAL__", ms.ToString());
            script = script.Replace(
                "if (/^games\\./i.test(h)) { sendGameHint(); return; }",
                "if (/^games\\./i.test(h)) { sendGameHint(); if (typeof window.__abx_hw_startTablePush==='function'){ try{ window.__abx_hw_startTablePush(Math.max(1200, __INTERVAL__)); }catch(_){} } return; }");
            script = script.Replace(
                "if (hasGameFrame()) { sendGameHint(); /* váº«n khÃ´ng start home_push */ }",
                "if (hasGameFrame()) { sendGameHint(); if (typeof window.__abx_hw_startTablePush==='function'){ try{ window.__abx_hw_startTablePush(Math.max(1200, __INTERVAL__)); }catch(_){} } }");
            return script.Replace("__INTERVAL__", ms.ToString());
        }

        private async void BtnHomeLogin_Click(object sender, RoutedEventArgs e)
        {
            await HomeClickLoginAsync();
        }

        private async void BtnHomePlay_Click(object sender, RoutedEventArgs e)
        {
            await HomeClickPlayAsync();
        }

        private void StartLeaseHeartbeat(string username, string? clientIdOverride = null)
        {
            EnsureDeviceId();
            StopLeaseHeartbeat();
            if (!EnableLeaseCloudflare) return;
            _leaseHbCts = new CancellationTokenSource();
            var cts = _leaseHbCts;
            var uname = Uri.EscapeDataString(username);
            var clientId = string.IsNullOrWhiteSpace(clientIdOverride) ? _leaseClientId : clientIdOverride;
            var sessionId = _leaseSessionId;
            Task.Run(async () =>
                {
                    while (!cts.IsCancellationRequested)
                    {
                        try
                        {
                            using var http = new HttpClient() { Timeout = TimeSpan.FromSeconds(4) };
                            var resp = await http.PostAsJsonAsync($"{LeaseBaseUrl}/heartbeat/{uname}",
                                                                  new { clientId, sessionId, deviceId = _deviceId, appId = AppLocalDirName });
                            // chỉ log nhẹ cho debug
                            Log("[Lease] hb: " + (int)resp.StatusCode);
                        }
                        catch (Exception ex) { Log("[Lease] hb err: " + ex.Message); }

                        await Task.Delay(TimeSpan.FromSeconds(600), cts.Token)
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

                var uname = ResolveLeaseUsername();
                if (!string.IsNullOrWhiteSpace(uname))
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
                try { DestroyPopupWeb(); } catch { }

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
            _popupWeb = null;
            _popupWebHooked = false;
            _popupBridgeRegistered = false;
            _popupWebMsgHooked = false;
            _popupLastDocKey = null;
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
        private int _cutAutoResetInProgress = 0;
        private bool _virtualBettingActive = false;
        private long _virtualStatusLogAtMs = 0;

        private bool TryEnterCutAutoReset()
        {
            return Interlocked.CompareExchange(ref _cutAutoResetInProgress, 1, 0) == 0;
        }

        private void ExitCutAutoReset()
        {
            Interlocked.Exchange(ref _cutAutoResetInProgress, 0);
        }

        private void EnterVirtualBettingMode()
        {
            _virtualBettingActive = true;
            Log("[VIRTUAL] enabled: wait cut loss before real bet");

            lock (_tableTasksGate)
            {
                foreach (var state in _tableTasks.Values)
                {
                    if (state?.Cts == null) continue;
                    if (state.Cts.IsCancellationRequested) continue;
                    if (!state.HasJsProfit) continue;
                    state.WinTotal = state.WinTotalFromJs;
                    state.HasJsProfit = false;
                }
            }

            RecomputeGlobalWinTotal();
            if (LblWin != null) LblWin.Text = _winTotal.ToString("N0");
        }

        private void LogVirtualStatusThrottled(string message, int minIntervalMs = 10000)
        {
            var now = Environment.TickCount64;
            if (now - _virtualStatusLogAtMs < minIntervalMs)
                return;
            _virtualStatusLogAtMs = now;
            Log(message);
        }

        // Parse tiền: cho phép số âm ở đầu, bỏ dấu chấm phẩy khoảng trắng
        private static double ParseMoney(string s)
        {
            return ParseMoneyOrZero(s);
        }

        private static string NormalizeGameBalanceText(string raw)
        {
            if (string.IsNullOrWhiteSpace(raw)) return "";
            var s = raw.Replace("\u00A0", " ").Trim();
            var m = Regex.Match(s, @"[\u20AB\u0111]\s*([0-9.,]+)", RegexOptions.IgnoreCase);
            if (m.Success)
                return m.Groups[1].Value.Trim();
            m = Regex.Match(s, @"([0-9]{1,3}(?:[.,][0-9]{2,3})+|[0-9]+)");
            return m.Success ? m.Groups[1].Value.Trim() : "";
        }

        private static string NormalizeWmServerBalanceText(string raw)
        {
            if (string.IsNullOrWhiteSpace(raw))
                return "";
            var s = raw.Replace("\u00A0", " ").Trim();
            if (double.TryParse(s, NumberStyles.Any, CultureInfo.InvariantCulture, out var invVal))
                return invVal.ToString("0.00", CultureInfo.InvariantCulture);
            if (double.TryParse(s, NumberStyles.Any, CultureInfo.GetCultureInfo("vi-VN"), out var viVal))
                return viVal.ToString("0.00", CultureInfo.InvariantCulture);
            var val = ParseMoneyOrZero(s);
            if (s.Contains('.') || s.Contains(','))
                return val.ToString("0.00", CultureInfo.InvariantCulture);
            return ((long)val).ToString("N0", CultureInfo.InvariantCulture);
        }

        private static string NormalizeGameTotalBetText(string raw)
        {
            if (string.IsNullOrWhiteSpace(raw)) return "";
            var s = raw.Replace("\u00A0", " ").Trim();
            if (string.IsNullOrWhiteSpace(s)) return "";
            var value = ParseMoneyOrZero(s);
            if (value <= 0) return s;
            return s;
        }

        private string GetDashboardUsernameText(string? fallback = null)
        {
            if (!string.IsNullOrWhiteSpace(_gameUsername))
                return _gameUsername!;
            if (!string.IsNullOrWhiteSpace(_homeUsername))
                return _homeUsername!;
            return (fallback ?? "").Trim();
        }

        private string GetDashboardBalanceText(double? fallback = null)
        {
            if (!string.IsNullOrWhiteSpace(_gameBalance))
                return _gameBalance!;
            if (!string.IsNullOrWhiteSpace(_homeBalance))
                return _homeBalance!;
            if (fallback.HasValue)
                return fallback.Value.ToString("N0", CultureInfo.InvariantCulture);
            return "-";
        }

        private void RefreshDashboardAccountUi(string? usernameFallback = null, double? balanceFallback = null, string source = "")
        {
            var usernameText = GetDashboardUsernameText(usernameFallback);
            var balanceText = GetDashboardBalanceText(balanceFallback);

            if (LblUserName != null && !string.IsNullOrWhiteSpace(usernameText))
                LblUserName.Text = usernameText;
            if (LblAmount != null)
                LblAmount.Text = balanceText;

            var sig = $"{usernameText}|{balanceText}|{source}";
            if (!string.Equals(_lastDashboardAccountSig, sig, StringComparison.Ordinal))
            {
                _lastDashboardAccountSig = sig;
                Log($"[ACCUI] source={source} user={usernameText} balance={balanceText} gameUser={_gameUsername} gameBal={_gameBalance} homeUser={_homeUsername} homeBal={_homeBalance}");
            }
        }

        // Gán UI từ config (gọi ở nơi bạn đã áp config ra UI, ví dụ sau LoadConfig)
        private void ApplyCutUiFromConfig()
        {
            if (TxtCutProfit != null) TxtCutProfit.Text = (_cfg?.CutProfit ?? 0).ToString("N0");
            if (TxtCutLoss != null) TxtCutLoss.Text = (_cfg?.CutLoss ?? 0).ToString("N0");
            if (ChkAutoResetOnCut != null) ChkAutoResetOnCut.IsChecked = (_cfg?.AutoResetOnCut == true);
            if (ChkAutoResetOnWinGeTotal != null) ChkAutoResetOnWinGeTotal.IsChecked = (_cfg?.AutoResetOnWinGeTotal == true);
            if (ChkWaitCutLossBeforeBet != null) ChkWaitCutLossBeforeBet.IsChecked = (_cfg?.WaitCutLossBeforeBet == true);
        }

        private static double ParseMoneyOrZero(string s)
        {
            if (string.IsNullOrWhiteSpace(s)) return 0;

            var raw = s.Replace("\u00A0", " ").Trim();
            var sb = new StringBuilder();
            for (int i = 0; i < raw.Length; i++)
            {
                var c = raw[i];
                if (char.IsDigit(c) || c == ',' || c == '.' || (c == '-' && sb.Length == 0))
                    sb.Append(c);
            }

            var cleaned = sb.ToString();
            if (string.IsNullOrEmpty(cleaned)) return 0;

            int lastComma = cleaned.LastIndexOf(',');
            int lastDot = cleaned.LastIndexOf('.');
            string normalized = cleaned;

            if (lastComma >= 0 && lastDot >= 0)
            {
                if (lastComma > lastDot)
                    normalized = cleaned.Replace(".", "").Replace(",", ".");
                else
                    normalized = cleaned.Replace(",", "");
            }
            else if (lastComma >= 0)
            {
                int digitsAfter = cleaned.Length - lastComma - 1;
                if (digitsAfter >= 1 && digitsAfter <= 2)
                    normalized = cleaned.Replace(".", "").Replace(",", ".");
                else
                    normalized = cleaned.Replace(",", "");
            }
            else if (lastDot >= 0)
            {
                int digitsAfter = cleaned.Length - lastDot - 1;
                if (digitsAfter >= 1 && digitsAfter <= 2)
                    normalized = cleaned.Replace(",", "");
                else
                    normalized = cleaned.Replace(".", "");
            }

            return double.TryParse(normalized, NumberStyles.Any, CultureInfo.InvariantCulture, out var v) ? v : 0;
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
            CheckWinGeTotalBetResetIfNeeded();
        }


        private void CheckCutAndStopIfNeeded()
        {
            if (_cutStopTriggered) return;
            if (_cutAutoResetInProgress != 0) return;

            double cutProfit = _cfg?.CutProfit ?? 0;   // dương ⇒ bật cắt lãi
            double cutLoss = _cfg?.CutLoss ?? 0;   // dương ⇒ bật cắt lỗ (ngưỡng là -cutLoss)

            if (_virtualBettingActive)
            {
                if (cutLoss <= 0)
                {
                    LogVirtualStatusThrottled("[VIRTUAL] cutLoss <= 0, will never switch to real bet");
                    return;
                }
                if (cutLoss > 0)
                {
                    var lossThreshold = -cutLoss;
                    if (_winTotal > lossThreshold)
                    {
                        LogVirtualStatusThrottled($"[VIRTUAL] waiting: win={_winTotal:N0} > {lossThreshold:N0}");
                        return;
                    }
                    if (_winTotal <= lossThreshold)
                    {
                        if (TryEnterCutAutoReset())
                        {
                            Log("[VIRTUAL] cut loss reached, switch to real bet");
                            _virtualBettingActive = false;
                            ResetAllProfitAndStepsForCut($"WAIT CUT LOSS: win={_winTotal:N0} <= {lossThreshold:N0}", true);
                        }
                    }
                }
                return;
            }

            // ⬇️ Không nhập (rỗng/0) ⇒ hoạt động bình thường (không cắt)
            if (cutProfit <= 0 && cutLoss <= 0) return;

            // Ưu tiên cắt lãi
                        if (cutProfit > 0 && _winTotal >= cutProfit)
            {
                if (_cfg?.AutoResetOnCut == true)
                {
                    if (TryEnterCutAutoReset())
                        ResetAllProfitAndStepsForCut($"Dat CAT LAI: win={_winTotal:N0} >= {cutProfit:N0}");
                    return;
                }
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
                    if (_cfg?.AutoResetOnCut == true)
                    {
                        if (TryEnterCutAutoReset())
                            ResetAllProfitAndStepsForCut($"Dat CAT LO: win={_winTotal:N0} <= {lossThreshold:N0}");
                        return;
                    }
                    _cutStopTriggered = true;
                    StopTaskAndNotify($"Đạt CẮT LỖ: Tiền thắng = {_winTotal:N0} ≤ {lossThreshold:N0}");
                    return;
                }
            }
        }

        private double GetCurrentTotalBetValue()
        {
            var hasFreshGameTotalBet = !string.IsNullOrWhiteSpace(_gameTotalBet) &&
                                       (DateTime.UtcNow - _gameTotalBetAt) <= TimeSpan.FromSeconds(10);
            var raw = hasFreshGameTotalBet ? _gameTotalBet : (LblTotalStake?.Text ?? "");
            return ParseMoneyOrZero(raw ?? "");
        }

        private void CheckWinGeTotalBetResetIfNeeded()
        {
            if (_cutStopTriggered) return;
            if (_cutAutoResetInProgress != 0) return;
            if (_virtualBettingActive) return;
            if (_cfg?.AutoResetOnWinGeTotal != true) return;

            var totalBet = GetCurrentTotalBetValue();
            if (totalBet <= 0) return;

            if (_winTotal >= totalBet)
            {
                if (TryEnterCutAutoReset())
                    ResetAllProfitAndStepsForCut($"Dat WIN >= TONG CUOC: win={_winTotal:N0} >= total={totalBet:N0}", true);
            }
        }


        private void ResetAllProfitAndStepsForCut(string reason, bool holdWinUntilLevel1 = false, string? alertMessage = null)
        {
            void DoReset()
            {
                try
                {
                    Log("[CUT] " + reason);
                    var alertText = string.IsNullOrWhiteSpace(alertMessage) ? reason : alertMessage;
                    _ = ShowCenterWebAlertAsync(alertText);

                    var resetVersion = MoneyHelper.RequestGlobalResetToLevel1();

                    lock (_tableTasksGate)
                    {
                        foreach (var kv in _tableTasks)
                        {
                            var state = kv.Value;
                            if (state == null) continue;

                            state.WinTotal = 0;
                            state.WinTotalFromJs = 0;
                            state.HasJsProfit = false;
                            state.WinTotalOverlay = 0;
                            state.MoneyChainIndex = 0;
                            state.MoneyChainStep = 0;
                            state.MoneyChainProfit = 0;
                            state.MoneyResetVersion = resetVersion;
                            state.StakeLevelIndexForUi = -1;
                            state.HoldWinTotalUntilLevel1 = holdWinUntilLevel1;
                            state.HoldWinTotalSkipLogged = false;
                            state.ForceStakeLevel1 = true;
                            state.ForceStakeLevel1Applied = false;
                            state.WinCount = 0;
                            state.LossCount = 0;
                            state.LastWinAmount = 0;
                            state.RunTotalBet = 0;
                            _ = PushBetStatsToOverlayAsync(state.TableId, 0, 0, 0);

                            var tableSetting = FindTableSetting(state.TableId);
                            var level1Stake = ResolveLevel1StakeForSetting(tableSetting);
                            TryForceStakeLevel1OnJs(state.TableId, level1Stake);
                        }
                    }
                    if (holdWinUntilLevel1)
                        Log("[WINHOLD] enabled: wait level 1 to resume accumulate");

                    MoneyHelper.ResetTempProfitForWinUpLoseKeep();

                    RecomputeGlobalWinTotal();
                    if (LblWin != null) LblWin.Text = _winTotal.ToString("N0");

                    if (!string.IsNullOrWhiteSpace(_activeTableId) && IsActiveTable(_activeTableId))
                        ResetBetMiniPanel();

                    _cutStopTriggered = false;
                }
                catch (Exception ex)
                {
                    Log("[CUT] reset error: " + ex.Message);
                }
                finally
                {
                    ExitCutAutoReset();
                }
            }

            if (!Dispatcher.CheckAccess())
            {
                Dispatcher.Invoke(DoReset);
                return;
            }

            DoReset();
        }
        private void StopTaskAndNotify(string reason)
        {
            try
            {
                _ = ShowCenterWebAlertAsync(reason);
                StopAllTables("cut");
                MessageBox.Show(reason, "Automino", MessageBoxButton.OK, MessageBoxImage.Information);
                Log("[CUT] " + reason);
            }
            catch { /* ignore */ }
        }

        private bool TryPopPendingBet(string tableId, out BetRow row)
            => TryPopPendingBet(tableId, 0, out row, strictGame: false);

        private bool TryPopPendingBet(string tableId, int expectedGameId, out BetRow row, bool strictGame = true)
        {
            row = null!;
            if (string.IsNullOrWhiteSpace(tableId)) return false;

            lock (_pendingBetGate)
            {
                if (expectedGameId <= 0)
                    expectedGameId = InferExpectedGameIdByTable(tableId);

                if (expectedGameId > 0)
                {
                    var strictKey = BuildPendingBetKey(expectedGameId, tableId);
                    if (!string.IsNullOrWhiteSpace(strictKey) &&
                        _pendingBetsByTable.TryGetValue(strictKey, out row!))
                    {
                        _pendingBetsByTable.Remove(strictKey);
                        goto POPPED;
                    }

                    if (strictGame)
                        return false;
                }

                if (!_pendingBetsByTable.TryGetValue(tableId, out row!))
                    return false;
                _pendingBetsByTable.Remove(tableId);
            }

        POPPED:
            if (ReferenceEquals(_pendingRow, row))
                _pendingRow = null;

            return row != null;
        }

        private void FinalizeBetRow(BetRow row, string? result, double balanceAfter)
        {
            if (row == null || string.IsNullOrWhiteSpace(result)) return;

            var normResult = NormalizeSide(result ?? "");
            row.Result = string.IsNullOrWhiteSpace(normResult)
                ? (result ?? "").Trim().ToUpperInvariant()
                : normResult;

            if (string.Equals(row.Result, "T", StringComparison.OrdinalIgnoreCase))
            {
                row.WinLose = "Hòa";
            }
            else
            {
                bool win = string.Equals(row.Side, row.Result, StringComparison.OrdinalIgnoreCase);
                row.WinLose = win ? "Thắng" : "Thua";
            }

            row.Account = balanceAfter;
            Log($"[HIST][FINAL] table={row.Table} side={row.Side} stake={row.Stake:N0} result={row.Result} wl={row.WinLose} account={row.Account:0.##}");
            try { AppendBetCsv(row); } catch { /* ignore IO */ }

            if (_autoFollowNewest)
            {
                ShowFirstPage();
            }
            else
            {
                RefreshCurrentPage();
            }
        }

        private static bool IsTieResult(string result)
        {
            var u = TextNorm.U(result);
            return u == "T" || u == "TIE" || u.StartsWith("HOA");
        }

        private static long ComputeWinAmount(long stake, string side)
        {
            if (stake <= 0) return 0;
            var norm = NormalizeSide(side ?? "");
            if (string.Equals(norm, "B", StringComparison.OrdinalIgnoreCase))
                return (long)Math.Round(stake * 0.95);
            if (string.Equals(norm, "P", StringComparison.OrdinalIgnoreCase))
                return stake;
            return stake;
        }

        private void ApplyBetStatsForTable(string tableId, BetRow row)
        {
            if (row == null || string.IsNullOrWhiteSpace(tableId))
                return;
            var state = GetOrCreateTableTaskState(tableId, row.Table);
            var side = NormalizeSide(row.Side ?? "");
            var result = NormalizeSide(row.Result ?? "");
            var isTie = IsTieResult(row.Result ?? "");
            long winAmount = 0;
            string outcome = isTie ? "tie" : "";
            var counted = false;
            if (!isTie && !string.IsNullOrWhiteSpace(side) && !string.IsNullOrWhiteSpace(result))
            {
                if (string.Equals(side, result, StringComparison.OrdinalIgnoreCase))
                {
                    winAmount = ComputeWinAmount(row.Stake, side);
                    state.WinCount++;
                    outcome = "win";
                    counted = true;
                }
                else
                {
                    winAmount = -Math.Abs(row.Stake);
                    state.LossCount++;
                    outcome = "loss";
                    counted = true;
                }
            }
            if (counted)
                state.WinTotalOverlay += winAmount;
            state.LastWinAmount = winAmount;
            _ = PushBetStatsToOverlayAsync(tableId, state.WinTotalOverlay, state.WinCount, state.LossCount, outcome);
        }


        private void FinalizeLastBet(string? result, double balanceAfter)
        {
            if (_pendingRow == null || string.IsNullOrWhiteSpace(result)) return;

            var normResult = NormalizeSide(result ?? "");
            _pendingRow.Result = string.IsNullOrWhiteSpace(normResult)
                ? (result ?? "").Trim().ToUpperInvariant()
                : normResult;
            if (string.Equals(_pendingRow.Result, "T", StringComparison.OrdinalIgnoreCase))
            {
                _pendingRow.WinLose = "Hòa";
            }
            else
            {
                bool win = string.Equals(_pendingRow.Side, _pendingRow.Result, StringComparison.OrdinalIgnoreCase);
                _pendingRow.WinLose = win ? "Thắng" : "Thua";
            }
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

            if (!string.IsNullOrWhiteSpace(_activeTableId))
            {
                ApplyBetStatsForTable(_activeTableId, _pendingRow);
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

                        bool hasTable = cols.Length >= 8;
                        int baseIdx = hasTable ? 0 : -1;
                        string normSide = NormalizeSide(cols[4 + baseIdx]);
                        string normResult = NormalizeSide(cols[5 + baseIdx]);
                        string normWL = NormalizeWL(cols[6 + baseIdx]);

                        var row = new BetRow
                        {
                            At = at,
                            Game = cols[1]?.Trim() ?? "",
                            Table = hasTable ? (cols[2]?.Trim() ?? "") : "",
                            Stake = long.TryParse(cols[3 + baseIdx], out var st) ? st : 0,
                            Side = normSide,
                            Result = normResult,
                            WinLose = normWL,
                            Account = double.TryParse(cols[7 + baseIdx], NumberStyles.Any, CultureInfo.InvariantCulture, out var ac) ? ac : 0,
                        };
                        tmp.Add(row);
                        if (tmp.Count >= maxTotal) break;
                    }
                    if (tmp.Count >= maxTotal) break;
                }

                _betAll.Clear();
                _betAll.AddRange(tmp.OrderByDescending(r => r.At).Take(maxTotal));
                Log($"[HIST][LOAD] files={files.Count} rows={_betAll.Count} max={maxTotal}");
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
            if (u == "P" || u == "PLAYER") return "P";
            if (u == "B" || u == "BANKER") return "B";
            return (s ?? "").Trim();
        }
        private static string NormalizeWL(string s)
        {
            var u = TextNorm.U(s);
            if (u.StartsWith("THANG")) return "Thắng";
            if (u.StartsWith("THUA")) return "Thua";
            if (u.StartsWith("HOA") || u == "T" || u == "TIE") return "Hòa";
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
                    sw.WriteLine("At,Game,Table,Stake,Side,Result,WinLose,Account");
                // CSV đơn giản, At lưu ISO để dễ parse
                var accountText = r.Account.ToString("0.##", CultureInfo.InvariantCulture);
                sw.WriteLine($"{r.At:O},{r.Game},{r.Table},{r.Stake},{r.Side},{r.Result},{r.WinLose},{accountText}");
                Log($"[HIST][CSV] file={Path.GetFileName(file)} table={r.Table} side={r.Side} stake={r.Stake:N0} result={r.Result} wl={r.WinLose}");
            }
            catch (Exception ex)
            {
                Log("[HIST][CSV][ERR] " + ex.Message);
            }
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

        private static string NormalizePBInput(string raw)
        {
            if (string.IsNullOrEmpty(raw)) return "";
            var sb = new System.Text.StringBuilder(raw.Length);
            foreach (var ch in raw)
            {
                var u = char.ToUpperInvariant(ch);
                if (u == 'C') u = 'P';
                else if (u == 'L') u = 'B';
                sb.Append(u);
            }
            return sb.ToString();
        }

        // --- Chuỗi P/B: P,B; 2..100 ký tự sau khi bỏ phân tách ---
        private static bool ValidateSeqPB(string s, out string err)
        {
            err = "";
            if (string.IsNullOrWhiteSpace(s))
            {
                err = "Vui lòng nhập chuỗi P/B.";
                return false;
            }

            int count = 0;
            foreach (var ch in NormalizePBInput(s))
            {
                if (char.IsWhiteSpace(ch)) continue;          // chỉ cho phép khoảng trắng
                char u = char.ToUpperInvariant(ch);
                if (u == 'P' || u == 'B') { count++; continue; }
                err = "Chỉ cho phép khoảng trắng và ký tự P hoặc B.";
                return false;
            }

            if (count < 2 || count > 100)
            {
                err = "Độ dài 2–100 ký tự (tính theo P/B, bỏ qua khoảng trắng).";
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

        // --- Thế cầu P/B: từng dòng "<mẫu> - <đặt>", mẫu gồm P/B/?, đặt là P hoặc B ---
        private static bool ValidatePatternsPB(string s, out string err)
        {
            err = "";
            if (string.IsNullOrWhiteSpace(s))
            {
                err = "Vui lòng nhập các thế cầu P/B.";
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

                // <mẫu> (P/B, cho phép khoảng trắng)  -> hoặc -  <chuỗi cầu> (P/B, CHO PHÉP khoảng trắng)
                var m = System.Text.RegularExpressions.Regex.Match(
                    line,
                    @"^\s*([PBpb\s]+)\s*(?:->|-)\s*([PBpb\s]+)\s*$",
                    System.Text.RegularExpressions.RegexOptions.IgnoreCase);

                if (!m.Success)
                {
                    err = $"Quy tắc {idx} không hợp lệ: “{line}”. Dạng đúng: <mẫu> -> <chuỗi cầu> hoặc <mẫu>-<chuỗi cầu>; chỉ dùng P/B; <chuỗi cầu> có thể có khoảng trắng.";
                    return false;
                }

                // LHS: chỉ P/B + khoảng trắng; độ dài 1–20 sau khi bỏ khoảng trắng
                var lhsRaw = m.Groups[1].Value;
                var lhsBuf = new System.Text.StringBuilder(lhsRaw.Length);
                foreach (char ch in lhsRaw)
                {
                    if (char.IsWhiteSpace(ch)) continue;
                    char u = char.ToUpperInvariant(ch);
                    if (u == 'P' || u == 'B') lhsBuf.Append(u);
                    else { err = $"Quy tắc {idx}: <mẫu_quá_khứ> chỉ gồm P/B (cho phép khoảng trắng giữa các ký tự)."; return false; }
                }
                var lhs = lhsBuf.ToString();
                if (lhs.Length < 1 || lhs.Length > 20)
                {
                    err = $"Quy tắc {idx}: độ dài <mẫu_quá_khứ> phải 1–20 ký tự (P/B).";
                    return false;
                }

                // RHS: chuỗi cầu P/B (>=1), CHO PHÉP khoảng trắng (bị bỏ qua khi kiểm tra)
                var rhsRaw = m.Groups[2].Value;
                var rhsBuf = new System.Text.StringBuilder(rhsRaw.Length);
                foreach (char ch in rhsRaw)
                {
                    if (char.IsWhiteSpace(ch)) continue;
                    char u = char.ToUpperInvariant(ch);
                    if (u == 'P' || u == 'B') rhsBuf.Append(u);
                    else { err = $"Quy tắc {idx}: <chuỗi cầu> chỉ gồm P/B (có thể nhiều ký tự), cho phép khoảng trắng."; return false; }
                }
                if (rhsBuf.Length < 1)
                {
                    err = $"Quy tắc {idx}: <chuỗi cầu> tối thiểu 1 ký tự P/B.";
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

                // LHS: chỉ I/N + khoảng trắng; độ dài 1–20 sau khi bỏ khoảng trắng
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
                if (lhs.Length < 1 || lhs.Length > 20)
                {
                    err = $"Quy tắc {idx}: độ dài <mẫu_quá_khứ> phải 1–20 ký tự (I/N).";
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
            if (idx == 0) // 1. Chuỗi P/B
            {
                if (!ValidateSeqPB(T(TxtChuoiCau), out var err))
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
            else if (idx == 1) // 2. Thế P/B
            {
                if (!ValidatePatternsPB(T(TxtTheCau), out var err))
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
            if (idx == 0) { if (TxtChuoiCau != null) TxtChuoiCau.Text = _cfg.BetSeqPB ?? ""; }
            else if (idx == 2) { if (TxtChuoiCau != null) TxtChuoiCau.Text = _cfg.BetSeqNI ?? ""; }

            if (idx == 1) { if (TxtTheCau != null) TxtTheCau.Text = _cfg.BetPatternsPB ?? ""; }
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

            var idx = CmbBetStrategy?.SelectedIndex ?? -1;       // 0: P/B, 2: N/I
            var txtRaw = (TxtChuoiCau?.Text ?? "").Trim();
            var txt = NormalizePBInput(txtRaw);

            // Lưu tách bạch cho từng chiến lược
            if (idx == 0) _cfg.BetSeqPB = txt;    // Chiến lược 1: Chuỗi P/B
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

            var idx = CmbBetStrategy?.SelectedIndex ?? -1;       // 1: P/B, 3: N/I
            var txtRaw = (TxtTheCau?.Text ?? "").Trim();
            var txt = NormalizePBInput(txtRaw);

            // Lưu tách bạch cho từng chiến lược
            if (idx == 1) _cfg.BetPatternsPB = txt;  // Chiến lược 2: Thế P/B
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
                    ? ValidateSeqPB(s, out var e1)
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
                    ? ValidatePatternsPB(s, out var e2)
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


