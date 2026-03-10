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
    window.__cw_patch_ver = 'cw-xd-textmap-sync-20260310-23';
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
    function __cw_waitReady() {
        if (window.__cw_waiting_v4) return;
        window.__cw_waiting_v4 = 1;
        var tries = 0;
        var timer = setInterval(function () {
            try {
                if (window.cc && cc.director && cc.director.getScene) {
                    clearInterval(timer);
                    window.__cw_waiting_v4 = 0;
                    __cw_boot();
                } else if (++tries > 120) {
                    clearInterval(timer);
                    window.__cw_waiting_v4 = 0;
                }
            } catch (e) {}
        }, 500);
    }

    function __cw_boot() {
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
        var x = (r && r.sx != null) ? r.sx : r.x;
        var y = (r && r.sy != null) ? r.sy : r.y;
        var w = (r && r.sw != null) ? r.sw : r.w;
        var h = (r && r.sh != null) ? r.sh : r.h;
        return {
            left: x + 'px',
            top: y + 'px',
            width: w + 'px',
            height: h + 'px'
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
    function toScreenPt(node, p) {
        try {
            var cam = null;
            if (cc.Camera && cc.Camera.findCamera) {
                cam = cc.Camera.findCamera(node);
            } else if (cc.Camera && cc.Camera.main) {
                cam = cc.Camera.main;
            }
            if (cam && cam.worldToScreen) {
                var sp = cam.worldToScreen(p);
                var fs = (cc.view && cc.view.getFrameSize) ? cc.view.getFrameSize() : null;
                var vs = (cc.view && cc.view.getVisibleSize) ? cc.view.getVisibleSize() : null;
                if (fs && vs && vs.width && vs.height) {
                    return {
                        x: sp.x * (fs.width / vs.width),
                        y: sp.y * (fs.height / vs.height)
                    };
                }
                return {
                    x: sp.x,
                    y: sp.y
                };
            }
        } catch (e) {}
        try {
            if (cc.view && cc.view._convertPointWithScale) {
                var sp2 = cc.view._convertPointWithScale(p);
                if (sp2)
                    return {
                        x: sp2.x,
                        y: sp2.y
                    };
            }
        } catch (e) {}
        return {
            x: p.x || 0,
            y: p.y || 0
        };
    }
    function wRect(node) {
        try {
            var p = node.convertToWorldSpaceAR(new V2(0, 0));
            var cs = node.getContentSize ? node.getContentSize() : (node._contentSize || {
                width: 0,
                height: 0
            });
            var ax = (node.anchorX != null ? node.anchorX : 0.5);
            var ay = (node.anchorY != null ? node.anchorY : 0.5);
            var wx = p.x || 0;
            var wy = p.y || 0;
            var ww = cs.width || 0;
            var wh = cs.height || 0;
            var blx = wx - ww * ax;
            var bly = wy - wh * ay;
            var tr = {
                x: blx + ww,
                y: bly + wh
            };
            var sp1 = toScreenPt(node, new V2(blx, bly));
            var sp2 = toScreenPt(node, new V2(tr.x, tr.y));
            var sx = Math.min(sp1.x, sp2.x);
            var sy = Math.min(sp1.y, sp2.y);
            var sw = Math.abs(sp2.x - sp1.x);
            var sh = Math.abs(sp2.y - sp1.y);
            return {
                x: wx,
                y: wy,
                w: ww,
                h: wh,
                sx: sx,
                sy: sy,
                sw: sw,
                sh: sh
            };
        } catch (e) {
            return {
                x: 0,
                y: 0,
                w: 0,
                h: 0,
                sx: 0,
                sy: 0,
                sw: 0,
                sh: 0
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
    var GAME_PREFAB_KEY = 'prefab_game_14';
    var GAME_PATH_KEYS = [
        'prefab_game_14',
        'sede/canvas/mainplay',
        'sede/canvas/gateheaderingame',
        '/betnode/',
        '/chipnode/',
        '/waittingroom/',
        '/soicau/'
    ];
    function fullPath(n, limit) {
        limit = limit || 80;
        var a = [];
        try {
            var t = n,
            c = 0;
            while (t && c < limit) {
                if (t.name)
                    a.push(t.name);
                t = t.parent || t._parent || null;
                c++;
            }
        } catch (e) {}
        a.reverse();
        return a.join('/');
    }
    function nodeInGame(n) {
        try {
            var t = n,
            c = 0;
            while (t && c < 220) {
                var nm = String(t.name || '').toLowerCase();
                if (nm.indexOf(GAME_PREFAB_KEY) !== -1 || nm === 'mainplay' || nm === 'midnode' || nm === 'betnode' || nm === 'chipnode')
                    return true;
                t = t.parent || t._parent || null;
                c++;
            }
        } catch (e) {}
        try {
            var p = String(fullPath(n, 220) || '').toLowerCase();
            for (var i = 0; i < GAME_PATH_KEYS.length; i++) {
                if (p.indexOf(GAME_PATH_KEYS[i]) !== -1)
                    return true;
            }
        } catch (e2) {}
        return false;
    }
    var COUNTDOWN_TAIL_WAIT = 'sede/Canvas/mainPlay/midNode/waittingRoom/lblTimeWait';
    function readCountdownSec() {
        var found = null;
        var tailNeed = String(COUNTDOWN_TAIL_WAIT || '').toLowerCase();
        function parseSec(txt) {
            var m = String(txt || '').match(/(\d{1,2})/);
            if (!m)
                return null;
            var v = parseInt(m[1], 10);
            if (!isFinite(v))
                return null;
            if (v < 0)
                v = 0;
            if (v > 99)
                v = 99;
            return v;
        }
        walkNodes(function (n) {
            if (found)
                return;
            if (!n)
                return;
            var path = fullPath(n, 140);
            var pathL = String(path || '').toLowerCase();
            if (!(pathL === tailNeed || pathL.endsWith('/' + tailNeed) || pathL.endsWith(tailNeed)))
                return;
            var comps = (n._components || []);
            for (var i = 0; i < comps.length; i++) {
                var c = comps[i];
                if (c && typeof c.string !== 'undefined') {
                    var text = String(c.string == null ? '' : c.string).trim();
                    if (!text)
                        continue;
                    var sec = parseSec(text);
                    if (sec == null)
                        continue;
                    found = {
                        sec: sec,
                        tail: path
                    };
                    break;
                }
            }
        });
        if (found && found.sec != null) {
            S._progTail = found.tail || '';
            S._progIsSec = true;
            window.__cw_prog_tail = S._progTail;
            return found.sec;
        }
        S._progTail = '';
        try {
            window.__cw_prog_tail = '';
        } catch (_) {}
        return null;
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
                var fullTail = fullPath(n, 200);
                out.push({
                    text: text,
                    x: r.x,
                    y: r.y,
                    w: r.w,
                    h: r.h,
                    sx: r.sx,
                    sy: r.sy,
                    sw: r.sw,
                    sh: r.sh,
                    node: n,
                    tail: tail,
                    tl: tail.toLowerCase(),
                    fullTail: fullTail,
                    fullTl: String(fullTail || '').toLowerCase(),
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
    function collectButtons(opt) {
        opt = opt || {};
        var allowOutsideGame = !!opt.allowOutsideGame;
        var tailNeedle = String(opt.tailNeedle || '').toLowerCase();
        var out = [];
        walkNodes(function (n) {
            if (!allowOutsideGame && !nodeInGame(n))
                return;
            var full = fullPath(n, 200);
            var fullL = String(full || '').toLowerCase();
            if (tailNeedle && fullL.indexOf(tailNeedle) === -1)
                return;
            var btns = getComps(n, cc.Button);
            if (btns && btns.length) {
                var r = wRect(n);
                var tail = tailOf(n, 12);
                out.push({
                    x: r.x,
                    y: r.y,
                    w: r.w,
                    h: r.h,
                    sx: r.sx,
                    sy: r.sy,
                    sw: r.sw,
                    sh: r.sh,
                    node: n,
                    tail: tail,
                    tl: String(tail || '').toLowerCase(),
                    fullTail: full,
                    fullTl: fullL,
                    btnCount: btns.length
                });
            }
        });
        return out;
    }
    function buildBetRectsForMap() {
        var raw = collectButtons({
            allowOutsideGame: true,
            tailNeedle: 'betnode'
        });
        var out = [];
        var st = {
            buttons: raw.length,
            betCandidate: 0,
            rectInvalid: 0,
            rectRecovered: 0,
            rectProjected: 0,
            rectAdjusted: 0,
            rectClamped: 0,
            syntheticPlaced: 0,
            out: 0
        };
        for (var i = 0; i < raw.length; i++) {
            var B = raw[i];
            var x = Math.round(B.x),
            y = Math.round(B.y),
            w = Math.round(B.w),
            h = Math.round(B.h);
            st.betCandidate++;
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
                    var anc = B.node || null;
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
                        w = 26;
                    if (!isFinite(h) || h < 2)
                        h = 18;
                    var projectedHit = false;
                    try {
                        var sp2 = _nodeToScreen(B.node);
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
            if (w < 16 || h < 12)
                continue;
            out.push({
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
                tail: B.tail,
                tl: B.tl,
                tailFull: B.fullTail,
                tlFull: B.fullTl,
                btnCount: B.btnCount
            });
        }
        st.out = out.length;
        try {
            window.__cw_betStats = st;
        } catch (_) {}
        return out;
    }
    function collectProgress() {
        var cd = readCountdownSec();
        if (cd != null)
            return cd;
        S._progIsSec = false;
        S._progTail = '';
        try {
            window.__cw_prog_tail = '';
        } catch (_) {}
        return null;
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
                xRaw: L.x,
                yRaw: L.y,
                w: w,
                h: h,
                sx: L.sx,
                sy: L.sy,
                sw: L.sw,
                sh: L.sh,
                n: {
                    x: x / innerWidth,
                    y: y / innerHeight,
                    w: w / innerWidth,
                    h: h / innerHeight
                },
                tail: L.tail,
                tl: L.tl,
                tailFull: L.fullTail,
                tlFull: L.fullTl
            });
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
                sx: _num(L.sx, x),
                sy: _num(L.sy, y),
                sw: _num(L.sw, w),
                sh: _num(L.sh, h),
                n: {
                    x: x / innerWidth,
                    y: y / innerHeight,
                    w: w / innerWidth,
                    h: h / innerHeight
                },
                tail: L.tail,
                tl: L.tl,
                tailFull: L.fullTail,
                tlFull: L.fullTl
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
    function _num(v, dft) {
        v = Number(v);
        return isFinite(v) ? v : (dft || 0);
    }
    function _nodeWorldAr(node) {
        try {
            return node.convertToWorldSpaceAR(new V2(0, 0));
        } catch (e) {}
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
        } catch (e4) {}
        return out;
    }
    function buildTextRects(opts) {
        opts = opts || {};
        var allowDomFallback = !!opts.allowDomFallback;
        var domLimit = Number(opts.domLimit) || 200;
        var ls = collectLabels();
        var out = [];
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
                        w = Math.max(16, Math.min(360, s.length * 7));
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
                    y: L.y + L.h / 2,
                    w: L.w,
                    h: L.h,
                    tail: L.tail,
                    fullTail: L.fullTail,
                    txt: s
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
                    y: L2.y + L2.h / 2,
                    w: L2.w,
                    h: L2.h,
                    tail: L2.tail,
                    fullTail: L2.fullTail,
                    txt: s2
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

    var TK_SEQ_MAX = 55;
    function limitSeq55(seq) {
        if (!seq)
            return '';
        if (seq.length <= TK_SEQ_MAX)
            return seq;
        return seq.slice(-TK_SEQ_MAX);
    }
    function normalizeSeqCL(seq) {
        seq = String(seq || '').toUpperCase();
        var out = '';
        for (var i = 0; i < seq.length; i++) {
            var ch = seq.charAt(i);
            if (ch === 'C' || ch === 'L')
                out += ch;
            else if (ch === '0')
                out += 'C';
            else if (ch === '1')
                out += 'L';
        }
        return limitSeq55(out);
    }
    function readTKSeqDigits() {
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
        var cols = clusterByX(cells); // TRA?I?+'PH???I
        var parts = [],
        i;
        for (i = 0; i < cols.length; i++) {
            var c = cols[i];
            var topDown = (i % 2 === 0); // c??Tt 1 T?+", c??Tt 2 B?+`, ...
            var arr = c.items.slice();
            if (topDown) {
                arr.reverse();
            }
            var s = '',
            k;
            for (k = 0; k < arr.length; k++)
                s += String(arr[k].v);
            parts.push(s);
        }
        var seq = limitSeq55(parts.join(''));
        return {
            seq: normalizeSeqCL(seq),
            which: which,
            cols: cols,
            cells: cells
        };
    }

    var TAIL_SOICAU_MIDNODE = 'sede/Canvas/mainPlay/midNode/soicau';
    var TAIL_SOICAU_NORMAL_MULTI = 'prefab_game_14/root/node_in_multimode/HUD/soicau_popup_multi/root/soicau_normal/ig_soicau_xocdia/content';
    var TAIL_SOICAU_NORMAL_FULL = 'prefab_game_14/root/node_in_fullmode/HUD/soicau_popup_fullmode/root/soicau_normal/ig_soicau_xocdia/content';

    function beadVal(name, nodeName) {
        var s = (String(name || '') + ' ' + String(nodeName || '')).toLowerCase();
        var hasLe = /(^|[^a-z])(le|odd|do|red)([^a-z]|$)/.test(s);
        var hasChan = /(^|[^a-z])(chan|even|trang|white)([^a-z]|$)/.test(s);
        if (hasLe && !hasChan)
            return 'L';
        if (hasChan && !hasLe)
            return 'C';
        return '?';
    }

    function isNodeActive(n) {
        if (!n)
            return false;
        if (typeof n.activeInHierarchy !== 'undefined')
            return !!n.activeInHierarchy;
        if (typeof n._activeInHierarchy !== 'undefined')
            return !!n._activeInHierarchy;
        if (typeof n.active !== 'undefined')
            return !!n.active;
        return true;
    }

    function pickCoord(scr, world) {
        return (scr != null && !isNaN(scr)) ? scr : world;
    }

    function beadRectFallback(n, r) {
        if (!r)
            r = {
                x: 0,
                y: 0,
                w: 0,
                h: 0,
                sx: 0,
                sy: 0,
                sw: 0,
                sh: 0
            };
        var zero = (!r.x && !r.y && !r.w && !r.h && !r.sx && !r.sy && !r.sw && !r.sh);
        if (!zero)
            return r;
        try {
            if (n && n.getBoundingBoxToWorld) {
                var bb = n.getBoundingBoxToWorld();
                if (bb && (bb.width || bb.height || bb.x || bb.y)) {
                    var bw = bb.width || 0,
                    bh = bb.height || 0;
                    var cx = (bb.x || 0) + bw / 2;
                    var cy = (bb.y || 0) + bh / 2;
                    var spc = toScreenPt(n, new V2(cx, cy));
                    var sp1 = toScreenPt(n, new V2(bb.x || 0, bb.y || 0));
                    var sp2 = toScreenPt(n, new V2((bb.x || 0) + bw, (bb.y || 0) + bh));
                    return {
                        x: cx,
                        y: cy,
                        w: bw,
                        h: bh,
                        sx: spc.x,
                        sy: spc.y,
                        sw: Math.abs(sp2.x - sp1.x),
                        sh: Math.abs(sp2.y - sp1.y)
                    };
                }
            }
        } catch (e) {}
        try {
            if (n && n.getPosition) {
                var p = n.getPosition();
                var sp = toScreenPt(n, p);
                return {
                    x: p.x || 0,
                    y: p.y || 0,
                    w: r.w || 0,
                    h: r.h || 0,
                    sx: sp.x,
                    sy: sp.y,
                    sw: r.sw || 0,
                    sh: r.sh || 0
                };
            }
        } catch (e) {}
        return r;
    }

    function collectBeadsByTail(tailNeedle, opt) {
        opt = opt || {};
        var allowOutsideGame = !!opt.allowOutsideGame;
        var out = [];
        var needle = String(tailNeedle || '').toLowerCase();
        walkNodes(function (n) {
            if (!allowOutsideGame && !nodeInGame(n))
                return;
            if (!isNodeActive(n))
                return;
            var full = fullPath(n, 140);
            if (!full)
                return;
            if (String(full).toLowerCase().indexOf(needle) === -1)
                return;
            var comps = (n._components || []);
            for (var i = 0; i < comps.length; i++) {
                var c = comps[i];
                var sf = c && (c.spriteFrame || c._spriteFrame);
                if (!sf)
                    continue;
                var name = sf.name || sf._name || (sf._texture && sf._texture.name) || '';
                var v = beadVal(name, n.name || '');
                if (v === '?')
                    continue;
                var r = beadRectFallback(n, wRect(n));
                var bx = pickCoord(r.sx, r.x);
                var by = pickCoord(r.sy, r.y);
                var inView = (bx >= -10 && bx <= innerWidth + 10 && by >= -10 && by <= innerHeight + 10);
                out.push({
                    v: v,
                    x: bx,
                    y: by,
                    xRaw: r.x,
                    yRaw: r.y,
                    w: r.w,
                    h: r.h,
                    sx: r.sx,
                    sy: r.sy,
                    sw: r.sw,
                    sh: r.sh,
                    inView: inView,
                    tail: full,
                    fullTail: full,
                    name: name,
                    node: (n && n.name) || ''
                });
            }
        });
        return out;
    }

    function visibleBeadCount(list) {
        var c = 0;
        for (var i = 0; i < list.length; i++) {
            var it = list[i];
            if (it && it.inView)
                c++;
        }
        return c;
    }

    function readTKSeqBeads() {
        var src = [{
                which: 'soicau_midnode',
                cells: collectBeadsByTail(TAIL_SOICAU_MIDNODE, {
                    allowOutsideGame: true
                })
            }, {
                which: 'soicau_normal_multi',
                cells: collectBeadsByTail(TAIL_SOICAU_NORMAL_MULTI, {
                    allowOutsideGame: true
                })
            }, {
                which: 'soicau_normal_full',
                cells: collectBeadsByTail(TAIL_SOICAU_NORMAL_FULL, {
                    allowOutsideGame: true
                })
            }
        ];
        var best = null;
        for (var s = 0; s < src.length; s++) {
            var it = src[s];
            var vis = visibleBeadCount(it.cells);
            var score = vis > 0 ? (100000 + vis) : it.cells.length;
            if (!best || score > best.score) {
                best = {
                    which: it.which,
                    cells: it.cells,
                    vis: vis,
                    score: score
                };
            }
        }
        var cells = (best && best.cells) ? best.cells.slice() : [];
        var which = best ? best.which : null;
        if (best && best.vis > 0) {
            var onlyView = [];
            for (var iV = 0; iV < cells.length; iV++) {
                if (cells[iV].inView)
                    onlyView.push(cells[iV]);
            }
            if (onlyView.length)
                cells = onlyView;
        }
        if (!cells.length)
            return {
                seq: '',
                which: null,
                cols: [],
                cells: []
            };
        var cols = clusterByX(cells); // x asc
        var parts = [],
        i;
        for (i = 0; i < cols.length; i++) {
            var c = cols[i];
            var arr = c.items.slice().sort(function (a, b) {
                return (i % 2 === 0) ? (a.y - b.y) : (b.y - a.y);
            });
            var s = '',
            k;
            for (k = 0; k < arr.length; k++)
                s += String(arr[k].v);
            parts.push(s);
        }
        var seq = limitSeq55(parts.join(''));
        return {
            seq: normalizeSeqCL(seq),
            which: which,
            cols: cols,
            cells: cells
        };
    }

    function readTKSeq() {
        var r = readTKSeqBeads();
        if (r && r.seq && r.seq.length)
            return r;
        var d = readTKSeqDigits();
        d.seq = normalizeSeqCL(d.seq);
        return d;
    }
    function refreshSeq55ByProg(p, forceScan) {
        forceScan = !!forceScan;
        var r = readTKSeq();
        var curr = normalizeSeqCL(r && r.seq ? r.seq : '');
        if (!curr) {
            if (forceScan)
                S.seq = '';
            return S.seq || '';
        }
        S.seq = curr;
        S._seqRaw = curr;
        S._seqWhich = (r && r.which) ? r.which : '';
        S._seqInit = true;
        S._seqLastScanTs = Date.now();
        return S.seq || '';
    }



        /* ---------------- helpers for totals by (y, tail) ---------------- */

        var TAIL_CHAN = 'sede/Canvas/mainPlay/midNode/betNode/gatebig/lblCashBet';
        var TAIL_LE = 'sede/Canvas/mainPlay/midNode/betNode/gatesmall/lblCashBet';
        var TAIL_TUTRANG = 'sede/Canvas/mainPlay/midNode/betNode/gate5/lblCashBet';
        var TAIL_3TRANG = 'sede/Canvas/mainPlay/midNode/betNode/gate2/lblCashBet';
        var TAIL_3DO = 'sede/Canvas/mainPlay/midNode/betNode/gate3/lblCashBet';
        var TAIL_TUDO = 'sede/Canvas/mainPlay/midNode/betNode/gate6/lblCashBet';

        var TAIL_ACC = 'dual/Canvas/node_dual/root/node_game(need_to_put_games_in_here)/prefab_game_14/root/node_general(use_in_both_mode)/table/playersview/lbl_user_money';

        var X_ACC = 303;

        var TAIL_USER_NAME = 'dual/Canvas/node_dual/root/node_game(need_to_put_games_in_here)/prefab_game_14/root/node_general(use_in_both_mode)/table/playersview/lbl_user_name';
        var TAIL_PROFILE_USER_NAME = 'HomeScene/Canvas/AccountLogin/Header/nodeInfoPlayer/info/lblAccName';
        var TAIL_PROFILE_ACCOUNT = 'HomeScene/Canvas/AccountLogin/Header/nodeInfoPlayer/gold/lblCoin';
        var TAIL_PROFILE_USER_NAME_INGAME = 'sede/Canvas/GateHeaderInGame/info/lblAccName';
        var TAIL_PROFILE_ACCOUNT_INGAME_1 = 'sede/Canvas/GateHeaderInGame/gold/lblCoin';
        var TAIL_PROFILE_ACCOUNT_INGAME_2 = 'sede/Canvas/GateHeaderInGame/info/lblCoin';
        var USERNAME_TAILS_EXACT = [
            TAIL_PROFILE_USER_NAME,
            TAIL_PROFILE_USER_NAME_INGAME,
            TAIL_USER_NAME
        ];
        var ACCOUNT_TAILS_EXACT = [
            TAIL_PROFILE_ACCOUNT,
            TAIL_PROFILE_ACCOUNT_INGAME_1,
            TAIL_PROFILE_ACCOUNT_INGAME_2,
            TAIL_ACC
        ];

        var X_USER_NAME = 274;

        var Y_CHAN = 641;

        var Y_LE = 643;


        function findNodeByTailStrictLocal(tail) {
            try {
                tail = String(tail || '').trim();
                if (!tail)
                    return null;
                if (window.findNodeByTailCompat)
                    return window.findNodeByTailCompat(tail);
                if (window.__abx_findNodeByTail)
                    return window.__abx_findNodeByTail(tail);
                if (!window.cc || !cc.director || !cc.director.getScene)
                    return null;
                var scene = cc.director.getScene();
                if (!scene)
                    return null;
                var parts = tail.split('/').filter(Boolean);
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
            } catch (_) {
                return null;
            }
        }
        function getNodeTextLocal(node) {
            try {
                if (!node || !node.getComponent)
                    return '';
                var lbl = node.getComponent(cc.Label);
                if (lbl && lbl.string != null)
                    return String(lbl.string);
                var rt = node.getComponent(cc.RichText);
                if (rt && rt.string != null)
                    return String(rt.string);
            } catch (_) {}
            return '';
        }
        function readNodeTextByTailListExact(tails, opt) {
            opt = opt || {};
            tails = tails || [];
            for (var i = 0; i < tails.length; i++) {
                var tail = String(tails[i] || '').trim();
                if (!tail)
                    continue;
                var node = findNodeByTailStrictLocal(tail);
                var txt = String(getNodeTextLocal(node) || '').trim();
                if (!txt)
                    continue;
                if (opt.moneyOnly && moneyOf(txt) == null)
                    continue;
                if (opt.nonMoneyOnly && moneyOf(txt) != null)
                    continue;
                return txt.replace(/\s+/g, ' ');
            }
            return '';
        }
        function readUsernameSafe() {
            try {
                return readNodeTextByTailListExact(USERNAME_TAILS_EXACT);
            } catch (_) {
                return '';
            }
        }
        function readAccountSafe() {
            try {
                return readNodeTextByTailListExact(ACCOUNT_TAILS_EXACT, {
                    moneyOnly: true
                });
            } catch (_) {
                return '';
            }
        }
        window.readUsernameSafe = readUsernameSafe;
        window.readAccountSafe = readAccountSafe;
        window.__cw_profile_probe = function () {
            var username = '';
            var accountRaw = '';
            var byUserTail = [];
            var byAccountTail = [];
            try {
                username = readUsernameSafe() || '';
            } catch (_) {}
            try {
                accountRaw = readAccountSafe() || '';
            } catch (_) {}
            try {
                for (var i = 0; i < USERNAME_TAILS_EXACT.length; i++) {
                    var ut = String(USERNAME_TAILS_EXACT[i] || '');
                    var un = findNodeByTailStrictLocal(ut);
                    var uv = String(getNodeTextLocal(un) || '').trim();
                    byUserTail.push({
                        tail: ut,
                        text: uv
                    });
                }
            } catch (_) {}
            try {
                for (var j = 0; j < ACCOUNT_TAILS_EXACT.length; j++) {
                    var at = String(ACCOUNT_TAILS_EXACT[j] || '');
                    var an = findNodeByTailStrictLocal(at);
                    var avRaw = String(getNodeTextLocal(an) || '').trim();
                    byAccountTail.push({
                        tail: at,
                        text: avRaw,
                        val: moneyOf(avRaw)
                    });
                }
            } catch (_) {}
            return {
                username: username,
                accountRaw: accountRaw,
                accountVal: moneyOf(accountRaw),
                byUserTail: byUserTail,
                byAccountTail: byAccountTail,
                tails: {
                    username: USERNAME_TAILS_EXACT.slice(),
                    account: ACCOUNT_TAILS_EXACT.slice()
                },
                ts: Date.now()
            };
        };

        function tailEquals(t, exact) {

            if (t == null)

                return false;

            var s1 = String(t),

            s2 = String(exact);

            return s1 === s2 || s1.toLowerCase() === s2.toLowerCase();

        }

        function tailOfMoney(it) {

            return it && (it.tailFull || it.tail);

        }

        function yOf(it) {

            return it && (it.yRaw != null ? it.yRaw : it.y);

        }

        function xOf(it) {

            return it && (it.xRaw != null ? it.xRaw : it.x);

        }

        /** return full list (not truncated) filtered by tail */

        function moneyTailList(tailExact) {

            var list = buildMoneyRects();

            var out = [];

            for (var i = 0; i < list.length; i++) {

                var it = list[i];

                if (tailEquals(tailOfMoney(it), tailExact))

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

                if (tailEquals(tailOfMoney(it), tailExact))

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

        /** pick by exact x under the given tail (no nearest fallback) */

        function pickByXTailExact(list, xTarget, tailExact) {

            for (var i = 0; i < list.length; i++) {

                var it = list[i];

                if (!tailEquals(tailOfMoney(it), tailExact))

                    continue;

                if (Math.round(xOf(it)) === xTarget)

                    return it;

            }

            return null;

        }

        function pickByXTailNear(list, xTarget, tailExact, tolX) {
            tolX = (tolX == null ? 2 : tolX);
            for (var i = 0; i < list.length; i++) {
                var it = list[i];
                if (!tailEquals(tailOfMoney(it), tailExact))
                    continue;
                if (Math.abs(Math.round(xOf(it)) - xTarget) > tolX)
                    continue;
                return it;
            }
            return null;
        }

        function pickByTailNearestX(list, tailExact, xPrev) {
            var cands = [];
            for (var i = 0; i < list.length; i++) {
                var it = list[i];
                if (!tailEquals(tailOfMoney(it), tailExact))
                    continue;
                cands.push(it);
            }
            if (cands.length === 0)
                return null;
            if (xPrev != null && !isNaN(xPrev)) {
                var best = null, bestD = 1e9;
                for (var j = 0; j < cands.length; j++) {
                    var it2 = cands[j];
                    var d = Math.abs(Math.round(xOf(it2)) - xPrev);
                    if (d < bestD) {
                        bestD = d;
                        best = it2;
                    }
                }
                return best;
            }
            var pick = cands[0];
            for (var k = 1; k < cands.length; k++) {
                var it3 = cands[k];
                var y1 = Math.round(yOf(pick)), y2 = Math.round(yOf(it3));
                if (y2 < y1 || (y2 === y1 && Math.round(xOf(it3)) < Math.round(xOf(pick))))
                    pick = it3;
            }
            return pick;
        }

        /** pick by min y under the given tail */
        function pickByTailMinY(list, tailExact) {
            var best = null;
            var bestY = 1e9;
            for (var i = 0; i < list.length; i++) {
                var it = list[i];
                if (!tailEquals(tailOfMoney(it), tailExact))
                    continue;
                var yy = Math.round(yOf(it));
                if (yy < bestY) {
                    bestY = yy;
                    best = it;
                }
            }
            return best;
        }

        function pickByTailNearX(list, tailExact, xTarget, tolX) {
            tolX = (tolX == null ? 3 : tolX);
            var best = null, bestD = 1e9;
            for (var i = 0; i < list.length; i++) {
                var it = list[i];
                if (!tailEquals(tailOfMoney(it), tailExact))
                    continue;
                var d = Math.abs(Math.round(xOf(it)) - xTarget);
                if (d > tolX)
                    continue;
                if (d < bestD) {
                    bestD = d;
                    best = it;
                }
            }
            return best;
        }

        function pickTextByXTailExact(xTarget, tailExact) {

            return pickByXTailExact(buildTextRects(), xTarget, tailExact);

        }

        function pickTextByXTailNear(xTarget, tailExact, tolX) {

            return pickByXTailNear(buildTextRects(), xTarget, tailExact, tolX);

        }

                /** pick by exact y under the given tail (no nearest fallback) */
        function pickByYTail(list, yTarget, tailExact, tol) {
            tol = (tol == null ? 0 : tol);
            var arr = [];
            for (var i = 0; i < list.length; i++) {
                var it = list[i];
                if (tailEquals(tailOfMoney(it), tailExact))
                    arr.push(it);
            }
            for (var j = 0; j < arr.length; j++) {
                if (Math.abs(Math.round(yOf(arr[j])) - yTarget) <= tol)
                    return arr[j];
            }
            return null;
        }

        function pickByYTailExclude(list, yTarget, tailExact, exclude, tol) {
            tol = (tol == null ? 0 : tol);
            var arr = [];
            for (var i = 0; i < list.length; i++) {
                var it = list[i];
                if (exclude && it === exclude)
                    continue;
                if (tailEquals(tailOfMoney(it), tailExact))
                    arr.push(it);
            }
            for (var j = 0; j < arr.length; j++) {
                if (Math.abs(Math.round(yOf(arr[j])) - yTarget) <= tol)
                    return arr[j];
            }
            return null;
        }

/** pick first item by tail (sorted by y,x) */

        function pickByTail(list, tailExact) {

            var arr = [];

            for (var i = 0; i < list.length; i++) {

                var it = list[i];

                if (tailEquals(tailOfMoney(it), tailExact))

                    arr.push(it);

            }

            if (!arr.length)

                return null;

            arr.sort(function (a, b) {

                return a.y - b.y || a.x - b.x;

            });

            return arr[0];

        }

        /** pick by left/right (min/max x) under the given tail */

        function pickByXOrderTail(list, tailExact, which) {

            var arr = [];

            for (var i = 0; i < list.length; i++) {

                var it = list[i];

                if (tailEquals(tailOfMoney(it), tailExact))

                    arr.push(it);

            }

            if (!arr.length)

                return null;

            arr.sort(function (a, b) {

                return xOf(a) - xOf(b) || yOf(a) - yOf(b);

            });

            return (which === 'max') ? arr[arr.length - 1] : arr[0];

        }

        function buildMoneyFromTextRects() {

            var texts = buildTextRects();

            var out = [];

            for (var i = 0; i < texts.length; i++) {

                var t = texts[i];

                if (!isMoneyText(t.text))

                    continue;

                out.push({
                    txt: t.text,
                    val: moneyOf(t.text),
                    x: t.x,
                    y: t.y,
                    xRaw: t.x,
                    yRaw: t.y,
                    w: t.w,
                    h: t.h,
                    sx: t.sx,
                    sy: t.sy,
                    sw: t.sw,
                    sh: t.sh,
                    n: {
                        x: t.x / innerWidth,
                        y: t.y / innerHeight,
                        w: t.w / innerWidth,
                        h: t.h / innerHeight
                    },
                    tail: t.tail,
                    tl: String(t.tail || '').toLowerCase(),
                    tailFull: t.tail,
                    tlFull: String(t.tail || '').toLowerCase()
                });

            }

            return out;

        }

        function chanLeDebugLines(list, title) {

            var rawC = readNodeTextByTailListExact([TAIL_CHAN], {
                moneyOnly: true
            });
            var rawL = readNodeTextByTailListExact([TAIL_LE], {
                moneyOnly: true
            });
            var lines = ['(' + (title || 'Chan/Le by exact tails') + ')'];
            lines.push("CHAN\t'" + String(rawC || '') + "'\t" + String(moneyOf(rawC)));
            lines.push("LE\t'" + String(rawL || '') + "'\t" + String(moneyOf(rawL)));
            lines.push("tailCHAN\t'" + TAIL_CHAN + "'");
            lines.push("tailLE\t'" + TAIL_LE + "'");
            return lines;

        }

        function debugChanLeLog(list, title) {

            setCwLog(chanLeDebugLines(list, title).join('\n'));

        }

        // Export standardized helpers

        window.moneyTailList = moneyTailList;

        window.pickByXTail = pickByXTail;

        window.pickByYTail = pickByYTail;

        window.pickByTail = pickByTail;

        window.cwPickChan = function () {
            var raw = readNodeTextByTailListExact([TAIL_CHAN], {
                moneyOnly: true
            });
            return {
                txt: raw || '',
                val: moneyOf(raw),
                tail: TAIL_CHAN
            };
        };

        window.cwPickLe = function () {
            var raw = readNodeTextByTailListExact([TAIL_LE], {
                moneyOnly: true
            });
            return {
                txt: raw || '',
                val: moneyOf(raw),
                tail: TAIL_LE
            };
        };


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
        var list = buildMoneyFromTextRects();
        var accByTail = pickByTailMinY(list, TAIL_ACC);
        if (accByTail) {
            S.selAcc = {
                tail: accByTail.tailFull || accByTail.tail,
                anchorN: {
                    x: accByTail.n.x,
                    y: accByTail.n.y,
                    w: accByTail.n.w,
                    h: accByTail.n.h
                }
            };
        } else {
            S.selAcc = null;
        }
        return;
    }

    /* ---------------- totals (using exact bet tails) ---------------- */
    function totals(S) {
        S.money = buildMoneyRects(); // keep map for overlays & legacy helpers

        var mSD = null;

        var rawC = '';
        var rawL = '';
        var rawTT = '';
        var rawT3T = '';
        var rawT3D = '';
        var rawTD = '';
        try {
            rawC = readNodeTextByTailListExact([TAIL_CHAN], {
                moneyOnly: true
            });
        } catch (_) {
            rawC = '';
        }
        try {
            rawL = readNodeTextByTailListExact([TAIL_LE], {
                moneyOnly: true
            });
        } catch (_) {
            rawL = '';
        }
        try {
            rawTT = readNodeTextByTailListExact([TAIL_TUTRANG], {
                moneyOnly: true
            });
        } catch (_) {
            rawTT = '';
        }
        try {
            rawT3T = readNodeTextByTailListExact([TAIL_3TRANG], {
                moneyOnly: true
            });
        } catch (_) {
            rawT3T = '';
        }
        try {
            rawT3D = readNodeTextByTailListExact([TAIL_3DO], {
                moneyOnly: true
            });
        } catch (_) {
            rawT3D = '';
        }
        try {
            rawTD = readNodeTextByTailListExact([TAIL_TUDO], {
                moneyOnly: true
            });
        } catch (_) {
            rawTD = '';
        }

        var valC = moneyOf(rawC);
        var valL = moneyOf(rawL);
        var valTT = moneyOf(rawTT);
        var valT3T = moneyOf(rawT3T);
        var valT3D = moneyOf(rawT3D);
        var valTD = moneyOf(rawTD);

        var rawName = '';
        var rawAcc = '';
        try {
            rawName = readUsernameSafe() || '';
        } catch (_) {
            rawName = '';
        }
        try {
            rawAcc = readAccountSafe() || '';
        } catch (_) {
            rawAcc = '';
        }
        var valAcc = moneyOf(rawAcc);

        return {
            C: (valC == null ? null : valC),
            L: (valL == null ? null : valL),
            A: (valAcc == null ? null : valAcc),
            N: (rawName ? String(rawName) : null),
            SD: mSD ? mSD.val : null,
            TT: (valTT == null ? null : valTT),
            T3T: (valT3T == null ? null : valT3T),
            T3D: (valT3D == null ? null : valT3D),
            TD: (valTD == null ? null : valTD),
            rawC: (rawC ? String(rawC) : null),
            rawL: (rawL ? String(rawL) : null),
            rawA: (rawAcc ? String(rawAcc) : null),
            rawN: (rawName ? String(rawName) : null),
            rawSD: mSD ? mSD.txt : null,
            rawTT: (rawTT ? String(rawTT) : null),
            rawT3T: (rawT3T ? String(rawT3T) : null),
            rawT3D: (rawT3D ? String(rawT3D) : null),
            rawTD: (rawTD ? String(rawTD) : null)
        };
    }

    function sampleTotalsNow() {
        try {
            return totals(S);
        } catch (e) {
            return {
                C: null,
                L: null,
                A: null,
                N: null
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
        moneyMap: [],
        betMap: [],
        text: [],
        selC: null,
        selL: null,
        selAcc: null,
        focus: null,
        showMoney: false,
        showBet: false,
        showText: false,
        stakeK: 1,
        seq: '',
        _seqRaw: '',
        _seqWhich: '',
        _seqInit: false,
        _seqLastScanTs: 0
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
        '<button id="bScanTK">ScanTK</button>' +
        '</div>' +
        '<div style="display:flex;gap:10px;align-items:center;margin-bottom:6px">' +
        '<span>Tiền (×1K)</span>' +
        '<input id="iStake" value="1" style="width:60px;background:#0b1b16;border:1px solid #3a6;color:#bff;padding:2px 4px;border-radius:4px">' +
        '<button id="bBetC">Bet CHẴN</button>' +
        '<button id="bBetL">Bet LẺ</button>' +
        '</div>' +
        '<div id="cwInfo" style="white-space:pre;color:#9f9;line-height:1.45"></div>' +
        '<div style="display:flex;gap:6px;align-items:center;margin-top:6px">' +
        '<b style="color:#9f9">Log</b>' +
        '<button id="bCopyLog">CopyLog</button>' +
        '<button id="bClearLog">ClearLog</button>' +
        '<span id="cwLogHint" style="color:#7aa"></span>' +
        '</div>' +
        '<div id="cwLog" style="white-space:pre-wrap;color:#bff;background:#0b1b16;border:1px solid #2a5;padding:6px;border-radius:6px;max-height:220px;overflow:auto"></div>';
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
    var cwLogEl = panel.querySelector('#cwLog');
    function setLogHint(s) {
        var h = panel.querySelector('#cwLogHint');
        if (!h)
            return;
        h.textContent = s || '';
        if (s) {
            setTimeout(function () {
                if (h.textContent === s)
                    h.textContent = '';
            }, 1200);
        }
    }
    function setCwLog(text) {
        var t = text || '';
        if (cwLogEl)
            cwLogEl.textContent = t;
        window.__cw_lastLog = t;
    }
    function clearCwLog() {
        setCwLog('');
        setLogHint('cleared');
    }
    function copyCwLog() {
        var t = (cwLogEl && cwLogEl.textContent) || '';
        if (!t) {
            setLogHint('empty');
            return;
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(t).then(function () {
                setLogHint('copied');
            }, function () {
                fallbackCopy(t);
            });
            return;
        }
        fallbackCopy(t);
    }
    function fallbackCopy(t) {
        try {
            var ta = document.createElement('textarea');
            ta.value = t;
            ta.setAttribute('readonly', 'readonly');
            ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px;';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            setLogHint('copied');
        } catch (e) {
            setLogHint('copy-fail');
        }
    }

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
    focusBox.style.cssText = 'position:fixed;border:2px solid #f00;background:#ff000015;display:none;pointer-events:none;z-index:2147483647;';
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
        var btns = S.betMap && S.betMap.length ? S.betMap : buildBetRectsForMap();
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
                            h: b.h,
                            sx: b.sx,
                            sy: b.sy,
                            sw: b.sw,
                            sh: b.sh
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
            var idx = (t.idx != null ? t.idx : (i + 1));
            if (t.idx == null)
                t.idx = idx;
            var d = document.createElement('div');
            d.style.cssText = 'position:fixed;outline:1px dashed #88f;background:#8888ff22;color:#ffd866;font:11px/1.2 Consolas,monospace;padding:1px 3px;box-sizing:border-box;text-shadow:0 0 2px #000;';
            var st = cssRect(t);
            for (var k in st) {
                d.style[k] = st[k];
            }
            d.title = '"' + t.text + '"\n' + t.tail;
            d.textContent = String(idx);
            d.onmousedown = (function (t) {
                return function (ev) {
                    if (ev)
                        ev.stopPropagation();
                    S.focus = {
                        rect: {
                            x: t.x,
                            y: t.y,
                            w: t.w,
                            h: t.h,
                            sx: t.sx,
                            sy: t.sy,
                            sw: t.sw,
                            sh: t.sh
                        },
                        idx: t.idx,
                        tail: t.tail,
                        txt: t.text,
                        val: moneyOf(t.text),
                        kind: 'text'
                    };
                    showFocus(S.focus.rect);
                    updatePanel();
                };
            })(t);
            d.onmouseup = function (ev) {
                if (ev)
                    ev.stopPropagation();
            };
            layerText.appendChild(d);
        }
        layerText.onmousedown = function () {
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
            N: null,
            rawC: null,
            rawL: null,
            rawA: null,
            rawN: null
        };
        var f = S.focus;
        var progText = (S.prog == null ? '--' : (S._progIsSec ? (S.prog + 's') : (((S.prog * 100) | 0) + '%')));
        var userName = (t.N != null && String(t.N).trim()) ? String(t.N).trim() : '';
        if (!userName && typeof window.readUsernameSafe === 'function') {
            try {
                userName = window.readUsernameSafe() || '';
            } catch (_) {
                userName = '';
            }
        }
        var accVal = (t.A != null ? t.A : null);
        if (accVal == null && typeof window.readAccountSafe === 'function') {
            try {
                accVal = moneyOf(window.readAccountSafe() || '');
            } catch (_) {
                accVal = null;
            }
        }
        var base =
            ' Trạng thái: ' + S.status + ' | Prog: ' + progText + '\n' +
            '• TÊN NHÂN VẬT : ' + (userName || '--') + '|TK : ' + fmt(accVal) + '|CHẴN: ' + fmt(t.C) + '|SẤP ĐÔI: ' + fmt(t.SD) + '|LẺ :' + fmt(t.L) + '|TỨ TRẮNG: ' + fmt(t.TT) + '|3 TRẮNG: ' + fmt(t.T3T) + '|3 ĐỎ: ' + fmt(t.T3D) + '|TỨ ĐỎ: ' + fmt(t.TD) + '\n' +

            '• Focus: ' + (f ? f.kind : '-') + '\n' +
            '  idx : ' + (f && f.idx != null ? f.idx : '-') + '\n' +
            '  tail: ' + (f ? f.tail : '-') + '\n' +
            '  text: ' + (f ? (f.txt != null ? f.txt : '-') : '-') + '\n' +
            '  x,y,w,h: ' + (f && f.rect ? (Math.round(f.rect.x) + ',' + Math.round(f.rect.y) + ',' + Math.round(f.rect.w) + ',' + Math.round(f.rect.h)) : '-') + '\n' +
            '  val : ' + (f && f.val != null ? fmt(f.val) : '-');

        S.seq = refreshSeq55ByProg(S.prog, false) || '';
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
        var MAX_SCAN_MONEY_ROWS = 200;
        var money = [];
        var st = {};
        window.__cw_in_scan200money = 1;
        try {
            money = buildMoneyRectsForMap().sort(function (a, b) {
                return a.y - b.y;
            })
                .slice(0, MAX_SCAN_MONEY_ROWS)
                .map(function (m) {
                    return {
                        txt: m.txt,
                        val: m.val,
                        x: m.x,
                        y: m.y,
                        w: m.w,
                        h: m.h,
                        sx: m.sx,
                        sy: m.sy,
                        sw: m.sw,
                        sh: m.sh,
                        tail: m.tail,
                        tailFull: m.tailFull
                    };
                });
            try {
                var hasVal = {};
                for (var hv = 0; hv < money.length; hv++) {
                    var vv = Math.floor(+money[hv].val || 0);
                    if (vv > 0)
                        hasVal[String(vv)] = 1;
                }
                var chipMap = null;
                if (window.__cw_last_chip_map && typeof window.__cw_last_chip_map === 'object')
                    chipMap = window.__cw_last_chip_map;
                if ((!chipMap || !Object.keys(chipMap).length) && typeof window.cwScanChips === 'function')
                    chipMap = window.cwScanChips() || {};
                var order = (typeof CHIP_SCAN_ORDER !== 'undefined' && CHIP_SCAN_ORDER && CHIP_SCAN_ORDER.slice) ? CHIP_SCAN_ORDER.slice() : [1000, 5000, 10000, 50000, 200000, 1000000, 5000000];
                var fromChipMap = 0;
                for (var oi = 0; oi < order.length; oi++) {
                    var dv = Math.floor(+order[oi] || 0);
                    if (!dv || hasVal[String(dv)])
                        continue;
                    var info = chipMap ? chipMap[String(dv)] : null;
                    if (!info)
                        continue;
                    var rr = screenRect(info.rect || rectFromNodeScreen(info.node));
                    if (!rr)
                        continue;
                    if (!rectVisibleOnScreen(rr, 12, 12))
                        continue;
                    var p = '';
                    try {
                        p = String(fullPath(info.node, 180) || '');
                    } catch (_) {}
                    money.push({
                        txt: String(dv),
                        val: dv,
                        x: Math.round(rr.sx),
                        y: Math.round(rr.sy),
                        w: Math.round(rr.sw),
                        h: Math.round(rr.sh),
                        tail: p || ('chipmap/' + dv),
                        source: 'chipMap'
                    });
                    hasVal[String(dv)] = 1;
                    fromChipMap++;
                }
                if (fromChipMap > 0) {
                    money.sort(function (a, b) {
                        return a.y - b.y || a.x - b.x;
                    });
                    if (money.length > MAX_SCAN_MONEY_ROWS)
                        money = money.slice(0, MAX_SCAN_MONEY_ROWS);
                }
            } catch (_) {}
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
        var MAX_SCAN_BET_ROWS = 200;
        var btns = [];
        var st = {};
        try {
            btns = buildBetRectsForMap().sort(function (a, b) {
                return a.y - b.y || a.x - b.x;
            }).slice(0, MAX_SCAN_BET_ROWS)
                .map(function (b) {
                    return {
                        x: b.x,
                        y: b.y,
                        w: b.w,
                        h: b.h,
                        tail: b.tail
                    };
                });
            st = window.__cw_betStats || {};

            console.log('[Scan200Bet] buttons=' + (st.buttons || 0) +
                ' candidates=' + (st.betCandidate || 0) +
                ' invalidRect=' + (st.rectInvalid || 0) +
                ' recovered=' + (st.rectRecovered || 0) +
                ' projected=' + (st.rectProjected || 0) +
                ' clamped=' + (st.rectClamped || 0) +
                ' synthetic=' + (st.syntheticPlaced || 0) +
                ' adjusted=' + (st.rectAdjusted || 0) +
                ' out=' + (st.out || 0));

            console.log('(Bet index x' + MAX_SCAN_BET_ROWS + ')\tx\ty\tw\th\ttail');
            for (var i = 0; i < btns.length; i++) {
                var r = btns[i];
                console.log(i + "\t" + r.x + "\t" + r.y + "\t" + r.w + "\t" + r.h + "\t'" + r.tail + "'");
            }
            try {
                console.table(btns);
            } catch (e) {
                console.log(btns);
            }
            try {
                window.__cw_last_scan_bet = btns;
                window.__cw_last_scan_bet_summary = {
                    buttons: st.buttons || 0,
                    betCandidate: st.betCandidate || 0,
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
            return btns;
        } catch (err) {
            try {
                var msg = String((err && err.message) || err || 'scan-bet-failed');
                console.warn('[Scan200Bet][ERR]', msg);
                window.__cw_last_scan_bet = [];
                window.__cw_last_scan_bet_summary = {
                    buttons: 0,
                    betCandidate: 0,
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
        } finally {
            try {
                window.__cw_in_scan200money = 0;
            } catch (_) {}
        }
    }
    function scan200Text() {
        var MAX_SCAN_TEXT_ROWS = 200;
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
            } catch (_) {}
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
            } catch (_) {}
            return [];
        }
    }

    function scanTK() {
        var r = readTKSeq();
        r.seq = normalizeSeqCL(r.seq || '');
        var cells = (r && r.cells) ? r.cells.slice() : [];
        cells.sort(function (a, b) {
            return a.x - b.x || b.y - a.y;
        });
        var lines = [];
        lines.push('(TK sequence) which=' + (r && r.which ? r.which : '-') + ' cells=' + cells.length + ' seq=' + (r && r.seq ? r.seq : ''));
        lines.push('cells idx\tv\tx\ty\tw\th\ttail');
        for (var i = 0; i < cells.length; i++) {
            var c = cells[i];
            var tail = c.fullTail || c.tail || '';
            lines.push((i + 1) + "\t" + c.v + "\t" + Math.round(c.x) + "\t" + Math.round(c.y) + "\t" +
                Math.round(c.w || 0) + "\t" + Math.round(c.h || 0) + "\t'" + tail + "'");
        }
        lines.push('');
        lines.push('columns (left->right, zig-zag):');
        if (r && r.cols && r.cols.length) {
            for (var j = 0; j < r.cols.length; j++) {
                var col = r.cols[j];
                var bottomUp = (j % 2 === 0);
                var arr = col.items.slice();
                if (bottomUp)
                    arr.reverse();
                var digits = arr.map(function (it) {
                    return it.v;
                }).join('');
                var ys = arr.map(function (it) {
                    return Math.round(it.y);
                }).join(',');
                lines.push((j + 1) + ": x~" + Math.round(col.cx) + " dir=" + (bottomUp ? 'bottom->top' : 'top->bottom') + " digits=" + digits + " y=" + ys);
            }
        } else {
            lines.push('(no columns)');
        }
        setCwLog(lines.join('\n'));
        return r;
    }
    try {
        window.__cw_scan55CL = function (force) {
            var seq = '';
            try {
                seq = refreshSeq55ByProg(S.prog, !!force) || '';
            } catch (_) {
                seq = S.seq || '';
            }
            var arr = [];
            for (var i = 0; i < seq.length; i++)
                arr.push(seq.charAt(i));
            var out = {
                which: S._seqWhich || '',
                len: seq.length,
                seqCL: seq,
                arrCL: arr
            };
            window.__cw_scan55cl_last = out;
            try {
                console.log('[CW_SEQ55CL]', out);
            } catch (_) {}
            return out;
        };
    } catch (_) {}

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
        var x = (r && r.x != null) ? r.x : (r && r.sx != null ? r.sx : 0);
        var y = (r && r.y != null) ? r.y : (r && r.sy != null ? r.sy : 0);
        var w = (r && r.w != null) ? r.w : (r && r.sw != null ? r.sw : 0);
        var h = (r && r.h != null) ? r.h : (r && r.sh != null ? r.sh : 0);
        var cx = x + w / 2,
        cy = y + h / 2;
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
        '200000': 1,
        '500000': 1,
        '1000000': 1,
        '5000000': 1,
        '10000000': 1,
        '20000000': 1,
        '50000000': 1,
        '100000000': 1,
        '500000000': 1
    };
    var DENOMS = [500000000, 100000000, 50000000, 20000000, 10000000, 5000000, 1000000, 500000, 200000, 100000, 50000, 10000, 5000, 1000];
    var CHIP_SCAN_ORDER = [1000, 5000, 10000, 50000, 200000, 1000000, 5000000];
    var CHIP_SCAN_SET = {
        '1000': 1,
        '5000': 1,
        '10000': 1,
        '50000': 1,
        '200000': 1,
        '1000000': 1,
        '5000000': 1
    };

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
    function rectFromNodeCompat(n) {
        if (!n)
            return null;
        var cs = null;
        try {
            if (n.getContentSize)
                cs = n.getContentSize();
        } catch (e) {}
        if ((!cs || (!cs.width && !cs.height)) && cc.UITransform && n.getComponent) {
            var ut = n.getComponent(cc.UITransform);
            if (ut && ut.contentSize)
                cs = ut.contentSize;
        }
        if (cs && (cs.width || cs.height)) {
            var w = cs.width || 0,
            h = cs.height || 0;
            var p = null;
            try {
                if (n.convertToWorldSpaceAR)
                    p = n.convertToWorldSpaceAR(new V2(0, 0));
            } catch (e2) {}
            if (!p) {
                try {
                    if (n.getWorldPosition)
                        p = n.getWorldPosition();
                } catch (e3) {}
            }
            p = p || {
                x: 0,
                y: 0
            };
            var ax = (n.anchorX != null ? n.anchorX : 0.5);
            var ay = (n.anchorY != null ? n.anchorY : 0.5);
            var blx = (p.x || 0) - w * ax;
            var bly = (p.y || 0) - h * ay;
            var sp1 = toScreenPt(n, new V2(blx, bly));
            var sp2 = toScreenPt(n, new V2(blx + w, bly + h));
            return {
                sx: Math.min(sp1.x, sp2.x),
                sy: Math.min(sp1.y, sp2.y),
                sw: Math.abs(sp2.x - sp1.x),
                sh: Math.abs(sp2.y - sp1.y)
            };
        }
        try {
            if (n.getBoundingBoxToWorld) {
                var b = n.getBoundingBoxToWorld();
                if (b && (b.width || b.height)) {
                    var spb1 = toScreenPt(n, new V2(b.x, b.y));
                    var spb2 = toScreenPt(n, new V2(b.x + b.width, b.y + b.height));
                    return {
                        sx: Math.min(spb1.x, spb2.x),
                        sy: Math.min(spb1.y, spb2.y),
                        sw: Math.abs(spb2.x - spb1.x),
                        sh: Math.abs(spb2.y - spb1.y)
                    };
                }
            }
        } catch (e4) {}
        return null;
    }
    function makeTouch(x, y) {
        var touch = null;
        try {
            if (cc.Touch)
                touch = new cc.Touch(x, y, 0);
        } catch (e) {}
        if (!touch) {
            touch = {
                getLocation: function () {
                    return {
                        x: x,
                        y: y
                    };
                },
                getID: function () {
                    return 0;
                }
            };
        }
        var ev = null;
        try {
            if (cc.Event && cc.Event.EventTouch)
                ev = new cc.Event.EventTouch([touch], true);
        } catch (e2) {}
        if (!ev)
            ev = {
                getTouches: function () {
                    return [touch];
                },
                getTouch: function () {
                    return touch;
                }
            };
        ev.touch = touch;
        return {
            touch: touch,
            event: ev
        };
    }
    function emitTouchAtRect(node, rect) {
        if (!node || !rect)
            return false;
        var cx = rect.sx + rect.sw / 2;
        var cy = rect.sy + rect.sh / 2;
        var te = makeTouch(cx, cy);
        te.event.currentTarget = node;
        te.event.target = node;
        try {
            node.emit(cc.Node.EventType.TOUCH_START, te.event);
        } catch (e) {}
        try {
            node.emit('touchstart', te.event);
        } catch (e2) {}
        try {
            node.emit(cc.Node.EventType.TOUCH_END, te.event);
        } catch (e3) {}
        try {
            node.emit('touchend', te.event);
        } catch (e4) {}
        if (node._touchListener && node._touchListener.onTouchBegan) {
            try {
                node._touchListener.onTouchBegan(te.touch, te.event);
            } catch (e5) {}
            if (node._touchListener.onTouchEnded) {
                try {
                    node._touchListener.onTouchEnded(te.touch, te.event);
                } catch (e6) {}
            }
        }
        return true;
    }
    function clickCanvasXY(x, y, tryFlipY) {
        var c = document.querySelector('canvas');
        if (!c)
            return false;
        var br = c.getBoundingClientRect();
        var scaleX = (c.width ? (br.width / c.width) : 1);
        var scaleY = (c.height ? (br.height / c.height) : 1);
        var clientX = Math.round(br.left + x * scaleX);
        var clientY = Math.round(br.top + y * scaleY);
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
            c.dispatchEvent(new PointerEvent('pointerup', {
                    bubbles: true,
                    cancelable: true,
                    pointerType: 'mouse',
                    isPrimary: true,
                    clientX: clientX,
                    clientY: clientY
                }));
        } catch (e2) {}
        try {
            c.dispatchEvent(new MouseEvent('click', {
                    bubbles: true,
                    cancelable: true,
                    clientX: clientX,
                    clientY: clientY
                }));
        } catch (e3) {}
        if (tryFlipY && c.height) {
            try {
                var fy = c.height - y;
                var fClientY = Math.round(br.top + fy * scaleY);
                c.dispatchEvent(new PointerEvent('pointerdown', {
                        bubbles: true,
                        cancelable: true,
                        pointerType: 'mouse',
                        isPrimary: true,
                        clientX: clientX,
                        clientY: fClientY,
                        buttons: 1
                    }));
                c.dispatchEvent(new PointerEvent('pointerup', {
                        bubbles: true,
                        cancelable: true,
                        pointerType: 'mouse',
                        isPrimary: true,
                        clientX: clientX,
                        clientY: fClientY
                    }));
            } catch (e4) {}
        }
        return true;
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
    var BET_TAILS = {
        CHAN: 'sede/Canvas/mainPlay/midNode/betNode/gatebig',
        LE: 'sede/Canvas/mainPlay/midNode/betNode/gatesmall',
        SAP_DOI: 'sede/Canvas/mainPlay/midNode/betNode/gate4',
        TRANG3_DO1: 'sede/Canvas/mainPlay/midNode/betNode/gate2',
        DO3_TRANG1: 'sede/Canvas/mainPlay/midNode/betNode/gate3',
        TU_TRANG: 'sede/Canvas/mainPlay/midNode/betNode/gate5',
        TU_DO: 'sede/Canvas/mainPlay/midNode/betNode/gate6'
    };
    var BET_LABEL_TAILS = {
        CHAN: 'sede/Canvas/mainPlay/midNode/betNode/gatebig/lblCashBet',
        LE: 'sede/Canvas/mainPlay/midNode/betNode/gatesmall/lblCashBet',
        SAP_DOI: 'sede/Canvas/mainPlay/midNode/betNode/gate4/lblCashBet',
        TRANG3_DO1: 'sede/Canvas/mainPlay/midNode/betNode/gate2/lblCashBet',
        DO3_TRANG1: 'sede/Canvas/mainPlay/midNode/betNode/gate3/lblCashBet',
        TU_TRANG: 'sede/Canvas/mainPlay/midNode/betNode/gate5/lblCashBet',
        TU_DO: 'sede/Canvas/mainPlay/midNode/betNode/gate6/lblCashBet'
    };
    var CHIP_TAILS = {
        '500000000': 'dual/Canvas/node_dual/root/node_game(need_to_put_games_in_here)/prefab_game_14/root/node_in_fullmode/HUD/bet_panel/chips/chip_panel/chip_mask/panel/lbl_chip_value7',
        '100000000': 'dual/Canvas/node_dual/root/node_game(need_to_put_games_in_here)/prefab_game_14/root/node_in_fullmode/HUD/bet_panel/chips/chip_panel/chip_mask/panel/lbl_chip_value6',
        '50000000': 'dual/Canvas/node_dual/root/node_game(need_to_put_games_in_here)/prefab_game_14/root/node_in_fullmode/HUD/bet_panel/chips/chip_panel/chip_mask/panel/lbl_chip_value10',
        '20000000': 'dual/Canvas/node_dual/root/node_game(need_to_put_games_in_here)/prefab_game_14/root/node_in_fullmode/HUD/bet_panel/chips/chip_panel/chip_mask/panel/lbl_chip_value9',
        '10000000': 'dual/Canvas/node_dual/root/node_game(need_to_put_games_in_here)/prefab_game_14/root/node_in_fullmode/HUD/bet_panel/chips/chip_panel/chip_mask/panel/lbl_chip_value8',
        '5000000': 'dual/Canvas/node_dual/root/node_game(need_to_put_games_in_here)/prefab_game_14/root/node_in_fullmode/HUD/bet_panel/chips/chip_panel/chip_mask/panel/lbl_chip_value7',
        '1000000': 'dual/Canvas/node_dual/root/node_game(need_to_put_games_in_here)/prefab_game_14/root/node_in_fullmode/HUD/bet_panel/chips/chip_panel/chip_mask/panel/lbl_chip_value6',
        '500000': 'dual/Canvas/node_dual/root/node_game(need_to_put_games_in_here)/prefab_game_14/root/node_in_fullmode/HUD/bet_panel/chips/chip_panel/chip_mask/panel/lbl_chip_value5',
        '100000': 'dual/Canvas/node_dual/root/node_game(need_to_put_games_in_here)/prefab_game_14/root/node_in_fullmode/HUD/bet_panel/chips/chip_panel/chip_mask/panel/lbl_chip_value4',
        '50000': 'dual/Canvas/node_dual/root/node_game(need_to_put_games_in_here)/prefab_game_14/root/node_in_fullmode/HUD/bet_panel/chips/chip_panel/chip_mask/panel/lbl_chip_value3',
        '10000': 'dual/Canvas/node_dual/root/node_game(need_to_put_games_in_here)/prefab_game_14/root/node_in_fullmode/HUD/bet_panel/chips/chip_panel/chip_mask/panel/lbl_chip_value2',
        '5000': 'dual/Canvas/node_dual/root/node_game(need_to_put_games_in_here)/prefab_game_14/root/node_in_fullmode/HUD/bet_panel/chips/chip_panel/chip_mask/panel/lbl_chip_value1',
        '1000': 'dual/Canvas/node_dual/root/node_game(need_to_put_games_in_here)/prefab_game_14/root/node_in_fullmode/HUD/bet_panel/chips/chip_panel/chip_mask/panel/lbl_chip_value0'
    };
    function tailMatch(full, tail) {
        if (!full || !tail)
            return false;
        var f = String(full || '').replace(/[\u0000-\u001f]+/g, '').toLowerCase();
        var t = String(tail || '').replace(/[\u0000-\u001f]+/g, '').toLowerCase();
        return f === t || f.indexOf(t, Math.max(0, f.length - t.length)) !== -1;
    }
    function findNodeByTail(tail) {
        if (!tail)
            return null;
        var hit = null;
        var bestArea = -1;
        walkNodes(function (n) {
            if (!n || !active(n))
                return;
            var p = fullPath(n, 200);
            if (!tailMatch(p, tail))
                return;
            var r = wRect(n);
            var ar = (r.sw || r.w || 0) * (r.sh || r.h || 0);
            if (ar <= 0)
                ar = (r.w || 0) * (r.h || 0);
            if (ar >= bestArea) {
                bestArea = ar;
                hit = n;
            }
        });
        return hit;
    }
    function findNodesByTail(tail) {
        if (!tail)
            return [];
        var hits = [];
        walkNodes(function (n) {
            if (!n || !active(n))
                return;
            var p = fullPath(n, 200);
            if (!tailMatch(p, tail))
                return;
            hits.push(n);
        });
        return hits;
    }
    function findSide(side) {
        var WANT = normalizeSide(side);
        var tail = BET_TAILS[WANT];
        if (tail) {
            var byTail = findNodeByTail(tail);
            if (byTail) {
                var cTail = clickableOf(byTail, 8);
                if (clickable(cTail))
                    return cTail;
                return byTail;
            }
        }
        var rx = SIDE_REGEX[WANT];
        if (!rx)
            return null; // không nhận diện được cửa -> bỏ qua, tránh click nhầm
        var hit = null;
        (function walk(n) {
            if (hit || !active(n))
                return;
            var ok = false;
            if (nodeInGame(n)) {
                var lb = getComp(n, cc.Label) || getComp(n, cc.RichText);
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
    function listClickableTargets(root) {
        var list = [];
        (function walk(n) {
            if (!n || !active(n))
                return;
            if (clickable(n)) {
                var rect = rectFromNodeCompat(n);
                var area = rect ? (rect.sw * rect.sh) : 0;
                list.push({
                    node: n,
                    rect: rect,
                    area: area
                });
            }
            var kids = n.children || [];
            for (var i = 0; i < kids.length; i++)
                walk(kids[i]);
        })(root);
        list.sort(function (a, b) {
            return (b.area || 0) - (a.area || 0);
        });
        return list;
    }
    function findBetRectFromMoneyRows(sideKey) {
        var rows = (window.__cw_last_scan_money || []).slice(0, 260);
        if (!rows.length && typeof scan200Money === 'function') {
            try {
                rows = (scan200Money() || []).slice(0, 260);
            } catch (_) {}
        }
        if (!rows.length)
            return null;
        var base = BET_TAILS[sideKey] || '';
        var prefer = BET_LABEL_TAILS[sideKey] || '';
        var best = null;
        var bestScore = -1e9;
        for (var i = 0; i < rows.length; i++) {
            var r = rows[i] || {};
            var tail = cleanTailText(r.tail || r.tailFull || '');
            if (!tail)
                continue;
            var ok = false;
            if (prefer && tailMatch(tail, prefer))
                ok = true;
            if (!ok && base && (tailMatch(tail, base + '/lblCashBet') || tailMatch(tail, base + '/lblCountBet')))
                ok = true;
            if (!ok)
                continue;
            var sx = (r.sx != null) ? Number(r.sx) : Number(r.x || 0);
            var sy = (r.sy != null) ? Number(r.sy) : Number(r.y || 0);
            var sw = (r.sw != null) ? Number(r.sw) : Number(r.w || 0);
            var sh = (r.sh != null) ? Number(r.sh) : Number(r.h || 0);
            if (!isFinite(sx) || !isFinite(sy))
                continue;
            if (!isFinite(sw) || sw <= 0)
                sw = Math.max(24, Number(r.w || 0) || 24);
            if (!isFinite(sh) || sh <= 0)
                sh = Math.max(18, Number(r.h || 0) || 18);
            var rr = {
                sx: sx,
                sy: sy,
                sw: sw,
                sh: sh
            };
            var score = 0;
            if (prefer && tailMatch(tail, prefer))
                score += 8;
            if (tailMatch(tail, base + '/lblCashBet'))
                score += 4;
            if (tailMatch(tail, base + '/lblCountBet'))
                score += 2;
            if (rectVisibleOnScreen(rr, 8, 8))
                score += 2;
            if (score > bestScore) {
                bestScore = score;
                best = rr;
            }
        }
        return best;
    }
    function findBetTarget(side) {
        var WANT = normalizeSide(side);
        var tail = BET_TAILS[WANT];
        if (tail) {
            var roots = findNodesByTail(tail);
            var best = null;
            for (var i = 0; i < roots.length; i++) {
                var list = listClickableTargets(roots[i]);
                if (list.length && (!best || (list[0].area || 0) > (best.area || 0)))
                    best = list[0];
            }
            if (best && best.node)
                return best;
        }
        var rr = findBetRectFromMoneyRows(WANT);
        if (rr) {
            return {
                node: null,
                rect: rr,
                area: rr.sw * rr.sh,
                source: 'money_rows'
            };
        }
        var btn = findSide(side);
        if (!btn)
            return null;
        return {
            node: btn,
            rect: rectFromNodeCompat(btn),
            area: 0
        };
    }
    function emitBtnToggle(node) {
        var b = getComp(node, cc.Button);
        if (b && b.interactable !== false) {
            try {
                cc.Component.EventHandler.emitEvents(b.clickEvents, new cc.Event.EventCustom('click', true));
                return true;
            } catch (e) {}
        }
        var t = getComp(node, cc.Toggle);
        if (t && t.interactable !== false) {
            try {
                t.isChecked = true;
                if (t._emitToggleEvents)
                    t._emitToggleEvents();
                return true;
            } catch (e2) {}
        }
        return false;
    }
    function clickBetTarget(tgt) {
        if (!tgt || (!tgt.node && !tgt.rect))
            return false;
        var node = tgt.node;
        var rect = tgt.rect || rectFromNodeCompat(node);
        if (!node && rect) {
            var rr = screenRect(rect) || rect;
            var cx0 = Number(rr.sx || rr.x || 0) + Number(rr.sw || rr.w || 0) * 0.5;
            var cy0 = Number(rr.sy || rr.y || 0) + Number(rr.sh || rr.h || 0) * 0.5;
            return clickCanvasXY(cx0, cy0, true) || clickRectCenter(rr);
        }
        // same style as file mẫu: 1 cú click chính để tránh nhân cược
        if (clickable(node) && emitClick(node))
            return true;
        if (rect && emitTouchAtRect(node, rect))
            return true;
        if (rect)
            return clickCanvasXY(rect.sx + rect.sw / 2, rect.sy + rect.sh / 2, true);
        return false;
    }

    function parseAmountLoose(txt) {
        if (!txt)
            return null;
        var s = NORM(txt);
        // Accept labels/sprite names such as: 50K, 1M, CHIP_50K_ICON, chip1m
        var m = s.match(/(\d+(?:[.,]\d+)?)\s*([KMB])(?![A-Z0-9])/);
        if (m) {
            var v = parseFloat(String(m[1]).replace(',', '.'));
            if (!isFinite(v))
                v = 0;
            if (m[2] === 'K')
                v *= 1e3;
            else if (m[2] === 'M')
                v *= 1e6;
            else if (m[2] === 'B')
                v *= 1e9;
            v = Math.round(v);
            return ALLOWED_SET[String(v)] ? v : null;
        }
        m = s.match(/(?:^|[^0-9])(\d{1,3}(?:[.,\s]\d{3})+|\d{4,9})(?=$|[^0-9])/);
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
            if (nodeInGame(n)) {
                var l = (getComp(n, cc.Label) && getComp(n, cc.Label).string) || (getComp(n, cc.RichText) && getComp(n, cc.RichText).string) || '';
                var names = [],
                p;
                for (p = n; p; p = p.parent)
                    names.push(p.name || '');
                var path = names.reverse().join('/');
                if (key.test(l) || key.test(path))
                    if (clickable(n))
                        cand = n;
            }
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
            var names = [],
            p;
            for (p = n; p; p = p.parent)
                names.push(p.name || '');
            var path = names.reverse().join('/').toLowerCase();
            for (var ti = 0; ti < texts.length; ti++) {
                var t = texts[ti];
                var val = parseAmountLoose(t);
                if (!val)
                    continue;
                var score = 0;
                if (clickable(n))
                    score += 6;
                if (/sede\/canvas\/mainplay/.test(path))
                    score += 4;
                if (/chip|chips|chipnode|chip_panel|bet_panel|betnode|coin|chon|choose|phinh|menh/.test(path))
                    score += 5;
                if (/playernode|soicau|jackpot|tophu|notice|chat/.test(path))
                    score -= 4;
                if (NORM(t).indexOf(String(val)) !== -1)
                    score += 2;
                var hit = clickableOf(n, 10);
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

    function rectFromNodeScreen(n) {
        var r = wRect(n);
        var x = (r && r.sx != null) ? r.sx : r.x;
        var y = (r && r.sy != null) ? r.sy : r.y;
        var w = (r && r.sw != null) ? r.sw : r.w;
        var h = (r && r.sh != null) ? r.sh : r.h;
        if (!w)
            w = 1;
        if (!h)
            h = 1;
        return {
            x: x || 0,
            y: y || 0,
            w: w,
            h: h
        };
    }
    function nodeWorldPos(n) {
        try {
            if (n && n.getWorldPosition)
                return n.getWorldPosition();
        } catch (e) {}
        try {
            if (n && n.convertToWorldSpaceAR)
                return n.convertToWorldSpaceAR(new V2(0, 0));
        } catch (e2) {}
        return {
            x: 0,
            y: 0
        };
    }
    function hasCompName(n, name) {
        try {
            var comps = n && n._components ? n._components : [];
            for (var i = 0; i < comps.length; i++) {
                var c = comps[i];
                var cn = (c && (c.__classname__ || c.name || (c.constructor && c.constructor.name))) || '';
                if (cn === name)
                    return true;
            }
        } catch (e) {}
        return false;
    }
    function findChipNodeFromLabel(labelNode) {
        if (!labelNode)
            return null;
        var p = labelNode.parent || labelNode._parent || null;
        if (!p || !(p.children || p._children))
            return null;
        var kids = p.children || p._children;
        var nm = String(labelNode.name || '');
        var m = nm.match(/lbl_chip_value(\d+)/i);
        if (m) {
            var idx = parseInt(m[1], 10);
            var direct = 'chip' + idx;
            for (var i = 0; i < kids.length; i++) {
                if (kids[i] && kids[i].name === direct)
                    return kids[i];
            }
        }
        var lp = nodeWorldPos(labelNode);
        var best = null;
        var bestD = null;
        for (var j = 0; j < kids.length; j++) {
            var k = kids[j];
            if (!k)
                continue;
            var kn = String(k.name || '');
            if (kn.indexOf('chip') === 0 || hasCompName(k, 'ChipItem')) {
                var kp = nodeWorldPos(k);
                var d = dist2(lp.x || 0, lp.y || 0, kp.x || 0, kp.y || 0);
                if (bestD == null || d < bestD) {
                    best = k;
                    bestD = d;
                }
            }
        }
        return best;
    }
    function resolveChipNode(n) {
        if (!n)
            return null;
        var nm = String(n.name || '');
        if (nm.indexOf('lbl_chip_value') !== -1) {
            var c = findChipNodeFromLabel(n);
            if (c)
                return c;
        }
        return n;
    }
    function emitTouchOnNode(n) {
        if (!n)
            return false;
        var p = nodeWorldPos(n);
        var ok = false;
        try {
            if (cc && cc.Touch && cc.Event && cc.Event.EventTouch && n.emit) {
                var t = new cc.Touch(p.x || 0, p.y || 0);
                var ev = new cc.Event.EventTouch([t], true);
                ev.touch = t;
                ev.getLocation = function () {
                    return {
                        x: p.x || 0,
                        y: p.y || 0
                    };
                };
                var ts = (cc.Node && cc.Node.EventType && cc.Node.EventType.TOUCH_START) ? cc.Node.EventType.TOUCH_START : 'touchstart';
                var te = (cc.Node && cc.Node.EventType && cc.Node.EventType.TOUCH_END) ? cc.Node.EventType.TOUCH_END : 'touchend';
                n.emit(ts, ev);
                n.emit(te, ev);
                ok = true;
            }
        } catch (e) {}
        if (!ok && n.emit) {
            try {
                var ev2 = {
                    getLocation: function () {
                        return {
                            x: p.x || 0,
                            y: p.y || 0
                        };
                    }
                };
                var ts2 = (cc.Node && cc.Node.EventType && cc.Node.EventType.TOUCH_START) ? cc.Node.EventType.TOUCH_START : 'touchstart';
                var te2 = (cc.Node && cc.Node.EventType && cc.Node.EventType.TOUCH_END) ? cc.Node.EventType.TOUCH_END : 'touchend';
                n.emit(ts2, ev2);
                n.emit(te2, ev2);
                ok = true;
            } catch (e2) {}
        }
        return ok;
    }
    function cleanTailText(t) {
        return String(t || '').replace(/[\u0000-\u001f]+/g, '').trim();
    }
    function chipValueStrict(raw) {
        var v = parseAmountLoose(raw);
        if (v && CHIP_SCAN_SET[String(v)])
            return v;
        v = moneyOf(raw);
        if (v && CHIP_SCAN_SET[String(v)])
            return v;
        return null;
    }
    function screenRect(r) {
        if (!r)
            return null;
        var sx = Number((r.sx != null) ? r.sx : r.x);
        var sy = Number((r.sy != null) ? r.sy : r.y);
        var sw = Number((r.sw != null) ? r.sw : r.w);
        var sh = Number((r.sh != null) ? r.sh : r.h);
        if (!isFinite(sx) || !isFinite(sy) || !isFinite(sw) || !isFinite(sh))
            return null;
        return {
            sx: sx,
            sy: sy,
            sw: sw,
            sh: sh
        };
    }
    function rectVisibleOnScreen(r, minW, minH) {
        var rr = screenRect(r);
        if (!rr)
            return false;
        minW = Number(minW || 1);
        minH = Number(minH || 1);
        if (rr.sw < minW || rr.sh < minH)
            return false;
        if (rr.sx + rr.sw < 0 || rr.sy + rr.sh < 0)
            return false;
        if (rr.sx > innerWidth || rr.sy > innerHeight)
            return false;
        return true;
    }
    function chipPathDenied(p) {
        return /playernode|soicau|jackpot|chat|minigame|gift|waittingroom|lblcashbet|lblcountbet|gatebig|gatesmall|gate[0-9]/.test(p);
    }
    function chipPathPreferred(p) {
        return /mainplay|midnode|nodetophu|tabs100110k|chip|coin|chipnode|bet_panel/.test(p);
    }
    function chipNodePathOk(p) {
        var s = String(p || '').toLowerCase();
        if (!chipPathPreferred(s))
            return false;
        if (/btnlist|btnexit|layoutlistgame|itemheader|gateheaderingame|scrlistgame/.test(s))
            return false;
        return true;
    }
    function chipButtonTailFromMoneyTail(tail) {
        var t = cleanTailText(tail || '');
        if (!t)
            return '';
        var parts = t.split('/').filter(function (x) {
            return !!x;
        });
        if (!parts.length)
            return '';
        var last = String(parts[parts.length - 1] || '').toLowerCase();
        if (/^(1k|5k|10k|50k|100|200k|1m|5m)$/.test(last) || /^lbl/i.test(last))
            parts.pop();
        if (!parts.length)
            return '';
        return parts.join('/');
    }
    function extractAmountFromNode(n) {
        if (!n)
            return null;
        var texts = [];
        try {
            texts.push(n.name || '');
            texts.push(fullPath(n, 180) || '');
            var lb = getComp(n, cc.Label);
            if (lb && typeof lb.string !== 'undefined')
                texts.push(lb.string);
            var rt = getComp(n, cc.RichText);
            if (rt && typeof rt.string !== 'undefined')
                texts.push(rt.string);
            var sp = getComp(n, cc.Sprite);
            if (sp && sp.spriteFrame && sp.spriteFrame.name)
                texts.push(sp.spriteFrame.name);
        } catch (_) {}
        for (var i = 0; i < texts.length; i++) {
            var val = chipValueStrict(texts[i]);
            if (val)
                return val;
        }
        return null;
    }
    function findClickableNearScreen(cx, cy, maxDist, tailHint) {
        cx = Number(cx || 0);
        cy = Number(cy || 0);
        maxDist = Number(maxDist || 140);
        var best = null;
        var bestScore = -1e9;
        var hint = String(tailHint || '').toLowerCase();
        walkNodes(function (n) {
            if (!n || !active(n) || !clickable(n))
                return;
            var r = screenRect(rectFromNodeCompat(n) || rectFromNodeScreen(n));
            if (!r)
                return;
            var x = Number(r.sx || r.x || 0) + Number(r.sw || r.w || 0) * 0.5;
            var y = Number(r.sy || r.y || 0) + Number(r.sh || r.h || 0) * 0.5;
            var d2 = dist2(cx, cy, x, y);
            if (d2 > maxDist * maxDist)
                return;
            var p = String(fullPath(n, 180) || '').toLowerCase();
            var score = 0;
            score -= Math.sqrt(Math.max(0, d2)) * 0.12;
            if (chipPathPreferred(p))
                score += 9;
            if (chipPathDenied(p))
                score -= 8;
            if (!chipNodePathOk(p))
                score -= 6;
            if (hint && tailMatch(p, hint))
                score += 6;
            if (rectVisibleOnScreen(r, 8, 8))
                score += 2;
            if (score > bestScore) {
                best = n;
                bestScore = score;
            }
        });
        return best;
    }
    function pickBestNodeByTailNear(tail, cx, cy) {
        var list = findNodesByTail(tail) || [];
        if (!list.length)
            return null;
        cx = Number(cx || 0);
        cy = Number(cy || 0);
        var best = null;
        var bestScore = -1e9;
        for (var i = 0; i < list.length; i++) {
            var n = list[i];
            if (!n || !active(n))
                continue;
            var hit = clickableOf(n, 10) || n;
            var rr = screenRect(rectFromNodeCompat(hit) || rectFromNodeScreen(hit));
            var score = 0;
            var path = String(fullPath(hit, 180) || '').toLowerCase();
            if (chipPathPreferred(path))
                score += 6;
            if (chipPathDenied(path))
                score -= 7;
            if (!chipNodePathOk(path))
                score -= 8;
            if (rr) {
                if (rectVisibleOnScreen(rr, 8, 8))
                    score += 10;
                var rcx = rr.sx + rr.sw * 0.5;
                var rcy = rr.sy + rr.sh * 0.5;
                var d = Math.sqrt(dist2(cx, cy, rcx, rcy));
                if (isFinite(d))
                    score -= Math.min(300, d) * 0.05;
            } else {
                score -= 4;
            }
            if (score > bestScore) {
                bestScore = score;
                best = hit;
            }
        }
        return best;
    }
    function scanChipsFromMoneyRowsStrict() {
        var rows = (window.__cw_last_scan_money || []).slice(0, 250);
        if (!rows.length && !window.__cw_in_scan200money) {
            try {
                if (typeof scan200Money === 'function')
                    rows = (scan200Money() || []).slice(0, 250);
            } catch (_) {}
        }
        var out = {};
        for (var i = 0; i < rows.length; i++) {
            var r = rows[i] || {};
            var txt = String(r.txt || '');
            var val = chipValueStrict(txt);
            if (!val)
                continue;
            var tail = cleanTailText(r.tail || r.tailFull || '');
            var tailL = tail.toLowerCase();
            if (!tailL)
                continue;
            if (!/tabs100110k|btn|chip|coin|panel/.test(tailL))
                continue;
            var rx = (r.sx != null ? Number(r.sx) : Number(r.x || 0));
            var ry = (r.sy != null ? Number(r.sy) : Number(r.y || 0));
            var rw = (r.sw != null ? Number(r.sw) : Number(r.w || 0));
            var rh = (r.sh != null ? Number(r.sh) : Number(r.h || 0));
            if (!isFinite(rx))
                rx = 0;
            if (!isFinite(ry))
                ry = 0;
            if (!isFinite(rw) || rw <= 0)
                rw = Math.max(16, Number(r.w || 0) || 16);
            if (!isFinite(rh) || rh <= 0)
                rh = Math.max(16, Number(r.h || 0) || 16);
            var rowRect = {
                sx: rx,
                sy: ry,
                sw: rw,
                sh: rh
            };
            var cx = rx + rw * 0.5;
            var cy = ry + rh * 0.5;
            var n = null;
            var btnTail = chipButtonTailFromMoneyTail(tail);
            if (btnTail) {
                var byBtnTail = findNodeByTail(btnTail);
                if (byBtnTail)
                    n = clickableOf(byBtnTail, 4) || byBtnTail;
            }
            if (!n)
                n = pickBestNodeByTailNear(tail, cx, cy);
            if (!n) {
                var parts = tail.split('/');
                if (parts.length >= 3) {
                    var end3 = parts.slice(-3).join('/');
                    n = pickBestNodeByTailNear(end3, cx, cy);
                }
            }
            if (!n)
                n = findClickableNearScreen(cx, cy, Math.max(180, Number(r.w || 0) * 6), tail);
            if (!n)
                n = findClickableNearScreen(cx, cy, 260, 'tabs100110k');
            var hit = n ? (clickableOf(n, 6) || n) : null;
            var hitPath = hit ? String(fullPath(hit, 180) || '').toLowerCase() : '';
            if (hit && !chipNodePathOk(hitPath))
                hit = null;
            var rr = hit ? screenRect(rectFromNodeScreen(hit)) : null;
            if (!rr || !rectVisibleOnScreen(rr, 8, 8))
                rr = rowRect;
            var score = 0;
            if (hit && clickable(hit))
                score += 5;
            if (chipPathPreferred(tailL))
                score += 4;
            if (chipPathDenied(tailL))
                score -= 3;
            if (!hit)
                score -= 1;
            var k = String(val);
            var old = out[k];
            if (!old || score >= (old.score || 0)) {
                out[k] = {
                    entry: hit,
                    node: hit,
                    rect: rr,
                    source: 'money_rows',
                    score: score,
                    tail: tail
                };
            }
        }
        return out;
    }
    function chipYHintFromMoneyRows() {
        var rows = (window.__cw_last_scan_money || []).slice(0, 300);
        var ys = [];
        for (var i = 0; i < rows.length; i++) {
            var r = rows[i] || {};
            var tail = String(r.tail || '').toLowerCase();
            if (!/tabs100110k|btn|chip|coin/.test(tail))
                continue;
            if (chipPathDenied(tail))
                continue;
            var y = Number(r.y || 0);
            var h = Number(r.h || 0);
            if (!isFinite(y) || !isFinite(h))
                continue;
            ys.push(y + h * 0.5);
        }
        if (!ys.length)
            return null;
        ys.sort(function (a, b) {
            return a - b;
        });
        return ys[Math.floor(ys.length / 2)];
    }
    function scanChipRowByGeometryStrict() {
        var raw = [];
        var yHint = chipYHintFromMoneyRows();
        walkNodes(function (n) {
            if (!n || !active(n))
                return;
            var hit = clickableOf(n, 8);
            if (!hit || !active(hit))
                return;
            if (!clickable(hit))
                return;
            var r = rectFromNodeCompat(hit);
            if (!rectVisibleOnScreen(r, 24, 24))
                return;
            var rr = screenRect(r);
            if (!rr)
                return;
            var sx = rr.sx,
            sy = rr.sy,
            sw = rr.sw,
            sh = rr.sh;
            if (sw > 300 || sh > 300)
                return;
            var cx = sx + sw * 0.5,
            cy = sy + sh * 0.5;
            if (cx < -10 || cx > innerWidth + 10)
                return;
            if (cy < innerHeight * 0.58)
                return;
            if (yHint != null && Math.abs(cy - yHint) > 220)
                return;
            var p = String(fullPath(hit, 180) || '').toLowerCase();
            var score = 0;
            if (/chip|chips|chipnode|bet_panel|coin|tabs100110k/.test(p))
                score += 7;
            if (/sede\/canvas\/mainplay|midnode|mainplay|nodetophu/.test(p))
                score += 3;
            if (chipPathPreferred(p))
                score += 2;
            if (chipPathDenied(p))
                score -= 8;
            var ratio = Math.abs(sw - sh) / Math.max(sw, sh, 1);
            if (ratio <= 0.42)
                score += 2;
            if (cy > innerHeight * 0.72)
                score += 2;
            if (score < 0)
                return;
            raw.push({
                node: hit,
                rect: rr,
                sx: sx,
                sy: sy,
                sw: sw,
                sh: sh,
                cx: cx,
                cy: cy,
                path: p,
                score: score
            });
        });
        if (!raw.length) {
            try {
                window.__cw_chip_scan_debug = {
                    seedRows: (window.__cw_last_scan_money || []).length,
                    cand: 0,
                    uniq: 0,
                    row: 0,
                    keys: [],
                    rows: [],
                    yHint: yHint,
                    note: 'no-geometry-candidates'
                };
                window.__cw_chip_geom_last = window.__cw_chip_scan_debug;
            } catch (_) {}
            return {};
        }
        raw.sort(function (a, b) {
            var sa = (b.score - a.score);
            if (sa)
                return sa;
            var aa = (b.sw * b.sh) - (a.sw * a.sh);
            if (aa)
                return aa;
            return a.cx - b.cx;
        });
        var uniq = [];
        for (var i = 0; i < raw.length; i++) {
            var it = raw[i];
            var dup = false;
            for (var j = 0; j < uniq.length; j++) {
                var u = uniq[j];
                if (Math.abs(u.cx - it.cx) <= 18 && Math.abs(u.cy - it.cy) <= 18) {
                    dup = true;
                    break;
                }
            }
            if (!dup)
                uniq.push(it);
        }
        if (uniq.length < 4) {
            try {
                window.__cw_chip_scan_debug = {
                    seedRows: (window.__cw_last_scan_money || []).length,
                    cand: raw.length,
                    uniq: uniq.length,
                    row: 0,
                    keys: [],
                    rows: [],
                    yHint: yHint,
                    note: 'not-enough-uniq'
                };
                window.__cw_chip_geom_last = window.__cw_chip_scan_debug;
            } catch (_) {}
            return {};
        }

        // pick densest row near bottom
        var bestRow = [];
        var bestRowScore = -1;
        for (var r0 = 0; r0 < uniq.length; r0++) {
            var baseY = uniq[r0].cy;
            var row = [];
            for (var r1 = 0; r1 < uniq.length; r1++) {
                if (Math.abs(uniq[r1].cy - baseY) <= 36)
                    row.push(uniq[r1]);
            }
            row.sort(function (a, b) {
                return a.cx - b.cx;
            });
            if (row.length < 4)
                continue;
            var span = row[row.length - 1].cx - row[0].cx;
            if (span < innerWidth * 0.18)
                continue;
            var rs = row.length * 4;
            for (var rsI = 0; rsI < row.length; rsI++)
                rs += Math.max(0, row[rsI].score || 0);
            rs += (baseY / Math.max(1, innerHeight)) * 2;
            if (rs > bestRowScore || (rs === bestRowScore && row.length > bestRow.length)) {
                bestRowScore = rs;
                bestRow = row;
            }
        }
        if (bestRow.length < 4) {
            try {
                window.__cw_chip_scan_debug = {
                    seedRows: (window.__cw_last_scan_money || []).length,
                    cand: raw.length,
                    uniq: uniq.length,
                    row: bestRow.length,
                    keys: [],
                    rows: [],
                    yHint: yHint,
                    note: 'no-valid-row'
                };
                window.__cw_chip_geom_last = window.__cw_chip_scan_debug;
            } catch (_) {}
            return {};
        }

        // keep at most 6 chips in horizontal order
        if (bestRow.length > 6) {
            var windows = [];
            for (var s = 0; s + 6 <= bestRow.length; s++) {
                var win = bestRow.slice(s, s + 6);
                var spanW = win[5].cx - win[0].cx;
                var sumScore = 0;
                for (var z = 0; z < win.length; z++)
                    sumScore += (win[z].score || 0);
                windows.push({
                    arr: win,
                    span: spanW,
                    sumScore: sumScore
                });
            }
            windows.sort(function (a, b) {
                if (b.sumScore !== a.sumScore)
                    return b.sumScore - a.sumScore;
                return a.span - b.span;
            });
            bestRow = windows[0].arr;
        }

        var order = CHIP_SCAN_ORDER.slice();
        var detected = [];
        for (var d0 = 0; d0 < bestRow.length; d0++) {
            var dv = extractAmountFromNode(bestRow[d0].node);
            detected.push(dv && CHIP_SCAN_SET[String(dv)] ? dv : null);
        }
        var out = {};
        var used = {};
        for (var k = 0; k < bestRow.length; k++) {
            var valNum = detected[k];
            if (!valNum || used[String(valNum)])
                continue;
            used[String(valNum)] = 1;
            var n0 = bestRow[k].node;
            out[String(valNum)] = {
                entry: n0,
                node: n0,
                rect: rectFromNodeScreen(n0),
                source: 'geom_detect'
            };
        }
        var m = Math.min(order.length, bestRow.length);
        for (var k2 = 0; k2 < m; k2++) {
            var val2 = String(order[k2]);
            if (out[val2])
                continue;
            var n2 = bestRow[k2].node;
            out[val2] = {
                entry: n2,
                node: n2,
                rect: rectFromNodeScreen(n2),
                source: 'geom_order'
            };
        }
        try {
            window.__cw_chip_scan_debug = {
                seedRows: (window.__cw_last_scan_money || []).length,
                cand: raw.length,
                uniq: uniq.length,
                row: bestRow.length,
                keys: Object.keys(out).map(function (x) {
                    return +x;
                }).sort(function (a, b) {
                    return a - b;
                }),
                yHint: yHint,
                rows: bestRow.map(function (x) {
                    return {
                        x: Math.round(x.cx),
                        y: Math.round(x.cy),
                        w: Math.round(x.sw),
                        h: Math.round(x.sh),
                        val: extractAmountFromNode(x.node) || null,
                        path: x.path
                    };
                })
            };
            window.__cw_chip_geom_last = window.__cw_chip_scan_debug;
        } catch (_) {}
        return out;
    }
    function scanChipRowStandaloneHeuristic() {
        var raw = [];
        walkNodes(function (n) {
            if (!n || !active(n))
                return;
            var hit = clickableOf(n, 10);
            if (!hit)
                return;
            if (!clickable(hit))
                return;
            var rr = screenRect(rectFromNodeCompat(hit) || rectFromNodeScreen(hit));
            if (!rr)
                return;
            if (!rectVisibleOnScreen(rr, 16, 16))
                return;
            var sw = Number(rr.sw || 0),
            sh = Number(rr.sh || 0);
            if (!isFinite(sw) || !isFinite(sh))
                return;
            if (sw < 24 || sh < 24 || sw > 320 || sh > 320)
                return;
            var cx = Number(rr.sx || 0) + sw * 0.5;
            var cy = Number(rr.sy || 0) + sh * 0.5;
            if (cx < -20 || cx > innerWidth + 20)
                return;
            if (cy < innerHeight * 0.56)
                return;
            var p = String(fullPath(hit, 180) || '').toLowerCase();
            if (/gateheaderingame|layoutlistgame|itemheader/.test(p))
                return;
            var score = 0;
            if (/chip|chips|chipnode|bet_panel|coin|tabs100110k|mainplay|midnode|nodetophu/.test(p))
                score += 9;
            if (/chat|minigame|gift|soicau|waitting|playernode|lblcashbet|lblcountbet/.test(p))
                score -= 6;
            var ratio = Math.abs(sw - sh) / Math.max(sw, sh, 1);
            if (ratio <= 0.42)
                score += 2;
            raw.push({
                node: hit,
                rect: rr,
                cx: cx,
                cy: cy,
                sw: sw,
                sh: sh,
                path: p,
                score: score
            });
        });
        if (!raw.length)
            return {};
        raw.sort(function (a, b) {
            var s = (b.score - a.score);
            if (s)
                return s;
            return a.cx - b.cx;
        });
        var uniq = [];
        for (var i = 0; i < raw.length; i++) {
            var it = raw[i];
            var dup = false;
            for (var j = 0; j < uniq.length; j++) {
                var u = uniq[j];
                if (Math.abs(u.cx - it.cx) <= 18 && Math.abs(u.cy - it.cy) <= 18) {
                    dup = true;
                    break;
                }
            }
            if (!dup)
                uniq.push(it);
        }
        if (uniq.length < 4)
            return {};
        var bestRow = [];
        var bestScore = -1e9;
        for (var r0 = 0; r0 < uniq.length; r0++) {
            var y0 = uniq[r0].cy;
            var row = [];
            for (var r1 = 0; r1 < uniq.length; r1++) {
                if (Math.abs(uniq[r1].cy - y0) <= 36)
                    row.push(uniq[r1]);
            }
            row.sort(function (a, b) {
                return a.cx - b.cx;
            });
            if (row.length < 4)
                continue;
            var span = row[row.length - 1].cx - row[0].cx;
            if (span < innerWidth * 0.12)
                continue;
            var s2 = row.reduce(function (t, x) {
                    return t + x.score;
                }, 0) + row.length * 4;
            if (s2 > bestScore) {
                bestScore = s2;
                bestRow = row;
            }
        }
        if (bestRow.length < 4)
            return {};
        if (bestRow.length > 6) {
            var bestWin = null;
            for (var s = 0; s + 6 <= bestRow.length; s++) {
                var w = bestRow.slice(s, s + 6);
                var spanW = w[5].cx - w[0].cx;
                var sumS = 0;
                for (var z = 0; z < w.length; z++)
                    sumS += (w[z].score || 0);
                var key = sumS * 10000 - spanW;
                if (!bestWin || key > bestWin.key)
                    bestWin = {
                        key: key,
                        arr: w
                    };
            }
            bestRow = bestWin ? bestWin.arr : bestRow.slice(0, 6);
        }
        bestRow = bestRow.sort(function (a, b) {
                return a.cx - b.cx;
            }).slice(0, 6);
        var out = {};
        for (var k = 0; k < Math.min(CHIP_SCAN_ORDER.length, bestRow.length); k++) {
            var v = String(CHIP_SCAN_ORDER[k]);
            out[v] = {
                entry: bestRow[k].node,
                node: bestRow[k].node,
                rect: bestRow[k].rect,
                source: 'standalone_geom'
            };
        }
        try {
            window.__cw_chip_scan_debug = {
                seedRows: (window.__cw_last_scan_money || []).length,
                cand: raw.length,
                uniq: uniq.length,
                row: bestRow.length,
                keys: Object.keys(out).map(function (x) {
                    return +x;
                }).sort(function (a, b) {
                    return a - b;
                }),
                note: 'standalone-heuristic',
                rows: bestRow.map(function (x) {
                    return {
                        x: Math.round(x.cx),
                        y: Math.round(x.cy),
                        w: Math.round(x.sw),
                        h: Math.round(x.sh),
                        path: x.path
                    };
                })
            };
            window.__cw_chip_geom_last = window.__cw_chip_scan_debug;
        } catch (_) {}
        return out;
    }
    function mergeChipMapsStrict(seed, geo) {
        var out = {};
        var i;
        for (i = 0; i < CHIP_SCAN_ORDER.length; i++) {
            var v = String(CHIP_SCAN_ORDER[i]);
            if (seed && seed[v])
                out[v] = seed[v];
        }
        for (i = 0; i < CHIP_SCAN_ORDER.length; i++) {
            var v2 = String(CHIP_SCAN_ORDER[i]);
            if (!out[v2] && geo && geo[v2])
                out[v2] = geo[v2];
        }
        return out;
    }
    window.cwScanChips = function () {
        var seed = scanChipsFromMoneyRowsStrict();
        var geo = scanChipRowByGeometryStrict();
        var m = mergeChipMapsStrict(seed, geo);
        if (!Object.keys(m).length) {
            var geo2 = scanChipRowStandaloneHeuristic();
            m = mergeChipMapsStrict(seed, geo2);
            if (!Object.keys(m).length)
                m = geo2 || {};
        }
        if (!Object.keys(m).length) {
            console.warn('[cwScanChips] chưa thấy chip.');
            try {
                var dbg = window.__cw_chip_scan_debug || {};
                dbg.seedKeys = Object.keys(seed || {}).map(function (x) {
                    return +x;
                }).sort(function (a, b) {
                    return a - b;
                });
                dbg.geoKeys = Object.keys(geo || {}).map(function (x) {
                    return +x;
                }).sort(function (a, b) {
                    return a - b;
                });
                window.__cw_chip_scan_debug = dbg;
                window.__cw_chip_geom_last = dbg;
            } catch (_) {}
        }
        else {
            var rows = CHIP_SCAN_ORDER.filter(function (v) {
                    return !!m[String(v)];
                }).map(function (v) {
                return {
                    amount: v,
                    source: (m[String(v)] && m[String(v)].source) || '?',
                    node: (m[String(v)] && m[String(v)].node ? m[String(v)].node.name : '?')
                };
            });
            try {
                console.table(rows);
            } catch (e) {
                console.log(rows);
            }
        }
        try {
            window.__cw_last_chip_map = m;
        } catch (_) {}
        return m;
    };

    window.cwFocusChip = async function (amount) {
        var val = Math.max(0, Math.floor(+amount || 0));
        if (!ALLOWED_SET[String(val)])
            throw new Error('M?nh gi  kh?ng h?p l?: ' + amount);
        var map = window.cwScanChips() || {};
        if (!map[String(val)]) {
            await tryOpenChipPanel();
            await sleep(180);
            map = window.cwScanChips() || {};
        }
        if (!map[String(val)])
            return false;
        var info = map[String(val)];
        if (!info || (!info.node && !info.rect))
            return false;
        if (!info.node && info.rect) {
            var rr0 = screenRect(info.rect) || info.rect;
            var cx0 = Number(rr0.sx || rr0.x || 0) + Number(rr0.sw || rr0.w || 0) * 0.5;
            var cy0 = Number(rr0.sy || rr0.y || 0) + Number(rr0.sh || rr0.h || 0) * 0.5;
            var near0 = findClickableNearScreen(cx0, cy0, 220, info.tail || '');
            if (near0)
                info.node = resolveChipNode(near0) || near0;
        }
        if (info.node) {
            var p0 = String(fullPath(info.node, 180) || '').toLowerCase();
            if (!chipNodePathOk(p0))
                info.node = null;
        }
        var target2 = info.node ? (resolveChipNode(info.node) || info.node) : null;
        var ok = false;
        // same style as file mẫu: ưu tiên 1 cú emitClick vào node chip
        if (target2 && clickable(target2))
            ok = emitClick(target2) || ok;
        if (!ok && target2)
            ok = emitTouchOnNode(target2) || ok;
        if (!ok && info.rect) {
            var rr1 = screenRect(info.rect) || info.rect;
            var cx1 = Number(rr1.sx || rr1.x || 0) + Number(rr1.sw || rr1.w || 0) * 0.5;
            var cy1 = Number(rr1.sy || rr1.y || 0) + Number(rr1.sh || rr1.h || 0) * 0.5;
            ok = clickCanvasXY(cx1, cy1, true) || clickRectCenter(rr1);
        }
        if (!ok)
            return false;
        await sleep(120);
        var tg = target2 ? getComp(target2, cc.Toggle) : null;
        if (tg && !tg.isChecked) {
            tg.isChecked = true;
            if (tg._emitToggleEvents)
                tg._emitToggleEvents();
        }
        return true;
    };

    window.cwDumpChips = function () {
        var m = window.cwScanChips() || {};
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
            var tgt0 = findBetTarget(side);
            if (!tgt0 || (!tgt0.node && !tgt0.rect)) {
                console.warn('[cwBet++] không thấy nút cửa:', side);
                return false;
            }
            clickBetTarget(tgt0);
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
            var tgt = findBetTarget(side);
            if (!tgt || (!tgt.node && !tgt.rect)) {
                console.warn('[cwBet++] không thấy nút cửa:', side);
                return false;
            }

            var map = window.cwScanChips() || {};
            if (!Object.keys(map).length) {
                await tryOpenChipPanel();
                await sleep(200);
                map = window.cwScanChips() || {};
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
                clickBetTarget(tgt);
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
                    if (!clickBetTarget(tgt))
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

    console.log('[READY] CW merged (compat + TextMap + Scan200Text + TK sequence + Totals by (x,tail) + standardized exports). patch=' + (window.__cw_patch_ver || 'na'));

    /* ---------------- tick & controls ---------------- */
    function statusByProg(p) {
        var TAIL_STATUS_ALERT = 'sede/Canvas/mainPlay/midNode/alertResult/lblalert';
        try {
            var txt = readNodeTextByTailListExact([TAIL_STATUS_ALERT], {
                nonMoneyOnly: true
            });
            if (txt)
                return txt;
        } catch (_) {}
        return '';
    }

    function tick() {
        var p = collectProgress();
        if (p != null)
            S.prog = p;
        S.status = statusByProg(p == null ? null : p);
        var T = totals(S);
        S._lastTotals = T;

        // TK sequence (rolling 55; only rescan at round close)
        S.seq = refreshSeq55ByProg(S.prog, false) || S.seq || '';

        // keep focus
        if (S.focus) {
            var list = (S.focus.kind === 'text') ? buildTextRects() : collectLabels();
            var all = list.filter(function (l) {
                return l.tail === S.focus.tail;
            });
            if (S.focus.kind === 'text' && S.focus.txt != null) {
                var ttxt = String(S.focus.txt).trim();
                var exact = all.filter(function (l) {
                    return String(l.text || '').trim() === ttxt;
                });
                if (exact.length)
                    all = exact;
            }
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
                if (r && (r.w || r.h || r.sw || r.sh)) {
                    S.focus.rect = {
                        x: r.x,
                        y: r.y,
                        w: r.w,
                        h: r.h,
                        sx: r.sx,
                        sy: r.sy,
                        sw: r.sw,
                        sh: r.sh
                    };
                    var txt = String(r.text || '');
                    S.focus.txt = txt;
                    S.focus.val = (moneyOf(txt) != null ? moneyOf(txt) : (/^\d$/.test(txt) ? +txt : null));
                    showFocus(S.focus.rect);
                }
            }
        }

        if (S.showMoney) {
            S.moneyMap = buildMoneyRectsForMap();
            renderMoney();
        }
        if (S.showBet) {
            S.betMap = buildBetRectsForMap();
            renderBet();
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
            S.betMap = buildBetRectsForMap();
            renderBet();
            try {
                var sb = window.__cw_betStats || {};
                console.log('[BetMap] ON -> out=' + (S.betMap || []).length +
                    ' (buttons=' + (sb.buttons || 0) +
                    ', candidates=' + (sb.betCandidate || 0) +
                    ', invalidRect=' + (sb.rectInvalid || 0) +
                    ', recovered=' + (sb.rectRecovered || 0) +
                    ', projected=' + (sb.rectProjected || 0) +
                    ', clamped=' + (sb.rectClamped || 0) +
                    ', synthetic=' + (sb.syntheticPlaced || 0) +
                    ', adjusted=' + (sb.rectAdjusted || 0) + ')');
            } catch (_) {}
        } else {
            S.focus = null;
            showFocus(null);
            try {
                console.log('[BetMap] OFF');
            } catch (_) {}
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
            var d = null;
            if (typeof window.__cw_scanAndDumpMoney === 'function')
                d = window.__cw_scanAndDumpMoney('BTN_MONEY');
            else
                d = { rows: scan200Money() || [] };
            try { console.log('[CW_SCAN_MONEY_BTN_DONE]', d); } catch (_) {}
        } catch (e) {
            try { console.warn('[CW_SCAN_MONEY_BTN][ERR]', e); } catch (_) {}
        }
    };
    panel.querySelector('#bScanBet').onclick = function () {
        try {
            var d = null;
            if (typeof window.__cw_scanAndDumpBet === 'function')
                d = window.__cw_scanAndDumpBet('BTN_BET');
            else
                d = {
                    rows: scan200Bet() || []
                };
            try {
                console.log('[CW_SCAN_BET_BTN_DONE]', d);
            } catch (_) {}
        } catch (e) {
            try {
                console.warn('[CW_SCAN_BET_BTN][ERR]', e);
            } catch (_) {}
        }
    };
    panel.querySelector('#bScanText').onclick = function () {
        try {
            var d = null;
            if (typeof window.__cw_scanAndDumpText === 'function')
                d = window.__cw_scanAndDumpText('BTN');
            else
                d = { rows: scan200Text() || [] };
            try { console.log('[CW_SCAN_BTN_DONE]', d); } catch (_) {}
        } catch (e) {
            try { console.warn('[CW_SCAN_BTN][ERR]', e); } catch (_) {}
        }
    };
    panel.querySelector('#bScanTK').onclick = function () {
        scanTK();
    };
    panel.querySelector('#bCopyLog').onclick = function () {
        copyCwLog();
    };
    panel.querySelector('#bClearLog').onclick = function () {
        clearCwLog();
    };

    try {
        window.__cw_getMoneyScan = function () {
            return {
                kind: 'money',
                summary: window.__cw_last_scan_money_summary || null,
                stats: window.__cw_moneyStats || null,
                rows: (window.__cw_last_scan_money || []).slice(0, 200)
            };
        };
        window.__cw_scanAndDumpMoney = function (source) {
            source = source || 'CMD_MONEY';
            var rows = [];
            try {
                rows = scan200Money() || [];
            } catch (_) {
                rows = [];
            }
            var d = {};
            try {
                d = window.__cw_getMoneyScan ? window.__cw_getMoneyScan() : {};
            } catch (_) {
                d = {};
            }
            if (!d || typeof d !== 'object') d = {};
            if (!d.rows) d.rows = rows;
            d.kind = 'money';
            try {
                console.log('[CW_SCAN_' + source + ']', d);
                if (d.summary) console.log('[CW_SCAN_SUMMARY]', d.summary);
                if (d.stats) console.log('[CW_SCAN_STATS]', d.stats);
            } catch (_) {}
            return d;
        };
        window.__cw_getBetScan = function () {
            return {
                kind: 'bet',
                summary: window.__cw_last_scan_bet_summary || null,
                stats: window.__cw_betStats || null,
                rows: (window.__cw_last_scan_bet || []).slice(0, 200)
            };
        };
        window.__cw_scanAndDumpBet = function (source) {
            source = source || 'CMD_BET';
            var rows = [];
            try {
                rows = scan200Bet() || [];
            } catch (_) {
                rows = [];
            }
            var d = {};
            try {
                d = window.__cw_getBetScan ? window.__cw_getBetScan() : {};
            } catch (_) {
                d = {};
            }
            if (!d || typeof d !== 'object')
                d = {};
            if (!d.rows)
                d.rows = rows;
            d.kind = 'bet';
            try {
                console.log('[CW_SCAN_' + source + ']', d);
                if (d.summary)
                    console.log('[CW_SCAN_SUMMARY]', d.summary);
                if (d.stats)
                    console.log('[CW_SCAN_STATS]', d.stats);
            } catch (_) {}
            return d;
        };
        window.__cw_getTextScan = function () {
            return {
                kind: 'text',
                summary: window.__cw_last_scan_summary || null,
                stats: window.__cw_textStats || null,
                rows: (window.__cw_last_scan_text || []).slice(0, 200)
            };
        };
        window.__cw_scanAndDumpText = function (source) {
            source = source || 'CMD';
            var rows = [];
            try {
                rows = scan200Text() || [];
            } catch (_) {
                rows = [];
            }
            var d = {};
            try {
                d = window.__cw_getTextScan ? window.__cw_getTextScan() : {};
            } catch (_) {
                d = {};
            }
            if (!d || typeof d !== 'object') d = {};
            if (!d.rows) d.rows = rows;
            d.kind = 'text';
            try {
                console.log('[CW_SCAN_' + source + ']', d);
                if (d.summary) console.log('[CW_SCAN_SUMMARY]', d.summary);
                if (d.stats) console.log('[CW_SCAN_STATS]', d.stats);
            } catch (_) {}
            return d;
        };
    } catch (_) {}

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

        function readSeqSafe(pNow) {
            try {
                if (S && S.seq)
                    return S.seq;
                if (typeof refreshSeq55ByProg === 'function')
                    return refreshSeq55ByProg(pNow, true) || '';
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
                        seq: readSeqSafe(p),
                        username: (typeof readUsernameSafe === 'function') ? readUsernameSafe() : '',
                        accountRaw: (typeof readAccountSafe === 'function') ? readAccountSafe() : '',
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
        // === BET QUEUE v2: C# đẩy intent, JS xếp hàng và bắn tuần tự ===
        var BET_QUEUE = window.__cwBetQueue = window.__cwBetQueue || [];
        var _processingBetQueue = false;

        function getRoundIdSafe() {
            try {
                var seq = readSeqSafe();
                return (seq && seq.length) ? seq.length : 0;
            } catch (_) { return 0; }
        }

        function normalizeIntent(intent) {
            try {
                if (!intent) return null;
                var side = normalizeSide(intent.side || intent.Side || intent.betSide || intent.bet_side);
                var amt = Math.max(0, Math.floor(Number(intent.amount || intent.amt || intent.stake || 0)));
                if (!side || !amt) return null;
                var tabId = String(intent.tabId || intent.tab || "").trim();
                var roundId = Number(intent.roundId || intent.round || intent.round_id || 0);
                if (!roundId || isNaN(roundId)) roundId = getRoundIdSafe();
                return {
                    side: side,
                    amt: amt,
                    tabId: tabId,
                    roundId: roundId,
                    at: Date.now()
                };
            } catch (_) { return null; }
        }

        async function processBetQueue() {
            if (_processingBetQueue) return;
            _processingBetQueue = true;
            while (BET_QUEUE.length) {
                var job = BET_QUEUE.shift();
                if (!job) continue;
                var result = "fail";
                try {
                    var currentRound = getRoundIdSafe();
                    if (job.roundId && currentRound && job.roundId < currentRound) {
                        safePost({
                            abx: "bet_dropped",
                            reason: "stale",
                            tabId: job.tabId,
                            roundId: job.roundId,
                            side: job.side,
                            amount: job.amt,
                            ts: Date.now()
                        });
                        continue;
                    }
                    if (typeof cwBet !== "function") throw new Error("cwBet not found");

                    var before = readTotalsSafe() || {};
                    var rawResult = await cwBet(job.side, job.amt);
                    var ok = rawResult === true || rawResult === "ok" || (rawResult && rawResult.ok === true);
                    try {
                        if (ok && typeof waitForTotalsChange === "function") {
                            await waitForTotalsChange(before, job.side, 1600);
                        }
                    } catch (_) {}
                    if (ok) {
                        safePost({
                            abx: "bet",
                            side: job.side,
                            amount: job.amt,
                            tabId: job.tabId,
                            roundId: job.roundId,
                            ts: Date.now()
                        });
                        result = "ok";
                    } else {
                        var reason = (rawResult && rawResult.error) ? String(rawResult.error) : (rawResult === false ? "cwBet returned false" : ("cwBet returned " + String(rawResult)));
                        safePost({
                            abx: "bet_error",
                            side: job.side,
                            amount: job.amt,
                            tabId: job.tabId,
                            roundId: job.roundId,
                            error: reason,
                            ts: Date.now()
                        });
                        result = "fail:" + reason;
                    }
                } catch (err) {
                    safePost({
                        abx: "bet_error",
                        side: job.side,
                        amount: job.amt,
                        tabId: job.tabId,
                        roundId: job.roundId,
                        error: String(err && err.message || err),
                        ts: Date.now()
                    });
                    result = "fail:" + String(err && err.message || err);
                }
                if (typeof job.resolve === "function") {
                    try { job.resolve(result); } catch (_) {}
                }
            }
            _processingBetQueue = false;
        }

        window.__cw_bet_enqueue = async function (intent) {
            try {
                var job = normalizeIntent(intent);
                if (!job) return "bad";
                BET_QUEUE.push(job);
                processBetQueue();
                safePost({
                    abx: "bet_queued",
                    tabId: job.tabId,
                    roundId: job.roundId,
                    side: job.side,
                    amount: job.amt,
                    ts: Date.now()
                });
                return "queued";
            } catch (err) {
                safePost({
                    abx: "bet_error",
                    side: (intent && intent.side) ? intent.side : "?",
                    amount: (intent && intent.amount) ? intent.amount : 0,
                    error: String(err && err.message || err),
                    ts: Date.now()
                });
                return "fail:" + String(err && err.message || err);
            }
        };

        window.__cw_bet_queue_state = function () {
            return {
                len: BET_QUEUE.length,
                processing: _processingBetQueue,
                roundId: getRoundIdSafe()
            };
        };

        window.__cw_bet = async function (side, amount) {
            try {
                return String(await window.__cw_bet_enqueue({ side: side, amount: amount }));
            } catch (err) {
                safePost({
                    abx: "bet_error",
                    side: side,
                    amount: amount,
                    error: String(err && err.message || err),
                    ts: Date.now()
                });
                return "fail:" + String(err && err.message || err);
            }
        };

    })();

    }

    if (window.cc && cc.director && cc.director.getScene) {
        __cw_boot();
    } else {
        __cw_waitReady();
    }

})();
