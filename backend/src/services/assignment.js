const { query } = require('../config/db');

// Chooses which sales rep a lead should go to.
// Strategy:
//   1. If the lead has coordinates, find the nearest territory whose radius covers it.
//   2. Among that territory's active sales reps, pick the one with the fewest clients (load balance).
//   3. Fallback: globally pick the active sales rep with the fewest clients.
// Returns { assigneeId, territoryId } — either may be null.
async function pickAssignee({ lat, lng }) {
  let territoryId = null;

  if (lat != null && lng != null) {
    const { rows } = await query(
      `SELECT id FROM (
         SELECT id, radius_m,
           6371000 * 2 * asin(sqrt(
             power(sin(radians($1 - center_lat) / 2), 2) +
             cos(radians(center_lat)) * cos(radians($1)) *
             power(sin(radians($2 - center_lng) / 2), 2)
           )) AS dist
         FROM territories
         WHERE center_lat IS NOT NULL AND center_lng IS NOT NULL AND radius_m IS NOT NULL
       ) t
       WHERE dist <= radius_m
       ORDER BY dist ASC
       LIMIT 1`,
      [lat, lng]
    );
    if (rows[0]) territoryId = rows[0].id;
  }

  if (territoryId) {
    const { rows } = await query(
      `SELECT u.id
       FROM territory_users tu
       JOIN users u ON u.id = tu.user_id AND u.role = 'sales' AND u.is_active
       LEFT JOIN clients c ON c.assigned_to = u.id
       WHERE tu.territory_id = $1
       GROUP BY u.id
       ORDER BY count(c.id) ASC
       LIMIT 1`,
      [territoryId]
    );
    if (rows[0]) return { assigneeId: rows[0].id, territoryId };
  }

  const { rows } = await query(
    `SELECT u.id
     FROM users u
     LEFT JOIN clients c ON c.assigned_to = u.id
     WHERE u.role = 'sales' AND u.is_active
     GROUP BY u.id
     ORDER BY count(c.id) ASC
     LIMIT 1`
  );
  return { assigneeId: rows[0] ? rows[0].id : null, territoryId };
}

module.exports = { pickAssignee };
