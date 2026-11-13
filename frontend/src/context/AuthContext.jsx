import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, getToken, setToken, removeToken } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadUser() {
      const token = getToken();
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const userData = await api.getMe();
        setUser(userData);
      } catch (err) {
        console.error('Failed to restore session:', err);
        removeToken();
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    loadUser();

    const handleExpired = () => {
      setUser(null);
      setError('Your session has expired or was revoked. Please log in again.');
    };

    window.addEventListener('auth:expired', handleExpired);
    return () => window.removeEventListener('auth:expired', handleExpired);
  }, []);

  const login = async (username_or_email, password) => {
    setError(null);
    try {
      const response = await api.login(username_or_email, password);
      setToken(response.access_token);
      setUser(response.user);
      return response.user;
    } catch (err) {
      setError(err.message || 'Invalid credentials');
      throw err;
    }
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch (err) {
      console.warn('Logout network call error:', err);
    } finally {
      removeToken();
      setUser(null);
    }
  };

  const refreshUser = async () => {
    try {
      const updated = await api.getMe();
      setUser(updated);
    } catch (err) {
      console.error('Refresh user error:', err);
    }
  };

  const isAdmin = user?.role === 'Administrator';
  const isTeamLead = user?.role === 'Team Lead / Supervisor';
  const isAnalyst = user?.role === 'Security Analyst';

  const hasRole = (allowedRoles) => {
    if (!user) return false;
    if (Array.isArray(allowedRoles)) {
      return allowedRoles.includes(user.role);
    }
    return user.role === allowedRoles;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        setError,
        login,
        logout,
        refreshUser,
        isAdmin,
        isTeamLead,
        isAnalyst,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
