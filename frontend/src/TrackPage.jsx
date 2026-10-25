import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { trackOrder } from './api'

const STEPS = [
  { status: 'received', label: 'Order received', hint: 'We have your order.' },
  { status: 'preparing', label: 'Preparing', hint: 'Your waffle is being made.' },
  { status: 'ready', label: 'Ready to collect', hint: 'Come to the cart and show your order number.' },
  { status: 'completed', label: 'Collected', hint: 'Enjoy!' },
]
const FINISHED = ['completed', 'cancelled']
const REFRESH_MS = 10000

function readLastOrder() {
  try {
    return JSON.parse(localStorage.getItem('lastOrder')) || {}
  } catch {
    return {}
  }
}

function formatTime(value) {
  return new Date(value).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
}

export default function TrackPage() {
  const [saved] = useState(readLastOrder)
  const [orderId, setOrderId] = useState(saved.id ? String(saved.id) : '')
  const [phone, setPhone] = useState(saved.phone || '')
  const [order, setOrder] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const fetchOrder = useCallback(async (id, ph, quiet = false) => {
    if (!quiet) {
      setLoading(true)
      setError('')
    }
    try {
      const data = await trackOrder(id, ph)
      setOrder(data)
      setError('')
    } catch (err) {
      if (err.response?.status === 404) {
        setOrder(null)
        setError(
          'We could not find that order. Please check the order number and the phone number.',
        )
      } else if (!quiet) {
        setError('Could not reach the server. Please try again.')
      }
    } finally {
      if (!quiet) setLoading(false)
    }
  }, [])

  // If this phone placed an order recently, open it straight away
  useEffect(() => {
    if (saved.id && saved.phone) fetchOrder(saved.id, saved.phone)
  }, [saved.id, saved.phone, fetchOrder])

  // Refresh every 10 seconds until the order is finished
  const status = order?.status
  const loadedId = order?.id
  useEffect(() => {
    if (!loadedId || FINISHED.includes(status)) return
    const timer = setInterval(() => fetchOrder(loadedId, phone, true), REFRESH_MS)
    return () => clearInterval(timer)
  }, [loadedId, status, phone, fetchOrder])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!/^\d{1,9}$/.test(orderId)) {
      setError('Please enter your order number (numbers only).')
      return
    }
    if (!/^[6-9]\d{9}$/.test(phone)) {
      setError('Please enter the 10-digit mobile number you used for the order.')
      return
    }
    fetchOrder(orderId, phone)
  }

  const stepIndex = order ? STEPS.findIndex((s) => s.status === order.status) : -1

  return (
    <div className="relative isolate min-h-screen">
      <div className="fixed inset-0 -z-10">
        <img
          src="/images/background.jpg"
          alt=""
          className="h-full w-full scale-105 object-cover blur-md"
        />
        <div className="absolute inset-0 bg-amber-950/50" />
      </div>

      <header className="px-4 pb-4 pt-8 text-center">
        <img
          src="/images/logo.jpg"
          alt="JD's Wafflory logo"
          className="mx-auto h-20 w-20 rounded-full border-4 border-orange-400 object-cover shadow-xl"
        />
        <h1 className="mt-3 text-2xl font-bold text-amber-50">Track your order</h1>
      </header>

      <main className="mx-auto max-w-lg px-4 pb-16">
        {error && (
          <p className="mb-3 rounded-2xl bg-red-100/95 p-3 text-center font-semibold text-red-800">
            {error}
          </p>
        )}

        {!order ? (
          /* ---------- Look up an order ---------- */
          <form
            onSubmit={handleSubmit}
            className="space-y-3 rounded-2xl bg-white/85 p-4 shadow-lg backdrop-blur-md"
          >
            <p className="text-sm text-amber-900">
              Enter the order number from your confirmation and the phone number you used.
            </p>
            <input
              type="text"
              inputMode="numeric"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value.replace(/\D/g, '').slice(0, 9))}
              placeholder="Order number"
              className="w-full rounded-xl border-2 border-amber-200 bg-white px-3 py-2 text-amber-950 outline-none focus:border-orange-500"
            />
            <input
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="10-digit mobile number"
              className="w-full rounded-xl border-2 border-amber-200 bg-white px-3 py-2 text-amber-950 outline-none focus:border-orange-500"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-orange-500 py-3 font-bold text-white hover:bg-orange-600 disabled:opacity-60"
            >
              {loading ? 'Looking...' : 'Track order'}
            </button>
          </form>
        ) : (
          /* ---------- The order ---------- */
          <div className="space-y-3">
            <div className="rounded-2xl bg-white/85 p-4 text-center shadow-lg backdrop-blur-md">
              <p className="text-sm text-amber-900">Order number</p>
              <p className="text-4xl font-extrabold text-orange-600">#{order.id}</p>
              <p className="font-semibold text-amber-950">{order.branch_name}</p>
            </div>

            {order.status === 'cancelled' ? (
              <p className="rounded-2xl bg-red-100/95 p-4 text-center font-semibold text-red-800">
                This order was cancelled. If this is a mistake, please call or WhatsApp
                8169439642.
              </p>
            ) : (
              <>
                {order.status === 'ready' && (
                  <p className="rounded-2xl bg-green-100/95 p-4 text-center text-lg font-bold text-green-800">
                    Your order is ready! Please collect it from the cart.
                  </p>
                )}

                <ol className="rounded-2xl bg-white/85 p-4 shadow-lg backdrop-blur-md">
                  {STEPS.map((step, i) => {
                    const done = i < stepIndex || order.status === 'completed'
                    const current = i === stepIndex && order.status !== 'completed'
                    return (
                      <li key={step.status} className="flex gap-3 pb-4 last:pb-0">
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                            done
                              ? 'bg-green-600 text-white'
                              : current
                                ? 'bg-orange-500 text-white ring-4 ring-orange-200'
                                : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {done ? '✓' : i + 1}
                        </span>
                        <div>
                          <p
                            className={`font-bold ${
                              done || current ? 'text-amber-950' : 'text-amber-700/60'
                            }`}
                          >
                            {step.label}
                          </p>
                          {current && <p className="text-sm text-amber-900">{step.hint}</p>}
                        </div>
                      </li>
                    )
                  })}
                </ol>
              </>
            )}

            <div className="rounded-2xl bg-white/85 p-4 text-amber-950 shadow-lg backdrop-blur-md">
              {order.status !== 'cancelled' && order.status !== 'completed' && (
                <p className="mb-2 text-sm">
                  Ready at about <b>{formatTime(order.pickup_time)}</b>
                </p>
              )}
              <ul className="space-y-1 text-sm">
                {order.items.map((l, i) => (
                  <li key={i} className="flex justify-between">
                    <span>
                      {l.quantity} × {l.item_name}
                      {l.variant_label !== 'Regular' && ` (${l.variant_label})`}
                    </span>
                    <span>₹{l.line_total}</span>
                  </li>
                ))}
                {order.parcel_charge > 0 && (
                  <li className="flex justify-between">
                    <span>Parcel charge</span>
                    <span>₹{order.parcel_charge}</span>
                  </li>
                )}
              </ul>
              <p className="mt-2 flex justify-between border-t pt-2 text-lg font-bold">
                <span>Total</span>
                <span>₹{order.total}</span>
              </p>
              {order.status !== 'cancelled' && (
                <p
                  className={`mt-2 rounded-lg p-2 text-center text-sm font-semibold ${
                    order.payment_status === 'paid'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-amber-200 text-amber-900'
                  }`}
                >
                  {order.payment_status === 'paid'
                    ? 'Paid ✓'
                    : `Please pay ₹${order.total} at the cart when you collect.`}
                </p>
              )}
            </div>

            {!FINISHED.includes(order.status) && (
              <p className="text-center text-xs text-amber-100">
                This page updates by itself every 10 seconds.
              </p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => fetchOrder(order.id, phone)}
                className="rounded-xl bg-white/25 py-2 font-semibold text-amber-50 backdrop-blur-md hover:bg-white/35"
              >
                Refresh now
              </button>
              <button
                onClick={() => setOrder(null)}
                className="rounded-xl bg-white/25 py-2 font-semibold text-amber-50 backdrop-blur-md hover:bg-white/35"
              >
                Another order
              </button>
            </div>
          </div>
        )}

        <Link
          to="/"
          className="mt-6 block text-center font-semibold text-orange-300 underline hover:text-orange-200"
        >
          ← Back to the menu
        </Link>
      </main>
    </div>
  )
}