import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, CreditCard, Wallet, Banknote, CheckCircle, Plus, Home, Briefcase, ChevronRight } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useOrders } from '../context/OrderContext';
import { useAuth } from '../context/AuthContext';
import api, { fetchCustomerProfile } from '../api';

const STEPS = ['Shipping', 'Summary', 'Payment'];

const PAYMENT_METHODS = [
  { id: 'upi',  label: 'UPI Payment',         icon: <Wallet size={18} />,     desc: 'PhonePe, GPay, Paytm, BHIM' },
  { id: 'card', label: 'Credit / Debit Card', icon: <CreditCard size={18} />, desc: 'Visa, Mastercard, RuPay' },
  { id: 'cod',  label: 'Cash on Delivery',    icon: <Banknote size={18} />,   desc: 'Pay when your order arrives' },
];

type AddressForm = { name: string; phone: string; pincode: string; address: string; city: string; state: string; };

interface SavedAddress {
  id: string;
  type: 'Home' | 'Work' | 'Other';
  name: string;
  phone: string;
  address: string;
  pincode: string;
  city: string;
  state: string;
  isDefault: boolean;
}

export default function Checkout() {
  const { items, total, clearCart } = useCart();
  const { placeOrder } = useOrders();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep]       = useState(0);
  const [addr, setAddr]       = useState<AddressForm>({ name: '', phone: '', pincode: '', address: '', city: '', state: '' });
  const [payment, setPayment] = useState('upi');
  const [placed, setPlaced]   = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddrId, setSelectedAddrId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const delivery   = total >= 499 ? 0 : 40;
  const finalTotal = total + delivery;

  // Load saved addresses from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('ppw_addresses');
    if (saved) {
      const parsed: SavedAddress[] = JSON.parse(saved);
      setSavedAddresses(parsed);
      // Auto-select default address
      const def = parsed.find(a => a.isDefault) || parsed[0];
      if (def) {
        setSelectedAddrId(def.id);
        setAddr({ name: def.name, phone: def.phone, address: def.address, pincode: def.pincode, city: def.city, state: def.state });
      }
    } else {
      // No saved addresses — show new form
      setShowNewForm(true);
    }
  }, []);

  // Auto-fill name/phone from user if not already set
  useEffect(() => {
    if (user && !selectedAddrId) {
      fetchCustomerProfile(user.phone).then((profile) => {
        if (profile) {
          setAddr(prev => ({
            ...prev,
            name: prev.name || profile.name || user.name || '',
            phone: prev.phone || profile.phone_number || user.phone || '',
          }));
        } else {
          setAddr(prev => ({ ...prev, name: prev.name || user.name || '', phone: prev.phone || user.phone || '' }));
        }
      });
    }
  }, [user, selectedAddrId]);

  const validateAddress = () => {
    if (!addr.name.trim()) return "Please enter full name";
    if (/[0-9]/.test(addr.name)) return "Name cannot contain numbers";
    if (!/^\d{10}$/.test(addr.phone)) return "Please enter a valid 10-digit phone number";
    if (!addr.address.trim()) return "Please enter shipping address";
    if (!/^\d{6}$/.test(addr.pincode)) return "Please enter a 6-digit pincode";
    if (!addr.city.trim()) return "Please enter city";
    if (/[0-9]/.test(addr.city)) return "City cannot contain numbers";
    if (!addr.state.trim()) return "Please enter state";
    if (/[0-9]/.test(addr.state)) return "State cannot contain numbers";
    return null;
  };

  const handleSelectSaved = (a: SavedAddress) => {
    setSelectedAddrId(a.id);
    setAddr({ name: a.name, phone: a.phone, address: a.address, pincode: a.pincode, city: a.city, state: a.state });
    setShowNewForm(false);
  };

  const handlePlace = async () => {
    try {
      const response = await api.post('/orders/online', {
        name: addr.name,
        phone: addr.phone,
        address: `${addr.address}, ${addr.city}`,
        pincode: addr.pincode,
        city: addr.city,
        state: addr.state,
        total: finalTotal,
        items: items.map(i => ({
           masterid: i.masterid,
           name: i.name,
           price: i.price,
           quantity: i.quantity,
           unit: i.unit || 'Pcs',
        }))
      });

      const backendOrder = response.data;
      placeOrder({
        id: backendOrder.id,
        date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
        total: finalTotal,
        status: 'placed',
        address: addr,
        paymentMethod: payment,
        items: items.map(i => ({
          name: i.name,
          qty: i.quantity,
          price: i.price,
          emoji: '📦'
        }))
      });

      setPlaced(true);
      clearCart();
      setTimeout(() => navigate('/orders'), 3000);
    } catch (e) {
      alert('Failed to place order. Please try again.');
    }
  };

  const set = (k: keyof AddressForm, v: string) => setAddr(a => ({ ...a, [k]: v }));
  const inputClass = "w-full px-3.5 py-2.5 rounded-xl text-sm font-medium outline-none transition-all bg-white text-gray-900 placeholder:text-gray-400";
  const inputStyle = { border: '1.5px solid #E8E8E8' };

  if (placed) return (
    <div className="max-w-md mx-auto px-4 py-24 text-center">
      <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-5"
        style={{ background: '#EFF7EF', border: '2px solid rgba(12,131,31,0.2)' }}>
        <CheckCircle size={44} style={{ color: '#0C831F' }} />
      </div>
      <h1 className="text-2xl font-extrabold mb-2 text-gray-900">Order Placed! 🎉</h1>
      <p className="text-sm mb-1.5" style={{ color: '#666666' }}>Your stationery is on the way.</p>
      <p className="text-xs animate-pulse" style={{ color: '#9E9E9E' }}>Redirecting to your orders…</p>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4">

      {/* Stepper */}
      <div className="flex items-center mb-4 px-4 py-3.5 bg-white rounded-xl" style={{ border: '1px solid #E8E8E8' }}>
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center flex-1">
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold transition-all"
                style={{
                  background: i < step ? '#0C831F' : i === step ? '#EFF7EF' : '#F2F2F2',
                  color: i < step ? 'white' : i === step ? '#0C831F' : '#9E9E9E',
                  border: i === step ? '2px solid #0C831F' : '2px solid transparent',
                }}>
                {i < step ? '✓' : i + 1}
              </div>
              <span className="text-xs font-semibold hidden sm:inline"
                style={{ color: i === step ? '#0C831F' : i < step ? '#1C1C1C' : '#9E9E9E' }}>
                {s}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className="flex-1 h-0.5 mx-2 rounded-full transition-all"
                style={{ background: i < step ? '#0C831F' : '#E8E8E8' }} />
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-3">
        <div className="flex-1">

          {/* Step 0 — Address */}
          {step === 0 && (
            <div className="space-y-3">
              {/* Saved Addresses */}
              {savedAddresses.length > 0 && (
                <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1px solid #E8E8E8' }}>
                  <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MapPin size={15} style={{ color: '#0C831F' }} />
                      <span className="text-sm font-extrabold text-gray-900">Saved Addresses</span>
                    </div>
                    <button
                      onClick={() => { setSelectedAddrId(null); setShowNewForm(true); }}
                      className="flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg"
                      style={{ background: 'rgba(12,131,31,0.08)', color: '#0C831F' }}
                    >
                      <Plus size={13} /> Add New
                    </button>
                  </div>

                  {savedAddresses.map((a, i) => (
                    <button
                      key={a.id}
                      onClick={() => handleSelectSaved(a)}
                      className="w-full flex items-start gap-3 px-4 py-3.5 text-left transition-all"
                      style={{
                        borderTop: i > 0 ? '1px solid #F2F2F2' : undefined,
                        background: selectedAddrId === a.id ? '#EFF7EF' : 'white',
                      }}
                    >
                      {/* Radio */}
                      <div className="mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                        style={{ borderColor: selectedAddrId === a.id ? '#0C831F' : '#D1D5DB' }}>
                        {selectedAddrId === a.id && (
                          <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#0C831F' }} />
                        )}
                      </div>
                      {/* Icon */}
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: selectedAddrId === a.id ? 'rgba(12,131,31,0.1)' : '#F5F5F5' }}>
                        {a.type === 'Home'
                          ? <Home size={15} style={{ color: selectedAddrId === a.id ? '#0C831F' : '#666' }} />
                          : <Briefcase size={15} style={{ color: selectedAddrId === a.id ? '#0C831F' : '#666' }} />}
                      </div>
                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-bold text-gray-900">{a.type}</span>
                          {a.isDefault && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                              style={{ background: 'rgba(12,131,31,0.08)', color: '#0C831F' }}>DEFAULT</span>
                          )}
                        </div>
                        <p className="text-xs font-semibold text-gray-700">{a.name} · {a.phone}</p>
                        <p className="text-xs mt-0.5 leading-relaxed" style={{ color: '#666' }}>
                          {a.address}, {a.city}, {a.state} — {a.pincode}
                        </p>
                      </div>
                      <ChevronRight size={14} style={{ color: '#CCC', flexShrink: 0, marginTop: 2 }} />
                    </button>
                  ))}
                </div>
              )}

              {/* New Address Form */}
              {(showNewForm || savedAddresses.length === 0) && (
                <div className="bg-white rounded-2xl p-5" style={{ border: '1px solid #E8E8E8' }}>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: '#EFF7EF' }}>
                      <MapPin size={16} style={{ color: '#0C831F' }} />
                    </div>
                    <div>
                      <h2 className="text-sm font-extrabold text-gray-900">
                        {savedAddresses.length > 0 ? 'Add New Address' : 'Shipping Address'}
                      </h2>
                      <p className="text-xs" style={{ color: '#9E9E9E' }}>Where should we ship your order?</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                    {([
                      { k: 'name',    label: 'Full Name',  placeholder: 'Recipient name',         span: false, type: 'text' },
                      { k: 'phone',   label: 'Phone',      placeholder: '10-digit number',        span: false, type: 'tel', inputMode: 'numeric' },
                      { k: 'address', label: 'Address',    placeholder: 'House no, street, area', span: true,  type: 'text' },
                      { k: 'pincode', label: 'Pincode',    placeholder: '6-digit pincode',        span: false, type: 'text', inputMode: 'numeric' },
                      { k: 'city',    label: 'City',       placeholder: 'City',                   span: false, type: 'text' },
                      { k: 'state',   label: 'State',      placeholder: 'State',                  span: false, type: 'text' },
                    ] as { k: keyof AddressForm; label: string; placeholder: string; span: boolean; type: string; inputMode?: "numeric" | "text" | "tel" | "search" | "email" | "url" | "decimal" | undefined }[]).map(f => (
                      <div key={f.k} className={f.span ? 'sm:col-span-2' : ''}>
                        <label className="block text-xs font-bold mb-1.5 text-gray-600">{f.label}</label>
                        <input
                          type={f.type}
                          inputMode={f.inputMode}
                          value={addr[f.k]}
                          onChange={e => {
                            let val = e.target.value;
                            if (f.k === 'phone') val = val.replace(/\D/g, '').slice(0, 10);
                            else if (f.k === 'pincode') val = val.replace(/\D/g, '').slice(0, 6);
                            else if (['name', 'city', 'state'].includes(f.k)) val = val.replace(/[^a-zA-Z\s]/g, '');
                            set(f.k, val);
                          }}
                          autoComplete="off"
                          placeholder={f.placeholder}
                          className={inputClass} style={inputStyle}
                          onFocus={e => Object.assign(e.currentTarget.style, { border: '1.5px solid #0C831F' })}
                          onBlur={e => Object.assign(e.currentTarget.style, inputStyle)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Proceed button */}
              <button
                onClick={() => {
                  const error = validateAddress();
                  if (error) { alert(error); return; }
                  setStep(1);
                }}
                className="w-full py-3.5 rounded-xl text-sm font-extrabold transition-all hover:opacity-90 active:scale-[0.98]"
                style={{ background: '#0C831F', color: 'white' }}
              >
                Ship Here →
              </button>
            </div>
          )}

          {/* Step 1 — Summary */}
          {step === 1 && (
            <div className="bg-white rounded-2xl p-5" style={{ border: '1px solid #E8E8E8' }}>
              <h2 className="text-sm font-extrabold text-gray-900 mb-4">Order Summary</h2>
              <div className="space-y-2.5 mb-4">
                {items.map(item => (
                  <div key={item.id} className="flex items-center gap-3 py-2.5 px-3 rounded-xl"
                    style={{ background: '#F8F8F8', border: '1px solid #E8E8E8' }}>
                    <span className="text-2xl flex-shrink-0">📦</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate text-gray-900">{item.name}</p>
                      <p className="text-xs" style={{ color: '#9E9E9E' }}>Qty: {item.quantity} × ₹{item.price}</p>
                    </div>
                    <span className="text-sm font-extrabold flex-shrink-0 text-gray-900">
                      ₹{(item.price * item.quantity).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex items-start gap-2 p-3 rounded-xl mb-4"
                style={{ background: '#EFF7EF', border: '1px solid rgba(12,131,31,0.15)' }}>
                <MapPin size={14} style={{ color: '#0C831F', flexShrink: 0, marginTop: 2 }} />
                <div className="text-xs">
                  <p className="font-bold text-gray-900 mb-0.5">{addr.name} · {addr.phone}</p>
                  <p style={{ color: '#666666' }}>{addr.address}, {addr.city}, {addr.state} — {addr.pincode}</p>
                </div>
              </div>
              <div className="flex gap-2.5">
                <button onClick={() => setStep(0)}
                  className="flex-1 py-3 rounded-xl text-sm font-bold transition-all"
                  style={{ background: 'transparent', color: '#0C831F', border: '1.5px solid #0C831F' }}>
                  ← Change
                </button>
                <button onClick={() => setStep(2)}
                  className="flex-1 py-3 rounded-xl text-sm font-extrabold transition-all hover:opacity-90 active:scale-[0.98]"
                  style={{ background: '#0C831F', color: 'white' }}>
                  Continue →
                </button>
              </div>
            </div>
          )}

          {/* Step 2 — Payment */}
          {step === 2 && (
            <div className="bg-white rounded-2xl p-5" style={{ border: '1px solid #E8E8E8' }}>
              <h2 className="text-sm font-extrabold text-gray-900 mb-4">Payment Method</h2>
              <div className="space-y-2.5 mb-5">
                {PAYMENT_METHODS.map(m => (
                  <label key={m.id}
                    className="flex items-center gap-3 p-4 rounded-xl cursor-pointer transition-all"
                    style={{
                      border: `2px solid ${payment === m.id ? '#0C831F' : '#E8E8E8'}`,
                      background: payment === m.id ? '#EFF7EF' : 'white',
                    }}>
                    <input type="radio" name="pay" value={m.id} checked={payment === m.id}
                      onChange={() => setPayment(m.id)} style={{ accentColor: '#0C831F' }} />
                    <span style={{ color: '#0C831F' }}>{m.icon}</span>
                    <div>
                      <p className="text-sm font-bold text-gray-900">{m.label}</p>
                      <p className="text-xs" style={{ color: '#9E9E9E' }}>{m.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
              <button onClick={handlePlace}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-extrabold transition-all hover:opacity-90 active:scale-[0.98]"
                style={{ background: '#0C831F', color: 'white' }}>
                Place Order · ₹{finalTotal.toLocaleString()}
              </button>
            </div>
          )}
        </div>

        {/* Bill Summary */}
        <div className="lg:w-64 flex-shrink-0">
          <div className="bg-white rounded-2xl p-4 sticky top-28" style={{ border: '1px solid #E8E8E8' }}>
            <h3 className="text-xs font-extrabold uppercase tracking-wide text-gray-900 mb-3 pb-2.5"
              style={{ borderBottom: '1px solid #F2F2F2' }}>
              Bill Details
            </h3>
            <div className="space-y-2.5 text-sm">
              <Row label={`Price (${items.length} item${items.length !== 1 ? 's' : ''})`} value={`₹${total.toLocaleString()}`} />
              <Row label="Shipping fee" value={delivery === 0 ? 'Free' : `₹${delivery}`} green={delivery === 0} />
              <div className="pt-2.5" style={{ borderTop: '1px solid #F2F2F2' }}>
                <Row label="Grand Total" value={`₹${finalTotal.toLocaleString()}`} bold />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold, green }: { label: string; value: string; bold?: boolean; green?: boolean }) {
  return (
    <div className="flex justify-between">
      <span style={{ color: '#666666', fontWeight: bold ? 700 : 500 }}>{label}</span>
      <span style={{ color: green ? '#0C831F' : '#1C1C1C', fontWeight: bold ? 700 : 500 }}>{value}</span>
    </div>
  );
}
