using System;
using System.Globalization;
using System.Windows.Data;

namespace XocDiaLiveHit
{
    public class ProgressWidthConverter : IMultiValueConverter
    {
        // values[0] = Track.ActualWidth, values[1] = Value, values[2] = Minimum, values[3] = Maximum
        public object Convert(object[] values, Type targetType, object parameter, CultureInfo culture)
        {
            if (values == null || values.Length < 4) return 0d;
            double track = ToDouble(values[0]);
            double value = ToDouble(values[1]);
            double min = ToDouble(values[2]);
            double max = ToDouble(values[3]);

            if (track <= 0 || max <= min) return 0d;
            var ratio = (value - min) / (max - min);
            if (ratio < 0) ratio = 0; else if (ratio > 1) ratio = 1;
            return track * ratio;
        }

        public object[] ConvertBack(object value, Type[] targetTypes, object parameter, CultureInfo culture)
            => throw new NotImplementedException();

        private static double ToDouble(object x)
            => x is double d ? d : (x is float f ? f : (x is IConvertible c ? c.ToDouble(CultureInfo.InvariantCulture) : 0d));
    }
}
