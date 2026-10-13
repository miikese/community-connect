// Server-side provisioning. Never creates a browser-exposed default password.
import {DatabaseSync} from "node:sqlite";
import {readFileSync,readdirSync,mkdirSync} from "node:fs";
import {resolve} from "node:path";
import {passwordHash} from "../.local-build/service.mjs";
const args=process.argv.slice(2),email=String(args[args.indexOf("--email")+1]||"").trim().toLowerCase(),name=args.includes("--name")?args[args.indexOf("--name")+1]:"Platform administrator";
if(!args.includes("--email")||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error("Provide --email and optionally --name.");
process.stderr.write("Super-admin password: ");
let password;
if(process.stdin.isTTY){password=await new Promise((resolve,reject)=>{let value="";process.stdin.setRawMode(true);process.stdin.setEncoding("utf8");process.stdin.resume();const onData=chunk=>{for(const char of chunk){if(char==="\u0003"){process.stdin.setRawMode(false);process.exit(130);}if(char==="\r"||char==="\n"){process.stdin.setRawMode(false);process.stdin.pause();process.stdin.off("data",onData);process.stderr.write("\n");resolve(value);return;}if(char==="\u007f"){value=value.slice(0,-1);continue;}value+=char;if(value.length>128){process.stdin.setRawMode(false);reject(new Error("Password too long."));return;}}};process.stdin.on("data",onData);});}else password=readFileSync(0,"utf8").replace(/[\r\n]+$/,"");
if(new TextEncoder().encode(password).length<8||new TextEncoder().encode(password).length>128)throw new Error("Password must be 8–128 bytes.");
const hash=await passwordHash(password);password="";
const state=resolve(process.env.APP_STATE_DIR||".local-state");mkdirSync(state,{recursive:true});const db=new DatabaseSync(state+"/data.sqlite");db.exec("PRAGMA foreign_keys=ON;CREATE TABLE IF NOT EXISTS _migrations(name TEXT PRIMARY KEY)");
for(const f of readdirSync("drizzle").filter(f=>f.endsWith(".sql")).sort())if(!db.prepare("SELECT name FROM _migrations WHERE name=?").get(f)){db.exec("BEGIN");try{db.exec(readFileSync("drizzle/"+f,"utf8"));db.prepare("INSERT INTO _migrations VALUES(?)").run(f);db.exec("COMMIT");}catch(e){db.exec("ROLLBACK");throw e;}}
const prior=db.prepare("SELECT user_id FROM credentials WHERE email=?").get(email),id=prior?.user_id||crypto.randomUUID();
db.exec("BEGIN");try{db.prepare("INSERT INTO users(id,name,role) VALUES(?,?,'super-admin') ON CONFLICT(id) DO UPDATE SET name=excluded.name,role='super-admin'").run(id,name);db.prepare("INSERT INTO credentials(user_id,email,password_hash) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET password_hash=excluded.password_hash").run(id,email,hash);db.prepare("DELETE FROM account_sessions WHERE user_id=?").run(id);db.exec("COMMIT");}catch(e){db.exec("ROLLBACK");throw e;}db.close();console.log("Super admin ready. Use the account sign-in form.");
