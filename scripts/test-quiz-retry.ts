import assert from 'node:assert/strict';
import { makeQuestions } from '../lib/learning';
import { advanceQuiz,type QuizAnswer } from '../lib/quiz-retry';
const word={id:'word',bookId:'b',english:'network',meaning:'网络',phonetic:'',pos:'',example:''};
for(const type of ['meaning','listening','spelling'] as const){
 let questions=makeQuestions([word,{...word,id:'other',english:'device',meaning:'设备'}],[type]),answers:QuizAnswer[]=[];
 const first=questions[0];
 let step=advanceQuiz(questions,0,answers,'wrong',false);assert.equal(step.finished,false);assert.equal(step.questions.length,3);questions=step.questions;answers=step.answers;
 step=advanceQuiz(questions,1,answers,'correct',true);questions=step.questions;answers=step.answers;assert.equal(step.finished,false);
 for(let i=2;i<6;i++){step=advanceQuiz(questions,i,answers,'wrong again',false);questions=step.questions;answers=step.answers;assert.equal(step.finished,false);assert.equal(questions.at(-1)!.word.id,first.word.id)}
 step=advanceQuiz(questions,6,answers,'finally correct',true);assert.equal(step.finished,true);assert.equal(step.answers.length,2);assert.equal(step.answers[0].answer,'wrong','first attempt score must not be overwritten');
 assert.equal(new Set(step.answers.map(a=>a.wordId+':'+a.type)).size,2);
}
const questions=makeQuestions([word],['meaning']);assert.equal(advanceQuiz(questions,0,[],'网络',true).finished,true);
console.log('通过：选择/听音/拼写错题多次入队、答对才结束、最后一题答错不提交、首次作答唯一保留、全对直接完成。');
