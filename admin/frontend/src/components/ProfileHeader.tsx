
import React, { useState, useRef, useEffect } from 'react';
import { LogOut, User, Shield, ChevronDown } from 'lucide-react';
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

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pointer-events-none">
      <div className="w-full max-w-md h-16 flex items-center justify-between px-6 pointer-events-auto">
        <div className="flex items-center gap-2">
            {/* Logo or page title could go here if needed */}
        </div>

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-2 p-1.5 rounded-full transition-all active:scale-95"
            style={{ 
              background: 'rgba(255,255,255,0.8)', 
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(184,128,74,0.15)',
              boxShadow: '0 2px 10px rgba(184,128,74,0.05)'
            }}
          >
            <div 
              className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black uppercase"
              style={{ background: `linear-gradient(135deg, ${copper}, #9a6a3c)`, color: 'white' }}
            >
              {user.name?.charAt(0) || user.username?.charAt(0)}
            </div>
            <ChevronDown size={14} style={{ color: copper }} className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
          </button>

          {isOpen && (
            <div 
              className="absolute top-full right-0 mt-2 w-56 rounded-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
              style={{ 
                background: 'rgba(255,255,255,0.98)', 
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(184,128,74,0.18)',
                boxShadow: '0 10px 25px rgba(44,30,15,0.15)'
              }}
            >
              <div className="p-4 border-b border-stone-100">
                <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Signed in as</p>
                <p className="text-sm font-black text-stone-800 truncate">{user.name || user.username}</p>
                <div className="flex items-center gap-1.5 mt-2">
                  <span 
                    className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md flex items-center gap-1"
                    style={{ background: 'rgba(184,128,74,0.1)', color: copper }}
                  >
                    <Shield size={10} />
                    {user.role}
                  </span>
                </div>
              </div>

              <div className="p-2">
                <div className="px-3 py-2 space-y-1">
                  <p className="text-[9px] font-bold text-stone-400 uppercase tracking-tight">Username</p>
                  <p className="text-[11px] font-bold text-stone-700">{user.username}</p>
                </div>
                {user.number && (
                  <div className="px-3 py-2 space-y-1">
                    <p className="text-[9px] font-bold text-stone-400 uppercase tracking-tight">Phone</p>
                    <p className="text-[11px] font-bold text-stone-700">{user.number}</p>
                  </div>
                )}
                
                <div className="mt-2 pt-2 border-t border-stone-100">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <LogOut size={16} />
                    <span className="text-[11px] font-black uppercase tracking-wider">Logout</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
