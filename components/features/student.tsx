'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Volume2, Check, X, RotateCcw, Headphones, Keyboard, BookOpen, Settings } from 'lucide-react';
import type { Workspace, Task, Word } from '@/lib/types';
import type { Mutate } from '../workspace-app';
import { Empty, Modal, percent } from '../shared';
import { useStudentPreferences } from '@/hooks/use-student-preferences';
import { prepareTaskAudio, playCachedAudio, stopAudio, unlockAudio,AudioRequestError,cachedAudioUrl } from '@/lib/audio-client';
import { normalizePronunciationTerm } from '@/lib/pronunciation';
import { learnedWordIds, makeQuestions, shuffle, type Question, type QuestionType } from '@/lib/learning';
import { StudySaveQueue } from '@/lib/study-save-queue';
import { CORRECT_ANSWER_DELAY,judgeQuizAnswer,quizAnswer,quizOptionState } from '@/lib/quiz-feedback';
import InlineSpelling from '../inline-spelling';
import StudentTaskList from '../student-task-list';

type Answer={wordId:string;type:string;answer:string};
export default function StudentView({data:d,mutate,notify,studentOnly=false,active=true}:{data:Workspace;mutate:Mutate;notify:(s:string)=>void;studentOnly?:boolean;active?:boolean}){
 const [studentId,setStudent]=useState(d.students[2]?.id??d.students[0]?.id??'');
 const student=d.students.find(s=>s.id===studentId);
 const {autoPlay,setAutoPlay,ready:preferencesReady}=useStudentPreferences(studentId);
 const [settingsOpen,setSettingsOpen]=useState(false);
 const [taskId,setTask]=useState<string|null>(null);
 const task=d.tasks.find(t=>t.id===taskId&&t.status!=='deleted');
 const activeTaskId=task?.id;
 const words=useMemo(()=>task?JSON.parse(task.wordSnapshot) as Word[]:[],[task]);
 const [queue,setQueue]=useState<Word[]>([]);
 const [questions,setQuestions]=useState<Question[]>([]);
 const [mode,setMode]=useState<'cards'|'quiz'|'report'>('cards');
 const [index,setIndex]=useState(0),[revealed,setRevealed]=useState(false);
 const [answer,setAnswer]=useState(''),[answers,setAnswers]=useState<Answer[]>([]);
 const [feedback,setFeedback]=useState<boolean|null>(null),[pending,setPending]=useState(false);
 const [submitError,setSubmitError]=useState(false);
 const answeredQuestion=useRef(''),advancedQuestion=useRef('');
 const [roundId,setRoundId]=useState('');
 const [loading,setLoading]=useState(false),[download,setDownload]=useState({done:0,total:0});
 const [loadError,setLoadError]=useState(''),[soundBlocked,setSoundBlocked]=useState(false);
 const [unavailable,setUnavailable]=useState<string[]>([]),[audioError,setAudioError]=useState('');
 const currentWord=mode==='cards'?queue[index]:questions[index]?.word;
 const currentQuestion=questions[index];
 const streak=useMemo(()=>{let n=0;for(let i=answers.length-1;i>=0;i--){const a=answers[i],w=words.find(w=>w.id===a.wordId);if(a.answer.trim().toLowerCase()!==(a.type==='meaning'?w?.meaning:w?.english)?.trim().toLowerCase())break;n++}return feedback===false?0:n+(feedback===true?1:0)},[answers,words,feedback]);
 const requestId=useRef(0),audioId=useRef(0),lastActive=useRef(Date.now()),mutation=useRef(mutate);
 const [saveState,setSaveState]=useState({count:0,failed:false});
 const [saves]=useState(()=>new StudySaveQueue<Record<string,unknown>>(body=>mutation.current(body),(count,failed)=>setSaveState({count,failed})));
 const localLearned=useRef(new Set<string>()),ratedCard=useRef('');
 const heartbeatBusy=useRef(false);
 useEffect(()=>{
  const warn=(event:BeforeUnloadEvent)=>{if(saves.size){event.preventDefault();event.returnValue=''}};
  const guard=(event:MouseEvent)=>{if(saves.size&&event.target instanceof Element&&event.target.closest('a[href]')){event.preventDefault();event.stopPropagation();notify('学习记录尚未保存，请稍候或重试')}};
  window.addEventListener('beforeunload',warn);document.addEventListener('click',guard,true);
  return()=>{window.removeEventListener('beforeunload',warn);document.removeEventListener('click',guard,true)};
 },[saves,notify]);
 useEffect(()=>{mutation.current=mutate},[mutate]);
 useEffect(()=>{const touch=()=>{lastActive.current=Date.now()};window.addEventListener('pointerdown',touch);window.addEventListener('keydown',touch);return()=>{window.removeEventListener('pointerdown',touch);window.removeEventListener('keydown',touch)}},[]);
 useEffect(()=>{
  if(!activeTaskId||mode==='report'||!active||loading||loadError)return;
  const heartbeat=()=>{if(!saves.size&&!heartbeatBusy.current&&document.visibilityState==='visible'&&Date.now()-lastActive.current<30000){heartbeatBusy.current=true;void mutation.current({action:'heartbeat',taskId:activeTaskId,studentId,eventId:crypto.randomUUID()}).finally(()=>{heartbeatBusy.current=false})}};
  heartbeat();const timer=setInterval(heartbeat,20000);return()=>{clearInterval(timer);heartbeat()};
 },[activeTaskId,studentId,mode,active,loading,loadError,saves]);
 const play=useCallback(async(text:string,manual=false)=>{
  const id=++audioId.current;
  if(!manual&&unavailable.includes(normalizePronunciationTerm(text))&&!cachedAudioUrl(text)){setAudioError('此单词暂无发音，请联系教师补充生成额度');return}
  try{await playCachedAudio(text,()=>id===audioId.current);if(id===audioId.current){setSoundBlocked(false);setAudioError('')}}
  catch(error){if(id===audioId.current){if(error instanceof AudioRequestError){setAudioError(error.message);setSoundBlocked(false)}else setSoundBlocked(true)}}
 },[unavailable]);
 useEffect(()=>{
  if(!preferencesReady||!autoPlay||!activeTaskId||!active||loading||loadError||!currentWord||mode==='report'){audioId.current++;stopAudio();return}
  const timer=window.setTimeout(()=>{setAudioError('');if(mode==='cards'||currentQuestion?.type==='listening')void play(currentWord.english)},0);
  return()=>{clearTimeout(timer);audioId.current++;stopAudio()};
 },[preferencesReady,autoPlay,activeTaskId,active,loading,loadError,mode,currentWord,currentQuestion,play]);
 useEffect(()=>()=>{requestId.current++;audioId.current++;stopAudio()},[]);
 async function cacheTask(t:Task){
  const id=++requestId.current;setLoading(true);setLoadError('');setUnavailable([]);setAudioError('');
  const taskWords=JSON.parse(t.wordSnapshot) as Word[];setDownload({done:0,total:taskWords.length});
  try{const result=await prepareTaskAudio(t.id,taskWords.map(w=>w.english),(done,total)=>{if(id===requestId.current)setDownload({done,total})});if(id===requestId.current)setUnavailable(result.unavailable)}
  catch(error){if(id===requestId.current)setLoadError((error as Error).message)}
  finally{if(id===requestId.current)setLoading(false)}
 }
 function open(t:Task){
  if(saves.size){notify('学习记录尚未保存，请稍候或重试');return}
  if(autoPlay)void unlockAudio().catch(()=>{setSoundBlocked(true)});
  const all=JSON.parse(t.wordSnapshot) as Word[];
  const prior=d.learning.find(l=>l.taskId===t.id&&l.studentId===studentId);
  const learned=learnedWordIds(all,prior);
  localLearned.current=new Set(learned);ratedCard.current='';
  const remaining=all.filter(w=>!learned.has(w.id));
  setQueue(shuffle(remaining.length?remaining:all));setTask(t.id);setMode('cards');setIndex(0);setRevealed(false);setQuestions([]);setAnswers([]);setAnswer('');setFeedback(null);
  void cacheTask(t);
 }
 function leave(){if(saves.size){notify('学习记录尚未保存，请稍候或重试');return}requestId.current++;audioId.current++;stopAudio();setTask(null);setLoading(false);setLoadError('')}
 function startQuiz(){
  if(!task)return;if(autoPlay)void unlockAudio().catch(()=>setSoundBlocked(true));
  const rules=JSON.parse(task.rulesSnapshot) as {types:QuestionType[]};
  setQuestions(makeQuestions(words,rules.types));setMode('quiz');setIndex(0);setAnswers([]);setAnswer('');setFeedback(null);setSubmitError(false);setRoundId(crypto.randomUUID());
 }
 function rate(rating:string){
  if(!task||!currentWord||mode!=='cards')return;
  const card=task.id+':'+index;if(ratedCard.current===card)return;ratedCard.current=card;
  localLearned.current.add(currentWord.id);
  saves.enqueue({action:'progress',taskId:task.id,studentId,wordId:currentWord.id,position:localLearned.current.size,rating,eventId:crypto.randomUUID()});
  if(index+1>=queue.length)startQuiz();else{setIndex(index+1);setRevealed(false)}
 }
 const submittedAnswer=()=>currentQuestion?quizAnswer(currentQuestion,answer):answer;
 const listeningMissing=currentQuestion?.type==='listening'&&unavailable.includes(normalizePronunciationTerm(currentQuestion.word.english))&&!cachedAudioUrl(currentQuestion.word.english);
 function chooseAnswer(value:string){
  if(!currentQuestion||feedback!==null||listeningMissing)return;
  const key=roundId+':'+index;if(answeredQuestion.current===key)return;
  setAnswer(value);
  if(currentQuestion.type==='spelling'&&value.length!==currentQuestion.spelling.missing.length)return;
  answeredQuestion.current=key;setSubmitError(false);setFeedback(judgeQuizAnswer(currentQuestion,value));
 }
 async function nextQuestion(){
  if(!currentQuestion||pending||feedback===null)return;
  const key=roundId+':'+index;if(advancedQuestion.current===key)return;advancedQuestion.current=key;
  const updated=[...answers,{wordId:currentQuestion.word.id,type:currentQuestion.type,answer:submittedAnswer()}];
  if(index+1<questions.length){if(autoPlay)void unlockAudio().catch(()=>setSoundBlocked(true));setAnswers(updated);setIndex(index+1);setAnswer('');setFeedback(null)}
  else{setPending(true);setSubmitError(false);if(!await saves.flush()){setPending(false);setSubmitError(true);advancedQuestion.current='';notify('请先重试保存学习记录');return}const ok=await mutation.current({action:'attempt',id:roundId,taskId,studentId,answers:updated});setPending(false);if(ok){setMode('report');setAnswers(updated)}else{setSubmitError(true);advancedQuestion.current=''}}
 }
 const advance=useRef(nextQuestion);useEffect(()=>{advance.current=nextQuestion});
 useEffect(()=>{
  if(mode!=='quiz'||feedback!==true||!active)return;
  let timer:ReturnType<typeof setTimeout>;
  const schedule=()=>{clearTimeout(timer);if(document.visibilityState==='visible')timer=setTimeout(()=>void advance.current(),CORRECT_ANSWER_DELAY)};
  schedule();document.addEventListener('visibilitychange',schedule);
  return()=>{clearTimeout(timer);document.removeEventListener('visibilitychange',schedule)};
 },[mode,feedback,index,roundId,active]);
 if(!student)return <Empty text="暂无学习任务"/>;
 const settingsButton=<button className="icon-btn study-settings" aria-label="学习设置" onClick={()=>setSettingsOpen(true)}><Settings size={21}/></button>;
 const settingsDialog=settingsOpen&&<Modal title="学习设置" onClose={()=>setSettingsOpen(false)}><div className="study-setting-row"><span>自动播放音频</span><button role="switch" aria-label="自动播放音频" aria-checked={autoPlay} disabled={!preferencesReady} className="preference-switch" onClick={()=>{setAutoPlay(!autoPlay);setSoundBlocked(false)}}><span/></button></div></Modal>;
 if(task){
  const title=mode==='cards'?'单词学习':mode==='quiz'?'练习':'完成';
  return <div className="student-content learning-content clean-learning">
   <div className="learning-top"><button className="back-link" onClick={leave}><ArrowLeft size={18}/>任务</button><span>{title}</span>{settingsButton}</div>{settingsDialog}
   <h1 className="student-task-title">{task.name}</h1>
   {saveState.failed&&<div className="study-save-error" role="alert">学习记录未保存（{saveState.count}）<button className="btn secondary" onClick={()=>void saves.retry()}>重试保存</button></div>}
   {!loading&&!loadError&&<div className="learning-stages" aria-label="学习关卡"><span className={mode==='cards'?'current':'complete'}>1 认词{mode!=='cards'&&<Check size={14}/>}</span><i/><span className={mode==='quiz'?'current':mode==='report'?'complete':''}>2 挑战</span><i/><span className={mode==='report'?'current':''}>3 完成</span></div>}
   {loading?<section className="audio-download panel" aria-live="polite"><Headphones size={30}/><h2>下载任务音频</h2><progress value={download.done} max={download.total||1}/><p>{download.done} / {download.total}</p></section>
   :loadError?<section className="audio-download panel"><p role="alert">{loadError}</p><button className="btn primary" onClick={()=>void cacheTask(task)}>重试</button></section>
   :mode==='report'?<section className="completion-card"><h2>练习完成</h2><strong className="result-score">{percent(answers.filter(a=>{const w=words.find(w=>w.id===a.wordId);return a.answer.trim().toLowerCase()===(a.type==='meaning'?w?.meaning:w?.english)?.trim().toLowerCase()}).length,answers.length)}%</strong><div className="button-row"><button className="btn secondary" onClick={leave}>返回任务</button>{JSON.parse(task.rulesSnapshot).repeat&&<button className="btn primary" onClick={startQuiz}><RotateCcw size={16}/>再练一次</button>}</div></section>
   :<><div className="learning-progress"><span>{mode==='cards'?index+1:index+1} / {mode==='cards'?queue.length:questions.length}</span><div className="progress-track"><i style={{width:((index+1)/(mode==='cards'?queue.length:questions.length)*100)+'%'}}/></div></div>
   {audioError&&<p role="status" className="error-box">{audioError}</p>}
   {soundBlocked&&<button className="btn secondary sound-enable" onClick={async()=>{try{await unlockAudio();if(currentWord)await play(currentWord.english,true)}catch{notify('无法开启声音，请检查浏览器设置')}}}><Volume2 size={17}/>开启声音</button>}
   {mode==='cards'&&currentWord?<><section className="flashcard"><button className="pronounce-btn" aria-label={'播放'+currentWord.english} onClick={()=>{void unlockAudio().then(()=>play(currentWord.english,true)).catch(()=>setSoundBlocked(true))}}><Volume2 size={24}/></button><h2>{currentWord.english}</h2><p className="phonetic">{currentWord.phonetic}</p>{revealed?<div className="revealed"><p><small>{currentWord.pos}</small>{currentWord.meaning}</p>{currentWord.example&&<div className="example"><p>{currentWord.example}</p></div>}</div>:<button className="reveal-answer" onClick={()=>setRevealed(true)}>查看释义</button>}</section><div className="rating-buttons"><button onClick={()=>rate('unknown')}><X size={18}/>不认识</button><button onClick={()=>rate('unsure')}>模糊</button><button onClick={()=>rate('known')}><Check size={18}/>认识</button></div><button className="text-button skip-quiz" onClick={startQuiz}>进入练习</button></>
   :currentQuestion?<><section className="flashcard quiz-card"><div className="question-type">{currentQuestion.type==='meaning'?<><BookOpen size={16}/>选释义</>:currentQuestion.type==='spelling'?<><Keyboard size={16}/>补全单词</>:<><Headphones size={16}/>听音选词</>}</div>
    {currentQuestion.type==='listening'?<button className="listen-big" aria-label="重新播放题目发音" onClick={()=>{void unlockAudio().then(()=>play(currentQuestion.word.english,true)).catch(()=>setSoundBlocked(true))}}><Volume2 size={42}/></button>:<h2>{currentQuestion.type==='meaning'?currentQuestion.word.english:currentQuestion.word.meaning}</h2>}
    {currentQuestion.type==='spelling'?<><InlineSpelling key={roundId+':'+index} word={currentQuestion.word.english} prompt={currentQuestion.spelling} feedback={feedback} active={active} onComplete={chooseAnswer}/>{feedback===false&&<p className="spelling-correct-answer">{currentQuestion.word.english}</p>}</>:<div className="quiz-options">{currentQuestion.options.map(w=>{const value=currentQuestion.type==='meaning'?w.meaning:w.english,state=quizOptionState(w.id===currentQuestion.word.id,answer===value,feedback);return <button key={w.id} disabled={feedback!==null||listeningMissing} onClick={()=>chooseAnswer(value)} className={state}>{value}{state==='correct'&&<Check size={18} aria-label="正确答案"/>}{state==='incorrect'&&<X size={18} aria-label="错误答案"/>}</button>})}</div>}
    {feedback!==null&&<div aria-live="polite" className={'answer-feedback '+(feedback?'right':'wrong')}>{feedback?<><Check size={18}/>{streak>=3?`${streak} 连对，继续保持！`:'答对了！'}</>:<>再记一次：{currentQuestion.type==='meaning'?currentQuestion.word.meaning:currentQuestion.word.english}</>}</div>}
   </section>{(feedback===false||submitError)&&<button className="btn primary quiz-next" disabled={pending} onClick={()=>void nextQuestion()}>{pending?'正在保存…':submitError?'重试提交':index+1===questions.length?'完成':'下一题'}</button>}{pending&&feedback===true&&<p role="status" className="quiz-save-status">正在保存…</p>}</>:null}</>}
  </div>;
 }
 const tasks=d.tasks.filter(t=>t.classId===student.classId&&t.status!=='deleted');
 const available=tasks.filter(t=>new Date(t.startAt)<=new Date());
 const finished=available.filter(t=>d.learning.some(l=>l.taskId===t.id&&l.studentId===studentId&&l.firstCompletedAt));
 return <div className="student-content clean-learning">
  {!studentOnly&&<div className="student-preview-notice"><select aria-label="选择预览学生" value={studentId} onChange={e=>{stopAudio();setStudent(e.target.value)}}>{d.students.map(s=><option key={s.id} value={s.id}>{s.name} · {s.number}</option>)}</select></div>}
  <div className="student-page-heading"><h1 className="student-page-title">学习</h1>{settingsButton}</div>{settingsDialog}{available.length>0&&<section className="learning-journey"><span className="journey-icon"><BookOpen size={25}/></span><div><h2>{finished.length===available.length?'全部完成！':'词汇闯关'}</h2><p>{finished.length} / {available.length} 个任务已完成</p></div><strong>{percent(finished.length,available.length)}%</strong></section>}<StudentTaskList data={d} studentId={studentId} onOpen={open}/>
 </div>;
}
