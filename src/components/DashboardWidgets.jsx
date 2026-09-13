import Icon from './Icons'

/**
 * Widget dashboard — semua tanpa library eksternal.
 * Grafik dibuat dari SVG/CSS murni supaya ringan & tetap tajam di semua ukuran layar.
 */

/* ---------- Kartu KPI ---------- */
export function StatCard({ label, value, icon, tone = '', hint, delta, href }) {
  const deltaClass = delta == null ? '' : delta > 0 ? 'delta-up' : delta < 0 ? 'delta-down' : 'delta-flat'
  const deltaIcon = delta == null ? null : delta > 0 ? 'trendingUp' : delta < 0 ? 'trendingDown' : null

  const inner = (
    <>
      <div className="stat-head">
        <span className="stat-label">{label}</span>
        {icon && (
          <span className={`stat-icon ${tone ? `is-${tone}` : ''}`} aria-hidden="true">
            <Icon name={icon} size={15} />
          </span>
        )}
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-foot">
        {delta != null && (
          <span className={`delta ${deltaClass}`}>
            {deltaIcon && <Icon name={deltaIcon} size={12} />}
            {delta > 0 ? '+' : ''}{delta.toFixed(1)}%
          </span>
        )}
        {hint && <span className="stat-hint">{hint}</span>}
      </div>
    </>
  )

  if (href) {
    return (
      <a href={href} className="stat-card" style={{ textDecoration: 'none' }}>
        {inner}
      </a>
    )
  }
  return <div className="stat-card">{inner}</div>
}

/* ---------- Grafik garis (SVG murni) ---------- */
export function Sparkline({ values = [], labels = [], height = 34, ariaLabel }) {
  const w = 100
  const h = height
  const safe = values.length ? values : [0]
  const max = Math.max(...safe)
  const min = Math.min(...safe, 0)
  const span = max - min || 1
  const step = safe.length > 1 ? w / (safe.length - 1) : w

  const points = safe.map((v, i) => [
    i * step,
    h - ((v - min) / span) * (h - 8) - 4,
  ])
  const line = points.map((p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ')
  const area = `0,${h} ${line} ${w},${h}`
  const last = points[points.length - 1]
  const flat = max === min

  return (
    <svg
      className="spark"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={ariaLabel || 'Grafik tren 7 hari terakhir'}
    >
      {!flat && <polygon className="spark-area" points={area} />}
      <polyline className="spark-line" points={line} vectorEffect="non-scaling-stroke" />
      {last && <circle className="spark-dot" cx={last[0]} cy={last[1]} r="1.6" vectorEffect="non-scaling-stroke" />}
    </svg>
  )
}

/* ---------- Skeleton saat memuat ---------- */
export function SkeletonStat() {
  return (
    <div className="stat-card" aria-hidden="true">
      <div className="stat-head">
        <div className="skeleton skeleton-text" style={{ width: 78, marginBottom: 0 }} />
        <div className="skeleton" style={{ width: 28, height: 28, borderRadius: 6 }} />
      </div>
      <div className="skeleton skeleton-metric" style={{ marginTop: 8 }} />
      <div className="skeleton skeleton-text" style={{ width: 96, marginTop: 8 }} />
    </div>
  )
}

export function SkeletonRows({ rows = 4 }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div className="list-item" key={i}>
          <div className="skeleton" style={{ width: 30, height: 30, borderRadius: 6 }} />
          <div className="list-body">
            <div className="skeleton skeleton-text" style={{ width: `${55 + ((i * 13) % 30)}%` }} />
            <div className="skeleton skeleton-text" style={{ width: '30%', marginBottom: 0 }} />
          </div>
        </div>
      ))}
    </div>
  )
}

/* ---------- Keadaan kosong ---------- */
export function EmptyBlock({ icon = 'inbox', title, message, action }) {
  return (
    <div className="empty-state" role="status">
      <Icon name={icon} size={30} />
      <h3>{title}</h3>
      {message && <p className="text-sm">{message}</p>}
      {action}
    </div>
  )
}

/* ---------- Bar stok ---------- */
export function StockBar({ value, max = 20 }) {
  const pct = Math.min(100, Math.max(2, (Number(value) || 0) / max * 100))
  const tone = Number(value) <= 0 ? 'is-danger' : Number(value) <= 5 ? 'is-warning' : ''
  return (
    <div className="bar" role="presentation">
      <div className={`bar-fill ${tone}`} style={{ width: `${pct}%` }} />
    </div>
  )
}
