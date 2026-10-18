import assert from 'node:assert/strict';
import { StudySaveQueue } from '../lib/study-save-queue';
import { studentWordBatches,wordBatchLabel } from '../lib/student-word-batches';
import { makeSeed } from '../lib/seed';

const sent:string[]=[],status:{count:number;failed:boolean}[]=[];
let release!:(value:boolean)=>void;
const queue=new StudySaveQueue<string>(async item=>{sent.push(item);return new Promise<boolean>(resolve=>{release=resolve})},(count,failed)=>status.push({count,failed}));
queue.enqueue('event-1');queue.enqueue('event-2');queue.enqueue('event-3');
assert.equal(queue.size,3);assert.deepEqual(sent,['event-1']); // Enqueue never waits for the network.
release(true);await new Promise(resolve=>setImmediate(resolve));
assert.deepEqual(sent,['event-1','event-2']);
release(false);assert.equal(await queue.flush(),false);assert.equal(queue.size,2);assert.equal(status.at(-1)?.failed,true);
const retry=queue.retry();assert.deepEqual(sent,['event-1','event-2','event-2']);
release(true);await new Promise(resolve=>setImmediate(resolve));release(true);assert.equal(await retry,true);assert.equal(queue.size,0);
assert.deepEqual(sent,['event-1','event-2','event-2','event-3']);
const thrown=new StudySaveQueue(async()=>{throw Error('offline')},()=>{});thrown.enqueue('keep');assert.equal(await thrown.flush(),false);assert.equal(thrown.size,1);

const data=makeSeed('batch-test');const first=data.tasks[0],word=JSON.parse(first.wordSnapshot)[0];
data.tasks=[{...first,id:'first',createdAt:'2026-10-17T01:02:03.000Z',wordSnapshot:JSON.stringify([word])},{...first,id:'review',createdAt:'2026-10-18T01:02:03.000Z',wordSnapshot:JSON.stringify([word,{...word,id:'other',english:'another'}])}];
data.learning=[{id:'progress',ownerId:'batch-test',studentId:data.students[0].id,taskId:'review',ratings:JSON.stringify({[word.id]:'known'}),position:1,activeSeconds:0,startedAt:null,lastSeenAt:null,firstCompletedAt:null}];
let entries=studentWordBatches(data);assert.equal(entries.length,2);assert.equal(entries[0].batchId,'first');assert.equal(entries[0].learned,true);assert.equal(entries[1].batchId,'review');
assert.equal(wordBatchLabel(first.createdAt).length,19);assert.equal(wordBatchLabel('2026-10-17T01:02:03Z'),'2026-10-17 09:02:03');
data.tasks[1].status='deleted';entries=studentWordBatches(data);assert.equal(entries.length,1);assert.equal(entries[0].learned,true);
console.log('通过：即时入队、串行后台保存、失败保留及原事件重试、网络异常、按创建时间分批、跨批次去重、复习状态合并、删除任务保留已学词和北京时间命名。');
