(() => {
    'use strict';

    const NS = '__b52BetTotalsProbe';

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

    function foldText(txt) {
        try {
            return String(txt || '')
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/\s+/g, ' ')
                .trim()
                .toUpperCase();
        } catch (_) {
            return String(txt || '').replace(/\s+/g, ' ').trim().toUpperCase();
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

    function parseMoney(txt) {
        txt = String(txt || '').trim().toUpperCase();
        if (!txt) return null;
        txt = txt.replace(/\$/g, '').replace(/\s+/g, '');
        const m = txt.match(/^([0-9]+(?:[.,][0-9]+)?)([KMB])?$/);
        if (!m) return null;
        let v = Number(m[1].replace(/,/g, '.'));
        if (!isFinite(v)) return null;
        const u = m[2] || '';
        if (u === 'K') v *= 1e3;
        else if (u === 'M') v *= 1e6;
        else if (u === 'B') v *= 1e9;
        return v;
    }

    function fmtMoney(v) {
        if (v == null || !isFinite(v)) return '';
        if (v >= 1e9) return (Math.round(v / 1e7) / 100) + 'B';
        if (v >= 1e6) return (Math.round(v / 1e4) / 100) + 'M';
        if (v >= 1e3) return (Math.round(v / 10) / 100) + 'K';
        return String(Math.round(v));
    }

    function allowedPath(pathL) {
        if (!pathL) return false;
        if (!pathL.includes('mainxocdia')) return false;
        if (
            pathL.includes('chat') ||
            pathL.includes('jackpot') ||
            pathL.includes('history') ||
            pathL.includes('soicau') ||
            pathL.includes('broadcast') ||
            pathL.includes('minigame') ||
            pathL.includes('playername') ||
            pathL.includes('avatar') ||
            pathL.includes('footerroomui') ||
            pathL.includes('nhomchung')
        ) {
            return false;
        }
        return true;
    }

    function collectTextNodes() {
        const out = [];
        walkNodes(node => {
            if (!nodeActive(node)) return;
            const path = fullPath(node, 180);
            const pathL = String(path || '').toLowerCase();
            if (!allowedPath(pathL)) return;

            let txt = '';
            try {
                const lbl = cc.Label ? getComp(node, cc.Label) : null;
                if (lbl && lbl.string != null) txt = String(lbl.string);
            } catch (_) {}
            try {
                if (!txt) {
                    const rt = cc.RichText ? getComp(node, cc.RichText) : null;
                    if (rt && rt.string != null) txt = String(rt.string);
                }
            } catch (_) {}

            txt = String(txt || '').replace(/\s+/g, ' ').trim();
            if (!txt) return;

            const rect = rectOf(node);
            if (!rect || rect.w <= 2 || rect.h <= 2) return;

            out.push({
                text: txt,
                fold: foldText(txt),
                money: parseMoney(txt),
                path,
                rect
            });
        });
        return out;
    }

    function pickBest(items, predicate, scoreFn) {
        let best = null;
        for (let i = 0; i < items.length; i++) {
            const it = items[i];
            if (!predicate(it)) continue;
            const score = scoreFn(it);
            if (!best || score > best.score) best = { score, item: it };
        }
        return best ? best.item : null;
    }

    function byRows(items, tol) {
        tol = tol || 44;
        const rows = [];
        const sorted = items.slice().sort((a, b) => a.rect.cy - b.rect.cy);
        for (let i = 0; i < sorted.length; i++) {
            const it = sorted[i];
            let row = rows.find(r => Math.abs(r.cy - it.rect.cy) <= tol);
            if (!row) {
                row = { cy: it.rect.cy, items: [] };
                rows.push(row);
            }
            row.items.push(it);
            row.cy = row.items.reduce((s, x) => s + x.rect.cy, 0) / row.items.length;
        }
        for (let i = 0; i < rows.length; i++) {
            rows[i].items.sort((a, b) => a.rect.cx - b.rect.cx);
        }
        return rows.sort((a, b) => a.cy - b.cy);
    }

    function extractTotals() {
        const texts = collectTextNodes();
        const iw = Math.max(1, window.innerWidth || 1);
        const ih = Math.max(1, window.innerHeight || 1);

        function usableMoney(t) {
            const pathL = String(t.path || '').toLowerCase();
            if (pathL.includes('chosecoin') || pathL.includes('choosecoin') || pathL.includes('entry_') || pathL.includes('btn1')) {
                return false;
            }
            if (t.money != null && t.money <= 10000) return false;
            return true;
        }

        const monies = texts.filter(t => t.money != null && usableMoney(t)).filter(t =>
            t.rect.cx >= iw * 0.16 &&
            t.rect.cx <= iw * 0.88 &&
            t.rect.cy >= ih * 0.30 &&
            t.rect.cy <= ih * 0.70
        );
        const allMoney = texts.filter(t => t.money != null && usableMoney(t)).filter(t =>
            t.rect.cx >= iw * 0.08 &&
            t.rect.cx <= iw * 0.92 &&
            t.rect.cy >= ih * 0.18 &&
            t.rect.cy <= ih * 0.78
        );

        function pickRow(rows, wantCount, targetY) {
            let best = null;
            let bestScore = -1e9;
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                const xs = row.items.map(x => x.rect.cx).sort((a, b) => a - b);
                const width = xs.length ? (xs[xs.length - 1] - xs[0]) : 0;
                const score =
                    (row.items.length >= wantCount ? 2000 : row.items.length * 300) +
                    Math.min(800, width) -
                    Math.abs(row.cy - targetY) * 8;
                if (score > bestScore) {
                    bestScore = score;
                    best = row;
                }
            }
            return best;
        }

        function uniqByX(items, tol) {
            const sorted = items.slice().sort((a, b) => a.rect.cx - b.rect.cx);
            const out = [];
            for (let i = 0; i < sorted.length; i++) {
                const cur = sorted[i];
                const prev = out[out.length - 1];
                if (!prev || Math.abs(prev.rect.cx - cur.rect.cx) > tol) {
                    out.push(cur);
                    continue;
                }
                if (cur.rect.cy < prev.rect.cy || (cur.rect.cy === prev.rect.cy && cur.rect.h >= prev.rect.h)) {
                    out[out.length - 1] = cur;
                }
            }
            return out;
        }

        function median(nums) {
            if (!nums || !nums.length) return 0;
            const arr = nums.slice().sort((a, b) => a - b);
            const mid = Math.floor(arr.length / 2);
            return arr.length % 2 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
        }

        function pickByTarget(items, targetX, targetY, tolX, tolY) {
            tolX = tolX || 180;
            tolY = tolY || 90;
            return pickBest(
                items,
                t => Math.abs(t.rect.cx - targetX) <= tolX && Math.abs(t.rect.cy - targetY) <= tolY,
                t => 5000 - Math.abs(t.rect.cx - targetX) * 8 - Math.abs(t.rect.cy - targetY) * 12
            );
        }

        const moneyRows = byRows(allMoney, 56).filter(r => r.items && r.items.length);
        let pickedUpperRow = null;
        let pickedLowerRow = null;

        for (let i = 0; i < moneyRows.length; i++) {
            const row = moneyRows[i];
            if (!pickedUpperRow && row.items.length === 2) pickedUpperRow = row;
            if (!pickedLowerRow && row.items.length === 4) pickedLowerRow = row;
        }
        if (!pickedUpperRow) {
            pickedUpperRow = pickRow(moneyRows, 2, ih * 0.50);
        }
        if (!pickedLowerRow) {
            pickedLowerRow = pickRow(moneyRows, 4, ih * 0.50);
        }

        let upper = pickedUpperRow ? uniqByX(pickedUpperRow.items.slice(), 42) : [];
        let lower = pickedLowerRow ? uniqByX(pickedLowerRow.items.slice(), 42) : [];

        if (upper.length > 2) upper = [upper[0], upper[upper.length - 1]];
        if (lower.length > 4) lower = lower.slice(0, 4);

        const upperBand = upper.slice();
        const lowerBand = lower.slice();
        const topLeft = upper[0] || null;
        const topRight = upper[1] || null;

        const out = {
            CHAN: topLeft ? { raw: topLeft.text, value: topLeft.money, path: topLeft.path, rect: topLeft.rect } : null,
            LE: topRight ? { raw: topRight.text, value: topRight.money, path: topRight.path, rect: topRight.rect } : null,
            TU_DO: lower[0] ? { raw: lower[0].text, value: lower[0].money, path: lower[0].path, rect: lower[0].rect } : null,
            TU_TRANG: lower[1] ? { raw: lower[1].text, value: lower[1].money, path: lower[1].path, rect: lower[1].rect } : null,
            BA_TRANG: lower[2] ? { raw: lower[2].text, value: lower[2].money, path: lower[2].path, rect: lower[2].rect } : null,
            BA_DO: lower[3] ? { raw: lower[3].text, value: lower[3].money, path: lower[3].path, rect: lower[3].rect } : null,
            debug: {
                allMoney: allMoney.map(t => ({ text: t.text, value: t.money, x: Math.round(t.rect.x), y: Math.round(t.rect.y), path: t.path })),
                moneyRows: moneyRows.map(r => ({
                    cy: Math.round(r.cy),
                    items: r.items.map(t => ({ text: t.text, value: t.money, x: Math.round(t.rect.x), y: Math.round(t.rect.y), path: t.path }))
                })),
                upperBand: upperBand.map(t => ({ text: t.text, value: t.money, x: Math.round(t.rect.x), y: Math.round(t.rect.y), path: t.path })),
                lowerBand: lowerBand.map(t => ({ text: t.text, value: t.money, x: Math.round(t.rect.x), y: Math.round(t.rect.y), path: t.path })),
                upperRow: upper.map(t => ({ text: t.text, value: t.money, x: Math.round(t.rect.x), y: Math.round(t.rect.y), path: t.path })),
                lowerRow: lower.map(t => ({ text: t.text, value: t.money, x: Math.round(t.rect.x), y: Math.round(t.rect.y), path: t.path }))
            },
            ts: Date.now()
        };

        return out;
    }

    function toTable(result) {
        return [
            ['CHAN', result.CHAN],
            ['LE', result.LE],
            ['TU_TRANG', result.TU_TRANG],
            ['BA_TRANG', result.BA_TRANG],
            ['BA_DO', result.BA_DO],
            ['TU_DO', result.TU_DO]
        ].map(([name, x]) => ({
            name,
            raw: x ? x.raw : '',
            value: x ? x.value : null,
            fmt: x ? fmtMoney(x.value) : '',
            rect: x ? [Math.round(x.rect.x), Math.round(x.rect.y), Math.round(x.rect.w), Math.round(x.rect.h)].join(',') : '',
            path: x ? x.path : ''
        }));
    }

    function scan() {
        const result = extractTotals();
        window.__b52_bet_totals_last = result;
        console.log('[B52_TOTALS]', result);
        console.table(toTable(result));
        return result;
    }

    const state = {
        timer: null,
        rows: [],
        startedAt: 0
    };

    function stop() {
        if (state.timer) {
            clearInterval(state.timer);
            state.timer = null;
        }
        return {
            ok: true,
            samples: state.rows.length
        };
    }

    function start(opts) {
        opts = opts || {};
        const intervalMs = Math.max(150, Number(opts.intervalMs) || 400);
        const durationMs = Math.max(0, Number(opts.durationMs) || 0);
        stop();
        state.rows = [];
        state.startedAt = Date.now();
        state.timer = setInterval(() => {
            const r = extractTotals();
            state.rows.push({
                t: Math.round((Date.now() - state.startedAt) / 100) / 10,
                CHAN: r.CHAN ? r.CHAN.value : null,
                LE: r.LE ? r.LE.value : null,
                TU_TRANG: r.TU_TRANG ? r.TU_TRANG.value : null,
                BA_TRANG: r.BA_TRANG ? r.BA_TRANG.value : null,
                BA_DO: r.BA_DO ? r.BA_DO.value : null,
                TU_DO: r.TU_DO ? r.TU_DO.value : null
            });
            if (durationMs > 0 && (Date.now() - state.startedAt) >= durationMs) {
                stop();
                console.log('[B52_TOTALS_TRACE_DONE]', { samples: state.rows.length });
                console.table(state.rows);
            }
        }, intervalMs);
        return { ok: true, intervalMs, durationMs };
    }

    function last() {
        return window.__b52_bet_totals_last || null;
    }

    window[NS] = {
        scan,
        start,
        stop,
        last,
        state: () => ({
            running: !!state.timer,
            samples: state.rows.length,
            startedAt: state.startedAt,
            rows: state.rows.slice()
        })
    };

    console.log('[B52_TOTALS_READY] window.' + NS + '.scan()');
})();
