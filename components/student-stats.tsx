'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Check, CalendarDays, ChartNoAxesCombined } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { durationLabel, monthDates, type StudyStats, type StudyDay } from '@/lib/study-stats';

function Metric({label,value,unit}:{label:string;value:string|number;unit?:string}){
 return <div className="study-metric"><span>{label}</span><strong>{value}{unit&&<small>{unit}</small>}</strong></div>;
}
function DailyChart({days,metric,trackingSince}:{days:StudyDay[];metric:'seconds'|'words';trackingSince:string}){
 const data=days.map(day=>({date:day.day.slice(5).replace('-','/'),value:day.day<trackingSince?null:metric==='seconds'?Math.round(day.seconds/60*100)/100:day.newWords+day.reviewWords}));
 const title=metric==='seconds'?'每日学习时长':'每日学习单词数量',unit=metric==='seconds'?'分钟':'词';
 return <section className="study-chart"><h3>{title}<span>{unit}</span></h3><div className="chart-frame" role="group" aria-label={`${title}折线图，${days[0]?.day} 至 ${days.at(-1)?.day}`}>
  <ResponsiveContainer width="100%" height={190}><LineChart data={data} accessibilityLayer margin={{top:12,right:10,left:-20,bottom:0}}><CartesianGrid vertical={false} stroke="#e8ede3" strokeDasharray="4 4"/><XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={28} tick={{fontSize:11,fill:'#7c8976'}}/><YAxis allowDecimals={metric==='seconds'} tickLine={false} axisLine={false} domain={[0,'auto']} tick={{fontSize:11,fill:'#7c8976'}}/><Tooltip formatter={value=>[`${value} ${unit}`,title]} contentStyle={{borderRadius:12,border:'1px solid #dfe6d9'}}/><Line type="linear" dataKey="value" stroke={metric==='seconds'?'#2b6652':'#a27843'} strokeWidth={2.5} dot={days.filter(d=>d.day>=trackingSince).length<=7?{r:3,fill:metric==='seconds'?'#2b6652':'#a27843'}:false} activeDot={{r:5}} isAnimationActive={false}/></LineChart></ResponsiveContainer>
 </div></section>;
}
export default function StudentStats(){
 const [stats,setStats]=useState<StudyStats|null>(null),[error,setError]=useState(''),[pending,setPending]=useState(false);
 const [month,setMonth]=useState(''),[selected,setSelected]=useState(''),[range,setRange]=useState(7);
 const load=useCallback(async(signal?:AbortSignal)=>{
  setError('');try{const response=await fetch('/api/student/stats',{signal});const data=await response.json();if(!response.ok)throw Error(data.error);if(signal?.aborted)return;setStats(data);setMonth(value=>value||data.today.day.slice(0,7));setSelected(value=>value||data.today.day)}catch(error){if(!signal?.aborted)setError(error instanceof Error?error.message:'无法加载统计')}
 },[]);
 useEffect(()=>{const controller=new AbortController();void load(controller.signal);return()=>controller.abort()},[load]);
 const calendar=useMemo(()=>month?monthDates(month):[],[month]);
 const weekOffset=month?(new Date(month+'-01T12:00:00Z').getUTCDay()+6)%7:0;
 const chartDays=useMemo(()=>{
  if(!stats)return [];const end=Date.parse(stats.today.day+'T12:00:00Z');
  return Array.from({length:range},(_,i)=>{const day=new Date(end-(range-1-i)*86400000).toISOString().slice(0,10);return stats.days.find(d=>d.day===day)||{day,newWords:0,reviewWords:0,seconds:0,checkedIn:false}});
 },[stats,range]);
 if(!stats)return <section className="study-loading panel" aria-live="polite">{error?<><p role="alert">{error}</p><button className="btn secondary" onClick={()=>void load()}>重试</button></>:'加载统计…'}</section>;
 const day=stats.days.find(d=>d.day===selected)||{day:selected,newWords:0,reviewWords:0,seconds:0,checkedIn:false};
 const activeToday=stats.today.newWords+stats.today.reviewWords+stats.today.seconds>0;
 function moveMonth(delta:number){const date=new Date(month+'-01T12:00:00Z');date.setUTCMonth(date.getUTCMonth()+delta);const next=date.toISOString().slice(0,7);setMonth(next);setSelected(next+'-01')}
 async function checkIn(){setPending(true);setError('');try{const response=await fetch('/api/student/stats',{method:'POST'}),data=await response.json();if(!response.ok)throw Error(data.error);setStats(data)}catch(error){setError(error instanceof Error?error.message:'打卡失败')}finally{setPending(false)}}
 return <section className="student-statistics" aria-label="个人学习统计">
  <div className="study-section-heading"><h2>统计</h2><button className={'study-checkin '+(stats.today.checkedIn?'checked':'')} disabled={pending||stats.today.checkedIn||!activeToday} onClick={()=>void checkIn()}>{stats.today.checkedIn?<><Check size={16}/>今日已打卡</>:pending?'打卡中…':'今日打卡'}</button></div>
  {error&&<p role="alert" className="error-box">{error}</p>}
  <section className="study-today panel"><h3>今日学习</h3><div className="study-metrics today"><Metric label="新词" value={stats.today.newWords} unit="词"/><Metric label="复习" value={stats.today.reviewWords} unit="词"/><Metric label="学习时长" value={durationLabel(stats.today.seconds)}/></div></section>
  <section className="study-total panel"><h3>合计数据</h3><div className="study-metrics total"><Metric label="总共学习" value={stats.totals.learningDays} unit="天"/><Metric label="总共打卡" value={stats.totals.checkInDays} unit="天"/><Metric label="已掌握单词" value={stats.totals.masteredWords} unit="词"/><Metric label="学习时长" value={durationLabel(stats.totals.seconds)}/></div></section>
  <section className="study-calendar panel"><div className="study-section-heading"><h3><CalendarDays size={18}/>打卡日历</h3><div className="calendar-month"><button aria-label="上个月" onClick={()=>moveMonth(-1)}><ChevronLeft size={18}/></button><span>{month.replace('-',' 年 ')} 月</span><button aria-label="下个月" disabled={month>=stats.today.day.slice(0,7)} onClick={()=>moveMonth(1)}><ChevronRight size={18}/></button></div></div><div className="calendar-grid weekdays">{['一','二','三','四','五','六','日'].map(d=><span key={d}>{d}</span>)}</div><div className="calendar-grid days">{Array.from({length:weekOffset},(_,i)=><span key={'blank'+i}/>)}{calendar.map(value=>{const record=stats.days.find(d=>d.day===value);return <button key={value} aria-label={`${value}${record?.checkedIn?'，已打卡':record?'，已学习':'，无记录'}`} aria-pressed={value===selected} aria-current={value===stats.today.day?'date':undefined} className={(record?.checkedIn?'checked-in ':record?'studied ':'')+(value===selected?'selected':'')} disabled={value>stats.today.day} onClick={()=>setSelected(value)}><span>{Number(value.slice(-2))}</span>{record?.checkedIn&&<i/>}</button>})}</div><div className="calendar-selected"><div><strong>{selected.slice(5).replace('-','月')}日</strong><span>{day.checkedIn?'已打卡':day.newWords+day.reviewWords+day.seconds?'已学习':'暂无记录'}</span></div><p>新词 {day.newWords} · 复习 {day.reviewWords} · {durationLabel(day.seconds)}</p></div></section>
  <section className="study-trends panel"><div className="study-section-heading"><h3><ChartNoAxesCombined size={18}/>学习趋势</h3><div className="trend-range" role="group" aria-label="趋势时间范围">{[7,30,90].map(value=><button key={value} aria-pressed={range===value} onClick={()=>setRange(value)}>{value} 天</button>)}</div></div><DailyChart days={chartDays} metric="seconds" trackingSince={stats.trackingSince}/><DailyChart days={chartDays} metric="words" trackingSince={stats.trackingSince}/></section>
  <details className="study-method"><summary>统计口径</summary><p>按北京时间统计。每日数据与学习、打卡天数自 {stats.trackingSince} 起记录，无法还原的历史日期不补造。累计时长包含历史有效时长；新词和复习每天各按词去重，同日重复不累加。已掌握以最近一次自评“认识”或该词本次测评全部答对为准；不认识或答错会更新掌握状态。完成测评自动打卡，也可在学习后手动打卡。</p></details>
 </section>;
}
