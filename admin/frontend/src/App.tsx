import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';

import Dashboard from './pages/Dashboard';
import OrderReport from './pages/OrderReport';
import OrderDetail from './pages/OrderDetail';
import Login from './pages/Login';
import AdminProfile from './pages/AdminProfile';
import OnlineOrder from './pages/OnlineOrder';
import Customers from './pages/Customers';
import { Users, LayoutGrid, ClipboardList, UserCheck, ShoppingBag } from 'lucide-react';
import { getUser } from './api';
import { ConfirmModal } from './components/ConfirmModal';
import { InstallPWA } from './components/InstallPWA';

const copper = '#b8804a';
const cream = '#f7f0e8';

// Returns the first route this user has access to (to avoid redirect loops)
function getDefaultRoute(user: any): string {
  if (!user) return '/login';
  if (user.role === 'admin') return '/';
  const perms: string[] = Array.isArray(user.permissions) ? user.permissions : [];
  if (perms.includes('dashboard')) return '/';
  if (perms.includes('orders')) return '/online-orders';
  if (perms.includes('reports')) return '/orders';
  if (perms.includes('inventory')) return '/';
  if (perms.includes('staff')) return '/profile';
  return '/login'; // No permissions at all — force logout
}

function AuthGuard({ children, permission }: { children: React.ReactElement, permission?: string }) {
  const userStr = localStorage.getItem('user');
  if (!userStr) return <Navigate to="/login" replace />;
  
  const user = JSON.parse(userStr);
  if (permission && user.role !== 'admin') {
    const perms: string[] = Array.isArray(user.permissions) ? user.permissions : [];
    if (!perms.includes(permission)) {
      // Redirect to their first permitted page — NOT always '/'
      return <Navigate to={getDefaultRoute(user)} replace />;
    }
  }
  
  return children;
}

function NavLink({ to, icon: Icon, label }: { to: string; icon: React.ElementType; label: string }) {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link
      to={to}
      style={{ color: isActive ? copper : '#a8a29e' }}
      className="relative flex flex-col items-center justify-center gap-1 py-2 transition-all duration-200"
    >
      <div className="relative flex items-center justify-center">
        <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
        {isActive && (
          <span
            className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
            style={{ background: copper }}
          />
        )}
      </div>
      <span className="text-[10px] font-bold tracking-wide leading-none">{label}</span>
    </Link>
  );
}

function Layout() {
  const location = useLocation();
  const [showNapModal, setShowNapModal] = React.useState(false);

  const forceLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    window.location.href = '/admin/login';
  };

  React.useEffect(() => {
    const checkTime = () => {
      const now = new Date();
      const hrs = now.getHours();
      const mins = now.getMinutes();
      const totalMins = hrs * 60 + mins;
      const isNapTime = totalMins >= 1425 || totalMins <= 300;
      if (isNapTime) {
        const userStr = localStorage.getItem('user');
        if (userStr && window.location.pathname !== '/admin/login') {
          const userData = JSON.parse(userStr);
          if (userData.role === 'admin') return;
          if (hrs === 23 && mins === 45) {
            if (!showNapModal) setShowNapModal(true);
          } else {
            forceLogout();
          }
        }
      }
    };
    const interval = setInterval(checkTime, 30000);
    checkTime();
    return () => clearInterval(interval);
  }, [location, showNapModal]);

  const hideNav = location.pathname === '/login' || location.pathname === '/online-orders';
  const user = getUser();
  const isAdmin = user?.role === 'admin';
  const perms = Array.isArray(user?.permissions) ? user.permissions : [];
  const hasPerm = (p: string) => isAdmin || perms.includes(p);

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center"
      style={{
        background: cream,
        backgroundImage: `radial-gradient(circle at 20% 80%, rgba(184,128,74,0.06) 0%, transparent 50%),
                          radial-gradient(circle at 80% 20%, rgba(184,128,74,0.04) 0%, transparent 50%)`,
      }}
    >
      <div
        className="w-full max-w-md min-h-screen relative flex flex-col shadow-2xl"
        style={{
          background: cream,
          borderLeft: '1px solid rgba(184,128,74,0.12)',
          borderRight: '1px solid rgba(184,128,74,0.12)',
          boxShadow: '0 0 40px rgba(184,128,74,0.08)',
        }}
      >
        <main className={`relative z-10 w-full flex-1 ${!hideNav ? 'pb-12' : ''}`}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<AuthGuard permission="dashboard"><Dashboard /></AuthGuard>} />
            <Route path="/orders" element={<AuthGuard permission="reports"><OrderReport /></AuthGuard>} />
            <Route path="/orders/:id" element={<AuthGuard permission="reports"><OrderDetail /></AuthGuard>} />
            <Route path="/customers" element={<AuthGuard permission="orders"><Customers /></AuthGuard>} />
            <Route path="/profile" element={<AuthGuard permission="staff"><AdminProfile /></AuthGuard>} />
            <Route path="/online-orders" element={<AuthGuard permission="orders"><OnlineOrder /></AuthGuard>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        {!hideNav && (
          <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center">
            <nav
              className="w-full max-w-md backdrop-blur-xl"
              style={{
                background: 'rgba(253,248,243,0.96)',
                borderTop: '1px solid rgba(184,128,74,0.15)',
                boxShadow: '0 -4px 20px rgba(184,128,74,0.08)',
              }}
            >
              <div className="flex justify-around items-center h-16 px-2">
                {hasPerm('dashboard') && <NavLink to="/" icon={LayoutGrid} label="Home" />}
                {hasPerm('orders') && <NavLink to="/online-orders" icon={ShoppingBag} label="Orders" />}
                {hasPerm('reports') && <NavLink to="/orders" icon={ClipboardList} label="Reports" />}
                {hasPerm('orders') && <NavLink to="/customers" icon={UserCheck} label="Customers" />}
                {hasPerm('staff') && <NavLink to="/profile" icon={Users} label="Users" />}
              </div>
            </nav>
          </div>
        )}

        <ConfirmModal
          isOpen={showNapModal}
          onClose={() => setShowNapModal(false)}
          onConfirm={forceLogout}
          title="It's Nap Time!"
          message="The system is undergoing scheduled maintenance (Tally Sync). Please take a rest and log in tomorrow morning."
          confirmText="Logout Now"
          cancelText="Close"
        />

        <InstallPWA />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Router basename="/admin">
      <Layout />
    </Router>
  );
}
