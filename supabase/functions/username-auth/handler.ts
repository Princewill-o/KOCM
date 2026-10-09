type Session={access_token:string;refresh_token:string};
export type EmailOwner={id:string;email:string};
type Dependencies={publishableKey:string;claim:(identity:string,action:'signin'|'attach_email')=>Promise<boolean>;resolve:(username:string)=>Promise<string|null>;signin:(email:string,password:string)=>Promise<Session>;owner?:(token:string)=>Promise<EmailOwner>;provePassword?:(owner:EmailOwner,password:string)=>Promise<void>;emailConfigured?:()=>boolean;attach?:(owner:EmailOwner,email:string)=>Promise<void>};
const origins=new Set(['https://kocm.vercel.app','https://koccm.vercel.app','http://localhost:5173','http://127.0.0.1:5173']);
export function createUsernameAuthHandler(deps:Dependencies){return async(request:Request)=>{
 const origin=request.headers.get('origin');const headers={'content-type':'application/json','cache-control':'no-store',vary:'Origin',...(origin&&origins.has(origin)?{'access-control-allow-origin':origin}:{})};
 const respond=(body:unknown,status=200)=>new Response(JSON.stringify(body),{headers,status});
 if(origin&&!origins.has(origin))return respond({error:'Origin is not allowed.'},403);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...headers,'access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'apikey, content-type, authorization, x-client-info'}});
 if(request.method!=='POST')return respond({error:'Use POST.'},405);
 if(request.headers.get('apikey')!==deps.publishableKey)return respond({error:'Invalid project key.'},401);
 let body:Record<string,unknown>;
 try{if(!request.headers.get('content-type')?.startsWith('application/json'))throw new Error();const reader=request.body?.getReader();if(!reader)throw new Error();const chunks:Uint8Array[]=[];let size=0;while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>8192){await reader.cancel();throw new Error();}chunks.push(value);}const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}body=JSON.parse(new TextDecoder().decode(bytes));if(!body||typeof body!=='object'||Array.isArray(body))throw new Error();}catch{return respond({error:'Invalid request.'},400);}
 if(body.action==='signup')return respond({error:'Apply through the campus lead application form at /signup.'},409);
 const action=body.action;const password=action==='attach_email'?body.currentPassword:body.password;
 if((action!=='signin'&&action!=='attach_email')||typeof password!=='string'||!password||password.length>128)return respond({error:'Invalid request.'},400);
 let owner:EmailOwner|undefined;let nextEmail='';
 if(action==='attach_email'){
   nextEmail=typeof body.email==='string'?body.email.trim().toLowerCase():'';
   if(nextEmail.length>254||! /^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(nextEmail)||nextEmail.endsWith('.invalid'))return respond({error:'Enter one valid email address.'},400);
   const token=/^Bearer\s+([^\s]+)$/i.exec(request.headers.get('authorization')??'')?.[1];
   if(!token)return respond({error:'Sign in again before adding an email address.'},401);
   try{if(!deps.owner)throw new Error();owner=await deps.owner(token);}catch{return respond({error:'Sign in again before adding an email address.'},401);}
   if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}@accounts\.kocm\.invalid$/i.test(owner.email))return respond({error:'Use the normal email change process for this account.'},403);
 }
 let identifier='';
 if(action==='signin'){identifier=typeof body.identifier==='string'?body.identifier.trim().toLowerCase():'';if(identifier.length>254||(!/^[a-z0-9_]{3,30}$/.test(identifier)&&! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)))return respond({error:'Unable to sign in with those details.'},401);}
 try{const ip=(request.headers.get('x-forwarded-for')?.split(',')[0].trim()??'unknown').slice(0,100);const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(owner?`${ip}:${owner.id}`:ip));const identity=Array.from(new Uint8Array(hash),byte=>byte.toString(16).padStart(2,'0')).join('');if(!await deps.claim(identity,action))return respond({error:'Too many attempts. Try again later.'},429);}catch{return respond({error:'Authentication is temporarily unavailable.'},503);}
 if(owner){
   try{if(!deps.provePassword)throw new Error();await deps.provePassword(owner,password);}catch{return respond({error:'Your current password could not be verified.'},401);}
   if(!deps.emailConfigured?.()||!deps.attach)return respond({error:'Email confirmation delivery is not configured. Your account email has not been changed.'},503);
   try{await deps.attach(owner,nextEmail);return respond({ok:true,confirmationRequired:true});}catch{return respond({error:'The confirmation email could not be sent. Please try again later.'},503);}
 }

 try{const email=identifier.includes('@')?identifier:await deps.resolve(identifier); // Unknown names still take a password verification path.
 const session=await deps.signin(email??'unknown@accounts.kocm.invalid',password);return respond({access_token:session.access_token,refresh_token:session.refresh_token});}catch{return respond({error:'Unable to sign in with those details.'},401);}
};}

export type EmailAttachmentDependencies={verificationEnabled:()=>Promise<boolean>;generate:(kind:'email_change_current'|'email_change_new',owner:EmailOwner,email:string)=>Promise<{userId:string;tokenHash?:string;actionLink?:string}>;confirmAlias:(hash:string)=>Promise<void>;deliver:(email:string,link:string)=>Promise<void>};
export async function attachVerifiedEmail(owner:EmailOwner,email:string,deps:EmailAttachmentDependencies){
 if(!await deps.verificationEnabled())throw new Error('Email verification must remain enabled.');
 const old=await deps.generate('email_change_current',owner,email);
 if(old.userId!==owner.id||!old.tokenHash)throw new Error('Invalid current confirmation.');
 const next=await deps.generate('email_change_new',owner,email);
 if(next.userId!==owner.id||!next.actionLink)throw new Error('Invalid new confirmation.');
 // Confirm only the inaccessible internal alias, after generating both tokens.
 await deps.confirmAlias(old.tokenHash);
 await deps.deliver(email,next.actionLink);
}
