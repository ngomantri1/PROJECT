using System.Windows.Input;
namespace CryptoScanner.Desktop.Helpers;
public sealed class RelayCommand : ICommand
{
 readonly Action<object?> _execute; readonly Func<object?,bool>? _can;
 public RelayCommand(Action<object?> execute,Func<object?,bool>? can=null){_execute=execute;_can=can;}
 public bool CanExecute(object? p)=>_can?.Invoke(p)??true; public void Execute(object? p)=>_execute(p);
 public event EventHandler? CanExecuteChanged; public void RaiseCanExecuteChanged()=>CanExecuteChanged?.Invoke(this,EventArgs.Empty);
}
