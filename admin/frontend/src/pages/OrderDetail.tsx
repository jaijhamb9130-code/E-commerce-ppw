import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getOrderById, getOrderDetails, deleteOrder, syncOrderToTally } from '../api';
import { ChevronLeft, User, Trash2, Share2, CheckCircle2, Edit, MessageSquare, X } from 'lucide-react';

const copper = '#b8804a';
const copperDark = '#9a6a3c';
const parchment = '#fdf8f3';
const cream = '#f7f0e8';

interface Order {
    id: number;
    bill_number: string;
    date: string;
    total_amount: string;
    ledger?: {
        name: string;
        tally_guid?: string;
        address?: string;
        phone_number?: string;
        gstin?: string;
    };
    status: 'inedit' | 'pending' | 'fetched';
    customer_name?: string;
    customer_address?: string;
    customer_phone?: string;
    customer_gstin?: string;
    order_type?: string;
    processor?: { name: string };
    remark?: string;
    amount_given?: string | number;
}

interface OrderDetail {
    id: number;
    stock_item: {
        name: string;
        default_mrp?: string;
    };
    item_name?: string;
    quantity: string;
    unit: string;
    rate: string;
    amount: string;
    gst: string;
    selected_scheme: string;
    discount_percentage: string;
    livestock_type?: string;
}

export default function OrderDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [order, setOrder] = useState<Order | null>(null);
    const [items, setItems] = useState<OrderDetail[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [showRemark, setShowRemark] = useState(false);
    const [showSettlementPopup, setShowSettlementPopup] = useState(false);
    const [selectedItemForDetail, setSelectedItemForDetail] = useState<OrderDetail | null>(null);

    useEffect(() => {
        if (id) loadOrder(parseInt(id));
    }, [id]);

    const loadOrder = async (orderId: number) => {
        setLoading(true);
        try {
            const [orderData, detailsData] = await Promise.all([
                getOrderById(orderId),
                getOrderDetails(orderId)
            ]);
            setOrder(orderData);
            setItems(detailsData);
        } catch (error) {
            console.error('Failed to load order', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (window.confirm('Are you sure you want to delete this order?')) {
            try {
                if (order) {
                    await deleteOrder(order.id);
                    navigate('/orders');
                }
            } catch (error) {
                console.error('Failed to delete order', error);
                alert('Failed to delete order');
            }
        }
    };

    const handleSyncTally = async () => {
        if (!order) return;
        setSyncing(true);
        try {
            const result = await syncOrderToTally(order.id);
            if (result.success) {
                setOrder(prev => prev ? { ...prev, status: 'pending', ...result.data } : null);
                alert(`Synced! Status: Pending`);
            }
        } catch (error) {
            console.error('Failed to sync', error);
            alert('Failed to sync with Tally');
        } finally {
            setSyncing(false);
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-screen" style={{ background: cream }}>
            <p className="text-sm font-bold" style={{ color: copper }}>Loading details...</p>
        </div>
    );
    if (!order) return (
        <div className="flex items-center justify-center min-h-screen" style={{ background: cream }}>
            <p className="text-sm font-bold" style={{ color: '#8c7a68' }}>Order not found.</p>
        </div>
    );

    const isLocked = order.status !== 'inedit';

    return (
        <div className="flex flex-col h-full min-h-screen relative" style={{ background: cream }}>
            {/* Header */}
            <div
                className="px-3 py-1.5 sticky top-0 z-20 flex items-center gap-2"
                style={{
                    background: 'rgba(253,248,243,0.97)',
                    backdropFilter: 'blur(12px)',
                    borderBottom: '1px solid rgba(184,128,74,0.15)',
                    boxShadow: '0 2px 8px rgba(184,128,74,0.06)',
                }}
            >
                <button
                    onClick={() => navigate(-1)}
                    className="flex-shrink-0 p-1 rounded-lg -ml-1 transition-colors"
                    style={{ color: copper }}
                >
                    <ChevronLeft size={20} />
                </button>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                        <h1 className="text-sm font-bold leading-none truncate" style={{ color: '#2c1e0f' }}>
                            Order #{order.bill_number || order.id}
                        </h1>
                        <span
                            className="flex-shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase"
                            style={{ color: copper, background: 'rgba(184,128,74,0.1)', border: '1px solid rgba(184,128,74,0.2)' }}
                        >
                            {order.order_type || 'Tax Invoice'}
                        </span>
                    </div>
                    <span className="text-[10px] font-medium" style={{ color: '#8c7a68' }}>
                        {new Date(order.date).toLocaleDateString()}
                    </span>
                </div>
                {order.status === 'fetched' ? (
                    <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 flex-shrink-0"
                        style={{ color: '#22c55e', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}
                    >
                        <CheckCircle2 size={10} /> Synced
                    </span>
                ) : order.status === 'pending' ? (
                    <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 flex-shrink-0"
                        style={{ color: copper, background: 'rgba(184,128,74,0.1)', border: '1px solid rgba(184,128,74,0.2)' }}
                    >
                        <Share2 size={10} /> Pending
                    </span>
                ) : (
                    <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 flex-shrink-0"
                        style={{ color: '#8c7a68', background: 'rgba(184,128,74,0.06)', border: '1px solid rgba(184,128,74,0.15)' }}
                    >
                        <Edit size={10} /> Draft
                    </span>
                )}
                {order.processor && (
                    <div className="flex flex-col items-end ml-1">
                        <span className="text-[7px] font-black uppercase tracking-widest" style={{ color: '#a8a29e' }}>Finalized By</span>
                        <span className="text-[10px] font-black uppercase" style={{ color: copperDark }}>{order.processor.name}</span>
                    </div>
                )}
            </div>

            <div className="p-2 space-y-1.5 pb-44">
                {/* Customer Card */}
                <div
                    className="rounded-2xl p-3"
                    style={{
                        background: 'rgba(255,255,255,0.78)',
                        border: '1px solid rgba(184,128,74,0.14)',
                        boxShadow: '0 2px 8px rgba(184,128,74,0.05)',
                    }}
                >
                    <div className="flex items-center gap-2 mb-2">
                        <div
                            className="p-1.5 rounded-full flex-shrink-0"
                            style={{ background: 'rgba(184,128,74,0.1)', color: copper }}
                        >
                            <User size={14} strokeWidth={2.5} />
                        </div>
                        <h2 className="text-sm font-bold truncate flex-1" style={{ color: '#2c1e0f' }}>
                            {order.ledger?.name}
                        </h2>
                        {order.ledger?.tally_guid ? (
                            <span
                                className="text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                                style={{ color: '#22c55e', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}
                            >Synced</span>
                        ) : (
                            <span
                                className="text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                                style={{ color: copper, background: 'rgba(184,128,74,0.08)', border: '1px solid rgba(184,128,74,0.2)' }}
                            >Local</span>
                        )}
                    </div>
                    <div className="pl-7 space-y-1">
                        {(order.customer_address || order.ledger?.address) && (
                            <p className="text-[10px] leading-snug" style={{ color: '#8c7a68' }}>
                                {order.customer_address || order.ledger?.address}
                            </p>
                        )}
                        <div className="flex flex-wrap gap-x-3 gap-y-1">
                            {(order.customer_phone || order.ledger?.phone_number) && (
                                <p className="text-[10px] font-medium flex items-center gap-1" style={{ color: '#2c1e0f' }}>
                                    <span style={{ color: '#a8a29e' }}>Ph:</span> {order.customer_phone || order.ledger?.phone_number}
                                </p>
                            )}
                            {(order.customer_gstin || order.ledger?.gstin) && (
                                <p className="text-[10px] font-medium flex items-center gap-1" style={{ color: '#2c1e0f' }}>
                                    <span style={{ color: '#a8a29e' }}>GST:</span> {order.customer_gstin || order.ledger?.gstin}
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Items List */}
                <div className="space-y-1.5">
                    <h3 className="px-1 text-[10px] font-bold uppercase tracking-widest" style={{ color: '#a8a29e' }}>
                        Items ({items.length})
                    </h3>
                    {items.map((item, index) => (
                        <div
                            key={item.id}
                            onClick={() => setSelectedItemForDetail(item)}
                            className="p-2.5 rounded-lg flex items-start gap-2 active:scale-[0.98] transition-all cursor-pointer"
                            style={{
                                background: 'rgba(255,255,255,0.78)',
                                border: '1px solid rgba(184,128,74,0.14)',
                                boxShadow: '0 1px 4px rgba(184,128,74,0.04)',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.border = '1px solid rgba(184,128,74,0.3)')}
                            onMouseLeave={e => (e.currentTarget.style.border = '1px solid rgba(184,128,74,0.14)')}
                        >
                            <span
                                className="text-[10px] font-bold px-1.5 py-0.5 rounded h-fit mt-0.5 flex-shrink-0"
                                style={{ color: '#8c7a68', background: 'rgba(184,128,74,0.07)', border: '1px solid rgba(184,128,74,0.12)' }}
                            >
                                {index + 1}
                            </span>
                            <div className="flex-1 pr-2 min-w-0">
                                <div className="flex items-start gap-1.5 flex-wrap">
                                    <h4 className="font-bold text-xs leading-snug" style={{ color: '#2c1e0f' }}>
                                        {item.item_name || item.stock_item?.name || 'Unknown Item'}
                                    </h4>
                                    {item.livestock_type && (
                                        <span
                                            className="text-[8px] font-bold px-1 py-0.5 rounded whitespace-nowrap"
                                            style={{ color: copper, background: 'rgba(184,128,74,0.08)', border: '1px solid rgba(184,128,74,0.18)' }}
                                        >
                                            {['Pb', 'Pan'].includes(item.livestock_type) ? 'PB' : item.livestock_type}
                                        </span>
                                    )}
                                </div>
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-[10px] font-medium" style={{ color: '#8c7a68' }}>
                                    <span
                                        className="px-1.5 py-0.5 rounded font-bold"
                                        style={{ background: 'rgba(184,128,74,0.08)', color: '#2c1e0f' }}
                                    >
                                        {item.quantity} {item.unit}
                                    </span>
                                    <span>x</span>
                                    <span>₹{parseFloat(item.rate).toLocaleString('en-IN')}</span>
                                    {item.selected_scheme && (
                                        <span
                                            className="px-1 rounded"
                                            style={{ color: '#8c7a68', background: 'rgba(184,128,74,0.05)', border: '1px solid rgba(184,128,74,0.12)' }}
                                        >
                                            ({item.selected_scheme})
                                        </span>
                                    )}
                                    {item.stock_item?.default_mrp && (
                                        <span
                                            className="px-1 rounded ml-1"
                                            style={{ color: copper, background: 'rgba(184,128,74,0.08)', border: '1px solid rgba(184,128,74,0.15)' }}
                                        >
                                            MRP: {item.stock_item.default_mrp}
                                        </span>
                                    )}
                                    {parseFloat(item.discount_percentage) > 0 && (
                                        <span
                                            className="px-1 rounded"
                                            style={{ color: '#22c55e', background: 'rgba(34,197,94,0.08)' }}
                                        >
                                            -{item.discount_percentage}%
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                                <span className="block font-bold text-sm" style={{ color: '#2c1e0f' }}>
                                    ₹{Math.round(parseFloat(item.amount)).toLocaleString('en-IN')}
                                </span>
                                <span
                                    className="text-[10px] font-bold px-1 rounded"
                                    style={{ color: '#8c7a68', background: 'rgba(184,128,74,0.06)', border: '1px solid rgba(184,128,74,0.1)' }}
                                >
                                    {parseFloat(item.gst) > 0 ? `${item.gst}% GST` : 'GST Exempt'}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Footer */}
            <div className="fixed bottom-16 left-0 right-0 z-30 flex justify-center">
                <div
                    className="w-full max-w-md p-3"
                    style={{
                        background: 'rgba(253,248,243,0.97)',
                        backdropFilter: 'blur(12px)',
                        borderTop: '1px solid rgba(184,128,74,0.15)',
                        boxShadow: '0 -4px 16px rgba(184,128,74,0.08)',
                        minHeight: '120px',
                    }}
                >
                    <div
                        onClick={() => order?.amount_given && setShowSettlementPopup(true)}
                        className={`flex justify-between items-end mb-3 p-2 -mx-2 rounded-xl transition-colors ${order?.amount_given ? 'cursor-pointer' : ''}`}
                        style={order?.amount_given ? { background: 'rgba(184,128,74,0.04)' } : {}}
                    >
                        <div className="space-y-0.5">
                            <span className="text-xs font-bold uppercase tracking-wide flex items-center gap-1.5" style={{ color: '#8c7a68' }}>
                                Total Amount
                                {order?.amount_given && parseFloat(order.amount_given.toString()) > 0 && (
                                    <span
                                        className="text-[9px] font-black px-1.5 py-0.5 rounded"
                                        style={{ color: '#22c55e', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.15)' }}
                                    >Settled</span>
                                )}
                            </span>
                            {order?.amount_given && parseFloat(order.amount_given.toString()) > 0 && (
                                <p className="text-[10px] font-black" style={{ color: '#a8a29e' }}>Tap to view settlement</p>
                            )}
                        </div>
                        <div className="text-xl font-black leading-none" style={{ color: '#2c1e0f' }}>
                            ₹{Math.round(parseFloat(order?.total_amount || '0')).toLocaleString('en-IN')}
                        </div>
                    </div>

                    <div className={`gap-2 ${isLocked ? 'flex' : 'grid grid-cols-[1fr_1fr_1.5fr]'}`}>
                        {!isLocked && (
                            <>
                                <button
                                    onClick={handleDelete}
                                    className="py-2.5 font-bold rounded-lg active:scale-95 transition-transform flex items-center justify-center gap-1.5"
                                    style={{ background: 'rgba(239,68,68,0.07)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.15)' }}
                                >
                                    <Trash2 size={16} />
                                    <span className="text-[10px] uppercase">Delete</span>
                                </button>
                                <button
                                    onClick={() => navigate(`/orders/edit/${order?.id}`)}
                                    className="py-2.5 font-bold rounded-lg active:scale-95 transition-transform flex items-center justify-center gap-1.5"
                                    style={{ background: 'rgba(184,128,74,0.07)', color: copper, border: '1px solid rgba(184,128,74,0.18)' }}
                                >
                                    <Edit size={16} />
                                    <span className="text-[10px] uppercase">Edit</span>
                                </button>
                            </>
                        )}
                        <button
                            onClick={handleSyncTally}
                            disabled={syncing || isLocked}
                            className="py-2.5 font-bold rounded-lg active:scale-95 transition-transform flex items-center justify-center gap-1.5 text-white flex-1 disabled:opacity-50"
                            style={isLocked
                                ? { background: 'rgba(184,128,74,0.3)', cursor: 'not-allowed' }
                                : { background: `linear-gradient(145deg, ${copper}, ${copperDark})`, boxShadow: '0 4px 14px rgba(184,128,74,0.3)' }
                            }
                        >
                            {syncing
                                ? <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                                : <Share2 size={16} />
                            }
                            <span className="text-[10px] uppercase">
                                {order?.status === 'pending' ? 'Shared with Tally' : order?.status === 'fetched' ? 'Synced with Tally' : 'Share Tally'}
                            </span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Remark Modal */}
            {showRemark && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center px-4 animate-in fade-in duration-200"
                    style={{ background: 'rgba(44,30,15,0.4)', backdropFilter: 'blur(4px)' }}
                    onClick={() => setShowRemark(false)}
                >
                    <div
                        className="w-full max-w-sm relative p-6 rounded-2xl"
                        style={{ background: parchment, border: '1px solid rgba(184,128,74,0.18)', boxShadow: '0 20px 60px rgba(44,30,15,0.25)' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <button
                            onClick={() => setShowRemark(false)}
                            className="absolute top-4 right-4 p-1 rounded-lg"
                            style={{ color: '#a8a29e' }}
                        >
                            <X size={20} />
                        </button>
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="p-3 rounded-full" style={{ background: 'rgba(184,128,74,0.1)', color: copper }}>
                                    <MessageSquare size={24} />
                                </div>
                                <h3 className="text-lg font-bold" style={{ color: '#2c1e0f' }}>Order Remark</h3>
                            </div>
                            <div
                                className="p-4 rounded-xl font-medium leading-relaxed"
                                style={{ background: 'rgba(184,128,74,0.05)', border: '1px solid rgba(184,128,74,0.12)', color: '#2c1e0f' }}
                            >
                                {order?.remark}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Settlement Popup */}
            {showSettlementPopup && order && (
                <div
                    className="fixed inset-0 z-50 flex items-end sm:items-center justify-center animate-in fade-in duration-200"
                    style={{ background: 'rgba(44,30,15,0.4)', backdropFilter: 'blur(4px)' }}
                    onClick={() => setShowSettlementPopup(false)}
                >
                    <div
                        className="w-full max-w-md relative p-6 pb-8 rounded-t-3xl sm:rounded-2xl animate-in slide-in-from-bottom-5 mb-16 sm:mb-0"
                        style={{ background: parchment, border: '1px solid rgba(184,128,74,0.18)', boxShadow: '0 20px 60px rgba(44,30,15,0.25)' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="w-12 h-1.5 rounded-full mx-auto mb-6 sm:hidden" style={{ background: 'rgba(184,128,74,0.2)' }} />
                        <h3 className="text-lg font-black uppercase tracking-tight mb-6" style={{ color: '#2c1e0f' }}>Settlement Details</h3>
                        <div className="space-y-4">
                            <div
                                className="flex justify-between items-center text-sm font-bold p-4 rounded-xl"
                                style={{ background: 'rgba(184,128,74,0.05)', border: '1px solid rgba(184,128,74,0.12)', color: '#8c7a68' }}
                            >
                                <span>Bill Amount</span>
                                <span style={{ color: '#2c1e0f' }}>₹{Math.round(parseFloat(order.total_amount)).toLocaleString('en-IN')}</span>
                            </div>
                            <div
                                className="flex justify-between items-center text-sm font-bold p-4 rounded-xl"
                                style={{ background: 'rgba(184,128,74,0.05)', border: '1px solid rgba(184,128,74,0.12)', color: '#8c7a68' }}
                            >
                                <span>Amount Taken</span>
                                <span style={{ color: '#2c1e0f' }}>₹{parseFloat(order.amount_given?.toString() || '0').toLocaleString('en-IN')}</span>
                            </div>
                            <div
                                className="flex justify-between items-center text-lg font-black p-5 rounded-xl"
                                style={{ background: 'rgba(34,197,94,0.06)', border: '2px solid rgba(34,197,94,0.15)', color: '#22c55e' }}
                            >
                                <span>Return to Customer</span>
                                <span>₹{Math.abs(Math.round(parseFloat(order.amount_given?.toString() || '0') - parseFloat(order.total_amount))).toLocaleString('en-IN')}</span>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowSettlementPopup(false)}
                            className="w-full mt-6 py-4 font-black rounded-xl text-white"
                            style={{ background: `linear-gradient(145deg, ${copper}, ${copperDark})`, boxShadow: '0 4px 14px rgba(184,128,74,0.3)' }}
                        >
                            GOT IT
                        </button>
                    </div>
                </div>
            )}

            {/* Item Detail Modal */}
            {selectedItemForDetail && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center px-4 animate-in fade-in duration-200"
                    style={{ background: 'rgba(44,30,15,0.4)', backdropFilter: 'blur(4px)' }}
                    onClick={() => setSelectedItemForDetail(null)}
                >
                    <div
                        className="w-full max-w-sm rounded-2xl overflow-hidden animate-in zoom-in-95"
                        style={{ background: parchment, border: '1px solid rgba(184,128,74,0.18)', boxShadow: '0 20px 60px rgba(44,30,15,0.25)' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div
                            className="p-4 flex justify-between items-center"
                            style={{ background: `linear-gradient(145deg, ${copper}, ${copperDark})` }}
                        >
                            <h3 className="text-white font-black uppercase text-xs tracking-widest">Item Details</h3>
                            <button onClick={() => setSelectedItemForDetail(null)} className="text-white/80 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-5 space-y-6">
                            <div>
                                <h4 className="text-lg font-black leading-tight mb-1" style={{ color: '#2c1e0f' }}>
                                    {selectedItemForDetail.item_name || selectedItemForDetail.stock_item?.name}
                                </h4>
                                <div className="flex gap-2 flex-wrap">
                                    {selectedItemForDetail.livestock_type && (
                                        <span
                                            className="text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-tight"
                                            style={{ color: copper, background: 'rgba(184,128,74,0.1)', border: '1px solid rgba(184,128,74,0.2)' }}
                                        >
                                            {selectedItemForDetail.livestock_type} Stock
                                        </span>
                                    )}
                                    {parseFloat(selectedItemForDetail.discount_percentage) > 0 && (
                                        <span
                                            className="text-[10px] font-black px-2 py-0.5 rounded"
                                            style={{ color: '#22c55e', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.15)' }}
                                        >
                                            {selectedItemForDetail.discount_percentage}% OFF
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div
                                    className="p-3 rounded-xl"
                                    style={{ background: 'rgba(184,128,74,0.06)', border: '1px solid rgba(184,128,74,0.12)' }}
                                >
                                    <span className="text-[9px] font-black uppercase tracking-widest block mb-1" style={{ color: '#a8a29e' }}>Quantity</span>
                                    <span className="text-base font-black" style={{ color: '#2c1e0f' }}>
                                        {selectedItemForDetail.quantity} {selectedItemForDetail.unit}
                                    </span>
                                </div>
                                <div
                                    className="p-3 rounded-xl"
                                    style={{ background: 'rgba(184,128,74,0.06)', border: '1px solid rgba(184,128,74,0.12)' }}
                                >
                                    <span className="text-[9px] font-black uppercase tracking-widest block mb-1" style={{ color: '#a8a29e' }}>Rate</span>
                                    <span className="text-base font-black" style={{ color: '#2c1e0f' }}>
                                        ₹{parseFloat(selectedItemForDetail.rate).toLocaleString('en-IN')}
                                    </span>
                                </div>
                                {selectedItemForDetail.stock_item?.default_mrp && (
                                    <div
                                        className="p-3 rounded-xl col-span-2"
                                        style={{ background: 'rgba(184,128,74,0.08)', border: '1px solid rgba(184,128,74,0.18)' }}
                                    >
                                        <span className="text-[9px] font-black uppercase tracking-widest block mb-1" style={{ color: copper }}>MRP Reference</span>
                                        <span className="text-base font-black" style={{ color: copperDark }}>
                                            ₹{selectedItemForDetail.stock_item.default_mrp}
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div className="pt-5" style={{ borderTop: '1px solid rgba(184,128,74,0.12)' }}>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-bold" style={{ color: '#8c7a68' }}>Item Total</span>
                                    <span className="text-xl font-black" style={{ color: '#2c1e0f' }}>
                                        ₹{Math.round(parseFloat(selectedItemForDetail.amount)).toLocaleString('en-IN')}
                                    </span>
                                </div>
                                <p className="text-[10px] text-right font-black mt-1 uppercase tracking-widest" style={{ color: '#a8a29e' }}>
                                    {parseFloat(selectedItemForDetail.gst) > 0 ? `${selectedItemForDetail.gst}% GST Included` : 'Tax Free / Exempted'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
