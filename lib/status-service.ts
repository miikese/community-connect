import type {Context} from "./service";
import {chatFail as fail,chatText as text,chatUUID as uuid,requireFriend} from "./chat-access";
export async function statusRoute(req:Request,ctx:Context,read:()=>Promise<any>,json:(v:unknown,s?:number)=>Response):Promise<Response|null>{
 const url=new URL(req.url),path=url.pathname.replace(/^\/api\//,"");if(path!=="social/statuses"&&!path.startsWith("social/statuses/"))return null;
 if(!ctx.user)return json({error:"Sign in to view friends’ status updates."},401);
 const id=ctx.user.userId,db=ctx.db,now=Date.now(),q=(sql:string,...args:(string|number|null)[])=>db.prepare(sql).bind(...args);
 if(path==="social/statuses"){
  if(req.method==="GET"){
   const items=(await q(`SELECT s.*,p.name,p.handle,p.color AS profile_color,a.mime,a.filename,a.size,
   CASE WHEN s.owner=? THEN (SELECT COUNT(*) FROM status_views v WHERE v.status=s.id) ELSE NULL END AS views,
   EXISTS(SELECT 1 FROM status_views v WHERE v.status=s.id AND v.viewer=?) AS viewed
   FROM status_posts s JOIN social_profiles p ON p.user_id=s.owner LEFT JOIN social_media a ON a.id=s.media
   WHERE s.expires>? AND (s.owner=? OR EXISTS(SELECT 1 FROM friendships f WHERE f.status='accepted' AND ((f.member_a=? AND f.member_b=s.owner) OR (f.member_b=? AND f.member_a=s.owner))))
   AND NOT EXISTS(SELECT 1 FROM social_blocks b WHERE (b.blocker=? AND b.target=s.owner) OR (b.target=? AND b.blocker=s.owner))
   ORDER BY s.created DESC,s.id DESC LIMIT 50`,id,id,now,id,id,id,id,id).all()).results;
   return json({items,serverTime:now});
  }
  if(req.method==="POST"){
   const expired=(await q("SELECT id,media FROM status_posts WHERE owner=? AND expires<=? LIMIT 50",id,now).all()).results as {id:string;media:string|null}[];
   for(const old of expired){if(old.media&&ctx.bucket)await ctx.bucket.delete("notes/"+old.media);await db.batch([q("DELETE FROM status_views WHERE status=?",old.id),q("DELETE FROM status_posts WHERE id=?",old.id),...(old.media?[q("DELETE FROM social_media WHERE id=?",old.media)]:[])])}
   const d=await read(),key=uuid(d.requestId),body=text(d.body??"",700,d.media?0:1),color=["forest","violet","ocean","sunset"].includes(d.color)?d.color:"forest",media=d.media?uuid(d.media):null;
   const old=await q("SELECT * FROM status_posts WHERE id=?",key).first();if(old){if(old.owner!==id||old.body!==body||old.media!==media||old.color!==color)fail("This status request was already used.",409);return json({id:key},201)}
   if(media){const row=await q("SELECT * FROM social_media WHERE id=? AND owner=? AND scope='status'",media,id).first();if(!row||!["image","video"].includes(row.kind))fail("Choose your own status photo or video.",403);if(await q("SELECT id FROM status_posts WHERE media=?",media).first())fail("This media is already in a status.",409)}
   const count=await q("SELECT COUNT(*) AS total FROM status_posts WHERE owner=? AND created>?",id,new Date(now-86400000).toISOString()).first();if(count.total>=20)fail("You can share up to 20 status updates in 24 hours.",429);
   await q("INSERT INTO status_posts(id,owner,body,media,color,created,expires) VALUES(?,?,?,?,?,?,?)",key,id,body,media,color,new Date(now).toISOString(),now+86400000).run();return json({id:key},201);
  }
 }
 const parts=path.split("/"),key=uuid(parts[2]),post=await q("SELECT * FROM status_posts WHERE id=? AND expires>?",key,now).first();if(!post)fail("This status has expired or is unavailable.",404);
 if(post.owner!==id)await requireFriend(db,id,post.owner);
 if(parts[3]==="view"&&req.method==="POST"){
  if(post.owner!==id)await q("INSERT INTO status_views(id,status,viewer,created)VALUES(?,?,?,?) ON CONFLICT(status,viewer) DO NOTHING",JSON.stringify([key,id]),key,id,new Date(now).toISOString()).run();return json({viewed:true});
 }
 if(parts.length===3&&req.method==="DELETE"){
  if(post.owner!==id)fail("You can only delete your own status.",403);
  if(post.media&&ctx.bucket)await ctx.bucket.delete("notes/"+post.media);
  await db.batch([q("DELETE FROM status_views WHERE status=?",key),q("DELETE FROM status_posts WHERE id=?",key),...(post.media?[q("DELETE FROM social_media WHERE id=?",post.media)]:[])]);return json({deleted:true});
 }
 return json({error:"Status endpoint not found."},404);
}
