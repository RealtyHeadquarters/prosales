import { createContext, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken, clearToken } from './api';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | in | out

  useEffect(() => {
    (async () => {
      if (!getToken()) return setStatus('out');
      try {
        const r = await api.get('/auth/me');
        if (!r.user || !['admin', 'manager'].includes(r.user.role)) {
          clearToken();
          return setStatus('out');
        }
        setUser(r.user);
        setStatus('in');
      } catch {
        clearToken();
        setStatus('out');
      }
    })();
  }, []);

  async function login(email, password) {
    const r = await api.post('/auth/login', { email, password });
    if (!['admin', 'manager'].includes(r.user.role)) {
      throw new Error('Only managers/admins can access the dashboard.');
    }
    setToken(r.token);
    setUser(r.user);
    setStatus('in');
  }

  function logout() {
    clearToken();
    setUser(null);
    setStatus('out');
  }

  return <AuthCtx.Provider value={{ user, status, login, logout }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
