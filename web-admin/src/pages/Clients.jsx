import { useEffect, useState } from 'react';
import { api } from '../api';

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [q, setQ] = useState('');
  const [show, setShow] = useState(false);

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
          </tr>
        </thead>
        <tbody>
          {filtered.map((c) => (
            <tr key={c.id}>
              <td>{c.name}</td>
              <td>{c.company || '—'}</td>
              <td>{c.phone || '—'}</td>
              <td><span className={'chip ' + (c.status || 'lead')}>{c.status || 'lead'}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
      {show && <NewClient onClose={() => setShow(false)} onSaved={() => { setShow(false); load(); }} />}
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
