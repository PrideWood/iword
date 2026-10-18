import type { Task,Word } from './types';
import { taskBatch } from './batch-plan';

// A book has one deterministic order, independent of plan, class and browser.
// Published tasks persist their own snapshots and never reorder on a later edit.
function rank(value:string){
 let n=2166136261;
 for(let i=0;i<value.length;i++)n=Math.imul(n^value.charCodeAt(i),16777619);
 n=Math.imul(n^(n>>>16),0x85ebca6b);n=Math.imul(n^(n>>>13),0xc2b2ae35);
 return (n^(n>>>16))>>>0;
}
export function fixedWordOrder(words:Word[]){
 return [...words].sort((a,b)=>rank(`${a.bookId}:${a.id}`)-rank(`${b.bookId}:${b.id}`)||(a.id<b.id?-1:a.id>b.id?1:0));
}

// Historical dual plans remain readable, but all students now see the same path.
// Prefer the explicitly named shuffled book, otherwise the original primary path.
export function fixedAssignedTasks(tasks:Task[]){
 const choices=new Map<string,Map<string,{shuffled:boolean;primary:boolean}>>();
 for(const task of tasks){const batch=taskBatch(task.rulesSnapshot);if(!batch?.choiceGroupId)continue;
  const key=`${task.classId}:${batch.choiceGroupId}`,options=choices.get(key)||new Map();
  const id=batch.optionId||task.bookId,prior=options.get(id);
  options.set(id,{shuffled:!!prior?.shuffled||!!batch.optionName?.includes('乱序'),primary:!!prior?.primary||!task.id.includes(':alt:')});choices.set(key,options);
 }
 const selected=new Map([...choices].map(([key,options])=>[key,[...options].sort(([a,x],[b,y])=>Number(y.shuffled)-Number(x.shuffled)||Number(y.primary)-Number(x.primary)||(a<b?-1:a>b?1:0))[0][0]]));
 return tasks.filter(task=>{const batch=taskBatch(task.rulesSnapshot);return !batch?.choiceGroupId||(batch.optionId||task.bookId)===selected.get(`${task.classId}:${batch.choiceGroupId}`)});
}
