import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ShoppingCart, Search, User, ChevronDown, Package, LogOut } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';

const CATEGORIES = [
  { name: 'Writing',   emoji: '✏️', slug: 'Writing Instruments' },
  { name: 'Notebooks', emoji: '📒', slug: 'Notebooks & Diaries' },
  { name: 'Art',       emoji: '🎨', slug: 'Art & Craft' },
  { name: 'Office',    emoji: '📎', slug: 'Office Supplies' },
  { name: 'Paper',     emoji: '📄', slug: 'Paper Products' },
  { name: 'Geometry',  emoji: '📐', slug: 'Geometry & Math' },
  { name: 'Files',     emoji: '📁', slug: 'Files & Folders' },
  { name: 'Bags',      emoji: '🎒', slug: 'Bags & Pouches' },
];

export default function Navbar() {
  const { totalItems } = useCart();
  const { user, logout, isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [search, setSearch] = useState(() => new URLSearchParams(location.search).get('search') ?? '');
  const [userDrop, setUserDrop] = useState(false);

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (search.trim()) navigate(`/products?search=${encodeURIComponent(search.trim())}`);
  };

  // Keep input in sync with URL (e.g. navigating back/forward or to home clears it)
  useEffect(() => {
    const urlSearch = new URLSearchParams(location.search).get('search') ?? '';
    setSearch(urlSearch);
  }, [location.search]);

  // Auto-search after 400ms debounce when 3+ chars typed
  useEffect(() => {
    if (search.trim().length < 3) return;
    const t = setTimeout(() => {
      navigate(`/products?search=${encodeURIComponent(search.trim())}`);
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  return (
    <header className="sticky top-0 z-50 bg-white" style={{ boxShadow: '0 1px 0 #E8E8E8, 0 2px 8px rgba(0,0,0,0.06)' }}>

      {/* ── Main bar ── */}
      <div className="px-4 md:px-6 lg:px-8 flex items-center gap-3 md:gap-4" style={{ height: 64 }}>

        {/* Logo */}
        <Link to="/" className="flex-shrink-0 flex flex-col items-start justify-center pt-2 hover:opacity-90 transition-opacity" style={{ width: 'max-content' }}>
          <div className="flex items-center justify-start -mb-2 -ml-2">
            <img src="/ppw-logo.png" alt="PPW Store" className="h-[48px] md:h-[54px] w-auto object-contain scale-[1.2] origin-bottom-left" />
          </div>
          <span className="text-[11px] font-extrabold tracking-widest uppercase mt-0" style={{ color: '#b8804a' }}>Purbanchal Papers & Works</span>
        </Link>



        {/* Search — desktop */}
        <form onSubmit={handleSearch} className="flex-1 hidden md:flex">
          <div className="flex items-center w-full rounded-lg overflow-hidden" style={{ background: '#F2F2F2', border: '1.5px solid #E8E8E8' }}>
            <Search size={16} className="ml-3.5 flex-shrink-0" style={{ color: '#9E9E9E' }} />
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search for pens, notebooks, art supplies…"
              className="flex-1 px-3 py-2.5 text-sm bg-transparent outline-none text-gray-800 placeholder:text-gray-400 font-medium"
            />
            <button type="submit" className="px-4 h-full text-sm font-bold flex-shrink-0 transition-colors"
              style={{ background: '#0C831F', color: 'white', minHeight: 40 }}>
              Search
            </button>
          </div>
        </form>

        {/* Right actions */}
        <div className="flex items-center gap-1.5 md:gap-2 ml-auto md:ml-0 flex-shrink-0">

          {/* Login / User */}
          {isLoggedIn ? (
            <div className="relative">
              <button onClick={() => setUserDrop(!userDrop)}
                className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg hover:bg-gray-50 transition-colors">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                  style={{ background: '#0C831F' }}>
                  {user?.name?.[0]?.toUpperCase()}
                </div>
                <span className="hidden md:inline text-sm font-semibold text-gray-800 max-w-[80px] truncate">
                  {user?.name?.split(' ')[0]}
                </span>
                <ChevronDown size={12} className="text-gray-400 hidden md:block" />
              </button>

              {userDrop && (
                <div className="absolute right-0 top-12 w-48 bg-white rounded-xl shadow-xl py-1 z-50 animate-fade-in"
                  style={{ border: '1px solid #E8E8E8' }}>
                  <Link to="/profile" onClick={() => setUserDrop(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                    <User size={15} style={{ color: '#0C831F' }} /> My Profile
                  </Link>
                  <Link to="/orders" onClick={() => setUserDrop(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                    <Package size={15} style={{ color: '#0C831F' }} /> My Orders
                  </Link>
                  <div className="my-1 border-t border-gray-100" />
                  <button onClick={() => { logout(); setUserDrop(false); navigate('/'); }}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-red-500 hover:bg-red-50 w-full text-left">
                    <LogOut size={15} /> Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link to="/login"
              className="px-4 py-2 rounded-lg text-sm font-bold transition-all hover:opacity-90 flex-shrink-0"
              style={{ background: '#F8C420', color: '#1C1C1C' }}>
              Login
            </Link>
          )}

          {/* Cart */}
          <Link to="/cart"
            className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg hover:bg-gray-50 transition-colors">
            <span className="relative">
              <ShoppingCart size={22} style={{ color: '#1C1C1C' }} />
              {totalItems > 0 && (
                <span className="absolute -top-2 -right-2 w-4.5 h-4.5 rounded-full flex items-center justify-center text-[10px] font-extrabold text-white"
                  style={{ background: '#0C831F', width: 18, height: 18, lineHeight: 1 }}>
                  {totalItems > 9 ? '9+' : totalItems}
                </span>
              )}
            </span>
            <span className="hidden md:inline text-sm font-semibold text-gray-800">Cart</span>
          </Link>
        </div>
      </div>

      {/* ── Mobile: search ── */}
      <div className="md:hidden px-4 pb-2.5 flex flex-col gap-2">
        <form onSubmit={handleSearch}>
          <div className="flex items-center rounded-lg overflow-hidden" style={{ background: '#F2F2F2', border: '1.5px solid #E8E8E8' }}>
            <Search size={14} className="ml-3 flex-shrink-0" style={{ color: '#9E9E9E' }} />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search stationery, notebooks, pens…"
              className="flex-1 px-3 py-2.5 text-sm bg-transparent outline-none placeholder:text-gray-400 text-gray-800" />
          </div>
        </form>
      </div>

      {/* ── Category strip — desktop only ── */}
      <div className="hidden md:block" style={{ borderTop: '1px solid #F2F2F2' }}>
        <div className="flex items-center gap-0.5 px-6 lg:px-8 overflow-x-auto scrollbar-hide" style={{ height: 40 }}>
          {CATEGORIES.map(cat => (
            <Link key={cat.slug} to={`/products?category=${encodeURIComponent(cat.slug)}`}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all text-gray-600 hover:text-gray-900 hover:bg-gray-100">
              <span>{cat.emoji}</span> {cat.name}
            </Link>
          ))}
        </div>
      </div>
    </header>
  );
}
