import {airports,runwayName} from './airports';
import {Radar} from './Radar';
import { useState } from 'react';
import { FlightGuide } from './FlightGuide';
import { useTowerSound } from './useTowerSound';
import { quickMessages } from './protocol';
import type { Aircraft, ClientMessage, RoomState } from './protocol';
const labels: Record<Aircraft['status'],string>={final:'Short final', 'go-around':'Going around',approach:'Requesting landing',holding:'Holding',landing:'Landing', 'taxi-in':'Taxiing to terminal',gate:'At gate · needs taxi', 'taxi-out':'Taxiing to runway',queued:'Ready for takeoff',takeoff:'Taking off'};
function position(a:Aircraft,index:number): [number,number] {
 const y=a.runway===1?240:130;
 if(a.status==='approach' || a.status==='holding')return [60+(index%3)*90,45+Math.floor(index/3)*32];
 if(a.status==='gate')return [140+(index%5)*95,365];
 if(a.status==='landing')return [140+(10-a.remaining)*33,y];
 if(a.status==='takeoff')return [180+(10-a.remaining)*35,y];
 if(a.status==='queued')return [150,y];
 if(a.status==='taxi-out')return [150,340-(8-a.remaining)*(340-y)/8];
 return [460, y+(8-a.remaining)*(340-y)/8];
}
export function Airport({room,send,online,pending,host,playerId}:{room:RoomState;send:(msg:ClientMessage)=>void;online:boolean;pending:boolean;host:boolean;playerId:string}) {
 const game=room.game!;
 const sound=useTowerSound(room);
 const [selected,setSelected]=useState('');
 const [runway,setRunway]=useState<number>(0);
 const a=game.aircraft.find(p=>p.id===selected);
 const busy=(r:number)=>game.aircraft.find(p=>p.runway===r && !p.onFinal && (game.difficulty?['landing','takeoff','taxi-in']:['landing','taxi-in','taxi-out','queued','takeoff']).includes(p.status));
 const runways=game.difficulty?airports[game.difficulty].runways.map((_,i)=>i):[0,1];
 const wake=(r:number)=>Math.max(0,(game.wakeUntil?.[r]??0)-game.elapsed-(a?.aircraftType==='heavy'?8:0));
 const closed=(r:number)=>game.weather?.runway===r;
 const selectFlight=(id:string)=>{setSelected(id);const plane=game.aircraft.find(p=>p.id===id);if(plane?.runway!==undefined)setRunway(plane.runway);else setRunway(plane?.approachRunway??runways.find(r=>!closed(r)&&!busy(r))??0);if(online&&room.phase==='started')send({type:'select',aircraftId:id});};
 const watching=(id:string)=>room.players.filter(p=>p.connected&&p.selectedAircraft===id);
 const finished=room.phase==='finished';
 const act=(command:'hold'|'land'|'taxi'|'takeoff')=>{if(a)send({type:'command',aircraftId:a.id,command,revision:a.revision,runway});};
 return <section className={`airport-workspace ${a&&!finished?'has-selection':''}`} aria-label="Shared airport">
 <div className="shift-heading"><div><p className="eyebrow">{game.difficulty?`${airports[game.difficulty].name} (${airports[game.difficulty].code}) · ${game.difficulty.toUpperCase()}`:room.practice?'SOLO PRACTICE':'MAYDAY INTERNATIONAL'} / ROOM {room.code}</p><h1>{finished?'Shift complete':'You have control.'}</h1></div><div className="shift-actions"><button className="sound-toggle" aria-pressed={sound.enabled} onClick={()=>void sound.toggle()}>{sound.enabled?'Sound on':'Sound off'}</button><button className="text-button" disabled={!online||pending} onClick={()=>send({type:'leave'})}>Leave room</button></div></div>
 <div className="scoreboard"><div><span>SHIFT REMAINING</span><strong>{Math.floor(game.secondsLeft/60)}:{String(game.secondsLeft%60).padStart(2,'0')}</strong></div><div><span>TEAM SCORE</span><strong>{game.score}</strong></div><div><span>HANDLED</span><strong>{game.handled}</strong></div><div><span>MISSED / UNSAFE</span><strong>{game.missed} / {game.unsafe}</strong></div></div>
 {finished && <div className="results" role="status"><h2>{room.practice?'You':'Your crew'} handled {game.handled} flights.</h2><p>{game.emergenciesHandled} emergencies handled safely. Final score: {game.score}. {game.missed} flights missed; {game.unsafe} unsafe clearances rejected.</p><button className="primary" disabled={!host||!online||pending} onClick={()=>send({type:'restart'})}>{host?'Return to lobby':'Waiting for the host'}</button></div>}
 {room.practice&&<div className="notice">Solo practice · Practice the controls on your chosen difficulty. The seven-minute timer and scoring still apply. Return to the lobby after the shift to play with friends.</div>}<FlightGuide/>
 {!finished&&<><div className="radio-bar"><span>CREW RADIO</span>{quickMessages.map(message=><button key={message} disabled={!online||pending||finished} onClick={()=>send({type:'quick',message})}>{message}</button>)}</div>
 {game.weather&&<div className="weather-alert" role="status"><strong>Crosswinds · Runway {runwayName(game,game.weather.runway)} closed</strong><span>Reopens in {Math.max(0,game.weather.endsAt-game.elapsed)}s. Use the other runway.</span></div>}
 {game.aircraft.some(p=>p.emergency&&['approach','holding'].includes(p.status))&&<div className="emergency-alert" role="status">MAYDAY · Low-fuel arrivals need priority. Clear them while fuel remains. Safe handling +250; missed emergency −150.</div>}
 {game.difficulty&&<div className="wind-banner">WIND {Math.round(game.wind?.heading??0)}° / {game.wind?.speed??0} KT · ACTIVE {runways.map(r=>runwayName(game,r)).join(' / ')}<small>Runway geometry from public data · taxi routes and gates simplified</small></div>}
 <div className="game-grid"><div><div className="runway-status">{runways.map(r=><span key={r} className={closed(r)?'closed':busy(r)?'occupied':''}>RWY {runwayName(game,r)} · {closed(r)?'CLOSED':busy(r)?busy(r)!.callsign+' OCCUPIED':wake(r)>0?`WAKE ${wake(r)}s`:'CLEAR'}</span>)}</div>
 <Radar game={game} selected={selected} onSelect={selectFlight}/>
 <div className="flight-list"><h2>Flight strips <small>{game.aircraft.length} active</small></h2>{!game.aircraft.length&&<p>Airport clear. More traffic will arrive shortly.</p>}<div className="strips">{[...game.aircraft].sort((x,y)=>Number(!!y.emergency)-Number(!!x.emergency)||x.fuel-y.fuel).map(p=><button key={p.id} className={`flight-strip ${p.id===selected?'selected':''} ${p.emergency?'emergency':''}`} onClick={()=>selectFlight(p.id)} aria-pressed={p.id===selected} disabled={finished}><span className="flight-type">{p.emergency?'SOS':p.kind==='arrival'?'ARR':'DEP'}</span><strong>{p.callsign}</strong>{p.aircraftType&&<small>{p.aircraftType.toUpperCase()} · APP {p.speed} KT · {p.gate} / TWY {p.taxiway}</small>}<span>{p.onFinal?'Short final':labels[p.status]}{p.status==='landing'&&p.remaining===0?' · taxi now':''}</span><small>{p.remaining>0?`${p.remaining}s`:p.kind==='arrival'?`Fuel ${p.fuel}s`:`Patience ${p.fuel}s`}</small>{watching(p.id).length>0&&<small className="watching">Selected by {watching(p.id).map(w=>w.id===playerId?'you':w.nickname).join(', ')}</small>}{p.controller&&<small>Last command: {p.controller}</small>}</button>)}</div></div>
 </div><aside className={`command-panel ${a?'active':''}`}><div className="clearance-heading"><p className="eyebrow">AIRCRAFT CLEARANCE</p>{a&&<button className="text-button" aria-label="Deselect aircraft" onClick={()=>{setSelected('');if(online&&!finished)send({type:'select',aircraftId:null});}}>Close</button>}</div>{a?<><h2>{a.callsign}{a.emergency&&<span className="sos-badge">MAYDAY</span>}</h2><p>{a.onFinal?'Short final':labels[a.status]}{a.remaining>0?` · ${a.remaining}s`:''}</p><label htmlFor="runway">Assign runway</label><select aria-label="Assign runway" id="runway" value={runway} onChange={e=>setRunway(Number(e.target.value))}>{runways.map(r=><option key={r} value={r}>{runwayName(game,r)} {closed(r)?'· closed':busy(r)?'· occupied':wake(r)>0?`· wake ${wake(r)}s`:'· clear'}</option>)}</select>{wake(runway)>0&&<p className="wake-warning" role="status">Wake turbulence · wait {wake(runway)}s before landing or takeoff.</p>}<div className="commands"><button disabled={!online||pending||finished||a.status!=='approach'} onClick={()=>act('hold')}>Hold</button><button disabled={!online||pending||finished||!['approach','holding','go-around'].includes(a.status)||!!busy(runway)||closed(runway)||wake(runway)>0} onClick={()=>act('land')}>Land</button><button disabled={!online||pending||finished||!((a.status==='landing'&&!a.onFinal&&a.remaining===0)||(a.status==='gate'&&!busy(runway)&&!closed(runway)))} onClick={()=>act('taxi')}>Taxi</button><button disabled={!online||pending||finished||a.status!=='queued'||(a.runway!==undefined&&(closed(a.runway)||wake(a.runway)>0||!!busy(a.runway)))} onClick={()=>act('takeoff')}>Take off</button></div><p className="hint">{a.kind==='arrival'?'Land, then taxi to the terminal to free the runway.':'Taxi to a clear runway, then clear for takeoff.'}</p></>:<><h2>Select a flight.</h2><p>Tap a flight strip or aircraft to issue a clearance.</p></>}
 <div className="how-to"><h3>Your first shift</h3><ol><li>Arrivals: Land, then Taxi after landing.</li><li>Departures: Taxi, then Take off.</li><li>Keep each runway clear before assigning another flight.</li></ol><p>Safe flights +100 · emergencies +250 · missed flights −50 · missed emergencies −150 · unsafe clearances −25.</p></div><div className="crew-inline"><h3>On frequency</h3>{room.players.map(p=><p key={p.id}>{p.nickname} <small>{p.connected?'connected':'reconnecting'}</small></p>)}</div><div className="activity"><h3>Tower log</h3><ol aria-live="polite" aria-relevant="additions">{room.events.slice(-5).map(e=><li key={e.id}>{e.text}</li>)}</ol></div>
 </aside></div></>}
 </section>;
}
