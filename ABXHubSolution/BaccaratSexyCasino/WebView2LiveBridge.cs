using System;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf;

namespace BaccaratSexyCasino
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
    var __abxTopForwardAlready = !!window.__abxTopForward;
    if (!window.__abxTopForward) window.__abxTopForward = 1;
    function __abxCwHref(w){ try{ return String((w.location && w.location.href) || ''); }catch(_){ return ''; } }
    function __abxCwIsWebMain(h){ return /\/player\/webMain\.jsp/i.test(String(h || '')); }
    function __abxCwVisibleScore(item){
      try{
        var s = 0;
        var w = item && item.win;
        var root = item && item.root;
        var hiddenByTop = root && root.getAttribute && root.getAttribute('data-abx-hidden-by-top') === '1';
        if (root && root.getBoundingClientRect && !hiddenByTop){
          var rr = root.getBoundingClientRect();
          s += (rr && rr.width > 20 && rr.height > 20) ? 2000 : -5000;
        }
        var fe = null;
        try{ fe = w && w.frameElement; }catch(_){ fe = null; }
        if (!fe) return s + 80000;
        var fr = fe.getBoundingClientRect ? fe.getBoundingClientRect() : null;
        var topw = null;
        try{ topw = w.top || window.top || window; }catch(_){ topw = window; }
        var vw = Number((topw && topw.innerWidth) || 1920) || 1920;
        var vh = Number((topw && topw.innerHeight) || 1080) || 1080;
        var cs = null;
        try{ cs = topw.getComputedStyle ? topw.getComputedStyle(fe) : null; }catch(_){ cs = null; }
        var cssVisible = !cs || (cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity || 1) > 0.02);
        var rectVisible = !!(fr && fr.width > 20 && fr.height > 20 && fr.right > 0 && fr.bottom > 0 && fr.left < vw && fr.top < vh);
        return s + ((cssVisible && rectVisible) ? 80000 : -250000);
      }catch(_){ return 0; }
    }
    function __abxCwDataScore(item){
      try{
        var h = String((item && item.href) || '');
        var p = String((item && item.path) || '');
        var t = String((item && item.text) || '');
        var hasDomCards = /Baccarat DOM cards/i.test(t);
        var hasRealSeq = /SEQ\s*:\s*[BPT]{2,}|Chuỗi kết quả\s*:\s*[BPT]{2,}|Chuoi ket qua\s*:\s*[BPT]{2,}/i.test(t);
        var hasRealTotals = /B\s*[:=]\s*\d|P\s*[:=]\s*\d|T\s*[:=]\s*\d|BANKER\s*:\s*(?!\s*--)[\d.]/i.test(t);
        if (!(hasDomCards || hasRealSeq || hasRealTotals)) return -999999;
        var s = 0;
        if (hasDomCards) s += 100000;
        if (hasRealSeq) s += 70000;
        if (hasRealTotals) s += 50000;
        if (/singleBacTable\.jsp/i.test(h)) s += 25000;
        if (/gamehall\.jsp/i.test(h)) s += 12000;
        if (__abxCwIsWebMain(h)) s += 12000;
        if (p === 'top') s += 700;
        if (/about:blank/i.test(h)) s -= 6000;
        return s;
      }catch(_){ return -999999; }
    }
    function __abxCwHostScore(item){
      try{
        var s = __abxCwVisibleScore(item);
        var h = String((item && item.href) || '');
        var p = String((item && item.path) || '');
        var root = item && item.root;
        if (root && root.querySelector && root.querySelector('#cwInfo')) s += 8000;
        if (/singleBacTable\.jsp/i.test(h)) s += 5000;
        if (__abxCwIsWebMain(h)) s += 3000;
        if (p === 'top') s += 2000;
        if (/about:blank/i.test(h)) s -= 6000;
        return s;
      }catch(_){ return -999999; }
    }
    function __abxCwMirrorPanel(host, source){
      try{
        if (!host || !source || !host.root || !source.root || host === source){
          try{ if (host && host.root) host.root.removeAttribute('data-abx-mirrored-from'); }catch(_){}
          return;
        }
        var srcInfo = source.root.querySelector && source.root.querySelector('#cwInfo');
        var dstInfo = host.root.querySelector && host.root.querySelector('#cwInfo');
        if (srcInfo && dstInfo){
          var txt = String(srcInfo.innerText || srcInfo.textContent || '').trim();
          if (txt) dstInfo.innerHTML = srcInfo.innerHTML;
        }
        var srcState = source.root.querySelector && source.root.querySelector('#cwState');
        var dstState = host.root.querySelector && host.root.querySelector('#cwState');
        if (srcState && dstState) dstState.textContent = srcState.textContent || '';
        var srcLog = source.root.querySelector && source.root.querySelector('#cwLog');
        var dstLog = host.root.querySelector && host.root.querySelector('#cwLog');
        if (srcLog && dstLog && String(srcLog.textContent || '').trim()) dstLog.textContent = srcLog.textContent || '';
        host.root.setAttribute('data-abx-mirrored-from', String(source.path || '') + ' | ' + String(source.href || ''));
      }catch(_){}
    }
    function __abxCwCollect(w,path,out,depth){
      try{
        if (!w || depth > 8) return;
        var doc = w.document;
        var root = doc && doc.getElementById('__cw_root_allin');
        if (root) out.push({ win:w, root:root, path:path, href:__abxCwHref(w), text:String(root.innerText || root.textContent || '') });
        var frames = w.frames || [];
        for (var i=0;i<frames.length;i++) __abxCwCollect(frames[i], path + '/frame[' + i + ']', out, depth + 1);
      }catch(_){}
    }
    function __abxCwScore(item){
      try{
        var h = String(item.href || '');
        var p = String(item.path || '');
        var t = String(item.text || '');
        var s = 0;
        var isSingleTable = /singleBacTable\.jsp/i.test(h);
        var isGameHall = /gamehall\.jsp/i.test(h);
        var hasDetail = /Trạng thái|Trang thai|CTX\s*:|HUD\s*:|Baccarat DOM cards|Chuỗi kết quả|Chuoi ket qua|SEQ\s*:/i.test(t);
        var hasDomCards = /Baccarat DOM cards/i.test(t);
        var hasRealSeq = /SEQ\s*:\s*[BPT]{2,}|Chuỗi kết quả\s*:\s*[BPT]{2,}|Chuoi ket qua\s*:\s*[BPT]{2,}/i.test(t);
        var hasRealTotals = /B\s*[:=]\s*\d|P\s*[:=]\s*\d|T\s*[:=]\s*\d|BANKER\s*:\s*(?!\s*--)[\d.]/i.test(t);
        var hasUsefulDetail = hasDomCards || hasRealSeq || hasRealTotals;
        s += __abxCwVisibleScore(item);
        if (hasDetail) s += 500;
        if (hasDomCards) s += 100000;
        if (hasRealSeq) s += 70000;
        if (hasRealTotals) s += 50000;
        if (/BANKER|PLAYER|TIE/i.test(t)) s += 1000;
        if (/OPEN/i.test(t)) s += 800;
        if (/IDLE/i.test(t) && !hasUsefulDetail) s -= 12000;
        if (isSingleTable) s += hasUsefulDetail ? 25000 : -90000;
        if (isSingleTable && p === 'top' && !hasUsefulDetail) s -= 40000;
        if (isGameHall) s += hasUsefulDetail ? 12000 : -30000;
        if (__abxCwIsWebMain(h)) s += hasUsefulDetail ? 12000 : (hasDetail ? 1000 : 100);
        if (p === 'top') s += hasUsefulDetail ? 700 : -5000;
        if (/CTX\s*:\s*top\s*\|\s*webMain\.jsp/i.test(t)) s += hasUsefulDetail ? 1200 : 0;
        if (/about:blank/i.test(h)) s -= 6000;
        if (isSingleTable || isGameHall) s += hasUsefulDetail ? 1000 : -1000;
        return s;
      }catch(_){ return -999999; }
    }
    function __abxCwSetVisible(item, show){
      try{
        var root = item && item.root;
        if (!root) return;
        root.setAttribute('data-abx-controlled-by-top', '1');
        root.setAttribute('data-abx-single-panel-path', String(item.path || ''));
        root.setAttribute('data-abx-single-panel-score', String(__abxCwScore(item)));
        root.setAttribute('data-abx-single-panel-visible-score', String(__abxCwVisibleScore(item)));
        if (show){
          root.removeAttribute('data-abx-hidden-by-top');
          root.style.setProperty('display','block','important');
          root.style.setProperty('visibility','visible','important');
          root.style.setProperty('pointer-events','none','important');
        } else {
          root.setAttribute('data-abx-hidden-by-top','1');
          root.style.setProperty('display','none','important');
          root.style.setProperty('visibility','hidden','important');
          root.style.setProperty('pointer-events','none','important');
        }
      }catch(_){}
    }
    function __abxCwEnforceSinglePanel(){
      try{
        var start = window;
        try{ if (window.top) start = window.top; }catch(_){}
        var items = [];
        __abxCwCollect(start, 'top', items, 0);
        if (!items.length) return;
        var best = null, bestScore = -999999;
        var bestData = null, bestDataScore = -999999;
        var bestHost = null, bestHostScore = -999999;
        for (var i=0;i<items.length;i++){
          var score = __abxCwScore(items[i]);
          if (!best || score > bestScore){ best = items[i]; bestScore = score; }
          var dataScore = __abxCwDataScore(items[i]);
          if (!bestData || dataScore > bestDataScore){ bestData = items[i]; bestDataScore = dataScore; }
          var hostScore = __abxCwHostScore(items[i]);
          if (!bestHost || hostScore > bestHostScore){ bestHost = items[i]; bestHostScore = hostScore; }
        }
        if (bestData && bestDataScore > -999000){
          var dataVisible = __abxCwVisibleScore(bestData) > 0;
          best = dataVisible ? bestData : (bestHost || best);
        }
        for (var j=0;j<items.length;j++) __abxCwSetVisible(items[j], items[j] === best);
        if (best && bestData && bestDataScore > -999000 && best !== bestData) __abxCwMirrorPanel(best, bestData);
        else __abxCwMirrorPanel(best, best);
      }catch(_){}
    }
    window.__abxCwEnforceSinglePanel = __abxCwEnforceSinglePanel;
    try{ __abxCwEnforceSinglePanel(); }catch(_){}
    try{ if (!window.__abxCwSinglePanelTimer) window.__abxCwSinglePanelTimer = setInterval(__abxCwEnforceSinglePanel, 500); }catch(_){}
    if (!__abxTopForwardAlready){
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
    }
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
