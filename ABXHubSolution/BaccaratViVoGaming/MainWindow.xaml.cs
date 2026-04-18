using System;
using System.IO;
using System.Text;
using System.Text.Json;
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
using BaccaratViVoGaming;
using BaccaratViVoGaming.Tasks;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Globalization;
using System.Windows.Documents;
using System.Reflection;
using System.Diagnostics;
using System.IO.Compression;
using System.Runtime.CompilerServices;
using Microsoft.Web.WebView2.Wpf;  // <-- cái này để có CoreWebView2Creation
using System.Net.Http;
using System.Net.Http.Json;
using System.ComponentModel;
using System.Linq;
using System.Collections.ObjectModel;
using System.Collections.Specialized;
using System.Windows.Data;
using static BaccaratViVoGaming.MainWindow;
using System.Windows.Input;
using Microsoft.Win32;
using System.Net.NetworkInformation;




namespace BaccaratViVoGaming
{
    // Fallback loader: nếu SharedIcons chưa có, nạp từ Assets (pack URI).
    // Fallback loader: nếu SharedIcons chưa có, nạp từ Resources (pack URI).
    internal static class FallbackIcons
    {
        private const string SideBankerPng = "Assets/side/BANKER.png";
        private const string SidePlayerPng = "Assets/side/PLAYER.png";
        private const string ResultBankerPng = "Assets/side/BANKER.png";
        private const string ResultPlayerPng = "Assets/side/PLAYER.png";
        private const string ResultTiePng = "Assets/side/TIE.png";
        private const string WinPng = "Assets/kq/THANG.png";
        private const string LossPng = "Assets/kq/THUA.png";
        private const string DrawPng = "Assets/kq/HOA.png";
        private const string TuTrangPng = "Assets/side/TU_TRANG.png";
        private const string TuDoPng = "Assets/side/TU_DO.png";
        private const string SapDoiPng = "Assets/side/SAP_DOI.png";
        private const string Trang3Do1Png = "Assets/side/1DO_3TRANG.png";
        private const string Do3Trang1Png = "Assets/side/1TRANG_3DO.png";

        private static ImageSource? _sideChan, _sideLe, _resultChan, _resultLe, _resultTie, _win, _loss, _draw;
        private static ImageSource? _tuTrang, _tuDo, _sapDoi, _trang3Do1, _do3Trang1;

        public static ImageSource? GetSideBanker() => SharedIcons.SideBanker ?? (_sideChan ??= Load(SideBankerPng));
        public static ImageSource? GetSidePlayer() => SharedIcons.SidePlayer ?? (_sideLe ??= Load(SidePlayerPng));
        public static ImageSource? GetResultBanker() => SharedIcons.ResultBanker ?? (_resultChan ??= Load(ResultBankerPng));
        public static ImageSource? GetResultPlayer() => SharedIcons.ResultPlayer ?? (_resultLe ??= Load(ResultPlayerPng));
        public static ImageSource? GetResultTie() => _resultTie ??= Load(ResultTiePng);
        public static ImageSource? GetWin() => SharedIcons.Win ?? (_win ??= Load(WinPng));
        public static ImageSource? GetLoss() => SharedIcons.Loss ?? (_loss ??= Load(LossPng));
        public static ImageSource? GetDraw() => SharedIcons.Draw ?? (_draw ??= Load(DrawPng));
        public static ImageSource? GetTuTrang() => SharedIcons.TuTrang ?? (_tuTrang ??= Load(TuTrangPng));
        public static ImageSource? GetTuDo() => SharedIcons.TuDo ?? (_tuDo ??= Load(TuDoPng));
        public static ImageSource? GetSapDoi() => SharedIcons.SapDoi ?? (_sapDoi ??= Load(SapDoiPng));
        public static ImageSource? GetTrang3Do1() => SharedIcons.Trang3Do1 ?? (_trang3Do1 ??= Load(Trang3Do1Png));
        public static ImageSource? GetDo3Trang1() => SharedIcons.Do3Trang1 ?? (_do3Trang1 ??= Load(Do3Trang1Png));

        private static string[] BuildPackUris(string relativePath)
        {
            var asm = typeof(FallbackIcons).Assembly.GetName().Name;
            return new[]
            {
                $"pack://application:,,,/{asm};component/{relativePath}",
                $"pack://application:,,,/{relativePath}",
                $"pack://application:,/{relativePath}"
            };
        }

        internal static ImageSource? LoadPackImage(string relativePath)
        {
            foreach (var uri in BuildPackUris(relativePath))
            {
                try
                {
                    var bi = new BitmapImage();
                    bi.BeginInit();
                    bi.UriSource = new Uri(uri, UriKind.Absolute);
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

            // Fallback đọc file vật lý cạnh DLL khi pack URI không resolve (plugin)
            try
            {
                var asmDir = Path.GetDirectoryName(typeof(FallbackIcons).Assembly.Location) ?? "";
                var filePath = Path.Combine(asmDir, relativePath.Replace('/', Path.DirectorySeparatorChar));
                if (File.Exists(filePath))
                {
                    var bi = new BitmapImage();
                    bi.BeginInit();
                    bi.UriSource = new Uri(filePath, UriKind.Absolute);
                    bi.CacheOption = BitmapCacheOption.OnLoad;
                    bi.EndInit();
                    bi.Freeze();
                    return bi;
                }
            }
            catch
            {
            }

            return null;
        }

        private static ImageSource? Load(string relativePath)
        {
            // Quan trọng: trả null nếu tất cả URI thất bại để DataTemplate fallback sang text.
            return LoadPackImage(relativePath);
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
        internal static ImageSource? ResolveResultIcon(string resourceKey, string fallbackAsset)
        {
            try
            {
                if (System.Windows.Application.Current?.Resources != null &&
                    System.Windows.Application.Current.Resources[resourceKey] is ImageSource img)
                    return img;
            }
            catch { }

            return FallbackIcons.LoadPackImage(fallbackAsset);
        }

        public object Convert(object value, Type t, object p, CultureInfo c)
        {
            var u = TextNorm.U(value?.ToString() ?? "");
            if (u == "BANKER" || u == "B") return FallbackIcons.GetSideBanker();
            if (u == "PLAYER" || u == "P") return FallbackIcons.GetSidePlayer();
            return null;
        }
        public object ConvertBack(object v, Type t, object p, CultureInfo c) => Binding.DoNothing;
    }

    public sealed class KetQuaToIconConverter : IValueConverter
    {
        private static readonly Dictionary<char, ImageSource?> _ballIcons = new();

        private static ImageSource? LoadBall(char d)
        {
            if (_ballIcons.TryGetValue(d, out var img))
                return img;

            // Ưu tiên ảnh đã merge vào App.Resources (PackRes đã làm)
            try
            {
                if (System.Windows.Application.Current?.Resources != null)
                {
                    var key = $"ImgBALL{d}";
                    if (System.Windows.Application.Current.Resources[key] is ImageSource resImg)
                        img = resImg;
                }
            }
            catch { }

            img ??= d switch
            {
                '0' => FallbackIcons.GetTuTrang(),
                '1' => FallbackIcons.GetDo3Trang1(),
                '2' => FallbackIcons.GetSapDoi(),
                '3' => FallbackIcons.GetTrang3Do1(),
                '4' => FallbackIcons.GetTuDo(),
                _ => null
            };
            _ballIcons[d] = img;
            return img; // có thể null -> XAML sẽ hiển thị chữ thay thế
        }

        public object Convert(object value, Type t, object p, CultureInfo c)
        {
            var u = TextNorm.U(value?.ToString() ?? "");
            if (u == "BANKER" || u == "B") return SideToIconConverter.ResolveResultIcon("ImgBANKER", "Assets/side/BANKER.png");
            if (u == "PLAYER" || u == "P") return SideToIconConverter.ResolveResultIcon("ImgPLAYER", "Assets/side/PLAYER.png");
            if (u == "TIE" || u == "T" || u == "HOA") return SideToIconConverter.ResolveResultIcon("ImgTIE", "Assets/side/TIE.png");

            char digit = '\0';
            if (u.Length == 1 && char.IsDigit(u[0])) digit = u[0];
            else if (u.StartsWith("BALL", StringComparison.OrdinalIgnoreCase) && u.Length >= 5)
            {
                var cBall = u[4];
                if (cBall == 'B') return SideToIconConverter.ResolveResultIcon("ImgBANKER", "Assets/side/BANKER.png");
                if (cBall == 'P') return SideToIconConverter.ResolveResultIcon("ImgPLAYER", "Assets/side/PLAYER.png");
                if (char.IsDigit(cBall)) digit = cBall;
            }

            if (digit >= '0' && digit <= '4')
            {
                return (digit == '1' || digit == '3')
                    ? SideToIconConverter.ResolveResultIcon("ImgPLAYER", "Assets/side/PLAYER.png")
                    : SideToIconConverter.ResolveResultIcon("ImgBANKER", "Assets/side/BANKER.png");
            }

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
            if (u.StartsWith("HOA") || u == "TIE" || u == "T") return FallbackIcons.GetDraw();
            return null;
        }
        public object ConvertBack(object v, Type t, object p, CultureInfo c) => Binding.DoNothing;
    }

    public sealed class TabOverlapMarginConverter : IMultiValueConverter
    {
        public object Convert(object[] values, Type targetType, object parameter, CultureInfo culture)
        {
            int index = 0;
            if (values != null && values.Length > 0)
            {
                if (values[0] is int i) index = i;
                else if (values[0] != null && int.TryParse(values[0].ToString(), out var parsed)) index = parsed;
            }

            double overlap = 0;
            if (values != null && values.Length > 1)
            {
                if (values[1] is double d) overlap = d;
                else if (values[1] != null && double.TryParse(values[1].ToString(), out var od)) overlap = od;
            }

            int count = 0;
            if (values != null && values.Length > 2)
            {
                if (values[2] is int c) count = c;
                else if (values[2] != null && int.TryParse(values[2].ToString(), out var pc)) count = pc;
            }

            const double gap = 6;
            double left = (index > 0 && overlap > 0) ? -overlap : 0;
            double right = (count > 0 && index >= count - 1) ? 0 : gap;
            return new Thickness(left, 0, right, 0);
        }

        public object[] ConvertBack(object value, Type[] targetTypes, object parameter, CultureInfo culture)
            => throw new NotSupportedException();
    }
    public partial class MainWindow : Window
    {
        public static readonly DependencyProperty TabHeaderWidthProperty =
            DependencyProperty.Register(nameof(TabHeaderWidth), typeof(double), typeof(MainWindow), new PropertyMetadata(120d));

        public static readonly DependencyProperty TabOverlapProperty =
            DependencyProperty.Register(nameof(TabOverlap), typeof(double), typeof(MainWindow), new PropertyMetadata(0d));

        public double TabHeaderWidth
        {
            get => (double)GetValue(TabHeaderWidthProperty);
            set => SetValue(TabHeaderWidthProperty, value);
        }

        public double TabOverlap
        {
            get => (double)GetValue(TabOverlapProperty);
            set => SetValue(TabOverlapProperty, value);
        }

        public static readonly DependencyProperty TabStripWidthProperty =
            DependencyProperty.Register(nameof(TabStripWidth), typeof(double), typeof(MainWindow), new PropertyMetadata(0d));

        public double TabStripWidth
        {
            get => (double)GetValue(TabStripWidthProperty);
            set => SetValue(TabStripWidthProperty, value);
        }

        private const double TabMaxWidth = 160;
        private const double TabMinWidth = 90;
        private const double TabMinVisibleWidth = 50;
        private const double TabGap = 6;
        private const double TabAddButtonWidth = 32;
        private const double TabAddButtonGap = 4;
        private const double TabBaseOverlap = 8;
        private const double TabStripRightInset = 16;


        private const string AppLocalDirName = "BaccaratViVoGaming"; // đổi thành tên bạn muốn
        // ====== App paths ======
        private readonly string _appDataDir;
        private readonly string _cfgPath;
        private readonly string _statsPath;
        private readonly string _logDir;

        // ====== State ======
        private bool _uiReady = false;
        private bool _didStartupNav = false;
        private bool _webHooked = false;
        private CancellationTokenSource? _navCts, _userCts, _passCts, _stakeCts, _sideRateCts;

        // ====== JS Awaiters ======
        private readonly ConcurrentDictionary<string, TaskCompletionSource<string>> _jsAwaiters =
            new ConcurrentDictionary<string, TaskCompletionSource<string>>();

        // ====== CDP / Packet tap ======
        private bool _cdpNetworkOn = false;
        private readonly ConcurrentDictionary<string, byte> _cdpTapOwners = new();
        private readonly ConcurrentDictionary<string, int> _cdpTapOwnerCoreHash = new();
        private readonly ConcurrentDictionary<string, long> _cdpTapOwnerGeneration = new();
        private readonly ConcurrentDictionary<string, string> _wsUrlByRequestId = new();
        private readonly ConcurrentDictionary<string, string> _pktLastPreviewByKey = new();
        private readonly ConcurrentDictionary<string, byte> _recordedValidBetKeys = new();
        private readonly ConcurrentDictionary<string, byte> _bridgeProbeSeen = new();
        private long _cdpTapGenerationSeed = 0;
        private long _cdpDiagWsCreated = 0;
        private long _cdpDiagWsRecv = 0;
        private long _cdpDiagWsSent = 0;
        private long _cdpDiagObservedPackets = 0;
        private long _cdpDiagWinnerPackets = 0;
        private long _cdpDiagMissingContextRows = 0;
        private long _cdpDiagLastPulseTicksUtc = 0;
        private long _cdpDiagLastObservedTicksUtc = 0;
        private long _cdpDiagLastWinnerTicksUtc = 0;
        private long _cdpDiagLastMissingContextLogTicksUtc = 0;
        private readonly string[] _pktInterestingHints = new[] { "wss://", "websocket", "hytsocesk", "xoc", "live", "socket" };
        private readonly string[] _pktPayloadInterestingHints = new[] { "result", "winner", "banker", "player", "tie", "road", "history", "countdown", "status", "settle", "open", "close", "\"b\"", "\"p\"", "\"t\"" };
        private readonly string[] _httpInterestingHints = new[] { "/player/query/", "querywebgamehallroad", "queryenablefunctionforwebsite", "hallroad", "road", "result", "winner", "history" };

        // === Fields ================================================================
        private volatile CwSnapshot _lastSnap;
        private readonly object _snapLock = new();
        private CancellationTokenSource _taskCts;
        private IBetTask _activeTask;
        private const int SeqWindowMax = 50;
        private const int NiSeqMax = 50;
        private readonly System.Text.StringBuilder _niSeq = new(NiSeqMax);
        private readonly object _roundStateLock = new();

        // Tổng B/P của ván đang diễn ra (để dùng khi ván vừa khép lại)
        private long _roundTotalsB = 0;
        private long _roundTotalsP = 0;
        private long _roundTotalsT = 0;
        private int _lastSeqLenNi = 0;
        private bool _lockMajorMinorUpdates = false;
        private string _baseSeq = "";
        private string _baseSeqDisplay = "";
        private long _baseSeqVersion = 0;
        private string _baseSeqEvent = "";
        private string _baseSeqSource = "js";
        // BoardSeq: chuỗi đang hiện trên web cho shoe hiện tại, có thể reset khi xáo bài/đổi bàn.
        private string _boardSeqDisplay = "";
        private long _boardSeqVersion = 0;
        private string _boardSeqEvent = "";
        // SyncSeq: chuỗi đồng bộ logic/server cho 1 bàn; chỉ reset khi đổi bàn.
        private string _syncSeqPrefixDisplay = "";
        private string _netSeqDisplay = "";
        private long _netSeqVersion = 0;
        private string _netSeqEvent = "";
        private string _netSeqSource = "";
        private long _netSeqTableId = 0;
        private long _netSeqGameShoe = 0;
        private long _netSeqLastRound = 0;
        private long _netObservedTableId = 0;
        private long _netObservedGameShoe = 0;
        private long _netObservedGameRound = 0;
        private bool _suppressJsBootstrapAfterObservedReset = false;
        private readonly ConcurrentDictionary<long, HallRoundSnapshot> _hallRoundCache = new();
        private string _netLastWinnerKey = "";
        private DateTime _netLastWinnerAt = DateTime.MinValue;
        private DateTime _lastHistAlertUtc = DateTime.MinValue;
        private int _lastSeqRxLen = -1;
        private long _lastSeqRxVer = -1;
        private string _lastSeqRxEvt = "";
        private char _lastSeqRxTail = '\0';
        private int _lastSeqRxPending = -1;
        private bool _lastSeqRxLock = false;
        private long _lastAdvanceRejectVersionOnlyVer = -1;
        private int _shoeChangeStatusStreak = 0;
        private bool _shoeChangeRebaseArmed = false;
        private DateTime _shoeChangeLastSeenUtc = DateTime.MinValue;
        private DateTime _shoeChangeRebaseArmedAtUtc = DateTime.MinValue;
        private string _shoeChangeArmSource = "";
        private string _shoeChangeArmEvent = "";
        private DateTime _lastShoeRebaseAppliedUtc = DateTime.MinValue;
        private int _lastShoeRebaseAppliedLen = 0;
        private string _lastBaccaratFrameKey = "";
        private string _lastBaccaratFrameHref = "";
        private bool _tableSwitchRebaseArmed = false;
        private DateTime _tableSwitchRebaseArmedAtUtc = DateTime.MinValue;
        private string _tableSwitchFromKey = "";
        private string _tableSwitchToKey = "";
        private string _tableSwitchFromHref = "";
        private string _tableSwitchToHref = "";
        private bool _initialTableEnterArmed = false;
        private DateTime _initialTableEnterArmedAtUtc = DateTime.MinValue;

        private DecisionState _dec = new();
        private long[] _stakeSeq = Array.Empty<long>();
        private System.Collections.Generic.List<long[]> _stakeChains = new();
        private long[] _stakeChainTotals = Array.Empty<long>();
        // Chỉ dùng cho hiển thị LblLevel: vị trí hiện tại trong _stakeSeq
        private int _stakeLevelIndexForUi = -1;

        private double _decisionPercent = 10; // %

        // Chống bắn trùng khi vừa cược
        private bool _cooldown = false;

        // Cache & cờ để không inject lặp lại
        private string? _appJs;
        private bool _webMsgHooked; // để gắn WebMessageReceived đúng 1 lần




        private string? _topForwardId, _appJsRegId;           // id script TOP_FORWARD
        private bool _frameHooked;               // đã gắn FrameCreated?
        private bool _frameNavHooked;            // đã gắn FrameNavigationStarting/Completed?
        private string? _lastDocKey;             // key document hiện tại (performance.timeOrigin)
                                                 // Bridge đăng ký toàn cục
        private string? _autoStartId;        // id script FRAME_AUTOSTART (đăng ký toàn cục)
        private bool _domHooked;             // đã gắn DOMContentLoaded cho top chưa
        private readonly ConcurrentDictionary<ulong, byte> _mainFrameBridgeArmed = new();
        private readonly ConcurrentDictionary<ulong, CoreWebView2Frame> _mainFrameRefs = new();
        private readonly ConcurrentDictionary<int, CoreWebView2Frame> _popupFrameRefs = new();
        private readonly ConcurrentDictionary<int, string> _frameInjectedDocKeys = new();
        private DateTime _lastMainFramesRearmUtc = DateTime.MinValue;
        private int _popupInjectBusy = 0;

        // === License/Trial run state ===

        private System.Threading.Timer? _expireTimer;      // timer tick mỗi giây để cập nhật đếm ngược
        private DateTimeOffset? _runExpiresAt;             // mốc hết hạn của phiên đang chạy (trial hoặc license)
        private string _expireMode = "";                   // "trial" | "license"
        private string _leaseClientId = "";
        private string _deviceId = "";
        private string _trialKey = "";
        private string _trialDayStamp = "";

        private string _leaseSessionId = "";
        private string _licenseUser = "";
        private string _licensePass = "";
        public string TrialUntil { get; set; } = "";
        // === License periodic re-check (5 phút/lần) ===
        private System.Threading.Timer? _licenseCheckTimer;
        private int _licenseCheckBusy = 0; // guard chống chồng lệnh
        private bool _licenseVerified = false;
        // === Username lấy từ Home (authoritative) ===
        private string? _homeUsername;                 // username chuẩn lấy từ home_tick
        private DateTime _homeUsernameAt = DateTime.MinValue; // mốc thời gian bắt được
        private bool _homeLoggedIn = false; // chỉ true khi phát hiện có nút Đăng xuất (đã login)
        private bool _navModeHooked = false;   // đã gắn handler NavigationCompleted để cập nhật UI nhanh về Home?

        private sealed class NetworkWinnerPacket
        {
            public long TableId { get; set; }
            public long GameShoe { get; set; }
            public long GameRound { get; set; }
            public int WinnerCode { get; set; } = -1;
            public int BankerValue { get; set; } = -1;
            public int PlayerValue { get; set; } = -1;
            public string EventType { get; set; } = "";
            public string OwnerTag { get; set; } = "";
            public string Url { get; set; } = "";
        }

        private sealed class NetworkSeqApplyResult
        {
            public bool Changed { get; set; }
            public bool Appended { get; set; }
            public bool Replaced { get; set; }
            public bool HadGap { get; set; }
            public string PrevSeq { get; set; } = "";
            public string NextSeq { get; set; } = "";
            public long PrevVersion { get; set; }
            public long NextVersion { get; set; }
            public string SeqEvent { get; set; } = "";
            public string ResultText { get; set; } = "";
            public char ResultChar { get; set; }
            public long GameRound { get; set; }
            public long GameShoe { get; set; }
            public long TableId { get; set; }
            public string Action { get; set; } = "";
        }

        private sealed class HallRoundSnapshot
        {
            public long TableId { get; set; }
            public long GameShoe { get; set; }
            public long GameRound { get; set; }
            public DateTime SeenAtUtc { get; set; }
        }

        private sealed class TickUiPayload
        {
            public double? Prog { get; set; }
            public string StatusUi { get; set; } = "";
            public string Seq { get; set; } = "";
            public long SeqVersion { get; set; }
            public string SeqEvent { get; set; } = "";
            public string Source { get; set; } = "";
            public double? Amount { get; set; }
            public string UserName { get; set; } = "";
        }


        private int _playStartInProgress = 0;// Ngăn PlayXocDia_Click chạy song song
        private int _vaoStartInProgress = 0; // Ngăn VaoXocDia_Click chạy song song
        private long _taskRunSeq = 0;
        private DateTime _betWebNavigatingSinceUtc = DateTime.MinValue;
        private DateTime _betWebLastNavDoneUtc = DateTime.MinValue;
        private DateTime _lastAutoStopByNavUtc = DateTime.MinValue;

        private readonly SemaphoreSlim _cfgWriteGate = new(1, 1);// Khoá ghi config để không bao giờ ghi song song
        private readonly SemaphoreSlim _statsWriteGate = new(1, 1);
        private readonly ConcurrentDictionary<string, long> _logThrottleLastMs = new();
                                                                 // --- UI mode monitor ---
        private DateTime _lastGameTickUtc = DateTime.MinValue;
        private DateTime _lastHomeTickUtc = DateTime.MinValue;
        private DateTime _lastTickDiagLogUtc = DateTime.MinValue;
        private DateTime _lastGameHintDiagLogUtc = DateTime.MinValue;
        private readonly object _tickUiStateLock = new();
        private DateTime _lastTickUiDispatchUtc = DateTime.MinValue;
        private int _lastTickUiProgRounded = int.MinValue;
        private string _lastTickUiStatus = "";
        private string _lastTickUiSeqSig = "";
        private string _lastSeqUiQueueLogKey = "";
        private string _lastSeqUiApplyLogKey = "";
        private string _lastSeqUiRenderLogKey = "";
        private readonly object _tickUiQueueLock = new();
        private TickUiPayload? _pendingTickUiPayload;
        private int _tickUiDispatchQueued = 0;
        private readonly object _tickIngressGateLock = new();
        private DateTime _lastPopupFrameTickIngressUtc = DateTime.MinValue;
        private DateTime _lastPopupPullTickIngressUtc = DateTime.MinValue;
        private DateTime _lastMainFrameTickIngressUtc = DateTime.MinValue;
        private int _tickIngressDropCount = 0;
        private DateTime _lastTickIngressDropLogUtc = DateTime.MinValue;
        private DateTime _lastGameHintUiApplyUtc = DateTime.MinValue;
        private readonly object _cdpAutoFallbackLock = new();
        private long _cdpAutoFallbackLastWsRecv = 0;
        private DateTime _cdpAutoFallbackLastCheckUtc = DateTime.MinValue;
        private DateTime _cdpAutoFallbackLastFireUtc = DateTime.MinValue;
        private bool _isGameUi = false;              // trạng thái UI hiện hành
        private System.Windows.Threading.DispatcherTimer? _uiModeTimer;
        private int _gameNavWatchdogGen = 0;         // phân thế hệ cho watchdog navigation
        private bool _wv2Resetting = false;
        private DateTime _lastWv2ResetUtc = DateTime.MinValue;
        private string? _lastGameUrl = null;

        private static readonly TimeSpan GameTickFresh = TimeSpan.FromSeconds(3);
        private static readonly TimeSpan HomeTickFresh = TimeSpan.FromSeconds(1.5);
        private static readonly TimeSpan UiCountdownHoldFresh = TimeSpan.FromMilliseconds(1500);
        private static readonly TimeSpan UiCountdownHoldFreshPopupPull = TimeSpan.FromSeconds(8);
        private static readonly TimeSpan TickUiMinDispatchGap = TimeSpan.FromMilliseconds(180);
        private static readonly TimeSpan PopupFrameTickIngressMinGap = TimeSpan.FromMilliseconds(95);
        private static readonly TimeSpan PopupPullTickIngressMinGap = TimeSpan.FromMilliseconds(320);
        private static readonly TimeSpan MainFrameTickIngressMinGap = TimeSpan.FromMilliseconds(80);
        private static readonly TimeSpan GameHintUiMinGap = TimeSpan.FromMilliseconds(400);
        private static readonly TimeSpan CdpAutoFallbackMinWindow = TimeSpan.FromSeconds(20);
        private static readonly TimeSpan CdpAutoFallbackMaxWindow = TimeSpan.FromSeconds(45);
        private static readonly TimeSpan CdpAutoFallbackCooldown = TimeSpan.FromMinutes(2);
        private const int CdpAutoFallbackMinDeltaWs = 600;
        private const double CdpAutoFallbackMinRatePerSec = 16.0;
        // Master switch: đặt false để bỏ qua kiểm tra Trial/License (không UI, không config, true kiểm tra bình thường)
        private bool CheckLicense = true;

        // 2) Bộ nhớ và phân trang
        private readonly List<BetRow> _betAll = new();                  // tất cả bản ghi (tối đa 1000 khi load)
        private readonly ObservableCollection<BetRow> _betPage = new(); // trang hiện tại
        private int _pageIndex = 0;
        private int PageSize = 10;// Cho phép đổi PageSize từ UI
        private bool _autoFollowNewest = true;// true = đang bám trang mới nhất (trang 1); false = đang xem trang cũ, KHÔNG auto nhảy

        // 3) Giữ pending bet để chờ kết quả
        private readonly List<BetRow> _pendingRows = new();
        private const int MaxHistory = 1000;   // tổng số bản ghi giữ trong bộ nhớ & khi load



        private const string DEFAULT_URL = "https://play.rikvip.info/"; // URL mặc định bạn muốn
        // === License repo/worker settings (CHỈNH LẠI CHO PHÙ HỢP) ===
        const string LicenseOwner = "ngomantri1";    // <- đổi theo repo của bạn
        const string LicenseRepo = "licenses";  // <- đổi theo repo của bạn
        const string LicenseBranch = "main";          // <- nhánh
        const string LicenseNameGame = "auto";          // <- nhánh
        const string LeaseBaseUrl = "https://net88.ngomantri1.workers.dev/lease/auto";
        private const bool EnableLeaseCloudflare = true; // true=bật gọi Cloudflare
        private const string TrialConsumedTodayMessage = "Hết lượt dùng thử trong ngày. Hãy quay lại dùng thử vào ngày mai.";

        // ===================== TOOLTIP TEXTS =====================
        const string TIP_SEQ_CL =
        @"Chuỗi CẦU (B/P) — Chiến lược 1
• Ý nghĩa: B = BANKER, P = PLAYER (không phân biệt hoa/thường).
• Cú pháp: chỉ gồm ký tự B hoặc P; ký tự khác không hợp lệ.
• Khoảng trắng/tab/xuống dòng: được phép; hệ thống tự bỏ qua.
• Thứ tự đọc: từ trái sang phải; hết chuỗi sẽ lặp lại từ đầu.
• Độ dài khuyến nghị: 2–50 ký tự.
Ví dụ hợp lệ:
  - BPPB
  - B P P B
Ví dụ không hợp lệ:
  - B,X,P     (có dấu phẩy)
  - BP1B      (có số)
  - B P _ B   (ký tự ngoài B/P).";

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
        @"Thế CẦU (B/P) — Chiến lược 2
• Ý nghĩa: B = BANKER, P = PLAYER (không phân biệt hoa/thường).
• Một quy tắc (mỗi dòng): <mẫu_quá_khứ> -> <cửa_kế_tiếp>  (hoặc dùng dấu - thay cho ->).
• Phân tách nhiều quy tắc: bằng dấu ',', ';', '|', hoặc xuống dòng.
• Khoảng trắng: được phép quanh ký hiệu và giữa các quy tắc; 
  Cho phép khoảng trắng BÊN TRONG <cửa_kế_tiếp>.
• So khớp: xét K kết quả gần nhất với K = độ dài <mẫu_quá_khứ>; nếu khớp thì đặt theo <cửa_kế_tiếp>.
• <cửa_kế_tiếp>: có thể là 1 ký tự (B/P) hoặc một chuỗi B/P (ví dụ: BPP).
• Độ dài khuyến nghị cho <mẫu_quá_khứ>: 1–10 ký tự.
Ví dụ hợp lệ:
  BBP -> B
  PPP -> P B
  BP  -> BPP
Ví dụ không hợp lệ:
  B, X, P -> B
  BP -> B P
  BP -> B1";


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

        const string TIP_SIDE_RATIO =
        @"CỬA ĐẶT & TỈ LỆ
- Logic nhiều cửa đã bị loại bỏ khỏi BaccaratViVoGaming.
- Trường này chỉ còn để tương thích cấu hình cũ và hiện không dùng trong Baccarat.";
        // =========================================================





        // ====== CONFIG ======
        private record RootConfig
        {
            public List<AppConfig> Tabs { get; set; } = new();
            public string SelectedTabId { get; set; } = "";
        }

        private record AppConfig
        {
            public string TabId { get; set; } = Guid.NewGuid().ToString("N");
            public string TabName { get; set; } = "";
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
            public string TrialSessionKey { get; set; } = "";
            public int BetStrategyIndex { get; set; } = 4; // mặc định "5. Theo cầu trước thông minh"
            public string BetSeq { get; set; } = "";       // giá trị ô "CHUỖI CẦU"
            public string BetPatterns { get; set; } = "";  // giá trị ô "CÁC THẾ CẦU"
            public string MoneyStrategy { get; set; } = "IncreaseWhenLose";//IncreaseWhenLose
            public bool S7ResetOnProfit { get; set; } = true;
            public double CutProfit { get; set; } = 0; // 0 = tắt cắt lãi
            public double CutLoss { get; set; } = 0; // 0 = tắt cắt lỗ
            public string BetSeqBP { get; set; } = "";        // cho Chiến lược 1
            public string BetSeqNI { get; set; } = "";        // cho Chiến lược 3
            public string BetPatternsBP { get; set; } = "";   // cho Chiến lược 2
            public string BetPatternsNI { get; set; } = "";   // cho Chiến lược 4
            public string SideRateText { get; set; } = "";

            // Lưu chuỗi tiền theo từng MoneyStrategy
            public Dictionary<string, string> StakeCsvByMoney { get; set; } = new();

            /// <summary>Đường dẫn file lưu trạng thái AI n-gram (JSON). Bỏ trống => dùng mặc định %LOCALAPPDATA%\Automino\ai\ngram_state_v1.json</summary>
            public string AiNGramStatePath { get; set; } = "";

            // Runtime profile
            // Performance: ưu tiên mượt, giảm debug/tap.
            // Debug: bật đầy đủ tap/log để chẩn đoán.
            public string RuntimeProfile { get; set; } = "Performance";
            public int PushIntervalMs { get; set; } = 360;
            public bool EnablePerfTimingLog { get; set; } = true;




        }

        private record StatsRoot
        {
            public List<StatsItem> Tabs { get; set; } = new();
        }

        private record StatsItem
        {
            public string TabId { get; set; } = "";
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

        private sealed class StrategyTabState : INotifyPropertyChanged
        {
            private string _name;
            private bool _isRunning;
            private bool _isEditing;

            public StrategyTabState(AppConfig config)
            {
                Config = config;
                _name = string.IsNullOrWhiteSpace(config.TabName) ? "" : config.TabName.Trim();
            }

            public AppConfig Config { get; }
            public string Id => Config.TabId;

            public string Name
            {
                get => _name;
                set
                {
                    if (_name == value) return;
                    _name = value;
                    Config.TabName = value;
                    OnPropertyChanged(nameof(Name));
                }
            }

            public bool IsRunning
            {
                get => _isRunning;
                set
                {
                    if (_isRunning == value) return;
                    _isRunning = value;
                    OnPropertyChanged(nameof(IsRunning));
                }
            }

            public bool IsEditing
            {
                get => _isEditing;
                set
                {
                    if (_isEditing == value) return;
                    _isEditing = value;
                    OnPropertyChanged(nameof(IsEditing));
                }
            }

            public string EditBackupName { get; set; } = "";

            public double WinTotal { get; set; } = 0;
            public string LastSide { get; set; } = "";
            public bool? LastWinLoss { get; set; }
            public string? LastWinLossText { get; set; } = null;
            public long? LastStakeAmount { get; set; }
            public string LastLevelText { get; set; } = "";
            public long[] RunStakeSeq { get; set; } = Array.Empty<long>();
            public List<long[]> RunStakeChains { get; set; } = new();
            public long[] RunStakeChainTotals { get; set; } = Array.Empty<long>();
            public double RunDecisionPercent { get; set; } = 0;
            public long RunId { get; set; } = 0;
            public bool CutStopTriggered { get; set; } = false;

            public CancellationTokenSource? TaskCts { get; set; }
            public Task? RunningTask { get; set; }
            public BaccaratViVoGaming.Tasks.IBetTask? ActiveTask { get; set; }
            public DecisionState DecisionState { get; set; } = new DecisionState();
            public bool Cooldown { get; set; } = false;
            public TabStats Stats { get; set; } = new TabStats();

            public event PropertyChangedEventHandler? PropertyChanged;
            private void OnPropertyChanged(string name) => PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
        }

        // 1) Model 1 dòng log đặt cược
        private sealed class BetRow
        {
            public DateTime At { get; set; }                 // Thời gian đặt
            public string Game { get; set; } = "Xóc đĩa live";
            public long Stake { get; set; }                  // Tiền cược
            public string Side { get; set; } = "";           // BANKER/PLAYER
            public string Result { get; set; } = "";         // Kết quả "CHAN"/"LE"
            public string WinLose { get; set; } = "";        // "Thắng"/"Thua"
            public double Account { get; set; }              // Số dư sau ván
            public string IssuedSeqDisplay { get; set; } = "";
            public string IssuedSeqCalc { get; set; } = "";
            public long? IssuedSeqVersion { get; set; }
            public string IssuedSeqEvent { get; set; } = "";
            public long IssuedRoundId { get; set; }
            public long IssuedTableId { get; set; }
            public long IssuedGameShoe { get; set; }
            public long IssuedObservedRound { get; set; }
            public string IssuedSeqSource { get; set; } = "";
            public bool SawClosedAfterIssue { get; set; }
        }

        public static class SharedIcons
        {
            public static ImageSource? SideBanker, SidePlayer;        // ảnh “Cửa đặt” CHẴN/LẺ
            public static ImageSource? ResultBanker, ResultPlayer;    // ảnh “Kết quả” CHẴN/LẺ
            public static ImageSource? Win, Loss, Draw;         // ảnh “Thắng/Thua/Hòa”
            public static ImageSource? TuTrang, TuDo, SapDoi, Trang3Do1, Do3Trang1;
        }

        private const int MaxTabs = 5;
        private RootConfig _rootCfg = new();
        private StatsRoot _statsRoot = new();
        private readonly ObservableCollection<StrategyTabState> _strategyTabs = new();
        private StrategyTabState? _activeTab;
        private bool _tabSwitching = false;
        private System.Windows.Threading.DispatcherTimer? _tabHintTimer;
        private Point _tabDragStart;
        private bool _tabDragArmed;
        private AppConfig _cfg = new();

        // ====== LOGGING (mới: batch, không đơ UI) ======
        // UI
        private readonly ConcurrentQueue<string> _uiLogQueue = new();
        private readonly LinkedList<string> _uiLines = new(); // buffer giữ tối đa N dòng
        private const int UI_MAX_LINES = 1000;
        private const int UI_FLUSH_MS = 300;
        private const bool COMPACT_RUNTIME_LOG = true;
        // Perf defaults: giảm tải bridge/network tap trong runtime bình thường.
        private const int CW_PUSH_MS_DEFAULT = 360;
        private const int CW_PUSH_MS_DEBUG_DEFAULT = 240;
        private bool _enableCdpNetworkTap = false;
        private bool _enableCdpObservedContextTap = false;
        private bool _enableHttpResponseBodyTap = false;
        private bool _enableJsFileLog = false;
        private bool _enableJsPushDebug = false;
        private bool _enablePerfTimingLog = true;
        private DateTime _lastPerfTickMsgLogUtc = DateTime.MinValue;
        private int _cwPushMs = CW_PUSH_MS_DEFAULT;
        private DateTime _lastPerfRuntimeLogUtc = DateTime.MinValue;

        // File
        private readonly ConcurrentQueue<string> _fileLogQueue = new();
        private const int FILE_FLUSH_MS = 500;
        private readonly ConcurrentQueue<string> _jsFileLogQueue = new();
        private const long JS_FILE_MAX_BYTES = 20L * 1024L * 1024L; // 20MB
        private const int JS_FILE_KEEP_ROTATED = 5;

        // Pump
        private CancellationTokenSource? _logPumpCts;

        // Packet lines -> UI? (mặc định: không)
        private const bool SHOW_PACKET_LINES_IN_UI = false;
        private const int PACKET_UI_SAMPLE_EVERY_N = 20; // nếu bật ở trên, mỗi N gói mới đẩy 1 dòng lên UI
        private int _pktUiSample = 0;
        private bool _lockJsRegistered = false;
        // Map ảnh cho từng ký tự
        private readonly Dictionary<char, ImageSource> _seqIconMap = new();

        private string _lastSeqTailShown = "";
        private string _lastResultUiToken = "";
        // Tổng tiền thắng lũy kế của phiên hiện tại
        private double _winTotal = 0;
        private CoreWebView2Environment? _webEnv;
        private bool _webInitDone;
        private bool _popupWebHooked;
        private bool _popupWebMsgHooked;
        private bool _popupBridgeRegistered;
        private bool _popupDevToolsOpened;
        private string? _popupLastDocKey;
        private WebView2? _popupWeb;
        private int _popupTickPullBusy = 0;
        private DateTime _lastPopupTickPullUtc = DateTime.MinValue;
        private readonly object _playerFlowCacheLock = new();
        private string _lastPlayerFlowGameUrl = "";
        private DateTime _lastPlayerFlowGameAtUtc = DateTime.MinValue;
        private string _lastPlayerFlowSourceHost = "";
        private const string Wv2ZipResNameX64 = "BaccaratViVoGaming.ThirdParty.WebView2Fixed_win-x64.zip";
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
    function __abxCanStartInWindow(w){
      try{
        if (!w) return false;
        if (w.__abx_force_push_start === 1 || w.__abx_force_push_start === true) return true;
        var href = String((w.location && w.location.href) || '');
        if (/singleBacTable\.jsp/i.test(href)) return true;
        if (/\/player\/webMain\.jsp/i.test(href)) return true;
        if (/\/player\/gamehall\.jsp/i.test(href)) return true;
        if (/\/player\/login\/apiLogin/i.test(href)) return true;
        if (/\/\/(?:[^\/]+\.)?vivogaming\.com\//i.test(href) &&
            (/\/activations\/baccarat(?:\/|\?|$)/i.test(href) ||
             (/(?:^|[?&])selectedgame=baccarat(?:[&#]|$)/i.test(href) &&
              !/(?:^|[?&])application=lobby(?:[&#]|$)/i.test(href)))) return true;
        if (typeof w.__cw_isGamePopupPage === 'function'){
          try{ if (w.__cw_isGamePopupPage()) return true; }catch(_){}
        }
        if (typeof w.__cw_hasCocos === 'function'){
          try{ if (w.__cw_hasCocos()) return true; }catch(_){}
        }
      }catch(_){}
      return false;
    }
    function __abxPushMs(){
      var ms = Number(window.__abx_push_ms || 360);
      if (!(ms >= 180 && ms <= 1000)) ms = 360;
      return ms;
    }
    var delay=300, tries=0;
    (function tick(){
      try{
        if (window.__cw_startPush && __abxCanStartInWindow(window)){
          try{ window.__cw_startPush(__abxPushMs()); }catch(_){}
          return;
        }
      }catch(_){}
      tries++; delay = Math.min(5000, delay + (tries<10?100:500));
      setTimeout(tick, delay);
    })();
  }catch(_){}
})();";

        private const string START_PUSH_NOW = @"
  try{
    function __abxCanStartInWindow(w){
      try{
        if (!w) return false;
        if (w.__abx_force_push_start === 1 || w.__abx_force_push_start === true) return true;
        var href = String((w.location && w.location.href) || '');
        if (/singleBacTable\.jsp/i.test(href)) return true;
        if (/\/player\/webMain\.jsp/i.test(href)) return true;
        if (/\/player\/gamehall\.jsp/i.test(href)) return true;
        if (/\/player\/login\/apiLogin/i.test(href)) return true;
        if (/\/\/(?:[^\/]+\.)?vivogaming\.com\//i.test(href) &&
            (/\/activations\/baccarat(?:\/|\?|$)/i.test(href) ||
             (/(?:^|[?&])selectedgame=baccarat(?:[&#]|$)/i.test(href) &&
              !/(?:^|[?&])application=lobby(?:[&#]|$)/i.test(href)))) return true;
        if (typeof w.__cw_isGamePopupPage === 'function'){
          try{ if (w.__cw_isGamePopupPage()) return true; }catch(_){}
        }
        if (typeof w.__cw_hasCocos === 'function'){
          try{ if (w.__cw_hasCocos()) return true; }catch(_){}
        }
      }catch(_){}
      return false;
    }
    function __abxPushMs(){
      var ms = Number(window.__abx_push_ms || 360);
      if (!(ms >= 180 && ms <= 1000)) ms = 360;
      return ms;
    }
  try{
      if (window.__cw_startPush && __abxCanStartInWindow(window)){
        window.__cw_startPush(__abxPushMs());
    }
  }catch(_){}
  try{
    for (var i=0;i<window.frames.length;i++){
      try{
        var w = window.frames[i];
        if (w && w.__cw_startPush && __abxCanStartInWindow(w)){
          w.__cw_startPush(__abxPushMs());
        }
      }catch(_){}
    }
  }catch(_){}
}catch(_){}";

        private const string POPUP_TOP_AUTOSTART_SINGLE_BAC = @"
(function(){
  try{
    var key = String((performance && performance.timeOrigin) || Date.now());
    if (window.__cw_popup_autostart_key === key) return;
    window.__cw_popup_autostart_key = key;
    function __abxPushMs(){
      var ms = Number(window.__abx_push_ms || 360);
      if (!(ms >= 180 && ms <= 1000)) ms = 360;
      return ms;
    }
    var delay=250, tries=0;
    (function tick(){
      try{
        for (var i=0;i<window.frames.length;i++){
          try{
            var w = window.frames[i];
            var href = String((w.location && w.location.href) || '');
            if ((/singleBacTable\.jsp/i.test(href) ||
                 /\/player\/webMain\.jsp/i.test(href) ||
                 /\/player\/gamehall\.jsp/i.test(href) ||
                 /\/player\/login\/apiLogin/i.test(href) ||
                 (/\/\/(?:[^\/]+\.)?vivogaming\.com\//i.test(href) &&
                  (/\/activations\/baccarat(?:\/|\?|$)/i.test(href) ||
                   (/(?:^|[?&])selectedgame=baccarat(?:[&#]|$)/i.test(href) &&
                    !/(?:^|[?&])application=lobby(?:[&#]|$)/i.test(href))))) &&
                w.__cw_startPush){
              try{ w.__cw_startPush(__abxPushMs()); }catch(_){}
              return;
            }
          }catch(_){}
        }
      }catch(_){}
      tries++; delay = Math.min(5000, delay + (tries<10?100:500));
      setTimeout(tick, delay);
    })();
  }catch(_){}
})();";

        private const string POPUP_TOP_START_PUSH_SINGLE_BAC = @"
try{
  function __abxPushMs(){
    var ms = Number(window.__abx_push_ms || 360);
    if (!(ms >= 180 && ms <= 1000)) ms = 360;
    return ms;
  }
  try{
    for (var i=0;i<window.frames.length;i++){
      try{
        var w = window.frames[i];
        var href = String((w.location && w.location.href) || '');
        if ((/singleBacTable\.jsp/i.test(href) ||
             /\/player\/webMain\.jsp/i.test(href) ||
             /\/player\/gamehall\.jsp/i.test(href) ||
             /\/player\/login\/apiLogin/i.test(href) ||
             (/\/\/(?:[^\/]+\.)?vivogaming\.com\//i.test(href) &&
              (/\/activations\/baccarat(?:\/|\?|$)/i.test(href) ||
               (/(?:^|[?&])selectedgame=baccarat(?:[&#]|$)/i.test(href) &&
                !/(?:^|[?&])application=lobby(?:[&#]|$)/i.test(href))))) &&
            w && w.__cw_startPush){
          w.__cw_startPush(__abxPushMs());
        }
      }catch(_){}
    }
  }catch(_){}
}catch(_){}";

        private const string PULL_POPUP_TICK_NOW = @"
  (function(){
    try{
      function isClosed(win, st){
        try{
          if (win && typeof win.__cw_hasCocos === 'function' && !win.__cw_hasCocos() &&
              typeof win.domStatusImpliesClosed === 'function' && win.domStatusImpliesClosed(st))
            return true;
        }catch(_){}
        return false;
      }
      function pullFrom(win, depth){
        try{
          if (!win) return null;
          var snap = null;
          function parseMoney(txt){
            try{
              txt = String(txt || '').trim().toUpperCase();
              if (!txt) return null;
              txt = txt.replace(/[₫$€£¥]/g, '').replace(/\s+/g, '');
              var mul = 1;
              if (/[KMB]$/.test(txt)){
                if (/K$/.test(txt)) mul = 1e3;
                else if (/M$/.test(txt)) mul = 1e6;
                else mul = 1e9;
                txt = txt.slice(0, -1);
              }
              txt = txt.replace(/,/g, '');
              var num = parseFloat(txt);
              if (!isFinite(num)) return null;
              return Math.round(num * mul);
            }catch(_){ return null; }
          }
          function parsePanelFallback(){
            try{
              var doc = win.document;
              if (!doc) return null;
              var info = doc.querySelector('#cwInfo');
              if (!info) return null;
              var text = String(info.innerText || info.textContent || '');
              if (!text) return null;
              var status = '';
              var prog = null;
              var seq = '';
              var user = '';
              var bal = null;
              var banker = null, player = null, tie = null;

              var mStatus = text.match(/Trang thai:\s*(.*?)\s*\|\s*Prog:\s*([0-9]+)(?:s|%)/i);
              if (!mStatus)
                mStatus = text.match(/Tr[^\n:]*:\s*(.*?)\s*\|\s*Prog:\s*([0-9]+)(?:s|%)/i);
              if (mStatus){
                status = String(mStatus[1] || '').trim();
                prog = Number(mStatus[2] || 0);
                if (!isFinite(prog)) prog = null;
              }

              var mHud = text.match(/TAI KHOAN\s*:\s*([^\|\n]+)\|\s*SO DU\s*:\s*([^\n]+)/i);
              if (!mHud)
                mHud = text.match(/T[^\n:]*:\s*([^\|\n]+)\|\s*S[^\n:]*:\s*([^\n]+)/i);
              if (mHud){
                user = String(mHud[1] || '').trim();
                bal = parseMoney(mHud[2]);
              }

              var mTotals = text.match(/BANKER:\s*([0-9]+)\s*\|\s*PLAYER:\s*([0-9]+)\s*\|\s*TIE:\s*([0-9]+)/i);
              if (mTotals){
                banker = Number(mTotals[1] || 0);
                player = Number(mTotals[2] || 0);
                tie = Number(mTotals[3] || 0);
              }

              var seqMatches = text.match(/SEQ:([BPT0-4]+)/ig);
              if (seqMatches && seqMatches.length){
                var rawSeq = seqMatches[seqMatches.length - 1] || '';
                seq = String(rawSeq).replace(/^SEQ:/i, '').trim();
              }
              if (!seq){
                var mSeq = text.match(/Chu[^\n:]*:\s*([BPT0-4]+)/i);
                if (mSeq) seq = String(mSeq[1] || '').trim();
              }

              return {
                abx:'tick',
                prog:prog,
                progSource:String(win.__cw_prog_source || ''),
                progTail:String(win.__cw_prog_tail || ''),
                totals:{
                  B:banker,
                  P:player,
                  T:tie,
                  A:bal,
                  N:user || null
                },
                seq:seq,
                rawSeq:seq,
                username:user,
                status:status,
                statusSource:String(win.__cw_status_source || ''),
                statusTail:String(win.__cw_status_tail || ''),
                ts:Date.now()
              };
            }catch(_){ return null; }
          }
          try{
            if (typeof win.__cw_readSnapshot === 'function')
              snap = win.__cw_readSnapshot();
          }catch(_){}
          try{
            if ((!snap || (!snap.seq && !(snap.totals && snap.totals.A != null) && !snap.prog)) &&
                win.__cw_last_panel_snapshot){
              snap = win.__cw_last_panel_snapshot;
            }
          }catch(_){}
          try{
            if (!snap || (!snap.seq && !(snap.totals && snap.totals.A != null) && !snap.prog && !snap.status)){
              var panelSnap = parsePanelFallback();
              if (panelSnap) snap = panelSnap;
            }
          }catch(_){}
          if (!snap){
            var p = (typeof win.readProgressVal === 'function') ? win.readProgressVal() : null;
            var st = (typeof win.statusByProg === 'function') ? win.statusByProg(p) : '';
            snap = {
              abx:'tick',
              prog:p,
              progSource:String(win.__cw_prog_source || ''),
              progTail:String(win.__cw_prog_tail || ''),
              totals:(typeof win.readTotalsSafe === 'function') ? win.readTotalsSafe() : null,
              seq:(typeof win.readSeqSafe === 'function') ? (win.readSeqSafe() || '') : '',
              rawSeq:String(win.__cw_bead_raw_seq || ''),
              status:String(st || ''),
              statusSource:String(win.__cw_status_source || ''),
              statusTail:String(win.__cw_status_tail || ''),
              ts:Date.now()
            };
          }
          var p = snap ? snap.prog : null;
          var st = snap ? String(snap.status || '') : '';
          var t = snap ? (snap.totals || null) : null;
          var seq = snap ? String(snap.seq || '') : '';
          var rawSeq = snap ? String(snap.rawSeq || '') : '';
          var seqEvent = snap ? String(snap.seqEvent || '') : '';
          var rawFallbackBlocked = /shoe-reset-arm|board-empty|no-board|table-switch-wait-bead/i.test(seqEvent);
          if (!rawSeq && seq && !rawFallbackBlocked) rawSeq = seq;
          var progSource = snap ? String(snap.progSource || win.__cw_prog_source || '') : String(win.__cw_prog_source || '');
          var progTail = snap ? String(snap.progTail || win.__cw_prog_tail || '') : String(win.__cw_prog_tail || '');
          var statusSource = snap ? String(snap.statusSource || win.__cw_status_source || '') : String(win.__cw_status_source || '');
          var statusTail = snap ? String(snap.statusTail || win.__cw_status_tail || '') : String(win.__cw_status_tail || '');
          var uname = '';
          try{
            if (t && t.N != null) uname = String(t.N || '');
          }catch(_){}
          var hasProg = (p != null && isFinite(Number(p)));
          var hasSeq = !!(seq && String(seq).trim());
          var hasHud = !!(uname || (t && t.A != null));
          var hasStatus = !!(st && String(st).trim());
          var href = '';
          try{ href = String((win.location && win.location.href) || ''); }catch(_){}
          var isSingleBac = /singleBacTable\.jsp/i.test(href);
          var isVivoHost = /\/\/(?:[^\/]+\.)?vivogaming\.com\//i.test(href);
          var isVivoBaccarat = isVivoHost &&
            (/\/activations\/baccarat(?:\/|\?|$)/i.test(href) ||
             (/(?:^|[?&])selectedgame=baccarat(?:[&#]|$)/i.test(href) &&
              !/(?:^|[?&])application=lobby(?:[&#]|$)/i.test(href)));
          var isVivoLobby = isVivoHost &&
            (/(?:^|[?&])application=lobby(?:[&#]|$)/i.test(href) ||
             /\/activations\/lobby(?:\/|\?|$)/i.test(href) ||
             /\/lobby(?:\/|\?|$)/i.test(href));
          var progSourceL = String(progSource || '').toLowerCase();
          var hasDomProg = hasProg && (progSourceL.indexOf('dom') >= 0 || progSourceL.indexOf('pseudo') >= 0);
          var score = 0;
          if (hasProg) score += 1000;
          if (hasDomProg) score += 450;
          if (hasStatus) score += 120;
          if (hasSeq) score += 100;
          if (hasHud) score += 10;
          if (isSingleBac) score += 500;
          if (isVivoBaccarat) score += 700;
          if (isVivoLobby) score += 150;
          score += Math.min(40, Math.max(0, Number(depth || 0))) * 2;
          if (!hasProg && isVivoLobby) score -= 100;
          return {
            abx:'tick',
            prog:p,
            progSource:progSource,
            progTail:progTail,
            totals:t,
            seq:seq,
            rawSeq:rawSeq,
            username:uname,
            status:String(st || ''),
            statusSource:statusSource,
            statusTail:statusTail,
            ts:Date.now(),
            __score:score,
            __depth:Number(depth || 0),
            __href:href
          };
        }catch(_){ return null; }
      }

      function walkFrames(win, depth, out){
        try{
          var cand = pullFrom(win, depth);
          if (cand) out.push(cand);
        }catch(_){}
        try{
          if (!win || !win.frames) return;
          for (var i=0;i<win.frames.length;i++){
            try{ walkFrames(win.frames[i], Number(depth || 0) + 1, out); }catch(_){}
          }
        }catch(_){}
      }

      var candidates = [];
      walkFrames(window, 0, candidates);
      var best = null;
      for (var ci=0; ci<candidates.length; ci++){
        var cand = candidates[ci];
        if (!cand) continue;
        if (!best){ best = cand; continue; }
        var candScore = Number(cand.__score || 0);
        var bestScore = Number(best.__score || 0);
        if (candScore > bestScore){ best = cand; continue; }
        if (candScore === bestScore){
          var candHasProg = (cand.prog != null && isFinite(Number(cand.prog)));
          var bestHasProg = (best.prog != null && isFinite(Number(best.prog)));
          if (candHasProg && !bestHasProg){ best = cand; continue; }
          var candDepth = Number(cand.__depth || 0);
          var bestDepth = Number(best.__depth || 0);
          if (candDepth > bestDepth){ best = cand; continue; }
        }
      }
      if (!best) return '';
      try{ delete best.__score; }catch(_){}
      try{ delete best.__depth; }catch(_){}
      try{ delete best.__href; }catch(_){}
      return JSON.stringify(best);
    }catch(_){
      return '';
    }
  })();";

        // Guard chống re-entrancy (đặt ở class level)
        private bool _ensuringWeb = false;

        private bool _frameHookedAlways;

        private bool _inputEventsHooked;
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
            _statsPath = Path.Combine(_appDataDir, "stats.json");



            _leaseSessionId = Guid.NewGuid().ToString("N");
            _logDir = Path.Combine(_appDataDir, "logs");
            Directory.CreateDirectory(_logDir);
            CleanupOldLogs();

            // 2) Sau đó mới dựng UI
            InitializeComponent();
            _strategyTabs.CollectionChanged += StrategyTabs_CollectionChanged;
            this.ShowInTaskbar = true;                       // có icon riêng
            this.WindowStartupLocation = WindowStartupLocation.CenterScreen; // tuỳ, cho đẹp
            // đảm bảo về Home UI lúc khởi động
            SetModeUi(false);
            BetGrid.ItemsSource = _betPage;
            // gọi async sau khi cửa sổ đã load
            this.Loaded += MainWindow_Loaded;

        }



        // ====== Log helpers (batch) ======
        private void EnqueueUi(string line)
        {
            if (string.IsNullOrEmpty(line))
                return;
            if (line.StartsWith("[JS] {\"abx\":\"tick\"", StringComparison.Ordinal))
                return;
            if (line.Length > 512)
                line = line.Substring(0, 512) + "...";
            _uiLogQueue.Enqueue(line);
        }
        private void EnqueueFile(string line)
        {
            _fileLogQueue.Enqueue(line);
        }
        private void EnqueueJsFile(string line)
        {
            if (string.IsNullOrWhiteSpace(line))
                return;
            if (line.Length > 3000)
                line = line.Substring(0, 3000) + "...";
            EnqueueFile(line);
        }
        private string GetJsLogFilePath()
        {
            return Path.Combine(_logDir, $"js-devtools-{DateTime.Today:yyyyMMdd}.log");
        }
        private static void RotateFileIfNeeded(string filePath, long maxBytes, int keepRotated)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(filePath) || maxBytes <= 0 || keepRotated <= 0)
                    return;
                var fi = new FileInfo(filePath);
                if (!fi.Exists || fi.Length < maxBytes)
                    return;

                for (int i = keepRotated; i >= 1; i--)
                {
                    string src = (i == 1) ? filePath : (filePath + "." + (i - 1).ToString(CultureInfo.InvariantCulture));
                    string dst = filePath + "." + i.ToString(CultureInfo.InvariantCulture);
                    try
                    {
                        if (File.Exists(dst))
                            File.Delete(dst);
                    }
                    catch { }
                    try
                    {
                        if (File.Exists(src))
                            File.Move(src, dst);
                    }
                    catch { }
                }
            }
            catch { }
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
                            hadItem = true;
                            _uiLines.AddLast(line);
                            if (_uiLines.Count > UI_MAX_LINES) _uiLines.RemoveFirst();
                        }

                        //if (hadItem && TxtLog != null)
                        //{
                        //    var sb = new StringBuilder(_uiLines.Count * 64);
                        //    foreach (var ln in _uiLines)
                        //    {
                        //        sb.AppendLine(ln);
                        //    }
                        //    var text = sb.ToString();
                        //    await Dispatcher.InvokeAsync(() =>
                        //    {
                        //        try
                        //        {
                        //            TxtLog.Text = text;
                        //            TxtLog.CaretIndex = TxtLog.Text.Length;
                        //            TxtLog.ScrollToEnd();
                        //        }
                        //        catch { }
                        //    });
                        //}
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
                        while (_jsFileLogQueue.TryDequeue(out _)) { }
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

        private bool ShouldSkipNoisyLog(string msg)
        {
            if (string.IsNullOrWhiteSpace(msg))
                return false;

            bool HitThrottle(string key, int ms)
            {
                var now = Environment.TickCount64;
                var last = _logThrottleLastMs.TryGetValue(key, out var v) ? v : 0;
                if ((now - last) < ms) return true;
                _logThrottleLastMs[key] = now;
                return false;
            }

            bool isErrorLike =
                msg.IndexOf("[ERR]", StringComparison.OrdinalIgnoreCase) >= 0 ||
                msg.IndexOf(" err=", StringComparison.OrdinalIgnoreCase) >= 0 ||
                msg.IndexOf(" error", StringComparison.OrdinalIgnoreCase) >= 0 ||
                msg.IndexOf("failed", StringComparison.OrdinalIgnoreCase) >= 0 ||
                msg.IndexOf("exception", StringComparison.OrdinalIgnoreCase) >= 0;

            if (COMPACT_RUNTIME_LOG && !isErrorLike)
            {
                if (msg.StartsWith("[BridgeProbe]", StringComparison.Ordinal) ||
                    msg.StartsWith("[BridgeProbe][Frame]", StringComparison.Ordinal) ||
                    msg.StartsWith("[HostLaunchProbe]", StringComparison.Ordinal))
                    return true;

                if (msg.StartsWith("[TickDiag]", StringComparison.Ordinal))
                    return HitThrottle("TICK_DIAG", 10000);

                if (msg.StartsWith("[SEQ][RX]", StringComparison.Ordinal))
                    return HitThrottle("SEQ_RX", 4000);

                if (msg.StartsWith("[NETSEQ][RESYNC]", StringComparison.Ordinal) ||
                    msg.StartsWith("[NETSEQ][JS-AHEAD]", StringComparison.Ordinal) ||
                    msg.StartsWith("[NETSEQ][SNAP-OVERRIDE]", StringComparison.Ordinal) ||
                    msg.StartsWith("[NETSEQ][BOOT]", StringComparison.Ordinal) ||
                    msg.StartsWith("[NETSEQ][JS-STALE]", StringComparison.Ordinal) ||
                    msg.StartsWith("[NETSEQ][RAW-AUTHORITY]", StringComparison.Ordinal) ||
                    msg.StartsWith("[NETSEQ][CONTRACT-HOLD]", StringComparison.Ordinal) ||
                    msg.StartsWith("[NETSEQ][SHOE-HOLD-NO-DELTA]", StringComparison.Ordinal) ||
                    msg.StartsWith("[NETSEQ][AUTH-SKIP-OLD-TABLE]", StringComparison.Ordinal))
                    return HitThrottle("NETSEQ_NOISY", 8000);
            }

            // Confirm diag: giữ lại after_click, bỏ ready/before để giảm spam.
            if (msg.StartsWith("[DIAG][CONFIRM]", StringComparison.Ordinal))
            {
                if (msg.Contains("stage=ready", StringComparison.Ordinal) ||
                    msg.Contains("stage=before_click", StringComparison.Ordinal))
                    return true;
            }

            if (msg.StartsWith("[SEQ][UNLOCK][HOLD]", StringComparison.Ordinal))
                return COMPACT_RUNTIME_LOG ? true : HitThrottle("SEQ_UNL_HOLD", 1200);
            if (msg.StartsWith("[SEQ][UNLOCK] ", StringComparison.Ordinal))
                return HitThrottle("SEQ_UNL", COMPACT_RUNTIME_LOG ? 3000 : 700);
            if (msg.StartsWith("[SEQ][GATE] ", StringComparison.Ordinal))
                return HitThrottle("SEQ_GATE", COMPACT_RUNTIME_LOG ? 2500 : 700);
            if (msg.StartsWith("[BET][HIST][CHECK][ROW]", StringComparison.Ordinal))
                return HitThrottle("BET_HIST_ROW", COMPACT_RUNTIME_LOG ? 3000 : 700);

            return false;
        }

        private void Log(string msg)
        {
            if (ShouldSkipNoisyLog(msg))
                return;
            var line = $"[{DateTime.Now:HH:mm:ss}] {msg}";
            EnqueueUi(line);
            EnqueueFile(line);
        }

        private static void CountSeqChars(string? value, out int b, out int p, out int t, out int h, out int other)
        {
            b = p = t = h = other = 0;
            if (string.IsNullOrWhiteSpace(value))
                return;

            foreach (var ch in value)
            {
                char u = char.ToUpperInvariant(ch);
                switch (u)
                {
                    case 'B': b++; break;
                    case 'P': p++; break;
                    case 'T': t++; break;
                    case 'H': h++; break;
                    default:
                        if (!char.IsWhiteSpace(u))
                            other++;
                        break;
                }
            }
        }

        private static string BuildSeqCountText(string? value, bool includeH)
        {
            CountSeqChars(value, out var b, out var p, out var t, out var h, out var other);
            return includeH
                ? $"B:{b},P:{p},T:{t},H:{h},O:{other}"
                : $"B:{b},P:{p},T:{t},O:{other}";
        }

        private void LogSeqRxIfChanged(string seqDisplay, string? rawSeq, long seqVersion, string seqEvent, string? seqMode, string? seqAppend, double progNow, string statusRaw, string source)
        {
            int len = seqDisplay?.Length ?? 0;
            char tail = len > 0 ? seqDisplay![len - 1] : '-';
            int pending = _pendingRows.Count;
            bool lockState = _lockMajorMinorUpdates;
            string evt = string.IsNullOrWhiteSpace(seqEvent) ? "-" : seqEvent;
            int prevLen = _lastSeqRxLen;
            long prevVer = _lastSeqRxVer;
            bool changed =
                len != _lastSeqRxLen ||
                seqVersion != _lastSeqRxVer ||
                !string.Equals(evt, _lastSeqRxEvt, StringComparison.Ordinal) ||
                tail != _lastSeqRxTail ||
                pending != _lastSeqRxPending ||
                lockState != _lastSeqRxLock;
            if (!changed)
                return;

            _lastSeqRxLen = len;
            _lastSeqRxVer = seqVersion;
            _lastSeqRxEvt = evt;
            _lastSeqRxTail = tail;
            _lastSeqRxPending = pending;
            _lastSeqRxLock = lockState;

            var mode = string.IsNullOrWhiteSpace(seqMode) ? "-" : seqMode;
            var append = FilterResultDisplaySeq(seqAppend);
            Log($"[SEQ][RX] prog={progNow:0.###} | seqLen={len} | tail={tail} | seqVer={seqVersion} | seqEvt={evt} | seqMode={mode} | seqAppend={(string.IsNullOrWhiteSpace(append) ? "-" : append)} | baseLen={_baseSeqDisplay.Length} | baseVer={_baseSeqVersion} | lockMajorMinor={(lockState ? 1 : 0)} | pending={pending} | status={statusRaw}");

            bool hasAdvance = (prevVer > 0 && seqVersion > 0)
                ? (seqVersion > prevVer)
                : (len > Math.Max(prevLen, 0));
            if (hasAdvance)
            {
                int rawLen = rawSeq?.Length ?? 0;
                string rawCountText = BuildSeqCountText(rawSeq, includeH: true);
                string seqCountText = BuildSeqCountText(seqDisplay, includeH: false);
                string src = string.IsNullOrWhiteSpace(source) ? "-" : source;
                Log($"[SEQ][COUNT] src={src} | seqLen={len} | seqVer={seqVersion} | seqEvt={evt} | seqMode={mode} | seqAppend={(string.IsNullOrWhiteSpace(append) ? "-" : append)} | rawLen={rawLen} | rawCount={rawCountText} | seqCount={seqCountText}");
            }
        }

        private void SetModeUi(bool isGame)
        {
            try
            {
                void apply()
                {
                    // Nút cũ (đã có sẵn)
                    //if (BtnVaoXocDia != null)
                    //    BtnVaoXocDia.Visibility = isGame ? Visibility.Collapsed : Visibility.Visible;
                    //if (BtnPlay != null)
                    //    BtnPlay.Visibility = isGame ? Visibility.Visible : Visibility.Collapsed;

                    var showPanels = isGame || _licenseVerified;

                    if (GroupLoginNav != null)
                        GroupLoginNav.Visibility = showPanels ? Visibility.Collapsed : Visibility.Visible;

                    if (GroupStrategyTabs != null)
                        GroupStrategyTabs.Visibility = showPanels ? Visibility.Visible : Visibility.Collapsed;

                    if (GroupStrategyMoney != null)
                        GroupStrategyMoney.Visibility = showPanels ? Visibility.Visible : Visibility.Collapsed;

                    if (GroupStatus != null)
                        GroupStatus.Visibility = showPanels ? Visibility.Visible : Visibility.Collapsed;

                    if (GroupStats != null)
                        GroupStats.Visibility = showPanels ? Visibility.Visible : Visibility.Collapsed;

                    if (GroupConsole != null)
                        GroupConsole.Visibility = showPanels ? Visibility.Visible : Visibility.Collapsed;
                }

                if (Dispatcher.CheckAccess())
                    apply();
                else
                    Dispatcher.Invoke(apply);
            }
            catch { }
        }

        private void SetLicenseUi(bool verified)
        {
            _licenseVerified = verified;
            SetModeUi(_isGameUi);
        }
        

        private string GetAiNGramStatePath()
        {
            // _appDataDir bạn đã tạo ở Startup: %LOCALAPPDATA%\BaccaratViVoGaming
            var aiDir = System.IO.Path.Combine(_appDataDir, "ai");
            System.IO.Directory.CreateDirectory(aiDir);
            return System.IO.Path.Combine(aiDir, "ngram_state_v1.json");
        }

        private bool GetIsGameByUrlFallback()
        {
            try
            {
                var src = Web?.Source?.ToString() ?? "";
                if (string.IsNullOrWhiteSpace(src)) return _isGameUi;
                var host = new Uri(src).Host;
                // games.* => đang ở trang game
                return host.StartsWith("games.", StringComparison.OrdinalIgnoreCase);
            }
            catch { return _isGameUi; }
        }

        private void RecomputeUiMode()
        {
            // Ưu tiên URL: nếu KHÔNG ở games.* thì về Home ngay để tránh timer lôi về GAME
            if (!GetIsGameByUrlFallback())
            {
                ApplyUiMode(false);
                return;
            }

            var now = DateTime.UtcNow;
            var recentGame = (now - _lastGameTickUtc) <= GameTickFresh;
            var recentHome = (now - _lastHomeTickUtc) <= HomeTickFresh;

            bool nextIsGame;
            if (recentGame && !recentHome) nextIsGame = true;
            else if (!recentGame && recentHome) nextIsGame = false;
            else if (recentGame && recentHome) nextIsGame = true;   // giữ logic cũ
            else nextIsGame = GetIsGameByUrlFallback();

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
            if (TxtSideRatio != null) TxtSideRatio.IsReadOnly = !enabled;   // Cửa đặt & tỷ lệ (chiến lược 17)
            if (BtnResetSideRatio != null) BtnResetSideRatio.IsEnabled = enabled;

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
            // so sánh trạng thái cũ/mới
            bool wasGame = _isGameUi;
            _isGameUi = isGame;

            // Chỉ đổi layout nút khi chế độ thật sự đổi
            if (isGame != wasGame)
            {
                SetModeUi(isGame); // ẩn/hiện BtnVaoXocDia vs BtnPlay (HÀM CŨ)
                Log($"SetModeUi(isGame); " + isGame);
            }

            // DÙ mode không đổi, khi đang ở Home vẫn cần cập nhật nhãn theo username
            if (!isGame && BtnVaoXocDia != null)
            {
                var desired = "Đăng Nhập Tool";
                // tránh set lại nếu không thay đổi gì
                if (!Equals(BtnVaoXocDia.Content as string, desired))
                    BtnVaoXocDia.Content = desired;
            }
        }




        // ====== Helpers ======
        private static string T(TextBox tb, string def = "") => (tb?.Text ?? def).Trim();
        private static string P(PasswordBox? pb, string def = "") => pb?.Password ?? def;
        private static int I(string? s, int def = 0) => int.TryParse(s, out var n) ? n : def;
        private static double ClampDecisionPercent(double value)
        {
            if (!double.IsFinite(value)) return 10;
            return Math.Clamp(value, 1, 100);
        }
        private void SyncDecisionPercentFromConfig(AppConfig? cfg)
        {
            var raw = cfg?.DecisionSeconds ?? 10;
            var pct = ClampDecisionPercent(raw);
            _decisionPercent = pct;
            var pctInt = (int)Math.Round(pct, MidpointRounding.AwayFromZero);
            if (cfg != null) cfg.DecisionSeconds = pctInt;
        }
        private void SyncDecisionPercentFromUi()
        {
            var fallback = _cfg?.DecisionSeconds ?? 10;
            var raw = I(T(TxtDecisionSecond, fallback.ToString(CultureInfo.InvariantCulture)), fallback);
            var pct = ClampDecisionPercent(raw);
            var pctInt = (int)Math.Round(pct, MidpointRounding.AwayFromZero);
            _decisionPercent = pct;
            if (_cfg != null) _cfg.DecisionSeconds = pctInt;
            if (TxtDecisionSecond != null)
            {
                var txt = pctInt.ToString(CultureInfo.InvariantCulture);
                if (!string.Equals(TxtDecisionSecond.Text?.Trim(), txt, StringComparison.Ordinal))
                    TxtDecisionSecond.Text = txt;
            }
        }

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
                    _rootCfg = JsonSerializer.Deserialize<RootConfig>(json) ?? new RootConfig();
                    if (_rootCfg.Tabs == null || _rootCfg.Tabs.Count == 0)
                    {
                        var legacy = JsonSerializer.Deserialize<AppConfig>(json) ?? new AppConfig();
                        _rootCfg = new RootConfig
                        {
                            Tabs = new List<AppConfig> { legacy },
                            SelectedTabId = legacy.TabId
                        };
                    }
                    Log("Loaded config: " + _cfgPath);
                }

                if (_rootCfg.Tabs == null) _rootCfg.Tabs = new List<AppConfig>();
                if (_rootCfg.Tabs.Count == 0)
                    _rootCfg.Tabs.Add(CreateDefaultTab(1));

                if (_rootCfg.Tabs.Count > MaxTabs)
                    _rootCfg.Tabs = _rootCfg.Tabs.Take(MaxTabs).ToList();

                _strategyTabs.Clear();
                for (int i = 0; i < _rootCfg.Tabs.Count; i++)
                {
                    var tabCfg = _rootCfg.Tabs[i] ?? new AppConfig();
                    if (string.IsNullOrWhiteSpace(tabCfg.TabId))
                        tabCfg.TabId = Guid.NewGuid().ToString("N");
                    tabCfg.TabName = FixBrokenTabName(tabCfg.TabName, i + 1);
                    var tab = new StrategyTabState(tabCfg) { Name = tabCfg.TabName };
                    _strategyTabs.Add(tab);
                }

                _activeTab = _strategyTabs.FirstOrDefault(t => t.Id == _rootCfg.SelectedTabId)
                             ?? _strategyTabs.FirstOrDefault();
                if (_activeTab == null)
                {
                    var fallback = CreateDefaultTab(1);
                    var tab = new StrategyTabState(fallback) { Name = fallback.TabName };
                    _strategyTabs.Add(tab);
                    _activeTab = tab;
                }

                _cfg = _activeTab.Config;
                _rootCfg.SelectedTabId = _activeTab.Id;
                SyncGlobalFieldsFromActive();
                SyncDecisionPercentFromConfig(_cfg);
                ApplyRuntimeProfileFromConfig(log: true);

                if (StrategyTabList != null)
                {
                    _tabSwitching = true;
                    StrategyTabList.ItemsSource = _strategyTabs;
                    StrategyTabList.SelectedItem = _activeTab;
                    _tabSwitching = false;
                }
                UpdateAddTabUi();

                LoadStats();

                _homeUsername = _cfg.LastHomeUsername;
                // Sinh / n?p clientId c? ??nh cho lease
                _leaseClientId = string.IsNullOrWhiteSpace(_cfg.LeaseClientId)
                    ? (_cfg.LeaseClientId = Guid.NewGuid().ToString("N"))
                    : _cfg.LeaseClientId;
                EnsureDeviceId();
                EnsureTrialKey();

                if (string.IsNullOrWhiteSpace(_cfg.Url))
                    _cfg.Url = DEFAULT_URL;
                if (TxtUrl != null) TxtUrl.Text = _cfg.Url;

                ApplyGlobalConfigToUi();
                ApplyActiveTabToUi();
            }
            catch (Exception ex)
            {
                Log("[LoadConfig] " + ex);
            }
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
                if (_activeTab != null)
                {
                    ApplyUiToConfig(_activeTab.Config);
                    SyncGlobalFieldsFromActive();
                }

                if (_rootCfg.Tabs == null) _rootCfg.Tabs = new List<AppConfig>();
                _rootCfg.Tabs = _strategyTabs.Select(t => t.Config).ToList();
                _rootCfg.SelectedTabId = _activeTab?.Id ?? "";

                var dir = Path.GetDirectoryName(_cfgPath);
                if (!string.IsNullOrEmpty(dir)) Directory.CreateDirectory(dir);

                var json = JsonSerializer.Serialize(_rootCfg, new JsonSerializerOptions { WriteIndented = true });

                // Ghi an toan: file tam -> move (atomic)
                var tmp = _cfgPath + ".tmp";
                await File.WriteAllTextAsync(tmp, json, Encoding.UTF8);
                File.Move(tmp, _cfgPath, true);

                Log("Saved config");
            }
            catch (Exception ex) { Log("[SaveConfig] " + ex); }
            finally { _cfgWriteGate.Release(); }
        }

        private void SyncStatsRootFromTabs()
        {
            if (_statsRoot.Tabs == null) _statsRoot.Tabs = new List<StatsItem>();
            _statsRoot.Tabs = _strategyTabs
                .Select(t => new StatsItem { TabId = t.Id, Stats = t.Stats ?? new TabStats() })
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

            if (_statsRoot.Tabs == null) _statsRoot.Tabs = new List<StatsItem>();
            var byId = _statsRoot.Tabs
                .Where(t => !string.IsNullOrWhiteSpace(t.TabId))
                .ToDictionary(t => t.TabId, t => t.Stats ?? new TabStats());

            foreach (var tab in _strategyTabs)
            {
                if (byId.TryGetValue(tab.Id, out var stats))
                    tab.Stats = stats;
                else
                    tab.Stats = new TabStats();
            }

            SyncStatsRootFromTabs();
        }

        private async Task SaveStatsAsync()
        {
            if (string.IsNullOrEmpty(_statsPath)) return;

            await _statsWriteGate.WaitAsync();
            try
            {
                SyncStatsRootFromTabs();

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

        private static AppConfig CreateDefaultTab(int index)
        {
            return new AppConfig
            {
                TabId = Guid.NewGuid().ToString("N"),
                TabName = $"Chiến lược {index}",
                RuntimeProfile = "Performance",
                PushIntervalMs = CW_PUSH_MS_DEFAULT,
                EnablePerfTimingLog = true
            };
        }

        private static void CopyGlobalFields(AppConfig src, AppConfig dest)
        {
            dest.Url = src.Url;
            dest.RememberCreds = src.RememberCreds;
            dest.EncUser = src.EncUser;
            dest.EncPass = src.EncPass;
            dest.Username = src.Username;
            dest.LeaseClientId = src.LeaseClientId;
            dest.LastHomeUsername = src.LastHomeUsername;
            dest.TrialUntil = src.TrialUntil;
            dest.TrialSessionKey = src.TrialSessionKey;
            dest.AiNGramStatePath = src.AiNGramStatePath;
            dest.RuntimeProfile = src.RuntimeProfile;
            dest.PushIntervalMs = src.PushIntervalMs;
            dest.EnablePerfTimingLog = src.EnablePerfTimingLog;
        }

        private static string NormalizeRuntimeProfile(string? profile)
        {
            var p = (profile ?? "").Trim().ToLowerInvariant();
            if (p == "debug") return "Debug";
            return "Performance";
        }

        private static int ClampPushIntervalMs(int ms)
        {
            if (ms < 180) ms = 180;
            if (ms > 1000) ms = 1000;
            return ms;
        }

        private bool ShouldAttachCdpNetworkTap()
        {
            return _enableCdpObservedContextTap || _enableCdpNetworkTap;
        }

        private static string FormatDiagAgeSeconds(long ticksUtc, DateTime nowUtc)
        {
            if (ticksUtc <= 0) return "-";
            try
            {
                var ts = nowUtc - new DateTime(ticksUtc, DateTimeKind.Utc);
                if (ts.TotalSeconds < 0) return "0";
                return ((long)ts.TotalSeconds).ToString(CultureInfo.InvariantCulture);
            }
            catch
            {
                return "-";
            }
        }

        private void LogCdpDiagPulse(string reason, bool force = false)
        {
            var nowUtc = DateTime.UtcNow;
            long nowTicks = nowUtc.Ticks;
            long lastPulseTicks = Interlocked.Read(ref _cdpDiagLastPulseTicksUtc);
            if (!force && lastPulseTicks > 0 && (nowTicks - lastPulseTicks) < TimeSpan.FromSeconds(30).Ticks)
                return;
            Interlocked.Exchange(ref _cdpDiagLastPulseTicksUtc, nowTicks);

            long observedTableId;
            long observedGameShoe;
            long observedRound;
            long seqTableId;
            long seqGameShoe;
            long seqRound;
            lock (_roundStateLock)
            {
                observedTableId = _netObservedTableId;
                observedGameShoe = _netObservedGameShoe;
                observedRound = _netObservedGameRound;
                seqTableId = _netSeqTableId;
                seqGameShoe = _netSeqGameShoe;
                seqRound = _netSeqLastRound;
            }

            var ownerCoreMap = _cdpTapOwnerCoreHash.Count == 0
                ? "-"
                : string.Join(",", _cdpTapOwnerCoreHash.Select(kv => $"{kv.Key}:{kv.Value}"));
            var wsRecv = Interlocked.Read(ref _cdpDiagWsRecv);
            MaybeAutoFallbackRuntimeProfileByWsRate(nowUtc, wsRecv);

            Log($"[NETSEQ][CDP-DIAG] reason={reason} | profile={_cfg?.RuntimeProfile ?? "-"} | tap={(ShouldAttachCdpNetworkTap() ? 1 : 0)} | tapDbg={(_enableCdpNetworkTap ? 1 : 0)} | tapCtx={(_enableCdpObservedContextTap ? 1 : 0)} | owners={Shrink(ownerCoreMap, 160)} | wsC={Interlocked.Read(ref _cdpDiagWsCreated)} | wsR={wsRecv} | wsS={Interlocked.Read(ref _cdpDiagWsSent)} | obsPkt={Interlocked.Read(ref _cdpDiagObservedPackets)} | winnerPkt={Interlocked.Read(ref _cdpDiagWinnerPackets)} | obsAgeSec={FormatDiagAgeSeconds(Interlocked.Read(ref _cdpDiagLastObservedTicksUtc), nowUtc)} | winnerAgeSec={FormatDiagAgeSeconds(Interlocked.Read(ref _cdpDiagLastWinnerTicksUtc), nowUtc)} | obsCtx={observedTableId}/{observedGameShoe}/{observedRound} | netCtx={seqTableId}/{seqGameShoe}/{seqRound}");
        }

        private void LogMissingContextDiagnostics(string reason, string side, long amount, long roundId, long issuedTableId, long issuedGameShoe, long issuedObservedRound)
        {
            long count = Interlocked.Increment(ref _cdpDiagMissingContextRows);
            long nowTicks = DateTime.UtcNow.Ticks;
            long lastTicks = Interlocked.Read(ref _cdpDiagLastMissingContextLogTicksUtc);
            bool shouldLog = count <= 3 || (count % 20) == 0 || (lastTicks <= 0) || (nowTicks - lastTicks) >= TimeSpan.FromSeconds(30).Ticks;
            if (!shouldLog)
                return;
            Interlocked.Exchange(ref _cdpDiagLastMissingContextLogTicksUtc, nowTicks);

            long observedTableId;
            long observedGameShoe;
            long observedRound;
            long seqTableId;
            long seqGameShoe;
            long seqRound;
            lock (_roundStateLock)
            {
                observedTableId = _netObservedTableId;
                observedGameShoe = _netObservedGameShoe;
                observedRound = _netObservedGameRound;
                seqTableId = _netSeqTableId;
                seqGameShoe = _netSeqGameShoe;
                seqRound = _netSeqLastRound;
            }

            var nowUtc = new DateTime(nowTicks, DateTimeKind.Utc);
            Log($"[BET][HIST][DIAG] reason={reason} | side={side} | stake={amount:N0} | round={roundId} | issued={issuedTableId}/{issuedGameShoe}/{issuedObservedRound} | observed={observedTableId}/{observedGameShoe}/{observedRound} | net={seqTableId}/{seqGameShoe}/{seqRound} | hallCache={_hallRoundCache.Count} | wsR={Interlocked.Read(ref _cdpDiagWsRecv)} | obsPkt={Interlocked.Read(ref _cdpDiagObservedPackets)} | winnerPkt={Interlocked.Read(ref _cdpDiagWinnerPackets)} | obsAgeSec={FormatDiagAgeSeconds(Interlocked.Read(ref _cdpDiagLastObservedTicksUtc), nowUtc)} | winnerAgeSec={FormatDiagAgeSeconds(Interlocked.Read(ref _cdpDiagLastWinnerTicksUtc), nowUtc)} | count={count}");
            LogCdpDiagPulse("missing-context", force: true);
        }

        private void ApplyRuntimeProfileFromConfig(bool log = false)
        {
            if (_cfg == null) return;

            var profile = NormalizeRuntimeProfile(_cfg.RuntimeProfile);
            _cfg.RuntimeProfile = profile;

            bool isDebug = string.Equals(profile, "Debug", StringComparison.OrdinalIgnoreCase);
            int desiredPush = _cfg.PushIntervalMs > 0
                ? _cfg.PushIntervalMs
                : (isDebug ? CW_PUSH_MS_DEBUG_DEFAULT : CW_PUSH_MS_DEFAULT);
            _cwPushMs = ClampPushIntervalMs(desiredPush);
            _cfg.PushIntervalMs = _cwPushMs;

            _enableCdpNetworkTap = isDebug;
            _enableCdpObservedContextTap = isDebug;
            _enableHttpResponseBodyTap = isDebug;
            _enableJsFileLog = isDebug;
            _enableJsPushDebug = isDebug;
            _enablePerfTimingLog = isDebug || _cfg.EnablePerfTimingLog;

            if (log)
            {
                Log($"[RuntimeProfile] profile={profile} | pushMs={_cwPushMs} | cdp={(ShouldAttachCdpNetworkTap() ? 1 : 0)} | cdpDbg={(_enableCdpNetworkTap ? 1 : 0)} | cdpCtx={(_enableCdpObservedContextTap ? 1 : 0)} | httpTap={(_enableHttpResponseBodyTap ? 1 : 0)} | jsFileLog={(_enableJsFileLog ? 1 : 0)} | jsPushDbg={(_enableJsPushDebug ? 1 : 0)} | perfLog={(_enablePerfTimingLog ? 1 : 0)}");
                if (isDebug)
                    Log("[RuntimeProfile][WARN] Debug mode enables CDP tap and may cause UI lag/freezes. Use Performance for normal play.");
            }

            if (ShouldAttachCdpNetworkTap())
            {
                if (Web?.CoreWebView2 != null)
                    _ = EnableCdpNetworkTapAsync();
                if (_popupWeb?.CoreWebView2 != null)
                    _ = EnableCdpNetworkTapAsync(_popupWeb.CoreWebView2, "popup");
            }
            else
            {
                _ = DisableCdpNetworkTapAsync();
            }

            if (log)
                LogCdpDiagPulse("runtime-profile", force: true);

            if (Web?.CoreWebView2 != null || _popupWeb?.CoreWebView2 != null)
                _ = ApplyRuntimePerfToBetWebAsync();
        }

        private async Task ApplyRuntimePerfToBetWebAsync()
        {
            try
            {
                var loginUserJs = JsonSerializer.Serialize((T(TxtUser) ?? "").Trim());
                var js = $@"
(function(){{
  try {{
    function applyOne(w) {{
      try {{
        if (!w) return;
        w.__abx_push_ms = {_cwPushMs};
        w.__abx_perf_mode = {(_enableJsPushDebug ? 0 : 1)};
        w.__cw_file_log_enable = {(_enableJsFileLog ? 1 : 0)};
        w.__cw_debug_seq_push = {(_enableJsPushDebug ? 1 : 0)};
        w.__cw_debug_seq = {(_enableJsPushDebug ? 1 : 0)};
        w.__cw_seq_diag = 1;
        w.__cw_console_to_host = 1;
        w.__cw_console_passthrough = 0;
        w.__cw_panel_autostart = 1;
        w.__abx_login_username = {loginUserJs};
        w.__abx_username = {loginUserJs};
      }} catch(_e) {{}}
    }}
    applyOne(window);
    try {{ if (window.top && window.top !== window) applyOne(window.top); }} catch(_t) {{}}
    try {{ if (window.parent && window.parent !== window) applyOne(window.parent); }} catch(_p) {{}}
    try {{
      var fr = window.frames || [];
      for (var i=0; i<fr.length; i++) {{
        try {{ applyOne(fr[i]); }} catch(_f) {{}}
      }}
    }} catch(_fr) {{}}
    return 'ok';
  }} catch(e) {{
    return 'err:' + (e && e.message ? e.message : String(e));
  }}
}})();";
                var res = (await ExecuteOnBetWebAsync(js))?.Trim('"') ?? "";
                Log("[RuntimeProfile] apply-js => " + (string.IsNullOrWhiteSpace(res) ? "<empty>" : res));
            }
            catch (Exception ex)
            {
                Log("[RuntimeProfile] apply-js err: " + ex.Message);
            }
        }

        private void MaybeLogPerfMessage(
            string abx,
            string source,
            int msgLen,
            long parseMs,
            long totalMs,
            long jsBuildMs = -1,
            long jsTotalsMs = -1,
            long jsSeqMs = -1,
            long jsProgMs = -1,
            int jsPerfMode = -1)
        {
            if (!_enablePerfTimingLog) return;

            var now = DateTime.UtcNow;
            if (string.Equals(abx, "tick", StringComparison.OrdinalIgnoreCase))
            {
                bool severeTick =
                    totalMs >= 120 ||
                    parseMs >= 30 ||
                    jsBuildMs >= 160 ||
                    jsTotalsMs >= 80 ||
                    jsSeqMs >= 60 ||
                    jsProgMs >= 40;
                var minGap = source.IndexOf("popup-frame", StringComparison.OrdinalIgnoreCase) >= 0
                    ? TimeSpan.FromSeconds(3)
                    : TimeSpan.FromSeconds(5);
                if (!severeTick && (now - _lastPerfTickMsgLogUtc) < minGap)
                    return;
                _lastPerfTickMsgLogUtc = now;
            }

            bool slow = totalMs >= 60 || parseMs >= 15 || jsBuildMs >= 120 || jsTotalsMs >= 60 || jsSeqMs >= 45 || jsProgMs >= 35;
            if (!slow && (now - _lastPerfRuntimeLogUtc) < TimeSpan.FromSeconds(8))
                return;
            _lastPerfRuntimeLogUtc = now;

            var profile = _cfg?.RuntimeProfile ?? "Performance";
            var jsCost = jsBuildMs >= 0 ? jsBuildMs.ToString(CultureInfo.InvariantCulture) : "-";
            var jsTotals = jsTotalsMs >= 0 ? jsTotalsMs.ToString(CultureInfo.InvariantCulture) : "-";
            var jsSeq = jsSeqMs >= 0 ? jsSeqMs.ToString(CultureInfo.InvariantCulture) : "-";
            var jsProg = jsProgMs >= 0 ? jsProgMs.ToString(CultureInfo.InvariantCulture) : "-";
            var jsMode = jsPerfMode >= 0 ? jsPerfMode.ToString(CultureInfo.InvariantCulture) : "-";
            Log($"[PERF][MSG] abx={abx} | src={source} | len={msgLen} | parseMs={parseMs} | totalMs={totalMs} | jsBuildMs={jsCost} | jsTotalsMs={jsTotals} | jsSeqMs={jsSeq} | jsProgMs={jsProg} | jsPerfMode={jsMode} | pushMs={_cwPushMs} | profile={profile}");
        }

        private bool ShouldDropTickByIngressGate(string source, DateTime nowUtc)
        {
            bool isPopupFrame = source.IndexOf("popup-frame", StringComparison.OrdinalIgnoreCase) >= 0;
            bool isPopupPull = source.IndexOf("popup-pull", StringComparison.OrdinalIgnoreCase) >= 0;
            bool isMainFrame = source.IndexOf("main-frame", StringComparison.OrdinalIgnoreCase) >= 0;

            if (!isPopupFrame && !isPopupPull && !isMainFrame)
                return false;

            var minGap = isPopupFrame
                ? PopupFrameTickIngressMinGap
                : isPopupPull
                    ? PopupPullTickIngressMinGap
                    : MainFrameTickIngressMinGap;

            int droppedToLog = 0;
            bool shouldDrop = false;
            lock (_tickIngressGateLock)
            {
                DateTime lastTick = isPopupFrame
                    ? _lastPopupFrameTickIngressUtc
                    : isPopupPull
                        ? _lastPopupPullTickIngressUtc
                        : _lastMainFrameTickIngressUtc;

                if (lastTick != DateTime.MinValue && (nowUtc - lastTick) < minGap)
                {
                    _tickIngressDropCount++;
                    shouldDrop = true;
                }
                else
                {
                    if (isPopupFrame) _lastPopupFrameTickIngressUtc = nowUtc;
                    else if (isPopupPull) _lastPopupPullTickIngressUtc = nowUtc;
                    else _lastMainFrameTickIngressUtc = nowUtc;
                }

                if (_tickIngressDropCount > 0 && (nowUtc - _lastTickIngressDropLogUtc) >= TimeSpan.FromSeconds(5))
                {
                    droppedToLog = _tickIngressDropCount;
                    _tickIngressDropCount = 0;
                    _lastTickIngressDropLogUtc = nowUtc;
                }
            }

            if (droppedToLog > 0)
            {
                var srcTag = isPopupFrame ? "popup-frame" : isPopupPull ? "popup-pull" : "main-frame";
                Log($"[TickIngress] src={srcTag} | minGapMs={(int)minGap.TotalMilliseconds} | dropped={droppedToLog}");
            }

            return shouldDrop;
        }

        private void MaybeAutoFallbackRuntimeProfileByWsRate(DateTime nowUtc, long wsRecvCount)
        {
            bool shouldFallback = false;
            double ratePerSec = 0;
            long deltaWs = 0;
            double windowSec = 0;
            lock (_cdpAutoFallbackLock)
            {
                if (_cdpAutoFallbackLastCheckUtc == DateTime.MinValue)
                {
                    _cdpAutoFallbackLastCheckUtc = nowUtc;
                    _cdpAutoFallbackLastWsRecv = wsRecvCount;
                    return;
                }

                var window = nowUtc - _cdpAutoFallbackLastCheckUtc;
                var delta = wsRecvCount - _cdpAutoFallbackLastWsRecv;

                _cdpAutoFallbackLastCheckUtc = nowUtc;
                _cdpAutoFallbackLastWsRecv = wsRecvCount;

                var profileNow = NormalizeRuntimeProfile(_cfg?.RuntimeProfile);
                if (!string.Equals(profileNow, "Debug", StringComparison.OrdinalIgnoreCase) || !ShouldAttachCdpNetworkTap())
                    return;

                if (window < CdpAutoFallbackMinWindow || window > CdpAutoFallbackMaxWindow || delta <= 0)
                    return;

                if ((nowUtc - _cdpAutoFallbackLastFireUtc) < CdpAutoFallbackCooldown)
                    return;

                ratePerSec = delta / Math.Max(1.0, window.TotalSeconds);
                if (delta >= CdpAutoFallbackMinDeltaWs && ratePerSec >= CdpAutoFallbackMinRatePerSec)
                {
                    shouldFallback = true;
                    deltaWs = delta;
                    windowSec = window.TotalSeconds;
                    _cdpAutoFallbackLastFireUtc = nowUtc;
                }
            }

            if (!shouldFallback)
                return;

            void applyFallback()
            {
                try
                {
                    var profile = NormalizeRuntimeProfile(_cfg?.RuntimeProfile);
                    if (!string.Equals(profile, "Debug", StringComparison.OrdinalIgnoreCase))
                        return;

                    Log($"[RuntimeGuard] wsR-spike detected | delta={deltaWs} | windowSec={windowSec:0.#} | rate={ratePerSec:0.##}/s | action=fallback-to-Performance");
                    if (_cfg == null)
                        return;
                    _cfg.RuntimeProfile = "Performance";
                    ApplyRuntimeProfileFromConfig(log: true);
                    _ = SaveConfigAsync();
                }
                catch (Exception ex)
                {
                    Log("[RuntimeGuard] fallback failed: " + ex.Message);
                }
            }

            if (Dispatcher.CheckAccess())
                applyFallback();
            else
                _ = Dispatcher.BeginInvoke(new Action(applyFallback));
        }

        private void QueueTickUiUpdate(double? progUi, string statusUiDisplay, string seqForUi, double? amountUi, string userNameUi, string source, long seqVersion, string seqEvent)
        {
            var seqFiltered = FilterResultDisplaySeqWindow(seqForUi ?? "");
            var queueKey = $"{source}|{seqFiltered.Length}|{seqVersion}|{seqEvent}|{statusUiDisplay}";
            if (!string.Equals(_lastSeqUiQueueLogKey, queueKey, StringComparison.Ordinal))
            {
                _lastSeqUiQueueLogKey = queueKey;
                char seqTail = seqFiltered.Length > 0 ? seqFiltered[^1] : '-';
                Log($"[SEQ][UI][QUEUE] src={(string.IsNullOrWhiteSpace(source) ? "-" : source)} | len={seqFiltered.Length} | tail={seqTail} | ver={seqVersion} | evt={(string.IsNullOrWhiteSpace(seqEvent) ? "-" : seqEvent)} | status={(string.IsNullOrWhiteSpace(statusUiDisplay) ? "-" : Shrink(statusUiDisplay, 48))} | lastTailShown={_lastSeqTailShown.Length}");
            }

            lock (_tickUiQueueLock)
            {
                _pendingTickUiPayload = new TickUiPayload
                {
                    Prog = progUi,
                    StatusUi = statusUiDisplay ?? "",
                    Seq = seqFiltered,
                    SeqVersion = seqVersion,
                    SeqEvent = seqEvent ?? "",
                    Source = source ?? "",
                    Amount = amountUi,
                    UserName = userNameUi ?? ""
                };
            }

            if (Interlocked.Exchange(ref _tickUiDispatchQueued, 1) == 1)
                return;

            _ = Dispatcher.BeginInvoke(new Action(DrainTickUiQueue));
        }

        private void DrainTickUiQueue()
        {
            try
            {
                while (true)
                {
                    TickUiPayload? payload;
                    lock (_tickUiQueueLock)
                    {
                        payload = _pendingTickUiPayload;
                        _pendingTickUiPayload = null;
                    }

                    if (payload == null)
                        break;

                    try
                    {
                        if (payload.Prog.HasValue)
                        {
                            var pct = Math.Max(0, Math.Min(100, payload.Prog.Value));
                            var pctInt = (int)Math.Round(pct, MidpointRounding.AwayFromZero);
                            var ratio = pct / 100.0;
                            if (PrgBet != null)
                            {
                                PrgBet.Minimum = 0;
                                PrgBet.Maximum = 1;
                                PrgBet.Value = ratio;
                            }
                            if (LblProg != null) LblProg.Text = $"{pctInt}%";
                        }
                        else
                        {
                            if (PrgBet != null) PrgBet.Value = 0;
                            if (LblProg != null)
                                LblProg.Text = !string.IsNullOrWhiteSpace(payload.StatusUi) ? "0%" : "-";
                        }

                        var seqStrLocal = FilterResultDisplaySeqWindow(payload.Seq);
                        char last = (seqStrLocal.Length > 0) ? seqStrLocal[^1] : '\0';
                        var kq = (last == 'B') ? "B"
                                 : (last == 'P') ? "P"
                                 : (last == 'T') ? "T" : "";
                        SetLastResultUI(kq);

                        if (LblAmount != null)
                        {
                            if (payload.Amount.HasValue)
                                LblAmount.Text = payload.Amount.Value.ToString("#,0.##", CultureInfo.InvariantCulture);
                            else if (string.IsNullOrWhiteSpace(LblAmount.Text))
                                LblAmount.Text = "-";
                        }
                        if (LblUserName != null)
                        {
                            if (!string.IsNullOrWhiteSpace(payload.UserName))
                                LblUserName.Text = payload.UserName;
                            else
                                LblUserName.Text = "-";
                        }

                        var applyKey = $"{payload.Source}|{seqStrLocal.Length}|{payload.SeqVersion}|{payload.SeqEvent}|{_lastSeqTailShown}";
                        if (!string.Equals(_lastSeqUiApplyLogKey, applyKey, StringComparison.Ordinal))
                        {
                            _lastSeqUiApplyLogKey = applyKey;
                            char applyTail = seqStrLocal.Length > 0 ? seqStrLocal[^1] : '-';
                            int currentItems = SeqIcons?.Items.Count ?? -1;
                            int tooltipLen = SeqIcons?.ToolTip is string ttApply ? ttApply.Length : -1;
                            Log($"[SEQ][UI][APPLY] src={(string.IsNullOrWhiteSpace(payload.Source) ? "-" : payload.Source)} | len={seqStrLocal.Length} | tail={applyTail} | ver={payload.SeqVersion} | evt={(string.IsNullOrWhiteSpace(payload.SeqEvent) ? "-" : payload.SeqEvent)} | lastTailShown={_lastSeqTailShown.Length} | items={currentItems} | tooltipLen={tooltipLen}");
                        }

                        UpdateSeqUI(seqStrLocal);

                        if (LblStatusText != null)
                        {
                            if (!string.IsNullOrWhiteSpace(payload.StatusUi))
                            {
                                LblStatusText.Text = payload.StatusUi;
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
                }
            }
            finally
            {
                Interlocked.Exchange(ref _tickUiDispatchQueued, 0);
                lock (_tickUiQueueLock)
                {
                    if (_pendingTickUiPayload != null && Interlocked.Exchange(ref _tickUiDispatchQueued, 1) == 0)
                        _ = Dispatcher.BeginInvoke(new Action(DrainTickUiQueue));
                }
            }
        }

        private void SyncGlobalFieldsFromActive()
        {
            if (_activeTab == null) return;
            foreach (var tab in _strategyTabs)
            {
                if (ReferenceEquals(tab.Config, _activeTab.Config)) continue;
                CopyGlobalFields(_activeTab.Config, tab.Config);
            }
        }

        private void ApplyGlobalConfigToUi()
        {
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
        }

        private void ApplyActiveTabToUi()
        {
            if (_activeTab == null) return;
            _tabSwitching = true;
            try
            {
                if (TxtStakeCsv != null)
                {
                    TxtStakeCsv.Text = _cfg.StakeCsv;
                    RebuildStakeSeq(_cfg.StakeCsv);
                    Log($"[StakeCsv] loaded: {_cfg.StakeCsv} -> {_stakeSeq.Length} mức");
                }
                if (CmbBetStrategy != null)
                    CmbBetStrategy.SelectedIndex = (_cfg.BetStrategyIndex >= 0 && _cfg.BetStrategyIndex <= 17) ? _cfg.BetStrategyIndex : 16;
                SyncStrategyFieldsToUI();
                UpdateTooltips();
                UpdateBetStrategyUi();

                SyncDecisionPercentFromConfig(_cfg);
                if (TxtDecisionSecond != null) TxtDecisionSecond.Text = _cfg.DecisionSeconds.ToString(CultureInfo.InvariantCulture);
                if (CmbMoneyStrategy != null) ApplyMoneyStrategyToUI(_cfg.MoneyStrategy ?? "IncreaseWhenLose");
                LoadStakeCsvForCurrentMoneyStrategy();
                if (ChkS7ResetOnProfit != null) ChkS7ResetOnProfit.IsChecked = _cfg.S7ResetOnProfit;
                if (!IsAnyTabRunning() || IsActiveTabRunning())
                    MoneyHelper.S7ResetOnProfit = _cfg.S7ResetOnProfit;
                UpdateS7ResetOptionUI();

                if (TxtSideRatio != null)
                {
                    var sideTxt = _cfg.SideRateText ?? "";
                    TxtSideRatio.Text = sideTxt;
                    _cfg.SideRateText = sideTxt;
                }

                if (ChkTrial != null) ChkTrial.IsChecked = IsTrialModeRequestedOrActive();
                if (ChkLockMouse != null) ChkLockMouse.IsChecked = _cfg.LockMouse;

                ApplyCutUiFromConfig();
                ApplyTabRuntimeToUi(_activeTab);
                SetPlayButtonState(_activeTab.IsRunning);
            }
            finally { _tabSwitching = false; }
        }

        private void ApplyTabRuntimeToUi(StrategyTabState tab)
        {
            if (LblWin != null) LblWin.Text = tab.WinTotal.ToString("N0");
            if (LblStake != null) LblStake.Text = tab.LastStakeAmount.HasValue ? tab.LastStakeAmount.Value.ToString("N0") : "";
            if (LblLevel != null) LblLevel.Text = tab.LastLevelText ?? "";
            SetLastSideUI(tab.LastSide);
            if (string.Equals(TextNorm.U(tab.LastWinLossText ?? ""), "HOA", StringComparison.Ordinal))
                SetWinLossTextUI(tab.LastWinLossText);
            else
                SetWinLossUI(tab.LastWinLoss);
            UpdateStatsUi(tab);
        }

        private void UpdateStatsUi(StrategyTabState tab)
        {
            if (tab == null) return;
            if (!ReferenceEquals(_activeTab, tab)) return;

            var s = tab.Stats ?? new TabStats();
            if (LblStatStreak != null) LblStatStreak.Text = $"{s.MaxWinStreak}/{s.MaxLossStreak}";
            if (LblStatTotalWinLoss != null) LblStatTotalWinLoss.Text = $"{s.TotalWinCount}/{s.TotalLossCount}";
            if (LblStatTotalBet != null) LblStatTotalBet.Text = s.TotalBetAmount.ToString("N0");
            if (LblStatTotalProfit != null) LblStatTotalProfit.Text = s.TotalProfit.ToString("N0");
        }

        private void ApplyUiToConfig(AppConfig cfg)
        {
            cfg.Url = T(TxtUrl);
            cfg.StakeCsv = T(TxtStakeCsv, "1000,2000,4000,8000,16000");
            var decisionPercent = (int)Math.Round(ClampDecisionPercent(I(T(TxtDecisionSecond, "10"), 10)), MidpointRounding.AwayFromZero);
            cfg.DecisionSeconds = decisionPercent;
            if (ReferenceEquals(cfg, _cfg))
                _decisionPercent = decisionPercent;
            cfg.BetStrategyIndex = CmbBetStrategy?.SelectedIndex ?? cfg.BetStrategyIndex;
            cfg.BetSeq = T(TxtChuoiCau, cfg.BetSeq);
            cfg.BetPatterns = T(TxtTheCau, cfg.BetPatterns);
            cfg.SideRateText = T(TxtSideRatio, cfg.SideRateText);

            var remember = (ChkRemember?.IsChecked == true);
            cfg.RememberCreds = remember;
            if (remember)
            {
                cfg.EncUser = ProtectString(T(TxtUser));
                cfg.EncPass = ProtectString(P(TxtPass));
                cfg.Username = "";
            }
            else { cfg.EncUser = ""; cfg.EncPass = ""; cfg.Username = ""; }

            cfg.LockMouse = (ChkLockMouse?.IsChecked == true);
            cfg.UseTrial = IsTrialModeRequestedOrActive();
            cfg.LeaseClientId = _leaseClientId;
            cfg.MoneyStrategy = GetMoneyStrategyFromUI();
            if (ChkS7ResetOnProfit != null)
                cfg.S7ResetOnProfit = (ChkS7ResetOnProfit.IsChecked == true);

            cfg.RuntimeProfile = NormalizeRuntimeProfile(cfg.RuntimeProfile);
            cfg.PushIntervalMs = _cwPushMs;
            cfg.EnablePerfTimingLog = _enablePerfTimingLog;
        }

        private void UpdateAddTabUi()
        {
            if (BtnAddStrategyTab == null) return;
            var blocked = _strategyTabs.Count >= MaxTabs;
            BtnAddStrategyTab.Opacity = blocked ? 0.5 : 1.0;
            BtnAddStrategyTab.Cursor = blocked ? Cursors.Arrow : Cursors.Hand;
        }

        private void ShowTabHint(string message)
        {
            if (LblTabHint == null) return;
            LblTabHint.Text = message;
            LblTabHint.Visibility = Visibility.Visible;
            _tabHintTimer?.Stop();
            _tabHintTimer = new System.Windows.Threading.DispatcherTimer
            {
                Interval = TimeSpan.FromSeconds(2)
            };
            _tabHintTimer.Tick += (_, __) =>
            {
                if (LblTabHint != null) LblTabHint.Visibility = Visibility.Collapsed;
                _tabHintTimer?.Stop();
            };
            _tabHintTimer.Start();
        }

        private static string FixBrokenTabName(string? name, int index)
        {
            var trimmed = (name ?? "").Trim();
            if (string.IsNullOrWhiteSpace(trimmed))
                return $"Chiến lược {index}";

            if (trimmed.Equals($"Chi?n l??c {index}", StringComparison.OrdinalIgnoreCase) ||
                trimmed.Equals($"Chi?n lu?c {index}", StringComparison.OrdinalIgnoreCase) ||
                trimmed.Equals($"Chi?n l?c {index}", StringComparison.OrdinalIgnoreCase))
            {
                return $"Chiến lược {index}";
            }

            return name ?? "";
        }

        private string NormalizeTabName(StrategyTabState tab)
        {
            var name = (tab.Name ?? "").Trim();
            if (name.Length > 20) name = name.Substring(0, 20);
            if (string.IsNullOrWhiteSpace(name))
            {
                if (!string.IsNullOrWhiteSpace(tab.EditBackupName))
                    name = tab.EditBackupName;
                else
                    name = $"Chiến lược {_strategyTabs.IndexOf(tab) + 1}";
            }
            return name;
        }

        private bool IsAnyTabRunning()
        {
            return _strategyTabs.Any(t => t.IsRunning);
        }

        private bool HasJackpotMultiSideRunning() => false;

        private bool IsActiveTabRunning()
        {
            return _activeTab != null && _activeTab.IsRunning;
        }

        private static bool TryGetStrategyIndex(string? name, out int index)
        {
            index = 0;
            var trimmed = (name ?? "").Trim();
            if (string.IsNullOrWhiteSpace(trimmed)) return false;

            var norm = TextNorm.RemoveDiacritics(trimmed).ToUpperInvariant();
            var match = Regex.Match(norm, @"^CHIEN\s*LUOC\s*(\d+)$");
            if (!match.Success)
                match = Regex.Match(norm, @"^CHIENLUOC\s*(\d+)$");
            if (!match.Success) return false;

            return int.TryParse(match.Groups[1].Value, out index) && index > 0;
        }

        private int GetNextStrategyIndex()
        {
            var used = new HashSet<int>();
            foreach (var tab in _strategyTabs)
            {
                if (TryGetStrategyIndex(tab.Name, out var idx))
                    used.Add(idx);
            }

            for (int i = 1; i <= MaxTabs; i++)
            {
                if (!used.Contains(i))
                    return i;
            }

            return Math.Min(_strategyTabs.Count + 1, MaxTabs);
        }

        private void SwitchTab(StrategyTabState tab)
        {
            if (_activeTab != null && ReferenceEquals(_activeTab, tab))
                return;

            if (_activeTab != null)
            {
                ApplyUiToConfig(_activeTab.Config);
                SyncGlobalFieldsFromActive();
            }

            _activeTab = tab;
            _cfg = tab.Config;
            ApplyRuntimeProfileFromConfig(log: true);
            _rootCfg.SelectedTabId = tab.Id;
            if (StrategyTabList != null && StrategyTabList.SelectedItem != tab)
            {
                _tabSwitching = true;
                StrategyTabList.SelectedItem = tab;
                _tabSwitching = false;
            }
            ApplyActiveTabToUi();
            if (_uiReady) ApplyMouseShieldFromCheck();
            _ = SaveConfigAsync();
            _ = SaveStatsAsync();
        }

        private void StrategyTabList_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (_tabSwitching) return;
            if (StrategyTabList?.SelectedItem is StrategyTabState tab)
                SwitchTab(tab);
        }

        private void StrategyTabList_Loaded(object sender, RoutedEventArgs e)
        {
            UpdateTabHeaderLayout();
            ScrollTabsToEnd();
        }

        private void StrategyTabList_SizeChanged(object sender, SizeChangedEventArgs e)
        {
            if (!e.WidthChanged) return;
            UpdateTabHeaderLayout();
            ScrollTabsToEnd();
        }

        private void StrategyTabItem_RequestBringIntoView(object sender, RequestBringIntoViewEventArgs e)
        {
            e.Handled = true;
        }

        private void StrategyTabHost_SizeChanged(object sender, SizeChangedEventArgs e)
        {
            if (!e.WidthChanged) return;
            UpdateTabHeaderLayout();
        }

        private void ScrollTabsToEnd()
        {
            if (StrategyTabList == null) return;
            var sv = FindVisualChild<ScrollViewer>(StrategyTabList);
            sv?.ScrollToLeftEnd();
        }

        private void UpdateTabHeaderLayout()
        {
            if (StrategyTabList == null) return;
            int count = _strategyTabs.Count;
            if (count <= 0)
            {
                TabHeaderWidth = TabMaxWidth;
                TabOverlap = 0;
                TabStripWidth = 0;
                return;
            }

            double hostWidth = StrategyTabHost?.ActualWidth ?? 0;
            double avail = Math.Max(0, hostWidth - TabAddButtonWidth - TabAddButtonGap);
            double availInner = Math.Max(0, avail - TabStripRightInset);
            if (avail <= 0) return;

            double widthNoOverlap = (availInner - TabGap * (count - 1)) / count;
            double width = Math.Min(TabMaxWidth, widthNoOverlap);
            double overlap = 0;
            if (width >= TabMinWidth)
            {
                overlap = Math.Min(TabBaseOverlap, Math.Max(0, width - TabMinVisibleWidth));
            }
            else
            {
                width = Math.Max(TabMinVisibleWidth, widthNoOverlap);
                double total = width * count + TabGap * (count - 1);
                if (total > availInner && count > 1)
                {
                    double requiredOverlap = (total - availInner) / (count - 1);
                    double maxOverlap = Math.Max(0, width - TabMinVisibleWidth);
                    overlap = Math.Min(requiredOverlap, maxOverlap);
                }
            }

            TabHeaderWidth = Math.Round(width, 2);
            TabOverlap = Math.Round(overlap, 2);
            var strip = TabHeaderWidth * count + (TabGap - TabOverlap) * (count - 1);
            TabStripWidth = Math.Min(availInner, strip) + TabGap;
        }

        private void StrategyTabList_PreviewMouseLeftButtonDown(object sender, MouseButtonEventArgs e)
        {
            if (sender is not ListBox) return;
            if (FindAncestor<Button>(e.OriginalSource as DependencyObject) != null) { _tabDragArmed = false; return; }
            if (FindAncestor<TextBox>(e.OriginalSource as DependencyObject) != null) { _tabDragArmed = false; return; }
            var item = FindAncestor<ListBoxItem>(e.OriginalSource as DependencyObject);
            if (item == null)
            {
                _tabDragArmed = false;
                return;
            }
            _tabDragStart = e.GetPosition(null);
            _tabDragArmed = true;
        }

        private void StrategyTabList_PreviewMouseMove(object sender, MouseEventArgs e)
        {
            if (e.LeftButton != MouseButtonState.Pressed || !_tabDragArmed) return;
            var pos = e.GetPosition(null);
            if (Math.Abs(pos.X - _tabDragStart.X) < SystemParameters.MinimumHorizontalDragDistance &&
                Math.Abs(pos.Y - _tabDragStart.Y) < SystemParameters.MinimumVerticalDragDistance)
                return;

            _tabDragArmed = false;
            var item = FindAncestor<ListBoxItem>(e.OriginalSource as DependencyObject);
            if (item?.DataContext is StrategyTabState tab)
            {
                DragDrop.DoDragDrop(item, tab, DragDropEffects.Move);
            }
        }

        private void StrategyTabList_Drop(object sender, DragEventArgs e)
        {
            if (StrategyTabList == null) return;
            if (!e.Data.GetDataPresent(typeof(StrategyTabState))) return;

            var dropped = e.Data.GetData(typeof(StrategyTabState)) as StrategyTabState;
            if (dropped == null) return;

            var targetItem = FindAncestor<ListBoxItem>(e.OriginalSource as DependencyObject);
            var target = targetItem?.DataContext as StrategyTabState;
            if (target == null || ReferenceEquals(dropped, target)) return;

            var oldIndex = _strategyTabs.IndexOf(dropped);
            var newIndex = _strategyTabs.IndexOf(target);
            if (oldIndex < 0 || newIndex < 0) return;

            _tabSwitching = true;
            _strategyTabs.Move(oldIndex, newIndex);
            if (_activeTab != null)
                StrategyTabList.SelectedItem = _activeTab;
            _tabSwitching = false;

            _rootCfg.Tabs = _strategyTabs.Select(t => t.Config).ToList();
            _rootCfg.SelectedTabId = _activeTab?.Id ?? "";
            _ = SaveConfigAsync();
        }

        private void StrategyTabs_CollectionChanged(object? sender, NotifyCollectionChangedEventArgs e)
        {
            Dispatcher.BeginInvoke(new Action(() =>
            {
                UpdateTabHeaderLayout();
                ScrollTabsToEnd();
            }), System.Windows.Threading.DispatcherPriority.Loaded);
        }


        private void AddStrategyTab_Click(object sender, RoutedEventArgs e)
        {
            if (_strategyTabs.Count >= MaxTabs)
            {
                ShowTabHint("Chỉ được mở tối đa 5 chiến lược");
                return;
            }

            if (_activeTab != null)
            {
                ApplyUiToConfig(_activeTab.Config);
                SyncGlobalFieldsFromActive();
            }

            var cfg = CreateDefaultTab(GetNextStrategyIndex());
            if (_activeTab != null)
                CopyGlobalFields(_activeTab.Config, cfg);

            var tab = new StrategyTabState(cfg) { Name = cfg.TabName };
            _strategyTabs.Add(tab);
            UpdateAddTabUi();

            if (StrategyTabList != null)
                StrategyTabList.SelectedItem = tab;
            Dispatcher.BeginInvoke(new Action(ScrollTabsToEnd), System.Windows.Threading.DispatcherPriority.Loaded);

            _ = SaveConfigAsync();
        }

        private async void TabClose_Click(object sender, RoutedEventArgs e)
        {
            if ((sender as Button)?.Tag is not StrategyTabState tab)
                return;

            if (_strategyTabs.Count <= 1)
            {
                ShowTabHint("Cần tối thiểu 1 chiến lược");
                return;
            }

            if (tab.IsRunning)
            {
                if (!ReferenceEquals(tab, _activeTab))
                    SwitchTab(tab);
                StopXocDia_Click(this, new RoutedEventArgs());
            }

            var idx = _strategyTabs.IndexOf(tab);
            _strategyTabs.Remove(tab);
            UpdateAddTabUi();

            if (_strategyTabs.Count > 0 && StrategyTabList != null)
            {
                var next = _strategyTabs[Math.Min(idx, _strategyTabs.Count - 1)];
                StrategyTabList.SelectedItem = next;
            }

            _rootCfg.Tabs = _strategyTabs.Select(t => t.Config).ToList();
            _rootCfg.SelectedTabId = _activeTab?.Id ?? "";
            await SaveConfigAsync();
            await SaveStatsAsync();
        }

        private void TabHeader_MouseDoubleClick(object sender, MouseButtonEventArgs e)
        {
            if (e.ClickCount != 2) return;
            if (sender is Border border && border.DataContext is StrategyTabState tab)
            {
                tab.EditBackupName = tab.Name;
                tab.IsEditing = true;
                Dispatcher.BeginInvoke(new Action(() =>
                {
                    var tb = FindVisualChild<TextBox>(border);
                    if (tb != null)
                    {
                        tb.Focus();
                        tb.SelectAll();
                    }
                }), System.Windows.Threading.DispatcherPriority.Input);
                e.Handled = true;
            }
        }

        private void TabNameEdit_KeyDown(object sender, KeyEventArgs e)
        {
            if (sender is not TextBox tb || tb.DataContext is not StrategyTabState tab) return;
            if (e.Key == Key.Enter)
            {
                CommitTabName(tab);
                e.Handled = true;
            }
            else if (e.Key == Key.Escape)
            {
                tab.Name = tab.EditBackupName;
                tab.IsEditing = false;
                e.Handled = true;
            }
        }

        private void TabNameEdit_LostFocus(object sender, RoutedEventArgs e)
        {
            if (sender is TextBox tb && tb.DataContext is StrategyTabState tab)
                CommitTabName(tab);
        }

        private void CommitTabName(StrategyTabState tab)
        {
            var name = NormalizeTabName(tab);
            tab.Name = name;
            tab.IsEditing = false;
            _ = SaveConfigAsync();
        }

        private static T? FindVisualChild<T>(DependencyObject parent) where T : DependencyObject
        {
            if (parent == null) return null;
            int count = VisualTreeHelper.GetChildrenCount(parent);
            for (int i = 0; i < count; i++)
            {
                var child = VisualTreeHelper.GetChild(parent, i);
                if (child is T found) return found;
                var next = FindVisualChild<T>(child);
                if (next != null) return next;
            }
            return null;
        }

        private static T? FindAncestor<T>(DependencyObject? child) where T : DependencyObject
        {
            while (child != null)
            {
                if (child is T match) return match;
                child = VisualTreeHelper.GetParent(child);
            }
            return null;
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
                    Web.CoreWebView2.WebMessageReceived += CoreWebView2_WebMessageReceived;
                }

                // 3) Hook NavigationCompleted để chuyển UI theo URL ngay khi điều hướng xong
                if (!_navModeHooked && Web != null)
                {
                    _navModeHooked = true;
                    Web.NavigationCompleted += async (_, __) =>
                    {
                        try
                        {
                            var src = Web?.Source?.ToString() ?? "";
                            var host = string.IsNullOrWhiteSpace(src) ? "" : new Uri(src).Host;
                            bool isGameHost = host.StartsWith("games.", StringComparison.OrdinalIgnoreCase);

                            await Dispatcher.InvokeAsync(() => ApplyUiMode(isGameHost));
                        }
                        catch { /* ignore */ }
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
                    var oldHost = TryExtractHost(Web.Source?.ToString());
                    var newHost = target.Host ?? "";
                    if (_popupWeb != null)
                        ClosePopupHost();
                    if (!string.Equals(oldHost, newHost, StringComparison.OrdinalIgnoreCase))
                    {
                        ResetPlayerFlowGameCache("main-host-change");
                        _lastGameTickUtc = DateTime.MinValue;
                        lock (_snapLock) { _lastSnap = null; }
                    }

                    _lastGameUrl = target.ToString();
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
                    options: null /* giữ environment sạch, browser args được cấu hình ở XAML nếu cần */
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
                    settings.UserAgent = BuildDesktopEdgeUserAgent();
                    Log("[Web] UA=" + settings.UserAgent);
                    // (tuỳ chọn khác, giữ nguyên nếu bạn không cần)
                    // settings.AreDefaultContextMenusEnabled = false;
                    // settings.AreDevToolsEnabled = true;
                }

                // Khong tu mo DevTools cua Web chinh de tranh nham voi PopupWeb game.

                // Không gắn WebMessageReceived ở đây (đã gắn trong EnsureWebReadyAsync)
                // Giữ nguyên hành vi popup/new window như trình duyệt thật để không làm hỏng flow mở game/provider
                Web.CoreWebView2.NewWindowRequested += NewWindowRequested;

                // Theo dõi điều hướng để đồng bộ nền/trạng thái
                Web.NavigationCompleted += Web_NavigationCompleted;
                Web.CoreWebView2.WebResourceResponseReceived += CoreWebView2_WebResourceResponseReceived;

                // Bật CDP network tap (không cần await)
                if (ShouldAttachCdpNetworkTap())
                    _ = EnableCdpNetworkTapAsync();

                // Cập nhật nền ngay theo trạng thái hiện tại (trắng khi chưa nhập URL, trong suốt khi đã điều hướng)
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

            // 1) Runtime riêng của XocDiaSoiLiveKH24 (dùng khi chạy EXE độc lập)
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

            // Ưu tiên resource nhúng; fallback sang file ngoài nếu chạy Debug không nhúng
            Stream? zipStream = Assembly.GetExecutingAssembly().GetManifestResourceStream(resName);
            if (zipStream == null)
            {
                var exeDir = AppDomain.CurrentDomain.BaseDirectory;
                var zipPath = Path.Combine(exeDir, "ThirdParty", "WebView2Fixed_win-x64.zip");
                if (!File.Exists(zipPath))
                    zipPath = Path.Combine(exeDir, "WebView2Fixed_win-x64.zip");
                if (File.Exists(zipPath))
                {
                    Log("[Web] Using external WebView2Fixed zip: " + zipPath);
                    zipStream = File.OpenRead(zipPath);
                }
            }

            using var s = zipStream ?? throw new FileNotFoundException("Missing WebView2Fixed zip: " + resName);
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

        private static string BuildDesktopEdgeUserAgent()
        {
            var version = "140.0.0.0";
            try
            {
                var raw = CoreWebView2Environment.GetAvailableBrowserVersionString();
                if (!string.IsNullOrWhiteSpace(raw))
                {
                    var token = raw.Split(' ', StringSplitOptions.RemoveEmptyEntries)[0].Trim();
                    if (!string.IsNullOrWhiteSpace(token))
                        version = token;
                }
            }
            catch
            {
                // giữ fallback cố định
            }

            return $"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{version} Safari/537.36 Edg/{version}";
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

        // ====== UI events ======
        private async void Window_Loaded(object sender, RoutedEventArgs e)
        {
            _uiReady = false;

            try
            {
                StartLogPump();
                // NEW: gắn logger để MoneyHelper ghi ra file log hiện tại
                MoneyHelper.Logger = Log;
                LoadConfig();
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
                    if (TxtStakeCsv != null) TxtStakeCsv.TextChanged += TxtStakeCsv_TextChanged;
                    if (TxtSideRatio != null) TxtSideRatio.TextChanged += TxtSideRatio_TextChanged;
                    if (CmbBetStrategy != null) CmbBetStrategy.SelectionChanged += CmbBetStrategy_SelectionChanged;
                    if (TxtChuoiCau != null) TxtChuoiCau.TextChanged += TxtChuoiCau_TextChanged;
                    if (TxtTheCau != null) TxtTheCau.TextChanged += TxtTheCau_TextChanged;
                    if (CmbMoneyStrategy != null) CmbMoneyStrategy.SelectionChanged += CmbMoneyStrategy_SelectionChanged;
                    if (BtnResetSideRatio != null) BtnResetSideRatio.Click += BtnResetSideRatio_Click;

                    _inputEventsHooked = true;
                }

                // Re-bind click handlers phòng trường hợp binding XAML bị lệch ở runtime.
                if (BtnVaoXocDia != null)
                {
                    BtnVaoXocDia.Click -= VaoXocDia_Click;
                    BtnVaoXocDia.Click += VaoXocDia_Click;
                }
                if (BtnTrialTool != null)
                {
                    BtnTrialTool.Click -= BtnTrialTool_Click;
                    BtnTrialTool.Click += BtnTrialTool_Click;
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

                var start = string.IsNullOrWhiteSpace(_cfg.Url) ? (TxtUrl?.Text ?? "") : _cfg.Url;
                if (!string.IsNullOrWhiteSpace(start) && !_didStartupNav)
                {
                    _didStartupNav = true;
                    await NavigateIfNeededAsync(start.Trim());

                    await ApplyBackgroundForStateAsync(); // đúng hành vi cũ sau khi có URL
                }

                SetPlayButtonState(_activeTab?.IsRunning == true); // (nếu trong SetPlayButtonState có SetConfigEditable thì sẽ khóa/mở các ô)
                ApplyMouseShieldFromCheck();

                // --- BẮT ĐẦU GIÁM SÁT UI MODE ---
                if (_uiModeTimer == null)
                {
                    _uiModeTimer = new System.Windows.Threading.DispatcherTimer
                    {
                        Interval = TimeSpan.FromMilliseconds(450)
                    };
                    _uiModeTimer.Tick += (_, __) =>
                    {
                        try { RecomputeUiMode(); } catch { /* ignore */ }
                        _ = TryPullPopupTickFallbackAsync();
                    };
                    _uiModeTimer.Start();
                    RecomputeUiMode();
                }

            }
            catch (Exception ex)
            {
                Log("[Window_Loaded] " + ex);
            }
            finally
            {
                _uiReady = true;
            }
        }








        private async void Window_Closing(object? sender, System.ComponentModel.CancelEventArgs e)
        {
            try { await SaveConfigAsync(); } catch { }
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
            try { await SaveConfigAsync(); Log("[Remember] " + ((ChkRemember?.IsChecked == true) ? "ON" : "OFF")); }
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
                _ = Dispatcher.InvokeAsync(async () =>
                {
                    try
                    {
                        await EnsureBridgeRegisteredAsync();
                        await InjectOnNewDocAsync();
                    }
                    catch (Exception exBridge)
                    {
                        Log("[Web_NavigationCompleted.Bridge] " + exBridge.Message);
                    }
                });

                // HÀNH VI CŨ
                Dispatcher.BeginInvoke(new Action(ApplyMouseShieldFromCheck));
            }
            catch (Exception ex)
            {
                Log("[Web_NavigationCompleted] " + ex);
            }
        }



        private async void TxtUrl_TextChanged(object sender, TextChangedEventArgs e)
        {
            if (!_uiReady || _tabSwitching) return;

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
            if (!_uiReady || _tabSwitching) return;
            _userCts = await DebounceAsync(_userCts, 150, async () =>
            {
                await SaveConfigAsync();
            });
        }
        private async void TxtPass_PasswordChanged(object sender, RoutedEventArgs e)
        {
            if (!_uiReady || _tabSwitching) return;
            _passCts = await DebounceAsync(_passCts, 150, async () =>
            {
                await SaveConfigAsync();
            });
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
                if (!IsAnyTabRunning() || IsActiveTabRunning())
                    MoneyHelper.S7ResetOnProfit = _cfg.S7ResetOnProfit;
            }
            catch { }
        }

        private async void ChkS7ResetOnProfit_Changed(object sender, RoutedEventArgs e)
        {
            if (!_uiReady || _tabSwitching) return;
            _cfg.S7ResetOnProfit = (ChkS7ResetOnProfit?.IsChecked == true);
            if (!IsAnyTabRunning() || IsActiveTabRunning())
            {
                MoneyHelper.S7ResetOnProfit = _cfg.S7ResetOnProfit;
                MoneyHelper.ResetTempProfitForWinUpLoseKeep();
            }

                await SaveConfigAsync();
        }

        async void CmbMoneyStrategy_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (!_uiReady || _tabSwitching) return;
            _cfg.MoneyStrategy = GetMoneyStrategyFromUI();
            if (!IsAnyTabRunning() || IsActiveTabRunning())
                BaccaratViVoGaming.Tasks.MoneyHelper.ResetTempProfitForWinUpLoseKeep();
            // NEW: mỗi “Quản lý vốn” có chuỗi tiền riêng → nạp lại ô StakeCsv
            LoadStakeCsvForCurrentMoneyStrategy();
            UpdateS7ResetOptionUI();
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
            AttachTip(TxtSideRatio, TIP_SIDE_RATIO);

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
                0 => "1) Chuỗi B/P tự nhập: So khớp chuỗi B/P cấu hình thủ công (cũ→mới); khi khớp mẫu gần nhất sẽ đặt theo cửa chỉ định; không khớp dùng logic mặc định.",
                1 => "2) Thế cầu B/P tự nhập: Ánh xạ 'mẫu quá khứ → cửa kế tiếp' theo danh sách quy tắc; ưu tiên mẫu dài và khớp gần nhất; hỗ trợ ',', ';', '|', hoặc xuống dòng.",
                2 => "3) Chuỗi I/N: So khớp dãy Ít/Nhiều (I/N) cấu hình thủ công; khớp thì đặt theo chỉ định; không khớp dùng logic mặc định.",
                3 => "4) Thế cầu I/N: Ánh xạ mẫu I/N → cửa kế tiếp; ưu tiên mẫu dài; cho phép nhiều luật trong cùng danh sách.",
                4 => "5) Theo cầu trước (thông minh): Dựa vào ván gần nhất và heuristics nội bộ; đánh liên tục; quản lý vốn theo chuỗi tiền, cut_profit/cut_loss.",
                5 => "6) Cửa đặt ngẫu nhiên: Mỗi ván chọn BANKER/PLAYER ngẫu nhiên; vẫn tuân theo MoneyManager và ngưỡng cắt lãi/lỗ.",
                6 => "7) Bám cầu B/P (thống kê): Duyệt k từ lớn→nhỏ (k=6 mặc định); đếm tần suất B/P sau các lần khớp đuôi; chọn phía đa số; hòa → đảo 1–1; không có mẫu → theo ván cuối; đánh liên tục.",
                7 => "8) Xu hướng chuyển trạng thái: Thống kê 6 chuyển gần nhất giữa các ván ('lặp' vs 'đảo'); nếu 'đảo' nhiều hơn → đánh ngược ván cuối; ngược lại → theo ván cuối; đánh liên tục.",
                8 => "9) Run-length (dài chuỗi): Tính độ dài chuỗi ký tự cuối; nếu run ≥ T (mặc định T=3) → đảo để mean-revert; nếu run ngắn → theo đà (momentum); đánh liên tục.",
                9 => "10) Chuyên gia bỏ phiếu: Kết hợp 5 chuyên gia (theo-last, đảo-last, run-length, transition, AI-stat); chọn phía đa số; hòa → đảo; đánh liên tục để phủ nhiều kịch bản.",
                10 => "11) Lịch chẻ 10 tay: Tay 1–5 theo ván cuối, tay 6–10 đảo ván cuối; lặp lại block cố định; đơn giản, dễ dự báo nhịp.",
                11 => "12) KNN chuỗi con: So khớp gần đúng tail k (k=6..3) với Hamming ≤ 1; exact-match tính 2 điểm, near-match 1 điểm; chọn phía điểm cao hơn; hòa → đảo; không match → theo ván cuối; đánh liên tục.",
                12 => "13) Lịch hai lớp: Lịch pha trộn 10 bước (1–3 theo-last, 4 đảo, 5–7 AI-stat, 8 đảo, 9 theo, 10 AI-stat); lặp lại; cân bằng giữa momentum/mean-revert/thống kê; đánh liên tục.",
                13 => "14) AI học tại chỗ (n-gram): Học dần từ kết quả thật; dùng tần suất có làm mịn + backoff; hòa → đảo 1–1; bộ nhớ cố định, không phình.",
                14 => "15) Bỏ phiếu Top10 có điều kiện; Loss-Guard động; Hard-guard tự bật khi L≥5 và tự gỡ khi thắng 2 ván liên tục hoặc w20>55%; hòa 5–5 đánh ngẫu nhiên; 6–4 nhưng conf<0.60 thì fallback theo Regime (ZIGZAG=ZigFollow, còn lại=FollowPrev). Ưu tiên “ăn trend” khi guard ON. Re-seed sau mỗi ván (tối đa 50 tay)",
                15 => "16) TOP10 TÍCH LŨY (khởi từ 50 B/P). Khởi tạo thống kê từ 50 kết quả đầu vào (B/P). Mỗi kết quả mới: cộng dồn cho chuỗi dài 10 'mới về'. Luôn đánh theo chuỗi có bộ đếm lớn nhất; chỉ chuyển chuỗi khi THẮNG và chuỗi mới có đếm >= hiện tại.",
                16 => "17) Logic nhiều cửa đã bị loại bỏ khỏi BaccaratViVoGaming.",
                17 => "18) Chuỗi cầu B/P hay về: Tự phân tích seq 52 ký tự, loại mẫu đã xuất hiện (theo quy tắc đảo); chọn ngẫu nhiên một mẫu còn lại để đánh; hết chuỗi thì tìm lại; không còn mẫu thì đánh ngẫu nhiên.",
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
                0 => "1) Chuỗi B/P tự nhập: So khớp chuỗi B/P cấu hình thủ công (cũ→mới); khi khớp mẫu gần nhất sẽ đặt theo cửa chỉ định; không khớp dùng logic mặc định.",
                1 => "2) Thế cầu B/P tự nhập: Ánh xạ 'mẫu quá khứ → cửa kế tiếp' theo danh sách quy tắc; ưu tiên mẫu dài và khớp gần nhất; hỗ trợ ',', ';', '|', hoặc xuống dòng.",
                2 => "3) Chuỗi I/N: So khớp dãy Ít/Nhiều (I/N) cấu hình thủ công; khớp thì đặt theo chỉ định; không khớp dùng logic mặc định.",
                3 => "4) Thế cầu I/N: Ánh xạ mẫu I/N → cửa kế tiếp; ưu tiên mẫu dài; cho phép nhiều luật trong cùng danh sách.",
                4 => "5) Theo cầu trước (thông minh): Dựa vào ván gần nhất và heuristics nội bộ; đánh liên tục; quản lý vốn theo chuỗi tiền, cut_profit/cut_loss.",
                5 => "6) Cửa đặt ngẫu nhiên: Mỗi ván chọn BANKER/PLAYER ngẫu nhiên; vẫn tuân theo MoneyManager và ngưỡng cắt lãi/lỗ.",
                6 => "7) Bám cầu B/P (thống kê): Duyệt k từ lớn→nhỏ (k=6 mặc định); đếm tần suất B/P sau các lần khớp đuôi; chọn phía đa số; hòa → đảo 1–1; không có mẫu → theo ván cuối; đánh liên tục.",
                7 => "8) Xu hướng chuyển trạng thái: Thống kê 6 chuyển gần nhất giữa các ván ('lặp' vs 'đảo'); nếu 'đảo' nhiều hơn → đánh ngược ván cuối; ngược lại → theo ván cuối; đánh liên tục.",
                8 => "9) Run-length (dài chuỗi): Tính độ dài chuỗi ký tự cuối; nếu run ≥ T (mặc định T=3) → đảo để mean-revert; nếu run ngắn → theo đà (momentum); đánh liên tục.",
                9 => "10) Chuyên gia bỏ phiếu: Kết hợp 5 chuyên gia (theo-last, đảo-last, run-length, transition, AI-stat); chọn phía đa số; hòa → đảo; đánh liên tục để phủ nhiều kịch bản.",
                10 => "11) Lịch chẻ 10 tay: Tay 1–5 theo ván cuối, tay 6–10 đảo ván cuối; lặp lại block cố định; đơn giản, dễ dự báo nhịp.",
                11 => "12) KNN chuỗi con: So khớp gần đúng tail k (k=6..3) với Hamming ≤ 1; exact-match tính 2 điểm, near-match 1 điểm; chọn phía điểm cao hơn; hòa → đảo; không match → theo ván cuối; đánh liên tục.",
                12 => "13) Lịch hai lớp: Lịch pha trộn 10 bước (1–3 theo-last, 4 đảo, 5–7 AI-stat, 8 đảo, 9 theo, 10 AI-stat); lặp lại; cân bằng giữa momentum/mean-revert/thống kê; đánh liên tục.",
                13 => "14) AI học tại chỗ (n-gram): Học dần từ kết quả thật; dùng tần suất có làm mịn + backoff; hòa → đảo 1–1; bộ nhớ cố định, không phình.",
                14 => "15) Bỏ phiếu Top10 có điều kiện; Loss-Guard động; Hard-guard tự bật khi L≥5 và tự gỡ khi thắng 2 ván liên tục hoặc w20>55%; hòa 5–5 đánh ngẫu nhiên; 6–4 nhưng conf<0.60 thì fallback theo Regime (ZIGZAG=ZigFollow, còn lại=FollowPrev). Ưu tiên “ăn trend” khi guard ON. Re-seed sau mỗi ván (tối đa 50 tay)",
                15 => "16) TOP10 TÍCH LŨY (khởi từ 50 B/P). Khởi tạo thống kê từ 50 kết quả đầu vào (B/P). Mỗi kết quả mới: cộng dồn cho chuỗi dài 10 'mới về'. Luôn đánh theo chuỗi có bộ đếm lớn nhất; chỉ chuyển chuỗi khi THẮNG và chuỗi mới có đếm >= hiện tại.",
                16 => "17) Logic nhiều cửa đã bị loại bỏ khỏi BaccaratViVoGaming.",
                17 => "18) Chuỗi cầu B/P hay về: Tự phân tích seq 52 ký tự, loại mẫu đã xuất hiện (theo quy tắc đảo); chọn ngẫu nhiên một mẫu còn lại để đánh; hết chuỗi thì tìm lại; không còn mẫu thì đánh ngẫu nhiên.",
                _ => "Chiến lược chưa xác định."
            };
        }


        private async void NewWindowRequested(object? s, CoreWebView2NewWindowRequestedEventArgs e)
        {
            var deferral = e.GetDeferral();
            try
            {
                var target = (e.Uri ?? "").Trim();
                var deferBlankPopupForHost = IsCurrentHostB8Pro07() &&
                    string.Equals(target, "about:blank", StringComparison.OrdinalIgnoreCase);
                Log("[NewWindowRequested] " + (string.IsNullOrWhiteSpace(target) ? "<empty>" : target));

                var popupWeb = await EnsurePopupWebReadyAsync();
                if (popupWeb?.CoreWebView2 != null)
                {
                    await Dispatcher.InvokeAsync(() =>
                    {
                        if (!deferBlankPopupForHost)
                        {
                            if (Web != null)
                                Web.Visibility = Visibility.Collapsed;
                            if (PopupHost != null)
                                PopupHost.Visibility = Visibility.Visible;
                        }
                    });
                    e.NewWindow = popupWeb.CoreWebView2;
                    if (!deferBlankPopupForHost)
                        popupWeb.Focus();
                    else
                        Log("[NewWindowRequested] defer popup activation until host iframe yields a real game URL.");
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
                    _popupWeb = new WebView2();
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
            if (_popupWebHooked) return popupWeb;

            var settings = popupWeb.CoreWebView2.Settings;
            if (settings != null)
            {
                settings.IsWebMessageEnabled = true;
                settings.UserAgent = BuildDesktopEdgeUserAgent();
            }

            _appJs ??= await LoadAppJsAsyncFallback();
            if (!_popupBridgeRegistered)
            {
                await popupWeb.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(TOP_FORWARD);
                if (!string.IsNullOrEmpty(_appJs))
                    await popupWeb.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(_appJs);
                await popupWeb.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(FRAME_AUTOSTART);
                popupWeb.CoreWebView2.FrameCreated += PopupCore_FrameCreated_Bridge;
                popupWeb.CoreWebView2.DOMContentLoaded += PopupCore_DOMContentLoaded_Bridge;
                _popupBridgeRegistered = true;
                Log("[PopupWeb] bridge registered");
            }

            if (!_popupWebMsgHooked)
            {
                popupWeb.CoreWebView2.WebMessageReceived += CoreWebView2_WebMessageReceived;
                popupWeb.CoreWebView2.WebResourceResponseReceived += CoreWebView2_WebResourceResponseReceived;
                if (ShouldAttachCdpNetworkTap())
                    _ = EnableCdpNetworkTapAsync(popupWeb.CoreWebView2, "popup");
                _popupWebMsgHooked = true;
                Log("[PopupWeb] WebMessageReceived hooked");
            }

            popupWeb.CoreWebView2.NewWindowRequested += PopupWeb_NewWindowRequested;
            popupWeb.CoreWebView2.WindowCloseRequested += PopupWeb_WindowCloseRequested;
            popupWeb.NavigationStarting += PopupWeb_NavigationStarting;
            popupWeb.NavigationCompleted += PopupWeb_NavigationCompleted;
            _popupWebHooked = true;
            if (!_popupDevToolsOpened)
            {
                try
                {
                    if (_enableJsPushDebug)
                    {
                        popupWeb.CoreWebView2.OpenDevToolsWindow();
                        _popupDevToolsOpened = true;
                        Log("[PopupWeb] DevTools opened");
                    }
                }
                catch { }
            }
            Log("[PopupWeb] ready");
            return popupWeb;
        }

        private async Task InjectOnPopupDocAsync()
        {
            if (_popupWeb?.CoreWebView2 == null) return;
            if (Interlocked.Exchange(ref _popupInjectBusy, 1) == 1) return;

            try
            {
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
                    await _popupWeb.CoreWebView2.ExecuteScriptAsync(POPUP_TOP_AUTOSTART_SINGLE_BAC);
                    await _popupWeb.CoreWebView2.ExecuteScriptAsync(POPUP_TOP_START_PUSH_SINGLE_BAC);
                    _popupLastDocKey = key;
                    await ApplyRuntimePerfToBetWebAsync();
                    Log("[PopupWeb] bridge injected, key=" + key);
                    Log($"[PopupWeb] ensure push {_cwPushMs}ms (game-context auto)");
                    await LogBridgeProbeOnWebViewAsync(_popupWeb, "popup-doc-injected", "PopupWeb");
                }
            }
            finally
            {
                Interlocked.Exchange(ref _popupInjectBusy, 0);
            }
        }

        private async void CoreWebView2_WebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
        {
            try
            {
                var msg = e.TryGetWebMessageAsString() ?? "";
                if (string.IsNullOrWhiteSpace(msg)) return;
                await HandleIncomingWebMessageAsync(msg, ReferenceEquals(sender, _popupWeb?.CoreWebView2) ? "popup-msg" : "main-msg");
            }
            catch (Exception ex)
            {
                Log("[WebMessageReceived] " + ex);
            }
        }

        private async Task HandleIncomingWebMessageAsync(string msg, string source = "direct")
        {
            if (string.IsNullOrWhiteSpace(msg)) return;
            var perfSw = Stopwatch.StartNew();
            long parseMs = -1;
            long jsBuildMs = -1;
            long jsTotalsMs = -1;
            long jsSeqMs = -1;
            long jsProgMs = -1;
            int jsPerfMode = -1;
            string perfAbx = "raw";
            bool isJsLogBatchRaw = msg.IndexOf("\"abx\":\"cwLogBatch\"", StringComparison.OrdinalIgnoreCase) >= 0;
            bool isJsSeqDiagRaw = msg.IndexOf("\"abx\":\"seq_diag\"", StringComparison.OrdinalIgnoreCase) >= 0;
            bool isJsConsoleRaw = msg.IndexOf("\"abx\":\"js_console\"", StringComparison.OrdinalIgnoreCase) >= 0;
            bool isTickRaw = msg.IndexOf("\"abx\":\"tick\"", StringComparison.OrdinalIgnoreCase) >= 0;
            if (isTickRaw && ShouldDropTickByIngressGate(source, DateTime.UtcNow))
                return;
            if (!isJsLogBatchRaw && !isJsSeqDiagRaw && !isJsConsoleRaw && !isTickRaw)
                EnqueueUi($"[JS] {msg}"); // chỉ hiển thị UI, không ghi ra file

            try
            {
                var parseSw = Stopwatch.StartNew();
                using var doc = JsonDocument.Parse(msg);
                parseMs = parseSw.ElapsedMilliseconds;
                var root = doc.RootElement;

                if (!root.TryGetProperty("abx", out var abxEl)) return;
                var abxStr = abxEl.GetString() ?? "";
                perfAbx = abxStr;
                if (string.Equals(abxStr, "tick", StringComparison.OrdinalIgnoreCase))
                {
                    jsBuildMs = GetJsonLongLoose(root, "jsBuildMs") ?? -1;
                    jsTotalsMs = GetJsonLongLoose(root, "jsTotalsMs") ?? -1;
                    jsSeqMs = GetJsonLongLoose(root, "jsSeqMs") ?? -1;
                    jsProgMs = GetJsonLongLoose(root, "jsProgMs") ?? -1;
                    jsPerfMode = (int)(GetJsonLongLoose(root, "jsPerfMode") ?? -1);
                }

                if (abxStr == "result" && root.TryGetProperty("id", out var idEl))
                {
                    var id = idEl.GetString() ?? "";
                    string val = root.TryGetProperty("value", out var vEl) ? vEl.ToString() : root.ToString();
                    if (_jsAwaiters.TryRemove(id, out var waiter))
                        waiter.TrySetResult(val);
                    return;
                }

                if (abxStr == "cwLogBatch")
                {
                    IngestJsLogBatch(root, source);
                    return;
                }

                if (abxStr == "seq_diag")
                {
                    IngestJsSeqDiag(root, source);
                    return;
                }

                if (abxStr == "js_console")
                {
                    IngestJsConsole(root, source);
                    return;
                }

                if (abxStr == "tick")
                {
                    var jrootTick = root;
                    var snap = ParseCwSnapshotLoose(jrootTick);
                    if (snap == null)
                        return;

                    CwSnapshot? prevUiSnap;
                    lock (_snapLock) prevUiSnap = CloneSnapRaw(_lastSnap);
                    var nowUtc = DateTime.UtcNow;
                    bool isPopupPullSource = source.IndexOf("popup-pull", StringComparison.OrdinalIgnoreCase) >= 0;
                    bool isPopupFrameSource = source.IndexOf("popup-frame", StringComparison.OrdinalIgnoreCase) >= 0;
                    var uiHoldFresh = isPopupPullSource ? UiCountdownHoldFreshPopupPull : UiCountdownHoldFresh;

                    if (isPopupFrameSource && prevUiSnap != null && _lastGameTickUtc != DateTime.MinValue)
                    {
                        var prevSeq = prevUiSnap.seq ?? "";
                        var curSeq = snap.seq ?? "";
                        var prevStatus = (prevUiSnap.status ?? "").Trim();
                        var curStatus = (snap.status ?? "").Trim();
                        var prevProg = prevUiSnap.prog;
                        var curProg = snap.prog;
                        bool sameSeq = string.Equals(prevSeq, curSeq, StringComparison.Ordinal);
                        bool sameStatus = string.Equals(prevStatus, curStatus, StringComparison.OrdinalIgnoreCase);
                        bool sameProg =
                            (!prevProg.HasValue && !curProg.HasValue) ||
                            (prevProg.HasValue && curProg.HasValue && Math.Abs(prevProg.Value - curProg.Value) <= 0.35);
                        bool isBurstDuplicate = (nowUtc - _lastGameTickUtc) <= TimeSpan.FromMilliseconds(120);
                        if (sameSeq && sameStatus && sameProg && isBurstDuplicate)
                        {
                            _lastGameTickUtc = nowUtc;
                            return;
                        }
                    }

                    var prevUiFresh =
                        prevUiSnap != null &&
                        _lastGameTickUtc != DateTime.MinValue &&
                        (nowUtc - _lastGameTickUtc) <= uiHoldFresh;

                    if (snap != null)
                    {
                        string statusRaw = GetJsonStringLoose(jrootTick, "status") ?? snap.status ?? "";
                        var boardSeqDisplay = FilterResultDisplaySeq(snap.seq ?? "");
                        var boardSeqVersion = snap.seqVersion ?? 0;
                        var boardSeqEvent = snap.seqEvent ?? "";
                        lock (_roundStateLock)
                        {
                            SyncNetworkSeqFromSnapshot(snap, source, boardSeqDisplay, boardSeqVersion, boardSeqEvent, statusRaw);
                        }

                        string statusUi = BuildStatusUiText(statusRaw, snap.prog);
                        string statusUiDisplay = statusUi;
                        double? progUi = snap.prog;
                        if (prevUiFresh)
                        {
                            if (!progUi.HasValue && prevUiSnap?.prog.HasValue == true)
                                progUi = prevUiSnap.prog;

                            if (string.IsNullOrWhiteSpace(statusUiDisplay))
                            {
                                var prevStatusUi = BuildStatusUiText(prevUiSnap?.status, prevUiSnap?.prog);
                                if (!string.IsNullOrWhiteSpace(prevStatusUi))
                                    statusUiDisplay = prevStatusUi;
                            }
                        }
                        var seqDisplayRaw = snap.seq ?? "";
                        var totalsNow = snap.totals;
                        bool hasSeqData = seqDisplayRaw.Any(ch =>
                        {
                            char u = char.ToUpperInvariant(ch);
                            return u == 'B' || u == 'P' || u == 'T';
                        });
                        bool hasHudData = totalsNow != null &&
                                          (!string.IsNullOrWhiteSpace(totalsNow.N) ||
                                           totalsNow.A.HasValue);
                        bool hasProgressData = snap.prog.HasValue;
                        bool isDomStatus = statusRaw.StartsWith("Baccarat DOM", StringComparison.OrdinalIgnoreCase);
                        bool isDomWaitingStatus =
                            isDomStatus &&
                            statusRaw.IndexOf("waiting", StringComparison.OrdinalIgnoreCase) >= 0;
                        bool hasMeaningfulStatus = !string.IsNullOrWhiteSpace(statusUi) &&
                                                   !isDomStatus;
                        bool hasMeaningfulData = hasSeqData || hasHudData || hasProgressData || hasMeaningfulStatus;
                        bool isPlaceholderDomTick =
                            !hasSeqData &&
                            !hasHudData &&
                            !hasProgressData &&
                            isDomStatus;
                        bool isDomWaitingTick =
                            !hasSeqData &&
                            isDomWaitingStatus;
                        bool isEmptyTick = !hasMeaningfulData;
                        if (isDomWaitingTick)
                        {
                            _ = Dispatcher.BeginInvoke(new Action(() =>
                            {
                                try
                                {
                                    if (LblStatusText != null)
                                    {
                                        LblStatusText.Text = "";
                                        LblStatusText.Visibility = Visibility.Collapsed;
                                    }
                                }
                                catch { }
                            }));
                            return;
                        }
                        if (isPlaceholderDomTick)
                            return;
                        if (isEmptyTick)
                            return;

                        try
                        {
                            var userVal = (snap?.totals?.N ?? "").Trim();
                            if (!string.IsNullOrWhiteSpace(userVal))
                            {
                                var normalized = userVal.ToLowerInvariant();
                                _homeUsername = normalized;
                                _homeUsernameAt = DateTime.UtcNow;

                                if (_cfg != null && _cfg.LastHomeUsername != _homeUsername)
                                {
                                    _cfg.LastHomeUsername = _homeUsername;
                                    _ = SaveConfigAsync();
                                }
                            }
                        }
                        catch { }

                        try
                        {
                            string niSeqText;
                            lock (_roundStateLock)
                            {
                                double progNow = snap.prog ?? 0;
                                var seqDisplay = snap.seq ?? "";
                                var seqStr = FilterPlayableSeq(seqDisplay);
                                long seqVersionNow = snap.seqVersion ?? 0;
                                string seqEventNow = snap.seqEvent ?? "";
                                long currB = snap.totals?.B ?? 0;
                                long currP = snap.totals?.P ?? 0;
                                long currT = snap.totals?.T ?? 0;
                                LogSeqRxIfChanged(seqDisplay, snap.rawSeq, seqVersionNow, seqEventNow, snap.seqMode, snap.seqAppend, progNow, statusRaw, source);

                                bool seqVersionRegress =
                                    _lockMajorMinorUpdates &&
                                    _baseSeqVersion > 0 &&
                                    seqVersionNow > 0 &&
                                    seqVersionNow < _baseSeqVersion &&
                                    (_baseSeqVersion - seqVersionNow) >= 2 &&
                                    !string.Equals(seqDisplay, _baseSeqDisplay, StringComparison.Ordinal);
                                if (seqVersionRegress)
                                {
                                    Log($"[SEQ][VER-REGRESS] src={source} | prog={progNow:0.###} | baseLen={_baseSeqDisplay.Length} | baseVer={_baseSeqVersion} | baseEvt={(string.IsNullOrWhiteSpace(_baseSeqEvent) ? "-" : _baseSeqEvent)} | curLen={seqDisplay.Length} | curVer={seqVersionNow} | curEvt={(string.IsNullOrWhiteSpace(seqEventNow) ? "-" : seqEventNow)}");

                                    _baseSeq = seqStr;
                                    _baseSeqDisplay = seqDisplay;
                                    _baseSeqVersion = seqVersionNow;
                                    _baseSeqEvent = string.IsNullOrWhiteSpace(seqEventNow) ? "rebase-version-regress" : seqEventNow;
                                    _roundTotalsB = currB;
                                    _roundTotalsP = currP;
                                    _roundTotalsT = currT;
                                    MarkPendingRowsClosed();
                                    _lockMajorMinorUpdates = (_roundTotalsB != 0 || _roundTotalsP != 0 || _roundTotalsT != 0 || !string.IsNullOrWhiteSpace(_baseSeq));

                                    char rebasedTail = _baseSeqDisplay.Length > 0 ? _baseSeqDisplay[^1] : '-';
                                    Log($"[SEQ][REBASE] reason=version-regress | newLen={_baseSeqDisplay.Length} | newVer={_baseSeqVersion} | newEvt={(string.IsNullOrWhiteSpace(_baseSeqEvent) ? "-" : _baseSeqEvent)} | tail={rebasedTail} | lock={(_lockMajorMinorUpdates ? 1 : 0)} | pending={_pendingRows.Count} | totalsB={_roundTotalsB} | totalsP={_roundTotalsP} | totalsT={_roundTotalsT}");
                                }

                                if (_lockMajorMinorUpdates == false)
                                {
                                    bool seqChangedWhileUnlocked = !string.Equals(seqDisplay, _baseSeqDisplay, StringComparison.Ordinal);
                                    bool unlockHasAdvance = (_baseSeqVersion > 0 && seqVersionNow > 0)
                                        ? (seqVersionNow > _baseSeqVersion)
                                        : seqChangedWhileUnlocked;
                                    char unlockTail = seqDisplay.Length > 0 ? seqDisplay[^1] : '-';
                                    if (seqChangedWhileUnlocked)
                                    {
                                        Log($"[SEQ][UNLOCK] prog={progNow:0.###} | hasAdvance={(unlockHasAdvance ? 1 : 0)} | baseLen={_baseSeqDisplay.Length} | baseVer={_baseSeqVersion} | baseEvt={(string.IsNullOrWhiteSpace(_baseSeqEvent) ? "-" : _baseSeqEvent)} | curLen={seqDisplay.Length} | curVer={seqVersionNow} | curEvt={(string.IsNullOrWhiteSpace(seqEventNow) ? "-" : seqEventNow)} | curTail={unlockTail} | pending={_pendingRows.Count}");
                                    }
                                    if (progNow == 0)
                                    {
                                        string prevBaseDisplay = _baseSeqDisplay;
                                        long prevBaseVersion = _baseSeqVersion;
                                        string prevBaseEvent = _baseSeqEvent;
                                        if (seqChangedWhileUnlocked && unlockHasAdvance)
                                        {
                                            Log($"[SEQ][UNLOCK][BASE-RESET] reason=prog0-base-reset-with-advance | baseLen={prevBaseDisplay.Length} | baseVer={prevBaseVersion} | baseEvt={(string.IsNullOrWhiteSpace(prevBaseEvent) ? "-" : prevBaseEvent)} | curLen={seqDisplay.Length} | curVer={seqVersionNow} | curEvt={(string.IsNullOrWhiteSpace(seqEventNow) ? "-" : seqEventNow)} | curTail={unlockTail} | pending={_pendingRows.Count}");
                                        }
                                        _baseSeq = seqStr;
                                        _baseSeqDisplay = seqDisplay;
                                        _baseSeqVersion = seqVersionNow;
                                        _baseSeqEvent = seqEventNow;
                                        _roundTotalsB = currB;
                                        _roundTotalsP = currP;
                                        _roundTotalsT = currT;
                                        MarkPendingRowsClosed();
                                        bool baseChanged =
                                            !string.Equals(prevBaseDisplay, _baseSeqDisplay, StringComparison.Ordinal) ||
                                            prevBaseVersion != _baseSeqVersion ||
                                            !string.Equals(prevBaseEvent, _baseSeqEvent, StringComparison.Ordinal);
                                        if (baseChanged)
                                        {
                                            char baseTail = _baseSeqDisplay.Length > 0 ? _baseSeqDisplay[^1] : '-';
                                            Log($"[SEQ][BASE] reason=prog0-reset | prevLen={prevBaseDisplay.Length} | prevVer={prevBaseVersion} | prevEvt={(string.IsNullOrWhiteSpace(prevBaseEvent) ? "-" : prevBaseEvent)} | newLen={_baseSeqDisplay.Length} | newVer={_baseSeqVersion} | newEvt={(string.IsNullOrWhiteSpace(_baseSeqEvent) ? "-" : _baseSeqEvent)} | newTail={baseTail} | totalsB={_roundTotalsB} | totalsP={_roundTotalsP} | totalsT={_roundTotalsT}");
                                        }
                                        if (_roundTotalsB != 0 || _roundTotalsP != 0 || _roundTotalsT != 0 || !string.IsNullOrWhiteSpace(_baseSeq))
                                            _lockMajorMinorUpdates = true;
                                        if (_lockMajorMinorUpdates)
                                        {
                                            Log($"[SEQ][UNLOCK][LOCK-ON] reason=base-initialized | prog={progNow:0.###} | baseLen={_baseSeqDisplay.Length} | baseVer={_baseSeqVersion} | baseEvt={(string.IsNullOrWhiteSpace(_baseSeqEvent) ? "-" : _baseSeqEvent)}");
                                        }
                                    }
                                    else if (seqChangedWhileUnlocked)
                                    {
                                        Log($"[SEQ][UNLOCK][HOLD] reason=prog-not-zero | prog={progNow:0.###} | baseLen={_baseSeqDisplay.Length} | baseVer={_baseSeqVersion} | curLen={seqDisplay.Length} | curVer={seqVersionNow} | curEvt={(string.IsNullOrWhiteSpace(seqEventNow) ? "-" : seqEventNow)} | curTail={unlockTail} | pending={_pendingRows.Count}");
                                    }
                                }
                                else
                                {
                                    long settleSeqVersion = snap.seqVersion ?? 0;
                                    string settleSeqEvent = snap.seqEvent ?? "";
                                    bool seqDisplayChanged = !string.Equals(seqDisplay, _baseSeqDisplay, StringComparison.Ordinal);
                                    if (!seqDisplayChanged)
                                    {
                                        bool versionOnlyAdvance =
                                            _baseSeqVersion > 0 &&
                                            settleSeqVersion > _baseSeqVersion;
                                        if (versionOnlyAdvance && settleSeqVersion != _lastAdvanceRejectVersionOnlyVer)
                                        {
                                            var rawDisplayReject = FilterResultDisplaySeq(snap.rawSeq);
                                            Log($"[SEQ][ADVANCE-REJECT-VERSION-ONLY] rawLen={rawDisplayReject.Length} | seqLen={seqDisplay.Length} | seqVer={settleSeqVersion} | baseVer={_baseSeqVersion} | status={(string.IsNullOrWhiteSpace(statusRaw) ? "-" : Shrink(statusRaw, 48))} | src={(string.IsNullOrWhiteSpace(source) ? "-" : source)} | evt={(string.IsNullOrWhiteSpace(settleSeqEvent) ? "-" : settleSeqEvent)}");
                                            _lastAdvanceRejectVersionOnlyVer = settleSeqVersion;
                                        }
                                    }
                                    else
                                    {
                                        bool hasSeqAdvance = TryConfirmSeqAdvanceDelta(_baseSeqDisplay, seqDisplay, out int advanceDelta);
                                        char settleTail = seqDisplay.Length > 0 ? seqDisplay[^1] : '-';
                                        bool settleEventBlocked = IsBlockedSettleSeqEvent(settleSeqEvent);
                                        if (hasSeqAdvance && settleEventBlocked)
                                        {
                                            Log($"[SEQ][GATE][BLOCK] reason=blocked-event | delta={advanceDelta} | baseLen={_baseSeqDisplay.Length} | baseVer={_baseSeqVersion} | curLen={seqDisplay.Length} | curVer={settleSeqVersion} | curEvt={(string.IsNullOrWhiteSpace(settleSeqEvent) ? "-" : settleSeqEvent)} | curTail={settleTail} | pending={_pendingRows.Count}");
                                            hasSeqAdvance = false;
                                        }
                                        Log($"[SEQ][GATE] hasAdvance={(hasSeqAdvance ? 1 : 0)} | delta={advanceDelta} | baseLen={_baseSeqDisplay.Length} | baseVer={_baseSeqVersion} | baseEvt={(string.IsNullOrWhiteSpace(_baseSeqEvent) ? "-" : _baseSeqEvent)} | curLen={seqDisplay.Length} | curVer={settleSeqVersion} | curEvt={(string.IsNullOrWhiteSpace(settleSeqEvent) ? "-" : settleSeqEvent)} | curTail={settleTail} | pending={_pendingRows.Count}");
                                        if (!hasSeqAdvance)
                                        {
                                            if (_pendingRows.Count > 0)
                                            {
                                                var oldest = _pendingRows[0];
                                                if (ShouldDeferSeqNotAdvancedAlert(oldest, settleSeqEvent))
                                                {
                                                    LogHistAlertThrottled(
                                                        $"[BET][HIST][SETTLE][DEFER] reason=await-network-winner | pending={_pendingRows.Count} | oldestAt={oldest.At:HH:mm:ss} | oldestRound={oldest.IssuedRoundId} | oldestObsRound={oldest.IssuedObservedRound} | oldestIssueVer={(oldest.IssuedSeqVersion?.ToString() ?? "-")} | curVer={settleSeqVersion} | curEvt={settleSeqEvent}",
                                                        minSeconds: 10);
                                                }
                                                else
                                                {
                                                    Log($"[BET][HIST][SETTLE][SKIP] reason=seq-not-advanced | baseLen={_baseSeqDisplay.Length} | baseVer={_baseSeqVersion} | baseEvt={_baseSeqEvent} | curLen={seqDisplay.Length} | curVer={settleSeqVersion} | curEvt={settleSeqEvent}");
                                                    LogHistAlertThrottled(
                                                        $"[BET][HIST][ALERT] pending-not-settled | reason=seq-not-advanced | pending={_pendingRows.Count} | oldestAt={oldest.At:HH:mm:ss} | oldestRound={oldest.IssuedRoundId} | oldestIssueVer={(oldest.IssuedSeqVersion?.ToString() ?? "-")} | curVer={settleSeqVersion} | curEvt={settleSeqEvent}");
                                                }
                                            }
                                            else
                                            {
                                                Log($"[BET][HIST][SETTLE][SKIP] reason=seq-not-advanced | baseLen={_baseSeqDisplay.Length} | baseVer={_baseSeqVersion} | baseEvt={_baseSeqEvent} | curLen={seqDisplay.Length} | curVer={settleSeqVersion} | curEvt={settleSeqEvent}");
                                            }
                                        }
                                        else
                                        {
                                            char tail = (seqDisplay.Length > 0) ? seqDisplay[^1] : '\0';
                                            string? settledResult = tail switch
                                            {
                                                'T' => "TIE",
                                                'B' => "BANKER",
                                                'P' => "PLAYER",
                                                _ => null
                                            };
                                            Log($"[BET][HIST][SETTLE] baseLen={_baseSeqDisplay.Length} | baseVer={_baseSeqVersion} | baseEvt={_baseSeqEvent} | curLen={seqDisplay.Length} | curVer={settleSeqVersion} | curEvt={settleSeqEvent} | tail={tail} | result={settledResult ?? "-"} | pending={_pendingRows.Count}");

                                            if (string.Equals(settledResult, "TIE", StringComparison.Ordinal))
                                            {
                                                double balanceAfter = ResolveHistoryBalance(snap?.totals?.A);
                                                if (_pendingRows.Count > 0 && !HasJackpotMultiSideRunning())
                                                {
                                                    FinalizeLastBet(
                                                        "TIE",
                                                        balanceAfter,
                                                        new HashSet<string>(StringComparer.OrdinalIgnoreCase),
                                                        "TIE",
                                                        seqDisplay,
                                                        settleSeqVersion,
                                                        settleSeqEvent,
                                                        "tick-tail-change");
                                                }

                                                _lockMajorMinorUpdates = false;
                                                Log($"[SEQ][GATE][UNLOCK] reason=settled-tie | curLen={seqDisplay.Length} | curVer={settleSeqVersion} | curEvt={(string.IsNullOrWhiteSpace(settleSeqEvent) ? "-" : settleSeqEvent)} | curTail={tail} | pending={_pendingRows.Count}");
                                            }
                                            else if (string.Equals(settledResult, "BANKER", StringComparison.Ordinal) ||
                                                     string.Equals(settledResult, "PLAYER", StringComparison.Ordinal))
                                            {
                                                bool winIsBanker = string.Equals(settledResult, "BANKER", StringComparison.Ordinal);
                                                long prevB = _roundTotalsB, prevP = _roundTotalsP;
                                                char ni = winIsBanker ? ((prevB >= prevP) ? 'N' : 'I')
                                                                      : ((prevP >= prevB) ? 'N' : 'I');

                                                _niSeq.Append(ni);
                                                if (_niSeq.Length > NiSeqMax)
                                                    _niSeq.Remove(0, _niSeq.Length - NiSeqMax);

                                                Log($"[NI] add={ni} | seq={_niSeq} | tail={(winIsBanker ? 'B' : 'P')} | B={prevB} | P={prevP}");

                                                double balanceAfter = ResolveHistoryBalance(snap?.totals?.A);
                                                if (_pendingRows.Count > 0 && !HasJackpotMultiSideRunning())
                                                {
                                                    FinalizeLastBet(
                                                        winIsBanker ? "BANKER" : "PLAYER",
                                                        balanceAfter,
                                                        null,
                                                        null,
                                                        seqDisplay,
                                                        settleSeqVersion,
                                                        settleSeqEvent,
                                                        "tick-tail-change");
                                                }

                                                _lockMajorMinorUpdates = false;
                                                Log($"[SEQ][GATE][UNLOCK] reason=settled-{settledResult.ToLowerInvariant()} | curLen={seqDisplay.Length} | curVer={settleSeqVersion} | curEvt={(string.IsNullOrWhiteSpace(settleSeqEvent) ? "-" : settleSeqEvent)} | curTail={tail} | pending={_pendingRows.Count}");
                                            }
                                        }
                                    }
                                }

                                niSeqText = _niSeq.ToString();
                            }

                            snap.niSeq = niSeqText;
                        }
                        catch { }
                        lock (_roundStateLock)
                        {
                            ApplyNetworkSeqAuthorityLocked(snap);
                        }
                        lock (_snapLock) _lastSnap = snap;

                        var seqForUi = snap.seq ?? "";
                        var seqUiSig = $"{seqForUi.Length}:{(seqForUi.Length > 0 ? seqForUi[^1] : '-')}";
                        int progRounded = progUi.HasValue
                            ? (int)Math.Round(Math.Clamp(progUi.Value, 0, 100), MidpointRounding.AwayFromZero)
                            : -1;
                        bool shouldPushUi;
                        lock (_tickUiStateLock)
                        {
                            bool statusChanged = !string.Equals(_lastTickUiStatus, statusUiDisplay, StringComparison.Ordinal);
                            bool progChanged = _lastTickUiProgRounded != progRounded;
                            bool seqChanged = !string.Equals(_lastTickUiSeqSig, seqUiSig, StringComparison.Ordinal);
                            bool minGapPassed = (nowUtc - _lastTickUiDispatchUtc) >= TickUiMinDispatchGap;
                            shouldPushUi = statusChanged || progChanged || seqChanged || minGapPassed;
                            if (shouldPushUi)
                            {
                                _lastTickUiDispatchUtc = nowUtc;
                                _lastTickUiStatus = statusUiDisplay ?? "";
                                _lastTickUiProgRounded = progRounded;
                                _lastTickUiSeqSig = seqUiSig;
                            }
                        }

                        if (shouldPushUi)
                        {
                            var amountUi = snap?.totals?.A;
                            var userNameUi = (snap?.totals?.N ?? "").Trim();
                            QueueTickUiUpdate(
                                progUi,
                                statusUiDisplay ?? "",
                                seqForUi,
                                amountUi,
                                userNameUi,
                                source,
                                snap?.seqVersion ?? 0,
                                snap?.seqEvent ?? "");
                        }
                    }

                    _lastGameTickUtc = DateTime.UtcNow;
                    if ((_lastGameTickUtc - _lastTickDiagLogUtc) > TimeSpan.FromSeconds(2))
                    {
                        _lastTickDiagLogUtc = _lastGameTickUtc;
                        var seqLen = snap?.seq?.Length ?? 0;
                        var statusDiag = string.IsNullOrWhiteSpace(snap?.status) ? "-" : Shrink(snap?.status, 72);
                        var progDiag = snap?.prog?.ToString("0.###", CultureInfo.InvariantCulture) ?? "-";
                        var progSourceDiag = string.IsNullOrWhiteSpace(snap?.progSource) ? "-" : Shrink(snap?.progSource, 48);
                        var progTailDiag = string.IsNullOrWhiteSpace(snap?.progTail) ? "-" : Shrink(snap?.progTail, 96);
                        var statusSourceDiag = string.IsNullOrWhiteSpace(snap?.statusSource) ? "-" : Shrink(snap?.statusSource, 48);
                        var statusTailDiag = string.IsNullOrWhiteSpace(snap?.statusTail) ? "-" : Shrink(snap?.statusTail, 96);
                        Log($"[TickDiag] src={source} | prog={progDiag} | progSrc={progSourceDiag} | progTail={progTailDiag} | seqLen={seqLen} | statusSrc={statusSourceDiag} | statusTail={statusTailDiag} | status={statusDiag}");
                    }
                    return;
                }

                if (abxStr == "game_hint")
                {
                    var nowHint = DateTime.UtcNow;
                    _lastGameTickUtc = nowHint;
                    if ((_lastGameTickUtc - _lastGameHintDiagLogUtc) > TimeSpan.FromSeconds(2))
                    {
                        _lastGameHintDiagLogUtc = _lastGameTickUtc;
                        Log($"[TickDiag] src={source} | abx=game_hint");
                    }
                    if ((nowHint - _lastGameHintUiApplyUtc) >= GameHintUiMinGap)
                    {
                        _lastGameHintUiApplyUtc = nowHint;
                        _ = Dispatcher.BeginInvoke(new Action(() => ApplyUiMode(true)));
                    }
                    return;
                }

                if (abxStr == "bet")
                {
                    // Optimistic mode: pending row đã được tạo ngay tại PlaceBet(...).
                    // JS "bet" chỉ là ack sau confirm, không được insert thêm lần nữa
                    // nếu không sẽ tạo duplicate pending và làm finalize/history lệch.
                    return;
                }

                if (abxStr == "bet_error")
                {
                    // Optimistic mode: đã gửi bet xuống JS thì không quan tâm kết quả click DOM thật.
                    return;
                }

                if (abxStr == "confirm_diag")
                {
                    var stage = GetJsonStringLoose(root, "stage") ?? "";
                    var mode = GetJsonStringLoose(root, "mode") ?? "";
                    var source2 = GetJsonStringLoose(root, "source") ?? "";
                    var text = GetJsonStringLoose(root, "text") ?? "";
                    var hitText = GetJsonStringLoose(root, "hitText") ?? "";
                    var hitTail = GetJsonStringLoose(root, "hitTail") ?? "";
                    var attempt = GetJsonLongLoose(root, "attempt") ?? 0;
                    var shielded = GetJsonLongLoose(root, "shielded") ?? 0;
                    var settled = GetJsonLongLoose(root, "settled");
                    var expectedStake = GetJsonLongLoose(root, "expectedStake");
                    var targetStake = GetJsonLongLoose(root, "targetStake");
                    var px = GetJsonLongLoose(root, "px") ?? 0;
                    var py = GetJsonLongLoose(root, "py") ?? 0;
                    Log($"[DIAG][CONFIRM] stage={stage} attempt={attempt} mode={mode} src={source2} text={text} shielded={shielded} settled={(settled.HasValue ? settled.Value.ToString() : "-")} expectedStake={(expectedStake.HasValue ? expectedStake.Value.ToString() : "-")} targetStake={(targetStake.HasValue ? targetStake.Value.ToString() : "-")} point={px},{py} hitText={hitText} hitTail={hitTail}");
                    return;
                }

                if (abxStr == "home_tick")
                {
                    var uname = root.TryGetProperty("username", out var uEl) ? (uEl.GetString() ?? "") : "";
                    if (!string.IsNullOrWhiteSpace(uname))
                    {
                        var normalized = uname.Trim().ToLowerInvariant();
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
                    try
                    {
                        await Dispatcher.InvokeAsync(() =>
                        {
                            // Không cho phép home_tick đẩy Username/Số dư lên UI game.
                        });

                        try
                        {
                            var jsLogged = @"
(function(){
  try{
    const rm=s=>{try{return (s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[đĐ]/g,'d');}catch(_){return String(s||'').replace(/[đĐ]/g,'d');}};
    const low=s=>rm(String(s||'').trim().toLowerCase());
    const vis=el=>{if(!el)return false; const r=el.getBoundingClientRect(), cs=getComputedStyle(el);
                   return r.width>4&&r.height>4&&cs.display!=='none'&&cs.visibility!=='hidden'&&cs.pointerEvents!=='none';};
    const qa=(s,d)=>Array.from((d||document).querySelectorAll(s));

    const hasLogoutVis = qa('a,button,[role=""button""],.btn,.base-button')
        .some(el => vis(el) && /dang\\s*xuat|đăng\\s*xuất|logout|sign\\s*out/i.test(low(el.textContent)));
    const hasLoginVis = qa('a,button,[role=""button""],.btn,.base-button')
        .some(el => vis(el) && /dang\\s*nhap|đăng\\s*nhập|login|sign\\s*in/i.test(low(el.textContent)));

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
                    return;
                }
            }
            catch (Exception ex)
            {
                var preview = msg.Length > 240 ? msg[..240] : msg;
                Log($"[DIAG][MSG][ERR] src={source} err={ex.GetType().Name}: {ex.Message} preview={preview.Replace('\r', ' ').Replace('\n', ' ')}");
            }
            finally
            {
                MaybeLogPerfMessage(
                    perfAbx,
                    source,
                    msg.Length,
                    parseMs,
                    perfSw.ElapsedMilliseconds,
                    jsBuildMs,
                    jsTotalsMs,
                    jsSeqMs,
                    jsProgMs,
                    jsPerfMode);
            }
        }

        private void IngestJsLogBatch(JsonElement root, string source)
        {
            try
            {
                static string OneLine(string? s, int maxLen)
                {
                    if (string.IsNullOrWhiteSpace(s))
                        return "";
                    var t = s.Replace('\r', ' ').Replace('\n', ' ').Replace('\t', ' ').Trim();
                    return (t.Length > maxLen) ? (t.Substring(0, maxLen) + "...") : t;
                }

                static string CompactJson(JsonElement el, int maxLen)
                {
                    try
                    {
                        string raw = el.ValueKind == JsonValueKind.String
                            ? (el.GetString() ?? "")
                            : el.GetRawText();
                        return OneLine(raw, maxLen);
                    }
                    catch
                    {
                        return "";
                    }
                }

                static DateTime ReadLocalTime(long tsMs)
                {
                    if (tsMs <= 0) return DateTime.Now;
                    try { return DateTimeOffset.FromUnixTimeMilliseconds(tsMs).LocalDateTime; }
                    catch { return DateTime.Now; }
                }

                string session = root.TryGetProperty("session", out var sesEl) ? (sesEl.GetString() ?? "") : "";
                string rev = root.TryGetProperty("rev", out var revEl) ? (revEl.GetString() ?? "") : "";
                long dropped = GetJsonLongLoose(root, "dropped") ?? 0;
                int count = 0;

                if (root.TryGetProperty("items", out var itemsEl) && itemsEl.ValueKind == JsonValueKind.Array)
                {
                    foreach (var item in itemsEl.EnumerateArray())
                    {
                        count++;
                        long tsMs = GetJsonLongLoose(item, "ts") ?? 0;
                        string tag = item.TryGetProperty("tag", out var tagEl) ? (tagEl.GetString() ?? "") : "";
                        string msg = item.TryGetProperty("msg", out var msgEl) ? (msgEl.GetString() ?? "") : "";
                        string dataText = "";
                        if (item.TryGetProperty("data", out var dataEl) &&
                            dataEl.ValueKind != JsonValueKind.Null &&
                            dataEl.ValueKind != JsonValueKind.Undefined)
                        {
                            dataText = CompactJson(dataEl, 1000);
                        }

                        var localTs = ReadLocalTime(tsMs);
                        var line = $"[{localTs:HH:mm:ss.fff}] [CWDBG][{(string.IsNullOrWhiteSpace(tag) ? "-" : tag)}] {OneLine(msg, 600)}";
                        if (!string.IsNullOrWhiteSpace(dataText))
                            line += " | data=" + dataText;
                        EnqueueJsFile(line);
                    }
                }

                if (count > 0 || dropped > 0)
                {
                    var meta = $"[{DateTime.Now:HH:mm:ss.fff}] [CWDBG][BATCH] src={source} items={count} dropped={dropped}";
                    if (!string.IsNullOrWhiteSpace(session))
                        meta += " | session=" + OneLine(session, 80);
                    if (!string.IsNullOrWhiteSpace(rev))
                        meta += " | rev=" + OneLine(rev, 80);
                    EnqueueJsFile(meta);
                }
            }
            catch (Exception ex)
            {
                EnqueueJsFile($"[{DateTime.Now:HH:mm:ss.fff}] [CWDBG][INGEST_ERR] src={source} err={ex.GetType().Name}: {ex.Message}");
            }
        }

        private void IngestJsSeqDiag(JsonElement root, string source)
        {
            try
            {
                static string OneLine(string? s, int maxLen)
                {
                    if (string.IsNullOrWhiteSpace(s))
                        return "";
                    var t = s.Replace('\r', ' ').Replace('\n', ' ').Replace('\t', ' ').Trim();
                    return (t.Length > maxLen) ? (t.Substring(0, maxLen) + "...") : t;
                }

                static string CompactJson(JsonElement el, int maxLen)
                {
                    try
                    {
                        string raw = el.ValueKind == JsonValueKind.String
                            ? (el.GetString() ?? "")
                            : el.GetRawText();
                        return OneLine(raw, maxLen);
                    }
                    catch
                    {
                        return "";
                    }
                }

                string reason = GetJsonStringLoose(root, "reason") ?? "-";
                string rev = GetJsonStringLoose(root, "rev") ?? "";
                string session = GetJsonStringLoose(root, "session") ?? "";
                string dataText = "";
                if (root.TryGetProperty("data", out var dataEl) &&
                    dataEl.ValueKind != JsonValueKind.Null &&
                    dataEl.ValueKind != JsonValueKind.Undefined)
                {
                    dataText = CompactJson(dataEl, 2200);
                }

                var line = $"[JSSEQ][{OneLine(reason, 80)}] src={(string.IsNullOrWhiteSpace(source) ? "-" : source)}";
                if (!string.IsNullOrWhiteSpace(rev))
                    line += $" | rev={OneLine(rev, 80)}";
                if (!string.IsNullOrWhiteSpace(session))
                    line += $" | session={OneLine(session, 80)}";
                if (!string.IsNullOrWhiteSpace(dataText))
                    line += " | data=" + dataText;
                Log(line);
            }
            catch (Exception ex)
            {
                Log($"[JSSEQ][INGEST_ERR] src={(string.IsNullOrWhiteSpace(source) ? "-" : source)} err={ex.GetType().Name}: {ex.Message}");
            }
        }

        private void IngestJsConsole(JsonElement root, string source)
        {
            try
            {
                static string OneLine(string? s, int maxLen)
                {
                    if (string.IsNullOrWhiteSpace(s))
                        return "";
                    var t = s.Replace('\r', ' ').Replace('\n', ' ').Replace('\t', ' ').Trim();
                    return (t.Length > maxLen) ? (t.Substring(0, maxLen) + "...") : t;
                }

                string level = OneLine(GetJsonStringLoose(root, "level") ?? "log", 16);
                string message = OneLine(GetJsonStringLoose(root, "message") ?? "", 2200);
                string rev = OneLine(GetJsonStringLoose(root, "rev") ?? "", 80);
                string session = OneLine(GetJsonStringLoose(root, "session") ?? "", 80);
                if (string.IsNullOrWhiteSpace(message))
                    return;

                var line = $"[JSCONSOLE][{(string.IsNullOrWhiteSpace(level) ? "log" : level)}] src={(string.IsNullOrWhiteSpace(source) ? "-" : source)}";
                if (!string.IsNullOrWhiteSpace(rev))
                    line += $" | rev={rev}";
                if (!string.IsNullOrWhiteSpace(session))
                    line += $" | session={session}";
                line += " | " + message;
                Log(line);
            }
            catch (Exception ex)
            {
                Log($"[JSCONSOLE][INGEST_ERR] src={(string.IsNullOrWhiteSpace(source) ? "-" : source)} err={ex.GetType().Name}: {ex.Message}");
            }
        }

        private static CwSnapshot? ParseCwSnapshotLoose(JsonElement root)
        {
            try
            {
                var snap = new CwSnapshot
                {
                    abx = GetJsonStringLoose(root, "abx") ?? "",
                    prog = GetJsonDoubleLoose(root, "prog"),
                    progSource = GetJsonStringLoose(root, "progSource") ?? "",
                    progTail = GetJsonStringLoose(root, "progTail") ?? "",
                    seq = FilterResultDisplaySeqWindow(GetJsonStringLoose(root, "seq") ?? ""),
                    rawSeq = GetJsonStringLoose(root, "rawSeq") ?? "",
                    seqVersion = GetJsonLongLoose(root, "seqVersion"),
                    seqEvent = GetJsonStringLoose(root, "seqEvent") ?? "",
                    username = GetJsonStringLoose(root, "username") ?? "",
                    seqAppend = GetJsonStringLoose(root, "seqAppend") ?? "",
                    seqMode = GetJsonStringLoose(root, "seqMode") ?? "",
                    status = GetJsonStringLoose(root, "status") ?? "",
                    side = GetJsonStringLoose(root, "side") ?? "",
                    error = GetJsonStringLoose(root, "error") ?? "",
                    session = GetJsonStringLoose(root, "session") ?? "",
                    ts = GetJsonLongLoose(root, "ts") ?? 0,
                    statusSource = GetJsonStringLoose(root, "statusSource") ?? "",
                    statusTail = GetJsonStringLoose(root, "statusTail") ?? "",
                    jsBuildMs = GetJsonLongLoose(root, "jsBuildMs"),
                    jsTotalsMs = GetJsonLongLoose(root, "jsTotalsMs"),
                    jsSeqMs = GetJsonLongLoose(root, "jsSeqMs"),
                    jsProgMs = GetJsonLongLoose(root, "jsProgMs"),
                    jsPerfMode = (int?)GetJsonLongLoose(root, "jsPerfMode")
                };

                snap.prog = NormalizeProgressPercent(snap.prog, snap.progSource);

                if (root.TryGetProperty("amount", out var amountEl))
                    snap.amount = ReadJsonLongLoose(amountEl);

                if (root.TryGetProperty("totals", out var totalsEl) && totalsEl.ValueKind == JsonValueKind.Object)
                {
                    snap.totals = new CwTotals
                    {
                        B = GetJsonLongLoose(totalsEl, "B"),
                        P = GetJsonLongLoose(totalsEl, "P"),
                        T = GetJsonLongLoose(totalsEl, "T"),
                        A = GetJsonDoubleLoose(totalsEl, "A"),
                        N = GetJsonStringLoose(totalsEl, "N") ?? "",
                        SD = GetJsonLongLoose(totalsEl, "SD"),
                        TT = GetJsonLongLoose(totalsEl, "TT"),
                        T3T = GetJsonLongLoose(totalsEl, "T3T"),
                        T3D = GetJsonLongLoose(totalsEl, "T3D"),
                        TD = GetJsonLongLoose(totalsEl, "TD")
                    };
                }

                if (string.IsNullOrWhiteSpace(snap.username) && !string.IsNullOrWhiteSpace(snap.totals?.N))
                    snap.username = snap.totals.N;

                return snap;
            }
            catch
            {
                return null;
            }
        }

        private static string? GetJsonStringLoose(JsonElement root, string name)
        {
            if (!root.TryGetProperty(name, out var el))
                return null;
            return ReadJsonStringLoose(el);
        }

        private static long? GetJsonLongLoose(JsonElement root, string name)
        {
            if (!root.TryGetProperty(name, out var el))
                return null;
            return ReadJsonLongLoose(el);
        }

        private static double? GetJsonDoubleLoose(JsonElement root, string name)
        {
            if (!root.TryGetProperty(name, out var el))
                return null;
            return ReadJsonDoubleLoose(el);
        }

        private static string? ReadJsonStringLoose(JsonElement el)
        {
            return el.ValueKind switch
            {
                JsonValueKind.String => el.GetString(),
                JsonValueKind.Number => el.ToString(),
                JsonValueKind.True => "true",
                JsonValueKind.False => "false",
                _ => null
            };
        }

        private static long? ReadJsonLongLoose(JsonElement el)
        {
            var d = ReadJsonDoubleLoose(el);
            if (!d.HasValue || !double.IsFinite(d.Value))
                return null;
            try
            {
                return checked((long)Math.Round(d.Value, MidpointRounding.AwayFromZero));
            }
            catch
            {
                return null;
            }
        }

        private static double? ReadJsonDoubleLoose(JsonElement el)
        {
            try
            {
                switch (el.ValueKind)
                {
                    case JsonValueKind.Number:
                        if (el.TryGetDouble(out var num))
                            return num;
                        break;
                    case JsonValueKind.String:
                    {
                        var s = el.GetString();
                        if (TryParseLooseDouble(s, out var parsed))
                            return parsed;
                        break;
                    }
                }
            }
            catch { }
            return null;
        }

        private static bool TryParseLooseDouble(string? raw, out double value)
        {
            value = 0;
            if (string.IsNullOrWhiteSpace(raw))
                return false;

            var s = raw.Trim()
                .Replace("\u00A0", "")
                .Replace("₫", "")
                .Replace("$", "")
                .Replace("€", "")
                .Replace("£", "")
                .Replace("¥", "")
                .Replace("%", "")
                .Replace(" ", "");

            double mul = 1;
            if (s.EndsWith("K", StringComparison.OrdinalIgnoreCase))
            {
                mul = 1e3;
                s = s[..^1];
            }
            else if (s.EndsWith("M", StringComparison.OrdinalIgnoreCase))
            {
                mul = 1e6;
                s = s[..^1];
            }
            else if (s.EndsWith("B", StringComparison.OrdinalIgnoreCase))
            {
                mul = 1e9;
                s = s[..^1];
            }

            if (s.Contains(',') && s.Contains('.'))
            {
                if (s.LastIndexOf(',') > s.LastIndexOf('.'))
                    s = s.Replace(".", "").Replace(',', '.');
                else
                    s = s.Replace(",", "");
            }
            else if (s.Contains(','))
            {
                if (Regex.IsMatch(s, @"^\d+,\d{1,2}$"))
                    s = s.Replace(',', '.');
                else
                    s = s.Replace(",", "");
            }

            if (double.TryParse(s, NumberStyles.Float | NumberStyles.AllowLeadingSign, CultureInfo.InvariantCulture, out var parsed))
            {
                value = parsed * mul;
                return double.IsFinite(value);
            }

            return false;
        }

        private void PopupCore_FrameCreated_Bridge(object? sender, CoreWebView2FrameCreatedEventArgs e)
        {
            try
            {
                var f = e.Frame;
                TrackPopupFrameRef(f);
                _ = f.ExecuteScriptAsync(FRAME_SHIM);
                f.WebMessageReceived += PopupFrame_WebMessageReceived;
                f.NavigationCompleted += Frame_NavigationCompleted_Bridge;
                _ = InjectGameBridgeOnFrameIfNeededAsync(f, "frame-created-probe");
                Log("[PopupWeb] frame bridge armed.");
                ProbeFrameBridgeAsync(f, "PopupWeb", "frame-created");
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
            }
            catch (Exception ex)
            {
                Log("[PopupWeb.DOMContentLoaded] " + ex.Message);
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

        private void PopupWeb_NavigationStarting(object? sender, CoreWebView2NavigationStartingEventArgs e)
        {
            try
            {
                _betWebNavigatingSinceUtc = DateTime.UtcNow;
                var src = (e.Uri ?? "").Trim();
                var keepMainHostVisible = IsCurrentHostB8Pro07() &&
                    string.Equals(src, "about:blank", StringComparison.OrdinalIgnoreCase);
                if (!keepMainHostVisible && !IsLikelyBetGameUrl(src))
                    AutoStopTasksOnBetPipelineReset("popup-nav-start", src);
            }
            catch { }
        }

        private async void PopupWeb_NavigationCompleted(object? sender, CoreWebView2NavigationCompletedEventArgs e)
        {
            try
            {
                var src = _popupWeb?.CoreWebView2?.Source ?? "";
                var keepMainHostVisible = IsCurrentHostB8Pro07() &&
                    string.Equals(src, "about:blank", StringComparison.OrdinalIgnoreCase);
                var revealDeferredPopup = IsCurrentHostB8Pro07() &&
                    !string.IsNullOrWhiteSpace(src) &&
                    !string.Equals(src, "about:blank", StringComparison.OrdinalIgnoreCase);
                Log("[PopupWeb] NavigationCompleted: " + (e.IsSuccess ? "OK" : ("Err " + e.WebErrorStatus)) + " | " + src);
                _betWebNavigatingSinceUtc = DateTime.MinValue;
                _betWebLastNavDoneUtc = DateTime.UtcNow;
                if (TryParseProviderErrorUrl(src, out var providerStatus, out var providerDesc, out var providerExternal))
                {
                    Log("[PopupWeb][ProviderError] status=" +
                        (string.IsNullOrWhiteSpace(providerStatus) ? "-" : providerStatus) +
                        " | desc=" + (string.IsNullOrWhiteSpace(providerDesc) ? "-" : providerDesc) +
                        " | external=" + (string.IsNullOrWhiteSpace(providerExternal) ? "-" : providerExternal));
                }
                if (e.IsSuccess)
                {
                    if (keepMainHostVisible)
                    {
                        await Dispatcher.InvokeAsync(() =>
                        {
                            if (PopupHost != null)
                                PopupHost.Visibility = Visibility.Collapsed;
                            if (Web != null)
                                Web.Visibility = Visibility.Visible;
                        });
                        Log("[PopupWeb] keep main web active while popup is still about:blank on b8pro07.");
                    }
                    else
                    {
                        if (revealDeferredPopup)
                        {
                            await Dispatcher.InvokeAsync(() =>
                            {
                                if (Web != null)
                                    Web.Visibility = Visibility.Collapsed;
                                if (PopupHost != null)
                                    PopupHost.Visibility = Visibility.Visible;
                                _popupWeb?.Focus();
                            });
                            Log("[PopupWeb] reveal deferred popup on b8pro07 | " + src);
                        }
                        if (!IsLikelyBetGameUrl(src))
                        AutoStopTasksOnBetPipelineReset("popup-nav-done-non-game", src);
                    }
                    await InjectOnPopupDocAsync();
                }
            }
            catch { }
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

        private void ClosePopupHost()
        {
            try
            {
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
            _popupWebMsgHooked = false;
            _popupBridgeRegistered = false;
            _popupDevToolsOpened = false;
            _popupLastDocKey = null;
            _popupFrameRefs.Clear();
            _betWebNavigatingSinceUtc = DateTime.MinValue;
            _betWebLastNavDoneUtc = DateTime.MinValue;

            if (popupWeb == null)
                return;

            try
            {
                if (popupWeb.CoreWebView2 != null)
                {
                    popupWeb.CoreWebView2.WebMessageReceived -= CoreWebView2_WebMessageReceived;
                    popupWeb.CoreWebView2.WebResourceResponseReceived -= CoreWebView2_WebResourceResponseReceived;
                    popupWeb.CoreWebView2.NewWindowRequested -= PopupWeb_NewWindowRequested;
                    popupWeb.CoreWebView2.WindowCloseRequested -= PopupWeb_WindowCloseRequested;
                    popupWeb.CoreWebView2.FrameCreated -= PopupCore_FrameCreated_Bridge;
                    popupWeb.CoreWebView2.DOMContentLoaded -= PopupCore_DOMContentLoaded_Bridge;
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


        // Gọi Play từ HOME bằng flow C# hiện có.
        private async Task<bool> HomeClickPlayAsync()
        {
            try
            {
                var result = await ClickXocDiaTitleAsync(12000);
                Log("[HOME] play via C#: " + result);
                return string.Equals(result, "clicked", StringComparison.OrdinalIgnoreCase);
            }
            catch (Exception ex)
            {
                Log("[HOME] play click error: " + ex.Message);
                return false;
            }
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
            if (Web?.CoreWebView2 == null) return;
            await EnableCdpNetworkTapAsync(Web.CoreWebView2, "main");
        }

        private async Task EnableCdpNetworkTapAsync(CoreWebView2 core, string ownerTag)
        {
            if (core == null) return;
            if (!ShouldAttachCdpNetworkTap()) return;

            int coreHash = RuntimeHelpers.GetHashCode(core);
            bool hadOwner = _cdpTapOwnerCoreHash.TryGetValue(ownerTag, out var prevCoreHash);
            if (hadOwner && prevCoreHash == coreHash)
                return;

            bool isRebind = hadOwner && prevCoreHash != coreHash;
            long generation = Interlocked.Increment(ref _cdpTapGenerationSeed);
            _cdpTapOwners[ownerTag] = 1;
            _cdpTapOwnerCoreHash[ownerTag] = coreHash;
            _cdpTapOwnerGeneration[ownerTag] = generation;

            try
            {
                await core.CallDevToolsProtocolMethodAsync("Network.enable", "{}");
                if (string.Equals(ownerTag, "main", StringComparison.OrdinalIgnoreCase))
                    _cdpNetworkOn = true;

                var wsCreatedReceiver = core.GetDevToolsProtocolEventReceiver("Network.webSocketCreated");
                wsCreatedReceiver.DevToolsProtocolEventReceived += (s, e) =>
                {
                    try
                    {
                        if (!_cdpTapOwnerGeneration.TryGetValue(ownerTag, out var activeGeneration) || activeGeneration != generation)
                            return;

                        long wsCreatedCount = Interlocked.Increment(ref _cdpDiagWsCreated);
                        using var doc = JsonDocument.Parse(e.ParameterObjectAsJson);
                        var root = doc.RootElement;
                        var reqId = root.TryGetProperty("requestId", out var reqEl) ? (reqEl.GetString() ?? "") : "";
                        var url = root.TryGetProperty("url", out var u) ? (u.GetString() ?? "") : "";
                        if (!string.IsNullOrEmpty(reqId)) _wsUrlByRequestId[reqId] = url;
                        if (_enableCdpNetworkTap && IsInteresting(url))
                            LogPacket("WS.created/" + ownerTag, url, "", false);
                        if (wsCreatedCount % 120 == 0)
                            LogCdpDiagPulse("ws-created");
                    }
                    catch (Exception ex) { Log("[CDP wsCreated/" + ownerTag + "] " + ex.Message); }
                };

                var wsRecvReceiver = core.GetDevToolsProtocolEventReceiver("Network.webSocketFrameReceived");
                wsRecvReceiver.DevToolsProtocolEventReceived += (s, e) =>
                {
                    try
                    {
                        if (!_cdpTapOwnerGeneration.TryGetValue(ownerTag, out var activeGeneration) || activeGeneration != generation)
                            return;

                        long wsRecvCount = Interlocked.Increment(ref _cdpDiagWsRecv);
                        using var doc = JsonDocument.Parse(e.ParameterObjectAsJson);
                        var root = doc.RootElement;
                        var reqId = root.TryGetProperty("requestId", out var reqEl) ? (reqEl.GetString() ?? "") : "";
                        _wsUrlByRequestId.TryGetValue(reqId, out var url);
                        var resp = root.GetProperty("response");
                        var payload = resp.TryGetProperty("payloadData", out var pd) ? (pd.GetString() ?? "") : "";
                        var opcode = resp.TryGetProperty("opcode", out var op) ? op.GetInt32() : 1;
                        var isBin = opcode != 1;
                        ObserveNetworkGameState(payload, isBin);
                        TryProcessNetworkWinnerPacket(payload, isBin, ownerTag, url);
                        if (_enableCdpNetworkTap && ShouldLogPacketFrame("WS.recv", url, payload, isBin, out var preview, out var reason))
                            LogPacket("WS.recv/" + ownerTag + "/" + reason, url, preview, isBin);
                        if (wsRecvCount % 240 == 0)
                            LogCdpDiagPulse("ws-recv");
                    }
                    catch (Exception ex) { Log("[CDP wsRecv/" + ownerTag + "] " + ex.Message); }
                };

                var wsSendReceiver = core.GetDevToolsProtocolEventReceiver("Network.webSocketFrameSent");
                wsSendReceiver.DevToolsProtocolEventReceived += (s, e) =>
                {
                    try
                    {
                        if (!_cdpTapOwnerGeneration.TryGetValue(ownerTag, out var activeGeneration) || activeGeneration != generation)
                            return;

                        long wsSentCount = Interlocked.Increment(ref _cdpDiagWsSent);
                        using var doc = JsonDocument.Parse(e.ParameterObjectAsJson);
                        var root = doc.RootElement;
                        var reqId = root.TryGetProperty("requestId", out var reqEl) ? (reqEl.GetString() ?? "") : "";
                        _wsUrlByRequestId.TryGetValue(reqId, out var url);
                        var resp = root.GetProperty("response");
                        var payload = resp.TryGetProperty("payloadData", out var pd) ? (pd.GetString() ?? "") : "";
                        var opcode = resp.TryGetProperty("opcode", out var op) ? op.GetInt32() : 1;
                        var isBin = opcode != 1;
                        if (_enableCdpNetworkTap && ShouldLogPacketFrame("WS.send", url, payload, isBin, out var preview, out var reason))
                            LogPacket("WS.send/" + ownerTag + "/" + reason, url, preview, isBin);
                        if (wsSentCount % 240 == 0)
                            LogCdpDiagPulse("ws-send");
                    }
                    catch (Exception ex) { Log("[CDP wsSend/" + ownerTag + "] " + ex.Message); }
                };

                if (isRebind)
                    Log($"[CDP] Network tap rebound | owner={ownerTag} | oldCore={prevCoreHash} | newCore={coreHash}");

                string mode = _enableCdpNetworkTap ? "debug" : "context-only";
                Log($"[CDP] Network tap enabled | owner={ownerTag} | core={coreHash} | mode={mode}");
                LogCdpDiagPulse("tap-enabled", force: true);
            }
            catch (Exception ex)
            {
                _cdpTapOwners.TryRemove(ownerTag, out _);
                _cdpTapOwnerCoreHash.TryRemove(ownerTag, out _);
                _cdpTapOwnerGeneration.TryRemove(ownerTag, out _);
                Log("[CDP] Enable failed | owner=" + ownerTag + " | " + ex.Message);
            }
        }

        private async Task DisableCdpNetworkTapAsync()
        {
            if (!_cdpNetworkOn || Web?.CoreWebView2 == null)
            {
                _cdpTapOwners.Clear();
                _cdpTapOwnerCoreHash.Clear();
                _cdpTapOwnerGeneration.Clear();
                _wsUrlByRequestId.Clear();
                return;
            }
            try
            {
                await Web.CoreWebView2.CallDevToolsProtocolMethodAsync("Network.disable", "{}");
                _cdpNetworkOn = false;
                Log("[CDP] Network tap disabled");
            }
            catch (Exception ex) { Log("[CDP] Disable failed: " + ex.Message); }
            finally
            {
                _cdpTapOwners.Clear();
                _cdpTapOwnerCoreHash.Clear();
                _cdpTapOwnerGeneration.Clear();
                _wsUrlByRequestId.Clear();
            }
        }

        private bool IsInteresting(string? url)
        {
            if (string.IsNullOrWhiteSpace(url)) return true;
            foreach (var hint in _pktInterestingHints)
                if (url.IndexOf(hint, StringComparison.OrdinalIgnoreCase) >= 0) return true;
            return false;
        }

        private bool IsInterestingHttpUrl(string? url)
        {
            if (string.IsNullOrWhiteSpace(url)) return false;
            foreach (var hint in _httpInterestingHints)
                if (url.IndexOf(hint, StringComparison.OrdinalIgnoreCase) >= 0) return true;
            return false;
        }

        private static string Shrink(string? s, int maxLen = 1400)
        {
            var text = s ?? "";
            if (text.Length > maxLen) text = text.Substring(0, maxLen) + "…";
            return text;
        }

        private static bool LooksLikeHeartbeat(string text)
        {
            var s = (text ?? "").Trim();
            if (string.IsNullOrEmpty(s)) return true;
            if (s.Length <= 8 && (s == "2" || s == "3" || s == "40" || s == "41")) return true;
            if (string.Equals(s, "ping", StringComparison.OrdinalIgnoreCase)) return true;
            if (string.Equals(s, "pong", StringComparison.OrdinalIgnoreCase)) return true;
            if (s.IndexOf("\"ping\"", StringComparison.OrdinalIgnoreCase) >= 0) return true;
            if (s.IndexOf("\"pong\"", StringComparison.OrdinalIgnoreCase) >= 0) return true;
            return false;
        }

        private static bool IsMostlyPrintable(byte[] bytes)
        {
            if (bytes == null || bytes.Length == 0) return false;
            int printable = 0;
            int sample = Math.Min(bytes.Length, 256);
            for (int i = 0; i < sample; i++)
            {
                byte b = bytes[i];
                if (b == 9 || b == 10 || b == 13 || (b >= 32 && b <= 126))
                    printable++;
            }
            return printable >= sample * 0.8;
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

        private string PreviewPacketPayloadEx(string payload, bool isBinary)
        {
            if (string.IsNullOrEmpty(payload)) return "";
            if (!isBinary)
                return Shrink(payload.Trim(), 2000);

            try
            {
                var raw = Convert.FromBase64String(payload);
                if (IsMostlyPrintable(raw))
                    return "BIN-TXT: " + Shrink(Encoding.UTF8.GetString(raw), 2000);

                int dn = Math.Min(raw.Length, 64);
                var dsb = new StringBuilder(dn * 3);
                for (int i = 0; i < dn; i++) dsb.Append(raw[i].ToString("X2")).Append(' ');
                if (raw.Length > dn) dsb.Append("…");
                return "BIN[" + raw.Length + "]: " + dsb.ToString();
            }
            catch
            {
                return PreviewPayload(payload, isBinary);
            }
        }

        private static string FilterResultDisplaySeq(string? raw)
        {
            if (string.IsNullOrWhiteSpace(raw)) return "";
            var sb = new StringBuilder(raw.Length);
            foreach (var ch in raw)
            {
                char u = char.ToUpperInvariant(ch);
                if (u == 'B' || u == 'P' || u == 'T')
                    sb.Append(u);
            }
            return sb.ToString();
        }

        private static string KeepLastSeqWindow(string? raw, int maxLen = SeqWindowMax)
        {
            if (string.IsNullOrEmpty(raw) || maxLen <= 0)
                return "";
            return raw.Length <= maxLen ? raw : raw.Substring(raw.Length - maxLen, maxLen);
        }

        private static string FilterResultDisplaySeqWindow(string? raw) =>
            KeepLastSeqWindow(FilterResultDisplaySeq(raw), SeqWindowMax);

        private static string DecodePacketText(string payload, bool isBinary)
        {
            if (string.IsNullOrEmpty(payload)) return "";
            if (!isBinary) return payload;
            try
            {
                var raw = Convert.FromBase64String(payload);
                return Encoding.UTF8.GetString(raw);
            }
            catch
            {
                return payload;
            }
        }

        private static string? ExtractJsonPayload(string rawText)
        {
            if (string.IsNullOrWhiteSpace(rawText)) return null;
            int obj = rawText.IndexOf('{');
            int arr = rawText.IndexOf('[');
            int idx = obj >= 0 && arr >= 0 ? Math.Min(obj, arr) : Math.Max(obj, arr);
            if (idx < 0 || idx >= rawText.Length) return null;
            var json = rawText.Substring(idx).Trim();
            return string.IsNullOrWhiteSpace(json) ? null : json;
        }

        private static char? MapWinnerCodeToSeqChar(int winnerCode)
        {
            return winnerCode switch
            {
                0 => 'T',
                3 => 'T',
                1 => 'B',
                2 => 'P',
                _ => null
            };
        }

        private static string MapWinnerCharToResultText(char winnerChar)
        {
            return winnerChar switch
            {
                'B' => "BANKER",
                'P' => "PLAYER",
                'T' => "TIE",
                _ => ""
            };
        }

        private bool TryParseNetworkWinnerPacket(string payload, bool isBinary, string ownerTag, string? url, out NetworkWinnerPacket? packet)
        {
            packet = null;
            try
            {
                var rawText = DecodePacketText(payload, isBinary);
                var json = ExtractJsonPayload(rawText);
                if (string.IsNullOrWhiteSpace(json)) return false;

                using var doc = JsonDocument.Parse(json);
                var root = doc.RootElement;
                var msgType = GetJsonStringLoose(root, "messageType") ?? "";
                if (!string.Equals(msgType, "GameInfo", StringComparison.OrdinalIgnoreCase))
                    return false;

                var handler = GetJsonLongLoose(root, "handler") ?? -1;
                if (handler != 4) return false;
                if (!root.TryGetProperty("message", out var msgEl) || msgEl.ValueKind != JsonValueKind.Object)
                    return false;

                var evt = GetJsonStringLoose(msgEl, "eventType") ?? "";
                if (!string.Equals(evt, "GP_WINNER", StringComparison.OrdinalIgnoreCase))
                    return false;

                var winnerCode = (int)(GetJsonLongLoose(msgEl, "winner") ?? -1);
                var winnerChar = MapWinnerCodeToSeqChar(winnerCode);
                if (!winnerChar.HasValue)
                    return false;

                packet = new NetworkWinnerPacket
                {
                    TableId = GetJsonLongLoose(msgEl, "tableID") ?? 0,
                    GameShoe = GetJsonLongLoose(msgEl, "gameShoe") ?? 0,
                    GameRound = GetJsonLongLoose(msgEl, "gameRound") ?? 0,
                    WinnerCode = winnerCode,
                    BankerValue = (int)(GetJsonLongLoose(msgEl, "bankerHandValue") ?? -1),
                    PlayerValue = (int)(GetJsonLongLoose(msgEl, "playerHandValue") ?? -1),
                    EventType = evt,
                    OwnerTag = ownerTag ?? "",
                    Url = url ?? ""
                };
                return packet.GameRound > 0;
            }
            catch
            {
                return false;
            }
        }

        private bool TryParseObservedGameInfoPacket(string payload, bool isBinary, out long tableId, out long gameShoe, out long gameRound)
        {
            tableId = 0;
            gameShoe = 0;
            gameRound = 0;
            try
            {
                var rawText = DecodePacketText(payload, isBinary);
                var json = ExtractJsonPayload(rawText);
                if (string.IsNullOrWhiteSpace(json)) return false;

                using var doc = JsonDocument.Parse(json);
                var root = doc.RootElement;
                var msgType = GetJsonStringLoose(root, "messageType") ?? "";
                if (!string.Equals(msgType, "GameInfo", StringComparison.OrdinalIgnoreCase))
                    return false;

                var handler = GetJsonLongLoose(root, "handler") ?? -1;
                JsonElement dataEl;
                if (handler == 2)
                {
                    if (!root.TryGetProperty("tableInfo", out dataEl) || dataEl.ValueKind != JsonValueKind.Object)
                        return false;
                }
                else
                {
                    if (!root.TryGetProperty("message", out dataEl) || dataEl.ValueKind != JsonValueKind.Object)
                        return false;
                }

                tableId = GetJsonLongLoose(dataEl, "tableID") ?? 0;
                gameShoe = GetJsonLongLoose(dataEl, "gameShoe") ?? 0;
                gameRound = GetJsonLongLoose(dataEl, "gameRound") ?? 0;
                return tableId > 0 && gameShoe > 0 && gameRound > 0;
            }
            catch
            {
                return false;
            }
        }

        private void ObserveHallRoundCache(string payload, bool isBinary)
        {
            try
            {
                var rawText = DecodePacketText(payload, isBinary);
                var json = ExtractJsonPayload(rawText);
                if (string.IsNullOrWhiteSpace(json)) return;

                using var doc = JsonDocument.Parse(json);
                var root = doc.RootElement;
                var msgType = GetJsonStringLoose(root, "messageType") ?? "";
                JsonElement dataEl;

                if (string.Equals(msgType, "GameHallInfo", StringComparison.OrdinalIgnoreCase))
                {
                    var handler = GetJsonLongLoose(root, "handler") ?? -1;
                    if (handler != 1) return;
                    if (!root.TryGetProperty("message", out dataEl) || dataEl.ValueKind != JsonValueKind.Object)
                        return;
                }
                else if (string.Equals(msgType, "GameInfo", StringComparison.OrdinalIgnoreCase))
                {
                    var handler = GetJsonLongLoose(root, "handler") ?? -1;
                    if (handler == 2)
                    {
                        if (!root.TryGetProperty("tableInfo", out dataEl) || dataEl.ValueKind != JsonValueKind.Object)
                            return;
                    }
                    else if (handler == 1)
                    {
                        if (!root.TryGetProperty("message", out dataEl) || dataEl.ValueKind != JsonValueKind.Object)
                            return;
                    }
                    else
                    {
                        return;
                    }
                }
                else
                {
                    return;
                }

                var tableId = GetJsonLongLoose(dataEl, "tableID") ?? 0;
                var gameShoe = GetJsonLongLoose(dataEl, "gameShoe") ?? 0;
                var gameRound = GetJsonLongLoose(dataEl, "gameRound") ?? 0;
                if (tableId <= 0 || gameShoe <= 0 || gameRound <= 0)
                    return;

                _hallRoundCache[tableId] = new HallRoundSnapshot
                {
                    TableId = tableId,
                    GameShoe = gameShoe,
                    GameRound = gameRound,
                    SeenAtUtc = DateTime.UtcNow
                };
            }
            catch
            {
            }
        }

        private void ClearObservedContext(string reason)
        {
            long prevTableId;
            long prevGameShoe;
            long prevGameRound;
            bool hadContext;
            lock (_roundStateLock)
            {
                prevTableId = _netObservedTableId;
                prevGameShoe = _netObservedGameShoe;
                prevGameRound = _netObservedGameRound;
                hadContext = prevTableId > 0 || prevGameShoe > 0 || prevGameRound > 0;
                _netObservedTableId = 0;
                _netObservedGameShoe = 0;
                _netObservedGameRound = 0;
                _suppressJsBootstrapAfterObservedReset = false;
            }

            if (hadContext)
            {
                Log($"[NETSEQ][OBS-CLEAR] reason={reason} | prevTable={prevTableId} | prevShoe={prevGameShoe} | prevRound={prevGameRound}");
            }
        }

        private string GetCurrentBoardSeqForSyncLocked()
        {
            var boardDisplay = FilterResultDisplaySeqWindow(_boardSeqDisplay);
            if (!string.IsNullOrWhiteSpace(boardDisplay))
                return boardDisplay;

            var prefix = FilterResultDisplaySeqWindow(_syncSeqPrefixDisplay);
            var syncDisplay = FilterResultDisplaySeqWindow(_netSeqDisplay);
            if (!string.IsNullOrWhiteSpace(prefix) &&
                syncDisplay.StartsWith(prefix, StringComparison.Ordinal) &&
                syncDisplay.Length >= prefix.Length)
            {
                return syncDisplay.Substring(prefix.Length);
            }

            return syncDisplay;
        }

        private string BuildSyncSeqFromBoardLocked(string boardDisplay)
        {
            boardDisplay = FilterResultDisplaySeqWindow(boardDisplay);
            var prefix = FilterResultDisplaySeqWindow(_syncSeqPrefixDisplay);
            if (string.IsNullOrWhiteSpace(prefix))
                return boardDisplay;
            if (string.IsNullOrWhiteSpace(boardDisplay))
                return prefix;
            return KeepLastSeqWindow(prefix + boardDisplay, SeqWindowMax);
        }

        private static long ComputeNextSyncSeqVersion(long prevVersion, string prevDisplay, string nextDisplay, long suggestedVersion)
        {
            long candidate = Math.Max(suggestedVersion, nextDisplay?.Length ?? 0);
            bool changed = !string.Equals(prevDisplay ?? "", nextDisplay ?? "", StringComparison.Ordinal);
            if (!changed)
                return Math.Max(prevVersion, candidate);
            if (candidate > prevVersion)
                return candidate;
            return prevVersion + 1;
        }

        private static bool TryConfirmSeqAdvanceDelta(string baseDisplay, string currentDisplay, out int delta)
        {
            baseDisplay = FilterResultDisplaySeqWindow(baseDisplay);
            currentDisplay = FilterResultDisplaySeqWindow(currentDisplay);
            delta = 0;

            if (string.Equals(baseDisplay, currentDisplay, StringComparison.Ordinal))
                return false;
            if (string.IsNullOrWhiteSpace(currentDisplay))
                return false;
            if (string.IsNullOrWhiteSpace(baseDisplay))
            {
                delta = currentDisplay.Length;
                return delta > 0;
            }

            if (currentDisplay.Length > baseDisplay.Length &&
                currentDisplay.StartsWith(baseDisplay, StringComparison.Ordinal))
            {
                delta = currentDisplay.Length - baseDisplay.Length;
                return delta > 0;
            }

            int maxOverlap = Math.Min(baseDisplay.Length, currentDisplay.Length);
            int bestOverlap = 0;
            for (int overlap = maxOverlap; overlap >= 1; overlap--)
            {
                if (string.CompareOrdinal(baseDisplay, baseDisplay.Length - overlap, currentDisplay, 0, overlap) == 0)
                {
                    bestOverlap = overlap;
                    break;
                }
            }

            if (bestOverlap <= 0)
                return false;

            delta = currentDisplay.Length - bestOverlap;
            if (delta <= 0)
                return false;

            // Khi chuỗi đã dài, cần overlap đủ lớn để tránh coi các rewrite/rác là advance.
            int minOverlap = baseDisplay.Length >= 20 ? 3 : (baseDisplay.Length >= 8 ? 2 : 1);
            return bestOverlap >= minOverlap;
        }

        private static bool TryInferTableIdFromStatus(string? status, out long tableId)
        {
            tableId = 0;
            if (string.IsNullOrWhiteSpace(status))
                return false;

            var cMatch = Regex.Match(status, @"\bC0*(\d{1,3})\b", RegexOptions.IgnoreCase);
            if (cMatch.Success && long.TryParse(cMatch.Groups[1].Value, out var cNo) && cNo > 0)
            {
                tableId = 1000 + cNo;
                return true;
            }

            var numMatch = Regex.Match(status, @"\bBaccarat\s+(\d{1,3})\b", RegexOptions.IgnoreCase);
            if (numMatch.Success && long.TryParse(numMatch.Groups[1].Value, out var rawId) && rawId > 0)
            {
                tableId = rawId;
                return true;
            }

            return false;
        }

        private bool TryResolveObservedContextFromStatus(CwSnapshot? snap, int seqLen, out long tableId, out long gameShoe, out long gameRound, out string reason)
        {
            tableId = 0;
            gameShoe = 0;
            gameRound = 0;
            reason = "";

            if (!TryInferTableIdFromStatus(snap?.status, out var inferredTableId))
                return false;
            if (!_hallRoundCache.TryGetValue(inferredTableId, out var hall) || hall == null)
                return false;
            if (hall.GameShoe <= 0 || hall.GameRound <= 0)
                return false;
            if ((DateTime.UtcNow - hall.SeenAtUtc) > TimeSpan.FromMinutes(3))
                return false;
            if (seqLen > 0 && hall.GameRound > 0 && Math.Abs(seqLen - (int)hall.GameRound) > 2)
                return false;

            tableId = hall.TableId;
            gameShoe = hall.GameShoe;
            gameRound = hall.GameRound;
            reason = "status-hall-cache";
            return true;
        }

        private void ObserveNetworkGameState(string payload, bool isBinary)
        {
            ObserveHallRoundCache(payload, isBinary);
            if (!TryParseObservedGameInfoPacket(payload, isBinary, out var tableId, out var gameShoe, out var gameRound))
                return;
            Interlocked.Increment(ref _cdpDiagObservedPackets);
            Interlocked.Exchange(ref _cdpDiagLastObservedTicksUtc, DateTime.UtcNow.Ticks);

            bool didReset = false;
            lock (_roundStateLock)
            {
                bool tableChanged = _netObservedTableId > 0 && tableId != _netObservedTableId;
                bool shoeChanged = !tableChanged && _netObservedGameShoe > 0 && gameShoe != _netObservedGameShoe;

                _netObservedTableId = tableId;
                _netObservedGameShoe = gameShoe;
                _netObservedGameRound = gameRound;

                if (!tableChanged && !shoeChanged)
                    return;

                string resetReason = tableChanged ? "table-change" : "shoe-change";
                Log($"[NETSEQ][OBS-RESET] reason={resetReason} | table={tableId} | shoe={gameShoe} | round={gameRound} | prevTable={_netSeqTableId} | prevShoe={_netSeqGameShoe} | prevLen={_netSeqDisplay.Length} | prevVer={_netSeqVersion}");

                if (tableChanged)
                {
                    _boardSeqDisplay = "";
                    _boardSeqVersion = 0;
                    _boardSeqEvent = "";
                    _syncSeqPrefixDisplay = "";
                    _netSeqDisplay = "";
                    _netSeqVersion = 0;
                    _netSeqEvent = "net-observed-reset";
                    _netSeqSource = "";
                    _suppressJsBootstrapAfterObservedReset = true;
                }
                else
                {
                    _boardSeqDisplay = "";
                    _boardSeqVersion = 0;
                    _boardSeqEvent = "";
                    _syncSeqPrefixDisplay = _netSeqDisplay;
                    _netSeqEvent = "net-observed-shoe-reset";
                    _netSeqSource = "network";
                    _suppressJsBootstrapAfterObservedReset = false;
                }

                _netSeqTableId = tableId;
                _netSeqGameShoe = gameShoe;
                _netSeqLastRound = 0;
                _netLastWinnerKey = "";
                _baseSeqSource = "js";
                didReset = true;
            }

            if (didReset)
            {
                void Cleanup() => InvalidatePendingRowsForContextReset(tableId, gameShoe, gameRound);
                if (Dispatcher.CheckAccess()) Cleanup();
                else Dispatcher.Invoke(Cleanup);
                LogCdpDiagPulse("obs-reset", force: true);
            }
        }

        private NetworkSeqApplyResult ApplyNetworkWinnerLocked(NetworkWinnerPacket packet, CwSnapshot? currentSnap)
        {
            var result = new NetworkSeqApplyResult
            {
                TableId = packet.TableId,
                GameShoe = packet.GameShoe,
                GameRound = packet.GameRound
            };

            var winnerChar = MapWinnerCodeToSeqChar(packet.WinnerCode);
            if (!winnerChar.HasValue)
                return result;

            bool tableChanged = _netSeqTableId > 0 && packet.TableId > 0 && packet.TableId != _netSeqTableId;
            bool shoeChanged = !tableChanged && _netSeqGameShoe > 0 && packet.GameShoe > 0 && packet.GameShoe != _netSeqGameShoe;

            var currentPrefix = tableChanged ? "" : (_syncSeqPrefixDisplay ?? "");
            if (shoeChanged)
                currentPrefix = _netSeqDisplay;

            var currentDisplay = tableChanged ? "" : GetCurrentBoardSeqForSyncLocked();
            if (shoeChanged)
                currentDisplay = "";

            var snapDisplay = FilterResultDisplaySeqWindow(_boardSeqDisplay);
            if (tableChanged || shoeChanged)
                snapDisplay = "";
            if (string.IsNullOrWhiteSpace(snapDisplay))
                snapDisplay = currentDisplay;

            var currentFullDisplay = string.IsNullOrWhiteSpace(currentPrefix)
                ? currentDisplay
                : currentPrefix + currentDisplay;
            var currentVersion = Math.Max(_netSeqVersion, Math.Max(_baseSeqVersion, currentSnap?.seqVersion ?? 0));

            string nextDisplay = currentDisplay;
            string action = "dup";
            int targetLen = (int)Math.Max(0, packet.GameRound - 1);
            if (currentDisplay.Length == targetLen)
            {
                nextDisplay = currentDisplay + winnerChar.Value;
                action = "append";
            }
            else if (currentDisplay.Length < targetLen)
            {
                string baseCandidate = "";
                if (snapDisplay.Length == targetLen)
                    baseCandidate = snapDisplay;
                else if (FilterResultDisplaySeqWindow(_baseSeqDisplay).Length == targetLen)
                    baseCandidate = FilterResultDisplaySeqWindow(_baseSeqDisplay);
                else if (FilterResultDisplaySeqWindow(_netSeqDisplay).Length == targetLen)
                    baseCandidate = FilterResultDisplaySeqWindow(_netSeqDisplay);

                if (!string.IsNullOrWhiteSpace(baseCandidate))
                {
                    nextDisplay = baseCandidate + winnerChar.Value;
                    currentDisplay = baseCandidate;
                    action = "append-from-base";
                }
                else
                {
                    nextDisplay = currentDisplay + winnerChar.Value;
                    action = "append-gap";
                    result.HadGap = true;
                }
            }
            else
            {
                int idx = (int)packet.GameRound - 1;
                if (idx >= 0 && idx < currentDisplay.Length)
                {
                    if (currentDisplay[idx] == winnerChar.Value)
                    {
                        nextDisplay = currentDisplay;
                        action = "dup-round";
                    }
                    else
                    {
                        var chars = currentDisplay.ToCharArray();
                        chars[idx] = winnerChar.Value;
                        nextDisplay = new string(chars);
                        action = "replace-round";
                        result.Replaced = true;
                    }
                }
                else
                {
                    nextDisplay = currentDisplay + winnerChar.Value;
                    action = "append-overflow";
                    result.HadGap = true;
                }
            }

            long nextVersion = currentVersion;
            bool changed = !string.Equals(nextDisplay, currentDisplay, StringComparison.Ordinal);
            var nextFullDisplay = string.IsNullOrWhiteSpace(currentPrefix)
                ? nextDisplay
                : currentPrefix + nextDisplay;
            if (changed || action.StartsWith("replace", StringComparison.Ordinal))
                nextVersion = ComputeNextSyncSeqVersion(currentVersion, currentFullDisplay, nextFullDisplay, currentVersion + 1);
            else
                nextVersion = ComputeNextSyncSeqVersion(currentVersion, currentFullDisplay, nextFullDisplay, currentVersion);

            result.Changed = changed || action.StartsWith("replace", StringComparison.Ordinal);
            result.Appended = action.StartsWith("append", StringComparison.Ordinal);
            result.PrevSeq = currentFullDisplay;
            result.NextSeq = nextFullDisplay;
            result.PrevVersion = currentVersion;
            result.NextVersion = nextVersion;
            result.SeqEvent = "net-gp-winner";
            result.ResultChar = winnerChar.Value;
            result.ResultText = MapWinnerCharToResultText(winnerChar.Value);
            result.Action = action;

            _syncSeqPrefixDisplay = currentPrefix;
            _boardSeqDisplay = FilterResultDisplaySeqWindow(nextDisplay);
            _boardSeqVersion = Math.Max(_boardSeqVersion, nextDisplay.Length);
            _boardSeqEvent = result.SeqEvent;
            _netSeqDisplay = FilterResultDisplaySeqWindow(nextFullDisplay);
            _netSeqVersion = nextVersion;
            _netSeqEvent = result.SeqEvent;
            _netSeqSource = "network";
            _netSeqTableId = packet.TableId;
            _netSeqGameShoe = packet.GameShoe;
            _netSeqLastRound = packet.GameRound;
            _netObservedTableId = packet.TableId > 0 ? packet.TableId : _netObservedTableId;
            _netObservedGameShoe = packet.GameShoe > 0 ? packet.GameShoe : _netObservedGameShoe;
            _netObservedGameRound = packet.GameRound > 0 ? packet.GameRound : _netObservedGameRound;
            _suppressJsBootstrapAfterObservedReset = false;
            _netLastWinnerKey = $"{packet.TableId}|{packet.GameShoe}|{packet.GameRound}|{packet.WinnerCode}";
            _netLastWinnerAt = DateTime.UtcNow;

            _baseSeqDisplay = FilterResultDisplaySeqWindow(nextFullDisplay);
            _baseSeq = FilterPlayableSeq(nextFullDisplay);
            _baseSeqVersion = nextVersion;
            _baseSeqEvent = result.SeqEvent;
            _baseSeqSource = "network";

            return result;
        }

        private void TryProcessNetworkWinnerPacket(string payload, bool isBinary, string ownerTag, string? url)
        {
            if (!TryParseNetworkWinnerPacket(payload, isBinary, ownerTag, url, out var packet) || packet == null)
                return;
            Interlocked.Increment(ref _cdpDiagWinnerPackets);
            Interlocked.Exchange(ref _cdpDiagLastWinnerTicksUtc, DateTime.UtcNow.Ticks);

            Dispatcher.BeginInvoke(new Action(() =>
            {
                try
                {
                    var currentSnap = CloneAuthoritativeRawSnap();

                    string eventKey = $"{packet.TableId}|{packet.GameShoe}|{packet.GameRound}|{packet.WinnerCode}";
                    if (string.Equals(_netLastWinnerKey, eventKey, StringComparison.Ordinal))
                        return;

                    NetworkSeqApplyResult applied;
                    lock (_roundStateLock)
                    {
                        applied = ApplyNetworkWinnerLocked(packet, currentSnap);
                        if (string.IsNullOrWhiteSpace(applied.ResultText))
                            return;

                        var jsSeqForCompare = FilterResultDisplaySeq(currentSnap?.seq);
                        char jsTail = jsSeqForCompare.Length > 0 ? jsSeqForCompare[^1] : '-';
                        Log($"[NETSEQ][WINNER] src={packet.OwnerTag} | table={packet.TableId} | shoe={packet.GameShoe} | round={packet.GameRound} | winner={applied.ResultChar} | action={applied.Action} | prevLen={applied.PrevSeq.Length} | nextLen={applied.NextSeq.Length} | prevVer={applied.PrevVersion} | nextVer={applied.NextVersion} | jsTail={jsTail} | banker={packet.BankerValue} | player={packet.PlayerValue}");

                        double balanceAfter = ResolveHistoryBalance(currentSnap?.totals?.A);
                        if (applied.ResultChar == 'T')
                        {
                            if (_pendingRows.Count > 0 && !HasJackpotMultiSideRunning())
                            {
                                FinalizeLastBet(
                                    "TIE",
                                    balanceAfter,
                                    new HashSet<string>(StringComparer.OrdinalIgnoreCase),
                                    "TIE",
                                    applied.NextSeq,
                                    applied.NextVersion,
                                    applied.SeqEvent,
                                    "net-gp-winner",
                                    packet.TableId,
                                    packet.GameShoe,
                                    packet.GameRound);
                            }
                        }
                        else
                        {
                            bool winIsBanker = applied.ResultChar == 'B';
                            long prevB = _roundTotalsB, prevP = _roundTotalsP;
                            char ni = winIsBanker ? ((prevB >= prevP) ? 'N' : 'I')
                                                  : ((prevP >= prevB) ? 'N' : 'I');
                            _niSeq.Append(ni);
                            if (_niSeq.Length > NiSeqMax)
                                _niSeq.Remove(0, _niSeq.Length - NiSeqMax);
                            Log($"[NI] add={ni} | seq={_niSeq} | tail={applied.ResultChar} | B={prevB} | P={prevP} | source=network");

                            if (_pendingRows.Count > 0 && !HasJackpotMultiSideRunning())
                            {
                                FinalizeLastBet(
                                    applied.ResultText,
                                    balanceAfter,
                                    null,
                                    null,
                                    applied.NextSeq,
                                    applied.NextVersion,
                                    applied.SeqEvent,
                                    "net-gp-winner",
                                    packet.TableId,
                                    packet.GameShoe,
                                    packet.GameRound);
                            }
                        }

                        _lockMajorMinorUpdates = false;
                    }

                    lock (_snapLock)
                    {
                        var updated = currentSnap ?? new CwSnapshot();
                        updated.seq = FilterResultDisplaySeqWindow(applied.NextSeq);
                        updated.seqVersion = applied.NextVersion;
                        updated.seqEvent = applied.SeqEvent;
                        updated.seqSource = "network";
                        updated.niSeq = _niSeq.ToString();
                        updated.ts = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
                        _lastSnap = updated;
                    }

                    try
                    {
                        UpdateSeqUI(FilterResultDisplaySeqWindow(applied.NextSeq));
                        SetLastResultUI(applied.ResultChar.ToString());
                    }
                    catch { }
                }
                catch (Exception ex)
                {
                    Log("[NETSEQ][WINNER] " + ex.Message);
                }
            }));
        }

        private static bool IsChangingShoeStatus(string? statusRaw) =>
            !string.IsNullOrWhiteSpace(statusRaw) &&
            statusRaw.IndexOf("CHANGING SHOE", StringComparison.OrdinalIgnoreCase) >= 0;

        private static bool IsPlaceYourBetsStatus(string? statusRaw) =>
            !string.IsNullOrWhiteSpace(statusRaw) &&
            statusRaw.IndexOf("PLACE YOUR BETS", StringComparison.OrdinalIgnoreCase) >= 0;

        private static bool IsNoBoardSeqEvent(string? seqEventRaw)
        {
            var evt = seqEventRaw ?? "";
            return evt.IndexOf("shoe-reset-arm", StringComparison.OrdinalIgnoreCase) >= 0 ||
                   evt.IndexOf("board-empty", StringComparison.OrdinalIgnoreCase) >= 0 ||
                   evt.IndexOf("no-board", StringComparison.OrdinalIgnoreCase) >= 0;
        }

        private static bool IsSeedLikeSeqEvent(string? seqEventRaw)
        {
            var evt = (seqEventRaw ?? "").Trim();
            if (evt.Length == 0)
                return false;

            return
                evt.IndexOf("reset-seed", StringComparison.OrdinalIgnoreCase) >= 0 ||
                evt.IndexOf("append-reset-seed", StringComparison.OrdinalIgnoreCase) >= 0 ||
                evt.IndexOf("table-switch-wait-bead", StringComparison.OrdinalIgnoreCase) >= 0 ||
                evt.IndexOf("active-live-fallback", StringComparison.OrdinalIgnoreCase) >= 0 ||
                evt.IndexOf("hydrate-hold-managed", StringComparison.OrdinalIgnoreCase) >= 0 ||
                IsNoBoardSeqEvent(evt);
        }

        private static bool IsTrustedShortBoardBootstrapSeq(string? jsDisplayRaw, string? rawDisplayRaw, string? statusRaw, string? seqEventRaw)
        {
            var jsDisplay = FilterResultDisplaySeqWindow(jsDisplayRaw);
            var rawDisplay = FilterResultDisplaySeqWindow(rawDisplayRaw);
            if (rawDisplay.Length <= 0 || rawDisplay.Length > 3)
                return false;
            if (!string.Equals(rawDisplay, jsDisplay, StringComparison.Ordinal))
                return false;
            if (IsChangingShoeStatus(statusRaw) || IsNoBoardSeqEvent(seqEventRaw))
                return false;

            CountSeqChars(rawDisplay, out var b, out var p, out var t, out var h, out var other);
            int bp = b + p;
            if (bp <= 0 || h > 0 || other > 0)
                return false;
            if (t >= rawDisplay.Length)
                return false;
            return true;
        }

        private static bool IsTrustedBoardRawBootstrapSeq(string? jsDisplayRaw, string? rawDisplayRaw, string? statusRaw, string? seqEventRaw)
        {
            var jsDisplay = FilterResultDisplaySeqWindow(jsDisplayRaw);
            var rawDisplay = FilterResultDisplaySeqWindow(rawDisplayRaw);
            if (rawDisplay.Length <= 0 || rawDisplay.Length > 12)
                return false;
            if (IsChangingShoeStatus(statusRaw) || IsNoBoardSeqEvent(seqEventRaw))
                return false;

            CountSeqChars(rawDisplay, out var b, out var p, out var t, out var h, out var other);
            int bp = b + p;
            if (bp <= 0 || h > 0 || other > 0)
                return false;
            if (t >= rawDisplay.Length)
                return false;

            if (jsDisplay.Length == 0)
                return true;
            if (string.Equals(rawDisplay, jsDisplay, StringComparison.Ordinal))
                return true;
            return rawDisplay.StartsWith(jsDisplay, StringComparison.Ordinal);
        }

        private static string NormalizeSeqContractMode(string? seqModeRaw, string? seqEventRaw, string? seqAppendRaw)
        {
            var mode = (seqModeRaw ?? "").Trim().ToLowerInvariant();
            if (mode == "append" || mode == "full-rebase" || mode == "hold")
                return mode;

            var evt = (seqEventRaw ?? "").Trim();
            var append = FilterResultDisplaySeq(seqAppendRaw);
            if (append.Length > 0 &&
                (evt.StartsWith("append", StringComparison.OrdinalIgnoreCase) ||
                 evt.IndexOf("dom-baccarat-extend", StringComparison.OrdinalIgnoreCase) >= 0))
                return "append";

            if (evt.IndexOf("table-switch-reset", StringComparison.OrdinalIgnoreCase) >= 0 ||
                evt.IndexOf("table-switch-bead-authority", StringComparison.OrdinalIgnoreCase) >= 0 ||
                evt.IndexOf("short-board-bootstrap-authority", StringComparison.OrdinalIgnoreCase) >= 0 ||
                evt.IndexOf("hydrate-init", StringComparison.OrdinalIgnoreCase) >= 0)
                return "full-rebase";

            if (evt.Length > 0)
                return "hold";

            return "";
        }

        private static bool IsAppendSeqMode(string? mode) =>
            string.Equals((mode ?? "").Trim(), "append", StringComparison.OrdinalIgnoreCase);

        private static bool IsFullRebaseSeqMode(string? mode) =>
            string.Equals((mode ?? "").Trim(), "full-rebase", StringComparison.OrdinalIgnoreCase);

        private static bool IsBlockedSettleSeqEvent(string? seqEventRaw)
        {
            var evt = (seqEventRaw ?? "").Trim();
            if (evt.Length == 0)
                return false;

            return
                evt.IndexOf("no-change", StringComparison.OrdinalIgnoreCase) >= 0 ||
                evt.IndexOf("hold", StringComparison.OrdinalIgnoreCase) >= 0 ||
                evt.IndexOf("table-switch", StringComparison.OrdinalIgnoreCase) >= 0 ||
                evt.IndexOf("shoe-anchor", StringComparison.OrdinalIgnoreCase) >= 0 ||
                evt.IndexOf("shoe-reset-arm", StringComparison.OrdinalIgnoreCase) >= 0 ||
                evt.IndexOf("board-empty", StringComparison.OrdinalIgnoreCase) >= 0;
        }

        private void ClearTableSwitchRebaseArmLocked()
        {
            _tableSwitchRebaseArmed = false;
            _tableSwitchRebaseArmedAtUtc = DateTime.MinValue;
            _tableSwitchFromKey = "";
            _tableSwitchToKey = "";
            _tableSwitchFromHref = "";
            _tableSwitchToHref = "";
            _initialTableEnterArmed = false;
            _initialTableEnterArmedAtUtc = DateTime.MinValue;
        }

        private bool TryApplyTableSwitchRebaseLocked(
            CwSnapshot snap,
            string source,
            string statusRaw,
            string jsDisplay,
            long jsSeqVersion,
            string boardSeqEvent)
        {
            if (snap == null || !_tableSwitchRebaseArmed)
                return false;

            jsDisplay = FilterResultDisplaySeqWindow(jsDisplay);
            var rawDisplay = FilterResultDisplaySeqWindow(snap.rawSeq);
            var rebaseDisplay = "";
            bool noBoardLikeEvent = IsNoBoardSeqEvent(boardSeqEvent);
            bool changingShoeStatus = IsChangingShoeStatus(statusRaw);
            bool seedLikeEvent =
                !string.IsNullOrWhiteSpace(boardSeqEvent) &&
                (
                    boardSeqEvent.IndexOf("append-reset-seed", StringComparison.OrdinalIgnoreCase) >= 0 ||
                    boardSeqEvent.IndexOf("reset-seed", StringComparison.OrdinalIgnoreCase) >= 0 ||
                    boardSeqEvent.IndexOf("shoe-reset-arm", StringComparison.OrdinalIgnoreCase) >= 0
                );
            bool hasRawDisplay = !string.IsNullOrWhiteSpace(rawDisplay);
            bool hasJsDisplay = !string.IsNullOrWhiteSpace(jsDisplay);
            CountSeqChars(rawDisplay, out var rawB, out var rawP, out var rawT, out _, out _);
            CountSeqChars(jsDisplay, out var jsB, out var jsP, out var jsT, out _, out _);
            bool jsLongerThanRaw = hasRawDisplay && jsDisplay.Length >= (rawDisplay.Length + 2);
            bool jsCountsMismatchRaw = hasRawDisplay && hasJsDisplay &&
                                       (rawB != jsB || rawP != jsP || rawT != jsT);
            bool jsWithoutRawDuringSwitch = !hasRawDisplay && hasJsDisplay;
            if (hasRawDisplay)
                rebaseDisplay = rawDisplay;

            var netDisplay = FilterResultDisplaySeqWindow(_netSeqDisplay);

            bool totalsAllZero = (snap.totals?.B ?? 0) == 0 &&
                                 (snap.totals?.P ?? 0) == 0 &&
                                 (snap.totals?.T ?? 0) == 0;
            bool shortJsDuringNoBoard = noBoardLikeEvent && jsDisplay.Length <= 1;
            bool staleRawDuringNoBoard = shortJsDuringNoBoard && rawDisplay.Length > jsDisplay.Length;
            bool tableSwitchChangingShoeEmptyLike =
                changingShoeStatus &&
                totalsAllZero &&
                jsDisplay.Length <= 2;
            bool seedRawMismatchDuringSwitch =
                seedLikeEvent &&
                jsDisplay.Length <= 2 &&
                rawDisplay.Length >= (jsDisplay.Length + 3);
            if ((staleRawDuringNoBoard && totalsAllZero) || tableSwitchChangingShoeEmptyLike)
            {
                int prevLenWait = netDisplay.Length;
                long prevVerWait = _netSeqVersion;
                string prevEvtWait = _netSeqEvent;
                int pendingDropWait = _pendingRows.Count;
                if (pendingDropWait > 0)
                    _pendingRows.Clear();

                if (!string.IsNullOrWhiteSpace(netDisplay))
                {
                    _syncSeqPrefixDisplay = "";
                    _boardSeqDisplay = "";
                    _boardSeqVersion = Math.Max(jsSeqVersion, 0);
                    _boardSeqEvent = "table-switch-wait-bead";
                    _netSeqDisplay = "";
                    _netSeqVersion = ComputeNextSyncSeqVersion(prevVerWait, netDisplay, "", Math.Max(jsSeqVersion, prevVerWait + 1));
                    _netSeqEvent = "table-switch-wait-bead";
                    _netSeqSource = "table-switch-wait-bead";
                    _netLastWinnerKey = "";
                    _netLastWinnerAt = DateTime.MinValue;
                    _baseSeqDisplay = "";
                    _baseSeq = "";
                    _baseSeqVersion = _netSeqVersion;
                    _baseSeqEvent = _netSeqEvent;
                    _baseSeqSource = _netSeqSource;
                    _roundTotalsB = 0;
                    _roundTotalsP = 0;
                    _roundTotalsT = 0;
                    _lockMajorMinorUpdates = false;

                    string waitReason =
                        tableSwitchChangingShoeEmptyLike ? "switch-changing-shoe-empty" :
                        (staleRawDuringNoBoard ? "stale-raw-no-board" : "unknown");
                    Log($"[SEQ][TABLE-SWITCH-WAIT-BEAD] reason={waitReason} | src={(string.IsNullOrWhiteSpace(source) ? "-" : source)} | status={(string.IsNullOrWhiteSpace(statusRaw) ? "-" : Shrink(statusRaw, 48))} | evt={(string.IsNullOrWhiteSpace(boardSeqEvent) ? "-" : boardSeqEvent)} | jsLen={jsDisplay.Length} | rawLen={rawDisplay.Length} | prevLen={prevLenWait} | prevVer={prevVerWait} | prevEvt={(string.IsNullOrWhiteSpace(prevEvtWait) ? "-" : prevEvtWait)} | pendingDrop={pendingDropWait} | from={_tableSwitchFromKey} | to={_tableSwitchToKey}");
                }

                snap.seq = "";
                snap.rawSeq = "";
                snap.seqVersion = Math.Max(snap.seqVersion ?? 0, _netSeqVersion);
                snap.seqEvent = string.IsNullOrWhiteSpace(_netSeqEvent) ? "table-switch-wait-bead" : _netSeqEvent;
                snap.seqSource = "table-switch-wait-bead";
                return true;
            }

            if (jsWithoutRawDuringSwitch)
            {
                snap.seq = "";
                snap.rawSeq = "";
                snap.seqVersion = Math.Max(snap.seqVersion ?? 0, _netSeqVersion);
                snap.seqEvent = "table-switch-wait-bead";
                snap.seqSource = "table-switch-wait-bead";
                Log($"[SEQ][TABLE-SWITCH-WAIT-BEAD] reason=js-without-raw | src={(string.IsNullOrWhiteSpace(source) ? "-" : source)} | status={(string.IsNullOrWhiteSpace(statusRaw) ? "-" : Shrink(statusRaw, 48))} | evt={(string.IsNullOrWhiteSpace(boardSeqEvent) ? "-" : boardSeqEvent)} | jsLen={jsDisplay.Length} | rawLen={rawDisplay.Length} | from={_tableSwitchFromKey} | to={_tableSwitchToKey}");
                return true;
            }

            if (seedRawMismatchDuringSwitch)
            {
                Log($"[SEQ][TABLE-SWITCH-RAW-AUTHORITY] reason=seed-raw-mismatch | src={(string.IsNullOrWhiteSpace(source) ? "-" : source)} | status={(string.IsNullOrWhiteSpace(statusRaw) ? "-" : Shrink(statusRaw, 48))} | evt={(string.IsNullOrWhiteSpace(boardSeqEvent) ? "-" : boardSeqEvent)} | jsLen={jsDisplay.Length} | rawLen={rawDisplay.Length} | from={_tableSwitchFromKey} | to={_tableSwitchToKey}");
            }

            if (hasRawDisplay && hasJsDisplay && (jsLongerThanRaw || jsCountsMismatchRaw))
            {
                Log($"[SEQ][TABLE-SWITCH-RAW-AUTHORITY] reason={(jsLongerThanRaw ? "js-longer-than-raw" : "js-count-mismatch-raw")} | src={(string.IsNullOrWhiteSpace(source) ? "-" : source)} | status={(string.IsNullOrWhiteSpace(statusRaw) ? "-" : Shrink(statusRaw, 48))} | evt={(string.IsNullOrWhiteSpace(boardSeqEvent) ? "-" : boardSeqEvent)} | jsLen={jsDisplay.Length} | rawLen={rawDisplay.Length} | rawCount={BuildSeqCountText(rawDisplay, includeH: true)} | jsCount={BuildSeqCountText(jsDisplay, includeH: false)} | from={_tableSwitchFromKey} | to={_tableSwitchToKey}");
            }

            if (string.IsNullOrWhiteSpace(rebaseDisplay))
                return false;
            if (string.IsNullOrWhiteSpace(netDisplay))
            {
                return false;
            }

            bool trustedBoardRawRebase =
                hasRawDisplay &&
                seedLikeEvent &&
                IsTrustedBoardRawBootstrapSeq(jsDisplay, rawDisplay, statusRaw, boardSeqEvent);
            bool trustedBeadShortRebase =
                hasRawDisplay &&
                (!hasJsDisplay || string.Equals(rawDisplay, jsDisplay, StringComparison.Ordinal)) &&
                !jsCountsMismatchRaw &&
                !jsLongerThanRaw &&
                !changingShoeStatus &&
                !noBoardLikeEvent &&
                (
                    string.Equals(boardSeqEvent, "table-switch-bead-authority", StringComparison.OrdinalIgnoreCase) ||
                    IsTrustedShortBoardBootstrapSeq(jsDisplay, rawDisplay, statusRaw, boardSeqEvent)
                ) ||
                trustedBoardRawRebase;
            bool blockedApplyEvent =
                (IsSeedLikeSeqEvent(boardSeqEvent) && !trustedBeadShortRebase) ||
                string.Equals(boardSeqEvent, "post-reset-hold", StringComparison.OrdinalIgnoreCase);
            if (blockedApplyEvent)
            {
                snap.seq = "";
                snap.rawSeq = "";
                snap.seqVersion = Math.Max(snap.seqVersion ?? 0, _netSeqVersion);
                snap.seqEvent = "table-switch-wait-bead";
                snap.seqSource = "table-switch-wait-bead";
                return true;
            }
            if (trustedBeadShortRebase && IsSeedLikeSeqEvent(boardSeqEvent))
            {
                Log($"[SEQ][TABLE-SWITCH-BEAD-ALLOW] src={(string.IsNullOrWhiteSpace(source) ? "-" : source)} | status={(string.IsNullOrWhiteSpace(statusRaw) ? "-" : Shrink(statusRaw, 48))} | evt={(string.IsNullOrWhiteSpace(boardSeqEvent) ? "-" : boardSeqEvent)} | jsLen={jsDisplay.Length} | rawLen={rawDisplay.Length} | raw={rawDisplay} | rawCount={BuildSeqCountText(rawDisplay, includeH: true)} | reason={(trustedBoardRawRebase ? "trusted-seed-raw-board" : "trusted-short-board")} | from={_tableSwitchFromKey} | to={_tableSwitchToKey}");
            }
            else if (hasRawDisplay &&
                     hasJsDisplay &&
                     string.Equals(rawDisplay, jsDisplay, StringComparison.Ordinal) &&
                     boardSeqEvent.IndexOf("delta-queue", StringComparison.OrdinalIgnoreCase) >= 0 &&
                     !jsCountsMismatchRaw &&
                     !jsLongerThanRaw &&
                     !changingShoeStatus &&
                     !noBoardLikeEvent)
            {
                Log($"[SEQ][TABLE-SWITCH-DELTA-ALLOW] src={(string.IsNullOrWhiteSpace(source) ? "-" : source)} | status={(string.IsNullOrWhiteSpace(statusRaw) ? "-" : Shrink(statusRaw, 48))} | evt={(string.IsNullOrWhiteSpace(boardSeqEvent) ? "-" : boardSeqEvent)} | jsLen={jsDisplay.Length} | rawLen={rawDisplay.Length} | from={_tableSwitchFromKey} | to={_tableSwitchToKey}");
            }

            if (string.Equals(rebaseDisplay, netDisplay, StringComparison.Ordinal))
                return false;

            int prevLen = netDisplay.Length;
            long prevVer = _netSeqVersion;
            string prevEvt = _netSeqEvent;
            int pendingBefore = _pendingRows.Count;
            if (pendingBefore > 0)
                _pendingRows.Clear();

            _syncSeqPrefixDisplay = "";
            _boardSeqDisplay = rebaseDisplay;
            _boardSeqVersion = Math.Max(jsSeqVersion, rebaseDisplay.Length);
            _boardSeqEvent = "table-switch-reset";
            _netSeqDisplay = rebaseDisplay;
            _netSeqVersion = ComputeNextSyncSeqVersion(prevVer, netDisplay, rebaseDisplay, Math.Max(jsSeqVersion, rebaseDisplay.Length));
            _netSeqEvent = "table-switch-reset";
            _netSeqSource = "table-switch-reset";
            _netLastWinnerKey = "";
            _netLastWinnerAt = DateTime.MinValue;
            _baseSeqDisplay = rebaseDisplay;
            _baseSeq = FilterPlayableSeq(rebaseDisplay);
            _baseSeqVersion = _netSeqVersion;
            _baseSeqEvent = _netSeqEvent;
            _baseSeqSource = "table-switch-reset";
            _roundTotalsB = 0;
            _roundTotalsP = 0;
            _roundTotalsT = 0;
            _lockMajorMinorUpdates = false;

            snap.seq = rebaseDisplay;
            snap.seqVersion = _netSeqVersion;
            snap.seqEvent = _netSeqEvent;
            snap.seqSource = "table-switch-reset";

            Log($"[SEQ][TABLE-SWITCH-REBASE-APPLY] rawLen={rawDisplay.Length} | jsLen={jsDisplay.Length} | seqLen={rebaseDisplay.Length} | seqVer={_netSeqVersion} | status={(string.IsNullOrWhiteSpace(statusRaw) ? "-" : Shrink(statusRaw, 48))} | src={(string.IsNullOrWhiteSpace(source) ? "-" : source)} | evt={(string.IsNullOrWhiteSpace(boardSeqEvent) ? "-" : boardSeqEvent)} | picked={(string.Equals(rebaseDisplay, rawDisplay, StringComparison.Ordinal) ? "raw" : "js")} | prevLen={prevLen} | prevVer={prevVer} | prevEvt={(string.IsNullOrWhiteSpace(prevEvt) ? "-" : prevEvt)} | from={_tableSwitchFromKey} | to={_tableSwitchToKey} | pendingDrop={pendingBefore}");
            ClearTableSwitchRebaseArmLocked();
            return true;
        }

        private void ClearShoeChangeRebaseArmLocked()
        {
            _shoeChangeRebaseArmed = false;
            _shoeChangeStatusStreak = 0;
            _shoeChangeLastSeenUtc = DateTime.MinValue;
            _shoeChangeRebaseArmedAtUtc = DateTime.MinValue;
            _shoeChangeArmSource = "";
            _shoeChangeArmEvent = "";
        }

        private void UpdateShoeChangeRebaseArmLocked(string statusRaw, string source, string boardSeqEvent)
        {
            if (string.IsNullOrWhiteSpace(_netSeqDisplay) || _tableSwitchRebaseArmed || _initialTableEnterArmed)
                return;

            var now = DateTime.UtcNow;
            if (IsChangingShoeStatus(statusRaw))
            {
                if (_shoeChangeLastSeenUtc != DateTime.MinValue &&
                    (now - _shoeChangeLastSeenUtc) <= TimeSpan.FromSeconds(12))
                    _shoeChangeStatusStreak++;
                else
                    _shoeChangeStatusStreak = 1;

                _shoeChangeLastSeenUtc = now;
                if (!_shoeChangeRebaseArmed && _shoeChangeStatusStreak >= 2)
                {
                    _shoeChangeRebaseArmed = true;
                    _shoeChangeRebaseArmedAtUtc = now;
                    _shoeChangeArmSource = source ?? "";
                    _shoeChangeArmEvent = boardSeqEvent ?? "";
                    Log($"[SEQ][SHOE-ARM] rawLen=0 | seqLen={_netSeqDisplay.Length} | seqVer={_netSeqVersion} | status=CHANGING SHOE | src={(string.IsNullOrWhiteSpace(source) ? "-" : source)} | evt={(string.IsNullOrWhiteSpace(boardSeqEvent) ? "-" : boardSeqEvent)} | streak={_shoeChangeStatusStreak}");
                }
                return;
            }

            if (_shoeChangeLastSeenUtc != DateTime.MinValue &&
                (now - _shoeChangeLastSeenUtc) > TimeSpan.FromSeconds(20))
            {
                _shoeChangeStatusStreak = 0;
            }
        }

        private bool TryApplyShoeRebaseLocked(CwSnapshot snap, string source, string statusRaw, string boardSeqEvent)
        {
            if (snap == null || !_shoeChangeRebaseArmed)
                return false;
            if (_tableSwitchRebaseArmed || _initialTableEnterArmed)
                return false;
            if (!IsPlaceYourBetsStatus(statusRaw))
                return false;

            var rawDisplay = FilterResultDisplaySeq(snap.rawSeq);
            var netDisplay = FilterResultDisplaySeqWindow(_netSeqDisplay);
            if (string.IsNullOrWhiteSpace(netDisplay))
                return false;

            bool candidateShort = rawDisplay.Length <= 12;
            bool candidateDrop = rawDisplay.Length + 6 < netDisplay.Length;
            bool eventHint =
                (boardSeqEvent ?? "").IndexOf("shoe-reset", StringComparison.OrdinalIgnoreCase) >= 0 ||
                (boardSeqEvent ?? "").IndexOf("no-board", StringComparison.OrdinalIgnoreCase) >= 0;
            if (!(candidateShort && candidateDrop) && !eventHint)
                return false;

            int prevLen = netDisplay.Length;
            long prevVer = _netSeqVersion;
            string prevEvt = _netSeqEvent;
            string prevSrc = _netSeqSource;

            _syncSeqPrefixDisplay = netDisplay;
            _boardSeqDisplay = "";
            _boardSeqVersion = 0;
            _boardSeqEvent = "shoe-anchor-hold";
            _lastShoeRebaseAppliedUtc = DateTime.UtcNow;
            _lastShoeRebaseAppliedLen = netDisplay.Length;

            // Nghiệp vụ: CHANGING SHOE phải giữ nguyên chuỗi hiện có.
            // Khi quay lại PLACE YOUR BETS chỉ đặt mốc anchor, tuyệt đối không rebase chuỗi về raw ngắn.
            snap.seq = netDisplay;
            snap.seqVersion = Math.Max(snap.seqVersion ?? 0, _netSeqVersion);
            snap.seqEvent = string.IsNullOrWhiteSpace(_netSeqEvent) ? (snap.seqEvent ?? "") : _netSeqEvent;
            snap.seqSource = "network-hold";

            Log($"[SEQ][SHOE-ANCHOR-HOLD] rawLen={rawDisplay.Length} | seqLen={netDisplay.Length} | prefixLen={_syncSeqPrefixDisplay.Length} | seqVer={_netSeqVersion} | status=PLACE YOUR BETS | src={(string.IsNullOrWhiteSpace(source) ? "-" : source)} | prevLen={prevLen} | prevVer={prevVer} | prevEvt={(string.IsNullOrWhiteSpace(prevEvt) ? "-" : prevEvt)} | prevSrc={(string.IsNullOrWhiteSpace(prevSrc) ? "-" : prevSrc)} | armSrc={(string.IsNullOrWhiteSpace(_shoeChangeArmSource) ? "-" : _shoeChangeArmSource)} | armEvt={(string.IsNullOrWhiteSpace(_shoeChangeArmEvent) ? "-" : _shoeChangeArmEvent)}");
            ClearShoeChangeRebaseArmLocked();
            return true;
        }

        private bool TryApplyJsAppendContractLocked(
            CwSnapshot snap,
            string source,
            string statusRaw,
            string boardSeqEvent,
            string seqMode,
            string seqAppend,
            long jsSeqVersion,
            string reason)
        {
            if (snap == null || !IsAppendSeqMode(seqMode))
                return false;

            var delta = FilterResultDisplaySeq(seqAppend);
            if (string.IsNullOrWhiteSpace(delta))
            {
                Log($"[NETSEQ][APPEND-SKIP] reason=empty-delta | src={(string.IsNullOrWhiteSpace(source) ? "-" : source)} | mode={(string.IsNullOrWhiteSpace(seqMode) ? "-" : seqMode)} | evt={(string.IsNullOrWhiteSpace(boardSeqEvent) ? "-" : boardSeqEvent)} | rawAppend={(string.IsNullOrWhiteSpace(seqAppend) ? "-" : Shrink(seqAppend, 40))}");
                return false;
            }

            if (delta.Length > 8)
            {
                snap.seq = FilterResultDisplaySeqWindow(_netSeqDisplay);
                snap.seqVersion = Math.Max(snap.seqVersion ?? 0, _netSeqVersion);
                snap.seqEvent = string.IsNullOrWhiteSpace(_netSeqEvent) ? (snap.seqEvent ?? "") : _netSeqEvent;
                snap.seqSource = "network-hold";
                Log($"[NETSEQ][APPEND-REJECT] reason=delta-too-long | src={(string.IsNullOrWhiteSpace(source) ? "-" : source)} | mode={seqMode} | deltaLen={delta.Length} | delta={Shrink(delta, 40)} | netLen={_netSeqDisplay.Length} | netVer={_netSeqVersion} | evt={(string.IsNullOrWhiteSpace(boardSeqEvent) ? "-" : boardSeqEvent)} | status={(string.IsNullOrWhiteSpace(statusRaw) ? "-" : Shrink(statusRaw, 48))}");
                return true;
            }

            var prevDisplay = FilterResultDisplaySeqWindow(_netSeqDisplay);
            var nextDisplay = FilterResultDisplaySeqWindow(prevDisplay + delta);
            var prevVer = _netSeqVersion;
            _netSeqDisplay = nextDisplay;
            _netSeqVersion = ComputeNextSyncSeqVersion(prevVer, prevDisplay, nextDisplay, Math.Max(jsSeqVersion, prevVer + delta.Length));
            _netSeqEvent = string.IsNullOrWhiteSpace(boardSeqEvent) ? "js-append" : "js-append-" + boardSeqEvent;
            _netSeqSource = "js-append";

            snap.seq = FilterResultDisplaySeqWindow(_netSeqDisplay);
            snap.seqVersion = _netSeqVersion;
            snap.seqEvent = _netSeqEvent;
            snap.seqSource = _netSeqSource;

            Log($"[NETSEQ][APPEND] reason={(string.IsNullOrWhiteSpace(reason) ? "-" : reason)} | src={(string.IsNullOrWhiteSpace(source) ? "-" : source)} | mode={seqMode} | delta={delta} | prevLen={prevDisplay.Length} | netLen={_netSeqDisplay.Length} | prevVer={prevVer} | netVer={_netSeqVersion} | evt={(string.IsNullOrWhiteSpace(boardSeqEvent) ? "-" : boardSeqEvent)} | status={(string.IsNullOrWhiteSpace(statusRaw) ? "-" : Shrink(statusRaw, 48))}");
            return true;
        }

        private void SyncNetworkSeqFromSnapshot(CwSnapshot snap, string source, string boardDisplay, long boardSeqVersion, string boardSeqEvent, string statusRaw)
        {
            if (snap == null) return;
            var jsDisplay = FilterResultDisplaySeqWindow(boardDisplay);
            var jsSeqVersion = Math.Max(boardSeqVersion, jsDisplay.Length);
            var prevBoardDisplay = _boardSeqDisplay;
            var prevBoardVersion = _boardSeqVersion;
            var incomingBoardEvent = boardSeqEvent ?? "";
            var rawDisplayInput = FilterResultDisplaySeqWindow(snap.rawSeq);
            var seqMode = NormalizeSeqContractMode(snap.seqMode, incomingBoardEvent, snap.seqAppend);
            var seqAppend = FilterResultDisplaySeq(snap.seqAppend);

            Log($"[SEQ][AUTH] src={(string.IsNullOrWhiteSpace(source) ? "-" : source)} | evt={(string.IsNullOrWhiteSpace(incomingBoardEvent) ? "-" : incomingBoardEvent)} | mode={(string.IsNullOrWhiteSpace(seqMode) ? "-" : seqMode)} | append={(string.IsNullOrWhiteSpace(seqAppend) ? "-" : seqAppend)} | seqLen={jsDisplay.Length} | rawLen={rawDisplayInput.Length} | netLen={_netSeqDisplay.Length} | netVer={_netSeqVersion} | tableSwitchArm={(_tableSwitchRebaseArmed ? 1 : 0)} | initialEnter={(_initialTableEnterArmed ? 1 : 0)}");

            UpdateShoeChangeRebaseArmLocked(statusRaw, source, incomingBoardEvent);
            if (TryApplyTableSwitchRebaseLocked(snap, source, statusRaw, jsDisplay, jsSeqVersion, incomingBoardEvent))
                return;
            if (TryApplyShoeRebaseLocked(snap, source, statusRaw, incomingBoardEvent))
                return;
            bool noBoardLikeIncoming = IsNoBoardSeqEvent(incomingBoardEvent);
            bool jsRawLargeGap =
                !string.IsNullOrWhiteSpace(jsDisplay) &&
                rawDisplayInput.Length > 0 &&
                jsDisplay.Length > (rawDisplayInput.Length + 2);
            if (jsRawLargeGap && !noBoardLikeIncoming)
            {
                Log($"[NETSEQ][RAW-AUTHORITY] src={source} | reason=js-ahead-of-raw | jsLen={jsDisplay.Length} | rawLen={rawDisplayInput.Length} | evt={(string.IsNullOrWhiteSpace(incomingBoardEvent) ? "-" : incomingBoardEvent)} | status={(string.IsNullOrWhiteSpace(statusRaw) ? "-" : Shrink(statusRaw, 48))}");
                jsDisplay = rawDisplayInput;
                jsSeqVersion = Math.Max(0, jsDisplay.Length);
                incomingBoardEvent = string.IsNullOrWhiteSpace(incomingBoardEvent) ? "raw-authority" : ("raw-authority-" + incomingBoardEvent);
            }

            if (string.IsNullOrWhiteSpace(jsDisplay))
            {
                bool transientNoBoardEvent = IsNoBoardSeqEvent(incomingBoardEvent);

                if (_tableSwitchRebaseArmed || _initialTableEnterArmed)
                {
                    snap.seq = "";
                    snap.rawSeq = "";
                    snap.seqVersion = Math.Max(snap.seqVersion ?? 0, _netSeqVersion);
                    snap.seqEvent = "table-switch-wait-bead";
                    snap.seqSource = "table-switch-wait-bead";
                    Log($"[NETSEQ][TABLE-SWITCH-HOLD-EMPTY] src={(string.IsNullOrWhiteSpace(source) ? "-" : source)} | evt={(string.IsNullOrWhiteSpace(incomingBoardEvent) ? "-" : incomingBoardEvent)} | mode={(string.IsNullOrWhiteSpace(seqMode) ? "-" : seqMode)} | oldNetLen={_netSeqDisplay.Length} | oldNetVer={_netSeqVersion} | reason=wait-new-table-bead");
                    return;
                }

                // Guard: no-board transient (trong lúc chia bài/DOM chưa ổn) không được kéo snap.seq về rỗng.
                // Nếu đã có network authority thì giữ authority để không mất nhịp ván đầu.
                if (!string.IsNullOrWhiteSpace(_netSeqDisplay))
                {
                    snap.seq = FilterResultDisplaySeqWindow(_netSeqDisplay);
                    snap.seqVersion = Math.Max(snap.seqVersion ?? 0, _netSeqVersion);
                    snap.seqEvent = string.IsNullOrWhiteSpace(_netSeqEvent) ? (snap.seqEvent ?? "") : _netSeqEvent;
                    snap.seqSource = "network-hold";
                    if (transientNoBoardEvent)
                    {
                        Log($"[NETSEQ][JS-EMPTY-HOLD] src={source} | jsEvt={(string.IsNullOrWhiteSpace(incomingBoardEvent) ? "-" : incomingBoardEvent)} | netLen={_netSeqDisplay.Length} | netVer={_netSeqVersion}");
                    }
                    return;
                }

                // Chưa có authority thì không overwrite board state cũ bằng tick rỗng.
                _boardSeqDisplay = "";
                _boardSeqVersion = 0;
                if (!string.IsNullOrWhiteSpace(incomingBoardEvent))
                    _boardSeqEvent = incomingBoardEvent;
                return;
            }

            if (string.IsNullOrWhiteSpace(_netSeqDisplay))
            {
                bool seedLikeEvent = IsSeedLikeSeqEvent(incomingBoardEvent);
                bool changingShoeNow = IsChangingShoeStatus(statusRaw);
                var rawDisplayBoot = FilterResultDisplaySeqWindow(snap.rawSeq);
                bool enteringNewTable = _tableSwitchRebaseArmed || _initialTableEnterArmed;
                bool holdEmptyForChangingShoe = changingShoeNow;
                bool holdEmptyForMissingRaw = rawDisplayBoot.Length == 0 && !noBoardLikeIncoming;
                bool trustedShortRawBootstrap =
                    (
                        rawDisplayBoot.Length > 0 &&
                        string.Equals(rawDisplayBoot, jsDisplay, StringComparison.Ordinal) &&
                        !changingShoeNow &&
                        !noBoardLikeIncoming &&
                        string.Equals(incomingBoardEvent, "table-switch-bead-authority", StringComparison.OrdinalIgnoreCase)
                    ) ||
                    IsTrustedShortBoardBootstrapSeq(jsDisplay, rawDisplayBoot, statusRaw, incomingBoardEvent) ||
                    (seedLikeEvent && IsTrustedBoardRawBootstrapSeq(jsDisplay, rawDisplayBoot, statusRaw, incomingBoardEvent));
                bool holdEmptyForSeedLikeBootstrap =
                    seedLikeEvent &&
                    rawDisplayBoot.Length > 2 &&
                    !trustedShortRawBootstrap;
                bool blockedBootstrapEvent =
                    (seedLikeEvent && !trustedShortRawBootstrap) ||
                    string.Equals(incomingBoardEvent, "post-reset-hold", StringComparison.OrdinalIgnoreCase);
                bool rawStableEnough = (rawDisplayBoot.Length >= 4 || trustedShortRawBootstrap) && !changingShoeNow;
                bool suspiciousNoChangeBootstrap =
                    string.Equals(incomingBoardEvent, "no-change", StringComparison.OrdinalIgnoreCase) &&
                    enteringNewTable &&
                    rawDisplayBoot.Length > 0 &&
                    !trustedShortRawBootstrap;

                if (holdEmptyForChangingShoe || holdEmptyForSeedLikeBootstrap || holdEmptyForMissingRaw ||
                    (enteringNewTable && !rawStableEnough) || blockedBootstrapEvent || suspiciousNoChangeBootstrap)
                {
                    string bootSkipReason = holdEmptyForChangingShoe
                        ? "changing-shoe-hold-empty"
                        : (holdEmptyForSeedLikeBootstrap ? "seed-like-bootstrap-block"
                            : (holdEmptyForMissingRaw ? "raw-missing-empty-net"
                                : (suspiciousNoChangeBootstrap ? "no-change-after-reset"
                                    : (blockedBootstrapEvent ? "blocked-bootstrap-event" : "new-table-wait-stable-raw"))));
                    Log($"[NETSEQ][BOOT][SKIP] src={source} | len={jsDisplay.Length} | rawLen={rawDisplayBoot.Length} | evt={(string.IsNullOrWhiteSpace(incomingBoardEvent) ? "-" : incomingBoardEvent)} | status={(string.IsNullOrWhiteSpace(statusRaw) ? "-" : Shrink(statusRaw, 48))} | reason={bootSkipReason}");
                    snap.seq = "";
                    snap.rawSeq = "";
                    snap.seqVersion = Math.Max(snap.seqVersion ?? 0, _netSeqVersion);
                    snap.seqEvent = string.IsNullOrWhiteSpace(_netSeqEvent) ? "table-switch-wait-bead" : _netSeqEvent;
                    snap.seqSource = "table-switch-wait-bead";
                    return;
                }
                if (trustedShortRawBootstrap && seedLikeEvent)
                {
                    Log($"[NETSEQ][BOOT][ALLOW-SHORT-RAW] src={source} | len={jsDisplay.Length} | rawLen={rawDisplayBoot.Length} | raw={rawDisplayBoot} | rawCount={BuildSeqCountText(rawDisplayBoot, includeH: true)} | evt={(string.IsNullOrWhiteSpace(incomingBoardEvent) ? "-" : incomingBoardEvent)} | mode={(string.IsNullOrWhiteSpace(seqMode) ? "-" : seqMode)} | append={(string.IsNullOrWhiteSpace(seqAppend) ? "-" : seqAppend)} | status={(string.IsNullOrWhiteSpace(statusRaw) ? "-" : Shrink(statusRaw, 48))} | reason={(rawDisplayBoot.Length > 3 ? "trusted-seed-raw-board" : "trusted-short-board")}");
                }

                bool hasObservedContext = _netObservedTableId > 0 && _netObservedGameShoe > 0 && _netObservedGameRound > 0;
                bool isTableSwitchResetEvent = !string.IsNullOrWhiteSpace(incomingBoardEvent) &&
                    incomingBoardEvent.IndexOf("table-switch-reset", StringComparison.OrdinalIgnoreCase) >= 0;
                bool jsLooksAheadOfObservedRound = hasObservedContext && jsDisplay.Length > _netObservedGameRound;
                if (_suppressJsBootstrapAfterObservedReset &&
                    (isTableSwitchResetEvent || !hasObservedContext || jsLooksAheadOfObservedRound))
                {
                    Log($"[NETSEQ][BOOT][SKIP] src={source} | len={jsDisplay.Length} | evt={(string.IsNullOrWhiteSpace(incomingBoardEvent) ? "-" : incomingBoardEvent)} | obsTable={_netObservedTableId} | obsShoe={_netObservedGameShoe} | obsRound={_netObservedGameRound} | reason=observed-reset-guard");
                    return;
                }

                string bootDisplay = rawDisplayBoot;
                _netSeqDisplay = FilterResultDisplaySeqWindow(bootDisplay);
                _netSeqVersion = ComputeNextSyncSeqVersion(_netSeqVersion, "", _netSeqDisplay, Math.Max(_baseSeqVersion, Math.Max(jsSeqVersion, _netSeqDisplay.Length)));
                _netSeqEvent = string.IsNullOrWhiteSpace(incomingBoardEvent) ? "js-bootstrap" : "js-" + incomingBoardEvent;
                _netSeqSource = "js-bootstrap";
                _suppressJsBootstrapAfterObservedReset = false;
                _initialTableEnterArmed = false;
                _initialTableEnterArmedAtUtc = DateTime.MinValue;
                if (_shoeChangeRebaseArmed && !seedLikeEvent)
                {
                    Log($"[SEQ][SHOE-ARM] rawLen={rawDisplayBoot.Length} | seqLen={_netSeqDisplay.Length} | seqVer={_netSeqVersion} | status={(string.IsNullOrWhiteSpace(statusRaw) ? "-" : Shrink(statusRaw, 48))} | src={(string.IsNullOrWhiteSpace(source) ? "-" : source)} | evt={(string.IsNullOrWhiteSpace(incomingBoardEvent) ? "-" : incomingBoardEvent)} | action=clear-on-bootstrap");
                    ClearShoeChangeRebaseArmLocked();
                }
                Log($"[NETSEQ][BOOT] src={source} | boardLen={jsDisplay.Length} | rawLen={rawDisplayBoot.Length} | syncLen={_netSeqDisplay.Length} | ver={_netSeqVersion} | evt={_netSeqEvent} | picked=raw");
                snap.seq = FilterResultDisplaySeqWindow(_netSeqDisplay);
                snap.rawSeq = rawDisplayBoot;
                snap.seqVersion = _netSeqVersion;
                snap.seqEvent = _netSeqEvent;
                snap.seqSource = _netSeqSource;
                return;
            }

            _boardSeqDisplay = jsDisplay;
            _boardSeqVersion = jsSeqVersion;
            _boardSeqEvent = incomingBoardEvent;

            bool hasShoeAnchorForContract =
                !string.IsNullOrWhiteSpace(_syncSeqPrefixDisplay) ||
                _shoeChangeRebaseArmed;
            bool hasAuthoritativeSeq = !string.IsNullOrWhiteSpace(_netSeqDisplay);

            if (hasAuthoritativeSeq && hasShoeAnchorForContract)
            {
                if (TryApplyJsAppendContractLocked(snap, source, statusRaw, incomingBoardEvent, seqMode, seqAppend, jsSeqVersion, "shoe-anchor"))
                    return;

                snap.seq = FilterResultDisplaySeqWindow(_netSeqDisplay);
                snap.seqVersion = Math.Max(snap.seqVersion ?? 0, _netSeqVersion);
                snap.seqEvent = string.IsNullOrWhiteSpace(_netSeqEvent) ? (snap.seqEvent ?? "") : _netSeqEvent;
                snap.seqSource = "network-hold";
                Log($"[NETSEQ][SHOE-HOLD-NO-DELTA] src={(string.IsNullOrWhiteSpace(source) ? "-" : source)} | mode={(string.IsNullOrWhiteSpace(seqMode) ? "-" : seqMode)} | append={(string.IsNullOrWhiteSpace(seqAppend) ? "-" : seqAppend)} | boardLen={jsDisplay.Length} | rawLen={rawDisplayInput.Length} | netLen={_netSeqDisplay.Length} | netVer={_netSeqVersion} | evt={(string.IsNullOrWhiteSpace(incomingBoardEvent) ? "-" : incomingBoardEvent)} | status={(string.IsNullOrWhiteSpace(statusRaw) ? "-" : Shrink(statusRaw, 48))}");
                return;
            }

            if (hasAuthoritativeSeq)
            {
                if (TryApplyJsAppendContractLocked(snap, source, statusRaw, incomingBoardEvent, seqMode, seqAppend, jsSeqVersion, "contract"))
                    return;

                if (!IsFullRebaseSeqMode(seqMode))
                {
                    snap.seq = FilterResultDisplaySeqWindow(_netSeqDisplay);
                    snap.seqVersion = Math.Max(snap.seqVersion ?? 0, _netSeqVersion);
                    snap.seqEvent = string.IsNullOrWhiteSpace(_netSeqEvent) ? (snap.seqEvent ?? "") : _netSeqEvent;
                    snap.seqSource = string.IsNullOrWhiteSpace(_netSeqSource) ? "network-hold" : _netSeqSource;
                    Log($"[NETSEQ][CONTRACT-HOLD] src={(string.IsNullOrWhiteSpace(source) ? "-" : source)} | mode={(string.IsNullOrWhiteSpace(seqMode) ? "-" : seqMode)} | append={(string.IsNullOrWhiteSpace(seqAppend) ? "-" : seqAppend)} | boardLen={jsDisplay.Length} | rawLen={rawDisplayInput.Length} | netLen={_netSeqDisplay.Length} | netVer={_netSeqVersion} | evt={(string.IsNullOrWhiteSpace(incomingBoardEvent) ? "-" : incomingBoardEvent)} | reason=no-explicit-delta");
                    return;
                }

                snap.seq = FilterResultDisplaySeqWindow(_netSeqDisplay);
                snap.seqVersion = Math.Max(snap.seqVersion ?? 0, _netSeqVersion);
                snap.seqEvent = string.IsNullOrWhiteSpace(_netSeqEvent) ? (snap.seqEvent ?? "") : _netSeqEvent;
                snap.seqSource = string.IsNullOrWhiteSpace(_netSeqSource) ? "network-hold" : _netSeqSource;
                Log($"[NETSEQ][FULL-REBASE-IGNORED] src={(string.IsNullOrWhiteSpace(source) ? "-" : source)} | mode={seqMode} | boardLen={jsDisplay.Length} | rawLen={rawDisplayInput.Length} | netLen={_netSeqDisplay.Length} | netVer={_netSeqVersion} | evt={(string.IsNullOrWhiteSpace(incomingBoardEvent) ? "-" : incomingBoardEvent)} | reason=not-table-switch");
                return;
            }

            var combinedDisplay = BuildSyncSeqFromBoardLocked(jsDisplay);
            bool boardChanged = !string.Equals(jsDisplay, prevBoardDisplay, StringComparison.Ordinal);
            bool combinedChanged = !string.Equals(combinedDisplay, _netSeqDisplay, StringComparison.Ordinal);
            bool combinedLonger = combinedDisplay.Length > _netSeqDisplay.Length;
            bool boardVersionAhead = jsSeqVersion > prevBoardVersion;
            bool combinedSameLen = combinedDisplay.Length == _netSeqDisplay.Length;
            var rawDisplayNow = FilterResultDisplaySeqWindow(snap.rawSeq);
            var rawCombinedDisplay = BuildSyncSeqFromBoardLocked(rawDisplayNow);
            bool shoePrefixAppendMode =
                !string.IsNullOrWhiteSpace(_syncSeqPrefixDisplay) &&
                rawDisplayNow.Length > 0 &&
                FilterResultDisplaySeqWindow(_syncSeqPrefixDisplay).Length >= (rawDisplayNow.Length + 6) &&
                string.Equals(combinedDisplay, rawCombinedDisplay, StringComparison.Ordinal);
            bool sameLenBoardAdvanceSignal =
                combinedSameLen &&
                boardVersionAhead &&
                (boardChanged || !string.Equals(incomingBoardEvent ?? "", "no-change", StringComparison.OrdinalIgnoreCase));
            bool appendConfirmed = TryConfirmSeqAdvanceDelta(_netSeqDisplay, combinedDisplay, out int appendDelta);
            bool sameLenAppendConfirmed = combinedSameLen && appendConfirmed && appendDelta > 0;
            if (!string.IsNullOrWhiteSpace(_syncSeqPrefixDisplay) && rawDisplayNow.Length > 0 && !shoePrefixAppendMode)
            {
                bool sameCombinedAsNet = string.Equals(combinedDisplay, _netSeqDisplay, StringComparison.Ordinal);
                bool sameRawCombinedAsNet = string.Equals(rawCombinedDisplay, _netSeqDisplay, StringComparison.Ordinal);
                if (!sameCombinedAsNet || !sameRawCombinedAsNet || boardVersionAhead)
                {
                    Log($"[NETSEQ][SHOE-PREFIX-BLOCK] src={source} | boardLen={jsDisplay.Length} | rawLen={rawDisplayNow.Length} | combinedLen={combinedDisplay.Length} | rawCombinedLen={rawCombinedDisplay.Length} | netLen={_netSeqDisplay.Length} | netVer={_netSeqVersion} | boardVer={jsSeqVersion} | boardChanged={(boardChanged ? 1 : 0)} | verAhead={(boardVersionAhead ? 1 : 0)} | evt={(string.IsNullOrWhiteSpace(incomingBoardEvent) ? "-" : incomingBoardEvent)}");
                }
            }
            bool jsRawMismatchHold =
                rawDisplayNow.Length > 0 &&
                combinedDisplay.Length > (rawDisplayNow.Length + 2) &&
                !shoePrefixAppendMode &&
                !IsNoBoardSeqEvent(incomingBoardEvent) &&
                !IsSeedLikeSeqEvent(incomingBoardEvent);
            if (jsRawMismatchHold)
            {
                Log($"[NETSEQ][JS-RAW-MISMATCH-HOLD] src={source} | boardLen={jsDisplay.Length} | rawLen={rawDisplayNow.Length} | netLen={_netSeqDisplay.Length} | netVer={_netSeqVersion} | evt={(string.IsNullOrWhiteSpace(incomingBoardEvent) ? "-" : incomingBoardEvent)} | keep=network");
                snap.seq = FilterResultDisplaySeqWindow(_netSeqDisplay);
                snap.seqVersion = Math.Max(snap.seqVersion ?? 0, _netSeqVersion);
                snap.seqEvent = string.IsNullOrWhiteSpace(_netSeqEvent) ? (snap.seqEvent ?? "") : _netSeqEvent;
                snap.seqSource = "network";
                return;
            }
            bool jsLooksStaleForObservedRound =
                _netObservedTableId > 0 &&
                (_netSeqTableId == 0 || _netObservedTableId == _netSeqTableId) &&
                _netObservedGameShoe > 0 &&
                (_netSeqGameShoe == 0 || _netObservedGameShoe == _netSeqGameShoe) &&
                _netObservedGameRound > 0 &&
                jsDisplay.Length > _netObservedGameRound;
            bool recentNetWinner = _netLastWinnerAt != DateTime.MinValue &&
                                   (DateTime.UtcNow - _netLastWinnerAt).TotalSeconds <= 15;
            bool hasShoeRebaseAnchor =
                _lastShoeRebaseAppliedUtc != DateTime.MinValue &&
                _lastShoeRebaseAppliedLen > 0;
            bool jsLongJumpAfterShoeRebase =
                hasShoeRebaseAnchor &&
                combinedLonger &&
                !string.IsNullOrWhiteSpace(_netSeqDisplay) &&
                jsDisplay.Length >= (_netSeqDisplay.Length + 8) &&
                jsDisplay.Length >= Math.Max(_lastShoeRebaseAppliedLen, _netSeqDisplay.Length) + 8 &&
                (rawDisplayNow.Length == 0 || rawDisplayNow.Length <= (_netSeqDisplay.Length + 2));
            bool jsSameLenMismatchAfterShoeRebase =
                hasShoeRebaseAnchor &&
                !string.IsNullOrWhiteSpace(_netSeqDisplay) &&
                combinedDisplay.Length == _netSeqDisplay.Length &&
                !string.Equals(combinedDisplay, _netSeqDisplay, StringComparison.Ordinal) &&
                rawDisplayNow.Length > 0 &&
                rawDisplayNow.Length + 6 < _netSeqDisplay.Length &&
                jsDisplay.Length >= rawDisplayNow.Length + 6;
            if (jsSameLenMismatchAfterShoeRebase)
            {
                Log($"[NETSEQ][JS-STALE-SAME-LEN] src={source} | boardLen={jsDisplay.Length} | boardVer={boardSeqVersion} | rawLen={rawDisplayNow.Length} | netLen={_netSeqDisplay.Length} | netVer={_netSeqVersion} | evt={(string.IsNullOrWhiteSpace(boardSeqEvent) ? "-" : boardSeqEvent)} | keep=network");
                snap.seq = FilterResultDisplaySeqWindow(_netSeqDisplay);
                snap.seqVersion = Math.Max(snap.seqVersion ?? 0, _netSeqVersion);
                snap.seqEvent = string.IsNullOrWhiteSpace(_netSeqEvent) ? (snap.seqEvent ?? "") : _netSeqEvent;
                snap.seqSource = "network";
                return;
            }

            bool sameLenChangedNoAppend =
                combinedSameLen &&
                combinedChanged &&
                !sameLenAppendConfirmed;
            if (sameLenChangedNoAppend)
            {
                string reason = sameLenBoardAdvanceSignal ? "same-len-version-only" : "same-len-rewrite";
                Log($"[NETSEQ][RESYNC-REJECT-SAME-LEN] src={source} | reason={reason} | boardLen={jsDisplay.Length} | boardVer={boardSeqVersion} | rawLen={rawDisplayNow.Length} | netLen={_netSeqDisplay.Length} | netVer={_netSeqVersion} | evt={(string.IsNullOrWhiteSpace(boardSeqEvent) ? "-" : boardSeqEvent)} | keep=network");
                snap.seq = FilterResultDisplaySeqWindow(_netSeqDisplay);
                snap.seqVersion = Math.Max(snap.seqVersion ?? 0, _netSeqVersion);
                snap.seqEvent = string.IsNullOrWhiteSpace(_netSeqEvent) ? (snap.seqEvent ?? "") : _netSeqEvent;
                snap.seqSource = "network";
                return;
            }

            bool canResyncAsAppend =
                combinedLonger ||
                sameLenAppendConfirmed;
            if (canResyncAsAppend)
            {
                if (shoePrefixAppendMode)
                {
                    Log($"[NETSEQ][SHOE-PREFIX-COMBINE] src={source} | boardLen={jsDisplay.Length} | rawLen={rawDisplayNow.Length} | prefixLen={FilterResultDisplaySeqWindow(_syncSeqPrefixDisplay).Length} | netLen={_netSeqDisplay.Length} | netVer={_netSeqVersion} | sameLen={(combinedSameLen ? 1 : 0)} | appendDelta={appendDelta} | evt={(string.IsNullOrWhiteSpace(boardSeqEvent) ? "-" : boardSeqEvent)}");
                }
                if (jsLongJumpAfterShoeRebase)
                {
                    Log($"[NETSEQ][JS-STALE-LONGJUMP] src={source} | boardLen={jsDisplay.Length} | boardVer={boardSeqVersion} | rawLen={rawDisplayNow.Length} | netLen={_netSeqDisplay.Length} | netVer={_netSeqVersion} | evt={(string.IsNullOrWhiteSpace(boardSeqEvent) ? "-" : boardSeqEvent)} | sinceShoeRebaseMs={(long)(DateTime.UtcNow - _lastShoeRebaseAppliedUtc).TotalMilliseconds} | keep=network");
                    snap.seq = FilterResultDisplaySeqWindow(_netSeqDisplay);
                    snap.seqVersion = Math.Max(snap.seqVersion ?? 0, _netSeqVersion);
                    snap.seqEvent = string.IsNullOrWhiteSpace(_netSeqEvent) ? (snap.seqEvent ?? "") : _netSeqEvent;
                    snap.seqSource = "network";
                    return;
                }

                if (combinedLonger && jsLooksStaleForObservedRound)
                {
                    Log($"[NETSEQ][JS-STALE] src={source} | boardLen={jsDisplay.Length} | obsRound={_netObservedGameRound} | obsShoe={_netObservedGameShoe} | netLen={_netSeqDisplay.Length} | netVer={_netSeqVersion} | keep=network");
                    snap.seq = FilterResultDisplaySeqWindow(_netSeqDisplay);
                    snap.seqVersion = Math.Max(snap.seqVersion ?? 0, _netSeqVersion);
                    snap.seqEvent = string.IsNullOrWhiteSpace(_netSeqEvent) ? (snap.seqEvent ?? "") : _netSeqEvent;
                    snap.seqSource = "network";
                    return;
                }

                if (!recentNetWinner)
                {
                    string prevNetDisplay = _netSeqDisplay;
                    long prevNetLen = _netSeqDisplay.Length;
                    long prevNetVer = _netSeqVersion;
                    _netSeqDisplay = FilterResultDisplaySeqWindow(combinedDisplay);
                    _netSeqVersion = ComputeNextSyncSeqVersion(prevNetVer, prevNetDisplay, _netSeqDisplay, Math.Max(jsSeqVersion, _netSeqDisplay.Length));
                    _netSeqEvent = string.IsNullOrWhiteSpace(boardSeqEvent) ? "js-resync" : "js-resync-" + boardSeqEvent;
                    _netSeqSource = "js-resync";
                    string resyncReason = combinedLonger ? "append-len-ahead" : $"append-same-len-delta-{appendDelta}";
                    Log($"[NETSEQ][RESYNC] src={source} | boardLen={jsDisplay.Length} | boardVer={boardSeqVersion} | prevNetLen={prevNetLen} | prevNetVer={prevNetVer} | netLen={_netSeqDisplay.Length} | netVer={_netSeqVersion} | reason={resyncReason}");
                    snap.seq = FilterResultDisplaySeqWindow(_netSeqDisplay);
                    snap.seqVersion = _netSeqVersion;
                    snap.seqEvent = _netSeqEvent;
                    snap.seqSource = "js-resync";
                    return;
                }

                string keepReason = combinedLonger ? "recent-net-winner-len-ahead" : "recent-net-winner-same-len-append";
                Log($"[NETSEQ][JS-AHEAD] src={source} | boardLen={jsDisplay.Length} | boardVer={boardSeqVersion} | netLen={_netSeqDisplay.Length} | netVer={_netSeqVersion} | keep=network | reason={keepReason}");
            }

            bool shouldOverride =
                !string.IsNullOrWhiteSpace(_netSeqDisplay) &&
                (combinedDisplay.Length <= _netSeqDisplay.Length) &&
                (!string.Equals(combinedDisplay, _netSeqDisplay, StringComparison.Ordinal) ||
                 ((_netSeqVersion > 0) && (_netSeqVersion > (snap.seqVersion ?? 0))));

            if (!shouldOverride) return;

            if (!string.Equals(combinedDisplay, _netSeqDisplay, StringComparison.Ordinal))
            {
                Log($"[NETSEQ][SNAP-OVERRIDE] src={source} | boardLen={jsDisplay.Length} | boardVer={boardSeqVersion} | boardEvt={(string.IsNullOrWhiteSpace(boardSeqEvent) ? "-" : boardSeqEvent)} | netLen={_netSeqDisplay.Length} | netVer={_netSeqVersion} | netEvt={(string.IsNullOrWhiteSpace(_netSeqEvent) ? "-" : _netSeqEvent)}");
            }

            snap.seq = FilterResultDisplaySeqWindow(_netSeqDisplay);
            snap.seqVersion = Math.Max(snap.seqVersion ?? 0, _netSeqVersion);
            snap.seqEvent = string.IsNullOrWhiteSpace(_netSeqEvent) ? (snap.seqEvent ?? "") : _netSeqEvent;
            snap.seqSource = "network";
        }

        private void ApplyNetworkSeqAuthorityLocked(CwSnapshot? snap)
        {
            if (snap == null) return;

            if ((_tableSwitchRebaseArmed || _initialTableEnterArmed) &&
                (string.Equals(snap.seqSource, "table-switch-wait-bead", StringComparison.OrdinalIgnoreCase) ||
                 (snap.seqEvent ?? "").IndexOf("table-switch-wait-bead", StringComparison.OrdinalIgnoreCase) >= 0 ||
                 string.IsNullOrWhiteSpace(snap.seq)))
            {
                snap.seq = FilterResultDisplaySeqWindow(snap.seq);
                snap.niSeq = _niSeq.ToString();
                Log($"[NETSEQ][AUTH-SKIP-OLD-TABLE] reason=wait-new-table-bead | snapLen={(snap.seq ?? "").Length} | oldNetLen={_netSeqDisplay.Length} | oldNetVer={_netSeqVersion} | tableSwitchArm={(_tableSwitchRebaseArmed ? 1 : 0)} | initialEnter={(_initialTableEnterArmed ? 1 : 0)}");
                return;
            }

            if (!string.IsNullOrWhiteSpace(_netSeqDisplay))
            {
                snap.seq = FilterResultDisplaySeqWindow(_netSeqDisplay);
                snap.seqVersion = Math.Max(snap.seqVersion ?? 0, _netSeqVersion);
                snap.seqEvent = string.IsNullOrWhiteSpace(_netSeqEvent) ? (snap.seqEvent ?? "") : _netSeqEvent;
                snap.seqSource = string.IsNullOrWhiteSpace(_netSeqSource) ? "network" : _netSeqSource;
            }
            else
            {
                snap.seq = FilterResultDisplaySeqWindow(snap.seq);
            }

            snap.niSeq = _niSeq.ToString();
        }

        private CwSnapshot? CloneAuthoritativeRawSnap()
        {
            CwSnapshot? clone;
            lock (_snapLock) clone = CloneSnapRaw(_lastSnap);
            lock (_roundStateLock) ApplyNetworkSeqAuthorityLocked(clone);
            return clone;
        }

        private CwSnapshot? CloneAuthoritativeTaskSnap()
        {
            CwSnapshot? clone;
            lock (_snapLock) clone = CloneSnapForTasks(_lastSnap);
            lock (_roundStateLock) ApplyNetworkSeqAuthorityLocked(clone);
            if (clone != null)
                clone.seq = FilterPlayableSeq(clone.seq);
            return clone;
        }

        private bool ShouldLogPacketFrame(string kind, string? url, string payload, bool isBinary, out string preview, out string reason)
        {
            preview = PreviewPacketPayloadEx(payload, isBinary);
            reason = "";
            var p = preview ?? "";
            if (string.IsNullOrWhiteSpace(p)) return false;
            if (LooksLikeHeartbeat(p)) return false;

            var lower = p.ToLowerInvariant();
            bool interestingUrl = IsInteresting(url);
            bool payloadHit = _pktPayloadInterestingHints.Any(h => lower.Contains(h));
            bool looksStructured = p.StartsWith("{") || p.StartsWith("[") || p.StartsWith("BIN-TXT:", StringComparison.Ordinal);
            if (!interestingUrl && !payloadHit) return false;
            if (!payloadHit && !looksStructured && p.Length < 24) return false;

            var dedupeKey = string.Join("|", kind, url ?? "", payloadHit ? "hit" : "plain");
            var dedupeVal = Shrink(p, 220);
            if (_pktLastPreviewByKey.TryGetValue(dedupeKey, out var prev) &&
                string.Equals(prev, dedupeVal, StringComparison.Ordinal))
                return false;

            _pktLastPreviewByKey[dedupeKey] = dedupeVal;
            reason = payloadHit ? "payload-hit" : (interestingUrl ? "interesting-url" : "structured");
            return true;
        }

        private bool ShouldLogHttpResponse(string? url, string body, out string preview, out string reason)
        {
            preview = Shrink(body, 2000);
            reason = "";
            if (string.IsNullOrWhiteSpace(preview)) return false;
            if (!IsInterestingHttpUrl(url)) return false;

            var lower = preview.ToLowerInvariant();
            bool payloadHit = _pktPayloadInterestingHints.Any(h => lower.Contains(h));
            bool looksStructured = preview.StartsWith("{") || preview.StartsWith("[") || preview.StartsWith("<");
            if (!payloadHit && !looksStructured) return false;

            var dedupeKey = "HTTP|" + (url ?? "");
            var dedupeVal = Shrink(preview, 220);
            if (_pktLastPreviewByKey.TryGetValue(dedupeKey, out var prev) &&
                string.Equals(prev, dedupeVal, StringComparison.Ordinal))
                return false;

            _pktLastPreviewByKey[dedupeKey] = dedupeVal;
            reason = payloadHit ? "payload-hit" : "interesting-url";
            return true;
        }

        private void LogPacket(string kind, string? url, string preview, bool isBinary)
        {
            if (COMPACT_RUNTIME_LOG)
            {
                var payload = preview ?? "";
                bool packetErrorLike =
                    payload.IndexOf("error", StringComparison.OrdinalIgnoreCase) >= 0 ||
                    payload.IndexOf("exception", StringComparison.OrdinalIgnoreCase) >= 0 ||
                    payload.IndexOf("status=4", StringComparison.OrdinalIgnoreCase) >= 0 ||
                    payload.IndexOf("status=5", StringComparison.OrdinalIgnoreCase) >= 0;

                if (!packetErrorLike &&
                    (kind.StartsWith("WS.recv/", StringComparison.Ordinal) ||
                     kind.StartsWith("WS.send/", StringComparison.Ordinal)))
                {
                    if (payload.IndexOf("countOnline", StringComparison.OrdinalIgnoreCase) >= 0 ||
                        LooksLikeHeartbeat(payload))
                        return;

                    var wsKey = "PKT_WS_" + kind;
                    var now = Environment.TickCount64;
                    var last = _logThrottleLastMs.TryGetValue(wsKey, out var v) ? v : 0;
                    if ((now - last) < 3000)
                        return;
                    _logThrottleLastMs[wsKey] = now;
                }
            }

            var line = $"[PKT] {DateTime.Now:HH:mm:ss} {kind} {url ?? ""}\n      {preview}";
            // Ghi file luôn (không chặn)
            EnqueueFile(line);

            // UI: mặc định tắt, hoặc lấy mẫu 1/N
            if (SHOW_PACKET_LINES_IN_UI)
            {
                _pktUiSample++;
                if (_pktUiSample % PACKET_UI_SAMPLE_EVERY_N == 0)
                    EnqueueUi(line);
            }
        }
        /// <summary>
        private async void CoreWebView2_WebResourceResponseReceived(object? sender, CoreWebView2WebResourceResponseReceivedEventArgs e)
        {
            try
            {
                var url = e?.Request?.Uri ?? "";
                var response = e?.Response;
                if (response == null) return;

                if (IsPlayerFlowUrl(url))
                {
                    var status = response.StatusCode;
                    var dedupeKey = "HTTP.player-flow|" + url;
                    var dedupeVal = status.ToString(CultureInfo.InvariantCulture);
                    if (!_pktLastPreviewByKey.TryGetValue(dedupeKey, out var prev) ||
                        !string.Equals(prev, dedupeVal, StringComparison.Ordinal))
                    {
                        _pktLastPreviewByKey[dedupeKey] = dedupeVal;
                        LogPacket("HTTP.resp/player-flow", url, "status=" + status, false);
                    }
                    RememberPlayerFlowGameUrl(url);
                }

                if (!_enableHttpResponseBodyTap) return;
                if (!IsInterestingHttpUrl(url)) return;

                string body = "";
                try
                {
                    using var stream = await response.GetContentAsync();
                    if (stream != null)
                    {
                        using var reader = new StreamReader(stream, Encoding.UTF8, true, 4096, leaveOpen: false);
                        body = await reader.ReadToEndAsync();
                    }
                }
                catch
                {
                    return;
                }

                if (ShouldLogHttpResponse(url, body, out var preview, out var reason))
                    LogPacket("HTTP.resp/" + reason, url, preview, false);
            }
            catch (Exception ex)
            {
                Log("[HTTP resp tap] " + ex.Message);
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
    const rm=s=>{try{return (s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[đĐ]/g,'d');}catch(_){return String(s||'').replace(/[đĐ]/g,'d');}};
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

    // Quét các anchor/button, chấm điểm để tránh bấm nhầm card promo dài.
    const cands = qa('a,button,[role=""button""],.btn,.base-button,.el-button,.v-btn,.item-live a,.item-live .title,.item-live,[class*=""title""]');
    const picks = [];
    for(const el of cands){
      const txt = low(el.textContent || el.innerText || el.getAttribute('aria-label') || el.getAttribute('title') || '');
      if (!txt || !vis(el)) continue;
      const hasXocDia = (txt.includes('xoc') && txt.includes('dia'));
      const hasBaccarat = txt.includes('baccarat') || txt.includes('single bac') || txt.includes('singlebac');
      if (!hasXocDia && !hasBaccarat) continue;
      const cls = low(el.className || '');
      let score = 0;
      if (/xoc\s*dia/.test(txt)) score += 90;
      if (hasBaccarat) score += 70;
      if (txt.includes('live')) score += 15;
      if (txt.length <= 24) score += 35;
      else if (txt.length <= 60) score += 10;
      else score -= 30;
      if (txt.includes('hoan tra') || txt.includes('toi da') || txt.includes('%')) score -= 60;
      if (cls.includes('item-live')) score += 35;
      if (cls.includes('title')) score += 20;
      if (cls.includes('home-popular')) score -= 90;
      if (el.closest && el.closest('.livestream-section__live,.item-live')) score += 35;
      picks.push({ el, txt, cls, score });
    }
    if (!picks.length) return 'no-title';
    picks.sort((a,b)=>b.score-a.score);
    const best = picks[0];
    if (best.score < 45){
      const weakOk = best.score >= -35 && (best.txt.includes('baccarat') || (best.txt.includes('xoc') && best.txt.includes('dia')));
      if (weakOk){
        fire(best.el);
        return 'clicked-weak|score=' + best.score + '|txt=' + best.txt.slice(0,80) + '|cls=' + best.cls.slice(0,80);
      }
      return 'no-strong-title|score=' + best.score + '|txt=' + best.txt.slice(0,80) + '|cls=' + best.cls.slice(0,80);
    }
    fire(best.el);
    return 'clicked|score=' + best.score + '|txt=' + best.txt.slice(0,80) + '|cls=' + best.cls.slice(0,80);
  }catch(e){ return 'err:'+ (e && e.message || e); }
})();";
            try
            {
                var r = await ExecJsAsyncStr(clickTitleJs);
                Log("[ClickXocDiaTitle/anchor] " + r);
                if (r.StartsWith("clicked", StringComparison.OrdinalIgnoreCase)) return "clicked";
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

            // 3) Fallback riêng cho vipbet: card home-popular thường là điểm mở provider.
            if (IsCurrentHostVipbet389())
            {
                const string clickVipbetCardJs = @"
(function(){
  try{
    const rm=s=>{try{return (s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[đĐ]/g,'d');}catch(_){return String(s||'').replace(/[đĐ]/g,'d');}};
    const low=s=>rm(String(s||'').trim().toLowerCase());
    const vis=el=>{
      if(!el) return false;
      const r=el.getBoundingClientRect(), cs=getComputedStyle(el);
      return r.width>10 && r.height>10 && cs.display!=='none' && cs.visibility!=='hidden' && cs.pointerEvents!=='none';
    };
    const fire=el=>{
      try{ el.scrollIntoView({block:'center', inline:'center'}); }catch(_){}
      const r=el.getBoundingClientRect();
      const cx=Math.max(0, Math.floor(r.left+r.width/2));
      const cy=Math.max(0, Math.floor(r.top+r.height/2));
      const top=document.elementFromPoint(cx,cy) || el;
      const seq=['pointerover','mouseover','pointerenter','mouseenter','pointerdown','mousedown','pointerup','mouseup','click'];
      for(const t of seq){ top.dispatchEvent(new MouseEvent(t,{bubbles:true,cancelable:true,clientX:cx,clientY:cy,view:window})); }
      try{ top.click(); }catch(_){}
    };
    const roots = Array.from(document.querySelectorAll('a.home-popular__game,.home-popular__game,a[class*=""home-popular__game""],[class*=""home-popular__game""]'));
    const picks = [];
    for(const el of roots){
      if(!vis(el)) continue;
      const txt = low(el.textContent || el.innerText || el.getAttribute('title') || el.getAttribute('aria-label') || '');
      const anc = (el.closest && el.closest('a[href]')) || (el.tagName==='A' ? el : null);
      const href = low((anc && anc.getAttribute('href')) || '');
      let score = 0;
      if (txt.includes('xoc') && txt.includes('dia')) score += 95;
      if (txt.includes('baccarat') || txt.includes('single bac') || txt.includes('sexyco')) score += 75;
      if (txt.includes('rong ho') || txt.includes('ngau ham')) score += 35;
      if (txt.includes('live')) score += 12;
      if (href.includes('baccarat') || href.includes('casino') || href.includes('live')) score += 20;
      if (txt.includes('hoan tra') || txt.includes('toi da') || txt.includes('khuyen mai') || txt.includes('%')) score -= 25;
      picks.push({el, score, txt:txt.slice(0,90), href:href.slice(0,120)});
    }
    if(!picks.length) return 'vipbet-no-card';
    picks.sort((a,b)=>b.score-a.score);
    const best = picks[0];
    fire(best.el);
    return 'clicked-vipbet|score=' + best.score + '|txt=' + best.txt + '|href=' + best.href;
  }catch(e){
    return 'vipbet-err:' + ((e && e.message) ? e.message : String(e));
  }
})();";

                try
                {
                    var vipRes = await ExecJsAsyncStr(clickVipbetCardJs);
                    Log("[ClickXocDiaTitle/vipbet-card] " + vipRes);
                    if (vipRes.StartsWith("clicked", StringComparison.OrdinalIgnoreCase))
                        return "clicked";
                }
                catch (Exception ex)
                {
                    Log("[ClickXocDiaTitle/vipbet-card ERR] " + ex.Message);
                }
            }

            // 4) Fallback cuối: mở item index 1 (giống VaoXocDia_Click đang dùng)
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

        private bool IsCurrentHostVipbet389()
        {
            try
            {
                var src = GetBetWebViewSource(Web);
                if (string.IsNullOrWhiteSpace(src))
                    src = Web?.CoreWebView2?.Source ?? "";
                return src.IndexOf("vipbet389.com", StringComparison.OrdinalIgnoreCase) >= 0;
            }
            catch
            {
                return false;
            }
        }

        private bool IsCurrentHostB8Pro07()
        {
            try
            {
                var src = GetBetWebViewSource(Web);
                if (string.IsNullOrWhiteSpace(src))
                    src = Web?.CoreWebView2?.Source ?? "";
                return src.IndexOf("b8pro07.com", StringComparison.OrdinalIgnoreCase) >= 0;
            }
            catch
            {
                return false;
            }
        }

        private bool IsCurrentHostAllowUnboundHistory()
        {
            try
            {
                var src = GetBetWebViewSource(Web);
                if (string.IsNullOrWhiteSpace(src))
                    src = Web?.CoreWebView2?.Source ?? "";
                if (string.IsNullOrWhiteSpace(src))
                    return false;

                return src.IndexOf("vipbet389.com", StringComparison.OrdinalIgnoreCase) >= 0
                    || src.IndexOf("rr5309.com", StringComparison.OrdinalIgnoreCase) >= 0
                    || src.IndexOf("b8pro07.com", StringComparison.OrdinalIgnoreCase) >= 0;
            }
            catch
            {
                return false;
            }
        }

        private async Task<bool> DispatchTrustedMouseClickAsync(CoreWebView2 core, int x, int y)
        {
            try
            {
                var xSafe = Math.Max(0, x);
                var ySafe = Math.Max(0, y);
                await core.CallDevToolsProtocolMethodAsync(
                    "Input.dispatchMouseEvent",
                    JsonSerializer.Serialize(new { type = "mouseMoved", x = xSafe, y = ySafe, button = "none", buttons = 1 }));
                await core.CallDevToolsProtocolMethodAsync(
                    "Input.dispatchMouseEvent",
                    JsonSerializer.Serialize(new { type = "mousePressed", x = xSafe, y = ySafe, button = "left", buttons = 1, clickCount = 1 }));
                await core.CallDevToolsProtocolMethodAsync(
                    "Input.dispatchMouseEvent",
                    JsonSerializer.Serialize(new { type = "mouseReleased", x = xSafe, y = ySafe, button = "left", buttons = 0, clickCount = 1 }));
                return true;
            }
            catch (Exception ex)
            {
                Log("[TrustedClick] " + ex.Message);
                return false;
            }
        }

        private async Task<string> TryTrustedClickLaunchTargetsAsync(int maxClicks = 5)
        {
            try
            {
                if (Web?.CoreWebView2 == null)
                    return "web-null";

                const string planJs = @"
(function(){
  try{
    const rm=s=>{try{return (s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[đĐ]/g,'d');}catch(_){return String(s||'').replace(/[đĐ]/g,'d');}};
    const low=s=>rm(String(s||'').trim().toLowerCase());
    const vis=el=>{
      if(!el) return false;
      const r=el.getBoundingClientRect(), cs=getComputedStyle(el);
      return r.width>6 && r.height>6 && cs.display!=='none' && cs.visibility!=='hidden' && cs.pointerEvents!=='none';
    };
    const center=el=>{
      const r=el.getBoundingClientRect();
      return { x:Math.round(r.left + r.width/2), y:Math.round(r.top + r.height/2), w:Math.round(r.width), h:Math.round(r.height) };
    };
    const out = { points:[], info:{}, err:'' };

    const cands = Array.from(document.querySelectorAll('a,button,[role=""button""],.item-live,.item-live .title,[class*=""title""],[class*=""game""],[class*=""table""]'));
    const picks = [];
    for (const el of cands){
      if (!vis(el)) continue;
      const txt = low(el.textContent || el.innerText || el.getAttribute('aria-label') || el.getAttribute('title') || '');
      if (!txt) continue;
      const hasXocDia = txt.includes('xoc') && txt.includes('dia');
      const hasBaccarat = txt.includes('baccarat') || txt.includes('single bac') || txt.includes('singlebac');
      if (!hasXocDia && !hasBaccarat) continue;
      const cls = low(el.className || '');
      let score = 0;
      if (hasXocDia) score += 90;
      if (hasBaccarat) score += 70;
      if (txt.includes('live')) score += 20;
      if (cls.includes('item-live')) score += 40;
      if (el.closest && el.closest('.livestream-section__live,.item-live')) score += 35;
      if (txt.includes('hoan tra') || txt.includes('toi da') || txt.includes('%')) score -= 60;
      if (cls.includes('home-popular')) score -= 90;
      picks.push({ el:el, txt:txt.slice(0,80), score:score });
    }
    picks.sort((a,b)=>b.score-a.score);
    for (let i=0;i<picks.length && out.points.length<2;i++){
      const p = picks[i];
      if (p.score < 45) continue;
      const c = center(p.el);
      out.points.push({ x:c.x, y:c.y, label:'card:' + p.txt, score:p.score });
    }

    const frame = Array.from(document.querySelectorAll('iframe,frame')).find(el=>{
      try{
        const src = low(el.getAttribute('src') || el.src || '');
        if (!src.includes('/player/login/apilogin')) return false;
        return vis(el);
      }catch(_){ return false; }
    });
    if (frame){
      const r = frame.getBoundingClientRect();
      out.info.apiLoginFrame = { x:Math.round(r.left), y:Math.round(r.top), w:Math.round(r.width), h:Math.round(r.height) };
      out.points.push({ x:Math.round(r.left + Math.max(26, r.width * 0.50)), y:Math.round(r.top + Math.max(30, r.height * 0.14)), label:'iframe-top', score:58 });
      out.points.push({ x:Math.round(r.left + r.width/2), y:Math.round(r.top + r.height/2), label:'iframe-center', score:55 });
      out.points.push({ x:Math.round(r.left + Math.max(26, r.width * 0.78)), y:Math.round(r.top + Math.max(30, r.height * 0.30)), label:'iframe-right', score:52 });
      out.points.push({ x:Math.round(r.left + Math.max(24, r.width*0.22)), y:Math.round(r.top + Math.max(24, r.height*0.22)), label:'iframe-inner', score:45 });
    }

    const seen = {};
    out.points = out.points.filter(p=>{
      const k = p.x + ',' + p.y;
      if (seen[k]) return false;
      seen[k] = 1;
      return true;
    });

    return JSON.stringify(out);
  }catch(e){
    return JSON.stringify({ points:[], err:String((e&&e.message)?e.message:e) });
  }
})();";

                var plan = await ExecJsAsyncStr(planJs);
                if (string.IsNullOrWhiteSpace(plan))
                    return "plan-empty";

                using var doc = JsonDocument.Parse(plan);
                if (!doc.RootElement.TryGetProperty("points", out var pointsEl) || pointsEl.ValueKind != JsonValueKind.Array)
                    return "plan-no-points";

                int clicked = 0;
                int tried = 0;
                foreach (var point in pointsEl.EnumerateArray())
                {
                    if (tried >= maxClicks) break;
                    if (!point.TryGetProperty("x", out var xEl) || !point.TryGetProperty("y", out var yEl))
                        continue;

                    var x = (int)Math.Round(xEl.GetDouble());
                    var y = (int)Math.Round(yEl.GetDouble());
                    tried++;
                    var ok = await DispatchTrustedMouseClickAsync(Web.CoreWebView2, x, y);
                    if (ok) clicked++;
                    await Task.Delay(160);
                }

                return $"clicked={clicked}/{tried} | plan={Shrink(plan, 280)}";
            }
            catch (Exception ex)
            {
                return "err:" + ex.Message;
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
            if (!CheckLicense)
                return true;

            var trialMode = IsTrialModeRequestedOrActive();
            Log($"[AccessGate] trial={trialMode} | chk={(ChkTrial?.IsChecked == true)} | cfg={(_cfg?.UseTrial == true)} | mode={_expireMode}");

            if (trialMode)
                return await EnsureTrialAsync();

            return await EnsureLicenseAsync();
        }

        private async Task<bool> EnsureLicenseAsync()
        {
            if (!CheckLicense)
                return true;

            var username = (T(TxtUser) ?? "").Trim().ToLowerInvariant();
            var password = (P(TxtPass) ?? "").Trim();

            if (string.IsNullOrWhiteSpace(username))
            {
                MessageBox.Show("Chưa nhập tên đăng nhập.", "Automino",
                    MessageBoxButton.OK, MessageBoxImage.Warning);
                return false;
            }

            if (_licenseVerified && _runExpiresAt != null)
            {
                var now = DateTimeOffset.Now;
                bool sameUser = string.Equals(_licenseUser ?? "", username, StringComparison.OrdinalIgnoreCase);
                bool sameMode = string.Equals(_expireMode, "license", StringComparison.OrdinalIgnoreCase);
                if (sameUser && sameMode && _runExpiresAt.Value > now)
                    return true;
            }

            _licenseUser = username;
            _licensePass = password;

            if (string.IsNullOrWhiteSpace(password))
            {
                MessageBox.Show("Chưa nhập mật khẩu.", "Automino",
                    MessageBoxButton.OK, MessageBoxImage.Warning);
                return false;
            }

            var lic = await FetchLicenseAsync(username);
            if (lic == null)
            {
                MessageBox.Show("Không tìm thấy license cho tài khoản này. Hãy liên hệ Telegram: @minoauto để đăng ký sử dụng.",
                    "Automino", MessageBoxButton.OK, MessageBoxImage.Warning);
                return false;
            }
            if (string.IsNullOrWhiteSpace(lic.exp) || string.IsNullOrWhiteSpace(lic.pass) ||
                !DateTimeOffset.TryParse(lic.exp, out var expUtc))
            {
                MessageBox.Show("License không hợp lệ (exp/pass).", "Automino",
                    MessageBoxButton.OK, MessageBoxImage.Warning);
                return false;
            }
            if (!string.Equals(lic.pass ?? "", password, StringComparison.Ordinal))
            {
                MessageBox.Show("Mật khẩu license không đúng.", "Automino",
                    MessageBoxButton.OK, MessageBoxImage.Warning);
                return false;
            }
            if (DateTimeOffset.UtcNow >= expUtc)
            {
                MessageBox.Show("Tool của bạn hết hạn. Hãy liên hệ Telegram: @minoauto để gia hạn",
                    "Automino", MessageBoxButton.OK, MessageBoxImage.Warning);
                return false;
            }

            var okLease = await AcquireLeaseOnceAsync(username);
            if (!okLease) return false;

            StartExpiryCountdown(expUtc, "license");
            SetLicenseUi(true);
            StartLeaseHeartbeat(username);
            StartLicenseRecheckTimer(username);
            Log("[License] valid until: " + expUtc.ToString("u"));
            return true;
        }

        private async Task<bool> EnsureTrialAsync()
        {
            if (!CheckLicense)
                return true;

            EnsureDeviceId();
            EnsureTrialKey();
            if (string.IsNullOrWhiteSpace(_trialKey))
            {
                MessageBox.Show("Không xác định được DeviceId để dùng thử.", "Automino",
                    MessageBoxButton.OK, MessageBoxImage.Warning);
                return false;
            }

            if (_licenseVerified && _runExpiresAt != null)
            {
                var now = DateTimeOffset.Now;
                bool sameMode = string.Equals(_expireMode, "trial", StringComparison.OrdinalIgnoreCase);
                if (sameMode && _runExpiresAt.Value > now)
                    return true;
            }

            _licenseUser = "";
            _licensePass = "";

            DateTimeOffset? localTrialUntil = null;
            try
            {
                var savedTrialKey = (_cfg.TrialSessionKey ?? "").Trim();
                if (string.Equals(savedTrialKey, _trialKey, StringComparison.Ordinal) &&
                    DateTimeOffset.TryParse(_cfg.TrialUntil, out var trialUntilUtc) &&
                    trialUntilUtc > DateTimeOffset.UtcNow)
                {
                    localTrialUntil = trialUntilUtc;
                }

                if (!localTrialUntil.HasValue &&
                    (!string.IsNullOrWhiteSpace(_cfg.TrialUntil) || !string.IsNullOrWhiteSpace(_cfg.TrialSessionKey)))
                    ClearLocalTrialState(saveAsync: false);

                var sessionId = _leaseSessionId;
                using var http = new System.Net.Http.HttpClient(
                    new System.Net.Http.HttpClientHandler
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
                var json = System.Text.Json.JsonSerializer.Serialize(new { clientId = _trialKey, sessionId, deviceId = _deviceId, appId = AppLocalDirName });
                var res = await http.PostAsync(
                    url,
                    new System.Net.Http.StringContent(json, System.Text.Encoding.UTF8, "application/json"));

                var payload = await res.Content.ReadAsStringAsync();
                if (res.IsSuccessStatusCode)
                {
                    DateTimeOffset trialEndsAt;
                    try
                    {
                        using var doc = System.Text.Json.JsonDocument.Parse(payload);
                        trialEndsAt = DateTimeOffset.Parse(doc.RootElement.GetProperty("trialEndsAt").GetString());
                    }
                    catch { trialEndsAt = DateTimeOffset.UtcNow.AddMinutes(30); }

                    _cfg.TrialUntil = trialEndsAt.ToString("o");
                    _cfg.TrialSessionKey = _trialKey;
                    _cfg.UseTrial = true;
                    _ = SaveConfigAsync();

                    StartExpiryCountdown(trialEndsAt, "trial");
                    SetLicenseUi(true);
                    StartLeaseHeartbeat(_trialKey, _trialKey);
                    Log("[Trial] started until: " + trialEndsAt.ToString("u"));
                    return true;
                }

                string error = null;
                try
                {
                    using var doc = System.Text.Json.JsonDocument.Parse(payload);
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
                else if (localTrialUntil.HasValue)
                {
                    Log("[Trial] fallback local session until " + localTrialUntil.Value.ToString("u"));
                    _cfg.UseTrial = true;
                    StartExpiryCountdown(localTrialUntil.Value, "trial");
                    SetLicenseUi(true);
                    StartLeaseHeartbeat(_trialKey, _trialKey);
                    return true;
                }
                else
                {
                    MessageBox.Show("Không thể bắt đầu chế độ dùng thử. Vui lòng thử lại.",
                                    "Automino", MessageBoxButton.OK, MessageBoxImage.Warning);
                }
                return false;
            }
            catch (Exception exTrial)
            {
                Log("[Trial ERR] " + exTrial.Message);
                if (localTrialUntil.HasValue)
                {
                    Log("[Trial] fallback local after error until " + localTrialUntil.Value.ToString("u"));
                    _cfg.UseTrial = true;
                    StartExpiryCountdown(localTrialUntil.Value, "trial");
                    SetLicenseUi(true);
                    StartLeaseHeartbeat(_trialKey, _trialKey);
                    return true;
                }
                MessageBox.Show("Không thể kết nối chế độ dùng thử.", "Automino",
                    MessageBoxButton.OK, MessageBoxImage.Warning);
                return false;
            }
        }


        private async void VaoXocDia_Click(object sender, RoutedEventArgs e)
        {
            if (Interlocked.Exchange(ref _vaoStartInProgress, 1) == 1)
            {
                Log("[VaoXocDia] click ignored: already in progress");
                return;
            }

            if (BtnVaoXocDia != null)
                BtnVaoXocDia.IsEnabled = false;

            try
            {
                Log("[VaoXocDia] click begin | src=" + (GetBetWebViewSource(GetBetWebView()) ?? "-"));
                _cfg.UseTrial = false;
                if (ChkTrial != null) ChkTrial.IsChecked = false;
                await SaveConfigAsync();
                await EnsureWebReadyAsync();

                // Nút "Đăng Nhập Tool": chỉ xác thực bản quyền/tài khoản còn hoạt động.
                if (!await EnsureLicenseAsync())
                {
                    Log("[VaoXocDia] blocked: EnsureLicenseAsync=false");
                    return;
                }

                await EnsureToolBridgeInjectedAsync();
                await LogBridgeProbeAsync("vao-license-ok");
                Log("[VaoXocDia] license/account OK (skip game-ready checks on login button).");
            }
            catch (Exception ex)
            {
                Log("[VaoXocDia_Click] " + ex);
            }
            finally
            {
                if (BtnVaoXocDia != null)
                    BtnVaoXocDia.IsEnabled = true;
                Interlocked.Exchange(ref _vaoStartInProgress, 0);
            }
        }

        private static bool IsProgressRatioSource(string? source)
        {
            var s = (source ?? "").Trim().ToLowerInvariant();
            if (string.IsNullOrEmpty(s)) return false;
            if (s.Contains("dom-pseudo-countdown")) return true;
            if (s.Contains("pseudo") && s.Contains("countdown")) return true;
            if (s.Contains("dom") && s.Contains("ratio")) return true;
            return false;
        }

        private static bool IsProgressSecondsSource(string? source)
        {
            var s = (source ?? "").Trim().ToLowerInvariant();
            if (string.IsNullOrEmpty(s)) return false;
            if (s.Contains("cocos-countdown")) return true;
            return false;
        }

        private static double? NormalizeProgressPercent(double? prog, string? source)
        {
            if (!prog.HasValue) return null;
            var p = prog.Value;
            if (!double.IsFinite(p)) return null;

            var src = (source ?? "").Trim().ToLowerInvariant();
            if (IsProgressSecondsSource(src))
            {
                p = (Math.Clamp(p, 0, 20) / 20.0) * 100.0;
                return Math.Clamp(p, 0, 100.0);
            }

            var ratioBySource = IsProgressRatioSource(src);
            var ratioByRange = p >= 0 && p <= 1.0001 &&
                               (src.Contains("dom") || src.Contains("pseudo") || src.Contains("countdown") || string.IsNullOrEmpty(src));

            if (ratioBySource || ratioByRange)
                p = Math.Clamp(p, 0, 1) * 100.0;

            return Math.Clamp(p, 0, 100.0);
        }

        private async Task<bool> EnsureGameContextReadyForPlayAsync(string stagePrefix)
        {
            bool gameReady = false;
            try
            {
                var stage = string.IsNullOrWhiteSpace(stagePrefix) ? "play" : stagePrefix.Trim();

                await EnsureToolBridgeInjectedAsync();
                await LogBridgeProbeAsync(stage + "-after-ensure");

                if (HasRecentGameSignal(out var warmReason))
                {
                    var warmBridgeState = "-";
                    bool warmBridgeReady = false;
                    try
                    {
                        var warmBridgeJson = await ExecuteOnBetWebAsync(
                            "(function(){ return (typeof window.__cw_bet==='function' || typeof window.__cw_bet_enqueue==='function') ? 'ready' : 'missing'; })()");
                        warmBridgeState = warmBridgeJson?.Trim().Trim('"') ?? "-";
                        warmBridgeReady = string.Equals(warmBridgeState, "ready", StringComparison.OrdinalIgnoreCase);
                    }
                    catch (Exception ex)
                    {
                        warmBridgeState = "err:" + ex.Message;
                    }

                    if (warmBridgeReady)
                    {
                        gameReady = true;
                        Log("[PlayEnsureGame] existing game signal: " + warmReason + " | bridge=" + warmBridgeState);
                    }
                    else
                    {
                        var warmBetWeb = GetBetWebView();
                        Log("[PlayEnsureGame] ignore stale game signal (bridge-missing) | " + warmReason +
                            " | bridge=" + warmBridgeState +
                            " | betWeb=" + GetBetWebViewName(warmBetWeb) +
                            " | src=" + GetBetWebViewSource(warmBetWeb));
                    }
                }

                if (!gameReady)
                {
                    await LogHostLaunchProbeAsync(stage + "-before-click");
                    if (IsCurrentHostAllowUnboundHistory())
                    {
                        var existingReArmed = ReArmExistingMainFrames(stage + "-wrapper-precheck");
                        if (existingReArmed > 0)
                            await WaitForGameSignalAsync(900);
                    }

                    gameReady = await WaitForBetGameUrlAsync(2500);
                    if (!gameReady)
                        gameReady = await WaitForGameSignalAsync(1200);

                    if (!gameReady && IsCurrentHostAllowUnboundHistory())
                    {
                        var routedByFlowCache = await TryRouteRecentPlayerFlowGameToPopupAsync(300);
                        if (routedByFlowCache)
                        {
                            gameReady = await WaitForBetGameUrlAsync(8000);
                            if (!gameReady)
                                gameReady = await WaitForGameSignalAsync(3000);
                            if (gameReady)
                                Log("[PlayEnsureGame] ready via cached player-flow game url.");
                        }
                    }

                    if (!gameReady && IsCurrentHostAllowUnboundHistory())
                    {
                        var reArmBeforeReload = ReArmExistingMainFrames(stage + "-wrapper-pre-reload");
                        if (reArmBeforeReload > 0)
                            gameReady = await WaitForGameSignalAsync(1500);

                        if (gameReady)
                            Log("[PlayEnsureGame] wrapper re-arm existing frame ready.");
                    }

                    if (!gameReady && IsCurrentHostAllowUnboundHistory())
                    {
                        var preReloadRes = await ForceReloadLikelyGameIframeAsync();
                        Log("[PlayEnsureGame] pre-click-reload-frame: " + preReloadRes);
                        await LogHostLaunchProbeAsync(stage + "-after-preclick-reload");
                        gameReady = await WaitForBetGameUrlAsync(2500);
                        if (!gameReady)
                            gameReady = await WaitForGameSignalAsync(2200);
                    }
                }

                if (!gameReady)
                {
                    var clickRes = await ClickXocDiaTitleAsync(12000);
                    Log("[PlayEnsureGame] click-title: " + clickRes);
                    await LogHostLaunchProbeAsync(stage + "-after-click");
                    _ = TraceHostLaunchAfterClickAsync(stage + "-post-click-trace", 12000, 1500);
                    gameReady = await WaitForBetGameUrlAsync(8000);
                    if (!gameReady)
                        gameReady = await WaitForGameSignalAsync(3000);
                }

                if (!gameReady && IsCurrentHostVipbet389())
                {
                    var trustedClickRes = await TryTrustedClickLaunchTargetsAsync(6);
                    Log("[PlayEnsureGame] trusted-click: " + trustedClickRes);
                    await LogHostLaunchProbeAsync(stage + "-after-trusted-click");
                    _ = TraceHostLaunchAfterClickAsync(stage + "-post-trusted-click", 8000, 1200);
                    gameReady = await WaitForBetGameUrlAsync(4000);
                    if (!gameReady)
                        gameReady = await WaitForGameSignalAsync(2500);
                }

                if (!gameReady)
                {
                    var reloadRes = await ForceReloadLikelyGameIframeAsync();
                    Log("[PlayEnsureGame] force-reload-frame: " + reloadRes);
                    await LogHostLaunchProbeAsync(stage + "-after-force-reload");
                    _ = TraceHostLaunchAfterClickAsync(stage + "-post-reload-trace", 8000, 1500);
                    gameReady = await WaitForBetGameUrlAsync(6000);
                    if (!gameReady)
                        gameReady = await WaitForGameSignalAsync(5000);
                }

                if (!gameReady)
                {
                    var routed = await TryRouteHostIframeToPopupAsync();
                    if (routed)
                        gameReady = await WaitForBetGameUrlAsync(20000);
                    if (!gameReady)
                        gameReady = await WaitForGameSignalAsync(5000);
                }

                if (!gameReady)
                {
                    var betSrc = GetBetWebViewSource(GetBetWebView());
                    if (TryParseProviderErrorUrl(betSrc, out var providerStatus, out var providerDesc, out var providerExternal))
                    {
                        Log("[PlayEnsureGame][provider-error] status=" +
                            (string.IsNullOrWhiteSpace(providerStatus) ? "-" : providerStatus) +
                            " | desc=" + (string.IsNullOrWhiteSpace(providerDesc) ? "-" : providerDesc) +
                            " | external=" + (string.IsNullOrWhiteSpace(providerExternal) ? "-" : providerExternal));
                    }
                    else if (IsLikelyBetGatewayUrl(betSrc))
                    {
                        Log("[PlayEnsureGame] still on gateway login URL (not game-ready): " + betSrc);
                    }
                }

                if (gameReady)
                {
                    await EnsureToolBridgeInjectedAsync();
                    await LogBridgeProbeAsync(stage + "-game-ready");
                    var betWeb = GetBetWebView();
                    Log("[PlayEnsureGame] game context ready on " + GetBetWebViewName(betWeb) + " | " + GetBetWebViewSource(betWeb));
                }
                else
                {
                    await LogHostLaunchProbeAsync(stage + "-not-ready-final");
                    await LogBridgeProbeAsync(stage + "-game-not-ready");
                    var tickAge = (_lastGameTickUtc == DateTime.MinValue) ? -1 : (DateTime.UtcNow - _lastGameTickUtc).TotalSeconds;
                    var snap = CloneAuthoritativeRawSnap();
                    Log("[PlayEnsureGame] no-data-signal | tickAge=" + (tickAge < 0 ? "-" : tickAge.ToString("0.0", CultureInfo.InvariantCulture) + "s") +
                        " | seqLen=" + (snap?.seq?.Length ?? 0) +
                        " | status=" + (string.IsNullOrWhiteSpace(snap?.status) ? "-" : Shrink(snap?.status, 80)));
                    Log("[PlayEnsureGame] game context still not ready after click + iframe fallback.");
                }
            }
            catch (Exception ex)
            {
                Log("[PlayEnsureGame] " + ex);
                gameReady = false;
            }
            return gameReady;
        }

        private async void BtnTrialTool_Click(object sender, RoutedEventArgs e)
        {
            try
            {
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


        private void StopAutoLoginWatcher() { }

        // === WebView2 reset / watchdog ===
        private static async Task DeleteDirectoryWithRetryAsync(string path, int attempts = 3, int delayMs = 400)
        {
            if (string.IsNullOrWhiteSpace(path) || !Directory.Exists(path))
                return;
            for (int i = 0; i < attempts; i++)
            {
                try
                {
                    var di = new DirectoryInfo(path);
                    foreach (var file in di.GetFiles("*", SearchOption.AllDirectories))
                        { try { file.Attributes = FileAttributes.Normal; } catch { } }
                    foreach (var dir in di.GetDirectories("*", SearchOption.AllDirectories))
                        { try { dir.Attributes = FileAttributes.Normal; } catch { } }
                    Directory.Delete(path, recursive: true);
                    return;
                }
                catch { /* retry */ }
                if (i < attempts - 1)
                {
                    try { await Task.Delay(delayMs); } catch { }
                }
            }
        }

        private async Task ResetWebViewProfileAndReloadAsync(string? url)
        {
            if (_wv2Resetting) return;
            var now = DateTime.UtcNow;
            if (now - _lastWv2ResetUtc < TimeSpan.FromSeconds(20))
            {
                Log("[WV2] Skip reset (recently attempted)");
                return;
            }
            _wv2Resetting = true;
            try
            {
                Log("[WV2] Reset profile + reload...");
                _lastWv2ResetUtc = now;

                try
                {
                    if (Web != null && Web.CoreWebView2 != null)
                    {
                        try { Web.CoreWebView2.Stop(); } catch { }
                        try { Web.CoreWebView2.Navigate("about:blank"); } catch { }
                    }
                }
                catch { }

                _webInitDone = false;
                _webHooked = false;
                _webMsgHooked = false;
                _frameHooked = false;
                _frameNavHooked = false;
                _domHooked = false;
                _navModeHooked = false;
                _mainFrameBridgeArmed.Clear();
                _mainFrameRefs.Clear();
                _popupFrameRefs.Clear();
                _frameInjectedDocKeys.Clear();

                try { await DeleteDirectoryWithRetryAsync(Wv2UserDataDir); }
                catch (Exception ex) { Log("[WV2] Delete user-data failed: " + ex.Message); }

                await EnsureWebReadyAsync();
                if (!string.IsNullOrWhiteSpace(url))
                {
                    _didStartupNav = false;
                    await NavigateIfNeededAsync(url);
                }
            }
            catch (Exception ex)
            {
                Log("[WV2] Reset failed: " + ex);
            }
            finally
            {
                _wv2Resetting = false;
            }
        }

        private async Task StartGameNavWatchdogAsync(string? url)
        {
            if (string.IsNullOrWhiteSpace(url) ||
                !Uri.TryCreate(url, UriKind.Absolute, out var u) ||
                !u.Host.StartsWith("games.", StringComparison.OrdinalIgnoreCase))
                return;

            var gen = Interlocked.Increment(ref _gameNavWatchdogGen);
            try { await Task.Delay(TimeSpan.FromSeconds(20)); } catch { return; }
            if (gen != _gameNavWatchdogGen) return;

            var cur = Web?.Source?.ToString() ?? "";
            try
            {
                if (Uri.TryCreate(cur, UriKind.Absolute, out var cu) &&
                    !cu.Host.StartsWith("games.", StringComparison.OrdinalIgnoreCase))
                    return;
            }
            catch { }

            var lastTickAge = DateTime.UtcNow - _lastGameTickUtc;
            if (lastTickAge <= TimeSpan.FromSeconds(20))
                return;
            if (DateTime.UtcNow - _lastWv2ResetUtc < TimeSpan.FromSeconds(20))
                return;

            Log("[WV2] Watchdog: không thấy game tick, reset profile + reload");
            await ResetWebViewProfileAndReloadAsync(url ?? _lastGameUrl);
        }

        private async Task<bool> WaitForGameNavigationAsync(TimeSpan timeout)
        {
            var t0 = DateTime.UtcNow;
            while (DateTime.UtcNow - t0 < timeout)
            {
                try
                {
                    var src = Web?.Source?.ToString() ?? "";
                    if (!string.IsNullOrWhiteSpace(src) &&
                        Uri.TryCreate(src, UriKind.Absolute, out var u) &&
                        u.Host.StartsWith("games.", StringComparison.OrdinalIgnoreCase))
                    {
                        _lastGameUrl = src;
                        return true;
                    }
                }
                catch { }
                await Task.Delay(300);
            }
            return false;
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
                    catch { /* bỏ qua */ }
                }

                return res;
            }
            catch (Exception ex)
            {
                Log("[ClickHomeLogo] " + ex);
                return "err:" + ex.Message;
            }
        }



        private void RebuildStakeSeq(string? csv)
        {
            _stakeChains.Clear();

            csv ??= "";
            // chuẩn hoá xuống dòng
            var lines = csv.Replace("\r", "").Split('\n');

            var flat = new System.Collections.Generic.List<long>();

            foreach (var rawLine in lines)
            {
                var line = (rawLine ?? "").Trim();
                if (line.Length == 0) continue;

                // giống nghiệp vụ cũ: tách theo , ; - khoảng trắng
                var parts = System.Text.RegularExpressions.Regex.Split(line, @"[,\s;\-]+");
                var oneChain = new System.Collections.Generic.List<long>();

                foreach (var p in parts)
                {
                    if (string.IsNullOrWhiteSpace(p)) continue;
                    if (long.TryParse(p, out var v) && v >= 0)
                    {
                        oneChain.Add(v);
                    }
                    else
                    {
                        // nếu có số sai thì bỏ qua giống cách cũ, hoặc bạn có thể show lỗi ở LblSeqError
                    }
                }

                if (oneChain.Count > 0)
                {
                    _stakeChains.Add(oneChain.ToArray());
                    flat.AddRange(oneChain);
                }
            }

            // nếu user chỉ nhập 1 dòng như cũ thì _stakeChains sẽ chỉ có 1 phần tử
            _stakeSeq = flat.Count > 0 ? flat.ToArray() : new long[] { 1000 };

            // tính tổng từng chuỗi để dùng cho điều kiện "chuỗi sau thắng >= tổng chuỗi trước"
            _stakeChainTotals = _stakeChains
                .Select(ch => ch.Aggregate(0L, (s, x) => s + x))
                .ToArray();

            // cập nhật UI hiển thị lỗi nếu cần
            ShowSeqError(null);
        }




        private async void TxtStakeCsv_TextChanged(object sender, TextChangedEventArgs e)
        {
            if (!_uiReady || _tabSwitching) return;

            _stakeCts = await DebounceAsync(_stakeCts, 150, async () =>
            {
                var csv = (TxtStakeCsv?.Text ?? "1000,2000,4000,8000,16000").Trim();

                RebuildStakeSeq(csv);

                var id = GetMoneyStrategyFromUI();
                _cfg.StakeCsv = csv; // vẫn lưu bản hiện hành
                _cfg.StakeCsvByMoney ??= new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                if (!string.IsNullOrWhiteSpace(id)) _cfg.StakeCsvByMoney[id] = csv;

                await SaveConfigAsync();
                Log($"[StakeCsv] updated[{id}]: {csv} -> seq[{_stakeSeq.Length}]");
            });

        }

        private async void TxtSideRatio_TextChanged(object sender, TextChangedEventArgs e)
        {
            if (!_uiReady || _tabSwitching) return;

            _sideRateCts = await DebounceAsync(_sideRateCts, 150, async () =>
            {
                var txt = (TxtSideRatio?.Text ?? "").Trim();
                _cfg.SideRateText = txt;
                await SaveConfigAsync();
                ShowErrorsForCurrentStrategy();
            });
        }

        private async void BtnResetSideRatio_Click(object sender, RoutedEventArgs e)
        {
            if (TxtSideRatio != null)
                TxtSideRatio.Text = "";

            _cfg.SideRateText = "";
            await SaveConfigAsync();
            ShowErrorsForCurrentStrategy();
        }

        private void UpdateBetStrategyUi()
        {
            try
            {
                var idx = CmbBetStrategy?.SelectedIndex ?? 4;
                if (RowChuoiCau != null)
                    RowChuoiCau.Visibility = (idx == 0 || idx == 2) ? Visibility.Visible : Visibility.Collapsed; // 1 hoặc 3
                if (RowTheCau != null)
                    RowTheCau.Visibility = (idx == 1 || idx == 3) ? Visibility.Visible : Visibility.Collapsed;   // 2 hoặc 4
                if (RowSideRatio != null)
                    RowSideRatio.Visibility = Visibility.Collapsed;
            }
            catch { }
        }

        async void CmbBetStrategy_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            UpdateBetStrategyUi();
            SyncStrategyFieldsToUI();
            UpdateTooltips();
            ShowErrorsForCurrentStrategy();   // <— thêm dòng này

            if (!_uiReady || _tabSwitching) return;
            _cfg.BetStrategyIndex = CmbBetStrategy?.SelectedIndex ?? 4;
            await SaveConfigAsync();
        }

        private WebView2? GetBetWebView()
        {
            if (IsPopupBetViewActive())
                return _popupWeb;
            if (Web?.CoreWebView2 != null)
                return Web;
            if (_popupWeb?.CoreWebView2 != null)
                return _popupWeb;
            return null;
        }

        private bool IsPopupBetViewActive()
        {
            if (_popupWeb?.CoreWebView2 == null)
                return false;
            if (PopupHost?.Visibility == Visibility.Visible)
                return true;
            if (Web != null && Web.Visibility != Visibility.Visible)
                return true;
            return false;
        }

        private string GetBetWebViewName(WebView2? view)
        {
            if (ReferenceEquals(view, _popupWeb))
                return "PopupWeb";
            if (ReferenceEquals(view, Web))
                return "Web";
            return "UnknownWeb";
        }

        private string GetBetWebViewSource(WebView2? view)
        {
            try
            {
                return view?.CoreWebView2?.Source ?? "";
            }
            catch
            {
                return "";
            }
        }

        private static bool IsLikelyBetGameUrl(string? rawUrl)
        {
            return IsLikelyBetGameReadyUrl(rawUrl) || IsLikelyBetGatewayUrl(rawUrl);
        }

        private static bool IsLikelyGame8bPopupUrl(string? rawUrl)
        {
            if (string.IsNullOrWhiteSpace(rawUrl))
                return false;
            if (!Uri.TryCreate(rawUrl, UriKind.Absolute, out var u))
                return false;

            var host = (u.Host ?? "").ToLowerInvariant();
            return string.Equals(host, "app.lucky-wheel.game8b.com", StringComparison.OrdinalIgnoreCase);
        }

        private static bool IsLikelyBetGameReadyUrl(string? rawUrl)
        {
            if (string.IsNullOrWhiteSpace(rawUrl))
                return false;
            if (!Uri.TryCreate(rawUrl, UriKind.Absolute, out var u))
                return false;
            var host = (u.Host ?? "").ToLowerInvariant();
            if (host.StartsWith("bpweb.") || host.StartsWith("games."))
                return true;
            if (IsLikelyGame8bPopupUrl(rawUrl))
                return true;
            var path = u.AbsolutePath ?? "";
            if (path.IndexOf("/player/webMain.jsp", StringComparison.OrdinalIgnoreCase) >= 0)
                return true;
            if (path.IndexOf("/player/singleBacTable.jsp", StringComparison.OrdinalIgnoreCase) >= 0)
                return true;
            if (path.IndexOf("/player/gamehall.jsp", StringComparison.OrdinalIgnoreCase) >= 0)
                return true;
            return false;
        }

        private static bool IsLikelyBetGatewayUrl(string? rawUrl)
        {
            if (string.IsNullOrWhiteSpace(rawUrl))
                return false;
            if (!Uri.TryCreate(rawUrl, UriKind.Absolute, out var u))
                return false;
            var path = u.AbsolutePath ?? "";
            if (path.IndexOf("/player/login/apiLogin", StringComparison.OrdinalIgnoreCase) >= 0)
                return true;
            return false;
        }

        private static bool TryParseProviderErrorUrl(string? rawUrl, out string status, out string desc, out string externalUrl)
        {
            status = "";
            desc = "";
            externalUrl = "";
            if (string.IsNullOrWhiteSpace(rawUrl))
                return false;
            if (!Uri.TryCreate(rawUrl, UriKind.Absolute, out var u))
                return false;

            var path = u.AbsolutePath ?? "";
            if (path.IndexOf("/error", StringComparison.OrdinalIgnoreCase) < 0)
                return false;

            status = GetQueryParamValue(u, "status");
            desc = GetQueryParamValue(u, "desc");
            externalUrl = GetQueryParamValue(u, "externalUrl");
            return true;
        }

        private static string GetQueryParamValue(Uri u, string key)
        {
            try
            {
                var q = u.Query ?? "";
                if (string.IsNullOrWhiteSpace(q))
                    return "";
                if (q.StartsWith("?", StringComparison.Ordinal))
                    q = q.Substring(1);
                var segs = q.Split('&', StringSplitOptions.RemoveEmptyEntries);
                for (var i = 0; i < segs.Length; i++)
                {
                    var part = segs[i];
                    var idx = part.IndexOf('=');
                    var k = idx >= 0 ? part.Substring(0, idx) : part;
                    var v = idx >= 0 ? part.Substring(idx + 1) : "";
                    k = Uri.UnescapeDataString((k ?? "").Replace('+', ' '));
                    if (!string.Equals(k, key, StringComparison.OrdinalIgnoreCase))
                        continue;
                    return Uri.UnescapeDataString((v ?? "").Replace('+', ' '));
                }
            }
            catch { }
            return "";
        }

        private static bool IsPlayerFlowUrl(string? url)
        {
            if (string.IsNullOrWhiteSpace(url))
                return false;
            return
                url.IndexOf("/player/login/apilogin", StringComparison.OrdinalIgnoreCase) >= 0 ||
                url.IndexOf("/player/webmain.jsp", StringComparison.OrdinalIgnoreCase) >= 0 ||
                url.IndexOf("/player/gamehall.jsp", StringComparison.OrdinalIgnoreCase) >= 0 ||
                url.IndexOf("/player/singlebactable.jsp", StringComparison.OrdinalIgnoreCase) >= 0 ||
                IsLikelyGame8bPopupUrl(url) ||
                url.IndexOf("/error?", StringComparison.OrdinalIgnoreCase) >= 0;
        }

        private static string TryExtractHost(string? rawUrl)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(rawUrl))
                    return "";
                return Uri.TryCreate(rawUrl, UriKind.Absolute, out var u) ? (u.Host ?? "") : "";
            }
            catch
            {
                return "";
            }
        }

        private string GetCurrentMainHost()
        {
            try
            {
                var src = Web?.CoreWebView2?.Source ?? Web?.Source?.ToString() ?? "";
                return TryExtractHost(src);
            }
            catch
            {
                return "";
            }
        }

        private void ResetPlayerFlowGameCache(string reason)
        {
            string prevUrl;
            DateTime prevAt;
            lock (_playerFlowCacheLock)
            {
                prevUrl = _lastPlayerFlowGameUrl;
                prevAt = _lastPlayerFlowGameAtUtc;
                _lastPlayerFlowGameUrl = "";
                _lastPlayerFlowGameAtUtc = DateTime.MinValue;
                _lastPlayerFlowSourceHost = "";
            }

            if (!string.IsNullOrWhiteSpace(prevUrl))
            {
                var age = prevAt == DateTime.MinValue ? "-" : (DateTime.UtcNow - prevAt).TotalSeconds.ToString("0.0", CultureInfo.InvariantCulture) + "s";
                Log("[PlayerFlowCache] cleared reason=" + reason + " | age=" + age + " | prev=" + Shrink(prevUrl, 220));
            }
        }

        private void RememberPlayerFlowGameUrl(string? url)
        {
            if (string.IsNullOrWhiteSpace(url))
                return;
            if (!IsLikelyBetGameReadyUrl(url))
                return;

            var now = DateTime.UtcNow;
            var sourceHost = GetCurrentMainHost();
            if (string.IsNullOrWhiteSpace(sourceHost))
                sourceHost = TryExtractHost(url);

            string prevUrl;
            lock (_playerFlowCacheLock)
            {
                prevUrl = _lastPlayerFlowGameUrl;
                _lastPlayerFlowGameUrl = url.Trim();
                _lastPlayerFlowGameAtUtc = now;
                _lastPlayerFlowSourceHost = sourceHost;
            }

            if (!string.Equals(prevUrl, url, StringComparison.OrdinalIgnoreCase))
            {
                Log("[PlayerFlowCache] game-url=" + Shrink(url, 260) + " | host=" + (string.IsNullOrWhiteSpace(sourceHost) ? "-" : sourceHost));
            }
        }

        private bool TryGetRecentPlayerFlowGameUrl(int maxAgeSeconds, out string url, out string reason)
        {
            url = "";
            reason = "empty";

            string cachedUrl;
            DateTime cachedAt;
            string cachedHost;
            lock (_playerFlowCacheLock)
            {
                cachedUrl = _lastPlayerFlowGameUrl;
                cachedAt = _lastPlayerFlowGameAtUtc;
                cachedHost = _lastPlayerFlowSourceHost;
            }

            if (string.IsNullOrWhiteSpace(cachedUrl))
            {
                reason = "empty";
                return false;
            }

            var age = cachedAt == DateTime.MinValue ? TimeSpan.MaxValue : (DateTime.UtcNow - cachedAt);
            if (age > TimeSpan.FromSeconds(Math.Max(1, maxAgeSeconds)))
            {
                reason = "stale age=" + age.TotalSeconds.ToString("0.0", CultureInfo.InvariantCulture) + "s";
                return false;
            }

            var currentHost = GetCurrentMainHost();
            if (!string.IsNullOrWhiteSpace(cachedHost) &&
                !string.IsNullOrWhiteSpace(currentHost) &&
                !string.Equals(cachedHost, currentHost, StringComparison.OrdinalIgnoreCase))
            {
                reason = "host-mismatch cached=" + cachedHost + " current=" + currentHost;
                return false;
            }

            url = cachedUrl;
            reason = "ok age=" + age.TotalSeconds.ToString("0.0", CultureInfo.InvariantCulture) + "s";
            return true;
        }

        private async Task<bool> TryRouteRecentPlayerFlowGameToPopupAsync(int maxAgeSeconds = 300)
        {
            if (!TryGetRecentPlayerFlowGameUrl(maxAgeSeconds, out var entryUrl, out var cacheReason))
            {
                Log("[VaoXocDia] player-flow cache miss: " + cacheReason);
                return false;
            }

            var popup = await EnsurePopupWebReadyAsync();
            if (popup?.CoreWebView2 == null)
            {
                Log("[VaoXocDia] player-flow cache route: popup web not ready.");
                return false;
            }

            await Dispatcher.InvokeAsync(() =>
            {
                if (Web != null) Web.Visibility = Visibility.Collapsed;
                if (PopupHost != null) PopupHost.Visibility = Visibility.Visible;
                popup.CoreWebView2.Navigate(entryUrl);
                popup.Focus();
            });

            Log("[VaoXocDia] player-flow cache routed popup to: " + entryUrl);
            return true;
        }

        private const string HostLaunchProbeScript = @"
(function(){
  try{
    function norm(s){ try{ return (s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[đĐ]/g,'d'); }catch(_){ return String(s||'').replace(/[đĐ]/g,'d'); } }
    function low(s){ return norm(String(s||'').trim().toLowerCase()); }
    var out = {
      href: String(location.href||''),
      ready: String(document.readyState||''),
      frameCount: 0,
      hasApiLogin: false,
      hasWebMain: false,
      hasGameHall: false,
      hasSingleBac: false,
      frames: [],
      xocDiaHits: []
    };
    var frames = Array.from(document.querySelectorAll('iframe,frame'));
    out.frameCount = frames.length;
    for (var i=0;i<frames.length;i++){
      var el = frames[i];
      var src = String((el.getAttribute('src') || el.src || '')).trim();
      var l = src.toLowerCase();
      if (l.indexOf('/player/login/apilogin') >= 0) out.hasApiLogin = true;
      if (l.indexOf('/player/webmain.jsp') >= 0) out.hasWebMain = true;
      if (l.indexOf('/player/gamehall.jsp') >= 0) out.hasGameHall = true;
      if (l.indexOf('/player/singlebactable.jsp') >= 0) out.hasSingleBac = true;
      out.frames.push({ i:i, src:src });
    }
    var cands = Array.from(document.querySelectorAll('a,button,[role=""button""],.item-live,.item-live .title,.livestream-section__live .item-live'));
    for (var j=0;j<cands.length && out.xocDiaHits.length<6;j++){
      var c = cands[j];
      var txt = low(c.textContent || c.innerText || c.getAttribute('title') || c.getAttribute('aria-label') || '');
      if (!txt) continue;
      if (txt.indexOf('xoc') >= 0 && txt.indexOf('dia') >= 0){
        var r = c.getBoundingClientRect();
        var anc = (c.closest && c.closest('a[href]')) || (String(c.tagName||'').toUpperCase()==='A' ? c : null);
        out.xocDiaHits.push({
          tag: String(c.tagName || ''),
          txt: txt.slice(0, 80),
          vis: (r.width > 4 && r.height > 4),
          cls: String(c.className || '').slice(0, 80),
          href: anc ? String(anc.getAttribute('href') || '').slice(0, 160) : ''
        });
      }
    }
    return JSON.stringify(out);
  }catch(e){
    return JSON.stringify({ err: String((e && e.message) ? e.message : e) });
  }
})();";

        private async Task<string> GetHostLaunchProbePayloadAsync()
        {
            try
            {
                var payload = await ExecJsAsyncStr(HostLaunchProbeScript);
                return string.IsNullOrWhiteSpace(payload) ? "{}" : Shrink(payload, 1600);
            }
            catch (Exception ex)
            {
                return "{\"err\":\"" + Shrink(ex.Message, 180).Replace("\"", "'") + "\"}";
            }
        }

        private async Task LogHostLaunchProbeAsync(string stage)
        {
            try
            {
                var payload = await GetHostLaunchProbePayloadAsync();
                var key = "HostLaunchProbe|" + stage + "|" + payload;
                if (_bridgeProbeSeen.TryAdd(key, 1))
                    Log("[HostLaunchProbe] stage=" + stage + " | " + payload);
            }
            catch (Exception ex)
            {
                Log("[HostLaunchProbe] stage=" + stage + " | err=" + ex.Message);
            }
        }

        private async Task TraceHostLaunchAfterClickAsync(string stage, int totalMs = 12000, int stepMs = 1500)
        {
            try
            {
                string last = "";
                int unchanged = 0;
                var t0 = DateTime.UtcNow;
                while ((DateTime.UtcNow - t0).TotalMilliseconds < totalMs)
                {
                    var payload = await GetHostLaunchProbePayloadAsync();
                    var elapsed = (int)(DateTime.UtcNow - t0).TotalMilliseconds;
                    if (!string.Equals(payload, last, StringComparison.Ordinal))
                    {
                        last = payload;
                        unchanged = 0;
                        Log($"[HostLaunchProbe] stage={stage} | t={elapsed}ms | {payload}");
                    }
                    else
                    {
                        unchanged++;
                        if (unchanged % 4 == 0)
                            Log($"[HostLaunchProbe] stage={stage} | t={elapsed}ms | unchanged x{unchanged}");
                    }
                    await Task.Delay(stepMs);
                }
            }
            catch (Exception ex)
            {
                Log("[HostLaunchProbe] trace err: " + ex.Message);
            }
        }

        private bool HasRecentGameSignal(out string reason)
        {
            reason = "none";
            var now = DateTime.UtcNow;
            var tickAge = now - _lastGameTickUtc;

            var snap = CloneAuthoritativeRawSnap();
            var seqLen = snap?.seq?.Length ?? 0;
            bool hasSnapData =
                snap?.prog.HasValue == true ||
                !string.IsNullOrWhiteSpace(snap?.status) ||
                seqLen > 0 ||
                !string.IsNullOrWhiteSpace(snap?.progSource) ||
                !string.IsNullOrWhiteSpace(snap?.statusSource);

            // Tránh nhận nhầm "ready" khi chỉ có tick từ lobby nhưng chưa có data game.
            if (!hasSnapData)
            {
                if (_lastGameTickUtc != DateTime.MinValue && tickAge <= TimeSpan.FromSeconds(4))
                    reason = $"tick-no-data age={tickAge.TotalSeconds:0.0}s";
                return false;
            }

            if (_lastGameTickUtc != DateTime.MinValue && tickAge <= TimeSpan.FromSeconds(4))
            {
                reason = $"tick-age={tickAge.TotalSeconds:0.0}s seqLen={seqLen}";
                return true;
            }

            if (_lastGameTickUtc != DateTime.MinValue &&
                tickAge <= TimeSpan.FromSeconds(15))
            {
                reason = $"snap seqLen={seqLen} tickAge={tickAge.TotalSeconds:0.0}s";
                return true;
            }
            return false;
        }

        private async Task<bool> WaitForGameSignalAsync(int timeoutMs = 6000)
        {
            var t0 = DateTime.UtcNow;
            while ((DateTime.UtcNow - t0).TotalMilliseconds < timeoutMs)
            {
                if (HasRecentGameSignal(out _))
                    return true;
                await Task.Delay(250);
            }
            if (HasRecentGameSignal(out var reason))
            {
                Log("[WaitForGameSignal] became-ready-at-timeout-edge | " + reason);
                return true;
            }
            Log("[WaitForGameSignal] timeout=" + timeoutMs + "ms");
            return false;
        }

        private async Task<string> ForceReloadLikelyGameIframeAsync()
        {
            try
            {
                if (Web?.CoreWebView2 == null)
                    return "web-null";
                const string js = @"
(function(){
  try{
    var els = Array.from(document.querySelectorAll('iframe,frame'));
    if (!els.length) return 'no-frame';
    var best = null, bestScore = -1, bestSrc = '';
    for (var i=0;i<els.length;i++){
      var el = els[i];
      var src = String((el.getAttribute('src') || el.src || '')).trim();
      var s = 0;
      var u = src.toLowerCase();
      if (!src || src === 'about:blank') {
        try{
          var r0 = el.getBoundingClientRect();
          if (r0.width > 360 && r0.height > 220){
            try{
              // Khung cross-origin lớn nhưng src rỗng: thường là wrapper game.
              var _x = el.contentWindow.location.href;
            }catch(_){
              s += 45;
            }
          }
        }catch(_){}
      }
      if (u){
        if (u.indexOf('recaptcha') >= 0) continue;
        if (u.indexOf('google.com/recaptcha') >= 0) continue;
        if (u.indexOf('doubleclick') >= 0) continue;
        if (u.indexOf('googletagmanager') >= 0) continue;
      }
      if (u.indexOf('/player/login/apilogin') >= 0) s += 100;
      if (u.indexOf('/player/gamehall.jsp') >= 0) s += 90;
      if (u.indexOf('/player/singlebactable.jsp') >= 0) s += 80;
      if (u.indexOf('/player/webmain.jsp') >= 0) s += 70;
      if (u.indexOf('usplaynet.com') >= 0) s += 30;
      if (u.indexOf('balikko.com') >= 0) s += 20;
      if (u.indexOf('restula.com') >= 0) s += 20;
      if (u.indexOf('atllat.com') >= 0) s += 20;
      if (u.indexOf('bpweb.') >= 0) s += 20;
      try{
        var r = el.getBoundingClientRect();
        if (r.width > 260 && r.height > 180) s += 6;
      }catch(_){}
      if (s > bestScore){ bestScore = s; best = el; bestSrc = src; }
    }
    if (!best) return 'no-candidate';
    if (bestScore < 25) return 'no-likely-candidate';
    if (!bestSrc || bestSrc === 'about:blank'){
      try{
        if (best.contentWindow && best.contentWindow.location && best.contentWindow.location.reload){
          best.contentWindow.location.reload();
          return 'reloaded:contentWindow';
        }
      }catch(_){}
      return 'no-src';
    }
    try{
      best.setAttribute('src', 'about:blank');
      best.src = 'about:blank';
    }catch(_){}
    setTimeout(function(){
      try{
        best.setAttribute('src', bestSrc);
        best.src = bestSrc;
      }catch(_){}
    }, 80);
    return 'reloaded:' + bestSrc;
  }catch(e){
    return 'err:' + ((e && e.message) ? e.message : String(e));
  }
})();";
                var res = await Web.ExecuteScriptAsync(js);
                var text = (JsonSerializer.Deserialize<string>(res) ?? "").Trim();
                if (string.IsNullOrWhiteSpace(text)) text = "reload-null";
                Log("[ForceReloadIframe] " + text);
                return text;
            }
            catch (Exception ex)
            {
                Log("[ForceReloadIframe] " + ex.Message);
                return "err:" + ex.Message;
            }
        }

        private async Task<bool> WaitForBetGameUrlAsync(int timeoutMs = 12000)
        {
            var t0 = DateTime.UtcNow;
            while ((DateTime.UtcNow - t0).TotalMilliseconds < timeoutMs)
            {
                if (HasRecentGameSignal(out _))
                    return true;
                var bet = GetBetWebView();
                var src = GetBetWebViewSource(bet);
                if (IsLikelyBetGameReadyUrl(src))
                    return true;
                await Task.Delay(300);
            }
            if (HasRecentGameSignal(out var reason))
            {
                Log("[WaitForBetGameUrl] became-ready-at-timeout-edge | " + reason);
                return true;
            }
            try
            {
                var bet = GetBetWebView();
                Log("[WaitForBetGameUrl] timeout=" + timeoutMs + "ms | bet=" + GetBetWebViewName(bet) + " | src=" + GetBetWebViewSource(bet));
                await LogHostLaunchProbeAsync("wait-timeout");
            }
            catch { }
            return false;
        }

        private async Task<string> GetBestGameIframeUrlFromHostAsync()
        {
            try
            {
                if (Web?.CoreWebView2 == null) return "";
                const string js = @"
(function(){
  try{
    var els = Array.from(document.querySelectorAll('iframe,frame'));
    var best = '';
    var bestScore = -1;
    for (var i=0;i<els.length;i++){
      var el = els[i];
      var src = String((el && (el.src || el.getAttribute('src'))) || '').trim();
      if (!src) continue;
      var u = src.toLowerCase();
      var s = 0;
      if (u.indexOf('/player/singlebactable.jsp') >= 0) s += 100;
      if (u.indexOf('/player/webmain.jsp') >= 0) s += 90;
      if (u.indexOf('/player/gamehall.jsp') >= 0) s += 80;
      if (u.indexOf('/player/login/apilogin') >= 0) s += 70;
      if (u.indexOf('app.lucky-wheel.game8b.com') >= 0) s += 95;
      if (u.indexOf('game8b.com') >= 0) s += 35;
      if (u.indexOf('bpweb.') >= 0) s += 40;
      if (u.indexOf('usplaynet.com') >= 0) s += 30;
      if (u.indexOf('balikko.com') >= 0) s += 30;
      if (u.indexOf('barppat.com') >= 0) s += 30;
      if (s > bestScore){ bestScore = s; best = src; }
    }
    return best || '';
  }catch(_){ return ''; }
})();";
                var raw = await Web.ExecuteScriptAsync(js);
                return (JsonSerializer.Deserialize<string>(raw) ?? "").Trim();
            }
            catch (Exception ex)
            {
                Log("[VaoXocDia][iframe-url] " + ex.Message);
                return "";
            }
        }

        private async Task<bool> TryRouteHostIframeToPopupAsync()
        {
            var entryUrl = await GetBestGameIframeUrlFromHostAsync();
            if (string.IsNullOrWhiteSpace(entryUrl))
            {
                Log("[VaoXocDia] iframe fallback: no candidate iframe url.");
                return false;
            }

            if (IsLikelyBetGatewayUrl(entryUrl))
            {
                Log("[VaoXocDia] iframe fallback: candidate is gateway apiLogin, skip popup routing to avoid provider token mismatch.");
                return false;
            }

            var popup = await EnsurePopupWebReadyAsync();
            if (popup?.CoreWebView2 == null)
            {
                Log("[VaoXocDia] iframe fallback: popup web not ready.");
                return false;
            }

            await Dispatcher.InvokeAsync(() =>
            {
                if (Web != null) Web.Visibility = Visibility.Collapsed;
                if (PopupHost != null) PopupHost.Visibility = Visibility.Visible;
                popup.CoreWebView2.Navigate(entryUrl);
                popup.Focus();
            });

            Log("[VaoXocDia] iframe fallback routed popup to: " + entryUrl);
            return true;
        }

        private (bool ok, string reason) GetBetPipeReadyState(StrategyTabState tab, long runId)
        {
            if (tab == null)
                return (false, "tab-null");
            if (tab.RunId != runId)
                return (false, $"stale-run current={tab.RunId} expect={runId}");
            if (tab.TaskCts == null || tab.TaskCts.IsCancellationRequested || !tab.IsRunning)
                return (false, "task-not-running");

            var now = DateTime.UtcNow;
            if (_betWebNavigatingSinceUtc != DateTime.MinValue &&
                (now - _betWebNavigatingSinceUtc) < TimeSpan.FromSeconds(5))
            {
                return (false, $"nav-in-flight age={(now - _betWebNavigatingSinceUtc).TotalSeconds:0.0}s");
            }

            if (_betWebLastNavDoneUtc != DateTime.MinValue &&
                (now - _betWebLastNavDoneUtc) < TimeSpan.FromMilliseconds(800))
            {
                return (false, $"nav-cooldown age={(now - _betWebLastNavDoneUtc).TotalMilliseconds:0}ms");
            }

            // Guard: chỉ cho phép tối đa 1 lệnh đang chờ settle ở chế độ thường.
            // Điều này ngăn trường hợp restart run nhưng hàng chờ cũ còn tồn tại, dẫn tới dồn kết quả (push bù).
            if (!HasJackpotMultiSideRunning() && _pendingRows.Count > 0)
            {
                var oldest = _pendingRows[0];
                var ageSec = Math.Max(0, (DateTime.Now - oldest.At).TotalSeconds);
                return (false, $"pending-unsettled count={_pendingRows.Count} age={ageSec:0}s round={oldest.IssuedRoundId}");
            }

            var betWeb = GetBetWebView();
            if (betWeb?.CoreWebView2 == null)
                return (false, "bet-web-null");
            var src = GetBetWebViewSource(betWeb);
            var tickAge = now - _lastGameTickUtc;
            bool srcGameReady = IsLikelyBetGameReadyUrl(src);
            if (!srcGameReady && tickAge > TimeSpan.FromSeconds(6))
                return (false, $"bet-src-not-game src={src}");
            if (!srcGameReady && tickAge <= TimeSpan.FromSeconds(6))
            {
                var nowMs = Environment.TickCount64;
                var lastMs = _logThrottleLastMs.TryGetValue("BETPIPE_ALLOW_TICK", out var lv) ? lv : 0;
                if ((nowMs - lastMs) >= 1500)
                {
                    _logThrottleLastMs["BETPIPE_ALLOW_TICK"] = nowMs;
                    Log("[BetPipe] allow-by-recent-tick | src=" + src + " | tickAge=" + tickAge.TotalSeconds.ToString("0.0", CultureInfo.InvariantCulture) + "s");
                }
            }

            if (tickAge > TimeSpan.FromSeconds(6))
                return (false, $"tick-stale age={tickAge.TotalSeconds:0.0}s");

            var snap = CloneAuthoritativeRawSnap();
            bool hasSnapData =
                snap?.prog.HasValue == true ||
                !string.IsNullOrWhiteSpace(snap?.status) ||
                !string.IsNullOrWhiteSpace(snap?.seq);
            if (!hasSnapData)
                return (false, "snap-empty");

            return (true, "ok");
        }

        private void AutoStopTasksOnBetPipelineReset(string reason, string src)
        {
            if (!string.IsNullOrWhiteSpace(reason) &&
                reason.StartsWith("popup-nav", StringComparison.OrdinalIgnoreCase))
            {
                ClearObservedContext($"auto-stop:{reason}");
            }
            ResetSeqSyncState($"auto-stop:{reason}", clearPendingRows: false, forceLog: false);
            if (!IsAnyTabRunning()) return;
            var now = DateTime.UtcNow;
            if ((now - _lastAutoStopByNavUtc) < TimeSpan.FromSeconds(2))
                return;
            _lastAutoStopByNavUtc = now;

            var runningTabs = _strategyTabs.Where(t => t.IsRunning || t.TaskCts != null).ToList();
            if (runningTabs.Count == 0) return;

            Log($"[Loop][AUTO-STOP] reason={reason} | src={src} | tabs={runningTabs.Count}");
            foreach (var tab in runningTabs)
            {
                Log($"[Loop][AUTO-STOP] tab={tab.Name} | run={tab.RunId}");
                StopTask(tab);
            }
            BaccaratViVoGaming.Tasks.TaskUtil.ClearBetCooldown();
            SetPlayButtonState(_activeTab?.IsRunning == true);
        }

        private void ResetSeqSyncState(string reason, bool clearPendingRows = false, bool forceLog = false)
        {
            int prevLen;
            long prevVer;
            string prevEvt;
            bool prevLock;
            int pendingBefore;
            int pendingAfter;
            bool hadState;
            lock (_roundStateLock)
            {
                prevLen = _baseSeqDisplay?.Length ?? 0;
                prevVer = _baseSeqVersion;
                prevEvt = _baseSeqEvent ?? "";
                prevLock = _lockMajorMinorUpdates;
                pendingBefore = _pendingRows.Count;

                hadState = prevLen > 0 ||
                           prevVer > 0 ||
                           prevLock ||
                           _roundTotalsB != 0 ||
                           _roundTotalsP != 0 ||
                           _roundTotalsT != 0 ||
                           pendingBefore > 0;

                _baseSeq = "";
                _baseSeqDisplay = "";
                _baseSeqVersion = 0;
                _baseSeqEvent = "";
                _baseSeqSource = "js";
                _boardSeqDisplay = "";
                _boardSeqVersion = 0;
                _boardSeqEvent = "";
                _syncSeqPrefixDisplay = "";
                _netSeqDisplay = "";
                _netSeqVersion = 0;
                _netSeqEvent = "";
                _netSeqSource = "";
                _netSeqTableId = 0;
                _netSeqGameShoe = 0;
                _netSeqLastRound = 0;
                _netLastWinnerKey = "";
                _netLastWinnerAt = DateTime.MinValue;
                _roundTotalsB = 0;
                _roundTotalsP = 0;
                _roundTotalsT = 0;
                _lockMajorMinorUpdates = false;
                _lastSeqLenNi = 0;
                _lastSeqRxLen = -1;
                _lastSeqRxVer = -1;
                _lastSeqRxEvt = "";
                _lastSeqRxTail = '\0';
                _lastSeqRxPending = -1;
                _lastSeqRxLock = false;
                _lastAdvanceRejectVersionOnlyVer = -1;
                _shoeChangeStatusStreak = 0;
                _shoeChangeRebaseArmed = false;
                _shoeChangeLastSeenUtc = DateTime.MinValue;
                _shoeChangeRebaseArmedAtUtc = DateTime.MinValue;
                _shoeChangeArmSource = "";
                _shoeChangeArmEvent = "";
                _lastShoeRebaseAppliedUtc = DateTime.MinValue;
                _lastShoeRebaseAppliedLen = 0;
                _lastBaccaratFrameKey = "";
                _lastBaccaratFrameHref = "";
                _tableSwitchRebaseArmed = false;
                _tableSwitchRebaseArmedAtUtc = DateTime.MinValue;
                _tableSwitchFromKey = "";
                _tableSwitchToKey = "";
                _tableSwitchFromHref = "";
                _tableSwitchToHref = "";
                _lastHistAlertUtc = DateTime.MinValue;

                if (clearPendingRows && _pendingRows.Count > 0)
                    _pendingRows.Clear();

                pendingAfter = _pendingRows.Count;
            }

            if (forceLog || hadState || clearPendingRows)
            {
                Log($"[SEQ][CTX-RESET] reason={reason} | prevLen={prevLen} | prevVer={prevVer} | prevEvt={(string.IsNullOrWhiteSpace(prevEvt) ? "-" : prevEvt)} | prevLock={(prevLock ? 1 : 0)} | pending={pendingBefore}->{pendingAfter} | clearPending={(clearPendingRows ? 1 : 0)}");
            }
        }

        private async void PopupFrame_WebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
        {
            try
            {
                var msg = e.TryGetWebMessageAsString() ?? "";
                if (string.IsNullOrWhiteSpace(msg)) return;
                await HandleIncomingWebMessageAsync(msg, "popup-frame");
            }
            catch (Exception ex)
            {
                Log("[PopupFrame.WebMessageReceived] " + ex);
            }
        }

        private static string BridgeProbeScript => @"
(function(){
  try{
    function safe(fn, def){ try{ return fn(); }catch(_){ return def; } }
    function t(v){ return typeof v; }
    var href = safe(function(){ return String(location.href||''); }, '');
    var out = {
      href: href,
      top: safe(function(){ return (window.top===window)?1:0; }, -1),
      hasWV: safe(function(){ return !!(window.chrome && window.chrome.webview && window.chrome.webview.postMessage); }, false),
      cmdHooked: safe(function(){ return window.__cw_cmd_hooked; }, null),
      waiting: safe(function(){ return window.__cw_waiting_v4; }, null),
      nsType: safe(function(){ return t(window['__cw_allin_one_v9_textmap_compat_TKFIX_xTail_STD_v2']); }, 'undefined'),
      read: safe(function(){ return t(window.__cw_readSnapshot); }, 'undefined'),
      start: safe(function(){ return t(window.__cw_startPush); }, 'undefined'),
      bet: safe(function(){ return t(window.__cw_bet); }, 'undefined'),
      hasCC: safe(function(){ return !!(window.cc && cc.director && cc.director.getScene); }, false),
      frameCount: safe(function(){ return (window.frames && window.frames.length) || 0; }, 0),
      frames: []
    };
    try{
      var els = Array.from(document.querySelectorAll('iframe,frame'));
      for (var i=0;i<els.length;i++){
        var el = els[i];
        var row = { i:i, srcAttr:String(el.getAttribute('src')||''), sameOrigin:null, href:'', read:'', start:'', bet:'', err:'' };
        try{
          var w = el.contentWindow;
          row.href = String((w.location && w.location.href) || '');
          row.sameOrigin = true;
          row.read = t(w.__cw_readSnapshot);
          row.start = t(w.__cw_startPush);
          row.bet = t(w.__cw_bet);
        }catch(e){
          row.sameOrigin = false;
          row.err = String((e && e.message) ? e.message : e);
        }
        out.frames.push(row);
      }
    }catch(_){}
    return JSON.stringify(out);
  }catch(e){
    return JSON.stringify({ err:String((e&&e.message)?e.message:e) });
  }
})();";

        private async Task LogBridgeProbeOnWebViewAsync(WebView2? view, string stage, string owner)
        {
            try
            {
                if (view?.CoreWebView2 == null)
                {
                    Log($"[BridgeProbe] stage={stage} | owner={owner} | core=null");
                    return;
                }
                var raw = await view.ExecuteScriptAsync(BridgeProbeScript);
                var payload = JsonSerializer.Deserialize<string>(raw) ?? raw ?? "";
                payload = Shrink(payload, 1200);
                var key = $"{owner}|{stage}|{payload}";
                if (_bridgeProbeSeen.TryAdd(key, 1))
                    Log($"[BridgeProbe] stage={stage} | owner={owner} | {payload}");
            }
            catch (Exception ex)
            {
                Log($"[BridgeProbe] stage={stage} | owner={owner} | err={ex.Message}");
            }
        }

        private async Task LogBridgeProbeAsync(string stage)
        {
            await Dispatcher.InvokeAsync(async () =>
            {
                var bet = GetBetWebView();
                await LogBridgeProbeOnWebViewAsync(bet, stage + "-bet", GetBetWebViewName(bet));
                if (!ReferenceEquals(bet, Web))
                    await LogBridgeProbeOnWebViewAsync(Web, stage + "-main", "Web");
                if (!ReferenceEquals(bet, _popupWeb))
                    await LogBridgeProbeOnWebViewAsync(_popupWeb, stage + "-popup", "PopupWeb");
            }).Task.Unwrap();
        }

        private void ProbeFrameBridgeAsync(CoreWebView2Frame frame, string owner, string stage)
        {
            _ = Dispatcher.InvokeAsync(async () =>
            {
                try
                {
                    if (frame == null) return;
                    var raw = await frame.ExecuteScriptAsync(BridgeProbeScript);
                    var payload = JsonSerializer.Deserialize<string>(raw) ?? raw ?? "";
                    payload = Shrink(payload, 900);
                    var key = $"{owner}|{stage}|{payload}";
                    if (_bridgeProbeSeen.TryAdd(key, 1))
                        Log($"[BridgeProbe][Frame] owner={owner} | stage={stage} | {payload}");
                }
                catch (Exception ex)
                {
                    if (IsDisposedFrameException(ex))
                    {
                        DropMainFrameRef(frame);
                        DropPopupFrameRef(frame);
                        return;
                    }
                    var key = $"{owner}|{stage}|err:{ex.Message}";
                    if (_bridgeProbeSeen.TryAdd(key, 1))
                        Log($"[BridgeProbe][Frame] owner={owner} | stage={stage} | err={ex.Message}");
                }
            }).Task.Unwrap();
        }

        private List<(ulong id, CoreWebView2Frame frame)> GetMainArmedFramesSnapshot()
        {
            var frames = new List<(ulong id, CoreWebView2Frame frame)>();
            try
            {
                foreach (var id in _mainFrameBridgeArmed.Keys.OrderByDescending(v => v))
                {
                    if (_mainFrameRefs.TryGetValue(id, out var fRef) && fRef != null)
                    {
                        frames.Add((id, fRef));
                        continue;
                    }

                    var f = TryGetFrameByIdSafe(id);
                    if (f != null)
                    {
                        _mainFrameRefs[id] = f;
                        frames.Add((id, f));
                    }
                }
            }
            catch { }
            return frames;
        }

        private static int GetFrameRefKey(CoreWebView2Frame? frame)
        {
            if (frame == null) return 0;
            return RuntimeHelpers.GetHashCode(frame);
        }

        private void TrackPopupFrameRef(CoreWebView2Frame? frame)
        {
            var key = GetFrameRefKey(frame);
            if (key == 0 || frame == null) return;
            _popupFrameRefs[key] = frame;
        }

        private void DropPopupFrameRef(CoreWebView2Frame? frame)
        {
            var key = GetFrameRefKey(frame);
            if (key == 0) return;
            _popupFrameRefs.TryRemove(key, out _);
        }

        private List<(int key, CoreWebView2Frame frame)> GetPopupArmedFramesSnapshot()
        {
            var frames = new List<(int key, CoreWebView2Frame frame)>();
            try
            {
                foreach (var kv in _popupFrameRefs.ToArray().OrderByDescending(k => k.Key))
                {
                    if (kv.Value != null)
                        frames.Add((kv.Key, kv.Value));
                }
            }
            catch { }
            return frames;
        }

        private static bool IsBridgeCommandScript(string js)
        {
            return !string.IsNullOrWhiteSpace(js) &&
                   js.IndexOf("__cw_", StringComparison.OrdinalIgnoreCase) >= 0;
        }

        private static string NormalizeJsEvalResult(string raw)
        {
            if (string.IsNullOrWhiteSpace(raw))
                return "";

            var trimmed = raw.Trim();
            try
            {
                var s = JsonSerializer.Deserialize<string>(trimmed);
                if (s != null)
                    return s.Trim();
            }
            catch { }

            return trimmed.Trim().Trim('"');
        }

        private static bool IsBridgeFailureResult(string normalized)
        {
            var t = (normalized ?? "").Trim();
            if (string.IsNullOrEmpty(t))
                return true;

            var lower = t.ToLowerInvariant();
            return lower == "undefined" ||
                   lower == "null" ||
                   lower == "no" ||
                   lower == "{}" ||
                   lower == "[]" ||
                   lower == "false" ||
                   lower.StartsWith("fail:", StringComparison.Ordinal) ||
                   lower.StartsWith("err:", StringComparison.Ordinal);
        }

        private Task<string> ExecuteOnBetWebAsync(string js)
        {
            return Dispatcher.InvokeAsync(async () =>
            {
                var target = GetBetWebView();
                if (target?.CoreWebView2 == null)
                {
                    await EnsureWebReadyAsync();
                    target = GetBetWebView();
                }

                if (target?.CoreWebView2 == null)
                    return "";

                if (!IsBridgeCommandScript(js))
                    return await target.ExecuteScriptAsync(js);

                var usePopupFrames = ReferenceEquals(target, _popupWeb);
                var mainFrames = new List<(ulong id, CoreWebView2Frame frame)>();
                var popupFrames = new List<(int key, CoreWebView2Frame frame)>();

                if (usePopupFrames)
                {
                    popupFrames = GetPopupArmedFramesSnapshot();
                }
                else
                {
                    mainFrames = GetMainArmedFramesSnapshot();
                    if (mainFrames.Count == 0 && IsCurrentHostAllowUnboundHistory())
                    {
                        var reArmed = ReArmExistingMainFrames("exec-bridge-wrapper");
                        if (reArmed > 0)
                            mainFrames = GetMainArmedFramesSnapshot();
                    }
                }

                string firstFrameRaw = "";
                string firstFrameOk = "";

                if (usePopupFrames)
                {
                    foreach (var item in popupFrames)
                    {
                        try
                        {
                            var frameRaw = await item.frame.ExecuteScriptAsync(js);
                            if (string.IsNullOrWhiteSpace(firstFrameRaw))
                                firstFrameRaw = frameRaw;

                            var frameNorm = NormalizeJsEvalResult(frameRaw);
                            if (!IsBridgeFailureResult(frameNorm))
                            {
                                firstFrameOk = frameRaw;
                                break;
                            }
                        }
                        catch (Exception ex)
                        {
                            if (IsDisposedFrameException(ex))
                                _popupFrameRefs.TryRemove(item.key, out _);
                        }
                    }
                }
                else
                {
                    // Với bridge script, ưu tiên chạy trên frame đã armed (host chạy game trong cross-origin frame).
                    foreach (var item in mainFrames)
                    {
                        try
                        {
                            var frameRaw = await item.frame.ExecuteScriptAsync(js);
                            if (string.IsNullOrWhiteSpace(firstFrameRaw))
                                firstFrameRaw = frameRaw;

                            var frameNorm = NormalizeJsEvalResult(frameRaw);
                            if (!IsBridgeFailureResult(frameNorm))
                            {
                                firstFrameOk = frameRaw;
                                break;
                            }
                        }
                        catch (Exception ex)
                        {
                            if (IsDisposedFrameException(ex))
                            {
                                _mainFrameRefs.TryRemove(item.id, out _);
                                _mainFrameBridgeArmed.TryRemove(item.id, out _);
                            }
                        }
                    }
                }

                // Đồng thời vẫn chạy top để giữ tương thích các host cũ chạy game trực tiếp trên top doc.
                string topRaw = "";
                try
                {
                    topRaw = await target.ExecuteScriptAsync(js);
                }
                catch { }

                var topNorm = NormalizeJsEvalResult(topRaw);
                if (!IsBridgeFailureResult(topNorm))
                    return topRaw;
                if (!string.IsNullOrWhiteSpace(firstFrameOk))
                    return firstFrameOk;
                if (!string.IsNullOrWhiteSpace(firstFrameRaw))
                    return firstFrameRaw;
                return topRaw;
            }).Task.Unwrap();
        }

        private async Task<string> ExecuteOnBetWebAwaitResultAsync(string jsExpression, int timeoutMs = 20000)
        {
            var id = Guid.NewGuid().ToString("N");
            var tcs = new TaskCompletionSource<string>(TaskCreationOptions.RunContinuationsAsynchronously);
            _jsAwaiters[id] = tcs;

            var wrapped =
                "(function(){" +
                " try{" +
                "   var __abx_id=" + JsonSerializer.Serialize(id) + ";" +
                "   Promise.resolve((function(){ return " + jsExpression + "; })())" +
                "     .then(function(v){" +
                "       try {" +
                "         window.chrome.webview.postMessage(JSON.stringify({ abx:'result', id: __abx_id, value: (v == null ? '' : String(v)) }));" +
                "       } catch(_) {}" +
                "     })" +
                "     .catch(function(e){" +
                "       try {" +
                "         window.chrome.webview.postMessage(JSON.stringify({ abx:'result', id: __abx_id, value: 'err:' + (e && e.message ? e.message : String(e)) }));" +
                "       } catch(_) {}" +
                "     });" +
                "   return 'pending';" +
                " }catch(e){" +
                "   return 'err:' + (e && e.message ? e.message : String(e));" +
                " }" +
                "})();";

            string raw = "";
            try
            {
                raw = await ExecuteOnBetWebAsync(wrapped);
            }
            catch
            {
                _jsAwaiters.TryRemove(id, out _);
                throw;
            }

            var normalized = (raw ?? "").Trim().Trim('"');
            if (normalized.StartsWith("err:", StringComparison.OrdinalIgnoreCase))
            {
                _jsAwaiters.TryRemove(id, out _);
                return normalized;
            }

            var completed = await Task.WhenAny(tcs.Task, Task.Delay(timeoutMs));
            if (completed == tcs.Task)
            {
                _jsAwaiters.TryRemove(id, out _);
                return await tcs.Task;
            }

            _jsAwaiters.TryRemove(id, out _);
            return "err:timeout";
        }

        private GameContext BuildContext(StrategyTabState tab, long runId, bool useRawWinAmount = false)
        {
            var applyWinTax = !useRawWinAmount;
            var cfg = tab?.Config ?? _cfg;
            var stakeSeq = (tab?.RunStakeSeq != null && tab.RunStakeSeq.Length > 0)
                ? tab.RunStakeSeq
                : (_stakeSeq ?? Array.Empty<long>());
            var stakeChains = (tab?.RunStakeChains != null && tab.RunStakeChains.Count > 0)
                ? tab.RunStakeChains
                : (_stakeChains ?? new List<long[]>());
            var stakeChainTotals = (tab?.RunStakeChainTotals != null && tab.RunStakeChainTotals.Length > 0)
                ? tab.RunStakeChainTotals
                : _stakeChainTotals;
            var decisionPercent = (tab != null && tab.RunDecisionPercent > 0) ? tab.RunDecisionPercent : _decisionPercent;

            var stakeSeqArr = stakeSeq.ToArray();
            var stakeChainsArr = stakeChains.Select(a => a.ToArray()).ToArray();
            var stakeChainTotalsArr = stakeChainTotals?.ToArray() ?? Array.Empty<long>();

            var moneyStrategyId = cfg.MoneyStrategy ?? "IncreaseWhenLose";

            return new GameContext
            {
                GetSnap = () => CloneAuthoritativeTaskSnap(),
                GetRawSnap = () => CloneAuthoritativeRawSnap(),
                TabId = tab.Id,
                RunId = runId,
                IsRunActive = () => tab.RunId == runId && tab.TaskCts != null && !tab.TaskCts.IsCancellationRequested && tab.IsRunning,
                GetBetPipeReady = () =>
                {
                    if (Dispatcher.CheckAccess()) return GetBetPipeReadyState(tab, runId);
                    return Dispatcher.Invoke(() => GetBetPipeReadyState(tab, runId));
                },
                EvalJsAsync = (js) => ExecuteOnBetWebAsync(js),
                EvalJsAwaitResultAsync = (js) => ExecuteOnBetWebAwaitResultAsync(js),
                Log = (s) => Log(s),

                StakeSeq = stakeSeqArr,
                StakeChains = stakeChainsArr,
                StakeChainTotals = stakeChainTotalsArr,

                DecisionPercent = decisionPercent,
                State = tab.DecisionState,
                UiDispatcher = Dispatcher,
                GetCooldown = () => tab.Cooldown,
                SetCooldown = (v) => tab.Cooldown = v,

                MoneyStrategyId = moneyStrategyId,

                SideRateText = cfg.SideRateText ?? "",
                UseRawWinAmount = useRawWinAmount,
                BetSeq = cfg.BetSeq ?? "",
                BetPatterns = cfg.BetPatterns ?? "",
                UiFinalizeMultiBet = (winners, resultDisplay) => Dispatcher.Invoke(() =>
                {
                    try { FinalizePendingBetsWithWinners(winners, resultDisplay); } catch { }
                }),
                UiSetChainLevel = (chain, level) => Dispatcher.Invoke(() =>
                {
                    try { SetLevelForMultiChain(tab, chain, level); } catch { }
                }),

                // ==== 3 callback UI ====
                UiSetSide = s => Dispatcher.Invoke(() =>
                {
                    UpdateTabSide(tab, s);
                }),
                UiSetStake = v => Dispatcher.Invoke(() =>
                {
                    UpdateTabStake(tab, v, stakeSeqArr, moneyStrategyId);
                }),
                UiRecordBetIssued = (side, amount, roundId) =>
                {
                    void Apply()
                    {
                        RecordBetIssuedUi(tab, tab.Id, side, amount, roundId);
                    }

                    if (Dispatcher.CheckAccess()) Apply();
                    else Dispatcher.Invoke(Apply);
                },

                UiAddWin = delta =>
                {
                    void Apply()
                    {
                        UpdateTabWin(tab, delta, moneyStrategyId);
                    }

                    if (Dispatcher.CheckAccess()) Apply();
                    else Dispatcher.Invoke(Apply);
                },

                UiWinLoss = s => Dispatcher.Invoke(() =>
                {
                    UpdateTabWinLoss(tab, s);
                }),
                UiSetWinLossText = text => Dispatcher.Invoke(() =>
                {
                    UpdateTabWinLossText(tab, text);
                }),
            };
        }

        private bool TryRegisterBetIssued(
            string tabId,
            long roundId,
            string side,
            long amount,
            string issuedSeqDisplay,
            string issuedSeqCalc)
        {
            var betKey =
                $"{tabId}|{roundId}|{side}|{amount}|{issuedSeqDisplay}|{issuedSeqCalc}";
            if (!_recordedValidBetKeys.TryAdd(betKey, 1))
            {
                Log($"[BET][DEDUP] skip duplicate history row | tab={tabId} round={roundId} side={side} amount={amount:N0} seq={issuedSeqDisplay}");
                return false;
            }

            if (_recordedValidBetKeys.Count > 4096)
            {
                foreach (var key in _recordedValidBetKeys.Keys.Take(1024).ToList())
                    _recordedValidBetKeys.TryRemove(key, out _);
            }

            return true;
        }

        private StrategyTabState? ResolveBetTab(string? tabId)
        {
            var betTab = !string.IsNullOrWhiteSpace(tabId)
                ? _strategyTabs.FirstOrDefault(t => string.Equals(t.Id, tabId, StringComparison.Ordinal))
                : _activeTab;
            return betTab ?? _activeTab;
        }

        private void RecordBetIssuedUi(StrategyTabState? betTab, string? tabId, string sideRaw, long amount, long roundId)
        {
            string side = sideRaw.Equals("CHAN", StringComparison.OrdinalIgnoreCase) ? "CHAN"
                        : sideRaw.Equals("LE", StringComparison.OrdinalIgnoreCase) ? "LE"
                        : sideRaw.ToUpperInvariant();
            string tabKey = tabId ?? "";
            var issuedSnap = CloneAuthoritativeRawSnap();
            var issuedSeqDisplay = issuedSnap?.seq ?? "";
            var issuedSeqCalc = FilterPlayableSeq(issuedSeqDisplay);
            long? issuedSeqVersion = issuedSnap?.seqVersion;
            string issuedSeqEvent = issuedSnap?.seqEvent ?? "";
            string issuedSeqSource = issuedSnap?.seqSource ?? "";
            long issuedTableId;
            long issuedGameShoe;
            long issuedObservedRound;
            lock (_roundStateLock)
            {
                issuedTableId = _netObservedTableId > 0 ? _netObservedTableId : _netSeqTableId;
                issuedGameShoe = _netObservedGameShoe > 0 ? _netObservedGameShoe : _netSeqGameShoe;
                issuedObservedRound = _netObservedGameRound > 0 ? _netObservedGameRound : _netSeqLastRound;
            }

            bool hasIssuedContext = issuedTableId > 0 && issuedGameShoe > 0 && issuedObservedRound > 0;
            bool looksStaleIssuedContext =
                hasIssuedContext &&
                issuedSeqDisplay.Length > 0 &&
                Math.Abs(issuedSeqDisplay.Length - (int)issuedObservedRound) > 2;
            if (TryResolveObservedContextFromStatus(
                    issuedSnap,
                    issuedSeqDisplay.Length,
                    out var reboundTableId,
                    out var reboundGameShoe,
                    out var reboundObservedRound,
                    out var reboundReason))
            {
                bool shouldOverride =
                    !hasIssuedContext ||
                    looksStaleIssuedContext ||
                    issuedTableId != reboundTableId ||
                    issuedGameShoe != reboundGameShoe ||
                    issuedObservedRound != reboundObservedRound;

                if (shouldOverride)
                {
                    long prevTableId = issuedTableId;
                    long prevGameShoe = issuedGameShoe;
                    long prevObservedRound = issuedObservedRound;
                    lock (_roundStateLock)
                    {
                        _netObservedTableId = reboundTableId;
                        _netObservedGameShoe = reboundGameShoe;
                        _netObservedGameRound = reboundObservedRound;
                    }

                    issuedTableId = reboundTableId;
                    issuedGameShoe = reboundGameShoe;
                    issuedObservedRound = reboundObservedRound;
                    hasIssuedContext = true;
                    looksStaleIssuedContext = false;

                    Log($"[NETSEQ][OBS-REBIND] reason={reboundReason} | table={issuedTableId} | shoe={issuedGameShoe} | round={issuedObservedRound} | prevTable={prevTableId} | prevShoe={prevGameShoe} | prevRound={prevObservedRound} | seqLen={issuedSeqDisplay.Length} | status={Shrink(issuedSnap?.status ?? "-", 80)}");
                }
            }

            bool isTableSwitchResetIssue = !string.IsNullOrWhiteSpace(issuedSeqEvent) &&
                issuedSeqEvent.IndexOf("table-switch-reset", StringComparison.OrdinalIgnoreCase) >= 0;

            if (!TryRegisterBetIssued(
                tabKey,
                roundId,
                side,
                amount,
                issuedSeqDisplay,
                issuedSeqCalc))
                return;

            Log($"[BET] {side} {amount:N0} | round={roundId}");

            betTab ??= ResolveBetTab(tabId);
            if (betTab != null)
            {
                var stakeSeq = (betTab.RunStakeSeq != null && betTab.RunStakeSeq.Length > 0)
                    ? betTab.RunStakeSeq
                    : (_stakeSeq ?? Array.Empty<long>());
                var moneyStrategyId = betTab.Config?.MoneyStrategy ?? _cfg?.MoneyStrategy ?? "IncreaseWhenLose";

                UpdateTabSide(betTab, side);
                UpdateTabStake(betTab, amount, stakeSeq, moneyStrategyId);
                RecordValidBet(betTab, amount);
            }

            var issuedName = (issuedSnap?.totals?.N ?? "").Trim();
            if (LblUserName != null)
            {
                if (!string.IsNullOrWhiteSpace(issuedName))
                    LblUserName.Text = issuedName;
                else
                    LblUserName.Text = "-";
            }

            double accNow = issuedSnap?.totals?.A ?? 0;
            if (accNow <= 0)
            {
                try { accNow = ParseMoneyOrZero(LblAmount?.Text ?? "0"); } catch { }
            }
            if (LblAmount != null)
            {
                if (accNow > 0)
                    LblAmount.Text = accNow.ToString("#,0.##", CultureInfo.InvariantCulture);
                else if (string.IsNullOrWhiteSpace(LblAmount.Text))
                    LblAmount.Text = "-";
            }

            string pendingReason = "";
            if (!hasIssuedContext || isTableSwitchResetIssue)
            {
                if (issuedObservedRound <= 0)
                {
                    issuedObservedRound = issuedSeqDisplay.Length > 0
                        ? issuedSeqDisplay.Length
                        : roundId;
                }

                if (issuedTableId <= 0 && TryInferTableIdFromStatus(issuedSnap?.status, out var inferredTableId))
                    issuedTableId = inferredTableId;

                pendingReason = isTableSwitchResetIssue ? "table-switch-reset-recorded" : "missing-context-recorded";
                Log($"[BET][HIST][INFO] reason={pendingReason} | action=record-pending | at={DateTime.Now:HH:mm:ss} | side={side} | stake={amount:N0} | round={roundId} | table={issuedTableId} | shoe={issuedGameShoe} | obsRound={issuedObservedRound} | seqEvt={(string.IsNullOrWhiteSpace(issuedSeqEvent) ? "-" : issuedSeqEvent)} | seqLen={issuedSeqDisplay.Length}");
            }

            var row = new BetRow
            {
                At = DateTime.Now,
                Game = "Baccarat Sexy",
                Stake = amount,
                Side = side,
                Result = "Chờ",
                WinLose = "Đang chờ",
                Account = accNow,
                IssuedSeqDisplay = issuedSeqDisplay,
                IssuedSeqCalc = issuedSeqCalc,
                IssuedSeqVersion = issuedSeqVersion,
                IssuedSeqEvent = issuedSeqEvent,
                IssuedRoundId = roundId,
                IssuedTableId = issuedTableId,
                IssuedGameShoe = issuedGameShoe,
                IssuedObservedRound = issuedObservedRound,
                IssuedSeqSource = issuedSeqSource,
                SawClosedAfterIssue = false
            };

            char issueTail = issuedSeqDisplay.Length > 0 ? issuedSeqDisplay[^1] : '-';
            Log($"[BET][HIST][PENDING] {row.At:HH:mm:ss} | {side} | {amount:N0} | round={roundId} | table={issuedTableId} | shoe={issuedGameShoe} | obsRound={issuedObservedRound} | seqLen={issuedSeqDisplay.Length} | seqVer={(issuedSeqVersion?.ToString() ?? "-")} | seqEvt={issuedSeqEvent} | seqSrc={(string.IsNullOrWhiteSpace(issuedSeqSource) ? "-" : issuedSeqSource)} | tail={issueTail} | acc={row.Account:#,0.##}");
            if (issuedTableId <= 0 || issuedGameShoe <= 0 || roundId <= 0)
            {
                Log($"[BET][HIST][INFO] pending-recorded-without-context | at={row.At:HH:mm:ss} | side={side} | stake={amount:N0} | round={roundId} | table={issuedTableId} | shoe={issuedGameShoe} | obsRound={issuedObservedRound}");
                LogMissingContextDiagnostics(
                    string.IsNullOrWhiteSpace(pendingReason) ? "pending-recorded-without-context" : pendingReason,
                    side,
                    amount,
                    roundId,
                    issuedTableId,
                    issuedGameShoe,
                    issuedObservedRound);
            }

            _betAll.Insert(0, row);
            if (_betAll.Count > MaxHistory) _betAll.RemoveAt(_betAll.Count - 1);
            _pendingRows.Add(row);
            if (_autoFollowNewest)
                ShowFirstPage();
            else
                RefreshCurrentPage();
        }

        private async Task StartTaskAsync(StrategyTabState tab, IBetTask task, CancellationToken ct, bool useRawWinAmount = false)
        {
            var runId = tab.RunId;
            tab.ActiveTask = task;
            _dec = new DecisionState(); // reset trạng thái cho task mới
            tab.DecisionState = new DecisionState();
            BaccaratViVoGaming.Tasks.MoneyHelper.ResetTempProfitForWinUpLoseKeep();
            var ctx = BuildContext(tab, runId, useRawWinAmount);
            ctx.Log?.Invoke($"[TASK][RUN] start | tab={tab.Id} | run={runId} | task={task.DisplayName}");
            // === Preflight: chờ __cw_bet sẵn sàng trước khi chạy chiến lược ===
            bool preflightOk = false;
            for (int i = 0; i < 25; i++) // 25 * 200ms ~= 5s
            {
                ct.ThrowIfCancellationRequested();
                string check = "timeout";
                try
                {
                    var checkTask = ctx.EvalJsAsync("(function(){return (typeof window.__cw_bet_enqueue==='function' || typeof window.__cw_bet==='function')?'ok':'no';})()");
                    var done = await Task.WhenAny(checkTask, Task.Delay(1200, ct));
                    if (done == checkTask)
                        check = (await checkTask)?.Trim().Trim('"') ?? "";
                }
                catch (Exception ex)
                {
                    check = "err:" + ex.Message;
                }

                if (string.Equals(check, "ok", StringComparison.OrdinalIgnoreCase))
                {
                    preflightOk = true;
                    break;
                }
                if (i == 0 || i == 12 || i == 24)
                    ctx.Log?.Invoke($"[TASK][PRECHECK] tab={tab.Id} | run={runId} | attempt={i + 1}/25 | bridge={check}");
                await Task.Delay(200, ct);
            }
            if (!preflightOk)
                ctx.Log?.Invoke($"[TASK][PRECHECK][WARN] tab={tab.Id} | run={runId} | bridge-not-ready-after-5s");

            await task.RunAsync(ctx, ct);
        }

        private void StopTask(StrategyTabState tab)
        {
            if (tab == null) return;
            try { tab.TaskCts?.Cancel(); } catch { }
            tab.TaskCts = null;
            tab.ActiveTask = null;
            tab.RunningTask = null;
            tab.IsRunning = false;
        }

        private void StopActiveTask()
        {
            if (_activeTab != null) StopTask(_activeTab);
        }

        private void StopAllTasks()
        {
            foreach (var tab in _strategyTabs.Where(t => t.IsRunning).ToList())
                StopTask(tab);
        }

        private void StopAllTasksAndRelease()
        {
            StopAllTasks();
            BaccaratViVoGaming.Tasks.TaskUtil.ClearBetCooldown();
            SetPlayButtonState(_activeTab?.IsRunning == true);
            StopExpiryCountdown();
            StopLeaseHeartbeat();
            StopLicenseRecheckTimer();
            var uname = ResolveLeaseUsername();
            if (!string.IsNullOrWhiteSpace(uname))
                _ = ReleaseLeaseAsync(uname);
        }



        private async void PlayXocDia_Click(object sender, RoutedEventArgs e)
        {
            // GUARD: không cho 2 luồng start chạy đồng thời
            if (Interlocked.Exchange(ref _playStartInProgress, 1) == 1)
            {
                Log("[DEC] start is already in progress → ignore");
                return;
            }
            // Ngăn double-click trong lúc còn await chuẩn bị
            if (BtnPlay != null) BtnPlay.IsEnabled = false;
            var activeTab = _activeTab;
            try
            {
                if (activeTab == null)
                {
                    MessageBox.Show("Chưa có chiến lược để chạy.", "Automino",
                        MessageBoxButton.OK, MessageBoxImage.Warning);
                    return;
                }
                if (activeTab.TaskCts != null || activeTab.IsRunning)
                {
                    Log($"[DEC] \"{activeTab.Name}\" is already running | run={activeTab.RunId}");
                    return;
                }
                await SaveConfigAsync();
                await EnsureWebReadyAsync();
                // ✅ Validate trước khi bắt đầu
                if (!ValidateInputsForCurrentStrategy())
                {
                    if (BtnPlay != null) BtnPlay.IsEnabled = true; // trả lại nút nếu đang disable vì double-click guard
                    return;
                }

                activeTab.CutStopTriggered = false;
                activeTab.WinTotal = 0;
                activeTab.LastSide = "";
                activeTab.LastWinLoss = null;
                activeTab.LastStakeAmount = null;
                activeTab.LastLevelText = "";
                _winTotal = 0;            // tùy bạn: nếu muốn đếm lại từ 0 khi bắt đầu
                if (LblWin != null) LblWin.Text = "0";
                ResetBetMiniPanel();    // xóa THẮNG/THUA, CỬA ĐẶT, TIỀN CƯỢC, MỨC TIỀN
                if (CheckLicense && (!_licenseVerified || _runExpiresAt == null || _runExpiresAt <= DateTimeOffset.Now))
                {
                    if (!await EnsureLicenseOnceAsync())
                        return;
                }

                ResetSeqSyncState("play-start", clearPendingRows: false, forceLog: true);
                await LogBridgeProbeAsync("play-start-pre-ensure");
                await EnsureToolBridgeInjectedAsync();
                await LogBridgeProbeAsync("play-start-post-ensure");

                var betWeb = GetBetWebView();
                var typeBetJson = await ExecuteOnBetWebAsync("typeof window.__cw_bet");
                var typeBet = typeBetJson?.Trim('"');
                var armedFrameCount = ReferenceEquals(betWeb, _popupWeb)
                    ? GetPopupArmedFramesSnapshot().Count
                    : GetMainArmedFramesSnapshot().Count;
                Log("[PlayStart] betType=" + (string.IsNullOrWhiteSpace(typeBet) ? "-" : typeBet) +
                    " | armedFrames=" + armedFrameCount +
                    " | betWeb=" + GetBetWebViewName(betWeb) +
                    " | src=" + GetBetWebViewSource(betWeb));
                if (!string.Equals(typeBet, "function", StringComparison.OrdinalIgnoreCase))
                {
                    await LogBridgeProbeAsync("play-missing-bet-before-reinject");
                    Log("[DEC] Chưa thấy bridge JS (__cw_bet) → tự động 'Xóc Đĩa Live' và inject.");
                    if (_popupWeb?.CoreWebView2 != null)
                    {
                        Log($"[DEC] Missing bridge JS (__cw_bet) on {GetBetWebViewName(betWeb)} | {GetBetWebViewSource(betWeb)} -> reinject popup.");
                        await InjectOnPopupDocAsync();
                    }
                    else
                    {
                        var gameReadyForPlay = await EnsureGameContextReadyForPlayAsync("play-missing-bet");
                        if (!gameReadyForPlay)
                        {
                            Log("[DEC] Không mở được game context từ luồng Bắt Đầu Cược.");
                        }
                    }

                    // Poll chờ bridge sẵn sàng tối đa 30s
                    var t0 = DateTime.UtcNow;
                    const int timeoutBetMs = 30000;
                    while ((DateTime.UtcNow - t0).TotalMilliseconds < timeoutBetMs)
                    {
                        await Task.Delay(400);
                        try
                        {
                            typeBetJson = await ExecuteOnBetWebAsync("typeof window.__cw_bet");
                            typeBet = typeBetJson?.Trim('"');
                            if (string.Equals(typeBet, "function", StringComparison.OrdinalIgnoreCase))
                                break;
                        }
                        catch { }
                    }
                    if (!string.Equals(typeBet, "function", StringComparison.OrdinalIgnoreCase))
                    {
                        await LogBridgeProbeAsync("play-missing-bet-timeout");
                        Log("[DEC] Không thể vào bàn/tiêm JS trong thời gian chờ. Vui lòng thử lại.");
                        return;
                    }
                    await LogBridgeProbeAsync("play-missing-bet-recovered");
                }

                await ApplyRuntimePerfToBetWebAsync();
                // Bật kênh push (idempotent)
                await ExecuteOnBetWebAsync($"window.__cw_startPush && window.__cw_startPush({_cwPushMs});");
                Log($"[CW] ensure push {_cwPushMs}ms");
                await LogBridgeProbeAsync("play-after-start-push");

                // 🔒 MỚI: Chờ đủ bridge + Cocos + tick để tránh nổ IndexOutOfRange trong task
                var ready = await WaitForBridgeAndGameDataAsync(15000);
                if (!ready)
                {
                    await LogBridgeProbeAsync("play-wait1-timeout");
                    Log("[DEC] Dữ liệu chưa sẵn sàng (bridge/cocos/tick). Thử gia hạn push & chờ thêm.");
                    await ApplyRuntimePerfToBetWebAsync();
                    await ExecuteOnBetWebAsync($"window.__cw_startPush && window.__cw_startPush({_cwPushMs});");
                    ready = await WaitForBridgeAndGameDataAsync(15000);
                    if (!ready)
                    {
                        await LogBridgeProbeAsync("play-wait2-timeout");
                        Log("[DEC] Vẫn chưa có dữ liệu, tạm hoãn khởi động chiến lược.");
                        return;
                    }
                }

                // Chuẩn bị & chạy Task chiến lược (giữ nguyên)
                RebuildStakeSeq((TxtStakeCsv?.Text ?? "1000,2000,4000,8000,16000").Trim());
                activeTab.RunStakeSeq = _stakeSeq.ToArray();
                activeTab.RunStakeChains = _stakeChains.Select(a => a.ToArray()).ToList();
                activeTab.RunStakeChainTotals = _stakeChainTotals.ToArray();
                SyncDecisionPercentFromUi();
                activeTab.RunDecisionPercent = _decisionPercent;
                activeTab.IsRunning = true;
                MoneyHelper.S7ResetOnProfit = _cfg.S7ResetOnProfit;
                _winTotal = activeTab.WinTotal;
                if (LblWin != null) LblWin.Text = activeTab.WinTotal.ToString("N0");
                _dec = new DecisionState();
                _cooldown = false;
                int __idx = CmbBetStrategy?.SelectedIndex ?? 4;
                _cfg.BetSeq = (__idx == 0) ? (_cfg.BetSeqBP ?? "") : (__idx == 2 ? (_cfg.BetSeqNI ?? "") : "");
                _cfg.BetPatterns = (__idx == 1) ? (_cfg.BetPatternsBP ?? "") : (__idx == 3 ? (_cfg.BetPatternsNI ?? "") : "");


                // === Khởi động task theo lựa chọn CHIẾN LƯỢC ===
                var runId = Interlocked.Increment(ref _taskRunSeq);
                activeTab.RunId = runId;
                activeTab.TaskCts = new CancellationTokenSource();

                bool useRawWinAmount = false;
                BaccaratViVoGaming.Tasks.IBetTask task = _cfg.BetStrategyIndex switch
                {
                    0 => new BaccaratViVoGaming.Tasks.SeqParityFollowTask(),     // 1
                    1 => new BaccaratViVoGaming.Tasks.PatternParityTask(),       // 2
                    2 => new BaccaratViVoGaming.Tasks.SeqMajorMinorTask(),       // 3
                    3 => new BaccaratViVoGaming.Tasks.PatternMajorMinorTask(),   // 4
                    4 => new BaccaratViVoGaming.Tasks.SmartPrevTask(),           // 5
                    5 => new BaccaratViVoGaming.Tasks.RandomParityTask(),        // 6
                    6 => new BaccaratViVoGaming.Tasks.AiStatParityTask(),        // 7
                    7 => new BaccaratViVoGaming.Tasks.StateTransitionBiasTask(), // 8
                    8 => new BaccaratViVoGaming.Tasks.RunLengthBiasTask(),       // 9
                    9 => new BaccaratViVoGaming.Tasks.EnsembleMajorityTask(),    // 10
                    10 => new BaccaratViVoGaming.Tasks.TimeSlicedHedgeTask(),    // 11
                    11 => new BaccaratViVoGaming.Tasks.KnnSubsequenceTask(),     // 12
                    12 => new BaccaratViVoGaming.Tasks.DualScheduleHedgeTask(),  // 13
                    13 => new BaccaratViVoGaming.Tasks.AiOnlineNGramTask(GetAiNGramStatePath()), // 14
                    14 => new BaccaratViVoGaming.Tasks.AiExpertPanelTask(), // 15
                    15 => new BaccaratViVoGaming.Tasks.Top10PatternFollowTask(), // 16
                    16 => new BaccaratViVoGaming.Tasks.SeqParityHotBackTask(), // 17
                    _ => new BaccaratViVoGaming.Tasks.SmartPrevTask(),
                };

                activeTab.ActiveTask = task;

                var tabRef = activeTab;
                var runIdRef = runId;

                var running = Task.Run(() => StartTaskAsync(tabRef, task, tabRef.TaskCts.Token, useRawWinAmount));
                tabRef.RunningTask = running;

                running.ContinueWith(t =>
                {
                    Dispatcher.BeginInvoke(new Action(() =>
                    {
                        _cooldown = false;
                        tabRef.TaskCts = null;
                        tabRef.ActiveTask = null;
                        tabRef.RunningTask = null;
                        tabRef.IsRunning = false;

                        if (ReferenceEquals(_activeTab, tabRef))
                            SetPlayButtonState(false);

                        if (t.IsFaulted)
                            Log($"[Task ERR] run={runIdRef} | " + (t.Exception?.GetBaseException().Message ?? "Unknown error"));
                        else if (t.IsCanceled)
                            Log($"[Task] canceled | run={runIdRef}");
                        else
                            Log($"[Task] completed | run={runIdRef}");
                    }));
                }, TaskScheduler.Default);

                Log($"[Loop] started task: {task.DisplayName} | run={runId}");
                SetPlayButtonState(true);
            }
            catch (Exception ex)
            {
                Log("[PlayXocDia_Click] " + ex);
                // nếu lỗi trước khi start, trả lại nút
                if (activeTab == null)
                {
                    if (BtnPlay != null) BtnPlay.IsEnabled = true;
                }
                else if (activeTab.TaskCts == null && BtnPlay != null)
                {
                    BtnPlay.IsEnabled = true;
                }
            }
            finally
            {
                // nếu chưa start được task thì bật lại nút
                if (activeTab == null)
                {
                    if (BtnPlay != null) BtnPlay.IsEnabled = true;
                }
                else if (activeTab.TaskCts == null && BtnPlay != null)
                {
                    BtnPlay.IsEnabled = true;
                }
                if (activeTab != null && activeTab.TaskCts == null)
                {
                    activeTab.IsRunning = false;
                    activeTab.ActiveTask = null;
                    activeTab.RunningTask = null;
                    SetPlayButtonState(_activeTab?.IsRunning == true);
                }
                Interlocked.Exchange(ref _playStartInProgress, 0);
            }
        }




        private int _stopInProgress = 0;
        private void StopXocDia_Click(object sender, RoutedEventArgs e)
        {
            if (Interlocked.Exchange(ref _stopInProgress, 1) == 1) return;
            try
            {
                var activeTab = _activeTab;
                if (activeTab == null) return;

                StopTask(activeTab);
                _ = Web?.ExecuteScriptAsync($"window.__cw_startPush && window.__cw_startPush({_cwPushMs});");

                if (!IsAnyTabRunning())
                {
                    BaccaratViVoGaming.Tasks.TaskUtil.ClearBetCooldown();
                    Log($"[Loop] stopped | run={activeTab.RunId}");
                    StopExpiryCountdown();
                    StopLeaseHeartbeat();
                    StopLicenseRecheckTimer();
                    var uname = ResolveLeaseUsername();
                    if (!string.IsNullOrWhiteSpace(uname))
                        _ = ReleaseLeaseAsync(uname);
                }
                else
                {
                    Log($"[Loop] stopped tab: {activeTab.Name} | run={activeTab.RunId}");
                }

                SetPlayButtonState(activeTab.IsRunning);
            }
            finally { Interlocked.Exchange(ref _stopInProgress, 0); }
        }




        private void SetPlayButtonState(bool isRunning)
        {
            if (BtnPlay == null) return;

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
            if (IsAnyTabRunning())
                locked = _strategyTabs.Any(t => t.IsRunning && t.Config.LockMouse);

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
            if (!_uiReady || _tabSwitching) return;               // ⬅️ chặn event khởi động sớm
            ApplyMouseShieldFromCheck();
            _ = SaveConfigAsync();
            Log("[UI] Khoá chuột web: ON");
        }

        private async void ChkLockMouse_Unchecked(object sender, RoutedEventArgs e)
        {
            if (!_uiReady || _tabSwitching) return;               // ⬅️ chặn event khởi động sớm
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

        // đặt trong MainWindow.xaml.cs (project BaccaratViVoGaming)

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
            _seqIconMap['P'] = FallbackIcons.LoadPackImage("Assets/Seq/P.png") ?? LoadImgSafe(
                $"pack://application:,,,/{asm};component/Assets/Seq/P.png",
                "pack://application:,,,/Assets/Seq/P.png",
                "pack://application:,/Assets/Seq/P.png"
            );
            _seqIconMap['B'] = FallbackIcons.LoadPackImage("Assets/Seq/B.png") ?? LoadImgSafe(
                $"pack://application:,,,/{asm};component/Assets/Seq/B.png",
                "pack://application:,,,/Assets/Seq/B.png",
                "pack://application:,/Assets/Seq/B.png"
            );
            _seqIconMap['T'] = FallbackIcons.LoadPackImage("Assets/Seq/T.png") ?? LoadImgSafe(
                $"pack://application:,,,/{asm};component/Assets/Seq/T.png",
                "pack://application:,,,/Assets/Seq/T.png",
                "pack://application:,/Assets/Seq/T.png"
            );
        }



        void UpdateSeqUI(string fullSeq)
        {
            var tail = (fullSeq.Length <= 20) ? fullSeq : fullSeq.Substring(fullSeq.Length - 20, 20);
            if (tail == _lastSeqTailShown)
            {
                var skipKey = $"skip|{fullSeq.Length}|{tail}|{_lastSeqTailShown}";
                if (!string.Equals(_lastSeqUiRenderLogKey, skipKey, StringComparison.Ordinal))
                {
                    _lastSeqUiRenderLogKey = skipKey;
                    int currentItemsSkip = SeqIcons?.Items.Count ?? -1;
                    int tooltipLenSkip = SeqIcons?.ToolTip is string ttSkip ? ttSkip.Length : -1;
                    Log($"[SEQ][UI][SKIP] len={fullSeq.Length} | tailLen={tail.Length} | tail={(tail.Length == 0 ? "-" : tail)} | lastTailShownLen={_lastSeqTailShown.Length} | items={currentItemsSkip} | tooltipLen={tooltipLenSkip}");
                }
                return; // QUAN TRỌNG: đừng reset animation
            }

            var items = new List<SeqIconVM>(tail.Length);
            for (int i = 0; i < tail.Length; i++)
            {
                var ch = tail[i];
                if (_seqIconMap.TryGetValue(ch, out var img))
                    items.Add(new SeqIconVM { Img = img, IsLatest = (i == tail.Length - 1) });
            }
            SeqIcons.ItemsSource = items;
            SeqIcons.ToolTip = fullSeq;
            var renderKey = $"render|{fullSeq.Length}|{tail}|{items.Count}";
            if (!string.Equals(_lastSeqUiRenderLogKey, renderKey, StringComparison.Ordinal))
            {
                _lastSeqUiRenderLogKey = renderKey;
                char renderTail = fullSeq.Length > 0 ? fullSeq[^1] : '-';
                Log($"[SEQ][UI][RENDER] len={fullSeq.Length} | tail={renderTail} | tailLen={tail.Length} | items={items.Count} | prevTailShownLen={_lastSeqTailShown.Length}");
            }
            _lastSeqTailShown = tail;
        }



        private void SetLastResultUI(string? result)
        {
            string s = TextNorm.U(result ?? string.Empty);
            bool isBanker = (s == "BANKER" || s == "B");
            bool isPlayer = (s == "PLAYER" || s == "P");
            bool isTie = (s == "TIE" || s == "T");

            if (!isBanker && !isPlayer && !isTie && s.Length == 1 && char.IsDigit(s[0]))
            {
                isPlayer = (s[0] == '1' || s[0] == '3');
                isBanker = !isPlayer;
            }

            var token = isBanker ? "B" : isPlayer ? "P" : isTie ? "T" : "";
            if (string.Equals(token, _lastResultUiToken, StringComparison.Ordinal))
                return;
            _lastResultUiToken = token;

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

            if (!isBanker && !isPlayer && !isTie)
            {
                ShowText("");
                return;
            }

            ImageSource? icon = isTie
                ? (FallbackIcons.GetResultTie() ?? FallbackIcons.GetDraw())
                : isBanker
                    ? ((TryFindResource("ImgBANKER") as ImageSource) ?? FallbackIcons.GetResultBanker() ?? FallbackIcons.GetSideBanker())
                    : ((TryFindResource("ImgPLAYER") as ImageSource) ?? FallbackIcons.GetResultPlayer() ?? FallbackIcons.GetSidePlayer());

            if (icon != null && ImgKetQua != null)
            {
                ImgKetQua.Source = icon;
                ImgKetQua.Visibility = Visibility.Visible;
                if (LblKetQua != null) LblKetQua.Visibility = Visibility.Collapsed;

                if (isBanker) SharedIcons.ResultBanker = icon;
                else if (isPlayer) SharedIcons.ResultPlayer = icon;
            }
            else
            {
                ShowText(isTie ? "TIE" : (isBanker ? "BANKER" : "PLAYER"));
            }
        }


        private void SetLastSideUI(string? result)
        {
            var s = TextNorm.U(result ?? "");
            bool isPlayer = s == "PLAYER" || s == "P";
            bool isBanker = s == "BANKER" || s == "B";

            void ShowText(string text)
            {
                if (ImgSide != null) ImgSide.Visibility = Visibility.Collapsed;
                if (LblSide != null)
                {
                    LblSide.Visibility = Visibility.Visible;
                    LblSide.Text = string.IsNullOrWhiteSpace(text) ? "" : text;
                }
            }

            if (isPlayer || isBanker)
            {
                var key = isPlayer ? "ImgPLAYER" : "ImgBANKER";
                var img = TryFindResource(key) as ImageSource;
                if (img != null && ImgSide != null)
                {
                    ImgSide.Source = img;
                    ImgSide.Visibility = Visibility.Visible;
                    if (LblSide != null) LblSide.Visibility = Visibility.Collapsed;
                    return;
                }
            }

            ShowText(isBanker ? "BANKER" : isPlayer ? "PLAYER" : s);
        }

        private void UpdateTabSide(StrategyTabState tab, string? result)
        {
            if (tab == null) return;
            tab.LastSide = result ?? "";
            if (ReferenceEquals(_activeTab, tab))
                SetLastSideUI(result);
        }

        private void UpdateTabStake(StrategyTabState tab, double amount, long[] stakeSeq, string moneyStrategyId)
        {
            if (tab == null) return;

            long rounded = (long)Math.Round(amount);
            tab.LastStakeAmount = rounded;
            int levelIndex = Array.FindIndex(stakeSeq, s => s == rounded);
            string levelText = (levelIndex >= 0) ? $"{levelIndex + 1}/{stakeSeq.Length}" : "";
            tab.LastLevelText = levelText;

            if (ReferenceEquals(_activeTab, tab))
            {
                if (LblStake != null) LblStake.Text = rounded.ToString("N0");
                if (!string.Equals(moneyStrategyId, "MultiChain", StringComparison.OrdinalIgnoreCase))
                {
                    if (LblLevel != null) LblLevel.Text = levelText;
                }
                UpdateStatsUi(tab);
            }
            _ = SaveStatsAsync();
        }

        private void RecordValidBet(StrategyTabState tab, long amount)
        {
            if (tab == null) return;

            long rounded = Math.Max(0, amount);
            if (rounded <= 0) return;

            tab.Stats.TotalBetAmount += rounded;
            if (ReferenceEquals(_activeTab, tab))
                UpdateStatsUi(tab);
            _ = SaveStatsAsync();
        }

        private void UpdateTabWin(StrategyTabState tab, double net, string moneyStrategyId)
        {
            if (tab == null) return;

            tab.WinTotal += net;
            tab.Stats.TotalProfit += net;
            if (ReferenceEquals(_activeTab, tab))
                _winTotal = tab.WinTotal;

            try
            {
                BaccaratViVoGaming.Tasks.MoneyHelper.NotifyTempProfit(moneyStrategyId, net);
            }
            catch { /* ignore */ }

            if (ReferenceEquals(_activeTab, tab) && LblWin != null)
                LblWin.Text = tab.WinTotal.ToString("N0");

            CheckCutAndStopIfNeeded(tab);
            UpdateStatsUi(tab);
            _ = SaveStatsAsync();
        }

        private void UpdateTabWinLoss(StrategyTabState tab, bool? result)
        {
            if (tab == null) return;
            tab.LastWinLoss = result;
            tab.LastWinLossText = result == true ? "Thắng" : result == false ? "Thua" : null;
            if (result.HasValue)
            {
                if (result.Value)
                {
                    tab.Stats.TotalWinCount++;
                    tab.Stats.CurrentWinStreak++;
                    tab.Stats.CurrentLossStreak = 0;
                    if (tab.Stats.CurrentWinStreak > tab.Stats.MaxWinStreak)
                        tab.Stats.MaxWinStreak = tab.Stats.CurrentWinStreak;
                }
                else
                {
                    tab.Stats.TotalLossCount++;
                    tab.Stats.CurrentLossStreak++;
                    tab.Stats.CurrentWinStreak = 0;
                    if (tab.Stats.CurrentLossStreak > tab.Stats.MaxLossStreak)
                        tab.Stats.MaxLossStreak = tab.Stats.CurrentLossStreak;
                }
            }
            if (ReferenceEquals(_activeTab, tab))
                SetWinLossUI(result);
            UpdateStatsUi(tab);
        }

        private void UpdateTabWinLossText(StrategyTabState tab, string? text)
        {
            if (tab == null) return;
            var u = TextNorm.U(text ?? "");
            tab.LastWinLossText = text;
            if (u == "THANG") tab.LastWinLoss = true;
            else if (u == "THUA") tab.LastWinLoss = false;
            else tab.LastWinLoss = null;

            if (ReferenceEquals(_activeTab, tab))
            {
                if (u == "HOA") SetWinLossTextUI(text);
                else SetWinLossUI(tab.LastWinLoss);
            }
            UpdateStatsUi(tab);
        }

        private void ResetTabMiniState(StrategyTabState tab)
        {
            tab.LastWinLoss = null;
            tab.LastWinLossText = null;
            tab.LastSide = "";
            tab.LastStakeAmount = null;
            tab.LastLevelText = "";
        }

        private void ResetStatsForTab(StrategyTabState tab)
        {
            if (tab == null) return;
            tab.Stats = new TabStats();
            UpdateStatsUi(tab);
        }


        // === RESET MINI PANEL: THẮNG/THUA, CỬA ĐẶT, TIỀN CƯỢC, MỨC TIỀN ===
        private void ResetBetMiniPanel()
        {
            try
            {
                if (_activeTab != null)
                    ResetTabMiniState(_activeTab);
                // THẮNG/THUA: bool? -> null để xóa
                SetWinLossUI(null);

                // CỬA ĐẶT: string? -> null/"" đều xóa
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
            var running = _strategyTabs.Where(t => t.IsRunning).ToList();
            if (running.Count == 0) return;
            foreach (var tab in running)
                ResetTabMiniState(tab);
            if (_activeTab != null && _activeTab.IsRunning)
                ResetBetMiniPanel();
        }

        private async void BtnStatsReset_Click(object sender, RoutedEventArgs e)
        {
            if (_activeTab == null) return;
            ResetStatsForTab(_activeTab);
            await SaveStatsAsync();
            Log("[Stats] reset: " + _activeTab.Name);
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

        private void SetWinLossTextUI(string? text)
        {
            var u = TextNorm.U(text ?? "");
            if (u == "HOA")
            {
                var img = (TryFindResource("ImgHOA") as ImageSource) ?? FallbackIcons.GetDraw();
                if (img != null && ImgThangThua != null)
                {
                    ImgThangThua.Source = img;
                    ImgThangThua.Visibility = Visibility.Visible;
                    if (LblWinLoss != null) LblWinLoss.Visibility = Visibility.Collapsed;
                    return;
                }
            }

            if (ImgThangThua != null) ImgThangThua.Visibility = Visibility.Collapsed;
            if (LblWinLoss != null)
            {
                LblWinLoss.Visibility = Visibility.Visible;
                LblWinLoss.Text = string.IsNullOrWhiteSpace(text) ? "" : text;
            }
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
            if (Interlocked.Exchange(ref _licenseCheckBusy, 1) == 1) return; // đang chạy -> bỏ qua
            try
            {
                var lic = await FetchLicenseAsync(username);
                if (lic == null)
                {
                    Log("[LicenseCheck] fetch unavailable (temporary). Keep current session.");
                    return;
                }
                if (string.IsNullOrWhiteSpace(lic.exp) || string.IsNullOrWhiteSpace(lic.pass) ||
                    !DateTimeOffset.TryParse(lic.exp, out var expUtc))
                {
                    Log("[LicenseCheck] invalid license payload");
                    await Dispatcher.InvokeAsync(() =>
                    {
                        MessageBox.Show("Không xác thực được license. Dừng đặt cược.", "Automino",
                            MessageBoxButton.OK, MessageBoxImage.Warning);
                        SetLicenseUi(false);
                        StopAllTasksAndRelease();
                    });
                    return;
                }
                if (!string.Equals(lic.pass ?? "", _licensePass ?? "", StringComparison.Ordinal))
                {
                    Log("[LicenseCheck] password mismatch");
                    await Dispatcher.InvokeAsync(() =>
                    {
                        MessageBox.Show("Mật khẩu license không đúng. Dừng đặt cược.", "Automino",
                            MessageBoxButton.OK, MessageBoxImage.Warning);
                        SetLicenseUi(false);
                        StopAllTasksAndRelease();
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
                        SetLicenseUi(false);
                        StopAllTasksAndRelease();
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
            using var r = new StreamReader(s);
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

            var nextKey = deviceKey;
            if (string.Equals(_trialKey, nextKey, StringComparison.Ordinal))
                return;

            _trialDayStamp = "";
            _trialKey = nextKey;
            Log("[TrialKey] " + _trialKey);
        }

        private void ClearLocalTrialState(bool saveAsync = true)
        {
            try
            {
                _cfg.TrialUntil = "";
                _cfg.TrialSessionKey = "";
                _cfg.UseTrial = false;
                if (saveAsync)
                    _ = SaveConfigAsync();
            }
            catch
            {
            }
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

        // Giữ nguyên tên để không phải sửa các callsite
        private async Task<string> LoadAppJsAsyncFallback()
        {
            try
            {
                // Đọc thẳng từ embedded (KHÔNG thử đọc từ đĩa)
                var resName = FindResourceName("v4_js_xoc_dia_live.js")
                              ?? "BaccaratViVoGaming.v4_js_xoc_dia_live.js";
                var text = ReadEmbeddedText(resName);
                text = RemoveUtf8Bom(text);

                if (!string.IsNullOrWhiteSpace(text))
                {
                    Log($"[Bridge] Loaded JS from embedded: {resName} (len={text.Length})");
                    return text;
                }

                Log("[Bridge] Embedded JS empty: " + resName);
            }
            catch (Exception ex)
            {
                Log("[Bridge] Read embedded JS failed: " + ex.Message);
            }
            return "";
        }

        private async Task EnsureBridgeRegisteredAsync()
        {
            await EnsureWebReadyAsync();
            if (Web?.CoreWebView2 == null) return;

            _appJs ??= await LoadAppJsAsyncFallback();

            if (_topForwardId == null)
                _topForwardId = await Web.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(TOP_FORWARD);

            if (_appJsRegId == null && !string.IsNullOrEmpty(_appJs))
                _appJsRegId = await Web.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(_appJs);

            if (_autoStartId == null)
                _autoStartId = await Web.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(FRAME_AUTOSTART);

            if (!_frameHooked)
            {
                Web.CoreWebView2.FrameCreated += CoreWebView2_FrameCreated_Bridge;
                _frameHooked = true;
            }

            if (!_frameNavHooked)
            {
                Web.CoreWebView2.FrameNavigationStarting += CoreWebView2_FrameNavigationStarting_Bridge;
                Web.CoreWebView2.FrameNavigationCompleted += CoreWebView2_FrameNavigationCompleted_Bridge;
                _frameNavHooked = true;
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
                // Tiêm lại ngay trên tài liệu hiện tại (phòng khi AddScript chưa kịp chạy vì timing)
                await Web.CoreWebView2.ExecuteScriptAsync(TOP_FORWARD);
                if (!string.IsNullOrEmpty(_appJs))
                    await Web.CoreWebView2.ExecuteScriptAsync(_appJs);

                // Kích autostart trên top (idempotent - nếu không có __cw_startPush thì không sao)
                await Web.CoreWebView2.ExecuteScriptAsync(FRAME_AUTOSTART);

                _lastDocKey = key;
                Log("[Bridge] Injected on current doc, key=" + key);
            }


        }

        private async Task EnsureToolBridgeInjectedAsync()
        {
            await EnsureWebReadyAsync();
            await LogBridgeProbeAsync("ensure-before");
            await EnsureBridgeRegisteredAsync();
            await InjectOnNewDocAsync();
            if (IsCurrentHostAllowUnboundHistory())
                ReArmExistingMainFrames("ensure-tool-wrapper");
            if (_popupWeb != null)
            {
                try
                {
                    await EnsurePopupWebReadyAsync();
                    await InjectOnPopupDocAsync();
                }
                catch (Exception ex)
                {
                    Log("[Bridge.PopupInject] " + ex.Message);
                }
            }
            var target = GetBetWebView();
            Log("[Bridge] Explicit tool injection requested on " + GetBetWebViewName(target) + " | " + GetBetWebViewSource(target));
            await LogBridgeProbeAsync("ensure-after");
        }


        private void CoreWebView2_FrameCreated_Bridge(object? sender, CoreWebView2FrameCreatedEventArgs e)
        {
            try
            {
                ArmMainFrameBridge(e.Frame, "frame-created");
            }
            catch (Exception ex)
            {
                Log("[Bridge.FrameCreated] " + ex.Message);
            }
        }

        private void CoreWebView2_FrameNavigationStarting_Bridge(object? sender, CoreWebView2NavigationStartingEventArgs e)
        {
            try
            {
                var frameId = TryGetFrameIdSafe(e);
                if (frameId == 0) return;
                var frame = TryGetFrameByIdSafe(frameId);
                if (frame == null) return;
                ArmMainFrameBridge(frame, "frame-nav-start");
            }
            catch (Exception ex)
            {
                Log("[Bridge.FrameNavStarting] " + ex.Message);
            }
        }

        private void CoreWebView2_FrameNavigationCompleted_Bridge(object? sender, CoreWebView2NavigationCompletedEventArgs e)
        {
            try
            {
                var frameId = TryGetFrameIdSafe(e);
                if (frameId == 0) return;
                var frame = TryGetFrameByIdSafe(frameId);
                if (frame == null) return;
                ArmMainFrameBridge(frame, "frame-nav-done");
            }
            catch (Exception ex)
            {
                Log("[Bridge.FrameNavCompleted] " + ex.Message);
            }
        }

        private void ArmMainFrameBridge(CoreWebView2Frame frame, string stage)
        {
            if (frame == null) return;
            try
            {
                var frameId = TryGetFrameIdSafe(frame);
                if (frameId > 0)
                    _mainFrameRefs[frameId] = frame;

                var shouldAttachHandlers = frameId == 0 || _mainFrameBridgeArmed.TryAdd(frameId, 1);
                var stageNeedsProbe =
                    stage.IndexOf("nav", StringComparison.OrdinalIgnoreCase) >= 0 ||
                    stage.IndexOf("created", StringComparison.OrdinalIgnoreCase) >= 0 ||
                    stage.IndexOf("probe", StringComparison.OrdinalIgnoreCase) >= 0;
                var runProbe = shouldAttachHandlers || stageNeedsProbe;
                if (shouldAttachHandlers)
                {
                    _ = frame.ExecuteScriptAsync(FRAME_SHIM);
                    frame.WebMessageReceived += MainFrame_WebMessageReceived_Bridge;
                    frame.NavigationCompleted += Frame_NavigationCompleted_Bridge;
                }

                if (shouldAttachHandlers || stageNeedsProbe)
                {
                    if (frameId > 0)
                        Log("[Bridge] Frame armed (" + stage + ") | id=" + frameId);
                    else
                        Log("[Bridge] Frame armed (" + stage + ")");
                }

                if (runProbe)
                {
                    ProbeFrameBridgeAsync(frame, "Web", stage);
                    _ = InjectGameBridgeOnFrameIfNeededAsync(frame, stage + "-probe");
                }
            }
            catch (Exception ex)
            {
                if (IsDisposedFrameException(ex))
                {
                    DropMainFrameRef(frame);
                    return;
                }
                Log("[Bridge.ArmFrame] stage=" + stage + " | " + ex.Message);
            }
        }

        private static bool IsDisposedFrameException(Exception ex)
        {
            var msg = ex?.Message ?? "";
            return
                msg.IndexOf("cannot be accessed after the WebView2 control is disposed", StringComparison.OrdinalIgnoreCase) >= 0 ||
                msg.IndexOf("objectdisposed", StringComparison.OrdinalIgnoreCase) >= 0 ||
                msg.IndexOf("disposed object", StringComparison.OrdinalIgnoreCase) >= 0;
        }

        private void DropMainFrameRef(CoreWebView2Frame? frame)
        {
            try
            {
                var id = TryGetFrameIdSafe(frame);
                if (id > 0)
                {
                    _mainFrameRefs.TryRemove(id, out _);
                    _mainFrameBridgeArmed.TryRemove(id, out _);
                }
            }
            catch { }
        }

        private static ulong TryGetFrameIdSafe(object? source)
        {
            try
            {
                if (source == null) return 0;
                var t = source.GetType();
                var p = t.GetProperty("FrameId", BindingFlags.Public | BindingFlags.Instance | BindingFlags.IgnoreCase);
                if (p == null) return 0;
                var raw = p.GetValue(source);
                if (raw == null) return 0;
                if (raw is ulong u) return u;
                if (raw is long l && l > 0) return (ulong)l;
                if (raw is int i && i > 0) return (ulong)i;
                var s = Convert.ToString(raw, CultureInfo.InvariantCulture);
                return ulong.TryParse(s, out var parsed) ? parsed : 0;
            }
            catch
            {
                return 0;
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

        private List<CoreWebView2Frame> GetMainExistingFramesSnapshot()
        {
            var frames = new List<CoreWebView2Frame>();
            try
            {
                if (Web?.CoreWebView2 == null)
                    return frames;

                var seen = new HashSet<ulong>();
                void AddFrame(CoreWebView2Frame? frame)
                {
                    if (frame == null) return;
                    var id = TryGetFrameIdSafe(frame);
                    if (id > 0)
                    {
                        if (!seen.Add(id)) return;
                        _mainFrameRefs[id] = frame;
                    }
                    else if (frames.Contains(frame))
                    {
                        return;
                    }
                    frames.Add(frame);
                }

                var core = Web.CoreWebView2;
                var t = core.GetType();

                var pFrames = t.GetProperty("Frames", BindingFlags.Public | BindingFlags.Instance | BindingFlags.IgnoreCase);
                if (pFrames?.GetValue(core) is System.Collections.IEnumerable ieFrames)
                {
                    foreach (var obj in ieFrames)
                        AddFrame(obj as CoreWebView2Frame);
                }

                var mGetFrames = t.GetMethod("GetFrames", BindingFlags.Public | BindingFlags.Instance, binder: null, types: Type.EmptyTypes, modifiers: null);
                if (mGetFrames?.Invoke(core, null) is System.Collections.IEnumerable ieFramesByMethod)
                {
                    foreach (var obj in ieFramesByMethod)
                        AddFrame(obj as CoreWebView2Frame);
                }

                foreach (var kv in _mainFrameRefs.ToArray())
                {
                    var id = kv.Key;
                    if (id == 0)
                    {
                        AddFrame(kv.Value);
                        continue;
                    }

                    var live = TryGetFrameByIdSafe(id);
                    if (live != null)
                    {
                        _mainFrameRefs[id] = live;
                        AddFrame(live);
                    }
                    else
                    {
                        // Một số host/frame cross-origin có thể không resolve lại được bằng id trong vài nhịp.
                        // Giữ reference cũ để ExecuteOnBetWebAsync vẫn có frame fallback chạy __cw_*.
                        AddFrame(kv.Value);
                    }
                }

                foreach (var id in _mainFrameBridgeArmed.Keys.ToArray())
                {
                    if (id == 0 || seen.Contains(id))
                        continue;
                    var live = TryGetFrameByIdSafe(id);
                    if (live != null)
                    {
                        _mainFrameRefs[id] = live;
                        AddFrame(live);
                    }
                    else
                    {
                        if (_mainFrameRefs.TryGetValue(id, out var cached) && cached != null)
                        {
                            AddFrame(cached);
                        }
                        else
                        {
                            _mainFrameRefs.TryRemove(id, out _);
                            _mainFrameBridgeArmed.TryRemove(id, out _);
                        }
                    }
                }
            }
            catch { }

            return frames;
        }

        private int ReArmExistingMainFrames(string stage)
        {
            var st = (stage ?? "").Trim();
            if (st.StartsWith("ensure-tool-wrapper", StringComparison.OrdinalIgnoreCase) ||
                st.StartsWith("exec-bridge-wrapper", StringComparison.OrdinalIgnoreCase))
            {
                var now = DateTime.UtcNow;
                if ((now - _lastMainFramesRearmUtc).TotalMilliseconds < 1200 &&
                    !_mainFrameBridgeArmed.IsEmpty)
                    return 0;
                _lastMainFramesRearmUtc = now;
            }

            int armed = 0;
            try
            {
                var frames = GetMainExistingFramesSnapshot();
                foreach (var frame in frames)
                {
                    ArmMainFrameBridge(frame, stage);
                    armed++;
                }
            }
            catch (Exception ex)
            {
                Log("[Bridge.ReArmExisting] stage=" + stage + " | " + ex.Message);
            }

            if (armed > 0)
                Log("[Bridge] Re-armed existing frames (" + stage + ") | count=" + armed);
            return armed;
        }

        private void Frame_DOMContentLoaded_Bridge(object? sender, CoreWebView2DOMContentLoadedEventArgs e)
        {
            try
            {
                var f = sender as CoreWebView2Frame;
                if (f == null) return;

                _ = f.ExecuteScriptAsync(FRAME_SHIM);
                ProbeFrameBridgeAsync(f, "Frame", "dom-content-loaded");
            }
            catch (Exception ex)
            {
                Log("[Bridge.Frame DOMContentLoaded] " + ex.Message);
            }
        }

        private sealed class FrameDocProbe
        {
            public string Href { get; set; } = "";
            public string DocKey { get; set; } = "";
            public bool HasCocos { get; set; }
        }

        private static bool IsLikelyGameFrameHref(string? hrefRaw)
        {
            var href = (hrefRaw ?? "").Trim();
            if (href.Length == 0) return false;
            return
                href.IndexOf("singleBacTable.jsp", StringComparison.OrdinalIgnoreCase) >= 0 ||
                href.IndexOf("webMain.jsp", StringComparison.OrdinalIgnoreCase) >= 0 ||
                href.IndexOf("/player/", StringComparison.OrdinalIgnoreCase) >= 0 ||
                href.IndexOf("xoc", StringComparison.OrdinalIgnoreCase) >= 0 ||
                href.IndexOf("baccarat", StringComparison.OrdinalIgnoreCase) >= 0 ||
                href.IndexOf("table", StringComparison.OrdinalIgnoreCase) >= 0;
        }

        private static bool TryGetBaccaratFrameKey(string? hrefRaw, out string key)
        {
            key = "";
            var href = (hrefRaw ?? "").Trim();
            if (href.Length == 0)
                return false;
            if (href.IndexOf("/activations/baccarat", StringComparison.OrdinalIgnoreCase) < 0)
                return false;
            if (!Uri.TryCreate(href, UriKind.Absolute, out var uri))
                return false;

            string id = "";
            var m = Regex.Match(uri.Query ?? "", @"(?:^|[?&])id=([^&#]+)", RegexOptions.IgnoreCase);
            if (m.Success)
            {
                try { id = Uri.UnescapeDataString(m.Groups[1].Value ?? ""); }
                catch { id = m.Groups[1].Value ?? ""; }
            }
            id = (id ?? "").Trim().ToLowerInvariant();
            if (id.Length == 0)
                return false;

            key = $"{uri.Host.ToLowerInvariant()}|{id}";
            return true;
        }

        private static string TrimHrefForLog(string? hrefRaw)
        {
            var href = (hrefRaw ?? "").Trim();
            if (href.Length <= 140)
                return href;
            return href.Substring(0, 140) + "...";
        }

        private void ObserveTableSwitchFromFrameHref(string? hrefRaw, string stage)
        {
            if (!TryGetBaccaratFrameKey(hrefRaw, out var key))
                return;

            lock (_roundStateLock)
            {
                if (string.IsNullOrWhiteSpace(_lastBaccaratFrameKey))
                {
                    _lastBaccaratFrameKey = key;
                    _lastBaccaratFrameHref = hrefRaw ?? "";
                    _tableSwitchRebaseArmed = true;
                    _tableSwitchRebaseArmedAtUtc = DateTime.UtcNow;
                    _tableSwitchFromKey = "";
                    _tableSwitchToKey = key;
                    _tableSwitchFromHref = "";
                    _tableSwitchToHref = hrefRaw ?? "";
                    _initialTableEnterArmed = true;
                    _initialTableEnterArmedAtUtc = DateTime.UtcNow;
                    Log($"[SEQ][TABLE-ENTER-ARM] stage={stage} | to={key} | href={TrimHrefForLog(hrefRaw)}");
                    return;
                }

                if (string.Equals(_lastBaccaratFrameKey, key, StringComparison.Ordinal))
                {
                    _lastBaccaratFrameHref = hrefRaw ?? _lastBaccaratFrameHref;
                    return;
                }

                // Đổi bàn là đổi context cứng: luôn arm table-switch.
                // Không được giữ shoe-arm từ bàn cũ để tránh kéo seq cũ sang bàn mới.
                if (_shoeChangeRebaseArmed || _shoeChangeStatusStreak > 0)
                {
                    Log($"[SEQ][SHOE-ARM-CLEAR] reason=table-switch-detected | stage={stage} | from={_lastBaccaratFrameKey} | to={key} | netLen={_netSeqDisplay.Length} | netVer={_netSeqVersion} | fromHref={TrimHrefForLog(_lastBaccaratFrameHref)} | toHref={TrimHrefForLog(hrefRaw)}");
                    ClearShoeChangeRebaseArmLocked();
                }

                _tableSwitchRebaseArmed = true;
                _tableSwitchRebaseArmedAtUtc = DateTime.UtcNow;
                _tableSwitchFromKey = _lastBaccaratFrameKey;
                _tableSwitchToKey = key;
                _tableSwitchFromHref = _lastBaccaratFrameHref;
                _tableSwitchToHref = hrefRaw ?? "";
                _lastBaccaratFrameKey = key;
                _lastBaccaratFrameHref = hrefRaw ?? "";

                Log($"[SEQ][TABLE-SWITCH-ARM] stage={stage} | from={_tableSwitchFromKey} | to={_tableSwitchToKey} | netLen={_netSeqDisplay.Length} | netVer={_netSeqVersion} | fromHref={TrimHrefForLog(_tableSwitchFromHref)} | toHref={TrimHrefForLog(_tableSwitchToHref)}");
            }
        }

        private async Task<FrameDocProbe?> ReadFrameDocProbeAsync(CoreWebView2Frame frame)
        {
            try
            {
                var raw = await frame.ExecuteScriptAsync(
                    "(function(){try{" +
                    "var href=String(location.href||'');" +
                    "var key=String((performance&&performance.timeOrigin)||Date.now());" +
                    "var hasCC=!!(window.cc&&cc.director&&cc.director.getScene);" +
                    "return JSON.stringify({href:href,key:key,hasCC:hasCC});" +
                    "}catch(_){return JSON.stringify({href:'',key:'',hasCC:false});}})();");
                var json = JsonSerializer.Deserialize<string>(raw) ?? "";
                if (string.IsNullOrWhiteSpace(json))
                    return null;

                using var doc = JsonDocument.Parse(json);
                var root = doc.RootElement;
                bool hasCC = false;
                if (root.TryGetProperty("hasCC", out var hasCcEl))
                {
                    if (hasCcEl.ValueKind == JsonValueKind.True) hasCC = true;
                    else if (hasCcEl.ValueKind == JsonValueKind.Number && hasCcEl.TryGetInt32(out var ncc)) hasCC = ncc != 0;
                    else if (hasCcEl.ValueKind == JsonValueKind.String)
                    {
                        var scc = hasCcEl.GetString() ?? "";
                        hasCC = string.Equals(scc, "true", StringComparison.OrdinalIgnoreCase) ||
                                string.Equals(scc, "1", StringComparison.OrdinalIgnoreCase);
                    }
                }
                return new FrameDocProbe
                {
                    Href = GetJsonStringLoose(root, "href") ?? "",
                    DocKey = GetJsonStringLoose(root, "key") ?? "",
                    HasCocos = hasCC
                };
            }
            catch (Exception ex)
            {
                if (IsDisposedFrameException(ex))
                    DropMainFrameRef(frame);
                return null;
            }
        }

        private async Task<bool> InjectGameBridgeOnFrameIfNeededAsync(CoreWebView2Frame frame, string stage)
        {
            var probe = await ReadFrameDocProbeAsync(frame);
            if (probe == null) return false;

            bool looksGame = probe.HasCocos || IsLikelyGameFrameHref(probe.Href);
            if (!looksGame)
                return false;
            ObserveTableSwitchFromFrameHref(probe.Href, stage);

            var frameRefKey = RuntimeHelpers.GetHashCode(frame);
            var docKey = string.IsNullOrWhiteSpace(probe.DocKey)
                ? ("no-dockey|" + (probe.Href ?? ""))
                : probe.DocKey;
            if (_frameInjectedDocKeys.TryGetValue(frameRefKey, out var lastKey) &&
                string.Equals(lastKey, docKey, StringComparison.Ordinal))
            {
                return false;
            }

            _frameInjectedDocKeys[frameRefKey] = docKey;
            _ = frame.ExecuteScriptAsync(FRAME_SHIM);
            if (!string.IsNullOrEmpty(_appJs))
                _ = frame.ExecuteScriptAsync(_appJs);
            _ = frame.ExecuteScriptAsync(FRAME_AUTOSTART);
            _ = frame.ExecuteScriptAsync(START_PUSH_NOW);

            var hrefLog = probe.Href ?? "";
            if (hrefLog.Length > 160)
                hrefLog = hrefLog.Substring(0, 160) + "...";
            Log("[Bridge] Frame " + stage + " -> injected game frame + autostart. | href=" + hrefLog);
            ProbeFrameBridgeAsync(frame, "Frame", stage + "-inject");
            return true;
        }

        private async void Frame_NavigationCompleted_Bridge(object? sender, CoreWebView2NavigationCompletedEventArgs e)
        {
            try
            {
                if (!e.IsSuccess) return;
                var f = sender as CoreWebView2Frame;
                if (f == null) return;
                await InjectGameBridgeOnFrameIfNeededAsync(f, "nav-completed");
            }
            catch (Exception ex)
            {
                if (IsDisposedFrameException(ex))
                {
                    if (sender is CoreWebView2Frame disposedFrame)
                    {
                        DropMainFrameRef(disposedFrame);
                        DropPopupFrameRef(disposedFrame);
                    }
                    return;
                }
                Log("[Bridge.Frame NavigationCompleted] " + ex.Message);
            }
        }

        private async void MainFrame_WebMessageReceived_Bridge(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
        {
            try
            {
                var msg = e.TryGetWebMessageAsString() ?? "";
                if (string.IsNullOrWhiteSpace(msg)) return;
                await HandleIncomingWebMessageAsync(msg, "main-frame");
            }
            catch (Exception ex)
            {
                Log("[MainFrame.WebMessageReceived] " + ex);
            }
        }

        private async Task TryPullPopupTickFallbackAsync()
        {
            if (_popupWeb?.CoreWebView2 == null) return;
            if (!IsPopupBetViewActive()) return;
            var now = DateTime.UtcNow;
            if (_lastPopupTickPullUtc != DateTime.MinValue &&
                (now - _lastPopupTickPullUtc) <= TimeSpan.FromMilliseconds(900))
                return;
            var age = now - _lastGameTickUtc;
            if (age <= TimeSpan.FromSeconds(2.2)) return;
            if (Interlocked.Exchange(ref _popupTickPullBusy, 1) == 1) return;
            try
            {
                _lastPopupTickPullUtc = now;
                var raw = await _popupWeb.CoreWebView2.ExecuteScriptAsync(PULL_POPUP_TICK_NOW);
                var msg = JsonSerializer.Deserialize<string>(raw) ?? "";
                if (string.IsNullOrWhiteSpace(msg))
                    return;
                await HandleIncomingWebMessageAsync(msg, "popup-pull");
            }
            catch { }
            finally
            {
                Interlocked.Exchange(ref _popupTickPullBusy, 0);
            }
        }


        private async Task<bool> WaitForBridgeAndGameDataAsync(int timeoutMs = 20000)
        {
            var t0 = DateTime.UtcNow;
            string lastTypeBet = "";
            bool lastHasTick = false;
            int lastSeqLen = 0;
            string lastStatus = "";
            while ((DateTime.UtcNow - t0).TotalMilliseconds < timeoutMs)
            {
                try
                {
                    // 1) __cw_bet có chưa
                    var typeBet = (await ExecuteOnBetWebAsync("typeof window.__cw_bet"))?.Trim('"');
                    bool hasBet = string.Equals(typeBet, "function", StringComparison.OrdinalIgnoreCase);
                    lastTypeBet = typeBet ?? "";

                    // 2) Đã có tick chưa (ít nhất có seq hoặc status)
                    bool hasTick = false;
                    lock (_snapLock)
                    {
                        lastSeqLen = _lastSnap?.seq?.Length ?? 0;
                        lastStatus = _lastSnap?.status ?? "";
                        hasTick =
                            (_lastSnap?.seq != null && _lastSnap.seq.Length > 0) ||
                            !string.IsNullOrWhiteSpace(_lastSnap?.status);
                    }
                    lastHasTick = hasTick;

                    if (hasBet && hasTick)
                        return true;
                }
                catch { /* tiếp tục đợi */ }

                await Task.Delay(300);
            }
            Log($"[BridgeWait] timeout={timeoutMs}ms | betType={(string.IsNullOrWhiteSpace(lastTypeBet) ? "<empty>" : lastTypeBet)} | hasTick={(lastHasTick ? 1 : 0)} | seqLen={lastSeqLen} | status={(string.IsNullOrWhiteSpace(lastStatus) ? "-" : Shrink(lastStatus, 80))}");
            await LogBridgeProbeAsync("wait-timeout");
            return false;
        }


        // JSON license đơn giản trên GitHub
        private record LicenseDoc(string exp, string pass);

        private async Task<LicenseDoc?> FetchLicenseAsync(string username)
        {
            try
            {
                using var http = new HttpClient() { Timeout = TimeSpan.FromSeconds(20) };
                var uname = Uri.EscapeDataString(username);
                var url = $"https://raw.githubusercontent.com/{LicenseOwner}/{LicenseRepo}/{LicenseBranch}/{LicenseNameGame}/{uname}.json";
                var json = await http.GetStringAsync(url);
                return JsonSerializer.Deserialize<LicenseDoc>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
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
                    // tài khoản đang chạy nơi khác
                    Log("[Lease] 409 in-use: " + body);
                    MessageBox.Show("Tài khoản đang chạy nơi khác. Vui lòng thử lại sau.", "Automino", MessageBoxButton.OK, MessageBoxImage.Warning);
                    return false;
                }
                if (resp.IsSuccessStatusCode) return true;
                MessageBox.Show($"Lease bị từ chối [{(int)resp.StatusCode}] - {body}", "Automino",
                    MessageBoxButton.OK, MessageBoxImage.Warning);
                return false;
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
            EnsureDeviceId();
            if (!EnableLeaseCloudflare) return;
            if (string.IsNullOrWhiteSpace(LeaseBaseUrl)) return;
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
                            if (IsAnyTabRunning())
                            {
                                StopAllTasksAndRelease();
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
                            SetLicenseUi(false);
                            StopLicenseRecheckTimer();
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

            // Dùng Now (local) để đồng bộ với _runExpiresAt (đã ToLocalTime ở trên)
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
                // Dưới 1 ngày chỉ hiển thị giờ/phút/giây
                line = $"Còn lại: {left:hh\\:mm\\:ss}";
            }
            LblExpire.Text = line;
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

            Log($"[Lease] hb start: user={username} clientId={clientId}");
            Task.Run(async () =>
            {
                while (!cts.IsCancellationRequested)
                {
                    try
                    {
                        using var http = new HttpClient() { Timeout = TimeSpan.FromSeconds(4) };
                        var resp = await http.PostAsJsonAsync($"{LeaseBaseUrl}/heartbeat/{uname}",
                                                          new { clientId, sessionId, deviceId = _deviceId, appId = AppLocalDirName });
                        var body = await resp.Content.ReadAsStringAsync();
                        if (resp.IsSuccessStatusCode)
                            Log("[Lease] hb -> " + (int)resp.StatusCode);
                        else
                            Log($"[Lease] hb -> {(int)resp.StatusCode} {resp.ReasonPhrase} | {body}");
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
                StopLicenseRecheckTimer();
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
                CleanupWebStuff();       // 🔴 thêm
            }
            catch { }
        }



        private void CleanupWebStuff()
        {
            // 1) huỷ các CTS liên quan đến web / auto login
            try { _navCts?.Cancel(); } catch { }
            _navCts = null;

            try { _userCts?.Cancel(); } catch { }
            _userCts = null;

            try { _passCts?.Cancel(); } catch { }
            _passCts = null;

            try { _stakeCts?.Cancel(); } catch { }
            _stakeCts = null;

            StopAutoLoginWatcher();

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
            _frameNavHooked = false;
            _domHooked = false;
            _mainFrameBridgeArmed.Clear();
            _mainFrameRefs.Clear();
            _popupFrameRefs.Clear();
            _frameInjectedDocKeys.Clear();
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

        private static string BuildStatusUiText(string? statusRaw, double? prog)
        {
            statusRaw = (statusRaw ?? "").Trim();
            if (!statusRaw.StartsWith("Baccarat DOM", StringComparison.OrdinalIgnoreCase))
                return statusRaw;

            if (!prog.HasValue)
                return "";

            var pv = prog.Value;
            if (pv <= 2.5) return "Đang mở bài";
            if (pv <= 7.5) return "Tạm ngừng đặt cược";
            if (pv <= 27.5) return "Nắm giữ cơ hội này nhé";
            if (pv <= 92.5) return "Chúc may mắn";
            return "Bắt đầu đặt cược";
        }


        // Dùng lại cờ này nếu bạn đã có, hoặc thêm mới:

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
            if (TryParseLooseDouble(s, out var v))
                return v;
            return 0;
        }

        private async void TxtCut_LostFocus(object sender, RoutedEventArgs e)
        {
            if (!_uiReady || _tabSwitching) return;

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
            foreach (var tab in _strategyTabs.Where(t => t.IsRunning).ToList())
                CheckCutAndStopIfNeeded(tab);
        }
        private void CheckCutAndStopIfNeeded(StrategyTabState tab)
        {
            if (tab == null) return;
            if (tab.CutStopTriggered) return;

            double cutProfit = tab.Config?.CutProfit ?? 0;   // dương -> bật cắt lãi
            double cutLoss = tab.Config?.CutLoss ?? 0;       // dương -> bật cắt lỗ (ngưỡng là -cutLoss)

            if (cutProfit <= 0 && cutLoss <= 0) return;

            var winTotal = tab.WinTotal;
            if (cutProfit > 0 && winTotal >= cutProfit)
            {
                tab.CutStopTriggered = true;
                StopTaskAndNotify(tab, $"Đạt CẮT LÃI: Tiền thắng = {winTotal:N0} >= {cutProfit:N0}");
                return;
            }

            if (cutLoss > 0)
            {
                var lossThreshold = -cutLoss;
                if (winTotal <= lossThreshold)
                {
                    tab.CutStopTriggered = true;
                    StopTaskAndNotify(tab, $"Đạt CẮT LỖ: Tiền thắng = {winTotal:N0} <= {lossThreshold:N0}");
                    return;
                }
            }
        }

        private void StopTaskAndNotify(StrategyTabState tab, string reason)
        {
            try
            {
                StopTask(tab);
                if (ReferenceEquals(_activeTab, tab))
                    SetPlayButtonState(false);
                MessageBox.Show(reason, "Automino", MessageBoxButton.OK, MessageBoxImage.Information);
                Log("[CUT] " + reason);
            }
            catch { /* ignore */ }
        }

        private void MarkPendingRowsClosed()
        {
            if (_pendingRows.Count == 0) return;
            foreach (var row in _pendingRows)
                row.SawClosedAfterIssue = true;
        }

        private void InvalidatePendingRowsForContextReset(long tableId, long gameShoe, long gameRound)
        {
            if (_pendingRows.Count == 0) return;

            var staleRows = _pendingRows
                .Where(row =>
                    ((tableId > 0 && row.IssuedTableId > 0 && row.IssuedTableId != tableId) ||
                     (gameShoe > 0 && row.IssuedGameShoe > 0 && row.IssuedGameShoe != gameShoe)))
                .ToList();
            if (staleRows.Count == 0) return;

            double balance = ResolveHistoryBalance();
            foreach (var row in staleRows)
            {
                row.Result = "RESET-CONTEXT";
                row.WinLose = "Bỏ qua";
                row.Account = balance;
                Log($"[BET][HIST][DROP] at={row.At:HH:mm:ss} | side={row.Side} | stake={row.Stake:N0} | round={row.IssuedRoundId} | issueTable={row.IssuedTableId} | issueShoe={row.IssuedGameShoe} | newTable={tableId} | newShoe={gameShoe} | newRound={gameRound} | reason=context-reset");
            }

            foreach (var row in staleRows)
                _pendingRows.Remove(row);

            if (_autoFollowNewest)
                ShowFirstPage();
            else
                RefreshCurrentPage();
        }

        private void LogHistAlertThrottled(string message, int minSeconds = 5)
        {
            var now = DateTime.UtcNow;
            if ((now - _lastHistAlertUtc).TotalSeconds < minSeconds)
                return;
            _lastHistAlertUtc = now;
            Log(message);
        }

        private bool ShouldDeferSeqNotAdvancedAlert(BetRow oldestRow, string? settleSeqEvent)
        {
            if (oldestRow == null)
                return false;

            long observedTableId;
            long observedGameShoe;
            long netLastRound;
            lock (_roundStateLock)
            {
                observedTableId = _netObservedTableId > 0 ? _netObservedTableId : _netSeqTableId;
                observedGameShoe = _netObservedGameShoe > 0 ? _netObservedGameShoe : _netSeqGameShoe;
                netLastRound = _netSeqLastRound;
            }

            bool sameTable = observedTableId <= 0 || oldestRow.IssuedTableId <= 0 || oldestRow.IssuedTableId == observedTableId;
            bool sameShoe = observedGameShoe <= 0 || oldestRow.IssuedGameShoe <= 0 || oldestRow.IssuedGameShoe == observedGameShoe;
            bool waitingForObservedWinner =
                oldestRow.IssuedObservedRound > 0 &&
                oldestRow.IssuedObservedRound > netLastRound;
            bool recentPending = (DateTime.Now - oldestRow.At).TotalSeconds <= 90;
            string evt = settleSeqEvent ?? "";
            bool transientSeqEvent =
                evt.IndexOf("shoe-reset-arm-no-board", StringComparison.OrdinalIgnoreCase) >= 0 ||
                evt.IndexOf("js-resync-no-change", StringComparison.OrdinalIgnoreCase) >= 0 ||
                string.Equals(evt, "no-change", StringComparison.OrdinalIgnoreCase);

            return recentPending && sameTable && sameShoe && waitingForObservedWinner && transientSeqEvent;
        }

        private double ResolveHistoryBalance(double? preferred = null)
        {
            if (preferred.HasValue)
                return preferred.Value;
            try
            {
                var uiBalance = ParseMoneyOrZero(LblAmount?.Text ?? "0");
                if (uiBalance > 0)
                    return uiBalance;
            }
            catch { }
            lock (_snapLock)
            {
                if (_lastSnap?.totals?.A is double snapBalance)
                    return snapBalance;
            }
            return _pendingRows.Count > 0 ? _pendingRows[0].Account : 0;
        }

        private void FinalizeLastBet(
            string? result,
            double balanceAfter,
            HashSet<string>? winners = null,
            string? displayResult = null,
            string? settleSeqDisplay = null,
            long? settleSeqVersion = null,
            string? settleSeqEvent = null,
            string settleReason = "",
            long settleTableId = 0,
            long settleGameShoe = 0,
            long settleGameRound = 0)
        {
            if (_pendingRows.Count == 0 || string.IsNullOrWhiteSpace(result)) return;

            var winSet = winners ?? new HashSet<string>(StringComparer.OrdinalIgnoreCase) { result! };
            var resultText = string.IsNullOrWhiteSpace(displayResult)
                ? result!.ToUpperInvariant()
                : displayResult!;
            bool isTieResult = string.Equals(TextNorm.U(resultText), "TIE", StringComparison.Ordinal)
                               || string.Equals(TextNorm.U(resultText), "T", StringComparison.Ordinal);

            var settleDisplay = settleSeqDisplay ?? "";
            bool hasSettleContext = !string.IsNullOrWhiteSpace(settleDisplay) || (settleSeqVersion ?? 0) > 0;
            bool hasSettleVersion = (settleSeqVersion ?? 0) > 0;
            bool hasSettleTable = settleTableId > 0;
            bool hasSettleShoe = settleGameShoe > 0;
            char settleTail = settleDisplay.Length > 0 ? settleDisplay[^1] : '-';
            bool advFallbackLogged = false;
            bool isNetworkWinnerSettle =
                string.Equals(settleReason, "net-gp-winner", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(settleSeqEvent, "net-gp-winner", StringComparison.OrdinalIgnoreCase);

            bool IsRowContextMatch(BetRow row)
            {
                if (!hasSettleTable && !hasSettleShoe)
                    return true;
                if (hasSettleTable && row.IssuedTableId > 0 && row.IssuedTableId != settleTableId)
                    return false;
                if (hasSettleShoe && row.IssuedGameShoe > 0 && row.IssuedGameShoe != settleGameShoe)
                    return false;
                return true;
            }

            bool IsRowSeqAdvanced(BetRow row)
            {
                if (!hasSettleContext) return true;
                if (isNetworkWinnerSettle &&
                    settleGameRound > 0 &&
                    IsRowContextMatch(row) &&
                    row.IssuedObservedRound > 0 &&
                    row.IssuedObservedRound == settleGameRound)
                {
                    if (!advFallbackLogged)
                    {
                        advFallbackLogged = true;
                        Log($"[BET][HIST][ADV-FALLBACK] reason=winner-round-confirmed | issueObsRound={row.IssuedObservedRound} | settleRound={settleGameRound} | issueVer={(row.IssuedSeqVersion?.ToString() ?? "-")} | settleVer={(settleSeqVersion?.ToString() ?? "-")} | issueEvt={(string.IsNullOrWhiteSpace(row.IssuedSeqEvent) ? "-" : row.IssuedSeqEvent)} | settleEvt={(string.IsNullOrWhiteSpace(settleSeqEvent) ? "-" : settleSeqEvent)}");
                    }
                    return true;
                }
                bool displayAdvanced = !string.Equals(settleDisplay, row.IssuedSeqDisplay ?? "", StringComparison.Ordinal);
                bool hasIssueVersion = (row.IssuedSeqVersion ?? 0) > 0;
                if (hasSettleVersion && hasIssueVersion)
                {
                    if (settleSeqVersion!.Value > row.IssuedSeqVersion!.Value)
                        return true;
                    if (settleSeqVersion!.Value < row.IssuedSeqVersion!.Value &&
                        row.SawClosedAfterIssue &&
                        displayAdvanced)
                    {
                        if (!advFallbackLogged)
                        {
                            advFallbackLogged = true;
                            Log($"[BET][HIST][ADV-FALLBACK] reason=version-regress-display | issueVer={row.IssuedSeqVersion} | settleVer={settleSeqVersion} | issueLen={row.IssuedSeqDisplay.Length} | settleLen={settleDisplay.Length} | settleEvt={(settleSeqEvent ?? "-")}");
                        }
                        return true;
                    }
                    return false;
                }
                return displayAdvanced;
            }

            var pendingSnapshot = _pendingRows.ToList();
            if (hasSettleTable || hasSettleShoe || settleGameRound > 0)
            {
                var lateBindableRows = pendingSnapshot
                    .Where(row =>
                        ((hasSettleTable && row.IssuedTableId <= 0) ||
                         (hasSettleShoe && row.IssuedGameShoe <= 0)) &&
                        row.IssuedObservedRound > 0 &&
                        row.IssuedRoundId > 0)
                    .ToList();
                if (lateBindableRows.Count > 0)
                {
                    foreach (var row in lateBindableRows)
                    {
                        row.IssuedTableId = hasSettleTable ? settleTableId : row.IssuedTableId;
                        row.IssuedGameShoe = hasSettleShoe ? settleGameShoe : row.IssuedGameShoe;
                        if (row.IssuedObservedRound <= 0 && settleGameRound > 0)
                            row.IssuedObservedRound = settleGameRound;
                        if (string.IsNullOrWhiteSpace(row.IssuedSeqSource))
                            row.IssuedSeqSource = "late-bind";
                        Log($"[BET][HIST][BIND] at={row.At:HH:mm:ss} | side={row.Side} | stake={row.Stake:N0} | round={row.IssuedRoundId} | bindTable={(hasSettleTable ? settleTableId.ToString() : "-")} | bindShoe={(hasSettleShoe ? settleGameShoe.ToString() : "-")} | bindRound={(settleGameRound > 0 ? settleGameRound.ToString() : "-")} | reason=context-late-bind");
                    }

                    pendingSnapshot = _pendingRows.ToList();
                }

                var unboundRows = pendingSnapshot
                    .Where(row =>
                        (hasSettleTable && row.IssuedTableId <= 0) ||
                        (hasSettleShoe && row.IssuedGameShoe <= 0) ||
                        (settleGameRound > 0 && row.IssuedRoundId <= 0))
                    .ToList();
                if (unboundRows.Count > 0)
                {
                    foreach (var row in unboundRows)
                    {
                        Log($"[BET][HIST][INFO] at={row.At:HH:mm:ss} | side={row.Side} | stake={row.Stake:N0} | round={row.IssuedRoundId} | issueTable={row.IssuedTableId} | issueShoe={row.IssuedGameShoe} | settleTable={(hasSettleTable ? settleTableId.ToString() : "-")} | settleShoe={(hasSettleShoe ? settleGameShoe.ToString() : "-")} | settleRound={(settleGameRound > 0 ? settleGameRound.ToString() : "-")} | reason=keep-pending-without-context");
                    }
                }
            }
            int contextSkipCount = pendingSnapshot.Count(row => !IsRowContextMatch(row));
            var rowsToFinalize = hasSettleContext
                ? pendingSnapshot.Where(row => IsRowContextMatch(row) && IsRowSeqAdvanced(row)).ToList()
                : pendingSnapshot.Where(IsRowContextMatch).ToList();

            if (!HasJackpotMultiSideRunning() && rowsToFinalize.Count > 1)
            {
                var orderedMatches = rowsToFinalize
                    .OrderBy(row => row.At)
                    .ToList();
                var duplicateMatches = orderedMatches.Skip(1).ToList();
                if (duplicateMatches.Count > 0)
                {
                    foreach (var row in duplicateMatches)
                    {
                        row.Result = "RESET-DUP";
                        row.WinLose = "Bỏ qua";
                        row.Account = balanceAfter;
                        Log($"[BET][HIST][DROP] at={row.At:HH:mm:ss} | side={row.Side} | stake={row.Stake:N0} | round={row.IssuedRoundId} | issueTable={row.IssuedTableId} | issueShoe={row.IssuedGameShoe} | settleTable={(hasSettleTable ? settleTableId.ToString() : "-")} | settleShoe={(hasSettleShoe ? settleGameShoe.ToString() : "-")} | settleRound={(settleGameRound > 0 ? settleGameRound.ToString() : "-")} | reason=multi-match-guard");
                        _pendingRows.Remove(row);
                    }
                }
                rowsToFinalize = orderedMatches.Take(1).ToList();
                pendingSnapshot = _pendingRows.ToList();
                contextSkipCount = pendingSnapshot.Count(row => !IsRowContextMatch(row));
            }

            int holdCount = pendingSnapshot.Count(row => IsRowContextMatch(row)) - rowsToFinalize.Count;

            Log($"[BET][HIST][CHECK] reason={(string.IsNullOrWhiteSpace(settleReason) ? "-" : settleReason)} | result={resultText} | pending={pendingSnapshot.Count} | matched={rowsToFinalize.Count} | hold={holdCount} | ctxSkip={contextSkipCount} | settleTable={(hasSettleTable ? settleTableId.ToString() : "-")} | settleShoe={(hasSettleShoe ? settleGameShoe.ToString() : "-")} | settleRound={(settleGameRound > 0 ? settleGameRound.ToString() : "-")} | settleLen={settleDisplay.Length} | settleVer={(hasSettleVersion ? settleSeqVersion!.Value.ToString() : "-")} | settleEvt={(settleSeqEvent ?? "-")} | settleTail={settleTail}");
            foreach (var row in pendingSnapshot)
            {
                bool contextMatch = IsRowContextMatch(row);
                bool advanced = IsRowSeqAdvanced(row);
                char issueTail = row.IssuedSeqDisplay.Length > 0 ? row.IssuedSeqDisplay[^1] : '-';
                Log($"[BET][HIST][CHECK][ROW] at={row.At:HH:mm:ss} | side={row.Side} | stake={row.Stake:N0} | round={row.IssuedRoundId} | issueTable={row.IssuedTableId} | issueShoe={row.IssuedGameShoe} | issueObsRound={row.IssuedObservedRound} | issueLen={row.IssuedSeqDisplay.Length} | issueVer={(row.IssuedSeqVersion?.ToString() ?? "-")} | issueEvt={row.IssuedSeqEvent} | issueSrc={(string.IsNullOrWhiteSpace(row.IssuedSeqSource) ? "-" : row.IssuedSeqSource)} | issueTail={issueTail} | ctxMatch={contextMatch} | advanced={advanced}");
            }

            if (rowsToFinalize.Count == 0)
            {
                Log("[BET][HIST][CHECK][SKIP] no pending row passed settle sequence gating");
                var oldest = pendingSnapshot[0];
                LogHistAlertThrottled(
                    $"[BET][HIST][ALERT] pending-not-settled | reason={(contextSkipCount > 0 ? "context-mismatch" : "no-row-passed-gating")} | pending={pendingSnapshot.Count} | oldestAt={oldest.At:HH:mm:ss} | oldestRound={oldest.IssuedRoundId} | oldestIssueVer={(oldest.IssuedSeqVersion?.ToString() ?? "-")} | settleTable={(hasSettleTable ? settleTableId.ToString() : "-")} | settleShoe={(hasSettleShoe ? settleGameShoe.ToString() : "-")} | settleVer={(hasSettleVersion ? settleSeqVersion!.Value.ToString() : "-")} | settleEvt={(settleSeqEvent ?? "-")}");
                return;
            }

            if (holdCount > 0)
            {
                var oldestHold = pendingSnapshot.FirstOrDefault(r => IsRowContextMatch(r) && !rowsToFinalize.Contains(r));
                if (oldestHold != null)
                {
                    Log($"[BET][HIST][HOLD] count={holdCount} | oldestAt={oldestHold.At:HH:mm:ss} | oldestRound={oldestHold.IssuedRoundId} | oldestIssueVer={(oldestHold.IssuedSeqVersion?.ToString() ?? "-")} | settleTable={(hasSettleTable ? settleTableId.ToString() : "-")} | settleShoe={(hasSettleShoe ? settleGameShoe.ToString() : "-")} | settleVer={(hasSettleVersion ? settleSeqVersion!.Value.ToString() : "-")} | settleEvt={(settleSeqEvent ?? "-")}");
                }
            }

            foreach (var row in rowsToFinalize)
            {
                row.Result = resultText;
                bool win = !isTieResult && winSet.Contains(row.Side);
                row.WinLose = isTieResult ? "Hòa" : (win ? "Thắng" : "Thua");
                row.Account = balanceAfter;
                Log($"[BET][HIST][FINAL] {row.At:HH:mm:ss} | {row.Side} | {row.Stake:N0} | round={row.IssuedRoundId} | issueTable={row.IssuedTableId} | issueShoe={row.IssuedGameShoe} | settleTable={(hasSettleTable ? settleTableId.ToString() : "-")} | settleShoe={(hasSettleShoe ? settleGameShoe.ToString() : "-")} | result={row.Result} | wl={row.WinLose} | acc={row.Account:#,0.##} | issueVer={(row.IssuedSeqVersion?.ToString() ?? "-")} | settleVer={(hasSettleVersion ? settleSeqVersion!.Value.ToString() : "-")}");

                try { AppendBetCsv(row); } catch { }
            }
            foreach (var row in rowsToFinalize)
                _pendingRows.Remove(row);

            if (_autoFollowNewest)
            {
                ShowFirstPage();
            }
            else
            {
                RefreshCurrentPage();
            }
        }

        public void FinalizePendingBetsWithWinners(HashSet<string> winners, string? displayResult = null)
        {
            if (_pendingRows.Count == 0) return;
            double balance = ResolveHistoryBalance();
            var resText = !string.IsNullOrWhiteSpace(displayResult)
                ? displayResult
                : (winners != null && winners.Count > 0 ? string.Join("/", winners) : "-");
            FinalizeLastBet(resText, balance, winners, resText);
        }
        private void SetLevelForMultiChain(StrategyTabState tab, int chainIndex, int levelIndex)
        {
            try
            {
                if (tab == null) return;

                var chains = (tab.RunStakeChains != null && tab.RunStakeChains.Count > 0)
                    ? tab.RunStakeChains
                    : (_stakeChains ?? new List<long[]>());

                int total = chains.Sum(ch => ch?.Length ?? 0);
                string levelText = "";
                if (total > 0)
                {
                    chainIndex = Math.Clamp(chainIndex, 0, chains.Count - 1);
                    var curChain = chains[chainIndex] ?? Array.Empty<long>();
                    levelIndex = Math.Clamp(levelIndex, 0, curChain.Length - 1);

                    int offset = 0;
                    for (int i = 0; i < chainIndex; i++)
                        offset += chains[i]?.Length ?? 0;

                    int pos = offset + levelIndex; // 0-based
                    levelText = $"{pos + 1}/{total}";
                }

                tab.LastLevelText = levelText;

                if (ReferenceEquals(_activeTab, tab))
                {
                    if (LblLevel != null) LblLevel.Text = levelText;
                }
            }
            catch
            {
                if (ReferenceEquals(_activeTab, tab))
                {
                    if (LblLevel != null) LblLevel.Text = "";
                }
            }
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
                            Account = double.TryParse(cols[6], NumberStyles.Any, CultureInfo.InvariantCulture, out var ac) ? ac : 0,
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
            if (u == "B" || u == "BANKER") return "BANKER";
            if (u == "P" || u == "PLAYER") return "PLAYER";
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

        /// <summary>Dựng dãy số trang: 1 ... 4 5 [6] 7 8 ... 20</summary>
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
                    bool isJsLog = name.StartsWith("js-devtools-", StringComparison.OrdinalIgnoreCase);
                    if (isJsLog || !isTodayLog)
                    {
                        try { File.Delete(f); } catch { /* ignore IO */ }
                    }
                }
            }
            catch { /* ignore */ }
        }

        // Mới nhất
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

        // Ô "Tới trang ..."
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


        private static string FilterPlayableSeq(string? raw)
        {
            if (string.IsNullOrWhiteSpace(raw)) return "";
            var sb = new StringBuilder(raw.Length);
            foreach (var ch in raw)
            {
                char u = char.ToUpperInvariant(ch);
                if (u == 'B' || u == 'P') sb.Append(u);
            }
            return KeepLastSeqWindow(sb.ToString(), SeqWindowMax);
        }

        private static CwTotals? CloneTotalsForTasks(CwTotals? t)
        {
            if (t == null) return null;
            return new CwTotals
            {
                B = t.B,
                P = t.P,
                T = t.T,
                A = t.A,
                N = t.N,
                SD = t.SD,
                TT = t.TT,
                T3T = t.T3T,
                T3D = t.T3D,
                TD = t.TD
            };
        }

        private static CwSnapshot? CloneSnapForTasks(CwSnapshot? snap)
        {
            if (snap == null) return null;
            return new CwSnapshot
            {
                abx = snap.abx,
                prog = snap.prog,
                progSource = snap.progSource,
                progTail = snap.progTail,
                totals = CloneTotalsForTasks(snap.totals),
                seq = FilterPlayableSeq(snap.seq),
                rawSeq = snap.rawSeq,
                seqVersion = snap.seqVersion,
                seqEvent = snap.seqEvent,
                seqSource = snap.seqSource,
                seqAppend = snap.seqAppend,
                seqMode = snap.seqMode,
                niSeq = snap.niSeq,
                ts = snap.ts,
                side = snap.side,
                amount = snap.amount,
                error = snap.error,
                session = snap.session,
                username = snap.username,
                status = snap.status,
                statusSource = snap.statusSource,
                statusTail = snap.statusTail,
                jsBuildMs = snap.jsBuildMs,
                jsTotalsMs = snap.jsTotalsMs,
                jsSeqMs = snap.jsSeqMs,
                jsProgMs = snap.jsProgMs,
                jsPerfMode = snap.jsPerfMode
            };
        }

        private static CwSnapshot? CloneSnapRaw(CwSnapshot? snap)
        {
            if (snap == null) return null;
            return new CwSnapshot
            {
                abx = snap.abx,
                prog = snap.prog,
                progSource = snap.progSource,
                progTail = snap.progTail,
                totals = CloneTotalsForTasks(snap.totals),
                seq = snap.seq,
                rawSeq = snap.rawSeq,
                seqVersion = snap.seqVersion,
                seqEvent = snap.seqEvent,
                seqSource = snap.seqSource,
                seqAppend = snap.seqAppend,
                seqMode = snap.seqMode,
                niSeq = snap.niSeq,
                ts = snap.ts,
                side = snap.side,
                amount = snap.amount,
                error = snap.error,
                session = snap.session,
                username = snap.username,
                status = snap.status,
                statusSource = snap.statusSource,
                statusTail = snap.statusTail,
                jsBuildMs = snap.jsBuildMs,
                jsTotalsMs = snap.jsTotalsMs,
                jsSeqMs = snap.jsSeqMs,
                jsProgMs = snap.jsProgMs,
                jsPerfMode = snap.jsPerfMode
            };
        }

        private static string NormalizeSeq(string raw) =>
            TextNorm.U(Regex.Replace(raw ?? "", @"[,\s\-]+", "")); // bỏ dấu phẩy, khoảng trắng, dấu gạch

        // --- Chuỗi B/P: B,P; 2..100 ký tự ---
        private static bool ValidateSeqCL(string s, out string err)
        {
            err = "";
            if (string.IsNullOrWhiteSpace(s))
            {
                err = "Vui lòng nhập chuỗi B/P.";
                return false;
            }

            int count = 0;
            foreach (var ch in s)
            {
                if (char.IsWhiteSpace(ch)) continue;
                char u = char.ToUpperInvariant(ch);
                if (u == 'B' || u == 'P') { count++; continue; }
                err = "Chỉ cho phép khoảng trắng và ký tự B hoặc P.";
                return false;
            }

            if (count < 2 || count > 100)
            {
                err = "Độ dài 2-100 ký tự (tính theo B/P, bỏ qua khoảng trắng).";
                return false;
            }

            return true;
        }

        // --- Chuỗi I/N: I,N; 2..100 ký tự ---
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
                if (char.IsWhiteSpace(ch)) continue;
                char u = char.ToUpperInvariant(ch);
                if (u == 'I' || u == 'N') { count++; continue; }
                err = "Chỉ cho phép khoảng trắng và ký tự I hoặc N.";
                return false;
            }

            if (count < 2 || count > 100)
            {
                err = "Độ dài 2-100 ký tự (tính theo I/N, bỏ qua khoảng trắng).";
                return false;
            }

            return true;
        }

        // --- Thế cầu B/P: từng dòng "<mẫu> -> <chuỗi cầu>", mẫu gồm B/P, chuỗi cầu gồm B/P ---
        private static bool ValidatePatternsCL(string s, out string err)
        {
            err = "";
            if (string.IsNullOrWhiteSpace(s))
            {
                err = "Vui lòng nhập các thế cầu B/P.";
                return false;
            }

            var rules = System.Text.RegularExpressions.Regex.Split(s.Replace("\r", ""), @"[,\;\|\n]+");
            int idx = 0;

            foreach (var raw in rules)
            {
                var line = raw.Trim();
                if (line.Length == 0) continue;
                idx++;

                var m = System.Text.RegularExpressions.Regex.Match(
                    line,
                    @"^\s*([BPbp\s]+)\s*(?:->|-)\s*([BPbp\s]+)\s*$",
                    System.Text.RegularExpressions.RegexOptions.IgnoreCase);

                if (!m.Success)
                {
                    err = $"Quy tắc {idx} không hợp lệ: '{line}'. Dạng đúng: <mẫu> -> <chuỗi cầu> hoặc <mẫu>-<chuỗi cầu>; chỉ dùng B/P; <chuỗi cầu> có thể có khoảng trắng.";
                    return false;
                }

                var lhsRaw = m.Groups[1].Value;
                var lhsBuf = new System.Text.StringBuilder(lhsRaw.Length);
                foreach (char ch in lhsRaw)
                {
                    if (char.IsWhiteSpace(ch)) continue;
                    char u = char.ToUpperInvariant(ch);
                    if (u == 'B' || u == 'P') lhsBuf.Append(u);
                    else { err = $"Quy tắc {idx}: <mẫu_quá_khứ> chỉ gồm B/P (cho phép khoảng trắng giữa các ký tự)."; return false; }
                }
                var lhs = lhsBuf.ToString();
                if (lhs.Length < 1 || lhs.Length > 10)
                {
                    err = $"Quy tắc {idx}: độ dài <mẫu_quá_khứ> phải từ 1-10 ký tự (B/P).";
                    return false;
                }

                var rhsRaw = m.Groups[2].Value;
                var rhsBuf = new System.Text.StringBuilder(rhsRaw.Length);
                foreach (char ch in rhsRaw)
                {
                    if (char.IsWhiteSpace(ch)) continue;
                    char u = char.ToUpperInvariant(ch);
                    if (u == 'B' || u == 'P') rhsBuf.Append(u);
                    else { err = $"Quy tắc {idx}: <chuỗi cầu> chỉ gồm B/P (có thể nhiều ký tự), cho phép khoảng trắng."; return false; }
                }
                if (rhsBuf.Length < 1)
                {
                    err = $"Quy tắc {idx}: <chuỗi cầu> tối thiểu 1 ký tự B/P.";
                    return false;
                }
            }

            return true;
        }

        // --- Thế cầu I/N: từng dòng "<mẫu> -> <chuỗi>", mẫu gồm I/N, chuỗi là I hoặc N ---
        private static bool ValidatePatternsNI(string s, out string err)
        {
            err = "";
            if (string.IsNullOrWhiteSpace(s))
            {
                err = "Vui lòng nhập các thế cầu I/N.";
                return false;
            }

            // Tách nhiều quy tắc: ',', ';', '|', hoặc xuống dòng
            var rules = System.Text.RegularExpressions.Regex.Split(s.Replace("\r", ""), @"[,\;\|\n]+");
            int idx = 0;

            foreach (var raw in rules)
            {
                var line = raw.Trim();
                if (line.Length == 0) continue;
                idx++;

                // <mẫu> (I/N, cho phép khoảng trắng) -> hoặc - <chuỗi cầu> (I/N, cho phép khoảng trắng)
                var m = System.Text.RegularExpressions.Regex.Match(
                    line,
                    @"^\s*([INin\s]+)\s*(?:->|-)\s*([INin\s]+)\s*$",
                    System.Text.RegularExpressions.RegexOptions.IgnoreCase);

                if (!m.Success)
                {
                    err = $"Quy tắc {idx} không hợp lệ: '{line}'. Dạng đúng: <mẫu> -> <chuỗi cầu> hoặc <mẫu>-<chuỗi cầu>; chỉ dùng I/N; <chuỗi cầu> có thể có khoảng trắng.";
                    return false;
                }

                // LHS: chỉ I/N + khoảng trắng; độ dài 1-10 sau khi bỏ khoảng trắng
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
                    err = $"Quy tắc {idx}: độ dài <mẫu_quá_khứ> phải từ 1-10 ký tự (I/N).";
                    return false;
                }

                // RHS: chuỗi cầu I/N (>=1), cho phép khoảng trắng
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
            if (idx == 0) // 1. Chuỗi B/P
            {
                if (!ValidateSeqCL(T(TxtChuoiCau), out var err))
                {
                    SetError(LblSeqError, err);
                    BringBelow(TxtChuoiCau);
                    return false;
                }
            }
            else if (idx == 2) // 3. Chuỗi I/N
            {
                if (!ValidateSeqNI(T(TxtChuoiCau), out var err))
                {
                    SetError(LblSeqError, err);
                    BringBelow(TxtChuoiCau);
                    return false;
                }
            }
            else if (idx == 1) // 2. Thế B/P
            {
                if (!ValidatePatternsCL(T(TxtTheCau), out var err))
                {
                    SetError(LblPatError, err);
                    BringBelow(TxtTheCau);
                    return false;
                }
            }
            else if (idx == 3) // 4. Thế I/N
            {
                if (!ValidatePatternsNI(T(TxtTheCau), out var err))
                {
                    SetError(LblPatError, err);
                    BringBelow(TxtTheCau);
                    return false;
                }
            }

            // Các chiến lược còn lại không cần kiểm tra thêm
            return true;
        }

        private void SyncStrategyFieldsToUI()
        {
            int idx = CmbBetStrategy?.SelectedIndex ?? 4;
            if (idx == 0) { if (TxtChuoiCau != null) TxtChuoiCau.Text = _cfg.BetSeqBP ?? ""; }
            else if (idx == 2) { if (TxtChuoiCau != null) TxtChuoiCau.Text = _cfg.BetSeqNI ?? ""; }

            if (idx == 1) { if (TxtTheCau != null) TxtTheCau.Text = _cfg.BetPatternsBP ?? ""; }
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
            if (!_uiReady || _tabSwitching) return;

            var idx = CmbBetStrategy?.SelectedIndex ?? -1;       // 0: B/P, 2: N/I
            var txt = (TxtChuoiCau?.Text ?? "").Trim();

            // Lưu tách bạch cho từng chiến lược
            if (idx == 0) _cfg.BetSeqBP = txt;    // Chiến lược 1: Chuỗi B/P
            if (idx == 2) _cfg.BetSeqNI = txt;    // Chiến lược 3: Chuỗi N/I

            // Bản "chung" để engine đọc khi chạy
            _cfg.BetSeq = txt;

            await SaveConfigAsync();              // ghi config.json
            ShowErrorsForCurrentStrategy();       // nếu có hiển thị lỗi dưới ô
        }


        private async void TxtTheCau_TextChanged(object sender, TextChangedEventArgs e)
        {
            if (!_uiReady || _tabSwitching) return;

            var idx = CmbBetStrategy?.SelectedIndex ?? -1;       // 1: B/P, 3: N/I
            var txt = (TxtTheCau?.Text ?? "").Trim();

            // Lưu tách bạch cho từng chiến lược
            if (idx == 1) _cfg.BetPatternsBP = txt;  // Chiến lược 2: Thế B/P
            if (idx == 3) _cfg.BetPatternsNI = txt;  // Chiến lược 4: Thế N/I

            // Bản "chung" để engine đọc khi chạy
            _cfg.BetPatterns = txt;

            await SaveConfigAsync();                // ghi config.json
            ShowErrorsForCurrentStrategy();         // nếu có
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

            SetError(LblSideRatioError, null);
        }

















    }

}












