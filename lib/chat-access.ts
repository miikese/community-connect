import type {DB} from "./service";
export const chatFail=(message:string,status=400):never=>{throw Object.assign(new Error(message),{status})};
export const chatText=(value:unknown,max:number,min=0)=>{if(typeof value!=="string"||value.trim().length<min||value.trim().length>max)chatFail(`Use ${min}–${max} characters.`);return(value as string).trim()};
export const chatUUID=(v:unknown)=>{if(typeof v!=="string"||!/^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(v))chatFail("Invalid request ID.");return v as string};
export const pairId=(a:string,b:string)=>JSON.stringify([a,b].sort());
export async function requireFriend(db:DB,id:string,peer:string){
 const row=await db.prepare("SELECT id FROM friendships WHERE id=? AND status='accepted' AND NOT EXISTS(SELECT 1 FROM social_blocks WHERE (blocker=? AND target=?) OR (blocker=? AND target=?))").bind(pairId(id,peer),id,peer,peer,id).first();
 if(!row)chatFail("This conversation requires an accepted friendship.",403);
}
export async function requireGroup(db:DB,id:string,thread:string,allowBlocked=false){
 const row=await db.prepare("SELECT t.* FROM chat_threads t JOIN chat_members m ON m.thread=t.id WHERE t.id=? AND m.user_id=? AND m.left_at IS NULL").bind(thread,id).first();
 if(!row)chatFail("Group not found or you are no longer a member.",404);
 if(!allowBlocked&&await db.prepare("SELECT b.id FROM social_blocks b JOIN chat_members m ON m.thread=? AND m.left_at IS NULL WHERE (b.blocker=? AND b.target=m.user_id) OR (b.target=? AND b.blocker=m.user_id)").bind(thread,id,id).first())chatFail("A blocked connection is in this group. You can leave the group or manage your blocked people.",403);
 return row;
}
export async function groupBusy(db:DB,user:string,except=""){
 return!!await db.prepare("SELECT m.id FROM group_call_members m JOIN group_calls c ON c.id=m.call_id WHERE m.user_id=? AND m.state='joined' AND m.expires>? AND c.status='active' AND c.expires>? AND c.id<>?").bind(user,Date.now(),Date.now(),except).first();
}
