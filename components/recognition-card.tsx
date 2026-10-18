'use client';
import { useEffect,useRef,useState,type PointerEvent,type ReactNode } from 'react';
import { ArrowLeft,ArrowDown,ArrowRight } from 'lucide-react';
import { swipeDirection,swipeRating,type CardRating } from '@/lib/card-swipe';
const labels={unknown:'不认识',unsure:'模糊',known:'认识'};
export default function RecognitionCard({children,onRate,active}:{children:ReactNode;onRate:(rating:CardRating)=>(()=>void)|undefined;active:boolean}){
 const card=useRef<HTMLElement>(null),stamp=useRef<HTMLSpanElement>(null);
 const gesture=useRef<{id:number;x:number;y:number;start:number;dx:number;dy:number;moved:boolean}|undefined>(undefined);
 const frame=useRef(0),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined),committed=useRef(false),current=useRef(onRate);
 const [busy,setBusy]=useState(false);current.current=onRate;
 function home(){
  cancelAnimationFrame(frame.current);const node=card.current;if(!node)return;
  node.dataset.dragging='false';node.style.animation='none';node.style.transform='';node.style.opacity='';delete node.dataset.swipe;
  if(stamp.current)stamp.current.style.opacity='0';
 }
 useEffect(()=>{
  if(!active){gesture.current=undefined;clearTimeout(timer.current);committed.current=false;setBusy(false);home()}
  return()=>{cancelAnimationFrame(frame.current);clearTimeout(timer.current)};
 },[active]);
 function draw(){
  frame.current=0;const g=gesture.current,node=card.current;if(!g||!node)return;
  const direction=swipeDirection(g.dx,g.dy),x=direction==='unsure'?g.dx*.25:g.dx,y=direction==='unsure'?g.dy:g.dy*.25;
  node.style.transform=`translate3d(${x}px,${y}px,0) rotate(${Math.max(-10,Math.min(10,x/26))}deg)`;
  if(direction)node.dataset.swipe=direction;else delete node.dataset.swipe;
  if(stamp.current){stamp.current.textContent=direction?labels[direction]:'';stamp.current.style.opacity=direction?String(Math.min(1,Math.max(0,(Math.max(Math.abs(g.dx),g.dy)-12)/64))):'0'}
 }
 function commit(rating:CardRating){
  if(committed.current||!active)return;committed.current=true;gesture.current=undefined;cancelAnimationFrame(frame.current);setBusy(true);
  // Save intent immediately; only defer the visual advance, not the record.
  const advance=current.current(rating);
  if(!advance){committed.current=false;setBusy(false);home();return}
  const node=card.current,reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(node){
   node.dataset.dragging='false';node.style.animation='none';node.dataset.swipe=rating;
   if(stamp.current){stamp.current.textContent=labels[rating];stamp.current.style.opacity='1'}
   node.style.transform=reduced?'':rating==='unsure'?`translate3d(0,${window.innerHeight}px,0) scale(.96)`:`translate3d(${(rating==='known'?1:-1)*window.innerWidth}px,0,0) rotate(${rating==='known'?14:-14}deg)`;
   node.style.opacity='0';
  }
  timer.current=setTimeout(advance,reduced?0:180);
 }
 function down(event:PointerEvent<HTMLElement>){
  if(!event.isPrimary){gesture.current=undefined;home();return}
  if(!active||committed.current||event.button!==0||(event.target as Element).closest('button,a,input,textarea,select,.revealed'))return;
  gesture.current={id:event.pointerId,x:event.clientX,y:event.clientY,start:performance.now(),dx:0,dy:0,moved:false};
  event.currentTarget.setPointerCapture(event.pointerId);
 }
 function move(event:PointerEvent<HTMLElement>){
  const g=gesture.current;if(!g||g.id!==event.pointerId||committed.current)return;
  g.dx=event.clientX-g.x;g.dy=event.clientY-g.y;
  if(!g.moved&&Math.hypot(g.dx,g.dy)<8)return;
  if(!g.moved){g.moved=true;event.currentTarget.setPointerCapture(event.pointerId);event.currentTarget.dataset.dragging='true'}
  event.preventDefault();if(!frame.current)frame.current=requestAnimationFrame(draw);
 }
 function release(event:PointerEvent<HTMLElement>,cancelled=false){
  const g=gesture.current;if(!g||g.id!==event.pointerId)return;
  const rating=cancelled?null:swipeRating(event.clientX-g.x,event.clientY-g.y,performance.now()-g.start,card.current?.clientWidth||320);
  gesture.current=undefined;
  if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
  if(rating)commit(rating);else home();
 }
 return <div className="recognition-interaction"><div className="swipe-deck"><div className="swipe-card-underlay" aria-hidden="true"/><section ref={card} className="flashcard swipe-card" aria-label="单词认知卡片" onPointerDown={down} onPointerMove={move} onPointerUp={event=>release(event)} onPointerCancel={event=>release(event,true)} onLostPointerCapture={()=>{if(gesture.current){gesture.current=undefined;home()}}} onClickCapture={event=>{if(committed.current){event.preventDefault();event.stopPropagation()}}}><div className="swipe-gesture-surface" aria-hidden="true"/>{children}<span ref={stamp} className="swipe-rating-stamp" aria-hidden="true"/></section></div><div className="rating-buttons"><button disabled={busy} onClick={()=>commit('unknown')}><ArrowLeft size={18} aria-hidden="true"/>不认识</button><button disabled={busy} onClick={()=>commit('unsure')}><ArrowDown size={18} aria-hidden="true"/>模糊</button><button disabled={busy} onClick={()=>commit('known')}><ArrowRight size={18} aria-hidden="true"/>认识</button></div></div>;
}
