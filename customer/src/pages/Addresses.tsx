import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, MapPin, Plus, Trash2, Home, Briefcase } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface Address {
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

export default function Addresses() {
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [newAddr, setNewAddr] = useState({ type: 'Home', name: '', phone: '', address: '', pincode: '', city: '', state: '', isDefault: false });
  
  useEffect(() => {
    const saved = localStorage.getItem('ppw_addresses');
    if (saved) {
      setAddresses(JSON.parse(saved));
    } else {
      setAddresses([
        { id: '1', type: 'Home', name: 'Customer', phone: '7976421414', address: 'Flat 402, Sunshine Apartments', pincode: '400001', city: 'Mumbai', state: 'MH', isDefault: true }
      ]);
    }
  }, []);

  const Header = () => (
    <div className="bg-white px-4 py-4 sticky top-0 z-10 flex items-center gap-3 border-b border-gray-100 shadow-sm">
      <button onClick={() => navigate(-1)} className="p-1.5 -ml-1 rounded-full hover:bg-gray-50 flex items-center justify-center transition-all pointer-events-auto cursor-pointer">
        <ChevronRight size={22} className="rotate-180" style={{ color: '#292524' }} />
      </button>
      <h1 className="text-lg font-extrabold" style={{ color: '#292524' }}>My Addresses</h1>
    </div>
  );

  if (!isLoggedIn) {
     return (
       <div className="bg-[#faf7f4] min-h-screen pb-16">
         <Header />
         <div className="max-w-md mx-auto px-4 py-24 text-center">
           <span className="text-6xl block mb-4">🔐</span>
           <h2 className="text-xl font-bold mb-2" style={{ color: '#1C1C1C' }}>Sign in to view addresses</h2>
           <button onClick={() => navigate('/login')}
             className="px-8 py-3 rounded-xl text-sm font-bold transition-all hover:opacity-90 mt-4"
             style={{ background: '#0C831F', color: 'white' }}>
             Sign In
           </button>
         </div>
       </div>
     );
  }

  const removeAddress = (id: string) => {
    const next = addresses.filter(a => a.id !== id);
    setAddresses(next);
    localStorage.setItem('ppw_addresses', JSON.stringify(next));
  };

  const saveAddress = () => {
    if (!newAddr.address || !newAddr.city) return;
    const addr: Address = { id: Date.now().toString(), type: newAddr.type as any, name: newAddr.name, phone: newAddr.phone, address: newAddr.address, pincode: newAddr.pincode, city: newAddr.city, state: newAddr.state, isDefault: newAddr.isDefault };
    const next = [...addresses, addr];
    setAddresses(next);
    localStorage.setItem('ppw_addresses', JSON.stringify(next));
    setShowForm(false);
    setNewAddr({ type: 'Home', name: '', phone: '', address: '', pincode: '', city: '', state: '', isDefault: false });
  };

  const set = (k: keyof typeof newAddr, v: string) => setNewAddr(a => ({ ...a, [k]: v }));
  const inputClass = "w-full px-3.5 py-2.5 rounded-xl text-sm font-medium outline-none transition-all bg-white text-gray-900 placeholder:text-gray-400";
  const inputStyle = { border: '1.5px solid #E8E8E8' };

  return (
    <div className="bg-[#faf7f4] min-h-screen pb-16">
      <Header />
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2.5">
            <MapPin size={20} style={{ color: '#0C831F' }} />
            <h2 className="text-xl font-bold" style={{ color: '#1C1C1C' }}>Saved Addresses</h2>
          </div>
          <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1 text-sm font-bold px-3 py-1.5 rounded-lg active:scale-95 transition-transform"
            style={{ background: 'rgba(12,131,31,0.1)', color: '#0C831F' }}>
            <Plus size={16} /> Add New
          </button>
        </div>

        {showForm && (
          <div className="bg-white p-4 rounded-2xl mb-4" style={{ border: '1px solid #E8E8E8' }}>
            <h3 className="font-bold text-sm mb-3">Add New Address</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {([
                  { k: 'name',    label: 'Full Name',  placeholder: 'Recipient name',         span: false, type: 'text' },
                  { k: 'phone',   label: 'Phone',      placeholder: '10-digit number',        span: false, type: 'tel', inputMode: 'numeric' },
                  { k: 'address', label: 'Address',    placeholder: 'House no, street, area', span: true,  type: 'text'  },
                  { k: 'pincode', label: 'Pincode',    placeholder: '6-digit pincode',        span: false, type: 'text', inputMode: 'numeric' },
                  { k: 'city',    label: 'City',       placeholder: 'City',                   span: false, type: 'text' },
                  { k: 'state',   label: 'State',      placeholder: 'State',                  span: false, type: 'text' },
                ] as { k: keyof typeof newAddr; label: string; placeholder: string; span: boolean; type: string; inputMode?: "numeric" | "text" | "tel" | "search" | "email" | "url" | "decimal" | undefined }[]).map(f => (
                  <div key={f.k} className={f.span ? 'sm:col-span-2' : ''}>
                    <label className="block text-xs font-bold mb-1.5 text-gray-600">{f.label}</label>
                    <input 
                      type={f.type} 
                      inputMode={f.inputMode}
                      value={(newAddr as any)[f.k]} 
                      onChange={e => {
                        let val = e.target.value;
                        if (f.k === 'phone') val = val.replace(/\D/g, '').slice(0, 10);
                        else if (f.k === 'pincode') val = val.replace(/\D/g, '').slice(0, 6);
                        else if (['name', 'city', 'state'].includes(f.k)) val = val.replace(/[^a-zA-Z\s]/g, '');
                        set(f.k as any, val);
                      }}
                      autoComplete="off"
                      placeholder={f.placeholder}
                      className={inputClass} style={inputStyle}
                      onFocus={e => Object.assign(e.currentTarget.style, { border: '1.5px solid #0C831F' })}
                      onBlur={e => Object.assign(e.currentTarget.style, inputStyle)} />
                  </div>
              ))}
              <div className="sm:col-span-2 flex gap-2 justify-end pt-2">
                <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm font-bold text-gray-500 hover:text-gray-700">Cancel</button>
                <button onClick={saveAddress} className="px-6 py-2 text-sm font-bold bg-green-700 text-white rounded-xl shadow-md">Save Address</button>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {addresses.length === 0 ? (
            <div className="text-center py-10">
              <span className="text-4xl block mb-3">🏠</span>
              <p className="text-sm font-bold text-gray-800">No addresses saved</p>
              <p className="text-xs text-gray-500 mt-1">Add a new address for faster checkout.</p>
            </div>
          ) : (
            addresses.map(addr => (
              <div key={addr.id} className="bg-white p-4 rounded-2xl flex items-start justify-between transition-all hover:shadow-sm" style={{ border: '1px solid #E8E8E8' }}>
                <div className="flex gap-3">
                  <div className="mt-0.5">
                    {addr.type === 'Home' ? <Home size={18} style={{ color: '#666' }} /> : <Briefcase size={18} style={{ color: '#666' }} />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-sm" style={{ color: '#1C1C1C' }}>{addr.type}</span>
                      {addr.isDefault && (
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-amber-50" style={{ color: '#b8804a' }}>DEFAULT</span>
                      )}
                    </div>
                    <p className="text-sm font-bold" style={{ color: '#1C1C1C' }}>{addr.name} • {addr.phone}</p>
                    <p className="text-sm mt-1" style={{ color: '#666' }}>{addr.address}</p>
                    <p className="text-sm leading-tight" style={{ color: '#666' }}>{addr.city}, {addr.state} {addr.pincode}</p>
                  </div>
                </div>
                <button onClick={() => removeAddress(addr.id)} 
                  className="p-2 hover:bg-red-50 rounded-lg transition-colors group cursor-pointer active:scale-90">
                  <Trash2 size={16} className="text-gray-400 group-hover:text-red-500" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
