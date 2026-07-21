const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '/api';
export async function api<T>(path:string, init?:RequestInit):Promise<T>{
  const res=await fetch(`${API_BASE}${path}`,{...init,credentials:'include',headers:{'Content-Type':'application/json',...(init?.headers||{})}});
  if(res.status===401){if(typeof window!=='undefined'&&!location.pathname.startsWith('/login')) location.href='/login'; throw new Error('Chưa đăng nhập');}
  if(!res.ok){
    const text=await res.text();
    let message: string | undefined;
    try {
      const payload=JSON.parse(text) as { message?: string; title?: string };
      message=payload.message||payload.title;
    } catch {}
    throw new Error(message||text||`HTTP ${res.status}`);
  }
  if(res.status===204)return undefined as T;
  const text=await res.text();
  if(!text)return undefined as T;
  return JSON.parse(text) as T;
}
