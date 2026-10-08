'use client';
import {useState} from 'react';
import brands from '@/lib/university-brands.json';
export function universityBrand(name:string){return (brands as Record<string,{name:string;accent:string;logo?:string|null;source?:string|null;website:string;markBackground?:string}>)[Object.keys(brands).find(k=>k.toLowerCase()===name.toLowerCase())??name];}
export function UniversityBrand({campusName,compact=false}:{campusName:string;compact?:boolean}){
 const brand=universityBrand(campusName),[failed,setFailed]=useState(false);
 return <div className={`university-brand ${compact?'compact':''}`} style={{borderColor:brand?.accent??'var(--border)'}}>{brand?.logo&&!failed?<img style={{background:brand.markBackground??"#fff"}} src={brand.logo} alt={`${campusName} university mark`} onError={()=>setFailed(true)} />:<span className="university-brand-initials" aria-hidden="true">{campusName.split(' ').map(w=>w[0]).join('').slice(0,3)}</span>}{!compact&&<div><strong>{campusName}</strong><small>Kharis On Campus</small></div>}</div>;
}
