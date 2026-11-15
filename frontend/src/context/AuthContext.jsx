/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   AuthContext — provides { user, loading, login, logout }.
   Session is restored on mount via GET /users/me using
   the token already stored in localStorage.
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import client, { tokenStore } from '../api/client'
import { apiLogin, apiLogout } from '../api/auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  // If no token exists, we are not loading a session
  const [loading, setLoading] = useState(() => Boolean(tokenStore.get()))

  /* Restore session on first mount if token is present */
  useEffect(() => {
    const token = tokenStore.get()
    if (!token) return

    client.get('/users/me')
      .then((res) => setUser(res.data))
      .catch(() => tokenStore.clear())   // bad / expired token → clear silently
      .finally(() => setLoading(false))
  }, [])

  /**
   * login(identifier, password) → resolves with the UserOut object.
   * Throws on 401 / 429 — the caller (Login page) handles the message.
   */
  const login = useCallback(async (identifier, password) => {
    const { access_token } = await apiLogin(identifier, password)
    tokenStore.set(access_token)
    const me = await client.get('/users/me')
    setUser(me.data)
    return me.data
  }, [])

  /**
   * logout() — always clears local state, even if the server call fails.
   */
  const logout = useCallback(async () => {
    try {
      await apiLogout()
    } catch {
      // ignore server errors — we always clear the session
    } finally {
      tokenStore.clear()
      setUser(null)
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

/** Hook — must be called inside AuthProvider */
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
