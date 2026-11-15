/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   AppBackground — Layered background with 3 blurred orbs
   and faint network dot-grid. Rendered once behind everything.
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
export default function AppBackground() {
  return (
    <div className="app-bg" aria-hidden="true">
      <div className="app-bg-orb orb-lime" />
      <div className="app-bg-orb orb-cyan" />
      <div className="app-bg-orb orb-violet" />
      <div className="app-bg-grid" />
    </div>
  )
}

