import {beforeEach,expect,it,vi} from 'vitest';
const api=vi.hoisted(()=>({rpc:vi.fn(),from:vi.fn()}));
vi.mock('../lib/supabase',()=>({supabase:()=>api}));
import {submitClusterReport,listClusterReports} from '../lib/cluster-reports';
beforeEach(()=>api.rpc.mockReset());
it('loads older cluster reports beyond the first page',async()=>{const rows=Array.from({length:501},(_,id)=>({id:String(id)}));const builder={select:()=>builder,order:()=>builder,range:async(from:number,to:number)=>({data:rows.slice(from,to+1),error:null})};api.from.mockReturnValue(builder);expect(await listClusterReports()).toHaveLength(501);});
it('passes the selected reporting week separately from answers',async()=>{api.rpc.mockResolvedValue({data:{id:'saved'},error:null});await submitClusterReport({scope:'cluster',areas:['incident'],incident:'no'},'request','2026-10-09');expect(api.rpc.mock.calls[0][1].p_week_ending).toBe('2026-10-09');});
it('sends only visible answers with the stable request ID',async()=>{api.rpc.mockResolvedValue({data:{id:'saved',created_at:'now'},error:null});expect(await submitClusterReport({scope:'cluster',campusId:'',areas:['incident'],incident:'no','incident.description':'hidden'},'request')).toEqual({id:'saved',created_at:'now'});expect(api.rpc).toHaveBeenCalledWith('submit_cluster_report',{p_answers:{scope:'cluster',campusId:'',areas:['incident'],incident:'no'},p_request_id:'request'});});
it('rejects API failure rather than showing a successful save',async()=>{api.rpc.mockResolvedValue({data:null,error:{message:'Permission denied'}});await expect(submitClusterReport({scope:'cluster',areas:['incident']},'request')).rejects.toThrow();});
