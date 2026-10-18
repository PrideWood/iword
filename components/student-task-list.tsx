'use client';
import { useEffect,useState } from 'react';
import { Check } from 'lucide-react';
import type { Workspace,Task,Word } from '@/lib/types';
import { learnedWordIds } from '@/lib/learning';
import { taskBatch } from '@/lib/batch-plan';
import { requirementComplete,studentRequirements,taskRequirements } from '@/lib/task-requirements';
import { date,Empty,percent } from './shared';
type Props={data:Workspace;studentId:string;onOpen:(task:Task)=>void};
function TaskCard({task,data,studentId,onOpen,optional=false}:Props&{task:Task;optional?:boolean}){
 const progress=data.learning.find(l=>l.taskId===task.id&&l.studentId===studentId),words=JSON.parse(task.wordSnapshot) as Word[],learned=learnedWordIds(words,progress),notStarted=Date.parse(task.startAt)>Date.now();
 return <article className="student-task"><div className="student-task-main"><div><h3>{task.name}{progress?.firstCompletedAt&&<span className="task-cleared"><Check size={14}/>已完成</span>}</h3><p>{words.length} 个单词 · {date(task.deadline,true)} 截止{optional?' · 选学':''}</p></div></div><div className="student-task-bottom"><div className="table-progress"><span>{learned.size} / {words.length}</span><div className="progress-track"><i style={{width:percent(learned.size,words.length)+'%'}}/></div></div><button className="btn primary" disabled={notStarted} onClick={()=>onOpen(task)}>{notStarted?'未开始':progress?.firstCompletedAt?'复习':learned.size?'继续闯关':optional?'开始选学':'开始闯关'}</button></div></article>;
}
function ChoiceTasks({group,...props}:Props&{group:ReturnType<typeof taskRequirements>[number]}){
 const options=[...group.options],first=options[0][0],planId=taskBatch(options[0][1][0].rulesSnapshot)!.choiceGroupId;
 const [selected,setSelected]=useState(first),key=`iword-choice:${props.studentId}:${planId}`;
 useEffect(()=>{const read=()=>{try{const saved=localStorage.getItem(key);if(saved&&group.options.has(saved))setSelected(saved)}catch{}};read();window.addEventListener('iword-choice-change',read);return()=>window.removeEventListener('iword-choice-change',read)},[key,group.options]);
 const done=requirementComplete(props.data,props.studentId,group),current=group.options.get(selected)||options[0][1];
 const optionDone=(tasks:Task[])=>tasks.every(task=>props.data.learning.some(l=>l.studentId===props.studentId&&l.taskId===task.id&&l.firstCompletedAt));
 return <section className="choice-task-group"><div className="choice-heading"><strong>任选一套</strong>{done&&<span className="task-cleared"><Check size={14}/>当天任务已完成</span>}</div><div className="choice-options" role="tablist" aria-label="选择词库方案">{options.map(([id,tasks])=><button key={id} role="tab" aria-selected={(group.options.has(selected)?selected:first)===id} onClick={()=>{setSelected(id);try{localStorage.setItem(key,id);window.dispatchEvent(new Event('iword-choice-change'))}catch{}}}><strong>{taskBatch(tasks[0].rulesSnapshot)?.optionName||'词库方案'}</strong><span>{tasks.length} 批 · {tasks.reduce((n,t)=>n+JSON.parse(t.wordSnapshot).length,0)} 词{optionDone(tasks)?' · 已完成':''}</span></button>)}</div><div className="daily-task-cards">{current.map(task=><TaskCard key={task.id} task={task} {...props} optional={done&&!optionDone(current)}/>)}</div></section>;
}
export default function StudentTaskList(props:Props){
 const {data,studentId}=props,student=data.students.find(s=>s.id===studentId),today=new Date(Date.now()+8*3600000).toISOString().slice(0,10);
 const groups=new Map<string,Task[]>();
 for(const task of data.tasks.filter(t=>t.classId===student?.classId&&t.status!=='deleted').sort((a,b)=>a.startAt.localeCompare(b.startAt)||a.id.localeCompare(b.id,undefined,{numeric:true}))){const day=new Date(Date.parse(task.startAt)+8*3600000).toISOString().slice(0,10);const group=groups.get(day)||[];group.push(task);groups.set(day,group)}
 return <div className="student-task-list daily-task-list">{[...groups].map(([day,tasks])=>{
  const requirements=taskRequirements(tasks),choice=requirements.some(r=>r.choice),stats=studentRequirements(data,tasks,studentId),count=tasks.reduce((total,t)=>total+(JSON.parse(t.wordSnapshot) as Word[]).length,0);
  return <details className="daily-task-group" key={day} open={day<=today}><summary><strong>{day}{day===today?' · 今日':''}</strong><span>{choice?`${stats.total} 项要求 · 已完成 ${stats.completed}/${stats.total}`:`${tasks.length} 批 · ${count} 词 · 已完成 ${stats.completed}/${tasks.length} 批`}</span></summary><div className="daily-task-cards">{requirements.map(group=>group.choice?<ChoiceTasks key={group.id} group={group} {...props}/>:<TaskCard key={group.id} task={[...group.options.values()][0][0]} {...props}/>)}</div></details>;
 })}{!groups.size&&<Empty text="暂无任务"/>}</div>;
}
