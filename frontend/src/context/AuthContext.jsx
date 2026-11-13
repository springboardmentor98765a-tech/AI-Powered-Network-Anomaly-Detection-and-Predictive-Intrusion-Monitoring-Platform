
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import api from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(async () => {
    try {
      if (sessionStorage.getItem("access_token")) {
        await api.post("/auth/logout");
      }
    } catch (error) {
      console.error("Server logout failed:", error);
    } finally {
      sessionStorage.removeItem("access_token");
      setUser(null);
    }
  }, []);

  const login = async (identifier, password) => {
    const response = await api.post("/auth/login", {
      identifier,
      password,
    });

    const token = response.data.access_token;

    sessionStorage.setItem("access_token", token);

    try {
      const profileResponse = await api.get("/auth/me");
      setUser(profileResponse.data);
      return profileResponse.data;
    } catch (error) {
      sessionStorage.removeItem("access_token");
      setUser(null);
      throw error;
    }
  };

  useEffect(() => {
    let active = true;

    const restoreSession = async () => {
      const token = sessionStorage.getItem("access_token");

      if (!token) {
        if (active) setLoading(false);
        return;
      }

      try {
        const response = await api.get("/auth/me");

        if (active) {
          setUser(response.data);
        }
      } catch {
        sessionStorage.removeItem("access_token");

        if (active) {
          setUser(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    restoreSession();

    return () => {
      active = false;
    };
  }, []);

  const value = {
    user,
    loading,
    login,
    logout,
    isAuthenticated: Boolean(user),
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
