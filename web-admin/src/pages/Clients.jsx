import { useEffect, useState } from 'react';
import { api, photoUrl } from '../api';

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [q, setQ] = useState('');
  const [show, setShow] = useState(false);
  const [selected, setSelected] = useState(null);

  async function load() {
    try {
      const r = await api.get('/clients');
      setClients(r.clients || []);
    } catch {
      setClients([]);
    }
  }
  useEffect(() => {
    load();
  }, []);

  const filtered = clients.filter(
    (c) => c.name.toLowerCase().includes(q.toLowerCase()) || (c.company || '').toLowerCase().includes(q.toLowerCase())
  );

  async function autoAssign() {
    try {
      const r = await api.post('/clients/auto-assign');
      alert(`Assigned ${r.assigned} of ${r.processed} unassigned leads.`);
      load();
    } catch (e) {
      alert(e.message);
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <h2>Clients</h2>
        <div className="row">
          <input placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
          <button onClick={autoAssign}>Auto-assign leads</button>
          <button className="primary" onClick={() => setShow(true)}>+ New</button>
        </div>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Company</th>
            <th>Phone</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((c) => (
            <tr key={c.id} className="clickable" onClick={() => setSelected(c)}>
              <td>{c.name}</td>
              <td>{c.company || '—'}</td>
              <td>{c.phone || '—'}</td>
              <td><span className={'chip ' + (c.status || 'lead')}>{c.status || 'lead'}</span></td>
              <td className="muted">View meetings →</td>
            </tr>
          ))}
        </tbody>
      </table>
      {show && <NewClient onClose={() => setShow(false)} onSaved={() => { setShow(false); load(); }} />}
      {selected && <ClientVisits client={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function ClientVisits({ client, onClose }) {
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await api.get('/visits', { client_id: client.id });
        const list = r.visits || [];
        const withPhotos = await Promise.all(
          list.map(async (v) => {
            if (!v.photo_count) return { ...v, photos: [] };
            try {
              const d = await api.get(`/visits/${v.id}`);
              return { ...v, photos: d.photos || [] };
            } catch {
              return { ...v, photos: [] };
            }
          })
        );
        setVisits(withPhotos);
      } catch {
        setVisits([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [client.id]);

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0 }}>{client.name} — Meetings</h3>
          <button onClick={onClose}>✕</button>
        </div>
        {loading ? (
          <p className="muted">Loading…</p>
        ) : visits.length === 0 ? (
          <p className="muted">No meetings logged yet.</p>
        ) : (
          <div className="visit-list">
            {visits.map((v) => (
              <div key={v.id} className="visit-item">
                <div className="visit-head">
                  <b>{v.purpose || 'Visit'}</b>
                  <span className="muted">{new Date(v.created_at).toLocaleString()}</span>
                </div>
                {v.notes && <div className="visit-notes">{v.notes}</div>}
                {v.outcome && <div className="muted">Outcome: {v.outcome}</div>}
                {v.user_name && <div className="muted">By: {v.user_name}</div>}
                {v.photos.length > 0 && (
                  <div className="photo-grid">
                    {v.photos.map((p) => (
                      <img key={p.id} src={photoUrl(p.file_path)} alt="visit" loading="lazy" onClick={() => setLightbox(photoUrl(p.file_path))} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      {lightbox && (
        <div className="lightbox" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="full" />
        </div>
      )}
    </div>
  );
}

function NewClient({ onClose, onSaved }) {
  const [f, setF] = useState({ name: '', company: '', phone: '', address: '' });
  const [err, setErr] = useState('');

  async function save() {
    if (!f.name.trim()) return setErr('Name is required');
    try {
      await api.post('/clients', f);
      onSaved();
    } catch (e) {
      setErr(e.message);
    }
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>New Client</h3>
        {['name', 'company', 'phone', 'address'].map((k) => (
          <input key={k} placeholder={k[0].toUpperCase() + k.slice(1)} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
        ))}
        {err && <div className="error">{err}</div>}
        <div className="row end">
          <button onClick={onClose}>Cancel</button>
          <button className="primary" onClick={save}>Save</button>
        </div>
      </div>
    </div>
  );
}
