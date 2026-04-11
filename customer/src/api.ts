import axios from 'axios';

// Ensure this matches the Vite proxy configuration
const api = axios.create({
  baseURL: '/api',
});

// Response Types
export interface PaginationConfig {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface StockItem {
  id: number;
  masterid: string;
  name: string;
  parent: string | null;
  base_units: string | null;
  hsn: string | null;
  closing_balance: string | null;
  opening_balance: string | null;
  gst: string | null;
  default_mrp: string | null; // e.g., "50.00/Pcs"
  ats_barcode: string | null;
  group: string | null;
  category: string | null;
  is_active: boolean;
}

export interface PaginatedStockItems {
  data: StockItem[];
  pagination: PaginationConfig;
}

export interface ItemDetail {
  id: number;
  masterid: string;
  description: string;
}

export interface ItemImage {
  id: number;
  masterid: string;
  image_slot: number;
  image_url: string; // The relative path in the backend's public dir
}

export interface FullItemDetail {
  details?: ItemDetail;
  images?: ItemImage[];
}

import type { Product } from './components/ProductCard';

export const transformStockItemToProduct = (item: StockItem): any => {
  // Parse MRP: "50.00/Pcs" -> 50
  const mrpMatch = item.default_mrp ? item.default_mrp.match(/^([-+]?[0-9]*\.?[0-9]+)/) : null;
  const mrp = mrpMatch ? parseFloat(mrpMatch[1]) : 0;
  
  // For now, price = mrp (or slightly less if we want to show a discount)
  // Let's make price the same as MRP for now as there's no separate 'sale price' in DB yet
  const price = mrp;

  // Parse stock: "124.00 Pcs" -> 124
  const stockMatch = item.closing_balance ? item.closing_balance.match(/^([-+]?[0-9]*\.?[0-9]+)/) : null;
  const stock = stockMatch ? parseFloat(stockMatch[1]) : 0;

  // Strip leading numeric item codes (e.g. "000041 " or "1234-")
  let cleanName = item.name ?? '';
  
  // 1. Remove masterid if it matches the start exactly
  if (item.masterid && cleanName.startsWith(item.masterid)) {
    cleanName = cleanName.slice(item.masterid.length).trimStart();
  }
  
  // 2. Remove common Tally numeric patterns (e.g. "000041 ", "123/") 
  // This regex matches leading digits followed by space, slash, or dash
  cleanName = cleanName.replace(/^[0-9\-\/]+\s+/, '');
  
  // 3. Final trim and fallback
  cleanName = cleanName.trim() || item.name;

  return {
    id: item.id,
    masterid: item.masterid,
    name: cleanName || 'Unnamed Item',
    price: price,
    mrp: mrp,
    category: item.group || item.category || 'General',
    brand: item.parent || '',
    unit: item.base_units || 'pcs',
    rating: 0,
    reviews: 0,
    inStock: stock > 0,
  };
};

export const fetchProducts = async (params: {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  brand?: string;
  brands?: string[];
  categories?: string[];
}): Promise<PaginatedStockItems> => {
  const customParams: any = {
    page: params.page || 1,
    limit: params.limit || 100,
    search: params.search || '',
  };

  const brands = params.brands ?? (params.brand ? [params.brand] : []);
  const categories = params.categories ?? (params.category && params.category !== 'All' ? [params.category] : []);

  if (brands.length > 0) {
    customParams.parent = brands.join(',');
  }
  if (categories.length > 0) {
    customParams.category = categories.join(',');
  }

  const { data } = await api.get('/reports/stock-items', { params: customParams });
  return data;
};

export const fetchBrands = async (search: string = ''): Promise<string[]> => {
  const { data } = await api.get('/stock-items/brands', { params: { search } });
  return data;
};

export const fetchCategories = async (search: string = '', brand: string = ''): Promise<string[]> => {
  const { data } = await api.get('/stock-items/categories', { params: { search, brand } });
  // Filter out placeholder/empty Tally values
  return (data as string[]).filter(c => c && c.toLowerCase() !== 'not applicable');
};

export const fetchProductDetail = async (masterid: string): Promise<FullItemDetail> => {
    // Some products might not have details, we handle gracefully
    try {
        const { data } = await api.get(`/item-details/${masterid}`);
        return data;
    } catch (e) {
        console.warn(`Could not fetch details for masterid ${masterid}`);
        return {};
    }
};

export const fetchSingleProduct = async (id: number): Promise<Product | null> => {
  try {
    const { data } = await api.get(`/reports/stock-items/${id}`);
    return transformStockItemToProduct(data);
  } catch (error) {
    console.error(`Failed to fetch product ${id}:`, error);
    return null;
  }
};

export const fetchCustomerOrders = async (phone: string): Promise<any[]> => {
  try {
    const { data } = await api.get(`/orders/customer/${phone}`);
    return data;
  } catch (error) {
    console.error('Failed to fetch customer orders:', error);
    return [];
  }
};

export const fetchCustomerProfile = async (phone: string): Promise<any> => {
  try {
    const { data } = await api.get(`/customers/${phone}/profile`);
    return data;
  } catch (error) {
    return null;
  }
};

export default api;
