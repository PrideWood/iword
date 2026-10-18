import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { config } from 'dotenv';
import postgres from 'postgres';
import type { Workspace,Word } from '../lib/types';
import { fixedWordOrder } from '../lib/fixed-word-order';
config({path:'.env.local',quiet:true});
const f=JSON.parse(await readFile('outputs/student-ui-fixture.json','utf8'));
if(!/^ui-[a-f0-9-]{36}$/.test(f.workspace))throw Error('仅允许隔离测试空间');
const db=postgres(process.env.DATABASE_URL!,{max:1,prepare:false}),origin='http://localhost:3000';
async function request(body:unknown,cookie?:string,path='/api/workspace'){return fetch(origin+path,{method:'POST',headers:{origin,'content-type':'application/json',...(cookie?{cookie}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(60000)})}
async function login(username:string){const r=await request({username,password:f.password},undefined,'/api/auth/login');assert.equal(r.status,200);return r.headers.get('set-cookie')!.split(';')[0]}
try{
 const tc=await login(f.username+'-teacher'),sc=await login(f.username),bookId=f.words[0].bookId;
 const [student]=await db`select class_id from students where id=${f.studentId} and owner_id=${f.workspace}`;
 const plan={action:'batchPlan',planId:randomUUID(),name:'固定乱序验收',bookId,classId:student.class_id,startAt:'2020-01-01T00:00:00Z',dailyDeadline:'23:59',batchSize:2,batchesPerDay:2,types:['meaning'],passing:80,repeat:true};
 const published=await request(plan,tc);assert.equal(published.status,200);const data=await published.json() as Workspace;
 const tasks=data.tasks.filter(t=>t.id.startsWith(plan.planId)).sort((a,b)=>a.id.localeCompare(b.id));assert.equal(tasks.length,2);
 assert.deepEqual(tasks.flatMap(t=>(JSON.parse(t.wordSnapshot) as Word[]).map(w=>w.id)),fixedWordOrder(f.words).map(w=>w.id));
 assert.ok(tasks.every(t=>!JSON.parse(t.rulesSnapshot).batch.choiceGroupId));
 const repeated=await request(plan,tc);assert.equal(repeated.status,200);assert.equal((await repeated.json() as Workspace).tasks.length,data.tasks.length);
 assert.equal((await request({...plan,planId:randomUUID(),alternativeBookId:'anything'},tc)).status,400);
 const second=await request({...plan,planId:randomUUID()},tc);assert.equal(second.status,200);const secondData=await second.json() as Workspace;
 assert.deepEqual(secondData.tasks.filter(t=>!data.tasks.some(old=>old.id===t.id)).sort((a,b)=>a.id.localeCompare(b.id)).map(t=>t.wordSnapshot),tasks.map(t=>t.wordSnapshot));
 assert.equal((await request({action:'deleteBook',id:bookId},sc)).status,403);
 const foreign=randomUUID();await db`insert into wordbooks(id,owner_id,name,description,color) values(${foreign},${'foreign-'+f.workspace},'外部词库','','green')`;
 try{assert.equal((await request({action:'deleteBook',id:foreign},tc)).status,400);const [kept]=await db`select deleted from wordbooks where id=${foreign}`;assert.equal(kept.deleted,false)}finally{await db`delete from wordbooks where id=${foreign} and owner_id=${'foreign-'+f.workspace}`}
 const deleted=await request({action:'deleteBook',id:bookId},tc);assert.equal(deleted.status,200);const after=await deleted.json() as Workspace;
 assert.ok(!after.books.some(b=>b.id===bookId));assert.ok(!after.words.some(w=>w.bookId===bookId));
 assert.deepEqual(after.tasks.map(t=>[t.id,t.wordSnapshot]),secondData.tasks.map(t=>[t.id,t.wordSnapshot]));
 const [stored]=await db`select deleted from wordbooks where id=${bookId} and owner_id=${f.workspace}`;assert.equal(stored.deleted,true);
 assert.equal((await db`select id from words where book_id=${bookId}`).length,f.words.length);
 assert.equal((await request({...plan,planId:randomUUID()},tc)).status,400);
 assert.equal((await request({action:'words',bookId,words:[{english:'new',meaning:'新'}]},tc)).status,400);
 const word=(JSON.parse(tasks[0].wordSnapshot) as Word[])[0];
 const progress=await request({action:'progress',taskId:tasks[0].id,studentId:f.studentId,position:1,wordId:word.id,rating:'known',eventId:randomUUID()},sc);assert.equal(progress.status,200);
 const attempt=await request({action:'attempt',id:randomUUID(),taskId:tasks[0].id,studentId:f.studentId,answers:(JSON.parse(tasks[0].wordSnapshot) as Word[]).map(w=>({wordId:w.id,type:'meaning',answer:w.meaning}))},sc);
 assert.equal(attempt.status,200);const learned=await attempt.json() as Workspace;assert.ok(learned.learning.some(l=>l.taskId===tasks[0].id&&l.firstCompletedAt));assert.equal(learned.attempts.length,1);
 const task=tasks[0];assert.equal((await request({action:'task',id:task.id,name:task.name,bookId,classId:task.classId,startAt:task.startAt,deadline:task.deadline,types:['meaning'],passing:80,repeat:true},tc)).status,200);
 console.log('通过：固定乱序跨计划一致/幂等、双方案拒绝、词库删除权限隔离/隐藏/保留词汇与任务快照、删除后继续学习测评及编辑任务。');
}finally{await db.end({timeout:5})}
