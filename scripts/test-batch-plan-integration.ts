import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { fixedWordOrder } from '../lib/fixed-word-order';
import { config } from 'dotenv';
import postgres from 'postgres';
import type { Workspace,Word } from '../lib/types';
config({path:'.env.local',quiet:true});
const fixture=JSON.parse(await readFile('outputs/student-ui-fixture.json','utf8'));
if(!/^ui-[a-f0-9-]{36}$/.test(fixture.workspace))throw Error('仅允许隔离 UI 测试空间');
const db=postgres(process.env.DATABASE_URL!,{max:1,prepare:false}),origin='http://localhost:3000';
async function request(body:unknown,cookie?:string,path='/api/workspace'){
 return fetch(origin+path,{method:'POST',headers:{origin,'content-type':'application/json',...(cookie?{cookie}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(60000)});
}
async function login(username:string){const response=await request({username,password:fixture.password},undefined,'/api/auth/login');assert.equal(response.status,200);return response.headers.get('set-cookie')!.split(';')[0]}
try{
 const [student]=await db`select class_id from students where id=${fixture.studentId} and owner_id=${fixture.workspace}`;
 await db`delete from tasks where id=${fixture.task} and owner_id=${fixture.workspace}`;
 const teacherCookie=await login(fixture.username+'-teacher'),studentCookie=await login(fixture.username);
 const bookId=fixture.words[0].bookId;
 const words=Array.from({length:99},(_,i)=>({english:`batchword${String(i+1).padStart(3,'0')}`,meaning:`测试词${i+1}`}));
 const imported=await request({action:'words',bookId,words},teacherCookie);assert.equal(imported.status,200);const importedData=await imported.json() as Workspace;
 assert.equal(importedData.words.length,103);assert.deepEqual(importedData.words.filter(w=>w.sortOrder).map(w=>w.english),words.map(w=>w.english));
 const day=new Date(Date.now()+8*3600000).toISOString().slice(0,10),startAt=new Date(`${day}T00:00:00+08:00`).toISOString();
 const plan={action:'batchPlan',planId:randomUUID(),name:'每日词汇计划',bookId,classId:student.class_id,startAt,dailyDeadline:'23:59',batchSize:10,batchesPerDay:5,types:['meaning'],passing:80,repeat:true};
 const published=await request(plan,teacherCookie);assert.equal(published.status,200);const data=await published.json() as Workspace;
 const batches=data.tasks.sort((a,b)=>JSON.parse(a.rulesSnapshot).batch.index-JSON.parse(b.rulesSnapshot).batch.index);
 assert.equal(batches.length,11);assert.deepEqual(batches.map(t=>(JSON.parse(t.wordSnapshot) as Word[]).length),[10,10,10,10,10,10,10,10,10,10,3]);
 assert.equal(batches.filter(t=>t.startAt<=new Date().toISOString()).length,5);
 assert.deepEqual(batches.flatMap(t=>(JSON.parse(t.wordSnapshot) as Word[]).map(w=>w.id)),fixedWordOrder(importedData.words).map(w=>w.id));
 const repeated=await request(plan,teacherCookie);assert.equal(repeated.status,200);assert.equal((await repeated.json() as Workspace).tasks.length,11);
 assert.equal((await request(plan,studentCookie)).status,403);
 assert.equal((await request({...plan,planId:randomUUID(),batchSize:11},teacherCookie)).status,400);
 assert.equal((await request({...plan,planId:randomUUID(),classId:'outside-workspace'},teacherCookie)).status,400);
 const last=batches.at(-1)!;
 assert.equal((await request({action:'task',id:last.id,name:last.name,bookId,classId:student.class_id,startAt:last.startAt,deadline:last.deadline,types:['meaning'],passing:80,repeat:true,refreshWords:true},teacherCookie)).status,400);
 const futureWord=(JSON.parse(batches[5].wordSnapshot) as Word[])[0];
 assert.equal((await request({action:'progress',taskId:batches[5].id,studentId:fixture.studentId,position:1,wordId:futureWord.id,rating:'known',eventId:randomUUID()},studentCookie)).status,200);
 console.log('通过：真实导入顺序、103词11批/5批每天、每批上限/尾批、重复发布幂等、学生发布拒绝、跨空间拒绝、批次整本替换拒绝和未来批次提前学习。隔离数据保留供页面验收，随后由 student-ui-fixture --cleanup 清理。');
}finally{await db.end({timeout:5})}
