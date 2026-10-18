import type { Workspace,Word } from './types';
import { learnedWordIds } from './learning';
import { normalizePronunciationTerm } from './pronunciation';
import { taskBatch } from './batch-plan';
export function studentWordBatches(data:Workspace,preferences:Record<string,string>={}){
 const entries=new Map<string,{word:Word;learned:boolean;batchId:string;createdAt:string;label:string}>();
 const tasks=[...data.tasks].sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));
 const options=new Map<string,Set<string>>(),learnedTerms=new Set<string>();
 for(const task of tasks){const batch=taskBatch(task.rulesSnapshot);if(batch?.choiceGroupId){const ids=options.get(batch.choiceGroupId)||new Set<string>();ids.add(batch.optionId||task.bookId);options.set(batch.choiceGroupId,ids)}const words=JSON.parse(task.wordSnapshot) as Word[];const learned=learnedWordIds(words,data.learning.find(l=>l.taskId===task.id&&data.students.some(s=>s.id===l.studentId)));for(const word of words)if(learned.has(word.id))learnedTerms.add(normalizePronunciationTerm(word.english))}
 // Keep the first assigned batch; later reviews update status without duplicating vocabulary.
 for(const task of tasks){
  const batch=taskBatch(task.rulesSnapshot);if(batch?.choiceGroupId){const ids=options.get(batch.choiceGroupId)!;const chosen=ids.has(preferences[batch.choiceGroupId])?preferences[batch.choiceGroupId]:[...ids][0];if((batch.optionId||task.bookId)!==chosen)continue}
  const words=JSON.parse(task.wordSnapshot) as Word[];
  const learned=learnedWordIds(words,data.learning.find(l=>l.taskId===task.id&&data.students.some(s=>s.id===l.studentId)));
  for(const word of words){
   if(task.status==='deleted'&&!learned.has(word.id))continue;
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
