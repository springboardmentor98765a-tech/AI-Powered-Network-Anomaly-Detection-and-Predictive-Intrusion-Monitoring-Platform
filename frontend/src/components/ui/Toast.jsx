/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Toast — Provider & Hook for notifications
   Types: success | error | info
   Auto-dismiss: 4s
   Accessible: aria-live="polite"
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
import { createContext, useContext, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'
import GlassCard from './GlassCard'

const ToastContext = createContext(null)

let toastSeq = 0

const ICONS = {
  success: <CheckCircle2 size={18} style={{ color: 'var(--success)' }} />,
  error:   <AlertCircle size={18} style={{ color: 'var(--danger)' }} />,
  info:    <Info size={18} style={{ color: 'var(--info)' }} />,
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const removeToast = useCallback((id) => {
    setToasts((current) => current.filter((t) => t.id !== id))
  }, [])

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++toastSeq
    setToasts((current) => [...current, { id, message, type }])

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id)
      }, duration)
    }
  }, [removeToast])

  const success = useCallback((msg, dur) => addToast(msg, 'success', dur), [addToast])
  const error   = useCallback((msg, dur) => addToast(msg, 'error', dur), [addToast])
  const info    = useCallback((msg, dur) => addToast(msg, 'info', dur), [addToast])

  return (
    <ToastContext.Provider value={{ addToast, success, error, info, removeToast }}>
      {children}
      {createPortal(
        <div
          role="region"
          aria-live="polite"
          aria-label="Notifications"
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            maxWidth: '380px',
            pointerEvents: 'none',
          }}
        >
          {toasts.map((toast) => (
            <div
              key={toast.id}
              style={{
                pointerEvents: 'auto',
                animation: 'toast-in 200ms ease',
              }}
            >
              <GlassCard
                level={3}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
                  border: '1px solid var(--glass-border-strong)',
                }}
              >
                <div style={{ flexShrink: 0 }}>
                  {ICONS[toast.type] || ICONS.info}
                </div>
                <div style={{ flex: 1, fontSize: '13px', color: 'var(--text)', wordBreak: 'break-word' }}>
                  {toast.message}
                </div>
                <button
                  type="button"
                  onClick={() => removeToast(toast.id)}
                  style={{
                    color: 'var(--text-muted)',
                    padding: '2px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    borderRadius: '4px',
                  }}
                  aria-label="Dismiss toast"
                >
                  <X size={14} />
                </button>
              </GlassCard>
            </div>
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>')
  return ctx
}

