import { index, integer, pgTable, text, uniqueIndex, timestamp, boolean, bigint, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const users = pgTable('users', {
  id: text('id').primaryKey(), username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(), name: text('name').notNull(),
  role: text('role', { enum: ['teacher', 'student'] }).notNull(), workspaceId: text('workspace_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  disabled: boolean('disabled').notNull().default(false),
});
export const platformAdmin=pgTable('platform_admin',{
 id:text('id').primaryKey().default('root'),userId:text('user_id').notNull().unique().references(()=>users.id,{onDelete:'restrict'}),
},t=>[check('one_platform_admin',sql`${t.id} = 'root'`)]);
export const billingSettings=pgTable('billing_settings',{
 id:text('id').primaryKey().default('root'),enforced:boolean('enforced').notNull().default(false),pointsPerCharacter:integer('points_per_character').notNull().default(1),
 ttsCentsPerMillion:integer('tts_cents_per_million').notNull().default(0),cosCentsPerGB:integer('cos_cents_per_gb').notNull().default(0),cosCentsPer10kRequests:integer('cos_cents_per_10k_requests').notNull().default(0),cosStorageCentsPerGBMonth:integer('cos_storage_cents_per_gb_month').notNull().default(0),
},t=>[check('one_billing_settings',sql`${t.id} = 'root'`)]);
export const wallets=pgTable('wallets',{
 workspaceId:text('workspace_id').primaryKey(),balance:bigint('balance',{mode:'number'}).notNull().default(0),
},t=>[check('wallet_nonnegative',sql`${t.balance} >= 0`)]);
export const creditLedger=pgTable('credit_ledger',{
 id:text('id').primaryKey(),workspaceId:text('workspace_id').notNull(),actorId:text('actor_id').notNull(),kind:text('kind').notNull(),delta:bigint('delta',{mode:'number'}).notNull(),balanceAfter:bigint('balance_after',{mode:'number'}).notNull(),note:text('note').notNull(),createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),
},t=>[index('ledger_workspace_idx').on(t.workspaceId)]);
export const redemptionCodes=pgTable('redemption_codes',{
 id:text('id').primaryKey(),codeHash:text('code_hash').notNull().unique(),suffix:text('suffix').notNull(),points:bigint('points',{mode:'number'}).notNull(),createdBy:text('created_by').notNull(),createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),expiresAt:timestamp('expires_at',{withTimezone:true}).notNull(),revoked:boolean('revoked').notNull().default(false),redeemedBy:text('redeemed_by'),redeemedWorkspace:text('redeemed_workspace'),redeemedAt:timestamp('redeemed_at',{withTimezone:true}),
});
export const usageEvents=pgTable('usage_events',{
 id:text('id').primaryKey(),workspaceId:text('workspace_id').notNull(),actorId:text('actor_id').notNull(),kind:text('kind').notNull(),term:text('term').notNull().default(''),characters:integer('characters').notNull().default(0),ttsRequests:integer('tts_requests').notNull().default(0),cosRequests:integer('cos_requests').notNull().default(0),uploadedBytes:bigint('uploaded_bytes',{mode:'number'}).notNull().default(0),downloadBytes:bigint('download_bytes',{mode:'number'}).notNull().default(0),outcome:text('outcome').notNull().default('success'),createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),
},t=>[index('usage_workspace_time_idx').on(t.workspaceId,t.createdAt)]);
export const sessions = pgTable('sessions', {
  tokenHash: text('token_hash').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
}, t => [index('sessions_user_idx').on(t.userId)]);
export const requestLimits = pgTable('request_limits', {
  key: text('key').primaryKey(), count: integer('count').notNull(),
  resetAt: timestamp('reset_at', { withTimezone: true }).notNull(),
});
export const pronunciationAssets = pgTable('pronunciation_assets', {
  key: text('key').primaryKey(), objectKey: text('object_key').notNull(), status: text('status').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  byteSize:bigint('byte_size',{mode:'number'}).notNull().default(0),
});

export const classrooms = pgTable('classrooms', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull(),
  name: text('name').notNull(),
  major: text('major').notNull(),
  createdAt: text('created_at').notNull(),
}, (table) => [index('classrooms_owner_idx').on(table.ownerId)]);

export const registrationWindows = pgTable('registration_windows', {
  id: text('id').primaryKey(), ownerId: text('owner_id').notNull(),
  classId: text('class_id').notNull().references(() => classrooms.id, { onDelete: 'cascade' }),
  code: text('code').notNull().unique(), enabled: boolean('enabled').notNull().default(true),
  opensAt: timestamp('opens_at', { withTimezone: true }).notNull(),
  closesAt: timestamp('closes_at', { withTimezone: true }).notNull(),
}, t => [index('registration_owner_idx').on(t.ownerId)]);

export const students = pgTable('students', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull(),
  classId: text('class_id').notNull().references(() => classrooms.id, { onDelete: 'cascade' }),
  userId: text('user_id'),
  name: text('name').notNull(),
  number: text('number').notNull(),
}, (table) => [
  uniqueIndex('students_class_number_unique').on(table.classId, table.number),
  index('students_owner_idx').on(table.ownerId),
]);

export const wordbooks = pgTable('wordbooks', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  color: text('color').notNull(),
}, (table) => [index('wordbooks_owner_idx').on(table.ownerId)]);

export const words = pgTable('words', {
  id: text('id').primaryKey(),
  bookId: text('book_id').notNull().references(() => wordbooks.id, { onDelete: 'cascade' }),
  english: text('english').notNull(),
  phonetic: text('phonetic').notNull(),
  pos: text('pos').notNull(),
  meaning: text('meaning').notNull(),
  example: text('example').notNull(),
}, (table) => [index('words_book_idx').on(table.bookId)]);

export const tasks = pgTable('tasks', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull(),
  name: text('name').notNull(),
  bookId: text('book_id').notNull().references(() => wordbooks.id),
  classId: text('class_id').notNull().references(() => classrooms.id),
  startAt: text('start_at').notNull(),
  deadline: text('deadline').notNull(),
  status: text('status').notNull(),
  wordSnapshot: text('word_snapshot').notNull(),
  rulesSnapshot: text('rules_snapshot').notNull(),
  createdAt: text('created_at').notNull(),
}, (table) => [index('tasks_owner_idx').on(table.ownerId)]);

export const learning = pgTable('learning', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull(),
  taskId: text('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  studentId: text('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
  position: integer('position').notNull().default(0),
  ratings: text('ratings').notNull().default('{}'),
  activeSeconds: integer('active_seconds').notNull().default(0),
  startedAt: text('started_at'),
  lastSeenAt: text('last_seen_at'),
  firstCompletedAt: text('first_completed_at'),
}, (table) => [
  uniqueIndex('learning_student_task_unique').on(table.taskId, table.studentId),
  index('learning_owner_idx').on(table.ownerId),
]);

export const attempts = pgTable('attempts', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull(),
  taskId: text('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  studentId: text('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
  answers: text('answers').notNull(),
  correct: integer('correct').notNull(),
  total: integer('total').notNull(),
  completedAt: text('completed_at').notNull(),
  practice: integer('practice').notNull().default(0),
}, (table) => [index('attempts_owner_idx').on(table.ownerId)]);

// Independent of tasks so archiving assignments cannot erase personal statistics.
export const studyProfiles = pgTable('study_profiles', {
  studentId: text('student_id').primaryKey().references(() => students.id, { onDelete: 'cascade' }),
  ownerId: text('owner_id').notNull(),
  baseline: text('baseline').notNull(),
  startedAt: text('started_at').notNull(),
  lastActivityAt: text('last_activity_at'),
});
export const studyEvents = pgTable('study_events', {
  id: text('id').primaryKey(),
  studentId: text('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
  ownerId: text('owner_id').notNull(),
  eventKey: text('event_key').notNull(),
  taskId: text('task_id'),
  day: text('day').notNull(),
  kind: text('kind').notNull(),
  terms: text('terms').notNull().default('[]'),
  activeSeconds: integer('active_seconds').notNull().default(0),
  createdAt: text('created_at').notNull(),
}, t => [uniqueIndex('study_event_student_key').on(t.studentId,t.eventKey),index('study_student_day_idx').on(t.studentId,t.day)]);
