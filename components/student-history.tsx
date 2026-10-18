'use client';
import type { Workspace } from '@/lib/types';
import { date, percent } from './shared';

export default function StudentHistory({data}:{data:Workspace}){
 const records=data.learning.toSorted((a,b)=>(b.lastSeenAt||b.startedAt||'').localeCompare(a.lastSeenAt||a.startedAt||''));
 return <section className="student-history panel"><h2>学习记录</h2>{records.length?records.map(record=>{
  const task=data.tasks.find(task=>task.id===record.taskId);
  const attempts=data.attempts.filter(a=>a.taskId===record.taskId&&a.studentId===record.studentId).toSorted((a,b)=>b.completedAt.localeCompare(a.completedAt));
  const latest=attempts[0];
  return <article key={record.id}><div><h3>{task?.name||'历史任务'}{task?.status==='deleted'&&<span>已删除</span>}</h3><p>{record.lastSeenAt||record.startedAt?date((record.lastSeenAt||record.startedAt)!,true):'历史学习'} · 已学 {record.position} 词</p></div><strong>{latest?`${percent(latest.correct,latest.total)}%`:'学习中'}</strong></article>;
 }):<p className="student-empty">暂无学习记录</p>}</section>;
}
