'use client';
import {useId,useState} from 'react';
import {UK_OUTLINE} from '@/lib/uk-outline';
import {campusMapPoint,mapViewport,type MapPoint} from '@/lib/campus-map';
export type CampusMarker={id:string;name:string;latitude:number|null;longitude:number|null;hasLead:boolean};
export function UkCampusMap({markers,selectedId,onSelect}:{markers:CampusMarker[];selectedId:string|null;onSelect:(id:string)=>void}){
 const unique=useId().replaceAll(':','');const [zoom,setZoom]=useState(1);const [center,setCenter]=useState<MapPoint>({x:240,y:365});
 const positioned=markers.flatMap(marker=>{const point=campusMapPoint(marker);return point?[{marker,point}]:[];});
 const viewport=mapViewport(zoom,center);
 const selected=positioned.find(p=>p.marker.id===selectedId);
 function changeZoom(next:number){if(selected)setCenter(selected.point);setZoom(Math.max(1,Math.min(16,next)));}
 return <div>
 <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:12}} aria-label="Map zoom controls">
 <button type="button" className="button" onClick={()=>{setZoom(1);setCenter({x:240,y:365});}}>Whole UK</button>
 <button type="button" className="button" onClick={()=>{setZoom(12);setCenter(campusMapPoint({latitude:51.51,longitude:-.16})!);}}>London</button>
 <button type="button" className="button" aria-label="Zoom in on selected campus" disabled={zoom>=16} onClick={()=>changeZoom(zoom*2)}>+</button>
 <button type="button" className="button" aria-label="Zoom out" disabled={zoom<=1} onClick={()=>changeZoom(zoom/2)}>−</button>
 {selected&&<button type="button" className="button" onClick={()=>{setCenter(selected.point);setZoom(16);}}>Zoom to selected campus</button>}
 </div>
 <svg viewBox={`${viewport.x} ${viewport.y} ${viewport.width} ${viewport.height}`} className="campus-network-map" role="group" aria-label="UK campus locations">
 <defs><pattern id={`dots-${unique}`} width={8/zoom} height={8/zoom} patternUnits="userSpaceOnUse"><circle cx={4/zoom} cy={4/zoom} r={1.55/zoom} fill="currentColor"/></pattern></defs>
 <g className="campus-network-land" aria-hidden="true"><path d={UK_OUTLINE} fill={`url(#dots-${unique})`}/><path d={UK_OUTLINE} fill="none" stroke="currentColor" strokeWidth={.7/zoom} opacity=".4"/></g>
 {positioned.map(({marker,point})=>{const active=marker.id===selectedId;
 return <g key={marker.id} role="button" tabIndex={0} aria-label={`Open campus lead profile: ${marker.name}`} aria-pressed={active} className={`campus-network-pin${active?' selected':''}${marker.hasLead?'':' unassigned'}`} onClick={()=>onSelect(marker.id)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onSelect(marker.id);}}}>
 <circle cx={point.x} cy={point.y} r={8/zoom} className="campus-network-hit"/><circle cx={point.x} cy={point.y} r={(active?5:3)/zoom} className="campus-network-marker" vectorEffect="non-scaling-stroke"/>
 {active&&<circle cx={point.x} cy={point.y} r={9/zoom} className="campus-network-ring" vectorEffect="non-scaling-stroke"/>}<title>{marker.name}{marker.hasLead?'':' — no active campus lead'}</title>
 </g>;})}
 </svg>
 <p className="small muted">Pins show university reference locations, not confirmed fellowship venues. Use London zoom or select a university in the directory to inspect nearby campuses. Pins stay at their geographic coordinates.</p>
 </div>;
}
