// @vitest-environment jsdom
import {createElement} from 'react';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it} from 'vitest';
import SteppedMorphSlider from '../components/ui/stepped-morph-slider';
afterEach(cleanup);
it('changes the selected photo using arrows, keyboard and direct selectors',()=>{
 render(createElement(SteppedMorphSlider,{slides:[{image:'/one.jpg',title:'Community',caption:'Together'},{image:'/two.jpg',title:'Prayer',caption:'Growing in faith'}]}));
 expect(screen.getByRole('img').getAttribute('aria-label')).toBe('Community: Together');fireEvent.click(screen.getByRole('button',{name:'Next photo'}));expect(screen.getByRole('img').getAttribute('aria-label')).toBe('Prayer: Growing in faith');
 fireEvent.keyDown(screen.getByRole('button',{name:'Next photo'}),{key:'ArrowLeft'});expect(screen.getByRole('img').getAttribute('aria-label')).toBe('Community: Together');
 fireEvent.click(screen.getByRole('button',{name:'Show Prayer'}));expect(screen.getByRole('button',{name:'Show Prayer'}).getAttribute('aria-pressed')).toBe('true');
 fireEvent.click(screen.getByRole('button',{name:'Next photo'}));expect(screen.getByRole('img').getAttribute('aria-label')).toBe('Community: Together');
});
