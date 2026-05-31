(() => {
    'use strict';

    const collapse = s => String(s || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
    const norm = s => collapse(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
    const visible = el => {
        if (!el || !el.getBoundingClientRect) return false;
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) return false;
        const cs = el.ownerDocument.defaultView.getComputedStyle(el);
        return cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity || '1') > 0.05;
    };
    const esc = s => (window.CSS && CSS.escape) ? CSS.escape(String(s || '')) : String(s || '').replace(/[^a-zA-Z0-9_-]/g, ch => '\\' + ch);
    const selectorOf = el => {
        const parts = [];
        let cur = el;
        for (let depth = 0; cur && cur.nodeType === 1 && depth < 8; depth++, cur = cur.parentElement) {
            let part = cur.tagName.toLowerCase();
            if (cur.id) {
                parts.unshift(part + '#' + esc(cur.id));
                break;
            }
            Array.from(cur.classList || []).filter(c => c && c.length < 42).slice(0, 3).forEach(c => { part += '.' + esc(c); });
            const p = cur.parentElement;
            if (p) {
                const same = Array.from(p.children).filter(x => x.tagName === cur.tagName);
                if (same.length > 1) part += `:nth-of-type(${same.indexOf(cur) + 1})`;
            }
            parts.unshift(part);
            try {
                if (el.ownerDocument.querySelectorAll(parts.join(' > ')).length === 1) break;
            } catch (_) {}
        }
        return parts.join(' > ');
    };
    const attrsOf = el => ['id', 'class', 'name', 'title', 'aria-label', 'data-name', 'data-title', 'data-type', 'data-side', 'data-bet', 'value', 'alt']
        .map(a => {
            try { return a === 'class' ? String(el.className || '') : String(el.getAttribute(a) || ''); } catch (_) { return ''; }
        })
        .filter(Boolean)
        .join(' ');
    const tailOf = el => {
        const parts = [];
        let cur = el;
        for (let i = 0; cur && cur.nodeType === 1 && i < 6; i++, cur = cur.parentElement) {
            let s = cur.tagName.toLowerCase();
            if (cur.id) s += '#' + cur.id;
            const cls = Array.from(cur.classList || []).slice(0, 2);
            if (cls.length) s += '.' + cls.join('.');
            parts.unshift(s);
        }
        return parts.join('/');
    };
    const sideOf = raw => {
        const s = norm(raw);
        if (/PLAYER|PLYR|PLAYR|TAY CON|PUNTO|\u95f2/.test(s)) return 'PLAYER';
        if (/BANKER|BNKR|BANK|NHA CAI|BANCO|\u5e84/.test(s)) return 'BANKER';
        if (/TIE|DRAW|HOA|\u548c/.test(s)) return 'TIE';
        return '';
    };
    const sideCount = raw => {
        const s = norm(raw);
        let n = 0;
        if (/PLAYER|PLYR|PLAYR|TAY CON|PUNTO|\u95f2/.test(s)) n++;
        if (/BANKER|BNKR|BANK|NHA CAI|BANCO|\u5e84/.test(s)) n++;
        if (/TIE|DRAW|HOA|\u548c/.test(s)) n++;
        return n;
    };
    const contexts = (root = window, source = 'top', offX = 0, offY = 0, out = [], seen = new Set()) => {
        try {
            if (!root || seen.has(root)) return out;
            seen.add(root);
            if (root.document && root.document.documentElement) out.push({ win: root, doc: root.document, source, offX, offY });
            for (let i = 0; i < root.frames.length; i++) {
                const child = root.frames[i];
                const fr = child.frameElement ? child.frameElement.getBoundingClientRect() : { left: 0, top: 0 };
                contexts(child, `${source}/frame[${i}]`, offX + (fr.left || 0), offY + (fr.top || 0), out, seen);
            }
        } catch (_) {}
        return out;
    };
    const scoreHost = (host, label, side, win) => {
        const r = host.getBoundingClientRect();
        const combo = norm((host.innerText || host.textContent || '') + ' ' + attrsOf(host));
        let score = 0;
        if (r.top >= win.innerHeight * 0.48) score += 180;
        if (r.top >= win.innerHeight * 0.62) score += 160;
        if (r.width >= 70 && r.height >= 34) score += 140;
        if (r.width >= 120 && r.height >= 48) score += 70;
        if (r.width > win.innerWidth * 0.72 || r.height > win.innerHeight * 0.36) score -= 320;
        if (/BET|WAGER|STAKE|BOX|AREA|ZONE|CELL|ITEM|PLAYER|BANKER|TIE|BACCARAT|CUOC/.test(combo)) score += 260;
        const cnt = sideCount(combo);
        if (cnt === 1) score += 180;
        if (cnt > 1) score -= 520 + cnt * 80;
        if (/\b1\s*:\s*8\b/.test(combo) && side === 'TIE') score += 120;
        if (/\b1\s*:\s*1\b/.test(combo) && (side === 'PLAYER' || side === 'BANKER')) score += 90;
        if (sideOf(host.innerText || host.textContent || '') === side) score += 160;
        const cs = win.getComputedStyle(host);
        if (Number(cs.opacity || '1') <= 0.25 || cs.pointerEvents === 'none') score -= 700;
        return score;
    };
    const hostOf = (el, side, win) => {
        const selectors = [
            "li[id^='betBox']", "[id*='betBox']", "[class*='betBox' i]", "[class*='bet' i]", "[id*='bet' i]",
            "[class*='player' i]", "[id*='player' i]", "[class*='banker' i]", "[id*='banker' i]", "[class*='tie' i]", "[id*='tie' i]",
            "[data-side]", "[data-bet]", 'button', "[role='button']", ".zone_bet_bottom > li", ".zone_bet_bottom li", ".zone_bet_bottom > div", ".zone_bet_bottom div"
        ];
        let selectorBest = null;
        let selectorBestScore = -1e9;
        for (const s of selectors) {
            try {
                const h = el.closest(s);
                if (!h || !visible(h)) continue;
                const r = h.getBoundingClientRect();
                if (r.width < 44 || r.height < 24 || r.top < win.innerHeight * 0.42) continue;
                const sc = scoreHost(h, el, side, win);
                if (sc > selectorBestScore) {
                    selectorBestScore = sc;
                    selectorBest = h;
                }
            } catch (_) {}
        }
        if (selectorBest && selectorBestScore > -100) return selectorBest;
        let best = null;
        let bestScore = -1e9;
        for (let cur = el, depth = 0; cur && cur.nodeType === 1 && depth < 8; depth++, cur = cur.parentElement) {
            if (!visible(cur)) continue;
            const r = cur.getBoundingClientRect();
            if (r.width < 44 || r.height < 24 || r.top < win.innerHeight * 0.42) continue;
            const sc = scoreHost(cur, el, side, win);
            if (sc > bestScore) {
                bestScore = sc;
                best = cur;
            }
        }
        return bestScore > -100 ? best : null;
    };
    const byKey = new Map();
    for (const ctx of contexts()) {
        let nodes = [];
        try { nodes = ctx.doc.querySelectorAll('body *'); } catch (_) {}
        let scanned = 0;
        for (const el of nodes) {
            if (++scanned > 8000 || !visible(el)) continue;
            const side = sideOf((el.innerText || el.textContent || '') + ' ' + attrsOf(el));
            if (!side) continue;
            const host = hostOf(el, side, ctx.win);
            if (!host || !visible(host)) continue;
            const r = host.getBoundingClientRect();
            if (r.width < 50 || r.height < 30 || r.top < ctx.win.innerHeight * 0.42) continue;
            const text = collapse(host.innerText || host.textContent || '');
            const attrs = attrsOf(host);
            const comboCount = sideCount(text + ' ' + attrs);
            const fixedSide = comboCount > 1 ? side : (sideOf(text + ' ' + attrs) || side);
            const score = scoreHost(host, el, fixedSide, ctx.win);
            if (comboCount > 1 && score < 120) continue;
            const key = `${fixedSide}|${ctx.source}|${Math.round(r.left / 8)}|${Math.round(r.top / 8)}`;
            const row = {
                side: fixedSide,
                source: ctx.source,
                x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height),
                enabled: Number(ctx.win.getComputedStyle(host).opacity || '1') > 0.2 ? 1 : 0,
                score: Math.round(score),
                selector: selectorOf(host),
                tail: tailOf(host),
                text,
                attrs
            };
            if (!byKey.has(key) || row.score > byKey.get(key).score) byKey.set(key, row);
        }
    }
    const rows = Array.from(byKey.values()).sort((a, b) => b.score - a.score || String(a.side).localeCompare(String(b.side)) || a.y - b.y || a.x - b.x);
    console.table(rows);
    window.__cw_devtool_bet_targets = rows;
    return rows;
})();
