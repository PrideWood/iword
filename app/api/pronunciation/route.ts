import { NextResponse } from 'next/server';
import { z } from 'zod';
import { currentAccount } from '@/lib/session';
import { accessibleWorkspace } from '@/lib/access';
import { ensureAudio } from '@/lib/audio-server';
import { isSameOrigin, consumeLimit } from '@/lib/request-security';
import { normalizePronunciationTerm } from '@/lib/pronunciation';
import type { Word } from '@/lib/types';
import { BillingError } from '@/lib/billing';
export const runtime='nodejs';
export const maxDuration=60;
export async function POST(request:Request){
 const account=await currentAccount();if(!account)return NextResponse.json({error:'请先登录'},{status:401});
 if(!isSameOrigin(request))return NextResponse.json({error:'请求来源无效'},{status:403});
 try{
  const {text}=z.object({text:z.string().trim().min(1).max(80).regex(/^[a-zA-Z][a-zA-Z0-9 '\u2019.,-]*$/)}).parse(await request.json());
  const data=await accessibleWorkspace(account);const allowed=[...data.words,...data.tasks.flatMap(t=>JSON.parse(t.wordSnapshot) as Word[])];
  const word=allowed.find(w=>normalizePronunciationTerm(w.english)===normalizePronunciationTerm(text));
  if(!word)return NextResponse.json({error:'无权访问该单词'},{status:403});
  if(!await consumeLimit('audio-requests',account.id,120,60))return NextResponse.json({error:'点击过于频繁，请稍后重试'},{status:429});
  return NextResponse.json({url:await ensureAudio(word.english,account.id)},{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){return NextResponse.json({error:error instanceof BillingError?error.message:error instanceof z.ZodError?'单词格式不正确':'音频暂时不可用，请稍后重试'},{status:error instanceof BillingError?error.status:error instanceof z.ZodError?400:503})}
}
