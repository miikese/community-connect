import {beforeEach,afterEach,it,expect} from "vitest";
import {database} from "./database";
import {handle,type Context} from "../lib/service";
import {funTemplates} from "../lib/fun-library";
let db:ReturnType<typeof database>,ctx:Context,files:Map<string,Uint8Array>;
const base="https://example.test/api/social/creations",png=new Uint8Array([137,80,78,71,13,10,26,10,...Array(64).fill(0)]);
async function call(who:string|null,path="",method="GET",data?:unknown){ctx.user=who?{userId:who,displayName:who}:null;return handle(new Request(base+path,{method,headers:{"content-type":"application/json"},...(data?{body:JSON.stringify(data)}:{})}),ctx)}
async function upload(who:string,bytes:Uint8Array=png,mime="image/png"){ctx.user={userId:who,displayName:who};return handle(new Request(base+"/upload?name=My%20meme&kind=meme",{method:"POST",headers:{"content-type":mime},body:new Uint8Array(bytes).buffer}),ctx)}
beforeEach(()=>{db=database();files=new Map();ctx={db,user:null,adminIds:[],bucket:{async put(k:string,b:Uint8Array){files.set(k,b)},async get(k:string){return files.has(k)?{body:files.get(k)}:null},async delete(k:string){files.delete(k)}} as unknown as R2Bucket}});afterEach(()=>db.close());
it("saves original meme and sticker templates once per account and isolates collections",async()=>{
  for(const template of ["group-plan","no-wahala"]){expect((await call("alice","","POST",{template})).status).toBe(201);expect((await call("alice","","POST",{template})).status).toBe(200)}
  const {items}=await(await call("alice")).json() as any;expect(items).toHaveLength(2);expect(items.map((x:any)=>x.kind).sort()).toEqual(["meme","sticker"]);expect((await(await call("bob")).json() as any).items).toHaveLength(0);expect((await call(null)).status).toBe(401);expect((await call("alice","","POST",{template:"not-real"})).status).toBe(400);expect(new Set(funTemplates.map(x=>x.id)).size).toBe(funTemplates.length);
});
it("keeps custom pictures private, downloads safe PNGs, and deletes owned files",async()=>{
  const uploaded=await upload("alice");expect(uploaded.status).toBe(201);const {id}=await uploaded.json() as any;
  expect((await call("bob","/"+id+"/image")).status).toBe(404);expect((await call(null,"/"+id+"/image")).status).toBe(401);
  const image=await call("alice","/"+id+"/image?download=1");expect(image.status).toBe(200);expect(image.headers.get("content-disposition")).toContain("attachment;");expect(image.headers.get("cache-control")).toBe("private, no-store");expect(new Uint8Array(await image.arrayBuffer())).toEqual(png);
  expect((await call("bob","/"+id,"DELETE")).status).toBe(404);expect((await call("alice","/"+id,"DELETE")).status).toBe(200);expect(files.size).toBe(0);expect((await call("alice","/"+id+"/image")).status).toBe(404);
});
it("rejects non-PNG content, oversized files, cross-origin writes and invalid IDs",async()=>{
  expect((await upload("alice",new TextEncoder().encode("<svg onload=alert(1)>"))).status).toBe(415);expect((await upload("alice",png,"image/svg+xml")).status).toBe(415);expect((await upload("alice",new Uint8Array(2*1024*1024+1))).status).toBe(413);expect((await call("alice","/bad-id","DELETE")).status).toBe(400);
  const denied=await handle(new Request(base,{method:"POST",headers:{"content-type":"application/json",origin:"https://other.test"},body:JSON.stringify({template:"group-plan"})}),ctx);expect(denied.status).toBe(403);
});
it("bounds custom-picture storage and removes files when the account is deleted",async()=>{
  const r=await upload("alice");expect(r.status).toBe(201);
  for(let i=0;i<29;i++)await db.prepare("INSERT INTO saved_creations(id,owner,template,name,kind,created)VALUES(?,?,NULL,'fixture','meme',?)").bind(crypto.randomUUID(),"alice",new Date().toISOString()).run();
  expect((await upload("alice")).status).toBe(409);expect(files.size).toBe(1);
  const response=await handle(new Request("https://example.test/api/account",{method:"DELETE"}),ctx);expect(response.status).toBe(200);expect(files.size).toBe(0);expect((await db.prepare("SELECT COUNT(*) AS n FROM saved_creations").first())?.n).toBe(0);
});
