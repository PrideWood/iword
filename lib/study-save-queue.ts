/** Serial, retryable writes: keep the same event ID until the server acknowledges it. */
export class StudySaveQueue<T> {
 private items:T[]=[];
 private running:Promise<boolean>|null=null;
 private failed=false;
 constructor(private save:(item:T)=>Promise<boolean>,private changed:(count:number,failed:boolean)=>void){}
 get size(){return this.items.length}
 enqueue(item:T){this.items.push(item);this.changed(this.size,this.failed);if(!this.failed)void this.flush()}
 flush():Promise<boolean>{
  if(this.running)return this.running;
  if(this.failed)return Promise.resolve(false);
  this.running=this.drain().finally(()=>{this.running=null});return this.running;
 }
 retry(){this.failed=false;this.changed(this.size,false);return this.flush()}
 private async drain(){
  while(this.items.length){
   let ok=false;try{ok=await this.save(this.items[0])}catch{/* Keep the failed item for explicit retry. */}
   if(!ok){this.failed=true;this.changed(this.size,true);return false}
   this.items.shift();this.changed(this.size,false);
  }
  return true;
 }
}
