import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

const copper = '#b8804a';
const copperDark = '#9a6a3c';

interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    isDangerous?: boolean;
    onSecondaryConfirm?: () => void;
    secondaryConfirmText?: string;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
    isOpen, onClose, onConfirm, title, message,
    confirmText = 'Confirm', cancelText = 'Cancel',
    isDangerous = false, onSecondaryConfirm, secondaryConfirmText
}) => {
    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-fade-in"
            style={{ background: 'rgba(44,30,15,0.4)', backdropFilter: 'blur(4px)' }}
        >
            <div
                className="w-full max-w-sm rounded-2xl overflow-hidden relative"
                style={{ background: 'rgba(253,248,243,0.98)', border: '1px solid rgba(184,128,74,0.18)', boxShadow: '0 20px 60px rgba(44,30,15,0.25)' }}
            >
                <button
                    onClick={onClose}
                    className="absolute top-3.5 right-3.5 p-1.5 rounded-lg transition-colors"
                    style={{ color: '#a8a29e' }}
                >
                    <X size={18} />
                </button>

                <div className="p-6 text-center">
                    <div
                        className="mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4"
                        style={{
                            background: isDangerous ? 'rgba(239,68,68,0.08)' : 'rgba(184,128,74,0.1)',
                            color: isDangerous ? '#ef4444' : copper,
                        }}
                    >
                        <AlertTriangle size={22} />
                    </div>
                    <h3 className="text-base font-extrabold mb-2" style={{ color: '#2c1e0f' }}>{title}</h3>
                    <p className="text-sm font-medium leading-relaxed" style={{ color: '#8c7a68' }}>{message}</p>
                </div>

                <div className="px-4 pb-5 flex flex-col gap-2.5">
                    {onSecondaryConfirm && secondaryConfirmText ? (
                        <>
                            <button
                                onClick={() => { onSecondaryConfirm(); onClose(); }}
                                className="w-full py-3 rounded-xl font-bold text-[13px] text-white transition-all active:scale-95"
                                style={{ background: 'linear-gradient(145deg, #22c55e, #16a34a)', boxShadow: '0 4px 14px rgba(34,197,94,0.3)', border: 'none' }}
                            >
                                {secondaryConfirmText}
                            </button>
                            <button
                                onClick={() => { onConfirm(); onClose(); }}
                                className="w-full py-3 rounded-xl font-bold text-[13px] transition-all active:scale-95"
                                style={isDangerous
                                    ? { background: 'rgba(239,68,68,0.07)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }
                                    : { background: 'rgba(184,128,74,0.07)', color: copper, border: '1px solid rgba(184,128,74,0.2)' }
                                }
                            >
                                {confirmText}
                            </button>
                        </>
                    ) : (
                        <div className="flex gap-2.5">
                            <button
                                onClick={onClose}
                                className="flex-1 py-3 rounded-xl font-bold text-[13px] transition-all active:scale-95"
                                style={{ background: 'rgba(184,128,74,0.06)', color: '#8c7a68', border: '1px solid rgba(184,128,74,0.15)' }}
                            >
                                {cancelText}
                            </button>
                            <button
                                onClick={() => { onConfirm(); onClose(); }}
                                className="flex-1 py-3 rounded-xl font-bold text-[13px] text-white transition-all active:scale-95"
                                style={isDangerous
                                    ? { background: 'linear-gradient(145deg, #ef4444, #dc2626)', boxShadow: '0 4px 14px rgba(239,68,68,0.3)', border: 'none' }
                                    : { background: `linear-gradient(145deg, ${copper}, ${copperDark})`, boxShadow: '0 4px 14px rgba(184,128,74,0.3)', border: 'none' }
                                }
                            >
                                {confirmText}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
