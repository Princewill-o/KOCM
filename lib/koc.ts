'use client';
import { supabase } from './supabase';
import type { Season } from './reporting';

export type Role = 'admin' | 'editor' | 'campus';
export type Status = 'pending' | 'active' | 'rejected';
export type Profile = {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  status: Status;
  campus_id: string | null;
  created_at: string;
  campus?: { name: string } | null;
};
export type Campus = { id: string; name: string; region: string };
export type Report = {
  id: string;
  campus_id: string;
  season_id: string;
  week_ending: string;
  attendance: number;
  prayer_minutes: number;
  evangelism_minutes: number;
  outreach_outings: number;
  notes: string;
  submitted_at: string;
  updated_at: string;
  is_late: boolean;
};
export type CampusSummary = {
  campus_id: string;
  campus_name: string;
  region: string;
  reports: number;
  late_reports: number;
  attendance: number;
  prayer_minutes: number;
  evangelism_minutes: number;
  outreach_outings: number;
  last_week: string | null;
};
export type WeeklyTotal = {
  week_ending: string;
  campuses_reported: number;
  attendance: number;
  prayer_minutes: number;
  evangelism_minutes: number;
  outreach_outings: number;
};
export type ReportInput = {
  weekEnding: string;
  attendance: number;
  prayerMinutes: number;
  evangelismMinutes: number;
  outreachOutings: number;
  notes: string;
  campusId?: string | null;
};

export const ROLE_LABELS: Record<Role, string> = { admin: 'Administrator', editor: 'Stats editor', campus: 'Campus rep' };
export const canSeeAllCampuses = (p: Profile | null) => !!p && p.status === 'active' && (p.role === 'admin' || p.role === 'editor');

/** Turn Supabase/Postgres errors into short, human messages. */
export function friendly(error: unknown): string {
  const e = error as { message?: string; code?: string; status?: number } | null;
  const message = e?.message ?? '';
  if (/invalid login credentials/i.test(message)) return 'Email or password is incorrect.';
  if (/email not confirmed/i.test(message)) return 'Please confirm your email address first — check your inbox for the link.';
  if (/user already registered/i.test(message)) return 'An account with this email already exists. Try logging in.';
  if (/rate limit|too many/i.test(message)) return 'Too many attempts. Please wait a few minutes and try again.';
  if (/password should be|weak password/i.test(message)) return 'Choose a stronger password (at least 12 characters, mixing letters and numbers).';
  if (/new password should be different/i.test(message)) return 'Your new password must be different from the current one.';
  if (/database error saving new user/i.test(message)) return 'Select an active university and try again.';
  if (/failed to fetch|networkerror|load failed/i.test(message)) return 'Could not reach the server. Check your connection and try again.';
  if (e?.code === '42501' && !/^[A-Z]/.test(message)) return 'You do not have permission to do that.';
  if (message && message.length < 160 && !/[{}]|violates|relation|column|syntax/i.test(message)) return message;
  return 'Something went wrong. Please try again.';
}

function check<D>(result: { data: D; error: null } | { data: unknown; error: unknown }): D {
  if (result.error) throw new Error(friendly(result.error));
  return result.data as D;
}

// ── Auth ───────────────────────────────────────────────────────────────────
export async function signIn(email: string, password: string) {
  check(await supabase().auth.signInWithPassword({ email: email.trim().toLowerCase(), password }));
}

export async function signUp(input: { fullName: string; email: string; password: string; campusId: string }) {
  const data = check(
    await supabase().auth.signUp({
      email: input.email.trim().toLowerCase(),
      password: input.password,
      options: {
        data: { full_name: input.fullName.trim(), campus_id: input.campusId },
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    }),
  );
  return { needsConfirmation: !data.session };
}

export async function signOut() {
  await supabase().auth.signOut();
}

export async function requestPasswordReset(email: string) {
  check(
    await supabase().auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/update-password`,
    }),
  );
}

export async function setNewPassword(password: string) {
  check(await supabase().auth.updateUser({ password }));
}

/** Re-checks the current password before changing it. */
export async function changePassword(email: string, currentPassword: string, newPassword: string) {
  const verify = await supabase().auth.signInWithPassword({ email, password: currentPassword });
  if (verify.error) throw new Error('Your current password is incorrect.');
  check(await supabase().auth.updateUser({ password: newPassword }));
}

export async function changeOwnEmail(email: string) {
  const data = check(
    await supabase().auth.updateUser({ email: email.trim().toLowerCase() }, { emailRedirectTo: `${window.location.origin}/dashboard` }),
  );
  return data.user;
}

export async function updateOwnName(id: string, fullName: string) {
  const name = fullName.trim();
  if (name.length < 2 || name.length > 100) throw new Error('Enter a name between 2 and 100 characters.');
  check(await supabase().from('profiles').update({ full_name: name }).eq('id', id).select('id').single());
  await supabase().auth.updateUser({ data: { full_name: name } });
}

// ── Data ───────────────────────────────────────────────────────────────────
export async function currentProfile(): Promise<Profile | null> {
  const { data: auth } = await supabase().auth.getUser();
  if (!auth.user) return null;
  const profile = check(
    await supabase().from('profiles').select('*, campus:campuses(name)').eq('id', auth.user.id).maybeSingle(),
  ) as Profile | null;
  return profile;
}

export async function currentSeason(): Promise<Season> {
  const season = check(await supabase().from('seasons').select('*').eq('is_current', true).maybeSingle()) as Season | null;
  if (!season) throw new Error('No reporting season has been set up yet.');
  return season;
}

export async function listCampuses(): Promise<Campus[]> {
  return check(await supabase().from('campuses').select('id, name, region').eq('is_active', true).order('name')) as Campus[];
}

export async function listReports(campusId: string, seasonId: string): Promise<Report[]> {
  return check(
    await supabase().from('reports').select('*').eq('campus_id', campusId).eq('season_id', seasonId).order('week_ending'),
  ) as Report[];
}

export async function campusSummary(seasonId: string): Promise<CampusSummary[]> {
  const rows = check(await supabase().rpc('season_campus_summary', { p_season_id: seasonId })) as CampusSummary[];
  return rows.map((r) => ({
    ...r,
    reports: Number(r.reports), late_reports: Number(r.late_reports), attendance: Number(r.attendance),
    prayer_minutes: Number(r.prayer_minutes), evangelism_minutes: Number(r.evangelism_minutes), outreach_outings: Number(r.outreach_outings),
  }));
}

export async function weeklyTotals(seasonId: string): Promise<WeeklyTotal[]> {
  const rows = check(await supabase().rpc('season_weekly_totals', { p_season_id: seasonId })) as WeeklyTotal[];
  return rows.map((r) => ({
    ...r,
    campuses_reported: Number(r.campuses_reported), attendance: Number(r.attendance), prayer_minutes: Number(r.prayer_minutes),
    evangelism_minutes: Number(r.evangelism_minutes), outreach_outings: Number(r.outreach_outings),
  }));
}

export async function submitReport(input: ReportInput): Promise<Report> {
  return check(
    await supabase().rpc('submit_report', {
      p_week_ending: input.weekEnding,
      p_attendance: input.attendance,
      p_prayer_minutes: input.prayerMinutes,
      p_evangelism_minutes: input.evangelismMinutes,
      p_outreach_outings: input.outreachOutings,
      p_notes: input.notes ?? '',
      p_campus_id: input.campusId ?? null,
    }),
  ) as Report;
}

export async function deleteReport(id: string) {
  check(await supabase().rpc('delete_report', { p_report_id: id }));
}

// ── Admin ──────────────────────────────────────────────────────────────────
export async function listProfiles(): Promise<Profile[]> {
  return check(await supabase().from('profiles').select('*, campus:campuses(name)').order('created_at')) as Profile[];
}

export async function adminUpdateUser(id: string, changes: { role?: Role; status?: Status; campusId?: string | null; fullName?: string }) {
  return check(
    await supabase().rpc('admin_update_user', {
      p_user_id: id,
      p_role: changes.role ?? null,
      p_status: changes.status ?? null,
      p_campus_id: changes.campusId ?? null,
      p_full_name: changes.fullName ?? null,
    }),
  ) as Profile;
}

export async function adminSetEmail(id: string, email: string) {
  return check(await supabase().rpc('admin_set_user_email', { p_user_id: id, p_email: email })) as Profile;
}
