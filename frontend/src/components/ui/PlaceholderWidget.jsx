/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   PlaceholderWidget — Visible future module placeholder
   Dashed glass border, icon, title, one-line description,
   and "Arrives with Module N" label.
   NEVER shows invented numbers as if they were real data.
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
import Badge from './Badge'

export default function PlaceholderWidget({
  icon: Icon,
  title,
  description,
  moduleNumber,
  className = '',
  minHeight = '140px',
}) {
  return (
    <div
      className={className}
      style={{
        background: 'var(--glass-1)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        border: '1px dashed var(--glass-border-strong)',
        borderRadius: 'var(--radius-lg)',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: '16px',
        minHeight,
        position: 'relative',
        opacity: 0.88,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {Icon && (
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--glass-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)',
                flexShrink: 0,
              }}
            >
              <Icon size={20} />
            </div>
          )}
          <div>
            <h4 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)', margin: 0 }}>
              {title}
            </h4>
            {description && (
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                {description}
              </p>
            )}
          </div>
        </div>

        {moduleNumber && (
          <Badge variant="neutral" size="sm">
            Arrives with Module {moduleNumber}
          </Badge>
        )}
      </div>

      <div
        style={{
          borderTop: '1px dashed var(--glass-border)',
          paddingTop: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '12px',
          color: 'var(--text-muted)',
        }}
      >
        <span>Telemetry & analytics engine inactive</span>
        <span className="mono">STAGED</span>
      </div>
    </div>
  )
}

