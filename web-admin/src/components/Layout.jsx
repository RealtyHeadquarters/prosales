import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth';

const links = [
  { to: '/', label: 'Live Map', icon: '🗺️', end: true },
  { to: '/attendance', label: 'Attendance', icon: '🕘' },
  { to: '/reports', label: 'Reports', icon: '📊' },
  { to: '/clients', label: 'Clients', icon: '👥' },
  { to: '/territories', label: 'Territories', icon: '📍' },
  { to: '/team', label: 'Team', icon: '🧑‍💼' },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">📍 ProSales</div>
        <nav>
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => (isActive ? 'active' : '')}>
              <span>{l.icon}</span> {l.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="main">
        <header className="topbar">
          <div />
          <div className="user">
            {user?.name}
            <span className="role">{user?.role}</span>
            <button onClick={logout}>Logout</button>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
