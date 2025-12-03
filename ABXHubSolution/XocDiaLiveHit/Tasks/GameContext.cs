using System;
using System.Threading.Tasks;
using System.Collections.Generic;
using System.Windows.Threading;

namespace XocDiaLiveHit.Tasks
{
    public sealed class GameContext
    {
        // Lấy snapshot mới nhất từ MainWindow (thread-safe)
        public Func<CwSnapshot> GetSnap { get; init; }

        // Thực thi JS: trả về chuỗi (Web.ExecuteScriptAsync)
        public Func<string, Task<string>> EvalJsAsync { get; init; }

        // Ghi log ra UI/File tuỳ bạn
        public Action<string> Log { get; init; }

        // Dãy tiền 1 chiều (giữ lại để tương thích)
        public long[] StakeSeq { get; init; }

        // ====== NEW: dãy tiền nhiều chuỗi (mỗi dòng 1 chuỗi) ======
        // Ví dụ:
        // [ [1000,2000,4000,8000],
        //   [2000,4000,8000,16000] ]
        public long[][] StakeChains { get; init; } = Array.Empty<long[]>();

        // Tổng tiền của từng chuỗi, dùng để so điều kiện "chuỗi sau thắng >= tổng chuỗi trước thì lùi về"
        public long[] StakeChainTotals { get; init; } = Array.Empty<long>();

        // ====== NEW: trạng thái runtime riêng cho quản lý vốn đa tầng ======
        // đang ở chuỗi thứ mấy (0-based)
        public int MoneyChainIndex { get; set; } = 0;
        // đang ở mức thứ mấy trong chuỗi đó (0-based)
        public int MoneyChainStep { get; set; } = 0;
        // tiền thắng đã tích lũy được trong chuỗi hiện tại
        public double MoneyChainProfit { get; set; } = 0;

        // Ngưỡng % còn lại để ra quyết định
        public double DecisionPercent { get; init; }

        // Trạng thái chiến lược (lưu Step/PreferLarger/.)
        public DecisionState State { get; init; }

        // Kiểu quản lý vốn + input UI (nạp từ MainWindow)
        // "IncreaseWhenLose" | "IncreaseWhenWin" | "Victor2" | "ReverseFibo" | "IncreaseEveryRound" | "MultiChain"
        public string MoneyStrategyId { get; init; }


        public string SideRateText { get; init; } = "";
        public bool UseRawWinAmount { get; init; } = false;
        public string BetSeq { get; init; }       // ô "CHUỖI CẦU" hoặc "Chuỗi N/I"
        public string BetPatterns { get; init; }  // ô "CÁC THẾ CẦU"
        public Action<HashSet<string>, string>? UiFinalizeMultiBet { get; init; }

        // Tiện ích UI nếu cần
        public Dispatcher UiDispatcher { get; init; }

        // Cooldown setter (tuỳ MainWindow quản lý)
        public Func<bool> GetCooldown { get; init; }
        public Action<bool> SetCooldown { get; init; }

        // --- UI updaters (được gán từ MainWindow) ---
        public Action<string>? UiSetSide;     // "CHAN"/"LE"
        public Action<double>? UiSetStake;    // tiền đang đánh
        public Action<double>? UiAddWin;      // cộng/trừ tiền thắng lũy kế
        public Action<bool>? UiWinLoss;       // true = win, false = loss
    }
}
