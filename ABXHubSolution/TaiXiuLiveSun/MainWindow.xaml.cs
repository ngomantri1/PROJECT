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
using TaiXiuLiveSun;
using TaiXiuLiveSun.Tasks;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Globalization;
using System.Windows.Documents;
using System.Reflection;
using System.Diagnostics;
using System.IO.Compression;
using Microsoft.Web.WebView2.Wpf;  // <-- cÃ¡i nÃ y Ä‘á»ƒ cÃ³ CoreWebView2Creation
using System.Net.Http;
using System.Net.Http.Json;
using System.ComponentModel;
using System.Linq;
using System.Collections.ObjectModel;
using System.Collections.Specialized;
using System.Windows.Data;
using static TaiXiuLiveSun.MainWindow;
using System.Windows.Input;
using Microsoft.Win32;
using System.Net.NetworkInformation;




namespace TaiXiuLiveSun
{
    // Fallback loader: náº¿u SharedIcons chÆ°a cÃ³, náº¡p tá»« Assets (pack URI).
    // Fallback loader: náº¿u SharedIcons chÆ°a cÃ³, náº¡p tá»« Resources (pack URI).
    internal static class FallbackIcons
    {
        private const string SideChanPng = "Assets/side/CHAN.png";
        private const string SideLePng = "Assets/side/LE.png";
        private const string ResultChanPng = "Assets/side/CHAN.png";
        private const string ResultLePng = "Assets/side/LE.png";
        private const string WinPng = "Assets/kq/THANG.png";
        private const string LossPng = "Assets/kq/THUA.png";
        private const string TuTrangPng = "Assets/side/TU_TRANG.png";
        private const string TuDoPng = "Assets/side/TU_DO.png";
        private const string SapDoiPng = "Assets/side/SAP_DOI.png";
        private const string Trang3Do1Png = "Assets/side/1DO_3TRANG.png";
        private const string Do3Trang1Png = "Assets/side/1TRANG_3DO.png";

        private static ImageSource? _sideChan, _sideLe, _resultChan, _resultLe, _win, _loss;
        private static ImageSource? _tuTrang, _tuDo, _sapDoi, _trang3Do1, _do3Trang1;

        public static ImageSource? GetSideChan() => SharedIcons.SideChan ?? (_sideChan ??= Load(SideChanPng));
        public static ImageSource? GetSideLe() => SharedIcons.SideLe ?? (_sideLe ??= Load(SideLePng));
        public static ImageSource? GetResultChan() => SharedIcons.ResultChan ?? (_resultChan ??= Load(ResultChanPng));
        public static ImageSource? GetResultLe() => SharedIcons.ResultLe ?? (_resultLe ??= Load(ResultLePng));
        public static ImageSource? GetWin() => SharedIcons.Win ?? (_win ??= Load(WinPng));
        public static ImageSource? GetLoss() => SharedIcons.Loss ?? (_loss ??= Load(LossPng));
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
                    // thá»­ uri tiáº¿p theo
                }
            }

            // Fallback Ä‘á»c file váº­t lÃ½ cáº¡nh DLL khi pack URI khÃ´ng resolve (plugin)
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
            // Quan trá»ng: tráº£ null náº¿u táº¥t cáº£ URI tháº¥t báº¡i Ä‘á»ƒ DataTemplate fallback sang text.
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
        public object Convert(object value, Type t, object p, CultureInfo c)
        {
            var u = TextNorm.U(value?.ToString() ?? "");
            var compact = u.Replace(" ", "").Replace("_", "").Replace("-", "");
            if (u == "CHAN" || u == "C") return FallbackIcons.GetSideChan();
            if (u == "LE" || u == "L") return FallbackIcons.GetSideLe();
            if (u == "TU_TRANG") return FallbackIcons.GetTuTrang();
            if (u == "TU_DO") return FallbackIcons.GetTuDo();
            if (u == "SAP_DOI" || u == "SAPDOI" || compact == "SAPDOI" || u == "2D2T") return FallbackIcons.GetSapDoi();
            if (u == "TRANG3_DO1" || compact == "TRANG3DO1" || compact == "1DO3TRANG") return FallbackIcons.GetTrang3Do1();
            if (u == "DO3_TRANG1" || compact == "DO3TRANG1" || compact == "1TRANG3DO") return FallbackIcons.GetDo3Trang1();
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

            // Æ¯u tiÃªn áº£nh Ä‘Ã£ merge vÃ o App.Resources (PackRes Ä‘Ã£ lÃ m)
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
            return img; // cÃ³ thá»ƒ null -> XAML sáº½ hiá»ƒn thá»‹ chá»¯ thay tháº¿
        }

        public object Convert(object value, Type t, object p, CultureInfo c)
        {
            var u = TextNorm.U(value?.ToString() ?? "");
            var compact = u.Replace(" ", "").Replace("_", "").Replace("-", "");
            if (u == "CHAN" || u == "C") return FallbackIcons.GetResultChan();
            if (u == "LE" || u == "L") return FallbackIcons.GetResultLe();
            if (u == "TU_TRANG") return FallbackIcons.GetTuTrang();
            if (u == "TU_DO") return FallbackIcons.GetTuDo();
            if (u == "SAP_DOI" || u == "SAPDOI" || compact == "SAPDOI" || u == "2D2T") return FallbackIcons.GetSapDoi();
            if (u == "TRANG3_DO1" || compact == "TRANG3DO1" || compact == "1DO3TRANG") return FallbackIcons.GetTrang3Do1();
            if (u == "DO3_TRANG1" || compact == "DO3TRANG1" || compact == "1TRANG3DO") return FallbackIcons.GetDo3Trang1();

            char digit = '\0';
            if (u.Length == 1 && char.IsDigit(u[0])) digit = u[0];
            else if (u.StartsWith("BALL", StringComparison.OrdinalIgnoreCase) && u.Length >= 5)
            {
                var cBall = u[4];
                if (cBall == 'C') return FallbackIcons.GetSideChan();
                if (cBall == 'L') return FallbackIcons.GetSideLe();
                if (char.IsDigit(cBall)) digit = cBall;
            }

            if (digit >= '0' && digit <= '4')
            {
                return LoadBall(digit);
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


        private const string AppLocalDirName = "TaiXiuLiveSun"; // Ä‘á»•i thÃ nh tÃªn báº¡n muá»‘n
        // ====== App paths ======
        private readonly string _appDataDir;
        private readonly string _cfgPath;
        private readonly string _statsPath;
        private readonly string _logDir;

        // ====== State ======
        // ---- Auto-login state ----
        private bool _autoLoginBusy = false;
        private DateTime _autoLoginLast = DateTime.MinValue;

        private bool _uiReady = false;
        private bool _didStartupNav = false;
        private bool _webHooked = false;
        private CancellationTokenSource? _navCts, _userCts, _passCts, _stakeCts, _sideRateCts;

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
        private CancellationTokenSource _taskCts;
        private IBetTask _activeTask;
        private const int NiSeqMax = 50;
        private readonly System.Text.StringBuilder _niSeq = new(NiSeqMax);

        // Tá»•ng C/L cá»§a vÃ¡n Ä‘ang diá»…n ra (Ä‘á»ƒ dÃ¹ng khi vÃ¡n vá»«a khÃ©p láº¡i)
        private long _roundTotalsC = 0;
        private long _roundTotalsL = 0;
        private int _lastSeqLenNi = 0;
        private bool _lockMajorMinorUpdates = false;
        private string _baseSeq = "";

        private DecisionState _dec = new();
        private long[] _stakeSeq = Array.Empty<long>();
        private System.Collections.Generic.List<long[]> _stakeChains = new();
        private long[] _stakeChainTotals = Array.Empty<long>();
        // Chá»‰ dÃ¹ng cho hiá»ƒn thá»‹ LblLevel: vá»‹ trÃ­ hiá»‡n táº¡i trong _stakeSeq
        private int _stakeLevelIndexForUi = -1;

        private double _decisionPercent = 5; // 5s

        // Chá»‘ng báº¯n trÃ¹ng khi vá»«a cÆ°á»£c
        private bool _cooldown = false;

        // Cache & cá» Ä‘á»ƒ khÃ´ng inject láº·p láº¡i
        private string? _appJs;
        private string? _homeJs;  // ná»™i dung js_home_v2.js
        private bool _webMsgHooked; // Ä‘á»ƒ gáº¯n WebMessageReceived Ä‘Ãºng 1 láº§n




        private string? _topForwardId, _appJsRegId;           // id script TOP_FORWARD
                                                              // ID riÃªng cho autostart cá»§a trang Home (Ä‘á»«ng dÃ¹ng chung vá»›i _homeJsRegId)
        private string? _homeAutoStartId;
        private string? _homeJsRegId;
        private bool _frameHooked;               // Ä‘Ã£ gáº¯n FrameCreated?
        private string? _lastDocKey;             // key document hiá»‡n táº¡i (performance.timeOrigin)
                                                 // Bridge Ä‘Äƒng kÃ½ toÃ n cá»¥c
        private string? _autoStartId;        // id script FRAME_AUTOSTART (Ä‘Äƒng kÃ½ toÃ n cá»¥c)
        private bool _domHooked;             // Ä‘Ã£ gáº¯n DOMContentLoaded cho top chÆ°a

        // === License/Trial run state ===

        private System.Threading.Timer? _expireTimer;      // timer tick má»—i giÃ¢y Ä‘á»ƒ cáº­p nháº­t Ä‘áº¿m ngÆ°á»£c
        private DateTimeOffset? _runExpiresAt;             // má»‘c háº¿t háº¡n cá»§a phiÃªn Ä‘ang cháº¡y (trial hoáº·c license)
        private string _expireMode = "";                   // "trial" | "license"
        private string _leaseClientId = "";
        private string _deviceId = "";
        private string _trialKey = "";
        private string _trialDayStamp = "";

        private string _leaseSessionId = "";
        private string _licenseUser = "";
        private string _licensePass = "";
        public string TrialUntil { get; set; } = "";
        // === License periodic re-check (5 phÃºt/láº§n) ===
        private System.Threading.Timer? _licenseCheckTimer;
        private int _licenseCheckBusy = 0; // guard chá»‘ng chá»“ng lá»‡nh
        private bool _licenseVerified = false;
        // === Username láº¥y tá»« Home (authoritative) ===
        private string? _homeUsername;                 // username chuáº©n láº¥y tá»« home_tick
        private DateTime _homeUsernameAt = DateTime.MinValue; // má»‘c thá»i gian báº¯t Ä‘Æ°á»£c
        private bool _homeLoggedIn = false; // chá»‰ true khi phÃ¡t hiá»‡n cÃ³ nÃºt ÄÄƒng xuáº¥t (Ä‘Ã£ login)
        private bool _navModeHooked = false;   // Ä‘Ã£ gáº¯n handler NavigationCompleted Ä‘á»ƒ cáº­p nháº­t UI nhanh vá» Home?


        private int _playStartInProgress = 0;// NgÄƒn PlayXocDia_Click cháº¡y song song

        private readonly SemaphoreSlim _cfgWriteGate = new(1, 1);// KhoÃ¡ ghi config Ä‘á»ƒ khÃ´ng bao giá» ghi song song
        private readonly SemaphoreSlim _statsWriteGate = new(1, 1);
                                                                 // --- UI mode monitor ---
        private DateTime _lastGameTickUtc = DateTime.MinValue;
        private DateTime _lastHomeTickUtc = DateTime.MinValue;
        private bool _isGameUi = false;              // tráº¡ng thÃ¡i UI hiá»‡n hÃ nh
        private System.Windows.Threading.DispatcherTimer? _uiModeTimer;
        private int _gameNavWatchdogGen = 0;         // phÃ¢n tháº¿ há»‡ cho watchdog navigation
        private bool _wv2Resetting = false;
        private DateTime _lastWv2ResetUtc = DateTime.MinValue;
        private string? _lastGameUrl = null;

        private static readonly TimeSpan GameTickFresh = TimeSpan.FromSeconds(3);
        private static readonly TimeSpan HomeTickFresh = TimeSpan.FromSeconds(1.5);
        // Master switch: Ä‘áº·t false Ä‘á»ƒ bá» qua kiá»ƒm tra Trial/License (khÃ´ng UI, khÃ´ng config, true kiá»ƒm tra bÃ¬nh thÆ°á»ng)
        private bool CheckLicense = true;

        // 2) Bá»™ nhá»› vÃ  phÃ¢n trang
        private readonly List<BetRow> _betAll = new();                  // táº¥t cáº£ báº£n ghi (tá»‘i Ä‘a 1000 khi load)
        private readonly ObservableCollection<BetRow> _betPage = new(); // trang hiá»‡n táº¡i
        private int _pageIndex = 0;
        private int PageSize = 10;// Cho phÃ©p Ä‘á»•i PageSize tá»« UI
        private bool _autoFollowNewest = true;// true = Ä‘ang bÃ¡m trang má»›i nháº¥t (trang 1); false = Ä‘ang xem trang cÅ©, KHÃ”NG auto nháº£y

        // 3) Giá»¯ pending bet Ä‘á»ƒ chá» káº¿t quáº£
        private readonly List<BetRow> _pendingRows = new();
        private const int MaxHistory = 1000;   // tá»•ng sá»‘ báº£n ghi giá»¯ trong bá»™ nhá»› & khi load



        private const string DEFAULT_URL = "https://web.sunwin.ec/?affId=Sunwin"; // URL máº·c Ä‘á»‹nh báº¡n muá»‘n
        // === License repo/worker settings (CHá»ˆNH Láº I CHO PHÃ™ Há»¢P) ===
        const string LicenseOwner = "ngomantri1";    // <- Ä‘á»•i theo repo cá»§a báº¡n
        const string LicenseRepo = "licenses";  // <- Ä‘á»•i theo repo cá»§a báº¡n
        const string LicenseBranch = "main";          // <- nhÃ¡nh
        const string LicenseNameGame = "auto";          // <- nhÃ¡nh
        const string LeaseBaseUrl = "https://net88.ngomantri1.workers.dev/lease/auto";
        private const bool EnableLeaseCloudflare = true; // true=báº­t gá»i Cloudflare
        private const string TrialConsumedTodayMessage = "Háº¿t lÆ°á»£t dÃ¹ng thá»­ trong ngÃ y. HÃ£y quay láº¡i dÃ¹ng thá»­ vÃ o ngÃ y mai.";

        // ===================== TOOLTIP TEXTS =====================
        const string TIP_SEQ_CL =
        @"Chuá»—i Cáº¦U (C/L) â€” Chiáº¿n lÆ°á»£c 1
â€¢ Ã nghÄ©a: C = CHáº´N, L = Láºº (khÃ´ng phÃ¢n biá»‡t hoa/thÆ°á»ng).
â€¢ CÃº phÃ¡p: chá»‰ gá»“m kÃ½ tá»± C hoáº·c L; kÃ½ tá»± khÃ¡c khÃ´ng há»£p lá»‡.
â€¢ Khoáº£ng tráº¯ng/tab/xuá»‘ng dÃ²ng: Ä‘Æ°á»£c phÃ©p; há»‡ thá»‘ng tá»± bá» qua.
â€¢ Thá»© tá»± Ä‘á»c: tá»« trÃ¡i sang pháº£i; háº¿t chuá»—i sáº½ láº·p láº¡i tá»« Ä‘áº§u.
â€¢ Äá»™ dÃ i khuyáº¿n nghá»‹: 2â€“50 kÃ½ tá»±.
VÃ­ dá»¥ há»£p lá»‡:
  - CLLC
  - C L L C
VÃ­ dá»¥ khÃ´ng há»£p lá»‡:
  - C,X,L     (cÃ³ dáº¥u pháº©y)
  - CL1C      (cÃ³ sá»‘)
  - C L _ C   (kÃ½ tá»± ngoÃ i C/L).";

        const string TIP_SEQ_NI =
        @"Chuá»—i Cáº¦U (Ãt/Nhiá»u) â€” Chiáº¿n lÆ°á»£c 3
â€¢ Ã nghÄ©a: I = bÃªn ÃT tiá»n, N = bÃªn NHIá»€U tiá»n (khÃ´ng phÃ¢n biá»‡t hoa/thÆ°á»ng).
â€¢ CÃº phÃ¡p: chá»‰ gá»“m kÃ½ tá»± I hoáº·c N; má»i kÃ½ tá»± khÃ¡c Ä‘á»u khÃ´ng há»£p lá»‡.
â€¢ Dáº¥u phÃ¢n tÃ¡ch: khoáº£ng tráº¯ng/tab/xuá»‘ng dÃ²ng Ä‘Æ°á»£c phÃ©p vÃ  sáº½ bá»‹ bá» qua.
â€¢ Thá»© tá»± Ä‘á»c: tá»« trÃ¡i sang pháº£i; háº¿t chuá»—i sáº½ láº·p láº¡i tá»« Ä‘áº§u.
â€¢ Äá»™ dÃ i khuyáº¿n nghá»‹: 2â€“50 kÃ½ tá»±.
VÃ­ dá»¥ há»£p lá»‡:
  - INNI
  - I N N I
VÃ­ dá»¥ khÃ´ng há»£p lá»‡:
  - I,K,N     (cÃ³ dáº¥u pháº©y)
  - IN1I      (cÃ³ sá»‘)
  - I _ N I   (kÃ½ tá»± ngoÃ i I/N).";

        const string TIP_THE_CL =
        @"Tháº¿ Cáº¦U (C/L) â€” Chiáº¿n lÆ°á»£c 2
â€¢ Ã nghÄ©a: C = CHáº´N, L = Láºº (khÃ´ng phÃ¢n biá»‡t hoa/thÆ°á»ng).
â€¢ Má»™t quy táº¯c (má»—i dÃ²ng): <máº«u_quÃ¡_khá»©> -> <cá»­a_káº¿_tiáº¿p>  (hoáº·c dÃ¹ng dáº¥u - thay cho ->).
â€¢ PhÃ¢n tÃ¡ch nhiá»u quy táº¯c: báº±ng dáº¥u ',', ';', '|', hoáº·c xuá»‘ng dÃ²ng.
â€¢ Khoáº£ng tráº¯ng: Ä‘Æ°á»£c phÃ©p quanh kÃ½ hiá»‡u vÃ  giá»¯a cÃ¡c quy táº¯c; 
  Cho phÃ©p khoáº£ng tráº¯ng BÃŠN TRONG <cá»­a_káº¿_tiáº¿p>.
â€¢ So khá»›p: xÃ©t K káº¿t quáº£ gáº§n nháº¥t vá»›i K = Ä‘á»™ dÃ i <máº«u_quÃ¡_khá»©>; náº¿u khá»›p thÃ¬ Ä‘áº·t theo <cá»­a_káº¿_tiáº¿p>.
â€¢ <cá»­a_káº¿_tiáº¿p>: cÃ³ thá»ƒ lÃ  1 kÃ½ tá»± (C/L) hoáº·c má»™t chuá»—i C/L (vÃ­ dá»¥: CLL).
â€¢ Äá»™ dÃ i khuyáº¿n nghá»‹ cho <máº«u_quÃ¡_khá»©>: 1â€“10 kÃ½ tá»±.
VÃ­ dá»¥ há»£p lá»‡:
  CCL -> C
  LLL -> L C
  CL  -> CLL
VÃ­ dá»¥ khÃ´ng há»£p lá»‡:
  C, X, L -> C
  CL -> C L
  CL -> C1";


        const string TIP_THE_NI =
        @"Tháº¿ Cáº¦U (Ãt/Nhiá»u) â€” Chiáº¿n lÆ°á»£c 4
â€¢ Ã nghÄ©a: I = bÃªn ÃT tiá»n, N = bÃªn NHIá»€U tiá»n (khÃ´ng phÃ¢n biá»‡t hoa/thÆ°á»ng).
â€¢ Má»™t quy táº¯c (má»—i dÃ²ng): <máº«u_quÃ¡_khá»©> -> <cá»­a_káº¿_tiáº¿p>  (hoáº·c dÃ¹ng dáº¥u - thay cho ->).
â€¢ PhÃ¢n tÃ¡ch nhiá»u quy táº¯c: báº±ng dáº¥u ',', ';', '|', hoáº·c xuá»‘ng dÃ²ng.
â€¢ Khoáº£ng tráº¯ng: Ä‘Æ°á»£c phÃ©p quanh kÃ½ hiá»‡u vÃ  giá»¯a cÃ¡c quy táº¯c; 
  Cho phÃ©p khoáº£ng tráº¯ng BÃŠN TRONG <cá»­a_káº¿_tiáº¿p>.
â€¢ So khá»›p: xÃ©t K káº¿t quáº£ gáº§n nháº¥t vá»›i K = Ä‘á»™ dÃ i <máº«u_quÃ¡_khá»©>; náº¿u khá»›p thÃ¬ Ä‘áº·t theo <cá»­a_káº¿_tiáº¿p>.
â€¢ <cá»­a_káº¿_tiáº¿p>: cÃ³ thá»ƒ lÃ  1 kÃ½ tá»± (I/N) hoáº·c má»™t chuá»—i I/N (vÃ­ dá»¥: INNN).
â€¢ Äá»™ dÃ i khuyáº¿n nghá»‹ cho <máº«u_quÃ¡_khá»©>: 1â€“10 kÃ½ tá»±.
VÃ­ dá»¥ há»£p lá»‡:
  INN -> I
  NNN -> N I
  IN  -> INNN
VÃ­ dá»¥ khÃ´ng há»£p lá»‡:
  I, K, N -> I
  IN -> I  N
  IN -> I1";


        const string TIP_STAKE_CSV =
         @"Chuá»—i TIá»€N (StakeCsv)
â€¢ CÃ³ thá»ƒ nháº­p 1 chuá»—i hoáº·c NHIá»€U chuá»—i tiá»n.
â€¢ Náº¿u nháº­p NHIá»€U chuá»—i: Má»–I CHUá»–I 1 DÃ’NG. VÃ­ dá»¥:
  1000-2000-4000-8000
  2000-4000-8000-16000
  4000-8000-16000-32000
â€¢ Náº¿u chá»‰ nháº­p 1 chuá»—i thÃ¬ dÃ¹ng nhÆ° cÅ©: 1000,1000,2000,3000,5000
â€¢ PhÃ¢n tÃ¡ch cháº¥p nháº­n: dáº¥u pháº©y ',', dáº¥u gáº¡ch '-', dáº¥u cháº¥m pháº©y ';' hoáº·c khoáº£ng tráº¯ng.
â€¢ ÄÆ¡n vá»‹: VNÄ (sá»‘ nguyÃªn). Cho phÃ©p trÃ¹ng giÃ¡ trá»‹.
â€¢ Háº¿t chuá»—i sáº½ quay láº¡i Ä‘áº§u (náº¿u chiáº¿n lÆ°á»£c dÃ¹ng láº·p).
â€¢ DÃ¹ng cho quáº£n lÃ½ vá»‘n ""5. Äa táº§ng chuá»—i tiá»n"": thua háº¿t 1 dÃ²ng â†’ sang dÃ²ng káº¿; chuá»—i sau tháº¯ng Ä‘á»§ tá»•ng chuá»—i trÆ°á»›c â†’ quay vá» chuá»—i trÆ°á»›c.
â€¢ VÃ­ dá»¥ há»£p lá»‡:
  1000,1000,2000,3000,5000
  1000-1000-2000-3000-5000
  1000 1000 2000 3000 5000
  1000-2000-4000-8000
  2000-4000-8000-16000
â€¢ VÃ­ dá»¥ sai: 1k, 2k, 3k (khÃ´ng dÃ¹ng chá»¯ k).";


        const string TIP_CUT_PROFIT =
        @"Cáº®T LÃƒI
â€¢ Nháº­p sá»‘ tiá»n (>= 0). Khi tá»•ng lÃ£i tÃ­ch lÅ©y â‰¥ giÃ¡ trá»‹ nÃ y â†’ tá»± Ä‘á»™ng dá»«ng Ä‘áº·t cÆ°á»£c.
â€¢ Äá»ƒ trá»‘ng hoáº·c 0 = khÃ´ng dÃ¹ng cáº¯t lÃ£i.
â€¢ VÃ­ dá»¥: 200000 (khi lÃ£i â‰¥ 200.000Ä‘ thÃ¬ dá»«ng).";

        const string TIP_CUT_LOSS =
        @"Cáº®T Lá»–
â€¢ Nháº­p sá»‘ tiá»n (>= 0). Khi tá»•ng lÃ£i tÃ­ch lÅ©y â‰¤ -giÃ¡ trá»‹ nÃ y â†’ tá»± Ä‘á»™ng dá»«ng Ä‘áº·t cÆ°á»£c.
â€¢ Äá»ƒ trá»‘ng hoáº·c 0 = khÃ´ng dÃ¹ng cáº¯t lá»—.
â€¢ VÃ­ dá»¥: 150000 (khi lá»— â‰¥ 150.000Ä‘ thÃ¬ dá»«ng).";

        const string TIP_DECISION_PERCENT_GENERAL =
        @"Äáº¶T KHI CÃ’N % THá»œI GIAN
â€¢ Nháº­p pháº§n trÄƒm (0â€“100). Há»‡ thá»‘ng quy vá» 0.00â€“1.00 ná»™i bá»™.
â€¢ Ã nghÄ©a: chá»‰ Ä‘áº·t cÆ°á»£c khi thanh thá»i gian cÃ²n láº¡i â‰¤ giÃ¡ trá»‹ % nÃ y.
â€¢ VÃ­ dá»¥: 25 = Ä‘áº·t khi cÃ²n ~25% thá»i gian phiÃªn.";

        const string TIP_DECISION_PERCENT_NI =
        @"Äáº¶T KHI CÃ’N % THá»œI GIAN (khuyáº¿n nghá»‹ cho chiáº¿n lÆ°á»£c Ãt/Nhiá»u)
â€¢ Nháº­p pháº§n trÄƒm (0â€“100), KHÃ”NG pháº£i giÃ¢y.
â€¢ NÃªn Ä‘á»ƒ khoáº£ng 15% Ä‘á»ƒ bÃ¡m sÃ¡t dÃ²ng tiá»n hai cá»­a.
â€¢ VÃ­ dá»¥: 15 = Ä‘áº·t khi cÃ²n ~15% thá»i gian phiÃªn.";

        const string TIP_SIDE_RATIO =
        @"Cá»¬A Äáº¶T & Tá»ˆ Lá»† (Chiáº¿n lÆ°á»£c 17)
- Nháº­p má»—i dÃ²ng: <cá»­a>:<tá»‰ lá»‡>, khÃ´ng Ä‘Æ°á»£c Ä‘á»ƒ trá»‘ng.
- Cá»­a há»£p lá»‡: 4DO, 4TRANG, 1TRANG3DO, 1DO3TRANG, 2DO2TRANG, CHAN, LE (cháº¥p nháº­n viáº¿t táº¯t 1T3D/1D3T/SAPDOI/4R/4W giá»‘ng normalizeSide).
- KhÃ´ng dÃ¹ng kÃ½ tá»± ';' hoáº·c dáº¥u cÃ¡ch trong tÃªn cá»­a; chá»‰ cho phÃ©p khoáº£ng tráº¯ng quanh dáº¥u ':'.
- DÃ£y máº·c Ä‘á»‹nh Ä‘áº§y Ä‘á»§:
  4DO:1
  4TRANG:1
  1TRANG3DO:3
  1DO3TRANG:3
  2DO2TRANG:5
  CHAN:6
  LE:6
- CÃ³ thá»ƒ nháº­p má»™t pháº§n danh sÃ¡ch (vÃ­ dá»¥ chá»‰ 4DO/4TRANG hoáº·c SAPDOI/CHAN/LE).";
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
            public int BetStrategyIndex { get; set; } = 4; // máº·c Ä‘á»‹nh "5. Theo cáº§u trÆ°á»›c thÃ´ng minh"
            public string BetSeq { get; set; } = "";       // giÃ¡ trá»‹ Ã´ "CHUá»–I Cáº¦U"
            public string BetPatterns { get; set; } = "";  // giÃ¡ trá»‹ Ã´ "CÃC THáº¾ Cáº¦U"
            public string MoneyStrategy { get; set; } = "IncreaseWhenLose";//IncreaseWhenLose
            public bool S7ResetOnProfit { get; set; } = true;
            public double CutProfit { get; set; } = 0; // 0 = táº¯t cáº¯t lÃ£i
            public double CutLoss { get; set; } = 0; // 0 = táº¯t cáº¯t lá»—
            public string BetSeqCL { get; set; } = "";        // cho Chiáº¿n lÆ°á»£c 1
            public string BetSeqNI { get; set; } = "";        // cho Chiáº¿n lÆ°á»£c 3
            public string BetPatternsCL { get; set; } = "";   // cho Chiáº¿n lÆ°á»£c 2
            public string BetPatternsNI { get; set; } = "";   // cho Chiáº¿n lÆ°á»£c 4
            public string SideRateText { get; set; } = TaiXiuLiveSun.Tasks.SideRateParser.DefaultText;

            // LÆ°u chuá»—i tiá»n theo tá»«ng MoneyStrategy
            public Dictionary<string, string> StakeCsvByMoney { get; set; } = new();

            /// <summary>ÄÆ°á»ng dáº«n file lÆ°u tráº¡ng thÃ¡i AI n-gram (JSON). Bá» trá»‘ng => dÃ¹ng máº·c Ä‘á»‹nh %LOCALAPPDATA%\Automino\ai\ngram_state_v1.json</summary>
            public string AiNGramStatePath { get; set; } = "";




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
            public long? LastStakeAmount { get; set; }
            public string LastLevelText { get; set; } = "";
            public long[] RunStakeSeq { get; set; } = Array.Empty<long>();
            public List<long[]> RunStakeChains { get; set; } = new();
            public long[] RunStakeChainTotals { get; set; } = Array.Empty<long>();
            public double RunDecisionPercent { get; set; } = 0;
            public bool CutStopTriggered { get; set; } = false;

            public CancellationTokenSource? TaskCts { get; set; }
            public Task? RunningTask { get; set; }
            public TaiXiuLiveSun.Tasks.IBetTask? ActiveTask { get; set; }
            public DecisionState DecisionState { get; set; } = new DecisionState();
            public bool Cooldown { get; set; } = false;
            public TabStats Stats { get; set; } = new TabStats();

            public event PropertyChangedEventHandler? PropertyChanged;
            private void OnPropertyChanged(string name) => PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
        }

        // 1) Model 1 dÃ²ng log Ä‘áº·t cÆ°á»£c
        private sealed class BetRow
        {
            public DateTime At { get; set; }                 // Thá»i gian Ä‘áº·t
            public string Game { get; set; } = "XÃ³c Ä‘Ä©a live";
            public long Stake { get; set; }                  // Tiá»n cÆ°á»£c
            public string Side { get; set; } = "";           // CHAN/LE
            public string Result { get; set; } = "";         // Káº¿t quáº£ "CHAN"/"LE"
            public string WinLose { get; set; } = "";        // "Tháº¯ng"/"Thua"
            public long Account { get; set; }                // Sá»‘ dÆ° sau vÃ¡n
        }

        public static class SharedIcons
        {
            public static ImageSource? SideChan, SideLe;        // áº£nh â€œCá»­a Ä‘áº·tâ€ CHáº´N/Láºº
            public static ImageSource? ResultChan, ResultLe;    // áº£nh â€œKáº¿t quáº£â€ CHáº´N/Láºº
            public static ImageSource? Win, Loss;               // áº£nh â€œTháº¯ng/Thuaâ€
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

        // ====== LOGGING (má»›i: batch, khÃ´ng Ä‘Æ¡ UI) ======
        // UI
        private readonly ConcurrentQueue<string> _uiLogQueue = new();
        private readonly LinkedList<string> _uiLines = new(); // buffer giá»¯ tá»‘i Ä‘a N dÃ²ng
        private const int UI_MAX_LINES = 1000;
        private const int UI_FLUSH_MS = 300;

        // File
        private readonly ConcurrentQueue<string> _fileLogQueue = new();
        private const int FILE_FLUSH_MS = 500;

        // Pump
        private CancellationTokenSource? _logPumpCts;

        // Packet lines -> UI? (máº·c Ä‘á»‹nh: khÃ´ng)
        private const bool SHOW_PACKET_LINES_IN_UI = false;
        private const int PACKET_UI_SAMPLE_EVERY_N = 20; // náº¿u báº­t á»Ÿ trÃªn, má»—i N gÃ³i má»›i Ä‘áº©y 1 dÃ²ng lÃªn UI
        private int _pktUiSample = 0;
        private bool _lockJsRegistered = false;
        // Map áº£nh cho tá»«ng kÃ½ tá»±
        private readonly Dictionary<char, ImageSource> _seqIconMap = new();

        private string _lastSeqTailShown = "";
        // Tá»•ng tiá»n tháº¯ng lÅ©y káº¿ cá»§a phiÃªn hiá»‡n táº¡i
        private double _winTotal = 0;
        private CoreWebView2Environment? _webEnv;
        private bool _webInitDone;
        private const string Wv2ZipResNameX64 = "TaiXiuLiveSun.ThirdParty.WebView2Fixed_win-x64.zip";
        // ThÆ° má»¥c cache bá»n vá»¯ng cho runtime (khÃ´ng bá»‹ dá»n nhÆ° %TEMP%)
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
    // Má»šI: 1-shot bÃ¡o hiá»‡u Ä‘Ã£ á»Ÿ trang game/Ä‘ang cÃ³ iframe game
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
    // â¬‡ï¸ Má»šI: phÃ¡t hiá»‡n xem top-page cÃ³ iframe games.* khÃ´ng
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
        // Náº¿u báº£n thÃ¢n Ä‘ang á»Ÿ games.* => báº¯n hint ngay (khÃ´ng cáº§n home-push)
        if (/^games\./i.test(h)) { sendGameHint(); return; }
        // Náº¿u cÃ²n á»Ÿ Home nhÆ°ng Ä‘Ã£ nhÃºng iframe game => báº¯n hint Ä‘á»ƒ C# chuyá»ƒn UI tá»©c thÃ¬
        if (hasGameFrame()) { sendGameHint(); /* váº«n khÃ´ng start home_push */ }
        // â¬‡ï¸ CHá»ˆ start push khi KHÃ”NG pháº£i games.* VÃ€ cÅ©ng KHÃ”NG cÃ³ iframe games.*
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



        // Guard chá»‘ng re-entrancy (Ä‘áº·t á»Ÿ class level)
        private bool _ensuringWeb = false;

        private bool _frameHookedAlways;

        private WebView2LiveBridge? _bridge;
        private bool _inputEventsHooked;
        // Interval push cá»§a Home (ms)
        private int _homePushMs = 800;
        // Home-flow state flags (per-document)
        private bool _homeAutoLoginDone = false;
        private bool _homeAutoPlayDone = false;
        private CancellationTokenSource? _leaseHbCts;



        // ====== ctor ======
        public MainWindow()
        {
            // 1) Khá»Ÿi táº¡o Ä‘Æ°á»ng dáº«n trÆ°á»›c khi WPF dá»±ng UI (trÃ¡nh event sá»›m)
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

            // 2) Sau Ä‘Ã³ má»›i dá»±ng UI
            InitializeComponent();
            _strategyTabs.CollectionChanged += StrategyTabs_CollectionChanged;
            this.ShowInTaskbar = true;                       // cÃ³ icon riÃªng
            this.WindowStartupLocation = WindowStartupLocation.CenterScreen; // tuá»³, cho Ä‘áº¹p
            this.PreviewKeyDown += MainWindow_PreviewKeyDown; // F12/Ctrl+Shift+I -> DevTools
            // Ä‘áº£m báº£o vá» Home UI lÃºc khá»Ÿi Ä‘á»™ng
            SetModeUi(false);
            BetGrid.ItemsSource = _betPage;
            // gá»i async sau khi cá»­a sá»• Ä‘Ã£ load
            this.Loaded += MainWindow_Loaded;

        }



        // ====== Log helpers (batch) ======
        private void EnqueueUi(string line)
        {
            _uiLogQueue.Enqueue(line);
        }
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

        private void SetModeUi(bool isGame)
        {
            try
            {
                Dispatcher.Invoke(() =>
                {
                    // NÃºt cÅ© (Ä‘Ã£ cÃ³ sáºµn)
                    //if (BtnVaoXocDia != null)
                    //    BtnVaoXocDia.Visibility = isGame ? Visibility.Collapsed : Visibility.Visible;
                    //if (BtnPlay != null)
                    //    BtnPlay.Visibility = isGame ? Visibility.Visible : Visibility.Collapsed;

                    // NhÃ³m má»›i: áº©n/hiá»‡n theo báº£n quyá»n + tráº¡ng thÃ¡i game
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
                });
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
            // _appDataDir báº¡n Ä‘Ã£ táº¡o á»Ÿ Startup: %LOCALAPPDATA%\TaiXiuLiveSun
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
                // games.* => Ä‘ang á»Ÿ trang game
                return host.StartsWith("games.", StringComparison.OrdinalIgnoreCase);
            }
            catch { return _isGameUi; }
        }

        private void RecomputeUiMode()
        {
            // Æ¯u tiÃªn URL: náº¿u KHÃ”NG á»Ÿ games.* thÃ¬ vá» Home ngay Ä‘á»ƒ trÃ¡nh timer lÃ´i vá» GAME
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
            else if (recentGame && recentHome) nextIsGame = true;   // giá»¯ logic cÅ©
            else nextIsGame = GetIsGameByUrlFallback();

            ApplyUiMode(nextIsGame);
        }
        // KhÃ³a/má»Ÿ cáº¥u hÃ¬nh khi Start/Stop:
        // - enabled = true  => Ä‘ang "Báº¯t Äáº§u CÆ°á»£c" (chÆ°a cháº¡y)  => má»Ÿ háº¿t Ä‘á»ƒ sá»­a
        // - enabled = false => Ä‘ang "Dá»«ng Äáº·t CÆ°á»£c" (Ä‘ang cháº¡y) => chá»‰ khÃ³a chiáº¿n lÆ°á»£c, chuá»—i/tháº¿ cáº§u, combo quáº£n lÃ½ vá»‘n
        private void SetConfigEditable(bool enabled)
        {
            // NhÃ³m Chiáº¿n lÆ°á»£c
            if (CmbBetStrategy != null) CmbBetStrategy.IsEnabled = enabled;   // KHÃ“A khi Ä‘ang cháº¡y
            if (TxtChuoiCau != null) TxtChuoiCau.IsReadOnly = !enabled;   // KHÃ“A khi Ä‘ang cháº¡y
            if (TxtTheCau != null) TxtTheCau.IsReadOnly = !enabled;   // KHÃ“A khi Ä‘ang cháº¡y
            if (TxtSideRatio != null) TxtSideRatio.IsReadOnly = !enabled;   // Cá»­a Ä‘áº·t & tá»· lá»‡ (chiáº¿n lÆ°á»£c 17)
            if (BtnResetSideRatio != null) BtnResetSideRatio.IsEnabled = enabled;

            // NhÃ³m Quáº£n lÃ½ vá»‘n
            if (CmbMoneyStrategy != null) CmbMoneyStrategy.IsEnabled = enabled; // KHÃ“A khi Ä‘ang cháº¡y (chá»‰ khÃ³a chá»n chiáº¿n lÆ°á»£c vá»‘n)

            // CÃ¡c Ã´ dÆ°á»›i Ä‘Ã¢y LUÃ”N cho phÃ©p nháº­p (ká»ƒ cáº£ khi Ä‘ang cháº¡y)
            if (TxtStakeCsv != null) TxtStakeCsv.IsReadOnly = false; // Chuá»—i tiá»n
            if (TxtDecisionSecond != null) TxtDecisionSecond.IsReadOnly = false; // Äáº·t khi cÃ²n %
            if (TxtCutProfit != null) TxtCutProfit.IsReadOnly = false; // Cáº¯t lÃ£i
            if (TxtCutLoss != null) TxtCutLoss.IsReadOnly = false; // Cáº¯t lá»—
        }



        private void ApplyUiMode(bool isGame)
        {
            // so sÃ¡nh tráº¡ng thÃ¡i cÅ©/má»›i
            bool wasGame = _isGameUi;
            _isGameUi = isGame;

            // Chá»‰ Ä‘á»•i layout nÃºt khi cháº¿ Ä‘á»™ tháº­t sá»± Ä‘á»•i
            if (isGame != wasGame)
            {
                SetModeUi(isGame); // áº©n/hiá»‡n BtnVaoXocDia vs BtnPlay (HÃ€M CÅ¨)
                Log($"SetModeUi(isGame); " + isGame);
            }

            // DÃ™ mode khÃ´ng Ä‘á»•i, khi Ä‘ang á»Ÿ Home váº«n cáº§n cáº­p nháº­t nhÃ£n theo username
            if (!isGame && BtnVaoXocDia != null)
            {
                var desired = "ÄÄƒng Nháº­p Tool";
                // trÃ¡nh set láº¡i náº¿u khÃ´ng thay Ä‘á»•i gÃ¬
                if (!Equals(BtnVaoXocDia.Content as string, desired))
                    BtnVaoXocDia.Content = desired;
            }
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
                TabName = $"Chiáº¿n lÆ°á»£c {index}"
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
                    Log($"[StakeCsv] loaded: {_cfg.StakeCsv} -> {_stakeSeq.Length} má»©c");
                }
                if (CmbBetStrategy != null)
                    CmbBetStrategy.SelectedIndex = (_cfg.BetStrategyIndex >= 0 && _cfg.BetStrategyIndex <= 17) ? _cfg.BetStrategyIndex : 16;
                SyncStrategyFieldsToUI();
                UpdateTooltips();
                UpdateBetStrategyUi();

                if (TxtDecisionSecond != null) TxtDecisionSecond.Text = _cfg.DecisionSeconds.ToString();
                if (CmbMoneyStrategy != null) ApplyMoneyStrategyToUI(_cfg.MoneyStrategy ?? "IncreaseWhenLose");
                LoadStakeCsvForCurrentMoneyStrategy();
                if (ChkS7ResetOnProfit != null) ChkS7ResetOnProfit.IsChecked = _cfg.S7ResetOnProfit;
                if (!IsAnyTabRunning() || IsActiveTabRunning())
                    MoneyHelper.S7ResetOnProfit = _cfg.S7ResetOnProfit;
                UpdateS7ResetOptionUI();

                if (TxtSideRatio != null)
                {
                    var sideTxt = string.IsNullOrWhiteSpace(_cfg.SideRateText)
                        ? TaiXiuLiveSun.Tasks.SideRateParser.DefaultText
                        : _cfg.SideRateText;
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
            cfg.DecisionSeconds = I(T(TxtDecisionSecond, "10"), 10);
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
                return $"Chiáº¿n lÆ°á»£c {index}";

            if (trimmed.Equals($"Chi?n l??c {index}", StringComparison.OrdinalIgnoreCase) ||
                trimmed.Equals($"Chi?n lu?c {index}", StringComparison.OrdinalIgnoreCase) ||
                trimmed.Equals($"Chi?n l?c {index}", StringComparison.OrdinalIgnoreCase))
            {
                return $"Chiáº¿n lÆ°á»£c {index}";
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
                    name = $"Chiáº¿n lÆ°á»£c {_strategyTabs.IndexOf(tab) + 1}";
            }
            return name;
        }

        private bool IsAnyTabRunning()
        {
            return _strategyTabs.Any(t => t.IsRunning);
        }

        private bool HasJackpotMultiSideRunning()
        {
            return _strategyTabs.Any(t => t.IsRunning && t.ActiveTask is TaiXiuLiveSun.Tasks.JackpotMultiSideTask);
        }

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
                ShowTabHint("Chá»‰ Ä‘Æ°á»£c má»Ÿ tá»‘i Ä‘a 5 chiáº¿n lÆ°á»£c");
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
                ShowTabHint("Cáº§n tá»‘i thiá»ƒu 1 chiáº¿n lÆ°á»£c");
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
                // 1) Khá»Ÿi táº¡o CoreWebView2 (Æ°u tiÃªn fixed runtime, fallback Evergreen)
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
                    HookWebViewEventsOnce(); // gáº¯n cÃ¡c hook háº¡ táº§ng (cÃ³ _webHooked guard)
                }

                if (Web.CoreWebView2 == null) return;

                // 2) Gáº¯n WebMessageReceived Ä‘Ãºng 1 láº§n
                if (!_webMsgHooked)
                {
                    _webMsgHooked = true;
                    Web.CoreWebView2.WebMessageReceived += async (s, e) =>
                    {
                        try
                        {
                            var msg = e.TryGetWebMessageAsString() ?? "";
                            if (string.IsNullOrWhiteSpace(msg)) return;

                            EnqueueUi($"[JS] {msg}"); // chá»‰ hiá»ƒn thá»‹ UI, khÃ´ng ghi ra file

                            try
                            {
                                using var doc = JsonDocument.Parse(msg);
                                var root = doc.RootElement;

                                if (!root.TryGetProperty("abx", out var abxEl)) return;
                                var abxStr = abxEl.GetString() ?? "";

                                // 1) result: EvalJsAwaitAsync bridge
                                if (abxStr == "result" && root.TryGetProperty("id", out var idEl))
                                {
                                    var id = idEl.GetString() ?? "";
                                    string val = root.TryGetProperty("value", out var vEl) ? vEl.ToString() : root.ToString();
                                    if (_jsAwaiters.TryRemove(id, out var waiter))
                                        waiter.TrySetResult(val);
                                    return;
                                }

                                // 1.b) cw_page_probe: JS bÃ¡o context URL/frame + scene probe Ä‘á»ƒ cháº©n Ä‘oÃ¡n chá»n trang
                                if (abxStr == "cw_page_probe")
                                {
                                    string reason = root.TryGetProperty("reason", out var rEl) ? (rEl.GetString() ?? "") : "";
                                    bool ok = root.TryGetProperty("ok", out var okEl) && okEl.ValueKind == JsonValueKind.True;
                                    int score = root.TryGetProperty("score", out var scEl) && scEl.TryGetInt32(out var scVal) ? scVal : 0;
                                    int urlScore = root.TryGetProperty("urlScore", out var uscEl) && uscEl.TryGetInt32(out var uscVal) ? uscVal : 0;
                                    string host = root.TryGetProperty("host", out var hoEl) ? (hoEl.GetString() ?? "") : "";
                                    string href = root.TryGetProperty("href", out var hfEl) ? (hfEl.GetString() ?? "") : "";
                                    string frame = root.TryGetProperty("frame", out var frEl) ? (frEl.GetString() ?? "") : "";
                                    string prefab = root.TryGetProperty("prefab", out var pfEl) ? (pfEl.GetString() ?? "") : "";
                                    string rootHint = root.TryGetProperty("root", out var rtEl) ? (rtEl.GetString() ?? "") : "";

                                    Log($"[CW_PAGE] reason={reason} ok={ok} score={score} urlScore={urlScore} frame={frame} host={host} prefab={prefab} root={rootHint} href={href}");
                                    return;
                                }

                                // 2) tick: cáº­p nháº­t snapshot + UI + (NI & finalize khi Ä‘uÃ´i Ä‘á»•i)
                                if (abxStr == "tick")
                                {
                                    // Äá»•i tÃªn biáº¿n JSON Ä‘á»ƒ khÃ´ng Ä‘á»¥ng 'doc'/'root' bÃªn ngoÃ i
                                    using var jdocTick = System.Text.Json.JsonDocument.Parse(msg);
                                    var jrootTick = jdocTick.RootElement;

                                    var snap = System.Text.Json.JsonSerializer.Deserialize<CwSnapshot>(msg);
                                    if (snap != null)
                                    {
                                        // Ghi nháº­n username tá»« tick game (dÃ¹ng lÃ m _homeUsername náº¿u Home chÆ°a gá»­i)
                                        try
                                        {
                                            var userVal = snap.username ?? "";
                                            if (!string.IsNullOrWhiteSpace(userVal))
                                            {
                                                var normalized = userVal.Trim().ToLowerInvariant();
                                                _homeUsername = normalized;
                                                _homeUsernameAt = DateTime.UtcNow;

                                                if (_cfg != null && _cfg.LastHomeUsername != _homeUsername)
                                                {
                                                    _cfg.LastHomeUsername = _homeUsername;
                                                    _ = SaveConfigAsync();
                                                }
                                            }
                                        }
                                        catch { /* ignore */ }

                                        // === NI-SEQUENCE & finalize Ä‘Ãºng thá»i Ä‘iá»ƒm (Ä‘uÃ´i seq Ä‘á»•i) ===
                                        try
                                        {
                                            double progNow = snap.prog ?? 0;
                                            var seqStr = snap.seq ?? "";

                                            // Náº¿u Ä‘ang khÃ³a theo dÃµi vÃ  chuá»—i Ä‘Ã£ thay Ä‘á»•i so vá»›i _baseSeq => vÃ¡n cÅ© khÃ©p
                                            if (_lockMajorMinorUpdates == true &&
                                                !string.Equals(seqStr, _baseSeq, StringComparison.Ordinal))
                                            {
                                                char tail = (seqStr.Length > 0) ? seqStr[^1] : '\0';
                                                bool winIsChan = (tail == 'C');

                                                long prevC = _roundTotalsC, prevL = _roundTotalsL;
                                                // Ni: náº¿u cá»­a THáº®NG lÃ  cá»­a cÃ³ tá»•ng tiá»n lá»›n hÆ¡n trong vÃ¡n Ä‘Ã³ => 'N', ngÆ°á»£c láº¡i 'I'
                                                char ni = winIsChan ? ((prevC >= prevL) ? 'N' : 'I')
                                                                    : ((prevL >= prevC) ? 'N' : 'I');

                                                _niSeq.Append(ni);
                                                if (_niSeq.Length > NiSeqMax)
                                                    _niSeq.Remove(0, _niSeq.Length - NiSeqMax);

                                                Log($"[NI] add={ni} | seq={_niSeq} | tail={tail} | C={prevC} | L={prevL}");

                                                // âœ… CHá»T DÃ’NG BET Ä‘ang chá» NGAY Táº I THá»œI ÄIá»‚M VÃN KHÃ‰P
                                                var kqStr = winIsChan ? "CHAN" : "LE";
                                                long? accNow2 = snap?.totals?.A;
                                                if (_pendingRows.Count > 0 && accNow2.HasValue)
                                                {
                                                    // Chiáº¿n lÆ°á»£c 17 tá»± finalize nhiá»u cá»­a theo winners
                                                    if (!HasJackpotMultiSideRunning())
                                                    {
                                        FinalizeLastBet(kqStr, accNow2.Value);
                                                    }
                                                }

                                                _lockMajorMinorUpdates = false; // xong chu ká»³ nÃ y
                                            }

                                            // Khi vÃ o vÃ¡n má»›i (prog == 0) â†’ láº¥y má»‘c base & totals Ä‘á»ƒ so sÃ¡nh cho vÃ¡n sáº¯p khÃ©p
                                            if (_lockMajorMinorUpdates == false)
                                            {
                                                if (progNow == 0)
                                                {
                                                    _baseSeq = seqStr;
                                                    _roundTotalsC = snap.totals?.C ?? 0;
                                                    _roundTotalsL = snap.totals?.L ?? 0;
                                                    if (_roundTotalsC != 0 && _roundTotalsL != 0)
                                                        _lockMajorMinorUpdates = true;
                                                }
                                            }
                                        }
                                        catch { /* an toÃ n */ }

                                        // Ghi láº¡i niSeq vÃ o snapshot cho UI
                                        snap.niSeq = _niSeq.ToString();
                                        lock (_snapLock) _lastSnap = snap;

                                        // --- NEW: láº¥y status tá»« JSON (JS Ä‘Ã£ bÆ¡m vÃ o tick) ---
                                        string statusUi = jrootTick.TryGetProperty("status", out var stEl) ? (stEl.GetString() ?? "") : "";

                                        // --- Cáº­p nháº­t UI ---
                                        _ = Dispatcher.BeginInvoke(new Action(() =>
                                        {
                                            try
                                            {
                                                // Progress / thá»i gian Ä‘áº¿m ngÆ°á»£c (giÃ¢y)
                                                if (snap.prog.HasValue)
                                                {
                                                    const double progMaxSec = 20;
                                                    var sec = Math.Max(0, Math.Min(progMaxSec, snap.prog.Value));
                                                    var secInt = (int)Math.Round(sec, MidpointRounding.AwayFromZero);
                                                    var ratio = (progMaxSec > 0) ? (sec / progMaxSec) : 0;
                                                    if (PrgBet != null)
                                                    {
                                                        PrgBet.Minimum = 0;
                                                        PrgBet.Maximum = 1;
                                                        PrgBet.Value = ratio;
                                                    }
                                                    if (LblProg != null) LblProg.Text = $"{secInt}s";
                                                }
                                                else
                                                {
                                                    if (PrgBet != null) PrgBet.Value = 0;
                                                    if (LblProg != null) LblProg.Text = "-";
                                                }

                                                // Káº¿t quáº£ gáº§n nháº¥t tá»« chuá»—i seq
                                                var seqStrLocal = snap.seq ?? "";
                                                char last = (seqStrLocal.Length > 0) ? seqStrLocal[^1] : '\0';
                                                var kq = (last == 'C') ? "CHAN"
                                                         : (last == 'L') ? "LE" : "";
                                                SetLastResultUI(kq);

                                                // Tá»•ng tiá»n
                                                var amt = snap?.totals?.A;
                                                if (LblAmount != null)
                                                    LblAmount.Text = amt.HasValue
                                                        ? amt.Value.ToString("N0", System.Globalization.CultureInfo.InvariantCulture) : "-";
                                                if (LblUserName != null)
                                                {
                                                    var name = snap?.totals?.N ?? "";
                                                    LblUserName.Text = !string.IsNullOrWhiteSpace(name) ? name : "-";
                                                }

                                                // Chuá»—i káº¿t quáº£
                                                UpdateSeqUI(snap.seq ?? "");

                                                // ðŸ”¸ Tráº¡ng thÃ¡i: "PhiÃªn má»›i" / "Ngá»«ng Ä‘áº·t cÆ°á»£c" / "Äang chá» káº¿t quáº£"
                                                if (LblStatusText != null)
                                                {
                                                    if (!string.IsNullOrWhiteSpace(statusUi))
                                                    {
                                                        LblStatusText.Text = statusUi;
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

                                    _lastGameTickUtc = DateTime.UtcNow;
                                    return;
                                }



                                // 2.b) game_hint: Home bÃ¡o Ä‘Ã£ cÃ³ game/iframe â†’ chuyá»ƒn UI tá»©c thÃ¬
                                if (abxStr == "game_hint")
                                {
                                    _lastGameTickUtc = DateTime.UtcNow; // synthetic tick
                                    _ = Dispatcher.BeginInvoke(new Action(() => ApplyUiMode(true)));
                                    return;
                                }

                                // 3) bet ok â†’ táº¡o dÃ²ng placeholder (Result/WinLose = "-") vÃ  SHOW TRANG 1
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

                                    var row = new BetRow
                                    {
                                        At = DateTime.Now,
                                        Game = "XÃ³c Ä‘Ä©a live",
                                        Stake = amount,
                                        Side = side,
                                        Result = "-",
                                        WinLose = "-",
                                        Account = accNow
                                    };

                                    // Má»šI NHáº¤T á»ž Äáº¦U DANH SÃCH (trang 1)
                                    _betAll.Insert(0, row);
                                    if (_betAll.Count > MaxHistory) _betAll.RemoveAt(_betAll.Count - 1);
                                    _pendingRows.Add(row);
                                    // Chá»‰ vá» trang 1 náº¿u Ä‘ang bÃ¡m trang má»›i nháº¥t; cÃ²n Ä‘ang xem trang cÅ© thÃ¬ giá»¯ nguyÃªn
                                    if (_autoFollowNewest)
                                    {
                                        ShowFirstPage();
                                    }
                                    else
                                    {
                                        RefreshCurrentPage();   // (má»¥c 3 bÃªn dÆ°á»›i)
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

                                // 5) home_tick: username/balance/url tá»« Home
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
                                                _ = SaveConfigAsync(); // fire-and-forget
                                            }
                                        }
                                    }

                                    var bal = root.TryGetProperty("balance", out var bEl) ? (bEl.GetString() ?? "") : "";
                                    var href = root.TryGetProperty("href", out var hEl) ? (hEl.GetString() ?? "") : "";

                                    try
                                    {
                                        await Dispatcher.InvokeAsync(() =>
                                        {
                                            //if (!string.IsNullOrWhiteSpace(uname) && TxtUser != null)
                                            //{
                                               // if (string.IsNullOrWhiteSpace(TxtUser.Text) || TxtUser.Text != uname)
                                               //     TxtUser.Text = uname;
                                            //}
                                            if (LblUserName != null) LblUserName.Text = uname;
                                            if (LblAmount != null) LblAmount.Text = bal;
                                        });

                                        // cáº­p nháº­t tráº¡ng thÃ¡i Ä‘Ã£ Ä‘Äƒng nháº­p dá»±a trÃªn nÃºt Logout/Login
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
        .some(el => vis(el) && /dang\\s*xuat|Ä‘Äƒng\\s*xuáº¥t|logout|sign\\s*out/i.test(low(el.textContent)));
    const hasLoginVis = qa('a,button,[role=""button""],.btn,.base-button')
        .some(el => vis(el) && /dang\\s*nhap|Ä‘Äƒng\\s*nháº­p|login|sign\\s*in/i.test(low(el.textContent)));

    return (hasLogoutVis && !hasLoginVis) ? '1' : '0';
  }catch(e){ return '0'; }
})();";
                                            var st = await ExecJsAsyncStr(jsLogged);
                                            _homeLoggedIn = (st == "1");
                                        }
                                        catch { /* ignore */ }
                                    }
                                    catch { }

                                    _lastHomeTickUtc = DateTime.UtcNow;
                                    return;
                                }
                            }
                            catch
                            {
                                // ignore non-JSON
                            }
                        }
                        catch (Exception ex2)
                        {
                            Log("[WebMessageReceived] " + ex2);
                        }
                    };
                }

                // 3) Hook NavigationCompleted Ä‘á»ƒ chuyá»ƒn UI theo URL ngay khi Ä‘iá»u hÆ°á»›ng xong
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

                    //await AutoFillLoginAsync();
                }
            }
            catch (Exception ex) { Log("[NavigateIfNeededAsync] " + ex); }
        }


        private async Task ApplyBackgroundForStateAsync()
        {
            // ChÆ°a cÃ³ CoreWebView2 â‡’ Ä‘á»ƒ ná»n Ä‘en (WebHost Ä‘ang Black)
            if (Web?.CoreWebView2 == null)
                return;

            var url = (TxtUrl?.Text ?? "").Trim();

            if (string.IsNullOrWhiteSpace(url))
            {
                // ÄÃ£ cÃ³ WebView2 nhÆ°ng chÆ°a nháº­p URL â‡’ ná»n tráº¯ng
                SetWebViewBackground(System.Windows.Media.Colors.White);
                await ShowBlankWhiteAsync();   // trang tráº¯ng gá»£i Ã½
            }
            else
            {
                // Äang/Ä‘Ã£ Ä‘iá»u hÆ°á»›ng â‡’ Ä‘á»ƒ trang quyáº¿t Ä‘á»‹nh (trong suá»‘t)
                SetWebViewBackground(System.Windows.Media.Colors.Transparent);
            }
        }


        // Hiá»ƒn thá»‹ má»™t trang tráº¯ng tá»‘i giáº£n trong WebView2
        private async Task ShowBlankWhiteAsync(string? message = null)
        {
            if (Web?.CoreWebView2 == null) return;

            // Trang HTML tráº¯ng, cÃ³ dÃ²ng gá»£i Ã½ nhá» á»Ÿ giá»¯a (tuá»³ chá»n)
            string note = string.IsNullOrWhiteSpace(message) ? "ChÆ°a cÃ³ URL / Nháº­p URL Ä‘á»ƒ Ä‘iá»u hÆ°á»›ng" : message;
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
                // chuyá»ƒn Media.Color -> Drawing.Color
                var d = System.Drawing.Color.FromArgb(c.A, c.R, c.G, c.B);
                Web.DefaultBackgroundColor = d;
            }
            catch { }
        }


        // Gá»i hÃ m nÃ y TRÆ¯á»šC má»i EnsureCoreWebView2Async
        private async Task InitWebView2WithFixedRuntimeAsync()
        {
            // Náº¿u Ä‘Ã£ init hoáº·c Ä‘Ã£ cÃ³ CoreWebView2 thÃ¬ bá» qua
            if (_webInitDone || Web?.CoreWebView2 != null) return;

            // 1) Báº£o Ä‘áº£m fixed runtime Ä‘Æ°á»£c bung ra vÃ  láº¥y thÆ° má»¥c (cÃ³ thá»ƒ null náº¿u thiáº¿u resource)
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

            // 2) Báº£o Ä‘áº£m thÆ° má»¥c user-data tá»“n táº¡i (khá»›p vá»›i XAML)
            System.IO.Directory.CreateDirectory(Wv2UserDataDir);

            try
            {
                // 3) Táº¡o environment trá» tá»›i fixed runtime + user-data riÃªng
                _webEnv = await CoreWebView2Environment.CreateAsync(
                    browserExecutableFolder: fixedDir,
                    userDataFolder: Wv2UserDataDir,
                    options: null /* trÃ¡nh trÃ¹ng "--disable-gpu" vÃ¬ XAML Ä‘Ã£ set */
                );

                // DÃ¹ng overload cÃ³ _webEnv Ä‘á»ƒ cháº¯c cháº¯n dÃ¹ng fixed runtime
                await Web!.EnsureCoreWebView2Async(_webEnv);
            }
            catch (ArgumentException ex) when (ex.Message.Contains("already initialized"))
            {
                // ÄÃ£ bá»‹ init trÆ°á»›c báº±ng env khÃ¡c â†’ dÃ¹ng luÃ´n env hiá»‡n cÃ³
                Log("[WV2] Already initialized with another environment â†’ use existing.");
                _webEnv = null; // Ä‘á»ƒ nÆ¡i khÃ¡c khÃ´ng cá»‘ Ã©p env khÃ¡c
                                // Caller sáº½ tiáº¿p tá»¥c flow (HookWebViewEventsOnce/EnsureWebReadyAsync) sau.
            }
            catch (Exception ex)
            {
                // 4) Fallback: dÃ¹ng Evergreen, nhÆ°ng váº«n cá»‘ Ä‘á»‹nh user-data (khÃ´ng sinh *.exe.WebView2)
                Log("[WV2] Fixed runtime failed â†’ fallback system: " + ex.Message);
                _webEnv = await CoreWebView2Environment.CreateAsync(
                    browserExecutableFolder: null,
                    userDataFolder: Wv2UserDataDir,
                    options: null
                );
                await Web!.EnsureCoreWebView2Async(_webEnv);
            }

            // 5) Gáº¯n event 1 láº§n (Ä‘Ã£ cÃ³ _webHooked guard bÃªn trong)
            HookWebViewEventsOnce();
            _webInitDone = true;
        }



        private void HookWebViewEventsOnce()
        {
            if (_webHooked || Web?.CoreWebView2 == null) return;
            _webHooked = true;

            try
            {
                // Báº­t WebMessages (Ä‘áº£m báº£o chrome.webview.postMessage hoáº¡t Ä‘á»™ng tá»« trang & iframe)
                var settings = Web.CoreWebView2.Settings;
                if (settings != null)
                {
                    settings.IsWebMessageEnabled = true;
                    settings.AreDevToolsEnabled = true;
                    settings.AreBrowserAcceleratorKeysEnabled = true;
                    // (tuá»³ chá»n khÃ¡c, giá»¯ nguyÃªn náº¿u báº¡n khÃ´ng cáº§n)
                    // settings.AreDefaultContextMenusEnabled = false;
                    // settings.AreDevToolsEnabled = true;
                }

                // try { Web.CoreWebView2.OpenDevToolsWindow(); } catch { }

                // KhÃ´ng gáº¯n WebMessageReceived á»Ÿ Ä‘Ã¢y (Ä‘Ã£ gáº¯n trong EnsureWebReadyAsync)
                // Äiá»u hÆ°á»›ng má»i window.open vá» cÃ¹ng WebView2
                _ = Web.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(@"
            (function(){
                try { window.open = function(u){ try { location.href = u; } catch(e){} }; } catch(e){}
            })();
        ");

                // Cháº·n má»Ÿ cá»­a sá»• má»›i â†’ Ä‘iá»u hÆ°á»›ng trong cÃ¹ng control
                Web.CoreWebView2.NewWindowRequested += NewWindowRequested;

                // Theo dÃµi Ä‘iá»u hÆ°á»›ng Ä‘á»ƒ Ä‘á»“ng bá»™ ná»n/tráº¡ng thÃ¡i
                Web.NavigationCompleted += Web_NavigationCompleted;

                // Báº­t CDP network tap (khÃ´ng cáº§n await)
                _ = EnableCdpNetworkTapAsync();

                // Cáº­p nháº­t ná»n ngay theo tráº¡ng thÃ¡i hiá»‡n táº¡i (tráº¯ng khi chÆ°a nháº­p URL, trong suá»‘t khi Ä‘Ã£ Ä‘iá»u hÆ°á»›ng)
                _ = ApplyBackgroundForStateAsync();
            }
            catch (Exception ex)
            {
                Log("[HookWebViewEventsOnce] " + ex);
            }
        }

        private async Task<string> EnsureFixedRuntimePresentAsync()
        {
            // 0) Náº¿u Ä‘ang cháº¡y nhÆ° plugin trong AutoBetHub â‡’ Æ°u tiÃªn dÃ¹ng runtime dÃ¹ng chung
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
                // Bá» qua lá»—i detect host, sáº½ fallback sang runtime riÃªng bÃªn dÆ°á»›i
            }

            // 1) Runtime riÃªng cá»§a XocDiaSoiLiveKH24 (dÃ¹ng khi cháº¡y EXE Ä‘á»™c láº­p)
            var baseDir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                AppLocalDirName, "WebView2Fixed");
            var targetDir = Path.Combine(baseDir, "fixed");

            // Náº¿u Ä‘Ã£ cÃ³ exe chÃ­nh => coi nhÆ° Ä‘Ã£ bung
            if (File.Exists(Path.Combine(targetDir, "msedgewebview2.exe")))
                return targetDir;

            Directory.CreateDirectory(targetDir);

            var resName = FindResourceName("ThirdParty.WebView2Fixed_win-x64.zip")
                          ?? Wv2ZipResNameX64;

            // Æ¯u tiÃªn resource nhÃºng; fallback sang file ngoÃ i náº¿u cháº¡y Debug khÃ´ng nhÃºng
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
                if (string.IsNullOrEmpty(e.Name)) continue; // bá» folder rá»—ng

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
                    "Thiáº¿u Microsoft Edge WebView2 Runtime.\nHÃ£y cÃ i Evergreen x64 rá»“i má»Ÿ láº¡i á»©ng dá»¥ng.",
                    "Thiáº¿u WebView2", MessageBoxButton.OK, MessageBoxImage.Warning);
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
        // Äiá»n cáº£ 2 trÆ°á»ng (nhanh + cháº¯c cháº¯n), KHÃ”NG dÃ¹ng postMessage
        private async Task AutoFillLoginAsync()
        {
            if (Web == null) return;
            await EnsureWebReadyAsync();
            Log("[AutoFill] skipped (sync disabled)");
            return;


            var u = T(TxtUser);
            var p = P(TxtPass);
            if (string.IsNullOrEmpty(u) && string.IsNullOrEmpty(p))
            {
                Log("[AutoFill] skipped (empty creds)");
                return;        }            // Fast pass: thá»­ Ä‘iá»n nhanh cáº£ 2 trong 1 láº§n â€“ Ä‘á»“ng bá»™
            string fastJs =
        @"(function(u,p){
  const rm=s=>{try{return (s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'');}catch(_){return s||'';}};
  const low=s=>rm(String(s||'').trim().toLowerCase());
  const vis=el=>{if(!el)return false;const r=el.getBoundingClientRect(),cs=getComputedStyle(el);
                 return r.width>4&&r.height>4&&cs.display!=='none'&&cs.visibility!=='hidden'&&cs.pointerEvents!=='none';};
  const qa=(s,d)=>Array.from((d||document).querySelectorAll(s));
  const q =(s,d)=>(d||document).querySelector(s);

  function openLogin(d){
    try{
      const btn = qa('a,button,[role=""button""],.btn,.base-button,.el-button,.ant-btn,.v-btn', d)
        .find(el=>/dang\\s*nhap|Ä‘Äƒng\\s*nháº­p|login|sign\\s*in/i.test(low(el.textContent)));
      if(btn) btn.click();
    }catch(_){}
  }
  function pickUser(d){
    const ss=['input[autocomplete=""username""]','input[placeholder*=""Ä‘Äƒng nháº­p"" i]','input[placeholder*=""ten dang nhap"" i]',
              'input[placeholder*=""tÃ i khoáº£n"" i]','input[placeholder*=""tai khoan"" i]',
              'input[name*=""user"" i]','input[name*=""account"" i]','input[id*=""user"" i]',
              'input[type=""email""]','input[type=""text""]'];
    for(const s of ss){const el=q(s,d); if(el&&vis(el)) return el;} return null;
  }
  function pickPass(d){
    const ss=['input[type=""password""]','input[autocomplete=""current-password""]',
              'input[placeholder*=""máº­t kháº©u"" i]','input[placeholder*=""mat khau"" i]',
              'input[name*=""pass"" i]','input[id*=""pass"" i]'];
    for(const s of ss){const el=q(s,d); if(el&&vis(el)) return el;} return null;
  }

  const frames=[window].concat(Array.from(document.querySelectorAll('iframe'))
                 .map(i=>{try{return i.contentWindow;}catch(_){return null;}}).filter(Boolean));
  let doneU=false, doneP=false;
  for(const w of frames){
    try{
      const d=w.document; if(!(doneU&&doneP)) openLogin(d);
      const uEl=!doneU?pickUser(d):null; const pEl=!doneP?pickPass(d):null;
      if(uEl){ uEl.focus(); uEl.value=u||''; uEl.dispatchEvent(new Event('input',{bubbles:true})); uEl.dispatchEvent(new Event('change',{bubbles:true})); doneU=true; }
      if(pEl){ pEl.focus(); pEl.value=p||''; pEl.dispatchEvent(new Event('input',{bubbles:true})); pEl.dispatchEvent(new Event('change',{bubbles:true})); doneP=true; }
      if(doneU&&doneP) break;
    }catch(_){}
  }
  return (doneU?1:0)+(doneP?2:0);
})(" + JsonSerializer.Serialize(u) + "," + JsonSerializer.Serialize(p) + @");";

            string fast = "0";
            try { fast = await ExecJsAsyncStr(fastJs); Log("[AutoFillFast] " + fast); }
            catch (Exception ex) { Log("[AutoFillFast] " + ex); }

            // Fallback cháº¯c cháº¯n: náº¿u chÆ°a Ä‘á»§ cáº£ 2 trÆ°á»ng thÃ¬ Ä‘iá»n láº¡i tá»«ng trÆ°á»ng
            if (fast != "3")
            {
                try { await SyncLoginFieldAsync("user", u); } catch { }
                try { await SyncLoginFieldAsync("pass", p); } catch { }
            }

            // Báº¥m Ä‘Äƒng nháº­p sá»›m (táº¡m táº¯t auto-login Ä‘á»ƒ dÃ¹ng tay khi cáº§n)
            //await TryAutoLoginAsync(500, force: true);
        }



        // ====== Äiá»n user/pass trong má»i frame (khÃ´ng timeout) ======
        // Äiá»n 1 trÆ°á»ng (user/pass) trong má»i iframe same-origin â€“ cháº¡y Ä‘á»“ng bá»™, khÃ´ng phá»¥ thuá»™c postMessage
        private async Task SyncLoginFieldAsync(string which, string value)
        {
            if (Web == null) return;
            await EnsureWebReadyAsync();

            string js =
        @"(function(which,val){
  const rm=s=>{try{return (s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'');}catch(_){return s||'';}};
  const low=s=>rm(String(s||'').trim().toLowerCase());
  const vis=el=>{if(!el)return false;const r=el.getBoundingClientRect(),cs=getComputedStyle(el);
                 return r.width>4&&r.height>4&&cs.display!=='none'&&cs.visibility!=='hidden'&&cs.pointerEvents!=='none';};
  const qa=(s,d)=>Array.from((d||document).querySelectorAll(s));
  const q =(s,d)=>(d||document).querySelector(s);

  function openLogin(d){
    try{
      const btn = qa('a,button,[role=""button""],.btn,.base-button,.el-button,.ant-btn,.v-btn', d)
        .find(el=>/dang\\s*nhap|Ä‘Äƒng\\s*nháº­p|login|sign\\s*in/i.test(low(el.textContent)));
      if(btn) btn.click();
    }catch(_){}
  }

  function pickUser(d){
    const ss=['input[autocomplete=""username""]','input[placeholder*=""Ä‘Äƒng nháº­p"" i]','input[placeholder*=""ten dang nhap"" i]',
              'input[placeholder*=""tÃ i khoáº£n"" i]','input[placeholder*=""tai khoan"" i]',
              'input[name*=""user"" i]','input[name*=""account"" i]','input[id*=""user"" i]',
              'input[type=""email""]','input[type=""text""]'];
    for(const s of ss){ const el=q(s,d); if(el&&vis(el)) return el; } return null;
  }
  function pickPass(d){
    const ss=['input[type=""password""]','input[autocomplete=""current-password""]',
              'input[placeholder*=""máº­t kháº©u"" i]','input[placeholder*=""mat khau"" i]',
              'input[name*=""pass"" i]','input[id*=""pass"" i]'];
    for(const s of ss){ const el=q(s,d); if(el&&vis(el)) return el; } return null;
  }

  const frames=[window].concat(Array.from(document.querySelectorAll('iframe'))
                 .map(i=>{try{return i.contentWindow;}catch(_){return null;}}).filter(Boolean));

  let el=null;
  for(const w of frames){
    try{
      const d=w.document;
      openLogin(d);
      el = which==='user' ? pickUser(d) : pickPass(d);
      if(el) break;
    }catch(_){}
  }
  if(!el) return 'no-field';
  try{
    el.focus(); el.value = val || '';
    el.dispatchEvent(new Event('input',{bubbles:true}));
    el.dispatchEvent(new Event('change',{bubbles:true}));
    return 'ok';
  }catch(e){ return 'err:'+e; }
})(" + JsonSerializer.Serialize(which) + "," + JsonSerializer.Serialize(value) + @");";

            try
            {
                var res = await ExecJsAsyncStr(js);
                Log("[SyncLoginField] " + res);
            }
            catch (Exception ex) { Log("[SyncLoginField] " + ex); }
        }

        // Báº¥m 'ChÆ¡i XÃ³c ÄÄ©a Live' tá»« Home:
        // 1) Æ¯u tiÃªn gá»i API JS náº¿u cÃ³ (__abx_hw_clickPlayXDL), 
        // 2) fallback sang C# ClickXocDiaTitleAsync(timeout)
        private async Task<bool> TryPlayXocDiaFromHomeAsync()
        {
            try
            {
                Log("[HOME] Play XÃ³c ÄÄ©a Live: try js api");
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
                var r2 = await ClickXocDiaTitleAsync(12000); // hÃ m C# báº¡n Ä‘Ã£ cÃ³
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
                // NEW: gáº¯n logger Ä‘á»ƒ MoneyHelper ghi ra file log hiá»‡n táº¡i
                MoneyHelper.Logger = Log;
                LoadConfig();
                InitSeqIcons();

                // NEW: Ä‘á»“ng bá»™ ná»™i dung theo chiáº¿n lÆ°á»£c Ä‘ang chá»n + gáº¯n tooltip ngay khi má»Ÿ app
                // (cÃ¡c helper Ä‘Ã£ gá»­i: SyncStrategyFieldsToUI(), UpdateTooltips())
                SyncStrategyFieldsToUI();     // Ä‘á»• Ä‘Ãºng Chuá»—i/Tháº¿ theo chiáº¿n lÆ°á»£c 1/2/3/4
                UpdateTooltips();             // gáº¯n TIP_* cho Chuá»—i/Tháº¿ + StakeCsv/Cáº¯t lÃ£i/Cáº¯t lá»—/% thá»i gian

                // NEW: náº¡p chuá»—i tiá»n theo â€œQuáº£n lÃ½ vá»‘nâ€ hiá»‡n táº¡i Ä‘á»ƒ UI hiá»ƒn thá»‹ Ä‘Ãºng ngay tá»« Ä‘áº§u
                // (helper Ä‘Ã£ gá»­i: LoadStakeCsvForCurrentMoneyStrategy())
                LoadStakeCsvForCurrentMoneyStrategy();

                // gáº¯n handler input nhÆ° trÆ°á»›c
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

                if (ChkLockMouse != null)
                    ChkLockMouse.IsChecked = _cfg.LockMouse;

                // giá»¯ nguyÃªn 2 hÃ m cÅ©
                await InitWebView2WithFixedRuntimeAsync();
                await ApplyBackgroundForStateAsync();

                // WebView2 ready (giá»¯ hook cÅ© cá»§a báº¡n)
                await EnsureWebReadyAsync();

                await EnsureBridgeRegisteredAsync();
                await InjectOnNewDocAsync();

                // Bridge dÃ¹ng chung
                if (_bridge == null)
                {
                    // DÃ¹ng láº¡i _appJs Ä‘Ã£ náº¡p 1 láº§n (embedded)
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

                    await ApplyBackgroundForStateAsync(); // Ä‘Ãºng hÃ nh vi cÅ© sau khi cÃ³ URL
                }

                SetPlayButtonState(_activeTab?.IsRunning == true); // (náº¿u trong SetPlayButtonState cÃ³ SetConfigEditable thÃ¬ sáº½ khÃ³a/má»Ÿ cÃ¡c Ã´)
                ApplyMouseShieldFromCheck();

                // --- Báº®T Äáº¦U GIÃM SÃT UI MODE ---
                if (_uiModeTimer == null)
                {
                    _uiModeTimer = new System.Windows.Threading.DispatcherTimer
                    {
                        Interval = TimeSpan.FromMilliseconds(300)
                    };
                    _uiModeTimer.Tick += (_, __) =>
                    {
                        try { RecomputeUiMode(); } catch { /* ignore */ }
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
            StopLogPump();       // <-- táº¯t pump
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
            PlayXocDia_Click(sender, e); // delegate sang nÃºt Báº¯t Äáº§u CÆ°á»£c
        }

        private void StopLoop_Click(object sender, RoutedEventArgs e)
        {
            StopXocDia_Click(sender, e);
        }


        // Checkbox Remember (Ä‘Ã£ thÃªm á»Ÿ XAML)
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

                // Bá»” SUNG: Ä‘áº£m báº£o cáº§u ná»‘i vÃ  tiÃªm náº¿u doc má»›i
                _ = EnsureBridgeRegisteredAsync();
                _ = InjectOnNewDocAsync();

                // HÃ€NH VI CÅ¨
                _ = AutoFillLoginAsync();
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
            if (!_uiReady || _tabSwitching) return;

            _navCts = await DebounceAsync(_navCts, 300, async () =>
            {
                await SaveConfigAsync();
                var url = T(TxtUrl).Trim();
                if (string.IsNullOrWhiteSpace(url))
                {
                    await ApplyBackgroundForStateAsync();   // URL trá»‘ng -> ná»n tráº¯ng + about:blank
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
                TaiXiuLiveSun.Tasks.MoneyHelper.ResetTempProfitForWinUpLoseKeep();
            // NEW: má»—i â€œQuáº£n lÃ½ vá»‘nâ€ cÃ³ chuá»—i tiá»n riÃªng â†’ náº¡p láº¡i Ã´ StakeCsv
            LoadStakeCsvForCurrentMoneyStrategy();
            UpdateS7ResetOptionUI();
            await SaveConfigAsync();
            Log($"[MoneyStrategy] updated: {_cfg.MoneyStrategy}");
        }


        // === REPLACE: thay toÃ n bá»™ hÃ m UpdateTooltips() báº±ng báº£n nÃ y ===
        private void UpdateTooltips()
        {
            // NhÃ³m Quáº£n lÃ½ vá»‘n
            AttachTip(TxtStakeCsv, TIP_STAKE_CSV);
            AttachTip(TxtCutProfit, TIP_CUT_PROFIT);
            AttachTip(TxtCutLoss, TIP_CUT_LOSS);
            AttachTip(TxtSideRatio, TIP_SIDE_RATIO);

            // % thá»i gian
            int idx = CmbBetStrategy?.SelectedIndex ?? 4;
            AttachTip(TxtDecisionSecond,
                (idx == 2 || idx == 3) ? TIP_DECISION_PERCENT_NI : TIP_DECISION_PERCENT_GENERAL);

            // Chuá»—i/Tháº¿ cáº§u
            AttachTip(TxtChuoiCau,
                (idx == 0) ? TIP_SEQ_CL :
                (idx == 2) ? TIP_SEQ_NI :
                "Chá»n chiáº¿n lÆ°á»£c 1 hoáº·c 3 Ä‘á»ƒ nháº­p Chuá»—i cáº§u.");

            AttachTip(TxtTheCau,
                (idx == 1) ? TIP_THE_CL :
                (idx == 3) ? TIP_THE_NI :
                "Chá»n chiáº¿n lÆ°á»£c 2 hoáº·c 4 Ä‘á»ƒ nháº­p Tháº¿ cáº§u.");
            // ==== Báº®T Äáº¦U: Tooltip cho chiáº¿n lÆ°á»£c Ä‘áº·t cÆ°á»£c ====
            string tip = idx switch
            {
                0 => "1) Chuá»—i C/L tá»± nháº­p: So khá»›p chuá»—i C/L cáº¥u hÃ¬nh thá»§ cÃ´ng (cÅ©â†’má»›i); khi khá»›p máº«u gáº§n nháº¥t sáº½ Ä‘áº·t theo cá»­a chá»‰ Ä‘á»‹nh; khÃ´ng khá»›p dÃ¹ng logic máº·c Ä‘á»‹nh.",
                1 => "2) Tháº¿ cáº§u C/L tá»± nháº­p: Ãnh xáº¡ 'máº«u quÃ¡ khá»© â†’ cá»­a káº¿ tiáº¿p' theo danh sÃ¡ch quy táº¯c; Æ°u tiÃªn máº«u dÃ i vÃ  khá»›p gáº§n nháº¥t; há»— trá»£ ',', ';', '|', hoáº·c xuá»‘ng dÃ²ng.",
                2 => "3) Chuá»—i I/N: So khá»›p dÃ£y Ãt/Nhiá»u (I/N) cáº¥u hÃ¬nh thá»§ cÃ´ng; khá»›p thÃ¬ Ä‘áº·t theo chá»‰ Ä‘á»‹nh; khÃ´ng khá»›p dÃ¹ng logic máº·c Ä‘á»‹nh.",
                3 => "4) Tháº¿ cáº§u I/N: Ãnh xáº¡ máº«u I/N â†’ cá»­a káº¿ tiáº¿p; Æ°u tiÃªn máº«u dÃ i; cho phÃ©p nhiá»u luáº­t trong cÃ¹ng danh sÃ¡ch.",
                4 => "5) Theo cáº§u trÆ°á»›c (thÃ´ng minh): Dá»±a vÃ o vÃ¡n gáº§n nháº¥t vÃ  heuristics ná»™i bá»™; Ä‘Ã¡nh liÃªn tá»¥c; quáº£n lÃ½ vá»‘n theo chuá»—i tiá»n, cut_profit/cut_loss.",
                5 => "6) Cá»­a Ä‘áº·t ngáº«u nhiÃªn: Má»—i vÃ¡n chá»n CHáº´N/Láºº ngáº«u nhiÃªn; váº«n tuÃ¢n theo MoneyManager vÃ  ngÆ°á»¡ng cáº¯t lÃ£i/lá»—.",
                6 => "7) BÃ¡m cáº§u C/L (thá»‘ng kÃª): Duyá»‡t k tá»« lá»›nâ†’nhá» (k=6 máº·c Ä‘á»‹nh); Ä‘áº¿m táº§n suáº¥t C/L sau cÃ¡c láº§n khá»›p Ä‘uÃ´i; chá»n phÃ­a Ä‘a sá»‘; hÃ²a â†’ Ä‘áº£o 1â€“1; khÃ´ng cÃ³ máº«u â†’ theo vÃ¡n cuá»‘i; Ä‘Ã¡nh liÃªn tá»¥c.",
                7 => "8) Xu hÆ°á»›ng chuyá»ƒn tráº¡ng thÃ¡i: Thá»‘ng kÃª 6 chuyá»ƒn gáº§n nháº¥t giá»¯a cÃ¡c vÃ¡n ('láº·p' vs 'Ä‘áº£o'); náº¿u 'Ä‘áº£o' nhiá»u hÆ¡n â†’ Ä‘Ã¡nh ngÆ°á»£c vÃ¡n cuá»‘i; ngÆ°á»£c láº¡i â†’ theo vÃ¡n cuá»‘i; Ä‘Ã¡nh liÃªn tá»¥c.",
                8 => "9) Run-length (dÃ i chuá»—i): TÃ­nh Ä‘á»™ dÃ i chuá»—i kÃ½ tá»± cuá»‘i; náº¿u run â‰¥ T (máº·c Ä‘á»‹nh T=3) â†’ Ä‘áº£o Ä‘á»ƒ mean-revert; náº¿u run ngáº¯n â†’ theo Ä‘Ã  (momentum); Ä‘Ã¡nh liÃªn tá»¥c.",
                9 => "10) ChuyÃªn gia bá» phiáº¿u: Káº¿t há»£p 5 chuyÃªn gia (theo-last, Ä‘áº£o-last, run-length, transition, AI-stat); chá»n phÃ­a Ä‘a sá»‘; hÃ²a â†’ Ä‘áº£o; Ä‘Ã¡nh liÃªn tá»¥c Ä‘á»ƒ phá»§ nhiá»u ká»‹ch báº£n.",
                10 => "11) Lá»‹ch cháº» 10 tay: Tay 1â€“5 theo vÃ¡n cuá»‘i, tay 6â€“10 Ä‘áº£o vÃ¡n cuá»‘i; láº·p láº¡i block cá»‘ Ä‘á»‹nh; Ä‘Æ¡n giáº£n, dá»… dá»± bÃ¡o nhá»‹p.",
                11 => "12) KNN chuá»—i con: So khá»›p gáº§n Ä‘Ãºng tail k (k=6..3) vá»›i Hamming â‰¤ 1; exact-match tÃ­nh 2 Ä‘iá»ƒm, near-match 1 Ä‘iá»ƒm; chá»n phÃ­a Ä‘iá»ƒm cao hÆ¡n; hÃ²a â†’ Ä‘áº£o; khÃ´ng match â†’ theo vÃ¡n cuá»‘i; Ä‘Ã¡nh liÃªn tá»¥c.",
                12 => "13) Lá»‹ch hai lá»›p: Lá»‹ch pha trá»™n 10 bÆ°á»›c (1â€“3 theo-last, 4 Ä‘áº£o, 5â€“7 AI-stat, 8 Ä‘áº£o, 9 theo, 10 AI-stat); láº·p láº¡i; cÃ¢n báº±ng giá»¯a momentum/mean-revert/thá»‘ng kÃª; Ä‘Ã¡nh liÃªn tá»¥c.",
                13 => "14) AI há»c táº¡i chá»— (n-gram): Há»c dáº§n tá»« káº¿t quáº£ tháº­t; dÃ¹ng táº§n suáº¥t cÃ³ lÃ m má»‹n + backoff; hÃ²a â†’ Ä‘áº£o 1â€“1; bá»™ nhá»› cá»‘ Ä‘á»‹nh, khÃ´ng phÃ¬nh.",
                14 => "15) Bá» phiáº¿u Top10 cÃ³ Ä‘iá»u kiá»‡n; Loss-Guard Ä‘á»™ng; Hard-guard tá»± báº­t khi Lâ‰¥5 vÃ  tá»± gá»¡ khi tháº¯ng 2 vÃ¡n liÃªn tá»¥c hoáº·c w20>55%; hÃ²a 5â€“5 Ä‘Ã¡nh ngáº«u nhiÃªn; 6â€“4 nhÆ°ng conf<0.60 thÃ¬ fallback theo Regime (ZIGZAG=ZigFollow, cÃ²n láº¡i=FollowPrev). Æ¯u tiÃªn â€œÄƒn trendâ€ khi guard ON. Re-seed sau má»—i vÃ¡n (tá»‘i Ä‘a 50 tay)",
                15 => "16) TOP10 TÃCH LÅ¨Y (khá»Ÿi tá»« 50 C/L). Khá»Ÿi táº¡o thá»‘ng kÃª tá»« 50 káº¿t quáº£ Ä‘áº§u vÃ o (C/L). Má»—i káº¿t quáº£ má»›i: cá»™ng dá»“n cho chuá»—i dÃ i 10 â€œmá»›i vá»â€. LuÃ´n Ä‘Ã¡nh theo chuá»—i cÃ³ bá»™ Ä‘áº¿m lá»›n nháº¥t; chá»‰ chuyá»ƒn chuá»—i khi THáº®NG vÃ  chuá»—i má»›i cÃ³ Ä‘áº¿m â‰¥ hiá»‡n táº¡i.",
                16 => "17) ÄÃ¡nh cÃ¡c cá»­a Äƒn ná»• hÅ©: Äá»c cáº¥u hÃ¬nh \"Cá»­a Ä‘áº·t & tá»‰ lá»‡\", nhÃ¢n tá»‰ lá»‡ vá»›i má»©c tiá»n hiá»‡n táº¡i Ä‘á»ƒ Ä‘áº·t tá»‘i Ä‘a 7 cá»­a (CHAN/LE/SAPDOI/1TRANG3DO/1DO3TRANG/4DO/4TRANG); tháº¯ng náº¿u báº¥t ká»³ cá»­a nÃ o trÃºng theo chuá»—i káº¿t quáº£ 0/1/2/3/4.",
                17 => "18) Chuá»—i cáº§u C/L hay vá»: Tá»± phÃ¢n tÃ­ch seq 52 kÃ½ tá»±, loáº¡i máº«u Ä‘Ã£ xuáº¥t hiá»‡n (theo quy táº¯c Ä‘áº£o); chá»n ngáº«u nhiÃªn má»™t máº«u cÃ²n láº¡i Ä‘á»ƒ Ä‘Ã¡nh; háº¿t chuá»—i thÃ¬ tÃ¬m láº¡i; khÃ´ng cÃ²n máº«u thÃ¬ Ä‘Ã¡nh ngáº«u nhiÃªn.",
                _ => "Chiáº¿n lÆ°á»£c chÆ°a xÃ¡c Ä‘á»‹nh."
            };

            if (CmbBetStrategy != null)
            {
                CmbBetStrategy.ToolTip = tip;

                // Tuá»³ chá»n: tinh chá»‰nh thá»i gian hiá»ƒn thá»‹ tooltip
                System.Windows.Controls.ToolTipService.SetShowDuration(CmbBetStrategy, 20000);
                System.Windows.Controls.ToolTipService.SetInitialShowDelay(CmbBetStrategy, 300);
            }

            // Náº¿u cÃ³ label/panel bao ngoÃ i (vÃ­ dá»¥ LblBetStrategy hoáº·c GridBetStrategy), set kÃ¨m:
            AttachTip(CmbBetStrategy, tip);
            // ==== Káº¾T THÃšC: Tooltip cho chiáº¿n lÆ°á»£c Ä‘áº·t cÆ°á»£c ====
        }

        private static string GetStrategyTooltipText(int idx)
        {
            return idx switch
            {
                0 => "1) Chuá»—i C/L tá»± nháº­p: So khá»›p chuá»—i C/L cáº¥u hÃ¬nh thá»§ cÃ´ng (cÅ©â†’má»›i); khi khá»›p máº«u gáº§n nháº¥t sáº½ Ä‘áº·t theo cá»­a chá»‰ Ä‘á»‹nh; khÃ´ng khá»›p dÃ¹ng logic máº·c Ä‘á»‹nh.",
                1 => "2) Tháº¿ cáº§u C/L tá»± nháº­p: Ãnh xáº¡ 'máº«u quÃ¡ khá»© â†’ cá»­a káº¿ tiáº¿p' theo danh sÃ¡ch quy táº¯c; Æ°u tiÃªn máº«u dÃ i vÃ  khá»›p gáº§n nháº¥t; há»— trá»£ ',', ';', '|', hoáº·c xuá»‘ng dÃ²ng.",
                2 => "3) Chuá»—i I/N: So khá»›p dÃ£y Ãt/Nhiá»u (I/N) cáº¥u hÃ¬nh thá»§ cÃ´ng; khá»›p thÃ¬ Ä‘áº·t theo chá»‰ Ä‘á»‹nh; khÃ´ng khá»›p dÃ¹ng logic máº·c Ä‘á»‹nh.",
                3 => "4) Tháº¿ cáº§u I/N: Ãnh xáº¡ máº«u I/N â†’ cá»­a káº¿ tiáº¿p; Æ°u tiÃªn máº«u dÃ i; cho phÃ©p nhiá»u luáº­t trong cÃ¹ng danh sÃ¡ch.",
                4 => "5) Theo cáº§u trÆ°á»›c (thÃ´ng minh): Dá»±a vÃ o vÃ¡n gáº§n nháº¥t vÃ  heuristics ná»™i bá»™; Ä‘Ã¡nh liÃªn tá»¥c; quáº£n lÃ½ vá»‘n theo chuá»—i tiá»n, cut_profit/cut_loss.",
                5 => "6) Cá»­a Ä‘áº·t ngáº«u nhiÃªn: Má»—i vÃ¡n chá»n CHáº´N/Láºº ngáº«u nhiÃªn; váº«n tuÃ¢n theo MoneyManager vÃ  ngÆ°á»¡ng cáº¯t lÃ£i/lá»—.",
                6 => "7) BÃ¡m cáº§u C/L (thá»‘ng kÃª): Duyá»‡t k tá»« lá»›nâ†’nhá» (k=6 máº·c Ä‘á»‹nh); Ä‘áº¿m táº§n suáº¥t C/L sau cÃ¡c láº§n khá»›p Ä‘uÃ´i; chá»n phÃ­a Ä‘a sá»‘; hÃ²a â†’ Ä‘áº£o 1â€“1; khÃ´ng cÃ³ máº«u â†’ theo vÃ¡n cuá»‘i; Ä‘Ã¡nh liÃªn tá»¥c.",
                7 => "8) Xu hÆ°á»›ng chuyá»ƒn tráº¡ng thÃ¡i: Thá»‘ng kÃª 6 chuyá»ƒn gáº§n nháº¥t giá»¯a cÃ¡c vÃ¡n ('láº·p' vs 'Ä‘áº£o'); náº¿u 'Ä‘áº£o' nhiá»u hÆ¡n â†’ Ä‘Ã¡nh ngÆ°á»£c vÃ¡n cuá»‘i; ngÆ°á»£c láº¡i â†’ theo vÃ¡n cuá»‘i; Ä‘Ã¡nh liÃªn tá»¥c.",
                8 => "9) Run-length (dÃ i chuá»—i): TÃ­nh Ä‘á»™ dÃ i chuá»—i kÃ½ tá»± cuá»‘i; náº¿u run â‰¥ T (máº·c Ä‘á»‹nh T=3) â†’ Ä‘áº£o Ä‘á»ƒ mean-revert; náº¿u run ngáº¯n â†’ theo Ä‘Ã  (momentum); Ä‘Ã¡nh liÃªn tá»¥c.",
                9 => "10) ChuyÃªn gia bá» phiáº¿u: Káº¿t há»£p 5 chuyÃªn gia (theo-last, Ä‘áº£o-last, run-length, transition, AI-stat); chá»n phÃ­a Ä‘a sá»‘; hÃ²a â†’ Ä‘áº£o; Ä‘Ã¡nh liÃªn tá»¥c Ä‘á»ƒ phá»§ nhiá»u ká»‹ch báº£n.",
                10 => "11) Lá»‹ch cháº» 10 tay: Tay 1â€“5 theo vÃ¡n cuá»‘i, tay 6â€“10 Ä‘áº£o vÃ¡n cuá»‘i; láº·p láº¡i block cá»‘ Ä‘á»‹nh; Ä‘Æ¡n giáº£n, dá»… dá»± bÃ¡o nhá»‹p.",
                11 => "12) KNN chuá»—i con: So khá»›p gáº§n Ä‘Ãºng tail k (k=6..3) vá»›i Hamming â‰¤ 1; exact-match tÃ­nh 2 Ä‘iá»ƒm, near-match 1 Ä‘iá»ƒm; chá»n phÃ­a Ä‘iá»ƒm cao hÆ¡n; hÃ²a â†’ Ä‘áº£o; khÃ´ng match â†’ theo vÃ¡n cuá»‘i; Ä‘Ã¡nh liÃªn tá»¥c.",
                12 => "13) Lá»‹ch hai lá»›p: Lá»‹ch pha trá»™n 10 bÆ°á»›c (1â€“3 theo-last, 4 Ä‘áº£o, 5â€“7 AI-stat, 8 Ä‘áº£o, 9 theo, 10 AI-stat); láº·p láº¡i; cÃ¢n báº±ng giá»¯a momentum/mean-revert/thá»‘ng kÃª; Ä‘Ã¡nh liÃªn tá»¥c.",
                13 => "14) AI há»c táº¡i chá»— (n-gram): Há»c dáº§n tá»« káº¿t quáº£ tháº­t; dÃ¹ng táº§n suáº¥t cÃ³ lÃ m má»‹n + backoff; hÃ²a â†’ Ä‘áº£o 1â€“1; bá»™ nhá»› cá»‘ Ä‘á»‹nh, khÃ´ng phÃ¬nh.",
                14 => "15) Bá» phiáº¿u Top10 cÃ³ Ä‘iá»u kiá»‡n; Loss-Guard Ä‘á»™ng; Hard-guard tá»± báº­t khi Lâ‰¥5 vÃ  tá»± gá»¡ khi tháº¯ng 2 vÃ¡n liÃªn tá»¥c hoáº·c w20>55%; hÃ²a 5â€“5 Ä‘Ã¡nh ngáº«u nhiÃªn; 6â€“4 nhÆ°ng conf<0.60 thÃ¬ fallback theo Regime (ZIGZAG=ZigFollow, cÃ²n láº¡i=FollowPrev). Æ¯u tiÃªn â€œÄƒn trendâ€ khi guard ON. Re-seed sau má»—i vÃ¡n (tá»‘i Ä‘a 50 tay)",
                15 => "16) TOP10 TÃCH LÅ¨Y (khá»Ÿi tá»« 50 C/L). Khá»Ÿi táº¡o thá»‘ng kÃª tá»« 50 káº¿t quáº£ Ä‘áº§u vÃ o (C/L). Má»—i káº¿t quáº£ má»›i: cá»™ng dá»“n cho chuá»—i dÃ i 10 â€œmá»›i vá»â€. LuÃ´n Ä‘Ã¡nh theo chuá»—i cÃ³ bá»™ Ä‘áº¿m lá»›n nháº¥t; chá»‰ chuyá»ƒn chuá»—i khi THáº®NG vÃ  chuá»—i má»›i cÃ³ Ä‘áº¿m â‰¥ hiá»‡n táº¡i.",
                16 => "17) ÄÃ¡nh cÃ¡c cá»­a Äƒn ná»• hÅ©: Äá»c cáº¥u hÃ¬nh \"Cá»­a Ä‘áº·t & tá»‰ lá»‡\", nhÃ¢n tá»‰ lá»‡ vá»›i má»©c tiá»n hiá»‡n táº¡i Ä‘á»ƒ Ä‘áº·t tá»‘i Ä‘a 7 cá»­a (CHAN/LE/SAPDOI/1TRANG3DO/1DO3TRANG/4DO/4TRANG); tháº¯ng náº¿u báº¥t ká»³ cá»­a nÃ o trÃºng theo chuá»—i káº¿t quáº£ 0/1/2/3/4.",
                17 => "18) Chuá»—i cáº§u C/L hay vá»: Tá»± phÃ¢n tÃ­ch seq 52 kÃ½ tá»±, loáº¡i máº«u Ä‘Ã£ xuáº¥t hiá»‡n (theo quy táº¯c Ä‘áº£o); chá»n ngáº«u nhiÃªn má»™t máº«u cÃ²n láº¡i Ä‘á»ƒ Ä‘Ã¡nh; háº¿t chuá»—i thÃ¬ tÃ¬m láº¡i; khÃ´ng cÃ²n máº«u thÃ¬ Ä‘Ã¡nh ngáº«u nhiÃªn.",
                _ => "Chiáº¿n lÆ°á»£c chÆ°a xÃ¡c Ä‘á»‹nh."
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
                var res = await ClickLoginButtonAsync(18000);
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

        // ====== Click login (Æ°u tiÃªn selector báº¡n cung cáº¥p) + poll tráº¡ng thÃ¡i ======
        private async Task<string> ClickLoginButtonAsync(int timeoutMs = 18000)
        {
            await EnsureWebReadyAsync();

            // 1) Báº¥m nÃºt ÄÄƒng nháº­p theo selector header cá»§a NET88
            string clickKnownJs =
        @"(function(){
  try{
    const sel1 = '#page > header > div > div > div.d-flex.align-items-center.justify-content-between.w-100 > div > div > button.base-button.btn.base-button--bg-crimson-fill';
    const sel2 = 'button.base-button.btn.base-button--bg-crimson-fill';
    let btn = document.querySelector(sel1) || document.querySelector(sel2);
    if(!btn) return 'no-el';

    const vis = el => { if(!el) return false; const r=el.getBoundingClientRect(), cs=getComputedStyle(el);
      return r.width>4 && r.height>4 && cs.display!=='none' && cs.visibility!=='hidden' && cs.pointerEvents!=='none'; };

    function fire(el){
      if(!el) return false;
      try{ el.scrollIntoView({block:'center', inline:'center'}); }catch(_){}
      const r = el.getBoundingClientRect();
      const cx = Math.max(0, Math.floor(r.left + r.width/2));
      const cy = Math.max(0, Math.floor(r.top  + r.height/2));
      const top = document.elementFromPoint(cx, cy) || el;
      const seq = ['pointerover','mouseover','pointerenter','mouseenter','pointerdown','mousedown','pointerup','mouseup','click'];
      for(const t of seq){
        top.dispatchEvent(new MouseEvent(t,{bubbles:true,cancelable:true,clientX:cx,clientY:cy,view:window}));
      }
      try{ top.click(); }catch(_){}
      return true;
    }

    // nhiá»u site gÃ¡n handler á»Ÿ content bÃªn trong
    const target = btn.querySelector('.base-button--content') || btn;
    if(!vis(target)) return 'not-visible';
    fire(target);
    return 'clicked-known';
  }catch(e){ return 'err:'+e; }
})();";

            var clickRes = await ExecJsAsyncStr(clickKnownJs);
            Log("[ClickLoginKnown] " + (string.IsNullOrEmpty(clickRes) ? "<empty>" : clickRes));

            // Náº¿u chÆ°a tÃ¬m Ä‘Æ°á»£c button theo selector báº¡n Ä‘Æ°a, thá»­ generic cÃ¡c form/iframe nhÆ° cÅ©
            if (clickRes == "no-el" || clickRes == "not-visible")
            {
                string clickFallbackJs =
        @"(function(){
  try{
    const rm=s=>{try{return (s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'');}catch(_){return s||'';}};
    const low=s=>rm(String(s||'').trim().toLowerCase());
    const vis=el=>{if(!el)return false;const r=el.getBoundingClientRect(),cs=getComputedStyle(el);
                   return r.width>4&&r.height>4&&cs.display!=='none'&&cs.visibility!=='hidden'&&cs.pointerEvents!=='none';};
    const qa=(s,d)=>Array.from((d||document).querySelectorAll(s));

    function fire(el){
      if(!el) return false;
      try{ el.scrollIntoView({block:'center', inline:'center'}); }catch(_){}
      const r=el.getBoundingClientRect(), x=r.left+r.width/2, y=r.top+r.height/2;
      const seq=['pointerdown','mousedown','pointerup','mouseup','click'];
      for(const t of seq){ el.dispatchEvent(new MouseEvent(t,{bubbles:true,cancelable:true,clientX:x,clientY:y,view:window})); }
      try{ el.click(); }catch(_){}
      return true;
    }
    function findInputs(d){
      const pass=d.querySelector('input[type=""password""],input[autocomplete=""current-password""]');
      const user=d.querySelector('input[autocomplete=""username""],input[name*=""user"" i],input[type=""text""],input[type=""email""]');
      return {user,pass};
    }
    function tryFormSubmit(d){
      const {user,pass}=findInputs(d);
      let form=(pass&&pass.form)?pass.form:(pass?pass.closest('form'):null);
      if(!form && user) form=user.closest('form');
      if(!form) return false;
      const btn = form.querySelector('button[type=""submit""],input[type=""submit""]') ||
                  form.querySelector('button,.btn,.base-button,.el-button');
      if(btn && vis(btn) && fire(btn)) return 'clicked-submit';
      try{ if(form.requestSubmit){ form.requestSubmit(); return 'requestSubmit'; } }catch(_){}
      try{ form.submit(); return 'form-submit'; }catch(_){}
      return false;
    }
    function pressEnterOnPass(d){
      const pass = d.querySelector('input[type=""password""],input[autocomplete=""current-password""]');
      if(!pass || !vis(pass)) return false;
      pass.focus();
      const evt = new KeyboardEvent('keydown',{key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true});
      try{ pass.dispatchEvent(evt); }catch(_){}
      return 'pressed-enter';
    }
    function clickGlobalLogin(d){
      const cand = qa('a,button,[role=""button""],.btn,.base-button,.el-button', d)
        .find(el=>vis(el)&&/dang\\s*nhap|Ä‘Äƒng\\s*nháº­p|login|sign\\s*in/i.test(low(el.textContent)||low(el.value)));
      return cand && fire(cand) ? 'clicked-global' : false;
    }

    const frames=[window].concat(Array.from(document.querySelectorAll('iframe'))
                   .map(i=>{try{return i.contentWindow;}catch(_){return null;}}).filter(Boolean));

    for(const w of frames){ try{ const r=tryFormSubmit(w.document); if(r) return String(r); }catch(_){ } }
    for(const w of frames){ try{ const r=pressEnterOnPass(w.document); if(r) return String(r); }catch(_){ } }
    const g = clickGlobalLogin(document); if(g) return String(g);

    return 'no-login-button';
  }catch(e){ return 'err:'+e; }
})();";
                var r2 = await ExecJsAsyncStr(clickFallbackJs);
                Log("[ClickLoginFallback] " + r2);
                clickRes = r2;
            }

            if (clickRes.StartsWith("err")) return clickRes;
            if (clickRes == "no-login-button" || clickRes == "not-visible") return clickRes;

            // 2) Poll tráº¡ng thÃ¡i Ä‘Äƒng nháº­p
            var t0 = DateTime.UtcNow;
            while ((DateTime.UtcNow - t0).TotalMilliseconds < timeoutMs)
            {
                string stateJs =
        @"(function(){
  try{
    const rm=s=>{try{return (s||'').normalize('NFD').replace(/[\u0300-\\u036f]/g,'');}catch(_){return s||'';}};
    const low=s=>rm(String(s||'').trim().toLowerCase());
    const vis=el=>{if(!el)return false;const r=el.getBoundingClientRect(),cs=getComputedStyle(el);
                   return r.width>4&&r.height>4&&cs.display!=='none'&&cs.visibility!=='hidden'&&cs.pointerEvents!=='none';};
    const qa=(s,d)=>Array.from((d||document).querySelectorAll(s));
    const hasLogout = qa('a,button,[role=""button""],.btn,.base-button')
        .some(el => /dang\\s*xuat|Ä‘Äƒng\\s*xuáº¥t|logout|sign\\s*out/i.test(low(el.textContent)));
    const hasLogin  = qa('a,button,[role=""button""],.btn,.base-button')
        .some(el => vis(el) && /dang\\s*nhap|Ä‘Äƒng\\s*nháº­p|login|sign\\s*in/i.test(low(el.textContent)));
    let passVisible = false;
    try{
      const frames=[window].concat(Array.from(document.querySelectorAll('iframe'))
                      .map(i=>{try{return i.contentWindow;}catch(_){return null;}}).filter(Boolean));
      for(const w of frames){
        try{
          const arr = Array.from(w.document.querySelectorAll('input[type=""password""]'));
          if (arr.some(el=>vis(el))) { passVisible = true; break; }
        }catch(_){}
      }
    }catch(_){}
    return (hasLogout || (!hasLogin && !passVisible)) ? '1' : '0';
  }catch(e){ return 'err:'+e; }
})();";
                var ok = await ExecJsAsyncStr(stateJs);
                if (ok == "1") return "login-ok";
                await Task.Delay(250);
            }
            return "login-timeout";
        }


        // Gá»i Login tá»« HOME:
        // - Æ¯u tiÃªn gá»i API JS (__abx_hw_clickLogin)
        // - Fallback: gá»­i lá»‡nh kiá»ƒu "áº¥n nÃºt" xuá»‘ng trang (home_click_login)
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

                // fallback: gá»i theo "nÃºt" (host -> page)
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

        // Gá»i Play XÃ³c ÄÄ©a tá»« HOME:
        // - Æ¯u tiÃªn gá»i API JS (__abx_hw_clickPlayXDL)
        // - Fallback: gá»­i lá»‡nh kiá»ƒu "nÃºt" (home_click_xoc)
        private async Task<bool> HomeClickPlayAsync()
        {
            try
            {
                await EnsureWebReadyAsync();
                var r = await Web.CoreWebView2.ExecuteScriptAsync(
                    "(typeof window.__abx_hw_clickPlayXDL==='function') ? window.__abx_hw_clickPlayXDL() : 'no-fn';"
                ) ?? "\"\"";
                if (r.Contains("ok", StringComparison.OrdinalIgnoreCase))
                {
                    Log("[HOME] play via JS: ok");
                    return true;
                }

                // fallback: gá»i theo "nÃºt" (host -> page)
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

        // (tuá»³ chá»n) kÃ­ch hoáº¡t push thá»§ cÃ´ng tá»« C# vá»›i ms tÃ¹y Ã½
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
            // náº¿u cá»­a sá»• Ä‘Ã£ bá»‹ host Ä‘Ã³ng thÃ¬ Web sáº½ = null
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
                        if (s.Length > 2000) s = s.Substring(0, 2000) + "â€¦";
                        return s;
                    }
                    if (s.Length > 2000) s = s.Substring(0, 2000) + "â€¦";
                    return s;
                }
                var bytes = Encoding.UTF8.GetBytes(payload);
                int n = Math.Min(bytes.Length, 64);
                var sb = new StringBuilder(n * 3);
                for (int i = 0; i < n; i++) sb.Append(bytes[i].ToString("X2")).Append(' ');
                if (bytes.Length > n) sb.Append("â€¦");
                return "BIN[" + bytes.Length + "]: " + sb.ToString();
            }
            catch
            {
                var s = payload;
                if (s.Length > 2000) s = s.Substring(0, 2000) + "â€¦";
                return s;
            }
        }

        private void LogPacket(string kind, string? url, string preview, bool isBinary)
        {
            var line = $"[PKT] {DateTime.Now:HH:mm:ss} {kind} {url ?? ""}\n      {preview}";
            // Ghi file luÃ´n (khÃ´ng cháº·n)
            EnqueueFile(line);

            // UI: máº·c Ä‘á»‹nh táº¯t, hoáº·c láº¥y máº«u 1/N
            if (SHOW_PACKET_LINES_IN_UI)
            {
                _pktUiSample++;
                if (_pktUiSample % PACKET_UI_SAMPLE_EVERY_N == 0)
                    EnqueueUi(line);
            }
        }


        /// <summary>
        /// Má»Ÿ live theo index trong .livestream-section__live (0-based).
        /// Chá»‰ nháº¯m Ä‘Ãºng item-live[index], click overlay/play vÃ  chá» video má»Ÿ.
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

    // báº¯n sá»± kiá»‡n + click 2 láº§n Ä‘á»ƒ vÆ°á»£t overlay
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

  // Chá» item mount vÃ  visible, rá»“i click
  const t0 = Date.now();
  while((Date.now()-t0) < timeoutMs){{
    const it = pickByIndex(idx);
    if(it && isVis(it)){{
      const w = it.querySelector('.player-wrapper') || it;
      fireAll(w);

      // chá» má»Ÿ
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


        // Báº¥m vÃ o "XÃ³c ÄÄ©a Live" theo tiÃªu Ä‘á»/trang HOME.
        // Tráº£ vá»: "clicked" náº¿u Ä‘Ã£ báº¥m/má»Ÿ Ä‘Æ°á»£c, hoáº·c chuá»—i lá»—i/tráº¡ng thÃ¡i khÃ¡c.
        private async Task<string> ClickXocDiaTitleAsync(int timeoutMs = 20000)
        {
            if (Web == null) return "web-null";
            await EnsureWebReadyAsync();

            // 1) Thá»­ báº¥m trá»±c tiáº¿p anchor/button cÃ³ text "xÃ³c Ä‘Ä©a" (khá»­ dáº¥u)
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

    // QuÃ©t cÃ¡c anchor/button
    const cands = qa('a,button,[role=""button""],.btn,.base-button,.el-button,.v-btn, .item-live a, .item-live .title, .item-live');
    for(const el of cands){
      const txt = low(el.textContent || el.innerText || el.getAttribute('aria-label') || el.getAttribute('title') || '');
      if (!txt) continue;
      // cáº§n Ä‘á»“ng thá»i cÃ³ 'xoc' vÃ  'dia'
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

            // 2) KhÃ´ng cÃ³ anchor rÃµ rÃ ng -> tÃ¬m index trong danh sÃ¡ch .livestream-section__live .item-live
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

            // 3) Fallback cuá»‘i: má»Ÿ item index 1 (giá»‘ng VaoXocDia_Click Ä‘ang dÃ¹ng)
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
                MessageBox.Show("ChÆ°a nháº­p tÃªn Ä‘Äƒng nháº­p.", "Automino",
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
                MessageBox.Show("ChÆ°a nháº­p máº­t kháº©u.", "Automino",
                    MessageBoxButton.OK, MessageBoxImage.Warning);
                return false;
            }

            var lic = await FetchLicenseAsync(username);
            if (lic == null)
            {
                MessageBox.Show("KhÃ´ng tÃ¬m tháº¥y license cho tÃ i khoáº£n nÃ y. HÃ£y liÃªn há»‡ Telegram: @minoauto Ä‘á»ƒ Ä‘Äƒng kÃ½ sá»­ dá»¥ng.",
                    "Automino", MessageBoxButton.OK, MessageBoxImage.Warning);
                return false;
            }
            if (string.IsNullOrWhiteSpace(lic.exp) || string.IsNullOrWhiteSpace(lic.pass) ||
                !DateTimeOffset.TryParse(lic.exp, out var expUtc))
            {
                MessageBox.Show("License khÃ´ng há»£p lá»‡ (exp/pass).", "Automino",
                    MessageBoxButton.OK, MessageBoxImage.Warning);
                return false;
            }
            if (!string.Equals(lic.pass ?? "", password, StringComparison.Ordinal))
            {
                MessageBox.Show("Máº­t kháº©u license khÃ´ng Ä‘Ãºng.", "Automino",
                    MessageBoxButton.OK, MessageBoxImage.Warning);
                return false;
            }
            if (DateTimeOffset.UtcNow >= expUtc)
            {
                MessageBox.Show("Tool cá»§a báº¡n háº¿t háº¡n. HÃ£y liÃªn há»‡ Telegram: @minoauto Ä‘á»ƒ gia háº¡n",
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
                MessageBox.Show("KhÃ´ng xÃ¡c Ä‘á»‹nh Ä‘Æ°á»£c DeviceId Ä‘á»ƒ dÃ¹ng thá»­.", "Automino",
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
                    MessageBox.Show("Cháº¿ Ä‘á»™ dÃ¹ng thá»­ cáº§n Cloudflare. Vui lÃ²ng báº­t láº¡i Ä‘á»ƒ dÃ¹ng thá»­.", "Automino",
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
                    MessageBox.Show("Thiáº¿t bá»‹ Ä‘ang cháº¡y á»Ÿ nÆ¡i khÃ¡c. Vui lÃ²ng dá»«ng á»Ÿ mÃ¡y kia trÆ°á»›c.",
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
                    MessageBox.Show("KhÃ´ng thá»ƒ báº¯t Ä‘áº§u cháº¿ Ä‘á»™ dÃ¹ng thá»­. Vui lÃ²ng thá»­ láº¡i.",
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
                MessageBox.Show("KhÃ´ng thá»ƒ káº¿t ná»‘i cháº¿ Ä‘á»™ dÃ¹ng thá»­.", "Automino",
                    MessageBoxButton.OK, MessageBoxImage.Warning);
                return false;
            }
        }


        private async void VaoXocDia_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                _cfg.UseTrial = false;
                if (ChkTrial != null) ChkTrial.IsChecked = false;
                await SaveConfigAsync();
                await EnsureWebReadyAsync();

                if (!await EnsureLicenseAsync())
                    return;
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
            }
            catch (Exception ex)
            {
                _cfg.UseTrial = false;
                if (ChkTrial != null) ChkTrial.IsChecked = false;
                Log("[BtnTrialTool_Click] " + ex);
            }
        }


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
                        // KhÃ´ng Ä‘á»§ thÃ´ng tin thÃ¬ thÃ´i
                        var u = T(TxtUser);
                        var p = P(TxtPass);
                        if (string.IsNullOrWhiteSpace(u) || string.IsNullOrWhiteSpace(p))
                        {
                            await Task.Delay(500, cts.Token);
                            continue;
                        }

                        // JS: phÃ¡t hiá»‡n â€œcáº§n loginâ€ (nÃºt ÄÄƒng nháº­p visible hoáº·c Ã´ user/pass visible trong báº¥t ká»³ iframe nÃ o)
                        string needJs =
        @"(function(){
  const rm=s=>{try{return (s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'');}catch(_){return s||'';}};
  const low=s=>rm(String(s||'').trim().toLowerCase());
  const vis=el=>{if(!el)return false;const r=el.getBoundingClientRect(),cs=getComputedStyle(el);
                 return r.width>4&&r.height>4&&cs.display!=='none'&&cs.visibility!=='hidden'&&cs.pointerEvents!=='none';};
  const qa=(s,d)=>Array.from((d||document).querySelectorAll(s));

  const hasLogin = qa('a,button,[role=""button""],.btn,.base-button')
     .some(el => vis(el) && /dang\\s*nhap|Ä‘Äƒng\\s*nháº­p|login|sign\\s*in/i.test(low(el.textContent)||low(el.value)));

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
                                    Log("[AutoLoginWatch] need-login â†’ auto-fill + click"); // hÃ m nÃ y Ä‘Ã£ cÃ³ fallback vÃ  tá»± gá»i TryAutoLoginAsync
                                                                // Trong trÆ°á»ng há»£p trang khÃ´ng má»Ÿ form, Ã©p Click thÃªm láº§n ná»¯a:
                                    var res = await ClickLoginButtonAsync(18000);
                                    Log("[AutoLoginWatch] " + res);
                                    _autoLoginLast = DateTime.UtcNow;
                                }
                                catch (Exception ex) { Log("[AutoLoginWatch] " + ex); }
                                finally { _autoLoginBusy = false; }
                            }
                        }
                    }
                    catch { }
                    await Task.Delay(400, cts.Token); // nhá»‹p kiá»ƒm tra
                }
            }, cts.Token);
        }

        private void StopAutoLoginWatcher()
        {
            try { _autoLoginWatchCts?.Cancel(); } catch { }
            _autoLoginWatchCts = null;
        }

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
                _domHooked = false;
                _navModeHooked = false;

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

            Log("[WV2] Watchdog: khÃ´ng tháº¥y game tick, reset profile + reload");
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














        // Vá» trang chá»§ NET88 (Nuxt/Vue) â€“ click logo + dá»n overlay + Ã©p SPA + Ã©p Ä‘iá»u hÆ°á»›ng + fallback C#
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
      // Nuxt/Vue: logo active khi Ä‘ang á»Ÿ /
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
        // overlap Ä‘Æ¡n giáº£n
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
      // 2) Popstate Ä‘á»ƒ kÃ­ch SPA
      try{ history.replaceState({},'', '/'); dispatchEvent(new PopStateEvent('popstate')); }catch(_){}
      // 3) Äiá»u hÆ°á»›ng cá»©ng
      try{ location.replace(home); }catch(_){}
    }

    // ---- cháº¡y ----
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

                // Fallback cuá»‘i tá»« C#: náº¿u JS khÃ´ng Ä‘iá»u hÆ°á»›ng Ä‘Æ°á»£c, tá»± Ä‘iá»u hÆ°á»›ng vá» origin + "/"
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
                    catch { /* bá» qua */ }
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
            // chuáº©n hoÃ¡ xuá»‘ng dÃ²ng
            var lines = csv.Replace("\r", "").Split('\n');

            var flat = new System.Collections.Generic.List<long>();

            foreach (var rawLine in lines)
            {
                var line = (rawLine ?? "").Trim();
                if (line.Length == 0) continue;

                // giá»‘ng nghiá»‡p vá»¥ cÅ©: tÃ¡ch theo , ; - khoáº£ng tráº¯ng
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
                        // náº¿u cÃ³ sá»‘ sai thÃ¬ bá» qua giá»‘ng cÃ¡ch cÅ©, hoáº·c báº¡n cÃ³ thá»ƒ show lá»—i á»Ÿ LblSeqError
                    }
                }

                if (oneChain.Count > 0)
                {
                    _stakeChains.Add(oneChain.ToArray());
                    flat.AddRange(oneChain);
                }
            }

            // náº¿u user chá»‰ nháº­p 1 dÃ²ng nhÆ° cÅ© thÃ¬ _stakeChains sáº½ chá»‰ cÃ³ 1 pháº§n tá»­
            _stakeSeq = flat.Count > 0 ? flat.ToArray() : new long[] { 1000 };

            // tÃ­nh tá»•ng tá»«ng chuá»—i Ä‘á»ƒ dÃ¹ng cho Ä‘iá»u kiá»‡n â€œchuá»—i sau tháº¯ng >= tá»•ng chuá»—i trÆ°á»›câ€
            _stakeChainTotals = _stakeChains
                .Select(ch => ch.Aggregate(0L, (s, x) => s + x))
                .ToArray();

            // cáº­p nháº­t UI hiá»ƒn thá»‹ lá»—i náº¿u cáº§n
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
                _cfg.StakeCsv = csv; // váº«n lÆ°u báº£n hiá»‡n hÃ nh
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
            var def = TaiXiuLiveSun.Tasks.SideRateParser.DefaultText;
            if (TxtSideRatio != null)
                TxtSideRatio.Text = def;

            _cfg.SideRateText = def;
            await SaveConfigAsync();
            ShowErrorsForCurrentStrategy();
        }

        private void UpdateBetStrategyUi()
        {
            try
            {
                var idx = CmbBetStrategy?.SelectedIndex ?? 4;
                if (RowChuoiCau != null)
                    RowChuoiCau.Visibility = (idx == 0 || idx == 2) ? Visibility.Visible : Visibility.Collapsed; // 1 hoáº·c 3
                if (RowTheCau != null)
                    RowTheCau.Visibility = (idx == 1 || idx == 3) ? Visibility.Visible : Visibility.Collapsed;   // 2 hoáº·c 4
                if (RowSideRatio != null)
                    RowSideRatio.Visibility = (idx == 16) ? Visibility.Visible : Visibility.Collapsed;
            }
            catch { }
        }

        async void CmbBetStrategy_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            UpdateBetStrategyUi();
            SyncStrategyFieldsToUI();
            UpdateTooltips();
            ShowErrorsForCurrentStrategy();   // <â€” thÃªm dÃ²ng nÃ y

            if (!_uiReady || _tabSwitching) return;
            _cfg.BetStrategyIndex = CmbBetStrategy?.SelectedIndex ?? 4;
            await SaveConfigAsync();
        }
        private GameContext BuildContext(StrategyTabState tab, bool useRawWinAmount = false)
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
                GetSnap = () => { lock (_snapLock) return _lastSnap; },
                TabId = tab.Id,
                EvalJsAsync = (js) => Dispatcher.InvokeAsync(() => Web.ExecuteScriptAsync(js)).Task.Unwrap(),
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

                SideRateText = cfg.SideRateText ?? TaiXiuLiveSun.Tasks.SideRateParser.DefaultText,
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

                UiAddWin = delta =>
                {
                    void Apply()
                    {
                        var net = (applyWinTax && delta > 0) ? Math.Round(delta * 0.98) : delta;
                        UpdateTabWin(tab, net, moneyStrategyId);
                    }

                    if (Dispatcher.CheckAccess()) Apply();
                    else Dispatcher.Invoke(Apply);
                },

                UiWinLoss = s => Dispatcher.Invoke(() =>
                {
                    UpdateTabWinLoss(tab, s);
                }),
            };
        }

        private async Task StartTaskAsync(StrategyTabState tab, IBetTask task, CancellationToken ct, bool useRawWinAmount = false)
        {
            tab.ActiveTask = task;
            _dec = new DecisionState(); // reset tráº¡ng thÃ¡i cho task má»›i
            tab.DecisionState = new DecisionState();
            TaiXiuLiveSun.Tasks.MoneyHelper.ResetTempProfitForWinUpLoseKeep();
            var ctx = BuildContext(tab, useRawWinAmount);
            // === Preflight: chá» __cw_bet sáºµn sÃ ng trÆ°á»›c khi cháº¡y chiáº¿n lÆ°á»£c ===
            for (int i = 0; i < 25; i++) // 25 * 200ms ~= 5s
            {
                ct.ThrowIfCancellationRequested();
                var check = await ctx.EvalJsAsync("(function(){return (typeof window.__cw_bet==='function')?'ok':'no';})()");
                if (string.Equals(check, "ok", StringComparison.OrdinalIgnoreCase))
                    break;
                await Task.Delay(200, ct);
            }

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
            TaiXiuLiveSun.Tasks.TaskUtil.ClearBetCooldown();
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
            // GUARD: khÃ´ng cho 2 luá»“ng start cháº¡y Ä‘á»“ng thá»i
            if (Interlocked.Exchange(ref _playStartInProgress, 1) == 1)
            {
                Log("[DEC] start is already in progress â†’ ignore");
                return;
            }
            // NgÄƒn double-click trong lÃºc cÃ²n await chuáº©n bá»‹
            if (BtnPlay != null) BtnPlay.IsEnabled = false;
            var activeTab = _activeTab;
            try
            {
                if (activeTab == null)
                {
                    MessageBox.Show("ChÆ°a cÃ³ chiáº¿n lÆ°á»£c Ä‘á»ƒ cháº¡y.", "Automino",
                        MessageBoxButton.OK, MessageBoxImage.Warning);
                    return;
                }
                if (activeTab.TaskCts != null || activeTab.IsRunning)
                {
                    Log($"[DEC] \"{activeTab.Name}\" is already running");
                    return;
                }
                await SaveConfigAsync();
                await EnsureWebReadyAsync();
                // âœ… Validate trÆ°á»›c khi báº¯t Ä‘áº§u
                if (!ValidateInputsForCurrentStrategy())
                {
                    if (BtnPlay != null) BtnPlay.IsEnabled = true; // tráº£ láº¡i nÃºt náº¿u Ä‘ang disable vÃ¬ double-click guard
                    return;
                }

                activeTab.CutStopTriggered = false;
                activeTab.WinTotal = 0;
                activeTab.LastSide = "";
                activeTab.LastWinLoss = null;
                activeTab.LastStakeAmount = null;
                activeTab.LastLevelText = "";
                _winTotal = 0;            // tu? b?n: n?u mu?n d?m l?i t? 0 khi b?t d?u
                if (LblWin != null) LblWin.Text = "0";
                ResetBetMiniPanel();    // xo? TH?NG/THUA, C?A D?T, TI?N CU?C, M?C TI?N
                if (CheckLicense && (!_licenseVerified || _runExpiresAt == null || _runExpiresAt <= DateTimeOffset.Now))
                {
                    if (!await EnsureLicenseOnceAsync())
                        return;
                }
                var typeBetJson = await Web.ExecuteScriptAsync("typeof window.__cw_bet");
                var typeBet = typeBetJson?.Trim('"');
                if (!string.Equals(typeBet, "function", StringComparison.OrdinalIgnoreCase))
                {
                    Log("[DEC] ChÆ°a tháº¥y bridge JS (__cw_bet) â†’ tá»± Ä‘á»™ng 'XÃ³c ÄÄ©a Live' vÃ  inject.");
                    VaoXocDia_Click(sender, e);

                    // Poll chá» bridge sáºµn sÃ ng tá»‘i Ä‘a 30s
                    var t0 = DateTime.UtcNow;
                    const int timeoutBetMs = 30000;
                    while ((DateTime.UtcNow - t0).TotalMilliseconds < timeoutBetMs)
                    {
                        await Task.Delay(400);
                        try
                        {
                            typeBetJson = await Web.ExecuteScriptAsync("typeof window.__cw_bet");
                            typeBet = typeBetJson?.Trim('"');
                            if (string.Equals(typeBet, "function", StringComparison.OrdinalIgnoreCase))
                                break;
                        }
                        catch { }
                    }
                    if (!string.Equals(typeBet, "function", StringComparison.OrdinalIgnoreCase))
                    {
                        Log("[DEC] KhÃ´ng thá»ƒ vÃ o bÃ n/tiÃªm JS trong thá»i gian chá». Vui lÃ²ng thá»­ láº¡i.");
                        return;
                    }
                }

                // Báº­t kÃªnh push (idempotent)
                await Web.ExecuteScriptAsync("window.__cw_startPush && window.__cw_startPush(240);");
                Log("[CW] ensure push 240ms");

                // ðŸ”’ Má»šI: Chá» Ä‘á»§ bridge + Cocos + tick Ä‘á»ƒ trÃ¡nh ná»• IndexOutOfRange trong task
                var ready = await WaitForBridgeAndGameDataAsync(15000);
                if (!ready)
                {
                    Log("[DEC] Dá»¯ liá»‡u chÆ°a sáºµn sÃ ng (bridge/cocos/tick). Thá»­ gia háº¡n push & chá» thÃªm.");
                    await Web.ExecuteScriptAsync("window.__cw_startPush && window.__cw_startPush(240);");
                    ready = await WaitForBridgeAndGameDataAsync(15000);
                    if (!ready)
                    {
                        Log("[DEC] Váº«n chÆ°a cÃ³ dá»¯ liá»‡u, táº¡m hoÃ£n khá»Ÿi Ä‘á»™ng chiáº¿n lÆ°á»£c.");
                        return;
                    }
                }

                // Chuáº©n bá»‹ & cháº¡y Task chiáº¿n lÆ°á»£c (giá»¯ nguyÃªn)
                RebuildStakeSeq((TxtStakeCsv?.Text ?? "1000,2000,4000,8000,16000").Trim());
                activeTab.RunStakeSeq = _stakeSeq.ToArray();
                activeTab.RunStakeChains = _stakeChains.Select(a => a.ToArray()).ToList();
                activeTab.RunStakeChainTotals = _stakeChainTotals.ToArray();
                activeTab.RunDecisionPercent = _decisionPercent;
                activeTab.IsRunning = true;
                MoneyHelper.S7ResetOnProfit = _cfg.S7ResetOnProfit;
                _winTotal = activeTab.WinTotal;
                if (LblWin != null) LblWin.Text = activeTab.WinTotal.ToString("N0");
                _dec = new DecisionState();
                _cooldown = false;
                int __idx = CmbBetStrategy?.SelectedIndex ?? 4;
                _cfg.BetSeq = (__idx == 0) ? (_cfg.BetSeqCL ?? "") : (__idx == 2 ? (_cfg.BetSeqNI ?? "") : "");
                _cfg.BetPatterns = (__idx == 1) ? (_cfg.BetPatternsCL ?? "") : (__idx == 3 ? (_cfg.BetPatternsNI ?? "") : "");


                // === Khá»Ÿi Ä‘á»™ng task theo lá»±a chá»n CHIáº¾N LÆ¯á»¢C ===
                activeTab.TaskCts = new CancellationTokenSource();

                bool useRawWinAmount = false;
                TaiXiuLiveSun.Tasks.IBetTask task = _cfg.BetStrategyIndex switch
                {
                    0 => new TaiXiuLiveSun.Tasks.SeqParityFollowTask(),     // 1
                    1 => new TaiXiuLiveSun.Tasks.PatternParityTask(),       // 2
                    2 => new TaiXiuLiveSun.Tasks.SeqMajorMinorTask(),       // 3
                    3 => new TaiXiuLiveSun.Tasks.PatternMajorMinorTask(),   // 4
                    4 => new TaiXiuLiveSun.Tasks.SmartPrevTask(),           // 5
                    5 => new TaiXiuLiveSun.Tasks.RandomParityTask(),        // 6
                    6 => new TaiXiuLiveSun.Tasks.AiStatParityTask(),        // 7
                    7 => new TaiXiuLiveSun.Tasks.StateTransitionBiasTask(), // 8
                    8 => new TaiXiuLiveSun.Tasks.RunLengthBiasTask(),       // 9
                    9 => new TaiXiuLiveSun.Tasks.EnsembleMajorityTask(),    // 10
                    10 => new TaiXiuLiveSun.Tasks.TimeSlicedHedgeTask(),    // 11
                    11 => new TaiXiuLiveSun.Tasks.KnnSubsequenceTask(),     // 12
                    12 => new TaiXiuLiveSun.Tasks.DualScheduleHedgeTask(),  // 13
                    13 => new TaiXiuLiveSun.Tasks.AiOnlineNGramTask(GetAiNGramStatePath()), // 14
                    14 => new TaiXiuLiveSun.Tasks.AiExpertPanelTask(), // 15
                    15 => new TaiXiuLiveSun.Tasks.Top10PatternFollowTask(), // 16
                    16 => new TaiXiuLiveSun.Tasks.JackpotMultiSideTask(), // 17
                    17 => new TaiXiuLiveSun.Tasks.SeqParityHotBackTask(), // 18
                    _ => new TaiXiuLiveSun.Tasks.SmartPrevTask(),
                };

                if (_cfg.BetStrategyIndex == 16) useRawWinAmount = true;

                activeTab.ActiveTask = task;

                var tabRef = activeTab;

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
                            Log("[Task ERR] " + (t.Exception?.GetBaseException().Message ?? "Unknown error"));
                        else if (t.IsCanceled)
                            Log("[Task] canceled");
                        else
                            Log("[Task] completed");
                    }));
                }, TaskScheduler.Default);

                Log("[Loop] started task: " + task.DisplayName);
                SetPlayButtonState(true);
            }
            catch (Exception ex)
            {
                Log("[PlayXocDia_Click] " + ex);
                // n?u l?i tru?c khi start, tr? l?i n?t
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
                // náº¿u chÆ°a start Ä‘Æ°á»£c task thÃ¬ báº­t láº¡i nÃºt
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
                _ = Web?.ExecuteScriptAsync("window.__cw_startPush && window.__cw_startPush(240);");

                if (!IsAnyTabRunning())
                {
                    TaiXiuLiveSun.Tasks.TaskUtil.ClearBetCooldown();
                    Log("[Loop] stopped");
                    StopExpiryCountdown();
                    StopLeaseHeartbeat();
                    StopLicenseRecheckTimer();
                    var uname = ResolveLeaseUsername();
                    if (!string.IsNullOrWhiteSpace(uname))
                        _ = ReleaseLeaseAsync(uname);
                }
                else
                {
                    Log($"[Loop] stopped tab: {activeTab.Name}");
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
                BtnPlay.Content = "Dá»«ng Äáº·t CÆ°á»£c";
                BtnPlay.Click += StopXocDia_Click;
                var danger = TryFindResource("DangerButton") as Style;
                if (danger != null) BtnPlay.Style = danger;
            }
            else
            {
                BtnPlay.Content = "Báº¯t Äáº§u CÆ°á»£c";
                BtnPlay.Click += PlayXocDia_Click;
                var primary = TryFindResource("PrimaryButton") as Style;
                if (primary != null) BtnPlay.Style = primary;
            }

            BtnPlay.IsEnabled = true;
            SetConfigEditable(!isRunning);

            // NEW: refresh tooltip ngay theo tráº¡ng thÃ¡i má»›i
            UpdateTooltips();
        }





        private async void ApplyMouseShieldFromCheck()
        {
            bool locked = (ChkLockMouse?.IsChecked == true);
            if (IsAnyTabRunning())
                locked = _strategyTabs.Any(t => t.IsRunning && t.Config.LockMouse);

            try
            {
                // Chá»‰ cháº¡y khi WebView2 Ä‘Ã£ sáºµn sÃ ng
                if (Web?.CoreWebView2 == null)
                {
                    if (MouseShield != null)
                        MouseShield.Visibility = locked ? Visibility.Visible : Visibility.Collapsed;
                    return;
                }

                await EnsureMouseLockScriptAsync(); // Ä‘áº£m báº£o cÃ³ __abx_lockMouse trong trang

                // KhoÃ¡/má»Ÿ chuá»™t báº±ng overlay bÃªn trong DOM (an toÃ n trÃªn VPS/RDP)
                await Web.ExecuteScriptAsync(
                    $"window.__abx_lockMouse && window.__abx_lockMouse({(locked ? "true" : "false")});");
            }
            catch (Exception ex)
            {
                Log("[LockMouse] " + ex.Message);
            }

            // (tuá»³ chá»n) overlay WPF Ä‘á»ƒ hiá»ƒn thá»‹ tooltip/cursor trÃªn app
            if (MouseShield != null)
                MouseShield.Visibility = locked ? Visibility.Visible : Visibility.Collapsed;

            // â— Quan trá»ng: KHÃ”NG Ä‘á»¥ng Web.IsEnabled Ä‘á»ƒ trÃ¡nh crash WebView2 trÃªn VPS/RDP
            if (Web != null)
                Web.IsHitTestVisible = !locked;
        }



        private async void ChkLockMouse_Checked(object sender, RoutedEventArgs e)
        {
            if (!_uiReady || _tabSwitching) return;               // â¬…ï¸ cháº·n event khá»Ÿi Ä‘á»™ng sá»›m
            ApplyMouseShieldFromCheck();
            _ = SaveConfigAsync();
            Log("[UI] KhoÃ¡ chuá»™t web: ON");
        }

        private async void ChkLockMouse_Unchecked(object sender, RoutedEventArgs e)
        {
            if (!_uiReady || _tabSwitching) return;               // â¬…ï¸ cháº·n event khá»Ÿi Ä‘á»™ng sá»›m
            ApplyMouseShieldFromCheck();
            _ = SaveConfigAsync();
            Log("[UI] KhoÃ¡ chuá»™t web: OFF");
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
            pointer-events: auto; /* nháº­n má»i click Ä‘á»ƒ cháº·n xuá»‘ng dÆ°á»›i */
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
        d.title = 'Äang khoÃ¡ chuá»™t';
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

            // ÄÄƒng kÃ½ cho má»i document trong tÆ°Æ¡ng lai (1 láº§n)
            if (!_lockJsRegistered)
            {
                await Web.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(LOCK_JS);
                _lockJsRegistered = true;
            }
            // TiÃªm ngay cho document hiá»‡n táº¡i
            await Web.ExecuteScriptAsync(LOCK_JS);
        }

        private static string Tail(string s, int take)
        {
            if (string.IsNullOrEmpty(s)) return "";
            if (take <= 0) return "";
            return (s.Length <= take) ? s : s.Substring(s.Length - take, take);
        }

        // Ä‘áº·t trong MainWindow.xaml.cs (project TaiXiuLiveSun)

        // load thá»­ láº§n lÆ°á»£t cÃ¡c uri, cÃ¡i nÃ o Ä‘Æ°á»£c thÃ¬ dÃ¹ng, khÃ´ng Ä‘Æ°á»£c thÃ¬ tráº£ vá» null
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
                    // thá»­ uri tiáº¿p theo
                }
            }
            return null;
        }


        private void InitSeqIcons()
        {
            // Ä‘Ã£ cÃ³ rá»“i thÃ¬ thÃ´i
            if (_seqIconMap.Count > 0)
                return;

            // tÃªn assembly thá»±c táº¿ cá»§a DLL hiá»‡n táº¡i
            string asm = GetType().Assembly.GetName().Name!;

            // má»—i cÃ¡i cho 2-3 Ä‘Æ°á»ng dáº«n Ä‘á»ƒ cháº¡y Ä‘Æ°á»£c cáº£ khi lÃ m plugin vÃ  khi cháº¡y Ä‘á»™c láº­p
            _seqIconMap['L'] = FallbackIcons.LoadPackImage("Assets/Seq/L.png") ?? LoadImgSafe(
                $"pack://application:,,,/{asm};component/Assets/Seq/L.png",
                "pack://application:,,,/Assets/Seq/L.png",
                "pack://application:,/Assets/Seq/L.png"
            );
            _seqIconMap['C'] = FallbackIcons.LoadPackImage("Assets/Seq/C.png") ?? LoadImgSafe(
                $"pack://application:,,,/{asm};component/Assets/Seq/C.png",
                "pack://application:,,,/Assets/Seq/C.png",
                "pack://application:,/Assets/Seq/C.png"
            );
        }



        void UpdateSeqUI(string fullSeq)
        {
            var tail = (fullSeq.Length <= 20) ? fullSeq : fullSeq.Substring(fullSeq.Length - 20, 20);
            if (tail == _lastSeqTailShown) return; // QUAN TRá»ŒNG: Ä‘á»«ng reset animation

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
            // Chuáº©n hoÃ¡ & cháº¥p nháº­n cáº£ tail sá»‘ '0'..'4'
            string sRaw = result ?? string.Empty;
            string s = sRaw.Trim().ToUpperInvariant();

            bool isChan = false, isLe = false;

            if (s.Length == 1 && char.IsDigit(s[0]))
            {
                // tail sá»‘ tá»« chuá»—i káº¿t quáº£: 0/2/4 => CHáº´N, 1/3 => Láºº
                char d = s[0];
                isChan = (d == 'C');
                isLe = (d == 'L');
            }
            else
            {
                isChan = (s == "CHAN" || s == "CHáº´N" || s == "C");
                isLe = (s == "LE" || s == "Láºº" || s == "L");
            }

            // Helper: fallback hiá»ƒn thá»‹ chá»¯
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

            // Æ¯u tiÃªn láº¥y áº£nh trong Resource (ImgCHAN/ImgLE) -> náº¿u khÃ´ng cÃ³ thÃ¬ dÃ¹ng SharedIcons
            string resKey = isLe ? "ImgLE" : "ImgCHAN";
            var resImg = TryFindResource(resKey) as ImageSource;

            ImageSource? icon =
                resImg
                ?? (isChan ? (SharedIcons.ResultChan ?? SharedIcons.SideChan)
                           : (SharedIcons.ResultLe ?? SharedIcons.SideLe));

            if (icon != null && ImgKetQua != null)
            {
                // Hiá»ƒn thá»‹ áº£nh + áº©n chá»¯
                ImgKetQua.Source = icon;
                ImgKetQua.Visibility = Visibility.Visible;
                if (LblKetQua != null) LblKetQua.Visibility = Visibility.Collapsed;

                // Cache láº¡i Ä‘á»ƒ DataGrid (converters) cÃ³ thá»ƒ "káº¿ thá»«a" tá»« tráº¡ng thÃ¡i
                if (isChan) SharedIcons.ResultChan = icon;
                else SharedIcons.ResultLe = icon;
            }
            else
            {
                // KhÃ´ng cÃ³ áº£nh -> fallback chá»¯ cÃ³ dáº¥u
                ShowText(isChan ? "CHáº´N" : "Láºº");
            }
        }


        private void SetLastSideUI(string? result)
        {
            // Chuáº©n hoÃ¡
            var s = (result ?? "").Trim().ToUpperInvariant();
            bool isLe = s == "LE" || s == "Láºº" || s == "L";
            bool isChan = s == "CHAN" || s == "CHáº´N" || s == "C";

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
            if (rounded > 0)
                tab.Stats.TotalBetAmount += rounded;
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

        private void UpdateTabWin(StrategyTabState tab, double net, string moneyStrategyId)
        {
            if (tab == null) return;

            tab.WinTotal += net;
            tab.Stats.TotalProfit += net;
            if (ReferenceEquals(_activeTab, tab))
                _winTotal = tab.WinTotal;

            try
            {
                TaiXiuLiveSun.Tasks.MoneyHelper.NotifyTempProfit(moneyStrategyId, net);
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

        private void ResetTabMiniState(StrategyTabState tab)
        {
            tab.LastWinLoss = null;
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


        // === RESET MINI PANEL: THáº®NG/THUA, Cá»¬A Äáº¶T, TIá»€N CÆ¯á»¢C, Má»¨C TIá»€N ===
        private void ResetBetMiniPanel()
        {
            try
            {
                if (_activeTab != null)
                    ResetTabMiniState(_activeTab);
                // THáº®NG/THUA: bool? -> null Ä‘á»ƒ xoÃ¡
                SetWinLossUI(null);

                // Cá»¬A Äáº¶T: string? -> null/"" Ä‘á»u xoÃ¡
                SetLastSideUI(null);

                // Káº¾T QUáº¢ (náº¿u cÃ³ hiá»ƒn thá»‹)
                SetLastResultUI(null);

                // TIá»€N CÆ¯á»¢C & Má»¨C TIá»€N
                if (LblStake != null) LblStake.Text = "";  // TIá»€N CÆ¯á»¢C
                if (LblLevel != null) LblLevel.Text = "";  // Má»¨C TIá»€N

                // LÆ°u Ã½: KHÃ”NG reset tá»•ng lÃ£i á»Ÿ Ä‘Ã¢y Ä‘á»ƒ Ã´ng chá»§ cÃ²n nhÃ¬n sau khi dá»«ng.
            }
            catch (Exception ex)
            {
                Log("[UI] ResetBetMiniPanel error: " + ex.Message);
            }
        }

        // Cho code ná»n (TaskUtil) gá»i Ä‘Ãºng hÃ m reset gá»‘c
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

                // Thiáº¿u resource â†’ fallback chá»¯
                ShowText(result.Value ? "THáº®NG" : "THUA");
                return;
            }

            // ChÆ°a cÃ³ káº¿t quáº£
            ShowText("");
        }




        /// <summary>
        /// Báº­t timer re-check license: cá»© sau 5 phÃºt sáº½ kiá»ƒm tra háº¡n license tá»« GitHub.
        /// </summary>
        private void StartLicenseRecheckTimer(string username)
        {
            StopLicenseRecheckTimer(); // Ä‘áº£m báº£o khÃ´ng nhÃ¢n báº£n timer

            // Cháº¡y sau 5 phÃºt, láº·p láº¡i má»—i 5 phÃºt (khÃ´ng cháº¡y ngay vÃ¬ lÃºc start Ä‘Ã£ check rá»“i)
            _licenseCheckTimer = new System.Threading.Timer(async _ =>
            {
                try
                {
                    await CheckLicenseNowAsync(username);
                }
                catch { /* giá»¯ timer sá»‘ng, khÃ´ng throw ra ngoÃ i */ }
            }, null, TimeSpan.FromMinutes(5), TimeSpan.FromMinutes(5));

            Log("[LicenseCheck] timer started (every 5 minutes)");
        }

        /// <summary>
        /// Táº¯t timer re-check license (gá»i khi dá»«ng cÆ°á»£c/thoÃ¡t app).
        /// </summary>
        private void StopLicenseRecheckTimer()
        {
            try { _licenseCheckTimer?.Change(Timeout.Infinite, Timeout.Infinite); } catch { }
            try { _licenseCheckTimer?.Dispose(); } catch { }
            _licenseCheckTimer = null;
            Log("[LicenseCheck] timer stopped");
        }

        /// <summary>
        /// Kiá»ƒm tra license tá»©c thá»i: fetch GitHub, cáº­p nháº­t countdown; háº¿t háº¡n thÃ¬ dá»«ng cÆ°á»£c.
        /// </summary>
        private async Task CheckLicenseNowAsync(string username)
        {
            if (Interlocked.Exchange(ref _licenseCheckBusy, 1) == 1) return; // Ä‘ang cháº¡y -> bá» qua
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
                        MessageBox.Show("KhÃ´ng xÃ¡c thá»±c Ä‘Æ°á»£c license. Dá»«ng Ä‘áº·t cÆ°á»£c.", "Automino",
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
                        MessageBox.Show("Máº­t kháº©u license khÃ´ng Ä‘Ãºng. Dá»«ng Ä‘áº·t cÆ°á»£c.", "Automino",
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
                        MessageBox.Show("License Ä‘Ã£ háº¿t háº¡n. Dá»«ng Ä‘áº·t cÆ°á»£c.", "Automino",
                            MessageBoxButton.OK, MessageBoxImage.Warning);
                        SetLicenseUi(false);
                        StopAllTasksAndRelease();
                    });
                    return;
                }
                // OK: cáº­p nháº­t láº¡i countdown náº¿u cÃ³ gia háº¡n trÃªn GitHub
                await Dispatcher.InvokeAsync(() =>
                {
                    StartExpiryCountdown(expUtc, "license");
                });
                Log("[LicenseCheck] ok until " + expUtc.ToString("u"));
            }
            catch (Exception ex)
            {
                Log("[LicenseCheck] error " + ex.Message);
                // Lá»—i máº¡ng táº¡m thá»i: KHÃ”NG dá»«ng cÆ°á»£c, láº§n sau timer sáº½ thá»­ láº¡i.
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
            // Náº¿u chuá»—i báº¯t Ä‘áº§u báº±ng BOM (U+FEFF) thÃ¬ bá» Ä‘i
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

        // Giá»¯ nguyÃªn tÃªn Ä‘á»ƒ khÃ´ng pháº£i sá»­a cÃ¡c callsite
        private async Task<string> LoadAppJsAsyncFallback()
        {
            try
            {
                // Äá»c tháº³ng tá»« embedded (KHÃ”NG thá»­ Ä‘á»c tá»« Ä‘Ä©a)
                var resName = FindResourceName("v4_js_xoc_dia_live.js")
                              ?? "TaiXiuLiveSun.v4_js_xoc_dia_live.js";
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

        private async Task<string> LoadHomeJsAsync()
        {
            try
            {
                var resName = FindResourceName("js_home_v2.js")
                              ?? "TaiXiuLiveSun.js_home_v2.js"; // fallback tÃªn logic
                var text = ReadEmbeddedText(resName);   // helper sáºµn cÃ³
                text = RemoveUtf8Bom(text);             // helper sáºµn cÃ³

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

            _appJs ??= await LoadAppJsAsyncFallback();
            _homeJs ??= await LoadHomeJsAsync();

            if (_topForwardId == null)
                _topForwardId = await Web.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(TOP_FORWARD);

            if (_appJsRegId == null && !string.IsNullOrEmpty(_appJs))
                _appJsRegId = await Web.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(_appJs);

            // NEW: Ä‘Äƒng kÃ½ Home JS
            if (_homeJsRegId == null && !string.IsNullOrEmpty(_homeJs))
                _homeJsRegId = await Web.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(_homeJs);

            if (_autoStartId == null)
                _autoStartId = await Web.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(FRAME_AUTOSTART);
            if (_homeAutoStartId == null)
            {
                // ÄÄƒng kÃ½ autostart Home vá»›i interval máº·c Ä‘á»‹nh (_homePushMs)
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
                // TiÃªm láº¡i ngay trÃªn tÃ i liá»‡u hiá»‡n táº¡i (phÃ²ng khi AddScript chÆ°a ká»‹p cháº¡y vÃ¬ timing)
                await Web.CoreWebView2.ExecuteScriptAsync(TOP_FORWARD);
                if (!string.IsNullOrEmpty(_appJs))
                    await Web.CoreWebView2.ExecuteScriptAsync(_appJs);

                // NEW: tiÃªm Home JS luÃ´n (an toÃ n trÃªn Game vÃ¬ nÃ³ tá»± no-op)
                if (!string.IsNullOrEmpty(_homeJs))
                    await Web.CoreWebView2.ExecuteScriptAsync(_homeJs);

                // KÃ­ch autostart trÃªn top (idempotent â€“ náº¿u khÃ´ng cÃ³ __cw_startPush thÃ¬ khÃ´ng sao)
                await Web.CoreWebView2.ExecuteScriptAsync(FRAME_AUTOSTART);
                // Náº¿u KHÃ”NG pháº£i host games.* thÃ¬ khá»Ÿi Ä‘á»™ng push cá»§a js_home_v2
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

                // TiÃªm ngay (idempotent)
                _ = f.ExecuteScriptAsync(FRAME_SHIM);
                if (!string.IsNullOrEmpty(_appJs))
                    _ = f.ExecuteScriptAsync(_appJs);
                // NEW: inject Home JS vÃ o frame
                if (!string.IsNullOrEmpty(_homeJs))
                    _ = f.ExecuteScriptAsync(_homeJs);
                _ = f.ExecuteScriptAsync(FRAME_AUTOSTART);
                Log("[Bridge] Frame injected + autostart armed.");

                // Hook lifecycle cá»§a CHÃNH frame nÃ y
                f.DOMContentLoaded += Frame_DOMContentLoaded_Bridge;
                f.NavigationCompleted += Frame_NavigationCompleted_Bridge;
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

                // API má»›i: GetFrameById
                var mi = t.GetMethod("GetFrameById");
                if (mi != null)
                    return (CoreWebView2Frame?)mi.Invoke(Web.CoreWebView2, new object[] { frameId });

                // Má»™t sá»‘ runtime cÃ³ TryGetFrame(ulong, out CoreWebView2Frame)
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
                    // 1) __cw_bet cÃ³ chÆ°a
                    var typeBet = (await Web.ExecuteScriptAsync("typeof window.__cw_bet"))?.Trim('"');
                    bool hasBet = string.Equals(typeBet, "function", StringComparison.OrdinalIgnoreCase);

                    // 2) Cocos cÃ³ chÆ°a
                    var cocosJson = await Web.ExecuteScriptAsync(
                        "(function(){try{return !!(window.cc && cc.director && cc.director.getScene);}catch(e){return false;}})()");
                    bool hasCocos = bool.TryParse(cocosJson, out var b) && b;

                    // 3) ÄÃ£ cÃ³ tick chÆ°a (Ã­t nháº¥t 1 kÃ½ tá»± seq)
                    bool hasTick = false;
                    lock (_snapLock)
                    {
                        hasTick = _lastSnap?.seq != null && _lastSnap.seq.Length > 0;
                    }

                    if (hasBet && hasCocos && hasTick)
                        return true;
                }
                catch { /* tiáº¿p tá»¥c Ä‘á»£i */ }

                await Task.Delay(300);
            }
            return false;
        }


        // JSON license Ä‘Æ¡n giáº£n trÃªn GitHub
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

        // Acquire lease 1 láº§n (KHÃ”NG renew theo yÃªu cáº§u)
        private async Task<bool> AcquireLeaseOnceAsync(string username)
        {
            EnsureDeviceId();
            if (!EnableLeaseCloudflare) return true;
            if (string.IsNullOrWhiteSpace(LeaseBaseUrl)) return true; // chÆ°a cáº¥u hÃ¬nh -> bá» qua
            try
            {
                using var http = new HttpClient() { Timeout = TimeSpan.FromSeconds(6) };
                var uname = Uri.EscapeDataString(username);
                var resp = await http.PostAsJsonAsync($"{LeaseBaseUrl}/acquire/{uname}", new { clientId = _leaseClientId, sessionId = _leaseSessionId, deviceId = _deviceId, appId = AppLocalDirName });
                var body = await resp.Content.ReadAsStringAsync();
                Log($"[Lease] acquire -> {(int)resp.StatusCode} {resp.ReasonPhrase} | {body}");
                if ((int)resp.StatusCode == 409)
                {
                    // tÃ i khoáº£n Ä‘ang cháº¡y nÆ¡i khÃ¡c
                    Log("[Lease] 409 in-use: " + body);
                    MessageBox.Show("TÃ i khoáº£n Ä‘ang cháº¡y nÆ¡i khÃ¡c. Vui lÃ²ng thá»­ láº¡i sau.", "Automino", MessageBoxButton.OK, MessageBoxImage.Warning);
                    return false;
                }
                if (resp.IsSuccessStatusCode) return true;
                MessageBox.Show($"Lease bá»‹ tá»« chá»‘i [{(int)resp.StatusCode}] - {body}", "Automino",
                    MessageBoxButton.OK, MessageBoxImage.Warning);
                return false;
            }
            catch (Exception ex)
            {
                Log("[Lease] acquire error: " + ex.Message);
                MessageBox.Show("KhÃ´ng káº¿t ná»‘i Ä‘Æ°á»£c trung tÃ¢m lease. Vui lÃ²ng kiá»ƒm tra máº¡ng.", "Automino", MessageBoxButton.OK, MessageBoxImage.Warning);
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
                // khÃ´ng cáº§n xá»­ lÃ½ gÃ¬ thÃªm; cá»© fire-and-forget
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


        // Khá»Ÿi Ä‘á»™ng Ä‘áº¿m ngÆ°á»£c hiá»ƒn thá»‹ dÆ°á»›i nÃºt vÃ  auto stop khi háº¿t giá»
        private void StartExpiryCountdown(DateTimeOffset until, string mode)
        {
            // âœ… Chuáº©n hoÃ¡ vá» LOCAL Ä‘á»ƒ hiá»ƒn thá»‹ & tÃ­nh giá» cho Ä‘Ãºng vá»›i Ä‘á»“ng há»“ mÃ¡y
            var localUntil = until.ToLocalTime();
            _runExpiresAt = localUntil;
            _expireMode = mode;

            // Cáº­p nháº­t ngay 1 láº§n
            Dispatcher.Invoke(() => UpdateExpireLabelUI());

            // Tick má»—i giÃ¢y
            _expireTimer?.Dispose();
            _expireTimer = new System.Threading.Timer(_ =>
            {
                try
                {
                    var now = DateTimeOffset.Now;          // â— DÃ¹ng Now (local), khÃ´ng dÃ¹ng UtcNow ná»¯a
                    var left = (_runExpiresAt ?? now) - now;

                    if (left <= TimeSpan.Zero)
                    {
                        _expireTimer?.Dispose();
                        _expireTimer = null;

                        Dispatcher.BeginInvoke(new Action(() =>
                        {
                            // Tá»± dá»«ng vÃ²ng chÆ¡i náº¿u cÃ²n Ä‘ang cháº¡y
                            if (IsAnyTabRunning())
                            {
                                StopAllTasksAndRelease();
                            }

                            // ThÃ´ng bÃ¡o theo mode
                              if (_expireMode == "trial")
                              {
                                  MessageBox.Show(TrialConsumedTodayMessage, "Automino", MessageBoxButton.OK, MessageBoxImage.Information);
                              }
                              else
                              {
                                  MessageBox.Show("Tool cá»§a báº¡n háº¿t háº¡n ! HÃ£y liÃªn há»‡ Telegram: @minoauto Ä‘á»ƒ gia háº¡n", "Automino", MessageBoxButton.OK, MessageBoxImage.Warning);
                              }

                              if (ChkTrial != null) ChkTrial.IsChecked = false;
                              // XoÃ¡ nhÃ£n
                              if (LblExpire != null) LblExpire.Text = "";
                              _runExpiresAt = null;
                            // náº¿u lÃ  trial thÃ¬ huá»· vÃ© local Ä‘á»ƒ láº§n sau khÃ´ng resume ná»¯a
                            try { if (_expireMode == "trial") { ClearLocalTrialState(saveAsync: true); } } catch { }

                            // Ngáº¯t heartbeat trÆ°á»›c khi tráº£ lease
                            StopLeaseHeartbeat();
                            SetLicenseUi(false);
                            StopLicenseRecheckTimer();
                            // Thá»­ tráº£ lease luÃ´n Ä‘á»ƒ nhÆ°á»ng slot
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

            // â— DÃ¹ng Now (local) Ä‘á»ƒ Ä‘á»“ng bá»™ vá»›i _runExpiresAt (Ä‘Ã£ ToLocalTime á»Ÿ trÃªn)
            var now = DateTimeOffset.Now;
            var left = _runExpiresAt.Value - now;

            if (left <= TimeSpan.Zero)
            {
                LblExpire.Text = "Háº¿t háº¡n";
                return;
            }

            string line;
            if (left.TotalDays >= 1)
            {
                // VÃ­ dá»¥: "CÃ²n láº¡i: 1 ngÃ y 07:12:34  |  Háº¿t háº¡n: 17/11/2025 20:30"
                line = $"CÃ²n láº¡i: {Math.Floor(left.TotalDays)} ngÃ y {left:hh\\:mm\\:ss}  |  Háº¿t háº¡n: {_runExpiresAt:dd/MM/yyyy HH:mm}";
            }
            else
            {
                // DÆ°á»›i 1 ngÃ y chá»‰ hiá»‡n giá»/phÃºt/giÃ¢y
                line = $"CÃ²n láº¡i: {left:hh\\:mm\\:ss}";
            }
            LblExpire.Text = line;
        }

        // Helper build script vá»›i tham sá»‘ interval (ms)
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
                              .ContinueWith(_ => { }); // nuá»‘t TaskCanceled
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

                // ðŸ”´ thÃªm dÃ²ng nÃ y
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
                _shutdownCts.Cancel();   // báº¡n Ä‘Ã£ cÃ³
                CleanupWebStuff();       // ðŸ”´ thÃªm
            }
            catch { }
        }



        private void CleanupWebStuff()
        {
            // 1) há»§y cÃ¡c CTS liÃªn quan Ä‘áº¿n web / auto login
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

            // 2) táº¯t timer license náº¿u cÃ³
            try { _licenseCheckTimer?.Dispose(); } catch { }
            _licenseCheckTimer = null;

            // 3) gá»¡ Ä‘Æ°á»£c cÃ¡i nÃ o cÃ³ tÃªn thÃ¬ gá»¡ cÃ¡i Ä‘Ã³
            try
            {
                if (Web != null)
                {
                    // cÃ¡i nÃ y CÃ“ tÃªn nÃªn gá»¡ Ä‘Æ°á»£c
                    try { Web.NavigationCompleted -= Web_NavigationCompleted; } catch { }

                    // Ä‘áº©y web vá» tráº¯ng trÆ°á»›c khi dispose Ä‘á»ƒ nÃ³ ngÆ°ng máº¥y request ná»n
                    try
                    {
                        if (Web.CoreWebView2 != null)
                            Web.CoreWebView2.Navigate("about:blank");
                    }
                    catch { }

                    // dispose háº³n control
                    try { Web.Dispose(); } catch { }
                    Web = null;
                }
            }
            catch { }

            // 4) reset cÃ¡c cá» Ä‘Ã£ hook Ä‘á»ƒ náº¿u má»Ÿ láº¡i thÃ¬ hook láº¡i tá»« Ä‘áº§u
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


        // DÃ¹ng láº¡i cá» nÃ y náº¿u báº¡n Ä‘Ã£ cÃ³, hoáº·c thÃªm má»›i:

        // Parse tiá»n: cho phÃ©p sá»‘ Ã¢m á»Ÿ Ä‘áº§u, bá» dáº¥u cháº¥m pháº©y khoáº£ng tráº¯ng
        private static double ParseMoney(string s)
        {
            if (string.IsNullOrWhiteSpace(s)) return 0;
            var cleaned = new string(s.Where(c => char.IsDigit(c) || (c == '-' && s.IndexOf(c) == 0)).ToArray());
            return double.TryParse(cleaned, out var v) ? v : 0;
        }

        // GÃ¡n UI tá»« config (gá»i á»Ÿ nÆ¡i báº¡n Ä‘Ã£ Ã¡p config ra UI, vÃ­ dá»¥ sau LoadConfig)
        private void ApplyCutUiFromConfig()
        {
            if (TxtCutProfit != null) TxtCutProfit.Text = (_cfg?.CutProfit ?? 0).ToString("N0");
            if (TxtCutLoss != null) TxtCutLoss.Text = (_cfg?.CutLoss ?? 0).ToString("N0");
        }

        private static double ParseMoneyOrZero(string s)
        {
            if (string.IsNullOrWhiteSpace(s)) return 0;            // â¬…ï¸ rá»—ng = 0 (táº¯t)
                                                                   // Cho phÃ©p sá»‘ Ã¢m á»Ÿ Ä‘áº§u, bá» dáº¥u ngÄƒn cÃ¡ch
            var cleaned = new string(s.Where(c => char.IsDigit(c) || (c == '-' && s.IndexOf(c) == 0)).ToArray());
            return double.TryParse(cleaned, out var v) ? v : 0;
        }

        private async void TxtCut_LostFocus(object sender, RoutedEventArgs e)
        {
            if (!_uiReady || _tabSwitching) return;

            // Äá»c & chuáº©n hoÃ¡ (chuá»—i rá»—ng = 0 => táº¯t)
            var newCutProfit = ParseMoneyOrZero(T(TxtCutProfit));
            var newCutLoss = ParseMoneyOrZero(T(TxtCutLoss));

            // TrÃ¡nh ghi file khi khÃ´ng Ä‘á»•i
            if (_cfg != null && _cfg.CutProfit == newCutProfit && _cfg.CutLoss == newCutLoss)
            {
                // váº«n format láº¡i UI cho Ä‘áº¹p sá»‘
                ApplyCutUiFromConfig();
                return;
            }

            // Cáº­p nháº­t _cfg vÃ  lÆ°u cho láº§n sau
            _cfg.CutProfit = newCutProfit;
            _cfg.CutLoss = newCutLoss;
            await SaveConfigAsync();

            // Format láº¡i UI theo "N0"
            ApplyCutUiFromConfig();

            // Náº¿u Ä‘ang cháº¡y thÃ¬ kiá»ƒm tra & cáº¯t ngay náº¿u Ä‘á»§ Ä‘iá»u kiá»‡n
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

            double cutProfit = tab.Config?.CutProfit ?? 0;   // duong -> bat cat lai
            double cutLoss = tab.Config?.CutLoss ?? 0;       // duong -> bat cat lo (nguong la -cutLoss)

            if (cutProfit <= 0 && cutLoss <= 0) return;

            var winTotal = tab.WinTotal;
            if (cutProfit > 0 && winTotal >= cutProfit)
            {
                tab.CutStopTriggered = true;
                StopTaskAndNotify(tab, $"??t C?T L?I: Ti?n th?ng = {winTotal:N0} ? {cutProfit:N0}");
                return;
            }

            if (cutLoss > 0)
            {
                var lossThreshold = -cutLoss;
                if (winTotal <= lossThreshold)
                {
                    tab.CutStopTriggered = true;
                    StopTaskAndNotify(tab, $"??t C?T L?: Ti?n th?ng = {winTotal:N0} ? {lossThreshold:N0}");
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

        private void FinalizeLastBet(string? result, long balanceAfter, HashSet<string>? winners = null, string? displayResult = null)
        {
            if (_pendingRows.Count == 0 || string.IsNullOrWhiteSpace(result)) return;

            var winSet = winners ?? new HashSet<string>(StringComparer.OrdinalIgnoreCase) { result! };
            var resultText = string.IsNullOrWhiteSpace(displayResult)
                ? result!.ToUpperInvariant()
                : displayResult!;

            foreach (var row in _pendingRows)
            {
                row.Result = resultText;
                bool win = winSet.Contains(row.Side);
                row.WinLose = win ? "Tháº¯ng" : "Thua";
                row.Account = balanceAfter;

                // â—KHÃ”NG Add láº¡i vÃ o _betAll (Ä‘Ã£ chÃ¨n á»Ÿ thá»i Ä‘iá»ƒm BET)
                try { AppendBetCsv(row); } catch { /* ignore IO */ }
            }

            // Chá»‰ vá» trang 1 náº¿u Ä‘ang bÃ¡m trang má»›i nháº¥t; cÃ²n Ä‘ang xem trang cÅ© thÃ¬ giá»¯ nguyÃªn
            if (_autoFollowNewest)
            {
                ShowFirstPage();
            }
            else
            {
                RefreshCurrentPage();   // (má»¥c 3 bÃªn dÆ°á»›i)
            }

            _pendingRows.Clear(); // sáºµn sÃ ng vÃ¡n tiáº¿p theo
        }

        public void FinalizePendingBetsWithWinners(HashSet<string> winners, string? displayResult = null)
        {
            if (_pendingRows.Count == 0) return;
            long balance = 0;
            try { balance = (long)ParseMoneyOrZero(LblAmount?.Text ?? "0"); } catch { }
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
                            Account = long.TryParse(cols[6], out var ac) ? ac : 0,
                        };
                        tmp.Add(row);
                        if (tmp.Count >= maxTotal) break;
                    }
                    if (tmp.Count >= maxTotal) break;
                }

                _betAll.Clear();
                _betAll.AddRange(tmp.OrderByDescending(r => r.At).Take(maxTotal));
                // Chá»‰ vá» trang 1 náº¿u Ä‘ang bÃ¡m trang má»›i nháº¥t; cÃ²n Ä‘ang xem trang cÅ© thÃ¬ giá»¯ nguyÃªn
                if (_autoFollowNewest)
                {
                    ShowFirstPage();
                }
                else
                {
                    RefreshCurrentPage();   // (má»¥c 3 bÃªn dÆ°á»›i)
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
            if (u.StartsWith("THANG")) return "Tháº¯ng";
            if (u.StartsWith("THUA")) return "Thua";
            return (s ?? "").Trim();
        }





        private void RefreshBetPage()
        {
            _betPage.Clear();

            int total = _betAll.Count;
            int pageCount = Math.Max(1, (int)Math.Ceiling(total / (double)PageSize));

            // chá»‘t _pageIndex trong biÃªn
            _pageIndex = Math.Max(0, Math.Min(_pageIndex, pageCount - 1));

            // vÃ¬ _betAll Ä‘ang sáº¯p Má»šI â†’ CÅ¨, trang 1 lÃ  index 0
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


        // sá»± kiá»‡n nÃºt
        private void BtnPrevPage_Click(object sender, RoutedEventArgs e)
        {
            // trang 1 lÃ  0 â†’ khÃ´ng lÃ¹i Ä‘Æ°á»£c ná»¯a
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
                // CSV Ä‘Æ¡n giáº£n, At lÆ°u ISO Ä‘á»ƒ dá»… parse
                sw.WriteLine($"{r.At:O},{r.Game},{r.Stake},{r.Side},{r.Result},{r.WinLose},{r.Account}");
            }
            catch { }
        }

        private async void MainWindow_Loaded(object? sender, RoutedEventArgs e)
        {
            await LoadBetHistoryAsync(maxTotal: MaxHistory);  // Ä‘á»c tá»‘i Ä‘a MaxHistory báº£n ghi nhiá»u ngÃ y
            ShowFirstPage();                            // hiá»ƒn thá»‹ 10 dÃ²ng má»›i nháº¥t (trang cuá»‘i)
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

        /// <summary>Dá»±ng dÃ£y sá»‘ trang: 1 â€¦ 4 5 [6] 7 8 â€¦ 20</summary>
        private void BuildPager()
        {
            // chá»‰ cÃ²n dÃ¹ng Ä‘á»ƒ cáº­p nháº­t LblPage
            int total = _betAll.Count;
            int pageCount = Math.Max(1, (int)Math.Ceiling(total / (double)PageSize));
            if (LblPage != null) LblPage.Text = $"{_pageIndex + 1}/{pageCount}";
            // khÃ´ng dá»±ng cÃ¡c nÃºt sá»‘ ná»¯a
        }



        private void CleanupOldLogs()
        {
            try
            {
                if (!Directory.Exists(_logDir)) return;
                string today = DateTime.Today.ToString("yyyyMMdd", System.Globalization.CultureInfo.InvariantCulture);

                // Chá»‰ Ä‘á»¥ng tá»›i *.log (C#), KHÃ”NG Ä‘á»¥ng "bets-*.csv"
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

        // âŸ² Má»›i nháº¥t
        private void BtnGoNewest_Click(object sender, RoutedEventArgs e)
        {
            ShowFirstPage();   // trang 1 lÃ  má»›i nháº¥t trong kiáº¿n trÃºc hiá»‡n táº¡i
        }

        // Combo chá»n "sá»‘ dÃ²ng / trang"
        private void CmbPageSize_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (CmbPageSize?.SelectedItem is ComboBoxItem it
                && int.TryParse(it.Tag?.ToString(), out var n)
                && n > 0)
            {
                PageSize = n;

                ShowFirstPage();   // trang 1 lÃ  má»›i nháº¥t trong kiáº¿n trÃºc hiá»‡n táº¡i
            }
        }

        // Ã” "Tá»›i trang â€¦"
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
        private void MainWindow_PreviewKeyDown(object sender, KeyEventArgs e)
        {
            try
            {
                bool isF12 = e.Key == Key.F12;
                bool isCtrlShiftI = (e.Key == Key.I) &&
                                    Keyboard.Modifiers.HasFlag(ModifierKeys.Control) &&
                                    Keyboard.Modifiers.HasFlag(ModifierKeys.Shift);
                if (!isF12 && !isCtrlShiftI) return;

                if (Web?.CoreWebView2 != null)
                {
                    try { Web.CoreWebView2.Settings.AreDevToolsEnabled = true; } catch { }
                    try { Web.CoreWebView2.OpenDevToolsWindow(); } catch { }
                    e.Handled = true;
                }
            }
            catch { }
        }



        private static string NormalizeSeq(string raw) =>
    TextNorm.U(Regex.Replace(raw ?? "", @"[,\s\-]+", "")); // bá» , khoáº£ng tráº¯ng, -

        // --- Chuá»—i C/L: C,L; 2..50 kÃ½ tá»± sau khi bá» phÃ¢n tÃ¡ch ---
        private static bool ValidateSeqCL(string s, out string err)
        {
            err = "";
            if (string.IsNullOrWhiteSpace(s))
            {
                err = "Vui lÃ²ng nháº­p chuá»—i C/L.";
                return false;
            }

            int count = 0;
            foreach (var ch in s)
            {
                if (char.IsWhiteSpace(ch)) continue;          // chá»‰ cho phÃ©p khoáº£ng tráº¯ng
                char u = char.ToUpperInvariant(ch);
                if (u == 'C' || u == 'L') { count++; continue; }  // vÃ  C/L
                err = "Chá»‰ cho phÃ©p khoáº£ng tráº¯ng vÃ  kÃ½ tá»± C hoáº·c L (khÃ´ng dÃ¹ng dáº¥u pháº©y/gáº¡ch/cháº¥m pháº©y/gáº¡ch dÆ°á»›i, sá»‘, kÃ½ tá»± khÃ¡c).";
                return false;
            }

            if (count < 2 || count > 100)
            {
                err = "Äá»™ dÃ i 2â€“50 kÃ½ tá»± (tÃ­nh theo C/L, bá» qua khoáº£ng tráº¯ng).";
                return false;
            }

            return true;
        }

        // --- Chuá»—i I/N: I,N; 2..50 kÃ½ tá»± ---
        private static bool ValidateSeqNI(string s, out string err)
        {
            err = "";
            if (string.IsNullOrWhiteSpace(s))
            {
                err = "Vui lÃ²ng nháº­p chuá»—i I/N.";
                return false;
            }

            int count = 0;
            foreach (var ch in s)
            {
                if (char.IsWhiteSpace(ch)) continue;          // chá»‰ cho phÃ©p khoáº£ng tráº¯ng
                char u = char.ToUpperInvariant(ch);
                if (u == 'I' || u == 'N') { count++; continue; }  // vÃ  I/N
                err = "Chá»‰ cho phÃ©p khoáº£ng tráº¯ng vÃ  kÃ½ tá»± I hoáº·c N (khÃ´ng dÃ¹ng dáº¥u pháº©y/gáº¡ch/cháº¥m pháº©y/gáº¡ch dÆ°á»›i, sá»‘, kÃ½ tá»± khÃ¡c).";
                return false;
            }

            if (count < 2 || count > 100)
            {
                err = "Äá»™ dÃ i 2â€“50 kÃ½ tá»± (tÃ­nh theo I/N, bá» qua khoáº£ng tráº¯ng).";
                return false;
            }

            return true;
        }

        // --- Tháº¿ cáº§u C/L: tá»«ng dÃ²ng "<máº«u> - <Ä‘áº·t>", máº«u gá»“m C/L/?, Ä‘áº·t lÃ  C hoáº·c L ---
        private static bool ValidatePatternsCL(string s, out string err)
        {
            err = "";
            if (string.IsNullOrWhiteSpace(s))
            {
                err = "Vui lÃ²ng nháº­p cÃ¡c tháº¿ cáº§u C/L.";
                return false;
            }

            // TÃ¡ch nhiá»u quy táº¯c: ',', ';', '|', hoáº·c xuá»‘ng dÃ²ng
            var rules = System.Text.RegularExpressions.Regex.Split(s.Replace("\r", ""), @"[,\;\|\n]+");
            int idx = 0;

            foreach (var raw in rules)
            {
                var line = raw.Trim();
                if (line.Length == 0) continue;
                idx++;

                // <máº«u> (C/L, cho phÃ©p khoáº£ng tráº¯ng)  -> hoáº·c -  <chuá»—i cáº§u> (C/L, CHO PHÃ‰P khoáº£ng tráº¯ng)
                var m = System.Text.RegularExpressions.Regex.Match(
                    line,
                    @"^\s*([CLcl\s]+)\s*(?:->|-)\s*([CLcl\s]+)\s*$",
                    System.Text.RegularExpressions.RegexOptions.IgnoreCase);

                if (!m.Success)
                {
                    err = $"Quy táº¯c {idx} khÃ´ng há»£p lá»‡: â€œ{line}â€. Dáº¡ng Ä‘Ãºng: <máº«u> -> <chuá»—i cáº§u> hoáº·c <máº«u>-<chuá»—i cáº§u>; chá»‰ dÃ¹ng C/L; <chuá»—i cáº§u> cÃ³ thá»ƒ cÃ³ khoáº£ng tráº¯ng.";
                    return false;
                }

                // LHS: chá»‰ C/L + khoáº£ng tráº¯ng; Ä‘á»™ dÃ i 1â€“10 sau khi bá» khoáº£ng tráº¯ng
                var lhsRaw = m.Groups[1].Value;
                var lhsBuf = new System.Text.StringBuilder(lhsRaw.Length);
                foreach (char ch in lhsRaw)
                {
                    if (char.IsWhiteSpace(ch)) continue;
                    char u = char.ToUpperInvariant(ch);
                    if (u == 'C' || u == 'L') lhsBuf.Append(u);
                    else { err = $"Quy táº¯c {idx}: <máº«u_quÃ¡_khá»©> chá»‰ gá»“m C/L (cho phÃ©p khoáº£ng tráº¯ng giá»¯a cÃ¡c kÃ½ tá»±)."; return false; }
                }
                var lhs = lhsBuf.ToString();
                if (lhs.Length < 1 || lhs.Length > 10)
                {
                    err = $"Quy táº¯c {idx}: Ä‘á»™ dÃ i <máº«u_quÃ¡_khá»©> pháº£i 1â€“10 kÃ½ tá»± (C/L).";
                    return false;
                }

                // RHS: chuá»—i cáº§u C/L (>=1), CHO PHÃ‰P khoáº£ng tráº¯ng (bá»‹ bá» qua khi kiá»ƒm tra)
                var rhsRaw = m.Groups[2].Value;
                var rhsBuf = new System.Text.StringBuilder(rhsRaw.Length);
                foreach (char ch in rhsRaw)
                {
                    if (char.IsWhiteSpace(ch)) continue;
                    char u = char.ToUpperInvariant(ch);
                    if (u == 'C' || u == 'L') rhsBuf.Append(u);
                    else { err = $"Quy táº¯c {idx}: <chuá»—i cáº§u> chá»‰ gá»“m C/L (cÃ³ thá»ƒ nhiá»u kÃ½ tá»±), cho phÃ©p khoáº£ng tráº¯ng."; return false; }
                }
                if (rhsBuf.Length < 1)
                {
                    err = $"Quy táº¯c {idx}: <chuá»—i cáº§u> tá»‘i thiá»ƒu 1 kÃ½ tá»± C/L.";
                    return false;
                }
            }

            return true;
        }




        // --- Tháº¿ cáº§u I/N: tá»«ng dÃ²ng "<máº«u> - <Ä‘áº·t>", máº«u gá»“m I/N/?, Ä‘áº·t lÃ  I hoáº·c N ---
        private static bool ValidatePatternsNI(string s, out string err)
        {
            err = "";
            if (string.IsNullOrWhiteSpace(s))
            {
                err = "Vui lÃ²ng nháº­p cÃ¡c tháº¿ cáº§u I/N.";
                return false;
            }

            // TÃ¡ch nhiá»u quy táº¯c: ',', ';', '|', hoáº·c xuá»‘ng dÃ²ng
            var rules = System.Text.RegularExpressions.Regex.Split(s.Replace("\r", ""), @"[,\;\|\n]+");
            int idx = 0;

            foreach (var raw in rules)
            {
                var line = raw.Trim();
                if (line.Length == 0) continue;
                idx++;

                // <máº«u> (I/N, cho phÃ©p khoáº£ng tráº¯ng)  -> hoáº·c -  <chuá»—i cáº§u> (I/N, CHO PHÃ‰P khoáº£ng tráº¯ng)
                var m = System.Text.RegularExpressions.Regex.Match(
                    line,
                    @"^\s*([INin\s]+)\s*(?:->|-)\s*([INin\s]+)\s*$",
                    System.Text.RegularExpressions.RegexOptions.IgnoreCase);

                if (!m.Success)
                {
                    err = $"Quy táº¯c {idx} khÃ´ng há»£p lá»‡: â€œ{line}â€. Dáº¡ng Ä‘Ãºng: <máº«u> -> <chuá»—i cáº§u> hoáº·c <máº«u>-<chuá»—i cáº§u>; chá»‰ dÃ¹ng I/N; <chuá»—i cáº§u> cÃ³ thá»ƒ cÃ³ khoáº£ng tráº¯ng.";
                    return false;
                }

                // LHS: chá»‰ I/N + khoáº£ng tráº¯ng; Ä‘á»™ dÃ i 1â€“10 sau khi bá» khoáº£ng tráº¯ng
                var lhsRaw = m.Groups[1].Value;
                var lhsBuf = new System.Text.StringBuilder(lhsRaw.Length);
                foreach (char ch in lhsRaw)
                {
                    if (char.IsWhiteSpace(ch)) continue;
                    char u = char.ToUpperInvariant(ch);
                    if (u == 'I' || u == 'N') lhsBuf.Append(u);
                    else { err = $"Quy táº¯c {idx}: <máº«u_quÃ¡_khá»©> chá»‰ gá»“m I/N (cho phÃ©p khoáº£ng tráº¯ng giá»¯a cÃ¡c kÃ½ tá»±)."; return false; }
                }
                var lhs = lhsBuf.ToString();
                if (lhs.Length < 1 || lhs.Length > 10)
                {
                    err = $"Quy táº¯c {idx}: Ä‘á»™ dÃ i <máº«u_quÃ¡_khá»©> pháº£i 1â€“10 kÃ½ tá»± (I/N).";
                    return false;
                }

                // RHS: chuá»—i cáº§u I/N (>=1), CHO PHÃ‰P khoáº£ng tráº¯ng (bá»‹ bá» qua khi kiá»ƒm tra)
                var rhsRaw = m.Groups[2].Value;
                var rhsBuf = new System.Text.StringBuilder(rhsRaw.Length);
                foreach (char ch in rhsRaw)
                {
                    if (char.IsWhiteSpace(ch)) continue;
                    char u = char.ToUpperInvariant(ch);
                    if (u == 'I' || u == 'N') rhsBuf.Append(u);
                    else { err = $"Quy táº¯c {idx}: <chuá»—i cáº§u> chá»‰ gá»“m I/N (cÃ³ thá»ƒ nhiá»u kÃ½ tá»±), cho phÃ©p khoáº£ng tráº¯ng."; return false; }
                }
                if (rhsBuf.Length < 1)
                {
                    err = $"Quy táº¯c {idx}: <chuá»—i cáº§u> tá»‘i thiá»ƒu 1 kÃ½ tá»± I/N.";
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

        // --- Validate cuá»‘i cÃ¹ng khi báº¥m "Báº¯t Äáº§u CÆ°á»£c" ---
        private bool ValidateInputsForCurrentStrategy()
        {
            ShowErrorsForCurrentStrategy(); // cáº­p nháº­t UI trÆ°á»›c

            int idx = CmbBetStrategy?.SelectedIndex ?? 4;
            if (idx == 0) // 1. Chuá»—i C/L
            {
                if (!ValidateSeqCL(T(TxtChuoiCau), out var err))
                {
                    SetError(LblSeqError, err);
                    BringBelow(TxtChuoiCau);
                    return false;
                }
            }
            else if (idx == 2) // 3. Chuá»—i I/N
            {
                if (!ValidateSeqNI(T(TxtChuoiCau), out var err))
                {
                    SetError(LblSeqError, err);
                    BringBelow(TxtChuoiCau);
                    return false;
                }
            }
            else if (idx == 1) // 2. Tháº¿ C/L
            {
                if (!ValidatePatternsCL(T(TxtTheCau), out var err))
                {
                    SetError(LblPatError, err);
                    BringBelow(TxtTheCau);
                    return false;
                }
            }
            else if (idx == 3) // 4. Tháº¿ I/N
            {
                if (!ValidatePatternsNI(T(TxtTheCau), out var err))
                {
                    SetError(LblPatError, err);
                    BringBelow(TxtTheCau);
                    return false;
                }
            }

            else if (idx == 16) // 17. Cá»­a Ä‘áº·t & tá»‰ lá»‡
            {
                if (!TaiXiuLiveSun.Tasks.SideRateParser.TryParse(T(TxtSideRatio), out _, out var err))
                {
                    SetError(LblSideRatioError, err);
                    BringBelow(TxtSideRatio);
                    return false;
                }
            }
            // CÃ¡c chiáº¿n lÆ°á»£c cÃ²n láº¡i khÃ´ng cáº§n kiá»ƒm tra thÃªm
            return true;
        }

        private void SyncStrategyFieldsToUI()
        {
            int idx = CmbBetStrategy?.SelectedIndex ?? 4;
            if (idx == 0) { if (TxtChuoiCau != null) TxtChuoiCau.Text = _cfg.BetSeqCL ?? ""; }
            else if (idx == 2) { if (TxtChuoiCau != null) TxtChuoiCau.Text = _cfg.BetSeqNI ?? ""; }

            if (idx == 1) { if (TxtTheCau != null) TxtTheCau.Text = _cfg.BetPatternsCL ?? ""; }
            else if (idx == 3) { if (TxtTheCau != null) TxtTheCau.Text = _cfg.BetPatternsNI ?? ""; }
            if (idx == 16 && TxtSideRatio != null) TxtSideRatio.Text = _cfg.SideRateText ?? TaiXiuLiveSun.Tasks.SideRateParser.DefaultText;
        }

        private void LoadStakeCsvForCurrentMoneyStrategy()
        {
            try
            {
                var id = GetMoneyStrategyFromUI();                    // vÃ­ dá»¥: "Victor2" / "IncreaseWhenLose" ...
                string csv = _cfg.StakeCsv;                           // fallback
                if (_cfg.StakeCsvByMoney != null &&
                    !string.IsNullOrWhiteSpace(id) &&
                    _cfg.StakeCsvByMoney.TryGetValue(id, out var saved) &&
                    !string.IsNullOrWhiteSpace(saved))
                {
                    csv = saved;
                }

                if (TxtStakeCsv != null) TxtStakeCsv.Text = csv;      // -> sáº½ kÃ­ch TextChanged Ä‘á»ƒ rebuild _stakeSeq
                RebuildStakeSeq(csv);
                Log($"[StakeCsv.load] id={id} => {csv} -> {_stakeSeq.Length}");
            }
            catch { /* ignore */ }
        }



        private async void TxtChuoiCau_TextChanged(object sender, TextChangedEventArgs e)
        {
            if (!_uiReady || _tabSwitching) return;

            var idx = CmbBetStrategy?.SelectedIndex ?? -1;       // 0: CL, 2: N/I
            var txt = (TxtChuoiCau?.Text ?? "").Trim();

            // LÆ°u tÃ¡ch báº¡ch cho tá»«ng chiáº¿n lÆ°á»£c
            if (idx == 0) _cfg.BetSeqCL = txt;    // Chiáº¿n lÆ°á»£c 1: Chuá»—i C/L
            if (idx == 2) _cfg.BetSeqNI = txt;    // Chiáº¿n lÆ°á»£c 3: Chuá»—i N/I

            // Báº£n â€œchungâ€ Ä‘á»ƒ engine Ä‘á»c khi cháº¡y
            _cfg.BetSeq = txt;

            await SaveConfigAsync();              // <â€” GHI config.json
            ShowErrorsForCurrentStrategy();       // (náº¿u báº¡n cÃ³ hiá»ƒn thá»‹ lá»—i dÆ°á»›i Ã´)
        }


        private async void TxtTheCau_TextChanged(object sender, TextChangedEventArgs e)
        {
            if (!_uiReady || _tabSwitching) return;

            var idx = CmbBetStrategy?.SelectedIndex ?? -1;       // 1: CL, 3: N/I
            var txt = (TxtTheCau?.Text ?? "").Trim();

            // LÆ°u tÃ¡ch báº¡ch cho tá»«ng chiáº¿n lÆ°á»£c
            if (idx == 1) _cfg.BetPatternsCL = txt;  // Chiáº¿n lÆ°á»£c 2: Tháº¿ C/L
            if (idx == 3) _cfg.BetPatternsNI = txt;  // Chiáº¿n lÆ°á»£c 4: Tháº¿ N/I

            // Báº£n â€œchungâ€ Ä‘á»ƒ engine Ä‘á»c khi cháº¡y
            _cfg.BetPatterns = txt;

            await SaveConfigAsync();                // <â€” GHI config.json
            ShowErrorsForCurrentStrategy();         // (náº¿u cÃ³)
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
                // KHÃ”NG set StaysOpen=false (WPF sáº½ quÄƒng NotSupported khi gÃ¡n qua .ToolTip)
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

            // Hiá»‡n tooltip ngay cáº£ khi control/parent bá»‹ IsEnabled=false
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

        // --- Hiá»ƒn thá»‹ lá»—i live theo chiáº¿n lÆ°á»£c Ä‘ang chá»n ---
        private void ShowErrorsForCurrentStrategy()
        {
            int idx = CmbBetStrategy?.SelectedIndex ?? 4;

            // Chuá»—i cáº§u (chiáº¿n lÆ°á»£c 1,3)
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

            // Tháº¿ cáº§u (chiáº¿n lÆ°á»£c 2,4)
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

            // Cá»­a Ä‘áº·t & tá»‰ lá»‡ (chiáº¿n lÆ°á»£c 17)
            if (idx == 16)
            {
                string s = (TxtSideRatio?.Text ?? "");
                bool ok = TaiXiuLiveSun.Tasks.SideRateParser.TryParse(s, out _, out var e3);
                SetError(LblSideRatioError, ok ? null : e3);
            }
            else
            {
                SetError(LblSideRatioError, null);
            }
        }

















    }

}










