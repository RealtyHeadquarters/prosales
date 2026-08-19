const express = require('express');
const { query } = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// Read app settings (any logged-in user — apps need the geofence radius for UI).
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const { rows } = await query('SELECT * FROM app_settings WHERE id = 1');
  res.json({ settings: rows[0] });
}));

// Update settings (admin only).
router.patch('/', authenticate, authorize('admin'), asyncHandler(async (req, res) => {
  const { geofence_enforce, default_geofence_radius_m } = req.body;
  const sets = [];
  const params = [];
  if (geofence_enforce !== undefined) {
    params.push(Boolean(geofence_enforce));
    sets.push(`geofence_enforce = $${params.length}`);
  }
  if (default_geofence_radius_m !== undefined) {
    params.push(parseInt(default_geofence_radius_m, 10));
    sets.push(`default_geofence_radius_m = $${params.length}`);
  }
  if (sets.length === 0) return res.status(400).json({ error: 'No fields to update' });
  const { rows } = await query(
    `UPDATE app_settings SET ${sets.join(', ')}, updated_at = now() WHERE id = 1 RETURNING *`,
    params
  );
  res.json({ settings: rows[0] });
}));

module.exports = router;
