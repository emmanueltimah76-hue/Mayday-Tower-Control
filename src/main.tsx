import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { ClientMessage, RoomState, ServerMessage } from './protocol';
import './style.css';
import { FlightGuide } from './FlightGuide';
import { Airport } from './Airport';
function App() {
  const [room, setRoom] = useState<RoomState | null>(null);
  const [playerId, setPlayerId] = useState('');
  const [connection, setConnection] = useState('Connecting');
  const [nickname, setNickname] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const socket = useRef<WebSocket | null>(null);
  const token = useRef(sessionStorage.getItem('mayday-session'));
  const online = connection === 'Connected';
  useEffect(() => {
    let stopped = false, retries = 0;
    let timer: ReturnType<typeof setTimeout>;
    function connect() {
      if (stopped) return;
      setConnection(token.current ? 'Reconnecting' : 'Connecting');
      const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`);
      socket.current = ws;
      ws.onopen = () => { retries = 0; setConnection('Connected'); if (token.current) { setPending(true); ws.send(JSON.stringify({ type: 'resume', token: token.current })); } };
      ws.onmessage = e => {
        const msg = JSON.parse(e.data) as ServerMessage;
        if (msg.type === 'session') { token.current = msg.token; sessionStorage.setItem('mayday-session', msg.token); setPlayerId(msg.playerId); setError(''); }
        if (msg.type === 'state') { setRoom(msg.room); setPending(false); }
        if (msg.type === 'left') { token.current = null; sessionStorage.removeItem('mayday-session'); setRoom(null); setPlayerId(''); setPending(false); setError(''); }
        if (msg.type === 'error') { setError(msg.message); setPending(false); if (msg.code === 'EXPIRED') { token.current = null; sessionStorage.removeItem('mayday-session'); setRoom(null); } }
      };
      ws.onclose = () => { if (stopped) return; setConnection('Reconnecting'); setPending(false); timer = setTimeout(connect, Math.min(1000 * 2 ** retries++, 8000)); };
      ws.onerror = () => ws.close();
    }
    connect(); return () => { stopped = true; clearTimeout(timer); socket.current?.close(); };
  }, []);
  function send(message: ClientMessage) { if (socket.current?.readyState !== WebSocket.OPEN) return; setError(''); setPending(true); socket.current.send(JSON.stringify(message)); }
  const host = room?.hostId === playerId;
  const connected = room?.players.filter(p => p.connected).length ?? 0;
  async function copyCode() { try { await navigator.clipboard.writeText(room!.code); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { setError('Copy unavailable. Select and copy the room code above.'); } }
  return <div className="shell">
    <header><a className="brand" href="/" aria-label="MAYDAY home"><span className="mark">M</span><span>MAYDAY<small>TOWER CONTROL</small></span></a><span className={`connection ${online ? 'online' : ''}`} role="status">{connection}</span></header>
    {room?.game ? <main className="game-main">{error && <div className="error" role="alert">{error}</div>}{!online && <div className="notice" role="status">Connection lost. Commands paused while reconnecting…</div>}<Airport room={room} send={send} online={online} pending={pending} host={host} playerId={playerId}/></main> : <main>
      <section className="intro"><p className="eyebrow">COOPERATIVE AIRPORT CONTROL</p><h1>{room ? 'Your crew.\nOne tower.' : 'Clear skies.\nBusy runways.'}</h1><p className="lede">{room ? 'Bring everyone into the room before your shift begins.' : 'Gather your crew. Share the tower. Keep the airport moving.'}</p><div className="specs"><span>2–6 players</span><span>Phones & computers</span><span>One shared airport</span></div><div className="radar" aria-hidden="true"><div className="crosshair"/><span className="radar-label">TOWER / STANDBY</span><span className="radar-coordinate">33° N · 112° W</span><i className="blip b1"/><i className="blip b2"/><i className="blip b3"/></div></section>
      <section className="panel" aria-label={room ? 'Multiplayer room' : 'Create or join a room'}>
      {error && <div className="error" role="alert">{error}</div>}
      {!online && <div className="notice" role="status">{room ? 'Connection lost. Reconnecting automatically… Your place is held for 30 seconds.' : 'Waking up the tower… This can take about 60 seconds. Room controls unlock when connected.'}</div>}
      {!room ? <><p className="eyebrow">CREW CHECK-IN</p><h2>Take your seat.</h2><div className="tabs" role="group" aria-label="Room action"><button className={mode === 'create' ? 'active' : ''} onClick={() => { setMode('create'); setError(''); }}>Create room</button><button className={mode === 'join' ? 'active' : ''} onClick={() => { setMode('join'); setError(''); }}>Join room</button></div><form onSubmit={e => { e.preventDefault(); send(mode === 'create' ? { type: 'create', nickname } : { type: 'join', nickname, code }); }}><label htmlFor="nickname">Your nickname</label><input id="nickname" value={nickname} onChange={e => setNickname(e.target.value)} maxLength={20} placeholder="e.g. Sky Captain" required autoComplete="nickname"/><p className="hint">The name your crew will see. Up to 20 characters.</p>{mode === 'join' && <><label htmlFor="code">Room code</label><input id="code" className="code-input" value={code} onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} maxLength={5} minLength={5} autoCapitalize="characters" autoComplete="off" spellCheck={false} placeholder="ABCDE" required/></>}<button className="primary" disabled={!online || pending || !nickname.trim()}>{pending ? 'Please wait…' : mode === 'create' ? 'Create room' : 'Join the crew'}</button></form><div className="panel-foot"><span className="step">01</span><p>{mode === 'create' ? 'Create a room, then share its code with your crew.' : 'Ask your host for the five-character room code.'}</p></div></> : <>
      <div className="room-heading"><p className="eyebrow">{room.phase === 'started' ? 'CREW CONNECTED' : 'DEPARTURE LOUNGE'}</p><button className="text-button" disabled={!online || pending} onClick={() => send({ type: 'leave' })}>Leave room</button></div>
      <div className="code-card"><span>ROOM CODE</span><strong>{room.code}</strong><button onClick={copyCode}>{copied ? 'Copied!' : 'Copy code'}</button></div>
      <div className="crew-heading"><h2>Your crew</h2><span>{room.players.length} / 6</span></div><ul className="players">{room.players.map((p, i) => <li key={p.id}><span className="avatar">{String(i + 1).padStart(2, '0')}</span><div><strong>{p.nickname}{p.id === playerId && <small> (you)</small>}</strong><span className={p.connected ? '' : 'disconnected'}>{p.connected ? 'Connected' : 'Reconnecting…'}</span></div>{p.id === room.hostId && <span className="host-badge">HOST</span>}</li>)}</ul>
      <FlightGuide/>
      {room.phase === 'lobby' ? <><button className="primary" disabled={!online || pending || !host || connected < 2} onClick={() => send({ type: 'start' })}>{pending ? 'Please wait…' : host ? 'Start session' : 'Waiting for the host'}</button>{host && room.players.length === 1 && <button className="practice-button" disabled={!online || pending} onClick={() => send({ type: 'practice' })}>Start solo practice</button>}<p className="hint center">{connected < 2 ? 'Practice alone now, or share the code to start with your crew.' : host ? 'Your crew is connected. Ready when you are.' : 'The host will start when everyone is ready.'}</p></> : <div className="started" role="status"><h3>All crew checked in.</h3><p>The start signal reached everyone. Aircraft gameplay comes in the next build phase.</p></div>}
      <div className="activity"><h3>Tower log</h3><ol aria-live="polite" aria-relevant="additions">{room.events.slice(-5).map(e => <li key={e.id}>{e.text}</li>)}</ol></div>
      </>}
      </section>
    </main>}<footer><span>MAYDAY / TOWER CONTROL</span><span>MAYDAY / COOPERATIVE SHIFT</span></footer>
  </div>;
}
createRoot(document.getElementById('root')!).render(<App/>);
