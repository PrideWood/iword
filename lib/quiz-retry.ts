import { shuffle,type Question } from './learning';
export type QuizAnswer={wordId:string;type:string;answer:string};
export function advanceQuiz(questions:Question[],index:number,answers:QuizAnswer[],answer:string,correct:boolean){
 const current=questions[index];
 if(!current)throw Error('题目不存在');
 // Keep exactly one first-attempt answer per word/type for the server's score.
 const recorded=answers.some(a=>a.wordId===current.word.id&&a.type===current.type);
 const nextAnswers=recorded?answers:[...answers,{wordId:current.word.id,type:current.type,answer}];
 const nextQuestions=correct?questions:[...questions,{...current,options:shuffle(current.options)}];
 return {answers:nextAnswers,questions:nextQuestions,finished:index+1>=nextQuestions.length};
}
