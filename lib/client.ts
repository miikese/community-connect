export type RecordItem = {id:string;kind:string;status:string;data:Record<string,any>;created:string;updated:string;owner?:string};
export async function api(path:string,method="GET",data?:unknown) {
 const response=await fetch("/api/"+path,{method,...(data?{headers:{"content-type":"application/json"},body:JSON.stringify(data)}:{})});
 const result:any=await response.json();if(!response.ok)throw new Error(result.error||"Something went wrong.");return result;
}
export async function upload(file:File) {
 if(file.size>2*1024*1024)throw new Error("Choose an image under 2 MB.");
 // Re-encode to remove EXIF/location metadata before upload.
 const bitmap=await createImageBitmap(file),canvas=document.createElement("canvas"),scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));
 canvas.width=bitmap.width*scale;canvas.height=bitmap.height*scale;canvas.getContext("2d")!.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
 const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error("Cannot read photo.")),"image/jpeg",0.82));
 const r=await fetch("/api/upload",{method:"POST",headers:{"content-type":"image/jpeg"},body:blob}),d:any=await r.json();if(!r.ok)throw new Error(d.error);return d.id;
}
