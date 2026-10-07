'use client';
import type {ReactNode} from 'react';
import {motion,useReducedMotion} from 'motion/react';
import {cn} from '@/lib/utils';
export function TextHighlight({children,className,delay=0,duration=.6,color='var(--yellow)'}:{children:ReactNode;className?:string;delay?:number;duration?:number;color?:string}){
 const reduced=useReducedMotion();
 return <span className={cn('relative inline-block pb-1',className)}><motion.span aria-hidden="true" className="absolute bottom-0 left-0 right-0 h-[8px] rounded-sm" initial={false} whileInView={{scaleX:1}} style={{backgroundColor:color,transformOrigin:'left',scaleX:reduced?1:0}} viewport={{once:true,amount:.7}} transition={{duration:reduced?0:duration,delay:reduced?0:delay,ease:[.16,1,.3,1]}}/><span className="relative">{children}</span></span>;
}
export default TextHighlight;
