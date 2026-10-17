let promise:Promise<any>|null=null;
export function loadYouTube():Promise<any>{
 const w=window as any;if(w.YT?.Player)return Promise.resolve(w.YT);
 if(!promise)promise=new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{promise=null;reject(new Error('Player indisponível.'));},12000);const previous=w.onYouTubeIframeAPIReady;w.onYouTubeIframeAPIReady=()=>{clearTimeout(timeout);previous?.();resolve(w.YT);};const existing=document.getElementById('youtube-player-api');if(!existing){const script=document.createElement('script');script.id='youtube-player-api';script.src='https://www.youtube.com/iframe_api';script.onerror=()=>{clearTimeout(timeout);script.remove();promise=null;reject(new Error('Player indisponível.'));};document.head.appendChild(script);}});
 return promise;
}
