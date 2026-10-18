import { configurePlaybackSession } from './audio-session';

// Home Screen WebKit can leave AudioContext.resume() pending indefinitely.
// Use one native media element, unlocked directly in the user's click instead.
export class StandaloneAudioPlayer{
 private audio:HTMLAudioElement|undefined;
 private unlocked=false;
 private unlockPromise:Promise<void>|undefined;
 private finish:(()=>void)|undefined;
 private revision=0;
 private silentUrl:string|undefined;
 private lifecycle=false;
 constructor(private create=()=>new Audio()){}
 private element(){
  if(!this.lifecycle&&typeof document!=='undefined'){
   this.lifecycle=true;
   document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')this.reset()});
   window.addEventListener('pagehide',()=>this.reset());
  }
  if(!this.audio){this.audio=this.create();this.audio.preload='auto';this.audio.setAttribute('playsinline','');this.audio.muted=false;this.audio.volume=1}
  return this.audio;
 }
 private silence(){
  if(!this.silentUrl){
   const bytes=new Uint8Array(844),view=new DataView(bytes.buffer);
   const text=(offset:number,value:string)=>{for(let i=0;i<value.length;i++)bytes[offset+i]=value.charCodeAt(i)};
   text(0,'RIFF');view.setUint32(4,836,true);text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,8000,true);view.setUint32(28,8000,true);view.setUint16(32,1,true);view.setUint16(34,8,true);text(36,'data');view.setUint32(40,800,true);bytes.fill(128,44);
   this.silentUrl=URL.createObjectURL(new Blob([bytes],{type:'audio/wav'}));
  }
  return this.silentUrl;
 }
 private bounded(promise:Promise<void>,ms:number){
  return new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('请点击开启声音后重试')),ms);promise.then(()=>{clearTimeout(timer);resolve()},error=>{clearTimeout(timer);reject(error)})});
 }
 unlock(){
  configurePlaybackSession();if(this.unlocked)return Promise.resolve();if(this.unlockPromise)return this.unlockPromise;
  const audio=this.element(),revision=this.revision;audio.src=this.silence();
  // Must call play synchronously, before fetching/IndexedDB/await loses the gesture.
  let started:Promise<void>;try{started=audio.play()}catch(error){return Promise.reject(error)}
  const promise=this.bounded(started,2000).then(()=>{if(this.revision!==revision)throw Error('请点击开启声音');audio.pause();this.unlocked=true}).catch(error=>{if(this.revision===revision)this.reset();throw error}).finally(()=>{if(this.unlockPromise===promise)this.unlockPromise=undefined});
  this.unlockPromise=promise;return promise;
 }
 stop(){
  this.revision++;this.audio?.pause();this.finish?.();this.finish=undefined;
  if(this.audio){this.audio.onended=null;this.audio.onerror=null}
 }
 reset(){
  this.stop();this.audio?.removeAttribute('src');this.audio?.load();this.audio=undefined;this.unlocked=false;this.unlockPromise=undefined;
 }
 async play(url:string,isCurrent:()=>boolean,untilEnded:boolean){
  if(!isCurrent())return;
  if(typeof document!=='undefined'&&document.visibilityState==='hidden')throw Error('请返回页面后点击开启声音');
  configurePlaybackSession();this.stop();const audio=this.element(),revision=this.revision;
  let timer:ReturnType<typeof setTimeout>|undefined,settled=false;
  let complete!:()=>void,fail!:(error:Error)=>void;
  const ended=new Promise<void>((resolve,reject)=>{complete=resolve;fail=reject});
  // Attach a handler even for single playback, where the caller only awaits start.
  void ended.catch(()=>{});
  const finish=(error?:Error)=>{settled=true;if(timer)clearTimeout(timer);if(this.finish===cancel)this.finish=undefined;error?fail(error):complete()};
  const cancel=()=>finish();this.finish=cancel;
  audio.onended=()=>finish();audio.onerror=()=>finish(Error('音频无法播放，请重试'));
  // Reassigning src resets playback without seeking before Safari has metadata.
  audio.src=url;
  try{
   await this.bounded(audio.play(),5000);
   if(revision!==this.revision||!isCurrent()){if(revision===this.revision)this.stop();return}
   this.unlocked=true;
   if(untilEnded){if(!settled)timer=setTimeout(()=>{if(revision===this.revision)audio.pause();finish(Error('发音播放中断，请点击重试'))},20000);await ended}
  }catch(error){if(revision===this.revision)this.reset();throw error}
 }
}
export const standaloneAudio=new StandaloneAudioPlayer();
