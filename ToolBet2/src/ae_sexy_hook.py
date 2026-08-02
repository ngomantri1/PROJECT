"""Inject WebSocket hook de bat message day du khi vao ban."""

WS_HOOK_SCRIPT = """
() => {
  if (window.__tbHooked) return;
  window.__tbHooked = true;
  window.__tbWs = [];
  const save = (d) => {
    try {
      const arr = JSON.parse(localStorage.getItem('__tb_roads') || '[]');
      arr.push(d.slice(0, 30000));
      if (arr.length > 80) arr.splice(0, arr.length - 80);
      localStorage.setItem('__tb_roads', JSON.stringify(arr));
    } catch (e) {}
  };
  const Orig = window.WebSocket;
  const WS = function(url, protocols) {
    const ws = protocols !== undefined ? new Orig(url, protocols) : new Orig(url);
    const u = String(url);
    if (u.includes('h54uk')) {
      ws.addEventListener('message', (ev) => {
        const d = typeof ev.data === 'string' ? ev.data : '';
        if (d.length > 20) {
          window.__tbWs.push({ dir: 'recv', len: d.length, data: d });
          if (window.__tbWs.length > 500) window.__tbWs = window.__tbWs.slice(-300);
          if (d.length > 150 && /road|bead|history|plate|winner|winCounts/i.test(d)) {
            save(d);
          }
        }
      });
      const send = ws.send.bind(ws);
      ws.send = function(data) {
        const s = typeof data === 'string' ? data : '';
        window.__tbWs.push({ dir: 'send', len: s.length, data: s });
        return send(data);
      };
    }
    return ws;
  };
  WS.prototype = Orig.prototype;
  WS.CONNECTING = Orig.CONNECTING;
  WS.OPEN = Orig.OPEN;
  WS.CLOSING = Orig.CLOSING;
  WS.CLOSED = Orig.CLOSED;
  window.WebSocket = WS;
}
"""
