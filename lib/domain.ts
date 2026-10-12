export const LGAS=["Ado","Agatu","Apa","Buruku","Gboko","Guma","Gwer East","Gwer West","Katsina-Ala","Konshisha","Kwande","Logo","Makurdi","Obi","Ogbadibo","Ohimini","Oju","Okpokwu","Otukpo","Tarka","Ukum","Ushongo","Vandeikya"];
export const categories:Record<string,string[]>={issue:["Road","Water","Streetlight","Drainage","Waste","Environment","Public facility","Other"],opportunity:["Volunteer","Job","Apprenticeship","Scholarship","Training","Internship","Event","Workshop"],skill:["Programming","Mathematics","Computer literacy","Graphic design","Tailoring","Electrical work","Carpentry","Agriculture","Entrepreneurship"],lost:["Lost","Found"],announcement:["Meeting","Program","Public notice","Cleanup","Education"],assistance:["Education","Food","Volunteer help","Public infrastructure","Other"],organization:["Community group","Nonprofit","Business","Education"]};
export const publicKinds=Object.keys(categories),privateKinds=["profile"],publicStatuses=["approved","verified","acknowledged","in-progress","resolved","closed"];
export const initialStatus=(kind:string)=>kind==="issue"?"submitted":kind==="profile"?"private":"pending";
export function text(v:unknown,name:string,min=1,max=200){if(typeof v!=="string"||v.trim().length<min||v.trim().length>max)throw new Error(name+" must be "+min+"–"+max+" characters.");return v.trim();}
export function coordinates(lat:unknown,lng:unknown){if(typeof lat!=="number"||typeof lng!=="number"||!Number.isFinite(lat)||!Number.isFinite(lng)||lat<6.3||lat>8.6||lng<7.2||lng>10.1)throw new Error("Choose coordinates in the Benue region.");return{lat:Math.round(lat*100)/100,lng:Math.round(lng*100)/100};}
export function validDate(value:string) {
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const date=new Date(value+"T00:00:00Z");
 return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10)===value;
}
export function validate(kind:string,d:Record<string,unknown>):Record<string,any>{
 if(kind==="profile"){if(!LGAS.includes(String(d.lga)))throw new Error("Choose a valid LGA.");return{name:text(d.name,"Display nickname",2,60),interests:text(d.interests,"Interests",2,400),lga:LGAS.includes(String(d.lga))?d.lga:"Otukpo",private:true};}
 if(!publicKinds.includes(kind))throw new Error("Choose a supported listing type.");
 if(!LGAS.includes(String(d.lga)))throw new Error("Choose a valid LGA.");
 if(!categories[kind].includes(String(d.category)))throw new Error("Choose a valid category.");
 const title=text(d.title,"Title",5,140),description=text(d.description,"Description",20,2000);
 if(["lost","assistance"].includes(kind)&&/\b\d{6,}\b/.test(title+" "+description))throw new Error("Remove identification numbers, phone numbers and sensitive details from this public description.");
 const c=coordinates(d.lat,d.lng),website=String(d.website||"").trim();
 if(website){
  let url:URL;try{url=new URL(website);}catch{throw new Error("Website must be a valid HTTPS URL.");}
  if(url.protocol!=="https:"||!url.hostname||url.username||url.password||/\s/.test(website))throw new Error("Website must be HTTPS without embedded credentials.");
 }
 const deadline=String(d.deadline||""),eventDate=String(d.eventDate||"");
 if(deadline&&!validDate(deadline))throw new Error("Choose a valid deadline date.");
 if(eventDate&&!validDate(eventDate))throw new Error("Choose a valid event date.");
 if(kind==="opportunity"&&!String(d.instructions||"").trim())throw new Error("Add application or participation instructions.");
 return{title,description,category:d.category,lga:d.lga,town:text(d.town||d.lga,"Town",2,100),area:text(d.area||d.town||d.lga,"General area",2,150),...c,website,deadline,eventDate,organization:String(d.organization||"").slice(0,100),instructions:String(d.instructions||"").slice(0,1000),availability:String(d.availability||"").slice(0,200),skillMode:d.skillMode==="request"?"request":"offer",photo:String(d.photo||""),source:"Community submission",contactPrivate:true};
}
export function canTransition(kind:string,from:string,to:string){
 const transitions:Record<string,string[]>=kind==="issue"?{submitted:["awaiting-review","rejected"],"awaiting-review":["verified","rejected"],verified:["acknowledged","rejected"],acknowledged:["in-progress"],"in-progress":["resolved"],resolved:["closed","in-progress"],closed:["in-progress"],rejected:["awaiting-review"]}:{pending:["under-review","approved","rejected"],"under-review":["approved","rejected"],approved:["under-review"],rejected:["under-review"]};
 return transitions[from]?.includes(to)||false;
}
export function isJoinable(data:Record<string,any>,today=new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Lagos"}).format(new Date())){return["Volunteer","Event","Workshop"].includes(data.category)&&(!data.deadline||data.deadline>=today)&&(!data.eventDate||data.eventDate>=today);}
export function aggregate(rows:{kind:string;status:string;data:Record<string,any>}[]){const issues=rows.filter(r=>r.kind==="issue");return{issues:issues.length,open:issues.filter(r=>!["resolved","closed"].includes(r.status)).length,resolved:issues.filter(r=>["resolved","closed"].includes(r.status)).length,opportunities:rows.filter(r=>r.kind==="opportunity").length,categories:issues.reduce((a:Record<string,number>,r)=>(a[r.data.category]=(a[r.data.category]||0)+1,a),{})};}
export function calendar(title:string,date:string,description:string){
 if(!validDate(date))throw new Error("Choose a valid event date.");
 const escape=(s:string)=>s.replace(/\\/g,"\\\\").replace(/\r\n|\r|\n/g,"\\n").replace(/;/g,"\\;").replace(/,/g,"\\,");
 const day=date.replace(/-/g,""),end=new Date(date+"T00:00:00Z");end.setUTCDate(end.getUTCDate()+1);
 return["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//CommunityConnect//Events//EN","BEGIN:VEVENT","UID:"+day+"-"+title.replace(/[^a-z0-9]/gi,"").slice(0,50)+"@communityconnect","DTSTAMP:"+new Date().toISOString().replace(/[-:]/g,"").replace(/\.\d{3}/,""),"DTSTART;VALUE=DATE:"+day,"DTEND;VALUE=DATE:"+end.toISOString().slice(0,10).replace(/-/g,""),"SUMMARY:"+escape(title),"DESCRIPTION:"+escape(description),"END:VEVENT","END:VCALENDAR",""].join("\r\n");
}
