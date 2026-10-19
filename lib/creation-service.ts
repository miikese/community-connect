import type {Context} from "./service";
import {chatFail as fail, chatUUID as uuid, chatText as text} from "./chat-access";
import {validUpload} from "./upload-policy";
import {funTemplates} from "./fun-library";

export async function creationRoute(req:Request,ctx:Context,read:()=>Promise<any>,json:(v:unknown,s?:number)=>Response):Promise<Response|null> {
  const url=new URL(req.url), path=url.pathname.replace(/^\/api\//,"");
  if(path!=="social/creations"&&!path.startsWith("social/creations/"))return null;
  if(!ctx.user)return json({error:"Sign in to use your saved collection."},401);
  const owner=ctx.user.userId, db=ctx.db;
  const q=(sql:string,...args:(string|number|null)[])=>db.prepare(sql).bind(...args);
  if(path==="social/creations"&&req.method==="GET")return json({items:(await q("SELECT id,template,name,kind,created FROM saved_creations WHERE owner=? ORDER BY created DESC,id DESC LIMIT 100",owner).all()).results});
  if(path==="social/creations"&&req.method==="POST") {
    const data=await read(),template=funTemplates.find(t=>t.id===data.template);
    if(!template)return fail("Choose a meme or sticker from the library.");
    const existing=await q("SELECT id FROM saved_creations WHERE owner=? AND template=?",owner,template.id).first();
    if(existing)return json({id:existing.id},200);
    await q("INSERT INTO saved_creations(id,owner,template,name,kind,created) VALUES(?,?,?,?,?,?) ON CONFLICT(owner,template) DO NOTHING",crypto.randomUUID(),owner,template.id,template.title,template.kind,new Date().toISOString()).run();
    return json({saved:true},201);
  }
  if(path==="social/creations/upload"&&req.method==="POST") {
    if(!ctx.bucket)fail("Saved pictures are temporarily unavailable.",503);
    const name=text(url.searchParams.get("name")||"My meme",80,1),kind=url.searchParams.get("kind")==="sticker"?"sticker":"meme";
    const count=await q("SELECT COUNT(*) AS total FROM saved_creations WHERE owner=? AND template IS NULL",owner).first();
    if(count.total>=30)fail("Your collection holds 30 custom pictures. Remove one to save another.",409);
    if(req.headers.get("content-type")!=="image/png")fail("Save a PNG picture from the meme editor.",415);
    const max=2*1024*1024;
    if(Number(req.headers.get("content-length")||0)>max)fail("Choose a PNG smaller than 2 MB.",413);
    const reader=req.body?.getReader();if(!reader)return fail("Choose a picture.");
    const chunks:Uint8Array[]=[];let total=0;
    while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>max){await reader.cancel();fail("Choose a PNG smaller than 2 MB.",413)}chunks.push(value)}
    const bytes=new Uint8Array(total);let offset=0;for(const part of chunks){bytes.set(part,offset);offset+=part.length}
    if(!validUpload("image/png",bytes,"meme.png"))fail("This is not a PNG picture.",415);
    const id=crypto.randomUUID();await ctx.bucket!.put("creations/"+id,bytes);
    try {const inserted=await q("INSERT INTO saved_creations(id,owner,template,name,kind,created) SELECT ?,?,NULL,?,?,? WHERE (SELECT COUNT(*) FROM saved_creations WHERE owner=? AND template IS NULL)<30 RETURNING id",id,owner,name,kind,new Date().toISOString(),owner).first();if(!inserted)fail("Your collection is full. Remove a custom picture first.",409)}
    catch(e){await ctx.bucket!.delete("creations/"+id);throw e}
    return json({id},201);
  }
  const parts=path.split("/"), id=uuid(parts[2]);
  const row=await q("SELECT * FROM saved_creations WHERE id=? AND owner=?",id,owner).first();
  if(!row)fail("Saved picture not found.",404);
  if(parts.length===4&&parts[3]==="image"&&req.method==="GET"&&!row.template) {
    const object=await ctx.bucket?.get("creations/"+id);if(!object)return fail("Picture unavailable.",404);
    return new Response(object.body,{headers:{"content-type":"image/png","cache-control":"private, no-store","x-content-type-options":"nosniff","content-disposition":url.searchParams.has("download")?'attachment; filename="community-'+row.kind+'.png"':"inline"}});
  }
  if(parts.length===3&&req.method==="DELETE") {
    if(!row.template)await ctx.bucket?.delete("creations/"+id);
    await q("DELETE FROM saved_creations WHERE id=? AND owner=?",id,owner).run();return json({deleted:true});
  }
  return json({error:"Collection endpoint not found."},404);
}
