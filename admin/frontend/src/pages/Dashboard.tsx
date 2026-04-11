import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
    LogOut, FileText, ClipboardList, RefreshCw,
    ShoppingCart, Calendar, ArrowRight,
    Clock, CheckCircle2, Archive, ChevronRight
} from 'lucide-react';
import { getUser, getDashboardStats, syncLedgers, syncStockItems } from '../api';

const copper = '#b8804a';


interface DashboardStats {
    today: { orders: number; sales: number };
    staffActivity: { id: number; name: string; actions: number; details?: string[] }[];
    ledgerCount: number;
    stockCount: number;
    fyOrders: number;
    lastSync: { ledgers: string | null; stock: string | null };
    online?: { total: number; pending: number; completed: number };
}

const cardStyle = {
    background: 'rgba(255,255,255,0.78)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(184,128,74,0.14)',
    borderRadius: '18px',
    boxShadow: '0 4px 20px rgba(184,128,74,0.06)',
} as const;

const iconBox = {
    width: 36, height: 36,
    background: 'rgba(184,128,74,0.1)',
    border: '1px solid rgba(184,128,74,0.18)',
    borderRadius: '10px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
    color: copper,
} as const;

export default function Dashboard() {
    const navigate = useNavigate();
    const [status, setStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loadingStats, setLoadingStats] = useState(true);
    const [syncingLedgers, setSyncingLedgers] = useState(false);
    const [syncingStock, setSyncingStock] = useState(false);
    const [expandedActivityId, setExpandedActivityId] = useState<number | null>(null);

    const user = getUser();
    const isAdmin = user?.role === 'admin';
    const perms = Array.isArray(user?.permissions) ? user.permissions : [];
    const hasPerm = (p: string) => isAdmin || perms.includes(p);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        if (!hasPerm('dashboard')) {
            setLoadingStats(false);
            return;
        }
        try {
            setLoadingStats(true);
            const data = await getDashboardStats();
            setStats(data);
        } catch (e) {
            console.error('Failed to fetch dashboard stats', e);
        } finally {
            setLoadingStats(false);
        }
    };

    const handleSyncLedgers = async (e: React.MouseEvent) => {
        e.preventDefault(); e.stopPropagation();
        setSyncingLedgers(true);
        try {
            await syncLedgers();
            setStatus({ type: 'success', message: 'Ledgers synced' });
            fetchStats();
        } catch {
            setStatus({ type: 'error', message: 'Failed to sync ledgers' });
        } finally {
            setSyncingLedgers(false);
            setTimeout(() => setStatus({ type: null, message: '' }), 3000);
        }
    };

    const handleSyncStock = async (e: React.MouseEvent) => {
        e.preventDefault(); e.stopPropagation();
        setSyncingStock(true);
        try {
            await syncStockItems();
            setStatus({ type: 'success', message: 'Stock synced' });
            fetchStats();
        } catch {
            setStatus({ type: 'error', message: 'Failed to sync stock' });
        } finally {
            setSyncingStock(false);
            setTimeout(() => setStatus({ type: null, message: '' }), 3000);
        }
    };

    const handleLogout = () => {
        if (window.confirm('Are you sure you want to log out?')) {
            localStorage.removeItem('user');
            localStorage.removeItem('token');
            window.location.href = '/admin/login';
        }
    };

    return (
    <div className="w-full p-2.5 animate-fade-in space-y-3.5">

        {/* Header */}
        <header className="flex justify-between items-center gap-2 pt-0.5">
            <div className="flex items-center gap-2 min-w-0">
                <img src="/ppw-logo.png" alt="PPW" className="w-9 h-9 object-contain flex-shrink-0" />
                <div className="min-w-0">
                    <h1 className="text-[15px] font-extrabold leading-tight truncate" style={{ color: '#2c1e0f' }}>Admin Console</h1>
                    <p className="text-[9px] font-bold uppercase tracking-widest truncate" style={{ color: '#8d5838' }}>Purbanchal Papers & Works</p>
                </div>
            </div>
            <button
                onClick={handleLogout}
                className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all active:scale-90"
                style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444' }}
            >
                <LogOut size={15} />
            </button>
        </header>

        {/* Analytics */}
        {hasPerm('dashboard') && (
            <section className="space-y-2.5">
                <div className="flex items-center justify-between">
                    <span className="section-label">Real-time Analytics</span>
                    {loadingStats && (
                        <div className="w-4 h-4 border-2 rounded-full animate-spin"
                            style={{ borderColor: 'rgba(184,128,74,0.2)', borderTopColor: copper }} />
                    )}
                </div>

                <div className="grid grid-cols-2 gap-2.5">

                    <div style={cardStyle} className="p-3 flex flex-col justify-between min-h-[100px]">
                        <div style={iconBox}><ClipboardList size={15} /></div>
                        <div className="mt-2 text-right">
                            <p className="text-lg font-extrabold leading-tight" style={{ color: '#2c1e0f' }}>
                                {loadingStats ? '—' : (stats?.online?.total ?? 0).toLocaleString('en-IN')}
                            </p>
                            <p className="text-[9px] font-bold uppercase tracking-wider mt-1" style={{ color: '#6d5c4a' }}>Total Orders</p>
                        </div>
                    </div>

                    <div style={cardStyle} className="p-3 flex flex-col justify-between min-h-[100px] overflow-hidden">
                        <div className="mb-auto">
                            <p className="text-[8px] font-black uppercase tracking-widest" style={{ color: '#6d5c4a' }}>Status (Today)</p>
                        </div>
                        <div className="flex gap-2">
                            <div className="flex-1">
                                <p className="text-[8.5px] font-black uppercase tracking-tighter" style={{ color: '#8c7a68' }}>Pending</p>
                                <p className="text-[14px] font-black" style={{ color: '#b45309' }}>{stats?.online?.pending || 0}</p>
                            </div>
                            <div className="flex-1 text-right">
                                <p className="text-[8.5px] font-black uppercase tracking-tighter" style={{ color: '#8c7a68' }}>Completed</p>
                                <p className="text-[14px] font-black" style={{ color: '#059669' }}>{stats?.online?.completed || 0}</p>
                            </div>
                        </div>
                    </div>

                    {/* FY Orders — outlined card */}
                    <div
                        className="col-span-2 p-3 flex items-center justify-between cursor-pointer group transition-all active:scale-[0.98]"
                        style={{ ...cardStyle }}
                        onClick={() => navigate('/orders?range=fy')}
                    >
                        <div className="flex items-center gap-3">
                            <div style={iconBox}>
                                <Calendar size={16} />
                            </div>
                            <div>
                                <p className="text-[9.5px] font-bold uppercase tracking-wider px-px" style={{ color: '#6d5c4a' }}>FY 2024-25 Orders</p>
                                <p className="text-xl font-extrabold leading-tight mt-0.5" style={{ color: '#2c1e0f' }}>
                                    {(stats?.fyOrders ?? 0).toLocaleString()}
                                </p>
                            </div>
                        </div>
                        <ArrowRight size={14} style={{ color: copper, opacity: 0.4, flexShrink: 0 }} />
                    </div>
                </div>
            </section>
        )}

            {/* Modules */}
            <section className="space-y-3">
                <span className="section-label">Management Modules</span>
                <div className="space-y-2.5">
                    {[
                        { to: '/online-orders', icon: ShoppingCart, label: 'Process Orders', sub: 'Handle live online orders', sync: null, p: 'orders' },
                        { to: '/orders', icon: ClipboardList, label: 'Reports (Order History)', sub: 'View all past orders', sync: null, p: 'reports' },
                        { to: '/ledgers', icon: FileText, label: 'Tally Ledgers', sub: 'Master database', sync: handleSyncLedgers, syncing: syncingLedgers, p: 'inventory' },
                        { to: '/stock-items', icon: Archive, label: 'Inventory Sync', sub: 'Products & stocks', sync: handleSyncStock, syncing: syncingStock, p: 'inventory' },
                    ].filter(m => hasPerm(m.p)).map(({ to, icon: Icon, label, sub, sync, syncing }) => (
                        <Link
                            key={to}
                            to={to}
                            className="flex items-center gap-3 p-3.5 rounded-[16px] transition-all active:scale-[0.98]"
                            style={cardStyle}
                        >
                            <div style={iconBox}><Icon size={20} /></div>
                            <div className="flex-1 min-w-0">
                                <p className="text-base font-bold leading-tight truncate" style={{ color: '#2c1e0f' }}>{label}</p>
                                <p className="text-[11px] font-semibold mt-1 truncate" style={{ color: '#6d5c4a' }}>{sub}</p>
                            </div>
                            {sync ? (
                                <div
                                    onClick={sync}
                                    className={`p-2 rounded-lg flex-shrink-0 transition-all ${syncing ? 'animate-spin opacity-50' : ''}`}
                                    style={{ background: 'rgba(184,128,74,0.08)', color: copper }}
                                >
                                    <RefreshCw size={14} />
                                </div>
                            ) : (
                                <ArrowRight size={15} style={{ color: 'rgba(184,128,74,0.35)', flexShrink: 0 }} />
                            )}
                        </Link>
                    ))}
                </div>
            </section>

            {/* Staff Activity */}
            {hasPerm('staff') && (
                <section className="space-y-3 pb-2">
                    <div className="flex items-center justify-between">
                        <span className="section-label">Staff Activity (Today)</span>
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                    </div>
                    <div className="overflow-x-hidden">
                        <div className="max-h-[440px] overflow-y-auto custom-scrollbar overflow-x-hidden pr-0.5">
                            {stats?.staffActivity?.length ? (
                                <div className="space-y-2.5 pb-2">
                                    {stats.staffActivity.map((activity: any) => (
                                        <div
                                            key={activity.id}
                                            className="animate-in fade-in slide-in-from-bottom-2 duration-300"
                                        >
                                            <div 
                                                onClick={() => setExpandedActivityId(expandedActivityId === activity.id ? null : activity.id)}
                                                style={cardStyle}
                                                className="px-4 py-3.5 flex items-center gap-3 cursor-pointer hover:bg-[rgba(184,128,74,0.02)] transition-all active:scale-[0.99] overflow-hidden"
                                            >
                                                <div
                                                    className="w-9 h-9 flex-shrink-0 rounded-full flex items-center justify-center text-[12px] font-black uppercase"
                                                    style={{ background: 'rgba(184,128,74,0.1)', color: copper }}
                                                >
                                                    {activity.name?.charAt(0) || '?'}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[13px] font-black uppercase tracking-tight truncate" style={{ color: '#2c1e0f' }}>{activity.name}</p>
                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                        <CheckCircle2 size={12} className="text-emerald-600" />
                                                        <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: '#6d5c4a' }}>{activity.actions} Actions</span>
                                                    </div>
                                                </div>
                                                <ChevronRight size={16} className={`flex-shrink-0 transition-transform duration-300 ${expandedActivityId === activity.id ? 'rotate-90' : ''}`} style={{ color: 'rgba(184,128,74,0.4)' }} />
                                            </div>
                                            
                                            {expandedActivityId === activity.id && activity.details && activity.details.length > 0 && (
                                                <div className="px-1 pt-1.5 pb-2 animate-in slide-in-from-top-2 duration-300 overflow-hidden">
                                                    <div className="bg-[rgba(184,128,74,0.03)] rounded-[18px] p-3.5 space-y-2.5 border border-[rgba(184,128,74,0.08)] ml-4">
                                                        {activity.details.map((detail: string, idx: number) => (
                                                            <div key={idx} className="flex items-start gap-2.5">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-1.5 flex-shrink-0 shadow-[0_0_8px_rgba(16,185,129,0.3)]" />
                                                                <p className="text-[11px] font-bold leading-tight uppercase tracking-tight break-words" style={{ color: '#44403c' }}>{detail}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                        ) : (
                            <div className="p-8 text-center">
                                <Clock size={22} className="mx-auto mb-3" style={{ color: 'rgba(184,128,74,0.3)' }} />
                                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#a8a29e' }}>No activity today</p>
                            </div>
                        )}
                        </div> 
                    </div>
                </section>
            )}

            {/* Toast */}
            {status.message && (
                <div
                    className="fixed bottom-20 right-4 px-5 py-3 rounded-2xl flex items-center gap-3 animate-slide-up z-50"
                    style={{
                        background: 'rgba(255,255,255,0.95)',
                        border: status.type === 'success' ? '1px solid rgba(184,128,74,0.2)' : '1px solid rgba(239,68,68,0.2)',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
                    }}
                >
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${status.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                    <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: '#2c1e0f' }}>{status.message}</span>
                </div>
            )}
        </div>
    );
}
