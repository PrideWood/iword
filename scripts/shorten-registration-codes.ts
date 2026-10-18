import { config } from 'dotenv';
import { isNull } from 'drizzle-orm';
config({path:'.env.local',quiet:true});config({quiet:true});
const { getDb,closeDatabase }=await import('../db');
const { registrationWindows }=await import('../db/schema');
const { shortenRegistrationWindow }=await import('../lib/registration-code-server');
try{
 const windows=await getDb().select({id:registrationWindows.id,ownerId:registrationWindows.ownerId}).from(registrationWindows).where(isNull(registrationWindows.shortCode));
 let count=0;for(const window of windows)if(await shortenRegistrationWindow(window.id,window.ownerId))count++;
 console.log(`已为 ${count} 个注册入口配置六位短码，原有长码和链接保持有效。`);
}finally{await closeDatabase()}
