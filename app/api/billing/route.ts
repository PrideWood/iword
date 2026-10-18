import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/db';
import { creditLedger,redemptionCodes,wallets } from '@/db/schema';
import { currentAccount } from '@/lib/session';
import { consumeLimit,isSameOrigin } from '@/lib/request-security';
import { BillingError,codeHash,teacherBilling } from '@/lib/billing';
export const runtime='nodejs';
export async function GET(){const account=await currentAccount();if(!account)return NextResponse.json({error:'请先登录'},{status:401});if(account.role!=='teacher')return NextResponse.json({error:'无权访问'},{status:403});return NextResponse.json(await teacherBilling(account.workspaceId),{headers:{'Cache-Control':'private, no-store'}})}
export async function POST(request:Request){
 const account=await currentAccount();if(!account)return NextResponse.json({error:'请先登录'},{status:401});
 if(account.role!=='teacher'||!isSameOrigin(request))return NextResponse.json({error:'无权操作'},{status:403});
 try{
  if(!await consumeLimit('redeem',account.id,10,600))throw new BillingError('尝试过于频繁，请稍后再试',429);
  const {code}=z.object({code:z.string().trim().min(12).max(100)}).parse(await request.json());
  await getDb().transaction(async tx=>{
   const [item]=await tx.select().from(redemptionCodes).where(eq(redemptionCodes.codeHash,codeHash(code))).for('update');
   if(!item||item.revoked||item.redeemedAt||item.expiresAt<=new Date())throw new BillingError('兑换码无效、已使用或已过期',409);
   await tx.insert(wallets).values({workspaceId:account.workspaceId}).onConflictDoNothing();
   const [wallet]=await tx.select().from(wallets).where(eq(wallets.workspaceId,account.workspaceId)).for('update');
   const balance=wallet.balance+item.points;if(balance>1e12)throw new BillingError('额度超出允许范围');
   await tx.update(wallets).set({balance}).where(eq(wallets.workspaceId,account.workspaceId));
   await tx.update(redemptionCodes).set({redeemedBy:account.id,redeemedWorkspace:account.workspaceId,redeemedAt:new Date()}).where(eq(redemptionCodes.id,item.id));
   await tx.insert(creditLedger).values({id:randomUUID(),workspaceId:account.workspaceId,actorId:account.id,kind:'redemption',delta:item.points,balanceAfter:balance,note:`兑换码 …${item.suffix}`});
  });return NextResponse.json({ok:true});
 }catch(error){return NextResponse.json({error:error instanceof BillingError?error.message:'兑换失败，请检查输入或稍后重试'},{status:error instanceof BillingError?error.status:400})}
}
