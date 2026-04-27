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
    var CW_ROOT_ID = '__cw_root_allin';
    var CW_FALLBACK_PANEL_ID = '__cw_wait_panel';
    function __cw_hrefLowerOf(w) {
        try {
            return String((w.location && w.location.href) || '').toLowerCase();
        } catch (_) {
            return '';
        }
    }
    function __cw_isWebMainHref(href) {
        return String(href || '').toLowerCase().indexOf('/player/webmain.jsp') >= 0;
    }
    function __cw_isPanelDisplayOwner() {
        try {
            var href = __cw_hrefLowerOf(window);
            var isTop = false;
            try {
                isTop = window.top === window;
            } catch (_) {
                isTop = false;
            }

            if (__cw_isWebMainHref(href)) {
                if (isTop)
                    return true;

                var topHref = '';
                try {
                    topHref = __cw_hrefLowerOf(window.top);
                } catch (_) {
                    topHref = '';
                }
                return !__cw_isWebMainHref(topHref);
            }

            return false;
        } catch (_) {
            return false;
        }
    }
    function __cw_applyPanelDisplayOwner(rootEl) {
        try {
            if (!rootEl)
                return false;
            var show = __cw_isPanelDisplayOwner();
            rootEl.setAttribute('data-abx-panel-owner', show ? '1' : '0');
            rootEl.setAttribute('data-abx-panel-owner-href', String(location.href || '').replace(/[?#].*$/, ''));
            if (rootEl.getAttribute('data-abx-controlled-by-top') === '1')
                return show;

            // Do not self-hide frame panels. The top controller scores every frame
            // and keeps exactly one root visible; self-hiding here can hide the
            // only panel that has live baccarat details.
            rootEl.removeAttribute('data-abx-hidden-by-owner');
            rootEl.style.setProperty('display', 'block', 'important');
            rootEl.style.setProperty('visibility', 'visible', 'important');
            rootEl.style.setProperty('pointer-events', 'none', 'important');
            return show;
        } catch (_) {
            return false;
        }
    }
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
    function __cw_ensureFallbackPanel(stateText, infoText) {
        try {
            var host = document.body || document.documentElement;
            if (!host) return null;

            var root = document.getElementById(CW_ROOT_ID);
            if (!root) {
                root = document.createElement('div');
                root.id = CW_ROOT_ID;
                root.setAttribute('data-cw-mode', 'fallback');
                root.style.cssText = 'position:fixed;inset:0;z-index:2147483646;pointer-events:none;';
                host.appendChild(root);
            }
            __cw_applyPanelDisplayOwner(root);

            var panel = document.getElementById(CW_FALLBACK_PANEL_ID);
            if (!panel) {
                panel = document.createElement('div');
                panel.id = CW_FALLBACK_PANEL_ID;
                panel.style.cssText = 'position:fixed;top:10px;right:10px;width:420px;background:#08130f;color:#bff;border:1px solid #0a0;border-radius:10px;padding:8px;font:12px/1.45 Consolas,monospace;pointer-events:auto;z-index:2147483647';
                root.appendChild(panel);
            }

            panel.innerHTML = ''
                + '<div style="display:flex;gap:6px;align-items:center;margin-bottom:6px">'
                + '<b style="color:#9f9">Canvas Watch</b>'
                + '<span style="margin-left:auto;color:#ffd866">' + String(stateText || 'WAIT-ENGINE') + '</span>'
                + '</div>'
                + '<div style="white-space:pre-wrap;color:#bff;background:#0b1b16;border:1px solid #2a5;padding:6px;border-radius:6px;">'
                + String(infoText || 'Dang cho runtime canvas/Cocos khoi tao...')
                + '</div>';
            return panel;
        } catch (_) {
            return null;
        }
    }

    function __cw_waitReady() {
        if (window.__cw_waiting_v4) return;
        window.__cw_waiting_v4 = 1;
        __cw_ensureFallbackPanel('WAIT-ENGINE', 'Dang cho runtime canvas/Cocos khoi tao de mo day du Canvas Watch.');
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
                    __cw_ensureFallbackPanel('NO-ENGINE', 'Khong phat hien window.cc / Cocos tren trang nay.\nCanvas Watch day du khong the boot, nhung panel da duoc hien de cho chan doan.');
                }
            } catch (e) {}
        }, 500);
    }

    function __cw_hasCocos() {
        try {
            return !!(window.cc && cc.director && cc.director.getScene);
        } catch (_) {
            return false;
        }
    }
    function __cw_isTopDocument() {
        try {
            return window.top === window;
        } catch (_) {
            return false;
        }
    }
    function __cw_isGamePopupPage() {
        try {
            var href = String(location.href || '').toLowerCase();
            var path = String(location.pathname || '').toLowerCase();

            var isWebMain =
                path.indexOf('/player/webmain.jsp') >= 0 ||
                href.indexOf('/player/webmain.jsp') >= 0;
            var isSingleBac =
                path.indexOf('/player/singlebactable.jsp') >= 0 ||
                href.indexOf('/player/singlebactable.jsp') >= 0;
            var isGameHall =
                path.indexOf('/player/gamehall.jsp') >= 0 ||
                href.indexOf('/player/gamehall.jsp') >= 0;
            var isApiLogin =
                path.indexOf('/player/login/apilogin') >= 0 ||
                href.indexOf('/player/login/apilogin') >= 0;

            // Cho phép webMain cả top document và iframe (vipbet389 thường chạy trong iframe).
            if (isWebMain)
                return true;

            // Mở rộng: cho phép boot trực tiếp trong frame game.
            if (isSingleBac)
                return true;

            // Một số site bọc game qua gameHall frame cùng provider.
            if (isGameHall && !__cw_isTopDocument())
                return true;

            // vipbet389 có thể giữ URL apiLogin trong iframe nhưng render game nội bộ theo flow SPA.
            if (isApiLogin && !__cw_isTopDocument())
                return true;

            return false;
        } catch (_) {
            return false;
        }
    }

    function __abxTrimUrlForContext(url) {
        try {
            return String(url || '').replace(/#.*$/, '').slice(0, 260);
        } catch (_) {
            return '';
        }
    }
    function __abxTryTopHref() {
        try {
            return String(window.top && window.top.location && window.top.location.href || '');
        } catch (_) {
            return '';
        }
    }
    function __abxTryFramePath() {
        try {
            if (window.top === window)
                return 'top';
        } catch (_) {}
        try {
            var topWin = window.top;
            function scan(w, path, depth) {
                if (!w || depth > 8)
                    return '';
                if (w === window)
                    return path;
                var frames = w.frames || [];
                for (var i = 0; i < frames.length; i++) {
                    var r = scan(frames[i], path + '/frame[' + i + ']', depth + 1);
                    if (r)
                        return r;
                }
                return '';
            }
            var p = scan(topWin, 'top', 0);
            if (p)
                return p;
        } catch (_) {}
        return 'frame';
    }
    function __abxBuildContext() {
        var href = '';
        var topHref = '';
        var isTop = false;
        var docKey = '';
        var framePath = '';
        try { href = String(location.href || ''); } catch (_) {}
        try { isTop = window.top === window; } catch (_) { isTop = false; }
        topHref = __abxTryTopHref();
        framePath = __abxTryFramePath();
        try { docKey = String((performance && performance.timeOrigin) || ''); } catch (_) { docKey = ''; }
        var cleanHref = __abxTrimUrlForContext(href);
        var id = (isTop ? 'top' : 'frame') + '|' + cleanHref + '|' + String(docKey || '');
        return {
            contextId: id,
            framePath: framePath,
            href: href,
            topHref: topHref,
            isTop: isTop ? 1 : 0,
            docKey: docKey
        };
    }
    function __abxGetGameSignals() {
        var out = {
            hasThemeZone: 0,
            hasProcessStatus: 0,
            hasProcessBar: 0,
            hasBeadRoad: 0,
            hasBetBox: 0,
            hasGameMain: 0,
            hasZoneBet: 0,
            hasCocos: 0,
            canvasCount: 0,
            visibleRect: '',
            score: 0,
            confidence: 'none',
            signals: ''
        };
        try { out.hasThemeZone = document.querySelector('#themeZone.game, #themeZone.game\\.baccarat_normal, #themeZone') ? 1 : 0; } catch (_) {}
        try { out.hasProcessStatus = document.querySelector('#processStatus, #processBar.info_status p#processStatus') ? 1 : 0; } catch (_) {}
        try { out.hasProcessBar = document.querySelector('#processBar, .info_status') ? 1 : 0; } catch (_) {}
        try { out.hasBeadRoad = document.querySelector('#beadBPRoad, .road_bead, .road_grid') ? 1 : 0; } catch (_) {}
        try { out.hasBetBox = document.querySelector('#betBoxPlayer, #betBoxBanker, #betBoxTie, [id*=betBox], .zone_bet_bottom') ? 1 : 0; } catch (_) {}
        try { out.hasGameMain = document.querySelector('.game_main, #themeZone .game_main') ? 1 : 0; } catch (_) {}
        try { out.hasZoneBet = document.querySelector('.zone_bet, .zone_bet_bottom, .zone_bet_top') ? 1 : 0; } catch (_) {}
        try { out.hasCocos = __cw_hasCocos() ? 1 : 0; } catch (_) {}
        try { out.canvasCount = document.querySelectorAll('canvas').length || 0; } catch (_) {}
        try {
            var main = document.querySelector('#themeZone, .game_main, body');
            var r = main && main.getBoundingClientRect ? main.getBoundingClientRect() : null;
            if (r)
                out.visibleRect = Math.round(r.width || 0) + 'x' + Math.round(r.height || 0) + '@' + Math.round(r.left || 0) + ',' + Math.round(r.top || 0);
        } catch (_) {}
        var score = 0;
        var sig = [];
        function add(flag, name, pts) {
            if (flag) {
                score += pts;
                sig.push(name);
            }
        }
        add(out.hasBeadRoad, 'road', 1000);
        add(out.hasBetBox, 'bet', 1000);
        add(out.hasProcessStatus, 'status', 700);
        add(out.hasProcessBar, 'bar', 700);
        add(out.hasGameMain, 'gameMain', 500);
        add(out.hasZoneBet, 'zoneBet', 500);
        add(out.hasThemeZone, 'theme', 350);
        add(out.hasCocos, 'cocos', 300);
        if (out.canvasCount > 0) {
            score += Math.min(500, out.canvasCount * 120);
            sig.push('canvas' + out.canvasCount);
        }
        try {
            var h = String(location.href || '');
            if (/about:blank/i.test(h))
                score -= 2000;
            if (/singleBacTable\.jsp/i.test(h))
                score += 300;
            if (/gamehall\.jsp/i.test(h))
                score += 80;
        } catch (_) {}
        out.score = score;
        out.signals = sig.join(',');
        out.confidence = score >= 2500 ? 'strong' : (score >= 1200 ? 'probable' : (score >= 400 ? 'weak' : 'none'));
        return out;
    }
    function __abxPost(obj) {
        try {
            if (window.chrome && window.chrome.webview && typeof window.chrome.webview.postMessage === 'function') {
                window.chrome.webview.postMessage(JSON.stringify(obj));
                return true;
            }
        } catch (_) {}
        try {
            if (window.parent && window.parent !== window && typeof window.parent.postMessage === 'function') {
                window.parent.postMessage(obj, '*');
                return true;
            }
        } catch (_) {}
        return false;
    }
    function __abxBuildFrameScout() {
        var ctx = __abxBuildContext();
        var sig = __abxGetGameSignals();
        return {
            abx: 'frame_scout',
            contextId: ctx.contextId,
            framePath: ctx.framePath,
            href: ctx.href,
            topHref: ctx.topHref,
            isTop: ctx.isTop ? 1 : 0,
            docKey: ctx.docKey,
            score: sig.score,
            confidence: sig.confidence,
            signals: sig.signals,
            hasThemeZone: sig.hasThemeZone,
            hasProcessStatus: sig.hasProcessStatus,
            hasProcessBar: sig.hasProcessBar,
            hasBeadRoad: sig.hasBeadRoad,
            hasBetBox: sig.hasBetBox,
            hasGameMain: sig.hasGameMain,
            hasZoneBet: sig.hasZoneBet,
            hasCocos: sig.hasCocos,
            canvasCount: sig.canvasCount,
            visibleRect: sig.visibleRect,
            ts: Date.now()
        };
    }
    function __abxPostFrameScout(reason) {
        try {
            var s = __abxBuildFrameScout();
            s.reason = String(reason || '');
            __abxPost(s);
            return s;
        } catch (_) {
            return null;
        }
    }
    function __abxStartScoutLoop() {
        try {
            if (window.__abx_scout_started)
                return;
            window.__abx_scout_started = 1;
            var n = 0;
            var lastKey = '';
            function once(reason) {
                var s = __abxPostFrameScout(reason);
                if (!s)
                    return;
                lastKey = String(s.contextId || '') + '|' + String(s.score || 0) + '|' + String(s.signals || '');
            }
            once('load');
            var tid = setInterval(function () {
                try {
                    n++;
                    var s = __abxBuildFrameScout();
                    var key = String(s.contextId || '') + '|' + String(s.score || 0) + '|' + String(s.signals || '');
                    if (key !== lastKey || n <= 8 || n % 10 === 0) {
                        s.reason = 'loop';
                        __abxPost(s);
                        lastKey = key;
                    }
                    if (n >= 40)
                        clearInterval(tid);
                } catch (_) {}
            }, 500);
        } catch (_) {}
    }
    function __abxIsAuthorityContext() {
        try {
            if (window.__abx_authority_required !== 1 && window.__abx_authority_required !== true)
                return true;
            var ctx = __abxBuildContext();
            return !!window.__abx_authority_token &&
                String(window.__abx_authority_context_id || '') === String(ctx.contextId || '');
        } catch (_) {
            return false;
        }
    }
    window.__abxStartAuthority = function (token, contextId, tickMs) {
        try {
            var ctx = __abxBuildContext();
            window.__abx_authority_required = 1;
            if (String(contextId || '') !== String(ctx.contextId || '')) {
                try {
                    var wrongRoot = document.getElementById(CW_ROOT_ID);
                    if (wrongRoot) {
                        wrongRoot.setAttribute('data-abx-authority-context', '0');
                        wrongRoot.style.setProperty('display', 'none', 'important');
                        wrongRoot.style.setProperty('visibility', 'hidden', 'important');
                    }
                } catch (_) {}
                try { if (window.__cw_stopPush) window.__cw_stopPush(); } catch (_) {}
                return 'skip:not-authority';
            }
            window.__abx_authority_token = String(token || '');
            window.__abx_authority_context_id = String(contextId || '');
            window.__abx_force_push_start = 1;
            try {
                var okRoot = document.getElementById(CW_ROOT_ID);
                if (okRoot) {
                    okRoot.setAttribute('data-abx-authority-context', '1');
                    okRoot.removeAttribute('data-abx-hidden-by-authority');
                    okRoot.style.setProperty('display', 'block', 'important');
                    okRoot.style.setProperty('visibility', 'visible', 'important');
                }
            } catch (_) {}
            __abxPost({
                abx: 'authority_started',
                contextId: ctx.contextId,
                framePath: ctx.framePath,
                href: ctx.href,
                token: String(token || ''),
                ts: Date.now()
            });
            if (window.__cw_startPush)
                return window.__cw_startPush(tickMs || window.__abx_push_ms || 360);
            return 'pending:no-startPush';
        } catch (e) {
            return 'fail:' + String(e && e.message || e);
        }
    };
    window.__abxStopAuthority = function (reason) {
        try {
            window.__abx_authority_required = 1;
            window.__abx_authority_token = '';
            window.__abx_authority_context_id = '';
            if (window.__cw_stopPush)
                window.__cw_stopPush();
            __abxPostFrameScout('authority-stop:' + String(reason || ''));
            return 'stopped';
        } catch (_) {
            return 'fail';
        }
    };

    function __cw_boot() {
    try {
        cwDbg('BOOT', 'cw boot start', {
            href: String(location.href || ''),
            top: __cw_isTopDocument() ? 1 : 0,
            hasCocos: __cw_hasCocos() ? 1 : 0
        }, 0, 'boot-start');
        brInstallLayoutDiagHooks();
    } catch (_) {}
    /* ---------------- utils ---------------- */
    var V2 = (__cw_hasCocos() && cc ? (cc.v2 || cc.Vec2) : null);
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
    function balanceOf(raw) {
        if (raw == null)
            return null;
        var s = String(raw).trim().toUpperCase();
        if (!s)
            return null;
        s = s.replace(/[₫$€£¥]/g, '').replace(/\s+/g, '');
        if (/[KMB]$/.test(s))
            return moneyOf(s);
        if (/^\d+\.\d{1,2}$/.test(s)) {
            var vd = parseFloat(s);
            return isFinite(vd) ? vd : null;
        }
        if (/^\d+,\d{1,2}$/.test(s)) {
            var vc = parseFloat(s.replace(',', '.'));
            return isFinite(vc) ? vc : null;
        }
        if (/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(s)) {
            var vus = parseFloat(s.replace(/,/g, ''));
            return isFinite(vus) ? vus : null;
        }
        if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(s)) {
            var veu = parseFloat(s.replace(/\./g, '').replace(',', '.'));
            return isFinite(veu) ? veu : null;
        }
        return moneyOf(s);
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
    try {
        if (typeof window.__cw_debug_seq === 'undefined')
            window.__cw_debug_seq = 0;
        if (typeof window.__cw_debug_seq_detail === 'undefined')
            window.__cw_debug_seq_detail = 0;
        // Mặc định tắt log push để giảm tải bridge; bật tay khi cần debug.
        if (typeof window.__cw_debug_seq_push === 'undefined')
            window.__cw_debug_seq_push = 0;
        // Mặc định tắt ghi log JS về host/file để tránh nghẽn I/O + bridge.
        if (typeof window.__cw_file_log_enable === 'undefined')
            window.__cw_file_log_enable = 0;
        if (typeof window.__cw_file_log_push_only === 'undefined')
            window.__cw_file_log_push_only = 0;
        if (typeof window.__cw_file_log_flush_ms === 'undefined')
            window.__cw_file_log_flush_ms = 350;
        if (typeof window.__cw_file_log_batch_size === 'undefined')
            window.__cw_file_log_batch_size = 60;
        if (typeof window.__cw_file_log_max_queue === 'undefined')
            window.__cw_file_log_max_queue = 1600;
        // Mặc định không spam console, log sẽ đi file qua host.
        if (typeof window.__cw_debug_seq_console === 'undefined')
            window.__cw_debug_seq_console = 0;
        if (typeof window.__cw_debug_bet === 'undefined')
            window.__cw_debug_bet = 0;
        if (typeof window.__cw_last_bet_touch_at === 'undefined')
            window.__cw_last_bet_touch_at = 0;
    } catch (_) {}
    var _cwDbgBuf = [];
    var _cwDbgLast = Object.create(null);
    var _cwFileLogQueue = [];
    var _cwFileLogTimer = 0;
    var _cwFileLogDropped = 0;
    var _cwSeqDiagState = {
        lastNoBoard: null,
        lastSourcePick: null,
        lastParserError: null
    };
    function cwShort(s, n) {
        s = String(s == null ? '' : s);
        n = Number(n || 90);
        if (s.length <= n)
            return s;
        return s.slice(0, n) + '...';
    }
    function brHrefShort(href) {
        var s = String(href || '');
        if (!s)
            return '';
        var m = s.match(/https?:\/\/[^/]+(\/[^?#]*)?/i);
        return m ? String(m[0] || '') : cwShort(s, 120);
    }
    function brContextSummary(contexts, limit) {
        var out = [];
        contexts = contexts || [];
        limit = Number(limit || 8);
        for (var i = 0; i < contexts.length && i < limit; i++) {
            var ctx = contexts[i] || {};
            out.push({
                source: String(ctx.source || ''),
                href: brHrefShort(ctx.href || ''),
                score: Number(ctx.score || 0),
                rowCount: (ctx.rows && ctx.rows.length) ? ctx.rows.length : 0,
                offX: Number(ctx.offX || 0),
                offY: Number(ctx.offY || 0)
            });
        }
        return out;
    }
    function brProfileSummary(profiles) {
        var out = [];
        profiles = profiles || [];
        for (var i = 0; i < profiles.length; i++) {
            var p = profiles[i] || {};
            out.push({
                idx: Number(p.idx || 0),
                markerCount: Number(p.markerCount || 0),
                boardFound: p.boardFound ? 1 : 0,
                boardScore: p.board && p.board.score != null ? Number(p.board.score) : 0,
                reason: String(p.reason || '')
            });
        }
        return out;
    }
    function cwSafeDataForHost(data) {
        try {
            if (data == null)
                return null;
            return JSON.parse(JSON.stringify(data));
        } catch (_) {
            try {
                return {
                    text: cwShort(String(data), 600)
                };
            } catch (_) {
                return null;
            }
        }
    }
    function cwHostPost(payload) {
        try {
            var s = JSON.stringify(payload);
            if (window.chrome && window.chrome.webview && typeof window.chrome.webview.postMessage === 'function') {
                window.chrome.webview.postMessage(s);
                return true;
            }
            if (window.parent && window.parent !== window && typeof window.parent.postMessage === 'function') {
                window.parent.postMessage(payload, '*');
                return true;
            }
        } catch (_) {}
        return false;
    }
    function cwQueueHostLog(rec, isPushTag) {
        try {
            var fileOn = (window.__cw_file_log_enable === 1 || window.__cw_file_log_enable === true);
            if (!fileOn)
                return;
            var pushOnly = (window.__cw_file_log_push_only === 1 || window.__cw_file_log_push_only === true);
            if (pushOnly && !isPushTag)
                return;

            var maxQ = Number(window.__cw_file_log_max_queue || 1600);
            if (_cwFileLogQueue.length >= maxQ) {
                _cwFileLogQueue.shift();
                _cwFileLogDropped++;
            }
            _cwFileLogQueue.push({
                ts: Number(rec.ts || Date.now()),
                tag: String(rec.tag || ''),
                msg: String(rec.msg || ''),
                data: cwSafeDataForHost(rec.data)
            });

            if (!_cwFileLogTimer) {
                var delay = Number(window.__cw_file_log_flush_ms || 350);
                if (!(delay > 0))
                    delay = 350;
                _cwFileLogTimer = setTimeout(function () {
                    _cwFileLogTimer = 0;
                    cwFlushHostLogs();
                }, delay);
            }
        } catch (_) {}
    }
    function cwFlushHostLogs() {
        try {
            if (!_cwFileLogQueue.length && !_cwFileLogDropped)
                return;
            var batchSize = Number(window.__cw_file_log_batch_size || 60);
            if (!(batchSize > 0))
                batchSize = 60;
            var sent = 0;
            while (_cwFileLogQueue.length > 0 && sent < 6) {
                var items = _cwFileLogQueue.splice(0, batchSize);
                var payload = {
                    abx: 'cwLogBatch',
                    ts: Date.now(),
                    session: (typeof _cwTickSessionId !== 'undefined' ? String(_cwTickSessionId || '') : ''),
                    rev: (typeof _cwSeqScriptRev !== 'undefined' ? String(_cwSeqScriptRev || '') : ''),
                    dropped: _cwFileLogDropped,
                    items: items
                };
                if (!cwHostPost(payload)) {
                    // host chưa sẵn sàng -> trả lại queue để flush lần sau
                    _cwFileLogQueue = items.concat(_cwFileLogQueue);
                    return;
                }
                _cwFileLogDropped = 0;
                sent++;
            }
            if (_cwFileLogQueue.length > 0 && !_cwFileLogTimer) {
                _cwFileLogTimer = setTimeout(function () {
                    _cwFileLogTimer = 0;
                    cwFlushHostLogs();
                }, Number(window.__cw_file_log_flush_ms || 350));
            }
        } catch (_) {}
    }
    function cwDbg(tag, msg, data, throttleMs, key) {
        try {
            var seqOn = (window.__cw_debug_seq === 1 || window.__cw_debug_seq === true);
            var pushOn = (window.__cw_debug_seq_push === 1 || window.__cw_debug_seq_push === true);
            var t = String(tag || '').toUpperCase();
            var isPushTag = (t === 'SEQPUSH' || t === 'PUSH' || t === 'POST');
            if (!seqOn && !(pushOn && isPushTag))
                return;
            var now = Date.now();
            var k = String(key || (tag + '|' + msg));
            var wait = Number(throttleMs || 0);
            var last = _cwDbgLast[k] || 0;
            if (wait > 0 && (now - last) < wait)
                return;
            _cwDbgLast[k] = now;
            var rec = {
                ts: now,
                tag: String(tag || ''),
                msg: String(msg || ''),
                data: data || null
            };
            _cwDbgBuf.push(rec);
            if (_cwDbgBuf.length > 600)
                _cwDbgBuf.shift();
            cwQueueHostLog(rec, isPushTag);
            try {
                var consoleOn = (window.__cw_debug_seq_console === 1 || window.__cw_debug_seq_console === true);
                if (consoleOn) {
                    if (data != null)
                        console.log('[CWDBG][' + rec.tag + '] ' + rec.msg, data);
                    else
                        console.log('[CWDBG][' + rec.tag + '] ' + rec.msg);
                }
            } catch (_) {}
        } catch (_) {}
    }
    function cwBetDbg() {
        try {
            if (!(window.__cw_debug_bet === 1 || window.__cw_debug_bet === true))
                return;
            console.log.apply(console, arguments);
        } catch (_) {}
    }
    try {
        window.__cw_get_debug_seq_logs = function () {
            return _cwDbgBuf.slice();
        };
        window.__cw_clear_debug_seq_logs = function () {
            _cwDbgBuf = [];
            _cwDbgLast = Object.create(null);
            return 'ok';
        };
        window.__cw_flush_file_logs = function () {
            try {
                cwFlushHostLogs();
                return 'ok';
            } catch (_) {
                return 'err';
            }
        };
        window.__cw_get_seq_diag_state = function () {
            return {
                lastNoBoard: _cwSeqDiagState.lastNoBoard,
                lastSourcePick: _cwSeqDiagState.lastSourcePick,
                lastParserError: _cwSeqDiagState.lastParserError
            };
        };
    } catch (_) {}
    function brSeqDiagEnabled() {
        try {
            if (window.__cw_seq_diag === 0 || window.__cw_seq_diag === false)
                return false;
        } catch (_) {}
        return true;
    }
    function brSeqDiagPost(reason, data, throttleMs, key) {
        try {
            if (!brSeqDiagEnabled())
                return;
            var now = Date.now();
            var k = 'seqdiag|' + String(key || reason || '');
            var wait = Number(throttleMs || 0);
            var last = _cwDbgLast[k] || 0;
            if (wait > 0 && (now - last) < wait)
                return;
            _cwDbgLast[k] = now;
            cwHostPost({
                abx: 'seq_diag',
                ts: now,
                reason: String(reason || ''),
                rev: (typeof _cwSeqScriptRev !== 'undefined' ? String(_cwSeqScriptRev || '') : ''),
                session: (typeof _cwTickSessionId !== 'undefined' ? String(_cwTickSessionId || '') : ''),
                data: cwSafeDataForHost(data)
            });
        } catch (_) {}
    }
    function brClipClassName(cls) {
        try {
            cls = String(cls || '').trim().replace(/\s+/g, '.');
            if (cls.length > 90)
                cls = cls.slice(0, 90);
            return cls;
        } catch (_) {
            return '';
        }
    }
    function brRectLite(el) {
        try {
            if (!el || !el.getBoundingClientRect)
                return null;
            var r = el.getBoundingClientRect();
            if (!(r.width > 0 && r.height > 0))
                return null;
            return {
                x: Math.round(r.left),
                y: Math.round(r.top),
                w: Math.round(r.width),
                h: Math.round(r.height)
            };
        } catch (_) {
            return null;
        }
    }
    function brEltLite(el, extra) {
        try {
            if (!el)
                return null;
            var rect = brRectLite(el);
            if (!rect)
                return null;
            var row = {
                tag: '',
                id: '',
                cls: '',
                x: rect.x,
                y: rect.y,
                w: rect.w,
                h: rect.h
            };
            try { row.tag = String(el.tagName || '').toLowerCase(); } catch (_) {}
            try { row.id = String(el.id || ''); } catch (_) {}
            try { row.cls = brClipClassName(el.className || ''); } catch (_) {}
            if (extra) {
                for (var k in extra) {
                    if (Object.prototype.hasOwnProperty.call(extra, k))
                        row[k] = extra[k];
                }
            }
            return row;
        } catch (_) {
            return null;
        }
    }
    function brCollectLayoutDiag(reason, extra) {
        var out = {
            reason: String(reason || ''),
            href: '',
            path: '',
            top: 0,
            gamePopup: 0,
            hasCocos: 0,
            hasRead: 0,
            hasStart: 0,
            dpr: 1,
            inner: { w: 0, h: 0 },
            client: { w: 0, h: 0 },
            scroll: { x: 0, y: 0 },
            screen: { w: 0, h: 0 },
            vv: null,
            body: null,
            doc: null,
            fixedBars: [],
            iframes: [],
            canvases: []
        };
        try { out.href = String((location && location.href) || ''); } catch (_) {}
        try { out.path = String((location && location.pathname) || ''); } catch (_) {}
        try { out.top = __cw_isTopDocument() ? 1 : 0; } catch (_) {}
        try { out.gamePopup = __cw_isGamePopupPage() ? 1 : 0; } catch (_) {}
        try { out.hasCocos = __cw_hasCocos() ? 1 : 0; } catch (_) {}
        try { out.hasRead = (typeof window.__cw_readSnapshot === 'function') ? 1 : 0; } catch (_) {}
        try { out.hasStart = (typeof window.__cw_startPush === 'function') ? 1 : 0; } catch (_) {}
        try { out.dpr = Number(window.devicePixelRatio || 1) || 1; } catch (_) {}
        try {
            out.inner = {
                w: Math.round(Number(window.innerWidth || 0) || 0),
                h: Math.round(Number(window.innerHeight || 0) || 0)
            };
        } catch (_) {}
        try {
            var de = document.documentElement;
            out.client = {
                w: Math.round(Number((de && de.clientWidth) || 0) || 0),
                h: Math.round(Number((de && de.clientHeight) || 0) || 0)
            };
            out.doc = brEltLite(de);
            out.body = brEltLite(document.body);
        } catch (_) {}
        try {
            out.scroll = {
                x: Math.round(Number(window.scrollX || window.pageXOffset || 0) || 0),
                y: Math.round(Number(window.scrollY || window.pageYOffset || 0) || 0)
            };
        } catch (_) {}
        try {
            out.screen = {
                w: Math.round(Number((window.screen && window.screen.width) || 0) || 0),
                h: Math.round(Number((window.screen && window.screen.height) || 0) || 0)
            };
        } catch (_) {}
        try {
            var vv = window.visualViewport;
            if (vv) {
                out.vv = {
                    w: Math.round(Number(vv.width || 0) || 0),
                    h: Math.round(Number(vv.height || 0) || 0),
                    x: Math.round(Number(vv.offsetLeft || 0) || 0),
                    y: Math.round(Number(vv.offsetTop || 0) || 0),
                    scale: Number(vv.scale || 1) || 1
                };
            }
        } catch (_) {}
        try {
            var bars = [];
            var nodes = Array.from(document.querySelectorAll('body *'));
            for (var i = 0; i < nodes.length && i < 260; i++) {
                var el = nodes[i];
                var rect = brRectLite(el);
                if (!rect)
                    continue;
                var cs = null;
                try { cs = getComputedStyle(el); } catch (_) {}
                if (!cs)
                    continue;
                var pos = String(cs.position || '').toLowerCase();
                if (!(pos === 'fixed' || pos === 'sticky'))
                    continue;
                if (cs.display === 'none' || cs.visibility === 'hidden')
                    continue;
                if (rect.w < Math.max(280, out.inner.w * 0.35))
                    continue;
                if (rect.h < 28)
                    continue;
                var topBand = rect.y <= Math.max(160, out.inner.h * 0.18);
                var bottomBand = (rect.y + rect.h) >= Math.max(0, out.inner.h - Math.max(160, out.inner.h * 0.22));
                if (!topBand && !bottomBand)
                    continue;
                var item = brEltLite(el, {
                    pos: pos,
                    z: String(cs.zIndex || ''),
                    zone: topBand ? 'top' : 'bottom'
                });
                if (item)
                    bars.push(item);
            }
            bars.sort(function (a, b) {
                return ((b && b.w || 0) * (b && b.h || 0)) - ((a && a.w || 0) * (a && a.h || 0));
            });
            out.fixedBars = bars.slice(0, 6);
        } catch (_) {}
        try {
            var frames = Array.from(document.querySelectorAll('iframe,frame'));
            var frameRows = [];
            for (var j = 0; j < frames.length; j++) {
                var f = frames[j];
                var info = brEltLite(f, {
                    src: cwShort(String((f.getAttribute('src') || f.src || '')), 180)
                });
                if (info)
                    frameRows.push(info);
            }
            frameRows.sort(function (a, b) {
                return ((b && b.w || 0) * (b && b.h || 0)) - ((a && a.w || 0) * (a && a.h || 0));
            });
            out.iframes = frameRows.slice(0, 6);
        } catch (_) {}
        try {
            var canvases = Array.from(document.querySelectorAll('canvas'));
            var canvasRows = [];
            for (var k2 = 0; k2 < canvases.length; k2++) {
                var c = canvases[k2];
                var row = brEltLite(c, {
                    widthAttr: Number(c.width || 0) || 0,
                    heightAttr: Number(c.height || 0) || 0
                });
                if (row)
                    canvasRows.push(row);
            }
            canvasRows.sort(function (a, b) {
                return ((b && b.w || 0) * (b && b.h || 0)) - ((a && a.w || 0) * (a && a.h || 0));
            });
            out.canvases = canvasRows.slice(0, 6);
        } catch (_) {}
        if (extra) {
            try { out.extra = cwSafeDataForHost(extra); } catch (_) {}
        }
        return out;
    }
    function brPostLayoutDiag(reason, throttleMs, key, extra) {
        try {
            var payload = brCollectLayoutDiag(reason, extra);
            var suffix = key || reason || 'layout';
            cwDbg('LAYOUT', String(reason || ''), payload, Number(throttleMs || 0), 'layout|' + String(suffix));
            brSeqDiagPost('layout-' + String(reason || ''), payload, Number(throttleMs || 0), 'layout-seq|' + String(suffix));
        } catch (_) {}
    }
    function brInstallLayoutDiagHooks() {
        try {
            if (window.__cw_layout_diag_hooked)
                return;
            window.__cw_layout_diag_hooked = 1;
            brPostLayoutDiag('boot', 0, 'boot|' + String((location && location.href) || ''));
            setTimeout(function () {
                brPostLayoutDiag('settle-1500', 0, 'settle-1500|' + String((location && location.href) || ''));
            }, 1500);
            setTimeout(function () {
                brPostLayoutDiag('settle-4000', 0, 'settle-4000|' + String((location && location.href) || ''));
            }, 4000);
            try {
                window.addEventListener('resize', function () {
                    brPostLayoutDiag('resize', 800, 'resize|' + String((location && location.href) || '') + '|' + Number(window.innerWidth || 0) + 'x' + Number(window.innerHeight || 0));
                }, true);
            } catch (_) {}
            try {
                window.addEventListener('orientationchange', function () {
                    brPostLayoutDiag('orientationchange', 800, 'orientation|' + String((location && location.href) || ''));
                }, true);
            } catch (_) {}
            try {
                document.addEventListener('visibilitychange', function () {
                    brPostLayoutDiag('visibility-' + String(document.visibilityState || ''), 800, 'visibility|' + String((location && location.href) || '') + '|' + String(document.visibilityState || ''));
                }, true);
            } catch (_) {}
        } catch (_) {}
    }
    function cwConsoleArgToHost(arg) {
        try {
            if (arg == null)
                return String(arg);
            if (typeof arg === 'string')
                return arg;
            if (arg instanceof Error)
                return String(arg.stack || arg.message || arg);
            return JSON.stringify(cwSafeDataForHost(arg));
        } catch (_) {
            try { return String(arg); } catch (__) { return '[unprintable]'; }
        }
    }
    function cwInstallConsoleBridge() {
        try {
            if (window.__cw_console_bridge_installed)
                return;
            window.__cw_console_bridge_installed = 1;
            if (typeof window.__cw_console_to_host === 'undefined')
                window.__cw_console_to_host = 1;
            if (typeof window.__cw_console_passthrough === 'undefined')
                window.__cw_console_passthrough = 0;
            if (!window.console)
                window.console = {};
            var levels = ['log', 'warn', 'error', 'info', 'debug'];
            var originals = {};
            for (var i = 0; i < levels.length; i++) {
                (function (level) {
                    var orig = (typeof window.console[level] === 'function')
                        ? window.console[level].bind(window.console)
                        : function () {};
                    originals[level] = orig;
                    window.console[level] = function () {
                        var args = Array.prototype.slice.call(arguments || []);
                        try {
                            var toHost = !(window.__cw_console_to_host === 0 || window.__cw_console_to_host === false);
                            if (toHost) {
                                var msg = args.map(cwConsoleArgToHost).join(' ');
                                cwHostPost({
                                    abx: 'js_console',
                                    ts: Date.now(),
                                    level: level,
                                    message: cwShort(msg, 3000),
                                    rev: (typeof _cwSeqScriptRev !== 'undefined' ? String(_cwSeqScriptRev || '') : ''),
                                    session: (typeof _cwTickSessionId !== 'undefined' ? String(_cwTickSessionId || '') : '')
                                });
                            }
                        } catch (_) {}
                        try {
                            var pass = (window.__cw_console_passthrough === 1 || window.__cw_console_passthrough === true);
                            if (pass)
                                return orig.apply(null, args);
                        } catch (_) {}
                    };
                })(levels[i]);
            }
            window.__cw_console_originals = originals;
        } catch (_) {}
    }
    cwInstallConsoleBridge();
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
            while (t && c < 200) {
                var nm = t.name || '';
                if (String(nm).toLowerCase().indexOf(GAME_PREFAB_KEY) !== -1)
                    return true;
                t = t.parent || t._parent || null;
                c++;
            }
        } catch (e) {}
        try {
            var p = fullPath(n, 200);
            return String(p || '').toLowerCase().indexOf(GAME_PREFAB_KEY) !== -1;
        } catch (e) {
            return false;
        }
    }
    var COUNTDOWN_TAIL_RIGHT = 'node_in_multimode/top/right/xdtl_jackpot_anim_right/lbl_countdown';
    var COUNTDOWN_TAIL_LEFT = 'node_in_multimode/top/left/xdtl_jackpot_anim_left/lbl_countdown';
    function readCountdownSec() {
        var right = null,
        left = null;
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
                    if (pathL.indexOf(COUNTDOWN_TAIL_RIGHT) !== -1) {
                        right = {
                            text: text,
                            tail: path
                        };
                    } else if (pathL.indexOf(COUNTDOWN_TAIL_LEFT) !== -1) {
                        left = {
                            text: text,
                            tail: path
                        };
                    }
                }
            }
        });
        function parseSec(txt) {
            var m = String(txt || '').match(/(\d+)/);
            return m ? parseInt(m[1], 10) : null;
        }
        var secR = right ? parseSec(right.text) : null;
        var secL = left ? parseSec(left.text) : null;
        if (secR != null && secR > 0) {
            S._progTail = right.tail || '';
            S._progIsSec = true;
            window.__cw_prog_tail = S._progTail;
            return secR;
        }
        if (secL != null && secL > 0) {
            S._progTail = left.tail || '';
            S._progIsSec = true;
            window.__cw_prog_tail = S._progTail;
            return secL;
        }
        if (secR != null) {
            S._progTail = right.tail || '';
            S._progIsSec = true;
            window.__cw_prog_tail = S._progTail;
            return secR;
        }
        if (secL != null) {
            S._progTail = left.tail || '';
            S._progIsSec = true;
            window.__cw_prog_tail = S._progTail;
            return secL;
        }
        return null;
    }
    function walkNodes(cb) {
        if (!__cw_hasCocos())
            return;
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
    function domTailOfEl(el) {
        try {
            if (!el) return 'dom';
            var parts = [];
            var cur = el;
            var depth = 0;
            while (cur && cur.nodeType === 1 && depth < 6) {
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
    var _domCtxCache = {
        at: 0,
        ctx: null
    };
    function domTopInnerWidth() {
        return window.innerWidth || 1920;
    }
    function domTopInnerHeight() {
        return window.innerHeight || 1080;
    }
    function domQuickScanDoc(doc, source, offX, offY, limit) {
        var view = (doc && doc.defaultView) || window;
        var innerW = view.innerWidth || 1920;
        var innerH = view.innerHeight || 1080;
        var all = doc.querySelectorAll('button,a,span,div,p,strong,b,label,li,td,h1,h2,h3,h4,h5');
        var out = [];
        var seen = Object.create(null);
        for (var i = 0; i < all.length && i < 5000; i++) {
            var el = all[i];
            if (!domVisible(el))
                continue;
            var txt = domCollapse(el.innerText || el.textContent || '');
            if (domShouldSkipElement(el, txt))
                continue;
            if (!isTextCandidate(txt))
                continue;
            if (domHasEquivalentChildText(el, txt))
                continue;
            var r = el.getBoundingClientRect();
            if (r.width > innerW * 0.75 || r.height > innerH * 0.22)
                continue;
            var key = txt + '|' + Math.round(r.left) + '|' + Math.round(r.top) + '|' + Math.round(r.width) + '|' + Math.round(r.height);
            if (seen[key])
                continue;
            seen[key] = 1;
            out.push({
                idx: out.length + 1,
                text: txt,
                x: Math.round((offX || 0) + r.left),
                y: Math.round((offY || 0) + r.top),
                w: Math.round(r.width),
                h: Math.round(r.height),
                tail: source + ' :: ' + tailOf(el)
            });
        }
        out.sort(function (a, b) {
            return a.y - b.y || a.x - b.x || String(a.text || '').localeCompare(String(b.text || ''));
        });
        return out.slice(0, limit || 200);
    }
    function domCollectTopHudRows(ctx, limit) {
        var out = [];
        try {
            if (!ctx || !ctx.doc)
                return out;
            var view = ctx.win || window;
            var doc = ctx.doc;
            var topBand = Math.max(140, (view.innerHeight || 900) * 0.2);
            var maxX = (view.innerWidth || 1600) * 0.98;
            var all = doc.querySelectorAll('span,div,p,li,a,b,strong,label');
            var seen = Object.create(null);
            for (var i = 0; i < all.length && i < 5000; i++) {
                var el = all[i];
                if (!domVisible(el))
                    continue;
                var txt = domCollapse(el.innerText || el.textContent || '');
                if (!txt || txt.length > 120)
                    continue;
                var n = domNorm(txt);
                if (/(canvas watch|scan200|copylog|clearlog)/.test(n))
                    continue;
                var r = el.getBoundingClientRect();
                if (r.top < 0 || r.top > topBand)
                    continue;
                if (r.left < 0 || r.left > maxX)
                    continue;
                if (r.width > (view.innerWidth || 1600) * 0.8 || r.height > topBand * 0.8)
                    continue;
                var key = txt + '|' + Math.round(r.left) + '|' + Math.round(r.top) + '|' + Math.round(r.width) + '|' + Math.round(r.height);
                if (seen[key])
                    continue;
                seen[key] = 1;
                out.push({
                    source: ctx.source || 'top',
                    href: ctx.href || '',
                    text: txt,
                    txt: txt,
                    x: (ctx.offX || 0) + r.left,
                    y: (ctx.offY || 0) + r.top,
                    w: r.width,
                    h: r.height,
                    tail: (ctx.source || 'top') + ' :: ' + tailOf(el),
                    money: moneyOf(txt)
                });
            }
            out.sort(function (a, b) {
                return a.y - b.y || a.x - b.x || String(a.text || '').localeCompare(String(b.text || ''));
            });
        } catch (_) {}
        return out.slice(0, limit || 200);
    }
    function domScoreRows(rows) {
        var score = Math.min(rows.length, 80);
        var joined = rows.map(function (r) { return domNorm(r.text); }).join(' | ');
        if (/(banker|player|nha cai|tay con|hoa|confirm|reload|no comm|chat)/.test(joined))
            score += 120;
        if (/(b ask|p ask)/.test(joined))
            score += 80;
        if (/(category|truyen thong|xoc dia|roulette|hide|vao choi|live casino|sports|slot game)/.test(joined))
            score -= 90;
        if ((joined.match(/baccarat c\d+/g) || []).length >= 4)
            score -= 40;
        for (var i = 0; i < rows.length; i++) {
            var t = domNorm(rows[i].text);
            if (/(banker|player|nha cai|tay con|hoa)/.test(t))
                score += 12;
            if (/(confirm|reload|no comm)/.test(t))
                score += 8;
            if (/(tai khoan|so du|balance|plyr)/.test(t))
                score += 4;
        }
        return score;
    }
    function domTableContextScore(ctx) {
        try {
            if (!ctx)
                return 0;
            var rows = ctx.rows || [];
            var joined = rows.map(function (r) { return domNorm(r.text); }).join(' | ');
            var href = String(ctx.href || '').toLowerCase();
            var source = String(ctx.source || '');
            var score = Number(ctx.score || 0);
            if (href.indexOf('singlebactable.jsp') !== -1)
                score += 1800;
            if (source === 'top/frame[1]')
                score += 120;
            if (/(processstatus|countdowntime|countdown|xac nhan|no comm|reload|tam dung dat cuoc|dang mo bai|chuc may man)/.test(joined))
                score += 520;
            if (/(banker|player|nha cai|tay con|hoa|chuoi ket qua|tai khoan)/.test(joined))
                score += 260;
            if (/(category|truyen thong|xoc dia|roulette|hide|vao choi|live casino|sports|slot game)/.test(joined))
                score -= 800;
            var cardHits = joined.match(/baccarat c\d+/g) || [];
            if (cardHits.length >= 3)
                score -= 420;
            return score;
        } catch (_) {
            return 0;
        }
    }
    function domChooseLikelyGameContexts(contexts) {
        contexts = contexts || [];
        var ranked = [];
        for (var i = 0; i < contexts.length; i++) {
            var c = contexts[i];
            if (!c)
                continue;
            if (typeof c.score !== 'number')
                c.score = domScoreRows(c.rows || []);
            c.tableScore = domTableContextScore(c);
            ranked.push(c);
        }
        ranked.sort(function (a, b) {
            return (Number(b.tableScore || 0) - Number(a.tableScore || 0))
                || (Number(b.score || 0) - Number(a.score || 0))
                || (((b.rows && b.rows.length) || 0) - ((a.rows && a.rows.length) || 0));
        });
        var strict = ranked.filter(function (c) { return Number(c.tableScore || 0) >= 450; });
        if (strict.length)
            return strict;
        var relaxed = ranked.filter(function (c) {
            return Number(c.tableScore || 0) >= 220 && Number(c.score || 0) >= 40;
        });
        return relaxed.length ? relaxed : ranked;
    }
    function domWalkContexts(rootWin, source, offX, offY, out, seen) {
        try {
            if (!rootWin || seen.indexOf(rootWin) >= 0)
                return;
            seen.push(rootWin);
            var doc = rootWin.document;
            if (doc && doc.documentElement) {
                out.push({
                    source: source,
                    href: String(rootWin.location && rootWin.location.href || ''),
                    win: rootWin,
                    doc: doc,
                    offX: offX || 0,
                    offY: offY || 0,
                    rows: domQuickScanDoc(doc, source, offX || 0, offY || 0, 120)
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
                domWalkContexts(child, source + '/frame[' + i + ']', (offX || 0) + (fr.left || 0), (offY || 0) + (fr.top || 0), out, seen);
            }
        } catch (_) {}
    }
    function domGetSameOriginRoot(win) {
        var cur = win || window;
        try {
            while (cur && cur.parent && cur.parent !== cur) {
                var p = cur.parent;
                try {
                    var d = p.document;
                    if (!d || !d.documentElement)
                        break;
                    cur = p;
                    continue;
                } catch (_) {
                    break;
                }
            }
        } catch (_) {}
        return cur || win || window;
    }
    function domGetContext(force) {
        var now = Date.now();
        if (!force && _domCtxCache.ctx && (now - _domCtxCache.at) < 1200)
            return _domCtxCache.ctx;
        var contexts = [];
        domWalkContexts(window, 'top', 0, 0, contexts, []);
        for (var i = 0; i < contexts.length; i++) {
            contexts[i].score = domScoreRows(contexts[i].rows || []);
        }
        contexts.sort(function (a, b) {
            return (b.score || 0) - (a.score || 0) || ((b.rows && b.rows.length) || 0) - ((a.rows && a.rows.length) || 0);
        });
        var best = contexts[0] || {
            source: 'top',
            href: String(location.href || ''),
            win: window,
            doc: document,
            offX: 0,
            offY: 0,
            rows: [],
            score: 0
        };
        best.innerWidth = (best.win && best.win.innerWidth) || domTopInnerWidth();
        best.innerHeight = (best.win && best.win.innerHeight) || domTopInnerHeight();
        _domCtxCache.at = now;
        _domCtxCache.ctx = best;
        return best;
    }
    function domRectEntry(el, text, tail, ctx) {
        try {
            ctx = ctx || domGetContext();
            var r = el.getBoundingClientRect();
            var x = Math.round((ctx && ctx.offX || 0) + r.left), y = Math.round((ctx && ctx.offY || 0) + r.top), w = Math.round(r.width), h = Math.round(r.height);
            var t = String(tail || domTailOfEl(el) || 'dom');
            var topW = domTopInnerWidth(), topH = domTopInnerHeight();
            return {
                element: el,
                text: String(text == null ? '' : text),
                txt: String(text == null ? '' : text),
                x: x,
                y: y,
                w: w,
                h: h,
                sx: x,
                sy: y,
                sw: w,
                sh: h,
                tail: t,
                tl: t.toLowerCase(),
                fullTail: t,
                fullTl: t.toLowerCase(),
                n: { x: x / topW, y: y / topH, w: w / topW, h: h / topH },
                val: moneyOf(text)
            };
        } catch (_) {
            return null;
        }
    }
    function domShouldSkipElement(el, txt) {
        try {
            if (!el)
                return true;
            if (el.closest && el.closest('#' + CW_ROOT_ID))
                return true;
            var cur = el;
            var depth = 0;
            while (cur && cur.nodeType === 1 && depth < 8) {
                var id = String(cur.id || '').toLowerCase();
                var cls = String(cur.className || '').toLowerCase();
                if (/(loading|popup_loading|loadingframe|loading_con|loading_text|spinner|preload)/.test(id + ' ' + cls))
                    return true;
                cur = cur.parentElement;
                depth++;
            }
            var s = domCollapse(txt || '');
            var norm = domNorm(s);
            if (!s)
                return true;
            if (/^(loading|loading\.\.\.)$/i.test(s))
                return true;
            if (/(canvas watch|scan200money|scan200bet|scan200text|copylog|clearlog)/.test(norm))
                return true;
            return false;
        } catch (_) {
            return false;
        }
    }
    function domHasEquivalentChildText(el, txt) {
        try {
            if (!el || !el.children || !el.children.length)
                return false;
            var me = domCollapse(txt || '');
            if (!me)
                return false;
            for (var i = 0; i < el.children.length; i++) {
                var ch = el.children[i];
                if (!domVisible(ch))
                    continue;
                var childTxt = domCollapse(ch.innerText || ch.textContent || '');
                if (!childTxt)
                    continue;
                if (childTxt === me)
                    return true;
            }
            return false;
        } catch (_) {
            return false;
        }
    }
    function domCollectLabels() {
        var ctx = domGetContext();
        var out = [];
        var seen = {};
        var all = ctx.doc.querySelectorAll('button,a,span,div,p,strong,b,label,li,td,h1,h2,h3,h4,h5');
        for (var i = 0; i < all.length && i < 2200; i++) {
            var el = all[i];
            if (!domVisible(el))
                continue;
            var txt = domCollapse(el.innerText || el.textContent || '');
            if (domShouldSkipElement(el, txt))
                continue;
            if (!txt || txt.length > 120)
                continue;
            if (domHasEquivalentChildText(el, txt))
                continue;
            if (el.childElementCount > 0 && txt.length > 24)
                continue;
            var rect = el.getBoundingClientRect();
            if (rect.width < 6 || rect.height < 6)
                continue;
            if (rect.width > ctx.innerWidth * 0.75 || rect.height > ctx.innerHeight * 0.22)
                continue;
            var key = txt + '|' + Math.round(rect.left) + '|' + Math.round(rect.top) + '|' + Math.round(rect.width) + '|' + Math.round(rect.height);
            if (seen[key])
                continue;
            seen[key] = 1;
            var item = domRectEntry(el, txt, domTailOfEl(el), ctx);
            if (item)
                out.push(item);
        }
        return out;
    }
    function domIsButtonLike(el, txt, cs) {
        try {
            var tag = String(el.tagName || '').toLowerCase();
            var role = String(el.getAttribute && (el.getAttribute('role') || '') || '').toLowerCase();
            var cls = String(el.className || '').toLowerCase();
            var id = String(el.id || '').toLowerCase();
            var styleCursor = String((cs && cs.cursor) || '').toLowerCase();
            var norm = domNorm(txt);
            if (tag === 'button' || tag === 'a')
                return true;
            if (role === 'button' || role === 'tab')
                return true;
            if (el.hasAttribute && (el.hasAttribute('onclick') || el.hasAttribute('data-role')))
                return true;
            if (styleCursor === 'pointer')
                return true;
            if (/(btn|button|chip|bet|tab|confirm|reload|cancel|banker|player)/.test(cls + ' ' + id))
                return true;
            if (/(banker|player|nha cai|tay con|hoa|confirm|reload|ban|chat)/.test(norm))
                return true;
            return false;
        } catch (_) {
            return false;
        }
    }
    function domCollectButtons() {
        var ctx = domGetContext();
        var out = [];
        var seen = {};
        var all = ctx.doc.querySelectorAll('button,a,[role=\"button\"],[role=\"tab\"],input[type=\"button\"],input[type=\"submit\"],div,span');
        for (var i = 0; i < all.length && i < 2400; i++) {
            var el = all[i];
            if (!domVisible(el))
                continue;
            var r = el.getBoundingClientRect();
            if (r.width < 12 || r.height < 10)
                continue;
            var txt = domCollapse(el.innerText || el.textContent || el.value || '');
            var cs = ctx.win.getComputedStyle(el);
            if (!domIsButtonLike(el, txt, cs))
                continue;
            var key = Math.round(r.left) + '|' + Math.round(r.top) + '|' + Math.round(r.width) + '|' + Math.round(r.height);
            if (seen[key])
                continue;
            seen[key] = 1;
            var item = domRectEntry(el, txt, domTailOfEl(el), ctx);
            if (item)
                out.push(item);
        }
        return out;
    }
    function collectLabels() {
        if (!__cw_hasCocos())
            return domCollectLabels();
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
        if (!__cw_hasCocos())
            return domCollectButtons();
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
        if (!__cw_hasCocos()) {
            var domCountdown = domReadBetCountdown();
            if (domCountdown && domCountdown.value != null) {
                S._progIsSec = true;
                S._progTail = domCountdown.tail || 'body/div#themeZone.game.scenes_default.baccarat_normal/div#countdown.icon_progress.progress_countdown/dl.progress_no/dd#countdownTime/p';
                try { window.__cw_prog_tail = S._progTail; } catch (_) {}
                return domCountdown.value;
            }
            var domCards = domScanBaccaratCards();
            var domActive = domPickActiveCard(domCards);
            if (domActive && domActive.countdown != null) {
                S._progIsSec = true;
                S._progTail = 'dom/baccarat/countdown';
                try { window.__cw_prog_tail = S._progTail; } catch (_) {}
                return domActive.countdown;
            }
            S._progTail = 'dom/baccarat';
            try { window.__cw_prog_tail = S._progTail; } catch (_) {}
            return null;
        }
        var cd = readCountdownSec();
        if (cd != null)
            return cd;
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

    var _domBaccaratCache = {
        at: 0,
        cards: []
    };

    function domCollapse(s) {
        return String(s || '').replace(/\s+/g, ' ').trim();
    }
    function domNorm(s) {
        try {
            return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        } catch (_) {
            return String(s || '').toLowerCase();
        }
    }
    function domVisible(el) {
        try {
            if (!el) return false;
            var r = el.getBoundingClientRect();
            if (!r || r.width < 6 || r.height < 6) return false;
            var view = (el.ownerDocument && el.ownerDocument.defaultView) || window;
            var cs = view.getComputedStyle(el);
            return cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0';
        } catch (_) {
            return false;
        }
    }
    function domParseRgb(s) {
        if (!s) return null;
        var m = String(s).match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
        if (m) return { r: +m[1], g: +m[2], b: +m[3] };
        m = String(s).match(/^#([0-9a-f]{6})$/i);
        if (m) {
            var hex = m[1];
            return {
                r: parseInt(hex.slice(0, 2), 16),
                g: parseInt(hex.slice(2, 4), 16),
                b: parseInt(hex.slice(4, 6), 16)
            };
        }
        return null;
    }
    function domSideFromColorList(list) {
        for (var i = 0; i < list.length; i++) {
            var rgb = domParseRgb(list[i]);
            if (!rgb) continue;
            if (rgb.r >= 150 && rgb.r > rgb.b * 1.15 && rgb.r > rgb.g * 1.05) return 'B';
            if (rgb.b >= 140 && rgb.b > rgb.r * 1.08 && rgb.b > rgb.g * 0.9) return 'P';
        }
        return '';
    }
    function domFindCardRoot(el, ctxOverride) {
        var ctx = ctxOverride || domGetContext();
        var innerW = Number((ctx && ctx.innerWidth) || (ctx && ctx.win && ctx.win.innerWidth) || domTopInnerWidth() || 1600);
        var innerH = Number((ctx && ctx.innerHeight) || (ctx && ctx.win && ctx.win.innerHeight) || domTopInnerHeight() || 900);
        var cur = el;
        var depth = 0;
        var best = null;
        while (cur && cur !== ctx.doc.body && depth < 8) {
            try {
                var r = cur.getBoundingClientRect();
                if (r.width >= 220 && r.height >= 120 && r.width <= innerW * 0.7 && r.height <= innerH * 0.75)
                    best = cur;
                if (r.width > innerW * 0.8 || r.height > innerH * 0.8)
                    break;
            } catch (_) { }
            cur = cur.parentElement;
            depth++;
        }
        return best;
    }
    function domExtractTexts(root) {
        var out = [];
        var seen = {};
        if (!root) return out;
        var all = root.querySelectorAll('*');
        for (var i = 0; i < all.length && i < 500; i++) {
            var el = all[i];
            if (!domVisible(el)) continue;
            if (el.children && el.children.length > 0 && el.childElementCount > 3) continue;
            var txt = domCollapse(el.innerText || el.textContent || '');
            if (!txt || txt.length > 80) continue;
            var key = txt + '|' + Math.round(el.getBoundingClientRect().left) + '|' + Math.round(el.getBoundingClientRect().top);
            if (seen[key]) continue;
            seen[key] = 1;
            out.push({
                text: txt,
                rect: el.getBoundingClientRect()
            });
        }
        return out;
    }
    function domFindTaggedNumber(texts, tag) {
        var rx = new RegExp('(?:^|\\b)' + tag + '\\s*[:=]?\\s*(\\d{1,3})(?=\\b)', 'i');
        for (var i = 0; i < texts.length; i++) {
            var m = texts[i].text.match(rx);
            if (m) return parseInt(m[1], 10);
        }
        return null;
    }
    function domFindMoney(texts) {
        var best = null;
        for (var i = 0; i < texts.length; i++) {
            var txt = texts[i].text;
            if (!/[$€£¥₫]|^\d[\d,.\s]+$/.test(txt)) continue;
            var val = moneyOf(txt.replace(/[^\dKMB.,]/ig, ''));
            if (val == null || val < 100) continue;
            if (best == null || val > best) best = val;
        }
        return best;
    }
    function domFindCountdown(texts, cardRect) {
        for (var i = 0; i < texts.length; i++) {
            var txt = texts[i].text;
            if (!/^\d{1,2}$/.test(txt)) continue;
            var n = parseInt(txt, 10);
            var r = texts[i].rect;
            if (n >= 0 && n <= 99 && r.top <= cardRect.top + cardRect.height * 0.22)
                return n;
        }
        return null;
    }
    function domBuildRoad(cardRoot, cardRect) {
        var nodes = cardRoot.querySelectorAll('*');
        var cells = [];
        var seen = {};
        for (var i = 0; i < nodes.length && i < 800; i++) {
            var el = nodes[i];
            if (!domVisible(el)) continue;
            var r = el.getBoundingClientRect();
            if (r.width < 7 || r.height < 7 || r.width > 24 || r.height > 24) continue;
            if (r.left < cardRect.left + cardRect.width * 0.15 || r.left > cardRect.right - 10) continue;
            if (r.top < cardRect.top + cardRect.height * 0.08 || r.top > cardRect.bottom - 10) continue;
            var view = (el.ownerDocument && el.ownerDocument.defaultView) || window;
            var cs = view.getComputedStyle(el);
            var side = domSideFromColorList([
                cs.color,
                cs.backgroundColor,
                cs.borderColor,
                cs.outlineColor,
                el.getAttribute ? el.getAttribute('fill') : '',
                el.getAttribute ? el.getAttribute('stroke') : ''
            ]);
            if (side !== 'B' && side !== 'P') continue;
            var key = Math.round(r.left / 6) + '|' + Math.round(r.top / 6) + '|' + side;
            if (seen[key]) continue;
            seen[key] = 1;
            cells.push({
                v: side,
                x: r.left,
                y: r.top,
                w: r.width,
                h: r.height,
                tail: 'dom-road',
                fullTail: 'dom-road'
            });
        }
        cells.sort(function (a, b) { return a.x - b.x || a.y - b.y; });
        var cols = [];
        for (var j = 0; j < cells.length; j++) {
            var cell = cells[j];
            var col = null;
            for (var k = 0; k < cols.length; k++) {
                if (Math.abs(cols[k].cx - cell.x) <= 10) { col = cols[k]; break; }
            }
            if (!col) {
                col = { cx: cell.x, items: [] };
                cols.push(col);
            }
            col.items.push(cell);
        }
        cols.sort(function (a, b) { return a.cx - b.cx; });
        var parts = [];
        for (var c = 0; c < cols.length; c++) {
            cols[c].items.sort(function (a, b) { return a.y - b.y; });
            parts.push(cols[c].items.map(function (it) { return it.v; }).join(''));
        }
        return {
            seq: limitSeq52(parts.join('')),
            which: 'dom-baccarat',
            cols: cols,
            cells: cells
        };
    }
    function domParseCard(cardRoot, titleText) {
        if (!cardRoot) return null;
        var rect = cardRoot.getBoundingClientRect();
        var texts = domExtractTexts(cardRoot);
        var road = domBuildRoad(cardRoot, rect);
        var countB = domFindTaggedNumber(texts, 'B');
        var countP = domFindTaggedNumber(texts, 'P');
        var countT = domFindTaggedNumber(texts, 'T');
        var roadSeq = road.seq;
        var countGuard = brBuildSeqCountGuardFromValues(countB, countP, countT, domCollapse(titleText || ''));
        if (countGuard) {
            var guardedRoad = brApplySeqCountGuard(roadSeq, countGuard, 'card-road');
            if (guardedRoad.changed)
                roadSeq = guardedRoad.seq;
        }
        return {
            root: cardRoot,
            title: domCollapse(titleText || ''),
            rect: rect,
            texts: texts,
            B: countB,
            P: countP,
            T: countT,
            amount: domFindMoney(texts),
            countdown: domFindCountdown(texts, rect),
            seq: roadSeq,
            cols: road.cols,
            cells: road.cells
        };
    }
    function domScanBaccaratCards(force) {
        var now = Date.now();
        if (!force && _domBaccaratCache.cards.length && now - _domBaccaratCache.at < 1200)
            return _domBaccaratCache.cards;
        var contexts = [];
        domWalkContexts(window, 'top', 0, 0, contexts, []);
        var pickContexts = domChooseLikelyGameContexts(contexts).slice(0, 4);
        var roots = [];
        var seenRoot = [];
        var ctxCardCount = Object.create(null);
        for (var ci = 0; ci < pickContexts.length; ci++) {
            var ctx = pickContexts[ci];
            if (!ctx || !ctx.doc)
                continue;
            var candidates = [];
            try {
                candidates = ctx.doc.querySelectorAll('div,span,a,strong,b,h1,h2,h3,h4,p');
            } catch (_) {
                candidates = [];
            }
            var ctxW = (ctx.win && ctx.win.innerWidth) || domTopInnerWidth();
            var ctxH = (ctx.win && ctx.win.innerHeight) || domTopInnerHeight();
            for (var i = 0; i < candidates.length && i < 1400; i++) {
                var el = candidates[i];
                if (!domVisible(el))
                    continue;
                var txt = domCollapse(el.innerText || el.textContent || '');
                var m = txt.match(/\bBaccarat\s*[A-Z0-9]+\b/i);
                if (!m)
                    continue;
                var root = domFindCardRoot(el, {
                    doc: ctx.doc,
                    innerWidth: ctxW,
                    innerHeight: ctxH,
                    win: ctx.win
                });
                if (!root)
                    continue;
                if (seenRoot.indexOf(root) >= 0)
                    continue;
                var rr = root.getBoundingClientRect();
                if (!rr || rr.width < 180 || rr.height < 90)
                    continue;
                if (rr.right < 0 || rr.bottom < 0 || rr.left > ctxW || rr.top > ctxH)
                    continue;
                if (rr.width > ctxW * 0.95 || rr.height > ctxH * 0.95)
                    continue;
                seenRoot.push(root);
                var parsed = domParseCard(root, m[0]);
                if (!parsed)
                    continue;
                parsed._ctxSource = String(ctx.source || 'top');
                parsed._ctxHref = String(ctx.href || '');
                parsed._ctxScore = Number(ctx.score || 0);
                parsed._ctxTableScore = Number(ctx.tableScore || 0);
                parsed._ctxKey = parsed._ctxSource + '|' + parsed._ctxHref;
                ctxCardCount[parsed._ctxKey] = Number(ctxCardCount[parsed._ctxKey] || 0) + 1;
                roots.push(parsed);
            }
        }
        for (var ri = 0; ri < roots.length; ri++) {
            var card = roots[ri];
            var area = Math.max(1, Math.round((card.rect && card.rect.width || 0) * (card.rect && card.rect.height || 0)));
            card._ctxCardCount = Number(ctxCardCount[card._ctxKey] || 0);
            card._pickScore = 0;
            card._pickScore += Number(card._ctxTableScore || 0);
            if (String(card._ctxHref || '').toLowerCase().indexOf('singlebactable.jsp') !== -1)
                card._pickScore += 900;
            if (card.countdown != null)
                card._pickScore += 280;
            card._pickScore += Math.min(200, String(card.seq || '').length * 8);
            card._pickScore += Math.min(240, Math.round(area / 5000));
            if (card._ctxCardCount >= 4)
                card._pickScore -= 260;
        }
        roots = roots.filter(function (x) { return !!x; }).sort(function (a, b) {
            return (Number(b._pickScore || 0) - Number(a._pickScore || 0))
                || (a.rect.top - b.rect.top)
                || (a.rect.left - b.rect.left);
        });
        _domBaccaratCache.at = now;
        _domBaccaratCache.cards = roots;
        return roots;
    }
    function domPickActiveCard(cards) {
        cards = cards || domScanBaccaratCards();
        if (!cards || !cards.length)
            return null;
        var strict = cards.filter(function (c) { return Number(c._ctxTableScore || 0) >= 450; });
        var pool = strict.length ? strict : cards;
        var pick = pool[0];
        var pickScore = Number((pick && pick._pickScore) || 0);
        for (var i = 0; i < pool.length; i++) {
            var c = pool[i];
            var score = Number(c && c._pickScore || 0);
            if (c && c.countdown != null && pick && pick.countdown == null)
                return c;
            if (score > pickScore) {
                pick = c;
                pickScore = score;
            } else if (score === pickScore && String(c.seq || '').length > String(pick.seq || '').length) {
                pick = c;
                pickScore = score;
            }
        }
        return pick || cards[0];
    }
    var _domBetStakeCache = {
        at: 0,
        data: null
    };
    var _domBetCtxCache = {
        at: 0,
        contexts: []
    };
    var _domHudCache = {
        at: 0,
        data: null
    };
    function domExtractMoneyTokens(text) {
        var out = [];
        var s = String(text || '').replace(/\u00A0/g, ' ');
        if (!s)
            return out;
        var re = /\d+(?:[.,]\d+)?\s*[KMB]\b|\d{1,3}(?:[.,\s]\d{3})+|\d{4,9}/ig;
        var m;
        while ((m = re.exec(s)) !== null) {
            var tok = String(m[0] || '').trim();
            if (!tok)
                continue;
            var idx = Number(m.index || 0);
            var prev = idx > 0 ? s.charAt(idx - 1) : '';
            var next = s.charAt(idx + tok.length);
            // Loại odds kiểu "1:1" để không nhầm thành tiền.
            if (prev === ':' || next === ':')
                continue;
            var val = moneyOf(tok);
            if (!(val > 0))
                continue;
            if (val < 1000)
                continue;
            out.push({
                token: tok,
                value: val,
                hasUnit: /[KMB]\b/i.test(tok)
            });
        }
        return out;
    }
    function domResolveBetSideFromHost(host, textFallback) {
        var side = domBetSideOfText(textFallback || domTextOf(host));
        if (side)
            return side;
        if (!host || !host.querySelectorAll)
            return null;
        var nodes = [];
        try {
            nodes = host.querySelectorAll('span,p,div,b,strong,label,small');
        } catch (_) {
            nodes = [];
        }
        for (var i = 0; i < nodes.length && i < 48; i++) {
            var el = nodes[i];
            if (!el || !domVisible(el))
                continue;
            var txt = domTextOf(el);
            if (!txt || txt.length > 40)
                continue;
            side = domBetSideOfText(txt);
            if (side)
                return side;
        }
        return null;
    }
    function domExtractStakeFromHost(host) {
        if (!host)
            return {
                value: null,
                token: null
            };
        var tokens = domExtractMoneyTokens(domTextOf(host));
        if (!tokens.length && host.querySelectorAll) {
            var leaves = [];
            try {
                leaves = host.querySelectorAll('span,p,div,small,b,strong,label');
            } catch (_) {
                leaves = [];
            }
            for (var i = 0; i < leaves.length && i < 80; i++) {
                var el = leaves[i];
                if (!el || !domVisible(el))
                    continue;
                var txt = domTextOf(el);
                if (!txt || txt.length > 32)
                    continue;
                var add = domExtractMoneyTokens(txt);
                for (var j = 0; j < add.length; j++)
                    tokens.push(add[j]);
            }
        }
        if (!tokens.length)
            return {
                value: null,
                token: null
            };
        tokens.sort(function (a, b) {
            if (b.value !== a.value)
                return b.value - a.value;
            if (b.hasUnit !== a.hasUnit)
                return (b.hasUnit ? 1 : 0) - (a.hasUnit ? 1 : 0);
            return String(a.token || '').length - String(b.token || '').length;
        });
        return {
            value: tokens[0].value,
            token: tokens[0].token
        };
    }
    function domScanBetStakeTotals(force) {
        try {
            var now = Date.now();
            var betHot = false;
            try {
                betHot = (now - Number(window.__cw_last_bet_touch_at || 0)) < 2800;
            } catch (_) {
                betHot = false;
            }
            var cacheMs = betHot ? 180 : 900;
            if (!force && _domBetStakeCache.data && (now - Number(_domBetStakeCache.at || 0)) < cacheMs)
                return _domBetStakeCache.data;
            var contexts = domGetBetContexts(false);
            if ((!contexts || !contexts.length) && force)
                contexts = domGetBetContexts(true);
            var best = null;
            for (var ci = 0; ci < contexts.length; ci++) {
                var ctx = contexts[ci];
                var doc = ctx && ctx.doc ? ctx.doc : null;
                var win = ctx && ctx.win ? ctx.win : null;
                if (!doc || !win || !doc.querySelectorAll)
                    continue;
                var hosts = [];
                var seen = (typeof Set !== 'undefined') ? new Set() : [];
                var nodes = [];
                try {
                    nodes = doc.querySelectorAll("li[id^='betBox'], [id*='betBox'], .zone_bet_bottom > li, .zone_bet_bottom li, .zone_bet_bottom > div, .zone_bet_bottom div");
                } catch (_) {
                    nodes = [];
                }
                var ctxBetScore = Number(ctx && ctx._betScore || 0);
                var maxNodes = force ? 220 : 130;
                if (ctxBetScore >= 1600) maxNodes += 70;
                else if (ctxBetScore <= 300) maxNodes -= 20;
                if (maxNodes < 80) maxNodes = 80;
                if (maxNodes > 240) maxNodes = 240;
                for (var ni = 0; ni < nodes.length && ni < maxNodes; ni++) {
                    var host = nodes[ni];
                    if (!host || !domVisible(host))
                        continue;
                    if (seen.add) {
                        if (seen.has(host))
                            continue;
                        seen.add(host);
                    } else {
                        if (seen.indexOf(host) >= 0)
                            continue;
                        seen.push(host);
                    }
                    var rect = host.getBoundingClientRect();
                    if (!rect || rect.width < 45 || rect.height < 24)
                        continue;
                    if (rect.bottom < 0 || rect.top > win.innerHeight || rect.right < 0 || rect.left > win.innerWidth)
                        continue;
                    if (rect.top < win.innerHeight * 0.48)
                        continue;
                    var txt = domTextOf(host);
                    var side = domBetSideOfText(txt);
                    if (!side)
                        side = domResolveBetSideFromHost(host, txt);
                    var maybeHasMoney = /[\d][\d.,\s]*(?:\s*[kmb])?/i.test(txt);
                    var stake = (side || maybeHasMoney) ? domExtractStakeFromHost(host) : {
                        value: null,
                        token: null
                    };
                    if (!side && stake.value == null)
                        continue;
                    hosts.push({
                        host: host,
                        side: side,
                        text: txt,
                        amount: stake.value,
                        rawAmount: stake.token,
                        rect: rect,
                        source: String(ctx.source || 'top')
                    });
                }
                if (!hosts.length)
                    continue;
                var ordered = hosts.slice().sort(function (a, b) {
                    return a.rect.left - b.rect.left || a.rect.top - b.rect.top;
                });
                var fallback = ['PLAYER', 'TIE', 'BANKER'];
                for (var oi = 0; oi < ordered.length && oi < 3; oi++) {
                    if (!ordered[oi].side)
                        ordered[oi].side = fallback[oi];
                }
                var bySide = {};
                for (var hi = 0; hi < hosts.length; hi++) {
                    var row = hosts[hi];
                    if (!row.side)
                        continue;
                    var score = 0;
                    if (row.amount != null)
                        score += 1000 + Math.min(300, Math.round(row.amount / 1000));
                    if (row.rect.top >= win.innerHeight * 0.62)
                        score += 100;
                    if (/betbox|zone_bet_bottom/i.test(String((row.host.id || '') + ' ' + (row.host.className || ''))))
                        score += 180;
                    if (/singlebactable\.jsp/i.test(String(ctx.href || '')))
                        score += 120;
                    if (String(ctx.source || '') === 'top/frame[1]')
                        score += 80;
                    var prev = bySide[row.side];
                    if (!prev || score > prev._score)
                        bySide[row.side] = {
                            amount: row.amount,
                            raw: row.rawAmount,
                            _score: score,
                            source: row.source
                        };
                }
                var found = 0;
                var sum = 0;
                var keys = ['BANKER', 'PLAYER', 'TIE'];
                for (var ki = 0; ki < keys.length; ki++) {
                    var it = bySide[keys[ki]];
                    if (!it)
                        continue;
                    found++;
                    sum += Number(it._score || 0);
                }
                if (!found)
                    continue;
                var ctxScore = found * 500 + sum;
                var pack = {
                    B: bySide.BANKER ? bySide.BANKER.amount : null,
                    P: bySide.PLAYER ? bySide.PLAYER.amount : null,
                    T: bySide.TIE ? bySide.TIE.amount : null,
                    rawB: bySide.BANKER ? bySide.BANKER.raw : null,
                    rawP: bySide.PLAYER ? bySide.PLAYER.raw : null,
                    rawT: bySide.TIE ? bySide.TIE.raw : null,
                    source: String(ctx.source || 'top'),
                    score: ctxScore
                };
                if (!best || pack.score > best.score)
                    best = pack;
                if (pack.B != null && pack.P != null && found >= 2 && pack.score >= 2800)
                    break;
            }
            var out = best || {
                B: null,
                P: null,
                T: null,
                rawB: null,
                rawP: null,
                rawT: null,
                source: null,
                score: 0
            };
            _domBetStakeCache.at = now;
            _domBetStakeCache.data = out;
            return out;
        } catch (_) {
            return {
                B: null,
                P: null,
                T: null,
                rawB: null,
                rawP: null,
                rawT: null,
                source: null,
                score: 0
            };
        }
    }
    function domReadBetCountdown() {
        try {
            var contexts = [];
            domWalkContexts(window, 'top', 0, 0, contexts, []);
            var best = null;
            for (var i = 0; i < contexts.length; i++) {
                var ctx = contexts[i];
                var doc = ctx && ctx.doc ? ctx.doc : null;
                if (!doc)
                    continue;
                var nodes = [];
                try {
                    nodes = doc.querySelectorAll('#countdownTime > p, dd#countdownTime > p, #countdownTime p');
                } catch (_) {
                    nodes = [];
                }
                for (var j = 0; j < nodes.length; j++) {
                    var el = nodes[j];
                    if (!el || !domVisible(el))
                        continue;
                    var txt = domCollapse(el.innerText || el.textContent || '');
                    if (!/^\d{1,2}$/.test(txt))
                        continue;
                    var val = parseInt(txt, 10);
                    if (!(val >= 0 && val <= 99))
                        continue;
                    var tail = fullPath(el, 80) || domTailOfEl(el) || '';
                    var tailL = String(tail || '').toLowerCase();
                    var r = el.getBoundingClientRect();
                    var score = 0;
                    if (tailL.indexOf('div#countdown.icon_progress.progress_countdown') !== -1)
                        score += 1000;
                    if (tailL.indexOf('dd#countdowntime/p') !== -1)
                        score += 800;
                    if (String(ctx.href || '').toLowerCase().indexOf('singlebactable.jsp') !== -1)
                        score += 300;
                    if (ctx.source === 'top/frame[1]')
                        score += 120;
                    if (r.top < ((ctx.win && ctx.win.innerHeight) || 900) * 0.35)
                        score += 60;
                    if (r.left > ((ctx.win && ctx.win.innerWidth) || 1600) * 0.72)
                        score += 60;
                    if (!best || score > best.score) {
                        best = {
                            value: val,
                            text: txt,
                            tail: tail,
                            source: ctx.source || 'top',
                            href: ctx.href || '',
                            score: score
                        };
                    }
                }
            }
            return best;
        } catch (_) {
            return null;
        }
    }
    function domHasBalanceLabel(norm) {
        return /(?:^|[^a-z0-9])(so du|sodu|balance)(?:[^a-z0-9]|$)/.test(String(norm || ''));
    }
    function domExtractBalanceTokenFromLabelText(txt) {
        var s = String(txt || '');
        var m = s.match(/(?:so\s*du|sodu|balance)\s*[:=]?\s*([$€£¥₫]?\s*[\d][\d.,]*(?:\s*[KMB])?)/i);
        if (m && m[1])
            return domCollapse(m[1]);
        return '';
    }
    function domExtractAccountToken(txt) {
        var s = domCollapse(txt || '');
        if (!s)
            return '';
        var m = s.match(/(?:^|[^a-z0-9_])((?:plyr|player|user|usr)[a-z0-9_]{3,})(?:[^a-z0-9_]|$)/i);
        if (m && m[1])
            return String(m[1] || '').trim();
        return '';
    }
    function domIsStrictHudBalanceText(txt) {
        var s = domCollapse(txt).replace(/[₫$€£¥]/g, '').replace(/\s+/g, '');
        if (!s)
            return false;
        if (/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(s))
            return true;
        if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(s))
            return true;
        if (/^\d+\.\d{1,2}$/.test(s))
            return true;
        if (/^\d+,\d{1,2}$/.test(s))
            return true;
        if (/^\d+(?:\.\d+)?[KMB]$/i.test(s))
            return true;
        return false;
    }
    function domIsNearBalanceLabelRow(row, labelRows) {
        if (!row || !labelRows || !labelRows.length)
            return false;
        for (var i = 0; i < labelRows.length; i++) {
            var lb = labelRows[i];
            if (!lb)
                continue;
            if (row.source && lb.source && row.source !== lb.source)
                continue;
            var dy = Math.abs(((row.y || 0) + (row.h || 0) / 2) - ((lb.y || 0) + (lb.h || 0) / 2));
            var dx = (row.x || 0) - (lb.x || 0);
            if (dy <= 26 && dx >= -220 && dx <= 520)
                return true;
        }
        return false;
    }
    function domParseHudRows(rows, leftBiasMinX, leftBiasMaxX) {
        var account = '';
        var accountRow = null;
        var balance = null;
        var rawBalance = null;
        rows = rows || [];
        var labelRows = [];

        for (var i = 0; i < rows.length; i++) {
            var row = rows[i] || {};
            var txt = domCollapse(row.text || row.txt || '');
            var norm = domNorm(txt);
            var accToken = domExtractAccountToken(txt);
            if (!account && accToken) {
                account = accToken;
                accountRow = row;
            }

            if (domHasBalanceLabel(norm)) {
                labelRows.push(row);
                var token = domExtractBalanceTokenFromLabelText(txt);
                var val = token ? balanceOf(token) : balanceOf(txt);
                if (val != null) {
                    balance = val;
                    rawBalance = token || txt;
                }
            }
        }

        if ((!account || balance == null) && rows.length) {
            rows = rows.slice().sort(function (a, b) { return a.y - b.y || a.x - b.x; });
            for (var j = 0; j < rows.length; j++) {
                var row2 = rows[j] || {};
                var txt2 = domCollapse(row2.text || row2.txt || '');
                var norm2 = domNorm(txt2);
                var accToken2 = domExtractAccountToken(txt2);
                if (!account && accToken2) {
                    account = accToken2;
                    accountRow = row2;
                }
                if (balance == null) {
                    var inBiasRange = row2.x > (leftBiasMinX == null ? 0 : leftBiasMinX) &&
                        row2.x < (leftBiasMaxX == null ? 999999 : leftBiasMaxX);
                    var hasLabel2 = domHasBalanceLabel(norm2);
                    var nearLabel2 = domIsNearBalanceLabelRow(row2, labelRows);
                    var strictMoney2 = domIsStrictHudBalanceText(txt2);
                    var nearAccount2 = false;
                    if (accountRow && row2.source === accountRow.source) {
                        var dy2 = Math.abs(((row2.y || 0) + (row2.h || 0) / 2) - ((accountRow.y || 0) + (accountRow.h || 0) / 2));
                        var dx2 = (row2.x || 0) - ((accountRow.x || 0) + (accountRow.w || 0));
                        nearAccount2 = (dy2 <= 24 && dx2 >= -60 && dx2 <= 460);
                    }
                    if (inBiasRange && (hasLabel2 || (strictMoney2 && (nearLabel2 || nearAccount2)))) {
                        var token2 = hasLabel2 ? domExtractBalanceTokenFromLabelText(txt2) : '';
                        var val2 = token2 ? balanceOf(token2) : balanceOf(txt2);
                        if (val2 != null) {
                            balance = val2;
                            rawBalance = token2 || txt2;
                        }
                    }
                }
                if (account && balance != null)
                    break;
            }
        }

        return {
            account: account || null,
            balance: balance,
            rawBalance: rawBalance || null
        };
    }
    function domFindTopHudSnapshot() {
        try {
            var rootWin = domGetSameOriginRoot(window);
            var contexts = [];
            domWalkContexts(rootWin, 'top', 0, 0, contexts, []);
            function pickAccount(rows) {
                var list = [];
                for (var ai = 0; ai < rows.length; ai++) {
                    var rt = domCollapse(rows[ai].text || rows[ai].txt || '');
                    var token = domExtractAccountToken(rt);
                    if (!token)
                        continue;
                    var score = 100;
                    if ((rows[ai].y || 0) <= 30)
                        score += 20;
                    if ((rows[ai].x || 0) >= 150)
                        score += 10;
                    if (/frame\[0\]/.test(String(rows[ai].source || '')))
                        score += 10;
                    list.push({
                        row: rows[ai],
                        account: token,
                        score: score
                    });
                }
                list.sort(function (a, b) {
                    return b.score - a.score || a.row.y - b.row.y || a.row.x - b.row.x;
                });
                return list.length ? list[0] : null;
            }
            function pickBalance(rows, account) {
                var list = [];
                var labelRows = [];
                for (var li = 0; li < rows.length; li++) {
                    var ltxt = domCollapse(rows[li].text || rows[li].txt || '');
                    if (domHasBalanceLabel(domNorm(ltxt)))
                        labelRows.push(rows[li]);
                }
                for (var bi = 0; bi < rows.length; bi++) {
                    var txt = domCollapse(rows[bi].text || rows[bi].txt || '');
                    var norm = domNorm(txt);
                    var hasLabel = domHasBalanceLabel(norm);
                    var token = hasLabel ? domExtractBalanceTokenFromLabelText(txt) : '';
                    var mv = token ? balanceOf(token) : balanceOf(txt);
                    var strictMoney = domIsStrictHudBalanceText(txt);
                    var nearLabel = domIsNearBalanceLabelRow(rows[bi], labelRows);
                    var nearAccount = false;
                    if (account && rows[bi].source === account.source) {
                        var ady = Math.abs(((rows[bi].y || 0) + (rows[bi].h || 0) / 2) - ((account.y || 0) + (account.h || 0) / 2));
                        var adx = (rows[bi].x || 0) - ((account.x || 0) + (account.w || 0));
                        nearAccount = (ady <= 22 && adx >= -70 && adx <= 460);
                    }
                    var accepted = false;
                    if (hasLabel && mv != null)
                        accepted = true;
                    else if (!hasLabel && strictMoney && mv != null && (nearLabel || nearAccount))
                        accepted = true;
                    if (!accepted)
                        continue;
                    var score = 0;
                    if (hasLabel)
                        score += 220;
                    if (nearLabel)
                        score += 120;
                    if (strictMoney)
                        score += 90;
                    if (mv != null)
                        score += 30;
                    if (/0\.00|0,00/.test(txt))
                        score += 30;
                    if (/^\d+(?:[.,]\d+)?(?:[KMB])?$/.test(txt.trim()) && txt.trim().length <= 10)
                        score += 10;
                    if (account && rows[bi].source === account.source)
                        score += 20;
                    if (account) {
                        var dy = Math.abs(((rows[bi].y || 0) + (rows[bi].h || 0) / 2) - ((account.y || 0) + (account.h || 0) / 2));
                        var dx = (rows[bi].x || 0) - ((account.x || 0) + (account.w || 0));
                        if (dy <= 16)
                            score += 50;
                        else if (dy <= 28)
                            score += 20;
                        if (dx >= -80 && dx <= 520)
                            score += 60;
                        else if (dx >= -160 && dx <= 700)
                            score += 15;
                        if (dx >= 0)
                            score += 10;
                    }
                    list.push({
                        row: rows[bi],
                        score: score,
                        money: mv
                    });
                }
                list.sort(function (a, b) {
                    return b.score - a.score || a.row.y - b.row.y || a.row.x - b.row.x;
                });
                return list.length ? {
                    row: list[0].row,
                    money: list[0].money
                } : null;
            }
            var best = {
                account: null,
                balance: null,
                rawBalance: null,
                source: null
            };
            var bestScore = -1;
            for (var i = 0; i < contexts.length; i++) {
                var ctx = contexts[i];
                if (!ctx || !ctx.doc)
                    continue;
                var rows = domCollectTopHudRows(ctx, 160);
                var accPick = pickAccount(rows);
                var accRow = accPick ? accPick.row : null;
                var bal = pickBalance(rows, accRow);
                var hud = {
                    account: accPick ? (accPick.account || null) : null,
                    balance: bal ? bal.money : null,
                    rawBalance: bal ? (bal.row.text || bal.row.txt || null) : null
                };
                if (!hud.account || hud.balance == null) {
                    var legacy = domParseHudRows(rows, (ctx.offX || 0) + (((ctx.win && ctx.win.innerWidth) || 1600) * 0.06), (ctx.offX || 0) + (((ctx.win && ctx.win.innerWidth) || 1600) * 0.98));
                    if (!hud.account && legacy.account)
                        hud.account = legacy.account;
                    if (hud.balance == null && legacy.balance != null) {
                        hud.balance = legacy.balance;
                        hud.rawBalance = legacy.rawBalance;
                    }
                }
                var score = 0;
                if (hud.account)
                    score += 100;
                if (hud.balance != null)
                    score += 100;
                if (hud.rawBalance && /0\.00|0,00/.test(String(hud.rawBalance)))
                    score += 10;
                if (ctx.source && /frame\[0\]|top$/.test(ctx.source))
                    score += 5;
                if (score > bestScore) {
                    bestScore = score;
                    best = {
                        account: hud.account || null,
                        balance: hud.balance,
                        rawBalance: hud.rawBalance || null,
                        source: ctx.source || 'top'
                    };
                }
            }
            return best;
        } catch (_) {
            return {
                account: null,
                balance: null,
                rawBalance: null,
                source: null
            };
        }
    }
    function domFindGameAccountSnapshot() {
        try {
            var rootWin = domGetSameOriginRoot(window);
            var contexts = [];
            domWalkContexts(rootWin, 'top', 0, 0, contexts, []);
            function isLikelyGameHref(href) {
                var h = String(href || '').toLowerCase();
                if (!h)
                    return false;
                if (h.indexOf('/player/') !== -1)
                    return true;
                if (h.indexOf('singlebactable.jsp') !== -1)
                    return true;
                if (h.indexOf('gamehall.jsp') !== -1)
                    return true;
                if (h.indexOf('webmain.jsp') !== -1)
                    return true;
                return false;
            }
            var best = {
                account: null,
                source: null
            };
            var bestScore = -1;
            for (var ci = 0; ci < contexts.length; ci++) {
                var ctx = contexts[ci];
                if (!ctx || !ctx.doc)
                    continue;
                var href = String(ctx.href || '').toLowerCase();
                if (!isLikelyGameHref(href))
                    continue;
                var doc = ctx.doc;
                var view = ctx.win || window;
                var topBand = Math.max(140, Math.min(220, ((view && view.innerHeight) || 900) * 0.22));
                var nodes = [];
                try {
                    nodes = doc.querySelectorAll('span,div,p,a,b,strong,label,li,td');
                } catch (_) {
                    nodes = [];
                }
                for (var i = 0; i < nodes.length && i < 12000; i++) {
                    var el = nodes[i];
                    if (!el)
                        continue;
                    var txt = domCollapse(el.innerText || el.textContent || '');
                    if (!txt || txt.length > 180)
                        continue;
                    if (/(nhap de bat dau chat|b[aă]t d[aà]u chat|chat|gift|x\s*\d+|❤|❤️)/i.test(txt))
                        continue;
                    var token = domExtractAccountToken(txt);
                    if (!token)
                        continue;
                    var score = 0;
                    if (/^(plyr|player|user|usr)/i.test(token))
                        score += 260;
                    if (/\d/.test(token))
                        score += 80;
                    if (href.indexOf('singlebactable.jsp') !== -1)
                        score += 220;
                    else if (href.indexOf('gamehall.jsp') !== -1)
                        score += 180;
                    else if (href.indexOf('webmain.jsp') !== -1)
                        score += 120;
                    try {
                        var r = el.getBoundingClientRect();
                        if (r && r.top >= 0 && r.top <= topBand)
                            score += 120;
                    } catch (_) {}
                    var norm = domNorm(txt);
                    if (domHasBalanceLabel(norm) || /(tai khoan|so du|balance)/.test(norm))
                        score += 120;
                    if (score > bestScore) {
                        bestScore = score;
                        best = {
                            account: token,
                            source: String(ctx.source || '')
                        };
                    }
                }
            }
            return best;
        } catch (_) {
            return {
                account: null,
                source: null
            };
        }
    }
    function domFindHudSnapshot() {
        try {
            var ctx = domGetContext();
            var labels = domCollectLabels().filter(function (it) {
                return it.y >= (ctx.offY || 0) && it.y <= (ctx.offY || 0) + Math.max(180, ctx.innerHeight * 0.22);
            });
            var hud = domParseHudRows(labels, (ctx.offX || 0) + ctx.innerWidth * 0.2, (ctx.offX || 0) + ctx.innerWidth * 0.7);
            try {
                var topHud = domFindTopHudSnapshot();
                if (topHud.account)
                    hud.account = topHud.account;
                if (topHud.balance != null) {
                    hud.balance = topHud.balance;
                    hud.rawBalance = topHud.rawBalance;
                }
                if (topHud.source)
                    hud.source = topHud.source;
                if (!hud.account) {
                    var gameAcc = domFindGameAccountSnapshot();
                    if (gameAcc && gameAcc.account)
                        hud.account = String(gameAcc.account || '');
                    if (!hud.source && gameAcc && gameAcc.source)
                        hud.source = String(gameAcc.source || '');
                }
            } catch (_) {}
            return {
                account: hud.account || null,
                balance: hud.balance,
                rawBalance: hud.rawBalance || null,
                source: hud.source || null
            };
        } catch (_) {
            return {
                account: null,
                balance: null,
                rawBalance: null,
                source: null
            };
        }
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
        if (s.length > 120)
            return false;
        if (/^[\d\s.,:;+\-/%$€£¥₫()]+$/.test(s) && !/[A-Za-zÀ-ỹ]/i.test(s))
            return false;
        if (/^[^\wA-Za-zÀ-ỹ]*$/.test(s))
            return false;
        if (/[A-Za-zÀ-ỹ]/i.test(s) || /\d/.test(s))
            return true;
        if (/[@._-]/.test(s))
            return true;
        if (/[^\w\s]/.test(s) && s.length >= 3)
            return true;
        return s.length >= 2;
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
        if (!__cw_hasCocos()) {
            var labs = collectLabels();
            var outDom = [];
            for (var di = 0; di < labs.length; di++) {
                var L = labs[di];
                var s = String(L.text || '').trim();
                if (!isTextCandidate(s))
                    continue;
                outDom.push({
                    idx: outDom.length + 1,
                    text: s,
                    x: Math.round(L.x),
                    y: Math.round(L.y),
                    w: Math.round(L.w),
                    h: Math.round(L.h),
                    sx: L.sx,
                    sy: L.sy,
                    sw: L.sw,
                    sh: L.sh,
                    n: L.n,
                    tail: L.fullTail || L.tail,
                    tl: String(L.fullTail || L.tail || '').toLowerCase(),
                    element: L.element
                });
            }
            return outDom;
        }
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
        if (seq.length <= 50)
            return seq;
        return seq.slice(-50);
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
        var seq = limitSeq52(parts.join(''));
        return {
            seq: seq,
            which: which,
            cols: cols,
            cells: cells
        };
    }

    function limitSeq50(seq) {
        seq = String(seq || '');
        return seq.length <= 50 ? seq : seq.slice(seq.length - 50);
    }

    function brParseRgb(s) {
        if (!s)
            return null;
        var m = String(s).match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
        if (m)
            return { r: +m[1], g: +m[2], b: +m[3] };
        m = String(s).match(/^#([0-9a-f]{6})$/i);
        if (m) {
            var hex = m[1];
            return {
                r: parseInt(hex.slice(0, 2), 16),
                g: parseInt(hex.slice(2, 4), 16),
                b: parseInt(hex.slice(4, 6), 16)
            };
        }
        return null;
    }
    function brParseRadiusPx(s, size) {
        if (!s)
            return 0;
        var raw = String(s).split(/\s+/)[0] || '';
        if (!raw)
            return 0;
        if (raw.indexOf('%') !== -1) {
            var pct = parseFloat(raw);
            if (!isFinite(pct))
                return 0;
            return size * pct / 100;
        }
        var px = parseFloat(raw);
        return isFinite(px) ? px : 0;
    }
    function brClassifyColor(list) {
        for (var i = 0; i < list.length; i++) {
            var rgb = brParseRgb(list[i]);
            if (!rgb)
                continue;
            if (rgb.r >= 150 && rgb.r > rgb.b * 1.12 && rgb.r > rgb.g * 1.05)
                return 'B';
            if (rgb.b >= 140 && rgb.b > rgb.r * 1.05 && rgb.b >= rgb.g * 0.95)
                return 'P';
            if (rgb.g >= 120 && rgb.g > rgb.r * 0.85 && rgb.g > rgb.b * 0.9)
                return 'T';
        }
        return '';
    }
    function brClassifyMarker(el, cs) {
        var txt = domCollapse(el.innerText || el.textContent || '').toUpperCase();
        if (/^B$/.test(txt))
            return 'B';
        if (/^P$/.test(txt))
            return 'P';
        if (/^(T|H)$/.test(txt))
            return 'T';
        if (txt)
            return '';
        return brClassifyColor([
            cs.backgroundColor,
            cs.borderColor,
            cs.color,
            cs.outlineColor,
            el.getAttribute ? el.getAttribute('fill') : '',
            el.getAttribute ? el.getAttribute('stroke') : ''
        ]);
    }
    function brDiagBump(diag, key) {
        if (!diag)
            return;
        if (!diag.reasons)
            diag.reasons = {};
        diag.reasons[key] = Number(diag.reasons[key] || 0) + 1;
    }
    function brDiagSample(diag, key, value, max) {
        if (!diag)
            return;
        if (!diag.samples)
            diag.samples = {};
        if (!diag.samples[key])
            diag.samples[key] = [];
        var arr = diag.samples[key];
        if (arr.length >= Number(max || 3))
            return;
        arr.push(value);
    }
    function brCollectMarkersInContext(ctx, opts, diag) {
        opts = opts || {};
        var out = [];
        var doc = ctx.doc;
        var view = ctx.win || window;
        var maxX = (view.innerWidth || 1600) * (opts.maxXRatio || 0.18);
        var minY = (view.innerHeight || 900) * (opts.minYRatio || 0.72);
        var maxSize = opts.maxSize || 34;
        var maxChildren = opts.maxChildren || 2;
        var maxChildKeep = opts.maxChildKeep || 1;
        var roundRatio = opts.roundRatio || 0.28;
        var all = doc.querySelectorAll('div,span,p,b,strong,button,svg,circle,td');
        var seen = Object.create(null);
        if (diag) {
            diag.totalNodes = 0;
            diag.accepted = 0;
            diag.reasons = {};
            diag.samples = {};
        }
        for (var i = 0; i < all.length && i < 6000; i++) {
            var el = all[i];
            if (diag)
                diag.totalNodes++;
            if (!domVisible(el)) {
                brDiagBump(diag, 'invisible');
                continue;
            }
            if (el.childElementCount && el.childElementCount > maxChildren) {
                brDiagBump(diag, 'too-many-children');
                continue;
            }
            var r = el.getBoundingClientRect();
            if (r.left < 0 || r.top < 0) {
                brDiagBump(diag, 'out-negative');
                continue;
            }
            if (r.left > maxX || r.top < minY) {
                brDiagBump(diag, 'out-target-zone');
                continue;
            }
            if (r.width < 10 || r.height < 10 || r.width > maxSize || r.height > maxSize) {
                brDiagBump(diag, 'size-filter');
                brDiagSample(diag, 'size-filter', {
                    w: Math.round(r.width),
                    h: Math.round(r.height),
                    maxSize: maxSize
                }, 3);
                continue;
            }
            if (Math.abs(r.width - r.height) > 10) {
                brDiagBump(diag, 'not-square');
                continue;
            }
            var cs = view.getComputedStyle(el);
            var marker = brClassifyMarker(el, cs);
            if (!marker) {
                brDiagBump(diag, 'marker-empty');
                continue;
            }
            var tag = String(el.tagName || '').toLowerCase();
            var borderRadius = cs.borderRadius || '';
            var minSide = Math.min(r.width, r.height);
            var rx = brParseRadiusPx(borderRadius, minSide);
            var roundHint = tag === 'circle' || /50%|999/.test(borderRadius) || rx >= (minSide * roundRatio);
            if (!roundHint) {
                brDiagBump(diag, 'not-round');
                brDiagSample(diag, 'not-round', {
                    tag: tag,
                    borderRadius: String(borderRadius || ''),
                    rx: Number(rx || 0)
                }, 3);
                continue;
            }
            if (el.childElementCount > maxChildKeep && tag !== 'svg') {
                brDiagBump(diag, 'child-keep-filter');
                continue;
            }
            var key = marker + '|' + Math.round(r.left / 4) + '|' + Math.round(r.top / 4);
            if (seen[key]) {
                brDiagBump(diag, 'dedup');
                continue;
            }
            seen[key] = 1;
            out.push({
                v: marker,
                source: ctx.source,
                href: ctx.href,
                x: Math.round((ctx.offX || 0) + r.left),
                y: Math.round((ctx.offY || 0) + r.top),
                w: Math.round(r.width),
                h: Math.round(r.height),
                rawText: domCollapse(el.innerText || el.textContent || ''),
                tail: fullPath(el, 80),
                element: el
            });
            if (diag)
                diag.accepted++;
        }
        return out;
    }
    function brSplitComponents(items) {
        var comps = [];
        var used = new Array(items.length);
        function close(a, b) {
            return Math.abs(a.x - b.x) <= 64 && Math.abs(a.y - b.y) <= 92;
        }
        for (var i = 0; i < items.length; i++) {
            if (used[i])
                continue;
            used[i] = true;
            var comp = [];
            var q = [i];
            while (q.length) {
                var idx = q.pop();
                var it = items[idx];
                comp.push(it);
                for (var j = 0; j < items.length; j++) {
                    if (used[j])
                        continue;
                    if (close(it, items[j])) {
                        used[j] = true;
                        q.push(j);
                    }
                }
            }
            comps.push(comp);
        }
        return comps;
    }
    function brBuildColumns(items) {
        if (!items.length)
            return [];
        var avgW = items.reduce(function (s, x) { return s + x.w; }, 0) / items.length;
        var tol = Math.max(10, Math.round(avgW * 0.8));
        var cols = [];
        var sorted = items.slice().sort(function (a, b) {
            var ay = (a._gridY != null ? a._gridY : a.y);
            var by = (b._gridY != null ? b._gridY : b.y);
            return a.x - b.x || ay - by;
        });
        for (var i = 0; i < sorted.length; i++) {
            var it = sorted[i], col = null;
            for (var j = 0; j < cols.length; j++) {
                if (Math.abs(cols[j].cx - it.x) <= tol) {
                    col = cols[j];
                    break;
                }
            }
            if (!col) {
                col = { cx: it.x, items: [] };
                cols.push(col);
            }
            col.items.push(it);
            col.cx = Math.round((col.cx * (col.items.length - 1) + it.x) / col.items.length);
        }
        cols.sort(function (a, b) { return a.cx - b.cx; });
        for (var k = 0; k < cols.length; k++) {
            cols[k].items.sort(function (a, b) {
                var ay = (a._row != null ? a._row : a.y);
                var by = (b._row != null ? b._row : b.y);
                return ay - by || a.x - b.x;
            });
        }
        return cols;
    }
    function brBuildRows(items) {
        if (!items.length)
            return [];
        var avgH = items.reduce(function (s, x) { return s + x.h; }, 0) / items.length;
        var tol = Math.max(10, Math.round(avgH * 0.8));
        var rows = [];
        var sorted = items.slice().sort(function (a, b) {
            return a.y - b.y || a.x - b.x;
        });
        for (var i = 0; i < sorted.length; i++) {
            var it = sorted[i], row = null;
            for (var j = 0; j < rows.length; j++) {
                if (Math.abs(rows[j].cy - it.y) <= tol) {
                    row = rows[j];
                    break;
                }
            }
            if (!row) {
                row = { cy: it.y, items: [] };
                rows.push(row);
            }
            row.items.push(it);
            row.cy = Math.round((row.cy * (row.items.length - 1) + it.y) / row.items.length);
        }
        rows.sort(function (a, b) { return a.cy - b.cy; });
        return rows;
    }
    function brPickBoard(markers, screenW, screenH, profileName) {
        var comps = brSplitComponents(markers);
        var best = null;
        var profile = String(profileName || '');
        for (var i = 0; i < comps.length; i++) {
            var comp = comps[i];
            if (!comp.length)
                continue;
            var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            var sumW = 0, sumH = 0, maxSide = 0, textCount = 0;
            for (var j = 0; j < comp.length; j++) {
                var it = comp[j];
                if (it.x < minX) minX = it.x;
                if (it.x > maxX) maxX = it.x;
                if (it.y < minY) minY = it.y;
                if (it.y > maxY) maxY = it.y;
                sumW += Number(it.w || 0);
                sumH += Number(it.h || 0);
                maxSide = Math.max(maxSide, Number(it.w || 0), Number(it.h || 0));
                if (/^[BPTH]$/.test(String(it.rawText || '').toUpperCase()))
                    textCount++;
            }
            var width = maxX - minX;
            var height = maxY - minY;
            var cols = brBuildColumns(comp);
            var rowKeys = Object.create(null);
            for (var c = 0; c < cols.length; c++) {
                for (var r = 0; r < cols[c].items.length; r++)
                    rowKeys[Math.round(cols[c].items[r].y / 12)] = 1;
            }
            var rowCount = Object.keys(rowKeys).length;
            var colCount = cols.length;
            var avgW = comp.length ? (sumW / comp.length) : 0;
            var avgH = comp.length ? (sumH / comp.length) : 0;
            var allowSmall = (comp.length >= 4
                    && (minX <= screenW * 0.36 || maxX >= screenW * 0.64)
                    && minY >= screenH * 0.54
                    && width <= 190
                    && height <= 230);
            var inRoadZone = (minX <= screenW * 0.34 || maxX >= screenW * 0.56)
                    && minY >= screenH * 0.48
                    && minY <= screenH * 0.90;
            var tinyProfileOk = !profile || profile === 'left-tight' || profile === 'right-tight' || profile === 'left-mid' || profile === 'right-mid';
            var allowTiny = (comp.length >= 1 && comp.length <= 3
                    && tinyProfileOk
                    && inRoadZone
                    && maxSide <= 32
                    && avgW >= 7
                    && avgH >= 7
                    && width <= 95
                    && height <= 95);
            if (!allowSmall && !allowTiny && (comp.length < 8 || colCount < 2))
                continue;
            var score = comp.length * 30;
            var edgeDist = Math.min(minX, Math.max(0, screenW - maxX));
            score += Math.max(0, (screenW * 0.18 - edgeDist)) * 8;
            score += Math.max(0, (screenH - maxY)) * 0.2;
            score += Math.max(0, (screenH * 0.88 - minY));
            score += textCount * 80;
            if (allowSmall) score += 180;
            if (allowTiny) score += 420;
            if (comp.length >= 12 && comp.length <= 40) score += 220;
            if (rowCount >= 5) score += 260;
            if (rowCount >= 6) score += 120;
            if (colCount >= 3) score += 160;
            if (colCount >= 4) score += 140;
            if (colCount >= 6) score += 100;
            if (!allowTiny && comp.length < 8) score -= (8 - comp.length) * 45;
            if (!allowTiny && rowCount <= 2) score -= 260;
            if (!allowTiny && colCount <= 2) score -= 120;
            if (!allowTiny && height < 70) score -= 180;
            if (!allowTiny && width < 45) score -= 160;
            if (allowTiny && rowCount >= 2 && colCount === 1) score += 120;
            if (allowTiny && textCount > 0) score += 160;
            if (width >= 45 && width <= 120) score += 260;
            if (width > 120 && width <= 360) score += 160;
            if (height >= 95 && height <= 175) score += 220;
            if (width > 380) score -= 180;
            if (height > 185) score -= 260;
            if (minY > screenH * 0.9) score -= 260;
            if (!best || score > best.score) {
                best = {
                    items: comp,
                    score: score,
                    minX: minX,
                    maxX: maxX,
                    minY: minY,
                    maxY: maxY,
                    width: width,
                    height: height,
                    rowCount: rowCount,
                    colCount: colCount,
                    textCount: textCount,
                    allowSmall: allowSmall,
                    allowTiny: allowTiny,
                    avgW: avgW,
                    avgH: avgH,
                    maxSide: maxSide,
                    profileName: profile
                };
            }
        }
        return best;
    }
    function brTrimBoardToTopSixRows(board) {
        if (!board || !board.items || !board.items.length)
            return board;
        var rows = brBuildRows(board.items);
        if (rows.length <= 6) {
            board.rows = rows;
            return board;
        }
        var keepRows = rows.slice(0, 6);
        var keep = [];
        for (var i = 0; i < keepRows.length; i++) {
            for (var j = 0; j < keepRows[i].items.length; j++)
                keep.push(keepRows[i].items[j]);
        }
        var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (var k = 0; k < keep.length; k++) {
            var it = keep[k];
            if (it.x < minX) minX = it.x;
            if (it.x > maxX) maxX = it.x;
            if (it.y < minY) minY = it.y;
            if (it.y > maxY) maxY = it.y;
        }
        board.items = keep;
        board.minX = minX; board.maxX = maxX; board.minY = minY; board.maxY = maxY;
        board.width = maxX - minX; board.height = maxY - minY;
        board.rowCount = keepRows.length; board.rows = keepRows; board.colCount = brBuildColumns(keep).length;
        return board;
    }
    function brTrimBoardToLeftTopSegment(board) {
        if (!board || !board.items || !board.items.length)
            return board;
        var cols = brBuildColumns(board.items);
        if (!cols.length)
            return board;
        // Với board nhỏ (<=3 cột) nhưng item đã dày, giữ toàn bộ để không rơi cột đuôi ngắn (vd 6-6-2).
        if (cols.length <= 3 && board.items.length >= 10) {
            var keepRowsAll = brBuildRows(board.items).slice(0, 6);
            board.rows = keepRowsAll;
            board.rowCount = keepRowsAll.length;
            board.colCount = cols.length;
            cwDbg('SEQFLOW', 'trim-left-keep-few-cols', {
                itemCount: board.items.length,
                colCount: cols.length,
                rowCount: keepRowsAll.length,
                minX: Number(board.minX || 0),
                maxX: Number(board.maxX || 0),
                width: Number(board.width || 0),
                reason: 'few-cols-rich-items'
            }, 0, 'trim-left-keep-few-cols|' + cols.length + '|' + board.items.length);
            return board;
        }
        var leftCols = [cols[0]];
        var avgW = board.items.reduce(function (s, x) { return s + x.w; }, 0) / board.items.length;
        var maxGap = Math.max(28, Math.round(avgW * 1.85));
        var droppedByGap = 0;
        for (var i = 1; i < cols.length; i++) {
            var gap = cols[i].cx - cols[i - 1].cx;
            if (gap > maxGap) {
                droppedByGap = cols.length - i;
                cwDbg('SEQFLOW', 'trim-left-gap-break', {
                    atCol: i,
                    totalCols: cols.length,
                    keepCols: leftCols.length,
                    gap: gap,
                    maxGap: maxGap,
                    avgW: Math.round(avgW || 0),
                    itemCount: board.items.length
                }, 1800, 'trim-left-gap-break|' + i + '|' + cols.length + '|' + gap + '|' + maxGap);
                break;
            }
            leftCols.push(cols[i]);
            if (leftCols.length >= 8)
                break;
        }
        var keep = [];
        for (var c = 0; c < leftCols.length; c++) {
            for (var r = 0; r < leftCols[c].items.length; r++)
                keep.push(leftCols[c].items[r]);
        }
        if (!keep.length)
            return board;
        var topRows = brBuildRows(keep).slice(0, 6);
        var topKeep = [];
        for (var rr = 0; rr < topRows.length; rr++) {
            for (var ii = 0; ii < topRows[rr].items.length; ii++)
                topKeep.push(topRows[rr].items[ii]);
        }
        var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (var k = 0; k < topKeep.length; k++) {
            var it = topKeep[k];
            if (it.x < minX) minX = it.x;
            if (it.x > maxX) maxX = it.x;
            if (it.y < minY) minY = it.y;
            if (it.y > maxY) maxY = it.y;
        }
        board.items = topKeep;
        board.minX = minX; board.maxX = maxX; board.minY = minY; board.maxY = maxY;
        board.width = maxX - minX; board.height = maxY - minY;
        board.rows = topRows; board.rowCount = topRows.length; board.colCount = brBuildColumns(topKeep).length;
        if (droppedByGap > 0) {
            cwDbg('SEQFLOW', 'trim-left-result', {
                droppedByGap: droppedByGap,
                keepCols: leftCols.length,
                outCols: Number(board.colCount || 0),
                outItems: topKeep.length,
                outRows: topRows.length
            }, 1800, 'trim-left-result|' + droppedByGap + '|' + Number(board.colCount || 0) + '|' + topKeep.length);
        }
        return board;
    }
    function brNormalizeBoardToSixRows(board) {
        if (!board || !board.items || !board.items.length)
            return board;
        var minY = Infinity, maxY = -Infinity;
        for (var i = 0; i < board.items.length; i++) {
            var it = board.items[i];
            if (it.y < minY) minY = it.y;
            if (it.y > maxY) maxY = it.y;
        }
        if (!isFinite(minY) || !isFinite(maxY))
            return board;
        var rows = brBuildRows(board.items);
        var rowDiffs = [];
        for (var r = 1; r < rows.length; r++)
            rowDiffs.push(rows[r].cy - rows[r - 1].cy);
        var avgH = board.items.reduce(function (s, x) { return s + x.h; }, 0) / board.items.length;
        var rowStep = Math.max(10, Math.round(median(rowDiffs) || (avgH * 1.05)));
        for (var j = 0; j < board.items.length; j++) {
            var cell = board.items[j];
            var idx = Math.round((cell.y - minY) / rowStep);
            if (idx < 0) idx = 0;
            if (idx > 5) idx = 5;
            cell._row = idx;
            cell._gridY = minY + idx * rowStep;
        }
        board.rowCount = 6;
        board.rowStep = rowStep;
        board.minY = minY;
        board.maxY = minY + rowStep * 5;
        board.height = board.maxY - board.minY;
        return board;
    }
    function brRefineBoardMarkers(contexts, board) {
        if (!board || !board.items || !board.items.length)
            return [];
        var src = board.items[0].source;
        var ctx = null;
        for (var i = 0; i < contexts.length; i++) {
            if (contexts[i].source === src) {
                ctx = contexts[i];
                break;
            }
        }
        if (!ctx)
            return board.items.slice();
        var avgW = board.items.reduce(function (s, x) { return s + x.w; }, 0) / board.items.length;
        var avgH = board.items.reduce(function (s, x) { return s + x.h; }, 0) / board.items.length;
        var padX = Math.max(8, Math.round(avgW * 0.9));
        var padY = Math.max(8, Math.round(avgH * 0.9));
        var minX = board.minX - padX, maxX = board.maxX + padX, minY = board.minY - padY, maxY = board.maxY + padY;
        var out = [];
        var seen = Object.create(null);
        var all = ctx.doc.querySelectorAll('div,span,p,b,strong,button,svg,circle,td');
        for (var n = 0; n < all.length && n < 8000; n++) {
            var el = all[n];
            if (!domVisible(el))
                continue;
            var r = el.getBoundingClientRect();
            var gx = Math.round((ctx.offX || 0) + r.left);
            var gy = Math.round((ctx.offY || 0) + r.top);
            if (gx < minX || gx > maxX || gy < minY || gy > maxY)
                continue;
            if (r.width < 10 || r.height < 10 || r.width > 40 || r.height > 40)
                continue;
            if (Math.abs(r.width - r.height) > 12)
                continue;
            var cs = ctx.win.getComputedStyle(el);
            var marker = brClassifyMarker(el, cs);
            if (!marker)
                continue;
            var borderRadius = cs.borderRadius || '';
            var minSide = Math.min(r.width, r.height);
            var rx = brParseRadiusPx(borderRadius, minSide);
            var tag = String(el.tagName || '').toLowerCase();
            var roundHint = tag === 'circle' || /50%|999/.test(borderRadius) || rx >= (minSide * 0.18);
            if (!roundHint)
                continue;
            var key = marker + '|' + Math.round(gx / 4) + '|' + Math.round(gy / 4);
            if (seen[key])
                continue;
            seen[key] = 1;
            out.push({
                v: marker,
                source: ctx.source,
                href: ctx.href,
                x: gx,
                y: gy,
                w: Math.round(r.width),
                h: Math.round(r.height),
                rawText: domCollapse(el.innerText || el.textContent || ''),
                tail: fullPath(el, 80),
                element: el
            });
        }
        return out.length ? out : board.items.slice();
    }
    function brBuildGrid6xN(items) {
        if (!items || !items.length)
            return { grid: [], cols: [], rowStep: 0, colStep: 0 };
        var colsRaw = brBuildColumns(items);
        var colCenters = colsRaw.map(function (c) { return c.cx; }).sort(function (a, b) { return a - b; });
        var colDiffs = [];
        for (var i = 1; i < colCenters.length; i++)
            colDiffs.push(colCenters[i] - colCenters[i - 1]);
        var colStep = Math.max(12, Math.round(median(colDiffs) || median(items.map(function (x) { return x.w; })) || 18));
        var rowsRaw = brBuildRows(items);
        var rowCenters = rowsRaw.map(function (r) { return r.cy; }).sort(function (a, b) { return a - b; });
        var rowDiffs = [];
        for (var j = 1; j < rowCenters.length; j++)
            rowDiffs.push(rowCenters[j] - rowCenters[j - 1]);
        var rowStep = Math.max(10, Math.round(median(rowDiffs) || median(items.map(function (x) { return x.h; })) || 20));
        var minX = Math.min.apply(null, colCenters);
        var minY = Math.min.apply(null, rowCenters);
        var maxCol = 0;
        for (var k = 0; k < items.length; k++) {
            var cidx = Math.round((items[k].x - minX) / colStep);
            if (cidx > maxCol)
                maxCol = cidx;
        }
        var grid = [];
        for (var c = 0; c <= maxCol; c++)
            grid[c] = [null, null, null, null, null, null];
        function scoreCell(item, col, row) {
            var cx = minX + col * colStep;
            var cy = minY + row * rowStep;
            var dist = Math.abs(item.x - cx) + Math.abs(item.y - cy);
            var textBonus = /^[BPTH]$/.test(String(item.rawText || '').toUpperCase()) ? 1000 : 0;
            return textBonus - dist;
        }
        for (var m = 0; m < items.length; m++) {
            var it = items[m];
            var col = Math.round((it.x - minX) / colStep);
            var row = Math.round((it.y - minY) / rowStep);
            if (col < 0) col = 0;
            if (row < 0) row = 0;
            if (row > 5) row = 5;
            var current = grid[col] && grid[col][row];
            if (!current || scoreCell(it, col, row) > scoreCell(current, col, row)) {
                it._col = col;
                it._row = row;
                it._gridX = minX + col * colStep;
                it._gridY = minY + row * rowStep;
                grid[col][row] = it;
            }
        }
        var cols = [];
        for (var cc = 0; cc < grid.length; cc++) {
            var colItems = [];
            for (var rr = 0; rr < 6; rr++) {
                if (grid[cc][rr])
                    colItems.push(grid[cc][rr]);
            }
            if (colItems.length)
                cols.push({ cx: minX + cc * colStep, items: colItems });
        }
        return { grid: grid, cols: cols, rowStep: rowStep, colStep: colStep, minX: minX, minY: minY };
    }
    function brSequenceFromGrid(gridPack) {
        if (!gridPack || !gridPack.cols)
            return '';
        return gridPack.cols.map(function (col) {
            return col.items.map(function (it) {
                return it.v === 'H' ? 'T' : it.v;
            }).join('');
        }).join('');
    }
    function brFindBoardWithProfiles(contexts, screenW, screenH, diagOut) {
        var profiles = [
            { maxXRatio: 0.18, minYRatio: 0.72, maxSize: 34, maxChildren: 2, maxChildKeep: 1, roundRatio: 0.28 },
            { maxXRatio: 0.24, minYRatio: 0.68, maxSize: 38, maxChildren: 3, maxChildKeep: 2, roundRatio: 0.22 },
            { maxXRatio: 0.30, minYRatio: 0.62, maxSize: 42, maxChildren: 4, maxChildKeep: 3, roundRatio: 0.18 }
        ];
        var bestPack = { board: null, markers: [], profile: -1 };
        if (diagOut) {
            diagOut.screen = { w: Number(screenW || 0), h: Number(screenH || 0) };
            diagOut.profiles = [];
            diagOut.contextCount = (contexts || []).length;
        }
        for (var p = 0; p < profiles.length; p++) {
            var allMarkers = [];
            var pdiag = {
                idx: p,
                opts: profiles[p],
                markerCount: 0,
                boardFound: false,
                board: null,
                reason: '',
                contexts: []
            };
            for (var i = 0; i < contexts.length; i++) {
                var ctx = contexts[i];
                var cdiag = {};
                var markers = brCollectMarkersInContext(ctx, profiles[p], cdiag);
                for (var j = 0; j < markers.length; j++) {
                    markers[j].ctxScore = ctx.score || 0;
                    allMarkers.push(markers[j]);
                }
                pdiag.contexts.push({
                    source: String(ctx && ctx.source || ''),
                    href: brHrefShort(ctx && ctx.href || ''),
                    score: Number(ctx && ctx.score || 0),
                    rows: (ctx && ctx.rows && ctx.rows.length) ? ctx.rows.length : 0,
                    scan: cdiag
                });
            }
            pdiag.markerCount = allMarkers.length;
            var board = brPickBoard(allMarkers, screenW, screenH);
            if (board) {
                pdiag.boardFound = true;
                pdiag.board = {
                    score: Number(board.score || 0),
                    itemCount: (board.items && board.items.length) ? board.items.length : 0,
                    rowCount: Number(board.rowCount || 0),
                    colCount: Number(board.colCount || 0),
                    minX: Number(board.minX || 0),
                    minY: Number(board.minY || 0),
                    width: Number(board.width || 0),
                    height: Number(board.height || 0)
                };
                pdiag.reason = 'ok';
                if (diagOut)
                    diagOut.profiles.push(pdiag);
                bestPack = { board: board, markers: allMarkers, profile: p };
                break;
            }
            pdiag.reason = allMarkers.length ? 'marker-found-but-no-board' : 'no-marker';
            if (diagOut)
                diagOut.profiles.push(pdiag);
            if (allMarkers.length > bestPack.markers.length)
                bestPack = { board: null, markers: allMarkers, profile: p };
        }
        if (diagOut) {
            diagOut.bestMarkerProfile = Number(bestPack.profile);
            diagOut.bestMarkerCount = (bestPack.markers && bestPack.markers.length) ? bestPack.markers.length : 0;
        }
        return bestPack;
    }
    var _domBeadSeqManaged = '';
    var _domBeadSeqPrevRaw = '';
    var _domSeqVersion = 0;
    var _domSeqEvent = 'init';
    var _domSeqAppend = '';
    var _domShoeResetPending = false;
    var _domShoeResetAt = 0;
    var _domResetSeedTargetRaw = '';
    var _domResetSeedConsumedRaw = '';
    var _domLastSeedStepAt = 0;
    var _domLastSeedStepVersion = 0;
    var _domLastSeedStepBuildId = 0;
    var _cwSnapshotBuildId = 0;
    var _cwSnapshotBuildSource = '';
    var _cwSeqInstanceId = 'inst-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    var _cwSeqLastPubSyncAt = 0;
    var _cwSeqScriptRev = 'SEQFIX-20260426-r31';
    var _cwSeqRevLogged = false;
    var _domLastActiveTitle = '';
    var _domManagedTableTitle = '';
    var _domLastActiveSeedKey = '';
    var _domLastActiveSeedBurstId = 0;
    var _domTableSwitchWaitBeadPending = false;
    var _domTableSwitchWaitPrevRaw = '';
    var _domNoBoardStreak = 0;
    var _domNoBoardFirstAt = 0;
    var _domNoBoardLastAt = 0;
    var _domNoBoardLastReason = '';
    var _domNoBoardBurstId = 0;
    var _domRawEqPrevStreak = 0;
    var _domRawEqPrevFirstAt = 0;
    var _domRawEqPrevLastAt = 0;
    var _domRawStallLastActiveKey = '';
    var _domLastActiveSeq = '';
    var _domLastActiveSeqTitle = '';
    var _domActiveSeedTailTitle = '';
    var _domActiveSeedTailLen = 0;
    var _domActiveSeedConsumedPrefixLen = 0;
    var _domActiveSeedTailSeq = '';
    var _domLastActiveSeedStepBuildId = 0;
    var _domBoardDeltaQueue = [];
    var _domLastDeltaEnqueueSig = '';
    var _domLastDeltaEnqueueAt = 0;
    var _domLastAdvanceAt = 0;
    var _domLastAdvanceVersion = 0;
    var _domLastAdvanceEvent = '';
    var _domLastAdvanceSeqLen = 0;
    function brResetBoardDeltaQueue(reasonTag) {
        if (_domBoardDeltaQueue.length) {
            cwDbg('SEQFLOW', 'delta-queue-reset', {
                reason: String(reasonTag || ''),
                queueLen: _domBoardDeltaQueue.length,
                seqLen: String(_domBeadSeqManaged || '').length,
                seqVersion: Number(_domSeqVersion || 0),
                seqEvent: String(_domSeqEvent || '')
            }, 0, 'delta-queue-reset|' + String(reasonTag || '') + '|' + Number(_domSeqVersion || 0));
        }
        _domBoardDeltaQueue = [];
        _domLastDeltaEnqueueSig = '';
        _domLastDeltaEnqueueAt = 0;
    }
    function brQueueBoardDelta(deltaRaw, reasonTag, rawNow, rawPrev) {
        var clean = brSanitizeSeq(deltaRaw);
        if (!clean)
            return 0;
        var nowMs = Date.now();
        var sig = String(reasonTag || '') + '|' + String(rawPrev || '') + '|' + String(rawNow || '') + '|' + clean;
        if (sig === _domLastDeltaEnqueueSig && (nowMs - Number(_domLastDeltaEnqueueAt || 0)) <= 1200) {
            cwDbg('SEQFLOW', 'delta-enqueue-skip-dup', {
                reason: String(reasonTag || ''),
                delta: clean,
                queueLen: _domBoardDeltaQueue.length,
                seqLen: String(_domBeadSeqManaged || '').length,
                seqVersion: Number(_domSeqVersion || 0)
            }, 0, 'delta-enqueue-skip-dup|' + String(reasonTag || '') + '|' + Number(_domSeqVersion || 0));
            return 0;
        }
        _domLastDeltaEnqueueSig = sig;
        _domLastDeltaEnqueueAt = nowMs;
        var add = 0;
        for (var i = 0; i < clean.length; i++) {
            var ch = clean.charAt(i);
            if (ch !== 'B' && ch !== 'P' && ch !== 'T')
                continue;
            if (_domBoardDeltaQueue.length >= 32)
                _domBoardDeltaQueue.shift();
            _domBoardDeltaQueue.push(ch);
            add++;
        }
        if (add > 0) {
            cwDbg('SEQFLOW', 'delta-enqueue', {
                reason: String(reasonTag || ''),
                delta: clean,
                add: add,
                queueLen: _domBoardDeltaQueue.length,
                rawPrev: String(rawPrev || ''),
                rawNow: String(rawNow || ''),
                seqLen: String(_domBeadSeqManaged || '').length,
                seqVersion: Number(_domSeqVersion || 0)
            }, 0, 'delta-enqueue|' + String(reasonTag || '') + '|' + add + '|' + Number(_domSeqVersion || 0));
        }
        return add;
    }
    function brDrainBoardDeltaQueue(reasonTag) {
        if (!_domBoardDeltaQueue.length)
            return false;
        var ch = String(_domBoardDeltaQueue.shift() || '');
        if (!ch)
            return false;
        var ok = brAppendManaged(ch, 'append-delta-queue');
        if (ok) {
            cwDbg('SEQFLOW', 'delta-drain', {
                reason: String(reasonTag || ''),
                delta: ch,
                queueRemain: _domBoardDeltaQueue.length,
                seqLen: String(_domBeadSeqManaged || '').length,
                seqVersion: Number(_domSeqVersion || 0),
                seqEvent: String(_domSeqEvent || '')
            }, 0, 'delta-drain|' + String(reasonTag || '') + '|' + ch + '|' + Number(_domSeqVersion || 0));
        }
        return ok;
    }
    function brResetActiveSeedTailTracker() {
        _domActiveSeedTailTitle = '';
        _domActiveSeedTailLen = 0;
        _domActiveSeedConsumedPrefixLen = 0;
        _domActiveSeedTailSeq = '';
        _domLastActiveSeedStepBuildId = 0;
    }
    function brResetSeedTracker() {
        _domResetSeedTargetRaw = '';
        _domResetSeedConsumedRaw = '';
        brResetActiveSeedTailTracker();
        brResetBoardDeltaQueue('seed-reset');
    }
    function brArmShoeResetByNoBoard(reason) {
        var nowMs = Date.now();
        var reasonText = String(reason || '');
        if (reasonText === _domNoBoardLastReason && (nowMs - Number(_domNoBoardLastAt || 0)) <= 1500) {
            if (!_domNoBoardFirstAt)
                _domNoBoardFirstAt = nowMs;
            _domNoBoardStreak = Number(_domNoBoardStreak || 0) + 1;
        } else {
            _domNoBoardStreak = 1;
            _domNoBoardFirstAt = nowMs;
            _domNoBoardLastReason = reasonText;
            _domNoBoardBurstId = Number(_domNoBoardBurstId || 0) + 1;
        }
        _domNoBoardLastAt = nowMs;
        var prevLen = String(_domBeadSeqPrevRaw || '').length;
        var managedLen = String(_domBeadSeqManaged || '').length;
        var evtNow = String(_domSeqEvent || '');
        var noBoardBurstMs = _domNoBoardFirstAt ? (nowMs - _domNoBoardFirstAt) : 0;
        var rawEqBurstMs = _domRawEqPrevFirstAt ? (nowMs - _domRawEqPrevFirstAt) : 0;
        var forceArmShort = (
            (_domNoBoardStreak >= 3 && noBoardBurstMs <= 5000) ||
            (_domRawEqPrevStreak >= 6 && rawEqBurstMs <= 8000)
        );
        var allowShortByContext = (evtNow.indexOf('table-switch-reset') === 0 || evtNow.indexOf('shoe-reset-arm') === 0 || forceArmShort);
        if (_domShoeResetPending)
            return false;
        // Chỉ arm khi trước đó đã có board/chuỗi đủ dài để tránh trigger nhầm lúc mới mở app.
        if (prevLen < 8 && managedLen < 10 && !allowShortByContext) {
            _domSeqEvent = 'shoe-reset-arm-skip-short';
            _domSeqAppend = '';
            cwDbg('SEQ', 'shoe-reset-arm-skip-short-seq', {
                reason: reasonText,
                prevLen: prevLen,
                managedLen: managedLen,
                seqEvent: evtNow,
                allowShortByContext: allowShortByContext ? 1 : 0,
                noBoardStreak: Number(_domNoBoardStreak || 0),
                noBoardBurstMs: Number(noBoardBurstMs || 0),
                rawEqPrevStreak: Number(_domRawEqPrevStreak || 0),
                rawEqBurstMs: Number(rawEqBurstMs || 0)
            }, 1500, 'reset-arm-skip-short|' + String(reason || '') + '|' + prevLen + '|' + managedLen + '|' + evtNow);
            brPublishSeqState();
            return false;
        }
        _domShoeResetPending = true;
        _domShoeResetAt = nowMs;
        brResetSeedTracker();
        _domRawStallLastActiveKey = '';
        _domSeqEvent = 'shoe-reset-arm-no-board';
        try {
            var mergeStat = brSeqStats(raw);
            if (raw && raw.length <= 12 && (_domTableSwitchWaitBeadPending || _domShoeResetPending || mergeStat.t > 0 || mergeStat.bp <= 2)) {
                brSeqDiagPost('merge-enter-short-raw', {
                    raw: raw,
                    rawLen: raw.length,
                    rawBP: Number(mergeStat.bp || 0),
                    rawT: Number(mergeStat.t || 0),
                    prevRaw: String(prev || ''),
                    managedBefore: beforeState.managed,
                    managedBeforeLen: beforeState.managedLen,
                    waitBead: _domTableSwitchWaitBeadPending ? 1 : 0,
                    resetPending: _domShoeResetPending ? 1 : 0,
                    seqVersion: Number(_domSeqVersion || 0),
                    seqEvent: String(_domSeqEvent || ''),
                    buildId: Number(_cwSnapshotBuildId || 0),
                    buildSource: String(_cwSnapshotBuildSource || '')
                }, 700, 'merge-enter-short-raw|' + raw + '|' + Number(_domSeqVersion || 0) + '|' + String(_domSeqEvent || ''));
            }
        } catch (_) {}
        _domSeqAppend = '';
        cwDbg('SEQ', 'shoe-reset-arm by no-board', {
            reason: String(reason || ''),
            prevLen: prevLen,
            managedLen: managedLen,
            noBoardStreak: Number(_domNoBoardStreak || 0),
            noBoardBurstMs: Number(noBoardBurstMs || 0),
            rawEqPrevStreak: Number(_domRawEqPrevStreak || 0),
            rawEqBurstMs: Number(rawEqBurstMs || 0),
            forceArmShort: forceArmShort ? 1 : 0
        }, 1200, 'reset-arm-no-board|' + String(reason || '') + '|' + prevLen + '|' + managedLen);
        brPublishSeqState();
        return true;
    }
    function brOverlapSuffixPrefix(a, b) {
        a = String(a || '');
        b = String(b || '');
        var max = Math.min(a.length, b.length);
        for (var k = max; k >= 1; k--) {
            if (a.slice(a.length - k) === b.slice(0, k))
                return k;
        }
        return 0;
    }
    function brGetLastPushedSeqVersion() {
        var v = 0;
        try {
            if (typeof _lastPushSeqVersion !== 'undefined')
                v = Number(_lastPushSeqVersion || 0) || 0;
        } catch (_) {}
        if (!v) {
            try {
                v = Number(window.__cw_last_push_seq_version || 0) || 0;
            } catch (_) {}
        }
        return Number(v || 0) || 0;
    }
    function brSanitizeSeq(raw) {
        return String(raw || '')
            .toUpperCase()
            .replace(/H/g, 'T')
            .replace(/[^BPT]/g, '');
    }
    function normalizeSeqNoLimit(raw) {
        return brSanitizeSeq(raw);
    }
    function brSeqStats(raw) {
        var s = String(raw || '').toUpperCase();
        var b = 0, p = 0, t = 0, h = 0, other = 0;
        for (var i = 0; i < s.length; i++) {
            var ch = s.charAt(i);
            if (ch === 'B') b++;
            else if (ch === 'P') p++;
            else if (ch === 'T') t++;
            else if (ch === 'H') h++;
            else other++;
        }
        return { b: b, p: p, t: t, h: h, other: other, bp: b + p };
    }
    function brBuildSeqCountGuardFromValues(countB, countP, countT, title) {
        function asCount(v) {
            if (v == null || v === '')
                return null;
            var n = Number(v);
            if (!isFinite(n) || n < 0 || Math.floor(n) !== n || n > 120)
                return null;
            return n;
        }
        var b = asCount(countB);
        var p = asCount(countP);
        var t = asCount(countT);
        if (b == null || p == null || t == null)
            return null;
        return {
            b: b,
            p: p,
            t: t,
            total: b + p + t,
            title: String(title || '')
        };
    }
    function brBuildSeqCountGuardFromCard(card) {
        if (!card)
            return null;
        return brBuildSeqCountGuardFromValues(card.B, card.P, card.T, card.title);
    }
    function brSeqMatchesCountsExactly(raw, guard) {
        if (!guard)
            return false;
        var clean = brSanitizeSeq(raw);
        var st = brSeqStats(clean);
        return clean.length === Number(guard.total || 0) &&
            st.b === Number(guard.b || 0) &&
            st.p === Number(guard.p || 0) &&
            st.t === Number(guard.t || 0) &&
            st.h === 0 &&
            st.other === 0;
    }
    function brClampSeqToCounts(raw, guard) {
        var clean = brSanitizeSeq(raw);
        if (!guard)
            return clean;
        var quota = {
            B: Number(guard.b || 0),
            P: Number(guard.p || 0),
            T: Number(guard.t || 0)
        };
        var total = Number(guard.total || 0);
        if (total <= 0)
            return '';
        var out = '';
        for (var i = 0; i < clean.length; i++) {
            var ch = clean.charAt(i);
            if (quota[ch] > 0) {
                out += ch;
                quota[ch]--;
                if (out.length >= total)
                    break;
            }
        }
        return out;
    }
    function brApplySeqCountGuard(raw, guard, sourceTag) {
        var clean = brSanitizeSeq(raw);
        if (!guard)
            return { seq: clean, changed: false, reason: 'no-count-guard' };
        var total = Number(guard.total || 0);
        if (!clean)
            return { seq: '', changed: false, reason: total <= 0 ? 'empty-count-zero' : 'empty' };
        var st = brSeqStats(clean);
        var exceeds = clean.length > total ||
            st.b > Number(guard.b || 0) ||
            st.p > Number(guard.p || 0) ||
            st.t > Number(guard.t || 0) ||
            st.h > 0 ||
            st.other > 0;
        if (!exceeds)
            return { seq: clean, changed: false, reason: 'within-count' };
        var clamped = brClampSeqToCounts(clean, guard);
        try {
            brSeqDiagPost('count-guard-clamp', {
                source: String(sourceTag || ''),
                title: String(guard.title || ''),
                raw: clean,
                rawLen: clean.length,
                clamped: clamped,
                clampedLen: clamped.length,
                countB: Number(guard.b || 0),
                countP: Number(guard.p || 0),
                countT: Number(guard.t || 0),
                total: total,
                seqVersion: Number(_domSeqVersion || 0),
                seqEvent: String(_domSeqEvent || ''),
                buildId: Number(_cwSnapshotBuildId || 0),
                buildSource: String(_cwSnapshotBuildSource || '')
            }, 400, 'count-guard-clamp|' + String(sourceTag || '') + '|' + clean + '|' + clamped + '|' + total);
        } catch (_) {}
        return {
            seq: clamped,
            changed: clamped !== clean,
            reason: total <= 0 ? 'count-zero' : 'count-exceeded'
        };
    }
    function brRebaseManagedByCountGuard(seq, guard, sourceTag, beforeSeq) {
        var clean = brSanitizeSeq(seq);
        var before = String(beforeSeq != null ? beforeSeq : (_domBeadSeqManaged || ''));
        if (before === clean)
            return false;
        _domBeadSeqManaged = clean;
        _domBeadSeqPrevRaw = clean;
        _domTableSwitchWaitBeadPending = false;
        _domTableSwitchWaitPrevRaw = '';
        _domSeqAppend = '';
        _domSeqVersion = Math.max(Number(_domSeqVersion || 0) + 1, clean.length);
        _domSeqEvent = 'count-guard-rebase';
        _domShoeResetPending = clean ? false : true;
        _domShoeResetAt = clean ? 0 : Date.now();
        brResetSeedTracker();
        brResetActiveSeedTailTracker();
        brResetBoardDeltaQueue('count-guard-rebase');
        try {
            window.__cw_bead_raw_seq = clean;
            window.__cw_bead_managed_seq = clean;
        } catch (_) {}
        brSeqDiagPost('count-guard-rebase', {
            source: String(sourceTag || ''),
            title: String(guard && guard.title || ''),
            before: before,
            beforeLen: before.length,
            seq: clean,
            seqLen: clean.length,
            countB: Number(guard && guard.b || 0),
            countP: Number(guard && guard.p || 0),
            countT: Number(guard && guard.t || 0),
            total: Number(guard && guard.total || 0),
            seqVersion: Number(_domSeqVersion || 0),
            buildId: Number(_cwSnapshotBuildId || 0),
            buildSource: String(_cwSnapshotBuildSource || '')
        }, 0, 'count-guard-rebase|' + String(sourceTag || '') + '|' + before + '|' + clean + '|' + Number(_domSeqVersion || 0));
        brPublishSeqState();
        return true;
    }
    function brIsReliableRoadSeq(raw) {
        var clean = brSanitizeSeq(raw);
        if (!clean)
            return false;
        var st = brSeqStats(clean);
        return st.bp > 0 && st.t < clean.length && st.h === 0 && st.other === 0;
    }
    function brIsTrustedTinyBoardSeq(raw) {
        var clean = brSanitizeSeq(raw);
        // A one-bead board is not stable right after joining/switching tables: the DOM often
        // paints the first bead before the rest of the tiny road, which previously seeded "B"
        // for tables whose real initial road was "BP".
        return clean.length >= 2 && clean.length <= 3 && brIsReliableRoadSeq(clean);
    }
    function brRecentNoBoardAgeMs() {
        var now = Date.now();
        var lastDiagAt = 0;
        try {
            lastDiagAt = Number(_cwSeqDiagState && _cwSeqDiagState.lastNoBoard && _cwSeqDiagState.lastNoBoard.at || 0);
        } catch (_) {
            lastDiagAt = 0;
        }
        var lastAt = Math.max(Number(_domNoBoardLastAt || 0), lastDiagAt);
        return lastAt > 0 ? (now - lastAt) : -1;
    }
    function brShouldBlockActiveTinyByNoBoard(sourceTag, activeTitle, activeSeq, beadRawSeq) {
        var clean = brSanitizeSeq(activeSeq);
        if (!brIsTrustedTinyBoardSeq(clean))
            return false;
        var beadRaw = brSanitizeSeq(beadRawSeq || '');
        var evt = String(_domSeqEvent || '');
        var ageMs = brRecentNoBoardAgeMs();
        var block = !!(
            _domShoeResetPending ||
            evt.indexOf('shoe-reset-arm') === 0 ||
            evt.indexOf('board-empty') >= 0 ||
            evt.indexOf('no-board') >= 0 ||
            (ageMs >= 0 && ageMs <= 12000 && !beadRaw) ||
            (!beadRaw && Number(_domNoBoardStreak || 0) > 0)
        );
        if (!block)
            return false;
        cwDbg('SEQSRC', 'active-tiny-no-board-block', {
            source: String(sourceTag || ''),
            title: String(activeTitle || ''),
            activeSeq: clean,
            activeSeqLen: clean.length,
            beadRawLen: beadRaw.length,
            resetPending: _domShoeResetPending ? 1 : 0,
            seqEvent: evt,
            noBoardStreak: Number(_domNoBoardStreak || 0),
            noBoardAgeMs: ageMs,
            buildSource: String(_cwSnapshotBuildSource || ''),
            buildId: Number(_cwSnapshotBuildId || 0)
        }, 0, 'active-tiny-no-board-block|' + String(sourceTag || '') + '|' + clean + '|' + Number(_domSeqVersion || 0));
        brSeqDiagPost('active-tiny-no-board-block', {
            source: String(sourceTag || ''),
            title: String(activeTitle || ''),
            activeSeq: clean,
            activeSeqLen: clean.length,
            beadRawLen: beadRaw.length,
            resetPending: _domShoeResetPending ? 1 : 0,
            seqEvent: evt,
            noBoardStreak: Number(_domNoBoardStreak || 0),
            noBoardAgeMs: ageMs,
            buildSource: String(_cwSnapshotBuildSource || ''),
            buildId: Number(_cwSnapshotBuildId || 0)
        }, 0, 'active-tiny-no-board-block|' + String(sourceTag || '') + '|' + clean + '|' + Number(_domSeqVersion || 0));
        return true;
    }
    function brApplyTableSwitchTinyBoard(raw, activeTitle, sourceTag, beforeState) {
        var clean = brSanitizeSeq(raw);
        if (!brIsTrustedTinyBoardSeq(clean))
            return '';
        var title = String(activeTitle || _domManagedTableTitle || '').trim();
        var before = beforeState || {
            managed: String(_domBeadSeqManaged || ''),
            managedLen: String(_domBeadSeqManaged || '').length,
            resetPending: _domShoeResetPending ? 1 : 0,
            seqVersion: Number(_domSeqVersion || 0),
            seqEvent: String(_domSeqEvent || '')
        };
        _domBeadSeqManaged = clean;
        _domBeadSeqPrevRaw = clean;
        _domTableSwitchWaitBeadPending = false;
        _domTableSwitchWaitPrevRaw = '';
        _domShoeResetPending = false;
        _domShoeResetAt = 0;
        brResetSeedTracker();
        if (title)
            _domManagedTableTitle = title;
        _domLastActiveSeedKey = brBuildActiveSeedKey(title || _domManagedTableTitle, clean);
        _domLastActiveSeedBurstId = Number(_domNoBoardBurstId || 0);
        _domRawStallLastActiveKey = '';
        _domSeqVersion = Math.max(Number(_domSeqVersion || 0) + 1, clean.length);
        _domSeqEvent = 'table-switch-tiny-board-bootstrap';
        _domSeqAppend = clean;
        brMarkSeqAdvance(_domSeqEvent);
        try {
            window.__cw_bead_raw_seq = clean;
            window.__cw_bead_managed_seq = clean;
        } catch (_) {}
        brPublishSeqState();
        cwDbg('SEQSRC', 'table-switch-tiny-board-bootstrap', {
            source: String(sourceTag || ''),
            title: title,
            raw: clean,
            rawLen: clean.length,
            beforeManagedLen: Number(before.managedLen || 0),
            beforeEvent: String(before.seqEvent || ''),
            seqVersion: Number(_domSeqVersion || 0),
            seqEvent: String(_domSeqEvent || '')
        }, 0, 'table-switch-tiny-board-bootstrap|' + clean + '|' + Number(_domSeqVersion || 0));
        brSeqDiagPost('table-switch-tiny-board-bootstrap', {
            source: String(sourceTag || ''),
            title: title,
            raw: clean,
            rawLen: clean.length,
            seq: String(_domBeadSeqManaged || ''),
            seqLen: String(_domBeadSeqManaged || '').length,
            seqVersion: Number(_domSeqVersion || 0),
            seqEvent: String(_domSeqEvent || ''),
            beforeManaged: before.managed,
            beforeManagedLen: Number(before.managedLen || 0)
        }, 0, 'table-switch-tiny-board-bootstrap|' + clean + '|' + Number(_domSeqVersion || 0));
        return _domBeadSeqManaged;
    }
    function brBuildActiveSeedKey(title, seq) {
        return String(title || '').trim() + '|' + brSanitizeSeq(seq || '');
    }
    function brMarkSeqAdvance(eventName) {
        _domLastAdvanceAt = Date.now();
        _domLastAdvanceVersion = Number(_domSeqVersion || 0) || 0;
        _domLastAdvanceEvent = String(eventName || _domSeqEvent || 'append');
        _domLastAdvanceSeqLen = String(_domBeadSeqManaged || '').length;
    }
    function brPublishSeqState() {
        var managed = String(_domBeadSeqManaged || '');
        var ver = Number(_domSeqVersion || 0) || 0;
        var evt = String(_domSeqEvent || '');
        var incomingLen = managed.length;
        var buildSource = String(_cwSnapshotBuildSource || '');
        var buildId = Number(_cwSnapshotBuildId || 0);
        var allowPublish = true;
        var staleReason = '';
        try {
            var pub = window.__cw_seq_pub || null;
            if (pub) {
                var pubVer = Number(pub.ver || 0) || 0;
                var pubLen = Number(pub.len || 0) || 0;
                if (ver < pubVer) {
                    allowPublish = false;
                    staleReason = 'version-older';
                } else if (ver === pubVer && incomingLen < pubLen) {
                    allowPublish = false;
                    staleReason = 'length-older';
                }
            }
        } catch (_) {}
        if (!allowPublish) {
            // Context cũ (thường buildId=0/source='') không được phép đè global seq state.
            try {
                var nowMs = Date.now();
                if ((nowMs - Number(_cwSeqLastPubSyncAt || 0)) >= 1000) {
                    _cwSeqLastPubSyncAt = nowMs;
                    cwDbg('SEQFLOW', 'publish-skip-stale', {
                        reason: staleReason,
                        instanceId: _cwSeqInstanceId,
                        ver: ver,
                        seqLen: incomingLen,
                        evt: evt,
                        buildId: buildId,
                        buildSource: buildSource
                    }, 0, 'publish-skip-stale|' + staleReason + '|' + ver + '|' + incomingLen + '|' + buildId);
                }
            } catch (_) {}
            return;
        }
        try {
            window.__cw_seq = managed;
            window.__cw_seq_version = ver;
            window.__cw_seq_event = evt;
            window.__cw_seq_append = _domSeqAppend;
            window.__cw_seq_board_prev = _domBeadSeqPrevRaw;
            window.__cw_seq_reset_pending = _domShoeResetPending ? 1 : 0;
            window.__cw_seq_pub = {
                seq: managed,
                ver: ver,
                len: incomingLen,
                evt: evt,
                append: String(_domSeqAppend || ''),
                boardPrev: String(_domBeadSeqPrevRaw || ''),
                resetPending: _domShoeResetPending ? 1 : 0,
                activeSeedKey: String(_domLastActiveSeedKey || ''),
                activeSeedBurstId: Number(_domLastActiveSeedBurstId || 0),
                noBoardBurstId: Number(_domNoBoardBurstId || 0),
                rawStallActiveKey: String(_domRawStallLastActiveKey || ''),
                activeSeedTailTitle: String(_domActiveSeedTailTitle || ''),
                activeSeedTailLen: Number(_domActiveSeedTailLen || 0),
                activeSeedConsumedPrefixLen: Number(_domActiveSeedConsumedPrefixLen || 0),
                activeSeedTailSeq: String(_domActiveSeedTailSeq || ''),
                activeSeedStepBuildId: Number(_domLastActiveSeedStepBuildId || 0),
                managedTitle: String(_domManagedTableTitle || ''),
                buildId: buildId,
                buildSource: buildSource,
                instanceId: _cwSeqInstanceId,
                rev: _cwSeqScriptRev,
                ts: Date.now()
            };
        } catch (_) {}
    }
    function brSyncFromPublishedState(syncReason) {
        try {
            var pub = window.__cw_seq_pub || null;
            if (!pub)
                return false;
            var pubSeq = brSanitizeSeq(pub.seq || '');
            if (!pubSeq)
                return false;
            var pubVer = Number(pub.ver || 0) || 0;
            var pubLen = Number(pub.len || pubSeq.length || 0) || 0;
            var localSeq = String(_domBeadSeqManaged || '');
            var localVer = Number(_domSeqVersion || 0) || 0;
            var localLen = localSeq.length;
            var shouldAdopt = (pubVer > localVer) || (pubVer === localVer && pubLen > localLen);
            if (!shouldAdopt)
                return false;
            _domBeadSeqManaged = pubSeq;
            _domSeqVersion = pubVer;
            _domSeqEvent = String(pub.evt || _domSeqEvent || 'sync-published');
            _domSeqAppend = String(pub.append || '');
            _domBeadSeqPrevRaw = brSanitizeSeq(pub.boardPrev || _domBeadSeqPrevRaw || '');
            _domShoeResetPending = !!Number(pub.resetPending || 0);
            _domLastActiveSeedKey = String(pub.activeSeedKey || _domLastActiveSeedKey || '');
            _domLastActiveSeedBurstId = Number(pub.activeSeedBurstId || _domLastActiveSeedBurstId || 0);
            _domNoBoardBurstId = Number(pub.noBoardBurstId || _domNoBoardBurstId || 0);
            _domRawStallLastActiveKey = String(pub.rawStallActiveKey || _domRawStallLastActiveKey || '');
            _domActiveSeedTailTitle = String(pub.activeSeedTailTitle || _domActiveSeedTailTitle || '');
            _domActiveSeedTailLen = Number(pub.activeSeedTailLen || _domActiveSeedTailLen || 0);
            _domActiveSeedConsumedPrefixLen = Number(pub.activeSeedConsumedPrefixLen || _domActiveSeedConsumedPrefixLen || 0);
            _domActiveSeedTailSeq = String(pub.activeSeedTailSeq || _domActiveSeedTailSeq || '');
            _domLastActiveSeedStepBuildId = Number(pub.activeSeedStepBuildId || _domLastActiveSeedStepBuildId || 0);
            _domManagedTableTitle = String(pub.managedTitle || _domManagedTableTitle || '');
            cwDbg('SEQFLOW', 'sync-from-published', {
                reason: String(syncReason || ''),
                fromInstanceId: String(pub.instanceId || ''),
                localInstanceId: _cwSeqInstanceId,
                pubVer: pubVer,
                pubLen: pubLen,
                localVerBefore: localVer,
                localLenBefore: localLen,
                buildId: Number(_cwSnapshotBuildId || 0),
                buildSource: String(_cwSnapshotBuildSource || '')
            }, 0, 'sync-from-published|' + pubVer + '|' + pubLen + '|' + String(syncReason || ''));
            return true;
        } catch (_) {
            return false;
        }
    }
    function brSeqTrace(branch, raw, prev, beforeState, extra, throttleMs, keySuffix) {
        try {
            var afterState = {
                managed: String(_domBeadSeqManaged || ''),
                managedLen: String(_domBeadSeqManaged || '').length,
                resetPending: _domShoeResetPending ? 1 : 0,
                seqVersion: Number(_domSeqVersion || 0),
                seqEvent: String(_domSeqEvent || '')
            };
            var payload = {
                branch: String(branch || ''),
                raw: String(raw || ''),
                rawLen: String(raw || '').length,
                prev: String(prev || ''),
                prevLen: String(prev || '').length,
                managedBefore: String(beforeState && beforeState.managed || ''),
                managedAfter: afterState.managed,
                managedLenBefore: Number(beforeState && beforeState.managedLen || 0),
                managedLenAfter: Number(afterState.managedLen || 0),
                resetPendingBefore: Number(beforeState && beforeState.resetPending || 0),
                resetPendingAfter: Number(afterState.resetPending || 0),
                seqVersionBefore: Number(beforeState && beforeState.seqVersion || 0),
                seqVersionAfter: Number(afterState.seqVersion || 0),
                seqEventBefore: String(beforeState && beforeState.seqEvent || ''),
                seqEventAfter: String(afterState.seqEvent || '')
            };
            if (extra && typeof extra === 'object') {
                for (var k in extra) {
                    if (Object.prototype.hasOwnProperty.call(extra, k))
                        payload[k] = extra[k];
                }
            }
            cwDbg('SEQTRACE', String(branch || ''), payload, Number(throttleMs || 0), 'seqtrace|' + String(branch || '') + '|' + String(keySuffix || ''));
        } catch (_) {}
    }
    function brAppendManaged(delta, eventName) {
        var clean = brSanitizeSeq(delta);
        if (!clean)
            return false;
        var beforeSeq = String(_domBeadSeqManaged || '');
        var beforeState = {
            managed: beforeSeq,
            managedLen: beforeSeq.length,
            resetPending: _domShoeResetPending ? 1 : 0,
            seqVersion: Number(_domSeqVersion || 0),
            seqEvent: String(_domSeqEvent || '')
        };
        var nextSeq = beforeSeq + clean;
        // Không tăng seqVersion nếu append không làm đổi chuỗi (tránh spam round/settle).
        if (nextSeq === beforeSeq) {
            _domSeqEvent = 'no-change';
            _domSeqAppend = '';
            brSeqTrace('append-no-change', clean, _domBeadSeqPrevRaw, beforeState, {
                delta: clean,
                eventName: String(eventName || 'append')
            }, 0, 'append-no-change|' + clean);
            brPublishSeqState();
            return false;
        }
        _domBeadSeqManaged = nextSeq;
        _domSeqVersion += clean.length;
        _domSeqEvent = String(eventName || 'append');
        _domSeqAppend = clean;
        brMarkSeqAdvance(_domSeqEvent);
        // Seed trong giai đoạn reset: giữ pending để không arm lại liên tục khi board còn fail.
        var evt = String(eventName || '');
        _domShoeResetPending = (evt.indexOf('append-reset-seed') === 0);
        if (evt === 'append-reset-seed-step') {
            _domLastSeedStepAt = Date.now();
            _domLastSeedStepVersion = Number(_domSeqVersion || 0);
            _domLastSeedStepBuildId = Number(_cwSnapshotBuildId || 0);
        }
        cwDbg('SEQ', 'append ' + String(eventName || 'append'), {
            delta: clean,
            seq: _domBeadSeqManaged,
            seqLen: _domBeadSeqManaged.length,
            seqVersion: _domSeqVersion
        }, 0, 'append|' + clean + '|' + _domSeqVersion);
        brSeqTrace('append-managed', clean, _domBeadSeqPrevRaw, beforeState, {
            delta: clean,
            eventName: String(eventName || 'append')
        }, 0, 'append-managed|' + clean + '|' + _domSeqVersion);
        brPublishSeqState();
        return true;
    }
    function brBuildSeqSnapshotContract(seqEvent) {
        var evt = String(seqEvent || '');
        var append = brSanitizeSeq(_domSeqAppend || '');
        var mode = 'hold';
        if (/^append|dom-baccarat-extend|append-delta-queue|append-reconcile-bead/i.test(evt)) {
            mode = append ? 'append' : 'hold';
        } else if (/table-switch-reset|table-switch-bead-authority|table-switch-tiny-board-bootstrap|short-board-bootstrap-authority|hydrate-init|count-guard-rebase/i.test(evt)) {
            mode = 'full-rebase';
        } else if (/table-switch-wait-bead|shoe-reset-arm|board-empty|no-board|post-reset-hold|reset-seed-wait|no-change|hold/i.test(evt)) {
            mode = 'hold';
        }
        if (mode !== 'append')
            append = '';
        return {
            mode: mode,
            append: append
        };
    }
    function brMergeManagedSeq(rawSeq) {
        var rawInput = String(rawSeq || '');
        var raw = brSanitizeSeq(rawSeq);
        var prev = _domBeadSeqPrevRaw;
        var beforeState = {
            managed: String(_domBeadSeqManaged || ''),
            managedLen: String(_domBeadSeqManaged || '').length,
            resetPending: _domShoeResetPending ? 1 : 0,
            seqVersion: Number(_domSeqVersion || 0),
            seqEvent: String(_domSeqEvent || '')
        };
        brSeqTrace('merge-enter', raw, prev, beforeState, {
            rawInputLen: rawInput.length,
            rawInput: cwShort(rawInput, 120)
        }, 400, 'merge-enter|' + raw + '|' + prev);
        _domSeqAppend = '';
        if (rawInput && !raw) {
            cwDbg('SEQ', 'raw-parse-invalid', {
                rawInput: cwShort(rawInput, 180),
                rawInputLen: rawInput.length,
                managedLen: String(_domBeadSeqManaged || '').length,
                prevLen: String(prev || '').length
            }, 700, 'raw-parse-invalid|' + rawInput.length);
        } else if (rawInput && raw && rawInput !== raw) {
            cwDbg('SEQ', 'raw-sanitized', {
                rawInput: cwShort(rawInput, 120),
                rawSanitized: cwShort(raw, 120),
                rawInputLen: rawInput.length,
                rawLen: raw.length
            }, 900, 'raw-sanitized|' + rawInput.length + '|' + raw.length);
        }

        if (!raw) {
            brResetBoardDeltaQueue('raw-empty');
            if (prev && prev.length >= 8) {
                _domShoeResetPending = true;
                _domShoeResetAt = Date.now();
                brResetSeedTracker();
                _domSeqEvent = 'shoe-reset-arm';
                cwDbg('SEQ', 'shoe-reset-arm by empty board', {
                    prevLen: prev.length,
                    managedLen: (_domBeadSeqManaged || '').length
                }, 0, 'reset-arm-empty|' + prev.length);
            } else {
                _domSeqEvent = 'board-empty';
                cwDbg('SEQ', 'board-empty', {
                    prevLen: prev ? prev.length : 0,
                    managedLen: (_domBeadSeqManaged || '').length
                }, 1500, 'board-empty');
            }
            _domBeadSeqPrevRaw = '';
            brSeqTrace('return-empty-raw', raw, prev, beforeState, null, 0, 'return-empty-raw|' + prev.length);
            brPublishSeqState();
            return _domBeadSeqManaged;
        }

        if (_domTableSwitchWaitBeadPending && !brSanitizeSeq(_domBeadSeqManaged || '')) {
            if (brIsTrustedTinyBoardSeq(raw)) {
                brSeqTrace('return-table-switch-tiny-board-bootstrap', raw, prev, beforeState, {
                    rawLen: raw.length,
                    waitPrevRawLen: String(_domTableSwitchWaitPrevRaw || '').length
                }, 0, 'return-table-switch-tiny-board-bootstrap|' + raw + '|' + Number(_domSeqVersion || 0));
                return brApplyTableSwitchTinyBoard(raw, _domManagedTableTitle, 'bead-raw', beforeState);
            }
            if (_domTableSwitchWaitPrevRaw && raw === _domTableSwitchWaitPrevRaw) {
                _domSeqEvent = 'table-switch-wait-bead';
                _domSeqAppend = '';
                brSeqDiagPost('table-switch-stale-raw-block', {
                    raw: raw,
                    rawLen: raw.length,
                    waitPrevRaw: String(_domTableSwitchWaitPrevRaw || ''),
                    waitPrevRawLen: String(_domTableSwitchWaitPrevRaw || '').length,
                    managedLen: String(_domBeadSeqManaged || '').length,
                    seqVersion: Number(_domSeqVersion || 0),
                    seqEvent: String(_domSeqEvent || ''),
                    buildId: Number(_cwSnapshotBuildId || 0),
                    buildSource: String(_cwSnapshotBuildSource || '')
                }, 500, 'table-switch-stale-raw-block|' + raw.length + '|' + Number(_domSeqVersion || 0));
                brPublishSeqState();
                return '';
            }
        }

        // Seed sau shoe-reset theo từng ký tự để không nuốt ván đầu khi board trả về chuỗi ngắn (thường 2..5 ký tự).
        if (_domShoeResetPending && raw.length <= 8) {
            var emptyManagedShortBootstrap = !brSanitizeSeq(_domBeadSeqManaged || '') &&
                !brSanitizeSeq(prev || '') &&
                raw.length >= 2 &&
                raw.length <= 12 &&
                brIsReliableRoadSeq(raw);
            if (emptyManagedShortBootstrap) {
                _domBeadSeqManaged = normalizeSeqNoLimit(raw);
                _domBeadSeqPrevRaw = raw;
                _domShoeResetPending = false;
                _domTableSwitchWaitBeadPending = false;
                _domShoeResetAt = 0;
                brResetSeedTracker();
                _domLastActiveSeedKey = brBuildActiveSeedKey(_domManagedTableTitle, raw);
                _domLastActiveSeedBurstId = Number(_domNoBoardBurstId || 0);
                _domSeqVersion = Math.max(Number(_domSeqVersion || 0) + 1, String(_domBeadSeqManaged || '').length);
                _domSeqEvent = 'short-board-bootstrap-authority';
                _domSeqAppend = String(_domBeadSeqManaged || '');
                brMarkSeqAdvance(_domSeqEvent);
                brSeqTrace('return-short-board-bootstrap-authority', raw, prev, beforeState, {
                    rawLen: raw.length,
                    bootstrap: 1
                }, 0, 'return-short-board-bootstrap-authority|' + raw + '|' + Number(_domSeqVersion || 0));
                cwDbg('SEQSRC', 'short-board-bootstrap-authority', {
                    raw: raw,
                    rawLen: raw.length,
                    seqLen: String(_domBeadSeqManaged || '').length,
                    seqVersion: Number(_domSeqVersion || 0),
                    seqEvent: String(_domSeqEvent || ''),
                    buildId: Number(_cwSnapshotBuildId || 0),
                    buildSource: String(_cwSnapshotBuildSource || '')
                }, 0, 'short-board-bootstrap-authority|' + Number(_domSeqVersion || 0) + '|' + raw);
                brSeqDiagPost('merge-accept-short-board-bootstrap', {
                    raw: raw,
                    rawLen: raw.length,
                    seq: String(_domBeadSeqManaged || ''),
                    seqLen: String(_domBeadSeqManaged || '').length,
                    seqVersion: Number(_domSeqVersion || 0),
                    seqEvent: String(_domSeqEvent || ''),
                    seqAppend: String(_domSeqAppend || ''),
                    beforeManaged: beforeState.managed,
                    beforeManagedLen: beforeState.managedLen,
                    prevRaw: String(prev || ''),
                    buildId: Number(_cwSnapshotBuildId || 0),
                    buildSource: String(_cwSnapshotBuildSource || '')
                }, 0, 'merge-accept-short-board-bootstrap|' + raw + '|' + Number(_domSeqVersion || 0));
                brPublishSeqState();
                return _domBeadSeqManaged;
            }
            if (raw.length < 2) {
                _domSeqEvent = 'short-board-bootstrap-wait-len1';
                _domSeqAppend = '';
                _domBeadSeqPrevRaw = '';
                brSeqDiagPost('short-board-bootstrap-wait-len1', {
                    raw: raw,
                    rawLen: raw.length,
                    managedSeq: String(_domBeadSeqManaged || ''),
                    managedLen: String(_domBeadSeqManaged || '').length,
                    prevRaw: String(prev || ''),
                    prevRawLen: String(prev || '').length,
                    resetPending: _domShoeResetPending ? 1 : 0,
                    seqVersion: Number(_domSeqVersion || 0),
                    buildId: Number(_cwSnapshotBuildId || 0),
                    buildSource: String(_cwSnapshotBuildSource || '')
                }, 500, 'short-board-bootstrap-wait-len1|' + raw + '|' + Number(_domSeqVersion || 0));
                brPublishSeqState();
                return _domBeadSeqManaged;
            }
            // Tránh race push/pull: chỉ cho phép seed-step mutate ở luồng push khi push đang chạy.
            var seedBuildSource = String(_cwSnapshotBuildSource || '');
            if (seedBuildSource !== 'push') {
                _domSeqEvent = 'reset-seed-wait-push';
                _domSeqAppend = '';
                cwDbg('SEQFLOW', 'seed-step-skip-nonpush', {
                    buildId: Number(_cwSnapshotBuildId || 0),
                    source: seedBuildSource || 'unknown',
                    seqVersion: Number(_domSeqVersion || 0),
                    seqEvent: String(_domSeqEvent || ''),
                    raw: raw,
                    rawLen: raw.length,
                    targetRaw: String(_domResetSeedTargetRaw || ''),
                    consumedRaw: String(_domResetSeedConsumedRaw || '')
                }, 0, 'seed-skip-nonpush|' + Number(_cwSnapshotBuildId || 0) + '|' + Number(_domSeqVersion || 0));
                brSeqTrace('return-reset-seed-wait-nonpush', raw, prev, beforeState, {
                    buildId: Number(_cwSnapshotBuildId || 0),
                    source: seedBuildSource || 'unknown'
                }, 0, 'return-reset-seed-wait-nonpush|' + raw + '|' + Number(_cwSnapshotBuildId || 0));
                brPublishSeqState();
                return _domBeadSeqManaged;
            }

            // Chỉ cho phép append step kế tiếp khi step trước đã được push ra ngoài.
            // Nếu không, rất dễ nhảy ver 6 -> 8 và mất ván đầu sau xáo.
            var lastPushedVer = brGetLastPushedSeqVersion();
            var curSeedVer = Number(_domSeqVersion || 0);
            if (lastPushedVer > 0 && curSeedVer > lastPushedVer) {
                _domSeqEvent = 'reset-seed-wait-push-ack';
                _domSeqAppend = '';
                cwDbg('SEQFLOW', 'seed-step-wait-push-ack', {
                    buildId: Number(_cwSnapshotBuildId || 0),
                    source: seedBuildSource || 'unknown',
                    curVer: curSeedVer,
                    lastPushedVer: lastPushedVer,
                    raw: raw,
                    rawLen: raw.length,
                    targetRaw: String(_domResetSeedTargetRaw || ''),
                    consumedRaw: String(_domResetSeedConsumedRaw || ''),
                    resetPending: _domShoeResetPending ? 1 : 0,
                    seqScriptRev: _cwSeqScriptRev
                }, 0, 'seed-wait-push-ack|' + curSeedVer + '|' + lastPushedVer + '|' + Number(_cwSnapshotBuildId || 0));
                brSeqTrace('return-reset-seed-wait-push-ack', raw, prev, beforeState, {
                    buildId: Number(_cwSnapshotBuildId || 0),
                    source: seedBuildSource || 'unknown',
                    curVer: curSeedVer,
                    lastPushedVer: lastPushedVer
                }, 0, 'return-reset-seed-wait-push-ack|' + raw + '|' + curSeedVer + '|' + lastPushedVer);
                brPublishSeqState();
                return _domBeadSeqManaged;
            }

            if (_domResetSeedTargetRaw !== raw) {
                var keep = '';
                var consumedRaw = String(_domResetSeedConsumedRaw || '');
                var maxKeep = Math.min(consumedRaw.length, raw.length);
                for (var kk = maxKeep; kk >= 0; kk--) {
                    var cand = consumedRaw.slice(0, kk);
                    if (raw.indexOf(cand) === 0) {
                        keep = cand;
                        break;
                    }
                }
                if (!keep) {
                    var managedNowForSeed = String(_domBeadSeqManaged || '');
                    var maxFromManaged = Math.min(managedNowForSeed.length, raw.length);
                    for (var mm = maxFromManaged; mm >= 1; mm--) {
                        var rawPrefix = raw.slice(0, mm);
                        if (managedNowForSeed.slice(managedNowForSeed.length - mm) === rawPrefix) {
                            keep = rawPrefix;
                            cwDbg('SEQFLOW', 'seed-target-align-from-managed', {
                                raw: raw,
                                managedTail: managedNowForSeed.slice(Math.max(0, managedNowForSeed.length - mm)),
                                keep: keep,
                                keepLen: mm,
                                managedLen: managedNowForSeed.length,
                                seqVersion: Number(_domSeqVersion || 0),
                                seqEvent: String(_domSeqEvent || ''),
                                buildId: Number(_cwSnapshotBuildId || 0),
                                buildSource: String(_cwSnapshotBuildSource || '')
                            }, 0, 'seed-align-managed|' + raw + '|' + keep + '|' + Number(_domSeqVersion || 0));
                            break;
                        }
                    }
                }
                _domResetSeedTargetRaw = raw;
                _domResetSeedConsumedRaw = keep;
            }

            if (raw.indexOf(_domResetSeedConsumedRaw) !== 0)
                _domResetSeedConsumedRaw = '';

            // Khóa 1 step / 1 snapshot build để tránh nuốt ván đầu (6 -> 7 -> 8 trong cùng buildId).
            if (Number(_domLastSeedStepBuildId || 0) === Number(_cwSnapshotBuildId || 0)) {
                _domBeadSeqPrevRaw = raw;
                cwDbg('SEQFLOW', 'reset-seed-build-lock', {
                    buildId: Number(_cwSnapshotBuildId || 0),
                    seqVersion: Number(_domSeqVersion || 0),
                    seqEvent: String(_domSeqEvent || ''),
                    targetRaw: String(_domResetSeedTargetRaw || ''),
                    consumedRaw: String(_domResetSeedConsumedRaw || ''),
                    raw: raw,
                    rawLen: raw.length,
                    resetPending: _domShoeResetPending ? 1 : 0
                }, 0, 'seed-build-lock|' + Number(_cwSnapshotBuildId || 0) + '|' + Number(_domSeqVersion || 0));
                cwDbg(
                    'SEQFLOW',
                    'seed-build-lock compact|build=' + Number(_cwSnapshotBuildId || 0) +
                    '|ver=' + Number(_domSeqVersion || 0) +
                    '|evt=' + String(_domSeqEvent || '') +
                    '|raw=' + raw +
                    '|consumed=' + String(_domResetSeedConsumedRaw || '') +
                    '|target=' + String(_domResetSeedTargetRaw || ''),
                    null,
                    0,
                    'seed-build-lock-compact|' + Number(_cwSnapshotBuildId || 0) + '|' + Number(_domSeqVersion || 0)
                );
                brSeqTrace('return-reset-seed-build-lock', raw, prev, beforeState, {
                    buildId: Number(_cwSnapshotBuildId || 0),
                    targetRaw: String(_domResetSeedTargetRaw || ''),
                    consumedRaw: String(_domResetSeedConsumedRaw || '')
                }, 0, 'return-reset-seed-build-lock|' + raw + '|' + Number(_cwSnapshotBuildId || 0));
                brPublishSeqState();
                return _domBeadSeqManaged;
            }

            var seedStepIdx = String(_domResetSeedConsumedRaw || '').length;
            var seedDelta = '';
            if (seedStepIdx < raw.length)
                seedDelta = raw.charAt(seedStepIdx);

            if (seedDelta) {
                brAppendManaged(seedDelta, 'append-reset-seed-step');
                _domResetSeedConsumedRaw = String(_domResetSeedConsumedRaw || '') + seedDelta;
            } else {
                _domSeqEvent = 'reset-seed-wait';
                _domSeqAppend = '';
            }

            _domBeadSeqPrevRaw = raw;

            var seedDone = String(_domResetSeedConsumedRaw || '').length >= raw.length;
            var traceTargetRaw = String(_domResetSeedTargetRaw || '');
            var traceConsumedRaw = String(_domResetSeedConsumedRaw || '');
            if (seedDone) {
                _domShoeResetPending = false;
                _domShoeResetAt = 0;
                _domSeqEvent = seedDelta ? 'append-reset-seed-complete' : 'reset-seed-complete';
                _domSeqAppend = seedDelta || '';
                _domLastActiveSeedKey = brBuildActiveSeedKey(_domManagedTableTitle, raw);
                _domLastActiveSeedBurstId = Number(_domNoBoardBurstId || 0);
                brResetSeedTracker();
            }

            brSeqTrace('return-reset-seed-step', raw, prev, beforeState, {
                targetRaw: traceTargetRaw,
                consumedRaw: traceConsumedRaw,
                stepDelta: seedDelta,
                seedDone: seedDone ? 1 : 0
            }, 0, 'return-reset-seed-step|' + raw + '|' + (seedStepIdx + 1));
            cwDbg(
                'SEQFLOW',
                'seed-step compact|build=' + Number(_cwSnapshotBuildId || 0) +
                '|ver=' + Number(_domSeqVersion || 0) +
                '|evt=' + String(_domSeqEvent || '') +
                '|raw=' + raw +
                '|delta=' + (seedDelta || '-') +
                '|consumed=' + traceConsumedRaw +
                '|done=' + (seedDone ? 1 : 0),
                null,
                0,
                'seed-step-compact|' + Number(_cwSnapshotBuildId || 0) + '|' + Number(_domSeqVersion || 0) + '|' + traceConsumedRaw
            );
            brPublishSeqState();
            return _domBeadSeqManaged;
        }

        if (!prev) {
            brResetBoardDeltaQueue('no-prev');
            _domBeadSeqPrevRaw = raw;
            if (_domShoeResetPending) {
                brAppendManaged(raw, 'append-after-reset');
            } else if (!String(_domBeadSeqManaged || '')) {
                // Khi vừa có board hợp lệ (đặc biệt lúc mới vào bàn), managed phải bám raw hiện tại.
                var beforeInit = String(_domBeadSeqManaged || '');
                _domBeadSeqManaged = raw;
                _domSeqVersion = Math.max(Number(_domSeqVersion || 0) + 1, _domBeadSeqManaged.length);
                _domSeqEvent = 'hydrate-init';
                _domSeqAppend = _domBeadSeqManaged;
                _domShoeResetPending = false;
                brMarkSeqAdvance(_domSeqEvent);
                cwDbg('SEQ', 'hydrate-init-from-raw', {
                    boardRaw: raw,
                    beforeManaged: beforeInit,
                    managed: _domBeadSeqManaged,
                    seqVersion: _domSeqVersion
                }, 0, 'hydrate-init-raw|' + _domSeqVersion + '|' + _domBeadSeqManaged.length);
            } else {
                // Append-only: nếu managed đã có thì không overwrite theo raw mới.
                brSeqTrace('WARN_FIRST_RAW_HOLD', raw, prev, beforeState, {
                    warning: 1,
                    reason: 'first-raw-with-managed-and-reset-not-armed'
                }, 0, 'warn-first-raw-hold|' + raw.length + '|' + beforeState.managedLen);
                _domSeqEvent = 'hydrate-hold-managed';
                _domSeqAppend = '';
                cwDbg('SEQ', 'hydrate-skip-keep-managed', {
                    boardRaw: raw,
                    boardRawLen: raw.length,
                    managedLen: String(_domBeadSeqManaged || '').length,
                    seqVersion: _domSeqVersion
                }, 1200, 'hydrate-hold|' + raw.length + '|' + _domSeqVersion);
            }
            brSeqTrace('return-no-prev', raw, prev, beforeState, null, 0, 'return-no-prev|' + raw.length);
            brPublishSeqState();
            return _domBeadSeqManaged;
        }

        if (raw === prev) {
            var nowEqPrevMs = Date.now();
            if (!_domRawEqPrevStreak || (nowEqPrevMs - Number(_domRawEqPrevLastAt || 0)) > 2500) {
                _domRawEqPrevStreak = 1;
                _domRawEqPrevFirstAt = nowEqPrevMs;
            } else {
                _domRawEqPrevStreak = Number(_domRawEqPrevStreak || 0) + 1;
            }
            _domRawEqPrevLastAt = nowEqPrevMs;
            if (_domBoardDeltaQueue.length > 0) {
                cwDbg('SEQFLOW', 'delta-queue-authority-blocked', {
                    reason: 'raw-eq-prev',
                    queueLen: Number(_domBoardDeltaQueue.length || 0),
                    rawLen: raw.length,
                    managedLen: String(_domBeadSeqManaged || '').length,
                    seqVersion: Number(_domSeqVersion || 0),
                    seqEvent: String(_domSeqEvent || '')
                }, 0, 'delta-queue-authority-blocked|raw-eq-prev|' + Number(_domSeqVersion || 0));
                brResetBoardDeltaQueue('authority-raw-eq-prev');
            }
            if (String(_domBeadSeqManaged || '').length >= (raw.length + 3)) {
                brSeqDiagPost('raw-stable-managed-ahead', {
                    raw: raw,
                    rawLen: raw.length,
                    prevRaw: String(prev || ''),
                    managed: String(_domBeadSeqManaged || ''),
                    managedLen: String(_domBeadSeqManaged || '').length,
                    seqVersion: Number(_domSeqVersion || 0),
                    seqEvent: String(_domSeqEvent || ''),
                    queueLen: Number(_domBoardDeltaQueue.length || 0),
                    lastAdvanceVer: Number(_domLastAdvanceVersion || 0),
                    lastAdvanceEvt: String(_domLastAdvanceEvent || ''),
                    lastAdvanceLen: Number(_domLastAdvanceSeqLen || 0),
                    buildId: Number(_cwSnapshotBuildId || 0),
                    buildSource: String(_cwSnapshotBuildSource || '')
                }, 1200, 'raw-stable-managed-ahead|' + raw + '|' + Number(_domSeqVersion || 0));
            }
            var activeHint = brSanitizeSeq(_domLastActiveSeq || '');
            var activeHintTitle = String(_domLastActiveSeqTitle || '');
            var managedTitle = String(_domManagedTableTitle || '');
            var activeSameTable = (!managedTitle || !activeHintTitle || managedTitle === activeHintTitle);
            var activeHintKey = brBuildActiveSeedKey(activeHintTitle || managedTitle, activeHint);
            var activeHintAlreadyForced = !!(activeHintKey && _domRawStallLastActiveKey === activeHintKey);
            var managedNowEqPrev = String(_domBeadSeqManaged || '');
            var managedEndsWithActiveHint = !!(
                activeHint &&
                managedNowEqPrev.length >= activeHint.length &&
                managedNowEqPrev.slice(managedNowEqPrev.length - activeHint.length) === activeHint
            );
            var activeHintAhead = !!(
                activeHint &&
                activeHint.length <= 8 &&
                activeHint.length > raw.length &&
                activeHint.indexOf(raw) === 0 &&
                activeSameTable
            );
            var activeHintGap = activeHintAhead ? (activeHint.length - raw.length) : 0;
            var activeHintOneStepAhead = !!(activeHintAhead && activeHintGap === 1);
            var rawStallForceEligible = !!(
                activeHintOneStepAhead &&
                raw.length >= 4 &&
                managedNowEqPrev.length <= (raw.length + 1)
            );
            var canSeedByActiveHint = !!(
                !_domShoeResetPending &&
                rawStallForceEligible &&
                _domRawEqPrevStreak >= 2 &&
                String(_cwSnapshotBuildSource || '') === 'push' &&
                !activeHintAlreadyForced &&
                !managedEndsWithActiveHint
            );
            if (canSeedByActiveHint) {
                _domShoeResetPending = true;
                _domShoeResetAt = nowEqPrevMs;
                brResetSeedTracker();
                _domRawStallLastActiveKey = activeHintKey;
                _domSeqEvent = 'shoe-reset-arm-raw-stall-active';
                _domSeqAppend = '';
                cwDbg('SEQFLOW', 'raw-stall-force-seed-active', {
                    raw: raw,
                    activeHint: activeHint,
                    rawLen: raw.length,
                    activeLen: activeHint.length,
                    managedLen: String(_domBeadSeqManaged || '').length,
                    seqVersion: Number(_domSeqVersion || 0),
                    rawEqPrevStreak: Number(_domRawEqPrevStreak || 0),
                    buildId: Number(_cwSnapshotBuildId || 0),
                    buildSource: String(_cwSnapshotBuildSource || ''),
                    activeTitle: activeHintTitle,
                    activeHintKey: activeHintKey,
                    activeHintAlreadyForced: activeHintAlreadyForced ? 1 : 0,
                    managedEndsWithActiveHint: managedEndsWithActiveHint ? 1 : 0
                }, 0, 'raw-stall-force-seed|' + raw + '|' + activeHint + '|' + Number(_domSeqVersion || 0));
                brPublishSeqState();
                return brMergeManagedSeq(activeHint);
            }
            if (activeHintAhead && _domRawEqPrevStreak >= 2 && String(_cwSnapshotBuildSource || '') === 'push') {
                var blockReason = 'unknown';
                if (!activeHintOneStepAhead)
                    blockReason = 'gap-not-1';
                else if (raw.length < 4)
                    blockReason = 'raw-too-short';
                else if (managedNowEqPrev.length > (raw.length + 1))
                    blockReason = 'managed-too-ahead';
                else if (_domShoeResetPending)
                    blockReason = 'reset-pending';
                else if (activeHintAlreadyForced)
                    blockReason = 'already-forced';
                else if (managedEndsWithActiveHint)
                    blockReason = 'managed-ends-with-active';
                var stallStreakNow = Number(_domRawEqPrevStreak || 0);
                if (stallStreakNow <= 3 || (stallStreakNow % 10) === 0) {
                    cwDbg('SEQFLOW', 'raw-stall-force-seed-blocked', {
                        reason: blockReason,
                        raw: raw,
                        activeHint: activeHint,
                        rawLen: raw.length,
                        activeLen: activeHint.length,
                        activeGap: activeHintGap,
                        managedLen: managedNowEqPrev.length,
                        rawEqPrevStreak: stallStreakNow,
                        seqVersion: Number(_domSeqVersion || 0),
                        seqEvent: String(_domSeqEvent || ''),
                        activeTitle: activeHintTitle,
                        activeHintKey: activeHintKey,
                        buildId: Number(_cwSnapshotBuildId || 0),
                        buildSource: String(_cwSnapshotBuildSource || '')
                    }, 5000, 'raw-stall-force-blocked|' + blockReason + '|' + raw.length + '|' + activeHint.length + '|' + String(activeHintTitle || ''));
                }
            }
            if (activeHintAlreadyForced) {
                cwDbg('SEQFLOW', 'raw-stall-force-seed-skip-dup', {
                    raw: raw,
                    activeHint: activeHint,
                    activeHintKey: activeHintKey,
                    rawEqPrevStreak: Number(_domRawEqPrevStreak || 0),
                    seqVersion: Number(_domSeqVersion || 0),
                    seqEvent: String(_domSeqEvent || ''),
                    buildId: Number(_cwSnapshotBuildId || 0),
                    buildSource: String(_cwSnapshotBuildSource || '')
                }, 1200, 'raw-stall-skip-dup|' + activeHintKey + '|' + Number(_domSeqVersion || 0));
            }
            var beforeNoChangeEvt = String(_domSeqEvent || '');
            var beforeNoChangeVer = Number(_domSeqVersion || 0);
            var seedAgeMs = _domLastSeedStepAt ? (Date.now() - _domLastSeedStepAt) : 999999;
            if (beforeNoChangeEvt === 'append-reset-seed-step' &&
                beforeNoChangeVer === Number(_domLastSeedStepVersion || 0) &&
                seedAgeMs <= 2500) {
                cwDbg('SEQFLOW', 'event-overwrite-before-push', {
                    buildId: Number(_cwSnapshotBuildId || 0),
                    buildSource: String(_cwSnapshotBuildSource || ''),
                    beforeEvent: beforeNoChangeEvt,
                    beforeVersion: beforeNoChangeVer,
                    rawLen: raw.length,
                    managedLen: String(_domBeadSeqManaged || '').length,
                    seedAgeMs: seedAgeMs,
                    seedBuildId: Number(_domLastSeedStepBuildId || 0),
                    resetPending: _domShoeResetPending ? 1 : 0
                }, 0, 'seqflow-overwrite|' + beforeNoChangeVer + '|' + Number(_cwSnapshotBuildId || 0));
            }
            _domSeqEvent = 'no-change';
            cwDbg('SEQ', 'no-change', {
                boardLen: raw.length,
                managedLen: (_domBeadSeqManaged || '').length,
                seqVersion: _domSeqVersion
            }, 5000, 'no-change|' + raw.length + '|' + _domSeqVersion);
            brSeqTrace('return-raw-eq-prev', raw, prev, beforeState, null, 300, 'return-raw-eq-prev|' + raw.length);
            brPublishSeqState();
            return _domBeadSeqManaged;
        }
        _domRawEqPrevStreak = 0;
        _domRawEqPrevFirstAt = 0;
        _domRawEqPrevLastAt = 0;
        _domRawStallLastActiveKey = '';

        if (raw.indexOf(prev) === 0) {
            var extDelta = raw.slice(prev.length);
            _domBeadSeqPrevRaw = raw;
            var extApplied = brAppendManaged(extDelta, 'append-raw-extend');
            if (!extApplied) {
                _domSeqEvent = 'no-change';
                _domSeqAppend = '';
            }
            brSeqTrace('return-extend', raw, prev, beforeState, {
                delta: extDelta,
                applied: extApplied ? 1 : 0,
                queueRemain: _domBoardDeltaQueue.length
            }, 0, 'return-extend|' + raw.length + '|' + prev.length);
            if (!extApplied)
                brPublishSeqState();
            return _domBeadSeqManaged;
        }

        // Sau no-board mà prev/raw đều ngắn, overlap dễ nuốt nhầm ván đầu.
        // Trong ngữ cảnh table-switch-reset/shoe-reset, ưu tiên chuyển sang reset-seed-step.
        var evtNow2 = String(_domSeqEvent || '');
        var lastNoBoardAt = Number(_cwSeqDiagState && _cwSeqDiagState.lastNoBoard && _cwSeqDiagState.lastNoBoard.at || 0);
        var noBoardRecent = !!(lastNoBoardAt && (Date.now() - lastNoBoardAt) <= 15000);
        if (!_domShoeResetPending &&
            raw.length <= 4 &&
            prev.length <= 4 &&
            noBoardRecent &&
            (evtNow2.indexOf('table-switch-reset') === 0 || evtNow2.indexOf('shoe-reset-arm') === 0)) {
            _domShoeResetPending = true;
            _domShoeResetAt = Date.now();
            brResetSeedTracker();
            _domSeqEvent = 'shoe-reset-arm-short-overlap';
            _domSeqAppend = '';
            cwDbg('SEQ', 'shoe-reset-arm by short-overlap', {
                raw: raw,
                prev: prev,
                rawLen: raw.length,
                prevLen: prev.length,
                managedLen: String(_domBeadSeqManaged || '').length,
                seqVersion: Number(_domSeqVersion || 0),
                lastNoBoardAgeMs: Date.now() - lastNoBoardAt,
                prevEvent: evtNow2
            }, 0, 'reset-arm-short-overlap|' + prev + '|' + raw + '|' + Number(_domSeqVersion || 0));
            brSeqTrace('reenter-short-overlap-seed', raw, prev, beforeState, {
                prevEvent: evtNow2,
                noBoardRecent: noBoardRecent ? 1 : 0
            }, 0, 'reenter-short-overlap-seed|' + prev + '|' + raw);
            brPublishSeqState();
            return brMergeManagedSeq(raw);
        }

        var ov = brOverlapSuffixPrefix(prev, raw);
        if (ov > 0) {
            var delta = raw.slice(ov);
            if (delta.length > 0 && delta.length <= 3) {
                _domBeadSeqPrevRaw = raw;
                var ovApplied = brAppendManaged(delta, 'append-raw-overlap');
                if (!ovApplied) {
                    _domSeqEvent = 'no-change';
                    _domSeqAppend = '';
                }
                brSeqTrace('return-overlap', raw, prev, beforeState, {
                    overlap: ov,
                    delta: delta,
                    applied: ovApplied ? 1 : 0,
                    queueRemain: _domBoardDeltaQueue.length
                }, 0, 'return-overlap|' + raw.length + '|' + ov);
                if (!ovApplied)
                    brPublishSeqState();
                return _domBeadSeqManaged;
            }
        }

        if (prev.indexOf(raw) === 0) {
            brResetBoardDeltaQueue('raw-shrink-prefix');
            if (_domShoeResetPending && raw.length <= 2) {
                brSeqTrace('WARN_RESET_SWALLOWED_BY_PREFIX', raw, prev, beforeState, {
                    warning: 1,
                    reason: 'reset-pending-but-returning-prefix-shrink-first'
                }, 0, 'warn-reset-swallowed|' + prev.length + '|' + raw.length);
            }
            var shrinkRatio = raw.length / Math.max(1, prev.length);
            if (raw.length <= 2 || shrinkRatio <= 0.45) {
                _domShoeResetPending = true;
                _domShoeResetAt = Date.now();
                brResetSeedTracker();
                _domSeqEvent = 'shoe-reset-arm';
                cwDbg('SEQ', 'shoe-reset-arm by shrink', {
                    prevLen: prev.length,
                    rawLen: raw.length,
                    shrinkRatio: shrinkRatio
                }, 0, 'reset-arm-shrink|' + prev.length + '|' + raw.length);
            } else {
                _domSeqEvent = 'board-shrink';
                cwDbg('SEQ', 'board-shrink', {
                    prevLen: prev.length,
                    rawLen: raw.length,
                    shrinkRatio: shrinkRatio
                }, 0, 'board-shrink|' + prev.length + '|' + raw.length);
            }
            brSeqDiagPost('raw-shrink-prefix-hold', {
                raw: raw,
                rawLen: raw.length,
                prevRaw: String(prev || ''),
                prevLen: String(prev || '').length,
                managed: String(_domBeadSeqManaged || ''),
                managedLen: String(_domBeadSeqManaged || '').length,
                shrinkRatio: shrinkRatio,
                resetPending: _domShoeResetPending ? 1 : 0,
                seqVersion: Number(_domSeqVersion || 0),
                seqEvent: String(_domSeqEvent || ''),
                buildId: Number(_cwSnapshotBuildId || 0),
                buildSource: String(_cwSnapshotBuildSource || '')
            }, 0, 'raw-shrink-prefix-hold|' + String(prev || '') + '|' + raw + '|' + Number(_domSeqVersion || 0));
            _domBeadSeqPrevRaw = raw;
            brSeqTrace('return-prev-prefix-of-raw', raw, prev, beforeState, {
                shrinkRatio: shrinkRatio
            }, 0, 'return-prev-prefix|' + prev.length + '|' + raw.length);
            brPublishSeqState();
            return _domBeadSeqManaged;
        }

        if (!_domShoeResetPending && prev.length >= 10 && raw.length <= 3) {
            _domShoeResetPending = true;
            _domShoeResetAt = Date.now();
            brResetSeedTracker();
            cwDbg('SEQ', 'shoe-reset-arm by tiny raw', {
                prevLen: prev.length,
                rawLen: raw.length
            }, 0, 'reset-arm-tiny|' + prev.length + '|' + raw.length);
        }

        // Raw đổi kiểu "jump": append-only, không overwrite managed hiện có.
        var managedNow = String(_domBeadSeqManaged || '');
        var ovJump = brOverlapSuffixPrefix(managedNow, raw);
        if (ovJump >= 5) {
            var jumpDelta = raw.slice(ovJump);
            if (jumpDelta.length > 0 && jumpDelta.length <= 2) {
                cwDbg('SEQFLOW', 'raw-jump-overlap-authority-blocked', {
                    raw: raw,
                    prev: String(prev || ''),
                    managed: managedNow,
                    overlap: ovJump,
                    delta: jumpDelta,
                    seqVersion: Number(_domSeqVersion || 0),
                    seqEvent: String(_domSeqEvent || '')
                }, 0, 'raw-jump-overlap-authority-blocked|' + raw.length + '|' + ovJump + '|' + Number(_domSeqVersion || 0));
            }
        }
        brResetBoardDeltaQueue('board-jump-hold');
        _domBeadSeqPrevRaw = raw;
        _domSeqEvent = 'board-jump-hold';
        _domSeqAppend = '';
        cwDbg('SEQ', 'board-jump-hold-managed', {
            prev: prev,
            raw: raw,
            managed: managedNow,
            managedLen: managedNow.length,
            seqVersion: _domSeqVersion,
            overlapPrevRaw: brOverlapSuffixPrefix(String(prev || ''), raw),
            overlapManagedRaw: brOverlapSuffixPrefix(managedNow, raw),
            queueRemain: _domBoardDeltaQueue.length
        }, 1200, 'board-jump-hold|' + managedNow.length + '|' + raw.length + '|' + _domSeqVersion);
        brSeqDiagPost('raw-jump-hold', {
            raw: raw,
            rawLen: raw.length,
            prevRaw: String(prev || ''),
            prevLen: String(prev || '').length,
            managed: managedNow,
            managedLen: managedNow.length,
            overlapPrevRaw: brOverlapSuffixPrefix(String(prev || ''), raw),
            overlapManagedRaw: brOverlapSuffixPrefix(managedNow, raw),
            queueRemain: Number(_domBoardDeltaQueue.length || 0),
            seqVersion: Number(_domSeqVersion || 0),
            seqEvent: String(_domSeqEvent || ''),
            buildId: Number(_cwSnapshotBuildId || 0),
            buildSource: String(_cwSnapshotBuildSource || '')
        }, 0, 'raw-jump-hold|' + String(prev || '') + '|' + raw + '|' + Number(_domSeqVersion || 0));
        brSeqTrace('return-board-jump-hold', raw, prev, beforeState, null, 0, 'return-board-jump-hold|' + raw.length);
        brPublishSeqState();
        return _domBeadSeqManaged;
    }
    function brAppendNewTail(baseSeq, candSeq) {
        var base = String(baseSeq || '').replace(/H/g, 'T');
        var cand = String(candSeq || '').replace(/H/g, 'T');
        if (!base || !cand)
            return '';
        if (cand === base)
            return '';
        if (cand.indexOf(base) === 0 && cand.length > base.length) {
            var directDelta = cand.length - base.length;
            if (directDelta === 1)
                return cand;
            return '';
        }

        // Cand có thể chỉ là đoạn cuối của board; nếu suffix base trùng prefix cand
        // đủ dài (>=5) và delta nhỏ (<=2) thì append delta để tránh đứng chuỗi.
        var maxK = Math.min(12, base.length, cand.length);
        for (var k = maxK; k >= 5; k--) {
            if (base.slice(base.length - k) === cand.slice(0, k)) {
                var delta = cand.slice(k);
                if (delta.length > 0 && delta.length <= 1)
                    return base + delta;
                break;
            }
        }
        return '';
    }
    function brTryReconcileBeadOneStep(raw, prev, beforeState, reasonTag) {
        cwDbg('SEQFLOW', 'reconcile-bead-one-step-disabled', {
            reason: String(reasonTag || ''),
            raw: String(raw || ''),
            prev: String(prev || ''),
            managedLen: String(_domBeadSeqManaged || '').length,
            seqVersion: Number(_domSeqVersion || 0),
            seqEvent: String(_domSeqEvent || '')
        }, 0, 'reconcile-bead-disabled|' + String(reasonTag || '') + '|' + Number(_domSeqVersion || 0));
        return false;
    }
    function brResetManagedForTable(activeTitle, activeSeq, reason) {
        var cleanTitle = String(activeTitle || '').trim();
        var raw = brSanitizeSeq(activeSeq);
        if (!cleanTitle || !raw)
            return false;
        var before = String(_domBeadSeqManaged || '');
        _domBeadSeqManaged = raw;
        _domBeadSeqPrevRaw = raw;
        _domTableSwitchWaitBeadPending = false;
        _domTableSwitchWaitPrevRaw = '';
        _domShoeResetPending = false;
        _domShoeResetAt = 0;
        brResetSeedTracker();
        _domLastActiveSeedKey = cleanTitle + '|' + raw;
        _domLastActiveSeedBurstId = Number(_domNoBoardBurstId || 0);
        _domRawStallLastActiveKey = '';
        _domManagedTableTitle = cleanTitle;
        // Đổi bàn phải coi như phiên mới của bàn đó: reset theo seq của bàn mới.
        _domSeqVersion = Math.max(Number(_domSeqVersion || 0) + 1, String(_domBeadSeqManaged || '').length);
        _domSeqEvent = String(reason || 'table-switch-reset');
        _domSeqAppend = _domBeadSeqManaged;
        brPublishSeqState();
        cwDbg('SEQSRC', 'table-switch-reset-managed', {
            title: cleanTitle,
            seq: raw,
            seqLen: raw.length,
            beforeLen: before.length,
            afterLen: String(_domBeadSeqManaged || '').length,
            seqVersion: _domSeqVersion,
            seqEvent: _domSeqEvent
        }, 0, 'table-switch-reset|' + cleanTitle + '|' + _domSeqVersion);
        return true;
    }
    function brResetManagedForTableWaitBead(activeTitle, reason) {
        var cleanTitle = String(activeTitle || '').trim();
        if (!cleanTitle)
            return false;
        var before = String(_domBeadSeqManaged || '');
        _domTableSwitchWaitPrevRaw = brSanitizeSeq(_domBeadSeqPrevRaw || before || '');
        _domBeadSeqManaged = '';
        _domBeadSeqPrevRaw = '';
        _domTableSwitchWaitBeadPending = true;
        _domShoeResetPending = false;
        _domShoeResetAt = 0;
        brResetSeedTracker();
        _domLastActiveSeedKey = '';
        _domLastActiveSeedBurstId = 0;
        _domRawStallLastActiveKey = '';
        _domManagedTableTitle = cleanTitle;
        _domSeqVersion = Number(_domSeqVersion || 0) + 1;
        _domSeqEvent = String(reason || 'table-switch-wait-bead');
        _domSeqAppend = '';
        brPublishSeqState();
        cwDbg('SEQSRC', 'table-switch-clear-wait-bead', {
            title: cleanTitle,
            beforeLen: before.length,
            waitPrevRawLen: String(_domTableSwitchWaitPrevRaw || '').length,
            afterLen: 0,
            seqVersion: _domSeqVersion,
            seqEvent: _domSeqEvent
        }, 0, 'table-switch-wait-bead|' + cleanTitle + '|' + _domSeqVersion);
        return true;
    }
    function readDomBeadSeq() {
        try {
            var allContexts = [];
            domWalkContexts(window, 'top', 0, 0, allContexts, []);
            for (var i = 0; i < allContexts.length; i++) {
                allContexts[i].score = domScoreRows(allContexts[i].rows || []);
            }
            var contexts = domChooseLikelyGameContexts(allContexts);
            var screenW = window.innerWidth || 1600;
            var screenH = window.innerHeight || 900;
            var findDiag = {
                at: Date.now(),
                screen: { w: Number(screenW || 0), h: Number(screenH || 0) },
                contexts: brContextSummary(contexts, 10),
                allContexts: brContextSummary(allContexts, 6),
                profiles: []
            };
            var picked = brFindBoardWithProfiles(contexts, screenW, screenH, findDiag);
            var board = picked.board;
            if (!board) {
                var psum = brProfileSummary(findDiag.profiles || []);
                var hasMarkers = false;
                for (var ps = 0; ps < psum.length; ps++) {
                    if (Number(psum[ps].markerCount || 0) > 0) {
                        hasMarkers = true;
                        break;
                    }
                }
                var failReason = '';
                if (!contexts.length)
                    failReason = 'no-context';
                else if (!hasMarkers)
                    failReason = 'no-marker-in-target-zone';
                else
                    failReason = 'marker-found-but-board-cluster-fail';
                findDiag.failReason = failReason;
                findDiag.managedSeq = String(_domBeadSeqManaged || '');
                findDiag.managedLen = String(_domBeadSeqManaged || '').length;
                _cwSeqDiagState.lastNoBoard = findDiag;
                cwDbg('SEQ', 'no-board-detected', {
                    reason: failReason,
                    managedSeq: _domBeadSeqManaged,
                    managedLen: (_domBeadSeqManaged || '').length,
                    scoreContexts: contexts.length,
                    contextTop: findDiag.contexts,
                    profiles: psum
                }, 1200, 'no-board');
                brArmShoeResetByNoBoard(failReason);
                if (window.__cw_debug_seq_detail === 1 || window.__cw_debug_seq_detail === true) {
                    cwDbg('SEQ', 'no-board-detail', findDiag, 1500, 'no-board-detail|' + failReason + '|' + String(_domBeadSeqManaged || '').length);
                }
                return {
                    seq: _domBeadSeqManaged || '',
                    rawSeq: '',
                    which: 'dom-bead',
                    seqVersion: _domSeqVersion,
                    seqEvent: _domSeqEvent,
                    cols: [],
                    cells: []
                };
            }
            _domNoBoardStreak = 0;
            _domNoBoardFirstAt = 0;
            _domNoBoardLastAt = 0;
            _domNoBoardLastReason = '';
            board = brTrimBoardToTopSixRows(board);
            board = brTrimBoardToLeftTopSegment(board);
            board = brNormalizeBoardToSixRows(board);
            board.items = brRefineBoardMarkers(contexts, board);
            board = brTrimBoardToTopSixRows(board);
            board = brTrimBoardToLeftTopSegment(board);
            board = brNormalizeBoardToSixRows(board);
            var gridPack = brBuildGrid6xN(board.items);
            var rawSeq = brSequenceFromGrid(gridPack);
            if (board && board.allowTiny) {
                brSeqDiagPost('dom-bead-tiny-board-allow', {
                    rawSeq: rawSeq,
                    rawLen: String(rawSeq || '').length,
                    managedSeq: String(_domBeadSeqManaged || ''),
                    managedLen: String(_domBeadSeqManaged || '').length,
                    prevRaw: String(_domBeadSeqPrevRaw || ''),
                    prevRawLen: String(_domBeadSeqPrevRaw || '').length,
                    waitBead: _domTableSwitchWaitBeadPending ? 1 : 0,
                    resetPending: _domShoeResetPending ? 1 : 0,
                    seqVersion: Number(_domSeqVersion || 0),
                    seqEvent: String(_domSeqEvent || ''),
                    boardMeta: {
                        score: Number(board.score || 0),
                        avgW: Math.round(Number(board.avgW || 0)),
                        avgH: Math.round(Number(board.avgH || 0)),
                        maxSide: Number(board.maxSide || 0),
                        rowCount: Number(board.rowCount || 0),
                        colCount: Number(board.colCount || 0),
                        profileName: String(board.profileName || '')
                    }
                }, 500, 'dom-bead-tiny-board-allow|' + rawSeq + '|' + Number(_domSeqVersion || 0));
            }
            var managed = brMergeManagedSeq(rawSeq);
            if (_domTableSwitchWaitBeadPending &&
                !String(managed || '') &&
                rawSeq &&
                _domTableSwitchWaitPrevRaw &&
                rawSeq === _domTableSwitchWaitPrevRaw) {
                brSeqDiagPost('table-switch-stale-raw-cleared', {
                    raw: rawSeq,
                    rawLen: rawSeq.length,
                    waitPrevRawLen: String(_domTableSwitchWaitPrevRaw || '').length,
                    seqVersion: Number(_domSeqVersion || 0),
                    seqEvent: String(_domSeqEvent || ''),
                    buildId: Number(_cwSnapshotBuildId || 0),
                    buildSource: String(_cwSnapshotBuildSource || '')
                }, 500, 'table-switch-stale-raw-cleared|' + rawSeq.length + '|' + Number(_domSeqVersion || 0));
                rawSeq = '';
                try {
                    window.__cw_bead_raw_seq = '';
                } catch (_) {}
            }
            _cwSeqDiagState.lastParserError = null;
            cwDbg('SEQ', 'dom-bead-read', {
                rawSeq: rawSeq,
                managedSeq: managed,
                rawLen: rawSeq.length,
                managedLen: (managed || '').length,
                boardMeta: {
                    profile: Number(picked && picked.profile != null ? picked.profile : -1),
                    items: (board.items && board.items.length) ? board.items.length : 0,
                    rowCount: Number(board.rowCount || 0),
                    colCount: Number(board.colCount || 0),
                    minX: Number(board.minX || 0),
                    minY: Number(board.minY || 0),
                    width: Number(board.width || 0),
                    height: Number(board.height || 0)
                },
                seqVersion: _domSeqVersion,
                seqEvent: _domSeqEvent
            }, 500, 'dom-bead-read|' + rawSeq + '|' + _domSeqVersion);
            try {
                window.__cw_bead_raw_seq = rawSeq;
                window.__cw_bead_managed_seq = managed;
            } catch (_) {}
            return {
                seq: managed,
                rawSeq: rawSeq,
                which: 'dom-bead',
                seqVersion: _domSeqVersion,
                seqEvent: _domSeqEvent,
                cols: gridPack.cols || [],
                cells: board.items || []
            };
        } catch (err) {
            var errInfo = {
                message: String(err && err.message || err),
                stack: cwShort(String(err && err.stack || ''), 600),
                managedSeq: String(_domBeadSeqManaged || ''),
                managedLen: String(_domBeadSeqManaged || '').length,
                seqScriptRev: _cwSeqScriptRev,
                lastPushSeqVersionSeen: brGetLastPushedSeqVersion()
            };
            _cwSeqDiagState.lastParserError = errInfo;
            cwDbg('SEQ', 'dom-bead-error', errInfo, 300, 'dom-bead-error|' + errInfo.message);
            return {
                seq: _domBeadSeqManaged || '',
                rawSeq: '',
                which: 'dom-bead-error',
                seqVersion: _domSeqVersion,
                seqEvent: _domSeqEvent,
                cols: [],
                cells: []
            };
        }
    }

    var TAIL_SOICAU_NORMAL_MULTI = 'prefab_game_14/root/node_in_multimode/HUD/soicau_popup_multi/root/soicau_normal/ig_soicau_xocdia/content';
    var TAIL_SOICAU_NORMAL_FULL = 'prefab_game_14/root/node_in_fullmode/HUD/soicau_popup_fullmode/root/soicau_normal/ig_soicau_xocdia/content';

    function beadVal(name, nodeName) {
        var s = (String(name || '') + ' ' + String(nodeName || '')).toLowerCase();
        if (s.indexOf('chan') !== -1)
            return 'C';
        if (s.indexOf('le') !== -1)
            return 'L';
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

    function readTKSeqBeads() {
        var cellsMulti = collectBeadsByTail(TAIL_SOICAU_NORMAL_MULTI);
        var cellsFull = collectBeadsByTail(TAIL_SOICAU_NORMAL_FULL);
        var cells = [];
        var which = null;
        if (cellsMulti.length || cellsFull.length) {
            var visM = visibleBeadCount(cellsMulti);
            var visF = visibleBeadCount(cellsFull);
            if (visM || visF) {
                if (visM >= visF) {
                    cells = cellsMulti;
                    which = 'soicau_normal_multi';
                } else {
                    cells = cellsFull;
                    which = 'soicau_normal_full';
                }
                var onlyView = [];
                for (var i = 0; i < cells.length; i++) {
                    if (cells[i].inView)
                        onlyView.push(cells[i]);
                }
                if (onlyView.length)
                    cells = onlyView;
            } else if (cellsMulti.length >= cellsFull.length) {
                cells = cellsMulti;
                which = 'soicau_normal_multi';
            } else {
                cells = cellsFull;
                which = 'soicau_normal_full';
            }
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
        var seq = limitSeq52(parts.join(''));
        return {
            seq: seq,
            which: which,
            cols: cols,
            cells: cells
        };
    }

    function readTKSeq() {
        // Đồng bộ state theo global publisher để context cũ không kéo lùi seqVersion/seqLen.
        brSyncFromPublishedState('readTKSeq-entry');
        if (!_cwSeqRevLogged) {
            _cwSeqRevLogged = true;
            cwDbg('SEQFLOW', 'script-rev', {
                seqScriptRev: _cwSeqScriptRev
            }, 0, 'script-rev|' + _cwSeqScriptRev);
        }
        if (!__cw_hasCocos()) {
            var bead = readDomBeadSeq();
            var beadSeq = (bead && bead.seq) ? String(bead.seq || '') : '';
            var beadRawSeq = (bead && bead.rawSeq) ? String(bead.rawSeq || '') : '';
            var cards = domScanBaccaratCards();
            var active = domPickActiveCard(cards);
            var activeSeq = active ? String(active.seq || '').replace(/H/g, 'T') : '';
            var activeTitle = active && active.title ? String(active.title || '') : '';
            var activeCountGuard = brBuildSeqCountGuardFromCard(active);
            if (activeCountGuard) {
                var managedBeforeCountGuard = String(_domBeadSeqManaged || '');
                var activeGuarded = brApplySeqCountGuard(activeSeq, activeCountGuard, 'active-card');
                var beadRawGuarded = brApplySeqCountGuard(beadRawSeq, activeCountGuard, 'bead-raw');
                var beadSeqGuarded = brApplySeqCountGuard(beadSeq, activeCountGuard, 'bead-managed');
                if (activeGuarded.changed)
                    activeSeq = activeGuarded.seq;
                if (beadRawGuarded.changed)
                    beadRawSeq = beadRawGuarded.seq;
                if (beadSeqGuarded.changed)
                    beadSeq = beadSeqGuarded.seq;
                var countGuardRebaseSource = '';
                if (beadSeqGuarded.changed) {
                    countGuardRebaseSource = 'bead-managed';
                } else if (!beadSeq && beadRawSeq && brSeqMatchesCountsExactly(beadRawSeq, activeCountGuard)) {
                    beadSeq = beadRawSeq;
                    countGuardRebaseSource = 'bead-raw-exact';
                }
                if (countGuardRebaseSource)
                    brRebaseManagedByCountGuard(beadSeq, activeCountGuard, countGuardRebaseSource, managedBeforeCountGuard);
            }
            _domLastActiveSeq = activeSeq;
            _domLastActiveSeqTitle = activeTitle;
            if (activeTitle && !_domManagedTableTitle)
                _domManagedTableTitle = activeTitle;
            var managedNow = String(_domBeadSeqManaged || '');
            var managedTableTitle = String(_domManagedTableTitle || '');
            var sameTableForActiveSeed = (!managedTableTitle || !activeTitle || managedTableTitle === activeTitle);
            var activeSeedKey = brBuildActiveSeedKey(activeTitle, activeSeq);
            var activeSeedAlreadyUsed = !!(activeSeedKey && _domLastActiveSeedKey === activeSeedKey);
            var activeSeedGlobalBlocked = !!(
                activeSeedAlreadyUsed &&
                String(_domBeadSeqManaged || '').length >= activeSeq.length
            );
            var activeSeedBurstBlocked = !!(
                activeSeedKey &&
                _domLastActiveSeedKey === activeSeedKey &&
                Number(_domLastActiveSeedBurstId || 0) === Number(_domNoBoardBurstId || 0)
            );
            var lastNoBoardReason = String(
                (_cwSeqDiagState && _cwSeqDiagState.lastNoBoard && _cwSeqDiagState.lastNoBoard.failReason) ||
                _domNoBoardLastReason ||
                ''
            );
            var allowActiveSeedByNoBoardReason = !lastNoBoardReason ||
                lastNoBoardReason === 'marker-found-but-board-cluster-fail' ||
                lastNoBoardReason === 'marker-found-but-no-board';
            var curBuildSource = String(_cwSnapshotBuildSource || '');
            var curBuildId = Number(_cwSnapshotBuildId || 0);
            var isPushBuildContext = !!(curBuildId > 0 && curBuildSource === 'push');
            var canUseActiveResetSeed = !!(
                _domShoeResetPending &&
                activeSeq &&
                activeSeq.length <= 8 &&
                sameTableForActiveSeed &&
                isPushBuildContext &&
                !activeSeedBurstBlocked &&
                !activeSeedGlobalBlocked &&
                allowActiveSeedByNoBoardReason
            );
            function useActiveResetSeed(reasonTag) {
                if (!isPushBuildContext) {
                    _domSeqEvent = 'active-reset-seed-wait-push';
                    _domSeqAppend = '';
                    brPublishSeqState();
                    cwDbg('SEQSRC', 'skip-active-reset-seed-nonpush', {
                        reason: String(reasonTag || ''),
                        activeTitle: activeTitle,
                        activeSeqLen: String(activeSeq || '').length,
                        buildSource: curBuildSource,
                        buildId: curBuildId,
                        seqVersion: Number(_domSeqVersion || 0),
                        seqEvent: String(_domSeqEvent || '')
                    }, 0, 'seqsrc-skip-active-nonpush|' + String(curBuildSource || '') + '|' + curBuildId + '|' + Number(_domSeqVersion || 0));
                    return {
                        seq: _domBeadSeqManaged || '',
                        rawSeq: window.__cw_bead_raw_seq || '',
                        which: 'dom-baccarat-hold-managed',
                        seqVersion: _domSeqVersion,
                        seqEvent: _domSeqEvent,
                        cols: [],
                        cells: []
                    };
                }
                var seedTarget = String(_domResetSeedTargetRaw || '');
                var seedConsumed = String(_domResetSeedConsumedRaw || '');
                var isFreshSeedCycle = (!seedTarget && !seedConsumed);
                if (activeSeedBurstBlocked && isFreshSeedCycle) {
                    _domShoeResetPending = false;
                    _domSeqEvent = 'active-reset-seed-skip-same-burst';
                    _domSeqAppend = '';
                    brPublishSeqState();
                    cwDbg('SEQSRC', 'skip-active-reset-seed-same-burst', {
                        reason: String(reasonTag || ''),
                        activeTitle: activeTitle,
                        activeSeqLen: activeSeq.length,
                        activeSeedKey: activeSeedKey,
                        noBoardBurstId: Number(_domNoBoardBurstId || 0),
                        lastActiveSeedBurstId: Number(_domLastActiveSeedBurstId || 0),
                        seqVersion: Number(_domSeqVersion || 0),
                        seqEvent: String(_domSeqEvent || ''),
                        buildSource: curBuildSource,
                        buildId: curBuildId
                    }, 0, 'seqsrc-skip-active-seed-same-burst|' + activeSeedKey + '|' + Number(_domNoBoardBurstId || 0) + '|' + Number(_domSeqVersion || 0));
                    return {
                        seq: _domBeadSeqManaged || '',
                        rawSeq: window.__cw_bead_raw_seq || '',
                        which: 'dom-baccarat-hold-managed',
                        seqVersion: _domSeqVersion,
                        seqEvent: _domSeqEvent,
                        cols: [],
                        cells: []
                    };
                }
                var activeClean = brSanitizeSeq(activeSeq);
                var beforeLen = String(_domBeadSeqManaged || '').length;
                var baseTailTitle = String(_domActiveSeedTailTitle || '');
                var titleChanged = (!!activeTitle && activeTitle !== baseTailTitle);
                if (titleChanged) {
                    _domActiveSeedTailTitle = activeTitle;
                    _domActiveSeedTailLen = 0;
                } else if (!_domActiveSeedTailTitle && activeTitle) {
                    _domActiveSeedTailTitle = activeTitle;
                }

                if (!activeClean) {
                    _domSeqEvent = 'active-reset-seed-tail-empty';
                    _domSeqAppend = '';
                    brPublishSeqState();
                    cwDbg('SEQFLOW', 'active-seed-tail-empty', {
                        reason: String(reasonTag || ''),
                        activeTitle: activeTitle,
                        activeSeqLen: String(activeSeq || '').length,
                        tailTitle: String(_domActiveSeedTailTitle || ''),
                        tailLen: Number(_domActiveSeedTailLen || 0),
                        beforeManagedLen: beforeLen,
                        seqVersion: Number(_domSeqVersion || 0),
                        seqEvent: String(_domSeqEvent || ''),
                        buildId: curBuildId,
                        buildSource: curBuildSource
                    }, 0, 'active-seed-tail-empty|' + String(reasonTag || '') + '|' + Number(_domSeqVersion || 0) + '|' + curBuildId);
                    return {
                        seq: _domBeadSeqManaged || '',
                        rawSeq: window.__cw_bead_raw_seq || '',
                        which: 'dom-baccarat-hold-managed',
                        seqVersion: _domSeqVersion,
                        seqEvent: _domSeqEvent,
                        cols: [],
                        cells: []
                    };
                }

                var activeLen = activeClean.length;
                var prevTailLen = Number(_domActiveSeedTailLen || 0);
                var prevConsumedPrefix = Number(_domActiveSeedConsumedPrefixLen || 0);
                var prevTailSeq = String(_domActiveSeedTailSeq || '');
                var appendedDelta = '';
                var appendIndex = -1;
                var growth = activeLen - prevTailLen;
                var reserveTail = (activeLen >= 2) ? 1 : 0;
                var safePrefixLen = Math.max(0, activeLen - reserveTail);
                var prevReserveTail = (prevTailLen >= 2) ? 1 : 0;
                var prevSafePrefixLen = Math.max(0, prevTailLen - prevReserveTail);
                var prevSafePrefix = prevTailSeq ? prevTailSeq.slice(0, prevSafePrefixLen) : '';
                var curSafePrefix = activeClean.slice(0, safePrefixLen);
                var prefixShifted = !!(prevSafePrefix && curSafePrefix && curSafePrefix.indexOf(prevSafePrefix) !== 0);
                var activeStepBuildLocked = !!(
                    Number(_domLastActiveSeedStepBuildId || 0) > 0 &&
                    Number(_domLastActiveSeedStepBuildId || 0) === Number(curBuildId || 0)
                );
                var initSeedEligible = !!(
                    beforeLen <= 0 &&
                    activeLen === 1 &&
                    prevConsumedPrefix < safePrefixLen
                );
                var mode = 'hold';
                // Active seq có thể chứa 1 ký tự dự báo ở đuôi; chỉ consume prefix đã "an toàn".
                // Mỗi lần tăng activeLen chỉ consume tối đa 1 step để không nhảy loạn.
                if (titleChanged || prevTailLen <= 0) {
                    _domActiveSeedTailLen = activeLen;
                    _domActiveSeedTailSeq = activeClean;
                    if (initSeedEligible) {
                        appendIndex = prevConsumedPrefix;
                        appendedDelta = activeClean.charAt(appendIndex);
                        if (appendedDelta && !activeStepBuildLocked) {
                            brAppendManaged(appendedDelta, 'append-reset-seed-step');
                            _domActiveSeedConsumedPrefixLen = appendIndex + 1;
                            _domLastActiveSeedStepBuildId = Number(curBuildId || 0);
                            mode = 'init-prefix-step';
                        } else if (activeStepBuildLocked) {
                            _domSeqEvent = 'active-reset-seed-step-build-lock';
                            _domSeqAppend = '';
                            brPublishSeqState();
                            mode = 'init-build-lock';
                            cwDbg('SEQFLOW', 'active-seed-step-build-lock', {
                                reason: 'init',
                                activeTitle: activeTitle,
                                activeSeq: activeClean,
                                activeSeqLen: activeLen,
                                seqVersion: Number(_domSeqVersion || 0),
                                seqEvent: String(_domSeqEvent || ''),
                                buildId: Number(curBuildId || 0),
                                stepBuildId: Number(_domLastActiveSeedStepBuildId || 0)
                            }, 0, 'active-seed-step-lock|init|' + Number(curBuildId || 0) + '|' + Number(_domSeqVersion || 0));
                        } else {
                            _domSeqEvent = 'active-reset-seed-tail-init';
                            _domSeqAppend = '';
                            brPublishSeqState();
                            mode = 'init';
                        }
                    } else {
                        _domSeqEvent = 'active-reset-seed-tail-init';
                        _domSeqAppend = '';
                        brPublishSeqState();
                        mode = 'init';
                    }
                } else if (growth > 0 && prevConsumedPrefix < safePrefixLen) {
                    if (prefixShifted) {
                        var canRecoverPrefixShift = !!(
                            beforeLen <= 0 &&
                            prevConsumedPrefix <= 0 &&
                            prevTailLen >= 2 &&
                            activeLen === (prevTailLen + 1) &&
                            safePrefixLen >= 1 &&
                            !activeStepBuildLocked
                        );
                        if (canRecoverPrefixShift) {
                            appendIndex = 0;
                            appendedDelta = activeClean.charAt(appendIndex);
                            if (appendedDelta) {
                                brAppendManaged(appendedDelta, 'append-reset-seed-step');
                                _domActiveSeedConsumedPrefixLen = 1;
                                _domLastActiveSeedStepBuildId = Number(curBuildId || 0);
                                mode = 'prefix-shift-recover-step';
                                cwDbg('SEQFLOW', 'active-seed-prefix-shift-recover', {
                                    activeTitle: activeTitle,
                                    activeSeq: activeClean,
                                    prevTailSeq: prevTailSeq,
                                    prevTailLen: prevTailLen,
                                    activeSeqLen: activeLen,
                                    prevSafePrefix: prevSafePrefix,
                                    curSafePrefix: curSafePrefix,
                                    prevSafePrefixLen: prevSafePrefixLen,
                                    curSafePrefixLen: safePrefixLen,
                                    prevConsumedPrefix: prevConsumedPrefix,
                                    recoveredIndex: appendIndex,
                                    recoveredDelta: appendedDelta,
                                    seqVersion: Number(_domSeqVersion || 0),
                                    seqEvent: String(_domSeqEvent || ''),
                                    buildId: Number(curBuildId || 0)
                                }, 0, 'active-seed-prefix-recover|' + String(activeTitle || '') + '|' + Number(curBuildId || 0) + '|' + Number(_domSeqVersion || 0));
                            } else {
                                _domActiveSeedConsumedPrefixLen = 0;
                                _domSeqEvent = 'active-reset-seed-tail-prefix-shift';
                                _domSeqAppend = '';
                                brPublishSeqState();
                                mode = 'prefix-shift-hold';
                            }
                        } else {
                            _domActiveSeedConsumedPrefixLen = 0;
                            _domSeqEvent = 'active-reset-seed-tail-prefix-shift';
                            _domSeqAppend = '';
                            brPublishSeqState();
                            mode = 'prefix-shift-hold';
                            cwDbg('SEQFLOW', 'active-seed-prefix-shift-hold', {
                                activeTitle: activeTitle,
                                activeSeq: activeClean,
                                prevTailSeq: prevTailSeq,
                                prevTailLen: prevTailLen,
                                activeSeqLen: activeLen,
                                prevSafePrefix: prevSafePrefix,
                                curSafePrefix: curSafePrefix,
                                prevSafePrefixLen: prevSafePrefixLen,
                                curSafePrefixLen: safePrefixLen,
                                prevConsumedPrefix: prevConsumedPrefix,
                                canRecoverPrefixShift: canRecoverPrefixShift ? 1 : 0,
                                seqVersion: Number(_domSeqVersion || 0),
                                seqEvent: String(_domSeqEvent || ''),
                                buildId: Number(curBuildId || 0)
                            }, 0, 'active-seed-prefix-shift|' + String(activeTitle || '') + '|' + Number(curBuildId || 0) + '|' + Number(_domSeqVersion || 0));
                        }
                    } else if (activeStepBuildLocked) {
                        _domSeqEvent = 'active-reset-seed-step-build-lock';
                        _domSeqAppend = '';
                        brPublishSeqState();
                        mode = 'step-build-lock';
                        cwDbg('SEQFLOW', 'active-seed-step-build-lock', {
                            reason: 'growth',
                            activeTitle: activeTitle,
                            activeSeq: activeClean,
                            activeSeqLen: activeLen,
                            prevTailLen: prevTailLen,
                            prevConsumedPrefix: prevConsumedPrefix,
                            seqVersion: Number(_domSeqVersion || 0),
                            seqEvent: String(_domSeqEvent || ''),
                            buildId: Number(curBuildId || 0),
                            stepBuildId: Number(_domLastActiveSeedStepBuildId || 0)
                        }, 0, 'active-seed-step-lock|growth|' + Number(curBuildId || 0) + '|' + Number(_domSeqVersion || 0));
                    } else {
                        appendIndex = prevConsumedPrefix;
                        appendedDelta = activeClean.charAt(appendIndex);
                        if (appendedDelta) {
                            brAppendManaged(appendedDelta, 'append-reset-seed-step');
                            _domActiveSeedConsumedPrefixLen = appendIndex + 1;
                            _domLastActiveSeedStepBuildId = Number(curBuildId || 0);
                            mode = (growth > 1) ? 'prefix-step-jump' : 'prefix-step';
                        } else {
                            mode = 'prefix-empty';
                        }
                    }
                    _domActiveSeedTailLen = activeLen;
                } else {
                    _domActiveSeedTailLen = activeLen;
                    _domSeqEvent = 'active-reset-seed-tail-hold';
                    _domSeqAppend = '';
                    brPublishSeqState();
                    mode = (growth > 0) ? 'growth-hold' : 'hold';
                }
                _domActiveSeedTailSeq = activeClean;

                var afterSeq = String(_domBeadSeqManaged || '');
                var afterLen = afterSeq.length;
                _domShoeResetPending = true;
                _domShoeResetAt = Date.now();
                _domLastActiveSeedKey = brBuildActiveSeedKey(activeTitle, activeClean);
                _domLastActiveSeedBurstId = Number(_domNoBoardBurstId || 0);
                brPublishSeqState();
                _cwSeqDiagState.lastSourcePick = {
                    source: 'dom-baccarat-active-reset-seed',
                    reason: String(reasonTag || ''),
                    activeTitle: activeTitle,
                    activeSeqLen: activeLen,
                    activeSeedMode: mode,
                    growth: growth,
                    tailLenBefore: prevTailLen,
                    tailLenAfter: Number(_domActiveSeedTailLen || 0),
                    reserveTail: reserveTail,
                    safePrefixLen: safePrefixLen,
                    prefixConsumedBefore: prevConsumedPrefix,
                    prefixConsumedAfter: Number(_domActiveSeedConsumedPrefixLen || 0),
                    appendIndex: appendIndex,
                    activeSeq: activeClean,
                    appendedDelta: appendedDelta,
                    beforeManagedLen: beforeLen,
                    afterManagedLen: afterLen,
                    seqVersion: _domSeqVersion,
                    seqEvent: _domSeqEvent,
                    buildSource: curBuildSource,
                    buildId: curBuildId
                };
                cwDbg('SEQSRC', 'use-active-reset-seed', {
                    reason: String(reasonTag || ''),
                    activeTitle: activeTitle,
                    activeSeqLen: activeLen,
                    managedTableTitle: managedTableTitle,
                    sameTableForActiveSeed: sameTableForActiveSeed ? 1 : 0,
                    activeSeedMode: mode,
                    activeSeedGrowth: growth,
                    activeSeedDelta: appendedDelta,
                    initSeedEligible: initSeedEligible ? 1 : 0,
                    activeStepBuildLocked: activeStepBuildLocked ? 1 : 0,
                    prefixShifted: prefixShifted ? 1 : 0,
                    reserveTail: reserveTail,
                    safePrefixLen: safePrefixLen,
                    prevSafePrefixLen: prevSafePrefixLen,
                    prevSafePrefix: prevSafePrefix,
                    curSafePrefix: curSafePrefix,
                    prefixConsumedBefore: prevConsumedPrefix,
                    prefixConsumedAfter: Number(_domActiveSeedConsumedPrefixLen || 0),
                    appendIndex: appendIndex,
                    tailLenBefore: prevTailLen,
                    tailLenAfter: Number(_domActiveSeedTailLen || 0),
                    beforeManagedLen: beforeLen,
                    afterManagedLen: afterLen,
                    seqVersion: _domSeqVersion,
                    seqEvent: _domSeqEvent,
                    buildSource: curBuildSource,
                    buildId: curBuildId
                }, 0, 'seqsrc-active-reset-seed|' + String(reasonTag || '') + '|' + activeTitle + '|' + Number(_domSeqVersion || 0) + '|' + curBuildSource + '|' + curBuildId);
                cwDbg(
                    'SEQFLOW',
                    'active-reset-seed compact|reason=' + String(reasonTag || '') +
                    '|activeLen=' + activeLen +
                    '|mode=' + mode +
                    '|growth=' + growth +
                    '|delta=' + (appendedDelta || '-') +
                    '|initSeed=' + (initSeedEligible ? 1 : 0) +
                    '|stepLock=' + (activeStepBuildLocked ? 1 : 0) +
                    '|prefixShift=' + (prefixShifted ? 1 : 0) +
                    '|idx=' + appendIndex +
                    '|reserve=' + reserveTail +
                    '|safePrefix=' + safePrefixLen +
                    '|consumed=' + prevConsumedPrefix + '->' + Number(_domActiveSeedConsumedPrefixLen || 0) +
                    '|active=' + activeClean +
                    '|tail=' + prevTailLen + '->' + Number(_domActiveSeedTailLen || 0) +
                    '|before=' + beforeLen +
                    '|after=' + afterLen +
                    '|ver=' + Number(_domSeqVersion || 0) +
                    '|evt=' + String(_domSeqEvent || '') +
                    '|build=' + curBuildId +
                    '|src=' + curBuildSource,
                    null,
                    0,
                    'active-reset-seed-compact|' + String(reasonTag || '') + '|' + Number(_domSeqVersion || 0) + '|' + curBuildId
                );
                return {
                    seq: afterSeq,
                    rawSeq: activeClean,
                    which: 'dom-baccarat-active-reset-seed',
                    seqVersion: _domSeqVersion,
                    seqEvent: _domSeqEvent,
                    cols: active.cols || [],
                    cells: active.cells || []
                };
            }

            var activeTinyBoardForSwitch = brIsTrustedTinyBoardSeq(activeSeq);
            var beadRawCleanForSwitch = brSanitizeSeq(beadRawSeq || '');
            var beadRawLooksStaleForSwitch = !!(
                _domTableSwitchWaitBeadPending &&
                _domTableSwitchWaitPrevRaw &&
                beadRawCleanForSwitch &&
                beadRawCleanForSwitch === _domTableSwitchWaitPrevRaw
            );
            var activeTinyWaitBeadNoBoardBlocked = brShouldBlockActiveTinyByNoBoard('active-card-wait-bead', activeTitle, activeSeq, beadRawCleanForSwitch);
            if (_domTableSwitchWaitBeadPending &&
                activeTinyBoardForSwitch &&
                !activeTinyWaitBeadNoBoardBlocked &&
                (!beadSeq || beadRawLooksStaleForSwitch || beadRawCleanForSwitch.length > (activeSeq.length + 3))) {
                var tinySeq = brApplyTableSwitchTinyBoard(activeSeq, activeTitle, 'active-card-wait-bead');
                if (tinySeq) {
                    _cwSeqDiagState.lastSourcePick = {
                        source: 'dom-baccarat-table-switch-tiny-active',
                        reason: beadRawLooksStaleForSwitch ? 'active-tiny-over-stale-bead-raw' : 'active-tiny-wait-bead',
                        activeTitle: activeTitle,
                        activeSeqLen: activeSeq.length,
                        beadRawLen: beadRawCleanForSwitch.length,
                        seqVersion: _domSeqVersion,
                        seqEvent: _domSeqEvent
                    };
                    return {
                        seq: tinySeq,
                        rawSeq: tinySeq,
                        which: 'dom-baccarat-table-switch-tiny-active',
                        seqVersion: _domSeqVersion,
                        seqEvent: _domSeqEvent,
                        cols: active.cols || [],
                        cells: active.cells || []
                    };
                }
            }
            if (activeTitle !== _domLastActiveTitle) {
                cwDbg('TABLE', 'active-card-changed', {
                    prev: _domLastActiveTitle,
                    current: activeTitle,
                    cards: (cards || []).map(function (x) { return x && x.title ? x.title : ''; }),
                    cardSeqLens: (cards || []).map(function (x) {
                        return x && x.seq ? String(x.seq || '').length : 0;
                    }),
                    managedLen: String(_domBeadSeqManaged || '').length,
                    seqVersion: _domSeqVersion,
                    resetPending: _domShoeResetPending ? 1 : 0
                }, 0, 'active-card|' + activeTitle);
                _domLastActiveTitle = activeTitle;
                _domRawStallLastActiveKey = '';
                brResetActiveSeedTailTracker();
            }

            // Đổi bàn A -> B: reset chuỗi theo bàn mới (giống mới vào app).
            if (activeTitle && activeTitle !== _domManagedTableTitle) {
                var prevTitle = String(_domManagedTableTitle || '');
                var switched = false;
                // Ưu tiên bead raw (board thật, có T); chỉ fallback activeSeq khi bead chưa sẵn.
                var activeTinyForTableChange = brIsTrustedTinyBoardSeq(activeSeq);
                var beadRawForTableChange = brSanitizeSeq(beadRawSeq || '');
                var activeTinyTableChangeNoBoardBlocked = brShouldBlockActiveTinyByNoBoard('active-card-table-switch', activeTitle, activeSeq, beadRawForTableChange);
                if (activeTinyTableChangeNoBoardBlocked)
                    activeTinyForTableChange = false;
                var beadRawTooFarFromTinyActive = !!(
                    activeTinyForTableChange &&
                    beadRawForTableChange.length > (activeSeq.length + 3)
                );
                var hasBeadRawForReset = !!beadRawForTableChange && !beadRawTooFarFromTinyActive;
                if (activeTinyForTableChange && !hasBeadRawForReset) {
                    switched = !!brApplyTableSwitchTinyBoard(activeSeq, activeTitle, 'active-card-table-switch');
                    beadRawSeq = switched ? String(_domBeadSeqManaged || '') : '';
                } else if (hasBeadRawForReset) {
                    switched = brResetManagedForTable(activeTitle, String(beadRawSeq || ''), 'table-switch-reset');
                } else {
                    switched = brResetManagedForTableWaitBead(activeTitle, 'table-switch-wait-bead');
                }
                cwDbg('TABLE', switched ? 'active-table-switch-reset-seq' : 'active-table-switch-wait-seq', {
                    from: prevTitle,
                    to: activeTitle,
                    switched: switched ? 1 : 0,
                    managedLen: String(_domBeadSeqManaged || '').length,
                    activeSeqLen: String(activeSeq || '').length,
                    beadRawLen: String(beadRawSeq || '').length,
                    resetSource: String(switched && activeTinyForTableChange && !hasBeadRawForReset ? 'active-tiny' : (hasBeadRawForReset ? 'bead-raw' : 'wait-bead')),
                    beadRawTooFarFromTinyActive: beadRawTooFarFromTinyActive ? 1 : 0
                }, 0, 'table-switch|' + prevTitle + '|' + activeTitle + '|' + (switched ? '1' : '0'));
                if (switched) {
                    // Chốt luôn snapshot sau switch để tránh 1 tick trả nhầm beadSeq cũ.
                    beadSeq = String(_domBeadSeqManaged || '');
                    beadRawSeq = brSanitizeSeq(beadRawSeq || '') || '';
                    var switchSourceType = String(activeTinyForTableChange && !hasBeadRawForReset ? 'active-tiny' : (hasBeadRawForReset ? 'bead-raw' : 'wait-bead'));
                    _cwSeqDiagState.lastSourcePick = {
                        source: 'dom-baccarat-table-switch-reset',
                        reason: switchSourceType === 'active-tiny' ? 'table-changed-reset-from-active-tiny' : (hasBeadRawForReset ? 'table-changed-reset-from-bead-raw' : 'table-changed-wait-bead-raw'),
                        activeTitle: activeTitle,
                        sourceType: switchSourceType,
                        seqLen: beadSeq.length,
                        seqVersion: _domSeqVersion,
                        seqEvent: _domSeqEvent
                    };
                    return {
                        seq: beadSeq,
                        rawSeq: beadRawSeq,
                        which: 'dom-baccarat-table-switch-reset',
                        seqVersion: _domSeqVersion,
                        seqEvent: _domSeqEvent,
                        cols: bead.cols || active.cols || [],
                        cells: bead.cells || active.cells || []
                    };
                }
            }

            // Board fail: không seed từ active, chỉ giữ managed hiện tại để tránh append sai.
            if (!beadRawSeq && activeSeq) {
                var noBoardBurstActive = !!(
                    !_domShoeResetPending &&
                    Number(_domNoBoardStreak || 0) >= 2 &&
                    _domNoBoardFirstAt &&
                    (Date.now() - _domNoBoardFirstAt) <= 5000
                );
                if (!canUseActiveResetSeed &&
                    noBoardBurstActive &&
                    sameTableForActiveSeed &&
                    isPushBuildContext &&
                    activeSeq.length <= 8 &&
                    !activeSeedBurstBlocked &&
                    !activeSeedGlobalBlocked &&
                    allowActiveSeedByNoBoardReason) {
                    _domShoeResetPending = true;
                    _domShoeResetAt = Date.now();
                    brResetSeedTracker();
                    _domRawStallLastActiveKey = '';
                    _domSeqEvent = 'shoe-reset-arm-bead-missing-active';
                    _domSeqAppend = '';
                    brPublishSeqState();
                    canUseActiveResetSeed = true;
                    cwDbg('SEQSRC', 'force-arm-active-seed-by-no-board', {
                        activeTitle: activeTitle,
                        activeSeqLen: activeSeq.length,
                        managedLen: String(_domBeadSeqManaged || '').length,
                        noBoardStreak: Number(_domNoBoardStreak || 0),
                        noBoardBurstMs: Date.now() - Number(_domNoBoardFirstAt || 0),
                        buildSource: curBuildSource,
                        buildId: curBuildId
                    }, 0, 'seqsrc-force-arm-active|' + activeTitle + '|' + activeSeq.length + '|' + Number(_domSeqVersion || 0));
                }
                if (canUseActiveResetSeed) {
                    return useActiveResetSeed('bead-missing');
                }
                _cwSeqDiagState.lastSourcePick = {
                    source: 'dom-baccarat-managed-hold',
                    reason: 'bead-missing-active-seed-blocked',
                    activeTitle: activeTitle,
                    activeSeqLen: activeSeq.length,
                    managedLen: String(_domBeadSeqManaged || '').length,
                    seqVersion: _domSeqVersion,
                    seqEvent: _domSeqEvent
                };
                cwDbg('SEQSRC', 'bead-missing-hold-managed', {
                    reason: activeSeedBurstBlocked ? 'active-seed-same-burst'
                        : (activeSeedGlobalBlocked ? 'active-seed-same-key'
                            : (!allowActiveSeedByNoBoardReason ? ('active-seed-no-board-reason-' + lastNoBoardReason) : 'active-seed-blocked')),
                    activeTitle: activeTitle,
                    activeSeqLen: activeSeq.length,
                    managedLen: String(_domBeadSeqManaged || '').length,
                    seqVersion: _domSeqVersion,
                    seqEvent: _domSeqEvent,
                    activeSeedKey: activeSeedKey,
                    activeSeedGlobalBlocked: activeSeedGlobalBlocked ? 1 : 0,
                    activeSeedAlreadyUsed: activeSeedAlreadyUsed ? 1 : 0,
                    lastNoBoardReason: lastNoBoardReason,
                    noBoardBurstId: Number(_domNoBoardBurstId || 0),
                    lastActiveSeedBurstId: Number(_domLastActiveSeedBurstId || 0)
                }, 2500, 'seqsrc-bead-missing-hold|' + activeTitle + '|' + _domSeqVersion + '|' + (_domSeqEvent || ''));
                return {
                    seq: _domBeadSeqManaged || '',
                    rawSeq: window.__cw_bead_raw_seq || '',
                    which: 'dom-baccarat-hold-managed',
                    seqVersion: _domSeqVersion,
                    seqEvent: _domSeqEvent,
                    cols: [],
                    cells: []
                };
            }

            if (beadRawSeq && Number(_domActiveSeedTailLen || 0) > 0) {
                cwDbg('SEQFLOW', 'active-seed-tail-clear-by-bead', {
                    activeTitle: activeTitle,
                    beadRawLen: String(beadRawSeq || '').length,
                    managedLen: String(_domBeadSeqManaged || '').length,
                    tailTitle: String(_domActiveSeedTailTitle || ''),
                    tailLen: Number(_domActiveSeedTailLen || 0),
                    seqVersion: Number(_domSeqVersion || 0),
                    seqEvent: String(_domSeqEvent || '')
                }, 0, 'active-seed-tail-clear-bead|' + String(activeTitle || '') + '|' + Number(_domSeqVersion || 0));
                brResetActiveSeedTailTracker();
                brPublishSeqState();
            }

            // Authority chỉ bám bead/raw board; active seq chỉ để chẩn đoán, không được kéo dài authority.
            if (beadSeq && beadRawSeq && activeSeq && !_domShoeResetPending) {
                if (activeSeq.indexOf(beadSeq) === 0 && activeSeq.length > beadSeq.length) {
                    cwDbg('SEQFLOW', 'active-tail-extend-authority-blocked', {
                        beadSeqLen: beadSeq.length,
                        activeSeqLen: activeSeq.length,
                        beadTail: beadSeq ? beadSeq.charAt(beadSeq.length - 1) : '',
                        activeTail: activeSeq ? activeSeq.charAt(activeSeq.length - 1) : '',
                        seqVersion: Number(_domSeqVersion || 0),
                        seqEvent: String(_domSeqEvent || ''),
                        activeTitle: activeTitle
                    }, 6000, 'active-tail-extend-authority-blocked|' + beadSeq.length + '|' + activeSeq.length + '|' + String(activeTitle || ''));
                }
                if (activeSeq.indexOf(beadSeq) === 0 && activeSeq.length > beadSeq.length) {
                    var directGap = activeSeq.length - beadSeq.length;
                    if (directGap > 1) {
                        cwDbg('SEQFLOW', 'active-tail-extend-blocked-gap', {
                            beadSeqLen: beadSeq.length,
                            activeSeqLen: activeSeq.length,
                            directGap: directGap,
                            beadTail: beadSeq ? beadSeq.charAt(beadSeq.length - 1) : '',
                            activeTail: activeSeq ? activeSeq.charAt(activeSeq.length - 1) : '',
                            seqVersion: Number(_domSeqVersion || 0),
                            seqEvent: String(_domSeqEvent || ''),
                            activeTitle: activeTitle
                        }, 7000, 'active-tail-blocked-gap|' + beadSeq.length + '|' + activeSeq.length + '|' + String(activeTitle || ''));
                    }
                }
                _cwSeqDiagState.lastSourcePick = {
                    source: 'dom-bead',
                    reason: 'bead-raw-authority',
                    beadSeqLen: beadSeq.length,
                    activeSeqLen: activeSeq.length,
                    resetPending: _domShoeResetPending ? 1 : 0,
                    seqVersion: _domSeqVersion,
                    seqEvent: _domSeqEvent
                };
                cwDbg('SEQSRC', 'prefer-dom-bead-authority', {
                    reason: 'bead-raw-authority',
                    beadSeqLen: beadSeq.length,
                    activeSeqLen: activeSeq.length,
                    activeTitle: activeTitle,
                    seqVersion: _domSeqVersion,
                    seqEvent: _domSeqEvent
                }, 5000, 'seqsrc-bead-over-active|' + beadSeq.length + '|' + activeSeq.length + '|' + _domSeqVersion);
                return {
                    seq: beadSeq,
                    rawSeq: beadRawSeq || '',
                    which: bead.which || 'dom-bead',
                    seqVersion: _domSeqVersion,
                    seqEvent: _domSeqEvent,
                    cols: bead.cols || [],
                    cells: bead.cells || []
                };
            }

            if (beadSeq && beadRawSeq) {
                _cwSeqDiagState.lastSourcePick = {
                    source: 'dom-bead',
                    reason: 'bead-available',
                    beadSeqLen: beadSeq.length,
                    activeSeqLen: activeSeq.length,
                    seqVersion: _domSeqVersion,
                    seqEvent: _domSeqEvent
                };
                cwDbg('SEQ', 'readTKSeq-dom-bead', {
                    beadSeqLen: beadSeq.length,
                    rawSeqLen: String(bead.rawSeq || '').length,
                    seqVersion: _domSeqVersion,
                    seqEvent: _domSeqEvent,
                    resetPending: _domShoeResetPending ? 1 : 0
                }, 4000, 'readseq-bead|' + beadSeq + '|' + _domSeqVersion);
                cwDbg(
                    'SEQFLOW',
                    'readseq-bead compact|ver=' + Number(_domSeqVersion || 0) +
                    '|evt=' + String(_domSeqEvent || '') +
                    '|seqLen=' + beadSeq.length +
                    '|rawLen=' + String(bead.rawSeq || '').length +
                    '|tail=' + (beadSeq ? beadSeq.charAt(beadSeq.length - 1) : '-') +
                    '|resetPending=' + (_domShoeResetPending ? 1 : 0) +
                    '|rev=' + _cwSeqScriptRev,
                    null,
                    1500,
                    'readseq-bead-compact|' + Number(_domSeqVersion || 0) + '|' + beadSeq.length + '|' + String(_domSeqEvent || '')
                );
                return {
                    seq: beadSeq,
                    rawSeq: beadRawSeq || '',
                    which: bead.which || 'dom-bead',
                    seqVersion: _domSeqVersion,
                    seqEvent: _domSeqEvent,
                    cols: bead.cols || [],
                    cells: bead.cells || []
                };
            }
            if (active && activeSeq) {
                if (String(_domBeadSeqManaged || '').length) {
                    if (canUseActiveResetSeed) {
                        return useActiveResetSeed('active-blocked-managed-present');
                    }
                    _cwSeqDiagState.lastSourcePick = {
                        source: 'dom-baccarat-managed-hold',
                        reason: 'active-fallback-blocked-managed-present',
                        activeTitle: activeTitle,
                        activeSeqLen: activeSeq.length,
                        managedLen: String(_domBeadSeqManaged || '').length,
                        seqVersion: _domSeqVersion,
                        seqEvent: _domSeqEvent
                    };
                    cwDbg('SEQSRC', 'active-fallback-blocked-managed-present', {
                        activeTitle: activeTitle,
                        activeSeqLen: activeSeq.length,
                        managedLen: String(_domBeadSeqManaged || '').length,
                        seqVersion: _domSeqVersion,
                        seqEvent: _domSeqEvent
                    }, 500, 'seqsrc-active-blocked|' + activeTitle + '|' + _domSeqVersion);
                    return {
                        seq: _domBeadSeqManaged || '',
                        rawSeq: window.__cw_bead_raw_seq || '',
                        which: 'dom-baccarat-managed-hold',
                        seqVersion: _domSeqVersion,
                        seqEvent: _domSeqEvent,
                        cols: [],
                        cells: []
                    };
                }
                _cwSeqDiagState.lastSourcePick = {
                    source: 'dom-baccarat-fallback',
                    reason: 'bead-empty-active-available',
                    activeTitle: activeTitle,
                    activeSeqLen: activeSeq.length,
                    seqVersion: _domSeqVersion,
                    seqEvent: _domSeqEvent
                };
                cwDbg('SEQSRC', 'use-active-fallback', {
                    reason: 'bead-empty-active-available',
                    activeTitle: activeTitle,
                    activeSeqLen: activeSeq.length,
                    resetPending: _domShoeResetPending ? 1 : 0,
                    seqVersion: _domSeqVersion,
                    seqEvent: _domSeqEvent
                }, 500, 'seqsrc-active-fallback|' + activeTitle + '|' + activeSeq.length + '|' + _domSeqVersion);
                cwDbg('SEQ', 'readTKSeq-dom-fallback-active', {
                    activeTitle: activeTitle,
                    activeSeq: activeSeq,
                    resetPending: _domShoeResetPending ? 1 : 0
                }, 500, 'readseq-fallback|' + activeTitle + '|' + activeSeq);
                return {
                    seq: activeSeq,
                    rawSeq: activeSeq,
                    which: 'dom-baccarat-fallback',
                    seqVersion: _domSeqVersion,
                    seqEvent: _domSeqEvent,
                    cols: active.cols || [],
                    cells: active.cells || []
                };
            }
            _cwSeqDiagState.lastSourcePick = {
                source: 'dom-bead-managed',
                reason: 'no-bead-no-active',
                managedLen: String(_domBeadSeqManaged || '').length,
                seqVersion: _domSeqVersion,
                seqEvent: _domSeqEvent
            };
            cwDbg('SEQ', 'readTKSeq-dom-empty', {
                managed: _domBeadSeqManaged,
                seqVersion: _domSeqVersion,
                seqEvent: _domSeqEvent,
                resetPending: _domShoeResetPending ? 1 : 0
            }, 1200, 'readseq-empty|' + _domSeqVersion + '|' + _domSeqEvent);
            return {
                seq: _domBeadSeqManaged || '',
                rawSeq: window.__cw_bead_raw_seq || '',
                which: 'dom-bead',
                seqVersion: _domSeqVersion,
                seqEvent: _domSeqEvent,
                cols: [],
                cells: []
            };
        }
        var r = readTKSeqBeads();
        if (r && r.seq && r.seq.length)
            return {
                seq: r.seq || '',
                rawSeq: r.rawSeq || r.seq || '',
                which: r.which || '',
                seqVersion: null,
                seqEvent: '',
                cols: r.cols || [],
                cells: r.cells || []
            };
        var digits = readTKSeqDigits();
        if (digits && digits.seq && digits.seq.length)
            return {
                seq: digits.seq || '',
                rawSeq: digits.rawSeq || digits.seq || '',
                which: digits.which || '',
                seqVersion: null,
                seqEvent: '',
                cols: digits.cols || [],
                cells: digits.cells || []
            };
        return {
            seq: '',
            rawSeq: '',
            which: '',
            seqVersion: null,
            seqEvent: '',
            cols: [],
            cells: []
        };
    }



        /* ---------------- helpers for totals by (y, tail) ---------------- */

        var TAIL_TOTAL_BET = 'dual/Canvas/node_dual/root/node_game(need_to_put_games_in_here)/prefab_game_14/root/node_general(use_in_both_mode)/table/bet_entries/lbl_total_bet';

        var TAIL_TUDO = 'dual/Canvas/node_dual/root/node_game(need_to_put_games_in_here)/prefab_game_14/root/node_general(use_in_both_mode)/table/bet_entries/bet_normal/ig_xocdia_4th/lbl_total_bet';

        var TAIL_TUTRANG = 'dual/Canvas/node_dual/root/node_game(need_to_put_games_in_here)/prefab_game_14/root/node_general(use_in_both_mode)/table/bet_entries/bet_normal/ig_xocdia_4tr/lbl_total_bet';

        var TAIL_3TRANG = 'dual/Canvas/node_dual/root/node_game(need_to_put_games_in_here)/prefab_game_14/root/node_general(use_in_both_mode)/table/bet_entries/bet_normal/ig_xocdia_3tr/lbl_total_bet';

        var TAIL_3DO = 'dual/Canvas/node_dual/root/node_game(need_to_put_games_in_here)/prefab_game_14/root/node_general(use_in_both_mode)/table/bet_entries/bet_normal/ig_xocdia_3th/lbl_total_bet';

        var TAIL_ACC = 'dual/Canvas/node_dual/root/node_game(need_to_put_games_in_here)/prefab_game_14/root/node_general(use_in_both_mode)/table/playersview/lbl_user_money';

        var X_ACC = 303;

        var TAIL_USER_NAME = 'dual/Canvas/node_dual/root/node_game(need_to_put_games_in_here)/prefab_game_14/root/node_general(use_in_both_mode)/table/playersview/lbl_user_name';

        var X_USER_NAME = 274;

        var Y_CHAN = 641;

        var Y_LE = 643;


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

            if (!texts)
                texts = buildTextRects();

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

                if (tailEquals(tailOfMoney(it), TAIL_TOTAL_BET))

                    arr.push({
                        idx: i,
                        it: it
                    });

            }

            arr.sort(function (A, B) {

                return xOf(A.it) - xOf(B.it) || yOf(A.it) - yOf(B.it);

            });

            var lines = ['(' + (title || 'Chan/Le candidates by tail') + ') idx\ttxt\tval\tx\ty\tsx\tsy\tsw\tsh'];

            for (var j = 0; j < arr.length; j++) {

                var r = arr[j].it;

                lines.push((j + 1) + ':' + arr[j].idx + "\t'" + r.txt + "'\t" + r.val + "\t" +
                    Math.round(xOf(r)) + "\t" + Math.round(yOf(r)) + "\t" +
                    Math.round(r.sx || 0) + "\t" + Math.round(r.sy || 0) + "\t" +
                    Math.round(r.sw || 0) + "\t" + Math.round(r.sh || 0));

            }

            if (!arr.length) {

                lines.push('(empty)');

            } else {

                var min = arr[0].it;

                var max = arr[arr.length - 1].it;

                lines.push('pick CHAN(minX): ' + Math.round(xOf(min)) + " -> '" + min.txt + "'");

                lines.push('pick LE(maxX): ' + Math.round(xOf(max)) + " -> '" + max.txt + "'");

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

            return pickByXOrderTail(buildMoneyFromTextRects(), TAIL_TOTAL_BET, 'min');

        };

        window.cwPickLe = function () {

            return pickByXOrderTail(buildMoneyFromTextRects(), TAIL_TOTAL_BET, 'max');

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
    function totals(S, forceFast) {
        if (!__cw_hasCocos()) {
            var cards = domScanBaccaratCards(!!forceFast);
            var active = domPickActiveCard(cards);
            var hud = domFindHudSnapshot();
            var stake = domScanBetStakeTotals(!!forceFast);
            if (!active) {
                return {
                    B: stake ? stake.B : null,
                    P: stake ? stake.P : null,
                    C: null,
                    L: null,
                    A: hud.balance,
                    N: hud.account,
                    TB: null,
                    TA: null,
                    T: stake ? stake.T : null,
                    BS: stake ? stake.source : null,
                    rawA: hud.rawBalance,
                    rawN: hud.account || null,
                    rawHS: hud.source || null,
                    rawB: stake ? stake.rawB : null,
                    rawP: stake ? stake.rawP : null,
                    rawT: stake ? stake.rawT : null,
                    rawTB: null,
                    rawTA: null,
                    cards: cards
                };
            }
            return {
                B: stake ? stake.B : null,
                P: stake ? stake.P : null,
                C: stake ? stake.B : null,
                L: stake ? stake.P : null,
                A: hud.balance,
                N: hud.account,
                TB: active.title,
                TA: active.amount,
                T: stake ? stake.T : null,
                BS: stake ? stake.source : null,
                rawB: stake ? stake.rawB : null,
                rawP: stake ? stake.rawP : null,
                rawC: stake ? stake.rawB : null,
                rawL: stake ? stake.rawP : null,
                rawA: hud.rawBalance,
                rawN: hud.account || null,
                rawHS: hud.source || null,
                rawT: stake ? stake.rawT : null,
                rawTB: active.title || null,
                rawTA: active.amount != null ? String(active.amount) : null,
                cards: cards
            };
        }
        S.money = buildMoneyRects(); // keep map for overlays & legacy helpers

        var list = S.money;
        // Reuse one TextMap snapshot per tick để tránh quét scene/DOM lặp lại.
        var listTextAll = buildTextRects();
        var listTextMoney = buildMoneyFromTextRects(listTextAll);
        var mC = pickByXOrderTail(listTextMoney, TAIL_TOTAL_BET, 'min');
        var mL = pickByXOrderTail(listTextMoney, TAIL_TOTAL_BET, 'max');
        if (mC && mL && mC === mL)
            mL = null;
        var mSD = null;
        var mTT = pickByTail(list, TAIL_TUTRANG);
        var m3T = pickByTail(list, TAIL_3TRANG);
        var m3D = pickByTail(list, TAIL_3DO);
        var mTD = pickByTail(list, TAIL_TUDO);
        var mA = pickByTailMinY(listTextMoney, TAIL_ACC);
        var mN = pickByTailMinY(listTextAll, TAIL_USER_NAME);

        return {
            C: mC ? mC.val : null,
            L: mL ? mL.val : null,
            A: mA ? mA.val : null,
            N: mN ? String(mN.text != null ? mN.text : '') : null,
            SD: mSD ? mSD.val : null,
            TT: mTT ? mTT.val : null,
            T3T: m3T ? m3T.val : null,
            T3D: m3D ? m3D.val : null,
            TD: mTD ? mTD.val : null,
            rawC: mC ? mC.txt : null,
            rawL: mL ? mL.txt : null,
            rawA: mA ? mA.txt : null,
            rawN: mN ? String(mN.text != null ? mN.text : '') : null,
            rawSD: mSD ? mSD.txt : null,
            rawTT: mTT ? mTT.txt : null,
            rawT3T: m3T ? m3T.txt : null,
            rawT3D: m3D ? m3D.txt : null,
            rawTD: mTD ? mTD.txt : null
        };
    }

    function sampleTotalsNow(forceFast) {
        try {
            return totals(S, !!forceFast);
        } catch (e) {
            return {
                B: null,
                P: null,
                C: null,
                L: null,
                A: null,
                N: null,
                TB: null,
                TA: null,
                rawA: null,
                rawN: null,
                rawHS: null,
                rawTB: null,
                rawTA: null
            };
        }
    }
    function sampleTotalsLiteNow() {
        try {
            if (__cw_hasCocos())
                return sampleTotalsNow();
            var now = Date.now();
            var betHot = false;
            try {
                betHot = (now - Number(window.__cw_last_bet_touch_at || 0)) < 2800;
            } catch (_) {
                betHot = false;
            }
            var stake = domScanBetStakeTotals(false);
            var hud = null;
            var hudCacheMs = betHot ? 1400 : 4600;
            if (_domHudCache.data && (now - Number(_domHudCache.at || 0)) < hudCacheMs) {
                hud = _domHudCache.data;
            } else {
                hud = domFindHudSnapshot();
                _domHudCache.at = now;
                _domHudCache.data = hud;
            }
            var prev = null;
            try {
                if (S && S._lastTotals)
                    prev = S._lastTotals;
            } catch (_) {}
            return {
                B: stake ? stake.B : null,
                P: stake ? stake.P : null,
                C: stake ? stake.B : null,
                L: stake ? stake.P : null,
                A: hud ? hud.balance : null,
                N: hud ? hud.account : null,
                TB: prev && prev.TB != null ? prev.TB : null,
                TA: prev && prev.TA != null ? prev.TA : null,
                T: stake ? stake.T : null,
                BS: stake ? stake.source : null,
                rawB: stake ? stake.rawB : null,
                rawP: stake ? stake.rawP : null,
                rawC: stake ? stake.rawB : null,
                rawL: stake ? stake.rawP : null,
                rawA: hud ? hud.rawBalance : null,
                rawN: hud ? (hud.account || null) : null,
                rawHS: hud ? (hud.source || null) : null,
                rawT: stake ? stake.rawT : null,
                rawTB: prev && prev.rawTB != null ? prev.rawTB : null,
                rawTA: prev && prev.rawTA != null ? prev.rawTA : null
            };
        } catch (_) {
            return sampleTotalsNow();
        }
    }
    async function waitForTotalsChange(before, side, timeout) {
        timeout = timeout || 1400;
        var t0 = (performance && performance.now ? performance.now() : Date.now());
        var last = before;
        var want = normalizeSide(side);
        while (((performance && performance.now ? performance.now() : Date.now()) - t0) < timeout) {
            await sleep(40);
            var cur = sampleTotalsNow(true);
            if (((want === 'BANKER' || want === 'CHAN') && ((cur.B !== last.B) || (cur.C !== last.C))) ||
                ((want === 'PLAYER' || want === 'LE') && ((cur.P !== last.P) || (cur.L !== last.L))) ||
                ((want === 'TIE') && ((cur.T !== last.T) || (cur.TT !== last.TT))) ||
                (cur.A !== last.A))
                return true;
            last = cur;
        }
        return false;
    }

    /* ---------------- state & UI ---------------- */
    var S = {
        running: false,
        timer: null,
        tickMs: 360,
        prog: null,
        status: '',
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
        seqVersion: 0,
        seqEvent: '',
        focusPinned: null
    };

    var ROOT = CW_ROOT_ID;
    var _old = document.getElementById(ROOT);
    if (_old)
        try {
            _old.remove();
        } catch (e) {}
    var root = document.createElement('div');
    root.id = ROOT;
    root.setAttribute('data-cw-mode', 'full');
    root.style.cssText = 'position:fixed;inset:0;z-index:2147483646;pointer-events:none;';
    document.body.appendChild(root);
    var _panelOwnerTimer = null;
    try {
        __cw_applyPanelDisplayOwner(root);
        _panelOwnerTimer = setInterval(function () {
            __cw_applyPanelDisplayOwner(root);
        }, 800);
    } catch (_) {}
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
        '<button id="bBetC">Bet BANKER</button>' +
        '<button id="bBetL">Bet PLAYER</button>' +
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

    function setBtnState(id, enabled, hint) {
        var btn = panel.querySelector(id);
        if (!btn)
            return;
        btn.disabled = !enabled;
        btn.title = hint || '';
        btn.style.opacity = enabled ? '1' : '0.45';
        btn.style.cursor = enabled ? 'pointer' : 'not-allowed';
    }
    function refreshModeButtons() {
        var domMode = !__cw_hasCocos();
        setBtnState('#bMoney', true, domMode ? 'DOM Baccarat mode: MoneyMap from HTML' : '');
        setBtnState('#bBet', true, domMode ? 'DOM Baccarat mode: BetMap from HTML' : '');
        setBtnState('#bText', true, domMode ? 'DOM Baccarat mode: TextMap from HTML' : '');
        setBtnState('#bScanMoney', true, domMode ? 'DOM Baccarat mode: Scan200Money from HTML' : '');
        setBtnState('#bScanBet', true, domMode ? 'DOM Baccarat mode: Scan200Bet from HTML' : '');
        setBtnState('#bScanText', true, domMode ? 'DOM Baccarat mode: Scan200Text from HTML' : '');
        setBtnState('#bBetC', true, domMode ? 'DOM Baccarat mode: bet by HTML target/current chip' : '');
        setBtnState('#bBetL', true, domMode ? 'DOM Baccarat mode: bet by HTML target/current chip' : '');
        setBtnState('#bScanTK', true, domMode ? 'DOM Baccarat mode: scan road tu giao dien HTML' : '');
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
        refreshModeButtons();
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
    function makeFocusEntry(kind, item) {
        if (!item)
            return null;
        return {
            rect: {
                x: item.x,
                y: item.y,
                w: item.w,
                h: item.h,
                sx: item.sx,
                sy: item.sy,
                sw: item.sw,
                sh: item.sh
            },
            idx: item.idx,
            tail: item.tail,
            txt: (item.text != null ? item.text : item.txt),
            val: (item.val != null ? item.val : moneyOf(item.text != null ? item.text : item.txt)),
            kind: kind,
            element: item.element || null
        };
    }
    function applyFocusEntry(focus, pinned) {
        if (!focus) {
            S.focus = null;
            if (pinned)
                S.focusPinned = null;
            showFocus(null);
            updatePanel();
            return;
        }
        S.focus = focus;
        if (pinned)
            S.focusPinned = focus;
        showFocus(focus.rect);
        updatePanel();
    }
    function restorePinnedFocus() {
        if (S.focusPinned) {
            S.focus = S.focusPinned;
            showFocus(S.focusPinned.rect);
        } else {
            S.focus = null;
            showFocus(null);
        }
        updatePanel();
    }
    function clearPinnedFocus() {
        S.focusPinned = null;
        S.focus = null;
        showFocus(null);
        updatePanel();
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
            function paintBox(mode) {
                if (mode === 'active') {
                    d.style.outline = '2px solid #ff5252';
                    d.style.background = '#ff525240';
                    d.style.color = '#fff59d';
                    return;
                }
                if (mode === 'hover') {
                    d.style.outline = '2px solid #ffd866';
                    d.style.background = '#ffd86633';
                    d.style.color = '#fff';
                    return;
                }
                d.style.outline = '1px dashed #88f';
                d.style.background = '#8888ff22';
                d.style.color = '#ffd866';
            }
            d.onmousedown = (function (t) {
                return function (ev) {
                    if (ev)
                        ev.stopPropagation();
                    applyFocusEntry(makeFocusEntry('text', t), true);
                    paintBox('active');
                };
            })(t);
            d.onmouseenter = (function (t) {
                return function (ev) {
                    if (ev)
                        ev.stopPropagation();
                    applyFocusEntry(makeFocusEntry('text', t), false);
                    if (S.focusPinned && S.focusPinned.idx === t.idx)
                        paintBox('active');
                    else
                        paintBox('hover');
                };
            })(t);
            d.onmouseleave = (function (t) {
                return function (ev) {
                    if (ev)
                        ev.stopPropagation();
                    if (S.focusPinned && S.focusPinned.idx === t.idx) {
                        paintBox('active');
                    } else {
                        paintBox('idle');
                        restorePinnedFocus();
                    }
                };
            })(t);
            d.onmouseup = function (ev) {
                if (ev)
                    ev.stopPropagation();
            };
            if (S.focusPinned && S.focusPinned.idx === t.idx)
                paintBox('active');
            layerText.appendChild(d);
        }
        layerText.onmousedown = function () {
            clearPinnedFocus();
        };
    }

    /* ---------------- panel info ---------------- */
    function updatePanel() {
            var t = S._lastTotals || {
            B: null,
            P: null,
            C: null,
            L: null,
            A: null,
            N: null,
            cards: [],
            rawB: null,
            rawP: null,
            rawC: null,
            rawL: null,
            rawA: null,
            rawN: null,
            TB: null,
            TA: null,
            rawTB: null,
            rawTA: null
        };
        var f = S.focus;
        var progText = (S.prog == null ? '--' : (S._progIsSec ? (S.prog + 's') : (((S.prog * 100) | 0) + '%')));
        var bankerVal = (t.B != null ? t.B : t.C);
        var playerVal = (t.P != null ? t.P : t.L);
        var cards = t.cards || [];
        var tableName = (t.TB != null && String(t.TB).trim()) ? String(t.TB).trim() : '--';
        var tableAmount = (t.TA != null ? fmt(t.TA) : '--');
        var accountName = (t.N != null && String(t.N).trim()) ? String(t.N).trim() : '--';
        var domCtx = null;
        if (!__cw_hasCocos()) {
            try {
                domCtx = domGetContext();
            } catch (_) {}
        }
        var ctxText = '--';
        if (domCtx) {
            var hrefShort = String(domCtx.href || '').split('?')[0];
            var lastSlash = hrefShort.lastIndexOf('/');
            if (lastSlash >= 0)
                hrefShort = hrefShort.slice(lastSlash + 1);
            ctxText = String(domCtx.source || 'top') + ' | ' + (hrefShort || String(domCtx.href || '--'));
        }
        var hudSource = (t.rawHS != null && String(t.rawHS).trim()) ? String(t.rawHS).trim() : '--';
        var base =
            ' Trạng thái: ' + S.status + ' | Prog: ' + progText + '\n' +
            '• CTX : ' + ctxText + '\n' +
            '• HUD : ' + hudSource + '\n' +
            '• TÀI KHOẢN : ' + accountName + ' | SỐ DƯ : ' + fmt(t.A) + '\n' +
            '• BÀN : ' + tableName + ' | TIỀN BÀN : ' + tableAmount + ' | BANKER: ' + fmt(bankerVal) + ' | PLAYER: ' + fmt(playerVal) + ' | TIE: ' + fmt(t.T) + '\n' +
            (!__cw_hasCocos() ? ('• BET POOL DOM : B=' + fmt(t.B) + ' | P=' + fmt(t.P) + ' | T=' + fmt(t.T) + ' | SRC=' + (t.BS || '--') + '\n') : '') +

            '• Focus: ' + (f ? f.kind : '-') + '\n' +
            '  idx : ' + (f && f.idx != null ? f.idx : '-') + '\n' +
            '  tail: ' + (f ? f.tail : '-') + '\n' +
            '  text: ' + (f ? (f.txt != null ? f.txt : '-') : '-') + '\n' +
            '  x,y,w,h: ' + (f && f.rect ? (Math.round(f.rect.x) + ',' + Math.round(f.rect.y) + ',' + Math.round(f.rect.w) + ',' + Math.round(f.rect.h)) : '-') + '\n' +
            '  val : ' + (f && f.val != null ? fmt(f.val) : '-');

        if (cards.length) {
            var lines = [];
            for (var ci = 0; ci < cards.length && ci < 6; ci++) {
                var card = cards[ci];
                lines.push((ci + 1) + '. ' + (card.title || '--') +
                    ' | B:' + (card.B != null ? card.B : '--') +
                    ' P:' + (card.P != null ? card.P : '--') +
                    ' T:' + (card.T != null ? card.T : '--') +
                    ' | $:' + fmt(card.amount) +
                    ' | CD:' + (card.countdown != null ? card.countdown + 's' : '--') +
                    ' | SEQ:' + (card.seq || '--'));
            }
            base += '\n• Baccarat DOM cards:\n' + lines.join('\n');
        }

        var tk = readTKSeq();
        S.seq = tk.seq || '';
        S.seqVersion = Number(tk && tk.seqVersion != null ? tk.seqVersion : (window.__cw_seq_version || 0)) || 0;
        S.seqEvent = String(tk && tk.seqEvent ? tk.seqEvent : (window.__cw_seq_event || ''));
        var seqHtml = 'Chuỗi kết quả : <i>--</i>';
        if (S.seq && S.seq.length) {
            var head = esc(S.seq.slice(0, -1));
            var last = esc(S.seq.slice(-1));
            seqHtml = 'Chuỗi kết quả : <span>' + head + '</span><span style="color:#f66">' + last + '</span>';
        }
        try {
            var panelStatus = '';
            try {
                panelStatus = (typeof readStatusTextByTail === 'function') ? String(readStatusTextByTail() || '') : String(S.status || '');
            } catch (_) {
                panelStatus = String(S.status || '');
            }
            window.__cw_last_panel_snapshot = {
                prog: S.prog,
                status: panelStatus,
                statusSource: String(window.__cw_status_source || ''),
                statusTail: String(window.__cw_status_tail || ''),
                seq: String(S.seq || ''),
                seqVersion: Number(S.seqVersion || 0),
                seqEvent: String(S.seqEvent || ''),
                totals: normalizeTotalsSnapshot(t),
                username: (t.N != null ? String(t.N) : ''),
                ts: Date.now()
            };
        } catch (_) {}
        try {
            if (window.__cw_pushPanelSnapshot)
                window.__cw_pushPanelSnapshot();
        } catch (_) {}
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
    function scan200Text() {
        var texts = buildTextRects().slice()
            .sort(function (a, b) {
                return a.y - b.y || a.x - b.x || (a.text || '').localeCompare(b.text || '');
            })
            .slice(0, 200)
            .map(function (t) {
                return {
                    idx: t.idx,
                    text: t.text,
                     tail: t.tail,
                     x: Math.round(t.x),
                     y: Math.round(t.y),
                     w: Math.round(t.w),
                     h: Math.round(t.h)
                 };
             });
         console.log('(TextMap index x200)\tidx\ttext\tx\ty\tw\th\ttail');
         for (var j = 0; j < texts.length; j++) {
             var r = texts[j];
             console.log(j + "\t" + r.idx + "\t'" + r.text + "'\t" + r.x + "\t" + r.y + "\t" + r.w + "\t" + r.h + "\t'" + r.tail + "'");
         }
         var lines = ['(TextMap index x200)\tidx\ttext\tx\ty\tw\th\ttail'];
         for (var k = 0; k < texts.length; k++) {
             var r2 = texts[k];
             lines.push(k + "\t" + r2.idx + "\t'" + r2.text + "'\t" + r2.x + "\t" + r2.y + "\t" + r2.w + "\t" + r2.h + "\t'" + r2.tail + "'");
         }
         if (!texts.length)
             lines.push('(empty)');
        setCwLog(lines.join('\n'));
         window.__cw_lastTextScan = texts;
         try {
             console.table(texts);
         } catch (e) {
             console.log(texts);
         }
         return texts;
     }

    function scanTK() {
        var r = readTKSeq();
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

    /* =====================================================
    CHIP BETTING CORE (compat)
    ===================================================== */
    var CHIP_TAIL_ROW4 = 'xdlive/canvas/bg/tipdealer/tabtipdealer/tipcontent/views/contentchat/row4/itemtip/lbmoney';
    var DENOMS_DESC = [10000000, 5000000, 1000000, 500000, 100000, 50000, 20000, 10000, 5000, 2000, 1000];
    var cfgBet = {
    delayPick: 70,
    delayTap: 55,
    delayBetweenSteps: 60
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
        if (r && r.element) {
            try {
                var el = r.element;
                if (el.scrollIntoView)
                    el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
                if (el.click)
                    el.click();
            } catch (_) {}
        }
        var cx = r.x + r.w / 2,
        cy = r.y + r.h / 2;
        return clickAtWin(jitter(cx - 2, cx + 2), jitter(cy - 2, cy + 2));
    }
    function getChipRects() {
        if (!__cw_hasCocos()) {
            var btnsDom = collectButtons();
            var chipsDom = [];
            for (var di = 0; di < btnsDom.length; di++) {
                var it = btnsDom[di];
                var txt = String(it.text || it.txt || '').trim();
                if (!/^\d{1,4}(?:[.,]\d+)?$/.test(txt))
                    continue;
                if (it.y < innerHeight * 0.7)
                    continue;
                var n = parseFloat(txt.replace(',', '.'));
                if (!isFinite(n) || n <= 0)
                    continue;
                var val = (n <= 500 ? Math.round(n * 1000) : Math.round(n));
                chipsDom.push({
                    element: it.element,
                    val: val,
                    x: it.x,
                    y: it.y,
                    w: it.w,
                    h: it.h,
                    text: txt
                });
            }
            chipsDom.sort(function (a, b) { return a.val - b.val; });
            return chipsDom;
        }
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
        if (!__cw_hasCocos()) {
            var btnsDom = collectButtons();
            var labelsDom = collectLabels();
            function pickDom(rxList, preferBottom) {
                var src = btnsDom.concat(labelsDom);
                var cand = src.filter(function (b) {
                    var txt = domNorm(b.text || b.txt || '');
                    for (var i = 0; i < rxList.length; i++) {
                        if (rxList[i].test(txt))
                            return true;
                    }
                    return false;
                });
                if (preferBottom) {
                    cand = cand.filter(function (b) {
                        return b.y > innerHeight * 0.58;
                    }).concat(cand);
                }
                if (!cand.length)
                    return null;
                cand.sort(function (a, b) {
                    var ab = (a.y > innerHeight * 0.58 ? 2000000 : 0) + (a.w * a.h);
                    var bb = (b.y > innerHeight * 0.58 ? 2000000 : 0) + (b.w * b.h);
                    return bb - ab;
                });
                return cand[0];
            }
            return {
                chan: pickDom([/\bbanker\b/, /\bnha cai\b/, /\bcai\b/, /\b庄\b/], true),
                le: pickDom([/\bplayer\b/, /\btay con\b/, /\bcon\b/, /\b闲\b/], true)
            };
        }
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
        var tgt = ((side === 'BANKER' || side === 'CHAN') ? tgts.chan : tgts.le);
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
                if (!__cw_hasCocos()) {
                    console.warn('[CW BET] DOM mode fallback: tap target with current selected chip');
                    await tapSide(side);
                    return;
                }
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
                        applied = await waitForTotalsChange(before, side, 200);
                        if (!applied && attempt === 1) {
                            await sleep(80);
                            await pickChip(step.val, chips);
                        }
                    }
                    if (!applied) {
                        var tgt = ((side === 'BANKER' || side === 'CHAN') ? getTargets().chan : getTargets().le);
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
                                if (await waitForTotalsChange(before, side, 200)) {
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
    var DOM_ALLOWED_SET = {};
    for (var _di = 0; _di < DENOMS_DESC.length; _di++) {
        var _domUnit = Math.floor(DENOMS_DESC[_di] / 1000);
        if (_domUnit > 0)
            DOM_ALLOWED_SET[String(_domUnit)] = 1;
    }
    var DENOMS = [500000000, 100000000, 50000000, 20000000, 10000000, 5000000, 1000000, 500000, 100000, 50000, 10000, 5000, 1000];

    function normalizeDomChipValue(val) {
        var num = Math.max(0, Math.floor(+val || 0));
        if (!num)
            return null;
        if (num >= 1000 && num % 1000 === 0)
            return Math.floor(num / 1000);
        return num;
    }

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
            return 'PLAYER';
        if (s === 'BANKER' || s === 'B' || s === 'CHAN' || s === 'EVEN')
            return 'BANKER';
        if (s === 'PLAYER' || s === 'P' || s === 'LE' || s === 'ODD')
            return 'PLAYER';
        if (s === 'TIE' || s === 'T' || s === 'HOA')
            return 'TIE';
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
        BANKER: /(BANKER|CHAN|EVEN|\bB\b)\b/i,
        PLAYER: /(PLAYER|\bLE\b|ODD|\bP\b)\b/i,
        TIE: /(TIE|HOA|\bT\b)\b/i,
        SAP_DOI: /(SAP\s*DOI|SAPDOI|2\s*DO\s*2\s*TRANG|2D2T|2R2W|2DO2TRANG)/i,
        TRANG3_DO1: /(3\s*TRANG\s*1\s*DO|3T1D|3W1R|3TRANG1DO|1\s*DO\s*3\s*TRANG|1D3T|1R3W|1DO3TRANG)/i,
        DO3_TRANG1: /(3\s*DO\s*1\s*TRANG|3D1T|3R1W|3DO1TRANG|1\s*TRANG\s*3\s*DO|1T3D|1W3R|1TRANG3DO)/i,
        TU_TRANG: /(TU\s*TRANG|4\s*TRANG|4W|TUTRANG)/i,
        TU_DO: /(TU\s*DO|4\s*DO|4R|TUDO)/i
    };
    var BET_TAILS = {
        BANKER: 'dual/Canvas/node_dual/root/node_game(need_to_put_games_in_here)/prefab_game_14/root/node_general(use_in_both_mode)/table/bet_entries/ig_xocdia_chan',
        PLAYER: 'dual/Canvas/node_dual/root/node_game(need_to_put_games_in_here)/prefab_game_14/root/node_general(use_in_both_mode)/table/bet_entries/ig_xocdia_le',
        TU_DO: 'dual/Canvas/node_dual/root/node_game(need_to_put_games_in_here)/prefab_game_14/root/node_general(use_in_both_mode)/table/bet_entries/bet_normal/ig_xocdia_4th',
        TU_TRANG: 'dual/Canvas/node_dual/root/node_game(need_to_put_games_in_here)/prefab_game_14/root/node_general(use_in_both_mode)/table/bet_entries/bet_normal/ig_xocdia_4tr',
        DO3_TRANG1: 'dual/Canvas/node_dual/root/node_game(need_to_put_games_in_here)/prefab_game_14/root/node_general(use_in_both_mode)/table/bet_entries/bet_normal/ig_xocdia_3th',
        TRANG3_DO1: 'dual/Canvas/node_dual/root/node_game(need_to_put_games_in_here)/prefab_game_14/root/node_general(use_in_both_mode)/table/bet_entries/bet_normal/ig_xocdia_3tr'
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
        if (!__cw_hasCocos()) {
            var domBest = domPickBestBetTargets();
            var wantDom = normalizeSide(side);
            var domTgt = domBest && domBest.targets ? domBest.targets[wantDom] : null;
            if (domTgt) {
                return {
                    node: domTgt.el,
                    el: domTgt.el,
                    dom: true,
                    source: domTgt.source,
                    text: domTgt.text,
                    tail: domTgt.tail,
                    rect: {
                        x: domTgt.x,
                        y: domTgt.y,
                        w: domTgt.w,
                        h: domTgt.h,
                        sx: domTgt.x,
                        sy: domTgt.y,
                        sw: domTgt.w,
                        sh: domTgt.h
                    },
                    area: (domTgt.w || 0) * (domTgt.h || 0)
                };
            }
            return null;
        }
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
        if (!tgt || !tgt.node)
            return false;
        function markBetClick() {
            try {
                window.__cw_last_bet_clicks = Number(window.__cw_last_bet_clicks || 0) + 1;
            } catch (_) {}
        }
        if (tgt.dom && tgt.el && tgt.el.ownerDocument) {
            var domOk = domMinimalClick(tgt.el);
            if (domOk)
                markBetClick();
            return domOk;
        }
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
        if (ok)
            markBetClick();
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

    function domWalkContextsLite(rootWin, source, offX, offY, out, seen) {
        try {
            if (!rootWin || seen.indexOf(rootWin) >= 0)
                return;
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
                domWalkContextsLite(child, source + '/frame[' + i + ']', (offX || 0) + (fr.left || 0), (offY || 0) + (fr.top || 0), out, seen);
            }
        } catch (_) {}
    }
    function domScoreBetContextLite(ctx) {
        try {
            if (!ctx)
                return 0;
            var href = String(ctx.href || '').toLowerCase();
            var source = String(ctx.source || '');
            var score = 0;
            if (href.indexOf('singlebactable.jsp') !== -1)
                score += 2400;
            if (href.indexOf('gamehall.jsp') !== -1)
                score += 900;
            if (href.indexOf('webmain.jsp') !== -1)
                score += 620;
            if (href.indexOf('/player/') !== -1)
                score += 420;
            if (href.indexOf('api/player/') !== -1)
                score += 220;
            if (source === 'top/frame[1]')
                score += 280;
            else if (source === 'top/frame[0]')
                score += 140;
            return score;
        } catch (_) {
            return 0;
        }
    }
    function domGetBetContexts(force) {
        var now = Date.now();
        if (!force && _domBetCtxCache.contexts && _domBetCtxCache.contexts.length && (now - Number(_domBetCtxCache.at || 0)) < 2200)
            return _domBetCtxCache.contexts;
        var contexts = [];
        try {
            domWalkContextsLite(domGetSameOriginRoot(window), 'top', 0, 0, contexts, []);
        } catch (_) {
            contexts = [];
        }
        var pref = null;
        try {
            pref = domGetContext();
        } catch (_) {
            pref = null;
        }
        if (pref && pref.doc) {
            var hasPref = false;
            for (var i0 = 0; i0 < contexts.length; i0++) {
                if (contexts[i0] && contexts[i0].doc === pref.doc) {
                    hasPref = true;
                    break;
                }
            }
            if (!hasPref) {
                contexts.push({
                    source: pref.source || 'top',
                    href: pref.href || '',
                    win: pref.win || window,
                    doc: pref.doc,
                    offX: pref.offX || 0,
                    offY: pref.offY || 0
                });
            }
        }
        for (var i = 0; i < contexts.length; i++) {
            var c = contexts[i];
            if (!c)
                continue;
            c._betScore = domScoreBetContextLite(c);
            try {
                if (pref && pref.doc && c.doc === pref.doc)
                    c._betScore += 480;
            } catch (_) {}
        }
        contexts.sort(function (a, b) {
            return Number(b && b._betScore || 0) - Number(a && a._betScore || 0);
        });
        if (contexts.length > 8)
            contexts = contexts.slice(0, 8);
        _domBetCtxCache.at = now;
        _domBetCtxCache.contexts = contexts;
        return contexts;
    }
    function domTextOf(el) {
        try {
            return domCollapse(el && (el.innerText || el.textContent) || '');
        } catch (_) {
            return '';
        }
    }
    function domMinimalClick(el) {
        try {
            if (!el)
                return false;
            var win = el.ownerDocument && el.ownerDocument.defaultView ? el.ownerDocument.defaultView : window;
            try {
                el.click();
                return true;
            } catch (_) {}
            try {
                el.dispatchEvent(new win.MouseEvent('click', {
                    bubbles: true,
                    cancelable: true,
                    composed: true
                }));
                return true;
            } catch (_) {}
            return false;
        } catch (_) {
            return false;
        }
    }
    function domTailOf(el) {
        try {
            return fullPath(el, 80) || domTailOfEl(el) || '';
        } catch (_) {
            return '';
        }
    }
    function domFireClick(el) {
        try {
            if (!el || !el.getBoundingClientRect)
                return false;
            var rect = el.getBoundingClientRect();
            var x = rect.left + rect.width / 2;
            var y = rect.top + rect.height / 2;
            var win = el.ownerDocument && el.ownerDocument.defaultView ? el.ownerDocument.defaultView : window;
            var opts = {
                bubbles: true,
                cancelable: true,
                composed: true,
                clientX: x,
                clientY: y,
                button: 0,
                buttons: 1
            };
            try { el.scrollIntoView({ block: 'center', inline: 'center' }); } catch (_) {}
            try { el.focus && el.focus(); } catch (_) {}
            try { el.dispatchEvent(new win.PointerEvent('pointerdown', opts)); } catch (_) {}
            try { el.dispatchEvent(new win.MouseEvent('mousedown', opts)); } catch (_) {}
            try { el.dispatchEvent(new win.PointerEvent('pointerup', opts)); } catch (_) {}
            try { el.dispatchEvent(new win.MouseEvent('mouseup', opts)); } catch (_) {}
            try { el.dispatchEvent(new win.MouseEvent('click', opts)); } catch (_) {}
            return true;
        } catch (_) {
            return false;
        }
    }
    function domFireClickAtPoint(doc, x, y) {
        try {
            if (!doc || !doc.elementFromPoint)
                return false;
            var el = doc.elementFromPoint(x, y);
            if (!el)
                return false;
            var win = doc.defaultView || window;
            var opts = {
                bubbles: true,
                cancelable: true,
                composed: true,
                clientX: x,
                clientY: y,
                button: 0,
                buttons: 1
            };
            try { el.scrollIntoView({ block: 'center', inline: 'center' }); } catch (_) {}
            try { el.focus && el.focus(); } catch (_) {}
            try { el.dispatchEvent(new win.PointerEvent('pointerdown', opts)); } catch (_) {}
            try { el.dispatchEvent(new win.MouseEvent('mousedown', opts)); } catch (_) {}
            try { el.dispatchEvent(new win.PointerEvent('pointerup', opts)); } catch (_) {}
            try { el.dispatchEvent(new win.MouseEvent('mouseup', opts)); } catch (_) {}
            try { el.dispatchEvent(new win.MouseEvent('click', opts)); } catch (_) {}
            return true;
        } catch (_) {
            return false;
        }
    }
    function domClickTargetRect(tgt) {
        try {
            var doc = tgt && tgt.el && tgt.el.ownerDocument ? tgt.el.ownerDocument : null;
            var rect = tgt && tgt.rect ? tgt.rect : null;
            if (!doc || !rect)
                return false;
            var px = rect.x + rect.w * 0.50;
            var py = rect.y + rect.h * 0.50;
            return domFireClickAtPoint(doc, px, py);
        } catch (_) {
            return false;
        }
    }
    function domChipValueFromIdOrClass(el) {
        var raw = '';
        try {
            raw = String((el && el.id) || '') + ' ' + String((el && el.className) || '');
        } catch (_) {
            raw = '';
        }
        var m = NORM(raw).match(/(?:^|[_\-\s])(50K|20K|10K|5K|2K|1K|500|200|100|50|20|10)(?:$|[_\-\s])/i);
        return m ? parseDomChipValue(m[1]) : null;
    }
    function domChipHostOf(el) {
        if (!el || !el.closest)
            return null;
        var selectors = [
            "[id^='Chips_']",
            "[id^='iChips_']",
            ".list_select_chips3d > div",
            ".list_select_chips3d > li",
            ".chips3d"
        ];
        for (var i = 0; i < selectors.length; i++) {
            try {
                var host = el.closest(selectors[i]);
                if (host)
                    return host;
            } catch (_) {}
        }
        return null;
    }
    function parseDomChipValue(txt) {
        if (!txt)
            return null;
        var s = NORM(txt);
        var m = s.match(/(\d+)\s*(K|M)\b/);
        if (m) {
            var v = +m[1];
            v *= (m[2] === 'K' ? 1e3 : 1e6);
            return normalizeDomChipValue(v);
        }
        m = s.match(/(\d{1,3}(?:[.,\s]\d{3})+|\d{1,9})/);
        if (m)
            return normalizeDomChipValue(parseInt(m[1].replace(/[^\d]/g, ''), 10));
        return null;
    }
    function domCollectSettingPopupChips(doc, source) {
        var rows = [];
        if (!doc || !doc.querySelectorAll)
            return rows;
        var nodes = doc.querySelectorAll("[id^='Chips_'], [id^='iChips_']");
        var byId = {};
        for (var i = 0; i < nodes.length; i++) {
            var li = nodes[i];
            if (!domVisible(li))
                continue;
            var rect = li.getBoundingClientRect();
            if (rect.width < 40 || rect.height < 40)
                continue;
            var val = parseDomChipValue(domTextOf(li)) || domChipValueFromIdOrClass(li);
            if (!val)
                continue;
            var idKey = String(li.id || '').toLowerCase();
            if (!idKey)
                idKey = String(val) + '|' + Math.round(rect.left / 10) + '|' + Math.round(rect.top / 10);
            var cs = doc.defaultView.getComputedStyle(li);
            byId[idKey] = {
                val: val,
                x: Math.round(rect.left),
                y: Math.round(rect.top),
                w: Math.round(rect.width),
                h: Math.round(rect.height),
                source: source,
                tail: domTailOf(li),
                enabled: Number(cs.opacity || '1') > 0.5,
                selected: /\bselect\b/i.test(String(li.className || '')),
                el: li,
                rect: {
                    x: Math.round(rect.left),
                    y: Math.round(rect.top),
                    w: Math.round(rect.width),
                    h: Math.round(rect.height)
                }
            };
        }
        for (var k in byId)
            rows.push(byId[k]);
        rows.sort(function (a, b) { return a.y - b.y || a.x - b.x || a.val - b.val; });
        return rows.length >= 6 ? rows : [];
    }
    function domCollectActiveBarChips(doc, source) {
        var rows = [];
        if (!doc || !doc.querySelectorAll)
            return rows;
        var nodes = doc.querySelectorAll(".list_select_chips3d > div, .list_select_chips3d > li, .chips3d");
        var byKey = {};
        for (var i = 0; i < nodes.length; i++) {
            var el = nodes[i];
            if (!domVisible(el))
                continue;
            var host = domChipHostOf(el) || el;
            if (!domVisible(host))
                continue;
            var rect = host.getBoundingClientRect();
            if (rect.top < doc.defaultView.innerHeight * 0.72)
                continue;
            var val = parseDomChipValue(domTextOf(host)) || domChipValueFromIdOrClass(host);
            if (!val)
                continue;
            var key = String(val) + '|' + Math.round(rect.left / 10) + '|' + Math.round(rect.top / 10);
            var cs = doc.defaultView.getComputedStyle(host);
            if (!byKey[key]) {
                byKey[key] = {
                    val: val,
                    x: Math.round(rect.left),
                    y: Math.round(rect.top),
                    w: Math.round(rect.width),
                    h: Math.round(rect.height),
                    source: source,
                    tail: domTailOf(host),
                    enabled: Number(cs.opacity || '1') > 0.5,
                    selected: true,
                    el: host,
                    rect: {
                        x: Math.round(rect.left),
                        y: Math.round(rect.top),
                        w: Math.round(rect.width),
                        h: Math.round(rect.height)
                    }
                };
            }
        }
        for (var k in byKey)
            rows.push(byKey[k]);
        rows.sort(function (a, b) { return a.x - b.x || a.y - b.y || a.val - b.val; });
        return rows;
    }
    function domPickBestChipPanel() {
        var contexts = domGetBetContexts();
        var bestPopup = null;
        var bestBar = null;
        for (var i = 0; i < contexts.length; i++) {
            var ctx = contexts[i];
            var popup = domCollectSettingPopupChips(ctx.doc, ctx.source);
            if (popup.length) {
                var popupScore = popup.length * 500 + (ctx.source === 'top/frame[1]' ? 800 : 0);
                if (!bestPopup || popupScore > bestPopup.score)
                    bestPopup = { mode: 'settings-popup', score: popupScore, chips: popup, source: ctx.source, doc: ctx.doc };
            }
            var bar = domCollectActiveBarChips(ctx.doc, ctx.source);
            if (bar.length) {
                var barScore = bar.length * 120 + (ctx.source === 'top/frame[1]' ? 250 : 0);
                if (!bestBar || barScore > bestBar.score)
                    bestBar = { mode: 'active-bar', score: barScore, chips: bar, source: ctx.source, doc: ctx.doc };
            }
        }
        return bestPopup || bestBar;
    }
    function domScanChipMap() {
        var panel = domPickBestChipPanel();
        var out = {};
        if (!panel || !panel.chips || !panel.chips.length)
            return out;
        for (var i = 0; i < panel.chips.length; i++) {
            var c = panel.chips[i];
            out[String(c.val)] = {
                entry: c.el,
                node: c.el,
                el: c.el,
                rect: c.rect,
                selected: !!c.selected,
                source: c.source,
                tail: c.tail
            };
        }
        return out;
    }
    async function domFocusChipInfo(info, amount) {
        if (!info || !info.el)
            return false;
        if (amount != null) {
            var normalizedAmount = normalizeDomChipValue(amount);
            var normalizedInfo = normalizeDomChipValue(info.value);
            if (normalizedAmount != null && normalizedInfo != null && normalizedAmount !== normalizedInfo)
                return false;
        }
        if (!domMinimalClick(info.el))
            return false;
        await sleep(140);
        return true;
    }
    async function domFocusChip(amount) {
        var val = Math.max(0, Math.floor(+amount || 0));
        if (!DOM_ALLOWED_SET[String(val)] && !ALLOWED_SET[String(val)])
            throw new Error('Menh gia khong hop le: ' + amount);
        var map = domScanChipMap();
        var info = map[String(val)];
        if (!info || !info.el)
            return false;
        return await domFocusChipInfo(info, val);
    }
    function domBetSideOfText(text) {
        var s = NORM(text || '');
        if (!s)
            return null;
        if (/PLAYER|TAY CON|\u95F2/.test(s))
            return 'PLAYER';
        if (/BANKER|NHA CAI|\u5E84/.test(s))
            return 'BANKER';
        if (/TIE|HOA|\u548C/.test(s))
            return 'TIE';
        return null;
    }
    function domBetTargetHostOf(el) {
        if (!el || !el.closest)
            return null;
        var ownText = domTextOf(el);
        var ownSide = domBetSideOfText(ownText);
        var selectors = [
            "li[id^='betBox']",
            ".zone_bet_bottom > li",
            ".zone_bet_bottom li",
            ".zone_bet_bottom > div",
            ".zone_bet_bottom div"
        ];
        for (var i = 0; i < selectors.length; i++) {
            var host = null;
            try {
                host = el.closest(selectors[i]);
            } catch (_) {
                host = null;
            }
            if (!host)
                continue;
            var hostText = domTextOf(host);
            var flatTail = NORM(domTailOf(host));
            if (flatTail.indexOf('ZONE_BET_BOTTOM') === -1 && flatTail.indexOf('BETBOX') === -1)
                continue;
            if (domBetSideOfText(hostText) || ownSide)
                return host;
        }
        return null;
    }
    function domCollectBetTargetCandidates(doc, source) {
        var rows = [];
        if (!doc || !doc.querySelectorAll)
            return rows;
        var all = doc.querySelectorAll('body *');
        for (var i = 0; i < all.length; i++) {
            var el = all[i];
            if (!domVisible(el))
                continue;
            var host = domBetTargetHostOf(el);
            if (!host || !domVisible(host))
                continue;
            var txt = domTextOf(host) || domTextOf(el);
            var side = domBetSideOfText(txt) || domBetSideOfText(domTextOf(el));
            if (!side)
                continue;
            var rect = host.getBoundingClientRect();
            if (rect.top < doc.defaultView.innerHeight * 0.60)
                continue;
            if (rect.width < 50 || rect.height < 30)
                continue;
            var tail = domTailOf(host);
            var flatTail = NORM(tail);
            if (flatTail.indexOf('ZONE_BET_BOTTOM') === -1 && flatTail.indexOf('BETBOX') === -1)
                continue;
            var key = side + '|' + Math.round(rect.left / 8) + '|' + Math.round(rect.top / 8);
            rows.push({
                side: side,
                text: txt,
                x: Math.round(rect.left),
                y: Math.round(rect.top),
                w: Math.round(rect.width),
                h: Math.round(rect.height),
                source: source,
                tail: tail,
                opacity: String(doc.defaultView.getComputedStyle(host).opacity || ''),
                enabled: Number(doc.defaultView.getComputedStyle(host).opacity || '1') > 0.2,
                el: host,
                _key: key
            });
        }
        var bestByKey = {};
        var keys = [];
        for (var j = 0; j < rows.length; j++) {
            var row = rows[j];
            if (!bestByKey[row._key]) {
                bestByKey[row._key] = row;
                keys.push(row._key);
            } else {
                var prev = bestByKey[row._key];
                if ((row.w * row.h) > (prev.w * prev.h))
                    bestByKey[row._key] = row;
            }
        }
        var out = [];
        for (var k = 0; k < keys.length; k++)
            out.push(bestByKey[keys[k]]);
        out.sort(function (a, b) { return a.y - b.y || a.x - b.x; });
        return out;
    }
    function domPickBestBetTargets() {
        var contexts = domGetBetContexts();
        var best = null;
        for (var i = 0; i < contexts.length; i++) {
            var ctx = contexts[i];
            var candidates = domCollectBetTargetCandidates(ctx.doc, ctx.source);
            if (!candidates.length)
                continue;
            var bySide = {};
            for (var j = 0; j < candidates.length; j++) {
                var c = candidates[j];
                var score = 0;
                score += c.source === 'top/frame[1]' ? 250 : 0;
                score += c.y > ctx.win.innerHeight * 0.68 ? 200 : 0;
                score += Math.min(c.w * c.h, 60000) / 400;
                if (/zone_bet_bottom|betbox/i.test(c.tail))
                    score += 300;
                if (/\b1:8\b/.test(c.text) && c.side === 'TIE')
                    score += 120;
                if (/\b1:1\b/.test(c.text) && (c.side === 'PLAYER' || c.side === 'BANKER'))
                    score += 80;
                c._score = score;
                if (!bySide[c.side] || score > bySide[c.side]._score)
                    bySide[c.side] = c;
            }
            var sides = ['PLAYER', 'BANKER', 'TIE'];
            var found = 0;
            var totalScore = (ctx.score || domScoreRows(ctx.rows || []));
            for (var s = 0; s < sides.length; s++) {
                var hit = bySide[sides[s]];
                if (!hit)
                    continue;
                found++;
                totalScore += hit._score || 0;
            }
            totalScore += found * 500;
            var result = {
                source: ctx.source,
                href: ctx.href,
                score: totalScore,
                targets: bySide,
                doc: ctx.doc
            };
            if (!best || result.score > best.score)
                best = result;
        }
        return best;
    }
    function domLooksLikeConfirmText(text) {
        var s = NORM(text || '');
        return s === 'XAC NHAN' || s === 'CONFIRM' || s === 'OK';
    }
    function domContainsRepeatOrDoubleText(text) {
        var s = NORM(text || '');
        return /(?:^| )(X2|LAP LAI|REPEAT|DOUBLE|NHAN DOI|GAP DOI)(?: |$)/.test(s);
    }
    function domLooksLikeRepeatOrDoubleText(text) {
        var s = NORM(text || '');
        return s === 'X2' ||
            s === 'LAP LAI' ||
            s === 'REPEAT' ||
            s === 'DOUBLE' ||
            s === 'NHAN DOI' ||
            s === 'GAP DOI' ||
            /(?:^| )X2(?: |$)/.test(s);
    }
    function domConfirmHostOf(el) {
        if (!el || !el.closest)
            return null;
        var ownText = domTextOf(el);
        if (domLooksLikeConfirmText(ownText) && !domLooksLikeRepeatOrDoubleText(ownText))
            return el;
        var selectors = ['button', 'span', 'p', "[role='button']", '.btn', '.button', '.confirm', '.btn_confirm', '.game_btn', '.zone_bet_bottom button', '.zone_bet_bottom > div', '.zone_bet_bottom > li', '.zone_bet_bottom li'];
        for (var i = 0; i < selectors.length; i++) {
            var host = null;
            try {
                host = el.closest(selectors[i]);
            } catch (_) {
                host = null;
            }
            if (!host)
                continue;
            var txt = domTextOf(host);
            if (domContainsRepeatOrDoubleText(txt))
                continue;
            if (domLooksLikeConfirmText(txt))
                return host;
        }
        return null;
    }
    function parseStakeUnitsLoose(txt) {
        if (!txt)
            return null;
        var raw = String(txt || '').trim();
        if (!raw)
            return null;
        if (/[:/]/.test(raw))
            return null;
        var amt = parseAmountLoose(raw);
        if (amt != null && amt > 0)
            return Math.floor(amt / 1000);
        var s = NORM(raw);
        var m = s.match(/\b(\d{1,5})\b/);
        if (!m)
            return null;
        var val = parseInt(m[1], 10);
        if (!isFinite(val) || val <= 1)
            return null;
        return val;
    }
    function domReadTargetStakeUnits(tgt, expectedUnits) {
        try {
            if (!tgt || !tgt.rect)
                return null;
            var rect = tgt.rect;
            var cx0 = rect.x + rect.w / 2;
            var cy0 = rect.y + rect.h / 2;
            var texts = buildTextRects();
            var best = null;
            var bestScore = -1e9;
            for (var i = 0; i < texts.length; i++) {
                var t = texts[i];
                var val = parseStakeUnitsLoose(t.text);
                if (!(val > 0))
                    continue;
                var cx = t.x + t.w / 2;
                var cy = t.y + t.h / 2;
                if (cx < rect.x - 12 || cx > rect.x + rect.w + 12)
                    continue;
                if (cy < rect.y - 12 || cy > rect.y + rect.h + 12)
                    continue;
                var score = 0;
                if (expectedUnits != null && val === expectedUnits)
                    score += 1000;
                if (t.w <= Math.max(64, rect.w * 0.45))
                    score += 120;
                if (t.h <= Math.max(40, rect.h * 0.55))
                    score += 80;
                score -= Math.round(dist2(cx, cy, cx0, cy0) / 12);
                if (score > bestScore) {
                    bestScore = score;
                    best = { val: val, text: t.text, tail: t.tail, x: cx, y: cy };
                }
            }
            return best;
        } catch (_) {
            return null;
        }
    }
    async function domWaitTargetStakeUnits(tgt, expectedUnits, timeout) {
        timeout = timeout || 420;
        var t0 = Date.now();
        while ((Date.now() - t0) < timeout) {
            await sleep(24);
            var hit = domReadTargetStakeUnits(tgt, expectedUnits);
            if (hit && (expectedUnits == null || hit.val === expectedUnits))
                return hit;
        }
        return null;
    }
    function domCollectConfirmCandidates(doc, source) {
        var rows = [];
        if (!doc || !doc.querySelectorAll)
            return rows;
        var all = doc.querySelectorAll('body *');
        for (var i = 0; i < all.length; i++) {
            var el = all[i];
            if (!domVisible(el))
                continue;
            var host = domConfirmHostOf(el);
            if (!host || !domVisible(host))
                continue;
            var txt = domTextOf(host) || domTextOf(el);
            if (domContainsRepeatOrDoubleText(txt))
                continue;
            if (!domLooksLikeConfirmText(txt))
                continue;
            var rect = host.getBoundingClientRect();
            if (rect.top < doc.defaultView.innerHeight * 0.70)
                continue;
            if (rect.width < 40 || rect.height < 20 || rect.width > 180 || rect.height > 90)
                continue;
            var cs = doc.defaultView.getComputedStyle(host);
            var tail = domTailOf(host);
            var cls = '';
            try { cls = String(host.className || ''); } catch (_) { cls = ''; }
            var disabledLike =
                /\bdisabled\b/i.test(cls) ||
                /\bdisabled\b/i.test(tail) ||
                /none/i.test(String(cs.pointerEvents || '')) ||
                Number(cs.opacity || '1') <= 0.2 ||
                host.hasAttribute('disabled') ||
                /true/i.test(String(host.getAttribute('aria-disabled') || ''));
            rows.push({
                text: txt,
                x: Math.round(rect.left),
                y: Math.round(rect.top),
                w: Math.round(rect.width),
                h: Math.round(rect.height),
                source: source,
                opacity: String(cs.opacity || ''),
                enabled: !disabledLike,
                tail: tail,
                el: host
            });
        }
        return rows;
    }
    function domCollectRepeatCandidates(doc) {
        var rows = [];
        if (!doc || !doc.querySelectorAll)
            return rows;
        var all = doc.querySelectorAll('body *');
        var seen = [];
        for (var i = 0; i < all.length; i++) {
            var el = all[i];
            if (!domVisible(el))
                continue;
            var txt = domTextOf(el);
            if (!domLooksLikeRepeatOrDoubleText(txt))
                continue;
            var host = el;
            try {
                host = el.closest('button,span,p,[role=\"button\"],.btn,.button,.game_btn,.zone_bet_bottom button,.zone_bet_bottom > div,.zone_bet_bottom > li,.zone_bet_bottom li') || el;
            } catch (_) {
                host = el;
            }
            if (!host || !domVisible(host))
                continue;
            if (seen.indexOf(host) >= 0)
                continue;
            var rect = host.getBoundingClientRect();
            if (rect.top < doc.defaultView.innerHeight * 0.70)
                continue;
            if (rect.width < 30 || rect.height < 20 || rect.width > 220 || rect.height > 100)
                continue;
            seen.push(host);
            rows.push({
                el: host,
                text: domTextOf(host),
                tail: domTailOf(host),
                x: Math.round(rect.left),
                y: Math.round(rect.top),
                w: Math.round(rect.width),
                h: Math.round(rect.height)
            });
        }
        return rows;
    }
    function domPickBestConfirm() {
        var contexts = domGetBetContexts();
        var best = null;
        for (var i = 0; i < contexts.length; i++) {
            var ctx = contexts[i];
            var candidates = domCollectConfirmCandidates(ctx.doc, ctx.source);
            for (var j = 0; j < candidates.length; j++) {
                var c = candidates[j];
                var score = 0;
                score += c.source === 'top/frame[1]' ? 300 : 0;
                score += c.y > ctx.win.innerHeight * 0.78 ? 220 : 0;
                score += Math.min(c.w * c.h, 40000) / 250;
                score -= Math.max(0, c.w - 140) * 2;
                score -= Math.max(0, c.h - 60) * 3;
                if (/zone_bet_bottom|betbox|confirm|btn/i.test(c.tail))
                    score += 180;
                if (domLooksLikeConfirmText(c.text))
                    score += 260;
                if (c.enabled)
                    score += 60;
                c._score = score;
                if (!best || score > best._score)
                    best = {
                        source: c.source,
                        href: ctx.href,
                        doc: ctx.doc,
                        el: c.el,
                        x: c.x,
                        y: c.y,
                        w: c.w,
                        h: c.h,
                        enabled: c.enabled,
                        text: c.text,
                        tail: c.tail,
                        _score: score
                    };
            }
        }
        return best;
    }
    function domShortOuterHtml(el) {
        try {
            return String((el && el.outerHTML) || '').replace(/\s+/g, ' ').slice(0, 220);
        } catch (_) {
            return '';
        }
    }
    function domEmitConfirmDiag(stage, confirm, extra) {
        try {
            extra = extra || {};
            var doc = confirm && confirm.doc ? confirm.doc : null;
            var px = confirm ? Math.round(confirm.x + confirm.w * 0.32) : 0;
            var py = confirm ? Math.round(confirm.y + confirm.h * 0.50) : 0;
            var hit = null;
            try {
                hit = (doc && doc.elementFromPoint) ? doc.elementFromPoint(px, py) : null;
            } catch (_) {
                hit = null;
            }
            var payload = {
                stage: stage || '',
                attempt: extra.attempt || 0,
                mode: extra.mode || '',
                shielded: extra.shielded || 0,
                settled: extra.settled === true ? 1 : (extra.settled === false ? 0 : null),
                text: confirm ? String(confirm.text || '') : '',
                tail: confirm ? String(confirm.tail || '') : '',
                source: confirm ? String(confirm.source || '') : '',
                x: confirm ? confirm.x : 0,
                y: confirm ? confirm.y : 0,
                w: confirm ? confirm.w : 0,
                h: confirm ? confirm.h : 0,
                px: px,
                py: py,
                expectedStake: extra.expectedStake || null,
                targetStake: extra.targetStake || null,
                expectedAfter: extra.expectedAfter || null,
                beforeStake: extra.beforeStake || null,
                afterStake: extra.afterStake || null,
                deltaStake: extra.deltaStake || null,
                roundKey: extra.roundKey ? String(extra.roundKey) : '',
                chipUnits: extra.chipUnits || null,
                side: extra.side ? String(extra.side) : '',
                hitText: hit ? String(domTextOf(hit) || '') : '',
                hitTail: hit ? String(domTailOf(hit) || '') : '',
                hitHtml: hit ? domShortOuterHtml(hit) : ''
            };
            try { cwBetDbg('[cwBet++] confirm diag', payload); } catch (_) {}
            try {
                if (window.__cw_diag_post)
                    window.__cw_diag_post(payload);
            } catch (_) {}
        } catch (_) {}
    }
    function domShieldRepeatButtons(doc) {
        var rows = domCollectRepeatCandidates(doc);
        var touched = [];
        for (var i = 0; i < rows.length; i++) {
            var host = rows[i].el;
            if (!host || !host.style)
                continue;
            touched.push({
                el: host,
                pointerEvents: host.style.pointerEvents,
                ariaDisabled: host.getAttribute('aria-disabled'),
                disabled: host.hasAttribute('disabled')
            });
            try { host.style.pointerEvents = 'none'; } catch (_) {}
            try { host.setAttribute('aria-disabled', 'true'); } catch (_) {}
            try {
                if (host.hasAttribute && !host.hasAttribute('disabled'))
                    host.setAttribute('data-cw-temp-disabled', '1');
            } catch (_) {}
        }
        return {
            count: touched.length,
            restore: function () {
                for (var j = 0; j < touched.length; j++) {
                    var it = touched[j];
                    var el = it.el;
                    if (!el || !el.style)
                        continue;
                    try { el.style.pointerEvents = it.pointerEvents || ''; } catch (_) {}
                    try {
                        if (it.ariaDisabled == null) el.removeAttribute('aria-disabled');
                        else el.setAttribute('aria-disabled', it.ariaDisabled);
                    } catch (_) {}
                }
            }
        };
    }
    async function domWaitConfirmReady(timeout) {
        timeout = timeout || 1200;
        var t0 = Date.now();
        while ((Date.now() - t0) < timeout) {
            var c = domPickBestConfirm();
            if (c && c.enabled)
                return c;
            await sleep(16);
        }
        return null;
    }
    async function domWaitConfirmSettled(timeout) {
        timeout = timeout || 1400;
        var t0 = Date.now();
        while ((Date.now() - t0) < timeout) {
            await sleep(20);
            var c = domPickBestConfirm();
            if (!c || !c.enabled)
                return true;
        }
        return false;
    }
    async function domClickConfirmAfterBet(tgt, expectedUnits, extraMeta) {
      var confirm = await domWaitConfirmReady(200);
        if (!confirm) {
            console.warn('[cwBet++] không thấy nút xác nhận');
            return false;
        }
        extraMeta = extraMeta || {};
        var side = extraMeta.side ? String(extraMeta.side) : '';
        var chipUnits = (extraMeta.chipUnits != null && isFinite(+extraMeta.chipUnits)) ? Math.floor(+extraMeta.chipUnits) : (expectedUnits != null ? Math.floor(+expectedUnits) : null);
        var roundKey = '';
        try {
            roundKey = (typeof getRoundIdSafe === 'function') ? String(getRoundIdSafe()) : '';
        } catch (_) {
            roundKey = '';
        }
        var beforeStakeHit = null;
        try {
            beforeStakeHit = domReadTargetStakeUnits(tgt, null);
        } catch (_) {
            beforeStakeHit = null;
        }
        var beforeStake = (beforeStakeHit && typeof beforeStakeHit.val === 'number') ? beforeStakeHit.val : null;
        var expectedAfter = null;
        if (expectedUnits != null) {
            var expectedNow = Math.floor(+expectedUnits);
            if (beforeStake != null && isFinite(+beforeStake))
                expectedAfter = Math.floor(+beforeStake) + expectedNow;
            else
                expectedAfter = expectedNow;
        }
        var shield = null;
        try { shield = domShieldRepeatButtons(confirm.doc); } catch (_) { shield = null; }
        try {
            var readyStake = domReadTargetStakeUnits(tgt, expectedUnits);
            domEmitConfirmDiag('ready', confirm, {
                shielded: shield ? shield.count : 0,
                expectedStake: expectedUnits || null,
                targetStake: readyStake ? readyStake.val : null,
                expectedAfter: expectedAfter,
                beforeStake: beforeStake,
                afterStake: beforeStake,
                deltaStake: 0,
                roundKey: roundKey,
                chipUnits: chipUnits,
                side: side
            });
            var mode = 'element';
            cwBetDbg('[cwBet++] confirm click', {
                attempt: 1,
                mode: mode,
                x: confirm.x,
                y: confirm.y,
                w: confirm.w,
                h: confirm.h,
                text: confirm.text,
                source: confirm.source
            });
            domEmitConfirmDiag('before_click', confirm, {
                attempt: 1,
                mode: mode,
                shielded: shield ? shield.count : 0,
                expectedStake: expectedUnits || null,
                targetStake: readyStake ? readyStake.val : null,
                expectedAfter: expectedAfter,
                beforeStake: beforeStake,
                afterStake: beforeStake,
                deltaStake: 0,
                roundKey: roundKey,
                chipUnits: chipUnits,
                side: side
            });
            domMinimalClick(confirm.el);
          await sleep(10);
          var settled = await domWaitConfirmSettled(200);
            var stakeHit = null;
            if (expectedAfter != null)
          stakeHit = await domWaitTargetStakeUnits(tgt, expectedAfter, 140);
            else if (expectedUnits != null)
          stakeHit = await domWaitTargetStakeUnits(tgt, expectedUnits, 140);
            if (!stakeHit) {
                try {
                    stakeHit = domReadTargetStakeUnits(tgt, null);
                } catch (_) {
                    stakeHit = null;
                }
            }
            var afterStake = (stakeHit && typeof stakeHit.val === 'number') ? stakeHit.val : null;
            var deltaStake = (beforeStake != null && afterStake != null) ? (afterStake - beforeStake) : null;
            domEmitConfirmDiag('after_click', confirm, {
                attempt: 1,
                mode: mode,
                shielded: shield ? shield.count : 0,
                settled: settled,
                expectedStake: expectedUnits || null,
                targetStake: stakeHit ? stakeHit.val : null,
                expectedAfter: expectedAfter,
                beforeStake: beforeStake,
                afterStake: afterStake,
                deltaStake: deltaStake,
                roundKey: roundKey,
                chipUnits: chipUnits,
                side: side
            });
            var stakeOk = (expectedUnits == null) ||
                (afterStake != null && ((expectedAfter != null && afterStake === expectedAfter) || (deltaStake != null && expectedUnits != null && deltaStake === expectedUnits)));
            if (settled && stakeOk)
                return true;
        } finally {
            try { if (shield && shield.restore) shield.restore(); } catch (_) {}
        }
        console.warn('[cwBet++] xác nhận không hoàn tất');
        return false;
    }
    window.__cw_diag_confirm_once = async function () {
        return await domClickConfirmAfterBet();
    };
    async function domWaitPendingConfirmEnabled(beforeEnabled, timeout) {
        timeout = timeout || 420;
        if (beforeEnabled)
            return false;
        var confirm = await domWaitConfirmReady(timeout);
        return !!(confirm && confirm.enabled);
    }

    async function tryOpenChipPanel() {
        if (!__cw_hasCocos())
            return false;
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
            await sleep(180);
        }
        return !!cand;
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
            var chip = findChipNodeFromLabel(labelNode);
            var target = chip || hit || labelNode;
            out[val] = {
                entry: target,
                node: target,
                rect: rectFromNodeScreen(labelNode)
            };
        }
        return out;
    }

    var prevScan = window.cwScanChips;
    window.cwScanChips = function () {
        if (!__cw_hasCocos()) {
            var dm = domScanChipMap();
            if (!Object.keys(dm).length)
                console.warn('[cwScanChips++] chưa thấy chip DOM.');
            return dm;
        }
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
        if (!__cw_hasCocos()) {
            if (!DOM_ALLOWED_SET[String(val)] && !ALLOWED_SET[String(val)])
                throw new Error('M?nh gi  kh?ng h?p l?: ' + amount);
            var okDom = await domFocusChip(val).catch(function () { return false; });
            if (okDom)
                return true;
            await tryOpenChipPanel();
            await sleep(180);
            return !!(await domFocusChip(val).catch(function () { return false; }));
        }
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
            await sleep(80);
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
        var denoms = Object.keys(availableSet || {}).map(function (x) { return +x; }).filter(function (x) { return x > 0; });
        if (!denoms.length)
            denoms = DENOMS.slice();
        denoms.sort(function (a, b) { return b - a; });
        for (var i = 0; i < denoms.length; i++) {
            var d = denoms[i];
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
        function failBet(reason, detail) {
            var message = String(reason || 'cwBet failed');
            window.__cw_lastBetError = message;
            return {
                ok: false,
                error: message,
                detail: detail || null
            };
        }
        function clearBetError() {
            window.__cw_lastBetError = '';
        }
        clearBetError();
        side = normalizeSide(side);
        if (amount == null || isNaN(amount)) {
            if (old_cwBet)
                return await old_cwBet(side);
            var tgt0 = findBetTarget(side);
            if (!tgt0 || !tgt0.node) {
                console.warn('[cwBet++] không thấy nút cửa:', side);
                return failBet('bet target not found', { side: side });
            }
            clickBetTarget(tgt0);
            await sleep(50);
            clearBetError();
            return true;
        }

        var raw = Math.max(0, Math.floor(+amount || 0));
        if (!raw) {
            console.warn('[cwBet++] amount=0');
            return failBet('amount=0', { side: side, amount: raw });
        }

        return withLock(async function () {
            clearBetError();
            var tgt = findBetTarget(side);
            if (!tgt || !tgt.node) {
                console.warn('[cwBet++] không thấy nút cửa:', side);
                return failBet('bet target not found', { side: side });
            }
            var isDomMode = !__cw_hasCocos();
            // Contract mới: amount input là đơn vị phỉnh.
            // DOM dùng trực tiếp theo mệnh giá phỉnh; non-DOM (Cocos) quy đổi về tiền thật x1000.
            var X = isDomMode ? raw : (raw * 1000);
            if (isDomMode && X <= 0) {
                console.warn('[cwBet++] mệnh giá chip DOM không hợp lệ', { amount: raw });
                return failBet('invalid dom chip amount', { side: side, amount: raw, chipUnits: X });
            }

            var map = window.cwScanChips() || {};
            if (!Object.keys(map).length) {
                await tryOpenChipPanel();
                await sleep(120);
                map = isDomMode ? (window.cwScanChips() || {}) : wideScan();
            }
            var availSet = {};
            var ks = Object.keys(map);
            for (var i = 0; i < ks.length; i++)
                availSet[ks[i]] = 1;
            if (!Object.keys(availSet).length) {
                console.warn('[cwBet++] không thấy chip nào');
                return failBet('no chips visible', { side: side, amount: raw });
            }

            if (availSet[String(X)]) {
                var focusOne = false;
                if (isDomMode) {
                    focusOne = await domFocusChipInfo(map[String(X)], X).catch(function () {
                        return false;
                    });
                    if (!focusOne) {
                        focusOne = await window.cwFocusChip(X).catch(function () {
                            return false;
                        });
                    }
                } else {
                    focusOne = await window.cwFocusChip(X).catch(function () {
                        return false;
                    });
                }
                if (!focusOne) {
                    console.warn('[cwBet++] không focus được chip exact-hit', X);
                    return failBet('focus exact chip failed', { side: side, amount: raw, chipUnits: X });
                }
                var confirmBeforeEnabled = false;
                if (isDomMode) {
                    try {
                        var confirmBefore = domPickBestConfirm();
                        confirmBeforeEnabled = !!(confirmBefore && confirmBefore.enabled);
                    } catch (_) {}
                }
                var before0 = sampleTotalsNow();
                var targetClickedOne = clickBetTarget(tgt);
                var appliedOne = await waitForTotalsChange(before0, side, 150).catch(function () {
                    return false;
                });
                if (!appliedOne && isDomMode) {
        appliedOne = await domWaitPendingConfirmEnabled(confirmBeforeEnabled, 140).catch(function () {
                        return false;
                    });
                    if (!appliedOne) {
        var stakeHitOne = await domWaitTargetStakeUnits(tgt, X, 140).catch(function () {
                            return null;
                        });
                        appliedOne = !!(stakeHitOne && stakeHitOne.val === X);
                    }
                }
                if (!appliedOne && !isDomMode) {
                    console.warn('[cwBet++] click cửa không ghi nhận tiền exact-hit', {
                        side: side,
                        amount: X
                    });
                    return failBet('bet click not reflected for exact chip', { side: side, amount: raw, chipUnits: X });
                }
                if (isDomMode) {
                    var confirmOne = await domClickConfirmAfterBet(tgt, X, { side: side, chipUnits: X });
                    if (!confirmOne) {
                        if (!appliedOne) {
                            console.warn('[cwBet++] click cửa không ghi nhận tiền exact-hit', {
                                side: side,
                                amount: X,
                                targetClicked: !!targetClickedOne
                            });
                            return failBet('bet click not reflected for exact chip', { side: side, amount: raw, chipUnits: X, targetClicked: !!targetClickedOne });
                        }
                        console.warn('[cwBet++] confirm failed', {
                            side: side,
                            amount: X
                        });
                        return failBet('confirm failed', { side: side, amount: raw, chipUnits: X });
                    }
                }
                await sleep(15);
                clearBetError();
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
                return failBet('cannot split amount by visible chips', { side: side, amount: raw, chipUnits: X, have: haveKeys });
            }
            var planStr = [];
            for (var p = 0; p < plan.length; p++) {
                planStr.push(plan[p].count + '×' + plan[p].val.toLocaleString());
            }
            cwBetDbg('[cwBet++] plan:', planStr.join(' + '), { amount: raw, chipUnits: X, dom: isDomMode });

            for (var s = 0; s < plan.length; s++) {
                var step = plan[s];
                var ok = false;
                if (isDomMode) {
                    ok = await domFocusChipInfo(map[String(step.val)], step.val).catch(function () {
                        return false;
                    });
                    if (!ok) {
                        ok = await window.cwFocusChip(step.val).catch(function () {
                            return false;
                        });
                    }
                } else {
                    ok = await window.cwFocusChip(step.val).catch(function () {
                        return false;
                    });
                }
                if (!ok) {
                    console.warn('[cwBet++] không focus được chip', step.val);
                    return failBet('focus chip failed', { side: side, amount: raw, chipUnits: step.val });
                }
                for (var i2 = 0; i2 < step.count; i2++) {
                    var beforeStep = sampleTotalsNow();
                    var targetClickedStep = clickBetTarget(tgt);
                    if (!targetClickedStep)
                        console.warn('[cwBet++] click cửa thất bại', {
                            side: side,
                            denom: step.val,
                            turn: i2 + 1
                        });
                    var appliedStep = await waitForTotalsChange(beforeStep, side, 100).catch(function () {
                        return false;
                    });
                    if (!appliedStep) {
                        if (!isDomMode) {
                            console.warn('[cwBet++] click cửa không ghi nhận tiền', {
                                side: side,
                                denom: step.val,
                                turn: i2 + 1
                            });
                            return failBet('bet click not reflected', { side: side, amount: raw, chipUnits: step.val, turn: i2 + 1 });
                        }
                    }
                    await sleep(15);
                }
            }
            if (isDomMode) {
                var confirmOk = await domClickConfirmAfterBet(tgt, X, { side: side, chipUnits: X });
                if (!confirmOk) {
                    console.warn('[cwBet++] confirm failed', {
                        side: side,
                        amount: X
                    });
                    return failBet('confirm failed', { side: side, amount: raw, chipUnits: X });
                }
            }
            cwBetDbg('[cwBet++] DONE ►', {
                side: side,
                amount: X
            });
            clearBetError();
            return true;
        });
    };

    cwBetDbg('[READY] CW merged (compat + TextMap + Scan200Text + TK sequence + Totals by (x,tail) + standardized exports).');

    /* ---------------- tick & controls ---------------- */
    function domCleanStatusText(txt) {
        try {
            txt = domCollapse(txt || '');
            if (!txt)
                return '';
            var norm = domNorm(txt);
            if (/^(loading|loading\.\.\.|\{0\}s)$/i.test(txt))
                return '';
            if (/dang ket noi/.test(norm) && /\{0\}s/.test(txt))
                return '';
            return txt;
        } catch (_) {
            return '';
        }
    }
    var CW_STATUS_AUTHORITY_TAILS = [
        'body/div#themeZone.game.scenes_default/div.game_main/div.main_center/div#processBar.info_status/p#processStatus',
        'body/div#themeZone.game.baccarat_normal/div.game_main/div.main_center/div#processBar.info_status/p#processStatus'
    ];
    var CW_STATUS_AUTHORITY_TAIL = CW_STATUS_AUTHORITY_TAILS[0];
    function brNormalizeStatusTail(tail) {
        try {
            return String(tail || '')
                .replace(/^html\//i, '')
                .replace(/\s+/g, '')
                .toLowerCase();
        } catch (_) {
            return '';
        }
    }
    function brIsAuthorityStatusTail(tail) {
        var clean = brNormalizeStatusTail(tail);
        for (var i = 0; i < CW_STATUS_AUTHORITY_TAILS.length; i++) {
            if (clean === brNormalizeStatusTail(CW_STATUS_AUTHORITY_TAILS[i]))
                return true;
        }
        return false;
    }
    function brStatusAuthorityTailText() {
        try {
            return CW_STATUS_AUTHORITY_TAILS.join(' || ');
        } catch (_) {
            return CW_STATUS_AUTHORITY_TAIL;
        }
    }
    function brSetStatusDiag(source, tail, text) {
        try { window.__cw_status_source = String(source || ''); } catch (_) {}
        try { window.__cw_status_tail = String(tail || ''); } catch (_) {}
        try { window.__cw_status_text = String(text || ''); } catch (_) {}
    }
    function domPickStatusFromSelector(selectors, preferredTailPart) {
        try {
            var contexts = [];
            domWalkContexts(window, 'top', 0, 0, contexts, []);
            var best = null;
            var candidates = [];
            for (var i = 0; i < contexts.length; i++) {
                var ctx = contexts[i];
                var doc = ctx && ctx.doc ? ctx.doc : null;
                if (!doc)
                    continue;
                for (var j = 0; j < selectors.length; j++) {
                    var list = [];
                    try {
                        list = doc.querySelectorAll(selectors[j]);
                    } catch (_) {
                        list = [];
                    }
                    for (var k = 0; k < list.length; k++) {
                        var el = list[k];
                        if (!el || !domVisible(el))
                            continue;
                        var txt = domCleanStatusText(el.innerText || el.textContent || '');
                        if (!txt)
                            continue;
                        var tail = fullPath(el, 80) || domTailOfEl(el) || '';
                        var score = 0;
                        if (preferredTailPart && String(tail || '').toLowerCase().indexOf(String(preferredTailPart).toLowerCase()) !== -1)
                            score += 1000;
                        if (ctx.source === 'top/frame[1]')
                            score += 50;
                        if (ctx.source === 'top/frame[0]')
                            score += 30;
                        score += Math.max(0, 200 - Math.round(el.getBoundingClientRect().top || 0));
                        if (!best || score > best.score) {
                            best = {
                                text: txt,
                                tail: tail,
                                source: ctx.source || 'top',
                                score: score
                            };
                        }
                    }
                }
            }
            return best ? best.text : '';
        } catch (_) {
            return '';
        }
    }
    function domReadProcessStatus() {
        try {
            var contexts = [];
            domWalkContexts(window, 'top', 0, 0, contexts, []);
            var best = null;
            var candidates = [];
            for (var i = 0; i < contexts.length; i++) {
                var ctx = contexts[i];
                var doc = ctx && ctx.doc ? ctx.doc : null;
                if (!doc)
                    continue;
                var list = [];
                try {
                    list = doc.querySelectorAll('#themeZone.game .game_main .main_center #processBar.info_status p#processStatus, #themeZone .game_main .main_center #processBar.info_status p#processStatus, #processBar.info_status p#processStatus');
                } catch (_) {
                    list = [];
                }
                for (var k = 0; k < list.length; k++) {
                    var el = list[k];
                    if (!el)
                        continue;
                    var tail = fullPath(el, 80) || domTailOfEl(el) || '';
                    var visible = domVisible(el);
                    var txt = domCleanStatusText(el.innerText || el.textContent || '');
                    if (candidates.length < 8) {
                        candidates.push({
                            source: ctx.source || 'top',
                            visible: visible ? 1 : 0,
                            text: txt,
                            tail: tail,
                            authority: brIsAuthorityStatusTail(tail) ? 1 : 0
                        });
                    }
                    if (!visible)
                        continue;
                    if (!brIsAuthorityStatusTail(tail))
                        continue;
                    if (!txt)
                        continue;
                    var rect = null;
                    try { rect = el.getBoundingClientRect(); } catch (_) { rect = null; }
                    var score = 0;
                    if (ctx.source === 'top/frame[1]')
                        score += 50;
                    if (ctx.source === 'top/frame[0]')
                        score += 30;
                    score += Math.max(0, 200 - Math.round((rect && rect.top) || 0));
                    if (!best || score > best.score) {
                        best = {
                            text: txt,
                            tail: tail,
                            source: ctx.source || 'top',
                            score: score
                        };
                    }
                }
            }
            if (best) {
                brSetStatusDiag('authority-processStatus|' + String(best.source || 'top'), best.tail, best.text);
                cwDbg('STATUS', 'authority-processStatus', {
                    status: best.text,
                    source: best.source || 'top',
                    tail: best.tail
                }, 1500, 'status-authority|' + best.text + '|' + best.tail);
                return best.text;
            }
            try {
                var texts = (typeof buildTextRects === 'function') ? buildTextRects() : [];
                var textBest = null;
                var textBestArea = -1;
                for (var ti = 0; ti < texts.length; ti++) {
                    var item = texts[ti];
                    if (!item)
                        continue;
                    var itemTail = String(item.tail || '');
                    if (!brIsAuthorityStatusTail(itemTail))
                        continue;
                    var itemText = domCleanStatusText(item.text || '');
                    if (!itemText)
                        continue;
                    var itemArea = Math.max(0, Number(item.w || 0)) * Math.max(0, Number(item.h || 0));
                    if (!textBest || itemArea > textBestArea) {
                        textBest = {
                            text: itemText,
                            tail: itemTail,
                            area: itemArea
                        };
                        textBestArea = itemArea;
                    }
                }
                if (textBest) {
                    brSetStatusDiag('authority-processStatus|textmap', textBest.tail, textBest.text);
                    cwDbg('STATUS', 'authority-processStatus-textmap', {
                        status: textBest.text,
                        tail: textBest.tail
                    }, 1500, 'status-authority-textmap|' + textBest.text + '|' + textBest.tail);
                    return textBest.text;
                }
            } catch (_) {}
            brSetStatusDiag('authority-processStatus-missing', CW_STATUS_AUTHORITY_TAIL, '');
            cwDbg('STATUS', 'authority-processStatus-missing', {
                expectedTail: brStatusAuthorityTailText(),
                candidates: candidates
            }, 2500, 'status-authority-missing|' + String((location && location.href) || ''));
            return '';
        } catch (_) {
            brSetStatusDiag('authority-processStatus-error', CW_STATUS_AUTHORITY_TAIL, '');
            return '';
        }
    }
    function foldStatusText(s) {
        try {
            return String(s || '')
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/\s+/g, ' ')
                .trim();
        } catch (_) {
            return String(s || '').toLowerCase().trim();
        }
    }
    function domStatusImpliesClosed(statusText) {
        var s = foldStatusText(statusText);
        if (!s)
            return false;
        if (s.indexOf('mo bai') !== -1)
            return true;
        if (s.indexOf('ket qua') !== -1)
            return true;
        if (s.indexOf('cho van sau') !== -1)
            return true;
        if (s.indexOf('tam dung nhan cuoc') !== -1)
            return true;
        if (s.indexOf('da dong cua dat cuoc') !== -1)
            return true;
        return false;
    }
    function readStatusTextByTail() {
        try {
            return domReadProcessStatus() || "";
        } catch (_) {
            brSetStatusDiag('authority-processStatus-error', CW_STATUS_AUTHORITY_TAIL, '');
            return "";
        }
    }
    try { window.readStatusTextByTail = readStatusTextByTail; } catch (_) {}
    function statusByProg(p) {
        return readStatusTextByTail();
    }

    function tick() {
        var p = collectProgress();
        var st = readStatusTextByTail();
        if (!__cw_hasCocos() && domStatusImpliesClosed(st))
            p = 0;
        if (p != null)
            S.prog = p;
        S.status = st;
        var T = totals(S);
        S._lastTotals = T;

        // TK sequence
        var tk = readTKSeq();
        S.seq = tk.seq || '';
        S.seqVersion = Number(tk && tk.seqVersion != null ? tk.seqVersion : (window.__cw_seq_version || 0)) || 0;
        S.seqEvent = String(tk && tk.seqEvent ? tk.seqEvent : (window.__cw_seq_event || ''));

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
            S.text = buildTextRects();
            renderText();
        }
        updatePanel();
    }
    var _seqDomObserver = null;
    var _seqDomObserverTimer = null;
    var _seqDomObserverLastAt = 0;
    function brNodeInsideCwRoot(node) {
        try {
            var cur = node;
            var depth = 0;
            while (cur && depth < 10) {
                if ((cur.id && String(cur.id) === CW_ROOT_ID) || (cur.id && String(cur.id) === CW_FALLBACK_PANEL_ID))
                    return true;
                cur = cur.parentNode;
                depth++;
            }
        } catch (_) {}
        return false;
    }
    function brIsLikelySeqMutationNode(node) {
        try {
            if (!node || brNodeInsideCwRoot(node))
                return false;
            var cur = node;
            var depth = 0;
            while (cur && depth < 7) {
                if (brNodeInsideCwRoot(cur))
                    return false;
                var id = '';
                var cls = '';
                var nm = '';
                try { id = String(cur.id || ''); } catch (_) {}
                try { cls = String(cur.className || ''); } catch (_) {}
                try { nm = String(cur.nodeName || ''); } catch (_) {}
                var hint = (id + ' ' + cls + ' ' + nm).toLowerCase();
                if (/(road|bead|result|history|soicau|baccarat|popupmessage|showketqua|game_main|themezone|footer|listlabel)/.test(hint))
                    return true;
                cur = cur.parentNode;
                depth++;
            }
        } catch (_) {}
        return false;
    }
    function brInstallSeqMutationObserver() {
        try {
            if (__cw_hasCocos())
                return false;
            if (_seqDomObserver || typeof MutationObserver === 'undefined')
                return false;
            if (typeof window.__cw_seq_dom_observer_enabled === 'undefined')
                window.__cw_seq_dom_observer_enabled = 1;
            if (Number(window.__cw_seq_dom_observer_enabled || 0) !== 1)
                return false;
            var target = document.body || document.documentElement;
            if (!target)
                return false;
            _seqDomObserver = new MutationObserver(function (mutations) {
                try {
                    if (!S.running)
                        return;
                    var hasLikely = false;
                    var maxScan = Math.min((mutations && mutations.length) ? mutations.length : 0, 24);
                    for (var mi = 0; mi < maxScan && !hasLikely; mi++) {
                        var m = mutations[mi];
                        if (!m)
                            continue;
                        if (brIsLikelySeqMutationNode(m.target))
                            hasLikely = true;
                        var adds = m.addedNodes || [];
                        for (var ai = 0; ai < adds.length && !hasLikely; ai++) {
                            if (brIsLikelySeqMutationNode(adds[ai]))
                                hasLikely = true;
                        }
                    }
                    if (!hasLikely)
                        return;
                    _seqDomObserverLastAt = Date.now();
                    if (_seqDomObserverTimer)
                        return;
                    _seqDomObserverTimer = setTimeout(function () {
                        _seqDomObserverTimer = null;
                        try {
                            if (!S.running)
                                return;
                            var beforeLen = String(_domBeadSeqManaged || '').length;
                            var beforeVer = Number(_domSeqVersion || 0) || 0;
                            var beforeEvt = String(_domSeqEvent || '');
                            tick();
                            var afterLen = String(_domBeadSeqManaged || '').length;
                            var afterVer = Number(_domSeqVersion || 0) || 0;
                            var afterEvt = String(_domSeqEvent || '');
                            if (afterVer > beforeVer || afterLen > beforeLen) {
                                try {
                                    if (window.__cw_pushPanelSnapshot)
                                        window.__cw_pushPanelSnapshot();
                                } catch (_) {}
                                cwDbg('SEQFLOW', 'observer-seq-advance', {
                                    beforeLen: beforeLen,
                                    beforeVer: beforeVer,
                                    beforeEvt: beforeEvt,
                                    afterLen: afterLen,
                                    afterVer: afterVer,
                                    afterEvt: afterEvt,
                                    ageMs: Date.now() - Number(_seqDomObserverLastAt || 0)
                                }, 0, 'observer-seq-advance|' + beforeVer + '|' + afterVer + '|' + afterLen);
                            } else if (afterEvt === 'board-jump-hold') {
                                cwDbg('SEQFLOW', 'observer-seq-hold', {
                                    seqLen: afterLen,
                                    seqVersion: afterVer,
                                    seqEvent: afterEvt,
                                    ageMs: Date.now() - Number(_seqDomObserverLastAt || 0)
                                }, 1200, 'observer-seq-hold|' + afterVer + '|' + afterLen);
                            }
                        } catch (_) {}
                    }, 120);
                } catch (_) {}
            });
            _seqDomObserver.observe(target, {
                subtree: true,
                childList: true,
                characterData: true
            });
            cwDbg('SEQFLOW', 'observer-install', {
                target: String(target && target.nodeName || ''),
                enabled: Number(window.__cw_seq_dom_observer_enabled || 0)
            }, 0, 'observer-install|' + String(target && target.nodeName || ''));
            return true;
        } catch (_) {
            return false;
        }
    }
    function brRemoveSeqMutationObserver(reasonTag) {
        try {
            if (_seqDomObserver) {
                try { _seqDomObserver.disconnect(); } catch (_) {}
                _seqDomObserver = null;
            }
            if (_seqDomObserverTimer) {
                try { clearTimeout(_seqDomObserverTimer); } catch (_) {}
                _seqDomObserverTimer = null;
            }
            cwDbg('SEQFLOW', 'observer-remove', {
                reason: String(reasonTag || '')
            }, 0, 'observer-remove|' + String(reasonTag || ''));
        } catch (_) {}
    }
    function start() {
        if (S.running)
            return;
        S.running = true;
        S.timer = setInterval(tick, S.tickMs);
        tick();
        brInstallSeqMutationObserver();
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
        brRemoveSeqMutationObserver('stop');
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
        var amount = Math.max(0, Math.floor((isFinite(n) ? n : 1)));
        try {
            window.chrome && window.chrome.webview && window.chrome.webview.postMessage && window.chrome.webview.postMessage(JSON.stringify({
                    abx: 'cwBet',
                    side: 'BANKER',
                    amount: amount,
                    ts: Date.now()
                }));
        } catch (e) {}
        try {
            await cwBet('BANKER', amount);
        } catch (e) {}
    }, true);
    panel.querySelector('#bBetL').addEventListener('click', async function () {
        var n = parseFloat(document.getElementById('iStake').value || '1');
        var amount = Math.max(0, Math.floor((isFinite(n) ? n : 1)));
        try {
            window.chrome && window.chrome.webview && window.chrome.webview.postMessage && window.chrome.webview.postMessage(JSON.stringify({
                    abx: 'cwBet',
                    side: 'PLAYER',
                    amount: amount,
                    ts: Date.now()
                }));
        } catch (e) {}
        try {
            await cwBet('PLAYER', amount);
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
    // Panel/overlay mặc định ẩn trong app -> không tự start loop render nặng.
    try {
        tick();
        setStateUI();
    } catch (_) {
        try {
            updatePanel();
            setStateUI();
        } catch (_) {}
    }
    if (window.__cw_panel_autostart === 1 || window.__cw_panel_autostart === true)
        start();

    function teardown() {
        try {
            if (window.__cw_stopPush)
                window.__cw_stopPush();
        } catch (e) {}
        try {
            brRemoveSeqMutationObserver('teardown');
        } catch (e) {}
        try {
            stop();
        } catch (e) {}
        try {
            document.removeEventListener('keydown', onKey);
        } catch (e) {}
        try {
            window.__cw_last_panel_snapshot = null;
        } catch (e) {}
        try {
            if (_panelOwnerTimer)
                clearInterval(_panelOwnerTimer);
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
                try {
                    cwDbg('POST', 'safePost outgoing', {
                        abx: obj && obj.abx,
                        seqLen: obj && obj.seq ? String(obj.seq || '').length : 0,
                        seqVersion: obj && obj.seqVersion != null ? obj.seqVersion : null,
                        seqEvent: obj && obj.seqEvent ? obj.seqEvent : '',
                        status: obj && obj.status ? obj.status : ''
                    }, 2000, 'post|' + (obj && obj.abx ? obj.abx : '') + '|' + (obj && obj.seqVersion != null ? obj.seqVersion : '') + '|' + (obj && obj.seqEvent ? obj.seqEvent : ''));
                } catch (_) {}
                if (window.chrome && chrome.webview && typeof chrome.webview.postMessage === 'function') {
                    chrome.webview.postMessage(JSON.stringify(obj));
                } else {
                    // Fallback: gửi lên TOP bằng DOM message, TOP_FORWARD sẽ relay về C#
                    parent.postMessage(obj, '*');
                }
            } catch (e) {
                try {
                    cwDbg('POST', 'safePost failed, fallback parent.postMessage', {
                        error: String(e && e.message ? e.message : e),
                        abx: obj && obj.abx ? obj.abx : ''
                    }, 0, 'post-fail|' + (obj && obj.abx ? obj.abx : ''));
                } catch (_) {}
                try {
                    parent.postMessage(obj, '*');
                } catch (_) {}
            }
        }
        window.__cw_diag_post = function (obj) {
            try {
                var payload = {};
                var src = obj || {};
                for (var k in src) payload[k] = src[k];
                payload.abx = 'confirm_diag';
                payload.ts = Date.now();
                safePost(payload);
            } catch (_) {}
        };

        window.__cw_pushPanelSnapshot = function () {
            try {
                var cached = window.__cw_last_panel_snapshot;
                if (!cached)
                    return 'no-panel-snapshot';
                var rawSeq = String(cached.rawSeq || cached.seq || '');
                var seqContract = brBuildSeqSnapshotContract(String(cached.seqEvent || ''));
                var statusNow = '';
                try {
                    statusNow = (typeof readStatusTextByTail === 'function') ? String(readStatusTextByTail() || '') : '';
                } catch (_) {
                    statusNow = '';
                }
                var ctx = {};
                var sig = {};
                try { ctx = __abxBuildContext(); } catch (_) { ctx = {}; }
                try { sig = __abxGetGameSignals(); } catch (_) { sig = {}; }
                var snap = {
                    abx: 'tick',
                    prog: cached.prog,
                    totals: cached.totals || null,
                    seq: String(cached.seq || ''),
                    rawSeq: rawSeq,
                    seqVersion: Number(cached.seqVersion || 0),
                    seqEvent: String(cached.seqEvent || ''),
                    seqMode: String(cached.seqMode || seqContract.mode || ''),
                    seqAppend: String(cached.seqAppend || seqContract.append || ''),
                    username: (cached && cached.totals && cached.totals.N != null) ? String(cached.totals.N || '') : '',
                    status: statusNow,
                    statusSource: String(window.__cw_status_source || ''),
                    statusTail: String(window.__cw_status_tail || ''),
                    contextId: String(ctx.contextId || ''),
                    framePath: String(ctx.framePath || ''),
                    href: String(ctx.href || ''),
                    topHref: String(ctx.topHref || ''),
                    isTop: ctx.isTop ? 1 : 0,
                    authorityToken: String(window.__abx_authority_token || ''),
                    contextScore: Number(sig.score || 0) || 0,
                    contextConfidence: String(sig.confidence || ''),
                    signals: String(sig.signals || ''),
                    ts: Date.now(),
                    origin: 'canvas-panel'
                };
                var s = '';
                try { s = JSON.stringify(snap); } catch (_) {}
                if (!s)
                    return 'empty';
                if (window.__cw_last_panel_sent_json === s)
                    return 'same';
                window.__cw_last_panel_sent_json = s;
                safePost(snap);
                return 'sent';
            } catch (_) {
                return 'fail';
            }
        };

        var _pushTimer = null;
        var _lastJson = '';
        var _lastStableJson = '';
        var _forcePushOnce = false;
        var _lastPullSeqVersion = 0;
        var _lastPushSeqVersion = 0;
        var _abxSnapCache = {
            prog: null,
            progAt: 0,
            totals: null,
            totalsAt: 0,
            seqState: null,
            seqAt: 0
        };

        function readCfgNumber(key, fallback) {
            function num(v) {
                var n = Number(v);
                return isFinite(n) ? n : null;
            }
            try {
                var n0 = num(window[key]);
                if (n0 != null)
                    return n0;
            } catch (_) {}
            try {
                if (window.parent && window.parent !== window) {
                    var n1 = num(window.parent[key]);
                    if (n1 != null)
                        return n1;
                }
            } catch (_) {}
            try {
                if (window.top && window.top !== window) {
                    var n2 = num(window.top[key]);
                    if (n2 != null)
                        return n2;
                }
            } catch (_) {}
            return Number(fallback || 0);
        }

        function readCfgBool(key, fallback) {
            try {
                return readCfgNumber(key, fallback ? 1 : 0) === 1;
            } catch (_) {
                return !!fallback;
            }
        }

        function isPerfMode() {
            try {
                var mode = readCfgNumber('__abx_perf_mode', 1); // mặc định Performance
                try {
                    if (window.__abx_perf_mode == null)
                        window.__abx_perf_mode = mode;
                } catch (_) {}
                return mode === 1;
            } catch (_) {
                return true;
            }
        }

        function isLikelyGameContext() {
            try {
                if (readCfgBool('__abx_force_push_start', false))
                    return true;
            } catch (_) {}
            try {
                if (typeof __cw_isGamePopupPage === 'function' && __cw_isGamePopupPage())
                    return true;
            } catch (_) {}
            try {
                var href = String((location && location.href) || '');
                if (/singleBacTable\.jsp/i.test(href))
                    return true;
                if (/\/player\/webMain\.jsp/i.test(href))
                    return true;
                if (/\/player\/gamehall\.jsp/i.test(href))
                    return true;
                if (/\/player\/login\/apiLogin/i.test(href) && !__cw_isTopDocument())
                    return true;
                if (/xoc[\-_]?dia/i.test(href))
                    return true;
            } catch (_) {}
            try {
                var href2 = String((location && location.href) || '');
                // Chỉ fallback theo Cocos cho trang player để tránh khởi động nhầm ở frame phụ.
                if (/\/player\//i.test(href2) && typeof __cw_hasCocos === 'function' && __cw_hasCocos())
                    return true;
            } catch (_) {}
            return false;
        }

        function stableSnapshotForCompare(obj) {
            if (!obj || typeof obj !== 'object')
                return obj;
            var t = obj.totals || null;
            var stableTotals = null;
            if (t && typeof t === 'object') {
                stableTotals = {
                    B: t.B,
                    P: t.P,
                    T: t.T,
                    C: t.C,
                    L: t.L,
                    A: t.A,
                    N: t.N,
                    TB: t.TB,
                    TA: t.TA
                };
            }
            return {
                abx: obj.abx,
                prog: obj.prog,
                status: obj.status,
                seq: obj.seq,
                seqVersion: obj.seqVersion,
                seqEvent: obj.seqEvent,
                username: obj.username,
                totals: stableTotals
            };
        }

        function shallowChanged(obj) {
            var s = '';
            try {
                s = JSON.stringify(obj);
            } catch (_) {}
            if (s)
                _lastJson = s;
            var stable = '';
            try {
                stable = JSON.stringify(stableSnapshotForCompare(obj));
            } catch (_) {}
            if (stable && stable !== _lastStableJson) {
                _lastStableJson = stable;
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

        function readTotalsSafe(preferLite) {
            try {
                if (preferLite && typeof sampleTotalsLiteNow === 'function')
                    return sampleTotalsLiteNow();
                return (typeof sampleTotalsNow === 'function') ? sampleTotalsNow() : null;
            } catch (_) {
                return null;
            }
        }

        function readSeqStateSafe() {
            try {
                if (typeof readTKSeq === 'function') {
                    var r = readTKSeq();
                    try {
                        var seqNow = (r && r.seq) ? String(r.seq || '') : '';
                        var rawNow = (r && r.rawSeq) ? String(r.rawSeq || '') : '';
                        if (seqNow && !rawNow) {
                            cwDbg('SEQFLOW', 'readSeqStateSafe-seq-without-raw', {
                                href: String(location.href || ''),
                                path: String(location.pathname || ''),
                                seqLen: seqNow.length,
                                seqTail: seqNow ? seqNow.slice(-1) : '',
                                seqVersion: Number(r && r.seqVersion != null ? r.seqVersion : (window.__cw_seq_version || 0)) || 0,
                                seqEvent: String(r && r.seqEvent ? r.seqEvent : (window.__cw_seq_event || '')),
                                seqMode: String(r && r.seqMode ? r.seqMode : ''),
                                seqAppend: String(r && r.seqAppend ? r.seqAppend : ''),
                                beadRawLen: String(window.__cw_bead_raw_seq || '').length,
                                managedLen: String(window.__cw_seq || '').length
                            }, 700, 'readSeqStateSafe-seq-without-raw|' + seqNow.length + '|' + Number(r && r.seqVersion != null ? r.seqVersion : (window.__cw_seq_version || 0)));
                        }
                    } catch (_) {}
                    return {
                        seq: (r && r.seq) ? String(r.seq || '') : '',
                        rawSeq: (r && r.rawSeq) ? String(r.rawSeq || '') : '',
                        seqVersion: Number(r && r.seqVersion != null ? r.seqVersion : (window.__cw_seq_version || 0)) || 0,
                        seqEvent: String(r && r.seqEvent ? r.seqEvent : (window.__cw_seq_event || '')),
                        seqMode: String(r && r.seqMode ? r.seqMode : ''),
                        seqAppend: String(r && r.seqAppend ? r.seqAppend : '')
                    };
                }
            } catch (_) {}
            return {
                seq: '',
                rawSeq: '',
                seqVersion: Number(window.__cw_seq_version || 0) || 0,
                seqEvent: String(window.__cw_seq_event || ''),
                seqMode: '',
                seqAppend: ''
            };
        }

        function readSeqSafe() {
            var r = readSeqStateSafe();
            return r && r.seq ? r.seq : '';
        }

        function normalizeTotalsSnapshot(src) {
            try {
                if (!src)
                    return null;
                return {
                    B: (src.B != null ? Number(src.B) : (src.C != null ? Number(src.C) : null)),
                    P: (src.P != null ? Number(src.P) : (src.L != null ? Number(src.L) : null)),
                    T: (src.T != null ? Number(src.T) : null),
                    A: (src.A != null ? Number(src.A) : null),
                    N: (src.N != null ? String(src.N) : null),
                    C: (src.C != null ? Number(src.C) : (src.B != null ? Number(src.B) : null)),
                    L: (src.L != null ? Number(src.L) : (src.P != null ? Number(src.P) : null)),
                    rawA: (src.rawA != null ? src.rawA : null),
                    rawN: (src.rawN != null ? src.rawN : null),
                    rawHS: (src.rawHS != null ? src.rawHS : null),
                    TB: (src.TB != null ? src.TB : null),
                    TA: (src.TA != null ? src.TA : null)
                };
            } catch (_) {
                return null;
            }
        }

        function buildSnapshotNow(sourceTag) {
            var p = null;
            var st = '';
            var t = null;
            var seq = '';
            var rawSeq = '';
            var seqFresh = '';
            var seqVersion = 0;
            var seqEvent = '';
            var seqMode = '';
            var seqAppend = '';
            var seqWhich = '';
            var cached = null;
            var buildSource = String(sourceTag || 'auto');
            var perfMode = isPerfMode();
            var nowTs = Date.now();
            var jsProgMs = 0, jsTotalsMs = 0, jsSeqMs = 0;
            _cwSnapshotBuildId = Number(_cwSnapshotBuildId || 0) + 1;
            _cwSnapshotBuildSource = buildSource;
            var buildId = Number(_cwSnapshotBuildId || 0);
            var domSeqVerBefore = Number(_domSeqVersion || 0);
            var domSeqEvtBefore = String(_domSeqEvent || '');
            try {
                window.__cw_seq_build_id = buildId;
                window.__cw_seq_build_source = buildSource;
            } catch (_) {}

            try {
                if (window.__cw_last_panel_snapshot)
                    cached = window.__cw_last_panel_snapshot;
            } catch (_) {}

            try {
                if (cached && cached.prog != null)
                    p = cached.prog;
            } catch (_) {}
            try {
                if (p == null && S && S.prog != null)
                    p = S.prog;
            } catch (_) {}
            if (p == null) {
                var tp0 = Date.now();
                var useProgCache = perfMode && buildSource === 'push' && _abxSnapCache.progAt > 0 && (nowTs - _abxSnapCache.progAt) < 420;
                if (useProgCache) {
                    p = _abxSnapCache.prog;
                } else {
                    p = readProgressVal();
                    _abxSnapCache.prog = p;
                    _abxSnapCache.progAt = Date.now();
                }
                jsProgMs += (Date.now() - tp0);
            }

            try {
                st = (typeof readStatusTextByTail === 'function') ? String(readStatusTextByTail() || '') : '';
            } catch (_) {
                st = '';
            }
            var progNum = (typeof p === 'number' && isFinite(p)) ? p : null;
            var totalsCacheMs = 1400;
            var seqCacheMs = 700;
            var betQueueLen = 0;
            var betProcessing = false;
            var recentBetAge = 999999;
            try { betQueueLen = (BET_QUEUE && BET_QUEUE.length) ? Number(BET_QUEUE.length) : 0; } catch (_) { betQueueLen = 0; }
            try { betProcessing = !!_processingBetQueue; } catch (_) { betProcessing = false; }
            try { recentBetAge = nowTs - Number(window.__cw_last_bet_touch_at || 0); } catch (_) { recentBetAge = 999999; }
            var betHot = betProcessing || betQueueLen > 0 || recentBetAge < 2600;
            if (perfMode && buildSource === 'push') {
                if (progNum == null) {
                    totalsCacheMs = betHot ? 700 : 1900;
                    seqCacheMs = 900;
                } else if (progNum <= 1.0 || progNum >= 15.5) {
                    // Pha mở bài/chờ ván mới: tiền ít đổi -> cache lâu hơn.
                    totalsCacheMs = betHot ? 900 : 3200;
                    seqCacheMs = 1200;
                } else if (progNum <= 6.5) {
                    // Pha cược: giữ cập nhật nhanh hơn.
                    totalsCacheMs = betHot ? 500 : 1200;
                    seqCacheMs = 650;
                } else {
                    totalsCacheMs = betHot ? 750 : 1800;
                    seqCacheMs = 900;
                }
                if (_forcePushOnce) {
                    seqCacheMs = Math.min(seqCacheMs, 320);
                    if (betHot)
                        totalsCacheMs = Math.min(totalsCacheMs, 550);
                    else
                        totalsCacheMs = Math.min(totalsCacheMs, 1200);
                }
            }

            var useTotalsCache = perfMode &&
                                 buildSource === 'push' &&
                                 _abxSnapCache.totalsAt > 0 &&
                                 (nowTs - _abxSnapCache.totalsAt) < totalsCacheMs;
            var useSeqCache = perfMode &&
                              buildSource === 'push' &&
                              _abxSnapCache.seqAt > 0 &&
                              (nowTs - _abxSnapCache.seqAt) < seqCacheMs;
            if (perfMode &&
                buildSource === 'push' &&
                !_forcePushOnce &&
                !useTotalsCache &&
                !useSeqCache) {
                var totalsAge = _abxSnapCache.totalsAt > 0 ? (nowTs - _abxSnapCache.totalsAt) : 999999;
                var seqAge = _abxSnapCache.seqAt > 0 ? (nowTs - _abxSnapCache.seqAt) : 999999;
                var hasTotalsFallback = !!(_abxSnapCache.totals || (cached && cached.totals) || (S && S._lastTotals));
                var hasSeqFallback = !!(_abxSnapCache.seqState || (cached && cached.seq) || (S && S.seq) || window.__cw_seq);
                var preferTotalsRefresh = betHot || (progNum != null && progNum <= 6.5);
                var canDeferTotals = hasTotalsFallback && totalsAge < (totalsCacheMs + 2600);
                var canDeferSeq = hasSeqFallback && seqAge < (seqCacheMs + 2200);
                // Tránh dồn 2 phép quét nặng vào cùng tick -> giảm spike jsBuildMs.
                if (preferTotalsRefresh && canDeferSeq) {
                    useSeqCache = true;
                } else if (!preferTotalsRefresh && canDeferTotals) {
                    useTotalsCache = true;
                }
            }
            try {
                if (cached && cached.totals)
                    t = normalizeTotalsSnapshot(cached.totals);
            } catch (_) {}
            try {
                if (!t && S && S._lastTotals)
                    t = normalizeTotalsSnapshot(S._lastTotals);
            } catch (_) {}
            if (useTotalsCache) {
                t = normalizeTotalsSnapshot(_abxSnapCache.totals) || t;
            } else {
                var tt0 = Date.now();
                var totalsFresh = readTotalsSafe(perfMode && buildSource === 'push');
                jsTotalsMs += (Date.now() - tt0);
                if (totalsFresh) {
                    _abxSnapCache.totals = totalsFresh;
                    _abxSnapCache.totalsAt = Date.now();
                }
                t = normalizeTotalsSnapshot(totalsFresh) || t;
            }

            try {
                if (cached && cached.seq)
                    seq = String(cached.seq || '');
            } catch (_) {}
            try {
                if (!seq && S && S.seq)
                    seq = String(S.seq || '');
            } catch (_) {}
            try {
                var seqState = null;
                if (useSeqCache) {
                    seqState = _abxSnapCache.seqState;
                } else {
                    var ts0 = Date.now();
                    seqState = readSeqStateSafe();
                    jsSeqMs += (Date.now() - ts0);
                    _abxSnapCache.seqState = seqState;
                    _abxSnapCache.seqAt = Date.now();
                }
                seqFresh = String((seqState && seqState.seq) || '');
                rawSeq = String((seqState && seqState.rawSeq) || '');
                seqWhich = String((seqState && seqState.which) || '');
                seqVersion = Number((seqState && seqState.seqVersion != null) ? seqState.seqVersion : (window.__cw_seq_version || 0)) || 0;
                seqEvent = String((seqState && seqState.seqEvent) ? seqState.seqEvent : (window.__cw_seq_event || ''));
                seqMode = String((seqState && seqState.seqMode) || '');
                seqAppend = String((seqState && seqState.seqAppend) || '');
            } catch (_) {
                seqFresh = '';
                rawSeq = '';
                seqVersion = Number(window.__cw_seq_version || 0) || 0;
                seqEvent = String(window.__cw_seq_event || '');
                seqMode = '';
                seqAppend = '';
            }
            if (seqFresh) {
                if (!seq ||
                    (seqFresh.length > seq.length && seqFresh.indexOf(seq) === 0) ||
                    (seq && seq.indexOf(seqFresh) !== 0 && seqFresh.length > seq.length)) {
                    seq = seqFresh;
                }
            } else if (!seq) {
                try {
                    if (window.__cw_seq)
                        seq = String(window.__cw_seq || '');
                } catch (_) {}
                if (!seq) {
                    try {
                        seq = String(_domBeadSeqManaged || '');
                    } catch (_) {
                        seq = '';
                    }
                }
            }
            if (!rawSeq) {
                try {
                    if (seqState && seqState.rawSeq)
                        rawSeq = String(seqState.rawSeq || '');
                } catch (_) {}
                if (!rawSeq) {
                    try {
                        rawSeq = String(window.__cw_bead_raw_seq || '');
                    } catch (_) {
                        rawSeq = '';
                    }
                }
            }
            try {
                if (seq && !rawSeq) {
                    cwDbg('SEQFLOW', 'snapshot-seq-without-raw', {
                        buildId: buildId,
                        source: buildSource,
                        href: String(location.href || ''),
                        path: String(location.pathname || ''),
                        seqLen: String(seq || '').length,
                        seqTail: seq ? String(seq).slice(-1) : '',
                        seqVersion: Number(seqVersion || 0) || 0,
                        seqEvent: String(seqEvent || ''),
                        seqMode: String(seqMode || ''),
                        seqAppend: String(seqAppend || ''),
                        seqFreshLen: String(seqFresh || '').length,
                        cachedSeqLen: cached && cached.seq ? String(cached.seq || '').length : 0,
                        stateRawLen: seqState && seqState.rawSeq ? String(seqState.rawSeq || '').length : 0,
                        beadRawLen: String(window.__cw_bead_raw_seq || '').length,
                        managedLen: String(window.__cw_seq || '').length
                    }, 500, 'snapshot-seq-without-raw|' + buildSource + '|' + String(seqEvent || '') + '|' + Number(seqVersion || 0) + '|' + String(seq || '').length);
                } else if (buildSource === 'pull' && seq && rawSeq && String(seq) === String(rawSeq)) {
                    cwDbg('SEQFLOW', 'snapshot-pull-raw-fallback-from-seq', {
                        buildId: buildId,
                        href: String(location.href || ''),
                        path: String(location.pathname || ''),
                        seqLen: String(seq || '').length,
                        seqVersion: Number(seqVersion || 0) || 0,
                        seqEvent: String(seqEvent || ''),
                        seqMode: String(seqMode || ''),
                        seqAppend: String(seqAppend || ''),
                        seqFreshLen: String(seqFresh || '').length,
                        stateRawLen: seqState && seqState.rawSeq ? String(seqState.rawSeq || '').length : 0,
                        beadRawLen: String(window.__cw_bead_raw_seq || '').length
                    }, 500, 'snapshot-pull-raw-fallback-from-seq|' + Number(seqVersion || 0) + '|' + String(seq || '').length);
                }
            } catch (_) {}
            if (!seqMode || !seqAppend) {
                var seqContract = brBuildSeqSnapshotContract(seqEvent);
                if (!seqMode)
                    seqMode = String(seqContract.mode || '');
                if (!seqAppend)
                    seqAppend = String(seqContract.append || '');
            }
            if (!seqVersion) {
                try {
                    if (cached && cached.seqVersion != null)
                        seqVersion = Number(cached.seqVersion) || 0;
                } catch (_) {}
                if (!seqVersion) {
                    try {
                        if (S && S.seqVersion != null)
                            seqVersion = Number(S.seqVersion) || 0;
                    } catch (_) {}
                }
            }
            if (!seqEvent) {
                try {
                    if (cached && cached.seqEvent != null)
                        seqEvent = String(cached.seqEvent || '');
                } catch (_) {}
                if (!seqEvent) {
                    try {
                        if (S && S.seqEvent != null)
                            seqEvent = String(S.seqEvent || '');
                    } catch (_) {}
                }
            }
            try {
                var snapSeqLenNow = String(seq || '').length;
                var snapSeqVerNow = Number(seqVersion || 0) || 0;
                var snapEvtNow = String(seqEvent || '');
                if (snapEvtNow === 'no-change' && snapSeqVerNow > 0) {
                    var advVer = Number(_domLastAdvanceVersion || 0);
                    var advAt = Number(_domLastAdvanceAt || 0);
                    var advEvt = String(_domLastAdvanceEvent || '');
                    var advLen = Number(_domLastAdvanceSeqLen || 0);
                    var advAgeMs = advAt ? (Date.now() - advAt) : 999999;
                    if (advVer === snapSeqVerNow && advEvt && advAgeMs <= 2800 && snapSeqLenNow >= advLen) {
                        seqEvent = advEvt;
                        cwDbg('SEQFLOW', 'snapshot-rewrite-nochange-after-append', {
                            buildId: buildId,
                            source: buildSource,
                            seqVersion: snapSeqVerNow,
                            seqLen: snapSeqLenNow,
                            seqEventBefore: snapEvtNow,
                            seqEventAfter: seqEvent,
                            advanceVersion: advVer,
                            advanceEvent: advEvt,
                            advanceLen: advLen,
                            advanceAgeMs: advAgeMs
                        }, 0, 'snapshot-rewrite-nochange|' + buildSource + '|' + buildId + '|' + snapSeqVerNow + '|' + advEvt);
                    }
                }
            } catch (_) {}

            try {
                if (!__cw_hasCocos() && domStatusImpliesClosed(st))
                    p = 0;
            } catch (_) {}

            try {
                if ((/^shoe-reset/i.test(seqEvent || '') || /append-reset-seed/i.test(seqEvent || '') ||
                    (/append-reset-seed-step/i.test(domSeqEvtBefore || '') && String(seqEvent || '') === 'no-change' && Number(seqVersion || 0) === Number(domSeqVerBefore || 0))) &&
                    (__cw_debug_seq || __cw_debug_seq_detail)) {
                    cwDbg('SEQFLOW', 'build-snapshot', {
                        buildId: buildId,
                        source: buildSource,
                        domSeqVerBefore: domSeqVerBefore,
                        domSeqEvtBefore: domSeqEvtBefore,
                        snapSeqVer: Number(seqVersion || 0),
                        snapSeqEvt: String(seqEvent || ''),
                        snapSeqLen: String(seq || '').length,
                        resetPending: _domShoeResetPending ? 1 : 0
                    }, 0, 'seqflow-build|' + buildSource + '|' + buildId + '|' + Number(seqVersion || 0) + '|' + String(seqEvent || ''));
                }
            } catch (_) {}
            try {
                brPostLayoutDiag('snapshot-context', 4000, 'snapshot|' + buildSource + '|' + String((location && location.href) || ''), {
                    buildSource: buildSource,
                    buildId: buildId,
                    status: String(st || ''),
                    statusSource: String(window.__cw_status_source || ''),
                    statusTail: String(window.__cw_status_tail || ''),
                    seqLen: String(seq || '').length,
                    rawLen: String(rawSeq || '').length,
                    seqVersion: Number(seqVersion || 0) || 0,
                    seqEvent: String(seqEvent || ''),
                    seqMode: String(seqMode || ''),
                    seqAppend: String(seqAppend || '')
                });
            } catch (_) {}

            var uname = '';
            try {
                if (t && t.N != null)
                    uname = String(t.N || '');
            } catch (_) {}
            var ctx = {};
            var sig = {};
            try { ctx = __abxBuildContext(); } catch (_) { ctx = {}; }
            try { sig = __abxGetGameSignals(); } catch (_) { sig = {}; }

            return {
                abx: 'tick',
                prog: p,
                totals: t,
                seq: seq,
                rawSeq: rawSeq,
                seqVersion: seqVersion,
                seqEvent: seqEvent,
                seqMode: seqMode,
                seqAppend: seqAppend,
                seqWhich: seqWhich,
                username: uname,
                status: String(st || ''),
                statusSource: String(window.__cw_status_source || ''),
                statusTail: String(window.__cw_status_tail || ''),
                contextId: String(ctx.contextId || ''),
                framePath: String(ctx.framePath || ''),
                href: String(ctx.href || ''),
                topHref: String(ctx.topHref || ''),
                isTop: ctx.isTop ? 1 : 0,
                authorityToken: String(window.__abx_authority_token || ''),
                contextScore: Number(sig.score || 0) || 0,
                contextConfidence: String(sig.confidence || ''),
                signals: String(sig.signals || ''),
                ts: Date.now(),
                jsProgMs: jsProgMs,
                jsTotalsMs: jsTotalsMs,
                jsSeqMs: jsSeqMs,
                jsPerfMode: perfMode ? 1 : 0
            };
        }

        window.__cw_readSnapshot = function () {
            try {
                var snap = buildSnapshotNow('pull');
                var curVer = Number(snap && snap.seqVersion != null ? snap.seqVersion : 0) || 0;
                if (_lastPullSeqVersion > 0 && curVer > (_lastPullSeqVersion + 1)) {
                    cwDbg('SEQFLOW', 'pull-version-jump', {
                        prevPullVer: _lastPullSeqVersion,
                        curPullVer: curVer,
                        delta: curVer - _lastPullSeqVersion,
                        seqEvent: String(snap && snap.seqEvent ? snap.seqEvent : ''),
                        seqLen: String(snap && snap.seq ? snap.seq : '').length,
                        resetPending: _domShoeResetPending ? 1 : 0,
                        buildId: Number(_cwSnapshotBuildId || 0)
                    }, 0, 'seqflow-pull-jump|' + _lastPullSeqVersion + '|' + curVer);
                }
                _lastPullSeqVersion = curVer;
                return snap;
            } catch (_) {
                return null;
            }
        };

        // Bắt đầu bắn snapshot định kỳ {abx:'tick', prog, totals, seq, status}
        window.__cw_startPush = function (tickMs) {
            try {
                tickMs = Number(tickMs) || 360;
                if (tickMs < 180)
                    tickMs = 180;
                if (tickMs > 1000)
                    tickMs = 1000;
                if (!__abxIsAuthorityContext()) {
                    if (_pushTimer) {
                        clearInterval(_pushTimer);
                        _pushTimer = null;
                    }
                    var denyCtx = {};
                    try { denyCtx = __abxBuildContext(); } catch (_) { denyCtx = {}; }
                    cwDbg('PUSH', 'startPush denied (not authority)', {
                        contextId: String(denyCtx.contextId || ''),
                        expected: String(window.__abx_authority_context_id || '')
                    }, 1200, 'startPush-deny-authority|' + String(denyCtx.contextId || ''));
                    __abxPost({
                        abx: 'authority_denied',
                        reason: 'not-authority',
                        contextId: String(denyCtx.contextId || ''),
                        expectedContextId: String(window.__abx_authority_context_id || ''),
                        href: String(denyCtx.href || ''),
                        ts: Date.now()
                    });
                    return 'skip-not-authority';
                }
                if (!isLikelyGameContext()) {
                    if (_pushTimer) {
                        clearInterval(_pushTimer);
                        _pushTimer = null;
                    }
                    _lastJson = '';
                    _lastStableJson = '';
                    cwDbg('PUSH', 'startPush skipped (non-game context)', {
                        href: (function () {
                            try {
                                return String((location && location.href) || '').replace(/[?#].*$/, '');
                            } catch (_) {
                                return '';
                            }
                        })()
                    }, 1800, 'startPush-skip-non-game');
                    brPostLayoutDiag('startpush-skip-non-game', 1800, 'startpush-skip|' + String((location && location.href) || ''), {
                        tickMs: tickMs
                    });
                    return 'skip-non-game';
                }
                if (_pushTimer) {
                    clearInterval(_pushTimer);
                    _pushTimer = null;
                }
                _lastJson = '';
                _lastStableJson = '';
                try { window.__cw_last_push_seq_version = Number(_lastPushSeqVersion || 0) || 0; } catch (_) {}
                cwDbg('PUSH', 'startPush', { tickMs: tickMs }, 0, 'startPush|' + tickMs);
                brPostLayoutDiag('startpush', 2000, 'startpush|' + String((location && location.href) || ''), {
                    tickMs: tickMs
                });
                function __cwPushTickOnce() {
                    var buildT0 = Date.now();
                    var snap = buildSnapshotNow('push');
                    var jsBuildMs = Date.now() - buildT0;
                    if (snap && jsBuildMs >= 0)
                        snap.jsBuildMs = jsBuildMs;
                    var ev = String(snap && snap.seqEvent ? snap.seqEvent : '');
                    if (/^append|^append-after-reset|^append-reset-seed/i.test(ev))
                        _forcePushOnce = true;
                    var curVer = Number(snap && snap.seqVersion != null ? snap.seqVersion : 0) || 0;
                    if (ev === 'no-change' &&
                        curVer === Number(_domLastSeedStepVersion || 0) &&
                        _domLastSeedStepAt &&
                        (Date.now() - _domLastSeedStepAt) <= 2500) {
                        cwDbg('SEQFLOW', 'push-sees-no-change-after-seed-step', {
                            seqVersion: curVer,
                            seqLen: String(snap && snap.seq ? snap.seq : '').length,
                            seedAgeMs: Date.now() - _domLastSeedStepAt,
                            seedBuildId: Number(_domLastSeedStepBuildId || 0),
                            buildId: Number(_cwSnapshotBuildId || 0),
                            resetPending: _domShoeResetPending ? 1 : 0
                        }, 0, 'seqflow-push-nochange-after-seed|' + curVer + '|' + Number(_cwSnapshotBuildId || 0));
                    }
                    if (_lastPushSeqVersion > 0 && curVer > (_lastPushSeqVersion + 1)) {
                        cwDbg('SEQFLOW', 'push-version-jump', {
                            prevPushVer: _lastPushSeqVersion,
                            curPushVer: curVer,
                            delta: curVer - _lastPushSeqVersion,
                            seqEvent: ev,
                            seqLen: String(snap && snap.seq ? snap.seq : '').length,
                            resetPending: _domShoeResetPending ? 1 : 0,
                            buildId: Number(_cwSnapshotBuildId || 0)
                        }, 0, 'seqflow-push-jump|' + _lastPushSeqVersion + '|' + curVer);
                    }
                    var changed = shallowChanged(snap);
                    if (_forcePushOnce || changed) {
                        cwDbg('SEQPUSH', 'tick-send', {
                            changed: changed ? 1 : 0,
                            forced: _forcePushOnce ? 1 : 0,
                            seqLen: snap && snap.seq ? String(snap.seq || '').length : 0,
                            seqVersion: snap && snap.seqVersion != null ? snap.seqVersion : null,
                            seqEvent: snap && snap.seqEvent ? snap.seqEvent : '',
                            resetPending: _domShoeResetPending ? 1 : 0,
                            status: snap && snap.status ? snap.status : ''
                        }, 800, 'seqpush-tick-send|' + (snap && snap.seqVersion != null ? snap.seqVersion : '') + '|' + ev + '|' + (changed ? '1' : '0') + '|' + (_forcePushOnce ? '1' : '0'));
                        cwDbg('PUSH', 'send tick', {
                            changed: changed ? 1 : 0,
                            forced: _forcePushOnce ? 1 : 0,
                            seqLen: snap && snap.seq ? String(snap.seq || '').length : 0,
                            seqVersion: snap && snap.seqVersion != null ? snap.seqVersion : null,
                            seqEvent: snap && snap.seqEvent ? snap.seqEvent : '',
                            status: snap && snap.status ? snap.status : ''
                        }, 2200, 'tick-send|' + (snap && snap.seqVersion != null ? snap.seqVersion : '') + '|' + (snap && snap.seqEvent ? snap.seqEvent : '') + '|' + (changed ? '1' : '0') + '|' + (_forcePushOnce ? '1' : '0'));
                        safePost(snap);
                        _lastPushSeqVersion = curVer;
                        try { window.__cw_last_push_seq_version = curVer; } catch (_) {}
                        _forcePushOnce = false;
                    } else if (/append/i.test(ev)) {
                        cwDbg('SEQPUSH', 'event-but-not-sent', {
                            seqLen: snap && snap.seq ? String(snap.seq || '').length : 0,
                            seqVersion: snap && snap.seqVersion != null ? snap.seqVersion : null,
                            seqEvent: ev,
                            resetPending: _domShoeResetPending ? 1 : 0
                        }, 0, 'seqpush-event-not-sent|' + (snap && snap.seqVersion != null ? snap.seqVersion : '') + '|' + ev);
                        cwDbg('PUSH', 'event-but-not-sent', {
                            seqLen: snap && snap.seq ? String(snap.seq || '').length : 0,
                            seqVersion: snap && snap.seqVersion != null ? snap.seqVersion : null,
                            seqEvent: ev
                        }, 0, 'event-not-sent|' + (snap && snap.seqVersion != null ? snap.seqVersion : '') + '|' + ev);
                    }
                }
                _pushTimer = setInterval(__cwPushTickOnce, tickMs);
                try { __cwPushTickOnce(); } catch (_) {}
                return 'started';
            } catch (err) {
                cwDbg('PUSH', 'startPush fail', {
                    error: String(err && err.message || err)
                }, 0, 'startPush-fail');
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
            cwDbg('PUSH', 'stopPush', null, 0, 'stopPush');
            return 'stopped';
        };

        // LƯU Ý: Chỉ dùng cwBet, không fallback cwBetSmart
        // Hàng đợi đặt cược tuần tự: C# cứ đẩy xuống, JS tự xếp hàng và bắn cwBet lần lượt
        // === BET QUEUE v2: C# đẩy intent, JS xếp hàng và bắn tuần tự ===
        var BET_QUEUE = window.__cwBetQueue = window.__cwBetQueue || [];
        var _processingBetQueue = false;
        var _betJobSeq = Number(window.__cwBetJobSeq || 0);
        try {
            safePost({
                abx: "bet_trace_ready",
                trace: "BETTRACE2",
                queueLen: BET_QUEUE.length,
                ts: Date.now()
            });
        } catch (_) {}

        function nextBetJobId() {
            _betJobSeq = (_betJobSeq + 1) >>> 0;
            try { window.__cwBetJobSeq = _betJobSeq; } catch (_) {}
            return _betJobSeq;
        }

        function getBetContextBrief() {
            var source = 'top';
            var href = '';
            try {
                var ctx = (typeof domGetContext === 'function') ? domGetContext() : null;
                source = String(ctx && ctx.source || 'top');
                href = String(ctx && ctx.href || '');
            } catch (_) {}
            if (!href) {
                try { href = String(location && location.href || ''); } catch (_) {}
            }
            href = String(href || '').replace(/[?#].*$/, '').slice(0, 180);
            return {
                source: source,
                href: href
            };
        }

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
                var ctx = getBetContextBrief();
                return {
                    jobId: nextBetJobId(),
                    side: side,
                    amt: amt,
                    tabId: tabId,
                    roundId: roundId,
                    at: Date.now(),
                    enqueueSource: ctx.source,
                    enqueueHref: ctx.href
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
                    try { window.__cw_last_bet_touch_at = Date.now(); } catch (_) {}
                    var currentRound = getRoundIdSafe();
                    var execCtx = getBetContextBrief();
                    safePost({
                        abx: "bet_exec_begin",
                        jobId: job.jobId || 0,
                        tabId: job.tabId,
                        roundId: job.roundId,
                        side: job.side,
                        amount: job.amt,
                        queueLen: BET_QUEUE.length,
                        currentRound: currentRound,
                        enqueueSource: job.enqueueSource || "",
                        enqueueHref: job.enqueueHref || "",
                        execSource: execCtx.source || "",
                        execHref: execCtx.href || "",
                        ts: Date.now()
                    });
                    if (job.roundId && currentRound && job.roundId < currentRound) {
                        safePost({
                            abx: "bet_dropped",
                            reason: "stale",
                            jobId: job.jobId || 0,
                            tabId: job.tabId,
                            roundId: job.roundId,
                            side: job.side,
                            amount: job.amt,
                            queueLen: BET_QUEUE.length,
                            ts: Date.now()
                        });
                        continue;
                    }
                    if (typeof cwBet !== "function") throw new Error("cwBet not found");

                    var before = readTotalsSafe() || {};
                    try { window.__cw_last_bet_clicks = 0; } catch (_) {}
                    var rawResult = await cwBet(job.side, job.amt);
                    var ok = rawResult === true || rawResult === "ok" || (rawResult && rawResult.ok === true);
                    var rawType = (rawResult == null) ? "nullish" : (typeof rawResult);
                    var rawText = "";
                    try { rawText = String(rawResult); } catch (_) { rawText = ""; }
                    if (rawText.length > 160) rawText = rawText.slice(0, 160);
                    try {
                        if (ok && typeof waitForTotalsChange === "function") {
                            await waitForTotalsChange(before, job.side, 200);
                        }
                    } catch (_) {}
                    try { window.__cw_last_bet_touch_at = Date.now(); } catch (_) {}
                    var after = readTotalsSafe() || {};
                    var beforeSide = 0;
                    var afterSide = 0;
                    try {
                        beforeSide = Number(before && before[job.side] || 0);
                        afterSide = Number(after && after[job.side] || 0);
                    } catch (_) {}
                    var clickCount = 0;
                    try { clickCount = Number(window.__cw_last_bet_clicks || 0); } catch (_) {}
                    safePost({
                        abx: "bet_exec_done",
                        jobId: job.jobId || 0,
                        tabId: job.tabId,
                        roundId: job.roundId,
                        side: job.side,
                        amount: job.amt,
                        ok: ok ? 1 : 0,
                        rawType: rawType,
                        rawResult: rawText,
                        clicks: clickCount,
                        beforeSide: beforeSide,
                        afterSide: afterSide,
                        deltaSide: (afterSide - beforeSide),
                        queueLen: BET_QUEUE.length,
                        ts: Date.now()
                    });
                    if (ok) {
                        safePost({
                            abx: "bet",
                            jobId: job.jobId || 0,
                            side: job.side,
                            amount: job.amt,
                            tabId: job.tabId,
                            roundId: job.roundId,
                            ts: Date.now()
                        });
                        result = "ok";
                    } else {
                        var reason = (rawResult && rawResult.error)
                            ? String(rawResult.error)
                            : (rawResult === false
                                ? (window.__cw_lastBetError || "cwBet returned false")
                                : ("cwBet returned " + String(rawResult)));
                        result = "fail:" + reason;
                    }
                } catch (err) {
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
                try { window.__cw_last_bet_touch_at = Date.now(); } catch (_) {}
                return await new Promise(function (resolve) {
                    job.resolve = resolve;
                    BET_QUEUE.push(job);
                    processBetQueue();
                    safePost({
                        abx: "bet_queued",
                        jobId: job.jobId || 0,
                        tabId: job.tabId,
                        roundId: job.roundId,
                        side: job.side,
                        amount: job.amt,
                        queueLen: BET_QUEUE.length,
                        enqueueSource: job.enqueueSource || "",
                        enqueueHref: job.enqueueHref || "",
                        ts: Date.now()
                    });
                });
            } catch (err) {
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
                return "fail:" + String(err && err.message || err);
            }
        };

    })();

    }

    __abxStartScoutLoop();

    if (__cw_isGamePopupPage()) {
        if (document.body || document.documentElement) {
            __cw_boot();
        } else {
            document.addEventListener('DOMContentLoaded', function () {
                if (__cw_isGamePopupPage())
                    __cw_boot();
            }, { once: true });
        }
    }

})();
