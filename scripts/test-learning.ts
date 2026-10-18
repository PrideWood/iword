import assert from 'node:assert/strict';
import { completeSpelling, learnedWordIds, makeQuestions, shuffle, spellingPrompt } from '../lib/learning';
import { makeSeed } from '../lib/seed';
const words=makeSeed('unit-test').words;
let state=123456;
const random=()=>{state=(state*1664525+1013904223)>>>0;return state/4294967296};
const original=words.map(w=>w.id);
const shuffled=shuffle(words,random);
assert.notDeepEqual(shuffled.map(w=>w.id),original);
assert.deepEqual([...shuffled.map(w=>w.id)].sort(),[...original].sort());
assert.deepEqual(words.map(w=>w.id),original,'shuffle must not mutate task snapshot');
for(const text of [...words.map(w=>w.english),'a','an',"can't",'well-known','ice cream']){
 for(let i=0;i<10;i++){
  const prompt=spellingPrompt(text,random);
  assert.ok(prompt.missing.length>=1);
  if(text.replace(/[^a-z]/gi,'').length>1)assert.ok(prompt.missing.length<text.replace(/[^a-z]/gi,'').length);
  const input=prompt.missing.map(index=>text[index]).join('');
  assert.equal(completeSpelling(text,prompt,input),text);
 }
}
const quiz=makeQuestions(words,['meaning','spelling','listening'],random);
assert.equal(quiz.length,words.length*3);
assert.equal(new Set(quiz.map(q=>`${q.word.id}|${q.type}`)).size,quiz.length);
for(const q of quiz){assert.ok(q.options.some(w=>w.id===q.word.id));assert.ok(q.options.length<=4)}
assert.ok(quiz.some((q,i)=>q.word.id!==words[Math.floor(i/3)].id));
const seed=makeSeed('unit-test');const record={...seed.learning[0],firstCompletedAt:null,ratings:JSON.stringify({[words[3].id]:'known',[words[1].id]:'unknown'}),position:2};
assert.deepEqual([...learnedWordIds(words,record)].sort(),[words[3].id],'unknown remains pending until a later recognition succeeds');
assert.equal(learnedWordIds(words,{...record,ratings:'{}',position:3}).size,3);
assert.equal(learnedWordIds(words,{...record,ratings:'{}',position:0,firstCompletedAt:'2026-10-18T00:00:00Z'}).size,words.length,'completed quizzes cover the full batch without claiming mastery');
console.log('通过：随机顺序不修改任务快照、题目完整且不重复、补全字母还原、多词性符号、随机进度识别与旧进度兼容。');
