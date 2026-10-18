import type { Task, Word } from './types';
import { fixedAssignedTasks } from './fixed-word-order';
import { studyDay } from './study-stats';
import { normalizePronunciationTerm } from './pronunciation';

export function dailyAudioPlan(tasks:Task[],classId:string,day:string){
 return fixedAssignedTasks(tasks.filter(task=>task.classId===classId&&task.status!=='deleted'))
  .filter(task=>studyDay(task.startAt)===day)
  .sort((a,b)=>a.startAt.localeCompare(b.startAt)||a.id.localeCompare(b.id))
  .map(task=>({id:task.id,terms:[...new Set((JSON.parse(task.wordSnapshot) as Word[]).map(word=>normalizePronunciationTerm(word.english)))]}));
}

// One batch at a time: keep cloud/download concurrency bounded. Foreground lesson
// preparation shares prepareAudio's in-flight promises and the same local cache.
export async function cacheDailyAudio(plan:ReturnType<typeof dailyAudioPlan>,options:{
 cached:(term:string)=>boolean;
 prepare:(id:string,terms:string[],progress:()=>void)=>Promise<{unavailable:string[]}>;
 current:()=>boolean;
 progress:(done:number,total:number)=>void;
 blocked?:Set<string>;
}){
 const terms=[...new Set(plan.flatMap(batch=>batch.terms))],blocked=options.blocked??new Set<string>();
 const update=()=>{if(options.current())options.progress(terms.filter(options.cached).length,terms.length)};
 update();
 for(const batch of plan){
  if(!options.current())break;
  const missing=batch.terms.filter(term=>!blocked.has(term));
  if(!missing.length)continue;
  try{const result=await options.prepare(batch.id,missing,update);result.unavailable.forEach(term=>blocked.add(term))}
  catch{/* Other batches still download; a later pass retries only missing audio. */}
  update();
 }
 return {retry:terms.some(term=>!options.cached(term)&&!blocked.has(term)),blocked:blocked.size};
}
