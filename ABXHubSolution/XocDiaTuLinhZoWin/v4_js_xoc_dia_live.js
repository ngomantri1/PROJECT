(() => {
    'use strict';
    /* =========================================================
    CanvasWatch + MoneyMap + BetMap + TextMap + Scan200Text
    + TK Sequence (restore): LEFT→RIGHT columns, zig-zag T↓/B↑
    (Compat build: no spread operator, no optional chaining)
    + FIX: totals CHẴN/LẺ by (x,tail) — CHẴN x=591, LẺ x=973,
    tail = 'XDLive/Canvas/Bg/footer/listLabel/totalBet'
    + STANDARDIZED EXPORTS: moneyTailList(), pickByXTail()
    ========================================================= */
    //root.style.display='none';  //bo comment là ẩn canvas watch, còn comment lại là hiển thị bảng canvas watch

    var NS = '__cw_allin_one_v9_textmap_compat_TKFIX_xTail_STD_v2';
    try {
        if (window[NS] && window[NS].teardown) {
            window[NS].teardown();
        }
    } catch (e) {}

    // === CW host/DOM command bridge (clear_autostart) =====================
    // CW host/DOM command bridge (clear_autostart)
    (function () {
        try {
            if (window.__cw_cmd_hooked)
                return;
            window.__cw_cmd_hooked = 1;
            if (typeof window.__cw_autostart === 'undefined')
                window.__cw_autostart = 0;
            if (typeof window.__cw_autostart_href === 'undefined')
                window.__cw_autostart_href = '';

            function _cwHandleCmd(evOrObj) {
                try {
                    var d = evOrObj && (evOrObj.data || evOrObj);
                    if (typeof d === 'string') {
                        try {
                            d = JSON.parse(d);
                        } catch (_) {
                            d = {};
                        }
                    }
                    if (d && d.__cw_cmd === 'clear_autostart') {
                        window.__cw_autostart = 0;
                        window.__cw_autostart_href = '';
                    }
                } catch (_) {}
            }
            try {
                window.addEventListener('message', _cwHandleCmd, true);
            } catch (_) {}
            try {
                if (window.chrome && window.chrome.webview) {
                    window.chrome.webview.addEventListener('message', function (e) {
                        _cwHandleCmd(e);
                    });
                }
            } catch (_) {}
        } catch (_) {}
    })();

    if (!(window.cc && cc.director && cc.director.getScene)) {
        return;
    }

    /* ---------------- utils ---------------- */
    var V2 = (cc.v2 || cc.Vec2);
    var sleep = function (ms) {
        return new Promise(function (r) {
            setTimeout(r, ms);
        });
    };
    var clamp01 = function (x) {
        x = Number(x) || 0;
        if (x < 0)
            x = 0;
        if (x > 1)
            x = 1;
        return x;
    };
    var jitter = function (a, b) {
        return a + (Math.random() * (b - a));
    };
    var esc = function (s) {
        s = String(s);
        return s.replace(/[&<>]/g, function (m) {
            return ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;'
            }
                [m]);
        });
    };
    var isMoneyText = function (t) {
        t = (t || '').trim();
        return /^[0-9][0-9.,]*(?:[KMB])?$/i.test(t);
    };
    function moneyOf(raw) {
        if (raw == null)
            return null;
        var s = String(raw).trim().toUpperCase(),
        mul = 1;
        if (/[KMB]$/.test(s)) {
            if (/K$/.test(s))
                mul = 1e3;
            else if (/M$/.test(s))
                mul = 1e6;
            else
                mul = 1e9;
            s = s.slice(0, -1).replace(/,/g, '').replace(/[^\d.]/g, '');
            var v = parseFloat(s);
            return isFinite(v) ? Math.round(v * mul) : null;
        }
        var d = s.replace(/\D/g, '');
        if (!d)
            return null;
        return parseInt(d, 10);
    }
    var fmt = function (v) {
        if (v == null)
            return '--';
        var a = Math.abs(v);
        if (a >= 1e9)
            return (v / 1e9).toFixed(2) + 'B';
        if (a >= 1e6)
            return (v / 1e6).toFixed(2) + 'M';
        if (a >= 1e3)
            return (v / 1e3).toFixed(2) + 'K';
        return String(v);
    };
    var cssRect = function (r) {
        return {
            left: r.x + 'px',
            top: r.y + 'px',
            width: r.w + 'px',
            height: r.h + 'px'
        };
    };
    var area = function (r) {
        return (r.w || 0) * (r.h || 0);
    };
    function dist2(x1, y1, x2, y2) {
        var dx = x1 - x2,
        dy = y1 - y2;
        return dx * dx + dy * dy;
    }

    function getComp(n, T) {
        try {
            return n && n.getComponent ? n.getComponent(T) : null;
        } catch (e) {
            return null;
        }
    }
    function getComps(n, T) {
        try {
            return n && n.getComponents ? n.getComponents(T) : null;
        } catch (e) {
            return null;
        }
    }

    /* ---------------- scene helpers ---------------- */
    function wRect(node) {
        try {
            var p = node.convertToWorldSpaceAR(new V2(0, 0));
            var cs = node.getContentSize ? node.getContentSize() : (node._contentSize || {
                width: 0,
                height: 0
            });
            return {
                x: p.x || 0,
                y: p.y || 0,
                w: cs.width || 0,
                h: cs.height || 0
            };
        } catch (e) {
            return {
                x: 0,
                y: 0,
                w: 0,
                h: 0
            };
        }
    }
    function tailOf(n, limit) {
        limit = limit || 12;
        var a = [];
        try {
            var t = n,
            c = 0;
            while (t && c < 64) {
                if (t.name)
                    a.push(t.name);
                t = t.parent || t._parent || null;
                c++;
            }
        } catch (e) {}
        a.reverse();
        return a.slice(-limit).join('/');
    }
    function walkNodes(cb) {
        var scene = cc.director.getScene();
        if (!scene)
            return;
        var st = [scene],
        seen = [];
        function seenHas(x) {
            return seen.indexOf(x) !== -1;
        }
        function seenAdd(x) {
            if (seen.indexOf(x) === -1)
                seen.push(x);
        }
        while (st.length) {
            var n = st.pop();
            if (!n || seenHas(n))
                continue;
            seenAdd(n);
            try {
                cb(n);
            } catch (e) {}
            var kids = (n.children || n._children) || [];
            for (var i = 0; i < kids.length; i++) {
                var k = kids[i];
                if (k && !seenHas(k))
                    st.push(k);
            }
        }
    }
    function collectLabels() {
        var out = [];
        walkNodes(function (n) {
            var comps = (n._components || []);
            for (var i = 0; i < comps.length; i++) {
                var c = comps[i];
                if (c && typeof c.string !== 'undefined') {
                    var text = (typeof c.string !== 'undefined' && c.string != null ? c.string : '');
                    text = String(text);
                    var r = wRect(n);
                    var tail = tailOf(n, 12);
                    out.push({
                        text: text,
                        x: r.x,
                        y: r.y,
                        w: r.w,
                        h: r.h,
                        tail: tail,
                        tl: tail.toLowerCase(),
                        n: {
                            x: r.x / innerWidth,
                            y: r.y / innerHeight,
                            w: r.w / innerWidth,
                            h: r.h / innerHeight
                        },
                        val: moneyOf(text)
                    });
                }
            }
        });
        return out;
    }
    function collectButtons() {
        var out = [];
        walkNodes(function (n) {
            var btns = getComps(n, cc.Button);
            if (btns && btns.length) {
                var r = wRect(n);
                out.push({
                    x: r.x,
                    y: r.y,
                    w: r.w,
                    h: r.h,
                    tail: tailOf(n, 12),
                    tl: tailOf(n, 12).toLowerCase()
                });
            }
        });
        return out;
    }
    function collectProgress() {
        var bars = [];
        walkNodes(function (n) {
            var comps = getComps(n, cc.ProgressBar);
            if (comps && comps.length) {
                var r = wRect(n);
                for (var i = 0; i < comps.length; i++) {
                    bars.push({
                        comp: comps[i],
                        rect: r
                    });
                }
            }
        });
        if (!bars.length)
            return null;
        var H = innerHeight,
        cs = bars.filter(function (b) {
            var r = b.rect;
            return r.w > 300 && r.h >= 6 && r.h <= 60 && r.y < H * 0.75;
        });
        var bar = (cs[0] || bars[0]).comp;
        var pr = (bar && typeof bar.progress !== 'undefined') ? bar.progress : 0;
        return clamp01(Number(pr));
    }

    /* ---------------- MoneyMap ---------------- */
    function buildMoneyRects() {
        var ls = collectLabels(),
        out = [];
        for (var i = 0; i < ls.length; i++) {
            var L = ls[i];
            if (!isMoneyText(L.text))
                continue;
            var x = Math.round(L.x),
            y = Math.round(L.y),
            w = Math.round(L.w),
            h = Math.round(L.h);
            out.push({
                txt: L.text,
                val: moneyOf(L.text),
                x: x,
                y: y,
                w: w,
                h: h,
                n: {
                    x: x / innerWidth,
                    y: y / innerHeight,
                    w: w / innerWidth,
                    h: h / innerHeight
                },
                tail: L.tail,
                tl: L.tl
            });
        }
        return out;
    }

    /* ---------------- NEW: TextMap ---------------- */
    function isTextCandidate(txt) {
        if (!txt)
            return false;
        var s = String(txt).trim();
        if (!s)
            return false;
        if (isMoneyText(s))
            return false;
        if (/^\d{1,2}$/.test(s))
            return false;
        if (/[A-Za-zÀ-ỹ]/i.test(s))
            return true;
        if (/[@._-]/.test(s))
            return true;
        if (/[^\w\s]/.test(s) && s.length >= 3)
            return true;
        return s.length >= 4;
    }
    function buildTextRects() {
        var ls = collectLabels(),
        out = [];
        for (var i = 0; i < ls.length; i++) {
            var L = ls[i];
            var s = (L.text || '').trim();
            if (!isTextCandidate(s))
                continue;
            var x = Math.round(L.x),
            y = Math.round(L.y),
            w = Math.round(L.w),
            h = Math.round(L.h);
            out.push({
                text: s,
                x: x,
                y: y,
                w: w,
                h: h,
                n: {
                    x: x / innerWidth,
                    y: y / innerHeight,
                    w: w / innerWidth,
                    h: h / innerHeight
                },
                tail: L.tail,
                tl: L.tl
            });
        }
        return out;
    }

    /* ------------------- TK sequence (RESTORED) ------------------- */
    function tkCellsPrefer(prefer) {
        prefer = prefer || 'thongke2';
        var labs = collectLabels();
        function pick(L, kind) {
            var t = (L.tail || '').toLowerCase();
            var ok2 = (t.indexOf('thong ke/thongke2') !== -1 || t.indexOf('thongke2') !== -1) && /label\/num/.test(t);
            var ok1 = (t.indexOf('thong ke/thongke1') !== -1 || t.indexOf('thongke1') !== -1) && /label\/num/.test(t);
            return kind === 'thongke2' ? ok2 : ok1;
        }
        var cells = [],
        i;
        for (i = 0; i < labs.length; i++) {
            var L = labs[i];
            var s = String(L.text || '').trim();
            if (!/^\d$/.test(s))
                continue; // một chữ số
            if (pick(L, prefer))
                cells.push({
                    v: +s,
                    x: L.x + L.w / 2,
                    y: L.y + L.h / 2
                });
        }
        if (cells.length >= 20)
            return {
                cells: cells,
                which: prefer
            };
        var alt = prefer === 'thongke2' ? 'thongke1' : 'thongke2';
        for (i = 0; i < labs.length; i++) {
            var L2 = labs[i];
            var s2 = String(L2.text || '').trim();
            if (!/^\d$/.test(s2))
                continue;
            if (pick(L2, alt))
                cells.push({
                    v: +s2,
                    x: L2.x + L2.w / 2,
                    y: L2.y + L2.h / 2
                });
        }
        return {
            cells: cells,
            which: alt
        };
    }
    function median(arr) {
        var b = arr.slice().sort(function (x, y) {
            return x - y;
        });
        return b[Math.floor(b.length / 2)] || 0;
    }
    function clusterByX(items) {
        if (!items.length)
            return [];
        var xs = [],
        i;
        for (i = 0; i < items.length; i++) {
            var X = Math.round(items[i].x);
            if (xs.indexOf(X) === -1)
                xs.push(X);
        }
        xs.sort(function (a, b) {
            return a - b;
        });
        var diffs = [],
        j;
        for (i = 1; i < xs.length; i++)
            diffs.push(xs[i] - xs[i - 1]);
        var spacing = diffs.length ? median(diffs) : 28;
        var thr = Math.max(8, Math.round(spacing * 0.6));
        var cols = [];
        var sorted = items.slice().sort(function (a, b) {
            return a.x - b.x;
        });
        for (i = 0; i < sorted.length; i++) {
            var it = sorted[i],
            col = null;
            for (j = 0; j < cols.length; j++) {
                if (Math.abs(cols[j].cx - it.x) <= thr) {
                    col = cols[j];
                    break;
                }
            }
            if (!col) {
                col = {
                    cx: it.x,
                    items: []
                };
                cols.push(col);
            }
            col.items.push(it);
            col.cx = (col.cx * (col.items.length - 1) + it.x) / col.items.length;
        }
        cols.sort(function (a, b) {
            return a.cx - b.cx;
        }); // TRÁI → PHẢI
        for (i = 0; i < cols.length; i++)
            cols[i].items.sort(function (a, b) {
                return b.y - a.y;
            }); // TRÊN → DƯỚI
        return cols;
    }
    function readTKSeq() {
        var res = tkCellsPrefer('thongke2');
        var cells = res.cells,
        which = res.which;
        if (!cells.length)
            return {
                seq: '',
                which: null,
                cols: [],
                cells: []
            };
        var cols = clusterByX(cells); // TRÁI→PHẢI
        var parts = [],
        i;
        for (i = 0; i < cols.length; i++) {
            var c = cols[i];
            var topDown = (i % 2 === 0); // cột 1 T↓, cột 2 B↑, ...
            var arr = c.items.slice();
            if (!topDown) {
                arr.reverse();
            }
            var s = '',
            k;
            for (k = 0; k < arr.length; k++)
                s += String(arr[k].v);
            parts.push(s);
        }
        return {
            seq: parts.join(''),
            which: which,
            cols: cols,
            cells: cells
        };
    }

    /* ---------------- resolver/auto ---------------- */
    function resolve(poolSig, sig) {
        if (!sig)
            return null;
        var end5 = String(sig.tail || '').toLowerCase().split('/').slice(-5).join('/');
        var cands = poolSig.filter(function (m) {
            return m.tl.indexOf(end5, Math.max(0, m.tl.length - end5.length)) !== -1;
        });
        if (!cands.length) {
            var parts = end5.split('/');
            for (var len = 4; len >= 2 && !cands.length; len--) {
                var e = parts.slice(-len).join('/');
                cands = poolSig.filter(function (m) {
                    return m.tl.indexOf(e, Math.max(0, m.tl.length - e.length)) !== -1;
                });
            }
        }
        if (!cands.length)
            return null;
        var ax = (sig.anchorN && sig.anchorN.x || 0) + (sig.anchorN && sig.anchorN.w || 0) / 2;
        var ay = (sig.anchorN && sig.anchorN.y || 0) + (sig.anchorN && sig.anchorN.h || 0) / 2;
        cands.sort(function (A, B) {
            var Axc = A.n.x + A.n.w / 2,
            Ayc = A.n.y + A.n.h / 2;
            var Bxc = B.n.x + B.n.w / 2,
            Byc = B.n.y + B.n.h / 2;
            var dA = dist2(Axc, Ayc, ax, ay),
            dB = dist2(Bxc, Byc, ax, ay);
            return dA - dB || area(A) - area(B);
        });
        return cands[0];
    }
    function autoBindAcc(S) {
        if (S.selAcc)
            return;
        var list = S.money && S.money.length ? S.money : buildMoneyRects();
        var cand = list.filter(function (m) {
            var t = m.tl;
            return (t.indexOf('/footer/khungmoney/moneylb') !== -1);
        });
        cand = cand.filter(function (m) {
            var t = m.tl;
            return (t.indexOf('jackpot') === -1 && t.indexOf('/footer/totalbetlb') !== t.length - ('/footer/totalbetlb'.length));
        });
        if (!cand.length)
            return;
        cand.sort(function (a, b) {
            return (a.n.y - b.n.y) || (area(b) - area(a));
        });
        var acc = cand[cand.length - 1];
        S.selAcc = {
            tail: acc.tail,
            anchorN: {
                x: acc.n.x,
                y: acc.n.y,
                w: acc.n.w,
                h: acc.n.h
            }
        };
    }

    /* ---------------- helpers for totals by (x, tail) ---------------- */
    var TAIL_TOTAL_EXACT = 'XDLive/Canvas/Bg/footer/listLabel/totalBet';
    var X_CHAN = 591; // CHẴN
    var X_LE = 973; // LẺ
    // --- NEW extra totals (by x under same tail) ---
    var X_SAPDOI = 783; // SẤP ĐÔI
    var X_TUTRANG = 561; // TỨ TRẮNG
    var X_TUDO = 1004; // TỨ ĐỎ
    var X_3DO = 856; // 3 ĐỎ
    var X_3TRANG = 709; // 3 TRẮNG

    function tailEquals(t, exact) {
        if (t == null)
            return false;
        var s1 = String(t),
        s2 = String(exact);
        return s1 === s2 || s1.toLowerCase() === s2.toLowerCase();
    }
    /** return full list (not truncated) filtered by tail */
    function moneyTailList(tailExact) {
        var list = buildMoneyRects();
        var out = [];
        for (var i = 0; i < list.length; i++) {
            var it = list[i];
            if (tailEquals(it.tail, tailExact))
                out.push(it);
        }
        return out.sort(function (a, b) {
            return a.y - b.y || a.x - b.x;
        });
    }
    /** pick by exact x (falling back to closest x if exact not found) under the given tail */
    function pickByXTail(list, xTarget, tailExact) {
        var arr = [];
        for (var i = 0; i < list.length; i++) {
            var it = list[i];
            if (tailEquals(it.tail, tailExact))
                arr.push(it);
        }
        // prefer exact x match
        for (var j = 0; j < arr.length; j++) {
            if (arr[j].x === xTarget)
                return arr[j];
        }
        // fallback: nearest by |x-xTarget|
        var best = null,
        bestDx = 1e9;
        for (var k = 0; k < arr.length; k++) {
            var dx = Math.abs(arr[k].x - xTarget);
            if (dx < bestDx) {
                best = arr[k];
                bestDx = dx;
            }
        }
        return best;
    }
    // Export standardized helpers
    window.moneyTailList = moneyTailList;
    window.pickByXTail = pickByXTail;
    window.cwPickChan = function () {
        return pickByXTail(moneyTailList(TAIL_TOTAL_EXACT), X_CHAN, TAIL_TOTAL_EXACT);
    };
    window.cwPickLe = function () {
        return pickByXTail(moneyTailList(TAIL_TOTAL_EXACT), X_LE, TAIL_TOTAL_EXACT);
    };

    /* ---------------- totals (using x & tail) ---------------- */
    function totals(S) {
        S.money = buildMoneyRects(); // keep map for overlays & legacy helpers

        var list = moneyTailList(TAIL_TOTAL_EXACT);
        var mC = pickByXTail(list, X_CHAN, TAIL_TOTAL_EXACT); // CHẴN
        var mL = pickByXTail(list, X_LE, TAIL_TOTAL_EXACT); // LẺ
        var mSD = pickByXTail(list, X_SAPDOI, TAIL_TOTAL_EXACT); // SẤP ĐÔI
        var mTT = pickByXTail(list, X_TUTRANG, TAIL_TOTAL_EXACT); // TỨ TRẮNG
        var m3T = pickByXTail(list, X_3TRANG, TAIL_TOTAL_EXACT); // 3 TRẮNG
        var m3D = pickByXTail(list, X_3DO, TAIL_TOTAL_EXACT); // 3 ĐỎ
        var mTD = pickByXTail(list, X_TUDO, TAIL_TOTAL_EXACT); // TỨ ĐỎ

        // Account (A) keeps old robust resolver
        if (!S.selAcc)
            autoBindAcc(S);
        var rA = resolve(S.money, S.selAcc);

        return {
            C: mC ? mC.val : null,
            L: mL ? mL.val : null,
            A: rA ? rA.val : null,
            SD: mSD ? mSD.val : null,
            TT: mTT ? mTT.val : null,
            T3T: m3T ? m3T.val : null,
            T3D: m3D ? m3D.val : null,
            TD: mTD ? mTD.val : null,
            rawC: mC ? mC.txt : null,
            rawL: mL ? mL.txt : null,
            rawA: rA ? rA.txt : null,
            rawSD: mSD ? mSD.txt : null,
            rawTT: mTT ? mTT.txt : null,
            rawT3T: m3T ? m3T.txt : null,
            rawT3D: m3D ? m3D.txt : null,
            rawTD: mTD ? mTD.txt : null
        };
    }
    function sampleTotalsNow() {
        try {
            return totals(S);
        } catch (e) {
            return {
                C: null,
                L: null,
                A: null
            };
        }
    }
    async function waitForTotalsChange(before, side, timeout) {
        timeout = timeout || 1400;
        var t0 = (performance && performance.now ? performance.now() : Date.now());
        var last = before;
        while (((performance && performance.now ? performance.now() : Date.now()) - t0) < timeout) {
            await sleep(90);
            var cur = sampleTotalsNow();
            if ((side === 'CHAN' && cur.C !== last.C) || (side === 'LE' && cur.L !== last.L) || (cur.A !== last.A))
                return true;
            last = cur;
        }
        return false;
    }

    /* ---------------- state & UI ---------------- */
    var S = {
        running: false,
        timer: null,
        tickMs: 240,
        prog: null,
        status: 'ĐỢI MỞ BÁT',
        money: [],
        text: [],
        selC: null,
        selL: null,
        selAcc: null,
        focus: null,
        showMoney: false,
        showBet: false,
        showText: false,
        stakeK: 1,
        seq: ''
    };

    var ROOT = '__cw_root_allin';
    var _old = document.getElementById(ROOT);
    if (_old)
        try {
            _old.remove();
        } catch (e) {}
    var root = document.createElement('div');
    root.id = ROOT;
    root.style.cssText = 'position:fixed;inset:0;z-index:2147483646;pointer-events:none;';
    document.body.appendChild(root);

    var panel = document.createElement('div');
    panel.style.cssText = 'position:fixed;top:10px;right:10px;width:820px;background:#08130f;color:#bff;border:1px solid #0a0;border-radius:10px;padding:8px;font:12px/1.35 Consolas,monospace;pointer-events:auto;z-index:2147483647';
    panel.innerHTML = '' +
        '<div style="display:flex;gap:6px;align-items:center;margin-bottom:6px;cursor:move">' +
        '<b style="color:#9f9">Canvas Watch</b>' +
        '<span id="cwState" style="margin-left:auto;color:#9f9">IDLE</span>' +
        '</div>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px">' +
        '<button id="bStart">Start</button>' +
        '<button id="bStop">Stop</button>' +
        '<button id="bMoney">MoneyMap</button>' +
        '<button id="bBet">BetMap</button>' +
        '<button id="bText">TextMap</button>' +
        '<button id="bScanMoney">Scan200Money</button>' +
        '<button id="bScanBet">Scan200Bet</button>' +
        '<button id="bScanText">Scan200Text</button>' +
        '</div>' +
        '<div style="display:flex;gap:10px;align-items:center;margin-bottom:6px">' +
        '<span>Tiền (×1K)</span>' +
        '<input id="iStake" value="1" style="width:60px;background:#0b1b16;border:1px solid #3a6;color:#bff;padding:2px 4px;border-radius:4px">' +
        '<button id="bBetC">Bet CHẴN</button>' +
        '<button id="bBetL">Bet LẺ</button>' +
        '</div>' +
        '<div id="cwInfo" style="white-space:pre;color:#9f9;line-height:1.45"></div>';
    //bo comment là ẩn canvas watch, còn comment lại là hiển thị bảng canvas watch
    //root.style.display='none';
    var btns = panel.querySelectorAll('button');
    for (var bi = 0; bi < btns.length; bi++) {
        var b = btns[bi];
        b.style.cssText = 'padding:4px 6px;background:#113015;color:#bff;border:1px solid #3a6;border-radius:4px;cursor:pointer';
        b.onmouseenter = (function (b) {
            return function () {
                b.style.background = '#1a3c1f';
            };
        })(b);
        b.onmouseleave = (function (b) {
            return function () {
                b.style.background = '#113015';
            };
        })(b);
    }
    root.appendChild(panel);

    // Drag
    try {
        var header = panel.firstElementChild || panel;
        header.style.cursor = 'move';
        var dragging = false,
        sx = 0,
        sy = 0,
        startLeft = 0,
        startTop = 0;
        var onDown = function (e) {
            if (e.button !== 0)
                return;
            dragging = true;
            var r = panel.getBoundingClientRect();
            startLeft = r.left;
            startTop = r.top;
            sx = e.clientX;
            sy = e.clientY;
            panel.style.left = startLeft + 'px';
            panel.style.top = startTop + 'px';
            panel.style.right = 'auto';
            panel.style.bottom = 'auto';
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
            e.preventDefault();
        };
        var onMove = function (e) {
            if (!dragging)
                return;
            var dx = e.clientX - sx,
            dy = e.clientY - sy;
            panel.style.left = (startLeft + dx) + 'px';
            panel.style.top = (startTop + dy) + 'px';
        };
        var onUp = function () {
            if (!dragging)
                return;
            dragging = false;
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
        header.addEventListener('mousedown', onDown);
    } catch (e) {}

    function setStateUI() {
        panel.querySelector('#cwState').textContent = S.running ? 'OPEN' : 'IDLE';
    }

    var layerMoney = document.createElement('div');
    layerMoney.style.cssText = 'position:fixed;inset:0;display:none;pointer-events:auto;z-index:2147483645;';
    root.appendChild(layerMoney);
    var layerBet = document.createElement('div');
    layerBet.style.cssText = 'position:fixed;inset:0;display:none;pointer-events:auto;z-index:2147483645;';
    root.appendChild(layerBet);
    var layerText = document.createElement('div');
    layerText.style.cssText = 'position:fixed;inset:0;display:none;pointer-events:auto;z-index:2147483645;';
    root.appendChild(layerText);

    var focusBox = document.createElement('div');
    focusBox.style.cssText = 'position:fixed;border:2px dashed #ffd866;background:#ffd80022;display:none;pointer-events:none;z-index:2147483647;';
    root.appendChild(focusBox);
    function showFocus(r) {
        if (!r) {
            focusBox.style.display = 'none';
            return;
        }
        var st = cssRect(r);
        for (var k in st) {
            focusBox.style[k] = st[k];
        }
        focusBox.style.display = '';
    }

    /* ---------------- render maps ---------------- */
    function renderMoney() {
        layerMoney.innerHTML = '';
        var bg = document.createElement('div');
        bg.style.cssText = 'position:absolute;inset:0;background:transparent;';
        layerMoney.appendChild(bg);
        var list = S.money && S.money.length ? S.money : buildMoneyRects();
        for (var i = 0; i < list.length; i++) {
            var m = list[i];
            var d = document.createElement('div');
            d.style.cssText = 'position:fixed;outline:1px dashed #0ff;background:#00ffff22;';
            var st = cssRect(m);
            for (var k in st) {
                d.style[k] = st[k];
            }
            d.title = m.txt + ' (' + fmt(m.val) + ')\n' + m.tail;
            d.onmouseup = (function (m) {
                return function (ev) {
                    ev.stopPropagation();
                    S.focus = {
                        rect: {
                            x: m.x,
                            y: m.y,
                            w: m.w,
                            h: m.h
                        },
                        tail: m.tail,
                        txt: m.txt,
                        val: m.val,
                        kind: 'money'
                    };
                    showFocus(S.focus.rect);
                    updatePanel();
                };
            })(m);
            layerMoney.appendChild(d);
        }
        layerMoney.onmouseup = function () {
            S.focus = null;
            showFocus(null);
            updatePanel();
        };
    }
    function renderBet() {
        layerBet.innerHTML = '';
        var btns = collectButtons().filter(function (b) {
            return b.w >= 16 && b.h >= 12;
        });
        var ordered = btns.slice().sort(function (a, b) {
            return (b.w * b.h) - (a.w * a.h);
        });
        for (var i = 0; i < ordered.length; i++) {
            var b = ordered[i];
            var d = document.createElement('div');
            d.style.cssText = 'position:fixed;outline:1px dashed #f80;background:#ff880022;';
            var st = cssRect(b);
            for (var k in st) {
                d.style[k] = st[k];
            }
            d.title = '[Button]\n' + b.tail;
            d.onmouseup = (function (b) {
                return function (ev) {
                    ev.stopPropagation();
                    S.focus = {
                        rect: {
                            x: b.x,
                            y: b.y,
                            w: b.w,
                            h: b.h
                        },
                        tail: b.tail,
                        txt: '',
                        val: null,
                        kind: 'bet'
                    };
                    showFocus(S.focus.rect);
                    updatePanel();
                };
            })(b);
            layerBet.appendChild(d);
        }
        layerBet.onmouseup = function () {
            S.focus = null;
            showFocus(null);
            updatePanel();
        };
    }
    function renderText() {
        layerText.innerHTML = '';
        var texts = S.text || [];
        var ordered = texts.slice().sort(function (a, b) {
            return (b.w * b.h) - (a.w * a.h);
        });
        for (var i = 0; i < ordered.length; i++) {
            var t = ordered[i];
            var d = document.createElement('div');
            d.style.cssText = 'position:fixed;outline:1px dashed #88f;background:#8888ff22;';
            var st = cssRect(t);
            for (var k in st) {
                d.style[k] = st[k];
            }
            d.title = '"' + t.text + '"\n' + t.tail;
            d.onmouseup = (function (t) {
                return function (ev) {
                    ev.stopPropagation();
                    S.focus = {
                        rect: {
                            x: t.x,
                            y: t.y,
                            w: t.w,
                            h: t.h
                        },
                        tail: t.tail,
                        txt: t.text,
                        val: moneyOf(t.text),
                        kind: 'text'
                    };
                    showFocus(S.focus.rect);
                    updatePanel();
                };
            })(t);
            layerText.appendChild(d);
        }
        layerText.onmouseup = function () {
            S.focus = null;
            showFocus(null);
            updatePanel();
        };
    }

    /* ---------------- panel info ---------------- */
    function updatePanel() {
        var t = S._lastTotals || {
            C: null,
            L: null,
            A: null,
            rawC: null,
            rawL: null,
            rawA: null
        };
        var f = S.focus;
        var base =
            '• Trạng thái: ' + S.status + ' | Prog: ' + (S.prog == null ? '--' : (((S.prog * 100) | 0) + '%')) + '\n' +
            '• TK : ' + fmt(t.A) + '|CHẴN: ' + fmt(t.C) + '|SẤP ĐÔI: ' + fmt(t.SD) + '|LẺ :' + fmt(t.L) + '|TỨ TRẮNG: ' + fmt(t.TT) + '|3 TRẮNG: ' + fmt(t.T3T) + '|3 ĐỎ: ' + fmt(t.T3D) + '|TỨ ĐỎ: ' + fmt(t.TD) + '\n' +

            '• Focus: ' + (f ? f.kind : '-') + '\n' +
            '  tail: ' + (f ? f.tail : '-') + '\n' +
            '  txt : ' + (f ? (f.txt != null ? f.txt : '-') : '-') + '\n' +
            '  val : ' + (f && f.val != null ? fmt(f.val) : '-');

        var tk = readTKSeq();
        S.seq = tk.seq || '';
        var seqHtml = 'Chuỗi kết quả : <i>--</i>';
        if (S.seq && S.seq.length) {
            var head = esc(S.seq.slice(0, -1));
            var last = esc(S.seq.slice(-1));
            seqHtml = 'Chuỗi kết quả : <span>' + head + '</span><span style="color:#f66">' + last + '</span>';
        }
        panel.querySelector('#cwInfo').innerHTML = esc(base) + '\n' + seqHtml;
    }

    /* ---------------- scan tools ---------------- */
    function scan200Money() {
        var money = buildMoneyRects().sort(function (a, b) {
            return a.y - b.y;
        }).slice(0, 200)
            .map(function (m) {
                return {
                    txt: m.txt,
                    val: m.val,
                    x: m.x,
                    y: m.y,
                    w: m.w,
                    h: m.h,
                    tail: m.tail
                };
            });
        console.log('(Money index x200)\ttxt\tval\tx\ty\tw\th\ttail');
        for (var i = 0; i < money.length; i++) {
            var r = money[i];
            console.log(i + "\t'" + r.txt + "'\t" + r.val + "\t" + r.x + "\t" + r.y + "\t" + r.w + "\t" + r.h + "\t'" + r.tail + "'");
        }
        console.log(money);
    }
    function scan200Bet() {
        var btns = collectButtons().filter(function (b) {
            return b.w >= 16 && b.h >= 12;
        })
            .sort(function (a, b) {
                return a.y - b.y;
            }).slice(0, 200)
            .map(function (b) {
                return {
                    x: b.x,
                    y: b.y,
                    w: b.w,
                    h: b.h,
                    tail: b.tail
                };
            });
        console.log('(Bet index x200)\tx\ty\tw\th\ttail');
        for (var i = 0; i < btns.length; i++) {
            var r = btns[i];
            console.log(i + "\t" + r.x + "\t" + r.y + "\t" + r.w + "\t" + r.h + "\t'" + r.tail + "'");
        }
        console.log(btns);
    }
    function scan200Text() {
        var texts = buildTextRects().sort(function (a, b) {
            return a.y - b.y;
        }).slice(0, 200)
            .map(function (t) {
                return {
                    text: t.text,
                    x: t.x,
                    y: t.y,
                    w: t.w,
                    h: t.h,
                    tail: t.tail
                };
            });
        console.log('(Text index x200)\ttext\tx\ty\tw\th\ttail');
        for (var i = 0; i < texts.length; i++) {
            var r = texts[i];
            console.log(i + "\t'" + r.text + "'\t" + r.x + "\t" + r.y + "\t" + r.w + "\t" + r.h + "\t'" + r.tail + "'");
        }
        try {
            console.table(texts);
        } catch (e) {
            console.log(texts);
        }
        return texts;
    }

    /* =====================================================
    CHIP BETTING CORE (compat)
    ===================================================== */
    var CHIP_TAIL_ROW4 = 'xdlive/canvas/bg/tipdealer/tabtipdealer/tipcontent/views/contentchat/row4/itemtip/lbmoney';
    var DENOMS_DESC = [10000000, 5000000, 1000000, 500000, 100000, 50000, 20000, 10000, 5000, 2000, 1000];
    var cfgBet = {
        delayPick: 220,
        delayTap: 260,
        delayBetweenSteps: 280
    };

    function clickAtWin(x, y) {
        var c = document.querySelector('canvas');
        if (!c)
            return false;
        var clientX = Math.round(x),
        clientY = Math.round(y);
        try {
            c.dispatchEvent(new PointerEvent('pointerdown', {
                    bubbles: true,
                    cancelable: true,
                    pointerType: 'mouse',
                    isPrimary: true,
                    clientX: clientX,
                    clientY: clientY,
                    buttons: 1
                }));
        } catch (e) {}
        try {
            c.dispatchEvent(new MouseEvent('mousedown', {
                    bubbles: true,
                    cancelable: true,
                    clientX: clientX,
                    clientY: clientY,
                    buttons: 1
                }));
        } catch (e) {}
        try {
            c.dispatchEvent(new PointerEvent('pointerup', {
                    bubbles: true,
                    cancelable: true,
                    pointerType: 'mouse',
                    isPrimary: true,
                    clientX: clientX,
                    clientY: clientY
                }));
        } catch (e) {}
        try {
            c.dispatchEvent(new MouseEvent('mouseup', {
                    bubbles: true,
                    cancelable: true,
                    clientX: clientX,
                    clientY: clientY
                }));
        } catch (e) {}
        try {
            c.dispatchEvent(new MouseEvent('click', {
                    bubbles: true,
                    cancelable: true,
                    clientX: clientX,
                    clientY: clientY
                }));
        } catch (e) {}
        try {
            if ('Touch' in window) {
                var touch = new Touch({
                    identifier: Date.now() % 100000,
                    target: c,
                    clientX: clientX,
                    clientY: clientY,
                    screenX: clientX,
                    screenY: clientY,
                    pageX: clientX,
                    pageY: clientY
                });
                var ts = [touch];
                c.dispatchEvent(new TouchEvent('touchstart', {
                        bubbles: true,
                        cancelable: true,
                        touches: ts,
                        targetTouches: ts,
                        changedTouches: ts
                    }));
                c.dispatchEvent(new TouchEvent('touchend', {
                        bubbles: true,
                        cancelable: true,
                        touches: [],
                        targetTouches: [],
                        changedTouches: ts
                    }));
            }
        } catch (e) {}
        try {
            window.dispatchEvent(new MouseEvent('click', {
                    bubbles: true,
                    cancelable: true,
                    clientX: clientX,
                    clientY: clientY
                }));
        } catch (e) {}
        return true;
    }
    function clickRectCenter(r) {
        var cx = r.x + r.w / 2,
        cy = r.y + r.h / 2;
        return clickAtWin(jitter(cx - 2, cx + 2), jitter(cy - 2, cy + 2));
    }
    function getChipRects() {
        var labs = collectLabels().filter(function (l) {
            return l.tl.indexOf(CHIP_TAIL_ROW4, Math.max(0, l.tl.length - CHIP_TAIL_ROW4.length)) !== -1;
        });
        var byVal = {};
        for (var i = 0; i < labs.length; i++) {
            var it = labs[i];
            if (!it.val)
                continue;
            var cur = byVal[it.val];
            if (!cur || (it.w * it.h) > (cur.w * cur.h))
                byVal[it.val] = {
                    val: it.val,
                    x: it.x,
                    y: it.y,
                    w: it.w,
                    h: it.h
                };
        }
        var arr = [];
        for (var k in byVal) {
            arr.push(byVal[k]);
        }
        arr.sort(function (a, b) {
            return a.val - b.val;
        });
        return arr;
    }
    function getTargets() {
        var btns = collectButtons();
        function pick(key) {
            var cand = btns.filter(function (b) {
                return b.tl.indexOf('/footer/' + key, Math.max(0, b.tl.length - ('/footer/' + key).length)) !== -1;
            });
            if (!cand.length)
                return null;
            cand.sort(function (a, b) {
                return (b.w * b.h) - (a.w * a.h);
            });
            return cand[0];
        }
        return {
            chan: pick('chan'),
            le: pick('le')
        };
    }
    async function pickChip(val, chips) {
        var c = null;
        for (var i = 0; i < chips.length; i++) {
            if (chips[i].val === val) {
                c = chips[i];
                break;
            }
        }
        if (!c) {
            console.warn('[cwPick] no chip', val);
            return false;
        }
        var ok = clickRectCenter(c);
        await sleep(cfgBet.delayPick);
        return ok;
    }
    async function tapSide(side) {
        var tgts = getTargets();
        var tgt = (side === 'CHAN' ? tgts.chan : tgts.le);
        if (!tgt) {
            console.warn('[cwTapTarget] no target', side);
            return false;
        }
        var ok = clickRectCenter(tgt);
        await sleep(cfgBet.delayTap);
        return ok;
    }
    function makePlanSmart(amount) {
        var chips = getChipRects();
        var avail = [];
        for (var i = 0; i < DENOMS_DESC.length; i++) {
            var v = DENOMS_DESC[i];
            for (var j = 0; j < chips.length; j++) {
                if (chips[j].val === v) {
                    avail.push(v);
                    break;
                }
            }
        }
        var plan = [],
        rest = amount;
        for (var ai = 0; ai < avail.length; ai++) {
            var v = avail[ai];
            if (rest <= 0)
                break;
            var cnt = Math.floor(rest / v);
            if (cnt > 0) {
                plan.push({
                    val: v,
                    count: cnt
                });
                rest -= cnt * v;
            }
        }
        return {
            plan: plan,
            rest: rest,
            chips: chips
        };
    }
    var _busy = false;
    async function cwBetSmart(side, amount) {
        if (_busy) {
            console.warn('[CW BET] đang chạy');
            return;
        }
        _busy = true;
        try {
            var amt = Math.max(0, Math.floor(amount || 0));
            var res = makePlanSmart(amt);
            var plan = res.plan,
            chips = res.chips;
            if (!plan.length) {
                console.warn('[CW BET] Không lập được plan');
                return;
            }
            for (var s = 0; s < plan.length; s++) {
                var step = plan[s];
                for (var i = 0; i < step.count; i++) {
                    var okPick = await pickChip(step.val, chips);
                    if (!okPick) {
                        console.warn('[CW BET] pick failed', step.val);
                    }
                    var before = sampleTotalsNow();
                    var applied = false;
                    for (var attempt = 0; attempt < 3 && !applied; attempt++) {
                        await tapSide(side);
                        applied = await waitForTotalsChange(before, side, 1400);
                        if (!applied && attempt === 1) {
                            await sleep(80);
                            await pickChip(step.val, chips);
                        }
                    }
                    if (!applied) {
                        var tgt = (side === 'CHAN' ? getTargets().chan : getTargets().le);
                        if (tgt) {
                            var offsets = [[0, 0], [0.15, 0], [-0.15, 0], [0, 0.15], [0, -0.15]];
                            for (var k = 0; k < offsets.length; k++) {
                                var ox = offsets[k][0],
                                oy = offsets[k][1];
                                var r = {
                                    x: tgt.x + tgt.w * 0.5 + tgt.w * ox,
                                    y: tgt.y + tgt.h * 0.5 + tgt.h * oy,
                                    w: 1,
                                    h: 1
                                };
                                clickRectCenter(r);
                                await sleep(cfgBet.delayTap);
                                if (await waitForTotalsChange(before, side, 900)) {
                                    applied = true;
                                    break;
                                }
                            }
                        }
                    }
                    await sleep(cfgBet.delayBetweenSteps);
                }
            }
        } catch (e) {
            console.error('[CW BET][ERR]', e);
        } finally {
            _busy = false;
        }
    }
    window.cwBetSmart = cwBetSmart;

    /* ---------------- cwBet classic ---------------- */
    var ALLOWED_SET = {
        '1000': 1,
        '5000': 1,
        '10000': 1,
        '50000': 1,
        '100000': 1,
        '500000': 1,
        '1000000': 1,
        '5000000': 1
    };
    var DENOMS = [5000000, 1000000, 500000, 100000, 50000, 10000, 5000, 1000];

    function active(n) {
        return !n || n.activeInHierarchy !== false;
    }
    function hasBtn(n) {
        return !!getComp(n, cc.Button);
    }
    function hasTgl(n) {
        return !!getComp(n, cc.Toggle);
    }
    function clickable(n) {
        return hasBtn(n) || hasTgl(n) || n._touchListener;
    }
    function emitClick(node) {
        var b = getComp(node, cc.Button);
        if (b && b.interactable !== false) {
            try {
                cc.Component.EventHandler.emitEvents(b.clickEvents, new cc.Event.EventCustom('click', true));
            } catch (e) {}
            return true;
        }
        var t = getComp(node, cc.Toggle);
        if (t && t.interactable !== false) {
            try {
                t.isChecked = true;
                if (t._emitToggleEvents)
                    t._emitToggleEvents();
            } catch (e) {}
            return true;
        }
        try {
            var cam = cc.Camera.findCamera(node);
            var sp = cam.worldToScreen(node.convertToWorldSpaceAR(cc.v2()));
            var fs = cc.view.getFrameSize(),
            vs = cc.view.getVisibleSize();
            var x = sp.x * (fs.width / vs.width),
            y = sp.y * (fs.height / vs.height);
            var cvs = document.querySelector('canvas');
            cvs.dispatchEvent(new PointerEvent('pointerdown', {
                    clientX: x,
                    clientY: y,
                    buttons: 1,
                    bubbles: true
                }));
            cvs.dispatchEvent(new PointerEvent('pointerup', {
                    clientX: x,
                    clientY: y,
                    buttons: 1,
                    bubbles: true
                }));
            return true;
        } catch (e) {
            return false;
        }
    }
    function clickableOf(node, depth) {
        depth = depth || 5;
        var cur = node,
        d = 0;
        while (cur && d <= depth) {
            if (clickable(cur))
                return cur;
            cur = cur.parent;
            d++;
        }
        return node;
    }
    function NORM(s) {
        return String(s || '').normalize('NFD').replace(/[\u0300-\u036F]/g, '').toUpperCase();
    }
    function normalizeSide(raw) {
        // chuyển input thành key chuẩn cho findSide/cwBet
        var s = NORM(raw || '').replace(/[^A-Z0-9]+/g, '_');
        if (!s)
            return 'LE'; // giữ nguyên hành vi cũ: không nhận => mặc định Lẻ
        if (s === 'CHAN' || s === 'EVEN')
            return 'CHAN';
        if (s === 'LE' || s === 'ODD')
            return 'LE';
        if (s === 'SAP_DOI' || s === 'SAPDOI' || s === '2DO2TRANG' || s === '2D2T' || s === '2R2W')
            return 'SAP_DOI';
        if (s === 'TRANG3_DO1' || s === '3TRANG1DO' || s === '3T1D' || s === '3W1R' || s === '1DO3TRANG' || s === '1D3T' || s === '1R3W')
            return 'TRANG3_DO1';
        if (s === 'DO3_TRANG1' || s === '3DO1TRANG' || s === '3D1T' || s === '3R1W' || s === '1TRANG3DO' || s === '1T3D' || s === '1W3R')
            return 'DO3_TRANG1';
        if (s === 'TU_TRANG' || s === 'TUTRANG' || s === '4TRANG' || s === '4W')
            return 'TU_TRANG';
        if (s === 'TU_DO' || s === 'TUDO' || s === '4DO' || s === '4R')
            return 'TU_DO';
        return s;
    }
    var SIDE_REGEX = {
        CHAN: /(CHAN|EVEN)\b/i,
        LE: /(\bLE\b|ODD)\b/i,
        SAP_DOI: /(SAP\s*DOI|SAPDOI|2\s*DO\s*2\s*TRANG|2D2T|2R2W|2DO2TRANG)/i,
        TRANG3_DO1: /(3\s*TRANG\s*1\s*DO|3T1D|3W1R|3TRANG1DO|1\s*DO\s*3\s*TRANG|1D3T|1R3W|1DO3TRANG)/i,
        DO3_TRANG1: /(3\s*DO\s*1\s*TRANG|3D1T|3R1W|3DO1TRANG|1\s*TRANG\s*3\s*DO|1T3D|1W3R|1TRANG3DO)/i,
        TU_TRANG: /(TU\s*TRANG|4\s*TRANG|4W|TUTRANG)/i,
        TU_DO: /(TU\s*DO|4\s*DO|4R|TUDO)/i
    };
    function findSide(side) {
        var WANT = normalizeSide(side);
        var rx = SIDE_REGEX[WANT];
        if (!rx)
            return null; // không nhận diện được cửa -> bỏ qua, tránh click nhầm
        var hit = null;
        (function walk(n) {
            if (hit || !active(n))
                return;
            var lb = getComp(n, cc.Label) || getComp(n, cc.RichText);
            var ok = false;
            if (lb && typeof lb.string !== 'undefined') {
                var s = NORM(lb.string);
                ok = rx ? rx.test(s) : false;
            }
            if (!ok) {
                var names = [],
                p;
                for (p = n; p; p = p.parent)
                    names.push(p.name || '');
                var path = names.reverse().join('/').toLowerCase();
                ok = rx ? rx.test(path) : false;
            }
            if (ok) {
                var c = clickableOf(n, 8);
                if (clickable(c)) {
                    hit = c;
                    return;
                }
            }
            var kids = n.children || [];
            for (var i = 0; i < kids.length; i++)
                walk(kids[i]);
        })(cc.director.getScene());
        return hit;
    }

    function parseAmountLoose(txt) {
        if (!txt)
            return null;
        var s = NORM(txt);
        var m = s.match(/(\d+)\s*(K|M)\b/);
        if (m) {
            var v = +m[1];
            v *= (m[2] === 'K' ? 1e3 : 1e6);
            return ALLOWED_SET[String(v)] ? v : null;
        }
        m = s.match(/(\d{1,3}(?:[.,\s]\d{3})+|\d{4,9})/);
        if (m) {
            var v2 = parseInt(m[1].replace(/[^\d]/g, ''), 10);
            if (v2 % 1000 === 0 && ALLOWED_SET[String(v2)])
                return v2;
        }
        return null;
    }

    async function tryOpenChipPanel() {
        var key = /CHIP|COIN|PHINH|CHON|CHOOSE|MENH|BET/i;
        var cand = null;
        (function walk(n) {
            if (cand || !active(n))
                return;
            var l = (getComp(n, cc.Label) && getComp(n, cc.Label).string) || (getComp(n, cc.RichText) && getComp(n, cc.RichText).string) || '';
            var names = [],
            p;
            for (p = n; p; p = p.parent)
                names.push(p.name || '');
            var path = names.reverse().join('/');
            if (key.test(l) || key.test(path))
                if (clickable(n))
                    cand = n;
            var kids = n.children || [];
            for (var i = 0; i < kids.length; i++)
                walk(kids[i]);
        })(cc.director.getScene());
        if (cand) {
            emitClick(clickableOf(cand));
            await sleep(220);
        }
    }

    function wideScan() {
        var q = [cc.director.getScene()],
        best = {};
        function getBest(val) {
            return best[String(val)];
        }
        function setBest(val, obj) {
            best[String(val)] = obj;
        }
        while (q.length) {
            var n = q.shift();
            if (!active(n))
                continue;
            var texts = [];
            var lb = getComp(n, cc.Label);
            if (lb && typeof lb.string !== 'undefined')
                texts.push(lb.string);
            var rt = getComp(n, cc.RichText);
            if (rt && typeof rt.string !== 'undefined')
                texts.push(rt.string);
            var sp = getComp(n, cc.Sprite);
            var sfn = sp && sp.spriteFrame ? sp.spriteFrame.name : '';
            if (sfn)
                texts.push(sfn);
            texts.push(n.name || '');
            for (var ti = 0; ti < texts.length; ti++) {
                var t = texts[ti];
                var val = parseAmountLoose(t);
                if (!val)
                    continue;
                var score = 0;
                if (clickable(n))
                    score += 6;
                var names = [],
                p;
                for (p = n; p; p = p.parent)
                    names.push(p.name || '');
                var path = names.reverse().join('/').toLowerCase();
                if (/chip|coin|bet|chon|choose|phinh|menh/.test(path))
                    score += 3;
                if (NORM(t).indexOf(String(val)) !== -1)
                    score += 2;
                var hit = clickableOf(n);
                if (hit !== n)
                    score += 1;
                var old = getBest(val);
                if (!old || score > old.score)
                    setBest(val, {
                        node: hit,
                        score: score
                    });
            }
            var kids = n.children || [];
            for (var i = 0; i < kids.length; i++)
                q.push(kids[i]);
        }
        var map = {};
        for (var k in best) {
            map[k] = {
                entry: best[k].node,
                node: best[k].node
            };
        }
        return map;
    }

    var prevScan = window.cwScanChips;
    window.cwScanChips = function () {
        var m = prevScan ? (prevScan() || {}) : {};
        if (m && Object.keys(m).length)
            return m;
        m = wideScan();
        if (!Object.keys(m).length)
            console.warn('[cwScanChips++] chưa thấy chip.');
        else {
            var keys = Object.keys(m).map(function (x) {
                return +x;
            }).sort(function (a, b) {
                return a - b;
            });
            var rows = keys.map(function (v) {
                return {
                    amount: v,
                    node: (m[v] && m[v].node ? m[v].node.name : '?')
                };
            });
            try {
                console.table(rows);
            } catch (e) {
                console.log(rows);
            }
        }
        return m;
    };

    var prevFocus = window.cwFocusChip;
    window.cwFocusChip = async function (amount) {
        var val = Math.max(0, Math.floor(+amount || 0));
        if (!ALLOWED_SET[String(val)])
            throw new Error('Mệnh giá không hợp lệ: ' + amount);
        var map = window.cwScanChips() || {};
        if (!map[String(val)]) {
            await tryOpenChipPanel();
            await sleep(180);
            map = wideScan();
        }
        if (!map[String(val)]) {
            var hit = null;
            (function walk(n) {
                if (hit || !active(n))
                    return;
                var texts = [];
                var lb = getComp(n, cc.Label);
                if (lb && typeof lb.string !== 'undefined')
                    texts.push(lb.string);
                var rt = getComp(n, cc.RichText);
                if (rt && typeof rt.string !== 'undefined')
                    texts.push(rt.string);
                var sp = getComp(n, cc.Sprite);
                var sfn = sp && sp.spriteFrame ? sp.spriteFrame.name : '';
                if (sfn)
                    texts.push(sfn);
                texts.push(n.name || '');
                for (var i = 0; i < texts.length; i++) {
                    if (parseAmountLoose(texts[i]) === val) {
                        hit = clickableOf(n);
                        return;
                    }
                }
                var kids = n.children || [];
                for (var k = 0; k < kids.length; k++)
                    walk(kids[k]);
            })(cc.director.getScene());
            if (hit) {
                emitClick(hit);
                await sleep(140);
                var t = getComp(hit, cc.Toggle);
                if (t && !t.isChecked) {
                    t.isChecked = true;
                    if (t._emitToggleEvents)
                        t._emitToggleEvents();
                }
                return true;
            }
            console.warn('[cwFocusChip++] không tìm thấy phỉnh:', val);
            return false;
        }
        var info = map[String(val)];
        if (!info || !info.node) {
            console.warn('[cwFocusChip++] map thiếu node', val);
            return false;
        }
        emitClick(info.node);
        await sleep(140);
        var tg = getComp(info.node, cc.Toggle);
        if (tg && !tg.isChecked) {
            tg.isChecked = true;
            if (tg._emitToggleEvents)
                tg._emitToggleEvents();
        }
        return true;
    };

    window.cwDumpChips = function () {
        var m = wideScan();
        var keys = Object.keys(m).map(function (x) {
            return +x;
        }).sort(function (a, b) {
            return a - b;
        });
        var rows = keys.map(function (v) {
            return {
                amount: v,
                node: (m[v] && m[v].node ? m[v].node.name : '?')
            };
        });
        try {
            console.table(rows);
        } catch (e) {
            console.log(rows);
        }
        return rows;
    };

    var old_cwBet = (typeof window.cwBet === 'function') ? window.cwBet.bind(window) : null;
    var LOCK = (window.__cwBetLockFix = window.__cwBetLockFix || {
            busy: false
        });
    async function withLock(fn) {
        // chờ ngắn nếu đang bận để tránh trượt lệnh khi bắn liên tục nhiều cửa
        for (var i = 0; i < 4 && LOCK.busy; i++) {
            console.warn('[cwBet++] busy, wait', i);
            await sleep(120);
        }
        if (LOCK.busy) {
            console.warn('[cwBet++] busy (give up)');
            return false;
        }
        LOCK.busy = true;
        try {
            return await fn();
        } finally {
            LOCK.busy = false;
        }
    }

    function makePlan(X, availableSet) {
        var rest = Math.max(0, Math.floor(+X || 0));
        var plan = [];
        for (var i = 0; i < DENOMS.length; i++) {
            var d = DENOMS[i];
            if (d <= rest && availableSet[d]) {
                var c = Math.floor(rest / d);
                if (c > 0) {
                    plan.push({
                        val: d,
                        count: c
                    });
                    rest -= c * d;
                }
            }
        }
        return {
            plan: plan,
            rest: rest
        };
    }

    window.cwBet = async function (side, amount) {
        side = normalizeSide(side);
        if (amount == null || isNaN(amount)) {
            if (old_cwBet)
                return old_cwBet(side);
            var btn = findSide(side);
            if (!btn) {
                console.warn('[cwBet++] không thấy nút cửa:', side);
                return false;
            }
            emitClick(btn);
            await sleep(80);
            return true;
        }

        var raw = Math.max(0, Math.floor(+amount || 0));
        if (!raw) {
            console.warn('[cwBet++] amount=0');
            return false;
        }
        var X = raw - (raw % 1000);

        return withLock(async function () {
            var btn = findSide(side);
            if (!btn) {
                console.warn('[cwBet++] không thấy nút cửa:', side);
                return false;
            }

            var map = window.cwScanChips() || {};
            if (!Object.keys(map).length) {
                await tryOpenChipPanel();
                await sleep(200);
                map = wideScan();
            }
            var availSet = {};
            var ks = Object.keys(map);
            for (var i = 0; i < ks.length; i++)
                availSet[ks[i]] = 1;
            if (!Object.keys(availSet).length) {
                console.warn('[cwBet++] không thấy chip nào');
                return false;
            }

            if (availSet[String(X)]) {
                await window.cwFocusChip(X);
                emitClick(btn);
                await sleep(120);
                return true;
            }

            var res = makePlan(X, availSet);
            var plan = res.plan,
            rest = res.rest;
            if (!plan.length || rest > 0) {
                var haveKeys = Object.keys(availSet).map(function (x) {
                    return +x;
                }).sort(function (a, b) {
                    return b - a;
                });
                console.warn('[cwBet++] không thể tách đủ số tiền', {
                    X: X,
                    have: haveKeys
                });
                return false;
            }
            var planStr = [];
            for (var p = 0; p < plan.length; p++) {
                planStr.push(plan[p].count + '×' + plan[p].val.toLocaleString());
            }
            console.log('[cwBet++] plan:', planStr.join(' + '));

            for (var s = 0; s < plan.length; s++) {
                var step = plan[s];
                var ok = await window.cwFocusChip(step.val).catch(function () {
                    return false;
                });
                if (!ok) {
                    console.warn('[cwBet++] không focus được chip', step.val);
                    return false;
                }
                for (var i2 = 0; i2 < step.count; i2++) {
                    if (!emitClick(btn))
                        console.warn('[cwBet++] click cửa thất bại', {
                            side: side,
                            denom: step.val,
                            turn: i2 + 1
                        });
                    await sleep(100);
                }
            }
            console.log('[cwBet++] DONE ►', {
                side: side,
                amount: X
            });
            return true;
        });
    };

    console.log('[READY] CW merged (compat + TextMap + Scan200Text + TK sequence + Totals by (x,tail) + standardized exports).');

    /* ---------------- tick & controls ---------------- */
    function statusByProg(p) {
        // Ngưỡng chống rung cho số thực gần 0
        var EPS = 0.001;

        // Quy tắc ông chủ yêu cầu:
        // - p > 0      → lấy text tail 'XDLive/Canvas/PopUpMessageUtil/ig_bg_thong_bao/textMessage'
        // - p = 0      → lấy text tail 'XDLive/Canvas/Bg/showKetQua/ig_bg_thong_bao/textWaiting'
        var TAIL_MSG = 'XDLive/Canvas/PopUpMessageUtil/ig_bg_thong_bao/textMessage';
        var TAIL_WAIT = 'XDLive/Canvas/Bg/showKetQua/ig_bg_thong_bao/textWaiting';

        // Chọn text theo tail, so khớp theo kiểu "đuôi" để chống thay đổi prefix
        function pickTextByTailEnd(tailEnd) {
            try {
                var texts = buildTextRects(); // [{text,x,y,w,h,tail}, ...]
                var best = null,
                bestArea = -1;
                var tailEndL = String(tailEnd || '').toLowerCase();

                for (var i = 0; i < texts.length; i++) {
                    var t = texts[i];
                    var tl = String(t.tail || '').toLowerCase();
                    if (!tl.endsWith(tailEndL))
                        continue;

                    var ar = (t.w || 0) * (t.h || 0);
                    if (ar > bestArea) {
                        best = t;
                        bestArea = ar;
                    }
                }
                return best ? String(best.text || '').trim() : '';
            } catch (e) {
                return '';
            }
        }

        p = +p || 0;
        var tail = (p > EPS) ? TAIL_MSG : TAIL_WAIT;
        var txt = pickTextByTailEnd(tail);

        // Fallback nhẹ khi không tìm thấy text
        if (txt)
            return txt;
        return "";
    }

    function tick() {
        var p = collectProgress();
        if (p != null)
            S.prog = p;
        S.status = statusByProg(p == null ? null : p);
        var T = totals(S);
        S._lastTotals = T;

        // TK sequence
        var tk = readTKSeq();
        S.seq = tk.seq || '';

        // keep focus
        if (S.focus) {
            var all = collectLabels().filter(function (l) {
                return l.tail === S.focus.tail;
            });
            if (all.length) {
                var prev = S.focus.rect || {
                    x: 0,
                    y: 0,
                    w: 0,
                    h: 0
                };
                all.sort(function (a, b) {
                    var da = (a.x - prev.x) * (a.x - prev.x) + (a.y - prev.y) * (a.y - prev.y);
                    var db = (b.x - prev.x) * (b.x - prev.x) + (b.y - prev.y) * (b.y - prev.y);
                    return da - db;
                });
                var r = all[0];
                S.focus.rect = {
                    x: r.x,
                    y: r.y,
                    w: r.w,
                    h: r.h
                };
                var txt = String(r.text || '');
                S.focus.txt = txt;
                S.focus.val = (moneyOf(txt) != null ? moneyOf(txt) : (/^\d$/.test(txt) ? +txt : null));
                showFocus(S.focus.rect);
            }
        }

        if (S.showMoney) {
            S.money = buildMoneyRects();
            renderMoney();
        }
        if (S.showText) {
            S.text = buildTextRects();
            renderText();
        }
        updatePanel();
    }
    function start() {
        if (S.running)
            return;
        S.running = true;
        S.timer = setInterval(tick, S.tickMs);
        tick();
        setStateUI();
    }
    function stop() {
        if (!S.running)
            return;
        S.running = false;
        try {
            clearInterval(S.timer);
        } catch (e) {}
        S.timer = null;
        setStateUI();
    }

    panel.querySelector('#bStart').onclick = function () {
        start();
    };
    panel.querySelector('#bStop').onclick = function () {
        stop();
    };
    panel.querySelector('#bMoney').onclick = function () {
        S.showMoney = !S.showMoney;
        layerMoney.style.display = S.showMoney ? '' : 'none';
        if (S.showMoney) {
            S.money = buildMoneyRects();
            renderMoney();
        } else {
            S.focus = null;
            showFocus(null);
        }
        panel.style.zIndex = '2147483647';
    };
    panel.querySelector('#bBet').onclick = function () {
        S.showBet = !S.showBet;
        layerBet.style.display = S.showBet ? '' : 'none';
        if (S.showBet) {
            renderBet();
        } else {
            S.focus = null;
            showFocus(null);
        }
        panel.style.zIndex = '2147483647';
    };
    panel.querySelector('#bText').onclick = function () {
        S.showText = !S.showText;
        layerText.style.display = S.showText ? '' : 'none';
        if (S.showText) {
            S.text = buildTextRects();
            renderText();
        } else {
            S.focus = null;
            showFocus(null);
        }
        panel.style.zIndex = '2147483647';
    };
    panel.querySelector('#bScanMoney').onclick = function () {
        scan200Money();
    };
    panel.querySelector('#bScanBet').onclick = function () {
        scan200Bet();
    };
    panel.querySelector('#bScanText').onclick = function () {
        scan200Text();
    };

    panel.querySelector('#bBetC').addEventListener('click', async function () {
        var n = parseFloat(document.getElementById('iStake').value || '1');
        var amount = Math.max(0, Math.floor((isFinite(n) ? n : 1))) * 1000;
        try {
            window.chrome && window.chrome.webview && window.chrome.webview.postMessage && window.chrome.webview.postMessage(JSON.stringify({
                    abx: 'cwBet',
                    side: 'CHAN',
                    amount: amount,
                    ts: Date.now()
                }));
        } catch (e) {}
        try {
            await cwBet('CHAN', amount);
        } catch (e) {}
    }, true);
    panel.querySelector('#bBetL').addEventListener('click', async function () {
        var n = parseFloat(document.getElementById('iStake').value || '1');
        var amount = Math.max(0, Math.floor((isFinite(n) ? n : 1))) * 1000;
        try {
            window.chrome && window.chrome.webview && window.chrome.webview.postMessage && window.chrome.webview.postMessage(JSON.stringify({
                    abx: 'cwBet',
                    side: 'LE',
                    amount: amount,
                    ts: Date.now()
                }));
        } catch (e) {}
        try {
            await cwBet('LE', amount);
        } catch (e) {}
    }, true);

    function onKey(e) {
        var t = e.target;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable))
            return;
        var k = (e.key || '').toLowerCase();
        if (k === 's')
            (S.running ? stop() : start());
        else if (k === 'm')
            panel.querySelector('#bMoney').click();
        else if (k === 'b')
            panel.querySelector('#bBet').click();
        else if (k === 't')
            panel.querySelector('#bText').click();
    }
    document.addEventListener('keydown', onKey);
    start();

    function teardown() {
        try {
            stop();
        } catch (e) {}
        try {
            document.removeEventListener('keydown', onKey);
        } catch (e) {}
        try {
            root.remove();
        } catch (e) {}
    }
    window[NS] = {
        teardown: teardown
    };

    /* === CW Bridge: push snapshot -> C#, receive bet <- C# =================== */
;
    (function () {
        try {
            if (!window.chrome || !chrome.webview || !chrome.webview.postMessage) {
                console.warn('[CW] chrome.webview.postMessage not available');
            }
        } catch (_) {}

        function safePost(obj) {
            try {
                if (window.chrome && chrome.webview && typeof chrome.webview.postMessage === 'function') {
                    chrome.webview.postMessage(JSON.stringify(obj));
                } else {
                    // Fallback: gửi lên TOP bằng DOM message, TOP_FORWARD sẽ relay về C#
                    parent.postMessage(obj, '*');
                }
            } catch (e) {
                try {
                    parent.postMessage(obj, '*');
                } catch (_) {}
            }
        }

        var _pushTimer = null;
        var _lastJson = '';

        function shallowChanged(obj) {
            var s = '';
            try {
                s = JSON.stringify(obj);
            } catch (_) {}
            if (s && s !== _lastJson) {
                _lastJson = s;
                return true;
            }
            return false;
        }

        function readProgressVal() {
            try {
                var cp = (typeof collectProgress === 'function') ? collectProgress() : null;
                if (typeof cp === 'number')
                    return cp; // <— thêm dòng này
                if (cp && typeof cp.val === 'number')
                    return cp.val;
                if (cp && typeof cp.progress === 'number')
                    return cp.progress;
            } catch (_) {}
            return null;
        }

        function readTotalsSafe() {
            try {
                return (typeof sampleTotalsNow === 'function') ? sampleTotalsNow() : null;
            } catch (_) {
                return null;
            }
        }

        function readSeqSafe() {
            try {
                if (typeof readTKSeq === 'function') {
                    var r = readTKSeq();
                    return (r && r.seq) ? r.seq : '';
                }
            } catch (_) {}
            return '';
        }

        // Bắt đầu bắn snapshot định kỳ {abx:'tick', prog, totals, seq, status}
        window.__cw_startPush = function (tickMs) {
            try {
                tickMs = Number(tickMs) || 240;
                if (tickMs < 120)
                    tickMs = 120;
                if (tickMs > 1000)
                    tickMs = 1000;
                if (_pushTimer) {
                    clearInterval(_pushTimer);
                    _pushTimer = null;
                }
                _lastJson = '';
                _pushTimer = setInterval(function () {
                    var p = readProgressVal(); // lấy progress hiện tại
                    var st = (typeof statusByProg === 'function') // tính status theo rule mới
                     ? statusByProg(p) : '';
                    var snap = {
                        abx: 'tick',
                        prog: p,
                        totals: readTotalsSafe(),
                        seq: readSeqSafe(),
                        status: String(st || ''), // <-- THÊM TRƯỜNG status
                        ts: Date.now()
                    };
                    if (shallowChanged(snap))
                        safePost(snap);
                }, tickMs);
                return 'started';
            } catch (err) {
                safePost({
                    abx: 'tick_error',
                    error: String(err && err.message || err),
                    ts: Date.now()
                });
                return 'fail';
            }
        };

        window.__cw_stopPush = function () {
            if (_pushTimer) {
                clearInterval(_pushTimer);
                _pushTimer = null;
            }
            return 'stopped';
        };

        // LƯU Ý: Chỉ dùng cwBet, không fallback cwBetSmart
        // Hàng đợi đặt cược tuần tự: C# cứ đẩy xuống, JS tự xếp hàng và bắn cwBet lần lượt
        var BET_QUEUE = window.__cwBetQueue = window.__cwBetQueue || [];
        var _processingBetQueue = false;
        async function processBetQueue() {
            if (_processingBetQueue)
                return;
            _processingBetQueue = true;
            while (BET_QUEUE.length) {
                var job = BET_QUEUE.shift();
                var side = job.side,
                amt = job.amt;
                var result = 'fail';
                try {
                    if (typeof cwBet !== 'function') {
                        throw new Error('cwBet not found');
                    }
                    var before = readTotalsSafe() || {};
                    var rawResult = await cwBet(side, amt);
                    var ok = rawResult === true || rawResult === 'ok' || (rawResult && rawResult.ok === true);
                    try {
                        if (ok && typeof waitForTotalsChange === 'function') {
                            await waitForTotalsChange(before, side, 1600);
                        }
                    } catch (_) {}
                    if (ok) {
                        safePost({
                            abx: 'bet',
                            side: side,
                            amount: amt,
                            ts: Date.now()
                        });
                        result = 'ok';
                    } else {
                        var reason = (rawResult && rawResult.error) ? String(rawResult.error) : (rawResult === false ? 'cwBet returned false' : ('cwBet returned ' + String(rawResult)));
                        safePost({
                            abx: 'bet_error',
                            side: side,
                            amount: amt,
                            error: reason,
                            ts: Date.now()
                        });
                        result = 'fail:' + reason;
                    }
                } catch (err) {
                    safePost({
                        abx: 'bet_error',
                        side: side,
                        amount: amt,
                        error: String(err && err.message || err),
                        ts: Date.now()
                    });
                    result = 'fail:' + String(err && err.message || err);
                }
                if (typeof job.resolve === 'function') {
                    try {
                        job.resolve(result);
                    } catch (_) {}
                }
            }
            _processingBetQueue = false;
        }

        window.__cw_bet = async function (side, amount) {
            try {
                side = normalizeSide(side);
                var amt = Math.max(0, Math.floor(Number(amount) || 0));
                BET_QUEUE.push({
                    side: side,
                    amt: amt,
                    resolve: null
                });
                processBetQueue();
                // Báo OK ngay cho C#, không chờ kết quả thực tế
                return 'ok';
            } catch (err) {
                safePost({
                    abx: 'bet_error',
                    side: side,
                    amount: amount,
                    error: String(err && err.message || err),
                    ts: Date.now()
                });
                return 'fail:' + String(err && err.message || err);
            }
        };

    })();

})();
