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
  var ROOT_ID = '__cw_textmap_probe_root';
  var PANEL_ID = '__cw_textmap_probe_panel';
  var LAYER_ID = '__cw_textmap_probe_layer';
  var MAX_ITEMS = 400;

  function cleanup() {
    try {
      var old = rootDoc.getElementById(ROOT_ID);
      if (old) old.remove();
    } catch (_) {}
    try {
      delete rootWin.__cwTextMapProbe;
    } catch (_) {}
  }

  cleanup();

  function collapseText(s) {
    return String(s || '').replace(/\s+/g, ' ').trim();
  }

  function normText(s) {
    try {
      return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    } catch (_) {
      return String(s || '').toLowerCase();
    }
  }

  function isUsefulText(s) {
    var t = collapseText(s);
    if (!t) return false;
    if (t.length > 160) return false;
    if (/^(start|stop|moneymap|betmap|textmap|scan200money|scan200bet|scan200text|scantk|copylog|clearlog)$/i.test(t))
      return false;
    if (/^[\d\s.,:;+\-/%$€£¥₫()]+$/.test(t) && !/[A-Za-zÀ-ỹ]/i.test(t))
      return false;
    return true;
  }

  function elVisible(win, el) {
    try {
      if (!el) return false;
      var r = el.getBoundingClientRect();
      if (!r || r.width < 4 || r.height < 4) return false;
      var cs = win.getComputedStyle(el);
      if (!cs) return false;
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;
      return true;
    } catch (_) {
      return false;
    }
  }

  function elTail(el) {
    try {
      var parts = [];
      var cur = el;
      var depth = 0;
      while (cur && cur.nodeType === 1 && depth < 8) {
        var part = String(cur.tagName || '').toLowerCase();
        if (cur.id) part += '#' + String(cur.id).trim();
        if (cur.classList && cur.classList.length) {
          var cls = Array.prototype.slice.call(cur.classList, 0, 2).join('.');
          if (cls) part += '.' + cls;
        }
        parts.push(part);
        cur = cur.parentElement;
        depth++;
      }
      parts.reverse();
      return parts.join('/');
    } catch (_) {
      return 'dom';
    }
  }

  function topRect(offX, offY, r) {
    return {
      x: Math.round((offX || 0) + (r.left || 0)),
      y: Math.round((offY || 0) + (r.top || 0)),
      w: Math.round(r.width || 0),
      h: Math.round(r.height || 0)
    };
  }

  function domScanWindow(win, source, offX, offY, out, seenWins) {
    try {
      if (!win || seenWins.indexOf(win) >= 0) return;
      seenWins.push(win);

      var doc = win.document;
      if (!doc || !doc.documentElement) return;

      var tags = 'button,a,span,div,p,strong,b,label,li,td,h1,h2,h3,h4,h5,h6';
      var all = doc.querySelectorAll(tags);
      var seen = Object.create(null);

      for (var i = 0; i < all.length && out.length < MAX_ITEMS; i++) {
        var el = all[i];
        if (!elVisible(win, el)) continue;
        if (el.closest && el.closest('#' + ROOT_ID)) continue;
        var text = collapseText(el.innerText || el.textContent || '');
        if (!isUsefulText(text)) continue;
        var r = el.getBoundingClientRect();
        if (r.width > (win.innerWidth || 1920) * 0.8) continue;
        if (r.height > (win.innerHeight || 1080) * 0.3) continue;
        var key = text + '|' + Math.round(r.left) + '|' + Math.round(r.top) + '|' + Math.round(r.width) + '|' + Math.round(r.height);
        if (seen[key]) continue;
        seen[key] = 1;
        var rr = topRect(offX, offY, r);
        out.push({
          kind: 'dom',
          source: source,
          text: text,
          tail: source + ' :: ' + elTail(el),
          x: rr.x,
          y: rr.y,
          w: rr.w,
          h: rr.h
        });
      }

      try {
        for (var fi = 0; fi < win.frames.length; fi++) {
          var child = win.frames[fi];
          var frameEl = child.frameElement;
          var fr = frameEl && frameEl.getBoundingClientRect ? frameEl.getBoundingClientRect() : { left: 0, top: 0 };
          domScanWindow(child, source + '/frame[' + fi + ']', (offX || 0) + (fr.left || 0), (offY || 0) + (fr.top || 0), out, seenWins);
        }
      } catch (_) {}
    } catch (_) {}
  }

  function cocosToScreen(win, node, p) {
    try {
      var cc = win.cc;
      var cam = null;
      if (cc && cc.Camera && cc.Camera.findCamera) cam = cc.Camera.findCamera(node);
      else if (cc && cc.Camera && cc.Camera.main) cam = cc.Camera.main;
      if (cam && cam.worldToScreen) {
        var sp = cam.worldToScreen(p);
        var fs = cc.view && cc.view.getFrameSize ? cc.view.getFrameSize() : null;
        var vs = cc.view && cc.view.getVisibleSize ? cc.view.getVisibleSize() : null;
        if (fs && vs && vs.width && vs.height) {
          return { x: sp.x * (fs.width / vs.width), y: sp.y * (fs.height / vs.height) };
        }
        return { x: sp.x || 0, y: sp.y || 0 };
      }
    } catch (_) {}
    try {
      if (win.cc && win.cc.view && win.cc.view._convertPointWithScale) {
        var sp2 = win.cc.view._convertPointWithScale(p);
        if (sp2) return { x: sp2.x || 0, y: sp2.y || 0 };
      }
    } catch (_) {}
    return { x: p.x || 0, y: p.y || 0 };
  }

  function cocosRect(win, node, text) {
    var cc = win.cc;
    var V2 = cc && (cc.v2 || cc.Vec2);
    function worldPt(x, y) {
      try {
        if (node && node.convertToWorldSpaceAR && V2) return node.convertToWorldSpaceAR(new V2(x, y));
      } catch (_) {}
      try {
        if (cc && cc.UITransform && node && node.getComponent && V2) {
          var ut = node.getComponent(cc.UITransform);
          if (ut && ut.convertToWorldSpaceAR) return ut.convertToWorldSpaceAR(new V2(x, y));
        }
      } catch (_) {}
      try {
        if (node && node.getWorldPosition) {
          var wp = node.getWorldPosition();
          return { x: (wp.x || 0) + (x || 0), y: (wp.y || 0) + (y || 0) };
        }
      } catch (_) {}
      return { x: 0, y: 0 };
    }

    function fromWorldBox(bb) {
      var p1 = cocosToScreen(win, node, { x: bb.x, y: bb.y });
      var p2 = cocosToScreen(win, node, { x: bb.x + bb.width, y: bb.y + bb.height });
      var left = Math.min(p1.x, p2.x);
      var top = Math.min(p1.y, p2.y);
      return {
        x: Math.round(left),
        y: Math.round(top),
        w: Math.round(Math.abs(p2.x - p1.x)),
        h: Math.round(Math.abs(p2.y - p1.y))
      };
    }

    try {
      if (node && node.getBoundingBoxToWorld) {
        var bb = node.getBoundingBoxToWorld();
        if (bb && (bb.width || bb.height)) return fromWorldBox(bb);
      }
    } catch (_) {}

    try {
      if (cc && cc.UITransform && node && node.getComponent) {
        var ut2 = node.getComponent(cc.UITransform);
        if (ut2 && ut2.getBoundingBoxToWorld) {
          var bb2 = ut2.getBoundingBoxToWorld();
          if (bb2 && (bb2.width || bb2.height)) return fromWorldBox(bb2);
        }
      }
    } catch (_) {}

    try {
      var cs = node.getContentSize ? node.getContentSize() : (node._contentSize || { width: 0, height: 0 });
      var p0 = worldPt(0, 0);
      var ax = node.anchorX != null ? node.anchorX : 0.5;
      var ay = node.anchorY != null ? node.anchorY : 0.5;
      var blx = (p0.x || 0) - (cs.width || 0) * ax;
      var bly = (p0.y || 0) - (cs.height || 0) * ay;
      return fromWorldBox({ x: blx, y: bly, width: cs.width || 0, height: cs.height || 0 });
    } catch (_) {}

    var len = Math.max(1, String(text || '').length);
    return { x: 0, y: 0, w: Math.min(800, len * 14), h: 28 };
  }

  function cocosTail(node, limit) {
    limit = limit || 24;
    var parts = [];
    try {
      var cur = node;
      var n = 0;
      while (cur && n < limit) {
        if (cur.name) parts.push(cur.name);
        cur = cur.parent || cur._parent || null;
        n++;
      }
    } catch (_) {}
    parts.reverse();
    return parts.join('/');
  }

  function cocosScanWindow(win, source, offX, offY, out, seenWins) {
    try {
      if (!win || seenWins.indexOf(win) >= 0) return;
      seenWins.push(win);
      if (!win.cc || !win.cc.director || !win.cc.director.getScene) return;

      var cc = win.cc;
      var scene = cc.director.getScene();
      if (!scene) return;

      var stack = [scene];
      var seenNodes = [];
      var seenItems = Object.create(null);

      while (stack.length && out.length < MAX_ITEMS) {
        var node = stack.pop();
        if (!node || seenNodes.indexOf(node) >= 0) continue;
        seenNodes.push(node);

        try {
          var comps = node._components || [];
          for (var i = 0; i < comps.length && out.length < MAX_ITEMS; i++) {
            var comp = comps[i];
            if (!comp || typeof comp.string === 'undefined') continue;
            var text = collapseText(comp.string == null ? '' : comp.string);
            if (!isUsefulText(text)) continue;
            var rect = cocosRect(win, node, text);
            if (!rect || rect.w < 2 || rect.h < 2) continue;
            var tail = cocosTail(node, 40);
            var key = text + '|' + rect.x + '|' + rect.y + '|' + rect.w + '|' + rect.h + '|' + tail;
            if (seenItems[key]) continue;
            seenItems[key] = 1;
            out.push({
              kind: 'cocos',
              source: source,
              text: text,
              tail: tail,
              x: Math.round((offX || 0) + rect.x),
              y: Math.round((offY || 0) + rect.y),
              w: Math.round(rect.w),
              h: Math.round(rect.h)
            });
          }
        } catch (_) {}

        try {
          var kids = node.children || node._children || [];
          for (var k = 0; k < kids.length; k++) stack.push(kids[k]);
        } catch (_) {}
      }
    } catch (_) {}

    try {
      for (var fi = 0; fi < win.frames.length; fi++) {
        var child = win.frames[fi];
        var frameEl = child.frameElement;
        var fr = frameEl && frameEl.getBoundingClientRect ? frameEl.getBoundingClientRect() : { left: 0, top: 0 };
        cocosScanWindow(child, source + '/frame[' + fi + ']', (offX || 0) + (fr.left || 0), (offY || 0) + (fr.top || 0), out, seenWins);
      }
    } catch (_) {}
  }

  function sortItems(list) {
    return list.sort(function (a, b) {
      return (a.kind > b.kind ? 1 : a.kind < b.kind ? -1 : 0)
        || (a.source > b.source ? 1 : a.source < b.source ? -1 : 0)
        || (a.y - b.y)
        || (a.x - b.x)
        || String(a.text || '').localeCompare(String(b.text || ''));
    });
  }

  function buildUi() {
    var root = rootDoc.createElement('div');
    root.id = ROOT_ID;
    root.style.cssText = 'position:fixed;inset:0;z-index:2147483646;pointer-events:none;';

    var panel = rootDoc.createElement('div');
    panel.id = PANEL_ID;
    panel.style.cssText = 'position:fixed;top:12px;right:12px;width:640px;max-height:80vh;overflow:auto;background:#08130f;color:#bff;border:1px solid #0a0;border-radius:10px;padding:10px;font:12px/1.45 Consolas,monospace;pointer-events:auto;z-index:2147483647;';
    panel.innerHTML =
      '<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">' +
      '<b style="color:#9f9">CW TextMap Probe</b>' +
      '<button id="cwProbeRun">Run</button>' +
      '<button id="cwProbeClear">Clear Box</button>' +
      '<button id="cwProbeClose">Close</button>' +
      '<span id="cwProbeStat" style="margin-left:auto;color:#ffd866">idle</span>' +
      '</div>' +
      '<div id="cwProbeInfo" style="white-space:pre-wrap;background:#0b1b16;border:1px solid #2a5;padding:6px;border-radius:6px;margin-bottom:8px"></div>' +
      '<div id="cwProbeLog" style="white-space:pre-wrap;background:#0b1b16;border:1px solid #2a5;padding:6px;border-radius:6px;max-height:48vh;overflow:auto"></div>';

    var layer = rootDoc.createElement('div');
    layer.id = LAYER_ID;
    layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483645;';

    root.appendChild(layer);
    root.appendChild(panel);
    (rootDoc.body || rootDoc.documentElement).appendChild(root);
    return { root: root, panel: panel, layer: layer };
  }

  var ui = buildUi();

  function setInfo(text) {
    var el = rootDoc.getElementById('cwProbeInfo');
    if (el) el.textContent = text;
  }

  function setLog(text) {
    var el = rootDoc.getElementById('cwProbeLog');
    if (el) el.textContent = text;
  }

  function setStat(text) {
    var el = rootDoc.getElementById('cwProbeStat');
    if (el) el.textContent = text;
  }

  function clearBoxes() {
    try {
      ui.layer.innerHTML = '';
    } catch (_) {}
  }

  function drawBoxes(items) {
    clearBoxes();
    for (var i = 0; i < items.length && i < 120; i++) {
      var item = items[i];
      var d = rootDoc.createElement('div');
      var color = item.kind === 'cocos' ? '#00ffff' : '#ffd866';
      d.style.cssText =
        'position:fixed;left:' + item.x + 'px;top:' + item.y + 'px;width:' + Math.max(2, item.w) + 'px;height:' + Math.max(2, item.h) + 'px;' +
        'outline:1px dashed ' + color + ';background:' + (item.kind === 'cocos' ? '#00ffff22' : '#ffd86622') + ';' +
        'pointer-events:none;box-sizing:border-box;';
      d.title = '[' + item.kind + '] ' + item.text + '\n' + item.tail;
      ui.layer.appendChild(d);
    }
  }

  function summarize(items) {
    var byKind = { cocos: 0, dom: 0 };
    var bySource = Object.create(null);
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      byKind[it.kind] = (byKind[it.kind] || 0) + 1;
      bySource[it.source] = (bySource[it.source] || 0) + 1;
    }
    var lines = [];
    lines.push('total=' + items.length + ' | cocos=' + byKind.cocos + ' | dom=' + byKind.dom);
    lines.push('href=' + String(rootWin.location && rootWin.location.href || ''));
    lines.push('sources:');
    var sourceKeys = Object.keys(bySource).sort();
    for (var j = 0; j < sourceKeys.length; j++) {
      var k = sourceKeys[j];
      lines.push('  ' + k + ' -> ' + bySource[k]);
    }
    return lines.join('\n');
  }

  function formatRows(items) {
    var lines = ['idx\tkind\tsource\ttext\tx\ty\tw\th\ttail'];
    for (var i = 0; i < items.length && i < 200; i++) {
      var it = items[i];
      lines.push(
        i + '\t' +
        it.kind + '\t' +
        it.source + '\t' +
        JSON.stringify(it.text) + '\t' +
        it.x + '\t' +
        it.y + '\t' +
        it.w + '\t' +
        it.h + '\t' +
        it.tail
      );
    }
    if (items.length === 0) lines.push('(empty)');
    return lines.join('\n');
  }

  function runProbe() {
    var domItems = [];
    var cocosItems = [];
    var domSeenWins = [];
    var cocosSeenWins = [];

    domScanWindow(rootWin, 'top', 0, 0, domItems, domSeenWins);
    cocosScanWindow(rootWin, 'top', 0, 0, cocosItems, cocosSeenWins);

    var all = sortItems(domItems.concat(cocosItems));
    rootWin.__cwTextMapProbe.last = all;

    setStat('items=' + all.length);
    setInfo(summarize(all));
    setLog(formatRows(all));
    drawBoxes(all);

    try {
      console.log('[CW TextMap Probe] summary');
      console.log(summarize(all));
      console.table(all.slice(0, 200));
    } catch (_) {}

    return all;
  }

  rootWin.__cwTextMapProbe = {
    run: runProbe,
    clear: clearBoxes,
    close: cleanup,
    last: []
  };

  rootDoc.getElementById('cwProbeRun').onclick = runProbe;
  rootDoc.getElementById('cwProbeClear').onclick = clearBoxes;
  rootDoc.getElementById('cwProbeClose').onclick = cleanup;

  setInfo('Ready. Click Run or call __cwTextMapProbe.run()');
  setLog('Probe loaded.');
  setStat('ready');

  runProbe();
})();
