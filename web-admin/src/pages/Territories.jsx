import { useEffect, useState } from 'react';
import { api } from '../api';

export default function Territories() {
  const [terr, setTerr] = useState([]);
  const [show, setShow] = useState(false);

  async function load() {
    try {
      const t = await api.get('/territories');
      setTerr(t.territories || []);
    } catch {
      setTerr([]);
    }
  }
  useEffect(() => {
    load();
  }, []);

  return (
    <div className="page">
      <div className="page-head">
        <h2>Territories</h2>
        <button className="primary" onClick={() => setShow(true)}>+ New</button>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Center</th>
            <th>Radius</th>
            <th>Members</th>
            <th>Clients</th>
          </tr>
        </thead>
        <tbody>
          {terr.map((t) => (
            <tr key={t.id}>
              <td>{t.name}</td>
              <td>{t.center_lat != null ? `${t.center_lat.toFixed(3)}, ${t.center_lng.toFixed(3)}` : '—'}</td>
              <td>{t.radius_m != null ? `${(t.radius_m / 1000).toFixed(1)} km` : '—'}</td>
              <td>{t.member_count}</td>
              <td>{t.client_count}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {terr.length === 0 && <p className="muted" style={{ marginTop: 12 }}>No territories yet.</p>}
      {show && <NewTerr onClose={() => setShow(false)} onSaved={() => { setShow(false); load(); }} />}
    </div>
  );
}

function NewTerr({ onClose, onSaved }) {
  const [f, setF] = useState({ name: '', center_lat: '', center_lng: '', radius_m: '' });
  const [err, setErr] = useState('');

  async function save() {
    if (!f.name.trim()) return setErr('Name is required');
    try {
      await api.post('/territories', {
        name: f.name,
        center_lat: f.center_lat ? +f.center_lat : null,
        center_lng: f.center_lng ? +f.center_lng : null,
        radius_m: f.radius_m ? +f.radius_m : null,
      });
      onSaved();
    } catch (e) {
      setErr(e.message);
    }
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>New Territory</h3>
        <input placeholder="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <input placeholder="Center latitude" value={f.center_lat} onChange={(e) => setF({ ...f, center_lat: e.target.value })} />
        <input placeholder="Center longitude" value={f.center_lng} onChange={(e) => setF({ ...f, center_lng: e.target.value })} />
        <input placeholder="Radius (meters)" value={f.radius_m} onChange={(e) => setF({ ...f, radius_m: e.target.value })} />
        {err && <div className="error">{err}</div>}
        <div className="row end">
          <button onClick={onClose}>Cancel</button>
          <button className="primary" onClick={save}>Save</button>
        </div>
      </div>
    </div>
  );
}
