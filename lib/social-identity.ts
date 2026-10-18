import type {DB,Identity} from "./service";
export const usernamePattern=/^[a-z][a-z0-9_]{2,23}$/;
export async function chooseUsername(db:DB,requested?:unknown){
 if(requested!==undefined){
  if(typeof requested!=="string"||!usernamePattern.test(requested.trim().toLowerCase()))throw Object.assign(new Error("Choose a username of 3–24 letters, numbers or underscores, starting with a letter."),{status:400});
  const name=requested.trim().toLowerCase();
  if(await db.prepare("SELECT user_id FROM social_profiles WHERE handle=?").bind(name).first())throw Object.assign(new Error("That username is already in use."),{status:409});
  return name;
 }
 return "member_"+crypto.randomUUID().replaceAll("-","").slice(0,12);
}
export async function ensureSocialIdentity(db:DB,user:NonNullable<Identity>){
 await db.prepare("INSERT INTO users(id,name,role) VALUES(?,?,'member') ON CONFLICT(id) DO NOTHING").bind(user.userId,user.displayName).run();
 let profile=await db.prepare("SELECT * FROM social_profiles WHERE user_id=?").bind(user.userId).first();
 if(!profile){
  const username=await chooseUsername(db),now=new Date().toISOString(),name=user.displayName.includes("@")?"Community member":user.displayName.trim().slice(0,40)||"Community member";
  await db.prepare("INSERT INTO social_profiles(user_id,handle,name,created,updated) VALUES(?,?,?,?,?) ON CONFLICT(user_id) DO NOTHING").bind(user.userId,username,name,now,now).run();
  profile=await db.prepare("SELECT * FROM social_profiles WHERE user_id=?").bind(user.userId).first();
 }
 return profile;
}
