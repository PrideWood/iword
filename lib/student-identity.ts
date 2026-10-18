import { z } from 'zod';
export const studentLoginAlias=z.string().trim().toLowerCase().max(128,'登录账号最多 128 位').refine(value=>!value||/^[a-z0-9][a-z0-9_.@+-]{2,127}$/.test(value),'登录账号至少 3 位，可用字母、数字或邮箱格式');
export const studentPassword=z.string().min(6,'学生密码至少 6 位').max(128,'密码最多 128 位');
export const optionalStudentNumber=z.string().trim().max(40,'学号最多 40 位').default('');
export const generatedStudentLogin=(id:string)=>`~student:${id}`;
export const isGeneratedStudentLogin=(value:string)=>value.startsWith('~student:');
