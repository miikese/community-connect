// Loopback-only companion runner. Hosted authentication remains dispatch-owned.
import {createServer} from "node:http";
import {DatabaseSync} from "node:sqlite";
import {readFileSync,writeFileSync,existsSync,mkdirSync,readdirSync,unlinkSync} from "node:fs";
import {resolve,extname} from "node:path";
import {randomBytes} from "node:crypto";
import {handle,coordinates} from "../.local-build/service.mjs";
const port=Number(process.env.PORT||3103),state=resolve(".local-state"),assets=resolve(".local-build/client");
mkdirSync(state+"/uploads",{recursive:true});
const sqlite=new DatabaseSync(state+"/data.sqlite");sqlite.exec("PRAGMA journal_mode=WAL;CREATE TABLE IF NOT EXISTS _migrations(name TEXT PRIMARY KEY)");
for(const f of readdirSync("drizzle").filter(x=>x.endsWith(".sql")).sort()){
 if(!sqlite.prepare("SELECT name FROM _migrations WHERE name=?").get(f)){sqlite.exec("BEGIN");try{sqlite.exec(readFileSync("drizzle/"+f,"utf8"));sqlite.prepare("INSERT INTO _migrations VALUES(?)").run(f);sqlite.exec("COMMIT");}catch(e){sqlite.exec("ROLLBACK");throw e;}}
}
if(existsSync("lib/osm-seed.json"))for(const r of JSON.parse(readFileSync("lib/osm-seed.json","utf8")))sqlite.prepare("INSERT OR IGNORE INTO records(id,kind,owner,status,data,created,updated) VALUES(?,?,?,?,?,?,?)").run(r.id,r.kind,"osm-import",r.status,JSON.stringify(r.data),new Date().toISOString(),new Date().toISOString());
const db={prepare(sql){let values=[];return {bind(...args){values=args;return this;},async first(){return sqlite.prepare(sql).get(...values)||null;},async all(){return{results:sqlite.prepare(sql).all(...values)};},run(){return sqlite.prepare(sql).run(...values);}};},async batch(statements){sqlite.exec("BEGIN");try{const results=[];for(const s of statements)results.push(s.run());sqlite.exec("COMMIT");return results;}catch(e){sqlite.exec("ROLLBACK");throw e;}}};
const bucket={async put(key,bytes){writeFileSync(state+"/uploads/"+key,bytes);},async get(key){const p=state+"/uploads/"+key;return existsSync(p)?{body:new Uint8Array(readFileSync(p))}:null;},async delete(key){const p=state+"/uploads/"+key;if(existsSync(p))unlinkSync(p);}};
const sessions=new Set();
const mime={".html":"text/html",".js":"text/javascript",".css":"text/css",".svg":"image/svg+xml",".png":"image/png",".json":"application/json",".webmanifest":"application/manifest+json",".woff2":"font/woff2"};
createServer(async(req,res)=>{
 const origin="http://127.0.0.1:"+port,u=new URL(req.url,origin),host=req.headers.host||"";
 if(host!=="127.0.0.1:"+port && host!=="localhost:"+port){res.writeHead(403);res.end("Loopback access only");return;}
 try{
  if(u.pathname==="/signin-with-chatgpt"||u.pathname==="/signout-with-chatgpt"){
   if(req.headers["sec-fetch-site"]==="cross-site"){res.writeHead(403);res.end("Local sign-in requires same-origin navigation");return;}
   const token=randomBytes(32).toString("hex"),login=u.pathname==="/signin-with-chatgpt";
   if(login)sessions.add(token);else{const old=(req.headers.cookie||"").split(";").find(c=>c.trim().startsWith("local_session="))?.trim().slice(14);if(old)sessions.delete(old);}
   const target=u.searchParams.get("return_to")||"/",safe=target.startsWith("/")&&!target.startsWith("//")?target:"/";
   res.writeHead(302,{"location":safe,"set-cookie":"local_session="+(login?token:"")+"; HttpOnly; SameSite=Lax; Path=/"+(!login?"; Max-Age=0":""),"cache-control":"no-store"});res.end();return;
  }
  if(u.pathname.startsWith("/api/")){
   const token=(req.headers.cookie||"").split(";").find(c=>c.trim().startsWith("local_session="))?.trim().slice(14);
   const user=token&&sessions.has(token)?{userId:"local_seedy",displayName:"Local learner",email:"local@localhost.test"}:null;
   const headers=new Headers();for(const [k,v] of Object.entries(req.headers))if(v)headers.set(k,Array.isArray(v)?v.join(","):v);
   const method=req.method||"GET";const request=new Request(u,{method,headers,...(!["GET","HEAD"].includes(method)?{body:req,duplex:"half"}:{})});
   let response;
   if(u.pathname==="/api/directions"&&method==="GET"&&existsSync("lib/osm-seed.json")){
    try{
     const f=(u.searchParams.get("from")||"").split(",").map(Number),t=(u.searchParams.get("to")||"").split(",").map(Number);coordinates(f[0],f[1]);coordinates(t[0],t[1]);
     const r=await fetch((process.env.ROUTING_URL||"https://router.project-osrm.org")+"/route/v1/driving/"+f[1]+","+f[0]+";"+t[1]+","+t[0]+"?overview=full&geometries=geojson&steps=true",{signal:AbortSignal.timeout(12000)});
     const d=await r.json();if(!r.ok||d.code!=="Ok"||!d.routes?.length)throw new Error("No route found");
     const route=d.routes[0];response=Response.json({distance:route.distance,duration:route.duration,geometry:route.geometry,steps:route.legs.flatMap(l=>l.steps)});
    }catch{response=Response.json({error:"Routing is unavailable. Use Open directions to view a supported provider."},{status:503});}
   }else response=await handle(request,{db,user,adminIds:["local_seedy"],bucket});
   res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
  }
  const file=resolve(assets,"."+decodeURIComponent(u.pathname));
  if(file!==assets&&!file.startsWith(assets+"/")){res.writeHead(403);res.end();return;}
  const actual=u.pathname==="/"||!extname(u.pathname)?assets+"/index.html":file;
  if(!existsSync(actual)){res.writeHead(404);res.end("Not found");return;}
  res.writeHead(200,{"content-type":mime[extname(actual)]||"application/octet-stream","x-content-type-options":"nosniff","referrer-policy":"strict-origin-when-cross-origin","cache-control":extname(actual)===".html"?"no-cache":"public,max-age=300"});res.end(readFileSync(actual));
 }catch(e){console.error(e.message);res.writeHead(500,{"content-type":"application/json"});res.end(JSON.stringify({error:"Local request failed."}));}
}).listen(port,"127.0.0.1",()=>console.log("Local app: http://127.0.0.1:"+port+" — Sign in uses a development account."));
