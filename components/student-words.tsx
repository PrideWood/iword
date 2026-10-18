'use client';
import { useEffect,useMemo,useRef,useState } from 'react';
import { ChevronDown,Volume2,Play,Square } from 'lucide-react';
import type { Workspace,Word } from '@/lib/types';
import { normalizePronunciationTerm } from '@/lib/pronunciation';
import { taskBatch } from '@/lib/batch-plan';
import { studentWordBatches } from '@/lib/student-word-batches';
import { usePronunciation } from '@/hooks/use-pronunciation';
export default function StudentWords({data,notify}:{data:Workspace;notify:(message:string)=>void}){
 const [filter,setFilter]=useState<'pending'|'learned'>('pending');const [search,setSearch]=useState('');
 const [preferences,setPreferences]=useState<Record<string,string>>({});
 useEffect(()=>{const read=()=>{const next:Record<string,string>={};try{for(const task of data.tasks){const id=taskBatch(task.rulesSnapshot)?.choiceGroupId;if(id){const value=localStorage.getItem(`iword-choice:${data.students[0]?.id}:${id}`);if(value)next[id]=value}}}catch{}setPreferences(prior=>JSON.stringify(prior)===JSON.stringify(next)?prior:next)};read();window.addEventListener('iword-choice-change',read);return()=>window.removeEventListener('iword-choice-change',read)},[data]);
 const {speak,cancel,speakSequence}=usePronunciation(notify);
 const [playingBatch,setPlayingBatch]=useState<string|null>(null),[activeWord,setActiveWord]=useState('');const run=useRef(0);
 useEffect(()=>{run.current++;cancel();setPlayingBatch(null);setActiveWord('');return()=>{run.current++;cancel()}},[filter,search,cancel,preferences]);
 function single(word:Word){run.current++;setPlayingBatch(null);setActiveWord('');void speak({text:word.english,accent:'en-US'})}
 async function playBatch(id:string){
  const token=++run.current;cancel();if(playingBatch===id){setPlayingBatch(null);setActiveWord('');return}
  const task=data.tasks.find(t=>t.id===id);if(!task)return;
  const words=(JSON.parse(task.wordSnapshot) as Word[]).sort((a,b)=>a.english.localeCompare(b.english));
  setPlayingBatch(id);setActiveWord('');await speakSequence(words.map(word=>({text:word.english,accent:'en-US' as const})),request=>{if(run.current===token)setActiveWord(normalizePronunciationTerm(request.text))});
  if(run.current===token){setPlayingBatch(null);setActiveWord('')}
 }
 const entries=useMemo(()=>studentWordBatches(data,preferences),[data,preferences]);
 const list=entries.filter(e=>e.learned===(filter==='learned')&&(e.word.english.toLowerCase().includes(search.toLowerCase())||e.word.meaning.includes(search)));
 const batches=new Map<string,typeof list>();for(const entry of list){const group=batches.get(entry.batchId)||[];group.push(entry);batches.set(entry.batchId,group)}
 return <section className="student-content student-words"><h1 className="student-page-title">词表</h1><div className="word-filter" role="tablist" aria-label="词表状态">{(['pending','learned'] as const).map(key=><button key={key} role="tab" aria-selected={filter===key} onClick={()=>setFilter(key)}>{key==='pending'?'待学习':'已学习'}<span>{entries.filter(e=>e.learned===(key==='learned')).length}</span></button>)}</div><input className="word-search" aria-label="搜索单词" placeholder="搜索单词" value={search} onChange={e=>setSearch(e.target.value)}/><div className="student-word-batches">{[...batches].reverse().map(([id,items])=><details className="student-word-batch" key={filter+id} open><summary><span>{items[0].label}</span><small>{items.length} 词</small><button className="batch-play-button" aria-label={(playingBatch===id?'停止播放本批 ':'播放本批全部单词 ')+items[0].label} aria-pressed={playingBatch===id} onClick={event=>{event.preventDefault();event.stopPropagation();void playBatch(id)}}>{playingBatch===id?<Square size={17}/>:<Play size={17}/>}</button><ChevronDown size={18}/></summary><div className="student-word-list">{items.sort((a,b)=>a.word.english.localeCompare(b.word.english)).map(({word})=><article key={word.english} className={playingBatch===id&&normalizePronunciationTerm(word.english)===activeWord?'word-playing':undefined}><div><strong>{word.english}</strong><span>{word.phonetic}</span><p>{word.meaning}</p></div><button className="icon-btn" aria-label={'播放 '+word.english} onClick={()=>single(word)}><Volume2 size={21}/></button></article>)}</div></details>)}{!list.length&&<p className="student-empty">暂无单词</p>}</div></section>
}
