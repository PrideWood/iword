'use client';
import Link from 'next/link';
import { useState } from 'react';
export default function LoginForm({role}:{role:'teacher'|'student'}){
 const [error,setError]=useState(''),[pending,setPending]=useState(false);
 return <main className="signin login-page"><section className="panel login-card"><img src="/favicon.svg" width={48} height={48} alt="词间"/><h1>{role==='teacher'?'教师登录':'学生登录'}</h1><form className="auth-form" onSubmit={async e=>{e.preventDefault();setError('');setPending(true);try{const r=await fetch('/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...Object.fromEntries(new FormData(e.currentTarget)),role})});const j=await r.json();if(!r.ok)throw Error(j.error);window.location.assign(j.redirectTo)}catch(error){setError(error instanceof Error?error.message:'登录失败')}finally{setPending(false)}}}>
 <label htmlFor="login-username">账号<input id="login-username" name="username" required minLength={3} maxLength={64} autoComplete="username" autoCapitalize="none"/></label><label htmlFor="login-password">密码<input id="login-password" name="password" type="password" required maxLength={128} autoComplete="current-password"/></label>{error&&<p className="error-box" role="alert">{error}</p>}<button className="btn primary login-submit" disabled={pending}>{pending?'正在登录…':'登录'}</button></form>{role==='student'&&<p className="login-help"><Link href="/register">学生注册</Link></p>}</section></main>
}
