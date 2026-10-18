import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { redirect } from 'next/navigation';
import { currentAccount } from '@/lib/session';
import { ChangePasswordForm } from '@/components/auth-controls';
import StudentViewportLock from '@/components/student-viewport-lock';
export const dynamic='force-dynamic';
export default async function StudentPasswordPage(){
 const account=await currentAccount();if(!account)redirect('/login');if(account.role!=='student')redirect('/t');
 return <main className="student-password-page student-content"><StudentViewportLock/><Link className="back-link" href="/?tab=account"><ArrowLeft size={18}/>我的</Link><section className="panel student-password"><ChangePasswordForm minimumLength={6}/></section></main>;
}
