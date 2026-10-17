import COS from 'cos-nodejs-sdk-v5';
import { currentAccount } from '@/lib/session';
import { accessibleWorkspace } from '@/lib/access';
import { pronunciationObjectKey } from '@/lib/audio-server';
import { normalizePronunciationTerm } from '@/lib/pronunciation';
import type { Word } from '@/lib/types';
export async function GET(request:Request){
 const account=await currentAccount();if(!account)return new Response('请先登录',{status:401});
 const text=new URL(request.url).searchParams.get('text');if(!text||text.length>80)return new Response('单词无效',{status:400});
 const data=await accessibleWorkspace(account);
 if(![...data.words,...data.tasks.flatMap(t=>JSON.parse(t.wordSnapshot) as Word[])].some(w=>normalizePronunciationTerm(w.english)===normalizePronunciationTerm(text)))return new Response('无权访问',{status:403});
 try{
  const Bucket=process.env.TENCENT_COS_BUCKET;if(!Bucket)throw Error('Not configured');
  const cos=new COS({SecretId:process.env.TENCENTCLOUD_SECRET_ID,SecretKey:process.env.TENCENTCLOUD_SECRET_KEY});
  const response=await cos.getObject({Bucket,Region:process.env.TENCENT_COS_REGION||'ap-chongqing',Key:pronunciationObjectKey(text)});
  return new Response(new Uint8Array(response.Body),{headers:{'Content-Type':'audio/mpeg','Cache-Control':'private, max-age=86400'}});
 }catch{return new Response('音频暂时不可用',{status:503})}
}
