import { NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/db';
import * as s from '@/db/schema';
import { currentAccount } from '@/lib/session';
import { accessibleWorkspace, canMutate } from '@/lib/access';
import { isSameOrigin } from '@/lib/request-security';
import type { Word } from '@/lib/types';
export const dynamic='force-dynamic';
export const runtime='nodejs';
const wordInput=z.object({english:z.string().trim().min(1).max(80),phonetic:z.string().max(120).default(''),pos:z.string().max(20).default(''),meaning:z.string().trim().min(1).max(300),example:z.string().max(500).default('')});
export async function GET(){const account=await currentAccount();if(!account)return NextResponse.json({error:'请先登录'},{status:401});try{return NextResponse.json(await accessibleWorkspace(account),{headers:{'Cache-Control':'private, no-store'}});}catch{return NextResponse.json({error:'数据暂时无法加载，请稍后重试'},{status:503});}}
export async function POST(req:Request){
 const account=await currentAccount();if(!account)return NextResponse.json({error:'请先登录'},{status:401});const owner=account.workspaceId;
 if(!isSameOrigin(req))return NextResponse.json({error:'请求来源无效'},{status:403});
 try{
 const body=z.object({action:z.string(),id:z.string().default(''),bookId:z.string().default('')}).passthrough().parse(await req.json());const data=await accessibleWorkspace(account);if(!canMutate(account,body,data))return NextResponse.json({error:'无权操作该资源'},{status:403});const db=getDb();const now=new Date().toISOString();
 if(body.action==='class'){
 const v=z.object({name:z.string().trim().min(1).max(60),major:z.string().max(80)}).parse(body);
 await db.insert(s.classrooms).values({id:crypto.randomUUID(),ownerId:owner,createdAt:now,...v});
 }else if(body.action==='student'){
 const v=z.object({classId:z.string(),name:z.string().trim().min(1).max(40),number:z.string().trim().min(1).max(40)}).parse(body);
 if(!data.classes.some(c=>c.id===v.classId))throw Error('班级不存在');
 if(body.id){if(!data.students.some(t=>t.id===body.id))throw Error('学生不存在');await db.transaction(async tx=>{await tx.update(s.students).set(v).where(and(eq(s.students.id,body.id),eq(s.students.ownerId,owner)));const student=data.students.find(t=>t.id===body.id);if(student?.userId)await tx.update(s.users).set({name:v.name}).where(and(eq(s.users.id,student.userId),eq(s.users.workspaceId,owner),eq(s.users.role,'student')));});}else await db.insert(s.students).values({id:crypto.randomUUID(),ownerId:owner,userId:null,...v});
 }else if(body.action==='book'){
 const v=z.object({name:z.string().trim().min(1).max(100),description:z.string().max(200).default('')}).parse(body);
 await db.insert(s.wordbooks).values({id:crypto.randomUUID(),ownerId:owner,color:'green',...v});
 }else if(body.action==='words'){
 if(!data.books.some(b=>b.id===body.bookId))throw Error('词库不存在');
 const items=z.array(wordInput).min(1).max(500).parse(body.words);
 const existing=new Set(data.words.filter(w=>w.bookId===body.bookId).map(w=>w.english.toLowerCase()));
 if(items.some(w=>existing.has(w.english.toLowerCase()))||new Set(items.map(w=>w.english.toLowerCase())).size!==items.length)throw Error('词库中有重复单词，请检查后导入');
 await db.insert(s.words).values(items.map(w=>({id:crypto.randomUUID(),bookId:body.bookId,...w})));
 }else if(body.action==='deleteWord'){
 const word=data.words.find(w=>w.id===body.id);if(!word)throw Error('单词不存在');await db.delete(s.words).where(eq(s.words.id,word.id));
 }else if(body.action==='task'){
 const v=z.object({name:z.string().trim().min(1).max(100),bookId:z.string(),classId:z.string(),startAt:z.string().datetime(),deadline:z.string().datetime(),types:z.array(z.enum(['meaning','spelling','listening'])).min(1),passing:z.number().int().min(0).max(100),repeat:z.boolean()}).parse(body);
 if(!data.books.some(b=>b.id===v.bookId)||!data.classes.some(c=>c.id===v.classId))throw Error('班级或词库不存在');
 const snapshot=data.words.filter(w=>w.bookId===v.bookId);if(!snapshot.length)throw Error('请先为词库添加单词');if(v.deadline<=v.startAt)throw Error('截止时间必须晚于开始时间');
 await db.insert(s.tasks).values({id:crypto.randomUUID(),ownerId:owner,name:v.name,bookId:v.bookId,classId:v.classId,startAt:v.startAt,deadline:v.deadline,status:'published',wordSnapshot:JSON.stringify(snapshot),rulesSnapshot:JSON.stringify({types:v.types,passing:v.passing,repeat:v.repeat}),createdAt:now});
 }else if(body.action==='progress'){
 const v=z.object({taskId:z.string(),studentId:z.string(),position:z.number().int().min(0),wordId:z.string(),rating:z.enum(['known','unsure','unknown']),eventId:z.string().uuid()}).parse(body);
 const task=data.tasks.find(t=>t.id===v.taskId);if(!task||!data.students.some(t=>t.id===v.studentId&&t.classId===task.classId))throw Error('任务不可用');
 if(now<task.startAt)throw Error('任务尚未开始');
 const words:Word[]=JSON.parse(task.wordSnapshot);if(!words.some(w=>w.id===v.wordId)||v.position>words.length)throw Error('学习进度无效');
 const old=data.learning.find(l=>l.taskId===v.taskId&&l.studentId===v.studentId);const ratings=JSON.parse(old?.ratings??'{}');ratings[v.wordId]=v.rating;
 if(old)await db.update(s.learning).set({ratings:JSON.stringify(ratings),position:Math.max(old.position,v.position),lastSeenAt:now}).where(eq(s.learning.id,old.id));
 else await db.insert(s.learning).values({id:crypto.randomUUID(),ownerId:owner,taskId:v.taskId,studentId:v.studentId,position:v.position,ratings:JSON.stringify(ratings),activeSeconds:0,startedAt:now,lastSeenAt:now}).onConflictDoNothing();
 }else if(body.action==='attempt'){
 const v=z.object({id:z.string().uuid(),taskId:z.string(),studentId:z.string(),answers:z.array(z.object({wordId:z.string(),type:z.enum(['meaning','spelling','listening']),answer:z.string().max(300)})).min(1)}).parse(body);
 const task=data.tasks.find(t=>t.id===v.taskId);if(!task||!data.students.some(t=>t.id===v.studentId&&t.classId===task.classId))throw Error('任务不可用');if(now<task.startAt)throw Error('任务尚未开始');
 const words:Word[]=JSON.parse(task.wordSnapshot);const rules=JSON.parse(task.rulesSnapshot);const expected=words.flatMap(w=>rules.types.map((type:string)=>({wordId:w.id,type})));
 if(v.answers.length!==expected.length||expected.some(e=>v.answers.filter(a=>a.wordId===e.wordId&&a.type===e.type).length!==1))throw Error('尚未完成全部必答题');
 const prior=data.attempts.filter(a=>a.taskId===v.taskId&&a.studentId===v.studentId);if(prior.length&&!rules.repeat)throw Error('此任务不允许重复测评');
 const answers=v.answers.map(a=>{const word=words.find(w=>w.id===a.wordId)!;return {...a,prompt:a.type==='meaning'?word.english:word.meaning,correctAnswer:a.type==='meaning'?word.meaning:word.english,correct:a.answer.trim().toLowerCase()===(a.type==='meaning'?word.meaning:word.english).trim().toLowerCase()}});
 await db.insert(s.attempts).values({id:v.id,ownerId:owner,taskId:v.taskId,studentId:v.studentId,answers:JSON.stringify(answers),correct:answers.filter(a=>a.correct).length,total:answers.length,completedAt:now,practice:prior.length?1:0}).onConflictDoNothing();
 const record=data.learning.find(l=>l.taskId===v.taskId&&l.studentId===v.studentId);
 if(record){await db.update(s.learning).set({firstCompletedAt:record.firstCompletedAt??now,lastSeenAt:now}).where(eq(s.learning.id,record.id));}
 else await db.insert(s.learning).values({id:crypto.randomUUID(),ownerId:owner,taskId:v.taskId,studentId:v.studentId,position:0,ratings:'{}',activeSeconds:0,startedAt:now,lastSeenAt:now,firstCompletedAt:now}).onConflictDoNothing();
 }else if(body.action==='heartbeat'){
 const v=z.object({taskId:z.string(),studentId:z.string()}).parse(body);
 const record=data.learning.find(l=>l.taskId===v.taskId&&l.studentId===v.studentId);if(record&&record.lastSeenAt){const seconds=Math.floor((Date.now()-new Date(record.lastSeenAt).getTime())/1000);if(seconds>=10&&seconds<=35)await db.update(s.learning).set({activeSeconds:record.activeSeconds+Math.min(seconds,20),lastSeenAt:now}).where(and(eq(s.learning.id,record.id),eq(s.learning.lastSeenAt,record.lastSeenAt)));}
 }else throw Error('不支持的操作');
 return NextResponse.json(await accessibleWorkspace(account),{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){return NextResponse.json({error:e instanceof z.ZodError?'请检查填写内容是否完整':'操作失败，请检查资源是否存在、学号是否重复以及任务是否已开始'},{status:400});}
}
