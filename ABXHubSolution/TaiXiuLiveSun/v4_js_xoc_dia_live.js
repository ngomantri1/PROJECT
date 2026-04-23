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
    function totalsChangedForSide(before, cur, side) {
        before = before || {};
        cur = cur || {};
        side = normalizeSide(side);
        if (side === 'CHAN' && cur.C !== before.C)
            return {
                changed: true,
                reason: 'side_total',
                key: 'C',
                before: before.C,
                after: cur.C
            };
        if (side === 'LE' && cur.L !== before.L)
            return {
                changed: true,
                reason: 'side_total',
                key: 'L',
                before: before.L,
                after: cur.L
            };
        if (side === 'TAI' && cur.T !== before.T)
            return {
                changed: true,
                reason: 'side_total',
                key: 'T',
                before: before.T,
                after: cur.T
            };
        if (side === 'XIU' && cur.X !== before.X)
            return {
                changed: true,
                reason: 'side_total',
                key: 'X',
                before: before.X,
                after: cur.X
            };
        if (cur.A !== before.A)
            return {
                changed: true,
                reason: 'account_total',
                key: 'A',
                before: before.A,
                after: cur.A
            };
        return {
            changed: false,
            reason: '',
            key: '',
            before: null,
            after: null
        };
    }
    async function waitForTotalsChange(before, side, timeout) {
        timeout = timeout || 1400;
        var t0 = (performance && performance.now ? performance.now() : Date.now());
        var last = before;
        while (((performance && performance.now ? performance.now() : Date.now()) - t0) < timeout) {
            await sleep(90);
            var cur = sampleTotalsNow(true);
            if (totalsChangedForSide(last, cur, side).changed)
                return true;
            last = cur;
        }
        return false;
    }

    /* ---------------- state & UI ---------------- */
    var S = {
        running: false,
        timer: null,
        tickMs: 160,
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
    var BET_ZONE_PATH_TOKENS = {
        TAI: '/board_back/tai_bet',
        XIU: '/board_back/xiu_bet',
        CHAN: '/board_back/chan_bet',
        LE: '/board_back/le_bet'
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
    var CHIP_PANEL_TAIL = 'dual/Canvas/node_dual/root/node_game(need_to_put_games_in_here)/prefab_game_14/root/node_in_fullmode/HUD/bet_panel/chips/chip_panel/chip_mask/panel';
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
    function betRectSane(r) {
        return !!(r && isFinite(r.sx) && isFinite(r.sy) && isFinite(r.sw) && isFinite(r.sh) && r.sw > 24 && r.sh > 24);
    }
    function betRectUnion(a, b) {
        if (!betRectSane(a))
            return b || null;
        if (!betRectSane(b))
            return a || null;
        var x1 = Math.min(a.sx, b.sx);
        var y1 = Math.min(a.sy, b.sy);
        var x2 = Math.max(a.sx + a.sw, b.sx + b.sw);
        var y2 = Math.max(a.sy + a.sh, b.sy + b.sh);
        return {
            sx: x1,
            sy: y1,
            sw: Math.max(1, x2 - x1),
            sh: Math.max(1, y2 - y1)
        };
    }
    function betRectInset(r, dx, dy) {
        if (!betRectSane(r))
            return null;
        var ix = Math.max(0, Math.min((r.sw / 2) - 1, dx || 0));
        var iy = Math.max(0, Math.min((r.sh / 2) - 1, dy || 0));
        return {
            sx: r.sx + ix,
            sy: r.sy + iy,
            sw: Math.max(1, r.sw - ix * 2),
            sh: Math.max(1, r.sh - iy * 2)
        };
    }
    function betRectContainsPoint(r, x, y) {
        if (!betRectSane(r))
            return false;
        return x >= r.sx && x <= (r.sx + r.sw) && y >= r.sy && y <= (r.sy + r.sh);
    }
    function betRectCenter(r) {
        if (!betRectSane(r))
            return {
                x: 0,
                y: 0
            };
        return {
            x: r.sx + r.sw / 2,
            y: r.sy + r.sh / 2
        };
    }
    var BET_SIDE_TOKEN = {
        TAI: 'lbl_money_total_bet_tai',
        XIU: 'lbl_money_total_bet_xiu',
        CHAN: 'lbl_money_total_bet_chan',
        LE: 'lbl_money_total_bet_le'
    };
    function findBetLabelNode(side) {
        var WANT = normalizeSide(side);
        var tail = BET_TAILS[WANT];
        if (tail) {
            var byTail = findNodeByTail(tail);
            if (byTail)
                return byTail;
        }
        var token = BET_SIDE_TOKEN[WANT];
        if (!token)
            return null;
        var hit = null;
        walkNodes(function (n) {
            if (hit || !n || !active(n) || !nodeInGame(n))
                return;
            var p = String(fullPath(n, 200) || '').toLowerCase();
            if (p.indexOf(token) !== -1)
                hit = n;
        });
        return hit;
    }
    function isBetTotalLabelNode(node, side) {
        if (!node)
            return false;
        var p = String(fullPath(node, 200) || '').toLowerCase();
        if (!p)
            return false;
        var want = normalizeSide(side || '');
        if (want && BET_TAILS[want] && tailMatch(p, BET_TAILS[want]))
            return true;
        return p.indexOf('/lbl_money_total_bet_') !== -1;
    }
    function findBetZoneNode(side) {
        var WANT = normalizeSide(side);
        var token = String(BET_ZONE_PATH_TOKENS[WANT] || '').toLowerCase();
        if (!token)
            return null;
        var best = null;
        var bestArea = -1;
        walkNodes(function (n) {
            if (!n || !active(n) || !nodeInGame(n))
                return;
            var p = String(fullPath(n, 200) || '').toLowerCase();
            if (p.indexOf(token) === -1)
                return;
            var rect = rectFromNodeCompat(n);
            var area = rect ? (rect.sw * rect.sh) : 0;
            if (area > bestArea) {
                best = n;
                bestArea = area;
            }
        });
        return best;
    }
    function findBetBoardNodeFromLabel(labelNode) {
        var cur = labelNode || null;
        var best = null;
        var bestArea = -1;
        var depth = 0;
        while (cur && depth <= 10) {
            var nm = String(cur.name || '').toLowerCase();
            var path = String(fullPath(cur, 120) || '').toLowerCase();
            var rect = rectFromNodeCompat(cur);
            var area = rect ? (rect.sw * rect.sh) : 0;
            if ((nm === 'board_back' || /\/board_back(?:\/|$)/.test(path)) && area > bestArea) {
                best = cur;
                bestArea = area;
            }
            cur = cur.parent || cur._parent || null;
            depth++;
        }
        return best;
    }
    function findBetLabelsMap() {
        var sides = ['TAI', 'XIU', 'CHAN', 'LE'];
        var out = {};
        for (var i = 0; i < sides.length; i++) {
            var side = sides[i];
            var node = findBetLabelNode(side);
            if (node) {
                out[side] = {
                    side: side,
                    node: node,
                    rect: rectFromNodeCompat(node),
                    pos: nodeWorldPos(node)
                };
            }
        }
        return out;
    }
    function findBetBoardRect(labelMap) {
        var boardNode = null;
        var boardRect = null;
        var union = null;
        var sides = ['TAI', 'XIU', 'CHAN', 'LE'];
        for (var i = 0; i < sides.length; i++) {
            var it = labelMap[sides[i]];
            if (!it || !it.node)
                continue;
            var bn = findBetBoardNodeFromLabel(it.node);
            var br = bn ? rectFromNodeCompat(bn) : null;
            if (betRectSane(br) && (!boardRect || (br.sw * br.sh) > (boardRect.sw * boardRect.sh))) {
                boardNode = bn;
                boardRect = br;
            }
            if (betRectSane(it.rect))
                union = betRectUnion(union, it.rect);
        }
        if (!betRectSane(boardRect) && betRectSane(union)) {
            boardRect = {
                sx: union.sx - union.sw * 0.75,
                sy: union.sy - union.sh * 1.25,
                sw: union.sw * 2.50,
                sh: union.sh * 2.70
            };
        }
        if (betRectSane(boardRect) && betRectSane(union)) {
            var c1 = betRectCenter(union);
            if (!betRectContainsPoint(boardRect, c1.x, c1.y)) {
                boardRect = {
                    sx: Math.min(boardRect.sx, union.sx - union.sw * 0.35),
                    sy: Math.min(boardRect.sy, union.sy - union.sh * 0.55),
                    sw: Math.max(boardRect.sx + boardRect.sw, union.sx + union.sw * 1.35) - Math.min(boardRect.sx, union.sx - union.sw * 0.35),
                    sh: Math.max(boardRect.sy + boardRect.sh, union.sy + union.sh * 1.55) - Math.min(boardRect.sy, union.sy - union.sh * 0.55)
                };
            }
        }
        return {
            node: boardNode,
            rect: boardRect,
            union: union
        };
    }
    function buildBetGeometryTarget(side) {
        var WANT = normalizeSide(side);
        var labelMap = findBetLabelsMap();
        var anchor = labelMap[WANT] || null;
        if (!anchor || !anchor.node)
            return null;
        var sides = ['TAI', 'XIU', 'CHAN', 'LE'];
        var xs = [],
        ys = [];
        for (var i = 0; i < sides.length; i++) {
            var it = labelMap[sides[i]];
            if (!it || !betRectSane(it.rect))
                continue;
            xs.push(it.rect.sx + it.rect.sw / 2);
            ys.push(it.rect.sy + it.rect.sh / 2);
        }
        if (xs.length < 2 || ys.length < 2)
            return null;
        xs.sort(function (a, b) {
            return a - b;
        });
        ys.sort(function (a, b) {
            return a - b;
        });
        var midX = (xs[0] + xs[xs.length - 1]) / 2;
        var midY = (ys[0] + ys[ys.length - 1]) / 2;
        var geo = findBetBoardRect(labelMap);
        var boardRect = geo.rect;
        if (!betRectSane(boardRect))
            return null;
        var ac = betRectCenter(anchor.rect);
        var isLeft = ac.x < midX;
        var isTop = ac.y < midY;
        var x1 = isLeft ? boardRect.sx : midX;
        var x2 = isLeft ? midX : (boardRect.sx + boardRect.sw);
        var y1 = isTop ? boardRect.sy : midY;
        var y2 = isTop ? midY : (boardRect.sy + boardRect.sh);
        var cell = {
            sx: Math.min(x1, x2),
            sy: Math.min(y1, y2),
            sw: Math.abs(x2 - x1),
            sh: Math.abs(y2 - y1)
        };
        if (!betRectSane(cell))
            return null;
        var insetX = Math.max(10, Math.min(cell.sw * 0.18, 42));
        var insetY = Math.max(10, Math.min(cell.sh * 0.22, 42));
        var inner = betRectInset(cell, insetX, insetY) || cell;
        var touchNode = geo.node || anchor.node || null;
        return {
            side: WANT,
            node: touchNode || anchor.node,
            rect: inner,
            rawRect: cell,
            boardRect: boardRect,
            labelRect: anchor.rect,
            source: 'geometry'
        };
    }
    function findSide(side) {
        var WANT = normalizeSide(side);
        var zoneRoot = findBetZoneNode(WANT);
        if (zoneRoot) {
            var zoneList = listClickableTargets(zoneRoot);
            if (zoneList.length && zoneList[0].node)
                return zoneList[0].node;
        }
        var tail = BET_TAILS[WANT];
        if (tail) {
            var byTail = findNodeByTail(tail);
            if (byTail) {
                var cTail = clickableOf(byTail, 8);
                if (clickable(cTail) && !isBetTotalLabelNode(cTail, WANT))
                    return cTail;
                return null;
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
    function findBetTarget(side) {
        var geo = buildBetGeometryTarget(side);
        if (geo && geo.node && betRectSane(geo.rect) && !isBetTotalLabelNode(geo.node, side))
            return geo;
        var WANT = normalizeSide(side);
        var zoneRoot = findBetZoneNode(WANT);
        if (zoneRoot) {
            var zoneList = listClickableTargets(zoneRoot);
            if (zoneList.length && zoneList[0].node) {
                return {
                    node: zoneList[0].node,
                    rect: zoneList[0].rect || rectFromNodeCompat(zoneList[0].node),
                    area: zoneList[0].area || 0,
                    source: 'zone_clickable'
                };
            }
            var zoneRect = rectFromNodeCompat(zoneRoot);
            if (betRectSane(zoneRect) && !isBetTotalLabelNode(zoneRoot, WANT)) {
                return {
                    node: zoneRoot,
                    rect: zoneRect,
                    area: zoneRect.sw * zoneRect.sh,
                    source: 'zone_rect'
                };
            }
        }
        var tail = BET_TAILS[WANT];
        if (tail) {
            var roots = findNodesByTail(tail);
            var best = null;
            for (var i = 0; i < roots.length; i++) {
                if (isBetTotalLabelNode(roots[i], WANT))
                    continue;
                var list = listClickableTargets(roots[i]);
                if (list.length && (!best || (list[0].area || 0) > (best.area || 0)))
                    best = list[0];
            }
            if (best && best.node)
                return best;
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
    var BET_CLICK_CFG = {
        postFocusDelay: 100,
        confirmTimeout: 280,
        confirmPoll: 45,
        retryPause: 35,
        betweenStepDelay: 45,
        maxAttempts: 3,
        queueAckWait: 60,
        queueSpacingMs: 200
    };
    function postBetTrace(stage, data) {
        var obj = {
            abx: 'bet_trace',
            stage: String(stage || ''),
            ts: Date.now()
        };
        data = data || {};
        for (var k in data) {
            if (Object.prototype.hasOwnProperty.call(data, k))
                obj[k] = data[k];
        }
        try {
            __cw_tryPost(obj);
        } catch (_) {}
        try {
            console.log('[cwBetTrace]', obj);
        } catch (_) {}
    }
    function totalsSnapshotMini(t) {
        t = t || {};
        return {
            C: t.C == null ? null : t.C,
            L: t.L == null ? null : t.L,
            T: t.T == null ? null : t.T,
            X: t.X == null ? null : t.X,
            A: t.A == null ? null : t.A
        };
    }
    function betTargetDebug(tgt) {
        if (!tgt)
            return {
                source: '',
                nodeName: '',
                nodePath: '',
                rect: null
            };
        return {
            source: String(tgt.source || ''),
            nodeName: String((tgt.node && tgt.node.name) || ''),
            nodePath: String((tgt.node && fullPath(tgt.node, 200)) || ''),
            rect: tgt.rect ? {
                sx: Math.round(tgt.rect.sx || 0),
                sy: Math.round(tgt.rect.sy || 0),
                sw: Math.round(tgt.rect.sw || 0),
                sh: Math.round(tgt.rect.sh || 0)
            } : null
        };
    }
    function betRectPoint(rect, fx, fy) {
        if (!betRectSane(rect))
            return null;
        var px = rect.sx + rect.sw * fx;
        var py = rect.sy + rect.sh * fy;
        return {
            x: px,
            y: py
        };
    }
    function dispatchBetTargetAttempt(tgt, attempt) {
        if (!tgt || !tgt.node)
            return false;
        var node = tgt.node;
        var rect = tgt.rect || rectFromNodeCompat(node);
        var mode = String((attempt && attempt.mode) || '');
        if (mode === 'toggle')
            return emitBtnToggle(node);
        if (mode === 'touch_rect_center')
            return !!(rect && emitTouchAtRect(node, rect));
        if (mode === 'canvas_point') {
            var pt = betRectPoint(rect, attempt.fx, attempt.fy);
            return !!(pt && clickCanvasXY(pt.x, pt.y, true));
        }
        if (mode === 'emit_click')
            return !!(clickable(node) && emitClick(node));
        if (mode === 'canvas_center') {
            var rc = betRectCenter(rect);
            return !!(rect && clickCanvasXY(rc.x, rc.y, true));
        }
        return false;
    }
    function isSingleThousandBet(meta) {
        meta = meta || {};
        var amount = Number(meta.amount || 0);
        var denom = Number(meta.denom || 0);
        var turn = Number(meta.turn || 0);
        return amount === 1000 && denom === 1000 && turn === 1;
    }
    function shouldAcceptBetChange(reason, meta) {
        if (!reason || !reason.changed)
            return false;
        // C# coi enqueue là thành công; mọi biến động liên quan chỉ dùng để nhả queue sớm.
        return true;
    }
    async function clickBetTargetConfirmed(tgt, side, meta) {
        meta = meta || {};
        if (!tgt || !tgt.node) {
            postBetTrace('bet_target_missing', {
                side: normalizeSide(side),
                amount: Number(meta.amount || 0),
                phase: String(meta.phase || '')
            });
            return false;
        }
        var attempts = [
            {
                mode: 'toggle'
            },
            {
                mode: 'touch_rect_center'
            },
            {
                mode: 'canvas_center',
                fx: 0.5,
                fy: 0.5
            },
            {
                mode: 'canvas_point',
                fx: 0.35,
                fy: 0.50
            },
            {
                mode: 'canvas_point',
                fx: 0.65,
                fy: 0.50
            },
            {
                mode: 'canvas_point',
                fx: 0.50,
                fy: 0.35
            },
            {
                mode: 'canvas_point',
                fx: 0.50,
                fy: 0.65
            },
            {
                mode: 'emit_click'
            }
        ];
        var targetInfo = betTargetDebug(tgt);
        var before = sampleTotalsNow(true) || {};
        postBetTrace('bet_click_start', {
            side: normalizeSide(side),
            amount: Number(meta.amount || 0),
            denom: Number(meta.denom || 0),
            turn: Number(meta.turn || 0),
            phase: String(meta.phase || ''),
            target: targetInfo,
            before: totalsSnapshotMini(before)
        });
        var maxAttempts = Math.max(1, Math.min(attempts.length, Number(BET_CLICK_CFG.maxAttempts) || attempts.length));
        for (var i = 0; i < maxAttempts; i++) {
            var attempt = attempts[i];
            var sent = dispatchBetTargetAttempt(tgt, attempt);
            postBetTrace('bet_click_dispatch', {
                side: normalizeSide(side),
                amount: Number(meta.amount || 0),
                denom: Number(meta.denom || 0),
                turn: Number(meta.turn || 0),
                phase: String(meta.phase || ''),
                target: targetInfo,
                attempt: i + 1,
                mode: attempt.mode,
                sent: !!sent
            });
            if (!sent) {
                await sleep(BET_CLICK_CFG.retryPause);
                continue;
            }
            var applied = false;
            var reason = {
                changed: false,
                reason: '',
                key: '',
                before: null,
                after: null
            };
            var t0 = (performance && performance.now ? performance.now() : Date.now());
            var last = before;
            while (((performance && performance.now ? performance.now() : Date.now()) - t0) < BET_CLICK_CFG.confirmTimeout) {
                await sleep(BET_CLICK_CFG.confirmPoll || 45);
                var cur = sampleTotalsNow(true) || {};
                reason = totalsChangedForSide(last, cur, side);
                if (reason.changed) {
                    if (shouldAcceptBetChange(reason, meta)) {
                        applied = true;
                        before = cur;
                        break;
                    }
                    postBetTrace('bet_click_ignore_change', {
                        side: normalizeSide(side),
                        amount: Number(meta.amount || 0),
                        denom: Number(meta.denom || 0),
                        turn: Number(meta.turn || 0),
                        phase: String(meta.phase || ''),
                        target: targetInfo,
                        attempt: i + 1,
                        mode: attempt.mode,
                        ignoreReason: String(reason.reason || ''),
                        ignoreKey: String(reason.key || ''),
                        ignoreBefore: reason.before == null ? null : reason.before,
                        ignoreAfter: reason.after == null ? null : reason.after
                    });
                }
                last = cur;
            }
            postBetTrace('bet_click_result', {
                side: normalizeSide(side),
                amount: Number(meta.amount || 0),
                denom: Number(meta.denom || 0),
                turn: Number(meta.turn || 0),
                phase: String(meta.phase || ''),
                target: targetInfo,
                attempt: i + 1,
                mode: attempt.mode,
                applied: !!applied,
                changeReason: String(reason.reason || ''),
                changeKey: String(reason.key || ''),
                changeBefore: reason.before == null ? null : reason.before,
                changeAfter: reason.after == null ? null : reason.after,
                after: totalsSnapshotMini(before)
            });
            if (applied)
                return true;
            await sleep(BET_CLICK_CFG.retryPause);
        }
        postBetTrace('bet_click_fail', {
            side: normalizeSide(side),
            amount: Number(meta.amount || 0),
            denom: Number(meta.denom || 0),
            turn: Number(meta.turn || 0),
            phase: String(meta.phase || ''),
            target: targetInfo,
            after: totalsSnapshotMini(before)
        });
        return false;
    }
    async function clickBetTargetFast(tgt, side, meta) {
        meta = meta || {};
        if (!tgt || !tgt.node) {
            postBetTrace('bet_target_missing', {
                side: normalizeSide(side),
                amount: Number(meta.amount || 0),
                phase: String(meta.phase || '')
            });
            return false;
        }

        var attempts = [
            { mode: 'touch_rect_center' },
            { mode: 'canvas_center', fx: 0.5, fy: 0.5 },
            { mode: 'canvas_point', fx: 0.5, fy: 0.5 },
            { mode: 'emit_click' }
        ];
        var targetInfo = betTargetDebug(tgt);
        postBetTrace('bet_click_start', {
            side: normalizeSide(side),
            amount: Number(meta.amount || 0),
            denom: Number(meta.denom || 0),
            turn: Number(meta.turn || 0),
            phase: String(meta.phase || ''),
            fast: true,
            target: targetInfo
        });

        for (var i = 0; i < attempts.length; i++) {
            var attempt = attempts[i];
            var sent = dispatchBetTargetAttempt(tgt, attempt);
            postBetTrace('bet_click_dispatch', {
                side: normalizeSide(side),
                amount: Number(meta.amount || 0),
                denom: Number(meta.denom || 0),
                turn: Number(meta.turn || 0),
                phase: String(meta.phase || ''),
                fast: true,
                target: targetInfo,
                attempt: i + 1,
                mode: attempt.mode,
                sent: !!sent
            });
            if (sent) {
                postBetTrace('bet_click_fire', {
                    side: normalizeSide(side),
                    amount: Number(meta.amount || 0),
                    denom: Number(meta.denom || 0),
                    turn: Number(meta.turn || 0),
                    phase: String(meta.phase || ''),
                    mode: attempt.mode,
                    fast: true
                });
                return true;
            }
            await sleep(BET_CLICK_CFG.retryPause || 35);
        }

        postBetTrace('bet_click_fail', {
            side: normalizeSide(side),
            amount: Number(meta.amount || 0),
            denom: Number(meta.denom || 0),
            turn: Number(meta.turn || 0),
            phase: String(meta.phase || ''),
            fast: true,
            target: targetInfo
        });
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
            var rc = betRectCenter(rect);
            if (clickCanvasXY(rc.x, rc.y, true))
                ok = true;
        }
        if (!ok && clickable(node))
            ok = emitClick(node) || ok;
        return ok;
    }
    window.__cw_getBetTargetDebug = function (side) {
        var tgt = findBetTarget(side);
        if (!tgt)
            return null;
        return {
            side: normalizeSide(side),
            source: String(tgt.source || ''),
            nodeName: String((tgt.node && tgt.node.name) || ''),
            nodePath: String((tgt.node && fullPath(tgt.node, 200)) || ''),
            rect: tgt.rect || null,
            rawRect: tgt.rawRect || null,
            boardRect: tgt.boardRect || null,
            labelRect: tgt.labelRect || null
        };
    };

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
    function nodeAmountLoose(n) {
        if (!n)
            return null;
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
            var v = parseAmountLoose(texts[i]);
            if (v)
                return v;
        }
        return null;
    }
    function scoreChipScope(root) {
        if (!root)
            return -1;
        var labelCount = 0;
        var chipCount = 0;
        var amountCount = 0;
        (function walk(n) {
            if (!n || !active(n))
                return;
            var name = String(n.name || '');
            if (/^lbl_chip_value\d+$/i.test(name))
                labelCount++;
            if (/^chip\d+$/i.test(name) || hasCompName(n, 'ChipItem'))
                chipCount++;
            if (nodeAmountLoose(n))
                amountCount++;
            var kids = n.children || [];
            for (var i = 0; i < kids.length; i++)
                walk(kids[i]);
        })(root);
        var path = String(fullPath(root, 120) || '').toLowerCase();
        var score = labelCount * 20 + chipCount * 15 + amountCount * 4;
        if (/chip_panel|bet_panel|chips|coin|phinh|menh/.test(path))
            score += 30;
        return score;
    }
    function findChipScopeForLabel(labelNode) {
        var cur = labelNode || null;
        var best = null;
        var bestScore = -1;
        var depth = 0;
        while (cur && depth <= 8) {
            var sc = scoreChipScope(cur);
            if (sc > bestScore) {
                best = cur;
                bestScore = sc;
            }
            cur = cur.parent || cur._parent || null;
            depth++;
        }
        return best;
    }
    function buildChipInventory(root) {
        var out = {
            panel: root,
            labels: [],
            chips: [],
            labelsByIndex: {},
            chipsByIndex: {}
        };
        if (!root)
            return out;
        (function walk(n) {
            if (!n || !active(n))
                return;
            var name = String(n.name || '');
            var mLabel = name.match(/^lbl_chip_value(\d+)$/i);
            if (mLabel) {
                var idxLabel = parseInt(mLabel[1], 10);
                out.labels.push(n);
                out.labelsByIndex[String(idxLabel)] = n;
            }
            var mChip = name.match(/^chip(\d+)$/i);
            if (mChip) {
                var idx = parseInt(mChip[1], 10);
                out.chips.push(n);
                if (!out.chipsByIndex[String(idx)])
                    out.chipsByIndex[String(idx)] = n;
            } else if (hasCompName(n, 'ChipItem')) {
                out.chips.push(n);
            }
            var kids = n.children || [];
            for (var i = 0; i < kids.length; i++)
                walk(kids[i]);
        })(root);
        return out;
    }
    function sortNodesByPos(nodes) {
        var arr = (nodes || []).slice();
        arr.sort(function (a, b) {
            var pa = nodeWorldPos(a);
            var pb = nodeWorldPos(b);
            var dy = Math.abs((pa.y || 0) - (pb.y || 0));
            if (dy > 8)
                return (pb.y || 0) - (pa.y || 0);
            return (pa.x || 0) - (pb.x || 0);
        });
        return arr;
    }
    function findNodeOrdinal(target, nodes) {
        if (!target || !nodes || !nodes.length)
            return -1;
        var sorted = sortNodesByPos(nodes);
        for (var i = 0; i < sorted.length; i++) {
            if (sorted[i] === target)
                return i;
        }
        return -1;
    }
    function findNearestChipNode(labelNode, chips) {
        if (!labelNode || !chips || !chips.length)
            return null;
        var lp = nodeWorldPos(labelNode);
        var best = null;
        var bestD = null;
        for (var i = 0; i < chips.length; i++) {
            var chip = chips[i];
            if (!chip)
                continue;
            var cp = nodeWorldPos(chip);
            var d = dist2(lp.x || 0, lp.y || 0, cp.x || 0, cp.y || 0);
            if (bestD == null || d < bestD) {
                best = chip;
                bestD = d;
            }
        }
        return best;
    }
    function findVisibleChipLabelByAmount(amount) {
        var want = Math.max(0, Math.floor(+amount || 0));
        if (!want)
            return null;
        var best = null;
        var bestScore = -1;
        walkNodes(function (n) {
            if (!n || !active(n) || !nodeInGame(n))
                return;
            var val = nodeAmountLoose(n);
            if (val !== want)
                return;
            var path = String(fullPath(n, 160) || '').toLowerCase();
            var score = 0;
            if (/chip|coin|phinh|menh|bet_panel|chip_panel/.test(path))
                score += 10;
            if (/^lbl_chip_value\d+$/i.test(String(n.name || '')))
                score += 20;
            if (clickableOf(n, 6) !== n)
                score += 2;
            if (score > bestScore) {
                best = n;
                bestScore = score;
            }
        });
        return best;
    }
    function findBestVisibleChipLabelByAmount(amount) {
        return findVisibleChipLabelByAmount(amount);
    }
    function findChipPanelNode(labelNode) {
        var panel = findNodeByTail(CHIP_PANEL_TAIL);
        if (panel)
            return panel;
        if (labelNode)
            panel = findChipScopeForLabel(labelNode);
        if (panel)
            return panel;
        var keys = Object.keys(CHIP_TAILS || {});
        for (var i = 0; i < keys.length; i++) {
            var val = Math.max(0, Math.floor(+keys[i] || 0));
            var tail = CHIP_TAILS[keys[i]];
            var node = findNodeByTail(tail) || findBestVisibleChipLabelByAmount(val);
            if (node) {
                panel = findChipScopeForLabel(node);
                if (panel)
                    return panel;
            }
        }
        return null;
    }
    function getChipPanelInventory(labelNode) {
        return buildChipInventory(findChipPanelNode(labelNode));
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
    function findChipNodeFromLabelCurrent(labelNode) {
        if (!labelNode)
            return null;
        var p = labelNode.parent || labelNode._parent || null;
        var kids = (p && (p.children || p._children)) ? (p.children || p._children) : [];
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
        var bestSibling = null;
        var bestSiblingD = null;
        for (var j = 0; j < kids.length; j++) {
            var k = kids[j];
            if (!k)
                continue;
            var kn = String(k.name || '');
            if (kn.indexOf('chip') === 0 || hasCompName(k, 'ChipItem')) {
                var kp = nodeWorldPos(k);
                var d = dist2(lp.x || 0, lp.y || 0, kp.x || 0, kp.y || 0);
                if (bestSiblingD == null || d < bestSiblingD) {
                    bestSibling = k;
                    bestSiblingD = d;
                }
            }
        }
        return bestSibling || null;
    }
    function explainChipAmount(amount) {
        var key = String(Math.max(0, Math.floor(+amount || 0)));
        var tail = CHIP_TAILS[key] || '';
        var labelNode = tail ? findNodeByTail(tail) : null;
        if (!labelNode || nodeAmountLoose(labelNode) !== Number(key))
            labelNode = findBestVisibleChipLabelByAmount(Number(key));
        var inv = getChipPanelInventory(labelNode);
        var idx = null;
        if (labelNode) {
            var m0 = String(labelNode.name || '').match(/lbl_chip_value(\d+)/i);
            if (m0)
                idx = parseInt(m0[1], 10);
        }
        var currentChip = findChipNodeFromLabelCurrent(labelNode);
        var strictChip = idx == null ? null : (inv.chipsByIndex[String(idx)] || null);
        var nearestChip = labelNode ? findNearestChipNode(labelNode, inv.chips) : null;
        var labelOrdinal = labelNode ? findNodeOrdinal(labelNode, inv.labels) : -1;
        var sortedChips = sortNodesByPos(inv.chips);
        var ordinalChip = (labelOrdinal >= 0 && labelOrdinal < sortedChips.length) ? sortedChips[labelOrdinal] : null;
        var labelClickable = labelNode ? clickableOf(labelNode, 10) : null;
        var strictClickable = strictChip ? clickableOf(strictChip, 10) : null;
        var currentTarget = currentChip || labelClickable || labelNode || null;
        return {
            amount: Number(key),
            tail: tail,
            idx: idx,
            labelNode: labelNode,
            currentChip: currentChip,
            currentTarget: currentTarget,
            strictChip: strictChip,
            nearestChip: nearestChip,
            ordinalChip: ordinalChip,
            labelClickable: labelClickable,
            strictClickable: strictClickable,
            panel: inv.panel || null,
            panelLabelCount: inv.labels.length,
            panelChipCount: inv.chips.length,
            labelOrdinal: labelOrdinal
        };
    }
    function pickChipFocusTarget(info) {
        if (!info)
            return null;
        return info.nearestChip || info.ordinalChip || info.strictChip || info.strictClickable || info.currentTarget || info.labelNode || null;
    }
    function findChipNodeFromLabel(labelNode, amountHint) {
        if (!labelNode)
            return null;
        var want = amountHint != null ? Math.max(0, Math.floor(+amountHint || 0)) : nodeAmountLoose(labelNode);
        if (want) {
            var info = explainChipAmount(want);
            return pickChipFocusTarget(info) || info.currentTarget || findChipNodeFromLabelCurrent(labelNode) || null;
        }
        return findChipNodeFromLabelCurrent(labelNode);
    }
    function resolveChipNode(n) {
        if (!n)
            return null;
        var nm = String(n.name || '');
        if (nm.indexOf('lbl_chip_value') !== -1) {
            var c = findChipNodeFromLabel(n, nodeAmountLoose(n));
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
    function scanChipsByTail() {
        var out = {};
        var keys = Object.keys(CHIP_TAILS || {});
        for (var i = 0; i < keys.length; i++) {
            var val = keys[i];
            var want = Math.max(0, Math.floor(+val || 0));
            var info = explainChipAmount(want);
            var target = pickChipFocusTarget(info);
            if (!info.labelNode && !target)
                continue;
            out[val] = {
                entry: target,
                node: target,
                rect: rectFromNodeScreen(target || info.labelNode),
                mode: target === info.nearestChip ? 'nearest' : (target === info.ordinalChip ? 'ordinal' : (target === info.strictChip ? 'strict' : 'fallback'))
            };
        }
        return out;
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
        var info = explainChipAmount(val);
        var target = pickChipFocusTarget(info);
        if (!target) {
            await tryOpenChipPanel();
            await sleep(100);
            info = explainChipAmount(val);
            target = pickChipFocusTarget(info);
        }
        if (!target) {
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
                await sleep(80);
                var t = getComp(target, cc.Toggle);
                if (t && !t.isChecked) {
                    t.isChecked = true;
                    if (t._emitToggleEvents)
                        t._emitToggleEvents();
                }
                return true;
            }
            var map = window.cwScanChips() || {};
            if (!map[String(val)] && prevFocus)
                return prevFocus(amount);
            if (map[String(val)]) {
                info = explainChipAmount(val);
                target = resolveChipNode(map[String(val)].node) || map[String(val)].node;
            }
        }
        if (!target) {
            return false;
        }
        var target2 = resolveChipNode(target) || target;
        var touched2 = emitTouchOnNode(target2);
        if (!touched2) {
            if (clickable(target2))
                emitClick(target2);
            else if (info && info.labelNode)
                clickRectCenter(rectFromNodeScreen(target2 || info.labelNode));
            else
                clickRectCenter(rectFromNodeScreen(target2));
        }
        await sleep(80);
        var tg = getComp(target2, cc.Toggle);
        if (tg && !tg.isChecked) {
            tg.isChecked = true;
            if (tg._emitToggleEvents)
                tg._emitToggleEvents();
        }
        console.log('[cwFocusChip++]', {
            amount: val,
            mode: target === info.nearestChip ? 'nearest' : (target === info.ordinalChip ? 'ordinal' : (target === info.strictChip ? 'strict' : 'fallback')),
            target: String((target2 && target2.name) || ''),
            label: String((info && info.labelNode && info.labelNode.name) || ''),
            panelLabels: info ? info.panelLabelCount : 0,
            panelChips: info ? info.panelChipCount : 0
        });
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
                postBetTrace('bet_target_not_found', {
                    side: side,
                    amount: 0,
                    phase: 'tap_only'
                });
                return false;
            }
            return await clickBetTargetConfirmed(tgt0, side, {
                amount: 0,
                phase: 'tap_only'
            });
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
                postBetTrace('bet_target_not_found', {
                    side: side,
                    amount: X,
                    phase: 'plan_start'
                });
                return false;
            }
            postBetTrace('bet_plan_start', {
                side: side,
                amount: X,
                target: betTargetDebug(tgt)
            });

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
                await sleep(BET_CLICK_CFG.postFocusDelay);
                var fired = await clickBetTargetFast(tgt, side, {
                    amount: X,
                    denom: X,
                    turn: 1,
                    phase: 'single_chip'
                });
                if (fired)
                    postBetTrace('bet_done', {
                        side: side,
                        amount: X,
                        fast: true
                    });
                return fired;
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
            postBetTrace('bet_plan_resolved', {
                side: side,
                amount: X,
                plan: planStr.join(' + '),
                target: betTargetDebug(tgt)
            });

            for (var s = 0; s < plan.length; s++) {
                var step = plan[s];
                var ok = await window.cwFocusChip(step.val).catch(function () {
                    return false;
                });
                if (!ok) {
                    console.warn('[cwBet++] không focus được chip', step.val);
                    postBetTrace('bet_focus_fail', {
                        side: side,
                        amount: X,
                        denom: step.val,
                        phase: 'plan_step'
                    });
                    return false;
                }
                await sleep(BET_CLICK_CFG.postFocusDelay);
                for (var i2 = 0; i2 < step.count; i2++) {
                    if (!await clickBetTargetFast(tgt, side, {
                            amount: X,
                            denom: step.val,
                            turn: i2 + 1,
                            phase: 'plan_step'
                        })) {
                        console.warn('[cwBet++] click cửa thất bại', {
                            side: side,
                            denom: step.val,
                            turn: i2 + 1
                        });
                        postBetTrace('bet_click_abort', {
                            side: side,
                            amount: X,
                            denom: step.val,
                            turn: i2 + 1,
                            phase: 'plan_step'
                        });
                        return false;
                    } else
                        postBetTrace('bet_click_applied', {
                            side: side,
                            amount: X,
                            denom: step.val,
                            turn: i2 + 1,
                            phase: 'plan_step'
                        });
                    await sleep(BET_CLICK_CFG.betweenStepDelay);
                }
            }
            console.log('[cwBet++] DONE ►', {
                side: side,
                amount: X
            });
            postBetTrace('bet_done', {
                side: side,
                amount: X
            });
            return true;
        });
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

                    try {
                        Promise.resolve(cwBet(job.side, job.amt))
                            .then(function (rawResult) {
                                if (rawResult === false) {
                                    postBetTrace('bet_fire_result_false', {
                                        side: job.side,
                                        amount: job.amt,
                                        tabId: job.tabId,
                                        roundId: job.roundId,
                                        fast: true
                                    });
                                }
                            })
                            .catch(function (err) {
                                postBetTrace('bet_fire_error', {
                                    side: job.side,
                                    amount: job.amt,
                                    tabId: job.tabId,
                                    roundId: job.roundId,
                                    error: String(err && err.message || err),
                                    fast: true
                                });
                            });
                    } catch (fireErr) {
                        postBetTrace('bet_fire_error', {
                            side: job.side,
                            amount: job.amt,
                            tabId: job.tabId,
                            roundId: job.roundId,
                            error: String(fireErr && fireErr.message || fireErr),
                            fast: true
                        });
                    }
                    safePost({
                        abx: "bet",
                        side: job.side,
                        amount: job.amt,
                        tabId: job.tabId,
                        roundId: job.roundId,
                        fireAndContinue: true,
                        ts: Date.now()
                    });
                    if (typeof job.resolve === "function") {
                        try { job.resolve("sent"); } catch (_) {}
                    }
                    await sleep(BET_CLICK_CFG.queueSpacingMs || 200);
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
                    if (typeof job.resolve === "function") {
                        try { job.resolve("fail:" + String(err && err.message || err)); } catch (_) {}
                    }
                    await sleep(BET_CLICK_CFG.queueSpacingMs || 200);
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
