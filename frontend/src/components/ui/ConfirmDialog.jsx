/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ConfirmDialog — Built on Modal with danger and neutral variants
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
import Modal from './Modal'
import Spinner from './Spinner'

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDanger = false,
  loading = false,
}) {
  return (
    <Modal isOpen={isOpen} onClose={loading ? () => {} : onClose} title={title} maxWidth="420px">
      <div style={{ marginBottom: '24px' }}>
        <p style={{ fontSize: '14px', color: 'var(--text)', lineHeight: 1.5 }}>
          {message}
        </p>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '12px',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          className="btn-glass"
          disabled={loading}
        >
          {cancelText}
        </button>

        <button
          type="button"
          onClick={onConfirm}
          className={isDanger ? 'btn-danger' : 'btn-primary'}
          disabled={loading}
        >
          {loading && <Spinner size={16} />}
          {confirmText}
        </button>
      </div>
    </Modal>
  )
}

