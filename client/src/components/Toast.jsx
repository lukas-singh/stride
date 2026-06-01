import { createContext, useCallback, useContext, useState } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const push = useCallback((message, type = 'success', duration = 3200) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => dismiss(id), duration);
  }, [dismiss]);

  const toast = {
    success: (m) => push(m, 'success'),
    error: (m) => push(m, 'error'),
    info: (m) => push(m, 'info'),
    trophy: (m) => push(m, 'trophy', 4000),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 w-full max-w-[440px] px-3 space-y-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            onClick={() => dismiss(t.id)}
            className={`pointer-events-auto card px-4 py-3 text-sm font-medium shadow-lg route-fade flex items-center gap-2 ${
              t.type === 'success'
                ? 'border-primary/50 text-primary'
                : t.type === 'error'
                ? 'border-danger/50 text-danger'
                : t.type === 'trophy'
                ? 'border-primary text-primary shadow-glow'
                : 'border-secondary/50 text-secondary'
            }`}
          >
            <span>{t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : t.type === 'trophy' ? '🏆' : 'ℹ'}</span>
            <span className={t.type === 'trophy' ? 'text-primary font-semibold' : 'text-txt'}>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
