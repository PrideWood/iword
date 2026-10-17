import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const [{ seedWorkspace }, { closeDatabase }] = await Promise.all([
  import('../lib/workspace'),
  import('../db'),
]);

const ownerId = process.env.DEV_USER_ID?.trim() || 'local-preview-teacher';
let created = false;
try {
  created = await seedWorkspace(ownerId);
} finally {
  await closeDatabase();
}

console.log(created ? `已为 ${ownerId} 写入示例数据。` : `${ownerId} 已有数据，未重复写入。`);
