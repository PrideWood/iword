import type { Workspace, Word } from './types';
import { learnedWordIds } from './learning';
import { normalizePronunciationTerm } from './pronunciation';

export type StudyTerm={term:string;mastered?:boolean;review?:boolean};
export type StudyBaseline={words:StudyTerm[];seconds:number};
export type StudyEvent={day:string;kind:string;terms:string;activeSeconds:number;createdAt:string;id:string};
export type StudyDay={day:string;newWords:number;reviewWords:number;seconds:number;checkedIn:boolean};
export type StudyStats={today:StudyDay;days:StudyDay[];totals:{learningDays:number;checkInDays:number;masteredWords:number;seconds:number};trackingSince:string};

export function studyDay(value:Date|string=new Date()){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value));
 const part=(type:string)=>parts.find(p=>p.type===type)!.value;
 return `${part('year')}-${part('month')}-${part('day')}`;
}
export function studyBaseline(data:Workspace,studentId:string):StudyBaseline{
 const words=new Map<string,boolean>();
 const observed=new Map<string,string>();
 const records=data.learning.filter(l=>l.studentId===studentId).toSorted((a,b)=>(a.lastSeenAt||a.startedAt||'').localeCompare(b.lastSeenAt||b.startedAt||''));
 for(const record of records){
  const task=data.tasks.find(t=>t.id===record.taskId);if(!task)continue;
  const snapshot=JSON.parse(task.wordSnapshot) as Word[],learned=learnedWordIds(snapshot,record);
  const ratings=JSON.parse(record.ratings) as Record<string,string>;
  for(const word of snapshot)if(learned.has(word.id)){const term=normalizePronunciationTerm(word.english);words.set(term,ratings[word.id]==='known');observed.set(term,record.lastSeenAt||record.startedAt||'')}
 }
 for(const attempt of data.attempts.filter(a=>a.studentId===studentId).toSorted((a,b)=>a.completedAt.localeCompare(b.completedAt))){
  const task=data.tasks.find(t=>t.id===attempt.taskId);if(!task)continue;
  const answers=JSON.parse(attempt.answers) as {wordId:string;correct:boolean}[];
  for(const word of JSON.parse(task.wordSnapshot) as Word[]){const checks=answers.filter(a=>a.wordId===word.id),term=normalizePronunciationTerm(word.english);if(checks.length&&attempt.completedAt>=(observed.get(term)||'')){words.set(term,checks.every(a=>a.correct));observed.set(term,attempt.completedAt)}}
 }
 return {words:[...words].map(([term,mastered])=>({term,mastered})),seconds:records.reduce((sum,r)=>sum+Math.max(0,r.activeSeconds),0)};
}
export function aggregateStudyStats(baseline:StudyBaseline,events:StudyEvent[],trackingSince:string,today=studyDay()):StudyStats{
 const known=new Map(baseline.words.map(word=>[word.term,{day:'legacy',mastered:word.mastered}]));
 const daily=new Map<string,{newWords:Set<string>;reviewWords:Set<string>;seconds:number;checkedIn:boolean}>();
 const seen=new Set<string>();
 for(const event of events.toSorted((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id))){
  if(seen.has(event.id))continue;seen.add(event.id);
  const day=daily.get(event.day)||{newWords:new Set<string>(),reviewWords:new Set<string>(),seconds:0,checkedIn:false};daily.set(event.day,day);
  const seconds=Math.max(0,event.activeSeconds);
  const midnight=Date.parse(event.day+'T00:00:00+08:00');
  const previousSeconds=Math.max(0,Math.min(seconds,Math.ceil((midnight-Date.parse(event.createdAt)+seconds*1000)/1000)));
  day.seconds+=seconds-previousSeconds;
  if(previousSeconds){const priorDay=studyDay(new Date(midnight-1)),prior=daily.get(priorDay)||{newWords:new Set<string>(),reviewWords:new Set<string>(),seconds:0,checkedIn:false};prior.seconds+=previousSeconds;daily.set(priorDay,prior)}
  if(event.kind==='checkin'||event.kind==='quiz')day.checkedIn=true;
  for(const word of JSON.parse(event.terms) as StudyTerm[]){
   const term=normalizePronunciationTerm(word.term),prior=known.get(term);
   if(!prior)day.newWords.add(term);else if(word.review||prior.day!==event.day)day.reviewWords.add(term);
   known.set(term,{day:prior?.day||event.day,mastered:word.mastered??prior?.mastered??false});
  }
 }
 const days=[...daily].map(([day,value])=>({day,newWords:value.newWords.size,reviewWords:value.reviewWords.size,seconds:value.seconds,checkedIn:value.checkedIn})).filter(d=>d.newWords||d.reviewWords||d.seconds||d.checkedIn).toSorted((a,b)=>a.day.localeCompare(b.day));
 return {today:days.find(d=>d.day===today)||{day:today,newWords:0,reviewWords:0,seconds:0,checkedIn:false},days,trackingSince:studyDay(trackingSince),totals:{learningDays:days.length,checkInDays:days.filter(d=>d.checkedIn).length,masteredWords:[...known.values()].filter(w=>w.mastered).length,seconds:baseline.seconds+days.reduce((n,d)=>n+d.seconds,0)}};
}
export function durationLabel(seconds:number){const minutes=Math.floor(seconds/60);return seconds<60?`${Math.floor(seconds)} 秒`:minutes<60?`${minutes} 分钟`:`${Math.floor(minutes/60)} 小时 ${minutes%60} 分钟`}
export function monthDates(month:string){const [year,m]=month.split('-').map(Number);return Array.from({length:new Date(Date.UTC(year,m,0)).getUTCDate()},(_,i)=>`${month}-${String(i+1).padStart(2,'0')}`)}
