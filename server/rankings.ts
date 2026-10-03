import {randomUUID} from 'node:crypto';
import {existsSync,readFileSync,writeFileSync,renameSync,mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {airports,type Difficulty} from '../src/airports.js';
import type {GameState} from '../src/protocol.js';
export type Ranking={id:string;difficulty:Difficulty;airport:string;mode:'crew'|'practice';crew:string[];score:number;handled:number;violations:number;completedAt:number};
export class Rankings{
 private entries:Ranking[]=[];
 constructor(private file?:string){if(file&&existsSync(file)){try{const raw=JSON.parse(readFileSync(file,'utf8'));if(Array.isArray(raw))this.entries=raw.filter(e=>typeof e?.id==='string'&&Object.hasOwn(airports,e.difficulty)&&['crew','practice'].includes(e.mode)&&Array.isArray(e.crew)&&e.crew.every((n:unknown)=>typeof n==='string'&&n.length<=20)&&Number.isFinite(e.score)&&Number.isFinite(e.completedAt)&&Number.isFinite(e.handled)&&Number.isFinite(e.violations)).slice(0,800);}catch{console.warn('Ranking storage could not be read; starting empty.');}}}
 list(difficulty:Difficulty='easy',mode:'crew'|'practice'='crew'){return this.entries.filter(e=>e.difficulty===difficulty&&e.mode===mode).sort((a,b)=>b.score-a.score||a.violations-b.violations||b.handled-a.handled||a.completedAt-b.completedAt).slice(0,100);}
 record(game:GameState,crew:string[],practice:boolean){if(game.secondsLeft!==0||!game.difficulty)return undefined;const row:Ranking={id:randomUUID(),difficulty:game.difficulty,airport:airports[game.difficulty].code,mode:practice?'practice':'crew',crew:crew.slice(0,6),score:game.score,handled:game.handled,violations:game.unsafe,completedAt:Date.now()};this.entries.push(row);this.entries=(Object.keys(airports) as Difficulty[]).flatMap(d=>[...this.list(d,'crew'),...this.list(d,'practice')]);if(this.file){try{mkdirSync(dirname(this.file),{recursive:true});writeFileSync(this.file+'.tmp',JSON.stringify(this.entries));renameSync(this.file+'.tmp',this.file);}catch{console.warn('Rankings remain in memory; storage write failed.');}}return row;}
 get durableConfigured(){return !!this.file;}
}
