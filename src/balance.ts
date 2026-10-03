import type {Difficulty} from './airports.js';
// Pattern travel now consumes a meaningful part of the seven-minute shift.
export const balance:Record<Difficulty,{interval:number;wave:number;waveGap:number;emergencyEvery:number;reserve:number;emergencyReserve:number}>={
 easy:{interval:34,wave:2,waveGap:25,emergencyEvery:160,reserve:180,emergencyReserve:100},
 medium:{interval:28,wave:3,waveGap:25,emergencyEvery:140,reserve:150,emergencyReserve:85},
 hard:{interval:22,wave:3,waveGap:25,emergencyEvery:120,reserve:120,emergencyReserve:70},
 expert:{interval:18,wave:4,waveGap:25,emergencyEvery:100,reserve:100,emergencyReserve:60}
};
export const points={handled:100,emergencyHandled:250,missed:50,emergencyMissed:150,separation:100,incursion:75};
export const fuelBurnPerSecond=1;
