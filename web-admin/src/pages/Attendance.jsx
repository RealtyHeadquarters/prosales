import { useEffect, useState } from 'react';
import { api } from '../api';

export default function Attendance() {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await api.get('/attendance', { date });
        setRows(r.attendance || []);
      } catch {
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [date]);

  const time = (iso) => (iso ? new Date(iso).toLocaleTimeString() : '—');
  const hours = (r) => {
    if (!r.check_in_at || !r.check_out_at) return '—';
    return ((new Date(r.check_out_at) - new Date(r.check_in_at)) / 3.6e6).toFixed(1);
  };

  return (
    <div className="page">
      <div className="page-head">
        <h2>Attendance</h2>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Check-in</th>
            <th>Check-out</th>
            <th>Hours</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.user_name}</td>
              <td>{time(r.check_in_at)}</td>
              <td>{time(r.check_out_at)}</td>
              <td>{hours(r)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!loading && rows.length === 0 && <p className="muted" style={{ marginTop: 12 }}>No attendance recorded for {date}.</p>}
    </div>
  );
}
