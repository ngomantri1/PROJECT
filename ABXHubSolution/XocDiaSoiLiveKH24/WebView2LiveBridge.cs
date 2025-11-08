using System;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf;

namespace XocDiaSoiLiveKH24
{
    internal sealed class WebView2LiveBridge
    {
        private readonly WebView2 _web;
        private readonly Action<string>? _log;   // callback log từ MainWindow
        private CoreWebView2? _core;

        private string? _idTopForward;
        private string? _idAppJs;
        private bool _frameHooked;
        private string? _lastDocKey;

        private string _appJs;                   // nội dung v4_js_xoc_dia_live.js
        private readonly SemaphoreSlim _gate = new(1, 1);

        public WebView2LiveBridge(WebView2 web, string appJs, Action<string>? logger = null)
        {
            _web = web;
            _appJs = appJs ?? "";
            _log = logger;
        }

        // ====== JS ======
        private const string TOP_FORWARD = @"
(function(){
  try{
    if (window.__abxTopForward) return; window.__abxTopForward = 1;
    // capture-phase để tránh trang chặn
    window.addEventListener('message', function(ev){
      try{
        var d = ev && ev.data; if(!d) return;
        var s = (typeof d==='string') ? d : JSON.stringify(d);
        if (window.chrome && window.chrome.webview && window.chrome.webview.postMessage){
          window.chrome.webview.postMessage(s);
        }
      }catch(_){}
    }, true);

    // mirror window.postMessage ra host (không bắt buộc, nhưng giúp debug)
    try{
      var __origPost = window.postMessage.bind(window);
      window.postMessage = function(v,t){
        try{
          var s=(typeof v==='string')?v:JSON.stringify(v);
          if (s && window.chrome && window.chrome.webview){
            window.chrome.webview.postMessage(s);
          }
        }catch(_){}
        return __origPost(v,t);
      };
    }catch(_){}
  }catch(_){}
})();";

        private const string FRAME_SHIM = @"
(function(){
  try{
    if (window.__abxShim) return; window.__abxShim = 1;

    // Patch chrome.webview.postMessage: nếu lỗi -> rơi lên parent.postMessage
    try{
      if (window.chrome && window.chrome.webview && typeof window.chrome.webview.postMessage === 'function'){
        var __orig = window.chrome.webview.postMessage.bind(window.chrome.webview);
        window.chrome.webview.postMessage = function(p){
          try{ __orig(p); }
          catch(e){
            try{ parent.postMessage((typeof p==='string'? JSON.parse(p):p), '*'); }
            catch(_){ try{ parent.postMessage({abx:'raw', value:String(p)}, '*'); }catch(__){} }
          }
        };
      }
    }catch(_){}

    // Forward mọi message trong frame lên top/host (capture-phase)
    try{
      window.addEventListener('message', function(ev){
        try{
          var d = ev && ev.data; if(!d) return;
          var s = (typeof d==='string') ? d : JSON.stringify(d);
          if (window.chrome && window.chrome.webview) {
            window.chrome.webview.postMessage(s);
          } else {
            try { parent.postMessage(d, '*'); } catch(_){}
          }
        }catch(_){}
      }, true);
    }catch(_){}
  }catch(_){}
})();";

        private const string FRAME_AUTOSTART = @"
(function(){
  try{
    var key = String((performance && performance.timeOrigin) || Date.now());
    if (window.__cw_autostart_key === key) return;
    window.__cw_autostart_key = key;

    var delay=300, tries=0;
    (function tick(){
      try{
        if (window.__cw_startPush && window.cc && cc.director && cc.director.getScene){
          try{ window.__cw_startPush(240); }catch(_){}
          return;
        }
      }catch(_){}
      tries++; delay = Math.min(5000, delay + (tries<10?100:500));
      setTimeout(tick, delay);
    })();
  }catch(_){}
})();";

        // ===== API =====
        public async Task EnsureAsync()
        {
            await _gate.WaitAsync();
            try
            {
                await _web.EnsureCoreWebView2Async();
                if (!ReferenceEquals(_core, _web.CoreWebView2))
                {
                    _core = _web.CoreWebView2;
                    _core.Settings.IsWebMessageEnabled = true;

                    _idTopForward = null;
                    _idAppJs = null;
                    _frameHooked = false;
                    _lastDocKey = null;
                    _log?.Invoke("[Bridge] CoreWebView2 bound.");
                }

                if (_idTopForward == null)
                    _idTopForward = await _core!.AddScriptToExecuteOnDocumentCreatedAsync(TOP_FORWARD);

                if (_idAppJs == null && !string.IsNullOrEmpty(_appJs))
                    _idAppJs = await _core!.AddScriptToExecuteOnDocumentCreatedAsync(_appJs);

                if (!_frameHooked)
                {
                    _core!.FrameCreated += OnFrameCreated;
                    _frameHooked = true;
                }
            }
            finally
            {
                _gate.Release();
            }
        }

        public async Task ForceRefreshAsync()
        {
            await EnsureAsync();
            await ClearAutostartFlagsAsync();
            await InjectIfNewDocAsync();
        }

        public async Task InjectIfNewDocAsync()
        {
            if (_core == null) return;

            string key;
            try
            {
                var json = await _core.ExecuteScriptAsync("(function(){try{return String(performance.timeOrigin)}catch(_){return String(Date.now())}})()");
                key = JsonSerializer.Deserialize<string>(json) ?? "";
            }
            catch { key = ""; }

            if (!string.IsNullOrEmpty(key) && key != _lastDocKey)
            {
                await _core.ExecuteScriptAsync(TOP_FORWARD);
                if (!string.IsNullOrEmpty(_appJs))
                    await _core.ExecuteScriptAsync(_appJs);
                _lastDocKey = key;
                _log?.Invoke("[Bridge] Injected on current doc, key=" + key);
            }
        }

        public async Task UpdateAppJsAsync(string newJs)
        {
            _appJs = newJs ?? "";
            if (_core == null) return;

            if (_idAppJs != null)
                _core.RemoveScriptToExecuteOnDocumentCreated(_idAppJs);
            _idAppJs = null;

            if (!string.IsNullOrEmpty(_appJs))
                _idAppJs = await _core.AddScriptToExecuteOnDocumentCreatedAsync(_appJs);

            await _core.ExecuteScriptAsync(_appJs);
            _log?.Invoke("[Bridge] Updated AppJS and reinjected.");
        }

        private async void OnFrameCreated(object? sender, CoreWebView2FrameCreatedEventArgs e)
        {
            try
            {
                _ = e.Frame.ExecuteScriptAsync(FRAME_SHIM);

                try
                {
                    var mi = e.Frame.GetType().GetMethod("AddScriptToExecuteOnDocumentCreatedAsync");
                    if (mi != null && !string.IsNullOrEmpty(_appJs))
                        _ = (Task)mi.Invoke(e.Frame, new object[] { _appJs })!;
                }
                catch { }

                if (!string.IsNullOrEmpty(_appJs))
                    _ = e.Frame.ExecuteScriptAsync(_appJs);

                _ = e.Frame.ExecuteScriptAsync(FRAME_AUTOSTART);

                _log?.Invoke("[Bridge] Frame injected + autostart armed.");
            }
            catch (Exception ex)
            {
                _log?.Invoke("[Bridge.FrameCreated] " + ex.Message);
            }
        }

        public async Task ClearAutostartFlagsAsync()
        {
            if (_core == null) return;
            const string JS = @"
(function(){
  try{
    try{ window.__cw_autostart_key  = ''; }catch(_){}
    try{ clearInterval(window.__cw_pushTid); }catch(_){}
    try{ window.__cw_pushTid = 0; }catch(_){}
    var msg = { __cw_cmd:'clear_autostart' };
    var n=0,max=8,delay=150;
    (function blast(){
      try{ for (var i=0;i<window.frames.length;i++){ try{ window.frames[i].postMessage(msg,'*'); }catch(_){}} }catch(_){}
      if(++n<max) setTimeout(blast, delay);
    })();
  }catch(_){}
})();";
            try { await _core.ExecuteScriptAsync(JS); } catch { }
        }
    }
}
