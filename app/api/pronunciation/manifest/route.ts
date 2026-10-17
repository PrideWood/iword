import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { pronunciationAssets } from '@/db/schema';
import { signAudioObject } from '@/lib/audio-server';
import { currentAccount } from '@/lib/session';
import { accessibleWorkspace } from '@/lib/access';
import { normalizePronunciationTerm } from '@/lib/pronunciation';
import type { Word } from '@/lib/types';
export async function GET(){
 const account=await currentAccount();if(!account)return NextResponse.json({error:'请先登录'},{status:401});
 const data=await accessibleWorkspace(account);const allowed=new Set([...data.words,...data.tasks.flatMap(t=>JSON.parse(t.wordSnapshot) as Word[])].map(w=>normalizePronunciationTerm(w.english)));
 const rows=await getDb().select().from(pronunciationAssets).where(eq(pronunciationAssets.status,'ready'));
 const entries=await Promise.all(rows.filter(r=>allowed.has(r.key)).map(async r=>({term:r.key,accent:'en-US',src:await signAudioObject(r.objectKey),source:'tencent-cloud-tts:YunMia:403006'})));
 return NextResponse.json({schemaVersion:1,generatedAt:new Date().toISOString(),entries},{headers:{'Cache-Control':'private, no-store'}});
}
