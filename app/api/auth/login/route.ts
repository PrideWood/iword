import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/db';
import { users } from '@/db/schema';
import { hashPassword, verifyPassword } from '@/lib/password';
import { createSession } from '@/lib/session';
import { consumeLimit, isSameOrigin } from '@/lib/request-security';
export const runtime = 'nodejs';
let dummyHash: Promise<string> | undefined;
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: '请求来源无效' }, { status: 403 });
  try {
    const input = z.object({ username: z.string().trim().toLowerCase().min(3).max(64), password: z.string().min(1).max(128), role:z.enum(['teacher','student']).optional() }).parse(await request.json());
    if (!await consumeLimit('login', input.username, 12, 900)) return NextResponse.json({ error: '尝试次数过多，请 15 分钟后重试' }, { status: 429 });
    const [user] = await getDb().select().from(users).where(eq(users.username, input.username)).limit(1);
    dummyHash ??= hashPassword('unused-timing-comparison-password');
    const valid = await verifyPassword(input.password, user?.passwordHash ?? await dummyHash);
    if (!user || !valid || user.disabled) return NextResponse.json({ error: '账号或密码不正确，或账号已停用' }, { status: 401 });
    if(input.role&&input.role!==user.role)return NextResponse.json({error:input.role==='teacher'?'请使用教师账号登录':'请使用学生账号登录'},{status:403});
    await createSession(user.id);
    return NextResponse.json({ ok: true,redirectTo:user.role==='teacher'?'/teacher':'/' });
  } catch (error) {
    return NextResponse.json({ error: error instanceof z.ZodError ? '请检查账号和密码' : '登录服务暂时不可用，请稍后重试' }, { status: error instanceof z.ZodError ? 400 : 503 });
  }
}
