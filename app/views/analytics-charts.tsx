'use client';
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import type { WeeklyTotal } from '@/lib/koc';
import { shortDate } from '@/lib/reporting';
import type { completionRows } from '@/lib/analytics';

const tooltip = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--foreground)' };
export function ActivityChart({ weekly, metric, label }: { weekly: WeeklyTotal[]; metric: 'attendance' | 'prayer_minutes' | 'evangelism_minutes' | 'outreach_outings'; label: string }) {
  return <div className="analytics-chart" aria-label={`${label} by week`}>
    <ResponsiveContainer width="100%" height="100%"><AreaChart data={weekly} margin={{ top: 15, right: 20, left: 0, bottom: 8 }}>
      <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" vertical={false} />
      <XAxis dataKey="week_ending" tickFormatter={shortDate} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} axisLine={false} tickLine={false} />
      <YAxis allowDecimals={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} axisLine={false} tickLine={false} />
      <Tooltip contentStyle={tooltip} labelFormatter={v => shortDate(String(v))} />
      <Area type="linear" dataKey={metric} name={label} stroke="#b29400" fill="#f9d62b" fillOpacity={0.22} strokeWidth={3} dot={{ r: 5, fill: '#f9d62b' }} isAnimationActive={false} />
    </AreaChart></ResponsiveContainer>
  </div>;
}

export function CompletionChart({ rows }: { rows: ReturnType<typeof completionRows> }) {
  return <div className="analytics-chart" aria-label="Weekly completed, overdue and pending reports">
    <ResponsiveContainer width="100%" height="100%"><BarChart data={rows} margin={{ top: 15, right: 16, left: 0, bottom: 8 }}>
      <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" vertical={false} />
      <XAxis dataKey="week" tickFormatter={shortDate} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} axisLine={false} tickLine={false} />
      <YAxis allowDecimals={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} axisLine={false} tickLine={false} />
      <Tooltip contentStyle={tooltip} labelFormatter={v => shortDate(String(v))} /><Legend wrapperStyle={{ fontSize: 12 }} />
      <Bar dataKey="completed" name="Completed" stackId="reports" fill="#d6b800" maxBarSize={48} isAnimationActive={false} />
      <Bar dataKey="overdue" name="Overdue" stackId="reports" fill="#c26a52" maxBarSize={48} isAnimationActive={false} />
      <Bar dataKey="pending" name="Pending" stackId="reports" fill="#8c96a6" maxBarSize={48} isAnimationActive={false} />
    </BarChart></ResponsiveContainer>
  </div>;
}
