import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { api } from '../api';

export default function Reports() {
  const [reps, setReps] = useState([]);
  const [range, setRange] = useState({});

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get('/reports/team');
        setReps(r.reps || []);
        setRange({ from: r.from, to: r.to });
      } catch {
        setReps([]);
      }
    })();
  }, []);

  const chart = reps.map((r) => ({
    name: r.user_name,
    Meetings: r.meetings_done,
    'Distance (km)': +(r.distance_m / 1000).toFixed(1),
  }));

  return (
    <div className="page">
      <div className="page-head">
        <h2>Team Performance</h2>
        <span className="muted">{range.from} → {range.to}</span>
      </div>

      <div className="card" style={{ height: 320, padding: 16, marginBottom: 20 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chart}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="Meetings" fill="#2563eb" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Distance (km)" fill="#16a34a" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Rep</th>
            <th>Meetings done</th>
            <th>Planned</th>
            <th>Distance (km)</th>
            <th>Work hrs</th>
            <th>Tasks done</th>
            <th>Pending</th>
            <th>Clients</th>
          </tr>
        </thead>
        <tbody>
          {reps.map((r) => (
            <tr key={r.user_id}>
              <td>{r.user_name}</td>
              <td>{r.meetings_done}</td>
              <td>{r.meetings_planned}</td>
              <td>{(r.distance_m / 1000).toFixed(1)}</td>
              <td>{r.working_hours}</td>
              <td>{r.tasks_done}</td>
              <td>{r.tasks_pending}</td>
              <td>{r.clients_count}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {reps.length === 0 && <p className="muted" style={{ marginTop: 12 }}>No data yet for this period.</p>}
    </div>
  );
}
