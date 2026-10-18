import type { Workspace,Word } from './types';
import { learnedWordIds } from './learning';
import { normalizePronunciationTerm } from './pronunciation';
import { taskBatch } from './batch-plan';
export function studentWordBatches(data:Workspace){
 const entries=new Map<string,{word:Word;learned:boolean;batchId:string;createdAt:string;label:string}>();
 // Keep the first assigned batch; later reviews update status without duplicating vocabulary.
 for(const task of [...data.tasks].sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id))){
  const words=JSON.parse(task.wordSnapshot) as Word[];
  const learned=learnedWordIds(words,data.learning.find(l=>l.taskId===task.id&&data.students.some(s=>s.id===l.studentId)));
  for(const word of words){
   if(task.status==='deleted'&&!learned.has(word.id))continue;
   const key=normalizePronunciationTerm(word.english),prior=entries.get(key);
   if(prior)prior.learned ||= learned.has(word.id);
   else {const batch=taskBatch(task.rulesSnapshot),day=new Date(Date.parse(task.startAt)+8*3600000).toISOString().slice(0,10);entries.set(key,{word,learned:learned.has(word.id),batchId:task.id,createdAt:task.createdAt,label:batch?`${day} · 第${batch.index}批`:wordBatchLabel(task.createdAt)})}
  }
 }
 return [...entries.values()];
}
export function wordBatchLabel(createdAt:string){
 return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date(createdAt));
}
