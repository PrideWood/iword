'use client';
import { useState,useCallback,useEffect,useRef } from 'react';
import Link from 'next/link';
import { LayoutDashboard,ClipboardList,LibraryBig,Users,ChartNoAxesCombined,GraduationCap,ChevronRight,Plus,Search,Bell,Settings2,PanelLeftClose,ArrowUpRight,Check,HelpCircle,Loader2,X } from 'lucide-react';
import type { Workspace,Task } from '@/lib/types';
import Dashboard from './features/dashboard';
import { TaskList,TaskForm,ClassList,WordLibrary,ReportPage,StudentDetail } from './features/management';
import StudentView from './features/student';
import { LogoutButton, StudentAccountForm, ChangePasswordForm } from './auth-controls';
import { Modal } from './shared';
export type Mutate=(body:Record<string,unknown>)=>Promise<boolean>;
const nav=[{id:'dashboard',name:'教学概览',icon:LayoutDashboard},{id:'tasks',name:'学习任务',icon:ClipboardList},{id:'books',name:'单词库',icon:LibraryBig},{id:'classes',name:'班级与学生',icon:Users},{id:'reports',name:'学习报告',icon:ChartNoAxesCombined}];
export default function WorkspaceApp({initialData,initialOffline,accountName,isAdmin=false}:{initialData:Workspace;initialOffline:boolean;accountName:string;isAdmin?:boolean}){
 const searchRef=useRef<HTMLInputElement>(null);
 useEffect(()=>{const handler=(e:KeyboardEvent)=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();searchRef.current?.focus()}};window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler)},[]);
 const [editingTask,setEditingTask]=useState<Task|undefined>();
 const [data,setData]=useState(initialData);const [page,setPage]=useState('dashboard');const [studentMode,setStudentMode]=useState(false);const [modal,setModal]=useState<string|null>(null);const [toast,setToast]=useState('');const [busy,setBusy]=useState(false);const [mobile,setMobile]=useState(false);const [search,setSearch]=useState('');const [classFilter,setClassFilter]=useState('all');const [offline,setOffline]=useState(initialOffline);const [detail,setDetail]=useState<string|null>(null);
 const notify=useCallback((message:string)=>{setToast(message);setTimeout(()=>setToast(''),4500)},[]);
 const mutate:Mutate=async body=>{if(busy)return false;setBusy(true);try{const res=await fetch('/api/workspace',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const json=await res.json() as Workspace & {error?:string};if(!res.ok)throw Error(json.error);setData(json);setOffline(false);return true}catch(e){notify(e instanceof Error?e.message:'保存失败，请重试');return false}finally{setBusy(false)}};
 const go=(id:string)=>{setPage(id);setMobile(false);setSearch('')};
 const current=nav.find(n=>n.id===page);const visibleData=classFilter==='all'?data:{...data,tasks:data.tasks.filter(t=>t.classId===classFilter)};
 return <div className={'app-shell '+(studentMode?'student-shell':'')}>
 <aside className={'sidebar '+(mobile?'open':'')}><Link className="brand" href="/t" aria-label="词间教师首页"><img src="/favicon.svg" alt=""/><div><strong>词间</strong></div></Link>
 <button className="workspace-switch" aria-haspopup="dialog" onClick={()=>setModal('workspace')}><span className="school-icon"><GraduationCap size={20}/></span><span><strong>我的英语课堂</strong></span></button>
 <nav>{nav.map(n=><button key={n.id} className={!studentMode&&page===n.id?'active':''} onClick={()=>{setStudentMode(false);go(n.id)}}><n.icon size={19}/><span>{n.name}</span>{n.id==='tasks'&&<small>{data.tasks.filter(t=>t.status!=='deleted').length}</small>}</button>)}</nav>
 <div className="sidebar-divider"/><div className="ops-sidebar-links"><Link href="/t/billing">额度与用量</Link>{isAdmin&&<Link href="/admin">平台管理</Link>}</div><button className={'preview-nav '+(studentMode?'active':'')} onClick={()=>{setStudentMode(!studentMode);setMobile(false)}}><GraduationCap size={20}/><span>学生端预览</span><ArrowUpRight size={15}/></button>
 <div className="sidebar-bottom"><button className="help-button" onClick={()=>setModal('guide')}><HelpCircle size={17}/>帮助与使用指南<ArrowUpRight size={14}/></button><button className="user-profile" onClick={()=>setModal('account')}><span className="avatar teacher">W</span><span><strong>{accountName}</strong></span><Settings2 size={16}/></button></div></aside>
 {mobile&&<div className="sidebar-scrim" onClick={()=>setMobile(false)}/>}
 <div className="main-shell"><header className="topbar"><div className="breadcrumb"><button className="mobile-toggle icon-btn" onClick={()=>setMobile(true)} aria-label="打开导航"><PanelLeftClose size={20}/></button><span>我的英语课堂</span><ChevronRight size={13}/><strong>{studentMode?'学生端预览':current?.name}</strong></div><div className="top-actions"><label className="searchbox"><Search size={16}/><input ref={searchRef} aria-label="搜索任务、单词或学生" value={search} onChange={e=>{setSearch(e.target.value);if(page!=='tasks'&&page!=='books'&&page!=='classes')setPage('tasks')}} placeholder="搜索任务、单词或学生…"/></label><button className="notification icon-btn" aria-label="查看通知" onClick={()=>setModal('notifications')}><Bell size={19}/><span/></button><span className="avatar small teacher" onClick={()=>setModal('account')}>W</span></div></header>
 {offline&&<div className="offline-banner">当前为只读预览，数据服务尚未连接。<button onClick={async()=>{const r=await fetch('/api/workspace');if(r.ok){setData(await r.json() as Workspace);setOffline(false)}else {const x=await r.json() as {error:string};notify(x.error)}}}>重新连接</button></div>}
 <main className="main-content">{studentMode?<StudentView data={data} mutate={mutate} notify={notify}/>:<>
 <div className="page-heading"><div><h1>{page==='dashboard'?'教学概览':current?.name}</h1></div><div className="heading-actions">{page==='dashboard'?<select aria-label="筛选班级" className="select-btn" value={classFilter} onChange={e=>setClassFilter(e.target.value)}><option value="all">全部班级</option>{data.classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>:null}{page!=='reports'&&<button className="btn primary" onClick={()=>{setEditingTask(undefined);setModal(page==='books'?'book':page==='classes'?'class':'task')}}><Plus size={17}/>{page==='books'?'新建词库':page==='classes'?'创建班级':'发布任务'}</button>}{page==='reports'&&<a className="btn primary" href="/api/export"><ArrowUpRight size={16}/>导出学习报告</a>}</div></div>
 {page==='dashboard'&&<Dashboard data={{...visibleData,tasks:visibleData.tasks.filter(t=>t.status!=='deleted')}} onNavigate={go} onTask={()=>{setEditingTask(undefined);setModal('task')}} onDetail={setDetail}/>}
 {page==='tasks'&&<TaskList mutate={mutate} notify={notify} data={visibleData} search={search} onDetail={id=>{setPage('reports');setDetail(id)}} onCreate={()=>{setEditingTask(undefined);setModal('task')}} onEdit={task=>{setEditingTask(task);setModal('task')}}/>}
 {page==='books'&&<WordLibrary data={data} search={search} mutate={mutate} notify={notify} creating={modal==='book'} closeCreate={()=>setModal(null)}/>}
 {page==='classes'&&<ClassList data={data} search={search} mutate={mutate} notify={notify} creating={modal==='class'} closeCreate={()=>setModal(null)} onStudent={id=>setDetail(id)}/>}
 {page==='reports'&&<ReportPage data={data} onStudent={setDetail}/>}

 </>}</main></div>
 {modal==='task'&&<TaskForm task={editingTask} data={data} mutate={mutate} onClose={()=>setModal(null)} notify={notify}/>}
 {detail&&<StudentDetail data={data} id={detail} onClose={()=>setDetail(null)} onStudent={setDetail}/>}
 {['guide','account','notifications','workspace'].includes(modal??'')&&<Modal title={modal==='guide'?'开始你的词间课堂':modal==='account'?'教师账户':modal==='workspace'?'我的英语课堂':'课堂通知'} onClose={()=>setModal(null)}>{modal==='guide'?<div className="guide-content">{[['01','准备班级','在「班级与学生」添加班级和学生名单。'],['02','整理词库','创建词库，手动录入或导入 CSV 单词表。'],['03','发布任务','选择班级、词库、必答题型与截止时间。'],['04','看见成长','通过学生端预览体验学习，在学习报告查看结果。']].map(x=><div key={x[0]}><b>{x[0]}</b><span><strong>{x[1]}</strong><p>{x[2]}</p></span></div>)}</div>:modal==='notifications'?<div className="notification-list"><span className="notification-illustration"><Bell size={28}/></span><h3>截止任务</h3><p>{data.tasks.filter(t=>t.status!=='deleted'&&new Date(t.deadline)<new Date()).length} 项任务已截止</p><button className="btn primary" onClick={()=>{go('reports');setModal(null)}}>查看学习报告 <ArrowUpRight size={15}/></button></div>:modal==='account'?<div className="account-panel"><span className="avatar teacher big">W</span><h3>{accountName}</h3><LogoutButton loginPath="/t/login"/><ChangePasswordForm loginPath="/t/login"/><StudentAccountForm students={data.students}/></div>:<div className="guide-content"><div className="workspace-numbers"><span><strong>{data.classes.length}</strong>个班级</span><span><strong>{data.students.length}</strong>名学生</span><span><strong>{data.books.length}</strong>个词库</span></div></div>}</Modal>}
 {toast&&<div role="status" className="toast"><Check size={18}/>{toast}<button aria-label="关闭提示" onClick={()=>setToast('')}><X size={15}/></button></div>}
 {busy&&<span className="saving-indicator"><Loader2 size={15} className="spin"/>保存中</span>}
 </div>
}
