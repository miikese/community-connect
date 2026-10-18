import {beforeEach,afterEach,it,expect} from "vitest";
import {database} from "./database";
import {handle,type Context} from "../lib/service";
let db:ReturnType<typeof database>,ctx:Context,files:Map<string,Uint8Array>;
const base="https://example.test/api/",sdp="v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\n";
async function call(who:string|null,path:string,method="GET",data?:unknown){ctx.user=who?{userId:who,displayName:who}:null;const response=await handle(new Request(base+path,{method,headers:{"content-type":"application/json"},...(data?{body:JSON.stringify(data)}:{})}),ctx);return{status:response.status,body:await response.json() as any,headers:response.headers}}
async function friend(a:string,b:string){for(const who of [a,b])await call(who,"social/profile","POST",{handle:who+"_person",name:who+" person",discoverable:true});await call(a,"social/friends","POST",{peer:b});await call(b,"social/friends","PATCH",{peer:a,action:"accept"})}
async function group(){await friend("alice","bob");await friend("alice","carol");const result=await call("alice","social/groups","POST",{name:"Our circle",members:["bob","carol"],requestId:crypto.randomUUID()});expect(result.status).toBe(201);return result.body.id as string}
async function upload(who:string,query:string,kind="voice",bytes=new Uint8Array([26,69,223,163,...Array(64).fill(0)]),mime="audio/webm"){
 ctx.user={userId:who,displayName:who};const response=await handle(new Request(base+"social/media?"+query,{method:"POST",headers:{"content-type":mime,"x-note-kind":kind,"x-note-duration-ms":"1800"},body:bytes}),ctx);return{status:response.status,body:await response.json() as any}
}
beforeEach(()=>{db=database();files=new Map();ctx={db,user:null,adminIds:[],bucket:{async put(key:string,body:Uint8Array){files.set(key,body)},async get(key:string,options?:any){let body=files.get(key);if(!body)return null;if(options?.range)body=body.slice(options.range.offset,options.range.offset+options.range.length);return{body}},async delete(key:string){files.delete(key)}} as unknown as R2Bucket}});
afterEach(()=>db.close());

it("gives every account a private unique username and rejects username collisions at signup",async()=>{
 const first=await call(null,"auth/register","POST",{name:"Alice",email:"alice@example.test",password:"testing-password",username:"alice_2026"});expect(first.status).toBe(201);expect(first.body.user.username).toBe("alice_2026");
 expect((await call(null,"auth/register","POST",{name:"Bob",email:"bob@example.test",password:"testing-password",username:"ALICE_2026"})).status).toBe(409);
 expect((await call(null,"auth/register","POST",{name:"Bob",email:"bob@example.test",password:"testing-password",username:"bad username"})).status).toBe(400);
 expect((await call("legacy","social/home")).body.profile.handle).toMatch(/^member_[a-f0-9]+$/);
 const profile=(await call("legacy","social/profile")).body.profile;expect(profile.discoverable).toBe(0);expect((await call("legacy","social/profile")).body.profile.handle).toBe(profile.handle);
});

it("creates groups with accepted friends, isolates history, and removes access after leaving",async()=>{
 await friend("alice","bob");await call("stranger","me");expect((await call("alice","social/groups","POST",{name:"Invalid",members:["stranger"],requestId:crypto.randomUUID()})).status).toBe(403);
 const request={name:"Friends",members:["bob"],requestId:crypto.randomUUID()},created=await call("alice","social/groups","POST",request),thread=created.body.id;
 expect((await call("alice","social/groups","POST",request)).body.id).toBe(thread);
 expect((await call("bob","social/groups")).body.groups[0].members).toHaveLength(2);
 expect((await call("stranger","social/group-messages?thread="+thread)).status).toBe(404);
 const sent=await call("alice","social/group-messages","POST",{thread,body:"Hello group",requestId:crypto.randomUUID()});expect(sent.status).toBe(201);
 expect((await call("bob","social/group-messages?thread="+thread)).body.messages[0].body).toBe("Hello group");
 expect((await call("bob","social/groups","PATCH",{thread,action:"leave"})).status).toBe(200);
 expect((await call("bob","social/group-messages?thread="+thread)).status).toBe(404);
 expect((await call("bob","social/group-messages","POST",{thread,body:"Not allowed",requestId:crypto.randomUUID()})).status).toBe(404);
 expect((await call("alice","social/groups","POST",{name:"Too big",members:["a","b","c","d","e","f"],requestId:crypto.randomUUID()})).status).toBe(400);
});

it("tracks group unread counts and member read receipts without allowing future cursors",async()=>{
 const thread=await group(),sent=(await call("alice","social/group-messages","POST",{thread,body:"A new message",requestId:crypto.randomUUID()})).body.message;
 expect((await call("bob","social/groups")).body.groups[0].unread).toBe(1);
 await call("bob","social/group-read","POST",{thread,through:999999});
 expect((await call("alice","social/group-messages?thread="+thread)).body.messages[0]).toMatchObject({read_count:1,recipient_count:2});
 await call("carol","social/chat-state","POST",{thread,unread:false});expect((await call("alice","social/group-messages?thread="+thread)).body.messages[0].read_count).toBe(2);
 await call("bob","social/chat-state","POST",{thread,unread:true,pinned:true});
 const bob=(await call("bob","social/groups")).body.groups[0];expect(bob).toMatchObject({unread:0,manual_unread:1,pinned:1});
 expect((await call("alice","social/group-messages?thread="+thread)).body.messages[0].read_count).toBe(2);
 await call("alice","social/group-messages","POST",{thread,body:"Still unread",requestId:crypto.randomUUID()});expect((await call("bob","social/groups")).body.groups[0].unread).toBe(1);
 expect((await call("bob","social/home")).body.groupUnread).toBe(1);
 expect(sent.seq).toBeGreaterThan(0);
});

it("persists direct unread reminders without withdrawing receipts and supports mark-all-read",async()=>{
 await friend("alice","bob");await call("alice","social/messages","POST",{peer:"bob",body:"Hello",requestId:crypto.randomUUID()});
 await call("bob","social/chat-state","POST",{peer:"alice",unread:false});expect((await call("alice","social/messages?peer=bob")).body.messages[0].read_at).toBeTruthy();
 await call("bob","social/chat-state","POST",{peer:"alice",unread:true,pinned:true});
 expect((await call("bob","social/home")).body.relations[0]).toMatchObject({unread:0,manual_unread:1,pinned:1});
 expect((await call("alice","social/messages?peer=bob")).body.messages[0].read_at).toBeTruthy();
});

it("stores playable recordings privately, serves byte ranges, and checks the intended recipient",async()=>{
 await friend("alice","bob");const note=await upload("alice","peer=bob");expect(note.status).toBe(201);
 expect(files.size).toBe(1);
 ctx.user={userId:"bob",displayName:"Bob"};expect((await handle(new Request(base+"social/media/"+note.body.id),ctx)).status).toBe(404);
 const sent=await call("alice","social/messages","POST",{peer:"bob",kind:"voice",media:note.body.id,requestId:crypto.randomUUID()});expect(sent.status).toBe(201);
 expect((await call("bob","social/messages?peer=alice")).body.messages[0]).toMatchObject({kind:"voice",duration:1800,media_mime:"audio/webm"});
 ctx.user={userId:"bob",displayName:"Bob"};let response=await handle(new Request(base+"social/media/"+note.body.id,{headers:{range:"bytes=0-15"}}),ctx);expect(response.status).toBe(206);expect((await response.arrayBuffer()).byteLength).toBe(16);expect(response.headers.get("cache-control")).toContain("private");
 response=await handle(new Request(base+"social/media/"+note.body.id,{headers:{range:"bytes=9999-"}}),ctx);expect(response.status).toBe(416);
 ctx.user={userId:"stranger",displayName:"Stranger"};expect((await handle(new Request(base+"social/media/"+note.body.id),ctx)).status).toBe(404);
 ctx.user=null;expect((await handle(new Request(base+"social/media/"+note.body.id),ctx)).status).toBe(401);
 expect((await call("alice","social/media/"+note.body.id,"DELETE")).status).toBe(409);
});

it("validates recordings, prevents cross-conversation reuse, and removes discarded drafts",async()=>{
 await friend("alice","bob");await friend("alice","carol");
 expect((await upload("alice","peer=bob","voice",new Uint8Array(30),"audio/webm")).status).toBe(400);
 expect((await upload("alice","peer=bob","voice",new Uint8Array(30),"text/html")).status).toBe(415);
 const note=(await upload("alice","peer=bob")).body;
 expect((await call("alice","social/messages","POST",{peer:"carol",kind:"voice",media:note.id,requestId:crypto.randomUUID()})).status).toBe(403);
 expect((await call("bob","social/media/"+note.id,"DELETE")).status).toBe(404);
 expect((await call("alice","social/media/"+note.id,"DELETE")).status).toBe(200);expect(files.size).toBe(0);
});

it("restricts group recordings to current members, including after blocks and account deletion",async()=>{
 const thread=await group(),note=(await upload("alice","thread="+thread,"video",new Uint8Array([26,69,223,163,...Array(64).fill(0)]),"video/webm")).body;
 await call("alice","social/group-messages","POST",{thread,kind:"video",media:note.id,requestId:crypto.randomUUID()});
 ctx.user={userId:"bob",displayName:"Bob"};expect((await handle(new Request(base+"social/media/"+note.id),ctx)).status).toBe(200);
 await call("bob","social/groups","PATCH",{thread,action:"leave"});ctx.user={userId:"bob",displayName:"Bob"};expect((await handle(new Request(base+"social/media/"+note.id),ctx)).status).toBe(404);
 await call("carol","social/block","POST",{peer:"alice"});ctx.user={userId:"carol",displayName:"Carol"};expect((await handle(new Request(base+"social/media/"+note.id),ctx)).status).toBe(403);
 expect((await call("alice","account","DELETE")).status).toBe(200);expect(files.size).toBe(0);
});

it("authorizes group call offers/answers, supports members who are not direct friends, and ends cleanly",async()=>{
 const thread=await group(),a=crypto.randomUUID(),b=crypto.randomUUID(),c=crypto.randomUUID(),start=await call("alice","social/group-calls","POST",{id:crypto.randomUUID(),thread,mode:"video",session:a}),id=start.body.call.id;expect(start.status).toBe(201);
 expect((await call("bob","social/group-calls","POST",{id:crypto.randomUUID(),thread,mode:"video",session:b})).status).toBe(201);
 expect((await call("carol","social/group-calls","POST",{id:crypto.randomUUID(),thread,mode:"video",session:c})).status).toBe(201);
 expect((await call("stranger","social/group-calls?id="+id)).status).toBe(404);
 expect((await call("alice","social/group-signals","POST",{id,session:a,target:"bob",targetSession:b,kind:"offer",sdp})).status).toBe(200);
 expect((await call("bob","social/group-calls?id="+id+"&session="+b)).body.signals).toHaveLength(1);
 expect((await call("carol","social/group-calls?id="+id+"&session="+c)).body.signals).toHaveLength(0);
 expect((await call("carol","social/group-calls","PATCH",{id,session:a,action:"leave"})).status).toBe(404);
 expect((await call("bob","social/group-calls?id="+id+"&session="+b)).body.signals).toHaveLength(1);
 expect((await call("bob","social/group-signals","POST",{id,session:b,target:"alice",targetSession:a,kind:"answer",sdp})).status).toBe(200);
 expect((await call("carol","social/group-calls","PATCH",{id,session:c,action:"end"})).status).toBe(403);
 await call("bob","social/group-calls","PATCH",{id,session:b,action:"leave"});expect((await call("alice","social/group-calls?id="+id+"&session="+a)).body.call.participants).toHaveLength(2);
 expect((await call("alice","social/group-calls","PATCH",{id,session:a,action:"end"})).status).toBe(200);
 expect((await call("carol","social/group-calls?id="+id+"&session="+c)).body.call.status).toBe("ended");
 expect((await db.prepare("SELECT * FROM group_call_signals").all()).results).toHaveLength(0);
});

it("prevents stale sessions, conflicting calls, invalid signaling and access after a group departure",async()=>{
 const thread=await group(),session=crypto.randomUUID(),started=await call("alice","social/group-calls","POST",{id:crypto.randomUUID(),thread,mode:"voice",session}),id=started.body.call.id;
 expect((await call("alice","social/group-calls","POST",{id:crypto.randomUUID(),thread,mode:"voice",session:crypto.randomUUID()})).status).toBe(409);
 expect((await call("alice","social/calls","POST",{id:crypto.randomUUID(),peer:"bob",mode:"voice",offer:sdp})).status).toBe(409);
 expect((await call("alice","social/group-signals","POST",{id,session,target:"bob",targetSession:crypto.randomUUID(),kind:"offer",sdp})).status).toBe(409);
 expect((await call("alice","social/group-calls","PATCH",{id,session:crypto.randomUUID(),action:"heartbeat",muted:false,camera:false})).status).toBe(409);
 await call("alice","social/groups","PATCH",{thread,action:"leave"});expect((await call("alice","social/group-calls?id="+id)).status).toBe(404);
 expect((await call("bob","social/group-calls","PATCH",{id,session,action:"leave"})).status).toBe(404);
});

it("keeps an account accessible if private recording cleanup fails during deletion",async()=>{
 await db.prepare("INSERT INTO users(id,name,role) VALUES('native-user','Native user','member')").run();
 await db.prepare("INSERT INTO credentials(user_id,email,password_hash) VALUES('native-user','native@example.test','fixture-hash')").run();
 await db.prepare("INSERT INTO social_media(id,owner,peer,kind,mime,size,duration,created) VALUES(?,'native-user','bob','voice','audio/webm',68,1800,?)").bind(crypto.randomUUID(),new Date().toISOString()).run();
 ctx.bucket={...ctx.bucket,delete:async()=>{throw new Error("Storage is temporarily unavailable.")}} as R2Bucket;
 expect((await call("native-user","account","DELETE")).status).not.toBe(200);
 expect(await db.prepare("SELECT user_id FROM credentials WHERE user_id='native-user'").first()).toBeTruthy();
 expect(await db.prepare("SELECT id FROM users WHERE id='native-user'").first()).toBeTruthy();
});
