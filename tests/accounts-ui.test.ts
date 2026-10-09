// @vitest-environment jsdom
import { createElement } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../lib/lead-applications',()=>({listLeadApplications:async()=>[]}));
const mocks = vi.hoisted(() => ({ list:vi.fn(),save:vi.fn(),email:vi.fn(),deliveries:vi.fn(),deliver:vi.fn() }));
vi.mock('../lib/koc', () => ({listProfiles:mocks.list,adminSetEmail:mocks.email,friendly:(e:Error) => e.message,ROLE_LABELS:{admin:'Administrator',campus:'Campus rep',cluster:'Cluster lead'}}));
vi.mock('../lib/platform', () => ({listClusters:() => Promise.resolve([{id:'north',name:'North',lead_name:'Naa'}])}));
vi.mock('../lib/account-admin', async importOriginal => ({...await importOriginal<object>(),saveAccountAccess:mocks.save,listAccountEmailDeliveries:mocks.deliveries,deliverAccountEmails:mocks.deliver}));
import Accounts from '../app/views/accounts';
import type { Profile } from '../lib/koc';
const applicant: Profile = {id:'applicant',full_name:'Applicant',email:'applicant@example.test',role:'campus',status:'pending',campus_id:'c',cluster_id:null,created_at:''};
const admin: Profile = {...applicant,id:'admin',role:'admin',status:'active'};
beforeEach(() => {vi.clearAllMocks();mocks.list.mockResolvedValue([applicant]);mocks.save.mockResolvedValue({emailQueued:false});mocks.deliveries.mockResolvedValue([]);});
afterEach(cleanup);
async function mount() {render(createElement(Accounts,{profile:admin,campuses:[{id:'c',name:'Campus',region:'North'}]}));await screen.findByLabelText('Role for Applicant');}
describe('account administration controls', () => {
  it('stages role and scope together before saving any privilege change', async () => {
    await mount();
    fireEvent.change(screen.getByLabelText('Role for Applicant'),{target:{value:'cluster'}});
    fireEvent.change(screen.getByLabelText('Cluster for Applicant'),{target:{value:'north'}});
    expect(mocks.save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Save access'));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith('applicant',expect.objectContaining({role:'cluster',clusterId:'north',status:'pending'})));
  });
  it('requires and sends a decline reason without claiming email sent', async () => {
    await mount();mocks.save.mockResolvedValue({emailQueued:true});
    expect((screen.getByText('Decline').closest('button') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Role for Applicant'),{target:{value:'admin'}});
    fireEvent.change(screen.getByLabelText('Decline reason (included in email)'),{target:{value:'University details need correcting'}});
    fireEvent.click(screen.getByText('Decline'));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith('applicant',expect.objectContaining({role:'campus',campusId:'c',status:'rejected',reason:'University details need correcting'})));
    await screen.findByText('Email sending is unavailable or not configured, or a message failed. Unsent messages remain saved for retry.');
  });
  it('preserves another account draft when saving an account', async () => {
    const other = {...applicant,id:'other',full_name:'Other'};
    mocks.list.mockResolvedValue([applicant,other]); await mount();
    fireEvent.change(screen.getByLabelText('Role for Other'),{target:{value:'admin'}});
    fireEvent.click(screen.getAllByText('Approve')[0]);
    await screen.findByText("Applicant's access updated.");
    expect((screen.getByLabelText('Role for Other') as unknown as {value:string}).value).toBe('admin');
  });
  it('preserves email editing when an email update fails', async () => {
    await mount();mocks.email.mockRejectedValue(new Error('Email update failed'));
    fireEvent.click(screen.getByLabelText('Change email for Applicant'));
    fireEvent.change(screen.getByLabelText('New email for Applicant'),{target:{value:'new@example.test'}});
    fireEvent.submit(screen.getByLabelText('New email for Applicant').closest('form')!);
    await screen.findByText('Email update failed');
    expect(screen.getByLabelText('New email for Applicant')).toBeTruthy();
  });
});

it('does not offer a stats editor role',async()=>{await mount();expect(screen.queryByRole('option',{name:'Stats editor'})).toBeNull();});
