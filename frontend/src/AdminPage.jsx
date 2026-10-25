import { useEffect, useState } from 'react'
import { useAuth } from './AuthContext'
import { getMe } from './api'
import LiveOrders from './LiveOrders'
import MenuManager from './MenuManager'

const TABS = [
  { id: 'orders', label: 'Live Orders', roles: ['owner', 'staff'] },
  { id: 'menu', label: 'Menu', roles: ['owner', 'staff'] },
  { id: 'reports', label: 'Reports', roles: ['owner'] },
]

function LoginForm() {
  const { login } = useAuth()
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!phone.trim() || !password) {
      setError('Please enter your phone number and password.')
      return
    }
    setLoading(true)
    try {
      await login(phone.trim(), password)
    } catch (err) {
      const detail = err.response?.data?.detail
      setError(
        typeof detail === 'string'
          ? detail
          : 'Could not log in. Please check your internet and try again.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-amber-950 p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-3xl bg-amber-50 p-6 shadow-2xl">
        <img
          src="/images/logo.jpg"
          alt="JD's Wafflory logo"
          className="mx-auto h-20 w-20 rounded-full border-4 border-orange-400 object-cover"
        />
        <h1 className="mt-3 text-center text-xl font-bold text-amber-950">Staff login</h1>
        <p className="text-center text-sm text-amber-800">JD's Wafflory</p>

        <label className="mt-5 block text-sm font-semibold text-amber-950" htmlFor="phone">
          Phone number
        </label>
        <input
          id="phone"
          type="tel"
          inputMode="numeric"
          autoComplete="username"
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
          className="mt-1 w-full rounded-xl border-2 border-amber-200 bg-white px-3 py-2 text-amber-950 outline-none focus:border-orange-500"
        />

        <label className="mt-3 block text-sm font-semibold text-amber-950" htmlFor="password">
          Password
        </label>
        <div className="relative mt-1">
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border-2 border-amber-200 bg-white px-3 py-2 pr-16 text-amber-950 outline-none focus:border-orange-500"
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-sm font-semibold text-orange-700"
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>

        {error && (
          <p className="mt-3 rounded-xl bg-red-100 p-3 text-sm font-semibold text-red-800">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-5 w-full rounded-xl bg-orange-500 py-3 text-lg font-bold text-white hover:bg-orange-600 disabled:opacity-60"
        >
          {loading ? 'Logging in...' : 'Log in'}
        </button>
      </form>
    </div>
  )
}

function Dashboard() {
  const { auth, logout } = useAuth()
  const [tab, setTab] = useState('orders')
  const tabs = TABS.filter((t) => t.roles.includes(auth.role))

  // Ask the server who we are. If the saved token is no longer valid (changed,
  // expired, or the account was removed), the server answers 401 and api.js logs us out.
  useEffect(() => {
    getMe().catch(() => {})
  }, [])

  return (
    <div className="min-h-screen bg-amber-50">
      <header className="bg-amber-950 px-4 py-3 text-amber-50">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div>
            <p className="font-bold">JD's Wafflory</p>
            <p className="text-sm text-orange-300">
              {auth.name} · {auth.role === 'owner' ? 'Owner' : 'Staff'}
            </p>
          </div>
          <button
            onClick={logout}
            className="rounded-xl bg-amber-50/15 px-4 py-2 text-sm font-semibold hover:bg-amber-50/25"
          >
            Log out
          </button>
        </div>
      </header>

      <nav className="border-b border-amber-200 bg-white">
        <div className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`whitespace-nowrap border-b-4 px-4 py-3 font-semibold ${
                tab === t.id
                  ? 'border-orange-500 text-orange-700'
                  : 'border-transparent text-amber-900 hover:text-orange-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>

         <main className="mx-auto max-w-5xl p-4">
           {tab === 'orders' ? (
             <LiveOrders />
           ) : tab === 'menu' ? (
             <MenuManager />
           ) : (
             <div className="rounded-2xl bg-white p-6 text-center text-amber-900 shadow-sm">
               <p className="text-lg font-bold">{tabs.find((t) => t.id === tab)?.label}</p>
               <p className="mt-1 text-sm">This screen is coming in the next steps.</p>
             </div>
           )}
         </main>
    </div>
  )
}

export default function AdminPage() {
  const { auth } = useAuth()

  // Ask search engines not to list this page
  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    return () => meta.remove()
  }, [])

  return auth ? <Dashboard /> : <LoginForm />
}