(() => {
  'use strict';

  function getSameOriginRoot(win) {
    var cur = win || window;
    try {
      while (cur && cur.parent && cur.parent !== cur) {
        try {
          if (!cur.parent.document || !cur.parent.document.documentElement) break;
          cur = cur.parent;
        } catch (_) {
          break;
        }
      }
    } catch (_) {}
    return cur || win || window;
  }

  var rootWin = getSameOriginRoot(window);
  var rootDoc = rootWin.document;
  var ROOT_ID = '__cw_seq_roi_probe_root';
  var PANEL_ID = '__cw_seq_roi_probe_panel';
  var LAYER_ID = '__cw_seq_roi_probe_layer';
  var SELECT_ID = '__cw_seq_roi_probe_select';
  var MAX_COMPONENTS = 600;

  function cleanup() {
    try {
      var old = rootDoc.getElementById(ROOT_ID);
      if (old) old.remove();
    } catch (_) {}
    try {
      delete rootWin.__cwSeqRoiProbe;
    } catch (_) {}
  }

  cleanup();

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>]/g, function (m) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[m];
    });
  }

  function shortText(s, n) {
    s = String(s == null ? '' : s);
    n = Number(n || 120);
    return s.length > n ? s.slice(0, n) + '...' : s;
  }

  function median(list) {
    var arr = (list || []).slice().filter(function (x) { return isFinite(x); }).sort(function (a, b) { return a - b; });
    if (!arr.length) return 0;
    return arr[Math.floor(arr.length / 2)] || 0;
  }

  function dedupeBy(items, keyFn) {
    var out = [];
    var seen = Object.create(null);
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var key = String(keyFn(it));
      if (seen[key]) continue;
      seen[key] = 1;
      out.push(it);
    }
    return out;
  }

  function findVisibleCanvas() {
    try {
      var all = rootDoc.querySelectorAll('canvas');
      var best = null;
      var bestArea = 0;
      for (var i = 0; i < all.length; i++) {
        var el = all[i];
        var r = el.getBoundingClientRect();
        if (!r || r.width < 80 || r.height < 80) continue;
        var area = r.width * r.height;
        if (area > bestArea) {
          bestArea = area;
          best = el;
        }
      }
      return best;
    } catch (_) {
      return null;
    }
  }

  function guessRoadRois(canvas) {
    var out = [];
    try {
      if (!canvas) return out;
      var r = canvas.getBoundingClientRect();
      var presets = [
        { name: 'left-road-a', x: 0.055, y: 0.285, w: 0.195, h: 0.245 },
        { name: 'left-road-b', x: 0.05, y: 0.255, w: 0.22, h: 0.285 },
        { name: 'left-road-c', x: 0.07, y: 0.305, w: 0.18, h: 0.215 },
        { name: 'left-road-d', x: 0.045, y: 0.235, w: 0.235, h: 0.33 }
      ];
      for (var i = 0; i < presets.length; i++) {
        var p = presets[i];
        out.push({
          name: p.name,
          x: Math.round(r.left + r.width * p.x),
          y: Math.round(r.top + r.height * p.y),
          w: Math.round(r.width * p.w),
          h: Math.round(r.height * p.h)
        });
      }
    } catch (_) {}
    return out;
  }

  function classifyCanvasPixel(r, g, b, a) {
    r = Number(r || 0);
    g = Number(g || 0);
    b = Number(b || 0);
    a = Number(a || 0);
    if (a < 25) return '';
    var max = Math.max(r, g, b);
    var min = Math.min(r, g, b);
    var spread = max - min;
    if (max < 55 || spread < 24) return '';
    if (r >= 128 && r > b * 1.08 && r > g * 1.04) return 'B';
    if (b >= 118 && b > r * 1.07 && b >= g * 0.92) return 'P';
    if (r >= 94 && b >= 94 && r > g * 1.12 && b > g * 1.12) return 'T';
    return '';
  }

  function buildColumns(items) {
    var arr = (items || []).slice().sort(function (a, b) {
      return Number(a.x || 0) - Number(b.x || 0) || Number(a.y || 0) - Number(b.y || 0);
    });
    var sizeMed = median(arr.map(function (x) { return Math.max(Number(x.w || 0), Number(x.h || 0)); })) || 14;
    var thr = Math.max(6, Math.round(sizeMed * 0.8));
    var cols = [];
    for (var i = 0; i < arr.length; i++) {
      var it = arr[i];
      var col = null;
      for (var j = 0; j < cols.length; j++) {
        if (Math.abs(cols[j].cx - Number(it.x || 0)) <= thr) {
          col = cols[j];
          break;
        }
      }
      if (!col) {
        col = { cx: Number(it.x || 0), items: [] };
        cols.push(col);
      }
      col.items.push(it);
      col.cx = (col.cx * (col.items.length - 1) + Number(it.x || 0)) / col.items.length;
    }
    cols.sort(function (a, b) { return a.cx - b.cx; });
    for (var c = 0; c < cols.length; c++) {
      cols[c].items.sort(function (a, b) { return Number(a.y || 0) - Number(b.y || 0); });
    }
    return cols;
  }

  function buildSeq(items) {
    var cols = buildColumns(items);
    var parts = [];
    for (var i = 0; i < cols.length; i++) {
      var s = '';
      for (var j = 0; j < cols[i].items.length; j++) s += String(cols[i].items[j].v || '');
      parts.push(s);
    }
    return {
      seq: parts.join(''),
      cols: cols
    };
  }

  function createRoot() {
    var root = rootDoc.createElement('div');
    root.id = ROOT_ID;
    root.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none;font:12px/1.35 Consolas,monospace;';

    var layer = rootDoc.createElement('div');
    layer.id = LAYER_ID;
    layer.style.cssText = 'position:absolute;inset:0;pointer-events:none;';
    root.appendChild(layer);

    var select = rootDoc.createElement('div');
    select.id = SELECT_ID;
    select.style.cssText = 'position:absolute;border:2px solid #ffd966;background:rgba(255,217,102,.12);display:none;pointer-events:none;';
    root.appendChild(select);

    var panel = rootDoc.createElement('div');
    panel.id = PANEL_ID;
    panel.style.cssText = [
      'position:absolute',
      'top:16px',
      'right:16px',
      'width:520px',
      'max-height:80vh',
      'overflow:auto',
      'padding:12px',
      'border:1px solid #00ff88',
      'border-radius:10px',
      'background:rgba(5,18,12,.95)',
      'color:#d8ffe6',
      'box-shadow:0 10px 30px rgba(0,0,0,.45)',
      'pointer-events:auto'
    ].join(';');
    root.appendChild(panel);

    rootDoc.documentElement.appendChild(root);
    return { root: root, layer: layer, panel: panel, select: select };
  }

  function panelButton(label, onClick) {
    var btn = rootDoc.createElement('button');
    btn.textContent = label;
    btn.style.cssText = 'margin-left:6px;padding:2px 8px;border:1px solid #9fe2b4;background:#fff;cursor:pointer;';
    btn.onclick = onClick;
    return btn;
  }

  function drawRect(el, r) {
    if (!r) {
      el.style.display = 'none';
      return;
    }
    el.style.display = 'block';
    el.style.left = Math.round(r.x) + 'px';
    el.style.top = Math.round(r.y) + 'px';
    el.style.width = Math.max(1, Math.round(r.w)) + 'px';
    el.style.height = Math.max(1, Math.round(r.h)) + 'px';
  }

  function clearLayer(layer) {
    try { layer.innerHTML = ''; } catch (_) {}
  }

  function drawItems(layer, roi, items) {
    clearLayer(layer);
    if (roi) {
      var roiBox = rootDoc.createElement('div');
      roiBox.style.cssText = [
        'position:absolute',
        'left:' + Math.round(roi.x) + 'px',
        'top:' + Math.round(roi.y) + 'px',
        'width:' + Math.round(roi.w) + 'px',
        'height:' + Math.round(roi.h) + 'px',
        'border:2px solid #ffd966',
        'background:rgba(255,217,102,.05)',
        'box-sizing:border-box'
      ].join(';');
      layer.appendChild(roiBox);
    }
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var color = it.v === 'B' ? '#ff6b6b' : (it.v === 'P' ? '#4db6ff' : '#bf8cff');
      var node = rootDoc.createElement('div');
      node.style.cssText = [
        'position:absolute',
        'left:' + Math.round(it.x) + 'px',
        'top:' + Math.round(it.y) + 'px',
        'width:' + Math.max(4, Math.round(it.w)) + 'px',
        'height:' + Math.max(4, Math.round(it.h)) + 'px',
        'border:1px dashed ' + color,
        'border-radius:50%',
        'background:rgba(0,0,0,.12)',
        'box-sizing:border-box'
      ].join(';');
      layer.appendChild(node);
    }
  }

  function scanRoi(canvas, roi) {
    if (!canvas || !roi) return { items: [], seq: '', cols: [], meta: {} };
    var rect = canvas.getBoundingClientRect();
    if (!rect || rect.width < 2 || rect.height < 2) return { items: [], seq: '', cols: [], meta: {} };
    var ctx = canvas.getContext && canvas.getContext('2d');
    if (!ctx || !ctx.getImageData) return { items: [], seq: '', cols: [], meta: {} };

    var scaleX = canvas.width / rect.width;
    var scaleY = canvas.height / rect.height;
    var x1 = Math.max(0, Math.floor((roi.x - rect.left) * scaleX));
    var y1 = Math.max(0, Math.floor((roi.y - rect.top) * scaleY));
    var x2 = Math.min(canvas.width, Math.ceil((roi.x + roi.w - rect.left) * scaleX));
    var y2 = Math.min(canvas.height, Math.ceil((roi.y + roi.h - rect.top) * scaleY));
    if (x2 - x1 < 12 || y2 - y1 < 12) return { items: [], seq: '', cols: [], meta: {} };

    var sw = x2 - x1;
    var sh = y2 - y1;
    var img = ctx.getImageData(x1, y1, sw, sh).data;
    var step = Math.max(2, Math.round(Math.max(sw, sh) / 500));
    var gw = Math.floor(sw / step);
    var gh = Math.floor(sh / step);
    if (gw < 10 || gh < 10) return { items: [], seq: '', cols: [], meta: {} };

    var mask = new Uint8Array(gw * gh);
    function mi(x, y) { return y * gw + x; }
    for (var gy = 0; gy < gh; gy++) {
      for (var gx = 0; gx < gw; gx++) {
        var px = Math.min(sw - 1, gx * step + Math.floor(step / 2));
        var py = Math.min(sh - 1, gy * step + Math.floor(step / 2));
        var di = (py * sw + px) * 4;
        var v = classifyCanvasPixel(img[di], img[di + 1], img[di + 2], img[di + 3]);
        if (v === 'B') mask[mi(gx, gy)] = 1;
        else if (v === 'P') mask[mi(gx, gy)] = 2;
        else if (v === 'T') mask[mi(gx, gy)] = 3;
      }
    }

    var seen = new Uint8Array(gw * gh);
    var neighbors = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]];
    var items = [];
    var cssScaleX = rect.width / canvas.width;
    var cssScaleY = rect.height / canvas.height;

    for (var sy = 0; sy < gh; sy++) {
      for (var sx = 0; sx < gw; sx++) {
        var start = mi(sx, sy);
        var kind = mask[start];
        if (!kind || seen[start]) continue;
        var q = [[sx, sy]];
        seen[start] = 1;
        var count = 0;
        var minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
        while (q.length) {
          var cur = q.pop();
          var x = cur[0], y = cur[1];
          count++;
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
          for (var ni = 0; ni < neighbors.length; ni++) {
            var nx = x + neighbors[ni][0];
            var ny = y + neighbors[ni][1];
            if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
            var ii = mi(nx, ny);
            if (seen[ii] || mask[ii] !== kind) continue;
            seen[ii] = 1;
            q.push([nx, ny]);
          }
        }

        var compWpx = (maxX - minX + 1) * step;
        var compHpx = (maxY - minY + 1) * step;
        if (count < 4 || count > 220) continue;
        if (compWpx < 6 || compHpx < 6 || compWpx > 48 || compHpx > 48) continue;
        if (items.length >= MAX_COMPONENTS) continue;

        var leftCss = roi.x + minX * step * cssScaleX;
        var topCss = roi.y + minY * step * cssScaleY;
        items.push({
          id: 'roi|' + items.length,
          v: kind === 1 ? 'B' : (kind === 2 ? 'P' : 'T'),
          x: Math.round(leftCss),
          y: Math.round(topCss),
          w: Math.round(compWpx * cssScaleX),
          h: Math.round(compHpx * cssScaleY)
        });
      }
    }

    items = dedupeBy(items, function (x) {
      return [x.v, x.x, x.y, x.w, x.h].join('|');
    });

    var seqPack = buildSeq(items);
    return {
      items: items,
      seq: seqPack.seq,
      cols: seqPack.cols,
      meta: {
        canvasRect: {
          x: rect.left,
          y: rect.top,
          w: rect.width,
          h: rect.height
        },
        sample: {
          x1: x1,
          y1: y1,
          x2: x2,
          y2: y2,
          sw: sw,
          sh: sh,
          step: step,
          gw: gw,
          gh: gh
        }
      }
    };
  }

  function renderPanel(panel, state, refs) {
    var roi = state.roi;
    var html = '';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px">';
    html += '<div><b style="color:#9f9">CW Seq ROI Probe</b></div>';
    html += '<div id="__cw_seq_roi_btns"></div>';
    html += '</div>';
    html += '<div style="margin-top:8px;color:#d6b3ff">canvas=' + esc(shortText(state.canvasDesc || '--', 100)) + '</div>';
    html += '<div style="margin-top:6px;color:#9bd0ff">preset=' + esc(state.presetName || '--') + ' (' + Number(state.presetIndex != null ? state.presetIndex : -1) + '/' + Number(state.presetCount || 0) + ')</div>';
    html += '<div style="margin-top:6px;color:#ffd966">roi=' + esc(roi ? [Math.round(roi.x), Math.round(roi.y), Math.round(roi.w), Math.round(roi.h)].join(', ') : '--') + '</div>';
    html += '<div style="margin-top:6px;color:#8fd3ff">items=' + Number((state.items || []).length || 0) + ' | cols=' + Number((state.cols || []).length || 0) + '</div>';
    html += '<div style="margin-top:10px;padding:8px;border:1px solid #245e39;border-radius:8px">';
    html += '<div><b>seq</b> = <span style="color:#ffd966">' + esc(state.seq || '--') + '</span></div>';
    html += '</div>';
    html += '<div style="margin-top:10px;max-height:52vh;overflow:auto;border:1px solid #245e39;border-radius:8px">';
    html += '<table style="width:100%;border-collapse:collapse">';
    html += '<thead><tr style="position:sticky;top:0;background:#0b1f14"><th style="text-align:left;padding:4px">#</th><th style="text-align:left;padding:4px">v</th><th style="text-align:left;padding:4px">x</th><th style="text-align:left;padding:4px">y</th><th style="text-align:left;padding:4px">w</th><th style="text-align:left;padding:4px">h</th></tr></thead><tbody>';
    for (var i = 0; i < Math.min((state.items || []).length, 80); i++) {
      var it = state.items[i];
      html += '<tr><td style="padding:4px">' + i + '</td><td style="padding:4px">' + esc(it.v) + '</td><td style="padding:4px">' + it.x + '</td><td style="padding:4px">' + it.y + '</td><td style="padding:4px">' + it.w + '</td><td style="padding:4px">' + it.h + '</td></tr>';
    }
    html += '</tbody></table></div>';
    panel.innerHTML = html;

    var btns = panel.querySelector('#__cw_seq_roi_btns');
    btns.appendChild(panelButton('Pick Area', function () { refs.pickArea(); }));
    btns.appendChild(panelButton('Prev ROI', function () { refs.prevGuess(); }));
    btns.appendChild(panelButton('Next ROI', function () { refs.nextGuess(); }));
    btns.appendChild(panelButton('Run', function () { refs.run(); }));
    btns.appendChild(panelButton('Close', function () { refs.close(); }));
  }

  var refs = {
    root: null,
    layer: null,
    panel: null,
    select: null,
    roi: null,
    guessIndex: 0,
    guessedRois: [],
    last: null,
    pickArea: function () {
      var start = null;
      var move = null;
      var up = null;
      refs.root.style.pointerEvents = 'auto';
      rootDoc.body.style.userSelect = 'none';

      move = function (ev) {
        if (!start) return;
        var x1 = Math.min(start.x, ev.clientX);
        var y1 = Math.min(start.y, ev.clientY);
        var x2 = Math.max(start.x, ev.clientX);
        var y2 = Math.max(start.y, ev.clientY);
        drawRect(refs.select, { x: x1, y: y1, w: x2 - x1, h: y2 - y1 });
      };
      up = function (ev) {
        rootDoc.removeEventListener('mousemove', move, true);
        rootDoc.removeEventListener('mouseup', up, true);
        refs.root.style.pointerEvents = 'none';
        rootDoc.body.style.userSelect = '';
        if (!start) return;
        var x1 = Math.min(start.x, ev.clientX);
        var y1 = Math.min(start.y, ev.clientY);
        var x2 = Math.max(start.x, ev.clientX);
        var y2 = Math.max(start.y, ev.clientY);
        refs.roi = { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
        refs.run();
      };

      rootDoc.addEventListener('mousemove', move, true);
      rootDoc.addEventListener('mouseup', up, true);
      rootDoc.addEventListener('mousedown', function once(ev) {
        rootDoc.removeEventListener('mousedown', once, true);
        start = { x: ev.clientX, y: ev.clientY };
        drawRect(refs.select, { x: start.x, y: start.y, w: 1, h: 1 });
      }, true);
    },
    run: function () {
      var canvas = findVisibleCanvas();
      var result = {
        roi: refs.roi,
        canvasDesc: '',
        presetName: '',
        presetIndex: refs.guessIndex,
        presetCount: 0,
        items: [],
        seq: '',
        cols: [],
        meta: {}
      };
      if (canvas) {
        try {
          var r = canvas.getBoundingClientRect();
          result.canvasDesc = 'canvas ' + [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)].join(', ');
        } catch (_) {
          result.canvasDesc = 'canvas';
        }
        refs.guessedRois = guessRoadRois(canvas);
        result.presetCount = refs.guessedRois.length;
        if ((!refs.roi || refs.roi.w < 8 || refs.roi.h < 8) && refs.guessedRois.length) {
          refs.guessIndex = Math.max(0, Math.min(refs.guessIndex, refs.guessedRois.length - 1));
          refs.roi = refs.guessedRois[refs.guessIndex];
        }
        if (refs.guessedRois.length && refs.guessIndex >= 0 && refs.guessIndex < refs.guessedRois.length) {
          result.presetName = refs.guessedRois[refs.guessIndex].name || '';
          result.presetIndex = refs.guessIndex;
        }
      }
      if (canvas && refs.roi && refs.roi.w >= 8 && refs.roi.h >= 8) {
        var scan = scanRoi(canvas, refs.roi);
        result.items = scan.items || [];
        result.seq = scan.seq || '';
        result.cols = scan.cols || [];
        result.meta = scan.meta || {};
      }
      refs.last = result;
      drawItems(refs.layer, refs.roi, result.items || []);
      drawRect(refs.select, refs.roi);
      renderPanel(refs.panel, result, refs);
      try {
        console.log('[CW Seq ROI Probe] result');
        console.log(result);
      } catch (_) {}
      return result;
    },
    setRoi: function (x, y, w, h) {
      refs.roi = {
        x: Number(x || 0),
        y: Number(y || 0),
        w: Number(w || 0),
        h: Number(h || 0)
      };
      return refs.run();
    },
    prevGuess: function () {
      if (!refs.guessedRois.length) refs.run();
      if (!refs.guessedRois.length) return refs.last;
      refs.guessIndex = (refs.guessIndex - 1 + refs.guessedRois.length) % refs.guessedRois.length;
      refs.roi = refs.guessedRois[refs.guessIndex];
      return refs.run();
    },
    nextGuess: function () {
      if (!refs.guessedRois.length) refs.run();
      if (!refs.guessedRois.length) return refs.last;
      refs.guessIndex = (refs.guessIndex + 1) % refs.guessedRois.length;
      refs.roi = refs.guessedRois[refs.guessIndex];
      return refs.run();
    },
    close: function () {
      cleanup();
    }
  };

  var ui = createRoot();
  refs.root = ui.root;
  refs.layer = ui.layer;
  refs.panel = ui.panel;
  refs.select = ui.select;

  rootWin.__cwSeqRoiProbe = {
    pickArea: function () { return refs.pickArea(); },
    run: function () {
      var r = refs.run();
      try { rootWin.__cwSeqRoiProbe.last = r; } catch (_) {}
      return r;
    },
    setRoi: function (x, y, w, h) {
      var r = refs.setRoi(x, y, w, h);
      try { rootWin.__cwSeqRoiProbe.last = r; } catch (_) {}
      return r;
    },
    nextRoi: function () {
      var r = refs.nextGuess();
      try { rootWin.__cwSeqRoiProbe.last = r; } catch (_) {}
      return r;
    },
    prevRoi: function () {
      var r = refs.prevGuess();
      try { rootWin.__cwSeqRoiProbe.last = r; } catch (_) {}
      return r;
    },
    close: function () { return refs.close(); },
    last: null
  };

  var init = refs.run();
  try { rootWin.__cwSeqRoiProbe.last = init; } catch (_) {}
})();
