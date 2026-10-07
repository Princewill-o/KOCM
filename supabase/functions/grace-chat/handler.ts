import {answerGrace,GRACE_FAQS} from '../_shared/grace-knowledge.ts';
export type GraceHistory={role:'user'|'assistant';content:string};
export type GraceReply={answer:string;faqId?:string;mode:'ai'|'faq';notice?:string};
type Dependencies={publishableKey:string;configured:()=>boolean;claim:(identity:string)=>Promise<boolean>;complete:(message:string,history:GraceHistory[])=>Promise<unknown>};
const origins=new Set(['https://kocm.vercel.app','https://koccm.vercel.app','http://localhost:5173','http://127.0.0.1:5173']);
export function createGraceChatHandler(deps:Dependencies){return async(request:Request):Promise<Response>=>{
 const origin=request.headers.get('origin');
 const headers={'content-type':'application/json','cache-control':'no-store','vary':'Origin',...(origin&&origins.has(origin)?{'access-control-allow-origin':origin}:{})};
 const response=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(origin&&!origins.has(origin))return response({error:'Origin is not allowed.'},403);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...headers,'access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'apikey, content-type'}});
 if(request.method!=='POST')return response({error:'Use POST.'},405);
 if(request.headers.get('apikey')!==deps.publishableKey)return response({error:'Invalid project key.'},401);
 let body:Record<string,unknown>;
 try{
  if(!request.headers.get('content-type')?.startsWith('application/json'))throw new Error();
  const reader=request.body?.getReader();if(!reader)throw new Error();let size=0;const chunks:Uint8Array[]=[];
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>12000){await reader.cancel();throw new Error();}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}body=JSON.parse(new TextDecoder().decode(bytes));
  if(!body||typeof body!=='object'||Array.isArray(body))throw new Error();
 }catch{return response({error:'Invalid or oversized request.'},400);}
 const {message,history,clientId}=body;
 if(typeof message!=='string'||!message.trim()||message.length>500||typeof clientId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(clientId)||!Array.isArray(history)||history.length>6||history.some(item=>!item||typeof item!=='object'||!['user','assistant'].includes(item.role)||typeof item.content!=='string'||item.content.length>1800)||history.reduce((n,item)=>n+item.content.length,0)>4000)return response({error:'Invalid message or conversation.'},400);
 const fallback=(notice:string)=>{const result=answerGrace(message);return response({answer:result.answer,...(result.faq?{faqId:result.faq.id}:{}),mode:'faq',notice} satisfies GraceReply);};
 if(!deps.configured())return fallback('AI is not connected yet. This answer comes from the KOC FAQ bank.');
 try{
  // Hash the gateway-provided IP with a per-session UUID; never store raw IPs or chat text.
  const ip=request.headers.get('x-forwarded-for')?.split(',')[0].trim()??'unknown';
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`${ip.slice(0,100)}:${clientId}`));
  const identity=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
  if(!await deps.claim(identity))return fallback('Grace has reached its free AI allowance. Here is a verified FAQ answer.');
  const result=await deps.complete(message.trim(),history as GraceHistory[]);
  if(!result||typeof result!=='object')throw new Error();const {answer,faqId}=result as Record<string,unknown>;
  if(typeof answer!=='string'||!answer.trim()||answer.length>1800||(faqId!==undefined&&faqId!==null&&(typeof faqId!=='string'||!GRACE_FAQS.some(faq=>faq.id===faqId))))throw new Error();
  return response({answer:answer.trim(),...(typeof faqId==='string'?{faqId}:{}),mode:'ai'} satisfies GraceReply);
 }catch{return fallback('AI is temporarily unavailable. This answer comes from the KOC FAQ bank.');}
};}
