'use client';
import bundled from '@/public/audio/pronunciations/manifest.json';
import { normalizePronunciationTerm } from './pronunciation';

const version='yunmia-403006-v1';
const memory=new Map<string,{url:string;blob:Blob}>();
const pending=new Map<string,Promise<string>>();
const bundledSources=new Map(bundled.entries.map(e=>[normalizePronunciationTerm(e.term),`/audio/pronunciations/${e.src}`]));
let database:Promise<IDBDatabase|null>|undefined;
let context:AudioContext|undefined;
let playing:AudioBufferSourceNode|undefined;
const decoded=new Map<string,AudioBuffer>();
export class AudioRequestError extends Error{constructor(message:string,public status:number){super(message)}}

function db(){
 if(!database)database=new Promise(resolve=>{
  if(!('indexedDB' in window)){resolve(null);return}
  const request=indexedDB.open('iword-audio',1);
  request.onupgradeneeded=()=>{request.result.createObjectStore('audio')};
  request.onsuccess=()=>resolve(request.result);request.onerror=()=>resolve(null);request.onblocked=()=>resolve(null);
 });
 return database;
}
async function readBlob(key:string){
 try{const database=await db();if(!database)return null;
  return await new Promise<Blob|null>(resolve=>{const request=database.transaction('audio').objectStore('audio').get(`${version}:${key}`);request.onsuccess=()=>resolve(request.result instanceof Blob?request.result:null);request.onerror=()=>resolve(null)});
 }catch{return null}
}
async function saveBlob(key:string,blob:Blob){
 try{const database=await db();if(!database)return;
  await new Promise<void>(resolve=>{const tx=database.transaction('audio','readwrite');tx.objectStore('audio').put(blob,`${version}:${key}`);tx.oncomplete=()=>resolve();tx.onerror=()=>resolve();tx.onabort=()=>resolve()});
 }catch{/* Storage quotas or privacy settings must not prevent playback. */}
}
function remember(key:string,blob:Blob){
 const existing=memory.get(key);if(existing)return existing.url;
 const url=URL.createObjectURL(blob);memory.set(key,{url,blob});return url;
}
export function cachedAudioUrl(term:string){return memory.get(normalizePronunciationTerm(term))?.url}
export async function hasCachedAudio(term:string){
 const key=normalizePronunciationTerm(term);if(memory.has(key))return true;
 const blob=await readBlob(key);if(!blob)return false;remember(key,blob);return true;
}
async function download(url:string){
 const response=await fetch(url,{cache:'force-cache'});
 if(!response.ok)throw Error('音频下载失败');const blob=await response.blob();
 if(blob.size<100)throw Error('音频文件无效');return blob;
}
export async function prepareAudio(term:string,source?:string):Promise<string>{
 const key=normalizePronunciationTerm(term);const existing=memory.get(key);if(existing)return existing.url;
 if(pending.has(key))return pending.get(key)!;
 const promise=(async()=>{
  const saved=await readBlob(key);if(saved)return remember(key,saved);
  let blob:Blob|undefined;const initial=source||bundledSources.get(key);
  if(initial){try{blob=await download(initial)}catch{/* Refresh a stale signed URL below. */}}
  if(!blob){
   const response=await fetch('/api/pronunciation',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:term})});
   const result=await response.json();if(!response.ok)throw new AudioRequestError(result.error||'发音暂时不可用',response.status);
   try{blob=await download(result.url)}catch{blob=await download(`/api/pronunciation/file?text=${encodeURIComponent(term)}`)}
  }
  const url=remember(key,blob);await saveBlob(key,blob);return url;
 })();pending.set(key,promise);
 try{return await promise}finally{pending.delete(key)}
}
export async function prepareTaskAudio(taskId:string,terms:string[],progress?:(done:number,total:number)=>void){
 const unique=[...new Set(terms.map(normalizePronunciationTerm))];let done=0;const missing:string[]=[];
 for(const term of unique){if(await hasCachedAudio(term)){done++;progress?.(done,unique.length)}else missing.push(term)}
 const remote=missing.filter(term=>!bundledSources.has(term));const sources=new Map<string,string>();
 if(remote.length){
  const response=await fetch('/api/pronunciation/prefetch',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({taskId})});
  const result=await response.json();if(!response.ok)throw Error(result.error||'任务音频暂时无法下载');
  for(const item of result.items as {term:string;url:string}[])sources.set(normalizePronunciationTerm(item.term),item.url);
 }
 let cursor=0;const failures:string[]=[],unavailable:string[]=[];
 async function worker(){while(cursor<missing.length){const term=missing[cursor++];try{await prepareAudio(term,sources.get(term));done++;progress?.(done,unique.length)}catch(error){if(error instanceof AudioRequestError&&error.status===402)unavailable.push(term);else failures.push(term)}}}
 await Promise.all(Array.from({length:Math.min(4,missing.length)},worker));
 if(failures.length)throw Error(`${failures.length} 个发音未能下载，请重试`);
 return {unavailable};
}
export function stopAudio(){try{playing?.stop()}catch{}playing=undefined}
export function unlockAudio(){
 context??=new AudioContext();return context.resume();
}
export async function playCachedAudio(term:string,isCurrent:()=>boolean=()=>true){
 const key=normalizePronunciationTerm(term);await prepareAudio(key);
 context??=new AudioContext();if(context.state!=='running')await context.resume();
 if(context.state!=='running')throw Error('请点击开启声音');
 let buffer=decoded.get(key);
 if(!buffer){buffer=await context.decodeAudioData(await memory.get(key)!.blob.arrayBuffer());decoded.set(key,buffer)}
 if(!isCurrent())return;
 stopAudio();playing=context.createBufferSource();playing.buffer=buffer;playing.connect(context.destination);playing.start();
}
