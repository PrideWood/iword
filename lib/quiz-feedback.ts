import { completeSpelling,type Question } from './learning';
export const CORRECT_ANSWER_DELAY=700;
export function quizAnswer(question:Question,input:string){return question.type==='spelling'?completeSpelling(question.word.english,question.spelling,input):input}
export function judgeQuizAnswer(question:Question,input:string){
 const expected=question.type==='meaning'?question.word.meaning:question.word.english;
 return quizAnswer(question,input).trim().toLowerCase()===expected.trim().toLowerCase();
}
export function quizOptionState(correct:boolean,selected:boolean,feedback:boolean|null){
 if(feedback===null)return '';
 return correct?'correct':selected&&!feedback?'incorrect':'';
}
