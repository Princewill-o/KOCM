import {afterEach,expect,it,vi} from 'vitest';
import {askGrace} from '../lib/grace-chat';
afterEach(()=>vi.unstubAllGlobals());
it('sends bounded conversation to Supabase and validates suggested links',async()=>{
 const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({answer:'Friday at 10pm.',mode:'ai',faqId:'reports'})));vi.stubGlobal('fetch',fetcher);
 const result=await askGrace('When?',Array.from({length:10},()=>({role:'user' as const,content:'report'})),'client');
 expect(result.mode).toBe('ai');expect(result.faq?.href).toBe('/login');const body=JSON.parse(fetcher.mock.calls[0][1].body);expect(body.history).toHaveLength(6);expect(body.clientId).toBe('client');
});
it('uses an honest FAQ fallback when the endpoint fails',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('offline')));const result=await askGrace('report due',[],'client');expect(result.mode).toBe('faq');expect(result.answer).toMatch(/Friday/);expect(result.notice).toMatch(/unavailable/);
});
it('rejects untrusted links and malformed provider responses',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({answer:'Hello',mode:'ai',faqId:'https://bad.example'}))));expect((await askGrace('hello',[],'client')).faq).toBeNull();
});
it('propagates a cancelled conversation instead of rendering a fallback',async()=>{
 const controller=new AbortController();controller.abort();vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new DOMException('Aborted','AbortError')));await expect(askGrace('report',[],'client',controller.signal)).rejects.toThrow('Aborted');
});

it('keeps the newest conversation within the backend character budget',async()=>{
 const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({answer:'Okay',mode:'ai'})));vi.stubGlobal('fetch',fetcher);
 await askGrace('x'.repeat(700),Array.from({length:8},(_,index)=>({role:index%2?'assistant' as const:'user' as const,content:String(index).repeat(1800)})),'client');
 const body=JSON.parse(fetcher.mock.calls[0][1].body);expect(body.message.length).toBe(500);expect(body.history.reduce((sum:number,item:{content:string})=>sum+item.content.length,0)).toBeLessThanOrEqual(4000);expect(body.history.at(-1).content).toMatch(/^7/);expect(body.history.filter((item:{role:string})=>item.role==='user').every((item:{content:string})=>item.content.length<=500)).toBe(true);
});
