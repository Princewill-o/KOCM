'use client';
import type {ReactNode} from 'react';
import {motion,useReducedMotion} from 'motion/react';
export function LandingReveal({children,className}:{children:ReactNode;className?:string}){
 const reduced=useReducedMotion();
 return <motion.div className={className} initial={false} whileInView={reduced?{}:{y:[14,0],opacity:[.75,1]}} viewport={{once:true,amount:.2}} transition={{duration:.7,ease:[.16,1,.3,1]}}>{children}</motion.div>;
}
