import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { config } from 'dotenv';
import postgres from 'postgres';
import type { Workspace,Word } from '../lib/types';
import { studentRequirements,workspaceRequirements } from '../lib/task-requirements';
config({path:'.env.local',quiet:true});
const f=JSON.parse(await readFile('outputs/student-ui-fixture.json','utf8'));if(!/^ui-[a-f0-9-]{36}$/.test(f.workspace))throw Error('仅允许隔离测试空间');
const db=postgres(process.env.DATABASE_URL!,{max:1,prepare:false}),origin='http://localhost:3000';
async function request(body:unknown,cookie?:string,path='/api/workspace'){return fetch(origin+path,{method:'POST',headers:{origin,'content-type':'application/json',...(cookie?{cookie}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(60000)})}
async function login(username:string){const r=await request({username,password:f.password},undefined,'/api/auth/login');assert.equal(r.status,200);return r.headers.get('set-cookie')!.split(';')[0]}
try{
 const bookA=f.words[0].bookId,bookB=randomUUID(),empty=randomUUID();const [student]=await db`select class_id from students where id=${f.studentId} and owner_id=${f.workspace}`;
 await db`update wordbooks set name='乱序版' where id=${bookA} and owner_id=${f.workspace}`;
 await db`insert into wordbooks(id,owner_id,name,description,color) values(${bookB},${f.workspace},'音序版','','blue'),(${empty},${f.workspace},'空词库','','green')`;
 for(const [i,word]of ([...f.words] as Word[]).sort((a,b)=>a.english.localeCompare(b.english)).entries())await db`insert into words(id,book_id,english,phonetic,pos,meaning,example,sort_order) values(${randomUUID()},${bookB},${word.english},${word.phonetic},${word.pos},${word.meaning},${word.example},${i+1})`;
 await db`delete from tasks where id=${f.task} and owner_id=${f.workspace}`;
 const tc=await login(f.username+'-teacher'),sc=await login(f.username),day=new Date(Date.now()+8*3600000).toISOString().slice(0,10);
 const plan={action:'batchPlan',planId:randomUUID(),name:'每日任选词汇',bookId:bookA,alternativeBookId:bookB,classId:student.class_id,startAt:new Date(`${day}T00:00:00+08:00`).toISOString(),dailyDeadline:'23:59',batchSize:2,batchesPerDay:2,types:['meaning'],passing:80,repeat:true};
 const published=await request(plan,tc);assert.equal(published.status,200);let data=await published.json() as Workspace;
 assert.equal(data.tasks.length,4);assert.equal(studentRequirements(data,data.tasks,f.studentId).total,1);
 assert.equal(new Set(data.tasks.map(t=>JSON.parse(t.rulesSnapshot).batch.choiceGroupId)).size,1);
 const repeat=await request(plan,tc);assert.equal(repeat.status,200);assert.equal((await repeat.json() as Workspace).tasks.length,4);
 assert.equal((await request(plan,sc)).status,403);
 assert.equal((await request({...plan,planId:randomUUID(),alternativeBookId:bookA},tc)).status,400);
 assert.equal((await request({...plan,planId:randomUUID(),alternativeBookId:'foreign-book'},tc)).status,400);
 assert.equal((await request({...plan,planId:randomUUID(),alternativeBookId:empty},tc)).status,400);
 assert.equal((await db`select id from tasks where owner_id=${f.workspace}`).length,4,'empty alternative rolls back both options');
 const a=data.tasks.filter(t=>t.bookId===bookA),b=data.tasks.filter(t=>t.bookId===bookB);
 async function complete(task:typeof data.tasks[number]){const words=JSON.parse(task.wordSnapshot) as Word[];const response=await request({action:'attempt',id:randomUUID(),taskId:task.id,studentId:f.studentId,answers:words.map(word=>({wordId:word.id,type:'meaning',answer:word.meaning}))},sc);assert.equal(response.status,200);data=await response.json() as Workspace}
 await complete(a[0]);assert.equal(studentRequirements(data,data.tasks,f.studentId).completed,0);
 await complete(b[0]);assert.equal(studentRequirements(data,data.tasks,f.studentId).completed,0,'half of each option does not pass');
 await complete(a[1]);assert.equal(studentRequirements(data,data.tasks,f.studentId).completed,1);assert.deepEqual(workspaceRequirements(data),{total:1,completed:1});
 assert.equal(data.learning.filter(l=>l.firstCompletedAt).length,3,'actual optional progress remains independent');
 console.log('通过：双词库同组原子发布、重复发布幂等、完整一套完成日要求、半套混学不算完成、独立选学记录、权限/重复词库/外部词库拒绝、空备选回滚。隔离数据保留供浏览器验收后清理。');
}finally{await db.end({timeout:5})}
