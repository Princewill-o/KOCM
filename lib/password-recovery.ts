type State = {ready:boolean;error:string};
type Auth = {
 getSession:()=>Promise<{data:{session:unknown};error:unknown}>;
 onAuthStateChange:(callback:(event:string,session:unknown)=>void)=>{data:{subscription:{unsubscribe:()=>void}}};
};
const invalid='This reset link is invalid or has expired. Request a new reset link.';
export function recoveryLinkError(search:string,hash:string):string|null {
 const query=new URLSearchParams(search), fragment=new URLSearchParams(hash.replace(/^#/,''));
 return [query,fragment].some(params=>params.has('error') || params.has('error_code')) ? invalid : null;
}
/** getSession waits for the SDK's callback exchange; no arbitrary timeout. */
export function watchPasswordRecovery(auth:Auth,search:string,hash:string,change:(state:State)=>void):()=>void {
 const error=recoveryLinkError(search,hash);
 if(error){change({ready:false,error});return()=>{};}
 let alive=true, established=false;
 const accept=()=>{established=true;if(alive)change({ready:true,error:''});};
 const {data}=auth.onAuthStateChange((event,session)=>{
  if(session && ['PASSWORD_RECOVERY','SIGNED_IN','INITIAL_SESSION'].includes(event)) accept();
 });
 auth.getSession().then(result=>{
  if(!alive)return;
  if(!result.error && result.data.session)accept();
  else if(!established)change({ready:false,error:invalid});
 }).catch(()=>{if(alive && !established)change({ready:false,error:invalid});});
 return()=>{alive=false;data.subscription.unsubscribe();};
}
