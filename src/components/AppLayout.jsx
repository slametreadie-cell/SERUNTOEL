import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useAuth } from './AuthProvider'
import Icon from './Icons'

const NAV_GROUPS = [
  {
    label: 'Kasir',
    items: [
      { icon: 'dashboard', title: 'Dashboard', href: '/dashboard' },
      { icon: 'cart', title: 'POS Kasir', href: '/pos' },
      { icon: 'receipt', title: 'Riwayat Transaksi', href: '/kasir' },
      { icon: 'lock', title: 'Tutup Kas', href: '/kasir/tutup' },
      { icon: 'ticket', title: 'Voucher & Promo', href: '/voucher' },
    ],
  },
  {
    label: 'Manajemen',
    items: [
      { icon: 'box', title: 'Inventory', href: '/inventory' },
      { icon: 'clipboard', title: 'Stok & Opname', href: '/inventory/stok' },
      { icon: 'hourglass', title: 'Produk Kadaluarsa', href: '/gudang/kadaluarsa' },
      { icon: 'trash', title: 'Waste Log', href: '/gudang/waste' },
      { icon: 'users', title: 'Pelanggan', href: '/customers' },
      { icon: 'gem', title: 'Loyalty & Member', href: '/loyalty' },
      { icon: 'handshake', title: 'Reseller', href: '/reseller' },
      { icon: 'fileText', title: 'Produk & HPP', href: '/produk-hpp' },
      { icon: 'copy', title: 'Duplikat Produk', href: '/produk-hpp/duplikat' },
      { icon: 'pot', title: 'Resep Produksi', href: '/produksi' },
      { icon: 'checkSquare', title: 'QC Checklist', href: '/qc' },
      { icon: 'pulse', title: 'Label Gizi', href: '/label-gizi' },
      { icon: 'truck', title: 'Supplier', href: '/suppliers' },
    ],
  },
  {
    label: 'Pesanan',
    items: [{ icon: 'calendar', title: 'Pre-Order', href: '/preorder' }],
  },
  {
    label: 'SDM',
    items: [{ icon: 'userCheck', title: 'Karyawan & Absensi', href: '/karyawan' }],
  },
  {
    label: 'Keuangan',
    items: [
      { icon: 'wallet', title: 'Cashflow', href: '/cashflow' },
      { icon: 'banknote', title: 'Hutang & Piutang', href: '/keuangan/hutang' },
      { icon: 'trendingUp', title: 'Laporan Penjualan', href: '/laporan' },
      { icon: 'barChart', title: 'Laba Rugi (P&L)', href: '/laba-rugi' },
      { icon: 'target', title: 'Target & Budget', href: '/target' },
    ],
  },
  {
    label: 'Analisis',
    items: [
      { icon: 'stethoscope', title: 'Diagnosis Bisnis', href: '/diagnosis' },
      { icon: 'trendingDown', title: 'Forecast & DOH', href: '/forecast-doh' },
      { icon: 'orbit', title: 'Simulasi Skenario', href: '/forecast' },
    ],
  },
  {
    label: 'Sistem',
    items: [
      { icon: 'settings', title: 'Pengaturan', href: '/settings' },
      { icon: 'sliders', title: 'Pengaturan Lanjutan', href: '/pengaturan-lanjutan' },
      { icon: 'book', title: 'Panduan', href: '/panduan' },
      { icon: 'shield', title: 'Audit Log', href: '/audit' },
    ],
  },
]

// Akses cepat untuk bottom nav di HP — 4 menu paling sering dipakai + tombol Menu
const MOBILE_NAV = [
  { icon: 'dashboard', title: 'Beranda', href: '/dashboard' },
  { icon: 'cart', title: 'Kasir', href: '/pos' },
  { icon: 'box', title: 'Stok', href: '/inventory' },
  { icon: 'wallet', title: 'Kas', href: '/cashflow' },
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

  // Tutup sidebar dengan tombol Escape — aksesibilitas keyboard
  useEffect(() => {
    if (!sidebarOpen) return
    const onKey = (e) => {
      if (e.key === 'Escape') setSidebarOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sidebarOpen])

  const isActive = (href) => router.pathname === href

  const nama = user?.email?.split('@')[0] || 'User'
  const initial = (user?.email?.[0] || 'S').toUpperCase()

  return (
    <div className="app">
      {/* Sidebar overlay (mobile) */}
      <div
        className={`sidebar-overlay ${sidebarOpen ? 'show' : ''}`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`} aria-label="Menu utama">
        <div className="sidebar-header">
          <Link href="/dashboard" className="sidebar-logo">
            <div className="sidebar-logo-icon" aria-hidden="true">🐟</div>
            <div>
              <div className="sidebar-logo-text">Seruntul</div>
              <div className="sidebar-logo-sub">Entrepreneur Suite</div>
            </div>
          </Link>
          <button
            className="sidebar-close show-mobile"
            onClick={() => setSidebarOpen(false)}
            aria-label="Tutup menu"
          >
            <Icon name="close" size={18} />
          </button>
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
                  aria-current={isActive(item.href) ? 'page' : undefined}
                >
                  <Icon name={item.icon} size={17} />
                  {item.title}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="btn btn-outline btn-block" onClick={signOut}>
            <Icon name="logout" size={15} />
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
              <button
                className="menu-toggle show-mobile"
                onClick={() => setSidebarOpen(true)}
                aria-label="Buka menu"
                aria-expanded={sidebarOpen}
              >
                <Icon name="menu" size={18} />
              </button>
              {title && (
                <div className="topbar-title">
                  <div className="page-title">{title}</div>
                  {subtitle && <div className="page-subtitle">{subtitle}</div>}
                </div>
              )}
            </div>
            <div className="topbar-right">
              {actions}
              <button
                className="theme-toggle"
                onClick={toggleTheme}
                aria-label={theme === 'light' ? 'Aktifkan tema gelap' : 'Aktifkan tema terang'}
                title={theme === 'light' ? 'Tema gelap' : 'Tema terang'}
              >
                <Icon name={theme === 'light' ? 'moon' : 'sun'} size={16} />
              </button>
              <div className="avatar" title={user?.email || nama}>
                {initial}
              </div>
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

      {/* Bottom nav (mobile only) */}
      <nav className="bottom-nav" aria-label="Navigasi cepat">
        {MOBILE_NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`bottom-nav-item ${isActive(item.href) ? 'active' : ''}`}
            aria-current={isActive(item.href) ? 'page' : undefined}
          >
            <Icon name={item.icon} size={19} />
            <span>{item.title}</span>
          </Link>
        ))}
        <button
          className="bottom-nav-item"
          onClick={() => setSidebarOpen(true)}
          aria-label="Buka semua menu"
        >
          <Icon name="menu" size={19} />
          <span>Menu</span>
        </button>
      </nav>

      <style jsx>{`
        .topbar-title { min-width: 0; }
        .topbar-title .page-title {
          font-size: 15px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .topbar-title .page-subtitle { display: none; }
        @media (min-width: 1024px) {
          .topbar-title { display: none; }
        }
      `}</style>
    </div>
  )
}
