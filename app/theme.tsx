'use client';
import { useSyncExternalStore } from 'react';
import { ThemeProvider as Provider, useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
const subscribe = () => () => {};
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return <Provider attribute="class" defaultTheme="light" enableSystem>{children}</Provider>;
}
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const dark = mounted && resolvedTheme === 'dark';
  const label = mounted ? `Switch to ${dark ? 'light' : 'dark'} mode` : 'Change colour theme';
  return <button type="button" className="icon-button theme-toggle" aria-label={label} title={label} aria-pressed={mounted ? dark : undefined} disabled={!mounted} onClick={() => setTheme(dark ? 'light' : 'dark')}>
    {dark ? <Sun size={19} aria-hidden="true" /> : <Moon size={19} aria-hidden="true" />}
  </button>;
}
