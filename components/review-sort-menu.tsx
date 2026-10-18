'use client';
import { useEffect,useRef,useState } from 'react';
import { ArrowDownUp,Check } from 'lucide-react';
export default function ReviewSortMenu({value,onChange}:{value:'newest'|'oldest';onChange:(value:'newest'|'oldest')=>void}){
 const [open,setOpen]=useState(false),root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null);
 useEffect(()=>{
  if(!open)return;
  const outside=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false)};
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){setOpen(false);trigger.current?.focus()}};
  document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);
  return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape)};
 },[open]);
 return <div className="review-sort-menu" ref={root}><button ref={trigger} className="icon-btn study-settings" aria-label="复习排序" title="复习排序" aria-expanded={open} aria-haspopup="true" onClick={()=>setOpen(!open)}><ArrowDownUp size={21}/></button>{open&&<div className="review-sort-options" aria-label="排序选项">{(['newest','oldest'] as const).map(order=><button key={order} aria-pressed={value===order} onClick={()=>{onChange(order);setOpen(false);trigger.current?.focus()}}><span>{order==='newest'?'从新到旧':'从旧到新'}</span>{value===order&&<Check size={16}/>}</button>)}</div>}</div>;
}
