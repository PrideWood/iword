import { accessibleWorkspace } from '@/lib/access';
import { currentAccount } from '@/lib/session';
import { redirect } from 'next/navigation';
import StudentApp from '@/components/student-app';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export default async function Home({searchParams}:{searchParams:Promise<{tab?:string}>}){const account=await currentAccount();if(!account)redirect('/login');if(account.role==='teacher')redirect('/t');const data=await accessibleWorkspace(account);return <StudentApp initialTab={(await searchParams).tab==='account'?'account':'learn'} initialData={data} name={account.name} username={account.username}/>}
