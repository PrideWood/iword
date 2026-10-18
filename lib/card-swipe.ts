export type CardRating='unknown'|'unsure'|'known';
export function swipeDirection(x:number,y:number):CardRating|null{
 if(Math.abs(x)>Math.abs(y)*1.1)return x>0?'known':'unknown';
 if(y>Math.abs(x)*1.1)return 'unsure';
 return null;
}
export function swipeRating(x:number,y:number,elapsed:number,width:number):CardRating|null{
 const direction=swipeDirection(x,y);if(!direction)return null;
 const distance=direction==='unsure'?y:Math.abs(x),threshold=Math.max(64,Math.min(100,width*.25));
 return distance>=threshold||distance>=36&&distance/Math.max(1,elapsed)>.65?direction:null;
}
