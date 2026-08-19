const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../config/db');
const { signToken, verifyToken } = require('../utils/jwt');
const { authenticate } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// Register a user.
// - If no users exist yet, the first one is created as an admin (bootstrap), no auth needed.
// - Otherwise, only an admin or manager (Bearer token) may create users.
router.post('/register', asyncHandler(async (req, res) => {
  const { name, email, phone, password, role, manager_id } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email and password are required' });
  }

  const { rows: countRows } = await query('SELECT count(*)::int AS c FROM users');
  const isFirstUser = countRows[0].c === 0;

  let finalRole = role || 'sales';
  if (isFirstUser) {
    finalRole = 'admin';
  } else {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Only an admin or manager can create users' });
    try {
      const decoded = verifyToken(token);
      if (!['admin', 'manager'].includes(decoded.role)) {
        return res.status(403).json({ error: 'Only an admin or manager can create users' });
      }
    } catch {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  }

  const hash = await bcrypt.hash(password, 10);
  const { rows } = await query(
    `INSERT INTO users (name, email, phone, password_hash, role, manager_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, name, email, phone, role, manager_id, is_active, created_at`,
    [name, email, phone || null, hash, finalRole, manager_id || null]
  );
  res.status(201).json({ user: rows[0] });
}));

// Login → returns a JWT token + user profile.
router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }
  const { rows } = await query('SELECT * FROM users WHERE email = $1', [email]);
  const user = rows[0];
  if (!user || !user.is_active) return res.status(401).json({ error: 'Invalid credentials' });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  const token = signToken({ id: user.id, role: user.role, name: user.name });
  delete user.password_hash;
  res.json({ token, user });
}));

// Current logged-in user's profile.
router.get('/me', authenticate, asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT id, name, email, phone, role, manager_id, is_active, created_at
     FROM users WHERE id = $1`,
    [req.user.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'User not found' });
  res.json({ user: rows[0] });
}));

module.exports = router;
