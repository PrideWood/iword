import type { Workspace } from './types';
import { fixedAssignedTasks } from './fixed-word-order';
export type StudyPage='learn'|'review'|'all';
export function studentPageTasks(data:Workspace,studentId:string,page:StudyPage,order:'newest'|'oldest'='oldest'){
 const student=data.students.find(s=>s.id===studentId);
 const completion=(id:string)=>data.learning.find(l=>l.taskId===id&&l.studentId===studentId)?.firstCompletedAt;
 return fixedAssignedTasks(data.tasks).filter(t=>t.classId===student?.classId&&t.status!=='deleted'&&(page==='all'||(page==='review'?!!completion(t.id):!completion(t.id)))).sort((a,b)=>{
  const left=page==='review'?completion(a.id)!:a.startAt,right=page==='review'?completion(b.id)!:b.startAt;
  return (order==='newest'?-1:1)*(left.localeCompare(right)||a.id.localeCompare(b.id,undefined,{numeric:true}));
 });
}
