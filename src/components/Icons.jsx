/**
 * Icons — set ikon SVG inline.
 * Alasan: emoji tampil beda-beda tiap OS/perangkat dan tidak bisa diwarnai.
 * SVG stroke-based → konsisten, tajam, ikut warna teks (currentColor), 0 KB dependensi.
 */

const PATHS = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </>
  ),
  cart: (
    <>
      <circle cx="9" cy="20" r="1.4" />
      <circle cx="18" cy="20" r="1.4" />
      <path d="M2 3h2.2l2.4 12.2a1.6 1.6 0 0 0 1.6 1.3h9.6a1.6 1.6 0 0 0 1.6-1.3L21 7H5" />
    </>
  ),
  receipt: (
    <>
      <path d="M5 3h14v18l-2.3-1.6L14.4 21l-2.4-1.6L9.6 21l-2.3-1.6L5 21z" />
      <path d="M9 8h6M9 12h6" />
    </>
  ),
  lock: (
    <>
      <rect x="4" y="10.5" width="16" height="10.5" rx="2" />
      <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
    </>
  ),
  ticket: (
    <>
      <path d="M3 8.5V6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v2.5a2.4 2.4 0 0 0 0 7V18a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-2.5a2.4 2.4 0 0 0 0-7z" />
      <path d="M13 5v14" strokeDasharray="2 2.5" />
    </>
  ),
  box: (
    <>
      <path d="M21 8.2v7.6a1.6 1.6 0 0 1-.85 1.42l-7 3.6a1.6 1.6 0 0 1-1.5 0l-7-3.6A1.6 1.6 0 0 1 3.8 15.8V8.2a1.6 1.6 0 0 1 .85-1.42l7-3.6a1.6 1.6 0 0 1 1.5 0l7 3.6A1.6 1.6 0 0 1 21 8.2z" />
      <path d="M3.9 7.3 12 11.7l8.1-4.4M12 21v-9.3" />
    </>
  ),
  clipboard: (
    <>
      <rect x="5" y="4.5" width="14" height="16.5" rx="2" />
      <path d="M9 4.5V3.4A1.4 1.4 0 0 1 10.4 2h3.2A1.4 1.4 0 0 1 15 3.4v1.1" />
      <path d="M8.5 10h7M8.5 14h7" />
    </>
  ),
  hourglass: (
    <>
      <path d="M6.5 3h11M6.5 21h11" />
      <path d="M8 3v3.2c0 1.1.5 2.1 1.4 2.8L12 11l2.6-2a3.5 3.5 0 0 0 1.4-2.8V3" />
      <path d="M8 21v-3.2c0-1.1.5-2.1 1.4-2.8L12 13l2.6 2a3.5 3.5 0 0 1 1.4 2.8V21" />
    </>
  ),
  trash: (
    <>
      <path d="M4 6.5h16M9.5 6.5V4.6A1.6 1.6 0 0 1 11.1 3h1.8a1.6 1.6 0 0 1 1.6 1.6v1.9" />
      <path d="M6.5 6.5 7.6 20a1.6 1.6 0 0 0 1.6 1.5h5.6A1.6 1.6 0 0 0 16.4 20l1.1-13.5" />
      <path d="M10.5 10.5v7M13.5 10.5v7" />
    </>
  ),
  users: (
    <>
      <path d="M16 20v-1.8a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20" />
      <circle cx="9" cy="7" r="3.4" />
      <path d="M22 20v-1.8a4 4 0 0 0-3-3.86M16.2 3.6a4 4 0 0 1 0 7.75" />
    </>
  ),
  gem: (
    <>
      <path d="M6.2 3h11.6l3.2 5.2L12 21 3 8.2z" />
      <path d="M3 8.2h18M9.5 3l-2 5.2L12 21l4.5-12.8-2-5.2" />
    </>
  ),
  handshake: (
    <>
      <path d="M11 17.5 8.5 20 3 14.5l3.5-3.5 2 2" />
      <path d="M13 6.5 15.5 4 21 9.5 17.5 13l-2-2" />
      <path d="M9 11.5 12 8.5l3 3-3 3z" />
    </>
  ),
  fileText: (
    <>
      <path d="M14 3v4.5a1.5 1.5 0 0 0 1.5 1.5H20" />
      <path d="M19.5 9.8V20a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 20V4A1.5 1.5 0 0 1 6 2.5h8z" />
      <path d="M8.5 13h7M8.5 17h4.5" />
    </>
  ),
  copy: (
    <>
      <rect x="8.5" y="8.5" width="12.5" height="12.5" rx="2" />
      <path d="M15.5 8.5V5.5A2 2 0 0 0 13.5 3.5H5.5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3" />
    </>
  ),
  pot: (
    <>
      <path d="M4 9.5h16v6a4.5 4.5 0 0 1-4.5 4.5h-7A4.5 4.5 0 0 1 4 15.5z" />
      <path d="M2.5 9.5h19M9 6.5V4M15 6.5V4M12 6.5V3.5" />
    </>
  ),
  checkSquare: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="m7.5 12.2 3.2 3.3 6-6.5" />
    </>
  ),
  pulse: (
    <>
      <path d="M3 12h3.5l2-5 3.5 10 2.5-6.5L16 12h5" />
    </>
  ),
  truck: (
    <>
      <path d="M3 6.5h11v9H3zM14 9.5h3.8l3.2 3.3v2.7h-7z" />
      <circle cx="7" cy="18" r="1.9" />
      <circle cx="17.5" cy="18" r="1.9" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9.8h18M8 3v3.6M16 3v3.6" />
    </>
  ),
  userCheck: (
    <>
      <circle cx="9.5" cy="7.5" r="3.6" />
      <path d="M2.5 20.5v-1.6a4.5 4.5 0 0 1 4.5-4.5h4.2" />
      <path d="m15.5 16.8 2 2 4-4.3" />
    </>
  ),
  wallet: (
    <>
      <path d="M20.5 8.5V7A2 2 0 0 0 18.5 5H5.5A2.5 2.5 0 0 0 3 7.5v9A2.5 2.5 0 0 0 5.5 19h13a2 2 0 0 0 2-2v-1.5" />
      <path d="M21 8.5h-4.5a2.5 2.5 0 0 0 0 5H21z" />
    </>
  ),
  banknote: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M6 9.5v5M18 9.5v5" />
    </>
  ),
  trendingUp: (
    <>
      <path d="m3 16.5 5.5-5.5 3.5 3.5L21 5.5" />
      <path d="M15.5 5.5H21v5.5" />
    </>
  ),
  trendingDown: (
    <>
      <path d="m3 7.5 5.5 5.5 3.5-3.5L21 18.5" />
      <path d="M15.5 18.5H21V13" />
    </>
  ),
  barChart: (
    <>
      <path d="M3 21h18" />
      <rect x="5" y="11" width="3.6" height="7" rx="1" />
      <rect x="10.2" y="6.5" width="3.6" height="11.5" rx="1" />
      <rect x="15.4" y="14" width="3.6" height="4" rx="1" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.6" />
      <circle cx="12" cy="12" r="1" />
    </>
  ),
  stethoscope: (
    <>
      <path d="M5 3v5.5a4 4 0 0 0 8 0V3" />
      <path d="M3.5 3H6.5M11.5 3h3M9 12.5v3a5.5 5.5 0 0 0 11 0v-1.5" />
      <circle cx="20" cy="11.6" r="2.4" />
    </>
  ),
  orbit: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.6 7.6c1.7 1.5 2.1 3.4 1 4.9-1.6 2.2-5.5 2.6-9.5 1s-6.6-4.8-5-7c1.1-1.5 3-1.7 5.1-1" />
      <path d="M4.4 16.4c-1.7-1.5-2.1-3.4-1-4.9" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.56V21a2 2 0 0 1-4 0v-.09a1.7 1.7 0 0 0-1.11-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1H3a2 2 0 0 1 0-4h.09a1.7 1.7 0 0 0 1.56-1.11 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6h.08a1.7 1.7 0 0 0 1-1.56V3a2 2 0 0 1 4 0v.09a1.7 1.7 0 0 0 1 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9v.08a1.7 1.7 0 0 0 1.56 1H21a2 2 0 0 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1z" />
    </>
  ),
  sliders: (
    <>
      <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3" />
      <path d="M1.5 14h5M9.5 8h5M17.5 16h5" />
    </>
  ),
  book: (
    <>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </>
  ),
  shield: (
    <>
      <path d="M12 22s8-3.6 8-9.5V5.6l-8-3.1-8 3.1v6.9C4 18.4 12 22 12 22z" />
      <path d="m9 11.8 2.2 2.4L15.2 10" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2v2.4M12 19.6V22M4.2 4.2l1.7 1.7M18.1 18.1l1.7 1.7M2 12h2.4M19.6 12H22M4.2 19.8l1.7-1.7M18.1 5.9l1.7-1.7" />
    </>
  ),
  moon: (
    <>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </>
  ),
  menu: (
    <>
      <path d="M4 6.5h16M4 12h16M4 17.5h16" />
    </>
  ),
  close: (
    <>
      <path d="M6 6l12 12M18 6L6 18" />
    </>
  ),
  logout: (
    <>
      <path d="M15.5 8V6a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-2" />
      <path d="M10 12h11.5M18.5 9l3 3-3 3" />
    </>
  ),
  refresh: (
    <>
      <path d="M21 12a9 9 0 0 1-15.5 6.2L3 16" />
      <path d="M3 12a9 9 0 0 1 15.5-6.2L21 8" />
      <path d="M21 3.5V8h-4.5M3 20.5V16h4.5" />
    </>
  ),
  search: (
    <>
      <circle cx="10.8" cy="10.8" r="6.8" />
      <path d="m20.5 20.5-4.9-4.9" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5v14M5 12h14" />
    </>
  ),
  alert: (
    <>
      <path d="M10.3 3.9 2.4 17.3A2 2 0 0 0 4.1 20.3h15.8a2 2 0 0 0 1.7-3l-7.9-13.4a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4.5M12 17h.01" />
    </>
  ),
  chevronRight: (
    <>
      <path d="m9 5.5 6.5 6.5L9 18.5" />
    </>
  ),
  arrowUpRight: (
    <>
      <path d="M7 17 17 7M8.5 7H17v8.5" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8.5a6 6 0 0 0-12 0c0 6-2.5 7.5-2.5 7.5h17S18 14.5 18 8.5z" />
      <path d="M13.7 20a2 2 0 0 1-3.4 0" />
    </>
  ),
  inbox: (
    <>
      <path d="M21 12.5h-5.2l-1.3 2.4H9.5l-1.3-2.4H3" />
      <path d="M5.9 4.3h12.2a2 2 0 0 1 1.9 1.4L21 12.5V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5.5l1-6.8a2 2 0 0 1 1.9-1.4z" />
    </>
  ),
  filter: (
    <>
      <path d="M3.5 5h17l-6.6 7.8V19L10 21v-8.2z" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v11M7.5 10 12 14.5 16.5 10" />
      <path d="M4 18.5v.5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-.5" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M10.6 6.1A9.9 9.9 0 0 1 12 6c6.4 0 10 6 10 6a17.8 17.8 0 0 1-3.4 4.1M6.2 6.9A17.7 17.7 0 0 0 2 12s3.6 6.5 10 6.5a10.3 10.3 0 0 0 4-.8" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M2 2l20 20" />
    </>
  ),
  phone: (
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  ),
}

export function Icon({ name, size = 18, strokeWidth = 1.6, className = '', title, ...rest }) {
  const path = PATHS[name]
  if (!path) return null
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`icon ${className}`.trim()}
      role={title ? 'img' : undefined}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : 'true'}
      focusable="false"
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {path}
    </svg>
  )
}

export default Icon
