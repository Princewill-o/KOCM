// @vitest-environment jsdom
import {createElement} from 'react';
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
const load=vi.hoisted(()=>vi.fn());
vi.mock('../lib/campus-roster',()=>({listCampusRoster:load}));
vi.mock('../lib/koc',()=>({friendly:(error:Error)=>error.message}));
import CampusNetwork from '../app/views/campus-network';
afterEach(()=>{cleanup();load.mockReset();});
const campus={id:'a',name:'London Campus',region:'London',is_active:true,lifecycle_status:'active',latitude:51.5,longitude:-.1};
it('opens trainee details without inventing a primary lead',async()=>{
 load.mockResolvedValue({campuses:[campus],leaders:[{id:'trainee',campus_id:'a',full_name:'Test Trainee',course:'Law',study_year_text:'Year 2',grade_label:'First',training_attendance:'Attended',portrait_data:null,source_page:1,source_row:2,account_id:null}],primaryLeads:[]});
 render(createElement(CampusNetwork,{jump:vi.fn()}));fireEvent.click(await screen.findByRole('button',{name:'Open campus lead profile: London Campus'}));
 expect(screen.getByText('No primary lead assigned')).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:/View profile: Test Trainee/}));
 const detail=within(screen.getByRole('region',{name:'Trainee profile'}));expect(detail.getByText('Law')).toBeTruthy();expect(detail.getByText('2026 roster snapshot')).toBeTruthy();expect(detail.getByText('First')).toBeTruthy();
});
it('filters lifecycle status and disables statistics for inactive campuses',async()=>{
 load.mockResolvedValue({campuses:[campus,{...campus,id:'b',name:'Inactive Campus',is_active:false,lifecycle_status:'inactive'}],leaders:[],primaryLeads:[]});
 const jump=vi.fn();render(createElement(CampusNetwork,{jump}));await screen.findByText('1 active · 2 total campuses');
 fireEvent.change(screen.getByLabelText('Campus status'),{target:{value:'inactive'}});fireEvent.click(screen.getByRole('button',{name:'Open campus lead profile: Inactive Campus — Inactive'}));
 expect((screen.getByRole('button',{name:'Campus statistics'}) as HTMLButtonElement).disabled).toBe(true);expect(screen.queryByRole('button',{name:'Open campus lead profile: London Campus'})).toBeNull();expect(jump).not.toHaveBeenCalled();
});
it('searches trainee names and clears details on load failure',async()=>{
 load.mockResolvedValue({campuses:[campus],leaders:[{id:'t',campus_id:'a',full_name:'Unique Trainee'}],primaryLeads:[]});render(createElement(CampusNetwork,{jump:vi.fn()}));await screen.findByRole('searchbox');fireEvent.change(screen.getByRole('searchbox'),{target:{value:'Unique Trainee'}});expect(screen.getByRole('button',{name:'Open campus lead profile: London Campus'})).toBeTruthy();
 load.mockRejectedValue(new Error('Administrator access required.'));fireEvent.click(screen.getByText('Refresh'));await screen.findByRole('alert');expect(screen.queryByRole('searchbox')).toBeNull();
});
