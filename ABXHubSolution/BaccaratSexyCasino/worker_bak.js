export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const seg = url.pathname.split('/').filter(Boolean); // ["lease",":tool",...]
    const method = request.method.toUpperCase();

    // CORS (cho tiện test)
    const cors = {
      'access-control-allow-origin': env.CORS_ORIGIN || '*',
      'access-control-allow-headers': 'content-type',
      'access-control-allow-methods': 'GET,POST,OPTIONS'
    };
    if (method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const J = (s, o) =>
      new Response(JSON.stringify(o), { status: s, headers: { ...cors, 'content-type': 'application/json' } });

    // Debug: ?echo=1
    if (url.searchParams.get('echo') === '1')
      return J(200, { pathname: url.pathname, seg, method });

    // Healthcheck
    if (seg.length === 1 && seg[0] === 'lease' && method === 'GET')
      return J(200, { ok: true, time: new Date().toISOString() });

    // Router
    if (seg.length !== 4 || seg[0] !== 'lease') return J(404, { error: 'not-found' });
    if (method !== 'POST') return J(405, { error: 'method-not-allowed' });

    const tool = seg[1].trim().toLowerCase();
    const action = seg[2]; // "trial" | "acquire" | "release"
    const username = decodeURIComponent(seg[3] || '').trim().toLowerCase();
    if (!tool || !username) return J(400, { error: 'bad-request' });

    // Chỉ cho phép tool đã khai báo
    const allowed = String(env.ALLOWED_TOOLS || '')
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(Boolean);
    if (allowed.length && !allowed.includes(tool)) return J(403, { error: 'tool-not-allowed' });

    // Body
    let body = {};
    try { body = await request.json(); } catch {}
    const clientId = String(body.clientId || '').trim();
    if (!clientId) return J(400, { error: 'bad-clientId' });

    // TTL & key
    const now = Date.now();
    const ttlMinutes = parseInt(env.LEASE_TTL_MINUTES ?? '10', 10) || 10;            // <- KHÔNG renew
    const trialMinutes = parseInt(env.TRIAL_MINUTES ?? '120', 10) || 120;            // 2h mặc định
    const staleSec = parseInt(env.STALE_GRACE_SECONDS ?? '180', 10) || 180;

    const K_TUSED = `trial_consumed:${tool}:${username}`;
    const K_TACT  = `trial_active:${tool}:${username}`;
    const K_LIC   = `license_active:${tool}:${username}`;

    const get = async k => {
      const r = await env.LEASE.get(k);
      if (!r) return null;
      try { return JSON.parse(r); } catch { return null; }
    };
    const put = (k, v, ttl) => env.LEASE.put(k, JSON.stringify(v), { expirationTtl: ttl });
    const del = k => env.LEASE.delete(k);

    // ---- TRIAL (tùy chọn) ----
    if (action === 'trial') {
      const used = await env.LEASE.get(K_TUSED);
      if (used) return J(403, { error: 'trial-consumed' });

      const active = await get(K_TACT);
      if (active) {
        // cùng client, cho resume
        if (active.clientId === clientId) return J(200, { ok: true, trial: true, trialEndsAt: active.endsAt, reused: true });
        // client khác nhưng còn “ấm”
        const last = active.lastSeenMs ?? now;
        if (now - last <= staleSec * 1000) return J(409, { error: 'in-use' });
      }

      const secs = trialMinutes * 60;
      const endsAt = new Date(now + secs * 1000).toISOString();
      await put(K_TACT, { clientId, lastSeenMs: now, endsAt }, secs);
      await env.LEASE.put(K_TUSED, '1'); // đánh dấu đã dùng thử
      return J(200, { ok: true, trial: true, trialEndsAt: endsAt });
    }

    // ---- ACQUIRE 1 lần ----
    if (action === 'acquire') {
      const active = await get(K_LIC);
      if (active) {
        if (active.clientId === clientId) {
          // cùng client gọi lại -> coi như OK (không gia hạn thêm)
          return J(200, { ok: true, reused: true });
        }
        // người khác vừa acquire
        const last = active.lastSeenMs ?? now;
        if (now - last <= staleSec * 1000) return J(409, { error: 'in-use' });
      }
      await put(K_LIC, { clientId, lastSeenMs: now }, ttlMinutes * 60);
      return J(200, { ok: true, leased: true });
    }

    // ---- RELEASE (tùy chọn) ----
    if (action === 'release') {
      const active = await get(K_LIC);
      if (!active) return J(200, { ok: true, released: false, reason: 'not-found' });
      if (active.clientId !== clientId) return J(409, { error: 'in-use' });
      await del(K_LIC);
      return J(200, { ok: true, released: true });
    }

    return J(404, { error: 'unknown-action' });
  }
};