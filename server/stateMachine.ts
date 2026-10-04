import type {Aircraft,AircraftStatus} from '../src/protocol.js';
export const legalTransitions:Record<AircraftStatus,readonly AircraftStatus[]>={
 approach:['holding','go-around','landing'],holding:['approach','go-around','landing'],'go-around':['holding','approach','landing'],
 final:['landing','holding','go-around'],landing:['taxi-in','holding','go-around'],'taxi-in':['turnaround'],turnaround:['gate'],
 gate:['taxi-out','pushback'],pushback:['gate'],'taxi-out':['queued'],queued:['takeoff','taxi-out'],takeoff:[]
};
export function transition(p:Aircraft,next:AircraftStatus){
 if(p.status===next)return true;
 if(!legalTransitions[p.status].includes(next)){p.invariantViolations=(p.invariantViolations??0)+1;p.invariantMessage=`Illegal transition ${p.status} → ${next}`;return false;}
 p.status=next;return true;
}
export function ownsMotionPath(p:Aircraft){
 if(p.groundAtBay&&p.groundResumeRoute?.length)return true;
 if(p.status==='turnaround'||p.status==='gate'||p.status==='queued'||p.status==='landing'&&!p.onFinal&&p.remaining===0)return true;
 return !!p.route?.[p.routeIndex??1]&&p.route.every(q=>q.every(Number.isFinite));
}
