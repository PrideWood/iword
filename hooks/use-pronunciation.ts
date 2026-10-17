'use client';
import { useCallback, useEffect, useRef } from 'react';
import type { PronunciationRequest } from '@/lib/pronunciation';
import { prepareAudio, playCachedAudio, stopAudio, unlockAudio } from '@/lib/audio-client';
export function usePronunciation(notify:(message:string)=>void){
 const sequence=useRef(0);
 const cancel=useCallback(()=>{sequence.current++;stopAudio()},[]);
 const speak=useCallback(async(request:PronunciationRequest)=>{
  cancel();const id=sequence.current;
  try{await unlockAudio();await prepareAudio(request.text);if(sequence.current===id)await playCachedAudio(request.text,()=>sequence.current===id)}
  catch(error){if(sequence.current===id)notify(error instanceof Error?error.message:'播放失败，请重试')}
 },[cancel,notify]);
 useEffect(()=>cancel,[cancel]);
 return {speak,cancel};
}
