// Same parameterized query interface as the local SQLite service, with real pool transactions.
export function createPostgresAdapter(pool){
 function prepare(sql){let index=0;const query=sql.replace(/\?/g,()=>'$'+(++index));return {
  async get(...values){return (await pool.query(query,values)).rows[0];},
  async all(...values){return (await pool.query(query,values)).rows;},
  async run(...values){const r=await pool.query(query,values);return {changes:r.rowCount};}
 };}
 return {prepare,async transaction(fn){const client=await pool.connect();try{await client.query('BEGIN');const result=await fn(createPostgresAdapter(client));await client.query('COMMIT');return result;}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}}};
}
