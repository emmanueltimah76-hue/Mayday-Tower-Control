import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import { createGame, command, tickGame } from './game.js';
import type { GameState } from '../src/protocol.js';
import { quickMessages } from '../src/protocol.js';
import type { ClientMessage, RoomState, ServerMessage } from '../src/protocol.js';
export interface Peer { send(message: ServerMessage): void; close(): void }
type Member = { id: string; nickname: string; token: string; peer?: Peer; deadline?: number; selectedAircraft?: string; lastQuick?: number };
type Room = { code: string; hostId: string; phase: 'lobby' | 'started' | 'finished'; practice?: boolean; game?: GameState; lastTick?: number; members: Member[]; events: { id: number; text: string }[]; revision: number; touched: number };
export class Lobby {
  rooms = new Map<string, Room>();
  sessions = new Map<string, { room: Room; member: Member }>();
  peers = new Map<Peer, { room: Room; member: Member }>();
  constructor(private graceMs = 30_000, private idleMs = 30 * 60_000) {}
  error(peer: Peer, code: string, message: string) { peer.send({ type: 'error', code, message }); }
  event(room: Room, text: string) { room.events.push({ id: ++room.revision, text }); room.events = room.events.slice(-20); }
  state(room: Room): RoomState { return { code: room.code, hostId: room.hostId, phase: room.phase, practice: room.practice, game: room.game, revision: room.revision, players: room.members.map(m => ({ id: m.id, nickname: m.nickname, connected: !!m.peer, selectedAircraft: m.selectedAircraft })), events: room.events }; }
  broadcast(room: Room) { room.revision++; room.touched = Date.now(); const message: ServerMessage = { type: 'state', room: this.state(room) }; for (const m of room.members) m.peer?.send(message); }
  attach(peer: Peer, room: Room, member: Member) {
    if (member.peer && member.peer !== peer) { this.peers.delete(member.peer); member.peer.close(); }
    member.peer = peer; member.deadline = undefined; this.peers.set(peer, { room, member });
    peer.send({ type: 'session', token: member.token, playerId: member.id });
  }
  handle(peer: Peer, raw: unknown) {
    if (!raw || typeof raw !== 'object' || !('type' in raw)) return this.error(peer, 'BAD_REQUEST', 'Unrecognized request.');
    const msg = raw as ClientMessage;
    if (msg.type === 'create' || msg.type === 'join') {
      if (this.peers.has(peer)) return this.error(peer, 'ALREADY_JOINED', 'Leave your current room first.');
      const nickname = typeof msg.nickname === 'string' ? msg.nickname.trim().replace(/\s+/g, ' ') : '';
      if (!nickname || nickname.length > 20 || /[\u0000-\u001f\u007f]/.test(nickname)) return this.error(peer, 'NICKNAME', 'Choose a nickname between 1 and 20 characters.');
      let room: Room;
      if (msg.type === 'create') {
        if (this.rooms.size >= 500) return this.error(peer, 'CAPACITY', 'The tower is busy. Try again shortly.');
        let code = ''; const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        do { code = Array.from({ length: 5 }, () => alphabet[randomInt(alphabet.length)]).join(''); } while (this.rooms.has(code));
        room = { code, hostId: '', phase: 'lobby', members: [], events: [], revision: 0, touched: Date.now() }; this.rooms.set(code, room);
      } else {
        const code = typeof msg.code === 'string' ? msg.code.trim().toUpperCase() : '';
        const found = this.rooms.get(code);
        if (!found) return this.error(peer, 'NOT_FOUND', 'That room code was not found. Check it and try again.');
        room = found;
        if (room.phase !== 'lobby') return this.error(peer, 'STARTED', 'This session has already started. Ask the crew to create a new room.');
        if (room.members.length >= 6) return this.error(peer, 'FULL', 'This room is full. Up to six players can join.');
        if (room.members.some(m => m.nickname.toLowerCase() === nickname.toLowerCase())) return this.error(peer, 'DUPLICATE', 'That nickname is taken in this room. Choose another.');
      }
      const member: Member = { id: randomUUID(), nickname, token: randomBytes(32).toString('hex') };
      room.members.push(member); if (!room.hostId) room.hostId = member.id;
      this.sessions.set(member.token, { room, member }); this.attach(peer, room, member);
      this.event(room, `${nickname} joined the crew.`); this.broadcast(room); return;
    }
    if (msg.type === 'resume') {
      if (this.peers.has(peer)) return this.error(peer, 'ALREADY_JOINED', 'This connection is already in a room.');
      const session = typeof msg.token === 'string' ? this.sessions.get(msg.token) : undefined;
      if (!session || (session.member.deadline !== undefined && session.member.deadline <= Date.now())) return this.error(peer, 'EXPIRED', 'Your session expired. Join the room again.');
      this.attach(peer, session.room, session.member); this.event(session.room, `${session.member.nickname} reconnected.`); this.broadcast(session.room); return;
    }
    const session = this.peers.get(peer);
    if (!session) return this.error(peer, 'NO_SESSION', 'Create or join a room first.');
    if (msg.type === 'leave') { this.remove(session.room, session.member); peer.send({ type: 'left' }); return; }
    if (msg.type === 'start' || msg.type === 'practice') {
      const { room, member } = session;
      if (room.hostId !== member.id) return this.error(peer, 'HOST_ONLY', 'Only the host can start the session.');
      if (room.phase !== 'lobby') return this.error(peer, 'STARTED', 'The session has already started.');
      if (msg.type === 'practice' && room.members.length !== 1) return this.error(peer, 'PRACTICE_ONLY', 'Solo practice is for one player. Start a crew session instead.');
      if (msg.type === 'start' && room.members.filter(m => m.peer).length < 2) return this.error(peer, 'NEED_PLAYERS', 'At least two connected players are needed.');
      room.practice = msg.type === 'practice'; room.game = createGame(room.members.filter(m => m.peer).length); room.lastTick = Date.now(); room.phase = 'started'; this.event(room, room.practice ? 'Solo practice started. You control every flight.' : 'The host started the session.'); this.broadcast(room); return;
    }
    if (msg.type === 'select') {
      const { room, member } = session;
      if (room.phase !== 'started' || !room.game) return this.error(peer, 'NO_GAME', 'There is no active round.');
      if (msg.aircraftId !== null && !room.game.aircraft.some(a => a.id === msg.aircraftId)) return this.error(peer, 'AIRCRAFT', 'That aircraft is no longer active.');
      member.selectedAircraft = msg.aircraftId ?? undefined; this.broadcast(room); return;
    }
    if (msg.type === 'quick') {
      const { room, member } = session;
      if (room.phase !== 'started' || !quickMessages.includes(msg.message)) return this.error(peer, 'MESSAGE', 'Choose one of the available quick messages during a round.');
      if (member.lastQuick !== undefined && Date.now() - member.lastQuick < 2000) return this.error(peer, 'MESSAGE', 'Wait two seconds before sending another message.');
      member.lastQuick = Date.now(); this.event(room, `${member.nickname} says: ${msg.message}.`); this.broadcast(room); return;
    }
    if (msg.type === 'command') {
      const { room, member } = session;
      if (room.phase !== 'started' || !room.game) return this.error(peer, 'NO_GAME', 'There is no active round.');
      const result = command(room.game, msg.aircraftId, msg.command, msg.runway, msg.revision, member.nickname);
      if (result.error) this.error(peer, 'COMMAND', result.error);
      if (result.event) this.event(room, result.event);
      if (result.changed) this.broadcast(room);
      return;
    }
    if (msg.type === 'restart') {
      const { room, member } = session;
      if (room.hostId !== member.id) return this.error(peer, 'HOST_ONLY', 'Only the host can return the crew to the lobby.');
      if (room.phase !== 'finished') return this.error(peer, 'ACTIVE', 'Finish the round first.');
      room.phase = 'lobby'; room.practice = false; room.game = undefined; for (const m of room.members) m.selectedAircraft = undefined; this.event(room, 'Crew returned to the lobby.'); this.broadcast(room); return;
    }
    this.error(peer, 'BAD_REQUEST', 'Unrecognized request.');
  }
  tick(now = Date.now()) {
    for (const room of this.rooms.values()) {
      if (room.phase !== 'started' || !room.game || room.lastTick === undefined) continue;
      const seconds = Math.floor((now - room.lastTick) / 1000);
      if (seconds < 1) continue;
      room.lastTick += seconds * 1000;
      tickGame(room.game, seconds, text => this.event(room, text));
      for (const m of room.members) if (!room.game.aircraft.some(a => a.id === m.selectedAircraft)) m.selectedAircraft = undefined;
      if (room.game.secondsLeft === 0) { room.phase = 'finished'; this.event(room, 'Shift complete. Your crew can play again.'); }
      this.broadcast(room);
    }
  }
  disconnect(peer: Peer) { const session = this.peers.get(peer); if (!session) return; this.peers.delete(peer); session.member.peer = undefined; session.member.selectedAircraft = undefined; session.member.deadline = Date.now() + this.graceMs; this.event(session.room, `${session.member.nickname} lost connection. Holding their place for 30 seconds.`); this.broadcast(session.room); }
  remove(room: Room, member: Member) {
    if (member.peer) this.peers.delete(member.peer); this.sessions.delete(member.token); room.members = room.members.filter(m => m !== member);
    this.event(room, `${member.nickname} left the crew.`);
    if (!room.members.length) { this.rooms.delete(room.code); return; }
    if (room.hostId === member.id) { const next = room.members.find(m => m.peer) ?? room.members[0]; room.hostId = next.id; this.event(room, `${next.nickname} is now the host.`); }
    this.broadcast(room);
  }
  sweep(now = Date.now()) { for (const room of this.rooms.values()) { for (const m of [...room.members]) if (m.deadline !== undefined && m.deadline <= now) this.remove(room, m); if (now - room.touched >= this.idleMs) { for (const m of [...room.members]) { m.peer?.send({ type: 'error', code: 'EXPIRED', message: 'This room expired after 30 minutes of inactivity.' }); const peer = m.peer; this.remove(room, m); peer?.close(); } } } }
}
