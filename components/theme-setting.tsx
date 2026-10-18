'use client';
import { useEffect,useState } from 'react';
import { Moon,Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
export default function ThemeSetting(){
 const {resolvedTheme,setTheme}=useTheme();
 const [ready,setReady]=useState(false);useEffect(()=>setReady(true),[]);
 return <div className="theme-setting"><span>外观模式</span><div className="theme-options" role="group" aria-label="外观模式">{([{id:'light',label:'浅色',icon:Sun},{id:'dark',label:'深色',icon:Moon}] as const).map(item=><button key={item.id} disabled={!ready} aria-pressed={ready&&resolvedTheme===item.id} onClick={()=>setTheme(item.id)}><item.icon size={18}/>{item.label}</button>)}</div></div>;
}
