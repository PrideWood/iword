import { createHash,randomUUID } from 'node:crypto';
import { desc,eq,sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { billingSettings,creditLedger,usageEvents,wallets } from '@/db/schema';

export class BillingError extends Error{constructor(message:string,public status=400){super(message)}}
export const codeHash=(code:string)=>createHash('sha256').update(code.toUpperCase().replace(/[\s-]/g,'')).digest('hex');
export const billingDefaults={enforced:false,pointsPerCharacter:1,ttsCentsPerMillion:0,cosCentsPerGB:0,cosCentsPer10kRequests:0,cosStorageCentsPerGBMonth:0};
export async function settings(){const [row]=await getDb().select().from(billingSettings).where(eq(billingSettings.id,'root'));return row??{id:'root',...billingDefaults}}
export async function recordUsage(event:typeof usageEvents.$inferInsert){await getDb().insert(usageEvents).values(event)}
type Transaction=Parameters<Parameters<ReturnType<typeof getDb>['transaction']>[0]>[0];
export async function chargeGeneration(tx:Transaction,workspaceId:string,actorId:string,characters:number,term:string){
 const [config]=await tx.select().from(billingSettings).where(eq(billingSettings.id,'root'));
 return chargeWithPolicy(tx,workspaceId,actorId,characters,term,config??billingDefaults);
}
export async function chargeWithPolicy(tx:Transaction,workspaceId:string,actorId:string,characters:number,term:string,config:Pick<typeof billingDefaults,'enforced'|'pointsPerCharacter'>){
 if(!config?.enforced)return 0;
 const cost=characters*config.pointsPerCharacter;
 await tx.insert(wallets).values({workspaceId}).onConflictDoNothing();
 const [wallet]=await tx.select().from(wallets).where(eq(wallets.workspaceId,workspaceId)).for('update');
 if(wallet.balance<cost)throw new BillingError('教师工作空间额度不足，仅暂停生成新音频；已有音频和学习记录仍可使用',402);
 const balance=wallet.balance-cost;
 await tx.update(wallets).set({balance}).where(eq(wallets.workspaceId,workspaceId));
 await tx.insert(creditLedger).values({id:randomUUID(),workspaceId,actorId,kind:'generation',delta:-cost,balanceAfter:balance,note:term});return cost;
}
export type UsageTotals={characters:number;ttsRequests:number;cosRequests:number;uploadedBytes:number;downloadBytes:number;signedUrls:number;unknownSizeUrls:number;generated:number;failed:number};
export const emptyUsage:UsageTotals={characters:0,ttsRequests:0,cosRequests:0,uploadedBytes:0,downloadBytes:0,signedUrls:0,unknownSizeUrls:0,generated:0,failed:0};
export async function usageSummary(workspaceId?:string,since?:Date){
 const rows=await getDb().execute(sql`select workspace_id,
 coalesce(sum(characters),0) as characters,coalesce(sum(tts_requests),0) as "ttsRequests",coalesce(sum(cos_requests),0) as "cosRequests",
 coalesce(sum(uploaded_bytes),0) as "uploadedBytes",coalesce(sum(download_bytes),0) as "downloadBytes",
 count(*) filter(where kind='signed_url') as "signedUrls",count(*) filter(where kind='signed_url' and download_bytes=0) as "unknownSizeUrls",
 count(*) filter(where kind='audio_prepare' and tts_requests>0 and outcome='success') as generated,
 count(*) filter(where outcome='failed') as failed from usage_events
 where (${workspaceId??null}::text is null or workspace_id=${workspaceId??null}) and (${since?.toISOString()??null}::timestamptz is null or created_at>=${since?.toISOString()??null}::timestamptz) group by workspace_id`);
 return rows.map(row=>({workspaceId:String(row.workspace_id),...Object.fromEntries(Object.keys(emptyUsage).map(key=>[key,Number(row[key]||0)])) as UsageTotals}));
}
export function estimateCost(usage:UsageTotals,storedBytes:number,config:typeof billingDefaults){
 return {tts:config.ttsCentsPerMillion?usage.characters/1e6*config.ttsCentsPerMillion/100:null,
  traffic:config.cosCentsPerGB?usage.downloadBytes/1024**3*config.cosCentsPerGB/100:null,
  requests:config.cosCentsPer10kRequests?(usage.cosRequests+usage.signedUrls)/1e4*config.cosCentsPer10kRequests/100:null,
  storageMonthly:config.cosStorageCentsPerGBMonth?storedBytes/1024**3*config.cosStorageCentsPerGBMonth/100:null};
}
export async function teacherBilling(workspaceId:string){
 const config=await settings();const shifted=new Date(Date.now()+8*3600000);const month=new Date(Date.UTC(shifted.getUTCFullYear(),shifted.getUTCMonth(),1)-8*3600000);
 const all=(await usageSummary(workspaceId))[0]??{workspaceId,...emptyUsage};
 const currentMonth=(await usageSummary(workspaceId,month))[0]??{workspaceId,...emptyUsage};
 const [wallet]=await getDb().select().from(wallets).where(eq(wallets.workspaceId,workspaceId));
 const ledger=await getDb().select().from(creditLedger).where(eq(creditLedger.workspaceId,workspaceId)).orderBy(desc(creditLedger.createdAt)).limit(50);
 return {config,balance:wallet?.balance??0,all,month:currentMonth,estimate:estimateCost(all,all.uploadedBytes,config),ledger};
}
export async function adjustWallet(workspaceId:string,actorId:string,delta:number,note:string,id:string=randomUUID()){
 return getDb().transaction(async tx=>{
  await tx.insert(wallets).values({workspaceId}).onConflictDoNothing();
  const [wallet]=await tx.select().from(wallets).where(eq(wallets.workspaceId,workspaceId)).for('update');
  const [prior]=await tx.select().from(creditLedger).where(eq(creditLedger.id,id));
  if(prior){if(prior.workspaceId!==workspaceId||prior.actorId!==actorId||prior.delta!==delta||prior.kind!=='adjustment')throw new BillingError('操作编号冲突');return prior.balanceAfter}
  const balance=wallet.balance+delta;if(balance<0||balance>1e12)throw new BillingError('调整后额度超出允许范围');
  await tx.update(wallets).set({balance}).where(eq(wallets.workspaceId,workspaceId));
  await tx.insert(creditLedger).values({id,workspaceId,actorId,kind:'adjustment',delta,balanceAfter:balance,note});return balance;
 });
}
