import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { students, studyEvents, studyProfiles } from '@/db/schema';
import type { Workspace } from './types';
import { aggregateStudyStats, studyBaseline, studyDay, type StudyBaseline, type StudyTerm } from './study-stats';

type Db=ReturnType<typeof getDb>;
export type StudyTransaction=Parameters<Parameters<Db['transaction']>[0]>[0];
type Activity={studentId:string;ownerId:string;taskId?:string;eventKey:string;kind:'word'|'quiz'|'heartbeat'|'checkin'|'review';terms?:StudyTerm[]};

async function ensureProfile(tx:StudyTransaction,data:Workspace,studentId:string,ownerId:string){
 await tx.insert(studyProfiles).values({studentId,ownerId,baseline:JSON.stringify(studyBaseline(data,studentId)),startedAt:new Date().toISOString()}).onConflictDoNothing();
 const [profile]=await tx.select().from(studyProfiles).where(and(eq(studyProfiles.studentId,studentId),eq(studyProfiles.ownerId,ownerId)));
 if(!profile)throw Error('学习统计不可用');return profile;
}
export async function recordStudyEvent(data:Workspace,activity:Activity,save:(tx:StudyTransaction,seconds:number)=>Promise<void>=async()=>{}){
 const eventKey=activity.kind+':'+activity.eventKey;
 return getDb().transaction(async tx=>{
  // Serialize one student's activity across tabs, retries and different tasks.
  const [student]=await tx.select({id:students.id}).from(students).where(and(eq(students.id,activity.studentId),eq(students.ownerId,activity.ownerId))).for('update');
  if(!student)throw Error('学生不存在');
  const profile=await ensureProfile(tx,data,activity.studentId,activity.ownerId);
  const [duplicate]=await tx.select({id:studyEvents.id}).from(studyEvents).where(and(eq(studyEvents.studentId,activity.studentId),eq(studyEvents.eventKey,eventKey)));
  if(duplicate)return;
  const now=new Date(),day=studyDay(now),createdAt=now.toISOString();
  if(activity.kind==='checkin'){
   const events=await tx.select().from(studyEvents).where(and(eq(studyEvents.studentId,activity.studentId),eq(studyEvents.day,day)));
   if(!events.some(e=>e.activeSeconds>0||JSON.parse(e.terms).length))throw Error('先学习，再打卡');
   if(events.some(e=>e.kind==='checkin'||e.kind==='quiz'))return;
  }
  const elapsed=profile.lastActivityAt?Math.floor((now.getTime()-Date.parse(profile.lastActivityAt))/1000):0;
  // Never count idle gaps, hidden tabs or caller-supplied elapsed time.
  const seconds=activity.kind==='checkin'?0:elapsed>0&&elapsed<=35?Math.min(elapsed,20):0;
  await save(tx,seconds);
  await tx.insert(studyEvents).values({id:randomUUID(),eventKey,studentId:activity.studentId,ownerId:activity.ownerId,taskId:activity.taskId,day,kind:activity.kind,terms:JSON.stringify(activity.terms||[]),activeSeconds:seconds,createdAt});
  if(activity.kind!=='checkin')await tx.update(studyProfiles).set({lastActivityAt:createdAt}).where(eq(studyProfiles.studentId,activity.studentId));
 });
}
export async function studentStudyStats(data:Workspace,studentId:string,ownerId:string){
 return getDb().transaction(async tx=>{
  await tx.select({id:students.id}).from(students).where(and(eq(students.id,studentId),eq(students.ownerId,ownerId))).for('update');
  const profile=await ensureProfile(tx,data,studentId,ownerId);
  const events=await tx.select().from(studyEvents).where(and(eq(studyEvents.studentId,studentId),eq(studyEvents.ownerId,ownerId)));
  return aggregateStudyStats(JSON.parse(profile.baseline) as StudyBaseline,events,profile.startedAt);
 });
}
export async function readStudentStudyStats(studentId:string,ownerId:string){
 const db=getDb();
 const [profile]=await db.select().from(studyProfiles).where(and(eq(studyProfiles.studentId,studentId),eq(studyProfiles.ownerId,ownerId)));
 if(!profile)return null;
 const events=await db.select().from(studyEvents).where(and(eq(studyEvents.studentId,studentId),eq(studyEvents.ownerId,ownerId)));
 return aggregateStudyStats(JSON.parse(profile.baseline) as StudyBaseline,events,profile.startedAt);
}
