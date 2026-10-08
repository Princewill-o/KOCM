'use client';
import {useEffect,useState} from 'react';
import {ArrowRight,MapPin,Search,UserRound,RefreshCw} from 'lucide-react';
import {UkCampusMap} from '@/components/ui/uk-campus-map';
import {UniversityBrand} from '@/components/ui/university-brand';
import {campusMapPoint} from '@/lib/campus-map';
import {listCampusRoster,updateCampusLifecycle,type CampusRoster,type RosterCampus} from '@/lib/campus-roster';
import {isInternalAccountEmail} from '@/lib/username-auth';
import {friendly} from '@/lib/koc';
import type {Jump} from '../dashboard';
import './campus-network.css';
import LeadApplicationRecords from './lead-application-records';
const statusLabel=(status:RosterCampus['lifecycle_status'])=>status==='in_process'?'In process':status==='inactive'?'Inactive':'Active';
function CampusStatusControl({campus,onSaved}:{campus:RosterCampus;onSaved:()=>Promise<void>}){
 const [value,setValue]=useState(campus.lifecycle_status),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function save(){setBusy(true);setError('');try{await updateCampusLifecycle(campus.id,value);await onSaved();}catch(e){setError(friendly(e));}finally{setBusy(false);}}
 return <div className="campus-roster-note"><label>Set campus status<select value={value} disabled={busy} onChange={e=>setValue(e.target.value as RosterCampus['lifecycle_status'])}><option value="active">Active</option><option value="inactive">Inactive</option><option value="in_process">In process</option></select></label><p className="small muted">Only active campuses count in statistics. Account approval is managed separately.</p>{error&&<p role="alert">{error}</p>}<button type="button" className="button" disabled={busy||value===campus.lifecycle_status} onClick={save}>{busy?'Saving…':'Save campus status'}</button></div>;
}
const empty:CampusRoster={campuses:[],leaders:[],primaryLeads:[]};
export default function CampusNetwork({jump,onCampusStatusChanged}:{jump:Jump;onCampusStatusChanged?:()=>Promise<void>}){
 const [roster,setRoster]=useState<CampusRoster>(empty),[selectedId,setSelectedId]=useState<string|null>(null),[traineeId,setTraineeId]=useState<string|null>(null),[query,setQuery]=useState(''),[status,setStatus]=useState('all'),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 async function refresh(){setLoading(true);setError('');setRoster(empty);setTraineeId(null);try{const rows=await listCampusRoster();setRoster(rows);setSelectedId(previous=>rows.campuses.some(row=>row.id===previous)?previous:null);}catch(e){setError(friendly(e));}finally{setLoading(false);}}
 useEffect(()=>{let alive=true;listCampusRoster().then(rows=>{if(alive)setRoster(rows);}).catch(e=>{if(alive){setRoster(empty);setError(friendly(e));}}).finally(()=>{if(alive)setLoading(false);});return()=>{alive=false;};},[]);
 const selected=roster.campuses.find(campus=>campus.id===selectedId);
 const primary=roster.primaryLeads.find(lead=>lead.campus_id===selectedId);
 const trainees=roster.leaders.filter(leader=>leader.campus_id===selectedId);
 const trainee=trainees.find(leader=>leader.id===traineeId);
 const visible=roster.campuses.filter(campus=>(status==='all'||campus.lifecycle_status===status)&&`${campus.name} ${campus.region} ${roster.leaders.filter(lead=>lead.campus_id===campus.id).map(lead=>lead.full_name).join(' ')} ${roster.primaryLeads.find(lead=>lead.campus_id===campus.id)?.lead_name??''}`.toLowerCase().includes(query.toLowerCase().trim()));
 const choose=(id:string)=>{setSelectedId(id);setTraineeId(null);};
 const validPortrait=(value:string|null)=>!!value&&/^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(value);
 return <>
  <div className="page-heading"><div><div className="eyebrow">CAMPUS LEADERSHIP</div><h1>Campus lead profiles</h1><p>Select a KOC to view its primary lead, trainee profiles and campus records.</p><p>{roster.campuses.filter(c=>c.lifecycle_status==='active'&&c.is_active).length} active · {roster.campuses.length} total campuses</p></div><button className="button" disabled={loading} onClick={refresh}><RefreshCw size={16}/>Refresh</button></div>
  {error&&<p className="management-alert" role="alert">{error}</p>}
  {loading?<p role="status">Loading campus leadership…</p>:!error&&<div className="campus-network-layout">
   <section className="campus-network-geography panel" aria-label="Campus network map">
    <UkCampusMap markers={visible.map(campus=>({id:campus.id,name:campus.lifecycle_status==='active'?campus.name:`${campus.name} — ${statusLabel(campus.lifecycle_status)}`,latitude:campus.latitude,longitude:campus.longitude,hasLead:campus.lifecycle_status==='active'&&!!roster.primaryLeads.find(lead=>lead.campus_id===campus.id)?.lead_id}))} selectedId={selectedId} onSelect={choose}/>
    <div className="campus-network-map-key"><span><i/>Active, assigned lead</span><span><i className="unassigned"/>Unassigned / inactive / in process</span></div>
    <p className="campus-network-source">Pins include their campus status. Pins remain at university reference locations, not confirmed meeting venues. UK boundary: Natural Earth. Locations: © OpenStreetMap contributors.</p>
   </section>
   <div className="campus-network-details">
    <section className="panel padded campus-lead-card" aria-live="polite" aria-label="Selected campus lead profile">
     {selected?<><div className="eyebrow">ADMIN · CAMPUS PROFILE</div><UniversityBrand campusName={selected.name}/><p className="muted">{selected.region} · <span className={`campus-lifecycle ${selected.lifecycle_status}`}>{statusLabel(selected.lifecycle_status)}</span></p>
      <CampusStatusControl key={selected.id+selected.lifecycle_status} campus={selected} onSaved={async()=>{await refresh();await onCampusStatusChanged?.();}}/>{selected.lifecycle_status!=='active'&&<p className="campus-roster-note">This campus is excluded from active statistics and reporting.</p>}
      <div className="campus-lead-identity"><span aria-hidden="true"><UserRound size={25}/></span><div><h3>{primary?.lead_name??'No primary lead assigned'}</h3><p className="muted">{primary?.lead_id?'Approved primary campus lead':'Assign an approved account in Accounts & access.'}</p></div></div>
      {primary?.lead_id&&<dl className="campus-lead-facts"><dt>Email</dt><dd>{primary.lead_email&&!isInternalAccountEmail(primary.lead_email)?<a href={`mailto:${primary.lead_email}`}>{primary.lead_email}</a>:'Not provided'}</dd><dt>Phone</dt><dd>{primary.lead_phone||'Not provided'}</dd><dt>Course</dt><dd>{primary.lead_course||'Not provided'}</dd><dt>Study year</dt><dd>{primary.lead_year??'Not provided'}</dd></dl>}
      {primary?.lead_bio&&<p className="campus-lead-bio">{primary.lead_bio}</p>}
      <LeadApplicationRecords key={selected.id} campusId={selected.id}/><div className="campus-roster-trainees"><h3>Trainee profiles <span className="muted">({trainees.length})</span></h3><p className="muted small">2026 roster snapshot. A trainee record does not assign campus leadership or create an account.</p>
       <ul>{trainees.map(leader=><li key={leader.id}><button aria-label={`View profile: ${leader.full_name}`} aria-pressed={traineeId===leader.id} onClick={()=>setTraineeId(leader.id)}>{validPortrait(leader.portrait_data)?<img src={leader.portrait_data!} alt=""/>:<span className="campus-roster-avatar"><UserRound size={20}/></span>}<span><strong>{leader.full_name}</strong><small>{leader.course||'Course not provided'}</small></span><ArrowRight size={16}/></button></li>)}</ul>{!trainees.length&&<p className="muted">No trainee profiles in this campus roster.</p>}
      </div>
      {trainee&&<section className="campus-trainee-detail" aria-label="Trainee profile"><div className="campus-trainee-heading">{validPortrait(trainee.portrait_data)&&<img src={trainee.portrait_data!} alt={`${trainee.full_name} portrait`}/>}<div><h3>{trainee.full_name}</h3><p className="muted small">2026 roster snapshot</p></div></div><dl className="campus-lead-facts"><dt>Course</dt><dd>{trainee.course||'Not provided'}</dd><dt>Study year</dt><dd>{trainee.study_year_text||'Not provided'}</dd><dt>Grade</dt><dd>{trainee.grade_label||'Not provided'}</dd><dt>Training</dt><dd>{trainee.training_attendance||'Not provided'}</dd><dt>Account</dt><dd>{trainee.account_id?'Linked account':'No account linked'}</dd></dl><p className="muted small">Source: roster page {trainee.source_page}, row {trainee.source_row}. Grades are the recorded snapshot, not a new submission.</p></section>}
      <div className="campus-lead-meeting"><MapPin size={17}/><div><strong>Campus fellowship</strong><p>{selected.meeting_info||'Meeting details not added yet.'}</p>{selected.address&&<p>{selected.address}</p>}{!campusMapPoint(selected)&&<p className="muted">Location not set. This campus is available in the list.</p>}</div></div>
      <div className="campus-lead-actions"><button className="button button-yellow" disabled={selected.lifecycle_status!=='active'||!selected.is_active} onClick={()=>jump('campus',{campusId:selected.id})}>Campus statistics<ArrowRight size={16}/></button><button className="text-button" onClick={()=>jump('accounts')}>Manage lead assignment</button></div>
     </>:<><div className="eyebrow">ADMIN · CAMPUS PROFILE</div><h2>Select a campus</h2><p className="muted">Choose a map pin or use the list below. Campus statistics remain with the university when its lead changes.</p></>}
    </section>
    <section className="panel padded campus-network-directory"><div className="campus-network-directory-heading"><h2>Campus directory</h2><span className="muted">{visible.length} campuses</span></div><label className="campus-network-search"><Search size={17}/><input type="search" aria-label="Search campus or lead" placeholder="Search campus or trainee" value={query} onChange={event=>setQuery(event.target.value)}/></label><label className="campus-roster-filter">Campus status<select value={status} onChange={event=>{setStatus(event.target.value);setSelectedId(null);setTraineeId(null);}}><option value="all">All campuses</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="in_process">In process</option></select></label>
     <ul>{visible.map(campus=><li key={campus.id}><button aria-pressed={selectedId===campus.id} className={selectedId===campus.id?'selected':''} onClick={()=>choose(campus.id)}><span><strong>{campus.name}</strong><small>{statusLabel(campus.lifecycle_status)} · {roster.leaders.filter(lead=>lead.campus_id===campus.id).length} trainee profiles</small></span><span className="campus-network-location-status">{campusMapPoint(campus)?'View profile':'Location not set'}<ArrowRight size={15}/></span></button></li>)}</ul>
     {!visible.length&&<p className="muted">No campuses match your search.</p>}
    </section>
   </div>
  </div>}
 </>;
}
