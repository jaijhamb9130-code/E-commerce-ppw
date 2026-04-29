import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { fetchCustomerOrders } from '../api';

export interface OrderItem {
  id?: number;
  name: string;
  qty: number;
  price: number;
  emoji: string;
}

export interface Order {
  id: number;
  date: string | Date;
  items: OrderItem[];
  total: number;
  status: 'placed' | 'pending' | 'shipped' | 'delivered' | 'cancelled' | 'completed' | 'fetched';
  address: { name: string; phone: string; address: string; city: string; state: string; pincode: string };
  paymentMethod: string;
}

interface OrderContextType {
  orders: Order[];
  fetchOrders: () => Promise<void>;
  placeOrder: (order: Order) => void;
  getOrderCount: () => number;
  getDeliveredCount: () => number;
  loading: boolean;
}

const OrderContext = createContext<OrderContextType | null>(null);

export function OrderProvider({ children }: { children: ReactNode }) {
  const { user, isLoggedIn, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchOrders = async () => {
    if (authLoading) return; // wait for auth to restore from localStorage
    if (!isLoggedIn || !user?.phone) {
      setOrders([]);
      return;
    }
    setLoading(true);
    const data = await fetchCustomerOrders(user.phone);
    
    // Transform backend structure to frontend structure
    const transformed: Order[] = data.map((o: any) => ({
      id: o.id,
      date: new Date(o.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      total: Number(o.total_amount),
      status: o.status === 'pending' ? 'placed' : o.status,
      address: {
        name: o.customer_name || '',
        phone: o.customer_phone || '',
        address: o.customer_address || '',
        city: o.customer_city || o.customer_address?.split(',').pop()?.trim() || '',
        state: o.customer_state || '',
        pincode: o.customer_pincode || '',
      },
      paymentMethod: 'upi', // Default fallback
      items: (o.orderDetails || []).map((d: any) => ({
        id: d.id,
        name: d.item_name,
        qty: Number(d.quantity),
        price: Number(d.rate),
        emoji: '📦', // Category based emoji logic could go here
      }))
    }));
    
    setOrders(transformed);
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();
  }, [isLoggedIn, user?.phone, authLoading]);

  const placeOrder = (newOrder: Order) => {
    // Add to top of existing list locally for immediate feedback
    setOrders(prev => [newOrder, ...prev]);
  };

  const getOrderCount = () => orders.length;
  const getDeliveredCount = () => orders.filter(o => o.status === 'delivered').length;

  return (
    <OrderContext.Provider value={{ orders, fetchOrders, placeOrder, getOrderCount, getDeliveredCount, loading }}>
      {children}
    </OrderContext.Provider>
  );
}

export const useOrders = () => {
  const ctx = useContext(OrderContext);
  if (!ctx) throw new Error('useOrders must be used inside OrderProvider');
  return ctx;
};
