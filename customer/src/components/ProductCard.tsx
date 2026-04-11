import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';

export interface Product {
  id: number;
  masterid?: string;
  name: string;
  price: number;
  mrp: number;
  image?: string;
  category?: string;
  brand?: string;
  unit?: string;
  rating?: number;
  reviews?: number;
  inStock?: boolean;
}



export default function ProductCard({ product }: { product: Product }) {
  const { addItem, isInCart, getQty, updateQty } = useCart();
  const inCart = isInCart(product.id);
  const qty    = getQty(product.id);
  const brand  = product.brand;

  return (
    <Link to={`/products/${product.id}`} className="block group">
      <div
        className="rounded-xl overflow-hidden flex flex-col h-full bg-white transition-shadow duration-200 hover:shadow-md"
        style={{ border: '1px solid #E8E8E8' }}
      >
        {/* ── Image area ── */}
        <div
          className="relative overflow-hidden flex-shrink-0 flex items-center justify-center"
          style={{ background: '#F8F8F8', height: 148 }}
        >
          {product.image ? (
            <img
              src={product.image}
              alt={product.name}
              className="w-full h-full object-contain p-3 group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <span className="text-5xl select-none group-hover:scale-105 transition-transform duration-300">
              {categoryEmoji(product.category)}
            </span>
          )}


          {/* Out of stock overlay */}
          {product.inStock === false && (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.82)' }}
            >
              <span
                className="text-xs font-bold px-3 py-1.5 rounded-full"
                style={{ background: '#F2F2F2', color: '#666666', border: '1px solid #E8E8E8' }}
              >
                Out of Stock
              </span>
            </div>
          )}
        </div>

        {/* ── Info ── */}
        <div className="p-2.5 flex flex-col flex-1">

          {/* Brand · Category */}
          {(brand || product.category) && (
            <p className="text-[9px] font-bold uppercase tracking-wider mb-1 truncate" style={{ color: '#b8804a' }}>
              {brand && product.category
                ? <>{brand} <span style={{ color: '#d4c0a8' }}>/</span> {product.category}</>
                : brand ?? product.category}
            </p>
          )}

          {/* Name */}
          <h3
            className="text-[12px] font-semibold leading-snug line-clamp-2 text-gray-900 mb-1"
            style={{ minHeight: '2.4rem' }}
          >
            {product.name}
          </h3>

          {/* Unit */}
          {product.unit && (
            <p className="text-[11px] mb-2" style={{ color: '#9E9E9E' }}>{product.unit}</p>
          )}

          {/* Price */}
          <div className="flex items-baseline gap-1.5 mt-auto mb-2.5">
            <span className="text-sm font-extrabold text-gray-900">₹{product.price}</span>
          </div>

          {/* ADD / Stepper */}
          <div onClick={e => e.preventDefault()}>
            {inCart ? (
              <div
                className="flex items-center justify-between rounded-lg overflow-hidden"
                style={{ background: '#0C831F' }}
              >
                <button
                  onClick={() => updateQty(product.id, qty - 1)}
                  className="flex-1 py-2 text-white text-lg font-bold flex items-center justify-center hover:bg-green-800 transition-colors"
                >
                  −
                </button>
                <span className="w-8 text-center text-sm font-extrabold text-white tabular-nums">{qty}</span>
                <button
                  onClick={() => updateQty(product.id, qty + 1)}
                  className="flex-1 py-2 text-white text-lg font-bold flex items-center justify-center hover:bg-green-800 transition-colors"
                >
                  +
                </button>
              </div>
            ) : (
              <button
                onClick={() => addItem({
                  productId: product.id,
                  masterid: product.masterid,
                  name: product.name,
                  price: product.price,
                  mrp: product.mrp,
                  image: product.image,
                  quantity: 1,
                  unit: product.unit ?? 'pcs',
                })}
                className="w-full py-2 rounded-lg text-sm font-bold transition-all active:scale-95 hover:bg-green-50"
                style={{ border: '2px solid #0C831F', color: '#0C831F', background: 'white' }}
              >
                ADD
              </button>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

function categoryEmoji(cat?: string) {
  const map: Record<string, string> = {
    'Writing Instruments': '✏️',
    'Notebooks & Diaries': '📒',
    'Art & Craft':         '🎨',
    'Office Supplies':     '📎',
    'Paper Products':      '📄',
    'Geometry & Math':     '📐',
    'Files & Folders':     '📁',
    'Bags & Pouches':      '🎒',
    'General':             '📦',
  };
  return cat ? (map[cat] ?? '📦') : '📦';
}
