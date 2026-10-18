"use client";
import {useEffect,useRef,useState} from "react";
import {Mic,MicOff,Phone,PhoneOff,Users,Video,VideoOff,Volume2,X} from "lucide-react";
import {api} from "../lib/client";
import {claimMediaSession,releaseMediaSession} from "../lib/media-session";
import {Avatar,type Person} from "./social";
type Participant=Person&{session:string;muted:number;camera:number};
type Room={id:string;thread:string;name:string;mode:"voice"|"video";host:string;status:string;participants:Participant[]};
type Active={room:Room;session:string;userId:string};
type Peer={pc:RTCPeerConnection;session:string;busy:boolean};
async function gathered(pc:RTCPeerConnection){if(pc.iceGatheringState==="complete")return;await new Promise<void>(resolve=>{const finish=()=>{clearTimeout(timer);pc.removeEventListener("icegatheringstatechange",changed);resolve()},changed=()=>{if(pc.iceGatheringState==="complete")finish()},timer=setTimeout(finish,8000);pc.addEventListener("icegatheringstatechange",changed)})}
export function GroupCallDock(){
 const [active,setActive]=useState<Active|null>(null),[starting,setStarting]=useState(false),[local,setLocal]=useState<MediaStream|null>(null),[remote,setRemote]=useState<Record<string,MediaStream>>({}),[statuses,setStatuses]=useState<Record<string,string>>({}),[invitations,setInvitations]=useState<Room[]>([]),[dismissed,setDismissed]=useState<string[]>([]),[error,setError]=useState(""),[muted,setMuted]=useState(false),[camera,setCamera]=useState(true),[seconds,setSeconds]=useState(0),[audioBlocked,setAudioBlocked]=useState(false);
 const current=useRef<Active|null>(null),media=useRef<MediaStream|null>(null),peers=useRef(new Map<string,Peer>()),config=useRef<RTCIceServer[]>([]),processed=useRef(new Set<string>()),generation=useRef(0),alive=useRef(true),operation=useRef(false),polling=useRef(false),lease=useRef("group-call:"+crypto.randomUUID()),controls=useRef({muted:false,camera:true}),began=useRef(0),pollRef=useRef<()=>Promise<void>>(async()=>{}),authorized=useRef(false);
 const cleanup=()=>{generation.current++;operation.current=false;for(const entry of peers.current.values())entry.pc.close();peers.current.clear();processed.current.clear();media.current?.getTracks().forEach(t=>t.stop());media.current=null;releaseMediaSession(lease.current);current.current=null;began.current=0;if(alive.current){setActive(null);setStarting(false);setLocal(null);setRemote({});setStatuses({});setSeconds(0);setMuted(false);setCamera(true);setAudioBlocked(false)}};
 const finish=async(action="leave",message="")=>{const before=current.current;cleanup();if(message&&alive.current)setError(message);if(before)try{await api("social/group-calls","PATCH",{id:before.room.id,session:before.session,action})}catch{}};
 const sendSignal=(room:Active,peer:Participant,kind:string,sdp:string)=>api("social/group-signals","POST",{id:room.room.id,session:room.session,target:peer.user_id,targetSession:peer.session,kind,sdp});
 const makePeer=(person:Participant,token:number)=>{
  const pc=new RTCPeerConnection({iceServers:config.current}),entry={pc,session:person.session,busy:false};peers.current.set(person.user_id,entry);
  for(const track of media.current!.getTracks()){const sender=pc.addTrack(track,media.current!);if(track.kind==="video"){const params=sender.getParameters();if(params.encodings?.length){params.encodings[0].maxBitrate=450000;void sender.setParameters(params).catch(()=>{})}}}
  pc.ontrack=e=>{if(token===generation.current&&alive.current)setRemote(previous=>({...previous,[person.user_id]:e.streams[0]||new MediaStream([e.track])}))};
  pc.onconnectionstatechange=()=>{if(token!==generation.current||!alive.current)return;setStatuses(previous=>({...previous,[person.user_id]:pc.connectionState}));if(pc.connectionState==="failed")setError("Couldn’t connect to @"+person.handle+". Try leaving and rejoining, or use another network.")};
  return entry;
 };
 pollRef.current=async()=>{
  if(polling.current||operation.current||!alive.current)return;polling.current=true;const before=current.current,token=generation.current;
  try{
   if(!before){if(authorized.current&&!document.hidden){const result=await api("social/group-calls");if(token===generation.current)setInvitations(result.calls)}return}
   const result=await api("social/group-calls?id="+before.room.id+"&session="+before.session);if(token!==generation.current)return;
   const room=result.call as Room&{joined:boolean};if(room.status!=="active"||!room.joined){await finish("leave","The group call has ended or your session has moved to another tab.");return}
   const next={...before,room};current.current=next;setActive(next);
   for(const [user,entry] of peers.current){const person=room.participants.find(p=>p.user_id===user);if(!person||person.session!==entry.session){entry.pc.close();peers.current.delete(user);setRemote(old=>{const copy={...old};delete copy[user];return copy});setStatuses(old=>{const copy={...old};delete copy[user];return copy})}}
   await Promise.all(room.participants.filter(person=>person.user_id!==before.userId&&before.userId<person.user_id&&!peers.current.has(person.user_id)).map(async person=>{
    const entry=makePeer(person,token);entry.busy=true;try{await entry.pc.setLocalDescription(await entry.pc.createOffer());await gathered(entry.pc);if(token!==generation.current)return;await sendSignal(next,person,"offer",entry.pc.localDescription!.sdp)}finally{entry.busy=false}
   }));
   for(const signal of result.signals){
    if(processed.current.has(signal.id))continue;const person=room.participants.find(p=>p.user_id===signal.sender&&p.session===signal.from_session);if(!person)continue;
    let entry=peers.current.get(person.user_id);if(entry?.busy)continue;
    if(signal.kind==="offer"){
     entry=entry||makePeer(person,token);entry.busy=true;try{if(!entry.pc.remoteDescription){await entry.pc.setRemoteDescription({type:"offer",sdp:signal.sdp});await entry.pc.setLocalDescription(await entry.pc.createAnswer());await gathered(entry.pc)}if(token!==generation.current)return;await sendSignal(next,person,"answer",entry.pc.localDescription!.sdp)}finally{entry.busy=false}
    }else if(entry&&!entry.pc.remoteDescription)await entry.pc.setRemoteDescription({type:"answer",sdp:signal.sdp});
    processed.current.add(signal.id);
   }
  }catch(e){if(before&&token===generation.current){const message=(e as Error).message;if(/no longer|blocked|not found|ended|rejoin|sign in/i.test(message))await finish("leave",message);else setError("Call updates are delayed. Check your connection, or leave and rejoin the call.")}}finally{polling.current=false}
 };
 const start=async(thread:{id:string;name:string},mode:"voice"|"video")=>{
  if(current.current||operation.current||!claimMediaSession(lease.current)){setError("Finish your current call or recording before joining a group call.");return}
  operation.current=true;setStarting(true);setError("");const token=++generation.current,session=crypto.randomUUID();
  try{
   if(!navigator.mediaDevices?.getUserMedia||!window.isSecureContext)throw new Error("Use HTTPS or localhost with microphone support to join a call.");
   const [ice,identity]=await Promise.all([api("social/ice"),api("auth/status")]);if(!identity.user)throw new Error("Sign in before joining a group call.");
   const acquired=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:mode==="video"?{width:{ideal:640},height:{ideal:360},frameRate:{ideal:15,max:20},facingMode:"user"}:false});
   if(token!==generation.current){acquired.getTracks().forEach(t=>t.stop());return}media.current=acquired;config.current=ice.iceServers;
   const result=await api("social/group-calls","POST",{id:crypto.randomUUID(),thread:thread.id,mode,session});
   if(token!==generation.current){void api("social/group-calls","PATCH",{id:result.call.id,session,action:"leave"}).catch(()=>{});acquired.getTracks().forEach(t=>t.stop());return}
   const next={room:result.call,session,userId:identity.user.userId};current.current=next;setActive(next);setLocal(acquired);controls.current={muted:false,camera:mode==="video"};setMuted(false);setCamera(mode==="video");began.current=Date.now();setInvitations([]);
  }catch(e){if(token===generation.current){const err=e as Error;await finish("leave",err.name==="NotAllowedError"?"Microphone or camera permission was declined. Allow access to join the call.":err.name==="NotFoundError"?"A microphone or camera was not found on this device.":err.message)}}finally{if(token===generation.current){operation.current=false;setStarting(false);void pollRef.current()}}
 };
 useEffect(()=>{
  alive.current=true;void api("auth/status").then(d=>authorized.current=!!d.user).catch(()=>{});
  const begin=(event:Event)=>{const detail=(event as CustomEvent).detail;if(detail?.thread?.id&&["voice","video"].includes(detail.mode))void start(detail.thread,detail.mode)};
  const leave=()=>{const before=current.current;if(before)void fetch("/api/social/group-calls",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({id:before.room.id,session:before.session,action:"leave"}),keepalive:true}).catch(()=>{});cleanup()};
  const poll=setInterval(()=>void pollRef.current(),2200),heartbeat=setInterval(()=>{const room=current.current;if(room)void api("social/group-calls","PATCH",{id:room.room.id,session:room.session,action:"heartbeat",...controls.current}).catch(()=>{})},20000),clock=setInterval(()=>{if(began.current)setSeconds(Math.floor((Date.now()-began.current)/1000))},1000);
  window.addEventListener("community-start-group-call",begin);window.addEventListener("pagehide",leave);return()=>{alive.current=false;clearInterval(poll);clearInterval(heartbeat);clearInterval(clock);window.removeEventListener("community-start-group-call",begin);window.removeEventListener("pagehide",leave);leave()};
 },[]);
 const toggle=(kind:"audio"|"video")=>{if(kind==="audio"){const next=!controls.current.muted;controls.current.muted=next;media.current?.getAudioTracks().forEach(t=>t.enabled=!next);setMuted(next)}else{const next=!controls.current.camera;controls.current.camera=next;media.current?.getVideoTracks().forEach(t=>t.enabled=next);setCamera(next)}const room=current.current;if(room)void api("social/group-calls","PATCH",{id:room.room.id,session:room.session,action:"heartbeat",...controls.current}).catch(()=>{})};
 const invitation=invitations.find(room=>!dismissed.includes(room.id));
 return <>{error&&<div className="call-toast group-call-error" role="status"><span>{error}</span><button className="icon-button" aria-label="Dismiss group call message" onClick={()=>setError("")}><X size={17}/></button></div>}
 {!active&&!starting&&invitation&&<div className="group-call-invitation" role="status"><span className="group-invite-icon"><Users size={22}/></span><div><strong>{invitation.name}</strong><small>A group {invitation.mode} call is in progress</small></div><button className="button small" onClick={()=>void start({id:invitation.thread,name:invitation.name},invitation.mode)}>Join call</button><button className="icon-button" aria-label="Dismiss group call invitation" onClick={()=>setDismissed([...dismissed,invitation.id])}><X size={17}/></button></div>}
 {(active||starting)&&<section className="group-call-panel" role="dialog" aria-label="Group call"><header><div><span className="messenger-overline">TOGETHER, WHEREVER YOU ARE</span><h2>{active?.room.name||"Your group call"}</h2><p>{starting?"Getting your microphone and camera ready…":active!.room.participants.length+" of 6 people · "+Math.floor(seconds/60)+":"+String(seconds%60).padStart(2,"0")}</p></div><span className="group-call-mode">{active?.room.mode==="video"?<Video size={17}/>:<Phone size={17}/>}</span></header>
 {active&&<div className="group-video-grid">{active.room.participants.map(person=><CallTile key={person.user_id+person.session} person={person} stream={person.user_id===active.userId?local:remote[person.user_id]||null} local={person.user_id===active.userId} video={active.room.mode==="video"&&(person.user_id===active.userId?camera:!!person.camera)} muted={person.user_id===active.userId?muted:!!person.muted} status={person.user_id===active.userId?"You":statuses[person.user_id]==="connected"?"Connected":"Connecting…"} onBlocked={()=>setAudioBlocked(true)}/>)}</div>}
 {active&&active.room.participants.length===1&&<p className="group-waiting">You’re here first. Your group can join from their conversation or call invitation.</p>}
 {audioBlocked&&<button className="button small" onClick={()=>{document.querySelectorAll<HTMLVideoElement>(".group-video-grid video").forEach(video=>void video.play().catch(()=>{}));setAudioBlocked(false)}}><Volume2 size={15}/>Enable call audio</button>}
 <div className="group-call-controls">{active&&<><button className={"icon-button "+(muted?"is-off":"")} aria-label={muted?"Unmute group microphone":"Mute group microphone"} onClick={()=>toggle("audio")}>{muted?<MicOff size={21}/>:<Mic size={21}/>}</button>{active.room.mode==="video"&&<button className={"icon-button "+(!camera?"is-off":"")} aria-label={camera?"Turn group camera off":"Turn group camera on"} onClick={()=>toggle("video")}>{camera?<Video size={21}/>:<VideoOff size={21}/>}</button>}</>}<button className="button group-hangup" onClick={()=>void finish()}><PhoneOff size={19}/>{starting?"Cancel":"Leave call"}</button>{active?.room.host===active?.userId&&active&&<button className="text-button group-end-all" onClick={()=>void finish("end")}>End for everyone</button>}</div></section>}
 </>;
}
function CallTile({person,stream,local,video,muted,status,onBlocked}:{person:Participant;stream:MediaStream|null;local:boolean;video:boolean;muted:boolean;status:string;onBlocked:()=>void}){
 const element=useRef<HTMLVideoElement>(null);
 useEffect(()=>{if(element.current&&stream){element.current.srcObject=stream;void element.current.play().catch(onBlocked)}},[stream]);
 return <div data-peer={person.user_id} data-local={local?"true":"false"} className={"group-video-tile "+(!video?"audio-only":"")}><video ref={element} autoPlay playsInline muted={local} className={video?"":"camera-hidden"}/>{(!video||!stream)&&<Avatar person={person}/>}<div className="group-tile-label"><strong>{local?"You":person.name}</strong><span>{muted?<MicOff size={13}/>:null}{status}</span></div></div>;
}
