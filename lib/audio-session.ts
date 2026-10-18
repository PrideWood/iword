// Feature-detect: older Safari and other browsers may not expose Audio Session.
export function configurePlaybackSession(){
 if(typeof navigator==='undefined')return false;
 const session=(navigator as Navigator&{audioSession?:{type:string}}).audioSession;
 if(!session)return false;
 try{session.type='playback';return true}catch{return false}
}
