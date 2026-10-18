'use client';
import { forwardRef,useImperativeHandle,useLayoutEffect,useRef,useState } from 'react';
import type { SpellingPrompt } from '@/lib/learning';
import { fillSpellingSlots,SpellingKeyGuard } from '@/lib/inline-spelling';

export type SpellingFocus={focus:()=>void};
const InlineSpelling=forwardRef<SpellingFocus,{word:string;prompt:SpellingPrompt;feedback:boolean|null;active:boolean;onComplete:(answer:string)=>void}>(function InlineSpelling({word,prompt,feedback,active,onComplete},ref){
 const [slots,setSlots]=useState(()=>prompt.missing.map(()=>''));
 const inputs=useRef<(HTMLInputElement|null)[]>([]),finished=useRef(false);
 const guard=useRef(new SpellingKeyGuard());
 const focus=(index:number)=>{const input=inputs.current[index];input?.focus({preventScroll:true});input?.setSelectionRange(0,input.value.length)};
 useImperativeHandle(ref,()=>({focus:()=>focus(0)}));
 useLayoutEffect(()=>{
  if(!active||feedback!==null)return;
  focus(0);
  // iOS can move focus back to the bridge/body during keyboard animation.
  // Recover only a lost focus: never steal it from a slot the student selected.
  const restore=()=>{
   if(finished.current)return;
   const element=document.activeElement;
   if(element===document.body||element===document.documentElement||element?.classList.contains('spelling-keyboard-bridge')){
    const first=inputs.current.findIndex(input=>input&&!input.value);focus(first<0?0:first);
   }
  };
  const frame=requestAnimationFrame(restore),timers=[80,250,600].map(delay=>setTimeout(restore,delay));
  window.visualViewport?.addEventListener('resize',restore);
  return()=>{cancelAnimationFrame(frame);timers.forEach(clearTimeout);window.visualViewport?.removeEventListener('resize',restore)};
 },[active]);
 function update(index:number,value:string,paste=false){
  if(feedback!==null||finished.current)return;
  if(!paste){value=value.replace(/[^a-z]/gi,'').slice(-1).toLowerCase();if(value&&!guard.current.accept(value,performance.now()))return}
  const next=fillSpellingSlots(slots,index,value);setSlots(next);
  if(next.every(Boolean)){finished.current=true;onComplete(next.join(''));return}
  if(value.replace(/[^a-z]/gi,'')){
   const after=Math.min(index+value.replace(/[^a-z]/gi,'').length,next.length-1);
   const empty=next.findIndex((letter,i)=>i>=after&&!letter);
   focus(empty>=0?empty:next.findIndex(letter=>!letter));
  }
 }
 return <div className={'inline-spelling '+(feedback===null?'':feedback?'correct':'incorrect')} role="group" aria-label="待补全单词" lang="en">{[...word].map((letter,position)=>{
  const index=prompt.missing.indexOf(position);
  return index<0?<span className={letter===' '?'spelling-space':''} key={position}>{letter}</span>:<input key={position} ref={element=>{inputs.current[index]=element}} aria-label={`第 ${position+1} 个字母`} aria-invalid={feedback===false} value={slots[index]} aria-readonly={feedback!==null} onBeforeInput={event=>{if(feedback!==null)event.preventDefault()}} type="text" lang="en" maxLength={1} inputMode="text" enterKeyHint="next" autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} onFocus={event=>event.target.setSelectionRange(0,event.target.value.length)} onChange={event=>update(index,event.target.value)} onPaste={event=>{event.preventDefault();update(index,event.clipboardData.getData('text'),true)}} onKeyUp={()=>guard.current.keyUp()} onKeyDown={event=>{
   if(feedback!==null){event.preventDefault();return}
   if(!guard.current.keyDown(event.key,event.repeat)){event.preventDefault();return}
   if(event.key==='ArrowLeft'&&index>0){event.preventDefault();focus(index-1)}
   else if(event.key==='ArrowRight'&&index+1<slots.length){event.preventDefault();focus(index+1)}
   else if(event.key==='Backspace'&&!slots[index]&&index>0){event.preventDefault();setSlots(fillSpellingSlots(slots,index-1,''));focus(index-1)}
  }}/>;
 })}</div>;
});
export default InlineSpelling;
