import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, getToken, setToken } from '../api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  // hydrate from existing token
  useEffect(() => {
    let cancelled = false;
    async function init() {
      if (!getToken()) {
        setLoading(false);
        return;
      }
      try {
        const { user } = await api('/me');
        if (!cancelled) setUser(user);
      } catch {
        if (!cancelled) logout();
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    init();
    return () => { cancelled = true; };
  }, [logout]);

  // global 401 handler from api.js
  useEffect(() => {
    const handler = () => setUser(null);
    window.addEventListener('stride:logout', handler);
    return () => window.removeEventListener('stride:logout', handler);
  }, []);

  async function login(email, password) {
    const { token, user } = await api('/auth/login', { method: 'POST', body: { email, password } });
    setToken(token);
    setUser(user);
  }

  async function signup(email, password, display_name) {
    const { token, user } = await api('/auth/signup', { method: 'POST', body: { email, password, display_name } });
    setToken(token);
    setUser(user);
  }

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
