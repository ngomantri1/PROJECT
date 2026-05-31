(function () {
  'use strict';

  var TAG = 'CW_BPT_PROBE';

  function now() {
    return new Date().toISOString();
  }

  function normText(v) {
    return String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
  }

  function lower(v) {
    return normText(v).toLowerCase();
  }

  function isVisible(el, win) {
    try {
      if (!el || !el.getBoundingClientRect) return false;
      var cs = win.getComputedStyle(el);
      if (!cs || cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity || 1) <= 0.01) return false;
      var r = el.getBoundingClientRect();
      return r.width >= 3 && r.height >= 3 && r.bottom >= 0 && r.right >= 0 && r.left <= win.innerWidth && r.top <= win.innerHeight;
    } catch (_) {
      return false;
    }
  }

  function frameRect(win) {
    try {
      if (!win.frameElement || !win.frameElement.getBoundingClientRect) return { x: 0, y: 0 };
      var r = win.frameElement.getBoundingClientRect();
      return { x: Number(r.left || 0), y: Number(r.top || 0) };
    } catch (_) {
      return { x: 0, y: 0 };
    }
  }

  function walkWindows(win, source, ox, oy, out, seen) {
    try {
      if (!win || seen.indexOf(win) >= 0) return;
      seen.push(win);
      if (win.document && win.document.documentElement) {
        out.push({ win: win, doc: win.document, source: source, ox: ox || 0, oy: oy || 0 });
      }
    } catch (_) {
      return;
    }
    try {
      for (var i = 0; i < win.frames.length; i++) {
        var child = win.frames[i];
        var fr = frameRect(child);
        walkWindows(child, source + '/frame[' + i + ']', (ox || 0) + fr.x, (oy || 0) + fr.y, out, seen);
      }
    } catch (_) {}
  }

  function getWindows() {
    var out = [];
    walkWindows(window, 'current', 0, 0, out, []);
    try {
      if (window.top && window.top !== window) walkWindows(window.top, 'top', 0, 0, out, []);
    } catch (_) {}
    return out;
  }

  function tailOfNode(n, limit) {
    var a = [];
    try {
      var t = n;
      var c = 0;
      while (t && c < (limit || 80)) {
        if (t.name) a.push(String(t.name));
        t = t.parent || t._parent || null;
        c++;
      }
    } catch (_) {}
    a.reverse();
    return a.join('/');
  }

  function walkCocosNodes(win, cb) {
    try {
      var cc = win.cc;
      if (!cc || !cc.director || !cc.director.getScene) return false;
      var scene = cc.director.getScene();
      if (!scene) return false;
      var st = [scene];
      var seen = [];
      while (st.length) {
        var n = st.pop();
        if (!n || seen.indexOf(n) >= 0) continue;
        seen.push(n);
        try { cb(n, cc); } catch (_) {}
        var kids = n.children || n._children || [];
        for (var i = 0; i < kids.length; i++) {
          if (kids[i] && seen.indexOf(kids[i]) < 0) st.push(kids[i]);
        }
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  function makeV2(cc, x, y) {
    try {
      if (cc && cc.Vec2) return new cc.Vec2(x, y);
      if (cc && cc.v2) return cc.v2(x, y);
    } catch (_) {}
    return { x: x, y: y };
  }

  function screenPoint(win, cc, p) {
    try {
      if (cc && cc.view && cc.view.convertToLocationInView) {
        var fs = cc.view.getFrameSize ? cc.view.getFrameSize() : null;
        var vs = cc.view.getVisibleSize ? cc.view.getVisibleSize() : null;
        var sp = cc.view.convertToLocationInView(p.x || 0, p.y || 0, { x: 0, y: 0 });
        if (sp && fs && vs && vs.width && vs.height) {
          return { x: sp.x * (fs.width / vs.width), y: sp.y * (fs.height / vs.height) };
        }
        if (sp) return { x: sp.x, y: sp.y };
      }
    } catch (_) {}
    return { x: Number(p && p.x || 0), y: Number(p && p.y || 0) };
  }

  function cocosRect(win, cc, node, ox, oy) {
    try {
      var p = node.convertToWorldSpaceAR ? node.convertToWorldSpaceAR(makeV2(cc, 0, 0)) : { x: node.x || 0, y: node.y || 0 };
      var cs = node.getContentSize ? node.getContentSize() : (node._contentSize || { width: 0, height: 0 });
      var ax = node.anchorX != null ? node.anchorX : 0.5;
      var ay = node.anchorY != null ? node.anchorY : 0.5;
      var ww = Number(cs.width || 0);
      var hh = Number(cs.height || 0);
      var blx = Number(p.x || 0) - ww * ax;
      var bly = Number(p.y || 0) - hh * ay;
      var sp1 = screenPoint(win, cc, { x: blx, y: bly });
      var sp2 = screenPoint(win, cc, { x: blx + ww, y: bly + hh });
      var x = Math.min(sp1.x, sp2.x) + (ox || 0);
      var y = Math.min(sp1.y, sp2.y) + (oy || 0);
      var w = Math.abs(sp2.x - sp1.x);
      var h = Math.abs(sp2.y - sp1.y);
      return { x: x, y: y, w: w, h: h, cx: x + w / 2, cy: y + h / 2 };
    } catch (_) {
      return { x: 0, y: 0, w: 0, h: 0, cx: 0, cy: 0 };
    }
  }

  function collectCocosLabels(ctx) {
    var out = [];
    walkCocosNodes(ctx.win, function (n, cc) {
      var comps = n._components || [];
      for (var i = 0; i < comps.length; i++) {
        var c = comps[i];
        if (!c || typeof c.string === 'undefined') continue;
        var text = normText(c.string);
        if (!text) continue;
        var r = cocosRect(ctx.win, cc, n, ctx.ox, ctx.oy);
        var tail = tailOfNode(n, 120);
        out.push({
          source: ctx.source,
          kind: 'cocos',
          text: text,
          x: Math.round(r.x),
          y: Math.round(r.y),
          w: Math.round(r.w),
          h: Math.round(r.h),
          cx: Math.round(r.cx),
          cy: Math.round(r.cy),
          tail: tail,
          tl: lower(tail)
        });
      }
    });
    return out;
  }

  function collectDomLabels(ctx) {
    var out = [];
    var seen = {};
    try {
      var all = ctx.doc.querySelectorAll('button,a,span,div,p,strong,b,label,li,td,h1,h2,h3,h4,h5');
      for (var i = 0; i < all.length && i < 4000; i++) {
        var el = all[i];
        if (!isVisible(el, ctx.win)) continue;
        var text = normText(el.innerText || el.textContent || el.value || '');
        if (!text || text.length > 140) continue;
        if (el.childElementCount > 0 && text.length > 30) continue;
        var r = el.getBoundingClientRect();
        var key = text + '|' + Math.round(ctx.ox + r.left) + '|' + Math.round(ctx.oy + r.top);
        if (seen[key]) continue;
        seen[key] = 1;
        var tail = lower((el.id ? '#' + el.id : '') + ' ' + (el.className ? '.' + String(el.className).replace(/\s+/g, '.') : '') + ' ' + el.tagName);
        out.push({
          source: ctx.source,
          kind: 'dom',
          text: text,
          x: Math.round(ctx.ox + r.left),
          y: Math.round(ctx.oy + r.top),
          w: Math.round(r.width),
          h: Math.round(r.height),
          cx: Math.round(ctx.ox + r.left + r.width / 2),
          cy: Math.round(ctx.oy + r.top + r.height / 2),
          tail: tail,
          tl: tail
        });
      }
    } catch (_) {}
    return out;
  }

  function collectLabels() {
    var contexts = getWindows();
    var labels = [];
    var hasCocos = false;
    for (var i = 0; i < contexts.length; i++) {
      try {
        if (contexts[i].win.cc && contexts[i].win.cc.director && contexts[i].win.cc.director.getScene) {
          hasCocos = true;
          labels = labels.concat(collectCocosLabels(contexts[i]));
        }
      } catch (_) {}
      labels = labels.concat(collectDomLabels(contexts[i]));
    }
    return { labels: labels, hasCocos: hasCocos, contexts: contexts.map(function (c) { return c.source; }) };
  }

  function numericValue(text) {
    var s = normText(text).replace(/,/g, '');
    if (!/^\d{1,4}$/.test(s)) return null;
    return parseInt(s, 10);
  }

  function compactLabel(l) {
    return {
      text: l.text,
      value: numericValue(l.text),
      x: l.x,
      y: l.y,
      cx: l.cx,
      cy: l.cy,
      w: l.w,
      h: l.h,
      kind: l.kind,
      source: l.source,
      tail: String(l.tail || '').slice(-120)
    };
  }

  function makeRows(items, tolerance) {
    var rows = [];
    items.slice().sort(function (a, b) { return a.cy - b.cy || a.cx - b.cx; }).forEach(function (it) {
      var placed = false;
      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        if (Math.abs(it.cy - row.cy) <= Math.max(tolerance || 14, row.avgH * 0.9, it.h * 0.9)) {
          var oldLen = row.items.length;
          row.items.push(it);
          row.cy = (row.cy * oldLen + it.cy) / (oldLen + 1);
          row.avgH = (row.avgH * oldLen + it.h) / (oldLen + 1);
          placed = true;
          break;
        }
      }
      if (!placed) rows.push({ cy: it.cy, avgH: it.h || 14, items: [it] });
    });
    return rows;
  }

  function pickByStatsTail(labels) {
    var target = labels.filter(function (l) {
      return /stats-and-predictions|prediction|predict|stat|road|result/i.test(l.tail || '');
    });
    return pickMarkerRow(target, 'stats-tail');
  }

  function parseInlineBptText(text) {
    var s = normText(text).toUpperCase();
    var m = s.match(/(?:^|\s)B\s*[:：]?\s*(\d{1,4})\s+P\s*[:：]?\s*(\d{1,4})\s+T\s*[:：]?\s*(\d{1,4})(?:\s|$|[^0-9])/);
    if (!m) return null;
    return { B: parseInt(m[1], 10), P: parseInt(m[2], 10), T: parseInt(m[3], 10) };
  }

  function pickInlineBptText(labels) {
    var candidates = [];
    labels.forEach(function (l) {
      var parsed = parseInlineBptText(l.text);
      if (!parsed) return;
      var score = 0;
      score += Number(l.y || 0) * 1.1;
      score += Number(l.x || 0) * 0.8;
      if (/stats-and-predictions|prediction|predict|stats|road|result/i.test(l.tail || '')) score += 500;
      if (/B\s*\d+\s+P\s*\d+\s+T\s*\d+\s+B\?\s*P\?/i.test(l.text || '')) score += 250;
      candidates.push({
        B: parsed.B,
        P: parsed.P,
        T: parsed.T,
        source: 'inline-text-bpt',
        score: Math.round(score),
        text: l.text,
        x: l.x,
        y: l.y,
        w: l.w,
        h: l.h,
        tail: l.tail
      });
    });
    candidates.sort(function (a, b) { return b.score - a.score; });
    return { best: candidates[0] || null, candidates: candidates.slice(0, 12) };
  }

  function pickMarkerRow(labels, source) {
    var rows = makeRows(labels, 16);
    var best = null;
    rows.forEach(function (row) {
      var items = row.items.slice().sort(function (a, b) { return a.cx - b.cx; });
      var markers = {};
      var nums = [];
      items.forEach(function (it) {
        var t = normText(it.text).toUpperCase();
        var v = numericValue(t);
        if (t === 'B' || t === 'BANKER') markers.B = it;
        else if (t === 'P' || t === 'PLAYER') markers.P = it;
        else if (t === 'T' || t === 'TIE') markers.T = it;
        else if (v != null) nums.push(Object.assign({ value: v }, it));
      });
      if (!markers.B || !markers.P || !markers.T || nums.length < 3) return;
      function nearestRight(m) {
        var cand = nums.filter(function (n) { return n.cx >= m.cx - 4; }).sort(function (a, b) {
          return Math.abs(a.cy - m.cy) - Math.abs(b.cy - m.cy) || a.cx - b.cx;
        })[0];
        return cand || null;
      }
      var b = nearestRight(markers.B);
      var p = nearestRight(markers.P);
      var t = nearestRight(markers.T);
      if (!b || !p || !t) return;
      var score = row.cy + Math.min(markers.B.x, markers.P.x, markers.T.x) / 3 + nums.length * 8;
      if (!best || score > best.score) {
        best = { B: b.value, P: p.value, T: t.value, source: source || 'marker-row-bpt', score: score, row: row };
      }
    });
    return best;
  }

  function pickLowerRightTriplet(labels) {
    var winW = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0, 1);
    var winH = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0, 1);
    var nums = labels.map(function (l) {
      var v = numericValue(l.text);
      if (v == null) return null;
      return Object.assign({ value: v }, l);
    }).filter(Boolean).filter(function (n) {
      if (n.value > 999) return false;
      if (n.w > 90 || n.h > 50) return false;
      return true;
    });
    var rows = makeRows(nums, 18);
    var candidates = [];
    rows.forEach(function (row) {
      var items = row.items.slice().sort(function (a, b) { return a.cx - b.cx; });
      for (var i = 0; i <= items.length - 3; i++) {
        for (var j = i + 1; j <= Math.min(items.length - 2, i + 3); j++) {
          for (var k = j + 1; k <= Math.min(items.length - 1, j + 3); k++) {
            var a = items[i], b = items[j], c = items[k];
            var gap1 = b.cx - a.cx;
            var gap2 = c.cx - b.cx;
            var minX = Math.min(a.x, b.x, c.x);
            var maxX = Math.max(a.x + a.w, b.x + b.w, c.x + c.w);
            var width = maxX - minX;
            if (gap1 < 15 || gap2 < 15 || gap1 > 170 || gap2 > 170) continue;
            if (width < 35 || width > 320) continue;
            var score = 0;
            score += row.cy * 1.1;
            score += minX * 0.9;
            score -= Math.abs(gap1 - gap2) * 2.5;
            score -= Math.abs(width - 120) * 0.8;
            if (minX >= winW * 0.55) score += 350;
            if (row.cy >= winH * 0.60) score += 260;
            if (a.kind === 'cocos' && b.kind === 'cocos' && c.kind === 'cocos') score += 80;
            candidates.push({
              B: a.value,
              P: b.value,
              T: c.value,
              source: 'lower-right-number-triplet',
              score: Math.round(score),
              cy: Math.round(row.cy),
              minX: Math.round(minX),
              width: Math.round(width),
              nums: [a.text, b.text, c.text],
              row: row
            });
          }
        }
      }
    });
    candidates.sort(function (a, b) { return b.score - a.score; });
    return { best: candidates[0] || null, candidates: candidates.slice(0, 12) };
  }

  function runProbe() {
    var collected = collectLabels();
    var labels = collected.labels;
    var inline = pickInlineBptText(labels);
    var byStatsTail = pickByStatsTail(labels);
    var byMarkerRow = pickMarkerRow(labels, 'marker-row-bpt');
    var triplet = pickLowerRightTriplet(labels);
    var result = inline.best || byStatsTail || byMarkerRow || triplet.best || null;
    var numeric = labels.map(compactLabel).filter(function (x) { return x.value != null; }).sort(function (a, b) {
      return b.y - a.y || b.x - a.x;
    });
    var nearStats = labels.map(compactLabel).filter(function (x) {
      return /stats|prediction|predict|road|result|banker|player|tie/i.test(x.tail + ' ' + x.text);
    }).slice(0, 80);

    console.group(TAG + ' ' + now());
    console.log('RESULT =', result ? { B: result.B, P: result.P, T: result.T, source: result.source, score: result.score } : null);
    console.log('contexts =', collected.contexts, 'hasCocos =', collected.hasCocos, 'labelCount =', labels.length, 'numericCount =', numeric.length);
    console.log('byInlineText =', inline.best ? { B: inline.best.B, P: inline.best.P, T: inline.best.T, source: inline.best.source, score: inline.best.score, text: inline.best.text } : null);
    console.log('byStatsTail =', byStatsTail ? { B: byStatsTail.B, P: byStatsTail.P, T: byStatsTail.T, source: byStatsTail.source, score: byStatsTail.score } : null);
    console.log('byMarkerRow =', byMarkerRow ? { B: byMarkerRow.B, P: byMarkerRow.P, T: byMarkerRow.T, source: byMarkerRow.source, score: byMarkerRow.score } : null);
    console.log('byLowerRightTriplet =', triplet.best ? { B: triplet.best.B, P: triplet.best.P, T: triplet.best.T, source: triplet.best.source, score: triplet.best.score, nums: triplet.best.nums } : null);
    console.table(triplet.candidates.map(function (c) {
      return { B: c.B, P: c.P, T: c.T, score: c.score, cy: c.cy, minX: c.minX, width: c.width, nums: c.nums.join(',') };
    }));
    console.table(inline.candidates.map(function (c) {
      return { B: c.B, P: c.P, T: c.T, score: c.score, x: c.x, y: c.y, text: c.text, tail: String(c.tail || '').slice(-100) };
    }));
    console.table(numeric.slice(0, 120));
    if (nearStats.length) console.table(nearStats);
    console.groupEnd();
    window.__cwLastBptProbe = { result: result, labels: labels, numeric: numeric, inlineCandidates: inline.candidates, tripletCandidates: triplet.candidates };
    return result ? { B: result.B, P: result.P, T: result.T, source: result.source } : null;
  }

  window.__cwProbeBpt = runProbe;
  return runProbe();
})();
