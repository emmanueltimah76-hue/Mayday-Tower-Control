import {createGame,spawn,command,tickGame} from '../server/game.js';
import {airports,difficulties} from '../src/airports.js';
let failures=0;
for(const d of difficulties)for(const direction of [0,1] as const)for(const r of airports[d].runways.keys()){
 const g=createGame(2,d);g.direction=direction;g.aircraft=[];g.secondsLeft=5000;g.nextWave=g.nextEmergency=g.nextWeather=g.nextWind=g.nextRadioLoss=99999;
 spawn(g,'departure');const p=g.aircraft[0];p.aircraftType='heavy';const taxi=command(g,p.id,'taxi',r,p.revision,'Audit');
 for(let t=0;t<1500&&p.status!=='queued';t++)tickGame(g,1,()=>{});
 const takeoff=command(g,p.id,'takeoff',r,p.revision,'Audit');
 if(!takeoff.changed){failures++;console.log(d,direction,r,p.status,taxi.error,takeoff.error,p.groundHold?.reason);}
}
console.log({failures});
