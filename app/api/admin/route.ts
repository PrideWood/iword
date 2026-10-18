import { randomBytes,randomUUID } from 'node:crypto';
import { and,desc,eq,sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/db';
import { users,billingSettings,redemptionCodes,sessions } from '@/db/schema';
import { currentAccount } from '@/lib/session';
import { isSameOrigin } from '@/lib/request-security';
import { hashPassword } from '@/lib/password';
import { adjustWallet,BillingError,codeHash,emptyUsage,estimateCost,settings,usageSummary } from '@/lib/billing';
export const runtime='nodejs';
export async function GET(request:Request){
 const account=await currentAccount();if(!account)return NextResponse.json({error:'请先登录'},{status:401});if(!account.isAdmin)return NextResponse.json({error:'仅最高管理员可访问'},{status:403});
 const db=getDb(),config=await settings();
 const teacherId=new URL(request.url).searchParams.get('teacherId');
 if(teacherId){const [teacher]=await db.select({id:users.id,name:users.name,workspaceId:users.workspaceId}).from(users).where(and(eq(users.id,teacherId),eq(users.role,'teacher')));if(!teacher)return NextResponse.json({error:'教师不存在'},{status:404});return NextResponse.json({teacher,...await (await import('@/lib/billing')).teacherBilling(teacher.workspaceId)},{headers:{'Cache-Control':'private, no-store'}})}
 const rows=await db.execute(sql`select u.id,u.username,u.name,u.workspace_id as "workspaceId",u.disabled,u.created_at as "createdAt",coalesce(w.balance,0) as balance,
 (select count(*) from classrooms c where c.owner_id=u.workspace_id) as classes,
 (select count(*) from students s where s.owner_id=u.workspace_id) as students,
 (select count(*) from tasks t where t.owner_id=u.workspace_id) as tasks,
 (select count(*) from learning l where l.owner_id=u.workspace_id and l.first_completed_at is not null) as completed,
 (select max(l.last_seen_at) from learning l where l.owner_id=u.workspace_id) as "lastLearningAt"
 from users u left join wallets w on w.workspace_id=u.workspace_id where u.role='teacher' order by u.created_at`);
 const usage=await usageSummary();
 const teachers=rows.map(row=>{const totals=usage.find(u=>u.workspaceId===row.workspaceId)??emptyUsage;return {...row,isAdmin:row.id===account.id,balance:Number(row.balance),classes:Number(row.classes),students:Number(row.students),tasks:Number(row.tasks),completed:Number(row.completed),usage:totals,estimate:estimateCost(totals,totals.uploadedBytes,config)}});
 const codes=await db.select({id:redemptionCodes.id,suffix:redemptionCodes.suffix,points:redemptionCodes.points,expiresAt:redemptionCodes.expiresAt,revoked:redemptionCodes.revoked,redeemedBy:redemptionCodes.redeemedBy,redeemedWorkspace:redemptionCodes.redeemedWorkspace,redeemedAt:redemptionCodes.redeemedAt,createdAt:redemptionCodes.createdAt}).from(redemptionCodes).orderBy(desc(redemptionCodes.createdAt)).limit(200);
 return NextResponse.json({teachers,config,codes},{headers:{'Cache-Control':'private, no-store'}});
}
const pricing=z.object({enforced:z.boolean(),pointsPerCharacter:z.number().int().min(1).max(10000),ttsCentsPerMillion:z.number().int().min(0).max(1e8),cosCentsPerGB:z.number().int().min(0).max(1e8),cosCentsPer10kRequests:z.number().int().min(0).max(1e8),cosStorageCentsPerGBMonth:z.number().int().min(0).max(1e8)});
export async function POST(request:Request){
 const account=await currentAccount();if(!account)return NextResponse.json({error:'请先登录'},{status:401});if(!account.isAdmin||!isSameOrigin(request))return NextResponse.json({error:'无权操作'},{status:403});
 try{
  const raw=await request.json(),db=getDb();
  if(raw.action==='createTeacher'){
   const input=z.object({username:z.string().trim().toLowerCase().regex(/^[a-z0-9_.-]{3,64}$/),name:z.string().trim().min(1).max(40),password:z.string().min(12).max(128)}).parse(raw);
   await db.insert(users).values({id:randomUUID(),username:input.username,name:input.name,passwordHash:await hashPassword(input.password),role:'teacher',workspaceId:randomUUID()});
  }else if(raw.action==='teacher'){
   const input=z.object({id:z.string(),name:z.string().trim().min(1).max(40),disabled:z.boolean()}).parse(raw);
   if(input.id===account.id&&input.disabled)throw new BillingError('不能停用最高管理员');
   const changed=await db.update(users).set({name:input.name,disabled:input.disabled}).where(and(eq(users.id,input.id),eq(users.role,'teacher'))).returning({id:users.id});
   if(!changed.length)throw new BillingError('教师不存在',404);
   if(input.disabled)await db.delete(sessions).where(eq(sessions.userId,input.id));
  }else if(raw.action==='settings'){
   const input=pricing.parse(raw);await db.insert(billingSettings).values({id:'root',...input}).onConflictDoUpdate({target:billingSettings.id,set:input});
  }else if(raw.action==='adjust'){
   const input=z.object({teacherId:z.string(),delta:z.number().int().min(-1e9).max(1e9).refine(n=>n!==0),note:z.string().trim().min(1).max(200),requestId:z.string().uuid()}).parse(raw);
   const [teacher]=await db.select().from(users).where(and(eq(users.id,input.teacherId),eq(users.role,'teacher')));if(!teacher)throw new BillingError('教师不存在',404);
   await adjustWallet(teacher.workspaceId,account.id,input.delta,input.note,input.requestId);
  }else if(raw.action==='createCodes'){
   const input=z.object({points:z.number().int().min(1).max(1e9),count:z.number().int().min(1).max(50),expiresAt:z.string().datetime()}).parse(raw);
   if(new Date(input.expiresAt)<=new Date())throw new BillingError('有效期必须晚于当前时间');
   const codes=Array.from({length:input.count},()=>`IW-${randomBytes(18).toString('hex').toUpperCase()}`);
   await db.insert(redemptionCodes).values(codes.map(code=>({id:randomUUID(),codeHash:codeHash(code),suffix:code.slice(-6),points:input.points,createdBy:account.id,expiresAt:new Date(input.expiresAt)})));
   return NextResponse.json({codes},{headers:{'Cache-Control':'private, no-store'}});
  }else if(raw.action==='revokeCode'){
   const {id}=z.object({id:z.string()}).parse(raw);const changed=await db.update(redemptionCodes).set({revoked:true}).where(and(eq(redemptionCodes.id,id),sql`${redemptionCodes.redeemedAt} is null`)).returning({id:redemptionCodes.id});if(!changed.length)throw new BillingError('兑换码不存在或已使用',409);
  }else throw new BillingError('不支持的操作');
  return NextResponse.json({ok:true});
 }catch(error){return NextResponse.json({error:error instanceof BillingError?error.message:error instanceof z.ZodError?'请检查填写内容':'保存失败，账号可能已存在或服务暂不可用'},{status:error instanceof BillingError?error.status:400})}
}
