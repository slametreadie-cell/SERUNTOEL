import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../utils/supabaseClient'
import { useAuth } from '../components/AuthProvider'
import AppLayout from '../components/AppLayout'

const formatRupiah = (v) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v || 0)

const formatTanggal = (v) => {
  if (!v) return '—'
  const d = new Date(v)
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function Pelanggan() {
  const { user } = useAuth()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [channelFilter, setChannelFilter] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('total_belanja', { ascending: false })
    if (error) setError(error.message)
    else setData(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const filtered = data.filter((c) => {
    const matchSearch = !search || (c.nama || '').toLowerCase().includes(search.toLowerCase()) || (c.kontak || '').toLowerCase().includes(search.toLowerCase())
    const matchChannel = !channelFilter || c.channel === channelFilter
    return matchSearch && matchChannel
  })

  const totalPelanggan = data.length
  const totalBelanja = data.reduce((s, c) => s + Number(c.total_belanja || 0), 0)

  return (
    <AppLayout title="Pelanggan" subtitle="Database pelanggan & riwayat belanja">
      <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(2,1fr)' }}>
        <div className="metric-card">
          <div className="metric-label">Total Pelanggan</div>
          <div className="metric-value text-primary">{totalPelanggan}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Total Belanja</div>
          <div className="metric-value text-primary">{formatRupiah(totalBelanja)}</div>
        </div>
      </div>

      <div className="card" style={{ padding: 16 }}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2" style={{ flex: 1 }}>
            <input className="form-control" style={{ maxWidth: 240 }} placeholder="🔍 Cari nama/kontak..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <select className="form-control" style={{ maxWidth: 160 }} value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)}>
              <option value="">Semua Channel</option>
              <option value="offline">Offline</option>
              <option value="online">Online</option>
              <option value="reseller">Reseller</option>
            </select>
          </div>
          <Link href="/customers/tambah" className="btn btn-primary">＋ Pelanggan</Link>
        </div>
      </div>

      {error && <div className="alert alert-danger">⚠️ {error}</div>}

      <div className="card" style={{ padding: 0 }}>
        <div className="card-header" style={{ padding: 16 }}>
          <div className="card-title"><span className="nav-icon">👥</span> Daftar Pelanggan</div>
          <span className="text-sm text-muted">{filtered.length} pelanggan</span>
        </div>

        {loading ? (
          <p className="text-muted text-center py-4">Memuat...</p>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="nav-icon" style={{ fontSize: 40 }}>👤</div>
            <h3>Belum ada pelanggan</h3>
            <p className="text-sm">Pelanggan otomatis tercatat saat transaksi POS dengan nama.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Nama</th><th>Kontak</th><th>Channel</th><th>Transaksi</th><th>Total Belanja</th><th>Terakhir</th></tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id}>
                    <td className="font-bold">{c.nama}</td>
                    <td>{c.kontak || '—'}</td>
                    <td>
                      <span className={`badge ${c.channel === 'reseller' ? 'badge-warning' : c.channel === 'online' ? 'badge-info' : 'badge-neutral'}`}>
                        {c.channel || 'offline'}
                      </span>
                    </td>
                    <td>{c.total_transaksi || 0}</td>
                    <td className="text-primary font-bold">{formatRupiah(c.total_belanja)}</td>
                    <td className="text-muted">{formatTanggal(c.last_order)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
