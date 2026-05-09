import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Loader, Search, FileText, Calendar, ArrowRight, Trash2, LogOut, X, User as UserIcon, ChevronDown } from 'lucide-react';
import { getOrders, deleteOrder, syncOrderToTally, getUser } from '../api';

const copper = '#b8804a';
const copperDark = '#9a6a3c';
const parchment = '#fdf8f3';
const cream = '#f7f0e8';

interface Order {
    id: number;
    bill_number: string;
    date: string;
    total_amount: string;
    status: string;
    ledger?: { name: string };
    creator?: { username: string };
    processor?: { name: string };
    order_type?: string;
    processed_at?: string;
}

const ORDER_FILTERS = [
    { label: 'All', value: '', category: 'all' },
    { label: 'Pending', value: 'pending', category: 'status' },
    { label: 'Completed', value: 'completed', category: 'status' },
    { label: 'Synced', value: 'fetched', category: 'status' },
];

export default function OrderReport() {
    const [searchParams, setSearchParams] = useSearchParams();
    const userId = searchParams.get('userId');
    const userName = searchParams.get('userName');
    const userRole = getUser()?.role;
    const isAdmin = userRole === 'admin';

    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedDate, setSelectedDate] = useState<string>(() => {
        const query = new URLSearchParams(window.location.search);
        if (query.get('range') === 'fy') return '';
        const d = new Date();
        const istOffset = 5.5 * 60 * 60 * 1000;
        const istTime = new Date(d.getTime() + istOffset);
        return `${istTime.getUTCFullYear()}-${String(istTime.getUTCMonth() + 1).padStart(2, '0')}-${String(istTime.getUTCDate()).padStart(2, '0')}`;
    });
    const [activeFilter, setActiveFilter] = useState({ value: '', category: 'all' });
    const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });

    const fetchOrders = async (page = 1, search = '', filter = activeFilter, date = selectedDate) => {
        setLoading(true);
        try {
            const data = await getOrders(
                page,
                pagination.limit,
                search,
                filter.category === 'type' ? filter.value : '',
                userId ? parseInt(userId) : undefined,
                date,
                searchParams.get('range') || '',
                filter.category === 'status' ? filter.value : ''
            );
            setOrders(data.data);
            setPagination({
                page: data.pagination.page,
                limit: data.pagination.limit,
                total: data.pagination.total,
                totalPages: data.pagination.totalPages
            });
        } catch (error) {
            console.error('Failed to fetch orders', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const range = searchParams.get('range');
        if (range === 'fy') {
            fetchOrders(1, searchTerm, activeFilter, '');
        } else {
            fetchOrders(1, searchTerm, activeFilter, selectedDate);
        }
    }, [userId, selectedDate, activeFilter, searchParams]);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchOrders(1, searchTerm);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const updateDate = (date: string) => {
        if (searchParams.get('range')) {
            const newParams = new URLSearchParams(searchParams);
            newParams.delete('range');
            setSearchParams(newParams);
        }
        setSelectedDate(date);
    };

    const handleFilterChange = (filter: { value: string, category: string }) => {
        setActiveFilter(filter);
    };

    const clearUserFilter = () => {
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('userId');
        newParams.delete('userName');
        setSearchParams(newParams);
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') fetchOrders(1, searchTerm);
    };

    const goToPage = (page: number) => {
        if (page >= 1 && page <= pagination.totalPages) fetchOrders(page, searchTerm);
    };

    const handleSync = async (e: React.MouseEvent, id: number) => {
        e.preventDefault();
        e.stopPropagation();
        if (!confirm('Mark this order as Pending for Tally sync?')) return;
        try {
            await syncOrderToTally(id);
            alert('Order marked as Pending for Tally!');
            fetchOrders(pagination.page, searchTerm);
        } catch (error) {
            console.error('Failed to sync order', error);
            alert('Failed to sync order');
        }
    };

    const handleDelete = async (e: React.MouseEvent, id: number) => {
        e.preventDefault();
        if (!confirm('Are you sure you want to delete this order?')) return;
        try {
            await deleteOrder(id);
            fetchOrders(pagination.page, searchTerm);
        } catch (error) {
            console.error('Failed to delete order', error);
            alert('Failed to delete order');
        }
    };

    return (
        <div className="flex flex-col h-full min-h-screen pb-20" style={{ background: cream }}>
            {/* Header */}
            <div
                className="px-4 py-2.5 sticky top-0 z-20 space-y-2.5"
                style={{
                    background: 'rgba(253,248,243,0.97)',
                    backdropFilter: 'blur(12px)',
                    borderBottom: '1px solid rgba(184,128,74,0.15)',
                    boxShadow: '0 2px 12px rgba(184,128,74,0.06)',
                }}
            >
                {/* Row 1: Logo + Title + Logout */}
                <div className="flex justify-between items-center gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                        <img src="/ppw-logo.png" alt="Logo" className="w-8 h-8 object-contain flex-shrink-0" />
                        <h1 className="text-lg font-extrabold tracking-tight truncate" style={{ color: '#2c1e0f' }}>Day Book</h1>
                    </div>
                    <button
                        onClick={() => {
                            if (confirm('Are you sure you want to log out?')) {
                                localStorage.removeItem('token');
                                localStorage.removeItem('user');
                                window.location.href = '/admin/login';
                            }
                        }}
                        className="w-9 h-9 flex items-center justify-center rounded-xl transition-all active:scale-90 flex-shrink-0"
                        style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.15)', color: '#ef4444' }}
                    >
                        <LogOut size={18} />
                    </button>
                </div>

                {/* Row 2: Filter + Date + Count */}
                <div className="flex items-center gap-2">
                    <div className="relative flex-shrink-0">
                        <select
                            className="appearance-none text-[11px] font-black pl-3 pr-8 py-2 rounded-xl outline-none uppercase tracking-tight"
                            style={{
                                background: 'rgba(184,128,74,0.08)',
                                border: '1px solid rgba(184,128,74,0.2)',
                                color: copper,
                            }}
                            value={JSON.stringify(activeFilter)}
                            onChange={(e) => {
                                try {
                                    const val = JSON.parse(e.target.value);
                                    handleFilterChange(val);
                                } catch (e) {
                                    console.error('Failed to parse filter value', e);
                                }
                            }}
                        >
                            {ORDER_FILTERS.map(f => (
                                <option key={`${f.category}-${f.value}`} value={JSON.stringify({ value: f.value, category: f.category })}>
                                    {f.label}
                                </option>
                            ))}
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: copper }}>
                            <ChevronDown size={14} />
                        </div>
                    </div>

                    {isAdmin && (
                        <div
                            className="flex items-center rounded-xl px-2 py-1.5 gap-2 flex-1 min-w-0"
                            style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(184,128,74,0.15)' }}
                        >
                            <button
                                onClick={() => {
                                    const d = new Date();
                                    const istOffset = 5.5 * 60 * 60 * 1000;
                                    const istTime = new Date(d.getTime() + istOffset);
                                    const today = `${istTime.getUTCFullYear()}-${String(istTime.getUTCMonth() + 1).padStart(2, '0')}-${String(istTime.getUTCDate()).padStart(2, '0')}`;
                                    updateDate(today);
                                }}
                                className="text-[10px] font-black px-2 py-1 rounded-lg uppercase flex-shrink-0 transition-colors"
                                style={{ color: copper, background: 'rgba(184,128,74,0.1)', border: '1px solid rgba(184,128,74,0.2)' }}
                            >
                                Today
                            </button>
                            <label className="flex items-center flex-1 min-w-0 pr-1 gap-1.5 cursor-pointer relative overflow-hidden">
                                <Calendar size={14} style={{ color: '#8d5838', opacity: 0.8 }} className="flex-shrink-0" />
                                <input
                                    type="date"
                                    className="bg-transparent text-[12px] font-bold outline-none w-full cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                                    style={{ color: '#2c1e0f' }}
                                    value={selectedDate}
                                    onChange={(e) => updateDate(e.target.value)}
                                />
                                {selectedDate && (
                                    <button
                                        onClick={(e) => { e.preventDefault(); updateDate(''); }}
                                        className="ml-1 p-1 rounded-full transition-colors flex-shrink-0 relative z-10"
                                        style={{ color: '#a8a29e' }}
                                    >
                                        <X size={12} />
                                    </button>
                                )}
                            </label>
                        </div>
                    )}

                    <div
                        className="rounded-xl flex-shrink-0 flex items-center gap-1.5 px-3 py-2"
                        style={{ background: '#2c1e0f', boxShadow: '0 2px 8px rgba(44,30,15,0.2)' }}
                    >
                        <span className="text-sm font-black tracking-tighter text-white">{pagination.total}</span>
                        <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.5)' }}>Bills</span>
                    </div>
                </div>

                {/* Row 3: Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={16} style={{ color: copper, opacity: 0.5 }} />
                    <input
                        type="text"
                        className="w-full search-input pr-3 py-2.5 rounded-xl text-xs font-semibold outline-none transition-all"
                        style={{
                            background: parchment,
                            border: '1.2px solid rgba(184,128,74,0.18)',
                            color: '#2c1e0f',
                        }}
                        placeholder="Search Bill or Customer..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyDown={handleKeyPress}
                    />
                </div>

                {/* Staff Filter Chip */}
                {userId && (
                    <div
                        className="flex items-center gap-2 px-3 py-2 rounded-xl"
                        style={{ background: 'rgba(184,128,74,0.07)', border: '1px solid rgba(184,128,74,0.18)' }}
                    >
                        <UserIcon size={14} style={{ color: copper }} />
                        <span className="text-[10px] font-black uppercase tracking-tight" style={{ color: copper }}>
                            Viewing: {userName || 'Selected User'}
                        </span>
                        <button
                            onClick={clearUserFilter}
                            className="ml-auto p-1 rounded-full"
                            style={{ background: 'rgba(255,255,255,0.8)', color: '#a8a29e' }}
                        >
                            <X size={12} />
                        </button>
                    </div>
                )}
            </div>

            {/* List */}
            <div className="p-2 space-y-1.5 flex-1">
                {loading ? (
                    <div className="flex justify-center py-10">
                        <Loader className="animate-spin" style={{ color: copper }} />
                    </div>
                ) : orders.length === 0 ? (
                    <div className="text-center py-10 text-sm font-bold" style={{ color: '#a8a29e' }}>No orders found.</div>
                ) : (
                    orders.map(order => (
                        <Link
                            to={order.status === 'inedit' ? `/orders/edit/${order.id}` : `/orders/${order.id}`}
                            key={order.id}
                            className="block rounded-2xl p-2.5 active:scale-[0.99] transition-all group relative"
                            style={{
                                background: 'rgba(255,255,255,0.78)',
                                backdropFilter: 'blur(12px)',
                                border: '1px solid rgba(184,128,74,0.14)',
                                boxShadow: '0 2px 6px rgba(184,128,74,0.04)',
                            }}
                        >
                            <div className="flex justify-between items-start">
                                {/* Left */}
                                <div className="min-w-0 flex-1 pr-2">
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                        <h3 className="font-bold text-sm truncate" style={{ color: '#2c1e0f' }}>
                                            {order.ledger?.name || 'Unknown Customer'}
                                        </h3>
                                        {order.status === 'pending' && (
                                            <span
                                                className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide flex-shrink-0"
                                                style={{ color: copper, background: 'rgba(184,128,74,0.1)' }}
                                            >Pending</span>
                                        )}
                                        {order.status === 'fetched' && (
                                            <span
                                                className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide flex-shrink-0"
                                                style={{ color: '#22c55e', background: 'rgba(34,197,94,0.1)' }}
                                            >Synced</span>
                                        )}
                                        <span
                                            className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide flex-shrink-0"
                                            style={{ color: copperDark, background: 'rgba(184,128,74,0.08)', border: '1px solid rgba(184,128,74,0.15)' }}
                                        >
                                            {order.order_type || 'Tax Invoice'}
                                        </span>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs" style={{ color: '#8c7a68' }}>
                                        <span
                                            className="flex items-center gap-1 font-medium px-1.5 py-0.5 rounded"
                                            style={{ background: 'rgba(184,128,74,0.06)' }}
                                        >
                                            <FileText size={10} style={{ color: '#a8a29e' }} />
                                            <span className="truncate max-w-[80px]">{order.bill_number || '-'}</span>
                                        </span>
                                        <span
                                            className="flex items-center gap-1 font-medium px-1.5 py-0.5 rounded"
                                            style={{ background: 'rgba(184,128,74,0.06)' }}
                                        >
                                            <Calendar size={10} style={{ color: '#a8a29e' }} />
                                            {new Date(order.date).toLocaleDateString()}
                                        </span>
                                        {order.creator && (
                                            <span className="text-[10px] font-semibold" style={{ color: '#a8a29e' }}>
                                                By {order.creator.username}
                                            </span>
                                        )}
                                        {order.processor && (
                                            <span
                                                className="text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-tight flex items-center gap-1"
                                                style={{ color: '#2c1e0f', background: 'rgba(184,128,74,0.12)', border: '1px solid rgba(184,128,74,0.2)' }}
                                            >
                                                Approved: {order.processor.name}
                                                {order.processed_at && (
                                                    <span className="opacity-60 ml-0.5" style={{ color: copperDark }}>
                                                        at {new Date(order.processed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' } as any)}
                                                    </span>
                                                )}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Right */}
                                <div className="text-right flex-shrink-0">
                                    <div className="text-base font-black tracking-tight leading-none" style={{ color: '#2c1e0f' }}>
                                        ₹{Math.round(parseFloat(order.total_amount)).toLocaleString('en-IN')}
                                    </div>
                                    <div className="flex items-center justify-end gap-1.5 mt-1">
                                        {order.status === 'inedit' && (
                                            <div className="flex gap-1">
                                                <button
                                                    onClick={(e) => handleSync(e, order.id)}
                                                    className="p-1 rounded transition-colors flex items-center gap-1"
                                                    style={{ color: '#a8a29e', border: '1px solid rgba(184,128,74,0.12)' }}
                                                >
                                                    <ArrowRight size={14} className="rotate-[-45deg]" />
                                                    <span className="text-[10px] font-bold uppercase pr-1">Sync</span>
                                                </button>
                                                <button
                                                    onClick={(e) => handleDelete(e, order.id)}
                                                    className="p-1 rounded transition-colors"
                                                    style={{ color: '#a8a29e', border: '1px solid rgba(184,128,74,0.12)' }}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        )}
                                        <span className="p-1 transition-colors" style={{ color: 'rgba(184,128,74,0.4)' }}>
                                            <ArrowRight size={16} strokeWidth={2.5} />
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ))
                )}
            </div>

            {/* Pagination */}
            {!loading && pagination.totalPages > 1 && (
                <div className="fixed bottom-16 left-0 right-0 z-10 flex justify-center">
                    <div
                        className="w-full max-w-md p-2 px-4 flex items-center justify-between"
                        style={{
                            background: 'rgba(253,248,243,0.97)',
                            backdropFilter: 'blur(12px)',
                            borderTop: '1px solid rgba(184,128,74,0.15)',
                        }}
                    >
                        <span className="text-xs font-bold" style={{ color: '#8c7a68' }}>
                            Page {pagination.page} of {pagination.totalPages}
                        </span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => goToPage(pagination.page - 1)}
                                disabled={pagination.page <= 1}
                                className="px-3 py-1.5 rounded text-xs font-bold transition-colors disabled:opacity-50"
                                style={{ background: 'rgba(184,128,74,0.08)', color: '#8c7a68', border: '1px solid rgba(184,128,74,0.15)' }}
                            >
                                Previous
                            </button>
                            <button
                                onClick={() => goToPage(pagination.page + 1)}
                                disabled={pagination.page >= pagination.totalPages}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 text-white"
                                style={{ background: `linear-gradient(145deg, ${copper}, ${copperDark})`, boxShadow: '0 2px 8px rgba(184,128,74,0.25)' }}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
