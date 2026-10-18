import assert from 'node:assert/strict';
import { dailyAudioPlan,cacheDailyAudio } from '../lib/daily-audio';
import type { Task } from '../lib/types';
const task=(id:string,terms:string[],extra:Partial<Task>={}):Task=>({id,ownerId:'teacher',name:id,bookId:'book',classId:'class',startAt:'2026-10-18T02:00:00Z',deadline:'2026-10-19T00:00:00Z',status:'active',wordSnapshot:JSON.stringify(terms.map(english=>({english}))),rulesSnapshot:'{}',createdAt:'2026-10-18T00:00:00Z',...extra});
const tasks=[task('today',['Network','connect','network']),task('today-completed',['device']),task('today-two',['connect','digital']),task('past',['past'],{startAt:'2026-10-17T15:59:59Z'}),task('future',['future'],{startAt:'2026-10-18T16:00:00Z'}),task('other',['other'],{classId:'other'}),task('deleted',['deleted'],{status:'deleted'})];
const plan=dailyAudioPlan(tasks,'class','2026-10-18');
assert.deepEqual(plan.map(x=>x.id),['today','today-completed','today-two']);
assert.deepEqual(plan[0].terms,['network','connect']);
const cached=new Set(['network']),blocked=new Set<string>(),requests:string[]=[];
let fail=true,last={done:0,total:0};
const options={cached:(term:string)=>cached.has(term),current:()=>true,blocked,progress:(done:number,total:number)=>{last={done,total}},prepare:async(id:string,terms:string[],progress:()=>void)=>{
 for(const term of terms){if(cached.has(term))continue;requests.push(term);if(term==='connect'&&fail)throw Error('offline');cached.add(term);progress()}
 return {unavailable:[]};
}};
assert.equal((await cacheDailyAudio(plan,options)).retry,true);
assert.ok(cached.has('device'),'one failure must not stop other batches');
fail=false;assert.equal((await cacheDailyAudio(plan,options)).retry,false);
assert.deepEqual(last,{done:4,total:4},'progress counts unique words, not repeated batch memberships');
assert.equal(requests.filter(term=>term==='device').length,1,'retry reuses cached audio');
await cacheDailyAudio(plan,options);assert.equal(last.done,4);
const denied=[{id:'denied',terms:['no-credit']}];let deniedCalls=0;
const deniedOptions={...options,prepare:async()=>{deniedCalls++;return {unavailable:['no-credit']}}};
assert.equal((await cacheDailyAudio(denied,deniedOptions)).retry,false);
await cacheDailyAudio(denied,deniedOptions);assert.equal(deniedCalls,1,'do not repeatedly try paid generation after a balance denial');
let cancelledCalls=0;await cacheDailyAudio(plan,{...options,current:()=>false,prepare:async()=>{cancelledCalls++;return {unavailable:[]}}});assert.equal(cancelledCalls,0);
console.log('全天音频缓存测试通过：北京时间、班级隔离、所有当天批次、去重、失败重试、余额不足及取消。');
