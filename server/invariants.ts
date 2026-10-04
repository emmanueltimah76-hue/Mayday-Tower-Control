import type {Aircraft} from '../src/protocol.js';
import {NM_PER_MAP_UNIT,SECONDS_PER_HOUR} from '../src/mapConstants.js';
import {flightProfiles,shortestAngle} from './motion.js';
export type MotionBefore={position:[number,number];heading:number;speed:number;airborne:boolean};
export function motionViolations(p:Aircraft,b:MotionBefore,dt:number,scale=NM_PER_MAP_UNIT){
 const problems:string[]=[],type=p.aircraftType??'narrowbody',profile=flightProfiles[type],max=({light:95,regional:155,narrowbody:165,heavy:175})[type];
 const speed=p.groundSpeed??0,dx=p.position![0]-b.position[0],dy=p.position![1]-b.position[1],distance=Math.hypot(dx,dy),heading=p.heading??b.heading;
 if(!Number.isFinite(distance)||!Number.isFinite(speed)||!Number.isFinite(heading))return ['Non-finite motion state'];
 if(speed>max+.001)problems.push('Aircraft maximum speed exceeded');
 if(distance>(b.speed+speed)/2*dt/(SECONDS_PER_HOUR*scale)+1e-6)problems.push('Position exceeds integrated speed');
 if(Math.abs(shortestAngle(b.heading,heading))>(b.airborne?(type==='light'?6:3):profile.turnRate)*dt+.001)problems.push('Turn rate exceeded');
 if(distance>2*dt/(SECONDS_PER_HOUR*scale)){const direction=Math.atan2(dx,-dy)*180/Math.PI,nose=heading-(p.status==='pushback'?180:0);if(Math.abs(shortestAngle(nose,direction))>.05)problems.push('Heading disagrees with travel');}
 return problems;
}
