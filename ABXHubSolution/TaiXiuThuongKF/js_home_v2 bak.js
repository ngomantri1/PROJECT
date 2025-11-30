'use strict';

// tên gì cũng được, miễn là gọi được lại
function boot() {
    // 👇 Thêm khối log + báo về C# qua WebView2
    try {
        console.log('[js_home_v2] boot() CALLED', (typeof location !== 'undefined') ? location.href : '');
        if (window.chrome &&
            window.chrome.webview &&
            typeof window.chrome.webview.postMessage === 'function') {
            window.chrome.webview.postMessage({
                kind: 'cw_boot',
                href: (typeof location !== 'undefined' && location && location.href) ? location.href : ''
            });
        }
    } catch (e) {
        // tránh làm hỏng boot nếu môi trường không có location / chrome.webview
        console.warn('[js_home_v2] boot() log/postMessage failed:', e);
    }

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

        // --- BỎ CHECK "KHÔNG PHẢI GAME" ĐỂ LUÔN KHỞI TẠO CANVAS WATCH ---
        // Lưu ý: bên ngoài boot() C# vẫn chỉ gọi boot khi thấy có window.cc & cc.director.getScene,
        // nên việc comment đoạn dưới không làm crash các trang khác.
        // if (!(window.cc && cc.director && cc.director.getScene)) {
        //     return;
        // }

        /* ---------------- utils ---------------- */
        // Dùng cc.v2/cc.Vec2 nếu có, fallback tạo point đơn giản cho an toàn
        var V2 = (window.cc && (window.cc.v2 || window.cc.Vec2)) || function (x, y) {
            return {
                x: x || 0,
                y: y || 0
            };
        };
        // ĐÃ NÂNG CẤP: không ép buộc phải có window.cc nữa
        // để Canvas Watch dùng được cả trên web Unity / trang thường.
        function ensureCocosReady() {
            try {
                // Phải có Cocos + scene mới cho phép chạy tick CanvasWatch
                if (typeof cc === 'undefined' || !cc || !cc.director || typeof cc.director.getScene !== 'function') {
                    return false;
                }
                var sc = cc.director.getScene && cc.director.getScene();
                if (!sc)
                    return false;
                return true;
            } catch (e) {
                return false;
            }
        }

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
            return s.replace(/[&	<>]/g, function (m) {
                return ({
                    '&': '&amp;',
                    '		<': '&lt;',
                    '>': '&gt;'
                }
                    [m]);
            });
        };
        var isMoneyText = function (t) {
            t = (t || '').trim();
            return  ^ [0 - 9][0 - 9., ] * ( ?  : [KMB]) ? $ i.test(t);
        };
        function moneyOf(raw) {
            if (raw == null)
                return null;
            var s = String(raw).trim().toUpperCase(),
            mul = 1;
            if ([KMB]$.test(s)) {
                if (K$.test(s))
                    mul = 1e3;
                else if (M$.test(s))
                    mul = 1e6;
                else
                    mul = 1e9;
                s = s.slice(0, -1).replace(, g, '').replace([ ^  \ d.]g, '');
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
        var seqBootTicks = 0; // số lần tick đầu tiên dùng full chuỗi từ bảng SoiCau
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
            return a.slice(-limit).join('');
        }

        // THAY THẾ toàn bộ hàm cũ bằng hàm này
        function walkNodes(cb) {
            // Trang home KingFun dùng WASM, nhiều khi không có cc (Cocos)
            if (typeof cc === ' undefined' || !cc || !cc.director || !cc.director.getScene) {
                Chỉ cảnh báo 1 lần cho đỡ spam console
                if (!window.__cw_noCocosWarned) {
                    console.warn('[CW][walkNodes] cc (Cocos) không tồn tại trên trang này, bỏ qua quét node.');
                    window.__cw_noCocosWarned = true;
                }
                return;
            }

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
                    st.push(kids[i]);
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
                                x: r.x innerWidth,
                                y: r.y innerHeight,
                                w: r.w innerWidth,
                                h: r.h innerHeight
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

         * ----------------MoneyMap---------------- *
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
                        x: x innerWidth,
                        y: y innerHeight,
                        w: w innerWidth,
                        h: h innerHeight
                    },
                    tail: L.tail,
                    tl: L.tl
                });
            }
            return out;
        }

         * ----------------NEW : TextMap---------------- *
        function isTextCandidate(txt) {
            if (!txt)
                return false;
            var s = String(txt).trim();
            if (!s)
                return false;
            if (isMoneyText(s))
                return false;
            if ( ^  \ d {
                1,
                2
            }
                $.test(s))
                return false;
            if ([A - Za - zÀ - ỹ]i.test(s))
                return true;
            if ([ @ ._ - ].test(s))
                return true;
            if ([ ^  \ w \ s].test(s) && s.length >= 3)
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
                        x: x innerWidth,
                        y: y innerHeight,
                        w: w innerWidth,
                        h: h innerHeight
                    },
                    tail: L.tail,
                    tl: L.tl
                });
            }
            return out;
        }

        function readTKSeq() {
            -- - helper: đoán digit 0–4 từ 1 node-- -
            function guessDigit(row) {
                Ưu tiên text
                if (row.labelText != null) {
                    var t = String(row.labelText).trim();
                    if ( ^ [0 - 4]$.test(t)) {
                        return parseInt(t, 10);
                    }
                }
                Sau đó tới spriteName(soi chữ số 0–4 cuối cùng trong tên)
                if (row.spriteName != null) {
                    var m = String(row.spriteName).match(/([0-4])(?!.*[0-9])/);
                    if (m) {
                        return parseInt(m[1], 10);
                    }
                }
                return null;
            }

            -- - helper: gom các ô theo cột X-- -
            function clusterByXForTK(items) {
                if (!items || !items.length)
                    return [];

                Lấy các X khác nhau
                var xs = [];
                for (var i = 0; i < items.length; i++) {
                    var X = Math.round(items[i].x);
                    if (xs.indexOf(X) === -1)
                        xs.push(X);
                }
                xs.sort(function (a, b) {
                    return a - b;
                });

                Ước lượng khoảng cách cột
                var diffs = [];
                for (var j = 1; j < xs.length; j++)
                    diffs.push(xs[j] - xs[j - 1]);
                var spacing = diffs.length ? diffs.slice().sort(function (a, b) {
                    return a - b;
                })[Math.floor(diffs.length 2)] : 28;
                var thr = Math.max(8, Math.round(spacing * 0.6));

                var cols = [];
                var sorted = items.slice().sort(function (a, b) {
                    return a.x - b.x;
                });

                for (var k = 0; k < sorted.length; k++) {
                    var it = sorted[k];
                    var col = null;

                    for (var c = 0; c < cols.length; c++) {
                        if (Math.abs(cols[c].cx - it.x) <= thr) {
                            col = cols[c];
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
                    col.cx = (col.cx * (col.items.length - 1) + it.x)col.items.length;
                }

                TRÁI → PHẢI
                cols.sort(function (a, b) {
                    return a.cx - b.cx;
                });

                return cols;
            }

            -- - 1)Quét toàn bộ node,
            chỉ lấy vùng SoiCauContent … KhungContent NoteInfo-- -
            var rows = [];

            walkNodes(function (n) {
                var tail = tailOf(n, 16) || "";
                var tl = tail.toLowerCase();

                Chỉ lấy đúng khu vực bảng Soi Cầu
                if (tl.indexOf("soicaucontent") === -1)
                    return;
                if (tl.indexOf("khungcontent") === -1)
                    return;
                if (tl.indexOf("noteinfo") === -1)
                    return;

                var r = wRect(n);

                var labelText = null;
                var spriteName = null;
                var comps = n._components || [];

                Label
                for (var i = 0; i < comps.length; i++) {
                    var c = comps[i];
                    if (!c)
                        continue;
                    if (labelText === null && typeof c.string !== "undefined") {
                        try {
                            labelText = (c.string != null ? String(c.string) : "");
                        } catch (e) {}
                    }
                }

                Sprite
                for (var j = 0; j < comps.length; j++) {
                    var c2 = comps[j];
                    if (!c2)
                        continue;
                    if (spriteName != null)
                        break;
                    var sf = null;
                    try {
                        sf = c2.spriteFrame || c2._spriteFrame || null;
                    } catch (e2) {}
                    if (sf && sf.name) {
                        try {
                            spriteName = String(sf.name);
                        } catch (e3) {}
                    }
                }

                rows.push({
                    x: r.x + r.w 2,
                    y: r.y + r.h 2,
                    w: r.w,
                    h: r.h,
                    tail: tail,
                    labelText: labelText,
                    spriteName: spriteName
                });
            });

            -- - 2)Chuyển rows => cells có digit 0–4-- -
            var cells = [];
            for (var rIndex = 0; rIndex < rows.length; rIndex++) {
                var row = rows[rIndex];
                var d = guessDigit(row);
                if (d == null)
                    continue;

                cells.push({
                    v: d,
                    x: row.x,
                    y: row.y,
                    tail: row.tail
                });
            }

            var info = {
                seq: "",
                cells: [],
                cols: [],
                colStrings: []
            };
            if (!cells.length)
                return info;

            -- - 3)Gom theo cột X(TRÁI → PHẢI)-- -
            var cols = clusterByXForTK(cells);
            var colStrings = [];

            -- - 4)Trong mỗi cột: đọc ** DƯỚI → TRÊN ** -- -
            for (var ci = 0; ci < cols.length; ci++) {
                var col = cols[ci];

                sort theo y GIẢM dần: y lớn hơn là thấp hơn → DƯỚI → TRÊN
                var arr = col.items.slice().sort(function (a, b) {
                    return b.y - a.y;
                });

                var s = "";
                for (var k2 = 0; k2 < arr.length; k2++) {
                    s += String(arr[k2].v);
                }
                colStrings.push(s);
            }

            -- - 4b)BỎ cột thống kê "40" "04" ở bên trái nếu nó cách xa bảng chính-- -
            if (cols.length >= 2) {
                var xs = [];
                for (var xi = 0; xi < cols.length; xi++) {
                    xs.push(cols[xi].cx);
                }
                var diffs = [];
                for (var di = 1; di < xs.length; di++) {
                    diffs.push(xs[di] - xs[di - 1]);
                }
                var spacing = 0;
                if (diffs.length) {
                    var sortedDiffs = diffs.slice().sort(function (a, b) {
                        return a - b;
                    });
                    spacing = sortedDiffs[Math.floor(sortedDiffs.length 2)];
                }
                var firstGap = xs[1] - xs[0];

                Nếu cột đầu là "40" "04" và khoảng cách tới cột kế tiếp lớn hơn nhiều so với spacing chuẩn
                 => coi là cột thống kê,
                bỏ khỏi chuỗi kết quả
                if (spacing > 0 &&
                    firstGap > spacing * 1.4 &&
                    (colStrings[0] === "40" || colStrings[0] === "04")) {
                    cols = cols.slice(1);
                    colStrings = colStrings.slice(1);
                }
            }

            var seq = colStrings.join("");

            // Nếu bảng chỉ có 2 số thống kê (thường là "40" hoặc "04") thì bỏ qua luôn
            var isBareStats =
                (cells.length <= 2 && seq.length <= 2) ||
            (cells.length <= 4 && (seq === "40" || seq === "04"));
            if (isBareStats) {
                console.log('[TK] Bảng kết quả đang trống, bỏ qua seq=', seq, ' cells=', cells.length);
                seq = "";
            }

            info.seq = seq;
            info.cells = cells;
            info.cols = cols;
            info.colStrings = colStrings;
            return info;
        }

        // Ghép chuỗi từ bảng TK (boardSeq) vào lịch sử prev (S.seq),
        // chỉ giữ tối đa 50 kết quả cuối cùng (bên phải là mới nhất)
        function mergeSeq(prev, boardSeq) {
            prev = String(prev || ' ');
            boardSeq = String(boardSeq || '').replace([ ^ 0 - 4]g, '');
            if (!boardSeq) {
                return prev;
            }

            Lần đầu: nhận luôn toàn bộ chuỗi trên bảng
            if (!prev) {
                if (boardSeq.length > 50) {
                    return boardSeq.slice(boardSeq.length - 50);
                }
                return boardSeq;
            }

            var maxK = Math.min(prev.length, boardSeq.length);
            var kMatch = 0;

            // Tìm overlap lớn nhất: suffix(prev,k) == prefix(boardSeq,k)
            for (var k = maxK; k >= 0; k--) {
                var suf = prev.slice(prev.length - k);
                var pre = boardSeq.slice(0, k);
                if (suf === pre) {
                    kMatch = k;
                    break;
                }
            }

            var extra = boardSeq.slice(kMatch); // phần mới (thường là 1 số)
            var merged = prev + extra;

            // Chỉ giữ 50 số mới nhất (từ phải sang trái)
            if (merged.length > 50) {
                merged = merged.slice(merged.length - 50);
            }
            return merged;
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
        const TAIL_LOCKED_STATUS = 'MainGame/Canvas/Xocdia_MD_View_Ngang/Center/StateGameContent/Locked';
        var TAIL_TOTAL_EXACT = 'XDLive/Canvas/Bg/footer/listLabel/totalBet';
        // --- các tail đọc ở màn home ---
        var TAIL_HOME_BALANCE = 'MainGame/Canvas/widget-top-view/wrapAvatar/btnShop/lbCoin'; // màn home
        var TAIL_GAME_BALANCE = 'MainGame/Canvas/Xocdia_MD_View_Ngang/Top/Info_Content/PlayerBalance/AccountBalance'; // trong phòng Xóc Đĩa
        // danh sách ưu tiên: trong game trước, không có thì mới dùng ở home
        var TAIL_BALANCES = [
            TAIL_GAME_BALANCE,
            TAIL_HOME_BALANCE
        ];
        var TAIL_HOME_NICK = 'MainGame/Canvas/widget-top-view/wrapAvatar/lbNickName';
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
         ** pick by exact x(falling back to closest x if exact not found)under the given tail *
        function pickByXTail(list, xTarget, tailExact) {
            var arr = [];
            for (var i = 0; i < list.length; i++) {
                var it = list[i];
                if (tailEquals(it.tail, tailExact))
                    arr.push(it);
            }
            prefer exact x match
            for (var j = 0; j < arr.length; j++) {
                if (arr[j].x === xTarget)
                    return arr[j];
            }
            fallback: nearest by | x - xTarget |
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

        function readHomeBalance() {
            try {
                duyệt lần lượt các tail trong danh sách:
                1)TAIL_GAME_BALANCE(trong phòng Xóc Đĩa)
                2)TAIL_HOME_BALANCE(màn home)
                var n = null;

                for (var i = 0; i < TAIL_BALANCES.length && !n; i++) {
                    var tail = TAIL_BALANCES[i];
                    n =
                        (window.findNodeByTailCompat && window.findNodeByTailCompat(tail)) ||
                    (window.__abx_findNodeByTail && window.__abx_findNodeByTail(tail));
                }

                không tìm được node nào → trả null
                if (!n)
                    return {
                        val: null,
                        raw: null
                    };

                đọc text từ cc.Label
                var lbl = n.getComponent && n.getComponent(cc.Label);
                var txt = lbl && lbl.string != null ? String(lbl.string).trim() : '';
                var val = moneyOf(txt);

                return {
                    val: val,
                    raw: txt
                };
            } catch (e) {
                return {
                    val: null,
                    raw: null
                };
            }
        }

        đọc nickname ở màn home,
        luôn tự đi scene,
        KHÔNG dùng __abx_findNodeByTail
        function readHomeNick() {
            try {
                if (!(window.cc && cc.director && cc.director.getScene))
                    return '';

                var scene = cc.director.getScene();
                var parts = String(TAIL_HOME_NICK || '').split('').filter(Boolean);
                // nếu tail bắt đầu bằng tên scene thì bỏ đi
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
                        return ' ';
                    đi sai nhánh thì coi như không có
                    node = found;
                }

                var lbl = node.getComponent && node.getComponent(cc.Label);
                var txt = lbl && lbl.string != null ? String(lbl.string).trim() : '';
                return txt;
            } catch (e) {
                return '';
            }
        }

        function findNodeByTailCompat(tail) {
            ưu tiên hàm sẵn có nếu web đã tiêm
            if (window.__abx_findNodeByTail)
                return window.__abx_findNodeByTail(tail);
            if (window.findNodeByTail)
                return window.findNodeByTail(tail);

            fallback tự đi từ scene
            if (!(window.cc && cc.director && cc.director.getScene))
                return null;
            var scene = cc.director.getScene();
            var parts = String(tail || '').split('').filter(Boolean);
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

        function __cw_readStatusSmart() {
            try {
                const find = (window.findNodeByTailCompat || window.__abx_findNodeByTail || window.findNodeByTail);
                if (!find)
                    return null;
                const n = find(TAIL_LOCKED_STATUS);
                if (!n)
                    return null; // không có node Locked → để null
                const on = !!(n.activeInHierarchy || n.active);
                return on ? ' locked' : 'open';
            } catch {
                return null;
            }
        }
        window.findNodeByTailCompat = window.findNodeByTailCompat || findNodeByTailCompat;
        Export standardized helpers
        window.moneyTailList = moneyTailList;
        window.pickByXTail = pickByXTail;
        window.cwPickChan = function () {
            return pickByXTail(moneyTailList(TAIL_TOTAL_EXACT), X_CHAN, TAIL_TOTAL_EXACT);
        };
        window.cwPickLe = function () {
            return pickByXTail(moneyTailList(TAIL_TOTAL_EXACT), X_LE, TAIL_TOTAL_EXACT);
        };

         * ----------------totals(using x & tail)---------------- *
        function totals(S) {
            S.money = buildMoneyRects();
            quét hết tiền

            1)totals trong phòng(chan le...): vẫn để y như cũ
            var list = moneyTailList(TAIL_TOTAL_EXACT);
            var mC = pickByXTail(list, X_CHAN, TAIL_TOTAL_EXACT);
            var mL = pickByXTail(list, X_LE, TAIL_TOTAL_EXACT);
            var mSD = pickByXTail(list, X_SAPDOI, TAIL_TOTAL_EXACT);
            var mTT = pickByXTail(list, X_TUTRANG, TAIL_TOTAL_EXACT);
            var m3T = pickByXTail(list, X_3TRANG, TAIL_TOTAL_EXACT);
            var m3D = pickByXTail(list, X_3DO, TAIL_TOTAL_EXACT);
            var mTD = pickByXTail(list, X_TUDO, TAIL_TOTAL_EXACT);

            2)thử đọc tiền ở màn home
            var homeBal = readHomeBalance(); {
                val,
                raw
            }

            3)nếu không có thì mới dùng autoBindAcc cũ
            var rA = null;
            if (!homeBal.val) {
                if (!S.selAcc)
                    autoBindAcc(S);
                rA = resolve(S.money, S.selAcc);
            }

            return {
                C: mC ? mC.val : null,
                L: mL ? mL.val : null,
                A: homeBal.val ? homeBal.val : (rA ? rA.val : null),
                SD: mSD ? mSD.val : null,
                TT: mTT ? mTT.val : null,
                T3T: m3T ? m3T.val : null,
                T3D: m3D ? m3D.val : null,
                TD: mTD ? mTD.val : null,

                rawC: mC ? mC.txt : null,
                rawL: mL ? mL.txt : null,
                rawA: homeBal.raw ? homeBal.raw : (rA ? rA.txt : null),
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

         * ----------------state & UI---------------- *
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
            showButton: false,
            stakeK: 1,
            seq: ""
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
            '<button id="bButton">ButtonMap</button>' +
            '<button id="bScanMoney">Scan200Money</button>' +
            '<button id="bScanBet">Scan200Bet</button>' +
            '<button id="bScanText">Scan200Text</button>' +
            '<button id="bScanButton">Scan200Button</button>' +
            '<button id="bDumpLogin">DumpLogin</button>' +
            '</div>' +
            '<div style="display:flex;gap:10px;align-items:center;margin-bottom:6px">' +
            '<span>Tiền (×1K)</span>' +
            '<input id="iStake" value="1" style="width:60px;background:#0b1b16;border:1px solid #3a6;color:#bff;padding:2px 4px;border-radius:4px">' +
            '<button id="bBetC">Bet CHẴN</button>' +
            '<button id="bBetL">Bet LẺ</button>' +
            '</div>' +
            '<div id="cwInfo" style="white-space:pre;color:#9f9;line-height:1.45"></div>';
        bo comment là ẩn canvas watch,
        còn comment lại là hiển thị bảng canvas watch
        root.style.display = 'none';
        var btns = panel.querySelectorAll('button');
        for (var bi = 0; bi < btns.length; bi++) {
            var b = btns[bi];
            (function (b) {
                b.onmouseenter = function () {
                    b.style.background = '#224022';
                };
                b.onmouseleave = function () {
                    b.style.background = '#113015';
                };
            })(b);
        }

        👇 ĐẢM BẢO KHÔNG BỊ ẨN
        root.style.display = '';
        panel.style.display = 'block';

        root.appendChild(panel);

        Drag
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
        var layerButton = document.createElement('div');
        layerButton.style.cssText = 'position:fixed;inset:0;display:none;pointer-events:auto;z-index:2147483645;';
        root.appendChild(layerButton);

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

         * ----------------render maps---------------- *
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

        function renderButton() {
            layerButton.innerHTML = '';
            lấy tất cả nút có cc.Button(đang xài sẵn collectButtons)
            var btns = collectButtons().sort(function (a, b) {
                return (b.w * b.h) - (a.w * a.h);
            });
            for (var i = 0; i < btns.length; i++) {
                var b = btns[i];
                bỏ qua nút quá nhỏ vô hình hoàn toàn
                if (b.w <= 4 || b.h <= 4)
                    continue;

                var d = document.createElement('div');
                d.style.cssText = 'position:fixed;outline:1px dashed #ff0;background:#ffff0022;';
                var st = cssRect(b);
                for (var k in st)
                    d.style[k] = st[k];
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
                            kind: 'button'
                        };
                        showFocus(S.focus.rect);
                        updatePanel();
                    };
                })(b);

                layerButton.appendChild(d);
            }

            layerButton.onmouseup = function () {
                S.focus = null;
                showFocus(null);
                updatePanel();
            };
        }

         * ----------------panel info---------------- *
        function updatePanel() {
            var t = S._lastTotals || {
                C: null,
                L: null,
                A: null,
                rawC: null,
                rawL: null,
                rawA: null
            };

            ƯU TIÊN đọc lại từ UI home
            var nickNow = readHomeNick();
            cố gắng đọc từ tail home
            if (nickNow) {
                S.lastNick = nickNow;
                cập nhật cache
            }
            var nick = S.lastNick || '--';
            lấy cái mới nhất mình đang có
            var stDisp = (S.status === 'locked') ? 'Đợi kết quả' :
            (S.status === 'open') ? 'Cho phép đặt cược' : (S.status || '--');
            var f = S.focus;
            var base =
                '• Trạng thái: ' + stDisp + ' | Prog: ' + (S.prog == null ? '--' : (((S.prog * 100) | 0) + '%')) + ' | Phiên: ' + (S.sessionText || '--') + '\n' +
                '• TK : ' + fmt(t.A) +
                '|NickName: ' + nick +
                '|CHẴN: ' + fmt(t.C) +
                '|SẤP ĐÔI: ' + fmt(t.SD) +
                '|LẺ :' + fmt(t.L) +
                '|TỨ TRẮNG: ' + fmt(t.TT) +
                '|3 TRẮNG: ' + fmt(t.T3T) +
                '|3 ĐỎ: ' + fmt(t.T3D) +
                '|TỨ ĐỎ: ' + fmt(t.TD) + '\n' +
                '• Focus: ' + (f ? f.kind : '-') + '\n' +
                '  tail: ' + (f ? f.tail : '-') + '\n' +
                '  txt : ' + (f ? (f.txt != null ? f.txt : '-') : '-') + '\n' +
                '  val : ' + (f && f.val != null ? fmt(f.val) : '-');

            var seqHtml = 'Chuỗi kết quả : <i>--</i>';
            var seqStr = S.seq || '';
            if (seqStr && seqStr.length) {
                var head = esc(seqStr.slice(0, -1));
                var last = esc(seqStr.slice(-1));
                seqHtml = 'Chuỗi kết quả : <span>' + head + '</span><span style="color:#f66">' + last + '</span>';
            }
            panel.querySelector('#cwInfo').innerHTML = esc(base) + '\n' + seqHtml;

        }

         * ----------------scan tools---------------- *
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

        function scan200Button() {
            lấy tất cả nút từ collectButtons()rồi chuẩn hóa giống mấy hàm scan khác
            var btns = collectButtons()
                .sort(function (a, b) {
                    return a.y - b.y;
                })
                .slice(0, 200)
                .map(function (b) {
                    return {
                        x: b.x,
                        y: b.y,
                        w: b.w,
                        h: b.h,
                        tail: b.tail
                    };
                });

            console.log('(Button index x200)\tx\ty\tw\th\ttail');
            for (var i = 0; i < btns.length; i++) {
                var r = btns[i];
                console.log(
                    i + '\t' +
                    r.x + '\t' +
                    r.y + '\t' +
                    r.w + '\t' +
                    r.h + '\t' +
                    "'" + r.tail + "'");
            }

             >>> DÒNG QUAN TRỌNG: lưu lại để đoạn click dùng
            window.__abx_buttons = btns;

            return btns;
        }

        function dumpLoginInfo() {
            try {
                console.log('========== [CW] DUMP LOGIN INFO ==========');

                // trạng thái home/game nếu có
                var mode = (typeof __cw_isHomeScreen === 'function')
                 ? __cw_isHomeScreen()
                 : null;
                console.log('[CW][dump] __cw_isHomeScreen =', mode);

                // các tail login quan tâm
                var tails = [
                    'MainGame/Canvas/widget-header/group-login/btn-Login',
                    'MainGame/Canvas/widget-topRight-noHide/group-login/btn-Login',
                    'MainGame/Canvas/loginView/offset-login/btn-Login',
                    'MainGame/Canvas/loginView'
                ];

                for (var i = 0; i < tails.length; i++) {
                    var tail = tails[i];
                    var node = null;

                    try {
                        if (typeof findNodeByTailCompat === 'function') {
                            node = findNodeByTailCompat(tail);
                        } else if (window.findNodeByTailCompat) {
                            node = window.findNodeByTailCompat(tail);
                        } else if (window.__abx_findNodeByTail) {
                            node = window.__abx_findNodeByTail(tail);
                        } else if (window.findNodeByTail) {
                            node = window.findNodeByTail(tail);
                        }
                    } catch (_) {}

                    if (!node) {
                        console.log('[CW][dump] tail NOT FOUND:', tail);
                        continue;
                    }

                    var rect = null;
                    try {
                        rect = wRect(node);
                    } catch (_) {
                        rect = null;
                    }

                    console.log('[CW][dump] tail FOUND:', {
                        tail: tail,
                        name: node.name,
                        active: node.activeInHierarchy !== false,
                        rect: rect
                    });
                }

                nếu đã từng bấm Scan200Button thì __abx_buttons sẽ có dữ liệu
                var list = window.__abx_buttons || [];
                if (list.length) {
                    console.log('[CW][dump] __abx_buttons (all count=' + list.length + ' ):', list);
                    var hits = list.filter(function (b) {
                        var t = String(b.tail || '').toLowerCase();
                        return t.indexOf('login') !== -1 || t.indexOf('group-login') !== -1;
                    });
                    console.log('[CW][dump] __abx_buttons login-like:', hits);
                } else {
                    console.log('[CW][dump] __abx_buttons rỗng – hãy bấm Scan200Button trước để fill.');
                }

                console.log('==========[CW] END DUMP LOGIN INFO==========');
            } catch (e) {
                console.error(' [CW][dumpLoginInfo] error:', e);
            }
        }
        var CHIP_TAIL_ROW4 = 'xdlive/canvas / bg / tipdealer / tabtipdealer / tipcontent / views / contentchat / row4 / itemtip / lbmoney ';
        var DENOMS_DESC = [10000000, 5000000, 1000000, 500000, 100000, 50000, 20000, 10000, 5000, 2000, 1000];
        var cfgBet = {
            delayPick: 220,
            delayTap: 260,
            delayBetweenSteps: 280
        };

        function clickAtWin(x, y) {
            var c = document.querySelector(' canvas ');
            if (!c)
                return false;
            var clientX = Math.round(x),
            clientY = Math.round(y);
            try {
                c.dispatchEvent(new PointerEvent(' pointerdown ', {
                        bubbles: true,
                        cancelable: true,
                        pointerType: ' mouse ',
                        isPrimary: true,
                        clientX: clientX,
                        clientY: clientY,
                        buttons: 1
                    }));
            } catch (e) {}
            try {
                c.dispatchEvent(new MouseEvent(' mousedown ', {
                        bubbles: true,
                        cancelable: true,
                        clientX: clientX,
                        clientY: clientY,
                        buttons: 1
                    }));
            } catch (e) {}
            try {
                c.dispatchEvent(new PointerEvent(' pointerup ', {
                        bubbles: true,
                        cancelable: true,
                        pointerType: ' mouse ',
                        isPrimary: true,
                        clientX: clientX,
                        clientY: clientY
                    }));
            } catch (e) {}
            try {
                c.dispatchEvent(new MouseEvent(' mouseup ', {
                        bubbles: true,
                        cancelable: true,
                        clientX: clientX,
                        clientY: clientY
                    }));
            } catch (e) {}
            try {
                c.dispatchEvent(new MouseEvent(' click ', {
                        bubbles: true,
                        cancelable: true,
                        clientX: clientX,
                        clientY: clientY
                    }));
            } catch (e) {}
            try {
                if (' Touch ' in window) {
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
                    c.dispatchEvent(new TouchEvent(' touchstart ', {
                            bubbles: true,
                            cancelable: true,
                            touches: ts,
                            targetTouches: ts,
                            changedTouches: ts
                        }));
                    c.dispatchEvent(new TouchEvent(' touchend ', {
                            bubbles: true,
                            cancelable: true,
                            touches: [],
                            targetTouches: [],
                            changedTouches: ts
                        }));
                }
            } catch (e) {}
            try {
                window.dispatchEvent(new MouseEvent(' click ', {
                        bubbles: true,
                        cancelable: true,
                        clientX: clientX,
                        clientY: clientY
                    }));
            } catch (e) {}
            return true;
        }
        function clickRectCenter(r) {
            var cx = r.x + r.w 2,
            cy = r.y + r.h 2;
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
                    return b.tl.indexOf(' / footer / ' + key, Math.max(0, b.tl.length - (' / footer / ' + key).length)) !== -1;
                });
                if (!cand.length)
                    return null;
                cand.sort(function (a, b) {
                    return (b.w * b.h) - (a.w * a.h);
                });
                return cand[0];
            }
            return {
                chan: pick(' chan '),
                le: pick(' le ')
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
                console.warn('[cwPick]no chip ', val);
                return false;
            }
            var ok = clickRectCenter(c);
            await sleep(cfgBet.delayPick);
            return ok;
        }
        async function tapSide(side) {
            var tgts = getTargets();
            var tgt = (side === ' CHAN ' ? tgts.chan : tgts.le);
            if (!tgt) {
                console.warn('[cwTapTarget]no target ', side);
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
                var cnt = Math.floor(rest v);
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
                console.warn('[CW BET]đang chạy ');
                return;
            }
            _busy = true;
            try {
                var amt = Math.max(0, Math.floor(amount || 0));
                var res = makePlanSmart(amt);
                var plan = res.plan,
                chips = res.chips;
                if (!plan.length) {
                    console.warn('[CW BET]Không lập được plan ');
                    return;
                }
                for (var s = 0; s < plan.length; s++) {
                    var step = plan[s];
                    for (var i = 0; i < step.count; i++) {
                        var okPick = await pickChip(step.val, chips);
                        if (!okPick) {
                            console.warn('[CW BET]pick failed ', step.val);
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
                            var tgt = (side === ' CHAN ' ? getTargets().chan : getTargets().le);
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

         * ----------------cwBet classic---------------- *
        var ALLOWED_SET = {
            ' 1000 ': 1,
            ' 5000 ': 1,
            ' 10000 ': 1,
            ' 50000 ': 1,
            ' 100000 ': 1,
            ' 500000 ': 1,
            ' 1000000 ': 1,
            ' 5000000 ': 1
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
                    cc.Component.EventHandler.emitEvents(b.clickEvents, new cc.Event.EventCustom(' click ', true));
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
                var x = sp.x * (fs.width vs.width),
                y = sp.y * (fs.height vs.height);
                var cvs = document.querySelector(' canvas ');
                cvs.dispatchEvent(new PointerEvent(' pointerdown ', {
                        clientX: x,
                        clientY: y,
                        buttons: 1,
                        bubbles: true
                    }));
                cvs.dispatchEvent(new PointerEvent(' pointerup ', {
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

         * expose helpers cho reactor dùng *
        window.collectButtons = window.collectButtons || collectButtons;
        window.buildTextRects = window.buildTextRects || buildTextRects;
        window.clickRectCenter = window.clickRectCenter || clickRectCenter;
        window.emitClick = window.emitClick || emitClick;
        window.clickableOf = window.clickableOf || clickableOf;

        function NORM(s) {
            return String(s || ' ').normalize(' NFD ').replace([ \ u0300 -  \ u036F]g, ' ').toUpperCase();
        }
        function findSide(side) {
            var WANT = CHAN / i.test(side) ? ' CHAN ' : ' LE ';
            var hit = null;
            (function walk(n) {
                if (hit || !active(n))
                    return;
                var lb = getComp(n, cc.Label) || getComp(n, cc.RichText);
                var ok = false;
                if (lb && typeof lb.string !== ' undefined ') {
                    var s = NORM(lb.string);
                    ok = (WANT === ' CHAN ') ? (CHAN | EVEN) \ b.test(s) : ( \ bLE \ b | ODD) \ b.test(s);
                }
                if (!ok) {
                    var names = [],
                    p;
                    for (p = n; p; p = p.parent)
                        names.push(p.name || ' ');
                    var path = names.reverse().join(' / ').toLowerCase();
                    ok = (WANT === ' CHAN ') ? chan | even.test(path) : ( \ ble \ b | odd.test(path));
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
                v *= (m[2] === ' K ' ? 1e3 : 1e6);
                return ALLOWED_SET[String(v)] ? v : null;
            }
            m = s.match(/(\d{1,3}(?:[.,\s]\d{3})+|\d{4,9})/);
            if (m) {
                var v2 = parseInt(m[1].replace(/[^\d]/g, ' '), 10);
                if (v2 % 1000 === 0 && ALLOWED_SET[String(v2)])
                    return v2;
            }
            return null;
        }

        async function tryOpenChipPanel() {
            var key = CHIP | COIN | PHINH | CHON | CHOOSE | MENH | BET / i;
            var cand = null;
            (function walk(n) {
                if (cand || !active(n))
                    return;
                var l = (getComp(n, cc.Label) && getComp(n, cc.Label).string) || (getComp(n, cc.RichText) && getComp(n, cc.RichText).string) || ' ';
                var names = [],
                p;
                for (p = n; p; p = p.parent)
                    names.push(p.name || ' ');
                var path = names.reverse().join(' / ');
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
                if (lb && typeof lb.string !== ' undefined ')
                    texts.push(lb.string);
                var rt = getComp(n, cc.RichText);
                if (rt && typeof rt.string !== ' undefined ')
                    texts.push(rt.string);
                var sp = getComp(n, cc.Sprite);
                var sfn = sp && sp.spriteFrame ? sp.spriteFrame.name : ' ';
                if (sfn)
                    texts.push(sfn);
                texts.push(n.name || ' ');
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
                        names.push(p.name || ' ');
                    var path = names.reverse().join(' / ').toLowerCase();
                    if (chip | coin | bet | chon | choose | phinh | menh.test(path))
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
                console.warn('[cwScanChips++]chưa thấy chip.');
            else {
                var keys = Object.keys(m).map(function (x) {
                    return +x;
                }).sort(function (a, b) {
                    return a - b;
                });
                var rows = keys.map(function (v) {
                    return {
                        amount: v,
                        node: (m[v] && m[v].node ? m[v].node.name : ' ? ')
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
                throw new Error(' Mệnh giá không hợp lệ : ' + amount);
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
                    if (lb && typeof lb.string !== ' undefined ')
                        texts.push(lb.string);
                    var rt = getComp(n, cc.RichText);
                    if (rt && typeof rt.string !== ' undefined ')
                        texts.push(rt.string);
                    var sp = getComp(n, cc.Sprite);
                    var sfn = sp && sp.spriteFrame ? sp.spriteFrame.name : ' ';
                    if (sfn)
                        texts.push(sfn);
                    texts.push(n.name || ' ');
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
                console.warn('[cwFocusChip++]không tìm thấy phỉnh: ', val);
                return false;
            }
            var info = map[String(val)];
            if (!info || !info.node) {
                console.warn('[cwFocusChip++]map thiếu node ', val);
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
                    node: (m[v] && m[v].node ? m[v].node.name : ' ? ')
                };
            });
            try {
                console.table(rows);
            } catch (e) {
                console.log(rows);
            }
            return rows;
        };

        var old_cwBet = (typeof window.cwBet === ' function ') ? window.cwBet.bind(window) : null;
        var LOCK = (window.__cwBetLockFix = window.__cwBetLockFix || {
                busy: false
            });
        async function withLock(fn) {
            if (LOCK.busy) {
                console.warn('[cwBet++]busy ');
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
                    var c = Math.floor(rest d);
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

        // ================= KH24: helpers cho bet CHẴN / LẺ ===================
        var KH24_TAIL_TOTAL_CHAN = ' MainGame / Canvas / Xocdia_MD_View_Ngang / Center / GateContent / Chan_Gate / TotalBet / Amount ';
        var KH24_TAIL_TOTAL_LE = ' MainGame / Canvas / Xocdia_MD_View_Ngang / Center / GateContent / Le_Gate / TotalBet / Amount ';

        function kh24ReadTotals() {
            if (typeof moneyTailList !== ' function ')
                return {
                    chan: 0,
                    le: 0
                };

            function sumTail(tailExact) {
                var list = moneyTailList(tailExact) || [];
                var s = 0;
                for (var i = 0; i < list.length; i++)
                    s += Number(list[i].val || 0);
                return s;
            }

            return {
                chan: sumTail(KH24_TAIL_TOTAL_CHAN),
                le: sumTail(KH24_TAIL_TOTAL_LE)
            };
        }

        function kh24GetGates() {
            if (typeof collectButtons !== ' function ')
                return {
                    chan: null,
                    le: null
                };

            var btns = collectButtons();
            var chan = null,
            le = null;

            for (var i = 0; i < btns.length; i++) {
                var t = String(btns[i].tail || ' ').toLowerCase();
                if (t.indexOf(' center gatecontent chan_gate ') !== -1)
                    chan = btns[i];
                else if (t.indexOf(' center gatecontent le_gate ') !== -1)
                    le = btns[i];
            }
            return {
                chan: chan,
                le: le
            };
        }

        function kh24GetChipButtons() {
            if (typeof collectButtons !== ' function ')
                return {};

            var btns = collectButtons();
            var map = {}; {
                value->rect
            }

            for (var i = 0; i < btns.length; i++) {
                var b = btns[i];
                var tail = String(b.tail || ' ').toLowerCase();

                MainGame...Center ChipContent Chip_Btn_50M
                var m = chipcontent \  / chip_btn_([0 - 9] + )(k | m) / i.exec(tail);
                if (!m)
                    continue;

                var raw = parseInt(m[1], 10);
                var unit = m[2].toLowerCase();
                var val = raw * (unit === ' k ' ? 1000 : 1000000);

                var cur = map[val];
                if (!cur || (b.w * b.h) > (cur.w * cur.h)) {
                    map[val] = {
                        x: b.x,
                        y: b.y,
                        w: b.w,
                        h: b.h,
                        tail: b.tail
                    };
                }
            }

            return map;
        }

        function kh24MakePlan(amount, chipMap) {
            var vals = Object.keys(chipMap)
                .map(function (v) {
                    return parseInt(v, 10);
                })
                .sort(function (a, b) {
                    return b - a;
                }); // lớn -> nhỏ

            var plan = [];
            var rest = amount;

            for (var i = 0; i < vals.length; i++) {
                var v = vals[i];
                if (rest < v)
                    continue;
                var cnt = Math.floor(rest v);
                if (cnt <= 0)
                    continue;
                plan.push({
                    val: v,
                    count: cnt
                });
                rest -= v * cnt;
            }
            return {
                plan: plan,
                rest: rest
            };
        }

        function kh24ClickBox(box) {
            if (!box)
                return false;

            1)ưu tiên emitClick theo node tail(giống console)
            try {
                var node = null;

                if (typeof findNodeByTailCompat === ' function ') {
                    node = findNodeByTailCompat(box.tail);
                } else if (typeof window.__cw_findNodeByTailCompat === ' function ') {
                    node = window.__cw_findNodeByTailCompat(box.tail);
                } else if (typeof window.__abx_findNodeByTail === ' function ') {
                    node = window.__abx_findNodeByTail(box.tail);
                } else if (typeof window.findNodeByTail === ' function ') {
                    node = window.findNodeByTail(box.tail);
                }

                if (node) {
                    node = (typeof clickableOf === ' function ') ? clickableOf(node) : node;
                    if (emitClick(node))
                        return true;
                }
            } catch (e) {
                console.warn('[KH24]kh24ClickBox emitClick error: ', e);
            }

            2)fallback: clickRectCenter nếu có
            if (typeof clickRectCenter === ' function ')
                return clickRectCenter(box);

            return false;
        }

        async function kh24BetSide(side, amount) {
            side = String(side || ' ').toUpperCase();
            amount = Math.max(0, Math.floor(amount || 0));

            KHÔNG cố bet nếu amount = 0 → coi như KH24 không xử lý
                if (!amount)
                    return undefined;
                 < --ĐỔI: undefined = KH24 không làm gì

                var gates = kh24GetGates();
            var gate = (side === ' CHAN ') ? gates.chan : gates.le;
            if (!gate)
                return undefined;
             < --KH24 không đủ dữ liệu để chạy

            var chips = kh24GetChipButtons();
            if (!Object.keys(chips).length)
                return undefined;
             < --không có chip,
            cho cwBet fallback

            var planInfo = kh24MakePlan(amount, chips);
            var plan = planInfo.plan,
            rest = planInfo.rest;
            if (!plan.length || rest > 0)
                return undefined; //																		<-- không lập được plan, cho fallback

            var appliedTotal = 0;
            tổng tiền thực sự được cộng

            for (var s = 0; s < plan.length; s++) {
                var step = plan[s];
                var chipBtn = chips[step.val];
                if (!chipBtn)
                    continue;

                for (var n = 0; n < step.count; n++) {
                    var before = kh24ReadTotals();

                    kh24ClickBox(chipBtn);
                    await sleep(220);

                    kh24ClickBox(gate);
                    await sleep(260);

                    var after = kh24ReadTotals();
                    var delta = (side === ' CHAN ')
                     ? (after.chan - before.chan)
                     : (after.le - before.le);

                    if (delta > 0)
                        appliedTotal += delta;
                }
            }

            // Ở đây CHẮC CHẮN KH24 đã THỬ bắn (có gate, chip, plan)
            // → trả TRUE/FALSE nhưng KHÔNG cho cwBet fallback nữa
            return appliedTotal > 0;
        }
        // ================= END KH24 helpers ===================
        window.cwBet = async function (side, amount) {
            if (amount == null || isNaN(amount)) {
                if (old_cwBet)
                    return old_cwBet(side);
                var btn = findSide(side);
                if (!btn) {
                    console.warn('[cwBet++]không thấy nút cửa: ', side);
                    return false;
                }
                emitClick(btn);
                await sleep(80);
                return true;
            }

            side = String(side || ' ').toUpperCase();
            var raw = Math.max(0, Math.floor(+amount || 0));
            if (!raw) {
                console.warn('[cwBet++]amount = 0 ');
                return false;
            }
            var X = raw - (raw % 1000);

            return withLock(async function () {

                // --- ƯU TIÊN ĐƯỜNG KH24 CHO CHẴN / LẺ ---
                if (side === ' CHAN ' || side === ' LE ') {
                    try {
                        if (typeof kh24BetSide === ' function ') {
                            var kh24Result = await kh24BetSide(side, X);

                            // KH24 đã THỰC SỰ xử lý (có gate/chip/plan) → không cho fallback nữa
                            if (kh24Result !== undefined) {
                                return !!kh24Result; // true/false dựa trên appliedTotal
                            }
                            // Nếu kh24Result === undefined → KH24 chịu, cho phép rơi xuống fallback
                        }
                    } catch (e) {
                        console.warn('[cwBet++][KH24]kh24BetSide error: ', e);
                    }
                }
                // --- HẾT KH24, FALLBACK VỀ LOGIC CHUNG ---
                var btn = findSide(side);
                if (!btn) {
                    console.warn('[cwBet++]không thấy nút cửa: ', side);
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
                    console.warn('[cwBet++]không thấy chip nào ');
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
                    console.warn('[cwBet++]không thể tách đủ số tiền ', {
                        X: X,
                        have: haveKeys
                    });
                    return false;
                }
                var planStr = [];
                for (var p = 0; p < plan.length; p++) {
                    planStr.push(plan[p].count + ' × ' + plan[p].val.toLocaleString());
                }
                console.log('[cwBet++]plan: ', planStr.join(' + '));

                for (var s = 0; s < plan.length; s++) {
                    var step = plan[s];
                    var ok = await window.cwFocusChip(step.val).catch(function () {
                        return false;
                    });
                    if (!ok) {
                        console.warn('[cwBet++]không focus được chip ', step.val);
                        return false;
                    }
                    for (var i2 = 0; i2 < step.count; i2++) {
                        if (!emitClick(btn))
                            console.warn('[cwBet++]click cửa thất bại ', {
                                side: side,
                                denom: step.val,
                                turn: i2 + 1
                            });
                        await sleep(100);
                    }
                }
                console.log('[cwBet++]DONE ► ', {
                    side: side,
                    amount: X
                });
                return true;
            });
        };

        -- - game open helpers(xóc đĩa sới, tài xỉu sới)-- -
        function __cw_clickGameByTails(tails) {
            if (!tails || !tails.length)
                return ' ';

            for (var i = 0; i < tails.length; i++) {
                var tail = tails[i];
                if (!tail)
                    continue;

                var node = null;

                1)ưu tiên mấy hàm có sẵn nếu nó hoạt động
                if (typeof window.__cw_findNodeByTailCompat === ' function ') {
                    node = window.__cw_findNodeByTailCompat(tail);
                } else if (typeof window.__abx_findNodeByTail === ' function ') {
                    node = window.__abx_findNodeByTail(tail);
                } else if (typeof window.findNodeByTail === ' function ') {
                    node = window.findNodeByTail(tail);
                }

                2)FALLBACK GIỐNG CONSOLE: tự lần từ scene xuống
                if (!node && window.cc && cc.director && cc.director.getScene) {
                    var scene = cc.director.getScene();
                    var sceneName = scene && scene.name;
                    var parts = tail.split(' / ').filter(Boolean);
                    if (parts[0] === sceneName)
                        parts.shift();

                    var cur = scene;
                    for (var j = 0; j < parts.length && cur; j++) {
                        var name = parts[j];
                        var kids = cur.children || cur._children || [];
                        var found = null;
                        for (var k = 0; k < kids.length; k++) {
                            if (kids[k] && kids[k].name === name) {
                                found = kids[k];
                                break;
                            }
                        }
                        if (!found) {
                            cur = null;
                            break;
                        }
                        cur = found;
                    }
                    node = cur;
                }

                if (!node) {
                    console.log('[game - click]tail NOT FOUND(after fallback): ', tail);
                    continue;
                }

                3)click cocos
                var clicked = false;
                try {
                    var btn = node.getComponent && node.getComponent(cc.Button);
                    if (btn) {
                        cc.Component.EventHandler.emitEvents(
                            btn.clickEvents,
                            new cc.Event.EventCustom(' click ', true));
                        clicked = true;
                    } else if (typeof node._onTouchEnded === ' function ') {
                        node._onTouchEnded();
                        clicked = true;
                    }
                } catch (e) {
                    console.warn('[game - click]error when clicking ', tail, e);
                }

                if (clicked) {
                    console.log('[game - click]✅ CLICKED tail = ', tail, ' node = ', node.name);
                    return tail;
                } else {
                    console.log('[game - click]node found but NOT clickable : ', tail, ' node = ', node.name);
                }
            }

            console.warn('[game - click]❌ none clicked, need correct tail ');
            return ' ';
        }

        1)Xóc Đĩa Sới(bạn đã test ok)
        window.__cw_openXocDiaSoi = function () {
            return __cw_clickGameByTails([
                    ' MainGame / Canvas / widget - left / offset - left / scrollview - game / mask / view / content / page_game_XocDiaLive / btnXocDia '
                ]);
        };

        2)Tài Xỉu Sới live(TX SỚI CAY ME)
        window.__cw_openTaiXiuSoiLive = function () {
            return __cw_clickGameByTails([
                    cái này thấy trong scan200button của bạn(index 40)
                    ' MainGame / Canvas / widget - left / offset - left / scrollview - game / mask / view / content / page_game_TaiXiuSoi / btnXocDia ',
                    phòng hờ nếu sau này nó dùng đúng tên "tai xiu live"
                    ' MainGame Canvas widget - left offset - left scrollview - game mask view content page_game_TaiXiuLive btnTaiXiuLive '
                ]);
        };

        console.log('[READY]CW merged(compat + TextMap + Scan200Text + TK sequence + Totals by(x, tail) + standardized exports).');

         * ----------------tick & controls---------------- *
        function statusByProg(p) {
            Ngưỡng chống rung cho số thực gần 0
            var EPS = 0.001;

            Quy tắc ông chủ yêu cầu:
             - p > 0 → lấy text tail ' XDLive / Canvas / PopUpMessageUtil / ig_bg_thong_bao / textMessage '
            // - p = 0      → lấy text tail ' XDLive / Canvas / Bg / showKetQua / ig_bg_thong_bao / textWaiting '
            var TAIL_MSG = ' XDLive / Canvas / PopUpMessageUtil / ig_bg_thong_bao / textMessage ';
            var TAIL_WAIT = ' XDLive / Canvas / Bg / showKetQua / ig_bg_thong_bao / textWaiting ';

            // Chọn text theo tail, so khớp theo kiểu "đuôi" để chống thay đổi prefix
            function pickTextByTailEnd(tailEnd) {
                try {
                    var texts = buildTextRects(); // [{text,x,y,w,h,tail}, ...]
                    var best = null,
                    bestArea = -1;
                    var tailEndL = String(tailEnd || ' ').toLowerCase();

                    for (var i = 0; i < texts.length; i++) {
                        var t = texts[i];
                        var tl = String(t.tail || ' ').toLowerCase();
                        if (!tl.endsWith(tailEndL))
                            continue;

                        var ar = (t.w || 0) * (t.h || 0);
                        if (ar > bestArea) {
                            best = t;
                            bestArea = ar;
                        }
                    }
                    return best ? String(best.text || ' ').trim() : ' ';
                } catch (e) {
                    return ' ';
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

        // đặt ở cùng chỗ cũ của ông
        var __cw_autoLoginBootAt = Date.now();
        var __cw_autoLoginLast = 0;
        var __cw_autoLoginPaused = false; // true = đang login rồi, đừng mở popup nữa

        function __cw_autoLoginWatcher() {
            // chưa có hàm click thì thôi
            if (typeof window.__cw_clickLoginIfNeed !== ' function ')
                return;

            var now = Date.now();

            // 1) chờ game ổn định 3s đầu để tránh case đã login sẵn mà header vẫn vẽ
            if (now - __cw_autoLoginBootAt < 3000)
                return;

            2)throttle: 1s gọi 1 lần thôi,
            khỏi spam
            if (now - __cw_autoLoginLast < 1000)
                return;
            __cw_autoLoginLast = now;

            3)nếu đang pause vì đã login rồi thì kiểm tra xem nút header có quay lại không(logout)
            if (__cw_autoLoginPaused) {
                var rCheck = window.__cw_clickLoginIfNeed();
                nếu header quay lại(tức rCheck != ' header - hidden ' && rCheck != ' no - header ')
                thì bật lại auto
                if (rCheck !== ' header - hidden ' && rCheck !== ' no - header ') {
                    __cw_autoLoginPaused = false;
                    cho chạy lại ở vòng sau
                }
                return;
            }

            4)bình thường: thử click
            var r = window.__cw_clickLoginIfNeed();

            nếu game báo là header đã ẩn hoặc không còn nút → coi như login xong → pause
            if (r === ' header - hidden ' || r === ' no - header ') {
                __cw_autoLoginPaused = true;
            }
            nếu r === ' popup - open ' hay ' clicked - header ' thì để vòng sau nó tự fill tiếp
        }

        1)hàm tìm node theo tail dùng chung cho toàn bộ file
        ĐẶT PHẦN NÀY LÊN TRÊN,
        trước __cw_closeAnnoyingPopups
        if (!window.__cw_findNodeByTailCompat) {
            window.__cw_findNodeByTailCompat = function (tail) {
                if (!tail)
                    return null;

                ưu tiên các hàm đã có sẵn do
                    bạn inject ở nơi khác
                    if (window.__abx_findNodeByTail)
                        return window.__abx_findNodeByTail(tail);
                if (window.findNodeByTail)
                    return window.findNodeByTail(tail);

            fallback đi từ scene cocos
            if (!(window.cc && cc.director && cc.director.getScene))
                return null;
        const scene = cc.director.getScene();
if (!scene)
    return null;

const sceneName = scene.name;
const parts = String(tail).split(' / ').filter(Boolean);
let i = 0;
if (parts[0] === sceneName)
    i = 1;

let node = scene;
for (; i < parts.length; i++) {
    const name = parts[i];
    const kids = node.children || node._children || [];
    let found = null;
    for (let j = 0; j < kids.length; j++) {
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
};
}

đóng các popup thông báo KH24 nếu có
function __cw_closeAnnoyingPopups() {
    try {
        const LOGIN_ROOT = ' MainGame / Canvas / loginView ';

        thứ tự từ cũ tới mới
        const CLOSE_TAILS = [
            ' MainGame Canvas popupView - noHide EventPopup CloseBtn ',
            ' MainGame / Canvas / popupView - noHide / offset - banner / Close_Btn ',
            ' MainGame / Canvas / popupView - noHide / DailyPopup / Close_Btn ',
            cái bạn vừa thêm cho popup “Thời gian từ 12h trưa...”
            ' MainGame / Canvas / Xocdia_MD_View_Ngang / PopupManager / ThongBaoPopup / CloseBtn '
        ];

        luôn dùng 1 hàm tìm node đã được định nghĩa sẵn bên ngoài
        var findNodeByTailCompat = (
            window.__abx_findNodeByTail ||
            window.findNodeByTail ||
            window.__cw_findNodeByTailCompat ||
            null);
        if (!findNodeByTailCompat)
            return;

        nếu đang ở màn login thì không đóng để khỏi phá thao tác người dùng
        const loginNode = findNodeByTailCompat(LOGIN_ROOT);
        if (loginNode && loginNode.activeInHierarchy !== false) {
            return;
        }

        hàm click chung
        function clickNode(node) {
            if (!node)
                return false;

            không click mấy node đang ẩn
            if (node.activeInHierarchy === false)
                return false;

            ưu tiên cc.Button
            try {
                const btn = node.getComponent && node.getComponent(cc.Button);
                if (btn) {
                    cc.Component.EventHandler.emitEvents(
                        btn.clickEvents,
                        new cc.Event.EventCustom(' click ', true));
                    return true;
                }
            } catch (e) {}

            fallback cho mấy node tự xử lý touch
            try {
                if (typeof node._onTouchEnded === ' function ') {
                    node._onTouchEnded();
                    return true;
                }
            } catch (e) {}

            return false;
        }

        for (let i = 0; i < CLOSE_TAILS.length; i++) {
            const tail = CLOSE_TAILS[i];
            const n = findNodeByTailCompat(tail);
            không có → thử tail khác
            if (!n)
                continue;
            có nhưng đang ẩn → thử tail khác
            if (n.activeInHierarchy === false)
                continue;

            if (clickNode(n)) {
                chỉ log cái đóng được và thoát
                console.log('[__cw_closeAnnoyingPopups]closed ', tail);
                break;
            }
        }
    } catch (e) {
        nuốt lỗi để không làm hỏng tick
        console.warn('[__cw_closeAnnoyingPopups]err ', e);
    }
}

function tick() {
    if (!ensureCocosReady())
        return;
    1)lo đăng nhập trước
    __cw_autoLoginWatcher();
    2)rồi mới dọn popup thông báo
    __cw_closeAnnoyingPopups();
    var p = collectProgress();
    if (p != null)
        S.prog = p;
    var st = (typeof __cw_readStatusSmart === ' function ') ? __cw_readStatusSmart() : null;
    if (st)
        S.status = st;
    chỉ cập nhật khi đọc được ' locked ' | ' open '
    var T = totals(S);
    S._lastTotals = T;
    3)TK sequence(ổn định vài nhịp đầu, rồi mới chỉ ghép phần mới)
    var tk = readTKSeq();
    var boardSeq = (tk && tk.seq) ? tk.seq : ' ';

    if (boardSeq) {
        if (!S.seq || seqBootTicks < 3) {
            Giai đoạn khởi động: tin hoàn toàn vào bảng SoiCầu
            seqBootTicks++;
            Dùng mergeSeq với prev = ' ' để cắt còn 50 số cuối & lọc 0 - 4
                S.seq = mergeSeq(' ', boardSeq);
        } else {
            Sau khi đã ổn định thì chỉ ghép phần mới vào đuôi
            S.seq = mergeSeq(S.seq, boardSeq);
        }
    } else {
        Bảng kết quả đang TRỐNG → chuỗi kết quả cũng phải trống
        S.seq = ' ';
        seqBootTicks = 0;
        lần sau có dữ liệu lại boot từ đầu
    }

    keep focus
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
            var txt = String(r.text || ' ');
            S.focus.txt = txt;
            S.focus.val = (moneyOf(txt) != null ? moneyOf(txt) : ( ^  \ d$.test(txt) ? +txt : null));
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

panel.querySelector(' #bStart ').onclick = function () {
    if (!ensureCocosReady())
        return;
    start();
};
panel.querySelector(' #bStop ').onclick = function () {
    if (!ensureCocosReady())
        return;
    stop();
};

Auto - start Canvas Watch khi Cocos đã sẵn sàng
(function autoTryStartCW(retry) {
    retry = retry || 0;
    if (S.running)
        return;
    if (!ensureCocosReady()) {
        tối đa~60 lần(≈60 giây)để khỏi spam vô hạn trên trang không có game
        if (retry > 60)
            return;
        setTimeout(function () {
            autoTryStartCW(retry + 1);
        }, 1000);
        return;
    }
    try {
        start();
    } catch (e) {
        console.error('[CW]autoTryStartCW error: ', e);
    }
})(0);

// ⬇️ TỪ ĐÂY TRỞ XUỐNG: BỎ CHECK ensureCocosReady()


panel.querySelector(' #bMoney ').onclick = function () {
    if (!ensureCocosReady()) {
        console.warn('[CW]MoneyMap: Cocos chưa sẵn sàng(chưa vào phòng game ? ).');
        return;
    }
    S.showMoney = !S.showMoney;
    layerMoney.style.display = S.showMoney ? ' ' : ' none ';
    if (S.showMoney) {
        S.money = buildMoneyRects();
        renderMoney();
    } else {
        S.focus = null;
        showFocus(null);
    }
    panel.style.zIndex = ' 2147483647 ';
};
panel.querySelector(' #bBet ').onclick = function () {
    if (!ensureCocosReady()) {
        console.warn('[CW]BetMap : Cocos chưa sẵn sàng(chưa vào phòng game ? ).');
        return;
    }
    S.showBet = !S.showBet;
    layerBet.style.display = S.showBet ? ' ' : ' none ';
    if (S.showBet) {
        renderBet();
    } else {
        S.focus = null;
        showFocus(null);
    }
    panel.style.zIndex = ' 2147483647 ';
};
panel.querySelector(' #bText ').onclick = function () {
    if (!ensureCocosReady()) {
        console.warn('[CW]TextMap : Cocos chưa sẵn sàng(chưa vào phòng game ? ).');
        return;
    }
    S.showText = !S.showText;
    layerText.style.display = S.showText ? ' ' : ' none ';
    if (S.showText) {
        renderText();
    } else {
        S.focus = null;
        showFocus(null);
    }
    panel.style.zIndex = ' 2147483647 ';
};
panel.querySelector(' #bButton ').onclick = function () {
    if (!ensureCocosReady()) {
        console.warn('[CW]ButtonMap : Cocos chưa sẵn sàng(chưa vào phòng game ? ).');
        return;
    }
    S.showButton = !S.showButton;
    layerButton.style.display = S.showButton ? ' ' : ' none ';
    if (S.showButton) {
        renderButton();
    } else {
        S.focus = null;
        showFocus(null);
    }
    panel.style.zIndex = ' 2147483647 ';
};

panel.querySelector(' #bScanMoney ').onclick = function () {
    scan200Money();
};
panel.querySelector(' #bScanBet ').onclick = function () {
    scan200Bet();
};
panel.querySelector(' #bScanText ').onclick = function () {
    scan200Text();
};
panel.querySelector(' #bScanButton ').onclick = function () {
    scan200Button();
};

panel.querySelector(' #bDumpLogin ').onclick = function () {
    dumpLoginInfo();
};
panel.querySelector(' #bBetC ').addEventListener(' click ', async function () {
    var n = parseFloat(document.getElementById(' iStake ').value || ' 1 ');
    var amount = Math.max(0, Math.floor((isFinite(n) ? n : 1))) * 1000;
    try {
        window.chrome && window.chrome.webview && window.chrome.webview.postMessage && window.chrome.webview.postMessage(JSON.stringify({
                abx: ' cwBet ',
                side: ' CHAN ',
                amount: amount,
                ts: Date.now()
            }));
    } catch (e) {}
    try {
        await cwBet(' CHAN ', amount);
    } catch (e) {}
}, true);
panel.querySelector(' #bBetL ').addEventListener(' click ', async function () {
    var n = parseFloat(document.getElementById(' iStake ').value || ' 1 ');
    var amount = Math.max(0, Math.floor((isFinite(n) ? n : 1))) * 1000;
    try {
        window.chrome && window.chrome.webview && window.chrome.webview.postMessage && window.chrome.webview.postMessage(JSON.stringify({
                abx: ' cwBet ',
                side: ' LE ',
                amount: amount,
                ts: Date.now()
            }));
    } catch (e) {}
    try {
        await cwBet(' LE ', amount);
    } catch (e) {}
}, true);

function onKey(e) {
    var t = e.target;
    if (t && (t.tagName === ' INPUT ' || t.tagName === ' TEXTAREA ' || t.isContentEditable))
        return;
    var k = (e.key || ' ').toLowerCase();
    if (k === ' s ')
        (S.running ? stop() : start());
    else if (k === ' m ')
        panel.querySelector(' #bMoney ').click();
    else if (k === ' b ')
        panel.querySelector(' #bBet ').click();
    else if (k === ' t ')
        panel.querySelector(' #bText ').click();
}
document.addEventListener(' keydown ', onKey);
start();

function teardown() {
    try {
        stop();
    } catch (e) {}
    try {
        document.removeEventListener(' keydown ', onKey);
    } catch (e) {}
    try {
        root.remove();
    } catch (e) {}
}
window[NS] = {
    teardown: teardown
};

/* === CW Bridge: push snapshot -> C#, receive bet																							<- C#===================*/
;
(() => {
    ' use strict ';

    // xác định đang ở màn hình game (cocos) hay không
    function __cw_isGameUi() {
        try {
            // 1) nếu cocos đã lên scene thì coi như là game
            if (window.cc && cc.director && cc.director.getScene) {
                var sc = cc.director.getScene();
                if (sc && sc.name) {
                    var n = sc.name.toLowerCase();
                    // bạn có thể siết thêm theo tên
                    if (n.indexOf(' xocdia ') !== -1 || n.indexOf(' xd ') !== -1) {
                        return true;
                    }
                }
                // có scene rồi thì coi như game
                return true;
            }

            // 2) fallback theo host
            var h = (location && location.hostname ? location.hostname : ' ').toLowerCase();
            if (h.startsWith(' games.'))
                return true;

            // 3) còn lại coi như home
            return false;
        } catch (e) {
            return false;
        }
    }

    /* ... GIỮ NGUYÊN TOÀN BỘ PHẦN TRÊN CỦA BẠN ...
    (từ đầu file tới ngay trước đoạn "/* === CW Bridge ..." cũ)
    Mình không thay gì ở đó, mình chỉ dán lại nguyên phần dưới
    vì phần trên của bạn dài và đang chạy ok.
     */

    /* === CW Bridge: push snapshot -> C#, receive bet																								<- C#===================*/
    (function () {
        try {
            if (!window.chrome || !chrome.webview || !chrome.webview.postMessage) {
                console.warn('[CW]chrome.webview.postMessage not available ');
            }
        } catch (_) {}

        function safePost(obj) {
            try {
                if (window.chrome && chrome.webview && typeof chrome.webview.postMessage === ' function ') {
                    chrome.webview.postMessage(JSON.stringify(obj));
                } else {
                    parent.postMessage(obj, ' * ');
                }
            } catch (e) {
                try {
                    parent.postMessage(obj, ' * ');
                } catch (_) {}
            }
        }

        var _pushTimer = null;
        var _lastJson = ' ';

        function shallowChanged(obj) {
            var s = ' ';
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
                var cp = (typeof collectProgress === ' function ') ? collectProgress() : null;
                if (typeof cp === ' number ')
                    return cp;
                if (cp && typeof cp.val === ' number ')
                    return cp.val;
                if (cp && typeof cp.progress === ' number ')
                    return cp.progress;
            } catch (_) {}
            return null;
        }

        function readTotalsSafe() {
            try {
                return (typeof sampleTotalsNow === ' function ') ? sampleTotalsNow() : null;
            } catch (_) {
                return null;
            }
        }

        function readSeqSafe() {
            ƯU TIÊN lấy từ lịch sử S.seq(đã merge + cắt 50 kết quả)
            try {
                if (typeof S === ' object ' && typeof S.seq === ' string ' && S.seq.length) {
                    return S.seq;
                }
            } catch (_) {}

            Fallback: nếu vì lý do
                gì đó S.seq chưa có thì đọc trực tiếp từ bảng
                try {
                    if (typeof readTKSeq === ' function ') {
                        var r = readTKSeq();
                        return (r && r.seq) ? r.seq : ' ';
                    }
                } catch (_) {}

            return ' ';
}

 === thay thế đoạn window.__cw_startPush cũ bằng đoạn này ===
window.__cw_startPush = function (tickMs) {
    try {
        if (!tickMs || tickMs < 200)
            tickMs = 400;

        hủy timer cũ nếu có
        if (window.__cw_pushTimer) {
            clearInterval(window.__cw_pushTimer);
            window.__cw_pushTimer = null;
        }

        helper: tìm node theo tail nếu ở file lớn bạn đã có sẵn
        function findNodeSafe(tail) {
            if (!tail)
                return null;
            if (window.__abx_findNodeByTail)
                return window.__abx_findNodeByTail(tail);
            if (window.findNodeByTail)
                return window.findNodeByTail(tail);

            fallback rất an toàn
            if (!(window.cc && cc.director && cc.director.getScene))
                return null;
            var scene = cc.director.getScene();
            if (!scene)
                return null;
            var sceneName = scene.name;
            var parts = String(tail).split(' / ').filter(Boolean);
            if (parts[0] === sceneName)
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

        helper: nhận diện đang ở HOME hay GAME
        function detectUiMode() {
            try {
                var sceneName = ' ';
                if (window.cc && cc.director && cc.director.getScene) {
                    var sc = cc.director.getScene();
                    if (sc)
                        sceneName = sc.name || ' ';
                }

                ưu tiên 1: có loginView->xem như HOME
                var loginNode = findNodeSafe(' MainGame / Canvas / loginView ');
                if (loginNode && loginNode.activeInHierarchy !== false) {
                    return {
                        ui: ' home ',
                        via: ' loginView ',
                        scene: sceneName
                    };
                }

                ưu tiên 2: có list game bên trái->cũng là HOME
                var listNode =
                    findNodeSafe(' MainGame / Canvas / widget - left / offset - left / scrollview - game ')
                     || findNodeSafe(' MainGame Canvas widget - left offset - left scrollview - game mask view content ');

                if (listNode && listNode.activeInHierarchy !== false) {
                    return {
                        ui: ' home ',
                        via: ' game - list ',
                        scene: sceneName
                    };
                }

                ưu tiên 3: có view xóc đĩa ngang->GAME
                var xdNode = findNodeSafe(' MainGame / Canvas / Xocdia_MD_View_Ngang ');
                if (xdNode && xdNode.activeInHierarchy !== false) {
                    return {
                        ui: ' game ',
                        via: ' xocdia - view ',
                        scene: sceneName
                    };
                }

                fallback: nhìn scene name
                if (sceneName && sceneName.indexOf(' Xocdia ') !== -1) {
                    return {
                        ui: ' game ',
                        via: ' scene - name ',
                        scene: sceneName
                    };
                }

                return {
                    ui: ' unknown ',
                    via: ' none ',
                    scene: sceneName
                };
            } catch (e) {
                return {
                    ui: ' unknown ',
                    via: ' err: ' + e.message,
                    scene: ' '
                };
            }
        }

        -- - Tails cho nickname ở GAME,
        PHIÊN & status(đa biến thể)-- -
        const TAIL_NICK_GAME = ' MainGame / Canvas / Xocdia_MD_View_Ngang / Top / Info_Content / PlayerName / DisplayName_Lb ';
        const TAIL_NICK_HOME = ' MainGame / Canvas / widget - top - view / wrapAvatar / lbNickName ';

        NEW: thử nhiều tail cho "Phiên cược"
        const TAIL_SESSION_CANDS = [
            ' MainGame Canvas Xocdia_MD_View_Ngang Top SessionContent Session_Lb ', layout cũ
            ' MainGame / Canvas / Xocdia_MD_View_Ngang / Top / Info_Content / Session_Lb ', KH24 biến thể mới
            ' MainGame / Canvas / Xocdia_MD_View_Doc / Top / SessionContent / Session_Lb ', layout dọc
            ' MainGame / Canvas / Xocdia_MD_View_Ngang / Top / Info_Content / SessionContent / Session_Lb ' một số bàn khác
        ];

        Status có thể nằm ở nhiều nơi
        const TAIL_STATUS_CANDS = [
            ' MainGame Canvas Xocdia_MD_View_Ngang Top Info_Content Status_Lb ',
            ' MainGame / Canvas / Xocdia_MD_View_Ngang / Top / Info_Content / Lock_Lb ',
            ' MainGame / Canvas / Xocdia_MD_View_Ngang / Top / StatusContent / Status_Lb ',
        ];

        đọc text từ node: ưu tiên cc.Label,
        rồi đến cc.RichText
        function getLabelText(node) {
            try {
                var lb = node && node.getComponent && node.getComponent(cc.Label);
                if (lb && typeof lb.string !== ' undefined ')
                    return String(lb.string);
                var rt = node && node.getComponent && node.getComponent(cc.RichText);
                if (rt && typeof rt.string !== ' undefined ')
                    return String(rt.string);
            } catch (_) {}
            return null;
        }

        helper đọc text theo tail(đúng bản, KHÔNG để rơi lỗi rồi trả null)
        function readLabelByTail(tail) {
            try {
                var n = findNodeSafe(tail);
                if (!n)
                    return null;
                var t = getLabelText(n);
                return (t == null ? null : String(t).trim());
            } catch (_) {
                return null;
            }
        }

        nickname: ưu tiên GAME,
        fallback HOME
        function readNickSmart() {
            return readLabelByTail(TAIL_NICK_GAME) || readLabelByTail(TAIL_NICK_HOME) || null;
        }

        PHIÊN CƯỢC: chỉ đọc khi đang ở GAME,
        ưu tiên đúng tail SessionContent Session_Lb
        function readSessionText() {
            try {
                var ui = detectUiMode();
                if (!ui || ui.ui !== ' game ')
                    return null;

                1)ƯU TIÊN đúng đuôi SessionContent Session_Lb như ông chủ yêu cầu
                var PREFERRED = ' MainGame / Canvas / Xocdia_MD_View_Ngang / Top / SessionContent / Session_Lb ';
                var s0 = readLabelByTail(PREFERRED);
                if (s0 &&  ^ # \ d {
                    3,
                }
                    $.test(s0.trim()))
                    return s0.trim();

                2)Các biến thể còn lại(nếu có)
                for (var i = 0; i < TAIL_SESSION_CANDS.length; i++) {
                    var tail = TAIL_SESSION_CANDS[i];
                    if (tail === PREFERRED)
                        continue;
                    đã thử ở trên
                    var s = readLabelByTail(tail);
                    if (s &&  ^ # \ d {
                        3,
                    }
                        $.test(s.trim()))
                        return s.trim();
                }

                3)Fallback an toàn: CHỈ quét label có tail kết thúc bằng ' session_lb '
                để tránh nhặt nhầm các label ' #' ở nơi khác
                var labs = collectLabels();
                var best = null;
                for (var k = 0; k < labs.length; k++) {
                    var tl = String(labs[k].tail || ' ').toLowerCase();
                    if (tl.endsWith(' session_lb ') || tl.indexOf(' sessioncontent session_lb ') !== -1) {
                        var txt = String(labs[k].text || ' ').trim();
                        if ( ^ # \ d {
                            3,
                        }
                            $.test(txt)) {
                            best = txt;
                            break;
                        }
                    }
                }
                return best || null;
            } catch (_) {
                return null;
            }
        }

        window.__cw_pushTimer = setInterval(function () {
            try {
                1)đọc tiến trình & status(ưu tiên text)
                var p = readProgressVal();
                var st = (typeof __cw_readStatusSmart === ' function ') ? __cw_readStatusSmart() : null;

                NEW: ánh xạ prog theo status: open = 1,
                locked = 0,
                còn lại fallback p cũ
                var prog = p;
                if (st === ' open ') {
                    prog = 1;
                } else if (st === ' locked ') {
                    prog = 0;
                }
                var session = readSessionText();
                var uiInfo = detectUiMode();
                if (!uiInfo) {
                    uiInfo = {
                        ui: ' unknown ',
                        via: ' none ',
                        scene: ' '
                    };
                }

                2)nick thông minh: GAME trước,
                HOME sau;
                rồi cache vào S.lastNick
                var nickNow = readNickSmart() || readHomeNick() || ' ';
                if (nickNow)
                    S.lastNick = nickNow;

                3)totals an toàn,
                và nếu đang ở HOME thì chèn số dư màn HOME vào A rawA
                var tots = readTotalsSafe() || {};
                if (uiInfo.ui === ' home ') {
                    var hb = readHomeBalance(); {
                        val,
                        raw
                    }
                    if (hb && hb.val != null) {
                        tots.A = hb.val;
                        tots.rawA = hb.raw;
                    }
                }

                4)cập nhật UI nội bộ cho panel
                S.status = st;
                S.sessionText = session || null;

                5)gói snapshot đẩy sang C #
                var snap = {
                    abx: ' tick ',
                    prog: prog,
                    dùng 0 1 theo status
                    totals: tots,
                    dùng totals đã được patch ở HOME
                    seq: readSeqSafe(),
                    status: String(st || ' '),
                    session: session || undefined,
                    giữ nguyên định dạng cũ
                    nick: S.lastNick || ' ',
                    ui: uiInfo.ui,
                    ui_via: uiInfo.via,
                    scene: uiInfo.scene,
                    ts: Date.now()
                };

                6)gửi nếu thay đổi(đỡ spam kênh webview)
                if (shallowChanged(snap)) {
                    if (window.chrome && window.chrome.webview && window.chrome.webview.postMessage) {
                        window.chrome.webview.postMessage(JSON.stringify(snap));
                    } else if (window.external && typeof window.external.notify === ' function ') {
                        window.external.notify(JSON.stringify(snap));
                    } else {
                        không có kênh gửi thì bỏ qua
                    }
                }
            } catch (err) {
                nuốt lỗi để không làm vỡ vòng tick
                console.warn('[__cw_startPush]tick err ', err);
            }
        }, tickMs);

    } catch (e) {
        console.warn('[__cw_startPush]init err ', e);
    }
};

window.__cw_stopPush = function () {
    if (window.__cw_pushTimer) {
        clearInterval(window.__cw_pushTimer);
        window.__cw_pushTimer = null;
    }
    return ' stopped ';
};

hàm bet bridge: CHỈ báo thành công khi thực sự có thay đổi tiền
window.__cw_bet = async function (side, amount) {
    try {
        side = (String(side || ' ').toUpperCase() === ' CHAN ') ? ' CHAN ' : ' LE ';
        var amt = Math.max(0, Math.floor(Number(amount) || 0));

        if (typeof cwBet !== ' function ') {
            throw new Error(' cwBet not found ');
        }

        var before = (typeof readTotalsSafe === ' function ')
         ? (readTotalsSafe() || {})
         : null;

        gọi core cwBet(có KH24 bên trong)
        var okCore = await cwBet(side, amt);

        kiểm tra tổng tiền có đổi không
        var changed = false;
        if (before && typeof waitForTotalsChange === ' function ') {
            try {
                changed = await waitForTotalsChange(before, side, 1600);
            } catch (_) {}
        }

        CHỈ báo lỗi "no_totals_change" khi:
         - đã đọc được snapshot ban đầu(before != null)
         - core cwBet trả về false
         - và tổng tiền thực sự không đổi
        if (before && !okCore && !changed) {
            không đặt được → báo lỗi cho C #
            safePost({
                abx: ' bet_error ',
                side: side,
                amount: amt,
                error: ' no_totals_change ',
                ts: Date.now()
            });
            return ' fail ';
        }

        chỉ khi đặt OK mới báo[BET]cho C #

        safePost({
            abx: ' bet ',
            side: side,
            amount: amt,
            ts: Date.now()
        });
        return ' ok ';
    } catch (err) {
        safePost({
            abx: ' bet_error ',
            side: side,
            amount: amount,
            error: String(err && err.message || err),
            ts: Date.now()
        });
        return ' fail ';
    }
};

 *=  == LOGIN HELPER(ĐÃ SỬA) ===  ===  ===  ===  ===  ===  ===  ===  ===  ===  ===  ===  ===  * /
                        																								  (function () {
                        																								  *===================AUTO LOGIN WATCHER===================*/
 * các tail bạn đang dùng *
var HEADER_LOGIN_TAIL = ' MainGame / Canvas / widget - header / group - login / btn - Login ';
var POPUP_LOGIN_BTN_TAIL = ' MainGame / Canvas / loginView / offset - login / btn - Login ';
var POPUP_ROOT_TAIL = ' MainGame / Canvas / loginView ';

 * chỗ này mình làm biến toàn cục để C #có thể bắn vào *
mặc định rỗng – nếu bạn muốn hard - code thì sửa ngay ở đây
window.__cw_loginUser = window.__cw_loginUser || ' ';
window.__cw_loginPass = window.__cw_loginPass || ' ';

 * nhận message từ C #để cập nhật user pass
bên C #chỉ cần post: {
    "__cw_cmd": "set_login",
    "user": "...",
    "pass": "..."
}
 *
(function () {
    THAY block onMsg cũ BẰNG block mới này:
    function onMsg(ev) {
        var d = ev && (ev.data || ev);
        if (typeof d === ' string ') {
            try {
                d = JSON.parse(d);
            } catch (_) {
                d = null;
            }
        }
        if (!d || d.__cw_cmd !== ' set_login ')
            return;

        var changed = false;
        if (typeof d.user === ' string ' && d.user !== window.__cw_loginUser) {
            window.__cw_loginUser = d.user;
            changed = true;
        }
        if (typeof d.pass === ' string ' && d.pass !== window.__cw_loginPass) {
            window.__cw_loginPass = d.pass;
            changed = true;
        }
        if (changed) {
            console.log('[auto - login]cập nhật credential từ host.');
        }
    }

    try {
        window.addEventListener(' message ', onMsg, true);
    } catch (_) {}
    try {
        if (window.chrome && window.chrome.webview) {
            window.chrome.webview.addEventListener(' message ', onMsg);
        }
    } catch (_) {}
})();

 * hàm này bạn đã có ở dưới – mình dùng lại.
nếu tên hàm của bạn khác thì khỏi tạo lại. *
function findNodeByTail(tail) {
    try {
        if (!(window.cc && cc.director && cc.director.getScene))
            return null;
        var scene = cc.director.getScene();
        if (!scene)
            return null;

        var parts = String(tail || ' ').split(' ').filter(Boolean);
        if (parts.length && parts[0] === scene.name) {
            parts.shift();
        }

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

function isNodeVisible(node) {
    if (!node)
        return false;
    if (node.activeInHierarchy === false)
        return false;
    try {
        if (typeof node.getOpacity === ' function ') {
            if (node.getOpacity() <= 0)
                return false;
        } else if (typeof node.opacity === ' number ' && node.opacity <= 0) {
            return false;
        }
    } catch (_) {}
    try {
        var sz = node.getContentSize ? node.getContentSize() : (node._contentSize || null);
        if (sz && (sz.width === 0 || sz.height === 0))
            return false;
    } catch (_) {}
    return true;
}

 * tìm các EditBox trong popup và điền user pass *
function __cw_fillLoginPopup() {
    var root = findNodeByTail(POPUP_ROOT_TAIL);
    if (!root || !isNodeVisible(root)) {
        return ' no - popup ';
    }

    gom tất cả editbox ở dưới popup
    var boxes = [];
    (function walk(n) {
        if (!n)
            return;
        var eb = n.getComponent && n.getComponent(cc.EditBox);
        if (eb) {
            boxes.push({
                node: n,
                eb: eb,
                tail: (function () {
                    nếu file gốc của bạn đã có tailOf thì nên dùng tailOf(n, 12)
                    try {
                        var names = [],
                        p = n;
                        while (p) {
                            names.push(p.name || ' ');
                            p = p.parent;
                        }
                        return names.reverse().join(' ').toLowerCase();
                    } catch (_) {
                        return ' ';
                    }
                })()
            });
        }
        var kids = n.children || n._children || [];
        for (var i = 0; i < kids.length; i++)
            walk(kids[i]);
    })(root);

    if (!boxes.length) {
        console.warn('[auto - login]không tìm thấy EditBox nào trong popup.');
        return ' no - editbox ';
    }

    var user = window.__cw_loginUser || ' ';
    var pass = window.__cw_loginPass || ' ';

    đoán ô user pass theo tail
    var userBox = null,
    passBox = null;
    for (var i = 0; i < boxes.length; i++) {
        var t = boxes[i].tail;
        if (!userBox && user | account | acc | tai[_ - ] ? khoan | taikhoan i.test(t)) {
            userBox = boxes[i];
        }
        if (!passBox && pass | pwd | mat[_ - ] ? khau | matkhau i.test(t)) {
            passBox = boxes[i];
        }
    }
    nếu vẫn chưa đoán được thì lấy lần lượt
    if (!userBox)
        userBox = boxes[0];
    if (!passBox && boxes.length > 1)
        passBox = boxes[1];

    if (userBox && user) {
        userBox.eb.string = user;
        // một số version cần gọi _onDidEditEnded để refresh
        if (typeof userBox.eb._onDidEndedEditing === ' function ')
            userBox.eb._onDidEndedEditing();
    }
    if (passBox && pass) {
        passBox.eb.string = pass;
        if (typeof passBox.eb._onDidEndedEditing === ' function ')
            passBox.eb._onDidEndedEditing();
    }

    //console.log('[auto - login]đã thử điền user / pass vào popup.');
    return ' filled ';
}

/* hàm click như bạn đang có – giữ nguyên ý tưởng */
window.__cw_clickLoginIfNeed = function () {
    // nếu popup đang mở thì chỉ điền
    var popupBtn = findNodeByTail(POPUP_LOGIN_BTN_TAIL);
    if (popupBtn && isNodeVisible(popupBtn)) {
        __cw_fillLoginPopup();
        return ' popup - open ';
    }

    // nếu nút header còn thì click
    var header = findNodeByTail(HEADER_LOGIN_TAIL);
    if (!header) {
        return ' no - header ';
    }
    if (!isNodeVisible(header)) {
        return ' header - hidden ';
    }

    var btn = header.getComponent && header.getComponent(cc.Button);
    if (btn) {
        cc.Component.EventHandler.emitEvents(btn.clickEvents, new cc.Event.EventCustom(' click ', true));
        console.log('[auto - login]click header login.');
        return ' clicked - header ';
    }

    // fallback DOM như code cũ của bạn
    var list = window.__abx_buttons || [];
    for (var i = 0; i < list.length; i++) {
        var it = list[i];
        if (it.tail === HEADER_LOGIN_TAIL) {
            var cx = Math.round(it.x + it.w 2);
            var cy = Math.round(it.y + it.h 2);
            var canvas = document.querySelector(' canvas ') || document.body;
            [' pointerdown ', ' mousedown ', ' pointerup ', ' mouseup ', ' click '].forEach(function (t) {
                canvas.dispatchEvent(new MouseEvent(t, {
                        bubbles: true,
                        cancelable: true,
                        clientX: cx,
                        clientY: cy,
                        button: 0
                    }));
            });
            console.log('[auto - login]DOM click header login.');
            return ' dom - fallback - clicked ';
        }
    }

    return ' fail ';
};

danh sách tail có thể thay đổi sau này
const TAILS = [
    ' MainGame Canvas loginView offset - login btn - Login '
    sau này cần thêm thì push thêm ở đây
];

1)HÀM DÙNG CHUNG – GIỮ MỘT BẢN DUY NHẤT Ở NGOÀI
function findNodeByTailCompat(tail) {
    if (window.__abx_findNodeByTail)
        return window.__abx_findNodeByTail(tail);
    if (window.findNodeByTail)
        return window.findNodeByTail(tail);

    if (!(window.cc && cc.director && cc.director.getScene))
        return null;
    const scene = cc.director.getScene();
    if (!scene)
        return null;

    const sceneName = scene.name;
    let parts = String(tail || ' ').split(' ').filter(Boolean);
    if (parts[0] === sceneName)
        parts.shift();

    let node = scene;
    for (let i = 0; i < parts.length; i++) {
        const name = parts[i];
        const kids = node.children || node._children || [];
        let found = null;
        for (let j = 0; j < kids.length; j++) {
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

// 2) HÀM NHẬN DIỆN HOME – ĐẶT Ở ĐÂY
function __cw_isHomeScreen() {
    const HOME_TAILS = [
        ' MainGame Canvas widget - topRight - noHide group - login btn - Login ',
        ' MainGame / Canvas / widget - header / group - login / btn - Login '
    ];
    for (const t of HOME_TAILS) {
        const n = findNodeByTailCompat(t);
        if (n && n.activeInHierarchy !== false)
            return true;
    }

    const GAME_HINTS = [
        ' MainGame Canvas Xocdia_MD_View_Ngang Top Exit_Btn ',
        ' MainGame / Canvas / Xocdia_MD_View_Ngang / Center / GateContent / Chan_Gate '
    ];
    for (const t of GAME_HINTS) {
        const n = findNodeByTailCompat(t);
        if (n && n.activeInHierarchy !== false)
            return false;
    }

    return false;
}
window.__cw_isHomeScreen = __cw_isHomeScreen;

function clickCocosButton(node) {
    if (!node)
        return false;
    Button chuẩn
    try {
        const btn = node.getComponent && node.getComponent(cc.Button);
        if (btn) {
            cc.Component.EventHandler.emitEvents(
                btn.clickEvents,
                new cc.Event.EventCustom(' click ', true));
            console.log('[cw - popup - login]clicked via cc.Button ');
            return true;
        }
    } catch (e) {
        console.warn('[cw - popup - login]btn click error ', e);
    }

    fallback : nếu node có _onTouchEnded
    try {
        if (node._onTouchEnded) {
            node._onTouchEnded();
            console.log('[cw - popup - login]clicked via _onTouchEnded ');
            return true;
        }
    } catch (e2) {}

    return false;
}

HÀM PUBLIC để C #gọi
window.__cw_clickPopupLogin = function () {
    if (!(window.cc && cc.director && cc.director.getScene)) {
        console.warn('[cw - popup - login]cocos chưa sẵn sàng ');
        return false;
    }

    thử từng tail
    for (let i = 0; i < TAILS.length; i++) {
        const tail = TAILS[i];
        const node = findNodeByTailCompat(tail);
        if (!node) {
            continue;
        }
        if (clickCocosButton(node)) {
            console.log('[cw - popup - login]ĐÃ CLICK popup login bằng tail = ', tail);
            return true;
        } else {
            console.warn('[cw - popup - login]tìm thấy node nhưng click không được : ', tail);
        }
    }

     ===  === SCAN 200 BUTTON(HTML) ===  ===
    window.__abx_buttons = window.__abx_buttons || [];

    Mô tả đường dẫn DOM ngắn gọn(body > div : nth - child(2) > ...)
    function cwDescribePath(el) {
        const parts = [];
        let cur = el;
        while (cur && cur !== document.body && cur.nodeType === 1) {
            const tag = cur.tagName.toLowerCase();
            let part = tag;
            if (cur.id) {
                part += ' #' + cur.id;
            } else {
                const cls = (cur.className || ' ').toString().trim().replace(/\s+/g, '.');
                if (cls)
                    part += '.' + cls;
            }
            const parent = cur.parentElement;
            if (parent) {
                const sameTagSiblings = Array.from(parent.children)
                    .filter(c => c.tagName === cur.tagName);
                if (sameTagSiblings.length > 1) {
                    const idx = sameTagSiblings.indexOf(cur);
                    part += `:nth-of-type(${idx + 1})`;
                }
            }
            parts.unshift(part);
            cur = parent;
        }
        return ' body > ' + parts.join(' > ');
    }

    // Hàm thực thi khi bấm Scan200Button
    window.__cw_scan200Button = function () {
        try {
            const minW = 40;
            const minH = 20;
            const root = document.getElementById(' __cw_root_allin ');
            const list = [];

            const all = document.querySelectorAll(
                    ' button, [role = button], a[href], div[onclick], span[onclick]');

            let idx = 0;
            all.forEach(el => {
                // BỎ qua các nút của Canvas Watch để chỉ lấy bên ngoài
                if (root && root.contains(el))
                    return;

                const r = el.getBoundingClientRect();
                if (!r || r.width < minW || r.height < minH)
                    return;

                const text = (el.innerText || el.textContent || ' ').trim();
                if (!text)
                    return;

                list.push({
                    idx: idx++,
                    tag: el.tagName.toLowerCase(),
                    text,
                    x: Math.round(r.left),
                    y: Math.round(r.top),
                    w: Math.round(r.width),
                    h: Math.round(r.height),
                    tail: cwDescribePath(el)
                });
            });

            window.__abx_buttons = list;

            console.log('[CW][Scan200Button]found ', list.length, ' HTML buttons.');
            if (list.length) {
                console.table(list);
            } else {
                console.log(
                    '[CW][Scan200Button]Không tìm thấy button HTML nào.' +
                    ' Trang này nhiều khả năng render bằng Unity / WebGL(chỉ có < canvas > ).');
            }
        } catch (err) {
            console.log('[CW][Scan200Button][ERR]', err);
        }
    };

})();

 *=  ===  ===  ===  ===  ===  ===  ===  ===  ===  ===  ===  ===  ===  ===  ===  ===  ===  ===  ===  ===  ===  ==  * /

        hết CW bridge

        })(); hết toàn file


        cuối hàm boot, THÊM 3 DÒNG NÀY:
        if (window.__cw_startPush) {
        try {
        console.log('[CW][boot]found __cw_startPush, auto attach now...');
        window.__cw_startPush();
        } catch (err) {
        console.error('[CW][boot][attach - err]', err);
                        																										  }
                        																										  }

                        																										  }

                  
                        (function () {
                        																										  🌟 BỔ SUNG STUB: nếu host chưa gán __abx_debug_flags
                        																										  thì tạo hàm mặc định luôn trả false.
                        																										  Host (C#) vẫn có thể ghi đè sau này.
                        																										  if (typeof window.__abx_debug_flags===' undefined ' ) {
                        																										  window.__abx_debug_flags=function (flag) {
                        																										  flag:' noBoot ' ,' noCanvas ' ... (nếu sau này muốn dùng)
                        																										  return false;
                        																										  };
                        																										  }

                        																										  var dbg=window.__abx_debug_flags;
                        																										  var noBoot=false;

                        																										  try {
                        																										  if (!dbg) {
                        																										  noBoot=false;
                        																										  } else if (typeof dbg===' string ' ) {
                        																										  ví dụ:"__noBoot,otherFlag"
                        																										  noBoot=dbg.indexOf(' noBoot ' )>= 0;
                                                } else if (Array.isArray(dbg)) {
                                                    / / ví dụ: ["noBoot", "xxx"]
noBoot = dbg.indexOf(' noBoot ') >= 0;
}
    else if (typeof dbg === ' function ') {
        // ví dụ: window.__abx_debug_flags(' noBoot ') => true/false
        noBoot = !!dbg(' noBoot ');
    }
    }
        catch (e) {
            noBoot = false;
        }

            if (noBoot) {
                console.log('[js_home_v2]boot()SKIPPED vì có cờ noBoot.');
                return;
            }

                // Gọi boot() chỉ khi DOM đã có																											<body>,
                // tránh lỗi khi script bị inject vào about:blank (chưa có body).
                function safeBoot() {
                try {
                    if (!document || !document.body) {
                        console.log('[js_home_v2]skip boot(): chưa có document.body.');
                        return;
                    }
                    boot();
                } catch (e) {
                    console.error('[js_home_v2]boot()error: ', e);
                }
            }

                if (document && document.readyState && document.readyState !== ' loading ' && document.body) {
                    // DOM đã sẵn sàng
                    safeBoot();
                } else {
                        // Chờ DOMContentLoaded
                        var onReady = function () {
                            document.removeEventListener(' DOMContentLoaded ', onReady);
                            safeBoot();
                        };
                        document.addEventListener(' DOMContentLoaded ', onReady);
                    }
                    })();

                    // ===== Realtime reactors: close notice + re-login (robust) =====
                    (function () {
                        if (!window.cc || !cc.director || !cc.director.getScene)
                            return;

                        const TICK_MS = 150;
                        const TTL_MS = 7000; // chống spam cùng 1 mục tiêu
                        const TOPR = () => innerWidth;
                        const TOPH = () => innerHeight;

                        const seen = new Map(); // key -> expiresAt
                        let lastScene = ' ';
                        let timer = null;

                        function now() {
                            return performance && performance.now ? performance.now() : Date.now();
                        }
                        function alive(n) {
                            try {
                                return n && cc.isValid(n) && n.activeInHierarchy !== false;
                            } catch (_) {
                                return false;
                            }
                        }
                        function cooldown(key, ms = TTL_MS) {
                            const t = now();
                            const old = seen.get(key) || 0;
                            if (old > t)
                                return true; // đang cooldown
                            seen.set(key, t + ms);
                            return false;
                        }
                        function resetAll() {
                            seen.clear();
                        }

                        // --- Heuristic: tìm nút đóng thông báo ---
                        function findNoticeClose() {
                            try {
                                const btns = (window.collectButtons ? window.collectButtons() : []).filter(b => {
                                    // vùng góc phải trên của pop-up
                                    const rightSide = b.x > TOPR() * 0.55;
                                    const highArea = b.w >= 24 && b.h >= 24 && b.w <= 140 && b.h <= 140;
                                    const topBand = b.y < TOPH() * 0.50;
                                    return rightSide && topBand && highArea;
                                });

                                Ưu tiên tail gợi ý "close"
                                let cand = btns.filter(b => /close|btnclose|buttonclose|dong|x_|_x$/i.test(b.tail || ' '));
                                if (!cand.length)
                                    cand = btns;
                                if (!cand.length)
                                    return null;

                                cand.sort((a, b) => (a.y - b.y) || (a.x - b.x)); // cái cao & sát góc trước
                                return cand[0];
                            } catch (_) {
                                return null;
                            }
                        }

                        // --- Heuristic: tìm “Đăng nhập lại / Reconnect” và nút gần đó ---
                        function findRelogin() {
                            try {
                                const texts = (window.buildTextRects ? window.buildTextRects() : []);
                                const want = texts.filter(t => /đăng\s*nhập\s*lại|kết\s*nối\s*lại|re\s*login|reconnect|login\s*again/i.test(t.text || ' '));
                                if (!want.length)
                                    return null;

                                // tìm button gần nhất với text này
                                const btns = (window.collectButtons ? window.collectButtons() : []);
                                function d2(ax, ay, bx, by) {
                                    const dx = ax - bx,
                                    dy = ay - by;
                                    return dx * dx + dy * dy;
                                }

                                let best = null,
                                bestD = 1e18;
                                for (const w of want) {
                                    const cx = w.x + w.w / 2,
                                    cy = w.y + w.h / 2;
                                    for (const b of btns) {
                                        const bx = b.x + b.w / 2,
                                        by = b.y + b.h / 2;
                                        const dist = d2(cx, cy, bx, by);
                                        if (dist < bestD) {
                                            bestD = dist;
                                            best = b;
                                        }
                                    }
                                }
                                return best || null;
                            } catch (_) {
                                return null;
                            }
                        }

                        async function clickButtonBox(b) {
                            if (!b)
                                return false;
                            const r = {
                                x: b.x,
                                y: b.y,
                                w: b.w,
                                h: b.h
                            };
                            if (window.clickRectCenter)
                                return clickRectCenter(r);
                            fallback dùng emitClick theo tail
                            const n = window.findNodeByTailCompat ? window.findNodeByTailCompat(b.tail) : null;
                            if (alive(n)) {
                                const hit = window.clickableOf ? window.clickableOf(n) : n;
                                return window.emitClick ? window.emitClick(hit) : false;
                            }
                            return false;
                        }

                        async function tick() {
                            try {
                                Reset khi đổi scene
                                const sc = (cc.director.getScene() && cc.director.getScene().name) || ' ';
                                if (sc && sc !== lastScene) {
                                    lastScene = sc;
                                    resetAll();
                                }

                                1)Close thông báo nếu có
                                const closeBtn = findNoticeClose();
                                if (closeBtn && !cooldown(' notice: ' + closeBtn.x + ', ' + closeBtn.y)) {
                                    await clickButtonBox(closeBtn);
                                }

                                2)Nút "Đăng nhập lại/Kết nối lại"
                                const relogBtn = findRelogin();
                                if (relogBtn && !cooldown(' relogin: ' + relogBtn.x + ', ' + relogBtn.y)) {
                                    await clickButtonBox(relogBtn);
                                }

                            } catch (e) {
                                 * noop *
                            }
                        }

                        Public API để bật tắt
                        window.cwReactor = window.cwReactor || {
                            start() {
                                if (timer)
                                    return;

                                Chỉ start khi Cocos đã sẵn sàng
                                if (!(window.cc && cc.director && typeof cc.director.getScene === ' function ')) {
                                    console.log('[cwReactor]START skipped: Cocos not ready ');
                                    return;
                                }

                                var scene = cc.director.getScene();
                                lastScene = (scene && scene.name) ? scene.name : ' ';
                                resetAll();
                                timer = setInterval(tick, TICK_MS);
                                console.log('[cwReactor]START ', {
                                    tick: TICK_MS
                                });
                            },
                            stop() {
                                if (!timer)
                                    return;
                                clearInterval(timer);
                                timer = null;
                                console.log('[cwReactor]STOP ');
                            },
                            kick() {
                                tick();
                            }
                            chạy 1 nhịp ngay lập tức
                        };

                        auto start sớm nhưng an toàn: để 1 frame cho scene dựng xong
                        requestAnimationFrame(() => {
                            requestAnimationFrame(() => {
                                window.cwReactor.start();
                            });
                        });

                    })();
