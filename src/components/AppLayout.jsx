import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useAuth } from './AuthProvider'

const NAV_GROUPS = [
  {
    label: 'Utama',
    items: [
      { emoji: '📊', title: 'Dashboard', href: '/dashboard' },
      { emoji: '🏪', title: 'POS Kasir', href: '/pos' },
    ],
  },
  {
    label: 'Manajemen',
    items: [
      { emoji: '📦', title: 'Inventory', href: '/inventory' },
      { emoji: '👥', title: 'Pelanggan', href: '/customers' },
      { emoji: '🧾', title: 'Produk & HPP', href: '/produk-hpp' },
      { emoji: '🍲', title: 'Resep Produksi', href: '/produksi' },
      { emoji: '🏭', title: 'Supplier', href: '/suppliers' },
    ],
  },
  {
    label: 'Keuangan',
    items: [
      { emoji: '💰', title: 'Cashflow', href: '/finance' },
      { emoji: '📈', title: 'Laporan', href: '/laporan' },
      { emoji: '🎯', title: 'Forecast & Simulasi', href: '/forecast' },
    ],
  },
  {
    label: 'Sistem',
    items: [
      { emoji: '⚙️', title: 'Pengaturan', href: '/settings' },
      { emoji: '🔐', title: 'Audit Log', href: '/audit' },
    ],
  },
]

export default function AppLayout({ children, title, subtitle, actions }) {
  const { user, signOut } = useAuth()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [theme, setTheme] = useState('light')

  useEffect(() => {
    const saved = localStorage.getItem('seruntul-theme') || 'light'
    setTheme(saved)
    document.documentElement.setAttribute('data-theme', saved)
  }, [])

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('seruntul-theme', next)
  }

  useEffect(() => {
    setSidebarOpen(false)
  }, [router.asPath])

  const isActive = (href) => router.pathname === href

  const nama = user?.email?.split('@')[0] || 'User'
  const initial = (user?.email?.[0] || 'S').toUpperCase()

  return (
    <div className="app">
      {/* Sidebar overlay (mobile) */}
      <div
        className={`sidebar-overlay ${sidebarOpen ? 'show' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <Link href="/dashboard" className="sidebar-logo">
            <div className="sidebar-logo-icon">🐟</div>
            <div>
              <div className="sidebar-logo-text">Seruntul</div>
              <div className="sidebar-logo-sub">Entrepreneur Suite</div>
            </div>
          </Link>
        </div>

        <nav className="sidebar-nav">
          {NAV_GROUPS.map((group) => (
            <div className="nav-group" key={group.label}>
              <div className="nav-group-label">{group.label}</div>
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-item ${isActive(item.href) ? 'active' : ''}`}
                >
                  <span className="nav-icon">{item.emoji}</span>
                  {item.title}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="btn btn-outline btn-block" onClick={signOut}>
            Keluar
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="main">
        {/* Topbar */}
        <header className="topbar">
          <div className="topbar-inner">
            <div className="topbar-left">
              <button className="menu-toggle" onClick={() => setSidebarOpen(true)}>
                ☰
              </button>
              {title && (
                <div>
                  <div className="page-title">{title}</div>
                  {subtitle && <div className="page-subtitle">{subtitle}</div>}
                </div>
              )}
            </div>
            <div className="topbar-right">
              {actions}
              <button className="theme-toggle" onClick={toggleTheme} title="Ganti tema">
                {theme === 'light' ? '🌙' : '☀️'}
              </button>
              <div className="avatar" title={user?.email}>{initial}</div>
            </div>
          </div>
        </header>

        <div className="content">
          {title ? (
            <div className="page-header">
              <div>
                <div className="page-title">{title}</div>
                {subtitle && <div className="page-subtitle">{subtitle}</div>}
              </div>
              {actions && <div className="header-actions">{actions}</div>}
            </div>
          ) : null}
          <div className="fade-in">{children}</div>
        </div>
      </div>
    </div>
  )
}
