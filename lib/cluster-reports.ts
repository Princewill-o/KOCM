'use client';
import {supabase} from './supabase';
import {friendly} from './koc';
import {collectPages} from './pagination';
import {sanitizeClusterDraft,type ClusterDraft} from './cluster-report-form';
export type ClusterReportRecord={id:string;cluster_id:string;campus_id:string|null;scope:'cluster'|'campus';answers:ClusterDraft;submitted_by:string;submitter_name:string;submitter_email:string;created_at:string;season_id?:string|null;week_ending?:string|null;is_late?:boolean};
export async function submitClusterReport(draft:ClusterDraft,requestId:string,weekEnding?:string,clusterId?:string):Promise<{id:string;created_at:string}>{
 const {data,error}=await supabase().rpc('submit_cluster_report',{p_answers:sanitizeClusterDraft(draft),p_request_id:requestId,...(weekEnding?{p_week_ending:weekEnding}:{}),...(clusterId?{p_cluster_id:clusterId}:{})});
 if(error) throw new Error(friendly(error));
 if(!data?.id) throw new Error('The report could not be confirmed. Please retry.');
 return data;
}
export async function listClusterReports():Promise<ClusterReportRecord[]>{
 return collectPages(async(from,to)=>{const {data,error}=await supabase().from('cluster_reports').select('*').order('created_at',{ascending:false}).order('id').range(from,to);if(error)throw new Error(friendly(error));return data??[];});
}
