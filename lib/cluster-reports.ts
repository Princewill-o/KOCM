'use client';
import {supabase} from './supabase';
import {friendly} from './koc';
import {sanitizeClusterDraft,type ClusterDraft} from './cluster-report-form';
export type ClusterReportRecord={id:string;cluster_id:string;campus_id:string|null;scope:'cluster'|'campus';answers:ClusterDraft;submitted_by:string;submitter_name:string;submitter_email:string;created_at:string};
export async function submitClusterReport(draft:ClusterDraft,requestId:string):Promise<{id:string;created_at:string}>{
 const {data,error}=await supabase().rpc('submit_cluster_report',{p_answers:sanitizeClusterDraft(draft),p_request_id:requestId});
 if(error) throw new Error(friendly(error));
 if(!data?.id) throw new Error('The report could not be confirmed. Please retry.');
 return data;
}
export async function listClusterReports():Promise<ClusterReportRecord[]>{
 const {data,error}=await supabase().from('cluster_reports').select('*').order('created_at',{ascending:false}).limit(100);
 if(error) throw new Error(friendly(error));
 return data??[];
}
