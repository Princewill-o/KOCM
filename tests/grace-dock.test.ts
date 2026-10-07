// @vitest-environment jsdom
import {createElement} from 'react';
import {cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {afterEach,expect,it} from 'vitest';
import AgentDock from '../components/ui/agent-dock';
afterEach(cleanup);
it('opens Grace, answers a typed FAQ and restores focus on Escape',async()=>{
 render(createElement(AgentDock));const trigger=screen.getByRole('button',{name:'Ask Grace'});fireEvent.click(trigger);
 const dialog=screen.getByRole('dialog',{name:'Chat with Grace'});const input=within(dialog).getByRole('textbox',{name:'Ask Grace a question'});
 expect(document.activeElement).toBe(input);fireEvent.change(input,{target:{value:'when is the weekly report due?'}});fireEvent.click(within(dialog).getByRole('button',{name:'Send question'}));
 expect(within(dialog).getByText(/Weekly reports are due every Friday before 10pm UK time/)).toBeTruthy();expect(within(dialog).getByRole('link',{name:'Open your workspace'}).getAttribute('href')).toBe('/login');
 fireEvent.keyDown(dialog,{key:'Escape'});await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());expect(document.activeElement).toBe(trigger);
});
it('answers suggested applications and handles questions outside the bank',()=>{
 render(createElement(AgentDock));fireEvent.click(screen.getByRole('button',{name:'Ask Grace'}));fireEvent.click(screen.getByRole('button',{name:'How do I apply to start a KOC?'}));expect(screen.getByRole('link',{name:'Apply here'}).getAttribute('href')).toBe('/signup');
 const input=screen.getByRole('textbox',{name:'Ask Grace a question'});fireEvent.change(input,{target:{value:'weather tomorrow'}});fireEvent.keyDown(input,{key:'Enter'});expect(screen.getByText(/I don’t have a verified answer/)).toBeTruthy();
});
