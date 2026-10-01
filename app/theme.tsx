'use client';
import { ThemeProvider as Provider, useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
export function ThemeProvider({children}:{children:React.ReactNode}) {return <Provider attribute="class" defaultTheme="light" enableSystem>{children}</Provider>}
export function ThemeToggle(){const {resolvedTheme,setTheme}=useTheme();return <button className="icon-button theme-toggle" aria-label="Toggle light and dark mode" onClick={()=>setTheme(resolvedTheme==='dark'?'light':'dark')}><Sun className="sun" size={19}/><Moon className="moon" size={19}/></button>}
