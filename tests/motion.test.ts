import {test} from 'node:test';
import assert from 'node:assert/strict';
import {shortestAngle,limitedHeading,headingFromVelocity,flightProfiles,setRoute,advanceMotion} from '../server/motion.js';
import {createGame,command,tickGame} from '../server/game.js';
import {airports} from '../src/airports.js';
import type {AircraftType} from '../src/protocol.js';
test('heading takes the short path across north and obeys turn rate in both directions',()=>{
 assert.equal(shortestAngle(359,1),2);assert.equal(shortestAngle(1,359),-2);assert.equal(limitedHeading(359,1,3,1),361);assert.equal(limitedHeading(1,359,3,1),-1);assert.equal(limitedHeading(90,270,3,.1),89.7);assert.equal(headingFromVelocity(137,0,0,3,1),137);assert.equal(headingFromVelocity(137,1e-6,1e-6,3,1),137);
});
test('every type has appropriate final speed and bounded continuous position/altitude',()=>{
 const limits={light:[60,80],regional:[125,150],narrowbody:[125,150],heavy:[145,165]};
 for(const type of Object.keys(limits) as AircraftType[]){const g=createGame(2,'medium'),p=g.aircraft[0],profile=flightProfiles[type];p.aircraftType=type;p.groundSpeed=profile.approach;p.heading=359;p.altitude=100;const [min,max]=limits[type];assert.ok(profile.approach>=min&&profile.approach<=max);const start=p.position!;p.status='landing';p.onFinal=true;setRoute(p,[start,[start[0]+80,start[1]]],airports.medium.nmPerUnit);
 for(let i=0;i<30;i++){const before=[...p.position!],speed=p.groundSpeed!,heading=p.heading!,alt=p.altitude!;advanceMotion(p,.1,airports.medium.nmPerUnit);assert.ok(Math.abs(p.groundSpeed!-speed)<=.201);assert.ok(Math.abs(p.heading!-heading)<=.601);assert.ok(Math.abs(p.altitude!-alt)<=2.001);assert.ok(Math.hypot(p.position![0]-before[0],p.position![1]-before[1])<=(max*.1/(3600*airports.medium.nmPerUnit))+.01);}
 }
});
test('taxi accelerates continuously, stays below type limit and slows for a corner',()=>{
 const g=createGame(2,'medium'),p=g.aircraft[1];p.status='taxi-out';p.position=[0,0];p.heading=90;p.groundSpeed=0;setRoute(p,[[0,0],[18,0],[18,35]],.002);const speeds:number[]=[];
 for(let i=0;i<200;i++){const old=p.groundSpeed!;advanceMotion(p,.1,.002);speeds.push(p.groundSpeed!);assert.ok(p.groundSpeed!<=18.001);assert.ok(Math.abs(p.groundSpeed!-old)<=.401);}
 assert.ok(Math.max(...speeds)>15);assert.ok(speeds.some((s,i)=>i>50&&s<9));
});
test('touchdown decelerates without jumps and switching routes preserves position',()=>{
 const g=createGame(2,'medium'),p=g.aircraft[0];g.aircraft=[p];g.nextWave=g.nextEmergency=g.nextWeather=g.nextWind=999;command(g,p.id,'land',0,0,'Tower');let touchdown=false,last=p.groundSpeed!;
 for(let i=0;i<400&&p.remaining>0;i++){const before=p.groundSpeed!;tickGame(g,1,()=>{});if(p.status==='landing'&&!p.onFinal){touchdown=true;assert.ok(p.groundSpeed!<=before+.01);assert.ok(before-p.groundSpeed!<=flightProfiles.narrowbody.brake+1);last=p.groundSpeed!;}}
 assert.ok(touchdown);assert.ok(last<20);const before=[...p.position!];command(g,p.id,'taxi',0,p.revision,'Tower');assert.deepEqual(p.position,before);
});
test('entering hold and a wind reroute do not teleport an aircraft',()=>{
 const g=createGame(2,'medium'),p=g.aircraft[0];const from=[...p.position!];command(g,p.id,'hold',0,0,'Tower');tickGame(g,1,()=>{});assert.ok(Math.hypot(p.position![0]-from[0],p.position![1]-from[1])<20);
 const wind=createGame(2,'medium'),a=wind.aircraft[0];wind.nextWind=1;const pos=[...a.position!];tickGame(wind,1,()=>{});assert.equal(wind.direction,1);assert.ok(Math.hypot(a.position![0]-pos[0],a.position![1]-pos[1])<20);
});
