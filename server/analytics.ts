import {randomUUID} from 'node:crypto';
export type Counts={roomJoins:number;shiftsStarted:number;shiftsCompleted:number;soloShifts:number;connectedMs:number;gameplayMs:number};
export type Day=Counts & {date:string};
export type Snapshot={id:string;since:number;days:Day[]};
const empty=():Counts=>({roomJoins:0,shiftsStarted:0,shiftsCompleted:0,soloShifts:0,connectedMs:0,gameplayMs:0});
// Arizona has a fixed UTC-7 offset. Splitting intervals keeps midnight totals accurate.
const offset=7*3600000;
export const dayKey=(now:number)=>new Date(now-offset).toISOString().slice(0,10);
export interface AnalyticsStore{load():Promise<Snapshot[]>;save(snapshot:Snapshot):Promise<void>}
export class SupabaseAnalytics implements AnalyticsStore{
 constructor(private url:string,private key:string){}
 private async request(path:string,init:RequestInit={}){
  const r=await fetch(`${this.url.replace(/\/$/,'')}/rest/v1/mayday_analytics${path}`,{...init,signal:AbortSignal.timeout(8000),headers:{apikey:this.key,Authorization:`Bearer ${this.key}`,'Content-Type':'application/json',...init.headers}});
  if(!r.ok)throw new Error('Analytics database request failed');return r;
 }
 async load(){const rows:Snapshot[]=[];for(let start=0;;start+=500){const r=await this.request(`?select=id,since,days&order=id&offset=${start}&limit=500`);const page=await r.json() as Snapshot[];rows.push(...page);if(page.length<500)return rows;}}
 async save(s:Snapshot){await this.request('?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates'},body:JSON.stringify(s)});}
}
export class Analytics{
 private current:Snapshot={id:randomUUID(),since:Date.now(),days:[]};
 private history:Snapshot[]=[];
 private loaded=false;private busy=false;private dirty=true;
 lastSaved:number|null=null;error=false;
 constructor(private store?:AnalyticsStore){}
 private day(now:number){const date=dayKey(now);let d=this.current.days.find(d=>d.date===date);if(!d){d={date,...empty()};this.current.days.push(d);}return d;}
 event(key:'roomJoins'|'shiftsStarted'|'shiftsCompleted'|'soloShifts',now=Date.now()){this.day(now)[key]++;this.dirty=true;}
 time(from:number,to:number,connected:number,playing:number){if(to<=from||(!connected&&!playing))return;while(from<to){const next=Math.floor((from-offset)/86400000)*86400000+86400000+offset;const end=Math.min(to,next);const d=this.day(from);d.connectedMs+=(end-from)*connected;d.gameplayMs+=(end-from)*playing;from=end;}this.dirty=true;}
 async flush(){if(!this.store||this.busy)return;this.busy=true;try{
  if(!this.loaded){this.history=await this.store.load();this.loaded=true;}
  if(this.dirty){const snapshot=structuredClone(this.current);this.dirty=false;try{await this.store.save(snapshot);}catch(e){this.dirty=true;throw e;}this.lastSaved=Date.now();}
  this.error=false;
 }catch{this.error=true;}finally{this.busy=false;}}
 report(now=Date.now()){
  const days=new Map<string,Day>();const snapshots=[...this.history.filter(s=>s.id!==this.current.id),this.current];
  for(const s of snapshots)for(const row of s.days){let d=days.get(row.date);if(!d){d={date:row.date,...empty()};days.set(row.date,d);}for(const key of Object.keys(empty()) as (keyof Counts)[])d[key]+=row[key];}
  const total=empty();for(const d of days.values())for(const key of Object.keys(total) as (keyof Counts)[])total[key]+=d[key];
  const since=Math.min(...snapshots.map(s=>s.since));const daily:Day[]=[];
  for(let t=Date.parse(dayKey(now)+'T07:00:00Z')-29*86400000;t<=now;t+=86400000){const date=dayKey(t);if(date>=dayKey(since))daily.push(days.get(date)??{date,...empty()});}
  return {totals:total,daily,since,timezone:'America/Phoenix',storage:this.store?'database':'session',historyLoaded:!this.store||this.loaded,lastSaved:this.lastSaved,saveError:this.error};
 }
}
