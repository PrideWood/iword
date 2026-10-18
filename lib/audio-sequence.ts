export async function runAudioSequence<T>(items:readonly T[],play:(item:T)=>Promise<void>,isCurrent:()=>boolean,onCurrent?:(item:T)=>void){
 for(const item of items){if(!isCurrent())return false;onCurrent?.(item);await play(item);if(!isCurrent())return false}
 return true;
}
