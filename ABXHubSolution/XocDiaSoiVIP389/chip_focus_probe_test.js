(function () {
    'use strict';

    var NS = '__CW_CHIP_PROBE__';
    var __idSeed = 1;
    var PANEL_TAIL = 'dual/Canvas/node_dual/root/node_game(need_to_put_games_in_here)/prefab_game_14/root/node_in_fullmode/HUD/bet_panel/chips/chip_panel/chip_mask/panel';
    var CHIP_TAILS = {
        '500000000': PANEL_TAIL + '/lbl_chip_value7',
        '100000000': PANEL_TAIL + '/lbl_chip_value6',
        '50000000': PANEL_TAIL + '/lbl_chip_value10',
        '20000000': PANEL_TAIL + '/lbl_chip_value9',
        '10000000': PANEL_TAIL + '/lbl_chip_value8',
        '5000000': PANEL_TAIL + '/lbl_chip_value7',
        '1000000': PANEL_TAIL + '/lbl_chip_value6',
        '500000': PANEL_TAIL + '/lbl_chip_value5',
        '100000': PANEL_TAIL + '/lbl_chip_value4',
        '50000': PANEL_TAIL + '/lbl_chip_value3',
        '10000': PANEL_TAIL + '/lbl_chip_value2',
        '5000': PANEL_TAIL + '/lbl_chip_value1',
        '1000': PANEL_TAIL + '/lbl_chip_value0'
    };

    function sleep(ms) {
        return new Promise(function (resolve) {
            setTimeout(resolve, ms || 0);
        });
    }

    function getScene() {
        try {
            if (window.cc && cc.director && cc.director.getScene) {
                return cc.director.getScene();
            }
        } catch (_) {}
        return null;
    }

    function active(n) {
        try {
            if (!n) {
                return false;
            }
            if (typeof window.active === 'function') {
                return !!window.active(n);
            }
            if (n.activeInHierarchy === false) {
                return false;
            }
            if (n.active === false) {
                return false;
            }
            return true;
        } catch (_) {
            return false;
        }
    }

    function walk(root, fn) {
        if (!root || typeof fn !== 'function') {
            return;
        }
        var stack = [root];
        var seen = [];
        while (stack.length) {
            var n = stack.pop();
            if (!n || seen.indexOf(n) !== -1) {
                continue;
            }
            seen.push(n);
            fn(n);
            var kids = n.children || n._children || [];
            for (var i = kids.length - 1; i >= 0; i--) {
                if (kids[i]) {
                    stack.push(kids[i]);
                }
            }
        }
    }

    function getCompByCtor(n, ctor) {
        try {
            if (typeof window.getComp === 'function') {
                return window.getComp(n, ctor);
            }
        } catch (_) {}
        try {
            if (!n || !ctor) {
                return null;
            }
            var comps = n._components || [];
            for (var i = 0; i < comps.length; i++) {
                if (comps[i] instanceof ctor) {
                    return comps[i];
                }
            }
        } catch (_) {}
        return null;
    }

    function hasCompName(n, name) {
        try {
            var comps = n && n._components ? n._components : [];
            for (var i = 0; i < comps.length; i++) {
                var c = comps[i];
                var cn = (c && (c.__classname__ || c.name || (c.constructor && c.constructor.name))) || '';
                if (String(cn) === String(name)) {
                    return true;
                }
            }
        } catch (_) {}
        return false;
    }

    function safePath(n) {
        try {
            if (typeof window.fullPath === 'function') {
                return String(window.fullPath(n, 200) || '');
            }
        } catch (_) {}
        try {
            var names = [];
            var cur = n;
            var depth = 0;
            while (cur && depth < 200) {
                names.push(String(cur.name || ''));
                cur = cur.parent || cur._parent || null;
                depth++;
            }
            names.reverse();
            return names.join('/');
        } catch (_) {
            return '';
        }
    }

    function shortPath(n) {
        var p = safePath(n);
        if (!p && typeof n === 'string') {
            p = n;
        }
        if (!p) {
            return '';
        }
        var a = p.split('/');
        if (a.length <= 6) {
            return p;
        }
        return a.slice(a.length - 6).join('/');
    }

    function nodeId(n) {
        if (!n) {
            return 0;
        }
        try {
            if (!n.__cwProbeId) {
                n.__cwProbeId = __idSeed++;
            }
            return n.__cwProbeId;
        } catch (_) {
            return 0;
        }
    }

    function tailMatch(full, tail) {
        var f = String(full || '').toLowerCase();
        var t = String(tail || '').toLowerCase();
        if (!f || !t) {
            return false;
        }
        return f === t || f.indexOf(t, Math.max(0, f.length - t.length)) !== -1;
    }

    function findNodeByTailLocal(tail) {
        try {
            if (typeof window.findNodeByTail === 'function') {
                return window.findNodeByTail(tail);
            }
        } catch (_) {}
        var scene = getScene();
        if (!scene) {
            return null;
        }
        var hit = null;
        walk(scene, function (n) {
            if (hit || !active(n)) {
                return;
            }
            if (tailMatch(safePath(n), tail)) {
                hit = n;
            }
        });
        return hit;
    }

    function findPanelNode() {
        return findNodeByTailLocal(PANEL_TAIL);
    }

    function nodeWorldPos(n) {
        try {
            if (n && n.getWorldPosition) {
                return n.getWorldPosition();
            }
        } catch (_) {}
        try {
            if (n && n.convertToWorldSpaceAR && window.cc && cc.v2) {
                return n.convertToWorldSpaceAR(cc.v2(0, 0));
            }
        } catch (_) {}
        try {
            if (n && n.convertToWorldSpaceAR) {
                return n.convertToWorldSpaceAR({
                    x: 0,
                    y: 0
                });
            }
        } catch (_) {}
        return {
            x: 0,
            y: 0
        };
    }

    function dist2(ax, ay, bx, by) {
        var dx = (ax || 0) - (bx || 0);
        var dy = (ay || 0) - (by || 0);
        return dx * dx + dy * dy;
    }

    function NORM(s) {
        try {
            return String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036F]/g, '').toUpperCase();
        } catch (_) {
            return String(s == null ? '' : s).toUpperCase();
        }
    }

    function parseAmountLooseLocal(txt) {
        if (!txt) {
            return null;
        }
        var s = NORM(txt);
        var m = s.match(/(\d+)\s*(K|M)\b/);
        if (m) {
            var v = +m[1];
            v *= (m[2] === 'K' ? 1e3 : 1e6);
            return v > 0 ? v : null;
        }
        m = s.match(/(\d{1,3}(?:[.,\s]\d{3})+|\d{4,12})/);
        if (m) {
            var v2 = parseInt(String(m[1] || '').replace(/[^\d]/g, ''), 10);
            return v2 > 0 ? v2 : null;
        }
        return null;
    }

    function getRect(n) {
        try {
            if (typeof window.rectFromNodeScreen === 'function') {
                var r0 = window.rectFromNodeScreen(n);
                if (r0) {
                    return {
                        x: Number(r0.x || 0),
                        y: Number(r0.y || 0),
                        w: Math.max(1, Number(r0.w || 0)),
                        h: Math.max(1, Number(r0.h || 0))
                    };
                }
            }
        } catch (_) {}
        try {
            if (typeof window.wRect === 'function') {
                var r1 = window.wRect(n);
                if (r1) {
                    return {
                        x: Number(r1.sx != null ? r1.sx : r1.x || 0),
                        y: Number(r1.sy != null ? r1.sy : r1.y || 0),
                        w: Math.max(1, Number(r1.sw != null ? r1.sw : r1.w || 0)),
                        h: Math.max(1, Number(r1.sh != null ? r1.sh : r1.h || 0))
                    };
                }
            }
        } catch (_) {}
        var p = nodeWorldPos(n);
        return {
            x: Number(p.x || 0),
            y: Number(p.y || 0),
            w: 1,
            h: 1
        };
    }

    function clickable(n) {
        try {
            if (typeof window.clickable === 'function') {
                return !!window.clickable(n);
            }
        } catch (_) {}
        if (!n) {
            return false;
        }
        try {
            if (window.cc && cc.Button && getCompByCtor(n, cc.Button)) {
                return true;
            }
        } catch (_) {}
        try {
            if (window.cc && cc.Toggle && getCompByCtor(n, cc.Toggle)) {
                return true;
            }
        } catch (_) {}
        try {
            if (n._touchListener || n._clickEvents) {
                return true;
            }
        } catch (_) {}
        try {
            if (hasCompName(n, 'ChipItem')) {
                return true;
            }
        } catch (_) {}
        return false;
    }

    function clickableOfLocal(node, depth) {
        try {
            if (typeof window.clickableOf === 'function') {
                return window.clickableOf(node, depth);
            }
        } catch (_) {}
        var cur = node;
        var d = 0;
        var lim = depth == null ? 8 : depth;
        while (cur && d <= lim) {
            if (clickable(cur)) {
                return cur;
            }
            cur = cur.parent || cur._parent || null;
            d++;
        }
        return node || null;
    }

    function findChipNodeFromLabelCurrent(labelNode) {
        if (!labelNode) {
            return null;
        }
        var p = labelNode.parent || labelNode._parent || null;
        if (!p || !(p.children || p._children)) {
            return null;
        }
        var kids = p.children || p._children || [];
        var nm = String(labelNode.name || '');
        var m = nm.match(/lbl_chip_value(\d+)/i);
        if (m) {
            var idx = parseInt(m[1], 10);
            var direct = 'chip' + idx;
            for (var i = 0; i < kids.length; i++) {
                if (kids[i] && String(kids[i].name || '') === direct) {
                    return kids[i];
                }
            }
        }
        var lp = nodeWorldPos(labelNode);
        var best = null;
        var bestD = null;
        for (var j = 0; j < kids.length; j++) {
            var k = kids[j];
            if (!k) {
                continue;
            }
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

    function scoreChipScope(root) {
        if (!root) {
            return -1;
        }
        var labelCount = 0;
        var chipCount = 0;
        var amountCount = 0;
        walk(root, function (n) {
            if (!active(n)) {
                return;
            }
            var name = String(n.name || '');
            if (/^lbl_chip_value\d+$/i.test(name)) {
                labelCount++;
            }
            if (/^chip\d+$/i.test(name) || hasCompName(n, 'ChipItem')) {
                chipCount++;
            }
            var texts = [];
            var lb = window.cc && cc.Label ? getCompByCtor(n, cc.Label) : null;
            var rt = window.cc && cc.RichText ? getCompByCtor(n, cc.RichText) : null;
            if (lb && typeof lb.string !== 'undefined') {
                texts.push(lb.string);
            }
            if (rt && typeof rt.string !== 'undefined') {
                texts.push(rt.string);
            }
            texts.push(name);
            for (var i = 0; i < texts.length; i++) {
                if (parseAmountLooseLocal(texts[i])) {
                    amountCount++;
                    break;
                }
            }
        });
        var path = safePath(root).toLowerCase();
        var score = labelCount * 20 + chipCount * 15 + amountCount * 4;
        if (/chip_panel|bet_panel|chips|coin|phinh|menh/.test(path)) {
            score += 30;
        }
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

    function buildInventoryFromRoot(panel) {
        var out = {
            panel: panel,
            labels: [],
            chips: [],
            labelsByIndex: {},
            chipsByIndex: {}
        };
        if (!panel) {
            return out;
        }
        walk(panel, function (n) {
            if (!active(n)) {
                return;
            }
            var name = String(n.name || '');
            var mLabel = name.match(/^lbl_chip_value(\d+)$/i);
            if (mLabel) {
                var idxLabel = parseInt(mLabel[1], 10);
                out.labels.push(n);
                out.labelsByIndex[String(idxLabel)] = n;
                return;
            }
            var mChip = name.match(/^chip(\d+)$/i);
            if (mChip) {
                var idxChip = parseInt(mChip[1], 10);
                out.chips.push(n);
                if (!out.chipsByIndex[String(idxChip)]) {
                    out.chipsByIndex[String(idxChip)] = n;
                }
                return;
            }
            if (hasCompName(n, 'ChipItem')) {
                out.chips.push(n);
            }
        });
        return out;
    }

    function discoverVisibleLabels() {
        var scene = getScene();
        var rows = [];
        if (!scene) {
            return rows;
        }
        walk(scene, function (n) {
            if (!active(n)) {
                return;
            }
            var texts = [];
            var lb = window.cc && cc.Label ? getCompByCtor(n, cc.Label) : null;
            var rt = window.cc && cc.RichText ? getCompByCtor(n, cc.RichText) : null;
            if (lb && typeof lb.string !== 'undefined') {
                texts.push(lb.string);
            }
            if (rt && typeof rt.string !== 'undefined') {
                texts.push(rt.string);
            }
            texts.push(String(n.name || ''));
            var amount = null;
            var hitText = '';
            for (var i = 0; i < texts.length; i++) {
                amount = parseAmountLooseLocal(texts[i]);
                if (amount) {
                    hitText = String(texts[i] || '');
                    break;
                }
            }
            if (!amount) {
                return;
            }
            var path = safePath(n).toLowerCase();
            var score = 0;
            if (/chip|coin|phinh|menh|bet_panel|chip_panel/.test(path)) {
                score += 10;
            }
            if (/^lbl_chip_value\d+$/i.test(String(n.name || ''))) {
                score += 20;
            }
            if (clickableOfLocal(n, 6) !== n) {
                score += 2;
            }
            rows.push({
                amount: amount,
                node: n,
                nodeId: nodeId(n),
                text: hitText,
                score: score,
                path: path
            });
        });
        rows.sort(function (a, b) {
            if ((b.score || 0) !== (a.score || 0)) {
                return (b.score || 0) - (a.score || 0);
            }
            return String(a.path || '').localeCompare(String(b.path || ''));
        });
        return rows;
    }

    function findBestVisibleLabelByAmount(amount) {
        var rows = discoverVisibleLabels();
        for (var i = 0; i < rows.length; i++) {
            if (Number(rows[i].amount || 0) === Number(amount || 0)) {
                return rows[i].node;
            }
        }
        return null;
    }

    function getPanelInventory(labelNode) {
        var panel = findPanelNode();
        if (!panel && labelNode) {
            panel = findChipScopeForLabel(labelNode);
        }
        if (!panel) {
            var discovered = discoverVisibleLabels();
            if (discovered.length) {
                panel = findChipScopeForLabel(discovered[0].node);
            }
        }
        return buildInventoryFromRoot(panel);
    }

    function sortNodesByPos(nodes) {
        var arr = (nodes || []).slice();
        arr.sort(function (a, b) {
            var pa = nodeWorldPos(a);
            var pb = nodeWorldPos(b);
            var dy = Math.abs((pa.y || 0) - (pb.y || 0));
            if (dy > 8) {
                return (pb.y || 0) - (pa.y || 0);
            }
            return (pa.x || 0) - (pb.x || 0);
        });
        return arr;
    }

    function findOrdinalInSorted(target, nodes) {
        if (!target || !nodes || !nodes.length) {
            return -1;
        }
        var sorted = sortNodesByPos(nodes);
        for (var i = 0; i < sorted.length; i++) {
            if (sorted[i] === target) {
                return i;
            }
        }
        return -1;
    }

    function findNearestChip(labelNode, chips) {
        if (!labelNode || !chips || !chips.length) {
            return null;
        }
        var lp = nodeWorldPos(labelNode);
        var best = null;
        var bestD = null;
        for (var i = 0; i < chips.length; i++) {
            var chip = chips[i];
            if (!chip) {
                continue;
            }
            var cp = nodeWorldPos(chip);
            var d = dist2(lp.x || 0, lp.y || 0, cp.x || 0, cp.y || 0);
            if (bestD == null || d < bestD) {
                best = chip;
                bestD = d;
            }
        }
        return best;
    }

    function explainAmount(amount) {
        var key = String(Math.max(0, Math.floor(+amount || 0)));
        var tail = CHIP_TAILS[key] || '';
        var labelNode = tail ? findNodeByTailLocal(tail) : null;
        if (!labelNode) {
            labelNode = findBestVisibleLabelByAmount(Number(key));
        }
        var inv = getPanelInventory(labelNode);
        var idx = null;
        if (labelNode) {
            var m0 = String(labelNode.name || '').match(/lbl_chip_value(\d+)/i);
            if (m0) {
                idx = parseInt(m0[1], 10);
            }
        }
        var currentChip = findChipNodeFromLabelCurrent(labelNode);
        var strictChip = idx == null ? null : (inv.chipsByIndex[String(idx)] || null);
        var nearestChip = labelNode ? findNearestChip(labelNode, inv.chips) : null;
        var labelOrdinal = labelNode ? findOrdinalInSorted(labelNode, inv.labels) : -1;
        var sortedChips = sortNodesByPos(inv.chips);
        var ordinalChip = (labelOrdinal >= 0 && labelOrdinal < sortedChips.length) ? sortedChips[labelOrdinal] : null;
        var labelClickable = labelNode ? clickableOfLocal(labelNode, 10) : null;
        var strictClickable = strictChip ? clickableOfLocal(strictChip, 10) : null;
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
            labelPath: safePath(labelNode),
            currentChipPath: safePath(currentChip),
            currentTargetPath: safePath(currentTarget),
            strictChipPath: safePath(strictChip),
            nearestChipPath: safePath(nearestChip),
            ordinalChipPath: safePath(ordinalChip),
            labelClickablePath: safePath(labelClickable),
            strictClickablePath: safePath(strictClickable),
            labelParentPath: safePath(labelNode ? (labelNode.parent || labelNode._parent || null) : null),
            panelPath: safePath(inv.panel),
            panelLabelCount: inv.labels.length,
            panelChipCount: inv.chips.length,
            labelId: nodeId(labelNode),
            currentChipId: nodeId(currentChip),
            strictChipId: nodeId(strictChip),
            nearestChipId: nodeId(nearestChip),
            ordinalChipId: nodeId(ordinalChip),
            labelPos: nodeWorldPos(labelNode),
            nearestChipPos: nodeWorldPos(nearestChip),
            ordinalChipPos: nodeWorldPos(ordinalChip),
            labelOrdinal: labelOrdinal
        };
    }

    function scan() {
        var order = Object.keys(CHIP_TAILS).map(function (x) {
            return +x;
        }).sort(function (a, b) {
            return a - b;
        });
        var rows = [];
        for (var i = 0; i < order.length; i++) {
            var info = explainAmount(order[i]);
            rows.push({
                amount: info.amount,
                idx: info.idx,
                label: info.labelNode ? info.labelNode.name : '',
                currentChip: info.currentChip ? info.currentChip.name : '',
                currentTarget: info.currentTarget ? info.currentTarget.name : '',
                strictChip: info.strictChip ? info.strictChip.name : '',
                nearestChip: info.nearestChip ? info.nearestChip.name : '',
                ordinalChip: info.ordinalChip ? info.ordinalChip.name : '',
                labelClickable: info.labelClickable ? info.labelClickable.name : '',
                strictClickable: info.strictClickable ? info.strictClickable.name : '',
                labelParent: shortPath(info.labelNode ? (info.labelNode.parent || info.labelNode._parent || null) : null),
                panel: shortPath(info.panelPath),
                panelLabels: info.panelLabelCount,
                panelChips: info.panelChipCount,
                labelId: info.labelId,
                strictChipId: info.strictChipId,
                nearestChipId: info.nearestChipId,
                ordinalChipId: info.ordinalChipId,
                labelOrdinal: info.labelOrdinal
            });
        }
        try {
            console.table(rows);
        } catch (_) {
            console.log(rows);
        }
        return rows;
    }

    function print(amount) {
        var info = explainAmount(amount);
        console.log('[CHIP-PROBE][EXPLAIN]', info.amount, {
            idx: info.idx,
            labelPath: info.labelPath,
            labelParentPath: info.labelParentPath,
            currentChipPath: info.currentChipPath,
            currentTargetPath: info.currentTargetPath,
            strictChipPath: info.strictChipPath,
            nearestChipPath: info.nearestChipPath,
            ordinalChipPath: info.ordinalChipPath,
            labelClickablePath: info.labelClickablePath,
            strictClickablePath: info.strictClickablePath,
            panelPath: info.panelPath,
            panelLabelCount: info.panelLabelCount,
            panelChipCount: info.panelChipCount,
            labelId: info.labelId,
            currentChipId: info.currentChipId,
            strictChipId: info.strictChipId,
            nearestChipId: info.nearestChipId,
            ordinalChipId: info.ordinalChipId,
            labelPos: info.labelPos,
            nearestChipPos: info.nearestChipPos,
            ordinalChipPos: info.ordinalChipPos,
            labelOrdinal: info.labelOrdinal
        });
        return info;
    }

    function discover() {
        var rows = discoverVisibleLabels().map(function (x) {
            return {
                amount: x.amount,
                node: String(x.node && x.node.name || ''),
                nodeId: x.nodeId,
                score: x.score,
                text: x.text,
                path: shortPath(x.node)
            };
        });
        try {
            console.table(rows);
        } catch (_) {
            console.log(rows);
        }
        return rows;
    }

    function emitTouchLocal(n) {
        try {
            if (typeof window.emitTouchOnNode === 'function') {
                return !!window.emitTouchOnNode(n);
            }
        } catch (_) {}
        if (!n) {
            return false;
        }
        var p = nodeWorldPos(n);
        var ok = false;
        try {
            if (window.cc && cc.Touch && cc.Event && cc.Event.EventTouch && n.emit) {
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
        } catch (_) {}
        if (!ok) {
            try {
                if (n.emit) {
                    n.emit('touchstart', {
                        getLocation: function () {
                            return {
                                x: p.x || 0,
                                y: p.y || 0
                            };
                        }
                    });
                    n.emit('touchend', {
                        getLocation: function () {
                            return {
                                x: p.x || 0,
                                y: p.y || 0
                            };
                        }
                    });
                    ok = true;
                }
            } catch (_) {}
        }
        return ok;
    }

    function emitClickLocal(n) {
        try {
            if (typeof window.emitClick === 'function') {
                return !!window.emitClick(n);
            }
        } catch (_) {}
        if (!n || !n.emit) {
            return false;
        }
        try {
            n.emit('click', {
                type: 'click'
            });
            return true;
        } catch (_) {}
        return false;
    }

    function clickRectCenterLocal(rect) {
        try {
            if (typeof window.clickRectCenter === 'function') {
                return !!window.clickRectCenter(rect);
            }
        } catch (_) {}
        if (!rect) {
            return false;
        }
        try {
            var c = document.querySelector('canvas');
            if (!c) {
                return false;
            }
            var br = c.getBoundingClientRect();
            var clientX = Math.round(br.left + rect.x + rect.w / 2);
            var clientY = Math.round(br.top + rect.y + rect.h / 2);
            c.dispatchEvent(new PointerEvent('pointerdown', {
                bubbles: true,
                cancelable: true,
                pointerType: 'mouse',
                isPrimary: true,
                buttons: 1,
                clientX: clientX,
                clientY: clientY
            }));
            c.dispatchEvent(new PointerEvent('pointerup', {
                bubbles: true,
                cancelable: true,
                pointerType: 'mouse',
                isPrimary: true,
                clientX: clientX,
                clientY: clientY
            }));
            c.dispatchEvent(new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                clientX: clientX,
                clientY: clientY
            }));
            return true;
        } catch (_) {}
        return false;
    }

    async function pressNode(tag, node) {
        if (!node) {
            return {
                ok: false,
                tag: tag,
                reason: 'node_missing'
            };
        }
        var touched = emitTouchLocal(node);
        var clicked = false;
        if (!touched) {
            clicked = emitClickLocal(node);
        }
        if (!touched && !clicked) {
            clicked = clickRectCenterLocal(getRect(node));
        }
        await sleep(160);
        return {
            ok: !!(touched || clicked),
            tag: tag,
            name: String(node.name || ''),
            path: safePath(node),
            touched: !!touched,
            clicked: !!clicked
        };
    }

    async function focusCurrent(amount) {
        var info = explainAmount(amount);
        var target = info.currentTarget;
        var res = await pressNode('current', target);
        res.amount = info.amount;
        res.idx = info.idx;
        res.targetName = target ? String(target.name || '') : '';
        res.targetPath = target ? safePath(target) : '';
        return res;
    }

    async function focusStrict(amount) {
        var info = explainAmount(amount);
        var target = info.strictChip || info.strictClickable || info.nearestChip || info.labelNode;
        var res = await pressNode('strict', target);
        res.amount = info.amount;
        res.idx = info.idx;
        res.targetName = target ? String(target.name || '') : '';
        res.targetPath = target ? safePath(target) : '';
        return res;
    }

    async function focusNearest(amount) {
        var info = explainAmount(amount);
        var target = info.nearestChip || info.ordinalChip || info.labelClickable || info.labelNode;
        var res = await pressNode('nearest', target);
        res.amount = info.amount;
        res.idx = info.idx;
        res.targetName = target ? String(target.name || '') : '';
        res.targetPath = target ? safePath(target) : '';
        return res;
    }

    async function focusOrdinal(amount) {
        var info = explainAmount(amount);
        var target = info.ordinalChip || info.nearestChip || info.labelClickable || info.labelNode;
        var res = await pressNode('ordinal', target);
        res.amount = info.amount;
        res.idx = info.idx;
        res.targetName = target ? String(target.name || '') : '';
        res.targetPath = target ? safePath(target) : '';
        return res;
    }

    async function compare(amount) {
        var info = print(amount);
        var a = await focusCurrent(amount);
        await sleep(300);
        var b = await focusStrict(amount);
        var out = {
            amount: info.amount,
            idx: info.idx,
            current: a,
            strict: b
        };
        console.log('[CHIP-PROBE][COMPARE]', out);
        return out;
    }

    async function smoke(list, mode) {
        var arr = list && list.length ? list.slice() : [1000, 5000, 10000, 50000, 100000, 500000];
        var rows = [];
        for (var i = 0; i < arr.length; i++) {
            var amount = Math.max(0, Math.floor(+arr[i] || 0));
            var row;
            if (String(mode || '').toLowerCase() === 'current') {
                row = await focusCurrent(amount);
            } else if (String(mode || '').toLowerCase() === 'strict') {
                row = await focusStrict(amount);
            } else {
                row = await compare(amount);
            }
            rows.push(row);
            await sleep(500);
        }
        console.log('[CHIP-PROBE][SMOKE]', rows);
        return rows;
    }

    window[NS] = {
        PANEL_TAIL: PANEL_TAIL,
        CHIP_TAILS: CHIP_TAILS,
        discover: discover,
        scan: scan,
        print: print,
        explainAmount: explainAmount,
        focusCurrent: focusCurrent,
        focusStrict: focusStrict,
        focusNearest: focusNearest,
        focusOrdinal: focusOrdinal,
        compare: compare,
        smoke: smoke,
        getPanelInventory: getPanelInventory
    };

    console.log('[CHIP-PROBE] ready as window.' + NS);
})();
