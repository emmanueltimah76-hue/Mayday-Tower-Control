import {test} from 'node:test';import assert from 'node:assert/strict';
import {createGame,tickGame,command,runwayBusy} from '../server/game.js';
import {transition,ownsMotionPath} from '../server/stateMachine.js';
import {snapshotGame} from '../server/snapshot.js';
import {shortestAngle,advanceMotion} from '../server/motion.js';
import {runwayEnds} from '../src/airports.js';
import {groundRadius} from '../src/groundGeometry.js';
import {feetToUnits} from '../src/mapConstants.js';
import {Lobby} from '../server/lobby.js';
test('rollout is nose-first and turn-limited from a legal offset touchdown',()=>{
 const g=createGame(6,'medium'),p=g.aircraft[0],[a,b]=runwayEnds(g,0),len=Math.hypot(b[0]-a[0],b[1]-a[1]),u=[(b[0]-a[0])/len,(b[1]-a[1])/len],h=Math.atan2(u[0],-u[1])*180/Math.PI;p.status='landing';p.onFinal=false;p.patternLegs=undefined;p.targetSpeed=p.targetHeading=p.targetAltitude=undefined;p.position=[a[0]+u[0]*.5-u[1]*.7,a[1]+u[1]*.5+u[0]*.7];p.heading=h+7;p.groundSpeed=140;p.route=[p.position,[a[0]+u[0]*70,a[1]+u[1]*70]];p.routeIndex=1;
 for(let i=0;i<10;i++){const before=[...p.position],heading=p.heading;advanceMotion(p,.1);const dx=p.position![0]-before[0],dy=p.position![1]-before[1];assert.ok(Math.abs(shortestAngle(heading,p.heading!))<=1.801);assert.ok(Math.abs(shortestAngle(p.heading!,Math.atan2(dx,-dy)*180/Math.PI))<.001);}
});
test('runway stays owned until the full footprint is clear, then wakes behind a heavy',()=>{
 const g=createGame(2,'medium'),p=g.aircraft[0],[a,b]=runwayEnds(g,0);g.aircraft=[p];p.status='taxi-in';p.onFinal=false;p.runway=0;p.altitude=0;p.aircraftType='heavy';const n=[-(b[1]-a[1])/Math.hypot(b[0]-a[0],b[1]-a[1]),(b[0]-a[0])/Math.hypot(b[0]-a[0],b[1]-a[1])],clear=feetToUnits(100)+groundRadius(p);p.position=[a[0]+20,a[1]+20*n[1]];assert.equal(runwayBusy(g,0),false);p.position=[a[0]+20+n[0]*clear*.9,a[1]+n[1]*clear*.9];assert.equal(runwayBusy(g,0),true);p.position=[a[0]+20+n[0]*clear*1.1,a[1]+n[1]*clear*1.1];assert.equal(runwayBusy(g,0),false);
});
test('missing airborne path is logged and recovered with a valid 1500-foot go-around',()=>{
 const g=createGame(2,'medium'),p=g.aircraft[0];g.aircraft=[p];g.nextWave=g.nextWind=g.nextWeather=g.nextEmergency=999;p.route=undefined;const before=[...p.position!],log:string[]=[];tickGame(g,1,s=>log.push(s));assert.ok(log.some(s=>s.includes('invariant violation')));assert.equal(p.invariantViolations,1);assert.equal(g.invariantViolations,1);assert.ok(ownsMotionPath(p));assert.equal(p.status,'go-around');assert.equal(p.targetAltitude,1500);assert.ok(Math.hypot(p.position![0]-before[0],p.position![1]-before[1])<12);
});
test('illegal state transitions are rejected without moving or changing the aircraft state',()=>{const p=createGame(2,'medium').aircraft[0],before=[...p.position!];assert.equal(transition(p,'taxi-out'),false);assert.equal(p.status,'approach');assert.deepEqual(p.position,before);assert.equal(p.invariantViolations,1);});
test('server availability disables Land on ground, weather, occupancy and repeated clearance',()=>{
 const g=createGame(2,'medium'),a=g.aircraft[0],b=g.aircraft[1];assert.equal(snapshotGame(g).aircraft[1].landOptions![0].allowed,false);g.weather={runway:0,endsAt:25};assert.match(snapshotGame(g).aircraft[0].landOptions![0].reason!,/closed/);g.weather=undefined;b.status='landing';b.runway=0;b.remaining=10;assert.match(snapshotGame(g).aircraft[0].landOptions![0].reason!,/occupied/);g.aircraft=[a];assert.ok(command(g,a.id,'land',0,a.revision,'T').changed);assert.match(snapshotGame(g).aircraft[0].landOptions![0].reason!,/already active/);
});
test('compact display routes preserve the complete authoritative route and current target',()=>{
 const g=createGame(2,'medium'),p=g.aircraft[1];p.route=Array.from({length:2000},(_,i)=>[i,0]);p.routeIndex=800;const s=snapshotGame(g).aircraft[1];assert.equal(p.route.length,2000);assert.ok(s.route!.length<=128);assert.deepEqual(s.currentTarget,[800,0]);assert.deepEqual(s.route!.at(-1),[1999,0]);
});
test('large timer gaps do not expire endless runs or cause unbounded physics catch-up',()=>{
 const lobby=new Lobby(),peer={send(){},close(){}};lobby.handle(peer,{type:'create',nickname:'T'});lobby.handle(peer,{type:'practice'});const room=[...lobby.rooms.values()][0],p=room.game!.aircraft[0],position=[...p.position!];lobby.tick(room.lastTick!+420000);assert.equal(room.phase,'started');assert.equal(room.game!.elapsed,2);assert.equal(room.game!.endless,true);assert.ok(Math.hypot(p.position![0]-position[0],p.position![1]-position[1])<30);
});
