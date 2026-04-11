import { useState, useEffect } from 'react';
import { 
    Search, ChevronDown, ChevronRight, User, Phone, MapPin, 
    Loader2, ArrowRight, ShoppingBag, ChevronLeft, Calendar, 
    Globe, ShoppingCart, RefreshCw 
} from 'lucide-react';
import { getCustomers, getOrdersByCustomerPhone } from '../api';
import { useNavigate } from 'react-router-dom';

const copper = '#b8804a';
const copperDark = '#9a6a3c';
const cream = '#f7f0e8';
const parchment = '#fdf8f3';

interface Customer {
  name: string;
  phone: string;
  address: string;
  lastOrderDate: string;
  orderCount: number;
  totalValue: number;
}

export default function Customers() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Detail view state
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerOrders, setCustomerOrders] = useState<any[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async (search = '') => {
    setLoading(true);
    try {
      const resp = await getCustomers(1, 100, search);
      setCustomers(resp.data);
    } catch (e) {
      console.error('Failed to fetch customers', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!selectedCustomer) fetchCustomers(searchTerm);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleCustomerClick = async (customer: Customer) => {
    setSelectedCustomer(customer);
    setLoadingDetails(true);
    try {
      const orders = await getOrdersByCustomerPhone(customer.phone);
      setCustomerOrders(orders);
    } catch (e) {
      console.error('Failed to fetch customer orders', e);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleBack = () => {
    setSelectedCustomer(null);
    setCustomerOrders([]);
  };

  return (
    <div className="flex flex-col h-full min-h-screen pb-20" style={{ background: cream }}>
      {/* Dynamic Header */}
      <div
        className="px-4 py-4 sticky top-0 z-40 space-y-4"
        style={{
          background: 'rgba(253,248,243,0.97)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(184,128,74,0.15)',
          boxShadow: '0 2px 12px rgba(184,128,74,0.06)',
        }}
      >
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            {!selectedCustomer ? (
              <>
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(184,128,74,0.1)', color: copper, border: '1px solid rgba(184,128,74,0.15)' }}
                >
                  <User size={22} />
                </div>
                <div>
                  <h1 className="text-lg font-extrabold tracking-tight leading-tight" style={{ color: '#2c1e0f' }}>Customer Base</h1>
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: copper }}>Online Orders Management</p>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-3">
                <button 
                  onClick={handleBack}
                  className="w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-90"
                  style={{ background: '#fff', border: '1px solid rgba(184,128,74,0.15)', color: copper }}
                >
                  <ChevronLeft size={24} />
                </button>
                <div>
                    <h1 className="text-sm font-black uppercase tracking-tight truncate max-w-[180px]" style={{ color: '#2c1e0f' }}>{selectedCustomer.name}</h1>
                    <p className="text-[9px] font-bold uppercase tracking-wider opacity-60" style={{ color: '#2c1e0f' }}>{selectedCustomer.phone}</p>
                </div>
              </div>
            )}
          </div>
          
          {selectedCustomer && (
              <div className="text-right">
                  <p className="text-[14px] font-black" style={{ color: copper }}>₹{Math.round(selectedCustomer.totalValue).toLocaleString()}</p>
                  <p className="text-[7px] font-black uppercase tracking-widest opacity-40 leading-none">Total Value</p>
              </div>
          )}
        </div>

        {!selectedCustomer && (
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2" size={18} style={{ color: copper, opacity: 0.5 }} />
                <input
                    type="text"
                    inputMode="search"
                    placeholder="Search by name or phone..."
                    className="w-full search-input pr-4 py-3 rounded-xl text-xs font-bold outline-none transition-all"
                    style={{
                        background: '#fff',
                        border: '1.5px solid rgba(184,128,74,0.12)',
                        color: '#2c1e0f',
                    }}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
        )}
      </div>

      <div className="p-4">
        {!selectedCustomer ? (
          /* Main Customer List */
          <div className="space-y-2.5">
            {loading ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="animate-spin" size={32} style={{ color: copper }} />
                </div>
            ) : customers.length === 0 ? (
                <div className="text-center py-20 bg-white/50 rounded-3xl border border-dashed border-[#b8804a33]">
                    <p className="text-sm font-bold" style={{ color: '#a8a29e' }}>No customers found</p>
                </div>
            ) : (
              customers.map((customer) => (
                <div
                  key={customer.phone}
                  onClick={() => handleCustomerClick(customer)}
                  className="p-3.5 rounded-[18px] bg-white transition-all active:scale-[0.98] border border-[rgba(184,128,74,0.12)] shadow-sm flex items-center justify-between"
                >
                  <div className="min-w-0">
                    <h3 className="font-black text-[13px] uppercase truncate mb-1" style={{ color: '#2c1e0f' }}>{customer.name}</h3>
                    <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1.5 text-[9px] font-bold opacity-60"><Phone size={10} style={{ color: copper }} /> {customer.phone}</span>
                        <span className="flex items-center gap-1.5 text-[9px] font-bold opacity-60"><ShoppingBag size={10} style={{ color: copper }} /> {customer.orderCount} Orders</span>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end">
                    <div className="text-[13px] font-black" style={{ color: '#2c1e0f' }}>₹{Math.round(customer.totalValue).toLocaleString()}</div>
                    <ChevronRight size={16} style={{ color: copper, opacity: 0.4 }} />
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          /* Customer Detail View (Full Page) */
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
             {selectedCustomer.address && (
                <div className="mb-6 px-4 py-3 rounded-2xl bg-white/50 border border-[#b8804a1a] flex items-start gap-3">
                    <MapPin size={14} style={{ color: copper, marginTop: '2px' }} />
                    <p className="text-[11px] font-bold leading-relaxed text-[#6d5c4a]">{selectedCustomer.address}</p>
                </div>
             )}

             <h4 className="text-[9px] font-black uppercase tracking-[0.2em] mb-4 opacity-40 px-1" style={{ color: '#2c1e0f' }}>Recent Order History</h4>

             {loadingDetails ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="animate-spin" size={24} style={{ color: copper }} />
                </div>
             ) : customerOrders.length > 0 ? (
                <div className="space-y-3.5">
                    {customerOrders.map((order) => (
                        <div key={order.id} className="bg-white rounded-[14px] border border-[rgba(184,128,74,0.12)] overflow-hidden shadow-sm">
                            {/* Order Header */}
                            <div className="px-3.5 py-2.5 bg-[#fdf8f3] border-b border-[rgba(184,128,74,0.08)] flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black uppercase text-copper">#ORD-{order.id}</span>
                                    <span className="text-[9px] font-bold opacity-40 text-[#2c1e0f]">|</span>
                                    <span className="text-[9px] font-black opacity-50 text-[#2c1e0f] uppercase">
                                        {new Date(order.date).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </span>
                                </div>
                                <div className="text-right">
                                    <span className="text-[12px] font-black" style={{ color: '#2c1e0f' }}>₹{Math.round(order.total_amount).toLocaleString()}</span>
                                </div>
                            </div>

                            {/* Order Items */}
                            <div className="p-3.5 space-y-3">
                                {order.orderDetails?.map((item: any) => (
                                    <div key={item.id} className="flex justify-between items-start gap-4">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[11px] font-black uppercase leading-tight truncate text-[#2c1e0f]">{item.item_name}</p>
                                            <div className="flex items-center gap-1.5 mt-1">
                                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-[rgba(184,128,74,0.05)] text-copper border border-[rgba(184,128,74,0.1)]">
                                                    {item.quantity} {item.unit}
                                                </span>
                                                <span className="text-[9px] font-bold opacity-30 text-[#2c1e0f]">@</span>
                                                <span className="text-[9px] font-black text-[#6d5c4a]">₹{Number(item.rate).toFixed(0)}</span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[11px] font-black text-[#2c1e0f]">₹{Math.round(item.amount).toLocaleString()}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
             ) : (
                <div className="text-center py-20 opacity-30">
                    <ShoppingCart size={40} className="mx-auto mb-4" />
                    <p className="text-[10px] font-black uppercase tracking-widest">No detailed history found</p>
                </div>
             )}
          </div>
        )}
      </div>
    </div>
  );
}
