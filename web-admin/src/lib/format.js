export function timeAgo(iso) {
  if (!iso) return '—';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function isStale(iso, minutes = 15) {
  if (!iso) return true;
  return Date.now() - new Date(iso).getTime() > minutes * 60 * 1000;
}

export function initials(name) {
  if (!name) return '?';
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || '?';
}

const PALETTE = ['#2563eb', '#16a34a', '#db2777', '#ea580c', '#7c3aed', '#0891b2', '#ca8a04', '#dc2626'];
export function colorForId(id) {
  let h = 0;
  for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

// Total distance (km) along a list of [lat, lng] points.
export function haversineKm(pts) {
  let d = 0;
  const R = 6371;
  const toR = (x) => (x * Math.PI) / 180;
  for (let i = 1; i < pts.length; i++) {
    const [a1, o1] = pts[i - 1];
    const [a2, o2] = pts[i];
    const dLat = toR(a2 - a1);
    const dLng = toR(o2 - o1);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a1)) * Math.cos(toR(a2)) * Math.sin(dLng / 2) ** 2;
    d += R * 2 * Math.asin(Math.sqrt(h));
  }
  return d;
}
