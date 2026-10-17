'use client';
import { useState } from 'react';
export function LogoutButton({loginPath='/login'}:{loginPath?:string}) {
  return <button className="btn secondary" onClick={async()=>{const r=await fetch('/api/auth/logout',{method:'POST'});if(r.ok)window.location.assign(loginPath)}}>退出登录</button>;
}
export function ChangePasswordForm({loginPath='/login'}:{loginPath?:string}){
 const [message,setMessage]=useState('');const [pending,setPending]=useState(false);
 return <form onSubmit={async e=>{e.preventDefault();setPending(true);try{const r=await fetch('/api/auth/password',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(e.currentTarget)))});const j=await r.json();if(!r.ok)throw Error(j.error);window.location.assign(loginPath)}catch(error){setMessage(error instanceof Error?error.message:'修改失败')}finally{setPending(false)}}}>
 <h3>修改密码</h3><label>当前密码<input name="currentPassword" type="password" required maxLength={128} autoComplete="current-password"/></label><label>新密码<input name="password" type="password" required minLength={12} maxLength={128} autoComplete="new-password"/></label>{message&&<p role="alert">{message}</p>}<button className="btn secondary" disabled={pending}>{pending?'正在修改…':'修改密码并重新登录'}</button></form>
}
export function StudentAccountForm({students}:{students:{id:string;name:string;number:string}[]}) {
  const [message,setMessage]=useState('');const [pending,setPending]=useState(false);
  return <form onSubmit={async e=>{e.preventDefault();const form=e.currentTarget;const f=new FormData(form);setPending(true);try{const r=await fetch('/api/auth/accounts',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(Object.fromEntries(f))});const j=await r.json();if(!r.ok)throw Error(j.error);setMessage('学生账号已保存，原登录会话已失效');form.reset()}catch(error){setMessage(error instanceof Error?error.message:'保存失败')}finally{setPending(false)}}}>
    <h3>学生登录账号</h3>
    <label>选择学生<select name="studentId" required>{students.map(s=><option key={s.id} value={s.id}>{s.name} · {s.number}</option>)}</select></label>
    <label>登录账号<input name="username" required minLength={3} maxLength={64} pattern="[a-zA-Z0-9_.\-]+" autoComplete="off" placeholder="例如 student2024001"/></label>
    <label>初始密码 / 新密码<input name="password" type="password" required minLength={12} maxLength={128} autoComplete="new-password"/></label>
    {message&&<p role="status">{message}</p>}<button className="btn primary" disabled={pending||!students.length}>{pending?'正在保存…':'保存学生账号'}</button>
  </form>;
}
