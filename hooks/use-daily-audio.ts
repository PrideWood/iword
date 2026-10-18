'use client';
import { useEffect, useState } from 'react';
import type { Workspace } from '@/lib/types';
import { dailyAudioPlan,cacheDailyAudio } from '@/lib/daily-audio';
import { cachedAudioUrl,prepareTaskAudio } from '@/lib/audio-client';
import { studyDay } from '@/lib/study-stats';

export function useDailyAudio(data:Workspace){
 const [day,setDay]=useState(()=>studyDay());
 const [progress,setProgress]=useState({done:0,total:0});
 const student=data.students[0];
 const signature=JSON.stringify(dailyAudioPlan(data.tasks,student?.classId||'',day));
 useEffect(()=>{const timer=setInterval(()=>setDay(studyDay()),60000);return()=>clearInterval(timer)},[]);
 useEffect(()=>{
  let cancelled=false,running=false,attempt=0,timer:ReturnType<typeof setTimeout>|undefined;
  const plan=JSON.parse(signature) as ReturnType<typeof dailyAudioPlan>;
  const blocked=new Set<string>();
  const current=()=>!cancelled;
  const run=async()=>{
   if(cancelled||running||!navigator.onLine)return;
   clearTimeout(timer);running=true;
   try{
    const result=await cacheDailyAudio(plan,{cached:term=>!!cachedAudioUrl(term),prepare:prepareTaskAudio,current,blocked,progress:(done,total)=>setProgress({done,total})});
    if(current()&&result.retry)timer=setTimeout(()=>void run(),Math.min(60000,5000*2**Math.min(attempt++,4)));
   }finally{running=false}
  };
  const resume=()=>{if(document.visibilityState==='visible')void run()};
  void run();window.addEventListener('online',run);document.addEventListener('visibilitychange',resume);
  return()=>{cancelled=true;clearTimeout(timer);window.removeEventListener('online',run);document.removeEventListener('visibilitychange',resume)};
 },[signature,student?.id]);
 return progress;
}
