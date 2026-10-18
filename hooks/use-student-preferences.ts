'use client';
import { useCallback, useEffect, useState } from 'react';
const memory=new Map<string,boolean>();
export function useStudentPreferences(studentId:string){
 const key='iword:autoplay:'+studentId;
 const [value,setValue]=useState({key:'',autoPlay:true});
 useEffect(()=>{
  const read=()=>{let autoPlay=memory.get(key)??true;try{const saved=localStorage.getItem(key);if(saved!==null)autoPlay=saved!=='off'}catch{/* The in-memory preference still works when browser storage is disabled. */}setValue({key,autoPlay})};
  read();window.addEventListener('storage',read);return()=>window.removeEventListener('storage',read);
 },[key]);
 const setAutoPlay=useCallback((autoPlay:boolean)=>{memory.set(key,autoPlay);setValue({key,autoPlay});try{localStorage.setItem(key,autoPlay?'on':'off')}catch{/* Keep the preference for this session. */}},[key]);
 return {ready:value.key===key,autoPlay:value.key===key?value.autoPlay:true,setAutoPlay};
}
