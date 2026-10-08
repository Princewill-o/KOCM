// @vitest-environment jsdom
import {createElement} from 'react';
import {cleanup,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
const load=vi.hoisted(()=>vi.fn());
vi.mock('../lib/lead-applications',()=>({listLeadApplications:load}));
import LeadApplicationRecords from '../app/views/lead-application-records';
afterEach(()=>{cleanup();load.mockReset();});
it('requests only the selected university and shows applicant answers without granting access',async()=>{
 load.mockResolvedValue([{id:'a',user_id:'u',campus_id:'c',kind:'existing',created_at:'2026-10-08T12:00:00Z',answers:{fullName:'Test Applicant',username:'test_applicant',course:'Law',studyYear:2,motivation:'A reason to lead',experience:'Previous experience',availability:'Tuesday evening',plan:'A fellowship plan',phone:''}}]);
 render(createElement(LeadApplicationRecords,{campusId:'c'}));expect(await screen.findByText(/Test Applicant/)).toBeTruthy();expect(load).toHaveBeenCalledWith('c');expect(screen.getByText('A fellowship plan')).toBeTruthy();expect(screen.queryByRole('button',{name:'Approve'})).toBeNull();
});
it('clears old university applications when the next load fails',async()=>{
 load.mockResolvedValue([{id:'a',user_id:'u',campus_id:'c',kind:'existing',created_at:'2026-10-08T12:00:00Z',answers:{fullName:'Test Applicant'}}]);const view=render(createElement(LeadApplicationRecords,{campusId:'c'}));await screen.findByText(/Test Applicant/);
 load.mockRejectedValue(new Error('Access denied'));view.rerender(createElement(LeadApplicationRecords,{campusId:'d'}));expect(await screen.findByRole('alert')).toBeTruthy();expect(screen.queryByText(/Test Applicant/)).toBeNull();
});
