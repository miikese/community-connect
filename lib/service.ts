import {ensureSocialIdentity} from "./social-identity";
import {chatRoute} from "./chat-service";
import {groupCallRoute} from "./group-call-service";
import {accountAuth,accountSession,type OwnerSettings} from "./account-auth";
import {socialRoute} from "./social-service";
import {communityRoute} from "./communities";
import {translate,type TranslationOptions} from "./translation";
import * as domain from "./domain";
export type Identity = {userId:string;displayName:string;email?:string;passwordAccount?:boolean}|null;
export type Stored = {id:string;kind:string;owner:string;status:string;data:string;created:string;updated:string};
type BindValue = string|number|null;
export type DB = {prepare(sql:string):{bind(...values:BindValue[]):any;first<T=any>():Promise<T|null>;all<T=any>():Promise<{results:T[]}>;run():Promise<any>};batch(statements:any[]):Promise<any>};
export type Context = {db:DB;user:Identity;adminIds:string[];adminEmails?:string[];bucket?:R2Bucket;owner?:OwnerSettings;translation?:TranslationOptions;rtc?:{urls?:string;secret?:string};seed?:{id:string;kind:string;status:string;data:Record<string,unknown>}[]};
export function json(value:unknown,status=200) {
 return new Response(JSON.stringify(value),{status,headers:{"content-type":"application/json","cache-control":"no-store","x-content-type-options":"nosniff","referrer-policy":"strict-origin-when-cross-origin"}});
}
function error(message:string,status=400):never { throw Object.assign(new Error(message),{status});}
async function boundedBytes(req:Request,max:number) {
 if(Number(req.headers.get("content-length")||0)>max)error("Submission too large.",413);
 const reader=req.body?.getReader();if(!reader)return new Uint8Array();const chunks:Uint8Array[]=[];let total=0;
 while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>max){await reader.cancel();error("Submission too large.",413);}chunks.push(value);}
 const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return bytes;
}
async function body(req:Request,max=12000) {
 if(!req.headers.get("content-type")?.startsWith("application/json")) error("Send JSON.",415);
 const raw=new TextDecoder().decode(await boundedBytes(req,max));
 try {const d=JSON.parse(raw);if(!d || Array.isArray(d) || typeof d!=="object") error("Invalid object.");return d;}catch{error("Invalid JSON.");}
}
export function serialize(row:Stored,privateView=false) {
 const {owner,...safe}=row;
 return {...safe,...(privateView?{owner}:{}),data:JSON.parse(row.data)};
}
export async function handle(req:Request,ctx:Context):Promise<Response> {
 const {db}=ctx,user=await accountSession(req,db,ctx.owner)||ctx.user,url=new URL(req.url),path=url.pathname.replace(/^\/api\/?/,""),now=new Date().toISOString();
 const id=()=>crypto.randomUUID();
 const stmt=(sql:string,...args:BindValue[])=>db.prepare(sql).bind(...args);
 const all=async(sql:string,...args:BindValue[])=>(await stmt(sql,...args).all()).results;
 const signed=()=>{if(!user)error("Sign in to continue.",401);return user!;};
 const admin=async()=>{const u=signed();const r=await stmt("SELECT role FROM users WHERE id=?",u.userId).first();if(!ctx.adminIds.includes(u.userId)&&!(!u.passwordAccount&&u.email&&ctx.adminEmails?.includes(u.email.toLowerCase()))&&r?.role!=="admin"&&r?.role!=="moderator"&&r?.role!=="super-admin")error("Moderator access required.",403);return u;};
 try {
  if(user)await ensureSocialIdentity(db,user);
  if(path.startsWith("auth/")&&req.method==="POST"){
   if((req.headers.get("origin")&&req.headers.get("origin")!==url.origin)||req.headers.get("sec-fetch-site")==="cross-site")error("Cross-origin authentication is not allowed.",403);
   return await accountAuth(req,db,path,path==="auth/logout"?{}:await body(req),ctx.owner);
  }
  if(path==="auth/status"&&req.method==="GET")return json({user});
  if(path==="translate" && req.method==="POST") {
   if(req.headers.get("origin") && req.headers.get("origin")!==url.origin)error("Cross-origin writes are not allowed.",403);
   const key="translation:"+Math.floor(Date.now()/60000),limit=await stmt("INSERT INTO limits(id,count) VALUES(?,1) ON CONFLICT(id) DO UPDATE SET count=count+1 RETURNING count",key).first();
   if(limit.count>12)error("Translation is busy. Please try again in a minute.",429);
   const d=await body(req);return json(await translate(d.text,d.source,d.target,db,ctx.translation));
  }
  if(req.method!=="GET" && req.method!=="HEAD") {
   const origin=req.headers.get("origin");
   if(origin && origin!==url.origin) error("Cross-origin writes are not allowed.",403);
   signed();
   const chat=["social/messages","social/group-messages","social/group-signals","social/group-calls"].includes(path);
   const key=user!.userId+(chat?":chat:":":")+Math.floor(Date.now()/60000);
   const limit=await stmt("INSERT INTO limits(id,count) VALUES(?,1) ON CONFLICT(id) DO UPDATE SET count=count+1 RETURNING count",key).first();
   if(limit.count>(chat?120:35))error("Please wait a minute before trying again.",429);
   if(Math.random()<0.02) await stmt("DELETE FROM limits WHERE id NOT LIKE ?", "%:"+Math.floor(Date.now()/60000)).run();
  }
  const chatResponse=await chatRoute(req,{...ctx,user},()=>body(req,70000),json);if(chatResponse)return chatResponse;
  const groupResponse=await groupCallRoute(req,{...ctx,user},()=>body(req,70000),json);if(groupResponse)return groupResponse;
  const social=await socialRoute(req,{...ctx,user},()=>body(req,70000),json);if(social)return social;
  const communityResponse=await communityRoute(req,{...ctx,user},()=>body(req),json);if(communityResponse)return communityResponse;
  if(path==="seed" && req.method==="POST") {
   await admin();const seed=ctx.seed||[];if(seed.length)await db.batch(seed.map(r=>stmt("INSERT OR IGNORE INTO records(id,kind,owner,status,data,created,updated) VALUES(?,?,?,?,?,?,?)",r.id,r.kind,"osm-import",r.status,JSON.stringify(r.data),now,now)));return json({imported:seed.length});
  }
  if(path==="me" && req.method==="GET") {
   if(!user)return json({user:null});
   await stmt("INSERT INTO users(id,name,role) VALUES(?,?,'member') ON CONFLICT(id) DO UPDATE SET name=excluded.name",user.userId,user.displayName).run();
   const u=await stmt("SELECT * FROM users WHERE id=?",user.userId).first();
   return json({user:{id:user.userId,name:user.displayName,username:(await db.prepare("SELECT handle FROM social_profiles WHERE user_id=?").bind(user.userId).first())?.handle,role:(ctx.adminIds.includes(user.userId)||(!user.passwordAccount&&user.email&&ctx.adminEmails?.includes(user.email.toLowerCase())))?"super-admin":u.role},notifications:await all("SELECT * FROM notifications WHERE owner=? ORDER BY created DESC LIMIT 50",user.userId)});
  }
  if(path==="records" && req.method==="GET") {
   const kind=url.searchParams.get("kind")||"",mine=url.searchParams.get("mine")==="1",review=url.searchParams.get("review")==="1";
   if(mine)signed();if(review)await admin();
   // Filter privacy and listing type before limiting: pending reports cannot
   // crowd approved public records or another resident's own submissions out.
   const clauses:string[]=[],args:BindValue[]=[];
   if(mine){clauses.push("owner=?");args.push(user!.userId);}
   else if(!review){
    clauses.push("kind IN ("+domain.publicKinds.map(()=>"?").join(",")+")","status IN ("+domain.publicStatuses.map(()=>"?").join(",")+")");
    args.push(...domain.publicKinds,...domain.publicStatuses);
   }
   if(kind){clauses.push("kind=?");args.push(kind);}
   let rows:Stored[]=await all("SELECT * FROM records"+(clauses.length?" WHERE "+clauses.join(" AND "):"")+" ORDER BY created DESC LIMIT 1000",...args);
   if(!review) rows=rows.filter(r=>mine?r.owner===user!.userId:domain.publicKinds.includes(r.kind)&&domain.publicStatuses.includes(r.status));
   if(kind)rows=rows.filter(r=>r.kind===kind);
   const counts=rows.reduce((a:Record<string,number>,r)=>({...a,[r.status]:(a[r.status]||0)+1}),{});
   return json({records:rows.map(r=>serialize(r,mine||review)),counts});
  }
  if(path==="records" && req.method==="POST") {
   const u=signed(),d=await body(req),kind=String(d.kind),data=domain.validate(kind,d.data||{}),record=id(),status=domain.initialStatus(kind);
   if(kind==="opportunity"){const org=await stmt("SELECT id,data FROM records WHERE id=? AND owner=? AND kind='organization' AND status='approved'",String(data.organization),u.userId).first();if(!org)error("An approved organization you manage is required.",403);data.organizationName=JSON.parse(org.data).title;}
   if(data.photo && !await stmt("SELECT id FROM uploads WHERE id=? AND owner=?",String(data.photo),u.userId).first())error("Invalid photo.");
   await db.batch([
    stmt("INSERT INTO records(id,kind,owner,status,data,created,updated) VALUES(?,?,?,?,?,?,?)",record,kind,u.userId,status,JSON.stringify(data),now,now),
    stmt("INSERT INTO audit(id,record,actor,status,note,created) VALUES(?,?,?,?,?,?)",id(),record,u.userId,status,"Submitted for review",now)
   ]);
   return json({id:record,status},201);
  }
  if(path.startsWith("records/")) {
   const record=decodeURIComponent(path.split("/")[1]),row:Stored|null=await stmt("SELECT * FROM records WHERE id=?",record).first();
   if(!row)error("Record not found.",404);
   const isPublic=domain.publicKinds.includes(row.kind)&&domain.publicStatuses.includes(row.status);
   let privileged=false;
   if(user && row.owner!==user.userId && !isPublic){await admin();privileged=true;}
   if(!isPublic && row.owner!==user?.userId && !privileged)error("Record not found.",404);
   if(req.method==="GET") {
    const history=await all("SELECT status,note,created FROM audit WHERE record=? ORDER BY created",record);
    return json({record:serialize(row,row.owner===user?.userId||privileged),history});
   }
   if(req.method==="PATCH") {
    const u=await admin(),d=await body(req),status=String(d.status),note=domain.text(d.note,"Review note",10,1200);
    if(!domain.canTransition(row.kind,row.status,status))error("This status transition is not allowed.",409);
    const r=await stmt("UPDATE records SET status=?,updated=? WHERE id=? AND status=? RETURNING id",status,now,record,row.status).first();
    if(!r)error("The record changed. Refresh before reviewing.",409);
    await db.batch([
      stmt("INSERT INTO audit(id,record,actor,status,note,created) VALUES(?,?,?,?,?,?)",id(),record,u.userId,status,note,now),
      stmt("INSERT INTO notifications(id,owner,message,created) VALUES(?,?,?,?)",id(),row.owner,"Your "+row.kind+" is now "+status+": "+note,now)
    ]);
    const followers=await all("SELECT DISTINCT owner FROM actions WHERE record=? AND type='follow'",record);
    if(followers.length)await db.batch(followers.map((f:any)=>stmt("INSERT INTO notifications(id,owner,message,created) VALUES(?,?,?,?)",id(),f.owner,"An issue you follow is now "+status+": "+note,now)));
    return json({status});
   }
   if(req.method==="DELETE") {
    const u=signed();if(row.owner!==u.userId)await admin();
    await db.batch([stmt("DELETE FROM records WHERE id=?",record),stmt("DELETE FROM actions WHERE record=?",record),stmt("DELETE FROM audit WHERE record=?",record)]);
    return json({deleted:true});
   }
  }
  if(path==="actions" && req.method==="GET")return json({actions:await all("SELECT * FROM actions WHERE owner=? ORDER BY created DESC",signed().userId)});
  if(path==="actions" && req.method==="POST") {
   const u=signed(),d=await body(req),record=String(d.record),type=String(d.type);
   if(!["favorite","follow","join","flag","contact"].includes(type))error("Invalid action.");
   const row:Stored|null=await stmt("SELECT * FROM records WHERE id=?",record).first();
   if(!row || !domain.publicKinds.includes(row.kind) || !domain.publicStatuses.includes(row.status))error("Public record not found.",404);
   if(type==="join"&&(row.kind!=="opportunity"||!domain.isJoinable(JSON.parse(row.data))))error("This opportunity is not open for volunteer registration.");
   if(type==="contact"&&!["lost","skill","assistance"].includes(row.kind))error("Contact requests are only available for coordination listings.");
   const key=u.userId+":"+record+":"+type;
   if(d.remove)await stmt("DELETE FROM actions WHERE id=? AND owner=?",key,u.userId).run();
   else {const inserted=await stmt("INSERT INTO actions(id,owner,record,type,data,created) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING RETURNING id",key,u.userId,record,type,JSON.stringify({note:String(d.note||"").slice(0,1000)}),now).first();if(inserted&&["join","contact"].includes(type))await stmt("INSERT INTO notifications(id,owner,message,created) VALUES(?,?,?,?)",id(),row.owner,type==="join"?"A member joined your approved activity.":"A private coordination request is available in My activity.",now).run();}
   return json({saved:!d.remove});
  }
  if(path==="flags"&&req.method==="GET"){await admin();return json({flags:await all("SELECT actions.id,actions.record,actions.data,actions.created,records.data AS listing FROM actions JOIN records ON records.id=actions.record WHERE actions.type='flag' ORDER BY actions.created DESC")});}
  if(path==="participants" && req.method==="GET") {
   const u=signed();let broad=false;try{await admin();broad=true;}catch{}
   return json({participants:await all("SELECT actions.record,users.name,actions.created FROM actions LEFT JOIN users ON users.id=actions.owner JOIN records ON records.id=actions.record WHERE actions.type='join'"+(broad?"":" AND records.owner=?")+" ORDER BY actions.created DESC",...(broad?[]:[u.userId]))});
  }
  if(path==="contacts"&&req.method==="GET"){return json({requests:await all("SELECT actions.id,actions.record,actions.data,actions.created,users.name FROM actions JOIN records ON records.id=actions.record LEFT JOIN users ON users.id=actions.owner WHERE actions.type='contact' AND records.owner=? ORDER BY actions.created DESC",signed().userId)});}
  if(path==="notifications" && req.method==="POST"){await stmt("UPDATE notifications SET read=1 WHERE owner=?",signed().userId).run();return json({read:true});}
  if(path==="account" && req.method==="DELETE") {
   const u=signed();if(await stmt("SELECT id FROM communities WHERE owner=?",u.userId).first())error("Transfer ownership or delete your workspaces before deleting your account.",409);

   const notes=await all("SELECT id FROM social_media WHERE owner=?",u.userId);if(ctx.bucket)await Promise.all(notes.map((p:any)=>ctx.bucket!.delete("notes/"+p.id)));
   const photos=await all("SELECT id FROM uploads WHERE owner=?",u.userId);
   if(ctx.bucket)await Promise.all(photos.map((p:any)=>ctx.bucket!.delete(p.id)));
   await db.batch([
    stmt("DELETE FROM community_admins WHERE user=?",u.userId),stmt("DELETE FROM account_sessions WHERE user_id=?",u.userId),stmt("DELETE FROM credentials WHERE user_id=?",u.userId),
    stmt("DELETE FROM audit WHERE record IN (SELECT id FROM records WHERE owner=?)",u.userId),
    stmt("DELETE FROM actions WHERE record IN (SELECT id FROM records WHERE owner=?)",u.userId),
    stmt("DELETE FROM records WHERE owner=?",u.userId),stmt("DELETE FROM actions WHERE owner=?",u.userId),
    stmt("DELETE FROM notifications WHERE owner=?",u.userId),stmt("DELETE FROM uploads WHERE owner=?",u.userId),stmt("DELETE FROM users WHERE id=?",u.userId),
    stmt("UPDATE audit SET actor='deleted-user' WHERE actor=?",u.userId)
   ]);return json({deleted:true});
  }
  if(path==="upload" && req.method==="POST") {
   if(!ctx.bucket)error("Photo storage is unavailable.",503);
   const u=signed(),bytes=await boundedBytes(req,2*1024*1024),mime=req.headers.get("content-type")||"";
   if(bytes.length>2*1024*1024 || bytes.length<12)error("Upload a JPEG, PNG, or WebP under 2 MB.");
   const good=(mime==="image/jpeg"&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255) ||
    (mime==="image/png"&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v)) ||
    (mime==="image/webp"&&new TextDecoder().decode(bytes.slice(0,4))==="RIFF"&&new TextDecoder().decode(bytes.slice(8,12))==="WEBP");
   if(!good)error("Unsupported image format.");
   const key=id();await ctx.bucket!.put(key,bytes,{httpMetadata:{contentType:mime}});
   await stmt("INSERT INTO uploads(id,owner,mime,created) VALUES(?,?,?,?)",key,u.userId,mime,now).run();
   return json({id:key},201);
  }
  if(path.startsWith("photo/") && req.method==="GET") {
   const key=path.split("/")[1],photo=await stmt("SELECT * FROM uploads WHERE id=?",key).first();if(!photo||!ctx.bucket)error("Photo not found.",404);
   const rows:Stored[]=await all("SELECT * FROM records WHERE json_extract(data,'$.photo')=?",key);
   if(photo.owner!==user?.userId && !rows.some(r=>domain.publicKinds.includes(r.kind)&&domain.publicStatuses.includes(r.status)))await admin();
   const object=await ctx.bucket!.get(key);if(!object)error("Photo not found.",404);
   return new Response(object.body,{headers:{"content-type":photo.mime,"x-content-type-options":"nosniff","content-security-policy":"default-src 'none'","cache-control":"private,max-age=300"}});
  }
  if(path==="health" && req.method==="GET"){await stmt("SELECT 1").first();return json({status:"ok",database:"connected"});}
  return json({error:"Endpoint not found."},404);
 }catch(e) {
  const err=e as Error & {status?:number};
  if(/community_name_lga/i.test(err.message))return json({error:"This workspace name is already registered in this LGA."},409);
  if(/UNIQUE.*credentials/i.test(err.message))return json({error:"Unable to register this email. Try signing in instead."},409);
  if(!err.status && /SQLITE|D1_|database|no such table/i.test(err.message)){console.error("Database request failed",err.message);return json({error:"Service temporarily unavailable."},503);}
  return json({error:err.message||"Request failed."},err.status||400);
 }
}
