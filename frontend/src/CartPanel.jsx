import { useState } from 'react'
import { useCart } from './CartContext'
import { placeOrder } from './api'
import { Link } from 'react-router-dom'

const PARCEL_CHARGE = 10
const PICKUP_OPTIONS = [10, 15, 20, 30, 45, 60]

function errorMessage(err) {
  const detail = err.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) return 'Please check your name and phone number.'
  return 'Could not place the order. Please check your internet and try again.'
}

function formatTime(value) {
  return new Date(value).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
}

export default function CartPanel({ branch, onClose }) {
  const { lines, changeQuantity, clearCart, subtotal } = useCart()
  const [orderType, setOrderType] = useState('dine_in')
  const [pickup, setPickup] = useState(15)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [placed, setPlaced] = useState(null)

  const parcelCharge = orderType === 'parcel' ? PARCEL_CHARGE : 0
  const total = subtotal + parcelCharge

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (name.trim().length < 2) {
      setError('Please enter your name.')
      return
    }
    if (!/^[6-9]\d{9}$/.test(phone)) {
      setError('Please enter a valid 10-digit mobile number.')
      return
    }

    setSubmitting(true)
    try {
      const order = await placeOrder({
        branch_id: branch.id,
        customer_name: name.trim(),
        customer_phone: phone,
        order_type: orderType,
        pickup_in_minutes: pickup,
        items: lines.map((l) => ({
          item_id: l.itemId,
          variant_id: l.variantId,
          quantity: l.quantity,
        })),
      })
      try {
        localStorage.setItem('lastOrder', JSON.stringify({ id: order.id, phone }))
      } catch {
        // storage can be blocked in private mode; tracking still works by typing the details
      }
      setPlaced(order)
      clearCart()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-amber-50 p-5 shadow-2xl sm:rounded-3xl">
        {placed ? (
          /* ---------- Order placed ---------- */
          <div className="text-center">
            <p className="text-5xl">🧇</p>
            <h2 className="mt-2 text-2xl font-bold text-amber-950">Order placed!</h2>
            <p className="mt-1 text-amber-900">Your order number is</p>
            <p className="text-5xl font-extrabold text-orange-600">#{placed.id}</p>

            <div className="mt-4 rounded-2xl bg-white p-4 text-left text-amber-950 shadow-sm">
              <p className="font-bold">{placed.branch_name}</p>
              <p className="text-sm">
                Ready at about <b>{formatTime(placed.pickup_time)}</b>
              </p>
              <ul className="mt-2 space-y-1 text-sm">
                {placed.items.map((l, i) => (
                  <li key={i} className="flex justify-between">
                    <span>
                      {l.quantity} × {l.item_name}
                      {l.variant_label !== 'Regular' && ` (${l.variant_label})`}
                    </span>
                    <span>₹{l.line_total}</span>
                  </li>
                ))}
                {placed.parcel_charge > 0 && (
                  <li className="flex justify-between">
                    <span>Parcel charge</span>
                    <span>₹{placed.parcel_charge}</span>
                  </li>
                )}
              </ul>
              <p className="mt-2 flex justify-between border-t pt-2 text-lg font-bold">
                <span>Total</span>
                <span>₹{placed.total}</span>
              </p>
            </div>

            <p className="mt-3 rounded-xl bg-amber-200 p-3 text-sm font-semibold text-amber-900">
              Please pay ₹{placed.total} at the cart when you collect your order. Show this order
              number.
            </p>

            <Link
              to="/track"
              className="mt-4 block w-full rounded-xl bg-orange-500 py-3 text-center font-bold text-white hover:bg-orange-600"
            >
              Track my order
            </Link>
            <button
              onClick={onClose}
              className="mt-2 w-full rounded-xl bg-amber-200 py-3 font-bold text-amber-900 hover:bg-amber-300"
            >
              Done
            </button>
          </div>
        ) : (
          /* ---------- Cart and checkout ---------- */
          <form onSubmit={handleSubmit}>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-amber-950">Your cart</h2>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full px-3 py-1 text-2xl text-amber-900 hover:bg-amber-200"
                aria-label="Close cart"
              >
                ×
              </button>
            </div>
            <p className="text-sm text-amber-800">Collect from: {branch.name}</p>

            <ul className="mt-3 space-y-2">
              {lines.map((l) => (
                <li
                  key={l.variantId}
                  className="flex items-center justify-between gap-3 rounded-xl bg-white p-3 shadow-sm"
                >
                  <div>
                    <p className="font-semibold leading-tight text-amber-950">{l.name}</p>
                    <p className="text-sm text-amber-800">
                      {l.label !== 'Regular' && `${l.label} · `}₹{l.price}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => changeQuantity(l.variantId, -1)}
                      className="h-8 w-8 rounded-full bg-orange-100 text-lg font-bold text-orange-800"
                      aria-label={`Remove one ${l.name}`}
                    >
                      −
                    </button>
                    <span className="w-6 text-center font-bold">{l.quantity}</span>
                    <button
                      type="button"
                      onClick={() => changeQuantity(l.variantId, 1)}
                      className="h-8 w-8 rounded-full bg-orange-500 text-lg font-bold text-white"
                      aria-label={`Add one more ${l.name}`}
                    >
                      +
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            {lines.length === 0 ? (
              <p className="mt-6 text-center text-amber-900">Your cart is empty.</p>
            ) : (
              <>
                {/* Dine-in or parcel */}
                <p className="mt-4 font-semibold text-amber-950">How would you like it?</p>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  {[
                    ['dine_in', 'Eat here'],
                    ['parcel', `Parcel (+₹${PARCEL_CHARGE})`],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setOrderType(value)}
                      className={`rounded-xl border-2 py-2 font-semibold ${
                        orderType === value
                          ? 'border-orange-500 bg-orange-100 text-orange-900'
                          : 'border-amber-200 bg-white text-amber-900'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Pickup time */}
                <p className="mt-4 font-semibold text-amber-950">Ready in</p>
                <div className="mt-1 grid grid-cols-3 gap-2">
                  {PICKUP_OPTIONS.map((minutes) => (
                    <button
                      key={minutes}
                      type="button"
                      onClick={() => setPickup(minutes)}
                      className={`rounded-xl border-2 py-2 text-sm font-semibold ${
                        pickup === minutes
                          ? 'border-orange-500 bg-orange-100 text-orange-900'
                          : 'border-amber-200 bg-white text-amber-900'
                      }`}
                    >
                      {minutes} min
                    </button>
                  ))}
                </div>

                {/* Customer details */}
                <p className="mt-4 font-semibold text-amber-950">Your details</p>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  maxLength={100}
                  autoComplete="name"
                  className="mt-1 w-full rounded-xl border-2 border-amber-200 bg-white px-3 py-2 text-amber-950 outline-none focus:border-orange-500"
                />
                <input
                  type="tel"
                  inputMode="numeric"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="10-digit mobile number"
                  autoComplete="tel"
                  className="mt-2 w-full rounded-xl border-2 border-amber-200 bg-white px-3 py-2 text-amber-950 outline-none focus:border-orange-500"
                />

                {/* Totals */}
                <div className="mt-4 space-y-1 rounded-xl bg-white p-3 text-amber-950 shadow-sm">
                  <p className="flex justify-between text-sm">
                    <span>Items</span>
                    <span>₹{subtotal}</span>
                  </p>
                  {parcelCharge > 0 && (
                    <p className="flex justify-between text-sm">
                      <span>Parcel charge</span>
                      <span>₹{parcelCharge}</span>
                    </p>
                  )}
                  <p className="flex justify-between border-t pt-1 text-lg font-bold">
                    <span>Total</span>
                    <span>₹{total}</span>
                  </p>
                  <p className="text-xs text-amber-800">Pay at the cart when you collect.</p>
                </div>

                {error && (
                  <p className="mt-3 rounded-xl bg-red-100 p-3 text-sm font-semibold text-red-800">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="mt-4 w-full rounded-xl bg-orange-500 py-3 text-lg font-bold text-white hover:bg-orange-600 disabled:opacity-60"
                >
                  {submitting ? 'Placing order...' : `Place order · ₹${total}`}
                </button>
              </>
            )}
          </form>
        )}
      </div>
    </div>
  )
}