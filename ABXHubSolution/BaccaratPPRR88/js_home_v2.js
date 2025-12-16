(function () {
    'use strict';
    // Muốn hiện và ẩn bảng điều khiển home watch thì tìm dòng sau : showPanel: false // ⬅️ false = ẩn panel; true = hiện panel
    if (window.self !== window.top) {
        return;
    }
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
    if (/^games\./i.test(location.hostname)) {
        console.debug('[HomeWatch] Skip on game host');
        return;
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
        'html.windows-os[1]/body._style[1]/div[2]/div.header[1]/div.v--modal-overlay[3]/div.v--modal-background-click[1]/div.v--modal-box.v--modal[2]/div.tcg_modal_wrap.loginPopupModal[1]';

    // Danh sách popup quảng cáo/thông báo cần auto tắt
    const CLOSE_POPUP_ROOT_TAILS = [
        // Popup thông báo RR88 HƯỚNG VỀ MIỀN LŨ...
        'html.windows-os[1]/body._style[1]/div[2]/div.br_index_main.br_main[3]/div.v--modal-overlay[2]/div.v--modal-background-click[1]/div.v--modal-box.v--modal[2]/div.tcg_modal_wrap.publicModal[1]',
        // Overlay bọc ngoài
        'html.windows-os[1]/body._style[1]/div[2]/div.br_index_main.br_main[3]/div.v--modal-overlay[2]'
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
        overlayLog: ''
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

    function balLog(...args) {
        if (!DEBUG_BAL)
            return;
        // Dùng mức debug để không làm bẩn console khi không cần
        console.debug('[HW][BAL]', ...args); // hiển thị khi bật Verbose/Debug. :contentReference[oaicite:2]{index=2}
    }

    function isLoggedInFromDOM() {
        // 1) Có tên -> chắc chắn logged-in
        const v = findUserFromDOM();
        if (v && v.trim())
            return true;
        // 2) Có khối user đang HIỂN THỊ -> tạm xem là logged-in
        const block = document.querySelector('.user-logged, .base-dropdown-header__user__name, .user__name, .header .user-info, .hd_login .user-name, .logined_wrap');
        if (block && block.offsetParent !== null)
            return true;
        // 3) Thấy nút/khối Đăng xuất hoặc số dư trên header
        const logoutBtn = Array.from(document.querySelectorAll('a,button')).find(el => /dang\s*xuat|logout/i.test(norm(textOf(el))));
        if (logoutBtn && logoutBtn.offsetParent !== null)
            return true;
        const balanceNode = Array.from(document.querySelectorAll('.balance, .balance-text, .user-balance, .nav_item .balance, .balance-box .balance, .logined_wrap .balance-box'))
            .find(el => /\d/.test(norm(textOf(el))));
        if (balanceNode && balanceNode.offsetParent !== null)
            return true;
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

    // NEW: nhận biết popup đăng nhập đã hiển thị hay chưa
    function isLoginPopupVisible() {
        try {
            if (typeof TAIL_LOGIN_POPUP_ROOT === 'string' && TAIL_LOGIN_POPUP_ROOT) {
                const el = findByTail(TAIL_LOGIN_POPUP_ROOT);
                if (el && el.offsetParent !== null)
                    return true;
            }
            // fallback heuristics: một số class/modal phổ biến
            const sel = '.tcg_modal_wrap.loginPopupModal, .loginPopupModal, .popup-login, .login-popup, .modal-login, .login__popup';
            const el2 = document.querySelector(sel);
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

            const autoScanBtn = document.createElement('button');
            autoScanBtn.textContent = 'Auto Scan';
            autoScanBtn.style.background = '#0b122e';
            autoScanBtn.style.border = '1px solid #334155';
            autoScanBtn.style.color = '#e5e7eb';
            autoScanBtn.style.padding = '6px 10px';
            autoScanBtn.style.borderRadius = '8px';
            autoScanBtn.style.cursor = 'pointer';

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
            btnRow.appendChild(autoScanBtn);
            wrap.appendChild(btnRow);
            wrap.appendChild(out);
            const tableStatus = document.createElement('div');
            tableStatus.style.fontSize = '11px';
            tableStatus.style.color = '#cbd5f5';
            tableStatus.style.marginTop = '6px';
            tableStatus.textContent = 'Table scan: chưa chạy';
            wrap.appendChild(tableStatus);
            root.appendChild(wrap);

            const CARD_SELECTORS = [
                '[data-table-id]',
                '[data-id]',
                '[data-game-id]',
                '[data-tableid]',
                '[data-tableId]',
                '.tile-container',
                '.ep_bn',
                '.qW_rl',
                '.hC_hE',
                '.hu_hw'
            ];
            const NAME_SELECTORS = '.rY_sn, .qL_qM.qL_qN, .tile-name, .title, .game-title, .qW_rl span, .qW_rl .title';
            const ATTR_CANDIDATES = [
                'data-table-id',
                'data-id',
                'data-game-id',
                'data-tableid',
                'data-tableId',
                'data-gametable-id',
                'data-lobbytable-id',
                'data-table',
                'data-key',
                'data-code',
                'data-guid',
                'data-room',
                'data-ref',
                'data-name',
                'aria-controls',
                'aria-labelledby',
                'aria-label',
                'title',
                'id'
            ];

            const formatRect = (rect) => rect ? ({
                x: Math.round((rect.left != null ? rect.left : rect.x) || 0),
                y: Math.round((rect.top != null ? rect.top : rect.y) || 0),
                width: Math.round((rect.width != null ? rect.width : rect.w) || 0),
                height: Math.round((rect.height != null ? rect.height : rect.h) || 0)
            }) : null;

            const normalizeText = (value) => (value || '').replace(/\s+/g, ' ').trim();

            const parseCounts = (text) => {
                const result = { player: null, banker: null, tie: null };
                const patterns = {
                    player: [/player(?:\s*\d*)?\s*(\d+)/i, /người chơi\s*(\d+)/i],
                    banker: [/banker(?:\s*\d*)?\s*(\d+)/i, /nhà cái\s*(\d+)/i],
                    tie: [/tie(?:\s*\d*)?\s*(\d+)/i, /hòa\s*(\d+)/i]
                };
                for (const [key, regs] of Object.entries(patterns)) {
                    for (const re of regs) {
                        const match = (text || '').match(re);
                        if (match) {
                            result[key] = Number.parseInt(match[1], 10);
                            break;
                        }
                    }
                }
                return result;
            };

            const toNumber = (str) => {
                if (!str) return null;
                const cleaned = str.replace(/[.,]+(?=\d)/g, '');
                const asNum = Number(cleaned);
                return Number.isFinite(asNum) ? asNum : null;
            };

            const parseBets = (text) => {
                const result = { player: null, banker: null, tie: null };
                const patterns = {
                    player: [/người chơi[^\d]*(\d[\d.,]*)/i],
                    banker: [/nhà cái[^\d]*(\d[\d.,]*)/i],
                    tie: [/hòa[^\d]*(\d[\d.,]*)/i]
                };
                for (const [key, regs] of Object.entries(patterns)) {
                    for (const re of regs) {
                        const match = (text || '').match(re);
                        if (match) {
                            result[key] = toNumber(match[1]);
                            break;
                        }
                    }
                }
                return result;
            };

            const findSpot = (card, keywords) => {
                const nodes = Array.from(card.querySelectorAll('button,div,span'));
                for (const key of keywords) {
                    const lowerKey = (key || '').toLowerCase();
                    const hit = nodes.find(node => (node.textContent || '').toLowerCase().includes(lowerKey));
                    if (hit) {
                        return formatRect(hit.getBoundingClientRect());
                    }
                }
                return null;
            };

            const listDocuments = () => {
                const docs = [{ doc: document, label: 'top' }];
                document.querySelectorAll('iframe').forEach((frame, idx) => {
                    try {
                        const doc = frame.contentDocument;
                        if (doc) {
                            const label = frame.id || frame.name || frame.src || `iframe#${idx}`;
                            docs.push({ doc, label });
                        }
                    } catch (_) {}
                });
                return docs;
            };

            const collectCards = () => {
                const entries = [];
                const report = [];
                listDocuments().forEach(({ doc, label }) => {
                    const seen = new Set();
                    CARD_SELECTORS.forEach(sel => {
                        doc.querySelectorAll(sel).forEach(el => {
                            if (!el || seen.has(el))
                                return;
                            seen.add(el);
                            entries.push({ el, label });
                        });
                    });
                    report.push(`${label}: ${seen.size} phần tử`);
                });
                return { entries, report };
            };

            const NAME_IGNORE_PATTERN = /(đặt cược|cược|bet|đang|road|result|người chơi|nhà cái|hòa)/i;

            const extractId = (card) => {
                for (const attr of ATTR_CANDIDATES) {
                    const val = card.getAttribute && card.getAttribute(attr);
                    if (val)
                        return normalizeText(val);
                }
                const dataset = card.dataset || {};
                for (const key of Object.keys(dataset)) {
                    const val = dataset[key];
                    if (val)
                        return normalizeText(val);
                }
                return '';
            };

            const extractName = (card) => {
                const direct = card.querySelector(NAME_SELECTORS);
                if (direct) {
                    const txt = normalizeText(direct.textContent);
                    if (txt)
                        return txt;
                }
                const aria = normalizeText(card.getAttribute?.('aria-label') || card.getAttribute?.('title') || '');
                if (aria)
                    return aria;
                const candidates = Array.from(card.querySelectorAll('span,div,strong,p,h2,h3'))
                    .map(el => normalizeText(el.textContent))
                    .filter(txt => txt && /[a-z0-9]/i.test(txt))
                    .filter(txt => !NAME_IGNORE_PATTERN.test(txt));
                if (candidates.length)
                    return candidates[0];
                const fallback = normalizeText(card.textContent || '');
                return fallback ? fallback.slice(0, 80) : '';
            };

            const reportSuffix = (report) => report && report.length ? ' | ' + report.join(' | ') : '';

            const createPayload = () => {
                const { entries, report } = collectCards();
                if (!entries.length) {
                    return {
                        payload: null,
                        note: 'Không tìm thấy bàn chơi nào.' + reportSuffix(report)
                    };
                }
                const tables = entries.map(({ el }) => {
                    const textSnapshot = normalizeText(el.textContent || '');
                    const resultChain = Array.from(el.querySelectorAll('.np_nu, .yw_yz, .dw_result'))
                        .map(node => normalizeText(node.textContent))
                        .filter(Boolean)
                        .join('');
                    let id = extractId(el);
                    let name = extractName(el);
                    if (!id && name)
                        id = 'name:' + name.toLowerCase().replace(/\s+/g, '_');
                    if (!name && id)
                        name = id;
                    return {
                        id,
                        name,
                        countdown: (el.querySelector('[data-countdown], [class*=count]')?.textContent || '').replace(/[^\d]/g, '') || null,
                        resultChain,
                        counts: parseCounts(textSnapshot),
                        bets: parseBets(textSnapshot),
                        status: textSnapshot.toLowerCase().includes('betting') ? 'betting' : textSnapshot.toLowerCase().includes('result') ? 'result' : 'waiting',
                        playerSpot: findSpot(el, ['player', 'người chơi']),
                        bankerSpot: findSpot(el, ['banker', 'nhà cái']),
                        rect: formatRect(el.getBoundingClientRect())
                    };
                }).filter(entry => entry.id && entry.name);

                if (!tables.length) {
                    return {
                        payload: null,
                        note: `Đã thấy ${entries.length} phần tử nhưng thiếu id/name.` + reportSuffix(report)
                    };
                }

                return {
                    payload: { abx: 'table_update', tables },
                    note: `Đã thu được ${tables.length} bàn.` + reportSuffix(report)
                };
            };

            const sendPayload = (payload) => {
                if (!payload)
                    return;
                const text = JSON.stringify(payload);
                if (!text)
                    return;
                try {
                    if (window.chrome?.webview?.postMessage) {
                        chrome.webview.postMessage(text);
                        return;
                    }
                    if (window.top && window.top !== window && typeof window.top.postMessage === 'function') {
                        window.top.postMessage(text, '*');
                        return;
                    }
                } catch (err) {
                    console.warn('[HomeWatch] table_update send failed', err);
                }
            };

            const updateTableStatus = (msg) => {
                tableStatus.textContent = msg;
                console.log('[HomeWatch table_update]', msg);
            };

            let tableScanTimer = null;
            let lastPayload = '';

            const scanAndPost = () => {
                const { payload, note } = createPayload();
                if (!payload) {
                    updateTableStatus(note || 'Không tìm thấy bàn chơi nào.');
                    return;
                }
                const text = JSON.stringify(payload);
                if (text === lastPayload) {
                    updateTableStatus('Payload chưa thay đổi.');
                    return;
                }
                sendPayload(payload);
                lastPayload = text;
                const stamp = new Date().toLocaleTimeString();
                updateTableStatus(`${note || 'Đã gửi payload'} (${stamp})`);
            };

            autoScanBtn.onclick = () => {
                if (tableScanTimer) {
                    clearInterval(tableScanTimer);
                    tableScanTimer = null;
                    autoScanBtn.textContent = 'Auto Scan';
                    updateTableStatus('Auto scan dừng.');
                    return;
                }
                scanAndPost();
                tableScanTimer = setInterval(scanAndPost, 2500);
                autoScanBtn.textContent = 'Dừng Auto';
                updateTableStatus('Auto scan đang chạy...');
            };
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
        };
        root.querySelector('#' + CFG.scanTextsBtnId).onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            scanTexts(500);
        };
        root.querySelector('#' + CFG.scanClosePopupBtnId).onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            scanClosePopups(500);
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

        if (S.overlayLog)
            L.push('', 'Log: ' + S.overlayLog);

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

    function appendDevLog(line) {
        try {
            const out = document.getElementById('hw_dev_output');
            if (out) {
                const prev = out.textContent || '';
                out.textContent = (line || '') + '\n---\n' + prev;
                return;
            }
        } catch (_) {}
        try {
            console.log('[HW]', line);
        } catch (_) {}
    }

    const ALERT_ID = '__abx_alert_log_popup';

    function ensureAlertContainer() {
        let el = document.getElementById(ALERT_ID);
        if (el)
            return el;
        el = document.createElement('div');
        el.id = ALERT_ID;
        el.style.cssText = [
            'position:fixed', 'inset:12px 12px auto auto', 'z-index:2147481000',
            'width:320px', 'max-width:calc(100vw - 24px)', 'background:#081028',
            'color:#fefefe', 'padding:12px', 'border-radius:12px', 'box-shadow:0 12px 32px rgba(0,0,0,.65)',
            'border:1px solid rgba(255,255,255,0.12)', 'font:13px/1.4 Roboto,system-ui,sans-serif'
        ].join(';');
        el.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                <strong style="font-size:14px">Alert dữ liệu</strong>
                <button id="${ALERT_ID}-close" style="border:none;background:none;color:#fff;font-size:18px;cursor:pointer">×</button>
            </div>
            <textarea id="${ALERT_ID}-ta" style="width:100%;height:140px;background:#0b1525;border:1px solid rgba(255,255,255,0.15);color:#fefefe;padding:6px;border-radius:6px;resize:none;font:13px/1.4 Consolas,monospace"></textarea>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px">
                <button id="${ALERT_ID}-copy" style="border:none;padding:6px 12px;border-radius:6px;background:#2563eb;color:#fff;font-weight:600;cursor:pointer">Copy</button>
                <span style="font-size:11px;opacity:.7">Copy nhanh để gửi</span>
            </div>`;
        document.body.appendChild(el);
        const closeBtn = document.getElementById(`${ALERT_ID}-close`);
        closeBtn?.addEventListener('click', () => el.remove());
        const copyBtn = document.getElementById(`${ALERT_ID}-copy`);
        copyBtn?.addEventListener('click', async () => {
            try {
                const ta = document.getElementById(`${ALERT_ID}-ta`);
                if (ta && ta.value) {
                    await navigator.clipboard.writeText(ta.value);
                }
            } catch (_) { /* ignore */ }
        });
        return el;
    }

    function showTestAlert(content) {
        try {
            const el = ensureAlertContainer();
            const ta = document.getElementById(`${ALERT_ID}-ta`);
            if (ta) {
                ta.value = content;
                ta.focus();
                ta.select();
            }
        } catch (_) {}
    }

    window.__abx_hw_showDataAlert = showTestAlert;

    function setOverlayLog(msg) {
        try {
            S.overlayLog = clip(String(msg || ''), 180);
            updateInfo();
        } catch (_) {}
    }

    function installPostMessageLogger() {
        if (window.__abx_pm_hooked)
            return;
        const wv = window.chrome && window.chrome.webview;
        if (!wv || typeof wv.postMessage !== 'function')
            return;
        window.__abx_pm_hooked = true;
        const orig = wv.postMessage.bind(wv);
        wv.postMessage = function (data) {
            try {
                let obj = data;
                if (typeof data === 'string') {
                    try { obj = JSON.parse(data); } catch (_) {}
                }
                if (obj && obj.overlay === 'table') {
                    appendDevLog('[postMessage overlay] ' + JSON.stringify(obj));
                    const summary = [
                        '[overlay]',
                        obj.event ? ('event=' + obj.event) : '',
                        obj.id ? ('id=' + obj.id) : '',
                        Array.isArray(obj.tables) ? ('tables=' + obj.tables.length) : ''
                    ].filter(Boolean).join(' ');
                    setOverlayLog(summary || '[overlay]');
                }
            } catch (_) {}
            return orig.apply(this, arguments);
        };
        appendDevLog('Đã bật log postMessage (overlay).');
        setOverlayLog('Đã bật log overlay.');
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
            let m = e && e.data,
            cmd = '';
            try {
                cmd = (typeof m === 'string') ? JSON.parse(m).cmd : (m && m.cmd);
            } catch (_) {
                cmd = (m && m.cmd) || '';
            }
            switch (String(cmd || '')) {
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
                    const ms = (m && m.ms) || 800;
                    if (typeof window.__abx_hw_startPush === 'function')
                        window.__abx_hw_startPush(ms);
                } catch (_) {}
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
                root = document.querySelector(
                        '.tcg_modal_wrap.loginPopupModal, .tcg_modal_wrap.publicModal, .tcg_modal_wrap, ' +
                        '.loginPopupModal, .popup-login, .login-popup, .modal-login, .login__popup, .v--modal-box, .v--modal-overlay');
            }

            // Nếu popup chưa mở thì không làm gì
            if (!root || !root.isConnected || root.offsetParent === null) {
                // fallback: tìm modal chứa input password
                const pwParent = Array.from(document.querySelectorAll('input[type="password"]'))
                    .map(i => i.closest('.v--modal-box, .v--modal-overlay, .tcg_modal_wrap, .modal, .popup, .loginPopupModal, .login-popup, .modal-login'))
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
            const candSel =
                'button.submit_btn, .submit_btn[role="button"], button[type="submit"], .btn-login, .base-button.btn';
            let btn = Array.from(root.querySelectorAll(candSel)).find(isVisibleAndClickable) || null;

            // Fallback: quét toàn bộ button theo text "Đăng nhập"
            if (!btn) {
                const all = Array.from(
                        root.querySelectorAll('button, a, [role="button"], input[type="submit"]'));
                btn = all.find(el => {
                    const t = norm(textOf(el));
                    return t.includes('dang nhap') || t.includes('login');
                }) || null;
            }

            if (!btn || !isVisibleAndClickable(btn)) {
                return false;
            }

            // 4) Thực hiện click xuyên overlay nếu cần
            peelAndClick(btn, {
                holdMs: 400
            });
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
            stopLoginAutoClick('Đã đăng nhập — không auto click nút "Đăng nhập" nữa.');
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
                stopLoginAutoClick('Đã thấy trạng thái đăng nhập — dừng auto click nút "Đăng nhập".');
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
                stopLoginAutoClick('Đã đăng nhập — không auto click nút "Đăng nhập".');
                return;
            }
            // Thử chờ ngắn xem có nhận diện login sau khi DOM đầy đủ không
            waitFor(() => isLoggedInFromDOM(), 2500, 150).then((ok) => {
                if (ok) {
                    stopLoginAutoClick('Đã đăng nhập (sau chờ) — không auto click nút "Đăng nhập".');
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
        const PANEL_CLASS = '__abx_table_panel';
        const LAYOUT_KEY = '__abx_table_layout_v1';
        const GAP = 8;
        const MIN_W = 150;
        const MIN_H = 120;
        const STATE_INTERVAL = 900;

        let rooms = [];
        let layouts = loadLayouts();
        const panelMap = new Map();
        const lastStateSig = new Map();
        const roomDomRegistry = new Map();
        const pinSyncState = new Map();
        let stateTimer = null;
        let cfg = {
            resolveDom: null,
            selectorTemplate: '',
            baseSelector: ''
        };
        let highestZ = 2147480001;

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

        function bringToFront(panel) {
            if (!panel) return;
            panel.style.zIndex = (++highestZ).toString();
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
                background: #040b1e;
                color: #f8fafc;
                border-radius: 12px;
                box-shadow: 0 14px 32px rgba(0,0,0,0.55);
                overflow: hidden;
                display: flex;
                flex-direction: column;
                pointer-events: auto;
                border: 1px solid rgba(255,255,255,0.16);
                min-width: ${MIN_W}px;
                min-height: ${MIN_H}px;
            }
            #${OVERLAY_ID} .${PANEL_CLASS}.abx-closed {
                opacity: 0.2;
            }
            #${OVERLAY_ID} .${PANEL_CLASS} .head {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: calc(2px * var(--panel-scale, 1)) calc(32px * var(--panel-scale, 1)) calc(2px * var(--panel-scale, 1)) calc(12px * var(--panel-scale, 1));
                gap: 12px;
                background: #02040b;
                user-select: none;
                cursor: move;
            }
            #${OVERLAY_ID} .${PANEL_CLASS} .head .title {
                font-weight: 700;
                font-size: calc(9px * var(--panel-scale, 1));
                color: #fefefe;
                line-height: 1.1;
                padding: calc(2px * var(--panel-scale, 1)) 0;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            #${OVERLAY_ID} .${PANEL_CLASS} .head .actions {
                display: flex;
                gap: calc(10px * var(--panel-scale, 1));
                margin-right: calc(12px * var(--panel-scale, 1));
            }
            #${OVERLAY_ID} .${PANEL_CLASS} .head button {
                border: none;
                background: rgba(255,255,255,0.08);
                color: #fefefe;
                border-radius: calc(5px * var(--panel-scale, 1));
                cursor: pointer;
                font-weight: 600;
                font-size: calc(9px * var(--panel-scale, 1));
                line-height: 1;
                padding: calc(1px * var(--panel-scale, 1)) calc(8px * var(--panel-scale, 1));
                min-width: calc(32px * var(--panel-scale, 1));
                height: calc(22px * var(--panel-scale, 1));
                display: inline-flex;
                align-items: center;
                justify-content: center;
                transition: filter 0.2s ease, transform 0.2s ease;
                box-sizing: border-box;
            }
            #${OVERLAY_ID} .${PANEL_CLASS} .head button.play-btn {
                min-width: calc(34px * var(--panel-scale, 1));
            }
            #${OVERLAY_ID} .${PANEL_CLASS} .head button.play-btn {
                background: linear-gradient(135deg, #1d4ed8, #2563eb);
            }
            #${OVERLAY_ID} .${PANEL_CLASS} .panel-close {
                position: absolute;
                top: 2px;
                right: 2px;
                width: calc(18px * var(--panel-scale, 1));
                height: calc(18px * var(--panel-scale, 1));
                border-radius: 3px;
                border: none;
                background: #e11d48;
                color: #fff;
                font-size: calc(12px * var(--panel-scale, 1));
                line-height: 1;
                padding: 0;
                opacity: 0.95;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                transition: opacity 0.2s ease;
            }
            #${OVERLAY_ID} .${PANEL_CLASS} .panel-close:hover {
                opacity: 1;
            }
            #${OVERLAY_ID} .${PANEL_CLASS} .head button:hover {
                filter: brightness(1.05);
            }
            #${OVERLAY_ID} .${PANEL_CLASS} .body {
                flex: 1;
                background: #020b1f;
                display: flex;
                flex-direction: column;
                gap: calc(8px * var(--panel-scale, 1));
                padding: calc(10px * var(--panel-scale, 1));
                overflow: hidden;
            }
            #${OVERLAY_ID} .${PANEL_CLASS} .panel-info {
                display: flex;
                gap: calc(12px * var(--panel-scale, 1));
                align-items: center;
            }
            #${OVERLAY_ID} .${PANEL_CLASS} .panel-countdown {
                position: relative;
                width: calc(48px * var(--panel-scale, 1));
                height: calc(48px * var(--panel-scale, 1));
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-direction: column;
                margin-top: calc(-6px * var(--panel-scale, 1));
                font-weight: 600;
                color: #fefefe;
                align-self: flex-start;
                --countdown-progress: 0deg;
            }
            #${OVERLAY_ID} .${PANEL_CLASS} .panel-countdown::before {
                content: '';
                position: absolute;
                inset: 0;
                border-radius: 50%;
                background: conic-gradient(#22c55e var(--countdown-progress), rgba(34,197,94,0.18) var(--countdown-progress));
                opacity: 0.85;
            }
            #${OVERLAY_ID} .${PANEL_CLASS} .panel-countdown::after {
                content: '';
                position: absolute;
                inset: calc(6px * var(--panel-scale, 1));
                border-radius: 50%;
                background: #020b1f;
                box-shadow: inset 0 0 6px rgba(0,0,0,0.5);
            }
            #${OVERLAY_ID} .${PANEL_CLASS} .panel-countdown .countdown-value {
                font-size: calc(13px * var(--panel-scale, 1));
                z-index: 1;
            }
            #${OVERLAY_ID} .${PANEL_CLASS} .panel-countdown .countdown-label {
                display: none;
            }
            #${OVERLAY_ID} .${PANEL_CLASS} .panel-meta {
                flex: 1;
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
                gap: calc(8px * var(--panel-scale, 1));
            }
            #${OVERLAY_ID} .${PANEL_CLASS} .panel-meta .meta-item {
                background: rgba(255,255,255,0.05);
                padding: calc(6px * var(--panel-scale, 1));
                border-radius: calc(6px * var(--panel-scale, 1));
                border: 1px solid rgba(255,255,255,0.07);
            }
            #${OVERLAY_ID} .${PANEL_CLASS} .panel-meta .meta-label {
                font-size: calc(9px * var(--panel-scale, 1));
                text-transform: uppercase;
                opacity: 0.7;
                margin-bottom: 2px;
            }
            #${OVERLAY_ID} .${PANEL_CLASS} .panel-meta .meta-value {
                font-size: calc(11px * var(--panel-scale, 1));
                font-weight: 600;
                color: #fefefe;
            }
            #${OVERLAY_ID} .${PANEL_CLASS} .panel-text {
                flex: 1;
                background: rgba(5,11,28,0.8);
                border-radius: calc(8px * var(--panel-scale, 1));
                border: 1px solid rgba(255,255,255,0.08);
                padding: calc(8px * var(--panel-scale, 1));
                font-size: calc(10px * var(--panel-scale, 1));
                line-height: 1.4;
                color: #dbeafe;
                overflow: auto;
                white-space: pre-wrap;
            }
            #${OVERLAY_ID} .${PANEL_CLASS} .resize {
                position: absolute;
                width: 16px;
                height: 16px;
                right: 4px;
                bottom: 4px;
                cursor: se-resize;
                background: rgba(255,255,255,0.18);
                border-radius: 4px;
            }
            `;
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
            return root;
        }

        function clamp(v, min, max) {
            return Math.max(min, Math.min(max, v));
        }

        function updatePanelScale(panel) {
            if (!panel) return;
            const rc = panel.getBoundingClientRect();
            const widthScale = clamp(rc.width / 240, 0.45, 1.9);
            const heightScale = clamp(rc.height / 180, 0.45, 1.9);
            const scale = Math.min(widthScale, heightScale);
            panel.style.setProperty('--panel-scale', scale.toString());
        }

        function computeGrid(n) {
            const count = Math.max(n, 1);
            const cols = Math.max(2, Math.ceil(Math.sqrt(count)));
            const rows = Math.max(2, Math.ceil(count / cols));
            return { cols, rows };
        }

        function rememberRoomDom(name, node) {
            if (!name || !node)
                return;
            roomDomRegistry.set(name, node);
        }

        function findCardRootByName(id) {
            if (!id)
                return null;
            const needle = (id || '').trim();
            if (!needle)
                return null;
            const cached = roomDomRegistry.get(needle);
            if (cached && cached.isConnected)
                return cached;
            if (cached && !cached.isConnected)
                roomDomRegistry.delete(needle);
            const selectors = ['span.rY_sn', 'span.qL_qM.qL_qN', 'div.abx-table-title', 'span.qW_rl', '.qW_rl'];
            for (const sel of selectors) {
                const list = Array.from(document.querySelectorAll(sel));
                const match = list.find(el => (el.textContent || '').trim() === needle);
                if (match) {
                    const root = match.closest('div.hq_hr') ||
                        match.closest('div.jF_jJ') ||
                        match.closest('div.cU_cV') ||
                        match.closest('div.kx_ca') ||
                        match.closest('div.kx_ky') ||
                        match.closest('div.hC_hE') ||
                        match.closest('div.ep_bn') ||
                        match.closest('div.hu_hw') ||
                        match.closest('.qW_rl') ||
                        match;
                    if (root)
                        rememberRoomDom(needle, root);
                    return root;
                }
            }
            return null;
        }

        const PIN_SELECTORS = [
            'div.qC_qE button',
            'div.qC_qE .gK_gB',
            'div.qC_qQ button',
            'div.qC_qQ .gK_gB',
            'button[aria-label*=\"ghim\" i]',
            'div[aria-label*=\"ghim\" i]',
            'button[title*=\"ghim\" i]',
            'div[title*=\"ghim\" i]',
            '[data-role*=\"favorite\"]',
            'button[aria-pressed]',
            'div.qC_qE',
            'div.qC_qQ'
        ];

        function resolvePinButton(root) {
            if (!root)
                return null;
            for (const sel of PIN_SELECTORS) {
                const el = root.querySelector(sel);
                if (!el)
                    continue;
                if (el.tagName === 'BUTTON')
                    return el;
                const btn = el.closest('button');
                if (btn)
                    return btn;
                if (typeof el.click === 'function')
                    return el;
            }
            return null;
        }

        function isPinActive(btn) {
            if (!btn)
                return false;
            const aria = btn.getAttribute && btn.getAttribute('aria-pressed');
            if (aria != null)
                return aria === 'true';
            const clsSources = [
                btn.className || '',
                btn.parentElement && btn.parentElement.className || '',
                btn.closest && (btn.closest('.qC_qE, .qC_qF, .qC_qH, .qC_qQ')?.className || '')
            ].filter(Boolean).join(' ');
            if (!clsSources)
                return false;
            return /\b(active|selected|on|checked|qC_qH)\b/i.test(clsSources);
        }

        function fireClick(el) {
            if (!el)
                return false;
            try {
                const evt = new MouseEvent('click', {
                        view: window,
                        bubbles: true,
                        cancelable: true
                    });
                el.dispatchEvent(evt);
                return true;
            } catch (_) {
                try {
                    el.click();
                    return true;
                } catch (_) {
                    return false;
                }
            }
        }

        function ensurePinState(roomId, shouldPin) {
            if (!roomId)
                return;
            const root = findCardRootByName(roomId);
            if (!root)
                return;
            const btn = resolvePinButton(root);
            if (!btn)
                return;
            const desired = !!shouldPin;
            const current = isPinActive(btn);
            if (current === desired) {
                if (desired)
                    pinSyncState.set(roomId, true);
                else
                    pinSyncState.delete(roomId);
                return;
            }
            if (fireClick(btn)) {
                if (desired)
                    pinSyncState.set(roomId, true);
                else
                    pinSyncState.delete(roomId);
            }
        }

        function syncPinStates(activeList) {
            const ids = Array.isArray(activeList) ? activeList : [];
            const activeSet = new Set(ids);
            activeSet.forEach(id => ensurePinState(id, true));
            Array.from(pinSyncState.keys()).forEach(id => {
                if (!activeSet.has(id))
                    ensurePinState(id, false);
            });
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

        if (!cfg.resolveDom)
            cfg.resolveDom = findCardRootByName;

        function parseStats(node) {
            if (!node)
                return null;
            const children = Array.from(node.children);
            const parseValue = item => {
                if (!item)
                    return null;
                const target = item.querySelector('div.np_nu') || item;
                const raw = (target.textContent || item.textContent || '').trim();
                const match = raw.match(/#?(\d+)/);
                return {
                    display: raw || '',
                    value: match ? Number(match[1]) : null
                };
            };
            return {
                total: parseValue(children[0]),
                player: parseValue(children[1]),
                banker: parseValue(children[2]),
                tie: parseValue(children[3])
            };
        }

        function parseHistory(root) {
            if (!root)
                return [];
            const nodes = Array.from(root.querySelectorAll('div.qR_lh, div.qR_qS span, div.qR_q1, div.qR_ra'));
            const text = nodes
                .map(el => (el.textContent || '').trim())
                .filter(Boolean);
            return text;
        }

        function getPanelState(id) {
            return panelMap.get(id);
        }

        function parseCountdownValue(raw) {
            const str = (raw || '').toString().trim();
            if (!str)
                return null;
            const mmss = str.match(/(\d{1,2})[:：](\d{2})/);
            if (mmss) {
                const mm = Number.parseInt(mmss[1], 10);
                const ss = Number.parseInt(mmss[2], 10);
                if (Number.isFinite(mm) && Number.isFinite(ss))
                    return mm * 60 + ss;
            }
            const num = Number.parseInt(str.replace(/[^\d]/g, ''), 10);
            return Number.isFinite(num) ? num : null;
        }

        function getClassString(el) {
            if (!el)
                return '';
            if (typeof el.className === 'string')
                return el.className;
            if (el.className && typeof el.className.baseVal === 'string')
                return el.className.baseVal;
            const cls = el.getAttribute && el.getAttribute('class');
            return cls || '';
        }

        function findCountdownNode(root) {
            if (!root)
                return null;
            const selectors = [
                'div.kM_lc span',
                'span.qL_qM.qL_qN',
                'div.yu_yv span',
                'div.kM_lc span.qL_qM',
                '.yI_yJ span.yI_yL',
                '.yI_yJ span.yI_yO',
                '.yI_yK span.yI_yL',
                '.yI_yK span.yI_yO',
                '.tT_on span.yI_yL',
                '.tT_on span.yI_yO'
            ];
            for (const sel of selectors) {
                try {
                    const node = root.querySelector(sel);
                    if (node && parseCountdownValue(node.textContent) != null)
                        return node;
                } catch (_) {}
            }
            const spans = Array.from(root.querySelectorAll('span'));
            for (const el of spans) {
                const txt = (el.textContent || '').trim();
                if (!/^\d{1,3}$/.test(txt))
                    continue;
                const cls = getClassString(el);
                if (/yI_y[LMO]/.test(cls))
                    return el;
                const pCls = getClassString(el.parentElement);
                if (/yI_y[JKO]|kM_lc|count/i.test(pCls))
                    return el;
            }
            return null;
        }

        function captureTableState(room) {
            try {
                const st = getPanelState(room.id);
                if (!st)
                    return null;
                const candidate = st.resolve(room.id);
                const src = candidate && candidate.isConnected ? candidate : findCardRootByName(room.name || room.id);
                if (!src || !src.isConnected)
                    return null;
                const countdownNode = findCountdownNode(src);
                const countdown = parseCountdownValue((countdownNode && countdownNode.textContent) || '');
                const statsNode = src.querySelector('div.np_nq:nth-of-type(2) div.np_nr');
                const stats = parseStats(statsNode);
                const history = parseHistory(src);
                const text = (src.innerText || src.textContent || '').replace(/\s+/g, ' ').trim();
                const sig = [
                    room.id,
                    countdown ?? '',
                    stats?.total?.display || '',
                    history.join('|'),
                    text.slice(0, 300)
                ].join('|');
                return {
                    id: room.id,
                    name: room.name || room.id,
                    countdown,
                    text,
                    history,
                    stats,
                    sig
                };
            } catch (_) {
                return null;
            }
        }

        function formatCountdownDisplay(value) {
            if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
                const mm = Math.floor(value / 60);
                const ss = Math.floor(value % 60);
                return mm + ':' + ss.toString().padStart(2, '0');
            }
            return '--';
        }

        function deriveStatusFromText(text) {
            if (!text)
                return 'Chưa có dữ liệu';
            const lowered = norm(text);
            if (lowered.includes('khong tim thay') || lowered.includes('khong t?m th?y'))
                return 'Không tìm thấy bàn';
            if (lowered.includes('dang doi') || lowered.includes('dang cho'))
                return 'Đang chờ';
            if (lowered.includes('ket qua') || lowered.includes('ketqua'))
                return 'Đang cập nhật';
            return 'Đang đồng bộ';
        }

        function deriveMetricInfo(text) {
            if (!text)
                return 'Chưa có dữ liệu';
            const lowered = norm(text);
            const match = lowered.match(/van\\s*#?(\\d+)/);
            if (match)
                return 'Ván #' + match[1];
            if (lowered.includes('ban nhieu'))
                return 'Đa bàn';
            return 'Đang đồng bộ';
        }

        function deriveBetInfo(text) {
            if (!text)
                return 'Chưa đặt';
            const lowered = norm(text);
            if (lowered.includes('chuong') || lowered.includes('banker'))
                return 'Nhà cái';
            if (lowered.includes('nguoi') || lowered.includes('player'))
                return 'Người chơi';
            if (lowered.includes('hoa') || lowered.includes('tie'))
                return 'Cửa hòa';
            return 'Chưa đặt';
        }

        function renderPanelState(data) {
            const st = getPanelState(data.id);
            if (!st || !st.view)
                return;
            st.lastState = data;
            const view = st.view;
            if (view.countdown)
                view.countdown.textContent = formatCountdownDisplay(data.countdown);
            if (view.countdownWrap) {
                const value = (typeof data.countdown === 'number' && Number.isFinite(data.countdown) && data.countdown >= 0)
                    ? Math.min(13, data.countdown)
                    : null;
                if (value == null) {
                    view.countdownWrap.style.removeProperty('--countdown-progress');
                } else {
                    const deg = (value / 13) * 360;
                    view.countdownWrap.style.setProperty('--countdown-progress', deg + 'deg');
                }
            }
            if (view.updated)
                view.updated.textContent = new Date().toLocaleTimeString();
            const historyText = data.history && data.history.length ? data.history.join(' · ') : data.text || '';
            if (view.status)
                view.status.textContent = deriveStatusFromText(historyText);
            if (view.text)
                view.text.textContent = historyText || 'Khong co du lieu';
            const stats = data.stats;
            if (view.metrics)
                view.metrics.textContent = stats?.total?.display || deriveMetricInfo(data.text);
            if (view.bets) {
                const statParts = [];
                if (stats?.player?.display)
                    statParts.push('P ' + stats.player.display);
                if (stats?.banker?.display)
                    statParts.push('B ' + stats.banker.display);
                if (stats?.tie?.display)
                    statParts.push('T ' + stats.tie.display);
                view.bets.textContent = statParts.join('  ') || deriveBetInfo(data.text);
            }
        }

        function pushStateIfChanged(states) {
            const changed = [];
            states.forEach(st => {
                if (!st)
                    return;
                const prev = lastStateSig.get(st.id);
                if (prev === st.sig)
                    return;
                lastStateSig.set(st.id, st.sig);
                changed.push({
                    id: st.id,
                    name: st.name,
                    countdown: st.countdown,
                    text: st.text
                });
            });
            if (!changed.length)
                return;
            try {
                window.chrome?.webview?.postMessage?.({
                    overlay: 'table',
                    event: 'state',
                    tables: changed
                });
            } catch (_) {}
        }

        function tickState() {
            if (!rooms.length)
                return;
            const states = rooms.map(r => captureTableState(r)).filter(Boolean);
            states.forEach(renderPanelState);
            pushStateIfChanged(states);
        }

        function stopStateTimer() {
            if (stateTimer) {
                clearInterval(stateTimer);
                stateTimer = null;
            }
        }

        function stopStateTimerIfIdle() {
            if (!rooms.length) {
                stopStateTimer();
                lastStateSig.clear();
            }
        }

        function ensureStateTimer() {
            if (!rooms.length) {
                stopStateTimerIfIdle();
                return;
            }
            if (!stateTimer)
                stateTimer = setInterval(tickState, STATE_INTERVAL);
            tickState();
        }

        function createPanel(room, idx) {
            const root = ensureRoot();
            const panel = document.createElement('div');
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
            btnPlay.className = 'play-btn';
            btnPlay.textContent = 'Play';
            btnPlay.addEventListener('click', () => {
                try {
                    window.chrome?.webview?.postMessage?.({ overlay: 'table', event: 'play', id: room.id });
                } catch (_) {}
            });
            actions.append(btnPlay);
            head.append(title, actions);

            const body = document.createElement('div');
            body.className = 'body';
            const info = document.createElement('div');
            info.className = 'panel-info';
            const countdownWrap = document.createElement('div');
            countdownWrap.className = 'panel-countdown';
            const countdownValue = document.createElement('div');
            countdownValue.className = 'countdown-value';
            countdownValue.textContent = '--';
            const countdownLabel = document.createElement('div');
            countdownLabel.className = 'countdown-label';
            countdownLabel.textContent = '';
            countdownWrap.append(countdownValue, countdownLabel);

            const meta = document.createElement('div');
            meta.className = 'panel-meta';
            const createMetaItem = (label, placeholder = '--') => {
                const wrap = document.createElement('div');
                wrap.className = 'meta-item';
                const lab = document.createElement('div');
                lab.className = 'meta-label';
                lab.textContent = label;
                const val = document.createElement('div');
                val.className = 'meta-value';
                val.textContent = placeholder;
                wrap.append(lab, val);
                return { wrap, value: val };
            };
            const updatedMeta = createMetaItem('Cập nhật', '--:--');
            const statusMeta = createMetaItem('Trạng thái', 'Chưa có dữ liệu');
            meta.append(updatedMeta.wrap, statusMeta.wrap);
            const metricsMeta = createMetaItem('Thông số', 'Chưa có');
            const betsMeta = createMetaItem('Đặt cược', 'N/A');
            meta.append(metricsMeta.wrap, betsMeta.wrap);
            info.append(countdownWrap, meta);

            const textBox = document.createElement('div');
            textBox.className = 'panel-text';
            textBox.textContent = 'Đang tải dữ liệu...';

            body.append(info, textBox);

            const resize = document.createElement('div');
            resize.className = 'resize';

            panel.append(head, body, resize);
            const closeBtn = document.createElement('button');
            closeBtn.className = 'panel-close';
            closeBtn.innerHTML = '&times;';
            closeBtn.title = 'Đóng bàn';
            closeBtn.addEventListener('click', () => closePanel(room.id));
            panel.appendChild(closeBtn);
            bringToFront(panel);
            root.appendChild(panel);

            const st = {
                id: room.id,
                panel,
                body,
                view: {
                    countdownWrap: countdownWrap,
                    countdown: countdownValue,
                    updated: updatedMeta.value,
                    status: statusMeta.value,
                    text: textBox,
                    metrics: metricsMeta.value,
                    bets: betsMeta.value
                },
                lastSig: '',
                lastState: null,
                closed: false,
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
            updatePanelScale(panel);
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
                bringToFront(panel);
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
                bringToFront(panel);
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
                updatePanelScale(panel);
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

        function normalizeRooms(list) {
            const seen = new Set();
            return (list || []).map(room => {
                if (typeof room === 'string')
                    return { id: room, name: room };
                if (room && room.id)
                    return { id: room.id, name: room.name || room.id };
                return null;
            }).filter(Boolean).filter(room => {
                if (seen.has(room.id))
                    return false;
                seen.add(room.id);
                return true;
            });
        }

        function closePanel(id, options = {}) {
            const { removeFromRooms = true, reflow = true, sendEvent = true } = options;
            const st = getPanelState(id);
            if (!st)
                return;
            panelMap.delete(id);
            if (st.panel && st.panel.parentElement)
                st.panel.parentElement.removeChild(st.panel);
            if (layouts && Object.prototype.hasOwnProperty.call(layouts, id))
                delete layouts[id];
            saveLayouts();
            if (removeFromRooms)
                rooms = rooms.filter(r => r.id !== id);
            if (reflow)
                layoutAll(true);
            if (sendEvent) {
                try {
                    window.chrome?.webview?.postMessage?.({ overlay: 'table', event: 'closed', id });
                } catch (_) {}
            }
            lastStateSig.delete(id);
            ensurePinState(id, false);
            pinSyncState.delete(id);
            stopStateTimerIfIdle();
        }

        function applyRooms(list, options = {}) {
            cfg = Object.assign(cfg, options || {});
            const normalized = normalizeRooms(list);
            ensureRoot();
            const activeIds = new Set(normalized.map(r => r.id));
            const toRemove = [];
            panelMap.forEach((_, id) => {
                if (!activeIds.has(id))
                    toRemove.push(id);
            });
            toRemove.forEach(id => closePanel(id, { removeFromRooms: false, reflow: false }));
            rooms = normalized;
            rooms.forEach((room, idx) => {
                if (!panelMap.has(room.id)) {
                    createPanel(room, idx);
                } else {
                    const st = getPanelState(room.id);
                    if (st)
                        placePanel(st.panel, idx);
                }
            });
            layoutAll(true);
            syncPinStates(rooms.map(r => r.id));
            ensureStateTimer();
        }

        function resetLayout() {
            layouts = {};
            saveLayouts();
            layoutAll(true);
        }

        function hide() {
            const root = document.getElementById(OVERLAY_ID);
            if (root)
                root.style.display = 'none';
        }

        function show() {
            const root = ensureRoot();
            if (root)
                root.style.display = '';
        }

        window.__abxTableOverlay = {
            openRooms: applyRooms,
            reset: resetLayout,
            hide,
            show,
            close: closePanel
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
            installPostMessageLogger();
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
    boot();
    })();
