using System.ComponentModel;
using System.Runtime.CompilerServices;
using System.Windows.Media;

namespace HitTaiXiuLive
{
    // ViewModel nhỏ cho icon chuỗi (T/X, Win/Lose ...) – khớp code đang set ImageSource
    public sealed class SeqIconVM : INotifyPropertyChanged
    {
        private ImageSource? _img;
        private bool _isLatest;

        public ImageSource? Img
        {
            get => _img;
            init { _img = value; OnPropertyChanged(); }
        }

        public bool IsLatest
        {
            get => _isLatest;
            init { _isLatest = value; OnPropertyChanged(); }
        }

        public event PropertyChangedEventHandler? PropertyChanged;
        private void OnPropertyChanged([CallerMemberName] string? name = null)
            => PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
    }
}
