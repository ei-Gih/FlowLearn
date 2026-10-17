import type {Content} from '../../types';
export type FeedContent=Content & {source_url:string;video_url:string|null;thumbnail_url:string|null;platform:string;content_type:'video'|'youtube'|'tiktok'|'instagram'|'text'|'link';description:string;translation:string;difficulty:number;last_review:string|null;review_count:number};
export type Rating='forgot'|'partial'|'remembered';
export type Playback='loading'|'ready'|'playing'|'paused'|'blocked'|'error'|'unavailable';
export type PlayerHandle={toggle:()=>void;toggleMute:()=>void;pause:()=>void};
export type PlayerProps={content:FeedContent;active:boolean;near:boolean;onState:(state:Playback)=>void;onMuted:(muted:boolean)=>void;onWatched:()=>void};
export type FeedResponse={items:FeedContent[];total:number;due_count:number;has_more:boolean;next_offset:number;seed:string};
