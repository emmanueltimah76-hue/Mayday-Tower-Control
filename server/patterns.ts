import {patternGeometry,patternProfiles} from '../src/flightPatterns.js';
import {advanceMotion,shortestAngle,remainingDistance} from './motion.js';
import {NM_PER_MAP_UNIT,knotsToUnitsPerSecond} from '../src/mapConstants.js';
import type {Aircraft,GameState} from '../src/protocol.js';
import type {Point} from '../src/airports.js';
const distance=(a:Point,b:Point)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
export function beginPattern(game:GameState,p:Aircraft,runway=p.approachRunway??0){
 const g=patternGeometry(game,runway,p.aircraftType);p.approachRunway=runway;p.patternLegs=['inbound','downwind','base','final'];p.patternPhase='inbound';p.patternLeg='inbound';p.patternWidth=g.width;p.patternFinalAlong=undefined;p.onFinal=false;p.status='approach';p.route=[p.position!,g.downwindStart,g.downwindEnd,g.finalStart,g.start];p.routeIndex=1;p.remaining=Math.ceil(p.route.slice(1).reduce((n,q,i)=>n+distance(p.route![i],q),0)/knotsToUnitsPerSecond(patternProfiles[p.aircraftType??'narrowbody'].downwind))+60;
}
export function beginGoAround(game:GameState,p:Aircraft,hold=false){
 const g=patternGeometry(game,p.runway??p.approachRunway??0,p.aircraftType);
 p.approachRunway=p.runway??p.approachRunway;p.patternLegs=['go-around','crosswind','rejoin','downwind','base','final'];p.patternPhase='go-around';p.patternLeg='go-around';p.patternWidth=g.width;p.patternFinalAlong=undefined;p.holdRequested=hold;p.holdReachedAltitude=(p.altitude??0)>=1499;p.clearedToLand=false;p.onFinal=false;p.status=hold?'holding':'go-around';p.targetHeading=p.finalCourse=undefined;p.recoveryStartedAt=game.elapsed;
 p.route=[p.position!,g.downwindStart,g.downwindEnd,g.finalStart,g.start];p.routeIndex=1;
}
export function advancePattern(game:GameState,p:Aircraft,dt:number):boolean{
 const g=patternGeometry(game,p.runway??p.approachRunway??0,p.aircraftType),profile=patternProfiles[p.aircraftType??'narrowbody'];
 const local=()=>({along:(p.position![0]-g.start[0])*g.u[0]+(p.position![1]-g.start[1])*g.u[1],across:(p.position![0]-g.start[0])*g.left[0]+(p.position![1]-g.start[1])*g.left[1]});
 const q=local(),width=p.patternWidth??g.width,radius=knotsToUnitsPerSecond(p.groundSpeed??profile.downwind)/(profile.turn*Math.PI/180);
 const headingNear=(h:number)=>Math.abs(shortestAngle(p.heading??h,h))<.4;
 const point=(along:number,across:number):Point=>[g.start[0]+g.u[0]*along+g.left[0]*across,g.start[1]+g.u[1]*along+g.left[1]*across];
 if((p.altitude??0)>=1499)p.holdReachedAltitude=true;
 let phase=p.patternPhase??'inbound';
 if(phase==='inbound'&&distance(p.position!,g.downwindStart)<g.radius*.6)phase='downwind';
 if(phase==='go-around'&&(p.altitude??0)>=500&&headingNear(g.heading)&&game.elapsed-(p.recoveryStartedAt??game.elapsed)>15)phase='crosswind';
 if(phase==='crosswind'&&q.across>=g.width&&headingNear(g.heading-90)&&p.holdReachedAltitude)phase='rejoin';
 if(phase==='rejoin'&&headingNear(g.heading-180)){phase='downwind';p.patternWidth=g.width;p.patternFinalAlong=undefined;if(p.clearedToLand)p.holdRequested=false;}
 if(phase==='downwind'&&q.along<=-Math.max(profile.finalNm/NM_PER_MAP_UNIT,3.2*g.radius)+radius&&Math.abs(q.across-width)<.06/NM_PER_MAP_UNIT&&Math.abs(shortestAngle(p.heading??0,g.heading-180))<8){phase='turn-base';p.patternFinalAlong=q.along-radius;}
 if(phase==='turn-base'&&headingNear(g.heading+90)){phase='base';p.patternFinalAlong=q.along;}
 if(phase==='base'&&q.across<=radius&&headingNear(g.heading+90))phase='turn-final';
 if(phase==='turn-final'&&headingNear(g.heading)){phase='final';}
 p.patternPhase=phase;
 const recovering=['go-around','crosswind','rejoin'].includes(phase);
 if(p.clearedToLand&&p.holdReachedAltitude&&!recovering)p.holdRequested=false;
 const held=!!p.holdRequested;
 p.patternLeg=phase==='turn-base'?'base':phase==='turn-final'?'final':phase;
 p.targetSpeed=phase==='inbound'?profile.inbound:['downwind','turn-base','go-around','crosswind','rejoin'].includes(phase)?profile.downwind:profile.final;
 p.targetAltitude=recovering||held?1500:phase==='inbound'||phase==='downwind'?profile.altitude:phase==='turn-base'||phase==='base'?profile.baseAltitude:Math.max(0,-q.along)*NM_PER_MAP_UNIT*318;
 if(phase==='inbound'){
  p.currentTarget=g.downwindStart;p.targetHeading=Math.atan2(g.downwindStart[0]-p.position![0],-(g.downwindStart[1]-p.position![1]))*180/Math.PI;
 }else if(phase==='downwind'){
  p.currentTarget=point(-Math.max(profile.finalNm/NM_PER_MAP_UNIT,3.2*g.radius)+radius,width);
  p.targetHeading=g.heading-180+Math.atan2(width-q.across,g.radius*.6)*180/Math.PI;
 }else if(phase==='turn-base'||phase==='base'){
  p.currentTarget=point(p.patternFinalAlong??q.along,radius);
  p.targetHeading=g.heading+90+(phase==='base'?Math.atan2(q.along-(p.patternFinalAlong??q.along),g.radius*.6)*180/Math.PI:0);
 }else if(phase==='turn-final'||phase==='final'){
  p.currentTarget=g.start;p.targetHeading=g.heading+(phase==='final'?Math.atan2(q.across,g.radius*.6)*180/Math.PI:0);
 }else{p.targetHeading=phase==='go-around'?g.heading:phase==='crosswind'?g.heading-90:g.heading-180;p.currentTarget=phase==='go-around'?point(q.along+g.radius,q.across):phase==='crosswind'?point(q.along,g.width):point(q.along-g.radius,q.across);}
 p.onFinal=p.patternLeg==='final';p.status=recovering||held?(held?'holding':'go-around'):p.onFinal?'landing':'approach';
 // Reuse the same bounded forward integrator. A far steering target prevents a
 // waypoint snap; phase completion is determined by the runway-relative geometry.
 p.routeIndex=phase==='inbound'?1:phase==='downwind'?2:['turn-base','base'].includes(phase)?3:['turn-final','final'].includes(phase)?4:1;
 const route=p.route,index=p.routeIndex,h=p.targetHeading*Math.PI/180;
 p.route=[p.position!,[p.position![0]+Math.sin(h)*10000,p.position![1]-Math.cos(h)*10000]];p.routeIndex=1;p.finalCourse=undefined;
 advanceMotion(p,dt);p.route=route;p.routeIndex=index;
 const after=local();
 p.remaining=Math.max(1,Math.ceil(remainingDistance(p)/knotsToUnitsPerSecond(p.targetSpeed)));
 return phase==='final'&&after.along>=0;
}
export function stabilized(game:GameState,p:Aircraft){const g=patternGeometry(game,p.runway??p.approachRunway??0,p.aircraftType),v=patternProfiles[p.aircraftType??'narrowbody'];const lateral=Math.abs((p.position![0]-g.start[0])*g.left[0]+(p.position![1]-g.start[1])*g.left[1])*NM_PER_MAP_UNIT;return lateral<.012&&Math.abs(shortestAngle(p.heading??0,g.heading))<8&&Math.abs((p.groundSpeed??0)-v.final)<8&&(p.altitude??0)<60;}
