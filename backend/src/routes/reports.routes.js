const express = require('express');
const { query } = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// Per-rep performance metrics for a date range [from, to] (inclusive dates).
// If userId is provided, returns just that rep; otherwise every active sales rep.
// Metrics: distance travelled (from GPS pings), working hours (attendance),
//          meetings done vs planned, tasks done/pending, clients assigned.
function performanceQuery() {
  return `
    SELECT u.id AS user_id, u.name AS user_name,
      ROUND(COALESCE(dist.distance_m, 0)::numeric, 0)::float   AS distance_m,
      ROUND(COALESCE(att.working_hours, 0)::numeric, 2)::float AS working_hours,
      COALESCE(vd.meetings_done, 0)::int    AS meetings_done,
      COALESCE(vp.meetings_planned, 0)::int AS meetings_planned,
      COALESCE(tk.tasks_done, 0)::int       AS tasks_done,
      COALESCE(tk.tasks_pending, 0)::int    AS tasks_pending,
      COALESCE(cc.clients_count, 0)::int    AS clients_count
    FROM users u
    LEFT JOIN LATERAL (
      WITH pts AS (
        SELECT lat, lng,
          lag(lat) OVER (ORDER BY recorded_at) AS plat,
          lag(lng) OVER (ORDER BY recorded_at) AS plng,
          recorded_at::date AS d,
          lag(recorded_at::date) OVER (ORDER BY recorded_at) AS pd
        FROM location_pings
        WHERE user_id = u.id AND recorded_at::date BETWEEN $1 AND $2
      )
      SELECT SUM(CASE WHEN plat IS NOT NULL AND d = pd THEN
        6371000 * 2 * asin(sqrt(
          power(sin(radians(lat - plat) / 2), 2) +
          cos(radians(plat)) * cos(radians(lat)) *
          power(sin(radians(lng - plng) / 2), 2)
        )) ELSE 0 END) AS distance_m
      FROM pts
    ) dist ON true
    LEFT JOIN LATERAL (
      SELECT SUM(EXTRACT(EPOCH FROM (check_out_at - check_in_at))) / 3600.0 AS working_hours
      FROM attendance
      WHERE user_id = u.id AND check_in_at IS NOT NULL AND check_out_at IS NOT NULL
        AND work_date BETWEEN $1 AND $2
    ) att ON true
    LEFT JOIN LATERAL (
      SELECT count(*) AS meetings_done FROM visits
      WHERE user_id = u.id AND status = 'completed' AND created_at::date BETWEEN $1 AND $2
    ) vd ON true
    LEFT JOIN LATERAL (
      SELECT count(*) AS meetings_planned FROM visits
      WHERE user_id = u.id AND status = 'planned'
        AND COALESCE(scheduled_at::date, created_at::date) BETWEEN $1 AND $2
    ) vp ON true
    LEFT JOIN LATERAL (
      SELECT
        count(*) FILTER (WHERE status = 'done' AND completed_at::date BETWEEN $1 AND $2) AS tasks_done,
        count(*) FILTER (WHERE status = 'pending') AS tasks_pending
      FROM tasks WHERE user_id = u.id
    ) tk ON true
    LEFT JOIN LATERAL (
      SELECT count(*) AS clients_count FROM clients WHERE assigned_to = u.id
    ) cc ON true
    WHERE u.role = 'sales' AND ($3::uuid IS NULL OR u.id = $3)
    ORDER BY u.name`;
}

// Default range = last 30 days if not provided.
function range(req) {
  const to = req.query.to || new Date().toISOString().slice(0, 10);
  const from = req.query.from || new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  return { from, to };
}

// Team performance (admin/manager).
router.get('/team', authenticate, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const { from, to } = range(req);
  const { rows } = await query(performanceQuery(), [from, to, null]);
  res.json({ from, to, reps: rows });
}));

// Single rep summary. Reps may only view their own.
router.get('/summary', authenticate, asyncHandler(async (req, res) => {
  const { from, to } = range(req);
  let userId = req.query.user_id || req.user.id;
  if (req.user.role === 'sales') userId = req.user.id;
  const { rows } = await query(performanceQuery(), [from, to, userId]);
  res.json({ from, to, summary: rows[0] || null });
}));

module.exports = router;
