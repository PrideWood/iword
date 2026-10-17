import type { Workspace,Word,Learning,Attempt } from './types';
const vocabulary=[
 ['network','/ˈnetwɜːrk/','n.','网络；关系网','The computers are connected to a network.'],
 ['connect','/kəˈnekt/','v.','连接；联结','Connect the printer to your computer.'],
 ['device','/dɪˈvaɪs/','n.','设备；装置','This device is easy to use.'],
 ['digital','/ˈdɪdʒɪtl/','adj.','数字的；数码的','We live in a digital world.'],
 ['information','/ˌɪnfərˈmeɪʃn/','n.','信息；资料','You can find more information online.'],
 ['technology','/tekˈnɑːlədʒi/','n.','技术；科技','Technology changes the way we learn.'],
 ['develop','/dɪˈveləp/','v.','发展；开发','We want to develop a new learning app.'],
 ['communicate','/kəˈmjuːnɪkeɪt/','v.','交流；沟通','We communicate with people around the world.'],
 ['customer','/ˈkʌstəmər/','n.','顾客；客户','Listen carefully to your customer.'],
 ['service','/ˈsɜːrvɪs/','n.','服务','Good service makes customers happy.'],
 ['professional','/prəˈfeʃənl/','adj.','专业的；职业的','She has a professional attitude.'],
 ['experience','/ɪkˈspɪriəns/','n.','经验；经历','This job gives you useful experience.'],
 ['opportunity','/ˌɑːpərˈtuːnəti/','n.','机会','This is a good opportunity to learn.'],
 ['responsibility','/rɪˌspɑːnsəˈbɪləti/','n.','责任','Safety is everyone’s responsibility.'],
 ['improve','/ɪmˈpruːv/','v.','改善；提高','Practice every day to improve your English.'],
 ['skill','/skɪl/','n.','技能','Teamwork is an important skill.'],
 ['schedule','/ˈskedʒuːl/','n.','日程；安排','Please check your class schedule.'],
 ['prepare','/prɪˈper/','v.','准备','We need to prepare for the meeting.'],
 ['environment','/ɪnˈvaɪrənmənt/','n.','环境','Keep your working environment clean.'],
 ['successful','/səkˈsesfl/','adj.','成功的','The project was successful.'],
 ['safety','/ˈseɪfti/','n.','安全','Always put safety first.'],
 ['equipment','/ɪˈkwɪpmənt/','n.','设备；器材','Check the equipment before use.'],
 ['repair','/rɪˈper/','v.','修理','Can you repair this computer?'],
 ['instruction','/ɪnˈstrʌkʃn/','n.','指示；说明','Read the instructions carefully.']
];
export function makeSeed(ownerId:string):Workspace{
 const prefix=ownerId.replace(/[^a-zA-Z0-9]/g,'').slice(-40); const id=(x:string)=>prefix+'-'+x;
 const words:Word[]=vocabulary.map((w,i)=>({id:id('w'+i),bookId:id('b'+(i<8?1:i<16?2:3)),english:w[0],phonetic:w[1],pos:w[2],meaning:w[3],example:w[4]}));
 const now=new Date(); const offset=(d:number)=>new Date(now.getTime()+d*86400000).toISOString();
 const classes=[{id:id('c1'),ownerId,name:'24级计算机应用 1 班',major:'计算机应用 · 二年级',createdAt:offset(-20)},{id:id('c2'),ownerId,name:'24级电子商务 2 班',major:'电子商务 · 二年级',createdAt:offset(-20)},{id:id('c3'),ownerId,name:'25级计算机应用 1 班',major:'计算机应用 · 一年级',createdAt:offset(-20)}];
 const names=['陈子涵','李明轩','王雨桐','张浩然','刘欣怡','赵宇航','黄思远','周佳宁','吴俊杰','徐梓萱','孙一诺','马文博','朱可欣','胡晨阳','林语桐','何睿泽'];
 const students=names.map((name,i)=>({id:id('s'+i),ownerId,classId:id('c'+(i<8?1:i<13?2:3)),userId:null,name,number:'2024'+String(i+1).padStart(3,'0')}));
 const books=[{id:id('b1'),ownerId,name:'Unit 3 · Digital Life',description:'数字生活与信息技术',color:'green'},{id:id('b2'),ownerId,name:'Unit 4 · My Future Career',description:'未来职业与职场沟通',color:'orange'},{id:id('b3'),ownerId,name:'职场英语 · 安全与操作',description:'职业场景常用核心词汇',color:'blue'}];
 const tasks=books.map((b,i)=>({id:id('t'+i),ownerId,name:['Unit 3 · 数字生活核心词汇','Unit 4 · 我的未来职业','职场英语 · 安全与操作'][i],bookId:b.id,classId:classes[i===2?0:i].id,startAt:offset(-3-i),deadline:offset(i===0?2:i===1?4:-1),status:'published',wordSnapshot:JSON.stringify(words.filter(w=>w.bookId===b.id)),rulesSnapshot:JSON.stringify({types:['meaning','spelling','listening'],passing:80,repeat:true}),createdAt:offset(-4-i)}));
 const learning:Learning[]=[]; const attempts:Attempt[]=[];
 tasks.forEach((task,ti)=>students.filter(s=>s.classId===task.classId).forEach((student,si)=>{
  if(si%4===3)return;
  const tw:Word[]=JSON.parse(task.wordSnapshot); const done=si%3!==2;const finish=offset(-((si+ti)%6)-0.05);
  const position=done?tw.length:Math.max(1,Math.floor(tw.length*.5));
  learning.push({id:id('l'+ti+'-'+si),ownerId,taskId:task.id,studentId:student.id,position,ratings:JSON.stringify(Object.fromEntries(tw.slice(0,position).map(w=>[w.id,'known']))),activeSeconds:180+si*47,startedAt:offset(-6),lastSeenAt:finish,firstCompletedAt:done?finish:null});
  if(done){const answers=tw.flatMap((w,wi)=>['meaning','spelling','listening'].map(type=>({wordId:w.id,type,prompt:type==='meaning'?w.english:w.meaning,answer:wi===si%8?'':type==='meaning'?w.meaning:w.english,correctAnswer:type==='meaning'?w.meaning:w.english,correct:wi!==si%8})));
   attempts.push({id:id('a'+ti+'-'+si),ownerId,taskId:task.id,studentId:student.id,answers:JSON.stringify(answers),correct:answers.filter(a=>a.correct).length,total:answers.length,completedAt:finish,practice:0});
  }
 }));
 return {classes,students,books,words,tasks,learning,attempts};
}
