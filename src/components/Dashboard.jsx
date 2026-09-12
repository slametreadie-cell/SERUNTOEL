import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../utils/supabaseClient'
import { useAuth } from './AuthProvider'
import AppLayout from './AppLayout'

const QUICK_ACCESS = [
  { emoji: '🏪', title: 'POS Kasir', desc: 'Transaksi penjualan', href: '/pos', color: 'linear-gradient(135deg,#0D9488,#0F766E)' },
  { emoji: '📦', title: 'Inventory', desc: 'Kelola stok bahan & produk', href: '/inventory', color: 'linear-gradient(135deg,#3B82F6,#2563EB)' },
  { emoji: '💰', title: 'Cashflow', desc: 'Arus kas masuk & keluar', href: '/finance', color: 'linear-gradient(135deg,#F59E0B,#D97706)' },
  { emoji: '👥', title: 'Pelanggan', desc: 'Database & loyalitas', href: '/customers', color: 'linear-gradient(135deg,#8B5CF6,#7C3AED)' },
  { emoji: '📈', title: 'Laporan', desc: 'Laba rugi & analisis', href: '/laporan', color: 'linear-gradient(135deg,#10B981,#059669)' },
  { emoji: '🧾', title: 'Produk & HPP', desc: 'Kalkulasi harga pokok', href: '/produk-hpp', color: 'linear-gradient(135deg,#EF4444,#DC2626)' },
]

const formatRupiah = (value) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value || 0)

export default function Dashboard() {
  const { user, signOut } = useAuth()
  const [stats, setStats] = useState({ omset: 0, transaksi: 0, stokKritis: 0, pelanggan: 0 })
  const [statsError, setStatsError] = useState('')
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(null)

  const fetchStats = useCallback(async () => {
    if (!user) return
    setStatsError('')
    setLoading(true)
    try {
      const since = new Date()
      since.setHours(0, 0, 0, 0)

      const [transactionsRes, productsRes, customersRes, profileRes] = await Promise.all([
        supabase.from('transactions').select('total_bayar').gte('tanggal', since.toISOString()),
        supabase.from('products').select('id, stok_produk'),
        supabase.from('customers').select('id', { count: 'exact', head: true }),
        supabase.from('users').select('role, nama').eq('id', user.id).maybeSingle(),
      ])

      if (transactionsRes.error) throw transactionsRes.error
      if (productsRes.error) throw productsRes.error
      if (customersRes.error) throw customersRes.error

      const transactions = transactionsRes.data || []
      const products = productsRes.data || []

      setStats({
        omset: transactions.reduce((sum, t) => sum + Number(t.total_bayar || 0), 0),
        transaksi: transactions.length,
        stokKritis: products.filter((p) => Number(p.stok_produk || 0) <= 5).length,
        pelanggan: customersRes.count || 0,
      })
      setProfile(profileRes.error ? null : profileRes.data)
    } catch (err) {
      setStatsError(err.message || 'Gagal memuat data dari Supabase')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  const nama = profile?.nama || user?.email?.split('@')[0] || 'User'
  const role = profile?.role || 'user'
  const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <AppLayout title="Dashboard" subtitle={today}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="page-title">Selamat datang, {nama}! 👋</div>
          <div className="page-subtitle">
            Ringkasan bisnis Anda hari ini · <span className="badge badge-success capitalize">{role}</span>
          </div>
        </div>
        <button className="btn btn-outline" onClick={fetchStats}>🔄 Refresh</button>
      </div>

      {statsError && <div className="alert alert-danger">⚠️ {statsError}</div>}

      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-label">Penjualan Hari Ini</div>
          <div className="metric-value text-primary">{loading ? '...' : formatRupiah(stats.omset)}</div>
          <div className="text-sm text-muted mt-2">{stats.transaksi} transaksi</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Peringatan Stok</div>
          <div className="metric-value text-danger">{loading ? '...' : stats.stokKritis}</div>
          <div className="text-sm text-muted mt-2">Produk ≤ 5 unit</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Pelanggan</div>
          <div className="metric-value text-primary">{loading ? '...' : stats.pelanggan}</div>
          <div className="text-sm text-muted mt-2">Total terdaftar</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Produk Aktif</div>
          <div className="metric-value text-primary">—</div>
          <div className="text-sm text-muted mt-2">Katalog produk</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title"><span className="nav-icon">⚡</span> Akses Cepat</div>
        </div>
        <div className="grid-3">
          {QUICK_ACCESS.map((item) => (
            <Link key={item.href} href={item.href} className="quick-card">
              <div className="quick-icon" style={{ background: item.color }}>{item.emoji}</div>
              <div>
                <div className="quick-title">{item.title}</div>
                <div className="text-sm text-muted">{item.desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title"><span className="nav-icon">🕒</span> Aktivitas Terbaru</div>
        </div>
        <div className="empty-state">
          <div className="nav-icon">📭</div>
          <h3>Belum ada aktivitas</h3>
          <p className="text-sm">Mulai dengan membuat transaksi pertama Anda!</p>
        </div>
      </div>

      <style jsx>{`
        .quick-card {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 16px;
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          transition: all .2s;
          cursor: pointer;
        }
        .quick-card:hover {
          transform: translateY(-3px);
          box-shadow: var(--shadow-hover);
          border-color: var(--primary-light);
        }
        .quick-icon {
          width: 44px; height: 44px; border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          font-size: 22px; color: #fff; flex-shrink: 0;
        }
        .quick-title { font-weight: 700; font-size: var(--fs-base); }
      `}</style>
    </AppLayout>
  )
}
