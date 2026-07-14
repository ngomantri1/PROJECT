using CryptoScanner.Desktop.Services;
using CryptoScanner.Desktop.ViewModels;
namespace CryptoScanner.Desktop;
public partial class MainWindow : System.Windows.Window
{
 public MainWindow(){ InitializeComponent(); DataContext = new MainViewModel(); AppLogger.Info("MainWindow initialized"); }
}
