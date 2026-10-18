import type { Workspace,Word } from './types';
import { learnedWordIds } from './learning';
import { normalizePronunciationTerm } from './pronunciation';
export function studentWordBatches(data:Workspace){
 const entries=new Map<string,{word:Word;learned:boolean;batchId:string;createdAt:string}>();
 // Keep the first assigned batch; later reviews update status without duplicating vocabulary.
 for(const task of [...data.tasks].sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id))){
  const words=JSON.parse(task.wordSnapshot) as Word[];
  const learned=learnedWordIds(words,data.learning.find(l=>l.taskId===task.id&&data.students.some(s=>s.id===l.studentId)));
  for(const word of words){
   if(task.status==='deleted'&&!learned.has(word.id))continue;
   const key=normalizePronunciationTerm(word.english),prior=entries.get(key);
   if(prior)prior.learned ||= learned.has(word.id);
   else entries.set(key,{word,learned:learned.has(word.id),batchId:task.id,createdAt:task.createdAt});
  }
 }
 return [...entries.values()];
}
export function wordBatchLabel(createdAt:string){
 return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date(createdAt));
}
