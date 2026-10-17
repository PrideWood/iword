export type Word={id:string;bookId:string;english:string;phonetic:string;pos:string;meaning:string;example:string};
export type Classroom={id:string;ownerId:string;name:string;major:string;createdAt:string};
export type Student={id:string;ownerId:string;classId:string;userId:string|null;name:string;number:string};
export type Book={id:string;ownerId:string;name:string;description:string;color:string};
export type Task={id:string;ownerId:string;name:string;bookId:string;classId:string;startAt:string;deadline:string;status:string;wordSnapshot:string;rulesSnapshot:string;createdAt:string};
export type Learning={id:string;ownerId:string;taskId:string;studentId:string;position:number;ratings:string;activeSeconds:number;startedAt:string|null;lastSeenAt:string|null;firstCompletedAt:string|null};
export type Attempt={id:string;ownerId:string;taskId:string;studentId:string;answers:string;correct:number;total:number;completedAt:string;practice:number};
export type Workspace={classes:Classroom[];students:Student[];books:Book[];words:Word[];tasks:Task[];learning:Learning[];attempts:Attempt[]};
