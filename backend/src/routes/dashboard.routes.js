const express = require('express');
const { query } = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// Today's headline KPIs for the manager dashboard.
router.get('/overview', authenticate, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const [kpi, dist] = await Promise.all([
    query(
      `SELECT
        (SELECT count(*)::int FROM users WHERE role = 'sales' AND is_active) AS total_reps,
        (SELECT count(DISTINCT user_id)::int FROM location_pings
           WHERE recorded_at > now() - interval '10 minutes') AS active_now,
        (SELECT count(*)::int FROM attendance
           WHERE work_date = CURRENT_DATE AND check_in_at IS NOT NULL) AS checked_in_today,
        (SELECT count(*)::int FROM visits
           WHERE status = 'completed' AND created_at::date = CURRENT_DATE) AS meetings_today`
    ),
    query(
      `WITH pts AS (
         SELECT user_id, lat, lng,
           lag(lat) OVER (PARTITION BY user_id ORDER BY recorded_at) AS plat,
           lag(lng) OVER (PARTITION BY user_id ORDER BY recorded_at) AS plng
         FROM location_pings
         WHERE recorded_at::date = CURRENT_DATE
       )
       SELECT COALESCE(SUM(CASE WHEN plat IS NOT NULL THEN
         6371000 * 2 * asin(sqrt(
           power(sin(radians(lat - plat) / 2), 2) +
           cos(radians(plat)) * cos(radians(lat)) *
           power(sin(radians(lng - plng) / 2), 2)
         )) ELSE 0 END), 0)::float AS distance_m
       FROM pts`
    ),
  ]);

  res.json({
    ...kpi.rows[0],
    distance_today_km: +(dist.rows[0].distance_m / 1000).toFixed(1),
  });
}));

module.exports = router;
