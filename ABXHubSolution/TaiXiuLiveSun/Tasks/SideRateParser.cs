using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text.RegularExpressions;
using TaiXiuLiveSun;

namespace TaiXiuLiveSun.Tasks
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
@"TAI:1
XIU:1
CHAN:1
LE:1";

        private static readonly HashSet<string> AllowedSides = new(StringComparer.OrdinalIgnoreCase)
        {
            "TAI", "XIU", "CHAN", "LE"
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

            if (s == "TAI" || s == "BIG") return "TAI";
            if (s == "XIU" || s == "SMALL") return "XIU";
            if (s == "CHAN" || s == "EVEN") return "CHAN";
            if (s == "LE" || s == "ODD") return "LE";
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

            var tx = TaskUtil.DigitToTx(digit);
            if (tx == 'T') res.Add("TAI");
            else if (tx == 'X') res.Add("XIU");

            var parity = TaskUtil.DigitToParity(digit);
            if (parity == 'C') res.Add("CHAN");
            else if (parity == 'L') res.Add("LE");

            return res;
        }
    }
}
