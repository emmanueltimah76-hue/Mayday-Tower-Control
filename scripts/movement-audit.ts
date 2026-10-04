// Diagnostic only: no gameplay mutations outside normal public commands and ticks.
import {performance as timer} from 'node:perf_hooks';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const base=resolve(process.env.AUDIT_BASE??'.');
const {Lobby}=await import(pathToFileURL(`${base}/server/lobby.ts`).href);
const {spawn}=await import(pathToFileURL(`${base}/server/game.ts`).href);
const {runwayEnds,airports}=await import(pathToFileURL(`${base}/src/airports.ts`).href);
const {flightProfiles,shortestAngle}=await import(pathToFileURL(`${base}/server/motion.ts`).href);
const failures:Record<string,{count:number;examples:unknown[]}>={};
function fail(key:string,example:unknown){const f=failures[key]??={count:0,examples:[]};f.count++;if(f.examples.length<4)f.examples.push(example);}
let now=1_800_000_000_000;const originalNow=Date.now;Date.now=()=>now;
const seed=Number(process.env.AUDIT_SEED??2703);let rng=seed;const random=()=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng/4294967296;};
const transitions:Record<string,string[]>={approach:['holding','go-around','landing'],holding:['approach','landing','go-around'], 'go-around':['approach','holding','landing'],landing:['taxi-in','go-around','holding'], 'taxi-in':['turnaround'],turnaround:['gate'],gate:['taxi-out','pushback'],pushback:['gate'],'taxi-out':['queued'],queued:['takeoff','taxi-out'],takeoff:[],final:['landing','go-around','holding']};
let largestSnapshot:any;let rejected=0,accepted=0,maxAircraft=0,checks=0,landed=0;const ticks:number[]=[],bytes:number[]=[],density:{aircraft:number;ms:number;bytes:number}[]=[];
const peers=Array.from({length:6},()=>({room:null as any,send(m:any){if(m.type==='state')this.room=m.room;if(m.type==='error')rejected++;},close(){}}));
const lobby=new Lobby();lobby.handle(peers[0],{type:'create',nickname:'Audit 1'});const code=peers[0].room.code;
for(let i=1;i<6;i++)lobby.handle(peers[i],{type:'join',nickname:`Audit ${i+1}`,code});
lobby.handle(peers[0],{type:'difficulty',difficulty:process.env.AUDIT_DIFFICULTY??'expert'});lobby.handle(peers[0],{type:'start'});
const room=[...lobby.rooms.values()][0] as any,g=room.game,scale=airports[g.difficulty].nmPerUnit;const seenStates=new Map<string,string>();
function stateChanges(label:string){for(const p of g.aircraft){const prior=seenStates.get(p.id);if(prior&&prior!==p.status&&!transitions[prior]?.includes(p.status))fail('illegalTransition',{t:g.elapsed,id:p.id,prior,next:p.status,label});seenStates.set(p.id,p.status);}}
function send(peer:any,p:any,action:string,stale=false){const prior=p.status,rev=p.revision,oldRejected=rejected;lobby.handle(peer,{type:'command',aircraftId:p.id,command:action,runway:p.runway??p.approachRunway??0,revision:stale?rev-1:rev});if(rejected===oldRejected)accepted++;stateChanges(`command ${action}`);}
if(process.env.AUDIT_OVERLOAD==='1')while(g.aircraft.length<18)spawn(g,'arrival');
stateChanges('initial');
for(let t=0;t<420;t++){
 // Six independent controllers issue useful clearances plus seeded adversarial/stale actions.
 for(let player=0;player<6;player++){
 const list=g.aircraft;if(!list.length)continue;const p=list[Math.floor(random()*list.length)];
 let action=random()<.7?(p.kind==='arrival'&&(['approach','holding','go-around'].includes(p.status)||p.onFinal)?'land':p.status==='landing'&&!p.onFinal&&p.remaining===0?'taxi':p.status==='gate'?p.needsPushback?'pushback':'taxi':p.status==='queued'?'takeoff':'land'):['hold','land','taxi','takeoff','pushback'][Math.floor(random()*5)];
 // Recovery itself must get time to finish; avoid making every useful clearance a hold.
 if(process.env.AUDIT_NO_HOLD==='1'&&action==='hold')action='takeoff';send(peers[player],p,action,random()<.15);
 }
 const before=new Map(g.aircraft.map((p:any)=>[p.id,structuredClone(p)]));const start=timer.now();now+=1000;lobby.tick(now);const ms=timer.now()-start;ticks.push(ms);stateChanges('tick');
 const size=Buffer.byteLength(JSON.stringify(lobby.state(room)));bytes.push(size);if(!largestSnapshot||size>largestSnapshot.bytes)largestSnapshot={bytes:size,elapsed:g.elapsed,fields:Object.fromEntries(Object.entries(g).map(([k,v])=>[k,Buffer.byteLength(JSON.stringify(v)??'')])),aircraft:g.aircraft.map((p:any)=>({id:p.id,state:p.status,routePoints:p.route?.length??0,routeBytes:Buffer.byteLength(JSON.stringify(p.route)??''),samplesBytes:Buffer.byteLength(JSON.stringify(p.motionSamples)??'')}))};density.push({aircraft:g.aircraft.length,ms,bytes:size});maxAircraft=Math.max(maxAircraft,g.aircraft.length);
 for(const p of g.aircraft){const old=before.get(p.id) as any;if(!old)continue;if(old.onFinal&&!p.onFinal&&p.status==='landing')landed++;const type=p.aircraftType??'narrowbody',profile=flightProfiles[type],scale=airports[g.difficulty].nmPerUnit;
 const maxSpeed=({light:95,regional:155,narrowbody:165,heavy:175} as any)[type];
 if(p.groundSpeed>maxSpeed+.01)fail('maxSpeed',{t:g.elapsed,id:p.id,state:p.status,speed:p.groundSpeed,maxSpeed});
 const samples=p.motionSamples??[{position:old.position,heading:old.heading},{position:p.position,heading:p.heading}];const dt=p.motionSamples?.length?.1:1;
 const air=['approach','holding','go-around'].includes(old.status)||old.onFinal||(old.status==='takeoff'&&old.altitude>10);
 const turn=air?type==='light'?6:3:profile.turnRate;
 const speedBound=Math.min(maxSpeed,Math.max(old.groundSpeed??0,p.groundSpeed??0)+profile.acceleration);
 for(let i=1;i<samples.length;i++){checks++;const a=samples[i-1],b=samples[i],dx=b.position[0]-a.position[0],dy=b.position[1]-a.position[1],dist=Math.hypot(dx,dy),rate=Math.abs(shortestAngle(a.heading,b.heading))/dt;
 const integrated=a.speed!==undefined&&b.speed!==undefined?(a.speed+b.speed)/2*dt/(3600*scale):speedBound*dt/(3600*scale);
 if(dist>integrated+.000001)fail('displacement',{t:g.elapsed,id:p.id,state:p.status,dist,bound:integrated});
 const sampleAir=a.state?['approach','holding','go-around','final'].includes(a.state)||a.state==='landing'&&(a.altitude??0)>10||a.state==='takeoff'&&(a.altitude??0)>10:air;const sampleLimit=sampleAir?type==='light'?6:3:profile.turnRate;
 if(rate>sampleLimit+.01)fail('turnRate',{t:g.elapsed,id:p.id,state:p.status,rate,max:sampleLimit});
 if(dist>2*dt/(3600*scale)){const travel=Math.atan2(dx,-dy)*180/Math.PI,nose=old.status==='pushback'?b.heading-180:b.heading,error=Math.abs(shortestAngle(nose,travel)),tol=p.motionSamples?1:air?4:15;if(error>tol)fail(`alignment:${p.status}`,{t:g.elapsed,id:p.id,state:p.status,phase:p.patternPhase,heading:b.heading,travel,error});}
 }
 const moving=['approach','holding','go-around','taxi-in','taxi-out','pushback','takeoff'].includes(p.status)||p.status==='landing'&&(p.onFinal||p.remaining>0);
 if(moving&&!p.groundAtBay&&(!p.route||!p.route[p.routeIndex??1])&&!p.currentTarget&&!p.holdingCenter)fail('orphan',{t:g.elapsed,id:p.id,state:p.status,remaining:p.remaining,speed:p.groundSpeed});
 }
 // Geometric runway occupancy, not broad taxi-in labels: within 100 feet of runway centerline.
 for(let r=0;r<airports[g.difficulty].runways.length;r++){const [a,b]=runwayEnds(g,r),dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);const physical=g.aircraft.filter((p:any)=>{if(p.onFinal||p.altitude>10)return false;const x=p.position[0]-a[0],y=p.position[1]-a[1],along=(x*dx+y*dy)/len,cross=Math.abs(x*dy-y*dx)/len;return along>=0&&along<=len&&cross*scale*6076.12<100;});if(physical.length>1)fail('runwayMultipleOwners',{t:g.elapsed,runway:r,aircraft:physical.map((p:any)=>({id:p.id,state:p.status}))});}
 // State-only snapshots are identical by identity because Lobby broadcasts its authoritative room.
 if(peers.some(p=>p.room.revision!==room.revision))fail('synchronization',{t:g.elapsed});
}
Date.now=originalNow;
const percentile=(xs:number[],p:number)=>[...xs].sort((a,b)=>a-b)[Math.floor((xs.length-1)*p)];
const group=(low:number,high:number)=>{const rows=density.filter(d=>d.aircraft>=low&&d.aircraft<=high);return {ticks:rows.length,meanMs:rows.reduce((s,d)=>s+d.ms,0)/(rows.length||1),meanSnapshotBytes:rows.reduce((s,d)=>s+d.bytes,0)/(rows.length||1)};};
console.log(JSON.stringify({base,invariantCounter:g.invariantViolations??0,overload:process.env.AUDIT_OVERLOAD==='1',noHold:process.env.AUDIT_NO_HOLD==='1',seed,difficulty:g.difficulty,seconds:g.elapsed,players:6,maxAircraft,accepted,rejected,sampleChecks:checks,landed,failures,largestSnapshot,slowestTicks:[...density].sort((a,b)=>b.ms-a.ms).slice(0,4),tickMs:{median:percentile(ticks,.5),p95:percentile(ticks,.95),max:Math.max(...ticks)},snapshotBytes:{median:percentile(bytes,.5),max:Math.max(...bytes),sixClientsMax:Math.max(...bytes)*6},density:{light:group(0,5),heavy:group(10,18)}},null,2));
