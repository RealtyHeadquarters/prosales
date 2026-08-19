const express = require('express');
const { query } = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

const UPDATABLE = ['name', 'description', 'center_lat', 'center_lng', 'radius_m'];

// List territories with member + client counts.
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT t.*,
       (SELECT count(*)::int FROM territory_users tu WHERE tu.territory_id = t.id) AS member_count,
       (SELECT count(*)::int FROM clients c WHERE c.territory_id = t.id) AS client_count
     FROM territories t
     ORDER BY t.name`
  );
  res.json({ territories: rows });
}));

// Create a territory.
router.post('/', authenticate, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const { name, description, center_lat, center_lng, radius_m } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const { rows } = await query(
    `INSERT INTO territories (name, description, center_lat, center_lng, radius_m)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [name, description ?? null, center_lat ?? null, center_lng ?? null, radius_m ?? null]
  );
  res.status(201).json({ territory: rows[0] });
}));

// Get a territory with its members.
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  const { rows } = await query('SELECT * FROM territories WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Territory not found' });
  const { rows: members } = await query(
    `SELECT u.id, u.name, u.email, u.role
     FROM territory_users tu JOIN users u ON u.id = tu.user_id
     WHERE tu.territory_id = $1 ORDER BY u.name`,
    [req.params.id]
  );
  res.json({ territory: rows[0], members });
}));

// Update a territory.
router.patch('/:id', authenticate, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const sets = [];
  const params = [];
  for (const key of UPDATABLE) {
    if (key in req.body) { params.push(req.body[key]); sets.push(`${key} = $${params.length}`); }
  }
  if (sets.length === 0) return res.status(400).json({ error: 'No fields to update' });
  params.push(req.params.id);
  const { rows } = await query(
    `UPDATE territories SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
    params
  );
  if (!rows[0]) return res.status(404).json({ error: 'Territory not found' });
  res.json({ territory: rows[0] });
}));

// Delete a territory.
router.delete('/:id', authenticate, authorize('admin'), asyncHandler(async (req, res) => {
  const { rowCount } = await query('DELETE FROM territories WHERE id = $1', [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: 'Territory not found' });
  res.status(204).send();
}));

// Add a member to a territory.
router.post('/:id/members', authenticate, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id is required' });
  await query(
    `INSERT INTO territory_users (territory_id, user_id) VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [req.params.id, user_id]
  );
  res.status(201).json({ ok: true });
}));

// Remove a member.
router.delete('/:id/members/:userId', authenticate, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  await query(
    'DELETE FROM territory_users WHERE territory_id = $1 AND user_id = $2',
    [req.params.id, req.params.userId]
  );
  res.status(204).send();
}));

module.exports = router;
