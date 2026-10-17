import serverless from 'serverless-http';
import pg from 'pg';
import {createPostgresAdapter} from '../../server/postgres.mjs';
import {createRemoteApp} from '../../server/remote-app.mjs';
let handlerPromise;
export async function handler(event,context){
 if(!handlerPromise)handlerPromise=Promise.resolve().then(()=>{
  if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is not configured');
  const connection=new URL(process.env.DATABASE_URL);
  for(const key of ['sslmode','sslcert','sslkey','sslrootcert'])connection.searchParams.delete(key);
  const pool=new pg.Pool({connectionString:connection.href,max:2,idleTimeoutMillis:10000,connectionTimeoutMillis:10000,allowExitOnIdle:true,ssl:{rejectUnauthorized:true,...(process.env.DATABASE_CA?{ca:process.env.DATABASE_CA}:{})}});
  return serverless(createRemoteApp(createPostgresAdapter(pool)));
 });
 const normalized={...event,path:event.path.replace(/^\/\.netlify\/functions\/api(?=\/|$)/,'/api')};
 try{return await (await handlerPromise)(normalized,context);}catch(error){handlerPromise=null;console.error('API initialization failed:',error.code||error.name);return {statusCode:503,headers:{'Content-Type':'application/json','Cache-Control':'no-store'},body:JSON.stringify({error:'O serviço está sendo preparado. Tente novamente em instantes.'})};}
}
