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

            // MỚI: nếu mức hiện tại là 0 hoặc 1 -> không đánh (đứng chờ)
            if (chain[levelIndex] == 0 || chain[levelIndex] == 1)
                return 0L;

            return chain[levelIndex];
        }

        // Điều khiển số ván THẮNG cần để thoát trạng thái CHỜ (MultiChain)
        private static int _mcNextWaitN = 2;          // n cho LẦN THUA kế tiếp (ban đầu = 2)
        private static int _mcWaitWinsTarget = 0;     // số ván THẮNG LIÊN TIẾP CẦN để thoát CHỜ trong lần này
        private static int _mcWaitWinsRemaining = 0;  // số ván THẮNG LIÊN TIẾP đã có (từ khi bắt đầu CHỜ)

        /// <summary>
        /// Gọi khi THUA và cần vào trạng thái CHỜ:
        ///   - dùng _mcNextWaitN cho lần chờ hiện tại
        ///   - sau đó đảo n: 2 → 1 → 2 → 1 → ...
        /// </summary>
        private static void McEnterWaitAfterLoss()
        {
            // nếu lỡ bị set linh tinh thì fallback = 1
            _mcWaitWinsTarget = (_mcNextWaitN <= 0) ? 1 : _mcNextWaitN;
            _mcWaitWinsRemaining = 0; // bắt đầu lại chuỗi THẮNG liên tiếp
            _mcNextWaitN = (_mcNextWaitN == 2) ? 1 : 2; // chuẩn bị n cho lần THUA kế tiếp
        }

        /// <summary>
        /// Gọi khi vào trạng thái CHỜ nhưng KHÔNG phải do THUA
        /// (giữ behaviour cũ: chỉ cần 1 ván thắng là mở khóa).
        /// </summary>
        private static void McEnterWaitFixedOne()
        {
            _mcWaitWinsTarget = 1;   // trường hợp này vẫn chỉ cần 1 ván THẮNG LIÊN TIẾP
            _mcWaitWinsRemaining = 0;
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

            // 0) nếu đang ở trạng thái CHỜ (vừa thua hết 1 chuỗi / guard) thì KHÔNG đánh
            if (levelIndex < 0)
            {
                // Backward-compat: nếu chưa có target rõ ràng thì mặc định chờ 1 ván THẮNG LIÊN TIẾP
                if (_mcWaitWinsTarget <= 0)
                    _mcWaitWinsTarget = 1;

                if (win == true)
                {
                    // tăng chuỗi THẮNG liên tiếp
                    _mcWaitWinsRemaining++;

                    if (_mcWaitWinsRemaining >= _mcWaitWinsTarget)
                    {
                        // đủ số ván THẮNG LIÊN TIẾP đã cấu hình (n = 2 hoặc 1) -> mở khóa chuỗi mới
                        levelIndex = 0;
                        profitOnCurrentChain = 0;
                        _mcWaitWinsRemaining = 0;
                        _mcWaitWinsTarget = 0;
                    }
                }
                else if (win == false)
                {
                    // THUA trong lúc CHỜ -> reset chuỗi THẮNG liên tiếp
                    _mcWaitWinsRemaining = 0;
                }
                // win == null -> không thắng, không thua: giữ nguyên chuỗi hiện tại, tiếp tục chờ
                return;
            }


            levelIndex = Math.Clamp(levelIndex, 0, curChain.Length - 1);

            // 0b) MỚI: nếu mức hiện tại là 0 -> logic "đợi thắng rồi mới đánh mức kế tiếp"
            if (curChain[levelIndex] == 0)
            {
                if (win == true)
                {
                    // nhảy sang mức kế tiếp trong cùng chuỗi
                    if (levelIndex + 1 < curChain.Length)
                    {
                        levelIndex++;
                    }
                    else
                    {
                        // đang ở 0 cuối chuỗi -> sang chuỗi kế tiếp ở trạng thái CHỜ
                        if (chainIndex + 1 < chainCount)
                        {
                            chainIndex++;
                            levelIndex = -1;          // sang chuỗi mới trong trạng thái CHỜ
                            McEnterWaitFixedOne();    // trường hợp này vẫn chỉ chờ 1 ván THẮNG như cũ
                            profitOnCurrentChain = 0;
                        }
                        else
                        {
                            // đã ở chuỗi cuối cùng và cũng ở mức cuối (0) -> reset an toàn
                            chainIndex = 0;
                            levelIndex = 0;
                            profitOnCurrentChain = 0;
                        }
                    }
                }
                // win == false hoặc null -> đứng im tại mức 0 để chờ
                return;
            }
            // 0c) MỚI: nếu mức hiện tại là 1 -> logic "đợi THUA rồi mới đánh mức kế tiếp"
            if (curChain[levelIndex] == 1)
            {
                if (win == false)
                {
                    // thua -> nhảy sang mức kế tiếp trong cùng chuỗi
                    if (levelIndex + 1 < curChain.Length)
                    {
                        levelIndex++;
                    }
                    else
                    {
                        // đang ở 1 cuối chuỗi -> sang chuỗi kế tiếp ở trạng thái CHỜ
                        if (chainIndex + 1 < chainCount)
                        {
                            chainIndex++;
                            levelIndex = -1;          // trạng thái CHỜ sau khi THUA ở mức 1 cuối chuỗi
                            McEnterWaitAfterLoss();   // thua -> chờ n ván THẮNG (n = 2,1,2,1,...)
                            profitOnCurrentChain = 0;
                        }
                        else
                        {
                            // đã ở chuỗi cuối cùng và cũng ở mức cuối (1) -> reset an toàn
                            chainIndex = 0;
                            levelIndex = 0;
                            profitOnCurrentChain = 0;
                        }
                    }
                }
                // win == true hoặc null -> tiếp tục chờ tại mức 1
                return;
            }


            if (win == null)
                return;

            if (win == true)
            {
                // thắng: cần tính LỢI NHUẬN THỰC của chuỗi hiện tại
                // = mức vừa thắng - (tổng các mức đã đốt trong chính chuỗi này trước đó)
                int wonLevel = levelIndex;              // vd đang thắng ở mức j của chuỗi i
                long justWon = curChain[wonLevel];      // số vừa thắng
                // trong 1 chuỗi: thắng -> về mức đầu
                levelIndex = 0;

                if (chainIndex > 0)
                {
                    // tổng tiền đã thua trong chính chuỗi hiện tại trước khi thắng
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
                        if (profitOnCurrentChain >= needPrev)
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
                        // sang chuỗi kế tiếp NHƯNG phải chờ n tay THẮNG rồi mới đánh (n = 2,1,2,1,...)
                        chainIndex++;
                        levelIndex = -1;           // đánh dấu trạng thái CHỜ
                        McEnterWaitAfterLoss();    // mỗi lần THUA: chờ n ván THẮNG mới đánh lại
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
