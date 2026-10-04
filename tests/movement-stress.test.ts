import {test} from 'node:test';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';
for(const difficulty of ['hard','expert'])for(const hold of ['0','1'])test(`seven-minute six-player ${difficulty} invariant stress, holds=${hold==='0'}`,()=>{
 const out=JSON.parse(execFileSync(process.execPath,['--import','tsx','scripts/movement-audit.ts'],{encoding:'utf8',env:{...process.env,AUDIT_BASE:process.cwd(),AUDIT_DIFFICULTY:difficulty,AUDIT_NO_HOLD:hold,AUDIT_OVERLOAD:'1'},maxBuffer:5_000_000}));
 assert.equal(out.seconds,420);assert.equal(out.players,6);assert.equal(out.maxAircraft,18);assert.deepEqual(out.failures,{});assert.equal(out.invariantCounter,0);
});
