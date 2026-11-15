/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   GlassCard — Glass surface container
   Props:
     level: 1 | 2 | 3 (default 2)
     hoverable: boolean (adds lift + accent border glow)
     className: string
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
export default function GlassCard({
  level = 2,
  hoverable = false,
  className = '',
  children,
  ...props
}) {
  const glassClass = `glass-${level}`
  const hoverClass = hoverable ? 'glass-hoverable' : ''
  const classes = [glassClass, hoverClass, className].filter(Boolean).join(' ')

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  )
}

