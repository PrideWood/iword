import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'词间 · 班级英语学习平台',description:'让每一次词汇学习，都有迹可循。中职英语课堂的学习与任务管理。',icons:{icon:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="zh-CN"><body>{children}</body></html>}
