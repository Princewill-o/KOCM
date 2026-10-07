// @vitest-environment jsdom
import {createElement} from 'react';
import {cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {askGrace} from '../lib/grace-chat';
vi.mock('../lib/grace-chat',async()=>{const {answerGrace}=await import('../lib/grace-faq');return {askGrace:vi.fn(async(question:string)=>({...answerGrace(question),mode:'faq'}))};});
import AgentDock from '../components/ui/agent-dock';
afterEach(cleanup);
it('opens Grace, answers a typed FAQ and restores focus on Escape',async()=>{
 render(createElement(AgentDock));const trigger=screen.getByRole('button',{name:'Ask Grace'});fireEvent.click(trigger);
 const dialog=screen.getByRole('dialog',{name:'Chat with Grace'});expect(within(dialog).getByRole('img',{name:'Grace, a yellow bear in a Kharis On Campus hoodie'}).getAttribute('src')).toBe('/community/grace-bear.png');const input=within(dialog).getByRole('textbox',{name:'Ask Grace a question'});
 expect(document.activeElement).toBe(input);fireEvent.change(input,{target:{value:'when is the weekly report due?'}});fireEvent.click(within(dialog).getByRole('button',{name:'Send question'}));
 await waitFor(()=>expect(within(dialog).getByText(/Weekly reports are due every Friday before 10pm UK time/)).toBeTruthy());expect(within(dialog).getByRole('link',{name:'Open your workspace'}).getAttribute('href')).toBe('/login');
 fireEvent.keyDown(dialog,{key:'Escape'});await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());expect(document.activeElement).toBe(trigger);
});
it('answers suggested applications and handles questions outside the bank',async()=>{
 render(createElement(AgentDock));fireEvent.click(screen.getByRole('button',{name:'Ask Grace'}));fireEvent.click(screen.getByRole('button',{name:'How do I apply to start a KOC?'}));expect(screen.getByRole('link',{name:'Apply here'}).getAttribute('href')).toBe('/signup');
 const input=screen.getByRole('textbox',{name:'Ask Grace a question'});fireEvent.change(input,{target:{value:'weather tomorrow'}});fireEvent.keyDown(input,{key:'Enter'});await waitFor(()=>expect(screen.getByText(/I don’t have a verified answer/)).toBeTruthy());
});

it('prevents duplicate sends while waiting and labels real AI replies',async()=>{
 let resolve!:(value:Awaited<ReturnType<typeof askGrace>>)=>void;
 vi.mocked(askGrace).mockImplementationOnce(()=>new Promise(done=>{resolve=done;}));
 render(createElement(AgentDock));fireEvent.click(screen.getByRole('button',{name:'Ask Grace'}));const input=screen.getByRole('textbox',{name:'Ask Grace a question'});fireEvent.change(input,{target:{value:'Can you explain that?'}});fireEvent.keyDown(input,{key:'Enter'});
 expect(screen.getByRole('status').textContent).toBe('Grace is thinking…');expect((screen.getByRole('button',{name:'Send question'}) as HTMLButtonElement).disabled).toBe(true);expect((screen.getByRole('button',{name:'What is KOC?'}) as HTMLButtonElement).disabled).toBe(true);
 resolve({answer:'A helpful explanation.',mode:'ai',faq:null});await waitFor(()=>expect(screen.getByText('Grace · AI')).toBeTruthy());expect(screen.getByText('A helpful explanation.')).toBeTruthy();
});
it('cancels a pending request when the dock unmounts',()=>{
 let requestSignal:AbortSignal|undefined;
 vi.mocked(askGrace).mockImplementationOnce((_question,_history,_client,signal)=>{requestSignal=signal;return new Promise(()=>{});});
 const view=render(createElement(AgentDock));fireEvent.click(screen.getByRole('button',{name:'Ask Grace'}));const input=screen.getByRole('textbox',{name:'Ask Grace a question'});fireEvent.change(input,{target:{value:'How does it work?'}});fireEvent.keyDown(input,{key:'Enter'});view.unmount();expect(requestSignal?.aborted).toBe(true);
});
