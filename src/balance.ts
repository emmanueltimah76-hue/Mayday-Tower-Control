import type {Difficulty} from './airports.js';
// Allow runway exits and boarding between waves; gate capacity also limits admission.
export const balance:Record<Difficulty,{interval:number;wave:number;waveGap:number;emergencyEvery:number;reserve:number;emergencyReserve:number}>={
 easy:{interval:55,wave:2,waveGap:60,emergencyEvery:240,reserve:180,emergencyReserve:100},
 medium:{interval:45,wave:3,waveGap:60,emergencyEvery:210,reserve:150,emergencyReserve:85},
 hard:{interval:38,wave:3,waveGap:60,emergencyEvery:180,reserve:120,emergencyReserve:70},
 expert:{interval:32,wave:4,waveGap:60,emergencyEvery:150,reserve:100,emergencyReserve:60}
};
export const points={handled:100,emergencyHandled:250,missed:50,emergencyMissed:150,separation:100,incursion:75};
export const fuelBurnPerSecond=1;
