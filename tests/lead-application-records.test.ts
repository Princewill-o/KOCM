// @vitest-environment jsdom
import {createElement} from 'react';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
const load=vi.hoisted(()=>vi.fn());
const photo=vi.hoisted(()=>vi.fn());const review=vi.hoisted(()=>vi.fn());
vi.mock('../lib/lead-applications',()=>({listLeadApplications:load,applicationPhotoUrl:photo,reviewLeadRequest:review}));
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

it('loads a private photo only after opening and records decisions separately from access',async()=>{load.mockResolvedValue([{id:'request',user_id:null,campus_id:'c',kind:'existing',status:'pending',photo_path:'private/request.png',created_at:'2026-10-09T12:00:00Z',answers:{fullName:'Public Applicant'}}]);photo.mockResolvedValue('https://private.example/signed');review.mockRejectedValue(new Error('Denied'));render(createElement(LeadApplicationRecords,{campusId:'c'}));fireEvent.click(await screen.findByText(/Public Applicant/));const details=screen.getByText(/Public Applicant/).closest('details')!;details.open=true;fireEvent(details,new Event('toggle'));await screen.findByAltText('Applicant face photo');expect(photo).toHaveBeenCalledWith('private/request.png');fireEvent.click(screen.getByText('Approve request'));await waitFor(()=>expect(review).toHaveBeenCalledWith('request','approved',''));expect(await screen.findByText('The review decision could not be saved.')).toBeTruthy();});
