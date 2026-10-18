'use client';
import { useEffect } from 'react';
export default function StudentViewportLock(){
 useEffect(()=>{
  const existing=document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  const meta=existing||document.createElement('meta'),original=meta.getAttribute('content');
  if(!existing){meta.name='viewport';document.head.appendChild(meta)}
  meta.content='width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';
  const gesture=(event:Event)=>event.preventDefault();
  const touch=(event:TouchEvent)=>{if(event.touches.length>1)event.preventDefault()};
  document.addEventListener('gesturestart',gesture,{passive:false});
  document.addEventListener('gesturechange',gesture,{passive:false});
  document.addEventListener('touchstart',touch,{passive:false});
  document.addEventListener('touchmove',touch,{passive:false});
  return()=>{
   document.removeEventListener('gesturestart',gesture);document.removeEventListener('gesturechange',gesture);
   document.removeEventListener('touchstart',touch);document.removeEventListener('touchmove',touch);
   if(existing){if(original===null)meta.removeAttribute('content');else meta.content=original}else meta.remove();
  };
 },[]);
 return null;
}
