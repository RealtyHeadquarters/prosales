import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { api } from '../api';
import { timeAgo, isStale, initials, colorForId, haversineKm } from '../lib/format';

function repIcon(name, color, stale) {
  return L.divIcon({
    className: 'rep-marker',
    html: `<div class="rep-pin" style="background:${stale ? '#9ca3af' : color}">${initials(name)}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -18],
  });
}

// Fits the map to all reps once (and again only when the rep count changes).
function FitBounds({ points }) {
  const map = useMap();
  const last = useRef(0);
  useEffect(() => {
    if (points.length && points.length !== last.current) {
      map.fitBounds(points, { padding: [50, 50], maxZoom: 14 });
      last.current = points.length;
    }
  }, [points, map]);
  return null;
}

function Kpi({ label, value, accent, pulse }) {
  return (
    <div className="kpi">
      <div className="kpi-value" style={accent ? { color: accent } : undefined}>
        {pulse ? <span className="pulse-dot" /> : null}
        {value}
      </div>
      <div className="kpi-label">{label}</div>
    </div>
  );
}

export default function LiveMap() {
  const [locations, setLocations] = useState([]);
  const [overview, setOverview] = useState(null);
  const [updated, setUpdated] = useState(null);
  const [trail, setTrail] = useState(null); // { userId, name, points, km }

  async function load() {
    try {
      const [loc, ov] = await Promise.all([api.get('/location/live'), api.get('/dashboard/overview')]);
      setLocations(loc.locations || []);
      setOverview(ov);
      setUpdated(new Date());
    } catch {
      /* transient — will retry on next tick */
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, []);

  async function showTrail(l) {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const r = await api.get(`/location/track/${l.user_id}`, { from: today });
      const points = (r.track || []).map((p) => [p.lat, p.lng]);
      setTrail({ userId: l.user_id, name: l.user_name, points, km: haversineKm(points) });
    } catch {
      /* ignore */
    }
  }

  const points = useMemo(() => locations.map((l) => [l.lat, l.lng]), [locations]);
  const center = points[0] || [28.6139, 77.209];

  return (
    <div className="page">
      <div className="page-head">
        <h2>Live Command Center</h2>
        <div className="row">
          <span className="muted">updated {updated ? updated.toLocaleTimeString() : '—'}</span>
          <button onClick={load}>↻ Refresh</button>
        </div>
      </div>

      <div className="kpi-row">
        <Kpi label="Active now" value={overview?.active_now ?? '—'} accent="#16a34a" pulse={!!overview?.active_now} />
        <Kpi label="Checked in today" value={`${overview?.checked_in_today ?? '—'} / ${overview?.total_reps ?? '—'}`} />
        <Kpi label="Meetings today" value={overview?.meetings_today ?? '—'} />
        <Kpi label="Distance today" value={overview ? `${overview.distance_today_km} km` : '—'} />
      </div>

      <div className="map-card">
        <MapContainer center={center} zoom={11} style={{ height: '60vh', width: '100%', borderRadius: 12 }}>
          <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <FitBounds points={points} />
          {trail && trail.points.length > 1 && (
            <Polyline positions={trail.points} pathOptions={{ color: colorForId(trail.userId), weight: 4, opacity: 0.85 }} />
          )}
          {locations.map((l) => {
            const stale = isStale(l.recorded_at);
            return (
              <Marker
                key={l.user_id}
                position={[l.lat, l.lng]}
                icon={repIcon(l.user_name, colorForId(l.user_id), stale)}
                eventHandlers={{ click: () => showTrail(l) }}
              >
                <Popup>
                  <b>{l.user_name}</b>
                  <br />
                  {stale ? '⚠️ ' : ''}
                  {timeAgo(l.recorded_at)}
                  <br />
                  Battery: {l.battery ?? '—'}%
                  <br />
                  <span className="muted">Click marker → today's route</span>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>

      <div className="row" style={{ marginTop: 10, justifyContent: 'space-between' }}>
        <span className="muted">🟢 active &lt;15 min · ⚪ stale · click a rep for their route</span>
        {trail && (
          <span className="muted">
            Route of <b>{trail.name}</b> today: <b>{trail.km.toFixed(1)} km</b>{' '}
            <button onClick={() => setTrail(null)}>clear</button>
          </span>
        )}
      </div>

      {locations.length === 0 && (
        <p className="muted" style={{ marginTop: 12 }}>
          No reps sharing their location in the last 24h. Reps start sharing after they check in on the app.
        </p>
      )}
    </div>
  );
}
