import { describe, expect, it, vi } from 'vitest';
import { renderAccountEmail } from '../supabase/functions/account-email-delivery/templates';
import { createAccountEmailHandler, type AccountEmailDependencies } from '../supabase/functions/account-email-delivery/handler';
const item = { id:'email-id', user_id:'user-id', recipient:'person@example.com', full_name:'Person', reason:'Campus appointment not confirmed.', attempts:1, status:'sending' };
function fixture(overrides: Partial<AccountEmailDependencies> = {}) {
  return { authenticate:vi.fn(async () => 'admin' as const), authenticateWorker:vi.fn(async()=>false), configured:vi.fn(() => true), claim:vi.fn(async () => [item]), send:vi.fn(async () => undefined), complete:vi.fn(async () => undefined), ...overrides };
}
function request(headers: Record<string,string> = {Authorization:'Bearer jwt'}) {return new Request('https://edge.test', {method:'POST',headers});}
describe('account email delivery', () => {
  it('requires an authenticated administrator before claiming', async () => {
    const deps=fixture({authenticate:vi.fn(async ()=>'unauthorized' as const)});
    expect((await createAccountEmailHandler(deps)(request())).status).toBe(401);
    expect(deps.claim).not.toHaveBeenCalled();
    expect((await createAccountEmailHandler(deps)(request({}))).status).toBe(401);
  });
  it('denies inactive and nonadministrator accounts',async()=>{
    const deps=fixture({authenticate:vi.fn(async ()=>'forbidden' as const)});
    expect((await createAccountEmailHandler(deps)(request())).status).toBe(403);
    expect(deps.claim).not.toHaveBeenCalled();
  });
  it('does not claim messages before SMTP is configured',async()=>{
    const deps=fixture({configured:()=>false});
    const response=await createAccountEmailHandler(deps)(request());
    expect(response.status).toBe(503); expect(await response.text()).toContain('SMTP');
    expect(deps.claim).not.toHaveBeenCalled();
  });
  it('sends one plain text rejection and records delivery',async()=>{
    const deps=fixture();const response=await createAccountEmailHandler(deps)(request());
    expect(await response.json()).toEqual({sent:1,failed:0});
    expect(deps.claim).toHaveBeenCalledWith(3);
    expect(deps.send).toHaveBeenCalledWith({to:'person@example.com',subject:'Your KOC account application',text:expect.stringContaining(item.reason),html:expect.stringContaining('not been approved')});
    expect(deps.complete).toHaveBeenCalledWith(item.id,true,null);
    expect(response.headers.get('Cache-Control')).toContain('no-store');
  });
  it('records safe failure without leaking SMTP errors or retrying',async()=>{
    const deps=fixture({send:vi.fn(async()=>{throw Error('smtp password SECRET');})});
    const response=await createAccountEmailHandler(deps)(request());
    expect(await response.json()).toEqual({sent:0,failed:1});
    expect(deps.complete).toHaveBeenCalledWith(item.id,false,'Email delivery failed. Check the SMTP settings and retry later.');
    expect(deps.send).toHaveBeenCalledTimes(1);
  });
  it('limits batches, ignores exhausted attempts and malformed recipients',async()=>{
    const deps=fixture({claim:vi.fn(async()=>[{...item, attempts:6},{...item,recipient:'victim@example.com, other@example.com'},...Array.from({length:11},(_,n)=>({...item,id:String(n)}))])});
    await createAccountEmailHandler(deps)(request());
    expect(deps.send).toHaveBeenCalledTimes(1);
  });
  it('rejects foreign origins and accepts only POST or OPTIONS',async()=>{
    const deps=fixture();const handler=createAccountEmailHandler(deps);
    expect((await handler(request({Origin:'https://evil.test',Authorization:'Bearer jwt'}))).status).toBe(403);
    expect((await handler(new Request('https://edge.test'))).status).toBe(405);
    const preflight=await handler(new Request('https://edge.test',{method:'OPTIONS',headers:{Origin:'https://kocm.vercel.app'}}));
    expect(preflight.status).toBe(204);expect(preflight.headers.get('Access-Control-Allow-Origin')).toBe('https://kocm.vercel.app');
    expect(deps.claim).not.toHaveBeenCalled();
  });
  it('does not resend or mark failed after SMTP accepts but database finalisation fails',async()=>{
    const deps=fixture({complete:vi.fn(async()=>{throw Error('database unavailable');})});
    const response=await createAccountEmailHandler(deps)(request());
    expect(response.status).toBe(503);
    expect(deps.send).toHaveBeenCalledTimes(1);
    expect(deps.complete).toHaveBeenCalledTimes(1);
    expect(deps.complete).toHaveBeenCalledWith(item.id,true,null);
  });
  it('hides authentication and database failure details',async()=>{
    const deps=fixture({claim:vi.fn(async()=>{throw Error('database secret');})});
    const response=await createAccountEmailHandler(deps)(request());expect(response.status).toBe(503);expect(await response.text()).not.toContain('secret');
  });
});

describe('email templates and cron access',()=>{
  it('escapes rejection name and reason in HTML, retaining useful plaintext',()=>{
    const email=renderAccountEmail({...item,full_name:'<Person & Friend>',reason:'<script>alert(1)</script>'});
    expect(email.html).toContain('&lt;Person &amp; Friend&gt;');expect(email.html).not.toContain('<script>');
    expect(email.text).toContain('<script>alert(1)</script>');expect(email.html).toContain('https://kocm.vercel.app');
  });
  it('distinguishes missing reports from zero statistics and dates late reports in UK time',()=>{
    const email=renderAccountEmail({...item,kind:'weekly_digest',payload:{weekEnding:'2026-10-09',missing:['<Campus>'],late:[{campus:'Late & Campus',submittedAt:'2026-10-09T21:30:00Z'}]}});
    expect(email.text).toContain('not submitted');expect(email.text).toContain('22:30');
    expect(email.html).toContain('&lt;Campus&gt;');expect(email.html).toContain('Late &amp; Campus');
    expect(email.text).toContain('9 October 2026');expect(email.text).toContain('not zero');
  });
  it('shows empty digest states clearly',()=>{
    const email=renderAccountEmail({...item,kind:'weekly_digest',payload:{weekEnding:'2026-12-04',missing:[],late:[]}});
    expect(email.text).toContain('No missing reports');expect(email.text).toContain('No late submissions');
  });
  it('authenticates cron header before queue claims',async()=>{
    const deps=fixture({authenticateWorker:vi.fn(async()=>true)});
    const response=await createAccountEmailHandler(deps)(request({'X-KOC-Worker-Token':'secret-worker'}));
    expect(response.status).toBe(200);expect(deps.authenticate).not.toHaveBeenCalled();
    expect(deps.authenticateWorker).toHaveBeenCalledWith('secret-worker');expect(deps.claim).toHaveBeenCalledTimes(1);
  });
  it('denies invalid worker token without falling back to admin bearer',async()=>{
    const deps=fixture();const response=await createAccountEmailHandler(deps)(request({'X-KOC-Worker-Token':'bad',Authorization:'Bearer jwt'}));
    expect(response.status).toBe(403);expect(deps.claim).not.toHaveBeenCalled();expect(deps.authenticate).not.toHaveBeenCalled();
  });
});

describe('digest queue validation',()=>{
  it('does not send malformed digest or unknown queue kind',async()=>{
    const deps=fixture({claim:vi.fn(async()=>[{...item,kind:'weekly_digest',payload:{weekEnding:'bad',missing:[],late:[]}},{...item,kind:'untrusted'}])});
    const response=await createAccountEmailHandler(deps)(request());expect(await response.json()).toEqual({sent:0,failed:2});
    expect(deps.send).not.toHaveBeenCalled();expect(deps.complete).toHaveBeenCalledTimes(2);
  });
  it('leaves cron queue untouched when SMTP is unavailable',async()=>{
    const deps=fixture({authenticateWorker:vi.fn(async()=>true),configured:()=>false});
    const response=await createAccountEmailHandler(deps)(request({'X-KOC-Worker-Token':'valid-worker'}));
    expect(response.status).toBe(503);expect(deps.claim).not.toHaveBeenCalled();
  });
});
describe('SMTP dry-run status',()=>{
 it('checks authenticated configuration without claiming or sending',async()=>{for(const configured of [true,false]){const deps=fixture({configured:()=>configured});const response=await createAccountEmailHandler(deps)(new Request('https://edge.test',{method:'POST',headers:{Authorization:'Bearer jwt','Content-Type':'application/json'},body:JSON.stringify({action:'status'})}));expect(response.status).toBe(200);expect(await response.json()).toEqual({configured});expect(deps.claim).not.toHaveBeenCalled();expect(deps.send).not.toHaveBeenCalled();}});
 it('requires valid admin or worker authentication for status',async()=>{const deps=fixture({authenticate:vi.fn(async()=>'forbidden' as const)});expect((await createAccountEmailHandler(deps)(new Request('https://edge.test',{method:'POST',headers:{Authorization:'Bearer jwt'},body:'{"action":"status"}'}))).status).toBe(403);expect(deps.claim).not.toHaveBeenCalled();const worker=fixture({authenticateWorker:vi.fn(async()=>true)});const response=await createAccountEmailHandler(worker)(new Request('https://edge.test',{method:'POST',headers:{'X-KOC-Worker-Token':'valid'},body:'{"action":"status"}'}));expect(response.status).toBe(200);expect(worker.claim).not.toHaveBeenCalled();expect(worker.send).not.toHaveBeenCalled();});
 it('rejects malformed or oversized request bodies without sending',async()=>{for(const body of ['{"action":"statuz"}','not json','x'.repeat(3000)]){const deps=fixture();expect((await createAccountEmailHandler(deps)(new Request('https://edge.test',{method:'POST',headers:{Authorization:'Bearer jwt'},body}))).status).toBe(400);expect(deps.claim).not.toHaveBeenCalled();}});
});
