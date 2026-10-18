import assert from 'node:assert/strict';
import { prepareTaskAudio, playCachedAudio, stopAudio } from '../lib/audio-client';

// Deterministic client-cache test: no cloud credentials, network or TTS charges.
const requests:string[]=[];
let starts=0,decodes=0;
Object.assign(globalThis,{window:{},fetch:async(input:string,init?:RequestInit)=>{
  requests.push(input);
  if(input==='/api/pronunciation'&&String(init?.body).includes('balance-missing'))return Response.json({error:'额度不足'},{status:402});
  if(input==='/api/pronunciation/prefetch')return Response.json({items:[{term:'cache-fixture',url:'/audio/fixture.mp3'}]});
  return new Response(new Uint8Array(256),{headers:{'content-type':'audio/mpeg'}});
},AudioContext:class{
  state='running';destination={};
  async resume(){this.state='running'}
  async decodeAudioData(){decodes++;return {}}
  createBufferSource(){return {buffer:null,connect(){},start(){starts++},stop(){}}}
}});

const progress:number[]=[];
await prepareTaskAudio('fixture',['network','connect','device','network'],done=>progress.push(done));
assert.equal(requests.length,3,'each unique bundled word downloads once');
assert.equal(progress.at(-1),3);
await prepareTaskAudio('fixture',['network','connect','device']);
assert.equal(requests.length,3,'reopening a cached task makes no audio request');
await playCachedAudio('network');
await playCachedAudio('network');
assert.equal(requests.length,3,'repeated playback makes no audio request');
assert.equal(decodes,1,'decoded audio is reused');
assert.equal(starts,2);
await playCachedAudio('network',()=>false);
assert.equal(starts,2,'a cancelled or hidden lesson cannot start stale audio');
await prepareTaskAudio('fixture',['cache-fixture']);
assert.equal(requests.filter(url=>url==='/api/pronunciation/prefetch').length,1);
assert.ok(requests.includes('/audio/fixture.mp3'));
assert.ok(!requests.includes('/api/pronunciation'),'existing remote assets do not invoke generation');
const count=requests.length;
await prepareTaskAudio('fixture',['cache-fixture']);
await playCachedAudio('cache-fixture');
assert.equal(requests.length,count,'remote downloads also become local playback');
const partial=await prepareTaskAudio('fixture',['network','balance-missing']);
assert.deepEqual(partial.unavailable,['balance-missing'],'insufficient credit must not block the whole lesson');
const afterDenied=requests.length;await playCachedAudio('network');assert.equal(requests.length,afterDenied,'existing audio remains local and usable after balance denial');
stopAudio();
console.log('音频缓存测试通过：任务整组下载、去重、本地重播、解码复用及过期播放取消。');
