'use client';
import { Check } from 'lucide-react';
import type { Workspace,Task,Word } from '@/lib/types';
import { learnedWordIds } from '@/lib/learning';
import { date,Empty,percent } from './shared';
export default function StudentTaskList({data,studentId,onOpen}:{data:Workspace;studentId:string;onOpen:(task:Task)=>void}){
 const student=data.students.find(s=>s.id===studentId),today=new Date(Date.now()+8*3600000).toISOString().slice(0,10);
 const groups=new Map<string,Task[]>();
 for(const task of data.tasks.filter(t=>t.classId===student?.classId&&t.status!=='deleted').sort((a,b)=>a.startAt.localeCompare(b.startAt)||a.id.localeCompare(b.id,undefined,{numeric:true}))){const day=new Date(Date.parse(task.startAt)+8*3600000).toISOString().slice(0,10);const group=groups.get(day)||[];group.push(task);groups.set(day,group)}
 return <div className="student-task-list daily-task-list">{[...groups].map(([day,tasks])=>{
  const completed=tasks.filter(t=>data.learning.some(l=>l.taskId===t.id&&l.studentId===studentId&&l.firstCompletedAt)).length;
  const count=tasks.reduce((total,t)=>total+(JSON.parse(t.wordSnapshot) as Word[]).length,0);
  return <details className="daily-task-group" key={day} open={day<=today}><summary><strong>{day}{day===today?' · 今日':''}</strong><span>{tasks.length} 批 · {count} 词 · 已完成 {completed}/{tasks.length} 批</span></summary><div className="daily-task-cards">{tasks.map(task=>{
   const progress=data.learning.find(l=>l.taskId===task.id&&l.studentId===studentId),words=JSON.parse(task.wordSnapshot) as Word[],learned=learnedWordIds(words,progress),notStarted=Date.parse(task.startAt)>Date.now();
   return <article className="student-task" key={task.id}><div className="student-task-main"><div><h3>{task.name}{progress?.firstCompletedAt&&<span className="task-cleared"><Check size={14}/>已完成</span>}</h3><p>{words.length} 个单词 · {date(task.deadline,true)} 截止</p></div></div><div className="student-task-bottom"><div className="table-progress"><span>{learned.size} / {words.length}</span><div className="progress-track"><i style={{width:percent(learned.size,words.length)+'%'}}/></div></div><button className="btn primary" disabled={notStarted} onClick={()=>onOpen(task)}>{notStarted?'未开始':progress?.firstCompletedAt?'复习':learned.size?'继续闯关':'开始闯关'}</button></div></article>;
  })}</div></details>;
 })}{!groups.size&&<Empty text="暂无任务"/>}</div>;
}
