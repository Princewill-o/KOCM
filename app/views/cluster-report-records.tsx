'use client';
import {useEffect,useState} from 'react';
import {listClusterReports,type ClusterReportRecord} from '@/lib/cluster-reports';
import {clusterAreas,visibleQuestions} from '@/lib/cluster-report-form';
import {formatDate} from '@/lib/reporting';
import type {Campus} from '@/lib/koc';
export default function ClusterReportRecords({campuses}:{campuses:Campus[]}){
 const [refresh,setRefresh]=useState(0);
 const [records,setRecords]=useState<ClusterReportRecord[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 useEffect(()=>{let alive=true;listClusterReports().then(r=>{if(alive)setRecords(r);}).catch(e=>{if(alive)setError(e.message);}).finally(()=>{if(alive)setLoading(false);});return()=>{alive=false;};},[refresh]);
 return <section className="panel padded"><h2>Submitted cluster reports</h2><button type="button" className="button" onClick={()=>setRefresh(v=>v+1)}>Refresh reports</button><p>Open a record to read its submitted answers.</p>{loading&&<p role="status">Loading reports…</p>}{error&&<p role="alert">{error}</p>}{!loading&&!error&&!records.length&&<p>No cluster reports submitted yet.</p>}{records.map(r=><details key={r.id} style={{borderTop:'1px solid var(--border)',padding:'16px 0'}}><summary>{campuses.find(c=>c.id===r.campus_id)?.name??campuses.find(c=>c.cluster_id===r.cluster_id)?.region??'Cluster'} · {new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/London'}).format(new Date(r.created_at))}</summary><p>{r.week_ending && <>Reporting week: {formatDate(r.week_ending)}{r.is_late ? ' · Late' : ''}<br/></>}Reference: {r.id}<br/>Submitted by: {r.submitter_name} {r.submitter_email.endsWith('.invalid') ? '' : `(${r.submitter_email})`}<br/>Scope: {r.scope==='cluster'?'Whole cluster':'Individual campus'}</p>{clusterAreas.filter(a=>Array.isArray(r.answers.areas)&&r.answers.areas.includes(a.id)).map(a=><div key={a.id}><h3>{a.title}: {String(r.answers[a.id]??'Not answered')}</h3><dl>{visibleQuestions(r.answers,a).map(q=><div key={q.id}><dt>{q.label}</dt><dd style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{String(r.answers[q.id]??'Not answered')}</dd></div>)}</dl></div>)}</details>)}</section>;
}
