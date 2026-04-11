import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Mail, Phone, ShoppingBag, ChevronRight, Edit2, Save, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api';

export default function ProfileEdit() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name:     (user?.name ?? '').replace(/[^a-zA-Z\s]/g, ''),
    phone:    (user?.phone ?? '').replace(/\D/g, '').slice(0, 10),
    shopName: user?.shopName ?? '',
    email:    user?.email ?? '',
  });

  const initial = user?.name?.[0]?.toUpperCase() ?? 'U';

  const handleSave = () => {
    updateUser({ name: form.name, phone: form.phone, shopName: form.shopName, email: form.email });
    api.post('/customers/sync', {
      phone: form.phone,
      name: form.name,
      shopName: form.shopName,
      email: form.email,
    }).catch(console.error);
    setEditing(false);
  };

  return (
    <div className="max-w-md mx-auto px-4 py-6 pb-20">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate('/profile')}
          className="p-1.5 -ml-1 rounded-full hover:bg-gray-50 transition-colors">
          <ChevronRight size={22} className="rotate-180" style={{ color: '#292524' }} />
        </button>
        <h1 className="text-xl font-bold" style={{ color: '#292524' }}>My Profile</h1>
      </div>

      <div className="rounded-2xl p-5" style={{ background: 'white', border: '1.5px solid rgba(193,136,91,0.12)' }}>
        {/* Title + edit button */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-bold" style={{ color: '#292524' }}>Personal Information</h2>
            <p className="text-xs mt-0.5" style={{ color: '#78716c' }}>Manage your name and contact details</p>
          </div>
          {!editing ? (
            <button onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-xl transition-all hover:opacity-80"
              style={{ background: 'rgba(193,136,91,0.1)', color: '#a96f46' }}>
              <Edit2 size={13} /> Edit
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => setEditing(false)}
                className="flex items-center gap-1 text-sm font-semibold px-3 py-1.5 rounded-xl"
                style={{ background: 'rgba(0,0,0,0.05)', color: '#57534e' }}>
                <X size={13} /> Cancel
              </button>
              <button onClick={handleSave}
                className="flex items-center gap-1 text-sm font-semibold px-3 py-1.5 rounded-xl"
                style={{ background: 'linear-gradient(145deg, #c1885b, #a96f46)', color: 'white', boxShadow: '0 3px 10px rgba(169,111,70,0.3)' }}>
                <Save size={13} /> Save
              </button>
            </div>
          )}
        </div>

        {/* Avatar row */}
        <div className="flex items-center gap-4 mb-5 pb-5" style={{ borderBottom: '1.5px solid rgba(193,136,91,0.1)' }}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold"
            style={{ background: 'linear-gradient(145deg, #c1885b, #8d5838)', color: 'white', boxShadow: '0 6px 20px rgba(169,111,70,0.35)' }}>
            {initial}
          </div>
          <div>
            <p className="font-bold text-base" style={{ color: '#292524' }}>{user?.name}</p>
            <p className="text-xs mt-0.5" style={{ color: '#78716c' }}>PPWStore Member</p>
          </div>
        </div>

        {/* Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { label: 'Customer Name', key: 'name',     icon: <User size={15} />,        type: 'text' },
            { label: 'Shop Name',     key: 'shopName', icon: <ShoppingBag size={15} />, type: 'text' },
            { label: 'Email Address', key: 'email',    icon: <Mail size={15} />,        type: 'email' },
            { label: 'Phone Number',  key: 'phone',    icon: <Phone size={15} />,       type: 'tel' },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider" style={{ color: '#57534e' }}>{f.label}</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#c1885b' }}>{f.icon}</span>
                <input
                  type={f.type}
                  value={(form as any)[f.key] ?? ''}
                  onChange={e => {
                    let val = e.target.value;
                    if (f.key === 'name') val = val.replace(/[^a-zA-Z\s]/g, '');
                    if (f.key === 'phone') val = val.replace(/\D/g, '').slice(0, 10);
                    setForm(s => ({ ...s, [f.key]: val }));
                  }}
                  autoComplete="off"
                  disabled={!editing}
                  className="w-full pl-10 px-4 py-2.5 rounded-xl text-sm font-medium outline-none transition-all"
                  style={!editing
                    ? { background: '#faf7f4', color: '#a8a29e', cursor: 'default', border: '1.5px solid rgba(193,136,91,0.1)' }
                    : { background: 'white', border: '1.5px solid rgba(193,136,91,0.3)', color: '#292524' }
                  }
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
