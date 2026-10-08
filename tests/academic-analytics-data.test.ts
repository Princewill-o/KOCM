import {describe,it,expect,vi,beforeEach} from 'vitest';
const mock=vi.hoisted(()=>({rows:{} as Record<string,unknown[]>,calls:[] as {table:string;from:number;to:number}[],error:null as unknown}));
vi.mock('../lib/supabase',()=>({supabase:()=>({from:(table:string)=>{const builder={select:()=>builder,order:()=>builder,range:async(from:number,to:number)=>{mock.calls.push({table,from,to});return {data:mock.rows[table]?.slice(from,to+1)??[],error:mock.error};}};return builder;}})}));
import {loadAcademicAnalyticsData} from '../lib/academic-analytics-data';
describe('academic analytics authenticated data loading',()=>{
 beforeEach(()=>{mock.rows={};mock.calls=[];mock.error=null;});
 it('paginates every table without the old 100 feedback row truncation',async()=>{
  for(const table of ['seasons','reports','campus_weekly_feedback'])mock.rows[table]=Array.from({length:501},(_,i)=>({id:`${table}-${i}`}));
  const result=await loadAcademicAnalyticsData();expect(result.seasons).toHaveLength(501);expect(result.reports).toHaveLength(501);expect(result.feedback).toHaveLength(501);
  for(const table of ['seasons','reports','campus_weekly_feedback'])expect(mock.calls.filter(c=>c.table===table).map(c=>c.from)).toEqual([0,500]);
 });
 it('does not substitute synthetic seasons or swallow access failures',async()=>{
  expect(await loadAcademicAnalyticsData()).toEqual({seasons:[],reports:[],feedback:[],historicalReview:null});
  mock.error={message:'Access denied'};await expect(loadAcademicAnalyticsData()).rejects.toThrow('Access denied');
 });
});
