import type { MetadataRoute } from 'next';

export default function manifest():MetadataRoute.Manifest{
 return {
  id:'/',name:'词间',short_name:'词间',lang:'zh-CN',
  start_url:'/',scope:'/',display:'standalone',
  background_color:'#f5f7ef',theme_color:'#245c45',
  icons:[
   {src:'/icons/iword-192.png',sizes:'192x192',type:'image/png',purpose:'any'},
   {src:'/icons/iword-512.png',sizes:'512x512',type:'image/png',purpose:'any'},
  ],
 };
}
