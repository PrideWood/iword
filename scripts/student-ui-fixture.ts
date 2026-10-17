import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { config } from 'dotenv';
import postgres from 'postgres';
import { hashPassword } from '../lib/password';
import { makeSeed } from '../lib/seed';
config({path:'.env.local',quiet:true});config({quiet:true});
const sql=postgres(process.env.DATABASE_URL!,{prepare:false,max:1});
const file='outputs/student-ui-fixture.json';
try{
 if(process.argv.includes('--cleanup')){
  const fixture=JSON.parse(await readFile(file,'utf8')) as {workspace:string};
  if(!/^ui-[a-f0-9-]{36}$/.test(fixture.workspace))throw Error('测试工作空间格式无效');
  const owner=fixture.workspace;
  await sql`delete from attempts where owner_id=${owner}`;
  await sql`delete from learning where owner_id=${owner}`;
  await sql`delete from tasks where owner_id=${owner}`;
  await sql`delete from words where book_id in (select id from wordbooks where owner_id=${owner})`;
  await sql`delete from wordbooks where owner_id=${owner}`;
  await sql`delete from students where owner_id=${owner}`;
  await sql`delete from classrooms where owner_id=${owner}`;
  await sql`delete from users where workspace_id=${owner}`;
  await unlink(file);console.log('学生界面测试账号及数据已清理。');
 }else{
  const workspace='ui-'+randomUUID(),userId=randomUUID(),room=randomUUID(),book=randomUUID(),task=randomUUID(),studentId=randomUUID();
  const username=workspace,password=randomBytes(24).toString('base64url');
  const words=makeSeed('ui-fixture').words.slice(0,4).map(w=>({...w,id:randomUUID(),bookId:book}));
  const hash=await hashPassword(password);
  await sql.begin(async tx=>{
   await tx`insert into users (id,username,password_hash,name,role,workspace_id) values (${userId},${username},${hash},'测试学生','student',${workspace})`;
   await tx`insert into users (id,username,password_hash,name,role,workspace_id) values (${randomUUID()},${username+'-teacher'},${hash},'测试教师','teacher',${workspace})`;
   await tx`insert into classrooms (id,owner_id,name,major,created_at) values (${room},${workspace},'界面测试班','测试',${new Date().toISOString()})`;
   await tx`insert into students (id,owner_id,class_id,user_id,name,number) values (${studentId},${workspace},${room},${userId},'测试学生','TEST001')`;
   await tx`insert into wordbooks (id,owner_id,name,description,color) values (${book},${workspace},'测试词库','','green')`;
   for(const w of words)await tx`insert into words (id,book_id,english,phonetic,pos,meaning,example) values (${w.id},${book},${w.english},${w.phonetic},${w.pos},${w.meaning},${w.example})`;
   await tx`insert into tasks (id,owner_id,name,book_id,class_id,start_at,deadline,status,word_snapshot,rules_snapshot,created_at) values (${task},${workspace},'今日词汇',${book},${room},'2020-01-01T00:00:00.000Z','2099-01-01T00:00:00.000Z','published',${JSON.stringify(words)},${JSON.stringify({types:['meaning','spelling','listening'],passing:80,repeat:true})},${new Date().toISOString()})`;
  });
  await mkdir('outputs',{recursive:true});await writeFile(file,JSON.stringify({workspace,username,password,task,studentId,words}),{mode:0o600,flag:'wx'});
  console.log('独立界面测试账号已创建，凭据仅保存至忽略目录 outputs。');
 }
}finally{await sql.end({timeout:5})}
