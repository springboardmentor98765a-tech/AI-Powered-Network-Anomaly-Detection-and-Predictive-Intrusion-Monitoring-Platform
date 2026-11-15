/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   EmptyState — Helpful placeholder when lists/tables are empty
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
import GlassCard from './GlassCard'

export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className = '',
}) {
  return (
    <GlassCard
      level={1}
      className={className}
      style={{
        padding: '48px 24px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
      }}
    >
      {Icon && (
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: 'var(--glass-2)',
            border: '1px solid var(--glass-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
            marginBottom: '4px',
          }}
        >
          <Icon size={24} />
        </div>
      )}

      {title && (
        <h4 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text)' }}>
          {title}
        </h4>
      )}

      {description && (
        <p style={{ maxWidth: '400px', fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
          {description}
        </p>
      )}

      {action && <div style={{ marginTop: '8px' }}>{action}</div>}
    </GlassCard>
  )
}

