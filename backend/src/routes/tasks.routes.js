const express = require('express');
const { query } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

const UPDATABLE = ['client_id', 'type', 'title', 'description', 'priority', 'status', 'plan_date', 'due_date'];

// Create a task / plan item. Reps create for themselves; admin/manager can assign to anyone.
router.post('/', authenticate, asyncHandler(async (req, res) => {
  const { user_id, client_id, type, title, description, priority, plan_date, due_date } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });
  const assignee = req.user.role === 'sales' ? req.user.id : (user_id || req.user.id);
  const { rows } = await query(
    `INSERT INTO tasks (user_id, created_by, client_id, type, title, description, priority, plan_date, due_date)
     VALUES ($1, $2, $3, COALESCE($4,'todo')::task_type, $5, $6, COALESCE($7,'medium')::task_priority, $8, $9)
     RETURNING *`,
    [assignee, req.user.id, client_id ?? null, type ?? null, title,
     description ?? null, priority ?? null, plan_date ?? null, due_date ?? null]
  );
  res.status(201).json({ task: rows[0] });
}));

// List tasks. Reps see only their own. Filters: ?status=&type=&plan_date=&user_id=
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const params = [];
  const clauses = [];
  if (req.user.role === 'sales') {
    params.push(req.user.id); clauses.push(`t.user_id = $${params.length}`);
  } else if (req.query.user_id) {
    params.push(req.query.user_id); clauses.push(`t.user_id = $${params.length}`);
  }
  if (req.query.status) { params.push(req.query.status); clauses.push(`t.status = $${params.length}`); }
  if (req.query.type) { params.push(req.query.type); clauses.push(`t.type = $${params.length}`); }
  if (req.query.plan_date) { params.push(req.query.plan_date); clauses.push(`t.plan_date = $${params.length}`); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const { rows } = await query(
    `SELECT t.*, c.name AS client_name
     FROM tasks t LEFT JOIN clients c ON c.id = t.client_id
     ${where}
     ORDER BY t.due_date NULLS LAST, t.priority DESC, t.created_at DESC
     LIMIT 500`,
    params
  );
  res.json({ tasks: rows });
}));

// Day plan / agenda for a date: tasks planned or due that day + planned meetings.
router.get('/agenda', authenticate, asyncHandler(async (req, res) => {
  const date = req.query.date; // YYYY-MM-DD
  if (!date) return res.status(400).json({ error: 'date query param is required (YYYY-MM-DD)' });
  const userId = req.user.role === 'sales' ? req.user.id : (req.query.user_id || req.user.id);

  const { rows: tasks } = await query(
    `SELECT t.*, c.name AS client_name
     FROM tasks t LEFT JOIN clients c ON c.id = t.client_id
     WHERE t.user_id = $1 AND (t.plan_date = $2 OR t.due_date = $2)
     ORDER BY t.priority DESC, t.created_at`,
    [userId, date]
  );
  const { rows: plannedVisits } = await query(
    `SELECT v.*, c.name AS client_name
     FROM visits v JOIN clients c ON c.id = v.client_id
     WHERE v.user_id = $1 AND v.status = 'planned'
       AND COALESCE(v.scheduled_at::date, v.created_at::date) = $2
     ORDER BY v.scheduled_at NULLS LAST`,
    [userId, date]
  );
  res.json({ date, tasks, planned_visits: plannedVisits });
}));

// Reminders: my pending tasks that are due today or overdue.
router.get('/reminders', authenticate, asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT t.*, c.name AS client_name
     FROM tasks t LEFT JOIN clients c ON c.id = t.client_id
     WHERE t.user_id = $1 AND t.status = 'pending'
       AND t.due_date IS NOT NULL AND t.due_date <= CURRENT_DATE
     ORDER BY t.due_date ASC, t.priority DESC`,
    [req.user.id]
  );
  res.json({ reminders: rows });
}));

// Get one task.
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  const { rows } = await query('SELECT * FROM tasks WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Task not found' });
  res.json({ task: rows[0] });
}));

// Update / complete a task. Setting status=done stamps completed_at automatically.
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
  if ('status' in req.body) {
    params.push(req.body.status);
    sets.push(`completed_at = CASE WHEN $${params.length} = 'done' THEN now() ELSE NULL END`);
  }
  params.push(req.params.id);
  const { rows } = await query(
    `UPDATE tasks SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
    params
  );
  if (!rows[0]) return res.status(404).json({ error: 'Task not found' });
  res.json({ task: rows[0] });
}));

// Delete a task.
router.delete('/:id', authenticate, asyncHandler(async (req, res) => {
  const { rowCount } = await query('DELETE FROM tasks WHERE id = $1', [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: 'Task not found' });
  res.status(204).send();
}));

module.exports = router;
