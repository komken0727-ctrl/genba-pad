// オフライン用 Service Worker
// - 初回に asset-list.js にある全ファイルを端末に保存（電波がなくても起動・PDF取り込み・報告書作成ができる）
// - 以後は端末の保存分をすぐ返し、電波があれば裏で新しい版に入れ替える
// ファイルを追加・削除したら `node tools/build-assets.mjs` で asset-list.js を作り直すこと
importScripts("./asset-list.js");
const CACHE="genba-zumen-"+self.ASSET_VERSION;

self.addEventListener("install",e=>{
  e.waitUntil((async()=>{
    const c=await caches.open(CACHE);
    // 1つずつ入れて、どれか失敗しても全体は止めない（失敗分はあとで取り直す）
    await Promise.all(self.ASSETS.map(u=>c.add(new Request(u,{cache:"reload"})).catch(err=>console.warn("precache failed",u,err))));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate",e=>{
  e.waitUntil((async()=>{
    for(const k of await caches.keys())if(k.startsWith("genba-zumen-")&&k!==CACHE)await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch",e=>{
  const req=e.request;
  if(req.method!=="GET")return;
  const url=new URL(req.url);
  if(url.origin!==location.origin)return;
  // 画面の読み込みは常に index.html（#以降は端末側で切り替える）
  const key=req.mode==="navigate"?new URL("./index.html",self.registration.scope).href:url.origin+url.pathname;
  e.respondWith((async()=>{
    const c=await caches.open(CACHE);
    const hit=await c.match(key);
    const fresh=fetch(req.mode==="navigate"?key:req).then(res=>{if(res.ok&&res.type==="basic")c.put(key,res.clone());return res}).catch(()=>null);
    if(hit){e.waitUntil(fresh);return hit}
    const res=await fresh;
    return res||new Response("オフラインのため読み込めません",{status:503,headers:{"Content-Type":"text/plain; charset=utf-8"}});
  })());
});
