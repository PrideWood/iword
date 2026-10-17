import { index, integer, pgTable, text, uniqueIndex, timestamp, boolean } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(), username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(), name: text('name').notNull(),
  role: text('role', { enum: ['teacher', 'student'] }).notNull(), workspaceId: text('workspace_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
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
