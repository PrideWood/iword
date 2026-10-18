import { mkdir,writeFile } from 'node:fs/promises';
import { config } from 'dotenv';
import postgres from 'postgres';
import { makeSeed } from '../lib/seed';
config({path:'.env.local',quiet:true});config({quiet:true});
const db=postgres(process.env.DATABASE_URL!,{prepare:false,max:1});
try{
 await db.begin(async tx=>{
  const [admin]=await tx`select u.workspace_id from platform_admin a join users u on u.id=a.user_id where u.username='teacher'`;
  if(!admin)throw Error('未找到既有最高管理员');const owner=admin.workspace_id;
  const rooms=await tx`select * from classrooms where owner_id=${owner} for update`,tasks=await tx`select * from tasks where owner_id=${owner} for update`,students=await tx`select * from students where owner_id=${owner} for update`;
  const keepRooms=rooms.filter(r=>r.name==='测试班级'),keepTasks=tasks.filter(t=>t.name==='test'),keepStudents=students.filter(s=>s.name.trim().toLowerCase()==='pride wood');
  if(keepRooms.length!==1||keepTasks.length!==1||keepStudents.length!==1||keepTasks[0].class_id!==keepRooms[0].id||keepStudents[0].class_id!==keepRooms[0].id)throw Error('保留对象不唯一或不属于同一班级，已中止');
  const removeRooms=rooms.filter(r=>r.id!==keepRooms[0].id),removeTasks=tasks.filter(t=>t.id!==keepTasks[0].id),removeStudents=students.filter(s=>s.id!==keepStudents[0].id);
  const seed=makeSeed(owner);
  if(removeRooms.some(r=>!seed.classes.some(c=>c.id===r.id))||removeTasks.some(t=>!seed.tasks.some(p=>p.id===t.id))||removeStudents.some(s=>!seed.students.some(p=>p.id===s.id)))throw Error('存在未识别的新数据，拒绝扩大清理范围');
  if(!removeRooms.length&&!removeTasks.length&&!removeStudents.length){console.log('演示数据已清理，无需重复执行。');return}
  const roomIds=removeRooms.map(r=>r.id),taskIds=removeTasks.map(t=>t.id),studentIds=removeStudents.map(s=>s.id),userIds=removeStudents.map(s=>s.user_id).filter(Boolean);
  const backup={version:1,owner,createdAt:new Date().toISOString(),retained:{classId:keepRooms[0].id,taskId:keepTasks[0].id,studentId:keepStudents[0].id},classrooms:removeRooms,tasks:removeTasks,students:removeStudents,
   registration_windows:await tx`select * from registration_windows where class_id in ${tx(roomIds)}`,
   learning:await tx`select * from learning where task_id in ${tx(taskIds)} or student_id in ${tx(studentIds)}`,
   attempts:await tx`select * from attempts where task_id in ${tx(taskIds)} or student_id in ${tx(studentIds)}`,
   study_profiles:await tx`select * from study_profiles where student_id in ${tx(studentIds)}`,
   study_events:await tx`select * from study_events where student_id in ${tx(studentIds)}`,
   users:userIds.length?await tx`select * from users where id in ${tx(userIds)} and role='student' and workspace_id=${owner}`:[],
   sessions:userIds.length?await tx`select * from sessions where user_id in ${tx(userIds)}`:[]};
  const protectedBefore={learning:await tx`select * from learning where task_id=${keepTasks[0].id} and student_id=${keepStudents[0].id}`,attempts:await tx`select * from attempts where task_id=${keepTasks[0].id} and student_id=${keepStudents[0].id}`};
  console.log(JSON.stringify({retained:{class:keepRooms[0].name,task:keepTasks[0].name,student:keepStudents[0].name},remove:{classes:roomIds.length,tasks:taskIds.length,students:studentIds.length,studentAccounts:backup.users.length},mode:process.argv.includes('--apply')?'apply':'dry-run'}));
  if(!process.argv.includes('--apply'))return;
  await mkdir('outputs',{recursive:true});const path=`outputs/demo-cleanup-${Date.now()}.json`;
  await writeFile(path,JSON.stringify(backup,null,2),{mode:0o600,flag:'wx'});
  await tx`delete from tasks where owner_id=${owner} and id in ${tx(taskIds)}`;
  await tx`delete from students where owner_id=${owner} and id in ${tx(studentIds)}`;
  await tx`delete from classrooms where owner_id=${owner} and id in ${tx(roomIds)}`;
  if(userIds.length)await tx`delete from users where role='student' and workspace_id=${owner} and id in ${tx(userIds)} and not exists(select 1 from students where user_id=users.id)`;
  const after={learning:await tx`select * from learning where task_id=${keepTasks[0].id} and student_id=${keepStudents[0].id}`,attempts:await tx`select * from attempts where task_id=${keepTasks[0].id} and student_id=${keepStudents[0].id}`};
  if(JSON.stringify(protectedBefore)!==JSON.stringify(after))throw Error('保留对象记录发生变化，事务回滚');
  console.log(`已清理演示数据，保留对象记录未变；备份：${path}（含敏感哈希，仅本地保存，不提交仓库，可据此恢复）。`);
 });
}finally{await db.end({timeout:5})}
