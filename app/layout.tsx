import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from './theme';
export const metadata: Metadata = { title: 'Kharis On Campus Management', description: 'Attendance, prayer and evangelism across Kharis On Campus.', icons: { icon: '/koc-yellow-logo.png' } };
export default function RootLayout({children}: {children: React.ReactNode}) {return <html lang="en" suppressHydrationWarning><body><ThemeProvider>{children}</ThemeProvider></body></html>}
