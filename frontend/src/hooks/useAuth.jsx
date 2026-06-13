import { createContext, useContext, useState, useEffect } from 'react';
import api from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [founder, setFounder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('founder_token');
    if (!token) { setLoading(false); return; }
    api.get('/api/auth/me')
      .then(r => setFounder(r.data))
      .catch(() => localStorage.removeItem('founder_token'))
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    const { data } = await api.post('/api/auth/login', { email, password });
    localStorage.setItem('founder_token', data.token);
    setFounder({ email: data.email });
    return data;
  }

  function logout() {
    localStorage.removeItem('founder_token');
    setFounder(null);
  }

  return (
    <AuthContext.Provider value={{ founder, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
