import { exampleParts } from '@/lib/example-highlight';
export default function WordExample({example,term}:{example:string;term:string}){return <>{exampleParts(example,term).map((part,index)=>part.match?<strong key={index}>{part.text}</strong>:part.text)}</>}
