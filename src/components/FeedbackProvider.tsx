import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';

type ToastTone = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger' | 'warning';
  details?: React.ReactNode;
}

interface ConfirmState extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

interface FeedbackContextValue {
  notify: (message: string, tone?: ToastTone) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const FeedbackContext = createContext<FeedbackContextValue | undefined>(undefined);

const toastStyles: Record<ToastTone, { wrapper: string; icon: React.ReactNode }> = {
  success: {
    wrapper: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    icon: <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
  },
  error: {
    wrapper: 'border-rose-200 bg-rose-50 text-rose-800',
    icon: <XCircle className="h-4 w-4 text-rose-600" />,
  },
  info: {
    wrapper: 'border-blue-200 bg-blue-50 text-blue-800',
    icon: <Info className="h-4 w-4 text-blue-600" />,
  },
};

export const FeedbackProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const nextIdRef = useRef(1);

  const notify = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = nextIdRef.current++;
    setToasts((current) => [...current, { id, tone, message }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3200);
  }, []);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setConfirmState({ ...options, resolve });
      }),
    [],
  );

  const value = useMemo<FeedbackContextValue>(
    () => ({
      notify,
      confirm,
    }),
    [confirm, notify],
  );

  const closeConfirm = (confirmed: boolean) => {
    setConfirmState((current) => {
      if (!current) {
        return current;
      }

      current.resolve(confirmed);
      return null;
    });
  };

  return (
    <FeedbackContext.Provider value={value}>
      {children}

      <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-full max-w-sm flex-col gap-3">
        {toasts.map((toast) => {
          const style = toastStyles[toast.tone];
          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-lg ${style.wrapper}`}
            >
              <div className="mt-0.5 shrink-0">{style.icon}</div>
              <p className="flex-1 text-sm font-semibold">{toast.message}</p>
              <button
                type="button"
                onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}
                className="rounded-md p-1 opacity-70 transition hover:bg-white/40 hover:opacity-100"
                aria-label="Dismiss notification"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>

      {confirmState && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start gap-3 border-b border-slate-100 pb-4">
              <div
                className={`rounded-xl p-2 ${
                  confirmState.tone === 'danger'
                    ? 'bg-rose-100 text-rose-700'
                    : confirmState.tone === 'warning'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-blue-100 text-blue-700'
                }`}
              >
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">{confirmState.title}</h3>
                <p className="text-sm text-slate-600">{confirmState.message}</p>
                {confirmState.details && <div className="pt-2">{confirmState.details}</div>}
              </div>
            </div>

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => closeConfirm(false)}
                className="w-1/2 rounded-xl bg-slate-100 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-200"
              >
                {confirmState.cancelLabel ?? 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => closeConfirm(true)}
                className={`w-1/2 rounded-xl py-2.5 text-sm font-bold text-white transition ${
                  confirmState.tone === 'danger'
                  ? 'bg-rose-600 hover:bg-rose-700'
                    : confirmState.tone === 'warning'
                      ? 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                      : 'bg-blue-600 hover:bg-blue-500'
                }`}
              >
                {confirmState.confirmLabel ?? 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </FeedbackContext.Provider>
  );
};

export const useFeedback = () => {
  const context = useContext(FeedbackContext);
  if (!context) {
    throw new Error('useFeedback must be used within FeedbackProvider.');
  }

  return context;
};
