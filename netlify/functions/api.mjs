import serverless from 'serverless-http';
import pg from 'pg';
import {createPostgresAdapter} from '../../server/postgres.mjs';
import {createRemoteApp} from '../../server/remote-app.mjs';
import {databaseOptions} from '../../server/connection.mjs';
let handlerPromise;
export async function handler(event,context){
 if(!handlerPromise)handlerPromise=Promise.resolve().then(()=>{
  const pool=new pg.Pool(databaseOptions());
  return serverless(createRemoteApp(createPostgresAdapter(pool)));
 });
 const normalized={...event,path:event.path.replace(/^\/\.netlify\/functions\/api(?=\/|$)/,'/api')};
 try{return await (await handlerPromise)(normalized,context);}catch(error){handlerPromise=null;console.error('API initialization failed:',error.code||error.name);return {statusCode:503,headers:{'Content-Type':'application/json','Cache-Control':'no-store'},body:JSON.stringify({error:'O serviço está sendo preparado. Tente novamente em instantes.'})};}
}
