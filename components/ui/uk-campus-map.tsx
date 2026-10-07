'use client';
import {useId} from 'react';
import {UK_OUTLINE} from '@/lib/uk-outline';
import {campusMapPoint} from '@/lib/campus-map';
export type CampusMarker={id:string;name:string;latitude:number|null;longitude:number|null;hasLead:boolean};
export function UkCampusMap({markers,selectedId,onSelect}:{markers:CampusMarker[];selectedId:string|null;onSelect:(id:string)=>void}){
 const unique=useId().replaceAll(':','');
 const placed:{x:number;y:number}[]=[];
 const positioned=markers.flatMap(marker=>{const origin=campusMapPoint(marker);if(!origin)return [];let point=origin;
  for(let step=0;placed.some(other=>Math.hypot(other.x-point.x,other.y-point.y)<34)&&step<160;step++){const angle=step*2.399963,radius=12+step*.8;point={x:origin.x+Math.cos(angle)*radius,y:origin.y+Math.sin(angle)*radius};}
  placed.push(point);return [{marker,point,origin}];
 });
 return <svg viewBox="0 0 480 730" className="campus-network-map" role="group" aria-label="UK campus locations">
  <defs><pattern id={`dots-${unique}`} width="8" height="8" patternUnits="userSpaceOnUse"><circle cx="4" cy="4" r="1.55" fill="currentColor"/></pattern></defs>
  <g transform="translate(30 125)" className="campus-network-land" aria-hidden="true"><path d={UK_OUTLINE} fill={`url(#dots-${unique})`}/><path d={UK_OUTLINE} fill="none" stroke="currentColor" strokeWidth=".7" opacity=".4"/></g>
  {positioned.map(({marker,point,origin})=>{const active=marker.id===selectedId;
   return <g key={marker.id} role="button" tabIndex={0} aria-label={`Open campus lead profile: ${marker.name}`} aria-pressed={active} className={`campus-network-pin${active?' selected':''}${marker.hasLead?'':' unassigned'}`} onClick={()=>onSelect(marker.id)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onSelect(marker.id);}}}>
    {Math.hypot(origin.x-point.x,origin.y-point.y)>1&&<line x1={origin.x} y1={origin.y} x2={point.x} y2={point.y} stroke="currentColor" opacity=".45" strokeWidth="1" pointerEvents="none"/>}
    <circle cx={point.x} cy={point.y} r="15" className="campus-network-hit"/><circle cx={point.x} cy={point.y} r={active?8:5.5} className="campus-network-marker"/>
    {active && <circle cx={point.x} cy={point.y} r="14" className="campus-network-ring"/>}<title>{marker.name}{marker.hasLead?'':' — no active campus lead'}</title>
   </g>;
  })}
  <text x="24" y="46" className="campus-network-map-title" aria-hidden="true">UNITED KINGDOM</text>
  <text x="24" y="69" className="campus-network-map-caption" aria-hidden="true">Kharis On Campus</text>
 </svg>;
}
