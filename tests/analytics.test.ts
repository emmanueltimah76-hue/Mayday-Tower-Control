import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Analytics,dayKey,type AnalyticsStore,type Snapshot} from '../server/analytics.js';
test('Arizona midnight splits player time without double counting',t=>{
 const midnight=Date.parse('2026-10-04T07:00:00Z');t.mock.method(Date,'now',()=>midnight-1000);const a=new Analytics();
 a.time(midnight-1000,midnight+1000,3,2);a.time(midnight+1000,midnight+1000,3,2);
 const r=a.report(midnight+1000);assert.equal(r.totals.connectedMs,6000);assert.equal(r.totals.gameplayMs,4000);
 assert.equal(r.daily.at(-2)?.connectedMs,3000);assert.equal(r.daily.at(-1)?.connectedMs,3000);
 assert.equal(dayKey(midnight-1),'2026-10-03');
});
test('database snapshots survive new processes, retries are idempotent',async()=>{
 const rows=new Map<string,Snapshot>();let fail=true;
 const store:AnalyticsStore={load:async()=>[...rows.values()],save:async s=>{rows.set(s.id,structuredClone(s));if(fail){fail=false;throw Error('Response lost');}}};
 const a=new Analytics(store);a.event('roomJoins');a.time(Date.now()-2000,Date.now(),1,1);await a.flush();assert.equal(a.report().saveError,true);
 await a.flush();assert.equal(rows.size,1);assert.equal(a.report().totals.roomJoins,1);
 const b=new Analytics(store);await b.flush();b.event('roomJoins');await b.flush();assert.equal(b.report().totals.roomJoins,2);assert.equal(b.report().totals.gameplayMs,2000);
 const c=new Analytics(store);await c.flush();assert.equal(c.report().totals.roomJoins,2);
});
test('unconfigured storage is visibly temporary and failed loads cannot overwrite history',async()=>{
 assert.equal(new Analytics().report().storage,'session');let saved=false;
 const a=new Analytics({load:async()=>{throw Error();},save:async()=>{saved=true;}});a.event('roomJoins');await a.flush();
 assert.equal(saved,false);assert.equal(a.report().historyLoaded,false);assert.equal(a.report().saveError,true);
});
