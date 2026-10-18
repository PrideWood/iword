import { redirect } from 'next/navigation';
import { currentAccount } from '@/lib/session';
import AdminApp from '@/components/admin-app';
export const dynamic='force-dynamic';
export default async function AdminPage(){const account=await currentAccount();if(!account)redirect('/teacher/login');if(!account.isAdmin)redirect(account.role==='teacher'?'/teacher':'/');return <AdminApp/>}
