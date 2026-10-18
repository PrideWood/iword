import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { inArray } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/db';
import { tasks, students, pronunciationAssets,usageEvents } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { currentAccount } from '@/lib/session';
import { isSameOrigin } from '@/lib/request-security';
import { normalizePronunciationTerm } from '@/lib/pronunciation';
import { pronunciationObjectKey, signAudioObject } from '@/lib/audio-server';
import type { Word } from '@/lib/types';
export async function POST(request:Request){
 const account=await currentAccount();if(!account)return NextResponse.json({error:'请先登录'},{status:401});
 if(!isSameOrigin(request))return NextResponse.json({error:'请求来源无效'},{status:403});
 try{
  const {taskId}=z.object({taskId:z.string().min(1)}).parse(await request.json());
  const db=getDb();const [task]=await db.select().from(tasks).where(and(eq(tasks.id,taskId),eq(tasks.ownerId,account.workspaceId))).limit(1);
  if(!task)return NextResponse.json({error:'任务不存在'},{status:404});
  if(account.role==='student'){
   const [student]=await db.select({id:students.id}).from(students).where(and(eq(students.userId,account.id),eq(students.classId,task.classId),eq(students.ownerId,account.workspaceId))).limit(1);
   if(!student)return NextResponse.json({error:'无权访问'},{status:403});
  }
  const terms=[...new Set((JSON.parse(task.wordSnapshot) as Word[]).map(w=>normalizePronunciationTerm(w.english)))];
  const assets=terms.length?await db.select().from(pronunciationAssets).where(inArray(pronunciationAssets.key,terms)):[];
  const ready=assets.filter(a=>a.status==='ready'&&a.objectKey===pronunciationObjectKey(a.key));
  const items=await Promise.all(ready.map(async a=>({term:a.key,url:await signAudioObject(a.objectKey)})));
  if(ready.length)await db.insert(usageEvents).values(ready.map(a=>({id:randomUUID(),workspaceId:account.workspaceId,actorId:account.id,kind:'signed_url',term:a.objectKey,downloadBytes:a.byteSize})));
  return NextResponse.json({items},{headers:{'Cache-Control':'private, no-store'}});
 }catch{return NextResponse.json({error:'无法读取任务发音'},{status:400})}
}
