import type { Workspace,Word } from './types';
import { learnedWordIds } from './learning';
import { normalizePronunciationTerm } from './pronunciation';
import { taskBatch } from './batch-plan';
import { fixedAssignedTasks } from './fixed-word-order';
export function studentWordBatches(data:Workspace){
 const entries=new Map<string,{word:Word;learned:boolean;batchId:string;createdAt:string;label:string}>();
 const tasks=[...data.tasks].sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));
 const learnedTerms=new Set<string>();
 for(const task of tasks){const words=JSON.parse(task.wordSnapshot) as Word[];const learned=learnedWordIds(words,data.learning.find(l=>l.taskId===task.id&&data.students.some(s=>s.id===l.studentId)));for(const word of words)if(learned.has(word.id))learnedTerms.add(normalizePronunciationTerm(word.english))}
 // Keep the first assigned batch; later reviews update status without duplicating vocabulary.
 const assigned=new Set(fixedAssignedTasks(tasks).map(task=>task.id));
 for(const task of tasks){
  const batch=taskBatch(task.rulesSnapshot);
  const words=JSON.parse(task.wordSnapshot) as Word[];
  const learned=learnedWordIds(words,data.learning.find(l=>l.taskId===task.id&&data.students.some(s=>s.id===l.studentId)));
  for(const word of words){
   if((task.status==='deleted'||!assigned.has(task.id))&&!learned.has(word.id))continue;
   const key=normalizePronunciationTerm(word.english),prior=entries.get(key),isLearned=learned.has(word.id)||learnedTerms.has(key);
   if(prior)prior.learned ||= isLearned;
   else {const day=new Date(Date.parse(task.startAt)+8*3600000).toISOString().slice(0,10);entries.set(key,{word,learned:isLearned,batchId:task.id,createdAt:task.createdAt,label:batch?`${day}${batch.optionName?' · '+batch.optionName:''} · 第${batch.index}批`:wordBatchLabel(task.createdAt)})}
  }
 }
 return [...entries.values()];
}
export function wordBatchLabel(createdAt:string){
 return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date(createdAt));
}
