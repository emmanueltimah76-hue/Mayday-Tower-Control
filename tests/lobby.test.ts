import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Lobby, type Peer } from '../server/lobby.js';
import type { ServerMessage } from '../src/protocol.js';
class Client implements Peer {
 messages: ServerMessage[] = []; closed=false;
 send(m: ServerMessage) { this.messages.push(structuredClone(m)); }
 close() { this.closed=true; }
 get state() { const m=this.messages.filter(m=>m.type==='state').at(-1)!; return m.room; }
 get session() { return this.messages.filter(m=>m.type==='session').at(-1)!; }
 get error() { return this.messages.filter(m=>m.type==='error').at(-1)?.code; }
}
test('synchronized membership, capacity and host-only start',()=>{
 const l=new Lobby(), h=new Client(); l.handle(h,{type:'create',nickname:'Host'});
 l.handle(h,{type:'start'}); assert.equal(h.error,'NEED_PLAYERS');
 const bad=new Client(); l.handle(bad,{type:'join',code:'XXXXX',nickname:'Bad'}); assert.equal(bad.error,'NOT_FOUND');
 const clients=Array.from({length:5},(_,i)=>{const c=new Client();l.handle(c,{type:'join',code:h.state.code,nickname:`Crew ${i}`});return c;});
 assert.deepEqual(h.state,clients[0].state);
 l.handle(bad,{type:'join',code:h.state.code,nickname:'Seventh'}); assert.equal(bad.error,'FULL');
 l.handle(clients[0],{type:'start'}); assert.equal(clients[0].error,'HOST_ONLY');
 l.handle(h,{type:'start'}); assert.equal(h.state.phase,'started'); assert.deepEqual(h.state,clients[4].state);
});
test('reconnect identity, grace expiry, host transfer and cleanup',()=>{
 const l=new Lobby(100),h=new Client(),g=new Client();l.handle(h,{type:'create',nickname:'Host'});l.handle(g,{type:'join',code:h.state.code,nickname:'Guest'});
 const session=h.session;l.disconnect(h);assert.equal(g.state.players[0].connected,false);
 const r=new Client();l.handle(r,{type:'resume',token:session.token});assert.equal(r.session.playerId,session.playerId);
 l.disconnect(r);l.sweep(Date.now()+101);assert.equal(g.state.players.length,1);assert.equal(g.state.hostId,g.session.playerId);
 l.handle(r,{type:'resume',token:session.token});assert.equal(r.error,'EXPIRED');
 l.handle(g,{type:'leave'});assert.equal(l.rooms.size,0);assert.equal(l.sessions.size,0);
});
test('invalid requests and duplicate nicknames are rejected',()=>{
 const l=new Lobby(),h=new Client(),g=new Client();l.handle(h,null);assert.equal(h.error,'BAD_REQUEST');
 l.handle(h,{type:'create',nickname:''});assert.equal(h.error,'NICKNAME');l.handle(h,{type:'create',nickname:'Host'});
 l.handle(g,{type:'join',code:h.state.code,nickname:'host'});assert.equal(g.error,'DUPLICATE');
 l.handle(g,{type:'resume',token:h.session.token});assert.equal(h.closed,true);l.disconnect(h);assert.equal(g.state.players[0].connected,true);
});
