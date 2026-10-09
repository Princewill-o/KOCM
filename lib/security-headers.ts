/** Static Next pages require their generated inline bootstrap scripts and styles.
 * Other resource types and backend connections stay restricted to this app.
 */
export function securityHeaders(production:boolean):{key:string;value:string}[]{
 const backend='https://yrqkafiqwllkphroztqk.supabase.co';
 const csp=["default-src 'self'",`script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${production?'':" 'unsafe-eval'"}`,"script-src-attr 'none'","style-src 'self' 'unsafe-inline'",`img-src 'self' data: blob: ${backend}`,"font-src 'self' data:",`connect-src 'self' ${backend} wss://yrqkafiqwllkphroztqk.supabase.co${production?'':' ws: wss:'}`,"worker-src 'self' blob:","object-src 'none'","frame-src 'none'","frame-ancestors 'none'","base-uri 'self'","form-action 'self'",...(production?['upgrade-insecure-requests']:[])].join('; ');
 return [{key:'Content-Security-Policy',value:csp},{key:'X-Frame-Options',value:'DENY'},{key:'X-Content-Type-Options',value:'nosniff'},{key:'Referrer-Policy',value:'same-origin'},{key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=(), display-capture=(), payment=()'},{key:'Cross-Origin-Opener-Policy',value:'same-origin'},...(production?[{key:'Strict-Transport-Security',value:'max-age=31536000; includeSubDomains'}]:[])];
}
