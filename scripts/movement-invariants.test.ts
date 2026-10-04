// Isolated diagnostic regression suite. Known failures stay outside the ordinary passing suite.
import {writeFileSync} from 'node:fs';import {test} from 'node:test';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';
const run=(file:string,env={})=>JSON.parse(execFileSync(process.execPath,['--import','tsx',`scripts/${file}`],{encoding:'utf8',env:{...process.env,...env},maxBuffer:5_000_000}));
const round=run('movement-audit.ts',{AUDIT_DIFFICULTY:'hard',AUDIT_NO_HOLD:'1'});
const landing=run('landing-audit.ts');
writeFileSync('audit-results/latest-invariant-round.json',JSON.stringify(round,null,2));
for(const [name,keys] of Object.entries({alignment:['alignment:approach','alignment:holding','alignment:go-around','alignment:landing','alignment:taxi-in','alignment:taxi-out','alignment:takeoff','alignment:pushback'],speed:['maxSpeed','displacement'],turnRate:['turnRate'],paths:['orphan'],runwayOwnership:['runwayMultipleOwners'],legalTransitions:['illegalTransition'],sixPlayerSync:['synchronization']}))test(`420-second stress invariant: ${name}`,()=>{assert.equal(round.seconds,420);assert.equal(round.players,6);for(const key of keys)assert.equal(round.failures[key]?.count??0,0,JSON.stringify(round.failures[key]));});
test('stabilized touchdown rollout respects the aircraft turn limit',()=>assert.ok(landing.rollout.peakTurnDegPerSecond<=landing.rollout.groundTurnLimit+.01,JSON.stringify(landing.rollout)));
test('runway ownership releases after physical runway exit',()=>assert.equal(landing.runwayStillBusyAfterPhysicalExit,false));
