// @vitest-environment jsdom
import React from 'react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {render,screen,cleanup,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Grades from '../app/views/grades';
import Notifications from '../app/views/notifications';
import Materials from '../app/views/materials';
import type {Profile,Campus} from '../lib/koc';
const mocks = vi.hoisted(()=>({listGrades:vi.fn(),submitGrade:vi.fn(),listNotifications:vi.fn(),acknowledgeNotification:vi.fn(),listMaterials:vi.fn()}));
vi.mock('../lib/platform',()=>({...mocks}));
vi.mock('../lib/koc',()=>({friendly:(e:unknown)=>e instanceof Error?e.message:'Error'}));
const campuses:Campus[]=[{id:'own',name:'Own university',region:'London'}];
const profile:Profile={id:'u',full_name:'Test campus',email:'campus@example.test',role:'campus',status:'active',campus_id:'own',created_at:''};
afterEach(cleanup);
beforeEach(()=>{vi.resetAllMocks();mocks.listGrades.mockResolvedValue([]);mocks.listMaterials.mockResolvedValue([]);mocks.submitGrade.mockResolvedValue({});});
describe('visible campus workflows',()=>{
 it('submits the campus’s own grade with the selected percentage',async()=>{
  const user=userEvent.setup();render(React.createElement(Grades,{profile,campuses}));
  const select=screen.getByLabelText('University');expect(select.hasAttribute('disabled')).toBe(true);expect(select.textContent).toContain('Own university');
  await user.type(screen.getByLabelText('Student name'),'Test Student');
  await user.type(screen.getByLabelText('Course'),'History');
  await user.type(screen.getByLabelText('Assessment'),'Essay');
  await user.type(screen.getByLabelText('Grade (%)'),'58.99');
  await user.type(screen.getByLabelText('Assessment date'),'2026-10-01');
  await user.click(screen.getByRole('button',{name:'Submit grade'}));
  await waitFor(()=>expect(mocks.submitGrade).toHaveBeenCalledWith(expect.objectContaining({campusId:'own',percentage:58.99,studentName:'Test Student'})));
 });
 it('does not offer a grade submission form to read-only cluster leads',async()=>{
  render(React.createElement(Grades,{profile:{...profile,role:'cluster',campus_id:null,cluster_id:'london'},campuses}));
  await waitFor(()=>expect(mocks.listGrades).toHaveBeenCalled());
  expect(screen.queryByRole('button',{name:'Submit grade'})).toBeNull();
 });
 it('acknowledges a notification and displays its recorded read status',async()=>{
  const alert={id:'n',kind:'low_grade',title:'Grade requires follow-up',message:'Test Student needs support.',created_at:'2026-10-05T10:00:00Z',read_at:null};
  mocks.listNotifications.mockResolvedValueOnce([alert]).mockResolvedValue([{...alert,read_at:'2026-10-05T11:00:00Z'}]);
  mocks.acknowledgeNotification.mockResolvedValue({});
  const user=userEvent.setup();render(React.createElement(Notifications));
  await user.click(await screen.findByRole('button',{name:'Mark as read'}));
  await waitFor(()=>expect(mocks.acknowledgeNotification).toHaveBeenCalledWith('n'));
  expect(await screen.findByText(/Read ·/)).toBeTruthy();
  expect(screen.queryByRole('button',{name:'Mark as read'})).toBeNull();
 });
 it('does not offer material uploads to campus accounts',async()=>{
  render(React.createElement(Materials,{profile,campuses}));
  await screen.findByText('No materials have been shared yet.');
  expect(screen.queryByRole('button',{name:'Upload material'})).toBeNull();
 });
});
