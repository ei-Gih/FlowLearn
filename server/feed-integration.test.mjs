import {test} from 'node:test';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {fileURLToPath} from 'node:url';
test('API do feed: mídia, isolamento, paginação e revisão sem duplicação',async t=>{
 const port=41000+process.pid%1000,base=`http://127.0.0.1:${port}/api`;
 const child=spawn(process.execPath,['server/index.mjs'],{cwd:fileURLToPath(new URL('../',import.meta.url)),env:{...process.env,PORT:String(port),DB_PATH:':memory:'},stdio:['ignore','pipe','pipe']});
 t.after(()=>child.kill());await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('API não iniciou.')),10000);child.stdout.on('data',data=>{if(String(data).includes('EnglishFlow API')){clearTimeout(timeout);resolve();}});child.on('error',reject);child.on('exit',code=>{if(code!==null&&code!==0)reject(new Error('API encerrou: '+code));});});
 async function call(path,method='GET',body,cookie=''){const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',cookie},body:body?JSON.stringify(body):undefined});return {status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
 const a=await call('/auth/register','POST',{name:'Feed QA',email:'feed@example.com',password:'test-password-only'}),b=await call('/auth/register','POST',{name:'Other QA',email:'other@example.com',password:'test-password-only'});assert.equal(a.status,200);const cookie=a.cookie;
 const c=await call('/contents','POST',{url:'https://www.tiktok.com/@demo/video/123456789',title:'My English',transcript:'I used to read.',video_url:'https://example.com/owned.mp4'},cookie);assert.equal(c.status,201);assert.equal(c.body.source_url,'https://www.tiktok.com/@demo/video/123456789');assert.equal(c.body.video_url,'https://example.com/owned.mp4');
 assert.equal((await call('/contents','POST',{url:'https://example.com/invalid',video_url:'javascript:alert(1)'},cookie)).status,400);
 await call('/demo','POST',{},cookie);await call('/demo','POST',{},cookie);
 const first=await call('/feed?limit=2&seed=stable','GET',undefined,cookie);assert.equal(first.body.total,6);assert.equal(first.body.items.length,2);assert.equal(first.body.due_count,6);assert.equal((await call('/feed','GET',undefined,b.cookie)).body.total,0);
 const native=first.body.items.find(x=>x.demo)||((await call('/feed?limit=30','GET',undefined,cookie)).body.items.find(x=>x.demo));assert.equal(native.content_type,'video');assert.ok(native.video_url.startsWith('/demo/'));
 const secondBefore=await call('/feed?offset=2&limit=30&seed=stable','GET',undefined,cookie);
 const rated=first.body.items[0];const r=await call('/contents/'+rated.id+'/review','POST',{rating:'remembered',request_key:'retry-safe'},cookie);assert.equal(r.body.interval,1);assert.equal(r.body.review_count,1);const retry=await call('/contents/'+rated.id+'/review','POST',{rating:'remembered',request_key:'retry-safe'},cookie);assert.equal(retry.body.review_count,1);
 const secondAfter=await call('/feed?offset=2&limit=30&seed=stable','GET',undefined,cookie);assert.deepEqual(secondAfter.body.items.map(x=>x.id),secondBefore.body.items.map(x=>x.id));assert.equal(secondAfter.body.due_count,5);
 assert.equal((await call('/contents/'+rated.id,'GET',undefined,cookie)).body.history.length,1);assert.equal((await call('/contents/'+rated.id+'/review','POST',{rating:'forgot'},b.cookie)).status,404);
 const favorite=await call('/contents/'+rated.id,'PATCH',{favorite:true},cookie);assert.equal(favorite.body.favorite,true);
 const page=await fetch(base.replace('/api','')+native.video_url,{headers:{Range:'bytes=0-99'}});assert.equal(page.status,206);assert.equal(page.headers.get('content-type'),'video/mp4');
 assert.equal((await call('/progress','GET',undefined,cookie)).body.saved,1);
 assert.equal((await call('/feed')).status,401);
});
