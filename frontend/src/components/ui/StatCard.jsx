/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   StatCard — Metrics tile for dashboards
   Props: icon, label, value, hint, loading
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
import GlassCard from './GlassCard'
import Skeleton from './Skeleton'

export default function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  loading = false,
  className = '',
}) {
  return (
    <GlassCard level={2} className={className} style={{ padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-muted)' }}>
          {label}
        </span>
        {Icon && (
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(149, 255, 80, 0.08)',
              border: '1px solid rgba(149, 255, 80, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent)',
            }}
          >
            <Icon size={18} />
          </div>
        )}
      </div>

      {loading ? (
        <>
          <Skeleton width="60%" height="28px" style={{ marginBottom: '8px' }} />
          {hint && <Skeleton width="40%" height="14px" />}
        </>
      ) : (
        <>
          <div style={{ fontSize: '26px', fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}>
            {value ?? '—'}
          </div>
          {hint && (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
              {hint}
            </div>
          )}
        </>
      )}
    </GlassCard>
  )
}

