import {useEffect,useRef,useState} from 'react';
import type {RoomState} from './protocol';
export function useTowerSound(room:RoomState) {
 const [enabled,setEnabled]=useState(false);
 const context=useRef<AudioContext|null>(null);
 const previous=useRef<{id:number;phase:string}>({id:room.events.at(-1)?.id??0,phase:room.phase});
 function tone(frequency:number) {
  const ctx=context.current;if(!ctx||ctx.state!=='running')return;
  const oscillator=ctx.createOscillator(),gain=ctx.createGain();
  oscillator.connect(gain);gain.connect(ctx.destination);oscillator.frequency.value=frequency;
  gain.gain.setValueAtTime(.08,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.18);
  oscillator.start();oscillator.stop(ctx.currentTime+.2);
 }
 async function toggle() {
  if(enabled){setEnabled(false);return;}
  try{if(!context.current)context.current=new AudioContext();await context.current.resume();setEnabled(true);tone(660);}catch{setEnabled(false);}
 }
 useEffect(()=>{
  const events=room.events.filter(e=>e.id>previous.current.id);
  if(enabled){if(room.phase==='finished'&&previous.current.phase!=='finished')tone(880);else if(events.some(e=>e.text.startsWith('MAYDAY!')))tone(980);else if(events.some(e=>e.text.startsWith('Crosswinds!')))tone(420);else if(events.some(e=>e.text.includes('says:')))tone(660);}
  previous.current={id:room.events.at(-1)?.id??previous.current.id,phase:room.phase};
 },[room.revision,enabled]);
 useEffect(()=>()=>{void context.current?.close();},[]);
 return {enabled,toggle};
}
