const express = require('express');
const { query } = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { pickAssignee } = require('../services/assignment');

const router = express.Router();

const UPDATABLE = ['name', 'company', 'phone', 'email', 'address', 'lat', 'lng', 'status', 'assigned_to', 'territory_id', 'geofence_radius_m', 'notes'];

// List clients. Sales reps see only their assigned clients; admin/manager see all.
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const params = [];
  const clauses = [];
  if (req.user.role === 'sales') {
    params.push(req.user.id);
    clauses.push(`assigned_to = $${params.length}`);
  } else if (req.query.assigned_to) {
    params.push(req.query.assigned_to);
    clauses.push(`assigned_to = $${params.length}`);
  }
  if (req.query.status) {
    params.push(req.query.status);
    clauses.push(`status = $${params.length}`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const { rows } = await query(
    `SELECT * FROM clients ${where} ORDER BY created_at DESC LIMIT 500`,
    params
  );
  res.json({ clients: rows });
}));

// Create a client / lead.
// Assignment: explicit assigned_to wins → else a sales rep keeps their own lead →
// else (admin/manager) auto-assign by territory + load balance.
router.post('/', authenticate, asyncHandler(async (req, res) => {
  const { name, company, phone, email, address, lat, lng, status, assigned_to, territory_id, geofence_radius_m, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  let assignee = assigned_to || null;
  let territory = territory_id || null;
  if (!assignee) {
    if (req.user.role === 'sales') {
      assignee = req.user.id;
    } else {
      const picked = await pickAssignee({ lat, lng });
      assignee = picked.assigneeId;
      if (!territory) territory = picked.territoryId;
    }
  }

  const { rows } = await query(
    `INSERT INTO clients (name, company, phone, email, address, lat, lng, status, assigned_to, territory_id, geofence_radius_m, notes, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, 'lead')::client_status, $9, $10, $11, $12, $13)
     RETURNING *`,
    [name, company ?? null, phone ?? null, email ?? null, address ?? null,
     lat ?? null, lng ?? null, status ?? null, assignee, territory, geofence_radius_m ?? null, notes ?? null, req.user.id]
  );
  res.status(201).json({ client: rows[0] });
}));

// Auto-assign every currently unassigned lead (admin/manager) — handy after a bulk import.
router.post('/auto-assign', authenticate, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const { rows: unassigned } = await query(
    'SELECT id, lat, lng FROM clients WHERE assigned_to IS NULL ORDER BY created_at LIMIT 500'
  );
  let assigned = 0;
  for (const c of unassigned) {
    const picked = await pickAssignee({ lat: c.lat, lng: c.lng });
    if (picked.assigneeId) {
      await query(
        `UPDATE clients SET assigned_to = $1, territory_id = COALESCE(territory_id, $2), updated_at = now()
         WHERE id = $3`,
        [picked.assigneeId, picked.territoryId, c.id]
      );
      assigned++;
    }
  }
  res.json({ processed: unassigned.length, assigned });
}));

// Get one client.
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  const { rows } = await query('SELECT * FROM clients WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Client not found' });
  res.json({ client: rows[0] });
}));

// Update a client (partial).
router.patch('/:id', authenticate, asyncHandler(async (req, res) => {
  const sets = [];
  const params = [];
  for (const key of UPDATABLE) {
    if (key in req.body) {
      params.push(req.body[key]);
      sets.push(`${key} = $${params.length}`);
    }
  }
  if (sets.length === 0) return res.status(400).json({ error: 'No fields to update' });
  params.push(req.params.id);
  const { rows } = await query(
    `UPDATE clients SET ${sets.join(', ')}, updated_at = now()
     WHERE id = $${params.length} RETURNING *`,
    params
  );
  if (!rows[0]) return res.status(404).json({ error: 'Client not found' });
  res.json({ client: rows[0] });
}));

// Delete a client (admin/manager only).
router.delete('/:id', authenticate, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const { rowCount } = await query('DELETE FROM clients WHERE id = $1', [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: 'Client not found' });
  res.status(204).send();
}));

module.exports = router;
