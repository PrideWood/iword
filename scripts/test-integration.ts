import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { config } from 'dotenv';
import postgres from 'postgres';
import { hashPassword } from '../lib/password';
config({path:'.env.local',quiet:true});config({quiet:true});
const origin=process.env.TEST_ORIGIN||'http://localhost:3000';
const sql=postgres(process.env.DATABASE_URL!,{max:2,prepare:false});
const prefix=`qa-${randomUUID()}`;
const teacher=`${prefix}-teacher`,other=`${prefix}-other`,student=`${prefix}-student`,peer=`${prefix}-peer`;
const password=`Test-${randomUUID()}!`;
const room=`${prefix}-class`,book=`${prefix}-book`,task=`${prefix}-task`,word=`${prefix}-word`,missingWord=`${prefix}-missing`;
const studentId=`${prefix}-roster`,peerId=`${prefix}-peer-roster`;
async function request(path:string,body?:unknown,cookie?:string,customOrigin=origin){
 return fetch(origin+path,{method:body===undefined?'GET':'POST',headers:{...(body===undefined?{}:{'content-type':'application/json',origin:customOrigin}),...(cookie?{cookie}:{})},body:body===undefined?undefined:JSON.stringify(body),redirect:'manual'});
}
async function login(username:string){const r=await request('/api/auth/login',{username,password});assert.equal(r.status,200,'login succeeds');const cookie=r.headers.get('set-cookie')?.split(';')[0];assert.ok(cookie);assert.match(r.headers.get('set-cookie')!,/HttpOnly/i);return cookie}
try{
 const hash=await hashPassword(password);
 for(const [id,role,workspace]of [[teacher,'teacher',teacher],[other,'teacher',other],[student,'student',teacher],[peer,'student',teacher]]){
  await sql`insert into users (id,username,password_hash,name,role,workspace_id) values (${id},${id},${hash},'测试账号',${role},${workspace})`;
 }
 await sql`insert into classrooms (id,owner_id,name,major,created_at) values (${room},${teacher},'测试班级','测试',${new Date().toISOString()})`;
 await sql`insert into wordbooks (id,owner_id,name,description,color) values (${book},${teacher},'测试词库','','green')`;
 await sql`insert into students (id,owner_id,class_id,user_id,name,number) values (${studentId},${teacher},${room},${student},'学生甲','001'),(${peerId},${teacher},${room},${peer},'学生乙','002')`;
 for(const [id,english]of [[word,'network'],[missingWord,'classroom']])await sql`insert into words (id,book_id,english,phonetic,pos,meaning,example) values (${id},${book},${english},'','n.','测试释义','')`;
 const snapshot=JSON.stringify([{id:word,bookId:book,english:'network',phonetic:'',pos:'n.',meaning:'网络',example:''}]);
 await sql`insert into tasks (id,owner_id,name,book_id,class_id,start_at,deadline,status,word_snapshot,rules_snapshot,created_at) values (${task},${teacher},'测试任务',${book},${room},'2020-01-01T00:00:00.000Z','2099-01-01T00:00:00.000Z','published',${snapshot},${JSON.stringify({types:['meaning'],passing:80,repeat:true})},${new Date().toISOString()})`;
 assert.equal((await request('/api/workspace')).status,401);
 assert.equal((await request('/api/pronunciation',{text:'network'})).status,401);
 assert.equal((await request('/api/auth/login',{username:teacher,password:'incorrect'})).status,401);
 const tc=await login(teacher),sc=await login(student),oc=await login(other);console.log('登录与 Cookie 检查通过');
 const td=await (await request('/api/workspace',undefined,tc)).json();assert.equal(td.students.length,2);assert.equal(td.words.length,2);
 const sd=await (await request('/api/workspace',undefined,sc)).json();assert.equal(sd.students.length,1);assert.equal(sd.students[0].id,studentId);assert.equal(sd.books.length,0);assert.equal(sd.words.length,0);assert.equal(sd.tasks.length,1);
 const od=await (await request('/api/workspace',undefined,oc)).json();assert.equal(od.classes.length,0);assert.equal(od.tasks.length,0);
 for(const body of [{action:'class',name:'越权',major:'测试'},{action:'words',bookId:book,words:[]},{action:'heartbeat',taskId:task,studentId:peerId}])assert.equal((await request('/api/workspace',body,sc)).status,403);
 assert.equal((await request('/api/export',undefined,sc)).status,401);
 assert.equal((await request('/api/auth/accounts',{studentId,username:student,password},sc)).status,403);
 assert.equal((await request('/api/auth/accounts',{studentId,username:student,password},oc)).status,404);
 assert.equal((await request('/api/workspace',{action:'class',name:'跨域',major:'测试'},tc,'https://invalid.example')).status,403);
 assert.equal((await request('/api/pronunciation',{text:'forbidden'},sc)).status,403);
 const progress=await request('/api/workspace',{action:'progress',taskId:task,studentId,wordId:word,position:1,rating:'known',eventId:randomUUID()},sc);assert.equal(progress.status,200);assert.equal((await progress.json()).learning[0].position,1);
 const attempt=await request('/api/workspace',{action:'attempt',id:randomUUID(),taskId:task,studentId,answers:[{wordId:word,type:'meaning',answer:'网络'}]},sc);assert.equal(attempt.status,200);assert.equal((await attempt.json()).attempts[0].correct,1);
 console.log('角色隔离、越权拒绝、进度与测评保存检查通过');
 const audio=await request('/api/pronunciation',{text:'network'},sc);assert.equal(audio.status,200);const {url}=await audio.json();const mp3=await fetch(url);assert.equal(mp3.status,200);assert.ok((await mp3.arrayBuffer()).byteLength>1000);
 // Concurrent requests for a missing word must converge on one durable COS object.
 const generated=await Promise.all([request('/api/pronunciation',{text:'classroom'},tc),request('/api/pronunciation',{text:'classroom'},tc)]);
 for(const response of generated)assert.equal(response.status,200,'missing pronunciation generates successfully');
 const manifest=await (await request('/api/pronunciation/manifest',undefined,sc)).json();assert.equal(manifest.schemaVersion,1);assert.ok(manifest.entries.some((entry:{term:string;src:string})=>entry.term==='network'&&entry.src.startsWith('https://')));assert.ok(!manifest.entries.some((entry:{term:string})=>entry.term==='classroom'));
 const reset=await request('/api/auth/accounts',{studentId,username:student,password},tc);assert.equal(reset.status,200);assert.equal((await request('/api/workspace',undefined,sc)).status,401);
 const fresh=await login(student);assert.equal((await request('/api/auth/logout',{},fresh)).status,200);assert.equal((await request('/api/workspace',undefined,fresh)).status,401);
 const change=await request('/api/auth/password',{currentPassword:password,password:password+'new'},tc);assert.equal(change.status,200);assert.equal((await request('/api/workspace',undefined,tc)).status,401);
 console.log('通过：教师/学生登录、匿名拒绝、跨教师隔离、学生最小数据、越权拒绝、跨域拒绝、进度/测评持久化、COS 播放、缺失音频并发生成、密码重置撤销会话、退出及修改密码。');
}finally{
 await sql`delete from attempts where owner_id=${teacher}`;
 await sql`delete from learning where owner_id=${teacher}`;
 await sql`delete from tasks where owner_id=${teacher}`;
 await sql`delete from words where book_id=${book}`;
 await sql`delete from wordbooks where owner_id=${teacher}`;
 await sql`delete from students where owner_id=${teacher}`;
 await sql`delete from classrooms where owner_id=${teacher}`;
 await sql`delete from users where id in (${teacher},${other},${student},${peer})`;
 await sql.end({timeout:5});
}
