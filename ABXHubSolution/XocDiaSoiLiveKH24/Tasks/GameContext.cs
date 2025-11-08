using System;
using System.Threading.Tasks;
using System.Windows.Threading;

namespace XocDiaSoiLiveKH24.Tasks
{
    public sealed class GameContext
    {
        // Lấy snapshot mới nhất từ MainWindow (thread-safe)
        public Func<CwSnapshot> GetSnap { get; init; }

        // Thực thi JS: trả về chuỗi (Web.ExecuteScriptAsync)
        public Func<string, Task<string>> EvalJsAsync { get; init; }

        // Ghi log ra UI/File tuỳ bạn
        public Action<string> Log { get; init; }

        // Dãy tiền + ngưỡng % còn lại để ra quyết định (0..1)
        public long[] StakeSeq { get; init; }
        public double DecisionPercent { get; init; }

        // Trạng thái chiến lược (lưu Step/PreferLarger/...)
        public DecisionState State { get; init; }
        // Kiểu quản lý vốn + input UI (nạp từ MainWindow)
        public string MoneyStrategyId { get; init; }   // "IncreaseWhenLose" | "IncreaseWhenWin" | "Victor2" | "ReverseFibo"
        public string BetSeq { get; init; }            // ô "CHUỖI CẦU" hoặc "Chuỗi N/I"
        public string BetPatterns { get; init; }       // ô "CÁC THẾ CẦU"

        // Tiện ích UI nếu cần
        public Dispatcher UiDispatcher { get; init; }

        // Cooldown setter (tuỳ MainWindow quản lý), có thể bỏ nếu để trong task
        public Func<bool> GetCooldown { get; init; }
        public Action<bool> SetCooldown { get; init; }

        // --- UI updaters (được gán từ MainWindow) ---
        public Action<string>? UiSetSide;     // "CHAN"/"LE" (cửa đang đánh)
        public Action<double>? UiSetStake;    // mức tiền đang đặt
        public Action<double>? UiAddWin;      // cộng/trừ tiền thắng lũy kế (cho phép âm)
        public Action<bool>? UiWinLoss;      // thằng và thua

    }
}
