import type {Context} from "./service";
const colors=["teal","blue","violet","coral","gold"];
const fail=(message:string,status=400):never=>{throw Object.assign(new Error(message),{status})};
const text=(value:unknown,max:number,min=0)=>{if(typeof value!=="string"||value.trim().length<min||value.trim().length>max)fail(`Use ${min}–${max} characters.`);return (value as string).trim()};
const sdp=(value:unknown)=>{if(typeof value!=="string"||value.length<20||value.length>60000||!value.startsWith("v=0")||!value.includes("m=audio"))fail("Invalid call description.");return value as string};
const uuid=(v:unknown)=>{if(typeof v!=="string"||!/^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(v))fail("Invalid request ID.");return v as string};
export async function socialRoute(req:Request,ctx:Context,read:()=>Promise<any>,json:(v:unknown,s?:number)=>Response):Promise<Response|null>{
 const url=new URL(req.url),path=url.pathname.replace(/^\/api\//,"");if(!path.startsWith("social/"))return null;
 const user=ctx.user;if(!user)return json({error:"Sign in to create a profile and connect with friends."},401);
 const db=ctx.db,id=user.userId,now=new Date().toISOString(),ms=Date.now(),q=(sql:string,...params:(string|number|null)[])=>db.prepare(sql).bind(...params),all=async(sql:string,...params:(string|number|null)[])=>(await q(sql,...params).all()).results as any[];
 await q("INSERT INTO users(id,name,role) VALUES(?,?,'member') ON CONFLICT(id) DO NOTHING",id,user.displayName).run();
 const pair=(peer:string)=>JSON.stringify([id,peer].sort()),blocked=async(peer:string)=>!!await q("SELECT id FROM social_blocks WHERE (blocker=? AND target=?) OR (blocker=? AND target=?)",id,peer,peer,id).first();
 const relation=async(peer:string)=>q("SELECT * FROM friendships WHERE id=?",pair(peer)).first();
 const allowed=async(peer:string)=>{if((await relation(peer))?.status!=="accepted"||await blocked(peer))fail("This conversation requires an accepted friendship.",403)};
 const peerProfile=async(peer:string)=>q("SELECT user_id,handle,name,bio,area,color FROM social_profiles WHERE user_id=?",peer).first();
 const closeCalls=(peer:string)=>q("UPDATE social_calls SET status='ended',offer='',answer='',updated=? WHERE status IN ('ringing','accepted') AND ((caller=? AND callee=?) OR (caller=? AND callee=?))",now,id,peer,peer,id);
 await q("UPDATE social_calls SET status=CASE WHEN status='ringing' THEN 'missed' ELSE 'ended' END,offer='',answer='',updated=? WHERE status IN ('ringing','accepted') AND expires<? AND (caller=? OR callee=?)",now,ms,id,id).run();
 if(path==="social/profile"){
  if(req.method==="GET")return json({profile:await q("SELECT * FROM social_profiles WHERE user_id=?",id).first()});
  if(req.method==="POST"||req.method==="PATCH"){
   const d=await read(),handle=text(d.handle,24,3).toLowerCase(),name=text(d.name,40,2),bio=text(d.bio??"",300),area=text(d.area??"",60),color=colors.includes(d.color)?d.color:"teal";
   if(!/^[a-z][a-z0-9_]{2,23}$/.test(handle))fail("Use a handle of 3–24 letters, digits or underscores, starting with a letter.");
   if(typeof d.discoverable!=="boolean")fail("Choose whether people can find your profile.");
   const existing=await q("SELECT user_id FROM social_profiles WHERE handle=? AND user_id<>?",handle,id).first();if(existing)fail("That handle is already in use.",409);
   try{await q("INSERT INTO social_profiles(user_id,handle,name,bio,area,color,discoverable,created,updated) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET handle=excluded.handle,name=excluded.name,bio=excluded.bio,area=excluded.area,color=excluded.color,discoverable=excluded.discoverable,updated=excluded.updated",id,handle,name,bio,area,color,d.discoverable?1:0,now,now).run()}catch(e){if(/UNIQUE|constraint/i.test(String(e)))fail("That handle is already in use.",409);throw e}
   return json({profile:await q("SELECT * FROM social_profiles WHERE user_id=?",id).first()});
  }
 }
 if(path==="social/people"&&req.method==="GET"){
  const term=(url.searchParams.get("q")||"").trim().toLowerCase().slice(0,60);
  const people=term.length>=2?await all("SELECT user_id,handle,name,bio,area,color FROM social_profiles p WHERE discoverable=1 AND user_id<>? AND (instr(lower(handle),?)>0 OR instr(lower(name),?)>0) AND NOT EXISTS(SELECT 1 FROM social_blocks WHERE (blocker=? AND target=p.user_id) OR (blocker=p.user_id AND target=?)) ORDER BY handle LIMIT 30",id,term,term,id,id):[];
  return json({people});
 }
 if(path==="social/home"&&req.method==="GET"){
  const relations=await all("SELECT f.id,f.status,f.requester,f.created,p.user_id,p.handle,p.name,p.bio,p.area,p.color,(SELECT COUNT(*) FROM social_messages m WHERE m.sender=p.user_id AND m.recipient=? AND m.read_at IS NULL) AS unread,(SELECT body FROM social_messages m WHERE (m.sender=? AND m.recipient=p.user_id) OR (m.sender=p.user_id AND m.recipient=?) ORDER BY seq DESC LIMIT 1) AS last_message FROM friendships f JOIN social_profiles p ON p.user_id=CASE WHEN f.member_a=? THEN f.member_b ELSE f.member_a END WHERE (f.member_a=? OR f.member_b=?) AND NOT EXISTS(SELECT 1 FROM social_blocks WHERE (blocker=? AND target=p.user_id) OR (blocker=p.user_id AND target=?)) ORDER BY f.updated DESC",id,id,id,id,id,id,id,id);
  const blocks=await all("SELECT p.user_id,p.handle,p.name,p.color FROM social_blocks b JOIN social_profiles p ON p.user_id=b.target WHERE b.blocker=?",id);
  return json({userId:id,profile:await q("SELECT * FROM social_profiles WHERE user_id=?",id).first(),relations,blocks});
 }
 if(path==="social/friends"&&["POST","PATCH"].includes(req.method)){
  const d=await read(),peer=text(d.peer,200,1);if(peer===id)fail("Choose another person.");
  if(!await peerProfile(id)||!await peerProfile(peer))fail("Both people need a community profile.",404);
  if(await blocked(peer))fail("This person is unavailable.",403);
  const r=await relation(peer),key=pair(peer);
  if(req.method==="POST"){
   if(r)fail(r.status==="accepted"?"You are already friends.":"A friend request is already pending.",409);
   const visible=await q("SELECT discoverable FROM social_profiles WHERE user_id=?",peer).first();if(!visible?.discoverable)fail("This profile is not accepting new requests.",403);
   const [a,b]=[id,peer].sort();await q("INSERT OR IGNORE INTO friendships(id,member_a,member_b,requester,status,created,updated) VALUES(?,?,?,?,'pending',?,?)",key,a,b,id,now,now).run();return json({sent:true},201);
  }
  if(!r)fail("Friend request not found.",404);
  if(d.action==="accept"){
   if(r.status!=="pending"||r.requester===id)fail("Only the recipient can accept this request.",403);
   await q("UPDATE friendships SET status='accepted',updated=? WHERE id=? AND status='pending'",now,key).run();return json({accepted:true});
  }
  if(!["cancel","decline","remove"].includes(d.action))fail("Choose a valid friend action.");
  if(d.action==="cancel"&&(r.status!=="pending"||r.requester!==id)||d.action==="decline"&&(r.status!=="pending"||r.requester===id)||d.action==="remove"&&r.status!=="accepted")fail("This action is unavailable.",403);
  await db.batch([q("DELETE FROM friendships WHERE id=?",key),closeCalls(peer)]);return json({removed:true});
 }
 if(path==="social/block"&&req.method==="POST"){
  const d=await read(),peer=text(d.peer,200,1);if(peer===id||!await peerProfile(peer))fail("Profile not found.",404);
  if(d.remove===true)await q("DELETE FROM social_blocks WHERE blocker=? AND target=?",id,peer).run();
  else await db.batch([q("INSERT OR IGNORE INTO social_blocks(id,blocker,target,created) VALUES(?,?,?,?)",JSON.stringify([id,peer]),id,peer,now),q("DELETE FROM friendships WHERE id=?",pair(peer)),closeCalls(peer)]);
  return json({blocked:d.remove!==true});
 }
 if(path==="social/messages"){
  if(req.method==="GET"){
   const peer=url.searchParams.get("peer")||"";await allowed(peer);const after=Number(url.searchParams.get("after")||0),before=Number(url.searchParams.get("before")||0);if(!Number.isSafeInteger(after)||after<0||!Number.isSafeInteger(before)||before<0||after&&before)fail("Invalid message cursor.");
   const direction=after?"ASC":"DESC",cursor=after||before,filter=cursor?`AND seq ${after?">":"<"} ?`:"",params:(string|number)[]=[id,peer,peer,id];if(cursor)params.push(cursor);
   const messages=await all(`SELECT seq,id,sender,recipient,body,created,read_at FROM social_messages WHERE ((sender=? AND recipient=?) OR (sender=? AND recipient=?)) ${filter} ORDER BY seq ${direction} LIMIT 50`,...params);if(!after)messages.reverse();return json({messages,hasMore:messages.length===50});
  }
  if(req.method==="POST"){
   const d=await read(),peer=text(d.peer,200,1),body=text(d.body,4000,1),nonce=uuid(d.requestId);await allowed(peer);
   await q("INSERT OR IGNORE INTO social_messages(id,sender,recipient,body,created) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM friendships WHERE id=? AND status='accepted') AND NOT EXISTS(SELECT 1 FROM social_blocks WHERE (blocker=? AND target=?) OR (blocker=? AND target=?))",nonce,id,peer,body,now,pair(peer),id,peer,peer,id).run();
   const saved=await q("SELECT * FROM social_messages WHERE sender=? AND id=?",id,nonce).first();if(!saved)fail("This conversation is no longer available.",403);if(saved.recipient!==peer||saved.body!==body)fail("This message request was already used.",409);return json({message:saved},201);
  }
 }
 if(path==="social/read"&&req.method==="POST"){
  const d=await read(),peer=text(d.peer,200,1);await allowed(peer);if(!Number.isSafeInteger(d.through)||d.through<0)fail("Invalid message cursor.");await q("UPDATE social_messages SET read_at=? WHERE sender=? AND recipient=? AND seq<=? AND read_at IS NULL",now,peer,id,d.through).run();return json({read:true});
 }
 if(path==="social/ice"&&req.method==="GET"){
  const iceServers:any[]=[{urls:"stun:stun.l.google.com:19302"}];let relay=false;
  const urls=ctx.rtc?.urls?.split(",").map(u=>u.trim()).filter(u=>/^turns?:[^\s]+$/.test(u))||[];
  if(urls.length&&ctx.rtc?.secret){const username=Math.floor(ms/1000+3600)+":"+id,key=await crypto.subtle.importKey("raw",new TextEncoder().encode(ctx.rtc.secret),{name:"HMAC",hash:"SHA-1"},false,["sign"]),signature=new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(username)));iceServers.push({urls,username,credential:btoa(String.fromCharCode(...signature))});relay=true}
  return json({iceServers,relay});
 }
 if(path==="social/calls"){
  if(req.method==="GET"){
   const requested=url.searchParams.get("id"),row=requested?await q("SELECT * FROM social_calls WHERE id=? AND (caller=? OR callee=?)",requested,id,id).first():await q("SELECT * FROM social_calls WHERE (caller=? OR callee=?) AND status IN ('ringing','accepted') ORDER BY created DESC LIMIT 1",id,id).first();
   if(!row)return json({call:null});const peer=row.caller===id?row.callee:row.caller;if(await blocked(peer))return json({call:null});return json({call:{...row,peer:await peerProfile(peer),incoming:row.callee===id}});
  }
  if(req.method==="POST"){
   const d=await read(),peer=text(d.peer,200,1),callId=uuid(d.id);await allowed(peer);if(!["voice","video"].includes(d.mode))fail("Choose voice or video.");const offer=sdp(d.offer);if(!offer.startsWith("v=0")||!offer.includes("m=audio")||d.mode==="video"&&!offer.includes("m=video"))fail("Invalid call offer.");
   const inserted=await q("INSERT OR IGNORE INTO social_calls(id,caller,callee,mode,status,offer,created,updated,expires) SELECT ?,?,?,?,'ringing',?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM social_calls WHERE status IN ('ringing','accepted') AND expires>? AND (caller IN (?,?) OR callee IN (?,?))) AND EXISTS(SELECT 1 FROM friendships WHERE id=? AND status='accepted') AND NOT EXISTS(SELECT 1 FROM social_blocks WHERE (blocker=? AND target=?) OR (blocker=? AND target=?)) RETURNING id",callId,id,peer,d.mode,offer,now,now,ms+60000,ms,id,peer,id,peer,pair(peer),id,peer,peer,id).first();
   if(!inserted){const existing=await q("SELECT * FROM social_calls WHERE id=? AND caller=? AND callee=?",callId,id,peer).first();if(!existing||existing.mode!==d.mode||existing.offer!==offer||existing.status!=="ringing")fail("One of you is already in a call. Try again shortly.",409)}return json({id:callId},201);
  }
  if(req.method==="PATCH"){
   const d=await read(),callId=uuid(d.id),row=await q("SELECT * FROM social_calls WHERE id=? AND (caller=? OR callee=?)",callId,id,id).first();if(!row)fail("Call not found.",404);
   if(d.action==="accept"){
    if(row.callee!==id||row.status!=="ringing")fail("This call cannot be answered.",409);await allowed(row.caller);const answer=sdp(d.answer);if(!answer.startsWith("v=0")||!answer.includes("m=audio"))fail("Invalid call answer.");const saved=await q("UPDATE social_calls SET status='accepted',answer=?,updated=?,expires=? WHERE id=? AND status='ringing' RETURNING id",answer,now,ms+120000,callId).first();if(!saved)fail("This call has ended.",409);
   }else if(d.action==="heartbeat"){
    if(row.status==="accepted")await q("UPDATE social_calls SET expires=? WHERE id=? AND status='accepted'",ms+120000,callId).run();
   }else if(["end","decline"].includes(d.action)){
    if(d.action==="decline"&&(row.callee!==id||row.status!=="ringing"))fail("This call cannot be declined.",409);
    await q("UPDATE social_calls SET status=?,offer='',answer='',updated=? WHERE id=? AND status IN ('ringing','accepted')",d.action==="decline"?"declined":"ended",now,callId).run();
   }else fail("Invalid call action.");return json({saved:true});
  }
 }
 return json({error:"Social endpoint not found."},404);
}
