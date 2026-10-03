import {feetToUnits} from './mapConstants.js';
import {stands} from './ramps.js';
import {airports,type Difficulty,type Point} from './airports.js';
import type {Aircraft,AircraftType} from './protocol.js';
export const groundRadiusFeet:Record<AircraftType,number>={light:35,regional:60,narrowbody:75,heavy:130};
export const groundRadius=(p:Aircraft)=>feetToUnits(groundRadiusFeet[p.aircraftType??'narrowbody']);
export const groundGap=(a:Aircraft,b:Aircraft)=>groundRadius(a)+groundRadius(b)+feetToUnits(50);
export const onGround=(p:Aircraft)=>!!p.position&&!p.onFinal&&!['approach','holding','go-around','final'].includes(p.status)&&(p.status!=='takeoff'||(p.altitude??0)<=10);
export function pointSegmentDistance(p:Point,a:Point,b:Point){const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p[0]-a[0]-dx*t,p[1]-a[1]-dy*t);}
export function segmentDistance(a:Point,b:Point,c:Point,d:Point){const cross=(a:Point,b:Point,c:Point)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);if(cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0)return 0;return Math.min(pointSegmentDistance(a,c,d),pointSegmentDistance(b,c,d),pointSegmentDistance(c,a,b),pointSegmentDistance(d,a,b));}
// Schematic terminal blocks placed behind stands; neither footprints nor bypasses are surveyed airport data.
export function terminalBlocks(d:Difficulty){return [...new Set(stands[d].map(s=>s.terminal))].map(name=>{const group=stands[d].filter(s=>s.terminal===name),cx=group.reduce((s,p)=>s+p.position[0],0)/group.length,cy=group.reduce((s,p)=>s+p.position[1],0)/group.length;const candidates:Point[]=[[cx,Math.min(...group.map(s=>s.position[1]))-45],[cx,Math.max(...group.map(s=>s.position[1]))+45],[Math.min(...group.map(s=>s.position[0]))-45,cy],[Math.max(...group.map(s=>s.position[0]))+45,cy]];const center=candidates.sort((a,b)=>Math.min(...airports[d].runways.map(r=>pointSegmentDistance(b,r.start,r.end)))-Math.min(...airports[d].runways.map(r=>pointSegmentDistance(a,r.start,r.end))))[0];return {name,center,width:24,height:16};});}
