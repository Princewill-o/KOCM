'use client';
import {supabase} from './supabase';
import {friendly} from './koc';
import {collectPages} from './pagination';
import {leadApplicationSchema,type LeadApplicationInput,type LeadApplicationAnswers} from './lead-application-schema';
export type ApplicationCampus={id:string;name:string;lifecycle_status:'active'|'inactive'|'in_process'};
export type LeadApplication={id:string;request_id:string;user_id:string;kind:'existing'|'new';campus_id:string|null;answers:LeadApplicationAnswers;created_at:string};
export type LeadApplicationRecord=LeadApplication;
export type {LeadApplicationInput,LeadApplicationAnswers};
export async function listApplicationCampuses():Promise<ApplicationCampus[]>{const {data,error}=await supabase().rpc('list_application_campuses');if(error)throw new Error('Unable to load universities. Please refresh and try again.');if(!Array.isArray(data))throw new Error('Unable to load universities.');return data;}
export async function submitLeadApplication(input:unknown):Promise<void>{
 const body=leadApplicationSchema.parse(input);
 const {data,error}=await supabase().functions.invoke('lead-application',{body});
 if(error||data?.ok!==true)throw new Error('Your application could not be submitted. Check your details and try again.');
}
export async function listLeadApplications(campusId?:string):Promise<LeadApplication[]>{
 return collectPages(async(from,to)=>{let query=supabase().from('lead_applications').select('*').order('created_at',{ascending:false}).order('id').range(from,to);if(campusId)query=query.eq('campus_id',campusId);const {data,error}=await query;if(error)throw new Error(friendly(error));return data??[];});
}
