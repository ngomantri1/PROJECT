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

  function tryGetWebGlContext(canvas) {
    var tried = [];
    function one(label, getter) {
      try {
        var gl = getter();
        if (gl && typeof gl.readPixels === 'function') {
          return {
            gl: gl,
            source: label
          };
        }
      } catch (_) {}
      tried.push(label);
      return null;
    }

    var fromCocos = one('cc.game._renderContext', function () {
      return rootWin.cc && rootWin.cc.game && rootWin.cc.game._renderContext;
    });
    if (fromCocos) return fromCocos;

    var fromWebgl2 = one('canvas.getContext(webgl2)', function () {
      return canvas && canvas.getContext && canvas.getContext('webgl2', { preserveDrawingBuffer: true });
    });
    if (fromWebgl2) return fromWebgl2;

    var fromWebgl = one('canvas.getContext(webgl)', function () {
      return canvas && canvas.getContext && (canvas.getContext('webgl', { preserveDrawingBuffer: true }) || canvas.getContext('experimental-webgl', { preserveDrawingBuffer: true }));
    });
    if (fromWebgl) return fromWebgl;

    return {
      gl: null,
      source: tried.join(', ')
    };
  }

  function readRoiPixels2d(canvas, roi) {
    try {
      var rect = canvas.getBoundingClientRect();
      if (!rect || rect.width < 2 || rect.height < 2) return null;
      var ctx = canvas.getContext && canvas.getContext('2d');
      if (!ctx || !ctx.getImageData) return null;
      var scaleX = canvas.width / rect.width;
      var scaleY = canvas.height / rect.height;
      var x1 = Math.max(0, Math.floor((roi.x - rect.left) * scaleX));
      var y1 = Math.max(0, Math.floor((roi.y - rect.top) * scaleY));
      var x2 = Math.min(canvas.width, Math.ceil((roi.x + roi.w - rect.left) * scaleX));
      var y2 = Math.min(canvas.height, Math.ceil((roi.y + roi.h - rect.top) * scaleY));
      if (x2 - x1 < 12 || y2 - y1 < 12) return null;
      var sw = x2 - x1;
      var sh = y2 - y1;
      var img = ctx.getImageData(x1, y1, sw, sh);
      if (!img || !img.data || !img.data.length) return null;
      return {
        pixels: img.data,
        width: sw,
        height: sh,
        rect: rect,
        mode: '2d',
        source: 'canvas.getContext(2d)',
        x1: x1,
        y1: y1,
        x2: x2,
        y2: y2
      };
    } catch (_) {
      return null;
    }
  }

  function readRoiPixelsWebGl(canvas, roi) {
    try {
      var rect = canvas.getBoundingClientRect();
      if (!rect || rect.width < 2 || rect.height < 2) return null;
      var got = tryGetWebGlContext(canvas);
      var gl = got && got.gl;
      if (!gl) return null;
      var scaleX = canvas.width / rect.width;
      var scaleY = canvas.height / rect.height;
      var x1 = Math.max(0, Math.floor((roi.x - rect.left) * scaleX));
      var yTop = Math.max(0, Math.floor((roi.y - rect.top) * scaleY));
      var x2 = Math.min(canvas.width, Math.ceil((roi.x + roi.w - rect.left) * scaleX));
      var yBottomTop = Math.min(canvas.height, Math.ceil((roi.y + roi.h - rect.top) * scaleY));
      if (x2 - x1 < 12 || yBottomTop - yTop < 12) return null;
      var sw = x2 - x1;
      var sh = yBottomTop - yTop;
      var yGl = Math.max(0, canvas.height - yBottomTop);
      var pixels = new Uint8Array(sw * sh * 4);
      try { if (gl.finish) gl.finish(); } catch (_) {}
      try {
        gl.readPixels(x1, yGl, sw, sh, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      } catch (_) {
        return null;
      }
      if (!pixels.length) return null;
      return {
        pixels: pixels,
        width: sw,
        height: sh,
        rect: rect,
        mode: 'webgl',
        source: String(got && got.source || 'webgl'),
        x1: x1,
        y1: yTop,
        x2: x2,
        y2: yBottomTop,
        yGl: yGl,
        glCanvasWidth: canvas.width,
        glCanvasHeight: canvas.height
      };
    } catch (_) {
      return null;
    }
  }

  function pxAt(scan, px, py) {
    if (!scan || !scan.pixels) return null;
    if (px < 0 || py < 0 || px >= scan.width || py >= scan.height) return null;
    var row = py;
    if (scan.mode === 'webgl') {
      row = scan.height - 1 - py;
    }
    var di = (row * scan.width + px) * 4;
    var a = scan.pixels[di + 3];
    return [
      scan.pixels[di],
      scan.pixels[di + 1],
      scan.pixels[di + 2],
      a
    ];
  }

  function guessRoadRois(canvas) {
    var out = [];
    try {
      if (!canvas) return out;
      var r = canvas.getBoundingClientRect();
      var auto = autoDetectRoadRois(canvas);
      for (var ai = 0; ai < auto.length; ai++) out.push(auto[ai]);
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

    // T (hoa) phải được ưu tiên trước P/B vì bead tím thường có blue hơi trội
    // và nếu check P trước thì rất dễ bị nuốt sang Player.
    var rbDiff = Math.abs(r - b);
    if (
      r >= 70 &&
      b >= 90 &&
      g <= Math.max(r, b) * 0.82 &&
      r > g * 1.10 &&
      b > g * 1.10 &&
      rbDiff <= 95
    ) return 'T';

    if (r >= 128 && r > b * 1.08 && r > g * 1.04) return 'B';
    if (b >= 118 && b > r * 1.07 && b >= g * 0.92) return 'P';
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

  function clusterRows(items) {
    var arr = (items || []).slice().sort(function (a, b) {
      return Number(a.y || 0) - Number(b.y || 0) || Number(a.x || 0) - Number(b.x || 0);
    });
    var sizeMed = median(arr.map(function (x) { return Math.max(Number(x.w || 0), Number(x.h || 0)); })) || 18;
    var thr = Math.max(6, Math.round(sizeMed * 0.8));
    var rows = [];
    for (var i = 0; i < arr.length; i++) {
      var it = arr[i];
      var row = null;
      for (var j = 0; j < rows.length; j++) {
        if (Math.abs(Number(rows[j].cy || 0) - Number(it.y || 0)) <= thr) {
          row = rows[j];
          break;
        }
      }
      if (!row) {
        row = { cy: Number(it.y || 0), items: [] };
        rows.push(row);
      }
      row.items.push(it);
      row.cy = (row.cy * (row.items.length - 1) + Number(it.y || 0)) / row.items.length;
    }
    rows.sort(function (a, b) { return Number(a.cy || 0) - Number(b.cy || 0); });
    return rows;
  }

  function buildSeq(items) {
    var cols = buildColumns(items);
    var rows = clusterRows(items);
    var colCenters = cols.map(function (c) { return Number(c.cx || 0); });
    var rowCenters = rows.map(function (r) { return Number(r.cy || 0); });
    function nearestIndex(value, centers) {
      var best = -1;
      var bestDist = 1e18;
      for (var i = 0; i < centers.length; i++) {
        var d = Math.abs(Number(value || 0) - Number(centers[i] || 0));
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      }
      return best;
    }

    var grid = [];
    for (var r = 0; r < rowCenters.length; r++) {
      var row = [];
      for (var c = 0; c < colCenters.length; c++) row.push(null);
      grid.push(row);
    }

    for (var k = 0; k < items.length; k++) {
      var it = items[k];
      var rowIdx = nearestIndex(Number(it.y || 0), rowCenters);
      var colIdx = nearestIndex(Number(it.x || 0), colCenters);
      if (rowIdx < 0 || colIdx < 0) continue;
      var cur = grid[rowIdx][colIdx];
      if (!cur) {
        grid[rowIdx][colIdx] = it;
      } else {
        var curScore = Math.abs(Number(cur.y || 0) - rowCenters[rowIdx]) + Math.abs(Number(cur.x || 0) - colCenters[colIdx]);
        var newScore = Math.abs(Number(it.y || 0) - rowCenters[rowIdx]) + Math.abs(Number(it.x || 0) - colCenters[colIdx]);
        if (newScore < curScore) grid[rowIdx][colIdx] = it;
      }
    }

    var rowParts = [];
    var orderedRows = [];
    for (var rowTopIdx = rows.length - 1; rowTopIdx >= 0; rowTopIdx--) {
      var visualRowTopIndex = rowTopIdx + 1; // hang 1 la tren cung
      var dir = (visualRowTopIndex % 2 === 1) ? 'ltr' : 'rtl';
      var order = [];
      for (var ci = 0; ci < colCenters.length; ci++) order.push(ci);
      if (dir === 'rtl') order.reverse();
      var arr = [];
      for (var oi = 0; oi < order.length; oi++) {
        var cell = grid[rowTopIdx][order[oi]];
        if (cell) arr.push(cell);
      }
      var s = '';
      for (var j = 0; j < arr.length; j++) s += String(arr[j].v || '');
      rowParts.push(s);
      orderedRows.push({
        visualRowTopIndex: visualRowTopIndex,
        seqRowIndexFromBottom: rows.length - rowTopIdx,
        dir: dir,
        y: Math.round(Number(rows[rowTopIdx].cy || 0)),
        count: arr.length,
        seq: s,
        items: arr
      });
    }
    return {
      seq: rowParts.join(''),
      cols: cols,
      rows: orderedRows
    };
  }

  function filterRoadBodyItems(items, roi) {
    var rows = clusterRows(items);
    function rowSpan(row) {
      var arr = row && row.items ? row.items : [];
      if (!arr.length) return 0;
      var minX = 1e18;
      var maxX = -1e18;
      for (var i = 0; i < arr.length; i++) {
        var it = arr[i];
        var x1 = Number(it.x || 0);
        var x2 = x1 + Number(it.w || 0);
        if (x1 < minX) minX = x1;
        if (x2 > maxX) maxX = x2;
      }
      return Math.max(0, maxX - minX);
    }
    if (rows.length <= 1) {
      return {
        items: items.slice(),
        rows: rows,
        blocks: [],
        keepFrom: 0,
        keepTo: rows.length ? rows.length - 1 : -1
      };
    }

    if (rows.length >= 2) {
      var head = rows[0];
      var next = rows[1];
      var headCount = Number(head && head.items && head.items.length || 0);
      var nextCount = Number(next && next.items && next.items.length || 0);
      var headSpan = rowSpan(head);
      var nextSpan = rowSpan(next);
      var gap = Math.abs(Number(next && next.cy || 0) - Number(head && head.cy || 0));
      var sizeMedHead = median(items.map(function (x) {
        return Math.max(Number(x.w || 0), Number(x.h || 0));
      })) || 18;
      if (headCount > 0 &&
          headCount <= 3 &&
          nextCount >= Math.max(5, headCount + 2) &&
          headSpan > 0 &&
          nextSpan >= headSpan * 1.35 &&
          gap <= Math.max(18, Math.round(sizeMedHead * 2.4))) {
        rows = rows.slice(1);
      }
    }

    var denseMin = 4;
    var denseRows = [];
    for (var i = 0; i < rows.length; i++) {
      if (Number(rows[i].items.length || 0) >= denseMin) {
        denseRows.push({
          idx: i,
          cy: Number(rows[i].cy || 0),
          count: Number(rows[i].items.length || 0)
        });
      }
    }
    if (!denseRows.length) {
      return {
        items: items.slice(),
        rows: rows,
        blocks: [],
        keepFrom: 0,
        keepTo: rows.length - 1
      };
    }

    var gaps = [];
    for (var g = 1; g < denseRows.length; g++) {
      gaps.push(Number(denseRows[g].cy || 0) - Number(denseRows[g - 1].cy || 0));
    }
    var gapMed = median(gaps) || 28;
    var blockGap = Math.max(22, Math.round(gapMed * 1.9));
    var blocks = [];
    var block = null;
    for (var d = 0; d < denseRows.length; d++) {
      var cur = denseRows[d];
      if (!block) {
        block = { from: cur.idx, to: cur.idx, count: cur.count, rows: [cur] };
        continue;
      }
      var prev = denseRows[d - 1];
      var gap = Number(cur.cy || 0) - Number(prev.cy || 0);
      if (gap <= blockGap) {
        block.to = cur.idx;
        block.count += cur.count;
        block.rows.push(cur);
      } else {
        blocks.push(block);
        block = { from: cur.idx, to: cur.idx, count: cur.count, rows: [cur] };
      }
    }
    if (block) blocks.push(block);

    blocks.sort(function (a, b) {
      return Number(b.count || 0) - Number(a.count || 0) ||
             Number((a.rows && a.rows[0] && a.rows[0].cy) || 0) - Number((b.rows && b.rows[0] && b.rows[0].cy) || 0);
    });
    var best = blocks[0];
    var firstDense = Number(best && best.from != null ? best.from : denseRows[0].idx);
    var lastDense = Number(best && best.to != null ? best.to : denseRows[denseRows.length - 1].idx);

    var kept = [];
    for (var r = firstDense; r <= lastDense; r++) {
      var rowItems = rows[r].items || [];
      for (var k = 0; k < rowItems.length; k++) kept.push(rowItems[k]);
    }

    var rowPad = Math.max(2, Math.round(gapMed * 0.18));
    var topSoftCut = Number(rows[firstDense].cy || 0) - rowPad;
    kept = kept.filter(function (x) {
      return Number(x.y || 0) >= topSoftCut;
    });

    return {
      items: kept,
      rows: rows,
      blocks: blocks,
      keepFrom: firstDense,
      keepTo: lastDense
    };
  }

  function clampRectToCanvas(roi, rect) {
    if (!roi || !rect) return roi;
    var x1 = Math.max(rect.left, Number(roi.x || 0));
    var y1 = Math.max(rect.top, Number(roi.y || 0));
    var x2 = Math.min(rect.left + rect.width, Number(roi.x || 0) + Number(roi.w || 0));
    var y2 = Math.min(rect.top + rect.height, Number(roi.y || 0) + Number(roi.h || 0));
    return {
      x: Math.round(x1),
      y: Math.round(y1),
      w: Math.max(1, Math.round(x2 - x1)),
      h: Math.max(1, Math.round(y2 - y1))
    };
  }

  function bboxOfItems(items) {
    items = items || [];
    if (!items.length) return null;
    var minX = 1e18, minY = 1e18, maxX = -1e18, maxY = -1e18;
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var x1 = Number(it.x || 0);
      var y1 = Number(it.y || 0);
      var x2 = x1 + Number(it.w || 0);
      var y2 = y1 + Number(it.h || 0);
      if (x1 < minX) minX = x1;
      if (y1 < minY) minY = y1;
      if (x2 > maxX) maxX = x2;
      if (y2 > maxY) maxY = y2;
    }
    return {
      x: Math.round(minX),
      y: Math.round(minY),
      w: Math.max(1, Math.round(maxX - minX)),
      h: Math.max(1, Math.round(maxY - minY))
    };
  }

  function scanColorItems(canvas, roi) {
    if (!canvas || !roi) return { items: [], meta: { mode: 'none', reason: 'no-canvas-or-roi' } };
    var scan = readRoiPixels2d(canvas, roi) || readRoiPixelsWebGl(canvas, roi);
    if (!scan) {
      return {
        items: [],
        meta: {
          mode: 'none',
          reason: 'no-readable-2d-or-webgl-context'
        }
      };
    }

    var rect = scan.rect;
    var sw = scan.width;
    var sh = scan.height;
    var step = Math.max(2, Math.round(Math.max(sw, sh) / 500));
    var gw = Math.floor(sw / step);
    var gh = Math.floor(sh / step);
    if (gw < 10 || gh < 10) {
      return {
        items: [],
        meta: {
          mode: scan.mode,
          source: scan.source,
          reason: 'grid-too-small',
          canvasRect: {
            x: rect.left,
            y: rect.top,
            w: rect.width,
            h: rect.height
          },
          sample: {
            x1: scan.x1,
            y1: scan.y1,
            x2: scan.x2,
            y2: scan.y2,
            sw: sw,
            sh: sh,
            step: step,
            gw: gw,
            gh: gh
          }
        }
      };
    }

    var mask = new Uint8Array(gw * gh);
    var diag = {
      totalSamples: 0,
      alphaSamples: 0,
      brightSamples: 0,
      classifiedSamples: 0,
      classB: 0,
      classP: 0,
      classT: 0,
      topColors: []
    };
    var colorBins = Object.create(null);
    function mi(x, y) { return y * gw + x; }
    function kindToSymbol(kind) {
      return kind === 1 ? 'B' : (kind === 2 ? 'P' : (kind === 3 ? 'T' : ''));
    }

    for (var gy = 0; gy < gh; gy++) {
      for (var gx = 0; gx < gw; gx++) {
        var px = Math.min(sw - 1, gx * step + Math.floor(step / 2));
        var py = Math.min(sh - 1, gy * step + Math.floor(step / 2));
        var rgba = pxAt(scan, px, py);
        if (!rgba) continue;
        diag.totalSamples++;
        if (rgba[3] >= 25) diag.alphaSamples++;
        var rgbMax = Math.max(rgba[0], rgba[1], rgba[2]);
        var rgbMin = Math.min(rgba[0], rgba[1], rgba[2]);
        if (rgbMax >= 55 && (rgbMax - rgbMin) >= 24) diag.brightSamples++;
        var binKey = [
          Math.round(rgba[0] / 16) * 16,
          Math.round(rgba[1] / 16) * 16,
          Math.round(rgba[2] / 16) * 16
        ].join(',');
        colorBins[binKey] = Number(colorBins[binKey] || 0) + 1;
        var v = classifyCanvasPixel(rgba[0], rgba[1], rgba[2], rgba[3]);
        if (v === 'B') mask[mi(gx, gy)] = 1;
        else if (v === 'P') mask[mi(gx, gy)] = 2;
        else if (v === 'T') mask[mi(gx, gy)] = 3;
        if (v) {
          diag.classifiedSamples++;
          if (v === 'B') diag.classB++;
          else if (v === 'P') diag.classP++;
          else if (v === 'T') diag.classT++;
        }
      }
    }

    diag.topColors = Object.keys(colorBins).map(function (k) {
      return { rgb: k, count: colorBins[k] };
    }).sort(function (a, b) {
      return Number(b.count || 0) - Number(a.count || 0);
    }).slice(0, 12);

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
          v: kindToSymbol(kind),
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

    return {
      items: items,
      meta: {
        mode: scan.mode,
        source: scan.source,
        canvasRect: {
          x: rect.left,
          y: rect.top,
          w: rect.width,
          h: rect.height
        },
        sample: {
          x1: scan.x1,
          y1: scan.y1,
          x2: scan.x2,
          y2: scan.y2,
          sw: sw,
          sh: sh,
          step: step,
          gw: gw,
          gh: gh
        },
        diag: diag,
        gl: scan.mode === 'webgl' ? {
          yGl: scan.yGl,
          canvasWidth: scan.glCanvasWidth,
          canvasHeight: scan.glCanvasHeight
        } : null
      }
    };
  }

  function autoDetectRoadRois(canvas) {
    var out = [];
    try {
      if (!canvas) return out;
      var rect = canvas.getBoundingClientRect();
      if (!rect || rect.width < 80 || rect.height < 80) return out;

      var searches = [
        {
          name: 'auto-left-main',
          x: rect.left + rect.width * 0.00,
          y: rect.top + rect.height * 0.12,
          w: rect.width * 0.28,
          h: rect.height * 0.68
        },
        {
          name: 'auto-left-wide',
          x: rect.left + rect.width * 0.00,
          y: rect.top + rect.height * 0.08,
          w: rect.width * 0.32,
          h: rect.height * 0.76
        },
        {
          name: 'auto-left-mid',
          x: rect.left + rect.width * 0.02,
          y: rect.top + rect.height * 0.18,
          w: rect.width * 0.26,
          h: rect.height * 0.58
        }
      ];

      var candidates = [];
      for (var si = 0; si < searches.length; si++) {
        var search = clampRectToCanvas(searches[si], rect);
        var raw = scanColorItems(canvas, search);
        var allItems = raw.items || [];
        if (allItems.length < 8) continue;

        var filtered = filterRoadBodyItems(allItems, search);
        var items = filtered.items || [];
        if (items.length < 8) continue;

        var rows = clusterRows(items);
        var cols = buildColumns(items);
        if (!rows.length || !cols.length) continue;

        var box = bboxOfItems(items);
        if (!box || box.w < 40 || box.h < 24) continue;
        var boxLeftRel = (box.x - rect.left) / Math.max(1, rect.width);
        var boxRightRel = (box.x + box.w - rect.left) / Math.max(1, rect.width);
        var boxTopRel = (box.y - rect.top) / Math.max(1, rect.height);
        var boxBottomRel = (box.y + box.h - rect.top) / Math.max(1, rect.height);
        var rowCount = Number(rows.length || 0);
        var colCount = Number(cols.length || 0);

        if (rowCount < 2 || rowCount > 6) continue;
        if (colCount < 3 || colCount > 10) continue;
        if (boxLeftRel > 0.12) continue;
        if (boxRightRel > 0.30) continue;
        if (boxTopRel < 0.20 || boxTopRel > 0.55) continue;
        if (boxBottomRel < 0.30 || boxBottomRel > 0.82) continue;

        var sizeMed = median(items.map(function (x) {
          return Math.max(Number(x.w || 0), Number(x.h || 0));
        })) || 14;
        var padX = Math.max(6, Math.round(sizeMed * 1.1));
        var padY = Math.max(6, Math.round(sizeMed * 0.9));
        var roi = clampRectToCanvas({
          x: box.x - padX,
          y: box.y - padY,
          w: box.w + padX * 2,
          h: box.h + padY * 2
        }, rect);

        var score =
          Number(items.length || 0) * 8 +
          Math.min(10, colCount) * 18 +
          Math.min(6, rowCount) * 22 -
          Math.abs(colCount - 10) * 14 -
          Math.abs(rowCount - 4) * 10 -
          Math.abs((box.w / Math.max(1, box.h)) - 1.05) * 20 -
          boxLeftRel * 120 -
          Math.max(0, boxRightRel - 0.24) * 180;

        candidates.push({
          name: search.name,
          score: score,
          roi: roi,
          items: items,
          rows: rows,
          cols: cols
        });
      }

      candidates.sort(function (a, b) {
        return Number(b.score || 0) - Number(a.score || 0);
      });

      var seen = Object.create(null);
      for (var ci = 0; ci < candidates.length; ci++) {
        var base = candidates[ci];
        if (!base || !base.roi) continue;
        var sizeMed = median((base.items || []).map(function (x) {
          return Math.max(Number(x.w || 0), Number(x.h || 0));
        })) || 14;
        var variants = [
          { name: 'auto-road-a', x: base.roi.x, y: base.roi.y, w: base.roi.w, h: base.roi.h },
          { name: 'auto-road-b', x: base.roi.x - sizeMed, y: base.roi.y - sizeMed, w: base.roi.w + sizeMed * 2, h: base.roi.h + sizeMed * 2 },
          { name: 'auto-road-c', x: base.roi.x - Math.round(sizeMed * 0.5), y: base.roi.y - sizeMed, w: base.roi.w + sizeMed, h: base.roi.h + Math.round(sizeMed * 2.2) },
          { name: 'auto-road-d', x: base.roi.x - sizeMed, y: base.roi.y - Math.round(sizeMed * 0.4), w: base.roi.w + Math.round(sizeMed * 2.4), h: base.roi.h + sizeMed }
        ];
        for (var vi = 0; vi < variants.length; vi++) {
          var vr = clampRectToCanvas(variants[vi], rect);
          var key = [Math.round(vr.x / 4), Math.round(vr.y / 4), Math.round(vr.w / 4), Math.round(vr.h / 4)].join('|');
          if (seen[key]) continue;
          seen[key] = 1;
          out.push({
            name: variants[vi].name,
            x: vr.x,
            y: vr.y,
            w: vr.w,
            h: vr.h
          });
        }
        if (out.length >= 4) break;
      }
    } catch (_) {}
    return out;
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
    if (!canvas || !roi) return { items: [], seq: '', cols: [], rows: [], meta: {} };
    var raw = scanColorItems(canvas, roi);
    var items = (raw && raw.items ? raw.items : []).slice();
    var meta = raw && raw.meta ? raw.meta : {};
    if (!items.length && meta && meta.reason) {
      return {
        items: [],
        seq: '',
        cols: [],
        rows: [],
        meta: meta
      };
    }

    var filtered = filterRoadBodyItems(items, roi);
    items = filtered.items || items;

    var seqPack = buildSeq(items);
    return {
      items: items,
      seq: seqPack.seq,
      cols: seqPack.cols,
      rows: seqPack.rows || [],
      meta: Object.assign({}, meta, {
        rowFilter: {
          rowCount: filtered.rows ? filtered.rows.length : 0,
          keepFrom: filtered.keepFrom,
          keepTo: filtered.keepTo,
          rows: (filtered.rows || []).map(function (r) {
            return {
              y: Math.round(Number(r.cy || 0)),
              count: Number(r.items && r.items.length || 0)
            };
          })
        }
      })
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
    html += '<div style="margin-top:6px;color:#9bd0ff">mode=' + esc(state.meta && state.meta.mode || '--') + ' | src=' + esc(shortText(state.meta && state.meta.source || '--', 80)) + '</div>';
    html += '<div style="margin-top:6px;color:#ffcf99">reason=' + esc(shortText(state.meta && state.meta.reason || '', 90)) + '</div>';
    if (state.meta && state.meta.diag) {
      var d = state.meta.diag;
      html += '<div style="margin-top:6px;color:#a7f3d0">diag=' +
        ' total:' + Number(d.totalSamples || 0) +
        ' alpha:' + Number(d.alphaSamples || 0) +
        ' bright:' + Number(d.brightSamples || 0) +
        ' class:' + Number(d.classifiedSamples || 0) +
        ' B/P/T=' + [d.classB || 0, d.classP || 0, d.classT || 0].join('/') +
        '</div>';
    }
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
    roiMode: 'guess',
    guessIndex: 0,
    guessedRois: [],
    last: null,
    lastFrames: [],
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
        refs.roiMode = 'manual';
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
        rows: [],
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
        if ((refs.roiMode !== 'manual' || !refs.roi || refs.roi.w < 8 || refs.roi.h < 8) && refs.guessedRois.length) {
          refs.guessIndex = Math.max(0, Math.min(refs.guessIndex, refs.guessedRois.length - 1));
          refs.roi = refs.guessedRois[refs.guessIndex];
          refs.roiMode = 'guess';
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
        result.rows = scan.rows || [];
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
    runFrames: function (count) {
      count = Math.max(1, Number(count || 8));
      var results = [];
      function frameStep(left, resolve) {
        rootWin.requestAnimationFrame(function () {
          var r = refs.run();
          results.push(r);
          if (left <= 1) {
            refs.lastFrames = results.slice();
            var best = results.slice().sort(function (a, b) {
              var ad = a && a.meta && a.meta.diag ? a.meta.diag : {};
              var bd = b && b.meta && b.meta.diag ? b.meta.diag : {};
              return (Number(bd.classifiedSamples || 0) - Number(ad.classifiedSamples || 0)) ||
                     (Number(bd.brightSamples || 0) - Number(ad.brightSamples || 0)) ||
                     (Number((b && b.items && b.items.length) || 0) - Number((a && a.items && a.items.length) || 0));
            })[0] || refs.last;
            refs.last = best;
            renderPanel(refs.panel, best, refs);
            drawItems(refs.layer, refs.roi, best.items || []);
            drawRect(refs.select, refs.roi);
            resolve(best);
            return;
          }
          frameStep(left - 1, resolve);
        });
      }
      return new Promise(function (resolve) {
        frameStep(count, resolve);
      });
    },
    setRoi: function (x, y, w, h) {
      refs.roi = {
        x: Number(x || 0),
        y: Number(y || 0),
        w: Number(w || 0),
        h: Number(h || 0)
      };
      refs.roiMode = 'manual';
      return refs.run();
    },
    prevGuess: function () {
      if (!refs.guessedRois.length) refs.run();
      if (!refs.guessedRois.length) return refs.last;
      refs.guessIndex = (refs.guessIndex - 1 + refs.guessedRois.length) % refs.guessedRois.length;
      refs.roi = refs.guessedRois[refs.guessIndex];
      refs.roiMode = 'guess';
      return refs.run();
    },
    nextGuess: function () {
      if (!refs.guessedRois.length) refs.run();
      if (!refs.guessedRois.length) return refs.last;
      refs.guessIndex = (refs.guessIndex + 1) % refs.guessedRois.length;
      refs.roi = refs.guessedRois[refs.guessIndex];
      refs.roiMode = 'guess';
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
    runFrames: function (count) {
      return refs.runFrames(count).then(function (r) {
        try { rootWin.__cwSeqRoiProbe.last = r; } catch (_) {}
        try { rootWin.__cwSeqRoiProbe.frames = refs.lastFrames.slice(); } catch (_) {}
        return r;
      });
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
    frames: [],
    last: null
  };

  var init = refs.run();
  try { rootWin.__cwSeqRoiProbe.last = init; } catch (_) {}
})();
