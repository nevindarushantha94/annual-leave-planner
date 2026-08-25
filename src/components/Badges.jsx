export function SeatBadge({ groupLabel, slotLabel }) {
  if (!groupLabel) return null
  return (
    <span className="inline-flex items-center gap-1 rounded-sm bg-primary-tint px-1.5 py-0.5 font-mono text-[11px] font-medium text-primary">
      {groupLabel}
      {slotLabel ? <span className="text-primary/60">·{slotLabel}</span> : null}
    </span>
  )
}

export function TeamBadge({ teamName }) {
  if (!teamName) return null
  return (
    <span className="inline-flex items-center rounded-sm bg-accent-tint px-1.5 py-0.5 font-mono text-[11px] font-medium text-accent">
      {teamName}
    </span>
  )
}

export function HodBadge() {
  return (
    <span className="inline-flex items-center rounded-sm bg-hod-tint px-1.5 py-0.5 font-mono text-[11px] font-medium text-hod">
      HOD
    </span>
  )
}

export function ContextBadges({ role, seatGroupLabel, slotLabel, teamName }) {
  return (
    <span className="inline-flex items-center gap-1">
      {role === 'HOD' && <HodBadge />}
      <SeatBadge groupLabel={seatGroupLabel} slotLabel={slotLabel} />
      <TeamBadge teamName={teamName} />
      {role !== 'HOD' && !seatGroupLabel && !teamName && (
        <span className="inline-flex items-center rounded-sm bg-ink-faint/10 px-1.5 py-0.5 font-mono text-[11px] font-medium text-ink-muted">
          Standalone
        </span>
      )}
    </span>
  )
}
