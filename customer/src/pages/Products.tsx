import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SlidersHorizontal, X, ChevronLeft, ChevronRight } from 'lucide-react';
import ProductCard, { type Product } from '../components/ProductCard';
import { fetchProducts, transformStockItemToProduct, fetchBrands, fetchCategories, fetchThumbnails } from '../api';

const SORT_OPTIONS = [
  { label: 'Relevance',          value: 'relevance' },
  { label: 'Price: Low to High', value: 'price_asc' },
  { label: 'Price: High to Low', value: 'price_desc' },
  { label: 'Top Rated',          value: 'rating' },
];

export default function Products() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [sort, setSort]           = useState('relevance');
  const [maxPrice, setMaxPrice]   = useState(10000);
  const [minRating, setMinRating] = useState(0);
  const [filtersOpen, setFilters] = useState(false);
  const [products, setProducts]   = useState<Product[]>([]);
  const [filtered, setFiltered]   = useState<Product[]>([]);
  const [loading, setLoading]     = useState(true);
  const [page, setPage]           = useState(Number(searchParams.get('page')) || 1);
  const [totalPages, setTotalPages] = useState(1);
  const [dynamicBrands, setDynamicBrands]         = useState<string[]>([]);
  const [dynamicCategories, setDynamicCategories] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'brand' | 'category'>(
    (searchParams.get('brand') || searchParams.get('category')) ? 'category' : 'brand'
  );

  const search        = searchParams.get('search')   ?? '';
  const brandParam    = searchParams.get('brand')    ?? '';
  const categoryParam = searchParams.get('category') ?? '';

  // Parse comma-separated values from URL into Sets
  const selectedBrands = useMemo(
    () => new Set(brandParam ? brandParam.split(',').filter(Boolean) : []),
    [brandParam],
  );
  const selectedCategories = useMemo(
    () => new Set(categoryParam ? categoryParam.split(',').filter(Boolean) : []),
    [categoryParam],
  );

  // Fetch products whenever filters change
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetchProducts({
          page,
          limit: 100,
          search,
          brands:     [...selectedBrands],
          categories: [...selectedCategories],
        });
        const mapped = res.data.map(transformStockItemToProduct);
        setTotalPages(res.pagination.totalPages);
        // Attach thumbnails in background — don't block render
        setProducts(mapped);
        const masterids = res.data.map(i => i.masterid).filter(Boolean) as string[];
        fetchThumbnails(masterids).then(thumbs => {
          setProducts(prev => prev.map(p => p.masterid && thumbs[p.masterid] ? { ...p, image: thumbs[p.masterid] } : p));
        });
      } catch (e) {
        console.error('Failed to fetch products:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [search, brandParam, categoryParam, page]);

  // Load Brands once
  useEffect(() => {
    fetchBrands().then(setDynamicBrands).catch(console.error);
  }, []);

  // Faceted filtering for categories: whenever brands change, re-fetch categories for those brands
  useEffect(() => {
    fetchCategories('', brandParam)
      .then(setDynamicCategories)
      .catch(console.error);
  }, [brandParam]);

  // Client-side sort + price / rating filter
  useEffect(() => {
    let r = [...products].filter(p => p.price <= maxPrice);
    if (minRating > 0) r = r.filter(p => (p.rating ?? 0) >= minRating);
    if (sort === 'price_asc')  r.sort((a, b) => a.price - b.price);
    if (sort === 'price_desc') r.sort((a, b) => b.price - a.price);
    if (sort === 'rating')     r.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    setFiltered(r);
  }, [products, sort, maxPrice, minRating]);

  // Sync page from URL
  useEffect(() => {
    const p = Number(searchParams.get('page')) || 1;
    if (p !== page) setPage(p);
  }, [searchParams]);

  const handlePageChange = (newPage: number) => {
    const p = new URLSearchParams(searchParams);
    p.set('page', newPage.toString());
    setSearchParams(p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleBrand = (b: string) => {
    const next = new Set(selectedBrands);
    next.has(b) ? next.delete(b) : next.add(b);
    const p = new URLSearchParams(searchParams);
    next.size > 0 ? p.set('brand', [...next].join(',')) : p.delete('brand');
    p.delete('page');
    setSearchParams(p);
  };

  const toggleCategory = (cat: string) => {
    const next = new Set(selectedCategories);
    next.has(cat) ? next.delete(cat) : next.add(cat);
    const p = new URLSearchParams(searchParams);
    next.size > 0 ? p.set('category', [...next].join(',')) : p.delete('category');
    p.delete('page');
    setSearchParams(p);
  };

  const clearAll = () => {
    setMinRating(0);
    setMaxPrice(10000);
    setSearchParams(new URLSearchParams());
  };

  const hasFilters = selectedBrands.size > 0 || selectedCategories.size > 0 || !!search || minRating > 0 || maxPrice < 1500;

  const title = search
    ? `Results for "${search}"`
    : selectedBrands.size === 1
      ? [...selectedBrands][0]
      : selectedBrands.size > 1
        ? `${selectedBrands.size} Brands`
        : 'All Products';

  const activeChipCount = selectedBrands.size + selectedCategories.size;

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3">

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between mb-3 gap-2">
        <div>
          <h1 className="text-base font-extrabold text-gray-900">{title}</h1>
          <p className="text-xs" style={{ color: '#9E9E9E' }}>{filtered.length} products</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={sort} onChange={e => setSort(e.target.value)}
            className="text-sm font-medium rounded-lg px-3 py-1.5 outline-none bg-white"
            style={{ border: '1px solid #E8E8E8', color: '#1C1C1C' }}>
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button
            onClick={() => setFilters(!filtersOpen)}
            className="md:hidden flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg bg-white relative"
            style={{ border: '1px solid #E8E8E8', color: '#1C1C1C' }}>
            <SlidersHorizontal size={14} /> Filters
            {activeChipCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full text-[10px] font-extrabold text-white flex items-center justify-center"
                style={{ background: '#0C831F' }}>{activeChipCount}</span>
            )}
          </button>
        </div>
      </div>

       {/* ── Active filter chips ── */}
       {activeChipCount > 0 && (
         <div className="flex flex-nowrap items-center gap-1.5 mb-3 overflow-x-auto scrollbar-hide pb-1">
          {[...selectedBrands].map(b => (
            <button key={b} onClick={() => toggleBrand(b)}
              className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full transition-all hover:opacity-80"
              style={{ background: '#EFF7EF', color: '#0C831F', border: '1px solid rgba(12,131,31,0.25)' }}>
              {b} <X size={10} />
            </button>
          ))}
           {[...selectedCategories].map(c => (
             <button key={c} onClick={() => toggleCategory(c)}
               className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full transition-all hover:opacity-80 whitespace-nowrap"
               style={{ background: '#FFF3E0', color: '#E65100', border: '1px solid rgba(230,81,0,0.25)' }}>
               {c} <X size={10} />
             </button>
           ))}
          <button onClick={clearAll}
            className="text-[11px] font-bold px-2.5 py-1 rounded-full transition-all hover:opacity-80"
            style={{ background: 'rgba(226,55,68,0.08)', color: '#E23744', border: '1px solid rgba(226,55,68,0.2)' }}>
            Clear all
          </button>
        </div>
      )}

      <div className="flex gap-3">

        {/* ── Sidebar ── */}
        <aside
          className={`${filtersOpen ? 'block' : 'hidden'} md:block flex-shrink-0`}
          style={{ width: 200 }}
        >
          <div className="bg-white rounded-xl overflow-hidden mb-3" style={{ border: '1px solid #E8E8E8' }}>
            {/* Header: tabs */}
            <div className="flex gap-1 p-2" style={{ borderBottom: '1px solid #F2F2F2', background: '#FAFAFA' }}>
              <button
                onClick={() => setActiveTab('brand')}
                className="flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-all"
                style={activeTab === 'brand' ? { background: '#0C831F', color: 'white' } : { background: '#F2F2F2', color: '#666' }}>
                By Brand
              </button>
              <button
                onClick={() => setActiveTab('category')}
                className="flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-all"
                style={activeTab === 'category' ? { background: '#0C831F', color: 'white' } : { background: '#F2F2F2', color: '#666' }}>
                By Category
              </button>
            </div>

            {/* List area (Checkbox search) */}
            <ul style={{ maxHeight: '42vh', overflowY: 'auto' }} className="py-1">
              {(activeTab === 'brand' ? dynamicBrands : dynamicCategories).map(item => {
                const isSelected = activeTab === 'brand' ? selectedBrands.has(item) : selectedCategories.has(item);
                return (
                  <li key={item}>
                    <label className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-gray-50 transition-colors">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => activeTab === 'brand' ? toggleBrand(item) : toggleCategory(item)}
                        className="flex-shrink-0"
                        style={{ accentColor: '#0C831F', width: 14, height: 14 }}
                      />
                      <span
                        className="text-xs leading-tight flex-1"
                        style={{ color: '#333', fontWeight: isSelected ? 700 : 400 }}
                      >
                        {item}
                      </span>
                    </label>
                  </li>
                );
              })}
              {(activeTab === 'brand' ? dynamicBrands : dynamicCategories).length === 0 && (
                <li className="px-3 py-4 text-center text-[10px] text-gray-400 font-medium">No {activeTab}s found</li>
              )}
            </ul>
          </div>

          {/* MAX PRICE */}
          <div className="bg-white rounded-xl p-3 mb-3" style={{ border: '1px solid #E8E8E8' }}>
            <h3 className="text-[11px] font-extrabold text-gray-900 uppercase tracking-wide mb-3">Max Price</h3>
            <input type="range" min={50} max={1500} step={50} value={maxPrice}
              onChange={e => setMaxPrice(Number(e.target.value))}
              className="w-full" style={{ accentColor: '#0C831F' }} />
            <div className="flex justify-between text-xs font-semibold mt-1.5">
              <span style={{ color: '#9E9E9E' }}>₹50</span>
              <span style={{ color: '#0C831F' }}>₹{maxPrice}</span>
            </div>
          </div>

          {/* MIN RATING */}
          <div className="bg-white rounded-xl p-3 mb-3" style={{ border: '1px solid #E8E8E8' }}>
            <h3 className="text-[11px] font-extrabold text-gray-900 uppercase tracking-wide mb-3">Min Rating</h3>
            <div className="space-y-1.5">
              {[0, 3, 4, 4.5].map(r => (
                <label key={r} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="rating" checked={minRating === r}
                    onChange={() => setMinRating(r)}
                    style={{ accentColor: '#0C831F' }} />
                  <span className="text-xs" style={{ color: '#444' }}>
                    {r === 0 ? 'All ratings' : `${r}★ & above`}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* CLEAR */}
          {hasFilters && (
            <button onClick={clearAll}
              className="flex items-center gap-1.5 w-full justify-center text-sm font-bold py-2.5 rounded-xl transition-all"
              style={{ background: 'rgba(226,55,68,0.08)', color: '#E23744', border: '1.5px solid rgba(226,55,68,0.18)' }}>
              <X size={13} /> Clear filters
            </button>
          )}
        </aside>

        {/* ── Product Grid ── */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="animate-pulse rounded-xl bg-gray-100" style={{ height: 300 }} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 rounded-2xl bg-white"
              style={{ border: '1px solid #E8E8E8' }}>
              <span className="text-5xl mb-3">🔍</span>
              <p className="text-base font-extrabold text-gray-900">No products found</p>
              <p className="text-sm mt-1" style={{ color: '#9E9E9E' }}>Try adjusting your filters or search term</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                {filtered.map(p => <ProductCard key={p.id} product={p} />)}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-8 mb-4">
                  <button disabled={page === 1} onClick={() => handlePageChange(page - 1)}
                    className="p-2 rounded-lg bg-white border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50">
                    <ChevronLeft size={20} />
                  </button>
                  <div className="flex items-center gap-1">
                    {[...Array(Math.min(5, totalPages))].map((_, i) => {
                      let pageNum = page;
                      if (page <= 3)                  pageNum = i + 1;
                      else if (page >= totalPages - 2) pageNum = totalPages - 4 + i;
                      else                             pageNum = page - 2 + i;
                      if (pageNum <= 0 || pageNum > totalPages) return null;
                      return (
                        <button key={pageNum} onClick={() => handlePageChange(pageNum)}
                          className={`w-10 h-10 rounded-lg font-bold text-sm transition-all ${
                            page === pageNum
                              ? 'bg-green-700 text-white'
                              : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                          }`}>
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  <button disabled={page === totalPages} onClick={() => handlePageChange(page + 1)}
                    className="p-2 rounded-lg bg-white border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50">
                    <ChevronRight size={20} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}


