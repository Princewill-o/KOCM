export type MapLocation = {latitude:number|null;longitude:number|null};
/** Same Natural Earth projection used by UK_OUTLINE, with padding for labels. */
export function campusMapPoint(location:MapLocation):{x:number;y:number}|null {
 const {latitude,longitude}=location;
 if(latitude===null || longitude===null || !Number.isFinite(latitude) || !Number.isFinite(longitude))return null;
 if(latitude<49.5 || latitude>61.5 || longitude< -8.5 || longitude>2.1)return null;
 return {x:((longitude+8.5)/10.5)*420+30,y:((59.5-latitude)/10)*560+125};
}
