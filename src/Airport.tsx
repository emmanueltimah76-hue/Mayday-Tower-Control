import { useState } from 'react';
import { FlightGuide } from './FlightGuide';
import { useTowerSound } from './useTowerSound';
import { quickMessages } from './protocol';
import type { Aircraft, ClientMessage, RoomState } from './protocol';
const labels: Record<Aircraft['status'],string>={approach:'Requesting landing',holding:'Holding',landing:'Landing', 'taxi-in':'Taxiing to terminal',gate:'At gate · needs taxi', 'taxi-out':'Taxiing to runway',queued:'Ready for takeoff',takeoff:'Taking off'};
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
 const [runway,setRunway]=useState<0|1>(0);
 const a=game.aircraft.find(p=>p.id===selected);
 const busy=(r:number)=>game.aircraft.find(p=>p.runway===r && !['gate','approach','holding'].includes(p.status));
 const closed=(r:number)=>game.weather?.runway===r;
 const selectFlight=(id:string)=>{setSelected(id);const plane=game.aircraft.find(p=>p.id===id);if(plane?.runway!==undefined)setRunway(plane.runway);else setRunway(!closed(0)&&!busy(0)?0:1);if(online&&room.phase==='started')send({type:'select',aircraftId:id});};
 const watching=(id:string)=>room.players.filter(p=>p.connected&&p.selectedAircraft===id);
 const finished=room.phase==='finished';
 const act=(command:'hold'|'land'|'taxi'|'takeoff')=>{if(a)send({type:'command',aircraftId:a.id,command,revision:a.revision,runway});};
 return <section className={`airport-workspace ${a&&!finished?'has-selection':''}`} aria-label="Shared airport">
 <div className="shift-heading"><div><p className="eyebrow">MAYDAY INTERNATIONAL / ROOM {room.code}</p><h1>{finished?'Shift complete':'You have control.'}</h1></div><div className="shift-actions"><button className="sound-toggle" aria-pressed={sound.enabled} onClick={()=>void sound.toggle()}>{sound.enabled?'Sound on':'Sound off'}</button><button className="text-button" disabled={!online||pending} onClick={()=>send({type:'leave'})}>Leave room</button></div></div>
 <div className="scoreboard"><div><span>SHIFT REMAINING</span><strong>{Math.floor(game.secondsLeft/60)}:{String(game.secondsLeft%60).padStart(2,'0')}</strong></div><div><span>TEAM SCORE</span><strong>{game.score}</strong></div><div><span>HANDLED</span><strong>{game.handled}</strong></div><div><span>MISSED / UNSAFE</span><strong>{game.missed} / {game.unsafe}</strong></div></div>
 {finished && <div className="results" role="status"><h2>Your crew handled {game.handled} flights.</h2><p>{game.emergenciesHandled} emergencies handled safely. Final score: {game.score}. {game.missed} flights missed; {game.unsafe} unsafe clearances rejected.</p><button className="primary" disabled={!host||!online||pending} onClick={()=>send({type:'restart'})}>{host?'Return to lobby':'Waiting for the host'}</button></div>}
 <FlightGuide/>
 {!finished&&<><div className="radio-bar"><span>CREW RADIO</span>{quickMessages.map(message=><button key={message} disabled={!online||pending||finished} onClick={()=>send({type:'quick',message})}>{message}</button>)}</div>
 {game.weather&&<div className="weather-alert" role="status"><strong>Crosswinds · Runway {game.weather.runway===0?'09':'27'} closed</strong><span>Reopens in {Math.max(0,game.weather.endsAt-game.elapsed)}s. Use the other runway.</span></div>}
 {game.aircraft.some(p=>p.emergency&&['approach','holding'].includes(p.status))&&<div className="emergency-alert" role="status">MAYDAY · Priority arrivals need immediate clearance. Safe handling +250; missed emergency −150.</div>}
 <div className="game-grid"><div><div className="runway-status">{[0,1].map(r=><span key={r} className={closed(r)?'closed':busy(r)?'occupied':''}>RUNWAY {r===0?'09':'27'} · {closed(r)?'CLOSED · CROSSWINDS':busy(r)?busy(r)!.callsign+' OCCUPIED':'CLEAR'}</span>)}</div>
 <svg className="airport-map" viewBox="0 0 700 420" role="img" aria-label="Airport map. Select aircraft using the flight list below.">
 <defs><pattern id="grid" width="35" height="35" patternUnits="userSpaceOnUse"><path d="M 35 0 L 0 0 0 35" fill="none" stroke="#26444c" strokeWidth=".6"/></pattern></defs><rect width="700" height="420" fill="#0a2028"/><rect width="700" height="420" fill="url(#grid)"/>
 <text x="20" y="24" className="map-label">APPROACH / HOLDING</text>
 {[130,240].map((y,r)=><g key={r}><rect x="110" y={y-20} width="500" height="40" fill="#28414b" stroke={closed(r)?'#ff907f':busy(r)?'#ffc57a':'#79cdb0'}/><path d={`M130 ${y}H590`} stroke="#b7ced0" strokeDasharray="20 15"/><text x="80" y={y+5} className="runway-label">{r===0?'09':'27'}</text></g>)}
 <path d="M150 150V340H530V260M460 150V340" stroke="#e6bf6e" strokeWidth="6" fill="none" opacity=".5"/><rect x="100" y="380" width="490" height="28" fill="#24434c"/><text x="300" y="399" className="map-label">TERMINAL / GATES</text>
 {game.aircraft.map((p,i)=>{const [x,y]=position(p,i);return <g key={p.id} transform={`translate(${x} ${y})`} className={`plane-marker ${p.id===selected?'selected':''} ${p.emergency?'emergency':''}`} onClick={()=>selectFlight(p.id)}><circle r="15" fill={p.id===selected?'#91efc6':'#143e47'} stroke={p.kind==='arrival'?'#91efc6':'#ffd58c'}/><path d="M-7 0H7M0-7V7" stroke={p.id===selected?'#081b22':'#e9f0ef'} strokeWidth="2"/><text x="19" y="4">{p.callsign}</text></g>;})}
 </svg>
 <div className="flight-list"><h2>Flight strips <small>{game.aircraft.length} active</small></h2>{!game.aircraft.length&&<p>Airport clear. More traffic will arrive shortly.</p>}<div className="strips">{[...game.aircraft].sort((x,y)=>Number(!!y.emergency)-Number(!!x.emergency)||x.fuel-y.fuel).map(p=><button key={p.id} className={`flight-strip ${p.id===selected?'selected':''} ${p.emergency?'emergency':''}`} onClick={()=>selectFlight(p.id)} aria-pressed={p.id===selected} disabled={finished}><span className="flight-type">{p.emergency?'SOS':p.kind==='arrival'?'ARR':'DEP'}</span><strong>{p.callsign}</strong><span>{labels[p.status]}{p.status==='landing'&&p.remaining===0?' · taxi now':''}</span><small>{p.remaining>0?`${p.remaining}s`:p.kind==='arrival'?`Fuel ${p.fuel}s`:`Patience ${p.fuel}s`}</small>{watching(p.id).length>0&&<small className="watching">Selected by {watching(p.id).map(w=>w.id===playerId?'you':w.nickname).join(', ')}</small>}{p.controller&&<small>Last command: {p.controller}</small>}</button>)}</div></div>
 </div><aside className={`command-panel ${a?'active':''}`}><div className="clearance-heading"><p className="eyebrow">AIRCRAFT CLEARANCE</p>{a&&<button className="text-button" aria-label="Deselect aircraft" onClick={()=>{setSelected('');if(online&&!finished)send({type:'select',aircraftId:null});}}>Close</button>}</div>{a?<><h2>{a.callsign}{a.emergency&&<span className="sos-badge">MAYDAY</span>}</h2><p>{labels[a.status]}{a.remaining>0?` · ${a.remaining}s`:''}</p><label htmlFor="runway">Assign runway</label><select id="runway" value={runway} onChange={e=>setRunway(Number(e.target.value) as 0|1)}><option value="0">09 {closed(0)?'· closed':busy(0)?'· occupied':'· clear'}</option><option value="1">27 {closed(1)?'· closed':busy(1)?'· occupied':'· clear'}</option></select><div className="commands"><button disabled={!online||pending||finished||a.status!=='approach'} onClick={()=>act('hold')}>Hold</button><button disabled={!online||pending||finished||!['approach','holding'].includes(a.status)||!!busy(runway)||closed(runway)} onClick={()=>act('land')}>Land</button><button disabled={!online||pending||finished||!((a.status==='landing'&&a.remaining===0)||(a.status==='gate'&&!busy(runway)&&!closed(runway)))} onClick={()=>act('taxi')}>Taxi</button><button disabled={!online||pending||finished||a.status!=='queued'||(a.runway!==undefined&&closed(a.runway))} onClick={()=>act('takeoff')}>Take off</button></div><p className="hint">{a.kind==='arrival'?'Land, then taxi to the terminal to free the runway.':'Taxi to a clear runway, then clear for takeoff.'}</p></>:<><h2>Select a flight.</h2><p>Tap a flight strip or aircraft to issue a clearance.</p></>}
 <div className="how-to"><h3>Your first shift</h3><ol><li>Arrivals: Land, then Taxi after landing.</li><li>Departures: Taxi, then Take off.</li><li>Keep each runway clear before assigning another flight.</li></ol><p>Safe flights +100 · emergencies +250 · missed flights −50 · missed emergencies −150 · unsafe clearances −25.</p></div><div className="crew-inline"><h3>On frequency</h3>{room.players.map(p=><p key={p.id}>{p.nickname} <small>{p.connected?'connected':'reconnecting'}</small></p>)}</div><div className="activity"><h3>Tower log</h3><ol aria-live="polite" aria-relevant="additions">{room.events.slice(-5).map(e=><li key={e.id}>{e.text}</li>)}</ol></div>
 </aside></div></>}
 </section>;
}
