(function () {
    'use strict';

    var KEYWORDS = {
        banker: ['banker', 'nha cai', 'nhacai', '\u5e84'],
        player: ['player', 'tay con', 'taycon', '\u95f2'],
        tie: ['tie', 'hoa', '\u548c']
    };
    var ROLE_TO_CHAR = {
        banker: 'B',
        player: 'P',
        tie: 'T'
    };
    var DEFAULTS = {
        scanMs: 120,
        countdownScanMs: 300,
        stableMs: 350,
        decisionStableMs: 160,
        minDeltaScore: 18,
        minLeadScore: 7,
        minAbsoluteScore: 14,
        immediateLockDelta: 18,
        immediateLockLead: 8,
        candidateHistoryMs: 5000,
        preCloseHistoryMs: 1800,
        postCloseLockMs: 4500,
        promotionGraceMs: 240,
        rearmNoWinnerMs: 1400,
        countdownOpenValue: 1,
        panelMinWidth: 110,
        panelMinHeight: 75,
        debugBufferSize: 250
    };

    function foldText(input) {
        return String(input || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\u0111/g, 'd')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function nowIso() {
        var d = new Date();
        return d.toISOString().replace('T', ' ').slice(0, 23);
    }

    function clamp(n, min, max) {
        return Math.max(min, Math.min(max, n));
    }

    function parseNumber(input) {
        var n = Number(input);
        return isFinite(n) ? n : 0;
    }

    function parseColor(input) {
        var s = String(input || '').trim();
        if (!s || s === 'transparent' || s === 'initial' || s === 'inherit') {
            return { r: 0, g: 0, b: 0, a: 0 };
        }
        var m = s.match(/rgba?\(([^)]+)\)/i);
        if (m) {
            var parts = m[1].split(',').map(function (x) { return x.trim(); });
            return {
                r: clamp(parseFloat(parts[0]) || 0, 0, 255),
                g: clamp(parseFloat(parts[1]) || 0, 0, 255),
                b: clamp(parseFloat(parts[2]) || 0, 0, 255),
                a: clamp(parts.length > 3 ? (parseFloat(parts[3]) || 0) : 1, 0, 1)
            };
        }
        if (s[0] === '#') {
            var hex = s.slice(1);
            if (hex.length === 3) {
                return {
                    r: parseInt(hex[0] + hex[0], 16),
                    g: parseInt(hex[1] + hex[1], 16),
                    b: parseInt(hex[2] + hex[2], 16),
                    a: 1
                };
            }
            if (hex.length === 6 || hex.length === 8) {
                return {
                    r: parseInt(hex.slice(0, 2), 16),
                    g: parseInt(hex.slice(2, 4), 16),
                    b: parseInt(hex.slice(4, 6), 16),
                    a: hex.length === 8 ? clamp(parseInt(hex.slice(6, 8), 16) / 255, 0, 1) : 1
                };
            }
        }
        return { r: 0, g: 0, b: 0, a: 0 };
    }

    function luminance(c) {
        if (!c) return 0;
        return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
    }

    function colorStrength(c) {
        return luminance(c) * (c ? c.a : 0);
    }

    function parseFilterScore(filterText) {
        var s = String(filterText || '').toLowerCase();
        if (!s || s === 'none') return 0;
        var score = 0;
        var brightness = s.match(/brightness\(([\d.]+)\)/);
        if (brightness) score += (parseFloat(brightness[1]) - 1) * 20;
        var contrast = s.match(/contrast\(([\d.]+)\)/);
        if (contrast) score += (parseFloat(contrast[1]) - 1) * 10;
        if (/\bdrop-shadow\(/.test(s)) score += 6;
        return score;
    }

    function parseShadowScore(shadowText) {
        var s = String(shadowText || '');
        if (!s || s === 'none') return 0;
        var score = 0;
        var colorMatches = s.match(/rgba?\(([^)]+)\)/gi) || [];
        for (var i = 0; i < colorMatches.length; i++) {
            score += colorStrength(parseColor(colorMatches[i])) / 32;
        }
        var numMatches = s.match(/-?\d+(\.\d+)?px/g) || [];
        for (var j = 0; j < numMatches.length; j++) {
            score += Math.min(parseFloat(numMatches[j]) || 0, 24) / 6;
        }
        return score;
    }

    function getOwnerWindow(node) {
        try {
            return node && node.ownerDocument && node.ownerDocument.defaultView ? node.ownerDocument.defaultView : window;
        } catch (_) {
            return window;
        }
    }

    function safeDocTitle(doc) {
        try {
            return String((doc && doc.title) || '');
        } catch (_) {
            return '';
        }
    }

    function safeDocHref(win) {
        try {
            return String((win && win.location && win.location.href) || '');
        } catch (_) {
            return '';
        }
    }

    function collectAccessibleDocs(win, out, path) {
        var doc = null;
        try {
            doc = win.document;
        } catch (_) {
            return;
        }
        if (!doc || !doc.documentElement) return;
        out.push({
            win: win,
            doc: doc,
            path: String(path || 'top'),
            title: safeDocTitle(doc),
            href: safeDocHref(win)
        });
        var frames = [];
        try {
            frames = doc.querySelectorAll('iframe, frame');
        } catch (_) {
            frames = [];
        }
        for (var i = 0; i < frames.length; i++) {
            var childWin = null;
            try {
                childWin = frames[i].contentWindow;
            } catch (_) {
                childWin = null;
            }
            if (!childWin || childWin === win) continue;
            collectAccessibleDocs(childWin, out, String(path || 'top') + '/frame[' + i + ']');
        }
    }

    function getAccessibleDocs() {
        var out = [];
        collectAccessibleDocs(window, out, 'top');
        return out;
    }

    function docListSignature(docs) {
        return (docs || []).map(function (x) {
            return [x.path, x.href].join('@');
        }).join('|');
    }

    function isVisible(el) {
        if (!el || !el.isConnected) return false;
        var win = getOwnerWindow(el);
        var style = win.getComputedStyle(el);
        if (!style) return false;
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        if ((parseFloat(style.opacity) || 0) <= 0.02) return false;
        var rect = el.getBoundingClientRect();
        if (rect.width < 4 || rect.height < 4) return false;
        if (rect.bottom < 0 || rect.right < 0) return false;
        if (rect.top > win.innerHeight || rect.left > win.innerWidth) return false;
        return true;
    }

    function containsKeyword(text, role) {
        var norm = foldText(text);
        var words = KEYWORDS[role] || [];
        for (var i = 0; i < words.length; i++) {
            if (norm.indexOf(words[i]) >= 0) return true;
        }
        return false;
    }

    function matchedRoles(text) {
        var roles = [];
        if (containsKeyword(text, 'banker')) roles.push('banker');
        if (containsKeyword(text, 'player')) roles.push('player');
        if (containsKeyword(text, 'tie')) roles.push('tie');
        return roles;
    }

    function elementScore(el, role) {
        var text = foldText(el.innerText || el.textContent || '');
        if (!text) return -9999;
        var rect = el.getBoundingClientRect();
        var win = getOwnerWindow(el);
        var score = 0;
        var exact = KEYWORDS[role].some(function (k) { return text === k; });
        if (exact) score += 35;
        if (containsKeyword(text, role)) score += 22;
        if (text.length <= 18) score += 10;
        if (rect.width >= DEFAULTS.panelMinWidth) score += 12;
        if (rect.height >= DEFAULTS.panelMinHeight) score += 12;
        score += Math.min(rect.width * rect.height / 6000, 20);
        var cls = foldText((el.className && String(el.className)) || '');
        var id = foldText(el.id || '');
        if (containsKeyword(cls + ' ' + id, role)) score += 24;
        if (rect.left > win.innerWidth * 0.55 && role === 'banker') score += 8;
        if (rect.left < win.innerWidth * 0.45 && role === 'player') score += 8;
        if (Math.abs((rect.left + rect.width / 2) - (win.innerWidth / 2)) < win.innerWidth * 0.2 && role === 'tie') score += 8;
        return score;
    }

    function pickPanelRoot(labelEl, role) {
        var best = null;
        var cur = labelEl;
        var win = getOwnerWindow(labelEl);
        for (var depth = 0; cur && depth < 8; depth++, cur = cur.parentElement) {
            if (!isVisible(cur)) continue;
            var rect = cur.getBoundingClientRect();
            if (rect.width < DEFAULTS.panelMinWidth || rect.height < DEFAULTS.panelMinHeight) continue;
            if (rect.width > win.innerWidth * 0.8 || rect.height > win.innerHeight * 0.6) continue;
            var text = foldText(cur.innerText || cur.textContent || '');
            var roles = matchedRoles(text);
            if (roles.length > 1) break;
            if (roles.length === 0 || roles[0] !== role) continue;
            best = cur;
        }
        return best || labelEl;
    }

    function findPanel(role, docInfo) {
        if (!docInfo || !docInfo.doc) return null;
        var nodes = docInfo.doc.querySelectorAll('body *');
        var bestEl = null;
        var bestScore = -9999;
        for (var i = 0; i < nodes.length; i++) {
            var el = nodes[i];
            if (!isVisible(el)) continue;
            var txt = foldText(el.innerText || el.textContent || '');
            if (!txt || txt.length > 120) continue;
            if (!containsKeyword(txt, role)) continue;
            var score = elementScore(el, role);
            if (score < bestScore) continue;
            var root = pickPanelRoot(el, role);
            if (!root || !isVisible(root)) continue;
            var rect = root.getBoundingClientRect();
            score += Math.min(rect.width * rect.height / 8000, 24);
            if (score > bestScore) {
                bestScore = score;
                bestEl = root;
            }
        }
        return bestEl ? {
            role: role,
            el: bestEl,
            docInfo: docInfo,
            score: bestScore
        } : null;
    }

    function readCountdown(docInfo) {
        if (!docInfo || !docInfo.doc) return null;
        var selectors = [
            '#countdownTime',
            '#countdownTime p',
            '[id*="countdown"]',
            '[class*="countdown"]',
            '[data-role*="countdown"]',
            '[id*="timer"]',
            '[class*="timer"]'
        ];
        var nodes = [];
        var doc = docInfo.doc;
        var win = docInfo.win || window;
        for (var s = 0; s < selectors.length; s++) {
            try {
                var part = doc.querySelectorAll(selectors[s]);
                for (var i = 0; i < part.length; i++) nodes.push(part[i]);
            } catch (_) {}
        }
        if (!nodes.length) return null;
        var best = null;
        var bestScore = -9999;
        for (var j = 0; j < nodes.length; j++) {
            var el = nodes[j];
            if (!isVisible(el)) continue;
            var text = foldText(el.innerText || el.textContent || '');
            var m = text.match(/\b(\d{1,2})\b/);
            if (!m) continue;
            var n = parseInt(m[1], 10);
            if (!(n >= 0 && n <= 99)) continue;
            var rect = el.getBoundingClientRect();
            var cls = foldText((el.className && String(el.className)) || '') + ' ' + foldText(el.id || '');
            var score = 0;
            if (/countdown/.test(cls)) score += 30;
            if (/timer/.test(cls)) score += 20;
            score += 20 - Math.min(Math.abs(rect.left + rect.width / 2 - win.innerWidth / 2) / 30, 20);
            score += rect.top < win.innerHeight * 0.45 ? 10 : 0;
            if (score > bestScore) {
                bestScore = score;
                best = n;
            }
        }
        return best;
    }

    function collectProbeElements(root) {
        if (!root || !isVisible(root)) return [];
        var out = [];
        var seen = [];
        function push(el) {
            if (!el || seen.indexOf(el) >= 0) return;
            if (!(el === root || root.contains(el))) return;
            if (!isVisible(el)) return;
            seen.push(el);
            out.push(el);
        }
        var rect = root.getBoundingClientRect();
        var win = getOwnerWindow(root);
        var doc = root.ownerDocument || document;
        push(root);
        var points = [
            [rect.left + rect.width * 0.5, rect.top + rect.height * 0.5],
            [rect.left + rect.width * 0.2, rect.top + rect.height * 0.5],
            [rect.left + rect.width * 0.8, rect.top + rect.height * 0.5],
            [rect.left + rect.width * 0.5, rect.top + rect.height * 0.25],
            [rect.left + rect.width * 0.5, rect.top + rect.height * 0.75]
        ];
        if (doc.elementsFromPoint) {
            for (var i = 0; i < points.length; i++) {
                var x = clamp(points[i][0], 0, win.innerWidth - 1);
                var y = clamp(points[i][1], 0, win.innerHeight - 1);
                var hits = [];
                try {
                    hits = doc.elementsFromPoint(x, y) || [];
                } catch (_) {
                    hits = [];
                }
                for (var h = 0; h < Math.min(hits.length, 8); h++) push(hits[h]);
            }
        }
        var descendants = [];
        try {
            descendants = root.querySelectorAll('*');
        } catch (_) {
            descendants = [];
        }
        for (var j = 0; j < Math.min(descendants.length, 80); j++) {
            var el = descendants[j];
            if (!isVisible(el)) continue;
            var tag = String(el.tagName || '').toLowerCase();
            var cls = (el.className && String(el.className)) || '';
            var sty = el.getAttribute && (el.getAttribute('style') || '') || '';
            if (tag === 'canvas' || tag === 'svg' || /\b(active|selected|win|winner|highlight|light|glow|mask|overlay|flash)\b/i.test(cls + ' ' + sty)) {
                push(el);
            }
        }
        return out;
    }

    function readElementVisual(el) {
        if (!el || !isVisible(el)) return null;
        var win = getOwnerWindow(el);
        var cs = win.getComputedStyle(el);
        var bg = parseColor(cs.backgroundColor);
        var border = parseColor(cs.borderTopColor || cs.borderColor);
        var text = parseColor(cs.color);
        var rect = el.getBoundingClientRect();
        var classText = (el.className && String(el.className)) || '';
        var attrText = [
            el.getAttribute && el.getAttribute('class') || '',
            el.getAttribute && el.getAttribute('style') || '',
            el.getAttribute && el.getAttribute('data-state') || '',
            el.getAttribute && el.getAttribute('aria-selected') || ''
        ].join(' ');
        var activeFlag = /(active|selected|win|winner|focus|highlight|current|on|light|glow|flash)\b/i.test(classText + ' ' + attrText) ? 8 : 0;
        return {
            bgLum: colorStrength(bg),
            borderLum: colorStrength(border),
            textLum: colorStrength(text),
            shadow: parseShadowScore(cs.boxShadow),
            filter: parseFilterScore(cs.filter),
            opacity: parseFloat(cs.opacity) || 1,
            outlineWidth: parseFloat(cs.outlineWidth) || 0,
            outlineLum: colorStrength(parseColor(cs.outlineColor)),
            fontWeight: parseNumber(cs.fontWeight) / 100,
            activeFlag: activeFlag,
            width: rect.width,
            height: rect.height,
            left: rect.left,
            top: rect.top,
            className: classText,
            styleText: attrText,
            tagName: String(el.tagName || '').toLowerCase()
        };
    }

    function samplePanelVisual(panelRef) {
        var el = panelRef && panelRef.el ? panelRef.el : panelRef;
        if (!el || !isVisible(el)) return null;
        var probes = collectProbeElements(el);
        if (!probes.length) probes = [el];
        var rootVisual = readElementVisual(el);
        var strongest = rootVisual ? cloneVisual(rootVisual) : null;
        for (var i = 0; i < probes.length; i++) {
            var v = readElementVisual(probes[i]);
            if (!v) continue;
            if (!strongest) {
                strongest = cloneVisual(v);
                continue;
            }
            strongest.bgLum = Math.max(strongest.bgLum, v.bgLum);
            strongest.borderLum = Math.max(strongest.borderLum, v.borderLum);
            strongest.textLum = Math.max(strongest.textLum, v.textLum);
            strongest.shadow = Math.max(strongest.shadow, v.shadow);
            strongest.filter = Math.max(strongest.filter, v.filter);
            strongest.opacity = Math.max(strongest.opacity, v.opacity);
            strongest.outlineWidth = Math.max(strongest.outlineWidth, v.outlineWidth);
            strongest.outlineLum = Math.max(strongest.outlineLum, v.outlineLum);
            strongest.fontWeight = Math.max(strongest.fontWeight, v.fontWeight);
            strongest.activeFlag = Math.max(strongest.activeFlag, v.activeFlag);
            if ((v.shadow + v.filter + v.activeFlag + v.bgLum / 40) > (strongest.shadow + strongest.filter + strongest.activeFlag + strongest.bgLum / 40)) {
                strongest.className = v.className;
                strongest.styleText = v.styleText;
                strongest.tagName = v.tagName;
            }
        }
        strongest.probeCount = probes.length;
        strongest.rootClassName = rootVisual ? rootVisual.className : '';
        strongest.rootTagName = rootVisual ? rootVisual.tagName : '';
        return strongest;
    }

    function cloneVisual(v) {
        if (!v) return null;
        return JSON.parse(JSON.stringify(v));
    }

    function smoothBaseline(prev, next) {
        if (!next) return prev || null;
        if (!prev) return cloneVisual(next);
        var out = {};
        Object.keys(next).forEach(function (k) {
            if (typeof next[k] === 'number') out[k] = prev[k] == null ? next[k] : prev[k] * 0.8 + next[k] * 0.2;
            else out[k] = next[k];
        });
        return out;
    }

    function computeScore(visual, baseline) {
        if (!visual) return null;
        baseline = baseline || {
            bgLum: visual.bgLum,
            borderLum: visual.borderLum,
            textLum: visual.textLum,
            shadow: visual.shadow,
            filter: visual.filter,
            opacity: visual.opacity,
            outlineWidth: visual.outlineWidth,
            outlineLum: visual.outlineLum,
            fontWeight: visual.fontWeight,
            activeFlag: 0
        };
        var deltaBg = visual.bgLum - baseline.bgLum;
        var deltaBorder = visual.borderLum - baseline.borderLum;
        var deltaShadow = visual.shadow - baseline.shadow;
        var deltaFilter = visual.filter - baseline.filter;
        var deltaOpacity = (visual.opacity - baseline.opacity) * 20;
        var deltaOutline = (visual.outlineWidth - baseline.outlineWidth) * 4 + (visual.outlineLum - baseline.outlineLum) / 30;
        var deltaWeight = (visual.fontWeight - baseline.fontWeight) * 2;
        var deltaActive = (visual.activeFlag - (baseline.activeFlag || 0));
        var delta = deltaBg / 12 + deltaBorder / 10 + deltaShadow * 1.4 + deltaFilter + deltaOpacity + deltaOutline + deltaWeight + deltaActive;
        var absolute = visual.bgLum / 32 + visual.borderLum / 28 + visual.shadow * 0.8 + visual.filter + visual.activeFlag + visual.outlineLum / 40;
        return {
            delta: delta,
            absolute: absolute,
            detail: {
                deltaBg: deltaBg,
                deltaBorder: deltaBorder,
                deltaShadow: deltaShadow,
                deltaFilter: deltaFilter,
                deltaOpacity: deltaOpacity,
                deltaOutline: deltaOutline,
                deltaWeight: deltaWeight,
                deltaActive: deltaActive
            }
        };
    }

    function round2(n) {
        if (!isFinite(n)) return 0;
        return Number(n.toFixed(2));
    }

    function compactVisual(v) {
        if (!v) return null;
        return {
            bg: round2(v.bgLum),
            border: round2(v.borderLum),
            shadow: round2(v.shadow),
            filter: round2(v.filter),
            active: round2(v.activeFlag),
            opacity: round2(v.opacity),
            outline: round2(v.outlineLum),
            probeCount: v.probeCount || 1,
            tag: v.tagName || v.rootTagName || '',
            className: String(v.className || v.rootClassName || '').slice(0, 120)
        };
    }

    function compactScore(score, snap, base) {
        if (!score && !snap) return null;
        return {
            delta: score ? round2(score.delta) : 0,
            absolute: score ? round2(score.absolute) : 0,
            deltaBg: score ? round2(score.detail.deltaBg) : 0,
            deltaBorder: score ? round2(score.detail.deltaBorder) : 0,
            deltaShadow: score ? round2(score.detail.deltaShadow) : 0,
            deltaFilter: score ? round2(score.detail.deltaFilter) : 0,
            deltaOpacity: score ? round2(score.detail.deltaOpacity) : 0,
            deltaOutline: score ? round2(score.detail.deltaOutline) : 0,
            deltaActive: score ? round2(score.detail.deltaActive) : 0,
            snap: compactVisual(snap),
            base: compactVisual(base)
        };
    }

    function compactScoreMap(scores, snaps, bases) {
        var out = {};
        ['banker', 'player', 'tie'].forEach(function (role) {
            out[role] = compactScore(
                scores ? scores[role] : null,
                snaps ? snaps[role] : null,
                bases ? bases[role] : null
            );
        });
        return out;
    }

    function cloneJson(x) {
        return x == null ? x : JSON.parse(JSON.stringify(x));
    }

    function createWatcher() {
        var state = {
            running: false,
            seq: '',
            round: 0,
            armed: true,
            waitingResult: false,
            waitingSince: 0,
            lastCountdown: null,
            lastCountdownAt: 0,
            lastNoWinnerAt: 0,
            lastAppendAt: 0,
            lastWinner: null,
            pending: null,
            panels: { banker: null, player: null, tie: null },
            baselines: { banker: null, player: null, tie: null },
            snapshots: { banker: null, player: null, tie: null },
            candidateHistory: [],
            debug: [],
            timers: [],
            observers: [],
            docs: [],
            docsSignature: '',
            gameDoc: null,
            config: Object.assign({}, DEFAULTS),
            mutationBurstAt: 0
        };

        function log(tag, data) {
            var line = {
                at: nowIso(),
                tag: tag,
                data: data || {}
            };
            state.debug.push(line);
            if (state.debug.length > state.config.debugBufferSize) state.debug.shift();
            try {
                console.log('[ABX-WINNER][' + tag + ']', data || {});
            } catch (_) {}
        }

        function panelRefAlive(ref) {
            return !!(ref && ref.el && ref.el.isConnected && isVisible(ref.el));
        }

        function describePanel(ref) {
            if (!ref || !ref.el) return null;
            return {
                text: foldText(ref.el.innerText || ref.el.textContent || '').slice(0, 60),
                path: ref.docInfo ? ref.docInfo.path : null,
                title: ref.docInfo ? ref.docInfo.title : null,
                score: ref.score
            };
        }

        function pruneCandidateHistory(now) {
            now = now || Date.now();
            var keepMs = Number(state.config.candidateHistoryMs || 5000);
            state.candidateHistory = state.candidateHistory.filter(function (x) {
                return !!x && (now - Number(x.at || 0)) <= keepMs;
            });
        }

        function clearCandidateHistory() {
            state.candidateHistory = [];
        }

        function rememberCandidate(candidate, scores, reason, now) {
            if (!candidate) return;
            now = now || Date.now();
            pruneCandidateHistory(now);
            state.candidateHistory.push({
                at: now,
                role: candidate.role,
                delta: Number(candidate.delta || 0),
                lead: Number(candidate.lead || 0),
                absolute: Number(candidate.absolute || 0),
                reason: String(reason || ''),
                countdown: state.lastCountdown,
                waitingResult: !!state.waitingResult,
                scores: compactScoreMap(scores, state.snapshots, state.baselines)
            });
            if (state.candidateHistory.length > 80) state.candidateHistory.shift();
        }

        function summarizeCandidateHistory(now) {
            now = now || Date.now();
            pruneCandidateHistory(now);
            var waitAt = Number(state.waitingSince || 0);
            if (!waitAt) return null;
            var fromAt = waitAt - Number(state.config.preCloseHistoryMs || 1800);
            var toAt = Math.min(now, waitAt + Number(state.config.postCloseLockMs || 4500));
            var arr = state.candidateHistory.filter(function (x) {
                return x && Number(x.at || 0) >= fromAt && Number(x.at || 0) <= toAt;
            });
            if (!arr.length) return null;
            var grouped = {};
            arr.forEach(function (x) {
                var g = grouped[x.role];
                if (!g) {
                    g = grouped[x.role] = {
                        role: x.role,
                        count: 0,
                        bestDelta: -9999,
                        bestLead: -9999,
                        bestAbsolute: -9999,
                        firstAt: x.at,
                        lastAt: x.at,
                        best: x
                    };
                }
                g.count += 1;
                g.firstAt = Math.min(g.firstAt, x.at);
                g.lastAt = Math.max(g.lastAt, x.at);
                if (x.delta > g.bestDelta) {
                    g.bestDelta = x.delta;
                    g.bestLead = x.lead;
                    g.bestAbsolute = x.absolute;
                    g.best = x;
                }
            });
            var rows = Object.keys(grouped).map(function (role) {
                var g = grouped[role];
                var nearCloseBonus = Math.max(0, 1 - Math.abs((g.lastAt - waitAt)) / 1000) * 4;
                g.rankScore = g.bestDelta + Math.min(g.count, 4) * 1.8 + nearCloseBonus + Math.max(0, g.bestLead / 4);
                return g;
            }).sort(function (a, b) {
                return b.rankScore - a.rankScore;
            });
            return {
                fromAt: fromAt,
                toAt: toAt,
                count: arr.length,
                best: rows[0] || null,
                second: rows[1] || null,
                rows: rows
            };
        }

        function canPromoteSummary(summary, now) {
            if (!summary || !summary.best) return null;
            var best = summary.best;
            var second = summary.second || { rankScore: -9999, bestDelta: -9999 };
            var waitAt = Number(state.waitingSince || 0);
            if (!waitAt) return null;
            if ((now - waitAt) < Number(state.config.promotionGraceMs || 240)) return null;
            if ((now - waitAt) > Number(state.config.postCloseLockMs || 4500)) return null;
            var rankLead = Number(best.rankScore || 0) - Number(second.rankScore || 0);
            var closeEnough = Math.abs(Number(best.lastAt || 0) - waitAt) <= Number(state.config.preCloseHistoryMs || 1800);
            var strongSingle = best.bestDelta >= Number(state.config.immediateLockDelta || 18) && best.bestLead >= Number(state.config.immediateLockLead || 8);
            var repeated = best.count >= 2 && best.bestDelta >= Number(state.config.minDeltaScore || 18) - 2;
            if (!closeEnough) return null;
            if (!strongSingle && !repeated) return null;
            if (rankLead < 2.5) return null;
            return {
                role: best.role,
                delta: best.bestDelta,
                lead: best.bestLead,
                absolute: best.bestAbsolute,
                rankLead: rankLead,
                count: best.count,
                promotedFrom: best.best
            };
        }

        function refreshDocs(force) {
            var docs = getAccessibleDocs();
            var sig = docListSignature(docs);
            if (!force && sig === state.docsSignature) return state.docs;
            state.docs = docs;
            state.docsSignature = sig;
            log('docs', {
                count: docs.length,
                paths: docs.map(function (x) { return x.path; })
            });
            return docs;
        }

        function rebuildObservers(force) {
            var docs = refreshDocs(force);
            var nextSig = docListSignature(docs);
            if (!force && nextSig === state._observerSig) return;
            while (state.observers.length) {
                try { state.observers.pop().disconnect(); } catch (_) {}
            }
            state._observerSig = nextSig;
            docs.forEach(function (docInfo) {
                if (!docInfo.doc || !docInfo.doc.body) return;
                try {
                    var obs = new MutationObserver(function () {
                        state.mutationBurstAt = Date.now();
                        evaluate('mutation');
                    });
                    obs.observe(docInfo.doc.body, {
                        subtree: true,
                        childList: true,
                        attributes: true,
                        attributeFilter: ['class', 'style', 'data-state', 'aria-selected'],
                        characterData: true
                    });
                    state.observers.push(obs);
                } catch (_) {}
            });
            log('observers', { count: state.observers.length });
        }

        function findBestPanelSet() {
            var docs = refreshDocs(false);
            var bestSet = null;
            var bestScore = -9999;
            docs.forEach(function (docInfo) {
                var set = {
                    docInfo: docInfo,
                    panels: { banker: null, player: null, tie: null },
                    found: 0,
                    score: 0
                };
                ['banker', 'player', 'tie'].forEach(function (role) {
                    var ref = findPanel(role, docInfo);
                    if (!ref) return;
                    set.panels[role] = ref;
                    set.found += 1;
                    set.score += Number(ref.score || 0);
                });
                if (set.found === 3) set.score += 120;
                if (set.found === 2) set.score += 40;
                if (set.score > bestScore) {
                    bestScore = set.score;
                    bestSet = set;
                }
            });
            return bestSet;
        }

        function ensurePanels(force) {
            rebuildObservers(false);
            var changed = false;
            var healthy = panelRefAlive(state.panels.banker) && panelRefAlive(state.panels.player) && panelRefAlive(state.panels.tie);
            if (!force && healthy) return true;
            var bestSet = findBestPanelSet();
            var nextPanels = bestSet ? bestSet.panels : { banker: null, player: null, tie: null };
            ['banker', 'player', 'tie'].forEach(function (role) {
                if (state.panels[role] !== nextPanels[role]) changed = true;
                state.panels[role] = nextPanels[role];
            });
            state.gameDoc = bestSet ? bestSet.docInfo : null;
            if (changed || force) {
                log('panels', {
                    docPath: state.gameDoc ? state.gameDoc.path : null,
                    banker: describePanel(state.panels.banker),
                    player: describePanel(state.panels.player),
                    tie: describePanel(state.panels.tie)
                });
            }
            return !!(panelRefAlive(state.panels.banker) && panelRefAlive(state.panels.player) && panelRefAlive(state.panels.tie));
        }

        function updateCountdown(now) {
            if ((now - state.lastCountdownAt) < state.config.countdownScanMs) return state.lastCountdown;
            var next = readCountdown(state.gameDoc);
            if (next !== state.lastCountdown) {
                log('countdown', { prev: state.lastCountdown, next: next });
                if (state.lastCountdown != null && state.lastCountdown > 0 && next === 0) {
                    state.waitingResult = true;
                    state.waitingSince = now;
                    log('betting-closed', { countdown: next });
                } else if (state.lastCountdown != null && state.lastCountdown <= 3 && next == null) {
                    state.waitingResult = true;
                    state.waitingSince = now;
                    log('betting-closed', { countdown: next, reason: 'countdown-hidden-near-zero', prev: state.lastCountdown });
                } else if (next != null && next > state.config.countdownOpenValue) {
                    state.armed = true;
                    state.waitingResult = false;
                    state.waitingSince = 0;
                    clearCandidateHistory();
                }
                state.lastCountdown = next;
            }
            state.lastCountdownAt = now;
            return next;
        }

        function refreshSnapshots() {
            ['banker', 'player', 'tie'].forEach(function (role) {
                state.snapshots[role] = samplePanelVisual(state.panels[role]);
            });
        }

        function strongCandidate(scores) {
            var arr = Object.keys(scores).map(function (role) {
                var item = scores[role];
                return item ? {
                    role: role,
                    delta: item.delta,
                    absolute: item.absolute,
                    detail: item.detail
                } : null;
            }).filter(Boolean).sort(function (a, b) {
                return b.delta - a.delta;
            });
            if (!arr.length) return null;
            var top = arr[0];
            var second = arr[1] || { delta: -9999 };
            if (top.delta < state.config.minDeltaScore) return null;
            if ((top.delta - second.delta) < state.config.minLeadScore) return null;
            if (top.absolute < state.config.minAbsoluteScore) return null;
            top.lead = top.delta - second.delta;
            top.secondDelta = second.delta;
            return top;
        }

        function updateBaselines(candidate) {
            var allowBaseline = !candidate;
            if (state.lastCountdown != null && state.lastCountdown <= 0) allowBaseline = false;
            ['banker', 'player', 'tie'].forEach(function (role) {
                if (!allowBaseline) return;
                state.baselines[role] = smoothBaseline(state.baselines[role], state.snapshots[role]);
            });
        }

        function maybeRearmer(now, hasCandidate) {
            if (state.armed) return;
            if (state.lastCountdown != null && state.lastCountdown > state.config.countdownOpenValue) {
                state.armed = true;
                state.waitingResult = false;
                state.waitingSince = 0;
                state.pending = null;
                clearCandidateHistory();
                log('rearm', { reason: 'countdown-open', countdown: state.lastCountdown });
                return;
            }
            if (!hasCandidate) {
                if (!state.lastNoWinnerAt) state.lastNoWinnerAt = now;
                if ((now - state.lastNoWinnerAt) >= state.config.rearmNoWinnerMs) {
                    state.armed = true;
                    state.pending = null;
                    state.waitingSince = 0;
                    clearCandidateHistory();
                    log('rearm', { reason: 'winner-cleared', idleMs: now - state.lastNoWinnerAt });
                }
            } else {
                state.lastNoWinnerAt = 0;
            }
        }

        function appendWinner(candidate, now) {
            var ch = ROLE_TO_CHAR[candidate.role];
            state.seq += ch;
            state.round += 1;
            state.lastAppendAt = now;
            state.lastWinner = candidate.role;
            state.armed = false;
            state.waitingResult = false;
            state.waitingSince = 0;
            state.pending = null;
            state.lastNoWinnerAt = 0;
            clearCandidateHistory();
            log('winner-locked', {
                round: state.round,
                role: candidate.role,
                char: ch,
                seq: state.seq,
                delta: Number(candidate.delta.toFixed(2)),
                lead: Number(candidate.lead.toFixed(2)),
                absolute: Number(candidate.absolute.toFixed(2)),
                countdown: state.lastCountdown,
                promoted: !!candidate.promotedFrom
            });
            if (typeof state.onAppend === 'function') {
                try {
                    state.onAppend({
                        role: candidate.role,
                        char: ch,
                        seq: state.seq,
                        round: state.round,
                        at: Date.now()
                    });
                } catch (err) {
                    log('on-append-error', { message: String(err && err.message || err) });
                }
            }
        }

        function evaluate(reason) {
            if (!state.running) return;
            var now = Date.now();
            ensurePanels(false);
            if (!(state.panels.banker && state.panels.player && state.panels.tie)) return;
            updateCountdown(now);
            refreshSnapshots();

            var scores = {};
            ['banker', 'player', 'tie'].forEach(function (role) {
                scores[role] = computeScore(state.snapshots[role], state.baselines[role]);
            });
            var candidate = strongCandidate(scores);
            if (candidate) rememberCandidate(candidate, scores, reason, now);
            updateBaselines(candidate);

            if (!state.armed) {
                maybeRearmer(now, !!candidate);
                return;
            }
            if (!candidate) {
                state.pending = null;
                if (state.waitingResult && state.waitingSince) {
                    var summary = summarizeCandidateHistory(now);
                    var promoted = canPromoteSummary(summary, now);
                    if (promoted) {
                        log('winner-promoted', {
                            role: promoted.role,
                            delta: round2(promoted.delta),
                            lead: round2(promoted.lead),
                            absolute: round2(promoted.absolute),
                            rankLead: round2(promoted.rankLead),
                            count: promoted.count,
                            sourceReason: promoted.promotedFrom ? promoted.promotedFrom.reason : ''
                        });
                        appendWinner(promoted, now);
                        return;
                    }
                }
                if (state.waitingResult && state.waitingSince && (now - state.waitingSince) > 1200 && (!state._lastNoCandidateLogAt || (now - state._lastNoCandidateLogAt) > 1200)) {
                    state._lastNoCandidateLogAt = now;
                    var pendingSummary = summarizeCandidateHistory(now);
                    log('waiting-no-candidate', {
                        waitMs: now - state.waitingSince,
                        countdown: state.lastCountdown,
                        scores: compactScoreMap(scores, state.snapshots, state.baselines),
                        history: pendingSummary ? {
                            count: pendingSummary.count,
                            best: pendingSummary.best ? {
                                role: pendingSummary.best.role,
                                count: pendingSummary.best.count,
                                bestDelta: round2(pendingSummary.best.bestDelta),
                                bestLead: round2(pendingSummary.best.bestLead),
                                bestAbsolute: round2(pendingSummary.best.bestAbsolute),
                                rankScore: round2(pendingSummary.best.rankScore),
                                lastAgoMs: now - pendingSummary.best.lastAt
                            } : null,
                            second: pendingSummary.second ? {
                                role: pendingSummary.second.role,
                                count: pendingSummary.second.count,
                                bestDelta: round2(pendingSummary.second.bestDelta),
                                bestLead: round2(pendingSummary.second.bestLead),
                                bestAbsolute: round2(pendingSummary.second.bestAbsolute),
                                rankScore: round2(pendingSummary.second.rankScore),
                                lastAgoMs: now - pendingSummary.second.lastAt
                            } : null
                        } : null
                    });
                }
                return;
            }

            if (!state.waitingResult && state.lastCountdown != null && state.lastCountdown > 0) {
                return;
            }

            if (state.pending && state.pending.role === candidate.role) {
                var neededStableMs = state.waitingResult ? Number(state.config.decisionStableMs || 160) : Number(state.config.stableMs || 350);
                if ((now - state.pending.since) >= neededStableMs || (state.waitingResult && candidate.delta >= Number(state.config.immediateLockDelta || 18) && candidate.lead >= Number(state.config.immediateLockLead || 8))) {
                    appendWinner(candidate, now);
                }
                return;
            }

            state.pending = {
                role: candidate.role,
                since: now,
                reason: reason || 'poll',
                delta: candidate.delta,
                absolute: candidate.absolute
            };
            log('winner-candidate', {
                role: candidate.role,
                delta: Number(candidate.delta.toFixed(2)),
                lead: Number(candidate.lead.toFixed(2)),
                absolute: Number(candidate.absolute.toFixed(2)),
                reason: reason || 'poll',
                countdown: state.lastCountdown,
                scores: compactScoreMap(scores, state.snapshots, state.baselines)
            });
        }

        function start() {
            if (state.running) return api;
            state.running = true;
            rebuildObservers(true);
            ensurePanels(true);
            state.armed = true;
            state.waitingResult = false;
            state.waitingSince = 0;
            state.lastCountdown = null;
            state.lastCountdownAt = 0;
            state.pending = null;
            state.lastNoWinnerAt = 0;
            clearCandidateHistory();

            state.timers.push(setInterval(function () {
                evaluate('interval');
            }, state.config.scanMs));

            log('start', {
                scanMs: state.config.scanMs,
                stableMs: state.config.stableMs
            });
            return api;
        }

        function stop() {
            state.running = false;
            while (state.timers.length) clearInterval(state.timers.pop());
            while (state.observers.length) {
                try { state.observers.pop().disconnect(); } catch (_) {}
            }
            log('stop', {
                seq: state.seq,
                round: state.round
            });
            return api;
        }

        function reset() {
            state.seq = '';
            state.round = 0;
            state.armed = true;
            state.waitingResult = false;
            state.waitingSince = 0;
            state.pending = null;
            state.lastNoWinnerAt = 0;
            state.lastWinner = null;
            state.lastAppendAt = 0;
            clearCandidateHistory();
            state.baselines = { banker: null, player: null, tie: null };
            state.snapshots = { banker: null, player: null, tie: null };
            log('reset', {});
            return api;
        }

        function relocate() {
            ensurePanels(true);
            return api;
        }

        function setSeq(seq) {
            state.seq = String(seq || '').toUpperCase().replace(/[^BPT]/g, '');
            log('set-seq', { seq: state.seq });
            return api;
        }

        function getSeq() {
            return state.seq;
        }

        function setOnAppend(fn) {
            state.onAppend = typeof fn === 'function' ? fn : null;
            return api;
        }

        function getState() {
            var scores = {};
            ['banker', 'player', 'tie'].forEach(function (role) {
                scores[role] = computeScore(state.snapshots[role], state.baselines[role]);
            });
            return {
                running: state.running,
                seq: state.seq,
                round: state.round,
                armed: state.armed,
                waitingResult: state.waitingResult,
                waitingSince: state.waitingSince,
                lastCountdown: state.lastCountdown,
                lastWinner: state.lastWinner,
                gameDoc: state.gameDoc ? {
                    path: state.gameDoc.path,
                    title: state.gameDoc.title,
                    href: state.gameDoc.href
                } : null,
                pending: state.pending,
                panels: {
                    banker: describePanel(state.panels.banker),
                    player: describePanel(state.panels.player),
                    tie: describePanel(state.panels.tie)
                },
                compactScores: compactScoreMap(scores, state.snapshots, state.baselines),
                scores: scores,
                baselines: state.baselines,
                snapshots: state.snapshots,
                debug: state.debug.slice()
            };
        }

        function debugNow() {
            var snapshot = getState();
            log('debug-now', {
                waitingResult: snapshot.waitingResult,
                waitingSince: snapshot.waitingSince,
                countdown: snapshot.lastCountdown,
                gameDoc: snapshot.gameDoc,
                panels: snapshot.panels,
                compactScores: snapshot.compactScores
            });
            return snapshot;
        }

        function tune(partial) {
            if (partial && typeof partial === 'object') {
                Object.keys(partial).forEach(function (k) {
                    if (state.config[k] != null) state.config[k] = partial[k];
                });
                log('tune', state.config);
            }
            return api;
        }

        var api = {
            start: start,
            stop: stop,
            reset: reset,
            relocate: relocate,
            setSeq: setSeq,
            getSeq: getSeq,
            getState: getState,
            debugNow: debugNow,
            tune: tune,
            setOnAppend: setOnAppend
        };
        return api;
    }

    if (window.__abxWinnerWatch && typeof window.__abxWinnerWatch.stop === 'function') {
        try { window.__abxWinnerWatch.stop(); } catch (_) {}
    }
    window.__abxWinnerWatch = createWatcher();

    console.log('[ABX-WINNER] Ready');
    console.log('[ABX-WINNER] Use: __abxWinnerWatch.start()');
    console.log('[ABX-WINNER] API: start(), stop(), reset(), relocate(), setSeq(str), getSeq(), getState(), debugNow(), tune({...}), setOnAppend(fn)');
})();
