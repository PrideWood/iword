'use client';
import { useState } from 'react';
export default function LoginPage(){
 const [error,setError]=useState('');const [pending,setPending]=useState(false);
 return <main className="signin"><section className="panel" style={{width:'min(420px, 100%)',padding:32,textAlign:'left'}}><img src="/favicon.svg" width={48} height={48} alt="词间"/><h1>欢迎回到词间</h1><p>教师与学生使用各自账号登录</p><form onSubmit={async e=>{e.preventDefault();setError('');setPending(true);const f=new FormData(e.currentTarget);try{const r=await fetch('/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(Object.fromEntries(f))});const j=await r.json();if(!r.ok)throw Error(j.error);window.location.assign('/')}catch(error){setError(error instanceof Error?error.message:'登录失败')}finally{setPending(false)}}}>
 <label>账号<input name="username" required minLength={3} maxLength={64} autoComplete="username" autoCapitalize="none"/></label><label>密码<input name="password" type="password" required maxLength={128} autoComplete="current-password"/></label>{error&&<p className="error-box" role="alert">{error}</p>}<button className="btn primary" style={{width:'100%',marginTop:20}} disabled={pending}>{pending?'正在登录…':'登录课堂'}</button></form><p className="subtle" style={{marginTop:20}}>学生账号由任课教师分配。忘记密码请联系教师。</p></section></main>
}
