const { Pool, types } = require('pg');
const env = require('./env');

// Return DATE columns (work_date, plan_date, due_date, next_follow_up) as plain
// 'YYYY-MM-DD' strings instead of JS Date objects — avoids timezone shifting on the client.
types.setTypeParser(1082, (value) => value);

// Enable SSL automatically for hosted providers (Neon, Supabase, etc.)
const needsSsl = /\bsslmode=require\b/.test(env.databaseUrl || '');

const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: needsSsl ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL error:', err.message);
});

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
};
