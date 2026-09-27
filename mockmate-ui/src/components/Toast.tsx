import { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle, Info, WarningCircle, X, type Icon } from '@phosphor-icons/react';

type ToastType = 'error' | 'success' | 'info';

// Optional inline action, e.g. "Undo" after a destructive edit.
export interface ToastAction {
    label: string;
    onClick: () => void;
}

interface Toast {
    id: number;
    message: string;
    type: ToastType;
    action?: ToastAction;
}

interface ToastContextValue {
    showToast: (message: string, type?: ToastType, action?: ToastAction) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastType, Icon> = {
    error: WarningCircle,
    success: CheckCircle,
    info: Info,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = useCallback((message: string, type: ToastType = 'info', action?: ToastAction) => {
        const id = Date.now() + Math.random();
        setToasts((prev) => [...prev, { id, message, type, action }]);
        // Errors and actionable toasts stay longer so they can be read and used.
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, type === 'error' || action ? 7000 : 4500);
    }, []);

    const dismiss = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <div className="toast-container" role="status" aria-live="polite">
                {toasts.map((t) => {
                    const ToastIcon = ICONS[t.type];
                    return (
                        <div key={t.id} className={`toast toast-${t.type}`}>
                            <ToastIcon className="toast-icon" size={18} weight="fill" aria-hidden="true" />
                            <span className="toast-msg">{t.message}</span>
                            {t.action && (
                                <button
                                    type="button"
                                    className="toast-action"
                                    onClick={() => { t.action!.onClick(); dismiss(t.id); }}
                                >
                                    {t.action.label}
                                </button>
                            )}
                            <button type="button" className="toast-close" onClick={() => dismiss(t.id)} aria-label="Dismiss notification">
                                <X size={14} aria-hidden="true" />
                            </button>
                        </div>
                    );
                })}
            </div>
        </ToastContext.Provider>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used within a ToastProvider');
    return ctx.showToast;
}
