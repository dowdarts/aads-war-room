import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { retailLineKey } from '@pricing'

const KEY = 'cgc_shop_cart_v1'
const CartContext = createContext(null)

function read() {
  try { const v = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(v) ? v : [] } catch { return [] }
}
function write(lines) {
  try { localStorage.setItem(KEY, JSON.stringify(lines)) } catch { /* private mode: cart lives in memory only */ }
}

export function CartProvider({ children }) {
  const [lines, setLines] = useState(read)

  useEffect(() => { write(lines) }, [lines])
  // Keep tabs in sync.
  useEffect(() => {
    const onStorage = e => { if (e.key === KEY) setLines(read()) }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const add = useCallback(line => {
    const key = retailLineKey(line)
    setLines(prev => {
      const i = prev.findIndex(l => l.key === key)
      if (i >= 0) return prev.map((l, j) => j === i ? { ...l, qty: l.qty + line.qty } : l)
      return [...prev, { ...line, key }]
    })
  }, [])
  const setQty = useCallback((key, qty) => {
    setLines(prev => qty <= 0 ? prev.filter(l => l.key !== key) : prev.map(l => l.key === key ? { ...l, qty } : l))
  }, [])
  const remove = useCallback(key => setLines(prev => prev.filter(l => l.key !== key)), [])
  const clear = useCallback(() => setLines([]), [])

  const units = lines.reduce((s, l) => s + l.qty, 0)
  const value = useMemo(() => ({ lines, units, add, setQty, remove, clear }), [lines, units, add, setQty, remove, clear])
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export const useCart = () => useContext(CartContext)

/** Maps cart lines + catalogue into pricing.js retail lines. Unknown products are dropped. */
export function toPricingLines(lines, catalog) {
  return lines.map(l => {
    const p = catalog?.productById[l.productId]
    if (!p) return null
    return { key: l.key, qty: l.qty, priceClass: p.price_class, closure: l.closure, pocket: l.pocket, productId: p.id, collectionIds: p.collectionIds }
  }).filter(Boolean)
}
