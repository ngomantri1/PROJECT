using System.Windows.Input;

namespace CryptoScanner.Desktop.Helpers;

public sealed class AsyncRelayCommand : ICommand
{
 readonly Func<Task> _execute;
 readonly Func<bool>? _canExecute;
 readonly Action<Exception>? _onException;
 bool _isRunning;

 public AsyncRelayCommand(Func<Task> execute, Func<bool>? canExecute = null, Action<Exception>? onException = null)
 {
  _execute = execute;
  _canExecute = canExecute;
  _onException = onException;
 }

 public bool IsRunning
 {
  get => _isRunning;
  private set
  {
   if (_isRunning == value) return;
   _isRunning = value;
   RaiseCanExecuteChanged();
  }
 }

 public bool CanExecute(object? parameter) => !IsRunning && (_canExecute?.Invoke() ?? true);

 public async void Execute(object? parameter)
 {
  if (!CanExecute(parameter)) return;
  try
  {
   IsRunning = true;
   await _execute();
  }
  catch (Exception ex)
  {
   _onException?.Invoke(ex);
  }
  finally
  {
   IsRunning = false;
  }
 }

 public event EventHandler? CanExecuteChanged;

 public void RaiseCanExecuteChanged() => CanExecuteChanged?.Invoke(this, EventArgs.Empty);
}
