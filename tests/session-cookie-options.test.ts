import {afterEach,it,expect,vi} from 'vitest';
const create=vi.hoisted(()=>vi.fn<(url:string,key:string,options:unknown)=>object>(()=>({})));
vi.mock('@supabase/ssr',()=>({createBrowserClient:create}));
afterEach(()=>{vi.unstubAllGlobals();vi.clearAllMocks();});
it('marks hosted session cookies secure while preserving local HTTP development',async()=>{
 for(const protocol of ['https:','http:']){
  vi.resetModules();vi.stubGlobal('window',{location:{protocol}});
  const {supabase}=await import('../lib/supabase');supabase();
  expect(create.mock.calls.at(-1)?.[2]).toEqual({cookieOptions:{secure:protocol==='https:',sameSite:'lax',path:'/'}});
 }
});
