const express = require('express');
const { query } = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// Check in for the day (this is the "login time"). Idempotent — keeps the first check-in.
router.post('/check-in', authenticate, asyncHandler(async (req, res) => {
  const { lat, lng } = req.body;
  const { rows } = await query(
    `INSERT INTO attendance (user_id, work_date, check_in_at, check_in_lat, check_in_lng)
     VALUES ($1, CURRENT_DATE, now(), $2, $3)
     ON CONFLICT (user_id, work_date) DO UPDATE
       SET check_in_at  = COALESCE(attendance.check_in_at,  EXCLUDED.check_in_at),
           check_in_lat = COALESCE(attendance.check_in_lat, EXCLUDED.check_in_lat),
           check_in_lng = COALESCE(attendance.check_in_lng, EXCLUDED.check_in_lng)
     RETURNING *`,
    [req.user.id, lat ?? null, lng ?? null]
  );
  res.status(201).json({ attendance: rows[0] });
}));

// Check out for the day.
router.post('/check-out', authenticate, asyncHandler(async (req, res) => {
  const { lat, lng } = req.body;
  const { rows } = await query(
    `UPDATE attendance
       SET check_out_at = now(), check_out_lat = $2, check_out_lng = $3
     WHERE user_id = $1 AND work_date = CURRENT_DATE
     RETURNING *`,
    [req.user.id, lat ?? null, lng ?? null]
  );
  if (!rows[0]) return res.status(400).json({ error: 'No check-in found for today' });
  res.json({ attendance: rows[0] });
}));

// My attendance history (last 60 days).
router.get('/me', authenticate, asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT * FROM attendance WHERE user_id = $1 ORDER BY work_date DESC LIMIT 60`,
    [req.user.id]
  );
  res.json({ attendance: rows });
}));

// Team attendance (admin/manager). Filter by ?date=YYYY-MM-DD and/or ?user_id=.
router.get('/', authenticate, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const { date, user_id } = req.query;
  const params = [];
  const clauses = [];
  if (date) { params.push(date); clauses.push(`a.work_date = $${params.length}`); }
  if (user_id) { params.push(user_id); clauses.push(`a.user_id = $${params.length}`); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const { rows } = await query(
    `SELECT a.*, u.name AS user_name
     FROM attendance a JOIN users u ON u.id = a.user_id
     ${where}
     ORDER BY a.work_date DESC, u.name
     LIMIT 500`,
    params
  );
  res.json({ attendance: rows });
}));

module.exports = router;
