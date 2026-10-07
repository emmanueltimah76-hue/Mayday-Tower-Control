import type {Aircraft,GameState} from '../src/protocol.js';
import {groundRadius} from '../src/groundGeometry.js';
export function finishRun(game:GameState,reason:string,emit:(s:string)=>void){if(game.endReason)return;game.endReason=reason;game.secondsLeft=0;emit(`GAME OVER: ${reason}`);}
// Compare matching server substeps, not one aircraft's new pose with another's old pose.
function pose(p:Aircraft,index:number){const samples=p.motionSamples;const s=samples?.[Math.min(index,samples.length-1)];return {position:s?.position??p.position,altitude:s?.altitude??p.altitude??0};}
export function checkCrashes(game:GameState,emit:(s:string)=>void){
 if(!game.endless||game.endReason)return;
 const hit=new Set<string>();
 for(let i=0;i<game.aircraft.length;i++)for(let j=i+1;j<game.aircraft.length;j++){
  const a=game.aircraft[i],b=game.aircraft[j],radius=groundRadius(a)+groundRadius(b);
  for(let n=0;n<10;n++){const a0=pose(a,n),a1=pose(a,n+1),b0=pose(b,n),b1=pose(b,n+1);if(!a0.position||!a1.position||!b0.position||!b1.position)continue;
   const x=a0.position[0]-b0.position[0],y=a0.position[1]-b0.position[1],dx=a1.position[0]-b1.position[0]-x,dy=a1.position[1]-b1.position[1]-y;
   const t=Math.max(0,Math.min(1,-(x*dx+y*dy)/(dx*dx+dy*dy||1)));const altitude=(a0.altitude-b0.altitude)+((a1.altitude-b1.altitude)-(a0.altitude-b0.altitude))*t;
   if(Math.abs(altitude)<25&&Math.hypot(x+dx*t,y+dy*t)<radius){hit.add(a.id);hit.add(b.id);break;}
  }
 }
 if(!hit.size)return;
 for(const p of game.aircraft.filter(p=>hit.has(p.id)))emit(`${p.callsign}, aircraft collision. ${p.id} removed from traffic.`);
 game.crashes=(game.crashes??0)+hit.size;game.missed+=hit.size;game.aircraft=game.aircraft.filter(p=>!hit.has(p.id));
 if(game.crashes>=3)finishRun(game,'Three aircraft crashed.',emit);
}
