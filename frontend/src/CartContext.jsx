import { createContext, useContext, useState } from 'react'

const CartContext = createContext(null)

export function CartProvider({ children }) {
  const [lines, setLines] = useState([])

  const addLine = (line) =>
    setLines((current) => {
      const existing = current.find((l) => l.variantId === line.variantId)
      if (existing) {
        return current.map((l) =>
          l.variantId === line.variantId ? { ...l, quantity: Math.min(l.quantity + 1, 20) } : l,
        )
      }
      return [...current, { ...line, quantity: 1 }]
    })

  const changeQuantity = (variantId, change) =>
    setLines((current) =>
      current
        .map((l) =>
          l.variantId === variantId ? { ...l, quantity: Math.min(l.quantity + change, 20) } : l,
        )
        .filter((l) => l.quantity > 0),
    )

  const clearCart = () => setLines([])

  const itemCount = lines.reduce((sum, l) => sum + l.quantity, 0)
  const subtotal = lines.reduce((sum, l) => sum + l.quantity * l.price, 0)

  return (
    <CartContext.Provider
      value={{ lines, addLine, changeQuantity, clearCart, itemCount, subtotal }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const context = useContext(CartContext)
  if (!context) throw new Error('useCart must be used inside CartProvider')
  return context
}