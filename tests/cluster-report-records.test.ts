// @vitest-environment jsdom
import {createElement} from 'react';
import {render,screen,cleanup} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
const api=vi.hoisted(()=>({list:vi.fn()}));
vi.mock('../lib/cluster-reports',()=>({listClusterReports:api.list}));
import Records from '../app/views/cluster-report-records';
afterEach(cleanup);
it('shows persisted answers and the server-recorded lead for administrators',async()=>{api.list.mockResolvedValue([{id:'saved',created_at:'2026-10-07T10:00:00Z',cluster_id:'c',campus_id:null,scope:'cluster',submitted_by:'u',submitter_name:'Lead name',submitter_email:'lead@example.test',answers:{scope:'cluster',areas:['incident'],incident:'yes','incident.description':'Please follow up'}}]);render(createElement(Records,{campuses:[{id:'campus',name:'Campus',region:'London',cluster_id:'c'}]}));expect(await screen.findByText(/Lead name/)).toBeTruthy();expect(screen.getByText('Please follow up')).toBeTruthy();});
it('shows query failures without inventing submitted records',async()=>{api.list.mockRejectedValue(new Error('Not permitted'));render(createElement(Records,{campuses:[]}));expect(await screen.findByRole('alert')).toHaveProperty('textContent','Not permitted');});
