import {test} from 'node:test';
import assert from 'node:assert/strict';
import {advanceMotion,setRoute,flightProfiles} from '../server/motion.js';
import {createGame,command,tickGame} from '../server/game.js';
import {Lobby,type Peer} from '../server/lobby.js';
import {airports,difficulties} from '../src/airports.js';
import {NM_PER_MAP_UNIT,FEET_PER_NM,feetToUnits,knotsToUnitsPerSecond} from '../src/mapConstants.js';
import {flashingTracks,visibleAlerts} from '../src/alertPresentation.js';
import {updateAlerts} from '../server/alerts.js';
import type {AircraftType,ServerMessage,TrafficAlert} from '../src/protocol.js';
test('all aircraft fly forward on heading even when the target is behind or across north',()=>{
 for(const type of ['light','regional','narrowbody','heavy'] as AircraftType[]){const g=createGame(2,'medium'),p=g.aircraft[0];p.aircraftType=type;p.status='go-around';p.groundSpeed=flightProfiles[type].approach;p.position=[0,0];p.heading=359;setRoute(p,[[0,0],[100,100]]);
 for(let i=0;i<800;i++){const before=[...p.position!],speed=p.groundSpeed!,heading=p.heading!;advanceMotion(p,.1);const h=p.heading!*Math.PI/180,dx=p.position![0]-before[0],dy=p.position![1]-before[1];assert.ok(dx*Math.sin(h)-dy*Math.cos(h)>=-1e-9);assert.ok(Math.abs(dx*Math.cos(h)+dy*Math.sin(h))<1e-8);assert.ok(Math.abs(p.heading!-heading)<=(type==='light'?.6:.3)+1e-8);assert.ok(Math.abs(p.groundSpeed!-speed)<=.2+1e-8);}}
});
test('hold uses forward motion and a cleared held aircraft does not orbit its target forever',()=>{
 for(const d of difficulties){const g=createGame(2,d),p=g.aircraft[0];g.aircraft=[p];g.nextWave=g.nextWind=g.nextWeather=g.nextEmergency=999;p.fuel=9999;command(g,p.id,'hold',0,p.revision,'Tower');tickGame(g,15,()=>{});
 const samples=p.motionSamples!;assert.ok(samples.length>1);for(let i=1;i<samples.length;i++){const a=samples[i-1],b=samples[i],h=b.heading*Math.PI/180,dx=b.position[0]-a.position[0],dy=b.position[1]-a.position[1];assert.ok(dx*Math.sin(h)-dy*Math.cos(h)>0);assert.ok(Math.abs(dx*Math.cos(h)+dy*Math.sin(h))<1e-8);}
 assert.ok(command(g,p.id,'land',0,p.revision,'Tower').changed);for(let i=0;i<400&&!(p.status==='landing'&&!p.onFinal&&p.remaining===0);i++)tickGame(g,1,()=>{});assert.equal(p.status,'landing');assert.equal(p.remaining,0);}
});
test('commands retain accepted and rejected receipts, including stale revision',()=>{
 const l=new Lobby();class P implements Peer{messages:ServerMessage[]=[];send(m:ServerMessage){this.messages.push(m)}close(){}}
 const p=new P();l.handle(p,{type:'create',nickname:'Tower'});l.handle(p,{type:'practice'});const room=[...l.rooms.values()][0],a=room.game!.aircraft[0];
 l.handle(p,{type:'command',aircraftId:a.id,command:'hold',runway:0,revision:a.revision});assert.equal(a.commandLog?.at(-1)?.accepted,true);
 l.handle(p,{type:'command',aircraftId:a.id,command:'land',runway:0,revision:0});assert.equal(a.commandLog?.at(-1)?.accepted,false);assert.match(a.commandLog!.at(-1)!.message,/updated/);assert.ok(p.messages.some(m=>m.type==='error'&&m.code==='COMMAND'));
 l.handle(p,{type:'command',aircraftId:a.id,command:'takeoff',runway:0,revision:a.revision});assert.match(a.commandLog!.at(-1)!.message,/Taxi/);assert.equal(a.status,'holding');
});
test('one physical map scale applies to all airports and their geometry stays in bounds',()=>{
 for(const d of difficulties){assert.equal(airports[d].nmPerUnit,NM_PER_MAP_UNIT);for(const r of airports[d].runways)for(const p of [r.start,r.end]){assert.ok(p[1]>-220&&p[1]<620);}}
 assert.equal(feetToUnits(FEET_PER_NM),1/NM_PER_MAP_UNIT);assert.equal(knotsToUnitsPerSecond(3600),1/NM_PER_MAP_UNIT);
});
test('emergencies and losses get priority, flashing is capped, warnings do not spam on flapping',()=>{
 const g=createGame(2,'medium'),a=g.aircraft[0],b=g.aircraft[1];a.emergency=true;
 const warning:TrafficAlert={id:'w',kind:'airborne',severity:'warning',aircraftIds:['x','y'],message:'Warning'};g.alerts=[warning,{...warning,id:'loss',severity:'loss',aircraftIds:[a.id,b.id]}];assert.equal(visibleAlerts(g)[0].id,'loss');g.alerts.push(...Array.from({length:10},(_,i)=>({...warning,id:String(i),aircraftIds:[String(i)]})));assert.ok(flashingTracks(g).size<=4);assert.ok(flashingTracks(g).has(a.id));
 a.status=b.status='holding';a.emergency=false;a.altitude=b.altitude=1000;a.position=[200,200];b.position=[250,200];a.heading=90;b.heading=270;a.groundSpeed=b.groundSpeed=140;g.alerts=[];const log:string[]=[];updateAlerts(g,s=>log.push(s));const first=log.length;assert.ok(first>0);b.position=[700,600];updateAlerts(g,s=>log.push(s));b.position=[250,200];g.elapsed++;updateAlerts(g,s=>log.push(s));assert.equal(log.length,first);
});
