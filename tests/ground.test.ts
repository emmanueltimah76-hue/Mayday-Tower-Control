import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGame,command,tickGame,spawn,openStand} from '../server/game.js';
import {prepareGround,advanceGround,routeSafe,planGroundRoute} from '../server/ground.js';
import {setRoute} from '../server/motion.js';
import {groundGap,pointSegmentDistance,terminalBlocks} from '../src/groundGeometry.js';
import {runwayEnds} from '../src/airports.js';
function fixture(paths:[number,number][][]){const g=createGame(6,'medium');g.aircraft=[];g.nextWave=g.nextWind=g.nextWeather=g.nextEmergency=g.nextRadioLoss=9999;g.secondsLeft=900;for(const [i,path]of paths.entries()){spawn(g,'departure');const p=g.aircraft.at(-1)!;p.id=`test-${i}`;p.status='taxi-out';p.position=path[0];p.altitude=0;p.heading=Math.atan2(path[1][0]-path[0][0],-(path[1][1]-path[0][1]))*180/Math.PI;p.fuel=9999;p.standId=undefined;p.runway=0;setRoute(p,path);}return g;}
function safety(g:ReturnType<typeof fixture>){for(let i=0;i<g.aircraft.length;i++)for(let j=i+1;j<g.aircraft.length;j++){const a=g.aircraft[i],b=g.aircraft[j];assert.ok(Math.hypot(a.position![0]-b.position![0],a.position![1]-b.position![1])>=groundGap(a,b)-1e-5,`${a.id} overlaps ${b.id}`);}const resources=(g.groundReservations??[]).flatMap(r=>r.resources);assert.equal(resources.length,new Set(resources).size);}
test('crossing taxi paths acquire one shared intersection and wait, then both finish',()=>{
 const g=fixture([[[-280,600],[-120,600]],[[-200,680],[-200,520]]]),log:string[]=[];tickGame(g,1,s=>log.push(s));assert.equal(g.aircraft.filter(p=>p.groundReserved).length,1);assert.ok(g.groundReservations?.some(r=>r.intersections.length));assert.ok(g.aircraft.some(p=>p.groundHold?.marker));
 for(let i=0;i<400&&!g.aircraft.every(p=>p.status==='queued');i++){tickGame(g,1,s=>log.push(s));safety(g);}assert.ok(g.aircraft.every(p=>p.status==='queued'));assert.ok(log.some(s=>s.includes('hold short')));assert.ok(log.some(s=>s.includes('traffic clear')));assert.equal(g.score,0);
});
test('head-on blocked endpoints use an automatic holding bay without overlap or deadlock',()=>{
 const g=fixture([[[-280,600],[-180,600]],[[-180,600],[-280,600]]]),log:string[]=[];for(let i=0;i<400&&!g.aircraft.every(p=>p.status==='queued');i++){tickGame(g,1,s=>log.push(s));safety(g);}assert.ok(g.aircraft.every(p=>p.status==='queued'),JSON.stringify(g.aircraft.map(p=>({status:p.status,hold:p.groundHold,bay:p.groundAtBay,position:p.position}))));assert.ok(log.some(s=>s.includes('holding bay')));assert.ok(log.some(s=>s.includes('rejoin')));
});
test('following aircraft never passes through a slower aircraft and reaches a distinct hold point',()=>{
 const g=fixture([[[-230,600],[-100,600]],[[-280,600],[-130,600]]]);const log:string[]=[];for(let i=0;i<400&&!g.aircraft.every(p=>p.status==='queued');i++){tickGame(g,1,s=>log.push(s));safety(g);}assert.ok(g.aircraft.every(p=>p.status==='queued'));assert.ok(log.some(s=>s.includes('reserved')));assert.ok(g.aircraft[0].position![0]>g.aircraft[1].position![0]);
});
test('pushback rejection does not mutate revision, fuel, stand or state',()=>{
 const g=createGame(2,'medium');g.aircraft=[];spawn(g,'departure');spawn(g,'departure');const [a,b]=g.aircraft;a.needsPushback=true;b.position=[a.position![0],a.position![1]+3];const before=structuredClone(a);const result=command(g,a.id,'pushback',0,a.revision,'T');assert.match(result.error!,/blocked/);assert.deepEqual(a,before);
});
test('safe ground planner avoids terminal blocks, parked traffic, and unassigned runways',()=>{
 const g=fixture([[[-280,600],[-120,600]],[[-200,600],[-200,550]]]),p=g.aircraft[0];g.aircraft[1].status='gate';const plan=planGroundRoute(g,p,[p.position!,[-120,600]])!;assert.ok(plan);setRoute(p,plan);assert.ok(routeSafe(g,p,p.route!));for(const t of terminalBlocks('medium'))for(let i=1;i<p.route!.length;i++)assert.ok(pointSegmentDistance(t.center,p.route![i-1],p.route![i])>Math.hypot(t.width,t.height)/2);
});
test('an occupied crossing runway blocks takeoff before any reservation or movement',()=>{
 const g=createGame(2,'easy'),a=g.aircraft[0],b=g.aircraft[1];a.status='landing';a.onFinal=false;a.remaining=10;a.altitude=0;a.runway=1;b.status='queued';b.runway=2;const before=structuredClone(b);assert.match(command(g,b.id,'takeoff',2,b.revision,'T').error!,/occupied/);assert.deepEqual(b,before);assert.equal(g.score,0);
});
test('reservation release, owner disappearance and direction changes cannot leave stale locks',()=>{
 const g=fixture([[[-280,600],[-120,600]],[[-200,680],[-200,520]]]);tickGame(g,1,()=>{});const owner=g.aircraft.find(p=>p.groundReserved)!;const waiting=g.aircraft.find(p=>!p.groundReserved)!;g.aircraft=g.aircraft.filter(p=>p!==owner);tickGame(g,1,()=>{});assert.equal(waiting.groundReserved,true);assert.equal(waiting.groundHold,undefined);assert.ok(g.groundReservations?.every(r=>r.aircraftId!==owner.id));
 const wind=createGame(2,'medium');wind.nextWave=wind.nextEmergency=wind.nextWeather=999;const p=wind.aircraft[1];p.status='queued';p.runway=0;p.position=runwayEnds(wind,0)[0];wind.nextWind=1;tickGame(wind,1,()=>{});assert.equal(wind.direction,1);assert.equal(p.status,'taxi-out');tickGame(wind,1,()=>{});if(p.groundReserved)assert.ok(routeSafe(wind,p,[p.position!,...p.route!.slice(p.routeIndex??1)]));else assert.ok(p.groundHold);
});
test('real airport departure routes remain outside terminal blocks and unassigned runways',()=>{
 for(const difficulty of ['easy','medium','hard','expert'] as const){const g=createGame(6,difficulty);g.aircraft=[];g.nextWave=g.nextWind=g.nextWeather=g.nextEmergency=g.nextRadioLoss=999;for(let r=0;r<(difficulty==='expert'?8:difficulty==='hard'?4:3);r++){spawn(g,'departure');const p=g.aircraft.at(-1)!;if(!p||p.status!=='gate')continue;const result=command(g,p.id,'taxi',r,p.revision,'T');if(result.changed)assert.ok(routeSafe(g,p,p.route!),`${difficulty} ${r}`);else assert.match(result.error!,/safe taxi route|occupied/);}}
});
test('three-aircraft circular blocking resolves automatically with unique reservations',()=>{
 const g=fixture([[[-280,600],[-180,600]],[[-180,600],[-230,690]],[[-230,690],[-280,600]]]),log:string[]=[];for(let i=0;i<420&&!g.aircraft.every(p=>p.status==='queued');i++){tickGame(g,1,s=>log.push(s));safety(g);}assert.ok(g.aircraft.every(p=>p.status==='queued'));assert.ok(log.some(s=>s.includes('holding bay')));
});
test('pushback moves backwards along the nose without spinning and keeps speed bounded',()=>{
 const g=createGame(2,'medium');g.aircraft=[];spawn(g,'departure');const p=g.aircraft[0];p.needsPushback=true;p.heading=90;assert.ok(command(g,p.id,'pushback',0,p.revision,'T').changed);const old=[...p.position!];tickGame(g,5,()=>{});assert.ok(p.position![0]<old[0]);assert.ok(Math.abs(p.position![1]-old[1])<1e-8);assert.equal(p.heading,90);assert.ok(p.groundSpeed!<=3);assert.ok(p.standId);
});
test('a newly cleared ground aircraft enters a curved lead-in instead of pivoting toward a target behind it',()=>{
 const g=createGame(2,'medium'),p=g.aircraft[1];g.aircraft=[p];g.nextWave=g.nextWind=g.nextWeather=g.nextEmergency=g.nextRadioLoss=999;p.heading=0;assert.ok(command(g,p.id,'taxi',0,p.revision,'T').changed);tickGame(g,1,()=>{});const samples=p.motionSamples!;for(let i=1;i<samples.length;i++){const a=samples[i-1],b=samples[i];assert.ok(Math.abs(b.heading-a.heading)<=2.1);assert.ok(Math.hypot(b.position[0]-a.position[0],b.position[1]-a.position[1])<.13);}assert.ok(p.groundSpeed!<=8);assert.equal(p.status,'taxi-out');
});
test('real taxi-to-takeoff line-up preserves forward travel and bounded ground heading changes',()=>{
 const g=createGame(2,'medium'),p=g.aircraft[1];g.aircraft=[p];g.nextWave=g.nextWind=g.nextWeather=g.nextEmergency=g.nextRadioLoss=999;assert.ok(command(g,p.id,'taxi',0,p.revision,'T').changed);while(g.elapsed<300&&p.status!=='queued')tickGame(g,1,()=>{});assert.equal(p.status,'queued');assert.ok(command(g,p.id,'takeoff',0,p.revision,'T').changed);let rolled=false;for(let i=0;i<180&&(p.altitude??0)<10;i++){tickGame(g,1,()=>{});rolled||=p.patternLeg==='takeoff-roll';const samples=p.motionSamples!;for(let j=1;j<samples.length;j++){const a=samples[j-1],b=samples[j],h=b.heading*Math.PI/180,dx=b.position[0]-a.position[0],dy=b.position[1]-a.position[1];assert.ok(Math.abs(b.heading-a.heading)<=2.1);assert.ok(dx*Math.sin(h)-dy*Math.cos(h)>=-1e-8);assert.ok(Math.abs(dx*Math.cos(h)+dy*Math.sin(h))<.01);}}assert.ok(rolled);assert.ok(p.altitude!>=10);
});
test('separate parallel taxi lanes do not reserve the same oversized surface cell',()=>{const g=fixture([[[-280,600],[-120,600]],[[-280,612],[-120,612]]]);prepareGround(g,()=>{});assert.equal(g.aircraft.filter(p=>p.groundReserved).length,2);assert.ok(g.aircraft.every(p=>!p.groundHold));safety(g);});
