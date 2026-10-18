export function exampleParts(example:string,term:string){
 const value=term.trim();if(!value)return [{text:example,match:false}];
 const escaped=value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const pattern=new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`,'giu');
 const parts:{text:string;match:boolean}[]=[];let start=0;
 for(const match of example.matchAll(pattern)){const index=match.index!;if(index>start)parts.push({text:example.slice(start,index),match:false});parts.push({text:match[0],match:true});start=index+match[0].length}
 if(start<example.length)parts.push({text:example.slice(start),match:false});return parts;
}
