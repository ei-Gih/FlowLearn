import {createHash} from 'node:crypto';

export function mediaInfo(source,videoUrl='') {
 let u;try{u=new URL(source,'http://localhost');}catch{return {platform:'Link',content_type:'link'};}
 const host=u.hostname.toLowerCase();
 if(videoUrl||/\.(mp4|webm|ogv|mov)$/i.test(u.pathname)){const platform=['youtube.com','www.youtube.com','m.youtube.com','youtu.be','www.youtube-nocookie.com'].includes(host)?'YouTube':host==='tiktok.com'||host.endsWith('.tiktok.com')?'TikTok':host==='instagram.com'||host.endsWith('.instagram.com')?'Instagram':'Vídeo próprio';return {platform,content_type:'video'};}
 if(['youtube.com','www.youtube.com','m.youtube.com','youtu.be','www.youtube-nocookie.com'].includes(host))return {platform:'YouTube',content_type:'youtube'};
 if(host==='tiktok.com'||host.endsWith('.tiktok.com'))return {platform:'TikTok',content_type:'tiktok'};
 if(host==='instagram.com'||host.endsWith('.instagram.com'))return {platform:'Instagram',content_type:'instagram'};
 return {platform:'Link',content_type:'link'};
}

// Additive and repeatable: old content IDs, URLs, review dates and sessions survive.
export function migrateFeed(db) {
 db.exec('BEGIN');
 try {
  const fields=new Set(db.prepare('PRAGMA table_info(contents)').all().map(c=>c.name));
  for(const [name,type] of Object.entries({video_url:'TEXT',thumbnail_url:'TEXT',description:'TEXT',platform:'TEXT',content_type:'TEXT'}))if(!fields.has(name))db.exec(`ALTER TABLE contents ADD COLUMN ${name} ${type}`);
  const reviewFields=new Set(db.prepare('PRAGMA table_info(reviews)').all().map(c=>c.name));
  if(!reviewFields.has('request_key'))db.exec('ALTER TABLE reviews ADD COLUMN request_key TEXT');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS review_request ON reviews(user_id,request_key); CREATE INDEX IF NOT EXISTS feed_owner_due ON contents(user_id,next_review);');
  const update=db.prepare('UPDATE contents SET platform=?,content_type=?,video_url=? WHERE id=?');
  for(const c of db.prepare('SELECT * FROM contents WHERE content_type IS NULL').all()) {
   const info=mediaInfo(c.url,c.video_url);const direct=info.content_type==='video'?(c.video_url||c.url):null;
   update.run(c.demo?'Demonstração':info.platform,c.demo?'text':info.content_type,direct,c.id);
  }
  db.exec('COMMIT');
 }catch(e){db.exec('ROLLBACK');throw e;}
}

export function localDay(value){return new Date(value).toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});}
export function isDueToday(c,now=Date.now()){return localDay(c.next_review)<=localDay(now);}
export function feedTier(c,now=Date.now()) {
 const dueDay=localDay(c.next_review),today=localDay(now);
 if(c.reviews>0&&dueDay<today)return 0;
 if(c.reviews>0&&dueDay===today)return 1;
 if(c.reviews>0&&(c.errors>c.correct||c.correct/c.reviews<.6))return 2;
 if(c.reviews===0)return 3;
 if(c.step>=4)return 5;
 return 4;
}
export function smartOrder(contents,seed,now=Date.now()) {
 const score=c=>{const jitter=createHash('sha256').update(seed+':'+c.id).digest().readUInt32BE(0)/0xffffffff;return (c.errors||0)*3+(c.analysis?.difficulty||2)+(Math.max(0,(now-Date.parse(c.next_review))/86400000))*.1+jitter*2;};
 return [...contents].sort((a,b)=>feedTier(a,now)-feedTier(b,now)||score(b)-score(a)||a.id.localeCompare(b.id));
}
export function getFeedContents(db,userId,pack){return db.prepare('SELECT * FROM contents WHERE user_id=?').all(userId).map(pack);}
const snapshots=new WeakMap();
export function getSmartFeed(db,userId,{offset=0,limit=12,seed='flow',now=Date.now()}={},pack) {
 const all=getFeedContents(db,userId,pack);let cache=snapshots.get(db);if(!cache){cache=new Map();snapshots.set(db,cache);}
 for(const [key,snapshot] of cache)if(snapshot.expires<now)cache.delete(key);
 const key=userId+':'+seed;let snapshot=cache.get(key);
 if(!snapshot){if(cache.size>=1000)cache.delete(cache.keys().next().value);snapshot={ids:smartOrder(all,seed,now).map(c=>c.id),expires:now+3600000};cache.set(key,snapshot);}
 // Keep pagination stable while reviews change priority. A new seed starts a fresh ranking.
 const byId=new Map(all.map(c=>[c.id,c]));const ordered=snapshot.ids.map(id=>byId.get(id)).filter(Boolean);
 return {items:ordered.slice(offset,offset+limit),total:all.length,due_count:all.filter(c=>isDueToday(c,now)).length,has_more:offset+limit<all.length,next_offset:Math.min(offset+limit,all.length),seed};
}

export function optionalMediaUrl(value){if(value===undefined||value===null||value==='')return null;if(typeof value!=='string'||value.length>2048)throw Object.assign(new Error('URL de mídia inválida.'),{status:400});if(/^\/demo\/[a-z0-9-]+\.(svg|mp4|webm)$/.test(value))return value;let u;try{u=new URL(value);}catch{throw Object.assign(new Error('URL de mídia inválida.'),{status:400});}if(!['http:','https:'].includes(u.protocol)||u.username||u.password)throw Object.assign(new Error('Use uma URL HTTP ou HTTPS para a mídia.'),{status:400});return u.href;}
