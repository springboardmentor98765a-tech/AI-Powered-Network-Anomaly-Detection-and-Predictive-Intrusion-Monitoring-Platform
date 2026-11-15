/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Modal — Accessible glass-3 modal
   - role="dialog", aria-modal="true"
   - Closes on Esc and backdrop click
   - Focuses first field/focusable element on open
   - Restores focus to trigger on close
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import GlassCard from './GlassCard'

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = '500px',
}) {
  const modalRef = useRef(null)
  const previousActiveElement = useRef(null)

  useEffect(() => {
    if (!isOpen) return

    // Save previously focused element to restore upon close
    previousActiveElement.current = document.activeElement

    // Prevent background scrolling
    const origOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // Focus the first focusable child or modal itself
    const timer = setTimeout(() => {
      if (modalRef.current) {
        const focusable = modalRef.current.querySelector(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        if (focusable) {
          focusable.focus()
        } else {
          modalRef.current.focus()
        }
      }
    }, 50)

    // Keydown handler for Esc
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose?.()
      }
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      clearTimeout(timer)
      document.body.style.overflow = origOverflow
      window.removeEventListener('keydown', handleKeyDown)
      if (previousActiveElement.current && previousActiveElement.current.focus) {
        previousActiveElement.current.focus()
      }
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        padding: '20px',
        animation: 'fade-in 150ms ease',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose?.()
        }
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        tabIndex={-1}
        style={{
          width: '100%',
          maxWidth: `min(calc(100vw - 32px), ${maxWidth})`,
          outline: 'none',
          animation: 'modal-in 180ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <GlassCard
          level={3}
          style={{
            padding: '24px',
            position: 'relative',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '20px',
            }}
          >
            {title && (
              <h3 id="modal-title" style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text)' }}>
                {title}
              </h3>
            )}
            <button
              type="button"
              onClick={onClose}
              className="btn-glass btn-sm"
              style={{
                padding: '6px',
                borderRadius: 'var(--radius-sm)',
                marginLeft: 'auto',
                lineHeight: 0,
              }}
              aria-label="Close dialog"
            >
              <X size={16} />
            </button>
          </div>

          <div>{children}</div>
        </GlassCard>
      </div>
    </div>,
    document.body
  )
}

