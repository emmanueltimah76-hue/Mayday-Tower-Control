import {runwayEnds,type Point} from './airports.js';
import {NM_PER_MAP_UNIT,knotsToUnitsPerSecond} from './mapConstants.js';
import type {AircraftType,PatternLeg} from './protocol.js';
export const patternProfiles:Record<AircraftType,{altitude:number;baseAltitude:number;inbound:number;downwind:number;final:number;turn:number;climb:number;finalNm:number}>={
 light:{altitude:1000,baseAltitude:600,inbound:90,downwind:80,final:70,turn:6,climb:10,finalNm:.8},
 regional:{altitude:1500,baseAltitude:900,inbound:150,downwind:140,final:130,turn:3,climb:15,finalNm:1.4},
 narrowbody:{altitude:1500,baseAltitude:900,inbound:160,downwind:150,final:140,turn:3,climb:15,finalNm:1.5},
 heavy:{altitude:1500,baseAltitude:1000,inbound:170,downwind:160,final:150,turn:3,climb:15,finalNm:1.6}
};
export function patternGeometry(game:{difficulty?:import('./airports.js').Difficulty;direction?:0|1},r:number,type:AircraftType='narrowbody'){
 const [start,end]=runwayEnds(game,r),length=Math.hypot(end[0]-start[0],end[1]-start[1]);
 const u:Point=[(end[0]-start[0])/length,(end[1]-start[1])/length],left:Point=[u[1],-u[0]],profile=patternProfiles[type];
 const radius=knotsToUnitsPerSecond(profile.inbound)/(profile.turn*Math.PI/180),width=Math.max(.6/NM_PER_MAP_UNIT,2.4*radius),finalDistance=Math.max(profile.finalNm/NM_PER_MAP_UNIT,3.2*radius);
 const point=(along:number,across:number):Point=>[start[0]+u[0]*along+left[0]*across,start[1]+u[1]*along+left[1]*across];
 return {start,end,u,left,radius,width,downwindStart:point(Math.min(length*.5,.65/NM_PER_MAP_UNIT),width),downwindEnd:point(-finalDistance,width),finalStart:point(-finalDistance,0),heading:Math.atan2(u[0],-u[1])*180/Math.PI};
}
export const normalPatternLegs:PatternLeg[]=['inbound','downwind','base','final'];
