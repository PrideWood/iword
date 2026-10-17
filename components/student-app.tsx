'use client';
import { useState } from 'react';
import type { Workspace } from '@/lib/types';
import StudentView from './features/student';
import { LogoutButton, ChangePasswordForm } from './auth-controls';
export default function StudentApp({initialData,name}:{initialData:Workspace;name:string}){
 const [data,setData]=useState(initialData);const [message,setMessage]=useState('');
 return <div><header className="topbar"><strong>词间 · {name}的学习空间</strong><LogoutButton/></header><main className="main-content"><details className="panel" style={{padding:16,marginBottom:16}}><summary>账户与密码</summary><ChangePasswordForm/></details><StudentView data={data} studentOnly notify={setMessage} mutate={async body=>{try{const r=await fetch('/api/workspace',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const j=await r.json();if(!r.ok)throw Error(j.error);setData(j);return true}catch(error){setMessage(error instanceof Error?error.message:'保存失败');return false}}}/>{message&&<div className="toast" role="status" onClick={()=>setMessage('')}>{message}</div>}</main></div>
}
