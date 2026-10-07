// @vitest-environment jsdom
import {createElement} from 'react';
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
const load=vi.hoisted(()=>vi.fn());
vi.mock('../lib/platform',()=>({listCampusLeadProfiles:load}));
vi.mock('../lib/koc',()=>({friendly:(error:Error)=>error.message}));
import CampusNetwork from '../app/views/campus-network';
afterEach(()=>{cleanup();load.mockReset();});
it('opens a lead from a map pin and navigates to that university statistics',async()=>{
 load.mockResolvedValue([{campus_id:'a',campus_name:'London Campus',region:'London',latitude:51.5,longitude:-0.1,lead_id:'lead',lead_name:'Test Lead',lead_email:'lead@example.test',lead_phone:'07700900123',lead_course:'Law',lead_year:2}]);
 const jump=vi.fn();render(createElement(CampusNetwork,{jump}));
 fireEvent.click(await screen.findByRole('button',{name:'Open campus lead profile: London Campus'}));
 const profile=within(screen.getByRole('region',{name:'Selected campus lead profile'}));
 expect(profile.getByText('Test Lead')).toBeTruthy();expect(profile.getByRole('link',{name:'lead@example.test'}).getAttribute('href')).toBe('mailto:lead@example.test');
 fireEvent.click(profile.getByRole('button',{name:'Campus statistics'}));expect(jump).toHaveBeenCalledWith('campus',{campusId:'a'});
});
it('keeps campuses without coordinates selectable and does not invent a leader',async()=>{
 load.mockResolvedValue([{campus_id:'b',campus_name:'Unknown Campus',region:'North',latitude:null,longitude:null,lead_id:null}]);
 render(createElement(CampusNetwork,{jump:vi.fn()}));
 fireEvent.click(await screen.findByRole('button',{name:/Unknown Campus/}));
 expect(screen.getByText('No campus lead assigned')).toBeTruthy();expect(screen.queryByRole('button',{name:'Open campus lead profile: Unknown Campus'})).toBeNull();
 fireEvent.change(screen.getByRole('searchbox'),{target:{value:'missing'}});expect(screen.getByText('No campuses match your search.')).toBeTruthy();
});
it('shows directory access failures without exposing cached details',async()=>{
 load.mockRejectedValue(new Error('Administrator access required.'));render(createElement(CampusNetwork,{jump:vi.fn()}));
 expect((await screen.findByRole('alert')).textContent).toBe('Administrator access required.');expect(screen.queryByRole('searchbox')).toBeNull();
});
