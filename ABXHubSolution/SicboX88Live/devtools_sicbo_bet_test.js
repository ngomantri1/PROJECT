(function () {
    var cc0 = window.cc;
    if (!cc0 || !cc0.director || !cc0.director.getScene) {
        throw new Error("cc.director.getScene() not available");
    }

    var V2 = (cc0.v2 || cc0.Vec2 || function (x, y) {
        return { x: x, y: y };
    });

    var PATH_BET_TOTAL = "/canvas/root/betarea/lbl_totalbet";
    var BET_ZONE_PATHS = {
        TAI: "/canvas/root/betarea/tai_bet",
        XIU: "/canvas/root/betarea/xiu_bet",
        CHAN: "/canvas/root/betarea/chan_bet",
        LE: "/canvas/root/betarea/le_bet"
    };
    var PATH_CHIP_LABEL = "/canvas/root/right/chippanel/view/content/lbl_value";
    var PATH_CHIP_PANEL = "/canvas/root/right/chippanel";
    var RE_CHIP_NODE = /\/canvas\/root\/right\/chippanel\/view\/content\/chip_?\d+$/i;

    var CLICK_DELAY_MS = 120;
    var TOTAL_WAIT_MS = 1800;
    var POLL_MS = 80;

    function sleep(ms) {
        return new Promise(function (resolve) {
            setTimeout(resolve, ms);
        });
    }

    function getComp(node, T) {
        try {
            return node && node.getComponent ? node.getComponent(T) : null;
        } catch (_) {
            return null;
        }
    }

    function active(node) {
        return !node || node.activeInHierarchy !== false;
    }

    function normText(s) {
        return String(s || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toUpperCase();
    }

    function normalizeSide(raw) {
        var s = normText(raw).replace(/[^A-Z0-9]+/g, "_");
        if (s === "TAI" || s === "BIG") return "TAI";
        if (s === "XIU" || s === "SMALL") return "XIU";
        if (s === "CHAN" || s === "EVEN") return "CHAN";
        if (s === "LE" || s === "ODD") return "LE";
        throw new Error("Unsupported side: " + raw);
    }

    function fullPath(node, limit) {
        var arr = [];
        var cur = node;
        var cap = limit || 160;
        var i = 0;
        while (cur && i++ < cap) {
            arr.push(cur.name || "(noname)");
            cur = cur.parent || cur._parent || null;
        }
        return arr.reverse().join("/");
    }

    function readCompText(c) {
        if (!c) return "";
        var keys = ["string", "_string", "_N$string", "text", "_text"];
        for (var i = 0; i < keys.length; i++) {
            try {
                var v = c[keys[i]];
                if (v != null) {
                    var s = String(v).trim();
                    if (s) return s;
                }
            } catch (_) { }
        }
        return "";
    }

    function nodeText(node) {
        if (!node) return "";
        return readCompText(getComp(node, cc0.Label)) || readCompText(getComp(node, cc0.RichText)) || "";
    }

    function parseAmount(text) {
        if (text == null) return null;
        var raw = String(text).trim().replace(/\s+/g, "").replace(/,/g, "");
        if (!raw) return null;
        var m = raw.match(/^([0-9]+(?:\.[0-9]+)?)([KMB])?$/i);
        if (m) {
            var base = parseFloat(m[1]);
            var unit = (m[2] || "").toUpperCase();
            var mul = 1;
            if (unit === "K") mul = 1e3;
            else if (unit === "M") mul = 1e6;
            else if (unit === "B") mul = 1e9;
            return Math.round(base * mul);
        }
        var digits = raw.replace(/[^0-9]/g, "");
        return digits ? parseInt(digits, 10) : null;
    }

    function formatAmount(v) {
        var n = Math.round(+v || 0);
        return n.toLocaleString("en-US");
    }

    function nodeWorldPos(node) {
        try {
            if (node && node.getWorldPosition) return node.getWorldPosition();
        } catch (_) { }
        try {
            if (node && node.convertToWorldSpaceAR) return node.convertToWorldSpaceAR(new V2(0, 0));
        } catch (_) { }
        return { x: 0, y: 0 };
    }

    function toScreenPt(node, p) {
        try {
            var cam = null;
            if (cc0.Camera && cc0.Camera.findCamera) cam = cc0.Camera.findCamera(node);
            else if (cc0.Camera && cc0.Camera.main) cam = cc0.Camera.main;
            if (cam && cam.worldToScreen) {
                var sp = cam.worldToScreen(p);
                var fs = cc0.view && cc0.view.getFrameSize ? cc0.view.getFrameSize() : null;
                var vs = cc0.view && cc0.view.getVisibleSize ? cc0.view.getVisibleSize() : null;
                if (fs && vs && vs.width && vs.height) {
                    return {
                        x: sp.x * (fs.width / vs.width),
                        y: sp.y * (fs.height / vs.height)
                    };
                }
                return { x: sp.x, y: sp.y };
            }
        } catch (_) { }
        return { x: p.x || 0, y: p.y || 0 };
    }

    function rectFromNode(node) {
        if (!node) return null;
        try {
            var p = node.convertToWorldSpaceAR(new V2(0, 0));
            var cs = node.getContentSize ? node.getContentSize() : (node._contentSize || { width: 0, height: 0 });
            var w = cs.width || 0;
            var h = cs.height || 0;
            var ax = node.anchorX != null ? node.anchorX : 0.5;
            var ay = node.anchorY != null ? node.anchorY : 0.5;
            var bl = { x: (p.x || 0) - w * ax, y: (p.y || 0) - h * ay };
            var tr = { x: bl.x + w, y: bl.y + h };
            var s1 = toScreenPt(node, bl);
            var s2 = toScreenPt(node, tr);
            return {
                sx: Math.min(s1.x, s2.x),
                sy: Math.min(s1.y, s2.y),
                sw: Math.abs(s2.x - s1.x) || 1,
                sh: Math.abs(s2.y - s1.y) || 1
            };
        } catch (_) {
            return null;
        }
    }

    function centerOfRect(r) {
        return {
            x: r.sx + r.sw / 2,
            y: r.sy + r.sh / 2
        };
    }

    function clamp(v, a, b) {
        return Math.max(a, Math.min(b, v));
    }

    function dist2(x1, y1, x2, y2) {
        var dx = (x1 || 0) - (x2 || 0);
        var dy = (y1 || 0) - (y2 || 0);
        return dx * dx + dy * dy;
    }

    function clickable(node) {
        return !!(getComp(node, cc0.Button) || getComp(node, cc0.Toggle) || node._touchListener);
    }

    function clickableAncestor(node, depth) {
        var cur = node;
        var maxDepth = depth == null ? 6 : depth;
        var i = 0;
        while (cur && i++ <= maxDepth) {
            if (clickable(cur)) return cur;
            cur = cur.parent || cur._parent || null;
        }
        return null;
    }

    function clickCanvasXY(x, y, tryFlipY) {
        var canvas = document.querySelector("canvas");
        if (!canvas) return false;
        var br = canvas.getBoundingClientRect();
        var scaleX = canvas.width ? (br.width / canvas.width) : 1;
        var scaleY = canvas.height ? (br.height / canvas.height) : 1;
        var clientX = Math.round(br.left + x * scaleX);
        var clientY = Math.round(br.top + y * scaleY);

        try {
            canvas.dispatchEvent(new PointerEvent("pointerdown", {
                bubbles: true,
                cancelable: true,
                pointerType: "mouse",
                isPrimary: true,
                clientX: clientX,
                clientY: clientY,
                buttons: 1
            }));
        } catch (_) { }

        try {
            canvas.dispatchEvent(new PointerEvent("pointerup", {
                bubbles: true,
                cancelable: true,
                pointerType: "mouse",
                isPrimary: true,
                clientX: clientX,
                clientY: clientY
            }));
        } catch (_) { }

        try {
            canvas.dispatchEvent(new MouseEvent("click", {
                bubbles: true,
                cancelable: true,
                clientX: clientX,
                clientY: clientY
            }));
        } catch (_) { }

        if (tryFlipY && canvas.height) {
            try {
                var fy = canvas.height - y;
                var flipClientY = Math.round(br.top + fy * scaleY);
                canvas.dispatchEvent(new PointerEvent("pointerdown", {
                    bubbles: true,
                    cancelable: true,
                    pointerType: "mouse",
                    isPrimary: true,
                    clientX: clientX,
                    clientY: flipClientY,
                    buttons: 1
                }));
                canvas.dispatchEvent(new PointerEvent("pointerup", {
                    bubbles: true,
                    cancelable: true,
                    pointerType: "mouse",
                    isPrimary: true,
                    clientX: clientX,
                    clientY: flipClientY
                }));
            } catch (_) { }
        }

        return true;
    }

    function makeTouch(x, y) {
        var touch = null;
        try {
            if (cc0.Touch) touch = new cc0.Touch(x, y, 0);
        } catch (_) { }
        if (!touch) {
            touch = {
                getLocation: function () { return { x: x, y: y }; },
                getID: function () { return 0; }
            };
        }

        var ev = null;
        try {
            if (cc0.Event && cc0.Event.EventTouch) ev = new cc0.Event.EventTouch([touch], true);
        } catch (_) { }
        if (!ev) {
            ev = {
                getTouches: function () { return [touch]; },
                getTouch: function () { return touch; }
            };
        }
        ev.touch = touch;
        return { touch: touch, event: ev };
    }

    function emitTouchAtRect(node, rect) {
        if (!node || !rect) return false;
        var c = centerOfRect(rect);
        var te = makeTouch(c.x, c.y);
        te.event.currentTarget = node;
        te.event.target = node;
        try { node.emit(cc0.Node.EventType.TOUCH_START, te.event); } catch (_) { }
        try { node.emit("touchstart", te.event); } catch (_) { }
        try { node.emit(cc0.Node.EventType.TOUCH_END, te.event); } catch (_) { }
        try { node.emit("touchend", te.event); } catch (_) { }
        if (node._touchListener && node._touchListener.onTouchBegan) {
            try { node._touchListener.onTouchBegan(te.touch, te.event); } catch (_) { }
            if (node._touchListener.onTouchEnded) {
                try { node._touchListener.onTouchEnded(te.touch, te.event); } catch (_) { }
            }
        }
        return true;
    }

    function emitTouchOnNode(node) {
        if (!node) return false;
        var p = nodeWorldPos(node);
        var ok = false;

        try {
            if (cc0.Touch && cc0.Event && cc0.Event.EventTouch && node.emit) {
                var t = new cc0.Touch(p.x || 0, p.y || 0, 0);
                var ev = new cc0.Event.EventTouch([t], true);
                ev.touch = t;
                ev.getLocation = function () {
                    return { x: p.x || 0, y: p.y || 0 };
                };
                var ts = (cc0.Node && cc0.Node.EventType && cc0.Node.EventType.TOUCH_START) ? cc0.Node.EventType.TOUCH_START : "touchstart";
                var te = (cc0.Node && cc0.Node.EventType && cc0.Node.EventType.TOUCH_END) ? cc0.Node.EventType.TOUCH_END : "touchend";
                node.emit(ts, ev);
                node.emit(te, ev);
                ok = true;
            }
        } catch (_) { }

        if (!ok && node.emit) {
            try {
                var ev2 = {
                    getLocation: function () {
                        return { x: p.x || 0, y: p.y || 0 };
                    }
                };
                node.emit("touchstart", ev2);
                node.emit("touchend", ev2);
                ok = true;
            } catch (_) { }
        }

        return ok;
    }

    function emitBtnToggle(node) {
        if (!node) return false;
        var btn = getComp(node, cc0.Button);
        if (btn && btn.interactable !== false) {
            try {
                cc0.Component.EventHandler.emitEvents(btn.clickEvents, new cc0.Event.EventCustom("click", true));
                return true;
            } catch (_) { }
        }
        var tgl = getComp(node, cc0.Toggle);
        if (tgl && tgl.interactable !== false) {
            try {
                tgl.isChecked = true;
                if (tgl._emitToggleEvents) tgl._emitToggleEvents();
                return true;
            } catch (_) { }
        }
        return false;
    }

    function fireNode(node) {
        if (!node) return false;
        var ok = false;
        if (emitBtnToggle(node)) ok = true;
        if (emitTouchOnNode(node)) ok = true;
        var rect = rectFromNode(node);
        if (rect) {
            if (emitTouchAtRect(node, rect)) ok = true;
            var c = centerOfRect(rect);
            if (clickCanvasXY(c.x, c.y, true)) ok = true;
        }
        return ok;
    }

    function fireNodeOnce(node, rect) {
        if (!node) return false;
        if (emitBtnToggle(node)) return true;
        if (rect && emitTouchAtRect(node, rect)) return true;
        if (emitTouchOnNode(node)) return true;
        if (rect) {
            var c = centerOfRect(rect);
            if (clickCanvasXY(c.x, c.y, true)) return true;
        }
        return false;
    }

    function fireNodeNoCoords(node) {
        if (!node) return false;
        if (emitTouchOnNode(node)) return true;
        if (emitBtnToggle(node)) return true;
        return false;
    }

    function firePoint(x, y) {
        return clickCanvasXY(x, y);
    }

    function walkScene(visitor) {
        var scene = cc0.director.getScene();
        (function walk(node) {
            if (!node || !active(node)) return;
            visitor(node);
            var kids = node.children || [];
            for (var i = 0; i < kids.length; i++) walk(kids[i]);
        })(scene);
    }

    function collectBetLabelNodes() {
        var rows = [];
        walkScene(function (node) {
            var path = fullPath(node, 200);
            var pathL = path.toLowerCase();
            if (pathL.indexOf(PATH_BET_TOTAL) === -1) return;
            var text = nodeText(node);
            var rect = rectFromNode(node);
            var center = rect ? centerOfRect(rect) : toScreenPt(node, nodeWorldPos(node));
            rows.push({
                node: node,
                path: path,
                text: text,
                value: parseAmount(text),
                rect: rect,
                center: center
            });
        });
        rows.sort(function (a, b) {
            return a.center.y - b.center.y || a.center.x - b.center.x;
        });
        return rows;
    }

    function collectChipLabels() {
        var rows = [];
        walkScene(function (node) {
            var path = fullPath(node, 200);
            var pathL = path.toLowerCase();
            if (pathL.indexOf(PATH_CHIP_LABEL) === -1) return;
            var text = nodeText(node);
            var value = parseAmount(text);
            if (!value) return;
            var rect = rectFromNode(node);
            var center = rect ? centerOfRect(rect) : toScreenPt(node, nodeWorldPos(node));
            rows.push({
                node: node,
                path: path,
                text: text,
                value: value,
                rect: rect,
                center: center,
                clickable: clickableAncestor(node, 8)
            });
        });
        rows.sort(function (a, b) {
            return a.center.x - b.center.x || a.center.y - b.center.y;
        });
        return rows;
    }

    function collectChipNodes() {
        var rows = [];
        walkScene(function (node) {
            var path = fullPath(node, 200);
            if (!RE_CHIP_NODE.test(path)) return;
            var rect = rectFromNode(node);
            var center = rect ? centerOfRect(rect) : toScreenPt(node, nodeWorldPos(node));
            rows.push({
                node: node,
                path: path,
                rect: rect,
                center: center
            });
        });
        rows.sort(function (a, b) {
            return a.center.x - b.center.x || a.center.y - b.center.y;
        });
        return rows;
    }

    function collectChipLights() {
        var rows = [];
        walkScene(function (node) {
            var path = fullPath(node, 200);
            var pathL = path.toLowerCase();
            var nameL = String(node.name || "").toLowerCase();
            if (pathL.indexOf(PATH_CHIP_PANEL) === -1) return;
            if (!(/chip.*light|light.*chip/.test(nameL) || /chip.*light|light.*chip/.test(pathL))) return;
            var rect = rectFromNode(node);
            var center = rect ? centerOfRect(rect) : toScreenPt(node, nodeWorldPos(node));
            rows.push({
                node: node,
                path: path,
                rect: rect,
                center: center,
                active: active(node)
            });
        });
        return rows;
    }

    function splitTwoRows(items) {
        var arr = (items || []).slice().sort(function (a, b) {
            return a.center.y - b.center.y || a.center.x - b.center.x;
        });
        if (arr.length !== 4) {
            throw new Error("Expected 4 bet labels, got " + arr.length);
        }
        var top = arr.slice(0, 2).sort(function (a, b) { return a.center.x - b.center.x; });
        var bottom = arr.slice(2, 4).sort(function (a, b) { return a.center.x - b.center.x; });
        return { top: top, bottom: bottom };
    }

    function unionRect(items) {
        var left = null, top = null, right = null, bottom = null;
        for (var i = 0; i < items.length; i++) {
            var r = items[i] && items[i].rect;
            if (!r) continue;
            if (left == null || r.sx < left) left = r.sx;
            if (top == null || r.sy < top) top = r.sy;
            if (right == null || (r.sx + r.sw) > right) right = r.sx + r.sw;
            if (bottom == null || (r.sy + r.sh) > bottom) bottom = r.sy + r.sh;
        }
        if (left == null) return null;
        return { sx: left, sy: top, sw: Math.max(1, right - left), sh: Math.max(1, bottom - top) };
    }

    function rectSane(r) {
        return !!(r && isFinite(r.sx) && isFinite(r.sy) && isFinite(r.sw) && isFinite(r.sh) && r.sw > 1 && r.sh > 1);
    }

    function rectCenter(r) {
        if (!rectSane(r)) return { x: 0, y: 0 };
        return {
            x: r.sx + r.sw / 2,
            y: r.sy + r.sh / 2
        };
    }

    function rectContainsPoint(r, x, y) {
        if (!rectSane(r)) return false;
        return x >= r.sx && x <= (r.sx + r.sw) && y >= r.sy && y <= (r.sy + r.sh);
    }

    function insetRect(rect, dx, dy) {
        if (!rectSane(rect)) return null;
        return {
            sx: rect.sx + dx,
            sy: rect.sy + dy,
            sw: Math.max(1, rect.sw - dx * 2),
            sh: Math.max(1, rect.sh - dy * 2)
        };
    }

    function ancestorChain(node) {
        var arr = [];
        var cur = node;
        var i = 0;
        while (cur && i++ < 80) {
            arr.push(cur);
            cur = cur.parent || cur._parent || null;
        }
        return arr;
    }

    function deepestCommonAncestor(nodes) {
        var list = (nodes || []).filter(Boolean);
        if (!list.length) return null;
        var chains = list.map(ancestorChain);
        var base = chains[0];
        for (var i = 0; i < base.length; i++) {
            var cand = base[i];
            var ok = true;
            for (var j = 1; j < chains.length; j++) {
                if (chains[j].indexOf(cand) === -1) {
                    ok = false;
                    break;
                }
            }
            if (ok) return cand;
        }
        return null;
    }

    function findBetZoneNodeBySide(side) {
        var sideKey = normalizeSide(side);
        var token = String(BET_ZONE_PATHS[sideKey] || "").toLowerCase();
        if (!token) return null;
        var best = null;
        var bestArea = -1;
        walkScene(function (node) {
            if (!node || !active(node)) return;
            var pathL = String(fullPath(node, 200) || "").toLowerCase();
            if (pathL.indexOf(token) === -1) return;
            var rect = rectFromNode(node);
            var area = rectSane(rect) ? (rect.sw * rect.sh) : 0;
            if (area > bestArea) {
                best = node;
                bestArea = area;
            }
        });
        return best;
    }

    function findBoardBackFromLabel(labelNode) {
        var cur = labelNode || null;
        var best = null;
        var bestArea = -1;
        var depth = 0;
        while (cur && depth <= 10) {
            var nameL = String(cur.name || "").toLowerCase();
            var pathL = String(fullPath(cur, 160) || "").toLowerCase();
            var rect = rectFromNode(cur);
            var area = rectSane(rect) ? (rect.sw * rect.sh) : 0;
            if ((nameL === "board_back" || /\/board_back(?:\/|$)/.test(pathL)) && area > bestArea) {
                best = cur;
                bestArea = area;
            }
            cur = cur.parent || cur._parent || null;
            depth++;
        }
        return best;
    }

    function findBoardRectFromLabels(labels) {
        var boardNode = null;
        var boardRect = null;
        var union = null;
        for (var i = 0; i < labels.length; i++) {
            var it = labels[i];
            if (!it || !it.node) continue;
            var bn = findBoardBackFromLabel(it.node);
            var br = bn ? rectFromNode(bn) : null;
            if (rectSane(br) && (!boardRect || (br.sw * br.sh) > (boardRect.sw * boardRect.sh))) {
                boardNode = bn;
                boardRect = br;
            }
            if (rectSane(it.rect)) {
                union = unionRect([{ rect: union }, { rect: it.rect }]);
            }
        }
        if (!rectSane(boardRect) && rectSane(union)) {
            boardRect = {
                sx: union.sx - union.sw * 0.75,
                sy: union.sy - union.sh * 1.25,
                sw: union.sw * 2.50,
                sh: union.sh * 2.70
            };
        }
        if (rectSane(boardRect) && rectSane(union)) {
            var c1 = rectCenter(union);
            if (!rectContainsPoint(boardRect, c1.x, c1.y)) {
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

    function buildBetMap() {
        var labels = collectBetLabelNodes();
        var rows = splitTwoRows(labels);
        var top = rows.top;
        var bottom = rows.bottom;
        var boardInfo = findBoardRectFromLabels(labels);
        var union = boardInfo.union || unionRect(labels);
        var boardNode = boardInfo.node || deepestCommonAncestor(labels.map(function (x) { return x.node; }));
        var board = boardInfo.rect || rectFromNode(boardNode);
        var midX = (top[0].center.x + top[1].center.x + bottom[0].center.x + bottom[1].center.x) / 4;
        var midY = (top[0].center.y + top[1].center.y + bottom[0].center.y + bottom[1].center.y) / 4;

        function makeTarget(item, side) {
            var point = { x: item.center.x, y: item.center.y };
            var rawRect = null;
            var touchRect = item.rect;
            var zoneNode = findBetZoneNodeBySide(side);
            var zoneRect = zoneNode ? rectFromNode(zoneNode) : null;
            if (board) {
                var isLeft = item.center.x < midX;
                var isTop = item.center.y < midY;
                var x1 = isLeft ? board.sx : midX;
                var x2 = isLeft ? midX : (board.sx + board.sw);
                var y1 = isTop ? board.sy : midY;
                var y2 = isTop ? midY : (board.sy + board.sh);
                rawRect = {
                    sx: Math.min(x1, x2),
                    sy: Math.min(y1, y2),
                    sw: Math.abs(x2 - x1),
                    sh: Math.abs(y2 - y1)
                };
                var insetX = Math.max(10, Math.min(rawRect.sw * 0.18, 42));
                var insetY = Math.max(10, Math.min(rawRect.sh * 0.22, 42));
                touchRect = insetRect(rawRect, insetX, insetY) || rawRect;
                point = centerOfRect(touchRect);
            }
            if (rectSane(zoneRect)) {
                touchRect = zoneRect;
                point = centerOfRect(zoneRect);
            }
            return {
                side: side,
                node: item.node,
                touchNode: zoneNode || boardNode || item.node,
                zoneNode: zoneNode,
                zoneRect: zoneRect,
                path: item.path,
                text: item.text,
                value: item.value,
                rect: item.rect,
                center: item.center,
                point: point,
                rawRect: rawRect,
                touchRect: touchRect,
                clickable: clickableAncestor(item.node, 8),
                board: board,
                boardUnion: union,
                midX: midX,
                midY: midY
            };
        }

        return {
            LE: makeTarget(top[0], "LE"),
            CHAN: makeTarget(top[1], "CHAN"),
            XIU: makeTarget(bottom[0], "XIU"),
            TAI: makeTarget(bottom[1], "TAI")
        };
    }

    function uniquePoints(points) {
        var out = [];
        var seen = {};
        for (var i = 0; i < (points || []).length; i++) {
            var p = points[i];
            if (!p) continue;
            var x = Math.round(p.x);
            var y = Math.round(p.y);
            var k = x + ":" + y;
            if (seen[k]) continue;
            seen[k] = 1;
            out.push({
                x: x,
                y: y,
                tag: p.tag || ""
            });
        }
        return out;
    }

    function pointsFromRect(rect, prefix) {
        if (!rect) return [];
        var sx = rect.sx;
        var sy = rect.sy;
        var ex = rect.sx + rect.sw;
        var ey = rect.sy + rect.sh;
        var mx = sx + rect.sw / 2;
        var my = sy + rect.sh / 2;
        var dx = Math.max(12, rect.sw * 0.18);
        var dy = Math.max(12, rect.sh * 0.18);
        return [
            { x: mx, y: my, tag: prefix + ".center" },
            { x: clamp(mx - dx, sx + 6, ex - 6), y: my, tag: prefix + ".mid_left" },
            { x: clamp(mx + dx, sx + 6, ex - 6), y: my, tag: prefix + ".mid_right" },
            { x: mx, y: clamp(my - dy, sy + 6, ey - 6), tag: prefix + ".mid_top" },
            { x: mx, y: clamp(my + dy, sy + 6, ey - 6), tag: prefix + ".mid_bottom" },
            { x: clamp(mx - dx, sx + 6, ex - 6), y: clamp(my - dy, sy + 6, ey - 6), tag: prefix + ".top_left" },
            { x: clamp(mx + dx, sx + 6, ex - 6), y: clamp(my - dy, sy + 6, ey - 6), tag: prefix + ".top_right" },
            { x: clamp(mx - dx, sx + 6, ex - 6), y: clamp(my + dy, sy + 6, ey - 6), tag: prefix + ".bottom_left" },
            { x: clamp(mx + dx, sx + 6, ex - 6), y: clamp(my + dy, sy + 6, ey - 6), tag: prefix + ".bottom_right" }
        ];
    }

    function buildTapPoints(item) {
        var pts = [];
        pts = pts.concat(pointsFromRect(item.zoneRect, "zoneRect"));
        pts = pts.concat(pointsFromRect(item.touchRect, "touchRect"));
        pts = pts.concat(pointsFromRect(item.rawRect, "rawRect"));
        if (item.center) pts.push({ x: item.center.x, y: item.center.y, tag: "label.center" });
        if (item.point) pts.push({ x: item.point.x, y: item.point.y, tag: "target.point" });
        return uniquePoints(pts);
    }

    function collectClickableCandidatesInRect(rect) {
        var out = [];
        if (!rectSane(rect)) return out;
        walkScene(function (node) {
            if (!clickable(node)) return;
            var r = rectFromNode(node);
            if (!rectSane(r)) return;
            var c = rectCenter(r);
            if (!rectContainsPoint(rect, c.x, c.y)) return;
            out.push({
                node: node,
                path: fullPath(node, 200),
                rect: r,
                center: c,
                area: r.sw * r.sh
            });
        });
        out.sort(function (a, b) {
            return (b.area || 0) - (a.area || 0);
        });
        return out;
    }

    function ensureDebugOverlayRoot() {
        var id = "__abx_bet_debug_overlay";
        var root = document.getElementById(id);
        if (root) return root;
        root = document.createElement("div");
        root.id = id;
        root.style.cssText = [
            "position:fixed",
            "inset:0",
            "pointer-events:none",
            "z-index:2147483647",
            "font:12px/1.2 monospace"
        ].join(";");
        document.body.appendChild(root);
        return root;
    }

    function clearDebugOverlay() {
        var root = document.getElementById("__abx_bet_debug_overlay");
        if (root) root.innerHTML = "";
    }

    function overlayRect(root, rect, color, label) {
        if (!rectSane(rect)) return;
        var el = document.createElement("div");
        el.style.cssText = [
            "position:absolute",
            "left:" + Math.round(rect.sx) + "px",
            "top:" + Math.round(rect.sy) + "px",
            "width:" + Math.round(rect.sw) + "px",
            "height:" + Math.round(rect.sh) + "px",
            "border:2px solid " + color,
            "box-sizing:border-box",
            "background:rgba(0,0,0,0.02)"
        ].join(";");
        root.appendChild(el);
        if (label) {
            var tag = document.createElement("div");
            tag.textContent = label;
            tag.style.cssText = [
                "position:absolute",
                "left:" + Math.round(rect.sx) + "px",
                "top:" + Math.max(0, Math.round(rect.sy) - 16) + "px",
                "padding:1px 4px",
                "background:" + color,
                "color:#fff"
            ].join(";");
            root.appendChild(tag);
        }
    }

    function overlayPoint(root, pt, color, label) {
        if (!pt) return;
        var dot = document.createElement("div");
        dot.style.cssText = [
            "position:absolute",
            "left:" + (Math.round(pt.x) - 4) + "px",
            "top:" + (Math.round(pt.y) - 4) + "px",
            "width:8px",
            "height:8px",
            "border-radius:50%",
            "background:" + color
        ].join(";");
        root.appendChild(dot);
        if (label) {
            var tag = document.createElement("div");
            tag.textContent = label;
            tag.style.cssText = [
                "position:absolute",
                "left:" + (Math.round(pt.x) + 6) + "px",
                "top:" + (Math.round(pt.y) - 8) + "px",
                "padding:1px 3px",
                "background:rgba(0,0,0,0.75)",
                "color:" + color
            ].join(";");
            root.appendChild(tag);
        }
    }

    function debugSide(side) {
        var sideKey = normalizeSide(side);
        var item = buildBetMap()[sideKey];
        var tapPoints = buildTapPoints(item);
        var clickables = collectClickableCandidatesInRect(item.rawRect || item.board || item.rect);
        var root = ensureDebugOverlayRoot();
        root.innerHTML = "";
        overlayRect(root, item.board, "#00bcd4", sideKey + ".board");
        overlayRect(root, item.boardUnion, "#607d8b", sideKey + ".union");
        overlayRect(root, item.zoneRect, "#ffffff", sideKey + ".zone");
        overlayRect(root, item.rawRect, "#ff9800", sideKey + ".raw");
        overlayRect(root, item.touchRect, "#4caf50", sideKey + ".touch");
        overlayRect(root, item.rect, "#e91e63", sideKey + ".label");
        for (var i = 0; i < tapPoints.length; i++) {
            overlayPoint(root, tapPoints[i], "#ffeb3b", String(i + 1));
        }
        for (var j = 0; j < Math.min(clickables.length, 8); j++) {
            overlayRect(root, clickables[j].rect, "#9c27b0", "clickable#" + (j + 1));
        }
        var out = {
            side: sideKey,
            target: item,
            tapPoints: tapPoints,
            clickables: clickables.slice(0, 12).map(function (x, idx) {
                return {
                    idx: idx + 1,
                    path: x.path,
                    center: { x: Math.round(x.center.x), y: Math.round(x.center.y) },
                    area: Math.round(x.area)
                };
            })
        };
        try {
            console.table(out.clickables);
        } catch (_) { }
        return out;
    }

    function buildChipMap() {
        var labels = collectChipLabels();
        var chips = collectChipNodes();
        if (!labels.length) throw new Error("No chip labels found");
        if (!chips.length) throw new Error("No chip nodes found");

        var out = {};
        for (var i = 0; i < labels.length; i++) {
            var label = labels[i];
            var chip = chips[Math.min(i, chips.length - 1)];
            out[String(label.value)] = {
                amount: label.value,
                text: label.text,
                labelNode: label.node,
                labelPath: label.path,
                labelRect: label.rect,
                labelCenter: label.center,
                chipNode: chip ? chip.node : null,
                chipPath: chip ? chip.path : "",
                chipRect: chip ? chip.rect : null,
                chipCenter: chip ? chip.center : null,
                panelPath: PATH_CHIP_PANEL
            };
        }
        return out;
    }

    function getToggleState(node) {
        var cur = node;
        var depth = 0;
        while (cur && depth++ <= 6) {
            var tgl = getComp(cur, cc0.Toggle);
            if (tgl) {
                return {
                    found: true,
                    checked: !!tgl.isChecked,
                    node: cur,
                    path: fullPath(cur, 200)
                };
            }
            cur = cur.parent || cur._parent || null;
        }
        return {
            found: false,
            checked: false,
            node: null,
            path: ""
        };
    }

    function inspectChip(amount) {
        var chips = buildChipMap();
        var item = chips[String(Math.max(0, Math.floor(+amount || 0)))];
        if (!item) throw new Error("Chip not found for amount " + amount);

        var lightRows = collectChipLights();
        var bestLight = null;
        var bestD = null;
        for (var i = 0; i < lightRows.length; i++) {
            var light = lightRows[i];
            var d = item.chipCenter ? dist2(item.chipCenter.x, item.chipCenter.y, light.center.x, light.center.y) : null;
            if (d != null && (bestD == null || d < bestD)) {
                bestD = d;
                bestLight = light;
            }
        }

        var chipToggle = getToggleState(item.chipNode);
        var labelToggle = getToggleState(item.labelNode);
        var lightTol = item.chipRect ? Math.max(item.chipRect.sw * 1.2, 42) : 42;
        var selectedByLight = !!(bestLight && Math.sqrt(bestD || 0) <= lightTol);

        return {
            amount: item.amount,
            text: item.text,
            chipPath: item.chipPath,
            labelPath: item.labelPath,
            chipCenter: item.chipCenter,
            labelCenter: item.labelCenter,
            chipToggle: chipToggle,
            labelToggle: labelToggle,
            nearestLight: bestLight ? {
                path: bestLight.path,
                center: bestLight.center,
                distance: Math.sqrt(bestD || 0)
            } : null,
            selected: !!(chipToggle.checked || labelToggle.checked || selectedByLight),
            selectedBy: chipToggle.checked ? "chip_toggle"
                : (labelToggle.checked ? "label_toggle"
                    : (selectedByLight ? "chip_light" : "none"))
        };
    }

    function readTotals() {
        var map = buildBetMap();
        return {
            LE: map.LE.value || 0,
            CHAN: map.CHAN.value || 0,
            XIU: map.XIU.value || 0,
            TAI: map.TAI.value || 0
        };
    }

    function snapshot() {
        var bets = buildBetMap();
        var chips = buildChipMap();
        var chipList = Object.keys(chips).map(function (k) {
            return chips[k];
        }).sort(function (a, b) {
            return a.amount - b.amount;
        });
        return {
            bets: bets,
            totals: readTotals(),
            chips: chips,
            chipList: chipList
        };
    }

    function buildPlan(amount, chipsMap) {
        var want = Math.max(0, Math.floor(+amount || 0));
        if (!want) throw new Error("Amount must be > 0");

        var denoms = Object.keys(chipsMap).map(function (k) {
            return parseInt(k, 10);
        }).filter(function (v) {
            return v > 0;
        }).sort(function (a, b) {
            return b - a;
        });

        var rest = want;
        var steps = [];
        for (var i = 0; i < denoms.length; i++) {
            var d = denoms[i];
            var cnt = Math.floor(rest / d);
            for (var j = 0; j < cnt; j++) {
                steps.push(d);
            }
            rest -= cnt * d;
        }

        if (rest !== 0) {
            throw new Error("Cannot build exact plan for " + want + ", remain " + rest);
        }

        return steps;
    }

    async function waitTotalChanged(side, before, timeoutMs) {
        var sideKey = normalizeSide(side);
        var start = Date.now();
        while ((Date.now() - start) < (timeoutMs || TOTAL_WAIT_MS)) {
            var totals = readTotals();
            var now = totals[sideKey] || 0;
            if (now !== before) {
                return {
                    changed: true,
                    before: before,
                    after: now,
                    totals: totals
                };
            }
            await sleep(POLL_MS);
        }
        return {
            changed: false,
            before: before,
            after: before,
            totals: readTotals()
        };
    }

    async function focusChip(amount, opts) {
        opts = opts || {};
        var stepPauseMs = Math.max(0, Math.floor(+opts.stepPauseMs || 0));
        var forceRetap = !!opts.forceRetap;
        var chips = buildChipMap();
        var item = chips[String(Math.max(0, Math.floor(+amount || 0)))];
        if (!item) throw new Error("Chip not found for amount " + amount);

        var attempts = [];

        function addAttempt(name, fn) {
            attempts.push({ name: name, fn: fn });
        }

        addAttempt("chipNode.fireNode", function () {
            return item.chipNode ? fireNode(item.chipNode) : false;
        });
        addAttempt("chipNode.emitBtnToggle", function () {
            return item.chipNode ? emitBtnToggle(item.chipNode) : false;
        });
        addAttempt("chipNode.emitTouchAtRect", function () {
            return item.chipNode && item.chipRect ? emitTouchAtRect(item.chipNode, item.chipRect) : false;
        });
        addAttempt("chipCenter.clickCanvas", function () {
            return item.chipCenter ? clickCanvasXY(item.chipCenter.x, item.chipCenter.y, true) : false;
        });
        addAttempt("labelNode.fireNode", function () {
            return item.labelNode ? fireNode(item.labelNode) : false;
        });
        addAttempt("labelCenter.clickCanvas", function () {
            return item.labelCenter ? clickCanvasXY(item.labelCenter.x, item.labelCenter.y, true) : false;
        });

        var trace = [];
        var before = inspectChip(amount);
        if (before.selected && !forceRetap) {
            return {
                ok: true,
                chip: item,
                selectedBy: before.selectedBy,
                before: before,
                after: before,
                trace: trace
            };
        }

        for (var i = 0; i < attempts.length; i++) {
            var a = attempts[i];
            var fired = false;
            try {
                fired = !!a.fn();
            } catch (e) {
                trace.push({ attempt: a.name, fired: false, error: String(e && e.message || e) });
                continue;
            }
            await sleep(CLICK_DELAY_MS);
            var state = inspectChip(amount);
            trace.push({
                attempt: a.name,
                fired: fired,
                selected: state.selected,
                selectedBy: state.selectedBy
            });
            if (state.selected) {
                if (stepPauseMs > 0) await sleep(stepPauseMs);
                return {
                    ok: true,
                    chip: item,
                    selectedBy: state.selectedBy,
                    before: before,
                    after: state,
                    trace: trace
                };
            }
        }

        var after = inspectChip(amount);
        return {
            ok: false,
            chip: item,
            selectedBy: after.selectedBy,
            before: before,
            after: after,
            trace: trace
        };
    }

    async function focusChipFast(amount, opts) {
        opts = opts || {};
        var afterChipMs = Math.max(0, Math.floor(+opts.afterChipMs || 0));
        var chips = buildChipMap();
        var item = chips[String(Math.max(0, Math.floor(+amount || 0)))];
        if (!item) throw new Error("Chip not found for amount " + amount);

        var fired = false;
        if (item.chipNode) fired = fireNodeNoCoords(item.chipNode);
        if (!fired && item.labelNode) fired = fireNodeNoCoords(item.labelNode);
        if (afterChipMs > 0) await sleep(afterChipMs);
        return {
            ok: !!fired,
            chip: item
        };
    }

    async function tapSide(side, opts) {
        opts = opts || {};
        var stepPauseMs = Math.max(0, Math.floor(+opts.stepPauseMs || 0));
        var sideKey = normalizeSide(side);
        var bets = buildBetMap();
        var item = bets[sideKey];
        if (!item) throw new Error("Bet side not found: " + sideKey);

        var attempts = [];
        function addAttempt(name, fn) {
            attempts.push({ name: name, fn: fn });
        }

        addAttempt("zoneNode.fireNode", function () {
            return item.zoneNode ? fireNode(item.zoneNode) : false;
        });
        addAttempt("zoneRect.emitTouchAtRect", function () {
            return item.touchNode && item.zoneRect ? emitTouchAtRect(item.touchNode, item.zoneRect) : false;
        });
        addAttempt("zoneRect.clickCanvas", function () {
            return item.zoneRect ? clickCanvasXY(centerOfRect(item.zoneRect).x, centerOfRect(item.zoneRect).y, true) : false;
        });
        addAttempt("touchRect.emitTouchAtRect", function () {
            return item.touchNode && item.touchRect ? emitTouchAtRect(item.touchNode, item.touchRect) : false;
        });
        addAttempt("touchRect.clickCanvas", function () {
            return item.point ? clickCanvasXY(item.point.x, item.point.y, true) : false;
        });
        addAttempt("clickable.fireNode", function () {
            return item.clickable ? fireNode(item.clickable) : false;
        });
        addAttempt("labelNode.fireNode", function () {
            return item.node ? fireNode(item.node) : false;
        });
        addAttempt("labelCenter.clickCanvas", function () {
            return item.center ? clickCanvasXY(item.center.x, item.center.y, true) : false;
        });
        var tapPoints = buildTapPoints(item);
        for (var p = 0; p < tapPoints.length; p++) {
            (function (pt) {
                addAttempt("point." + pt.tag, function () {
                    return clickCanvasXY(pt.x, pt.y, true);
                });
            })(tapPoints[p]);
        }

        var trace = [];
        var fired = false;
        for (var i = 0; i < attempts.length; i++) {
            var a = attempts[i];
            var ok = false;
            try {
                ok = !!a.fn();
            } catch (e) {
                trace.push({ attempt: a.name, fired: false, error: String(e && e.message || e) });
                continue;
            }
            trace.push({ attempt: a.name, fired: ok });
            if (ok) {
                fired = true;
                break;
            }
        }

        await sleep(CLICK_DELAY_MS);
        if (stepPauseMs > 0) await sleep(stepPauseMs);
        return {
            ok: !!fired,
            target: item,
            trace: trace,
            tapPoints: tapPoints
        };
    }

    async function tapSideFast(side, opts) {
        opts = opts || {};
        var afterTapMs = Math.max(0, Math.floor(+opts.afterTapMs || 0));
        var sideKey = normalizeSide(side);
        var bets = buildBetMap();
        var item = bets[sideKey];
        if (!item) throw new Error("Bet side not found: " + sideKey);

        var fired = false;
        if (item.zoneNode) fired = fireNodeNoCoords(item.zoneNode);
        if (!fired && item.touchNode) fired = fireNodeNoCoords(item.touchNode);
        if (!fired && item.clickable) fired = fireNodeNoCoords(item.clickable);
        if (!fired && item.node) fired = fireNodeNoCoords(item.node);
        if (afterTapMs > 0) await sleep(afterTapMs);
        return {
            ok: !!fired,
            target: item
        };
    }

    async function tryBetTapUntilChanged(side, before, timeoutMs) {
        var sideKey = normalizeSide(side);
        var bets = buildBetMap();
        var item = bets[sideKey];
        if (!item) throw new Error("Bet side not found: " + sideKey);

        var tapPoints = buildTapPoints(item);
        var trace = [];

        function pushResult(name, fired, waitRes) {
            trace.push({
                attempt: name,
                fired: !!fired,
                changed: !!(waitRes && waitRes.changed),
                before: waitRes ? waitRes.before : before,
                after: waitRes ? waitRes.after : before
            });
        }

        var directAttempts = [
            {
                name: "zoneNode.fireNode",
                fn: function () { return item.zoneNode ? fireNode(item.zoneNode) : false; }
            },
            {
                name: "zoneRect.emitTouchAtRect",
                fn: function () { return item.touchNode && item.zoneRect ? emitTouchAtRect(item.touchNode, item.zoneRect) : false; }
            },
            {
                name: "touchRect.emitTouchAtRect",
                fn: function () { return item.touchNode && item.touchRect ? emitTouchAtRect(item.touchNode, item.touchRect) : false; }
            },
            {
                name: "clickable.fireNode",
                fn: function () { return item.clickable ? fireNode(item.clickable) : false; }
            },
            {
                name: "labelNode.fireNode",
                fn: function () { return item.node ? fireNode(item.node) : false; }
            }
        ];

        for (var i = 0; i < directAttempts.length; i++) {
            var a = directAttempts[i];
            var fired = false;
            try {
                fired = !!a.fn();
            } catch (e) {
                trace.push({ attempt: a.name, fired: false, error: String(e && e.message || e) });
                continue;
            }
            await sleep(CLICK_DELAY_MS);
            var waitRes = await waitTotalChanged(sideKey, before, Math.min(timeoutMs || TOTAL_WAIT_MS, 320));
            pushResult(a.name, fired, waitRes);
            if (waitRes.changed) {
                return {
                    ok: true,
                    result: waitRes,
                    trace: trace,
                    target: item,
                    tapPoints: tapPoints
                };
            }
        }

        for (var j = 0; j < tapPoints.length; j++) {
            var pt = tapPoints[j];
            var fired2 = false;
            try {
                fired2 = clickCanvasXY(pt.x, pt.y, true);
            } catch (e2) {
                trace.push({ attempt: "point." + pt.tag, fired: false, error: String(e2 && e2.message || e2) });
                continue;
            }
            await sleep(CLICK_DELAY_MS);
            var waitRes2 = await waitTotalChanged(sideKey, before, Math.min(timeoutMs || TOTAL_WAIT_MS, 320));
            pushResult("point." + pt.tag, fired2, waitRes2);
            if (waitRes2.changed) {
                return {
                    ok: true,
                    result: waitRes2,
                    trace: trace,
                    target: item,
                    tapPoints: tapPoints
                };
            }
        }

        return {
            ok: false,
            result: await waitTotalChanged(sideKey, before, 80),
            trace: trace,
            target: item,
            tapPoints: tapPoints
        };
    }

    async function bet(side, amount, opts) {
        opts = opts || {};
        var sideKey = normalizeSide(side);
        var snap = snapshot();
        var plan = buildPlan(amount, snap.chips);
        var before = snap.totals[sideKey] || 0;
        var history = [];
        var timeoutMs = opts.timeoutMs ? opts.timeoutMs : TOTAL_WAIT_MS;
        var forceChipClick = !!opts.forceChipClick;
        var stepPauseMs = Math.max(0, Math.floor(+opts.stepPauseMs || 0));
        var singleTapMode = !!opts.singleTapMode;

        console.log("[abxStandaloneBetTest] start", {
            side: sideKey,
            amount: amount,
            before: before,
            plan: plan.map(formatAmount)
        });

        for (var i = 0; i < plan.length; i++) {
            var denom = plan[i];
            var chipRes = await focusChip(denom, {
                forceRetap: forceChipClick,
                stepPauseMs: stepPauseMs
            });
            if (!chipRes.ok) {
                throw new Error("Cannot focus chip " + denom);
            }
            if (stepPauseMs > 0) await sleep(stepPauseMs);
            var tapRes;
            if (singleTapMode) {
                var single = await tapSide(sideKey, {
                    stepPauseMs: stepPauseMs
                });
                var singleWait = await waitTotalChanged(sideKey, before, timeoutMs);
                tapRes = {
                    ok: !!(single && single.ok && singleWait && singleWait.changed),
                    result: singleWait,
                    trace: (single && single.trace) ? single.trace : [],
                    target: single ? single.target : null,
                    tapPoints: single ? single.tapPoints : []
                };
            } else {
                tapRes = await tryBetTapUntilChanged(sideKey, before, timeoutMs);
            }
            if (!tapRes.ok || !tapRes.result || !tapRes.result.changed) {
                console.warn("[abxStandaloneBetTest] tap trace", tapRes);
                throw new Error("Total did not change after chip " + denom + " on side " + sideKey);
            }
            var waitRes = tapRes.result;
            history.push({
                step: i + 1,
                chip: denom,
                before: before,
                after: waitRes.after,
                changed: waitRes.changed,
                trace: tapRes.trace
            });

            before = waitRes.after;
        }

        var finalTotals = readTotals();
        var result = {
            ok: true,
            side: sideKey,
            amount: amount,
            plan: plan,
            steps: history,
            totals: finalTotals
        };

        console.log("[abxStandaloneBetTest] done", result);
        return result;
    }

    async function betFast(side, amount, opts) {
        opts = opts || {};
        var sideKey = normalizeSide(side);
        var snap = snapshot();
        var plan = buildPlan(amount, snap.chips);
        var afterChipMs = Math.max(0, Math.floor(+opts.afterChipMs || 0));
        var afterTapMs = Math.max(0, Math.floor(+opts.afterTapMs || 0));
        var stepPauseMs = Math.max(0, Math.floor(+opts.stepPauseMs || 0));

        console.log("[abxStandaloneBetTest] fast-start", {
            side: sideKey,
            amount: amount,
            plan: plan.map(formatAmount)
        });

        var steps = [];
        for (var i = 0; i < plan.length; i++) {
            var denom = plan[i];
            var chipRes = await focusChipFast(denom, {
                afterChipMs: afterChipMs
            });
            if (!chipRes.ok) {
                throw new Error("Cannot click chip " + denom);
            }
            if (stepPauseMs > 0) await sleep(stepPauseMs);
            var tapRes = await tapSideFast(sideKey, {
                afterTapMs: afterTapMs
            });
            if (!tapRes.ok) {
                throw new Error("Cannot click side " + sideKey);
            }
            if (stepPauseMs > 0) await sleep(stepPauseMs);
            steps.push({
                step: i + 1,
                chip: denom
            });
        }

        var result = {
            ok: true,
            side: sideKey,
            amount: amount,
            plan: plan,
            steps: steps
        };
        console.log("[abxStandaloneBetTest] fast-done", result);
        return result;
    }

    async function betVisible(side, amount, opts) {
        opts = opts || {};
        return betFast(side, amount, {
            stepPauseMs: opts.stepPauseMs || 700,
            afterChipMs: opts.afterChipMs || 0,
            afterTapMs: opts.afterTapMs || 0
        });
    }

    function dump() {
        var snap = snapshot();
        try {
            console.table(Object.keys(snap.bets).map(function (k) {
                var it = snap.bets[k];
                return {
                    side: k,
                    text: it.text,
                    value: it.value,
                    x: Math.round(it.center.x),
                    y: Math.round(it.center.y),
                    path: it.path
                };
            }));
        } catch (_) { }

        try {
            console.table(snap.chipList.map(function (it) {
                return {
                    amount: it.amount,
                    text: it.text,
                    chipPath: it.chipPath,
                    labelPath: it.labelPath
                };
            }));
        } catch (_) { }

        return snap;
    }

    var api = {
        scan: snapshot,
        dump: dump,
        inspectChip: inspectChip,
        readTotals: readTotals,
        focusChip: focusChip,
        focusChipFast: focusChipFast,
        tap: tapSide,
        tapFast: tapSideFast,
        tryBetTapUntilChanged: tryBetTapUntilChanged,
        debugSide: debugSide,
        clearDebugOverlay: clearDebugOverlay,
        betFast: betFast,
        betVisible: betVisible,
        bet: bet
    };

    window.abxStandaloneBetTest = api;
    window.abxStandaloneBetTestVersion = "reloadable-v5";
    console.log("[abxStandaloneBetTest] ready", window.abxStandaloneBetTestVersion);
    console.log("Usage:");
    console.log("  abxStandaloneBetTest.dump()");
    console.log("  await abxStandaloneBetTest.focusChip(1000)");
    console.log("  abxStandaloneBetTest.debugSide('tai')");
    console.log("  await abxStandaloneBetTest.tap('tai')");
    console.log("  await abxStandaloneBetTest.betFast('tai', 1000)");
    console.log("  await abxStandaloneBetTest.betVisible('tai', 1000)");
    console.log("  await abxStandaloneBetTest.bet('tai', 1000)");
    return api;
})();
