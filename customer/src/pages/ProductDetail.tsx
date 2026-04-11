import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Star, ShoppingCart, Zap, ChevronRight, Minus, Plus } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { type Product } from '../components/ProductCard';
import { fetchSingleProduct, fetchProductDetail, type FullItemDetail } from '../api';

export default function ProductDetail() {
  const { id }    = useParams();
  const navigate  = useNavigate();
  const { addItem, isInCart, getQty, updateQty } = useCart();

  const [product, setProduct] = useState<Product | null>(null);
  const [extraData, setExtraData] = useState<FullItemDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [tab, setTab] = useState<'desc' | 'specs'>('desc');
  const [activeImg, setActiveImg] = useState(0);

  useEffect(() => {
    const loadProduct = async () => {
      setLoading(true);
      try {
        const pId = Number(id);
        const data = await fetchSingleProduct(pId);
        if (data) {
          setProduct(data);
          if (data.masterid) {
            const extra = await fetchProductDetail(data.masterid);
            setExtraData(extra);
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    loadProduct();
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-40">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-700 mb-4"></div>
        <p className="text-sm font-medium text-gray-500">Loading product details...</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <span className="text-6xl mb-4 block">😢</span>
        <h2 className="text-2xl font-bold mb-2">Product Not Found</h2>
        <p className="text-gray-500 mb-8">The product you are looking for does not exist or has been removed.</p>
        <button onClick={() => navigate('/products')} className="px-8 py-3 bg-green-700 text-white rounded-xl font-bold">
          See All Products
        </button>
      </div>
    );
  }

  const brand     = product.brand;
  const inCart    = isInCart(Number(id));
  const cartQty   = getQty(Number(id));

  const addToCart = () => addItem({
    productId: Number(id),
    masterid: product.masterid,
    name: product.name,
    price: product.price,
    mrp: product.mrp,
    quantity: qty,
    unit: product.unit ?? 'pcs',
    image: extraData?.images?.[0]?.image_url
  });
  const buyNow    = () => { if (!inCart) addToCart(); navigate('/cart'); };

  const images = extraData?.images || [];
  const description = extraData?.details?.description || 'No description available for this product.';
  const highlights = [
    `Brand: ${brand || 'General'}`,
    `Category: ${product.category}`,
    `Unit: ${product.unit}`,
    `In Stock: ${product.inStock ? 'Yes' : 'No'}`,
    `Trusted Quality`
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-5 font-sans">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs mb-5 flex-wrap">
        <button onClick={() => navigate('/')} className="font-medium transition-colors hover:underline" style={{ color: '#a96f46' }}>Home</button>
        <ChevronRight size={12} style={{ color: '#a8a29e' }} />
        <button onClick={() => navigate('/products')} className="font-medium transition-colors hover:underline" style={{ color: '#a96f46' }}>Products</button>
        <ChevronRight size={12} style={{ color: '#a8a29e' }} />
        <span className="truncate max-w-40 font-bold" style={{ color: '#0C831F' }}>{product.name}</span>
      </nav>

      <div className="rounded-3xl p-5 md:p-8" style={{ background: 'white', border: '1.5px solid #E8E8E8' }}>
        <div className="flex flex-col md:flex-row gap-8">

          {/* Image Section */}
          <div className="md:w-80 flex-shrink-0">
            <div className="aspect-square rounded-2xl flex items-center justify-center overflow-hidden relative"
              style={{ background: '#F8F8F8', border: '1px solid #E8E8E8' }}>
              {images.length > 0 ? (
                <img 
                  src={`/${images[activeImg].image_url}`} 
                  alt={product.name} 
                  className="w-full h-full object-contain p-4"
                />
              ) : (
                <span className="text-8xl select-none">📦</span>
              )}
              
            </div>

            {/* Thumbnails */}
            {images.length > 1 && (
              <div className="flex gap-2 mt-3 overflow-x-auto pb-1 scrollbar-hide">
                {images.map((img, i) => (
                  <button 
                    key={img.id} 
                    onClick={() => setActiveImg(i)}
                    className={`w-16 h-16 rounded-xl flex-shrink-0 border-2 transition-all p-1 ${activeImg === i ? 'border-green-700' : 'border-gray-200'}`}
                    style={{ background: '#F8F8F8' }}
                  >
                    <img src={`/${img.image_url}`} className="w-full h-full object-contain" alt="" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info Section */}
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold mb-1 uppercase tracking-widest text-green-700">
              {brand && <>{brand} <span className="mx-1 text-gray-300">/</span> </>}{product.category}
            </p>
            <h1 className="text-2xl font-extrabold leading-tight mb-4 text-gray-900">{product.name}</h1>

            {/* Rating & Stock */}
            <div className="flex items-center gap-3 mb-6">
              <div className="flex items-center gap-1 bg-green-700 text-white text-xs font-bold px-2 py-1 rounded-lg">
                4.5 <Star size={10} fill="white" />
              </div>
              <span className="text-sm font-medium text-gray-400">1,234 ratings</span>
              <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider ${product.inStock ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {product.inStock ? 'In Stock' : 'Out of Stock'}
              </span>
            </div>

            {/* Price section */}
            <div className="py-5 mb-6 border-y border-gray-100">
              <div className="flex items-baseline gap-3 mb-1">
                <span className="text-3xl font-extrabold text-gray-900">₹{product.price}</span>
              </div>
              <p className="text-[11px] font-medium text-gray-400">MRP Inclusive of all taxes</p>
            </div>

            {/* Qty & Add to Cart */}
            <div className="space-y-4 mb-8">
              <div className="flex items-center gap-4">
                <span className="text-sm font-bold text-gray-700">Quantity</span>
                <div className="flex items-center rounded-xl border-2 border-green-700 overflow-hidden bg-white">
                  <button 
                    onClick={() => setQty(Math.max(1, qty - 1))}
                    className="w-10 h-10 flex items-center justify-center text-green-700 hover:bg-green-50 transition-colors"
                  >
                    <Minus size={16} />
                  </button>
                  <span className="w-12 text-center text-sm font-extrabold text-gray-900">{qty}</span>
                  <button 
                    onClick={() => setQty(qty + 1)}
                    className="w-10 h-10 flex items-center justify-center text-green-700 hover:bg-green-50 transition-colors"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <span className="text-xs font-medium text-gray-400">per {product.unit}</span>
              </div>

              <div className="flex gap-3">
                {inCart ? (
                  <div className="flex-1 flex items-center rounded-2xl bg-green-700 text-white overflow-hidden">
                    <button onClick={() => updateQty(Number(id), cartQty - 1)} className="px-5 py-3.5 hover:bg-green-800 transition-colors"><Minus size={18} /></button>
                    <span className="flex-1 text-center font-bold">{cartQty} in cart</span>
                    <button onClick={() => updateQty(Number(id), cartQty + 1)} className="px-5 py-3.5 hover:bg-green-800 transition-colors"><Plus size={18} /></button>
                  </div>
                ) : (
                  <button 
                    onClick={addToCart}
                    disabled={!product.inStock}
                    className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-extrabold border-2 border-green-700 text-green-700 hover:bg-green-50 transition-all disabled:opacity-50 disabled:pointer-events-none"
                  >
                    <ShoppingCart size={18} /> Add to Cart
                  </button>
                )}
                <button 
                  onClick={buyNow}
                  disabled={!product.inStock}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-extrabold bg-green-700 text-white shadow-lg shadow-green-700/20 hover:bg-green-800 transition-all disabled:opacity-50 disabled:pointer-events-none"
                >
                  <Zap size={18} /> Buy Now
                </button>
              </div>
            </div>

            {/* Highlights */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {highlights.map((h, i) => (
                <div key={i} className="flex items-center gap-2 text-xs font-medium text-gray-600 bg-gray-50 px-3 py-2 rounded-lg border border-gray-100">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-700" />
                  {h}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Details */}
        <div className="mt-12 pt-8 border-t border-gray-100">
          <div className="flex gap-2 mb-6 p-1 bg-gray-50 rounded-2xl w-fit">
            {(['desc', 'specs'] as const).map(t => (
              <button 
                key={t} 
                onClick={() => setTab(t)}
                className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${tab === t ? 'bg-white text-green-700 shadow-sm' : 'text-gray-400'}`}
              >
                {t === 'desc' ? 'Description' : 'Highlights'}
              </button>
            ))}
          </div>

          <div className="bg-gray-50 rounded-3xl p-6 md:p-8">
            {tab === 'desc' ? (
              <div className="prose prose-sm max-w-none text-gray-600 leading-relaxed">
                {description}
              </div>
            ) : (
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-8">
                {highlights.map((h, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-gray-600">
                    <span className="w-5 h-5 rounded-full bg-green-50 flex items-center justify-center text-green-700 flex-shrink-0">
                      <ChevronRight size={14} />
                    </span>
                    {h}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
