'use client';
import { useMemo, useState } from 'react';
import { ChevronDown,Volume2 } from 'lucide-react';
import type { Workspace } from '@/lib/types';
import { studentWordBatches } from '@/lib/student-word-batches';
import { usePronunciation } from '@/hooks/use-pronunciation';
export default function StudentWords({data,notify}:{data:Workspace;notify:(message:string)=>void}){
 const [filter,setFilter]=useState<'pending'|'learned'>('pending');const [search,setSearch]=useState('');
 const {speak}=usePronunciation(notify);
 const entries=useMemo(()=>studentWordBatches(data),[data]);
 const list=entries.filter(e=>e.learned===(filter==='learned')&&(e.word.english.toLowerCase().includes(search.toLowerCase())||e.word.meaning.includes(search)));
 const batches=new Map<string,typeof list>();for(const entry of list){const group=batches.get(entry.batchId)||[];group.push(entry);batches.set(entry.batchId,group)}
 return <section className="student-content student-words"><h1 className="student-page-title">词表</h1><div className="word-filter" role="tablist" aria-label="词表状态">{(['pending','learned'] as const).map(key=><button key={key} role="tab" aria-selected={filter===key} onClick={()=>setFilter(key)}>{key==='pending'?'待学习':'已学习'}<span>{entries.filter(e=>e.learned===(key==='learned')).length}</span></button>)}</div><input className="word-search" aria-label="搜索单词" placeholder="搜索单词" value={search} onChange={e=>setSearch(e.target.value)}/><div className="student-word-batches">{[...batches].reverse().map(([id,items])=><details className="student-word-batch" key={filter+id} open><summary><span>{items[0].label}</span><small>{items.length} 词</small><ChevronDown size={18}/></summary><div className="student-word-list">{items.sort((a,b)=>a.word.english.localeCompare(b.word.english)).map(({word})=><article key={word.english}><div><strong>{word.english}</strong><span>{word.phonetic}</span><p>{word.meaning}</p></div><button className="icon-btn" aria-label={'播放 '+word.english} onClick={()=>void speak({text:word.english,accent:'en-US'})}><Volume2 size={21}/></button></article>)}</div></details>)}{!list.length&&<p className="student-empty">暂无单词</p>}</div></section>
}
