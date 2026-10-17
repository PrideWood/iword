import WorkspaceApp from '@/components/workspace-app';
import { accessibleWorkspace } from '@/lib/access';
import { currentAccount } from '@/lib/session';
import { redirect } from 'next/navigation';
import StudentApp from '@/components/student-app';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export default async function Home(){const account=await currentAccount();if(!account)redirect('/login');const data=await accessibleWorkspace(account);return account.role==='student'?<StudentApp initialData={data} name={account.name} username={account.username}/>:<WorkspaceApp initialData={data} initialOffline={false} accountName={account.name}/>}
