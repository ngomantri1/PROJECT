(() => {
    'use strict';

    const PROBE_NS = '__b52CountdownProbe';
    const DEFAULTS = {
        intervalMs: 250,
        tableEvery: 8,
        durationMs: 0,
        topN: 8
    };

    if (window[PROBE_NS] && typeof window[PROBE_NS].stop === 'function') {
        try { window[PROBE_NS].stop(); } catch (_) {}
    }

    function getScene() {
        try {
            return window.cc && cc.director && cc.director.getScene ? cc.director.getScene() : null;
        } catch (_) {
            return null;
        }
    }

    function getComp(node, T) {
        try {
            return node && node.getComponent ? node.getComponent(T) : null;
        } catch (_) {
            return null;
        }
    }

    function clamp01(v) {
        v = Number(v) || 0;
        if (v < 0) return 0;
        if (v > 1) return 1;
        return v;
    }

    function round(v, digits) {
        if (v == null || v === '') return null;
        if (!isFinite(Number(v))) return null;
        const p = Math.pow(10, digits || 0);
        return Math.round(Number(v) * p) / p;
    }

    function fullPath(node, limit) {
        const out = [];
        let cur = node;
        let hop = 0;
        limit = limit || 180;
        while (cur && hop < limit) {
            if (cur.name) out.push(cur.name);
            cur = cur.parent || cur._parent || null;
            hop++;
        }
        out.reverse();
        return out.join('/');
    }

    function nodeActive(node) {
        try {
            if (!node) return false;
            if (node.active === false) return false;
            if (node.activeInHierarchy === false) return false;
            if (node._activeInHierarchy === false) return false;
            if (typeof node.opacity !== 'undefined' && Number(node.opacity) <= 3) return false;
        } catch (_) {
            return false;
        }
        return true;
    }

    function toScreenPt(node, p) {
        try {
            let cam = null;
            if (cc.Camera && cc.Camera.findCamera) cam = cc.Camera.findCamera(node);
            else if (cc.Camera && cc.Camera.main) cam = cc.Camera.main;
            if (cam && cam.worldToScreen) {
                const sp = cam.worldToScreen(p);
                const fs = cc.view && cc.view.getFrameSize ? cc.view.getFrameSize() : null;
                const vs = cc.view && cc.view.getVisibleSize ? cc.view.getVisibleSize() : null;
                if (fs && vs && vs.width && vs.height) {
                    return {
                        x: sp.x * (fs.width / vs.width),
                        y: sp.y * (fs.height / vs.height)
                    };
                }
                return { x: sp.x, y: sp.y };
            }
        } catch (_) {}
        try {
            if (cc.view && cc.view._convertPointWithScale) {
                const sp2 = cc.view._convertPointWithScale(p);
                if (sp2) return { x: sp2.x, y: sp2.y };
            }
        } catch (_) {}
        return { x: p.x || 0, y: p.y || 0 };
    }

    function rectOf(node) {
        try {
            const V2 = cc.v2 || cc.Vec2;
            const p = node.convertToWorldSpaceAR(new V2(0, 0));
            const cs = node.getContentSize ? node.getContentSize() : (node._contentSize || { width: 0, height: 0 });
            const ax = node.anchorX != null ? node.anchorX : 0.5;
            const ay = node.anchorY != null ? node.anchorY : 0.5;
            const blx = (p.x || 0) - (cs.width || 0) * ax;
            const bly = (p.y || 0) - (cs.height || 0) * ay;
            const sp1 = toScreenPt(node, new V2(blx, bly));
            const sp2 = toScreenPt(node, new V2(blx + (cs.width || 0), bly + (cs.height || 0)));
            const x = Math.min(sp1.x, sp2.x);
            const y = Math.min(sp1.y, sp2.y);
            const w = Math.abs(sp2.x - sp1.x);
            const h = Math.abs(sp2.y - sp1.y);
            return {
                x,
                y,
                w,
                h,
                cx: x + w * 0.5,
                cy: y + h * 0.5
            };
        } catch (_) {
            return null;
        }
    }

    function componentName(comp) {
        try {
            return String((comp && (comp.__classname__ || comp.name || (comp.constructor && comp.constructor.name))) || '');
        } catch (_) {
            return '';
        }
    }

    function allowedPath(pathL) {
        if (!pathL) return false;
        if (!pathL.includes('mainxocdia')) return false;
        if (!pathL.includes('xocdiaviewmodel')) return false;
        if (!pathL.includes('countdownstartgame')) return false;
        if (
            pathL.includes('minigamenode') ||
            pathL.includes('jackpot') ||
            pathL.includes('chat') ||
            pathL.includes('broadcast') ||
            pathL.includes('history') ||
            pathL.includes('soicau') ||
            pathL.includes('ketqua') ||
            pathL.includes('result') ||
            pathL.includes('listlabel') ||
            pathL.includes('totall') ||
            pathL.includes('totalc') ||
            pathL.includes('totalle') ||
            pathL.includes('totalchan') ||
            pathL.includes('/hud/') ||
            pathL.includes('/icexit') ||
            pathL.includes('textwin') ||
            pathL.includes('bgmd5') ||
            pathL.includes('btndatlai') ||
            pathL.includes('muccuoclb')
        ) {
            return false;
        }
        return true;
    }

    function rectScore(rect) {
        if (!rect) return -999;
        const iw = Math.max(1, window.innerWidth || 1);
        const ih = Math.max(1, window.innerHeight || 1);
        if (rect.w < 50 || rect.h < 5) return -999;
        if (rect.w > iw * 0.8 || rect.h > ih * 0.2) return -999;
        let score = 0;
        const aspect = rect.w / Math.max(1, rect.h);
        if (aspect >= 4) score += 20;
        if (aspect >= 7) score += 20;
        const nx = rect.cx / iw;
        const ny = rect.cy / ih;
        if (nx > 0.35 && nx < 0.65) score += 30;
        if (ny > 0.55 && ny < 0.78) score += 30;
        if (rect.w >= 180 && rect.w <= 420) score += 25;
        if (rect.h >= 10 && rect.h <= 60) score += 10;
        return score;
    }

    function readProgressLike(node, rect) {
        const out = [];

        const push = (source, ratio, extra, boost) => {
            ratio = Number(ratio);
            if (!isFinite(ratio)) return;
            ratio = Math.abs(ratio);
            if (ratio > 1.02) return;
            out.push({
                source,
                ratio: clamp01(ratio),
                extra: extra || null,
                boost: Number(boost) || 0
            });
        };

        try {
            if (cc.ProgressBar) {
                const pb = getComp(node, cc.ProgressBar);
                if (pb && typeof pb.progress !== 'undefined') {
                    push('cc.ProgressBar', pb.progress, null, 90);
                }
            }
        } catch (_) {}

        try {
            if (cc.Sprite) {
                const sp = getComp(node, cc.Sprite);
                if (sp) {
                    if (typeof sp.fillRange !== 'undefined') push('cc.Sprite.fillRange', sp.fillRange, null, 70);
                    else if (typeof sp._fillRange !== 'undefined') push('cc.Sprite._fillRange', sp._fillRange, null, 60);
                }
            }
        } catch (_) {}

        try {
            if (typeof node.scaleX !== 'undefined') {
                const sx = Math.abs(Number(node.scaleX));
                if (isFinite(sx) && sx > 0 && sx <= 1.02) push('node.scaleX', sx, null, 20);
            }
        } catch (_) {}

        try {
            const parent = node.parent || node._parent || null;
            if (parent && nodeActive(parent)) {
                const pr = rectOf(parent);
                if (pr && rect && pr.w > rect.w + 20 && Math.abs(pr.cy - rect.cy) <= Math.max(20, pr.h)) {
                    const ratio = rect.w / Math.max(1, pr.w);
                    if (ratio > 0 && ratio <= 1.02) {
                        push('width/parent', ratio, { parentPath: fullPath(parent, 180) }, 30);
                    }
                }
            }
        } catch (_) {}

        try {
            const comps = node && node._components ? node._components : [];
            for (let i = 0; i < comps.length; i++) {
                const comp = comps[i];
                const name = componentName(comp);
                if (!name) continue;
                if (typeof comp.progress !== 'undefined') push(name + '.progress', comp.progress, null, 55);
                if (typeof comp.fillRange !== 'undefined') push(name + '.fillRange', comp.fillRange, null, 45);
                if (typeof comp._fillRange !== 'undefined') push(name + '._fillRange', comp._fillRange, null, 35);
            }
        } catch (_) {}

        return out;
    }

    function candidateScore(pathL, rect, sourceBoost) {
        let score = rectScore(rect);
        if (score < 0) return score;
        if (pathL.includes('countdownstartgame')) score += 140;
        if (pathL.includes('countdownprogress')) score += 140;
        if (pathL.endsWith('/countdownprogress')) score += 220;
        if (pathL.endsWith('/countdownprogress/bar')) score += 180;
        if (pathL.includes('dealerxocdia')) score += 80;
        if (pathL.includes('cardealerxocdia')) score += 80;
        if (pathL.includes('countdown')) score += 40;
        if (pathL.includes('progress')) score += 35;
        if (pathL.includes('wait')) score += 15;
        score += Number(sourceBoost) || 0;
        return score;
    }

    function walkNodes(cb) {
        const scene = getScene();
        if (!scene) return;
        const q = [scene];
        const seen = new Set();
        while (q.length) {
            const node = q.shift();
            if (!node || seen.has(node)) continue;
            seen.add(node);
            try { cb(node); } catch (_) {}
            const kids = node.children || node._children || [];
            for (let i = 0; i < kids.length; i++) q.push(kids[i]);
        }
    }

    function collectCandidates() {
        const rows = [];

        walkNodes(node => {
            if (!nodeActive(node)) return;
            const path = fullPath(node, 180);
            const pathL = String(path || '').toLowerCase();
            if (!allowedPath(pathL)) return;

            const rect = rectOf(node);
            const progressLikes = readProgressLike(node, rect);
            if (!progressLikes.length) return;

            for (let i = 0; i < progressLikes.length; i++) {
                const hit = progressLikes[i];
                const score = candidateScore(pathL, rect, hit.boost);
                if (score < 0) continue;
                rows.push({
                    key: hit.source + '|' + path,
                    path,
                    pathL,
                    source: hit.source,
                    ratio: hit.ratio,
                    score,
                    rect,
                    extra: hit.extra || null
                });
            }
        });

        rows.sort((a, b) => b.score - a.score);
        return rows;
    }

    function pickBest(state, rows, now) {
        let best = null;
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rec = state.byKey.get(row.key);
            if (!rec) continue;
            if (rec.durationSec == null || rec.confidence < 2) continue;
            let rank = row.score + rec.confidence * 120;
            if (state.lockKey && row.key === state.lockKey) rank += 400;
            if (rec.durationSec != null && rec.durationSec >= 6 && rec.durationSec <= 60) rank += 120;
            if (rec.lastSeen && now - rec.lastSeen <= state.opts.intervalMs * 2 + 80) rank += 40;
            if (rec.currentSec != null && rec.currentSec < 0.9) rank += 50;
            if (!best || rank > best.rank) best = { rank, row, rec };
        }
        return best;
    }

    function formatRect(rect) {
        if (!rect) return '';
        return [round(rect.x, 0), round(rect.y, 0), round(rect.w, 0), round(rect.h, 0)].join(',');
    }

    function sampleOnce(state) {
        const now = Date.now();
        const rows = collectCandidates();

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            let rec = state.byKey.get(row.key);
            if (!rec) {
                rec = {
                    key: row.key,
                    path: row.path,
                    source: row.source,
                    firstSeen: now,
                    lastSeen: 0,
                    lastRatio: null,
                    lastTs: 0,
                    confidence: 0,
                    durationSec: null,
                    currentSec: null,
                    currentRatio: null,
                    rect: row.rect,
                    score: row.score
                };
                state.byKey.set(row.key, rec);
            }

            if (rec.lastRatio != null && rec.lastTs) {
                const dtSec = (now - rec.lastTs) / 1000;
                const delta = Number(rec.lastRatio) - Number(row.ratio);
                if (dtSec > 0.05 && dtSec < 2.5 && delta > 0.001) {
                    const durationSec = dtSec / delta;
                    if (durationSec >= 4 && durationSec <= 120) {
                        rec.durationSec = rec.durationSec == null
                            ? durationSec
                            : (rec.durationSec * 0.75 + durationSec * 0.25);
                        rec.confidence = Math.min(50, rec.confidence + 1);
                    }
                } else if (row.ratio > rec.lastRatio + 0.08) {
                    rec.confidence = Math.max(0, rec.confidence - 2);
                }
            }

            rec.path = row.path;
            rec.source = row.source;
            rec.rect = row.rect;
            rec.score = row.score;
            rec.lastSeen = now;
            rec.lastRatio = row.ratio;
            rec.lastTs = now;
            rec.currentRatio = row.ratio;
            rec.currentSec = rec.durationSec == null ? null : clamp01(row.ratio) * rec.durationSec;
            if (rec.currentSec != null && (rec.currentSec <= 0.9 || row.ratio <= 0.02)) rec.currentSec = 0;
        }

        state.sampleNo++;
        state.lastRows = rows;
        const best = pickBest(state, rows, now);
        if (best) {
            state.best = best;
            state.lockKey = best.row.key;
        } else {
            state.best = null;
        }

        if (best && best.rec) {
            const rec = best.rec;
            const line = {
                sample: state.sampleNo,
                t: round((now - state.startTs) / 1000, 1),
                sec: round(rec.currentSec, 2),
                ratio: round(rec.currentRatio, 4),
                durationSec: round(rec.durationSec, 2),
                confidence: rec.confidence,
                source: rec.source,
                rect: formatRect(rec.rect),
                path: rec.path
            };
            console.log('[B52CD][BEST]', line);
        } else {
            console.log('[B52CD][BEST]', {
                sample: state.sampleNo,
                t: round((now - state.startTs) / 1000, 1),
                sec: null,
                note: 'no candidate'
            });
        }

        if (state.opts.tableEvery > 0 && (state.sampleNo === 1 || (state.sampleNo % state.opts.tableEvery) === 0)) {
            const top = rows.slice(0, state.opts.topN).map(row => {
                const rec = state.byKey.get(row.key);
                return {
                    score: row.score,
                    sec: rec ? round(rec.currentSec, 2) : null,
                    ratio: round(row.ratio, 4),
                    durationSec: rec ? round(rec.durationSec, 2) : null,
                    confidence: rec ? rec.confidence : 0,
                    source: row.source,
                    rect: formatRect(row.rect),
                    path: row.path
                };
            });
            console.table(top);
        }

        if (state.opts.durationMs > 0 && (now - state.startTs) >= state.opts.durationMs) {
            api.stop();
            console.log('[B52CD][STOP]', {
                samples: state.sampleNo,
                durationMs: now - state.startTs
            });
        }

        return best;
    }

    const state = {
        timer: null,
        startTs: 0,
        sampleNo: 0,
        byKey: new Map(),
        lockKey: '',
        best: null,
        lastRows: [],
        opts: { ...DEFAULTS }
    };

    const api = {
        start(opts) {
            this.stop();
            state.startTs = Date.now();
            state.sampleNo = 0;
            state.byKey = new Map();
            state.lockKey = '';
            state.best = null;
            state.lastRows = [];
            state.opts = Object.assign({}, DEFAULTS, opts || {});
            state.timer = window.setInterval(() => sampleOnce(state), state.opts.intervalMs);
            console.log('[B52CD][START]', state.opts);
            sampleOnce(state);
            return 'started';
        },
        stop() {
            if (state.timer) {
                clearInterval(state.timer);
                state.timer = null;
            }
            return 'stopped';
        },
        snapshot() {
            const rows = collectCandidates().slice(0, 20).map(row => ({
                score: row.score,
                ratio: round(row.ratio, 4),
                source: row.source,
                rect: formatRect(row.rect),
                path: row.path
            }));
            console.table(rows);
            return rows;
        },
        state() {
            return {
                running: !!state.timer,
                sampleNo: state.sampleNo,
                lockKey: state.lockKey,
                best: state.best ? {
                    sec: round(state.best.rec.currentSec, 2),
                    ratio: round(state.best.rec.currentRatio, 4),
                    durationSec: round(state.best.rec.durationSec, 2),
                    confidence: state.best.rec.confidence,
                    source: state.best.rec.source,
                    rect: formatRect(state.best.rec.rect),
                    path: state.best.rec.path
                } : null
            };
        }
    };

    window[PROBE_NS] = api;

    console.log('[B52CD][READY]', {
        usage: [
            '__b52CountdownProbe.snapshot()',
            '__b52CountdownProbe.start({ intervalMs: 250, durationMs: 20000, tableEvery: 8, topN: 8 })',
            '__b52CountdownProbe.state()',
            '__b52CountdownProbe.stop()'
        ]
    });
})();
