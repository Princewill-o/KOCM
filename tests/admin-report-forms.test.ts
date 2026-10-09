// @vitest-environment jsdom
import {createElement} from 'react';
import {afterEach,it,expect,vi} from 'vitest';
import {cleanup,render,screen,fireEvent} from '@testing-library/react';
import AdminReportForms from '../app/views/admin-report-forms';
import {campusWeeklySections} from '../lib/campus-weekly-form';
vi.mock('../lib/campus-weekly',()=>({submitCampusWeeklyFeedback:vi.fn()}));
vi.mock('../lib/cluster-reports',()=>({submitClusterReport:vi.fn()}));
afterEach(cleanup);
const props={profile:{id:'admin',full_name:'Actual Administrator',email:'admin@example.org',role:'admin' as const,status:'active' as const,campus_id:null,created_at:''},season:{id:'season',name:'Test',start_date:'2026-09-18',end_date:'2027-05-28',deadline_hour:22,time_zone:'Europe/London'},campuses:[{id:'active',name:'Active University',region:'North',cluster_id:'north',is_active:true},{id:'inactive',name:'Inactive University',region:'North',is_active:false}],clusters:[{id:'north',name:'North'}]};
it('uses the full campus template with the actual administrator identity and active campus selector',()=>{render(createElement(AdminReportForms,props));expect(screen.queryByRole('option',{name:'Inactive University'})).toBeNull();expect(screen.getByLabelText('Reporting campus').id).toBe('admin-report-campus');fireEvent.change(screen.getByLabelText('Reporting campus'),{target:{value:'active'}});expect((screen.getByLabelText('Full name') as HTMLInputElement).value).toBe('Actual Administrator');for(const section of campusWeeklySections)expect(screen.getByText(section.title)).toBeTruthy();expect(screen.getByText('Review feedback')).toBeTruthy();});
it('uses the same conditional cluster questions after selecting a cluster',()=>{render(createElement(AdminReportForms,props));fireEvent.click(screen.getByRole('button',{name:'Cluster report'}));expect(screen.getByLabelText('Reporting cluster').id).toBe('admin-report-cluster');fireEvent.change(screen.getByLabelText('Reporting cluster'),{target:{value:'north'}});expect(screen.getByText(/Actual Administrator/)).toBeTruthy();fireEvent.click(screen.getByLabelText('Incident'));fireEvent.change(screen.getByLabelText('Do you want to report any other issues regarding KOC? *'),{target:{value:'yes'}});expect(screen.getByText('Review answers')).toBeTruthy();expect(screen.getByRole('option',{name:'Active University'})).toBeTruthy();});
