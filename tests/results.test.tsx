import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {Airport} from '../src/Airport.js';
import {createGame,tickGame} from '../server/game.js';
import type {RoomState} from '../src/protocol.js';
test('finished shift shows score and host restart without active aircraft controls',()=>{
 const game=createGame(2);tickGame(game,420,()=>{});
 const room:RoomState={code:'ABCDE',hostId:'host',phase:'finished',game,players:[{id:'host',nickname:'Captain',connected:true}],events:[],revision:1};
 const html=renderToStaticMarkup(<Airport room={room} playerId="host" host online pending={false} send={()=>{}}/>);
 assert.match(html,/Shift complete/);assert.match(html,/Final score:/);assert.match(html,/Return to lobby/);assert.doesNotMatch(html,/class="airport-map"/);assert.doesNotMatch(html,/class="commands"/);
 const guest=renderToStaticMarkup(<Airport room={room} playerId="guest" host={false} online pending={false} send={()=>{}}/>);assert.match(guest,/disabled="">Waiting for the host/);
});
