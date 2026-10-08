import {beforeEach,expect,it,vi} from 'vitest';
const api=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock('../lib/supabase',()=>({supabase:()=>api}));
import {submitClusterReport} from '../lib/cluster-reports';
beforeEach(()=>api.rpc.mockReset());
it('sends only visible answers with the stable request ID',async()=>{api.rpc.mockResolvedValue({data:{id:'saved',created_at:'now'},error:null});expect(await submitClusterReport({scope:'cluster',campusId:'',areas:['incident'],incident:'no','incident.description':'hidden'},'request')).toEqual({id:'saved',created_at:'now'});expect(api.rpc).toHaveBeenCalledWith('submit_cluster_report',{p_answers:{scope:'cluster',campusId:'',areas:['incident'],incident:'no'},p_request_id:'request'});});
it('rejects API failure rather than showing a successful save',async()=>{api.rpc.mockResolvedValue({data:null,error:{message:'Permission denied'}});await expect(submitClusterReport({scope:'cluster',areas:['incident']},'request')).rejects.toThrow();});
