'use client';
import {useState,useRef,useEffect,type FormEvent,type KeyboardEvent} from 'react';
import {AnimatePresence,motion,useReducedMotion} from 'motion/react';
import {Send,X,ArrowUpRight} from 'lucide-react';
import './agent-dock.css';
import './liquid-glass-button.css';
import {GRACE_FAQS,type GraceFaq} from '@/lib/grace-faq';
import {askGrace,type GraceHistory} from '@/lib/grace-chat';
type Message={id:number;from:'grace'|'you';text:string;faq?:GraceFaq|null;mode?:'ai'|'faq';notice?:string};
export function AgentDock({placement='landing'}:{placement?:'landing'|'dashboard'}={}){
 const [open,setOpen]=useState(false),[draft,setDraft]=useState(''),[messages,setMessages]=useState<Message[]>([{id:0,from:'grace',text:'Hi, I’m Grace. I can help with KOC applications, accounts and campus reporting. Choose a question below or ask me in your own words.'}]);
 const [busy,setBusy]=useState(false);
 const pending=useRef<AbortController|null>(null),clientId=useRef<string>('');
 useEffect(()=>()=>{pending.current?.abort();},[]);
 const sequence=useRef(1),input=useRef<HTMLTextAreaElement>(null),trigger=useRef<HTMLButtonElement>(null),log=useRef<HTMLDivElement>(null),reduced=useReducedMotion();
 useEffect(()=>{if(open)input.current?.focus();},[open]);
 useEffect(()=>{if(open&&log.current)log.current.scrollTop=log.current.scrollHeight;},[messages,open]);
 function close(){setOpen(false);trigger.current?.focus();}
 async function ask(question:string,known?:GraceFaq){
  const text=question.trim();if(!text||pending.current)return;
  const user:Message={id:sequence.current++,from:'you',text};setDraft('');
  if(known){const reply:Message={id:sequence.current++,from:'grace',text:known.answer,faq:known,mode:'faq'};setMessages(previous=>[...previous.slice(-18),user,reply]);input.current?.focus();return;}
  const history:GraceHistory[]=messages.filter(message=>message.id!==0).slice(-6).map(message=>({role:message.from==='you'?'user':'assistant',content:message.text}));
  const controller=new AbortController();pending.current=controller;setBusy(true);setMessages(previous=>[...previous.slice(-19),user]);
  clientId.current ||= crypto.randomUUID();
  try{const result=await askGrace(text,history,clientId.current,controller.signal);if(controller.signal.aborted)return;const reply:Message={id:sequence.current++,from:'grace',text:result.answer,faq:result.faq,mode:result.mode,notice:result.notice};setMessages(previous=>[...previous.slice(-19),reply]);}
  catch{ /* An unmounted conversation aborts without adding a reply. */ }
  finally{if(!controller.signal.aborted){pending.current=null;setBusy(false);input.current?.focus();}}
 }
 function submit(event:FormEvent){event.preventDefault();ask(draft);}
 function keyDown(event:KeyboardEvent<HTMLTextAreaElement>){if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();ask(draft);}}
 return <aside className="grace-dock" aria-label="Grace assistant" data-placement={placement}>
  <AnimatePresence>{open&&<motion.section className="grace-panel" role="dialog" aria-label="Chat with Grace" initial={reduced?false:{opacity:0,y:12,scale:.98}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:8}} transition={{duration:reduced?0:.2}} onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();close();}}}>
   <header><div className="grace-avatar"><img src="/community/grace-bear.png" width="52" height="52" alt="Grace, a yellow bear in a Kharis On Campus hoodie"/></div><div><h2>Grace</h2><p>Your KOC assistant</p></div><button type="button" aria-label="Close Grace" onClick={close}><X size={18}/></button></header>
   <div className="grace-log" role="log" aria-live="polite" aria-relevant="additions" aria-label="Conversation with Grace" ref={log}>{messages.map(message=><div key={message.id} className={`grace-message grace-${message.from}`}><span>{message.from==='grace'?`Grace${message.mode==='ai'?' · AI':message.mode==='faq'?' · FAQ':''}`:'You'}</span><p>{message.text}</p>{message.notice&&<small>{message.notice}</small>}{message.faq?.href&&<a href={message.faq.href}>{message.faq.linkLabel}<ArrowUpRight size={14}/></a>}</div>)}{busy&&<p role="status">Grace is thinking…</p>}</div>
   <details className="grace-questions" open={messages.length===1||undefined}><summary>Common questions</summary><div>{GRACE_FAQS.map(faq=><button key={faq.id} type="button" disabled={busy} onClick={()=>void ask(faq.question,faq)}>{faq.question}</button>)}</div></details>
   <form onSubmit={submit}><label className="sr-only" htmlFor="grace-question">Ask Grace a question</label><textarea id="grace-question" ref={input} value={draft} onChange={event=>setDraft(event.target.value)} onKeyDown={keyDown} placeholder="Ask about KOC…" rows={2} maxLength={500}/><button aria-label="Send question" type="submit" disabled={busy||!draft.trim()}><Send size={18}/></button></form>
   <p className="grace-privacy">AI messages may be processed by Groq. Don’t share private details. Suggested questions use FAQs.</p>
  </motion.section>}</AnimatePresence>
  <button className="grace-trigger liquid-button" ref={trigger} type="button" aria-expanded={open} aria-label={open?'Close Grace assistant':'Ask Grace'} onClick={()=>{if(open)close();else setOpen(true);}}><img src="/community/grace-bear.png" width="38" height="38" alt="" aria-hidden="true"/><span>Ask Grace</span><span className="grace-trigger-note">KOC help</span></button>
 </aside>;
}
export default AgentDock;
