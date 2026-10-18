// Feature-detect: older Safari and other browsers may not expose Audio Session.
export function configurePlaybackSession(){
 if(typeof navigator==='undefined')return false;
 const session=(navigator as Navigator&{audioSession?:{type:string}}).audioSession;
 if(!session)return false;
 try{session.type='playback';return true}catch{return false}
}
export function usesStandaloneAudio(){
 if(typeof window==='undefined'||typeof navigator==='undefined')return false;
 return (navigator as Navigator&{standalone?:boolean}).standalone===true||window.matchMedia?.('(display-mode: standalone)').matches===true;
}
