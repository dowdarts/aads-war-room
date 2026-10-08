import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase.js'

const SettingsContext = createContext({ settings: {}, loaded: false })

export function SettingsProvider({ children }) {
  const [state, setState] = useState({ settings: {}, loaded: false })
  useEffect(() => {
    supabase.from('shop_settings').select('key, value').eq('is_public', true).then(({ data }) => {
      setState({ settings: Object.fromEntries((data || []).map(r => [r.key, r.value])), loaded: true })
    })
  }, [])
  return <SettingsContext.Provider value={state}>{children}</SettingsContext.Provider>
}

export const useSettings = () => useContext(SettingsContext)

/** Settings shape expected by pricing.js */
export function pricingSettings(s) {
  return {
    shippingCents: Number.isInteger(s.shipping_cents) ? s.shipping_cents : null,
    freeShippingMinQty: Number.isInteger(s.free_shipping_min_qty) ? s.free_shipping_min_qty : 3,
    customShippingCents: Number.isInteger(s.custom_shipping_cents) ? s.custom_shipping_cents : 0,
    taxRatePercent: Number(s.tax_rate_percent) || 0,
  }
}
