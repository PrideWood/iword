import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import postgres from 'postgres';

loadEnv({ path: path.resolve('.env.local'), quiet: true });
loadEnv({ path: path.resolve('.env'), quiet: true });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL 未配置。');

const sql = postgres(connectionString, { prepare: false, max: 1 });
const testId = `connection-test-${randomUUID()}`;
const rollbackSignal = new Error('ROLLBACK_CONNECTION_TEST');

try {
  try {
    await sql.begin(async (transaction) => {
      await transaction`
        insert into classrooms (id, owner_id, name, major, created_at)
        values (${testId}, 'connection-test', '连接测试', '测试', ${new Date().toISOString()})
      `;
      const rows = await transaction`select id from classrooms where id = ${testId}`;
      if (rows.length !== 1) throw new Error('测试记录写入后无法读取。');
      throw rollbackSignal;
    });
  } catch (error) {
    if (error !== rollbackSignal) throw error;
  }

  const remaining = await sql`select id from classrooms where id = ${testId}`;
  if (remaining.length) throw new Error('测试事务未正确回滚。');

  const migrationFile = await readFile('drizzle/0000_large_frog_thor.sql', 'utf8');
  if (!migrationFile.trim()) throw new Error('数据库迁移文件为空。');

  console.log('数据库连接、事务写入和回滚检查通过。');
} finally {
  await sql.end({ timeout: 5 });
}
