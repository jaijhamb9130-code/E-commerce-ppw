import { BrowserRouter, Routes, Route, Outlet, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { OrderProvider } from './context/OrderContext';
import Navbar from './components/Navbar';
import ScrollToTop from './components/ScrollToTop';
import Footer from './components/Footer';
import Home from './pages/Home';
import Products from './pages/Products';
import ProductDetail from './pages/ProductDetail';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import Orders from './pages/Orders';
import Login from './pages/Login';
import Profile from './pages/Profile';
import ProfileEdit from './pages/ProfileEdit';
import Addresses from './pages/Addresses';

function MainLayout() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main>
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

function ProtectedRoute() {
  const { isLoggedIn, loading } = useAuth();
  if (loading) return null;
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  return <MainLayout />;
}

function GuestRoute({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, loading } = useAuth();
  if (loading) return null;
  if (isLoggedIn) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <OrderProvider>
          <ScrollToTop />
          <Routes>
            {/* Protected: requires login */}
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<Home />} />
              <Route path="/products" element={<Products />} />
              <Route path="/products/:id" element={<ProductDetail />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/profile/edit" element={<ProfileEdit />} />
              <Route path="/addresses" element={<Addresses />} />
            </Route>

            {/* Guest only: redirects to home if already logged in */}
            <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
          </Routes>
          </OrderProvider>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
