import {createClient} from '@supabase/supabase-js';
import {createLeadApplicationHandler} from './handler.ts';
const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');if(!url||!key)throw new Error('Application configuration is missing.');const service=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
Deno.serve(createLeadApplicationHandler({publishableKey:'sb_publishable_C2z55xhqXzGgj9rqjkHj5g_uetKwEYC',
 claim:async identity=>{const {data,error}=await service.rpc('claim_username_auth',{p_identity:identity,p_action:'signup'});if(error)throw error;return data===true;},
 completed:async(requestId,answers,photoHash)=>{const {data,error}=await service.rpc('completed_public_lead_request',{p_request_id:requestId,p_answers:answers,p_photo_sha256:photoHash});if(error)throw error;return typeof data==='string'?data:null;},
 upload:async(path,photo)=>{const {error}=await service.storage.from('trainee-photos').upload(path,photo,{contentType:'image/png',upsert:false,cacheControl:'0'});if(error)throw error;},
 persist:async(answers,requestId,path,photoHash)=>{const {data,error}=await service.rpc('persist_public_lead_request',{p_answers:answers,p_request_id:requestId,p_photo_path:path,p_photo_sha256:photoHash});if(error||!data?.id)throw new Error('Application persistence failed.');return data.id;}
}));
