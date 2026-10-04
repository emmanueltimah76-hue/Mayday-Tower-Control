import {airspace,boundaryPoint} from '../src/routes.js';
import {NM_PER_MAP_UNIT,FEET_PER_NM,SECONDS_PER_HOUR,MOTION_STEP_SECONDS} from '../src/mapConstants.js';
import type {Aircraft,AircraftType} from '../src/protocol.js';
import type {Point} from '../src/airports.js';
export const flightProfiles:Record<AircraftType,{approach:number;taxi:number;turnTaxi:number;turnRate:number;brake:number;acceleration:number}>={light:{approach:70,taxi:18,turnTaxi:8,turnRate:25,brake:9,acceleration:5},regional:{approach:130,taxi:18,turnTaxi:8,turnRate:20,brake:10,acceleration:6},narrowbody:{approach:140,taxi:18,turnTaxi:7,turnRate:18,brake:10,acceleration:6},heavy:{approach:150,taxi:16,turnTaxi:6,turnRate:12,brake:8,acceleration:5}};
export function shortestAngle(from:number,to:number){return ((to-from+180)%360+360)%360-180;}
export function limitedHeading(current:number,target:number,rate:number,dt:number){return current+Math.max(-rate*dt,Math.min(rate*dt,shortestAngle(current,target)));}
export function headingFromVelocity(current:number,dx:number,dy:number,rate:number,dt:number){return Math.hypot(dx,dy)<.001?current:limitedHeading(current,Math.atan2(dx,-dy)*180/Math.PI,rate,dt);}
const distance=(a:Point,b:Point)=>Math.hypot(b[0]-a[0],b[1]-a[1]);
export function routeLength(points:Point[]){return points.slice(1).reduce((sum,p,i)=>sum+distance(points[i],p),0);}
export const minimumTurnFeet:Record<AircraftType,number>={light:60,regional:100,narrowbody:150,heavy:220};
export function curvedRoute(points:Point[],radius:number):{points:Point[];turns:number[]}{
 // Collapse an over-short connector before filleting; the schematic centerline follows the resulting path.
 points=[...points];for(let pass=0;pass<points.length;pass++){let changed=false;for(let i=1;i<points.length-1;i++){const a=points[i-1],b=points[i],c=points[i+1],ab=distance(a,b),bc=distance(b,c);const dot=((b[0]-a[0])*(c[0]-b[0])+(b[1]-a[1])*(c[1]-b[1]))/(ab*bc||1),angle=Math.acos(Math.max(-1,Math.min(1,dot)));if(angle>.05&&(angle>Math.PI-.05||radius*Math.tan(angle/2)>Math.min(ab,bc)*.45)){points.splice(i,1);changed=true;break;}}if(!changed)break;}
 const output:Point[]=[points[0]],turns:number[]=[];
 for(let i=1;i<points.length-1;i++){
  const a=points[i-1],b=points[i],c=points[i+1],ab=distance(a,b),bc=distance(b,c);if(ab<.01||bc<.01)continue;
  const u:Point=[(b[0]-a[0])/ab,(b[1]-a[1])/ab],v:Point=[(c[0]-b[0])/bc,(c[1]-b[1])/bc],angle=Math.acos(Math.max(-1,Math.min(1,u[0]*v[0]+u[1]*v[1])));
  if(angle<.05||angle>Math.PI-.05){if(angle>.001&&angle<.05)turns.push(output.length);output.push(b);continue;}
  const tangent=radius*Math.tan(angle/2);
  // A corner too short for the type radius is left for explicit route validation, rather than pivoting.
  if(tangent>Math.min(ab,bc)*.45){output.push(b);continue;}
  const entry:Point=[b[0]-u[0]*tangent,b[1]-u[1]*tangent],exit:Point=[b[0]+v[0]*tangent,b[1]+v[1]*tangent];const side=Math.sign(u[0]*v[1]-u[1]*v[0]);const center:Point=[entry[0]-u[1]*radius*side,entry[1]+u[0]*radius*side];const begin=Math.atan2(entry[1]-center[1],entry[0]-center[0]);output.push(entry);const steps=Math.max(3,Math.ceil(angle/(Math.PI/360)));for(let k=1;k<=steps;k++){turns.push(output.length);output.push(k===steps?exit:[center[0]+Math.cos(begin+side*angle*k/steps)*radius,center[1]+Math.sin(begin+side*angle*k/steps)*radius]);}
 }
 output.push(points.at(-1)!);return {points:output,turns};
}
export function setRoute(p:Aircraft,points:Point[],scale=NM_PER_MAP_UNIT){
 // Every new route begins at the current position, including wind changes and holds.
 const from=p.position??points[0];p.route=[from,...points.slice(1)].filter((point,i,list)=>i===0||distance(point,list[i-1])>.001);if(p.status.startsWith('taxi')||p.status==='takeoff'||p.status==='pushback'){
 const roll=p.takeoffRollIndex??1,prefix=p.status==='takeoff'?p.route.slice(0,roll+1):p.route;
 const smooth=curvedRoute(prefix,minimumTurnFeet[p.aircraftType??'narrowbody']/FEET_PER_NM/scale);
 p.route=p.status==='takeoff'?[...smooth.points,...p.route.slice(roll+1)]:smooth.points;p.routeTurns=smooth.turns;
 if(p.status==='takeoff')p.takeoffRollIndex=smooth.points.length-1;
 }else p.routeTurns=undefined;p.routeIndex=1;p.routeProgress=0;
 const profile=flightProfiles[p.aircraftType??'narrowbody'];p.remaining=Math.max(1,Math.ceil(routeLength(p.route)*scale*SECONDS_PER_HOUR/(p.status.startsWith('taxi')?profile.taxi:profile.approach)));p.routeDuration=p.remaining;
}
const lengths=new WeakMap<Point[],{length:number;suffix:number[]}>();
export function remainingDistance(p:Aircraft){if(!p.route||!p.position)return 0;const index=p.routeIndex??1;let cached=lengths.get(p.route);if(!cached||cached.length!==p.route.length){const suffix=Array(p.route.length).fill(0);for(let i=p.route.length-2;i>=0;i--)suffix[i]=suffix[i+1]+distance(p.route[i],p.route[i+1]);cached={length:p.route.length,suffix};lengths.set(p.route,cached);}return p.route[index]?distance(p.position,p.route[index])+(cached.suffix[index]??0):0;}
export function advanceMotion(p:Aircraft,dt:number,scale=NM_PER_MAP_UNIT):boolean{
 if(!Number.isFinite(dt)||dt<=0)return false;let left=Math.min(dt,1),arrived=false;
 while(left>1e-8&&!arrived){const step=Math.min(left,MOTION_STEP_SECONDS);arrived=advanceStep(p,step,scale);left-=step;}return arrived;
}
function advanceStep(p:Aircraft,dt:number,scale:number):boolean{
 const profile=flightProfiles[p.aircraftType??'narrowbody'];const oldSpeed=p.groundSpeed??0;const before=p.position;if(!before||!p.route||p.route.length<2)return true;
 let index=p.routeIndex??1;while(index<p.route.length&&distance(before,p.route[index])<.001)index++;p.routeIndex=index;
 const left=remainingDistance(p);const ground=(p.status==='takeoff'&&(index<(p.takeoffRollIndex??1)||((p.altitude??0)<1&&oldSpeed<profile.approach*.85)))||p.status.startsWith('taxi')||p.status==='queued'||p.status==='gate'||p.status==='pushback'||(p.status==='landing'&&!p.onFinal);
 let target=p.status==='takeoff'&&index<(p.takeoffRollIndex??1)?profile.taxi:p.status.startsWith('taxi')?profile.taxi:p.status==='landing'&&!p.onFinal?(p.landingPhase==='exit'?profile.turnTaxi:0):p.status==='takeoff'?profile.approach+25:profile.approach;
 if(!ground&&p.targetSpeed!==undefined)target=p.targetSpeed;
 if(p.status==='pushback')target=3;
 if(ground&&p.groundSpeedLimit!==undefined)target=Math.min(target,p.groundSpeedLimit);
 let rate=ground?3:2;
 if(p.status==='landing'&&!p.onFinal)rate=p.landingPhase==='exit'?4:profile.brake;
 if(p.status==='takeoff')rate=index<(p.takeoffRollIndex??1)?3:profile.acceleration;
 const stopping=oldSpeed*oldSpeed/(2*4*SECONDS_PER_HOUR*scale);
 if(p.status.startsWith('taxi')||(p.status==='takeoff'&&index<(p.takeoffRollIndex??1))){
  if(p.routeTurns?.includes(index)&&distance(p.route[index-1]??before,p.route[index])<=minimumTurnFeet[p.aircraftType??'narrowbody']/FEET_PER_NM/scale*.25||(p.routeTurns?.some(k=>k>=index&&k<=index+3)&&distance(before,p.route[index])<=stopping+6)){target=profile.turnTaxi;rate=4;}
  if(left<=stopping+.005){target=0;rate=4;}
  else if(index<p.route.length-1){const a=p.route[index],b=p.route[index+1];const desired=Math.atan2(b[0]-a[0],-(b[1]-a[1]))*180/Math.PI;if(distance(before,a)<=stopping+6&&Math.abs(shortestAngle(p.heading??desired,desired))>20){target=profile.turnTaxi;rate=4;}}
 }
 if(ground&&p.groundSpeedLimit!==undefined){target=Math.min(target,p.groundSpeedLimit);rate=4;}
 p.groundSpeed=Math.max(0,oldSpeed+Math.max(-rate*dt,Math.min(rate*dt,target-oldSpeed)));
 const travel=(oldSpeed+p.groundSpeed)/2*dt/(SECONDS_PER_HOUR*scale);
 let pos:Point=[...before];
 if(ground){
  const next=p.route[index];if(next&&travel>0){
   const bearing=Math.atan2(next[0]-before[0],-(next[1]-before[1]))*180/Math.PI;
   const reverse=p.status==='pushback'?180:0;
   p.heading=limitedHeading(p.heading??bearing+reverse,bearing+reverse,profile.turnRate,dt);
   const h=(p.heading-reverse)*Math.PI/180;
   // Integrate along the stored nose (pushback is the explicit reverse exception).
   const dx=next[0]-before[0],dy=next[1]-before[1],forward=dx*Math.sin(h)-dy*Math.cos(h),cross=Math.abs(dx*Math.cos(h)+dy*Math.sin(h));
   const moved=index===p.route.length-1&&forward>=0&&cross<.002?Math.min(travel,forward):travel;
   pos=[before[0]+Math.sin(h)*moved,before[1]-Math.cos(h)*moved];
   // Cross the waypoint plane without snapping to a point or pivoting in place.
   const capture=Math.max(.025,travel*.4);
   while(index<p.route.length){const q=p.route[index],a=p.route[index-1],vx=q[0]-a[0],vy=q[1]-a[1],len=Math.hypot(vx,vy);if(len<.001){index++;continue;}const passed=(pos[0]-q[0])*vx+(pos[1]-q[1])*vy>=-1e-8,lateral=Math.abs((pos[0]-q[0])*vy-(pos[1]-q[1])*vx)/len;
    if(passed&&lateral<capture||distance(pos,q)<.002){index++;}else break;
   }
  }
 }else{
  let next=p.route[index];
  if(next){
   const radius=(p.groundSpeed??0)/(SECONDS_PER_HOUR*scale)/((p.aircraftType==='light'?6:3)*Math.PI/180);
   const bearing=Math.atan2(next[0]-before[0],-(next[1]-before[1]))*180/Math.PI;
   // A target inside the turn circle cannot be reached by pursuit. Fly forward
   // to make turning space instead of orbiting that target forever.
   if(p.targetHeading===undefined&&distance(before,next)<radius*1.1&&Math.abs(shortestAngle(p.heading??bearing,bearing))>60){const h=(p.heading??bearing)*Math.PI/180;p.route.splice(index,0,[before[0]+Math.sin(h)*radius*3,before[1]-Math.cos(h)*radius*3]);next=p.route[index];}
   const desired=p.targetHeading??Math.atan2(next[0]-before[0],-(next[1]-before[1]))*180/Math.PI;
   p.heading=limitedHeading(p.heading??desired,desired,p.aircraftType==='light'?6:3,dt);
   const h=p.heading*Math.PI/180;
   // Capture by crossing the waypoint plane, never by snapping the position to it.
   const dx=next[0]-before[0],dy=next[1]-before[1],forward=dx*Math.sin(h)-dy*Math.cos(h),cross=Math.abs(dx*Math.cos(h)+dy*Math.sin(h));
   const moved=index===p.route.length-1&&forward>=0&&cross<1e-7?Math.min(travel,forward):travel;
   pos=[before[0]+Math.sin(h)*moved,before[1]-Math.cos(h)*moved];

   if(p.status==='takeoff'&&index===p.route.length-1&&(pos[0]<=airspace.left||pos[0]>=airspace.right||pos[1]<=airspace.top||pos[1]>=airspace.bottom)){pos=boundaryPoint(before,pos);index=p.route.length;}
   const course=(p.finalCourse??p.targetHeading??0)*Math.PI/180;
   const stationBefore=dx*Math.sin(course)-dy*Math.cos(course),stationAfter=(next[0]-pos[0])*Math.sin(course)-(next[1]-pos[1])*Math.cos(course);
   if(p.targetHeading!==undefined&&index===p.route.length-1&&stationBefore>=0&&stationAfter<=0)index++;
   else if(forward>=0&&forward<=travel&&cross<=Math.max(.05,travel*.15))index++;
   else if(index<p.route.length-1&&distance(pos,next)<radius*.4)index++;
  }
 }
 if(distance(before,pos)>1e-5)p.travelDirection=Math.atan2(pos[0]-before[0],-(pos[1]-before[1]))*180/Math.PI;
 p.position=pos;p.routeIndex=index;
 const remaining=remainingDistance(p);
 let altitudeTarget=p.altitude??0;
 if(p.onFinal)altitudeTarget=remaining*scale*318; // approximately a three-degree glidepath, AGL feet
 else if(p.status==='approach')altitudeTarget=(remaining+15)*scale*318;
 else if(p.status==='takeoff')altitudeTarget=index>=(p.takeoffRollIndex??1)&&p.groundSpeed>=profile.approach*.85?Math.min(1500,(p.altitude??0)+15*dt):0;
 else if(p.status==='go-around')altitudeTarget=Math.min(1200,(p.altitude??0)+15*dt);
 else if(ground)altitudeTarget=0;
 if(!ground&&p.targetAltitude!==undefined)altitudeTarget=p.targetAltitude;
 const climbRate=p.aircraftType==='light'?10:15;
 p.altitude=Math.max(0,(p.altitude??0)+Math.max(-20*dt,Math.min(climbRate*dt,altitudeTarget-(p.altitude??0))));
 const arrived=index>=p.route.length;
 p.remaining=arrived?0:Math.max(1,Math.ceil(remaining*scale*SECONDS_PER_HOUR/Math.max(p.groundSpeed,ground?profile.taxi:profile.approach)));
 // Taxi braking can stop just short of a waypoint; crawl to it continuously, without snapping.
 if(!arrived&&p.groundSpeed<.05&&ground&&p.status.startsWith('taxi')&&p.groundSpeedLimit!==0)p.groundSpeed=Math.min(profile.turnTaxi,.01);
 return arrived;
}
