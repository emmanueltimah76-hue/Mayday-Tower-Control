import {normalizeMapPoint} from './mapConstants.js';
import type {Difficulty,Point} from './airports.js';
export type Stand={id:string;terminal:string;position:Point};
// Airport terminal groupings are based on public airport maps. Stand IDs and exact geometry are game constructs.
export const stands:Record<Difficulty,Stand[]>={
 easy:[{id:'R1',terminal:'Passenger / GA ramp',position:[210,310]},{id:'R2',terminal:'Passenger / GA ramp',position:[185,285]},{id:'R3',terminal:'Passenger / GA ramp',position:[160,260]}],
 medium:[{id:'T3-A',terminal:'Terminal 3',position:[260,200]},{id:'T3-B',terminal:'Terminal 3',position:[280,220]},{id:'T4-A',terminal:'Terminal 4',position:[390,180]},{id:'T4-B',terminal:'Terminal 4',position:[425,205]}],
 hard:[{id:'N1',terminal:'North terminals',position:[290,180]},{id:'N2',terminal:'North terminals',position:[380,165]},{id:'TB1',terminal:'Tom Bradley',position:[260,220]},{id:'S1',terminal:'South terminals',position:[350,235]},{id:'S2',terminal:'South terminals',position:[445,220]}],
 expert:[{id:'T1-A',terminal:'Terminal 1',position:[280,210]},{id:'T1-B',terminal:'Terminal 1',position:[300,205]},{id:'T2-A',terminal:'Terminal 2',position:[325,220]},{id:'T3-A',terminal:'Terminal 3',position:[350,235]},{id:'T3-B',terminal:'Terminal 3',position:[370,230]},{id:'T5-A',terminal:'Terminal 5',position:[455,205]}]
};
export const serviceSteps=['Deplane','Refuel','Service','Board'] as const;
export function serviceSeconds(type:string|undefined){return 15;}

for(const difficulty of Object.keys(stands) as Difficulty[]) for(const stand of stands[difficulty]) stand.position=normalizeMapPoint(stand.position,difficulty);
