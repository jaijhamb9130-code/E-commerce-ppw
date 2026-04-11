import { createContext, useContext, useState, type ReactNode } from 'react';

export interface CartItem {
  id: number;
  productId: number;
  masterid?: string;
  name: string;
  price: number;
  mrp: number;
  image?: string;
  quantity: number;
  unit: string;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'id'>) => void;
  removeItem: (productId: number) => void;
  updateQty: (productId: number, quantity: number) => void;
  clearCart: () => void;
  total: number;
  totalItems: number;
  isInCart: (productId: number) => boolean;
  getQty: (productId: number) => number;
}

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem('customer_cart');
    return saved ? JSON.parse(saved) : [];
  });

  const save = (updated: CartItem[]) => {
    setItems(updated);
    localStorage.setItem('customer_cart', JSON.stringify(updated));
  };

  const addItem = (item: Omit<CartItem, 'id'>) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === item.productId);
      let updated: CartItem[];
      if (existing) {
        updated = prev.map((i) =>
          i.productId === item.productId ? { ...i, quantity: i.quantity + item.quantity } : i
        );
      } else {
        updated = [...prev, { ...item, id: Date.now() }];
      }
      localStorage.setItem('customer_cart', JSON.stringify(updated));
      return updated;
    });
  };

  const removeItem = (productId: number) => {
    const updated = items.filter((i) => i.productId !== productId);
    save(updated);
  };

  const updateQty = (productId: number, quantity: number) => {
    if (quantity <= 0) { removeItem(productId); return; }
    const updated = items.map((i) => i.productId === productId ? { ...i, quantity } : i);
    save(updated);
  };

  const clearCart = () => save([]);

  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const isInCart = (productId: number) => items.some((i) => i.productId === productId);
  const getQty = (productId: number) => items.find((i) => i.productId === productId)?.quantity ?? 0;

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQty, clearCart, total, totalItems, isInCart, getQty }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
};
