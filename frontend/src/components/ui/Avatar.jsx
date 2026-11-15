/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Avatar — Generates initials and deterministic background
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
import { initials } from '../../utils/format'

const TINTS = [
  'rgba(149, 255, 80, 0.18)',
  'rgba(56, 189, 248, 0.18)',
  'rgba(167, 139, 250, 0.18)',
  'rgba(251, 191, 36, 0.18)',
  'rgba(52, 211, 153, 0.18)',
]

function getTint(name = '') {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return TINTS[Math.abs(hash) % TINTS.length]
}

export default function Avatar({ name = '', size = 34, className = '' }) {
  const letters = initials(name)
  const bg = getTint(name)

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        borderRadius: '50%',
        backgroundColor: bg,
        border: '1px solid var(--glass-border)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: Math.max(11, Math.round(size * 0.38)),
        fontWeight: 700,
        color: 'var(--text)',
        userSelect: 'none',
      }}
      aria-label={name}
      title={name}
    >
      {letters}
    </div>
  )
}

