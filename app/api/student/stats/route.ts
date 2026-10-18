import { NextResponse } from 'next/server';
import { currentAccount } from '@/lib/session';
import { accessibleWorkspace } from '@/lib/access';
import { isSameOrigin } from '@/lib/request-security';
import { recordStudyEvent, readStudentStudyStats, studentStudyStats } from '@/lib/study-server';
import { getDb } from '@/db';
import { students } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
export const dynamic='force-dynamic';
export const runtime='nodejs';
async function handle(request:Request,checkIn=false){
 const account=await currentAccount();if(!account)return NextResponse.json({error:'请先登录'},{status:401});
 if(account.role!=='student')return NextResponse.json({error:'仅学生可访问'},{status:403});
 if(checkIn&&!isSameOrigin(request))return NextResponse.json({error:'请求来源无效'},{status:403});
 try{
  const [student]=await getDb().select({id:students.id}).from(students).where(and(eq(students.userId,account.id),eq(students.ownerId,account.workspaceId))).limit(1);
  if(!student)return NextResponse.json({error:'学生档案不存在'},{status:404});
  let stats=await readStudentStudyStats(student.id,account.workspaceId);
  if(checkIn||!stats){
   const data=await accessibleWorkspace(account);
   if(checkIn)await recordStudyEvent(data,{studentId:student.id,ownerId:account.workspaceId,eventKey:crypto.randomUUID(),kind:'checkin'});
   stats=await studentStudyStats(data,student.id,account.workspaceId);
  }
  return NextResponse.json(stats,{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){return NextResponse.json({error:error instanceof Error&&error.message==='先学习，再打卡'?error.message:'统计暂时无法加载，请重试'},{status:checkIn?400:503})}
}
export async function GET(request:Request){return handle(request)}
export async function POST(request:Request){return handle(request,true)}
