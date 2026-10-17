import { NextResponse } from 'next/server';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/db';
import { users, sessions, students } from '@/db/schema';
import { currentAccount } from '@/lib/session';
import { hashPassword } from '@/lib/password';
import { consumeLimit, isSameOrigin } from '@/lib/request-security';
export async function POST(request: Request) {
  const account = await currentAccount();
  if (!account) return NextResponse.json({ error: '请先登录' }, { status: 401 });
  if (account.role !== 'teacher' || !isSameOrigin(request)) return NextResponse.json({ error: '无权操作' }, { status: 403 });
  try {
    const input = z.object({ studentId: z.string().min(1), username: z.string().trim().toLowerCase().regex(/^[a-z0-9_.-]{3,64}$/), password: z.string().min(12).max(128) }).parse(await request.json());
    if (!await consumeLimit('account-management', account.id, 60, 3600)) return NextResponse.json({ error: '操作过于频繁' }, { status: 429 });
    const db = getDb();
    const [student] = await db.select().from(students).where(and(eq(students.id, input.studentId), eq(students.ownerId, account.workspaceId))).limit(1);
    if (!student) return NextResponse.json({ error: '学生不存在' }, { status: 404 });
    const passwordHash = await hashPassword(input.password);
    await db.transaction(async tx => {
      if (student.userId) {
        const updated = await tx.update(users).set({ username: input.username, passwordHash, name: student.name })
          .where(and(eq(users.id, student.userId), eq(users.role, 'student'), eq(users.workspaceId, account.workspaceId))).returning({ id: users.id });
        if (!updated.length) throw new Error('Invalid account');
        await tx.delete(sessions).where(eq(sessions.userId, student.userId));
      } else {
        const id = crypto.randomUUID();
        await tx.insert(users).values({ id, username: input.username, passwordHash, name: student.name, role: 'student', workspaceId: account.workspaceId });
        const linked = await tx.update(students).set({ userId: id }).where(and(eq(students.id, student.id), eq(students.ownerId, account.workspaceId), isNull(students.userId))).returning();
        if (!linked.length) throw new Error('Concurrent update');
      }
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof z.ZodError ? '账号需为 3–64 位字母数字，密码至少 12 位' : '无法保存，账号可能已被占用，请刷新后重试' }, { status: 400 });
  }
}
