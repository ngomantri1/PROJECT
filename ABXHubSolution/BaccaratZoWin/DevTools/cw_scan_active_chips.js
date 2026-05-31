(() => {
    'use strict';

    const DENOMS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 50000, 100000, 500000];
    const ALLOWED = Object.create(null);
    DENOMS.forEach(v => { ALLOWED[String(v)] = 1; ALLOWED[String(v * 1000)] = 1; });

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
            const cls = Array.from(cur.classList || []).filter(c => c && c.length < 42).slice(0, 3);
            cls.forEach(c => { part += '.' + esc(c); });
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
    const attrsOf = el => ['id', 'class', 'name', 'title', 'aria-label', 'data-name', 'data-title', 'data-type', 'data-chip', 'data-value', 'value', 'alt', 'src']
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
    const parseChip = raw => {
        const s = norm(raw);
        let m = s.match(/(\d+)\s*(K|M)\b/);
        if (m) {
            let v = Number(m[1]) * (m[2] === 'M' ? 1000 : 1);
            return ALLOWED[String(v)] ? v : null;
        }
        m = s.match(/(\d{1,3}(?:[.,\s]\d{3})+|\d{1,9})/);
        if (!m) return null;
        let v = parseInt(m[1].replace(/[^\d]/g, ''), 10);
        if (v >= 1000 && v % 1000 === 0) v = Math.floor(v / 1000);
        return ALLOWED[String(v)] ? v : null;
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
    const hostOf = el => {
        const selectors = [
            "[id^='Chips_']", "[id^='iChips_']", ".list_select_chips3d > div", ".list_select_chips3d > li", ".chips3d",
            "[class*='chip' i]", "[id*='chip' i]", "[class*='coin' i]", "[id*='coin' i]", "[data-value]", "[data-chip]",
            'button', "[role='button']"
        ];
        for (const s of selectors) {
            try {
                const h = el.closest(s);
                if (h) return h;
            } catch (_) {}
        }
        return el;
    };
    const rows = [];
    for (const ctx of contexts()) {
        let nodes = [];
        try {
            nodes = ctx.doc.querySelectorAll("button,[role='button'],li,div,span,img,canvas,[class*='chip' i],[id*='chip' i],[class*='coin' i],[id*='coin' i],[data-value],[data-chip],[aria-label]");
        } catch (_) {}
        const seen = new Set();
        for (const el of nodes) {
            if (!visible(el)) continue;
            const host = hostOf(el);
            if (!visible(host) || seen.has(host)) continue;
            const r = host.getBoundingClientRect();
            if (r.width < 24 || r.height < 20 || r.width > 240 || r.height > 170) continue;
            if (r.top < ctx.win.innerHeight * 0.46) continue;
            const text = collapse(host.innerText || host.textContent || '');
            const attrs = attrsOf(host);
            const val = parseChip(text + ' ' + attrs);
            if (!val) continue;
            const combo = norm(text + ' ' + attrs);
            if (/(BALANCE|SO DU|TAI KHOAN|ACCOUNT|PLAYER|BANKER|TIE|HOA|HISTORY|ROAD|COUNTDOWN)/.test(combo) &&
                !/(CHIP|COIN|PHINH|MENH|CUOC|BET|TOKEN)/.test(combo)) continue;
            const cs = ctx.win.getComputedStyle(host);
            seen.add(host);
            rows.push({
                val,
                source: ctx.source,
                x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height),
                enabled: Number(cs.opacity || '1') > 0.35 && cs.pointerEvents !== 'none' ? 1 : 0,
                selected: /\b(active|selected|select|current|on|focus)\b/i.test(String(host.className || '') + ' ' + attrs) ? 1 : 0,
                selector: selectorOf(host),
                tail: tailOf(host),
                text,
                attrs
            });
        }
    }
    rows.sort((a, b) => String(a.source).localeCompare(String(b.source)) || a.y - b.y || a.x - b.x || a.val - b.val);
    console.table(rows);
    window.__cw_devtool_active_chips = rows;
    return rows;
})();
