import {PNG} from 'pngjs';
import {Buffer} from 'node:buffer';
import {leadApplicationSchema,applicationAnswers,type LeadApplicationAnswers} from './schema.ts';
type Dependencies={publishableKey:string;claim:(identity:string)=>Promise<boolean>;completed:(requestId:string,answers:LeadApplicationAnswers,photoHash:string)=>Promise<string|null>;upload:(path:string,photo:Uint8Array)=>Promise<void>;persist:(answers:LeadApplicationAnswers,requestId:string,path:string,photoHash:string)=>Promise<string>};
const origins=new Set(['https://kocm.vercel.app','https://koccm.vercel.app','http://localhost:5173','http://127.0.0.1:5173']);
const MAX_PHOTO=2*1024*1024,MAX_BODY=Math.ceil(2.2*1024*1024);
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function canonicalApplicationPhoto(bytes:Uint8Array):Uint8Array{
 if(bytes.length<33||bytes.length>MAX_PHOTO)throw new Error('Invalid photo size.');const data=Buffer.from(bytes);
 if(!data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||data.readUInt32BE(8)!==13||data.toString('ascii',12,16)!=='IHDR')throw new Error('Invalid PNG.');
 const width=data.readUInt32BE(16),height=data.readUInt32BE(20);
 // Browser-normalized 8-bit noninterlaced RGB/RGBA only. pngjs caps inflate output
 // for this format; interlaced input uses an unbounded inflate path and is denied.
 if(width<1||height<1||width>1024||height>1024||data[24]!==8||![2,6].includes(data[25])||data[26]!==0||data[27]!==0||data[28]!==0)throw new Error('Unsupported photo dimensions or PNG format.');
 const decoded=PNG.sync.read(data,{checkCRC:true});if(decoded.width!==width||decoded.height!==height||decoded.data.length!==width*height*4)throw new Error('Invalid decoded photo.');
 const image=new PNG({width,height});image.data=decoded.data;const clean=PNG.sync.write(image,{colorType:6,bitDepth:8,deflateLevel:9});if(clean.length>MAX_PHOTO)throw new Error('Normalized photo is too large.');return new Uint8Array(clean);
}
export function createLeadApplicationHandler(deps:Dependencies){return async(request:Request)=>{
 const origin=request.headers.get('origin');const headers={'content-type':'application/json','cache-control':'no-store',vary:'Origin',...(origin&&origins.has(origin)?{'access-control-allow-origin':origin}:{})};const respond=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(origin&&!origins.has(origin))return respond({error:'Origin is not allowed.'},403);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...headers,'access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'apikey, content-type, authorization, x-client-info'}});
 if(request.method!=='POST')return respond({error:'Use POST.'},405);
 if(request.headers.get('apikey')!==deps.publishableKey)return respond({error:'Invalid project key.'},401);
 const contentType=request.headers.get('content-type')??'';if(!/^multipart\/form-data\s*;/i.test(contentType))return respond({error:'Submit the application form with a PNG photo.'},400);
 try{const ip=(request.headers.get('x-forwarded-for')?.split(',')[0].trim()??'unknown').slice(0,100);const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ip));const identity=Array.from(new Uint8Array(hash),byte=>byte.toString(16).padStart(2,'0')).join('');if(!await deps.claim(identity))return respond({error:'Too many attempts. Try again later.'},429);}catch{return respond({error:'Application service is temporarily unavailable.'},503);}
 let form:FormData;
 try{const reader=request.body?.getReader();if(!reader)throw new Error();let size=0;const chunks:Uint8Array[]=[];while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_BODY){await reader.cancel();return respond({error:'The photo upload is too large. Choose a smaller photo.'},413);}chunks.push(value);}const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}form=await new Request('https://application.invalid',{method:'POST',headers:{'content-type':contentType},body:bytes}).formData();}catch{return respond({error:'Invalid application upload.'},400);}
 const fields=Array.from(form.keys());if(fields.length!==2||!fields.includes('application')||!fields.includes('photo')||form.getAll('application').length!==1||form.getAll('photo').length!==1)return respond({error:'An application form and one photo are required.'},400);
 const raw=form.get('application'),file=form.get('photo');if(file&&typeof file!=='string'&&file.size>MAX_PHOTO)return respond({error:'Choose a PNG photo up to 2MB.'},413);if(typeof raw!=='string'||raw.length>16000||!file||typeof file==='string'||file.type!=='image/png'||file.size>MAX_PHOTO)return respond({error:'Choose one PNG photo up to 2MB and complete the form.'},400);
 let answers:LeadApplicationAnswers,requestId:string,photo:Uint8Array,photoHash:string;
 try{const input=leadApplicationSchema.parse(JSON.parse(raw));answers=applicationAnswers(input);requestId=input.requestId;photo=canonicalApplicationPhoto(new Uint8Array(await file.arrayBuffer()));const digest=await crypto.subtle.digest('SHA-256',Uint8Array.from(photo).buffer);photoHash=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');}catch{return respond({error:'Check the application fields and provide a valid photo (maximum 1024px).'},400);}
 try{const completed=await deps.completed(requestId,answers,photoHash);if(completed){if(!uuid.test(completed))throw new Error();return respond({ok:true,reference:completed});}}catch{return respond({error:'Unable to confirm this request. Retry with the same form and photo.'},503);}
 const path=`${requestId}/${photoHash}/${crypto.randomUUID()}.png`;
 try{await deps.upload(path,photo);const reference=await deps.persist(answers,requestId,path,photoHash);if(!uuid.test(reference))throw new Error();return respond({ok:true,reference});}catch{
  // A response can be lost after a storage upload or database commit. Never
  // delete a potentially referenced photo, and never create an Auth account.
  try{const reference=await deps.completed(requestId,answers,photoHash);if(reference&&uuid.test(reference))return respond({ok:true,reference});}catch{/* An unknown completion remains a retryable failure. */}
  return respond({error:'The application could not be confirmed yet. Retry with the same form and photo.'},503);
 }
};}
