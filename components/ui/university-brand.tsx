'use client';
import {useState} from 'react';
import {UsersRound} from 'lucide-react';
import brands from '@/lib/university-brands.json';
type UniversityIdentity={name:string;accent:string;logo:string|null;source:string|null;website:string|null;markBackground?:string;kind?:string};
export function universityBrand(name:string):UniversityIdentity|undefined{
 const key=Object.keys(brands).find(candidate=>candidate.toLowerCase()===name.toLowerCase());
 return key?(brands as Record<string,UniversityIdentity>)[key]:undefined;
}
export function UniversityBrand({campusName,compact=false}:{campusName:string;compact?:boolean}){
 const brand=universityBrand(campusName),[failedSource,setFailedSource]=useState<string|null>(null);
 const hasLogo=!!brand?.logo&&failedSource!==brand.logo;
 return <div className={`university-brand ${compact?'compact':''}`} style={{borderColor:brand?.accent??'var(--border)'}}>
  {hasLogo?<img style={{background:brand.markBackground??'#fff',width:compact?52:112,height:compact?40:56,objectFit:'contain',padding:6,borderRadius:4,flexShrink:0}} src={brand.logo!} alt={`${campusName} university mark`} onError={()=>setFailedSource(brand.logo)}/>:brand?.kind==='group'?<span className="university-brand-initials" aria-label="Colleges campus group"><UsersRound size={20}/></span>:<span className="university-brand-initials" aria-hidden="true">{campusName.split(' ').map(word=>word[0]).join('').slice(0,3)}</span>}
  {!compact&&<div><strong>{campusName}</strong><small>{brand?.kind==='group'?'KOC college fellowships':'Kharis On Campus'}</small></div>}
 </div>;
}
