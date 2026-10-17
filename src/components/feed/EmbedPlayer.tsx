import {forwardRef,useEffect,useImperativeHandle,useRef,useState} from 'react';import type {PlayerHandle,PlayerProps} from './types';import {MediaFallback} from './VideoPlayer';import {loadYouTube} from '../../services/youtube';

export function youtubeId(source:string){try{const u=new URL(source);let id=u.hostname==='youtu.be'?u.pathname.slice(1):u.searchParams.get('v')||u.pathname.split('/').filter(Boolean)[1];return /^[\w-]{11}$/.test(id||'')?id:null;}catch{return null;}}
export function tiktokId(source:string){try{return new URL(source).pathname.match(/\/(?:video|v1)\/(\d+)/)?.[1]||null;}catch{return null;}}

export const EmbedPlayer=forwardRef<PlayerHandle,PlayerProps & {provider:'youtube'|'tiktok'}>(function EmbedPlayer({content,active,onState,onMuted,onWatched,provider},ref){
 const host=useRef<HTMLDivElement>(null),frame=useRef<HTMLIFrameElement>(null),player=useRef<any>(null);const [failed,setFailed]=useState(false),[blocked,setBlocked]=useState(false);const playing=useRef(false),muted=useRef(true),activeRef=useRef(active),ready=useRef(false),disposed=useRef(false);activeRef.current=active;
 const callbacks=useRef({onState,onMuted,onWatched});callbacks.current={onState,onMuted,onWatched};
 const source=content.source_url,id=provider==='youtube'?youtubeId(source):tiktokId(source);
 function send(type:string){frame.current?.contentWindow?.postMessage({'x-tiktok-player':true,type},'https://www.tiktok.com');}
 function play(){if(!activeRef.current||!ready.current)return;if(provider==='youtube')player.current?.playVideo();else send('play');}
 function pause(){if(provider==='youtube')player.current?.pauseVideo();else send('pause');}
 function mute(value:boolean){muted.current=value;callbacks.current.onMuted(value);if(provider==='youtube')value?player.current?.mute():player.current?.unMute();else send(value?'mute':'unMute');}
 useImperativeHandle(ref,()=>({toggle(){if(playing.current)pause();else{setBlocked(false);play();}},toggleMute(){mute(!muted.current);},pause}));
 useEffect(()=>{
  if(!id){callbacks.current.onState('unavailable');return;}if(!active){callbacks.current.onState('paused');return;}disposed.current=false;setFailed(false);setBlocked(false);ready.current=false;playing.current=false;muted.current=true;callbacks.current.onMuted(true);callbacks.current.onState('loading');let cancelled=false;let instance:any;
  const timeout=setTimeout(()=>{if(!ready.current&&!cancelled){setFailed(true);callbacks.current.onState('error');}},15000);
  const state=(value:number)=>{if(cancelled)return;playing.current=value===1;if(value===1){if(!activeRef.current){pause();return;}callbacks.current.onState('playing');setBlocked(false);}else if(value===2)callbacks.current.onState('paused');else if(value===3)callbacks.current.onState('loading');else if(value===0){callbacks.current.onWatched();callbacks.current.onState('paused');}};
  const onMessage=(event:MessageEvent)=>{if(provider!=='tiktok'||event.origin!=='https://www.tiktok.com'||event.source!==frame.current?.contentWindow||event.data?.['x-tiktok-player']!==true||cancelled)return;const {type,value}=event.data;if(type==='onPlayerReady'){clearTimeout(timeout);ready.current=true;mute(true);play();}if(type==='onStateChange')state(value);if(type==='onCurrentTime'&&value?.currentTime>=Math.min(8,(value.duration||12)*.7))callbacks.current.onWatched();if(type==='onMute'){muted.current=!!value;callbacks.current.onMuted(!!value);}if(type==='onPlayerError'||type==='onError'){if(value?.errorCode===3002){setBlocked(true);callbacks.current.onState('blocked');}else{pause();setFailed(true);callbacks.current.onState('error');}}};
  window.addEventListener('message',onMessage);
  if(provider==='youtube')loadYouTube().then(YT=>{if(cancelled||!host.current)return;const slot=document.createElement('div');host.current.appendChild(slot);instance=new YT.Player(slot,{host:'https://www.youtube-nocookie.com',videoId:id,width:'100%',height:'100%',playerVars:{autoplay:0,controls:1,playsinline:1,rel:0,origin:location.origin},events:{onReady:()=>{if(cancelled)return;player.current=instance;ready.current=true;clearTimeout(timeout);mute(true);play();},onStateChange:(e:any)=>state(e.data),onError:()=>{if(cancelled)return;pause();setFailed(true);callbacks.current.onState('error');},onAutoplayBlocked:()=>{if(cancelled)return;setBlocked(true);callbacks.current.onState('blocked');}}});player.current=instance;}).catch(()=>{if(!cancelled){setFailed(true);callbacks.current.onState('error');}});
  const timer=setInterval(()=>{if(provider==='youtube'&&playing.current&&player.current?.getCurrentTime?.()>=Math.min(8,(player.current?.getDuration?.()||12)*.7))callbacks.current.onWatched();},500);
  return()=>{cancelled=true;disposed.current=true;clearTimeout(timeout);clearInterval(timer);window.removeEventListener('message',onMessage);try{pause();instance?.destroy();}catch{}player.current=null;ready.current=false;if(provider==='youtube')host.current?.replaceChildren();};
 },[active,id,provider]);
 if(!id||failed)return <MediaFallback content={content}/>;
 // External players exist only for the active item: scrolling destroys the previous iframe.
 if(!active)return <div className="feed-poster">{content.thumbnail_url&&<img src={content.thumbnail_url} alt={'Prévia de '+content.title}/>}</div>;
 return <><div className="feed-embed" ref={host}>{provider==='tiktok'&&<iframe ref={frame} title={'TikTok: '+content.title} src={`https://www.tiktok.com/player/v1/${id}?autoplay=0&controls=1&description=0&music_info=0&muted=0&loop=1`} allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"/>}</div>{blocked&&<button className="feed-play-prompt" onClick={()=>{setBlocked(false);play();}}>Toque para reproduzir</button>}</>;
});
export const YouTubeEmbed=forwardRef<PlayerHandle,PlayerProps>((props,ref)=><EmbedPlayer {...props} ref={ref} provider="youtube"/>);
export const TikTokEmbed=forwardRef<PlayerHandle,PlayerProps>((props,ref)=><EmbedPlayer {...props} ref={ref} provider="tiktok"/>);
