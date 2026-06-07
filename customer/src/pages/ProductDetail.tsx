import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Star, ShoppingCart, Zap, ChevronRight, ChevronLeft, Minus, Plus, Maximize2, X } from 'lucide-react';
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

  const toUrl = (u: string) => u.startsWith('http') ? u : `/${u}`;

  const addToCart = () => addItem({
    productId: Number(id),
    masterid: product.masterid,
    name: product.name,
    price: product.price,
    mrp: product.mrp,
    quantity: qty,
    unit: product.unit ?? 'pcs',
    image: extraData?.images?.[0] ? toUrl(extraData.images[0].image_url) : undefined
  });
  const buyNow    = () => { if (!inCart) addToCart(); navigate('/cart'); };

  const images = extraData?.images || [];
  const videos = extraData?.videos || [];
  const allMedia: { id: number; type: 'image' | 'video'; url: string }[] = [
    ...images.map(img => ({ id: img.id, type: 'image' as const, url: toUrl(img.image_url) })),
    ...videos.map(vid => ({ id: vid.id, type: 'video' as const, url: toUrl(vid.video_url) })),
  ];
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

          {/* Media Section */}
          <div className="md:w-72 flex-shrink-0">
            <MediaGallery media={allMedia} alt={product.name} />
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
                  <input
                    type="text"
                    inputMode="numeric"
                    value={qty}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9]/g, '');
                      setQty(raw === '' ? 1 : Math.max(1, parseInt(raw, 10)));
                    }}
                    onFocus={(e) => e.target.select()}
                    className="w-12 text-center text-sm font-extrabold text-gray-900 outline-none bg-transparent border-x border-green-100"
                    aria-label="Quantity"
                  />
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

/* ──────────────────────────────────────────────────────────────────────────
   Media gallery: swipeable carousel (mobile-gallery feel) with 3s auto-scroll
   and a fullscreen lightbox. One ordered list of images + videos.
   ────────────────────────────────────────────────────────────────────────── */
type GalleryMedia = { id: number; type: 'image' | 'video'; url: string };

const AUTO_MS = 3000;

function MediaGallery({ media, alt }: { media: GalleryMedia[]; alt: string }) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

  const activeRef = useRef(0);          // latest active index (avoids stale closures in the timer)
  const videoPlaying = useRef(false);   // true while the current slide's video is playing
  const pausedUntil = useRef(0);        // suppress auto-advance until this timestamp (user interaction)
  const downPos = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => { activeRef.current = active; }, [active]);

  const scrollToIndex = (i: number, smooth = true) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: smooth ? 'smooth' : 'auto' });
  };

  const pauseOtherVideos = (keep: number) => {
    trackRef.current?.querySelectorAll('video').forEach((v) => {
      if (Number(v.dataset.idx) !== keep) v.pause();
    });
  };

  // Native scroll (manual swipe OR our programmatic scroll) is the source of truth
  // for which slide is visible.
  const handleScroll = () => {
    const el = trackRef.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== activeRef.current && i >= 0 && i < media.length) {
      setActive(i);
      videoPlaying.current = false;
      pauseOtherVideos(i);
    }
  };

  // Auto-advance every 3s — paused while a video plays, while the lightbox is
  // open, or briefly after the user interacts.
  useEffect(() => {
    if (media.length < 2) return;
    const t = setInterval(() => {
      if (fullscreen || videoPlaying.current || Date.now() < pausedUntil.current) return;
      scrollToIndex((activeRef.current + 1) % media.length);
    }, AUTO_MS);
    return () => clearInterval(t);
  }, [media.length, fullscreen]);

  // When the lightbox opens, pause the big-box video so its audio doesn't keep
  // playing behind the overlay. When it closes, give the user a beat before
  // auto-scroll resumes.
  useEffect(() => {
    if (fullscreen) {
      videoPlaying.current = false;
      trackRef.current?.querySelectorAll('video').forEach((v) => v.pause());
    } else {
      pausedUntil.current = Date.now() + 4000;
    }
  }, [fullscreen]);

  if (media.length === 0) {
    return (
      <div className="rounded-2xl flex items-center justify-center overflow-hidden p-2"
        style={{ background: '#F8F8F8', border: '1px solid #E8E8E8', height: '220px' }}>
        <span className="text-6xl select-none">📦</span>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-2xl overflow-hidden relative"
        style={{ background: '#F8F8F8', border: '1px solid #E8E8E8', height: '220px' }}>
        <div
          ref={trackRef}
          onScroll={handleScroll}
          onPointerDown={(e) => { downPos.current = { x: e.clientX, y: e.clientY }; pausedUntil.current = Date.now() + 100000; }}
          onPointerUp={(e) => {
            pausedUntil.current = Date.now() + 4000; // resume auto-scroll after 4s idle
            const d = downPos.current; downPos.current = null;
            if (!d) return;
            const moved = Math.abs(e.clientX - d.x) > 8 || Math.abs(e.clientY - d.y) > 8;
            // A tap (not a swipe) on an image opens fullscreen. Taps on a video
            // hit its controls (play) instead, per the requested behaviour.
            if (!moved && media[activeRef.current]?.type === 'image') setFullscreen(true);
          }}
          onPointerCancel={() => { pausedUntil.current = Date.now() + 4000; downPos.current = null; }}
          className="flex w-full h-full overflow-x-auto snap-x snap-mandatory scrollbar-hide"
          style={{ scrollbarWidth: 'none' }}
        >
          {media.map((m, i) => (
            <div key={m.id} className="w-full h-full flex-shrink-0 snap-center flex items-center justify-center p-2">
              {m.type === 'video' ? (
                <video
                  data-idx={i}
                  src={m.url}
                  controls
                  playsInline
                  className="max-w-full max-h-full object-contain"
                  onPlay={() => { videoPlaying.current = true; }}
                  onPause={() => { videoPlaying.current = false; }}
                  onEnded={() => { videoPlaying.current = false; scrollToIndex((activeRef.current + 1) % media.length); }}
                />
              ) : (
                // pointer-events-none so the swipe/tap is handled by the track
                <img src={m.url} alt={alt} className="max-w-full max-h-full object-contain pointer-events-none" />
              )}
            </div>
          ))}
        </div>

        {/* Fullscreen / expand — always available (works for video too) */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setFullscreen(true); }}
          className="absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center bg-black/45 text-white backdrop-blur-sm hover:bg-black/65 transition-colors"
          aria-label="View fullscreen"
        >
          <Maximize2 size={15} />
        </button>

        {/* Position dots */}
        {media.length > 1 && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
            {media.map((m, i) => (
              <span key={m.id} className={`h-1.5 rounded-full transition-all ${active === i ? 'w-4 bg-green-700' : 'w-1.5 bg-gray-300'}`} />
            ))}
          </div>
        )}
      </div>

      {/* Thumbnails */}
      {media.length > 1 && (
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1 scrollbar-hide">
          {media.map((m, i) => (
            <button
              key={m.id}
              onClick={() => { pausedUntil.current = Date.now() + 4000; scrollToIndex(i); }}
              className={`w-16 h-16 rounded-xl flex-shrink-0 border-2 transition-all overflow-hidden p-1 ${active === i ? 'border-green-700' : 'border-gray-200'}`}
              style={{ background: '#F8F8F8' }}
            >
              {m.type === 'video' ? (
                <div className="w-full h-full flex items-center justify-center bg-gray-800 text-white text-2xl rounded-lg">▶</div>
              ) : (
                <img src={m.url} className="w-full h-full object-contain" alt="" />
              )}
            </button>
          ))}
        </div>
      )}

      {fullscreen && (
        <MediaLightbox
          media={media}
          startIndex={active}
          alt={alt}
          onClose={() => setFullscreen(false)}
          onIndexChange={(i) => scrollToIndex(i, false)}
        />
      )}
    </>
  );
}

function MediaLightbox({ media, startIndex, alt, onClose, onIndexChange }: {
  media: GalleryMedia[];
  startIndex: number;
  alt: string;
  onClose: () => void;
  onIndexChange?: (i: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [index, setIndex] = useState(startIndex);
  const indexRef = useRef(startIndex);
  const videoPlaying = useRef(false);   // same video rules as the outside carousel
  const pausedUntil = useRef(0);
  useEffect(() => { indexRef.current = index; }, [index]);

  const scrollToIndex = (i: number, smooth = true) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: smooth ? 'smooth' : 'auto' });
  };
  const go = (dir: number) => scrollToIndex(Math.min(media.length - 1, Math.max(0, indexRef.current + dir)));

  useEffect(() => {
    // Open on the same item the user tapped.
    trackRef.current?.scrollTo({ left: startIndex * (trackRef.current?.clientWidth || 0), behavior: 'auto' });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; // lock background scroll
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prevOverflow; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Same 3s auto-advance as the big box: loops, pauses while a video plays or
  // just after the user swipes, and advances when a played video ends.
  useEffect(() => {
    if (media.length < 2) return;
    const t = setInterval(() => {
      if (videoPlaying.current || Date.now() < pausedUntil.current) return;
      scrollToIndex((indexRef.current + 1) % media.length);
    }, AUTO_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [media.length]);

  const handleScroll = () => {
    const el = trackRef.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== indexRef.current && i >= 0 && i < media.length) {
      setIndex(i);
      onIndexChange?.(i);
      videoPlaying.current = false;
      el.querySelectorAll('video').forEach((v) => { if (Number(v.dataset.idx) !== i) v.pause(); });
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col select-none">
      <div className="flex items-center justify-between px-4 py-3 text-white/90">
        <span className="text-sm font-semibold tabular-nums">{index + 1} / {media.length}</span>
        <button type="button" onClick={onClose} aria-label="Close"
          className="w-9 h-9 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 transition-colors">
          <X size={18} />
        </button>
      </div>

      <div
        ref={trackRef}
        onScroll={handleScroll}
        onPointerDown={() => { pausedUntil.current = Date.now() + 100000; }}
        onPointerUp={() => { pausedUntil.current = Date.now() + 4000; }}
        onPointerCancel={() => { pausedUntil.current = Date.now() + 4000; }}
        className="flex-1 flex overflow-x-auto snap-x snap-mandatory scrollbar-hide"
        style={{ scrollbarWidth: 'none' }}
      >
        {media.map((m, i) => (
          <div key={m.id} className="w-full h-full flex-shrink-0 snap-center flex items-center justify-center p-3 sm:p-8">
            {m.type === 'video' ? (
              <video
                data-idx={i}
                src={m.url}
                controls
                playsInline
                className="max-w-full max-h-full object-contain"
                onPlay={() => { videoPlaying.current = true; }}
                onPause={() => { videoPlaying.current = false; }}
                onEnded={() => { videoPlaying.current = false; scrollToIndex((indexRef.current + 1) % media.length); }}
              />
            ) : (
              // object-contain → original aspect ratio, fitted to the screen
              <img src={m.url} alt={alt} className="max-w-full max-h-full object-contain" />
            )}
          </div>
        ))}
      </div>

      {media.length > 1 && (
        <>
          <button type="button" onClick={() => go(-1)} disabled={index === 0} aria-label="Previous"
            className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center bg-white/10 text-white hover:bg-white/20 disabled:opacity-30 transition-colors">
            <ChevronLeft size={22} />
          </button>
          <button type="button" onClick={() => go(1)} disabled={index === media.length - 1} aria-label="Next"
            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center bg-white/10 text-white hover:bg-white/20 disabled:opacity-30 transition-colors">
            <ChevronRight size={22} />
          </button>
        </>
      )}
    </div>
  );
}
