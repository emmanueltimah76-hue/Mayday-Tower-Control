import {balance,fuelBurnPerSecond,points} from '../src/balance.js';
import {patternProfiles,patternGeometry} from '../src/flightPatterns.js';
import {beginPattern,beginGoAround,advancePattern,stabilized} from './patterns.js';
import {routeLength} from './motion.js';
import {FEET_PER_NM,SECONDS_PER_HOUR,NM_PER_MAP_UNIT,MOTION_STEP_SECONDS} from '../src/mapConstants.js';
import {stands,serviceSteps,serviceSeconds} from '../src/ramps.js';
import {departureRoute,entryRoute,groundRoute,taxiName} from '../src/routes.js';
import {assignSquawk,updateAlerts} from './alerts.js';
import {flightProfiles,setRoute,advanceMotion} from './motion.js';
import type {Aircraft,AircraftType,Command,GameState} from '../src/protocol.js';
import {airports,runwayName,runwayEnds,type Difficulty,type Point} from '../src/airports.js';
import * as legacy from './legacyGame.js';
export const performance:Record<AircraftType,{speed:number;landing:number;takeoff:number;taxi:number;fuel:number}>={light:{speed:70,landing:8,takeoff:7,taxi:10,fuel:150},regional:{speed:130,landing:10,takeoff:10,taxi:12,fuel:125},narrowbody:{speed:140,landing:12,takeoff:12,taxi:14,fuel:115},heavy:{speed:150,landing:18,takeoff:18,taxi:18,fuel:140}};
function lerp(a:Point,b:Point,t:number):Point{return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];}

function gatePoint(p:Aircraft,game?:GameState):Point{return game?.difficulty?stands[game.difficulty].find(s=>s.id===p.gate)?.position??[350,390]:[230+(Number(p.gate?.slice(1)??1)%6)*36,390];}
export function openStand(game:GameState){return game.difficulty?stands[game.difficulty].find(s=>!game.aircraft.some(p=>p.standId===s.id)):undefined;}
function route(p:Aircraft,points:Point[],seconds:number,scale=NM_PER_MAP_UNIT){setRoute(p,points,scale);}
export function spawn(game:GameState,kind:'arrival'|'departure',emergency=false){
 if(!game.difficulty)return legacy.spawn(game,kind,emergency);
 const config=airports[game.difficulty];const free=kind==='departure'?openStand(game):undefined;if(kind==='departure'&&!free)return;const number=++game.sequence;
 const types:AircraftType[]=game.difficulty==='easy'?['light','light','regional']:game.difficulty==='medium'?['narrowbody','regional','narrowbody','heavy']:['narrowbody','heavy','regional','heavy','narrowbody'];
 const type=types[(number-1)%types.length],perf=performance[type];
 const airline=(type==='heavy'?['AAL','UAL','DAL']:['AAL','SWA','UAL','DAL'])[number%(type==='heavy'?3:4)];
 const p:Aircraft={id:`flight-${number}`,callsign:type==='light'?`N${100+number}TC`:`${airline} ${100+number*17}${type==='heavy'?' HEAVY':''}`,kind,status:kind==='arrival'?'approach':'gate',aircraftType:type,speed:perf.speed,groundSpeed:kind==='arrival'?perf.speed:0,altitude:0,remaining:0,fuel:emergency?Math.round(40*config.fuelFactor):Math.round(perf.fuel*config.fuelFactor),revision:0,emergency,gate:`G${1+(number%6)}`,taxiway:'A',approachRunway:(number-1)%config.runways.length,approachTime:Math.round(50*config.fuelFactor)};
 if(kind==='arrival'){const inbound=entryRoute(game,p.approachRunway!,type);p.inboundFix=inbound.name;p.position=inbound.points[0];const target=inbound.points[1];p.heading=Math.atan2(target[0]-p.position![0],-(target[1]-p.position![1]))*180/Math.PI;p.groundSpeed=patternProfiles[type].inbound;p.altitude=patternProfiles[type].altitude+500;beginPattern(game,p);}else{p.gate=free!.id;p.standId=free!.id;p.position=free!.position;p.heading=0;}
 if(kind==='arrival'){const budget=Math.ceil(routeLength(p.route!)*NM_PER_MAP_UNIT*SECONDS_PER_HOUR/patternProfiles[type].downwind)+60;p.fuel=budget+(emergency?balance[game.difficulty].emergencyReserve:balance[game.difficulty].reserve);}
 p.normalSquawk=assignSquawk(game);p.squawk=emergency?'7700':p.normalSquawk;game.aircraft.push(p);
}
export function createGame(players:number,difficulty?:Difficulty):GameState{
 if(!difficulty)return legacy.createGame(players);
 const c=airports[difficulty],tuning=balance[difficulty];const game:GameState={difficulty,direction:0,wind:{heading:difficulty==='expert'?90:c.runways[0].heading,speed:8},nextRadioLoss:110,alerts:[],separationLosses:0,incursions:0,nextWind:155,wakeUntil:{},waveRemaining:0,nextWave:25,aircraft:[],score:0,handled:0,missed:0,unsafe:0,secondsLeft:420,elapsed:0,sequence:0,nextSpawn:25,trafficInterval:Math.max(14,tuning.interval-Math.max(0,players-2)),nextWeather:c.weatherEvery,nextEmergency:20,emergenciesHandled:0};spawn(game,'arrival');spawn(game,'departure');return game;
}
function intersects(a:Point,b:Point,c:Point,d:Point){const cross=(p:Point,q:Point,r:Point)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);return cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0;}
export function runwayBusy(game:GameState,index:number){if(!game.difficulty)return legacy.runwayBusy(game,index);const r=airports[game.difficulty].runways[index];if(!r)return true;return game.aircraft.some(p=>p.runway!==undefined&&['landing','takeoff','taxi-in'].includes(p.status)&&!p.onFinal&&(p.runway===index||intersects(r.start,r.end,airports[game.difficulty!].runways[p.runway].start,airports[game.difficulty!].runways[p.runway].end)));}
export function wakeRemaining(game:GameState,index:number,p?:Aircraft){const left=(game.wakeUntil?.[index]??0)-game.elapsed;return Math.max(0,left-(p?.aircraftType==='heavy'?8:0));}
export function command(game:GameState,id:unknown,action:Command,runway:unknown,revision:unknown,controller:string):{error?:string;event?:string;changed?:boolean}{
 if(!game.difficulty){if(action==='pushback')return {error:'Pushback is only available at real airports.'};return legacy.command(game,id,action,runway,revision,controller);}
 const p=game.aircraft.find(a=>a.id===id);if(!p)return {error:'That aircraft has already left the airport.'};if(p.revision!==revision)return {error:'Another controller already updated this aircraft. Check its current status.'};
 if(action==='pushback'){if(p.status!=='gate'||!p.needsPushback)return {error:'Finish turnaround before requesting pushback.'};p.status='pushback';p.kind='departure';p.fuel=Math.round(performance[p.aircraftType??'narrowbody'].fuel*airports[game.difficulty].fuelFactor);p.emergency=false;p.squawk=p.normalSquawk;p.runway=undefined;p.controller=controller;p.revision++;p.route=undefined;p.remaining=p.aircraftType==='heavy'?45:p.aircraftType==='narrowbody'?30:p.aircraftType==='regional'?20:12;p.groundSpeed=0;return {changed:true,event:`${p.callsign}, pushback approved from ${p.gate}.`};}
 const valid=(action==='hold'&&p.kind==='arrival'&&(['approach','holding','go-around'].includes(p.status)||p.onFinal))||(action==='land'&&p.kind==='arrival'&&(['approach','holding','go-around'].includes(p.status)||p.onFinal))||(action==='taxi'&&((p.status==='landing'&&!p.onFinal&&p.remaining===0)||(p.status==='gate'&&!p.needsPushback)))||(action==='takeoff'&&p.status==='queued');if(!valid)return {error:`${action.toUpperCase()} is unavailable while ${p.status}${p.onFinal?' on final':''}. ${action==='taxi'?'Wait for landing to stop or turnaround/pushback to finish.':action==='takeoff'?'Taxi to the hold-short point first.':action==='hold'?'Hold requires an inbound arrival.':'Landing requires an airborne arrival.'}`};
 const assign=action==='land'||(action==='taxi'&&p.status==='gate');const r=assign?runway:p.runway;
 if(action!=='hold'&&(typeof r!=='number'||!Number.isInteger(r)||!airports[game.difficulty].runways[r]))return {error:'Select an available runway.'};
 if(assign||action==='takeoff'){
  const index=r as number;
  if(game.weather?.runway===index)return {error:'Runway closed by crosswinds. Use another runway.'};
  if(runwayBusy(game,index)){return {error:'Runway or crossing runway occupied. Unsafe clearance rejected; no penalty because entry was prevented.'};}
  if((action==='land'||action==='takeoff')&&wakeRemaining(game,index,p)>0)return {error:`Wake turbulence: wait ${wakeRemaining(game,index,p)}s before clearing ${p.callsign}.`};
 }
 if(action==='taxi'&&p.kind==='arrival'){const free=openStand(game);if(!free)return {error:'Ramp full. Keep position until a stand opens; push back a ready aircraft.'};p.gate=free.id;p.standId=free.id;}
 if(action==='land'&&p.clearedToLand)return {error:'Landing clearance is already active. Continue the current pattern.'};
 if(assign)p.runway=r as number;
 const perf=performance[p.aircraftType??'narrowbody'];const scale=airports[game.difficulty].nmPerUnit;const name=runwayName(game,p.runway??0);
 if(action==='hold'){beginGoAround(game,p,true);}
 if(action==='land'){if(!p.patternLegs||p.approachRunway!==p.runway){p.approachRunway=p.runway;beginGoAround(game,p,!!p.holdRequested);}p.clearedToLand=true;}
 if(action==='taxi'){
  const [start]=runwayEnds(game,p.runway!);const gate=gatePoint(p,game);const ahead=game.aircraft.filter(q=>q.id!==p.id&&q.runway===p.runway&&['taxi-out','queued'].includes(q.status)).length;const hold:Point=lerp(start,gate,Math.min(.42,.10+ahead*.055));const from=p.position??gate;p.status=p.kind==='arrival'?'taxi-in':'taxi-out';p.taxiway=taxiName(game.difficulty,p.runway!);route(p,groundRoute(game,p.runway!,gate,from,p.kind==='arrival',ahead),perf.taxi,scale);
 }
 if(action==='takeoff'){const first=game.aircraft.find(q=>q.runway===p.runway&&['taxi-out','queued'].includes(q.status));if(first&&first.id!==p.id)return {error:'Another departure is ahead in the hold-short queue. Clear it first.'};const [start,end]=runwayEnds(game,p.runway!);p.takeoffRollIndex=Math.hypot((p.position??start)[0]-start[0],(p.position??start)[1]-start[1])<.01?1:2;p.outboundFix=`OUT-${p.runway!+1}${game.direction?'B':'A'}`;p.status='takeoff';const outbound=departureRoute(game,p.runway!,p.aircraftType);p.patternLeg='line-up';p.targetAltitude=p.targetSpeed=p.targetHeading=p.finalCourse=undefined;route(p,[p.position??start,...outbound],perf.takeoff,scale);}
 p.controller=controller;p.revision++;
 const text=action==='land'?`runway ${name}, cleared to land`:action==='takeoff'?`runway ${name}, cleared for takeoff`:action==='hold'?'hold, expect further clearance':p.kind==='arrival'?`taxi via ${p.taxiway??'A'} to ${p.gate}`:`taxi via ${p.taxiway??'A'}, hold short runway ${name}`;
 return {event:`${p.callsign}, ${text}.`,changed:true};
}
function goAround(game:GameState,p:Aircraft,emit:(s:string)=>void,reason:string){p.goArounds=(p.goArounds??0)+1;p.revision++;beginGoAround(game,p,!!p.holdRequested);emit(`${p.callsign}, go around. ${reason} Climb 1,500 feet AGL, rejoin downwind, request landing clearance.`);}
export function tickGame(game:GameState,seconds:number,emit:(s:string)=>void){
 if(!game.difficulty)return legacy.tickGame(game,seconds,emit);
 const config=airports[game.difficulty];
 for(let n=0;n<seconds&&game.secondsLeft>0;n++){
  game.elapsed++;game.secondsLeft--;
  for(const p of game.aircraft)if(p.radioLost&&game.elapsed>=(p.radioRestoreAt??0)){p.radioLost=false;p.squawk=p.emergency?'7700':p.normalSquawk;p.revision++;emit(`${p.callsign}, radio contact restored, squawk ${p.squawk}.`);}
  if(game.elapsed>=(game.nextRadioLoss??110)&&game.secondsLeft>50){const p=game.aircraft.find(p=>!p.emergency&&!p.radioLost&&['approach','holding'].includes(p.status));if(p){p.radioLost=true;p.squawk='7600';p.radioRestoreAt=game.elapsed+25;p.revision++;emit(`${p.callsign}, radio contact lost, squawk 7600. Existing clearances remain active.`);}game.nextRadioLoss=game.elapsed+130;}

  for(const p of [...game.aircraft]){
   if(p.status==='turnaround'){p.serviceLeft=Math.max(0,(p.serviceLeft??1)-1);if(p.serviceLeft===0){p.serviceStep=(p.serviceStep??0)+1;p.revision++;if(p.serviceStep>=serviceSteps.length){p.status='gate';p.needsPushback=true;emit(`${p.callsign}, turnaround complete at ${p.gate}, ready for pushback.`);}else{p.serviceLeft=serviceSeconds(p.aircraftType);emit(`${p.callsign}, ${serviceSteps[p.serviceStep].toLowerCase()} at ${p.gate}.`);}}continue;}
   if(p.status==='pushback'){const move=3/(SECONDS_PER_HOUR*config.nmPerUnit);p.position=[p.position![0],p.position![1]+move];p.groundSpeed=3;p.remaining--;if(p.remaining<=0){p.status='gate';p.needsPushback=false;p.standId=undefined;p.groundSpeed=0;p.revision++;emit(`${p.callsign}, pushback complete, request taxi clearance.`);}continue;}

   if((['approach','holding','go-around','gate','queued'].includes(p.status)&&!p.needsPushback)||p.onFinal){p.fuel-=fuelBurnPerSecond;if(p.fuel<=0){game.aircraft=game.aircraft.filter(a=>a!==p);game.score-=p.emergency?points.emergencyMissed:points.missed;game.missed++;emit(`${p.callsign}, ${p.kind==='arrival'?'diverting':'departure cancelled'} (${p.emergency?'−150':'−50'}).`);continue;}}
   p.motionSamples=[{position:[...p.position!],heading:p.heading??0}];
   let arrived=false;
   for(let step=0;step<10;step++){
    if(p.patternLegs&&(['approach','holding','go-around'].includes(p.status)||p.onFinal)){
     const previous=p.patternLeg;
     const index=p.runway??p.approachRunway??0;
     const geometry=patternGeometry(game,index,p.aircraftType);
     const along=(p.position![0]-geometry.start[0])*geometry.u[0]+(p.position![1]-geometry.start[1])*geometry.u[1];
     const shortFinal=p.patternPhase==='final'&&along<0&&-along*NM_PER_MAP_UNIT<.25;
     if(shortFinal&&(!p.clearedToLand||p.holdRequested||runwayBusy(game,index)||game.weather?.runway===index||wakeRemaining(game,index,p)>0)){
      goAround(game,p,emit,!p.clearedToLand?'No landing clearance.':'Runway, hold or wake spacing unavailable.');
     }
     arrived=advancePattern(game,p,MOTION_STEP_SECONDS);p.approachTime=p.remaining;
     if(previous!==p.patternLeg){p.revision++;if(p.patternLeg==='rejoin')emit(`${p.callsign}, rejoining downwind at ${Math.round(p.altitude??0)} feet AGL.`);}
     if(arrived&&p.patternLeg==='final'){
      if(!p.clearedToLand||!stabilized(game,p)){goAround(game,p,emit,'Approach not stabilized.');arrived=false;}
      else{p.onFinal=true;p.status='landing';p.runway=p.runway??p.approachRunway;}
     }
     if(arrived)break;
    }else if(p.route&&p.remaining>0){arrived=advanceMotion(p,.1,config.nmPerUnit);if(arrived)break;}
    else if(['gate','queued'].includes(p.status)||(p.status==='landing'&&!p.onFinal&&p.remaining===0)){p.groundSpeed=Math.max(0,(p.groundSpeed??0)-flightProfiles[p.aircraftType??'narrowbody'].brake*.1);}
    p.motionSamples.push({position:[...p.position!],heading:p.heading??0});
   }
   if(Math.hypot(p.motionSamples.at(-1)!.position[0]-p.position![0],p.motionSamples.at(-1)!.position[1]-p.position![1])>1e-9)p.motionSamples.push({position:[...p.position!],heading:p.heading??0});
   while(p.motionSamples.length<11)p.motionSamples.push({position:[...p.position!],heading:p.heading??0});
   if(p.status==='taxi-out'&&p.standId){const stand=stands[game.difficulty].find(s=>s.id===p.standId)!;const clearance=(p.aircraftType==='heavy'?220:p.aircraftType==='narrowbody'?150:80)/FEET_PER_NM;if(Math.hypot(p.position![0]-stand.position[0],p.position![1]-stand.position[1])*config.nmPerUnit>clearance)p.standId=undefined;}
   if(p.status==='takeoff'){p.patternLeg=(p.routeIndex??1)<(p.takeoffRollIndex??1)?'line-up':(p.altitude??0)<10?'takeoff-roll':(p.routeIndex??1)<p.route!.length-1?'climb-out':'outbound';}
   if(arrived&&p.status!=='holding'&&p.status!=='approach'){p.revision++;

    if(p.onFinal){
     if(runwayBusy(game,p.runway!)||game.weather?.runway===p.runway||wakeRemaining(game,p.runway!,p)>0){goAround(game,p,emit,'Runway or wake spacing unavailable on short final.');continue;}
     const [start,end]=runwayEnds(game,p.runway!);const speed=p.groundSpeed??0,brake=flightProfiles[p.aircraftType??'narrowbody'].brake;const length=Math.hypot(end[0]-start[0],end[1]-start[1]);const roll=speed*speed/(2*brake*SECONDS_PER_HOUR*config.nmPerUnit);p.status='landing';p.onFinal=false;p.patternPhase=undefined;p.currentTarget=undefined;p.patternLeg=p.patternLegs=undefined;p.targetAltitude=p.targetSpeed=p.targetHeading=p.finalCourse=undefined;route(p,[p.position!,lerp(start,end,Math.min(.9,roll/length))],performance[p.aircraftType??'narrowbody'].landing,config.nmPerUnit);
    }else if(p.status==='landing')emit(`${p.callsign}, vacate runway ${runwayName(game,p.runway!)} via ${p.taxiway??'A'}.`);
    else if(p.status==='taxi-out'){p.status='queued';emit(`${p.callsign}, holding short runway ${runwayName(game,p.runway!)}.`);}
    else if(p.status==='go-around'){p.status='holding';p.route=undefined;p.holdingCenter=undefined;}
    else if(p.status==='taxi-in'){
     if(p.aircraftType==='heavy')game.wakeUntil![p.runway!]=game.elapsed+25;
     if(!p.arrivalCredited){game.handled++;game.score+=p.emergency?points.emergencyHandled:points.handled;if(p.emergency)game.emergenciesHandled++;p.arrivalCredited=true;}p.status='turnaround';p.groundSpeed=0;p.runway=undefined;p.route=undefined;p.serviceStep=0;p.serviceLeft=serviceSeconds(p.aircraftType);p.needsPushback=true;emit(`${p.callsign}, parked at ${p.gate}, deplane started (+${p.emergency?250:100}).`);
    }else if(p.status==='takeoff'){
     if(p.aircraftType==='heavy')game.wakeUntil![p.runway!]=game.elapsed+25;
     game.aircraft=game.aircraft.filter(a=>a!==p);game.handled++;game.score+=p.emergency?points.emergencyHandled:points.handled;if(p.emergency)game.emergenciesHandled++;emit(`${p.callsign}, ${p.kind==='arrival'?`parked at ${p.gate}`:'departure complete'} (+${p.emergency?250:100}).`);
    }
   }
  }
  updateAlerts(game,emit);
  if(game.weather&&game.elapsed>=game.weather.endsAt){emit(`Tower: runway ${runwayName(game,game.weather.runway)} reopened.`);game.weather=undefined;}
  if(game.elapsed>=game.nextWeather&&game.secondsLeft>40){const r=config.runways.findIndex((_,i)=>!runwayBusy(game,i)&&!game.aircraft.some(p=>p.status==='final'&&p.runway===i));if(r>=0){game.weather={runway:r,endsAt:game.elapsed+25};game.nextWeather=game.elapsed+config.weatherEvery;emit(`Crosswinds! Runway ${runwayName(game,r)} closed for 25 seconds.`);}else game.nextWeather=game.elapsed+5;}
  if(game.elapsed>=game.nextEmergency&&game.secondsLeft>40){if(game.aircraft.length<18){spawn(game,'arrival',true);const candidate=game.aircraft.at(-1)!;const budget=candidate.fuel-balance[game.difficulty].emergencyReserve;if(game.secondsLeft<budget+30){game.aircraft.pop();}else emit(`MAYDAY! ${game.aircraft.at(-1)!.callsign}, low fuel, priority landing requested.`);game.nextEmergency=game.elapsed+balance[game.difficulty].emergencyEvery;}else game.nextEmergency=game.elapsed+5;}
  if(game.elapsed>=(game.nextWave??25)&&game.secondsLeft>35){game.waveRemaining=balance[game.difficulty].wave;game.nextWave=game.elapsed+game.trafficInterval*balance[game.difficulty].wave+balance[game.difficulty].waveGap;game.nextSpawn=game.elapsed;emit('Approach: inbound traffic wave. Sequence arrivals and departures.');}
  if((game.waveRemaining??0)>0&&game.elapsed>=game.nextSpawn&&game.secondsLeft>20){if(game.aircraft.length<18){const kind=game.sequence%3===0&&openStand(game)?'departure':'arrival';const before=game.aircraft.length;spawn(game,kind);if(kind==='arrival'&&game.aircraft.length>before){const candidate=game.aircraft.at(-1)!;const budget=candidate.fuel-balance[game.difficulty].reserve;if(game.secondsLeft<budget+60){game.aircraft.pop();if(openStand(game)&&game.secondsLeft>100)spawn(game,'departure');}}game.waveRemaining!--;game.nextSpawn=game.elapsed+game.trafficInterval;}else game.nextSpawn=game.elapsed+5;}
  if(game.elapsed>=(game.nextWind??155)&&game.secondsLeft>50){
   if(game.aircraft.some(p=>p.clearedToLand||['final','landing','takeoff','taxi-in','taxi-out'].includes(p.status))){game.nextWind=game.elapsed+5;}
   else{game.direction=game.direction===0?1:0;game.wind={heading:((game.difficulty==='expert'?90:config.runways[0].heading)+(game.direction?180:0))%360,speed:12};game.nextWind=game.elapsed+150;
    for(const p of game.aircraft){if(p.status==='queued'){const [start]=runwayEnds(game,p.runway!);route(p,groundRoute(game,p.runway!,gatePoint(p,game),p.position!,false),performance[p.aircraftType??'narrowbody'].taxi,config.nmPerUnit);p.status='taxi-out';p.revision++;}if(['approach','holding','go-around'].includes(p.status)){p.clearedToLand=false;beginGoAround(game,p,!!p.holdRequested);p.revision++;}}
    emit(`Tower: wind shift, ${Math.round(game.wind.heading)} degrees at ${game.wind.speed} knots. Active runways now ${config.runways.map((_,i)=>runwayName(game,i)).join(', ')}. Departures retaxi to the new hold-short points.`);
   }
  }
 }
}
