import{env}from"cloudflare:workers";import{getChatGPTUser}from"../../chatgpt-auth";import{handle,json}from"../../../lib/service";
async function route(req:Request){
 if(!env.DB)return json({error:"Database unavailable."},503);
 const vars=env as unknown as{ADMIN_USER_IDS?:string;ADMIN_EMAILS?:string;MYMEMORY_API_KEY?:string;RTC_TURN_URLS?:string;RTC_TURN_SECRET?:string};
 return handle(req,{db:env.DB,user:await getChatGPTUser(),adminIds:(vars.ADMIN_USER_IDS||"").split(",").filter(Boolean),adminEmails:(vars.ADMIN_EMAILS||"").toLowerCase().split(",").filter(Boolean),bucket:env.BUCKET,translation:{apiKey:vars.MYMEMORY_API_KEY},rtc:{urls:vars.RTC_TURN_URLS,secret:vars.RTC_TURN_SECRET}});
}
export const GET=route,POST=route,PATCH=route,DELETE=route;
