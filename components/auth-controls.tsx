'use client';
import { useEffect, useState } from 'react';
export function LogoutButton({loginPath='/login'}:{loginPath?:string}) {
 return <button className="btn secondary" onClick={async()=>{const r=await fetch('/api/auth/logout',{method:'POST'});if(r.ok)window.location.assign(loginPath)}}>退出登录</button>;
}
export function ChangePasswordForm({loginPath='/login',minimumLength=12}:{loginPath?:string;minimumLength?:number}){
 const [message,setMessage]=useState(''),[pending,setPending]=useState(false);
 return <form onSubmit={async e=>{e.preventDefault();setPending(true);try{const r=await fetch('/api/auth/password',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(e.currentTarget)))});const j=await r.json();if(!r.ok)throw Error(j.error);window.location.assign(loginPath)}catch(error){setMessage(error instanceof Error?error.message:'修改失败')}finally{setPending(false)}}}>
 <h3>修改密码</h3><label>当前密码<input name="currentPassword" type="password" required maxLength={128} autoComplete="current-password"/></label><label>新密码<input name="password" type="password" required minLength={minimumLength} maxLength={128} autoComplete="new-password" placeholder={'至少 '+minimumLength+' 位'}/></label>{message&&<p role="alert">{message}</p>}<button className="btn secondary" disabled={pending}>{pending?'正在修改…':'修改密码并重新登录'}</button></form>;
}
export function StudentAccountForm({students}:{students:{id:string;name:string;number:string}[]}){
 const [selected,setSelected]=useState(students[0]?.id||''),[username,setUsername]=useState(''),[hasAccount,setHasAccount]=useState(false),[loading,setLoading]=useState(true),[message,setMessage]=useState(''),[pending,setPending]=useState(false);
 useEffect(()=>{const controller=new AbortController();setLoading(true);setMessage('');void fetch('/api/auth/accounts?studentId='+encodeURIComponent(selected),{signal:controller.signal}).then(async r=>{const j=await r.json();if(!r.ok)throw Error(j.error);setUsername(j.username);setHasAccount(j.hasAccount)}).catch(error=>{if(!controller.signal.aborted)setMessage(error.message)}).finally(()=>{if(!controller.signal.aborted)setLoading(false)});return()=>controller.abort()},[selected]);
 return <form className="auth-form" onSubmit={async e=>{e.preventDefault();const form=e.currentTarget,f=new FormData(form);setPending(true);try{const r=await fetch('/api/auth/accounts',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({studentId:selected,username,password:f.get('password')})});const j=await r.json();if(!r.ok)throw Error(j.error);setMessage('登录设置已保存，原会话已失效');setHasAccount(true);(form.elements.namedItem('password') as HTMLInputElement).value=''}catch(error){setMessage(error instanceof Error?error.message:'保存失败')}finally{setPending(false)}}}>
 <h3>学生登录设置</h3><label>学生<select value={selected} onChange={e=>setSelected(e.target.value)} required>{students.map(s=><option key={s.id} value={s.id}>{s.name}{s.number?' · '+s.number:''}</option>)}</select></label>
 <label>登录账号（可选）<input value={username} onChange={e=>setUsername(e.target.value)} minLength={3} maxLength={128} autoComplete="off" placeholder="重名时设置，用于区分学生" disabled={loading}/></label>
 <label>{hasAccount?'新密码（留空不修改）':'初始密码'}<input key={selected} name="password" type="password" required={!hasAccount} minLength={6} maxLength={128} autoComplete="new-password" placeholder="至少 6 位"/></label>
 {message&&<p role="status">{message}</p>}<button className="btn primary" disabled={pending||loading||!students.length}>{pending?'正在保存…':'保存登录设置'}</button></form>;
}
