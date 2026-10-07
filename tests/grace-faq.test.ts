import {describe,expect,it} from 'vitest';
import {answerGrace,GRACE_FAQS} from '../lib/grace-faq';
describe('Grace FAQ matching',()=>{
 it('explains KOC from the public landing content',()=>{expect(answerGrace('what is KOC?').faq?.id).toBe('about');});
 it('answers campus application wording with the real signup path',()=>{expect(answerGrace('How do I start a KOC at my uni?').faq?.id).toBe('apply');expect(answerGrace('apply for an account').faq?.href).toBe('/signup');});
 it('matches report deadline and late submission questions separately',()=>{expect(answerGrace('when is the weekly report due?').faq?.id).toBe('reports');expect(answerGrace('what happens if my report is late?').faq?.id).toBe('late');expect(answerGrace('my weekly report is late').faq?.id).toBe('late');});
 it('answers academic and password questions from separate FAQs',()=>{expect(answerGrace('I got 58 percent in my grades').faq?.id).toBe('grades');expect(answerGrace('forgot my password').faq?.href).toBe('/forgot-password');});
 it('does not invent answers to unmatched or trivial prompts',()=>{expect(answerGrace('hello').faq).toBeNull();expect(answerGrace('what is the weather tomorrow?').faq).toBeNull();expect(answerGrace('the account').faq).toBeNull();});
 it('uses only declared public destinations and nonempty answers',()=>{for(const faq of GRACE_FAQS){expect(faq.answer.length).toBeGreaterThan(20);if(faq.href)expect(['/signup','/login','/forgot-password']).toContain(faq.href);}});
});
