import {MAX_FLASHING_TRACKS} from './mapConstants.js';
import type {GameState,TrafficAlert} from './protocol.js';
export function alertPriority(a:TrafficAlert,game:GameState){return (a.severity==='loss'?100:0)+(a.kind==='incursion'?20:10)+(a.aircraftIds.some(id=>game.aircraft.some(p=>p.id===id&&p.emergency))?200:0);}
export function visibleAlerts(game:GameState){return [...(game.alerts??[])].sort((a,b)=>alertPriority(b,game)-alertPriority(a,game)||a.id.localeCompare(b.id)).slice(0,3);}
export function flashingTracks(game:GameState){const ids=new Set<string>();for(const p of game.aircraft.filter(p=>p.emergency))if(ids.size<MAX_FLASHING_TRACKS)ids.add(p.id);for(const a of [...(game.alerts??[])].sort((a,b)=>alertPriority(b,game)-alertPriority(a,game)))for(const id of a.aircraftIds)if(ids.size<MAX_FLASHING_TRACKS)ids.add(id);return ids;}
