import { useCallback, useEffect, useRef, useState } from 'react'
import { getAdminOrders, getBranches, markOrderPaid, setOrderStatus } from './api'

const REFRESH_MS = 5000

// For each status: the next step, and how its button looks
const NEXT = {
  received: { status: 'preparing', label: 'Start preparing', style: 'bg-orange-500 hover:bg-orange-600' },
  preparing: { status: 'ready', label: 'Mark ready', style: 'bg-green-600 hover:bg-green-700' },
  ready: { status: 'completed', label: 'Collected', style: 'bg-amber-900 hover:bg-amber-950' },
}

const STATUS_LABEL = { received: 'NEW', preparing: 'Preparing', ready: 'Ready' }
const STATUS_STYLE = {
  received: 'bg-red-600 text-white',
  preparing: 'bg-orange-100 text-orange-800',
  ready: 'bg-green-100 text-green-800',
}

function formatTime(value) {
  return new Date(value).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
}

// Assumes the device is set to Indian time, which is true for the shop's phones
function minutesAgo(value) {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000))
  return mins < 1 ? 'just now' : `${mins} min ago`
}

// A short "ding-ding-ding" made with the browser's own sound generator, so no file is needed
function playAlert(ctx) {
  if (!ctx) return
  const start = ctx.currentTime
  const notes = [880, 1175, 880]
  for (let i = 0; i < notes.length; i++) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    const at = start + i * 0.25
    osc.type = 'sine'
    osc.frequency.value = notes[i]
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.exponentialRampToValueAtTime(0.4, at + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.22)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(at)
    osc.stop(at + 0.25)
  }
}

export default function LiveOrders() {
  const [branches, setBranches] = useState([])
  const [branchFilter, setBranchFilter] = useState(null) // null means all branches
  const [orders, setOrders] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [soundOn, setSoundOn] = useState(false)

  const audioRef = useRef(null)
  const soundOnRef = useRef(false)
  const knownIds = useRef(null) // null until the first load, so old orders don't beep

  useEffect(() => {
    getBranches()
      .then(setBranches)
      .catch(() => {})
  }, [])

  const load = useCallback(async () => {
    try {
      const params = branchFilter ? { branch_id: branchFilter } : {}
      const data = await getAdminOrders(params)
      setOrders(data)
      setError('')
      setLoaded(true)

      if (knownIds.current) {
        const fresh = data.filter((o) => o.status === 'received' && !knownIds.current.has(o.id))
        if (fresh.length > 0 && soundOnRef.current) playAlert(audioRef.current)
      }
      knownIds.current = new Set(data.map((o) => o.id))
    } catch (err) {
      // A 401 is handled in api.js (it sends the user back to the login page)
      if (err.response?.status !== 401) setError('Cannot reach the server. Trying again...')
    }
  }, [branchFilter])

  // Load now, then every 5 seconds
  useEffect(() => {
    load()
    const timer = setInterval(load, REFRESH_MS)
    return () => clearInterval(timer)
  }, [load])

  // Show the number of new orders in the browser tab title
  const newOrders = orders.filter((o) => o.status === 'received').length
  useEffect(() => {
    const original = document.title
    document.title = newOrders > 0 ? `(${newOrders}) New orders - JD's Wafflory` : "Orders - JD's Wafflory"
    return () => {
      document.title = original
    }
  }, [newOrders])

  const changeBranch = (id) => {
    knownIds.current = null // orders from another branch must not count as new
    setLoaded(false)
    setBranchFilter(id)
  }

  const enableSound = () => {
    if (!audioRef.current) {
      audioRef.current = new (window.AudioContext || window.webkitAudioContext)()
    }
    audioRef.current.resume()
    soundOnRef.current = true
    setSoundOn(true)
    playAlert(audioRef.current) // a test beep so the owner knows it works
  }

  const disableSound = () => {
    soundOnRef.current = false
    setSoundOn(false)
  }

  const runAction = async (orderId, action) => {
    setBusyId(orderId)
    setActionError('')
    try {
      await action()
    } catch (err) {
      if (err.response?.status === 401) return
      const detail = err.response?.data?.detail
      setActionError(typeof detail === 'string' ? detail : 'That did not work. Please try again.')
    } finally {
      await load()
      setBusyId(null)
    }
  }

  const advance = (order) => {
    const next = NEXT[order.status]
    if (
      next.status === 'completed' &&
      order.payment_status !== 'paid' &&
      !window.confirm(`Order #${order.id} is not marked as paid yet. Mark it as collected anyway?`)
    ) {
      return
    }
    runAction(order.id, () => setOrderStatus(order.id, next.status))
  }

  const cancel = (order) => {
    if (!window.confirm(`Cancel order #${order.id} for ${order.customer_name}?`)) return
    runAction(order.id, () => setOrderStatus(order.id, 'cancelled'))
  }

  const branchName = (id) => branches.find((b) => b.id === id)?.name

  return (
    <div>
      {/* Sound */}
      {soundOn ? (
        <div className="flex items-center justify-between rounded-xl bg-green-100 px-4 py-2 text-sm font-semibold text-green-800">
          <span>🔔 Sound is on. You will hear a beep for new orders.</span>
          <button onClick={disableSound} className="underline">
            Turn off
          </button>
        </div>
      ) : (
        <button
          onClick={enableSound}
          className="w-full rounded-xl bg-amber-200 px-4 py-3 text-left text-sm font-bold text-amber-900 hover:bg-amber-300"
        >
          🔕 Sound is off. Tap here to hear a beep when a new order arrives.
        </button>
      )}

      {/* Branch filter */}
      {branches.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {[{ id: null, name: 'All branches' }, ...branches].map((b) => (
            <button
              key={b.id ?? 'all'}
              onClick={() => changeBranch(b.id)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold ${
                branchFilter === b.id
                  ? 'bg-orange-500 text-white'
                  : 'bg-white text-amber-900 shadow-sm'
              }`}
            >
              {b.name}
            </button>
          ))}
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-xl bg-red-100 p-3 text-center font-semibold text-red-800">
          {error}
        </p>
      )}
      {actionError && (
        <p className="mt-3 rounded-xl bg-red-100 p-3 text-center font-semibold text-red-800">
          {actionError}
        </p>
      )}

      {!loaded && !error && <p className="mt-6 text-center text-amber-900">Loading orders...</p>}

      {loaded && orders.length === 0 && (
        <div className="mt-6 rounded-2xl bg-white p-8 text-center text-amber-900 shadow-sm">
          <p className="text-lg font-bold">No active orders right now</p>
          <p className="mt-1 text-sm">New orders will appear here by themselves.</p>
        </div>
      )}

      {/* Orders, oldest first */}
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {orders.map((o) => {
          const next = NEXT[o.status]
          const busy = busyId === o.id
          return (
            <div
              key={o.id}
              className={`rounded-2xl bg-white p-4 shadow-sm ${
                o.status === 'received' ? 'ring-2 ring-red-500' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-2xl font-extrabold text-amber-950">#{o.id}</p>
                  <p className="text-sm text-amber-800">
                    {branchName(o.branch_id) || o.branch_name} · {formatTime(o.created_at)} (
                    {minutesAgo(o.created_at)})
                  </p>
                </div>
                <span className={`rounded-full px-3 py-1 text-sm font-bold ${STATUS_STYLE[o.status]}`}>
                  {STATUS_LABEL[o.status]}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                <span className="font-bold text-amber-950">{o.customer_name}</span>
                <a
                  href={`tel:${o.customer_phone}`}
                  className="rounded-full bg-amber-100 px-3 py-1 font-semibold text-amber-900"
                >
                  📞 {o.customer_phone}
                </a>
                <span
                  className={`rounded-full px-3 py-1 font-semibold ${
                    o.order_type === 'parcel'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-purple-100 text-purple-800'
                  }`}
                >
                  {o.order_type === 'parcel' ? 'Parcel' : 'Eat here'}
                </span>
              </div>

              <p className="mt-2 text-sm font-semibold text-amber-900">
                Customer comes at about {formatTime(o.pickup_time)}
              </p>

              <ul className="mt-2 space-y-1 border-t pt-2 text-amber-950">
                {o.items.map((l, i) => (
                  <li key={i} className="flex justify-between">
                    <span>
                      <b>{l.quantity} ×</b> {l.item_name}
                      {l.variant_label !== 'Regular' && ` (${l.variant_label})`}
                    </span>
                    <span>₹{l.line_total}</span>
                  </li>
                ))}
                {o.parcel_charge > 0 && (
                  <li className="flex justify-between text-sm text-amber-800">
                    <span>Parcel charge</span>
                    <span>₹{o.parcel_charge}</span>
                  </li>
                )}
              </ul>

              <p className="mt-2 flex items-center justify-between border-t pt-2 text-lg font-bold text-amber-950">
                <span>Total ₹{o.total}</span>
                <span
                  className={`rounded-full px-3 py-1 text-sm ${
                    o.payment_status === 'paid'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-amber-200 text-amber-900'
                  }`}
                >
                  {o.payment_status === 'paid' ? 'Paid ✓' : 'Not paid yet'}
                </span>
              </p>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  disabled={busy}
                  onClick={() => advance(o)}
                  className={`col-span-2 rounded-xl py-3 text-lg font-bold text-white disabled:opacity-50 ${next.style}`}
                >
                  {busy ? 'Please wait...' : next.label}
                </button>
                {o.payment_status !== 'paid' && (
                  <button
                    disabled={busy}
                    onClick={() => runAction(o.id, () => markOrderPaid(o.id))}
                    className="rounded-xl bg-green-100 py-2 font-bold text-green-800 hover:bg-green-200 disabled:opacity-50"
                  >
                    Mark paid
                  </button>
                )}
                <button
                  disabled={busy}
                  onClick={() => cancel(o)}
                  className={`rounded-xl bg-red-50 py-2 font-bold text-red-700 hover:bg-red-100 disabled:opacity-50 ${
                    o.payment_status === 'paid' ? 'col-span-2' : ''
                  }`}
                >
                  Cancel order
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <p className="mt-4 text-center text-xs text-amber-800">
        This list updates by itself every 5 seconds.
      </p>
    </div>
  )
}