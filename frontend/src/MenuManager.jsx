import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from './AuthContext'
import {
  createItem,
  getAdminMenu,
  getBranches,
  getMe,
  setAvailability,
  setPrice,
  updateItem,
} from './api'

function errorMessage(err) {
  const detail = err.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) return 'Please check the details you entered.'
  return 'That did not work. Please try again.'
}

/* ---------- The "add a new item" form (owner only) ---------- */

function AddItemForm({ categories, onCreated, onCancel }) {
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [variants, setVariants] = useState([{ label: 'Regular', price: '' }])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const setVariant = (index, field, value) =>
    setVariants((current) =>
      current.map((v, i) => (i === index ? { ...v, [field]: value } : v)),
    )

  const submit = async (e) => {
    e.preventDefault()
    setError('')

    if (name.trim().length < 2) {
      setError('Please enter the item name.')
      return
    }
    const cleaned = variants.map((v) => ({ label: v.label.trim(), price: Number(v.price) }))
    if (cleaned.some((v) => !v.label)) {
      setError('Every size needs a name, for example Regular, Personal or Sharing.')
      return
    }
    if (cleaned.some((v) => !Number.isInteger(v.price) || v.price < 1 || v.price > 5000)) {
      setError('Every price must be a whole number from 1 to 5000.')
      return
    }

    setSaving(true)
    try {
      await createItem({
        category_id: Number(categoryId),
        name: name.trim(),
        description: description.trim() || null,
        variants: cleaned,
      })
      onCreated()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const inputStyle =
    'w-full rounded-xl border-2 border-amber-200 bg-white px-3 py-2 text-amber-950 outline-none focus:border-orange-500'

  return (
    <form onSubmit={submit} className="mt-3 space-y-3 rounded-2xl bg-white p-4 shadow-sm">
      <p className="text-lg font-bold text-amber-950">Add a new item</p>

      <div>
        <label className="text-sm font-semibold text-amber-950">Category</label>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className={`mt-1 ${inputStyle}`}
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-sm font-semibold text-amber-950">Item name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          placeholder="For example: Caramel Pop"
          className={`mt-1 ${inputStyle}`}
        />
      </div>

      <div>
        <label className="text-sm font-semibold text-amber-950">Description (optional)</label>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={255}
          className={`mt-1 ${inputStyle}`}
        />
      </div>

      <div>
        <label className="text-sm font-semibold text-amber-950">Sizes and prices</label>
        <p className="text-xs text-amber-800">
          For an item with one price, keep the size name "Regular".
        </p>
        <div className="mt-1 space-y-2">
          {variants.map((v, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={v.label}
                onChange={(e) => setVariant(i, 'label', e.target.value)}
                maxLength={50}
                placeholder="Size name"
                className={inputStyle}
              />
              <input
                value={v.price}
                onChange={(e) =>
                  setVariant(i, 'price', e.target.value.replace(/\D/g, '').slice(0, 4))
                }
                inputMode="numeric"
                placeholder="₹ price"
                className={`${inputStyle} max-w-28`}
              />
              {variants.length > 1 && (
                <button
                  type="button"
                  onClick={() => setVariants((cur) => cur.filter((_, idx) => idx !== i))}
                  className="rounded-xl bg-red-50 px-3 font-bold text-red-700"
                  aria-label="Remove this size"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
        {variants.length < 4 && (
          <button
            type="button"
            onClick={() => setVariants((cur) => [...cur, { label: '', price: '' }])}
            className="mt-2 text-sm font-bold text-orange-700 underline"
          >
            + Add another size
          </button>
        )}
      </div>

      {error && (
        <p className="rounded-xl bg-red-100 p-3 text-sm font-semibold text-red-800">{error}</p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl bg-amber-100 py-3 font-bold text-amber-900"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-orange-500 py-3 font-bold text-white hover:bg-orange-600 disabled:opacity-60"
        >
          {saving ? 'Saving...' : 'Add item'}
        </button>
      </div>
    </form>
  )
}

/* ---------- The Menu screen ---------- */

export default function MenuManager() {
  const { auth } = useAuth()
  const isOwner = auth.role === 'owner'

  const [items, setItems] = useState([])
  const [branches, setBranches] = useState([])
  const [me, setMe] = useState(null)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [busyKey, setBusyKey] = useState(null)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null) // { variantId, value }
  const [showAdd, setShowAdd] = useState(false)

  const load = useCallback(async () => {
    try {
      const [menuData, branchData, meData] = await Promise.all([
        getAdminMenu(),
        getBranches(),
        getMe(),
      ])
      setItems(menuData)
      setBranches(branchData)
      setMe(meData)
      setError('')
      setLoaded(true)
    } catch (err) {
      if (err.response?.status !== 401) setError('Could not load the menu. Please try again.')
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Staff tied to one branch can only change that branch
  const visibleBranches = branches.filter(
    (b) => !me || me.branch_id == null || b.id === me.branch_id,
  )

  const categories = useMemo(() => {
    const seen = new Map()
    items.forEach((i) => seen.set(i.category_id, i.category_name))
    return [...seen].map(([id, name]) => ({ id, name }))
  }, [items])

  const groups = useMemo(() => {
    const term = search.trim().toLowerCase()
    const map = new Map()
    for (const item of items) {
      if (term && !item.name.toLowerCase().includes(term)) continue
      if (!map.has(item.category_id)) {
        map.set(item.category_id, { id: item.category_id, name: item.category_name, items: [] })
      }
      map.get(item.category_id).items.push(item)
    }
    return [...map.values()]
  }, [items, search])

  const replaceItem = (updated) =>
    setItems((current) => current.map((i) => (i.id === updated.id ? updated : i)))

  const run = async (key, action) => {
    setBusyKey(key)
    setActionError('')
    try {
      await action()
    } catch (err) {
      if (err.response?.status !== 401) setActionError(errorMessage(err))
    } finally {
      setBusyKey(null)
    }
  }

  const isAvailable = (item, branchId) =>
    item.availability.find((a) => a.branch_id === branchId)?.is_available ?? true

  const toggleAvailability = (item, branch) =>
    run(`a-${item.id}-${branch.id}`, async () => {
      const result = await setAvailability(branch.id, item.id, !isAvailable(item, branch.id))
      replaceItem({
        ...item,
        availability: item.availability.map((a) =>
          a.branch_id === result.branch_id ? { ...a, is_available: result.is_available } : a,
        ),
      })
    })

  const savePrice = (item, variant) => {
    const price = Number(editing.value)
    if (!Number.isInteger(price) || price < 1 || price > 5000) {
      setActionError('The price must be a whole number from 1 to 5000.')
      return
    }
    run(`p-${variant.id}`, async () => {
      const result = await setPrice(variant.id, price)
      replaceItem({
        ...item,
        variants: item.variants.map((v) => (v.id === result.id ? { ...v, price: result.price } : v)),
      })
      setEditing(null)
    })
  }

  const toggleActive = (item) => {
    if (
      item.is_active &&
      !window.confirm(`Hide "${item.name}" from customers? You can show it again later.`)
    ) {
      return
    }
    run(`h-${item.id}`, async () => {
      replaceItem(await updateItem(item.id, { is_active: !item.is_active }))
    })
  }

  const inputStyle =
    'rounded-xl border-2 border-amber-200 bg-white px-3 py-2 text-amber-950 outline-none focus:border-orange-500'

  return (
    <div>
      <p className="rounded-xl bg-amber-100 p-3 text-sm text-amber-900">
        {isOwner
          ? 'Tap a branch button to mark an item sold out or available. Tap a price to change it. A new price applies to new orders only.'
          : 'Tap a branch button to mark an item sold out or available. Only the owner can change prices or the menu.'}
      </p>

      <div className="mt-3 flex gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search items..."
          className={`${inputStyle} w-full`}
        />
        {isOwner && !showAdd && (
          <button
            onClick={() => setShowAdd(true)}
            className="whitespace-nowrap rounded-xl bg-orange-500 px-4 font-bold text-white hover:bg-orange-600"
          >
            + Add item
          </button>
        )}
      </div>

      {isOwner && showAdd && (
        <AddItemForm
          categories={categories}
          onCancel={() => setShowAdd(false)}
          onCreated={() => {
            setShowAdd(false)
            load()
          }}
        />
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

      {!loaded && !error && <p className="mt-6 text-center text-amber-900">Loading menu...</p>}

      {loaded && groups.length === 0 && (
        <p className="mt-6 text-center text-amber-900">No items match your search.</p>
      )}

      {groups.map((group) => (
        <section key={group.id} className="mt-5">
          <h2 className="text-lg font-bold text-amber-950">{group.name}</h2>
          <div className="mt-2 grid gap-3 md:grid-cols-2">
            {group.items.map((item) => (
              <div
                key={item.id}
                className={`rounded-2xl bg-white p-4 shadow-sm ${item.is_active ? '' : 'opacity-60'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-bold leading-tight text-amber-950">{item.name}</p>
                  {!item.is_active && (
                    <span className="shrink-0 rounded bg-gray-200 px-2 py-0.5 text-xs font-bold text-gray-700">
                      Hidden
                    </span>
                  )}
                </div>

                {/* Prices */}
                <div className="mt-2 space-y-2">
                  {item.variants.map((v) =>
                    editing?.variantId === v.id ? (
                      <div key={v.id} className="flex items-center gap-2">
                        <span className="w-20 text-sm text-amber-900">{v.label}</span>
                        <span className="font-bold">₹</span>
                        <input
                          autoFocus
                          value={editing.value}
                          onChange={(e) =>
                            setEditing({
                              variantId: v.id,
                              value: e.target.value.replace(/\D/g, '').slice(0, 4),
                            })
                          }
                          inputMode="numeric"
                          className={`${inputStyle} w-24`}
                        />
                        <button
                          disabled={busyKey === `p-${v.id}`}
                          onClick={() => savePrice(item, v)}
                          className="rounded-xl bg-green-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-60"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditing(null)}
                          className="rounded-xl bg-amber-100 px-3 py-2 text-sm font-bold text-amber-900"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div key={v.id} className="flex items-center justify-between">
                        <span className="text-sm text-amber-900">{v.label}</span>
                        {isOwner ? (
                          <button
                            onClick={() => {
                              setActionError('')
                              setEditing({ variantId: v.id, value: String(v.price) })
                            }}
                            className="rounded-full bg-orange-100 px-3 py-1 font-bold text-orange-800 hover:bg-orange-200"
                            title="Tap to change the price"
                          >
                            ₹{v.price} ✎
                          </button>
                        ) : (
                          <span className="rounded-full bg-orange-100 px-3 py-1 font-bold text-orange-800">
                            ₹{v.price}
                          </span>
                        )}
                      </div>
                    ),
                  )}
                </div>

                {/* Sold out switches */}
                <div className="mt-3 grid gap-2 border-t pt-3">
                  {visibleBranches.map((b) => {
                    const available = isAvailable(item, b.id)
                    return (
                      <button
                        key={b.id}
                        disabled={busyKey === `a-${item.id}-${b.id}`}
                        onClick={() => toggleAvailability(item, b)}
                        className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm font-bold disabled:opacity-60 ${
                          available
                            ? 'bg-green-100 text-green-800 hover:bg-green-200'
                            : 'bg-red-100 text-red-700 hover:bg-red-200'
                        }`}
                      >
                        <span>{b.name}</span>
                        <span>{available ? '✓ Available' : '✕ Sold out'}</span>
                      </button>
                    )
                  })}
                </div>

                {isOwner && (
                  <button
                    disabled={busyKey === `h-${item.id}`}
                    onClick={() => toggleActive(item)}
                    className="mt-3 text-sm font-semibold text-amber-800 underline disabled:opacity-60"
                  >
                    {item.is_active ? 'Hide from customers' : 'Show to customers again'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}