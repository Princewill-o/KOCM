export type MapLocation = {latitude:number|null;longitude:number|null};
export type MapPoint = {x:number;y:number};
const radians=Math.PI/180;
const mercatorY=(latitude:number)=>Math.log(Math.tan(Math.PI/4+latitude*radians/2));
const north=mercatorY(61.1),south=mercatorY(49.7);
const scale=560/(north-south);
/** Spherical Mercator, shared by the boundary and every pin. No collision displacement. */
export function campusMapPoint({latitude,longitude}:MapLocation):MapPoint|null {
 if(latitude===null||longitude===null||!Number.isFinite(latitude)||!Number.isFinite(longitude))return null;
 if(latitude<49.5||latitude>61.5||longitude< -8.8||longitude>2.1)return null;
 return {x:240+(longitude+3.4)*radians*scale,y:120+(north-mercatorY(latitude))*scale};
}
/** Zoom changes only the view, never the geographic location of a marker. */
export function mapViewport(zoom:number,center:MapPoint={x:240,y:365}) {
 const bounded=Math.max(1,Math.min(16,zoom));const width=480/bounded,height=730/bounded;
 return {x:center.x-width/2,y:center.y-height/2,width,height};
}
