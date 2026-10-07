import {runwayBlockers} from '../src/runwaySafety.js';
import {poseCurves,smoothCorners} from './groundCurves.js';
import type {Aircraft,GameState} from '../src/protocol.js';
import {airports,type Point} from '../src/airports.js';
import {feetToUnits,knotsToUnitsPerSecond} from '../src/mapConstants.js';
import {groundGap,groundRadius,onGround,pointSegmentDistance,segmentDistance,terminalBlocks} from '../src/groundGeometry.js';
import {advanceMotion,curvedRoute,flightProfiles,minimumTurnFeet,remainingDistance,setRoute,shortestAngle,routeLength} from './motion.js';
type Obstacle={a:Point;b:Point;radius:number;name:string};
const distance=(a:Point,b:Point)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
function segments(p:Aircraft):[Point,Point][]{if(!p.route||!p.position)return [];const last=p.status==='takeoff'?(p.takeoffRollIndex??1)+1:p.route.length;const raw=[p.position,...p.route.slice(p.routeIndex??1,last)],points:Point[]=[raw[0]];for(let i=1;i<raw.length;i++)if(i===raw.length-1||distance(points.at(-1)!,raw[i])>=3)points.push(raw[i]);return points.slice(1).map((q,i)=>[points[i],q]);}
function runwaySegments(p:Aircraft):[Point,Point][]{if(!p.route||!p.position)return [];const last=p.status==='takeoff'?(p.takeoffRollIndex??1)+1:p.route.length;const points=[p.position,...p.route.slice(p.routeIndex??1,last)];return points.slice(1).map((q,i)=>[points[i],q]);}
function obstacles(game:GameState,p:Aircraft):Obstacle[]{return [
 ...game.aircraft.filter(q=>q.id!==p.id&&onGround(q)).map(q=>({a:q.position!,b:q.position!,radius:groundGap(p,q),name:q.callsign})),
 ...terminalBlocks(game.difficulty!).map(t=>({a:t.center,b:t.center,radius:Math.hypot(t.width,t.height)/2+groundRadius(p)+feetToUnits(30),name:t.name})),
 ...airports[game.difficulty!].runways.flatMap((r,i)=>p.taxiCrossings?.includes(i)?[]:i===p.runway&&(p.status==='takeoff'||p.kind==='arrival'&&pointSegmentDistance(p.position!,r.start,r.end)<feetToUnits(100)+groundRadius(p))?[]:[{a:r.start,b:r.end,radius:feetToUnits(100)+groundRadius(p),name:`Runway ${i+1}`}])
 ];}
function clearEdge(a:Point,b:Point,list:Obstacle[],origin:Point){return list.every(o=>pointSegmentDistance(origin,o.a,o.b)<o.radius&&distance(a,origin)<.001?pointSegmentDistance(b,o.a,o.b)>=o.radius:segmentDistance(a,b,o.a,o.b)>=o.radius-.0001);}
export function routeSafe(game:GameState,p:Aircraft,points:Point[]){const list=obstacles(game,p);if(!points.slice(1).every((q,i)=>clearEdge(points[i],q,list,points[0])))return false;const own=p.runway===undefined?undefined:airports[game.difficulty!].runways[p.runway];if(own&&p.kind==='arrival'){const width=feetToUnits(100)+groundRadius(p);let exited=pointSegmentDistance(points[0],own.start,own.end)>=width;for(let i=1;i<points.length;i++){if(exited&&segmentDistance(points[i-1],points[i],own.start,own.end)<width-.0001)return false;if(pointSegmentDistance(points[i],own.start,own.end)>=width)exited=true;}}return true;}
export function planGroundRoute(game:GameState,p:Aircraft,requested:Point[]):Point[]|undefined{
 const origin=p.position!,end=requested.at(-1)!,list=obstacles(game,p),radius=feetToUnits(minimumTurnFeet[p.aircraftType??'narrowbody']);
 if(list.some(o=>pointSegmentDistance(end,o.a,o.b)<o.radius&&distance(origin,end)>.001))return undefined;
 const smooth=(points:Point[])=>curvedRoute(points,radius).points;
 const finish=(raw:Point[])=>{
  const path=smooth(raw);if(!routeSafe(game,p,path))return undefined;
  if((p.groundSpeed??0)>flightProfiles[p.aircraftType??'narrowbody'].taxi)return path;
  const travelHeading=(p.heading??0)+(p.status==='pushback'?180:0);
  const next=path[1];if(!next)return path;
  const initialHeading=Math.atan2(next[0]-origin[0],-(next[1]-origin[1]))*180/Math.PI;
  if(Math.abs(shortestAngle(travelHeading,initialHeading))<1&&smoothCorners(path))return path;
  const targets=path.map((q,i)=>({q,i})).filter(({q,i})=>i>0&&distance(origin,q)>=radius*3);const chosen=targets.filter((_,i)=>i===targets.length-1||i%Math.max(1,Math.ceil(targets.length/16))===0);
  let best:Point[]|undefined;
  for(const {q,i}of chosen){const after=path[i+1],before=path[i-1],endHeading=after?Math.atan2(after[0]-q[0],-(after[1]-q[1]))*180/Math.PI:Math.atan2(q[0]-before[0],-(q[1]-before[1]))*180/Math.PI;
   for(const curve of poseCurves(origin,travelHeading,q,endHeading,radius)){const joined=[...curve,...path.slice(i+1)];if(smoothCorners(joined)&&routeSafe(game,p,joined)&&(!best||routeLength(joined)<routeLength(best)))best=joined;}}
  return best;
 };
 const initial=finish(requested);if(initial)return initial;
 // A gate/hold point has no mandated final heading. Search approach headings
 // before rejecting it merely because the shortest polyline cannot be curved.
 const travelHeading=(p.heading??0)+(p.status==='pushback'?180:0);
 if(p.status!=='pushback'&&distance(origin,end)>.001){
  const direct=Array.from({length:8},(_,i)=>poseCurves(origin,travelHeading,end,i*45,radius)).flat().sort((a,b)=>routeLength(a)-routeLength(b));
  for(const path of direct)if(smoothCorners(path)&&routeSafe(game,p,path))return path;
 }


 // Visibility graph over the schematic centerline and marked bypass connectors.
 // Reserve the complete traversal atomically before leaving a safe holding point.
 // Dense sampled arcs are not visibility-graph nodes: preserve at most 64 connectors.
 const coarse=requested.filter((q,i)=>i===0||i===requested.length-1||distance(q,requested[Math.max(0,i-1)])>=3);
 const connectors=coarse.slice(1,-1).filter((_,i,points)=>i%Math.max(1,Math.ceil(points.length/64))===0);
 const nodes:Point[]=[origin,end,...connectors];
 for(const o of list){const padding=o.radius+radius*3+feetToUnits(25);for(const c of [o.a,o.b])for(let i=0;i<8;i++){const h=i*Math.PI/4;nodes.push([c[0]+Math.cos(h)*padding/Math.cos(Math.PI/8),c[1]+Math.sin(h)*padding/Math.cos(Math.PI/8)]);}}
 const costs=nodes.map(()=>Infinity),prev=nodes.map(()=>-1),done=new Set<number>();costs[0]=0;
 for(let step=0;step<nodes.length;step++){let best=-1;for(let i=0;i<nodes.length;i++)if(!done.has(i)&&(best<0||costs[i]<costs[best]))best=i;if(best<0||!Number.isFinite(costs[best]))break;if(best===1){const path:Point[]=[];for(let i=1;i>=0;i=prev[i]){path.unshift(nodes[i]);if(i===0)break;}return finish(path);}done.add(best);for(let j=0;j<nodes.length;j++)if(!done.has(j)&&clearEdge(nodes[best],nodes[j],list,origin)){const cost=costs[best]+distance(nodes[best],nodes[j]);if(cost<costs[j]){costs[j]=cost;prev[j]=best;}}}
 return undefined;
}
export function movingGround(p:Aircraft){return onGround(p)&&!!p.route&&p.remaining>0&&(['taxi-in','taxi-out','pushback','takeoff','landing'].includes(p.status));}
function conflicting(a:Aircraft,b:Aircraft){const gap=groundGap(a,b);return segments(a).some(([x,y])=>segments(b).some(([u,v])=>segmentDistance(x,y,u,v)<gap));}
function resourceIds(p:Aircraft){
 const cells=new Set<string>(),size=feetToUnits(300),padding=groundRadius(p)+feetToUnits(25);
 for(const [a,b]of segments(p)){const count=Math.max(1,Math.ceil(distance(a,b)/5));for(let i=0;i<=count;i++){const x=a[0]+(b[0]-a[0])*i/count,y=a[1]+(b[1]-a[1])*i/count;for(let cx=Math.floor((x-padding)/size);cx<=Math.floor((x+padding)/size);cx++)for(let cy=Math.floor((y-padding)/size);cy<=Math.floor((y+padding)/size);cy++)cells.add(`SURFACE:${cx}:${cy}`);}}
 return [...cells];
}
function wait(p:Aircraft,reason:string,game:GameState,emit:(s:string)=>void){if(p.groundHold?.reason!==reason){emit(`${p.callsign}, hold short. ${reason}`);p.revision++;}p.groundHold={reason,since:p.groundHold?.since??game.elapsed,marker:[...p.position!]};}
function tryYield(game:GameState,p:Aircraft,emit:(s:string)=>void){
 const radius=feetToUnits(minimumTurnFeet[p.aircraftType??'narrowbody']),h=(p.heading??90)*Math.PI/180,from=p.position!;
 for(const side of [-1,1])for(const forward of [0,3,-3]){
  const offset=Math.max(radius*6,feetToUnits(600));const goal:Point=[from[0]+Math.sin(h)*radius*forward+Math.cos(h)*offset*side,from[1]-Math.cos(h)*radius*forward+Math.sin(h)*offset*side];
  const destination=p.route!.at(-1)!,endHeading=Math.atan2(destination[0]-goal[0],-(destination[1]-goal[1]))*180/Math.PI;
  const plan=poseCurves(from,p.heading??90,goal,endHeading,radius).find(path=>routeSafe(game,p,path));if(!plan)continue;
  const trial={...p,route:curvedRoute(plan,radius).points,routeIndex:1};
  if(game.aircraft.some(q=>q!==p&&q.groundReserved&&conflicting(trial,q)))continue;
  p.groundResumeRoute=p.route!.slice(p.routeIndex??1);setRoute(p,plan);p.groundBypass=true;p.groundReserved=false;p.groundHold=undefined;p.revision++;emit(`${p.callsign}, head-on / blocked-route conflict resolved: taxi to marked schematic holding bay, then rejoin. No position reset.`);return true;
 }
 return false;
}
export function prepareGround(game:GameState,emit:(s:string)=>void){
 for(const p of game.aircraft.filter(p=>p.groundAtBay&&p.groundResumeRoute)){
  if(game.elapsed-(p.groundRetryAt??-Infinity)<5)continue;p.groundRetryAt=game.elapsed;
  const plan=planGroundRoute(game,p,[p.position!,...p.groundResumeRoute!]);if(!plan)continue;
  const radius=feetToUnits(minimumTurnFeet[p.aircraftType??'narrowbody']),trial={...p,route:curvedRoute(plan,radius).points,routeIndex:1};
  if(game.aircraft.some(q=>q!==p&&q.groundReserved&&conflicting(trial,q)))continue;
  setRoute(p,plan);p.groundAtBay=false;p.groundResumeRoute=undefined;p.revision++;emit(`${p.callsign}, holding bay clear, rejoin the reserved taxi route.`);
 }

 const moving=game.aircraft.filter(movingGround);for(const p of game.aircraft)if(!moving.includes(p)){p.groundReserved=false;p.groundResources=undefined;if(!p.groundAtBay)p.groundHold=undefined;}
 // Existing owner first, then runway-vacating traffic, emergency, oldest request, ID.
 moving.sort((a,b)=>Number(!!b.groundReserved)-Number(!!a.groundReserved)||Number(b.status==='taxi-in')-Number(a.status==='taxi-in')||Number(!!b.emergency)-Number(!!a.emergency)||(a.groundRequestedAt??0)-(b.groundRequestedAt??0)||a.id.localeCompare(b.id,undefined,{numeric:true}));
 const owners:Aircraft[]=[];const claimed=new Map<string,Aircraft>();
 for(const p of moving){p.groundRequestedAt??=game.elapsed;const requested=resourceIds(p);const occupied=owners.find(q=>conflicting(p,q))??requested.map(id=>claimed.get(id)).find(Boolean);if(occupied){p.groundReserved=false;p.groundResources=undefined;wait(p,`Taxi segment / intersection reserved by ${occupied.callsign}.`,game,emit);continue;}
  const staticBlock=game.aircraft.find(q=>q.id!==p.id&&onGround(q)&&segments(p).some(([a,b])=>pointSegmentDistance(q.position!,a,b)<groundGap(p,q)));
  if(staticBlock&&!['takeoff','landing'].includes(p.status)){
   if((p.groundSpeed??0)<.1&&game.elapsed-(p.groundRetryAt??-Infinity)>=5){p.groundRetryAt=game.elapsed;const planned=planGroundRoute(game,p,[p.position!,...p.route!.slice(p.routeIndex??1)]);if(planned){setRoute(p,planned);p.groundBypass=true;p.revision++;emit(`${p.callsign}, traffic conflict resolved via marked schematic bypass; yielding to ${staticBlock.callsign}.`);}}
   if(segments(p).some(([a,b])=>pointSegmentDistance(staticBlock.position!,a,b)<groundGap(p,staticBlock))){p.groundReserved=false;if(!p.groundResumeRoute&&(p.groundSpeed??0)<.1&&game.elapsed-(p.groundHold?.since??game.elapsed)>=10&&moving.includes(staticBlock)&&p.id.localeCompare(staticBlock.id,undefined,{numeric:true})>0&&tryYield(game,p,emit))continue;wait(p,`Traffic ahead: ${staticBlock.callsign}. Waiting for a clear bypass.`,game,emit);continue;}
  }
  if(['taxi-in','taxi-out','pushback'].includes(p.status)&&!routeSafe(game,p,[p.position!,...p.route!.slice(p.routeIndex??1)])){
   if((p.groundSpeed??0)<.1&&game.elapsed-(p.groundRetryAt??-Infinity)>=5){p.groundRetryAt=game.elapsed;const planned=planGroundRoute(game,p,[p.position!,...p.route!.slice(p.routeIndex??1)]);if(planned){setRoute(p,planned);p.groundBypass=true;p.revision++;emit(`${p.callsign}, unsafe connector replaced by a marked schematic bypass.`);}}
   if(!routeSafe(game,p,[p.position!,...p.route!.slice(p.routeIndex??1)])){p.groundReserved=false;wait(p,'Waiting for a safe connector around traffic, buildings or runways.',game,emit);continue;}
  }
  // Any incidental runway crossing is protected by the same lease as the taxi path.
  const crossing=airports[game.difficulty!].runways.findIndex((r,i)=>i!==p.runway&&runwaySegments(p).some(([a,b])=>segmentDistance(a,b,r.start,r.end)<feetToUnits(100)+groundRadius(p)));
  p.groundRunways=airports[game.difficulty!].runways.flatMap((r,i)=>runwaySegments(p).some(([a,b])=>segmentDistance(a,b,r.start,r.end)<feetToUnits(100)+groundRadius(p))?[i]:[]);
  if(crossing>=0&&!['takeoff','landing'].includes(p.status)){
   const crossings=p.groundRunways.filter(i=>i!==p.runway);
   const undeclared=crossings.some(i=>!p.taxiCrossings?.includes(i));
   const blocked=crossings.find(i=>runwayBlockers(game,i).some(q=>q.id!==p.id&&(owners.includes(q)||!moving.includes(q)||q.status==='landing'||q.status==='takeoff'))||game.aircraft.some(q=>q!==p&&q.onFinal&&(q.runway??q.approachRunway)===i));
   if(undeclared||blocked!==undefined){p.groundReserved=false;p.groundResources=undefined;wait(p,undeclared?'Taxi route crosses an unassigned runway; awaiting a safe route.':`Runway crossing ${blocked!+1} waiting for cleared traffic to vacate.`,game,emit);continue;}
  }
  p.groundReserved=true;p.groundResources=resourceIds(p);for(const id of p.groundResources)claimed.set(id,p);if(p.groundHold){emit(`${p.callsign}, taxi traffic clear, continue.`);p.revision++;p.groundHold=undefined;}owners.push(p);
 }
 game.groundReservations=owners.map(p=>{const intersections=moving.filter(q=>q!==p&&conflicting(p,q)).map(q=>`JUNCTION:${[p.id,q.id].sort().join(':')}`);p.groundResources=[...resourceIds(p),...intersections];return {aircraftId:p.id,resources:p.groundResources,intersections};});
}
export function advanceGround(game:GameState,p:Aircraft,dt:number,emit:(s:string)=>void){
 if(!movingGround(p))return advanceMotion(p,dt);
 const before=p.position!,speed=p.groundSpeed??0,profile=flightProfiles[p.aircraftType??'narrowbody'];
 const originalCap=p.groundSpeedLimit;
 // Atomic route acquisition removes cycles: no aircraft owns one conflict area
 // while waiting for another. Waiting planes retain their position / stand.
 p.groundSpeedLimit=p.groundReserved?undefined:0;
 const result={...p,position:[...before] as Point};const arrived=advanceMotion(result,dt);
 const blocker=game.aircraft.find(q=>q.id!==p.id&&onGround(q)&&segmentDistance(before,result.position!,q.position!,q.position!)<groundGap(p,q)-1e-6);
 if(blocker){p.groundSpeed=Math.max(0,speed-profile.brake*dt);wait(p,`Traffic ahead: ${blocker.callsign}.`,game,emit);p.groundSpeedLimit=originalCap;return false;}
 if(!p.groundReserved&&speed<.05){p.groundSpeed=0;p.groundSpeedLimit=originalCap;return false;}
 Object.assign(p,result);p.groundSpeedLimit=originalCap;
 if(arrived){p.groundReserved=false;p.groundResources=undefined;}
 if(arrived&&p.groundResumeRoute){p.groundAtBay=true;p.groundReserved=false;p.groundResources=undefined;p.route=undefined;p.groundSpeed=0;p.remaining=1;wait(p,'Waiting in marked holding bay for traffic to pass.',game,emit);return false;}
 if(p.status==='pushback')p.remaining=arrived?0:Math.max(1,Math.ceil(remainingDistance(p)/knotsToUnitsPerSecond(3)));
 return arrived;
}
