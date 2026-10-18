import assert from 'node:assert/strict';
import { configurePlaybackSession } from '../lib/audio-session';
import { canStartTask } from '../lib/task-availability';
import { aggregateStudyStats,type StudyEvent } from '../lib/study-stats';
import type { Task } from '../lib/types';
const original=Object.getOwnPropertyDescriptor(globalThis,'navigator');
try{
 Object.defineProperty(globalThis,'navigator',{value:{},configurable:true});assert.equal(configurePlaybackSession(),false);
 const session={type:'auto'};Object.defineProperty(globalThis,'navigator',{value:{audioSession:session},configurable:true});assert.equal(configurePlaybackSession(),true);assert.equal(session.type,'playback');
 Object.defineProperty(globalThis,'navigator',{value:{audioSession:{set type(_:string){throw Error('unsupported')}}},configurable:true});assert.equal(configurePlaybackSession(),false);
}finally{if(original)Object.defineProperty(globalThis,'navigator',original);else Reflect.deleteProperty(globalThis,'navigator')}
const task={status:'published',startAt:'2099-01-01T00:00:00Z',rulesSnapshot:'{}'} as Task;
assert.equal(canStartTask(task),false);assert.equal(canStartTask({...task,rulesSnapshot:JSON.stringify({batch:{index:1}})}),true);assert.equal(canStartTask({...task,status:'deleted',rulesSnapshot:'{"batch":{}}'}),false);
const event=(id:string,review:boolean,mastered?:boolean):StudyEvent=>({id,day:'2026-10-18',kind:review?'review':'word',terms:JSON.stringify([{term:'Network',mastered,review}]),activeSeconds:0,createdAt:`2026-10-18T01:00:0${id}.000Z`});
const stats=aggregateStudyStats({words:[],seconds:0},[event('1',false,true),event('2',true),event('3',true)],'2026-10-18','2026-10-18');
assert.equal(stats.today.newWords,1);assert.equal(stats.today.reviewWords,1);assert.equal(stats.totals.masteredWords,1,'listening review must not change mastery');
console.log('通过：Safari播放会话/不支持及异常降级、未来批次可提前/普通任务仍受限/已删除拒绝、同日新词与复习去重及掌握状态保留。');
