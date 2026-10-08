import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import { CartProvider } from './lib/cart.jsx'
import { SettingsProvider } from './lib/settings.jsx'
import { Loading } from './components/ui.jsx'
import Home from './pages/Home.jsx'
import ShopAll from './pages/ShopAll.jsx'
import { CollectionsIndex, CollectionPage } from './pages/Collections.jsx'
import Product from './pages/Product.jsx'
import Cart from './pages/Cart.jsx'
import Checkout from './pages/Checkout.jsx'
import OrderPlaced from './pages/OrderPlaced.jsx'
import Custom from './pages/Custom.jsx'
import PrivateOrder from './pages/PrivateOrder.jsx'
import { Pricing, Contact, Track, NotFound } from './pages/Info.jsx'

const AdminApp = lazy(() => import('./admin/AdminApp.jsx'))

export default function App() {
  return (
    <SettingsProvider>
      <CartProvider>
        <Routes>
          <Route path="/admin/*" element={<Suspense fallback={<Loading />}><AdminApp /></Suspense>} />
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="shop" element={<ShopAll />} />
            <Route path="collections" element={<CollectionsIndex />} />
            <Route path="collections/:slug" element={<CollectionPage />} />
            <Route path="product/:slug" element={<Product />} />
            <Route path="cart" element={<Cart />} />
            <Route path="checkout" element={<Checkout />} />
            <Route path="order/:orderNumber" element={<OrderPlaced />} />
            <Route path="custom" element={<Custom />} />
            <Route path="custom-order/:token" element={<PrivateOrder />} />
            <Route path="pricing" element={<Pricing />} />
            <Route path="track" element={<Track />} />
            <Route path="contact" element={<Contact />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </CartProvider>
    </SettingsProvider>
  )
}
