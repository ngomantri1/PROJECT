using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text.RegularExpressions;
using TaiXiuLiveHit;

namespace TaiXiuLiveHit.Tasks
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
XIU:1";

        private static readonly HashSet<string> AllowedSides = new(StringComparer.OrdinalIgnoreCase)
        {
            "TAI", "XIU"
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
            if (s == "TAI" || s == "T") return "TAI";
            if (s == "XIU" || s == "XIUU" || s == "X") return "XIU";
            return "";
        }

        public static bool TryParse(string text, out List<SideRate> pairs, out string error)
        {
            pairs = new List<SideRate>();
            error = "";

            if (string.IsNullOrWhiteSpace(text))
            {
                error = "Khong duoc de trong Cua dat & ti le.";
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
                    error = $"Dong {lineNo}: Khong duoc dung dau ';'.";
                    return false;
                }

                var idx = line.IndexOf(':');
                if (idx <= 0 || idx == line.Length - 1)
                {
                    error = $"Dong {lineNo}: Phai co dang <cua>:<ti le>.";
                    return false;
                }

                var sideRaw = line[..idx].Trim();
                var ratioRaw = line[(idx + 1)..].Trim();

                var side = NormalizeSide(sideRaw);
                if (!AllowedSides.Contains(side))
                {
                    error = $"Dong {lineNo}: Cua \"{sideRaw}\" khong hop le.";
                    return false;
                }
                if (seen.Contains(side))
                {
                    error = $"Dong {lineNo}: Cua \"{sideRaw}\" bi trung.";
                    return false;
                }

                if (!int.TryParse(ratioRaw, NumberStyles.None, CultureInfo.InvariantCulture, out int ratio) || ratio <= 0)
                {
                    error = $"Dong {lineNo}: Ti le phai la so nguyen duong.";
                    return false;
                }

                seen.Add(side);
                pairs.Add(new SideRate(side, ratio));
            }

            if (pairs.Count == 0)
            {
                error = "Phai nhap it nhat 1 cua hop le.";
                return false;
            }

            return true;
        }

        public static HashSet<string> GetWinningSides(char result)
        {
            var winners = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            if (result == 'T') winners.Add("TAI");
            else if (result == 'X') winners.Add("XIU");
            return winners;
        }
    }
}
