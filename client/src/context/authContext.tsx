// src/context/authContext.tsx
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import api from '../api/axios';

export interface Role {
  id: number;
  role_name: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
  status: string;
  roles: Role[];
}

interface AuthContextType {
  token: string | null;
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(!!localStorage.getItem('token'));
  const [error, setError] = useState<string | null>(null);

  // Fetch authenticated user details whenever a token is present
  useEffect(() => {
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    api
      .get<User>('/auth/me')
      .then((res) => setUser(res.data))
      .catch(() => {
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, [token]);

  const login = async (email: string, password: string) => {
    try {
      setError(null);
      const response = await api.post('/auth/login', { email, password });
      const accessToken = response.data.access_token;
      localStorage.setItem('token', accessToken);
      setToken(accessToken);
      window.location.href = '/dashboard';
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Invalid email or password');
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      console.error(e);
    }
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ token, user, loading, login, logout, error }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};