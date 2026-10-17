import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/db';
import { registrationWindows, classrooms, students, users } from '@/db/schema';
import { hashPassword } from '@/lib/password';
import { consumeLimit, isSameOrigin } from '@/lib/request-security';

export async function GET(request:Request){
  const code=new URL(request.url).searchParams.get('code');
  if(!code||!/^[a-f0-9]{24}$/.test(code))return NextResponse.json({error:'请输入有效注册码'},{status:400});
  const [row]=await getDb().select({name:classrooms.name,enabled:registrationWindows.enabled,opensAt:registrationWindows.opensAt,closesAt:registrationWindows.closesAt}).from(registrationWindows).innerJoin(classrooms,eq(classrooms.id,registrationWindows.classId)).where(eq(registrationWindows.code,code)).limit(1);
  if(!row)return NextResponse.json({error:'注册入口不存在'},{status:404});
  return NextResponse.json({...row,open:row.enabled&&row.opensAt<=new Date()&&row.closesAt>new Date()},{headers:{'Cache-Control':'no-store'}});
}
export async function POST(request:Request){
  if(!isSameOrigin(request))return NextResponse.json({error:'请求来源无效'},{status:403});
  try{
    const input=z.object({code:z.string().regex(/^[a-f0-9]{24}$/),name:z.string().trim().min(1).max(40),number:z.string().trim().min(1).max(40),username:z.string().trim().toLowerCase().regex(/^[a-z0-9_.-]{3,64}$/),password:z.string().min(12).max(128)}).parse(await request.json());
    const ip=process.env.VERCEL?request.headers.get('x-vercel-forwarded-for')||'unknown':'local';
    if(!await consumeLimit('register-ip',ip,15,600)||!await consumeLimit('register-code',input.code,60,60))return NextResponse.json({error:'注册过于频繁，请稍后重试'},{status:429});
    const passwordHash=await hashPassword(input.password);
    await getDb().transaction(async tx=>{
      const [window]=await tx.select().from(registrationWindows).where(eq(registrationWindows.code,input.code)).for('update');
      const now=new Date();
      if(!window||!window.enabled||window.opensAt>now||window.closesAt<=now)throw Error('CLOSED');
      const id=randomUUID();
      await tx.insert(users).values({id,username:input.username,passwordHash,name:input.name,role:'student',workspaceId:window.ownerId});
      await tx.insert(students).values({id:randomUUID(),ownerId:window.ownerId,classId:window.classId,userId:id,name:input.name,number:input.number});
    });
    return NextResponse.json({ok:true},{status:201});
  }catch(error){
    const closed=error instanceof Error&&error.message==='CLOSED';
    return NextResponse.json({error:closed?'当前不在注册开放时段':error instanceof z.ZodError?'请填写姓名、学号、账号和至少 12 位密码':'账号或学号已登记，请联系教师或更换账号'},{status:closed?403:400});
  }
}
