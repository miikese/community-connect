import type {FunTemplate} from "../lib/fun-library";

export function drawTemplate(canvas:HTMLCanvasElement,item:FunTemplate,blank=false) {
  const sticker=item.kind==="sticker",size=sticker?600:960;
  canvas.width=size;canvas.height=sticker?600:800;
  const ctx=canvas.getContext("2d");if(!ctx)throw new Error("Your browser could not create this picture.");
  ctx.clearRect(0,0,canvas.width,canvas.height);
  if(!sticker){ctx.fillStyle=item.color;ctx.fillRect(0,0,960,800);ctx.fillStyle="#ffffff14";ctx.beginPath();ctx.arc(840,100,300,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(70,740,270,0,Math.PI*2);ctx.fill()}
  ctx.fillStyle=sticker?"#fff8e8":"#ffffff20";ctx.beginPath();ctx.arc(size/2,sticker?235:390,sticker?175:175,0,Math.PI*2);ctx.fill();
  if(sticker){ctx.strokeStyle=item.color;ctx.lineWidth=8;ctx.stroke()}
  ctx.fillStyle="#ffffff";
  ctx.font=(sticker?"200":"190")+'px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(item.emoji,size/2,sticker?230:385);
  const caption=(value:string,y:number,max:number,font:number)=>{ctx.font=`900 ${font}px Arial,sans-serif`;ctx.textAlign="center";ctx.textBaseline="middle";const lines:string[]=[];let line="";for(const word of value.split(/\s+/)){const next=(line+" "+word).trim();if(ctx.measureText(next).width>max&&line){lines.push(line);line=word}else line=next}if(line)lines.push(line);lines.slice(0,3).forEach((text,i)=>{ctx.fillStyle=sticker?item.color:"#ffffff";ctx.fillText(text,size/2,y+i*font*1.16,max)})};
  if(!blank){if(sticker){ctx.fillStyle="#fff8e8";ctx.beginPath();ctx.roundRect(20,425,560,135,36);ctx.fill();caption(item.top,475,520,38)}else{caption(item.top,100,840,43);caption(item.bottom,650,840,43)}}
}
export async function templateBlob(item:FunTemplate,blank=false):Promise<Blob>{
  const canvas=document.createElement("canvas");drawTemplate(canvas,item,blank);
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error("The picture could not be created.")),"image/png"));
}
export function downloadPicture(blob:Blob,name:string){const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
