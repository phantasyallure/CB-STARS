import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import Landing from './pages/Landing.jsx'
import ProductDetail from './pages/ProductDetail.jsx'
import AdminLogin from './pages/AdminLogin.jsx'
import AdminLayout, { AdminHome, Guard } from './pages/admin/AdminLayout.jsx'
import ProductsTab from './pages/admin/ProductsTab.jsx'
import OrdersTab from './pages/admin/OrdersTab.jsx'
import DeliveryTab from './pages/admin/DeliveryTab.jsx'
import StockTab from './pages/admin/StockTab.jsx'
import AnalyticsTab from './pages/admin/AnalyticsTab.jsx'
import ChatTab from './pages/admin/ChatTab.jsx'
import TeamTab from './pages/admin/TeamTab.jsx'
import SettingsTab from './pages/admin/SettingsTab.jsx'
import PixelTracker from './components/PixelTracker.jsx'
import { AuthProvider } from './context/AuthContext.jsx'

function AdminRoot() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  )
}

export default function App() {
  return (
    <>
      <PixelTracker />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/product/:id" element={<ProductDetail />} />

        <Route path="/admin" element={<AdminRoot />}>
          <Route index element={<AdminLogin />} />
          <Route element={<AdminLayout />}>
            <Route path="home" element={<AdminHome />} />
            <Route path="dashboard" element={<AdminHome />} />
            <Route path="products" element={<Guard perm="products"><ProductsTab /></Guard>} />
            <Route path="orders" element={<Guard perm="orders"><OrdersTab /></Guard>} />
            <Route path="delivery" element={<Guard perm="products"><DeliveryTab /></Guard>} />
            <Route path="stock" element={<Guard perm="stock"><StockTab /></Guard>} />
            <Route path="analytics" element={<Guard perm="analytics"><AnalyticsTab /></Guard>} />
            <Route path="messages" element={<Guard perm="chat"><ChatTab /></Guard>} />
            <Route path="team" element={<Guard perm="team"><TeamTab /></Guard>} />
            <Route path="settings" element={<Guard perm="settings"><SettingsTab /></Guard>} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
