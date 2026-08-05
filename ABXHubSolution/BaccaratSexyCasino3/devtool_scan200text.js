(function () {
    'use strict';

    function collapse(s) {
        return String(s || '').replace(/\s+/g, ' ').trim();
    }

    function norm(s) {
        try {
            return String(s || '')
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toLowerCase();
        } catch (_) {
            return String(s || '').toLowerCase();
        }
    }

    function visible(doc, el) {
        try {
            if (!el) return false;
            var view = doc.defaultView || window;
            var r = el.getBoundingClientRect();
            if (!r || r.width < 4 || r.height < 4) return false;
            var cs = view.getComputedStyle(el);
            return cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0';
        } catch (_) {
            return false;
        }
    }

    function tailOf(el) {
        try {
            var parts = [];
            var cur = el;
            var depth = 0;
            while (cur && cur.nodeType === 1 && depth < 7) {
                var s = String(cur.tagName || '').toLowerCase();
                if (cur.id) s += '#' + String(cur.id).trim();
                if (cur.classList && cur.classList.length) {
                    var cls = Array.prototype.slice.call(cur.classList, 0, 2).join('.');
                    if (cls) s += '.' + cls;
                }
                parts.push(s);
                cur = cur.parentElement;
                depth++;
            }
            parts.reverse();
            return parts.join('/');
        } catch (_) {
            return 'dom';
        }
    }

    function shouldSkip(doc, el, txt) {
        try {
            if (!el) return true;
            if (el.closest && el.closest('#__cw_root_allin')) return true;

            var cur = el;
            var depth = 0;
            while (cur && cur.nodeType === 1 && depth < 8) {
                var id = String(cur.id || '').toLowerCase();
                var cls = String(cur.className || '').toLowerCase();
                if (/(loading|popup_loading|loadingframe|loading_con|loading_text|spinner|preload)/.test(id + ' ' + cls)) {
                    return true;
                }
                cur = cur.parentElement;
                depth++;
            }

            var s = collapse(txt);
            var n = norm(s);
            if (!s) return true;
            if (/^(loading|loading\.\.\.)$/i.test(s)) return true;
            if (/(canvas watch|scan200money|scan200bet|scan200text|copylog|clearlog)/.test(n)) return true;
            return false;
        } catch (_) {
            return false;
        }
    }

    function hasEquivalentChildText(doc, el, txt) {
        try {
            if (!el || !el.children || !el.children.length) return false;
            var me = collapse(txt);
            if (!me) return false;
            for (var i = 0; i < el.children.length; i++) {
                var ch = el.children[i];
                if (!visible(doc, ch)) continue;
                var childTxt = collapse(ch.innerText || ch.textContent || '');
                if (childTxt && childTxt === me) return true;
            }
            return false;
        } catch (_) {
            return false;
        }
    }

    function isTextCandidate(txt) {
        if (!txt) return false;
        var s = collapse(txt);
        if (!s) return false;
        if (s.length > 120) return false;
        if (/^[\d\s.,:;+\-/%$€£¥₫()]+$/.test(s) && !/[A-Za-zÀ-ỹ]/i.test(s)) return false;
        if (/^[^\wA-Za-zÀ-ỹ]*$/.test(s)) return false;
        if (/[A-Za-zÀ-ỹ]/i.test(s) || /\d/.test(s)) return true;
        if (/[@._-]/.test(s)) return true;
        if (/[^\w\s]/.test(s) && s.length >= 3) return true;
        return s.length >= 2;
    }

    function scanDoc(doc, source, limit) {
        var view = doc.defaultView || window;
        var innerWidth = view.innerWidth || 1920;
        var innerHeight = view.innerHeight || 1080;
        var all = doc.querySelectorAll('button,a,span,div,p,strong,b,label,li,td,h1,h2,h3,h4,h5');
        var out = [];
        var seen = Object.create(null);

        for (var i = 0; i < all.length && i < 5000; i++) {
            var el = all[i];
            if (!visible(doc, el)) continue;

            var txt = collapse(el.innerText || el.textContent || '');
            if (shouldSkip(doc, el, txt)) continue;
            if (!isTextCandidate(txt)) continue;
            if (hasEquivalentChildText(doc, el, txt)) continue;

            var r = el.getBoundingClientRect();
            if (r.width > innerWidth * 0.75 || r.height > innerHeight * 0.22) continue;

            var key = txt + '|' + Math.round(r.left) + '|' + Math.round(r.top) + '|' + Math.round(r.width) + '|' + Math.round(r.height);
            if (seen[key]) continue;
            seen[key] = 1;

            out.push({
                idx: out.length + 1,
                text: txt,
                x: Math.round(r.left),
                y: Math.round(r.top),
                w: Math.round(r.width),
                h: Math.round(r.height),
                tail: source + ' :: ' + tailOf(el)
            });
        }

        out.sort(function (a, b) {
            return a.y - b.y || a.x - b.x || String(a.text || '').localeCompare(String(b.text || ''));
        });

        return out.slice(0, limit);
    }

    function scoreRows(rows) {
        var score = Math.min(rows.length, 80);
        var joined = rows.map(function (r) { return norm(r.text); }).join(' | ');

        if (/(banker|player|nha cai|tay con|hoa|confirm|reload|no comm|chat)/.test(joined)) score += 120;
        if (/(b ask|p ask)/.test(joined)) score += 80;
        if (/(category|truyen thong|xoc dia|roulette|hide|vao choi|live casino|sports|slot game)/.test(joined)) score -= 90;
        if ((joined.match(/baccarat c\d+/g) || []).length >= 4) score -= 40;

        for (var i = 0; i < rows.length; i++) {
            var t = norm(rows[i].text);
            if (/(banker|player|nha cai|tay con|hoa)/.test(t)) score += 12;
            if (/(confirm|reload|no comm)/.test(t)) score += 8;
            if (/(tai khoan|so du|balance|plyr)/.test(t)) score += 4;
        }
        return score;
    }

    function walkWindows(rootWin, source, limit, out, seen) {
        try {
            if (!rootWin || seen.indexOf(rootWin) >= 0) return;
            seen.push(rootWin);
            var doc = rootWin.document;
            if (doc && doc.documentElement) {
                out.push({
                    source: source,
                    href: String(rootWin.location && rootWin.location.href || ''),
                    rows: scanDoc(doc, source, limit)
                });
            }
        } catch (_) {
            return;
        }

        try {
            for (var i = 0; i < rootWin.frames.length; i++) {
                walkWindows(rootWin.frames[i], source + '/frame[' + i + ']', limit, out, seen);
            }
        } catch (_) {}
    }

    function run(limit) {
        limit = Number(limit) || 200;
        if (limit < 1) limit = 1;
        if (limit > 1000) limit = 1000;

        var contexts = [];
        walkWindows(window, 'top', limit, contexts, []);
        for (var i = 0; i < contexts.length; i++) {
            contexts[i].score = scoreRows(contexts[i].rows);
        }
        contexts.sort(function (a, b) {
            return b.score - a.score || b.rows.length - a.rows.length;
        });

        var best = contexts[0] || { source: 'top', href: String(location.href || ''), rows: [], score: 0 };

        console.log('[ABX scan200text] contexts=');
        console.table(contexts.map(function (c) {
            return {
                source: c.source,
                score: c.score,
                rows: c.rows.length,
                href: c.href
            };
        }));

        console.log('[ABX scan200text] picked source=' + best.source + ' score=' + best.score + ' href=' + best.href);
        console.log('(TextMap index x' + best.rows.length + ')\tidx\ttext\tx\ty\tw\th\ttail');
        for (var j = 0; j < best.rows.length; j++) {
            var r2 = best.rows[j];
            console.log(
                j + '\t' +
                r2.idx + '\t' +
                "'" + r2.text + "'\t" +
                r2.x + '\t' +
                r2.y + '\t' +
                r2.w + '\t' +
                r2.h + '\t' +
                "'" + r2.tail + "'"
            );
        }

        try {
            console.table(best.rows);
        } catch (_) {
            console.log(best.rows);
        }

        window.__abx_scan200text_results = best.rows;
        window.__abx_scan200text_contexts = contexts;
        return best.rows;
    }

    window.__abx_scan200text = run;
    return run(200);
})();
