(function () {
    function collapse(s) {
        return String(s || '').replace(/\s+/g, ' ').trim();
    }

    function norm(s) {
        try {
            return collapse(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        } catch (_) {
            return collapse(s).toLowerCase();
        }
    }

    function visible(el) {
        try {
            if (!el || !el.ownerDocument) return false;
            var view = el.ownerDocument.defaultView || window;
            var cs = view.getComputedStyle(el);
            var r = el.getBoundingClientRect();
            return r.width > 2 &&
                r.height > 2 &&
                cs.display !== 'none' &&
                cs.visibility !== 'hidden' &&
                cs.opacity !== '0';
        } catch (_) {
            return false;
        }
    }

    function fullPath(el, limit) {
        try {
            limit = limit || 80;
            var out = [];
            var cur = el;
            var n = 0;
            while (cur && cur.nodeType === 1 && n < limit) {
                var s = String(cur.tagName || '').toLowerCase();
                if (cur.id) s += '#' + cur.id;
                if (cur.classList && cur.classList.length) {
                    var cls = Array.prototype.slice.call(cur.classList, 0, 3).join('.');
                    if (cls) s += '.' + cls;
                }
                out.push(s);
                cur = cur.parentElement;
                n++;
            }
            out.reverse();
            return out.join('/');
        } catch (_) {
            return '';
        }
    }

    function walkContexts(rootWin, source, offX, offY, out, seen) {
        try {
            if (!rootWin || seen.indexOf(rootWin) >= 0) return;
            seen.push(rootWin);
            var doc = rootWin.document;
            if (doc && doc.documentElement) {
                out.push({
                    source: source,
                    href: String(rootWin.location && rootWin.location.href || ''),
                    win: rootWin,
                    doc: doc,
                    offX: offX || 0,
                    offY: offY || 0
                });
            }
        } catch (_) {
            return;
        }
        try {
            for (var i = 0; i < rootWin.frames.length; i++) {
                var child = rootWin.frames[i];
                var fe = child.frameElement;
                var fr = fe && fe.getBoundingClientRect ? fe.getBoundingClientRect() : { left: 0, top: 0 };
                walkContexts(child, source + '/frame[' + i + ']', (offX || 0) + (fr.left || 0), (offY || 0) + (fr.top || 0), out, seen);
            }
        } catch (_) {}
    }

    function scoreContext(ctx) {
        var href = String(ctx.href || '').toLowerCase();
        var score = 0;
        if (href.indexOf('singlebactable.jsp') !== -1) score += 300;
        if (href.indexOf('webmain.jsp') !== -1) score += 40;
        try {
            var txt = collapse(ctx.doc.body ? ctx.doc.body.innerText : '').slice(0, 2000).toLowerCase();
            if (/tay con|nha cai|hoa|reload|no comm/.test(txt)) score += 120;
            if (/category|truyen thong|xoc dia|roulette/.test(txt)) score -= 120;
        } catch (_) {}
        return score;
    }

    function extractNumber(txt) {
        txt = collapse(txt);
        if (!txt) return null;
        var m = txt.match(/(^|\D)(\d{1,2})(?=\D|$)/);
        if (!m) return null;
        var n = parseInt(m[2], 10);
        if (!(n >= 0 && n <= 99)) return null;
        return n;
    }

    function collectCandidatesFromDoc(ctx) {
        var out = [];
        var doc = ctx.doc;
        var selectors = [
            '#countdownTime p',
            '#countdownTime',
            '#countdownHome2 .btn_change_table',
            '#countdownHome2',
            '[id*=countdown] p',
            '[id*=countdown]',
            '[class*=countdown] p',
            '[class*=countdown]',
            '#processBar.info_status p#processStatus',
            '#processStatus'
        ];
        var seen = Object.create(null);
        for (var i = 0; i < selectors.length; i++) {
            var nodes = [];
            try {
                nodes = doc.querySelectorAll(selectors[i]);
            } catch (_) {
                nodes = [];
            }
            for (var j = 0; j < nodes.length; j++) {
                var el = nodes[j];
                if (!visible(el)) continue;
                var txt = collapse(el.innerText || el.textContent || '');
                var val = extractNumber(txt);
                if (val == null) continue;
                var r = el.getBoundingClientRect();
                var tail = fullPath(el, 80);
                var key = selectors[i] + '|' + val + '|' + Math.round(r.left) + '|' + Math.round(r.top);
                if (seen[key]) continue;
                seen[key] = 1;
                var score = 0;
                var tailL = tail.toLowerCase();
                if (tailL.indexOf('countdowntime') !== -1) score += 500;
                if (tailL.indexOf('countdownhome2') !== -1) score += 350;
                if (tailL.indexOf('processstatus') !== -1) score += 60;
                if (ctx.href.toLowerCase().indexOf('singlebactable.jsp') !== -1) score += 200;
                if (r.left > ((ctx.win.innerWidth || 1600) * 0.72)) score += 80;
                if (r.top < ((ctx.win.innerHeight || 900) * 0.35)) score += 60;
                if (val >= 0 && val <= 30) score += 40;
                if (txt.indexOf('{0}s') !== -1) score -= 200;
                out.push({
                    source: ctx.source,
                    href: ctx.href,
                    selector: selectors[i],
                    text: txt,
                    value: val,
                    score: score,
                    x: Math.round((ctx.offX || 0) + r.left),
                    y: Math.round((ctx.offY || 0) + r.top),
                    w: Math.round(r.width),
                    h: Math.round(r.height),
                    tail: tail,
                    element: el
                });
            }
        }
        return out;
    }

    function collectAllCandidates() {
        var contexts = [];
        walkContexts(window, 'top', 0, 0, contexts, []);
        contexts.forEach(function (ctx) {
            ctx.score = scoreContext(ctx);
        });
        var candidates = [];
        for (var i = 0; i < contexts.length; i++) {
            var ctx = contexts[i];
            var items = collectCandidatesFromDoc(ctx);
            for (var j = 0; j < items.length; j++) {
                items[j].score += ctx.score || 0;
                candidates.push(items[j]);
            }
        }
        candidates.sort(function (a, b) {
            return (b.score || 0) - (a.score || 0) ||
                a.y - b.y ||
                a.x - b.x;
        });
        return {
            contexts: contexts.map(function (ctx) {
                return {
                    source: ctx.source,
                    href: ctx.href,
                    score: ctx.score
                };
            }),
            candidates: candidates
        };
    }

    function ensureOverlay() {
        var id = '__abx_countdown_probe_box';
        var box = document.getElementById(id);
        if (box) return box;
        box = document.createElement('div');
        box.id = id;
        box.style.cssText = [
            'position:fixed',
            'z-index:2147483647',
            'border:2px solid #00ff66',
            'background:rgba(0,255,102,0.08)',
            'pointer-events:none',
            'display:none',
            'box-sizing:border-box'
        ].join(';');
        document.documentElement.appendChild(box);
        return box;
    }

    function showOverlay(c) {
        var box = ensureOverlay();
        if (!c) {
            box.style.display = 'none';
            return;
        }
        box.style.display = 'block';
        box.style.left = c.x + 'px';
        box.style.top = c.y + 'px';
        box.style.width = c.w + 'px';
        box.style.height = c.h + 'px';
    }

    function stopProbe() {
        try {
            if (window.__abx_countdown_probe_timer) {
                clearInterval(window.__abx_countdown_probe_timer);
                window.__abx_countdown_probe_timer = null;
            }
        } catch (_) {}
        try {
            var list = window.__abx_countdown_probe_unsub || [];
            for (var i = 0; i < list.length; i++) {
                try { list[i](); } catch (_) {}
            }
        } catch (_) {}
        window.__abx_countdown_probe_unsub = [];
        showOverlay(null);
        console.log('[ABX COUNTDOWN] stopped');
    }

    function probeCountdown() {
        var scan = collectAllCandidates();
        console.log('[ABX COUNTDOWN] contexts=');
        console.table(scan.contexts);
        console.log('[ABX COUNTDOWN] candidates=');
        console.table(scan.candidates.map(function (x, idx) {
            return {
                idx: idx + 1,
                source: x.source,
                value: x.value,
                text: x.text,
                score: x.score,
                x: x.x,
                y: x.y,
                tail: x.tail
            };
        }));

        var best = scan.candidates[0] || null;
        window.__abx_countdown_probe_result = {
            best: best,
            contexts: scan.contexts,
            candidates: scan.candidates
        };

        if (best) {
            console.log('[ABX COUNTDOWN] picked=', {
                source: best.source,
                href: best.href,
                value: best.value,
                text: best.text,
                tail: best.tail
            });
            showOverlay(best);
        } else {
            console.warn('[ABX COUNTDOWN] no countdown candidate found');
            showOverlay(null);
        }
        return window.__abx_countdown_probe_result;
    }

    function startCountdownWatch(intervalMs) {
        stopProbe();
        intervalMs = Number(intervalMs) || 250;
        var lastSig = '';

        function runOnce() {
            var r = probeCountdown();
            var best = r && r.best ? r.best : null;
            var sig = best ? [best.source, best.value, best.text, best.tail].join('|') : 'none';
            if (sig !== lastSig) {
                lastSig = sig;
                console.log('[ABX COUNTDOWN] changed=', best ? {
                    value: best.value,
                    text: best.text,
                    source: best.source,
                    tail: best.tail
                } : null);
            }
            return best;
        }

        runOnce();
        window.__abx_countdown_probe_timer = setInterval(runOnce, intervalMs);
        console.log('[ABX COUNTDOWN] watching every ' + intervalMs + 'ms');
        return true;
    }

    window.__abx_probe_countdown = probeCountdown;
    window.__abx_watch_countdown = startCountdownWatch;
    window.__abx_stop_countdown = stopProbe;

    startCountdownWatch(250);
})();
