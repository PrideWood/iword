import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/db';
import { users, sessions } from '@/db/schema';
import { currentAccount, destroySession } from '@/lib/session';
import { hashPassword, verifyPassword } from '@/lib/password';
import { consumeLimit, isSameOrigin } from '@/lib/request-security';
export async function POST(request:Request){
 const account=await currentAccount();if(!account)return NextResponse.json({error:'请先登录'},{status:401});
 if(!isSameOrigin(request))return NextResponse.json({error:'请求来源无效'},{status:403});
 try{
  const input=z.object({currentPassword:z.string().min(1).max(128),password:z.string().min(account.role==='student'?6:12).max(128)}).parse(await request.json());
  if(!await consumeLimit('change-password',account.id,10,900))return NextResponse.json({error:'尝试过于频繁'},{status:429});
  const [user]=await getDb().select().from(users).where(eq(users.id,account.id)).limit(1);
  if(!user||!await verifyPassword(input.currentPassword,user.passwordHash))return NextResponse.json({error:'当前密码不正确'},{status:400});
  const passwordHash=await hashPassword(input.password);
  await getDb().transaction(async tx=>{await tx.update(users).set({passwordHash}).where(eq(users.id,account.id));await tx.delete(sessions).where(eq(sessions.userId,account.id))});
  await destroySession();return NextResponse.json({ok:true});
 }catch{return NextResponse.json({error:`密码需为 ${account.role==='student'?6:12}–128 位，请稍后重试`},{status:400})}
}
