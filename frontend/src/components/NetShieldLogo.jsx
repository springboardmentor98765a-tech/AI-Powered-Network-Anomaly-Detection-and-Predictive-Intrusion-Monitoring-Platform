/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   NetShieldLogo — Original shield/network logo mark as SVG.
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
export default function NetShieldLogo({ size = 28 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'inline-block', flexShrink: 0 }}
      aria-hidden="true"
    >
      {/* Outer shield outline */}
      <path
        d="M16 3L5 7.5V14.8C5 21.8 9.7 28.3 16 30C22.3 28.3 27 21.8 27 14.8V7.5L16 3Z"
        fill="rgba(149, 255, 80, 0.12)"
        stroke="var(--accent)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Network nodes & interconnecting links */}
      <path
        d="M16 9V16M16 16L11 20M16 16L21 20"
        stroke="var(--accent)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="16" cy="9" r="2" fill="var(--accent)" />
      <circle cx="16" cy="16" r="2.5" fill="#ffffff" />
      <circle cx="11" cy="20" r="1.8" fill="var(--accent)" />
      <circle cx="21" cy="20" r="1.8" fill="var(--accent)" />
    </svg>
  )
}

