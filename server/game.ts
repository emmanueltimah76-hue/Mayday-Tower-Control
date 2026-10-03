import {assignSquawk,updateAlerts} from './alerts.js';
import {flightProfiles,setRoute,advanceMotion,headingFromVelocity} from './motion.js';
import type {Aircraft,AircraftType,Command,GameState} from '../src/protocol.js';
import {airports,runwayName,runwayEnds,type Difficulty,type Point} from '../src/airports.js';
import * as legacy from './legacyGame.js';
export const performance:Record<AircraftType,{speed:number;landing:number;takeoff:number;taxi:number;fuel:number}>={light:{speed:70,landing:8,takeoff:7,taxi:10,fuel:150},regional:{speed:130,landing:10,takeoff:10,taxi:12,fuel:125},narrowbody:{speed:140,landing:12,takeoff:12,taxi:14,fuel:115},heavy:{speed:150,landing:18,takeoff:18,taxi:18,fuel:140}};
function lerp(a:Point,b:Point,t:number):Point{return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];}
function extend(a:Point,b:Point,length:number):Point{const d=Math.hypot(b[0]-a[0],b[1]-a[1])||1;return [a[0]+(a[0]-b[0])*length/d,a[1]+(a[1]-b[1])*length/d];}
function gatePoint(p:Aircraft):Point{return [230+(Number(p.gate?.slice(1)??1)%6)*36,390];}
function route(p:Aircraft,points:Point[],seconds:number,scale=.004){setRoute(p,points,scale);}
export function spawn(game:GameState,kind:'arrival'|'departure',emergency=false){
 if(!game.difficulty)return legacy.spawn(game,kind,emergency);
 const config=airports[game.difficulty],number=++game.sequence;
 const types:AircraftType[]=game.difficulty==='easy'?['light','light','regional']:game.difficulty==='medium'?['narrowbody','regional','narrowbody','heavy']:['narrowbody','heavy','regional','heavy','narrowbody'];
 const type=types[(number-1)%types.length],perf=performance[type];
 const airline=(type==='heavy'?['AAL','UAL','DAL']:['AAL','SWA','UAL','DAL'])[number%(type==='heavy'?3:4)];
 const p:Aircraft={id:`flight-${number}`,callsign:type==='light'?`N${100+number}TC`:`${airline} ${100+number*17}${type==='heavy'?' HEAVY':''}`,kind,status:kind==='arrival'?'approach':'gate',aircraftType:type,speed:perf.speed,groundSpeed:kind==='arrival'?perf.speed:0,altitude:0,remaining:0,fuel:emergency?Math.round(40*config.fuelFactor):Math.round(perf.fuel*config.fuelFactor),revision:0,emergency,gate:`G${1+(number%6)}`,taxiway:'A',approachRunway:(number-1)%config.runways.length,approachTime:Math.round(50*config.fuelFactor)};
 if(kind==='arrival'){const [start,end]=runwayEnds(game,p.approachRunway!);p.position=extend(start,end,85);p.heading=Math.atan2(end[0]-start[0],-(end[1]-start[1]))*180/Math.PI;p.altitude=85*config.nmPerUnit*318;}else p.position=gatePoint(p);
 p.normalSquawk=assignSquawk(game);p.squawk=emergency?'7700':p.normalSquawk;game.aircraft.push(p);
}
export function createGame(players:number,difficulty?:Difficulty):GameState{
 if(!difficulty)return legacy.createGame(players);
 const c=airports[difficulty];const game:GameState={difficulty,direction:0,wind:{heading:difficulty==='expert'?90:c.runways[0].heading,speed:8},nextRadioLoss:110,alerts:[],separationLosses:0,incursions:0,nextWind:155,wakeUntil:{},waveRemaining:0,nextWave:25,aircraft:[],score:0,handled:0,missed:0,unsafe:0,secondsLeft:420,elapsed:0,sequence:0,nextSpawn:25,trafficInterval:Math.max(7,c.interval-Math.max(0,players-2)),nextWeather:c.weatherEvery,nextEmergency:c.emergencyEvery,emergenciesHandled:0};spawn(game,'arrival');spawn(game,'departure');return game;
}
function intersects(a:Point,b:Point,c:Point,d:Point){const cross=(p:Point,q:Point,r:Point)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);return cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0;}
export function runwayBusy(game:GameState,index:number){if(!game.difficulty)return legacy.runwayBusy(game,index);const r=airports[game.difficulty].runways[index];if(!r)return true;return game.aircraft.some(p=>p.runway!==undefined&&['landing','takeoff','taxi-in'].includes(p.status)&&!p.onFinal&&(p.runway===index||intersects(r.start,r.end,airports[game.difficulty!].runways[p.runway].start,airports[game.difficulty!].runways[p.runway].end)));}
export function wakeRemaining(game:GameState,index:number,p?:Aircraft){const left=(game.wakeUntil?.[index]??0)-game.elapsed;return Math.max(0,left-(p?.aircraftType==='heavy'?8:0));}
export function command(game:GameState,id:unknown,action:Command,runway:unknown,revision:unknown,controller:string):{error?:string;event?:string;changed?:boolean}{
 if(!game.difficulty)return legacy.command(game,id,action,runway,revision,controller);
 const p=game.aircraft.find(a=>a.id===id);if(!p)return {error:'That aircraft has already left the airport.'};if(p.revision!==revision)return {error:'Another controller already updated this aircraft. Check its current status.'};
 const valid=(action==='hold'&&p.status==='approach')||(action==='land'&&['approach','holding','go-around'].includes(p.status))||(action==='taxi'&&((p.status==='landing'&&!p.onFinal&&p.remaining===0)||p.status==='gate'))||(action==='takeoff'&&p.status==='queued');if(!valid)return {error:'That command is not available at this stage.'};
 const assign=action==='land'||(action==='taxi'&&p.status==='gate');const r=assign?runway:p.runway;
 if(action!=='hold'&&(typeof r!=='number'||!Number.isInteger(r)||!airports[game.difficulty].runways[r]))return {error:'Select an available runway.'};
 if(assign||action==='takeoff'){
  const index=r as number;
  if(game.weather?.runway===index)return {error:'Runway closed by crosswinds. Use another runway.'};
  if(runwayBusy(game,index)){return {error:'Runway or crossing runway occupied. Unsafe clearance rejected; no penalty because entry was prevented.'};}
  if((action==='land'||action==='takeoff')&&wakeRemaining(game,index,p)>0)return {error:`Wake turbulence: wait ${wakeRemaining(game,index,p)}s before clearing ${p.callsign}.`};
 }
 if(assign)p.runway=r as number;
 const perf=performance[p.aircraftType??'narrowbody'];const scale=airports[game.difficulty].nmPerUnit;const name=runwayName(game,p.runway??0);
 if(action==='hold'){p.status='holding';p.route=undefined;p.remaining=0;p.holdingCenter=undefined;p.holdingPhase=undefined;}
 if(action==='land'){const [start,end]=runwayEnds(game,p.runway!);p.status='landing';p.onFinal=true;route(p,[p.position??extend(start,end,70),start],Math.round(1100/perf.speed),scale);}
 if(action==='taxi'){
  const [start]=runwayEnds(game,p.runway!);const gate=gatePoint(p);const ahead=game.aircraft.filter(q=>q.id!==p.id&&q.runway===p.runway&&['taxi-out','queued'].includes(q.status)).length;const hold:Point=lerp(start,gate,Math.min(.42,.10+ahead*.055));const from=p.position??gate;p.status=p.kind==='arrival'?'taxi-in':'taxi-out';route(p,[from,[from[0],370],[hold[0],370],p.kind==='arrival'?gate:hold],perf.taxi,scale);
 }
 if(action==='takeoff'){const first=game.aircraft.find(q=>q.runway===p.runway&&['taxi-out','queued'].includes(q.status));if(first&&first.id!==p.id)return {error:'Another departure is ahead in the hold-short queue. Clear it first.'};const [start,end]=runwayEnds(game,p.runway!);p.takeoffRollIndex=Math.hypot((p.position??start)[0]-start[0],(p.position??start)[1]-start[1])<.01?1:2;p.status='takeoff';route(p,[p.position??start,start,end,extend(end,start,60)],perf.takeoff,scale);}
 p.controller=controller;p.revision++;
 const text=action==='land'?`runway ${name}, cleared to land`:action==='takeoff'?`runway ${name}, cleared for takeoff`:action==='hold'?'hold, expect further clearance':p.kind==='arrival'?`taxi via A to ${p.gate}`:`taxi via A, hold short runway ${name}`;
 return {event:`${p.callsign}, ${text}.`,changed:true};
}
function goAround(game:GameState,p:Aircraft,emit:(s:string)=>void,reason:string){const [start,end]=runwayEnds(game,p.runway??p.approachRunway??0);p.status='go-around';p.onFinal=false;p.goArounds=(p.goArounds??0)+1;p.revision++;p.approachTime=35;route(p,[p.position??start,extend(end,start,50),extend(start,end,80)],15,airports[game.difficulty!].nmPerUnit);emit(`${p.callsign}, go around. ${reason} Rejoin approach and request clearance.`);}
export function tickGame(game:GameState,seconds:number,emit:(s:string)=>void){
 if(!game.difficulty)return legacy.tickGame(game,seconds,emit);
 const config=airports[game.difficulty];
 for(let n=0;n<seconds&&game.secondsLeft>0;n++){
  game.elapsed++;game.secondsLeft--;
  for(const p of game.aircraft)if(p.radioLost&&game.elapsed>=(p.radioRestoreAt??0)){p.radioLost=false;p.squawk=p.emergency?'7700':p.normalSquawk;p.revision++;emit(`${p.callsign}, radio contact restored, squawk ${p.squawk}.`);}
  if(game.elapsed>=(game.nextRadioLoss??110)&&game.secondsLeft>50){const p=game.aircraft.find(p=>!p.emergency&&!p.radioLost&&['approach','holding'].includes(p.status));if(p){p.radioLost=true;p.squawk='7600';p.radioRestoreAt=game.elapsed+25;p.revision++;emit(`${p.callsign}, radio contact lost, squawk 7600. Existing clearances remain active.`);}game.nextRadioLoss=game.elapsed+130;}

  for(const p of [...game.aircraft]){
   if(['approach','holding','go-around','gate','queued'].includes(p.status)||p.onFinal){p.fuel--;if(p.fuel<=0){game.aircraft=game.aircraft.filter(a=>a!==p);game.score-=p.emergency?150:50;game.missed++;emit(`${p.callsign}, ${p.kind==='arrival'?'diverting':'departure cancelled'} (${p.emergency?'−150':'−50'}).`);continue;}}
   let arrived=false;
   for(let step=0;step<10;step++){
    if(p.status==='holding'){
     // Begin the circuit at the current position. Never teleport to a phase based on global time.
     const radius=32;const h=(p.heading??0)*Math.PI/180;
     if(!p.holdingCenter){const from=p.position!;p.holdingCenter=[from[0]+Math.cos(h)*radius,from[1]+Math.sin(h)*radius];p.holdingPhase=Math.atan2(from[1]-p.holdingCenter[1],from[0]-p.holdingCenter[0]);}
     const before=p.position!;p.holdingPhase!+=(p.groundSpeed??0)*.1/(3600*config.nmPerUnit*radius);p.position=[p.holdingCenter[0]+Math.cos(p.holdingPhase!)*radius,p.holdingCenter[1]+Math.sin(p.holdingPhase!)*radius];p.heading=headingFromVelocity(p.heading??0,p.position[0]-before[0],p.position[1]-before[1],p.aircraftType==='light'?6:3,.1);
    }else if(p.status==='approach'){
     if(!p.route){const [start,end]=runwayEnds(game,p.approachRunway??0);setRoute(p,[p.position!,extend(start,end,15)],config.nmPerUnit);}
     arrived=advanceMotion(p,.1,config.nmPerUnit);p.approachTime=p.remaining;
     if(arrived){if(runwayBusy(game,p.approachRunway??0)||game.weather?.runway===p.approachRunway)goAround(game,p,emit,'Runway unavailable on short final.');else{p.status='holding';p.holdingCenter=undefined;p.revision++;emit(`${p.callsign}, hold for landing clearance.`);}break;}
    }else if(p.route&&p.remaining>0){arrived=advanceMotion(p,.1,config.nmPerUnit);if(arrived)break;}
    else if(['gate','queued'].includes(p.status)||(p.status==='landing'&&!p.onFinal&&p.remaining===0)){p.groundSpeed=Math.max(0,(p.groundSpeed??0)-flightProfiles[p.aircraftType??'narrowbody'].brake*.1);}
   }
   if(arrived&&p.status!=='holding'&&p.status!=='approach'){p.revision++;

    if(p.onFinal){
     if(runwayBusy(game,p.runway!)||game.weather?.runway===p.runway||wakeRemaining(game,p.runway!,p)>0){goAround(game,p,emit,'Runway or wake spacing unavailable on short final.');continue;}
     const [start,end]=runwayEnds(game,p.runway!);const speed=p.groundSpeed??0,brake=flightProfiles[p.aircraftType??'narrowbody'].brake;const length=Math.hypot(end[0]-start[0],end[1]-start[1]);const roll=speed*speed/(2*brake*3600*config.nmPerUnit);p.status='landing';p.onFinal=false;route(p,[p.position!,lerp(start,end,Math.min(.9,roll/length))],performance[p.aircraftType??'narrowbody'].landing,config.nmPerUnit);
    }else if(p.status==='landing')emit(`${p.callsign}, vacate runway ${runwayName(game,p.runway!)} via A.`);
    else if(p.status==='taxi-out'){p.status='queued';emit(`${p.callsign}, holding short runway ${runwayName(game,p.runway!)}.`);}
    else if(p.status==='go-around'){p.status='holding';p.route=undefined;p.holdingCenter=undefined;}
    else if(p.status==='taxi-in'||p.status==='takeoff'){
     if(p.aircraftType==='heavy')game.wakeUntil![p.runway!]=game.elapsed+25;
     game.aircraft=game.aircraft.filter(a=>a!==p);game.handled++;game.score+=p.emergency?250:100;if(p.emergency)game.emergenciesHandled++;emit(`${p.callsign}, ${p.kind==='arrival'?`parked at ${p.gate}`:'departure complete'} (+${p.emergency?250:100}).`);
    }
   }
  }
  updateAlerts(game,emit);
  if(game.weather&&game.elapsed>=game.weather.endsAt){emit(`Tower: runway ${runwayName(game,game.weather.runway)} reopened.`);game.weather=undefined;}
  if(game.elapsed>=game.nextWeather&&game.secondsLeft>40){const r=config.runways.findIndex((_,i)=>!runwayBusy(game,i)&&!game.aircraft.some(p=>p.status==='final'&&p.runway===i));if(r>=0){game.weather={runway:r,endsAt:game.elapsed+25};game.nextWeather=game.elapsed+config.weatherEvery;emit(`Crosswinds! Runway ${runwayName(game,r)} closed for 25 seconds.`);}else game.nextWeather=game.elapsed+5;}
  if(game.elapsed>=game.nextEmergency&&game.secondsLeft>40){if(game.aircraft.length<18){spawn(game,'arrival',true);emit(`MAYDAY! ${game.aircraft.at(-1)!.callsign}, low fuel, priority landing requested.`);game.nextEmergency=game.elapsed+config.emergencyEvery;}else game.nextEmergency=game.elapsed+5;}
  if(game.elapsed>=(game.nextWave??25)&&game.secondsLeft>35){game.waveRemaining=config.wave;game.nextWave=game.elapsed+game.trafficInterval*config.wave+18;game.nextSpawn=game.elapsed;emit('Approach: inbound traffic wave. Sequence arrivals and departures.');}
  if((game.waveRemaining??0)>0&&game.elapsed>=game.nextSpawn&&game.secondsLeft>20){if(game.aircraft.length<18){spawn(game,game.sequence%3===0?'departure':'arrival');game.waveRemaining!--;game.nextSpawn=game.elapsed+game.trafficInterval;}else game.nextSpawn=game.elapsed+5;}
  if(game.elapsed>=(game.nextWind??155)&&game.secondsLeft>50){
   if(game.aircraft.some(p=>['final','landing','takeoff','taxi-in','taxi-out'].includes(p.status))){game.nextWind=game.elapsed+5;}
   else{game.direction=game.direction===0?1:0;game.wind={heading:((game.difficulty==='expert'?90:config.runways[0].heading)+(game.direction?180:0))%360,speed:12};game.nextWind=game.elapsed+150;
    for(const p of game.aircraft){if(p.status==='queued'){const [start]=runwayEnds(game,p.runway!);route(p,[p.position!,[p.position![0],370],[start[0],370],lerp(start,gatePoint(p),.1)],performance[p.aircraftType??'narrowbody'].taxi,config.nmPerUnit);p.status='taxi-out';p.revision++;}if(p.status==='approach'){p.approachTime=50;const [start,end]=runwayEnds(game,p.approachRunway??0);route(p,[p.position!,extend(start,end,85),extend(start,end,15)],30,config.nmPerUnit);p.revision++;}}
    emit(`Tower: wind shift, ${Math.round(game.wind.heading)} degrees at ${game.wind.speed} knots. Active runways now ${config.runways.map((_,i)=>runwayName(game,i)).join(', ')}. Departures retaxi to the new hold-short points.`);
   }
  }
 }
}
