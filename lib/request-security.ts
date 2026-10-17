import { createHash } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { requestLimits } from '@/db/schema';
export function isSameOrigin(request: Request) {
  const origin = request.headers.get('origin'); if (!origin) return false;
  try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
}
export async function consumeLimit(scope: string, identity: string, maximum: number, seconds: number) {
  const key = `${scope}:${createHash('sha256').update(identity).digest('hex')}`;
  const now = new Date(); const reset = new Date(now.getTime() + seconds * 1000);
  const [row] = await getDb().insert(requestLimits).values({ key, count: 1, resetAt: reset })
    .onConflictDoUpdate({ target: requestLimits.key, set: {
      count: sql`case when ${requestLimits.resetAt} <= ${now.toISOString()} then 1 else ${requestLimits.count} + 1 end`,
      resetAt: sql`case when ${requestLimits.resetAt} <= ${now.toISOString()} then ${reset.toISOString()}::timestamptz else ${requestLimits.resetAt} end`,
    } }).returning();
  return row.count <= maximum;
}
