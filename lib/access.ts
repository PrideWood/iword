import { and, eq, inArray } from 'drizzle-orm';
import { getDb } from '@/db';
import * as schema from '@/db/schema';
import type { Account } from './session';
import type { Workspace } from './types';
import { getWorkspace } from './workspace';
export async function accessibleWorkspace(account: Account): Promise<Workspace> {
  if (account.role === 'teacher') return getWorkspace(account.workspaceId);
  const db = getDb();
  const students = await db.select().from(schema.students).where(and(eq(schema.students.userId, account.id), eq(schema.students.ownerId, account.workspaceId)));
  const classIds = [...new Set(students.map(student => student.classId))];
  if (!classIds.length) return { classes: [], students: [], books: [], words: [], tasks: [], learning: [], attempts: [] };
  const ids = students.map(student => student.id);
  const [classes, tasks, learning, attempts] = await Promise.all([
    db.select().from(schema.classrooms).where(and(eq(schema.classrooms.ownerId, account.workspaceId), inArray(schema.classrooms.id, classIds))),
    db.select().from(schema.tasks).where(and(eq(schema.tasks.ownerId, account.workspaceId), inArray(schema.tasks.classId, classIds))),
    db.select().from(schema.learning).where(and(eq(schema.learning.ownerId, account.workspaceId), inArray(schema.learning.studentId, ids))),
    db.select().from(schema.attempts).where(and(eq(schema.attempts.ownerId, account.workspaceId), inArray(schema.attempts.studentId, ids))),
  ]);
  // Deleted assignments remain available only when needed to resolve this student's history.
  const history = new Set([...learning, ...attempts].map(record => record.taskId));
  return { classes, students, books: [], words: [], tasks: tasks.filter(task => task.status !== 'deleted' || history.has(task.id)), learning, attempts };
}
export function canMutate(account: Account, body: Record<string, unknown>, data: Workspace) {
  if (account.role === 'teacher') return true;
  return ['progress', 'attempt', 'heartbeat'].includes(String(body.action)) &&
    data.students.some(s => s.id === body.studentId && s.userId === account.id) &&
    data.tasks.some(t => t.id === body.taskId && t.status !== 'deleted' && data.students.some(s => s.id === body.studentId && s.classId === t.classId));
}
