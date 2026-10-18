import { Check,Star } from 'lucide-react';
import type { CSSProperties } from 'react';
export default function CompletionCelebration(){
 return <div className="completion-celebration" aria-hidden="true"><span className="celebration-badge"><Check size={34} strokeWidth={3}/></span>{Array.from({length:8},(_,i)=><span className={'celebration-spark spark-'+i%3} key={i} style={{'--angle':`${i*45}deg`,'--delay':`${i%3*70}ms`} as CSSProperties}>{i%2?<Star size={14} fill="currentColor"/>:'●'}</span>)}</div>;
}
