import { NextResponse } from 'next/server';
import { and,eq,isNull } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/db';
import { users,sessions,students } from '@/db/schema';
import { currentAccount } from '@/lib/session';
import { hashPassword } from '@/lib/password';
import { consumeLimit,isSameOrigin } from '@/lib/request-security';
import { generatedStudentLogin,isGeneratedStudentLogin,studentLoginAlias,studentPassword } from '@/lib/student-identity';
export async function GET(request:Request){
 const account=await currentAccount();if(!account)return NextResponse.json({error:'请先登录'},{status:401});if(account.role!=='teacher')return NextResponse.json({error:'无权操作'},{status:403});
 const [student]=await getDb().select().from(students).where(and(eq(students.id,new URL(request.url).searchParams.get('studentId')||''),eq(students.ownerId,account.workspaceId))).limit(1);
 if(!student)return NextResponse.json({error:'学生不存在'},{status:404});
 const [user]=student.userId?await getDb().select({username:users.username}).from(users).where(and(eq(users.id,student.userId),eq(users.role,'student'),eq(users.workspaceId,account.workspaceId))):[];
 return NextResponse.json({hasAccount:!!user,username:user&&!isGeneratedStudentLogin(user.username)?user.username:''},{headers:{'Cache-Control':'private, no-store'}});
}
export async function POST(request:Request){
 const account=await currentAccount();if(!account)return NextResponse.json({error:'请先登录'},{status:401});
 if(account.role!=='teacher'||!isSameOrigin(request))return NextResponse.json({error:'无权操作'},{status:403});
 try{
  const input=z.object({studentId:z.string().min(1),username:studentLoginAlias.optional(),password:z.preprocess(value=>value===''?undefined:value,studentPassword.optional())}).parse(await request.json());
  if(!await consumeLimit('account-management',account.id,60,3600))return NextResponse.json({error:'操作过于频繁'},{status:429});
  const db=getDb(),passwordHash=input.password?await hashPassword(input.password):undefined;
  await db.transaction(async tx=>{
   const [student]=await tx.select().from(students).where(and(eq(students.id,input.studentId),eq(students.ownerId,account.workspaceId))).for('update');
   if(!student)throw Error('NOT_FOUND');
   if(student.userId){
    const updated=await tx.update(users).set({...(input.username===undefined?{}:{username:input.username||generatedStudentLogin(student.userId)}),...(passwordHash?{passwordHash}:{}),name:student.name}).where(and(eq(users.id,student.userId),eq(users.role,'student'),eq(users.workspaceId,account.workspaceId))).returning({id:users.id});
    if(!updated.length)throw Error('NOT_FOUND');
    await tx.delete(sessions).where(eq(sessions.userId,student.userId));
   }else{
    if(!passwordHash)throw Error('PASSWORD_REQUIRED');const id=crypto.randomUUID();
    await tx.insert(users).values({id,username:input.username||generatedStudentLogin(id),passwordHash,name:student.name,role:'student',workspaceId:account.workspaceId});
    await tx.update(students).set({userId:id}).where(and(eq(students.id,student.id),isNull(students.userId)));
   }
  });return NextResponse.json({ok:true});
 }catch(error){const message=error instanceof Error?error.message:'';return NextResponse.json({error:error instanceof z.ZodError?error.issues[0]?.message:message==='NOT_FOUND'?'学生不存在':message==='PASSWORD_REQUIRED'?'请设置至少 6 位的初始密码':'登录账号可能已被占用，请更换后重试'},{status:message==='NOT_FOUND'?404:400})}
}
