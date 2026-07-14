using System.Windows;
using System.Windows.Threading;
using CryptoScanner.Desktop.Services;

namespace CryptoScanner.Desktop;
public partial class App : Application
{
 protected override void OnStartup(StartupEventArgs e)
 {
  base.OnStartup(e);
  AppLogger.Info("Application started; logPath="+AppLogger.CurrentLogPath);
  DispatcherUnhandledException+=OnDispatcherUnhandledException;
  AppDomain.CurrentDomain.UnhandledException+=OnUnhandledException;
  TaskScheduler.UnobservedTaskException+=OnUnobservedTaskException;
 }

 protected override void OnExit(ExitEventArgs e)
 {
  AppLogger.Info("Application exited; code="+e.ApplicationExitCode);
  base.OnExit(e);
 }

 void OnDispatcherUnhandledException(object sender,DispatcherUnhandledExceptionEventArgs e)
 {
  AppLogger.Error("Unhandled UI exception",e.Exception);
 }

 void OnUnhandledException(object sender,UnhandledExceptionEventArgs e)
 {
  AppLogger.Error("Unhandled domain exception; terminating="+e.IsTerminating,e.ExceptionObject as Exception);
 }

 void OnUnobservedTaskException(object? sender,UnobservedTaskExceptionEventArgs e)
 {
  AppLogger.Error("Unobserved task exception",e.Exception);
 }
}
