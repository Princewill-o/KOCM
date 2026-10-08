import {createClient} from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import {createUsernameAuthHandler,attachVerifiedEmail} from './handler.ts';
const url=Deno.env.get('SUPABASE_URL'),serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),anonKey=Deno.env.get('SUPABASE_ANON_KEY');if(!url||!serviceKey||!anonKey)throw new Error('Authentication configuration is missing.');
const auth={persistSession:false,autoRefreshToken:false,detectSessionInUrl:false};const service=createClient(url,serviceKey,{auth});
const smtpHost=Deno.env.get('SMTP_HOST'),smtpPort=Number(Deno.env.get('SMTP_PORT')),smtpUser=Deno.env.get('SMTP_USER'),smtpPassword=Deno.env.get('SMTP_PASSWORD'),smtpFrom=Deno.env.get('SMTP_FROM');
const emailConfigured=Boolean(smtpHost&&smtpPort===465&&smtpUser&&smtpPassword&&smtpFrom&&!/[\r\n]/.test(smtpFrom));
const transport=emailConfigured?nodemailer.createTransport({host:smtpHost,port:465,secure:true,auth:{user:smtpUser!,pass:smtpPassword!},tls:{minVersion:'TLSv1.2',rejectUnauthorized:true},connectionTimeout:5000,greetingTimeout:5000,socketTimeout:10000,disableFileAccess:true,disableUrlAccess:true}):null;
Deno.serve(createUsernameAuthHandler({publishableKey:'sb_publishable_C2z55xhqXzGgj9rqjkHj5g_uetKwEYC',
 claim:async(identity,action)=>{const {data,error}=await service.rpc('claim_username_auth',{p_identity:identity,p_action:action});if(error)throw error;return data===true;},
 create:async input=>{const {data,error}=await service.auth.admin.createUser({email:`${crypto.randomUUID()}@accounts.kocm.invalid`,password:input.password,email_confirm:true,user_metadata:{full_name:input.fullName,campus_id:input.campusId}});if(error||!data.user)throw new Error('Create failed.');return data.user.id;},
 assign:async(id,username,campusId)=>{const {error}=await service.rpc('assign_pending_username',{p_user_id:id,p_username:username,p_campus_id:campusId});if(error)throw error;},
 remove:async id=>{const {error}=await service.auth.admin.deleteUser(id);if(error)throw error;},
 resolve:async username=>{const {data,error}=await service.rpc('resolve_username_login',{p_username:username});if(error)throw error;return typeof data==='string'?data:null;},
 owner:async token=>{const client=createClient(url,anonKey,{auth});const {data,error}=await client.auth.getUser(token);if(error||!data.user?.email)throw new Error('Owner not verified.');return {id:data.user.id,email:data.user.email};},
 provePassword:async(owner,password)=>{const client=createClient(url,anonKey,{auth});try{const {data,error}=await client.auth.signInWithPassword({email:owner.email,password});if(error||data.user?.id!==owner.id)throw new Error('Password not verified.');}finally{await client.auth.signOut({scope:'local'});}},
 emailConfigured:()=>emailConfigured,
 attach:async(owner,email)=>{
   if(!transport||!smtpFrom)throw new Error('Delivery unavailable.');
   await attachVerifiedEmail(owner,email,{
    verificationEnabled:async()=>{const settings=await fetch(`${url}/auth/v1/settings`,{headers:{apikey:anonKey},signal:AbortSignal.timeout(10000)});return settings.ok&&(await settings.json()).mailer_autoconfirm===false;},
    generate:async(kind,verifiedOwner,nextEmail)=>{const result=await service.auth.admin.generateLink({type:kind,email:verifiedOwner.email,newEmail:nextEmail,options:{redirectTo:'https://kocm.vercel.app/dashboard'}});if(result.error||!result.data.user||!result.data.properties)throw new Error('Confirmation generation failed.');return {userId:result.data.user.id,tokenHash:result.data.properties.hashed_token,actionLink:result.data.properties.action_link};},
    confirmAlias:async hash=>{const client=createClient(url,anonKey,{auth});const verified=await client.auth.verifyOtp({type:'email_change',token_hash:hash});if(verified.error||verified.data.session||verified.data.user)throw new Error('Alias confirmation failed.');},
    deliver:async(recipient,link)=>{
   const parsed=new URL(link);if(parsed.origin!==new URL(url).origin||parsed.pathname!=='/auth/v1/verify')throw new Error('Invalid confirmation destination.');
   const safeLink=link.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));
   const result=await transport.sendMail({from:smtpFrom,to:recipient,envelope:{from:smtpFrom,to:[recipient]},subject:'Confirm your KOC email address',text:`Confirm this email address for your KOC account:\n\n${link}\n\nYour account email changes only after confirmation. If you did not request this, ignore this message.`,html:`<!doctype html><html lang="en"><body style="margin:0;background:#f7f6f2;font-family:Arial,sans-serif;color:#20231f"><div style="max-width:540px;margin:32px auto;padding:32px;background:white;border-top:4px solid #dfbd53"><p style="font-size:12px;letter-spacing:2px">KHARIS ON CAMPUS</p><h1 style="font-size:28px">Confirm your email address</h1><p style="line-height:1.6">Use the link below to add this email address to your KOC account. Your account email changes only after confirmation.</p><p><a style="display:inline-block;padding:14px 22px;background:#dfbd53;color:#20231f;text-decoration:none" href="${safeLink}">Confirm email address</a></p><p style="font-size:13px;color:#687168">If you did not request this change, ignore this message.</p></div></body></html>`});
   if(result.accepted?.length!==1||(result.rejected?.length??0)>0)throw new Error('Email not accepted.');
    },
   });
 },
 signin:async(email,password)=>{const client=createClient(url,anonKey,{auth});const {data,error}=await client.auth.signInWithPassword({email,password});if(error||!data.session)throw new Error('Sign in failed.');return {access_token:data.session.access_token,refresh_token:data.session.refresh_token};}
}));
