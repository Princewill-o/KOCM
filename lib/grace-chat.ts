import {answerGrace,GRACE_FAQS,type GraceFaq} from './grace-faq';
import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from './supabase';
export type GraceHistory={role:'user'|'assistant';content:string};
export type GraceReply={answer:string;mode:'ai'|'faq';faq:GraceFaq|null;notice?:string};
function boundedHistory(history:GraceHistory[]):GraceHistory[]{
 const result:GraceHistory[]=[];let remaining=4000;
 for(const item of history.slice(-6).reverse()){
  const content=item.content.slice(0,Math.min(item.role==='user'?500:1800,remaining));
  if(!content)break;result.unshift({role:item.role,content});remaining-=content.length;
 }
 return result;
}
export async function askGrace(message:string,history:GraceHistory[],clientId:string,signal?:AbortSignal):Promise<GraceReply>{
 const controller=new AbortController();const abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)controller.abort();const timer=setTimeout(abort,20000);
 try{
  const response=await fetch(`${SUPABASE_URL}/functions/v1/grace-chat`,{method:'POST',headers:{'Content-Type':'application/json',apikey:SUPABASE_PUBLISHABLE_KEY},body:JSON.stringify({message:message.slice(0,500),history:boundedHistory(history),clientId}),signal:controller.signal});
  if(!response.ok)throw new Error('Grace unavailable');const result:unknown=await response.json();
  if(!result||typeof result!=='object')throw new Error('Invalid reply');const data=result as Record<string,unknown>;
  if(typeof data.answer!=='string'||!data.answer.trim()||data.answer.length>2000||(data.mode!=='ai'&&data.mode!=='faq'))throw new Error('Invalid reply');
  return {answer:data.answer,mode:data.mode,faq:GRACE_FAQS.find(faq=>faq.id===data.faqId)??null,notice:typeof data.notice==='string'?data.notice.slice(0,250):undefined};
 }catch(error){
  if(signal?.aborted)throw error;
  const fallback=answerGrace(message);return {...fallback,mode:'faq',notice:'AI is unavailable right now. This answer comes from the KOC FAQ bank.'};
 }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
