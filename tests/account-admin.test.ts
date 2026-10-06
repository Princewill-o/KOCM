import { describe, expect, it, vi } from 'vitest';
const transport = vi.hoisted(() => ({rpc:vi.fn(),invoke:vi.fn()}));
vi.mock('../lib/supabase', () => ({supabase:() => ({rpc:transport.rpc,functions:{invoke:transport.invoke}})}));
import { accessDraft, accessChanges, validateAccessDraft, saveAccountAccess, deliverAccountEmails } from '../lib/account-admin';
import type { Profile } from '../lib/koc';
const user: Profile = { id:'u', full_name:'Applicant', email:'a@example.test', role:'campus', status:'pending', campus_id:'campus', cluster_id:null, created_at:'' };
describe('staged account access', () => {
  it('retains the saved rejection explanation in a draft', () => {
    expect(accessDraft({...user,rejection_reason:'Correct the campus details'}).reason).toBe('Correct the campus details');
  });
  it('records failed batches as unsent even with a successful HTTP response', async () => {
    transport.invoke.mockResolvedValue({data:{sent:1,failed:1},error:null});
    await expect(deliverAccountEmails()).rejects.toThrow('remain saved for retry');
    transport.rpc.mockResolvedValue({error:null});
    await expect(saveAccountAccess(user.id,{...accessDraft(user),status:'rejected',reason:'Incorrect details'})).resolves.toEqual({emailQueued:true});
  });
  it('keeps current assignment in an independent draft', () => {
    const draft = accessDraft(user); draft.role = 'admin';
    expect(user.role).toBe('campus');
    expect(draft.campusId).toBe('campus');
  });
  it('requires scope before assigning campus and cluster access', () => {
    expect(validateAccessDraft({...accessDraft(user),campusId:''})).toContain('university');
    expect(validateAccessDraft({...accessDraft(user),role:'cluster',clusterId:''})).toContain('cluster');
    expect(validateAccessDraft({...accessDraft(user),role:'admin',campusId:''})).toBeNull();
  });
  it('requires an explanation when declining and bounds the reason', () => {
    expect(validateAccessDraft({...accessDraft(user),status:'rejected'})).toContain('reason');
    expect(validateAccessDraft({...accessDraft(user),status:'rejected',reason:'x'.repeat(1001)})).toContain('1,000');
  });
  it('requires saved campus scope even when declining', () => {
    expect(validateAccessDraft({...accessDraft(user),campusId:'',status:'rejected',reason:'Please provide your university'})).toContain('university');
  });
  it('sends the chosen scope and trims a decline explanation', () => {
    expect(accessChanges({...accessDraft(user),role:'cluster',clusterId:'north',status:'rejected',reason:'  Wrong university  '})).toEqual({role:'cluster',status:'rejected',campusId:null,clusterId:'north',rejectionReason:'Wrong university'});
  });
});
