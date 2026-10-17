export function databaseOptions(env=process.env){
 if(!env.DATABASE_URL)throw new Error('Database connection is not configured');
 const connection=new URL(env.DATABASE_URL);
 if(!['postgres:','postgresql:'].includes(connection.protocol))throw new Error('Invalid database connection protocol');
 if(env.DATABASE_PASSWORD)connection.password=encodeURIComponent(env.DATABASE_PASSWORD);
 if(decodeURIComponent(connection.password).includes('[YOUR-PASSWORD]'))throw new Error('Database password is not configured');
 for(const key of ['sslmode','sslcert','sslkey','sslrootcert'])connection.searchParams.delete(key);
 return {connectionString:connection.href,max:2,idleTimeoutMillis:10000,connectionTimeoutMillis:10000,allowExitOnIdle:true,ssl:{rejectUnauthorized:true,...(env.DATABASE_CA?{ca:env.DATABASE_CA}:{})}};
}
