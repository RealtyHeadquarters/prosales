const express = require('express');
const { query } = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// List users (for dashboard dropdowns, team views). Admin/manager only.
router.get('/', authenticate, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const { role } = req.query;
  const params = [];
  let where = '';
  if (role) {
    params.push(role);
    where = `WHERE role = $${params.length}`;
  }
  const { rows } = await query(
    `SELECT id, name, email, phone, role, manager_id, is_active, created_at
     FROM users ${where} ORDER BY name`,
    params
  );
  res.json({ users: rows });
}));

// Reassign a user's clients + pending tasks to another user (e.g. when someone leaves).
// Optionally deactivate the original user in the same step.
router.post('/:id/reassign-clients', authenticate, authorize('admin'), asyncHandler(async (req, res) => {
  const { to_user_id, deactivate } = req.body;
  if (!to_user_id) return res.status(400).json({ error: 'to_user_id is required' });
  const clients = await query(
    'UPDATE clients SET assigned_to = $1, updated_at = now() WHERE assigned_to = $2',
    [to_user_id, req.params.id]
  );
  const tasks = await query(
    `UPDATE tasks SET user_id = $1 WHERE user_id = $2 AND status = 'pending'`,
    [to_user_id, req.params.id]
  );
  if (deactivate) {
    await query('UPDATE users SET is_active = false, updated_at = now() WHERE id = $1', [req.params.id]);
  }
  res.json({
    clients_reassigned: clients.rowCount,
    tasks_reassigned: tasks.rowCount,
    deactivated: Boolean(deactivate),
  });
}));

// Enable/disable a user. Admin only.
router.patch('/:id/active', authenticate, authorize('admin'), asyncHandler(async (req, res) => {
  const { is_active } = req.body;
  const { rows } = await query(
    `UPDATE users SET is_active = $1, updated_at = now()
     WHERE id = $2
     RETURNING id, name, email, role, is_active`,
    [Boolean(is_active), req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'User not found' });
  res.json({ user: rows[0] });
}));

module.exports = router;
