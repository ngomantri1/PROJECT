export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const seg = url.pathname.split("/").filter(Boolean); // ["lease",":tool","acquire",":user"]
    const method = request.method.toUpperCase();

    const J = (s,o)=>new Response(JSON.stringify(o),{status:s,headers:{'content-type':'application/json'}});
    if (seg.length===1 && seg[0]==='lease' && method==='GET') return J(200,{ok:true,time:new Date().toISOString()});
    if (seg.length!==4 || seg[0]!=='lease') return J(404,{error:'not-found'});

    const tool = seg[1].trim().toLowerCase();
    const action = seg[2]; // trial | acquire | heartbeat | release
    const username = decodeURIComponent(seg[3]||'').trim().toLowerCase();
    if (method!=='POST') return J(405,{error:'method-not-allowed'});
    if (!tool || !username) return J(400,{error:'bad-request'});

    // kiểm tra tool hợp lệ
    const allowed = String(env.ALLOWED_TOOLS||"").split(",").map(s=>s.trim().toLowerCase()).filter(Boolean);
    if (allowed.length && !allowed.includes(tool)) return J(403,{error:'tool-not-allowed'});

    let body={}; try { body=await request.json(); } catch {}
    const clientId = String(body.clientId||"").trim();
    if (!clientId) return J(400,{error:'bad-clientId'});

    const now=Date.now();
    const ttlMins  = parseInt(env.LEASE_TTL_MINUTES ?? '10',10)||10;
    const trialMin = parseInt(env.TRIAL_MINUTES ?? '5',10)||5;
    const hbSecs   = parseInt(env.HEARTBEAT_SECONDS ?? '60',10)||60;
    const staleSec = parseInt(env.STALE_GRACE_SECONDS??'180',10)||180;

    // KV keys theo tool
    const K_TUSED = `trial_consumed:${tool}:${username}`;
    const K_TACT  = `trial_active:${tool}:${username}`;
    const K_LIC   = `license_active:${tool}:${username}`;

    const get = async k => { const r=await env.LEASE.get(k); if(!r) return null; try{return JSON.parse(r);}catch{return null;} };
    const put = (k,v,ttl)=>env.LEASE.put(k,JSON.stringify(v),{expirationTtl:ttl});
    const del = (k)=>env.LEASE.delete(k);

    if (action==='trial') {
      const used = await env.LEASE.get(K_TUSED);
      if (used) return J(403,{error:'trial-consumed'});

      const active = await get(K_TACT);
      if (active) {
        if (active.clientId===clientId) return J(200,{ok:true,trial:true,trialEndsAt:active.endsAt,reused:true});
        const last = active.lastSeenMs ?? now;
        if (now-last <= staleSec*1000) return J(409,{error:'in-use'});
      }
      const secs = trialMin*60;
      const endsAt = new Date(now+secs*1000).toISOString();
      await put(K_TACT,{clientId,lastSeenMs:now,endsAt},secs);
      await env.LEASE.put(K_TUSED,'1'); // đánh dấu đã dùng thử
      return J(200,{ok:true,trial:true,trialEndsAt:endsAt});
    }

    if (action==='acquire') {
      const active = await get(K_LIC);
      if (active) {
        if (active.clientId===clientId) {
          await put(K_LIC,{...active,lastSeenMs:now},ttlMins*60);
          return J(200,{ok:true,reused:true});
        }
        const last = active.lastSeenMs ?? now;
        if (now-last <= staleSec*1000) return J(409,{error:'in-use'});
      }
      await put(K_LIC,{clientId,lastSeenMs:now},ttlMins*60);
      return J(200,{ok:true,leased:true});
    }

    if (action==='heartbeat') {
      const active = await get(K_LIC);
      if (!active) return J(404,{error:'not-active'});
      if (active.clientId!==clientId) return J(409,{error:'in-use'});
      await put(K_LIC,{...active,lastSeenMs:now},ttlMins*60);
      return J(200,{ok:true,renewed:true,nextIn:hbSecs});
    }

    if (action==='release') {
      const active = await get(K_LIC);
      if (!active) return J(200,{ok:true,released:false,reason:'not-found'});
      if (active.clientId!==clientId) return J(409,{error:'in-use'});
      await del(K_LIC);
      return J(200,{ok:true,released:true});
    }

    return J(404,{error:'unknown-action'});
  }
};
