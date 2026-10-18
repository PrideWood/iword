'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen, LibraryBig, UserRound, X, LockKeyhole, ChevronRight } from 'lucide-react';
import type { Workspace } from '@/lib/types';
import StudentView from './features/student';
import StudentWords from './student-words';
import StudentHistory from './student-history';
import StudentStats from './student-stats';
import { LogoutButton } from './auth-controls';
type Tab='learn'|'words'|'account';
export default function StudentApp({initialData,name,username,initialTab='learn'}:{initialData:Workspace;name:string;username:string;initialTab?:Tab}){
 const [data,setData]=useState(initialData),[message,setMessage]=useState('');
 const [tab,setTab]=useState<Tab>(initialTab);const student=data.students[0];
 const notify=useCallback((value:string)=>setMessage(value),[]);
 const refresh=useCallback(async()=>{try{const response=await fetch('/api/workspace');if(response.ok)setData(await response.json())}catch{/* Keep the current lesson usable during a temporary disconnect. */}},[]);
 useEffect(()=>{const onFocus=()=>{void refresh()};window.addEventListener('focus',onFocus);return()=>window.removeEventListener('focus',onFocus)},[refresh]);
 const mutate=useCallback(async(body:Record<string,unknown>)=>{
  try{const r=await fetch('/api/workspace',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const j=await r.json();if(!r.ok)throw Error(j.error);setData(j);return true}
  catch(error){setMessage(error instanceof Error?error.message:'保存失败');return false}
 },[]);
 const tabs=[{id:'learn' as const,label:'学习',icon:BookOpen},{id:'words' as const,label:'词表',icon:LibraryBig},{id:'account' as const,label:'我的',icon:UserRound}];
 return <div className="student-layout"><main className="student-main">
  <section className="student-screen" hidden={tab!=='learn'}><StudentView data={data} studentOnly active={tab==='learn'} notify={notify} mutate={mutate}/></section>
  {tab==='words'&&<StudentWords data={data} notify={notify}/>}
  {tab==='account'&&<section className="student-content student-account"><h1 className="student-page-title">我的</h1><div className="account-identity panel"><span className="student-avatar"><UserRound size={28}/></span><div><h2>{student?.name||name}</h2><p>账号：{username}</p><p>学号：{student?.number}</p><p>{data.classes.find(c=>c.id===student?.classId)?.name}</p></div></div><Link className="account-security-row panel" href="/account/password"><LockKeyhole size={19}/><span>修改密码</span><ChevronRight size={19}/></Link><StudentStats/><StudentHistory data={data}/><LogoutButton/></section>}
 </main><nav className="student-bottom-nav" aria-label="学生导航">{tabs.map(item=><button key={item.id} aria-current={tab===item.id?'page':undefined} onClick={()=>{setTab(item.id);setMessage('');void refresh()}}><item.icon size={22}/><span>{item.label}</span></button>)}</nav>
 {message&&<div className="toast" role="status">{message}<button aria-label="关闭提示" onClick={()=>setMessage('')}><X size={16}/></button></div>}
 </div>
}
