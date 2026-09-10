import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../utils/supabaseClient'
import { useAuth } from './AuthProvider'

const menuItems = [
  { emoji: '🏪', title: 'POS System', description: 'Point of Sales transactions', href: '/pos' },
  { emoji: '📦', title: 'Inventory', description: 'Stock management', href: '/inventory' },
  { emoji: '💰', title: 'Finance', description: 'Cashflow & reports', href: '/finance' },
  { emoji: '👥', title: 'Customers', description: 'Customer management', href: '/customers' },
  { emoji: '📊', title: 'Analytics', description: 'Reports & insights', href: '/analytics' },
  { emoji: '⚙️', title: 'Settings', description: 'System configuration', href: '/settings' },
]

const formatRupiah = (value) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value || 0)

export default function Dashboard() {
  const { user, signOut } = useAuth()
  const [stats, setStats] = useState({ omset: 0, transaksi: 0, stokKritis: 0, pelanggan: 0 })
  const [statsError, setStatsError] = useState('')
  const [profile, setProfile] = useState(null)

  const fetchStats = useCallback(async () => {
    if (!user) return
    setStatsError('')
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
      if (profileRes.error) {
        setProfile(null)
      } else {
        setProfile(profileRes.data)
      }
    } catch (err) {
      setStatsError(err.message || 'Gagal memuat data dari Supabase')
    }
  }, [user])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  const nama = profile?.nama || user?.email?.split('@')[0] || 'User'
  const role = profile?.role || 'user'

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">🐟 Seruntul Advanced</h1>
            <p className="text-sm text-gray-600">Business Dashboard</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-sm text-right">
              <p className="font-medium">{user?.email}</p>
              <p className="text-gray-500 capitalize">{role}</p>
            </div>
            <button
              onClick={signOut}
              className="px-4 py-2 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Welcome back, {nama}!</h2>
            <button
              onClick={fetchStats}
              className="text-sm px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-100"
            >
              🔄 Refresh
            </button>
          </div>

          {statsError && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {statsError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="font-medium text-gray-900">Penjualan Hari Ini</h3>
              <p className="text-2xl font-bold text-green-600 mt-2">{formatRupiah(stats.omset)}</p>
              <p className="text-sm text-gray-500">{stats.transaksi} transaksi</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="font-medium text-gray-900">Peringatan Stok</h3>
              <p className="text-2xl font-bold text-red-600 mt-2">{stats.stokKritis} item</p>
              <p className="text-sm text-gray-500">Stok ≤ 5 unit</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="font-medium text-gray-900">Pelanggan Terdaftar</h3>
              <p className="text-2xl font-bold text-blue-600 mt-2">{stats.pelanggan}</p>
              <p className="text-sm text-gray-500">Total di database</p>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4">Quick Access</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {menuItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block p-6 bg-white rounded-lg shadow hover:shadow-md transition-shadow"
              >
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-4">
                  <span className="text-xl">{item.emoji}</span>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">{item.title}</h3>
                <p className="text-gray-600">{item.description}</p>
              </Link>
            ))}
          </div>
        </div>

        <div className="mt-8 bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium mb-4">Recent Activity</h3>
          <div className="text-center text-gray-500 py-8">
            <p>Belum ada aktivitas terbaru</p>
            <p className="text-sm mt-2">Mulai dengan membuat transaksi pertama Anda!</p>
          </div>
        </div>
      </main>
    </div>
  )
}
