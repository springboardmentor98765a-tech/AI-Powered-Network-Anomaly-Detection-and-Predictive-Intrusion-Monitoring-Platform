import { createContext, useContext, useEffect, useState } from "react";
import api, { getToken, saveToken, clearToken } from "../api/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // When the app starts (or page refreshes): if a token exists, load the user
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get("/auth/me")
      .then((res) => setUser(res.data))
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, []);

  // Shared by both login methods: save the token, then load the profile
  const finishLogin = async (accessToken, remember) => {
    saveToken(accessToken, remember);
    const me = await api.get("/auth/me");
    setUser(me.data);
    return me.data;
  };

  // Login with email/username + password
  const login = async (identifier, password, remember = false) => {
    const res = await api.post("/auth/login", { identifier, password, remember });
    return finishLogin(res.data.access_token, remember);
  };

  // Login with a Google credential (ID token)
  const loginWithGoogle = async (credential, remember = false) => {
    const res = await api.post("/auth/google", { credential, remember });
    return finishLogin(res.data.access_token, remember);
  };

  // Logout: tell the backend to revoke the token, then clear it here
  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // even if the call fails, we still log out locally
    }
    clearToken();
    setUser(null);
  };

  const roles = user ? user.roles.map((r) => r.role_name) : [];
  const hasRole = (...allowed) => roles.some((r) => allowed.includes(r));

  return (
    <AuthContext.Provider
      value={{ user, roles, hasRole, loading, login, loginWithGoogle, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}