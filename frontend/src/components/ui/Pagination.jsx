/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Pagination — Shared pagination controls
   Props:
     page: current page number (1-indexed)
     hasNext: boolean
     onChange: callback(newPageNumber)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function Pagination({ page = 1, hasNext = false, onChange }) {
  const hasPrev = page > 1

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 20px',
        borderTop: '1px solid var(--glass-border)',
        flexWrap: 'wrap',
        gap: '12px',
      }}
    >
      <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
        Page <span style={{ fontWeight: 600, color: 'var(--text)' }}>{page}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          type="button"
          className="btn-glass btn-sm"
          disabled={!hasPrev}
          onClick={() => onChange(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft size={16} />
          <span>Previous</span>
        </button>

        <button
          type="button"
          className="btn-glass btn-sm"
          disabled={!hasNext}
          onClick={() => onChange(page + 1)}
          aria-label="Next page"
        >
          <span>Next</span>
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}

