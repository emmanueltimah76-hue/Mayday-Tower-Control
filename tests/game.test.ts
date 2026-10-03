import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGame,command,tickGame,runwayBusy} from '../server/game.js';
import {Lobby,type Peer} from '../server/lobby.js';
import type {ServerMessage} from '../src/protocol.js';
test('arrival frees runway only after taxi; departure needs taxi before takeoff',()=>{
 const g=createGame(2),a=g.aircraft[0],d=g.aircraft[1];const events:string[]=[];
 assert.equal(command(g,d.id,'takeoff',0,0,'Crew').changed,undefined);
 assert.equal(command(g,a.id,'land',0,0,'Crew').changed,true);assert.equal(runwayBusy(g,0),true);
 const conflict=command(g,d.id,'taxi',0,0,'Crew');assert.match(conflict.error!,/occupied/);assert.equal(g.score,-25);
 assert.match(command(g,a.id,'taxi',0,a.revision,'Crew').error!,/still landing/);
 assert.match(command(g,a.id,'hold',0,0,'Other').error!,/already updated/);
 tickGame(g,10,t=>events.push(t));assert.equal(a.remaining,0);assert.equal(runwayBusy(g,0),true);
 command(g,a.id,'taxi',0,a.revision,'Crew');tickGame(g,8,t=>events.push(t));assert.equal(runwayBusy(g,0),false);assert.equal(g.handled,1);
 command(g,d.id,'taxi',1,d.revision,'Other');tickGame(g,8,()=>{});assert.equal(d.status,'queued');command(g,d.id,'takeoff',1,d.revision,'Other');tickGame(g,10,()=>{});assert.equal(g.handled,2);assert.equal(g.score,175);
});
test('waiting flights expire and seven minute round stops exactly at zero',()=>{
 const g=createGame(2);tickGame(g,421,()=>{});assert.equal(g.secondsLeft,0);assert.equal(g.elapsed,420);assert.ok(g.missed>0);const score=g.score;tickGame(g,10,()=>{});assert.equal(g.score,score);
});
test('room broadcasts identical command results and rejects guests restarting',()=>{
 class P implements Peer {messages:ServerMessage[]=[];send(m:ServerMessage){this.messages.push(structuredClone(m));}close(){} get state(){return this.messages.filter(m=>m.type==='state').at(-1)!.room;} }
 const l=new Lobby(),a=new P(),b=new P();l.handle(a,{type:'create',nickname:'A'});l.handle(b,{type:'join',nickname:'B',code:a.state.code});l.handle(a,{type:'start'});
 const plane=a.state.game!.aircraft[0];l.handle(b,{type:'command',aircraftId:plane.id,command:'land',runway:0,revision:plane.revision});assert.deepEqual(a.state,b.state);assert.equal(a.state.game!.aircraft[0].status,'landing');
 l.tick(Date.now()+421000);assert.equal(a.state.phase,'finished');assert.deepEqual(a.state,b.state);
 l.handle(b,{type:'restart'});assert.equal(b.state.phase,'finished');l.handle(a,{type:'restart'});assert.equal(a.state.phase,'lobby');assert.equal(a.state.game,undefined);
});
