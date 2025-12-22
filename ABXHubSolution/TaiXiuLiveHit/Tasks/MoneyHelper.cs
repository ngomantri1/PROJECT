using System;

namespace TaiXiuLiveHit.Tasks
{
    internal static class MoneyHelper
    {
        // ====== NEW: Logger d? b?n log ra file (g?n t? MainWindow) ======
        public static Action<string>? Logger { get; set; }
        public static bool S7ResetOnProfit { get; set; } = true;

        private static void S7Log(string msg)
        {
            try { Logger?.Invoke(msg); } catch { /* kh“ng d? crash */ }
        }

        // ====== NEW: 7. Th?ng d nh lˆn, thua gi? nguyˆn m?c ======
        // Ti?n th?ng t?m (netDelta) du?c c?ng d?n gi?ng ti?n th?ng hi?n t?i (da qua c—ng co ch? net/rounding ? UI).
        // Khi _s7TempProfit > 0 => reset v? m?c 1 (step=0) v… set _s7TempProfit = 0 d? b?t d?u t¡nh l?i.
        private static readonly object _s7Lock = new();
        private static double _s7TempNetDelta = 0;            // NEW: bi?n d—ng cho logic S7
        private static bool _s7NeedResetToLevel1 = false;

        public static void ResetTempProfitForWinUpLoseKeep()
        {
            double curTempNet;
            bool flag;

            lock (_s7Lock)
            {
                _s7TempNetDelta = 0;
                _s7NeedResetToLevel1 = false;

                curTempNet = _s7TempNetDelta;
                flag = _s7NeedResetToLevel1;
            }

            S7Log($"[S7] ResetTempProfit: _s7TempNetDelta={curTempNet:N0}, needReset={flag}");
        }


        /// <summary>
        /// G?i t? UI (UiAddWin) d? c?ng d?n ti?n th?ng t?m theo d£ng "net" dang hi?n th?.
        /// Ch?  p d?ng cho strategyId == "WinUpLoseKeep".
        /// </summary>
        public static void NotifyTempProfit(string strategyId, double netDelta)
        {
            if (!string.Equals(strategyId, "WinUpLoseKeep", StringComparison.OrdinalIgnoreCase))
                return;
            if (!S7ResetOnProfit)
                return;

            double curTempNet;
            bool flag;

            lock (_s7Lock)
            {
                _s7TempNetDelta += netDelta;

                // ? CH?T NGHI?P V?:
                // Ch? b?t reset khi v?a TH?NG (netDelta>0) v… sau khi c?ng xong t?ng t?m da DUONG.
                // N?u thua ho?c th?ng nhung t?ng t?m v?n <=0 th kh“ng reset.
                _s7NeedResetToLevel1 = (netDelta > 0 && _s7TempNetDelta > 0);

                curTempNet = _s7TempNetDelta;
                flag = _s7NeedResetToLevel1;
            }

            S7Log($"[S7] NotifyTempProfit: netDelta={netDelta:N0}, _s7TempNetDelta={curTempNet:N0}, needReset={flag}");
        }



         internal static bool ConsumeS7ResetFlag()
        {
            if (!S7ResetOnProfit)
                return false;

            bool consumed;
            double curTempNet;
            bool flag;

            lock (_s7Lock)
            {
                // ? Ch? consume khi flag dang b?t (t?c l…: v n v?a r?i th?ng v… t?ng t?m > 0)
                if (!_s7NeedResetToLevel1)
                {
                    consumed = false;
                    curTempNet = _s7TempNetDelta;
                    flag = _s7NeedResetToLevel1;
                }
                else
                {
                    _s7NeedResetToLevel1 = false;

                    // theo nghi?p v?: reset t?ng ti?n th?ng t?m v? 0
                    _s7TempNetDelta = 0;

                    consumed = true;
                    curTempNet = _s7TempNetDelta;
                    flag = _s7NeedResetToLevel1;
                }
            }

            if (consumed)
                S7Log($"[S7] ConsumeResetFlag: RESET _s7TempNetDelta=0 | _s7TempNetDelta={curTempNet:N0}, needReset={flag}");

            return consumed;
        }



        // ====== HÀM CHUNG CŨ (giữ nguyên) ======
        public static long CalcAmount(string strategyId, long[] seq, int step, bool v2DoublePhase)
        {
            if (seq == null || seq.Length == 0) return 1000L;
            step = Math.Clamp(step, 0, seq.Length - 1);
            var baseAmt = seq[step];
            return v2DoublePhase ? baseAmt * 2 : baseAmt;
        }

        // Cập nhật step/phase sau khi KẾT THÚC ván (khi biết win/lose)
        // win: true = thắng, false = thua, null = không xác định/không cược
        public static void UpdateAfterRound(string strategyId, long[] seq,
                                            ref int step, ref bool v2DoublePhase, bool? win)
        {
            int n = Math.Max(1, seq?.Length ?? 0);

            switch (strategyId ?? "IncreaseWhenLose")
            {
                case "IncreaseWhenLose":
                    if (win == true || win == null) step = 0;
                    else step = (step + 1) % n;
                    v2DoublePhase = false;
                    break;

                case "IncreaseWhenWin":
                    if (win == true) step = (step + 1) % n;
                    else if (win == false) step = 0;
                    v2DoublePhase = false;
                    break;

                case "Victor2":
                    if (win == true)
                    {
                        if (v2DoublePhase) { step = 0; v2DoublePhase = false; }
                        else { step = (step + 1) % n; v2DoublePhase = true; }
                    }
                    else if (win == false)
                    {
                        // thua ở phase nào cũng lên mức tiếp theo, bỏ phase
                        step = (step + 1) % n;
                        v2DoublePhase = false;
                    }
                    // win == null -> giữ nguyên
                    break;

                case "ReverseFibo":
                    if (win == true || win == null) step = 0;
                    else step = Math.Min(step + 1, n - 1); // dồn lên mức cao nhất rồi giữ nguyên
                    v2DoublePhase = false;
                    break;

                case "WinUpLoseKeep":
                    {
                        var beforeStep = step;

                        if (win == true)
                        {
                            // th?ng => lˆn m?c tru?c
                            step = (step + 1) % n;
                            S7Log($"[S7] UpdateAfterRound: WIN => step {beforeStep} -> {step}");

                            // n?u t?ng t?m sau th?ng da duong => reset v? m?c 1 v… reset t?ng t?m
                            if (ConsumeS7ResetFlag())
                            {
                                step = 0;
                                v2DoublePhase = false;
                                S7Log($"[S7] UpdateAfterRound: _s7TempNetDelta>0 => reset step -> level 1");
                                break;
                            }
                        }
                        else
                        {
                            // thua ho?c null => gi? nguyˆn m?c
                            S7Log($"[S7] UpdateAfterRound: win={win} => keep step={step}");
                        }

                        v2DoublePhase = false;
                        break;
                    }

                default:
                    if (win == true || win == null) step = 0;
                    else step = (step + 1) % n;
                    v2DoublePhase = false;
                    break;
            }
        }

        // ====== NEW: kiểu 5. Đa tầng chuỗi tiền ======
        // Lấy tiền sẽ đánh ở ván sắp tới, theo chuỗi & mức hiện tại
        public static long CalcAmountMultiChain(long[][] chains, int chainIndex, int levelIndex)
        {
            if (chains == null || chains.Length == 0)
                return 1000L;

            chainIndex = Math.Clamp(chainIndex, 0, chains.Length - 1);
            var chain = chains[chainIndex] ?? Array.Empty<long>();
            if (chain.Length == 0) return 1000L;

            levelIndex = Math.Clamp(levelIndex, 0, chain.Length - 1);
            return chain[levelIndex];
        }

        // Cập nhật trạng thái sau khi biết win/lose
        // chainTotals: tổng tiền của từng chuỗi (để so điều kiện quay về chuỗi trước)
        public static void UpdateAfterRoundMultiChain(
            long[][] chains,
            long[] chainTotals,
            ref int chainIndex,
            ref int levelIndex,
            ref double profitOnCurrentChain,
            bool? win)
        {
            int chainCount = chains?.Length ?? 0;
            if (chainCount == 0) return;

            chainIndex = Math.Clamp(chainIndex, 0, chainCount - 1);
            var curChain = chains[chainIndex] ?? Array.Empty<long>();
            if (curChain.Length == 0)
            {
                // nếu chuỗi rỗng thì ép về chuỗi 0
                chainIndex = 0;
                curChain = chains[0] ?? Array.Empty<long>();
            }

            levelIndex = Math.Clamp(levelIndex, 0, curChain.Length - 1);

            if (win == null)
                return;

            if (win == true)
            {
                // thắng: cần tính LỢI NHUẬN THỰC của chuỗi hiện tại
                // = mức vừa thắng - (tổng các mức đã đốt trong chính chuỗi này trước đó)
                int wonLevel = levelIndex;              // vd đang thắng ở mức 1 của chuỗi 2
                long justWon = curChain[wonLevel];      // số vừa thắng, vd 7000
                // reset mức trong chuỗi
                levelIndex = 0;

                if (chainIndex > 0)
                {
                    // tính tổng tiền đã thua trong chính chuỗi hiện tại từ khi vào chuỗi
                    long spentInThisChain = 0;
                    for (int i = 0; i < wonLevel; i++)
                        spentInThisChain += curChain[i];

                    double netWinOnThisChain = 0.98 * justWon - spentInThisChain;
                    if (netWinOnThisChain < 0)
                        netWinOnThisChain = 0;

                    // gom lợi nhuận thực vào quỹ của chuỗi hiện tại
                    profitOnCurrentChain += netWinOnThisChain;

                    // 1) tính NGƯỠNG về thẳng chuỗi 1 = tổng tất cả chuỗi từ 0..(chainIndex-1)
                    long needAllPrev = 0;
                    if (chainTotals != null && chainTotals.Length >= chainIndex)
                    {
                        for (int i = 0; i < chainIndex; i++)
                            needAllPrev += chainTotals[i];
                    }
                    else
                    {
                        for (int i = 0; i < chainIndex; i++)
                            needAllPrev += SumChain(chains[i]);
                    }
                    long need = 0;
                    if (chainTotals != null && chainIndex - 1 < chainTotals.Length)
                        need = chainTotals[chainIndex - 1];
                    else
                        need = SumChain(chains[chainIndex - 1]);

                    if (profitOnCurrentChain >= need)
                    {
                        // đủ điều kiện quay về chuỗi trước
                        chainIndex--;
                        levelIndex = 0;
                        profitOnCurrentChain = 0;
                    }
                }
                else
                {
                    // chuỗi 0 thì không cần gom
                    profitOnCurrentChain = 0;
                }
            }
            else
            {
                // thua
                if (levelIndex + 1 < curChain.Length)
                {
                    // thua nhưng chưa hết mức trong chuỗi -> lên mức trong cùng chuỗi
                    levelIndex++;
                }
                else
                {
                    // thua hết chuỗi hiện tại
                    if (chainIndex + 1 < chainCount)
                    {
                        // sang chuỗi kế tiếp
                        chainIndex++;
                        levelIndex = 0;
                        profitOnCurrentChain = 0;
                    }
                    else
                    {
                        // đang ở chuỗi cao nhất mà cũng thua hết → quay về chuỗi 0
                        chainIndex = 0;
                        levelIndex = 0;
                        profitOnCurrentChain = 0;
                    }
                }
            }
        }

        private static long SumChain(long[] chain)
        {
            if (chain == null) return 0;
            long s = 0;
            foreach (var x in chain) s += x;
            return s;
        }

        // ====== CÁC HÀM PHỤ CŨ (giữ nguyên) ======
        public static string DigitSeqToParity(string digits)  // "1234" -> "LCLC"
        {
            if (string.IsNullOrEmpty(digits)) return "";
            var s = digits.Trim();
            var arr = new char[s.Length];
            int k = 0;
            foreach (var ch in s)
            {
                if (ch == 'T') arr[k++] = 'T';
                else if (ch == 'X') arr[k++] = 'X';
                // khác -> bỏ qua
            }
            return new string(arr, 0, k);
        }

        public static string OppCL(string tx) => tx == "TAI" ? "XIU" : (tx == "XIU" ? "TAI" : tx);
        public static string ClCharToSide(char tx) => (tx == 'T') ? "TAI" : "XIU";
    }
}
