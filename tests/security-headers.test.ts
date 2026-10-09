import {it,expect} from 'vitest';
import {securityHeaders} from '../lib/security-headers';
it('blocks framing, unsafe resource types and unapproved backend connections in production',()=>{
 const headers=Object.fromEntries(securityHeaders(true).map(h=>[h.key,h.value]));
 expect(headers['X-Frame-Options']).toBe('DENY');expect(headers['X-Content-Type-Options']).toBe('nosniff');
 const csp=headers['Content-Security-Policy'];
 expect(csp).toContain("frame-ancestors 'none'");expect(csp).toContain("object-src 'none'");expect(csp).toContain("script-src-attr 'none'");
 expect(csp).not.toContain("'unsafe-eval'");expect(csp).not.toContain('https:;');
 expect(csp).toContain('https://yrqkafiqwllkphroztqk.supabase.co');
 expect(headers['Strict-Transport-Security']).toContain('31536000');
 expect(headers['Permissions-Policy']).toContain('display-capture=()');
});
it('preserves local development without setting a persistent HTTPS policy',()=>{
 const headers=Object.fromEntries(securityHeaders(false).map(h=>[h.key,h.value]));
 expect(headers['Strict-Transport-Security']).toBeUndefined();expect(headers['Content-Security-Policy']).toContain("'unsafe-eval'");
});
