(function () {
    function collapse(s) {
        return String(s || '').replace(/\s+/g, ' ').trim();
    }

    function norm(s) {
        try {
            return collapse(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        } catch (_) {
            return collapse(s).toLowerCase();
        }
    }

    function visible(el) {
        try {
            if (!el || !el.ownerDocument) return false;
            var view = el.ownerDocument.defaultView || window;
            var cs = view.getComputedStyle(el);
            var r = el.getBoundingClientRect();
            return r.width >= 8 &&
                r.height >= 8 &&
                cs.display !== 'none' &&
                cs.visibility !== 'hidden' &&
                cs.opacity !== '0';
        } catch (_) {
            return false;
        }
    }

    function fullPath(el, limit) {
        try {
            limit = limit || 80;
            var out = [];
            var cur = el;
            var n = 0;
            while (cur && cur.nodeType === 1 && n < limit) {
                var s = String(cur.tagName || '').toLowerCase();
                if (cur.id) s += '#' + cur.id;
                if (cur.classList && cur.classList.length) {
                    var cls = Array.prototype.slice.call(cur.classList, 0, 3).join('.');
                    if (cls) s += '.' + cls;
                }
                out.push(s);
                cur = cur.parentElement;
                n++;
            }
            out.reverse();
            return out.join('/');
        } catch (_) {
            return '';
        }
    }

    function parseRgb(s) {
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

    function parseRadiusPx(s, size) {
        if (!s) return 0;
        var raw = String(s).split(/\s+/)[0] || '';
        if (!raw) return 0;
        if (raw.indexOf('%') !== -1) {
            var pct = parseFloat(raw);
            if (!isFinite(pct)) return 0;
            return size * pct / 100;
        }
        var px = parseFloat(raw);
        return isFinite(px) ? px : 0;
    }

    function classifyColor(list) {
        for (var i = 0; i < list.length; i++) {
            var rgb = parseRgb(list[i]);
            if (!rgb) continue;
            if (rgb.r >= 150 && rgb.r > rgb.b * 1.12 && rgb.r > rgb.g * 1.05) return 'B';
            if (rgb.b >= 140 && rgb.b > rgb.r * 1.05 && rgb.b >= rgb.g * 0.95) return 'P';
            if (rgb.g >= 120 && rgb.g > rgb.r * 0.85 && rgb.g > rgb.b * 0.9) return 'H';
        }
        return '';
    }

    function walkContexts(rootWin, source, offX, offY, out, seen) {
        try {
            if (!rootWin || seen.indexOf(rootWin) >= 0) return;
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
                walkContexts(child, source + '/frame[' + i + ']', (offX || 0) + (fr.left || 0), (offY || 0) + (fr.top || 0), out, seen);
            }
        } catch (_) {}
    }

    function scoreContext(ctx) {
        var href = String(ctx.href || '').toLowerCase();
        var score = 0;
        if (href.indexOf('singlebactable.jsp') !== -1) score += 300;
        if (href.indexOf('webmain.jsp') !== -1) score += 40;
        try {
            var txt = collapse(ctx.doc.body ? ctx.doc.body.innerText : '').slice(0, 2500).toLowerCase();
            if (/tay con|nha cai|hoa|reload|no comm/.test(txt)) score += 140;
            if (/category|truyen thong|roulette|vao choi/.test(txt)) score -= 120;
        } catch (_) {}
        return score;
    }

    function classifyMarker(el, cs) {
        var txt = collapse(el.innerText || el.textContent || '').toUpperCase();
        if (/^B$/.test(txt)) return 'B';
        if (/^P$/.test(txt)) return 'P';
        if (/^(T|H)$/.test(txt)) return 'H';
        if (txt)
            return '';
        return classifyColor([
            cs.backgroundColor,
            cs.borderColor,
            cs.color,
            cs.outlineColor,
            el.getAttribute ? el.getAttribute('fill') : '',
            el.getAttribute ? el.getAttribute('stroke') : ''
        ]);
    }

    function median(nums) {
        if (!nums || !nums.length) return 0;
        var arr = nums.slice().sort(function (a, b) { return a - b; });
        var mid = Math.floor(arr.length / 2);
        return (arr.length % 2) ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
    }

    function collectMarkersInContext(ctx, opts) {
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
        for (var i = 0; i < all.length && i < 6000; i++) {
            var el = all[i];
            if (!visible(el)) continue;
            if (el.childElementCount && el.childElementCount > maxChildren) continue;
            var r = el.getBoundingClientRect();
            if (r.left < 0 || r.top < 0) continue;
            if (r.left > maxX || r.top < minY) continue;
            if (r.width < 10 || r.height < 10 || r.width > maxSize || r.height > maxSize) continue;
            if (Math.abs(r.width - r.height) > 10) continue;
            var cs = view.getComputedStyle(el);
            var marker = classifyMarker(el, cs);
            if (!marker) continue;
            var tag = String(el.tagName || '').toLowerCase();
            var borderRadius = cs.borderRadius || '';
            var minSide = Math.min(r.width, r.height);
            var rx = parseRadiusPx(borderRadius, minSide);
            var roundHint =
                tag === 'circle' ||
                /50%|999/.test(borderRadius) ||
                rx >= (minSide * roundRatio);
            if (!roundHint) continue;
            if (el.childElementCount > maxChildKeep && tag !== 'svg') continue;
            var key = marker + '|' + Math.round(r.left / 4) + '|' + Math.round(r.top / 4);
            if (seen[key]) continue;
            seen[key] = 1;
            var item = {
                v: marker,
                source: ctx.source,
                href: ctx.href,
                x: Math.round((ctx.offX || 0) + r.left),
                y: Math.round((ctx.offY || 0) + r.top),
                w: Math.round(r.width),
                h: Math.round(r.height),
                rawText: collapse(el.innerText || el.textContent || ''),
                tail: fullPath(el, 80),
                element: el
            };
            out.push(item);
        }
        return out;
    }

    function findBoardWithProfiles(contexts, screenW, screenH) {
        var profiles = [
            { maxXRatio: 0.18, minYRatio: 0.72, maxSize: 34, maxChildren: 2, maxChildKeep: 1, roundRatio: 0.28 },
            { maxXRatio: 0.24, minYRatio: 0.68, maxSize: 38, maxChildren: 3, maxChildKeep: 2, roundRatio: 0.22 },
            { maxXRatio: 0.30, minYRatio: 0.62, maxSize: 42, maxChildren: 4, maxChildKeep: 3, roundRatio: 0.18 }
        ];

        var bestPack = { board: null, markers: [], profile: -1 };
        for (var p = 0; p < profiles.length; p++) {
            var allMarkers = [];
            for (var i = 0; i < contexts.length; i++) {
                var ctx = contexts[i];
                var markers = collectMarkersInContext(ctx, profiles[p]);
                for (var j = 0; j < markers.length; j++) {
                    markers[j].ctxScore = ctx.score || 0;
                    allMarkers.push(markers[j]);
                }
            }
            var board = pickBoard(allMarkers, screenW, screenH);
            if (board) {
                bestPack = { board: board, markers: allMarkers, profile: p };
                break;
            }
            if (allMarkers.length > bestPack.markers.length) {
                bestPack = { board: null, markers: allMarkers, profile: p };
            }
        }
        return bestPack;
    }

    function splitComponents(items) {
        var comps = [];
        var used = new Array(items.length);
        function close(a, b) {
            return Math.abs(a.x - b.x) <= 64 && Math.abs(a.y - b.y) <= 92;
        }
        for (var i = 0; i < items.length; i++) {
            if (used[i]) continue;
            used[i] = true;
            var comp = [];
            var q = [i];
            while (q.length) {
                var idx = q.pop();
                var it = items[idx];
                comp.push(it);
                for (var j = 0; j < items.length; j++) {
                    if (used[j]) continue;
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

    function pickBoard(markers, screenW, screenH) {
        var comps = splitComponents(markers);
        var best = null;
        for (var i = 0; i < comps.length; i++) {
            var comp = comps[i];
            if (!comp.length) continue;
            var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            for (var j = 0; j < comp.length; j++) {
                var it = comp[j];
                if (it.x < minX) minX = it.x;
                if (it.x > maxX) maxX = it.x;
                if (it.y < minY) minY = it.y;
                if (it.y > maxY) maxY = it.y;
            }
            var width = maxX - minX;
            var height = maxY - minY;
            var cols = buildColumns(comp);
            var rowKeys = Object.create(null);
            for (var c = 0; c < cols.length; c++) {
                for (var r = 0; r < cols[c].items.length; r++) {
                    rowKeys[Math.round(cols[c].items[r].y / 12)] = 1;
                }
            }
            var rowCount = Object.keys(rowKeys).length;
            var colCount = cols.length;
            var textCount = 0;
            for (var t = 0; t < comp.length; t++) {
                if (/^[BPTH]$/.test(String(comp[t].rawText || '').toUpperCase())) textCount++;
            }
            if (comp.length < 8) continue;
            if (colCount < 2) continue;
            var score = comp.length * 30;
            score += Math.max(0, (screenW * 0.16 - minX)) * 10;
            score += Math.max(0, (screenH - maxY)) * 0.2;
            score += Math.max(0, (screenH * 0.88 - minY));
            score += textCount * 80;
            if (comp.length >= 12 && comp.length <= 40) score += 220;
            if (rowCount >= 5) score += 260;
            if (rowCount >= 6) score += 120;
            if (colCount >= 3) score += 160;
            if (colCount >= 4) score += 140;
            if (colCount >= 6) score += 100;
            if (rowCount <= 2) score -= 260;
            if (colCount <= 2) score -= 120;
            if (height < 70) score -= 180;
            if (width < 45) score -= 160;
            if (width >= 45 && width <= 120) score += 260;
            if (height >= 95 && height <= 175) score += 220;
            if (width > 135) score -= 420;
            if (height > 185) score -= 260;
            if (minX > screenW * 0.12) score -= 420;
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
                    textCount: textCount
                };
            }
        }
        return best;
    }

    function buildColumns(items) {
        if (!items.length) return [];
        var avgW = items.reduce(function (s, x) { return s + x.w; }, 0) / items.length;
        var tol = Math.max(10, Math.round(avgW * 0.8));
        var cols = [];
        var sorted = items.slice().sort(function (a, b) {
            var ay = (a._gridY != null ? a._gridY : a.y);
            var by = (b._gridY != null ? b._gridY : b.y);
            return a.x - b.x || ay - by;
        });
        for (var i = 0; i < sorted.length; i++) {
            var it = sorted[i];
            var col = null;
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

    function buildRows(items) {
        if (!items.length) return [];
        var avgH = items.reduce(function (s, x) { return s + x.h; }, 0) / items.length;
        var tol = Math.max(10, Math.round(avgH * 0.8));
        var rows = [];
        var sorted = items.slice().sort(function (a, b) {
            return a.y - b.y || a.x - b.x;
        });
        for (var i = 0; i < sorted.length; i++) {
            var it = sorted[i];
            var row = null;
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

    function trimBoardToTopSixRows(board) {
        if (!board || !board.items || !board.items.length) return board;
        var rows = buildRows(board.items);
        if (rows.length <= 6) {
            board.rows = rows;
            return board;
        }
        var keepRows = rows.slice(0, 6);
        var keep = [];
        for (var i = 0; i < keepRows.length; i++) {
            for (var j = 0; j < keepRows[i].items.length; j++) {
                keep.push(keepRows[i].items[j]);
            }
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
        board.minX = minX;
        board.maxX = maxX;
        board.minY = minY;
        board.maxY = maxY;
        board.width = maxX - minX;
        board.height = maxY - minY;
        board.rowCount = keepRows.length;
        board.rows = keepRows;
        board.colCount = buildColumns(keep).length;
        return board;
    }

    function trimBoardToLeftTopSegment(board) {
        if (!board || !board.items || !board.items.length) return board;
        var cols = buildColumns(board.items);
        if (!cols.length) return board;

        var leftCols = [cols[0]];
        var avgW = board.items.reduce(function (s, x) { return s + x.w; }, 0) / board.items.length;
        var maxGap = Math.max(18, Math.round(avgW * 1.45));

        for (var i = 1; i < cols.length; i++) {
            var gap = cols[i].cx - cols[i - 1].cx;
            if (gap > maxGap) break;
            leftCols.push(cols[i]);
            if (leftCols.length >= 8) break;
        }

        var keep = [];
        for (var c = 0; c < leftCols.length; c++) {
            for (var r = 0; r < leftCols[c].items.length; r++) {
                keep.push(leftCols[c].items[r]);
            }
        }

        if (!keep.length) return board;

        var topRows = buildRows(keep).slice(0, 6);
        var topKeep = [];
        for (var rr = 0; rr < topRows.length; rr++) {
            for (var ii = 0; ii < topRows[rr].items.length; ii++) {
                topKeep.push(topRows[rr].items[ii]);
            }
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
        board.minX = minX;
        board.maxX = maxX;
        board.minY = minY;
        board.maxY = maxY;
        board.width = maxX - minX;
        board.height = maxY - minY;
        board.rows = topRows;
        board.rowCount = topRows.length;
        board.colCount = buildColumns(topKeep).length;
        return board;
    }

    function normalizeBoardToSixRows(board) {
        if (!board || !board.items || !board.items.length) return board;
        var minY = Infinity, maxY = -Infinity;
        for (var i = 0; i < board.items.length; i++) {
            var it = board.items[i];
            if (it.y < minY) minY = it.y;
            if (it.y > maxY) maxY = it.y;
        }
        if (!isFinite(minY) || !isFinite(maxY)) return board;
        var rows = buildRows(board.items);
        var rowDiffs = [];
        for (var r = 1; r < rows.length; r++) rowDiffs.push(rows[r].cy - rows[r - 1].cy);
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

    function refineBoardMarkers(contexts, board) {
        if (!board || !board.items || !board.items.length) return [];
        var src = board.items[0].source;
        var ctx = null;
        for (var i = 0; i < contexts.length; i++) {
            if (contexts[i].source === src) {
                ctx = contexts[i];
                break;
            }
        }
        if (!ctx) return board.items.slice();

        var avgW = board.items.reduce(function (s, x) { return s + x.w; }, 0) / board.items.length;
        var avgH = board.items.reduce(function (s, x) { return s + x.h; }, 0) / board.items.length;
        var padX = Math.max(8, Math.round(avgW * 0.9));
        var padY = Math.max(8, Math.round(avgH * 0.9));
        var minX = board.minX - padX;
        var maxX = board.maxX + padX;
        var minY = board.minY - padY;
        var maxY = board.maxY + padY;
        var out = [];
        var seen = Object.create(null);
        var all = ctx.doc.querySelectorAll('div,span,p,b,strong,button,svg,circle,td');
        for (var n = 0; n < all.length && n < 8000; n++) {
            var el = all[n];
            if (!visible(el)) continue;
            var r = el.getBoundingClientRect();
            var gx = Math.round((ctx.offX || 0) + r.left);
            var gy = Math.round((ctx.offY || 0) + r.top);
            if (gx < minX || gx > maxX || gy < minY || gy > maxY) continue;
            if (r.width < 10 || r.height < 10 || r.width > 40 || r.height > 40) continue;
            if (Math.abs(r.width - r.height) > 12) continue;
            var cs = ctx.win.getComputedStyle(el);
            var marker = classifyMarker(el, cs);
            if (!marker) continue;
            var borderRadius = cs.borderRadius || '';
            var minSide = Math.min(r.width, r.height);
            var rx = parseRadiusPx(borderRadius, minSide);
            var tag = String(el.tagName || '').toLowerCase();
            var roundHint =
                tag === 'circle' ||
                /50%|999/.test(borderRadius) ||
                rx >= (minSide * 0.18);
            if (!roundHint) continue;
            var key = marker + '|' + Math.round(gx / 4) + '|' + Math.round(gy / 4);
            if (seen[key]) continue;
            seen[key] = 1;
            out.push({
                v: marker,
                source: ctx.source,
                href: ctx.href,
                x: gx,
                y: gy,
                w: Math.round(r.width),
                h: Math.round(r.height),
                rawText: collapse(el.innerText || el.textContent || ''),
                tail: fullPath(el, 80),
                element: el
            });
        }
        return out.length ? out : board.items.slice();
    }

    function buildGrid6xN(items) {
        if (!items || !items.length) return { grid: [], cols: [], rowStep: 0, colStep: 0 };
        var colsRaw = buildColumns(items);
        var colCenters = colsRaw.map(function (c) { return c.cx; }).sort(function (a, b) { return a - b; });
        var colDiffs = [];
        for (var i = 1; i < colCenters.length; i++) colDiffs.push(colCenters[i] - colCenters[i - 1]);
        var colStep = Math.max(12, Math.round(median(colDiffs) || median(items.map(function (x) { return x.w; })) || 18));

        var rowsRaw = buildRows(items);
        var rowCenters = rowsRaw.map(function (r) { return r.cy; }).sort(function (a, b) { return a - b; });
        var rowDiffs = [];
        for (var j = 1; j < rowCenters.length; j++) rowDiffs.push(rowCenters[j] - rowCenters[j - 1]);
        var rowStep = Math.max(10, Math.round(median(rowDiffs) || median(items.map(function (x) { return x.h; })) || 20));

        var minX = Math.min.apply(null, colCenters);
        var minY = Math.min.apply(null, rowCenters);
        var maxCol = 0;
        for (var k = 0; k < items.length; k++) {
            var cidx = Math.round((items[k].x - minX) / colStep);
            if (cidx > maxCol) maxCol = cidx;
        }
        var grid = [];
        for (var c = 0; c <= maxCol; c++) {
            grid[c] = [null, null, null, null, null, null];
        }

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
                if (grid[cc][rr]) colItems.push(grid[cc][rr]);
            }
            if (colItems.length) {
                cols.push({
                    cx: minX + cc * colStep,
                    items: colItems
                });
            }
        }
        return { grid: grid, cols: cols, rowStep: rowStep, colStep: colStep, minX: minX, minY: minY };
    }

    function sequenceFromGrid(gridPack) {
        if (!gridPack || !gridPack.cols) return '';
        return gridPack.cols.map(function (col) {
            return col.items.map(function (it) {
                return it.v === 'H' ? 'T' : it.v;
            }).join('');
        }).join('');
    }

    function ensureOverlayRoot() {
        var id = '__abx_bead_probe_root';
        var root = document.getElementById(id);
        if (root) return root;
        root = document.createElement('div');
        root.id = id;
        root.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647;';
        document.documentElement.appendChild(root);
        return root;
    }

    function clearOverlay() {
        var root = document.getElementById('__abx_bead_probe_root');
        if (root) root.innerHTML = '';
    }

    function drawOverlay(board, cols) {
        clearOverlay();
        var root = ensureOverlayRoot();
        if (!board) return;
        var box = document.createElement('div');
        box.style.cssText = [
            'position:fixed',
            'left:' + board.minX + 'px',
            'top:' + board.minY + 'px',
            'width:' + Math.max(20, board.width + 24) + 'px',
            'height:' + Math.max(20, board.height + 24) + 'px',
            'border:2px solid #00ff66',
            'background:rgba(0,255,102,0.05)',
            'box-sizing:border-box'
        ].join(';');
        root.appendChild(box);
        for (var i = 0; i < cols.length; i++) {
            for (var j = 0; j < cols[i].items.length; j++) {
                var it = cols[i].items[j];
                var d = document.createElement('div');
                d.style.cssText = [
                    'position:fixed',
                    'left:' + it.x + 'px',
                    'top:' + it.y + 'px',
                    'width:' + it.w + 'px',
                    'height:' + it.h + 'px',
                    'border:1px solid #ffd866',
                    'background:rgba(255,216,102,0.12)',
                    'color:#fff',
                    'font:10px/1 Consolas,monospace',
                    'display:flex',
                    'align-items:center',
                    'justify-content:center',
                    'box-sizing:border-box'
                ].join(';');
                d.textContent = it.v;
                root.appendChild(d);
            }
        }
    }

    function probeBeadResults() {
        var contexts = [];
        walkContexts(window, 'top', 0, 0, contexts, []);
        contexts.forEach(function (ctx) {
            ctx.score = scoreContext(ctx);
        });

        var screenW = window.innerWidth || 1600;
        var screenH = window.innerHeight || 900;
        var picked = findBoardWithProfiles(contexts, screenW, screenH);
        var allMarkers = picked.markers || [];
        var board = picked.board;
        board = trimBoardToTopSixRows(board);
        board = trimBoardToLeftTopSegment(board);
        board = normalizeBoardToSixRows(board);
        if (board) {
            board.items = refineBoardMarkers(contexts, board);
            board = trimBoardToTopSixRows(board);
            board = trimBoardToLeftTopSegment(board);
            board = normalizeBoardToSixRows(board);
        }
        var gridPack = board ? buildGrid6xN(board.items) : { cols: [], grid: [] };
        var cols = gridPack.cols || [];
        var seq = sequenceFromGrid(gridPack);

        drawOverlay(board, cols);

        console.log('[ABX BEAD] contexts=');
        console.table(contexts.map(function (ctx) {
            return { source: ctx.source, href: ctx.href, score: ctx.score };
        }));

        console.log('[ABX BEAD] board=', board ? {
            score: board.score,
            count: board.items.length,
            x: board.minX,
            y: board.minY,
            w: board.width,
            h: board.height,
            rows: board.rowCount,
            cols: board.colCount,
            profile: picked.profile
        } : { profile: picked.profile, markers: allMarkers.length });

        console.log('[ABX BEAD] columns=');
        console.table(cols.map(function (col, idx) {
            return {
                col: idx + 1,
                x: col.cx,
                count: col.items.length,
                seq: col.items.map(function (it) { return it.v === 'H' ? 'T' : it.v; }).join('')
            };
        }));

        console.log('[ABX BEAD] markers=');
        console.table((board ? board.items : []).map(function (it, idx) {
            return {
                idx: idx + 1,
                v: it.v,
                x: it.x,
                y: it.y,
                source: it.source,
                rawText: it.rawText,
                tail: it.tail
            };
        }));

        console.log('[ABX BEAD] seq=', seq);

        window.__abx_bead_probe_result = {
            contexts: contexts,
            board: board,
            columns: cols,
            sequence: seq,
            markers: board ? board.items : []
        };
        return window.__abx_bead_probe_result;
    }

    window.__abx_probe_bead_results = probeBeadResults;
    probeBeadResults();
})();
