import type {Context} from "./service";
import {chatFail as fail,chatText as text,chatUUID as uuid,requireFriend,requireGroup} from "./chat-access";
const MAX_NOTE=12*1024*1024;
export async function chatRoute(req:Request,ctx:Context,read:()=>Promise<any>,json:(v:unknown,s?:number)=>Response):Promise<Response|null>{
 const url=new URL(req.url),path=url.pathname.replace(/^\/api\//,"");
 if(!["social/groups","social/group-messages","social/group-read","social/messages","social/chat-state","social/media"].includes(path)&&!path.startsWith("social/media/"))return null;
 const user=ctx.user;if(!user)return json({error:"Sign in to use your private conversations."},401);
 const db=ctx.db,id=user.userId,now=new Date().toISOString(),q=(sql:string,...args:(string|number|null)[])=>db.prepare(sql).bind(...args),all=async(sql:string,...args:(string|number|null)[])=>(await q(sql,...args).all()).results as any[];
 const target=async(peer:string|null,thread:string|null)=>{if((!peer&&!thread)||(peer&&thread))fail("Choose one conversation.");if(peer)await requireFriend(db,id,peer);else await requireGroup(db,id,thread!)};
 const attachment=async(key:unknown,peer:string|null,thread:string|null)=>{
  const row=await q("SELECT * FROM social_media WHERE id=? AND owner=?",uuid(key),id).first();
  if(!row||row.peer!==peer||row.thread!==thread)fail("This recording belongs to another conversation.",403);
  return row;
 };
 const mediaFields="a.kind AS media_kind,a.mime AS media_mime,a.duration AS duration,a.size AS media_size";
 if(path==="social/chat-state"&&req.method==="POST"){
  const d=await read(),peer=d.peer?text(d.peer,200,1):null,thread=d.thread?uuid(d.thread):null;await target(peer,thread);
  if(d.unread!==undefined&&typeof d.unread!=="boolean"||d.pinned!==undefined&&typeof d.pinned!=="boolean")fail("Choose a valid conversation preference.");
  const key=(thread?"group:":"direct:")+(thread||peer),old=await q("SELECT * FROM chat_preferences WHERE owner=? AND target=?",id,key).first();
  await q("INSERT INTO chat_preferences(id,owner,target,unread,pinned) VALUES(?,?,?,?,?) ON CONFLICT(owner,target) DO UPDATE SET unread=excluded.unread,pinned=excluded.pinned",JSON.stringify([id,key]),id,key,d.unread===undefined?old?.unread||0:d.unread?1:0,d.pinned===undefined?old?.pinned||0:d.pinned?1:0).run();
  if(d.unread===false){
   if(thread)await q("UPDATE chat_members SET last_read=MAX(last_read,COALESCE((SELECT MAX(seq) FROM chat_messages WHERE thread=?),0)) WHERE thread=? AND user_id=?",thread,thread,id).run();
   else await q("UPDATE social_messages SET read_at=? WHERE sender=? AND recipient=? AND read_at IS NULL",now,peer,id).run();
  }
  return json({saved:true});
 }
 if(path==="social/groups"){
  if(req.method==="GET"){
   const groups=await all(`SELECT t.*,m.last_read,
    (SELECT COUNT(*) FROM chat_messages c WHERE c.thread=t.id AND c.sender<>? AND c.seq>m.last_read) AS unread,
    (SELECT CASE WHEN kind='voice' THEN 'Voice note' WHEN kind='video' THEN 'Video note' ELSE body END FROM chat_messages c WHERE c.thread=t.id ORDER BY seq DESC LIMIT 1) AS last_message,
    (SELECT unread FROM chat_preferences p WHERE p.owner=? AND p.target='group:'||t.id) AS manual_unread,
    (SELECT pinned FROM chat_preferences p WHERE p.owner=? AND p.target='group:'||t.id) AS pinned
    FROM chat_threads t JOIN chat_members m ON m.thread=t.id WHERE m.user_id=? AND m.left_at IS NULL ORDER BY pinned DESC,t.updated DESC`,id,id,id,id);
   for(const group of groups){
    group.members=await all("SELECT p.user_id,p.handle,p.name,p.color FROM chat_members m JOIN social_profiles p ON p.user_id=m.user_id WHERE m.thread=? AND m.left_at IS NULL ORDER BY m.joined,p.handle",group.id);
    group.call=await q("SELECT id,mode FROM group_calls WHERE thread=? AND status='active' AND expires>? ORDER BY created DESC LIMIT 1",group.id,Date.now()).first();
   }
   return json({groups});
  }
  if(req.method==="POST"){
   const d=await read(),thread=uuid(d.requestId),name=text(d.name,60,2);
   if(!Array.isArray(d.members)||d.members.length<1||d.members.length>5||new Set(d.members).size!==d.members.length||d.members.includes(id))fail("Choose 1–5 friends. Groups support up to 6 people.");
   const members:string[]=d.members.map((v:unknown)=>text(v,200,1));for(const member of members)await requireFriend(db,id,member);
   const prior=await q("SELECT * FROM chat_threads WHERE id=?",thread).first();
   if(prior){if(prior.creator!==id||prior.name!==name)fail("This group request was already used.",409);return json({id:thread},201)}
   await db.batch([q("INSERT INTO chat_threads(id,name,creator,created,updated) VALUES(?,?,?,?,?)",thread,name,id,now,now),...[id,...members].map(member=>q("INSERT INTO chat_members(id,thread,user_id,joined) VALUES(?,?,?,?)",JSON.stringify([thread,member]),thread,member,now))]);
   return json({id:thread},201);
  }
  if(req.method==="PATCH"){
   const d=await read(),thread=uuid(d.thread),group=await requireGroup(db,id,thread,true);
   if(d.action==="rename"){
    if(group.creator!==id)fail("Only the group creator can rename this group.",403);
    await q("UPDATE chat_threads SET name=?,updated=? WHERE id=?",text(d.name,60,2),now,thread).run();return json({renamed:true});
   }
   if(d.action!=="leave")fail("Choose a valid group action.");
   await db.batch([q("UPDATE chat_members SET left_at=? WHERE thread=? AND user_id=?",now,thread,id),q("UPDATE group_call_members SET state='left',expires=0 WHERE user_id=? AND call_id IN (SELECT id FROM group_calls WHERE thread=?)",id,thread)]);
   return json({left:true});
  }
 }
 if(path==="social/messages"||path==="social/group-messages"){
  const group=path==="social/group-messages";
  if(req.method==="GET"){
   const peer=group?null:url.searchParams.get("peer")||"",thread=group?url.searchParams.get("thread")||"":null;await target(peer,thread);
   const after=Number(url.searchParams.get("after")||0),before=Number(url.searchParams.get("before")||0);if(!Number.isSafeInteger(after)||after<0||!Number.isSafeInteger(before)||before<0||after&&before)fail("Invalid message cursor.");
   const direction=after?"ASC":"DESC",cursor=after||before,filter=cursor?`AND c.seq ${after?">":"<"} ?`:"";
   const params:(string|number)[]=group?[thread!]:[id,peer!,peer!,id];if(cursor)params.push(cursor);
   const rows=await all(group?`SELECT c.*,p.name AS sender_name,p.handle AS sender_handle,${mediaFields},
    (SELECT COUNT(*) FROM chat_members m WHERE m.thread=c.thread AND m.user_id<>c.sender AND m.left_at IS NULL AND m.last_read>=c.seq) AS read_count,
    (SELECT COUNT(*) FROM chat_members m WHERE m.thread=c.thread AND m.user_id<>c.sender AND m.left_at IS NULL) AS recipient_count
    FROM chat_messages c LEFT JOIN social_profiles p ON p.user_id=c.sender LEFT JOIN social_media a ON a.id=c.media WHERE c.thread=? ${filter} ORDER BY c.seq ${direction} LIMIT 50`
    :`SELECT c.*,${mediaFields} FROM social_messages c LEFT JOIN social_media a ON a.id=c.media WHERE ((c.sender=? AND c.recipient=?) OR (c.sender=? AND c.recipient=?)) ${filter} ORDER BY c.seq ${direction} LIMIT 50`,...params);
   if(!after)rows.reverse();return json({messages:rows,hasMore:rows.length===50});
  }
  if(req.method==="POST"){
   const d=await read(),peer=group?null:text(d.peer,200,1),thread=group?uuid(d.thread):null;await target(peer,thread);
   const nonce=uuid(d.requestId),kind=d.kind||"text";if(!["text","voice","video"].includes(kind))fail("Choose a text message, voice note or video note.");
   const body=text(d.body??"",4000,kind==="text"?1:0),note=kind==="text"?null:await attachment(d.media,peer,thread);
   if(note&&note.kind!==kind)fail("The recording type does not match the message.");
   const table=group?"chat_messages":"social_messages",prior=await q(`SELECT * FROM ${table} WHERE sender=? AND id=?`,id,nonce).first();
   if(prior){if(prior.body!==body||prior.kind!==kind||prior.media!==(note?.id||null)||(group?prior.thread!==thread:prior.recipient!==peer))fail("This message request was already used.",409);return json({message:prior},201)}
   if(note&&await q("SELECT id FROM social_messages WHERE media=? UNION ALL SELECT id FROM chat_messages WHERE media=?",note.id,note.id).first())fail("This recording was already sent.",409);
   if(group)await db.batch([q("INSERT OR IGNORE INTO chat_messages(id,thread,sender,kind,body,media,created) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM chat_members WHERE thread=? AND user_id=? AND left_at IS NULL) AND NOT EXISTS(SELECT 1 FROM social_blocks b JOIN chat_members m ON m.thread=? AND m.left_at IS NULL WHERE (b.blocker=? AND b.target=m.user_id) OR (b.target=? AND b.blocker=m.user_id))",nonce,thread,id,kind,body,note?.id||null,now,thread,id,thread,id,id),q("UPDATE chat_threads SET updated=? WHERE id=?",now,thread)]);
   else await db.batch([q("INSERT OR IGNORE INTO social_messages(id,sender,recipient,body,kind,media,created) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM friendships WHERE id=? AND status='accepted') AND NOT EXISTS(SELECT 1 FROM social_blocks WHERE (blocker=? AND target=?) OR (blocker=? AND target=?))",nonce,id,peer,body,kind,note?.id||null,now,JSON.stringify([id,peer].sort()),id,peer,peer,id),q("UPDATE friendships SET updated=? WHERE id=?",now,JSON.stringify([id,peer].sort()))]);
   const saved=await q(`SELECT c.*,${mediaFields} FROM ${table} c LEFT JOIN social_media a ON a.id=c.media WHERE c.sender=? AND c.id=?`,id,nonce).first();
   if(!saved)fail("This conversation or recording is no longer available.",403);
   if(saved.body!==body||saved.kind!==kind||saved.media!==(note?.id||null)||(group?saved.thread!==thread:saved.recipient!==peer))fail("This message request was already used.",409);
   return json({message:saved},201);
  }
 }
 if(path==="social/group-read"&&req.method==="POST"){
  const d=await read(),thread=uuid(d.thread);await requireGroup(db,id,thread);
  if(!Number.isSafeInteger(d.through)||d.through<0)fail("Invalid read cursor.");
  const last=await q("SELECT MAX(seq) AS seq FROM chat_messages WHERE thread=?",thread).first(),through=Math.min(d.through,Number(last?.seq||0));
  await db.batch([q("UPDATE chat_members SET last_read=MAX(last_read,?) WHERE thread=? AND user_id=?",through,thread,id),q("UPDATE chat_preferences SET unread=0 WHERE owner=? AND target=?",id,"group:"+thread)]);return json({read:true});
 }
 if(path==="social/media"&&req.method==="POST"){
  if(!ctx.bucket)fail("Recording storage is temporarily unavailable.",503);
  const peer=url.searchParams.get("peer"),thread=url.searchParams.get("thread");await target(peer,thread);
  const kind=req.headers.get("x-note-kind"),duration=Number(req.headers.get("x-note-duration-ms")),mime=(req.headers.get("content-type")||"").split(";")[0].trim().toLowerCase();
  if(!["voice","video"].includes(kind||"")||!Number.isInteger(duration)||duration<100||duration>(kind==="voice"?120000:60000))fail("Voice notes can be up to 2 minutes; video notes up to 1 minute.");
  if(!(kind==="voice"?["audio/webm","audio/ogg","audio/mp4"]:["video/webm","video/mp4"]).includes(mime))fail("This recording format is not supported.",415);
  if(Number(req.headers.get("content-length"))>MAX_NOTE)fail("Recordings must be under 12 MB.",413);
  const reader=req.body?.getReader(),chunks:Uint8Array[]=[];let size=0;if(reader)for(;;){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>MAX_NOTE){await reader.cancel();fail("Recordings must be under 12 MB.",413)}chunks.push(part.value)}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
  const magic=new TextDecoder().decode(bytes.slice(0,12)),valid=size>=12&&(mime.endsWith("webm")&&[26,69,223,163].every((b,i)=>bytes[i]===b)||mime.endsWith("ogg")&&magic.startsWith("OggS")||mime.endsWith("mp4")&&magic.slice(4,8)==="ftyp");if(!valid)fail("The recording file could not be read.");
  const key=crypto.randomUUID();await ctx.bucket!.put("notes/"+key,bytes,{httpMetadata:{contentType:mime}});
  try{await q("INSERT INTO social_media(id,owner,peer,thread,kind,mime,size,duration,created) VALUES(?,?,?,?,?,?,?,?,?)",key,id,peer,thread,kind!,mime,size,duration,now).run()}catch(e){await ctx.bucket!.delete("notes/"+key);throw e}
  return json({id:key,kind,mime,duration,size},201);
 }
 if(path.startsWith("social/media/")){
  const key=uuid(path.split("/")[2]),note=await q("SELECT * FROM social_media WHERE id=?",key).first();if(!note||!ctx.bucket)fail("Recording not found.",404);
  const sent=await q("SELECT id FROM social_messages WHERE media=? UNION ALL SELECT id FROM chat_messages WHERE media=?",key,key).first();
  if(req.method==="DELETE"){
   if(note.owner!==id)fail("Recording not found.",404);if(sent)fail("A sent recording cannot be discarded as a draft.",409);
   await ctx.bucket!.delete("notes/"+key);await q("DELETE FROM social_media WHERE id=?",key).run();return json({deleted:true});
  }
  if(!["GET","HEAD"].includes(req.method))return json({error:"Method not allowed."},405);
  if(note.thread)await requireGroup(db,id,note.thread);
  else if(id!==note.owner){if(id!==note.peer||!sent)fail("Recording not found.",404);await requireFriend(db,id,note.owner)}
  if(id!==note.owner&&!sent)fail("Recording not found.",404);
  const headers:Record<string,string>={"content-type":note.mime,"cache-control":"private,no-store","x-content-type-options":"nosniff","accept-ranges":"bytes","content-disposition":"inline"};
  let offset=0,length=Number(note.size),status=200;
  const range=req.headers.get("range");if(range){
   const match=/^bytes=(\d*)-(\d*)$/.exec(range);if(!match||!match[1]&&!match[2])return new Response(null,{status:416,headers:{"content-range":"bytes */"+note.size}});
   const start=match[1]?Number(match[1]):Math.max(0,note.size-Number(match[2])),end=match[1]?match[2]?Math.min(Number(match[2]),note.size-1):note.size-1:note.size-1;
   if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=note.size)return new Response(null,{status:416,headers:{"content-range":"bytes */"+note.size}});
   offset=start;length=end-start+1;status=206;headers["content-range"]=`bytes ${start}-${end}/${note.size}`;
  }
  headers["content-length"]=String(length);if(req.method==="HEAD")return new Response(null,{status,headers});
  const object=await ctx.bucket!.get("notes/"+key,{range:{offset,length}});if(!object)fail("Recording not found.",404);
  return new Response(object!.body,{status,headers});
 }
 return json({error:"Chat endpoint not found."},404);
}
