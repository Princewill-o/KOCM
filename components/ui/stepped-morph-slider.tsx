'use client';
import {useId,useState,useRef} from 'react';
import {motion,useReducedMotion} from 'motion/react';
import {ChevronLeft,ChevronRight} from 'lucide-react';
export type SteppedSlide={image:string;title:string;caption:string};
// Adapted from the supplied stepped slider. Shallow edge masks preserve faces;
// navigation is manual so no photo moves away before the visitor can read it.
function mask(index:number){
 const count=7,width=1000,height=750,top:number[]=[],bottom:number[]=[];
 for(let i=0;i<count;i++){top.push(((i*13+index*17)%4)*9);bottom.push(height-((i*7+index*11)%4)*9);}
 let path=`M0 ${top[0]}`;
 for(let i=0;i<count;i++){path+=` H${(i+1)*width/count}`;if(i<count-1)path+=` V${top[i+1]}`;}
 path+=` V${bottom[count-1]}`;
 for(let i=count-1;i>=0;i--){path+=` H${i*width/count}`;if(i>0)path+=` V${bottom[i-1]}`;}
 return path+' Z';
}
export default function SteppedMorphSlider({slides,className=''}:{slides:SteppedSlide[];className?:string}){
 const [index,setIndex]=useState(0),reduced=useReducedMotion(),uid=useId().replace(/[^a-z0-9]/gi,''),start=useRef<number|null>(null);
 const current=slides[index];
 const go=(next:number)=>setIndex((next+slides.length)%slides.length);
 if(!current)return null;
 return <div className={`sm-root ${className}`} role="region" aria-label="KOC community photos" aria-roledescription="carousel" onKeyDown={event=>{if(event.key==='ArrowRight'){event.preventDefault();go(index+1);}if(event.key==='ArrowLeft'){event.preventDefault();go(index-1);}}}>
  <svg viewBox="0 0 1000 750" className="sm-svg" role="img" aria-label={`${current.title}: ${current.caption}`} onPointerDown={event=>{start.current=event.clientX;}} onPointerUp={event=>{if(start.current!==null&&Math.abs(event.clientX-start.current)>45)go(index+(event.clientX<start.current?1:-1));start.current=null;}} onPointerCancel={()=>{start.current=null;}}>
   <defs><clipPath id={`photo-${uid}`}><motion.path d={mask(index)} animate={{d:mask(index)}} transition={{duration:reduced?0:.65,ease:[.16,1,.3,1]}}/></clipPath></defs>
   <g clipPath={`url(#photo-${uid})`}>{slides.map((slide,i)=><motion.image key={slide.image} href={slide.image} x="0" y="0" width="1000" height="750" preserveAspectRatio="xMidYMid meet" initial={false} animate={{opacity:i===index?1:0}} transition={{duration:reduced?0:.55}}/>)}</g>
  </svg>
  <div className="sm-timeline" aria-label="Choose a community photo">{slides.map((slide,i)=><button type="button" key={slide.image} aria-label={`Show ${slide.title}`} aria-pressed={index===i} onClick={()=>go(i)}><span/></button>)}</div>
  <div className="sm-bar"><span className="sm-count">{String(index+1).padStart(2,'0')} <small>/ {String(slides.length).padStart(2,'0')}</small></span><div className="sm-copy" aria-live="polite"><strong>{current.title}</strong><p>{current.caption}</p></div><div className="sm-nav"><button type="button" aria-label="Previous photo" onClick={()=>go(index-1)}><ChevronLeft size={17}/></button><button type="button" aria-label="Next photo" onClick={()=>go(index+1)}><ChevronRight size={17}/></button></div></div>
 </div>;
}
