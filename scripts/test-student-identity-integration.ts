import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {config} from 'dotenv';
import postgres from 'postgres';
config({path:'.env.local',quiet:true});config({quiet:true});
const {hashPassword}=await import('../lib/password');
const {generateRegistrationCode}=await import('../lib/registration-code-server');
const sql=postgres(process.env.DATABASE_URL!,{max:1,prepare:false}),origin=process.env.TEST_ORIGIN||'http://localhost:3000';
const prefix='identity-'+randomUUID(),owner=prefix+'-t',other=prefix+'-o',room=randomUUID(),secondRoom=randomUUID(),code=generateRegistrationCode(),secondCode=generateRegistrationCode();
const teacherPassword='Test-'+randomUUID(),password=randomBytes(3).toString('hex'),suffix=prefix.slice(-8),name='测试甲'+suffix,email='test-'+suffix+'@example.com',crossName='同名乙'+suffix;
async function req(path:string,body?:unknown,cookie?:string,from=origin){return fetch(origin+path,{method:body===undefined?'GET':'POST',headers:{...(cookie?{cookie}:{}),...(body===undefined?{}:{origin:from,'content-type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body),redirect:'manual'})}
async function login(username:string,pw=password,extra:Record<string,unknown>={}){const r=await req('/api/auth/login',{username,password:pw,...extra});assert.equal(r.status,200,await r.clone().text());return r.headers.get('set-cookie')!.split(';')[0]}
const nameLogin=(username:string,classCode?:string)=>({username,password,role:'student',method:'name',...(classCode?{classCode}:{})});
try{
 const hash=await hashPassword(teacherPassword);
 for(const id of [owner,other])await sql`insert into users (id,username,password_hash,name,role,workspace_id) values (${id},${id},${hash},'身份隔离测试教师','teacher',${id})`;
 for(const [id,c]of [[room,code],[secondRoom,secondCode]]){
  await sql`insert into classrooms (id,owner_id,name,major,created_at) values (${id},${owner},'身份测试班','测试',${new Date().toISOString()})`;
  await sql`insert into registration_windows (id,owner_id,class_id,code,short_code,enabled,opens_at,closes_at) values (${randomUUID()},${owner},${id},${c},${c},true,'2020-01-01','2099-01-01')`;
 }
 const tc=await login(owner,teacherPassword,{role:'teacher'}),oc=await login(other,teacherPassword,{role:'teacher'});
 const signup={code,name,password};
 assert.equal((await req('/api/auth/register',{...signup,password:'12345'})).status,400);
 assert.equal((await req('/api/auth/register',{...signup,username:'invalid alias'})).status,400);
 assert.equal((await req('/api/auth/register',signup)).status,201,'name and six-character password alone register');
 const first=await login(name,password,{role:'student',method:'name'});
 assert.equal((await req('/api/auth/register',signup)).status,201,'same-class same-name students are separate, not merged');
 const duplicate=await req('/api/auth/login',nameLogin(name));assert.equal(duplicate.status,409);assert.equal((await duplicate.json()).needsAlias,true);assert.equal(duplicate.headers.get('set-cookie'),null);
 const rows=await sql`select s.id,s.user_id,u.username from students s join users u on u.id=s.user_id where s.owner_id=${owner} and s.name=${name} order by s.id`;
 assert.equal(rows.length,2);assert.notEqual(rows[0].user_id,rows[1].user_id);assert.ok(rows.every(r=>r.username.startsWith('~student:')));
 const studentId=rows[0].id,alias='qa-'+suffix+'-a';
 assert.equal((await req('/api/auth/accounts?studentId='+studentId,undefined,oc)).status,404);assert.equal((await req('/api/auth/accounts?studentId='+studentId,undefined,first)).status,403);
 assert.equal((await req('/api/auth/accounts',{studentId,username:alias},oc)).status,404);
 assert.equal((await req('/api/auth/accounts',{studentId,username:alias},tc,'https://invalid.example')).status,403);
 assert.equal((await req('/api/auth/accounts',{studentId,username:alias},tc)).status,200,'teacher changes alias without resetting password');
 let sc=await login(alias,password,{role:'student',method:'account'});
 assert.equal((await (await req('/api/workspace',undefined,sc)).json()).students[0].id,studentId);
 assert.equal((await req('/api/auth/accounts',{studentId,username:alias,password:'654321'},tc)).status,200);
 assert.equal((await req('/api/workspace',undefined,sc)).status,401,'teacher reset revokes sessions');
 sc=await login(alias,'654321',{role:'student',method:'account'});
 assert.equal((await req('/api/auth/password',{currentPassword:'654321',password:'123456'},sc)).status,200);
 assert.equal((await req('/api/workspace',undefined,sc)).status,401);await login(alias,'123456',{role:'student',method:'account'});
 assert.equal((await req('/api/auth/password',{currentPassword:teacherPassword,password:'123456'},tc)).status,400,'teacher minimum stays 12');
 assert.equal((await req('/api/auth/register',{...signup,name:'邮箱学生'+suffix,username:email,number:'007'})).status,201);
 await login(email.toUpperCase(),password,{role:'student',method:'account'});
 assert.equal((await req('/api/workspace',{action:'student',id:studentId,classId:room,name,number:'007'},tc)).status,400,'non-empty student numbers remain unique');
 for(const c of [code,secondCode])assert.equal((await req('/api/auth/register',{...signup,code:c,name:crossName})).status,201);
 const cross=await req('/api/auth/login',nameLogin(crossName));assert.equal(cross.status,409);assert.equal((await cross.json()).needsClassCode,true);
 const selected=await login(crossName,password,{role:'student',method:'name',classCode:secondCode});
 assert.equal((await (await req('/api/workspace',undefined,selected)).json()).students[0].classId,secondRoom);
 await sql`update registration_windows set enabled=false where class_id=${secondRoom}`;
 await login(crossName,password,{role:'student',method:'name',classCode:secondCode.toLowerCase()});
 assert.equal((await req('/api/auth/register',{...signup,code:secondCode,name:'关闭后测试'})).status,403,'closed registration does not prevent existing students logging in');
 const before=await sql`select count(*)::int as n from students where owner_id=${owner}`;
 assert.equal((await req('/api/workspace',{action:'student',classId:room,name:'教师添加'+suffix},tc)).status,200);
 const manual=await sql`select id from students where owner_id=${owner} and name=${'教师添加'+suffix}`;
 assert.equal((await req('/api/auth/accounts',{studentId:manual[0].id,password},tc)).status,200);await login('教师添加'+suffix,password,{role:'student',method:'name'});
 assert.equal((await sql`select count(*)::int as n from students where owner_id=${owner} and number=''`)[0].n,before[0].n,'multiple omitted numbers stay blank without collision');
 await sql`update users set disabled=true where id=${rows[0].user_id}`;
 assert.equal((await req('/api/auth/login',{username:alias,password:'123456',role:'student',method:'account'})).status,401);
 console.log('通过：姓名/六位密码注册、学号/账号可省略、邮箱账号、同班重名拒绝误选、跨班重名按注册码定位、教师设置别名/重置密码、会话撤销、空学号并存、非空学号唯一、权限隔离和停用拒绝。');
}finally{
 await sql`delete from students where owner_id=${owner}`;await sql`delete from classrooms where owner_id=${owner}`;
 await sql`delete from users where workspace_id in (${owner},${other})`;await sql.end({timeout:5});
}
