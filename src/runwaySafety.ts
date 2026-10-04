import {airports} from './airports.js';
import {feetToUnits} from './mapConstants.js';
import {groundRadius,pointSegmentDistance,segmentDistance} from './groundGeometry.js';
import type {Aircraft,GameState} from './protocol.js';
export function runwayClearOfAircraft(game:GameState,p:Aircraft,index:number){
 const r=airports[game.difficulty??'easy'].runways[index];
 return !!p.position&&pointSegmentDistance(p.position,r.start,r.end)>feetToUnits(100)+groundRadius(p);
}
export function runwayBlockers(game:GameState,index:number){
 const r=airports[game.difficulty??'easy'].runways[index];if(!r)return [];
 return game.aircraft.filter(p=>{
  if(p.onFinal)return false;
  if(p.groundReserved&&p.groundRunways?.includes(index))return true;
  if(p.runway===undefined)return false;
  const own=airports[game.difficulty??'easy'].runways[p.runway];if(!own)return false;
  const crosses=p.runway===index||segmentDistance(r.start,r.end,own.start,own.end)<.001;
  if(!crosses)return !runwayClearOfAircraft(game,p,index)&&(p.altitude??0)<10&&['taxi-in','taxi-out','queued','pushback','landing','takeoff'].includes(p.status);
  if(p.status==='landing')return !p.runwayReleased||!runwayClearOfAircraft(game,p,index); // runway ownership begins at touchdown and persists through rollout
  if(p.status==='takeoff')return (p.altitude??0)<50;
  return ['taxi-in','taxi-out','queued','pushback','gate'].includes(p.status)&&!runwayClearOfAircraft(game,p,index);
 });
}
export function landingUnavailable(game:GameState,p:Aircraft,index:number):string|undefined{
 if(p.kind!=='arrival'||!(['approach','holding','go-around'].includes(p.status)||p.onFinal))return 'Landing requires an airborne arrival; this aircraft is on the ground.';
 if(p.clearedToLand)return 'Landing clearance is already active. Continue the current pattern.';
 if(!airports[game.difficulty??'easy'].runways[index])return 'Select an available runway.';
 if(game.weather?.runway===index)return 'Runway closed by crosswinds. Use another runway.';
 if(runwayBlockers(game,index).length)return 'Runway or crossing runway occupied. Wait until traffic is fully clear.';
 const wake=Math.max(0,(game.wakeUntil?.[index]??0)-game.elapsed-(p.aircraftType==='heavy'?8:0));
 if(wake>0)return `Wake turbulence: wait ${wake}s before landing.`;
 return undefined;
}
