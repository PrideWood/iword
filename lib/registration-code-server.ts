import { randomInt, randomUUID } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { getDb } from '@/db';
import { registrationWindows } from '@/db/schema';

const alphabet='23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export function generateRegistrationCode(){
 for(;;){const code=Array.from({length:6},()=>alphabet[randomInt(alphabet.length)]).join('');if(/[0-9]/.test(code)&&/[A-Z]/.test(code))return code}
}
export async function createRegistrationWindow(values:{ownerId:string;classId:string;opensAt:Date;closesAt:Date}){
 for(let tries=0;tries<10;tries++){
  const code=generateRegistrationCode();
  // Every short code is reserved in the same unique column, including new windows.
  const inserted=await getDb().insert(registrationWindows).values({...values,id:randomUUID(),code,shortCode:code}).onConflictDoNothing().returning({id:registrationWindows.id});
  if(inserted.length)return;
 }
 throw Error('注册码生成失败，请重试');
}
export async function shortenRegistrationWindow(id:string,ownerId:string){
 for(let tries=0;tries<10;tries++){
  try{
   const updated=await getDb().update(registrationWindows).set({shortCode:generateRegistrationCode()}).where(and(eq(registrationWindows.id,id),eq(registrationWindows.ownerId,ownerId),isNull(registrationWindows.shortCode))).returning({id:registrationWindows.id});
   return updated.length>0;
  }catch(error){
   const cause=(error as {cause?:{code?:string};code?:string});if((cause.cause?.code||cause.code)!=='23505')throw error;
  }
 }
 throw Error('注册码生成失败，请重试');
}
