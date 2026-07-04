(function () {
  'use strict';

  var DURATION_MS = 20000;
  var SAMPLE_MS = 250;
  var MAX_ROWS = 80;

  function safe(fn, fallback) {
    try { return fn(); } catch (_) { return fallback; }
  }

  function norm(s) {
    return String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  }

  function cssPath(el) {
    try {
      var parts = [];
      var cur = el;
      var depth = 0;
      while (cur && cur.nodeType === 1 && depth++ < 14) {
        var tag = String(cur.tagName || '').toLowerCase();
        if (!tag) break;
        var id = cur.id ? ('#' + cur.id) : '';
        var cls = '';
        try {
          cls = String(cur.className || '')
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 3)
            .map(function (x) { return '.' + x; })
            .join('');
        } catch (_) { cls = ''; }
        var nth = '';
        if (!id && cur.parentElement) {
          var same = Array.prototype.filter.call(cur.parentElement.children || [], function (x) {
            return x.tagName === cur.tagName;
          });
          if (same.length > 1) nth = ':nth-of-type(' + (same.indexOf(cur) + 1) + ')';
        }
        parts.unshift(tag + id + cls + nth);
        if (id) break;
        cur = cur.parentElement;
      }
      return parts.join(' > ');
    } catch (e) {
      return '';
    }
  }

  function shortTail(el) {
    try {
      var parts = [];
      var cur = el;
      var depth = 0;
      while (cur && cur.nodeType === 1 && depth++ < 10) {
        var tag = String(cur.tagName || '').toLowerCase();
        var id = cur.id ? ('#' + cur.id) : '';
        var cls = '';
        try {
          cls = String(cur.className || '')
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .join('.');
          if (cls) cls = '.' + cls;
        } catch (_) { cls = ''; }
        parts.unshift(tag + id + cls);
        cur = cur.parentElement;
      }
      return parts.join('/');
    } catch (_) {
      return '';
    }
  }

  function visible(win, el, rect) {
    try {
      if (!rect || rect.width < 3 || rect.height < 3) return false;
      var cs = win.getComputedStyle(el);
      if (!cs || cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity || 1) < 0.05) return false;
      var vw = win.innerWidth || 0;
      var vh = win.innerHeight || 0;
      return rect.right > 0 && rect.bottom > 0 && rect.left < vw && rect.top < vh;
    } catch (_) {
      return false;
    }
  }

  function textOf(el) {
    var txt = norm(safe(function () { return el.innerText; }, '') || safe(function () { return el.textContent; }, ''));
    var attrs = [
      'aria-label', 'title', 'alt', 'data-countdown', 'data-time', 'data-timer',
      'data-value', 'data-state', 'data-testid', 'role'
    ].map(function (name) {
      var v = safe(function () { return el.getAttribute(name); }, '');
      return v ? (name + '=' + norm(v)) : '';
    }).filter(Boolean).join(' | ');
    return norm(txt || attrs);
  }

  function insideCanvasWatch(el) {
    return !!safe(function () {
      return el && el.closest && el.closest('#__cw_root_allin');
    }, false);
  }

  function numericValue(s) {
    var t = norm(s);
    if (/^\d{1,2}$/.test(t)) return parseInt(t, 10);
    var m = t.match(/\b([0-9]|1[0-9]|2[0-9])\b/);
    return m ? parseInt(m[1], 10) : null;
  }

  function collectElementsDeep(doc, out, seen) {
    try {
      if (!doc || seen.has(doc)) return;
      seen.add(doc);
      var all = doc.querySelectorAll('*');
      for (var i = 0; i < all.length; i++) {
        var el = all[i];
        out.push(el);
        var sr = safe(function () { return el.shadowRoot; }, null);
        if (sr) collectElementsDeep(sr, out, seen);
      }
    } catch (_) {}
  }

  function collectWindows(w, path, out, depth) {
    if (!w || depth > 6) return;
    out.push({ win: w, path: path });
    var frames = safe(function () { return w.frames; }, []);
    for (var i = 0; i < frames.length; i++) {
      collectWindows(frames[i], path + '/frame[' + i + ']', out, depth + 1);
    }
  }

  function collectCandidates() {
    var wins = [];
    collectWindows(window.top || window, 'top', wins, 0);
    var rows = [];
    for (var wi = 0; wi < wins.length; wi++) {
      var item = wins[wi];
      var win = item.win;
      var doc = safe(function () { return win.document; }, null);
      if (!doc) continue;
      var els = [];
      collectElementsDeep(doc, els, new Set());
      var vw = safe(function () { return win.innerWidth; }, 0) || 0;
      var vh = safe(function () { return win.innerHeight; }, 0) || 0;
      for (var ei = 0; ei < els.length; ei++) {
        var el = els[ei];
        if (insideCanvasWatch(el)) continue;
        var r = safe(function () { return el.getBoundingClientRect(); }, null);
        if (!visible(win, el, r)) continue;
        var text = textOf(el);
        var val = numericValue(text);
        var clsId = norm((safe(function () { return el.id; }, '') || '') + ' ' + (safe(function () { return el.className; }, '') || ''));
        var hint = (text + ' ' + clsId + ' ' + cssPath(el)).toLowerCase();
        var looksTimer = /(count|timer|time|progress|clock|second|round|status|bet|phase|state)/i.test(hint);
        var isSingleDigit = val != null && val >= 0 && val <= 20 && /^\d{1,2}$/.test(norm(text));
        var cx = r.left + r.width / 2;
        var cy = r.top + r.height / 2;
        var centerish = vw && vh && cx > vw * 0.35 && cx < vw * 0.65 && cy > vh * 0.45 && cy < vh * 0.82;
        var roundish = Math.abs(r.width - r.height) <= Math.max(18, Math.min(r.width, r.height) * 0.35);
        var score = 0;
        if (isSingleDigit) score += 1000;
        if (looksTimer) score += 500;
        if (centerish) score += 350;
        if (roundish && r.width >= 25 && r.width <= 120) score += 280;
        if (val != null) score += 120;
        if (r.width >= 20 && r.width <= 180 && r.height >= 16 && r.height <= 180) score += 80;
        if (text.length > 24) score -= 350;
        if (score < 500) continue;
        rows.push({
          score: score,
          path: item.path,
          href: safe(function () { return win.location.href; }, ''),
          value: val,
          text: text,
          x: Math.round(r.left),
          y: Math.round(r.top),
          w: Math.round(r.width),
          h: Math.round(r.height),
          tag: String(el.tagName || '').toLowerCase(),
          id: safe(function () { return el.id; }, ''),
          cls: String(safe(function () { return el.className; }, '')).slice(0, 120),
          tail: shortTail(el),
          selector: cssPath(el)
        });
      }
    }
    rows.sort(function (a, b) { return b.score - a.score; });
    return rows.slice(0, MAX_ROWS);
  }

  function chainFromPoint(win, path, x, y) {
    var doc = safe(function () { return win.document; }, null);
    if (!doc) return null;
    var el = safe(function () { return doc.elementFromPoint(x, y); }, null);
    if (!el || insideCanvasWatch(el)) return null;
    var chain = [];
    var cur = el;
    var depth = 0;
    while (cur && cur.nodeType === 1 && depth++ < 10) {
      var r = safe(function () { return cur.getBoundingClientRect(); }, null) || {};
      chain.push({
        tag: String(cur.tagName || '').toLowerCase(),
        id: safe(function () { return cur.id; }, ''),
        cls: String(safe(function () { return cur.className; }, '')).slice(0, 120),
        text: textOf(cur).slice(0, 160),
        x: Math.round(r.left || 0),
        y: Math.round(r.top || 0),
        w: Math.round(r.width || 0),
        h: Math.round(r.height || 0),
        tail: shortTail(cur),
        selector: cssPath(cur)
      });
      cur = cur.parentElement;
    }
    return {
      path: path,
      href: safe(function () { return win.location.href; }, ''),
      point: Math.round(x) + ',' + Math.round(y),
      hitText: textOf(el).slice(0, 160),
      hitTail: shortTail(el),
      chain: chain
    };
  }

  function collectPointChains() {
    var wins = [];
    collectWindows(window.top || window, 'top', wins, 0);
    var rows = [];
    for (var wi = 0; wi < wins.length; wi++) {
      var item = wins[wi];
      var win = item.win;
      var vw = safe(function () { return win.innerWidth; }, 0) || 0;
      var vh = safe(function () { return win.innerHeight; }, 0) || 0;
      if (!vw || !vh) continue;
      var href = safe(function () { return win.location.href; }, '');
      if (href.indexOf('/desktop/baccarat') < 0) continue;
      [
        [0.50, 0.68], [0.50, 0.72], [0.50, 0.76],
        [0.46, 0.72], [0.54, 0.72], [0.42, 0.72], [0.58, 0.72],
        [0.50, 0.64], [0.50, 0.80]
      ].forEach(function (p) {
        var hit = chainFromPoint(win, item.path, vw * p[0], vh * p[1]);
        if (hit) rows.push(hit);
      });
    }
    return rows;
  }

  function keyOf(r) {
    return [r.path, r.selector, r.x, r.y, r.w, r.h].join('|');
  }

  function logJson(label, value) {
    try {
      console.log(label + ' ' + JSON.stringify(value));
    } catch (_) {
      console.log(label, value);
    }
  }

  var first = collectCandidates();
  console.log('[COUNTDOWN-PROBE] initial candidates');
  console.table(first);
  logJson('[COUNTDOWN-PROBE][INITIAL_JSON]', first);
  var pointChains = collectPointChains();
  console.log('[COUNTDOWN-PROBE] point chains near visible center countdown');
  console.log(pointChains);
  logJson('[COUNTDOWN-PROBE][POINT_JSON]', pointChains);
  try { window.__abxCountdownPointProbe = collectPointChains; } catch (_) {}

  var last = new Map();
  first.forEach(function (r) { last.set(keyOf(r), r.value + '|' + r.text); });
  var changes = [];
  var started = Date.now();
  var timer = setInterval(function () {
    var rows = collectCandidates();
    rows.forEach(function (r) {
      var k = keyOf(r);
      var v = r.value + '|' + r.text;
      var prev = last.get(k);
      if (prev != null && prev !== v) {
        changes.push({
          atMs: Date.now() - started,
          from: prev,
          to: v,
          score: r.score,
          path: r.path,
          href: r.href,
          text: r.text,
          x: r.x, y: r.y, w: r.w, h: r.h,
          tail: r.tail,
          selector: r.selector
        });
        console.log('[COUNTDOWN-PROBE][CHANGE]', changes[changes.length - 1]);
        logJson('[COUNTDOWN-PROBE][CHANGE_JSON]', changes[changes.length - 1]);
      }
      last.set(k, v);
    });
    if (Date.now() - started >= DURATION_MS) {
      clearInterval(timer);
      console.log('[COUNTDOWN-PROBE] changed candidates');
      console.table(changes);
      logJson('[COUNTDOWN-PROBE][CHANGES_JSON]', changes);
      console.log('[COUNTDOWN-PROBE] final candidates');
      var finalCandidates = collectCandidates();
      console.table(finalCandidates);
      logJson('[COUNTDOWN-PROBE][FINAL_JSON]', finalCandidates);
      console.log('[COUNTDOWN-PROBE] final point chains');
      var finalPointChains = collectPointChains();
      console.log(finalPointChains);
      logJson('[COUNTDOWN-PROBE][FINAL_POINT_JSON]', finalPointChains);
    }
  }, SAMPLE_MS);

  return {
    note: 'Wait ' + Math.round(DURATION_MS / 1000) + 's. Copy CHANGE rows if any.',
    initial: first,
    pointChains: pointChains
  };
})();
