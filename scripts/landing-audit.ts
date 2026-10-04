import {pathToFileURL} from 'node:url';import {resolve} from 'node:path';
const base=resolve(process.env.AUDIT_BASE??'.');const {createGame,command,runwayBusy,tickGame}=await import(pathToFileURL(`${base}/server/game.ts`).href);const {runwayEnds,airports}=await import(pathToFileURL(`${base}/src/airports.ts`).href);const {setRoute,advanceMotion,shortestAngle}=await import(pathToFileURL(`${base}/server/motion.ts`).href);
const g=createGame(6,'medium'),p=g.aircraft[0];g.aircraft=[p];const [a,b]=runwayEnds(g,0),length=Math.hypot(b[0]-a[0],b[1]-a[1]),u=[(b[0]-a[0])/length,(b[1]-a[1])/length],left=[u[1],-u[0]],h=Math.atan2(u[0],-u[1])*180/Math.PI;
// A legal stabilized touchdown may have up to 8° heading and .012 NM lateral error.
p.status='landing';p.onFinal=false;p.patternLegs=undefined;p.patternPhase=undefined;p.targetHeading=p.targetAltitude=p.targetSpeed=undefined;p.altitude=0;p.runway=0;p.heading=h+7;p.position=[a[0]+u[0]*.5+left[0]*.7,a[1]+u[1]*.5+left[1]*.7];p.groundSpeed=140;
setRoute(p,[p.position,[a[0]+u[0]*70,a[1]+u[1]*70]],airports.medium.nmPerUnit);let peakTurn=0,maxAlignment=0;
for(let i=0;i<10;i++){const before=structuredClone(p);advanceMotion(p,.1,airports.medium.nmPerUnit);const dx=p.position[0]-before.position[0],dy=p.position[1]-before.position[1],direction=Math.atan2(dx,-dy)*180/Math.PI;peakTurn=Math.max(peakTurn,Math.abs(shortestAngle(before.heading,p.heading))/.1);maxAlignment=Math.max(maxAlignment,Math.abs(shortestAngle(p.heading,direction)));}
const invalid=command(g,p.id,'land',0,p.revision,'Audit');
const cleared={...structuredClone(p),id:'clear-taxi',status:'taxi-in',remaining:1,position:[a[0]+left[0]*100,a[1]+left[1]*100]};g.aircraft=[cleared];const runwayStillBusyAfterPhysicalExit=runwayBusy(g,0);
console.log(JSON.stringify({base,rollout:{peakTurnDegPerSecond:peakTurn,maxTravelHeadingError:maxAlignment,headingToleranceAtTouchdown:7,groundTurnLimit:18},landDuringRollout:invalid,runwayStillBusyAfterPhysicalExit},null,2));
