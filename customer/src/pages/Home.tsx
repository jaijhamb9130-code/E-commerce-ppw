import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, ChevronLeft, ChevronRight, Truck, RefreshCw, Shield, Tag, Zap, Building2, PackageCheck, Headphones } from 'lucide-react';
import ProductCard, { type Product } from '../components/ProductCard';
import PostLoginSheet from '../components/PostLoginSheet';

import { fetchProducts, transformStockItemToProduct, fetchBrands, fetchCategories } from '../api';

const CATEGORY_EMOJIS: Record<string, string> = {
  'Writing Instruments': '✏️',
  'Notebooks & Diaries': '📒',
  'Art & Craft':         '🎨',
  'Office Supplies':     '📎',
  'Paper Products':      '📄',
  'Geometry & Math':     '📐',
  'Files & Folders':     '📁',
  'Bags & Pouches':      '🎒',
};

const BANNERS = [
  {
    title: 'Complete Stationery Solutions',
    sub: 'Notebooks, pens, office essentials & more for your business',
    cta: 'Shop Catalog',
    link: '/products',
    emoji: '📝',
    bg: '#F8C420',
    textColor: '#1C1C1C',
    subColor: 'rgba(28,28,28,0.65)',
  },
  {
    categoryKey: 'Office Supplies',
    title: 'Professional Office Essentials',
    sub: 'Quality files, folders, and desk supplies for maximum productivity',
    cta: 'Explore Office',
    link: '/products?category=Office+Supplies',
    emoji: '📁',
    bg: '#0C831F',
    textColor: 'white',
    subColor: 'rgba(255,255,255,0.75)',
  },
  {
    categoryKey: 'Writing Instruments',
    title: 'Precision Writing Tools',
    sub: 'Explore a curated range of high-quality pens and drawing instruments',
    cta: 'Browse Pens',
    link: '/products?category=Writing+Instruments',
    emoji: '✒️',
    bg: '#1C1C1C',
    textColor: 'white',
    subColor: 'rgba(255,255,255,0.65)',
  },
];

const CATEGORY_BGS = ['#FFF9E6', '#FFF3E0', '#FCE4EC', '#E8F5E9', '#E3F2FD', '#EDE7F6', '#FFF8E1', '#F3E5F5'];

function getCategoryEmoji(name: string) {
  return CATEGORY_EMOJIS[name] || '📦';
}

function getBrandEmoji(name: string) {
  const n = name.toLowerCase();
  if (n.includes('paper') || n.includes('notebook')) return '📓';
  if (n.includes('pen') || n.includes('pencil') || n.includes('writing')) return '✒️';
  if (n.includes('art') || n.includes('paint') || n.includes('color')) return '🎨';
  if (n.includes('office') || n.includes('file')) return '📁';
  if (n.includes('bag') || n.includes('case')) return '🎒';
  return '🏷️';
}

function getColor(index: number) {
  return CATEGORY_BGS[index % CATEGORY_BGS.length];
}

const PERKS = [
  { icon: <PackageCheck size={16} strokeWidth={2.5} />, title: 'Quality Checked', desc: 'Verified products' },
  { icon: <Truck size={16} strokeWidth={2.5} />,        title: 'Free Shipping',   desc: 'Above ₹499' },
  { icon: <Tag size={16} strokeWidth={2.5} />,          title: 'Bulk Discounts',  desc: 'Buy more, save more' },
  { icon: <RefreshCw size={16} strokeWidth={2.5} />,    title: 'Easy Returns',    desc: '7-day policy' },
  { icon: <Shield size={16} strokeWidth={2.5} />,       title: '100% Genuine',    desc: 'Authentic products' },
];

/* ── COMPONENT ── */

export default function Home() {
  const [bannerIdx, setBannerIdx] = useState(0);
  const [showSheet, setShowSheet] = useState(false);
  const [shopTab, setShopTab]       = useState<'brand' | 'category'>('brand');
  const [bestSellers, setBestSellers] = useState<Product[]>([]);
  const [newArrivals, setNewArrivals] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [dynamicBrands, setDynamicBrands] = useState<string[]>([]);
  const [dynamicCategories, setDynamicCategories] = useState<string[]>([]);
  const [drillBrand, setDrillBrand] = useState<string | null>(null);
  const location = useLocation();

  useEffect(() => {
    const t = setInterval(() => setBannerIdx(i => (i + 1) % BANNERS.length), 4500);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if ((location.state as any)?.justLoggedIn) {
      setShowSheet(true);
      window.history.replaceState({}, '');
    }
  }, []);

  const [allCategories, setAllCategories] = useState<string[]>([]);

  // Loading Home Data
  useEffect(() => {
    const loadHomeData = async () => {
      try {
        const res = await fetchProducts({ limit: 12 });
        const transformed = res.data.map(transformStockItemToProduct);
        setBestSellers(transformed.slice(0, 8));
        setNewArrivals(transformed.slice(8, 12));

        const bList = await fetchBrands();
        setDynamicBrands(bList.slice(0, 16));
        
        const cList = await fetchCategories();
        setAllCategories(cList);
      } catch (error) {
        console.error('Failed to load home data:', error);
      } finally {
        setLoading(false);
      }
    };
    loadHomeData();
  }, []);

  // Drill-down logic for categories
  useEffect(() => {
    fetchCategories('', drillBrand ?? '').then(res => {
      setDynamicCategories(res.slice(0, 16));
    });
  }, [drillBrand]);

  const b = BANNERS[bannerIdx];
  const showCta = !b.categoryKey || allCategories.includes(b.categoryKey);

  return (
    <div className="pb-1 md:pb-2">

      {/* ═══════════ 1. HERO BANNER ═══════════ */}
      <div className="px-3 sm:px-4 pt-3 max-w-7xl mx-auto">
        <div
          className="relative rounded-2xl overflow-hidden transition-colors duration-500"
          style={{ background: b.bg, minHeight: 156 }}
        >
          <div className="flex items-center px-5 py-6 sm:px-8 sm:py-8 md:px-10 gap-4 md:gap-8">
            {/* Text */}
            <div className="flex-1 min-w-0">
              <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold leading-tight mb-1.5"
                style={{ color: b.textColor }}>
                {b.title}
              </h2>
              <p className="text-xs sm:text-sm font-medium mb-4 line-clamp-2"
                style={{ color: b.subColor, maxWidth: '38ch' }}>
                {b.sub}
              </p>
              {showCta && (
                <Link to={b.link}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-extrabold transition-all hover:opacity-90 active:scale-95"
                  style={{ background: 'white', color: '#1C1C1C', boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}>
                  {b.cta} <ArrowRight size={14} />
                </Link>
              )}
            </div>
            {/* Emoji illustration */}
            <div className="flex-shrink-0 flex items-center justify-center w-20 sm:w-28 md:w-36">
              <span className="text-6xl sm:text-7xl md:text-[96px] select-none drop-shadow-lg leading-none block">
                {b.emoji}
              </span>
            </div>
          </div>

          {/* Dots */}
          <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
            {BANNERS.map((_, i) => (
              <button key={i} onClick={() => setBannerIdx(i)}
                className="rounded-full transition-all duration-300"
                style={{
                  width: i === bannerIdx ? 16 : 5,
                  height: 5,
                  background: i === bannerIdx ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.4)',
                }} />
            ))}
          </div>

          {/* Arrows — desktop only */}
          <button onClick={() => setBannerIdx(i => (i - 1 + BANNERS.length) % BANNERS.length)}
            className="hidden md:flex absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full items-center justify-center z-20 bg-white/80 hover:bg-white transition-all">
            <ChevronLeft size={16} strokeWidth={2.5} />
          </button>
          <button onClick={() => setBannerIdx(i => (i + 1) % BANNERS.length)}
            className="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full items-center justify-center z-20 bg-white/80 hover:bg-white transition-all">
            <ChevronRight size={16} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* ═══════════ 2. PERKS STRIP ═══════════ */}
      <div className="px-3 sm:px-4 pt-3 max-w-7xl mx-auto">
        <div className="bg-white rounded-xl overflow-x-auto scrollbar-hide" style={{ border: '1px solid #E8E8E8' }}>
          <div className="flex min-w-max md:min-w-0" style={{ borderColor: '#F2F2F2' }}>
            {PERKS.map((p, i) => (
              <div key={p.title}
                className="flex items-center gap-2 px-4 py-3 flex-shrink-0"
                style={{ borderLeft: i > 0 ? '1px solid #F2F2F2' : 'none' }}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: '#EFF7EF', color: '#0C831F' }}>
                  {p.icon}
                </div>
                <div>
                  <p className="text-[11px] font-bold leading-tight text-gray-900">{p.title}</p>
                  <p className="text-[10px] leading-tight" style={{ color: '#9E9E9E' }}>{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════════ 3. SHOP BY BRAND / CATEGORY ═══════════ */}
      <div className="px-3 sm:px-4 pt-3 max-w-7xl mx-auto">
        <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1px solid #E8E8E8' }}>

          {/* Header */}
          <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-3">
            {/* Tab switcher */}
            <div className="flex p-0.5 rounded-xl gap-0.5" style={{ background: '#F2F2F2' }}>
              <button
                onClick={() => setShopTab('brand')}
                className="px-3 py-1.5 rounded-[10px] text-[11px] font-bold transition-all"
                style={shopTab === 'brand' ? { background: '#0C831F', color: 'white' } : { background: 'transparent', color: '#666' }}>
                By Brand
              </button>
              <button
                onClick={() => setShopTab('category')}
                className="px-3 py-1.5 rounded-[10px] text-[11px] font-bold transition-all relative"
                style={shopTab === 'category' ? { background: '#0C831F', color: 'white' } : { background: 'transparent', color: '#666' }}>
                By Category {drillBrand && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500 border border-white" />}
              </button>
            </div>
            {drillBrand ? (
              <button
                onClick={() => setDrillBrand(null)}
                className="flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-1.5 rounded-lg active:scale-95 transition-all truncate max-w-[120px]"
                style={{ background: '#EFF7EF', color: '#0C831F' }}>
                <ChevronLeft size={10} strokeWidth={3} /> {drillBrand}
              </button>
            ) : (
              <Link
                to="/products"
                className="flex items-center gap-1 text-[11px] font-bold hover:gap-1.5 transition-all flex-shrink-0"
                style={{ color: '#0C831F' }}>
                See all <ArrowRight size={11} />
              </Link>
            )}
          </div>

          {/* 2-row horizontal scroll grid */}
          <div
            className="scrollbar-hide px-4 pb-4"
            style={{ display: 'grid', gridTemplateRows: 'repeat(2, auto)', gridAutoFlow: 'column', overflowX: 'auto', gap: 10 }}>

            {shopTab === 'brand'
              /* Brand grid: clicking a brand filters the category tab */
              ? dynamicBrands.map((b, i) => (
                  <button
                    key={b}
                    onClick={() => {
                      setDrillBrand(b);
                      setShopTab('category');
                    }}
                    className="flex flex-col items-center gap-1.5 py-2.5 px-1.5 rounded-xl transition-all hover:-translate-y-0.5 hover:shadow-sm group"
                    style={{ width: 80, background: getColor(i), minHeight: 80 }}>
                    <span className="text-2xl group-hover:scale-110 transition-transform duration-200 leading-none flex-shrink-0">{getBrandEmoji(b)}</span>
                    <span className="text-[9px] font-bold text-center leading-tight text-gray-800 w-full" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{b}</span>
                  </button>
                ))
              /* Category grid: clicking a category navigates to products */
              : dynamicCategories.map((cat, i) => (
                  <Link
                    key={cat}
                    to={`/products?category=${encodeURIComponent(cat)}${drillBrand ? `&brand=${encodeURIComponent(drillBrand)}` : ''}`}
                    className="flex flex-col items-center gap-1.5 py-2.5 px-1.5 rounded-xl transition-all hover:-translate-y-0.5 hover:shadow-sm group"
                    style={{ width: 80, background: getColor(i), minHeight: 80 }}>
                    <span className="text-2xl group-hover:scale-110 transition-transform duration-200 leading-none flex-shrink-0">{getCategoryEmoji(cat)}</span>
                    <span className="text-[9px] font-bold text-center leading-tight text-gray-800 w-full" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{cat}</span>
                  </Link>
                ))
            }
          </div>
        </div>
      </div>

      {/* ═══════════ 4. BEST SELLERS ═══════════ */}
      <div className="px-3 sm:px-4 pt-3 max-w-7xl mx-auto">
        <div className="bg-white rounded-2xl p-4" style={{ border: '1px solid #E8E8E8' }}>
          <SectionHeader title="Best Sellers" badge="🔥 HOT" link="/products" />
          <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1 snap-x md:grid md:grid-cols-4 md:overflow-visible md:gap-4">
            {loading ? (
              [...Array(4)].map((_, i) => (
                <div key={i} className="animate-pulse rounded-xl bg-gray-100 flex-shrink-0 w-[44vw] sm:w-[38vw] md:w-auto" style={{ height: 260 }}></div>
              ))
            ) : (
              bestSellers.map(p => (
                <div key={p.id} className="snap-start flex-shrink-0 w-[44vw] sm:w-[38vw] md:w-auto">
                  <ProductCard product={p} />
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ═══════════ 5. BULK ORDER BANNER ═══════════ */}
      <div className="px-3 sm:px-4 pt-3 max-w-7xl mx-auto">
        <div className="rounded-2xl overflow-hidden" style={{ background: '#1C1C1C' }}>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 px-5 py-6 md:px-8 md:py-7">
            <div>
              <span className="inline-block text-[9px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-md mb-2"
                style={{ background: 'rgba(248,196,32,0.15)', color: '#F8C420' }}>
                Bulk Order Benefits
              </span>
              <h3 className="text-lg md:text-xl font-extrabold text-white mb-1">
                Wholesale & Institutional Orders
              </h3>
              <p className="text-xs md:text-sm font-medium" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Special pricing for schools, offices, and bulk buyers. Contact us for a custom quote.
              </p>
            </div>
            <div className="flex gap-2.5 flex-shrink-0">
              <Link to="/products"
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all hover:opacity-90"
                style={{ background: '#F8C420', color: '#1C1C1C' }}>
                <Zap size={13} /> Shop Bulk
              </Link>
              <Link to="/products"
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap"
                style={{ background: 'rgba(255,255,255,0.08)', color: 'white', border: '1px solid rgba(255,255,255,0.12)' }}>
                Learn More <ArrowRight size={12} />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════ 6. NEW ARRIVALS ═══════════ */}
      <div className="px-3 sm:px-4 pt-3 max-w-7xl mx-auto">
        <div className="bg-white rounded-2xl p-4" style={{ border: '1px solid #E8E8E8' }}>
          <SectionHeader title="New Arrivals" badge="✨ NEW" link="/products" />
          <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1 snap-x md:grid md:grid-cols-4 md:overflow-visible md:gap-4">
            {loading ? (
              [...Array(4)].map((_, i) => (
                <div key={i} className="animate-pulse rounded-xl bg-gray-100 flex-shrink-0 w-[44vw] sm:w-[38vw] md:w-auto" style={{ height: 260 }}></div>
              ))
            ) : (
              newArrivals.map(p => (
                <div key={p.id} className="snap-start flex-shrink-0 w-[44vw] sm:w-[38vw] md:w-auto">
                  <ProductCard product={p} />
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {showSheet && <PostLoginSheet onClose={() => setShowSheet(false)} />}

      {/* ═══════════ 7. WHY PPW ═══════════ */}
      <div className="px-3 sm:px-4 pt-4 pb-0 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { 
              icon: <Building2 size={18} />, 
              color: '#0C831F', 
              label: 'Direct Wholesale', 
              desc: 'Manufacturer direct sourcing for max savings' 
            },
            { 
              icon: <PackageCheck size={18} />, 
              color: '#F8C420', 
              label: 'Verified Quality', 
              desc: 'Every item manually inspected for standards' 
            },
            { 
              icon: <Headphones size={18} />, 
              color: '#1C1C1C', 
              label: 'Priority Support', 
              desc: 'Dedicated assistance for business accounts' 
            },
          ].map((v, i) => (
            <div key={i} className="bg-white rounded-xl p-3.5 shadow-sm hover:shadow-md transition-all active:scale-[0.98]" 
              style={{ border: '1px solid #E8E8E8' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" 
                  style={{ background: `${v.color}15`, color: v.color }}>
                  {v.icon}
                </div>
                <div className="min-w-0">
                  <h4 className="text-[12px] font-extrabold text-[#1C1C1C] leading-none mb-1">{v.label}</h4>
                  <p className="text-[10px] font-medium leading-tight text-[#666] truncate">{v.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

/* ── Section Header ── */
function SectionHeader({ title, badge, link }: { title: string; badge?: string; link: string }) {
  return (
    <div className="flex items-center justify-between mb-3 gap-2">
      <div className="flex items-center gap-2">
        <span className="w-1 h-5 rounded-full flex-shrink-0" style={{ background: '#0C831F' }} />
        <h2 className="text-sm md:text-base font-extrabold text-gray-900">{title}</h2>
        {badge && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md"
            style={{ background: '#EFF7EF', color: '#0C831F' }}>
            {badge}
          </span>
        )}
      </div>
      <Link to={link}
        className="flex items-center gap-1 text-[11px] font-bold transition-all hover:gap-1.5 flex-shrink-0"
        style={{ color: '#0C831F' }}>
        See all <ArrowRight size={11} />
      </Link>
    </div>
  );
}
