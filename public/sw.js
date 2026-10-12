const CACHE="community-shell-v1";
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(["/","/favicon.svg","/manifest.webmanifest"]))));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener("fetch",event=>{
 const u=new URL(event.request.url),r=event.request;
 if(u.origin!==self.location.origin||r.method!=="GET"||u.pathname.startsWith("/api/")||u.pathname.includes("signin")||u.pathname.includes("signout")||u.pathname.includes("callback"))return;
 const shell=r.mode==="navigate"&&u.pathname==="/";
 const asset=u.pathname.startsWith("/assets/")||u.pathname.startsWith("/_next/static/")||["/favicon.svg","/manifest.webmanifest"].includes(u.pathname);
 if(!shell&&!asset)return;
 event.respondWith(fetch(r).then(response=>{if(response.ok)caches.open(CACHE).then(c=>c.put(shell?"/":r,response.clone()));return response}).catch(()=>caches.match(shell?"/":r)));
});
