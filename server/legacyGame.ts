import type { Aircraft, Command, GameState } from '../src/protocol.js';
const waiting = new Set(['approach','holding','gate','queued']);
export function spawn(game: GameState, kind: 'arrival' | 'departure', emergency = false) {
 const number=++game.sequence;
 game.aircraft.push({id:`flight-${number}`,callsign:`N${String(100+number)}TC`,kind,status:kind==='arrival'?'approach':'gate',remaining:0,fuel:emergency?35:kind==='arrival'?90:120,revision:0,emergency});
}
export function createGame(players: number): GameState {
 const game: GameState={aircraft:[],score:0,handled:0,missed:0,unsafe:0,secondsLeft:420,elapsed:0,sequence:0,nextSpawn:15,trafficInterval:Math.max(10,20-players*2),nextWeather:75,nextEmergency:45,emergenciesHandled:0};
 spawn(game,'arrival');spawn(game,'departure');return game;
}
export function runwayBusy(game: GameState, runway: number) { return game.aircraft.some(a=>a.runway===runway && ['landing','taxi-in','taxi-out','queued','takeoff'].includes(a.status)); }
export function command(game: GameState, aircraftId: unknown, action: Command, runway: unknown, revision: unknown, controller: string): {error?: string; event?: string; changed?: boolean} {
 const plane=game.aircraft.find(a=>a.id===aircraftId);
 if(!plane)return {error:'That aircraft has already left the airport.'};
 if(plane.revision!==revision)return {error:'Another controller already updated this aircraft. Check its current status.'};
 const valid=(action==='hold' && plane.status==='approach') || (action==='land' && ['approach','holding'].includes(plane.status)) || (action==='taxi' && ['landing','gate'].includes(plane.status)) || (action==='takeoff' && plane.status==='queued');
 if(!valid)return {error:'That command is not available at this stage.'};
 if(action==='taxi' && plane.status==='landing' && plane.remaining>0)return {error:'The aircraft is still landing. Wait until it stops.'};
 if(action==='land' || (action==='taxi' && plane.status==='gate')) {
  if(runway!==0 && runway!==1)return {error:'Select runway 09 or 27.'};
  if(game.weather?.runway===runway)return {error:'Runway closed by crosswinds. Use the other runway.'};
  if(runwayBusy(game,runway)){game.score-=25;game.unsafe++;return {error:'Runway occupied. Unsafe clearance rejected (−25).',changed:true};}
  plane.runway=runway;
 }
 if(action==='takeoff' && game.weather?.runway===plane.runway)return {error:'Runway closed by crosswinds. Wait for it to reopen.'};
 if(action==='hold'){plane.status='holding';}
 if(action==='land'){plane.status='landing';plane.remaining=10;}
 if(action==='taxi'){plane.status=plane.kind==='arrival'?'taxi-in':'taxi-out';plane.remaining=8;}
 if(action==='takeoff'){plane.status='takeoff';plane.remaining=10;}
 plane.controller=controller;plane.revision++;
 const phrases={hold:'hold position',land:`land on runway ${plane.runway===0?'09':'27'}`,taxi:plane.kind==='arrival'?'taxi to the terminal':`taxi to runway ${plane.runway===0?'09':'27'}`,takeoff:'take off'};
 return {event:`${controller}: ${plane.callsign}, ${phrases[action]}.`,changed:true};
}
export function tickGame(game: GameState, seconds: number, emit: (text:string)=>void) {
 for(let n=0;n<seconds && game.secondsLeft>0;n++) {
  game.elapsed++;game.secondsLeft--;
  for(const plane of [...game.aircraft]) {
   if(waiting.has(plane.status)){plane.fuel--;if(plane.fuel<=0){game.aircraft=game.aircraft.filter(a=>a!==plane);const penalty=plane.emergency?150:50;game.score-=penalty;game.missed++;emit(`${plane.callsign} ${plane.kind==='arrival'?'diverted':'cancelled'} after waiting too long (−${penalty}).`);continue;}}
   if(plane.remaining>0){plane.remaining--;if(plane.remaining===0){
    plane.revision++;
    if(plane.status==='taxi-out'){plane.status='queued';emit(`${plane.callsign} ready for takeoff.`);}
    else if(plane.status==='taxi-in' || plane.status==='takeoff'){game.aircraft=game.aircraft.filter(a=>a!==plane);game.handled++;const points=plane.emergency?250:100;game.score+=points;if(plane.emergency)game.emergenciesHandled++;emit(`${plane.callsign} ${plane.kind==='arrival'?'parked safely':'departed safely'} (+${points}).`);}
    else if(plane.status==='landing')emit(`${plane.callsign} landed. Taxi it off the runway.`);
   }}
  }
  if(game.weather && game.elapsed>=game.weather.endsAt){emit(`Crosswinds cleared. Runway ${game.weather.runway===0?'09':'27'} reopened.`);game.weather=undefined;}
  if(game.elapsed>=game.nextWeather && game.secondsLeft>40){
   const preferred:0|1=Math.floor(game.elapsed/75)%2===1?0:1;
   const target:0|1=runwayBusy(game,preferred)?(preferred===0?1:0):preferred;
   if(!runwayBusy(game,target)){game.weather={runway:target,endsAt:game.elapsed+25};game.nextWeather=game.elapsed+100;emit(`Crosswinds! Runway ${target===0?'09':'27'} closed for 25 seconds.`);}
   else game.nextWeather=game.elapsed+5;
  }
  if(game.elapsed>=game.nextEmergency && game.secondsLeft>40){
   if(game.aircraft.length<12){spawn(game,'arrival',true);emit(`MAYDAY! ${game.aircraft.at(-1)!.callsign} has low fuel. Land within 35 seconds. Priority flight (+250).`);game.nextEmergency=game.elapsed+100;}
   else game.nextEmergency=game.elapsed+5;
  }
  if(game.elapsed>=game.nextSpawn && game.secondsLeft>20){if(game.aircraft.length<12){spawn(game,game.sequence%2===0?'arrival':'departure');emit(`${game.aircraft.at(-1)!.callsign} requesting clearance.`);}game.nextSpawn=game.elapsed+Math.max(7,game.trafficInterval-Math.floor(game.elapsed/90));}
 }
}
