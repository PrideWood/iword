import { NextResponse } from 'next/server';
import { eq, and,sql } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { getDb } from '@/db';
import * as s from '@/db/schema';
import { currentAccount } from '@/lib/session';
import { accessibleWorkspace, canMutate } from '@/lib/access';
import { isSameOrigin } from '@/lib/request-security';
import type { Word } from '@/lib/types';
import { recordStudyEvent } from '@/lib/study-server';
import { optionalStudentNumber } from '@/lib/student-identity';
import { makeBatchPlan,MAX_IMPORT_WORDS,batchTaskName } from '@/lib/batch-plan';
import { fixedWordOrder } from '@/lib/fixed-word-order';
export const dynamic='force-dynamic';
export const runtime='nodejs';
const wordInput=z.object({english:z.string().trim().min(1).max(80),phonetic:z.string().max(120).default(''),pos:z.string().max(20).default(''),meaning:z.string().trim().min(1).max(300),example:z.string().max(500).default('')});
class WorkspaceError extends Error{}
export async function GET(){const account=await currentAccount();if(!account)return NextResponse.json({error:'请先登录'},{status:401});try{return NextResponse.json(await accessibleWorkspace(account),{headers:{'Cache-Control':'private, no-store'}});}catch{return NextResponse.json({error:'数据暂时无法加载，请稍后重试'},{status:503});}}
export async function POST(req:Request){
 const account=await currentAccount();if(!account)return NextResponse.json({error:'请先登录'},{status:401});const owner=account.workspaceId;
 if(!isSameOrigin(req))return NextResponse.json({error:'请求来源无效'},{status:403});
 try{
 const body=z.object({action:z.string(),id:z.string().default(''),bookId:z.string().default('')}).passthrough().parse(await req.json());const data=await accessibleWorkspace(account);if(!canMutate(account,body,data))return NextResponse.json({error:'无权操作该资源'},{status:403});const db=getDb();const now=new Date().toISOString();
 if(body.action==='class'){
 const v=z.object({name:z.string().trim().min(1).max(60),major:z.string().max(80)}).parse(body);
 if(body.id){if(!data.classes.some(c=>c.id===body.id))throw new WorkspaceError('班级不存在');await db.update(s.classrooms).set(v).where(and(eq(s.classrooms.id,body.id),eq(s.classrooms.ownerId,owner)));}
 else await db.insert(s.classrooms).values({id:crypto.randomUUID(),ownerId:owner,createdAt:now,...v});
 }else if(body.action==='student'){
 const v=z.object({classId:z.string(),name:z.string().trim().min(1).max(40),number:optionalStudentNumber}).parse(body);
 if(!data.classes.some(c=>c.id===v.classId))throw Error('班级不存在');
 if(body.id){if(!data.students.some(t=>t.id===body.id))throw Error('学生不存在');await db.transaction(async tx=>{await tx.update(s.students).set(v).where(and(eq(s.students.id,body.id),eq(s.students.ownerId,owner)));const student=data.students.find(t=>t.id===body.id);if(student?.userId)await tx.update(s.users).set({name:v.name}).where(and(eq(s.users.id,student.userId),eq(s.users.workspaceId,owner),eq(s.users.role,'student')));});}else await db.insert(s.students).values({id:crypto.randomUUID(),ownerId:owner,userId:null,...v});
 }else if(body.action==='book'){
 const v=z.object({name:z.string().trim().min(1).max(100),description:z.string().max(200).default('')}).parse(body);
 if(body.id){if(!data.books.some(b=>b.id===body.id))throw new WorkspaceError('词库不存在');await db.update(s.wordbooks).set(v).where(and(eq(s.wordbooks.id,body.id),eq(s.wordbooks.ownerId,owner)));}
 else await db.insert(s.wordbooks).values({id:crypto.randomUUID(),ownerId:owner,color:'green',...v});
 }else if(body.action==='deleteBook'){
 if(!data.books.some(book=>book.id===body.id))throw new WorkspaceError('词库不存在或已删除');
 // Keep the row and vocabulary: tasks reference this book and own immutable snapshots.
 await db.update(s.wordbooks).set({deleted:true}).where(and(eq(s.wordbooks.id,body.id),eq(s.wordbooks.ownerId,owner)));
 }else if(body.action==='word'){
 const v=wordInput.parse(body);const old=data.words.find(w=>w.id===body.id);if(!old)throw new WorkspaceError('单词不存在');
 if(data.words.some(w=>w.bookId===old.bookId&&w.id!==old.id&&w.english.toLowerCase()===v.english.toLowerCase()))throw new WorkspaceError('词库中已有同名单词');
 await db.update(s.words).set(v).where(and(eq(s.words.id,old.id),eq(s.words.bookId,old.bookId)));
 }else if(body.action==='words'){
 if(!data.books.some(b=>b.id===body.bookId))throw Error('词库不存在');
 const items=z.array(wordInput).min(1).max(MAX_IMPORT_WORDS).parse(body.words);
 await db.transaction(async tx=>{
  const [book]=await tx.select().from(s.wordbooks).where(and(eq(s.wordbooks.id,body.bookId),eq(s.wordbooks.ownerId,owner))).for('update');
  if(!book||book.deleted)throw new WorkspaceError('词库不存在或已删除');
  const old=await tx.select().from(s.words).where(eq(s.words.bookId,body.bookId));
  const existing=new Set(old.map(w=>w.english.toLowerCase()));
  if(items.some(w=>existing.has(w.english.toLowerCase()))||new Set(items.map(w=>w.english.toLowerCase())).size!==items.length)throw new WorkspaceError('词库中有重复单词，请检查后导入');
  const offset=Math.max(0,...old.map(w=>w.sortOrder));
  for(let i=0;i<items.length;i+=500)await tx.insert(s.words).values(items.slice(i,i+500).map((w,j)=>({id:crypto.randomUUID(),bookId:body.bookId,...w,sortOrder:offset+i+j+1})));
 });
 }else if(body.action==='batchPlan'){
 if(body.alternativeBookId)throw new WorkspaceError('已取消备选词库，请刷新页面后发布单一词库任务');
 const v=z.object({planId:z.string().uuid(),name:z.string().trim().min(1).max(80),bookId:z.string(),classId:z.string(),startAt:z.string().datetime(),dailyDeadline:z.string(),batchSize:z.number().int().min(1).max(10),batchesPerDay:z.number().int().min(1).max(50),types:z.array(z.enum(['meaning','spelling','listening'])).min(1).refine(t=>new Set(t).size===t.length),passing:z.number().int().min(0).max(100),repeat:z.boolean()}).parse(body);
 if(!data.books.some(b=>b.id===v.bookId)||!data.classes.some(c=>c.id===v.classId))throw new WorkspaceError('班级或词库不存在');
 const hash=createHash('sha256').update(JSON.stringify(v)).digest('hex');
 await db.transaction(async tx=>{
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${v.planId}))`);
  const [prior]=await tx.select().from(s.tasks).where(eq(s.tasks.id,`${v.planId}:1`));
  if(prior){if(prior.ownerId!==owner||JSON.parse(prior.rulesSnapshot).planHash!==hash)throw new WorkspaceError('该计划已发布，请勿重复提交不同设置');return}
  const [book]=await tx.select().from(s.wordbooks).where(and(eq(s.wordbooks.id,v.bookId),eq(s.wordbooks.ownerId,owner))).for('update');
  if(!book||book.deleted)throw new WorkspaceError('词库不存在或已删除');
  const bookIds=[v.bookId];
  const records=bookIds.flatMap(bookId=>{
   const words=fixedWordOrder(data.words.filter(w=>w.bookId===bookId));
   let plan;try{plan=makeBatchPlan(words,v)}catch(error){throw new WorkspaceError((error as Error).message)}
   return plan.map(part=>({id:part.id,ownerId:owner,name:batchTaskName(v.name,undefined,part.batch.day,part.batch.index),bookId,classId:v.classId,startAt:part.startAt,deadline:part.deadline,status:'published',wordSnapshot:JSON.stringify(part.words),rulesSnapshot:JSON.stringify({types:v.types,passing:v.passing,repeat:v.repeat,batch:part.batch,order:'fixed-shuffled-v1',planHash:hash}),createdAt:now}));
  });
  for(let i=0;i<records.length;i+=100)await tx.insert(s.tasks).values(records.slice(i,i+100));
 });
 }else if(body.action==='deleteWord'){
 const word=data.words.find(w=>w.id===body.id);if(!word)throw Error('单词不存在');await db.delete(s.words).where(eq(s.words.id,word.id));
 }else if(body.action==='deleteTask'){
 const task=data.tasks.find(t=>t.id===body.id);if(!task)throw new WorkspaceError('任务不存在');
 // Never delete the row: learning, attempts and published word snapshots must survive.
 await db.update(s.tasks).set({status:'deleted'}).where(and(eq(s.tasks.id,task.id),eq(s.tasks.ownerId,owner)));
 }else if(body.action==='task'){
 const v=z.object({name:z.string().trim().min(1).max(100),bookId:z.string(),classId:z.string(),startAt:z.string().datetime(),deadline:z.string().datetime(),types:z.array(z.enum(['meaning','spelling','listening'])).min(1).refine(t=>new Set(t).size===t.length),passing:z.number().int().min(0).max(100),repeat:z.boolean(),refreshWords:z.boolean().default(false)}).parse(body);
 const existingTask=data.tasks.find(t=>t.id===body.id);
 if((!data.books.some(b=>b.id===v.bookId)&&!(existingTask?.bookId===v.bookId&&!v.refreshWords))||!data.classes.some(c=>c.id===v.classId))throw Error('班级或词库不存在');
 const snapshot=fixedWordOrder(data.words.filter(w=>w.bookId===v.bookId));if(v.deadline<=v.startAt)throw new WorkspaceError('截止时间必须晚于开始时间');
 const rulesSnapshot=JSON.stringify({types:v.types,passing:v.passing,repeat:v.repeat});
 if(body.id){
  await db.transaction(async tx=>{
   const [old]=await tx.select().from(s.tasks).where(and(eq(s.tasks.id,body.id),eq(s.tasks.ownerId,owner))).for('update');
   if(!old||old.status==='deleted')throw new WorkspaceError('任务不存在或已删除');
   const oldRules=JSON.parse(old.rulesSnapshot),oldTypes=oldRules.types as string[];
   if(oldRules.batch&&(v.refreshWords||old.bookId!==v.bookId))throw new WorkspaceError('批次词表已固定，不能替换为整本词库');
   const structural=v.refreshWords||old.bookId!==v.bookId||old.classId!==v.classId||[...oldTypes].sort().join()!==[...v.types].sort().join();
   if(structural){
    const [learning]=await tx.select({id:s.learning.id}).from(s.learning).where(eq(s.learning.taskId,old.id)).limit(1);
    const [attempt]=await tx.select({id:s.attempts.id}).from(s.attempts).where(eq(s.attempts.taskId,old.id)).limit(1);
    if(new Date(old.startAt).getTime()<=Date.now()||learning||attempt)throw new WorkspaceError('已开始或有学习记录的任务不能更换班级、词表或题型');
   }
   if((v.refreshWords||old.bookId!==v.bookId)&&!snapshot.length)throw new WorkspaceError('词库不能为空');
   await tx.update(s.tasks).set({name:v.name,bookId:v.bookId,classId:v.classId,startAt:v.startAt,deadline:v.deadline,rulesSnapshot:JSON.stringify({...oldRules,types:v.types,passing:v.passing,repeat:v.repeat}),wordSnapshot:v.refreshWords||old.bookId!==v.bookId?JSON.stringify(snapshot):old.wordSnapshot}).where(and(eq(s.tasks.id,old.id),eq(s.tasks.ownerId,owner)));
  });
 }else{
  if(!snapshot.length)throw new WorkspaceError('请先为词库添加单词');
  await db.insert(s.tasks).values({id:crypto.randomUUID(),ownerId:owner,name:v.name,bookId:v.bookId,classId:v.classId,startAt:v.startAt,deadline:v.deadline,status:'published',wordSnapshot:JSON.stringify(snapshot),rulesSnapshot,createdAt:now});
 }
 }else if(body.action==='progress'){
 const v=z.object({taskId:z.string(),studentId:z.string(),position:z.number().int().min(0),wordId:z.string(),rating:z.enum(['known','unsure','unknown']),eventId:z.string().uuid()}).parse(body);
 const task=data.tasks.find(t=>t.id===v.taskId&&t.status!=='deleted');if(!task||!data.students.some(t=>t.id===v.studentId&&t.classId===task.classId))throw Error('任务不可用');
 if(now<task.startAt)throw Error('任务尚未开始');
 const words:Word[]=JSON.parse(task.wordSnapshot);if(!words.some(w=>w.id===v.wordId)||v.position>words.length)throw Error('学习进度无效');
 await recordStudyEvent(data,{studentId:v.studentId,ownerId:owner,taskId:v.taskId,eventKey:v.eventId,kind:'word',terms:[{term:words.find(w=>w.id===v.wordId)!.english,mastered:v.rating==='known'}]},async(tx,seconds)=>{
  const [old]=await tx.select().from(s.learning).where(and(eq(s.learning.taskId,v.taskId),eq(s.learning.studentId,v.studentId)));
  const ratings=JSON.parse(old?.ratings??'{}');ratings[v.wordId]=v.rating;
  if(old)await tx.update(s.learning).set({ratings:JSON.stringify(ratings),position:Math.max(old.position,v.position),activeSeconds:old.activeSeconds+seconds,lastSeenAt:now}).where(eq(s.learning.id,old.id));
  else await tx.insert(s.learning).values({id:crypto.randomUUID(),ownerId:owner,taskId:v.taskId,studentId:v.studentId,position:v.position,ratings:JSON.stringify(ratings),activeSeconds:seconds,startedAt:now,lastSeenAt:now});
 });
 }else if(body.action==='attempt'){
 const v=z.object({id:z.string().uuid(),taskId:z.string(),studentId:z.string(),answers:z.array(z.object({wordId:z.string(),type:z.enum(['meaning','spelling','listening']),answer:z.string().max(300)})).min(1)}).parse(body);
 const task=data.tasks.find(t=>t.id===v.taskId&&t.status!=='deleted');if(!task||!data.students.some(t=>t.id===v.studentId&&t.classId===task.classId))throw Error('任务不可用');if(now<task.startAt)throw Error('任务尚未开始');
 const words:Word[]=JSON.parse(task.wordSnapshot);const rules=JSON.parse(task.rulesSnapshot);const expected=words.flatMap(w=>rules.types.map((type:string)=>({wordId:w.id,type})));
 if(v.answers.length!==expected.length||expected.some(e=>v.answers.filter(a=>a.wordId===e.wordId&&a.type===e.type).length!==1))throw Error('尚未完成全部必答题');
 const prior=data.attempts.filter(a=>a.taskId===v.taskId&&a.studentId===v.studentId);if(prior.some(a=>a.id!==v.id)&&!rules.repeat)throw Error('此任务不允许重复测评');
 const answers=v.answers.map(a=>{const word=words.find(w=>w.id===a.wordId)!;return {...a,prompt:a.type==='meaning'?word.english:word.meaning,correctAnswer:a.type==='meaning'?word.meaning:word.english,correct:a.answer.trim().toLowerCase()===(a.type==='meaning'?word.meaning:word.english).trim().toLowerCase()}});
 await recordStudyEvent(data,{studentId:v.studentId,ownerId:owner,taskId:v.taskId,eventKey:v.id,kind:'quiz',terms:words.map(w=>({term:w.english,mastered:answers.filter(a=>a.wordId===w.id).every(a=>a.correct)}))},async(tx,seconds)=>{
  const current=await tx.select({id:s.attempts.id}).from(s.attempts).where(and(eq(s.attempts.taskId,v.taskId),eq(s.attempts.studentId,v.studentId)));
  if(current.some(a=>a.id!==v.id)&&!rules.repeat)throw Error('此任务不允许重复测评');
  const inserted=await tx.insert(s.attempts).values({id:v.id,ownerId:owner,taskId:v.taskId,studentId:v.studentId,answers:JSON.stringify(answers),correct:answers.filter(a=>a.correct).length,total:answers.length,completedAt:now,practice:current.length?1:0}).onConflictDoNothing().returning({id:s.attempts.id});
  if(!inserted.length&&!current.some(a=>a.id===v.id))throw new WorkspaceError('测评标识冲突，请重新开始练习');
  const [record]=await tx.select().from(s.learning).where(and(eq(s.learning.taskId,v.taskId),eq(s.learning.studentId,v.studentId)));
  if(record)await tx.update(s.learning).set({activeSeconds:record.activeSeconds+seconds,firstCompletedAt:record.firstCompletedAt??now,lastSeenAt:now}).where(eq(s.learning.id,record.id));
  else await tx.insert(s.learning).values({id:crypto.randomUUID(),ownerId:owner,taskId:v.taskId,studentId:v.studentId,position:0,ratings:'{}',activeSeconds:seconds,startedAt:now,lastSeenAt:now,firstCompletedAt:now});
 });
 }else if(body.action==='heartbeat'){
 const v=z.object({taskId:z.string(),studentId:z.string(),eventId:z.string().uuid().optional()}).parse(body);
 if(!data.tasks.some(t=>t.id===v.taskId&&t.status!=='deleted'))throw new WorkspaceError('任务不可用');
 if(data.tasks.some(t=>t.id===v.taskId&&now<t.startAt))throw new WorkspaceError('任务尚未开始');
 if(!data.students.some(student=>student.id===v.studentId&&data.tasks.some(task=>task.id===v.taskId&&task.classId===student.classId)))throw new WorkspaceError('任务不可用');
 await recordStudyEvent(data,{studentId:v.studentId,ownerId:owner,taskId:v.taskId,eventKey:v.eventId||crypto.randomUUID(),kind:'heartbeat'},async(tx,seconds)=>{
  const [record]=await tx.select().from(s.learning).where(and(eq(s.learning.taskId,v.taskId),eq(s.learning.studentId,v.studentId)));
  if(record)await tx.update(s.learning).set({activeSeconds:record.activeSeconds+seconds,lastSeenAt:now}).where(eq(s.learning.id,record.id));
  else await tx.insert(s.learning).values({id:crypto.randomUUID(),ownerId:owner,taskId:v.taskId,studentId:v.studentId,position:0,ratings:'{}',activeSeconds:seconds,startedAt:now,lastSeenAt:now});
 });
 }else throw Error('不支持的操作');
 return NextResponse.json(await accessibleWorkspace(account),{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){return NextResponse.json({error:e instanceof WorkspaceError?e.message:e instanceof z.ZodError?'请检查填写内容是否完整':'操作失败，请检查资源是否存在、学号是否重复以及任务是否已开始'},{status:400});}
}
