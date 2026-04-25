(() => {
    'use strict';

    const NS = '__b52ResultBoardProbe';

    if (window[NS] && typeof window[NS].stop === 'function') {
        try { window[NS].stop(); } catch (_) {}
    }

    function getScene() {
        try {
            return window.cc && cc.director && cc.director.getScene ? cc.director.getScene() : null;
        } catch (_) {
            return null;
        }
    }

    function getComp(node, T) {
        try {
            return node && node.getComponent ? node.getComponent(T) : null;
        } catch (_) {
            return null;
        }
    }

    function fullPath(node, limit) {
        const out = [];
        let cur = node;
        let hop = 0;
        limit = limit || 180;
        while (cur && hop < limit) {
            if (cur.name) out.push(cur.name);
            cur = cur.parent || cur._parent || null;
            hop++;
        }
        out.reverse();
        return out.join('/');
    }

    function nodeActive(node) {
        try {
            if (!node) return false;
            if (node.active === false) return false;
            if (node.activeInHierarchy === false) return false;
            if (node._activeInHierarchy === false) return false;
            if (typeof node.opacity !== 'undefined' && Number(node.opacity) <= 3) return false;
        } catch (_) {
            return false;
        }
        return true;
    }

    function walkNodes(cb) {
        const scene = getScene();
        if (!scene) return;
        const q = [scene];
        const seen = new Set();
        while (q.length) {
            const node = q.shift();
            if (!node || seen.has(node)) continue;
            seen.add(node);
            try { cb(node); } catch (_) {}
            const kids = node.children || node._children || [];
            for (let i = 0; i < kids.length; i++) q.push(kids[i]);
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
        return { x: p.x || 0, y: p.y || 0 };
    }

    function rectOf(node) {
        try {
            const V2 = cc.v2 || cc.Vec2;
            const p = node.convertToWorldSpaceAR(new V2(0, 0));
            const cs = node.getContentSize ? node.getContentSize() : (node._contentSize || { width: 0, height: 0 });
            const ax = node.anchorX != null ? node.anchorX : 0.5;
            const ay = node.anchorY != null ? node.anchorY : 0.5;
            const blx = (p.x || 0) - (cs.width || 0) * ax;
            const bly = (p.y || 0) - (cs.height || 0) * ay;
            const sp1 = toScreenPt(node, new V2(blx, bly));
            const sp2 = toScreenPt(node, new V2(blx + (cs.width || 0), bly + (cs.height || 0)));
            const x = Math.min(sp1.x, sp2.x);
            const y = Math.min(sp1.y, sp2.y);
            const w = Math.abs(sp2.x - sp1.x);
            const h = Math.abs(sp2.y - sp1.y);
            return {
                x, y, w, h,
                cx: x + w * 0.5,
                cy: y + h * 0.5
            };
        } catch (_) {
            return null;
        }
    }

    function beadVal(name, nodeName) {
        const sprite = String(name || '').toLowerCase();
        const node = String(nodeName || '').toLowerCase();

        // Bảng kết quả B52 mới:
        // - quân đỏ => CHẴN
        // - quân trắng => LẺ
        // Ưu tiên nhận theo sprite name, không dùng parent node "Red"
        // vì log thực tế cho thấy cả conDo và cOnTrang đều đang nằm dưới nodeName = "Red".
        if (/condo|con_do|\bdo\b|red/.test(sprite)) return 'C';
        if (/contrang|con_trang|\btrang\b|white/.test(sprite)) return 'L';

        // Fallback yếu hơn cho scene cũ.
        if (/(\bchan\b|even)/.test(sprite)) return 'C';
        if (/(\ble\b|odd)/.test(sprite)) return 'L';
        if (/(\bchan\b|even)/.test(node)) return 'C';
        if (/(\ble\b|odd)/.test(node)) return 'L';
        return '?';
    }

    function median(arr) {
        const b = (arr || []).slice().sort((x, y) => x - y);
        return b[Math.floor(b.length / 2)] || 0;
    }

    function clusterByX(items) {
        if (!items || !items.length) return [];
        const xs = [];
        for (let i = 0; i < items.length; i++) {
            const X = Math.round(items[i].x);
            if (xs.indexOf(X) === -1) xs.push(X);
        }
        xs.sort((a, b) => a - b);
        const diffs = [];
        for (let i = 1; i < xs.length; i++) diffs.push(xs[i] - xs[i - 1]);
        const spacing = diffs.length ? median(diffs) : 28;
        const thr = Math.max(8, Math.round(spacing * 0.6));
        const cols = [];
        const sorted = items.slice().sort((a, b) => a.x - b.x);
        for (let i = 0; i < sorted.length; i++) {
            const it = sorted[i];
            let col = null;
            for (let j = 0; j < cols.length; j++) {
                if (Math.abs(cols[j].cx - it.x) <= thr) {
                    col = cols[j];
                    break;
                }
            }
            if (!col) {
                col = { cx: it.x, items: [] };
                cols.push(col);
            }
            col.items.push(it);
            col.cx = (col.cx * (col.items.length - 1) + it.x) / col.items.length;
        }
        cols.sort((a, b) => a.cx - b.cx);
        for (let i = 0; i < cols.length; i++) {
            cols[i].items.sort((a, b) => b.y - a.y);
        }
        return cols;
    }

    function limitSeq55(seq) {
        seq = String(seq || '');
        return seq.length <= 55 ? seq : seq.slice(-55);
    }

    function normalizeSeqCL(seq) {
        seq = String(seq || '').toUpperCase();
        let out = '';
        for (let i = 0; i < seq.length; i++) {
            const ch = seq.charAt(i);
            if (ch === 'C' || ch === 'L') out += ch;
            else if (ch === '0') out += 'C';
            else if (ch === '1') out += 'L';
        }
        return limitSeq55(out);
    }

    function rectUnion(items) {
        if (!items || !items.length) return null;
        let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
        for (let i = 0; i < items.length; i++) {
            const r = items[i].rect;
            if (!r) continue;
            minX = Math.min(minX, r.x);
            minY = Math.min(minY, r.y);
            maxX = Math.max(maxX, r.x + r.w);
            maxY = Math.max(maxY, r.y + r.h);
        }
        if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) return null;
        return {
            x: minX,
            y: minY,
            w: Math.max(0, maxX - minX),
            h: Math.max(0, maxY - minY),
            cx: (minX + maxX) * 0.5,
            cy: (minY + maxY) * 0.5
        };
    }

    function getGameCanvas() {
        try {
            if (window.cc && cc.game && cc.game.canvas) return cc.game.canvas;
        } catch (_) {}
        try {
            const list = Array.from(document.querySelectorAll('canvas'));
            if (list.length === 1) return list[0];
            list.sort((a, b) => (b.width * b.height) - (a.width * a.height));
            return list[0] || null;
        } catch (_) {
            return null;
        }
    }

    function sampleBeadColor(item) {
        try {
            const canvas = getGameCanvas();
            if (!canvas) return null;
            const ctx = canvas.getContext && canvas.getContext('2d');
            if (!ctx || !ctx.getImageData) return null;
            const br = canvas.getBoundingClientRect();
            if (!br || !br.width || !br.height) return null;

            const sx = item.x;
            const syTop = window.innerHeight - item.y;
            const px = Math.round((sx - br.left) * (canvas.width / br.width));
            const py = Math.round((syTop - br.top) * (canvas.height / br.height));
            const radius = Math.max(2, Math.min(6, Math.round(Math.min(item.rect.w, item.rect.h) * 0.18)));
            const x = Math.max(0, Math.min(canvas.width - 1, px - radius));
            const y = Math.max(0, Math.min(canvas.height - 1, py - radius));
            const w = Math.max(1, Math.min(canvas.width - x, radius * 2 + 1));
            const h = Math.max(1, Math.min(canvas.height - y, radius * 2 + 1));
            const img = ctx.getImageData(x, y, w, h);
            const data = img && img.data ? img.data : null;
            if (!data || !data.length) return null;

            let sr = 0, sg = 0, sb = 0, n = 0;
            for (let i = 0; i < data.length; i += 4) {
                const a = data[i + 3];
                if (a < 40) continue;
                const r = data[i], g = data[i + 1], b = data[i + 2];
                const brightness = (r + g + b) / 3;
                if (brightness < 35) continue;
                sr += r;
                sg += g;
                sb += b;
                n++;
            }
            if (!n) return null;
            const avg = { r: sr / n, g: sg / n, b: sb / n, n };
            const max = Math.max(avg.r, avg.g, avg.b);
            const min = Math.min(avg.r, avg.g, avg.b);
            avg.sat = max - min;
            avg.brightness = (avg.r + avg.g + avg.b) / 3;

            if (avg.r >= avg.g * 1.18 && avg.r >= avg.b * 1.18 && avg.r >= 90) {
                avg.v = 'L';
            } else if (avg.brightness >= 120 && avg.sat <= 80) {
                avg.v = 'C';
            } else if (avg.brightness >= 145 && avg.r >= 110 && avg.g >= 110 && avg.b >= 110) {
                avg.v = 'C';
            } else if (avg.r > avg.b + 24 && avg.r > avg.g + 16) {
                avg.v = 'L';
            } else if (avg.brightness > 110) {
                avg.v = 'C';
            } else {
                avg.v = null;
            }
            return avg;
        } catch (_) {
            return null;
        }
    }

    function collectBeads() {
        const out = [];
        walkNodes(node => {
            if (!nodeActive(node)) return;
            const path = fullPath(node, 180);
            const pathL = String(path || '').toLowerCase();
            if (!pathL.includes('mainxocdia')) return;
            if (/chat|jackpot|minigame|broadcast|gift|playername|avatar|footerroomui/.test(pathL)) return;

            const comps = node._components || [];
            for (let i = 0; i < comps.length; i++) {
                const c = comps[i];
                const sf = c && (c.spriteFrame || c._spriteFrame);
                if (!sf) continue;
                const name = sf.name || sf._name || (sf._texture && sf._texture.name) || '';
                const v = beadVal(name, node.name || '');
                if (v === '?') continue;
                const rect = rectOf(node);
                if (!rect || rect.w < 4 || rect.h < 4 || rect.w > 80 || rect.h > 80) continue;
                if (rect.cx < -10 || rect.cx > (window.innerWidth + 10) || rect.cy < -10 || rect.cy > (window.innerHeight + 10)) continue;

                out.push({
                    v,
                    vName: v,
                    rect,
                    x: rect.cx,
                    y: rect.cy,
                    path,
                    pathL,
                    sprite: String(name || ''),
                    node: String(node.name || '')
                });
            }
        });
        return out;
    }

    function classifyItems(items) {
        const out = [];
        for (let i = 0; i < (items || []).length; i++) {
            const it = Object.assign({}, items[i]);
            const px = sampleBeadColor(it);
            if (px && px.v) it.v = px.v;
            it.color = px || null;
            out.push(it);
        }
        return out;
    }

    function decodeSeq(items) {
        const cols = clusterByX(items);
        const parts = [];
        for (let i = 0; i < cols.length; i++) {
            // Hệ y của scene này đang tăng theo chiều từ dưới lên trên.
            // Quy tắc người dùng yêu cầu:
            // - cột 1,3,5,7: trên -> dưới
            // - cột 2,4,6,8: dưới -> trên
            // Vì clusterByX đã sort theo y giảm dần, ta giữ nguyên cho cột lẻ
            // và đảo lại cho cột chẵn.
            const arr = cols[i].items.slice().sort((a, b) => (i % 2 === 0) ? (b.y - a.y) : (a.y - b.y));
            let s = '';
            for (let k = 0; k < arr.length; k++) s += String(arr[k].v);
            parts.push(s);
        }
        return {
            cols,
            seq: normalizeSeqCL(parts.join(''))
        };
    }

    function candidatePrefixes(items) {
        const map = new Map();
        for (let i = 0; i < items.length; i++) {
            const parts = String(items[i].path || '').split('/').filter(Boolean);
            for (let len = 3; len <= Math.min(parts.length - 1, 10); len++) {
                const prefix = parts.slice(0, len).join('/');
                if (!prefix || /jackpot|chat|minigame|broadcast|footerroomui/.test(prefix.toLowerCase())) continue;
                let row = map.get(prefix);
                if (!row) {
                    row = [];
                    map.set(prefix, row);
                }
                row.push(items[i]);
            }
        }
        return map;
    }

    function scoreCandidate(prefix, items) {
        const iw = Math.max(1, window.innerWidth || 1);
        const ih = Math.max(1, window.innerHeight || 1);
        const box = rectUnion(items);
        if (!box) return null;
        const classified = classifyItems(items);
        const red = classified.filter(x => x.v === 'L').length;
        const white = classified.filter(x => x.v === 'C').length;
        const unknown = classified.length - red - white;
        const decoded = decodeSeq(classified.filter(x => x.v === 'L' || x.v === 'C'));
        const colCount = decoded.cols.length;
        const count = classified.length;

        let score = 0;
        score += (count >= 10 && count <= 60) ? 400 : -Math.abs(count - 24) * 12;
        score += (colCount >= 8 && colCount <= 22) ? 300 : -Math.abs(colCount - 14) * 18;
        score += (red > 0 && white > 0) ? 240 : -400;
        score += unknown === 0 ? 160 : -unknown * 40;
        score += (box.cx <= iw * 0.30) ? 260 : -Math.abs(box.cx - iw * 0.18) * 0.5;
        score += (box.cy <= ih * 0.35) ? 260 : -Math.abs(box.cy - ih * 0.18) * 0.9;
        score += (box.w >= 150 && box.w <= 420) ? 220 : -Math.abs(box.w - 300) * 0.8;
        score += (box.h >= 70 && box.h <= 220) ? 220 : -Math.abs(box.h - 130) * 1.1;
        if (/thongke|soicau|history|result|road|board/.test(String(prefix || '').toLowerCase())) score += 180;

        return {
            prefix,
            score,
            count,
            red,
            white,
            unknown,
            colCount,
            box,
            seq: decoded.seq,
            items: classified,
            cols: decoded.cols
        };
    }

    function dedupeCandidates(rows) {
        const out = [];
        for (let i = 0; i < rows.length; i++) {
            const cur = rows[i];
            let merged = false;
            for (let j = 0; j < out.length; j++) {
                const prev = out[j];
                if (Math.abs(prev.box.cx - cur.box.cx) <= 18 &&
                    Math.abs(prev.box.cy - cur.box.cy) <= 18 &&
                    Math.abs(prev.box.w - cur.box.w) <= 26 &&
                    Math.abs(prev.box.h - cur.box.h) <= 26) {
                    if (cur.score > prev.score) out[j] = cur;
                    merged = true;
                    break;
                }
            }
            if (!merged) out.push(cur);
        }
        return out;
    }

    function scanCandidates() {
        const beads = collectBeads();
        const prefixMap = candidatePrefixes(beads);
        const rows = [];
        prefixMap.forEach((items, prefix) => {
            const uniq = Array.from(new Set(items));
            if (uniq.length < 8 || uniq.length > 80) return;
            const row = scoreCandidate(prefix, uniq);
            if (!row) return;
            rows.push(row);
        });
        rows.sort((a, b) => b.score - a.score);
        return dedupeCandidates(rows).sort((a, b) => b.score - a.score);
    }

    function ensureOverlay() {
        let el = document.getElementById('__b52_rb_probe_overlay');
        if (!el) {
            el = document.createElement('div');
            el.id = '__b52_rb_probe_overlay';
            el.style.position = 'fixed';
            el.style.pointerEvents = 'none';
            el.style.zIndex = '2147483647';
            el.style.border = '2px solid #00ff88';
            el.style.boxShadow = '0 0 0 1px rgba(0,0,0,.5), 0 0 12px rgba(0,255,136,.5)';
            el.style.background = 'rgba(0,255,136,.05)';
            document.documentElement.appendChild(el);
        }
        return el;
    }

    function drawOverlay(candidate) {
        const el = ensureOverlay();
        if (!candidate || !candidate.box) {
            el.style.display = 'none';
            return;
        }
        const b = candidate.box;
        el.style.display = 'block';
        el.style.left = Math.round(b.x) + 'px';
        el.style.top = Math.round((window.innerHeight - (b.y + b.h))) + 'px';
        el.style.width = Math.round(b.w) + 'px';
        el.style.height = Math.round(b.h) + 'px';
        el.title = candidate.prefix + ' | ' + candidate.seq;
    }

    function toTable(rows) {
        return rows.map((r, idx) => ({
            idx,
            score: Math.round(r.score),
            count: r.count,
            cols: r.colCount,
            seq: r.seq,
            red: r.red,
            white: r.white,
            unknown: r.unknown,
            rect: [Math.round(r.box.x), Math.round(r.box.y), Math.round(r.box.w), Math.round(r.box.h)].join(','),
            prefix: r.prefix
        }));
    }

    const state = {
        last: null,
        timer: null,
        rows: []
    };

    function scan() {
        const rows = scanCandidates();
        state.last = rows;
        if (rows.length) drawOverlay(rows[0]);
        console.log('[B52_RESULT_BOARD]', rows[0] || null);
        console.table(toTable(rows.slice(0, 12)));
        return rows;
    }

    function use(which) {
        const rows = state.last || scanCandidates();
        let hit = null;
        if (typeof which === 'number') {
            hit = rows[which] || null;
        } else if (typeof which === 'string' && which) {
            hit = rows.find(r => r.prefix === which) || null;
        } else {
            hit = rows[0] || null;
        }
        drawOverlay(hit);
        console.log('[B52_RESULT_BOARD_USE]', hit || null);
        return hit;
    }

    function beads(which) {
        const rows = state.last || scanCandidates();
        const hit = (typeof which === 'number') ? (rows[which] || null) : (rows[0] || null);
        if (!hit) return [];
        const out = hit.items.map((it, idx) => ({
            idx,
            v: it.v,
            vName: it.vName,
            sprite: it.sprite,
            node: it.node,
            x: Math.round(it.x),
            y: Math.round(it.y),
            rect: [Math.round(it.rect.x), Math.round(it.rect.y), Math.round(it.rect.w), Math.round(it.rect.h)].join(','),
            rgb: it.color ? [Math.round(it.color.r), Math.round(it.color.g), Math.round(it.color.b)].join(',') : '',
            brightness: it.color ? Math.round(it.color.brightness) : '',
            sat: it.color ? Math.round(it.color.sat) : '',
            path: it.path
        }));
        console.table(out);
        return out;
    }

    function stop() {
        if (state.timer) {
            clearInterval(state.timer);
            state.timer = null;
        }
        drawOverlay(null);
        return { ok: true, samples: state.rows.length };
    }

    function start(opts) {
        opts = opts || {};
        const intervalMs = Math.max(200, Number(opts.intervalMs) || 500);
        const durationMs = Math.max(0, Number(opts.durationMs) || 10000);
        stop();
        state.rows = [];
        const startedAt = Date.now();
        state.timer = setInterval(() => {
            const rows = scanCandidates();
            const best = rows[0] || null;
            if (best) drawOverlay(best);
            state.rows.push({
                t: Math.round((Date.now() - startedAt) / 100) / 10,
                seq: best ? best.seq : '',
                count: best ? best.count : 0,
                cols: best ? best.colCount : 0,
                prefix: best ? best.prefix : ''
            });
            if (durationMs > 0 && (Date.now() - startedAt) >= durationMs) {
                stop();
                console.log('[B52_RESULT_BOARD_TRACE_DONE]', { samples: state.rows.length });
                console.table(state.rows);
            }
        }, intervalMs);
        return { ok: true, intervalMs, durationMs };
    }

    function last() {
        return state.last || null;
    }

    window[NS] = {
        scan,
        use,
        beads,
        start,
        stop,
        last,
        state: () => ({
            running: !!state.timer,
            rows: state.rows.slice(),
            last: state.last || null
        })
    };

    console.log('[B52_RESULT_BOARD_READY] window.' + NS + '.scan()');
})();
