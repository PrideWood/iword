import assert from 'node:assert/strict';
import { makeQuestions } from '../lib/learning';
import { CORRECT_ANSWER_DELAY,judgeQuizAnswer,quizAnswer,quizOptionState } from '../lib/quiz-feedback';
const word={id:'one',bookId:'book',english:'network',meaning:'网络',phonetic:'',pos:'n.',example:''};
const questions=makeQuestions([word,{...word,id:'two',english:'device',meaning:'设备'}],['meaning','listening','spelling']);
for(const question of questions){
 const expected=question.type==='meaning'?question.word.meaning:question.word.english;
 const input=question.type==='spelling'?question.spelling.missing.map(i=>question.word.english[i]).join(''):expected;
 assert.equal(judgeQuizAnswer(question,input),true);assert.equal(quizAnswer(question,input),expected);
 assert.equal(judgeQuizAnswer(question,'z'.repeat(question.spelling.missing.length)),false);
}
assert.equal(quizOptionState(true,false,null),'');
assert.equal(quizOptionState(true,true,true),'correct');
assert.equal(quizOptionState(true,false,false),'correct');
assert.equal(quizOptionState(false,true,false),'incorrect');
assert.equal(quizOptionState(false,false,false),'');
assert.equal(quizOptionState(false,false,true),'');
assert.ok(CORRECT_ANSWER_DELAY>=500&&CORRECT_ANSWER_DELAY<=1000);
console.log('通过：释义/听音/补全即时判分、答对主题绿、错选红色与正确答案绿色、无关选项无高亮及短暂停留。');
