import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './auth';
import Layout from './components/Layout';
import Login from './pages/Login';
import LiveMap from './pages/LiveMap';
import Attendance from './pages/Attendance';
import Reports from './pages/Reports';
import Clients from './pages/Clients';
import Territories from './pages/Territories';
import Team from './pages/Team';

export default function App() {
  const { status } = useAuth();

  if (status === 'loading') return <div className="fullcenter">Loading…</div>;
  if (status === 'out') {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<LiveMap />} />
        <Route path="/attendance" element={<Attendance />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="/territories" element={<Territories />} />
        <Route path="/team" element={<Team />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
