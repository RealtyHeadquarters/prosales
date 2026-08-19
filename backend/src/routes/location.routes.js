const express = require('express');
const { query } = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// Record a single live-location ping (called periodically by the mobile app).
router.post('/', authenticate, asyncHandler(async (req, res) => {
  const { lat, lng, accuracy, speed, battery } = req.body;
  if (lat == null || lng == null) {
    return res.status(400).json({ error: 'lat and lng are required' });
  }
  const { rows } = await query(
    `INSERT INTO location_pings (user_id, lat, lng, accuracy, speed, battery)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [req.user.id, lat, lng, accuracy ?? null, speed ?? null, battery ?? null]
  );
  res.status(201).json({ ping: rows[0] });
}));

// Batch upload pings (used to sync data recorded while offline).
router.post('/batch', authenticate, asyncHandler(async (req, res) => {
  const pings = req.body.pings;
  if (!Array.isArray(pings) || pings.length === 0) {
    return res.status(400).json({ error: 'pings array is required' });
  }
  const values = [];
  const params = [];
  let i = 1;
  for (const p of pings) {
    if (p.lat == null || p.lng == null) continue;
    values.push(`($${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++})`);
    params.push(
      req.user.id, p.lat, p.lng,
      p.accuracy ?? null, p.speed ?? null, p.battery ?? null,
      p.recorded_at ?? new Date().toISOString()
    );
  }
  if (values.length === 0) return res.status(400).json({ error: 'No valid pings' });
  await query(
    `INSERT INTO location_pings (user_id, lat, lng, accuracy, speed, battery, recorded_at)
     VALUES ${values.join(', ')}`,
    params
  );
  res.status(201).json({ inserted: values.length });
}));

// Latest known location of every rep active in the last 24h (admin/manager — live map).
router.get('/live', authenticate, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT DISTINCT ON (lp.user_id)
       lp.user_id, lp.lat, lp.lng, lp.accuracy, lp.speed, lp.battery, lp.recorded_at,
       u.name AS user_name
     FROM location_pings lp
     JOIN users u ON u.id = lp.user_id
     WHERE lp.recorded_at > now() - interval '24 hours'
     ORDER BY lp.user_id, lp.recorded_at DESC`
  );
  res.json({ locations: rows });
}));

// A rep's location trail. Reps can only see their own; admin/manager can see anyone.
// Filter by ?from=ISO&to=ISO.
router.get('/track/:userId', authenticate, asyncHandler(async (req, res) => {
  const { userId } = req.params;
  if (req.user.role === 'sales' && req.user.id !== userId) {
    return res.status(403).json({ error: 'You can only view your own track' });
  }
  const { from, to } = req.query;
  const params = [userId];
  const clauses = ['user_id = $1'];
  if (from) { params.push(from); clauses.push(`recorded_at >= $${params.length}`); }
  if (to) { params.push(to); clauses.push(`recorded_at <= $${params.length}`); }
  const { rows } = await query(
    `SELECT lat, lng, accuracy, speed, battery, recorded_at
     FROM location_pings
     WHERE ${clauses.join(' AND ')}
     ORDER BY recorded_at ASC
     LIMIT 5000`,
    params
  );
  res.json({ track: rows });
}));

module.exports = router;
