import { createClient } from '@supabase/supabase-js';
import { createPageHandler, type PageAccess } from './handler.ts';
import { stampProtectedPng } from './watermark.ts';

const url = Deno.env.get('SUPABASE_URL');
const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!url || !anonKey || !serviceKey) throw new Error('Protected reader configuration is missing.');
const authOptions = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };
const service = createClient(url, serviceKey, { auth: authOptions });
// Construct a fresh user-scoped client for each request. Never persist an incoming
// session in a shared client and never use the service credential for the RPC.
const userClient = (token: string) => createClient(url, anonKey, {
  auth: authOptions, global: { headers: { Authorization: `Bearer ${token}` } },
});
Deno.serve(createPageHandler({
  authenticate: async token => {
    const { data, error } = await userClient(token).auth.getUser(token);
    return !error && Boolean(data.user);
  },
  access: async (token, materialId, page, sessionId) => {
    const { data, error } = await userClient(token).rpc('protected_material_page_access', {
      p_material_id: materialId, p_page_number: page, p_session_id: sessionId,
    });
    if (error) throw error;
    if (!Array.isArray(data) || data.length !== 1) throw new Error('Invalid protected page manifest.');
    return data[0] as PageAccess;
  },
  download: async path => {
    const { data, error } = await service.storage.from('koc-material-pages').download(path);
    if (error || !data) throw error ?? new Error('Protected page unavailable.');
    if (data.size > 8 * 1024 * 1024) throw new Error('Protected page exceeds the delivery limit.');
    return new Uint8Array(await data.arrayBuffer());
  },
  stamp: stampProtectedPng,
}));
