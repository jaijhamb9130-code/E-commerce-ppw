import axios from 'axios';

const isCapacitor = (window as any).Capacitor !== undefined;
// Priority: 
// 1. Env Var (Production/Custom)
// 2. Capacitor Fallback (Local Network)
// 3. Proxy Fallback (Development)
const API_URL = import.meta.env.VITE_API_URL || (isCapacitor ? 'http://192.168.1.19:3000' : '/api');

const api = axios.create({
    baseURL: API_URL,
});

// Add a request interceptor to inject the token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Add a response interceptor to handle 401 errors
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/admin/login';
        }
        return Promise.reject(error);
    }
);

// Dashboard stats
export const getDashboardStats = async () => {
    const response = await api.get('/dashboard/stats');
    return response.data;
};

// Separate sync endpoints
export const syncLedgers = async () => {
    const response = await api.post('/sync/ledgers');
    return response.data;
};

export const syncStockItems = async () => {
    const response = await api.post('/sync/stock-items');
    return response.data;
};

// Paginated endpoints
export const getLedgers = async (page = 1, limit = 50, search = '') => {
    const response = await api.get('/reports/ledgers', {
        params: { page, limit, search },
    });
    return response.data;
};

export const getStockItems = async (page = 1, limit = 50, search = '', category = '', parent = '') => {
    const response = await api.get('/reports/stock-items', {
        params: { page, limit, search, category, parent },
    });
    return response.data;
};

export const getOnlineOrders = async (page = 1, limit = 50, search = '') => {
    return getOrders(page, limit, search, undefined, undefined, undefined, undefined, undefined, 'online');
};

export const getCustomers = async (page = 1, limit = 50, search = '') => {
    const response = await api.get('/reports/customers-online', {
        params: { page, limit, search },
    });
    return response.data;
};

export const getOrders = async (page = 1, limit = 50, search = '', orderType = '', userIdOverride?: number, date?: string, range?: string, status = '', source = '') => {
    const user = getUser();
    const response = await api.get('/reports/orders', {
        params: {
            page,
            limit,
            search,
            user_id: userIdOverride || ((user.role === 'admin' || (user.permissions || []).includes('orders') || (user.permissions || []).includes('reports')) ? undefined : user.id),
            role: user.role,
            show_all: 'true',
            order_type: orderType || undefined,
            date: date || undefined,
            range: range || undefined,
            status: status || undefined,
            source: source || undefined
        },
    });
    return response.data;
};

export const getOrderById = async (id: number) => {
    const response = await api.get(`/orders/${id}`);
    return response.data;
};

export const getOrderDetails = async (id: number) => {
    const response = await api.get(`/orders/${id}/details`);
    return response.data;
};

export const getOrdersByCustomerPhone = async (phone: string) => {
    const response = await api.get(`/orders/customer/${phone}`);
    return response.data;
};

export const deleteOrder = async (id: number) => {
    const response = await api.delete(`/orders/${id}`);
    return response.data;
};

export const syncOrderToTally = async (id: number) => {
    const response = await api.post(`/orders/${id}/sync`);
    return response.data;
};

// Online Order Management
export const updateOrderItemStatus = async (itemIds: number[], status: 'approved' | 'rejected') => {
    const response = await api.patch('/orders/items/bulk-status', { itemIds, status });
    return response.data;
};

export const editOrderItem = async (id: number, data: { quantity?: number, rate?: number, discount_percentage?: number }) => {
    const response = await api.patch(`/orders/items/${id}`, data);
    return response.data;
};

export const finalizeOrder = async (id: number) => {
    const response = await api.patch(`/orders/${id}/finalize`);
    return response.data;
};

export const syncOnlineOrders = async () => {
    const response = await api.post('/orders/online/sync');
    return response.data;
};

// User Management
export const getUsers = async () => {
    const response = await api.get('/users');
    return response.data;
};

export const createUser = async (userData: any) => {
    const response = await api.post('/users', userData);
    return response.data;
};

export interface Ledger {
    id: number;
    name: string;
    tally_guid?: string;
}
export const updateUser = async (id: number, userData: any) => {
    const response = await api.patch(`/users/${id}`, userData);
    return response.data;
};

export const deleteUser = async (id: number) => {
    const response = await api.delete(`/users/${id}`);
    return response.data;
};

// Safe User Parser
export const getUser = () => {
    try {
        const userStr = localStorage.getItem('user');
        if (!userStr || userStr === 'undefined' || userStr === 'null') return {};
        return JSON.parse(userStr);
    } catch (e) {
        return {};
    }
};
// Item Details
export const getItemDetails = async (masterid: string) => {
    const response = await api.get(`/item-details/${masterid}`);
    return response.data;
};

export const saveItemDetails = async (masterid: string, formData: FormData) => {
    const response = await api.post(`/item-details/${masterid}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
};

export const deleteItemImage = async (masterid: string, slot: number) => {
    const response = await api.delete(`/item-details/${masterid}/image/${slot}`);
    return response.data;
};

export default api;
