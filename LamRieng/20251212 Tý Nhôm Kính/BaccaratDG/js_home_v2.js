(function () {
    'use strict';
    // Muốn hiện và ẩn bảng điều khiển home watch thì tìm dòng sau : showPanel: false // ⬅️ false = ẩn panel; true = hiện panel
    const IS_TOP = window.self === window.top;
    function isTelemetry(u) {
        try {
            const href = typeof u === 'string' ? u : (u && u.url) || '';
            const url = new URL(href, location.href);
            // chặn MỌI request tới host ap.stape.info (kể cả events_cfc…)
            return url.hostname === 'stape.info' || url.hostname.endsWith('.stape.info');
        } catch (_) {
            return /(^|\.)stape\.info/.test(String(u || ''));
        }
    }

    // --- MUTE TELEMETRY SỚM NHẤT (fetch, XHR, sendBeacon) ---
    (function installTelemetryMutes() {
        if (window.__abx_telemetry_hooked)
            return;
        window.__abx_telemetry_hooked = true;

        // 1) fetch
        const origFetch = window.fetch;
        if (typeof origFetch === 'function') {
            window.fetch = function (input, init) {
                const url = typeof input === 'string' ? input : (input && input.url) || '';
                if (isTelemetry(url)) {
                    return Promise.resolve(new Response('', {
                            status: 204,
                            statusText: 'No Content'
                        }));
                }

                return origFetch.apply(this, arguments);
            };
        }

        // 2) XHR
        const XHR = window.XMLHttpRequest;
        if (XHR && XHR.prototype) {
            const open = XHR.prototype.open;
            const send = XHR.prototype.send;

            XHR.prototype.open = function (method, url) {
                try {
                    this.__abx_url = typeof url === 'string' ? url : String(url);
                } catch (_) {}
                return open.apply(this, arguments);
            };
            XHR.prototype.send = function (body) {
                const u = this.__abx_url || '';
                if (isTelemetry(u)) {
                    try {
                        this.abort();
                    } catch (_) {}
                    return; // nuốt luôn
                }
                return send.apply(this, arguments);
            };

        }

        // 3) sendBeacon
        if (navigator && typeof navigator.sendBeacon === 'function') {
            const origSB = navigator.sendBeacon.bind(navigator);
            navigator.sendBeacon = (url, data) =>
            isTelemetry(url) ? true : origSB(url, data);

        }
    })();

    function installTelemetryMutesInFrame(win) {
        try {
            if (!win || win.__abx_telemetry_hooked)
                return;
            const w = win;
            w.__abx_telemetry_hooked = true;
            // fetch
            const of = w.fetch;
            if (typeof of === 'function') {
                w.fetch = function (input, init) {
                    const url = typeof input === 'string' ? input : (input && input.url) || '';
                    return isTelemetry(url) ? Promise.resolve(new w.Response('', {
                            status: 204,
                            statusText: 'No Content'
                        }))
                     : of.apply(this, arguments);
                };
            }
            // XHR
            const X = w.XMLHttpRequest;
            if (X && X.prototype) {
                const _open = X.prototype.open,
                _send = X.prototype.send;
                X.prototype.open = function (m, u) {
                    try {
                        this.__abx_url = String(u);
                    } catch (_) {}
                    return _open.apply(this, arguments);
                };
                X.prototype.send = function (body) {
                    if (isTelemetry(this.__abx_url || '')) {
                        try {
                            this.abort();
                        } catch (_) {}
                        return;
                    }
                    return _send.apply(this, arguments);
                };
            }
            // sendBeacon
            if (w.navigator && typeof w.navigator.sendBeacon === 'function') {
                const sb = w.navigator.sendBeacon.bind(w.navigator);
                w.navigator.sendBeacon = (url, data) => isTelemetry(url) ? true : sb(url, data);
            }
        } catch (_) {}
    }

    // --- Hết: MUTE TELEMETRY ---
    // === BEGIN TEXTMAP GUARD (đặt trước khi return ở games.*) ===
    (function installTextMapGuard() {
        if (window.__cw_tm_installed)
            return;
        window.__cw_tm_installed = true;

        // Map sống chung toàn trang (không thay thế, chỉ merge)
        let _map = window.__cw_textMap || {};
        window.__cw_textMap = _map;

        // Setter tiện dụng cho code bên ngoài muốn nạp thêm map
        window.__cw_setTextMap = function (partial) {
            try {
                if (!partial || typeof partial !== 'object')
                    return;
                const n = Object.keys(partial).length;
                if (n < 5) {
                    console.warn("SKIPPED setTextMap: empty/small mapping");
                    return;
                }
                Object.assign(_map, partial);
            } catch (_) {}
        };

        // Getter an toàn (có mặc định)
        window.__cw_getText = function (key, fallback = "") {
            try {
                const v = _map && _map[key];
                return (v == null ? fallback : v);
            } catch (_) {
                return fallback;
            }
        };

        // Chặn các đoạn script reset về {} hoặc set map rỗng
        // - Trường hợp page dùng biến toàn cục TextMap => ta bọc bằng accessor
        try {
            let backing = _map;
            Object.defineProperty(window, 'TextMap', {
                configurable: true,
                enumerable: false,
                get() {
                    return backing;
                },
                set(v) {
                    try {
                        if (!v || typeof v !== 'object') {
                            console.warn("SKIPPED setting TextMap: not an object");
                            return;
                        }
                        const n = Object.keys(v).length;
                        if (n < 5) {
                            console.warn("SKIPPED setting TextMap: empty/small mapping");
                            return;
                        }
                        // không replace, chỉ merge để không mất key cũ
                        Object.assign(backing, v);
                    } catch (_) {}
                }
            });
        } catch (_) { /* nếu trang đã định nghĩa sẵn thì bỏ qua */
        }

        // Tiện ích chờ map “đủ lớn” trước khi dùng
        window.__cw_waitForTextMap = async function (minKeys = 50, timeout = 8000, step = 80) {
            const t0 = Date.now();
            while (Date.now() - t0 < timeout) {
                try {
                    if (_map && Object.keys(_map).length >= minKeys)
                        return _map;
                } catch (_) {}
                await new Promise(r => setTimeout(r, step));
            }
            throw new Error("TextMap not ready");
        };

        // (Optional) xuất ra global để debug nhanh: __cw_textMap
    })();
    // === END TEXTMAP GUARD ===

    // Skip toàn bộ Home Watch ở domain game
    if (IS_TOP && /^games\./i.test(location.hostname)) {
        console.debug('[HomeWatch] Skip on game host');
        return;
    }

    function postHomeWatchLog(payload) {
        try {
            const msg = typeof payload === 'object' ? payload : { text: String(payload) };
            msg.abx = msg.abx || 'textmap_log';
            msg.href = String(location.href || '');
            if (window.chrome && window.chrome.webview && typeof window.chrome.webview.postMessage === 'function') {
                window.chrome.webview.postMessage(JSON.stringify(msg));
            } else if (window.parent && window.parent !== window && typeof window.parent.postMessage === 'function') {
                const clone = Object.assign({}, msg, {
                        __abx_hw_frame_proxy: 1
                    });
                window.parent.postMessage(clone, '*');
            }
        } catch (_) {}
    }

    // Chạy 1 lần duy nhất và chỉ ở top window (không chạy trong iframe)
    if (window.__abx_hw_installed)
        return; // chỉ kiểm tra, KHÔNG set ở đây

    // ======= Config =======
    const CFG = {
        panelId: '__abx_hw_root',
        overlayId: '__abx_overlay',
        highlightCls: '__abx_box',
        selectedCls: '__abx_selected',
        infoId: 'hwinfo',
        urlId: 'hwurl',
        retryBtnId: 'bretry',
        linksBtnId: 'blinks',
        textsBtnId: 'btext',
        closePopupBtnId: 'bclosepopup', // NEW: nút ClosePopup
        scanLinksBtnId: 'bscanl200',
        scanTextsBtnId: 'bscant200',
        scanClosePopupBtnId: 'bscanclose200', // NEW: nút Scan200ClosePopup
        overlayToggleBtnId: 'boverlay',
        loginBtnId: 'blogin',
        xocBtnId: 'bxoc',
        copyInfoBtnId: 'bcopyinfo', // ← THÊM DÒNG NÀY
        autoRetryIntervalMs: 5000,
        maxRetries: 6,
        watchdogMs: 1000,
        maxWatchdogMiss: 2,
        showPanel: true,
        autoRetryOnBoot: false
    };

    // ABS selector cho Username (đường dẫn tuyệt đối bạn yêu cầu)
    const ABS_USERNAME_TAIL =
        'div.user-profile[1]/div.main[2]/div.user-profile__left[1]/div.user-profile__form-input[1]/div.full-name[2]/div.base-input.disabled[1]/div.base-input__wrap.has-value[1]/input[1]';
    // --- ABS selector cho số dư (đường dẫn tuyệt đối bạn yêu cầu)
    const ABS_BALANCE_SEL =
        'div.d-flex.align-items-center:nth-of-type(2) > div.menu__right > div.user-logged.d-flex > div.user-logged__info > div.base-dropdown-header > button.btn.btn-secondary > div.left > p.base-dropdown-header__user__amount';

    // --- host helpers ---
    const isGameHost = () => /^games\./i.test(location.hostname);

    // Root popup đăng nhập (lấy từ Scan200ClosePopup bên bản Copy)
    const TAIL_LOGIN_POPUP_ROOT =
        'div.modal-dialog[1]/div.modal-content[1]/gupw-login-box.ng-scope.ng-isolate-scope[1]';
    const TAIL_LOGIN_USER_INPUT =
        'div.modal-dialog[1]/div.modal-content[1]/gupw-login-box.ng-scope.ng-isolate-scope[1]/div._3N2lRww2b9eZP-F5fSS-Rq[2]/div._1OoWQtNHBngCIoug1-MRj3[2]/form.ng-pristine.ng-invalid[1]/div._3kf2U2RqwnANN5VYWFRt8X[1]/input.ng-pristine.ng-untouched[1]';
    const TAIL_LOGIN_PASS_INPUT =
        'div.modal-dialog[1]/div.modal-content[1]/gupw-login-box.ng-scope.ng-isolate-scope[1]/div._3N2lRww2b9eZP-F5fSS-Rq[2]/div._1OoWQtNHBngCIoug1-MRj3[2]/form.ng-pristine.ng-invalid[1]/div.ng-isolate-scope._3kf2U2RqwnANN5VYWFRt8X[2]/input.ng-pristine.ng-untouched[1]';
    const TAIL_LOGIN_CAPTCHA_INPUTS = [
        'div.modal-content[1]/gupw-login-box.ng-scope.ng-isolate-scope[1]/div._3N2lRww2b9eZP-F5fSS-Rq[2]/div._1OoWQtNHBngCIoug1-MRj3[2]/form.ng-invalid.ng-invalid-required[1]/div.ng-scope._3kf2U2RqwnANN5VYWFRt8X[3]/gupw-captcha-login-box.ng-isolate-scope[1]/input.ng-empty.ng-invalid[1]',
        'div.modal-content[1]/gupw-login-box.ng-scope.ng-isolate-scope[1]/div._3N2lRww2b9eZP-F5fSS-Rq[2]/div._1OoWQtNHBngCIoug1-MRj3[2]/form.ng-pristine.ng-invalid[1]/div.ng-scope._3kf2U2RqwnANN5VYWFRt8X[3]/gupw-captcha-login-box.ng-isolate-scope[1]/input.ng-pristine.ng-untouched[1]'
    ];
    const TAIL_LOGIN_REMEMBER_INPUT =
        'div.modal-dialog[1]/div.modal-content[1]/gupw-login-box.ng-scope.ng-isolate-scope[1]/div._3N2lRww2b9eZP-F5fSS-Rq[2]/div._1OoWQtNHBngCIoug1-MRj3[2]/form.ng-dirty.ng-valid-parse[1]/div.ng-scope.ng-isolate-scope[4]/input.ng-untouched.ng-valid[1]';
    const TAIL_LOGIN_POPUP_BTNS = [
        'div.modal-content[1]/gupw-login-box.ng-scope.ng-isolate-scope[1]/div._3N2lRww2b9eZP-F5fSS-Rq[2]/div._1OoWQtNHBngCIoug1-MRj3[2]/form.ng-dirty.ng-valid-parse[1]/div._1eaDDqXK18F0I6yJ56FIwp[5]/button._1elJEDoklSJeZCRhRorPTp[1]/span.ng-scope[1]',
        'div.modal-dialog[1]/div.modal-content[1]/gupw-login-box.ng-scope.ng-isolate-scope[1]/div._3N2lRww2b9eZP-F5fSS-Rq[2]/div._1OoWQtNHBngCIoug1-MRj3[2]/form.ng-dirty.ng-valid-parse[1]/div._1eaDDqXK18F0I6yJ56FIwp[5]/button._1elJEDoklSJeZCRhRorPTp[1]/span.ng-scope[1]',
        'div.modal-dialog[1]/div.modal-content[1]/gupw-login-box.ng-scope.ng-isolate-scope[1]/div._3N2lRww2b9eZP-F5fSS-Rq[2]/div._1OoWQtNHBngCIoug1-MRj3[2]/form.ng-dirty.ng-submitted[1]/div._1eaDDqXK18F0I6yJ56FIwp[5]/button._1elJEDoklSJeZCRhRorPTp[1]',
        'div.modal-dialog[1]/div.modal-content[1]/gupw-login-box.ng-scope.ng-isolate-scope[1]/div._3N2lRww2b9eZP-F5fSS-Rq[2]/div._1OoWQtNHBngCIoug1-MRj3[2]/form[1]/div._1eaDDqXK18F0I6yJ56FIwp[5]/button._1elJEDoklSJeZCRhRorPTp[1]'
    ];
    const LOGIN_POPUP_SELECTOR =
        '.tcg_modal_wrap.loginPopupModal, .tcg_modal_wrap.publicModal, .tcg_modal_wrap, ' +
        '.loginPopupModal, .popup-login, .login-popup, .modal-login, .login__popup, .v--modal-box, .v--modal-overlay';
    const LOGIN_CAPTCHA_FALLBACK_SELECTOR =
        'gupw-captcha-login-box input, input[name*="captcha" i], input[placeholder*="mã" i], input[placeholder*="ma" i]';
    // N£t dang nh?p trˆn header (tail m?i b?n cung c?p)
    const TAIL_LOGIN_BTN =
        'gupw-header.ng-isolate-scope[1]/header._3vHaytPTEUCSbrofAXU7Cb[1]/section.dM4IN4vP0qOz6g1PSzWml[1]/div.TFkX-2VIsaFZW7t64YI07[1]/div.Rn_gRU5eCS1c_8asbKpT1[2]/div[1]/div.ng-scope.XHBKId8UUI4X-RJ2-t7aR[1]/button.ng-scope._2mBNgBjbvImj-b_6WuwAFm[1]';

    // Danh sách popup quảng cáo/thông báo cần auto tắt
    const CLOSE_POPUP_ROOT_TAILS = [
        // Popup thông báo RR88 HƯỞNG VẠ MIỄN LU...
        'html.windows-os[1]/body._style[1]/div[2]/div.br_index_main.br_main[3]/div.v--modal-overlay[2]/div.v--modal-background-click[1]/div.v--modal-box.v--modal[2]/div.tcg_modal_wrap.publicModal[1]',
        // Overlay bọc ngoài
        'html.windows-os[1]/body._style[1]/div[2]/div.br_index_main.br_main[3]/div.v--modal-overlay[2]',
        // Tail thông báo cần đóng thêm
        'body.vi.modal-open[1]/div.modal.fade[1]/div.modal-dialog[1]/div.modal-content[1]/gupw-dialog-marquee.ng-scope.ng-isolate-scope[1]/aside.M0RLBhDgSoQFqxO29GIML[1]/div._9PbX_LFgnXvcTnC_3cq6B[2]/span.ng-scope[1]'
    ];

    const TAIL_BALANCE =
        'div.d-flex.align-items-center[2]/div.menu__right[1]/div.user-logged.d-flex[1]/div.user-logged__info[1]/div.base-dropdown-header[1]/button.btn.btn-secondary[1]/div.left[1]/p.base-dropdown-header__user__amount[1]';

    const TAIL_XOCDIA_BTN =
        'div.livestream-section__live[2]/div.item-live[2]/div.live-stream[1]/div.player-wrapper[1]/div[1]/div.play-button[4]/div.play-overlay[1]/button.base-button.btn[1]';

    // Nút "PP trực tuyến" trên header (Casino LIVE)
    const TAIL_PP_TRUC_TUYEN =
        'div.header_nav[1]/div.header_nav_list[1]/div.nav_item.active[2]/div.dropdown_menu.LIVE[2]/div.drop_bg[1]/ul.drop_ul.noCenter[2]/li[1]/span.desc[2]';

    // Bản dự phòng nếu lúc đó tab Casino chưa có class "active"
    const TAIL_PP_TRUC_TUYEN_ALT =
        'div.header_nav[1]/div.header_nav_list[1]/div.nav_item[2]/div.dropdown_menu.LIVE[2]/div.drop_bg[1]/ul.drop_ul.noCenter[2]/li[1]/span.desc[2]';
    // Tìm nút "PP trực tuyến" theo tail + text, chỉ nhận khi đang visible
    function findPPProviderButton() {
        // 1) Ưu tiên tìm theo 2 tail đã cấu hình
        const tails = [TAIL_PP_TRUC_TUYEN, TAIL_PP_TRUC_TUYEN_ALT];

        for (const t of tails) {
            if (!t)
                continue;
            const el = findByTail(t);
            if (el && isVisibleAndClickable(el)) {
                return el;
            }
        }

        // 2) Fallback: quét theo text "PP trực tuyến" trong header
        const candidates = Array.from(
                document.querySelectorAll('span.desc, li, a, button, div'));

        for (const el of candidates) {
            const txt = (el.textContent || '').trim().toLowerCase();
            if (!txt)
                continue;

            if (txt.includes('pp trực tuyến') && isVisibleAndClickable(el)) {
                return el;
            }
        }

        return null;
    }

    // ======= Game Regex (dùng trên chuỗi đã norm() — không dấu, lowercase) =======
    const RE_XOCDIA_POS = /\bxoc(?:[-\s]*dia)?\b/; // "xoc", "xoc dia", "xoc-dia", "xocdia"
    const RE_XOCDIA_NEG = /\b(?:tai|xiu|taixiu|sicbo|dice)\b/; // "tai", "xiu", "taixiu", "sicbo", "dice"

    // ======= State =======
    const S = {
        showL: false,
        showT: false,
        showP: false, // NEW: map popup
        items: {
            link: [],
            text: [],
            popup: []// NEW: danh sách popup
        },
        selected: null,
        username: '',
        balance: '',
        autoTimer: null,
        inflightProbe: false,
        retries: 0,
        fetchDone: false,
        pumpTimer: null,
        watchdogTimer: null,
        missStreak: 0,
        authGateOpened: false,
        loginPopupTimer: null, // NEW: timer auto click login
        loginPostProbeStarted: false, // NEW: tránh start probe trùng
        loginSubmitTs: 0
    };

    const ROOT_Z = 2147483647;

    // ======= Utils =======
    const clip = (s, n) => {
        s = (s || '').replace(/\s+/g, ' ').trim();
        return s.length > n ? s.slice(0, n) : s;
    };
    const rectOf = el => {
        const r = el.getBoundingClientRect();
        return {
            x: Math.round(r.left | 0),
            y: Math.round(r.top | 0),
            w: Math.round(r.width | 0),
            h: Math.round(r.height | 0)
        };
    };
    const area = r => Math.max(0, r.w) * Math.max(0, r.h);
    const smallFirst = (a, b) => {
        const da = area(a.rect),
        db = area(b.rect);
        if (da !== db)
            return da - db;
        return a.idx - b.idx;
    };
    const norm = s => (s || '').toString().normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
    const wait = ms => new Promise(r => setTimeout(r, ms));
    // log tiện dụng cho luồng baccarat
    const bLog = (msg) => {
        try {
            updateInfo && updateInfo('[bacc] ' + msg);
        } catch (_) {}
        try {
            console && console.warn && console.warn('[BaccMulti]', msg);
        } catch (_) {}
    };

    async function waitFor(test, timeout = 8000, step = 120) {
        const t0 = Date.now();
        while (Date.now() - t0 < timeout) {
            try {
                const v = test();
                if (v)
                    return v;
            } catch (_) {}
            await wait(step);
        }
        return null;
    }

    function textOf(el) {
        try {
            return (el.innerText || el.textContent || '').trim();
        } catch (_) {
            return (el.textContent || '').trim();
        }
    }

    if (IS_TOP && !window.__abx_hw_frame_log_bridge) {
        window.__abx_hw_frame_log_bridge = true;
        window.addEventListener('message', (evt) => {
            try {
                if (!evt || !evt.data || typeof evt.data !== 'object')
                    return;
                if (!evt.data.__abx_hw_frame_proxy)
                    return;
                const clone = Object.assign({}, evt.data);
                delete clone.__abx_hw_frame_proxy;
                if (window.chrome && window.chrome.webview && typeof window.chrome.webview.postMessage === 'function')
                    window.chrome.webview.postMessage(JSON.stringify(clone));
            } catch (_) {}
        }, false);
    }

    function tryParseJsonSample(text, limit = 1200) {
        try {
            const trimmed = String(text || '').trim();
            if (!trimmed || (trimmed[0] !== '{' && trimmed[0] !== '['))
                return null;
            const obj = JSON.parse(trimmed);
            const str = JSON.stringify(obj);
            return str.length > limit ? str.slice(0, limit) + '…' : str;
        } catch (_) {
            return null;
        }
    }

    (function installDgWebSocketTap() {
        try {
            const host = String(location.hostname || '');
            // Chỉ hook bên trong iframe DreamGaming/DingDang (bao gồm cloudfront mirror)
            if (!/(dingdang|dreamgaming|ywjxi\.com)/i.test(host))
                return;
            if (!window.WebSocket || window.__abx_dg_ws_hooked)
                return;
            window.__abx_dg_ws_hooked = true;
            const OrigWS = window.WebSocket;
            const logWs = (phase, info) => {
                try {
                    postHomeWatchLog(Object.assign({
                        abx: 'dg_ws',
                        phase,
                        host,
                        href: String(location.href || '')
                    }, info || {}));
                } catch (_) {}
            };

            window.WebSocket = function (...args) {
                const ws = new OrigWS(...args);
                const url = args && args[0] ? String(args[0]) : '';
                logWs('open', { url });

                ws.addEventListener('message', (evt) => {
                    let sample = '';
                    let jsonSample = null;
                    try {
                        const data = evt.data;
                        if (typeof data === 'string') {
                            sample = data.slice(0, 600);
                            jsonSample = tryParseJsonSample(sample);
                        } else if (data instanceof ArrayBuffer) {
                            sample = '[arraybuffer len=' + data.byteLength + ']';
                        } else if (data instanceof Blob) {
                            sample = '[blob len=' + data.size + ' type=' + data.type + ']';
                        } else {
                            sample = '[' + (typeof data) + ']';
                        }
                    } catch (err) {
                        sample = '[error parsing message: ' + err.message + ']';
                    }
                    logWs('message', {
                        url,
                        sample,
                        json: jsonSample
                    });
                });

                ws.addEventListener('close', (evt) => {
                    logWs('close', {
                        url,
                        code: evt.code,
                        reason: evt.reason || '',
                        clean: evt.wasClean
                    });
                });
                ws.addEventListener('error', () => {
                    logWs('error', { url });
                });
                return ws;
            };
            window.WebSocket.prototype = OrigWS.prototype;
            logWs('hook_ready', { message: 'DG websocket tap installed' });
        } catch (err) {
            try {
                postHomeWatchLog({
                    abx: 'dg_ws',
                    phase: 'hook_error',
                    message: err.message || String(err)
                });
            } catch (_) {}
        }
    })();

    // đặt gần nhóm utils (trước/hoặc sau textOf)
    function isLikelyUsername(s) {
        const t = String(s || '').trim();
        if (!t)
            return false;
        // loại các nhãn phổ biến / label
        if (/(tên\s*hiển\s*thị|tên\s*đăng\s*nhập|đăng\s*nhập|login|email|mật\s*khẩu|vip)/i.test(t))
            return false;
        // độ dài hợp lý cho tên nhân vật
        if (t.length < 2 || t.length > 40)
            return false;
        // phải có ít nhất 1 chữ hoặc số (kể cả có dấu tiếng Việt)
        if (!/[A-Za-zÀ-ỹ0-9]/.test(t))
            return false;
        return true;
    }

    function cssTail(el) {
        const parts = [];
        let e = el,
        depth = 0;
        while (e && e.nodeType === 1 && depth < 8) {
            let name = e.tagName.toLowerCase();
            const cls = (e.className || '').toString().trim().split(/\s+/).filter(Boolean).slice(0, 2).join('.');
            if (cls)
                name += '.' + cls;
            let i = 1,
            s = e.previousElementSibling;
            while (s) {
                if (s.tagName === e.tagName)
                    i++;
                s = s.previousElementSibling;
            }
            name += '[' + i + ']';
            parts.push(name);
            e = e.parentElement;
            depth++;
        }
        return parts.reverse().join('/');
    }

    const $panel = () => document.getElementById(CFG.panelId);
    const $overlay = () => document.getElementById(CFG.overlayId);

    // Bật/tắt log khi debug số dư
    const DEBUG_BAL = false; // đổi true khi cần theo dõi
    const LOGIN_SUBMIT_GUARD_MS = 6000;

    function balLog(...args) {
        if (!DEBUG_BAL)
            return;
        // Dùng mức debug để không làm bẩn console khi không cần
        console.debug('[HW][BAL]', ...args); // hiển thị khi bật Verbose/Debug. :contentReference[oaicite:2]{index=2}
    }

    function setLoginSubmitGuard() {
        S.loginSubmitTs = Date.now();
    }

    function clearLoginSubmitGuard() {
        S.loginSubmitTs = 0;
    }

    function isLoginSubmitGuardActive() {
        if (!S.loginSubmitTs)
            return false;
        if (Date.now() - S.loginSubmitTs > LOGIN_SUBMIT_GUARD_MS) {
            S.loginSubmitTs = 0;
            return false;
        }
        return true;
    }

    function isLoggedInFromDOM() {
        const markLoggedIn = () => {
            clearLoginSubmitGuard();
            return true;
        };
        // 1) Có tên -> chắc chắn logged-in
        const v = findUserFromDOM();
        if (v && v.trim())
            return markLoggedIn();
        // 2) Có khối user đang HIỂN THỊ -> tạm xem là logged-in
        const block = document.querySelector('.user-logged, .base-dropdown-header__user__name, .user__name, .header .user-info, .hd_login .user-name, .logined_wrap');
        if (block && block.offsetParent !== null)
            return markLoggedIn();
        // 3) Thấy nút/khối Đăng xuất hoặc số dư trên header
        const logoutBtn = Array.from(document.querySelectorAll('a,button')).find(el => /dang\s*xuat|logout/i.test(norm(textOf(el))));
        if (logoutBtn && logoutBtn.offsetParent !== null)
            return markLoggedIn();
        const balanceNode = Array.from(document.querySelectorAll('.balance, .balance-text, .user-balance, .nav_item .balance, .balance-box .balance, .logined_wrap .balance-box'))
            .find(el => /\d/.test(norm(textOf(el))));
        if (balanceNode && balanceNode.offsetParent !== null)
            return markLoggedIn();
        return false;
    }
    function closeLoginPopupIfLoggedIn() {
        try {
            if (!isLoggedInFromDOM())
                return;

            // Xóa overlay/modal nếu đang che
            const hideOverlays = () => {
                const sels = [
                    '.v--modal-overlay', '.v--modal-box',
                    '.modal-mask', '.modal-backdrop', '.modal-overlay', '.modal',
                    '.tcg_modal_wrap.loginPopupModal', '.tcg_modal_wrap.publicModal', '.tcg_modal_wrap'
                ];
                const nodes = Array.from(document.querySelectorAll(sels.join(',')));
                nodes.forEach(n => { try { n.style.display = 'none'; n.remove(); } catch (_) {} });
                try { document.body.classList.remove('modal-open', 'overflow-hidden'); document.body.style.overflow = ''; } catch (_) {}
                try { console && console.warn && console.warn('[HomeWatch] removed overlays:', nodes.length); } catch (_) {}
            };

            const roots = [];
            try {
                if (typeof TAIL_LOGIN_POPUP_ROOT === 'string' && TAIL_LOGIN_POPUP_ROOT) {
                    const r = findByTail(TAIL_LOGIN_POPUP_ROOT);
                    if (r) roots.push(r);
                }
            } catch (_) {}
            roots.push(
                ...Array.from(document.querySelectorAll(
                    '.tcg_modal_wrap.loginPopupModal, .tcg_modal_wrap.publicModal, .tcg_modal_wrap, .loginPopupModal, .popup-login, .login-popup, .modal-login, .login__popup, .v--modal-box, .v--modal-overlay'))
            );
            // thêm: tìm modal chứa input password để ẩn cha gần nhất
            const pwdParents = Array.from(document.querySelectorAll('input[type="password"]'))
                .map(i => i.closest('.v--modal-box, .v--modal-overlay, .tcg_modal_wrap, .modal, .popup, .loginPopupModal, .login-popup, .modal-login'))
                .filter(Boolean);
            roots.push(...pwdParents);

            // thử click nút X nếu có; nếu không, gỡ nguyên overlay cha
            const closeBtn = Array.from(document.querySelectorAll('.v--modal__close, .tcg_modal_wrap .close, .tcg_modal_wrap .icon-close, .loginPopupModal .icon-close, .loginPopupModal .close'))
                .find(isVisibleAndClickable);
            if (closeBtn) {
                try { closeBtn.click(); } catch (_) {}
                hideOverlays();
            } else {
                roots.forEach(r => {
                    try {
                        const ov = r.closest('.v--modal-overlay, .v--modal-box') || r;
                        ov.style.display = 'none';
                        ov.remove();
                    } catch (_) {}
                });
                hideOverlays();
            }
        } catch (_) {}
    }

    // Tick định kỳ để đóng popup login nếu đã đăng nhập mà popup vẫn còn
    if (!window.__abx_close_login_timer) {
        window.__abx_close_login_timer = setInterval(() => {
            try {
                if (!isLoggedInFromDOM())
                    return;
                closeLoginPopupIfLoggedIn();
            } catch (_) {}
        }, 1200);
    }
    function showHostMismatchAlertIfAny() {
        try {
            const cfgHost = (window.__abx_cfg_url_host || '').toLowerCase();
            const currHost = (location && location.host || '').toLowerCase();
            if (cfgHost && currHost && cfgHost !== currHost) {
                alert('Host khác với cấu hình:\nĐã đăng nhập ở: ' + cfgHost + '\nNhưng hiện tại: ' + currHost + '\nCookie sẽ không dùng chung, có thể bật lại popup đăng nhập.');
            }
        } catch (_) { }
    }

    function isClearlyLoggedOut() {
        // Chỉ coi như logged-out khi có nút/khối đăng nhập HIỂN THỊ rõ ràng
        const n = document.querySelector(
                '.user-not-login, .btn-login, a[href*="/login"], button[onclick*="login"], [data-action="login"]');
        return !!(n && (n.offsetParent !== null));
    }

    async function onAuthStateMaybeChanged(reason = '') {
        // Chỉ cho phép chạy khi cổng đã mở (đã nhìn thấy nút "Đăng nhập")
        if (typeof canRunAuthLoop === 'function' && !canRunAuthLoop()) {
            return;
        }

        // Nếu đã có tên rồi thì luôn "giữ" cho đến khi CHẮC CHẮN logout
        const hadName = !!S.username;

        // Heuristic "đã login?"
        const loggedIn = !!document.querySelector('.user-logged, .base-dropdown-header__user__name, [class*="user-logged"]');

        if (loggedIn) {
            closeLoginPopupIfLoggedIn();
            // Nếu đã nhận diện là login nhưng chưa có tên → ép kéo 1 lần
            if (!S.username) {
                S.fetchDone = false; // cho phép fetch lại
                try {
                    await tryFetchUserProfile();
                } catch (_) {}
                if (!S.username)
                    probeIframeOnce(); // fallback iframe
            }

            // ĐANG LOGIN: đọc lại ngay và cập nhật số dư
            const u = findUserFromDOM();
            if (u)
                updateUsername(u);
            const b = findBalance();
            if (b)
                updateBalance(b);
            // Nếu chưa ra tên thì thử fetch trang profile (nếu cùng origin)
            if (!S.username) {
                try {
                    await tryFetchUserProfile();
                } catch (_) {}
            }
            if (!S.username || !S.balance)
                pumpAuthProbe(10000);
            return;
        }

        // KHÔNG THẤY DẤU VẾT LOGIN: chỉ coi là logout khi chắc chắn trong khoảng dài hơn
        const CONFIRM_MS = 1800; // trước đây 600ms → tăng để tránh false positive
        const start = Date.now();
        while (Date.now() - start < CONFIRM_MS) {
            // Nếu trong thời gian chờ mà thấy dấu hiệu login lại thì thôi
            const back = !!document.querySelector('.user-logged, .base-dropdown-header__user__name, [class*="user-logged"]');
            if (back)
                return;
            await new Promise(r => setTimeout(r, 120));
        }

        // Đến đây mới coi như logout thật.
        if (hadName) {
            // Giữ tên cũ trên UI cho đến khi lần sau lấy được tên mới
            // (KHÔNG gọi updateUsername('') để không hiển thị (?))
        } else {
            // Chưa từng có tên → để panel hiển thị (?)
        }
        // Balance cũng không "đè 88" nếu không chắc
    }

    // === DOM Ready helper (thêm mới) ===
    function onDomReady(cb) {
        const ready = document.readyState;
        if (ready === 'interactive' || ready === 'complete') {
            try {
                cb();
            } catch (e) {
                console.error('[HomeWatch] onDomReady cb error', e);
            }
            return;
        }
        const done = () => {
            document.removeEventListener('DOMContentLoaded', done);
            document.removeEventListener('readystatechange', rs);
            try {
                cb();
            } catch (e) {
                console.error('[HomeWatch] onDomReady cb error', e);
            }
        };
        const rs = () => {
            const s = document.readyState;
            if (s === 'interactive' || s === 'complete')
                done();
        };
        document.addEventListener('DOMContentLoaded', done, {
            once: true
        });
        document.addEventListener('readystatechange', rs);
    }

    // Tail -> CSS
    function cssFromTail(tail) {
        const segs = String(tail || '').trim().split('/').filter(Boolean).map(seg => {
            const m = seg.match(/^([a-zA-Z0-9_-]+)((?:\.[a-zA-Z0-9_-]+)*)?(?:\[(\d+)\])?$/);
            if (!m)
                return seg;
            const tag = m[1],
            cls = (m[2] || ''),
            nth = m[3] ? `:nth-of-type(${m[3]})` : '';
            return `${tag}${cls}${nth}`;
        });
        return segs.join(' > ');
    }
    function findByTail(tail) {
        try {
            return document.querySelector(cssFromTail(tail));
        } catch (_) {
            return null;
        }
    }

    function findByTailIn(tail, rootDoc) {
        try {
            const css = cssFromTail(tail);
            const doc = rootDoc || document;
            return doc.querySelector(css);
        } catch (_) {
            return null;
        }
    }

    function setInputValue(el, val) {
        if (!el)
            return false;
        const next = val == null ? '' : String(val);
        if (el.value !== next) {
            try {
                el.focus({
                    preventScroll: true
                });
            } catch (_) {}
            el.value = next;
        }
        try {
            el.dispatchEvent(new Event('input', {
                bubbles: true
            }));
        } catch (_) {}
        try {
            el.dispatchEvent(new Event('change', {
                bubbles: true
            }));
        } catch (_) {}
        return true;
    }

    function setCheckboxState(el, checked) {
        if (!el)
            return false;
        const next = !!checked;
        if (el.checked !== next)
            el.checked = next;
        try {
            el.dispatchEvent(new Event('input', {
                bubbles: true
            }));
        } catch (_) {}
        try {
            el.dispatchEvent(new Event('change', {
                bubbles: true
            }));
        } catch (_) {}
        return true;
    }

    function getLoginPopupRoot() {
        let root = null;
        try {
            if (typeof TAIL_LOGIN_POPUP_ROOT === 'string' && TAIL_LOGIN_POPUP_ROOT) {
                root = findByTail(TAIL_LOGIN_POPUP_ROOT);
                if (root && root.isConnected)
                    return root;
            }
        } catch (_) {}
        try {
            root = document.querySelector(LOGIN_POPUP_SELECTOR);
            if (root && root.isConnected)
                return root;
        } catch (_) {}
        try {
            const pwParent = Array.from(document.querySelectorAll('input[type="password"]'))
                .map((i) => {
                    try {
                        return i.closest(LOGIN_POPUP_SELECTOR);
                    } catch (_) {
                        return null;
                    }
                })
                .find(Boolean);
            if (pwParent && pwParent.isConnected)
                return pwParent;
        } catch (_) {}
        return document.body || document.documentElement || document;
    }

    function resolveLoginField(tail, fallbackSelector) {
        const tails = Array.isArray(tail) ? tail : (tail ? [tail] : []);
        for (const t of tails) {
            try {
                if (!t)
                    continue;
                const el = findByTail(t);
                if (el && el.isConnected)
                    return el;
            } catch (_) {}
        }
        if (!fallbackSelector)
            return null;
        const root = getLoginPopupRoot();
        let el = null;
        try {
            el = root && root.querySelector(fallbackSelector);
        } catch (_) {}
        if (el && el.isConnected)
            return el;
        try {
            el = document.querySelector(fallbackSelector);
        } catch (_) {
            el = null;
        }
        return (el && el.isConnected) ? el : null;
    }

    function fillLoginField(tail, fallbackSelector, value) {
        const el = resolveLoginField(tail, fallbackSelector);
        return setInputValue(el, value);
    }

    function syncRememberFlag(checked) {
        if (typeof checked !== 'boolean')
            return false;
        const sel = 'input[type="checkbox"][name*="remember" i], input[type="checkbox"][id*="remember" i], input[type="checkbox"][ng-model*="remember" i], .remember input[type="checkbox"], input[type="checkbox"]';
        const el = resolveLoginField(TAIL_LOGIN_REMEMBER_INPUT, sel);
        return setCheckboxState(el, checked);
    }

    function handleSetLoginCommand(payload) {
        try {
            const info = payload || {};
            const user = (info.user ?? info.username ?? '') || '';
            const pass = (info.pass ?? info.password ?? '') || '';
            const code = (info.code ?? info.captcha ?? '') || '';
            const remember = info.remember;

            fillLoginField(TAIL_LOGIN_USER_INPUT,
                'input[name="username"], input[name="account"], input[placeholder*="đăng" i], input[placeholder*="tài khoản" i], input[placeholder*="dang" i], input[type="text"]',
                user);
            fillLoginField(TAIL_LOGIN_PASS_INPUT, 'input[type="password"]', pass);
            fillLoginField(TAIL_LOGIN_CAPTCHA_INPUTS, LOGIN_CAPTCHA_FALLBACK_SELECTOR, code);
            if (typeof remember === 'boolean')
                syncRememberFlag(remember);
        } catch (err) {
            console.warn('[HomeWatch] set_login error', err);
        }
    }

    function focusLoginCaptchaField() {
        const el = resolveLoginField(TAIL_LOGIN_CAPTCHA_INPUTS, LOGIN_CAPTCHA_FALLBACK_SELECTOR);
        if (!el)
            return false;
        const hasValue = typeof el.value === 'string' && el.value.trim().length > 0;
        if (hasValue)
            return false;
        try {
            peelAndClick(el, {
                holdMs: 200
            });
        } catch (_) {}
        try {
            el.focus({
                preventScroll: true
            });
        } catch (_) {
            try {
                el.focus();
            } catch (_) {}
        }
        try {
            el.click();
        } catch (_) {}
        try {
            if (typeof el.select === 'function')
                el.select();
        } catch (_) {}
        return true;
    }

    // NEW: nhận biết popup đăng nhập đã hiển thị hay chưa
    function isLoginPopupVisible() {
        try {
            if (typeof TAIL_LOGIN_POPUP_ROOT === 'string' && TAIL_LOGIN_POPUP_ROOT) {
                const el = findByTail(TAIL_LOGIN_POPUP_ROOT);
                if (el && el.offsetParent !== null)
                    return true;
            }
            // fallback heuristics: một số class/modal phổ biến
            const el2 = document.querySelector(LOGIN_POPUP_SELECTOR);
            return !!(el2 && el2.offsetParent !== null);
        } catch (_) {
            return false;
        }
    }

    function findLoginButton() {
        // Ưu tiên tail cố định (header RR88 mới)
        let btn = null;
        try {
            if (typeof TAIL_LOGIN_BTN === 'string' && TAIL_LOGIN_BTN) {
                btn = findByTail(TAIL_LOGIN_BTN);
            }
        } catch (_) {}

        // Fallback: layout header mới
        if (!btn) {
            btn = document.querySelector('div.header .hd_login .submit_btn, header .hd_login .submit_btn');
        }

        // Fallback cũ: header.menu + nút base-button
        if (!btn) {
            btn = document.querySelector('header.menu .user-not-login .base-button.btn');
        }

        // Fallback cuối: quét theo text "Đăng nhập"
        if (!btn) {
            btn = Array.from(document.querySelectorAll('button, a, [role="button"], span.submit_btn'))
                .find(el => norm(textOf(el)).includes('dang nhap'));
        }

        return btn && btn.isConnected ? btn : null;
    }

    function canRunAuthLoop() {
        if (S.authGateOpened)
            return true;

        // ✅ MỞ CỔNG nếu nhận diện trạng thái đã login (không cần đợi thấy nút)
        const loggedInBlock = document.querySelector('.user-logged, .base-dropdown-header__user__name, .user__name');
        if (loggedInBlock && loggedInBlock.offsetParent !== null) {
            S.authGateOpened = true;
            return true;
        }

        // Cơ chế cũ: mở khi nhìn thấy nút Đăng nhập
        const btn = findLoginButton();
        if (btn)
            S.authGateOpened = true;

        return S.authGateOpened;
    }

    // ======= Panel =======
    function ensureRoot() {
        if (window.__abx_hw_installed)
            return;
        if ($panel()) {
            window.__abx_hw_installed = true;
            return;
        }
        // Nếu inject ở document_start, body có thể chưa có
        const mount = document.body || document.documentElement;
        if (!mount) {
            console.warn('[HomeWatch] ensureRoot: <body> chưa có, sẽ đợi DOM...');
            onDomReady(ensureRoot);
            return;
        }
        // Nếu cấu hình ẩn panel thì chỉ cần "ẩn nếu đã có" và thoát
        if (CFG.showPanel === false) {
            const maybe = document.getElementById('__abx_hw_root')
                 || document.querySelector('.abx-homewatch-root,[data-abx-root="homewatch"]');
            if (maybe)
                maybe.style.display = 'none';
            window.__abx_hw_installed = true; // ⬅️ đánh dấu đã cài, tránh gọi lại
            return;
        }

        const root = document.createElement('div');
        // đảm bảo dễ điều khiển/toggle bằng id & class cố định
        root.id = CFG.panelId; // sẽ là "__abx_hw_root" sau khi đổi ở Bước 1
        root.classList.add('abx-homewatch-root'); // class dấu hiệu (phòng khi id đổi)
        root.style.display = ''; // bật hiển thị khi showPanel === true

        root.id = CFG.panelId;
        root.style.cssText = [
            'position:fixed', 'left:16px', 'top:80px', 'min-width:720px', 'max-width:92vw',
            'background:#0b1120', 'color:#e5e7eb', 'border:1px solid #1e40af', 'border-radius:12px',
            'padding:10px 12px', 'font:12px/1.35 Consolas,ui-monospace,monospace',
            'z-index:' + ROOT_Z, 'box-shadow:0 8px 28px rgba(0,0,0,.45)', 'user-select:none'
        ].join(';');
        root.innerHTML = [
            '<div id="hwtitle" style="font-weight:700;margin-bottom:8px;cursor:move">Home Watch</div>',
            '<div id="hwbar" style="display:flex;gap:8px;align-items:center;margin-bottom:8px">',
            '  <button id="' + CFG.linksBtnId + '">LinksMap</button>',
            '  <button id="' + CFG.textsBtnId + '">TextMap</button>',
            '  <button id="' + CFG.closePopupBtnId + '">ClosePopup</button>',
            '  <button id="' + CFG.scanLinksBtnId + '">Scan200LinksMap</button>',
            '  <button id="' + CFG.scanTextsBtnId + '">Scan200TextMap</button>',
            '  <button id="' + CFG.scanClosePopupBtnId + '">Scan200ClosePopup</button>',
            '  <button id="' + CFG.loginBtnId + '">Click Đăng Nhập</button>',
            '  <button id="' + CFG.xocBtnId + '">Chơi Xóc Đĩa Live</button>',
            '  <button id="' + CFG.retryBtnId + '">Thử lại (tự động)</button>',
            '  <button id="' + CFG.overlayToggleBtnId + '">Overlay</button>',
            '  <button id="' + CFG.copyInfoBtnId + '">Copy Info</button>',
            '</div>',
            '<div style="display:flex;gap:6px;align-items:center;margin-bottom:6px">',
            '  <span style="opacity:.8">URL:</span><input id="' + CFG.urlId + '" value="" placeholder="https://..." ',
            '     style="flex:1;min-width:300px;background:#0b122e;border:1px solid #334155;color:#e5e7eb;padding:6px 8px;border-radius:6px">',
            '  <button id="bgo">Go</button>',
            '</div>',
            '<div id="' + CFG.infoId + '" style="white-space:pre;min-height:98px;padding:8px;background:#0b122e;border:1px dashed #334155;border-radius:8px"></div>'
        ].join('');
        mount.appendChild(root);
        window.__abx_hw_installed = true;
        root.querySelectorAll('button').forEach(b => {
            b.style.cssText = 'background:#0b122e;border:1px solid #334155;color:#e5e7eb;padding:6px 10px;border-radius:8px;cursor:pointer';
            b.addEventListener('mouseenter', () => b.style.borderColor = '#60a5fa');
            b.addEventListener('mouseleave', () => b.style.borderColor = '#334155');
            // Không cho kéo panel khi bấm nút
            b.addEventListener('pointerdown', e => e.stopPropagation());
        });

        // Devtools-lite: cho phép chạy JS tùy ý và xem kết quả (trong top window)
        (function attachDevRunner() {
            if (root.querySelector('#hw_dev_runner'))
                return;
            const wrap = document.createElement('div');
            wrap.id = 'hw_dev_runner';
            wrap.style.marginTop = '8px';

            const ta = document.createElement('textarea');
            ta.id = 'hw_dev_code';
            ta.placeholder = 'Dán JS rồi bấm Run (chạy trong top window)';
            ta.style.width = '100%';
            ta.style.height = '82px';
            ta.style.background = '#0b122e';
            ta.style.border = '1px solid #334155';
            ta.style.color = '#e5e7eb';
            ta.style.borderRadius = '8px';
            ta.style.padding = '6px 8px';
            ta.style.font = '12px/1.35 Consolas,ui-monospace,monospace';

            const btnRow = document.createElement('div');
            btnRow.style.display = 'flex';
            btnRow.style.gap = '6px';
            btnRow.style.marginTop = '4px';

            const btn = document.createElement('button');
            btn.textContent = 'Run JS';
            btn.style.background = '#0b122e';
            btn.style.border = '1px solid #334155';
            btn.style.color = '#e5e7eb';
            btn.style.padding = '6px 10px';
            btn.style.borderRadius = '8px';
            btn.style.cursor = 'pointer';

            const btnCopy = document.createElement('button');
            btnCopy.textContent = 'Copy';
            btnCopy.style.background = '#0b122e';
            btnCopy.style.border = '1px solid #334155';
            btnCopy.style.color = '#e5e7eb';
            btnCopy.style.padding = '6px 10px';
            btnCopy.style.borderRadius = '8px';
            btnCopy.style.cursor = 'pointer';

            const out = document.createElement('pre');
            out.id = 'hw_dev_output';
            out.style.maxHeight = '140px';
            out.style.overflow = 'auto';
            out.style.background = '#0b122e';
            out.style.color = '#22c55e';
            out.style.padding = '6px 8px';
            out.style.border = '1px dashed #334155';
            out.style.borderRadius = '8px';
            out.style.whiteSpace = 'pre-wrap';
            out.style.marginTop = '4px';
            out.textContent = 'Kết quả sẽ hiển thị ở đây...';

            const dump = (val) => {
                try {
                    return JSON.stringify(val, null, 2);
                } catch (_) {
                    try {
                        return String(val);
                    } catch (_) {
                        return Object.prototype.toString.call(val);
                    }
                }
            };

            btn.onclick = () => {
                try {
                    const code = ta.value || '';
                    const val = eval(code);
                    out.textContent = dump(val);
                } catch (e) {
                    out.textContent = 'Error: ' + e;
                }
            };

            btnCopy.onclick = async() => {
                try {
                    const txt = out.textContent || '';
                    if (navigator?.clipboard?.writeText) {
                        await navigator.clipboard.writeText(txt);
                    } else {
                        const taTmp = document.createElement('textarea');
                        taTmp.value = txt;
                        document.body.appendChild(taTmp);
                        taTmp.select();
                        document.execCommand('copy');
                        document.body.removeChild(taTmp);
                    }
                    out.textContent = txt || '(đã copy chuỗi rỗng)';
                } catch (e) {
                    out.textContent = 'Copy error: ' + e;
                }
            };

            wrap.appendChild(ta);
            btnRow.appendChild(btn);
            btnRow.appendChild(btnCopy);
            wrap.appendChild(btnRow);
            wrap.appendChild(out);
            root.appendChild(wrap);
        })();

        // drag bằng title
        (function () {
            const bar = root.querySelector('#hwtitle');
            if (!bar) {
                console.warn('[HomeWatch] ensureRoot: thiếu #hwtitle');
                return;
            }
            let down = false,
            ox = 0,
            oy = 0;
            bar.addEventListener('pointerdown', e => {
                down = true;
                ox = e.clientX - root.offsetLeft;
                oy = e.clientY - root.offsetTop;
                bar.setPointerCapture(e.pointerId);
            });
            bar.addEventListener('pointermove', e => {
                if (!down)
                    return;
                root.style.left = (e.clientX - ox) + 'px';
                root.style.top = (e.clientY - oy) + 'px';
            });
            bar.addEventListener('pointerup', e => {
                down = false;
                try {
                    bar.releasePointerCapture(e.pointerId);
                } catch (_) {}
            });
        })();

        // events
        root.querySelector('#bgo').onclick = () => {
            const u = root.querySelector('#' + CFG.urlId).value.trim();
            if (/^https?:\/\//i.test(u))
                location.href = u;
        };
        root.querySelector('#' + CFG.linksBtnId).onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            clearSelected();
            toggle('link');
        };
        root.querySelector('#' + CFG.textsBtnId).onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            clearSelected();
            toggle('text');
        };
        root.querySelector('#' + CFG.closePopupBtnId).onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            clearSelected();

            // Khi bấm ClosePopup: thử đóng tất cả popup / overlay hiện có
            try {
                console.debug('[HomeWatch] ClosePopup button -> closeAdsAndCovers()');
                closeAdsAndCovers();
            } catch (_) {}

            // Vẫn bật overlay popup map để bạn nhìn được vùng đã xử lý
            toggle('popup');
        };

        root.querySelector('#' + CFG.scanLinksBtnId).onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            scanLinks(500);
            requestFrameScan('link', 500);
        };
        root.querySelector('#' + CFG.scanTextsBtnId).onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            scanTexts(500);
            requestFrameScan('text', 500);
        };
        root.querySelector('#' + CFG.scanClosePopupBtnId).onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            scanClosePopups(500);
            requestFrameScan('popup', 500);
        };
        root.querySelector('#' + CFG.overlayToggleBtnId).onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const ov = $overlay();
            if (ov)
                ov.style.display = (ov.style.display === 'none' ? 'block' : 'none');
        };

        root.querySelector('#' + CFG.copyInfoBtnId).onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            copyInfoBox(); // gọi hàm copy bên dưới
        };
        root.querySelector('#' + CFG.retryBtnId).onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!isGameHost()) {
                startAutoRetry(true);
            } else {
                updateInfo('⚠ Đang ở trang game — bỏ qua auto-retry để tránh request /account/* trên game host.');
            }
        };
        root.querySelector('#' + CFG.loginBtnId).onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            S.fetchDone = false;
            S.inflightProbe = false;
            S.retries = 0;
            clickLoginButton();
        };
        root.querySelector('#' + CFG.xocBtnId).onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            clickXocDiaLive();
        };

        const ubox = root.querySelector('#' + CFG.urlId);
        if (ubox)
            ubox.value = location.href;
    }

    (function hookHistory() {
        if (window.__abx_hist_hooked)
            return;
        window.__abx_hist_hooked = true;
        const rawPush = history.pushState,
        rawReplace = history.replaceState;
        function wrap(fn) {
            return function () {
                const r = fn.apply(this, arguments);
                try {
                    onAuthStateMaybeChanged('history');
                    pumpAuthProbe(6000, 200); // ⬅️ bơm đọc 6s sau mỗi điều hướng SPA
                } catch (_) {}
                return r;
            };
        }

        if (typeof rawPush === 'function')
            history.pushState = wrap(rawPush);
        if (typeof rawReplace === 'function')
            history.replaceState = wrap(rawReplace);
        addEventListener('popstate', () => {
            try {
                onAuthStateMaybeChanged('popstate');
                pumpAuthProbe(6000, 200); // ⬅️ bơm 6s sau thao tác back/forward
            } catch (_) {}
        }); // back/forward

    })();

    function updateInfo(extra) {
        if (CFG.showPanel === false)
            return; // panel đang ẩn -> bỏ qua render
        // Tính trạng thái hiển thị thật sự của khu vực xóc đĩa
        const live = (() => {
            const s = document.querySelector('.livestream-section__live');
            return !!(s && s.offsetParent !== null);
        })();
        const loggedIn = isLoggedInFromDOM();
        const balText = S.balance ? S.balance : (loggedIn ? '0' : '(?)');
        const L = [
            '• URL : ' + location.href,
            '• Tên nhân vật: ' + (S.username ? S.username : '(?)'),
            '• Tài khoản: ' + balText,
            '• Title: ' + document.title,
            '• Has Xóc Đĩa: ' + String(live)
        ];

        if (extra)
            L.push('', extra);

        const box = document.getElementById(CFG.infoId);
        if (box)
            box.textContent = L.join('\n');

        const u = document.getElementById(CFG.urlId);
        if (u)
            u.value = location.href;
    }

    function copyInfoBox() {
        try {
            const box = document.getElementById(CFG.infoId);
            if (!box)
                return;

            const txt = (box.innerText || box.textContent || '').trim();
            if (!txt)
                return;

            // Ưu tiên Clipboard API
            if (navigator && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
                navigator.clipboard.writeText(txt).catch(() => { /* nuốt lỗi */
                });
            } else {
                // Fallback execCommand cho WebView2 / trình duyệt cũ
                const ta = document.createElement('textarea');
                ta.value = txt;
                ta.setAttribute('readonly', 'readonly');
                ta.style.position = 'fixed';
                ta.style.left = '-9999px';
                ta.style.top = '0';
                document.body.appendChild(ta);
                ta.select();
                try {
                    document.execCommand('copy');
                } catch (_) {}
                document.body.removeChild(ta);
            }
        } catch (_) {}
    }

    // === Automino Home <-> C# bridge (non-intrusive) ===
    (function () {
        try {
            // Gửi an toàn lên host (WebView2)
            function safePost(d) {
                try {
                    if (window.chrome && chrome.webview && typeof chrome.webview.postMessage === 'function') {
                        try {
                            chrome.webview.postMessage(JSON.stringify(d));
                        } catch (_) {}
                    } else {
                        try {
                            parent.postMessage(d, '*');
                        } catch (_) {}
                    }
                } catch (_) {}
            }

            // Lấy state hiện tại để C# có thể poll
            window.__abx_hw_getState = function () {
                try {
                    // ---- Fallback DOM: đọc nhanh trong header khi S.* đang rỗng ----
                    function quickPickUsername() {
                        try {
                            // 1) ƯU TIÊN: đọc theo ABS_USERNAME_TAIL (tên nhân vật trên trang profile)
                            if (typeof ABS_USERNAME_TAIL === 'string' && ABS_USERNAME_TAIL) {
                                try {
                                    const elAbs = findByTail(ABS_USERNAME_TAIL);
                                    if (elAbs) {
                                        const val = (elAbs.value != null
                                             ? String(elAbs.value)
                                             : (elAbs.getAttribute && elAbs.getAttribute('value')) || elAbs.textContent || '').trim();
                                        if (val)
                                            return val.replace(/\s+/g, ' ');
                                    }
                                } catch (_) {}
                            }

                            // 2) Fallback: lấy theo header như trước (khi không có form profile)
                            const header = document.querySelector('header.menu, header') || document;

                            const pri = header.querySelector(
                                    '.user-logged__info .base-dropdown-header__user__name, p.base-dropdown-header__user__name');
                            if (pri) {
                                const t = (pri.textContent || '').trim();
                                if (t)
                                    return t;
                            }

                            const roots = [
                                '.username',
                                '.menu-account__info--user',
                                '.user-logged',
                                '.display-name',
                                '.full-name'
                            ];
                            for (const sel of roots) {
                                const el = header.querySelector(
                                        sel + ' .full-name, ' +
                                        sel + ' .display-name, ' +
                                        sel + ' span.full-name, ' +
                                        sel);
                                if (el) {
                                    const txt = (el.textContent || '').trim();
                                    if (txt && !/^(vip|email|đăng|login)/i.test(txt))
                                        return txt;
                                }
                            }
                        } catch (_) {}
                        return '';
                    }
                    function quickPickBalance() {
                        try {
                            const header = document.querySelector('header.menu, header') || document;
                            const el = header.querySelector('.base-dropdown-header__user__amount, .user__amount, .user-amount, .balance, [class*="amount"]');
                            if (el) {
                                const raw = (el.textContent || '').replace(/\s+/g, ' ').trim();
                                const m = raw.match(/(\d{1,3}(?:[.,]\d{3})+|\d{1,})(?:\s*(VND|đ|₫|k|K|m|M))?/);
                                if (m)
                                    return m[1].replace(/[^\d]/g, '');
                            }
                        } catch (_) {}
                        return '';
                    }

                    const u = (typeof S !== 'undefined' && S.username) || quickPickUsername() || '';
                    const b = (typeof S !== 'undefined' && S.balance) || quickPickBalance() || '';

                    return {
                        abx: 'home_state',
                        username: String(u || ''),
                        balance: String(b || ''),
                        href: String(location.href || ''),
                        title: String(document.title || ''),
                        ts: Date.now()
                    };
                } catch (_) {
                    return {
                        abx: 'home_state',
                        username: '',
                        balance: '',
                        href: String(location.href || ''),
                        title: String(document.title || ''),
                        ts: Date.now()
                    };
                }
            };
            // Đẩy một gói ngay lập tức
            window.__abx_hw_pushNow = function () {
                try {
                    var st = (typeof window.__abx_hw_getState === 'function') ? window.__abx_hw_getState() : null;
                    if (st) {
                        st.abx = 'home_tick';
                        // dùng kênh gửi an toàn đã có
                        if (window.chrome && chrome.webview && typeof chrome.webview.postMessage === 'function') {
                            chrome.webview.postMessage(JSON.stringify(st));
                        } else {
                            parent.postMessage(st, '*');
                        }
                    }
                } catch (_) {}
            };

            // Đẩy định kỳ state về C#
            window.__abx_hw_startPush = function (intervalMs) {
                try {
                    intervalMs = Math.max(300, Math.floor(+intervalMs || 800));
                    if (window.__hw_pushTid) {
                        clearInterval(window.__hw_pushTid);
                        window.__hw_pushTid = 0;
                    }
                    window.__hw_pushTid = setInterval(function () {
                        try {
                            var st = (typeof window.__abx_hw_getState === 'function') ? window.__abx_hw_getState() : null;
                            if (st) {
                                st.abx = 'home_tick';
                                safePost(st);
                            }
                        } catch (_) {}
                    }, intervalMs);
                    try {
                        window.__abx_hw_pushNow && window.__abx_hw_pushNow();
                    } catch (_) {}
                    return true;
                } catch (_) {
                    return false;
                }
            };

            window.__abx_hw_stopPush = function () {
                try {
                    if (window.__hw_pushTid) {
                        clearInterval(window.__hw_pushTid);
                        window.__hw_pushTid = 0;
                    }
                } catch (_) {}
            };
        } catch (_) {}
    })();

    window.__cw_focusCaptcha = focusLoginCaptchaField;
    window.__cw_isLoggedInFromDom = isLoggedInFromDOM;
    window.__cw_isLoginPopupVisible = isLoginPopupVisible;

    // ===== Public APIs để C# gọi theo "hàm" =====
    window.__abx_hw_clickLogin = function () {
        try {
            if (typeof clickLoginButton === 'function') {
                clickLoginButton();
                if (typeof onAuthStateMaybeChanged === 'function')
                    onAuthStateMaybeChanged('api-login');
                if (typeof isGameHost === 'function' && !isGameHost() && typeof startAutoRetry === 'function')
                    startAutoRetry(true);
                return 'ok';
            }
            return 'no-fn';
        } catch (e) {
            return 'err:' + (e && e.message || e);
        }
    };

    window.__abx_hw_clickPlayXDL = function () {
        try {
            if (typeof clickBaccNhieuBanFromHome === 'function') {
                var p = clickBaccNhieuBanFromHome();
                if (p && typeof p.then === 'function') {
                    p.catch(function (e) {
                        console.warn('[__abx_hw_clickPlayXDL]', e);
                    });
                }
                return 'ok';
            }
            return 'no-fn';
        } catch (e) {
            return 'err:' + (e && e.message || e);
        }
    };

    // ===== Nghe lệnh từ host để "gọi theo nút" =====
    // (C# sẽ PostWebMessageAsJson({cmd: '...'}) xuống đây)
    if (window.chrome && window.chrome.webview && !window.__abx_cmd_listener) {
        window.__abx_cmd_listener = true;
        window.chrome.webview.addEventListener('message', (e) => {
            let payload = {};
            try {
                payload = (typeof e.data === 'string') ? JSON.parse(e.data) : (e && e.data) || {};
            } catch (_) {
                payload = (e && e.data) || {};
            }
            if (!payload || typeof payload !== 'object')
                payload = {};
            const cmdRaw = payload.cmd || payload.__cw_cmd || '';
            const cmd = String(cmdRaw || '');
            switch (cmd) {
            case 'home_click_login':
                try {
                    if (typeof clickLoginButton === 'function')
                        clickLoginButton();
                    if (typeof onAuthStateMaybeChanged === 'function')
                        onAuthStateMaybeChanged('host-login');
                    if (typeof isGameHost === 'function' && !isGameHost() && typeof startAutoRetry === 'function')
                        startAutoRetry(true);
                } catch (_) {}
                break;
            case 'home_click_xoc':
                try {
                    if (typeof clickBaccNhieuBanFromHome === 'function') {
                        var p2 = clickBaccNhieuBanFromHome();
                        if (p2 && typeof p2.catch === 'function') {
                            p2.catch(function (e) {
                                console.warn('[host-msg home_click_xoc]', e);
                            });
                        }
                    }
                } catch (_) {}
                break;
            case 'home_start_push':
                try {
                    const ms = (payload && payload.ms) || 800;
                    if (typeof window.__abx_hw_startPush === 'function')
                        window.__abx_hw_startPush(ms);
                } catch (_) {}
                break;
            case 'set_login':
            case 'home_set_login':
                handleSetLoginCommand(payload);
                break;
            case 'focus_captcha':
            case 'home_focus_captcha':
            case 'focus_code':
                focusLoginCaptchaField();
                break;
            }
        });
    }

    // ======= Overlay / Map =======
    function ensureOverlay() {
        // Nếu đã có overlay thì dùng lại
        let ov = $overlay();
        if (!ov) {
            // Tạo host overlay
            ov = document.createElement('div');
            ov.id = CFG.overlayId;
            ov.style.cssText = 'position:fixed;left:0;top:0;right:0;bottom:0;z-index:' + (ROOT_Z - 1) + ';pointer-events:none';

            // Fallback mount: body chưa có thì đợi DOM rồi gọi lại
            const mount = document.body || document.documentElement;
            if (!mount) {
                onDomReady(ensureOverlay);
                return null;
            }
            mount.appendChild(ov);
        }

        // Gắn listeners chỉ 1 lần (idempotent)
        if (!window.__abx_overlay_listeners) {
            window.__abx_overlay_listeners = true;

            const rerender = () => {
                try {
                    if (typeof window.__abx_overlay_rerender === 'function') {
                        window.__abx_overlay_rerender();
                    }
                } catch (_) {}
            };

            // Cập nhật overlay khi cuộn / đổi kích thước / tab quay lại
            window.addEventListener('scroll', rerender, {
                passive: true
            });
            window.addEventListener('resize', rerender, {
                passive: true
            });
            document.addEventListener('visibilitychange', () => {
                if (!document.hidden)
                    rerender();
            });
        }

        return ov;
    }

    function clearOverlay(kind) {
        const ov = ensureOverlay();
        if (ov)
            ov.innerHTML = '';
        if (kind) {
            S.items[kind] = [];
        } else {
            S.items.link = [];
            S.items.text = [];
            S.items.popup = []; // NEW
        }
    }

    function mkBadge(n) {
        const b = document.createElement('div');
        b.textContent = String(n);
        b.style.cssText = ['position:absolute', 'top:-8px', 'left:-8px', 'padding:2px 5px', 'font-size:10px', 'line-height:1', 'background:#0b1120', 'color:#e5e7eb', 'border:1px solid #60a5fa', 'border-radius:999px', 'pointer-events:none', 'box-shadow:0 0 0 1px rgba(0,0,0,.3)'].join(';');
        return b;
    }
    function mkBox(item, kind) {
        const d = document.createElement('div');
        d.className = CFG.highlightCls + ' ' + (kind === 'link' ? '__abx_link' : '__abx_text');
        d.style.cssText = ['position:absolute', 'border:1px dashed #60a5fa', 'border-radius:4px', 'box-sizing:border-box', 'left:' + item.rect.x + 'px', 'top:' + item.rect.y + 'px', 'width:' + item.rect.w + 'px', 'height:' + item.rect.h + 'px', 'pointer-events:auto', 'background:rgba(59,130,246,.08)'].join(';');
        d.dataset.id = item.idx;
        d.dataset.ord = item.ord || '';
        d.appendChild(mkBadge(item.ord || ''));
        d.addEventListener('mouseenter', () => showInfo(kind, item));
        // Click box không làm panel di chuyển
        d.addEventListener('click', (ev) => {
            ev.stopPropagation();
            selectBox(d);
        });
        return d;
    }
    function selectBox(d) {
        if (S.selected) {
            S.selected.classList.remove(CFG.selectedCls);
            S.selected.style.border = '1px dashed #60a5fa';
        }
        d.classList.add(CFG.selectedCls);
        d.style.border = '2px solid #ef4444';
        S.selected = d;
    }
    function clearSelected() {
        if (!S.selected)
            return;
        S.selected.style.border = '1px dashed #60a5fa';
        S.selected.classList.remove(CFG.selectedCls);
        S.selected = null;
    }

    function collectLinks() {
        const arr = [];
        let i = 0;
        document.querySelectorAll('a,button,[role="button"],[onclick],input[type="submit"],input[type="button"]').forEach(el => {
            const r = rectOf(el);
            if (r.w <= 0 || r.h <= 0)
                return;
            arr.push({
                idx: ++i,
                el,
                rect: r,
                tag: el.tagName.toLowerCase(),
                href: (el.getAttribute('href') || '')
            });
        });
        return arr;
    }
    function collectTexts() {
        if (!document.body)
            return [];
        const arr = [];
        let i = 0;
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
            acceptNode: n => (n.nodeValue || '').trim().length > 0 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP
        });
        let node;
        while (node = walker.nextNode()) {
            const el = node.parentElement;
            if (!el)
                continue;
            const r = rectOf(el);
            if (r.w <= 0 || r.h <= 0)
                continue;
            arr.push({
                idx: ++i,
                el,
                rect: r,
                tag: el.tagName.toLowerCase(),
                text: (node.nodeValue || '').trim()
            });
        }
        // ===== DEEP SOURCES: thêm "text chìm" =====
        // helper: push item text cho cùng element, có gắn nguồn (src)
        function pushDeep(el, text, srcTag) {
            const t = (text || '').toString().trim();
            if (!t)
                return;
            const r = rectOf(el);
            if (r.w <= 0 || r.h <= 0)
                return; // vẫn ưu tiên phần tử có hình chữ nhật hiển thị
            arr.push({
                idx: ++i,
                el,
                rect: r,
                tag: el.tagName.toLowerCase(),
                text: t,
                src: srcTag || 'deep'
            });
        }

        // 1) IMG alt/title
        document.querySelectorAll('img[alt], img[title]').forEach(img => {
            if (img.hasAttribute('alt'))
                pushDeep(img, img.getAttribute('alt'), 'img@alt');
            if (img.hasAttribute('title'))
                pushDeep(img, img.getAttribute('title'), 'img@title');
        });

        // 2) Bất kỳ phần tử có title
        document.querySelectorAll('[title]').forEach(el => {
            // tránh lặp lại với IMG (đã lấy bên trên)
            if (el.tagName.toLowerCase() === 'img')
                return;
            pushDeep(el, el.getAttribute('title'), 'el@title');
        });

        // 3) ARIA: aria-label / aria-labelledby
        document.querySelectorAll('[aria-label], [aria-labelledby]').forEach(el => {
            const ariaLabel = el.getAttribute('aria-label') || '';
            if (ariaLabel)
                pushDeep(el, ariaLabel, 'aria-label');
            const ref = el.getAttribute('aria-labelledby');
            if (ref) {
                const txt = ref.split(/\s+/).map(id => {
                    const t = document.getElementById(id);
                    return t ? (t.innerText || t.textContent || '') : '';
                }).join(' ').replace(/\s+/g, ' ').trim();
                if (txt)
                    pushDeep(el, txt, 'aria-labelledby');
            }
        });

        // 4) INPUT/TEXTAREA/SELECT: placeholder, value, option selected
        document.querySelectorAll('input, textarea, select').forEach(el => {
            const tag = el.tagName.toLowerCase();
            const ph = el.getAttribute('placeholder');
            if (ph)
                pushDeep(el, ph, tag + '@placeholder');

            if (tag === 'input' || tag === 'textarea') {
                const v = el.value != null ? String(el.value) : '';
                if (v)
                    pushDeep(el, v, tag + '@value');
            } else if (tag === 'select') {
                const opt = el.selectedIndex >= 0 ? el.options[el.selectedIndex] : null;
                const optText = opt ? (opt.text || '').trim() : '';
                if (optText)
                    pushDeep(el, optText, 'select@selected');
            }
        });

        // 5) DATA-* label thường gặp
        document.querySelectorAll('[data-label],[data-title],[data-text],[data-name]').forEach(el => {
            ['data-label', 'data-title', 'data-text', 'data-name'].forEach(k => {
                if (el.hasAttribute(k))
                    pushDeep(el, el.getAttribute(k), k);
            });
        });

        // 6) Pseudo-element ::before / ::after (nếu có content)
        function unquote(s) {
            const m = /^['"](.*)['"]$/.exec(s || '');
            return m ? m[1] : s;
        }
        document.querySelectorAll('body *').forEach(el => {
            // bỏ qua các node quá lớn để tránh chậm (có thể giữ nguyên nếu cần)
            if (!(el instanceof HTMLElement))
                return;
            const cs = getComputedStyle(el, '::before').content;
            if (cs && cs !== 'none')
                pushDeep(el, unquote(cs), '::before');
            const ca = getComputedStyle(el, '::after').content;
            if (ca && ca !== 'none')
                pushDeep(el, unquote(ca), '::after');
        });

        return arr;
    }

    // NEW: thu thập các popup/modal lớn đang che màn hình (quảng cáo, thông báo,...)
    function collectPopups() {
        if (!document.body)
            return [];
        const arr = [];
        let i = 0;
        const panel = $panel();
        const ov = $overlay();
        const vw = Math.max(innerWidth, document.documentElement.clientWidth || 0);
        const vh = Math.max(innerHeight, document.documentElement.clientHeight || 0);
        const screenArea = Math.max(1, vw * vh);

        document.querySelectorAll('body *').forEach(el => {
            if (!(el instanceof HTMLElement))
                return;
            if (panel && (panel.contains(el) || el.contains(panel)))
                return;
            if (ov && (ov.contains(el) || el.contains(ov)))
                return;

            const cs = getComputedStyle(el);
            if (!/(fixed|absolute|sticky)/.test(cs.position))
                return;
            if (cs.display === 'none' || cs.visibility === 'hidden')
                return;
            if (parseFloat(cs.opacity || '1') <= 0)
                return;

            const r = rectOf(el);
            if (r.w <= 40 || r.h <= 40)
                return;

            const a = r.w * r.h;
            const ratio = a / screenArea;
            const cx = r.x + r.w / 2;
            const cy = r.y + r.h / 2;
            const centerish = (cx > vw * 0.2 && cx < vw * 0.8 && cy > vh * 0.15 && cy < vh * 0.85);

            // nhỏ quá và không nằm giữa màn hình thì bỏ
            if (!centerish && ratio < 0.05)
                return;

            const name = ((el.className || '') + ' ' + (el.id || '')).toLowerCase();
            const hasKeyword = /(modal|popup|dialog|overlay|backdrop|login|signin|sign-in|dangnhap|đăng\s*nhập|quangcao|banner)/.test(name);

            // nếu không có keyword thì yêu cầu to hơn
            if (!hasKeyword && ratio < 0.1)
                return;

            arr.push({
                idx: ++i,
                el,
                rect: r,
                tag: el.tagName.toLowerCase(),
                src: 'popup'
            });
        });

        return arr;
    }

    const assignOrder = (items) => {
        items.forEach((it, i) => it.ord = i + 1);
        return items;
    };

    function render(kind) {
        const ov = ensureOverlay();
        clearOverlay(kind);
        const items = (kind === 'link')
         ? collectLinks()
         : (kind === 'text'
             ? collectTexts()
             : collectPopups());
        items.sort(smallFirst);
        assignOrder(items);
        S.items[kind] = items;
        const draw = items.slice().reverse();
        draw.forEach(it => ov.appendChild(mkBox(it, kind)));
    }
    const renderLinks = () => render('link');
    const renderTexts = () => render('text');
    const renderPopups = () => render('popup'); // NEW

    // NEW: rerender overlay cho cả 3 map khi scroll/resize
    window.__abx_overlay_rerender = () => {
        try {
            clearOverlay();
            if (S.showL)
                renderLinks();
            if (S.showT)
                renderTexts();
            if (S.showP)
                renderPopups();
        } catch (_) {}
    };

    function toggle(kind) {
        ensureOverlay();
        clearSelected();
        if (kind === 'link') {
            S.showL = !S.showL;
            if (S.showL)
                renderLinks();
            else
                clearOverlay('link');
        } else if (kind === 'text') {
            S.showT = !S.showT;
            if (S.showT)
                renderTexts();
            else
                clearOverlay('text');
        } else if (kind === 'popup') {
            S.showP = !S.showP;
            if (S.showP)
                renderPopups();
            else
                clearOverlay('popup');
        }
    }

    function showInfo(kind, item) {
        try {
            const el = item && item.el ? item.el : null;
            if (!el)
                return;
            const r = rectOf(el);
            const txt = (item && item.text) ? clip(item.text, 140) : clip(textOf(el), 140);
            const src = item && item.src ? String(item.src) : 'visible';
            const info = [
                'Kind : ' + kind,
                'Tag  : ' + (el.tagName),
                'Class: ' + (el.className || '').toString(),
                'Href : ' + (el.getAttribute && el.getAttribute('href') || ''),
                'Src  : ' + src,
                'Text : ' + txt,
                'Rect : [' + [r.x, r.y, r.w, r.h].join(', ') + ']',
                'Tail : ' + cssTail(el)
            ].join('\n');
            updateInfo(info);
        } catch (_) {}
    }

    // ======= Scan200 theo thứ tự ord =======
    function getOrdered(kind) {
        let base;
        if (kind === 'link')
            base = collectLinks();
        else if (kind === 'text')
            base = collectTexts();
        else
            base = collectPopups();

        let list = (S.items[kind] && S.items[kind].length)
         ? S.items[kind].slice()
         : assignOrder(base.sort(smallFirst));

        list.sort((a, b) => (a.ord || 0) - (b.ord || 0));
        return list;
    }

    function scanLinks(limit) {
        const all = getOrdered('link');
        const list = all.slice(0, Math.max(1, Math.min(limit || 200, all.length)));
        console.group('[link] Scan ' + list.length + '/' + all.length);
        list.forEach(it => {
            const r = rectOf(it.el);
            console.log(
                '[link]',
                it.ord, '\t',
                "'" + clip(textOf(it.el), 140) + "'", '\t',
                "'" + (it.el.getAttribute('href') || '') + "'", '\t',
                r.x, r.y, r.w, r.h, '\t',
                "'" + cssTail(it.el) + "'");
        });

        try {
            console.table(list.map(it => {
                    const r = rectOf(it.el);
                    return {
                        index: it.ord,
                        text: clip(textOf(it.el), 60),
                        href: (it.el.getAttribute('href') || ''),
                        x: r.x,
                        y: r.y,
                        w: r.w,
                        h: r.h,
                        tail: cssTail(it.el)
                    };
                }));
        } catch (_) {}
        console.groupEnd();
    }
    function scanTexts(limit) {
        const all = getOrdered('text');
        const list = all.slice(0, Math.max(1, Math.min(limit || 200, all.length)));
        postHomeWatchLog({
            abx: 'textmap_scan',
            kind: 'text',
            count: list.length,
            raw: all.length,
            hasPanel: !!$panel(),
            section: 'scanTexts'
        });
        console.group('[text] Scan ' + list.length + '/' + all.length);
        list.forEach(it => {
            const r = rectOf(it.el);
            console.log(
                '[text]',
                it.ord, '\t',
                "'" + clip(it.text || textOf(it.el), 180) + "'", '\t',
                r.x, r.y, r.w, r.h, '\t',
                "'" + cssTail(it.el) + "'", '\t',
                '[' + (it.src || 'visible') + ']');
        });

        try {
            console.table(list.map(it => {
                    const r = rectOf(it.el);
                    return {
                        index: it.ord,
                        text: clip(it.text || textOf(it.el), 80),
                        src: it.src || 'visible',
                        x: r.x,
                        y: r.y,
                        w: r.w,
                        h: r.h,
                        tail: cssTail(it.el)
                    };
                }));
        } catch (_) {}
        console.groupEnd();
    }

    function scanClosePopups(limit) {
        const all = getOrdered('popup');
        const list = all.slice(0, Math.max(1, Math.min(limit || 200, all.length)));

        console.group('[popup] Scan ' + list.length + '/' + all.length);
        list.forEach(it => {
            const r = rectOf(it.el);
            console.log(
                '[popup]',
                it.ord, '\t',
                "'" + clip(it.text || textOf(it.el), 180) + "'", '\t',
                r.x, r.y, r.w, r.h, '\t',
                "'" + cssTail(it.el) + "'", '\t',
                '[' + (it.src || 'popup') + ']');
        });
        try {
            console.table(list.map(it => {
                    const r = rectOf(it.el);
                    return {
                        index: it.ord,
                        text: clip(it.text || textOf(it.el), 80),
                        src: it.src || 'popup',
                        x: r.x,
                        y: r.y,
                        w: r.w,
                        h: r.h,
                        tail: cssTail(it.el)
                    };
                }));
        } catch (_) {}
        console.groupEnd();
    }

    // Allow top window to ask iframes to scan and return results
    const describeFrame = (f) => {
        const info = {
            id: f.id || '',
            name: f.name || '',
            src: ''
        };
        try {
            info.src = f.getAttribute('src') || '';
        } catch (_) {}
        try {
            if (f.contentWindow && f.contentWindow.location) {
                info.current = String(f.contentWindow.location.href || '');
            }
        } catch (_) {
            info.current = '';
        }
        return info;
    };

    function logFrameScanDebug(message, extra) {
        try {
            const payload = Object.assign({
                abx: 'frame_scan_debug',
                href: String(location.href || ''),
                message: message
            }, extra || {});
            postHomeWatchLog(payload);
            console.debug('[frame_scan]', message, extra || '');
        } catch (_) {}
    }

    function requestFrameScan(kind, limit) {
        if (!IS_TOP)
            return;
        const frames = Array.from(document.querySelectorAll('iframe'));
        if (!frames.length)
            return;
        const reqId = 'fscan_' + Date.now().toString(36) + '_' + Math.random().toString(16).slice(2, 8);
        logFrameScanDebug('request', {
            kind,
            limit,
            reqId,
            frames: frames.map((f, idx) => Object.assign({ idx }, describeFrame(f)))
        });
        frames.forEach((f, idx) => {
            try {
                const w = f.contentWindow;
                if (w && w.postMessage) {
                    w.postMessage({
                        abx: 'hw_scan_req',
                        kind: kind || 'text',
                        limit: limit || 200,
                        reqId,
                        idx
                    }, '*');
                }
            } catch (_) {}
        });
    }

    window.__abx_hw_scanLinks = scanLinks;
    window.__abx_hw_scanTexts = scanTexts;
    window.__abx_hw_scanClosePopups = scanClosePopups;

    window.addEventListener('message', (evt) => {
        try {
            const d = evt && evt.data;
            if (!d || typeof d !== 'object')
                return;

            if (d.abx === 'hw_scan' && d.fn) {
                const fn = window[d.fn];
                if (typeof fn === 'function')
                    fn.call(window, d.limit);
                return;
            }

            if (d.abx === 'hw_scan_req') {
                const kind = d.kind || 'text';
                const limit = d.limit || 200;
                const ready = document.readyState;
                const hasBody = !!document.body;
                logFrameScanDebug('frame_collect_begin', {
                    kind,
                    limit,
                    reqId: d.reqId || '',
                    ready,
                    hasBody,
                    bodyChildren: hasBody ? document.body.childElementCount : 0
                });
                const all = getOrdered(kind === 'link' ? 'link' : kind === 'popup' ? 'popup' : 'text');
                const list = all.slice(0, Math.max(1, Math.min(limit, all.length)));
                const payload = {
                    abx: 'hw_scan_res',
                    kind,
                    count: list.length,
                    raw: all.length,
                    href: String(location.href || ''),
                    reqId: d.reqId || '',
                    readyState: ready,
                    hasBody,
                    bodyChildren: hasBody ? document.body.childElementCount : 0,
                    reason: hasBody ? (list.length ? 'ok' : 'empty') : 'no_body',
                    items: list.slice(0, 30).map(it => {
                        const r = rectOf(it.el);
                        return {
                            index: it.ord,
                            text: clip(it.text || textOf(it.el), 80),
                            src: it.src || (kind === 'popup' ? 'popup' : 'visible'),
                            x: r.x,
                            y: r.y,
                            w: r.w,
                            h: r.h,
                            tail: cssTail(it.el)
                        };
                    })
                };
                try {
                    if (evt.source && typeof evt.source.postMessage === 'function')
                        evt.source.postMessage(payload, '*');
                } catch (_) {}
                try {
                    postHomeWatchLog(payload);
                } catch (_) {}
            }
        } catch (_) {}
    }, false);

    if (IS_TOP) {
        window.addEventListener('message', (evt) => {
            try {
                const d = evt && evt.data;
                if (!d || typeof d !== 'object')
                    return;
                if (d.abx !== 'hw_scan_res')
                    return;
                logFrameScanDebug('frame_response', {
                    reqId: d.reqId || '',
                    kind: d.kind || 'text',
                    count: d.count || 0,
                    raw: d.raw || 0,
                    frameHref: d.href || '',
                    readyState: d.readyState || '',
                    hasBody: d.hasBody,
                    bodyChildren: d.bodyChildren,
                    reason: d.reason || ''
                });
                postHomeWatchLog({
                    abx: 'textmap_scan_frame',
                    kind: d.kind || 'text',
                    count: d.count || 0,
                    raw: d.raw || 0,
                    frameHref: d.href || '',
                    reqId: d.reqId || ''
                });
                try {
                    console.group(`[frame scan] ${d.href || ''}`);
                    console.table(d.items || []);
                    console.groupEnd();
                } catch (_) {}
            } catch (_) {}
        }, false);
    }

// ======= Username & Balance =======
    function findUserFromDOM() {
        try {
            // Ưu tiên tail tuyệt đối nếu có
            if (typeof ABS_USERNAME_TAIL === 'string' && ABS_USERNAME_TAIL) {
                const abs = findByTail(ABS_USERNAME_TAIL);
                const v = abs && (abs.value || abs.textContent || '').trim();
                if (isLikelyUsername(v))
                    return v;
            }

            // Quét các vị trí có thể chứa username thật sự (không quét label)
            const cand = document.querySelectorAll([
                        'header .user-logged .base-dropdown-header__user__name',
                        '.menu-account__info--user .display-name .full-name span',
                        '.menu-account__info--user .username .full-name span',
                        '.user-logged__info .user__name'
                    ].join(','));

            for (const el of cand) {
                const txt = textOf(el);
                if (isLikelyUsername(txt))
                    return txt;
            }

            return '';
        } catch (_) {
            return '';
        }
    }

    // --- Prefer fetch first; iframe is fallback ---
    async function tryFetchUserProfile() {
        if (isGameHost())
            return false;
        const urls = guessProfileUrls();
        for (const u of urls) {
            try {
                const res = await fetch(u, {
                    credentials: 'include'
                });
                if (!res.ok)
                    continue;

                const html = await res.text();
                const doc = new DOMParser().parseFromString(html, 'text/html');

                // --- Username (ƯU TIÊN ABS PATH) ---
                let name = '';
                try {
                    const abs = findByTailIn(ABS_USERNAME_TAIL, doc); // dùng trên tài liệu fetch được
                    if (abs) {
                        name = (abs.value != null ? String(abs.value)
                             : (abs.getAttribute && abs.getAttribute('value')) || abs.textContent || '').trim();
                    }
                } catch (_) {}

                if (!name) {
                    // fallback cũ theo class
                    const namePick = doc.querySelector('.base-dropdown-header__user__name, .full-name, .display-name, .username .full-name, [class*="display-name"]');
                    name = namePick ? (namePick.textContent || '').trim() : '';
                }
                if (name)
                    updateUsername(name);

                // --- Balance ---
                let bal = '';
                const balPick = doc.querySelector(
                        '.base-dropdown-header__user__amount, .user__amount, .user-amount, .balance, [class*="amount"]');
                if (balPick) {
                    const raw = (balPick.textContent || '').replace(/\s+/g, ' ').trim();
                    const m = raw.match(/(\d{1,3}(?:[.,]\d{3})+|\d{1,})(?:\s*(VND|đ|₫|k|K|m|M))?/);
                    if (m)
                        bal = m[1].replace(/[^\d]/g, '');
                }
                if (bal)
                    updateBalance(bal);

                if (name || bal)
                    return true; // lấy được ít nhất 1 thứ là coi như thành công
            } catch (_) { /* thử URL kế */
            }
        }
        return false;
    }

    function guessProfileUrls() {
        // Thu link “account|profile|user” trong DOM cùng origin
        const fromDom = Array.from(document.querySelectorAll('a[href]'))
            .map(a => a.getAttribute('href'))
            .map(h => {
                try {
                    return new URL(h, location.href);
                } catch {
                    return null;
                }
            })
            .filter(u =>
                u
                 && u.origin === location.origin
                 && /(\/|^)(account|profile|user)(\/|$)/i.test(u.pathname) // chỉ nhận path "trang" tài khoản
                 && !/^\/api\//i.test(u.pathname) // loại mọi API
                 && !/\.(json|js|css|png|jpe?g|gif|webp|svg)$/i.test(u.pathname) // loại file tĩnh
            )

            .map(u => u.pathname);

        // Mặc định: chỉ /account/user-profile để console sạch
        const defaults = ['/account/user-profile'];

        // Gộp + khử trùng lặp (ưu tiên defaults trước)
        const seen = new Set();
        return [...defaults, ...fromDom].filter(p => {
            if (seen.has(p))
                return false;
            seen.add(p);
            return true;
        });
    }

    // ƯU TIÊN: selector lấy trực tiếp số dư trong header (của NET88)
    // Ưu tiên selector số dư (đường dẫn cụ thể bạn muốn trước tiên)

    function findBalance() {
        // (Gate) Chỉ cho phép khi đã "thấy" nút Đăng nhập (header đã sẵn)
        if (typeof canRunAuthLoop === 'function' && !canRunAuthLoop()) {
            return S.balance || '';
        }

        // Chỉ soi trong header để tránh dính jackpot/số khác
        const header = document.querySelector('header.menu, header');
        if (!header)
            return S.balance || '';

        // ⬇️ DÙNG DUY NHẤT selector path cố định bạn yêu cầu
        let el = null;
        try {
            el = header.querySelector(ABS_BALANCE_SEL);
        } catch (_) {
            el = null;
        }

        // Không tìm thấy đúng path → giữ giá trị cũ
        if (!el)
            return S.balance || '';

        // Né các vùng không phải header-balance
        if (el.closest('.livestream-section, .slots, .jackpot, .bingo, .lottery, .mini-games')) {
            return S.balance || '';
        }

        const raw = (el.textContent || '').trim();
        if (!raw)
            return S.balance || '';

        // Cho phép "0" hoặc số có nhóm nghìn / ≥1 chữ số
        // (Nếu muốn chặt như trước: thay \d{1,} -> \d{4,})
        const m = raw.replace(/\s+/g, ' ')
            .match(/(\d{1,3}(?:[.,]\d{3})+|\d{1,})(?:\s*(VND|đ|₫))?/i);
        if (!m)
            return S.balance || '';

        const val = m[1].replace(/\s+/g, '');
        if (typeof balLog === 'function')
            balLog('hit', ABS_BALANCE_SEL, 'value=', val);

        return val || (S.balance || '');
    }

    function updateUsername(u) {
        if (u == null)
            return;
        const val = String(u).trim();
        if (!isLikelyUsername(val))
            return; // ✨ thêm dòng này

        S.username = val;
        updateInfo();

        // 🔔 NEW: đẩy ngay 1 gói lên C# (không chờ interval)
        try {
            if (typeof window.__abx_hw_pushNow === 'function') {
                // Nếu bạn đã có bridge pushNow thì dùng luôn
                window.__abx_hw_pushNow();
            } else if (window.chrome && window.chrome.webview && typeof window.chrome.webview.postMessage === 'function') {
                // Fallback: tự gửi JSON theo format mà C# đang parse
                window.chrome.webview.postMessage(JSON.stringify({
                        abx: 'home_tick',
                        username: S.username || '',
                        balance: String(S.balance ?? ''),
                        href: String(location.href || ''),
                        title: String(document.title || ''),
                        ts: Date.now()
                    }));
            }
        } catch (_) { /* nuốt lỗi, không ảnh hưởng UI */
        }
    }

    function updateBalance(b) {
        if (b == null)
            return;
        const val = String(b).replace(/\s+/g, ' ').trim();
        if (!val)
            return; // giữ nguyên triết lý không xoá giá trị cũ

        S.balance = val;
        updateInfo();

        // 🔔 NEW: đẩy ngay 1 gói lên C# (không chờ interval)
        try {
            if (typeof window.__abx_hw_pushNow === 'function') {
                window.__abx_hw_pushNow();
            } else if (window.chrome && window.chrome.webview && typeof window.chrome.webview.postMessage === 'function') {
                window.chrome.webview.postMessage(JSON.stringify({
                        abx: 'home_tick',
                        username: S.username || '',
                        balance: String(S.balance ?? ''),
                        href: String(location.href || ''),
                        title: String(document.title || ''),
                        ts: Date.now()
                    }));
            }
        } catch (_) {}
    }

    function probeIframeOnce() {
        if (isGameHost())
            return; // không chạy ở trang game
        if (S.username && S.balance)
            return; // ⬅️ chỉ bỏ qua khi đã có cả tên lẫn số dư

        if (S.retries >= CFG.maxRetries)
            return;
        if (S.inflightProbe)
            return; // đang chạy rồi

        let paths = guessProfileUrls().filter(p => !/^\/api\//i.test(p) && !/\.(json|js|css|png|jpe?g|gif|webp|svg)$/i.test(p));
        if (!paths || !paths.length)
            paths = ['/account/user-profile']; // fallback cứng sang HTML

        if (!paths || !paths.length)
            return;

        S.inflightProbe = true; // khóa re-entrance

        const idx = S.retries % paths.length;
        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:5px;height:5px;visibility:hidden;border:0';
        iframe.sandbox = 'allow-same-origin allow-scripts';
        iframe.setAttribute('data-abx', 'probe');

        S.retries++;
        let settled = false;
        const cleanup = () => {
            if (settled)
                return;
            settled = true;
            try {
                iframe.remove();
            } catch (_) {}
            S.inflightProbe = false;
        };

        iframe.onload = () => {
            try {
                const doc = iframe.contentDocument || (iframe.contentWindow && iframe.contentWindow.document);
                try {
                    // Username (ƯU TIÊN ABS PATH trong tài liệu iframe)
                    let valU = '';
                    try {
                        const abs = findByTailIn(ABS_USERNAME_TAIL, doc);
                        if (abs) {
                            valU = (abs.value != null ? String(abs.value)
                                 : (abs.getAttribute && abs.getAttribute('value')) || abs.textContent || '').trim();
                        }
                    } catch (_) {}

                    if (!valU) {
                        const pickU = doc && doc.querySelector('.base-dropdown-header__user__name, .full-name, .display-name, .username .full-name, [class*="display-name"]');
                        valU = pickU ? (pickU.textContent || '').trim() : '';
                    }
                    if (valU)
                        updateUsername(valU);

                    // Balance
                    const pickB = doc && doc.querySelector(
                            '.base-dropdown-header__user__amount, .user__amount, .user-amount, .balance, [class*="amount"]');
                    if (pickB) {
                        const raw = (pickB.textContent || '').replace(/\s+/g, ' ').trim();
                        const m = raw.match(/(\d{1,3}(?:[.,]\d{3})+|\d{1,})(?:\s*(VND|đ|₫|k|K|m|M))?/);
                        if (m)
                            updateBalance(m[1].replace(/[^\d]/g, ''));
                    }
                } catch (_) {}

            } catch (_) {}
            setTimeout(cleanup, 50);
        };

        iframe.onerror = cleanup;
        iframe.src = paths[idx];
        (document.body || document.documentElement).appendChild(iframe);
    }

    // Cấu hình đề xuất:
    CFG.autoRetryOnBoot = false; // KHÔNG tự chạy khi boot

    function startAutoRetry(force = false) {
        if (isGameHost())
            return; // không auto-retry ở domain games.*
        if (typeof canRunAuthLoop === 'function' && !canRunAuthLoop())
            return; //
        if (S.username && !force)
            return;

        // dọn timer cũ (nếu có)
        if (S.autoTimer) {
            clearTimeout(S.autoTimer);
            S.autoTimer = null;
        }
        S.retries = 0;
        S.fetchDone = false;

        let interval = CFG.autoRetryIntervalMs || 5000; // 5s mặc định

        const loop = async() => {
            // đã có username → dừng
            if (S.username) {
                S.autoTimer = null;
                return;
            }

            // nếu đạt trần cố gắng → dừng
            if (S.retries >= CFG.maxRetries) {
                S.autoTimer = null;
                return;
            }

            // 1) thử DOM nhanh ngay trong trang
            if (!S.username) {
                const fast = findUserFromDOM && findUserFromDOM();
                if (fast) {
                    updateUsername(fast);
                    S.autoTimer = null;
                    return;
                }
            }

            // 2) thử fetch trang profile (êm hơn) — CHỈ 1 LẦN
            if (!S.fetchDone) {
                let ok = false;
                try {
                    ok = await tryFetchUserProfile();
                } catch (_) {}
                S.fetchDone = true; // không lặp lại fetch ở các vòng sau
                if (ok) {
                    S.autoTimer = null;
                    return;
                }
            }
            probeIframeOnce();

            // backoff tăng dần, tối đa 60s
            interval = Math.min(interval * 2, 60000);
            S.autoTimer = setTimeout(loop, interval);
        };

        // chạy vòng đầu tiên
        S.autoTimer = setTimeout(loop, 0);
    }

    function pumpAuthProbe(durationMs = 12000, step = 350) {
        if (!canRunAuthLoop())
            return; // ⬅️ chỉ cho phép auto-retry khi thấy "Đăng nhập"
        const t0 = Date.now();
        if (S.pumpTimer)
            clearInterval(S.pumpTimer);
        S.pumpTimer = setInterval(async() => {
            try {
                // 1) DOM trước
                const u = findUserFromDOM();
                if (u)
                    updateUsername(u);
                const b = findBalance();
                if (b)
                    updateBalance(b);

                // 2) Nếu vẫn chưa có username, thử fetch 1 lần (êm)
                if (!S.username && !S.fetchDone) {
                    S.fetchDone = true;
                    try {
                        await tryFetchUserProfile();
                    } catch (_) {}
                }

                // 3) Nếu đã có tên + (có hoặc chưa có số dư), cứ tiếp tục đọc số dư trong khoảng thời gian
                //    Khi đã có tên và đã có lần đọc số dư hợp lệ, hoặc quá thời gian → dừng
                if ((S.username && S.balance) || (Date.now() - t0 > durationMs)) {
                    clearInterval(S.pumpTimer);
                    S.pumpTimer = null;
                }
            } catch (_) {}
        }, step);
    }

    function startUsernameWatchdog() {
        if (!canRunAuthLoop())
            return;
        // clear trước
        if (S.watchdogTimer) {
            clearInterval(S.watchdogTimer);
            S.watchdogTimer = null;
        }
        S.missStreak = 0;

        const tick = async() => {
            if (isGameHost())
                return; // chỉ chạy ở Home
            if (isClearlyLoggedOut()) { // đang logout rõ ràng -> reset miss
                S.missStreak = 0;
                return;
            }

            // 1) Ưu tiên đọc DOM nhanh
            const u = findUserFromDOM();
            if (u) {
                updateUsername(u);
                S.missStreak = 0;
            } else {
                // 2) Không thấy -> bơm đọc ngắn + thỉnh thoảng fetch
                S.missStreak++;
                pumpAuthProbe(5000, 200);
                if (!S.fetchDone && (S.missStreak % 2 === 1)) {
                    try {
                        await tryFetchUserProfile();
                    } catch (_) {}
                }
                // 3) Quá 3 nhịp vẫn "?" -> gọi auto-retry theo đề xuất
                if (S.missStreak >= (CFG.maxWatchdogMiss || 3)) {
                    S.fetchDone = false;
                    startAutoRetry(true);
                    S.missStreak = 0;
                }
            }

            // Luôn cố cập nhật số dư theo DOM mỗi nhịp
            const b = findBalance();
            if (b)
                updateBalance(b);
            // Nếu vẫn chưa có balance, thỉnh thoảng thử kéo từ /account/*
            if (!S.balance && (S.missStreak % 3 === 0)) {
                try {
                    await tryFetchUserProfile();
                } catch (_) {}
            }

        };

        S.watchdogTimer = setInterval(tick, CFG.watchdogMs || 2000);
    }

    function ensureObserver() {
        if (!canRunAuthLoop())
            return; // ⬅️ chưa mở cổng thì không đọc DOM
        try {
            if (S.mo)
                return S.mo; // chỉ gắn 1 lần
            let t = null;
            const run = () => {
                t = null;

                // 1) DOM trước
                if (!S.username) {
                    const v = findUserFromDOM();
                    if (v)
                        updateUsername(v);
                }
                const b = findBalance();
                if (b && b !== S.balance)
                    updateBalance(b);

                // 2) Nếu DOM vừa thay đổi, thử “bơm” đọc nhanh (SPA thường render trễ)
                try {
                    onAuthStateMaybeChanged('mut'); // ⬅️ kích hoạt fetch/iframe fallback khi cần
                    pumpAuthProbe(4000, 300); // ⬅️ bơm 4s để chốt Username/Balance sớm
                } catch (_) {}
            };

            const onMut = () => {
                clearTimeout(t);
                t = setTimeout(run, 150);
                // Cài mute telemetry cho những iframe same-origin mới xuất hiện
                try {
                    document.querySelectorAll('iframe:not([data-abx-tmuted="1"])').forEach(f => {
                        try {
                            const w = f.contentWindow;
                            if (w && w.location && w.location.origin === location.origin) {
                                installTelemetryMutesInFrame(w);
                                f.setAttribute('data-abx-tmuted', '1');
                                f.addEventListener('load', () => installTelemetryMutesInFrame(f.contentWindow));
                            }
                        } catch (_) {}
                    });
                } catch (_) {}

            };
            const mo = new MutationObserver(onMut);
            // 👇 BẮT BUỘC: bắt mọi thay đổi DOM để cập nhật username/balance
            mo.observe(document.documentElement, {
                subtree: true,
                childList: true,
                characterData: true,
                attributes: true
            });
            onAuthStateMaybeChanged('mo'); // phát hiện trạng thái có thể thay đổi
            S.mo = mo;
            return mo;
        } catch (_) {}
    }

    // ======= Overlay handling (close / peel / force click) =======
    function tryCloseCommonOverlays() {
        // Chỉ đóng các popup/modal thực sự, bỏ qua phần tử nằm trong header/nav để không chạm dropdown Casino/PP
        const shouldSkip = (el) => {
            try {
                return !!el.closest('.header, .header_nav, .header_nav_list, .nav_item, .nav_item_btn, .dropdown_menu');
            } catch (_) {
                return false;
            }
        };

        document.querySelectorAll('.swal2-container, .swal2-popup, .swal2-backdrop-show, .modal.show, .modal-backdrop')
        .forEach(n => {
            if (!n || shouldSkip(n))
                return;
            const c = n.querySelector('.swal2-close, .btn-close, .close, [data-action="close"], .swal2-confirm');
            if (c) {
                try {
                    c.click();
                } catch (_) {}
            }
        });
    }

    // NEW: tìm root popup theo tail & auto đóng các popup đã biết (thông báo / quảng cáo)
    function findPopupRootFromTail(tail) {
        if (!tail)
            return null;

        let root = null;

        // 1) thử tail tuyệt đối
        try {
            root = findByTail(tail);
        } catch (_) {}
        if (root && root.isConnected)
            return root;

        // 2) fallback: lấy segment cuối cùng trong tail -> selector theo class
        try {
            const parts = String(tail).split('/').filter(Boolean);
            const last = parts[parts.length - 1] || '';
            const m = last.match(/^([a-zA-Z0-9_-]+)((?:\.[a-zA-Z0-9_-]+)+)/);
            if (m) {
                const css = m[1] + m[2]; // ví dụ: div.tcg_modal_wrap.publicModal
                root = document.querySelector(css);
                if (root && root.isConnected)
                    return root;
            }
        } catch (_) {}

        // 3) fallback đặc biệt cho publicModal RR88
        try {
            if (String(tail).includes('publicModal')) {
                root = document.querySelector('.tcg_modal_wrap.publicModal');
                if (root && root.isConnected)
                    return root;
            }
        } catch (_) {}

        return null;
    }

    // Helper: tìm nút close (X / Close / Exit...) gần một popup root
    function findCloseButtonForRoot(root) {
        if (!root || !(root instanceof HTMLElement))
            return null;

        const CLOSE_SELECTOR =
            '.v--modal-close, .modal__close, .modal-close, .btn-close, .close, ' +
            '[data-action="close"], [data-dismiss="modal"]';

        const tryQuery = (node) => {
            try {
                if (!node || !node.querySelector)
                    return null;
                const el = node.querySelector(CLOSE_SELECTOR);
                if (el && el.offsetParent !== null)
                    return el;
            } catch (_) {}
            return null;
        };

        // 1) Ưu tiên tìm ngay bên trong root
        let target = tryQuery(root);
        if (target)
            return target;

        // 2) Thử trên các ancestor gần (box, overlay...)
        let p = root.parentElement;
        while (p && p !== document.body) {
            target = tryQuery(p);
            if (target)
                return target;
            p = p.parentElement;
        }

        // 3) Fallback: tìm các element nhỏ có text / label giống nút đóng
        const vw = Math.max(innerWidth || 0, document.documentElement.clientWidth || 0);
        const vh = Math.max(innerHeight || 0, document.documentElement.clientHeight || 0);

        const cand = [];
        const pushIfGood = (el) => {
            if (!el || !(el instanceof HTMLElement))
                return;
            if (el.offsetParent === null)
                return;

            const r = el.getBoundingClientRect();
            if (!r || r.width <= 8 || r.height <= 8 ||
                r.width > vw * 0.5 || r.height > vh * 0.5)
                return;

            const raw = (el.innerText || el.textContent || '').trim();
            const normRaw = norm(raw);
            const mix = (normRaw + ' ' +
                norm(el.getAttribute && el.getAttribute('aria-label') || '') + ' ' +
                norm(el.getAttribute && el.getAttribute('title') || '') + ' ' +
                norm(el.className || '') + ' ' +
                norm(el.id || '')).trim();

            const hasXOnly = /^[x×✕✖✗✘]{1,2}$/i.test(raw);
            const hasKeyword =
                /(^x$|\bdong\b|\btat\b|\bthoat\b|close|exit|cancel|\bhuy\b)/.test(mix);

            if (!hasXOnly && !hasKeyword)
                return;

            cand.push({
                el,
                r
            });
        };

        try {
            root.querySelectorAll('button, [role="button"], a, div, span, i')
            .forEach(pushIfGood);
        } catch (_) {}

        p = root.parentElement;
        let depth = 0;
        while (p && p !== document.body && depth < 3) {
            try {
                p.querySelectorAll('button, [role="button"], a, div, span, i')
                .forEach(pushIfGood);
            } catch (_) {}
            p = p.parentElement;
            depth++;
        }

        if (!cand.length)
            return null;

        // Chọn candidate gần góc phải trên màn hình (thường là nút X)
        const tx = vw * 0.95;
        const ty = vh * 0.05;
        let best = cand[0];
        let bestScore = Infinity;

        cand.forEach(c => {
            const cx = c.r.x + c.r.width / 2;
            const cy = c.r.y + c.r.height / 2;
            const dx = Math.abs(cx - tx);
            const dy = Math.abs(cy - ty);
            const area = c.r.width * c.r.height;
            const score = dx + dy + area * 0.01;
            if (score < bestScore) {
                bestScore = score;
                best = c;
            }
        });

        return best && best.el ? best.el : null;
    }

    function forceClosePublicModalRR88() {
        let closed = false;
        try {
            const nodes = document.querySelectorAll('.tcg_modal_wrap.publicModal');
            nodes.forEach(root => {
                // không hiển thị thì bỏ qua
                if (!root || root.offsetParent === null)
                    return;

                // 1) Ưu tiên tìm nút X / Close / Exit gần popup
                let target = findCloseButtonForRoot(root);

                // 2) Nếu vẫn chưa có, fallback nút "Kiểm tra" (logic cũ)
                if (!target) {
                    try {
                        const candBtns =
                            root.querySelectorAll('button, .base-button.btn, [role="button"], a');
                        for (const el of candBtns) {
                            const t = norm(textOf(el));
                            if (t && t.includes('kiem tra')) {
                                target = el;
                                break;
                            }
                        }
                    } catch (_) {}
                }

                // 3) Nếu vẫn chưa có -> click nền overlay
                if (!target) {
                    const bg = root.closest('.v--modal-background-click');
                    const ov = root.closest('.v--modal-overlay');
                    target = bg || ov || root;
                }

                if (target && typeof target.click === 'function') {
                    // Ghi log để xem trong log C#
                    console.debug(
                        '[HomeWatch] forceClosePublicModalRR88 click',
                        target.tagName,
                        norm(textOf(target) || ''));
                    try {
                        target.click();
                        closed = true;
                    } catch (_) {}
                }
            });
        } catch (_) {}
        return closed;
    }

    function closeKnownPopupRoots() {
        if (!CLOSE_POPUP_ROOT_TAILS || !CLOSE_POPUP_ROOT_TAILS.length)
            return false;

        let closed = false;

        // Ưu tiên đóng popup "Thông báo RR88" theo class, không phụ thuộc tail tuyệt đối
        if (forceClosePublicModalRR88())
            closed = true;

        CLOSE_POPUP_ROOT_TAILS.forEach((tail) => {
            try {
                const root = findPopupRootFromTail(tail);
                if (!root || root.offsetParent === null)
                    return;

                // 1) Ưu tiên nút X / Close / Exit... gần popup
                let target = findCloseButtonForRoot(root);

                // 2) Nếu chưa có thì quét thêm các button có text đóng
                if (!target) {
                    try {
                        const btns =
                            root.querySelectorAll('button, .base-button.btn, [role="button"], a');
                        const candid = Array.from(btns).find(el => {
                            const t = norm(textOf(el));
                            return t.includes('dong') || t.includes('tat') ||
                            t.includes('close') || t.includes('ok') ||
                            t.includes('exit') || t.includes('xac nhan');
                        });
                        if (candid)
                            target = candid;
                    } catch (_) {}
                }

                // 3) Nếu vẫn chưa có -> click vùng nền overlay (v--modal-background-click)
                if (!target) {
                    let p = root;
                    while (p && p !== document.body) {
                        if (/\bv--modal-background-click\b/.test(p.className) ||
                            /\bmodal-backdrop\b/.test(p.className)) {
                            target = p;
                            break;
                        }
                        p = p.parentElement;
                    }
                }

                // 4) Cuối cùng: click luôn root
                if (!target)
                    target = root;

                if (target && typeof target.click === 'function') {
                    console.debug(
                        '[HomeWatch] closeKnownPopupRoots click',
                        target.tagName,
                        norm(textOf(target) || ''),
                        'tail=',
                        tail);
                    try {
                        target.click();
                        closed = true;
                    } catch (_) {}
                }
            } catch (_) {}
        });

        return closed;
    }

    function tempHideBigOverlays(target, holdMs = 0) {
        const removed = [];
        const vw = innerWidth,
        vh = innerHeight;
        document.querySelectorAll('body *').forEach(n => {
            if (!(n instanceof HTMLElement))
                return;
            if ($panel() && ($panel().contains(n) || n.contains($panel())))
                return;
            const s = getComputedStyle(n);
            if (!/(fixed|sticky|absolute)/.test(s.position))
                return;
            const zi = parseFloat(s.zIndex || '0');
            if (isNaN(zi) || zi < 1000)
                return;
            if (s.visibility === 'hidden' || s.display === 'none')
                return;
            const r = n.getBoundingClientRect();
            if (r.width * r.height < vw * vh * 0.2)
                return; // chỉ ẩn những lớp che lớn >20% màn hình
            if (n.contains(target) || target.contains(n))
                return;
            const prevDisp = n.style.display,
            prevVis = n.style.visibility;
            n.setAttribute('data-abx-hide', '1');
            n.style.setProperty('display', 'none', 'important');
            removed.push({
                n,
                prevDisp,
                prevVis
            });
        });
        const restore = () => removed.forEach(x => {
            x.n.style.display = x.prevDisp;
            x.n.style.visibility = x.prevVis;
            x.n.removeAttribute('data-abx-hide');
        });
        if (holdMs > 0)
            setTimeout(restore, holdMs);
        return {
            restore
        };
    }
    function isVisibleAndClickable(el) {
        if (!el || !el.isConnected)
            return false;
        const s = getComputedStyle(el);
        if (s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity || '1') < 0.05)
            return false;
        const r = el.getBoundingClientRect();
        if (r.width <= 1 || r.height <= 1)
            return false;
        return true;
    }
    function peelAndClick(el, {
        holdMs = 600
    } = {}) {
        if (!el)
            return;
        try {
            el.scrollIntoView({
                block: 'center',
                inline: 'center'
            });
        } catch (_) {}
        const r = el.getBoundingClientRect();
        const cx = Math.max(0, Math.min(innerWidth - 1, Math.round(r.left + Math.max(1, r.width) / 2)));
        const cy = Math.max(0, Math.min(innerHeight - 1, Math.round(r.top + Math.max(1, r.height) / 2)));

        tryCloseCommonOverlays();
        const hidden = tempHideBigOverlays(el, holdMs);

        const peeled = [];
        const peelOnce = () => {
            const top = document.elementFromPoint(cx, cy);
            if (!top)
                return false;
            if (top === el || el.contains(top))
                return true;
            const prevPE = top.style.pointerEvents;
            top.style.setProperty('pointer-events', 'none', 'important');
            peeled.push({
                node: top,
                prevPE
            });
            return false;
        };
        let ok = false,
        guard = 25;
        while (guard-- > 0) {
            if (peelOnce()) {
                ok = true;
                break;
            }
        }

        const restorePE = () => peeled.reverse().forEach(k => k.node.style.pointerEvents = k.prevPE);
        const doClick = () => {
            try {
                el.click();
            } catch (_) {}
            try {
                const target = document.elementFromPoint(cx, cy) || el;
                ['pointerdown', 'mousedown', 'mouseup', 'click'].forEach(t => {
                    target.dispatchEvent(new MouseEvent(t, {
                            bubbles: true,
                            cancelable: true,
                            clientX: cx,
                            clientY: cy,
                            view: window
                        }));
                });
            } catch (_) {}
        };
        try {
            doClick();
        } finally {
            setTimeout(restorePE, 0); /* big overlays restore tự động sau holdMs */
        }
    }

    // Bọc tiện ích theo tên bạn yêu cầu
    function closeAdsAndCovers() {
        tryCloseCommonOverlays();
        closeKnownPopupRoots(); // NEW: đóng thêm các popup/thông báo theo tail cố định
        // Không giữ ẩn quá lâu tại trang Home, chỉ peel khi click
    }


    // ====== Scan/Click "Baccarat nhieu ban" qua bridge frame/top ======
    (function setupBaccFrameBridge() {
        if (window.__abx_bacc_bridge_installed)
            return;
        window.__abx_bacc_bridge_installed = true;

        const logInfo = (msg) => { try { updateInfo && updateInfo(msg); } catch (_) { console.log(msg); } };
        try { logInfo('[baccBridge] installed at ' + (location && location.href ? location.href : '')); } catch (_) {}
        const norm = (s) => (s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
        const buildTail = (el, doc) => {
            if (!el || !el.tagName)
                return '';
            const segs = [];
            let n = el;
            const root = doc.documentElement;
            while (n && n.nodeType === 1 && n !== root && segs.length < 10) {
                const tag = n.tagName.toLowerCase();
                const parent = n.parentElement;
                let idx = 1;
                if (parent) {
                    const sib = Array.from(parent.children).filter(c => c.tagName === n.tagName);
                    idx = sib.indexOf(n) + 1;
                }
                segs.push(tag + '[' + idx + ']');
                n = parent;
            }
            return segs.reverse().join('/');
        };

        const scanBaccCards = (doc, scope) => {
            const hits = [];
            const nodes = Array.from(doc.querySelectorAll(
                '.game-card, [class*="game-card"], ' +
                '.game-item, [class*="game-item"], ' +
                '.casino_detail .game-list .game-item, .casino_detail .game-list li, ' +
                '.casino_list .game-card, li, [aria-label], [title], [data-name], [data-game-name], img[alt], img[title]'
            ));
            nodes.forEach((card, idx) => {
                const txt = norm([
                    card.innerText || '',
                    card.getAttribute('aria-label') || '',
                    card.getAttribute('title') || '',
                    card.getAttribute('data-name') || '',
                    card.getAttribute('data-game-name') || ''
                ].join(' '));
                const imgTxt = norm(
                    Array.from(card.querySelectorAll('img[alt],img[title]'))
                        .map(img => img.alt || img.title || '')
                        .join(' ')
                );
                const t = txt + ' ' + imgTxt;
                const hasBacc = /\bbaccarat\b/.test(t);
                const hasMulti = /(nhieu\s*ban|multi[\s_-]*table|multi[\s_-]*baccarat)/i.test(t);
                if (!hasBacc && !hasMulti)
                    return;
                let score = 0;
                if (hasBacc) score += 6;
                if (hasMulti) score += 6;
                if (/nhieu\s*ban/i.test(t)) score += 2;
                if (/multi/.test(t)) score += 1;
                if (idx <= 2) score += 1;
                const r = card.getBoundingClientRect();
                hits.push({
                    scope,
                    score,
                    tail: buildTail(card, doc),
                    text: (card.innerText || '').trim().slice(0, 80),
                    attrs: ((card.getAttribute('aria-label') || '') + ' ' + (card.getAttribute('title') || '')).trim().slice(0, 80),
                    rect: Math.round(r.x) + ',' + Math.round(r.y) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height)
                });
            });
            hits.sort((a, b) => b.score - a.score);
            return hits;
        };

        const frameHandler = (evt) => {
            try {
                const data = evt && evt.data || {};
                const cmd = data.cmd || '';
                if (cmd === 'abx_scan_bacc') {
                    const hits = scanBaccCards(document, 'frame');
                    evt.source && evt.source.postMessage({ cmd: 'abx_scan_bacc_result', hits, idx: data.idx }, '*');
                } else if (cmd === 'abx_click_bacc_tail') {
                    const tail = data.tail || '';
                    let el = null;
                    try { el = findByTail ? findByTail(tail) : null; } catch (_) {}
                    if (!el) {
                        const parts = tail.split('/').filter(Boolean);
                        const last = parts[parts.length - 1] || '';
                        const m = last.match(/^([a-z0-9_-]+)(\.[a-z0-9_.-]+)?/i);
                        if (m) {
                            const sel = m[2] ? (m[1] + m[2].replace(/\./g, '.')) : m[1];
                            el = document.querySelector(sel);
                        }
                    }
                    let res = 'not-found';
                    if (el) {
                        const btn = el.querySelector('a,button') || el;
                        try { peelAndClick ? peelAndClick(btn, { holdMs: 400 }) : btn.click(); res = 'ok'; }
                        catch (e) {
                            try { btn.click(); res = 'ok'; } catch (e2) { res = 'err:' + (e2 && e2.message || e2); }
                        }
                    }
                    evt.source && evt.source.postMessage({ cmd: 'abx_click_bacc_tail_result', tail, result: res, idx: data.idx }, '*');
                }
            } catch (_) {}
        };

        if (window !== window.top) {
            window.addEventListener('message', frameHandler, false);
        } else {
            window.__abx_scanBaccFrames = () => {
                const iframes = Array.from(document.querySelectorAll('iframe'));
                iframes.forEach((ifr, idx) => {
                    try { ifr.contentWindow && ifr.contentWindow.postMessage({ cmd: 'abx_scan_bacc', idx }, '*'); } catch (_) {}
                });
                const hitsTop = scanBaccCards(document, 'top');
                window.__abx_scan_bacc_hits = hitsTop;
                logInfo('[scanBacc] top hits=' + hitsTop.length + ', iframes=' + iframes.length);
                try { console.table(hitsTop.slice(0, 10)); } catch (_) {}
                return hitsTop;
            };
            window.__abx_clickBaccTailInFrames = (tail) => {
                const iframes = Array.from(document.querySelectorAll('iframe'));
                iframes.forEach((ifr, idx) => {
                    try { ifr.contentWindow && ifr.contentWindow.postMessage({ cmd: 'abx_click_bacc_tail', tail, idx }, '*'); } catch (_) {}
                });
            };
            window.addEventListener('message', (evt) => {
                const data = evt && evt.data || {};
                if (data.cmd === 'abx_scan_bacc_result' && data.hits) {
                    window.__abx_scan_bacc_hits = (window.__abx_scan_bacc_hits || []).concat(data.hits);
                    logInfo('[scanBacc frame] +' + data.hits.length + ' (total=' + window.__abx_scan_bacc_hits.length + ')');
                    try { console.table(data.hits.slice(0, 10)); } catch (_) {}
                    try { updateInfo && updateInfo('[scanBacc frames] +' + data.hits.length); } catch (_) {}
                }
                if (data.cmd === 'abx_click_bacc_tail_result') {
                    try { updateInfo && updateInfo('clickBacc tail ' + data.tail + ': ' + data.result); } catch (_) {}
                }
            }, false);
        }
    })();

    // === Login helpers: auto click nút "Đăng nhập" cho tới khi popup hiện ra ===
    function clickLoginButtonOnce() {
        // Nếu đã đăng nhập thì không click nữa
        if (isLoggedInFromDOM()) {
            return false;
        }
        if (isLoginSubmitGuardActive()) {
            return false;
        }
        // Nếu popup đăng nhập đã hiện, không bấm nút header nữa
        if (isLoginPopupVisible()) {
            return false;
        }
        const btn = findLoginButton();
        if (btn && isVisibleAndClickable(btn)) {
            peelAndClick(btn, {
                holdMs: 300
            });
            return true;
        }
        return false;
    }

    // API public để host (C#) có thể bấm nút "Đăng nhập" ngay trên popup đăng nhập
    // Trả về true nếu tìm được nút và đã click, false nếu không tìm thấy.
    window.__cw_clickPopupLogin = function () {
        try {
            // Nếu đã đăng nhập hoặc nút/khối logout/username đã hiển thị → bỏ qua
            if (isLoggedInFromDOM()) {
                return false;
            }

            // 1) Xác định root của popup đăng nhập
            let root = null;
            try {
                if (typeof TAIL_LOGIN_POPUP_ROOT === 'string' && TAIL_LOGIN_POPUP_ROOT) {
                    root = findByTail(TAIL_LOGIN_POPUP_ROOT);
                }
            } catch (_) {}

            if (!root || !root.isConnected) {
                root = document.querySelector(LOGIN_POPUP_SELECTOR);
            }

            // Nếu popup chưa mở thì không làm gì
            if (!root || !root.isConnected || root.offsetParent === null) {
                // fallback: tìm modal chứa input password
                const pwParent = Array.from(document.querySelectorAll('input[type="password"]'))
                    .map(i => {
                        try {
                            return i.closest(LOGIN_POPUP_SELECTOR);
                        } catch (_) {
                            return null;
                        }
                    })
                    .find(Boolean);
                if (!pwParent || pwParent.offsetParent === null)
                    return false;
                root = pwParent;
            }

            // 2) Nếu user/pass chưa được điền → không click, tránh mở popup nếu đã login
            const userFilled = !!(root.querySelector('input[name="username"], input[type="text"]')?.value || '').trim();
            const passFilled = !!(root.querySelector('input[type="password"]')?.value || '').trim();
            if (!userFilled || !passFilled) {
                return false;
            }

            // 3) Tìm nút submit trong popup
            const resolveSubmitTarget = (el) => {
                if (!el || !el.isConnected)
                    return null;
                const tag = ((el.tagName || '') + '').toLowerCase();
                if (tag === 'button' || tag === 'input' || tag === 'a')
                    return el;
                try {
                    if (typeof el.matches === 'function' && el.matches('.submit_btn, [role="button"], .btn-login, .base-button.btn'))
                        return el;
                } catch (_) {}
                if (typeof el.closest === 'function') {
                    try {
                        const pick = el.closest('button, input, a, [role="button"], .submit_btn, .btn-login, .base-button.btn');
                        if (pick && pick.isConnected)
                            return pick;
                    } catch (_) {}
                }
                return null;
            };
            let btn = null;
            const popupBtnTails = Array.isArray(TAIL_LOGIN_POPUP_BTNS) ? TAIL_LOGIN_POPUP_BTNS :
                (TAIL_LOGIN_POPUP_BTNS ? [TAIL_LOGIN_POPUP_BTNS] : []);
            for (const t of popupBtnTails) {
                if (!t)
                    continue;
                try {
                    const cand = findByTail(t);
                    const target = resolveSubmitTarget(cand);
                    if (target && isVisibleAndClickable(target)) {
                        btn = target;
                        break;
                    }
                } catch (_) {}
            }
            if (!btn) {
                const candSel =
                    'button.submit_btn, .submit_btn[role="button"], button[type="submit"], .btn-login, .base-button.btn';
                for (const el of root.querySelectorAll(candSel)) {
                    const target = resolveSubmitTarget(el);
                    if (target && isVisibleAndClickable(target)) {
                        btn = target;
                        break;
                    }
                }
            }

            // Fallback: qu?t to?n b? button theo text "Đăng nhập"
            if (!btn) {
                const all = Array.from(
                        root.querySelectorAll('button, a, [role="button"], input[type="submit"]'));
                for (const el of all) {
                    const target = resolveSubmitTarget(el) || el;
                    if (!target || !isVisibleAndClickable(target))
                        continue;
                    const t = norm(textOf(target));
                    if (t.includes('dang nhap') || t.includes('login')) {
                        btn = target;
                        break;
                    }
                }
            }

            if (!btn || !isVisibleAndClickable(btn)) {
                return false;
            }

            // 4) Thực hiện click xuyên overlay nếu cần
            peelAndClick(btn, {
                holdMs: 400
            });
            setLoginSubmitGuard();
            try {
                startLoginPostProbe();
            } catch (_) {}
            return true;
        } catch (e) {
            console.warn('[__cw_clickPopupLogin] ERR', e);
            return false;
        }
    };

    function startLoginPostProbe() {
        // tránh bị start trùng nhiều lần cho 1 phiên login
        if (S.loginPostProbeStarted)
            return;
        S.loginPostProbeStarted = true;

        // giống logic cũ trong clickLoginButton: chờ header có user-logged rồi mới kéo info
        waitFor(() => !!document.querySelector('.user-logged, .base-dropdown-header__user__name'), 15000, 250)
        .then(async ok => {
            S.loginPostProbeStarted = false; // reset cho lần sau
            if (!ok)
                return;

            const u = findUserFromDOM();
            if (u)
                updateUsername(u);
            const b = findBalance();
            if (b)
                updateBalance(b);
            if (!S.username) {
                try {
                    await tryFetchUserProfile();
                } catch (_) {}
            }
            pumpAuthProbe(12000);
        });
    }

    function stopLoginAutoClick(msg) {
        if (S.loginPopupTimer) {
            clearInterval(S.loginPopupTimer);
            S.loginPopupTimer = null;
        }
        if (msg)
            updateInfo(msg);
    }

    function startLoginAutoClick() {
        // Nếu đã có timer auto-click rồi thì thôi, tránh tạo nhiều vòng lặp trùng
        if (S.loginPopupTimer)
            return;

        // Nếu đã login thì khỏi auto click nữa
        if (isLoggedInFromDOM()) {
            stopLoginAutoClick('Đã đăng nhập - không auto click nút "Đăng nhập" nữa.');
            return;
        }
        if (isLoginSubmitGuardActive()) {
            try {
                updateInfo && updateInfo('Đang chờ hoàn tất đăng nhập...');
            } catch (_) {}
            return;
        }

        // Nếu popup login đang mở sẵn thì không cần auto click
        if (isLoginPopupVisible()) {
            // chưa start timer nên chỉ bỏ qua
            return;
        }

        // bóc bớt quảng cáo/cover che nút login
        closeAdsAndCovers();

        const started = Date.now();
        const MAX_MS = 15000; // tối đa ~15s

        const tick = () => {
            // 1) Nếu trong lúc đang chạy mà đã login → dừng hẳn
            if (isLoggedInFromDOM()) {
                stopLoginAutoClick('Đã thấy trạng thái đăng nhập - dừng auto click nút "Đăng nhập".');
                return;
            }

            if (isLoginSubmitGuardActive()) {
                return;
            }

            // 2) Nếu popup login đang mở → chờ người dùng thao tác,
            //    KHÔNG click thêm nhưng vẫn giữ timer để sau khi đóng popup sẽ click lại
            if (isLoginPopupVisible()) {
                return;
            }

            // 3) Hết thời gian mà vẫn chưa thấy popup -> dừng để tránh spam
            if (Date.now() - started > MAX_MS) {
                stopLoginAutoClick('⚠ Auto click nút "Đăng nhập" quá ' + Math.round(MAX_MS / 1000) + 's nhưng chưa thấy popup.');
                return;
            }

            // 4) Thử click 1 lần
            const ok = clickLoginButtonOnce();
            if (ok)
                startLoginPostProbe(); // bắt đầu vòng lấy Username/Balance sau khi login
        };

        // bắn ngay 1 phát đầu tiên
        tick();
        // sau đó 1.2s click lại 1 lần cho tới khi popup mở / timeout / đã login
        S.loginPopupTimer = setInterval(tick, 1200);
        updateInfo('Đang auto click nút "Đăng nhập" trong tối đa ' + Math.round(MAX_MS / 1000) + 's (1.2s/lần)...');
    }

    // ======= Actions =======
    function clickLoginButton() {
        try {
            // Nếu đã login thì không auto-click nút Đăng nhập nữa
            if (isLoggedInFromDOM()) {
                stopLoginAutoClick('Đã đăng nhập - không auto click nút "Đăng nhập".');
                return;
            }
            if (isLoginSubmitGuardActive()) {
                try {
                    updateInfo && updateInfo('Đang chờ hoàn tất đăng nhập...');
                } catch (_) {}
                return;
            }
            // Thử chờ ngắn xem có nhận diện login sau khi DOM đầy đủ không
            waitFor(() => isLoggedInFromDOM(), 2500, 150).then((ok) => {
                if (ok) {
                    stopLoginAutoClick('Đã đăng nhập (sau chờ) - không auto click nút "Đăng nhập".');
                    return;
                }
                if (isLoginSubmitGuardActive()) {
                    return;
                }
                // Nếu popup login đã hiện rồi thì KHÔNG click nút nữa
                // và cũng KHÔNG dừng timer (nếu đang chạy), để khi anh đóng popup
                // timer vẫn tiếp tục click lại nút "Đăng nhập".
                if (isLoginPopupVisible()) {
                    return;
                }
                // Bắt đầu vòng auto-click
                startLoginAutoClick();
            });
        } catch (e) {
            console.error('[HomeWatch] clickLoginButton error', e);
        }
    }

    async function ensureOnHome() {
        // Ưu tiên: nếu header + tab Casino đã render thì coi như đang ở Home
        const headerCasino = document.querySelector(
                'div.header div.header_title div.header_bottom div.header_nav div.header_nav_list div.nav_item div.nav_item_btn.LIVE div.name1');
        if (headerCasino && headerCasino.offsetParent !== null)
            return true;

        // Đã ở Home và khu vực live hiển thị -> OK (fallback cũ)
        const sec0 = document.querySelector('.livestream-section__live');
        if (sec0 && sec0.offsetParent !== null)
            return true;

        // 1) Đóng overlay/ads trước để click logo không bị chặn
        tryCloseCommonOverlays();

        // 2) Thử click logo để về "/"
        const logo = document.querySelector('header .menu-left__logo a, a.main-logo, a[href="/"]');
        if (logo) {
            try {
                logo.click();
            } catch (_) {}
        } else if (location.pathname !== '/') {
            // Không có logo -> điều hướng thẳng về Home
            location.assign('/');
        }

        // 3) Đợi phần live render (tối đa 12s)
        const ok = await waitFor(() => {
            const s = document.querySelector('.livestream-section__live');
            return s && s.offsetParent !== null;
        }, 12000, 150);

        // 4) Fallback cứng: chưa thấy thì ép về Home một lần nữa
        if (!ok && location.pathname !== '/') {
            location.assign('/');
            await wait(1200);
            return !!(document.querySelector('.livestream-section__live'));
        }
        return !!ok;
    }

    function isXocDiaLaunched() {
        const t = norm(document.title || '');

        // Nếu title có từ khóa Tài/Xỉu/Sicbo mà KHÔNG có "xóc" → chắc chắn sai game
        if (RE_XOCDIA_NEG.test(t) && !RE_XOCDIA_POS.test(t))
            return false;

        // Đúng tiêu đề "xóc đĩa" → đúng game
        if (RE_XOCDIA_POS.test(t))
            return true;

        // Thử soi src của iframe (nếu game chạy trong iframe)
        const ifr = Array.from(document.querySelectorAll('iframe'))
            .find(f => RE_XOCDIA_POS.test(norm(f.src || '')));
        if (ifr)
            return true;

        // Mặc định: chưa xác nhận được
        return false;
    }

    async function multiTryClick(resolveBtn, attempts = 50, isOk = () => false, delayMs = 200, holdMs = 600) {
        for (let i = 0; i < attempts; i++) {
            let b = resolveBtn();
            if (!b)
                break;
            peelAndClick(b, {
                holdMs: holdMs
            });
            const ok = await waitFor(() => !b.isConnected || !isVisibleAndClickable(b) || isOk(), 1800, 120);
            if (ok)
                return true;
            await wait(delayMs);
        }
        return isOk();
    }

    // Chờ tối đa maxWaitMs cho nút render trước khi click
    async function waitButtonUpTo(resolveBtn, maxWaitMs = 10000, step = 200) {
        const t0 = Date.now();
        let found = null;
        while (Date.now() - t0 < maxWaitMs) {
            found = resolveBtn();
            if (found && found.isConnected)
                return found;
            await wait(step);
        }
        return null;
    }

    // Nhant dien trang lobby PP khi da chuyen han sang client.pragmaticplaylive.net
    function isOnPPLobby() {
        try {
            return /client\.pragmaticplaylive\.net/i.test(location.hostname) &&
                /\/desktop\/lobby(2)?/i.test(location.pathname);
        } catch (_) {
            return false;
        }
    }

    // Click "Baccarat nhieu ban" truc tiep trong trang lobby PP (same-origin)
    async function clickBaccNhieuBanInPPLobby(maxWaitMs = 10000) {
        const log = (m) => { try { updateInfo && updateInfo(m); } catch (_) {} };
        const tailFor = (el) => {
            try {
                const segs = [];
                let n = el;
                const root = document.documentElement;
                while (n && n.nodeType === 1 && n !== root && segs.length < 12) {
                    const tag = n.tagName.toLowerCase();
                    const parent = n.parentElement;
                    const idx = parent ? Array.from(parent.children).filter(c => c.tagName === n.tagName).indexOf(n) + 1 : 1;
                    segs.push(tag + '[' + idx + ']');
                    n = parent;
                }
                return segs.reverse().join('/');
            } catch (_) {
                return '';
            }
        };
        const matchCard = (el) => {
            const t = norm([
                el.textContent || '',
                el.getAttribute('aria-label') || '',
                el.getAttribute('title') || '',
                el.getAttribute('alt') || ''
            ].join(' '));
            return t.includes('baccarat') && (t.includes('nhieu ban') || t.includes('multi') || t.includes('many table'));
        };
        const collectNodes = () => {
            const out = [];
            const stack = [document.documentElement];
            while (stack.length) {
                const node = stack.pop();
                if (!node || node.nodeType !== 1) continue;
                const el = node;
                if (['A', 'BUTTON', 'DIV', 'SPAN', 'IMG'].includes(el.tagName))
                    out.push(el);
                for (const k of Array.from(el.children || [])) stack.push(k);
                if (el.shadowRoot) {
                    for (const k of Array.from(el.shadowRoot.children || [])) stack.push(k);
                }
            }
            return out;
        };
        const resolveCard = () => {
            const TAILS = [
                'div.bq_bt[2]/section[2]/div.eF_eG.fk_fl[1]/div.fk_fm.fk_fp[1]/div.eI_eJ[3]/div.eq_er.eq_eu[1]/div.eq_ev[1]/div.mT_mU.mT_mV[1]'
            ];
            for (const t of TAILS) {
                try {
                    const el = findByTail ? findByTail(t) : null;
                    if (el && isVisibleAndClickable(el)) {
                        const clickable = el.closest('a,button,[role="button"],.mT_mU,.mT_mV,.eq_ev,.eq_er') || el;
                        if (isVisibleAndClickable(clickable))
                            return clickable;
                    }
                } catch (_) { }
            }

            // Bám text nhưng chấm điểm để tránh trúng container lớn
            const nodes = collectNodes();
            const cands = [];
            for (const el of nodes) {
                if (!matchCard(el))
                    continue;
                const clickable = el.closest('a,button,[role=\"button\"],.game-card,.eq_er,.eq_ev') || el;
                if (!isVisibleAndClickable(clickable))
                    continue;
                const r = clickable.getBoundingClientRect();
                const area = r.width * r.height;
                const textLen = norm((clickable.textContent || '') + ' ' + (clickable.getAttribute('aria-label') || '')).length;
                let score = 0;
                if (['A', 'BUTTON'].includes(clickable.tagName)) score += 10;
                if ((clickable.getAttribute('role') || '').toLowerCase() === 'button') score += 6;
                score += Math.max(0, 2000 - Math.min(area, 2000)) / 200; // ưu tiên diện tích nhỏ
                score += Math.max(0, 120 - Math.min(textLen, 120)) / 20; // ưu tiên text ngắn
                cands.push({ el: clickable, score, area, textLen });
            }
            if (!cands.length)
                return null;
            cands.sort((a, b) => b.score - a.score);
            return cands[0].el;
        };

        log('Dang tim "Baccarat nhieu ban" trong lobby PP...');
        const t0 = Date.now();
        while (Date.now() - t0 < maxWaitMs) {
            if (!isOnPPLobby()) {
                log('Khong o lobby PP, bo tim card.');
                return 'not-lobby';
            }
            const card = resolveCard();
            if (card) {
                log('Thay card, tail=' + tailFor(card));
                try { console && console.warn && console.warn('[BaccMulti] click card'); } catch (_) {}
                try { card.scrollIntoView({ block: 'center', behavior: 'instant' }); } catch (_) {}
                const forceClick = (el) => {
                    try {
                        const r = el.getBoundingClientRect();
                        const cx = r.left + r.width / 2;
                        const cy = r.top + r.height / 2;
                        const tgt = document.elementFromPoint(cx, cy) || el;
                        tgt.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: cx, clientY: cy }));
                        return true;
                    } catch (_) { return false; }
                };
                try { peelAndClick(card, { holdMs: 400 }); }
                catch (_) {
                    try { card.click(); }
                    catch (_) { forceClick(card); }
                }
                return 'ok';
            }
            await wait(400);
        }
        log('Khong tim thay "Baccarat nhieu ban" trong lobby PP (het wait).');
        try { console && console.warn && console.warn('[BaccMulti] no card after wait'); } catch (_) {}
        return 'no-card';
    }
    async function clickBaccNhieuBanFromHome() {
        // Guard: tránh click lặp khi đang load vào game
        const now = Date.now();
        const guardMs = 3000; // 3s hạn chế lặp
        const logStep = (m) => {
            try { updateInfo && updateInfo('[bacc] ' + m); } catch (_) {}
            try { console && console.warn && console.warn('[BaccMulti]', m); } catch (_) {}
        };
        logStep('start, url=' + (location.href || '') + ', guard_until=' + (window.__abx_bacc_loading_until || 0));
        if (window.__abx_bacc_loading_until && now < window.__abx_bacc_loading_until) {
            logStep('Dang trong chu ky vao game, bo qua. guard_until=' + window.__abx_bacc_loading_until + ', now=' + now);
            try { updateInfo && updateInfo('⚠ Đang trong chu kỳ vào game (guard), bỏ qua.'); } catch (_) {}
            return 'skip-guard';
        }
        window.__abx_bacc_loading_until = now + guardMs;

        // Neu dang o thang trang lobby PP thi click ngay tai do
        if (isOnPPLobby()) {
            logStep('dang o lobby PP -> click tai cho');
            return await clickBaccNhieuBanInPPLobby();
        }
        // Home + PP truc tuyen + Baccarat nhieu ban (PP)
        try {
            if (typeof updateInfo === 'function')
                updateInfo('Dang co gang vao game "Baccarat nhieu ban" (PP) tu trang Home...');

            await ensureOnHome();
            logStep('ensureOnHome done, url=' + (location.href || ''));
            closeAdsAndCovers();

            // Thoi gian tre chu dong de trang Home/Dropdown Casino load day du
            const DELAY_BEFORE_FLOW = 1200;   // ms sau khi bat flow tu login
            const DELAY_AFTER_CASINO = 600;   // ms sau khi tab Casino active truoc khi click PP
            await wait(DELAY_BEFORE_FLOW);

            // tam dung auto close popup 5s de dropdown khong bi dong ngay
            const savedAutoClose = window.__abx_auto_close_popup;
            if (savedAutoClose) {
                clearInterval(savedAutoClose);
                window.__abx_auto_close_popup = null;
                setTimeout(() => {
                    if (!window.__abx_auto_close_popup)
                        window.__abx_auto_close_popup = setInterval(() => { try { closeAdsAndCovers(); } catch (_) {} }, 2000);
                }, 5000);
            }

            try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (_) {}

            const log = (m) => { try { updateInfo && updateInfo(m); } catch (_) {} };
            const safeClick = (el, holdMs = 400) => {
                if (!el) return false;
                try { peelAndClick(el, { holdMs }); return true; } catch (_) {}
                try { el.click(); return true; } catch (_) {}
                return false;
            };
            const openCasinoDropdown = () => {
                try {
                    const nav = document.querySelector('.nav_item_btn.LIVE, .nav_item.LIVE, .nav_item_btn');
                    if (nav)
                        nav.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
                } catch (_) {}
            };

            const casinoTails = [
                'div.header[1]/div.header_title[1]/div.header_bottom[2]/div.header_nav[1]/div.header_nav_list[1]/div.nav_item[2]/div.nav_item_btn.LIVE[1]/div.name1[1]',
                'div.header_nav[1]/div.header_nav_list[1]/div.nav_item[2]/div.nav_item_btn.LIVE[1]',
                'div.header_nav[1]/div.header_nav_list[1]/div.nav_item.active[2]/div.nav_item_btn.LIVE[1]'
            ];
            const resolveCasinoTab = () => {
                for (const t of casinoTails) {
                    const btn = findByTail(t);
                    if (btn && isVisibleAndClickable(btn))
                        return btn.closest('.nav_item_btn.LIVE') || btn;
                }
                const byText = Array.from(document.querySelectorAll('div.header_nav_list .nav_item_btn.LIVE, .nav_item_btn.LIVE .name1'))
                    .find(el => norm(el.textContent || '').includes('casino'));
                if (byText && isVisibleAndClickable(byText))
                    return byText.closest('.nav_item_btn.LIVE') || byText;
                const byClass = document.querySelector('div.header_nav_list .nav_item_btn.LIVE');
                if (byClass && isVisibleAndClickable(byClass))
                    return byClass;
                return null;
            };

            const ensurePPDropdownOpen = () => {
                try {
                    // click/hover nav LIVE thêm lần nữa để dropdown chắc chắn mở
                    const nav = document.querySelector('.nav_item_btn.LIVE, .nav_item.LIVE, .nav_item_btn');
                    if (nav) {
                        nav.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
                        nav.click?.();
                    }
                } catch (_) {}
            };

            const resolvePP_TailAndText = () => {
                const tails = [TAIL_PP_TRUC_TUYEN, TAIL_PP_TRUC_TUYEN_ALT];
                for (const t of tails) {
                    if (!t) continue;
                    try {
                        const el = findByTail(t);
                        if (el && el.isConnected)
                            return el;
                    } catch (_) {}
                }
                return Array.from(document.querySelectorAll('span.desc, li, a, button, div'))
                    .find(el => /pp\s*truc\s*tuyen/i.test(norm(el.textContent)));
            };
            const resolvePP_ByBroadText = () => {
                const match = (el) => /pp\s*(live|truc\s*tuyen)|pragmatic\s*play|pragmatic/.test(norm(el.textContent));
                return Array.from(document.querySelectorAll('li, a, button, span, div'))
                    .find(el => match(el));
            };
            const resolvePP_ClickParent = () => {
                const el = resolvePP_TailAndText() || resolvePP_ByBroadText();
                if (!el) return null;
                return el.closest('li, .dropdown_menu, .nav_item, .nav_item_btn') || el;
            };

            // pha 1: click Casino toi da 8 lan
            let activeCasino = false;
            for (let i = 0; i < 8; i++) {
                const btn = resolveCasinoTab();
                const navItem = btn?.closest('.nav_item');
                activeCasino = !!(navItem && /\bactive\b/.test(navItem.className));
                if (!activeCasino && btn)
                    safeClick(btn, 450);
                if (activeCasino)
                    break;
                await wait(800);
            }

            if (activeCasino && DELAY_AFTER_CASINO > 0)
                await wait(DELAY_AFTER_CASINO);

            // pha 2: click PP truc tuyen voi nhieu phuong an
            const strategies = [
                { name: 'tail+text', resolver: resolvePP_TailAndText },
                { name: 'broad-text', resolver: resolvePP_ByBroadText },
                { name: 'parent-fallback', resolver: resolvePP_ClickParent }
            ];
            let gotPP = false;
            let usedStrat = '';
            for (const strat of strategies) {
                for (let i = 0; i < 6; i++) {
                    const ppBtn = strat.resolver();
                    if (ppBtn && safeClick(ppBtn, 400)) {
                        gotPP = true;
                        usedStrat = strat.name;
                        break;
                    }
                    await wait(1000);
                }
                if (gotPP)
                    break;
                ensurePPDropdownOpen();
            }

            if (!gotPP) {
                if (typeof updateInfo === 'function')
                    updateInfo('Khong click duoc nut "PP truc tuyen". Co the bi overlay/che.');
                return 'no-pp-click';
            }

            if (usedStrat && typeof updateInfo === 'function')
                updateInfo('Da click PP truc tuyen (strategy: ' + usedStrat + ')');

            await wait(800); // cho danh sach game PP load
            // đợi listing render + đóng overlay để tránh click sớm khi còn /seamless
            const ensurePpListingReady = async () => {
                const DEADLINE = 6000;
                const start = Date.now();
                while (Date.now() - start < DEADLINE) {
                    try { closeAdsAndCovers(); } catch (_) {}
                    const hasList = document.querySelector('.casino_detail .game-list, .casino_list .game-card, .game-item');
                    if (hasList && hasList.offsetParent !== null)
                        return true;
                    await wait(200);
                }
                return false;
            };
            const listReady = await ensurePpListingReady();
            logStep('listing ready=' + listReady + ' href=' + (location.href || ''));

            // 4) tim card "Baccarat nhieu ban" (PP)
            if (typeof updateInfo === 'function')
                updateInfo('Dang tim game "Baccarat nhieu ban" (PP)...');

            const RE_BACC = /\bbaccarat\b/i;
            const RE_MULTI = /(nhieu\s*ban|multi[\s_-]*table|multi[\s_-]*baccarat)/i;
            const RE_PP = /\bpp\b|pragmatic/i;

            // scan nhanh tren trang hien tai (khong can tai su dung bridge)
            const resolveGameCardSimple = () => {
                const nodes = Array.from(document.querySelectorAll('a,button,div,span'));
                for (const el of nodes) {
                    const t = norm([
                        el.textContent || '',
                        el.getAttribute('aria-label') || '',
                        el.getAttribute('title') || ''
                    ].join(' '));
                    if (t.includes('baccarat') && t.includes('nhieu ban') && isVisibleAndClickable(el)) {
                        const clickable = el.closest('a,button') || el;
                        if (isVisibleAndClickable(clickable))
                            return clickable;
                    }
                }
                return null;
            };

            const resolveGameCard = () => {
                const cards = Array.from(document.querySelectorAll(
                    '.casino_detail .game-list .game-item,' +
                    '.casino_detail .game-list li,' +
                    '.casino_list .game-card'));

                if (!cards.length)
                    return null;

                const cand = [];

                cards.forEach((card, idx) => {
                    const txt = norm(card.innerText || '');
                    const imgTxt = norm(
                        Array.from(card.querySelectorAll('img[alt],img[title]'))
                            .map(img => img.alt || img.title || '')
                            .join(' '));

                    const t = txt + ' ' + imgTxt;
                    let score = 0;

                    if (RE_BACC.test(t)) score += 6;
                    if (RE_MULTI.test(t)) score += 6;
                    if (RE_PP.test(t)) score += 4;
                    if (/nhieu\s*ban/i.test(t)) score += 2;
                    if (idx <= 2) score += 1;

                    if (score > 0 && isVisibleAndClickable(card)) {
                        cand.push({ el: card, score });
                    }
                });

                if (!cand.length)
                    return null;
                cand.sort((a, b) => b.score - a.score);
                return cand[0].el;
            };

            const WAIT_GAME_MS = 12000;
            let card = await waitButtonUpTo(resolveGameCard, WAIT_GAME_MS, 200);

            // fallback scan đơn giản nếu chưa thấy
            if (!card)
                card = resolveGameCardSimple();

            if (!card) {
                logStep('no-card found, url=' + (location.href || ''));
                if (typeof updateInfo === 'function')
                    updateInfo('Khong tim thay game "Baccarat nhieu ban" (PP).');
                return 'no-game';
            }

            // 5) Click card / nut Play
            const resolverForClick = () => {
                if (card && isVisibleAndClickable(card)) {
                    const btn = card.querySelector('a,button') || card;
                    if (isVisibleAndClickable(btn))
                        return btn;
                }

                const other = resolveGameCard();
                if (!other)
                    return null;

                const btn2 = other.querySelector('a,button') || other;
                return isVisibleAndClickable(btn2) ? btn2 : null;
            };

            // thử điều hướng thẳng nếu card có href/data-url (để tránh bị kẹt ở seamless)
            const directHref =
                (card && (card.getAttribute('href') || (card.dataset && (card.dataset.href || card.dataset.url)))) ||
                (card && card.closest('a') ? card.closest('a').href : '');
            if (directHref) {
                logStep('found card href, navigate direct: ' + directHref);
                try { location.href = directHref; window.__abx_bacc_loading_until = Date.now() + guardMs; return 'nav-href'; } catch (_) {}
            }

            const ok = await multiTryClick(resolverForClick, 50, () => false, 200, 700);
            if (!ok) {
                if (typeof updateInfo === 'function') {
                    const info = [
                        'Khong the click vao game "Baccarat nhieu ban" (PP). Nut co the bi khoa hoac trang chan dieu huong.',
                        'URL: ' + (location.href || ''),
                        'Title: ' + (document.title || '')
                    ].join('\\n');
                    updateInfo(info);
                }
                logStep('no-click after retries, url=' + (location.href || ''));
                // fallback: nếu card có href/data-url thì điều hướng thẳng
                const href =
                    (card && (card.getAttribute('href') || (card.dataset && (card.dataset.href || card.dataset.url)))) ||
                    (card && card.closest('a') ? card.closest('a').href : '');
                if (href) {
                    logStep('click fail -> navigate direct ' + href);
                    try { location.href = href; return 'nav-href'; } catch (_) {}
                }
                try { console && console.warn && console.warn('[BaccMulti] no-click', { href: location.href, title: document.title }); } catch (_) {}
                return 'no-click';
            }

            if (typeof updateInfo === 'function')
                updateInfo('Da click vao game "Baccarat nhieu ban" (PP).');

            return 'ok';
        } catch (e) {
            try { console && console.warn && console.warn('[HomeWatch] clickBaccNhieuBanFromHome error:', e); } catch (_) {}
            return 'err:' + (e && e.message ? e.message : String(e));
        }
    }

    // Reset guard khi quay ve home (tranh mang guard tu PP ve khien lan sau bi chan)
    if (!window.__abx_bacc_guard_reset) {
        window.__abx_bacc_guard_reset = setInterval(() => {
            try {
                const href = location.href || '';
                const host = (new URL(href, location.href)).hostname || '';
                const isHomeHost = /rr\d+\.com/i.test(host) || host.includes('rr5309.com') || host.includes('www.rr');
                if (isHomeHost && window.__abx_bacc_loading_until) {
                    window.__abx_bacc_loading_until = 0;
                    try { updateInfo && updateInfo('[bacc] reset guard on home host'); } catch (_) {}
                    try { console && console.warn && console.warn('[BaccMulti] reset guard on home host'); } catch (_) {}
                }
            } catch (_) {}
        }, 1000);
    }    // Auto retry trong lobby PP: cu thay lobby thi thu click "Baccarat nhieu ban"
      if (!window.__abx_bacc_lobby_retry) {
          let __abx_bacc_auto_state = '';
          window.__abx_bacc_lobby_retry = setInterval(async () => {
              try {
                  if (!isOnPPLobby()) {
                      if (__abx_bacc_auto_state !== 'not-lobby') {
                          try { updateInfo && updateInfo('[bacc-auto] Skip: chua o lobby PP'); } catch (_) {}
                          __abx_bacc_auto_state = 'not-lobby';
                      }
                      return;
                  }
                  // tránh spam khi vừa click/đang load game
                  if (window.__abx_bacc_loading_until && Date.now() < window.__abx_bacc_loading_until) {
                      if (__abx_bacc_auto_state !== 'guard') {
                          try { updateInfo && updateInfo('[bacc-auto] Guard active, doi het thoi gian...'); } catch (_) {}
                          __abx_bacc_auto_state = 'guard';
                      }
                      return;
                  }
                  try { updateInfo && updateInfo('[bacc-auto] Dang thu click "Baccarat nhieu ban" trong lobby...'); } catch (_) {}
                  const res = await clickBaccNhieuBanInPPLobby(6000);
                  try { console && console.warn && console.warn('[BaccMulti][auto] result:', res); } catch (_) {}
                  try { updateInfo && updateInfo('[bacc-auto] Ket qua: ' + res); } catch (_) {}
                  __abx_bacc_auto_state = 'res:' + res;
                  if (res === 'ok') {
                      window.__abx_bacc_loading_until = Date.now() + 5000;
                  }
              } catch (_) { }
          }, 200);
      }

    async function clickXocDiaLive() {
    // 1) Đảm bảo đang ở Home
    await ensureOnHome();

    // 2) Tìm nút đúng (ưu tiên tail cố định)
    const resolveBtnFallback = () => {
        // 1) Thử tail cố định trước
        const items = Array.from(document.querySelectorAll('.livestream-section__live .item-live'));
        const cand = [];

        items.forEach((it, idx) => {
            // văn bản toàn item + alt/title ảnh
            const scopeTxt = norm([
                        it.innerText,
                        ...Array.from(it.querySelectorAll('img[alt],img[title]'))
                        .map(img => img.alt || img.title || '')
                    ].join(' '));

            // Tài Xỉu / Sicbo / Dice => điểm dương, Xóc Đĩa => điểm âm
            const wCtxPos = RE_XOCDIA_POS.test(scopeTxt) ? 6 : 0;
            const wCtxNeg = RE_XOCDIA_NEG.test(scopeTxt) ? -10 : 0;

            const btns = Array.from(
                    it.querySelectorAll('.play-overlay button.base-button.btn, button.base-button.btn, a.base-button.btn'));

            btns.forEach(b => {
                const lbl = norm(textOf(b));
                const wBtnPos = RE_XOCDIA_POS.test(lbl) ? 4 : 0;
                const wBtnNeg = RE_XOCDIA_NEG.test(lbl) ? -10 : 0;

                // 🔥 ƯU TIÊN THỨ TỰ ITEM:
                // - idx === 0: Tài Xỉu Live (item đầu tiên) -> +3
                // - idx 1, 2: vẫn được cộng nhẹ +1
                const idxBoost = (idx === 0 ? 3 : (idx <= 2 ? 1 : 0));

                const score = wCtxPos + wCtxNeg + wBtnPos + wBtnNeg + idxBoost;
                cand.push({
                    el: b,
                    score,
                    idx
                });
            });
        });

        // Sắp xếp theo score, lấy cái tốt nhất và còn click được
        cand.sort((a, b) => b.score - a.score);
        const top = cand.find(c => c.score > 0 && isVisibleAndClickable(c.el));
        return top ? top.el : null; // ❗ KHÔNG fallback “nút thứ 2” nữa
    };

    // 3) Đóng quảng cáo/cover phổ biến trước
    closeAdsAndCovers();

    // 4) Chờ nút theo 2 pha: 5s chỉ tail, rồi phần còn lại cho fallback (tổng ≤12s)
    const WAIT_MS = 12000;
    const TAIL_ONLY_MS = 5000;

    // Pha 1: chỉ đợi tail cố định
    const tailBtn = await waitButtonUpTo(() => {
        const b = findByTail(TAIL_XOCDIA_BTN);
        return (b && isVisibleAndClickable(b)) ? b : null;
    }, TAIL_ONLY_MS, 200);

    let btn = tailBtn;

    // Pha 2: nếu chưa có tail, đợi phần còn lại cho các điều kiện fallback
    if (!btn) {
        const restMs = Math.max(0, WAIT_MS - TAIL_ONLY_MS);
        btn = await waitButtonUpTo(resolveBtnFallback, restMs, 200);
    }

    if (!btn) {
        updateInfo('⚠ Không tìm thấy nút "Chơi Xóc Đĩa Live" trong ≤' + Math.round(WAIT_MS / 1000) + 's sau khi về trang Home.');
        return;
    }

    // Resolver click: ưu tiên nút đã tìm thấy (tail hoặc fallback); nếu không còn khả dụng, fallback tiếp
    const resolveBtnFallbackSafe = () => resolveBtnFallback();
    const resolverForClick = () => (btn && isVisibleAndClickable(btn)) ? btn : resolveBtnFallbackSafe();

    // 5) Click 1–3 lần (auto) + xuyên overlay
    const ok = await multiTryClick(resolverForClick, 3, isXocDiaLaunched);
    if (ok) {
        updateInfo('→ Đã tự động click (đợi nút trong ≤' + Math.round(WAIT_MS / 1000) + 's, sau đó click 1–3 lần) để vào "Chơi Xóc Đĩa Live".');
    } else {
        updateInfo('⚠ Không thể vào "Chơi Xóc Đĩa Live". Nút có thể bị khoá hoặc trang chặn điều hướng.');
    }
}

    // ======= Multi-table Overlay =======
    (function installTableOverlay() {
        const OVERLAY_ID = '__abx_table_overlay_root';
        const RESET_BTN_ID = '__abx_table_overlay_reset';
        const PANEL_CLASS = '__abx_table_panel';
        const LAYOUT_KEY = '__abx_table_layout_v1';
        const GAP = 8;
        const MIN_W = 180;
        const MIN_H = 140;

        let rooms = [];
        let layouts = loadLayouts();
        const panelMap = new Map();
        let cfg = {
            // callback: (roomId) => HTMLElement | null
            resolveDom: null,
            selectorTemplate: '',
            baseSelector: ''
        };

        function loadLayouts() {
            try {
                const raw = localStorage.getItem(LAYOUT_KEY);
                if (!raw)
                    return {};
                const obj = JSON.parse(raw);
                return (obj && typeof obj === 'object') ? obj : {};
            } catch (_) {
                return {};
            }
        }
        function saveLayouts() {
            try {
                localStorage.setItem(LAYOUT_KEY, JSON.stringify(layouts || {}));
            } catch (_) {}
        }

        function ensureStyles() {
            if (document.getElementById('__abx_table_overlay_style'))
                return;
            const style = document.createElement('style');
            style.id = '__abx_table_overlay_style';
            style.textContent = `
            #${OVERLAY_ID} {
                position: fixed;
                inset: 0;
                z-index: 2147480000;
                pointer-events: none;
            }
            #${OVERLAY_ID} .${PANEL_CLASS} {
                position: absolute;
                background: #0b1d4a;
                color: #f4f5fb;
                border-radius: 12px;
                box-shadow: 0 10px 26px rgba(0,0,0,0.35);
                overflow: hidden;
                display: flex;
                flex-direction: column;
                pointer-events: auto;
                border: 1px solid rgba(255,255,255,0.08);
            }
            #${OVERLAY_ID} .${PANEL_CLASS} .head {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 6px 10px;
                gap: 8px;
                background: linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02));
                user-select: none;
                cursor: move;
            }
            #${OVERLAY_ID} .${PANEL_CLASS} .head .title {
                font-weight: 700;
                font-size: 14px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            #${OVERLAY_ID} .${PANEL_CLASS} .head .actions {
                display: flex;
                gap: 6px;
            }
            #${OVERLAY_ID} .${PANEL_CLASS} .head button {
                border: none;
                background: rgba(255,255,255,0.12);
                color: #fefefe;
                padding: 4px 6px;
                border-radius: 6px;
                cursor: pointer;
                font-weight: 600;
            }
            #${OVERLAY_ID} .${PANEL_CLASS} .head button:hover {
                background: rgba(255,255,255,0.22);
            }
            #${OVERLAY_ID} .${PANEL_CLASS} .body {
                flex: 1;
                background: #0f1733;
                overflow: hidden;
            }
            #${OVERLAY_ID} .${PANEL_CLASS} .body > .mirror {
                width: 100%;
                height: 100%;
                overflow: hidden;
            }
            #${OVERLAY_ID} .${PANEL_CLASS} .resize {
                position: absolute;
                width: 14px;
                height: 14px;
                right: 2px;
                bottom: 2px;
                cursor: se-resize;
                background: rgba(255,255,255,0.15);
                border-radius: 4px;
            }
            #${RESET_BTN_ID} {
                position: fixed;
                top: 8px;
                right: 12px;
                z-index: 2147480001;
                padding: 8px 10px;
                border-radius: 8px;
                border: none;
                background: #2563eb;
                color: white;
                font-weight: 700;
                cursor: pointer;
                pointer-events: auto;
                box-shadow: 0 6px 18px rgba(0,0,0,0.22);
            }`;
            document.head.appendChild(style);
        }

        function ensureRoot() {
            ensureStyles();
            let root = document.getElementById(OVERLAY_ID);
            if (!root) {
                root = document.createElement('div');
                root.id = OVERLAY_ID;
                document.body.appendChild(root);
            }
            let resetBtn = document.getElementById(RESET_BTN_ID);
            if (!resetBtn) {
                resetBtn = document.createElement('button');
                resetBtn.id = RESET_BTN_ID;
                resetBtn.textContent = 'Reset layout';
                resetBtn.addEventListener('click', () => resetLayout());
                document.body.appendChild(resetBtn);
            }
            return root;
        }

        function clamp(v, min, max) {
            return Math.max(min, Math.min(max, v));
        }

        function computeGrid(n) {
            const cols = Math.ceil(Math.sqrt(n));
            const rows = Math.ceil(n / cols);
            return { cols, rows };
        }

        function defaultResolveDom(id) {
            try {
                const sel = [
                    `[data-table-id="${id}"]`,
                    `[data-id="${id}"]`,
                    `[data-game-id="${id}"]`,
                    `[data-tableid="${id}"]`,
                    `.table-${id}`,
                    `.table_${id}`
                ].join(',');
                const el = document.querySelector(sel);
                if (el)
                    return el;
                if (cfg.selectorTemplate) {
                    const s = cfg.selectorTemplate.replace(/\{id\}/g, id);
                    const el2 = document.querySelector(s);
                    if (el2)
                        return el2;
                }
                if (cfg.baseSelector) {
                    const matches = Array.from(document.querySelectorAll(cfg.baseSelector))
                        .filter(node => node && node.innerText && node.innerText.includes(id));
                    if (matches.length)
                        return matches[0];
                }
            } catch (_) {}
            return null;
        }

        function getPanelState(id) {
            return panelMap.get(id);
        }

        function syncPanel(id) {
            const st = getPanelState(id);
            if (!st || !st.panel)
                return;
            const src = st.resolve(id);
            if (!src || !src.isConnected) {
                st.body.textContent = 'Kh?ng t?m th?y b?n ' + id;
                st.lastSig = '';
                return;
            }
            const cs = getComputedStyle(src);
            const rect = src.getBoundingClientRect();
            if (cs.display === 'none' || cs.visibility === 'hidden' || rect.width < 1 || rect.height < 1)
                return;

            const sig = [
                src.outerHTML.length,
                cs.width, cs.height,
                cs.background, cs.color,
                src.className,
                src.getAttribute('data-state') || '',
                src.textContent.length
            ].join('|');
            if (sig === st.lastSig)
                return;
            st.lastSig = sig;

            const clone = cloneWithStyles(src);
            const host = st.mirror;
            if (host.firstChild)
                host.replaceChild(clone, host.firstChild);
            else
                host.appendChild(clone);
        }

        function scheduleSync(id) {
            const st = getPanelState(id);
            if (!st)
                return;
            if (st.scheduled)
                return;
            st.scheduled = true;
            requestAnimationFrame(() => {
                st.scheduled = false;
                syncPanel(id);
            });
        }

        function attachObserver(id, src) {
            const st = getPanelState(id);
            if (!st)
                return;
            if (st.obs)
                st.obs.disconnect();
            if (!src)
                return;
            st.obs = new MutationObserver(() => scheduleSync(id));
            st.obs.observe(src, {
                childList: true,
                characterData: true,
                attributes: true,
                subtree: true
            });
        }

        function cloneWithStyles(src) {
            const clone = src.cloneNode(false);
            copyStylesAll(src, clone);
            for (const child of src.childNodes) {
                clone.appendChild(child.nodeType === 1 ? cloneWithStyles(child) : child.cloneNode(true));
            }
            return clone;
        }

        function copyStylesAll(src, dst) {
            const cs = getComputedStyle(src);
            for (const prop of cs) {
                dst.style.setProperty(prop, cs.getPropertyValue(prop), cs.getPropertyPriority(prop));
            }
            dst.style.width = cs.width;
            dst.style.height = cs.height;
        }

        function createPanel(room, idx) {
            const root = ensureRoot();
            let panel = document.createElement('div');
            panel.className = PANEL_CLASS;
            panel.dataset.id = room.id;

            const head = document.createElement('div');
            head.className = 'head';
            const title = document.createElement('div');
            title.className = 'title';
            title.textContent = room.name || room.id;
            const actions = document.createElement('div');
            actions.className = 'actions';
            const btnPlay = document.createElement('button');
            btnPlay.textContent = 'Play';
            btnPlay.addEventListener('click', () => {
                try {
                    window.chrome?.webview?.postMessage?.({ type: 'table_play', id: room.id });
                } catch (_) {}
            });
            const btnClose = document.createElement('button');
            btnClose.textContent = '?';
            btnClose.title = '??ng';
            btnClose.addEventListener('click', () => {
                panel.style.display = 'none';
            });
            actions.append(btnPlay, btnClose);
            head.append(title, actions);

            const body = document.createElement('div');
            body.className = 'body';
            const mirror = document.createElement('div');
            mirror.className = 'mirror';
            body.appendChild(mirror);

            const resize = document.createElement('div');
            resize.className = 'resize';

            panel.append(head, body, resize);
            root.appendChild(panel);

            const st = {
                id: room.id,
                panel,
                body,
                mirror,
                obs: null,
                lastSig: '',
                scheduled: false,
                resolve: (id) => {
                    if (typeof cfg.resolveDom === 'function')
                        return cfg.resolveDom(id);
                    return defaultResolveDom(id);
                }
            };
            panelMap.set(room.id, st);
            makeDraggable(panel, head);
            makeResizable(panel, resize);
            placePanel(panel, idx);
            const src = st.resolve(room.id);
            attachObserver(room.id, src);
            scheduleSync(room.id);
        }

        function placePanel(panel, idx, forceGrid = false) {
            const root = ensureRoot();
            const rc = root.getBoundingClientRect();
            const n = rooms.length || 1;
            const { cols, rows } = computeGrid(n);
            const gap = GAP;
            const baseW = Math.max(MIN_W, (rc.width - gap * (cols + 1)) / cols);
            const baseH = Math.max(MIN_H, (rc.height - gap * (rows + 1)) / rows);
            const id = panel.dataset.id;
            const saved = !forceGrid && layouts && layouts[id];
            let x, y, w, h;
            if (saved) {
                ({ x, y, w, h } = layouts[id]);
                x = clamp(x, 0, rc.width - MIN_W);
                y = clamp(y, 0, rc.height - MIN_H);
                w = clamp(w, MIN_W, rc.width);
                h = clamp(h, MIN_H, rc.height);
            } else {
                const col = idx % cols;
                const row = Math.floor(idx / cols);
                w = baseW;
                h = baseH;
                x = gap + col * (baseW + gap);
                y = gap + row * (baseH + gap);
            }
            panel.style.width = w + 'px';
            panel.style.height = h + 'px';
            panel.style.left = x + 'px';
            panel.style.top = y + 'px';
        }

        function makeDraggable(panel, handle) {
            let dragging = false;
            let startX = 0;
            let startY = 0;
            let origX = 0;
            let origY = 0;
            const root = ensureRoot();
            const onDown = (e) => {
                e.preventDefault();
                dragging = true;
                startX = e.clientX;
                startY = e.clientY;
                origX = parseFloat(panel.style.left) || 0;
                origY = parseFloat(panel.style.top) || 0;
                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
            };
            const onMove = (e) => {
                if (!dragging)
                    return;
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                const rc = root.getBoundingClientRect();
                const w = panel.getBoundingClientRect().width;
                const h = panel.getBoundingClientRect().height;
                let nx = clamp(origX + dx, 0, rc.width - w);
                let ny = clamp(origY + dy, 0, rc.height - h);
                panel.style.left = nx + 'px';
                panel.style.top = ny + 'px';
            };
            const onUp = () => {
                if (!dragging)
                    return;
                dragging = false;
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                persistLayout(panel);
            };
            handle.addEventListener('mousedown', onDown);
        }

        function makeResizable(panel, handle) {
            let resizing = false;
            let startX = 0;
            let startY = 0;
            let origW = 0;
            let origH = 0;
            const root = ensureRoot();
            const onDown = (e) => {
                e.preventDefault();
                e.stopPropagation();
                resizing = true;
                startX = e.clientX;
                startY = e.clientY;
                const rc = panel.getBoundingClientRect();
                origW = rc.width;
                origH = rc.height;
                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
            };
            const onMove = (e) => {
                if (!resizing)
                    return;
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                const rootRect = root.getBoundingClientRect();
                const left = parseFloat(panel.style.left) || 0;
                const top = parseFloat(panel.style.top) || 0;
                let nw = clamp(origW + dx, MIN_W, rootRect.width - left);
                let nh = clamp(origH + dy, MIN_H, rootRect.height - top);
                panel.style.width = nw + 'px';
                panel.style.height = nh + 'px';
            };
            const onUp = () => {
                if (!resizing)
                    return;
                resizing = false;
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                persistLayout(panel);
            };
            handle.addEventListener('mousedown', onDown);
        }

        function persistLayout(panel) {
            const id = panel.dataset.id;
            const rc = panel.getBoundingClientRect();
            layouts[id] = {
                x: rc.left,
                y: rc.top,
                w: rc.width,
                h: rc.height
            };
            saveLayouts();
        }

        function layoutAll(forceGrid = false) {
            rooms.forEach((r, idx) => {
                const st = getPanelState(r.id);
                if (!st || !st.panel)
                    return;
                placePanel(st.panel, idx, forceGrid);
            });
        }

        function renderRooms(list, options = {}) {
            cfg = Object.assign(cfg, options || {});
            rooms = (list || []).map(r => {
                if (typeof r === 'string')
                    return { id: r, name: r };
                if (r && r.id)
                    return { id: r.id, name: r.name || r.id };
                return null;
            }).filter(Boolean);

            const root = ensureRoot();
            // remove stale panels
            Array.from(panelMap.keys()).forEach(id => {
                if (!rooms.find(r => r.id === id)) {
                    const st = getPanelState(id);
                    if (st && st.panel && st.panel.parentElement === root)
                        root.removeChild(st.panel);
                    if (st && st.obs)
                        st.obs.disconnect();
                    panelMap.delete(id);
                    delete layouts[id];
                }
            });

            rooms.forEach((room, idx) => {
                if (!panelMap.has(room.id)) {
                    createPanel(room, idx);
                }
            });

            layoutAll(false);
        }

        function resetLayout() {
            layouts = {};
            saveLayouts();
            layoutAll(true);
        }

        function hide() {
            const root = document.getElementById(OVERLAY_ID);
            const btn = document.getElementById(RESET_BTN_ID);
            if (root)
                root.style.display = 'none';
            if (btn)
                btn.style.display = 'none';
        }

        function show() {
            const root = ensureRoot();
            root.style.display = '';
            const btn = document.getElementById(RESET_BTN_ID);
            if (btn)
                btn.style.display = '';
        }

        window.__abxTableOverlay = {
            render: renderRooms,
            reset: resetLayout,
            hide,
            show
        };
    })();

    // ======= Boot =======
    function ensureOverlayHost() {
    // đảm bảo overlay tồn tại và listeners đã gắn
    return ensureOverlay();
}
    // NEW: loop định kỳ để tự động đóng popup/thông báo
    function ensureAutoClosePopups() {
    if (window.__abx_auto_close_popup)
        return;
    window.__abx_auto_close_popup = setInterval(() => {
        try {
            closeAdsAndCovers();
        } catch (_) {}
    }, 2000); // 2s/lần, đủ để tắt popup mà không spam
}

    function boot() {
    try {
        onDomReady(() => {
            ensureRoot();
            ensureOverlayHost();
            ensureAutoClosePopups(); // NEW: auto đóng popup/thông báo
            // Nếu đã nhận diện đang đăng nhập -> mở cổng ngay
            try {
                if (isLoggedInFromDOM()) {
                    S.authGateOpened = true;
                }
            } catch (_) {}

            // Sau boot – kiểm tra lại khi tab trở lại foreground (login popup/redirect)
            if (!window.__abx_vis_listener) {
                window.__abx_vis_listener = true;
                document.addEventListener('visibilitychange', () => {
                    if (!document.hidden) {
                        onAuthStateMaybeChanged('vis'); // cập nhật username -> fetch/iframe nếu cần
                        const bv = findBalance();
                        if (bv)
                            updateBalance(bv);
                    }
                });

            }

            // Chỉ khi nhìn thấy nút "Đăng nhập" mới bắt đầu các tiến trình Username/Balance
            waitFor(() => !!findLoginButton(), 30000, 150).then(ok => {
                if (ok) {
                    S.authGateOpened = true;
                    // có thể bơm nhẹ một vòng để điền nhanh
                    pumpAuthProbe(4000, 300);

                    // NEW: nếu CHƯA login và popup đăng nhập CHƯA hiển thị
                    // thì tự động bật vòng auto click nút "Đăng nhập"
                    try {
                        if (!isLoginPopupVisible() && !isLoggedInFromDOM()) {
                            startLoginAutoClick();
                        }
                    } catch (_) {}
                }
            });

            // Cài mute telemetry trong các iframe cùng origin
            Array.from(document.querySelectorAll('iframe')).forEach(f => {
                try {
                    const w = f.contentWindow;
                    if (w && w.location && w.location.origin === location.origin) {
                        installTelemetryMutesInFrame(w);
                        f.setAttribute('data-abx-tmuted', '1'); // đánh dấu đã mute
                        f.addEventListener('load', () => installTelemetryMutesInFrame(f.contentWindow));

                    }
                } catch (_) {}
            });

            // cập nhật ngay lần đầu theo DOM hiện có (chỉ set khi có giá trị)
            const u0 = canRunAuthLoop() ? findUserFromDOM() : '';
            if (u0)
                updateUsername(u0);
            ensureObserver();
            const b0 = canRunAuthLoop() ? findBalance() : '';
            if (b0)
                updateBalance(b0);

            updateInfo(); // <— render panel
            startUsernameWatchdog();

            // one-shot: sau 500ms nếu vẫn chưa có username thì fetch profile / iframe
            setTimeout(async() => {
                if (!S.username) {
                    const ok = await tryFetchUserProfile();
                    if (!ok)
                        probeIframeOnce();
                }
            }, 500);

            // one-shot: khi trang “pageshow” (SPA quay lại / điều hướng xong) thử lại 1 lần
            window.addEventListener('pageshow', async() => {
                if (!S.username) {
                    const ok = await tryFetchUserProfile();
                    if (!ok)
                        probeIframeOnce();
                }
                const bp = findBalance();
                if (bp)
                    updateBalance(bp);
                pumpAuthProbe(8000, 200);
            }, {
                once: true
            });

        });

    } catch (e) {
        console.error('[HomeWatch] boot error', e);
    }
}
    if (IS_TOP) {
        boot();
    }
    })();
