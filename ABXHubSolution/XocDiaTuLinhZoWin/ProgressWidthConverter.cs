using System;
using System.Globalization;
using System.Linq;
using System.Windows.Data;

namespace XocDiaTuLinhZoWin
{
    /// <summary>
    /// Converter tính chiều rộng tiến độ.
    /// Hỗ trợ:
    ///   - MultiBinding: values[0] = ActualWidth, values[1] = percent (0..1), values[2] = minWidth (optional)
    ///   - Binding đơn:  value     = percent (0..1), parameter = ActualWidth (hoặc "w=...,min=...")
    /// </summary>
    public sealed class ProgressWidthConverter : IValueConverter, IMultiValueConverter
    {
        // ===== Binding đơn =====
        public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
        {
            double percent = ToDouble(value, 0);
            percent = Clamp01(percent);

            double actualWidth = ParseWidthParam(parameter);
            if (double.IsNaN(actualWidth) || actualWidth <= 0) return 0d;

            return actualWidth * percent;
        }

        public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
            => Binding.DoNothing;

        // ===== MultiBinding =====
        public object Convert(object[] values, Type targetType, object parameter, CultureInfo culture)
        {
            // patterns thường gặp:
            // [0]=ActualWidth, [1]=Percent(0..1), [2]=MinWidth (optional)
            double actualWidth = ToDouble(values, 0, double.NaN);
            double percent = ToDouble(values, 1, 0);
            double minWidth = ToDouble(values, 2, 0);

            percent = Clamp01(percent);

            if (double.IsNaN(actualWidth) || actualWidth <= 0) return 0d;

            double w = actualWidth * percent;
            if (!double.IsNaN(minWidth) && minWidth > 0 && w < minWidth) w = minWidth;

            return w;
        }

        public object[] ConvertBack(object value, Type[] targetTypes, object parameter, CultureInfo culture)
            => null;

        // ===== helpers =====
        private static double Clamp01(double v)
        {
            if (double.IsNaN(v)) return 0;
            if (v < 0) return 0;
            if (v > 1) return 1;
            return v;
        }

        private static double ToDouble(object[] arr, int index, double def = double.NaN)
        {
            if (arr == null || index < 0 || index >= arr.Length) return def;
            return ToDouble(arr[index], def);
        }

        private static double ToDouble(object obj, double def = double.NaN)
        {
            try
            {
                if (obj == null) return def;
                switch (obj)
                {
                    case double d: return d;
                    case float f: return f;
                    case int i: return i;
                    case long l: return l;
                    case decimal m: return (double)m;
                }
                var s = obj.ToString();
                if (string.IsNullOrWhiteSpace(s)) return def;
                if (double.TryParse(s, NumberStyles.Any, CultureInfo.InvariantCulture, out var v)) return v;
                if (double.TryParse(s, NumberStyles.Any, CultureInfo.CurrentCulture, out v)) return v;
                return def;
            }
            catch { return def; }
        }

        private static double ParseWidthParam(object parameter)
        {
            // chấp nhận: số thuần, hoặc "w=123;min=6"
            if (parameter == null) return double.NaN;
            if (parameter is double d) return d;

            var s = parameter.ToString();
            if (string.IsNullOrWhiteSpace(s)) return double.NaN;

            if (double.TryParse(s, NumberStyles.Any, CultureInfo.InvariantCulture, out var n))
                return n;

            var parts = s.Split(new[] { ';', ',' }, StringSplitOptions.RemoveEmptyEntries)
                         .Select(p => p.Split('='))
                         .Where(kv => kv.Length == 2)
                         .ToDictionary(kv => kv[0].Trim().ToLowerInvariant(),
                                       kv => kv[1].Trim());

            if (parts.TryGetValue("w", out var ws) &&
                double.TryParse(ws, NumberStyles.Any, CultureInfo.InvariantCulture, out var w))
                return w;

            return double.NaN;
        }
    }
}
