import { renderAccountEmail } from './templates.ts';
export type AccountEmail = {
  id: string; user_id: string; recipient: string; full_name: string;
  reason: string | null; attempts: number; status: string; kind?: string; payload?: unknown;
};
export type AccountEmailDependencies = {
  authenticate: (token: string) => Promise<'admin' | 'unauthorized' | 'forbidden'>;
  authenticateWorker: (token: string) => Promise<boolean>;
  configured: () => boolean;
  claim: (limit: number) => Promise<AccountEmail[]>;
  send: (message: {to: string; subject: string; text: string; html: string}) => Promise<void>;
  complete: (id: string, sent: boolean, error: string | null) => Promise<void>;
};
const origins = new Set(['https://kocm.vercel.app', 'https://koccm.vercel.app', 'http://localhost:5173', 'http://127.0.0.1:5173']);
const safeError = 'Email delivery failed. Check the SMTP settings and retry later.';
const recipientPattern = /^[^\s<>@,;\r\n]+@[^\s<>@,;\r\n]+\.[^\s<>@,;\r\n]+$/;
export function createAccountEmailHandler(deps: AccountEmailDependencies) {
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get('Origin');
    const headers: Record<string,string> = {
      'Content-Type':'application/json', 'Cache-Control':'private, no-store',
      'Vary':'Origin, Authorization', 'X-Content-Type-Options':'nosniff',
      'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info',
      'Access-Control-Allow-Methods':'POST, OPTIONS',
    };
    if (origin && origins.has(origin)) headers['Access-Control-Allow-Origin'] = origin;
    const json = (status: number, value: unknown) => new Response(JSON.stringify(value), {status,headers});
    if (origin && !origins.has(origin)) return json(403,{error:'This website is not authorised to send account emails.'});
    if (request.method === 'OPTIONS') return new Response(null,{status:204,headers});
    if (request.method !== 'POST') return json(405,{error:'Use POST to send queued account emails.'});
    const token = /^Bearer\s+([^\s]+)$/i.exec(request.headers.get('Authorization') ?? '')?.[1];
    const workerToken = request.headers.get('X-KOC-Worker-Token');
    if (!token && !workerToken) return json(401,{error:'Please log in.'});
    try {
      if (workerToken !== null) {
        if (!workerToken || workerToken.length > 512 || !await deps.authenticateWorker(workerToken)) return json(403,{error:'Worker authentication failed.'});
      } else {
        const auth = await deps.authenticate(token!);
        if (auth === 'unauthorized') return json(401,{error:'Please log in again.'});
        if (auth !== 'admin') return json(403,{error:'An active administrator account is required.'});
      }
      if(request.body){
        let body:Record<string,unknown>;
        try{
          const reader=request.body.getReader(),chunks:Uint8Array[]=[];let size=0;
          while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>2048){await reader.cancel();throw new Error();}chunks.push(value);}
          const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
          body=size?JSON.parse(new TextDecoder().decode(bytes)):{};
          if(!body||typeof body!=='object'||Array.isArray(body))throw new Error();
        }catch{return json(400,{error:'Invalid account email request.'});}
        if(body.action==='status')return json(200,{configured:deps.configured()});
        // Reject misspelled status actions rather than accidentally sending mail.
        if(body.action!==undefined)return json(400,{error:'Unsupported account email action.'});
      }
      if (!deps.configured()) return json(503,{error:'Account email delivery is not configured. Configure the SMTP settings; queued emails have not been sent.'});
      // No caller-controlled recipients or body: the database owns the queued decision.
      const messages = (await deps.claim(3)).slice(0,3);
      let sent = 0, failed = 0;
      for (const message of messages) {
        if (message.status !== 'sending' || message.attempts < 1 || message.attempts > 5 || !recipientPattern.test(message.recipient)) {
          await deps.complete(message.id,false,'The queued email could not be delivered.'); failed++; continue;
        }
        try {
          await deps.send({to:message.recipient,...renderAccountEmail(message)});
        } catch {
          await deps.complete(message.id,false,safeError); failed++; continue;
        }
        // Do not label an SMTP success as a failed send if finalisation fails.
        // The sending lease and attempts limit control later recovery.
        await deps.complete(message.id,true,null); sent++;
      }
      return json(200,{sent,failed});
    } catch {
      return json(503,{error:'Account email delivery could not be completed. Please try again later.'});
    }
  };
}
