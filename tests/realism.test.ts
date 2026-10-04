import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Lobby,type Peer} from '../server/lobby.js';
import {createGame,spawn,command,tickGame,performance,runwayBusy,wakeRemaining} from '../server/game.js';
import {airports,runwayName,runwayEnds,difficulties} from '../src/airports.js';
import type {ServerMessage} from '../src/protocol.js';
class P implements Peer{messages:ServerMessage[]=[];send(m:ServerMessage){this.messages.push(structuredClone(m));}close(){}get state(){return this.messages.filter(m=>m.type==='state').at(-1)!.room;}get error(){return this.messages.filter(m=>m.type==='error').at(-1)?.code;}}
function until(g:ReturnType<typeof createGame>,done:()=>boolean,emit:(s:string)=>void=()=>{}){for(let i=0;i<419&&!done();i++)tickGame(g,1,emit);assert.ok(done(),'Aircraft must reach its expected state within a shift');}
function quiet(){const g=createGame(2,'medium');g.nextEmergency=g.nextWeather=g.nextWind=g.nextWave=999;return g;}
test('A: all four airport layouts have correct identifiers and increasing difficulty',()=>{
 assert.deepEqual(difficulties.map(d=>[airports[d].code,airports[d].runways.length]),[['KPRC',3],['KPHX',3],['KLAX',4],['KORD',8]]);
 for(const d of difficulties){const g=createGame(2,d);assert.equal(g.secondsLeft,420);for(const [i,r]of airports[d].runways.entries()){assert.ok(Number.isFinite(r.heading));assert.equal(runwayName(g,i),r.ends[0]);assert.notDeepEqual(r.start,r.end)}}
 assert.ok(airports.easy.interval>airports.expert.interval);assert.ok(airports.easy.fuelFactor>airports.expert.fuelFactor);
});
test('A: difficulty is host-only, validated, synchronized and locked during play',()=>{
 const l=new Lobby(),a=new P(),b=new P();l.handle(a,{type:'create',nickname:'A'});l.handle(b,{type:'join',nickname:'B',code:a.state.code});l.handle(b,{type:'difficulty',difficulty:'expert'});assert.equal(b.error,'HOST_ONLY');l.handle(a,{type:'difficulty',difficulty:'invalid'});assert.equal(a.error,'DIFFICULTY');l.handle(a,{type:'difficulty',difficulty:'expert'});assert.deepEqual(a.state,b.state);l.handle(a,{type:'start'});assert.equal(b.state.game!.difficulty,'expert');l.handle(a,{type:'difficulty',difficulty:'easy'});assert.equal(a.error,'ACTIVE');
});
test('B: airline callsigns, N registrations, four performance profiles and paced waves',()=>{
 const small=createGame(2,'easy');assert.match(small.aircraft[0].callsign,/^N\d+[A-Z]+$/);const g=quiet();for(let i=0;i<10;i++)spawn(g,'arrival');assert.deepEqual(new Set(g.aircraft.map(p=>p.aircraftType)),new Set(['narrowbody','regional','heavy']));assert.match(g.aircraft[0].callsign,/^(AAL|SWA|UAL|DAL) \d+/);assert.equal(Object.keys(performance).length,4);assert.ok(performance.heavy.landing>performance.light.landing);
 const waves=createGame(2,'easy');waves.nextEmergency=999;tickGame(waves,25,()=>{});assert.equal(waves.aircraft.length,3);tickGame(waves,waves.trafficInterval-1,()=>{});assert.equal(waves.aircraft.length,3);tickGame(waves,1,()=>{});assert.equal(waves.aircraft.length,3); // All three Prescott gate slots are committed; further traffic waits.
});
test('C: server movement follows runway paths and a full arrival scores once',()=>{
 const g=quiet(),p=g.aircraft[0],before=[...p.position!];g.aircraft=[p];command(g,p.id,'land',0,p.revision,'Tower');const final=p.remaining;tickGame(g,1,()=>{});assert.notDeepEqual(p.position,before);until(g,()=>p.status==='landing'&&p.onFinal===false);assert.equal(p.onFinal,false);assert.equal(p.status,'landing');until(g,()=>p.remaining===0);assert.equal(p.remaining,0);assert.equal(p.runwayReleased,true);assert.equal(runwayBusy(g,0),false);command(g,p.id,'taxi',0,p.revision,'Tower');until(g,()=>p.status==='turnaround');assert.equal(g.handled,1);assert.equal(g.score,100);assert.ok(g.aircraft.includes(p));assert.ok(p.standId);tickGame(g,2,()=>{});assert.equal(g.score,100);
});
test('C: heavy departure creates wake spacing, rejects early clearance and expires',()=>{
 const g=quiet();spawn(g,'departure');spawn(g,'departure');const heavy=g.aircraft.find(p=>p.aircraftType==='heavy')!;heavy.kind='departure';heavy.status='queued';heavy.runway=0;heavy.position=runwayEnds(g,0)[0];command(g,heavy.id,'takeoff',0,heavy.revision,'Tower');until(g,()=>!!heavy.runwayReleased);assert.equal(wakeRemaining(g,0),25);spawn(g,'arrival');const p=g.aircraft.at(-1)!;assert.match(command(g,p.id,'land',0,p.revision,'Tower').error!,/Wake turbulence/);tickGame(g,25,()=>{});assert.equal(wakeRemaining(g,0),0);assert.equal(command(g,p.id,'land',0,p.revision,'Tower').changed,true);
});
test('C: crossing runways cannot accept concurrent surface clearances',()=>{
 const g=createGame(2,'easy');const p=g.aircraft[0];p.status='landing';p.runway=1;p.onFinal=false;p.remaining=4;assert.equal(runwayBusy(g,2),true);assert.match(command(g,g.aircraft[1].id,'taxi',2,0,'Tower').error!,/crossing runway occupied/);
});
test('D: wind changes reciprocal runway ends, announces and retaxis queued departures',()=>{
 const g=quiet(),p=g.aircraft[1];p.status='queued';p.runway=0;p.position=runwayEnds(g,0)[0];g.nextWind=1;const events:string[]=[];tickGame(g,1,s=>events.push(s));assert.equal(g.direction,1);assert.equal(runwayName(g,0),'25R');assert.equal(p.status,'taxi-out');assert.ok(p.revision>0);assert.ok(events.some(e=>e.includes('Active runways now')));
});
test('D: active landing defers a direction change',()=>{const g=quiet(),p=g.aircraft[0];command(g,p.id,'land',0,p.revision,'Tower');g.nextWind=1;tickGame(g,1,()=>{});assert.equal(g.direction,0);assert.ok(g.nextWind!>1);});
test('D: departure occupying short final forces go-around without scoring or collision',()=>{
 const g=quiet(),p=g.aircraft[0],d=g.aircraft[1];d.fuel=9999;command(g,p.id,'land',0,p.revision,'Tower');until(g,()=>p.patternPhase==='final');d.status='queued';d.runway=0;d.position=runwayEnds(g,0)[0];assert.ok(command(g,d.id,'takeoff',0,d.revision,'Tower').changed);const events:string[]=[];until(g,()=>p.status==='go-around',s=>events.push(s));assert.equal(p.goArounds,1);assert.ok(p.revision>0);assert.equal(g.score,0);assert.ok(events.some(e=>e.includes('go around')));
});
test('D: each difficulty completes at seven minutes and rejects invalid runway indices',()=>{
 for(const difficulty of difficulties){const g=createGame(6,difficulty);assert.match(command(g,g.aircraft[0].id,'land',99,0,'Tower').error!,/available runway/);tickGame(g,421,()=>{});assert.equal(g.elapsed,420);assert.equal(g.secondsLeft,0);const score=g.score;tickGame(g,20,()=>{});assert.equal(g.score,score)}
});
test('C: departing aircraft queue in order and cannot bypass an earlier departure',()=>{
 const g=quiet();g.aircraft=[];spawn(g,'departure');spawn(g,'departure');const [a,b]=g.aircraft;command(g,a.id,'taxi',0,0,'Tower');command(g,b.id,'taxi',0,0,'Tower');until(g,()=>a.status==='queued'&&b.status==='queued');assert.equal(a.status,'queued');assert.equal(b.status,'queued');assert.notDeepEqual(a.position,b.position);assert.match(command(g,b.id,'takeoff',0,b.revision,'Tower').error!,/ahead/);assert.equal(command(g,a.id,'takeoff',0,a.revision,'Tower').changed,true);
});
test('D: real-airport emergencies award bonus or missed penalty and weather reopens',()=>{
 const g=quiet();g.aircraft=[];spawn(g,'arrival',true);const p=g.aircraft[0];command(g,p.id,'land',p.approachRunway,0,'Tower');until(g,()=>!p.onFinal&&p.remaining===0);command(g,p.id,'taxi',0,p.revision,'Tower');until(g,()=>p.status==='turnaround');assert.equal(g.score,250);assert.equal(g.emergenciesHandled,1);
 const missed=quiet();missed.aircraft=[];spawn(missed,'arrival',true);tickGame(missed,missed.aircraft[0].fuel,()=>{});assert.equal(missed.score,-150);
 const weather=quiet();weather.nextWeather=1;tickGame(weather,1,()=>{});const closed=weather.weather!.runway;assert.match(command(weather,weather.aircraft[0].id,'land',closed,0,'Tower').error!,/closed/);tickGame(weather,25,()=>{});assert.equal(weather.weather,undefined);
});
