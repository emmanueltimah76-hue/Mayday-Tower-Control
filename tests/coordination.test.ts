import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGame,command,tickGame,spawn} from '../server/game.js';
import {Lobby,type Peer} from '../server/lobby.js';
import type {ServerMessage} from '../src/protocol.js';
test('weather closes only a free runway, rejects assignment and reopens on time',()=>{
 const g=createGame(2);command(g,g.aircraft[0].id,'land',0,0,'A');tickGame(g,75,()=>{});assert.equal(g.weather?.runway,1);
 const d=g.aircraft.find(p=>p.status==='gate')!;assert.match(command(g,d.id,'taxi',1,d.revision,'A').error!,/closed/);assert.equal(g.unsafe,0);
 tickGame(g,25,()=>{});assert.equal(g.weather,undefined);
});
test('occupied runways defer weather rather than trapping a plane',()=>{
 const g=createGame(2);command(g,g.aircraft[0].id,'land',0,0,'A');command(g,g.aircraft[1].id,'taxi',1,0,'B');tickGame(g,75,()=>{});assert.equal(g.weather,undefined);
});
test('emergency arrivals have short fuel, bonus handling and larger missed penalty',()=>{
 const g=createGame(2);spawn(g,'arrival',true);const p=g.aircraft.at(-1)!;assert.equal(p.fuel,35);command(g,p.id,'land',0,0,'A');tickGame(g,10,()=>{});command(g,p.id,'taxi',0,p.revision,'A');tickGame(g,8,()=>{});assert.equal(g.score,250);assert.equal(g.emergenciesHandled,1);
 const missed=createGame(2);spawn(missed,'arrival',true);tickGame(missed,35,()=>{});assert.equal(missed.score,-150);assert.equal(missed.missed,1);
 const timed=createGame(2);tickGame(timed,45,()=>{});assert.ok(timed.aircraft.some(p=>p.emergency));
});
test('selections and radio synchronize, validate input, and clear on disconnect',()=>{
 class P implements Peer{messages:ServerMessage[]=[];send(m:ServerMessage){this.messages.push(structuredClone(m));}close(){}get state(){return this.messages.filter(m=>m.type==='state').at(-1)!.room;}get error(){return this.messages.filter(m=>m.type==='error').at(-1)?.code;}}
 const l=new Lobby(),a=new P(),b=new P();l.handle(a,{type:'create',nickname:'A'});l.handle(b,{type:'join',nickname:'B',code:a.state.code});l.handle(a,{type:'start'});const id=a.state.game!.aircraft[0].id;
 l.handle(b,{type:'select',aircraftId:id});assert.equal(a.state.players[1].selectedAircraft,id);assert.deepEqual(a.state,b.state);
 l.handle(b,{type:'quick',message:'Need help'});assert.match(a.state.events.at(-1)!.text,/B says: Need help/);assert.deepEqual(a.state,b.state);
 l.handle(b,{type:'quick',message:'not allowed'});assert.equal(b.error,'MESSAGE');l.handle(b,{type:'select',aircraftId:'absent'});assert.equal(b.error,'AIRCRAFT');l.disconnect(b);assert.equal(a.state.players[1].selectedAircraft,undefined);
});
