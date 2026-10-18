'use client';
import { ThemeProvider as Provider } from 'next-themes';
export default function ThemeProvider({children}:{children:React.ReactNode}){
 return <Provider attribute="data-theme" defaultTheme="light" enableSystem={false} storageKey="iword:theme" disableTransitionOnChange>{children}</Provider>;
}
