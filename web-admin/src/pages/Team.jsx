import { useEffect, useState } from 'react';
import { api } from '../api';

export default function Team() {
  const [users, setUsers] = useState([]);
  const [show, setShow] = useState(false);

  async function load() {
    try {
      const r = await api.get('/users');
      setUsers(r.users || []);
    } catch {
      setUsers([]);
    }
  }
  useEffect(() => {
    load();
  }, []);

  return (
    <div className="page">
      <div className="page-head">
        <h2>Team</h2>
        <button className="primary" onClick={() => setShow(true)}>+ Add member</button>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Phone</th>
            <th>Active</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.name}</td>
              <td>{u.email}</td>
              <td>{u.role}</td>
              <td>{u.phone || '—'}</td>
              <td>{u.is_active ? '✅' : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {show && <NewUser onClose={() => setShow(false)} onSaved={() => { setShow(false); load(); }} />}
    </div>
  );
}

function NewUser({ onClose, onSaved }) {
  const [f, setF] = useState({ name: '', email: '', phone: '', password: '', role: 'sales' });
  const [err, setErr] = useState('');

  async function save() {
    if (!f.name || !f.email || !f.password) return setErr('Name, email and password are required');
    try {
      await api.post('/auth/register', f);
      onSaved();
    } catch (e) {
      setErr(e.message);
    }
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Add Team Member</h3>
        <input placeholder="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <input placeholder="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <input placeholder="Phone" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        <input type="password" placeholder="Password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        <select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
          <option value="sales">Sales rep</option>
          <option value="manager">Manager</option>
        </select>
        {err && <div className="error">{err}</div>}
        <div className="row end">
          <button onClick={onClose}>Cancel</button>
          <button className="primary" onClick={save}>Save</button>
        </div>
      </div>
    </div>
  );
}
