import { beforeEach, describe, expect, it, vi } from 'vitest';
const session = vi.hoisted(() => vi.fn());
vi.mock('../lib/supabase', () => ({ SUPABASE_URL:'https://project.test', SUPABASE_PUBLISHABLE_KEY:'public-key', supabase:()=>({auth:{getSession:session}}) }));
import { readMaterialPage } from '../lib/platform';
const reader='22222222-2222-2222-2222-222222222222';
const fetcher=vi.fn();
beforeEach(()=>{session.mockResolvedValue({data:{session:{access_token:'real-user-token'}},error:null});vi.stubGlobal('fetch',fetcher);fetcher.mockReset();});
describe('protected material client',()=>{
 it('requests only an authenticated page with no caching or redirects',async()=>{
  fetcher.mockResolvedValue(new Response(new Uint8Array([1,2]),{headers:{'Content-Type':'image/png','X-Reader-Session':reader,'X-Page-Count':'3'}}));
  const signal=new AbortController().signal;
  const result=await readMaterialPage('material',2,undefined,signal);
  expect(fetcher).toHaveBeenCalledWith('https://project.test/functions/v1/protected-material-page',expect.objectContaining({cache:'no-store',credentials:'omit',redirect:'error',signal,headers:expect.objectContaining({Authorization:'Bearer real-user-token'}),body:JSON.stringify({materialId:'material',page:2,sessionId:null})}));
  expect(result.sessionId).toBe(reader);expect(result.pageCount).toBe(3);expect(result.blob.size).toBe(2);
 });
 it('never requests content without a logged-in session',async()=>{session.mockResolvedValue({data:{session:null},error:null});await expect(readMaterialPage('material',1)).rejects.toThrow('log in');expect(fetcher).not.toHaveBeenCalled();});
 it('rejects PDF responses and missing protected page metadata',async()=>{fetcher.mockResolvedValue(new Response('%PDF-',{headers:{'Content-Type':'application/pdf'}}));await expect(readMaterialPage('material',1)).rejects.toThrow('invalid');});
 it('surfaces denied access instead of falling back to original files',async()=>{fetcher.mockResolvedValue(new Response(JSON.stringify({error:'Access denied'}),{status:403,headers:{'Content-Type':'application/json'}}));await expect(readMaterialPage('material',1)).rejects.toThrow('Access denied');expect(fetcher).toHaveBeenCalledTimes(1);});
});
