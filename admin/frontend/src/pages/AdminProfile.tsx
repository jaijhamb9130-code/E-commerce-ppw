import { useState, useEffect } from 'react';
import { getUsers, createUser, deleteUser, updateUser } from '../api';
import { Plus, Trash2, X, Edit2 } from 'lucide-react';

const copper = '#b8804a';
const copperDark = '#9a6a3c';
const parchment = '#fdf8f3';

const ALL_PERMISSIONS = [
    { key: 'dashboard', label: 'Dashboard Access' },
    { key: 'orders', label: 'Order Processing' },
    { key: 'reports', label: 'Order History & Reports' },
    { key: 'inventory', label: 'Product Inventory' },
    { key: 'staff', label: 'Manage Roles & Staff' },
];

const cardStyle = {
    background: 'rgba(255,255,255,0.78)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(184,128,74,0.14)',
    borderRadius: '16px',
    boxShadow: '0 2px 12px rgba(184,128,74,0.06)',
} as const;

export default function AdminProfile() {
    const [users, setUsers] = useState<any[]>([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingUserId, setEditingUserId] = useState<number | null>(null);
    const [newUser, setNewUser] = useState({ username: '', password: '', name: '', number: '', role: 'employee', permissions: [] as string[] });
    const [createdUserCredentials, setCreatedUserCredentials] = useState<{ u: string; p: string } | null>(null);

    useEffect(() => { fetchUsers(); }, []);

    const fetchUsers = async () => {
        try { setUsers(await getUsers()); } catch (e) { console.error(e); }
    };

    const resetForm = () => {
        setNewUser({ username: '', password: '', name: '', number: '', role: 'employee', permissions: [] as string[] });
        setEditingUserId(null);
        setShowAddModal(false);
    };

    const handleSaveUser = async () => {
        try {
            if (editingUserId) {
                const payload: any = { ...newUser };
                if (!payload.password) delete payload.password;
                await updateUser(editingUserId, payload);
            } else {
                await createUser(newUser);
                setCreatedUserCredentials({ u: newUser.username, p: newUser.password });
            }

            resetForm();
            if (editingUserId) {
                // Just fetch if edited
                fetchUsers();
            } else {
                // Keep modal closed but fetch users
                fetchUsers();
            }
        } catch { alert('Operation failed'); }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        alert('Copied to clipboard!');
    };

    const handleEditClick = (user: any) => {
        setEditingUserId(user.id);
        setNewUser({
            username: user.username,
            password: '',
            name: user.name || '',
            number: user.number || '',
            role: user.role,
            permissions: Array.isArray(user.permissions) ? user.permissions : []
        });
        setShowAddModal(true);
    };

    const handleDeleteUser = async (id: number) => {
        if (!confirm('Are you sure?')) return;
        try { await deleteUser(id); fetchUsers(); } catch (e) { console.error(e); }
    };

    const inputStyle = {
        background: parchment,
        border: '1.5px solid rgba(184,128,74,0.2)',
        borderRadius: '10px',
        padding: '10px 14px',
        fontSize: '0.875rem',
        fontWeight: 500,
        color: '#2c1e0f',
        outline: 'none',
        width: '100%',
    } as const;

    return (
        <div className="p-3.5 space-y-4 pb-16">
            {/* Header */}
            <div className="flex items-center gap-2 pt-0.5">
                <img src="/ppw-logo.png" alt="Logo" className="w-8 h-8 object-contain flex-shrink-0" />
                <div>
                    <h2 className="text-base font-extrabold leading-tight" style={{ color: '#2c1e0f' }}>Roles</h2>
                    <p className="text-[9px] font-semibold" style={{ color: '#8c7a68' }}>Manage staff access</p>
                </div>
            </div>

            {/* Add Button */}
            <div className="flex justify-end">
                <button
                    onClick={() => { resetForm(); setShowAddModal(true); }}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold text-[12px] text-white transition-all active:scale-95 shadow-md"
                    style={{ background: `linear-gradient(145deg, ${copper}, ${copperDark})`, boxShadow: '0 4px 14px rgba(184,128,74,0.3)', border: 'none' }}
                >
                    <Plus size={14} />
                    Add Staff
                </button>
            </div>

            {/* Users list */}
            <div className="space-y-2">
                {users.map((user) => (
                    <div key={user.id} style={cardStyle} className="p-3 flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                            <div
                                className="w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-extrabold uppercase flex-shrink-0"
                                style={{ background: 'rgba(184,128,74,0.1)', color: copper }}
                            >
                                {user.username.charAt(0)}
                            </div>
                            <div className="min-w-0">
                                <p className="text-[13px] font-bold truncate" style={{ color: '#2c1e0f' }}>{user.name || user.username}</p>
                                <p className="text-[10px] font-medium capitalize" style={{ color: '#8c7a68' }}>
                                    {user.role} · {user.number || 'No phone'}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                            <button
                                onClick={() => handleEditClick(user)}
                                className="p-2 rounded-lg transition-colors"
                                style={{ color: '#a8a29e' }}
                                onMouseEnter={e => (e.currentTarget.style.color = copper)}
                                onMouseLeave={e => (e.currentTarget.style.color = '#a8a29e')}
                            >
                                <Edit2 size={16} />
                            </button>
                            {user.username !== 'admin' && (
                                <button
                                    onClick={() => handleDeleteUser(user.id)}
                                    className="p-2 rounded-lg transition-colors"
                                    style={{ color: '#a8a29e' }}
                                    onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                                    onMouseLeave={e => (e.currentTarget.style.color = '#a8a29e')}
                                >
                                    <Trash2 size={16} />
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
                    style={{ background: 'rgba(44,30,15,0.35)', backdropFilter: 'blur(4px)' }}>
                    <div
                        className="w-full max-w-md rounded-2xl p-6 space-y-5 relative"
                        style={{ background: 'rgba(253,248,243,0.98)', border: '1px solid rgba(184,128,74,0.18)', boxShadow: '0 20px 60px rgba(44,30,15,0.25)' }}
                    >
                        <button onClick={resetForm} className="absolute top-4 right-4 p-1.5 rounded-lg transition-colors"
                            style={{ color: '#a8a29e' }}>
                            <X size={20} />
                        </button>
                        <div>
                            <h3 className="text-lg font-extrabold" style={{ color: '#2c1e0f' }}>{editingUserId ? 'Edit Staff' : 'Add New Staff'}</h3>
                            <p className="text-[12px] mt-0.5" style={{ color: '#8c7a68' }}>{editingUserId ? 'Update employee details.' : 'Create login for a new employee.'}</p>
                        </div>

                        <div className="space-y-3.5">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase tracking-wide block" style={{ color: '#8c7a68' }}>Username</label>
                                    <input value={newUser.username} onChange={e => setNewUser({ ...newUser, username: e.target.value })} style={inputStyle} disabled={!!editingUserId} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase tracking-wide block" style={{ color: '#8c7a68' }}>Password</label>
                                    <input value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} placeholder={editingUserId ? 'Keep empty' : ''} style={inputStyle} type="password" />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase tracking-wide block" style={{ color: '#8c7a68' }}>Full Name</label>
                                <input value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value.replace(/[^a-zA-Z\s]/g, '') })} style={inputStyle} autoComplete="off" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase tracking-wide block" style={{ color: '#8c7a68' }}>Phone</label>
                                    <input 
                                        type="tel"
                                        inputMode="numeric"
                                        value={newUser.number} 
                                        onChange={e => setNewUser({ ...newUser, number: e.target.value.replace(/\D/g, '').slice(0, 10) })} 
                                        style={inputStyle} 
                                        autoComplete="off"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase tracking-wide block" style={{ color: '#8c7a68' }}>Role</label>
                                    <select value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })} style={{ ...inputStyle, appearance: 'none' as any }}>
                                        <option value="employee">Employee</option>
                                        <option value="manager">Manager</option>
                                        <option value="admin">Admin</option>
                                    </select>
                                </div>
                            </div>

                            {/* Page Permissions Section (Reference from ShradhaABS) */}
                            {newUser.role !== 'admin' && (
                                <div className="pt-2 border-t border-stone-200 mt-2">
                                    <div className="flex items-center justify-between mb-3">
                                        <div>
                                            <h4 className="text-[10px] font-bold uppercase tracking-wide text-stone-500">Page Permissions</h4>
                                            <p className="text-[9px] text-stone-400">Toggle specific page access</p>
                                        </div>
                                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md" style={{ color: copper, background: 'rgba(184,128,74,0.08)' }}>Granular Access</span>
                                    </div>
                                    <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                                        {ALL_PERMISSIONS.map((perm) => (
                                            <div 
                                                key={perm.key} 
                                                className="flex items-center justify-between py-2 px-3 rounded-xl transition-all cursor-pointer hover:bg-stone-50 group border border-transparent"
                                                style={{ 
                                                    background: newUser.permissions?.includes(perm.key) ? 'rgba(184,128,74,0.04)' : 'transparent',
                                                    borderColor: newUser.permissions?.includes(perm.key) ? 'rgba(184,128,74,0.1)' : 'transparent'
                                                }}
                                                onClick={() => {
                                                    const current = newUser.permissions || [];
                                                    const next = current.includes(perm.key) 
                                                        ? current.filter(key => key !== perm.key) 
                                                        : [...current, perm.key];
                                                    setNewUser({ ...newUser, permissions: next });
                                                }}
                                            >
                                                <span className="text-[11px] font-bold" style={{ color: newUser.permissions?.includes(perm.key) ? '#2c1e0f' : '#8c7a68' }}>{perm.label}</span>
                                                <div 
                                                    className={`w-9 h-5 rounded-full relative transition-all duration-300 ${newUser.permissions?.includes(perm.key) ? 'bg-copper' : 'bg-stone-200'}`}
                                                    style={{ backgroundColor: newUser.permissions?.includes(perm.key) ? copper : '#e5e7eb' }}
                                                >
                                                    <div className={`absolute top-0.75 w-3.5 h-3.5 rounded-full bg-white transition-all duration-300 shadow-sm ${newUser.permissions?.includes(perm.key) ? 'left-[18px]' : 'left-0.75'}`} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={handleSaveUser}
                            className="w-full py-3.5 rounded-xl font-bold text-[13px] text-white transition-all active:scale-95 hover:shadow-lg"
                            style={{ background: `linear-gradient(145deg, ${copper}, ${copperDark})`, boxShadow: '0 4px 16px rgba(184,128,74,0.35)', border: 'none' }}
                        >
                            {editingUserId ? 'Update Account' : 'Create Account'}
                        </button>
                    </div>
                </div>
            )}

            {/* Credential Success Modal */}
            {createdUserCredentials && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
                    style={{ background: 'rgba(44,30,15,0.45)', backdropFilter: 'blur(6px)' }}>
                    <div
                        className="w-full max-w-sm rounded-[24px] p-8 space-y-6 relative overflow-hidden"
                        style={{ background: '#fff', border: '1px solid rgba(184,128,74,0.2)', boxShadow: '0 30px 70px rgba(44,30,15,0.3)' }}
                    >
                        {/* Success Background Pattern */}
                        <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-[0.05]" style={{ background: '#22c55e' }} />
                        
                        <div className="text-center space-y-3">
                            <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center" style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1.5px solid rgba(34,197,94,0.2)' }}>
                                <CheckIcon size={28} />
                            </div>
                            <div>
                                <h3 className="text-lg font-black uppercase tracking-tight" style={{ color: '#2c1e0f' }}>Account Ready!</h3>
                                <p className="text-[11px] font-bold" style={{ color: '#8c7a68' }}>Copy & send these credentials to the staff members.</p>
                            </div>
                        </div>

                        <div className="space-y-3 bg-[#fdf8f3] p-5 rounded-2xl border border-[#b8804a1a]">
                            <div className="space-y-1">
                                <label className="text-[9px] font-black uppercase tracking-widest text-stone-400">Username</label>
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-sm font-black" style={{ color: '#2c1e0f' }}>{createdUserCredentials.u}</span>
                                    <button onClick={() => copyToClipboard(createdUserCredentials.u)} className="text-[10px] font-bold px-2 py-1 rounded-lg transition-all active:scale-95" style={{ background: 'rgba(184,128,74,0.1)', color: copper }}>Copy</button>
                                </div>
                            </div>
                            <div className="pt-3 border-t border-[#b8804a0d] space-y-1">
                                <label className="text-[9px] font-black uppercase tracking-widest text-stone-400">Temporary Password</label>
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-sm font-black" style={{ color: '#2c1e0f' }}>{createdUserCredentials.p}</span>
                                    <button onClick={() => copyToClipboard(createdUserCredentials.p)} className="text-[10px] font-bold px-2 py-1 rounded-lg transition-all active:scale-95" style={{ background: 'rgba(184,128,74,0.1)', color: copper }}>Copy</button>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <button
                                onClick={() => {
                                    const text = `Admin Portal Credentials\nUsername: ${createdUserCredentials.u}\nPassword: ${createdUserCredentials.p}`;
                                    copyToClipboard(text);
                                }}
                                className="w-full py-3.5 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all active:scale-95 bg-stone-50 border border-stone-200"
                                style={{ color: '#2c1e0f' }}
                            >
                                Copy All Details
                            </button>
                            <button
                                onClick={() => setCreatedUserCredentials(null)}
                                className="w-full py-3.5 rounded-xl font-black text-[11px] uppercase tracking-widest text-white transition-all active:scale-95 shadow-md"
                                style={{ background: `linear-gradient(145deg, ${copper}, ${copperDark})`, border: 'none' }}
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function CheckIcon({ size }: { size: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
        </svg>
    );
}
