import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import { createAccountEmailHandler, type AccountEmail } from './handler.ts';

const url = Deno.env.get('SUPABASE_URL');
const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!url || !anonKey || !serviceKey) throw new Error('Account email service configuration is missing.');
const options = {persistSession:false, autoRefreshToken:false, detectSessionInUrl:false};
const service = createClient(url,serviceKey,{auth:options});
const smtpHost = Deno.env.get('SMTP_HOST');
const smtpPort = Number(Deno.env.get('SMTP_PORT'));
const smtpUser = Deno.env.get('SMTP_USER');
const smtpPassword = Deno.env.get('SMTP_PASSWORD');
const smtpFrom = Deno.env.get('SMTP_FROM');
// Supabase blocks outgoing SMTP ports 25 and 587. Use implicit TLS on 465.
const configured = Boolean(smtpHost && smtpPort === 465 && smtpUser && smtpPassword && smtpFrom && !/[\r\n]/.test(smtpFrom));
const transport = configured ? nodemailer.createTransport({
  host:smtpHost, port:smtpPort, secure:true, requireTLS:true,
  auth:{user:smtpUser!,pass:smtpPassword!},
  connectionTimeout:5000, greetingTimeout:5000, socketTimeout:10000,
  tls:{minVersion:'TLSv1.2',rejectUnauthorized:true},
  disableFileAccess:true, disableUrlAccess:true,
}) : null;
Deno.serve(createAccountEmailHandler({
  authenticate: async token => {
    const client = createClient(url,anonKey,{auth:options,global:{headers:{Authorization:`Bearer ${token}`}}});
    const {data,error} = await client.auth.getUser(token);
    if (error || !data.user) return 'unauthorized';
    // Read current database authority; never use user-editable metadata or stale role claims.
    const profile = await service.from('profiles').select('role,status').eq('id',data.user.id).maybeSingle();
    if (profile.error) throw profile.error;
    return profile.data?.role === 'admin' && profile.data.status === 'active' ? 'admin' : 'forbidden';
  },
  authenticateWorker:async token => {
    const {data,error} = await service.rpc('verify_account_email_worker',{p_token:token});
    if (error) throw error;
    return data === true;
  },
  configured:()=>configured,
  claim:async () => {
    const {data,error} = await service.rpc('claim_account_emails');
    if (error) throw error;
    if (!Array.isArray(data)) throw new Error('Invalid account email queue response.');
    return data as AccountEmail[];
  },
  send:async message => {
    if (!transport || !smtpFrom) throw new Error('SMTP unavailable.');
    const result = await transport.sendMail({...message,from:smtpFrom,envelope:{from:smtpFrom,to:[message.to]}});
    if (!Array.isArray(result.accepted) || result.accepted.length !== 1 || (result.rejected?.length ?? 0)>0) throw new Error('SMTP recipient was not accepted.');
  },
  complete:async (id,sent,error) => {
    const result = await service.rpc('complete_account_email',{p_id:id,p_sent:sent,p_error:error});
    if (result.error) throw result.error;
  },
}));
