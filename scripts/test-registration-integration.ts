import assert from 'node:assert/strict';
import { randomBytes,randomUUID } from 'node:crypto';
import { config } from 'dotenv';
import postgres from 'postgres';
config({path:'.env.local',quiet:true});config({quiet:true});
const {shortenRegistrationWindow}=await import('../lib/registration-code-server');
const {closeDatabase}=await import('../db');
const {hashPassword}=await import('../lib/password');
const origin=process.env.TEST_ORIGIN||'http://localhost:3000',sql=postgres(process.env.DATABASE_URL!,{max:1,prepare:false});
const owner='reg-qa-'+randomUUID(),other='reg-qa-'+randomUUID(),room=randomUUID(),oldId=randomUUID(),oldCode=randomBytes(12).toString('hex'),password='Test-'+randomUUID();
async function request(path:string,body?:unknown,cookie?:string,from=origin){return fetch(origin+path,{method:body===undefined?'GET':'POST',headers:{...(cookie?{cookie}:{}),...(body===undefined?{}:{origin:from,'content-type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body),redirect:'manual'})}
async function login(username:string){const response=await request('/api/auth/login',{username,password});assert.equal(response.status,200);return response.headers.get('set-cookie')!.split(';')[0]}
try{
 const hash=await hashPassword(password);
 for(const id of [owner,other])await sql`insert into users (id,username,password_hash,name,role,workspace_id) values (${id},${id},${hash},'注册码隔离测试','teacher',${id})`;
 await sql`insert into classrooms (id,owner_id,name,major,created_at) values (${room},${owner},'短码测试班','测试',${new Date().toISOString()})`;
 await sql`insert into registration_windows (id,owner_id,class_id,code,enabled,opens_at,closes_at) values (${oldId},${owner},${room},${oldCode},true,'2020-01-01T00:00:00Z','2099-01-01T00:00:00Z')`;
 const tc=await login(owner),oc=await login(other);
 assert.equal((await request('/api/registration/windows')).status,401);
 assert.equal(await shortenRegistrationWindow(oldId,other),false,'cannot shorten another workspace');
 assert.equal(await shortenRegistrationWindow(oldId,owner),true);assert.equal(await shortenRegistrationWindow(oldId,owner),false,'shortening is idempotent');
 const [{short_code:shortCode,code:retainedCode}]=await sql`select short_code,code from registration_windows where id=${oldId}`;
 assert.match(shortCode,/^[A-Z0-9]{6}$/);assert.equal(retainedCode,oldCode);
 const list=await (await request('/api/registration/windows',undefined,tc)).json();assert.equal(list[0].code,shortCode);
 for(const code of [oldCode,oldCode.toUpperCase(),shortCode,shortCode.toLowerCase()]){const r=await request('/api/auth/register?code='+code);assert.equal(r.status,200);assert.equal((await r.json()).open,true)}
 assert.equal((await request('/api/auth/register?code=bad')).status,400);
 const signup={name:'测试学生',number:'001',username:owner+'-s1',password,code:shortCode.toLowerCase()};
 assert.equal((await request('/api/auth/register',signup)).status,201);
 assert.equal((await request('/api/auth/register',{...signup,number:'002',username:owner+'-s2',code:oldCode})).status,201,'old invite still registers in same class');
 const sc=await login(signup.username);
 const create={action:'create',classId:room,opensAt:'2020-01-01T00:00:00.000Z',closesAt:'2099-01-01T00:00:00.000Z'};
 assert.equal((await request('/api/registration/windows',create,sc)).status,403);assert.equal((await request('/api/registration/windows',create,oc)).status,404);
 assert.equal((await request('/api/registration/windows',create,tc,'https://invalid.example')).status,403);
 assert.equal((await request('/api/registration/windows',create,tc)).status,200);
 const current=(await (await request('/api/registration/windows',undefined,tc)).json()).find((w:{id:string})=>w.id!==oldId);
 assert.match(current.code,/^[A-Z0-9]{6}$/);assert.match(current.code,/[A-Z]/);assert.match(current.code,/[0-9]/);assert.equal(current.shortCode,current.code);
 assert.equal((await request('/api/auth/register',{...signup,number:'003',username:owner+'-s3',code:current.code.toLowerCase()})).status,201);
 await assert.rejects(sql`insert into registration_windows (id,owner_id,class_id,code,short_code,enabled,opens_at,closes_at) values (${randomUUID()},${owner},${room},${randomBytes(12).toString('hex')},${shortCode},true,'2020-01-01','2099-01-01')`,'short codes are globally unique');
 assert.equal((await request('/api/registration/windows',{action:'toggle',id:oldId,enabled:false},oc)).status,404);
 assert.equal((await request('/api/registration/windows',{action:'toggle',id:oldId,enabled:false},tc)).status,200);
 for(const code of [oldCode,shortCode]){const r=await request('/api/auth/register?code='+code);assert.equal((await r.json()).open,false);assert.equal((await request('/api/auth/register',{...signup,number:'004',username:owner+'-blocked',code})).status,403)}
 assert.equal((await request('/api/registration/windows',{action:'update',id:oldId,opensAt:'2098-01-01T00:00:00.000Z',closesAt:'2099-01-01T00:00:00.000Z'},tc)).status,200);
 assert.equal((await request('/api/registration/windows',{action:'toggle',id:oldId,enabled:true},tc)).status,200);
 assert.equal((await request('/api/auth/register',{...signup,number:'004',username:owner+'-future',code:shortCode})).status,403);
 console.log('通过：新旧入口六位展示、旧链接兼容、大小写注册、唯一约束、重复转换幂等、跨教师/学生/CSRF 拒绝、关闭及未到开放时段拒绝。');
}finally{
 await sql`delete from students where owner_id=${owner}`;
 await sql`delete from classrooms where owner_id=${owner}`;
 await sql`delete from users where workspace_id in (${owner},${other})`;
 await sql.end({timeout:5});await closeDatabase();
}
