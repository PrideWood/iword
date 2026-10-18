'use client';
import { useEffect,useMemo,useRef,useState } from 'react';
import { ChevronDown,Volume2,Play,Square } from 'lucide-react';
import type { Workspace,Word } from '@/lib/types';
import { normalizePronunciationTerm } from '@/lib/pronunciation';
import { studentWordBatches } from '@/lib/student-word-batches';
import { usePronunciation } from '@/hooks/use-pronunciation';
export default function StudentWords({data,notify}:{data:Workspace;notify:(message:string)=>void}){
 const [filter,setFilter]=useState<'pending'|'learned'>('pending');const [search,setSearch]=useState('');
 const {speak,cancel,speakSequence}=usePronunciation(notify);
 const [playingBatch,setPlayingBatch]=useState<string|null>(null),[activeWord,setActiveWord]=useState('');const run=useRef(0);
 useEffect(()=>{run.current++;cancel();setPlayingBatch(null);setActiveWord('');return()=>{run.current++;cancel()}},[filter,search,cancel]);
 async function recordReview(taskId:string,words:Word[]){
  const learned=new Set(studentWordBatches(data).filter(entry=>entry.learned).map(entry=>entry.word.id));
  const wordIds=words.filter(word=>learned.has(word.id)).map(word=>word.id);if(!wordIds.length)return;
  try{const response=await fetch('/api/workspace',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'reviewWords',taskId,studentId:data.students[0]?.id,wordIds,eventId:crypto.randomUUID()})});if(!response.ok)throw Error();}catch{notify('复习记录未保存，请稍后重试')}
 }
 async function single(word:Word,taskId:string){run.current++;setPlayingBatch(null);setActiveWord('');if(await speak({text:word.english,accent:'en-US'}))await recordReview(taskId,[word])}
 async function playBatch(id:string){
  const token=++run.current;cancel();if(playingBatch===id){setPlayingBatch(null);setActiveWord('');return}
  const task=data.tasks.find(t=>t.id===id);if(!task)return;
  const words=JSON.parse(task.wordSnapshot) as Word[];
  setPlayingBatch(id);setActiveWord('');const completed=await speakSequence(words.map(word=>({text:word.english,accent:'en-US' as const})),request=>{if(run.current===token)setActiveWord(normalizePronunciationTerm(request.text))});
  if(completed&&run.current===token)await recordReview(id,words);
  if(run.current===token){setPlayingBatch(null);setActiveWord('')}
 }
 const entries=useMemo(()=>studentWordBatches(data),[data]);
 const list=entries.filter(e=>e.learned===(filter==='learned')&&(e.word.english.toLowerCase().includes(search.toLowerCase())||e.word.meaning.includes(search)));
 const batches=new Map<string,typeof list>();for(const entry of list){const group=batches.get(entry.batchId)||[];group.push(entry);batches.set(entry.batchId,group)}
 return <section className="student-content student-words"><h1 className="student-page-title">词表</h1><div className="word-filter" role="tablist" aria-label="词表状态">{(['pending','learned'] as const).map(key=><button key={key} role="tab" aria-selected={filter===key} onClick={()=>setFilter(key)}>{key==='pending'?'待学习':'已学习'}<span>{entries.filter(e=>e.learned===(key==='learned')).length}</span></button>)}</div><input className="word-search" aria-label="搜索单词" placeholder="搜索单词" value={search} onChange={e=>setSearch(e.target.value)}/><div className="student-word-batches">{[...batches].sort(([a,itemsA],[b,itemsB])=>itemsA[0].label.localeCompare(itemsB[0].label,undefined,{numeric:true})||a.localeCompare(b)).map(([id,items])=><details className="student-word-batch" key={filter+id} open><summary><span>{items[0].label}</span><small>{items.length} 词</small><button className="batch-play-button" aria-label={(playingBatch===id?'停止播放本批 ':'播放本批全部单词 ')+items[0].label} aria-pressed={playingBatch===id} onClick={event=>{event.preventDefault();event.stopPropagation();void playBatch(id)}}>{playingBatch===id?<Square size={17}/>:<Play size={17}/>}</button><ChevronDown size={18}/></summary><div className="student-word-list">{items.map(({word})=><article key={word.english} className={playingBatch===id&&normalizePronunciationTerm(word.english)===activeWord?'word-playing':undefined}><div><strong>{word.english}</strong><span>{word.phonetic}</span><p>{word.meaning}</p></div><button className="icon-btn" aria-label={'播放 '+word.english} onClick={()=>void single(word,id)}><Volume2 size={21}/></button></article>)}</div></details>)}{!list.length&&<p className="student-empty">暂无单词</p>}</div></section>
}
