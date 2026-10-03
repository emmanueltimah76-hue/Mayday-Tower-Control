import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Lobby,type Peer} from '../server/lobby.js';
import type {ServerMessage} from '../src/protocol.js';
class P implements Peer{messages:ServerMessage[]=[];send(m:ServerMessage){this.messages.push(structuredClone(m));}close(){}get state(){return this.messages.filter(m=>m.type==='state').at(-1)!.room;}get error(){return this.messages.filter(m=>m.type==='error').at(-1)?.code;}}
test('solo host can practice, command, reconnect, finish and return to lobby',()=>{
 const l=new Lobby(),a=new P();l.handle(a,{type:'create',nickname:'Judge'});l.handle(a,{type:'start'});assert.equal(a.error,'NEED_PLAYERS');l.handle(a,{type:'practice'});assert.equal(a.state.practice,true);assert.equal(a.state.phase,'started');const plane=a.state.game!.aircraft[0];l.handle(a,{type:'command',aircraftId:plane.id,command:'land',runway:0,revision:0});assert.equal(a.state.game!.aircraft[0].status,'landing');
 const token=a.messages.filter(m=>m.type==='session')[0].token;l.disconnect(a);const b=new P();l.handle(b,{type:'resume',token});assert.equal(b.state.practice,true);l.tick(Date.now()+421000);assert.equal(b.state.phase,'finished');l.handle(b,{type:'restart'});assert.equal(b.state.practice,false);assert.equal(b.state.phase,'lobby');
});
test('practice cannot bypass host checks or switch a multiplayer lobby into solo',()=>{
 const l=new Lobby(),a=new P(),b=new P();l.handle(a,{type:'create',nickname:'A'});l.handle(b,{type:'join',nickname:'B',code:a.state.code});l.handle(b,{type:'practice'});assert.equal(b.error,'HOST_ONLY');l.handle(a,{type:'practice'});assert.equal(a.error,'PRACTICE_ONLY');assert.equal(a.state.phase,'lobby');l.handle(a,{type:'start'});assert.equal(a.state.practice,false);
});
