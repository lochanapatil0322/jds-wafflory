import { useEffect, useState } from 'react'
import { getBranches, getMenu } from './api'
import { useCart } from './CartContext'
import CartPanel from './CartPanel'

// One photo per category for now. If an item has its own image_url later,
// that photo is used instead.
const CATEGORY_IMAGES = {
  'Waffle Pop': '/images/pop.jpg',
  'Waffle Chocolate Sandwich': '/images/sandwich.jpg',
  'Chocolate Cake Bowl': '/images/bowl.jpg',
  'Strawberry Chocolate Glass': '/images/glass.jpg',
}

function App() {
  const { addLine, lines, itemCount, subtotal, clearCart } = useCart()
  const [branches, setBranches] = useState([])
  const [branchId, setBranchId] = useState(null)
  const [menu, setMenu] = useState(null)
  const [activeCategory, setActiveCategory] = useState(null)
  const [cartOpen, setCartOpen] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getBranches()
      .then((data) => {
        setBranches(data)
        if (data.length > 0) setBranchId(data[0].id)
      })
      .catch(() => setError('Could not load the branches. Is the backend running?'))
  }, [])

  useEffect(() => {
    if (branchId === null) return
    let ignore = false

    getMenu(branchId)
      .then((data) => {
        if (ignore) return
        setMenu(data)
        setActiveCategory(data.categories[0]?.id ?? null)
        setError('')
      })
      .catch(() => {
        if (!ignore) setError('Could not load the menu.')
      })

    return () => {
      ignore = true
    }
  }, [branchId])

  const selectBranch = (id) => {
    if (id === branchId) return
    if (itemCount > 0 && !window.confirm('Changing the branch will empty your cart. Continue?')) {
      return
    }
    clearCart()
    setBranchId(id)
  }

  const category = menu?.categories.find((c) => c.id === activeCategory)
  const currentBranch = branches.find((b) => b.id === branchId)

  return (
    <div className="relative isolate min-h-screen">
      {/* Blurred photo background, fixed so it stays while you scroll */}
      <div className="fixed inset-0 -z-10">
        <img
          src="/images/background.jpg"
          alt=""
          className="h-full w-full scale-105 object-cover blur-md"
        />
        <div className="absolute inset-0 bg-amber-950/50" />
      </div>

      {/* Header */}
      <header className="px-4 pb-4 pt-8 text-center">
        <img
          src="/images/logo.jpg"
          alt="JD's Wafflory logo"
          className="mx-auto h-24 w-24 rounded-full border-4 border-orange-400 object-cover shadow-xl"
        />
        <h1 className="mt-3 text-3xl font-bold text-amber-50">JD's Wafflory</h1>
        <p className="mt-1 text-sm font-semibold tracking-widest text-orange-300">
          CRISP • WARM • PERFECT
        </p>
      </header>

      <main className={`mx-auto max-w-5xl px-4 ${itemCount > 0 ? 'pb-28' : 'pb-16'}`}>
        {error && (
          <p className="mt-4 rounded-xl bg-red-100/90 p-3 text-center text-red-800">{error}</p>
        )}

        {/* Branch picker */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          {branches.map((b) => (
            <button
              key={b.id}
              onClick={() => selectBranch(b.id)}
              className={`rounded-2xl border-2 p-3 text-left backdrop-blur-md transition ${
                b.id === branchId
                  ? 'border-orange-400 bg-white/85 shadow-lg'
                  : 'border-white/20 bg-white/20 hover:bg-white/30'
              }`}
            >
              <p className={`font-bold ${b.id === branchId ? 'text-amber-900' : 'text-amber-50'}`}>
                {b.name}
              </p>
              <p
                className={`text-sm font-semibold ${
                  b.is_open
                    ? b.id === branchId ? 'text-green-700' : 'text-green-300'
                    : b.id === branchId ? 'text-red-700' : 'text-red-300'
                }`}
              >
                {b.is_open ? 'Open now' : 'Closed'}
              </p>
            </button>
          ))}
        </div>

        {menu && !menu.is_open && (
          <p className="mt-4 rounded-2xl bg-amber-200/90 p-3 text-center font-semibold text-amber-900 backdrop-blur-md">
            This branch is closed right now. We are open from 6 PM to 12 AM. You can look at the
            menu, but ordering opens at 6 PM.
          </p>
        )}

        {/* Category tabs */}
        {menu && (
          <div className="mt-5 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {menu.categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveCategory(c.id)}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold backdrop-blur-md transition ${
                  c.id === activeCategory
                    ? 'bg-orange-500 text-white shadow-lg'
                    : 'bg-white/25 text-amber-50 hover:bg-white/35'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}

        {menu?.is_open && (
          <p className="mt-1 text-sm text-amber-100">Tap a price to add it to your cart.</p>
        )}

        {/* Items */}
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {category?.items.map((item) => {
            const photo = item.image_url || CATEGORY_IMAGES[category.name]
            const canOrder = menu.is_open && item.is_available
            return (
              <div
                key={item.id}
                className="flex gap-4 rounded-2xl bg-white/80 p-3 shadow-lg backdrop-blur-md"
              >
                <img
                  src={photo}
                  alt={item.name}
                  loading="lazy"
                  className={`h-24 w-24 shrink-0 rounded-xl object-cover ${
                    item.is_available ? '' : 'grayscale'
                  }`}
                />
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h2
                      className={`font-bold leading-tight text-amber-950 ${
                        item.is_available ? '' : 'opacity-60'
                      }`}
                    >
                      {item.name}
                    </h2>
                    {!item.is_available && (
                      <span className="shrink-0 rounded bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
                        Sold out
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {item.variants.map((v) => {
                      const inCart = lines.find((l) => l.variantId === v.id)
                      return (
                        <button
                          key={v.id}
                          disabled={!canOrder}
                          onClick={() =>
                            addLine({
                              variantId: v.id,
                              itemId: item.id,
                              name: item.name,
                              label: v.label,
                              price: v.price,
                            })
                          }
                          className={`rounded-full px-3 py-1 text-sm font-semibold transition ${
                            canOrder
                              ? 'bg-orange-500 text-white hover:bg-orange-600 active:scale-95'
                              : 'cursor-not-allowed bg-orange-100 text-orange-800/70'
                          }`}
                        >
                          {inCart && `${inCart.quantity} × `}
                          {v.label !== 'Regular' && `${v.label} `}₹{v.price}
                          {canOrder && ' +'}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {!menu && !error && <p className="mt-8 text-center text-amber-50">Loading menu...</p>}

        <p className="mt-8 text-center text-sm text-amber-100">Parcel charge: ₹10 extra per order</p>
      </main>

      {/* Cart bar at the bottom */}
      {itemCount > 0 && !cartOpen && (
        <div className="fixed inset-x-4 bottom-4 z-40 mx-auto max-w-md">
          <button
            onClick={() => setCartOpen(true)}
            className="flex w-full items-center justify-between rounded-2xl bg-orange-500 px-5 py-4 font-bold text-white shadow-2xl hover:bg-orange-600"
          >
            <span>
              View cart · {itemCount} {itemCount === 1 ? 'item' : 'items'}
            </span>
            <span>₹{subtotal}</span>
          </button>
        </div>
      )}

      {cartOpen && currentBranch && (
        <CartPanel branch={currentBranch} onClose={() => setCartOpen(false)} />
      )}
    </div>
  )
}

export default App