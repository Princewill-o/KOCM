export type PageAccess = { session_id: string; object_path: string; watermark_identity: string; page_count: number };
export type PageDependencies = {
  authenticate: (token: string) => Promise<boolean>;
  access: (token: string, materialId: string, page: number, sessionId: string | null) => Promise<PageAccess>;
  download: (path: string) => Promise<Uint8Array>;
  stamp: (bytes: Uint8Array, identity: string, trace: string) => Uint8Array;
};
const origins = new Set(['https://kocm.vercel.app', 'https://koccm.vercel.app', 'http://localhost:5173', 'http://127.0.0.1:5173']);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function createPageHandler(deps: PageDependencies) {
  return async (req: Request): Promise<Response> => {
    const origin = req.headers.get('Origin');
    const headers: Record<string, string> = {
      'Cache-Control': 'private, no-store, no-cache, max-age=0, must-revalidate',
      'CDN-Cache-Control': 'no-store', 'Pragma': 'no-cache', 'Expires': '0',
      'Vary': 'Origin, Authorization', 'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex, noarchive',
      'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Expose-Headers': 'X-Reader-Session, X-Page-Count',
    };
    if (origin && origins.has(origin)) headers['Access-Control-Allow-Origin'] = origin;
    const error = (status: number, message: string) => new Response(JSON.stringify({error:message}), {status,headers:{...headers,'Content-Type':'application/json'}});
    if (origin && !origins.has(origin)) return error(403, 'This website is not authorised to open materials.');
    if (req.method === 'OPTIONS') return new Response(null, {status:204,headers});
    if (req.method !== 'POST') return error(405, 'Use the protected reader to open a page.');
    const bearer = /^Bearer\s+([^\s]+)$/i.exec(req.headers.get('Authorization') ?? '');
    if (!bearer) return error(401, 'Please log in to read materials.');
    try {
      if (!await deps.authenticate(bearer[1])) return error(401, 'Please log in again to read materials.');
      const reader = req.body?.getReader();
      if (!reader) return error(400, 'Choose a material and page.');
      let body = '', size = 0;
      const decoder = new TextDecoder();
      while (true) {
        const chunk = await reader.read(); if (chunk.done) break;
        size += chunk.value.length;
        if (size > 2048) { await reader.cancel(); return error(413,'The page request is too large.'); }
        body += decoder.decode(chunk.value, {stream:true});
      }
      body += decoder.decode();
      let input: {materialId?: unknown; page?: unknown; sessionId?: unknown};
      try { input = JSON.parse(body); } catch { return error(400,'Choose a valid material and page.'); }
      if (!input || typeof input !== 'object' || typeof input.materialId !== 'string' || !uuid.test(input.materialId) || !Number.isInteger(input.page) || Number(input.page)<1 || Number(input.page)>100 || (input.sessionId!=null && (typeof input.sessionId!=='string' || !uuid.test(input.sessionId)))) return error(400,'Choose a valid material and page.');
      // The caller's verified JWT scopes this RPC. Never accept a caller's storage path or watermark.
      const access = await deps.access(bearer[1], input.materialId, Number(input.page), typeof input.sessionId === 'string' ? input.sessionId : null);
      if (!access || !uuid.test(access.session_id) || !access.object_path || !access.watermark_identity || !Number.isInteger(access.page_count) || access.page_count < 1 || access.page_count > 100 || Number(input.page) > access.page_count) throw new Error('Invalid authorized page manifest');
      const bytes = await deps.download(access.object_path);
      const trace = `KOC ${access.session_id} | PAGE ${input.page} | ${new Date().toISOString()}`;
      const protectedImage = deps.stamp(bytes, access.watermark_identity, trace);
      return new Response(Uint8Array.from(protectedImage).buffer, {status:200,headers:{...headers,'Content-Type':'image/png','Content-Disposition':'inline','X-Reader-Session':access.session_id,'X-Page-Count':String(access.page_count)}});
    } catch (cause) {
      const code = (cause as {code?: string})?.code;
      if (code === '42501' || code === '28000') return error(403,'Access denied or reading session expired. Close and reopen the material.');
      if (code === 'P0001') return error(429,'Too many reading requests. Please wait a minute and try again.');
      if (code === '22023') return error(400,'This protected page is not available.');
      return error(503,'The protected page could not be opened. Please try again.');
    }
  };
}
