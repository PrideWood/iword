export type LessonViewport={width:number;height:number;keyboard:boolean;inset:number};
export function lessonViewport(previous:LessonViewport|undefined,next:{width:number;height:number;visualHeight:number;editing:boolean}):LessonViewport{
 const rotated=!!previous&&Math.abs(next.width-previous.width)>80;
 const baseline=previous&&!rotated?previous.height:next.height;
 const covered=next.height-next.visualHeight>140;
 const shrank=baseline-next.visualHeight>140;
 const closing=!!previous?.keyboard&&baseline-next.visualHeight>24;
 const keyboard=!rotated&&(covered||(shrank&&next.editing)||closing);
 return {width:next.width,height:keyboard?baseline:next.height,keyboard,inset:keyboard?Math.max(0,baseline-next.visualHeight):0};
}
