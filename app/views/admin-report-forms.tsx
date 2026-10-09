'use client';
import {useState} from 'react';
import type {Campus,Profile} from '@/lib/koc';
import type {Season} from '@/lib/reporting';
import CampusWeeklyForm from './campus-weekly-form';
import ClusterReportForm from './cluster-report-form';
type Props={profile:Profile;campuses:Campus[];clusters:{id:string;name:string}[];season:Season;initialWeek?:string;campusId?:string;setCampusId?:(id:string)=>void};
export default function AdminReportForms({profile,campuses,clusters,season,initialWeek,campusId:initialCampus,setCampusId}:Props){
 const [kind,setKind]=useState<'campus'|'cluster'>('campus');
 const [campusId,selectCampus]=useState(initialCampus??'');
 const [clusterId,selectCluster]=useState('');
 const active=campuses.filter(c=>c.is_active!==false&&!['inactive','in_process'].includes(c.lifecycle_status??'active'));
 const availableClusters=clusters.filter(cluster=>active.some(c=>c.cluster_id===cluster.id));
 if(profile.role!=='admin'||profile.status!=='active')return <div className="panel">An approved administrator account is required.</div>;
 return <section><div className="panel"><h1>Weekly report forms</h1><p>Submit the complete campus or cluster form. Reports record your administrator identity.</p><div className="button-row"><button type="button" className="button" aria-pressed={kind==='campus'} onClick={()=>setKind('campus')}>Campus weekly feedback</button><button type="button" className="button" aria-pressed={kind==='cluster'} onClick={()=>setKind('cluster')}>Cluster report</button></div>{kind==='campus'?<label>Reporting campus<select className="input" value={campusId} onChange={e=>{selectCampus(e.target.value);setCampusId?.(e.target.value);}}><option value="">Choose an active campus</option>{active.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>:<label>Reporting cluster<select className="input" value={clusterId} onChange={e=>selectCluster(e.target.value)}><option value="">Choose a cluster</option>{availableClusters.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}</div>{kind==='campus'?(active.some(c=>c.id===campusId)?<CampusWeeklyForm key={campusId} profile={profile} campuses={active} campusId={campusId} season={season} initialWeek={initialWeek}/>:<p>Select a campus to open its weekly feedback form.</p>):availableClusters.some(c=>c.id===clusterId)?<ClusterReportForm key={clusterId} profile={profile} campuses={active} clusters={availableClusters} clusterId={clusterId} season={season} initialWeek={initialWeek}/>:<p>Select a cluster to open its report form.</p>}</section>;
}
