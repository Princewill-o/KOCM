'use client';
import * as React from 'react';
import {Slot} from '@radix-ui/react-slot';
import {cn} from '@/lib/utils';
import {cva,type VariantProps} from 'class-variance-authority';

export const liquidbuttonVariants=cva('liquid-button',{variants:{variant:{default:'',gold:'liquid-button-gold'},size:{default:'',sm:'liquid-button-sm'}},defaultVariants:{variant:'default',size:'default'}});
export function LiquidButton({className,variant,size,asChild=false,...props}:React.ComponentProps<'button'>&VariantProps<typeof liquidbuttonVariants>&{asChild?:boolean}){
 // Slot keeps a single semantic anchor for navigation; no nested buttons or links.
 const Comp=asChild?Slot:'button';
 return <Comp className={cn(liquidbuttonVariants({variant,size}),className)} {...props}/>;
}
