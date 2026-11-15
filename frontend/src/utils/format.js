/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Formatting utilities — no external dependencies.
   Dates use Intl so they always display in the
   viewer's local time zone, as required by the spec.
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

/** Format an ISO string into a readable local date+time. */
export function formatDateTime(iso) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso))
}

/** Format an ISO string as a relative "3 hours ago" string. */
export function timeAgo(iso) {
  if (!iso) return '—'
  const diffMs = Date.now() - new Date(iso).getTime()
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
  const mins  = Math.round(diffMs / 60_000)
  if (Math.abs(mins)  < 60)   return rtf.format(-mins,            'minute')
  const hours = Math.round(diffMs / 3_600_000)
  if (Math.abs(hours) < 24)   return rtf.format(-hours,           'hour')
  const days  = Math.round(diffMs / 86_400_000)
  return rtf.format(-days, 'day')
}

/**
 * Derive initials from a full name.
 * "John Doe" → "JD",  "Alice" → "A",  "" → "?"
 */
export function initials(name) {
  if (!name) return '?'
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w[0].toUpperCase())
    .slice(0, 2)
    .join('')
}

