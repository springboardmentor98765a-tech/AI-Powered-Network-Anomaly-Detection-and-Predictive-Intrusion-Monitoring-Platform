/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   FormField — Wrapper providing label, hint, and error text
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
export default function FormField({
  label,
  id,
  hint,
  error,
  required = false,
  children,
  className = '',
}) {
  return (
    <div className={className} style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
      {label && (
        <label
          htmlFor={id}
          style={{
            fontSize: '13px',
            fontWeight: 500,
            color: 'var(--text)',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          {label}
          {required && <span style={{ color: 'var(--danger)' }}>*</span>}
        </label>
      )}

      {children}

      {hint && !error && (
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          {hint}
        </span>
      )}

      {error && (
        <span
          style={{
            fontSize: '12px',
            color: 'var(--danger)',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
          role="alert"
        >
          {error}
        </span>
      )}
    </div>
  )
}

