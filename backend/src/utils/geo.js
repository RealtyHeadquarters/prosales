// Great-circle distance between two lat/lng points, in metres (Haversine).
// Returns null if any coordinate is missing/invalid.
function distanceMeters(lat1, lng1, lat2, lng2) {
  const raw = [lat1, lng1, lat2, lng2];
  // Reject missing/blank/non-numeric inputs BEFORE Number() (note: Number(null) === 0).
  if (raw.some((v) => v === null || v === undefined || v === '' || Number.isNaN(Number(v)))) return null;
  const [a1, o1, a2, o2] = raw.map(Number);
  const R = 6371000; // earth radius in metres
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(a2 - a1);
  const dLng = toRad(o2 - o1);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a1)) * Math.cos(toRad(a2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}

module.exports = { distanceMeters };
