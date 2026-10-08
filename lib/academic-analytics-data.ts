'use client';
import {supabase} from './supabase';
import {collectPages} from './pagination';
import {friendly,type Report} from './koc';
import type {Season} from './reporting';
import type {CampusFeedbackRecord} from './campus-weekly';
import type {HistoricalReviewData} from './historical-review';
export type AcademicAnalyticsData={seasons:Season[];reports:Report[];feedback:CampusFeedbackRecord[];historicalReview?:HistoricalReviewData|null};
/** All three queries use normal authenticated RLS, stable page order, and actual persisted seasons. */
export async function loadAcademicAnalyticsData():Promise<AcademicAnalyticsData>{
 const load=<T>(table:string,order:string)=>collectPages<T>(async(from,to)=>{const {data,error}=await supabase().from(table).select('*').order(order).order('id').range(from,to);if(error)throw new Error(friendly(error));return(data??[]) as T[];});
 const [seasons,reports,feedback,history]=await Promise.all([load<Season>('seasons','start_date'),load<Report>('reports','week_ending'),load<CampusFeedbackRecord>('campus_weekly_feedback','week_ending'),load<{id:string;payload:HistoricalReviewData}>('admin_historical_reviews','id')]);
 return {seasons,reports,feedback,historicalReview:history.find(row=>row.id==='koc-review-2023-2024')?.payload??null};
}
