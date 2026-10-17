'use client';
export default function ErrorPage({reset}:{reset:()=>void}){return <main className="signin"><h1>课堂暂时无法加载</h1><p>请稍后重试。</p><button className="btn primary" onClick={reset}>重新连接</button></main>}
