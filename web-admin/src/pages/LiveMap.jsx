import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { api } from '../api';

// Fix Leaflet's default marker icons under bundlers (Vite).
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
L.Icon.Default.mergeOptions({ iconRetinaUrl: markerIcon2x, iconUrl: markerIcon, shadowUrl: markerShadow });

export default function LiveMap() {
  const [locations, setLocations] = useState([]);
  const [updated, setUpdated] = useState(null);

  async function load() {
    try {
      const r = await api.get('/location/live');
      setLocations(r.locations || []);
      setUpdated(new Date());
    } catch {
      /* ignore transient errors; will retry */
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 15000); // refresh every 15s
    return () => clearInterval(id);
  }, []);

  const center = locations.length ? [locations[0].lat, locations[0].lng] : [28.6139, 77.209];

  return (
    <div className="page">
      <div className="page-head">
        <h2>Live Team Map</h2>
        <span className="muted">
          {locations.length} active • updated {updated ? updated.toLocaleTimeString() : '—'}
        </span>
      </div>
      <div className="map-card">
        <MapContainer center={center} zoom={11} style={{ height: '70vh', width: '100%', borderRadius: 12 }}>
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {locations.map((l) => (
            <Marker key={l.user_id} position={[l.lat, l.lng]}>
              <Popup>
                <b>{l.user_name}</b>
                <br />
                Battery: {l.battery ?? '—'}%
                <br />
                {new Date(l.recorded_at).toLocaleString()}
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
      {locations.length === 0 && (
        <p className="muted" style={{ marginTop: 12 }}>
          No reps have shared their location in the last 24h. Reps start sharing after they check in on the mobile app.
        </p>
      )}
    </div>
  );
}
