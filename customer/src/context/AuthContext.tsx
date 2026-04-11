import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

interface User {
  id: number;
  name: string;
  email: string;
  phone: string;
  shopName: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  updateUser: (fields: Partial<Pick<User, 'name' | 'phone' | 'shopName' | 'email'>>) => void;
  isLoggedIn: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem('customer_token');
    const savedUser = localStorage.getItem('customer_user');
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const login = (token: string, user: User) => {
    localStorage.setItem('customer_token', token);
    localStorage.setItem('customer_user', JSON.stringify(user));
    setToken(token);
    setUser(user);
  };

  const logout = () => {
    localStorage.removeItem('customer_token');
    localStorage.removeItem('customer_user');
    setToken(null);
    setUser(null);
  };

  const updateUser = (fields: Partial<Pick<User, 'name' | 'phone' | 'shopName' | 'email'>>) => {
    if (!user) return;
    const updated = { ...user, ...fields };
    setUser(updated);
    localStorage.setItem('customer_user', JSON.stringify(updated));
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, updateUser, isLoggedIn: !!token, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
