'use client';
import { useEffect,useState } from 'react';
import { lessonViewport,type LessonViewport } from '@/lib/lesson-viewport';

export function useLessonViewport(enabled:boolean){
 const [viewport,setViewport]=useState<LessonViewport>();
 useEffect(()=>{
  if(!enabled)return;
  let previous:LessonViewport|undefined;
  const view=window.visualViewport;
  const resize=()=>{
   const editing=document.activeElement instanceof HTMLInputElement||document.activeElement instanceof HTMLTextAreaElement;
   previous=lessonViewport(previous,{width:window.innerWidth,height:window.innerHeight,visualHeight:view?.height||window.innerHeight,editing});
   setViewport(previous);
  };
  resize();view?.addEventListener('resize',resize);window.addEventListener('resize',resize);
  return()=>{view?.removeEventListener('resize',resize);window.removeEventListener('resize',resize)};
 },[enabled]);
 return viewport;
}
