import {test} from 'node:test';import assert from 'node:assert/strict';
import {createGame,spawn,tickGame,command} from '../server/game.js';
import {airports,difficulties} from '../src/airports.js';
function quiet(d:typeof difficulties[number]){const g=createGame(6,d);g.aircraft=[];g.secondsLeft=5000;g.nextWave=g.nextEmergency=g.nextWeather=g.nextWind=g.nextRadioLoss=99999;return g;}
test('every runway can taxi and launch a heavy aircraft in either direction',()=>{
 for(const d of difficulties)for(const direction of [0,1] as const)for(const r of airports[d].runways.keys()){
  const g=quiet(d);g.direction=direction;spawn(g,'departure');const p=g.aircraft[0];p.aircraftType='heavy';assert.equal(command(g,p.id,'taxi',r,p.revision,'Test').changed,true);
  for(let t=0;t<1500&&p.status!=='queued';t++)tickGame(g,1,()=>{});
  assert.equal(p.status,'queued',`${d}/${direction}/${r}: ${p.groundHold?.reason}`);
  const result=command(g,p.id,'takeoff',r,p.revision,'Test');assert.equal(result.changed,true,`${d}/${direction}/${r}: ${result.error}`);
  for(let t=0;t<1500&&g.aircraft.includes(p);t++)tickGame(g,1,()=>{});
  assert.ok(!g.aircraft.includes(p),`${d}/${direction}/${r}: ${p.status} ${p.groundHold?.reason}`);assert.equal(g.handled,1);assert.equal(g.invariantViolations??0,0);
 }
});
test('traffic waves do not refill boarding areas with newly spawned departures',()=>{const g=quiet('expert');g.nextWave=1;tickGame(g,1,()=>{});assert.equal(g.aircraft.length,1);assert.equal(g.aircraft[0].kind,'arrival');g.sequence=5;g.nextSpawn=2;tickGame(g,1,()=>{});assert.equal(g.aircraft.length,2);assert.ok(g.aircraft.every(p=>p.kind==='arrival'));});
test('emergencies have an initial grace period and never stack',()=>{const g=quiet('expert');g.nextEmergency=1;spawn(g,'arrival',true);tickGame(g,1,()=>{});assert.equal(g.aircraft.filter(p=>p.emergency).length,1);assert.equal(createGame(6,'expert').nextEmergency,180);});
test('a safely parked emergency clears SOS, retains its rescue award and boards for one minute',()=>{const g=quiet('easy');spawn(g,'arrival',true);const p=g.aircraft[0],r=airports.easy.runways[2];p.status='landing';p.onFinal=false;p.landingPhase='rollout';p.remaining=0;p.runway=2;p.altitude=0;p.groundSpeed=0;p.position=[r.start[0]+(r.end[0]-r.start[0])*.3,r.start[1]+(r.end[1]-r.start[1])*.3];p.heading=r.heading;p.route=undefined;
 for(let t=0;t<900&&String(p.status)!=='turnaround';t++)tickGame(g,1,()=>{});assert.equal(p.status,'turnaround');assert.equal(p.emergency,false);assert.equal(p.squawk,p.normalSquawk);assert.equal(g.emergenciesHandled,1);assert.equal(g.score,250);tickGame(g,59,()=>{});assert.equal(p.status,'turnaround');tickGame(g,1,()=>{});assert.equal(p.status,'gate');
});
test('multiple landed arrivals reach distinct gates while a departure occupies the ramp',()=>{const g=quiet('medium');spawn(g,'departure');const arrivals=[];for(const runway of [0,1,2]){spawn(g,'arrival');const p=g.aircraft.at(-1)!,r=airports.medium.runways[runway];p.aircraftType='regional';p.status='landing';p.onFinal=false;p.landingPhase='rollout';p.remaining=0;p.runway=runway;p.altitude=0;p.groundSpeed=0;p.position=[r.start[0]+(r.end[0]-r.start[0])*.5,r.start[1]+(r.end[1]-r.start[1])*.5];p.heading=r.heading;p.route=undefined;arrivals.push(p);}for(let t=0;t<1800&&arrivals.some(p=>!p.arrivalCredited);t++)tickGame(g,1,()=>{});for(const p of arrivals)assert.ok(p.arrivalCredited,`${p.callsign}: ${p.status} ${p.autoTaxiReason??p.groundHold?.reason}`);assert.equal(new Set(arrivals.map(p=>p.standId)).size,3);assert.equal(g.invariantViolations??0,0);});
