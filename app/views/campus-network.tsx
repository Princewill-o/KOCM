'use client';
import {useEffect,useState} from 'react';
import {ArrowRight,MapPin,Search,UserRound,RefreshCw} from 'lucide-react';
import {UkCampusMap} from '@/components/ui/uk-campus-map';
import {campusMapPoint} from '@/lib/campus-map';
import {listCampusLeadProfiles,type CampusLeadProfile} from '@/lib/platform';
import {friendly} from '@/lib/koc';
import type {Jump} from '../dashboard';
import './campus-network.css';
export default function CampusNetwork({jump}:{jump:Jump}){
 const [campuses,setCampuses]=useState<CampusLeadProfile[]>([]),[selectedId,setSelectedId]=useState<string|null>(null),[query,setQuery]=useState(''),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 async function refresh(){setLoading(true);setError('');try{const rows=await listCampusLeadProfiles();setCampuses(rows);setSelectedId(previous=>rows.some(row=>row.campus_id===previous)?previous:null);}catch(e){setError(friendly(e));}finally{setLoading(false);}}
 useEffect(()=>{let alive=true;listCampusLeadProfiles().then(rows=>{if(alive)setCampuses(rows);}).catch(e=>{if(alive)setError(friendly(e));}).finally(()=>{if(alive)setLoading(false);});return()=>{alive=false;};},[]);
 const selected=campuses.find(campus=>campus.campus_id===selectedId);
 const visible=campuses.filter(campus=>`${campus.campus_name} ${campus.lead_name??''} ${campus.cluster_name??''}`.toLowerCase().includes(query.toLowerCase().trim()));
 return <>
  <div className="page-heading"><div><div className="eyebrow">CAMPUS LEADERSHIP</div><h1>Campus lead profiles</h1><p>Select a KOC to view its assigned lead, contact details and campus records.</p></div><button className="button" disabled={loading} onClick={refresh}><RefreshCw size={16}/>Refresh</button></div>
  {error&&<p className="management-alert" role="alert">{error}</p>}
  {loading?<p role="status">Loading campus leadership…</p>:!error&&<div className="campus-network-layout">
   <section className="campus-network-geography panel" aria-label="Campus network map">
    <UkCampusMap markers={campuses.map(campus=>({id:campus.campus_id,name:campus.campus_name,latitude:campus.latitude,longitude:campus.longitude,hasLead:!!campus.lead_id}))} selectedId={selectedId} onSelect={setSelectedId}/>
    <div className="campus-network-map-key"><span><i/>Assigned lead</span><span><i className="unassigned"/>Awaiting assignment</span></div>
    <p className="campus-network-source">Nearby pins are separated with lines to their university reference locations, not confirmed meeting venues. UK boundary: Natural Earth. Locations: © OpenStreetMap contributors.</p>
   </section>
   <div className="campus-network-details">
    <section className="panel padded campus-lead-card" aria-live="polite" aria-label="Selected campus lead profile">
     {selected?<><div className="eyebrow">ADMIN · CAMPUS LEAD PROFILE</div><h2>{selected.campus_name}</h2><p className="muted">{selected.cluster_name??selected.region} cluster</p>
      <div className="campus-lead-identity"><span aria-hidden="true"><UserRound size={25}/></span><div><h3>{selected.lead_name??'No campus lead assigned'}</h3><p className="muted">{selected.lead_id?'Active campus lead':'Assign an approved account in Accounts & access.'}</p></div></div>
      {selected.lead_id&&<dl className="campus-lead-facts"><dt>Email</dt><dd>{selected.lead_email?<a href={`mailto:${selected.lead_email}`}>{selected.lead_email}</a>:'Not provided'}</dd><dt>Phone</dt><dd>{selected.lead_phone||'Not provided'}</dd><dt>Course</dt><dd>{selected.lead_course||'Not provided'}</dd><dt>Study year</dt><dd>{selected.lead_year??'Not provided'}</dd></dl>}
      {selected.lead_bio&&<p className="campus-lead-bio">{selected.lead_bio}</p>}
      <div className="campus-lead-meeting"><MapPin size={17}/><div><strong>Campus fellowship</strong><p>{selected.meeting_info||'Meeting details not added yet.'}</p>{selected.address&&<p>{selected.address}</p>}{!campusMapPoint(selected)&&<p className="muted">Location not set. This campus is available in the list.</p>}</div></div>
      <div className="campus-lead-actions"><button className="button button-yellow" onClick={()=>jump('campus',{campusId:selected.campus_id})}>Campus statistics<ArrowRight size={16}/></button><button className="text-button" onClick={()=>jump('accounts')}>Manage lead assignment</button></div>
     </>:<><div className="eyebrow">ADMIN · CAMPUS LEAD PROFILE</div><h2>Select a campus</h2><p className="muted">Choose a map pin or use the list below. Campus statistics belong to the university and remain available when its lead changes.</p></>}
    </section>
    <section className="panel padded campus-network-directory"><div className="campus-network-directory-heading"><h2>Campus directory</h2><span className="muted">{visible.length} campuses</span></div><label className="campus-network-search"><Search size={17}/><input type="search" aria-label="Search campus or lead" placeholder="Search campus or lead" value={query} onChange={event=>setQuery(event.target.value)}/></label>
     <ul>{visible.map(campus=><li key={campus.campus_id}><button aria-pressed={selectedId===campus.campus_id} className={selectedId===campus.campus_id?'selected':''} onClick={()=>setSelectedId(campus.campus_id)}><span><strong>{campus.campus_name}</strong><small>{campus.lead_name??'Awaiting lead assignment'}</small></span><span className="campus-network-location-status">{campusMapPoint(campus)?'View profile':'Location not set'}<ArrowRight size={15}/></span></button></li>)}</ul>
     {!visible.length&&<p className="muted">No campuses match your search.</p>}
    </section>
   </div>
  </div>}
 </>;
}
