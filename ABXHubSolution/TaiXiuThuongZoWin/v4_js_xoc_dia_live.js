(async () => {
    'use strict';
    console.log('[CW] xoc-dia-live panel script init');
    /* =========================================================
    CanvasWatch + MoneyMap + BetMap + TextMap + Scan200Text
    + TK Sequence (restore): LEFT→RIGHT columns, zig-zag T↓/B↑
    (Compat build: no spread operator, no optional chaining)
    + FIX: totals TÀI/XỈU by (x,tail) — TÀI x=591, XỈU x=973,
    tail = 'XDLive/Canvas/Bg/footer/listLabel/totalBet'
    + STANDARDIZED EXPORTS: moneyTailList(), pickByXTail()
    ========================================================= */
    // Luu y: KHONG bo comment dong nay vi root chua duoc tao o dau file.
    //root.style.display='none';

    var NS = '__cw_allin_one_v9_textmap_compat_TKFIX_xTail_STD_v2';
    window.__cw_patch_ver = 'cw-r31-20260304-iconseq-rolling50-sidefix';
    try {
        if (!window.__cw_last_scan_text)
            window.__cw_last_scan_text = [];
        if (!window.__cw_last_scan_summary) {
            window.__cw_last_scan_summary = {
                labels: 0,
                candidates: 0,
                invalidRect: 0,
                adjusted: 0,
                out: 0,
                ts: 0,
                status: 'idle'
            };
        }
        if (!window.__cw_last_scan_money)
            window.__cw_last_scan_money = [];
        if (!window.__cw_last_scan_money_summary) {
            window.__cw_last_scan_money_summary = {
                labels: 0,
                moneyCandidate: 0,
                invalidRect: 0,
                adjusted: 0,
                out: 0,
                ts: 0,
                status: 'idle'
            };
        }
    } catch (e0) {}

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

    // SỬA: không được đụng trực tiếp biến global cc khi cc chưa tồn tại,
    // luôn đi qua window.cc để tránh ReferenceError khi inject sớm.
    async function waitForBootReady(timeoutMs) {
        timeoutMs = Number(timeoutMs) || 15000;
        var t0 = Date.now();
        while ((Date.now() - t0) < timeoutMs) {
            try {
                var hasBody = !!document.body;
                var hasCc = !!(window.cc && window.cc.director && typeof window.cc.director.getScene === 'function');
                var hasScene = false;
                if (hasCc) {
                    try {
                        hasScene = !!window.cc.director.getScene();
                    } catch (_) {
                        hasScene = false;
                    }
                }
                if (hasBody && hasCc && hasScene)
                    return true;
            } catch (_) {}
            await new Promise(function (r) {
                setTimeout(r, 120);
            });
        }
        return false;
    }

    var _bootReady = await waitForBootReady(15000);
    if (!_bootReady) {
        console.warn('[CW] boot skipped: body/cc/scene not ready in time');
        return;
    }

    try {
        if (window[NS] && window[NS].teardown) {
            window[NS].teardown();
        }
    } catch (e) {}

    /* ---------------- utils ---------------- */
    var V2 = (cc.v2 || cc.Vec2);
    var sleep = function (ms) {
        return new Promise(function (r) {
            setTimeout(r, ms);
        });
    };
    function cwLog() {
        try {
            console.log.apply(console, arguments);
        } catch (e) {}
        // Mirror len top console de tranh mat log do khac context/frame.
        try {
            if (window.top && window.top !== window && window.top.console && typeof window.top.console.log === 'function')
                window.top.console.log.apply(window.top.console, arguments);
        } catch (e2) {}
    }
    function cwWarn() {
        try {
            console.warn.apply(console, arguments);
        } catch (e) {}
        try {
            if (window.top && window.top !== window && window.top.console && typeof window.top.console.warn === 'function')
                window.top.console.warn.apply(window.top.console, arguments);
        } catch (e2) {}
    }
    function cwError() {
        try {
            console.error.apply(console, arguments);
        } catch (e) {}
        try {
            if (window.top && window.top !== window && window.top.console && typeof window.top.console.error === 'function')
                window.top.console.error.apply(window.top.console, arguments);
        } catch (e2) {}
    }
    function cwTable(rows) {
        try {
            console.table(rows);
        } catch (e) {
            try {
                console.log(rows);
            } catch (e2) {}
        }
        try {
            if (window.top && window.top !== window && window.top.console) {
                if (typeof window.top.console.table === 'function')
                    window.top.console.table(rows);
                else if (typeof window.top.console.log === 'function')
                    window.top.console.log(rows);
            }
        } catch (e3) {}
    }
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
    function _mkV2(x, y) {
        try {
            if (window.cc && typeof cc.v2 === 'function')
                return cc.v2(x, y);
        } catch (e) {}
        try {
            if (window.cc && cc.Vec2)
                return new cc.Vec2(x, y);
        } catch (e2) {}
        return {
            x: x,
            y: y
        };
    }
    function _num(v, dft) {
        v = Number(v);
        return isFinite(v) ? v : (dft || 0);
    }
    function _rectOk(r) {
        if (!r)
            return false;
        return isFinite(r.x) && isFinite(r.y) && isFinite(r.w) && isFinite(r.h) && r.w > 0.5 && r.h > 0.5;
    }
    function _nodeSize(node) {
        var w = 0,
        h = 0;
        try {
            var cs = node.getContentSize ? node.getContentSize() : (node._contentSize || null);
            if (cs) {
                w = _num(cs.width, 0);
                h = _num(cs.height, 0);
            }
        } catch (e) {}
        if (w <= 0 || h <= 0) {
            try {
                var ui = (window.cc && cc.UITransform) ? getComp(node, cc.UITransform) : null;
                if (ui && ui.contentSize) {
                    w = Math.max(w, _num(ui.contentSize.width, 0));
                    h = Math.max(h, _num(ui.contentSize.height, 0));
                }
            } catch (e2) {}
        }
        return {
            w: w,
            h: h
        };
    }
    function _nodeWorldAr(node) {
        try {
            return node.convertToWorldSpaceAR(_mkV2(0, 0));
        } catch (e) {}
        try {
            if (window.cc && typeof cc.v3 === 'function')
                return node.convertToWorldSpaceAR(cc.v3(0, 0, 0));
        } catch (e2) {}
        return null;
    }
    function _nodeToScreen(node) {
        try {
            if (!window.cc || !cc.Camera || !cc.Camera.findCamera || !cc.view)
                return null;
            var cam = cc.Camera.findCamera(node);
            if (!cam)
                return null;
            var wp = _nodeWorldAr(node);
            if (!wp)
                return null;
            var sp = cam.worldToScreen(wp);
            var fs = cc.view.getFrameSize ? cc.view.getFrameSize() : null;
            var vs = cc.view.getVisibleSize ? cc.view.getVisibleSize() : null;
            if (!fs || !vs)
                return null;
            var sx = _num(fs.width, 1) / Math.max(1, _num(vs.width, 1));
            var sy = _num(fs.height, 1) / Math.max(1, _num(vs.height, 1));
            return {
                x: _num(sp && sp.x, 0) * sx,
                y: _num(sp && sp.y, 0) * sy
            };
        } catch (e) {}
        return null;
    }
    function wRect(node) {
        try {
            // Fast path: giong ban v2 de giam tai CPU khi scan label lien tuc.
            var p = _nodeWorldAr(node);
            var cs = null;
            try {
                cs = node && node.getContentSize ? node.getContentSize() : (node && node._contentSize ? node._contentSize : null);
            } catch (e0) {}
            var rFast = {
                x: _num(p && p.x, 0),
                y: _num(p && p.y, 0),
                w: _num(cs && cs.width, 0),
                h: _num(cs && cs.height, 0)
            };
            if (_rectOk(rFast))
                return rFast;

            // Fallback nhe: world AABB neu runtime ho tro.
            var bb = null;
            try {
                if (node && typeof node.getBoundingBoxToWorld === 'function')
                    bb = node.getBoundingBoxToWorld();
            } catch (e1) {}
            if (!bb) {
                try {
                    var ui = (window.cc && cc.UITransform) ? getComp(node, cc.UITransform) : null;
                    if (ui && typeof ui.getBoundingBoxToWorld === 'function')
                        bb = ui.getBoundingBoxToWorld();
                } catch (e2) {}
            }
            if (bb) {
                var r0 = {
                    x: _num(bb.x, 0),
                    y: _num(bb.y, 0),
                    w: _num(bb.width, 0),
                    h: _num(bb.height, 0)
                };
                if (_rectOk(r0))
                    return r0;
            }

            return {
                x: 0,
                y: 0,
                w: 0,
                h: 0
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
    var _labelsCache = {
        ts: 0,
        rows: null
    };
    var _moneyRectsCache = {
        ts: 0,
        rows: null
    };
    function collectLabels(opt) {
        opt = opt || {};
        var noCache = !!opt.noCache;
        var ttlMs = Number(opt.ttlMs);
        if (!isFinite(ttlMs) || ttlMs < 0)
            ttlMs = 260;
        var now = Date.now();
        if (!noCache && _labelsCache.rows && (now - _labelsCache.ts) <= ttlMs) {
            return _labelsCache.rows.slice();
        }
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
                        node: n,
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
        if (!noCache) {
            _labelsCache.ts = Date.now();
            _labelsCache.rows = out;
        }
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
        try {
            // 1) Nếu game có progress bar nội bộ thì dùng luôn (nếu hàm tồn tại)
            var bars = null;
            if (typeof sampleProgressBars === 'function') {
                bars = sampleProgressBars();
            }
            if (bars && bars.length > 0) {
                var b = bars[0];
                var pr = null;
                if (b.max > 0 && b.val >= 0) {
                    pr = b.val / b.max;
                }
                pr = clamp01(pr);
                if (pr != null)
                    return pr;
            }

            // 2) Ưu tiên dùng label CountDownNode của Tài Xỉu Live
            var labels = collectLabels();
            if (!labels || labels.length === 0)
                return null;

            var COUNTDOWN_TAIL = 'MiniGameScene/MiniGameNode/TopUI/TxGameLive/Main/borderTabble/nodeFont/CountDownNode';
            var cdTailL = COUNTDOWN_TAIL.toLowerCase();
            var sec = null;

            for (var i = 0; i < labels.length; i++) {
                var l = labels[i];
                var tl = String(l.tail || '').toLowerCase();
                if (!tl.endsWith(cdTailL))
                    continue;

                var txt = String(l.text || '').trim();
                if (!txt)
                    continue;

                var m = txt.match(/(\d{1,2})/);
                if (!m)
                    continue;

                var s = parseInt(m[1], 10);
                if (isNaN(s))
                    continue;

                sec = s;
                break; // lấy 1 label duy nhất là đủ
            }

            if (sec != null) {
                if (sec < 0)
                    sec = 0;
                if (sec > 45)
                    sec = 45; // theo yêu cầu: full thanh = 45s
                var pr2 = sec / 45;
                return clamp01(pr2);
            }

            // 3) Fallback cũ: heuristic chung theo vị trí text đếm ngược
            var best = null;
            var bestScore = -1;
            for (var j = 0; j < labels.length; j++) {
                var l2 = labels[j];
                var txt2 = String(l2.text || '').trim();
                if (!/^\d{1,2}$/.test(txt2))
                    continue;

                var sec2 = parseInt(txt2, 10);
                if (isNaN(sec2) || sec2 < 0 || sec2 > 60)
                    continue;

                var score = 0;
                var cx = (l2.x || 0) + (l2.w || 0) / 2;
                var cy = (l2.y || 0) + (l2.h || 0) / 2;

                if (cx > 400 && cx < 1100)
                    score += 2;
                if (cy > 400 && cy < 800)
                    score += 2;

                if (score > bestScore) {
                    bestScore = score;
                    best = {
                        sec: sec2
                    };
                }
            }

            if (best) {
                var total = 45;
                var pr3 = best.sec / total;
                return clamp01(pr3);
            }
        } catch (e) {
            console.log('collectProgress error', e);
        }
        return null;
    }

    /* ---------------- MoneyMap ---------------- */
    function buildMoneyRects(opt) {
        opt = opt || {};
        var noCache = !!opt.noCache;
        var ttlMs = Number(opt.ttlMs);
        if (!isFinite(ttlMs) || ttlMs < 0)
            ttlMs = 220;
        var now = Date.now();
        if (!noCache && _moneyRectsCache.rows && (now - _moneyRectsCache.ts) <= ttlMs) {
            return _moneyRectsCache.rows.slice();
        }
        var ls = (opt.labels && typeof opt.labels.length === 'number') ? opt.labels : collectLabels(opt.labelOpt || null),
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
        if (!noCache) {
            _moneyRectsCache.ts = Date.now();
            _moneyRectsCache.rows = out;
        }
        return out;
    }
    function buildMoneyRectsForMap() {
        var ls = collectLabels(),
        out = [];
        var st = {
            labels: ls.length,
            moneyCandidate: 0,
            rectInvalid: 0,
            rectRecovered: 0,
            rectProjected: 0,
            rectAdjusted: 0,
            rectClamped: 0,
            syntheticPlaced: 0,
            out: 0
        };
        for (var i = 0; i < ls.length; i++) {
            var L = ls[i];
            var s = (L.text || '').trim();
            if (!isMoneyText(s))
                continue;
            st.moneyCandidate++;
            var x = Math.round(L.x),
            y = Math.round(L.y),
            w = Math.round(L.w),
            h = Math.round(L.h);
            var rr = {
                x: x,
                y: y,
                w: w,
                h: h
            };
            if (!isRenderableRect(rr)) {
                st.rectInvalid++;
                var recovered = null;
                try {
                    var anc = L.node || null;
                    var hop = 0;
                    while (anc && hop < 10) {
                        var ar = wRect(anc);
                        if (isRenderableRect(ar)) {
                            recovered = ar;
                            break;
                        }
                        anc = anc.parent || anc._parent || null;
                        hop++;
                    }
                } catch (eA) {}
                if (recovered) {
                    x = Math.round(recovered.x);
                    y = Math.round(recovered.y);
                    w = Math.round(recovered.w);
                    h = Math.round(recovered.h);
                    st.rectRecovered++;
                } else {
                    if (!isFinite(x))
                        x = 0;
                    if (!isFinite(y))
                        y = 0;
                    if (!isFinite(w) || w < 2)
                        w = Math.max(16, Math.min(260, s.length * 9));
                    if (!isFinite(h) || h < 2)
                        h = 18;
                    var projectedHit = false;
                    try {
                        var sp2 = _nodeToScreen(L.node);
                        if (sp2) {
                            x = Math.round(sp2.x - w * 0.5);
                            y = Math.round(sp2.y - h * 0.5);
                            st.rectProjected++;
                            projectedHit = true;
                        }
                    } catch (eP) {}
                    if (!projectedHit && (x === 0 && y === 0)) {
                        var idxDbg = st.rectAdjusted;
                        var rowH = 22;
                        var startY = 90;
                        var rowsMax = Math.max(10, Math.floor((innerHeight - startY - 12) / rowH));
                        var col = Math.floor(idxDbg / rowsMax);
                        var row = idxDbg % rowsMax;
                        x = 8 + col * 290;
                        y = startY + row * rowH;
                        st.syntheticPlaced++;
                    }
                    var maxX = Math.max(0, innerWidth - w - 2);
                    var maxY = Math.max(0, innerHeight - h - 2);
                    var x0 = x,
                    y0 = y;
                    x = Math.max(0, Math.min(maxX, x));
                    y = Math.max(0, Math.min(maxY, y));
                    if (x !== x0 || y !== y0)
                        st.rectClamped++;
                    st.rectAdjusted++;
                }
            }
            out.push({
                txt: s,
                val: moneyOf(s),
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
        st.out = out.length;
        try {
            window.__cw_moneyStats = st;
        } catch (_) {}
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
    function isRenderableRect(r) {
        if (!r)
            return false;
        if (!isFinite(r.x) || !isFinite(r.y) || !isFinite(r.w) || !isFinite(r.h))
            return false;
        if (r.w < 2 || r.h < 2)
            return false;
        if ((r.x + r.w) < -4 || (r.y + r.h) < -4)
            return false;
        if (r.x > innerWidth + 4 || r.y > innerHeight + 4)
            return false;
        return true;
    }
    function collectDomTextRects(limit, opt) {
        limit = Number(limit) || 200;
        opt = opt || {};
        var out = [];
        var seen = {};
        var maxNodes = Number(opt.domMaxNodes);
        if (!isFinite(maxNodes) || maxNodes < 100)
            maxNodes = 1200;
        var rootEl = null;
        try {
            if (opt.domRoot && opt.domRoot.nodeType === 1)
                rootEl = opt.domRoot;
        } catch (_) {}
        if (!rootEl) {
            try {
                var cvs = document.querySelector('canvas');
                if (cvs) {
                    var p = cvs.parentElement || null;
                    rootEl = (p && p !== document.body) ? p : cvs;
                }
            } catch (_) {}
        }
        if (!rootEl && opt.allowBodyScan) {
            try {
                rootEl = document.body;
            } catch (_) {}
        }
        if (!rootEl)
            return out;
        try {
            var scanned = 0;
            var showText = (typeof NodeFilter !== 'undefined' && NodeFilter.SHOW_TEXT) ? NodeFilter.SHOW_TEXT : 4;
            var walker = (document.createTreeWalker ? document.createTreeWalker(rootEl, showText, null, false) : null);
            var tnode = walker ? walker.nextNode() : null;
            while (tnode) {
                if (out.length >= limit)
                    break;
                scanned++;
                if (scanned > maxNodes)
                    break;
                var el = tnode.parentElement || tnode.parentNode;
                if (!el || !el.getBoundingClientRect) {
                    tnode = walker.nextNode();
                    continue;
                }
                try {
                    if (el.id === '__cw_root_allin') {
                        tnode = walker.nextNode();
                        continue;
                    }
                    if (el.closest && el.closest('#__cw_root_allin')) {
                        tnode = walker.nextNode();
                        continue;
                    }
                } catch (e0) {}
                var tag = '';
                try {
                    tag = String((el.tagName || 'el')).toLowerCase();
                } catch (e1) {
                    tag = 'el';
                }
                if (tag === 'script' || tag === 'style' || tag === 'noscript' || tag === 'canvas' || tag === 'svg') {
                    tnode = walker.nextNode();
                    continue;
                }
                var txt = '';
                try {
                    txt = String(tnode.nodeValue || '').trim();
                } catch (e2) {
                    txt = '';
                }
                if (!txt) {
                    tnode = walker.nextNode();
                    continue;
                }
                if (txt.length > 160)
                    txt = txt.slice(0, 160);
                if (!isTextCandidate(txt)) {
                    tnode = walker.nextNode();
                    continue;
                }
                var r = el.getBoundingClientRect();
                if (!r) {
                    tnode = walker.nextNode();
                    continue;
                }
                var x = Math.round(_num(r.left, 0));
                var y = Math.round(_num(r.top, 0));
                var w = Math.round(_num(r.width, 0));
                var h = Math.round(_num(r.height, 0));
                if (!isRenderableRect({
                        x: x,
                        y: y,
                        w: w,
                        h: h
                    })) {
                    tnode = walker.nextNode();
                    continue;
                }
                var key = txt + '|' + x + '|' + y + '|' + w + '|' + h;
                if (seen[key]) {
                    tnode = walker.nextNode();
                    continue;
                }
                seen[key] = 1;
                var id = '';
                try {
                    id = el.id ? ('#' + el.id) : '';
                } catch (e3) {}
                out.push({
                    text: txt,
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
                    tail: 'dom:' + tag + id,
                    tl: 'dom:' + tag
                });
                tnode = walker.nextNode();
            }
            if (!walker && rootEl.querySelectorAll) {
                var all = rootEl.querySelectorAll('*');
                for (var i = 0; i < all.length; i++) {
                    if (out.length >= limit)
                        break;
                    scanned++;
                    if (scanned > maxNodes)
                        break;
                    var el2 = all[i];
                    if (!el2 || !el2.getBoundingClientRect)
                        continue;
                    try {
                        if (el2.id === '__cw_root_allin')
                            continue;
                        if (el2.closest && el2.closest('#__cw_root_allin'))
                            continue;
                    } catch (_) {}
                    var txt2 = '';
                    try {
                        txt2 = String(el2.textContent || '').trim();
                    } catch (_) {
                        txt2 = '';
                    }
                    if (!txt2 || txt2.length > 160)
                        continue;
                    if (!isTextCandidate(txt2))
                        continue;
                    var r2 = el2.getBoundingClientRect();
                    if (!r2)
                        continue;
                    var x2 = Math.round(_num(r2.left, 0));
                    var y2 = Math.round(_num(r2.top, 0));
                    var w2 = Math.round(_num(r2.width, 0));
                    var h2 = Math.round(_num(r2.height, 0));
                    if (!isRenderableRect({
                            x: x2,
                            y: y2,
                            w: w2,
                            h: h2
                        }))
                        continue;
                    var key2 = txt2 + '|' + x2 + '|' + y2 + '|' + w2 + '|' + h2;
                    if (seen[key2])
                        continue;
                    seen[key2] = 1;
                    out.push({
                        text: txt2,
                        x: x2,
                        y: y2,
                        w: w2,
                        h: h2,
                        n: {
                            x: x2 / innerWidth,
                            y: y2 / innerHeight,
                            w: w2 / innerWidth,
                            h: h2 / innerHeight
                        },
                        tail: 'dom:el',
                        tl: 'dom:el'
                    });
                }
            }
        } catch (e5) {}
        return out;
    }
    function buildTextRects(opts) {
        opts = opts || {};
        var allowDomFallback = !!opts.allowDomFallback;
        var domLimit = Number(opts.domLimit) || 200;
        var ls = collectLabels(),
        out = [];
        var st = {
            labels: ls.length,
            textCandidate: 0,
            rectInvalid: 0,
            rectRecovered: 0,
            rectProjected: 0,
            rectAdjusted: 0,
            rectClamped: 0,
            domFallback: 0,
            syntheticPlaced: 0,
            out: 0
        };
        for (var i = 0; i < ls.length; i++) {
            var L = ls[i];
            var s = (L.text || '').trim();
            if (!isTextCandidate(s))
                continue;
            st.textCandidate++;
            var x = Math.round(L.x),
            y = Math.round(L.y),
            w = Math.round(L.w),
            h = Math.round(L.h);
            var rr = {
                x: x,
                y: y,
                w: w,
                h: h
            };
            if (!isRenderableRect(rr)) {
                st.rectInvalid++;
                // Thu tim rect hop le tu node cha gan nhat (nhieu Label co size 0 nhung parent co size dung).
                var recovered = null;
                try {
                    var anc = L.node || null;
                    var hop = 0;
                    while (anc && hop < 10) {
                        var ar = wRect(anc);
                        if (isRenderableRect(ar)) {
                            recovered = ar;
                            break;
                        }
                        anc = anc.parent || anc._parent || null;
                        hop++;
                    }
                } catch (eA) {}
                if (recovered) {
                    x = Math.round(recovered.x);
                    y = Math.round(recovered.y);
                    w = Math.round(recovered.w);
                    h = Math.round(recovered.h);
                    st.rectRecovered++;
                } else {
                // Giu hanh vi gan ban cu: khong bo item, thu fallback kich thuoc de van render duoc box debug.
                if (!isFinite(x))
                    x = 0;
                if (!isFinite(y))
                    y = 0;
                if (!isFinite(w) || w < 2)
                    w = Math.max(16, Math.min(360, s.length * 7));
                if (!isFinite(h) || h < 2)
                    h = 18;
                // Thu project vi tri node len screen de co x/y that.
                var projectedHit = false;
                try {
                    var sp2 = _nodeToScreen(L.node);
                    if (sp2) {
                        x = Math.round(sp2.x - w * 0.5);
                        y = Math.round(sp2.y - h * 0.5);
                        st.rectProjected++;
                        projectedHit = true;
                    }
                } catch (eP) {}
                // Neu van khong co toa do, xep theo luoi debug de khung khong chong len nhau.
                if (!projectedHit && (x === 0 && y === 0)) {
                    var idxDbg = st.rectAdjusted;
                    var rowH = 22;
                    var startY = 90;
                    var rowsMax = Math.max(10, Math.floor((innerHeight - startY - 12) / rowH));
                    var col = Math.floor(idxDbg / rowsMax);
                    var row = idxDbg % rowsMax;
                    x = 8 + col * 290;
                    y = startY + row * rowH;
                    st.syntheticPlaced++;
                }
                // Dua box vao trong viewport de TextMap chac chan nhin thay.
                var maxX = Math.max(0, innerWidth - w - 2);
                var maxY = Math.max(0, innerHeight - h - 2);
                var x0 = x,
                y0 = y;
                x = Math.max(0, Math.min(maxX, x));
                y = Math.max(0, Math.min(maxY, y));
                if (x !== x0 || y !== y0)
                    st.rectClamped++;
                st.rectAdjusted++;
                }
            }
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
        // Neu tat ca text Cocos deu vo toa do (0,0) thi fallback sang DOM text de van co box tren man hinh.
        if (allowDomFallback && ((st.textCandidate > 0 && st.rectInvalid === st.textCandidate && st.rectRecovered === 0 && st.rectProjected === 0) || out.length === 0)) {
            var domRows = collectDomTextRects(domLimit, opts);
            if (domRows && domRows.length) {
                out = domRows;
                st.domFallback = domRows.length;
            }
        }
        st.out = out.length;
        try {
            window.__cw_textStats = st;
        } catch (e) {}
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

    // NEW: đọc chuỗi kết quả Tài/Xỉu từ dãy icLspThugonTai1..15
    function readTxLineSeq() {
        try {
            if (!window.cc || !cc.director || !cc.director.getScene)
                return {
                    seq: '',
                    which: null,
                    cols: [],
                    cells: []
                };

            var cells = [];
            walkNodes(function (n) {
                if (!n)
                    return;
                // dùng active() sau này đã khai báo, nhưng là function declaration nên được hoist
                if (typeof active === 'function' && !active(n))
                    return;

                var sp = getComp(n, cc.Sprite);
                if (!sp || !sp.spriteFrame)
                    return;

                var sfName = (sp.spriteFrame && sp.spriteFrame.name) ? String(sp.spriteFrame.name).toLowerCase() : '';
                var name = String(n.name || '');
                var tail = tailOf(n, 16).toLowerCase();

                // chỉ lấy các node icLspThugonTai* trong vùng listhistory
                if (!/iclspthugontai\d+/i.test(name) &&
                    tail.indexOf('bordertabble/lsp/listhistory/iclspthugontai') === -1)
                    return;

                var r = wRect(n);
                cells.push({
                    node: n,
                    name: name,
                    sprite: sfName,
                    x: r.x,
                    y: r.y,
                    w: r.w,
                    h: r.h
                });
            });

            if (!cells.length) {
                return {
                    seq: '',
                    which: null,
                    cols: [],
                    cells: []
                };
            }

            // Lọc theo hàng chính bằng median Y
            var ys = [];
            var i;
            for (i = 0; i < cells.length; i++)
                ys.push(cells[i].y);
            ys.sort(function (a, b) {
                return a - b;
            });
            var midY = ys[Math.floor(ys.length / 2)] || 0;
            var thrY = 24;

            var row = [];
            for (i = 0; i < cells.length; i++) {
                var c = cells[i];
                if (Math.abs(c.y - midY) <= thrY)
                    row.push(c);
            }
            if (!row.length)
                row = cells.slice();

            // Sắp xếp TRÁI → PHẢI
            row.sort(function (a, b) {
                return a.x - b.x;
            });

            var seq = '';
            for (i = 0; i < row.length; i++) {
                var s = row[i].sprite || '';
                if (s.indexOf('taiden') !== -1) {
                    seq += 'T';
                } else if (s.indexOf('xiutrang') !== -1) {
                    seq += 'X';
                }
                // các sprite không khớp T/X thì bỏ qua, không thêm '?'
            }

            return {
                seq: seq,
                which: 'tx_line',
                cols: [{
                        cx: row.length ? (row[0].x + row[row.length - 1].x) / 2 : 0,
                        items: row
                    }
                ],
                cells: row
            };
        } catch (e) {
            return {
                seq: '',
                which: null,
                cols: [],
                cells: []
            };
        }
    }

    // OLD logic: đọc TK theo bảng số 0–4 (thongke1/2), giữ lại làm fallback
    function readTKSeqFromDigits() {
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

    // NEW wrapper: ưu tiên chuỗi T/X, nếu không có thì fallback TK số
    function readTKSeq() {
        var tx = readTxLineSeq();
        if (tx && tx.seq && tx.seq.length)
            return tx;
        return readTKSeqFromDigits();
    }

    // Strict sequence source for Canvas Watch:
    // use __cw_icon_seq.seq_oldest_to_latest only.
    var _iconSeqBuildAt = 0;
    var _iconSeqRolling = []; // oldest -> latest
    var ICON_SEQ_MAX = 50;

    function _normalizeTxSeq(seq) {
        seq = String(seq || '').toUpperCase().replace(/[^TX]/g, '');
        return seq;
    }

    function _seqFromWinStrict(w) {
        try {
            var iconSeq = w && w.__cw_icon_seq;
            if (!iconSeq || typeof iconSeq !== 'object')
                return '';
            return _normalizeTxSeq(iconSeq.seq_oldest_to_latest || '');
        } catch (_) {}
        return '';
    }

    function _findSeqAcrossWindows() {
        try {
            var seen = [];
            function walkWin(w) {
                if (!w)
                    return '';
                try {
                    if (seen.indexOf(w) !== -1)
                        return '';
                    seen.push(w);
                } catch (_) {
                    return '';
                }

                var seq = _seqFromWinStrict(w);
                if (seq)
                    return seq;

                try {
                    if (w.parent && w.parent !== w) {
                        seq = walkWin(w.parent);
                        if (seq)
                            return seq;
                    }
                } catch (_) {}

                try {
                    if (w.top) {
                        seq = walkWin(w.top);
                        if (seq)
                            return seq;
                    }
                } catch (_) {}

                try {
                    var len = w.frames ? w.frames.length : 0;
                    for (var i = 0; i < len; i++) {
                        seq = walkWin(w.frames[i]);
                        if (seq)
                            return seq;
                    }
                } catch (_) {}
                return '';
            }
            return walkWin(window) || '';
        } catch (_) {}
        return '';
    }

    function _nodePathFullLocal(n) {
        var arr = [];
        var cur = n;
        var guard = 0;
        while (cur && guard++ < 200) {
            arr.push(String(cur.name || ''));
            cur = cur.parent || cur._parent || null;
        }
        return arr.reverse().join('/');
    }

    function _readNodeTextLocal(n) {
        try {
            var lb = getComp(n, cc.Label);
            if (lb && lb.string != null)
                return String(lb.string).trim();
        } catch (_) {}
        try {
            var rt = getComp(n, cc.RichText);
            if (rt && rt.string != null)
                return String(rt.string).trim();
        } catch (_) {}
        return '';
    }

    function buildIconSeqFromSceneLocal(force) {
        try {
            var now = Date.now();
            if (!force && (now - _iconSeqBuildAt) < 800)
                return _seqFromWinStrict(window);
            _iconSeqBuildAt = now;

            var rows = [];
            var dbg = {
                labels_total: 0,
                labels_matched: 0,
                nodes_matched: 0,
                side_from_tail: 0,
                val_from_txt: 0,
                val_from_dice: 0,
                rolling_appended: 0,
                rolling_updated: 0,
                rolling_trimmed: 0,
                rolling_reset: ''
            };
            function foldVi(s) {
                s = String(s || '');
                try {
                    s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                } catch (_) {}
                s = s.replace(/\u0111/g, 'd').replace(/\u0110/g, 'D');
                return s.toLowerCase();
            }
            function pushRow(txt, path, src) {
                txt = String(txt || '').trim();
                path = String(path || '').trim();
                if (!path)
                    return;

                // 1) Side uu tien tu tail: ...#id&Tài(...)/lbl_sum hoặc ...&Xỉu(...)/lbl_sum
                var pathDecoded = path;
                try {
                    pathDecoded = decodeURIComponent(path);
                } catch (_) {}
                var pathFold = foldVi(pathDecoded);
                var side = '';
                // Parse side ben trong segment "&<side>(...)" de chiu duoc ca unicode/mojibake.
                var mSide = pathFold.match(/&([^\/()]+)\(/);
                if (mSide && mSide[1]) {
                    var token = String(mSide[1]).replace(/[^a-z]/g, '');
                    if (token.charAt(0) === 't')
                        side = 'T';
                    else if (token.charAt(0) === 'x')
                        side = 'X';
                }
                if (!side) {
                    if (pathFold.indexOf('&tai(') !== -1)
                        side = 'T';
                    else if (pathFold.indexOf('&xiu(') !== -1)
                        side = 'X';
                }
                if (side) {
                    dbg.side_from_tail++;
                }

                // 2) Val uu tien tu txt (chi lay so tong hop)
                var val = NaN;
                var txtNums = String(txt).match(/\d+/g) || [];
                if (txtNums.length === 1) {
                    val = Number(txtNums[0]);
                    if (isFinite(val))
                        dbg.val_from_txt++;
                } else if (txtNums.length > 1) {
                    // Neu txt co dang "2-6-5" thi tinh tong xuc xac
                    var mDiceTxt = String(txt).match(/(\d+)\s*-\s*(\d+)\s*-\s*(\d+)/);
                    if (mDiceTxt) {
                        val = Number(mDiceTxt[1]) + Number(mDiceTxt[2]) + Number(mDiceTxt[3]);
                        if (isFinite(val))
                            dbg.val_from_dice++;
                    }
                }

                // 3) Fallback val tu tail "(a-b-c)" neu txt khong ra so
                if (!isFinite(val)) {
                    var mDiceTail = pathDecoded.match(/\((\d+)\s*-\s*(\d+)\s*-\s*(\d+)\)/);
                    if (mDiceTail) {
                        val = Number(mDiceTail[1]) + Number(mDiceTail[2]) + Number(mDiceTail[3]);
                        if (isFinite(val))
                            dbg.val_from_dice++;
                    }
                }

                // Neu khong co side va cung khong co val thi bo qua row loi
                if (!side && !isFinite(val))
                    return;

                var tx = side || (val > 10 ? 'T' : 'X');
                var mSess = pathDecoded.match(/#\s*(\d+)/);
                if (!mSess)
                    mSess = path.match(/(?:#|%23)(\d+)/i);
                var session = mSess ? Number(mSess[1]) : NaN;
                var score = (side ? 100 : 0) + (isFinite(val) ? 10 : 0) + (src === 'labels' ? 1 : 0);
                rows.push({
                    session: session,
                    val: val,
                    tx: tx,
                    txt: txt,
                    path: path,
                    src: src || '',
                    score: score
                });
            }

            // 1) Uu tien nguon labels (giong logic scan text da tung lay duoc icon_results)
            try {
                if (typeof collectLabels === 'function') {
                    var labs = collectLabels() || [];
                    dbg.labels_total = labs.length;
                    for (var li = 0; li < labs.length; li++) {
                        var L = labs[li] || {};
                        var tail = String(L.tail || L.tl || '');
                        var tailL = tail.toLowerCase();
                        if (tailL.indexOf('/buttons/icon_results/') === -1)
                            continue;
                        if (!/\/lbl_sum$/i.test(tailL))
                            continue;
                        dbg.labels_matched++;
                        pushRow(L.text, tail, 'labels');
                    }
                }
            } catch (_) {}

            // 2) Fallback nguon node path neu labels khong co
            if ((!rows || !rows.length) && window.cc && cc.director && cc.director.getScene && typeof walkNodes === 'function') {
                walkNodes(function (n) {
                    if (!n)
                        return;
                    try {
                        if (typeof active === 'function' && !active(n))
                            return;
                    } catch (_) {}

                    var path = _nodePathFullLocal(n);
                    var pathL = String(path || '').toLowerCase();
                    if (!/\/buttons\/icon_results\/[^/]+\/lbl_sum$/i.test(pathL))
                        return;

                    var txt = _readNodeTextLocal(n);
                    dbg.nodes_matched++;
                    pushRow(txt, path, 'nodes');
                });
            }

            if (!rows.length) {
                window.__cw_icon_seq_debug = {
                    reason: 'no_rows',
                    dbg: dbg,
                    ts: Date.now()
                };
                return '';
            }

            var map = {};
            var uniq = [];
            for (var i = 0; i < rows.length; i++) {
                var r = rows[i];
                var key = isFinite(r.session) ? ('s:' + r.session) : ('p:' + r.path);
                if (map[key] == null) {
                    map[key] = uniq.length;
                    uniq.push(r);
                    continue;
                }
                // Cung session thi giu row co do tin cay cao hon (uu tien side tu tail).
                var idxKeep = map[key];
                var old = uniq[idxKeep];
                var oldScore = Number(old && old.score) || 0;
                var newScore = Number(r && r.score) || 0;
                if (newScore > oldScore)
                    uniq[idxKeep] = r;
            }

            var withSession = uniq.filter(function (x) {
                return isFinite(x.session);
            }).sort(function (a, b) {
                return a.session - b.session;
            });

            function cloneRow(x) {
                return {
                    session: x.session,
                    val: x.val,
                    tx: x.tx,
                    txt: x.txt,
                    path: x.path,
                    src: x.src || '',
                    score: x.score
                };
            }

            // Neu tick hien tai chua doc duoc snapshot, giu nguyen rolling neu da co.
            if (!withSession.length) {
                if (_iconSeqRolling.length) {
                    var keepDesc = _iconSeqRolling.slice().sort(function (a, b) {
                        return b.session - a.session;
                    });
                    var keepSeqOldToNew = '';
                    for (i = 0; i < _iconSeqRolling.length; i++)
                        keepSeqOldToNew += _iconSeqRolling[i].tx;
                    var keepSeqNewToOld = '';
                    for (i = 0; i < keepDesc.length; i++)
                        keepSeqNewToOld += keepDesc[i].tx;

                    window.__cw_icon_seq = {
                        source: 'auto_scene_icon_results',
                        seq_oldest_to_latest: keepSeqOldToNew,
                        seq_latest_to_oldest: keepSeqNewToOld,
                        count: _iconSeqRolling.length,
                        ts: Date.now(),
                        rows_latest_to_oldest: keepDesc,
                        dbg: dbg
                    };
                    window.__cw_icon_seq_debug = {
                        reason: 'keep_rolling_no_snapshot',
                        dbg: dbg,
                        count: _iconSeqRolling.length,
                        ts: Date.now()
                    };
                    return _normalizeTxSeq(keepSeqOldToNew);
                }
                return '';
            }

            // Merge rolling: append chi khi co session moi (lon hon session cuoi), toi da 50 phien.
            if (!_iconSeqRolling.length) {
                _iconSeqRolling = withSession.slice(-ICON_SEQ_MAX).map(cloneRow);
                dbg.rolling_reset = 'seed';
                dbg.rolling_appended = _iconSeqRolling.length;
            } else {
                _iconSeqRolling.sort(function (a, b) {
                    return a.session - b.session;
                });

                var rollingMap = {};
                for (i = 0; i < _iconSeqRolling.length; i++) {
                    rollingMap[String(_iconSeqRolling[i].session)] = i;
                }

                var hasOverlap = false;
                for (i = 0; i < withSession.length; i++) {
                    if (Object.prototype.hasOwnProperty.call(rollingMap, String(withSession[i].session))) {
                        hasOverlap = true;
                        break;
                    }
                }

                if (!hasOverlap) {
                    _iconSeqRolling = withSession.slice(-ICON_SEQ_MAX).map(cloneRow);
                    dbg.rolling_reset = 'no_overlap_seed';
                    dbg.rolling_appended = _iconSeqRolling.length;
                } else {
                    var lastSession = _iconSeqRolling.length
                         ? _iconSeqRolling[_iconSeqRolling.length - 1].session
                         : -Infinity;

                    for (i = 0; i < withSession.length; i++) {
                        var cur = withSession[i];
                        var sk = String(cur.session);
                        if (Object.prototype.hasOwnProperty.call(rollingMap, sk)) {
                            var idx = rollingMap[sk];
                            var old = _iconSeqRolling[idx];
                            if (old.tx !== cur.tx || old.val !== cur.val || old.txt !== cur.txt) {
                                _iconSeqRolling[idx] = cloneRow(cur);
                                dbg.rolling_updated++;
                            }
                            continue;
                        }
                        // Chi append ket qua moi hon session cuoi de chuoi phat trien lien mach sang ben phai.
                        if (cur.session > lastSession) {
                            _iconSeqRolling.push(cloneRow(cur));
                            rollingMap[sk] = _iconSeqRolling.length - 1;
                            lastSession = cur.session;
                            dbg.rolling_appended++;
                        }
                    }
                }
            }

            if (_iconSeqRolling.length > ICON_SEQ_MAX) {
                dbg.rolling_trimmed = _iconSeqRolling.length - ICON_SEQ_MAX;
                _iconSeqRolling = _iconSeqRolling.slice(-ICON_SEQ_MAX);
            }

            var seqOldToNew = '';
            for (i = 0; i < _iconSeqRolling.length; i++)
                seqOldToNew += _iconSeqRolling[i].tx;

            var desc = _iconSeqRolling.slice().sort(function (a, b) {
                return b.session - a.session;
            });
            var seqNewToOld = '';
            for (i = 0; i < desc.length; i++)
                seqNewToOld += desc[i].tx;

            window.__cw_icon_seq = {
                source: 'auto_scene_icon_results',
                seq_oldest_to_latest: seqOldToNew,
                seq_latest_to_oldest: seqNewToOld,
                count: _iconSeqRolling.length,
                ts: Date.now(),
                rows_latest_to_oldest: desc,
                dbg: dbg
            };
            window.__cw_icon_seq_debug = {
                reason: 'ok',
                dbg: dbg,
                count: _iconSeqRolling.length,
                ts: Date.now()
            };

            return _normalizeTxSeq(seqOldToNew);
        } catch (_) {}
        return '';
    }

    window.__cw_buildIconSeqAuto = buildIconSeqFromSceneLocal;

    function readSeqSafeLocal() {
        try {
            var seq = _findSeqAcrossWindows();
            if (seq)
                return seq;

            seq = buildIconSeqFromSceneLocal(false);
            if (seq)
                return seq;

            return _findSeqAcrossWindows();
        } catch (_) {}
        return '';
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
    var X_TAI = 591; // TÀI
    var X_XIU = 973; // XỈU
    // --- NEW extra totals (by x under same tail) ---
    var X_SAPDOI = 783; // SẤP ĐÔI
    var X_TUTRANG = 561; // TỨ TRẮNG
    var X_TUDO = 1004; // TỨ ĐỎ
    var X_3DO = 856; // 3 ĐỎ
    var X_3TRANG = 709; // 3 TRẮNG
    var TAIL_ACCOUNT_EXACT = 'game/Canvas/game/lobby/root/top/header/logged_in_node/khung_tien2/lb_tien';
    var TAIL_CUR_BET_TAI_EXACT = 'game/persistent/mini_games/cc_mini_game_root/mini_game_node/minigame/prefab_taixiu/root/main/blur/textbox/text_current_bet_tai';
    var TAIL_CUR_BET_XIU_EXACT = 'game/persistent/mini_games/cc_mini_game_root/mini_game_node/minigame/prefab_taixiu/root/main/blur/textbox/text_current_bet_xiu';

    function tailEquals(t, exact) {
        if (t == null)
            return false;
        var s1 = String(t),
        s2 = String(exact);
        return s1 === s2 || s1.toLowerCase() === s2.toLowerCase();
    }
    /** return full list (not truncated) filtered by tail */
    function moneyTailList(tailExact, sourceList) {
        var list = (sourceList && typeof sourceList.length === 'number') ? sourceList : buildMoneyRects();
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
    function pickByTailExact(pool, tailExact) {
        var arr = [];
        for (var i = 0; i < pool.length; i++) {
            var it = pool[i];
            if (tailEquals(it.tail, tailExact))
                arr.push(it);
        }
        if (!arr.length)
            return null;
        arr.sort(function (a, b) {
            var av = isRenderableRect({
                    x: a.x,
                    y: a.y,
                    w: a.w,
                    h: a.h
                }) ? 1 : 0;
            var bv = isRenderableRect({
                    x: b.x,
                    y: b.y,
                    w: b.w,
                    h: b.h
                }) ? 1 : 0;
            return (bv - av) || (area(b) - area(a)) || (a.y - b.y) || (a.x - b.x);
        });
        return arr[0];
    }

    // Đọc text theo tail exact, đặt trong cùng scope với totals() để tránh lỗi ReferenceError khác IIFE.
    function readTextByTailExactLocal(tailExact) {
        try {
            tailExact = String(tailExact || '');
            if (!tailExact)
                return '';
            var tailL = tailExact.toLowerCase();
            var tailParts = tailL.split('/').filter(Boolean);
            var tail12 = tailParts.slice(Math.max(0, tailParts.length - 12)).join('/');

            // 1) Ưu tiên labels đã quét
            try {
                if (typeof collectLabels === 'function') {
                    var labels = collectLabels();
                    for (var i = 0; i < labels.length; i++) {
                        var l = labels[i];
                        var tl = String(l.tail || l.tl || '').toLowerCase();
                        if (!tl)
                            continue;
                        if (tl !== tailL && tl !== tail12)
                            continue;
                        var txt = String(l.text || '').trim();
                        if (txt)
                            return txt;
                    }
                }
            } catch (_) {}

            // 2) Duyệt node theo suffix tail12
            try {
                if (typeof walkNodes === 'function' && typeof tailOf === 'function') {
                    var hit = '';
                    walkNodes(function (n) {
                        if (hit || !n || !n.getComponent)
                            return;
                        var nt = String(tailOf(n, 12) || '').toLowerCase();
                        if (!nt || nt !== tail12)
                            return;
                        var lbl = n.getComponent(cc.Label);
                        if (lbl && lbl.string != null) {
                            var s1 = String(lbl.string).trim();
                            if (s1) {
                                hit = s1;
                                return;
                            }
                        }
                        var rt = n.getComponent(cc.RichText);
                        if (rt && rt.string != null) {
                            var s2 = String(rt.string).trim();
                            if (s2)
                                hit = s2;
                        }
                    });
                    if (hit)
                        return hit;
                }
            } catch (_) {}

            // 3) Fallback: đi theo full exact tail qua helper global
            try {
                var node = null;
                if (window.findNodeByTailCompat)
                    node = window.findNodeByTailCompat(tailExact);
                else if (window.__abx_findNodeByTail)
                    node = window.__abx_findNodeByTail(tailExact);
                if (node && node.getComponent) {
                    var l3 = node.getComponent(cc.Label);
                    if (l3 && l3.string != null) {
                        var s3 = String(l3.string).trim();
                        if (s3)
                            return s3;
                    }
                    var r3 = node.getComponent(cc.RichText);
                    if (r3 && r3.string != null) {
                        var s4 = String(r3.string).trim();
                        if (s4)
                            return s4;
                    }
                }
            } catch (_) {}
        } catch (_) {}
        return '';
    }
    // Export standardized helpers
    window.moneyTailList = moneyTailList;
    window.pickByXTail = pickByXTail;
    window.cwPickChan = function () {
        return pickByXTail(moneyTailList(TAIL_TOTAL_EXACT), X_TAI, TAIL_TOTAL_EXACT);
    };
    window.cwPickLe = function () {
        return pickByXTail(moneyTailList(TAIL_TOTAL_EXACT), X_XIU, TAIL_TOTAL_EXACT);
    };

    /* ---------------- totals (using x & tail) ---------------- */
    function totals(S) {
        S.money = buildMoneyRects(); // keep map for overlays & legacy helpers
        var list = moneyTailList(TAIL_TOTAL_EXACT, S.money);
        var mC = pickByXTail(list, X_TAI, TAIL_TOTAL_EXACT); // TÀI
        var mL = pickByXTail(list, X_XIU, TAIL_TOTAL_EXACT); // XỈU
        var mSD = pickByXTail(list, X_SAPDOI, TAIL_TOTAL_EXACT); // SẤP ĐÔI
        var mTT = pickByXTail(list, X_TUTRANG, TAIL_TOTAL_EXACT); // TỨ TRẮNG
        var m3T = pickByXTail(list, X_3TRANG, TAIL_TOTAL_EXACT); // 3 TRẮNG
        var m3D = pickByXTail(list, X_3DO, TAIL_TOTAL_EXACT); // 3 ĐỎ
        var mTD = pickByXTail(list, X_TUDO, TAIL_TOTAL_EXACT); // TỨ ĐỎ
        var rawTaiCur = readTextByTailExactLocal(TAIL_CUR_BET_TAI_EXACT);
        var rawXiuCur = readTextByTailExactLocal(TAIL_CUR_BET_XIU_EXACT);
        var valTaiCur = moneyOf(rawTaiCur);
        var valXiuCur = moneyOf(rawXiuCur);

        // Account (A): strict exact-tail only (no fallback)
        var rA = pickByTailExact(S.money, TAIL_ACCOUNT_EXACT);

        return {
            C: mC ? mC.val : null,
            L: mL ? mL.val : null,
            T: (valTaiCur == null ? null : valTaiCur),
            X: (valXiuCur == null ? null : valXiuCur),
            A: rA ? rA.val : null,
            SD: mSD ? mSD.val : null,
            TT: mTT ? mTT.val : null,
            T3T: m3T ? m3T.val : null,
            T3D: m3D ? m3D.val : null,
            TD: mTD ? mTD.val : null,
            rawC: mC ? mC.txt : null,
            rawL: mL ? mL.txt : null,
            rawT: (rawTaiCur || null),
            rawX: (rawXiuCur || null),
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
            if ((side === 'TAI' && cur.C !== last.C) || (side === 'XIU' && cur.L !== last.L) || (cur.A !== last.A))
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
        moneyMap: [],
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
        '<button id="bCopyScan">CopyScanLog</button>' +
        '</div>' +
        '<div style="display:flex;gap:10px;align-items:center;margin-bottom:6px">' +
        '<span>Tiền (×1K)</span>' +
        '<input id="iStake" value="1" style="width:60px;background:#0b1b16;border:1px solid #3a6;color:#bff;padding:2px 4px;border-radius:4px">' +
        '<button id="bBetC">Bet TÀI</button>' +
        '<button id="bBetL">Bet XỈU</button>' +
        '</div>' +
        '<div id="cwInfo" style="white-space:pre;color:#9f9;line-height:1.45"></div>' +
        '<div id="cwScanLog" style="margin-top:6px;max-height:110px;overflow:auto;white-space:pre;color:#7fe;border-top:1px dashed #184;padding-top:4px"></div>' +
        '<div id="cwScanStatus" style="margin-top:6px;white-space:pre;color:#ffd37a;line-height:1.35"></div>';
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
    var SCAN_LOG_MAX = 12;
    if (!Array.isArray(window.__cw_scan_log))
        window.__cw_scan_log = [];
    function pad2(n) {
        n = Number(n) || 0;
        return n < 10 ? ('0' + n) : String(n);
    }
    function scanTimeTag() {
        var d = new Date();
        return pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
    }
    function pushScanLogLine(line) {
        try {
            var logs = window.__cw_scan_log;
            logs.push(scanTimeTag() + ' ' + String(line || ''));
            if (logs.length > SCAN_LOG_MAX)
                logs.splice(0, logs.length - SCAN_LOG_MAX);
            var box = panel.querySelector('#cwScanLog');
            if (box) {
                box.textContent = logs.join('\n');
                box.scrollTop = box.scrollHeight;
            }
        } catch (e) {}
    }
    function setScanStatusLine(line) {
        try {
            var box = panel.querySelector('#cwScanStatus');
            if (box)
                box.textContent = String(line || '');
        } catch (_) {}
    }
    function scanSummaryLine(source, d) {
        source = source || 'UNK';
        d = d || {};
        var s = d.summary || {};
        var rows = ((d.rows && d.rows.length) || 0);
        var cands = (s.candidates != null ? s.candidates : (s.textCandidate != null ? s.textCandidate : (s.moneyCandidate || 0)));
        return '[' + scanTimeTag() + '] ' + source +
            ' rows=' + rows +
            ' labels=' + (s.labels || 0) +
            ' cands=' + cands +
            ' inv=' + (s.invalidRect || 0) +
            ' dom=' + (s.domFallback || 0) +
            ' syn=' + (s.syntheticPlaced || 0) +
            ' adj=' + (s.adjusted || 0) +
            ' status=' + (s.status || 'na');
    }
    var MAX_SCAN_MONEY_ROWS = 500;
    var MAX_SCAN_TEXT_ROWS = 500;
    function buildScanClipboardText(source, d, errMsg) {
        source = source || 'UNK';
        d = d || {};
        var s = d.summary || {};
        var st = d.stats || {};
        var rows = d.rows || [];
        var logs = (window.__cw_scan_log || []).slice();
        var kind = String(d.kind || '').toLowerCase();
        if (!kind) {
            if (rows.length && rows[0] && typeof rows[0].txt !== 'undefined')
                kind = 'money';
            else
                kind = 'text';
        }
        var candidates = (s.candidates != null ? s.candidates : (s.textCandidate != null ? s.textCandidate : (s.moneyCandidate || 0)));
        var lines = [];
        lines.push('[CW_SCAN_EXPORT]');
        lines.push('time=' + scanTimeTag());
        lines.push('source=' + source);
        lines.push('kind=' + kind);
        lines.push('patch=' + (d.patch || window.__cw_patch_ver || ''));
        lines.push('rows=' + rows.length);
        lines.push('status=' + (s.status || 'na'));
        lines.push('labels=' + (s.labels || 0) +
            ' candidates=' + candidates +
            ' invalid=' + (s.invalidRect || 0) +
            ' dom=' + (s.domFallback || 0) +
            ' syn=' + (s.syntheticPlaced || 0) +
            ' adj=' + (s.adjusted || 0));
        if (errMsg)
            lines.push('error=' + errMsg);
        if (st && typeof st === 'object')
            lines.push('stats=' + JSON.stringify(st));
        if (s && typeof s === 'object')
            lines.push('summary=' + JSON.stringify(s));
        lines.push('');
        lines.push('rows_preview:');
        try {
            var preview = rows.slice(0, MAX_SCAN_TEXT_ROWS);
            if (!preview.length) {
                lines.push('0. (empty)');
            } else {
                for (var i = 0; i < preview.length; i++) {
                    var r = preview[i] || {};
                    var tail = String(r.tail == null ? '' : r.tail);
                    if (kind === 'money' || typeof r.txt !== 'undefined') {
                        var mt = String(r.txt == null ? '' : r.txt).replace(/\r?\n/g, ' / ');
                        var mv = (r.val == null ? 'null' : String(r.val));
                        lines.push((i + 1) + '. txt=' + JSON.stringify(mt) +
                            ' | val=' + mv +
                            ' | x=' + (Number(r.x) || 0) +
                            ' y=' + (Number(r.y) || 0) +
                            ' w=' + (Number(r.w) || 0) +
                            ' h=' + (Number(r.h) || 0) +
                            ' | tail=' + tail);
                    } else {
                        var txt = String(r.text == null ? '' : r.text).replace(/\r?\n/g, ' / ');
                        lines.push((i + 1) + '. text=' + JSON.stringify(txt) +
                            ' | x=' + (Number(r.x) || 0) +
                            ' y=' + (Number(r.y) || 0) +
                            ' w=' + (Number(r.w) || 0) +
                            ' h=' + (Number(r.h) || 0) +
                            ' | tail=' + tail);
                    }
                }
            }
        } catch (_) {
            lines.push('0. (rows_preview format error)');
        }
        lines.push('');
        lines.push('scan_log:');
        if (!logs.length) {
            lines.push('0. (empty)');
        } else {
            for (var j = 0; j < logs.length; j++)
                lines.push((j + 1) + '. ' + String(logs[j]));
        }
        return lines.join('\n');
    }
    function copyTextToClipboard(text) {
        text = String(text || '');
        try {
            var ta = document.createElement('textarea');
            ta.value = text;
            ta.setAttribute('readonly', 'readonly');
            ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0;';
            document.body.appendChild(ta);
            ta.select();
            ta.setSelectionRange(0, ta.value.length);
            var ok = false;
            try {
                ok = document.execCommand('copy');
            } catch (_) {
                ok = false;
            }
            ta.remove();
            return !!ok;
        } catch (_) {}
        return false;
    }
    function showScanAlert(source, d, errMsg) {
        source = source || 'UNK';
        d = d || {};
        var s = d.summary || {};
        var rows = ((d.rows && d.rows.length) || 0);
        var msg = '[CW Scan ' + source + ']\n' +
            'rows=' + rows +
            ' | status=' + (s.status || 'na') +
            ' | invalid=' + (s.invalidRect || 0) +
            ' | dom=' + (s.domFallback || 0) +
            ' | syn=' + (s.syntheticPlaced || 0);
        if (errMsg)
            msg += '\nERR: ' + errMsg;
        try {
            alert(msg);
        } catch (_) {}
    }
    pushScanLogLine('Ready: click Scan200Text to capture log here');
    setScanStatusLine('Scan status: IDLE');

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
        var list = S.moneyMap && S.moneyMap.length ? S.moneyMap : buildMoneyRectsForMap();
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
        // Ưu tiên dùng cùng nguồn totals với C# (readTotalsSafe)
        var t = null;
        try {
            if (typeof window.readTotalsSafe === 'function') {
                t = window.readTotalsSafe();
            }
        } catch (e) {}

        // Nếu vì lý do gì đó readTotalsSafe() trả null
        // thì fallback về S._lastTotals như cũ
        if (!t) {
            t = S._lastTotals || {
                C: null,
                L: null,
                A: null,
                SD: null,
                TT: null,
                T3T: null,
                T3D: null,
                TD: null,
                rawC: null,
                rawL: null,
                rawA: null
            };
        }

        var f = S.focus;
        var remainTime = (typeof readRemainTimeSafe === 'function') ? readRemainTimeSafe() : '';
        if (!remainTime)
            remainTime = '--';
        var session = (typeof readSessionSafe === 'function') ? readSessionSafe() : '';
        if (!session)
            session = '--';

        var userName = '';
        if (typeof window.readUsernameSafe === 'function') {
            try {
                userName = window.readUsernameSafe() || '';
            } catch (_) {
                userName = '';
            }
        }
        var base =
            '• Trạng thái: ' + S.status +
            ' | Thời gian: ' + remainTime +
            ' | Phiên: ' + session + '\n' +
            '• Username : ' + (userName || '--') +
            ' | TK : ' + fmt(t.A) +
            '|TÀI: ' + fmt(t.T) +
            '|XỈU: ' + fmt(t.X) +
            '|SẤP ĐÔI: ' + fmt(t.SD) +
            '|TỨ TRẮNG: ' + fmt(t.TT) +
            '|3 TRẮNG: ' + fmt(t.T3T) +
            '|3 ĐỎ: ' + fmt(t.T3D) +
            '|TỨ ĐỎ: ' + fmt(t.TD) + '\n' +

            '• Focus: ' + (f ? f.kind : '-') + '\n' +
            '  tail: ' + (f ? f.tail : '-') + '\n' +
            '  txt : ' + (f ? (f.txt != null ? f.txt : '-') : '-') + '\n' +
            '  val : ' + (f && f.val != null ? fmt(f.val) : '-');

        // Chuỗi kết quả hiển thị như cũ
        S.seq = readSeqSafeLocal() || '';
        var seqHtml = 'Chuỗi kết quả : <i>--</i>';
        if (S.seq && S.seq.length) {
            var head = esc(S.seq.slice(0, -1));
            var last = esc(S.seq.slice(-1));
            seqHtml = 'Chuỗi kết quả : <span>' + head +
                '</span><span style="color:#f66">' + last + '</span>';
        }
        panel.querySelector('#cwInfo').innerHTML = esc(base) + '\n' + seqHtml;
    }

    /* ---------------- scan tools ---------------- */
    function scan200Money() {
        var money = [];
        var st = {};
        try {
            money = buildMoneyRectsForMap().sort(function (a, b) {
                return a.y - b.y;
            }).slice(0, MAX_SCAN_MONEY_ROWS)
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
            st = window.__cw_moneyStats || {};
            console.log('[Scan200Money] labels=' + (st.labels || 0) +
                ' candidates=' + (st.moneyCandidate || 0) +
                ' invalidRect=' + (st.rectInvalid || 0) +
                ' recovered=' + (st.rectRecovered || 0) +
                ' projected=' + (st.rectProjected || 0) +
                ' clamped=' + (st.rectClamped || 0) +
                ' synthetic=' + (st.syntheticPlaced || 0) +
                ' adjusted=' + (st.rectAdjusted || 0) +
                ' out=' + (st.out || 0));
            console.log('(Money index x' + MAX_SCAN_MONEY_ROWS + ')\ttxt\tval\tx\ty\tw\th\ttail');
            for (var i = 0; i < money.length; i++) {
                var r = money[i];
                console.log(i + "\t'" + r.txt + "'\t" + r.val + "\t" + r.x + "\t" + r.y + "\t" + r.w + "\t" + r.h + "\t'" + r.tail + "'");
            }
            try {
                console.table(money);
            } catch (e) {
                console.log(money);
            }
            try {
                window.__cw_last_scan_money = money;
                window.__cw_last_scan_money_summary = {
                    labels: st.labels || 0,
                    moneyCandidate: st.moneyCandidate || 0,
                    invalidRect: st.rectInvalid || 0,
                    recovered: st.rectRecovered || 0,
                    projected: st.rectProjected || 0,
                    clamped: st.rectClamped || 0,
                    syntheticPlaced: st.syntheticPlaced || 0,
                    adjusted: st.rectAdjusted || 0,
                    out: st.out || 0,
                    ts: Date.now(),
                    status: 'ok'
                };
            } catch (_) {}
            return money;
        } catch (err) {
            try {
                var msg = String((err && err.message) || err || 'scan-money-failed');
                console.warn('[Scan200Money][ERR]', msg);
                window.__cw_last_scan_money = [];
                window.__cw_last_scan_money_summary = {
                    labels: 0,
                    moneyCandidate: 0,
                    invalidRect: 0,
                    recovered: 0,
                    projected: 0,
                    clamped: 0,
                    syntheticPlaced: 0,
                    adjusted: 0,
                    out: 0,
                    ts: Date.now(),
                    status: 'err',
                    err: msg
                };
            } catch (_) {}
            return [];
        }
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
        var texts = [];
        var st = {};
        try {
            texts = buildTextRects({
                allowDomFallback: true,
                domLimit: 200
            }).sort(function (a, b) {
                return a.y - b.y;
            }).slice(0, MAX_SCAN_TEXT_ROWS)
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
            st = window.__cw_textStats || {};
        console.log('[Scan200Text] labels=' + (st.labels || 0) +
            ' candidates=' + (st.textCandidate || 0) +
            ' invalidRect=' + (st.rectInvalid || 0) +
            ' recovered=' + (st.rectRecovered || 0) +
            ' projected=' + (st.rectProjected || 0) +
            ' clamped=' + (st.rectClamped || 0) +
            ' domFallback=' + (st.domFallback || 0) +
            ' synthetic=' + (st.syntheticPlaced || 0) +
            ' adjusted=' + (st.rectAdjusted || 0) +
            ' out=' + (st.out || 0));
            console.log('(Text index x' + MAX_SCAN_TEXT_ROWS + ')\ttext\tx\ty\tw\th\ttail');
            for (var i = 0; i < texts.length; i++) {
                var r = texts[i];
                console.log(i + "\t'" + r.text + "'\t" + r.x + "\t" + r.y + "\t" + r.w + "\t" + r.h + "\t'" + r.tail + "'");
            }
            try {
                console.table(texts);
            } catch (e) {
                console.log(texts);
            }
            try {
                window.__cw_last_scan_text = texts;
                window.__cw_last_scan_summary = {
                labels: st.labels || 0,
                candidates: st.textCandidate || 0,
                invalidRect: st.rectInvalid || 0,
                recovered: st.rectRecovered || 0,
                projected: st.rectProjected || 0,
                clamped: st.rectClamped || 0,
                domFallback: st.domFallback || 0,
                syntheticPlaced: st.syntheticPlaced || 0,
                adjusted: st.rectAdjusted || 0,
                out: st.out || 0,
                ts: Date.now(),
                    status: 'ok'
                };
            } catch (e2) {}
            return texts;
        } catch (err) {
            try {
                var msg = String((err && err.message) || err || 'scan-failed');
                console.warn('[Scan200Text][ERR]', msg);
                window.__cw_last_scan_text = [];
                window.__cw_last_scan_summary = {
                    labels: 0,
                    candidates: 0,
                    invalidRect: 0,
                    recovered: 0,
                    projected: 0,
                    clamped: 0,
                    domFallback: 0,
                    syntheticPlaced: 0,
                    adjusted: 0,
                    out: 0,
                    ts: Date.now(),
                    status: 'err',
                    err: msg
                };
            } catch (e3) {}
            return [];
        }
    }

    /* =====================================================
    CHIP BETTING CORE (compat)
    ===================================================== */
    var CHIP_TAIL_ROW4 = 'xdlive/canvas/bg/tipdealer/tabtipdealer/tipcontent/views/contentchat/row4/itemtip/lbmoney';
    var DENOMS_DESC = [10000000, 5000000, 1000000, 500000, 100000, 50000, 20000, 10000, 5000, 2000, 1000];
    var cfgBet = {
        delayPick: 200,
        delayTap: 200,
        delayBetweenSteps: 200
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
            chan: pick('TAI'),
            le: pick('XIU')
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
        var tgt = (side === 'TAI' ? tgts.chan : tgts.le);
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
                        var tgt = (side === 'TAI' ? getTargets().chan : getTargets().le);
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
    function findSide(side) {
        var WANT = /CHAN/i.test(side) ? 'TAI' : 'XIU';
        var hit = null;
        (function walk(n) {
            if (hit || !active(n))
                return;
            var lb = getComp(n, cc.Label) || getComp(n, cc.RichText);
            var ok = false;
            if (lb && typeof lb.string !== 'undefined') {
                var s = NORM(lb.string);
                ok = (WANT === 'TAI') ? /(CHAN|EVEN)\b/.test(s) : /(\bLE\b|ODD)\b/.test(s);
            }
            if (!ok) {
                var names = [],
                p;
                for (p = n; p; p = p.parent)
                    names.push(p.name || '');
                var path = names.reverse().join('/').toLowerCase();
                ok = (WANT === 'TAI') ? /chan|even/.test(path) : (/\ble\b|odd/.test(path));
            }
            if (ok && clickable(n)) {
                hit = n;
                return;
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
                var isClick = clickable(n);
                if (isClick)
                    score += 6;

                var names = [],
                p;
                for (p = n; p; p = p.parent)
                    names.push(p.name || '');
                var path = names.reverse().join('/').toLowerCase();

                // Heuristic chung CHỈ cho các nút chip/bet, KHÔNG ưu tiên TipDealer nữa
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
        if (LOCK.busy) {
            console.warn('[cwBet++] busy');
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

        side = String(side || '').toUpperCase();
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
    // PERF: tắt mặc định việc quét label trạng thái theo tail ở mỗi nhịp tick.
    // Khi cần debug chính xác text trạng thái trong scene, có thể bật lại bằng:
    // window.__cw_setStatusLabelScan(true)
    var _cw_enable_status_label_scan = false;
    var _txStatusTail = 'MiniGameScene/MiniGameNode/TopUI/TxGameLive/Main/borderTabble/ChatController/PopupMessageUtilTaiXiu/ig_bg_thong_bao/textMessage';
    var _txStatusTextCached = '';
    var _txStatusTextCachedAt = 0;
    window.__cw_setStatusLabelScan = function (enable) {
        _cw_enable_status_label_scan = !!enable;
        _txStatusTextCached = '';
        _txStatusTextCachedAt = 0;
        return _cw_enable_status_label_scan;
    };
    function readTxStatusTextCached(cacheMs) {
        cacheMs = Number(cacheMs) || 450;
        var now = Date.now();
        if ((now - _txStatusTextCachedAt) <= cacheMs)
            return _txStatusTextCached;

        _txStatusTextCachedAt = now;
        _txStatusTextCached = '';
        try {
            var tailL = _txStatusTail.toLowerCase();
            var labs = collectLabels();
            for (var i = 0; i < labs.length; i++) {
                var r = labs[i];
                var tl = String(r.tail || '').toLowerCase();
                if (!tl.endsWith(tailL))
                    continue;
                var raw = String(r.text || '').trim();
                if (raw) {
                    _txStatusTextCached = raw;
                    break;
                }
            }
        } catch (_) {}
        return _txStatusTextCached;
    }
    function statusByProg(p) {
        // Rule mới: trạng thái chỉ dựa vào thời gian còn lại từ tail txt_remain_time_betting.
        //  - sec > 0  => Cho phép đặt cược
        //  - sec = 0  => Chờ kết quả
        //  - không đọc được sec => --
        var sec = null;
        try {
            sec = readRemainSecSafe();
        } catch (_) {
            sec = null;
        }
        if (sec == null)
            return '--';
        return sec > 0 ? 'Cho phép đặt cược' : 'Chờ kết quả';
    }

    // Export ra global để bridge C# dùng được
    window.cwStatusByProg = statusByProg;

    function tick() {
        var p = collectProgress();
        if (p != null)
            S.prog = p;
        S.status = statusByProg(p == null ? null : p);
        var T = totals(S);
        S._lastTotals = T;

        // Đẩy ra global cho bridge dùng (progress + totals)
        window.__cw_lastProg = S.prog;
        window.__cw_lastTotals = T;

        // TK sequence (export ra global để bridge dùng)
        S.seq = readSeqSafeLocal() || '';
        try {
            window.__cw_lastSeq = S.seq;
        } catch (_) {}

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
            S.moneyMap = buildMoneyRectsForMap();
            renderMoney();
        }
        if (S.showText) {
            S.text = buildTextRects({
                allowDomFallback: false
            });
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
            S.moneyMap = buildMoneyRectsForMap();
            renderMoney();
            try {
                var sm = window.__cw_moneyStats || {};
                console.log('[MoneyMap] ON -> out=' + (S.moneyMap || []).length +
                    ' (labels=' + (sm.labels || 0) +
                    ', candidates=' + (sm.moneyCandidate || 0) +
                    ', invalidRect=' + (sm.rectInvalid || 0) +
                    ', recovered=' + (sm.rectRecovered || 0) +
                    ', projected=' + (sm.rectProjected || 0) +
                    ', clamped=' + (sm.rectClamped || 0) +
                    ', synthetic=' + (sm.syntheticPlaced || 0) +
                    ', adjusted=' + (sm.rectAdjusted || 0) + ')');
            } catch (_) {}
        } else {
            S.focus = null;
            showFocus(null);
            try {
                console.log('[MoneyMap] OFF');
            } catch (_) {}
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
            S.text = buildTextRects({
                allowDomFallback: true,
                domLimit: 200
            });
            renderText();
            try {
                var st = window.__cw_textStats || {};
                console.log('[TextMap] ON -> out=' + S.text.length +
                    ' (labels=' + (st.labels || 0) +
                    ', candidates=' + (st.textCandidate || 0) +
                    ', invalidRect=' + (st.rectInvalid || 0) +
                    ', recovered=' + (st.rectRecovered || 0) +
                    ', projected=' + (st.rectProjected || 0) +
                    ', clamped=' + (st.rectClamped || 0) +
                    ', domFallback=' + (st.domFallback || 0) +
                    ', synthetic=' + (st.syntheticPlaced || 0) +
                    ', adjusted=' + (st.rectAdjusted || 0) + ')');
            } catch (e) {}
        } else {
            S.focus = null;
            showFocus(null);
            try {
                console.log('[TextMap] OFF');
            } catch (e2) {}
        }
        panel.style.zIndex = '2147483647';
    };
    panel.querySelector('#bScanMoney').onclick = function () {
        try {
            pushScanLogLine('BTN Scan200Money clicked');
            setScanStatusLine('[' + scanTimeTag() + '] BTN_MONEY scanning...');
            var d = null;
            if (typeof window.__cw_scanAndDumpMoney === 'function')
                d = window.__cw_scanAndDumpMoney('BTN_MONEY');
            else
                d = {
                    kind: 'money',
                    rows: scan200Money() || [],
                    summary: window.__cw_last_scan_money_summary || null,
                    stats: window.__cw_moneyStats || null,
                    patch: window.__cw_patch_ver || ''
                };
            pushScanLogLine('BTN_MONEY done rows=' + (((d && d.rows) || []).length));
            setScanStatusLine(scanSummaryLine('BTN_MONEY', d));
            cwError('[CW_SCAN_MONEY_BTN_DONE]', d);
            showScanAlert('BTN_MONEY', d, '');
        } catch (e) {
            try {
                var em = String((e && e.message) || e || 'unknown');
                pushScanLogLine('BTN_MONEY err ' + em);
                setScanStatusLine('[' + scanTimeTag() + '] BTN_MONEY error: ' + em);
                cwError('[CW_SCAN_MONEY_BTN][ERR]', e);
                showScanAlert('BTN_MONEY', {}, em);
            } catch (_) {}
        }
    };
    panel.querySelector('#bScanBet').onclick = function () {
        scan200Bet();
    };
    panel.querySelector('#bScanText').onclick = function () {
        try {
            pushScanLogLine('BTN Scan200Text clicked');
            setScanStatusLine('[' + scanTimeTag() + '] BTN scanning...');
            var d = null;
            if (typeof window.__cw_scanAndDumpText === 'function')
                d = window.__cw_scanAndDumpText('BTN');
            else
                d = {
                    rows: scan200Text() || []
                };
            pushScanLogLine('BTN done rows=' + (((d && d.rows) || []).length));
            setScanStatusLine(scanSummaryLine('BTN', d));
            cwError('[CW_SCAN_BTN_DONE]', d);
            showScanAlert('BTN', d, '');
        } catch (e) {
            try {
                var em = String((e && e.message) || e || 'unknown');
                pushScanLogLine('BTN err ' + em);
                setScanStatusLine('[' + scanTimeTag() + '] BTN error: ' + em);
                cwError('[CW_SCAN_BTN][ERR]', e);
                showScanAlert('BTN', {}, em);
            } catch (_) {}
        }
    };
    panel.querySelector('#bCopyScan').onclick = function () {
        try {
            var d = window.__cw_last_scan_dump;
            if (!d || !d.rows) {
                if (window.__cw_getMoneyScan)
                    d = window.__cw_getMoneyScan();
                else if (window.__cw_getTextScan)
                    d = window.__cw_getTextScan();
                else
                    d = {};
            }
            var txt = buildScanClipboardText('COPY_BTN', d, '');
            var ok = copyTextToClipboard(txt);
            pushScanLogLine('COPY scan log ' + (ok ? 'ok' : 'fail'));
            setScanStatusLine('[' + scanTimeTag() + '] copy scan log: ' + (ok ? 'OK' : 'FAIL'));
            try {
                alert(ok ? 'Copy ScanLog: OK' : 'Copy ScanLog: FAIL');
            } catch (_) {}
        } catch (e) {
            try {
                var em = String((e && e.message) || e || 'copy-failed');
                pushScanLogLine('COPY err ' + em);
                setScanStatusLine('[' + scanTimeTag() + '] copy error: ' + em);
                alert('Copy ScanLog error: ' + em);
            } catch (_) {}
        }
    };
    // Debug helpers: doc ket qua scan ma khong phu thuoc vao Console UI.
    try {
        window.__cw_scanAndDumpText = function (source) {
            source = source || 'CMD';
            var rows = [];
            pushScanLogLine(source + ' start');
            try {
                rows = scan200Text() || [];
            } catch (e1) {
                try {
                    cwWarn('[CW_SCAN_' + source + '][ERR scan200Text]', e1);
                } catch (_) {}
                rows = [];
            }

            var d = {};
            try {
                d = window.__cw_getTextScan ? window.__cw_getTextScan() : {};
            } catch (e2) {
                d = {};
            }
            if (!d || typeof d !== 'object')
                d = {};
            if (!d.rows)
                d.rows = (window.__cw_last_scan_text || []).slice(0, MAX_SCAN_TEXT_ROWS);
            if (!d.summary)
                d.summary = window.__cw_last_scan_summary || null;
            if (!d.stats)
                d.stats = window.__cw_textStats || null;
            if (!d.patch)
                d.patch = window.__cw_patch_ver || '';
            d.kind = 'text';
            try {
                window.__cw_last_scan_dump = d;
            } catch (_) {}

            try {
                var st = d.summary || {};
                var stateEl = panel && panel.querySelector ? panel.querySelector('#cwState') : null;
                if (stateEl)
                    stateEl.textContent = 'SCAN ' + rows.length + ' (dom ' + (st.domFallback || 0) + ', syn ' + (st.syntheticPlaced || 0) + ', adj ' + (st.adjusted || 0) + ')';
            } catch (_) {}

            try {
                cwWarn('[CW_SCAN_' + source + '] patch=' + (d.patch || '') + ' rows=' + ((d.rows && d.rows.length) || 0));
                if (d.summary)
                    cwWarn('[CW_SCAN_SUMMARY]', d.summary);
                if (d.stats)
                    cwWarn('[CW_SCAN_STATS]', d.stats);
                cwError('[CW_SCAN_' + source + '_HARD]', {
                    patch: d.patch || '',
                    rows: ((d.rows && d.rows.length) || 0),
                    summary: d.summary || null
                });
                pushScanLogLine('SRC=' + source + ' rows=' + ((d.rows && d.rows.length) || 0) +
                    ' inv=' + (((d.summary || {}).invalidRect) || 0) +
                    ' syn=' + (((d.summary || {}).syntheticPlaced) || 0));
                setScanStatusLine(scanSummaryLine(source, d));
                cwTable((d.rows || []).slice(0, MAX_SCAN_TEXT_ROWS));
            } catch (_) {}
            return d;
        };
        window.__cw_scanAndDumpMoney = function (source) {
            source = source || 'CMD_MONEY';
            var rows = [];
            pushScanLogLine(source + ' start');
            try {
                rows = scan200Money() || [];
            } catch (e1) {
                try {
                    cwWarn('[CW_SCAN_' + source + '][ERR scan200Money]', e1);
                } catch (_) {}
                rows = [];
            }

            var d = {};
            try {
                d = window.__cw_getMoneyScan ? window.__cw_getMoneyScan() : {};
            } catch (e2) {
                d = {};
            }
            if (!d || typeof d !== 'object')
                d = {};
            if (!d.rows)
                d.rows = (window.__cw_last_scan_money || []).slice(0, MAX_SCAN_MONEY_ROWS);
            if (!d.summary)
                d.summary = window.__cw_last_scan_money_summary || null;
            if (!d.stats)
                d.stats = window.__cw_moneyStats || null;
            if (!d.patch)
                d.patch = window.__cw_patch_ver || '';
            d.kind = 'money';
            try {
                window.__cw_last_scan_dump = d;
            } catch (_) {}

            try {
                var st = d.summary || {};
                var stateEl = panel && panel.querySelector ? panel.querySelector('#cwState') : null;
                if (stateEl)
                    stateEl.textContent = 'MONEY ' + rows.length + ' (inv ' + (st.invalidRect || 0) + ', syn ' + (st.syntheticPlaced || 0) + ', adj ' + (st.adjusted || 0) + ')';
            } catch (_) {}

            try {
                cwWarn('[CW_SCAN_' + source + '] patch=' + (d.patch || '') + ' rows=' + ((d.rows && d.rows.length) || 0));
                if (d.summary)
                    cwWarn('[CW_SCAN_SUMMARY]', d.summary);
                if (d.stats)
                    cwWarn('[CW_SCAN_STATS]', d.stats);
                cwError('[CW_SCAN_' + source + '_HARD]', {
                    patch: d.patch || '',
                    rows: ((d.rows && d.rows.length) || 0),
                    summary: d.summary || null
                });
                pushScanLogLine('SRC=' + source + ' rows=' + ((d.rows && d.rows.length) || 0) +
                    ' inv=' + (((d.summary || {}).invalidRect) || 0) +
                    ' syn=' + (((d.summary || {}).syntheticPlaced) || 0));
                setScanStatusLine(scanSummaryLine(source, d));
                cwTable((d.rows || []).slice(0, MAX_SCAN_MONEY_ROWS));
            } catch (_) {}
            return d;
        };
        window.__cw_scanTextNow = function () {
            return window.__cw_scanAndDumpText ? window.__cw_scanAndDumpText('CMD') : scan200Text();
        };
        window.__cw_scanMoneyNow = function () {
            return window.__cw_scanAndDumpMoney ? window.__cw_scanAndDumpMoney('CMD_MONEY') : scan200Money();
        };
        window.__cw_showTextMapNow = function () {
            try {
                if (!S.showText) {
                    var b = panel && panel.querySelector ? panel.querySelector('#bText') : null;
                    if (b && b.onclick)
                        b.onclick();
                    else
                        S.showText = true;
                } else {
                    S.text = buildTextRects({
                        allowDomFallback: true,
                        domLimit: 200
                    });
                    renderText();
                }
            } catch (e) {}
            return {
                showText: !!S.showText,
                rows: (S.text || []).length
            };
        };
        window.__cw_showMoneyMapNow = function () {
            try {
                if (!S.showMoney) {
                    var b = panel && panel.querySelector ? panel.querySelector('#bMoney') : null;
                    if (b && b.onclick)
                        b.onclick();
                    else
                        S.showMoney = true;
                } else {
                    S.moneyMap = buildMoneyRectsForMap();
                    renderMoney();
                }
            } catch (e) {}
            return {
                showMoney: !!S.showMoney,
                rows: (S.moneyMap || []).length
            };
        };
        window.__cw_getTextScan = function () {
            return {
                kind: 'text',
                patch: window.__cw_patch_ver || '',
                summary: window.__cw_last_scan_summary || null,
                stats: window.__cw_textStats || null,
                rows: (window.__cw_last_scan_text || []).slice(0, MAX_SCAN_TEXT_ROWS)
            };
        };
        window.__cw_getMoneyScan = function () {
            return {
                kind: 'money',
                patch: window.__cw_patch_ver || '',
                summary: window.__cw_last_scan_money_summary || null,
                stats: window.__cw_moneyStats || null,
                rows: (window.__cw_last_scan_money || []).slice(0, MAX_SCAN_MONEY_ROWS)
            };
        };
        window.__cw_dumpTextScan = function () {
            var d = window.__cw_getTextScan ? window.__cw_getTextScan() : {};
            try {
                cwWarn('[CW_SCAN_DUMP] patch=' + (d.patch || '') +
                    ' rows=' + ((d.rows && d.rows.length) || 0));
                if (d.summary)
                    cwWarn('[CW_SCAN_SUMMARY]', d.summary);
                if (d.stats)
                    cwWarn('[CW_SCAN_STATS]', d.stats);
                cwTable((d.rows || []).slice(0, MAX_SCAN_TEXT_ROWS));
            } catch (e) {}
            return d;
        };
        window.__cw_dumpMoneyScan = function () {
            var d = window.__cw_getMoneyScan ? window.__cw_getMoneyScan() : {};
            try {
                cwWarn('[CW_SCAN_DUMP] patch=' + (d.patch || '') +
                    ' rows=' + ((d.rows && d.rows.length) || 0));
                if (d.summary)
                    cwWarn('[CW_SCAN_SUMMARY]', d.summary);
                if (d.stats)
                    cwWarn('[CW_SCAN_STATS]', d.stats);
                cwTable((d.rows || []).slice(0, MAX_SCAN_MONEY_ROWS));
            } catch (e) {}
            return d;
        };
        window.__cw_dumpScanLog = function () {
            var logs = (window.__cw_scan_log || []).slice();
            cwError('[CW_SCAN_LOG]', logs);
            setScanStatusLine('[' + scanTimeTag() + '] dumped scan log: ' + logs.length + ' line(s)');
            return logs;
        };
        window.__cw_copyScanLog = function () {
            var d = window.__cw_last_scan_dump;
            if (!d || !d.rows) {
                if (window.__cw_getMoneyScan)
                    d = window.__cw_getMoneyScan();
                else if (window.__cw_getTextScan)
                    d = window.__cw_getTextScan();
                else
                    d = {};
            }
            var txt = buildScanClipboardText('CMD_COPY', d, '');
            var ok = copyTextToClipboard(txt);
            pushScanLogLine('CMD copy scan log ' + (ok ? 'ok' : 'fail'));
            setScanStatusLine('[' + scanTimeTag() + '] cmd copy scan log: ' + (ok ? 'OK' : 'FAIL'));
            return {
                ok: !!ok,
                len: txt.length
            };
        };
    } catch (e4) {}

    panel.querySelector('#bBetC').addEventListener('click', async function () {
        var n = parseFloat(document.getElementById('iStake').value || '1');
        var amount = Math.max(0, Math.floor((isFinite(n) ? n : 1))) * 1000;
        try {
            window.chrome && window.chrome.webview && window.chrome.webview.postMessage && window.chrome.webview.postMessage(JSON.stringify({
                    abx: 'cwBet',
                    side: 'TAI',
                    amount: amount,
                    ts: Date.now()
                }));
        } catch (e) {}
        try {
            await cwBet('TAI', amount);
        } catch (e) {}
    }, true);
    panel.querySelector('#bBetL').addEventListener('click', async function () {
        var n = parseFloat(document.getElementById('iStake').value || '1');
        var amount = Math.max(0, Math.floor((isFinite(n) ? n : 1))) * 1000;
        try {
            window.chrome && window.chrome.webview && window.chrome.webview.postMessage && window.chrome.webview.postMessage(JSON.stringify({
                    abx: 'cwBet',
                    side: 'XIU',
                    amount: amount,
                    ts: Date.now()
                }));
        } catch (e) {}
        try {
            await cwBet('XIU', amount);
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

})();

/* === CW Bridge: push snapshot -> C#, receive bet <- C# =================== */
;
(function () {
    // Không bọc toàn bộ bằng try/catch lớn nữa, mỗi hàm tự xử lý lỗi của nó
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
    var _lastStatus = '';
    var _lastSeq = '';
    var _lastSession = '';

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
            if (typeof window.__cw_lastProg === 'number') {
                return window.__cw_lastProg;
            }
        } catch (_) {}
        return null;
    }

    function readTextByTailExact(tailExact) {
        try {
            tailExact = String(tailExact || '');
            if (!tailExact)
                return '';
            var tailL = tailExact.toLowerCase();
            var tailParts = tailL.split('/').filter(Boolean);
            var tail12 = tailParts.slice(Math.max(0, tailParts.length - 12)).join('/');

            // 1) Ưu tiên labels đã quét
            try {
                if (typeof collectLabels === 'function') {
                    var labels = collectLabels();
                    for (var i = 0; i < labels.length; i++) {
                        var l = labels[i];
                        var tl = String(l.tail || l.tl || '').toLowerCase();
                        if (!tl)
                            continue;
                        // collectLabels đang dùng tailOf(...,12), nên chấp nhận đúng full-tail hoặc đúng suffix-12 của tail đó.
                        if (tl !== tailL && tl !== tail12)
                            continue;
                        var txt = String(l.text || '').trim();
                        if (txt)
                            return txt;
                    }
                }
            } catch (_) {}

            // 1.1) Duyệt node và so khớp strict theo tailOf(n,12) nếu labels chưa ra.
            try {
                if (typeof walkNodes === 'function' && typeof tailOf === 'function') {
                    var hit = '';
                    walkNodes(function (n) {
                        if (hit || !n || !n.getComponent)
                            return;
                        var nt = String(tailOf(n, 12) || '').toLowerCase();
                        if (!nt || nt !== tail12)
                            return;
                        var lbl = n.getComponent(cc.Label);
                        if (lbl && lbl.string != null) {
                            var s1 = String(lbl.string).trim();
                            if (s1) {
                                hit = s1;
                                return;
                            }
                        }
                        var rt = n.getComponent(cc.RichText);
                        if (rt && rt.string != null) {
                            var s2 = String(rt.string).trim();
                            if (s2)
                                hit = s2;
                        }
                    });
                    if (hit)
                        return hit;
                }
            } catch (_) {}

            // 2) Fallback: đi thẳng theo exact tail tới node
            function findByTail(tail) {
                if (!tail)
                    return null;
                if (window.findNodeByTailCompat)
                    return window.findNodeByTailCompat(tail);
                if (window.__abx_findNodeByTail)
                    return window.__abx_findNodeByTail(tail);
                if (!(window.cc && cc.director && cc.director.getScene))
                    return null;
                var scene = cc.director.getScene();
                if (!scene)
                    return null;
                var parts = String(tail).split('/').filter(Boolean);
                if (parts[0] === scene.name)
                    parts.shift();
                var node = scene;
                for (var i = 0; i < parts.length; i++) {
                    var name = parts[i];
                    var kids = node.children || node._children || [];
                    var found = null;
                    for (var j = 0; j < kids.length; j++) {
                        var kid = kids[j];
                        if (kid && kid.name === name) {
                            found = kid;
                            break;
                        }
                    }
                    if (!found)
                        return null;
                    node = found;
                }
                return node;
            }
            function getNodeText(node) {
                if (!node || !node.getComponent)
                    return '';
                var lbl = node.getComponent(cc.Label);
                if (lbl && lbl.string != null)
                    return String(lbl.string);
                var rt = node.getComponent(cc.RichText);
                if (rt && rt.string != null)
                    return String(rt.string);
                return '';
            }

            var node = findByTail(tailExact);
            if (!node)
                return '';
            return String(getNodeText(node) || '').trim();
        } catch (_) {}
        return '';
    }

    // Đọc tổng tiền an toàn: lấy nền từ totals() mới nhất (tick)
    // và ghi đè TK + TÀI + XỈU.
    window.readTotalsSafe = function () {
        try {
            // 1) Nền: snapshot totals gần nhất do tick() chụp
            var t = {};
            if (window.__cw_lastTotals && typeof window.__cw_lastTotals === 'object') {
                try {
                    for (var k in window.__cw_lastTotals) {
                        if (Object.prototype.hasOwnProperty.call(window.__cw_lastTotals, k)) {
                            t[k] = window.__cw_lastTotals[k];
                        }
                    }
                } catch (_) {}
            }

            // 2) Ghi đè TK + Tài/Xỉu nếu lấy được qua moneyTailList()
            var ACC_TAIL_EXACT = 'MiniGameScene/Canvas/FootterRoomUi/Left/buttonMoney/moneyLabel';
            var TX_TAI_TAIL_EXACT = 'game/persistent/mini_games/cc_mini_game_root/mini_game_node/minigame/prefab_taixiu/root/main/blur/textbox/text_current_bet_tai';
            var TX_XIU_TAIL_EXACT = 'game/persistent/mini_games/cc_mini_game_root/mini_game_node/minigame/prefab_taixiu/root/main/blur/textbox/text_current_bet_xiu';

            var allMoney = [];
            try {
                if (typeof buildMoneyRects === 'function') {
                    allMoney = buildMoneyRects() || [];
                }
            } catch (_) {
                allMoney = [];
            }

            if (typeof window.moneyTailList === 'function') {

                // 2.1 TK (tài khoản)
                try {
                    var accList = window.moneyTailList(ACC_TAIL_EXACT, allMoney) || [];
                    if (accList.length) {
                        var acc = accList[accList.length - 1]; // thường là label dưới cùng
                        var aval = (typeof acc.val === 'number')
                         ? acc.val
                         : Number(acc.val || 0) || null;
                        if (aval != null)
                            t.A = aval;
                        if (!t.rawA)
                            t.rawA = acc.txt || acc.raw || null;
                    }
                } catch (_) {}

                // 2.2 Tổng TÀI / XỈU theo strict tail mới (không dùng tail/x cũ)
                try {
                    var rawTai = readTextByTailExact(TX_TAI_TAIL_EXACT);
                    var valTai = moneyOf(rawTai);
                    t.T = (valTai == null ? null : valTai);
                    t.rawT = (rawTai || null);

                    var rawXiu = readTextByTailExact(TX_XIU_TAIL_EXACT);
                    var valXiu = moneyOf(rawXiu);
                    t.X = (valXiu == null ? null : valXiu);
                    t.rawX = (rawXiu || null);
                } catch (_) {}
            }

            return t;
        } catch (_) {
            return null;
        }
    };

    function readSeqSafe() {
        // Strict: chi lay chuoi tu __cw_icon_seq.seq_oldest_to_latest.
        // Khong fallback ve logic cu readTKSeq.
        function seqFromWin(w) {
            try {
                var iconSeq = w && w.__cw_icon_seq;
                if (!iconSeq || typeof iconSeq !== 'object')
                    return '';
                var s = String(iconSeq.seq_oldest_to_latest || '').toUpperCase();
                if (!s)
                    return '';
                return s.replace(/[^TX]/g, '');
            } catch (_) {}
            return '';
        }
        try {
            function findAcross() {
                var seen = [];
                function walkWin(w) {
                    if (!w)
                        return '';
                    try {
                        if (seen.indexOf(w) !== -1)
                            return '';
                        seen.push(w);
                    } catch (_) {
                        return '';
                    }

                    var seq = seqFromWin(w);
                    if (seq)
                        return seq;

                    try {
                        if (w.parent && w.parent !== w) {
                            seq = walkWin(w.parent);
                            if (seq)
                                return seq;
                        }
                    } catch (_) {}

                    try {
                        if (w.top) {
                            seq = walkWin(w.top);
                            if (seq)
                                return seq;
                        }
                    } catch (_) {}

                    try {
                        var len = w.frames ? w.frames.length : 0;
                        for (var i = 0; i < len; i++) {
                            seq = walkWin(w.frames[i]);
                            if (seq)
                                return seq;
                        }
                    } catch (_) {}
                    return '';
                }
                return walkWin(window) || '';
            }

            function triggerBuild(w) {
                try {
                    if (w && typeof w.__cw_buildIconSeqAuto === 'function')
                        w.__cw_buildIconSeqAuto(false);
                } catch (_) {}
            }

            var seq = findAcross();
            if (seq)
                return seq;

            triggerBuild(window);
            try {
                if (window.parent && window.parent !== window)
                    triggerBuild(window.parent);
            } catch (_) {}
            try {
                if (window.top)
                    triggerBuild(window.top);
            } catch (_) {}

            return findAcross();
        } catch (_) {}
        return '';
    }

    function readSessionSafe() {
        try {
            var TAIL = 'game/persistent/mini_games/cc_mini_game_root/mini_game_node/minigame/prefab_taixiu/root/main/blur/textbox/txt_session';
            var txt = '';

            // 1) Thử lấy qua collectLabels() nếu đã có sẵn label
            if (typeof collectLabels === 'function') {
                var labels = collectLabels();
                if (labels && labels.length) {
                    var tailLc = TAIL.toLowerCase();
                    for (var i = 0; i < labels.length; i++) {
                        var l = labels[i];
                        var tl = String(l.tail || l.tl || '').toLowerCase();
                        if (!tl)
                            continue;

                        // chỉ khớp đúng tail phiên mới (không fallback tail cũ)
                        if (tl === tailLc) {
                            txt = String(l.text || '').trim();
                            if (txt)
                                break;
                        }
                    }
                }
            }

            // 2) Fallback cùng tail phiên mới: đi trực tiếp theo node
            if (!txt) {
                function findByTail(tail) {
                    if (!tail)
                        return null;

                    if (window.findNodeByTailCompat)
                        return window.findNodeByTailCompat(tail);
                    if (window.__abx_findNodeByTail)
                        return window.__abx_findNodeByTail(tail);

                    if (!(window.cc && cc.director && cc.director.getScene))
                        return null;
                    var scene = cc.director.getScene();
                    var parts = String(tail).split('/').filter(Boolean);
                    if (parts[0] === scene.name)
                        parts.shift();

                    var node = scene;
                    for (var i = 0; i < parts.length; i++) {
                        var name = parts[i];
                        var kids = node.children || node._children || [];
                        var found = null;
                        for (var j = 0; j < kids.length; j++) {
                            var kid = kids[j];
                            if (kid && kid.name === name) {
                                found = kid;
                                break;
                            }
                        }
                        if (!found)
                            return null;
                        node = found;
                    }
                    return node;
                }

                function getNodeText(node) {
                    if (!node || !node.getComponent)
                        return '';
                    var lbl = node.getComponent(cc.Label);
                    if (lbl && lbl.string != null)
                        return String(lbl.string);
                    var rt = node.getComponent(cc.RichText);
                    if (rt && rt.string != null)
                        return String(rt.string);
                    return '';
                }

                var node = findByTail(TAIL);
                if (node) {
                    txt = getNodeText(node);
                }
            }

            txt = String(txt || '').trim();
            if (!txt)
                return '';

            // Chuẩn hoá dạng "#501667"
            if (txt.charAt(0) !== '#' && /^\d+$/.test(txt)) {
                txt = '#' + txt;
            }

            return txt;
        } catch (_) {}
        return '';
    }

    function parseRemainSec(text) {
        text = String(text || '').trim();
        if (!text)
            return null;
        var m = text.match(/(-?\d{1,3})/);
        if (!m)
            return null;
        var sec = parseInt(m[1], 10);
        if (!isFinite(sec))
            return null;
        if (sec < 0)
            sec = 0;
        if (sec > 50)
            sec = 50;
        return sec;
    }

    function readRemainSecSafe() {
        var txt = readRemainTimeSafe();
        return parseRemainSec(txt);
    }

    // NEW: đọc thời gian cược còn lại theo tail Cocos (strict tail mới, không fallback tail cũ)
    function readRemainTimeSafe() {
        try {
            var TAIL = 'game/persistent/mini_games/cc_mini_game_root/mini_game_node/minigame/prefab_taixiu/root/main/blur/textbox/txt_remain_time_betting';
            var txt = '';

            // 1) Thử lấy qua collectLabels() nếu đã có sẵn label
            if (typeof collectLabels === 'function') {
                var labels = collectLabels();
                if (labels && labels.length) {
                    var tailLc = TAIL.toLowerCase();
                    for (var i = 0; i < labels.length; i++) {
                        var l = labels[i];
                        var tl = String(l.tail || l.tl || '').toLowerCase();
                        if (!tl)
                            continue;

                        // chỉ khớp đúng tail thời gian mới
                        if (tl === tailLc) {
                            txt = String(l.text || '').trim();
                            if (txt)
                                break;
                        }
                    }
                }
            }

            // 2) Fallback cùng tail thời gian mới: đi trực tiếp theo node
            if (!txt) {
                function findByTail(tail) {
                    if (!tail)
                        return null;

                    if (window.findNodeByTailCompat)
                        return window.findNodeByTailCompat(tail);
                    if (window.__abx_findNodeByTail)
                        return window.__abx_findNodeByTail(tail);

                    if (!(window.cc && cc.director && cc.director.getScene))
                        return null;
                    var scene = cc.director.getScene();
                    var parts = String(tail).split('/').filter(Boolean);
                    if (parts[0] === scene.name)
                        parts.shift();

                    var node = scene;
                    for (var i = 0; i < parts.length; i++) {
                        var name = parts[i];
                        var kids = node.children || node._children || [];
                        var found = null;
                        for (var j = 0; j < kids.length; j++) {
                            var kid = kids[j];
                            if (kid && kid.name === name) {
                                found = kid;
                                break;
                            }
                        }
                        if (!found)
                            return null;
                        node = found;
                    }
                    return node;
                }

                function getNodeText(node) {
                    if (!node || !node.getComponent)
                        return '';
                    var lbl = node.getComponent(cc.Label);
                    if (lbl && lbl.string != null)
                        return String(lbl.string);
                    var rt = node.getComponent(cc.RichText);
                    if (rt && rt.string != null)
                        return String(rt.string);
                    return '';
                }

                var node = findByTail(TAIL);
                if (node) {
                    txt = getNodeText(node);
                }
            }

            txt = String(txt || '').trim();
            if (!txt)
                return '';

            // Chuẩn hoá theo 00..50s
            var sec = parseRemainSec(txt);
            if (sec == null)
                return '';
            txt = (sec < 10 ? ('0' + sec) : String(sec)) + 's';

            return txt;
        } catch (_) {}
        return '';
    }

    window.readRemainSecSafe = readRemainSecSafe;
    window.readRemainTimeSafe = readRemainTimeSafe;
    window.readSessionSafe = readSessionSafe;

    // NEW: đọc Username an toàn theo tail Cocos
    function readUsernameSafe() {
        try {
            if (!window.cc || !window.cc.director || !window.cc.director.getScene)
                return '';

            // helper: tìm node theo tail Cocos
            function findByTail(tail) {
                if (!tail)
                    return null;

                // ưu tiên các hàm ông chủ đã tiêm
                if (window.findNodeByTailCompat)
                    return window.findNodeByTailCompat(tail);
                if (window.__abx_findNodeByTail)
                    return window.__abx_findNodeByTail(tail);

                // fallback: tự lần từ scene
                var scene = window.cc.director.getScene();
                if (!scene)
                    return null;

                var parts = String(tail).split('/').filter(Boolean);
                if (parts[0] === scene.name)
                    parts.shift();

                var node = scene;
                for (var i = 0; i < parts.length; i++) {
                    var name = parts[i];
                    var kids = node.children || node._children || [];
                    var found = null;
                    for (var j = 0; j < kids.length; j++) {
                        if (kids[j] && kids[j].name === name) {
                            found = kids[j];
                            break;
                        }
                    }
                    if (!found)
                        return null;
                    node = found;
                }
                return node;
            }

            function getNodeText(node) {
                if (!node || !node.getComponent)
                    return '';
                var lbl = node.getComponent(cc.Label);
                if (lbl && lbl.string != null)
                    return String(lbl.string);
                var rt = node.getComponent(cc.RichText);
                if (rt && rt.string != null)
                    return String(rt.string);
                return '';
            }

            // tail Username
            var tail = 'game/Canvas/game/lobby/root/top/header/logged_in_node/lb_khung_ten/lb_ten';
            var node = findByTail(tail);
            if (!node)
                return '';

            var txt = getNodeText(node) || '';
            txt = String(txt).trim();
            if (!txt)
                return '';

            // chuẩn hoá khoảng trắng
            return txt.replace(/\s+/g, ' ');
        } catch (_) {
            return '';
        }
    }

    window.readUsernameSafe = readUsernameSafe;

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
                var p = readProgressVal();
                var st = (typeof window.cwStatusByProg === 'function')
                 ? window.cwStatusByProg(p)
                 : '';

                // Lấy chuỗi kết quả an toàn (ưu tiên cache __cw_lastSeq)
                var seq = readSeqSafe() || '';
                var last = '';
                if (seq && seq.length)
                    last = seq.slice(-1);

                // Mapping prog -> thời gian (giây)
                var timeSec = null;
                var timePercent = null;
                var timeText = '';
                if (typeof p === 'number' && !isNaN(p)) {
                    var sec = Math.round(p * 45);
                    if (sec < 0)
                        sec = 0;
                    if (sec > 45)
                        sec = 45;

                    timeSec = sec; // 45 → 0
                    timePercent = sec / 45; // 1 → 0
                    timeText = sec + 's'; // "13s"...
                }

                var snap = {
                    abx: 'tick',
                    // prog: số giây còn lại 0..45 (theo tỉ lệ p)
                    prog: p,
                    timeSec: timeSec,
                    timePercent: timePercent,
                    timeText: timeText,
                    totals: (typeof window.readTotalsSafe === 'function'
                         ? window.readTotalsSafe()
                         : null),
                    seq: seq,
                    last: last,
                    status: String(st || ''),
                    session: (typeof readSessionSafe === 'function') ? readSessionSafe() : '',
                    username: (typeof readUsernameSafe === 'function') ? readUsernameSafe() : '',
                    ts: Date.now()
                };

                if (shallowChanged(snap)) {
                    // Log trạng thái + thời gian
                    if (snap.status !== _lastStatus) {
                        _lastStatus = snap.status;
                        var secLog = null;
                        if (typeof timeSec === 'number')
                            secLog = timeSec;
                        //console.log('[CW][push] status =', snap.status, 'sec =', secLog);
                    }

                    // Log seq + session khi thay đổi
                    if (snap.seq !== _lastSeq || snap.session !== _lastSession) {
                        _lastSeq = snap.seq;
                        _lastSession = snap.session;
                        //console.log(
                        //   '[CW][push] seq/session =',
                        //   snap.seq || '<empty>',
                        //    '| session =',
                        //    snap.session || '<empty>'
                        // );
                    }

                    safePost(snap);
                }
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

    // Helpers dùng riêng cho __cw_bet (Tài/Xỉu TipDealer), độc lập với IIFE phía trên
    function sleep(ms) {
        return new Promise(function (r) {
            setTimeout(r, ms);
        });
    }

    function getComp(n, T) {
        try {
            return n && n.getComponent ? n.getComponent(T) : null;
        } catch (e) {
            return null;
        }
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
                cc.Component.EventHandler.emitEvents(
                    b.clickEvents,
                    new cc.Event.EventCustom('click', true));
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
            var fs = cc.view.getFrameSize();
            var vs = cc.view.getVisibleSize();
            var x = sp.x * (fs.width / vs.width);
            var y = sp.y * (fs.height / vs.height);
            var cvs = document.querySelector('canvas');
            if (!cvs)
                return false;

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
            console.warn('[emitClick][bridge] error', e);
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
        if (!(window.cc && cc.director && cc.director.getScene))
            return;
        var scene = cc.director.getScene();
        if (!scene)
            return;

        var st = [scene];
        var seen = [];
        function seenHas(x) {
            return seen.indexOf(x) !== -1;
        }
        function seenAdd(x) {
            if (!seenHas(x))
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

    // --- Bet TÀI/XỈU bằng chip menuMoney + nút ĐẶT CƯỢC ---

    // Nút cửa TÀI / XỈU trên bàn chính
    var TX_TAIL_BTN_TAI = 'MiniGameScene/MiniGameNode/TopUI/TxGameLive/Main/borderTabble/nodeSprite/btnCuocTai';
    var TX_TAIL_BTN_XIU = 'MiniGameScene/MiniGameNode/TopUI/TxGameLive/Main/borderTabble/nodeSprite/btnCuocXiu';

    // Nút ĐẶT CƯỢC (menuMoney/btnFunctions/btnDatCuoc)
    var TX_TAIL_BTN_DATCUOC =
        'MiniGameScene/MiniGameNode/TopUI/TxGameLive/Main/borderTabble/menuMoney/btnFunctions/btnDatCuoc';

    // Chip ở hàng menuMoney/btnPrices (ở giữa màn hình, KHÔNG phải TipDealer)
    var TX_MENU_CHIP_CONFIG = [{
            amount: 50000000,
            tailEnd: 'menuMoney/btnPrices/Btn50M'
        }, {
            amount: 10000000,
            tailEnd: 'menuMoney/btnPrices/btn10M'
        }, {
            amount: 1000000,
            tailEnd: 'menuMoney/btnPrices/btn1M'
        }, {
            amount: 500000,
            tailEnd: 'menuMoney/btnPrices/btn500K'
        }, {
            amount: 100000,
            tailEnd: 'menuMoney/btnPrices/btn100K'
        }, {
            amount: 50000,
            tailEnd: 'menuMoney/btnPrices/btn50k'
        }, {
            amount: 10000,
            tailEnd: 'menuMoney/btnPrices/btn10k'
        }, {
            amount: 1000,
            tailEnd: 'menuMoney/btnPrices/btn1K'
        }
    ];
    // NEW: delay cho chuỗi thao tác bet (tối ưu cho máy yếu/VPS)
    var TX_BET_DELAY = {
        sideToChip: 260, // sau khi click cửa → đợi rồi mới bấm phỉnh
        chipToChip: 220, // giữa các lần click phỉnh liên tiếp
        afterChipsBeforeConfirm: 260 // sau khi xong phỉnh → đợi rồi mới ấn ĐẶT CƯỢC
    };

    // Tìm node theo phần đuôi tail (dùng tailOf + walkNodes bên trên)
    function txFindNodeByTailEnd(tailEnd) {
        var tailLower = String(tailEnd || '').toLowerCase();
        var hit = null;
        walkNodes(function (n) {
            if (hit)
                return;
            var t = tailOf(n, 16);
            if (String(t || '').toLowerCase().endsWith(tailLower)) {
                hit = n;
            }
        });
        return hit;
    }

    // Scan xem chip nào ở menuMoney đang tồn tại
    function txScanMenuChips() {
        var out = [];
        for (var i = 0; i < TX_MENU_CHIP_CONFIG.length; i++) {
            var cfg = TX_MENU_CHIP_CONFIG[i];
            var n = txFindNodeByTailEnd(cfg.tailEnd);
            if (!n)
                continue;
            out.push({
                amount: cfg.amount,
                tailEnd: cfg.tailEnd,
                node: n
            });
        }
        return out;
    }

    // Lập plan tách amount thành các chip có sẵn (tham lam từ lớn -> nhỏ)
    function txBuildPlan(amount, chipList) {
        var rest = Math.max(0, Math.floor(Number(amount) || 0));
        var steps = [];
        var sorted = chipList.slice().sort(function (a, b) {
            return b.amount - a.amount;
        });

        for (var i = 0; i < sorted.length; i++) {
            var chip = sorted[i];
            if (rest <= 0)
                break;
            var cnt = Math.floor(rest / chip.amount);
            if (cnt > 0) {
                steps.push({
                    chip: chip,
                    count: cnt
                });
                rest -= cnt * chip.amount;
            }
        }
        return {
            steps: steps,
            rest: rest
        };
    }

    function txClickMenuChipOnce(chip) {
        if (!chip || !chip.node) {
            console.warn('[cwBetTx] chip node null', chip);
            return false;
        }
        var node = clickableOf(chip.node, 5);
        var ok = emitClick(node);
        if (!ok) {
            console.warn('[cwBetTx] click chip thất bại', chip.amount);
            return false;
        }
        return true;
    }

    function txClickSide(side) {
        var tailEnd = (String(side || '').toUpperCase() === 'TAI')
         ? TX_TAIL_BTN_TAI
         : TX_TAIL_BTN_XIU;

        var n = txFindNodeByTailEnd(tailEnd);
        if (!n) {
            console.warn('[cwBetTx] Không tìm thấy nút cửa', side, 'tailEnd =', tailEnd);
            return false;
        }
        var node = clickableOf(n, 5);
        var ok = emitClick(node);
        if (!ok) {
            console.warn('[cwBetTx] click cửa thất bại', side);
            return false;
        }
        return true;
    }

    async function txClickDatCuoc() {
        var n = txFindNodeByTailEnd(TX_TAIL_BTN_DATCUOC);
        if (!n) {
            console.warn('[cwBetTx] Không tìm thấy nút ĐẶT CƯỢC');
            return false;
        }
        var node = clickableOf(n, 5);
        var ok = emitClick(node);
        if (!ok) {
            console.warn('[cwBetTx] click ĐẶT CƯỢC thất bại');
            return false;
        }
        await sleep(180);
        return true;
    }

    // ĐẶT CƯỢC: dùng chip menuMoney + click cửa TÀI/XỈU + 1 lần ĐẶT CƯỢC
    async function cwBetTxByChip(side, amount) {
        side = String(side || '').toUpperCase();
        side = (side === 'TAI') ? 'TAI' : 'XIU';

        var amt = Math.max(0, Math.floor(Number(amount) || 0));
        if (!amt) {
            console.warn('[cwBetTx] amount = 0');
            return false;
        }

        // 1) Lấy danh sách chip ở menuMoney
        var chips = txScanMenuChips();
        if (!chips.length) {
            console.warn('[cwBetTx] Không tìm thấy chip menuMoney nào');
            return false;
        }

        // 2) Lập plan tách số tiền
        var plan = txBuildPlan(amt, chips);
        var steps = plan.steps;
        var rest = plan.rest;
        if (!steps.length || rest > 0) {
            console.warn('[cwBetTx] Không lập được plan cho amount =', amt, 'rest =', rest);
            return false;
        }

        try {
            console.log(
                '[cwBetTx] side =', side,
                'amount =', amt,
                'plan =',
                steps.map(function (s) {
                    return s.count + '×' + s.chip.amount.toLocaleString();
                }).join(' + '));
        } catch (e) {}

        // 3) CHỌN CỬA TRƯỚC (TÀI / XỈU)
        var okSideOnce = txClickSide(side);
        if (!okSideOnce) {
            console.warn('[cwBetTx] click cửa lần đầu thất bại', side);
            return false;
        }
        // ➜ Đợi một nhịp cho game highlight cửa xong rồi mới bấm phỉnh
        await sleep(TX_BET_DELAY.sideToChip);

        // 4) Sau khi đã chọn cửa, CHỈ bấm phỉnh theo plan (không bấm lại cửa)
        for (var s = 0; s < steps.length; s++) {
            var step = steps[s];
            for (var i = 0; i < step.count; i++) {
                var okChip = txClickMenuChipOnce(step.chip);
                if (!okChip) {
                    console.warn('[cwBetTx] click chip thất bại', step.chip.amount);
                    return false;
                }
                // ➜ Delay giữa các lần click phỉnh liên tiếp
                await sleep(TX_BET_DELAY.chipToChip);
            }
        }

        // 5) Đợi thêm một nhịp để game gom hết phỉnh rồi mới nhấn ĐẶT CƯỢC
        await sleep(TX_BET_DELAY.afterChipsBeforeConfirm);

        // 6) Cuối cùng nhấn ĐẶT CƯỢC 1 lần để xác nhận, KHÔNG dùng tip
        var okDat = await txClickDatCuoc();
        if (!okDat) {
            console.warn('[cwBetTx] click ĐẶT CƯỢC thất bại');
            return false;
        }

        return true;
    }

    window.__cw_bet = async function (side, amount) {
        try {
            // chuẩn hoá tham số
            side = String(side || '').toUpperCase();
            side = (side === 'TAI') ? 'TAI' : 'XIU';

            var amt = Math.max(0, Math.floor(Number(amount) || 0));
            if (!amt) {
                throw new Error('amount_invalid');
            }

            // chụp tổng trước khi bet (nếu có)
            var before = (typeof window.readTotalsSafe === 'function'
                 ? window.readTotalsSafe()
                 : null) || {};

            // ĐẶT CƯỢC bằng click phỉnh TipDealer + cửa Tài/Xỉu
            var ok = await cwBetTxByChip(side, amt);
            if (!ok) {
                throw new Error('click_failed');
            }

            // ✅ BẮT BUỘC kiểm tra tổng có thay đổi hay không
            var changed = true;
            try {
                if (typeof waitForTotalsChange === 'function') {
                    changed = await waitForTotalsChange(before, side, 1600);
                }
            } catch (_) {
                // nếu util lỗi thì coi như không chặn cược (tránh chặn nhầm)
                changed = true;
            }

            if (!changed) {
                // Click đủ bước nhưng tổng không đổi → coi là bet thất bại (thường là do quá sớm/quá muộn)
                throw new Error('totals_not_changed');
            }

            // báo về C#
            safePost({
                abx: 'bet',
                side: side,
                amount: amt,
                ts: Date.now()
            });
            return 'ok';
        } catch (err) {
            safePost({
                abx: 'bet_error',
                side: side,
                amount: amount,
                error: String(err && err.message || err),
                ts: Date.now()
            });
            return 'fail';
        }
    };

    // NEW: báo về C# ngay khi file JS load xong để biết script đã chạy
    try {
        safePost({
            abx: 'js_loaded',
            ts: Date.now()
        });
    } catch (_) {}
})();

