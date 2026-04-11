import { useNavigate, Link } from 'react-router-dom';
import { User, Package, MapPin, LogOut, ChevronRight, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useOrders } from '../context/OrderContext';

const NAV_ITEMS = [
  { label: 'My Profile',   icon: <User size={16} />,    path: '/profile/edit' },
  { label: 'My Orders',    icon: <Package size={16} />, path: '/orders' },
  { label: 'My Addresses', icon: <MapPin size={16} />,  path: '/addresses' },
];

export default function Profile() {
  const { user, logout, isLoggedIn } = useAuth();
  const { getOrderCount, getDeliveredCount } = useOrders();
  const navigate = useNavigate();

  if (!isLoggedIn) {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center">
        <div className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl mx-auto mb-5"
          style={{ background: 'linear-gradient(145deg, rgba(193,136,91,0.12), rgba(141,88,56,0.08))', border: '1.5px solid rgba(193,136,91,0.2)' }}>
          🔐
        </div>
        <h2 className="text-xl font-bold mb-2" style={{ color: '#292524' }}>Sign in to view your profile</h2>
        <p className="text-sm mb-6" style={{ color: '#78716c' }}>Access your orders, saved addresses, and account details.</p>
        <button onClick={() => navigate('/login')}
          className="inline-flex justify-center items-center px-8 py-3 rounded-2xl text-sm font-bold transition-all hover:opacity-90 mt-2"
          style={{ background: 'linear-gradient(145deg, #c1885b, #a96f46)', color: 'white', boxShadow: '0 6px 20px rgba(169,111,70,0.5)' }}>
          Sign In
        </button>
      </div>
    );
  }

  const initial = user?.name?.[0]?.toUpperCase() ?? 'U';

  return (
    <div className="max-w-md mx-auto px-4 py-6 pb-20">
      <h1 className="text-xl font-bold mb-5" style={{ color: '#292524' }}>My Account</h1>

      {/* User badge */}
      <div className="rounded-2xl p-5 mb-4 flex items-center gap-3"
        style={{ background: 'linear-gradient(135deg, #292524, #3d2f29)', boxShadow: '0 4px 20px rgba(41,37,36,0.2)' }}>
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold flex-shrink-0"
          style={{ background: 'linear-gradient(145deg, #c1885b, #8d5838)', color: 'white', boxShadow: '0 4px 12px rgba(169,111,70,0.4)' }}>
          {initial}
        </div>
        <div className="overflow-hidden flex-1 min-w-0">
          <p className="font-bold text-white text-base truncate">{user?.name}</p>
          <p className="text-xs truncate font-medium" style={{ color: '#c1885b' }}>{user?.shopName}</p>
          <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.5)' }}>{user?.email}</p>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { emoji: '📦', label: 'Total Orders',  value: String(getOrderCount()),   path: '/orders' },
          { emoji: '✅', label: 'Delivered',      value: String(getDeliveredCount()), path: '/orders' },
          { emoji: '⭐', label: 'Reviews Given',  value: '0',                       path: '/orders' },
        ].map(s => (
          <button key={s.label} onClick={() => navigate(s.path)}
            className="rounded-2xl p-4 text-center transition-transform active:scale-95"
            style={{ background: 'white', border: '1.5px solid rgba(193,136,91,0.12)' }}>
            <span className="text-2xl">{s.emoji}</span>
            <p className="text-xl font-bold mt-1" style={{ color: '#292524' }}>{s.value}</p>
            <p className="text-xs mt-0.5" style={{ color: '#78716c' }}>{s.label}</p>
          </button>
        ))}
      </div>

      {/* Nav links */}
      <div className="rounded-2xl overflow-hidden mb-4" style={{ background: 'white', border: '1.5px solid rgba(193,136,91,0.12)' }}>
        {NAV_ITEMS.map((item, i) => (
          <Link key={item.path} to={item.path}
            className={`flex items-center justify-between px-4 py-4 transition-colors hover:bg-amber-50 ${i < NAV_ITEMS.length - 1 ? 'border-b' : ''}`}
            style={{ borderColor: 'rgba(193,136,91,0.1)' }}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(193,136,91,0.08)' }}>
                <span style={{ color: '#c1885b' }}>{item.icon}</span>
              </div>
              <span className="text-sm font-semibold" style={{ color: '#292524' }}>{item.label}</span>
            </div>
            <ChevronRight size={16} style={{ color: '#a8a29e' }} />
          </Link>
        ))}
        <button onClick={() => { logout(); navigate('/'); }}
          className="flex items-center gap-3 w-full px-4 py-4 text-left transition-colors hover:bg-red-50">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(220,38,38,0.06)' }}>
            <LogOut size={16} style={{ color: '#dc2626' }} />
          </div>
          <span className="text-sm font-semibold" style={{ color: '#dc2626' }}>Sign Out</span>
        </button>
      </div>

      {/* Security notice */}
      <div className="rounded-2xl p-4 flex items-start gap-3"
        style={{ background: 'rgba(193,136,91,0.06)', border: '1.5px solid rgba(193,136,91,0.18)' }}>
        <Shield size={18} style={{ color: '#c1885b', flexShrink: 0, marginTop: 1 }} />
        <div>
          <p className="text-sm font-semibold" style={{ color: '#292524' }}>Account Security</p>
          <p className="text-xs mt-0.5" style={{ color: '#78716c' }}>
            Your account is protected. To change your password, use the Forgot Password option on the login page.
          </p>
        </div>
      </div>
    </div>
  );
}
