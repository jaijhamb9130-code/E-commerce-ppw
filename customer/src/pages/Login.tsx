import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Phone, ArrowLeft, CheckCircle, RefreshCw, User, ShoppingBag } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api';

type Mode = 'signin' | 'signup' | 'otp';
type OtpFor = 'signin' | 'signup';
interface SignUpData { name: string; email: string; phone: string; shopName: string; }

export default function AuthPage() {
  const { login } = useAuth();
  const navigate = useNavigate(); // used after login/signup to redirect home

  const [mode, setMode]     = useState<Mode>('signin');
  const [animKey, setAnimKey] = useState(0);
  const [otpFor, setOtpFor] = useState<OtpFor>('signin');

  /* Sign In */
  const [siPhone, setSiPhone] = useState('');

  /* Sign Up */
  const [su, setSu] = useState<SignUpData>({ name: '', email: '', phone: '', shopName: '' });

  /* OTP */
  const [otp, setOtp]       = useState(['', '', '', '', '', '']);
  const otpRefs = [
    useRef<HTMLInputElement|null>(null), useRef<HTMLInputElement|null>(null),
    useRef<HTMLInputElement|null>(null), useRef<HTMLInputElement|null>(null),
    useRef<HTMLInputElement|null>(null), useRef<HTMLInputElement|null>(null),
  ];
  const [timer, setTimer]     = useState(59);
  const [canResend, setResend] = useState(false);
  const [mockOtp]             = useState(() => String(100000 + Math.floor(Math.random() * 900000)));

  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (mode !== 'otp') return;
    setTimer(59); setResend(false);
    const t = setInterval(() => setTimer(p => { if (p <= 1) { clearInterval(t); setResend(true); return 0; } return p - 1; }), 1000);
    return () => clearInterval(t);
  }, [mode]);

  const go = (next: Mode) => { setMode(next); setAnimKey(k => k + 1); setError(''); setSuccess(''); };

  const handleOtpChange = (i: number, v: string) => {
    const n = [...otp]; n[i] = v.replace(/\D/, ''); setOtp(n);
    if (v && i < 5) otpRefs[i + 1].current?.focus();
  };
  const handleOtpKey = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[i] && i > 0) otpRefs[i - 1].current?.focus();
  };

  const handleSignIn = async (e: React.SyntheticEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    await new Promise(r => setTimeout(r, 800));
    if (!/^\d{10}$/.test(siPhone)) { setError('Enter a valid 10-digit mobile number.'); setLoading(false); return; }
    setLoading(false);
    setSuccess(`OTP sent to +91 ${siPhone.slice(0, 5)}XXXXX — Demo OTP: ${mockOtp}`);
    setOtpFor('signin');
    setTimeout(() => go('otp'), 1400);
  };

  const handleSignUp = async (e: React.SyntheticEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    await new Promise(r => setTimeout(r, 700));
    if (!su.name.trim())            { setError('Please enter your full name.'); setLoading(false); return; }
    if (!/^\d{10}$/.test(su.phone)) { setError('Enter a valid 10-digit phone number.'); setLoading(false); return; }
    if (!su.shopName.trim())        { setError('Please enter your shop name.'); setLoading(false); return; }
    setLoading(false);
    setSuccess(`OTP sent to +91 ${su.phone.slice(0, 5)}XXXXX — Demo OTP: ${mockOtp}`);
    setOtpFor('signup');
    setTimeout(() => go('otp'), 1400);
  };

  const handleVerify = async (e: React.SyntheticEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    await new Promise(r => setTimeout(r, 800));
    if (otp.join('').length < 6)  { setError('Enter all 6 digits.'); setLoading(false); return; }
    if (otp.join('') !== mockOtp) { setError('Incorrect OTP. Try again.'); setLoading(false); return; }

    try {
      if (otpFor === 'signin') {
        // Sign-In: phone must already be registered. /customers/:phone/profile
        // returns null when the phone has never been seen — reject in that case
        // so a fresh number can't sneak in via the Sign-In path.
        const { data: existing } = await api.get(`/customers/${siPhone}/profile`);
        if (!existing) {
          setError('Account not found. Please sign up first.');
          setLoading(false);
          return;
        }
        login('demo_' + Date.now(), {
          id: existing.id,
          name: existing.name || 'Customer',
          email: existing.email || '',
          phone: existing.phone_number,
          shopName: existing.shop_no || '',
        });
      } else {
        // Sign-Up: name + phone + shopName are required (already validated in
        // handleSignUp); email is optional and only included when provided.
        // Use /customers/register (create-only) so the sign-up path can never
        // silently overwrite an existing customer. Backend returns HTTP 409
        // when the phone is already registered.
        const body: { phone: string; name: string; shopName: string; email?: string } = {
          phone: su.phone,
          name: su.name,
          shopName: su.shopName,
        };
        if (su.email && su.email.trim()) body.email = su.email.trim();
        const response = await api.post('/customers/register', body);
        const customer = response.data;
        login('demo_' + Date.now(), {
          id: customer.id,
          name: customer.name || su.name,
          email: customer.email || su.email || '',
          phone: customer.phone_number,
          shopName: customer.shop_no || su.shopName || '',
        });
      }
      navigate('/', { state: { justLoggedIn: true } });
    } catch (err: any) {
      const status = err?.response?.status;
      const raw = err?.response?.data?.message;
      const apiMsg = Array.isArray(raw) ? raw[0] : raw; // Nest validation sends arrays
      if (status === 409) {
        // Phone already registered — guide the user to sign in.
        setError(apiMsg || 'This phone is already registered. Please sign in instead.');
      } else if (status === 400) {
        setError(apiMsg || 'Invalid request. Please check your details.');
      } else if (status === 404) {
        // Endpoint missing — usually a stale deployed build without /customers/register.
        setError('Service unavailable (endpoint not found). Please try again later or contact support.');
      } else if (!err?.response) {
        // No HTTP response at all — network / server unreachable.
        setError('Network error — could not reach the server. Check your connection and retry.');
      } else if (typeof apiMsg === 'string' && apiMsg) {
        setError(apiMsg);
      } else {
        setError(otpFor === 'signin' ? 'Sign in failed. Try again.' : 'Could not create your account. Try again.');
      }
      setLoading(false);
    }
  };

  const set = (k: keyof SignUpData, v: string) => setSu(s => ({ ...s, [k]: v }));

  /* ── Theme ── */
  const copper = '#b8804a';
  const copperDark = '#9a6a3c';
  const parchment = '#fdf8f3';
  const cream = '#f7f0e8';
  const inputBase = "w-full h-[46px] px-4 rounded-xl text-[13px] font-medium outline-none transition-all duration-200 placeholder:text-stone-400/70";
  const inputStyle = { background: parchment, border: '1.5px solid rgba(184,128,74,0.18)', color: '#3d2e1f' };
  const inputFocusStyle = { border: `1.5px solid ${copper}`, background: '#fffcf8', boxShadow: '0 0 0 3px rgba(184,128,74,0.08)' };
  const labelClass = "text-[11px] font-semibold tracking-wide mb-1.5 block";

  const otpPhone = otpFor === 'signin' ? siPhone : su.phone;

  return (
    <div className="min-h-[100dvh] flex flex-col" style={{ background: cream }}>
      {/* Subtle pattern overlay */}
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: `radial-gradient(circle at 20% 80%, rgba(184,128,74,0.04) 0%, transparent 50%),
                          radial-gradient(circle at 80% 20%, rgba(184,128,74,0.03) 0%, transparent 50%),
                          radial-gradient(circle at 50% 50%, rgba(184,128,74,0.02) 0%, transparent 70%)`,
      }} />

      {/* Top Left Logo */}
      <div className="w-full p-4 flex items-start z-50 shrink-0">
        <div className="flex flex-col items-start pl-1">
          <div className="flex items-center justify-center -mb-2 -ml-2">
            <img src="/ppw-logo.png" alt="PPW" className="w-[70px] h-[70px] object-contain scale-[1.25] drop-shadow-sm" />
          </div>
          <span className="text-[12px] font-extrabold tracking-widest uppercase mt-1" style={{ color: copperDark }}>Purbanchal Papers & Works</span>
        </div>
      </div>

      {/* Center content */}
      <div className="flex-1 flex items-center justify-center px-4 pb-8 pt-2 sm:pt-4 sm:pb-12 shrink-0" key={animKey}>
        <div className="w-full max-w-[400px]">

          {/* ── SIGN IN ── */}
          {mode === 'signin' && (
            <div className="flex flex-col items-center">
              <div className="mb-6 flex flex-col items-center text-center">
                <h1 className="text-xl sm:text-[22px] font-extrabold tracking-tight" style={{ color: '#2c1e0f' }}>Welcome back!</h1>
                <p className="text-[12px] sm:text-[13px] mt-0.5" style={{ color: '#8c7a68' }}>Sign in to your PPW account</p>
              </div>

              {error && <AlertBanner type="error" message={error} />}
              {success && <AlertBanner type="success" message={success} />}

              <div className="w-full rounded-2xl p-5 sm:p-6"
                style={{
                  background: 'rgba(255,255,255,0.75)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(184,128,74,0.12)',
                  boxShadow: '0 4px 24px rgba(184,128,74,0.06), 0 1px 4px rgba(184,128,74,0.04)',
                }}>

                <form onSubmit={handleSignIn} className="flex flex-col gap-3.5">
                  <div>
                    <label className={labelClass} style={{ color: '#6d5c4a' }}>Mobile Number</label>
                    <div className="relative">
                      <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: copper }} />
                      <input type="tel" inputMode="numeric" className={`${inputBase} pl-10`}
                        style={inputStyle} placeholder="10-digit mobile number"
                        value={siPhone}
                        onChange={e => setSiPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        autoComplete="off"
                        onFocus={e => Object.assign(e.currentTarget.style, inputFocusStyle)}
                        onBlur={e => { Object.assign(e.currentTarget.style, inputStyle); e.currentTarget.style.boxShadow = 'none'; }}
                        required />
                    </div>
                  </div>

                  <button type="submit" disabled={loading}
                    className="w-full h-11 sm:h-12 rounded-xl text-[13px] font-bold tracking-wide transition-all duration-200 hover:shadow-lg active:scale-[0.98] flex items-center justify-center gap-2"
                    style={{ background: `linear-gradient(145deg, ${copper}, ${copperDark})`, color: 'white', boxShadow: '0 4px 16px rgba(184,128,74,0.35)' }}>
                    {loading ? <Spin /> : <><ShoppingBag size={16} /> Send OTP</>}
                  </button>
                </form>

                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px" style={{ background: 'rgba(184,128,74,0.12)' }} />
                  <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#b8a090' }}>or</span>
                  <div className="flex-1 h-px" style={{ background: 'rgba(184,128,74,0.12)' }} />
                </div>

                <button type="button" onClick={() => go('signup')}
                  className="w-full h-11 sm:h-12 rounded-xl text-[13px] font-bold tracking-wide transition-all duration-200 hover:shadow-sm active:scale-[0.98]"
                  style={{ border: `1.5px solid rgba(184,128,74,0.25)`, color: copperDark, background: 'rgba(184,128,74,0.03)' }}>
                  Create New Account
                </button>
              </div>
            </div>
          )}

          {/* ── SIGN UP ── */}
          {mode === 'signup' && (
            <div className="flex flex-col items-center">
              <div className="w-full flex flex-col mb-5 relative">
                <div className="absolute right-0 top-0">
                  <BackBtn onClick={() => go('signin')} />
                </div>
                <h2 className="text-xl font-extrabold tracking-tight pr-10" style={{ color: '#2c1e0f' }}>Create Account</h2>
                <p className="text-[12px] mt-0.5" style={{ color: '#8c7a68' }}>Join PPW for exclusive offers</p>
              </div>

              {error && <AlertBanner type="error" message={error} />}
              {success && <AlertBanner type="success" message={success} />}

              <div className="w-full rounded-2xl p-5 sm:p-6"
                style={{
                  background: 'rgba(255,255,255,0.75)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(184,128,74,0.12)',
                  boxShadow: '0 4px 24px rgba(184,128,74,0.06), 0 1px 4px rgba(184,128,74,0.04)',
                }}>
                <form onSubmit={handleSignUp} className="flex flex-col gap-3">
                  <div>
                    <label className={labelClass} style={{ color: '#6d5c4a' }}>Full Name</label>
                    <div className="relative">
                      <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: copper }} />
                      <input type="text" className={`${inputBase} pl-10`} style={inputStyle}
                        placeholder="Your full name" value={su.name} 
                        onChange={e => set('name', e.target.value.replace(/[^a-zA-Z\s]/g, ''))}
                        autoComplete="off"
                        onFocus={e => Object.assign(e.currentTarget.style, inputFocusStyle)}
                        onBlur={e => { Object.assign(e.currentTarget.style, inputStyle); e.currentTarget.style.boxShadow = 'none'; }} required />
                    </div>
                  </div>

                  <div>
                    <label className={labelClass} style={{ color: '#6d5c4a' }}>Phone Number</label>
                    <div className="relative">
                      <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: copper }} />
                      <input type="tel" inputMode="numeric" className={`${inputBase} pl-10`} style={inputStyle}
                        placeholder="10-digit mobile number" value={su.phone}
                        onChange={e => set('phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                        autoComplete="off"
                        onFocus={e => Object.assign(e.currentTarget.style, inputFocusStyle)}
                        onBlur={e => { Object.assign(e.currentTarget.style, inputStyle); e.currentTarget.style.boxShadow = 'none'; }} required />
                    </div>
                  </div>

                  <div>
                    <label className={labelClass} style={{ color: '#6d5c4a' }}>Shop Name</label>
                    <div className="relative">
                      <ShoppingBag size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: copper }} />
                      <input type="text" className={`${inputBase} pl-10`} style={inputStyle}
                        placeholder="Your shop or business name" value={su.shopName} onChange={e => set('shopName', e.target.value)}
                        onFocus={e => Object.assign(e.currentTarget.style, inputFocusStyle)}
                        onBlur={e => { Object.assign(e.currentTarget.style, inputStyle); e.currentTarget.style.boxShadow = 'none'; }} required />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className={labelClass} style={{ color: '#6d5c4a', marginBottom: 0 }}>Email Address</label>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md" style={{ color: '#b8a090', background: 'rgba(184,128,74,0.08)' }}>Optional</span>
                    </div>
                    <div className="relative">
                      <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: copper }} />
                      <input type="email" className={`${inputBase} pl-10`} style={inputStyle}
                        placeholder="you@example.com" value={su.email} onChange={e => set('email', e.target.value)}
                        onFocus={e => Object.assign(e.currentTarget.style, inputFocusStyle)}
                        onBlur={e => { Object.assign(e.currentTarget.style, inputStyle); e.currentTarget.style.boxShadow = 'none'; }} />
                    </div>
                  </div>

                  <button type="submit" disabled={loading}
                    className="w-full h-12 rounded-xl text-[13px] font-bold tracking-wide mt-1 transition-all duration-200 hover:shadow-lg active:scale-[0.98] flex items-center justify-center gap-2"
                    style={{ background: `linear-gradient(145deg, ${copper}, ${copperDark})`, color: 'white', boxShadow: '0 4px 16px rgba(184,128,74,0.35)' }}>
                    {loading ? <Spin /> : 'Get OTP →'}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* ── OTP ── */}
          {mode === 'otp' && (
            <div className="flex flex-col items-center">
              <div className="mb-6 text-center">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{
                    background: 'linear-gradient(145deg, rgba(184,128,74,0.12), rgba(184,128,74,0.04))',
                    border: '1.5px solid rgba(184,128,74,0.15)',
                    boxShadow: '0 8px 32px rgba(184,128,74,0.1)',
                  }}>
                  <Phone size={28} style={{ color: copper }} />
                </div>
                <h2 className="text-lg font-extrabold" style={{ color: '#2c1e0f' }}>Verify OTP</h2>
                <p className="text-[13px] mt-1" style={{ color: '#8c7a68' }}>Sent to +91 {otpPhone.slice(0, 5)}XXXXX</p>
              </div>

              {error && <AlertBanner type="error" message={error} />}

              {/* Demo OTP stays visible on this screen so the user can read it
                  while typing — the success banner on the previous screen is
                  cleared on transition. (Demo flow: no real SMS is sent.) */}
              <DemoOtpBanner otp={mockOtp} />

              <div className="w-full rounded-2xl p-6"
                style={{
                  background: 'rgba(255,255,255,0.75)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(184,128,74,0.12)',
                  boxShadow: '0 4px 24px rgba(184,128,74,0.06)',
                }}>
                <form onSubmit={handleVerify} className="space-y-5">
                  <div className="flex justify-center gap-2.5">
                    {otp.map((v, i) => (
                      <input key={i} ref={otpRefs[i]} type="text" inputMode="numeric" maxLength={1} value={v}
                        onChange={e => handleOtpChange(i, e.target.value)}
                        onKeyDown={e => handleOtpKey(i, e)}
                        className="w-11 h-12 text-center text-lg font-extrabold rounded-xl outline-none transition-all duration-200"
                        style={{
                          border: v ? `2px solid ${copper}` : '2px solid rgba(184,128,74,0.15)',
                          background: v ? 'rgba(184,128,74,0.06)' : parchment,
                          color: '#2c1e0f',
                          boxShadow: v ? '0 0 0 3px rgba(184,128,74,0.08)' : 'none',
                        }} />
                    ))}
                  </div>

                  <button type="submit" disabled={loading || otp.join('').length < 6}
                    className="w-full h-12 rounded-xl text-[13px] font-bold tracking-wide transition-all duration-200 hover:shadow-lg active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
                    style={{ background: `linear-gradient(145deg, ${copper}, ${copperDark})`, color: 'white', boxShadow: '0 4px 16px rgba(184,128,74,0.35)' }}>
                    {loading ? <Spin /> : <><CheckCircle size={16} /> Verify & Continue</>}
                  </button>
                </form>

                <div className="mt-5 text-center text-sm">
                  {canResend ? (
                    <button type="button"
                      onClick={() => { setOtp(['','','','','','']); setResend(false); setTimer(59); otpRefs[0].current?.focus(); }}
                      className="flex items-center justify-center gap-1.5 mx-auto font-bold transition-colors hover:underline"
                      style={{ color: copper }}>
                      <RefreshCw size={13} /> Resend OTP
                    </button>
                  ) : (
                    <p style={{ color: '#8c7a68' }}>
                      Resend in <span className="font-extrabold tabular-nums" style={{ color: copper }}>
                        0:{String(timer).padStart(2,'0')}
                      </span>
                    </p>
                  )}
                </div>
              </div>

              <button type="button"
                onClick={() => go(otpFor === 'signin' ? 'signin' : 'signup')}
                className="mt-5 text-xs font-bold transition-colors hover:underline" style={{ color: '#b8a090' }}>
                ← Change number
              </button>
            </div>
          )}

        </div>
      </div>

      {/* Footer */}
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

function AlertBanner({ type, message }: { type: 'error' | 'success'; message: string }) {
  const isErr = type === 'error';
  return (
    <div className="w-full rounded-xl px-4 py-3 text-[13px] font-semibold mb-4 flex items-center gap-2"
      style={{
        background: isErr ? 'rgba(220,38,38,0.05)' : 'rgba(34,197,94,0.05)',
        color: isErr ? '#c53030' : '#16803c',
        border: `1px solid ${isErr ? 'rgba(220,38,38,0.12)' : 'rgba(34,197,94,0.12)'}`,
      }}>
      {isErr ? '⚠️' : '✅'} {message}
    </div>
  );
}

function DemoOtpBanner({ otp }: { otp: string }) {
  return (
    <div className="w-full rounded-xl px-4 py-3 mb-4 flex items-center justify-center gap-2 text-[13px] font-semibold"
      style={{
        background: 'rgba(184,128,74,0.06)',
        color: '#9a6a3c',
        border: '1px dashed rgba(184,128,74,0.3)',
      }}>
      🔐 Demo OTP:&nbsp;<span className="text-[15px] font-extrabold tracking-[0.25em] tabular-nums" style={{ color: '#b8804a' }}>{otp}</span>
    </div>
  );
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="w-8 h-8 flex items-center justify-center rounded-full transition-all duration-200 hover:scale-110 flex-shrink-0"
      style={{ background: 'rgba(184,128,74,0.08)', border: '1px solid rgba(184,128,74,0.12)' }}>
      <ArrowLeft size={15} style={{ color: '#9a6a3c' }} />
    </button>
  );
}

function Spin() {
  return (
    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
    </svg>
  );
}
