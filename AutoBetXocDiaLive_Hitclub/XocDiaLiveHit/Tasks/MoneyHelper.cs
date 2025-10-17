using System;

namespace XocDiaLiveHit.Tasks
{
    internal static class MoneyHelper
    {
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

        public static string DigitSeqToParity(string digits)  // "1234" -> "LCLC"
        {
            if (string.IsNullOrEmpty(digits)) return "";
            var s = digits.Trim();
            var arr = new char[s.Length];
            int k = 0;
            foreach (var ch in s)
            {
                if (ch == '0' || ch == '2' || ch == '4') arr[k++] = 'C';
                else if (ch == '1' || ch == '3') arr[k++] = 'L';
                // khác -> bỏ qua
            }
            return new string(arr, 0, k);
        }

        public static string OppCL(string cl) => cl == "CHAN" ? "LE" : (cl == "LE" ? "CHAN" : cl);
        public static string ClCharToSide(char cl) => (cl == 'C') ? "CHAN" : "LE";
    }
}
