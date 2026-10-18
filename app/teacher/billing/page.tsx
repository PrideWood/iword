import { redirect } from 'next/navigation';
import { currentAccount } from '@/lib/session';
import BillingApp from '@/components/billing-app';
export const dynamic='force-dynamic';
export default async function BillingPage(){const account=await currentAccount();if(!account)redirect('/teacher/login');if(account.role!=='teacher')redirect('/');return <BillingApp/>}
