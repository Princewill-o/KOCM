import type {Campus,Report} from './koc';
import {openingFor,deadlineFor,type Season} from './reporting';
import type {CampusFeedbackRecord} from './campus-weekly';
export const academicMetrics={attendance:'Fellowship attendance',prayerMinutes:'Prayer minutes',evangelismMinutes:'Evangelism minutes',outreachOutings:'Outreach outings',firstTimers:'Fellowship first timers',bornAgain:'Born again',tonguesRecipients:'Spoke in tongues',soulsWon:'Souls won',contactsTaken:'Contacts taken',contactsAttendedFellowship:'Contacts attending fellowship',homeVisits:'Home visits',churchAttendeesExcludingCore:'Church attendees excluding core',churchAttendeesIncludingCore:'Church attendees including core',churchFirstTimers:'Church first timers',overallServing:'People serving',newDepartmentJoiners:'New department joiners'} as const;
export type AcademicMetric=keyof typeof academicMetrics;
export type AcademicPeriod='midyear'|'full';
export type MetricValues=Record<AcademicMetric,number|null>;
export type AcademicSummary={totals:MetricValues;averages:MetricValues;observedWeeks:Record<AcademicMetric,number>;submittedWeeks:number;expectedWeeks:number;missingWeeks:number;missingDueWeeks:number;pendingWeeks:number;coverage:number|null};
export type AcademicCampusSummary=AcademicSummary&{campusId:string;campusName:string;region:string;clusterId:string|null};
export type AcademicRegionSummary=AcademicSummary&{region:string};
export type AcademicTrend=AcademicSummary&{date:string;label:string;academicWeek?:number;academicMonth?:number};
export type AcademicAnalytics={season:Season;period:AcademicPeriod;startDate:string;endDate:string;elapsedEndDate:string;weeks:string[];overall:AcademicSummary;campuses:AcademicCampusSummary[];regions:AcademicRegionSummary[];weekly:AcademicTrend[];monthly:AcademicTrend[]};
const keys=Object.keys(academicMetrics) as AcademicMetric[];
const number=(value:unknown):number|null=>typeof value==='number'&&Number.isFinite(value)&&value>=0?value:null;
const empty=()=>Object.fromEntries(keys.map(k=>[k,null])) as MetricValues;
const dateTime=(date:string)=>new Date(`${date}T12:00:00Z`).getTime();
const iso=(date:Date)=>date.toISOString().slice(0,10);
const minDate=(...dates:string[])=>dates.reduce((a,b)=>a<b?a:b);
export function academicPeriodEnd(season:Season,period:AcademicPeriod){return period==='full'?season.end_date:minDate(season.end_date,`${Number(season.start_date.slice(0,4))+1}-01-31`);}
type Observation={campusId:string;date:string;values:MetricValues};
function summarize(rows:Observation[],expectedWeeks:number,dueExpectedWeeks=expectedWeeks,dueDates?:Set<string>):AcademicSummary{
 const totals=empty(),averages=empty(),observedWeeks=Object.fromEntries(keys.map(k=>[k,0])) as Record<AcademicMetric,number>;
 for(const metric of keys){const values=rows.map(r=>r.values[metric]).filter((v):v is number=>v!==null);observedWeeks[metric]=values.length;if(values.length){totals[metric]=values.reduce((a,b)=>a+b,0);averages[metric]=totals[metric]!/values.length;}}
 const missingWeeks=Math.max(0,expectedWeeks-rows.length),missingDueWeeks=Math.max(0,dueExpectedWeeks-(dueDates?rows.filter(r=>dueDates.has(r.date)).length:rows.length));
 return {totals,averages,observedWeeks,submittedWeeks:rows.length,expectedWeeks,missingWeeks,missingDueWeeks,pendingWeeks:Math.max(0,missingWeeks-missingDueWeeks),coverage:expectedWeeks?rows.length/expectedWeeks:null};
}
/** Current active campuses only. A campus-week contributes once, with full feedback preferred over its linked legacy report. */
export function buildAcademicAnalytics({season,campuses,reports,feedback,period,asOf=new Date().toISOString()}:{season:Season;campuses:Campus[];reports:Report[];feedback:CampusFeedbackRecord[];period:AcademicPeriod;asOf?:string}):AcademicAnalytics{
 const active=campuses.filter(c=>c.is_active!==false&&(!c.lifecycle_status||c.lifecycle_status==='active'));
 const calendarDate=asOf.includes('T')?new Intl.DateTimeFormat('en-CA',{timeZone:season.time_zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(asOf)):asOf;
 const ids=new Set(active.map(c=>c.id)),startDate=season.start_date,endDate=academicPeriodEnd(season,period),elapsedEndDate=minDate(endDate,calendarDate);
 const asOfInstant=asOf.includes('T')?new Date(asOf):new Date(`${asOf}T12:00:00Z`);
 const weeks:string[]=[];for(let t=dateTime(startDate);t<=dateTime(endDate);t+=7*86400000){const date=iso(new Date(t));if(openingFor(date,season)<=asOfInstant)weeks.push(date);}
 const dueDates=new Set(weeks.filter(date=>deadlineFor(date,season)<=asOfInstant));
 const weekSet=new Set(weeks);const reportsById=new Map(reports.map(r=>[r.id,r]));const observations=new Map<string,Observation>();
 const eligible=(r:{campus_id:string;season_id:string;week_ending:string})=>ids.has(r.campus_id)&&r.season_id===season.id&&weekSet.has(r.week_ending);
 // Latest record wins if a historical import contains duplicate campus-week rows.
 for(const report of [...reports].sort((a,b)=>a.updated_at.localeCompare(b.updated_at)))if(eligible(report)){
 const values=empty();values.attendance=number(report.attendance);values.prayerMinutes=number(report.prayer_minutes);values.evangelismMinutes=number(report.evangelism_minutes);values.outreachOutings=number(report.outreach_outings);
 observations.set(`${report.campus_id}/${report.week_ending}`,{campusId:report.campus_id,date:report.week_ending,values});
 }
 for(const record of [...feedback].sort((a,b)=>a.created_at.localeCompare(b.created_at)))if(eligible(record)){
 const key=`${record.campus_id}/${record.week_ending}`,prior=observations.get(key),answers=record.answers,values=empty();
 for(const metric of keys){let value:unknown=metric==='attendance'?answers.attendanceExcludingLead:answers[metric as keyof typeof answers];if(metric==='tonguesRecipients'&&answers.holyGhostBaptism==='no')value=0;values[metric]=number(value);}
 for(const metric of ['attendance','prayerMinutes','evangelismMinutes','outreachOutings'] as AcademicMetric[])if(values[metric]===null&&prior)values[metric]=prior.values[metric];
 // Full feedback retains extended outcomes. Later edits of its exact linked report
 // are the current authority for the four shared metrics, not a second submission.
 const linked=reportsById.get(record.report_id);
 if(linked&&linked.campus_id===record.campus_id&&linked.season_id===record.season_id&&linked.week_ending===record.week_ending&&Date.parse(linked.updated_at)>Date.parse(record.created_at)){
  values.attendance=number(linked.attendance);values.prayerMinutes=number(linked.prayer_minutes);values.evangelismMinutes=number(linked.evangelism_minutes);values.outreachOutings=number(linked.outreach_outings);
 }

 observations.set(key,{campusId:record.campus_id,date:record.week_ending,values});
 }
 const rows=[...observations.values()];
 const campusSummaries=active.map(c=>({...summarize(rows.filter(r=>r.campusId===c.id),weeks.length,dueDates.size,dueDates),campusId:c.id,campusName:c.name,region:c.region,clusterId:c.cluster_id??null}));
 const regions=[...new Set(active.map(c=>c.region))].sort().map(region=>{const campusIds=new Set(active.filter(c=>c.region===region).map(c=>c.id));return {...summarize(rows.filter(r=>campusIds.has(r.campusId)),weeks.length*campusIds.size,dueDates.size*campusIds.size,dueDates),region};});
 const weekly=weeks.map((date,index)=>({...summarize(rows.filter(r=>r.date===date),active.length,dueDates.has(date)?active.length:0,dueDates),date,label:`Week ${index+1}`,academicWeek:index+1}));
 const monthly:AcademicTrend[]=[];const first=new Date(`${startDate.slice(0,7)}-01T12:00:00Z`);
 for(let d=new Date(first),index=1;iso(d)<=(weeks.at(-1)??elapsedEndDate);d.setUTCMonth(d.getUTCMonth()+1),index++){
 const month=iso(d).slice(0,7),monthWeeks=weeks.filter(w=>w.startsWith(month));
 monthly.push({...summarize(rows.filter(r=>r.date.startsWith(month)),monthWeeks.length*active.length,monthWeeks.filter(w=>dueDates.has(w)).length*active.length,dueDates),date:iso(d),label:d.toLocaleDateString('en-GB',{month:'short',timeZone:'UTC'}),academicMonth:index});
 }
 return {season,period,startDate,endDate,elapsedEndDate,weeks,overall:summarize(rows,weeks.length*active.length,dueDates.size*active.length,dueDates),campuses:campusSummaries,regions,weekly,monthly};
}
/** Pair by relative academic week. Growth uses the shared elapsed window, not a partial season versus a full year. */
export function compareAcademicAnalytics(current:AcademicAnalytics,previous:AcademicAnalytics){
 const align=(key:'weekly'|'monthly')=>Array.from({length:Math.max(current[key].length,previous[key].length)},(_,i)=>({index:i+1,label:key==='weekly'?`Week ${i+1}`:(current[key][i]??previous[key][i]).label,current:current[key][i]??null,previous:previous[key][i]??null}));
 const matchedWeekCount=Math.min(current.weekly.length,previous.weekly.length);
 const aggregate=(summaries:AcademicSummary[]):AcademicSummary=>{
  const totals=empty(),averages=empty(),observedWeeks=Object.fromEntries(keys.map(k=>[k,0])) as Record<AcademicMetric,number>;
  for(const metric of keys){const known=summaries.filter(s=>s.totals[metric]!==null);observedWeeks[metric]=known.reduce((sum,s)=>sum+s.observedWeeks[metric],0);if(known.length){totals[metric]=known.reduce((sum,s)=>sum+s.totals[metric]!,0);averages[metric]=totals[metric]!/observedWeeks[metric];}}
  const submittedWeeks=summaries.reduce((n,s)=>n+s.submittedWeeks,0),expectedWeeks=summaries.reduce((n,s)=>n+s.expectedWeeks,0);
  return {totals,averages,observedWeeks,submittedWeeks,expectedWeeks,coverage:expectedWeeks?submittedWeeks/expectedWeeks:null,missingWeeks:summaries.reduce((n,s)=>n+s.missingWeeks,0),missingDueWeeks:summaries.reduce((n,s)=>n+s.missingDueWeeks,0),pendingWeeks:summaries.reduce((n,s)=>n+s.pendingWeeks,0)};
 };
 const matchedSummaries={current:aggregate(current.weekly.slice(0,matchedWeekCount)),previous:aggregate(previous.weekly.slice(0,matchedWeekCount))};
 const deltas=empty(),percentageChanges=empty();for(const key of keys){const a=matchedSummaries.current.totals[key],b=matchedSummaries.previous.totals[key];if(a!==null&&b!==null){deltas[key]=a-b;if(b!==0)percentageChanges[key]=(a-b)/b*100;}}
 return {weekly:align('weekly'),monthly:align('monthly'),matchedWeekCount,matchedSummaries,deltas,percentageChanges};
}
