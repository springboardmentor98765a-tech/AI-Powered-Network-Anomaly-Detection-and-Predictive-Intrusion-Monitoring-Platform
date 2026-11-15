/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Badge — Status and role pills
   Variants: success | danger | warning | info | neutral | accent
   Note: Lime accent is NOT used for "success".
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const VARIANT_STYLES = {
  success: {
    bg: 'rgba(52, 211, 153, 0.12)',
    color: 'var(--success)',
    border: 'rgba(52, 211, 153, 0.28)',
  },
  danger: {
    bg: 'rgba(248, 113, 113, 0.12)',
    color: 'var(--danger)',
    border: 'rgba(248, 113, 113, 0.28)',
  },
  warning: {
    bg: 'rgba(251, 191, 36, 0.12)',
    color: 'var(--warning)',
    border: 'rgba(251, 191, 36, 0.28)',
  },
  info: {
    bg: 'rgba(56, 189, 248, 0.12)',
    color: 'var(--info)',
    border: 'rgba(56, 189, 248, 0.28)',
  },
  neutral: {
    bg: 'rgba(255, 255, 255, 0.08)',
    color: 'var(--text-muted)',
    border: 'var(--glass-border)',
  },
  accent: {
    bg: 'rgba(149, 255, 80, 0.12)',
    color: 'var(--accent)',
    border: 'rgba(149, 255, 80, 0.3)',
  },
}

export default function Badge({
  variant = 'neutral',
  children,
  className = '',
  size = 'md',
}) {
  const styleConf = VARIANT_STYLES[variant] || VARIANT_STYLES.neutral
  const isSm = size === 'sm'

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: isSm ? '2px 6px' : '3px 9px',
        fontSize: isSm ? '11px' : '12px',
        fontWeight: 600,
        borderRadius: '9999px',
        backgroundColor: styleConf.bg,
        color: styleConf.color,
        border: `1px solid ${styleConf.border}`,
        lineHeight: 1.2,
        letterSpacing: '0.01em',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  )
}

