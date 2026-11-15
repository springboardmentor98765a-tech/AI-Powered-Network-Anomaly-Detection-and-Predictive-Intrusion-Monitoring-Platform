/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Spinner — Loading indicator
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
export default function Spinner({ size = 20, color = 'currentColor', className = '' }) {
  return (
    <svg
      className={className}
      style={{
        width: size,
        height: size,
        animation: 'spin 0.75s linear infinite',
        display: 'inline-block',
        verticalAlign: 'middle',
      }}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.5"
      strokeLinecap="round"
      aria-label="Loading"
      role="status"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="rgba(255, 255, 255, 0.15)"
        strokeWidth="2.5"
      />
      <path d="M12 2a10 10 0 0 1 10 10" />
    </svg>
  )
}

