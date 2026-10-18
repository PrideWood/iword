import type { Task } from './types';
import { taskBatch } from './batch-plan';
export function canStartTask(task:Task,now=Date.now()){
 return task.status!=='deleted'&&(!!taskBatch(task.rulesSnapshot)||Date.parse(task.startAt)<=now);
}
