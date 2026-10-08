import {describe,expect,it} from 'vitest';
import {readFileSync,existsSync} from 'node:fs';
import brands from '../lib/university-brands.json';
describe('verified university branding assets',()=>{
 it('provides official-source marks for every university and an explicit Colleges group',()=>{
  expect(Object.keys(brands)).toHaveLength(49);
  for(const [name,brand] of Object.entries(brands)){
   if(name==='Colleges'){expect(brand.logo).toBeNull();continue;}
   expect(brand.logo,name).toMatch(/^\/university-brands\//);expect(brand.source,name).toMatch(/^https:\/\//);
   const path='public'+brand.logo;expect(existsSync(path),name).toBe(true);
   const data=readFileSync(path);expect(data.length,name).toBeGreaterThan(100);
   if(path.endsWith('.svg')){const svg=data.toString();expect(svg,name).toContain('<svg');expect(svg,name).not.toMatch(/<script|\bonload=|\bonerror=|<foreignObject/i);}
   else expect(data.subarray(0,20).toString(),name).not.toMatch(/html|DOCTYPE/i);
  }
 });
 it('replaces the Coventry award badge and keeps full wordmarks for prior tiny icons',()=>{
  expect(brands.Coventry.source).toContain('/logos/cov.svg');
  for(const name of ['Bath','Birmingham City','Derby','Nottingham Trent','Ravensbourne','Liverpool','Northampton','Warwick'] as const)expect(brands[name].logo).toContain('wordmark');
 });
});
