using System.Collections.ObjectModel;
using System.Diagnostics;
using System.IO;
using System.Windows;
using CryptoScanner.Desktop.Helpers;
using CryptoScanner.Desktop.Models;
using CryptoScanner.Desktop.Services;
namespace CryptoScanner.Desktop.ViewModels;
public sealed class MainViewModel:ObservableObject
{
 readonly ScannerService _scanner=new(); readonly ExportService _export=new(); CancellationTokenSource? _cts; bool _busy; double _progress; string _status="Sẵn sàng"; string _btc="UNKNOWN"; int _scanned; DateTimeOffset? _updated;
 public ObservableCollection<ScanResult> Results {get;}=[]; public ScanResult? SelectedCoin {get;set;}
 public RelayCommand ScanCommand {get;} public RelayCommand CancelCommand {get;} public RelayCommand ExportCommand {get;} public RelayCommand OpenExportFolderCommand {get;}
 public MainViewModel(){ScanCommand=new(async _=>await ScanAsync(),_=>!_busy);CancelCommand=new(_=>_cts?.Cancel(),_=>_busy);ExportCommand=new(async _=>await ExportAsync(),_=>Results.Count>0&&!_busy);OpenExportFolderCommand=new(_=>OpenExportFolder());}
 public double Progress{get=>_progress;set=>Set(ref _progress,value);} public string StatusMessage{get=>_status;set=>Set(ref _status,value);} public string BtcRegime{get=>_btc;set=>Set(ref _btc,value);} public int ScannedCount{get=>_scanned;set=>Set(ref _scanned,value);} public int PassedCount=>Results.Count; public int BuyReadyCount=>Results.Count(x=>x.Status=="BUY_READY"); public string UpdatedAt=>_updated?.ToString("dd/MM/yyyy HH:mm")??"--";
 async Task ScanAsync(){_busy=true;RefreshCommands();_cts=new();Results.Clear();Raise(nameof(PassedCount));Raise(nameof(BuyReadyCount));try{AppLogger.Info("Scan command started");var p=new Progress<(double,string)>(x=>{Progress=x.Item1;StatusMessage=x.Item2;});var data=await _scanner.ScanAsync(p,_cts.Token);foreach(var x in data.Results)Results.Add(x);ScannedCount=data.Scanned;BtcRegime=data.BtcRegime;_updated=DateTimeOffset.Now;Raise(nameof(UpdatedAt));Raise(nameof(PassedCount));Raise(nameof(BuyReadyCount));AppLogger.Info($"Scan command completed; scanned={ScannedCount}; results={Results.Count}; logDir={AppLogger.LogDirectory}");}catch(OperationCanceledException){StatusMessage="Đã hủy.";AppLogger.Warn("Scan command canceled");}catch(Exception ex){StatusMessage="Lỗi: "+ex.Message;AppLogger.Error("Scan command failed",ex);MessageBox.Show(ex.ToString(),"Scanner error");}finally{_busy=false;RefreshCommands();}}
 async Task ExportAsync(){try{AppLogger.Info("Export command started");var path=await _export.ExportAsync(Results,BtcRegime,ScannedCount);StatusMessage="Đã xuất: "+path;MessageBox.Show(path,"Xuất JSON thành công");}catch(Exception ex){AppLogger.Error("Export command failed",ex);MessageBox.Show(ex.Message,"Export error");}}
 void OpenExportFolder(){try{Directory.CreateDirectory(ExportService.ExportDirectory);Process.Start(new ProcessStartInfo{FileName=ExportService.ExportDirectory,UseShellExecute=true});StatusMessage="Đã mở thư mục export: "+ExportService.ExportDirectory;AppLogger.Info("Opened export folder: "+ExportService.ExportDirectory);}catch(Exception ex){AppLogger.Error("Open export folder failed",ex);MessageBox.Show(ex.Message,"Open export folder error");}}
 void RefreshCommands(){ScanCommand.RaiseCanExecuteChanged();CancelCommand.RaiseCanExecuteChanged();ExportCommand.RaiseCanExecuteChanged();}
}
