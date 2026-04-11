import { useState, useEffect } from 'react';
import { MapPin, Bell, Plus, Home, Briefcase, Check } from 'lucide-react';

interface Address {
  id: string;
  type: 'Home' | 'Work' | 'Other';
  street: string;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
}

interface Props {
  onClose: () => void;
}

export default function PostLoginSheet({ onClose }: Props) {
  const [step, setStep]                 = useState<'permissions' | 'address'>('permissions');
  const [locationStatus, setLocation]   = useState<'idle' | 'granted' | 'denied'>('idle');
  const [notifStatus, setNotif]         = useState<'idle' | 'granted' | 'denied'>('idle');
  const [addresses, setAddresses]       = useState<Address[]>([]);
  const [selected, setSelected]         = useState<string | null>(null);
  const [showAddForm, setShowAddForm]   = useState(false);
  const [newAddr, setNewAddr]           = useState({ type: 'Home' as 'Home' | 'Work' | 'Other', street: '', city: '', state: '', pincode: '' });
  const [visible, setVisible]           = useState(false);

  useEffect(() => {
    setTimeout(() => setVisible(true), 10);

    const saved = localStorage.getItem('ppw_addresses');
    if (saved) {
      const addrs = JSON.parse(saved) as Address[];
      setAddresses(addrs);
      const def = addrs.find(a => a.isDefault);
      if (def) setSelected(def.id);
    }

    if ('Notification' in window) {
      if (Notification.permission === 'granted') setNotif('granted');
      if (Notification.permission === 'denied')  setNotif('denied');
    }

    navigator.permissions?.query({ name: 'geolocation' }).then(r => {
      if (r.state === 'granted') setLocation('granted');
      if (r.state === 'denied')  setLocation('denied');
    });
  }, []);

  const requestLocation = () => {
    navigator.geolocation.getCurrentPosition(
      () => setLocation('granted'),
      () => setLocation('denied'),
    );
  };

  const requestNotifications = async () => {
    if (!('Notification' in window)) { setNotif('denied'); return; }
    const r = await Notification.requestPermission();
    setNotif(r === 'granted' ? 'granted' : 'denied');
  };

  const dismiss = () => {
    setVisible(false);
    setTimeout(onClose, 300);
  };

  const confirmAddress = () => {
    if (selected) {
      localStorage.setItem('ppw_selected_address', selected);
      const updated = addresses.map(a => ({ ...a, isDefault: a.id === selected }));
      localStorage.setItem('ppw_addresses', JSON.stringify(updated));
    }
    dismiss();
  };

  const saveNewAddress = () => {
    if (!newAddr.street.trim() || !newAddr.city.trim() || !newAddr.state.trim() || !/^\d{6}$/.test(newAddr.pincode)) return;
    const addr: Address = {
      id: Date.now().toString(),
      type: newAddr.type,
      street: newAddr.street,
      city: newAddr.city,
      state: newAddr.state,
      pincode: newAddr.pincode,
      isDefault: addresses.length === 0,
    };
    const updated = [...addresses, addr];
    setAddresses(updated);
    localStorage.setItem('ppw_addresses', JSON.stringify(updated));
    setSelected(addr.id);
    setShowAddForm(false);
    setNewAddr({ type: 'Home', street: '', city: '', state: '', pincode: '' });
  };

  const copper     = '#b8804a';
  const copperDark = '#9a6a3c';
  const inputStyle = {
    background: '#fdf8f3',
    border: '1.5px solid rgba(184,128,74,0.18)',
    color: '#3d2e1f',
  } as React.CSSProperties;

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 transition-opacity duration-300"
        style={{ background: 'rgba(0,0,0,0.5)', opacity: visible ? 1 : 0 }}
        onClick={dismiss}
      />

      {/* Sheet */}
      <div
        className="relative w-full rounded-t-3xl transition-transform duration-300"
        style={{
          background: '#fdf8f3',
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          maxHeight: '88vh',
          overflowY: 'auto',
        }}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1 sticky top-0" style={{ background: '#fdf8f3', zIndex: 1 }}>
          <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(184,128,74,0.3)' }} />
        </div>

        <div className="px-5 pb-10 pt-3">

          {/* ── STEP 1: PERMISSIONS ── */}
          {step === 'permissions' && (
            <>
              <h2 className="text-[18px] font-extrabold mb-0.5" style={{ color: '#2c1e0f' }}>Quick Setup</h2>
              <p className="text-[12px] mb-5" style={{ color: '#8c7a68' }}>Allow these for a better experience</p>

              {/* Location */}
              <PermCard
                icon={<MapPin size={20} style={{ color: locationStatus === 'granted' ? '#0C831F' : copper }} />}
                iconBg={locationStatus === 'granted' ? 'rgba(12,131,31,0.1)' : 'rgba(184,128,74,0.1)'}
                title="Location Access"
                desc="Auto-detect your shipping address"
                status={locationStatus}
                onAllow={requestLocation}
                copper={copper}
                copperDark={copperDark}
              />

              {/* Notifications */}
              <PermCard
                icon={<Bell size={20} style={{ color: notifStatus === 'granted' ? '#0C831F' : copper }} />}
                iconBg={notifStatus === 'granted' ? 'rgba(12,131,31,0.1)' : 'rgba(184,128,74,0.1)'}
                title="Notifications"
                desc="Order updates, offers & alerts"
                status={notifStatus}
                onAllow={requestNotifications}
                copper={copper}
                copperDark={copperDark}
              />

              <button
                onClick={() => setStep('address')}
                className="w-full h-12 rounded-xl text-[13px] font-bold tracking-wide mt-2 transition-all hover:shadow-lg active:scale-[0.98] flex items-center justify-center"
                style={{ background: `linear-gradient(145deg, ${copper}, ${copperDark})`, color: 'white', boxShadow: '0 4px 16px rgba(184,128,74,0.35)' }}>
                Continue →
              </button>
              <button onClick={dismiss}
                className="w-full mt-3 py-2 text-[12px] font-semibold text-center"
                style={{ color: '#b8a090' }}>
                Skip for now
              </button>
            </>
          )}

          {/* ── STEP 2: ADDRESS ── */}
          {step === 'address' && (
            <>
              <h2 className="text-[18px] font-extrabold mb-0.5" style={{ color: '#2c1e0f' }}>Select Shipping Address</h2>
              <p className="text-[12px] mb-5" style={{ color: '#8c7a68' }}>Where should we deliver your order?</p>

              {/* Saved addresses */}
              <div className="space-y-3 mb-3">
                {addresses.map(addr => (
                  <button
                    key={addr.id}
                    onClick={() => setSelected(addr.id)}
                    className="w-full flex items-center gap-3 p-4 rounded-2xl text-left transition-all active:scale-[0.98]"
                    style={{
                      background: selected === addr.id ? 'rgba(184,128,74,0.06)' : 'white',
                      border: selected === addr.id ? `1.5px solid ${copper}` : '1.5px solid rgba(184,128,74,0.12)',
                    }}>
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: selected === addr.id ? 'rgba(184,128,74,0.12)' : '#f5f5f5' }}>
                      {addr.type === 'Home'
                        ? <Home size={16} style={{ color: selected === addr.id ? copper : '#888' }} />
                        : <Briefcase size={16} style={{ color: selected === addr.id ? copper : '#888' }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold" style={{ color: '#2c1e0f' }}>{addr.type}</p>
                      <p className="text-[11px] truncate" style={{ color: '#8c7a68' }}>{addr.street}, {addr.city}, {addr.state} - {addr.pincode}</p>
                    </div>
                    {selected === addr.id && (
                      <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: copper }}>
                        <Check size={12} color="white" strokeWidth={3} />
                      </div>
                    )}
                  </button>
                ))}
              </div>

              {/* Add new address */}
              {!showAddForm ? (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="w-full flex items-center gap-3 p-4 rounded-2xl mb-5 transition-all active:scale-[0.98]"
                  style={{ border: `1.5px dashed rgba(184,128,74,0.4)`, background: 'rgba(184,128,74,0.03)' }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(184,128,74,0.1)' }}>
                    <Plus size={18} style={{ color: copper }} />
                  </div>
                  <span className="text-[13px] font-bold" style={{ color: copperDark }}>Add New Address</span>
                </button>
              ) : (
                <div className="p-4 rounded-2xl mb-5" style={{ background: 'white', border: `1.5px solid rgba(184,128,74,0.2)` }}>
                  <p className="text-[12px] font-extrabold mb-3" style={{ color: '#2c1e0f' }}>Add New Address</p>

                  {/* Type pills */}
                  <div className="flex gap-2 mb-3">
                    {(['Home', 'Work', 'Other'] as const).map(t => (
                      <button key={t} onClick={() => setNewAddr(p => ({ ...p, type: t }))}
                        className="flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-all"
                        style={{
                          background: newAddr.type === t ? copper : 'rgba(184,128,74,0.08)',
                          color: newAddr.type === t ? 'white' : copperDark,
                        }}>
                        {t}
                      </button>
                    ))}
                  </div>

                  <input
                    type="text"
                    placeholder="Flat / Building / Street"
                    value={newAddr.street}
                    onChange={e => setNewAddr(p => ({ ...p, street: e.target.value }))}
                    className="w-full h-10 px-3 rounded-xl text-[12px] outline-none mb-2"
                    style={inputStyle}
                  />
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <input
                      type="text"
                      placeholder="City"
                      value={newAddr.city}
                      onChange={e => {
                          setNewAddr(p => ({ ...p, city: e.target.value.replace(/[^a-zA-Z\s]/g, '') }));
                      }}
                      className="h-10 px-3 rounded-xl text-[12px] outline-none"
                      style={inputStyle}
                      autoComplete="off"
                    />
                    <input
                      type="text"
                      placeholder="State"
                      value={newAddr.state}
                      onChange={e => {
                          setNewAddr(p => ({ ...p, state: e.target.value.replace(/[^a-zA-Z\s]/g, '') }));
                      }}
                      className="h-10 px-3 rounded-xl text-[12px] outline-none"
                      style={inputStyle}
                      autoComplete="off"
                    />
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="6-digit Pincode"
                    value={newAddr.pincode}
                    onChange={e => {
                        setNewAddr(p => ({ ...p, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) }));
                    }}
                    className="w-full h-10 px-3 rounded-xl text-[12px] outline-none mb-3"
                    style={inputStyle}
                    autoComplete="off"
                  />
                  <div className="flex gap-2">
                    <button onClick={() => setShowAddForm(false)}
                      className="flex-1 h-9 rounded-xl text-[12px] font-bold"
                      style={{ background: 'rgba(184,128,74,0.08)', color: copperDark }}>
                      Cancel
                    </button>
                    <button onClick={saveNewAddress}
                      className="flex-1 h-9 rounded-xl text-[12px] font-bold"
                      style={{ background: `linear-gradient(145deg, ${copper}, ${copperDark})`, color: 'white' }}>
                      Save Address
                    </button>
                  </div>
                </div>
              )}

              <button
                onClick={confirmAddress}
                className="w-full h-12 rounded-xl text-[13px] font-bold tracking-wide transition-all hover:shadow-lg active:scale-[0.98]"
                style={{ background: `linear-gradient(145deg, ${copper}, ${copperDark})`, color: 'white', boxShadow: '0 4px 16px rgba(184,128,74,0.35)' }}>
                {selected ? 'Confirm Address' : 'Skip for now'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Permission Card ── */
function PermCard({
  icon, iconBg, title, desc, status, onAllow, copper, copperDark,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  desc: string;
  status: 'idle' | 'granted' | 'denied';
  onAllow: () => void;
  copper: string;
  copperDark: string;
}) {
  return (
    <div className="flex items-center gap-3 p-4 rounded-2xl mb-3"
      style={{ background: 'white', border: '1.5px solid rgba(184,128,74,0.12)' }}>
      <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: iconBg }}>
        {status === 'granted' ? <Check size={20} style={{ color: '#0C831F' }} /> : icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-bold" style={{ color: '#2c1e0f' }}>{title}</p>
        <p className="text-[11px]" style={{ color: '#8c7a68' }}>{desc}</p>
      </div>
      {status === 'idle' && (
        <button onClick={onAllow}
          className="text-[12px] font-bold px-3 py-1.5 rounded-lg flex-shrink-0 transition-all active:scale-95"
          style={{ background: `linear-gradient(145deg, ${copper}, ${copperDark})`, color: 'white' }}>
          Allow
        </button>
      )}
      {status === 'granted' && <span className="text-[11px] font-bold flex-shrink-0" style={{ color: '#0C831F' }}>Enabled ✓</span>}
      {status === 'denied'  && <span className="text-[11px] font-bold flex-shrink-0" style={{ color: '#b8a090' }}>Denied</span>}
    </div>
  );
}
