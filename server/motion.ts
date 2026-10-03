import type {Aircraft,AircraftType} from '../src/protocol.js';
import type {Point} from '../src/airports.js';
export const flightProfiles:Record<AircraftType,{approach:number;taxi:number;turnTaxi:number;turnRate:number;brake:number;acceleration:number}>={light:{approach:70,taxi:18,turnTaxi:8,turnRate:25,brake:9,acceleration:5},regional:{approach:130,taxi:18,turnTaxi:8,turnRate:20,brake:10,acceleration:6},narrowbody:{approach:140,taxi:18,turnTaxi:7,turnRate:18,brake:10,acceleration:6},heavy:{approach:150,taxi:16,turnTaxi:6,turnRate:12,brake:8,acceleration:5}};
export function shortestAngle(from:number,to:number){return ((to-from+180)%360+360)%360-180;}
export function limitedHeading(current:number,target:number,rate:number,dt:number){return current+Math.max(-rate*dt,Math.min(rate*dt,shortestAngle(current,target)));}
export function headingFromVelocity(current:number,dx:number,dy:number,rate:number,dt:number){return Math.hypot(dx,dy)<.001?current:limitedHeading(current,Math.atan2(dx,-dy)*180/Math.PI,rate,dt);}
const distance=(a:Point,b:Point)=>Math.hypot(b[0]-a[0],b[1]-a[1]);
export function routeLength(points:Point[]){return points.slice(1).reduce((sum,p,i)=>sum+distance(points[i],p),0);}
export function setRoute(p:Aircraft,points:Point[],scale:number){
 // Every new route begins at the current position, including wind changes and holds.
 const from=p.position??points[0];p.route=[from,...points.slice(1)].filter((point,i,list)=>i===0||distance(point,list[i-1])>.001);p.routeIndex=1;p.routeProgress=0;
 const profile=flightProfiles[p.aircraftType??'narrowbody'];p.remaining=Math.max(1,Math.ceil(routeLength(p.route)*scale*3600/(p.status.startsWith('taxi')?profile.taxi:profile.approach)));p.routeDuration=p.remaining;
}
export function remainingDistance(p:Aircraft){if(!p.route||!p.position)return 0;const index=p.routeIndex??1;return (p.route[index]?distance(p.position,p.route[index]):0)+p.route.slice(index+1).reduce((n,b,i)=>n+distance(p.route![index+i],b),0);}
export function advanceMotion(p:Aircraft,dt:number,scale:number):boolean{
 const profile=flightProfiles[p.aircraftType??'narrowbody'];const oldSpeed=p.groundSpeed??0;const before=p.position;if(!before||!p.route||p.route.length<2)return true;
 let index=p.routeIndex??1;while(index<p.route.length&&distance(before,p.route[index])<.001)index++;p.routeIndex=index;
 const left=remainingDistance(p);const ground=p.status.startsWith('taxi')||p.status==='queued'||p.status==='gate'||(p.status==='landing'&&!p.onFinal);
 let target=p.status==='takeoff'&&index<(p.takeoffRollIndex??1)?profile.taxi:p.status.startsWith('taxi')?profile.taxi:p.status==='landing'&&!p.onFinal?0:p.status==='takeoff'?profile.approach+25:profile.approach;
 let rate=ground?3:2;
 if(p.status==='landing'&&!p.onFinal)rate=profile.brake;
 if(p.status==='takeoff')rate=index<(p.takeoffRollIndex??1)?3:profile.acceleration;
 const stopping=oldSpeed*oldSpeed/(2*4*3600*scale);
 if(p.status.startsWith('taxi')){
  if(left<=stopping+.005){target=0;rate=4;}
  else if(index<p.route.length-1){const a=p.route[index],b=p.route[index+1];const desired=Math.atan2(b[0]-a[0],-(b[1]-a[1]))*180/Math.PI;if(distance(before,a)<=stopping+6&&Math.abs(shortestAngle(p.heading??desired,desired))>20){target=profile.turnTaxi;rate=4;}}
 }
 p.groundSpeed=Math.max(0,oldSpeed+Math.max(-rate*dt,Math.min(rate*dt,target-oldSpeed)));
 let travel=(oldSpeed+p.groundSpeed)/2*dt/(3600*scale);let pos:Point=[...before];
 while(travel>0&&index<p.route.length){const next=p.route[index],d=distance(pos,next);if(d<.001){index++;continue;}if(travel>=d){pos=[...next];travel-=d;index++;}else{pos=[pos[0]+(next[0]-pos[0])*travel/d,pos[1]+(next[1]-pos[1])*travel/d];travel=0;}}
 p.position=pos;p.routeIndex=index;
 p.heading=headingFromVelocity(p.heading??0,pos[0]-before[0],pos[1]-before[1],ground?profile.turnRate:p.aircraftType==='light'?6:3,dt);
 const remaining=remainingDistance(p);
 let altitudeTarget=p.altitude??0;
 if(p.onFinal)altitudeTarget=remaining*scale*318; // approximately a three-degree glidepath, AGL feet
 else if(p.status==='approach')altitudeTarget=(remaining+15)*scale*318;
 else if(p.status==='takeoff')altitudeTarget=index>=(p.takeoffRollIndex??1)&&p.groundSpeed>=profile.approach*.85?Math.min(1500,(p.altitude??0)+15*dt):0;
 else if(p.status==='go-around')altitudeTarget=Math.min(1200,(p.altitude??0)+15*dt);
 else if(ground)altitudeTarget=0;
 p.altitude=Math.max(0,(p.altitude??0)+Math.max(-20*dt,Math.min(15*dt,altitudeTarget-(p.altitude??0))));
 const arrived=index>=p.route.length;
 p.remaining=arrived?0:Math.max(1,Math.ceil(remaining*scale*3600/Math.max(p.groundSpeed,ground?profile.taxi:profile.approach)));
 // Taxi braking can stop just short of a waypoint; crawl to it continuously, without snapping.
 if(!arrived&&p.groundSpeed<.05&&ground&&p.status.startsWith('taxi'))p.groundSpeed=Math.min(profile.turnTaxi,.01);
 return arrived;
}
