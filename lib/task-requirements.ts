import type { Task,Workspace } from './types';
import { taskBatch } from './batch-plan';
import { fixedAssignedTasks } from './fixed-word-order';
export function taskRequirements(tasks:Task[]){
 const result=new Map<string,{id:string;classId:string;choice:boolean;options:Map<string,Task[]>}>();
 for(const task of fixedAssignedTasks(tasks).filter(t=>t.status!=='deleted')){
  const batch=taskBatch(task.rulesSnapshot),choice=!!batch?.choiceGroupId;
  const day=new Date(Date.parse(task.startAt)+8*3600000).toISOString().slice(0,10);
  const id=choice?`${task.classId}:${batch!.choiceGroupId}:${day}`:task.id;
  const group=result.get(id)||{id,classId:task.classId,choice,options:new Map<string,Task[]>()};
  const key=choice?batch!.optionId||task.bookId:task.id,option=group.options.get(key)||[];
  option.push(task);group.options.set(key,option);result.set(id,group);
 }
 return [...result.values()];
}
export function requirementComplete(data:Workspace,studentId:string,group:ReturnType<typeof taskRequirements>[number]){
 return [...group.options.values()].some(tasks=>tasks.length>0&&tasks.every(task=>data.learning.some(l=>l.studentId===studentId&&l.taskId===task.id&&!!l.firstCompletedAt)));
}
export function studentRequirements(data:Workspace,tasks:Task[],studentId:string){
 const groups=taskRequirements(tasks);return {total:groups.length,completed:groups.filter(group=>requirementComplete(data,studentId,group)).length};
}
export function workspaceRequirements(data:Workspace){
 let total=0,completed=0;for(const group of taskRequirements(data.tasks))for(const student of data.students.filter(s=>s.classId===group.classId)){total++;if(requirementComplete(data,student.id,group))completed++}
 return {total,completed};
}
