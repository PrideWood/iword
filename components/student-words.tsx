'use client';
import { useMemo, useState } from 'react';
import { Volume2 } from 'lucide-react';
import type { Workspace, Word } from '@/lib/types';
import { learnedWordIds } from '@/lib/learning';
import { normalizePronunciationTerm } from '@/lib/pronunciation';
import { usePronunciation } from '@/hooks/use-pronunciation';
export default function StudentWords({data,notify}:{data:Workspace;notify:(message:string)=>void}){
 const [filter,setFilter]=useState<'pending'|'learned'>('pending');const [search,setSearch]=useState('');
 const {speak}=usePronunciation(notify);
 const entries=useMemo(()=>{
  const result=new Map<string,{word:Word;learned:boolean}>();
  for(const task of data.tasks){
   const words=JSON.parse(task.wordSnapshot) as Word[];
   const learned=learnedWordIds(words,data.learning.find(l=>l.taskId===task.id&&data.students.some(s=>s.id===l.studentId)));
   for(const word of words){const key=normalizePronunciationTerm(word.english),prior=result.get(key);result.set(key,{word,learned:!!prior?.learned||learned.has(word.id)})}
  }
  return [...result.values()].sort((a,b)=>a.word.english.localeCompare(b.word.english));
 },[data]);
 const list=entries.filter(e=>e.learned===(filter==='learned')&&(e.word.english.toLowerCase().includes(search.toLowerCase())||e.word.meaning.includes(search)));
 return <section className="student-content student-words"><h1 className="student-page-title">词表</h1><div className="word-filter" role="tablist" aria-label="词表状态">{(['pending','learned'] as const).map(key=><button key={key} role="tab" aria-selected={filter===key} onClick={()=>setFilter(key)}>{key==='pending'?'待学习':'已学习'}<span>{entries.filter(e=>e.learned===(key==='learned')).length}</span></button>)}</div><input className="word-search" aria-label="搜索单词" placeholder="搜索单词" value={search} onChange={e=>setSearch(e.target.value)}/><div className="student-word-list">{list.map(({word})=><article key={word.english}><div><strong>{word.english}</strong><span>{word.phonetic}</span><p>{word.meaning}</p></div><button className="icon-btn" aria-label={'播放 '+word.english} onClick={()=>void speak({text:word.english,accent:'en-US'})}><Volume2 size={21}/></button></article>)}{!list.length&&<p className="student-empty">暂无单词</p>}</div></section>
}
