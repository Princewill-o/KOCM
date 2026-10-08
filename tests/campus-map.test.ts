import {describe,it,expect} from 'vitest';
import {campusMapPoint,mapViewport} from '../lib/campus-map';
describe('UK campus map placement',()=>{
 it('fits Scotland, Shetland and Northern Ireland within the UK viewport',()=>{
  for(const location of [{latitude:51.5074,longitude:-.1278},{latitude:60.155,longitude:-1.145},{latitude:54.597,longitude:-5.93},{latitude:58.2,longitude:-6.4}]){
   const p=campusMapPoint(location)!;expect(p.x).toBeGreaterThan(0);expect(p.x).toBeLessThan(480);expect(p.y).toBeGreaterThan(0);expect(p.y).toBeLessThan(730);
  }
 });
 it('uses the same conformal scale for latitude and longitude at London',()=>{
  const origin=campusMapPoint({latitude:51.5,longitude:0})!;
  const east=campusMapPoint({latitude:51.5,longitude:0.01})!;
  const north=campusMapPoint({latitude:51.51,longitude:0})!;
  expect((origin.y-north.y)/(east.x-origin.x)).toBeCloseTo(1/Math.cos(51.5*Math.PI/180),2);
 });
 it('zooms viewport without changing any campus geographic point',()=>{
  const location={latitude:51.52,longitude:-0.04};const p=campusMapPoint(location)!;
  const viewport=mapViewport(8,p);expect(viewport.width).toBe(60);expect(viewport.x+viewport.width/2).toBe(p.x);
  expect(campusMapPoint(location)).toEqual(p);
 });
 it('does not invent locations for unknown or invalid coordinates',()=>{
  for(const point of [{latitude:null,longitude:0},{latitude:52,longitude:null},{latitude:NaN,longitude:0},{latitude:40,longitude:-74},{latitude:Infinity,longitude:0}])expect(campusMapPoint(point)).toBeNull();
 });
});
