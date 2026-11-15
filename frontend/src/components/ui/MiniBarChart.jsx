/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   MiniBarChart — Plain CSS horizontal/vertical bar chart
   Accepts data: [{ label, value }]
   Uses lime accent for bars, zero third-party chart libraries.
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
export default function MiniBarChart({ data = [] }) {
  if (!data || data.length === 0) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
        No category data available
      </div>
    )
  }

  const maxValue = Math.max(...data.map((d) => d.value || 0), 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%' }}>
      {data.map((item, idx) => {
        const pct = Math.round(((item.value || 0) / maxValue) * 100)
        return (
          <div key={item.label || idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ color: 'var(--text)', fontWeight: 500 }}>{item.label}</span>
              <span className="mono" style={{ color: 'var(--accent)', fontWeight: 600 }}>
                {item.value}
              </span>
            </div>

            <div
              style={{
                width: '100%',
                height: '8px',
                background: 'rgba(255, 255, 255, 0.06)',
                borderRadius: '4px',
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              <div
                style={{
                  width: `${pct}%`,
                  height: '100%',
                  background: 'var(--accent)',
                  borderRadius: '4px',
                  boxShadow: '0 0 10px var(--accent-glow)',
                  transition: 'width 400ms ease',
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

