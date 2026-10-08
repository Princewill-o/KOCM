import {createClient} from '@supabase/supabase-js';
import {createLeadApplicationHandler} from './handler.ts';
const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');if(!url||!key)throw new Error('Application configuration is missing.');const service=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
Deno.serve(createLeadApplicationHandler({publishableKey:'sb_publishable_C2z55xhqXzGgj9rqjkHj5g_uetKwEYC',
 claim:async identity=>{const {data,error}=await service.rpc('claim_username_auth',{p_identity:identity,p_action:'signup'});if(error)throw error;return data===true;},
 completed:async(requestId,answers)=>{const {data,error}=await service.rpc('lead_application_completed',{p_request_id:requestId,p_answers:answers});if(error)throw error;return data===true;},
 create:async input=>{const {data,error}=await service.auth.admin.createUser({email:`${crypto.randomUUID()}@accounts.kocm.invalid`,password:input.password,email_confirm:true,user_metadata:{full_name:input.fullName}});if(error||!data.user)throw new Error('Auth creation failed.');return data.user.id;},
 persist:async(userId,answers,requestId)=>{const {data,error}=await service.rpc('persist_lead_application',{p_user_id:userId,p_answers:answers,p_request_id:requestId});if(error||!data?.user_id)throw new Error('Application persistence failed.');return {user_id:data.user_id};},
 remove:async id=>{const {error}=await service.auth.admin.deleteUser(id);if(error)throw error;}
}));
