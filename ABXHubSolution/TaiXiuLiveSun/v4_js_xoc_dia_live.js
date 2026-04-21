(() => {
    'use strict';
    /* =========================================================
    CanvasWatch + MoneyMap + BetMap + TextMap + Scan500Text
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
    function __cw_tryPost(obj) {
        try {
            var s = (typeof obj === 'string') ? obj : JSON.stringify(obj);
            if (window.chrome && window.chrome.webview && window.chrome.webview.postMessage) {
                window.chrome.webview.postMessage(s);
                return;
            }
        } catch (_) {}
        try {
            if (window.parent && window.parent !== window)
                window.parent.postMessage(obj, '*');
        } catch (_) {}
    }
    (function () {
        try {
            if (window.__cw_err_hooked)
                return;
            window.__cw_err_hooked = 1;
            window.addEventListener('error', function (ev) {
                try {
                    __cw_tryPost({
                        abx: 'cw_js_error',
                        msg: String((ev && ev.message) || ''),
                        src: String((ev && ev.filename) || ''),
                        line: Number((ev && ev.lineno) || 0),
                        col: Number((ev && ev.colno) || 0),
                        ts: Date.now()
                    });
                } catch (_) {}
            }, true);
            window.addEventListener('unhandledrejection', function (ev) {
                try {
                    var reason = ev && ev.reason;
                    __cw_tryPost({
                        abx: 'cw_js_error',
                        msg: String((reason && reason.message) || reason || 'unhandledrejection'),
                        src: 'promise',
                        line: 0,
                        col: 0,
                        ts: Date.now()
                    });
                } catch (_) {}
            }, true);
        } catch (_) {}
    })();
    function __cw_pickBestKey(map) {
        var bestK = '',
        bestV = -1;
        for (var k in map) {
            if (!map.hasOwnProperty(k))
                continue;
            var v = Number(map[k]) || 0;
            if (v > bestV) {
                bestV = v;
                bestK = k;
            }
        }
        return bestK;
    }
    function __cw_safeLower(s) {
        try {
            return String(s == null ? '' : s).toLowerCase();
        } catch (_) {
            return '';
        }
    }
    function __cw_urlContext() {
        var href = '',
        host = '',
        path = '',
        search = '',
        hash = '',
        topHref = '',
        frameSrc = '';
        try {
            href = String(location.href || '');
            host = String(location.hostname || '');
            path = String(location.pathname || '');
            search = String(location.search || '');
            hash = String(location.hash || '');
        } catch (_) {}
        try {
            if (window.top && window.top !== window)
                topHref = String(window.top.location.href || '');
        } catch (_) {}
        try {
            if (window.frameElement && window.frameElement.src)
                frameSrc = String(window.frameElement.src || '');
        } catch (_) {}
        return {
            href: href,
            host: host,
            path: path,
            search: search,
            hash: hash,
            topHref: topHref,
            frameSrc: frameSrc,
            inFrame: window !== window.top
        };
    }
    function __cw_urlScore(ctx) {
        var c = ctx || __cw_urlContext();
        var hostL = __cw_safeLower(c.host);
        var all = [
            __cw_safeLower(c.href),
            __cw_safeLower(c.path),
            __cw_safeLower(c.search),
            __cw_safeLower(c.hash),
            __cw_safeLower(c.topHref),
            __cw_safeLower(c.frameSrc)
        ].join(' ');
        var sc = 0;
        if (/^games\./i.test(hostL))
            sc += 18;
        if (hostL.indexOf('livearena') !== -1)
            sc += 14;
        if (hostL.indexOf('sunwin') !== -1)
            sc += 4;
        if (c.inFrame)
            sc += 4;
        if (/xdlive|xoc[\s_-]?dia|xocdia/i.test(all))
            sc += 22;
        if (/tai[\s_-]?xiu|taixiu/i.test(all))
            sc += 22;
        if (/chan|le|odd|even/i.test(all))
            sc += 3;
        return sc;
    }
    function __cw_isTargetUrl(ctx) {
        return __cw_urlScore(ctx) >= 24;
    }
    function __cw_probeGameScene(limitNodes) {
        var now0 = Date.now();
        var cacheKey = '';
        try {
            cacheKey = String(location.href || '') + '|' + (window === window.top ? 'top' : 'frame') + '|' + String(Number(limitNodes) || 0);
            var cache = window.__cw_probe_cache;
            if (cache && cache.key === cacheKey && (now0 - (cache.at || 0)) < 1400 && cache.val) {
                return cache.val;
            }
        } catch (_) {}
        var uctx = __cw_urlContext();
        var uscore = __cw_urlScore(uctx);
        var info = {
            ok: false,
            score: 0,
            urlScore: uscore,
            urlOk: __cw_isTargetUrl(uctx),
            nodes: 0,
            labels: 0,
            canvases: 0,
            prefabKey: '',
            rootHint: '',
            href: String(uctx.href || ''),
            host: String(uctx.host || ''),
            topHref: String(uctx.topHref || ''),
            frameSrc: String(uctx.frameSrc || ''),
            frame: (window === window.top ? 'top' : 'frame')
        };
        try {
            info.canvases = document.querySelectorAll('canvas').length;
        } catch (_) {}
        try {
            if (!(window.cc && cc.director && cc.director.getScene))
                return info;
            var scene = cc.director.getScene();
            if (!scene)
                return info;
            var maxNodes = Math.max(160, Number(limitNodes) || 1600);
            if (!info.urlOk)
                maxNodes = Math.min(maxNodes, 280);
            var st = [scene],
            seen = [],
            prefabScore = {},
            rootScore = {};
            function addScore(map, key, val) {
                if (!key)
                    return;
                map[key] = (map[key] || 0) + (Number(val) || 0);
            }
            while (st.length && info.nodes < maxNodes) {
                var n = st.pop();
                if (!n || seen.indexOf(n) !== -1)
                    continue;
                seen.push(n);
                info.nodes++;

                var path = '',
                pL = '';
                try {
                    var names = [],
                    t = n,
                    c = 0;
                    while (t && c < 32) {
                        if (t.name)
                            names.push(String(t.name));
                        t = t.parent || t._parent || null;
                        c++;
                    }
                    names.reverse();
                    path = names.join('/');
                    pL = String(path || '').toLowerCase();
                } catch (_) {}

                if (pL.indexOf('prefab_game_') !== -1) {
                    var pm = pL.match(/prefab_game_[0-9a-z_]+/i);
                    if (pm && pm[0])
                        addScore(prefabScore, pm[0].toLowerCase(), 6);
                }
                if (pL.indexOf('/bet_entries/') !== -1 || pL.indexOf('/xdlive/') !== -1 || pL.indexOf('taixiu') !== -1 || pL.indexOf('tai_xiu') !== -1 || pL.indexOf('xocdia') !== -1 || pL.indexOf('xoc_dia') !== -1) {
                    info.score += 2;
                    var rm = pL.match(/(.*?prefab_game_[0-9a-z_]+)/i);
                    if (rm && rm[1])
                        addScore(rootScore, rm[1].toLowerCase(), 4);
                }

                var comps = (n._components || []);
                for (var i = 0; i < comps.length; i++) {
                    var comp = comps[i];
                    if (comp && typeof comp.string !== 'undefined') {
                        info.labels++;
                        var txt = String(comp.string == null ? '' : comp.string).toLowerCase();
                        if (txt.indexOf('tài') !== -1 || txt.indexOf('xỉu') !== -1 || txt.indexOf('tai') !== -1 || txt.indexOf('xiu') !== -1 || txt.indexOf('chẵn') !== -1 || txt.indexOf('lẻ') !== -1 || txt.indexOf('chan') !== -1 || txt.indexOf('le') !== -1) {
                            info.score += 1;
                        }
                    }
                }

                var kids = (n.children || n._children) || [];
                for (var k = 0; k < kids.length; k++) {
                    var kid = kids[k];
                    if (kid && seen.indexOf(kid) === -1)
                        st.push(kid);
                }
            }
            info.prefabKey = __cw_pickBestKey(prefabScore);
            info.rootHint = __cw_pickBestKey(rootScore) || info.prefabKey;
            if (info.prefabKey)
                info.score += 6;
            if (info.labels > 20)
                info.score += 3;
            if (info.canvases > 0)
                info.score += 2;
            info.score += uscore;
            info.ok = !!(info.prefabKey || (info.urlOk && (info.score >= 24 || info.labels > 8)));
        } catch (_) {}
        try {
            window.__cw_probe_cache = {
                key: cacheKey,
                at: Date.now(),
                val: info
            };
        } catch (_) {}
        return info;
    }
    function __cw_claimBootOwner(probe) {
        var p = probe || {
            score: 0,
            prefabKey: ''
        };
        var id = String(location.href || '') + '|' + (window === window.top ? 'top' : 'frame') + '|' + String(p.prefabKey || '');
        try {
            var topWin = window.top;
            if (!topWin)
                return true;
            var now = Date.now();
            var own = topWin.__cw_boot_owner || null;
            var stale = !own || !own.ts || (now - own.ts > 15000);
            var stronger = !own || ((Number(p.score) || 0) >= ((Number(own.score) || 0) + 1));
            if (stale || stronger) {
                topWin.__cw_boot_owner = {
                    id: id,
                    score: Number(p.score) || 0,
                    ts: now
                };
            }
            own = topWin.__cw_boot_owner || null;
            if (own && own.id === id) {
                own.ts = now;
                own.score = Number(p.score) || 0;
                return true;
            }
            return false;
        } catch (_) {
            return true;
        }
    }
    function __cw_emitProbe(reason, probe) {
        try {
            var p = probe || __cw_probeGameScene(700);
            var sig = [
                String(reason || ''),
                p.ok ? '1' : '0',
                String(p.prefabKey || ''),
                String(p.rootHint || ''),
                String(p.score || 0),
                String(p.urlScore || 0),
                String(p.host || ''),
                String(p.frame || '')
            ].join('|');
            if (window.__cw_probe_sig === sig)
                return;
            window.__cw_probe_sig = sig;
            __cw_tryPost({
                abx: 'cw_page_probe',
                reason: String(reason || ''),
                ok: !!p.ok,
                score: Number(p.score) || 0,
                urlScore: Number(p.urlScore) || 0,
                urlOk: !!p.urlOk,
                prefab: String(p.prefabKey || ''),
                root: String(p.rootHint || ''),
                host: String(p.host || ''),
                href: String(p.href || ''),
                topHref: String(p.topHref || ''),
                frameSrc: String(p.frameSrc || ''),
                frame: String(p.frame || ''),
                canvases: Number(p.canvases) || 0,
                labels: Number(p.labels) || 0,
                nodes: Number(p.nodes) || 0,
                ts: Date.now()
            });
            try {
                console.log('[CW][PAGE]', reason, p);
            } catch (_) {}
        } catch (_) {}
    }
    window.__cw_whereami = function () {
        return __cw_probeGameScene(3000);
    };
    window.__cw_matchpage = function () {
        var c = __cw_urlContext();
        return {
            ok: __cw_isTargetUrl(c),
            score: __cw_urlScore(c),
            ctx: c
        };
    };
    function __cw_waitReady() {
        if (window.__cw_waiting_v4)
            return;
        window.__cw_waiting_v4 = 1;
        var tries = 0;
        var strongSceneHits = 0;
        var timer = setInterval(function () {
            try {
                var hasCc = !!(window.cc && cc.director && cc.director.getScene);
                var match = __cw_matchpage();
                var probe = {
                    ok: false,
                    score: Number(match.score) || 0,
                    urlScore: Number(match.score) || 0,
                    urlOk: !!match.ok,
                    href: (match.ctx && match.ctx.href) || '',
                    host: (match.ctx && match.ctx.host) || '',
                    topHref: (match.ctx && match.ctx.topHref) || '',
                    frameSrc: (match.ctx && match.ctx.frameSrc) || '',
                    frame: (window === window.top ? 'top' : 'frame')
                };
                if (hasCc) {
                    var depth = match.ok ? ((tries % 16 === 0) ? 900 : 180) : ((tries % 8 === 0) ? 420 : 120);
                    probe = __cw_probeGameScene(depth);
                    if (!match.ok) {
                        // Chưa đúng URL game: vẫn cho probe nhẹ liên tục để panel lên sớm.
                        probe.ok = false;
                        probe.urlOk = false;
                    }
                }
                var sceneStrong = !!(hasCc && !match.ok &&
                    (Number(probe.score) || 0) >= 120 &&
                    ((Number(probe.labels) || 0) >= 8 || (Number(probe.canvases) || 0) > 0));
                if (sceneStrong)
                    strongSceneHits++;
                else if (strongSceneHits > 0)
                    strongSceneHits--;
                if (!match.ok) {
                    if (tries % 24 === 0)
                        __cw_emitProbe('wait_url', probe);
                } else if (hasCc && (tries % 16 === 0)) {
                    __cw_emitProbe('wait_cc', probe);
                }
                if (sceneStrong && strongSceneHits >= 1)
                    probe.ok = true;
                if (hasCc && probe.ok && (match.ok || sceneStrong) && __cw_claimBootOwner(probe)) {
                    clearInterval(timer);
                    window.__cw_waiting_v4 = 0;
                    window.__cw_scene_probe = probe;
                    __cw_emitProbe(sceneStrong && !match.ok ? 'ready_boot_scene' : 'ready_boot', probe);
                    __cw_boot();
                    return;
                }
                if (++tries > 1800) {
                    clearInterval(timer);
                    window.__cw_waiting_v4 = 0;
                    __cw_emitProbe('wait_timeout', probe);
                }
            } catch (e) {}
        }, 450);
    }

    function __cw_boot() {
    if (window.__cw_booted_v4)
        return;
    window.__cw_booted_v4 = 1;
    var __bootProbe = null;
    try {
        __bootProbe = window.__cw_scene_probe || __cw_probeGameScene(1400);
        if (__bootProbe) {
            if (__bootProbe.prefabKey)
                window.__cw_prefab_key = __bootProbe.prefabKey;
            if (__bootProbe.rootHint)
                window.__cw_game_root_hint = __bootProbe.rootHint;
            __cw_emitProbe('boot', __bootProbe);
        }
    } catch (_) {}
    if (!(window.cc && cc.director && cc.director.getScene)) {
        try {
            window.__cw_booted_v4 = 0;
            __cw_emitProbe('boot_defer_cc', __bootProbe || {
                ok: false,
                score: 0,
                urlScore: 0
            });
        } catch (_) {}
        try {
            __cw_waitReady();
        } catch (_) {}
        return;
    }
    /* ---------------- utils ---------------- */
    var V2 = ((window.cc && (cc.v2 || cc.Vec2)) || function (x, y) {
        return {
            x: x,
            y: y
        };
    });
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
    var GAME_PREFAB_KEY = String(window.__cw_prefab_key || 'prefab_game_14').toLowerCase();
    var GAME_ROOT_HINT = String(window.__cw_game_root_hint || GAME_PREFAB_KEY || '').toLowerCase();
    var _gameScopeAt = 0;
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
    function refreshGameScope(force) {
        var now = Date.now();
        if (!force && (now - _gameScopeAt) < 1800)
            return;
        _gameScopeAt = now;
        try {
            var probe = window.__cw_scene_probe || __cw_probeGameScene(1200);
            if (!probe)
                return;
            if (probe.prefabKey)
                GAME_PREFAB_KEY = String(probe.prefabKey).toLowerCase();
            if (probe.rootHint)
                GAME_ROOT_HINT = String(probe.rootHint).toLowerCase();
            if (GAME_PREFAB_KEY)
                window.__cw_prefab_key = GAME_PREFAB_KEY;
            if (GAME_ROOT_HINT)
                window.__cw_game_root_hint = GAME_ROOT_HINT;
        } catch (_) {}
    }
    function nodeInGame(n) {
        refreshGameScope(false);
        try {
            var t = n,
            c = 0;
            while (t && c < 200) {
                var nm = String(t.name || '').toLowerCase();
                if (GAME_PREFAB_KEY && nm.indexOf(GAME_PREFAB_KEY) !== -1)
                    return true;
                if (/prefab_game_[0-9a-z_]+/i.test(nm))
                    return true;
                t = t.parent || t._parent || null;
                c++;
            }
        } catch (e) {}
        try {
            var p = String(fullPath(n, 200) || '').toLowerCase();
            if (!p)
                return false;
            if (GAME_ROOT_HINT && p.indexOf(GAME_ROOT_HINT) !== -1)
                return true;
            if (GAME_PREFAB_KEY && p.indexOf(GAME_PREFAB_KEY) !== -1)
                return true;
            if (/\/prefab_game_[0-9a-z_]+/i.test(p))
                return true;
            if (p.indexOf('/canvas/') !== -1 &&
                (p.indexOf('/bet_entries/') !== -1 ||
                    p.indexOf('/xdlive/') !== -1 ||
                    p.indexOf('taixiu') !== -1 ||
                    p.indexOf('tai_xiu') !== -1 ||
                    p.indexOf('xocdia') !== -1 ||
                    p.indexOf('xoc_dia') !== -1))
                return true;
            return false;
        } catch (e) {
            return false;
        }
    }
    var COUNTDOWN_TAIL_MAIN = 'root/left/bg_countdown/bg_count_down/lbl_countdown';
    function readCountdownSec() {
        var picks = [];
        function parseSec(txt) {
            var m = String(txt || '').match(/^\s*(\d{1,2})\s*$/);
            if (!m)
                return null;
            var sec = parseInt(m[1], 10);
            if (!(sec >= 0 && sec <= 60))
                return null;
            return sec;
        }
        walkNodes(function (n) {
            if (!nodeInGame(n))
                return;
            var comps = (n._components || []);
            for (var i = 0; i < comps.length; i++) {
                var c = comps[i];
                if (c && typeof c.string !== 'undefined') {
                    var text = String(c.string == null ? '' : c.string).trim();
                    if (!text)
                        continue;
                    var path = fullPath(n, 80);
                    var pathL = String(path || '').toLowerCase();
                    if (pathL.indexOf(COUNTDOWN_TAIL_MAIN) === -1)
                        continue;
                    var sec = parseSec(text);
                    if (sec == null)
                        continue;
                    var r = wRect(n);
                    picks.push({
                        sec: sec,
                        text: text,
                        tail: path,
                        x: r.x,
                        y: r.y,
                        w: r.w,
                        h: r.h
                    });
                }
            }
        });
        if (!picks.length)
            return null;
        picks.sort(function (a, b) {
            var arA = (a.w || 0) * (a.h || 0);
            var arB = (b.w || 0) * (b.h || 0);
            if (arA !== arB)
                return arB - arA;
            if (a.y !== b.y)
                return a.y - b.y;
            return a.x - b.x;
        });
        var pick = picks[0];
        S._seenCountdown = true;
        S._progTail = pick.tail || '';
        S._progIsSec = true;
        window.__cw_prog_tail = S._progTail;
        return pick.sec;
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
            if (!nodeInGame(n))
                return;
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
    function collectButtons() {
        var out = [];
        walkNodes(function (n) {
            if (!nodeInGame(n))
                return;
            var btns = getComps(n, cc.Button);
            if (btns && btns.length) {
                var r = wRect(n);
                out.push({
                    x: r.x,
                    y: r.y,
                    w: r.w,
                    h: r.h,
                    sx: r.sx,
                    sy: r.sy,
                    sw: r.sw,
                    sh: r.sh,
                    tail: tailOf(n, 12),
                    tl: tailOf(n, 12).toLowerCase()
                });
            }
        });
        return out;
    }
    function collectProgress() {
        var cd = readCountdownSec();
        if (cd != null)
            return cd;
        // Nếu đã từng bắt được countdown theo selector thì không rơi ngược về ProgressBar,
        // tránh nháy 0s -> 18s/20s do lấy nhầm progress ratio.
        if (S && S._seenCountdown) {
            S._progIsSec = true;
            if (S._progSecLast != null)
                return S._progSecLast;
            return null;
        }
        S._progIsSec = false;
        var bars = [];
        walkNodes(function (n) {
            if (!nodeInGame(n))
                return;
            var comps = getComps(n, cc.ProgressBar);
            if (comps && comps.length) {
                var r = wRect(n);
                for (var i = 0; i < comps.length; i++) {
                    bars.push({
                        comp: comps[i],
                        rect: r,
                        tail: tailOf(n, 12)
                    });
                }
            }
        });
        if (!bars.length) {
            S._progTail = '';
            window.__cw_prog_tail = '';
            return null;
        }
        var H = innerHeight,
        cs = bars.filter(function (b) {
            var r = b.rect;
            return r.w > 300 && r.h >= 6 && r.h <= 60 && r.y < H * 0.75;
        });
        var barPick = (cs[0] || bars[0]);
        var bar = barPick.comp;
        try {
            S._progTail = barPick.tail || '';
        } catch (e) {}
        try {
            window.__cw_prog_tail = barPick.tail || '';
        } catch (e) {}
        var pr = (bar && typeof bar.progress !== 'undefined') ? bar.progress : 0;
        return clamp01(Number(pr));
    }
    function stabilizeProgSec(p) {
        if (p == null)
            return p;
        if (!S || !S._progIsSec) {
            if (S) {
                S._progSecLast = null;
                S._progRiseCand = null;
                S._progRiseHits = 0;
            }
            return p;
        }
        var sec = Math.max(0, Number(p) || 0);
        if (S._progSecLast == null) {
            S._progSecLast = sec;
            return sec;
        }
        var prev = Number(S._progSecLast) || 0;
        var rise = sec - prev;
        if (rise >= 4) {
            if (S._progRiseCand != null && sec >= (S._progRiseCand - 2) && sec <= (S._progRiseCand + 3)) {
                S._progRiseHits = (S._progRiseHits || 0) + 1;
            } else {
                S._progRiseCand = sec;
                S._progRiseHits = 1;
            }
            if ((S._progRiseHits || 0) >= 2) {
                S._progSecLast = sec;
                S._progRiseCand = null;
                S._progRiseHits = 0;
                return sec;
            }
            return prev;
        }
        S._progSecLast = sec;
        S._progRiseCand = null;
        S._progRiseHits = 0;
        return sec;
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
    function rectForTextMap(n, text) {
        var r = wRect(n);
        if ((r.x || r.y || r.w || r.h))
            return r;
        function worldPt(x, y) {
            try {
                if (n && n.convertToWorldSpaceAR)
                    return n.convertToWorldSpaceAR(new V2(x, y));
            } catch (e) {}
            try {
                if (cc.UITransform && n && n.getComponent) {
                    var ut = n.getComponent(cc.UITransform);
                    if (ut && ut.convertToWorldSpaceAR)
                        return ut.convertToWorldSpaceAR(new V2(x, y));
                }
            } catch (e) {}
            try {
                if (n && n.getWorldPosition) {
                    var wp = n.getWorldPosition();
                    return {
                        x: (wp.x || 0) + (x || 0),
                        y: (wp.y || 0) + (y || 0)
                    };
                }
            } catch (e) {}
            try {
                if (n && n.worldPosition) {
                    return {
                        x: (n.worldPosition.x || 0) + (x || 0),
                        y: (n.worldPosition.y || 0) + (y || 0)
                    };
                }
            } catch (e) {}
            return {
                x: 0,
                y: 0
            };
        }
        function sizeFromNode() {
            try {
                if (n.getContentSize)
                    return n.getContentSize();
            } catch (e) {}
            try {
                if (n._contentSize)
                    return n._contentSize;
            } catch (e) {}
            try {
                if (cc.UITransform && n.getComponent) {
                    var ut = n.getComponent(cc.UITransform);
                    if (ut) {
                        if (ut.contentSize)
                            return ut.contentSize;
                        if (ut.width != null && ut.height != null)
                            return {
                                width: ut.width,
                                height: ut.height
                            };
                    }
                }
            } catch (e) {}
            return {
                width: 0,
                height: 0
            };
        }
        function rectFromWorld(x1, y1, x2, y2) {
            var minX = Math.min(x1, x2);
            var minY = Math.min(y1, y2);
            var maxX = Math.max(x1, x2);
            var maxY = Math.max(y1, y2);
            var sp1 = toScreenPt(n, new V2(minX, minY));
            var sp2 = toScreenPt(n, new V2(maxX, maxY));
            var sx = Math.min(sp1.x, sp2.x);
            var sy = Math.min(sp1.y, sp2.y);
            var sw = Math.abs(sp2.x - sp1.x);
            var sh = Math.abs(sp2.y - sp1.y);
            return {
                x: minX,
                y: minY,
                w: Math.abs(maxX - minX),
                h: Math.abs(maxY - minY),
                sx: sx,
                sy: sy,
                sw: sw,
                sh: sh
            };
        }
        try {
            var sz = sizeFromNode();
            if (sz && (sz.width || sz.height)) {
                var p0 = worldPt(0, 0);
                var ax = (n.anchorX != null ? n.anchorX : 0.5);
                var ay = (n.anchorY != null ? n.anchorY : 0.5);
                var blx = (p0.x || 0) - (sz.width || 0) * ax;
                var bly = (p0.y || 0) - (sz.height || 0) * ay;
                return rectFromWorld(blx, bly, blx + (sz.width || 0), bly + (sz.height || 0));
            }
        } catch (e) {}
        try {
            var lb = getComp(n, cc.Label) || getComp(n, cc.RichText);
            var rd = null;
            if (lb && lb._assembler && lb._assembler._renderData)
                rd = lb._assembler._renderData;
            else if (lb && lb._renderData)
                rd = lb._renderData;
            if (rd && rd._data && rd._data.length >= 10) {
                var data = rd._data;
                var minX = 1e9,
                minY = 1e9,
                maxX = -1e9,
                maxY = -1e9;
                for (var i = 0; i + 1 < data.length; i += 5) {
                    var dx = data[i],
                    dy = data[i + 1];
                    if (!isFinite(dx) || !isFinite(dy))
                        continue;
                    if (dx < minX)
                        minX = dx;
                    if (dy < minY)
                        minY = dy;
                    if (dx > maxX)
                        maxX = dx;
                    if (dy > maxY)
                        maxY = dy;
                }
                if (minX <= maxX && minY <= maxY) {
                    var p1 = worldPt(minX, minY);
                    var p2 = worldPt(maxX, maxY);
                    return rectFromWorld(p1.x || 0, p1.y || 0, p2.x || 0, p2.y || 0);
                }
            }
        } catch (e) {}
        try {
            if (n.getBoundingBoxToWorld) {
                var bb = n.getBoundingBoxToWorld();
                if (bb && (bb.x || bb.y || bb.width || bb.height)) {
                    return rectFromWorld(bb.x || 0, bb.y || 0, (bb.x || 0) + (bb.width || 0), (bb.y || 0) + (bb.height || 0));
                }
            }
        } catch (e) {}
        try {
            if (cc.UITransform && n.getComponent) {
                var ut = n.getComponent(cc.UITransform);
                if (ut && ut.getBoundingBoxToWorld) {
                    var bb2 = ut.getBoundingBoxToWorld();
                    if (bb2 && (bb2.x || bb2.y || bb2.width || bb2.height)) {
                        return rectFromWorld(bb2.x || 0, bb2.y || 0, (bb2.x || 0) + (bb2.width || 0), (bb2.y || 0) + (bb2.height || 0));
                    }
                }
            }
        } catch (e) {}
        try {
            var lb2 = getComp(n, cc.Label) || getComp(n, cc.RichText);
            if (lb2) {
                var fs = lb2.fontSize || lb2._fontSize || 0;
                var lh = lb2.lineHeight || lb2._lineHeight || fs;
                var t = String(text || '').trim();
                if (fs > 0 && t) {
                    var lines = t.split(/\r?\n/);
                    var maxLen = 0;
                    for (var i2 = 0; i2 < lines.length; i2++) {
                        if (lines[i2].length > maxLen)
                            maxLen = lines[i2].length;
                    }
                    var w = Math.max(1, Math.round(maxLen * fs * 0.6));
                    var h = Math.max(1, Math.round(lines.length * lh));
                    var p = worldPt(0, 0);
                    var ax2 = (n.anchorX != null ? n.anchorX : 0.5);
                    var ay2 = (n.anchorY != null ? n.anchorY : 0.5);
                    var wx = (p.x || 0) - w * ax2;
                    var wy = (p.y || 0) - h * ay2;
                    return rectFromWorld(wx, wy, wx + w, wy + h);
                }
            }
        } catch (e) {}
        return r;
    }
    function buildTextRects() {
        var out = [];
        walkNodes(function (n) {
            if (!nodeInGame(n))
                return;
            var comps = (n._components || []);
            for (var i = 0; i < comps.length; i++) {
                var c = comps[i];
                if (c && typeof c.string !== 'undefined') {
                    var s = String(c.string == null ? '' : c.string).trim();
                    if (!s)
                        continue;
                    var r = rectForTextMap(n, s);
                    var x = Math.round(r.x),
                    y = Math.round(r.y),
                    w = Math.round(r.w),
                    h = Math.round(r.h);
                    var tail = fullPath(n, 80);
                    var idx = out.length + 1;
                    out.push({
                        idx: idx,
                        text: s,
                        x: x,
                        y: y,
                        w: w,
                        h: h,
                        sx: r.sx,
                        sy: r.sy,
                        sw: r.sw,
                        sh: r.sh,
                        n: {
                            x: x / innerWidth,
                            y: y / innerHeight,
                            w: w / innerWidth,
                            h: h / innerHeight
                        },
                        tail: tail,
                        tl: String(tail || '').toLowerCase()
                    });
                }
            }
        });
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

    function limitSeq52(seq) {
        if (!seq)
            return '';
        if (seq.length <= 52)
            return seq;
        return seq.slice(-52);
    }

    var TAIL_LAST_RESULT_ROWS = 'dual/canvas/node_dual/root/node_game(need_to_put_games_in_here)/prefab_game_305/root/left/lastresult/results/row-';
    var TK_ROW_ORDER = [4, 3, 2, 1];
    var TK_COL_ORDER = [0, 1, 2, 3, 4, 5, 6];

    function soicauCode(name) {
        var s = String(name || '').toLowerCase();
        if (s.indexOf('ig_soicau_xiuchan') !== -1)
            return '0';
        if (s.indexOf('ig_soicau_xiule') !== -1)
            return '1';
        if (s.indexOf('ig_soicau_taichan') !== -1)
            return '2';
        if (s.indexOf('ig_soicau_taile') !== -1)
            return '3';
        return '';
    }

    function beadVal(name, nodeName) {
        var s = (String(name || '') + ' ' + String(nodeName || '')).toLowerCase();
        if (s.indexOf('chan') !== -1)
            return 'C';
        if (s.indexOf('le') !== -1)
            return 'L';
        return '?';
    }

    function readTKSeqLastResult() {
        var cells = [];
        walkNodes(function (n) {
            if (!nodeInGame(n))
                return;
            if (!isNodeActive(n))
                return;
            var full = fullPath(n, 160);
            if (!full)
                return;
            var fullL = String(full).toLowerCase();
            if (fullL.indexOf(TAIL_LAST_RESULT_ROWS) === -1)
                return;

            var mRow = /\/row-(\d{3})\//i.exec(full);
            var mCol = /\/ig_soicau_[^\/]*-(\d{3})(?:\/|$)/i.exec(full);
            if (!mRow || !mCol)
                return;

            var row = parseInt(mRow[1], 10);
            var col = parseInt(mCol[1], 10);
            if (isNaN(row) || isNaN(col))
                return;

            var comps = (n._components || []);
            var v = '';
            var sfName = '';
            for (var i = 0; i < comps.length; i++) {
                var c = comps[i];
                var sf = c && (c.spriteFrame || c._spriteFrame);
                if (!sf)
                    continue;
                var name = sf.name || sf._name || (sf._texture && sf._texture.name) || '';
                var code = soicauCode(name);
                if (!code)
                    continue;
                v = code;
                sfName = String(name || '');
                break;
            }
            if (!v)
                return;

            var r = beadRectFallback(n, wRect(n));
            var bx = pickCoord(r.sx, r.x);
            var by = pickCoord(r.sy, r.y);
            var inView = (bx >= -10 && bx <= innerWidth + 10 && by >= -10 && by <= innerHeight + 10);

            cells.push({
                v: v,
                row: row,
                col: col,
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
                sprite: sfName,
                node: (n && n.name) || ''
            });
        });

        if (!cells.length)
            return {
                seq: '',
                which: null,
                cols: [],
                cells: [],
                groups: [],
                seqGrouped: ''
            };

        var matrix = {};
        for (var j = 0; j < cells.length; j++) {
            var it = cells[j];
            if (!matrix[it.row])
                matrix[it.row] = {};
            matrix[it.row][it.col] = it;
        }

        var groups = [];
        for (var ri = 0; ri < TK_ROW_ORDER.length; ri++) {
            var rr = TK_ROW_ORDER[ri];
            var s = '';
            for (var ci = 0; ci < TK_COL_ORDER.length; ci++) {
                var cc = TK_COL_ORDER[ci];
                var cell = matrix[rr] ? matrix[rr][cc] : null;
                if (cell)
                    s += String(cell.v || '');
            }
            if (s.length)
                groups.push(s);
        }

        var cols = [];
        for (var ci2 = 0; ci2 < TK_COL_ORDER.length; ci2++) {
            var colN = TK_COL_ORDER[ci2];
            var items = [];
            for (var ri2 = 0; ri2 < TK_ROW_ORDER.length; ri2++) {
                var rowN = TK_ROW_ORDER[ri2];
                var c2 = matrix[rowN] ? matrix[rowN][colN] : null;
                if (c2)
                    items.push(c2);
            }
            if (items.length)
                cols.push({
                    cx: colN,
                    items: items
                });
        }

        var seqGrouped = groups.join(' ');
        var seq = limitSeq52(groups.join(''));
        return {
            seq: seq,
            which: 'lastResult_results_305',
            cols: cols,
            cells: cells,
            groups: groups,
            seqGrouped: seqGrouped
        };
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

    function collectBeadsByTail(tailNeedle) {
        var out = [];
        var needle = String(tailNeedle || '').toLowerCase();
        walkNodes(function (n) {
            if (!nodeInGame(n))
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

    function readTKSeq() {
        return readTKSeqLastResult();
    }



        /* ---------------- helpers for totals by (y, tail) ---------------- */

        var TAIL_BET_CHAN = 'dual/Canvas/node_dual/root/node_game(need_to_put_games_in_here)/prefab_game_305/root/middle/board_back/lbl_money_total_bet_chan';

        var TAIL_BET_LE = 'dual/Canvas/node_dual/root/node_game(need_to_put_games_in_here)/prefab_game_305/root/middle/board_back/lbl_money_total_bet_le';

        var TAIL_BET_TAI = 'dual/Canvas/node_dual/root/node_game(need_to_put_games_in_here)/prefab_game_305/root/middle/board_back/lbl_money_total_bet_tai';

        var TAIL_BET_XIU = 'dual/Canvas/node_dual/root/node_game(need_to_put_games_in_here)/prefab_game_305/root/middle/board_back/lbl_money_total_bet_xiu';

        var TAIL_ACC = 'dual/Canvas/node_dual/root/node_game(need_to_put_games_in_here)/prefab_game_305/root/left/avatar_node/lbl_money';

        var TAIL_USER_NAME = 'dual/Canvas/node_dual/root/node_game(need_to_put_games_in_here)/prefab_game_305/root/left/avatar_node/lbl_username';


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

        function buildMoneyFromTextRects(texts) {

            texts = texts || buildTextRects();

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

            var arr = [];

            for (var i = 0; i < list.length; i++) {

                var it = list[i];
                var tail = tailOfMoney(it);
                if (tailEquals(tail, TAIL_BET_CHAN) || tailEquals(tail, TAIL_BET_LE) || tailEquals(tail, TAIL_BET_TAI) || tailEquals(tail, TAIL_BET_XIU))
                    arr.push({ idx: i, it: it });

            }

            arr.sort(function (A, B) {

                return xOf(A.it) - xOf(B.it) || yOf(A.it) - yOf(B.it);

            });

            var lines = ['(' + (title || 'Bet candidates by tail') + ') idx\ttxt\tval\tx\ty\tsx\tsy\tsw\tsh\ttail'];

            for (var j = 0; j < arr.length; j++) {

                var r = arr[j].it;

                lines.push((j + 1) + ':' + arr[j].idx + "\t'" + r.txt + "'\t" + r.val + "\t" +
                    Math.round(xOf(r)) + "\t" + Math.round(yOf(r)) + "\t" +
                    Math.round(r.sx || 0) + "\t" + Math.round(r.sy || 0) + "\t" +
                    Math.round(r.sw || 0) + "\t" + Math.round(r.sh || 0) + "\t'" + String(tailOfMoney(r) || '') + "'");

            }

            if (!arr.length) {

                lines.push('(empty)');

            } else {
                var pickC = pickByTail(list, TAIL_BET_CHAN);
                var pickL = pickByTail(list, TAIL_BET_LE);
                var pickT = pickByTail(list, TAIL_BET_TAI);
                var pickX = pickByTail(list, TAIL_BET_XIU);
                lines.push('pick CHẴN: ' + (pickC ? ("'" + pickC.txt + "'") : '(none)'));
                lines.push('pick LẺ  : ' + (pickL ? ("'" + pickL.txt + "'") : '(none)'));
                lines.push('pick TÀI : ' + (pickT ? ("'" + pickT.txt + "'") : '(none)'));
                lines.push('pick XỈU : ' + (pickX ? ("'" + pickX.txt + "'") : '(none)'));

            }

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
            return pickByTail(buildMoneyFromTextRects(), TAIL_BET_CHAN);

        };

        window.cwPickLe = function () {
            return pickByTail(buildMoneyFromTextRects(), TAIL_BET_LE);

        };
        window.cwPickTai = function () {
            return pickByTail(buildMoneyFromTextRects(), TAIL_BET_TAI);
        };
        window.cwPickXiu = function () {
            return pickByTail(buildMoneyFromTextRects(), TAIL_BET_XIU);
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

    /* ---------------- totals (using y & tail) ---------------- */
    function totals(S) {
        S.money = buildMoneyRects(); // keep map for overlays & legacy helpers

        var list = S.money;
        var listTextAll = buildTextRects();
        S._lastTextAll = listTextAll;
        S._lastTextAt = Date.now();
        var listTextMoney = buildMoneyFromTextRects(listTextAll);
        var mC = pickByTail(listTextMoney, TAIL_BET_CHAN);
        var mL = pickByTail(listTextMoney, TAIL_BET_LE);
        var mT = pickByTail(listTextMoney, TAIL_BET_TAI);
        var mX = pickByTail(listTextMoney, TAIL_BET_XIU);
        var mA = pickByTailMinY(listTextMoney, TAIL_ACC);
        var mN = pickByTailMinY(listTextAll, TAIL_USER_NAME);

        return {
            C: mC ? mC.val : null,
            L: mL ? mL.val : null,
            T: mT ? mT.val : null,
            X: mX ? mX.val : null,
            A: mA ? mA.val : null,
            N: mN ? String(mN.text != null ? mN.text : '') : null,
            rawC: mC ? mC.txt : null,
            rawL: mL ? mL.txt : null,
            rawT: mT ? mT.txt : null,
            rawX: mX ? mX.txt : null,
            rawA: mA ? mA.txt : null,
            rawN: mN ? String(mN.text != null ? mN.text : '') : null
        };
    }

    var __cw_totals_cache = {
        at: 0,
        val: null
    };
    function sampleTotalsNow(forceFresh) {
        var now = Date.now();
        if (!forceFresh && __cw_totals_cache.val && (now - (__cw_totals_cache.at || 0)) < 420)
            return __cw_totals_cache.val;
        try {
            var v = totals(S);
            __cw_totals_cache = {
                at: now,
                val: v
            };
            return v;
        } catch (e) {
            return {
                C: null,
                L: null,
                T: null,
                X: null,
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
            var cur = sampleTotalsNow(true);
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
        tickMs: 320,
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
        seq: '',
        _progSecLast: null,
        _progRiseCand: null,
        _progRiseHits: 0,
        _seenCountdown: false
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
    panel.style.cssText = 'position:fixed;left:50%;bottom:10px;transform:translateX(-50%);width:min(920px,calc(100vw - 20px));background:#08130f;color:#bff;border:1px solid #0a0;border-radius:10px;padding:8px;font:12px/1.35 Consolas,monospace;pointer-events:auto;z-index:2147483647;max-height:68vh;overflow:auto';
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
        '<button id="bScanText">Scan500Text</button>' +
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
    root.style.display='none';
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
    try {
        __cw_tryPost({
            abx: 'cw_ui_state',
            state: 'mounted',
            host: String(location.hostname || ''),
            href: String(location.href || ''),
            ts: Date.now()
        });
    } catch (_) {}
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
            panel.style.transform = 'none';
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
                            h: m.h,
                            sx: m.sx,
                            sy: m.sy,
                            sw: m.sw,
                            sh: m.sh
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
            T: null,
            X: null,
            A: null,
            N: null,
            rawC: null,
            rawL: null,
            rawT: null,
            rawX: null,
            rawA: null,
            rawN: null
        };
        var f = S.focus;
        var progText = (S.prog == null ? '--' : (S._progIsSec ? (S.prog + 's') : (((S.prog * 100) | 0) + '%')));
        var base =
            ' Trạng thái: ' + S.status + ' | Prog: ' + progText + '\n' +
            '• TÊN NHÂN VẬT : ' + (t.N != null && String(t.N).trim() ? String(t.N).trim() : '--') + '|TK : ' + fmt(t.A) + '|CHẴN: ' + fmt(t.C) + '|LẺ : ' + fmt(t.L) + '|TÀI : ' + fmt(t.T) + '|XỈU : ' + fmt(t.X) + '\n' +

            '• Focus: ' + (f ? f.kind : '-') + '\n' +
            '  idx : ' + (f && f.idx != null ? f.idx : '-') + '\n' +
            '  tail: ' + (f ? f.tail : '-') + '\n' +
            '  text: ' + (f ? (f.txt != null ? f.txt : '-') : '-') + '\n' +
            '  x,y,w,h: ' + (f && f.rect ? (Math.round(f.rect.x) + ',' + Math.round(f.rect.y) + ',' + Math.round(f.rect.w) + ',' + Math.round(f.rect.h)) : '-') + '\n' +
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
        var moneyRaw = buildMoneyRects();
        var money = moneyRaw.slice().sort(function (a, b) {
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
        debugChanLeLog(moneyRaw, 'Chan/Le by MoneyMap');
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
    function scanText(limit) {
        var maxN = Number(limit) || 200;
        if (maxN < 1)
            maxN = 1;
        if (maxN > 5000)
            maxN = 5000;

        var allTexts = buildTextRects();
        var texts = allTexts.slice(0, maxN)
            .map(function (t) {
                return {
                    text: t.text,
                    tail: t.tail,
                    x: Math.round(t.x),
                    y: Math.round(t.y),
                    w: Math.round(t.w),
                    h: Math.round(t.h)
                };
            });

        console.log('(Text index x' + maxN + ')\ttext\tx\ty\tw\th\ttail');
        for (var j = 0; j < texts.length; j++) {
            var r = texts[j];
            console.log(j + "\t'" + r.text + "'\t" + r.x + "\t" + r.y + "\t" + r.w + "\t" + r.h + "\t'" + r.tail + "'");
        }

        var lines = ['(Text index x' + maxN + ')\ttext\tx\ty\tw\th\ttail'];
        lines.push('count=' + texts.length + '/' + allTexts.length + (allTexts.length > maxN ? ' (truncated)' : ''));
        for (var k = 0; k < texts.length; k++) {
            var r2 = texts[k];
            lines.push(k + "\t'" + r2.text + "'\t" + r2.x + "\t" + r2.y + "\t" + r2.w + "\t" + r2.h + "\t'" + r2.tail + "'");
        }
        if (!texts.length)
            lines.push('(empty)');
        lines.push('');
        lines = lines.concat(chanLeDebugLines(buildMoneyFromTextRects(allTexts), 'Chan/Le by TextMap'));
        setCwLog(lines.join('\n'));
        window.__cw_lastTextScan = texts;
        try {
            console.table(texts);
        } catch (e) {
            console.log(texts);
        }
        return texts;
    }

    function scan200Text() {
        return scanText(200);
    }

    function scan500Text() {
        return scanText(500);
    }

    function scanTK() {
        var r = readTKSeq();
        var cells = (r && r.cells) ? r.cells.slice() : [];
        cells.sort(function (a, b) {
            return (a.row || 0) - (b.row || 0) || (a.col || 0) - (b.col || 0);
        });
        var lines = [];
        lines.push('(TK sequence) which=' + (r && r.which ? r.which : '-') + ' cells=' + cells.length + ' seq=' + (r && r.seq ? r.seq : ''));
        if (r && r.seqGrouped)
            lines.push('seqGrouped=' + r.seqGrouped);
        lines.push('cells idx\tv\trow\tcol\tx\ty\tw\th\ttail');
        for (var i = 0; i < cells.length; i++) {
            var c = cells[i];
            var tail = c.fullTail || c.tail || '';
            lines.push((i + 1) + "\t" + c.v + "\t" + (c.row != null ? c.row : '-') + "\t" + (c.col != null ? c.col : '-') + "\t" +
                Math.round(c.x) + "\t" + Math.round(c.y) + "\t" +
                Math.round(c.w || 0) + "\t" + Math.round(c.h || 0) + "\t'" + tail + "'");
        }
        lines.push('');
        lines.push('columns (col 0->6, row 4->1):');
        if (r && r.cols && r.cols.length) {
            for (var j = 0; j < r.cols.length; j++) {
                var col = r.cols[j];
                var arr = col.items.slice();
                var digits = arr.map(function (it) {
                    return it.v;
                }).join('');
                var rows = arr.map(function (it) {
                    return it.row;
                }).join(',');
                lines.push("col=" + col.cx + " digits=" + digits + " rows=" + rows);
            }
        } else {
            lines.push('(no columns)');
        }
        setCwLog(lines.join('\n'));
        return r;
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
        '5000000': 1,
        '10000000': 1,
        '20000000': 1,
        '50000000': 1,
        '100000000': 1,
        '500000000': 1
    };
    var DENOMS = [500000000, 100000000, 50000000, 20000000, 10000000, 5000000, 1000000, 500000, 100000, 50000, 10000, 5000, 1000];

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
        // TX Live: thêm nhánh rõ cho TÀI/XỈU
        if (s === 'TAI' || s === 'BIG')
            return 'TAI';
        if (s === 'XIU' || s === 'SMALL')
            return 'XIU';
        if (s === 'CHAN' || s === 'EVEN')
            return 'CHAN';
        if (s === 'LE' || s === 'ODD')
            return 'LE';
        return s;
    }
    var SIDE_REGEX = {
        // Không dùng \b vì tail có dạng snake_case (..._bet_tai, ..._bet_xiu)
        TAI: /(?:^|[^A-Z0-9])(TAI|BIG)(?:$|[^A-Z0-9])/i,
        XIU: /(?:^|[^A-Z0-9])(XIU|SMALL)(?:$|[^A-Z0-9])/i,
        CHAN: /(?:^|[^A-Z0-9])(CHAN|EVEN)(?:$|[^A-Z0-9])/i,
        LE: /(?:^|[^A-Z0-9])(LE|ODD)(?:$|[^A-Z0-9])/i
    };
    var BET_TAILS = {
        TAI: 'dual/Canvas/node_dual/root/node_game(need_to_put_games_in_here)/prefab_game_305/root/middle/board_back/lbl_money_total_bet_tai',
        XIU: 'dual/Canvas/node_dual/root/node_game(need_to_put_games_in_here)/prefab_game_305/root/middle/board_back/lbl_money_total_bet_xiu',
        CHAN: 'dual/Canvas/node_dual/root/node_game(need_to_put_games_in_here)/prefab_game_305/root/middle/board_back/lbl_money_total_bet_chan',
        LE: 'dual/Canvas/node_dual/root/node_game(need_to_put_games_in_here)/prefab_game_305/root/middle/board_back/lbl_money_total_bet_le'
    };
    var BET_BOARD_TAIL = 'dual/Canvas/node_dual/root/node_game(need_to_put_games_in_here)/prefab_game_305/root/middle/board_back';
    var BET_ZONE_TAILS = {
        TAI: 'dual/Canvas/node_dual/root/node_game(need_to_put_games_in_here)/prefab_game_305/root/middle/board_back/tai_bet',
        XIU: 'dual/Canvas/node_dual/root/node_game(need_to_put_games_in_here)/prefab_game_305/root/middle/board_back/xiu_bet',
        CHAN: 'dual/Canvas/node_dual/root/node_game(need_to_put_games_in_here)/prefab_game_305/root/middle/board_back/chan_bet',
        LE: 'dual/Canvas/node_dual/root/node_game(need_to_put_games_in_here)/prefab_game_305/root/middle/board_back/le_bet'
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
        var f = String(full || '').toLowerCase();
        var t = String(tail || '').toLowerCase();
        return f === t || f.indexOf(t, Math.max(0, f.length - t.length)) !== -1;
    }
    function findNodeByTail(tail) {
        if (!tail)
            return null;
        var hit = null;
        var bestArea = -1;
        walkNodes(function (n) {
            if (!n || !active(n) || !nodeInGame(n))
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
            if (!n || !active(n) || !nodeInGame(n))
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
    function __cwCollectBetNearHits(anchor, focusRect, opts) {
        opts = opts || {};
        var hits = [];
        var focus = __cwRectNorm(focusRect);
        var maxNodes = Math.max(80, __cwNumber(opts.maxNearNodes, 260));
        var preferClickable = opts.preferClickable !== false;
        var seen = 0;
        if (!anchor || !focus)
            return hits;
        (function walk(n, depth) {
            if (!n || !active(n) || seen >= maxNodes)
                return;
            seen++;
            var rect = rectFromNodeScreen(n) || rectFromNodeCompat(n) || null;
            if (rect) {
                var nr = __cwRectNorm(rect);
                var area = nr.w * nr.h;
                var pad = Math.max(14, Math.max(focus.w, focus.h) * 0.38);
                var contains = __cwRectContainsPt(nr, focus.cx, focus.cy, pad);
                var near = __cwRectDistToPt(nr, focus.cx, focus.cy) <= Math.max(36, Math.max(focus.w, focus.h) * 0.95);
                var sameBand = !(nr.bottom < focus.top - pad || nr.top > focus.bottom + pad);
                var huge = area > Math.max(320000, focus.w * focus.h * 140);
                var path = String(fullPath(n, 180) || '').toLowerCase();
                var name = String(n.name || '').toLowerCase();
                var click = clickable(n);
                var score = 0;
                if (contains)
                    score += 80;
                if (near)
                    score += 48;
                if (sameBand)
                    score += 18;
                if (click)
                    score += 26;
                if (depth <= 1)
                    score += 8;
                if (/chan|le|tai|xiu|odd|even|bet|board|panel|back|bg|box|zone|slot|frame|cua/.test(name + '|' + path))
                    score += 10;
                if (huge)
                    score -= 72;
                if (preferClickable && !click && score < 72)
                    score -= 22;
                if (score >= 48) {
                    hits.push({
                        node: n,
                        rect: nr,
                        score: score,
                        area: area
                    });
                }
            }
            var kids = n.children || [];
            for (var i = 0; i < kids.length; i++)
                walk(kids[i], depth + 1);
        })(anchor, 0);
        hits.sort(function (a, b) {
            if ((b.score || 0) !== (a.score || 0))
                return (b.score || 0) - (a.score || 0);
            return (a.area || 0) - (b.area || 0);
        });
        return hits;
    }
    function __cwBetNodeName(node) {
        return String(node && node.name || '');
    }
    function __cwBetNodePath(node) {
        return String(fullPath(node, 220) || '');
    }
    function __cwBetRectSane(rect) {
        var nr = __cwRectNorm(rect);
        if (!nr)
            return false;
        if (nr.w < 24 || nr.h < 18)
            return false;
        if (nr.cx < 40 || nr.cy < 40)
            return false;
        var area = nr.w * nr.h;
        if (area < 600 || area > 240000)
            return false;
        return true;
    }
    function __cwBetRectLite(rect) {
        var nr = __cwRectNorm(rect);
        if (!nr)
            return null;
        return {
            x: Math.round(nr.x * 10) / 10,
            y: Math.round(nr.y * 10) / 10,
            w: Math.round(nr.w * 10) / 10,
            h: Math.round(nr.h * 10) / 10,
            cx: Math.round(nr.cx * 10) / 10,
            cy: Math.round(nr.cy * 10) / 10
        };
    }
    function __cwPickBetRect() {
        var best = null;
        var bestScore = -1e9;
        for (var i = 0; i < arguments.length; i++) {
            var nr = __cwRectNorm(arguments[i]);
            if (!nr)
                continue;
            var score = __cwBetRectSane(nr) ? 1000000 : 0;
            score += Math.max(1, __cwNumber(nr.w, 0) * __cwNumber(nr.h, 0));
            if (!best || score > bestScore) {
                best = nr;
                bestScore = score;
            }
        }
        return best;
    }
    function __cwIsBoardBackNode(node) {
        if (!node)
            return false;
        var name = String(node.name || '').toLowerCase();
        if (name === 'board_back')
            return true;
        var path = __cwBetNodePath(node).toLowerCase();
        return /(^|\/)board_back$/.test(path);
    }
    function __cwFindBoardBackRect(node) {
        var cur = node;
        var best = null;
        while (cur) {
            if (__cwIsBoardBackNode(cur)) {
                var rect = __cwPickBetRect(rectFromNodeCompat(cur), rectFromNodeScreen(cur));
                if (__cwBetRectSane(rect))
                    return rect;
                if (!best && rect)
                    best = rect;
            }
            cur = cur.parent || cur._parent || null;
        }
        return best;
    }
    function __cwFindBoardBackNode(node) {
        var cur = node;
        while (cur) {
            if (__cwIsBoardBackNode(cur))
                return cur;
            cur = cur.parent || cur._parent || null;
        }
        return findNodeByTail(BET_BOARD_TAIL);
    }
    function __cwClampRectInto(rect, container) {
        rect = __cwRectNorm(rect);
        container = __cwRectNorm(container);
        if (!rect)
            return null;
        if (!container)
            return rect;
        var w = Math.max(20, Math.min(rect.w, container.w));
        var h = Math.max(16, Math.min(rect.h, container.h));
        var x = Math.max(container.left, Math.min(rect.x, container.right - w));
        var y = Math.max(container.top, Math.min(rect.y, container.bottom - h));
        return __cwRectNorm({
            x: x,
            y: y,
            w: w,
            h: h
        });
    }
    function __cwBuildBetCellRect(side, boardRect, labelRect) {
        boardRect = __cwRectNorm(boardRect);
        if (!boardRect)
            return null;
        labelRect = __cwRectNorm(labelRect);
        var halfW = boardRect.w / 2;
        var halfH = boardRect.h / 2;
        var left = false;
        var top = false;
        if (labelRect && __cwRectContainsPt(boardRect, labelRect.cx, labelRect.cy, 2)) {
            left = labelRect.cx <= boardRect.cx;
            top = labelRect.cy <= boardRect.cy;
        } else {
            left = (side === 'TAI' || side === 'CHAN');
            top = (side === 'CHAN' || side === 'LE');
        }
        return __cwRectNorm({
            x: boardRect.x + (left ? 0 : halfW),
            y: boardRect.y + (top ? 0 : halfH),
            w: halfW,
            h: halfH
        });
    }
    function __cwBuildBetInnerProbeRect(side, labelRect, boardRect) {
        side = normalizeSide(side);
        labelRect = __cwRectNorm(labelRect);
        boardRect = __cwRectNorm(boardRect);
        var saneLabelRect = __cwBetRectSane(labelRect) ? labelRect : null;
        var cell = __cwBuildBetCellRect(side, boardRect, labelRect);
        if (cell) {
            var insetX = Math.max(42, cell.w * 0.28);
            var insetY = Math.max(20, cell.h * 0.24);
            var base = __cwRectNorm({
                x: cell.x + insetX,
                y: cell.y + insetY,
                w: Math.max(92, cell.w - insetX * 2),
                h: Math.max(58, cell.h - insetY * 2)
            });
            if (!saneLabelRect)
                return __cwClampRectInto(base, cell);
            var centerX = Math.max(base.left + base.w * 0.2, Math.min(saneLabelRect.cx, base.right - base.w * 0.2));
            var centerY = Math.max(base.top + base.h * 0.25, Math.min(saneLabelRect.cy + base.h * 0.22, base.bottom - base.h * 0.2));
            return __cwClampRectInto({
                x: centerX - base.w / 2,
                y: centerY - base.h / 2,
                w: base.w,
                h: base.h
            }, cell);
        }
        if (saneLabelRect) {
            var w = Math.max(132, Math.min(192, saneLabelRect.w * 1.22));
            var h = Math.max(70, Math.min(96, saneLabelRect.h * 4.1));
            var down = Math.max(22, Math.min(36, h * 0.38));
            return __cwRectNorm({
                x: saneLabelRect.cx - w / 2,
                y: saneLabelRect.cy + down - h / 2,
                w: w,
                h: h
            });
        }
        return null;
    }
    function __cwBuildBetCellProbeRect(side, boardRect) {
        var cell = __cwBuildBetCellRect(side, boardRect, null);
        if (!cell)
            return null;
        var insetX = Math.max(34, cell.w * 0.23);
        var insetY = Math.max(18, cell.h * 0.21);
        return __cwClampRectInto({
            x: cell.x + insetX,
            y: cell.y + insetY,
            w: Math.max(88, cell.w - insetX * 2),
            h: Math.max(56, cell.h - insetY * 2)
        }, cell);
    }
    function __cwFindBetZoneNode(side) {
        side = normalizeSide(side);
        var zoneTail = BET_ZONE_TAILS[side];
        if (!zoneTail)
            return null;
        var zoneNode = findNodeByTail(zoneTail);
        if (zoneNode)
            return zoneNode;
        var btnNode = findNodeByTail(zoneTail + '/New Button');
        if (btnNode)
            return btnNode.parent || btnNode._parent || btnNode;
        return null;
    }
    function __cwFindExactBetTarget(side, trace) {
        side = normalizeSide(side);
        var labelTail = BET_TAILS[side];
        if (!labelTail) {
            __cwPushBetTrace(trace, 'exact-miss', {
                reason: 'tail_missing',
                side: side
            });
            return null;
        }
        var labelNode = findNodeByTail(labelTail);
        var zoneNode = __cwFindBetZoneNode(side);
        var labelRect = labelNode ? __cwPickBetRect(rectFromNodeScreen(labelNode), rectFromNodeCompat(labelNode)) : null;
        var zoneRect = zoneNode ? __cwPickBetRect(rectFromNodeScreen(zoneNode), rectFromNodeCompat(zoneNode)) : null;
        var boardNode = labelNode ? __cwFindBoardBackNode(labelNode) : (zoneNode ? __cwFindBoardBackNode(zoneNode) : findNodeByTail(BET_BOARD_TAIL));
        var boardRect = boardNode ? __cwPickBetRect(rectFromNodeCompat(boardNode), rectFromNodeScreen(boardNode)) : null;
        var cellRect = __cwBuildBetCellRect(side, boardRect, labelRect);
        var probeRect = __cwBuildBetInnerProbeRect(side, labelRect, boardRect);
        if (!__cwBetRectSane(probeRect))
            probeRect = __cwBuildBetCellProbeRect(side, boardRect);
        probeRect = __cwClampRectInto(probeRect || cellRect || boardRect, cellRect || boardRect);
        var anchorNode = labelNode || zoneNode || null;
        var ok = !!(anchorNode && boardNode && __cwBetRectSane(boardRect) && __cwBetRectSane(probeRect));
        __cwPushBetTrace(trace, ok ? 'exact-hit' : 'exact-miss', {
            selectorPath: labelNode ? __cwBetNodePath(labelNode) : '',
            zonePath: zoneNode ? __cwBetNodePath(zoneNode) : '',
            boardPath: boardNode ? __cwBetNodePath(boardNode) : '',
            labelRect: __cwBetRectLite(labelRect),
            zoneRect: __cwBetRectLite(zoneRect),
            boardRect: __cwBetRectLite(boardRect),
            cellRect: __cwBetRectLite(cellRect),
            probeRect: __cwBetRectLite(probeRect),
            ok: ok
        });
        if (!ok)
            return null;
        return {
            node: anchorNode,
            rect: probeRect,
            labelRect: labelRect,
            zoneRect: zoneRect,
            boardRect: boardRect,
            cellRect: cellRect,
            sourceTag: (labelNode ? 'exact-cell-' : 'exact-zone-') + side.toLowerCase(),
            selectorPath: __cwBetNodePath(anchorNode),
            labelPath: labelNode ? __cwBetNodePath(labelNode) : '',
            zonePath: zoneNode ? __cwBetNodePath(zoneNode) : '',
            boardPath: __cwBetNodePath(boardNode),
            pointFamily: 'top'
        };
    }
    var __cwBetTargetHistory = [];
    var __cwBetTargetTraceSeq = 0;
    function __cwMakeBetTrace(side, tail) {
        var ts = '';
        try {
            ts = new Date().toISOString();
        } catch (_) {
            ts = '';
        }
        return {
            id: ++__cwBetTargetTraceSeq,
            ts: ts,
            side: String(side || ''),
            tail: String(tail || ''),
            roots: [],
            events: [],
            chosen: null
        };
    }
    function __cwPushBetTrace(trace, kind, data) {
        if (!trace)
            return;
        if (!trace.events)
            trace.events = [];
        var row = {
            kind: String(kind || '')
        };
        data = data || {};
        var keys = Object.keys(data);
        for (var i = 0; i < keys.length; i++)
            row[keys[i]] = data[keys[i]];
        trace.events.push(row);
        if (trace.events.length > 120)
            trace.events.splice(0, trace.events.length - 120);
    }
    function __cwStoreBetTrace(trace) {
        if (!trace)
            return;
        window.__cw_lastBetTargetTrace = trace;
        __cwBetTargetHistory.push(trace);
        if (__cwBetTargetHistory.length > 24)
            __cwBetTargetHistory.splice(0, __cwBetTargetHistory.length - 24);
    }
    function __cwGetLastBetTrace(side) {
        side = String(side || '');
        for (var i = __cwBetTargetHistory.length - 1; i >= 0; i--) {
            var row = __cwBetTargetHistory[i];
            if (!row)
                continue;
            if (!side || String(row.side || '') === side)
                return row;
        }
        return null;
    }
    function __cwGetBetTraceHistory(side, limit) {
        side = String(side || '');
        limit = Math.max(1, __cwNumber(limit, 6));
        var out = [];
        for (var i = __cwBetTargetHistory.length - 1; i >= 0 && out.length < limit; i--) {
            var row = __cwBetTargetHistory[i];
            if (!row)
                continue;
            if (!side || String(row.side || '') === side)
                out.push(row);
        }
        return out;
    }
    function __cwBetNodeSnapshot(node, rect) {
        if (!node)
            return null;
        rect = rect || rectFromNodeCompat(node) || rectFromNodeScreen(node) || null;
        var path = __cwBetNodePath(node);
        var out = {
            name: __cwBetNodeName(node),
            path: path,
            rect: __cwBetRectLite(rect),
            clickable: !!clickable(node),
            hasButton: !!hasBtn(node),
            hasToggle: !!hasTgl(node),
            touchListener: !!(node && node._touchListener)
        };
        var idx = path.toLowerCase().indexOf('/node_game(need_to_put_games_in_here)/');
        if (idx >= 0)
            out.shortPath = path.substring(idx + 1);
        return out;
    }
    function __cwIsBetNodeBlocked(node) {
        var name = __cwBetNodeName(node).toLowerCase();
        var path = __cwBetNodePath(node).toLowerCase();
        if (!name && !path)
            return true;
        if (name === 'screen_view' || path.indexOf('/screen_view') >= 0)
            return true;
        if (/^(btn_jp|btn_prev|btn_next|btn_soicau)$/i.test(name))
            return true;
        if (/\/btn_(jp|prev|next|soicau)(?:\/|$)/i.test(path))
            return true;
        if (/\/node_noti(?:\/|$)/i.test(path))
            return true;
        return false;
    }
    function __cwHasBetTouchSignal(node) {
        if (!node)
            return false;
        if (clickable(node))
            return true;
        try {
            if (getComp(node, cc.Button))
                return true;
        } catch (e) {}
        try {
            if (getComp(node, cc.Toggle))
                return true;
        } catch (e2) {}
        try {
            if (node._touchListener)
                return true;
        } catch (e3) {}
        return false;
    }
    function __cwScoreBetAnchorNode(node, rect, side) {
        if (!node || !__cwBetRectSane(rect))
            return -1e9;
        var name = __cwBetNodeName(node).toLowerCase();
        var path = __cwBetNodePath(node).toLowerCase();
        var want = String(side || '').toLowerCase();
        var score = 0;
        if (__cwIsBetNodeBlocked(node))
            score -= 260;
        if (want && (path.indexOf('/' + want + '_bet') >= 0 || path.indexOf('_bet_' + want) >= 0 || path.indexOf('bet_' + want) >= 0 || path.indexOf('_' + want + '_bet') >= 0))
            score += 240;
        if (want && path.indexOf('lbl_money_total_bet_' + want) >= 0)
            score += 40;
        if (want && (name + '|' + path).indexOf(want) >= 0)
            score += 36;
        if (/new button/.test(name))
            score += 78;
        if (__cwHasBetTouchSignal(node))
            score += 92;
        if (/board|bet|zone|slot|frame|mask|panel|cua|back|bg/.test(name + '|' + path))
            score += 24;
        var nr = __cwRectNorm(rect);
        var area = nr ? (nr.w * nr.h) : 0;
        if (area > 180000)
            score -= 90;
        else if (area > 90000)
            score -= 45;
        else if (area >= 900 && area <= 70000)
            score += 18;
        return score;
    }
    function __cwCollectBetAnchorCandidates(scope, side, opts) {
        opts = opts || {};
        var hits = [];
        var seen = 0;
        var maxNodes = Math.max(60, __cwNumber(opts.maxNodes, 240));
        var maxDepth = Math.max(1, __cwNumber(opts.maxDepth, 5));
        var minScore = __cwNumber(opts.minScore, 48);
        (function walk(n, depth) {
            if (!n || !active(n) || seen >= maxNodes || depth > maxDepth)
                return;
            seen++;
            var rect = rectFromNodeCompat(n) || rectFromNodeScreen(n) || null;
            var score = __cwScoreBetAnchorNode(n, rect, side);
            if (score >= minScore) {
                hits.push({
                    node: n,
                    rect: __cwRectNorm(rect),
                    score: score,
                    depth: depth
                });
            }
            var kids = n.children || [];
            for (var i = 0; i < kids.length; i++)
                walk(kids[i], depth + 1);
        })(scope, 0);
        hits.sort(function (a, b) {
            if ((b.score || 0) !== (a.score || 0))
                return (b.score || 0) - (a.score || 0);
            return __cwNumber((a.rect && a.rect.w || 0) * (a.rect && a.rect.h || 0), 0) - __cwNumber((b.rect && b.rect.w || 0) * (b.rect && b.rect.h || 0), 0);
        });
        return hits;
    }
    function __cwResolveBetAnchor(seedNode, side, trace, seedTag) {
        var scopes = [];
        var cur = seedNode;
        var depth = 0;
        while (cur && depth <= 4) {
            scopes.push({
                node: cur,
                depth: depth
            });
            cur = cur.parent || cur._parent || null;
            depth++;
        }
        var best = null;
        for (var i = 0; i < scopes.length; i++) {
            var scope = scopes[i];
            var candidates = __cwCollectBetAnchorCandidates(scope.node, side, {
                maxNodes: scope.depth <= 1 ? 180 : 260,
                maxDepth: scope.depth === 0 ? 3 : 5,
                minScore: scope.depth === 0 ? 60 : 48
            });
            __cwPushBetTrace(trace, 'anchor-scan', {
                seedTag: String(seedTag || ''),
                scopeDepth: scope.depth,
                scope: __cwBetNodeSnapshot(scope.node),
                top: candidates.slice(0, 3).map(function (it) {
                    return {
                        score: Math.round(__cwNumber(it.score, 0) * 10) / 10,
                        depth: it.depth,
                        node: __cwBetNodeSnapshot(it.node, it.rect)
                    };
                })
            });
            for (var j = 0; j < candidates.length && j < 6; j++) {
                var item = candidates[j];
                if (!item || !item.node)
                    continue;
                var total = __cwNumber(item.score, 0) - scope.depth * 8 - j;
                if (!best || total > __cwNumber(best.score, 0)) {
                    best = {
                        node: item.node,
                        rect: item.rect,
                        score: total,
                        scopeNode: scope.node,
                        scopeDepth: scope.depth,
                        tag: String(seedTag || 'anchor') + '-d' + scope.depth + '-h' + j
                    };
                }
            }
        }
        __cwPushBetTrace(trace, best ? 'anchor-picked' : 'anchor-miss', {
            seedTag: String(seedTag || ''),
            result: best ? {
                score: Math.round(__cwNumber(best.score, 0) * 10) / 10,
                scopeDepth: best.scopeDepth,
                tag: best.tag,
                node: __cwBetNodeSnapshot(best.node, best.rect)
            } : null
        });
        return best;
    }
    function __cwExplainBetCandidate(node, rect, sourceTag) {
        if (!node)
            return {
                ok: false,
                reason: 'node_null'
            };
        if (__cwIsBetNodeBlocked(node))
            return {
                ok: false,
                reason: 'blocked'
            };
        if (!__cwBetRectSane(rect))
            return {
                ok: false,
                reason: 'rect_not_sane'
            };
        var src = String(sourceTag || '');
        if (!src)
            return {
                ok: false,
                reason: 'source_empty'
            };
        var name = __cwBetNodeName(node).toLowerCase();
        var path = __cwBetNodePath(node).toLowerCase();
        var hasTouch = __cwHasBetTouchSignal(node);
        var semantic = /new button|board|bet|odd|even|tai|xiu|chan|le|zone|slot|frame|mask|cua/.test(name + '|' + path);
        if (src.indexOf('near-') === 0) {
            if (hasTouch)
                return {
                    ok: true,
                    reason: 'near_touch'
                };
            if (semantic)
                return {
                    ok: true,
                    reason: 'near_semantic'
                };
            return {
                ok: true,
                reason: 'near_rect'
            };
        }
        if (src.indexOf('tail-click-') === 0) {
            if (!hasTouch)
                return {
                    ok: false,
                    reason: 'tail_no_touch'
                };
            if (/new button/.test(name) || /board|bet|odd|even|tai|xiu|chan|le|zone|slot|frame|mask|cua/.test(path))
                return {
                    ok: true,
                    reason: 'tail_click'
                };
            return {
                ok: false,
                reason: 'tail_semantic_miss'
            };
        }
        if (src.indexOf('anchor-') === 0 || src.indexOf('find-side-fallback') === 0) {
            if (hasTouch && semantic)
                return {
                    ok: true,
                    reason: 'anchor_touch'
                };
            if (hasTouch)
                return {
                    ok: true,
                    reason: 'anchor_has_touch'
                };
            if (semantic)
                return {
                    ok: true,
                    reason: 'anchor_semantic'
                };
            return {
                ok: false,
                reason: 'anchor_semantic_miss'
            };
        }
        return {
            ok: false,
            reason: 'source_rejected'
        };
    }
    function __cwAcceptBetCandidate(node, rect, sourceTag) {
        return !!__cwExplainBetCandidate(node, rect, sourceTag).ok;
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
    function findBetTarget(side) {
        var WANT = normalizeSide(side);
        var tail = BET_TAILS[WANT];
        var trace = __cwMakeBetTrace(WANT, tail);
        __cwPushBetTrace(trace, 'start', {
            tail: String(tail || '')
        });
        var exact = __cwFindExactBetTarget(WANT, trace);
        if (exact && exact.node) {
            trace.chosen = {
                nodeName: String(exact.node.name || ''),
                path: __cwBetNodePath(exact.node),
                sourceTag: String(exact.sourceTag || ''),
                selectorPath: String(exact.selectorPath || ''),
                zonePath: String(exact.zonePath || ''),
                boardPath: String(exact.boardPath || ''),
                pointFamily: String(exact.pointFamily || ''),
                rect: __cwBetRectLite(exact.rect),
                boardRect: __cwBetRectLite(exact.boardRect),
                cellRect: __cwBetRectLite(exact.cellRect)
            };
            __cwStoreBetTrace(trace);
            return exact;
        }
        if (window.__cw_strictBetSelector !== false) {
            __cwStoreBetTrace(trace);
            return null;
        }
        if (tail) {
            var roots = findNodesByTail(tail);
            __cwPushBetTrace(trace, 'tail-roots', {
                count: roots.length
            });
            var best = null;
            function consider(node, rect, score, sourceTag) {
                var saneRect = rect || rectFromNodeCompat(node) || rectFromNodeScreen(node);
                var explain = __cwExplainBetCandidate(node, saneRect, sourceTag);
                __cwPushBetTrace(trace, 'consider', {
                    sourceTag: String(sourceTag || ''),
                    score: Math.round(__cwNumber(score, 0) * 10) / 10,
                    accept: !!explain.ok,
                    reason: String(explain.reason || ''),
                    node: __cwBetNodeSnapshot(node, saneRect)
                });
                if (!explain.ok)
                    return;
                var totalScore = __cwNumber(score, 0);
                if (!best || totalScore > __cwNumber(best.score, 0) || (Math.abs(totalScore - __cwNumber(best.score, 0)) < 0.5 && __cwNumber((saneRect && saneRect.w || 0) * (saneRect && saneRect.h || 0), 0) < __cwNumber(best.area, 0))) {
                    best = {
                        node: node,
                        rect: saneRect,
                        area: __cwNumber((saneRect && saneRect.w || 0) * (saneRect && saneRect.h || 0), 0),
                        score: totalScore,
                        sourceTag: String(sourceTag || '')
                    };
                }
            }
            for (var i = 0; i < roots.length; i++) {
                var root = roots[i];
                var rawRootRect = __cwPickBetRect(rectFromNodeScreen(root), rectFromNodeCompat(root));
                var rootRect = __cwBetRectSane(rawRootRect) ? rawRootRect : null;
                var boardRect = __cwFindBoardBackRect(root);
                var compactRect = __cwBuildBetInnerProbeRect(WANT, rawRootRect, boardRect);
                var rootInfo = __cwBetNodeSnapshot(root, rawRootRect) || {};
                rootInfo.rectSane = !!rootRect;
                rootInfo.compactRect = __cwBetRectLite(compactRect);
                rootInfo.boardRect = __cwBetRectLite(boardRect);
                trace.roots.push(rootInfo);
                var anchor = null;
                if (!rootRect)
                    anchor = __cwResolveBetAnchor(root, WANT, trace, 'tail-' + i);
                if (anchor && anchor.node)
                    consider(anchor.node, compactRect || anchor.rect, 120 + __cwNumber(anchor.score, 0), 'anchor-' + i + '-0');
                var focusRect = compactRect || rootRect || (anchor && anchor.rect) || null;
                if (!focusRect) {
                    __cwPushBetTrace(trace, 'focus-missing', {
                        rootIndex: i,
                        root: rootInfo
                    });
                    continue;
                }
                var cur = (anchor && anchor.scopeNode) || (root && (root.parent || root._parent || null));
                for (var d = 1; cur && d <= 4; d++) {
                    var nearHits = __cwCollectBetNearHits(cur, focusRect, {
                        maxNearNodes: d <= 2 ? 260 : 160,
                        preferClickable: true
                    });
                    __cwPushBetTrace(trace, 'near-scan', {
                        rootIndex: i,
                        depth: d,
                        focusRect: __cwBetRectLite(focusRect),
                        scope: __cwBetNodeSnapshot(cur),
                        top: nearHits.slice(0, 3).map(function (hit) {
                            return {
                                score: Math.round(__cwNumber(hit.score, 0) * 10) / 10,
                                area: Math.round(__cwNumber(hit.area, 0)),
                                node: __cwBetNodeSnapshot(hit.node, hit.rect)
                            };
                        })
                    });
                    for (var h = 0; h < nearHits.length && h < (d <= 2 ? 8 : 4); h++) {
                        var hit = nearHits[h];
                        if (!hit || !hit.node)
                            continue;
                        var boost = (d === 1 ? 160 : (d === 2 ? 60 : 12));
                        consider(hit.node, hit.rect || rectFromNodeCompat(hit.node) || rectFromNodeScreen(hit.node), __cwNumber(hit.score, 0) + boost, 'near-' + i + '-' + d + '-' + h);
                    }
                    cur = cur.parent || cur._parent || null;
                }
                var listBase = (anchor && anchor.scopeNode) || root;
                var list = listClickableTargets(listBase);
                __cwPushBetTrace(trace, 'tail-clickables', {
                    rootIndex: i,
                    scope: __cwBetNodeSnapshot(listBase),
                    top: list.slice(0, 4).map(function (item) {
                        return {
                            area: Math.round(__cwNumber(item.area, 0)),
                            node: __cwBetNodeSnapshot(item.node, item.rect)
                        };
                    })
                });
                for (var j = 0; j < list.length && j < 6; j++) {
                    var item = list[j];
                    if (!item || !item.node)
                        continue;
                    consider(item.node, item.rect || rectFromNodeCompat(item.node) || rectFromNodeScreen(item.node), 10 - j, 'tail-click-' + i + '-' + j);
                }
            }
            if (!best) {
                var sideNode = findSide(side);
                var sideBoardRect = sideNode ? __cwFindBoardBackRect(sideNode) : null;
                var sideCompactRect = __cwBuildBetInnerProbeRect(WANT, null, sideBoardRect);
                __cwPushBetTrace(trace, 'find-side', {
                    node: sideNode ? __cwBetNodeSnapshot(sideNode) : null,
                    boardRect: __cwBetRectLite(sideBoardRect),
                    compactRect: __cwBetRectLite(sideCompactRect)
                });
                if (sideNode) {
                    var sideRect = __cwPickBetRect(rectFromNodeScreen(sideNode), rectFromNodeCompat(sideNode));
                    var sideAnchor = __cwBetRectSane(sideRect) ? {
                        node: sideNode,
                        rect: sideCompactRect || sideRect,
                        score: 48,
                        scopeNode: sideNode.parent || sideNode._parent || null,
                        tag: 'find-side-direct'
                    } : __cwResolveBetAnchor(sideNode, WANT, trace, 'find-side');
                    if (sideAnchor && sideAnchor.node)
                        consider(sideAnchor.node, sideCompactRect || sideAnchor.rect, 44 + __cwNumber(sideAnchor.score, 0), 'find-side-fallback');
                }
            }
            trace.chosen = best && best.node ? {
                nodeName: String(best.node.name || ''),
                path: __cwBetNodePath(best.node),
                sourceTag: String(best.sourceTag || ''),
                selectorPath: String(best.selectorPath || ''),
                boardPath: String(best.boardPath || ''),
                pointFamily: String(best.pointFamily || ''),
                score: Math.round(__cwNumber(best.score, 0) * 10) / 10,
                rect: __cwBetRectLite(best.rect),
                boardRect: __cwBetRectLite(best.boardRect),
                cellRect: __cwBetRectLite(best.cellRect)
            } : null;
            __cwStoreBetTrace(trace);
            if (best && best.node)
                return best;
        }
        __cwStoreBetTrace(trace);
        return null;
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
        if (!tgt || !tgt.node)
            return false;
        var node = tgt.node;
        var rect = tgt.rect || rectFromNodeCompat(node);
        var ok = false;
        if (emitBtnToggle(node))
            ok = true;
        if (rect) {
            if (emitTouchAtRect(node, rect))
                ok = true;
            if (clickCanvasXY(rect.sx + rect.sw / 2, rect.sy + rect.sh / 2, true))
                ok = true;
        }
        if (!ok && clickable(node))
            ok = emitClick(node) || ok;
        return ok;
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
            if (nodeInGame(n)) {
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
    function findDescendantByName(root, wanted, limit) {
        if (!root || !wanted)
            return null;
        var q = [root],
        seen = [],
        n = 0,
        max = Math.max(32, limit || 220);
        while (q.length && n < max) {
            var cur = q.shift();
            if (!cur || seen.indexOf(cur) !== -1)
                continue;
            seen.push(cur);
            n++;
            if (String(cur.name || '') === wanted)
                return cur;
            var kids = cur.children || cur._children || [];
            for (var i = 0; i < kids.length; i++)
                q.push(kids[i]);
        }
        return null;
    }
    function chipNameByAmount(amount) {
        var tail = CHIP_TAILS && CHIP_TAILS[String(amount)] ? String(CHIP_TAILS[String(amount)]) : '';
        var m = tail.match(/lbl_chip_value(\d+)/i);
        if (!m)
            return '';
        return 'chip' + parseInt(m[1], 10);
    }
    function findChipNodeFromLabel(labelNode, amountHint) {
        if (!labelNode)
            return null;
        var wants = [];
        function pushWant(name) {
            name = String(name || '');
            if (!name)
                return;
            for (var i = 0; i < wants.length; i++) {
                if (wants[i] === name)
                    return;
            }
            wants.push(name);
        }
        pushWant(chipNameByAmount(amountHint));
        var nm = String(labelNode.name || '');
        var m = nm.match(/lbl_chip_value(\d+)/i);
        if (m)
            pushWant('chip' + parseInt(m[1], 10));
        var path = String(fullPath(labelNode, 220) || '');
        var all = path.match(/\/chip(\d+)(?:\/|$)/ig) || [];
        for (var ai = 0; ai < all.length; ai++) {
            var mm = String(all[ai] || '').match(/chip(\d+)/i);
            if (mm)
                pushWant('chip' + parseInt(mm[1], 10));
        }
        if (!wants.length)
            return null;
        for (var wi = 0; wi < wants.length; wi++) {
            var exact = wants[wi];
            var cur0 = labelNode;
            var d0 = 0;
            while (cur0 && d0 <= 8) {
                if (String(cur0.name || '') === exact)
                    return cur0;
                cur0 = cur0.parent || cur0._parent || null;
                d0++;
            }
        }
        var scopes = [];
        var p = labelNode.parent || labelNode._parent || null;
        if (p)
            scopes.push(p);
        if (p && (p.parent || p._parent))
            scopes.push(p.parent || p._parent);
        if (p && (p.parent || p._parent) && ((p.parent || p._parent).parent || (p.parent || p._parent)._parent))
            scopes.push((p.parent || p._parent).parent || (p.parent || p._parent)._parent);
        for (var wi2 = 0; wi2 < wants.length; wi2++) {
            var exact2 = wants[wi2];
            for (var s = 0; s < scopes.length; s++) {
                var scope = scopes[s];
                if (!scope)
                    continue;
                var kids = scope.children || scope._children || [];
                for (var i = 0; i < kids.length; i++) {
                    if (kids[i] && String(kids[i].name || '') === exact2)
                        return kids[i];
                }
                var deep = findDescendantByName(scope, exact2, 260);
                if (deep)
                    return deep;
            }
        }
        return null;
    }
    function resolveChipNode(n, amountHint) {
        if (!n)
            return null;
        var nm = String(n.name || '');
        if (/^chip\d+$/i.test(nm))
            return n;
        if (nm.indexOf('lbl_chip_value') !== -1) {
            var c = findChipNodeFromLabel(n, amountHint);
            if (c)
                return c;
        }
        var path = String(fullPath(n, 220) || '');
        var m = path.match(/\/chip(\d+)(?:\/|$)/i);
        if (m) {
            var c2 = findDescendantByName(cc.director.getScene(), 'chip' + parseInt(m[1], 10), 2000);
            if (c2)
                return c2;
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
    function scanChipsByTail() {
        var out = {};
        var keys = Object.keys(CHIP_TAILS || {});
        for (var i = 0; i < keys.length; i++) {
            var val = keys[i];
            var tail = CHIP_TAILS[val];
            var labelNode = findNodeByTail(tail);
            if (!labelNode)
                continue;
            var hit = clickableOf(labelNode, 10);
            var chip = findChipNodeFromLabel(labelNode, +val);
            var target = chip || labelNode;
            out[val] = {
                entry: target,
                node: target,
                rect: rectFromNodeScreen(target) || rectFromNodeScreen(labelNode),
                labelNode: labelNode,
                chipNode: chip,
                hitNode: hit,
                clickableNode: chip ? clickableOf(chip, 6) : hit
            };
        }
        return out;
    }
    function scanChipCatalogRaw() {
        var best = {};
        walkNodes(function (n) {
            if (!n || !active(n) || !nodeInGame(n))
                return;
            var lb = getComp(n, cc.Label);
            var rt = getComp(n, cc.RichText);
            var txt = '';
            if (lb && typeof lb.string !== 'undefined')
                txt = String(lb.string == null ? '' : lb.string);
            else if (rt && typeof rt.string !== 'undefined')
                txt = String(rt.string == null ? '' : rt.string);
            if (!txt)
                return;
            var amount = parseAmountLoose(txt);
            if (!amount)
                return;
            var path = String(fullPath(n, 160) || '');
            var pathL = path.toLowerCase();
            var name = String(n.name || '');
            var nameL = name.toLowerCase();
            var chipNode = findChipNodeFromLabel(n, amount);
            var expectedChip = chipNameByAmount(amount);
            var score = 0;
            if (/lbl_chip_value\d+/i.test(name))
                score += 100;
            if (/chip_panel|chip_mask|bet_panel\/chips|\/chips\//i.test(pathL))
                score += 30;
            if (/chip|coin|phinh|menh|choose|chon/i.test(pathL))
                score += 12;
            if (txt && NORM(txt).indexOf(String(amount)) !== -1)
                score += 8;
            if (/^lbl_/i.test(name))
                score += 4;
            if (chipNode)
                score += 80;
            if (chipNode && expectedChip && String(chipNode.name || '') === expectedChip)
                score += 40;
            var rect = rectFromNodeScreen(n);
            var clickableNode = chipNode ? clickableOf(chipNode, 6) : clickableOf(n, 6);
            var cur = best[String(amount)];
            if (!cur || score > cur.score) {
                best[String(amount)] = {
                    amount: amount,
                    score: score,
                    node: chipNode || n,
                    labelNode: n,
                    chipNode: chipNode,
                    clickableNode: clickableNode,
                    text: txt,
                    path: path,
                    rect: rect
                };
            }
        });
        var out = {};
        for (var k in best) {
            var it = best[k];
            out[k] = {
                entry: it.node,
                node: it.node,
                labelNode: it.labelNode,
                chipNode: it.chipNode,
                clickableNode: it.clickableNode,
                text: it.text,
                path: it.path,
                rect: it.rect,
                score: it.score
            };
        }
        return out;
    }
    function scanChipLabelsVerbose() {
        var rows = [];
        walkNodes(function (n) {
            if (!n || !active(n) || !nodeInGame(n))
                return;
            var lb = getComp(n, cc.Label);
            var rt = getComp(n, cc.RichText);
            var txt = '';
            if (lb && typeof lb.string !== 'undefined')
                txt = String(lb.string == null ? '' : lb.string);
            else if (rt && typeof rt.string !== 'undefined')
                txt = String(rt.string == null ? '' : rt.string);
            var nm = String(n.name || '');
            var path = String(fullPath(n, 180) || '');
            var pathL = path.toLowerCase();
            var amount = parseAmountLoose(txt);
            var isChipByName = /lbl_chip_value\d+/i.test(nm);
            var isChipByPath = /chip_panel|chip_mask|bet_panel\/chips|\/chips\//i.test(pathL);
            var isChipByText = amount != null;
            if (!(isChipByName || (isChipByPath && isChipByText)))
                return;
            var rect = rectFromNodeScreen(n);
            var chipNode = findChipNodeFromLabel(n);
            var clickNode = clickableOf(n, 6);
            var parent = n.parent || n._parent || null;
            var siblingNames = [];
            if (parent) {
                var kids = parent.children || parent._children || [];
                for (var i = 0; i < kids.length; i++) {
                    if (!kids[i])
                        continue;
                    siblingNames.push(String(kids[i].name || ''));
                    if (siblingNames.length >= 12)
                        break;
                }
            }
            rows.push({
                name: nm,
                text: txt,
                amount: amount,
                path: path,
                rect: [Math.round(rect.x || 0), Math.round(rect.y || 0), Math.round(rect.w || 0), Math.round(rect.h || 0)].join(','),
                parent: parent ? String(parent.name || '') : '',
                chipNode: chipNode ? String(chipNode.name || '') : '',
                clickableNode: clickNode ? String(clickNode.name || '') : '',
                siblings: siblingNames.join('|')
            });
        });
        rows.sort(function (a, b) {
            if ((a.amount || 0) !== (b.amount || 0))
                return (a.amount || 0) - (b.amount || 0);
            return String(a.name || '').localeCompare(String(b.name || ''));
        });
        return rows;
    }
    function buildChipMapFromVerbose(rows) {
        var best = {};
        rows = rows || [];
        for (var i = 0; i < rows.length; i++) {
            var r = rows[i];
            var amount = Math.max(0, Math.floor(+r.amount || 0));
            if (!amount)
                continue;
            var score = 0;
            if (/lbl_chip_value\d+/i.test(r.name || ''))
                score += 100;
            if (r.chipNode)
                score += 20;
            if (r.clickableNode && r.clickableNode !== r.name)
                score += 8;
            if (r.rect && r.rect !== '0,0,1,1')
                score += 5;
            var cur = best[String(amount)];
            if (!cur || score > cur.score)
                best[String(amount)] = {
                    amount: amount,
                    score: score,
                    labelName: r.name || '',
                    text: r.text || '',
                    path: r.path || '',
                    chipNodeName: r.chipNode || '',
                    clickableNodeName: r.clickableNode || '',
                    parent: r.parent || '',
                    siblings: r.siblings || '',
                    rect: r.rect || ''
                };
        }
        return best;
    }

    var prevScan = window.cwScanChips;
    window.cwScanChips = function () {
        var m = scanChipsByTail();
        if (m && Object.keys(m).length)
            return m;
        m = prevScan ? (prevScan() || {}) : {};
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
            throw new Error('M?nh gi  kh?ng h?p l?: ' + amount);
        var map = window.cwScanChips() || {};
        if (!map[String(val)]) {
            await tryOpenChipPanel();
            await sleep(180);
            map = scanChipsByTail();
            if (!Object.keys(map).length)
                map = wideScan();
        }
        if (!map[String(val)]) {
            var hit = null;
            (function walk(n) {
                if (hit || !active(n))
                    return;
                if (nodeInGame(n)) {
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
                }
                var kids = n.children || [];
                for (var k = 0; k < kids.length; k++)
                    walk(kids[k]);
            })(cc.director.getScene());
            if (hit) {
                var target = resolveChipNode(hit) || hit;
                var touched = emitTouchOnNode(target);
                if (!touched) {
                    if (clickable(target))
                        emitClick(target);
                    else
                        clickRectCenter(rectFromNodeScreen(target));
                }
                await sleep(140);
                var t = getComp(target, cc.Toggle);
                if (t && !t.isChecked) {
                    t.isChecked = true;
                    if (t._emitToggleEvents)
                        t._emitToggleEvents();
                }
                return true;
            }
            return false;
        }
        var info = map[String(val)];
        if (!info || !info.node)
            return false;
        var target2 = resolveChipNode(info.node) || info.node;
        var touched2 = emitTouchOnNode(target2);
        if (!touched2) {
            if (clickable(target2))
                emitClick(target2);
            else if (info.rect)
                clickRectCenter(info.rect);
            else
                clickRectCenter(rectFromNodeScreen(target2));
        }
        await sleep(140);
        var tg = getComp(target2, cc.Toggle);
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
            var tgt0 = findBetTarget(side);
            if (!tgt0 || !tgt0.node) {
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
            if (!tgt || !tgt.node) {
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

    function __cwTestFindToggleHost(node, depth) {
        var cur = node,
        d = 0;
        depth = depth == null ? 6 : depth;
        while (cur && d <= depth) {
            var tg = getComp(cur, cc.Toggle);
            if (tg)
                return {
                    node: cur,
                    toggle: tg
                };
            cur = cur.parent || cur._parent || null;
            d++;
        }
        return null;
    }
    function __cwTestChipSelected(map) {
        var keys = Object.keys(map || {}).sort(function (a, b) {
            return (+a) - (+b);
        });
        var anyToggle = false;
        for (var i = 0; i < keys.length; i++) {
            var info = map[keys[i]];
            if (!info || !info.node)
                continue;
            var target = info.chipNode || resolveChipNode(info.node) || info.node;
            var host = __cwTestFindToggleHost(target, 6);
            if (!host || !host.toggle)
                continue;
            anyToggle = true;
            if (host.toggle.isChecked)
                return {
                    value: +keys[i],
                    anyToggle: true,
                    node: host.node
                };
        }
        return {
            value: null,
            anyToggle: anyToggle,
            node: null
        };
    }
    function __cwNodeProbeLine(node, tag) {
        if (!node)
            return null;
        var rect = rectFromNodeScreen(node) || rectFromNodeCompat(node) || null;
        var btn = null,
        tgl = null,
        tl = false;
        try {
            btn = getComp(node, cc.Button);
        } catch (e) {}
        try {
            tgl = getComp(node, cc.Toggle);
        } catch (e2) {}
        try {
            tl = !!node._touchListener;
        } catch (e3) {}
        return {
            tag: String(tag || ''),
            name: String(node.name || ''),
            path: String(fullPath(node, 160) || ''),
            active: node.active === false ? 0 : 1,
            clickable: clickable(node) ? 1 : 0,
            hasButton: btn ? 1 : 0,
            hasToggle: tgl ? 1 : 0,
            interactable: btn ? (btn.interactable !== false ? 1 : 0) : (tgl ? (tgl.interactable !== false ? 1 : 0) : ''),
            checked: tgl ? (!!tgl.isChecked ? 1 : 0) : '',
            touchListener: tl ? 1 : 0,
            children: (node.children || node._children || []).length || 0,
            rect: rect ? [Math.round(__cwNumber(rect.sx, rect.x)), Math.round(__cwNumber(rect.sy, rect.y)), Math.round(Math.max(__cwNumber(rect.sw, rect.w), 0)), Math.round(Math.max(__cwNumber(rect.sh, rect.h), 0))].join(',') : '',
            scale: [Math.round(__cwNumber(node.scaleX, __cwNumber(node.scale && node.scale.x, 1)) * 100) / 100, Math.round(__cwNumber(node.scaleY, __cwNumber(node.scale && node.scale.y, 1)) * 100) / 100].join(','),
            opacity: Math.round(__cwNumber(node.opacity, __cwNumber(node._opacity, 0))),
            color: (function () {
                try {
                    var c = node.color || node._color || null;
                    return c ? [c.r || 0, c.g || 0, c.b || 0].join(',') : '';
                } catch (e4) {
                    return '';
                }
            })()
        };
    }
    function __cwCollectChipProbeCandidates(info, opts) {
        opts = opts || {};
        var scope = String(opts.candidateScope || 'core').toLowerCase();
        var includeSiblings = scope === 'deep' || opts.deepCandidates === true;
        var includeChildren = scope !== 'core' || opts.includeChildren === true;
        var out = [];
        var seen = [];
        function push(node, tag) {
            if (!node || seen.indexOf(node) !== -1)
                return;
            seen.push(node);
            out.push({
                node: node,
                row: __cwNodeProbeLine(node, tag)
            });
        }
        if (!info || !info.node)
            return out;
        var labelNode = info.labelNode || null;
        var chipNode = info.chipNode || resolveChipNode(info.node) || info.node;
        var clickNode = info.clickableNode || clickableOf(chipNode, 6) || chipNode;
        push(labelNode, 'label');
        push(chipNode, 'chip');
        push(clickNode, 'clickable');
        var cur = chipNode,
        depth = 0;
        while (cur && depth <= 6) {
            push(cur, depth === 0 ? 'chip-self' : ('ancestor-' + depth));
            if (includeChildren) {
                var kids = cur.children || cur._children || [];
                for (var i = 0; i < kids.length && i < 16; i++) {
                    var kid = kids[i];
                    var nm = String(kid && kid.name || '');
                    if (!kid)
                        continue;
                    if (clickable(kid) || /hit|mask|panel|btn|button|touch|select|effect|fx|glow|light|active/i.test(nm))
                        push(kid, 'child-' + depth + '-' + i);
                }
            }
            var parent = cur.parent || cur._parent || null;
            if (includeSiblings && parent) {
                var sibs = parent.children || parent._children || [];
                for (var j = 0; j < sibs.length && j < 24; j++) {
                    var sib = sibs[j];
                    var snm = String(sib && sib.name || '');
                    if (!sib || sib === cur)
                        continue;
                    if (clickable(sib) || /hit|mask|panel|btn|button|touch|select|effect|fx|glow|light|active/i.test(snm))
                        push(sib, 'sibling-' + depth + '-' + j);
                }
            }
            cur = parent;
            depth++;
        }
        return out;
    }
    async function __cwProbeCandidateAction(amount, map, item, opts) {
        opts = opts || {};
        if (!item || !item.node)
            return null;
        var node = item.node;
        var rect = rectFromNodeScreen(node) || rectFromNodeCompat(node) || null;
        var beforeSel = __cwTestChipSelected(map);
        var beforeDigest = (__cwGetChipStateDigest() || {})[String(amount)] || '';
        var touched = false,
        emitted = false,
        rectClicked = false;
        try {
            touched = emitTouchOnNode(node);
        } catch (e) {}
        if (!touched) {
            try {
                emitted = emitClick(node);
            } catch (e2) {}
        }
        if (!touched && !emitted && rect) {
            try {
                rectClicked = clickRectCenter(rect);
            } catch (e3) {}
        }
        if (opts.mark !== false && rect)
            showFocus(rect);
        await sleep(opts.delayMs || 130);
        var afterSel = __cwTestChipSelected(map);
        var afterDigest = (__cwGetChipStateDigest() || {})[String(amount)] || '';
        return {
            tag: item.row && item.row.tag || '',
            name: item.row && item.row.name || '',
            touchOk: !!touched,
            emitOk: !!emitted,
            rectOk: !!rectClicked,
            selectionBefore: beforeSel,
            selectionAfter: afterSel,
            digestChanged: beforeDigest !== afterDigest
        };
    }
    function __cwCandidateLiteRows(candidates) {
        candidates = candidates || [];
        var rows = [];
        for (var i = 0; i < candidates.length; i++) {
            var r = candidates[i] && candidates[i].row ? candidates[i].row : null;
            if (!r)
                continue;
            rows.push({
                idx: i,
                tag: r.tag,
                name: r.name,
                clickable: r.clickable,
                hasButton: r.hasButton,
                hasToggle: r.hasToggle,
                touchListener: r.touchListener,
                interactable: r.interactable,
                rect: r.rect
            });
        }
        return rows;
    }
    function __cwFindCandidateForManualTest(candidates, key) {
        if (!candidates || !candidates.length)
            return null;
        if (typeof key === 'number' && isFinite(key)) {
            var idx = Math.max(0, Math.floor(key));
            return candidates[idx] || null;
        }
        var s = String(key == null ? '' : key).trim().toLowerCase();
        if (!s)
            return candidates[0] || null;
        for (var i = 0; i < candidates.length; i++) {
            var row = candidates[i] && candidates[i].row ? candidates[i].row : null;
            if (!row)
                continue;
            if (String(row.tag || '').toLowerCase() === s)
                return candidates[i];
        }
        for (var j = 0; j < candidates.length; j++) {
            var row2 = candidates[j] && candidates[j].row ? candidates[j].row : null;
            if (!row2)
                continue;
            var hay = (String(row2.tag || '') + '|' + String(row2.name || '')).toLowerCase();
            if (hay.indexOf(s) !== -1)
                return candidates[j];
        }
        return null;
    }
    function __cwSideTotalKey(side) {
        side = normalizeSide(side);
        if (side === 'CHAN')
            return 'C';
        if (side === 'LE')
            return 'L';
        if (side === 'TAI')
            return 'T';
        if (side === 'XIU')
            return 'X';
        return '';
    }
    function __cwRectNorm(rect) {
        if (!rect)
            return null;
        var x = __cwNumber(rect.sx, rect.x);
        var y = __cwNumber(rect.sy, rect.y);
        var w = Math.max(1, __cwNumber(rect.sw, rect.w));
        var h = Math.max(1, __cwNumber(rect.sh, rect.h));
        return {
            x: x,
            y: y,
            w: w,
            h: h,
            cx: x + w / 2,
            cy: y + h / 2,
            left: x,
            top: y,
            right: x + w,
            bottom: y + h
        };
    }
    function __cwRectContainsPt(rect, x, y, pad) {
        rect = __cwRectNorm(rect);
        if (!rect)
            return false;
        pad = Math.max(0, __cwNumber(pad, 0));
        return x >= rect.left - pad && x <= rect.right + pad && y >= rect.top - pad && y <= rect.bottom + pad;
    }
    function __cwRectDistToPt(rect, x, y) {
        rect = __cwRectNorm(rect);
        if (!rect)
            return 1e9;
        var dx = 0;
        if (x < rect.left)
            dx = rect.left - x;
        else if (x > rect.right)
            dx = x - rect.right;
        var dy = 0;
        if (y < rect.top)
            dy = rect.top - y;
        else if (y > rect.bottom)
            dy = y - rect.bottom;
        return Math.sqrt(dx * dx + dy * dy);
    }
    function __cwBuildBetProbePoints(rect, opts) {
        opts = opts || {};
        var pts = [];
        if (!rect)
            return pts;
        var nr = __cwRectNorm(rect);
        var cx = nr.cx;
        var cy = nr.cy;
        var w = Math.max(nr.w, __cwNumber(opts.minProbeW, 140));
        var h = Math.max(nr.h, __cwNumber(opts.minProbeH, 88));
        var dx1 = Math.max(8, w * 0.16);
        var dx2 = Math.max(16, w * 0.30);
        var dx3 = Math.max(24, w * 0.42);
        var dy1 = Math.max(6, h * 0.16);
        var dy2 = Math.max(12, h * 0.30);
        var dy3 = Math.max(18, h * 0.42);
        __cwPushPoint(pts, cx, cy, 'center');
        __cwPushPoint(pts, cx - dx1, cy, 'left-1');
        __cwPushPoint(pts, cx + dx1, cy, 'right-1');
        __cwPushPoint(pts, cx, cy - dy1, 'upper-1');
        __cwPushPoint(pts, cx, cy + dy1, 'lower-1');
        __cwPushPoint(pts, cx - dx2, cy, 'left-2');
        __cwPushPoint(pts, cx + dx2, cy, 'right-2');
        __cwPushPoint(pts, cx, cy - dy2, 'upper-2');
        __cwPushPoint(pts, cx, cy + dy2, 'lower-2');
        __cwPushPoint(pts, cx - dx1, cy - dy1, 'ul-1');
        __cwPushPoint(pts, cx + dx1, cy - dy1, 'ur-1');
        __cwPushPoint(pts, cx - dx1, cy + dy1, 'll-1');
        __cwPushPoint(pts, cx + dx1, cy + dy1, 'lr-1');
        __cwPushPoint(pts, cx - dx3, cy, 'left-3');
        __cwPushPoint(pts, cx + dx3, cy, 'right-3');
        __cwPushPoint(pts, cx, cy - dy3, 'upper-3');
        __cwPushPoint(pts, cx, cy + dy3, 'lower-3');
        __cwPushPoint(pts, cx - dx2, cy - dy2, 'ul-2');
        __cwPushPoint(pts, cx + dx2, cy - dy2, 'ur-2');
        __cwPushPoint(pts, cx - dx2, cy + dy2, 'll-2');
        __cwPushPoint(pts, cx + dx2, cy + dy2, 'lr-2');
        return pts;
    }
    function __cwCollectBetProbeCandidates(side, opts) {
        opts = opts || {};
        side = normalizeSide(side);
        var out = [];
        var seen = [];
        function push(node, tag) {
            if (!node || seen.indexOf(node) !== -1)
                return;
            seen.push(node);
            out.push({
                node: node,
                row: __cwNodeProbeLine(node, tag)
            });
        }
        function scanNear(anchor, focusRect, tag, maxHits) {
            var hits = __cwCollectBetNearHits(anchor, focusRect, {
                maxNearNodes: opts.maxNearNodes,
                preferClickable: true
            });
            for (var i = 0; i < hits.length && i < Math.max(1, maxHits || 6); i++)
                push(hits[i].node, tag + '-' + i);
        }
        var roots = [];
        var tail = BET_TAILS[side];
        if (tail)
            roots = findNodesByTail(tail) || [];
        for (var i = 0; i < roots.length; i++) {
            var root = roots[i];
            var rootRect = rectFromNodeScreen(root) || rectFromNodeCompat(root) || null;
            push(root, 'tail-root-' + i);
            var list = listClickableTargets(root) || [];
            for (var j = 0; j < list.length && j < (opts.maxClickablePerRoot || 8); j++) {
                if (list[j] && list[j].node)
                    push(list[j].node, 'tail-click-' + i + '-' + j);
            }
            var cur = root.parent || root._parent || null;
            for (var d = 1; cur && d <= (opts.maxAncestors || 4); d++) {
                push(cur, 'ancestor-' + d);
                if (rootRect)
                    scanNear(cur, rootRect, 'near-' + i + '-' + d, d <= 2 ? 8 : 4);
                if (opts.candidateScope === 'deep') {
                    var list2 = listClickableTargets(cur) || [];
                    for (var k = 0; k < list2.length && k < 4; k++) {
                        if (list2[k] && list2[k].node)
                            push(list2[k].node, 'ancestor-click-' + d + '-' + k);
                    }
                }
                cur = cur.parent || cur._parent || null;
            }
        }
        var tgt = findBetTarget(side);
        if (tgt && tgt.node)
            push(tgt.node, 'findBetTarget');
        var sideNode = findSide(side);
        if (sideNode)
            push(sideNode, 'findSide');
        return out;
    }
    async function __cwProbeBetCandidateAction(side, item, opts) {
        opts = opts || {};
        if (!item || !item.node)
            return null;
        side = normalizeSide(side);
        var totalKey = __cwSideTotalKey(side);
        if (opts.amount) {
            try {
                window.__cw_focusChipForHost && window.__cw_focusChipForHost(opts.amount);
            } catch (e) {}
            await sleep(opts.focusDelayMs || 140);
        }
        var rect = rectFromNodeCompat(item.node) || rectFromNodeScreen(item.node) || null;
        var pts = __cwBuildBetProbePoints(rect, opts);
        var before = sampleTotalsNow(true);
        var baseVal = totalKey ? __cwNumber(before[totalKey], 0) : 0;
        var rows = [];
        for (var i = 0; i < pts.length && i < (opts.maxPoints || 9); i++) {
            var pt = pts[i];
            var tiny = {
                sx: pt.x - 1,
                sy: pt.y - 1,
                sw: 2,
                sh: 2,
                x: pt.x - 1,
                y: pt.y - 1,
                w: 2,
                h: 2
            };
            if (opts.mark !== false)
                showFocus(tiny);
            var touchOk = false,
            canvasOk = false;
            try {
                touchOk = emitTouchAtRect(item.node, tiny);
            } catch (e2) {}
            try {
                canvasOk = clickCanvasXY(pt.x, pt.y, true);
            } catch (e3) {}
            await sleep(opts.delayMs || 120);
            var after = sampleTotalsNow(true);
            var curVal = totalKey ? __cwNumber(after[totalKey], 0) : 0;
            var delta = curVal - baseVal;
            rows.push({
                idx: i,
                tag: pt.tag,
                x: Math.round(pt.x * 10) / 10,
                y: Math.round(pt.y * 10) / 10,
                touchOk: !!touchOk,
                canvasOk: !!canvasOk,
                delta: delta,
                changed: delta > 0.5
            });
            if (delta > 0.5)
                break;
        }
        return {
            side: side,
            candidate: item.row,
            points: rows,
            totalsBefore: before,
            totalsAfter: sampleTotalsNow(true)
        };
    }
    function __cwTestChipRows(map) {
        var keys = Object.keys(map || {}).sort(function (a, b) {
            return (+a) - (+b);
        });
        var rows = [];
        for (var i = 0; i < keys.length; i++) {
            var val = +keys[i];
            var info = map[keys[i]];
            if (!info || !info.node)
                continue;
            var target = info.chipNode || resolveChipNode(info.node) || info.node;
            var host = __cwTestFindToggleHost(target, 6);
            rows.push({
                amount: val,
                node: target && target.name || '?',
                label: info.labelNode && info.labelNode.name || '',
                chipNode: info.chipNode && info.chipNode.name || '',
                hitNode: info.hitNode && info.hitNode.name || '',
                clickableNode: info.clickableNode && info.clickableNode.name || '',
                text: info.text || '',
                score: info.score || 0,
                checked: !!(host && host.toggle && host.toggle.isChecked),
                hasToggle: !!(host && host.toggle),
                rect: (info.rect ? [Math.round(info.rect.x), Math.round(info.rect.y), Math.round(info.rect.w), Math.round(info.rect.h)].join(',') : '')
            });
        }
        return rows;
    }
    async function __cwTestEnsureChipMap() {
        var map = scanChipCatalogRaw();
        if (!Object.keys(map).length)
            map = window.cwScanChips ? (window.cwScanChips() || {}) : {};
        if (!Object.keys(map).length) {
            await tryOpenChipPanel();
            await sleep(180);
            map = scanChipCatalogRaw();
            if (!Object.keys(map).length)
                map = window.cwScanChips ? (window.cwScanChips() || {}) : {};
        }
        return map;
    }
    async function __cwTestFocusChipOnce(amount, opts) {
        opts = opts || {};
        var val = Math.max(0, Math.floor(+amount || 0));
        var map = opts.map || await __cwTestEnsureChipMap();
        var info = map[String(val)];
        if (!info || !info.node) {
            console.warn('[cwTestFocus] chip not found', val);
            return {
                ok: false,
                reason: 'chip_not_found',
                amount: val,
                rows: __cwTestChipRows(map)
            };
        }
        var target = resolveChipNode(info.node) || info.node;
        var clickTarget = info.clickableNode || clickableOf(target, 6) || target;
        var labelRect = info.rect || rectFromNodeScreen(info.labelNode || info.node) || null;
        var targetRect = rectFromNodeScreen(target) || labelRect || null;
        var before = __cwTestChipSelected(map);
        var steps = [];
        async function runStep(name, fn) {
            var actionOk = false;
            try {
                actionOk = !!fn();
            } catch (e) {
                actionOk = false;
            }
            if (opts.mark !== false)
                showFocus(targetRect || labelRect || null);
            await sleep(opts.delayMs || 150);
            var after = __cwTestChipSelected(map);
            var row = {
                step: name,
                actionOk: actionOk,
                selected: after.value,
                verified: !!(after.anyToggle && after.value === val)
            };
            steps.push(row);
            return row;
        }

        if (labelRect) {
            var s0 = await runStep('clickLabelRect', function () {
                    return clickRectCenter(labelRect);
                });
            if (s0.verified)
                return {
                    ok: true,
                    amount: val,
                    selectedBefore: before.value,
                    selectedAfter: __cwTestChipSelected(map).value,
                    steps: steps,
                    rows: __cwTestChipRows(map)
                };
        }

        var s1 = await runStep('emitTouchOnLabel', function () {
                return emitTouchOnNode(info.labelNode || target);
            });
        if (s1.verified)
            return {
                ok: true,
                amount: val,
                selectedBefore: before.value,
                selectedAfter: __cwTestChipSelected(map).value,
                steps: steps,
                rows: __cwTestChipRows(map)
            };

        var s2 = await runStep('emitClickClickable', function () {
                return clickable(clickTarget) ? emitClick(clickTarget) : false;
            });
        if (s2.verified)
            return {
                ok: true,
                amount: val,
                selectedBefore: before.value,
                selectedAfter: __cwTestChipSelected(map).value,
                steps: steps,
                rows: __cwTestChipRows(map)
            };

        if (targetRect) {
            var s3 = await runStep('clickTargetRect', function () {
                    return clickRectCenter(targetRect);
                });
            if (s3.verified)
                return {
                    ok: true,
                    amount: val,
                    selectedBefore: before.value,
                    selectedAfter: __cwTestChipSelected(map).value,
                    steps: steps,
                    rows: __cwTestChipRows(map)
                };
        }

        if (opts.forceToggle === true) {
            var host = __cwTestFindToggleHost(target, 6);
            if (host && host.toggle) {
                await runStep('forceToggle', function () {
                    host.toggle.isChecked = true;
                    if (host.toggle._emitToggleEvents)
                        host.toggle._emitToggleEvents();
                    return true;
                });
            }
        }
        return {
            ok: false,
            amount: val,
            selectedBefore: before.value,
            selectedAfter: __cwTestChipSelected(map).value,
            steps: steps,
            rows: __cwTestChipRows(map)
        };
    }
    async function __cwTestBetFlow(side, amount, opts) {
        opts = opts || {};
        side = normalizeSide(side);
        var X = Math.max(0, Math.floor(+amount || 0));
        X = X - (X % 1000);
        if (!X)
            throw new Error('amount=0');
        var tgt = findBetTarget(side);
        if (!tgt || !tgt.node)
            throw new Error('bet target not found: ' + side);

        var map = await __cwTestEnsureChipMap();
        var availSet = {};
        var mk = Object.keys(map);
        for (var i = 0; i < mk.length; i++)
            availSet[mk[i]] = 1;

        var res = makePlan(X, availSet);
        if (!res.plan.length || res.rest > 0) {
            return {
                ok: false,
                side: side,
                amount: X,
                rest: res.rest,
                plan: res.plan,
                rows: __cwTestChipRows(map)
            };
        }

        var out = [];
        var betRect = tgt.rect || rectFromNodeScreen(tgt.node);
        for (var p = 0; p < res.plan.length; p++) {
            var step = res.plan[p];
            for (var c = 0; c < step.count; c++) {
                var focusRes = await __cwTestFocusChipOnce(step.val, {
                        map: map,
                        mark: opts.mark,
                        delayMs: opts.focusDelayMs || 150,
                        forceToggle: opts.forceToggle === true
                    });
                if (opts.mark !== false)
                    showFocus(betRect || null);
                var before = sampleTotalsNow(true);
                var clickOk = clickBetTarget(tgt);
                await sleep(opts.clickDelayMs || 120);
                var changed = await waitForTotalsChange(before, side, opts.waitMs || 1600);
                var after = sampleTotalsNow(true);
                out.push({
                    denom: step.val,
                    turn: c + 1,
                    focusOk: !!focusRes.ok,
                    selectedAfterFocus: focusRes.selectedAfter,
                    clickOk: !!clickOk,
                    changed: !!changed,
                    before: JSON.stringify(before),
                    after: JSON.stringify(after)
                });
                if (opts.stopOnMiss !== false && (!focusRes.ok || !clickOk || !changed))
                    break;
            }
            if (opts.stopOnMiss !== false) {
                var last = out[out.length - 1];
                if (last && (!last.focusOk || !last.clickOk || !last.changed))
                    break;
            }
        }
        var okAll = out.length > 0 && out.every(function (x) {
            return x.focusOk && x.clickOk && x.changed;
        });
        try {
            console.table(out);
        } catch (e) {
            console.log(out);
        }
        return {
            ok: okAll,
            side: side,
            amount: X,
            plan: res.plan,
            rows: out,
            chips: __cwTestChipRows(map)
        };
    }

    window.cwDumpChipFocus = async function () {
        var map = await __cwTestEnsureChipMap();
        var rows = __cwTestChipRows(map);
        try {
            console.table(rows);
        } catch (e) {
            console.log(rows);
        }
        return rows;
    };
    window.cwScanChipCatalogRaw = function () {
        var map = scanChipCatalogRaw();
        var rows = __cwTestChipRows(map);
        try {
            console.table(rows);
        } catch (e) {
            console.log(rows);
        }
        return map;
    };
    window.cwDumpChipLabelsRaw = function () {
        var rows = scanChipLabelsVerbose();
        try {
            console.table(rows);
        } catch (e) {
            console.log(rows);
        }
        return rows;
    };
    window.cwBuildChipMapRaw = function () {
        var rows = scanChipLabelsVerbose();
        var map = buildChipMapFromVerbose(rows);
        try {
            console.table(Object.keys(map).sort(function (a, b) {
                    return (+a) - (+b);
                }).map(function (k) {
                    var it = map[k];
                    return {
                        amount: +k,
                        labelName: it.labelName,
                        text: it.text,
                        chipNodeName: it.chipNodeName,
                        clickableNodeName: it.clickableNodeName,
                        parent: it.parent,
                        rect: it.rect,
                        score: it.score
                    };
                }));
        } catch (e) {
            console.log(map);
        }
        return map;
    };
    window.cwTestFocusChip = async function (amount, opts) {
        var res = await __cwTestFocusChipOnce(amount, opts || {});
        try {
            console.table(res.steps || []);
            console.table(res.rows || []);
        } catch (e) {
            console.log(res);
        }
        return res;
    };
    window.cwProbeChipFocus = async function (amount, opts) {
        opts = opts || {};
        var val = Math.max(0, Math.floor(+amount || 0));
        var map = await __cwTestEnsureChipMap();
        var info = map[String(val)] || null;
        var target = info ? (info.chipNode || resolveChipNode(info.node) || info.node) : null;
        var host = target ? __cwTestFindToggleHost(target, 6) : null;
        var beforeSel = __cwTestChipSelected(map);
        var beforeDigestAll = __cwGetChipStateDigest();
        var beforeDigest = beforeDigestAll[String(val)] || '';
        var tf = __cwEstimateUiTransform();
        var pitch = __cwEstimateChipPitch(map, tf);
        var focusPlan = info ? __cwBuildChipFocusPoints(info, tf, pitch) : {
            nodeName: '',
            raw: null,
            size: null,
            points: []
        };
        var candidates = info ? __cwCollectChipProbeCandidates(info, opts) : [];
        var rows = __cwTestChipRows(map);
        var jsTest = null;
        if (opts.runJsTest !== false && info) {
            jsTest = await __cwTestFocusChipOnce(val, {
                map: map,
                mark: opts.mark,
                delayMs: opts.delayMs || 150,
                forceToggle: opts.forceToggle === true
            });
        }
        var afterSel = __cwTestChipSelected(map);
        var afterDigestAll = __cwGetChipStateDigest();
        var afterDigest = afterDigestAll[String(val)] || '';
        var candidateTests = [];
        if (opts.runCandidates === true && candidates.length) {
            for (var ci = 0; ci < candidates.length && ci < (opts.maxCandidates || 18); ci++) {
                var t = await __cwProbeCandidateAction(val, map, candidates[ci], opts);
                if (t)
                    candidateTests.push(t);
            }
        }
        var out = {
            ok: !!info,
            amount: val,
            info: info ? {
                node: String(info.node && info.node.name || ''),
                chipNode: String(info.chipNode && info.chipNode.name || ''),
                labelNode: String(info.labelNode && info.labelNode.name || ''),
                clickableNode: String(info.clickableNode && info.clickableNode.name || ''),
                text: String(info.text || ''),
                score: __cwNumber(info.score, 0),
                rect: info.rect || null
            } : null,
            toggleHost: host ? {
                node: String(host.node && host.node.name || ''),
                isChecked: !!(host.toggle && host.toggle.isChecked)
            } : null,
            selectionBefore: beforeSel,
            selectionAfter: afterSel,
            digestChanged: beforeDigest !== afterDigest,
            digestBefore: beforeDigest,
            digestAfter: afterDigest,
            transform: {
                ok: !!tf.ok,
                chipPitch: pitch,
                anchors: tf.anchors || []
            },
            focusPlan: focusPlan,
            candidates: candidates.map(function (x) {
                    return x.row;
                }),
            candidateLite: __cwCandidateLiteRows(candidates),
            candidateTests: candidateTests,
            jsTest: jsTest,
            rows: rows
        };
        try {
            console.log('[cwProbeChipFocus]', out);
            if (jsTest && jsTest.steps)
                console.table(jsTest.steps);
            if (out.candidateLite && out.candidateLite.length)
                console.table(out.candidateLite);
            if (candidateTests && candidateTests.length)
                console.table(candidateTests);
            if (rows && rows.length)
                console.table(rows);
        } catch (e) {}
        return out;
    };
    window.cwListChipCandidates = async function (amount, opts) {
        opts = opts || {};
        var val = Math.max(0, Math.floor(+amount || 0));
        var map = await __cwTestEnsureChipMap();
        var info = map[String(val)] || null;
        var candidates = info ? __cwCollectChipProbeCandidates(info, opts) : [];
        var rows = __cwCandidateLiteRows(candidates);
        try {
            console.table(rows);
        } catch (e) {
            console.log(rows);
        }
        return rows;
    };
    window.cwTestChipCandidate = async function (amount, key, opts) {
        opts = opts || {};
        var val = Math.max(0, Math.floor(+amount || 0));
        var map = await __cwTestEnsureChipMap();
        var info = map[String(val)] || null;
        if (!info)
            return {
                ok: false,
                reason: 'chip_not_found',
                amount: val
            };
        var candidates = __cwCollectChipProbeCandidates(info, opts);
        var item = __cwFindCandidateForManualTest(candidates, key);
        if (!item)
            return {
                ok: false,
                reason: 'candidate_not_found',
                amount: val,
                key: key,
                candidates: __cwCandidateLiteRows(candidates)
            };
        var res = await __cwProbeCandidateAction(val, map, item, opts);
        var out = {
            ok: !!res,
            amount: val,
            key: key,
            candidate: item.row,
            result: res,
            selectionAfter: __cwTestChipSelected(map),
            digestAfter: (__cwGetChipStateDigest() || {})[String(val)] || ''
        };
        try {
            console.log('[cwTestChipCandidate]', out);
        } catch (e) {}
        return out;
    };
    window.cwListBetCandidates = function (side, opts) {
        opts = opts || {};
        var items = __cwCollectBetProbeCandidates(side, opts);
        var rows = __cwCandidateLiteRows(items);
        try {
            console.table(rows);
        } catch (e) {
            console.log(rows);
        }
        return rows;
    };
    window.cwTestBetCandidate = async function (side, key, opts) {
        opts = opts || {};
        var items = __cwCollectBetProbeCandidates(side, opts);
        var item = __cwFindCandidateForManualTest(items, key);
        if (!item) {
            return {
                ok: false,
                reason: 'candidate_not_found',
                side: normalizeSide(side),
                key: key,
                candidates: __cwCandidateLiteRows(items)
            };
        }
        var res = await __cwProbeBetCandidateAction(side, item, opts);
        var out = {
            ok: !!res,
            side: normalizeSide(side),
            key: key,
            result: res,
            candidates: __cwCandidateLiteRows(items)
        };
        try {
            if (res && res.points)
                console.table(res.points);
            console.log('[cwTestBetCandidate]', out);
        } catch (e) {}
        return out;
    };
    window.cwTestBetFlow = async function (side, amount, opts) {
        return await __cwTestBetFlow(side, amount, opts || {});
    };

    function __cwNumber(v, dft) {
        v = Number(v);
        return isFinite(v) ? v : (dft || 0);
    }
    function __cwRectCenterTop(r) {
        if (!r)
            return null;
        var x = __cwNumber(r.sx, r.x) + __cwNumber(r.sw, r.w) / 2;
        var y = __cwNumber(r.sy, r.y) + __cwNumber(r.sh, r.h) / 2;
        return __cwToTopClientPoint(x, y);
    }
    function __cwFrameOffset() {
        var ox = 0,
        oy = 0;
        try {
            var w = window,
            guard = 0;
            while (w && w !== w.top && guard < 8) {
                var fe = w.frameElement;
                if (!fe || !fe.getBoundingClientRect)
                    break;
                var br = fe.getBoundingClientRect();
                ox += __cwNumber(br.left, 0);
                oy += __cwNumber(br.top, 0);
                w = w.parent;
                guard++;
            }
        } catch (e) {}
        return {
            x: ox,
            y: oy
        };
    }
    function __cwToTopClientPoint(x, y) {
        var off = __cwFrameOffset();
        return {
            x: __cwNumber(x, 0) + off.x,
            y: __cwNumber(y, 0) + off.y
        };
    }
    function __cwCanvasToTopClientPoint(x, y, flipY) {
        x = __cwNumber(x, NaN);
        y = __cwNumber(y, NaN);
        if (!isFinite(x) || !isFinite(y))
            return null;
        var c = null;
        try {
            c = document.querySelector('canvas');
        } catch (e) {}
        if (!c || !c.getBoundingClientRect)
            return __cwToTopClientPoint(x, y);
        var br = null;
        try {
            br = c.getBoundingClientRect();
        } catch (e2) {}
        if (!br)
            return __cwToTopClientPoint(x, y);
        var scaleX = (c.width ? (br.width / c.width) : 1);
        var scaleY = (c.height ? (br.height / c.height) : 1);
        if (!isFinite(scaleX) || scaleX <= 0)
            scaleX = 1;
        if (!isFinite(scaleY) || scaleY <= 0)
            scaleY = 1;
        var yy = y;
        if (flipY && c.height)
            yy = c.height - y;
        var off = __cwFrameOffset();
        return {
            x: off.x + __cwNumber(br.left, 0) + x * scaleX,
            y: off.y + __cwNumber(br.top, 0) + yy * scaleY
        };
    }
    function __cwPushPoint(list, x, y, tag) {
        x = __cwNumber(x, NaN);
        y = __cwNumber(y, NaN);
        if (!isFinite(x) || !isFinite(y))
            return;
        var k = Math.round(x) + ',' + Math.round(y);
        for (var i = 0; i < list.length; i++) {
            var old = list[i];
            var ok = Math.round(__cwNumber(old.x, 0)) + ',' + Math.round(__cwNumber(old.y, 0));
            if (ok === k)
                return;
        }
        list.push({
            x: Math.round(x * 10) / 10,
            y: Math.round(y * 10) / 10,
            tag: String(tag || '')
        });
    }
    function __cwNodeRawPos(n) {
        var x = 0,
        y = 0,
        cur = n,
        depth = 0;
        while (cur && depth < 40) {
            try {
                var p = cur._lpos || cur._pos || cur.position || null;
                if (p) {
                    x += __cwNumber(p.x, 0);
                    y += __cwNumber(p.y, 0);
                }
            } catch (e) {}
            cur = cur.parent || cur._parent || null;
            depth++;
        }
        return {
            x: x,
            y: y
        };
    }
    function __cwNodeSize(n) {
        var cs = null;
        try {
            if (n && n.getContentSize)
                cs = n.getContentSize();
        } catch (e) {}
        if ((!cs || (!cs.width && !cs.height)) && cc.UITransform && n && n.getComponent) {
            try {
                var ut = n.getComponent(cc.UITransform);
                if (ut && ut.contentSize)
                    cs = ut.contentSize;
            } catch (e2) {}
        }
        if ((!cs || (!cs.width && !cs.height)) && n && n._contentSize)
            cs = n._contentSize;
        return {
            w: Math.max(1, __cwNumber(cs && cs.width, 1)),
            h: Math.max(1, __cwNumber(cs && cs.height, 1))
        };
    }
    function __cwFitLinear(pairs, rawKey, screenKey) {
        var n = 0,
        sx = 0,
        sy = 0,
        sxx = 0,
        sxy = 0;
        for (var i = 0; i < pairs.length; i++) {
            var p = pairs[i];
            var rx = __cwNumber(p.raw && p.raw[rawKey], NaN);
            var syi = __cwNumber(p.screen && p.screen[screenKey], NaN);
            if (!isFinite(rx) || !isFinite(syi))
                continue;
            n++;
            sx += rx;
            sy += syi;
            sxx += rx * rx;
            sxy += rx * syi;
        }
        if (n < 2)
            return {
                ok: false,
                a: 1,
                b: 0,
                count: n
            };
        var den = n * sxx - sx * sx;
        if (Math.abs(den) < 1e-6)
            return {
                ok: false,
                a: 1,
                b: 0,
                count: n
            };
        var a = (n * sxy - sx * sy) / den;
        var b = (sy - a * sx) / n;
        return {
            ok: isFinite(a) && isFinite(b),
            a: a,
            b: b,
            count: n
        };
    }
    function __cwEstimateUiTransform() {
        var sides = ['TAI', 'XIU', 'CHAN', 'LE'];
        var pairs = [];
        for (var i = 0; i < sides.length; i++) {
            var tgt = findBetTarget(sides[i]);
            if (!tgt || !tgt.node)
                continue;
            var rect = tgt.rect || rectFromNodeCompat(tgt.node);
            var screen = __cwRectCenterTop(rect);
            if (!screen)
                continue;
            var raw = __cwNodeRawPos(tgt.node);
            pairs.push({
                side: sides[i],
                raw: raw,
                screen: screen
            });
        }
        var fx = __cwFitLinear(pairs, 'x', 'x');
        var fy = __cwFitLinear(pairs, 'y', 'y');
        return {
            ok: !!(fx.ok && fy.ok),
            fx: fx,
            fy: fy,
            anchors: pairs
        };
    }
    function __cwApplyUiTransform(raw, tf) {
        if (!raw || !tf || !tf.ok)
            return null;
        return {
            x: tf.fx.a * __cwNumber(raw.x, 0) + tf.fx.b,
            y: tf.fy.a * __cwNumber(raw.y, 0) + tf.fy.b
        };
    }
    function __cwEstimateChipPitch(map, tf) {
        var xs = [];
        var keys = Object.keys(map || {});
        for (var i = 0; i < keys.length; i++) {
            var info = map[keys[i]];
            if (!info || !info.node)
                continue;
            var target = info.chipNode || resolveChipNode(info.node, +keys[i]) || info.node;
            var raw = __cwNodeRawPos(target);
            var est = __cwApplyUiTransform(raw, tf);
            if (!est)
                continue;
            xs.push(est.x);
        }
        xs.sort(function (a, b) {
            return a - b;
        });
        var diffs = [];
        for (var j = 1; j < xs.length; j++) {
            var d = Math.abs(xs[j] - xs[j - 1]);
            if (d >= 18 && d <= 220)
                diffs.push(d);
        }
        diffs.sort(function (a, b) {
            return a - b;
        });
        if (!diffs.length)
            return 96;
        return Math.max(56, Math.min(140, diffs[Math.floor(diffs.length / 2)]));
    }
    function __cwCompatBetFamily(side) {
        side = normalizeSide(side);
        if (side === 'CHAN' || side === 'LE')
            return 'canvas-flip';
        if (side === 'TAI' || side === 'XIU')
            return 'canvas';
        return 'canvas-flip';
    }
    function __cwIsPassiveBetTarget(node) {
        if (!node)
            return false;
        var name = String(node.name || '').toLowerCase();
        var path = __cwBetNodePath(node).toLowerCase();
        if (/^lbl_money_total_bet_/.test(name))
            return true;
        if (/\/lbl_money_total_bet_(tai|xiu|chan|le)(?:\/|$)/.test(path))
            return true;
        return !__cwHasBetTouchSignal(node);
    }
    function __cwBuildBetTargetPoints(tgt, side) {
        var pts = [];
        if (!tgt || !tgt.node)
            return pts;
        var rect = tgt.rect || rectFromNodeCompat(tgt.node) || rectFromNodeScreen(tgt.node);
        if (!rect)
            return pts;
        var src = String(tgt && tgt.sourceTag || '');
        var preferProbeCompat = src.indexOf('find-side-fallback') === 0 || src.indexOf('anchor-') === 0 || src.indexOf('tail-click-') === 0;
        var probePts = __cwBuildBetProbePoints(rect, {
            minProbeW: tgt && tgt.sourceTag && tgt.sourceTag.indexOf('near-') === 0 ? 160 : 140,
            minProbeH: tgt && tgt.sourceTag && tgt.sourceTag.indexOf('near-') === 0 ? 96 : 88
        });
        var maxPts = preferProbeCompat ? 8 : 17;
        var compatFamily = __cwCompatBetFamily(side);
        var preferDirectTop = preferProbeCompat && __cwIsPassiveBetTarget(tgt.node);
        for (var i = 0; i < probePts.length && i < maxPts; i++) {
            var p = probePts[i];
            if (preferProbeCompat) {
                if (preferDirectTop) {
                    var td = __cwToTopClientPoint(p.x, p.y);
                    __cwPushPoint(pts, td.x, td.y, 'label-top-' + p.tag);
                } else if (compatFamily === 'canvas-flip') {
                    var cf = __cwCanvasToTopClientPoint(p.x, p.y, true);
                    if (cf)
                        __cwPushPoint(pts, cf.x, cf.y, 'canvas-flip-' + p.tag);
                } else {
                    var cn = __cwCanvasToTopClientPoint(p.x, p.y, false);
                    if (cn)
                        __cwPushPoint(pts, cn.x, cn.y, 'canvas-' + p.tag);
                }
                continue;
            }
            var c = __cwToTopClientPoint(p.x, p.y);
            __cwPushPoint(pts, c.x, c.y, 'top-' + p.tag);
        }
        return pts;
    }
    function __cwNodeMiniSig(n) {
        if (!n)
            return '';
        var sf = '',
        op = '',
        col = '',
        pos = '',
        btn = '',
        tg = '';
        try {
            var sp = getComp(n, cc.Sprite);
            if (sp && sp.spriteFrame)
                sf = String(sp.spriteFrame.name || '');
        } catch (e) {}
        try {
            op = String(__cwNumber(n.opacity, __cwNumber(n._opacity, 0)));
        } catch (e2) {}
        try {
            var c = n.color || n._color || null;
            if (c)
                col = [c.r || 0, c.g || 0, c.b || 0].join(',');
        } catch (e3) {}
        try {
            var p = n._lpos || n._pos || n.position || null;
            if (p)
                pos = [Math.round(__cwNumber(p.x, 0) * 10) / 10, Math.round(__cwNumber(p.y, 0) * 10) / 10].join(',');
        } catch (e4) {}
        try {
            var b = getComp(n, cc.Button);
            if (b)
                btn = String(b.interactable !== false ? 1 : 0);
        } catch (e5) {}
        try {
            var t = getComp(n, cc.Toggle);
            if (t)
                tg = String(t.isChecked ? 1 : 0);
        } catch (e6) {}
        return [
            String(n.name || ''),
            n.active === false ? 0 : 1,
            Math.round(__cwNumber(n.scaleX, __cwNumber(n.scale && n.scale.x, 1)) * 100) / 100,
            Math.round(__cwNumber(n.scaleY, __cwNumber(n.scale && n.scale.y, 1)) * 100) / 100,
            op,
            col,
            pos,
            btn,
            tg,
            sf
        ].join(':');
    }
    function __cwWalkDigest(parts, root, depth, maxDepth, maxNodes) {
        var seen = [];
        (function walk(n, d) {
            if (!n || d > maxDepth || parts.length >= maxNodes || seen.indexOf(n) !== -1)
                return;
            seen.push(n);
            parts.push(__cwNodeMiniSig(n));
            var kids = n.children || n._children || [];
            for (var i = 0; i < kids.length && i < 10; i++)
                walk(kids[i], d + 1);
        })(root, depth || 0);
    }
    function __cwCollectEffectDigest(parts, root, label, maxRoots, maxDepth, maxNodes) {
        if (!root)
            return;
        var seen = [];
        var effectRx = /effect|fx|glow|light|select|selected|active|check|mark|ring|highlight|shadow|frame|border|shine/i;
        var roots = root.children || root._children || [];
        for (var i = 0; i < roots.length && i < maxRoots && parts.length < maxNodes; i++) {
            (function walk(n, d) {
                if (!n || d > maxDepth || parts.length >= maxNodes || seen.indexOf(n) !== -1)
                    return;
                seen.push(n);
                var nm = String(n.name || '');
                var hit = effectRx.test(nm);
                if (!hit) {
                    try {
                        var sp = getComp(n, cc.Sprite);
                        var sf = sp && sp.spriteFrame ? String(sp.spriteFrame.name || '') : '';
                        hit = effectRx.test(sf);
                    } catch (e) {}
                }
                if (hit)
                    parts.push(label + '>' + __cwNodeMiniSig(n));
                var kids = n.children || n._children || [];
                for (var j = 0; j < kids.length && j < 12; j++)
                    walk(kids[j], d + 1);
            })(roots[i], 0);
        }
    }
    function __cwChipDigestNode(root) {
        if (!root)
            return '';
        var parts = [];
        __cwWalkDigest(parts, root, 0, 2, 24);
        var p1 = root.parent || root._parent || null;
        if (p1) {
            parts.push('P1>' + __cwNodeMiniSig(p1));
            var kids1 = p1.children || p1._children || [];
            for (var i = 0; i < kids1.length && i < 18; i++) {
                var k1 = kids1[i];
                if (!k1)
                    continue;
                parts.push('S1>' + __cwNodeMiniSig(k1));
                var nm1 = String(k1.name || '');
                if (k1 === root || /^chip\d+$/i.test(nm1))
                    __cwWalkDigest(parts, k1, 1, 1, 64);
            }
            __cwCollectEffectDigest(parts, p1, 'FX1', 18, 2, 96);
        }
        var p2 = p1 ? (p1.parent || p1._parent || null) : null;
        if (p2) {
            parts.push('P2>' + __cwNodeMiniSig(p2));
            var kids2 = p2.children || p2._children || [];
            for (var j = 0; j < kids2.length && j < 14; j++) {
                var k2 = kids2[j];
                if (!k2)
                    continue;
                var nm2 = String(k2.name || '');
                if (k2 === p1 || /chip|mask|panel|respawn/i.test(nm2))
                    parts.push('S2>' + __cwNodeMiniSig(k2));
            }
            __cwCollectEffectDigest(parts, p2, 'FX2', 14, 2, 128);
        }
        return parts.join('|');
    }
    function __cwGetChipStateDigest() {
        var map = scanChipCatalogRaw();
        if (!Object.keys(map).length)
            map = window.cwScanChips ? (window.cwScanChips() || {}) : {};
        var out = {};
        var keys = Object.keys(map);
        for (var i = 0; i < keys.length; i++) {
            var k = keys[i];
            var info = map[k];
            if (!info || !info.node)
                continue;
            var target = info.chipNode || resolveChipNode(info.node) || info.node;
            out[k] = __cwChipDigestNode(target);
        }
        return out;
    }
    function __cwBuildChipFocusPoints(info, tf, pitch) {
        var pts = [];
        if (!info || !info.node)
            return {
                nodeName: '',
                raw: null,
                size: null,
                points: pts
            };
        var target = info.chipNode || resolveChipNode(info.node) || info.node;
        var raw = __cwNodeRawPos(target);
        var size = __cwNodeSize(target);
        var byRect = info.rect || rectFromNodeScreen(target);
        if (byRect) {
            var rc = __cwRectCenterTop(byRect);
            var rw = Math.max(0, __cwNumber(byRect.w, 0));
            var rh = Math.max(0, __cwNumber(byRect.h, 0));
            if (rc && rw > 6 && rh > 6)
                __cwPushPoint(pts, rc.x, rc.y, 'rect-center');
        }
        var est = __cwApplyUiTransform(raw, tf);
        if (est) {
            var base = Math.max(56, __cwNumber(pitch, 96));
            var dx1 = Math.max(10, base * 0.18);
            var dx2 = Math.max(18, base * 0.34);
            var dx3 = Math.max(26, base * 0.50);
            var dx4 = Math.max(34, base * 0.66);
            var dx5 = Math.max(42, base * 0.82);
            var dy1 = Math.max(8, base * 0.14);
            var dy2 = Math.max(14, base * 0.24);
            var dy3 = Math.max(20, base * 0.34);
            var dy4 = Math.max(26, base * 0.44);
            __cwPushPoint(pts, est.x, est.y, 'fit-center');
            __cwPushPoint(pts, est.x - dx1, est.y, 'fit-left-1');
            __cwPushPoint(pts, est.x + dx1, est.y, 'fit-right-1');
            __cwPushPoint(pts, est.x - dx2, est.y, 'fit-left-2');
            __cwPushPoint(pts, est.x + dx2, est.y, 'fit-right-2');
            __cwPushPoint(pts, est.x - dx3, est.y, 'fit-left-3');
            __cwPushPoint(pts, est.x + dx3, est.y, 'fit-right-3');
            __cwPushPoint(pts, est.x - dx4, est.y, 'fit-left-4');
            __cwPushPoint(pts, est.x + dx4, est.y, 'fit-right-4');
            __cwPushPoint(pts, est.x - dx5, est.y, 'fit-left-5');
            __cwPushPoint(pts, est.x + dx5, est.y, 'fit-right-5');
            __cwPushPoint(pts, est.x, est.y - dy1, 'fit-upper-1');
            __cwPushPoint(pts, est.x, est.y + dy1, 'fit-lower-1');
            __cwPushPoint(pts, est.x, est.y - dy2, 'fit-upper-2');
            __cwPushPoint(pts, est.x, est.y + dy2, 'fit-lower-2');
            __cwPushPoint(pts, est.x, est.y - dy3, 'fit-upper-3');
            __cwPushPoint(pts, est.x, est.y + dy3, 'fit-lower-3');
            __cwPushPoint(pts, est.x, est.y - dy4, 'fit-upper-4');
            __cwPushPoint(pts, est.x, est.y + dy4, 'fit-lower-4');
            __cwPushPoint(pts, est.x - dx1, est.y - dy1, 'fit-ul-1');
            __cwPushPoint(pts, est.x + dx1, est.y - dy1, 'fit-ur-1');
            __cwPushPoint(pts, est.x - dx1, est.y + dy1, 'fit-ll-1');
            __cwPushPoint(pts, est.x + dx1, est.y + dy1, 'fit-lr-1');
            __cwPushPoint(pts, est.x - dx2, est.y - dy1, 'fit-ul-2');
            __cwPushPoint(pts, est.x + dx2, est.y - dy1, 'fit-ur-2');
            __cwPushPoint(pts, est.x - dx2, est.y + dy1, 'fit-ll-2');
            __cwPushPoint(pts, est.x + dx2, est.y + dy1, 'fit-lr-2');
            __cwPushPoint(pts, est.x - dx3, est.y - dy2, 'fit-ul-3');
            __cwPushPoint(pts, est.x + dx3, est.y - dy2, 'fit-ur-3');
            __cwPushPoint(pts, est.x - dx3, est.y + dy2, 'fit-ll-3');
            __cwPushPoint(pts, est.x + dx3, est.y + dy2, 'fit-lr-3');
            __cwPushPoint(pts, est.x - dx4, est.y - dy2, 'fit-ul-4');
            __cwPushPoint(pts, est.x + dx4, est.y - dy2, 'fit-ur-4');
            __cwPushPoint(pts, est.x - dx4, est.y + dy2, 'fit-ll-4');
            __cwPushPoint(pts, est.x + dx4, est.y + dy2, 'fit-lr-4');
            __cwPushPoint(pts, est.x + dx4, est.y - dy1, 'fit-right-bias-u1');
            __cwPushPoint(pts, est.x + dx4, est.y + dy1, 'fit-right-bias-l1');
            __cwPushPoint(pts, est.x + dx5, est.y - dy2, 'fit-right-bias-u2');
            __cwPushPoint(pts, est.x + dx5, est.y + dy2, 'fit-right-bias-l2');
            __cwPushPoint(pts, est.x - dx4, est.y - dy1, 'fit-left-bias-u1');
            __cwPushPoint(pts, est.x - dx4, est.y + dy1, 'fit-left-bias-l1');
            __cwPushPoint(pts, est.x - dx5, est.y - dy2, 'fit-left-bias-u2');
            __cwPushPoint(pts, est.x - dx5, est.y + dy2, 'fit-left-bias-l2');
        }
        return {
            nodeName: String(target && target.name || ''),
            raw: {
                x: Math.round(__cwNumber(raw.x, 0) * 10) / 10,
                y: Math.round(__cwNumber(raw.y, 0) * 10) / 10
            },
            size: {
                w: Math.round(__cwNumber(size.w, 0) * 10) / 10,
                h: Math.round(__cwNumber(size.h, 0) * 10) / 10
            },
            points: pts
        };
    }
    function __cwBuildCdpBetPlan(side, amount) {
        side = normalizeSide(side);
        var rawAmt = Math.max(0, Math.floor(+amount || 0));
        var X = rawAmt - (rawAmt % 1000);
        if (!side || !X)
            return {
                ok: false,
                error: 'invalid_input',
                side: side,
                amount: rawAmt
            };
        var tgt = findBetTarget(side);
        if (!tgt || !tgt.node)
            return {
                ok: false,
                error: 'bet_target_not_found',
                side: side,
                amount: X
            };
        var map = scanChipCatalogRaw();
        if (!Object.keys(map).length)
            map = window.cwScanChips ? (window.cwScanChips() || {}) : {};
        var availSet = {};
        var ks = Object.keys(map);
        for (var i = 0; i < ks.length; i++)
            availSet[ks[i]] = 1;
        var mk = makePlan(X, availSet);
        if (!mk.plan.length || mk.rest > 0)
            return {
                ok: false,
                error: 'plan_unavailable',
                side: side,
                amount: X,
                rest: mk.rest
            };
        var tf = __cwEstimateUiTransform();
        var chipPitch = __cwEstimateChipPitch(map, tf);
        var steps = [];
        for (var p = 0; p < mk.plan.length; p++) {
            var step = mk.plan[p];
            var info = map[String(step.val)];
            if (!info || !info.node)
                return {
                    ok: false,
                    error: 'chip_not_found:' + step.val,
                    side: side,
                    amount: X
                };
            var chipPlan = __cwBuildChipFocusPoints(info, tf, chipPitch);
            steps.push({
                denom: step.val,
                count: step.count,
                nodeName: chipPlan.nodeName,
                raw: chipPlan.raw,
                size: chipPlan.size,
                points: chipPlan.points
            });
        }
        return {
            ok: true,
            side: side,
            amount: X,
            transformOk: !!tf.ok,
            chipPitch: chipPitch,
            anchors: tf.anchors || [],
            betTarget: {
                nodeName: String(tgt.node && tgt.node.name || ''),
                sourceTag: String(tgt.sourceTag || ''),
                selectorPath: String(tgt.selectorPath || ''),
                labelPath: String(tgt.labelPath || ''),
                zonePath: String(tgt.zonePath || ''),
                boardPath: String(tgt.boardPath || ''),
                pointFamily: String(tgt.pointFamily || 'top'),
                points: __cwBuildBetTargetPoints(tgt, side)
            },
            steps: steps
        };
    }
    window.__cw_getChipStateDigest = function () {
        return __cwGetChipStateDigest();
    };
    window.__cw_focusChipForHost = function (amount) {
        var val = Math.max(0, Math.floor(+amount || 0));
        var map = scanChipCatalogRaw();
        if (!Object.keys(map).length)
            map = window.cwScanChips ? (window.cwScanChips() || {}) : {};
        var info = map[String(val)] || null;
        if (!info || !info.node) {
            return {
                ok: false,
                amount: val,
                error: 'chip_not_found'
            };
        }
        var target = info.chipNode || resolveChipNode(info.node) || info.node;
        var rect = rectFromNodeScreen(target) || rectFromNodeCompat(target) || info.rect || null;
        var touchOk = false,
        emitOk = false,
        rectOk = false;
        try {
            touchOk = emitTouchOnNode(target);
        } catch (e) {}
        if (!touchOk) {
            try {
                emitOk = emitClick(target);
            } catch (e2) {}
        }
        if (!touchOk && !emitOk && rect) {
            try {
                rectOk = clickRectCenter(rect);
            } catch (e3) {}
        }
        return {
            ok: !!(touchOk || emitOk || rectOk),
            amount: val,
            nodeName: String(target && target.name || ''),
            labelName: String(info.labelNode && info.labelNode.name || ''),
            touchOk: !!touchOk,
            emitOk: !!emitOk,
            rectOk: !!rectOk,
            rect: rect ? {
                x: Math.round(__cwNumber(rect.sx, rect.x)),
                y: Math.round(__cwNumber(rect.sy, rect.y)),
                w: Math.round(Math.max(__cwNumber(rect.sw, rect.w), 0)),
                h: Math.round(Math.max(__cwNumber(rect.sh, rect.h), 0))
            } : null
        };
    };
    window.__cw_getChipSelectionForHost = function () {
        var map = scanChipCatalogRaw();
        if (!Object.keys(map).length)
            map = window.cwScanChips ? (window.cwScanChips() || {}) : {};
        var sel = __cwTestChipSelected(map);
        return {
            value: sel && sel.value != null ? +sel.value : null,
            anyToggle: !!(sel && sel.anyToggle),
            nodeName: sel && sel.node ? String(sel.node.name || '') : ''
        };
    };
    window.__cw_getTotalsForHost = function () {
        return readTotalsSafe() || {};
    };
    window.__cw_getBetTargetDebug = function (side) {
        side = normalizeSide(side);
        var tgt = findBetTarget(side);
        var trace = __cwGetLastBetTrace(side);
        var items = __cwCollectBetProbeCandidates(side, {
            maxClickablePerRoot: 8,
            maxAncestors: 4,
            maxNearNodes: 260
        }) || [];
        var rows = [];
        for (var i = 0; i < items.length && i < 24; i++) {
            var item = items[i];
            if (!item || !item.node || !item.row)
                continue;
            var rect = rectFromNodeCompat(item.node) || rectFromNodeScreen(item.node) || null;
            var explain = __cwExplainBetCandidate(item.node, rect, item.row.tag || '');
            rows.push({
                tag: String(item.row.tag || ''),
                name: String(item.row.name || ''),
                path: String(item.row.path || ''),
                rect: item.row.rect || '',
                clickable: !!item.row.clickable,
                hasButton: !!item.row.hasButton,
                hasToggle: !!item.row.hasToggle,
                touchListener: !!item.row.touchListener,
                accept: !!explain.ok,
                reason: String(explain.reason || '')
            });
        }
        return {
            side: side,
            target: tgt && tgt.node ? {
                nodeName: String(tgt.node.name || ''),
                path: __cwBetNodePath(tgt.node),
                sourceTag: String(tgt.sourceTag || ''),
                selectorPath: String(tgt.selectorPath || ''),
                labelPath: String(tgt.labelPath || ''),
                zonePath: String(tgt.zonePath || ''),
                boardPath: String(tgt.boardPath || ''),
                pointFamily: String(tgt.pointFamily || 'top'),
                labelRect: __cwBetRectLite(tgt.labelRect),
                zoneRect: __cwBetRectLite(tgt.zoneRect),
                boardRect: __cwBetRectLite(tgt.boardRect),
                cellRect: __cwBetRectLite(tgt.cellRect),
                rect: (function () {
                    var rect = tgt.rect || rectFromNodeCompat(tgt.node) || rectFromNodeScreen(tgt.node) || null;
                    return rect ? {
                        x: Math.round(__cwNumber(rect.sx, rect.x)),
                        y: Math.round(__cwNumber(rect.sy, rect.y)),
                        w: Math.round(Math.max(__cwNumber(rect.sw, rect.w), 0)),
                        h: Math.round(Math.max(__cwNumber(rect.sh, rect.h), 0))
                    } : null;
                })(),
                points: __cwBuildBetTargetPoints(tgt, side)
            } : null,
            trace: trace,
            history: __cwGetBetTraceHistory(side, 6),
            candidates: rows
        };
    };
    window.__cw_getExactBetSelectors = function (side) {
        var sides = side ? [normalizeSide(side)] : ['TAI', 'XIU', 'CHAN', 'LE'];
        var out = {};
        for (var i = 0; i < sides.length; i++) {
            var curSide = sides[i];
            var tgt = __cwFindExactBetTarget(curSide, null);
            out[curSide] = tgt && tgt.node ? {
                ok: true,
                side: curSide,
                nodeName: String(tgt.node.name || ''),
                selectorPath: String(tgt.selectorPath || ''),
                labelPath: String(tgt.labelPath || ''),
                zonePath: String(tgt.zonePath || ''),
                boardPath: String(tgt.boardPath || ''),
                pointFamily: String(tgt.pointFamily || 'top'),
                labelRect: __cwBetRectLite(tgt.labelRect),
                zoneRect: __cwBetRectLite(tgt.zoneRect),
                boardRect: __cwBetRectLite(tgt.boardRect),
                cellRect: __cwBetRectLite(tgt.cellRect),
                probeRect: __cwBetRectLite(tgt.rect),
                points: __cwBuildBetTargetPoints(tgt, curSide)
            } : {
                ok: false,
                side: curSide,
                selectorPath: String(BET_TAILS[curSide] || '')
            };
        }
        if (side)
            return out[sides[0]];
        return out;
    };
    window.__cw_buildCdpBetPlan = function (side, amount) {
        return __cwBuildCdpBetPlan(side, amount);
    };

    console.log('[READY] CW merged (compat + TextMap + Scan500Text + TK sequence + Totals by (x,tail) + standardized exports).');

    /* ---------------- tick & controls ---------------- */
    function statusByProg(p, textsHint) {
        var STATUS_TAIL = 'dual/canvas/node_dual/root/node_game(need_to_put_games_in_here)/prefab_game_305/root/middle/node_noti/lbl_noti';
        try {
            var texts = null;
            if (textsHint && textsHint.length)
                texts = textsHint;
            else if (S && S._lastTextAll && (Date.now() - (S._lastTextAt || 0)) <= 520)
                texts = S._lastTextAll;
            else
                texts = buildTextRects();

            var best = null;
            var bestArea = -1;
            for (var i = 0; i < texts.length; i++) {
                var t = texts[i];
                var tl = String(t.tail || '').toLowerCase();
                if (!tl.endsWith(STATUS_TAIL))
                    continue;
                var ar = (t.w || 0) * (t.h || 0);
                if (ar > bestArea) {
                    best = t;
                    bestArea = ar;
                }
            }
            var txt = best ? String(best.text || '').trim() : '';
            if (/^notification$/i.test(txt))
                return '';
            return txt || '';
        } catch (_) {
            return '';
        }
    }

    function tick() {
        var p = collectProgress();
        p = stabilizeProgSec(p);
        if (p != null)
            S.prog = p;
        var T = sampleTotalsNow();
        S._lastTotals = T;
        var pNow = (p != null) ? p : S.prog;
        S.status = statusByProg(pNow == null ? null : pNow, S._lastTextAll || null);

        // TK sequence
        var tk = readTKSeq();
        S.seq = tk.seq || '';

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
            S.money = buildMoneyRects();
            renderMoney();
        }
        if (S.showText) {
            S.text = (S._lastTextAll && (Date.now() - (S._lastTextAt || 0)) <= 520) ? S._lastTextAll : buildTextRects();
            renderText();
        }
        S._lastSnap = {
            abx: 'tick',
            prog: (pNow != null ? pNow : null),
            progIsSec: !!S._progIsSec,
            totals: T,
            seq: String(S.seq || ''),
            status: String(S.status || ''),
            ts: Date.now()
        };
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
        scan500Text();
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
        try {
            window.__cw_booted_v4 = 0;
        } catch (_) {}
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

        var __cw_seq_cache = {
            at: 0,
            val: ''
        };

        function readProgressVal() {
            try {
                if (S && typeof S.prog === 'number')
                    return S.prog;
                var cp = (typeof collectProgress === 'function') ? collectProgress() : null;
                if (typeof stabilizeProgSec === 'function')
                    cp = stabilizeProgSec(cp);
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

        function readSeqSafe(forceFresh) {
            try {
                var now = Date.now();
                if (!forceFresh && (now - (__cw_seq_cache.at || 0)) < 520)
                    return __cw_seq_cache.val || '';
                if (typeof readTKSeq === 'function') {
                    var r = readTKSeq();
                    var seq = (r && r.seq) ? r.seq : '';
                    __cw_seq_cache = {
                        at: now,
                        val: seq
                    };
                    return seq;
                }
            } catch (_) {}
            return '';
        }

        // Bắt đầu bắn snapshot định kỳ {abx:'tick', prog, totals, seq, status}
        window.__cw_startPush = function (tickMs) {
            try {
                tickMs = Number(tickMs) || 320;
                var uiTick = (S && Number(S.tickMs)) || 0;
                if (uiTick > 0 && tickMs < uiTick)
                    tickMs = uiTick;
                if (tickMs < 160)
                    tickMs = 160;
                if (tickMs > 1000)
                    tickMs = 1000;
                if (_pushTimer) {
                    clearInterval(_pushTimer);
                    _pushTimer = null;
                }
                _lastJson = '';
                _pushTimer = setInterval(function () {
                    var now = Date.now();
                    var snap = null;
                    var last = (S && S._lastSnap) ? S._lastSnap : null;
                    var freshMs = Math.max(260, ((S && Number(S.tickMs)) || 320) + 220);
                    if (last && (now - (last.ts || 0)) <= freshMs) {
                        snap = {
                            abx: 'tick',
                            prog: (typeof last.prog === 'number') ? last.prog : null,
                            progIsSec: !!last.progIsSec,
                            totals: last.totals || null,
                            seq: String(last.seq || ''),
                            status: String(last.status || ''),
                            ts: now
                        };
                    } else {
                        var p = readProgressVal(); // lấy progress hiện tại
                        var totalsNow = readTotalsSafe();
                        var st = (typeof statusByProg === 'function') // tính status theo rule mới
                         ? statusByProg(p, S && S._lastTextAll ? S._lastTextAll : null) : '';
                        snap = {
                            abx: 'tick',
                            prog: p,
                            progIsSec: !!(S && S._progIsSec),
                            totals: totalsNow,
                            seq: readSeqSafe(false),
                            status: String(st || ''),
                            ts: now
                        };
                        if (S)
                            S._lastSnap = snap;
                    }
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

    var __cw_probe0 = __cw_probeGameScene(1200);
    if (window.cc && cc.director && cc.director.getScene && __cw_probe0.ok && __cw_claimBootOwner(__cw_probe0)) {
        window.__cw_scene_probe = __cw_probe0;
        __cw_emitProbe('direct_boot', __cw_probe0);
        __cw_boot();
    } else {
        // Ưu tiên hiển thị Canvas Watch sớm khi scene đã có cc (dữ liệu chi tiết sẽ hoàn thiện sau).
        try {
            if (window.cc && cc.director && cc.director.getScene && __cw_claimBootOwner(__cw_probe0)) {
                window.__cw_scene_probe = __cw_probe0;
                __cw_emitProbe('direct_boot_ui', __cw_probe0);
                __cw_boot();
            }
        } catch (_) {}
        __cw_emitProbe('wait_ready', __cw_probe0);
        __cw_waitReady();
    }

})();
