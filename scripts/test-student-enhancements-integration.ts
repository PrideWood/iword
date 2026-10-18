import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { config } from 'dotenv';
import postgres from 'postgres';
import type { Word } from '../lib/types';
config({path:'.env.local',quiet:true});
const f=JSON.parse(await readFile('outputs/student-ui-fixture.json','utf8'));
if(!/^ui-[a-f0-9-]{36}$/.test(f.workspace))throw Error('仅允许隔离空间');
const db=postgres(process.env.DATABASE_URL!,{prepare:false,max:1}),origin='http://localhost:3000';
async function post(body:unknown,cookie?:string,path='/api/workspace'){return fetch(origin+path,{method:'POST',headers:{origin,'content-type':'application/json',...(cookie?{cookie}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(60000)})}
try{
 const login=await post({username:f.username,password:f.password},undefined,'/api/auth/login');assert.equal(login.status,200);const cookie=login.headers.get('set-cookie')!.split(';')[0];
 const future=f.task+'-future',ordinary=f.task+'-ordinary';
 const rules=JSON.stringify({types:['meaning'],passing:80,repeat:true,batch:{planId:randomUUID(),index:1,total:1,day:'2099-01-01',dayIndex:0,batchesPerDay:1,dayBatches:1}});
 for(const [id,r]of [[future,rules],[ordinary,'{"types":["meaning"],"passing":80,"repeat":true}']])await db`insert into tasks(id,owner_id,name,book_id,class_id,start_at,deadline,status,word_snapshot,rules_snapshot,created_at) select ${id},owner_id,${id===future?'未来批次':'未来普通任务'},book_id,class_id,'2099-01-01T00:00:00.000Z','2099-01-01T15:59:00.000Z',status,word_snapshot,${r},created_at from tasks where id=${f.task} and owner_id=${f.workspace}`;
 const word:Word=f.words[0],progress={action:'progress',taskId:future,studentId:f.studentId,position:1,wordId:word.id,rating:'known'};
 assert.equal((await post({...progress,taskId:ordinary,eventId:randomUUID()},cookie)).status,400);
 assert.equal((await post({...progress,eventId:randomUUID()},cookie)).status,200);
 assert.equal((await post({...progress,eventId:randomUUID()},cookie)).status,200);
 const review={action:'reviewWords',taskId:future,studentId:f.studentId,wordIds:[word.id],eventId:randomUUID()};
 assert.equal((await post(review,cookie)).status,200);assert.equal((await post(review,cookie)).status,200);
 assert.equal((await post({...review,eventId:randomUUID(),wordIds:[f.words[1].id]},cookie)).status,400);
 assert.equal((await post({...review,eventId:randomUUID(),studentId:'outside'},cookie)).status,403);
 let stats=await (await fetch(origin+'/api/student/stats',{headers:{cookie}})).json();assert.equal(stats.today.newWords,1);assert.equal(stats.today.reviewWords,1);assert.equal(stats.totals.masteredWords,1);
 const attempt={action:'attempt',taskId:future,studentId:f.studentId,answers:(f.words as Word[]).map(w=>({wordId:w.id,type:'meaning',answer:w.meaning}))};
 assert.equal((await post({...attempt,id:randomUUID()},cookie)).status,200);assert.equal((await post({...attempt,id:randomUUID()},cookie)).status,200);
 stats=await (await fetch(origin+'/api/student/stats',{headers:{cookie}})).json();assert.equal(stats.today.newWords,4);assert.equal(stats.today.reviewWords,4);
 assert.equal((await db`select id from study_events where student_id=${f.studentId} and event_key=${'review:'+review.eventId}`).length,1);
 console.log('通过：未来批次提前认词/测评、普通任务未开放拒绝、同日重复认词/复习/重测记录、复习按日去重/事件幂等、未学词及跨学生拒绝。');
}finally{await db.end({timeout:5})}
