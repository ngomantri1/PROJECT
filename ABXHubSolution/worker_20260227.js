export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const seg = url.pathname.split('/').filter(Boolean); // ["lease", ":tool", ":action", ":username"]
    const method = request.method.toUpperCase();

    const cors = {
      'access-control-allow-origin': env.CORS_ORIGIN || '*',
      'access-control-allow-headers': 'content-type',
      'access-control-allow-methods': 'GET,POST,OPTIONS'
    };

    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    const J = (status, payload) =>
      new Response(JSON.stringify(payload), {
        status,
        headers: { ...cors, 'content-type': 'application/json' }
      });

    // Debug: /lease?echo=1
    if (url.searchParams.get('echo') === '1') {
      return J(200, { pathname: url.pathname, seg, method });
    }

    // Healthcheck: GET /lease
    if (seg.length === 1 && seg[0] === 'lease' && method === 'GET') {
      return J(200, { ok: true, time: new Date().toISOString() });
    }

    // Router: POST /lease/:tool/:action/:username
    if (seg.length !== 4 || seg[0] !== 'lease') return J(404, { error: 'not-found' });
    if (method !== 'POST') return J(405, { error: 'method-not-allowed' });

    const tool = seg[1].trim().toLowerCase();
    const action = seg[2].trim().toLowerCase(); // trial | acquire | heartbeat | release
    const username = decodeURIComponent(seg[3] || '').trim().toLowerCase();
    if (!tool || !username) return J(400, { error: 'bad-request' });

    // Optional allow-list by tool
    const allowed = String(env.ALLOWED_TOOLS || '')
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(Boolean);
    if (allowed.length && !allowed.includes(tool)) {
      return J(403, { error: 'tool-not-allowed' });
    }

    // Request body
    let body = {};
    try { body = await request.json(); } catch {}

    const clientId = String(body.clientId || '').trim();
    if (!clientId) return J(400, { error: 'bad-clientId' });

    // Device lock identity:
    // prefer deviceId from client, fallback to clientId for backward compatibility.
    const deviceId = String(body.deviceId || body.clientId || '').trim().toLowerCase();
    if (!deviceId) return J(400, { error: 'bad-deviceId' });

    const appId = String(body.appId || '').trim().toLowerCase();
    const sessionIdRaw = String(body.sessionId || '').trim();
    const sid = (sessionIdRaw || `client:${clientId}`).toLowerCase();
    const hasSession = !!sessionIdRaw;

    const now = Date.now();
    const serverDay = new Date(now).toISOString().slice(0, 10).replace(/-/g, '');
    const ttlMinutes = parseInt(env.LEASE_TTL_MINUTES ?? '10', 10) || 10;
    const trialMinutes = parseInt(env.TRIAL_MINUTES ?? '30', 10) || 30;
    const staleSec = parseInt(env.STALE_GRACE_SECONDS ?? '180', 10) || 180;

    // Trial keys are global per device + server day across all apps/tools.
    const K_TUSED = `trial_consumed_global:${deviceId}:${serverDay}`;
    const K_TACT = `trial_active_global:${deviceId}:${serverDay}`;

    // License key is global by username (shared across all tools)
    const K_LIC_GLOBAL = `license_active_global:${username}`;

    const get = async (k) => {
      const raw = await env.LEASE.get(k);
      if (!raw) return null;
      try { return JSON.parse(raw); } catch { return null; }
    };
    const put = (k, v, ttlSec) =>
      env.LEASE.put(k, JSON.stringify(v), { expirationTtl: ttlSec });
    const del = (k) => env.LEASE.delete(k);

    const ownerDeviceOf = (rec) =>
      String(rec?.deviceId || rec?.clientId || '').trim().toLowerCase();
    const isFresh = (rec) => {
      const lastSeen = rec?.lastSeenMs ?? 0;
      return (now - lastSeen) <= staleSec * 1000;
    };
    const ensureSessions = (rec) => {
      if (!rec.sessions || typeof rec.sessions !== 'object' || Array.isArray(rec.sessions)) {
        rec.sessions = {};
      }
      return rec.sessions;
    };
    const upsertSession = (rec) => {
      const sessions = ensureSessions(rec);
      const prev = sessions[sid] || {};
      sessions[sid] = {
        clientId,
        deviceId,
        appId,
        sessionId: sid,
        createdAt: prev.createdAt || now,
        lastSeenMs: now
      };
    };

    // ===== TRIAL =====
    if (action === 'trial') {
      const active = await get(K_TACT);
      if (active) {
        const ownerDevice = ownerDeviceOf(active);
        if (!ownerDevice || ownerDevice === deviceId) {
          active.clientId = clientId;
          active.deviceId = deviceId;
          active.appId = appId;
          active.lastSeenMs = now;
          if (hasSession) active.sessionId = sessionIdRaw;

          let remainSec = trialMinutes * 60;
          if (active.endsAt) {
            const endMs = Date.parse(active.endsAt);
            if (!Number.isNaN(endMs)) {
              remainSec = Math.max(1, Math.floor((endMs - now) / 1000));
            }
          }

          await put(K_TACT, active, remainSec);
          return J(200, { ok: true, trial: true, trialEndsAt: active.endsAt, reused: true });
        }

        const lastSeen = active.lastSeenMs ?? now;
        if (now - lastSeen <= staleSec * 1000) return J(409, { error: 'in-use' });
      }

      const used = await env.LEASE.get(K_TUSED);
      if (used) return J(403, { error: 'trial-consumed' });

      const trialSec = trialMinutes * 60;
      const endsAt = new Date(now + trialSec * 1000).toISOString();
      await put(K_TACT, { clientId, deviceId, appId, sessionId: sessionIdRaw, lastSeenMs: now, endsAt }, trialSec);
      await env.LEASE.put(K_TUSED, '1', { expirationTtl: 3 * 24 * 60 * 60 });
      return J(200, { ok: true, trial: true, trialEndsAt: endsAt });
    }

    // ===== ACQUIRE =====
    if (action === 'acquire') {
      let active = await get(K_LIC_GLOBAL);
      const ownerDevice = ownerDeviceOf(active);

      if (active && ownerDevice && ownerDevice !== deviceId && isFresh(active)) {
        return J(409, { error: 'in-use', ownerDeviceId: ownerDevice });
      }

      const sameDeviceReuse = !!(active && ownerDevice && ownerDevice === deviceId);
      if (!active || !sameDeviceReuse) {
        active = { deviceId, lastSeenMs: now, sessions: {} };
      }

      active.deviceId = deviceId;
      active.lastSeenMs = now;
      upsertSession(active);

      await put(K_LIC_GLOBAL, active, ttlMinutes * 60);
      if (sameDeviceReuse) return J(200, { ok: true, reused: true });
      return J(200, { ok: true, leased: true });
    }

    // ===== HEARTBEAT =====
    if (action === 'heartbeat') {
      const active = await get(K_LIC_GLOBAL);
      if (active) {
        const ownerDevice = ownerDeviceOf(active);
        if (ownerDevice && ownerDevice !== deviceId) {
          return J(409, { error: 'in-use', ownerDeviceId: ownerDevice });
        }

        active.deviceId = deviceId;
        active.lastSeenMs = now;
        upsertSession(active);
        await put(K_LIC_GLOBAL, active, ttlMinutes * 60);
        return J(200, { ok: true, leased: true });
      }

      // Backward-compatible fallback for trial heartbeat
      const trialActive = await get(K_TACT);
      if (trialActive) {
        const ownerDevice = ownerDeviceOf(trialActive);
        if (ownerDevice && ownerDevice !== deviceId) {
          return J(409, { error: 'in-use', ownerDeviceId: ownerDevice });
        }

        trialActive.clientId = clientId;
        trialActive.deviceId = deviceId;
        trialActive.appId = appId;
        trialActive.lastSeenMs = now;
        if (hasSession) trialActive.sessionId = sessionIdRaw;

        let remainSec = trialMinutes * 60;
        if (trialActive.endsAt) {
          const endMs = Date.parse(trialActive.endsAt);
          if (!Number.isNaN(endMs)) {
            remainSec = Math.max(1, Math.floor((endMs - now) / 1000));
          }
        }

        await put(K_TACT, trialActive, remainSec);
        return J(200, { ok: true, trial: true, trialEndsAt: trialActive.endsAt });
      }

      return J(200, { ok: true, leased: false, reason: 'not-found' });
    }

    // ===== RELEASE =====
    if (action === 'release') {
      const active = await get(K_LIC_GLOBAL);
      if (!active) return J(200, { ok: true, released: false, reason: 'not-found' });

      const ownerDevice = ownerDeviceOf(active);
      if (ownerDevice && ownerDevice !== deviceId) {
        return J(409, { error: 'in-use', ownerDeviceId: ownerDevice });
      }

      const sessions = ensureSessions(active);
      delete sessions[sid];
      const remain = Object.keys(sessions).length;

      if (remain > 0) {
        active.lastSeenMs = now;
        await put(K_LIC_GLOBAL, active, ttlMinutes * 60);
        return J(200, { ok: true, released: true, remainSessions: remain });
      }

      await del(K_LIC_GLOBAL);
      return J(200, { ok: true, released: true, remainSessions: 0 });
    }

    return J(404, { error: 'unknown-action' });
  }
};
