import { useState, useRef, useEffect } from 'react';
import { LogOut, Shield, ChevronDown } from 'lucide-react';
import { getUser } from '../api';

const copper = '#b8804a';

export function ProfileHeader() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const user = getUser();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    window.location.href = '/admin/login';
  };

  if (!user || !user.username) return null;

  const initial = (user.name || user.username || '?').charAt(0).toUpperCase();

  return (
    <div className="fixed top-3 right-4 z-50" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="flex items-center gap-2 p-1.5 rounded-full bg-white border border-stone-200 shadow-sm transition-all active:scale-95"
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold uppercase text-white"
          style={{ background: `linear-gradient(135deg, ${copper}, #9a6a3c)` }}
        >
          {initial}
        </div>
        <ChevronDown
          size={14}
          style={{ color: copper }}
          className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div
          className="absolute top-full right-0 mt-2 w-60 rounded-2xl overflow-hidden bg-white border border-stone-200 shadow-xl"
        >
          <div className="p-4 border-b border-stone-100">
            <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">
              Signed in as
            </p>
            <p className="text-sm font-bold text-stone-800 truncate">
              {user.name || user.username}
            </p>
            <div className="flex items-center gap-1.5 mt-2">
              <span
                className="inline-flex items-center gap-1 text-[9px] font-bold uppercase px-2 py-0.5 rounded-md"
                style={{ background: 'rgba(184,128,74,0.1)', color: copper }}
              >
                <Shield size={10} />
                {user.role || 'user'}
              </span>
            </div>
          </div>

          <div className="p-2">
            <div className="px-3 py-2 space-y-1">
              <p className="text-[9px] font-bold text-stone-400 uppercase tracking-tight">Username</p>
              <p className="text-[12px] font-semibold text-stone-700 break-all">{user.username}</p>
            </div>
            {user.number && (
              <div className="px-3 py-2 space-y-1">
                <p className="text-[9px] font-bold text-stone-400 uppercase tracking-tight">Phone</p>
                <p className="text-[12px] font-semibold text-stone-700">{user.number}</p>
              </div>
            )}

            <div className="mt-2 pt-2 border-t border-stone-100">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-500 hover:bg-red-50 transition-colors"
              >
                <LogOut size={16} />
                <span className="text-[12px] font-bold uppercase tracking-wider">Logout</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
