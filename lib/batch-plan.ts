import type { Word } from './types';
export const MAX_IMPORT_WORDS=5000;
export function batchTaskName(name:string,option:string|undefined,day:string,index:number){const suffix=` · ${day} · 第${index}批`,prefix=option?`${name} · ${option}`:name;return prefix.slice(0,100-suffix.length)+suffix}
export type BatchInfo={planId:string;index:number;total:number;day:string;dayIndex:number;batchesPerDay:number;dayBatches:number;choiceGroupId?:string;optionId?:string;optionName?:string};
export function taskBatch(rules:string):BatchInfo|undefined{return JSON.parse(rules).batch}
export function makeBatchPlan(words:Word[],options:{planId:string;startAt:string;batchSize:number;batchesPerDay:number;dailyDeadline:string}){
 const {batchSize,batchesPerDay,startAt,planId,dailyDeadline}=options;
 if(!Number.isInteger(batchSize)||batchSize<1||batchSize>10||!Number.isInteger(batchesPerDay)||batchesPerDay<1||batchesPerDay>50)throw Error('每批 1–10 词，每天 1–50 批');
 if(!words.length||words.length>MAX_IMPORT_WORDS)throw Error(`词库需包含 1–${MAX_IMPORT_WORDS} 词`);
 if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(dailyDeadline)||!Number.isFinite(Date.parse(startAt)))throw Error('排期时间无效');
 const total=Math.ceil(words.length/batchSize);
 return Array.from({length:total},(_,index)=>{
  const dayIndex=Math.floor(index/batchesPerDay),start=new Date(Date.parse(startAt)+dayIndex*86400000).toISOString();
  const day=new Date(Date.parse(start)+8*3600000).toISOString().slice(0,10);
  const deadline=new Date(`${day}T${dailyDeadline}:00+08:00`).toISOString();
  if(deadline<=start)throw Error('每日截止时间必须晚于开始时间');
  return {id:`${planId}:${index+1}`,words:words.slice(index*batchSize,(index+1)*batchSize),startAt:start,deadline,batch:{planId,index:index+1,total,day,dayIndex,batchesPerDay,dayBatches:Math.min(batchesPerDay,total-dayIndex*batchesPerDay)} satisfies BatchInfo};
 });
}
