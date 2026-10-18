import { redirect } from 'next/navigation';
import WorkspaceApp from '@/components/workspace-app';
import { currentAccount } from '@/lib/session';
import { accessibleWorkspace } from '@/lib/access';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export default async function TeacherPage(){
 const account=await currentAccount();
 if(!account)redirect('/teacher/login');
 if(account.role!=='teacher')redirect('/');
 return <WorkspaceApp initialData={await accessibleWorkspace(account)} initialOffline={false} accountName={account.name} isAdmin={account.isAdmin}/>;
}
