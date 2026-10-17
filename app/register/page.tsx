import RegisterForm from '@/components/register-form';
export default async function RegisterPage({searchParams}:{searchParams:Promise<{code?:string}>}){
 const {code}=await searchParams;return <RegisterForm initialCode={typeof code==='string'?code:''}/>;
}
