"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {Mic,Video,Send,Square,Trash2,RotateCcw,Paperclip,Smile} from "lucide-react";
import {api} from "../lib/client";
import {claimMediaSession,releaseMediaSession} from "../lib/media-session";
import {MemeEditor,Attachment,fileDraft,deviceAccept,type DeviceDraft} from "./media-tools";
export type ChatTarget={peer?:string;thread?:string};
type Draft={kind:"voice"|"video"|"image"|"file";blob:Blob;duration:number;url:string;media?:string;filename?:string;device?:boolean};
const elapsed=(ms:number)=>Math.floor(ms/60000)+":"+String(Math.floor(ms/1000)%60).padStart(2,"0");
export function MessageComposer({target,name,onSent}:{target:ChatTarget;name:string;onSent:(message:any)=>void}){
 const [body,setBody]=useState(""),[draft,setDraft]=useState<Draft|null>(null),[recording,setRecording]=useState<"voice"|"video"|null>(null),[time,setTime]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState(""),[requesting,setRequesting]=useState(false),[meme,setMeme]=useState(false);
 const file=useRef<HTMLInputElement>(null);
 const closeMeme=useCallback(()=>setMeme(false),[]);
 const recorder=useRef<MediaRecorder|null>(null),stream=useRef<MediaStream|null>(null),preview=useRef<HTMLVideoElement>(null),draftRef=useRef<Draft|null>(null),alive=useRef(true),version=useRef(0),lease=useRef("recording:"+crypto.randomUUID()),timer=useRef<ReturnType<typeof setInterval>|null>(null),pending=useRef<{key:string;id:string}|null>(null);
 const stopDevices=()=>{if(timer.current)clearInterval(timer.current);timer.current=null;stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;releaseMediaSession(lease.current)};
 const clearDraft=(discard=true)=>{const old=draftRef.current;if(old){URL.revokeObjectURL(old.url);if(discard&&old.media)void api("social/media/"+old.media,"DELETE").catch(()=>{})}draftRef.current=null;setDraft(null);pending.current=null};
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;version.current++;if(recorder.current?.state==="recording")recorder.current.stop();stopDevices();if(draftRef.current){URL.revokeObjectURL(draftRef.current.url);if(draftRef.current.media)void api("social/media/"+draftRef.current.media,"DELETE").catch(()=>{})}}},[]);
 useEffect(()=>{if(preview.current&&stream.current)preview.current.srcObject=stream.current},[recording]);
 const start=async(kind:"voice"|"video")=>{
  if(busy||requesting||recording)return;setError("");
  if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==="undefined"){setError("This browser cannot record notes. Try an up-to-date browser with microphone access.");return}
  if(!claimMediaSession(lease.current)){setError("Finish your current call or recording before recording a note.");return}
  setRequesting(true);const token=++version.current;
  try{
   const acquired=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:kind==="video"?{width:{ideal:640},height:{ideal:360},frameRate:{ideal:20,max:24},facingMode:"user"}:false});
   if(token!==version.current||!alive.current){acquired.getTracks().forEach(t=>t.stop());releaseMediaSession(lease.current);return}stream.current=acquired;
   const candidates=kind==="voice"?["audio/webm;codecs=opus","audio/mp4","audio/ogg;codecs=opus"]:["video/webm;codecs=vp8,opus","video/mp4","video/webm"];
   const mime=candidates.find(t=>MediaRecorder.isTypeSupported(t));if(!mime)throw new Error("This browser does not support a compatible recording format.");
   const rec=new MediaRecorder(acquired,{mimeType:mime,audioBitsPerSecond:64000,...(kind==="video"?{videoBitsPerSecond:900000}:{})}),chunks:Blob[]=[];let size=0;const began=performance.now();recorder.current=rec;
   rec.ondataavailable=e=>{if(e.data.size){chunks.push(e.data);size+=e.data.size;if(size>12*1024*1024&&rec.state==="recording")rec.stop()}};
   rec.onerror=()=>{if(alive.current)setError("Recording stopped unexpectedly. Please try again.");stopDevices();setRecording(null)};
   rec.onstop=()=>{const duration=Math.min(Math.max(100,Math.round(performance.now()-began)),kind==="voice"?120000:60000);stopDevices();if(!alive.current||token!==version.current)return;setRecording(null);const blob=new Blob(chunks,{type:rec.mimeType});if(blob.size<12||blob.size>12*1024*1024){setError("The recording could not be saved. Keep notes under 12 MB and try again.");return}const next:Draft={kind,blob,duration,url:URL.createObjectURL(blob)};draftRef.current=next;setDraft(next);setTime(duration)};
   clearDraft();setTime(0);setRecording(kind);rec.start(250);timer.current=setInterval(()=>{const duration=performance.now()-began;if(alive.current)setTime(duration);if(duration>=(kind==="voice"?120000:60000)&&rec.state==="recording")rec.stop()},200);
  }catch(e){stopDevices();if(alive.current){const err=e as Error;setError(err.name==="NotAllowedError"?"Microphone or camera access was declined. Allow it in your browser to record a note.":err.message)}}finally{if(alive.current)setRequesting(false)}
 };
 const cancel=()=>{version.current++;if(recorder.current?.state==="recording")recorder.current.stop();stopDevices();setRecording(null);setRequesting(false);clearDraft();setTime(0)};
 const takeDevice=(d:DeviceDraft)=>{clearDraft();const next:Draft={...d,device:true,duration:0,url:URL.createObjectURL(d.blob)};draftRef.current=next;setDraft(next);setError("")};
 const send=async(e:React.FormEvent)=>{
  e.preventDefault();if(busy||recording||requesting||!body.trim()&&!draft)return;setBusy(true);setError("");
  try{
   let media=draft?.media;
   if(draft&&!media){const query=new URLSearchParams(target as Record<string,string>);const response=await fetch("/api/social/media?"+query,{method:"POST",headers:{"content-type":draft.blob.type,"x-note-kind":draft.kind,"x-note-duration-ms":String(draft.duration),...(draft.device?{"x-upload-mode":"device","x-file-name":encodeURIComponent(draft.filename||"attachment")}: {})},body:draft.blob});const result:any=await response.json();if(!response.ok)throw new Error(result.error||"The recording could not be uploaded.");media=result.id;draft.media=media;draftRef.current=draft;setDraft({...draft})}
   const key=JSON.stringify([body.trim(),media||""]);if(pending.current?.key!==key)pending.current={key,id:crypto.randomUUID()};
   const result=await api(target.thread?"social/group-messages":"social/messages","POST",{...target,body:body.trim(),kind:draft?.kind||"text",...(media?{media}:{}),requestId:pending.current.id});
   onSent(result.message);clearDraft(false);setBody("");setTime(0);
  }catch(e){if(alive.current)setError((e as Error).message)}finally{if(alive.current)setBusy(false)}
 };
 return <div className="composer-area">{error&&<p className="chat-error" role="alert">{error}</p>}
 {recording&&<div className="recording-panel" role="status">{recording==="video"&&<video ref={preview} autoPlay playsInline muted className="note-camera-preview"/>}<div><span className="recording-dot"/><strong>Recording {recording==="voice"?"voice":"video"} note</strong><span className="recording-time">{elapsed(time)}</span><small>{recording==="voice"?"Up to 2 minutes":"Up to 1 minute"} · Review before sending</small></div><button type="button" className="icon-button" aria-label="Discard recording" onClick={cancel}><Trash2 size={18}/></button><button type="button" className="button" onClick={()=>recorder.current?.stop()}><Square size={15}/>Stop recording</button></div>}
 {meme&&<MemeEditor onClose={closeMeme} onUse={takeDevice}/>}
 <input ref={file} type="file" className="attachment-input" aria-label="Choose chat attachment" accept={deviceAccept} onChange={e=>{const f=e.target.files?.[0];if(f)try{takeDevice(fileDraft(f))}catch(e){setError((e as Error).message)}e.target.value=""}}/>
 {draft&&<div className="note-draft"><div className="note-draft-heading"><span><strong>{draft.filename|| (draft.kind==="voice"?"Voice note":"Video note")}</strong><small>{draft.device?(draft.blob.size/1024/1024).toFixed(1)+" MB":elapsed(draft.duration)} · Ready to send</small></span><button className="icon-button" aria-label="Discard note" disabled={busy} onClick={()=>clearDraft()}><Trash2 size={17}/></button></div>{draft.kind==="voice"?<audio controls preload="metadata" src={draft.url}/>:<Attachment kind={draft.kind} src={draft.url} name={draft.filename}/>}</div>}
 <form className="message-composer" onSubmit={send}><div className="composer-attachments"><button type="button" className="icon-button" aria-label="Attach file, photo or video" title="Attach from your device" disabled={busy||!!draft||!!recording||requesting} onClick={()=>file.current?.click()}><Paperclip size={20}/></button><button type="button" className="icon-button" aria-label="Create a meme" title="Create a meme" disabled={busy||!!draft||!!recording||requesting} onClick={()=>setMeme(true)}><Smile size={20}/></button></div><div className="recording-actions"><button type="button" className="icon-button" aria-label="Record voice note" title="Record a voice note" disabled={busy||!!draft||!!recording||requesting} onClick={()=>void start("voice")}><Mic size={20}/></button><button type="button" className="icon-button" aria-label="Record video note" title="Record a video note" disabled={busy||!!draft||!!recording||requesting} onClick={()=>void start("video")}><Video size={20}/></button></div><textarea aria-label={"Message "+name} value={body} onChange={e=>setBody(e.target.value)} maxLength={4000} rows={1} placeholder={requesting?"Waiting for device access…":draft?"Add a caption…":"Message "+name+"…"} disabled={!!recording||requesting} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();e.currentTarget.form?.requestSubmit()}}}/><button className="composer-send" aria-label={draft?"Send "+(draft.device?"attachment":draft.kind+" note"):"Send message"} disabled={busy||!!recording||requesting||!body.trim()&&!draft}><Send size={19}/><span>{busy?"Sending…":"Send"}</span></button></form><div className="composer-help"><span>{requesting?"Allow device access in your browser to begin.":"Enter to send · Shift + Enter for a new line"}</span><span>Files, photos, video & memes</span></div>
 </div>;
}
