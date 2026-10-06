import {describe,it,expect,vi} from 'vitest';
import {watchPasswordRecovery,recoveryLinkError} from '../lib/password-recovery';
describe('password recovery callback',()=>{
 it('recognises expired and invalid link errors in query or fragment',()=>{
  expect(recoveryLinkError('?error=access_denied&error_code=otp_expired','')).toContain('expired');
  expect(recoveryLinkError('','#error=access_denied&error_description=Email+link+is+invalid')).toContain('new');
  expect(recoveryLinkError('?code=valid-code','')).toBeNull();
 });
 it('waits for the SDK callback exchange rather than a fixed timeout',async()=>{
  let resolve!: (value:{data:{session:object|null};error:null})=>void;
  const change=vi.fn(); const unsubscribe=vi.fn();
  const auth={getSession:()=>new Promise<{data:{session:object|null};error:null}>(r=>{resolve=r}),onAuthStateChange:vi.fn(()=>({data:{subscription:{unsubscribe}}}))};
  const stop=watchPasswordRecovery(auth,'?code=callback','',change);
  expect(change).not.toHaveBeenCalled();
  resolve({data:{session:{}},error:null}); await Promise.resolve();
  expect(change).toHaveBeenLastCalledWith({ready:true,error:''}); stop(); expect(unsubscribe).toHaveBeenCalledOnce();
 });
 it('shows missing-session guidance and permits recovery event completion',async()=>{
  const change=vi.fn(); let callback!: (event:string,session:object|null)=>void;
  const auth={getSession:async()=>({data:{session:null},error:null}),onAuthStateChange:(fn:typeof callback)=>{callback=fn;return{data:{subscription:{unsubscribe:vi.fn()}}}}};
  watchPasswordRecovery(auth,'','',change); await Promise.resolve();
  expect(change).toHaveBeenLastCalledWith({ready:false,error:expect.stringContaining('new reset link')});
  callback('PASSWORD_RECOVERY',{}); expect(change).toHaveBeenLastCalledWith({ready:true,error:''});
 });
 it('never accepts an existing session when the URL explicitly reports a failed link',()=>{
  const change=vi.fn(); const auth={getSession:vi.fn(),onAuthStateChange:vi.fn()};
  watchPasswordRecovery(auth,'?error_code=otp_expired','',change);
  expect(change).toHaveBeenCalledWith({ready:false,error:expect.stringContaining('expired')}); expect(auth.getSession).not.toHaveBeenCalled();
 });
 it('ignores async results after leaving the password page',async()=>{
  let resolve!: (value:{data:{session:object|null};error:null})=>void; const change=vi.fn();
  const auth={getSession:()=>new Promise<{data:{session:object|null};error:null}>(r=>{resolve=r}),onAuthStateChange:()=>({data:{subscription:{unsubscribe:vi.fn()}}})};
  const stop=watchPasswordRecovery(auth,'','',change); stop(); resolve({data:{session:{}},error:null});await Promise.resolve();expect(change).not.toHaveBeenCalled();
 });
});
