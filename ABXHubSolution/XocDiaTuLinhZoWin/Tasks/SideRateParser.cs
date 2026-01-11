using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text.RegularExpressions;
using XocDiaTuLinhZoWin;

namespace XocDiaTuLinhZoWin.Tasks
{
    internal sealed class SideRate
    {
        public SideRate(string side, int ratio)
        {
            Side = side;
            Ratio = ratio;
        }

        public string Side { get; }
        public int Ratio { get; }
    }

    internal static class SideRateParser
    {
public const string DefaultText =
@"4DO:1
4TRANG:1
1TRANG3DO:2
1DO3TRANG:2
CHAN:6
LE:4";

        private static readonly HashSet<string> AllowedSides = new(StringComparer.OrdinalIgnoreCase)
        {
            "CHAN", "LE", "TRANG3_DO1", "DO3_TRANG1", "TU_TRANG", "TU_DO"
        };

        private static string NormalizeRaw(string raw)
        {
            var noAccent = TextNorm.RemoveDiacritics(raw ?? "");
            var upper = noAccent.ToUpperInvariant();
            return Regex.Replace(upper, "[^A-Z0-9]+", "_");
        }

        public static string NormalizeSide(string raw)
        {
            if (string.IsNullOrWhiteSpace(raw)) return "";
            var s = NormalizeRaw(raw);

            if (s == "CHAN" || s == "EVEN") return "CHAN";
            if (s == "LE" || s == "ODD") return "LE";
            if (s == "TRANG3_DO1" || s == "3TRANG1DO" || s == "3T1D" || s == "3W1R" || s == "1DO3TRANG" || s == "1D3T" || s == "1R3W") return "TRANG3_DO1";
            if (s == "DO3_TRANG1" || s == "3DO1TRANG" || s == "3D1T" || s == "3R1W" || s == "1TRANG3DO" || s == "1T3D" || s == "1W3R") return "DO3_TRANG1";
            if (s == "TU_TRANG" || s == "TUTRANG" || s == "4TRANG" || s == "4W") return "TU_TRANG";
            if (s == "TU_DO" || s == "TUDO" || s == "4DO" || s == "4R") return "TU_DO";
            return "";
        }

        public static bool TryParse(string text, out List<SideRate> pairs, out string error)
        {
            pairs = new List<SideRate>();
            error = "";

            if (string.IsNullOrWhiteSpace(text))
            {
                error = "Không được để trống Cửa đặt & tỉ lệ.";
                return false;
            }

            var lines = text.Replace("\r", "").Split('\n');
            var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            int lineNo = 0;
            foreach (var rawLine in lines)
            {
                lineNo++;
                var line = rawLine.Trim();
                if (string.IsNullOrEmpty(line)) continue;
                if (line.Contains(";"))
                {
                    error = $"Dòng {lineNo}: Không được dùng dấu ';'.";
                    return false;
                }

                var idx = line.IndexOf(':');
                if (idx <= 0 || idx == line.Length - 1)
                {
                    error = $"Dòng {lineNo}: Phải có dạng <cửa>:<tỉ lệ>.";
                    return false;
                }

                var sideRaw = line[..idx].Trim();
                var ratioRaw = line[(idx + 1)..].Trim();

                var side = NormalizeSide(sideRaw);
                if (!AllowedSides.Contains(side))
                {
                    error = $"Dòng {lineNo}: Cửa \"{sideRaw}\" không hợp lệ.";
                    return false;
                }
                if (seen.Contains(side))
                {
                    error = $"Dòng {lineNo}: Cửa \"{sideRaw}\" bị trùng.";
                    return false;
                }

                if (!int.TryParse(ratioRaw, NumberStyles.None, CultureInfo.InvariantCulture, out int ratio) || ratio <= 0)
                {
                    error = $"Dòng {lineNo}: Tỉ lệ phải là số nguyên dương.";
                    return false;
                }

                seen.Add(side);
                pairs.Add(new SideRate(side, ratio));
            }

            if (pairs.Count == 0)
            {
                error = "Phải nhập ít nhất 1 cửa hợp lệ.";
                return false;
            }

            return true;
        }

        public static HashSet<string> GetWinningSides(char digit)
        {
            var res = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            if (digit == '0') res.Add("TU_TRANG");
            else if (digit == '4') res.Add("TU_DO");
            else if (digit == '1') res.Add("DO3_TRANG1");
            else if (digit == '3') res.Add("TRANG3_DO1");

            var parity = TaskUtil.DigitToParity(digit);
            if (parity == 'C') res.Add("CHAN");
            else if (parity == 'L') res.Add("LE");

            return res;
        }
    }
}
