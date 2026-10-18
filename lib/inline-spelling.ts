export function fillSpellingSlots(slots:readonly string[],index:number,input:string){
 const next=[...slots];if(index<0||index>=next.length)return next;
 const letters=input.replace(/[^a-z]/gi,'').toLowerCase();
 if(!letters){next[index]='';return next}
 for(let offset=0;offset<letters.length&&index+offset<next.length;offset++)next[index+offset]=letters[offset];
 return next;
}
