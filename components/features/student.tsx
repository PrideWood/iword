'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Volume2, Check, X, RotateCcw, Headphones, Keyboard, BookOpen } from 'lucide-react';
import type { Workspace, Task, Word } from '@/lib/types';
import type { Mutate } from '../workspace-app';
import { Empty, percent, date } from '../shared';
import { prepareTaskAudio, playCachedAudio, stopAudio, unlockAudio,AudioRequestError,cachedAudioUrl } from '@/lib/audio-client';
import { normalizePronunciationTerm } from '@/lib/pronunciation';
import { learnedWordIds, makeQuestions, shuffle, completeSpelling, type Question, type QuestionType } from '@/lib/learning';

type Answer={wordId:string;type:string;answer:string};
export default function StudentView({data:d,mutate,notify,studentOnly=false,active=true}:{data:Workspace;mutate:Mutate;notify:(s:string)=>void;studentOnly?:boolean;active?:boolean}){
 const [studentId,setStudent]=useState(d.students[2]?.id??d.students[0]?.id??'');
 const student=d.students.find(s=>s.id===studentId);
 const [taskId,setTask]=useState<string|null>(null);
 const task=d.tasks.find(t=>t.id===taskId);
 const words=useMemo(()=>task?JSON.parse(task.wordSnapshot) as Word[]:[],[task]);
 const record=d.learning.find(l=>l.taskId===taskId&&l.studentId===studentId);
 const [queue,setQueue]=useState<Word[]>([]);
 const [questions,setQuestions]=useState<Question[]>([]);
 const [mode,setMode]=useState<'cards'|'quiz'|'report'>('cards');
 const [index,setIndex]=useState(0),[revealed,setRevealed]=useState(false);
 const [answer,setAnswer]=useState(''),[answers,setAnswers]=useState<Answer[]>([]);
 const [feedback,setFeedback]=useState<boolean|null>(null),[pending,setPending]=useState(false);
 const [roundId,setRoundId]=useState('');
 const [loading,setLoading]=useState(false),[download,setDownload]=useState({done:0,total:0});
 const [loadError,setLoadError]=useState(''),[soundBlocked,setSoundBlocked]=useState(false);
 const [unavailable,setUnavailable]=useState<string[]>([]),[audioError,setAudioError]=useState('');
 const currentWord=mode==='cards'?queue[index]:questions[index]?.word;
 const currentQuestion=questions[index];
 const requestId=useRef(0),audioId=useRef(0),lastActive=useRef(Date.now()),mutation=useRef(mutate);
 useEffect(()=>{mutation.current=mutate},[mutate]);
 useEffect(()=>{const touch=()=>{lastActive.current=Date.now()};window.addEventListener('pointerdown',touch);window.addEventListener('keydown',touch);return()=>{window.removeEventListener('pointerdown',touch);window.removeEventListener('keydown',touch)}},[]);
 useEffect(()=>{if(!taskId||mode==='report'||!active)return;const timer=setInterval(()=>{if(document.visibilityState==='visible'&&Date.now()-lastActive.current<30000)void mutation.current({action:'heartbeat',taskId,studentId})},20000);return()=>clearInterval(timer)},[taskId,studentId,mode,active]);
 const play=useCallback(async(text:string,manual=false)=>{
  const id=++audioId.current;
  if(!manual&&unavailable.includes(normalizePronunciationTerm(text))&&!cachedAudioUrl(text)){setAudioError('此单词暂无发音，请联系教师补充生成额度');return}
  try{await playCachedAudio(text,()=>id===audioId.current);if(id===audioId.current){setSoundBlocked(false);setAudioError('')}}
  catch(error){if(id===audioId.current){if(error instanceof AudioRequestError){setAudioError(error.message);setSoundBlocked(false)}else setSoundBlocked(true)}}
 },[unavailable]);
 useEffect(()=>{
  if(!active||loading||loadError||!currentWord||mode==='report'){audioId.current++;stopAudio();return}
  const timer=window.setTimeout(()=>{setAudioError('');if(mode==='cards'||currentQuestion?.type==='listening')void play(currentWord.english)},0);
  return()=>{clearTimeout(timer);audioId.current++;stopAudio()};
 },[active,loading,loadError,mode,currentWord,currentQuestion,play]);
 useEffect(()=>()=>{requestId.current++;audioId.current++;stopAudio()},[]);
 async function cacheTask(t:Task){
  const id=++requestId.current;setLoading(true);setLoadError('');setUnavailable([]);setAudioError('');
  const taskWords=JSON.parse(t.wordSnapshot) as Word[];setDownload({done:0,total:taskWords.length});
  try{const result=await prepareTaskAudio(t.id,taskWords.map(w=>w.english),(done,total)=>{if(id===requestId.current)setDownload({done,total})});if(id===requestId.current)setUnavailable(result.unavailable)}
  catch(error){if(id===requestId.current)setLoadError((error as Error).message)}
  finally{if(id===requestId.current)setLoading(false)}
 }
 function open(t:Task){
  void unlockAudio().catch(()=>{setSoundBlocked(true)});
  const all=JSON.parse(t.wordSnapshot) as Word[];
  const prior=d.learning.find(l=>l.taskId===t.id&&l.studentId===studentId);
  const learned=learnedWordIds(all,prior);
  const remaining=all.filter(w=>!learned.has(w.id));
  setQueue(shuffle(remaining.length?remaining:all));setTask(t.id);setMode('cards');setIndex(0);setRevealed(false);setQuestions([]);setAnswers([]);setAnswer('');setFeedback(null);
  void cacheTask(t);
 }
 function leave(){requestId.current++;audioId.current++;stopAudio();setTask(null);setLoading(false);setLoadError('')}
 function startQuiz(){
  if(!task)return;void unlockAudio().catch(()=>setSoundBlocked(true));
  const rules=JSON.parse(task.rulesSnapshot) as {types:QuestionType[]};
  setQuestions(makeQuestions(words,rules.types));setMode('quiz');setIndex(0);setAnswers([]);setAnswer('');setFeedback(null);setRoundId(crypto.randomUUID());
 }
 async function rate(rating:string){
  if(!task||!currentWord||pending)return;
  setPending(true);
  const learned=learnedWordIds(words,record);learned.add(currentWord.id);
  const ok=await mutate({action:'progress',taskId:task.id,studentId,wordId:currentWord.id,position:learned.size,rating,eventId:crypto.randomUUID()});
  setPending(false);
  if(ok){if(index+1>=queue.length)startQuiz();else{setIndex(index+1);setRevealed(false)}}
 }
 const submittedAnswer=()=>currentQuestion?.type==='spelling'?completeSpelling(currentQuestion.word.english,currentQuestion.spelling,answer):answer;
 const listeningMissing=currentQuestion?.type==='listening'&&unavailable.includes(normalizePronunciationTerm(currentQuestion.word.english))&&!cachedAudioUrl(currentQuestion.word.english);
 const canSubmit=!listeningMissing&&(currentQuestion?.type==='spelling'?answer.length===currentQuestion.spelling.missing.length:!!answer.trim());
 function checkAnswer(){
  if(!currentQuestion||!canSubmit)return;
  const correct=currentQuestion.type==='meaning'?currentQuestion.word.meaning:currentQuestion.word.english;
  setFeedback(submittedAnswer().trim().toLowerCase()===correct.trim().toLowerCase());
 }
 async function nextQuestion(){
  if(!currentQuestion||pending)return;const updated=[...answers,{wordId:currentQuestion.word.id,type:currentQuestion.type,answer:submittedAnswer()}];
  if(index+1<questions.length){void unlockAudio().catch(()=>setSoundBlocked(true));setAnswers(updated);setIndex(index+1);setAnswer('');setFeedback(null)}
  else{setPending(true);const ok=await mutate({action:'attempt',id:roundId,taskId,studentId,answers:updated});setPending(false);if(ok){setMode('report');setAnswers(updated)}}
 }
 if(!student)return <Empty text="暂无学习任务"/>;
 if(task){
  const title=mode==='cards'?'单词学习':mode==='quiz'?'练习':'完成';
  return <div className="student-content learning-content clean-learning">
   <div className="learning-top"><button className="back-link" onClick={leave}><ArrowLeft size={18}/>任务</button><span>{title}</span></div>
   <h1 className="student-task-title">{task.name}</h1>
   {loading?<section className="audio-download panel" aria-live="polite"><Headphones size={30}/><h2>下载任务音频</h2><progress value={download.done} max={download.total||1}/><p>{download.done} / {download.total}</p></section>
   :loadError?<section className="audio-download panel"><p role="alert">{loadError}</p><button className="btn primary" onClick={()=>void cacheTask(task)}>重试</button></section>
   :mode==='report'?<section className="completion-card"><h2>练习完成</h2><strong className="result-score">{percent(answers.filter(a=>{const w=words.find(w=>w.id===a.wordId);return a.answer.trim().toLowerCase()===(a.type==='meaning'?w?.meaning:w?.english)?.trim().toLowerCase()}).length,answers.length)}%</strong><div className="button-row"><button className="btn secondary" onClick={leave}>返回任务</button>{JSON.parse(task.rulesSnapshot).repeat&&<button className="btn primary" onClick={startQuiz}><RotateCcw size={16}/>再练一次</button>}</div></section>
   :<><div className="learning-progress"><span>{mode==='cards'?index+1:index+1} / {mode==='cards'?queue.length:questions.length}</span><div className="progress-track"><i style={{width:((index+1)/(mode==='cards'?queue.length:questions.length)*100)+'%'}}/></div></div>
   {audioError&&<p role="status" className="error-box">{audioError}</p>}
   {soundBlocked&&<button className="btn secondary sound-enable" onClick={async()=>{try{await unlockAudio();if(currentWord)await play(currentWord.english,true)}catch{notify('无法开启声音，请检查浏览器设置')}}}><Volume2 size={17}/>开启声音</button>}
   {mode==='cards'&&currentWord?<><section className="flashcard"><button className="pronounce-btn" aria-label={'播放'+currentWord.english} onClick={()=>{void unlockAudio().then(()=>play(currentWord.english,true)).catch(()=>setSoundBlocked(true))}}><Volume2 size={24}/></button><h2>{currentWord.english}</h2><p className="phonetic">{currentWord.phonetic}</p>{revealed?<div className="revealed"><p><small>{currentWord.pos}</small>{currentWord.meaning}</p>{currentWord.example&&<div className="example"><p>{currentWord.example}</p></div>}</div>:<button className="reveal-answer" onClick={()=>setRevealed(true)}>查看释义</button>}</section><div className="rating-buttons"><button disabled={pending||!revealed} onClick={()=>void rate('unknown')}><X size={18}/>不认识</button><button disabled={pending||!revealed} onClick={()=>void rate('unsure')}>模糊</button><button disabled={pending||!revealed} onClick={()=>void rate('known')}><Check size={18}/>认识</button></div><button className="text-button skip-quiz" onClick={startQuiz}>进入练习</button></>
   :currentQuestion?<><section className="flashcard quiz-card"><div className="question-type">{currentQuestion.type==='meaning'?<><BookOpen size={16}/>选释义</>:currentQuestion.type==='spelling'?<><Keyboard size={16}/>补全单词</>:<><Headphones size={16}/>听音选词</>}</div>
    {currentQuestion.type==='listening'?<button className="listen-big" aria-label="重新播放题目发音" onClick={()=>{void unlockAudio().then(()=>play(currentQuestion.word.english,true)).catch(()=>setSoundBlocked(true))}}><Volume2 size={42}/></button>:<h2>{currentQuestion.type==='meaning'?currentQuestion.word.english:currentQuestion.word.meaning}</h2>}
    {currentQuestion.type==='spelling'?<><p className="spelling-mask" aria-label="待补全单词">{currentQuestion.spelling.masked}</p><input key={index} className="spelling-input" aria-label="补全缺失字母" placeholder="缺失的字母" autoComplete="off" autoCapitalize="none" spellCheck={false} value={answer} disabled={feedback!==null} maxLength={currentQuestion.spelling.missing.length} onChange={e=>setAnswer(e.target.value.replace(/[^a-z]/gi,''))} onKeyDown={e=>{if(e.key==='Enter'&&canSubmit){if(feedback===null)checkAnswer();else void nextQuestion()}}}/></>:<div className="quiz-options">{currentQuestion.options.map(w=>{const value=currentQuestion.type==='meaning'?w.meaning:w.english;return <button key={w.id} disabled={feedback!==null||listeningMissing} onClick={()=>setAnswer(value)} className={(answer===value?'selected ':'')+(feedback!==null&&w.id===currentQuestion.word.id?'correct':'')}>{value}</button>})}</div>}
    {feedback!==null&&<div className={'answer-feedback '+(feedback?'right':'wrong')}>{feedback?'正确':`正确答案：${currentQuestion.type==='meaning'?currentQuestion.word.meaning:currentQuestion.word.english}`}</div>}
   </section><button className="btn primary quiz-next" disabled={!canSubmit||pending} onClick={()=>{if(feedback===null)checkAnswer();else void nextQuestion()}}>{pending?'正在保存…':feedback===null?'确认':index+1===questions.length?'完成':'下一题'}</button></>:null}</>}
  </div>;
 }
 const tasks=d.tasks.filter(t=>t.classId===student.classId);
 return <div className="student-content clean-learning">
  {!studentOnly&&<div className="student-preview-notice"><select aria-label="选择预览学生" value={studentId} onChange={e=>{stopAudio();setStudent(e.target.value)}}>{d.students.map(s=><option key={s.id} value={s.id}>{s.name} · {s.number}</option>)}</select></div>}
  <h1 className="student-page-title">学习</h1><div className="student-task-list">{tasks.map(t=>{const progress=d.learning.find(l=>l.taskId===t.id&&l.studentId===studentId);const all=JSON.parse(t.wordSnapshot) as Word[];const learned=learnedWordIds(all,progress);const notStarted=new Date(t.startAt)>new Date();return <article className="student-task" key={t.id}><div className="student-task-main"><div><h3>{t.name}</h3><p>{all.length} 个单词 · {date(t.deadline,true)} 截止</p></div></div><div className="student-task-bottom"><div className="table-progress"><span>{learned.size} / {all.length}</span><div className="progress-track"><i style={{width:percent(learned.size,all.length)+'%'}}/></div></div><button className="btn primary" disabled={notStarted} onClick={()=>open(t)}>{notStarted?'未开始':progress?.firstCompletedAt?'复习':learned.size?'继续':'开始'}</button></div></article>})}{!tasks.length&&<Empty text="暂无任务"/>}</div>
 </div>;
}
