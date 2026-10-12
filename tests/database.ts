import {DatabaseSync} from "node:sqlite";
import {readFileSync,readdirSync} from "node:fs";
import type {DB} from "../lib/service";
export function database():DB & {close():void} {
 const sqlite=new DatabaseSync(":memory:");
 for(const f of readdirSync("drizzle").filter(x=>x.endsWith(".sql")).sort())sqlite.exec(readFileSync("drizzle/"+f,"utf8").replaceAll("--> statement-breakpoint",""));
 const prepare=(sql:string)=>{let params:any[]=[];return{bind(...args:any[]){params=args;return this;},async first(){return sqlite.prepare(sql).get(...params)||null;},async all(){return{results:sqlite.prepare(sql).all(...params)};},async run(){return sqlite.prepare(sql).run(...params);}};};
 return{prepare,batch:async statements=>{sqlite.exec("BEGIN");try{const r=await Promise.all(statements.map(s=>s.run()));sqlite.exec("COMMIT");return r;}catch(e){sqlite.exec("ROLLBACK");throw e;}},close:()=>sqlite.close()} as DB & {close():void};
}
