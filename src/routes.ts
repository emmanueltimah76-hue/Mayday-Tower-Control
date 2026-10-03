import {NM_PER_MAP_UNIT,SECONDS_PER_HOUR} from './mapConstants.js';
import {patternProfiles} from './flightPatterns.js';
import {patternGeometry} from './flightPatterns.js';
import {airports,runwayEnds,type Difficulty,type Point} from './airports.js';
export const airspace={left:-550,right:1350,top:-600,bottom:1000};
// Names verified against FAA PRC/ORD pages, PHX standardized taxi routes, and LAWA E16/E18 advisory.
// Coordinates, connectors, stands and inbound/outbound fixes are schematic game geometry.
export const groundNames:Record<Difficulty,string[]>={easy:['A','B','D'],medium:['E','F','C'],hard:['E','E'],expert:['A']};
export function taxiName(d:Difficulty,r:number){return groundNames[d][r%groundNames[d].length];}
export function boundaryPoint(from:Point,toward:Point):Point{const dx=toward[0]-from[0],dy=toward[1]-from[1];const candidates=[dx>0?(airspace.right-from[0])/dx:dx<0?(airspace.left-from[0])/dx:Infinity,dy>0?(airspace.bottom-from[1])/dy:dy<0?(airspace.top-from[1])/dy:Infinity].filter(t=>t>=0);const t=Math.min(...candidates);return [from[0]+dx*t,from[1]+dy*t];}
export function entryRoute(game:{difficulty?:Difficulty;direction?:0|1},r:number,type:import('./protocol.js').AircraftType='narrowbody'){
 const g=patternGeometry(game,r,type),target=g.downwindStart;
 // Closest boundary gives a named, fixed inbound stream without random placement.
 const candidates:Point[]=[[airspace.left,target[1]],[airspace.right,target[1]],[target[0],airspace.top],[target[0],airspace.bottom]];
 const boundary=candidates.filter(p=>p[0]>=airspace.left&&p[0]<=airspace.right&&p[1]>=airspace.top&&p[1]<=airspace.bottom).sort((a,b)=>Math.hypot(a[0]-target[0],a[1]-target[1])-Math.hypot(b[0]-target[0],b[1]-target[1]))[0];
 return {name:`IN-${r+1}${game.direction?'B':'A'}`,points:[boundary,target] as Point[]};
}
export function departureRoute(game:{difficulty?:Difficulty;direction?:0|1},r:number,type:import('./protocol.js').AircraftType='narrowbody'):Point[]{
 const g=patternGeometry(game,r,type),distance=(patternProfiles[type].final+25)*40/(SECONDS_PER_HOUR*NM_PER_MAP_UNIT);
 const climb:Point=[g.end[0]+g.u[0]*distance,g.end[1]+g.u[1]*distance];
 const course:Point=[(g.u[0]+g.left[0])*Math.SQRT1_2,(g.u[1]+g.left[1])*Math.SQRT1_2];
 return [g.start,g.end,climb,boundaryPoint(climb,[climb[0]+course[0],climb[1]+course[1]])];
}
export function exitPoint(game:{difficulty?:Difficulty;direction?:0|1},r:number,type:import('./protocol.js').AircraftType='narrowbody'){return departureRoute(game,r,type).at(-1)!;}
export function groundRoute(game:{difficulty?:Difficulty;direction?:0|1},r:number,gate:Point,from:Point,arrival:boolean,ahead=0):Point[]{const [start,end]=runwayEnds(game,r),d=Math.hypot(end[0]-start[0],end[1]-start[1]),normal:Point=[-(end[1]-start[1])/d,(end[0]-start[0])/d];const midpoint:Point=[(start[0]+end[0])/2,(start[1]+end[1])/2];const side=(gate[0]-midpoint[0])*normal[0]+(gate[1]-midpoint[1])*normal[1]>=0?1:-1;const offset=Math.max(30,.08/airports[game.difficulty??'easy'].nmPerUnit);const shifted=(p:Point):Point=>[p[0]+normal[0]*side*offset,p[1]+normal[1]*side*offset];if(arrival){const projection=(from[0]-start[0])*(end[0]-start[0])/d+(from[1]-start[1])*(end[1]-start[1])/d;const along:Point=[start[0]+(end[0]-start[0])*Math.min(d*.9,projection+35)/d,start[1]+(end[1]-start[1])*Math.min(d*.9,projection+35)/d];const gateProjection=Math.max(0,Math.min(d,((gate[0]-start[0])*(end[0]-start[0])+(gate[1]-start[1])*(end[1]-start[1]))/d));const nearGate:Point=[start[0]+(end[0]-start[0])*gateProjection/d,start[1]+(end[1]-start[1])*gateProjection/d];return [from,along,shifted(along),shifted(nearGate),gate];}const hold=shifted([start[0]+(end[0]-start[0])*Math.min(d*.25,10+ahead*12)/d,start[1]+(end[1]-start[1])*Math.min(d*.25,10+ahead*12)/d]);return [from,[gate[0],hold[1]],hold];}
