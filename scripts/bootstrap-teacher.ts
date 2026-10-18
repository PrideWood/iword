import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { config } from 'dotenv';
import { and, eq } from 'drizzle-orm';
import { hashPassword } from '../lib/password';
config({path:'.env.local',quiet:true}); config({quiet:true});
const {getDb,closeDatabase}=await import('../db');
const {users,platformAdmin}=await import('../db/schema');
const workspaceId=process.env.DEV_USER_ID?.trim()||'local-preview-teacher';
try{
 const existing=await getDb().select({id:users.id}).from(users).where(and(eq(users.role,'teacher'),eq(users.workspaceId,workspaceId))).limit(1);
 if(existing.length){console.log('教师账号已存在，不重复创建或更改密码。');}
 else{
  const username=process.env.BOOTSTRAP_TEACHER_USERNAME||'teacher';
  const password=randomBytes(24).toString('base64url');
  await getDb().insert(users).values({id:randomUUID(),username,passwordHash:await hashPassword(password),name:'我的课堂教师',role:'teacher',workspaceId});
  await mkdir('outputs',{recursive:true});
  await writeFile('outputs/teacher-login.txt',`教师登录账号：${username}\n初始密码：${password}\n登录后请在教师账户面板修改密码。\n`,{mode:0o600,flag:'wx'});
  console.log('教师账号已创建并关联现有课堂。初始凭据保存在 outputs/teacher-login.txt（不提交 Git）。');
 }
 const [admin]=await getDb().select({id:users.id}).from(users).where(and(eq(users.username,'teacher'),eq(users.role,'teacher'))).limit(1);
 if(admin)await getDb().insert(platformAdmin).values({id:'root',userId:admin.id}).onConflictDoNothing();
}finally{await closeDatabase()}
