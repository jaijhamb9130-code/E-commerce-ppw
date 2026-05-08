import { useState, useEffect } from 'react';
import {
    Globe, Search, ArrowRight, Calendar, ShoppingCart,
    ChevronDown, CheckCircle2, Clock,
    ChevronLeft, Edit3, Save, X, RefreshCw
} from 'lucide-react';
import {
    getOrders, getOrderById, getOrderDetails,
    updateOrderItemStatus, editOrderItem, finalizeOrder, syncOnlineOrders
} from '../api';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext';

const copper = '#b8804a';
const copperDark = '#9a6a3c';
const cream = '#f7f0e8';

type ViewType = 'pending' | 'completed';

export default function OnlineOrder() {
    const navigate = useNavigate();
    const { showToast } = useToast();

    const [view, setView] = useState<ViewType>('pending');

    // Initial date: Today in IST (YYYY-MM-DD)
    const [selectedDate, setSelectedDate] = useState<string>(() => {
        const d = new Date();
        const istOffset = 5.5 * 60 * 60 * 1000;
        const istTime = new Date(d.getTime() + istOffset);
        return `${istTime.getUTCFullYear()}-${String(istTime.getUTCMonth() + 1).padStart(2, '0')}-${String(istTime.getUTCDate()).padStart(2, '0')}`;
    });

    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showDropdown, setShowDropdown] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
    const [items, setItems] = useState<any[]>([]);
    const [selectedItemIds, setSelectedItemIds] = useState<number[]>([]);
    const [isActionLoading, setIsActionLoading] = useState(false);

    const [editingItem, setEditingItem] = useState<any | null>(null);
    const [editForm, setEditForm] = useState({ quantity: 0, rate: 0, discount: 0 });

    useEffect(() => {
        if (!selectedOrder) {
            fetchOrders();
        }
    }, [view, selectedOrder, selectedDate]);

    useEffect(() => {
        if (selectedOrder) return;
        const timer = setTimeout(() => {
            fetchOrders();
        }, 400);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const statusFilter = view === 'pending' ? 'pending' : 'completed,fetched';
            const data = await getOrders(1, 100, searchQuery, undefined, undefined, selectedDate, undefined, statusFilter, 'online');

            const filtered = data.data.filter((o: any) => {
                if (view === 'completed') return o.status === 'completed' || o.status === 'fetched';
                return o.status === 'pending' || !o.status;
            });
            setOrders(filtered);
        } catch (e) {
            console.error('Failed to fetch orders', e);
        } finally {
            setLoading(false);
        }
    };

    const handleOrderClick = async (order: any) => {
        setLoading(true);
        try {
            const fullOrder = await getOrderById(order.id);
            const details = await getOrderDetails(order.id);
            setSelectedOrder(fullOrder);
            setItems(details);
            setSelectedItemIds([]);
        } catch (e) {
            console.error('Failed to fetch order details', e);
        } finally {
            setLoading(false);
        }
    };

    const handleBulkStatus = async (status: 'approved' | 'rejected') => {
        if (selectedItemIds.length === 0) return;
        setIsActionLoading(true);
        try {
            await updateOrderItemStatus(selectedItemIds, status);
            if (selectedOrder) {
                const updatedDetails = await getOrderDetails(selectedOrder.id);
                setItems(updatedDetails);
            }
            setSelectedItemIds([]);
            const count = selectedItemIds.length;
            showToast(`${count} item${count > 1 ? 's' : ''} ${status}`, status === 'approved' ? 'success' : 'warning');
        } catch (e) {
            showToast('Failed to update item status', 'error');
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleEditSave = async () => {
        if (!editingItem || !selectedOrder) return;
        setIsActionLoading(true);
        try {
            await editOrderItem(editingItem.id, {
                quantity: editForm.quantity,
                rate: editForm.rate,
                discount_percentage: editForm.discount
            });
            const updatedDetails = await getOrderDetails(selectedOrder.id);
            const updatedOrder = await getOrderById(selectedOrder.id);
            setItems(updatedDetails);
            setSelectedOrder(updatedOrder);
            setEditingItem(null);
            showToast('Item updated successfully', 'success');
        } catch (e: any) {
            showToast(e.response?.data?.message || 'Error saving changes', 'error');
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleFinalize = async () => {
        if (!selectedOrder) return;
        const hasPending = items.some(i => i.status === 'pending');
        if (hasPending) {
            showToast('Changes saved', 'success');
            setSelectedOrder(null);
            return;
        }
        setIsActionLoading(true);
        try {
            await finalizeOrder(selectedOrder.id);
            showToast('Order completed successfully', 'success');
            setSelectedOrder(null);
        } catch (e: any) {
            showToast(e.response?.data?.message || 'Failed to finalize order', 'error');
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleGlobalSync = async () => {
        setIsActionLoading(true);
        try {
            await syncOnlineOrders();
            await fetchOrders();
            showToast('All orders synced with Tally', 'success');
        } catch (e) {
            showToast('Sync failed. Check backend connectivity.', 'error');
        } finally {
            setIsActionLoading(false);
        }
    };

    const toggleSelection = (id: number) => {
        setSelectedItemIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const isOrderEditable = selectedOrder?.status === 'pending';

    return (
        <div className="min-h-screen pb-20" style={{ background: cream }}>
            <div
                className="sticky top-0 z-40 px-4 pt-3 pb-3"
                style={{
                    background: 'rgba(253,248,243,0.95)',
                    backdropFilter: 'blur(10px)',
                    borderBottom: '1px solid rgba(184,128,74,0.1)'
                }}
            >
                <div className="flex items-center justify-between gap-3 mb-2.5">
                    <div className="relative flex-shrink-0">
                        <button
                            onClick={() => setShowDropdown(!showDropdown)}
                            className="flex items-center gap-3 pr-4 rounded-[16px] transition-all h-[42px]"
                            style={{
                                background: '#fff',
                                border: '1px solid rgba(184,128,74,0.12)',
                                boxShadow: '0 2px 8px rgba(184,128,74,0.04)'
                            }}
                        >
                            <div
                                className="w-8 h-8 rounded-[12px] flex items-center justify-center flex-shrink-0 ml-1"
                                style={{
                                    background: 'rgba(184,128,74,0.7)',
                                    color: '#fff',
                                }}
                            >
                                {view === 'pending' ? <Clock size={16} /> : <CheckCircle2 size={16} />}
                            </div>
                            <div className="flex flex-col items-start leading-tight">
                                <span className="text-[11.5px] font-black uppercase tracking-wider" style={{ color: '#2c1e0f' }}>
                                    {view === 'pending' ? 'Pending' : 'Completed'}
                                </span>
                                <span className="text-[8px] font-bold uppercase tracking-widest opacity-60 text-[#2c1e0f]">Orders</span>
                            </div>
                            <ChevronDown size={14} className={`ml-2 transition-transform ${showDropdown ? 'rotate-180' : ''}`} style={{ color: copper }} />
                        </button>

                        {showDropdown && (
                            <div
                                className="absolute left-0 mt-2 w-48 rounded-2xl overflow-hidden py-1 z-50 px-1"
                                style={{
                                    background: '#fff',
                                    border: '1px solid rgba(184,128,74,0.15)',
                                    boxShadow: '0 12px 32px rgba(44,30,15,0.15)',
                                }}
                            >
                                <button
                                    onClick={() => { setView('pending'); setShowDropdown(false); setSelectedOrder(null); }}
                                    className="w-full text-left px-4 py-3 text-[10px] font-black flex items-center gap-2.5 transition-colors rounded-xl"
                                    style={{
                                        color: view === 'pending' ? copper : '#8c7a68',
                                        background: view === 'pending' ? 'rgba(184,128,74,0.06)' : 'transparent',
                                    }}
                                >
                                    <Clock size={14} /> PENDING
                                </button>
                                <button
                                    onClick={() => { setView('completed'); setShowDropdown(false); setSelectedOrder(null); }}
                                    className="w-full text-left px-4 py-3 text-[10px] font-black flex items-center gap-2.5 transition-colors rounded-xl"
                                    style={{
                                        color: view === 'completed' ? copper : '#8c7a68',
                                        background: view === 'completed' ? 'rgba(184,128,74,0.06)' : 'transparent',
                                    }}
                                >
                                    <CheckCircle2 size={14} /> COMPLETED
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-2.5 flex-shrink-0">
                        {view === 'completed' && !selectedOrder && (() => {
                            const hasUnsynced = orders.some(o => o.status === 'completed');
                            return (
                                <button
                                    onClick={hasUnsynced ? handleGlobalSync : undefined}
                                    disabled={isActionLoading || !hasUnsynced}
                                    className="h-[38px] px-4 rounded-[14px] font-black text-[10px] uppercase tracking-[0.2em] transition-all flex items-center gap-2"
                                    style={{
                                        background: hasUnsynced ? 'rgba(34,197,94,0.22)' : 'rgba(34,197,94,0.06)',
                                        color: hasUnsynced ? '#166534' : '#a8a29e',
                                        border: '1px solid rgba(34,197,94,0.1)',
                                        opacity: hasUnsynced ? 1 : 0.4,
                                        filter: hasUnsynced ? 'none' : 'blur(0.5px)',
                                        pointerEvents: hasUnsynced ? 'auto' : 'none',
                                    }}
                                >
                                    <RefreshCw size={14} className={isActionLoading ? 'animate-spin' : ''} />
                                    SYNC
                                </button>
                            );
                        })()}
                        <button
                            onClick={() => selectedOrder ? setSelectedOrder(null) : navigate('/')}
                            className="w-[42px] h-[42px] rounded-[14px] active:scale-95 transition-all flex items-center justify-center"
                            style={{
                                background: '#fff',
                                border: '1px solid rgba(184,128,74,0.1)',
                                color: copper,
                            }}
                        >
                            <ChevronLeft size={24} />
                        </button>
                    </div>
                </div>

                {!selectedOrder && (
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            placeholder="Search customer, ID or phone..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="flex-1 min-w-0 px-3 h-[36px] rounded-xl text-[13px] font-semibold outline-none transition-all"
                            style={{
                                background: '#fff',
                                color: '#2c1e0f',
                                border: '1px solid rgba(184,128,74,0.15)',
                            }}
                        />
                        <label
                            className="h-[36px] px-2.5 rounded-xl flex items-center gap-1.5 cursor-pointer flex-shrink-0 relative overflow-hidden"
                            style={{ background: '#fff', color: '#2c1e0f', border: '1px solid rgba(184,128,74,0.15)', width: '160px' }}
                        >
                            <Calendar size={14} style={{ color: '#8d5838', opacity: 0.8 }} className="flex-shrink-0" />
                            <input
                                type="date"
                                className="bg-transparent outline-none text-[12px] font-bold cursor-pointer flex-1 min-w-0 [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                            />
                        </label>
                    </div>
                )}
            </div>

            <div className="p-4 max-w-2xl mx-auto">
                {!selectedOrder ? (
                    <div className="space-y-3">
                        {loading ? (
                            [...Array(4)].map((_, i) => (
                                <div
                                    key={i}
                                    className="h-[76px] rounded-[20px] animate-pulse"
                                    style={{ background: '#fff', border: '1px solid rgba(184,128,74,0.08)' }}
                                />
                            ))
                        ) : orders.length > 0 ? (
                            orders.map((order) => (
                                <div
                                    key={order.id}
                                    onClick={() => handleOrderClick(order)}
                                    className="px-4 py-4 rounded-[22px] transition-all flex justify-between items-center cursor-pointer active:scale-[0.98] shadow-sm"
                                    style={{
                                        background: '#fff',
                                        border: '1px solid rgba(184,128,74,0.12)',
                                    }}
                                >
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <span
                                                className="text-[10px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider"
                                                style={{ color: '#8d5838', background: 'rgba(184,128,74,0.06)', border: '1px solid rgba(184,128,74,0.15)' }}
                                            >
                                                #ORD-{order.id}
                                            </span>
                                            <StatusBadge status={order.status} />
                                        </div>
                                        <h3 className="font-black text-[14.5px] uppercase truncate tracking-tight" style={{ color: '#2c1e0f' }}>
                                            {order.customer_name || 'Customer'}
                                        </h3>
                                        <div className="flex items-center gap-4 mt-2 font-bold text-[10.5px] uppercase tracking-wider" style={{ color: '#57534e' }}>
                                            <span className="flex items-center gap-1.5"><Calendar size={12} className="opacity-70 text-[#8d5838]" /> {new Date(order.date).toLocaleDateString()}</span>
                                            <span className="flex items-center gap-1.5"><Globe size={12} className="opacity-70 text-[#8d5838]" /> Online</span>
                                        </div>
                                    </div>
                                    <div className="text-right flex-shrink-0 ml-4">
                                        <p className="text-[14px] font-black" style={{ color: '#2c1e0f' }}>₹{Math.round(order.total_amount).toLocaleString()}</p>
                                        <p className="text-[8px] font-black uppercase mt-1 flex items-center gap-1 justify-end tracking-widest" style={{ color: copper }}>
                                            Manage <ArrowRight size={10} className="inline opacity-60" />
                                        </p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-20 flex flex-col items-center">
                                <ShoppingCart size={48} className="mb-6 opacity-10" style={{ color: copper }} />
                                <h3 className="font-black text-sm uppercase tracking-widest text-[#2c1e0f]">No {view} orders</h3>
                                <p className="text-[10px] uppercase font-bold tracking-[0.15em] mt-2 text-[#a8a29e]">
                                    Nothing found for {selectedDate}
                                </p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="max-w-xl mx-auto">
                            <div className="px-4 mb-4 pb-4 flex justify-between items-end border-b border-[rgba(184,128,74,0.1)]">
                                <div className="min-w-0">
                                    <p className="text-[10px] font-black uppercase tracking-widest mb-1.5 opacity-60 text-[#2c1e0f]">Order Details</p>
                                    <h2 className="text-xl font-black uppercase leading-none truncate tracking-tight text-[#2c1e0f]">{selectedOrder.customer_name}</h2>
                                    <p className="text-[12px] font-bold mt-2 text-[#6d5c4a]">{selectedOrder.customer_phone}</p>
                                </div>
                                <div className="text-right flex-shrink-0 ml-4">
                                    <p className="text-[10px] font-black uppercase tracking-widest mb-1.5 opacity-60 text-[#2c1e0f]">Total</p>
                                    <p className="text-xl font-black" style={{ color: copper }}>₹{Math.round(selectedOrder.total_amount).toLocaleString()}</p>
                                </div>
                            </div>

                            <div className="px-3 space-y-1.5">
                                {items.map((item) => (
                                    <div key={item.id} className="bg-white rounded-[14px] border border-[rgba(184,128,74,0.12)] py-2.5 px-3 shadow-sm">
                                        <div className="flex items-center gap-3 mb-1 h-7">
                                            {isOrderEditable && item.status === 'pending' && (
                                                <div className="flex-shrink-0 flex items-center justify-center w-5">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedItemIds.includes(item.id)}
                                                        onChange={() => toggleSelection(item.id)}
                                                        className="w-4 h-4 rounded cursor-pointer accent-copper border-[rgba(184,128,74,0.3)]"
                                                    />
                                                </div>
                                            )}
                                            <div className="flex-1 flex justify-between items-center min-w-0 h-full">
                                                <h5 className="font-black text-[13px] uppercase text-[#2c1e0f] leading-none truncate tracking-tight pr-4">
                                                    {item.item_name}
                                                </h5>
                                                <div className="flex-shrink-0 w-[85px] flex justify-end">
                                                    <ItemStatusBadge status={item.status} />
                                                </div>
                                            </div>
                                        </div>

                                        <div className={`flex items-center justify-between h-6 ${isOrderEditable && item.status === 'pending' ? 'pl-8' : ''}`}>
                                            <div className="flex items-center gap-2 text-[10.5px] font-black leading-none">
                                                <span className="bg-[rgba(184,128,74,0.06)] px-1.5 py-0.5 rounded-md text-[#8d5838] border border-[rgba(184,128,74,0.1)]">{item.quantity}{item.unit}</span>
                                                <span className="opacity-30 text-[#2c1e0f]">@</span>
                                                <span className="text-[#6d5c4a]">₹{Number(item.rate).toFixed(0)}</span>
                                            </div>

                                            <div className="flex items-center justify-end w-[85px] gap-3">
                                                <span className="text-[12px] font-black text-[#2c1e0f] leading-none whitespace-nowrap">
                                                    ₹{Math.round(item.amount).toLocaleString()}
                                                </span>
                                                {isOrderEditable && item.status === 'pending' && (
                                                    <button
                                                        onClick={() => {
                                                            setEditingItem(item);
                                                            setEditForm({ quantity: item.quantity, rate: item.rate, discount: item.discount_percentage });
                                                        }}
                                                        className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-[#b8804a] leading-none"
                                                    >
                                                        <Edit3 size={11} className="opacity-70" /> EDIT
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {(item.status === 'approved' || item.status === 'rejected') && (item.processor || item.processed_at) && (
                                            <div className={`text-[8px] font-bold uppercase tracking-widest opacity-25 text-[#2c1e0f] mt-1.5 leading-none ${isOrderEditable && item.status === 'pending' ? 'pl-8' : ''}`}>
                                                {item.status} BY {item.processor?.name || item.processor?.username || 'SYSTEM'}
                                                {item.processed_at && ` · ${new Date(item.processed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' } as any)}`}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {isOrderEditable && selectedItemIds.length === 0 && (
                                <div className="px-4 mt-8">
                                    <button
                                        onClick={handleFinalize}
                                        disabled={isActionLoading}
                                        className="w-full py-4 rounded-[20px] font-black text-[11px] uppercase tracking-[0.3em] text-white shadow-xl flex items-center justify-center gap-3 transition-transform active:scale-95"
                                        style={{ background: `linear-gradient(145deg, ${copper}, ${copperDark})` }}
                                    >
                                        {isActionLoading ? <RefreshCw className="animate-spin" size={14} /> : <Save size={14} />}
                                        {!items.some(i => i.status === 'pending') && items.length > 0 ? 'COMPLETE ORDER' : 'SAVE CHANGES'}
                                    </button>
                                </div>
                            )}

                            {selectedItemIds.length > 0 && (
                                <div className="fixed bottom-20 left-4 right-4 z-50 p-4 bg-[#2c1e0f] rounded-3xl flex items-center justify-between shadow-2xl animate-in slide-in-from-bottom-5">
                                    <span className="text-white text-[10px] font-black uppercase tracking-widest pl-2">{selectedItemIds.length} SELECTED</span>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleBulkStatus('rejected')} className="px-5 py-2.5 rounded-xl bg-red-500/10 text-red-500 font-black text-[10px] uppercase">Reject</button>
                                        <button onClick={() => handleBulkStatus('approved')} className="px-5 py-2.5 rounded-xl bg-copper text-white font-black text-[10px] uppercase">Approve</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {editingItem && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm">
                    <div className="w-full max-w-sm rounded-[32px] p-8 bg-white shadow-2xl">
                        <div className="flex justify-between mb-8">
                            <h3 className="text-lg font-black uppercase text-[#2c1e0f]">Edit Item</h3>
                            <button onClick={() => setEditingItem(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                        </div>
                        <div className="space-y-6">
                            <MetricInput label="Quantity" value={editForm.quantity} onChange={(v) => setEditForm({ ...editForm, quantity: v })} />
                            <div className="grid grid-cols-2 gap-4">
                                <MetricInput label="Rate" value={editForm.rate} onChange={(v) => setEditForm({ ...editForm, rate: v })} />
                                <MetricInput label="Disc %" value={editForm.discount} onChange={(v) => setEditForm({ ...editForm, discount: v })} />
                            </div>
                        </div>
                        <button onClick={handleEditSave} className="w-full mt-10 py-4 rounded-2xl font-black text-white" style={{ background: copper }}>APPLY</button>
                    </div>
                </div>
            )}
        </div>
    );
}

function MetricInput({ label, value, onChange }: { label: string, value: number, onChange: (v: number) => void }) {
    return (
        <div>
            <label className="text-[9px] font-black uppercase tracking-[0.1em] mb-2 block opacity-40 text-[#2c1e0f]">{label}</label>
            <input
                type="text"
                value={value}
                onChange={(e) => {
                    const val = e.target.value;
                    if (/^\d*\.?\d*$/.test(val)) onChange(val === '' ? 0 : Number(val));
                }}
                className="w-full px-5 py-4 rounded-xl font-black text-[13px] bg-[#fdfaf7] border border-[rgba(184,128,74,0.15)] text-[#2c1e0f] outline-none"
            />
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    if (status === 'pending' || !status)
        return <span className="text-[8px] font-black uppercase tracking-[0.15em] px-2 py-0.5 rounded-md" style={{ color: '#b8804a', background: 'rgba(184,128,74,0.06)', border: '1px solid rgba(184,128,74,0.1)' }}>Pending</span>;
    if (status === 'completed')
        return <span className="text-[8px] font-black uppercase tracking-[0.15em] px-2 py-0.5 rounded-md" style={{ color: '#10b981', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.1)' }}>Completed</span>;
    if (status === 'fetched')
        return <span className="text-[8px] font-black uppercase tracking-[0.15em] px-2 py-0.5 rounded-md" style={{ color: '#10b981', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.1)' }}>Synced</span>;
    return null;
}

function ItemStatusBadge({ status }: { status: string }) {
    if (status === 'pending' || !status)
        return <span className="text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-lg" style={{ color: copper, border: '1px solid rgba(184,128,74,0.2)', background: 'rgba(184,128,74,0.04)' }}>Pending</span>;
    if (status === 'approved')
        return <span className="text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-lg" style={{ color: '#10b981', border: '1px solid rgba(16,185,129,0.2)', background: 'rgba(16,185,129,0.04)' }}>Approved</span>;
    if (status === 'rejected')
        return <span className="text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-lg" style={{ color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.04)' }}>Rejected</span>;
    return null;
}
