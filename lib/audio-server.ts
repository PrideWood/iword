import { createHash, randomUUID } from 'node:crypto';
import { eq,sql } from 'drizzle-orm';
import COS from 'cos-nodejs-sdk-v5';
import { tts } from 'tencentcloud-sdk-nodejs-tts';
import { getDb } from '@/db';
import { pronunciationAssets,users,usageEvents } from '@/db/schema';
import { normalizePronunciationTerm } from './pronunciation';
import { chargeGeneration,recordUsage } from './billing';
import type { Account } from './session';

export function pronunciationObjectKey(term: string) {
 const normalized=normalizePronunciationTerm(term);
 const slug=normalized.replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60)||'word';
 const filename=/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized)?normalized:`${slug}-${createHash('sha256').update(normalized).digest('hex').slice(0,10)}`;
 return `${(process.env.TENCENT_COS_PREFIX||'pronunciations/v1').replace(/^\/+|\/+$/g,'')}/en-US/${filename}.mp3`;
}
export async function ensureAudio(term:string, accountId:string){
 const secretId=process.env.TENCENTCLOUD_SECRET_ID,secretKey=process.env.TENCENTCLOUD_SECRET_KEY;
 const Bucket=process.env.TENCENT_COS_BUCKET,Region=process.env.TENCENT_COS_REGION||'ap-chongqing';
 if(!secretId||!secretKey||!Bucket)throw Error('音频服务尚未配置');
 const cos=new COS({SecretId:secretId,SecretKey:secretKey});const Key=pronunciationObjectKey(term);
 const [account]=await getDb().select({workspaceId:users.workspaceId}).from(users).where(eq(users.id,accountId));if(!account)throw Error('账号不存在');
 const event={id:randomUUID(),workspaceId:account.workspaceId,actorId:accountId,kind:'audio_prepare',term,characters:0,ttsRequests:0,cosRequests:0,uploadedBytes:0,downloadBytes:0,outcome:'success'};
 let byteSize=0;
 try{await getDb().transaction(async tx=>{
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${Key}))`);
  try{event.cosRequests++;const head=await cos.headObject({Bucket,Region,Key});byteSize=Number(head.headers?.['content-length']||0)}catch(error){
   const e=error as {statusCode?:number;code?:string};if(e.statusCode!==404&&e.code!=='NoSuchKey'&&e.code!=='NotFound')throw error;
   // Limit generation inside the same transaction; production has one DB connection.
   const rateKey=`audio-generation:${accountId}:${new Date().toISOString().slice(0,10)}`;
   const result=await tx.execute(sql`insert into request_limits (key,count,reset_at) values (${rateKey},1,now()+interval '1 day') on conflict (key) do update set count=request_limits.count+1 returning count`);
   if(Number(result[0]?.count)>100)throw Error('今日生成额度已达到上限');
   await chargeGeneration(tx,account.workspaceId,accountId,[...term].length,term);
   const Client=tts.v20190823.Client;const client=new Client({credential:{secretId,secretKey},region:'',profile:{httpProfile:{endpoint:'tts.tencentcloudapi.com',reqTimeout:40}}});
   event.ttsRequests++;const response=await client.TextToVoice({Text:term,SessionId:randomUUID(),VoiceType:403006,PrimaryLanguage:2,Codec:'mp3',SampleRate:24000,Speed:0,Volume:0});
   if(!response.Audio)throw Error('语音生成失败');
   event.characters=[...term].length;const body=Buffer.from(response.Audio,'base64');byteSize=body.length;event.cosRequests++;
   await cos.putObject({Bucket,Region,Key,Body:body,ContentType:'audio/mpeg',CacheControl:'public, max-age=31536000, immutable'});event.uploadedBytes=body.length;
  }
  await tx.insert(pronunciationAssets).values({key:normalizePronunciationTerm(term),objectKey:Key,status:'ready',byteSize}).onConflictDoUpdate({target:pronunciationAssets.key,set:{objectKey:Key,status:'ready',updatedAt:new Date(),byteSize}});
  await tx.insert(usageEvents).values(event);
 });}catch(error){
  if(event.ttsRequests){const key=`audio-generation:${accountId}:${new Date().toISOString().slice(0,10)}`;await getDb().execute(sql`insert into request_limits (key,count,reset_at) values (${key},1,now()+interval '1 day') on conflict (key) do update set count=request_limits.count+1`).catch(()=>{})}
  await recordUsage({...event,outcome:'failed'}).catch(()=>{});throw error;
 }
 return signAudioObject(Key,{id:accountId,workspaceId:account.workspaceId},byteSize);
}

export async function signAudioObject(Key:string,account?:Pick<Account,'id'|'workspaceId'>,byteSize=0){
 const SecretId=process.env.TENCENTCLOUD_SECRET_ID,SecretKey=process.env.TENCENTCLOUD_SECRET_KEY,Bucket=process.env.TENCENT_COS_BUCKET;
 if(!SecretId||!SecretKey||!Bucket)throw Error('音频服务尚未配置');
 const cos=new COS({SecretId,SecretKey});
 const url=await new Promise<string>((resolve,reject)=>cos.getObjectUrl({Bucket,Region:process.env.TENCENT_COS_REGION||'ap-chongqing',Key,Sign:true,Expires:600},(error,data)=>error?reject(error):resolve(data.Url)));
 if(account)await recordUsage({id:randomUUID(),workspaceId:account.workspaceId,actorId:account.id,kind:'signed_url',term:Key,downloadBytes:byteSize});return url;
}
