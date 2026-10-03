import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Lobby,type Peer} from '../server/lobby.js';
import type {ServerMessage} from '../src/protocol.js';
test('stats count connected time, gameplay, reconnects and completed shifts without identifiers',()=>{
 const original=Date.now;let now=100000;Date.now=()=>now;
 try {
 const l=new Lobby();class P implements Peer{messages:ServerMessage[]=[];send(m:ServerMessage){this.messages.push(m)}close(){}}
 const a=new P();l.handle(a,{type:'create',nickname:'SecretName'});now+=10000;
 assert.equal(l.stats().connectedPlayerSeconds,10);l.handle(a,{type:'practice'});now+=5000;
 assert.equal(l.stats().gameplayPlayerSeconds,5);l.disconnect(a);now+=5000;
 assert.equal(l.stats().connectedPlayerSeconds,15);
 const token=a.messages.find(m=>m.type==='session')!;assert.equal(token.type,'session');
 const b=new P();l.handle(b,{type:'resume',token:token.token});assert.equal(l.stats().roomJoins,1);assert.equal(l.stats().connectedPlayers,1);
 now+=420000;l.tick();assert.equal(l.stats().shiftsCompleted,1);l.handle(b,{type:'restart'});assert.equal(l.stats().playingRooms,0);
 assert.ok(!JSON.stringify(l.stats()).includes('SecretName'));l.handle(b,{type:'leave'});assert.equal(l.stats().activeRooms,0);assert.equal(l.stats().connectedPlayers,0);
 }finally{Date.now=original}
});
