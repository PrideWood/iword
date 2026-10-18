import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/db';
import { classrooms, registrationWindows } from '@/db/schema';
import { currentAccount } from '@/lib/session';
import { isSameOrigin } from '@/lib/request-security';
import { createRegistrationWindow } from '@/lib/registration-code-server';

export async function GET() {
  const user=await currentAccount();
  if(!user)return NextResponse.json({error:'请先登录'},{status:401});
  if(user.role!=='teacher')return NextResponse.json({error:'无权操作'},{status:403});
  const windows=await getDb().select().from(registrationWindows).where(eq(registrationWindows.ownerId,user.workspaceId));
  return NextResponse.json(windows.map(window=>({...window,code:window.shortCode||window.code})),{headers:{'Cache-Control':'private, no-store'}});
}
export async function POST(request:Request){
  const user=await currentAccount();
  if(!user)return NextResponse.json({error:'请先登录'},{status:401});
  if(user.role!=='teacher'||!isSameOrigin(request))return NextResponse.json({error:'无权操作'},{status:403});
  try{
    const input=z.discriminatedUnion('action',[
      z.object({action:z.literal('create'),classId:z.string(),opensAt:z.string().datetime(),closesAt:z.string().datetime()}),
      z.object({action:z.literal('toggle'),id:z.string(),enabled:z.boolean()}),
      z.object({action:z.literal('update'),id:z.string(),opensAt:z.string().datetime(),closesAt:z.string().datetime()}),
    ]).parse(await request.json());
    const db=getDb();
    if(input.action==='toggle'){
      const updated=await db.update(registrationWindows).set({enabled:input.enabled}).where(and(eq(registrationWindows.id,input.id),eq(registrationWindows.ownerId,user.workspaceId))).returning();
      if(!updated.length)return NextResponse.json({error:'记录不存在'},{status:404});
    }else if(input.action==='update'){
      if(new Date(input.closesAt)<=new Date(input.opensAt))return NextResponse.json({error:'截止时间必须晚于开始时间'},{status:400});
      const updated=await db.update(registrationWindows).set({opensAt:new Date(input.opensAt),closesAt:new Date(input.closesAt)}).where(and(eq(registrationWindows.id,input.id),eq(registrationWindows.ownerId,user.workspaceId))).returning();
      if(!updated.length)return NextResponse.json({error:'记录不存在'},{status:404});
    }else{
      if(new Date(input.closesAt)<=new Date(input.opensAt))return NextResponse.json({error:'截止时间必须晚于开始时间'},{status:400});
      const [room]=await db.select().from(classrooms).where(and(eq(classrooms.id,input.classId),eq(classrooms.ownerId,user.workspaceId))).limit(1);
      if(!room)return NextResponse.json({error:'班级不存在'},{status:404});
      await createRegistrationWindow({ownerId:user.workspaceId,classId:room.id,opensAt:new Date(input.opensAt),closesAt:new Date(input.closesAt)});
    }
    return NextResponse.json({ok:true});
  }catch{return NextResponse.json({error:'保存失败，请检查时间和班级'},{status:400})}
}
