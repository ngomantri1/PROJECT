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
        scanLinksBtnId: 'bscanl200',
        scanTextsBtnId: 'bscant200',
        overlayToggleBtnId: 'boverlay',
        copyBtnId: 'bcopyinfo',
        loginBtnId: 'blogin',
        xocBtnId: 'bxoc',
        autoRetryIntervalMs: 5000,
        maxRetries: 6,
        watchdogMs: 1000, // tick 1s kiểm tra username/balance
        maxWatchdogMiss: 2, // quá 2 nhịp miss -> startAutoRetry(true)
        showPanel: false, // ⬅️ false = ẩn panel; true = hiện panel
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

    // TAILs yêu cầu đặc biệt
    const TAIL_LOGIN_BTN =
        'div.page.hide[1]/header.menu.d-flex[1]/div.container[1]/div.menu__maxWidth.d-flex[1]/div.d-flex.align-items-center[2]/div.menu__right[1]/div.user-not-login.d-flex[1]/button.base-button.btn[1]';

    const TAIL_BALANCE =
        'div.d-flex.align-items-center[2]/div.menu__right[1]/div.user-logged.d-flex[1]/div.user-logged__info[1]/div.base-dropdown-header[1]/button.btn.btn-secondary[1]/div.left[1]/p.base-dropdown-header__user__amount[1]';

    const TAIL_XOCDIA_BTN =
        'div.livestream-section__live[2]/div.item-live[2]/div.live-stream[1]/div.player-wrapper[1]/div[1]/div.play-button[4]/div.play-overlay[1]/button.base-button.btn[1]';

    const TAIL_USER_INFO_ARROW =
        'div.menu__maxWidth.d-flex[1]/div.d-flex.align-items-center[2]/div.menu__right[1]/div.user-logged.d-flex[1]/div.user-logged__info[1]/div.base-dropdown-header[1]/button.btn.btn-secondary[1]/i.base-dropdown-header__user__icon.icon-arrow-down[1]';

    // ======= Game Regex (dùng trên chuỗi đã norm() — không dấu, lowercase) =======
    const RE_XOCDIA_POS = /\bxoc(?:[-\s]*dia)?\b/; // "xoc", "xoc dia", "xoc-dia", "xocdia"
    const RE_XOCDIA_NEG = /\b(?:tai|xiu|taixiu|sicbo|dice)\b/; // "tai", "xiu", "taixiu", "sicbo", "dice"

    // ======= State =======
    const S = {
        showL: false,
        showT: false,
        items: {
            link: [],
            text: []
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
        authGateOpened: false
    };

    const ROOT_Z = 2147483647;

    let _lastUserInfoExpand = 0;
    let _userInfoArrowClicked = false;

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

    function unescapeJsonString(str) {
        if (typeof str !== 'string')
            return '';
        return str
            .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => {
                try {
                    return String.fromCharCode(parseInt(hex, 16));
                } catch (_) {
                    return _;
                }
            })
            .replace(/\\\"/g, '"')
            .replace(/\\\\/g, '\\');
    }

    function extractUsernameFromHtml(html) {
        if (!html || typeof html !== 'string')
            return '';
        const patterns = [
            /"display[_-]?name"\s*:\s*"([^"]{2,80})"/i,
            /"full[_-]?name"\s*:\s*"([^"]{2,80})"/i,
            /"user[_-]?name"\s*:\s*"([^"]{2,80})"/i,
            /"account[_-]?name"\s*:\s*"([^"]{2,80})"/i
        ];
        for (const re of patterns) {
            const m = html.match(re);
            if (m && m[1]) {
                const cand = unescapeJsonString(m[1]).trim();
                if (isLikelyUsername(cand))
                    return cand;
            }
        }
        const meta = html.match(/<meta[^>]+name=["']user-name["'][^>]+content=["']([^"']+)["']/i);
        if (meta && meta[1] && isLikelyUsername(meta[1].trim()))
            return meta[1].trim();
        return '';
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
        const block = document.querySelector('.user-logged, .base-dropdown-header__user__name, .user__name');
        if (block && block.offsetParent !== null)
            return true;
        return false;
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

    function findLoginButton() {
        // Ưu tiên tail cố định bạn đang dùng
        let btn = findByTail(TAIL_LOGIN_BTN);
        if (!btn)
            btn = document.querySelector('header.menu .user-not-login .base-button.btn');
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
            '  <button id="' + CFG.scanLinksBtnId + '">Scan200LinksMap</button>',
            '  <button id="' + CFG.scanTextsBtnId + '">Scan200TextMap</button>',
            '  <button id="' + CFG.loginBtnId + '">Click Đăng Nhập</button>',
            '  <button id="' + CFG.xocBtnId + '">Chơi Xóc Đĩa Live</button>',
            '  <button id="' + CFG.retryBtnId + '">Thử lại (tự động)</button>',
            '  <button id="' + CFG.overlayToggleBtnId + '">Overlay</button>',
            '  <button id="' + CFG.copyBtnId + '">Copy Info</button>',
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
        root.querySelector('#' + CFG.scanLinksBtnId).onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            scanLinks(200);
        };
        root.querySelector('#' + CFG.scanTextsBtnId).onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            scanTexts(200);
        };
        root.querySelector('#' + CFG.overlayToggleBtnId).onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const ov = $overlay();
            if (ov)
                ov.style.display = (ov.style.display === 'none' ? 'block' : 'none');
        };
        root.querySelector('#' + CFG.copyBtnId).onclick = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            await copyInfoToClipboard();
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

    async function copyInfoToClipboard() {
        const box = document.getElementById(CFG.infoId);
        if (!box)
            return false;
        const text = (box.textContent || '').trim();
        if (!text) {
            flashCopyFeedback(false);
            return false;
        }
        let ok = false;
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            try {
                await navigator.clipboard.writeText(text);
                ok = true;
            } catch (_) {}
        }
        if (!ok) {
            try {
                const ta = document.createElement('textarea');
                ta.value = text;
                ta.style.position = 'fixed';
                ta.style.opacity = '0';
                document.body.appendChild(ta);
                ta.focus();
                ta.select();
                ok = document.execCommand('copy');
                document.body.removeChild(ta);
            } catch (_) {}
        }
        flashCopyFeedback(ok);
        return ok;
    }

    function flashCopyFeedback(ok) {
        const box = document.getElementById(CFG.infoId);
        if (!box)
            return;
        try {
            box.style.transition = 'box-shadow 0.2s ease';
            box.style.boxShadow = ok ? '0 0 0 2px #22c55e inset' : '0 0 0 2px #f97316 inset';
            clearTimeout(box.__abx_copyFlashTimer);
            box.__abx_copyFlashTimer = setTimeout(() => {
                box.style.boxShadow = '';
            }, 900);
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
                            ensureUserInfoExpanded();
                            // Ch? l?y theo ABS_USERNAME_TAIL, kh�ng fallback
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
            if (typeof clickXocDiaLive === 'function') {
                clickXocDiaLive();
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
                    if (typeof clickXocDiaLive === 'function')
                        clickXocDiaLive();
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
    const assignOrder = (items) => {
        items.forEach((it, i) => it.ord = i + 1);
        return items;
    };
    function render(kind) {
        const ov = ensureOverlay();
        clearOverlay(kind);
        const items = (kind === 'link') ? collectLinks() : collectTexts();
        items.sort(smallFirst);
        assignOrder(items);
        S.items[kind] = items;
        const draw = [...items].reverse();
        draw.forEach(it => ov.appendChild(mkBox(it, kind)));
    }
    const renderLinks = () => render('link');
    const renderTexts = () => render('text');
    window.__abx_overlay_rerender = () => {
        try {
            if (S.showL)
                renderLinks();
            if (S.showT)
                renderTexts();
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
        } else {
            S.showT = !S.showT;
            if (S.showT)
                renderTexts();
            else
                clearOverlay('text');
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
        let list = (S.items[kind] && S.items[kind].length) ? S.items[kind].slice() : assignOrder(((kind === 'link') ? collectLinks() : collectTexts()).sort(smallFirst));
        list.sort((a, b) => (a.ord || 0) - (b.ord || 0));
        return list;
    }
    function scanLinks(limit) {
        const all = getOrdered('link');
        const list = all.slice(0, Math.max(1, Math.min(limit || 200, all.length)));
        console.group('[link] Scan ' + list.length + '/' + all.length);
        list.forEach(it => {
            const r = rectOf(it.el);
            console.log(it.ord, '\t', "'" + clip(textOf(it.el), 140) + "'", '\t', "'" + (it.el.getAttribute('href') || '') + "'", '\t', r.x, r.y, r.w, r.h, '\t', "'" + cssTail(it.el) + "'");
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
            console.log(it.ord, '\t', "'" + clip(it.text || textOf(it.el), 180) + "'", '\t', r.x, r.y, r.w, r.h, '\t', "'" + cssTail(it.el) + "'", '\t', '[' + (it.src || 'visible') + ']');
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

    // ======= Username & Balance =======
    function ensureUserInfoExpanded(force) {
        try {
            if (_userInfoArrowClicked && !force)
                return false;
            const now = Date.now();
            if (!force && now - _lastUserInfoExpand < 1500)
                return false;
            let arrow = null;
            try {
                arrow = TAIL_USER_INFO_ARROW ? findByTail(TAIL_USER_INFO_ARROW) : null;
            } catch (_) {
                arrow = null;
            }
            if (!arrow) {
                arrow = document.querySelector('i.base-dropdown-header__user__icon.icon-arrow-down');
            }
            let btn = arrow ? arrow.closest('button') : null;
            if (!btn) {
                btn = document.querySelector('.user-logged__info button.btn.btn-secondary, .user-logged__info .base-dropdown-header > button');
            }
            const target = arrow || btn;
            if (!target)
                return false;
            const hit = btn || target;
            const rect = hit.getBoundingClientRect();
            const cx = Math.max(0, Math.floor(rect.left + rect.width / 2));
            const cy = Math.max(0, Math.floor(rect.top + rect.height / 2));
            const fire = (el, type) => {
                try {
                    el.dispatchEvent(new MouseEvent(type, {
                        bubbles: true,
                        cancelable: true,
                        clientX: cx,
                        clientY: cy,
                        view: window
                    }));
                } catch (_) {}
            };
            const seq = ['pointerover', 'mouseover', 'pointerenter', 'mouseenter', 'pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'];
            for (const type of seq)
                fire(hit, type);
            try {
                if (hit !== target)
                    fire(target, 'click');
                if (typeof hit.click === 'function') {
                    hit.click();
                }
            } catch (_) {}
            _lastUserInfoExpand = now;
            _userInfoArrowClicked = true;
            return true;
        } catch (_) {
            return false;
        }
    }
    function findUserFromDOM() {
        try {
            ensureUserInfoExpanded();
            // Ch? l?y theo ABS_USERNAME_TAIL, kh�ng fallback
            if (typeof ABS_USERNAME_TAIL === 'string' && ABS_USERNAME_TAIL) {
                const abs = findByTail(ABS_USERNAME_TAIL);
                const v = abs && (abs.value || abs.textContent || '').trim();
                if (isLikelyUsername(v))
                    return v;
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

                // --- Username (UU TIEN ABS PATH) ---
                let name = '';
                try {
                    const abs = findByTailIn(ABS_USERNAME_TAIL, doc); // dung tren tai lieu fetch duoc
                    if (abs) {
                        name = (abs.value != null ? String(abs.value)
                             : (abs.getAttribute && abs.getAttribute('value')) || abs.textContent || '').trim();
                    }
                } catch (_) {}
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

    function setUsernameLocal(u) {
        if (u == null)
            return;
        const val = String(u).trim();
        // Cập nhật state/UI cho panel, không quyết định gửi C#
        S.username = val;
        updateInfo();
    }

    function updateUsername(u) {
        if (u == null)
            return;
        const val = String(u).trim();

        // Rỗng hoặc không hợp lệ: chỉ lưu local, không gửi home_tick
        if (!val || !isLikelyUsername(val)) {
            setUsernameLocal(val);
            try { console.debug('[HW] skip home_tick: username not likely:', val); } catch (_) {}
            return;
        }

        setUsernameLocal(val);

        // Đẩy ngay 1 gói lên C# (không chờ interval)
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
        } catch (_) { /* ignore */ }
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
        document.querySelectorAll('.swal2-container, .swal2-popup, .swal2-backdrop-show, .modal.show, .modal-backdrop')
        .forEach(n => {
            const c = n.querySelector('.swal2-close, .btn-close, .close, [data-action="close"], .swal2-confirm');
            if (c) {
                try {
                    c.click();
                } catch (_) {}
            }
        });
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
        // Không giữ ẩn quá lâu tại trang Home, chỉ peel khi click
    }

    // ======= Actions =======
    function clickLoginButton() {
        // Ưu tiên tail cố định
        let btn = findByTail(TAIL_LOGIN_BTN);
        // Fallback theo khu vực header
        if (!(btn)) {
            btn = document.querySelector('header.menu .user-not-login .base-button.btn');
        }
        // Fallback theo text "đăng nhập"
        if (!(btn)) {
            btn = Array.from(document.querySelectorAll('button, a, [role="button"]'))
                .find(el => norm(textOf(el)).includes('dang nhap'));
        }
        if (btn && isVisibleAndClickable(btn)) {
            peelAndClick(btn, {
                holdMs: 300
            });
        }

        // Sau khi kích login, chủ động chờ header lấp tên
        waitFor(() => !!document.querySelector('.user-logged, .base-dropdown-header__user__name'), 15000, 250)
        .then(async ok => {
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
        updateInfo();

    }

    async function ensureOnHome() {
        // Đã ở Home và khu vực live hiển thị -> OK
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

    async function multiTryClick(resolveBtn, attempts = 3, isOk = () => false) {
        for (let i = 0; i < attempts; i++) {
            let b = resolveBtn();
            if (!b)
                break;
            peelAndClick(b, {
                holdMs: 600
            });
            const ok = await waitFor(() => !b.isConnected || !isVisibleAndClickable(b) || isOk(), 1800, 120);
            if (ok)
                return true;
            await wait(120);
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

    // ======= Boot =======
    function ensureOverlayHost() {
        // đảm bảo overlay tồn tại và listeners đã gắn
        return ensureOverlay();
    }

    function boot() {
        try {
            onDomReady(() => {
                ensureRoot();
                ensureOverlayHost();
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
