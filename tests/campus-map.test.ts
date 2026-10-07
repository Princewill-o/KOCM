import {describe,it,expect} from 'vitest';
import {campusMapPoint} from '../lib/campus-map';
describe('UK campus map placement',()=>{
 it('keeps located campuses within the selectable UK viewport',()=>{
  for(const point of [{latitude:51.5074,longitude:-.1278},{latitude:60.155,longitude:-1.145},{latitude:54.597,longitude:-5.93}]){
   const p=campusMapPoint(point)!;expect(p.x).toBeGreaterThan(0);expect(p.x).toBeLessThan(480);expect(p.y).toBeGreaterThan(0);expect(p.y).toBeLessThan(730);
  }
 });
 it('does not invent locations for unknown or invalid coordinates',()=>{
  for(const point of [{latitude:null,longitude:0},{latitude:52,longitude:null},{latitude:NaN,longitude:0},{latitude:40,longitude:-74},{latitude:Infinity,longitude:0}])expect(campusMapPoint(point)).toBeNull();
 });
});
