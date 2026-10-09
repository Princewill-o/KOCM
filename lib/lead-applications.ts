'use client';
import {supabase,SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from './supabase';
import {friendly} from './koc';
import {collectPages} from './pagination';
import {leadApplicationSchema,type LeadApplicationInput,type LeadApplicationAnswers} from './lead-application-schema';
export type ApplicationCampus={id:string;name:string;lifecycle_status:'active'|'inactive'|'in_process'};
export type LeadApplication={id:string;request_id:string;user_id:string|null;photo_path?:string|null;status?:'pending'|'approved'|'rejected';review_reason?:string|null;kind:'existing'|'new';campus_id:string|null;answers:LeadApplicationAnswers;created_at:string};
export type LeadApplicationRecord=LeadApplication;
export type {LeadApplicationInput,LeadApplicationAnswers};
export async function listApplicationCampuses():Promise<ApplicationCampus[]>{const {data,error}=await supabase().rpc('list_application_campuses');if(error)throw new Error('Unable to load universities. Please refresh and try again.');if(!Array.isArray(data))throw new Error('Unable to load universities.');return data;}
export async function submitLeadApplication(input:unknown,photo:Blob):Promise<string>{
 const body=leadApplicationSchema.parse(input);
 const form=new FormData();form.append('application',JSON.stringify(body));form.append('photo',photo,'application-photo.png');
 const response=await fetch(`${SUPABASE_URL}/functions/v1/lead-application`,{method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY},body:form,credentials:'omit',cache:'no-store',redirect:'error'});
 const data=await response.json().catch(()=>null) as {ok?:boolean;reference?:string}|null;if(!response.ok||data?.ok!==true||typeof data.reference!=='string')throw new Error('Your request could not be submitted. Retry without changing your answers or photo.');return data.reference;
}
export async function listLeadApplications(campusId?:string):Promise<LeadApplication[]>{
 return collectPages(async(from,to)=>{let query=supabase().from('lead_applications').select('*').order('created_at',{ascending:false}).order('id').range(from,to);if(campusId)query=query.eq('campus_id',campusId);const {data,error}=await query;if(error)throw new Error(friendly(error));return data??[];});
}

export async function applicationPhotoUrl(path:string):Promise<string>{const {data,error}=await supabase().storage.from('trainee-photos').createSignedUrl(path,120);if(error||!data?.signedUrl)throw new Error('Unable to load this private photo.');return data.signedUrl;}
export async function reviewLeadRequest(id:string,status:'approved'|'rejected',reason:string):Promise<LeadApplication>{const {data,error}=await supabase().rpc('review_lead_request',{p_id:id,p_status:status,p_reason:reason.trim()||null});if(error||!data?.id)throw new Error('The review decision could not be saved.');return data;}
