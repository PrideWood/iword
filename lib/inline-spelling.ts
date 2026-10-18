export function fillSpellingSlots(slots:readonly string[],index:number,input:string){
 const next=[...slots];if(index<0||index>=next.length)return next;
 const letters=input.replace(/[^a-z]/gi,'').toLowerCase();
 if(!letters){next[index]='';return next}
 for(let offset=0;offset<letters.length&&index+offset<next.length;offset++)next[index+offset]=letters[offset];
 return next;
}
export class SpellingKeyGuard{
 private held='';private press=0;private accepted:{letter:string;time:number;press:number}|undefined;
 keyDown(key:string,repeat:boolean){
  const letter=key.toLowerCase();if(!/^[a-z]$/.test(letter))return true;
  if(repeat||this.held===letter)return false;this.held=letter;this.press++;return true;
 }
 keyUp(){this.held=''}
 accept(letter:string,time:number){
  const prior=this.accepted;
  if(prior?.letter===letter&&prior.press===this.press&&time-prior.time<140)return false;
  this.accepted={letter,time,press:this.press};return true;
 }
}
