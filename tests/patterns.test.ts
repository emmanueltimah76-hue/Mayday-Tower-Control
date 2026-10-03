import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGame,command,tickGame} from '../server/game.js';
import {beginPattern,beginGoAround} from '../server/patterns.js';
import {patternProfiles} from '../src/flightPatterns.js';
import {entryRoute} from '../src/routes.js';
import {difficulties,airports} from '../src/airports.js';
import type {AircraftType} from '../src/protocol.js';
function isolated(d:typeof difficulties[number]){const g=createGame(2,d);g.aircraft=[g.aircraft[0]];g.nextWave=g.nextWind=g.nextWeather=g.nextEmergency=g.nextRadioLoss=9999;return g;}
test('patterns reach a stabilized touchdown for every runway, direction and supported aircraft type',()=>{
 for(const d of difficulties)for(const direction of [0,1] as const)for(let r=0;r<airports[d].runways.length;r++)for(const type of (d==='easy'?['light','regional']:['regional','narrowbody','heavy']) as AircraftType[]){
  const g=isolated(d),p=g.aircraft[0];g.direction=direction;const profile=patternProfiles[type],entry=entryRoute(g,r,type);p.aircraftType=type;p.position=entry.points[0];p.heading=Math.atan2(entry.points[1][0]-p.position[0],-(entry.points[1][1]-p.position[1]))*180/Math.PI;p.groundSpeed=profile.inbound;p.altitude=profile.altitude+500;p.fuel=9999;beginPattern(g,p,r);assert.ok(command(g,p.id,'land',r,p.revision,'T').changed);const legs=new Set<string>();
  for(let i=0;i<420&&!(p.status==='landing'&&!p.onFinal&&p.remaining===0);i++){legs.add(p.patternLeg??'');tickGame(g,1,()=>{});if(p.patternLeg)for(let j=1;j<p.motionSamples!.length;j++){const a=p.motionSamples![j-1],b=p.motionSamples![j],h=b.heading*Math.PI/180,dx=b.position[0]-a.position[0],dy=b.position[1]-a.position[1];assert.ok(dx*Math.sin(h)-dy*Math.cos(h)>=-1e-8);assert.ok(Math.abs(dx*Math.cos(h)+dy*Math.sin(h))<1e-7);}}
  assert.equal(p.status,'landing',`${d} ${direction} runway ${r} ${type}: ${p.patternPhase}`);assert.equal(p.onFinal,false);assert.equal(p.remaining,0);assert.deepEqual([...legs].filter(Boolean),['inbound','downwind','base','final']);assert.equal(p.goArounds,undefined);
 }
});
test('hold climbs to 1500 AGL, burns fuel, re-enters and preserves a clearance issued during recovery',()=>{
 const g=isolated('medium'),p=g.aircraft[0];assert.ok(command(g,p.id,'land',0,p.revision,'T').changed);while(p.patternPhase!=='final'&&g.elapsed<300)tickGame(g,1,()=>{});p.altitude=100;p.fuel=9999;const position=[...p.position!];assert.ok(command(g,p.id,'hold',0,p.revision,'T').changed);assert.deepEqual(p.position,position);const initialFuel=p.fuel;assert.ok(command(g,p.id,'land',0,p.revision,'T').changed);g.secondsLeft=600;let rejoined=false;
 for(let i=0;i<550&&!(p.status==='landing'&&!p.onFinal&&p.remaining===0);i++){tickGame(g,1,()=>{});if(p.patternLeg==='rejoin'){rejoined=true;assert.ok(p.altitude!>=1499);}if(p.patternLeg==='crosswind')assert.ok(p.altitude!>=100);}
 assert.ok(rejoined);assert.ok(p.holdReachedAltitude);assert.ok(p.fuel<initialFuel);assert.equal(p.status,'landing');assert.equal(p.remaining,0);
});
test('an uncleared arrival goes around before the runway without freezing or receiving points',()=>{
 const g=isolated('medium'),p=g.aircraft[0];const log:string[]=[];for(let i=0;i<350&&!p.goArounds;i++)tickGame(g,1,s=>log.push(s));assert.equal(p.goArounds,1);assert.equal(p.patternLeg,'go-around');assert.ok(p.altitude!>0);assert.equal(g.score,0);assert.ok(log.some(s=>s.includes('No landing clearance')));const before=[...p.position!];tickGame(g,1,()=>{});assert.notDeepEqual(p.position,before);
});
test('departures show roll, runway-heading climb and outbound legs before scoring at the boundary',()=>{
 for(const d of difficulties){const g=createGame(6,d),p=g.aircraft[1];g.aircraft=[p];g.nextWave=g.nextWeather=g.nextWind=g.nextEmergency=g.nextRadioLoss=999;p.status='queued';p.runway=0;p.position=airports[d].runways[0].start;assert.ok(command(g,p.id,'takeoff',0,p.revision,'T').changed);const legs=new Set<string>();for(let i=0;i<420&&g.aircraft.includes(p);i++){legs.add(p.patternLeg??'');tickGame(g,1,()=>{});if(g.aircraft.includes(p))assert.equal(g.handled,0);}assert.ok(legs.has('takeoff-roll'));assert.ok(legs.has('climb-out'));assert.ok(legs.has('outbound'));assert.equal(g.handled,1);assert.equal(g.score,100);}
});
test('late arrival waves are suppressed when their full pattern budget cannot fit',()=>{
 for(const d of difficulties){const g=createGame(2,d);g.aircraft=[];g.elapsed=300;g.secondsLeft=120;g.nextWave=300;g.nextWeather=g.nextWind=g.nextEmergency=g.nextRadioLoss=999;tickGame(g,1,()=>{});assert.ok(g.aircraft.every(p=>p.kind==='departure'));assert.equal(g.score,0);assert.equal(g.secondsLeft,119);}
});
