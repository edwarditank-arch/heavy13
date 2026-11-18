import '../../../engine.js';
import { RoomError, apply, newRoom, view } from './room.mjs';
const G = globalThis.Game;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const endpoint = Deno.env.get('SUPABASE_URL') + '/rest/v1/heavy13_rooms_v1';
const headers = { apikey: serviceKey, Authorization: 'Bearer ' + serviceKey, 'Content-Type': 'application/json', Prefer: 'return=representation' };
const origin = 'https://heavy13.heahrim.com';
const responseHeaders = { 'Content-Type':'application/json', 'Cache-Control':'no-store', 'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Headers':'content-type', 'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Max-Age':'86400' };
const reply = (value,status=200) => new Response(JSON.stringify(value), {status,headers:responseHeaders});
const expiry = () => new Date(Date.now()+48*3600000).toISOString();
async function db(query,method='GET',body) {
  const res = await fetch(endpoint+'?'+query, {method,headers,body:body ? JSON.stringify(body) : undefined});
  if (res.status === 409 && method === 'POST') return [];
  if (!res.ok) { console.error('room store',method,res.status); throw new Error('database'); }
  return res.json();
}
Deno.serve(async req => {
  if(req.method==='OPTIONS') return new Response(null,{headers:responseHeaders});
  if(req.method!=='POST') return reply({error:'POST 요청이 필요합니다.'},405);
  try {
    const raw=await req.text();
    if(raw.length>2048) throw new RoomError('요청이 너무 깁니다.',413);
    let b; try { b=JSON.parse(raw); } catch { throw new RoomError('잘못된 요청입니다.'); }
    if(!b || !/^[A-HJ-NP-Z2-9]{6}$/.test(b.code) || typeof b.token!=='string' || !/^[a-f0-9]{64}$/.test(b.token)) throw new RoomError('방 코드 또는 참가 정보가 올바르지 않습니다.');
    const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(b.token));
    const identity=Array.from(new Uint8Array(hash), x=>x.toString(16).padStart(2,'0')).join('');
    const code='code=eq.'+b.code, now=new Date().toISOString();
    if(b.action==='create') {
      const payload=newRoom(b.name,identity);
      await db('expires_at=lt.'+now+'&select=code','DELETE');
      const rows=await db('select=code','POST',{code:b.code,payload,revision:1,expires_at:expiry()});
      if(rows.length) return reply(view(G,payload,0,1));
    }
    for(let attempt=0;attempt<12;attempt++) {
      const rows=await db(code+'&expires_at=gt.'+now+'&select=revision,payload');
      if(!rows.length) throw new RoomError('방을 찾을 수 없습니다. 방 코드를 확인해 주세요.',404);
      const {payload,revision}=rows[0];
      const seat=payload.seats.findIndex(p=>p.identity===identity);
      if(b.action==='create') {
        if(seat!==0 || payload.closed) throw new RoomError('방 코드가 겹쳤습니다. 다시 시도해 주세요.',409);
        return reply(view(G,payload,seat,revision));
      }
      const changed=apply(G,payload,identity,b,revision);
      if(changed) {
        const saved=await db(code+'&revision=eq.'+revision+'&select=code','PATCH',{payload,revision:revision+1,expires_at:expiry()});
        if(!saved.length) continue;
        if(b.action==='leave') return reply({left:true});
      } else if(b.action==='read' && b.revision===revision) return reply({unchanged:true});
      return reply(view(G,payload,payload.seats.findIndex(p=>p.identity===identity),revision+Number(changed)));
    }
    throw new RoomError('잠시 후 다시 시도해 주세요.',409);
  } catch(e) {
    if (e instanceof RoomError) return reply({error:e.message},e.status);
    console.error('Heavy 13 room service failed');
    return reply({error:'방 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.'},503);
  }
});