import { createContext, useContext, useState } from 'react'
import { AUTH_KEY, login as loginRequest, setAuthToken } from './api'

const AuthContext = createContext(null)

// A quick check so we don't show the dashboard with an obviously expired token.
// This is only for convenience. The server checks the token properly on every request.
function tokenExpired(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(atob(base64))
    return payload.exp * 1000 < Date.now()
  } catch {
    return true
  }
}

function readSavedLogin() {
  try {
    const saved = JSON.parse(localStorage.getItem(AUTH_KEY))
    if (saved?.token && !tokenExpired(saved.token)) {
      setAuthToken(saved.token)
      return saved
    }
    localStorage.removeItem(AUTH_KEY)
  } catch {
    // storage blocked or damaged: treat as logged out
  }
  return null
}

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(readSavedLogin)

  const login = async (phone, password) => {
    const data = await loginRequest(phone, password)
    const next = { token: data.access_token, name: data.name, role: data.role }
    setAuthToken(next.token)
    try {
      localStorage.setItem(AUTH_KEY, JSON.stringify(next))
    } catch {
      // if storage is blocked the owner just has to log in again after a refresh
    }
    setAuth(next)
  }

  const logout = () => {
    setAuthToken(null)
    try {
      localStorage.removeItem(AUTH_KEY)
    } catch {
      // nothing to clean up
    }
    setAuth(null)
  }

  return <AuthContext.Provider value={{ auth, login, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}