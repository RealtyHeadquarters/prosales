const express = require('express');
const { query } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const upload = require('../config/upload');
const { distanceMeters } = require('../utils/geo');

const router = express.Router();

// Log a client visit (with meeting details in `notes`).
// Geo-fencing: when enforced, a *completed* meeting must be logged from within the
// client's allowed radius, and the rep's location is required — this blocks fake visits.
router.post('/', authenticate, asyncHandler(async (req, res) => {
  const { client_id, purpose, notes, outcome, status, check_in_at, check_out_at, lat, lng, next_follow_up, scheduled_at } = req.body;
  if (!client_id) return res.status(400).json({ error: 'client_id is required' });

  const { rows: crows } = await query(
    'SELECT id, name, lat, lng, geofence_radius_m FROM clients WHERE id = $1',
    [client_id]
  );
  const client = crows[0];
  if (!client) return res.status(404).json({ error: 'Client not found' });

  const { rows: srows } = await query(
    'SELECT geofence_enforce, default_geofence_radius_m FROM app_settings WHERE id = 1'
  );
  const settings = srows[0] || { geofence_enforce: false, default_geofence_radius_m: 200 };

  const effectiveStatus = status || 'completed';
  const clientHasCoords = client.lat != null && client.lng != null;
  const radius = client.geofence_radius_m ?? settings.default_geofence_radius_m;

  let distance = null;
  let within = null;
  if (clientHasCoords && lat != null && lng != null) {
    distance = distanceMeters(lat, lng, client.lat, client.lng);
    within = distance != null ? distance <= radius : null;
  }

  // Enforcement applies only to completed (actually-happened) meetings.
  if (settings.geofence_enforce && effectiveStatus === 'completed' && clientHasCoords) {
    if (lat == null || lng == null) {
      return res.status(422).json({ error: 'Your location is required to log a meeting', code: 'LOCATION_REQUIRED' });
    }
    if (!within) {
      return res.status(422).json({
        error: 'You are outside the allowed area for this client',
        code: 'OUTSIDE_GEOFENCE',
        distance_m: Math.round(distance),
        allowed_radius_m: radius,
      });
    }
  }

  const { rows } = await query(
    `INSERT INTO visits
       (client_id, user_id, purpose, notes, outcome, status, check_in_at, check_out_at, lat, lng, next_follow_up, scheduled_at, distance_m, within_geofence)
     VALUES ($1, $2, $3, $4, $5, COALESCE($6, 'completed')::visit_status, $7, $8, $9, $10, $11, $12, $13, $14)
     RETURNING *`,
    [client_id, req.user.id, purpose ?? null, notes ?? null, outcome ?? null, status ?? null,
     check_in_at ?? null, check_out_at ?? null, lat ?? null, lng ?? null, next_follow_up ?? null,
     scheduled_at ?? null, distance, within]
  );
  const visit = rows[0];

  // A follow-up date auto-creates a follow-up task so nothing slips through the cracks.
  if (next_follow_up) {
    await query(
      `INSERT INTO tasks (user_id, created_by, client_id, type, title, priority, plan_date, due_date)
       VALUES ($1, $1, $2, 'follow_up', $3, 'medium', $4, $4)`,
      [req.user.id, client_id, `Follow-up: ${client.name}`, next_follow_up]
    );
  }

  res.status(201).json({ visit });
}));

// List visits. Sales reps see only their own; admin/manager see all.
// Filter by ?client_id= and/or ?user_id=.
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const params = [];
  const clauses = [];
  if (req.user.role === 'sales') {
    params.push(req.user.id);
    clauses.push(`v.user_id = $${params.length}`);
  } else if (req.query.user_id) {
    params.push(req.query.user_id);
    clauses.push(`v.user_id = $${params.length}`);
  }
  if (req.query.client_id) {
    params.push(req.query.client_id);
    clauses.push(`v.client_id = $${params.length}`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const { rows } = await query(
    `SELECT v.*, c.name AS client_name, u.name AS user_name,
       (SELECT count(*)::int FROM visit_photos p WHERE p.visit_id = v.id) AS photo_count
     FROM visits v
     JOIN clients c ON c.id = v.client_id
     JOIN users u ON u.id = v.user_id
     ${where}
     ORDER BY v.created_at DESC
     LIMIT 500`,
    params
  );
  res.json({ visits: rows });
}));

// Get one visit with its photos.
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  const { rows } = await query('SELECT * FROM visits WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Visit not found' });
  const { rows: photos } = await query(
    'SELECT * FROM visit_photos WHERE visit_id = $1 ORDER BY taken_at',
    [req.params.id]
  );
  res.json({ visit: rows[0], photos });
}));

// Upload one or more geo-tagged photos for a visit. Form field name: "photos".
router.post('/:id/photos', authenticate, upload.array('photos', 10), asyncHandler(async (req, res) => {
  const { rows: vrows } = await query('SELECT id FROM visits WHERE id = $1', [req.params.id]);
  if (!vrows[0]) return res.status(404).json({ error: 'Visit not found' });

  const files = req.files || [];
  if (files.length === 0) {
    return res.status(400).json({ error: 'No photos uploaded (use form field "photos")' });
  }
  const { lat, lng } = req.body;
  const saved = [];
  for (const f of files) {
    // Cloudinary sets f.path to a full https URL; disk storage uses the local filename.
    const filePath = /^https?:\/\//.test(f.path || '') ? f.path : `/uploads/${f.filename}`;
    const { rows } = await query(
      `INSERT INTO visit_photos (visit_id, file_path, lat, lng)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.params.id, filePath, lat ? Number(lat) : null, lng ? Number(lng) : null]
    );
    saved.push(rows[0]);
  }
  res.status(201).json({ photos: saved });
}));

module.exports = router;
