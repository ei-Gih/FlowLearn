import assert from 'node:assert/strict';
const base='http://127.0.0.1:3001/api';
async function call(path,method='GET',body,cookie=''){const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',cookie},body:body?JSON.stringify(body):undefined});return {status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
const suffix=Date.now();const a=await call('/auth/register','POST',{name:'QA',email:`qa${suffix}@example.com`,password:'Testing-only-123'});assert.equal(a.status,200);const cookie=a.cookie;
const b=await call('/auth/register','POST',{name:'Other',email:`other${suffix}@example.com`,password:'Testing-only-123'});assert.equal(b.status,200);
assert.equal((await call('/me','GET',undefined,cookie)).body.name,'QA');
const c=await call('/contents','POST',{url:'https://example.com/test',title:'Real content',transcript:'I used to live here.'},cookie);assert.equal(c.status,201);
assert.equal((await call('/contents','POST',{url:'https://example.com/test'},cookie)).status,409);
assert.equal((await call('/contents/'+c.body.id,'GET',undefined,b.cookie)).status,404);
assert.equal((await call('/contents/'+c.body.id+'/review','POST',{rating:'remembered'},cookie)).body.interval,1);
assert.equal((await call('/contents/'+c.body.id+'/review','POST',{rating:'remembered'},cookie)).body.interval,3);
assert.equal((await call('/progress','GET',undefined,cookie)).body.reviews,2);
await call('/demo','POST',{},cookie);assert.equal((await call('/progress','GET',undefined,cookie)).body.saved,1);
assert.equal((await call('/contents/'+c.body.id+'/analyze','POST',{},cookie)).status,503);
await call('/auth/logout','POST',{},cookie);assert.equal((await call('/me','GET',undefined,cookie)).status,401);
console.log('PASS: cadastro, sessão, duplicatas, isolamento, revisão, progresso, demonstração, fallback IA e logout.');
