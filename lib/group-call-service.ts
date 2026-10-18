import type {Context} from "./service";
import {chatFail as fail,chatUUID as uuid,requireGroup,groupBusy} from "./chat-access";
export async function groupCallRoute(req:Request,ctx:Context,read:()=>Promise<any>,json:(v:unknown,s?:number)=>Response):Promise<Response|null>{
 const url=new URL(req.url),path=url.pathname.replace(/^\/api\//,"");if(!["social/group-calls","social/group-signals"].includes(path))return null;
 const user=ctx.user;if(!user)return json({error:"Sign in to join a group call."},401);
 const db=ctx.db,id=user.userId,ms=Date.now(),now=new Date(ms).toISOString(),q=(sql:string,...args:(string|number|null)[])=>db.prepare(sql).bind(...args),all=async(sql:string,...args:(string|number|null)[])=>(await q(sql,...args).all()).results as any[];
 await q("UPDATE group_calls SET status='ended' WHERE status='active' AND expires<?",ms).run();
 await q("DELETE FROM group_call_signals WHERE call_id IN (SELECT id FROM group_calls WHERE status='ended')").run();
 await q("UPDATE group_call_members SET state='left',expires=0 WHERE state='joined' AND call_id IN (SELECT id FROM group_calls WHERE status='ended')").run();
 const member=async(call:string,session:string)=>q("SELECT * FROM group_call_members WHERE call_id=? AND user_id=? AND session=? AND state='joined' AND expires>?",call,id,session,ms).first();
 const callRow=async(call:string)=>{const row=await q("SELECT c.*,t.name FROM group_calls c JOIN chat_threads t ON t.id=c.thread WHERE c.id=?",call).first();if(!row)fail("Call not found.",404);await requireGroup(db,id,row.thread);return row};
 const participants=(call:string)=>all("SELECT m.user_id,m.session,m.muted,m.camera,p.name,p.handle,p.color FROM group_call_members m JOIN social_profiles p ON p.user_id=m.user_id JOIN chat_members g ON g.thread=(SELECT thread FROM group_calls WHERE id=m.call_id) AND g.user_id=m.user_id AND g.left_at IS NULL WHERE m.call_id=? AND m.state='joined' AND m.expires>? ORDER BY m.user_id",call,ms);
 if(path==="social/group-signals"&&req.method==="POST"){
  const d=await read(),call=await callRow(uuid(d.id)),session=uuid(d.session),toSession=uuid(d.targetSession),peer=String(d.target||"");
  if(call.status!=="active"||!await member(call.id,session))fail("Rejoin the call before sending connection updates.",409);
  if(!await q("SELECT id FROM group_call_members WHERE call_id=? AND user_id=? AND session=? AND state='joined' AND expires>?",call.id,peer,toSession,ms).first())fail("This participant has left the call.",409);
  const target=await q("SELECT user_id FROM chat_members WHERE thread=? AND user_id=? AND left_at IS NULL",call.thread,peer).first();if(!target)fail("This participant has left the group.",403);
  if(peer===id||!["offer","answer"].includes(d.kind)||typeof d.sdp!=="string"||d.sdp.length<20||d.sdp.length>60000||!d.sdp.startsWith("v=0")||!d.sdp.includes("m=audio")||call.mode==="video"&&!d.sdp.includes("m=video"))fail("Invalid group call connection update.");
  if(d.kind==="offer"&&id>peer||d.kind==="answer"&&id<peer)fail("This connection update is out of order.",409);
  if(d.kind==="answer"&&!await q("SELECT id FROM group_call_signals WHERE call_id=? AND sender=? AND recipient=? AND from_session=? AND to_session=? AND kind='offer'",call.id,peer,id,toSession,session).first())fail("Wait for the participant’s connection offer.",409);
  const key=JSON.stringify([call.id,session,toSession,d.kind]),prior=await q("SELECT sdp FROM group_call_signals WHERE id=?",key).first();if(prior&&prior.sdp!==d.sdp)fail("This connection update was already used.",409);
  await q("INSERT OR IGNORE INTO group_call_signals(id,call_id,sender,recipient,from_session,to_session,kind,sdp,created) VALUES(?,?,?,?,?,?,?,?,?)",key,call.id,id,peer,session,toSession,d.kind,d.sdp,now).run();return json({sent:true});
 }
 if(path!=="social/group-calls")return json({error:"Call endpoint not found."},404);
 if(req.method==="GET"){
  const requested=url.searchParams.get("id");
  if(!requested){
   const calls=await all("SELECT c.id,c.thread,c.mode,c.host,t.name FROM group_calls c JOIN chat_threads t ON t.id=c.thread JOIN chat_members m ON m.thread=c.thread AND m.user_id=? AND m.left_at IS NULL WHERE c.status='active' AND c.expires>? AND NOT EXISTS(SELECT 1 FROM social_blocks b JOIN chat_members o ON o.thread=c.thread AND o.left_at IS NULL WHERE (b.blocker=? AND b.target=o.user_id) OR (b.target=? AND b.blocker=o.user_id)) ORDER BY c.created DESC LIMIT 10",id,ms,id,id);
   return json({calls});
  }
  const row=await callRow(uuid(requested)),session=url.searchParams.get("session")||"";
  const people=await participants(row.id),joined=people.some(p=>p.user_id===id&&p.session===session);
  const signals=joined?await all("SELECT s.* FROM group_call_signals s JOIN group_call_members m ON m.call_id=s.call_id AND m.user_id=s.sender AND m.session=s.from_session AND m.state='joined' AND m.expires>? WHERE s.call_id=? AND s.recipient=? AND s.to_session=? ORDER BY s.created,s.id",ms,row.id,id,session):[];
  return json({call:{...row,participants:people,joined},signals});
 }
 if(req.method==="POST"){
  const d=await read(),thread=uuid(d.thread),session=uuid(d.session);await requireGroup(db,id,thread);
  if(!["voice","video"].includes(d.mode))fail("Choose voice or video.");
  let row=await q("SELECT * FROM group_calls WHERE thread=? AND status='active' AND expires>? ORDER BY created DESC LIMIT 1",thread,ms).first();
  if(row&&row.mode!==d.mode)fail("A different call is already active in this group. Join it from the call invitation.",409);
  const callId=row?.id||uuid(d.id);
  if(await groupBusy(db,id,callId)||await q("SELECT id FROM social_calls WHERE status IN ('ringing','accepted') AND expires>? AND (caller=? OR callee=?)",ms,id,id).first())fail("Finish your current call before joining another.",409);
  if(!row){
   await q("INSERT OR IGNORE INTO group_calls(id,thread,host,mode,status,created,expires) SELECT ?,?,?,?,'active',?,? WHERE NOT EXISTS(SELECT 1 FROM group_calls WHERE thread=? AND status='active' AND expires>?)",callId,thread,id,d.mode,now,ms+90000,thread,ms).run();
   row=await q("SELECT * FROM group_calls WHERE thread=? AND status='active' AND expires>? ORDER BY created DESC LIMIT 1",thread,ms).first();
   if(!row||row.mode!==d.mode)fail("The call could not start. Try joining again.",409);
  }
  const prior=await q("SELECT session,state,expires FROM group_call_members WHERE call_id=? AND user_id=?",row.id,id).first();
  if(prior?.state==='joined'&&prior.expires>ms&&prior.session!==session)fail("You already joined this call in another tab. Leave it there first.",409);
  await db.batch([q("INSERT INTO group_call_members(id,call_id,user_id,session,state,camera,expires) VALUES(?,?,?,?,'joined',?,?) ON CONFLICT(call_id,user_id) DO UPDATE SET session=excluded.session,state='joined',muted=0,camera=excluded.camera,expires=excluded.expires",JSON.stringify([row.id,id]),row.id,id,session,d.mode==="video"?1:0,ms+90000),q("UPDATE group_calls SET expires=? WHERE id=? AND status='active'",ms+90000,row.id)]);
  return json({call:{...row,name:(await requireGroup(db,id,thread)).name,participants:await participants(row.id)},session},201);
 }
 if(req.method==="PATCH"){
  const d=await read(),callId=uuid(d.id),session=uuid(d.session),row=await q("SELECT * FROM group_calls WHERE id=?",callId).first();if(!row)fail("Call not found.",404);
  if(d.action==="leave"){
   if(!await q("SELECT id FROM group_call_members WHERE call_id=? AND user_id=? AND session=?",callId,id,session).first())fail("Call participation not found.",404);
   await q("UPDATE group_call_members SET state='left',expires=0 WHERE call_id=? AND user_id=? AND session=?",callId,id,session).run();
   await q("DELETE FROM group_call_signals WHERE call_id=? AND (from_session=? OR to_session=?)",callId,session,session).run();
   if(!(await participants(callId)).length)await q("UPDATE group_calls SET status='ended' WHERE id=?",callId).run();
   return json({left:true});
  }
  await requireGroup(db,id,row.thread);
  if(row.status!=="active"||!await member(callId,session))fail("This call has ended. You can start a new one.",409);
  if(d.action==="end"){
   if(row.host!==id)fail("Only the person who started this call can end it for everyone.",403);
   await db.batch([q("UPDATE group_calls SET status='ended' WHERE id=?",callId),q("UPDATE group_call_members SET state='left',expires=0 WHERE call_id=?",callId),q("DELETE FROM group_call_signals WHERE call_id=?",callId)]);return json({ended:true});
  }
  if(d.action!=="heartbeat")fail("Choose a valid call action.");
  if(typeof d.muted!=="boolean"||typeof d.camera!=="boolean")fail("Invalid microphone or camera state.");
  await db.batch([q("UPDATE group_call_members SET expires=?,muted=?,camera=? WHERE call_id=? AND user_id=? AND session=?",ms+90000,d.muted?1:0,d.camera&&row.mode==="video"?1:0,callId,id,session),q("UPDATE group_calls SET expires=? WHERE id=? AND status='active'",ms+90000,callId)]);return json({active:true});
 }
 return json({error:"Method not allowed."},405);
}
