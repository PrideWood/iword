import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={
 title:'词间 · 班级英语学习平台',
 description:'让每一次词汇学习，都有迹可循。中职英语课堂的学习与任务管理。',
 applicationName:'词间',
 manifest:'/manifest.webmanifest',
 appleWebApp:{capable:true,title:'词间',statusBarStyle:'default'},
 icons:{
  icon:[{url:'/favicon.ico',sizes:'16x16 32x32 48x48'},{url:'/icons/favicon-32.png',sizes:'32x32',type:'image/png'}],
  apple:[{url:'/icons/apple-touch-icon-180.png',sizes:'180x180',type:'image/png'}],
 },
};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="zh-CN"><body>{children}</body></html>}
