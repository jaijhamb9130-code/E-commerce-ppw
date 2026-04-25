import React, { useState } from 'react';
import api from '../api';
import { Lock, User, ArrowRight } from 'lucide-react';
import { getDefaultRoute } from '../utils';

const copper = '#b8804a';
const copperDark = '#9a6a3c';
const cream = '#f7f0e8';
const parchment = '#fdf8f3';
const paper = '#fffcf8';

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [focusedField, setFocusedField] = useState<string | null>(null);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const response = await api.post('/auth/login', { username, password });
            const { access_token, user } = response.data;
            if (user) localStorage.setItem('user', JSON.stringify(user));
            localStorage.setItem('token', access_token);
            window.location.href = '/admin' + getDefaultRoute(user);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Invalid username or password');
        } finally {
            setLoading(false);
        }
    };

    const inputStyle = (field: string) => ({
        background: focusedField === field ? paper : parchment,
        border: `1.5px solid ${focusedField === field ? copper : 'rgba(184,128,74,0.18)'}`,
        boxShadow: focusedField === field ? '0 0 0 3px rgba(184,128,74,0.08)' : 'none',
        color: '#2c1e0f',
        borderRadius: '12px',
        height: '46px',
        padding: '0 16px 0 44px',
        fontSize: '13px',
        fontWeight: 500,
        outline: 'none',
        width: '100%',
        transition: 'all 0.2s ease',
    });

    return (
        <div className="min-h-[100dvh] flex flex-col relative overflow-hidden" style={{ background: cream }}>
            {/* Subtle pattern overlay */}
            <div className="fixed inset-0 pointer-events-none" style={{
                backgroundImage: `radial-gradient(circle at 20% 80%, rgba(184,128,74,0.04) 0%, transparent 50%),
                                  radial-gradient(circle at 80% 20%, rgba(184,128,74,0.03) 0%, transparent 50%),
                                  radial-gradient(circle at 50% 50%, rgba(184,128,74,0.02) 0%, transparent 70%)`,
            }} />

            {/* Top Left Logo (Matches customer layout) */}
            <div className="w-full p-4 flex items-start z-50 shrink-0">
                <div className="flex flex-col items-start pl-1">
                    <div className="flex items-center justify-center -mb-2 -ml-2">
                        <img src="/ppw-logo.png" alt="PPW" className="w-[70px] h-[70px] object-contain scale-[1.25] drop-shadow-sm" />
                    </div>
                    <span className="text-[12px] font-extrabold tracking-widest uppercase mt-1" style={{ color: copperDark }}>Purbanchal Papers & Works</span>
                </div>
            </div>

            {/* Center Content */}
            <div className="flex-1 flex items-center justify-center px-4 pb-8 pt-2 sm:pt-4 sm:pb-12 shrink-0">
                <div className="w-full max-w-[400px]">

                    {/* Branding / Hero section */}
                    <div className="mb-6 flex flex-col items-center text-center">
                        <h1 className="text-xl sm:text-[22px] font-extrabold tracking-tight" style={{ color: '#2c1e0f' }}>Admin Portal</h1>
                        <p className="text-[12px] sm:text-[13px] mt-0.5" style={{ color: '#8c7a68' }}>Sign in to your management account</p>
                    </div>

                    {/* Login Card */}
                    <div
                        className="w-full rounded-2xl p-5 sm:p-6"
                        style={{
                            background: 'rgba(255,255,255,0.75)',
                            backdropFilter: 'blur(20px)',
                            border: '1px solid rgba(184,128,74,0.12)',
                            boxShadow: '0 4px 24px rgba(184,128,74,0.06), 0 1px 4px rgba(184,128,74,0.04)',
                        }}
                    >
                        {error && (
                            <div
                                className="flex items-center gap-2 px-4 py-3 rounded-xl mb-4 text-[12px] font-semibold"
                                style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.18)', color: '#b91c1c' }}
                            >
                                <div className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0 animate-pulse" />
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleLogin} className="flex flex-col gap-3.5">
                            <div className="space-y-1">
                                <label className="text-[11px] font-semibold tracking-wide mb-1.5 block" style={{ color: '#6d5c4a' }}>
                                    Username
                                </label>
                                <div className="relative">
                                    <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: copper }} />
                                    <input
                                        type="text"
                                        placeholder="your-handle"
                                        value={username}
                                        onChange={e => setUsername(e.target.value)}
                                        onFocus={() => setFocusedField('username')}
                                        onBlur={() => setFocusedField(null)}
                                        style={{ ...inputStyle('username'), paddingLeft: '40px' }}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[11px] font-semibold tracking-wide mb-1.5 block" style={{ color: '#6d5c4a' }}>
                                    Password
                                </label>
                                <div className="relative">
                                    <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: copper }} />
                                    <input
                                        type="password"
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        onFocus={() => setFocusedField('password')}
                                        onBlur={() => setFocusedField(null)}
                                        style={{ ...inputStyle('password'), paddingLeft: '40px' }}
                                        required
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full h-11 sm:h-12 rounded-xl text-[13px] font-bold tracking-wide transition-all duration-200 hover:shadow-lg active:scale-[0.98] flex items-center justify-center gap-2"
                                style={{
                                    background: loading ? '#e7e5e4' : `linear-gradient(145deg, ${copper}, ${copperDark})`,
                                    color: loading ? '#a8a29e' : 'white',
                                    boxShadow: loading ? 'none' : '0 4px 16px rgba(184,128,74,0.35)',
                                    cursor: loading ? 'not-allowed' : 'pointer',
                                    border: 'none',
                                }}
                            >
                                {loading ? (
                                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                                    </svg>
                                ) : (<>Sign In Now <ArrowRight size={16} /></>)}
                            </button>
                        </form>
                    </div>
                </div>
            </div>

            {/* Footer matches customer layout */}
            <footer className="py-5 flex flex-col items-center gap-1.5 px-5 text-center">
                <p className="text-[10px] font-medium" style={{ color: '#b8a090' }}>Designed & developed by ABS Technologies</p>
                <div className="flex gap-4">
                    <a href="#" className="text-[10px] transition-colors hover:underline" style={{ color: '#b8a090' }}>Privacy Policy</a>
                    <a href="#" className="text-[10px] transition-colors hover:underline" style={{ color: '#b8a090' }}>Terms of Service</a>
                </div>
            </footer>
        </div>
    );
}
