import { useNavigate } from 'react-router-dom';
import { Trash2, ArrowRight, Truck } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';

export default function Cart() {
  const { items, removeItem, updateQty, total } = useCart();
  const { isLoggedIn } = useAuth();
  const navigate = useNavigate();

  const delivery      = total >= 499 ? 0 : 40;
  const finalTotal    = total + delivery;

  if (items.length === 0) return (
    <div className="max-w-md mx-auto px-4 py-24 text-center">
      <span className="text-7xl block mb-5">🛒</span>
      <h2 className="text-xl font-bold mb-2" style={{ color: '#292524' }}>Your cart is empty</h2>
      <p className="text-sm mb-6" style={{ color: '#78716c' }}>Add notebooks, pens and more to get started.</p>
      <button onClick={() => navigate('/products')}
        className="inline-flex justify-center items-center px-8 py-3 rounded-2xl text-sm font-bold transition-all hover:opacity-90 w-full sm:w-auto"
        style={{ background: 'linear-gradient(145deg, #c1885b, #a96f46)', color: 'white', boxShadow: '0 6px 20px rgba(169,111,70,0.5)' }}>
        Browse Products
      </button>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto px-4 py-5">
      <h1 className="text-xl font-bold mb-1" style={{ color: '#292524' }}>Shopping Cart</h1>
      <p className="text-sm mb-5" style={{ color: '#78716c' }}>{items.length} item{items.length > 1 ? 's' : ''} in your cart</p>

      {total < 499 && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-2xl mb-4 text-sm font-medium"
          style={{ background: 'rgba(193,136,91,0.08)', border: '1.5px solid rgba(193,136,91,0.2)', color: '#a96f46' }}>
          <Truck size={16} />
          Add ₹{499 - total} more for <strong>free shipping</strong>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Items */}
        <div className="flex-1 space-y-3">
          {items.map(item => {
            return (
              <div key={item.id} className="flex gap-3 p-4 rounded-2xl"
                style={{ background: 'white', border: '1.5px solid rgba(193,136,91,0.12)' }}>
                {/* Image */}
                <div className="w-20 h-20 flex-shrink-0 rounded-xl flex items-center justify-center text-3xl"
                  style={{ background: '#fdf8f3', border: '1.5px solid rgba(193,136,91,0.12)' }}>
                  {item.image
                    ? <img src={item.image} alt={item.name} className="w-full h-full object-contain p-2" />
                    : categoryEmoji(item.name)}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold leading-snug line-clamp-2 mb-1" style={{ color: '#292524' }}>{item.name}</p>
                  <p className="text-xs mb-2" style={{ color: '#a8a29e' }}>{item.unit}</p>
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="font-bold" style={{ color: '#292524' }}>₹{item.price}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Qty */}
                    <div className="flex items-center rounded-xl overflow-hidden"
                      style={{ border: '1.5px solid rgba(193,136,91,0.25)' }}>
                      <button onClick={() => updateQty(item.productId, item.quantity - 1)}
                        className="w-8 h-8 flex items-center justify-center font-bold text-lg transition-colors hover:bg-amber-50"
                        style={{ color: '#a96f46' }}>−</button>
                      <span className="w-8 text-center text-sm font-bold" style={{ color: '#292524' }}>{item.quantity}</span>
                      <button onClick={() => updateQty(item.productId, item.quantity + 1)}
                        className="w-8 h-8 flex items-center justify-center font-bold text-lg transition-colors hover:bg-amber-50"
                        style={{ color: '#a96f46' }}>+</button>
                    </div>
                    <button onClick={() => removeItem(item.productId)}
                      className="flex items-center gap-1 text-xs font-semibold transition-colors hover:opacity-80"
                      style={{ color: '#dc2626' }}>
                      <Trash2 size={13} /> Remove
                    </button>
                  </div>
                </div>

                {/* Subtotal */}
                <div className="flex-shrink-0 text-right">
                  <span className="text-sm font-bold" style={{ color: '#292524' }}>₹{(item.price * item.quantity).toLocaleString()}</span>
                </div>
              </div>
            );
          })}


          <button onClick={() => navigate('/products')} className="text-sm font-semibold" style={{ color: '#a96f46' }}>
            ← Continue Shopping
          </button>
        </div>

        {/* Summary */}
        <div className="lg:w-72 space-y-3">
          <div className="rounded-2xl p-5" style={{ background: 'white', border: '1.5px solid rgba(193,136,91,0.12)' }}>
            <h2 className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: '#57534e' }}>Price Details</h2>
            <div className="space-y-3 text-sm">
              <Row label={`Price (${items.length} items)`} value={`₹${total.toLocaleString()}`} />
              <Row label="Shipping" value={delivery === 0 ? 'Free' : `₹${delivery}`} valueStyle={{ color: delivery === 0 ? '#16a34a' : undefined, fontWeight: delivery === 0 ? 700 : 400 }} />
              <div className="pt-3" style={{ borderTop: '1.5px solid rgba(193,136,91,0.12)' }}>
                <Row label="Total Amount" value={`₹${finalTotal.toLocaleString()}`} bold />
              </div>
            </div>
          </div>

          <button
            onClick={() => navigate(isLoggedIn ? '/checkout' : '/login')}
            className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl text-sm font-bold transition-all hover:opacity-90"
            style={{ background: 'linear-gradient(145deg, #c1885b, #a96f46)', color: 'white', boxShadow: '0 6px 20px rgba(169,111,70,0.5)' }}>
            {isLoggedIn ? 'Proceed to Checkout' : 'Login to Checkout'} <ArrowRight size={15} />
          </button>

          <div className="flex items-center gap-2 justify-center text-xs" style={{ color: '#a8a29e' }}>
            🔒 Safe & Secure Payments
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold, valueStyle }: { label: string; value: string; bold?: boolean; valueStyle?: React.CSSProperties }) {
  return (
    <div className="flex items-center justify-between">
      <span style={{ color: bold ? '#292524' : '#78716c', fontWeight: bold ? 700 : 500 }}>{label}</span>
      <span style={{ color: bold ? '#292524' : '#292524', fontWeight: bold ? 700 : 500, ...valueStyle }}>{value}</span>
    </div>
  );
}

function categoryEmoji(name: string) {
  if (/pen|pencil|marker|highlight|ink/i.test(name))  return '✏️';
  if (/notebook|diary|spiral|planner/i.test(name))     return '📒';
  if (/color|brush|craft|paint|canvas/i.test(name))   return '🎨';
  if (/staple|clip|tape|scissor|glue|folder/i.test(name)) return '📎';
  if (/paper|a4|sheet|ream/i.test(name))               return '📄';
  if (/geometry|compass|protractor|ruler|scale/i.test(name)) return '📐';
  if (/file|binder|folder/i.test(name))                return '📁';
  if (/bag|pouch/i.test(name))                         return '🎒';
  return '📦';
}
