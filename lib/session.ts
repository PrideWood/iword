import { createHash, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { and, eq, gt } from 'drizzle-orm';
import { getDb } from '@/db';
import { sessions, users } from '@/db/schema';
export const SESSION_COOKIE = 'iword_session';
export const SESSION_SECONDS = 60 * 60 * 24 * 7;
export type Account = { id: string; username: string; name: string; role: 'teacher' | 'student'; workspaceId: string };
export const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
export async function currentAccount(): Promise<Account | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const [row] = await getDb().select({ id: users.id, username: users.username, name: users.name,
    role: users.role, workspaceId: users.workspaceId }).from(sessions).innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, tokenHash(token)), gt(sessions.expiresAt, new Date()))).limit(1);
  return row ?? null;
}
export async function createSession(userId: string) {
  const token = randomBytes(32).toString('hex');
  await getDb().insert(sessions).values({ tokenHash: tokenHash(token), userId, expiresAt: new Date(Date.now() + SESSION_SECONDS * 1000) });
  (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: SESSION_SECONDS });
}
export async function destroySession() {
  const jar = await cookies(); const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await getDb().delete(sessions).where(eq(sessions.tokenHash, tokenHash(token)));
  jar.set(SESSION_COOKIE, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 0 });
}
