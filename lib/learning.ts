import type { Learning, Word } from './types';
export type QuestionType='meaning'|'spelling'|'listening';
export type SpellingPrompt={masked:string;missing:number[]};
export type Question={word:Word;type:QuestionType;options:Word[];spelling:SpellingPrompt};
export function shuffle<T>(items:readonly T[],random= Math.random):T[]{
 const result=[...items];for(let i=result.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[result[i],result[j]]=[result[j],result[i]]}return result;
}
export function spellingPrompt(text:string,random=Math.random):SpellingPrompt{
 const letters=[...text].map((char,index)=>/[a-z]/i.test(char)?index:-1).filter(index=>index>=0);
 const candidates=letters.length>2?letters.slice(1):letters;
 const count=Math.min(4,Math.max(1,Math.floor(letters.length*.4)),Math.max(1,letters.length-1));
 const missing=shuffle(candidates,random).slice(0,count).sort((a,b)=>a-b);
 return {missing,masked:[...text].map((char,index)=>missing.includes(index)?'_':char).join('')};
}
export function completeSpelling(text:string,prompt:SpellingPrompt,input:string){
 let index=0;return [...text].map((char,position)=>prompt.missing.includes(position)?(input[index++]||''):char).join('');
}
export function makeQuestions(words:Word[],types:QuestionType[],random=Math.random):Question[]{
 return shuffle(words.flatMap(word=>types.map(type=>{
  const key=(w:Word)=>type==='meaning'?w.meaning:w.english.toLowerCase();
  const seen=new Set([key(word)]);
  const distractors=shuffle(words,random).filter(w=>{if(seen.has(key(w)))return false;seen.add(key(w));return true}).slice(0,3);
  return {word,type,options:shuffle([word,...distractors],random),spelling:spellingPrompt(word.english,random)};
 })),random);
}
export function learnedWordIds(words:Word[],record:Learning|undefined){
 // A submitted complete quiz has covered every word, even if the recognition cards were skipped.
 if(record?.firstCompletedAt)return new Set(words.map(word=>word.id));
 const ratings:Record<string,string>=JSON.parse(record?.ratings||'{}');
 // Old sessions used snapshot position; retain progress when upgrading.
 if(!Object.keys(ratings).length&&record?.position)return new Set(words.slice(0,record.position).map(w=>w.id));
 return new Set(words.filter(w=>Object.hasOwn(ratings,w.id)&&ratings[w.id]!=='unknown').map(w=>w.id));
}
