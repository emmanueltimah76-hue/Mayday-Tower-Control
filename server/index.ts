import {Analytics,SupabaseAnalytics} from './analytics.js';
import {Rankings} from './rankings.js';
import {airports,type Difficulty} from '../src/airports.js';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { WebSocketServer, WebSocket } from 'ws';
import { Lobby, type Peer } from './lobby.js';
const production = process.env.NODE_ENV === 'production';
const vite = production ? null : await (await import('vite')).createServer({ server: { middlewareMode: true }, appType: 'spa' });
const root = resolve('dist');
const mime: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  if (req.url?.startsWith('/api/rankings')) {const url=new URL(req.url,'http://localhost'),difficulty=url.searchParams.get('difficulty')??'easy',mode=url.searchParams.get('mode')==='practice'?'practice':'crew';if(!Object.hasOwn(airports,difficulty)){res.writeHead(400);res.end('Invalid difficulty');return;}res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({entries:lobby.rankings.list(difficulty as Difficulty,mode),storage:lobby.rankings.durableConfigured?'file':'session',note:'Free Render storage resets on restart or deployment. No login; nickname identity is unverified.'}));return;}
  if(req.url==='/leaderboard'||req.url==='/leaderboard/'){res.writeHead(200,{'Content-Type':'text/html','Cache-Control':'no-store'});res.end(await readFile(resolve(production?'dist/leaderboard.html':'public/leaderboard.html')));return;}
  if (req.url === '/api/stats') { res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify({...lobby.stats(),analytics:lobby.analytics.report()})); return; }
  if (req.url === '/dashboard' || req.url === '/dashboard/') { res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' }); res.end(await readFile(resolve(production ? 'dist/dashboard.html' : 'public/dashboard.html'))); return; }
  if (req.url === '/health') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}'); return; }
  if (vite) { vite.middlewares(req, res); return; }
  try {
    const path = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
    const file = resolve(root, '.' + (path === '/' ? '/index.html' : path));
    if (!file.startsWith(root + '/')) { res.writeHead(403); res.end(); return; }
    const content = await readFile(file); res.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' }); res.end(content);
  } catch { res.writeHead(404); res.end('Not found'); }
});
const lobby = new Lobby(30_000,30*60_000,new Rankings(process.env.RANKINGS_FILE),new Analytics(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY ? new SupabaseAnalytics(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY) : undefined));
void lobby.analytics.flush();
const analyticsTimer=setInterval(()=>{lobby.stats();void lobby.analytics.flush();},30_000);
const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });
server.on('upgrade', (req, socket, head) => {
  if (req.url !== '/ws') { if (vite && req.headers['sec-websocket-protocol'] === 'vite-hmr') return; socket.destroy(); return; }
  const expected = process.env.PUBLIC_ORIGIN;
  if (req.headers.origin && (expected ? req.headers.origin !== expected : new URL(req.headers.origin).host !== req.headers.host)) { socket.write('HTTP/1.1 403 Forbidden\r\n\r\n'); socket.destroy(); return; }
  wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
});
const alive = new WeakMap<WebSocket, boolean>();
wss.on('connection', ws => {
  alive.set(ws, true); ws.on('pong', () => alive.set(ws, true));
  const peer: Peer = { send: msg => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg)); }, close: () => ws.close() };
  let windowStart = Date.now(), count = 0;
  ws.on('message', data => {
    if (Date.now() - windowStart > 10_000) { windowStart = Date.now(); count = 0; }
    if (++count > 40) { lobby.error(peer, 'RATE_LIMIT', 'Too many requests. Please wait a moment.'); return; }
    try { lobby.handle(peer, JSON.parse(data.toString())); } catch { lobby.error(peer, 'BAD_REQUEST', 'Could not read that request.'); }
  });
  ws.on('close', () => lobby.disconnect(peer)); ws.on('error', () => ws.terminate());
});
const gameTimer = setInterval(() => lobby.tick(), 1000);
const timer = setInterval(() => { lobby.sweep(); for (const ws of wss.clients) { if (!alive.get(ws)) ws.terminate(); else { alive.set(ws, false); ws.ping(); } } }, 5000);
const port = Number(process.env.PORT ?? 3000); server.listen(port, process.env.HOST ?? '0.0.0.0', () => console.log(`MAYDAY ready on http://localhost:${port}`));
async function shutdown() { clearInterval(analyticsTimer); lobby.stats(); await lobby.analytics.flush(); clearInterval(timer); clearInterval(gameTimer); for (const ws of wss.clients) ws.terminate(); wss.close(); server.close(); void vite?.close(); }
process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
