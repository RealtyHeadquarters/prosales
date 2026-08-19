// Creates a first admin user so you can log in. Safe to run repeatedly.
// Usage: npm run seed
const bcrypt = require('bcryptjs');
const { pool } = require('../src/config/db');

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@prosales.com';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'Admin@123';

(async () => {
  try {
    const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, 'admin')
       ON CONFLICT (email) DO NOTHING`,
      ['Admin', ADMIN_EMAIL, hash]
    );
    console.log('✅ Admin ready.');
    console.log(`   email:    ${ADMIN_EMAIL}`);
    console.log(`   password: ${ADMIN_PASSWORD}`);
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
