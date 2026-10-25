import { useCallback, useEffect, useState } from 'react'
import { getDailyReport } from './api'

const REFRESH_MS = 30000

// Today's date in Indian time, written like 2026-10-25
function todayIST() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
}

function prettyDate(value) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function Bar({ value, max, color }) {
  const width = max > 0 && value > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0
  return (
    <div className="h-3 w-full rounded-full bg-amber-100">
      <div className={`h-3 rounded-full ${color}`} style={{ width: `${width}%` }} />
    </div>
  )
}

export default function Reports() {
  const [day, setDay] = useState(todayIST)
  const [report, setReport] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true)
      try {
        const data = await getDailyReport(day)
        setReport(data)
        setError('')
      } catch (err) {
        // A 401 is handled in api.js (it sends the user back to the login page)
        if (err.response?.status === 403) setError('Only the owner can see reports.')
        else if (err.response?.status !== 401 && !quiet) {
          setError('Could not load the report. Please try again.')
        }
      } finally {
        if (!quiet) setLoading(false)
      }
    },
    [day],
  )

  // Load now, and keep today's report fresh while the page is open
  useEffect(() => {
    load()
    if (day !== todayIST()) return
    const timer = setInterval(() => load(true), REFRESH_MS)
    return () => clearInterval(timer)
  }, [load, day])

  const isToday = day === todayIST()
  const topSales = report ? Math.max(0, ...report.branches.map((b) => b.sales)) : 0
  const topQuantity = report ? Math.max(0, ...report.top_items.map((t) => t.quantity)) : 0
  const average = report && report.orders > 0 ? Math.round(report.total_sales / report.orders) : 0

  return (
    <div>
      {/* Date controls */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="date"
          value={day}
          max={todayIST()}
          onChange={(e) => e.target.value && setDay(e.target.value)}
          className="rounded-xl border-2 border-amber-200 bg-white px-3 py-2 font-semibold text-amber-950 outline-none focus:border-orange-500"
        />
        {!isToday && (
          <button
            onClick={() => setDay(todayIST())}
            className="rounded-xl bg-orange-500 px-4 py-2 font-bold text-white hover:bg-orange-600"
          >
            Today
          </button>
        )}
        <button
          onClick={() => load()}
          className="rounded-xl bg-white px-4 py-2 font-bold text-amber-900 shadow-sm hover:bg-amber-100"
        >
          Refresh
        </button>
      </div>

      {error && (
        <p className="mt-3 rounded-xl bg-red-100 p-3 text-center font-semibold text-red-800">
          {error}
        </p>
      )}

      {loading && !report && <p className="mt-6 text-center text-amber-900">Loading report...</p>}

      {report && (
        <div className="mt-3 space-y-3">
          <p className="font-bold text-amber-950">{prettyDate(report.report_date)}</p>

          {report.orders === 0 && report.cancelled_orders === 0 ? (
            <div className="rounded-2xl bg-white p-8 text-center text-amber-900 shadow-sm">
              <p className="text-lg font-bold">No orders on this day</p>
              <p className="mt-1 text-sm">Sales will appear here as orders come in.</p>
            </div>
          ) : (
            <>
              {/* The big number */}
              <div className="rounded-2xl bg-amber-950 p-5 text-center text-amber-50 shadow-sm">
                <p className="text-sm text-orange-300">Total sales</p>
                <p className="text-5xl font-extrabold">₹{report.total_sales}</p>
                <p className="mt-1 text-sm">
                  {report.orders} {report.orders === 1 ? 'order' : 'orders'}
                  {report.orders > 0 && ` · average ₹${average} per order`}
                </p>
              </div>

              {/* Paid and not paid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-green-100 p-4 text-center">
                  <p className="text-sm font-semibold text-green-800">Paid</p>
                  <p className="text-2xl font-extrabold text-green-900">₹{report.paid_amount}</p>
                </div>
                <div
                  className={`rounded-2xl p-4 text-center ${
                    report.unpaid_amount > 0 ? 'bg-amber-200' : 'bg-white'
                  }`}
                >
                  <p className="text-sm font-semibold text-amber-900">Not paid yet</p>
                  <p className="text-2xl font-extrabold text-amber-950">₹{report.unpaid_amount}</p>
                </div>
              </div>
              {!isToday && report.unpaid_amount > 0 && (
                <p className="rounded-xl bg-amber-100 p-3 text-sm text-amber-900">
                  Some orders on this day were never marked as paid. Check that the money was
                  collected.
                </p>
              )}

              {/* Order types */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-2xl bg-white p-3 shadow-sm">
                  <p className="text-2xl font-extrabold text-amber-950">{report.dine_in_orders}</p>
                  <p className="text-xs font-semibold text-amber-800">Eat here</p>
                </div>
                <div className="rounded-2xl bg-white p-3 shadow-sm">
                  <p className="text-2xl font-extrabold text-amber-950">{report.parcel_orders}</p>
                  <p className="text-xs font-semibold text-amber-800">Parcel</p>
                </div>
                <div className="rounded-2xl bg-white p-3 shadow-sm">
                  <p className="text-2xl font-extrabold text-red-700">{report.cancelled_orders}</p>
                  <p className="text-xs font-semibold text-amber-800">Cancelled</p>
                </div>
              </div>

              {/* Branches */}
              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <p className="font-bold text-amber-950">Branches</p>
                <div className="mt-2 space-y-3">
                  {report.branches.map((b) => (
                    <div key={b.branch_id}>
                      <div className="flex justify-between text-sm text-amber-950">
                        <span className="font-semibold">{b.branch_name}</span>
                        <span>
                          ₹{b.sales} · {b.orders} {b.orders === 1 ? 'order' : 'orders'}
                        </span>
                      </div>
                      <Bar value={b.sales} max={topSales} color="bg-orange-500" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Best sellers */}
              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <p className="font-bold text-amber-950">Best sellers</p>
                {report.top_items.length === 0 ? (
                  <p className="mt-2 text-sm text-amber-800">Nothing sold yet.</p>
                ) : (
                  <ol className="mt-2 space-y-3">
                    {report.top_items.map((t, i) => (
                      <li key={t.item_name}>
                        <div className="flex justify-between gap-2 text-sm text-amber-950">
                          <span className="font-semibold">
                            {i + 1}. {t.item_name}
                          </span>
                          <span className="shrink-0">
                            {t.quantity} sold · ₹{t.sales}
                          </span>
                        </div>
                        <Bar value={t.quantity} max={topQuantity} color="bg-green-600" />
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              <p className="text-center text-xs text-amber-800">
                Cancelled orders are not counted in the sales.
                {isToday && ' Today’s report updates by itself every 30 seconds.'}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}