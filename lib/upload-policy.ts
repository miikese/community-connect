export const MAX_UPLOAD=25*1024*1024;
export function cleanFilename(value:string){let name:string;try{name=decodeURIComponent(value)}catch{name=value}return name.replace(/[\x00-\x1f\x7f/\\<>:"|?*]/g,"_").slice(0,160)||"attachment"}
export function validUpload(mime:string,bytes:Uint8Array,name:string){
 const ascii=new TextDecoder().decode(bytes.slice(0,12)),starts=(values:number[])=>values.every((v,i)=>bytes[i]===v);
 if(bytes.length<1)return false;
 if(mime==="image/jpeg")return starts([255,216,255]);
 if(mime==="image/png")return starts([137,80,78,71,13,10,26,10]);
 if(mime==="image/gif")return ascii.startsWith("GIF87a")||ascii.startsWith("GIF89a");
 if(mime==="image/webp")return ascii.startsWith("RIFF")&&ascii.slice(8,12)==="WEBP";
 if(mime==="video/mp4")return bytes.length>=12&&ascii.slice(4,8)==="ftyp";
 if(mime==="video/webm")return starts([26,69,223,163]);
 if(mime==="application/pdf")return ascii.startsWith("%PDF-")&&/\.pdf$/i.test(name);
 if(["text/plain","text/csv"].includes(mime)&&/\.(txt|csv)$/i.test(name)){try{new TextDecoder("utf-8",{fatal:true}).decode(bytes);return !bytes.includes(0)}catch{return false}}
 if(["application/zip","application/vnd.openxmlformats-officedocument.wordprocessingml.document","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","application/vnd.openxmlformats-officedocument.presentationml.presentation"].includes(mime))return starts([80,75,3,4])&&/\.(zip|docx|xlsx|pptx)$/i.test(name);
 return false;
}
