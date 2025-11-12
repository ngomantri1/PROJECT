using System;

namespace XocDiaLiveHit.Tasks
{
    internal static class MoneyHelper
    {
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

            // trạng thái CHỜ: không đánh
            if (chainIndex < 0 || levelIndex < 0)
                return 0L;

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

            // 0) nếu đang ở trạng thái CHỜ (vừa thua hết 1 chuỗi và đã chuyển sang chuỗi mới nhưng phải đợi thắng)
            if (levelIndex < 0)
            {
                // chỉ cần 1 ván thắng -> mở khoá chuỗi mới
                if (win == true)
                {
                    levelIndex = 0;
                    profitOnCurrentChain = 0;
                }
                // win == false hoặc null -> tiếp tục chờ
                return;
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

                    if (profitOnCurrentChain >= needAllPrev)
                    {
                        // đủ để bù hết tất cả chuỗi trước → về thẳng chuỗi 1
                        chainIndex = 0;
                        levelIndex = 0;
                        profitOnCurrentChain = 0;
                    }
                    else
                    {
                        // 2) nếu chưa đủ để về chuỗi 1 thì xét điều kiện cũ: về chuỗi ngay trước
                        long needPrev = 0;
                        if (chainTotals != null && chainIndex - 1 < chainTotals.Length)
                            needPrev = chainTotals[chainIndex - 1];
                        else
                            needPrev = SumChain(chains[chainIndex - 1]);

                        // yêu cầu mới: phải thắng gấp đôi tổng chuỗi trước
                        if (profitOnCurrentChain >= 2 * needPrev)
                        {
                            chainIndex--;
                            levelIndex = 0;
                            profitOnCurrentChain = 0;
                        }
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
                        // sang chuỗi kế tiếp NHƯNG phải chờ 1 tay thắng rồi mới đánh
                        chainIndex++;
                        levelIndex = -1;           // đánh dấu trạng thái CHỜ
                        profitOnCurrentChain = 0;
                    }
                    else
                    {
                        // đang ở chuỗi cao nhất mà cũng thua hết → quay về chuỗi 0 như cũ
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

        public static string DigitSeqToParity(string digits)
        {
            if (string.IsNullOrEmpty(digits)) return "";
            var s = digits.Trim();
            var arr = new char[s.Length];
            int k = 0;
            foreach (var ch in s)
            {
                if (ch == '0' || ch == '2' || ch == '4') arr[k++] = 'C';
                else if (ch == '1' || ch == '3') arr[k++] = 'L';
            }
            return new string(arr, 0, k);
        }

        public static string OppCL(string cl) => cl == "CHAN" ? "LE" : (cl == "LE" ? "CHAN" : cl);
        public static string ClCharToSide(char cl) => (cl == 'C') ? "CHAN" : "LE";
    }
}
