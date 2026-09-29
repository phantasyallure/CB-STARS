// Small dependency-free SVG charts for the analytics page.

export const CHART_COLORS = {
  accepted: '#3f7d4f',
  pending: '#c99a4b',
  refused: '#b3261e',
}

// Daily stacked bars. data: [{ label, accepted, pending, refused }]
export function StackedBars({ data, ariaLabel }) {
  const W = 720
  const H = 220
  const pad = { top: 12, right: 8, bottom: 26, left: 30 }
  const innerW = W - pad.left - pad.right
  const innerH = H - pad.top - pad.bottom
  const max = Math.max(1, ...data.map((d) => d.accepted + d.pending + d.refused))
  const niceMax = max <= 4 ? max : Math.ceil(max / 4) * 4
  const step = innerW / Math.max(1, data.length)
  const barW = Math.max(3, Math.min(26, step * 0.68))
  const every = Math.ceil(data.length / 8)
  const ticks = [0, 0.5, 1].map((f) => Math.round(niceMax * f))

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel}>
      {ticks.map((tv) => {
        const y = pad.top + innerH - (tv / niceMax) * innerH
        return (
          <g key={tv}>
            <line x1={pad.left} x2={W - pad.right} y1={y} y2={y} className="chart__grid" />
            <text x={pad.left - 6} y={y + 4} textAnchor="end" className="chart__tick">{tv}</text>
          </g>
        )
      })}
      {data.map((d, i) => {
        const x = pad.left + i * step + (step - barW) / 2
        let y = pad.top + innerH
        const segs = [
          ['accepted', d.accepted],
          ['pending', d.pending],
          ['refused', d.refused],
        ]
        return (
          <g key={d.label + i}>
            <title>{`${d.label}: ${d.accepted + d.pending + d.refused}`}</title>
            {segs.map(([key, val]) => {
              if (!val) return null
              const h = (val / niceMax) * innerH
              y -= h
              return <rect key={key} x={x} y={y} width={barW} height={h} rx="2" fill={CHART_COLORS[key]} />
            })}
            {i % every === 0 && (
              <text x={x + barW / 2} y={H - 8} textAnchor="middle" className="chart__tick">{d.label}</text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

// Donut. segments: [{ label, value, color }]
export function Donut({ segments, centerValue, centerLabel, ariaLabel }) {
  const size = 180
  const r = 66
  const c = 2 * Math.PI * r
  const total = segments.reduce((s, x) => s + x.value, 0)
  let offset = 0

  return (
    <svg className="chart chart--donut" viewBox={`0 0 ${size} ${size}`} role="img" aria-label={ariaLabel}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--a-border)" strokeWidth="22" />
      {total > 0 &&
        segments.map((s) => {
          if (!s.value) return null
          const len = (s.value / total) * c
          const el = (
            <circle
              key={s.label}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth="22"
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            >
              <title>{`${s.label}: ${s.value}`}</title>
            </circle>
          )
          offset += len
          return el
        })}
      <text x="50%" y="50%" textAnchor="middle" className="chart__donut-value">{centerValue}</text>
      <text x="50%" y="50%" dy="20" textAnchor="middle" className="chart__donut-label">{centerLabel}</text>
    </svg>
  )
}

// Horizontal bars. items: [{ label, value, sub? }]
export function HBars({ items, empty }) {
  if (items.length === 0) return <p className="adm-hint">{empty}</p>
  const max = Math.max(1, ...items.map((i) => i.value))
  return (
    <ul className="hbars">
      {items.map((i) => (
        <li key={i.label}>
          <div className="hbars__row">
            <span className="hbars__label">{i.label}</span>
            <span className="hbars__value">{i.value}</span>
          </div>
          <div className="hbars__track">
            <div className="hbars__fill" style={{ width: `${(i.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}
