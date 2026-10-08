import {describe,it,expect} from 'vitest';
import {buildAcademicAnalytics,compareAcademicAnalytics} from '../lib/academic-analytics';
import type {Campus,Report} from '../lib/koc';
import type {Season} from '../lib/reporting';
import type {CampusFeedbackRecord} from '../lib/campus-weekly';
const season:Season={id:'2026',name:'2026–27',start_date:'2026-09-18',end_date:'2027-05-28',deadline_hour:22,time_zone:'Europe/London'};
const campuses:Campus[]=[{id:'a',name:'Campus A',region:'London',is_active:true},{id:'b',name:'Campus B',region:'London',is_active:true},{id:'c',name:'Inactive',region:'North',is_active:false}];
const report=(id:string,campus_id='a',week_ending='2026-09-18'):Report=>({id,campus_id,week_ending,season_id:'2026',attendance:10,prayer_minutes:60,evangelism_minutes:30,outreach_outings:1,notes:'',submitted_at:'2026-09-18T12:00:00Z',updated_at:'2026-09-18T12:00:00Z',is_late:false});
const feedback=(id:string):CampusFeedbackRecord=>({id,report_id:'r',campus_id:'a',campus_name:'Campus A',submitted_by:'u',submitter_name:'Lead',week_ending:'2026-09-18',season_id:'2026',is_late:false,created_at:'2026-09-18T13:00:00Z',request_id:'request',answers:{attendanceExcludingLead:12,prayerMinutes:90,evangelismMinutes:40,outreachOutings:2,firstTimers:3,holyGhostBaptism:'no'} as CampusFeedbackRecord['answers']});
describe('academic-year analytics',()=>{
 it('includes the open current Friday and distinguishes pending from overdue weeks',()=>{
  const a=buildAcademicAnalytics({season,campuses,reports:[report('early','a','2026-10-09'),report('notopen','a','2026-10-16')],feedback:[],period:'full',asOf:'2026-10-08'});
  expect(a.weeks.at(-1)).toBe('2026-10-09');expect(a.overall.totals.attendance).toBe(10);expect(a.overall.expectedWeeks).toBe(8);expect(a.overall.missingDueWeeks).toBe(6);expect(a.overall.pendingWeeks).toBe(1);
 });
 it('keeps an opened Friday crossing into the next month in monthly totals',()=>{
  const a=buildAcademicAnalytics({season,campuses,reports:[report('early','a','2026-11-06')],feedback:[],period:'full',asOf:'2026-10-31'});
  expect(a.monthly.find(m=>m.date==='2026-11-01')?.totals.attendance).toBe(10);
 });
 it('compares total changes over matching elapsed academic weeks',()=>{
  const current=buildAcademicAnalytics({season,campuses,reports:[report('new')],feedback:[],period:'full',asOf:'2026-09-18'});
  const older={...season,id:'2025',start_date:'2025-09-19',end_date:'2026-05-29'};
  const previous=buildAcademicAnalytics({season:older,campuses,reports:[{...report('old','a','2025-09-19'),season_id:'2025',attendance:5},{...report('later','a','2025-09-26'),season_id:'2025',attendance:90}],feedback:[],period:'full',asOf:'2026-10-08'});
  const comparison=compareAcademicAnalytics(current,previous);expect(comparison.matchedWeekCount).toBe(1);expect(comparison.matchedSummaries.previous.totals.attendance).toBe(5);expect(comparison.deltas.attendance).toBe(5);
 });

 it('uses following January31 and excludes inactive/current future weeks',()=>{
  const a=buildAcademicAnalytics({season,campuses,reports:[report('r'),report('inactive','c'),report('future','a','2027-02-05')],feedback:[],period:'midyear',asOf:'2027-05-30'});
  expect(a.endDate).toBe('2027-01-31');expect(a.overall.totals.attendance).toBe(10);expect(a.campuses).toHaveLength(2);expect(a.weeks.at(-1)).toBe('2027-01-29');
 });
 it('does not count linked report and feedback twice; hidden tongues no means zero',()=>{
  const a=buildAcademicAnalytics({season,campuses,reports:[report('r')],feedback:[feedback('f')],period:'full',asOf:'2026-09-18'});
  expect(a.overall.submittedWeeks).toBe(1);expect(a.overall.totals.attendance).toBe(12);expect(a.overall.totals.firstTimers).toBe(3);expect(a.overall.totals.tonguesRecipients).toBe(0);
  expect(a.overall.expectedWeeks).toBe(2);expect(a.overall.coverage).toBe(.5);expect(a.overall.missingWeeks).toBe(1);
 });
 it('honours newer admin edits to linked core stats without losing feedback outcomes or double counting',()=>{
  const edited={...report('r'),attendance:30,prayer_minutes:120,evangelism_minutes:75,outreach_outings:4,updated_at:'2026-09-19T12:00:00Z'};
  const a=buildAcademicAnalytics({season,campuses,reports:[edited],feedback:[feedback('f')],period:'full',asOf:'2026-09-25'});
  expect(a.overall.totals.attendance).toBe(30);expect(a.overall.totals.prayerMinutes).toBe(120);expect(a.overall.totals.evangelismMinutes).toBe(75);expect(a.overall.totals.outreachOutings).toBe(4);expect(a.overall.totals.firstTimers).toBe(3);expect(a.overall.submittedWeeks).toBe(1);
 });
 it('does not let an unrelated newer report override a feedback snapshot',()=>{
  const unrelated={...report('other-id'),attendance:99,updated_at:'2026-09-19T12:00:00Z'};
  const a=buildAcademicAnalytics({season,campuses,reports:[unrelated],feedback:[feedback('f')],period:'full',asOf:'2026-09-25'});
  expect(a.overall.totals.attendance).toBe(12);expect(a.overall.submittedWeeks).toBe(1);
 });
 it('keeps no reports and legacy extended metrics unknown, with averages over observed submissions',()=>{
  const a=buildAcademicAnalytics({season,campuses,reports:[report('r'),report('r2','a','2026-09-25')],feedback:[],period:'full',asOf:'2026-09-25'});
  expect(a.overall.averages.attendance).toBe(10);expect(a.overall.totals.firstTimers).toBeNull();expect(a.campuses.find(c=>c.campusId==='b')?.totals.attendance).toBeNull();expect(a.overall.expectedWeeks).toBe(4);expect(a.overall.coverage).toBe(.5);
 });
 it('aligns comparison by academic week/month rather than calendar date',()=>{
  const current=buildAcademicAnalytics({season,campuses,reports:[report('r')],feedback:[],period:'midyear',asOf:'2026-09-25'});
  const older={...season,id:'2025',start_date:'2025-09-19',end_date:'2026-05-29'};
  const previous=buildAcademicAnalytics({season:older,campuses,reports:[{...report('old','a','2025-09-19'),season_id:'2025',attendance:5}],feedback:[],period:'midyear',asOf:'2026-09-25'});
  const comparison=compareAcademicAnalytics(current,previous);expect(comparison.weekly[0].current?.totals.attendance).toBe(10);expect(comparison.weekly[0].previous?.totals.attendance).toBe(5);expect(comparison.deltas.attendance).toBe(5);expect(comparison.percentageChanges.attendance).toBe(100);
 });
});
