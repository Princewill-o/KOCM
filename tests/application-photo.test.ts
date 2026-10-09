import {it,expect} from 'vitest';
import {validateApplicationPhoto} from '../lib/application-photo';
it('accepts only bounded browser-decodable photo formats',()=>{expect(()=>validateApplicationPhoto({type:'image/png',size:1024})).not.toThrow();expect(()=>validateApplicationPhoto({type:'image/svg+xml',size:1024})).toThrow(/JPG, PNG or WebP/);expect(()=>validateApplicationPhoto({type:'image/heic',size:1024})).toThrow(/JPG, PNG or WebP/);expect(()=>validateApplicationPhoto({type:'image/jpeg',size:6*1024*1024})).toThrow(/5 MB/);});
