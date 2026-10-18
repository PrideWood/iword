import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { eq, or } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/db';
import { registrationWindows, classrooms, students, users } from '@/db/schema';
import { hashPassword } from '@/lib/password';
import { consumeLimit, isSameOrigin } from '@/lib/request-security';
import { isRegistrationCode, normalizeRegistrationCode } from '@/lib/registration-code';
import { generatedStudentLogin, optionalStudentNumber, studentLoginAlias, studentPassword } from '@/lib/student-identity';

export async function GET(request:Request){
  const code=normalizeRegistrationCode(new URL(request.url).searchParams.get('code')||'');
  if(!isRegistrationCode(code))return NextResponse.json({error:'请输入六位数字和字母注册码'},{status:400});
  const ip=process.env.VERCEL?request.headers.get('x-vercel-forwarded-for')||'unknown':'local';
  if(!await consumeLimit('register-lookup-ip',ip,60,60))return NextResponse.json({error:'查询过于频繁，请稍后重试'},{status:429});
  const [row]=await getDb().select({name:classrooms.name,enabled:registrationWindows.enabled,opensAt:registrationWindows.opensAt,closesAt:registrationWindows.closesAt}).from(registrationWindows).innerJoin(classrooms,eq(classrooms.id,registrationWindows.classId)).where(or(eq(registrationWindows.code,code),eq(registrationWindows.shortCode,code))).limit(1);
  if(!row)return NextResponse.json({error:'注册入口不存在'},{status:404});
  return NextResponse.json({...row,open:row.enabled&&row.opensAt<=new Date()&&row.closesAt>new Date()},{headers:{'Cache-Control':'no-store'}});
}
export async function POST(request:Request){
  if(!isSameOrigin(request))return NextResponse.json({error:'请求来源无效'},{status:403});
  try{
    const input=z.object({code:z.string().transform(normalizeRegistrationCode).refine(isRegistrationCode,'请输入有效的班级注册码'),name:z.string().trim().min(1,'请填写姓名').max(40,'姓名最多 40 位'),number:optionalStudentNumber,username:studentLoginAlias.default(''),password:studentPassword}).parse(await request.json());
    const ip=process.env.VERCEL?request.headers.get('x-vercel-forwarded-for')||'unknown':'local';
    if(!await consumeLimit('register-ip',ip,15,600)||!await consumeLimit('register-code',input.code,60,60))return NextResponse.json({error:'注册过于频繁，请稍后重试'},{status:429});
    const passwordHash=await hashPassword(input.password);
    await getDb().transaction(async tx=>{
      const [window]=await tx.select().from(registrationWindows).where(or(eq(registrationWindows.code,input.code),eq(registrationWindows.shortCode,input.code))).for('update');
      const now=new Date();
      if(!window||!window.enabled||window.opensAt>now||window.closesAt<=now)throw Error('CLOSED');
      const id=randomUUID();
      await tx.insert(users).values({id,username:input.username||generatedStudentLogin(id),passwordHash,name:input.name,role:'student',workspaceId:window.ownerId});
      await tx.insert(students).values({id:randomUUID(),ownerId:window.ownerId,classId:window.classId,userId:id,name:input.name,number:input.number});
    });
    return NextResponse.json({ok:true,loginBy:'name'},{status:201});
  }catch(error){
    const closed=error instanceof Error&&error.message==='CLOSED';
    return NextResponse.json({error:closed?'当前不在注册开放时段':error instanceof z.ZodError?error.issues[0]?.message||'请检查注册信息':'登录账号或学号已被使用，请更换或留空；已有账号请直接登录'},{status:closed?403:400});
  }
}
