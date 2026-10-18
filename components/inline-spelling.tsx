'use client';
import { useEffect,useRef,useState } from 'react';
import type { SpellingPrompt } from '@/lib/learning';
import { fillSpellingSlots } from '@/lib/inline-spelling';

export default function InlineSpelling({word,prompt,feedback,active,onComplete}:{word:string;prompt:SpellingPrompt;feedback:boolean|null;active:boolean;onComplete:(answer:string)=>void}){
 const [slots,setSlots]=useState(()=>prompt.missing.map(()=>''));
 const inputs=useRef<(HTMLInputElement|null)[]>([]),finished=useRef(false);
 const focus=(index:number)=>{const input=inputs.current[index];input?.focus({preventScroll:true});input?.select()};
 useEffect(()=>{if(active&&feedback===null)inputs.current[0]?.focus({preventScroll:true})},[active]);
 function update(index:number,value:string){
  if(feedback!==null||finished.current)return;
  const next=fillSpellingSlots(slots,index,value);setSlots(next);
  if(next.every(Boolean)){finished.current=true;inputs.current[index]?.blur();onComplete(next.join(''));return}
  if(value.replace(/[^a-z]/gi,'')){
   const after=Math.min(index+value.replace(/[^a-z]/gi,'').length,next.length-1);
   const empty=next.findIndex((letter,i)=>i>=after&&!letter);
   focus(empty>=0?empty:next.findIndex(letter=>!letter));
  }
 }
 return <div className={'inline-spelling '+(feedback===null?'':feedback?'correct':'incorrect')} role="group" aria-label="待补全单词">{[...word].map((letter,position)=>{
  const index=prompt.missing.indexOf(position);
  return index<0?<span className={letter===' '?'spelling-space':''} key={position}>{letter}</span>:<input key={position} ref={element=>{inputs.current[index]=element}} aria-label={`第 ${position+1} 个字母`} aria-invalid={feedback===false} value={slots[index]} disabled={feedback!==null} maxLength={1} inputMode="text" autoComplete="off" autoCapitalize="none" spellCheck={false} onFocus={event=>event.target.select()} onChange={event=>update(index,event.target.value)} onPaste={event=>{event.preventDefault();update(index,event.clipboardData.getData('text'))}} onKeyDown={event=>{
   if(event.key==='ArrowLeft'&&index>0){event.preventDefault();focus(index-1)}
   else if(event.key==='ArrowRight'&&index+1<slots.length){event.preventDefault();focus(index+1)}
   else if(event.key==='Backspace'&&!slots[index]&&index>0){event.preventDefault();setSlots(fillSpellingSlots(slots,index-1,''));focus(index-1)}
  }}/>;
 })}</div>;
}
