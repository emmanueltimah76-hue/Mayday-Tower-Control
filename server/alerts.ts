import {ALERT_REPEAT_SECONDS,SECONDS_PER_HOUR} from '../src/mapConstants.js';
import type {Aircraft,GameState,TrafficAlert} from '../src/protocol.js';
import {airports,runwayName} from '../src/airports.js';
import type {Point} from '../src/airports.js';
// Compressed game separation, not regulatory ATC minima: 0.12 NM / 100 ft, heavy trail 0.18 NM.
export const separation={horizontal:.12,vertical:100,wake:.18,lookahead:15};
export function assignSquawk(game:GameState){const used=new Set(game.aircraft.flatMap(p=>[p.squawk,p.normalSquawk]));for(let i=512;i<4096;i++){const code=i.toString(8).padStart(4,'0');if(!['7500','7600','7700'].includes(code)&&!used.has(code))return code;}throw new Error('No squawk available');}
function airborne(p:Aircraft){return ['approach','holding','go-around'].includes(p.status)||p.onFinal||p.status==='takeoff'&&(p.altitude??0)>10;}
function velocity(p:Aircraft,scale:number):Point{const h=(p.heading??0)*Math.PI/180,v=(p.groundSpeed??0)/(SECONDS_PER_HOUR*scale);return [Math.sin(h)*v,-Math.cos(h)*v];}
function segmentDistance(p:Point,a:Point,b:Point){const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p[0]-a[0]-dx*t,p[1]-a[1]-dy*t);}
export function updateAlerts(game:GameState,emit:(text:string)=>void){if(!game.difficulty)return;const c=airports[game.difficulty],alerts:TrafficAlert[]=[];
 for(let i=0;i<game.aircraft.length;i++)for(let j=i+1;j<game.aircraft.length;j++){
 const a=game.aircraft[i],b=game.aircraft[j];if(!a.position||!b.position)continue;const ids=[a.id,b.id].sort(),pair=ids.join(':');
 if(airborne(a)&&airborne(b)&&Math.abs((a.altitude??0)-(b.altitude??0))<separation.vertical){const av=velocity(a,c.nmPerUnit),bv=velocity(b,c.nmPerUnit),dx=a.position[0]-b.position[0],dy=a.position[1]-b.position[1],vx=av[0]-bv[0],vy=av[1]-bv[1],t=Math.max(0,Math.min(separation.lookahead,-(dx*vx+dy*vy)/(vx*vx+vy*vy||1)));const current=Math.hypot(dx,dy)*c.nmPerUnit,predicted=Math.hypot(dx+vx*t,dy+vy*t)*c.nmPerUnit;const heavy=a.aircraftType==='heavy'||b.aircraftType==='heavy';const following=Math.abs(((a.heading??0)-(b.heading??0)+540)%360-180)<30;const leader=a.aircraftType==='heavy'?a:b,follower=leader===a?b:a,h=(leader.heading??0)*Math.PI/180,trailX=follower.position![0]-leader.position![0],trailY=follower.position![1]-leader.position![1],behind=trailX*Math.sin(h)-trailY*Math.cos(h)<0,lateral=Math.abs(trailX*Math.cos(h)+trailY*Math.sin(h))*c.nmPerUnit;const wake=heavy&&following&&behind&&lateral<separation.horizontal;const threshold=wake?separation.wake:separation.horizontal;
 if(predicted<threshold||current<threshold){const loss=current<threshold;alerts.push({id:`air:${pair}`,kind:wake?'wake':'airborne',aircraftIds:ids,severity:loss?'loss':'warning',message:`${a.callsign} / ${b.callsign}: ${wake?'wake spacing':'airborne separation'} ${loss?'lost':'predicted conflict'}.`});}
 }
 for(let r=0;r<c.runways.length;r++){const runway=c.runways[r],width=.018/c.nmPerUnit;const on=(p:Aircraft)=>!airborne(p)&&(p.altitude??0)<=10&&segmentDistance(p.position!,runway.start,runway.end)<width;const entering=(p:Aircraft)=>{if(airborne(p)||!p.route||!p.groundSpeed)return false;const v=velocity(p,c.nmPerUnit);return segmentDistance([p.position![0]+v[0]*5,p.position![1]+v[1]*5],runway.start,runway.end)<width;};const ao=on(a),bo=on(b);if(ao&&bo||ao&&entering(b)||bo&&entering(a)){alerts.push({id:`runway:${r}:${pair}`,kind:'incursion',aircraftIds:ids,severity:ao&&bo?'loss':'warning',message:`Runway ${runwayName(game,r)}: ${a.callsign} / ${b.callsign}, ${ao&&bo?'incursion':'occupied runway entry predicted'}.`});}
 }
 }
 const old=new Map((game.alerts??[]).map(a=>[a.id,a]));for(const alert of alerts){const previous=old.get(alert.id);if(!previous||previous.severity!==alert.severity){if(alert.severity==='loss'){const penalty=alert.kind==='incursion'?75:100;game.score-=penalty;game.unsafe++;if(alert.kind==='incursion')game.incursions=(game.incursions??0)+1;else game.separationLosses=(game.separationLosses??0)+1;emit(`ALERT: ${alert.message} (−${penalty}).`);}else if(game.elapsed-(game.alertLastLogged?.[alert.id]??-Infinity)>=ALERT_REPEAT_SECONDS){emit(`ALERT: ${alert.message} Take action to prevent a loss.`);(game.alertLastLogged??={})[alert.id]=game.elapsed;}}}
 game.alertLastLogged=Object.fromEntries(Object.entries(game.alertLastLogged??{}).filter(([,at])=>game.elapsed-at<ALERT_REPEAT_SECONDS));
 game.alerts=alerts;
}
