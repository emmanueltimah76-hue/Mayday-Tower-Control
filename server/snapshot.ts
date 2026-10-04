import type {GameState,Aircraft} from '../src/protocol.js';
import type {Point} from '../src/airports.js';
import {airports} from '../src/airports.js';
import {landingUnavailable,runwayBlockers} from '../src/runwaySafety.js';
const rounded=(n:number,d=5)=>Number(n.toFixed(d));
const point=(p:Point):Point=>[rounded(p[0]),rounded(p[1])];
const routes=new WeakMap<Point[],{length:number;points:Point[]}>();
// Rendering only; the full physical path and reservation data stay on the server.
function compact(points:Point[]|undefined){if(!points)return undefined;const hit=routes.get(points);if(hit?.length===points.length)return hit.points;const count=Math.min(128,points.length),out:Point[]=[];for(let i=0;i<count;i++)out.push(point(points[Math.round(i*(points.length-1)/Math.max(1,count-1))]));routes.set(points,{length:points.length,points:out});return out;}
export function snapshotGame(game:GameState):GameState{
 if(!game.difficulty)return game;
 const runwayState=airports[game.difficulty].runways.map((_,r)=>({occupiedBy:runwayBlockers(game,r).map(p=>p.id),closed:game.weather?.runway===r}));
 return {...game,alertLastLogged:undefined,groundReservations:game.groundReservations?.map(r=>({...r,resources:[]})),runwayState,aircraft:game.aircraft.map(p=>{
  const route=compact(p.route),landOptions=runwayState.map((_,r)=>{const reason=landingUnavailable(game,p,r);return {allowed:!reason,reason};});
  return {...p,position:p.position?point(p.position):undefined,heading:p.heading===undefined?undefined:rounded(p.heading,3),groundSpeed:p.groundSpeed===undefined?undefined:rounded(p.groundSpeed,3),altitude:p.altitude===undefined?undefined:rounded(p.altitude,2),motionSamples:p.motionSamples?.map(s=>({position:point(s.position),heading:rounded(s.heading,3)})),route,routeIndex:route?1:undefined,currentTarget:p.currentTarget??p.route?.[p.routeIndex??1],pathStatus:p.groundAtBay?'Waiting in holding bay':p.route?.[p.routeIndex??1]?'Valid active path':p.remaining===0?'Stopped at path end':'Missing path',groundResumeRoute:undefined,routeTurns:undefined,groundResources:p.groundResources?.length?Array(p.groundResources.length).fill('reserved'):undefined,landOptions};
 })};
}
