import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({invoke:vi.fn(),setSession:vi.fn(),rpc:vi.fn()}));
vi.mock('../lib/supabase', () => ({supabase:() => ({functions:{invoke:mocks.invoke},auth:{setSession:mocks.setSession},rpc:mocks.rpc})}));
import { signInWithIdentifier, signUpWithUsername, updateMyUsername } from '../lib/username-auth';
beforeEach(() => {vi.clearAllMocks();mocks.setSession.mockResolvedValue({error:null});mocks.rpc.mockResolvedValue({error:null});});
describe('username account client', () => {
  it('signs in with a username and installs returned tokens through Supabase', async () => {
    mocks.invoke.mockResolvedValue({data:{access_token:'access',refresh_token:'refresh'},error:null});
    await signInWithIdentifier('  Campus_Lead  ','password');
    expect(mocks.invoke).toHaveBeenCalledWith('username-auth',{body:{action:'signin',identifier:'campus_lead',password:'password'}});
    expect(mocks.setSession).toHaveBeenCalledWith({access_token:'access',refresh_token:'refresh'});
  });
  it('supports existing email login identifiers', async () => {
    mocks.invoke.mockResolvedValue({data:{access_token:'access',refresh_token:'refresh'},error:null});
    await signInWithIdentifier('Lead@Example.test','password');
    expect(mocks.invoke).toHaveBeenCalledWith('username-auth',{body:expect.objectContaining({identifier:'lead@example.test'})});
  });
  it('requests signup without email or automatic login', async () => {
    mocks.invoke.mockResolvedValue({data:{ok:true},error:null});
    await signUpWithUsername({username:'Campus_Lead',fullName:'Campus Lead',campusId:'campus',password:'long-password'});
    expect(mocks.invoke).toHaveBeenCalledWith('username-auth',{body:{action:'signup',username:'campus_lead',fullName:'Campus Lead',campusId:'campus',password:'long-password'}});
    expect(mocks.setSession).not.toHaveBeenCalled();
  });
  it('rejects malformed or failed login without exposing backend errors', async () => {
    mocks.invoke.mockResolvedValue({data:{error:'private@accounts.kocm.invalid'},error:{message:'private database'}});
    await expect(signInWithIdentifier('lead','password')).rejects.toThrow('Unable to sign in. Check your username or email and password.');
    expect(mocks.setSession).not.toHaveBeenCalled();
  });
  it('does not accept malformed sessions and reports session installation failures', async () => {
    mocks.invoke.mockResolvedValue({data:{access_token:'access'},error:null});
    await expect(signInWithIdentifier('lead','password')).rejects.toThrow('Unable to sign in');
    mocks.invoke.mockResolvedValue({data:{access_token:'access',refresh_token:'refresh'},error:null});
    mocks.setSession.mockResolvedValue({error:{message:'private'}});
    await expect(signInWithIdentifier('lead','password')).rejects.toThrow('Unable to sign in');
  });
  it('validates username locally and uses the authenticated username RPC', async () => {
    await expect(updateMyUsername('a!')).rejects.toThrow('3–30');
    expect(mocks.rpc).not.toHaveBeenCalled();
    await updateMyUsername(' Campus_Lead ');
    expect(mocks.rpc).toHaveBeenCalledWith('update_my_username',{p_username:'campus_lead'});
  });
});

describe('attaching an optional email', () => {
  it('uses the authenticated function with the current password', async () => {
    const {attachNotificationEmail}=await import('../lib/username-auth');
    mocks.invoke.mockResolvedValue({data:{ok:true,confirmationRequired:true},error:null});
    await attachNotificationEmail(' Lead@Example.test ','current-password');
    expect(mocks.invoke).toHaveBeenCalledWith('username-auth',{body:{action:'attach_email',email:'lead@example.test',currentPassword:'current-password'}});
  });
  it('truthfully reports an unconfigured verification sender', async () => {
    const {attachNotificationEmail}=await import('../lib/username-auth');
    mocks.invoke.mockResolvedValue({data:null,error:{context:new Response(JSON.stringify({error:'Email confirmation delivery is not configured. Your account email has not been changed.'}),{status:503})}});
    await expect(attachNotificationEmail('lead@example.test','password')).rejects.toThrow('Email verification sender is not configured yet.');
  });
});
