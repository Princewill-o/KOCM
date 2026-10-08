'use client';
import {supabase} from './supabase';
import {friendly} from './koc';
import {sanitizeCampusWeekly,type CampusWeeklyAnswers} from './campus-weekly-form';
export type CampusFeedbackRecord={id:string;report_id:string;campus_id:string;campus_name:string;submitted_by:string;submitter_name:string;week_ending:string;season_id:string;is_late:boolean;answers:CampusWeeklyAnswers;created_at:string;request_id:string};
export async function submitCampusWeeklyFeedback(weekEnding:string,answers:CampusWeeklyAnswers,requestId:string):Promise<CampusFeedbackRecord>{const {data,error}=await supabase().rpc('submit_campus_weekly_feedback',{p_week_ending:weekEnding,p_answers:sanitizeCampusWeekly(answers),p_request_id:requestId});if(error)throw new Error(friendly(error));if(!data?.id)throw new Error('The report could not be confirmed. Retry without changing your answers.');return data;}
export async function listCampusFeedbackReports(campusId?:string):Promise<CampusFeedbackRecord[]>{let query=supabase().from('campus_weekly_feedback').select('*').order('created_at',{ascending:false}).limit(100);if(campusId)query=query.eq('campus_id',campusId);const {data,error}=await query;if(error)throw new Error(friendly(error));return data??[];}
