import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

const copper = '#b8804a';

type ToastType = 'success' | 'error' | 'warning' | 'info';
interface Toast { id: number; message: string; type: ToastType; }
interface ToastContextType { showToast: (message: string, type: ToastType) => void; }

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used within a ToastProvider');
    return ctx;
};

const toastConfig = {
    success: { icon: CheckCircle, bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.2)', iconBg: 'rgba(34,197,94,0.1)', iconColor: '#22c55e' },
    error:   { icon: AlertCircle, bg: 'rgba(239,68,68,0.07)', border: 'rgba(239,68,68,0.2)', iconBg: 'rgba(239,68,68,0.1)', iconColor: '#ef4444' },
    warning: { icon: AlertTriangle, bg: 'rgba(245,158,11,0.07)', border: 'rgba(245,158,11,0.2)', iconBg: 'rgba(245,158,11,0.1)', iconColor: '#f59e0b' },
    info:    { icon: Info, bg: 'rgba(184,128,74,0.07)', border: 'rgba(184,128,74,0.2)', iconBg: 'rgba(184,128,74,0.1)', iconColor: copper },
};

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = useCallback((message: string, type: ToastType) => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
    }, []);

    const removeToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <div className="fixed bottom-20 right-4 z-[9999] flex flex-col gap-2">
                {toasts.map(toast => {
                    const cfg = toastConfig[toast.type];
                    const Icon = cfg.icon;
                    return (
                        <div
                            key={toast.id}
                            className="min-w-[260px] max-w-sm px-4 py-3 rounded-xl flex items-center gap-3 slide-in-right"
                            style={{
                                background: 'rgba(253,248,243,0.97)',
                                backdropFilter: 'blur(12px)',
                                border: `1px solid ${cfg.border}`,
                                boxShadow: '0 8px 24px rgba(44,30,15,0.12)',
                            }}
                        >
                            <div className="p-1.5 rounded-full flex-shrink-0" style={{ background: cfg.iconBg, color: cfg.iconColor }}>
                                <Icon size={16} />
                            </div>
                            <p className="text-[13px] font-semibold flex-1" style={{ color: '#2c1e0f' }}>{toast.message}</p>
                            <button
                                onClick={() => removeToast(toast.id)}
                                className="p-1 rounded-lg flex-shrink-0 transition-colors"
                                style={{ color: '#a8a29e' }}
                            >
                                <X size={14} />
                            </button>
                        </div>
                    );
                })}
            </div>
        </ToastContext.Provider>
    );
};
