'use client';
import { useCallback, useEffect, useRef } from 'react';
import type { PronunciationRequest } from '@/lib/pronunciation';
const signedUrlCache=new Map<string,{url:string;expires:number}>();

export function usePronunciation(notify:(message:string)=>void){
 const audioRef=useRef<HTMLAudioElement|null>(null);
 const requestRef=useRef<AbortController|null>(null);
 const sequence=useRef(0);
 const cancel=useCallback(()=>{
  sequence.current++;requestRef.current?.abort();requestRef.current=null;
  window.speechSynthesis?.cancel();
  if(audioRef.current){audioRef.current.pause();audioRef.current.removeAttribute('src');audioRef.current.load();audioRef.current=null}
 },[]);
 const speak=useCallback(async(request:PronunciationRequest)=>{
  cancel();const id=sequence.current;const controller=new AbortController();requestRef.current=controller;
  try{
   const cacheKey=request.text.trim().toLowerCase();const cached=signedUrlCache.get(cacheKey);
   let url=cached&&cached.expires>Date.now()?cached.url:undefined;
   if(!url){const response=await fetch('/api/pronunciation',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:request.text}),signal:controller.signal});
    const result=await response.json();if(!response.ok)throw Error(result.error);url=String(result.url);signedUrlCache.set(cacheKey,{url,expires:Date.now()+9*60*1000});}
   if(sequence.current!==id)return;
   const audio=new Audio(url);audioRef.current=audio;
   audio.onerror=()=>{signedUrlCache.delete(cacheKey);if(sequence.current===id)notify('音频加载失败，请重新点击播放')};
   await audio.play();
  }catch(error){if(sequence.current===id&&!controller.signal.aborted)notify(error instanceof Error?error.message:'发音播放失败，请重试')}
 },[cancel,notify]);
 useEffect(()=>cancel,[cancel]);
 return {speak,cancel};
}
