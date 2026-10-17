import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {PGlite} from '@electric-sql/pglite';import serverless from 'serverless-http';import {createPostgresAdapter} from './postgres.mjs';import {createRemoteApp} from './remote-app.mjs';
test('Netlify Functions com PostgreSQL: autenticação, biblioteca, revisão e persistência entre instâncias',async t=>{
 const pg=new PGlite();t.after(()=>pg.close());await pg.exec(await readFile(new URL('../netlify/database/migrations/20261017010000_englishflow.sql',import.meta.url),'utf8'));
 const pool={query:(sql,values)=>pg.query(sql,values),connect:async()=>({query:(sql,values)=>pg.query(sql,values),release(){}})};
 const db=createPostgresAdapter(pool);let handler=serverless(createRemoteApp(db));
 async function call(path,method='GET',body,cookie=''){const response=await handler({path:'/api'+path,httpMethod:method,headers:{'content-type':'application/json',cookie},queryStringParameters:null,body:body?JSON.stringify(body):null,isBase64Encoded:false,requestContext:{identity:{sourceIp:'127.0.0.1'}}},{});const set=response.multiValueHeaders?.['set-cookie']?.[0]||response.headers?.['set-cookie'];return {status:response.statusCode,body:JSON.parse(response.body),cookie:set?.split(';')[0],headers:response.headers};}
 assert.equal((await call('/health')).status,200);assert.equal((await call('/me')).status,401);
 const a=await call('/auth/register','POST',{name:'Netlify QA',email:'netlify@example.com',password:'Testing-password-123'});assert.equal(a.status,200);assert.ok(a.cookie);const cookie=a.cookie;
 const b=await call('/auth/register','POST',{name:'Other QA',email:'other@example.com',password:'Testing-password-123'});assert.equal(b.status,200);
 assert.equal((await call('/me','GET',null,cookie)).body.name,'Netlify QA');assert.equal((await call('/auth/login','POST',{email:'netlify@example.com',password:'incorrect'},cookie)).status,401);
 const c=await call('/contents','POST',{url:'https://www.youtube.com/watch?v=M7lc1UVf-VE',title:'English lesson',transcript:'I used to live here.'},cookie);assert.equal(c.status,201);assert.equal(c.body.content_type,'youtube');assert.equal((await call('/contents/'+c.body.id,'GET',null,b.cookie)).status,404);
 assert.equal((await call('/contents','POST',{url:c.body.url},cookie)).status,409);
 assert.equal((await call('/demo','POST',{},cookie)).status,200);assert.equal((await call('/demo','POST',{},cookie)).status,200);let feed=await call('/feed','GET',null,cookie);assert.equal(feed.body.total,6);assert.equal(feed.body.due_count,6);
 const ordered=feed.body.items.map(x=>x.id);const r=await call('/contents/'+c.body.id+'/review','POST',{rating:'remembered',request_key:'same-request'},cookie);assert.equal(r.body.interval,1);assert.equal((await call('/contents/'+c.body.id+'/review','POST',{rating:'remembered',request_key:'same-request'},cookie)).body.review_count,1);
 // A new function instance uses the same durable feed ordering and sessions.
 handler=serverless(createRemoteApp(db));feed=await call('/feed','GET',null,cookie);assert.deepEqual(feed.body.items.map(x=>x.id),ordered);assert.equal(feed.body.due_count,5);
 const stats=await call('/progress','GET',null,cookie);assert.equal(stats.body.saved,1);assert.equal(stats.body.reviews,1);assert.equal(stats.body.retention,100);
 assert.equal((await call('/contents/'+c.body.id,'PATCH',{favorite:true},cookie)).body.favorite,true);assert.equal((await call('/contents/'+c.body.id,'GET',null,cookie)).body.history.length,1);
 assert.equal((await call('/auth/forgot','POST',{email:'netlify@example.com'},cookie)).status,503);
 assert.equal((await call('/auth/logout','POST',{},cookie)).status,200);assert.equal((await call('/me','GET',null,cookie)).status,401);
});
