import { NextResponse } from 'next/server';
import { and, eq, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/db';
import { users,students,registrationWindows } from '@/db/schema';
import { hashPassword, verifyPassword } from '@/lib/password';
import { createSession } from '@/lib/session';
import { consumeLimit, isSameOrigin } from '@/lib/request-security';
import { isRegistrationCode, normalizeRegistrationCode } from '@/lib/registration-code';
export const runtime='nodejs';
let dummyHash:Promise<string>|undefined;
export async function POST(request:Request){
 if(!isSameOrigin(request))return NextResponse.json({error:'请求来源无效'},{status:403});
 try{
  const input=z.object({username:z.string().trim().min(1).max(128),password:z.string().min(1).max(128),role:z.enum(['teacher','student']).optional(),method:z.enum(['name','account']).optional(),classCode:z.string().trim().max(24).default('')}).parse(await request.json());
  const ip=process.env.VERCEL?request.headers.get('x-vercel-forwarded-for')||'unknown':'local';
  if(!await consumeLimit('login-ip',ip,120,900))return NextResponse.json({error:'尝试次数过多，请稍后重试'},{status:429});
  const db=getDb(),identifier=input.username.toLowerCase();
  let user:typeof users.$inferSelect|undefined;
  if(input.role==='student'&&input.method!=='account'){
   let classId:string|undefined;
   if(input.classCode){
    const code=normalizeRegistrationCode(input.classCode);
    const [window]=isRegistrationCode(code)?await db.select({classId:registrationWindows.classId}).from(registrationWindows).where(or(eq(registrationWindows.code,code),eq(registrationWindows.shortCode,code))).limit(1):[];
    if(!window)return NextResponse.json({error:'姓名、班级注册码或密码不正确'},{status:401});
    classId=window.classId;
   }
   const candidates=await db.select({user:users,classId:students.classId}).from(students).innerJoin(users,eq(users.id,students.userId)).where(and(eq(users.role,'student'),sql`lower(${students.name}) = ${identifier}`,classId?eq(students.classId,classId):undefined)).limit(21);
   if(candidates.length>1){
    const sameClass=new Set(candidates.map(c=>c.classId)).size===1;
    return NextResponse.json({error:sameClass?'班级内存在重名，请联系教师设置登录账号，再使用账号登录':'存在同名学生，请填写班级注册码后登录',needsClassCode:!sameClass,needsAlias:sameClass},{status:409});
   }
   user=candidates[0]?.user;
   if(!input.method&&!input.classCode){
    const [alias]=await db.select().from(users).where(eq(users.username,identifier)).limit(1);
    if(user&&alias&&user.id!==alias.id)return NextResponse.json({error:'姓名与账号存在歧义，请选择用姓名或登录账号登录',needsAlias:true},{status:409});
    user??=alias;
   }
  }else [user]=await db.select().from(users).where(eq(users.username,identifier)).limit(1);
  if(!await consumeLimit('login',user?.id||identifier,12,900))return NextResponse.json({error:'尝试次数过多，请 15 分钟后重试'},{status:429});
  dummyHash??=hashPassword('unused-timing-comparison-password');
  const valid=await verifyPassword(input.password,user?.passwordHash??await dummyHash);
  if(!user||!valid||user.disabled)return NextResponse.json({error:'姓名、账号或密码不正确，或账号已停用'},{status:401});
  if(input.role&&input.role!==user.role)return NextResponse.json({error:input.role==='teacher'?'请使用教师账号登录':'请使用学生账号登录'},{status:403});
  await createSession(user.id);return NextResponse.json({ok:true,redirectTo:user.role==='teacher'?'/t':'/'});
 }catch(error){return NextResponse.json({error:error instanceof z.ZodError?'请检查姓名、账号和密码':'登录服务暂时不可用，请稍后重试'},{status:error instanceof z.ZodError?400:503})}
}
