// Keep unfamiliar words in the round until the student chooses unsure/known.
// Append once per encounter so other words still get their turn first.
export function advanceRecognition<T>(queue:readonly T[],index:number,rating:string){
 const next=rating==='unknown'?[...queue,queue[index]]:[...queue];
 return {queue:next,index:index+1,finished:index+1>=next.length};
}
