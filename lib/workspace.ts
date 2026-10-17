import { eq, inArray } from 'drizzle-orm';
import { getDb } from '@/db';
import * as schema from '@/db/schema';
import { makeSeed } from './seed';
import type { Workspace } from './types';

export async function seedWorkspace(ownerId:string){
 const db=getDb();
 const existing=await db.select({id:schema.classrooms.id}).from(schema.classrooms).where(eq(schema.classrooms.ownerId,ownerId)).limit(1);
 if(existing.length)return false;
 const seed=makeSeed(ownerId);
 await db.transaction(async tx=>{
  await tx.insert(schema.classrooms).values(seed.classes).onConflictDoNothing();
  await tx.insert(schema.students).values(seed.students).onConflictDoNothing();
  await tx.insert(schema.wordbooks).values(seed.books).onConflictDoNothing();
  await tx.insert(schema.words).values(seed.words).onConflictDoNothing();
  await tx.insert(schema.tasks).values(seed.tasks).onConflictDoNothing();
  if(seed.learning.length)await tx.insert(schema.learning).values(seed.learning).onConflictDoNothing();
  if(seed.attempts.length)await tx.insert(schema.attempts).values(seed.attempts).onConflictDoNothing();
 });
 return true;
}

export async function getWorkspace(ownerId:string):Promise<Workspace>{
 const db=getDb();
 const [classes,students,books,tasks,learning,attempts]=await Promise.all([db.select().from(schema.classrooms).where(eq(schema.classrooms.ownerId,ownerId)),db.select().from(schema.students).where(eq(schema.students.ownerId,ownerId)),db.select().from(schema.wordbooks).where(eq(schema.wordbooks.ownerId,ownerId)),db.select().from(schema.tasks).where(eq(schema.tasks.ownerId,ownerId)),db.select().from(schema.learning).where(eq(schema.learning.ownerId,ownerId)),db.select().from(schema.attempts).where(eq(schema.attempts.ownerId,ownerId))]);
 const words=books.length?await db.select().from(schema.words).where(inArray(schema.words.bookId,books.map(b=>b.id))):[];
 return {classes,students,books,words,tasks,learning,attempts};
}
