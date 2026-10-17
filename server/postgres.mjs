// Same parameterized query interface as the local SQLite service, with real pool transactions.
export function createPostgresAdapter(pool){
 function prepare(sql){let index=0;const scoped=sql.replace(/\b(FROM|JOIN|INTO|UPDATE)\s+(users|sessions|resets|contents|reviews|exercises|exercise_answers|feed_sessions|auth_rate_limits)\b/gi,(_,verb,table)=>verb+' englishflow.'+table);const query=scoped.replace(/\?/g,()=>'$'+(++index));return {
  async get(...values){return (await pool.query(query,values)).rows[0];},
  async all(...values){return (await pool.query(query,values)).rows;},
  async run(...values){const r=await pool.query(query,values);return {changes:r.rowCount};}
 };}
 return {prepare,async transaction(fn){const client=await pool.connect();try{await client.query('BEGIN');const result=await fn(createPostgresAdapter(client));await client.query('COMMIT');return result;}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}}};
}
