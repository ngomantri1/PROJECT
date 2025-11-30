// Dán NGUYÊN CỤM này vào console rồi Enter một lần
(() => {
    // Chuẩn hoá text: bỏ dấu, lowercase, gọn khoảng trắng
    function normText(s) {
        return (s || "")
        .toString()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
    }

    function isVisible(el) {
        if (!el)
            return false;
        const style = getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) {
            return false;
        }
        const rect = el.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0)
            return false;
        return rect.bottom >= 0 &&
        rect.right >= 0 &&
        rect.top <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.left <= (window.innerWidth || document.documentElement.clientWidth);
    }

    // Tìm nút "ĐĂNG NHẬP" ở header theo text (bỏ dấu)
    function findHeaderLoginButton() {
        const all = Array.from(document.querySelectorAll("button, a, div, span"));
        const candidates = all.filter(el => {
            if (!isVisible(el))
                return false;
            const t = normText(el.innerText || el.textContent);
            if (!t)
                return false;
            return t.includes("dang nhap");
        });

        console.log("[test-login] found", candidates.length, "login-like nodes");
        return candidates[0] || null;
    }

    // Click thật vào 1 element (bắn đủ pointer/mouse/click)
    function clickElement(el) {
        const rect = el.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;

        const events = [
            "pointerover", "pointerenter",
            "mouseover", "mouseenter",
            "pointerdown", "mousedown",
            "pointerup", "mouseup",
            "click"
        ];

        for (const type of events) {
            const evt = new MouseEvent(type, {
                bubbles: true,
                cancelable: true,
                view: window,
                clientX: x,
                clientY: y,
                button: 0
            });
            el.dispatchEvent(evt);
        }
    }

    // Toạ độ CHUẨN HOÁ nút ĐĂNG NHẬP đã đo được
    // clientX = 374, clientY = 43 trên viewport 1324x980
    const LOGIN_BTN_NORM = {
        x: 0.2824773413897281,
        y: 0.04387755102040816
    };

    // Click nút ĐĂNG NHẬP theo toạ độ chuẩn hoá
    window.clickLoginButton = function () {
        try {
            const docEl = document.documentElement || {};
            const body = document.body || {};

            const vw = window.innerWidth || docEl.clientWidth || body.clientWidth;
            const vh = window.innerHeight || docEl.clientHeight || body.clientHeight;

            const clientX = LOGIN_BTN_NORM.x * vw;
            const clientY = LOGIN_BTN_NORM.y * vh;

            // Lấy đúng element trên cùng tại toạ độ (có thể là canvas hoặc overlay khác)
            let target = document.elementFromPoint(clientX, clientY) ||
                document.querySelector("canvas, #GameCanvas, #gameCanvas, #unity-canvas");

            if (!target) {
                console.warn("[auto-login] không tìm thấy target để click ĐĂNG NHẬP");
                return "no-target";
            }

            console.log(
                "[auto-login] click login theo toạ độ viewport. norm=(" +
                LOGIN_BTN_NORM.x.toFixed(6) +
                "," +
                LOGIN_BTN_NORM.y.toFixed(6) +
                "), client=(" +
                Math.round(clientX) +
                "," +
                Math.round(clientY) +
                "), target=",
                target);

            function fire(type, extra) {
                const base = {
                    bubbles: true,
                    cancelable: true,
                    view: window,
                    clientX,
                    clientY,
                    screenX: (window.screenX || 0) + clientX,
                    screenY: (window.screenY || 0) + clientY
                };

                let ev;
                if (type.indexOf("pointer") === 0 && window.PointerEvent) {
                    ev = new PointerEvent(
                            type,
                            Object.assign({}, base, {
                                pointerId: 1,
                                pointerType: "mouse",
                                isPrimary: true
                            }, extra || {}));
                } else {
                    ev = new MouseEvent(
                            type,
                            Object.assign({}, base, extra || {}));
                }
                target.dispatchEvent(ev);
            }

            // Giả lập chuỗi sự kiện giống click thật
            fire("pointermove", {
                buttons: 0
            });
            fire("mousemove", {
                buttons: 0
            });

            fire("pointerdown", {
                button: 0,
                buttons: 1
            });
            fire("mousedown", {
                button: 0,
                buttons: 1
            });

            fire("pointerup", {
                button: 0,
                buttons: 0
            });
            fire("mouseup", {
                button: 0,
                buttons: 0
            });
            fire("click", {
                button: 0,
                buttons: 0
            });

            return "clicked-header";
        } catch (e) {
            console.error("[auto-login] clickLoginButton error", e);
            return "error:" + String(e);
        }
    };

    // Tìm xem popup đăng nhập đã mở chưa:
    // chỉ cần thấy input password / ô tên đăng nhập hiển thị là coi như mở
    function detectLoginPopup() {
        const inputs = Array.from(document.querySelectorAll("input"))
            .filter(isVisible);

        let hasPass = false;
        let hasUser = false;

        for (const el of inputs) {
            const around = [
                el.placeholder,
                el.getAttribute("placeholder"),
                el.getAttribute("data-placeholder"),
                el.parentElement && el.parentElement.textContent
            ].join(" ");

            const n = normText(around);

            if (!hasPass && (el.type === "password" || n.includes("mat khau"))) {
                hasPass = true;
            }

            if (
                !hasUser &&
                (
                    n.includes("ten dang nhap") ||
                    n.includes("tai khoan") ||
                    n.includes("so dien thoai") ||
                    n.includes("username"))) {
                hasUser = true;
            }
        }

        if (hasPass || hasUser) {
            return {
                state: "opened",
                hasUser,
                hasPass
            };
        }

        return {
            state: "closed"
        };
    }

    // 2) Hàm check trạng thái popup đăng nhập
    window.checkLoginPopupState = function () {
        const st = detectLoginPopup();
        console.log("[test-login] popup state:", st);
        return st;
    };

    // === Hàm bắt tọa độ click nút ĐĂNG NHẬP ===
    // Cách dùng trong console:
    // 1) startLoginCoordCapture();
    // 2) Bấm CHUỘT TRÁI đúng vào nút ĐĂNG NHẬP trên game
    // 3) Xem log [pick-login], copy normX/normY gửi lại cho mình
    window.startLoginCoordCapture = function () {
        function onClick(ev) {
            const docEl = document.documentElement || {};
            const body = document.body || {};

            const vw = window.innerWidth || docEl.clientWidth || body.clientWidth;
            const vh = window.innerHeight || docEl.clientHeight || body.clientHeight;

            const clientX = ev.clientX;
            const clientY = ev.clientY;

            const normX = clientX / vw;
            const normY = clientY / vh;

            const info = {
                clientX,
                clientY,
                viewportWidth: vw,
                viewportHeight: vh,
                normX,
                normY
            };

            console.log(
                "[pick-login] click tại:",
                "client=(" + clientX + "," + clientY + ")",
                "viewport=(" + vw + "x" + vh + ")",
                "norm=(" + normX.toFixed(6) + "," + normY.toFixed(6) + ")",
                "\nGợi ý LOGIN_BTN_NORM = { x: " + normX.toFixed(12) + ", y: " + normY.toFixed(12) + " };",
                info);

            // Lưu tạm để sau có thể xem lại nhanh
            window.__lastLoginPick = info;

            // Bắt 1 lần rồi thôi
            document.removeEventListener("click", onClick, true);
        }

        document.addEventListener("click", onClick, true);
        console.log("[pick-login] READY: hãy bấm CHUỘT TRÁI vào đúng nút ĐĂNG NHẬP để lấy tọa độ.");
    };

    console.log("[test-login] helpers ready: dùng clickLoginButton() và checkLoginPopupState() trong console");
})();
