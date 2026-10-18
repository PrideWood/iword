// Synthetic chart data is restricted to the disposable UI fixture, never real students.
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { config } from 'dotenv';
import postgres from 'postgres';
import { studyDay } from '../lib/study-stats';
config({path:'.env.local',quiet:true});
const fixture=JSON.parse(await readFile('outputs/student-ui-fixture.json','utf8'));
if(!/^ui-[a-f0-9-]{36}$/.test(fixture.workspace))throw Error('仅支持隔离测试空间');
const sql=postgres(process.env.DATABASE_URL!,{max:1,prepare:false});
try{
 await sql.begin(async tx=>{
  const [student]=await tx`select id from students where id=${fixture.studentId} and owner_id=${fixture.workspace}`;
  if(!student)throw Error('测试学生不存在');
  const today=studyDay(),noon=Date.parse(today+'T12:00:00+08:00');
  await tx`insert into study_profiles (student_id,owner_id,baseline,started_at) values (${fixture.studentId},${fixture.workspace},${JSON.stringify({words:[],seconds:0})},${new Date(noon-29*86400000).toISOString()}) on conflict (student_id) do nothing`;
  for(let index=0;index<30;index++){
   if(index%5===3)continue;
   const at=new Date(noon-(29-index)*86400000),day=studyDay(at),key='fixture-'+day;
   // Today's synthetic event must not be timestamped in the future.
   const createdAt=index===29?new Date().toISOString():at.toISOString();
   const terms=fixture.words.slice(0,2+index%3).map((word:{english:string})=>({term:word.english,mastered:true}));
   await tx`insert into study_events (id,student_id,owner_id,event_key,task_id,day,kind,terms,active_seconds,created_at) values (${randomUUID()},${fixture.studentId},${fixture.workspace},${key},${fixture.task},${day},${index%4===1?'word':'quiz'},${JSON.stringify(terms)},${180+index%7*52},${createdAt}) on conflict (student_id,event_key) do nothing`;
  }
 });
 console.log('仅隔离测试学生已填充 30 天合成图表数据。');
}finally{await sql.end({timeout:5})}
