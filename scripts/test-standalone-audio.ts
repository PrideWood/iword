import assert from 'node:assert/strict';
import { StandaloneAudioPlayer } from '../lib/standalone-audio';
import { usesStandaloneAudio } from '../lib/audio-session';
import { runAudioSequence } from '../lib/audio-sequence';
import { unlockAudio,playCachedAudio,stopAudio } from '../lib/audio-client';
const original=Object.getOwnPropertyDescriptor(globalThis,'navigator');
Object.defineProperty(globalThis,'navigator',{value:{standalone:true},configurable:true});Object.assign(globalThis,{window:{matchMedia:()=>({matches:false})}});
assert.equal(usesStandaloneAudio(),true);
class FakeAudio{
 src='';preload='';muted=true;volume=0;currentTime=0;onended:(()=>void)|null=null;onerror:(()=>void)|null=null;starts:string[]=[];paused=false;fail=false;
 setAttribute(){} removeAttribute(){this.src=''} load(){} pause(){this.paused=true}
 play(){this.starts.push(this.src);this.paused=false;return this.fail?Promise.reject(Error('blocked')):Promise.resolve()}
}
const elements:FakeAudio[]=[];const player=new StandaloneAudioPlayer(()=>{const audio=new FakeAudio();elements.push(audio);return audio as unknown as HTMLAudioElement});
const unlock=player.unlock();assert.equal(elements[0].starts.length,1,'unlock starts media synchronously before any await');await unlock;assert.equal(elements[0].paused,true);
await player.play('blob:first',()=>true,false);assert.equal(elements.length,1);assert.equal(elements[0].src,'blob:first');
let finished=false;const queued=player.play('blob:second',()=>true,true).then(()=>{finished=true});await new Promise(r=>setImmediate(r));assert.equal(finished,false);elements[0].onended?.();await queued;assert.equal(finished,true);
const cancelled=player.play('blob:third',()=>true,true);await new Promise(r=>setImmediate(r));player.stop();await cancelled;
const count=elements[0].starts.length;await player.play('blob:stale',()=>false,false);assert.equal(elements[0].starts.length,count);
player.reset();await player.unlock();assert.equal(elements.length,2,'returning after reset creates a fresh media element');
elements[1].fail=true;await assert.rejects(player.play('blob:blocked',()=>true,true));player.reset();
const pending=['connect','digital'],played:string[]=[];
await runAudioSequence(pending,async term=>{played.push(term)},()=>true);assert.deepEqual(played,pending);assert.ok(!played.includes('network'),'learned words outside the displayed list never enter the queue');
const native:FakeAudio[]=[];
Object.assign(globalThis,{Audio:class extends FakeAudio{constructor(){super();native.push(this)}},AudioContext:class{constructor(){throw Error('standalone must not create AudioContext')}},fetch:async()=>new Response(new Uint8Array(256))});
await unlockAudio();await playCachedAudio('network');assert.equal(native.length,1);assert.ok(native[0].src.startsWith('blob:'));
const sequence=playCachedAudio('network',()=>true,true);await new Promise(r=>setImmediate(r));native[0].onended?.();await sequence;stopAudio();
if(original)Object.defineProperty(globalThis,'navigator',original);else Reflect.deleteProperty(globalThis,'navigator');
console.log('通过：独立模式检测、点击内同步解锁、单一原生音频元素复用/自然结束/停止/取消/重建/拒绝恢复、仅传入可见词表队列。');
