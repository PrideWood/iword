'use client';
import { useCallback, useEffect, useState } from 'react';
import { CARD_FONT,cardFontSize } from '@/lib/card-typography';
const memory=new Map<string,boolean>();
const fontMemory=new Map<string,number>();
export function useStudentPreferences(studentId:string){
 const key='iword:autoplay:'+studentId;
 const fontKey='iword:card-font:'+studentId;
 const [value,setValue]=useState({key:'',autoPlay:true,fontSize:CARD_FONT.default});
 useEffect(()=>{
  const read=()=>{let autoPlay=memory.get(key)??true,fontSize=fontMemory.get(fontKey)??CARD_FONT.default;try{const saved=localStorage.getItem(key);if(saved!==null)autoPlay=saved!=='off';const font=localStorage.getItem(fontKey);if(font!==null)fontSize=cardFontSize(font)}catch{/* The in-memory preference still works when browser storage is disabled. */}setValue({key,autoPlay,fontSize})};
  read();window.addEventListener('storage',read);return()=>window.removeEventListener('storage',read);
 },[key,fontKey]);
 const setAutoPlay=useCallback((autoPlay:boolean)=>{memory.set(key,autoPlay);setValue(previous=>({...previous,key,autoPlay}));try{localStorage.setItem(key,autoPlay?'on':'off')}catch{/* Keep the preference for this session. */}},[key]);
 const setFontSize=useCallback((next:number)=>{const fontSize=cardFontSize(next);fontMemory.set(fontKey,fontSize);setValue(previous=>({...previous,key,fontSize}));try{localStorage.setItem(fontKey,String(fontSize))}catch{/* Keep the preference for this session. */}},[key,fontKey]);
 return {ready:value.key===key,autoPlay:value.key===key?value.autoPlay:true,setAutoPlay,fontSize:value.key===key?value.fontSize:CARD_FONT.default,setFontSize};
}
