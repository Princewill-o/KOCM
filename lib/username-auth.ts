'use client';
import { supabase } from './supabase';

export const USERNAME_PATTERN = /^[a-z0-9_]{3,30}$/;
export const USERNAME_HELP = 'Use 3–30 lowercase letters, numbers or underscores.';
export function normaliseUsername(value: string): string {
  const username = value.trim().toLowerCase();
  if (!USERNAME_PATTERN.test(username)) throw new Error(USERNAME_HELP);
  return username;
}

export async function signInWithIdentifier(identifier: string, password: string): Promise<void> {
  const message = 'Unable to sign in. Check your username or email and password.';
  try {
    const { data, error } = await supabase().functions.invoke('username-auth', {
      body: { action: 'signin', identifier: identifier.trim().toLowerCase(), password },
    });
    if (error || typeof data?.access_token !== 'string' || !data.access_token || typeof data?.refresh_token !== 'string' || !data.refresh_token) throw new Error(message);
    const session = await supabase().auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token });
    if (session.error) throw new Error(message);
  } catch { throw new Error(message); }
}

export async function signUpWithUsername(input: {username: string; fullName: string; password: string; campusId: string}): Promise<void> {
  const username = normaliseUsername(input.username);
  try {
    const { data, error } = await supabase().functions.invoke('username-auth', { body: { action: 'signup', ...input, username } });
    if (error || data?.ok !== true) throw new Error('Signup failed');
  } catch { throw new Error('Unable to create your account. Check your details and try again.'); }
}

export async function updateMyUsername(value: string): Promise<void> {
  const username = normaliseUsername(value);
  const { error } = await supabase().rpc('update_my_username', { p_username: username });
  if (error) throw new Error('Unable to save this username. It may already be in use.');
}

export function isInternalAccountEmail(email: string): boolean {
  return email.toLowerCase().endsWith('@accounts.kocm.invalid') || email.toLowerCase().endsWith('@koc.example');
}

export async function attachNotificationEmail(email: string, currentPassword: string): Promise<void> {
  if (!currentPassword) throw new Error('Enter your current password to verify this change.');
  const {data,error}=await supabase().functions.invoke('username-auth',{body:{action:'attach_email',email:email.trim().toLowerCase(),currentPassword}});
  if(error){
    let message='Unable to send an email confirmation. Check your current password and try again.';
    try{const response=error.context;if(response instanceof Response){const payload:unknown=await response.json();const serverMessage=payload&&typeof payload==='object'&&'error' in payload?payload.error:null;if(serverMessage==='Email confirmation delivery is not configured. Your account email has not been changed.')message='Email verification sender is not configured yet. Your account email has not been changed.';else if(serverMessage==='Your current password could not be verified.')message='Your current password could not be verified.';}}catch{/* Keep the safe default. */}
    throw new Error(message);
  }
  if(data?.ok!==true||data?.confirmationRequired!==true)throw new Error('Unable to send an email confirmation. Your account email has not been changed.');
}
