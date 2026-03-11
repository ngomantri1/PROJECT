(() => {
  'use strict';

  const KEY = '__chipProbeB29';
  const LABEL_PATH_RE = /\/cashBetNode\/(c[1-6])\/textImg$/i;
  const AMOUNTS = [1000, 5000, 10000, 50000, 200000, 1000000, 5000000];
  const AMOUNT_SET = Object.create(null);
  for (let i = 0; i < AMOUNTS.length; i += 1) AMOUNT_SET[String(AMOUNTS[i])] = 1;

  const prev = window[KEY];
  if (prev && typeof prev.destroy === 'function') {
    try {
      prev.destroy();
    } catch (_) {}
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function moneyOf(raw) {
    if (raw == null) return null;
    let s = String(raw).trim().toUpperCase();
    if (!s) return null;
    let mul = 1;
    if (/[KMB]$/.test(s)) {
      mul = s.endsWith('K') ? 1e3 : s.endsWith('M') ? 1e6 : 1e9;
      s = s.slice(0, -1);
    }
    s = s.replace(/,/g, '').replace(/[^\d.]/g, '');
    if (!s) return null;
    const v = parseFloat(s);
    return Number.isFinite(v) ? Math.round(v * mul) : null;
  }

  function getComp(node, T) {
    try {
      return node && node.getComponent ? node.getComponent(T) : null;
    } catch (_) {
      return null;
    }
  }

  function active(node) {
    return !!node && node.activeInHierarchy !== false;
  }

  function hasButton(node) {
    return !!getComp(node, cc.Button);
  }

  function hasToggle(node) {
    return !!getComp(node, cc.Toggle);
  }

  function hasTouch(node) {
    return !!(node && node._touchListener);
  }

  function clickable(node) {
    return hasButton(node) || hasToggle(node) || hasTouch(node);
  }

  function fullPath(node, limit) {
    const out = [];
    let cur = node;
    let count = 0;
    const max = Number(limit || 200);
    while (cur && count < max) {
      if (cur.name) out.push(cur.name);
      cur = cur.parent || cur._parent || null;
      count += 1;
    }
    out.reverse();
    return out.join('/');
  }

  function walkNodes(cb) {
    const scene = window.cc && cc.director && cc.director.getScene ? cc.director.getScene() : null;
    if (!scene) return;
    const stack = [scene];
    const seen = [];
    while (stack.length) {
      const node = stack.pop();
      if (!node || seen.indexOf(node) !== -1) continue;
      seen.push(node);
      try {
        cb(node);
      } catch (_) {}
      const kids = node.children || node._children || [];
      for (let i = 0; i < kids.length; i += 1) stack.push(kids[i]);
    }
  }

  function toScreenPt(node, p) {
    try {
      let cam = null;
      if (cc.Camera && cc.Camera.findCamera) cam = cc.Camera.findCamera(node);
      else if (cc.Camera && cc.Camera.main) cam = cc.Camera.main;
      if (cam && cam.worldToScreen) {
        const sp = cam.worldToScreen(p);
        const fs = cc.view && cc.view.getFrameSize ? cc.view.getFrameSize() : null;
        const vs = cc.view && cc.view.getVisibleSize ? cc.view.getVisibleSize() : null;
        if (fs && vs && vs.width && vs.height) {
          return {
            x: sp.x * (fs.width / vs.width),
            y: sp.y * (fs.height / vs.height)
          };
        }
        return { x: sp.x, y: sp.y };
      }
    } catch (_) {}
    try {
      if (cc.view && cc.view._convertPointWithScale) {
        const sp2 = cc.view._convertPointWithScale(p);
        if (sp2) return { x: sp2.x, y: sp2.y };
      }
    } catch (_) {}
    return { x: p.x || 0, y: p.y || 0 };
  }

  function rectFromNode(node) {
    if (!node) return null;
    try {
      const cs = node.getContentSize ? node.getContentSize() : (node._contentSize || null);
      if (cs && (cs.width || cs.height) && node.convertToWorldSpaceAR) {
        const p = node.convertToWorldSpaceAR(cc.v2 ? cc.v2(0, 0) : new cc.Vec2(0, 0));
        const ax = node.anchorX != null ? node.anchorX : 0.5;
        const ay = node.anchorY != null ? node.anchorY : 0.5;
        const w = cs.width || 0;
        const h = cs.height || 0;
        const blx = (p.x || 0) - w * ax;
        const bly = (p.y || 0) - h * ay;
        const sp1 = toScreenPt(node, cc.v2 ? cc.v2(blx, bly) : new cc.Vec2(blx, bly));
        const sp2 = toScreenPt(node, cc.v2 ? cc.v2(blx + w, bly + h) : new cc.Vec2(blx + w, bly + h));
        const rw = Math.abs(sp2.x - sp1.x);
        const rh = Math.abs(sp2.y - sp1.y);
        if (rw > 0 && rh > 0) {
          return {
            x: Math.min(sp1.x, sp2.x),
            y: Math.min(sp1.y, sp2.y),
            w: rw,
            h: rh
          };
        }
      }
    } catch (_) {}
    try {
      if (node.getBoundingBoxToWorld) {
        const b = node.getBoundingBoxToWorld();
        if (b && (b.width || b.height)) {
          const sp1 = toScreenPt(node, cc.v2 ? cc.v2(b.x, b.y) : new cc.Vec2(b.x, b.y));
          const sp2 = toScreenPt(node, cc.v2 ? cc.v2(b.x + b.width, b.y + b.height) : new cc.Vec2(b.x + b.width, b.y + b.height));
          const rw = Math.abs(sp2.x - sp1.x);
          const rh = Math.abs(sp2.y - sp1.y);
          if (rw > 0 && rh > 0) {
            return {
              x: Math.min(sp1.x, sp2.x),
              y: Math.min(sp1.y, sp2.y),
              w: rw,
              h: rh
            };
          }
        }
      }
    } catch (_) {}
    return null;
  }

  function readTexts(node) {
    const out = [];
    try {
      if (node && node.name) out.push(String(node.name));
      const lb = getComp(node, cc.Label);
      if (lb && typeof lb.string !== 'undefined') out.push(String(lb.string || ''));
      const rt = getComp(node, cc.RichText);
      if (rt && typeof rt.string !== 'undefined') out.push(String(rt.string || ''));
      const sp = getComp(node, cc.Sprite);
      if (sp && sp.spriteFrame && sp.spriteFrame.name) out.push(String(sp.spriteFrame.name || ''));
    } catch (_) {}
    return out.filter(Boolean);
  }

  function componentName(comp) {
    return (comp && (comp.__classname__ || comp.name || (comp.constructor && comp.constructor.name))) || '';
  }

  function listComponents(node) {
    const out = [];
    try {
      const comps = node && node._components ? node._components : [];
      for (let i = 0; i < comps.length; i += 1) {
        const c = comps[i];
        const name = componentName(c);
        const item = { name };
        if (c && typeof c.enabled !== 'undefined') item.enabled = !!c.enabled;
        if (/button/i.test(name)) {
          item.interactable = c.interactable !== false;
          item.clickEvents = c.clickEvents ? c.clickEvents.length : 0;
        }
        if (/toggle/i.test(name)) {
          item.interactable = c.interactable !== false;
          item.isChecked = !!c.isChecked;
          item.checkEvents = c.checkEvents ? c.checkEvents.length : 0;
        }
        if (/sprite/i.test(name) && c.spriteFrame) {
          item.spriteFrame = c.spriteFrame.name || '';
        }
        if (/label|richtext/i.test(name) && typeof c.string !== 'undefined') {
          item.string = String(c.string || '');
        }
        out.push(item);
      }
    } catch (_) {}
    return out;
  }

  function buttonInfo(node) {
    const b = getComp(node, cc.Button);
    if (!b) return null;
    const evs = [];
    try {
      const arr = b.clickEvents || [];
      for (let i = 0; i < arr.length; i += 1) {
        const e = arr[i];
        evs.push({
          target: e && e.target ? fullPath(e.target, 80) : '',
          component: e && e.component ? String(e.component) : '',
          handler: e && e.handler ? String(e.handler) : '',
          customEventData: e && e.customEventData ? String(e.customEventData) : ''
        });
      }
    } catch (_) {}
    return {
      interactable: b.interactable !== false,
      enabled: b.enabled !== false,
      transition: typeof b.transition !== 'undefined' ? b.transition : null,
      clickEvents: evs
    };
  }

  function toggleInfo(node) {
    const t = getComp(node, cc.Toggle);
    if (!t) return null;
    const evs = [];
    try {
      const arr = t.checkEvents || [];
      for (let i = 0; i < arr.length; i += 1) {
        const e = arr[i];
        evs.push({
          target: e && e.target ? fullPath(e.target, 80) : '',
          component: e && e.component ? String(e.component) : '',
          handler: e && e.handler ? String(e.handler) : '',
          customEventData: e && e.customEventData ? String(e.customEventData) : ''
        });
      }
    } catch (_) {}
    return {
      interactable: t.interactable !== false,
      enabled: t.enabled !== false,
      isChecked: !!t.isChecked,
      checkEvents: evs
    };
  }

  function touchInfo(node) {
    const tl = node && node._touchListener;
    if (!tl) return null;
    return {
      hasBegan: !!tl.onTouchBegan,
      hasMoved: !!tl.onTouchMoved,
      hasEnded: !!tl.onTouchEnded,
      hasCancelled: !!tl.onTouchCancelled,
      swallowTouches: typeof tl.swallowTouches !== 'undefined' ? !!tl.swallowTouches : null
    };
  }

  function snapshotNode(node) {
    if (!node) return null;
    const rect = rectFromNode(node);
    const sprite = getComp(node, cc.Sprite);
    const label = getComp(node, cc.Label);
    const rich = getComp(node, cc.RichText);
    const toggle = getComp(node, cc.Toggle);
    return {
      path: fullPath(node, 120),
      active: node.activeInHierarchy !== false,
      opacity: typeof node.opacity !== 'undefined' ? Number(node.opacity) : null,
      scaleX: typeof node.scaleX !== 'undefined' ? Number(node.scaleX) : null,
      scaleY: typeof node.scaleY !== 'undefined' ? Number(node.scaleY) : null,
      rotation: typeof node.angle !== 'undefined' ? Number(node.angle) : (typeof node.rotation !== 'undefined' ? Number(node.rotation) : null),
      color: node.color ? [node.color.r, node.color.g, node.color.b, typeof node.color.a !== 'undefined' ? node.color.a : null].join(',') : '',
      spriteFrame: sprite && sprite.spriteFrame ? String(sprite.spriteFrame.name || '') : '',
      text: label && typeof label.string !== 'undefined'
        ? String(label.string || '')
        : (rich && typeof rich.string !== 'undefined' ? String(rich.string || '') : ''),
      toggleChecked: toggle ? !!toggle.isChecked : null,
      rect: rect ? [Math.round(rect.x), Math.round(rect.y), Math.round(rect.w), Math.round(rect.h)].join(',') : ''
    };
  }

  function diffObject(before, after) {
    const out = {};
    if (!before || !after) return out;
    const keys = Object.keys(before);
    for (let i = 0; i < keys.length; i += 1) {
      const k = keys[i];
      if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) {
        out[k] = { before: before[k], after: after[k] };
      }
    }
    return out;
  }

  function makeTouch(x, y) {
    let touch = null;
    try {
      if (cc.Touch) touch = new cc.Touch(x, y, 0);
    } catch (_) {}
    if (!touch) {
      touch = {
        getLocation() { return { x, y }; },
        getID() { return 0; }
      };
    }
    let eventObj = null;
    try {
      if (cc.Event && cc.Event.EventTouch) eventObj = new cc.Event.EventTouch([touch], true);
    } catch (_) {}
    if (!eventObj) {
      eventObj = {
        getTouches() { return [touch]; },
        getTouch() { return touch; }
      };
    }
    eventObj.touch = touch;
    return { touch, event: eventObj };
  }

  function nodeWorldPos(node) {
    try {
      if (node && node.getWorldPosition) return node.getWorldPosition();
    } catch (_) {}
    try {
      if (node && node.convertToWorldSpaceAR) return node.convertToWorldSpaceAR(cc.v2 ? cc.v2(0, 0) : new cc.Vec2(0, 0));
    } catch (_) {}
    return { x: 0, y: 0 };
  }

  function emitButton(node) {
    const b = getComp(node, cc.Button);
    if (!b || b.interactable === false) return false;
    try {
      cc.Component.EventHandler.emitEvents(b.clickEvents, new cc.Event.EventCustom('click', true));
      return true;
    } catch (_) {
      return false;
    }
  }

  function emitToggle(node) {
    const t = getComp(node, cc.Toggle);
    if (!t || t.interactable === false) return false;
    try {
      t.isChecked = true;
      if (t._emitToggleEvents) t._emitToggleEvents();
      return true;
    } catch (_) {
      return false;
    }
  }

  function emitTouch(node) {
    if (!node) return false;
    const p = nodeWorldPos(node);
    let ok = false;
    try {
      if (cc && cc.Touch && cc.Event && cc.Event.EventTouch && node.emit) {
        const t = new cc.Touch(p.x || 0, p.y || 0);
        const ev = new cc.Event.EventTouch([t], true);
        ev.touch = t;
        ev.getLocation = function () { return { x: p.x || 0, y: p.y || 0 }; };
        const ts = cc.Node && cc.Node.EventType && cc.Node.EventType.TOUCH_START ? cc.Node.EventType.TOUCH_START : 'touchstart';
        const te = cc.Node && cc.Node.EventType && cc.Node.EventType.TOUCH_END ? cc.Node.EventType.TOUCH_END : 'touchend';
        node.emit(ts, ev);
        node.emit(te, ev);
        ok = true;
      }
    } catch (_) {}
    if (!ok && node.emit) {
      try {
        const ev2 = { getLocation() { return { x: p.x || 0, y: p.y || 0 }; } };
        const ts2 = cc.Node && cc.Node.EventType && cc.Node.EventType.TOUCH_START ? cc.Node.EventType.TOUCH_START : 'touchstart';
        const te2 = cc.Node && cc.Node.EventType && cc.Node.EventType.TOUCH_END ? cc.Node.EventType.TOUCH_END : 'touchend';
        node.emit(ts2, ev2);
        node.emit(te2, ev2);
        ok = true;
      } catch (_) {}
    }
    if (!ok && node._touchListener) {
      try {
        const te3 = makeTouch(p.x || 0, p.y || 0);
        if (node._touchListener.onTouchBegan) node._touchListener.onTouchBegan(te3.touch, te3.event);
        if (node._touchListener.onTouchEnded) node._touchListener.onTouchEnded(te3.touch, te3.event);
        ok = true;
      } catch (_) {}
    }
    return ok;
  }

  function scanChips() {
    const rows = [];
    const map = Object.create(null);

    walkNodes((node) => {
      if (!active(node)) return;
      const path = fullPath(node, 180);
      const m = path.match(LABEL_PATH_RE);
      if (!m) return;
      const texts = readTexts(node);
      const amount = texts.map(moneyOf).find((v) => v && AMOUNT_SET[String(v)]) || null;
      if (!amount) return;

      const chain = [];
      let cur = node;
      let depth = 0;
      while (cur && depth <= 5) {
        chain.push(cur);
        cur = cur.parent || cur._parent || null;
        depth += 1;
      }

      const candidates = chain.map((cand, idx) => ({
        idx,
        path: fullPath(cand, 180),
        name: String(cand.name || ''),
        clickable: clickable(cand),
        hasButton: hasButton(cand),
        hasToggle: hasToggle(cand),
        hasTouch: hasTouch(cand),
        rect: rectFromNode(cand)
      }));

      const row = {
        amount,
        group: m[1],
        labelPath: path,
        chain: candidates.map((x) => `${x.idx}:${x.name}`).join(' <- '),
        texts: texts.join(' | ')
      };
      rows.push(row);

      map[String(amount)] = {
        amount,
        group: m[1],
        labelNode: node,
        chain,
        candidates,
        labelPath: path,
        texts
      };
    });

    rows.sort((a, b) => a.amount - b.amount);
    return { rows, map };
  }

  function inspect(amount) {
    const scan = scanChips();
    const hit = scan.map[String(Math.floor(Number(amount) || 0))] || null;
    if (!hit) {
      console.warn('[chipProbe] missing chip', amount);
      return null;
    }
    const rows = [];
    for (let i = 0; i < hit.chain.length; i += 1) {
      const node = hit.chain[i];
      const rect = rectFromNode(node);
      rows.push({
        idx: i,
        name: String(node.name || ''),
        clickable: clickable(node),
        hasButton: hasButton(node),
        hasToggle: hasToggle(node),
        hasTouch: hasTouch(node),
        path: fullPath(node, 180),
        rect: rect ? `${Math.round(rect.x)},${Math.round(rect.y)} ${Math.round(rect.w)}x${Math.round(rect.h)}` : '',
        texts: readTexts(node).join(' | '),
        components: listComponents(node).map((x) => x.name).join(' | ')
      });
    }
    try {
      console.table(rows);
    } catch (_) {
      console.log(rows);
    }
    const detail = hit.chain.map((node, idx) => ({
      idx,
      path: fullPath(node, 180),
      button: buttonInfo(node),
      toggle: toggleInfo(node),
      touch: touchInfo(node),
      components: listComponents(node)
    }));
    console.log('[chipProbe] inspect detail', detail);
    return detail;
  }

  function snapshotAll() {
    const scan = scanChips();
    const out = {};
    for (let i = 0; i < AMOUNTS.length; i += 1) {
      const amount = AMOUNTS[i];
      const hit = scan.map[String(amount)] || null;
      if (!hit) continue;
      out[String(amount)] = hit.chain.map((node) => snapshotNode(node));
    }
    return out;
  }

  function diffSnapshots(before, after) {
    const out = [];
    const keys = Object.keys(after || {});
    for (let i = 0; i < keys.length; i += 1) {
      const amount = keys[i];
      const bArr = before && before[amount] ? before[amount] : [];
      const aArr = after[amount] || [];
      const len = Math.max(bArr.length, aArr.length);
      for (let j = 0; j < len; j += 1) {
        const d = diffObject(bArr[j], aArr[j]);
        if (Object.keys(d).length) {
          out.push({
            amount: Number(amount),
            idx: j,
            path: aArr[j] ? aArr[j].path : (bArr[j] ? bArr[j].path : ''),
            diff: d
          });
        }
      }
    }
    return out;
  }

  async function fire(kind, amount, idx) {
    const scan = scanChips();
    const hit = scan.map[String(Math.floor(Number(amount) || 0))] || null;
    if (!hit) {
      console.warn('[chipProbe] missing chip', amount);
      return { ok: false, reason: 'missing-chip' };
    }
    const node = hit.chain[Number(idx || 0)] || null;
    if (!node) {
      console.warn('[chipProbe] missing chain node', { amount, idx });
      return { ok: false, reason: 'missing-node' };
    }

    const before = snapshotAll();
    let ok = false;
    if (kind === 'button') ok = emitButton(node);
    else if (kind === 'toggle') ok = emitToggle(node);
    else if (kind === 'touch') ok = emitTouch(node);
    else {
      console.warn('[chipProbe] unsupported fire kind', kind);
      return { ok: false, reason: 'unsupported-kind' };
    }

    await sleep(120);
    const after = snapshotAll();
    const diff = diffSnapshots(before, after);

    console.log('[chipProbe] fire result', {
      amount: hit.amount,
      kind,
      idx,
      ok,
      node: fullPath(node, 180),
      diffCount: diff.length
    });
    if (diff.length) console.log('[chipProbe] state diff', diff);

    return {
      ok,
      kind,
      idx,
      node: fullPath(node, 180),
      diff
    };
  }

  async function fireAll(amount) {
    const target = Math.floor(Number(amount) || 0);
    const scan = scanChips();
    const hit = scan.map[String(target)] || null;
    if (!hit) {
      console.warn('[chipProbe] missing chip', amount);
      return [];
    }
    const out = [];
    for (let idx = 0; idx < hit.chain.length; idx += 1) {
      const node = hit.chain[idx];
      if (hasButton(node)) out.push(await fire('button', target, idx));
      if (hasToggle(node)) out.push(await fire('toggle', target, idx));
      if (clickable(node) || hasTouch(node) || node.emit) out.push(await fire('touch', target, idx));
    }
    return out;
  }

  const api = {
    scan() {
      const scan = scanChips();
      try {
        console.table(scan.rows);
      } catch (_) {
        console.log(scan.rows);
      }
      return scan.rows;
    },
    inspect,
    snapshot() {
      const snap = snapshotAll();
      console.log('[chipProbe] snapshot', snap);
      return snap;
    },
    fire,
    fireAll,
    destroy() {
      try {
        delete window[KEY];
      } catch (_) {
        window[KEY] = undefined;
      }
    }
  };

  window[KEY] = api;
  console.log('[chipProbe] node-event debugger ready');
  console.log('  __chipProbeB29.scan()');
  console.log('  __chipProbeB29.inspect(1000)');
  console.log('  __chipProbeB29.snapshot()');
  console.log('  await __chipProbeB29.fire(\"button\", 1000, 1)');
  console.log('  await __chipProbeB29.fire(\"touch\", 1000, 1)');
  console.log('  await __chipProbeB29.fireAll(1000)');
})();
