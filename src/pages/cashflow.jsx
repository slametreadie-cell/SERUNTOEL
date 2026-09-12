import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../utils/supabaseClient'
import { useAuth } from '../components/AuthProvider'
import AppLayout from '../components/AppLayout'

const formatRupiah = (v) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v || 0)

const KATEGORI_MASUK = ['Penjualan', 'Modal', 'Hutang', 'Piutang', 'Lainnya']
const KATEGORI_KELUAR = ['Pembelian Bahan', 'Operasional', 'Gaji', 'Sewa', 'Utilitas', 'Marketing', 'Lainnya']

export default function Cashflow() {
  const { user } = useAuth()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterJenis, setFilterJenis] = useState('')
  const [filterBulan, setFilterBulan] = useState('')
  const [search, setSearch] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')
    const { data, error } = await supabase
      .from('cashflow')
      .select('*')
      .order('tanggal', { ascending: false })
      .order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setData(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Ringkasan
  const totalMasuk = data.filter((d) => d.jenis === 'masuk').reduce((s, d) => s + Number(d.jumlah || 0), 0)
  const totalKeluar = data.filter((d) => d.jenis === 'keluar').reduce((s, d) => s + Number(d.jumlah || 0), 0)
  const saldo = totalMasuk - totalKeluar

  // Daftar bulan tersedia untuk filter
  const bulanList = useMemo(() => {
    const s = new Set(data.map((d) => (d.tanggal || '').slice(0, 7)))
    return [...s].sort().reverse()
  }, [data])

  const filtered = data.filter((d) => {
    const matchJenis = !filterJenis || d.jenis === filterJenis
    const matchBulan = !filterBulan || (d.tanggal || '').startsWith(filterBulan)
    const matchSearch = !search || (d.keterangan || '').toLowerCase().includes(search.toLowerCase()) || (d.kategori || '').toLowerCase().includes(search.toLowerCase())
    return matchJenis && matchBulan && matchSearch
  })

  return (
    <AppLayout title="Cashflow" subtitle="Arus kas masuk & keluar">
      {/* Ringkasan */}
      <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
        <div className="metric-card">
          <div className="metric-label">Uang Masuk</div>
          <div className="metric-value text-success">{formatRupiah(totalMasuk)}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Uang Keluar</div>
          <div className="metric-value text-danger">{formatRupiah(totalKeluar)}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Saldo</div>
          <div className={`metric-value ${saldo >= 0 ? 'text-primary' : 'text-danger'}`}>{formatRupiah(saldo)}</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="card" style={{ padding: 16 }}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2" style={{ flex: 1 }}>
            <input className="form-control" style={{ maxWidth: 220 }} placeholder="🔍 Cari..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <select className="form-control" style={{ maxWidth: 150 }} value={filterJenis} onChange={(e) => setFilterJenis(e.target.value)}>
              <option value="">Semua Jenis</option>
              <option value="masuk">Masuk</option>
              <option value="keluar">Keluar</option>
            </select>
            <select className="form-control" style={{ maxWidth: 160 }} value={filterBulan} onChange={(e) => setFilterBulan(e.target.value)}>
              <option value="">Semua Bulan</option>
              {bulanList.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <Link href="/cashflow/tambah" className="btn btn-primary">＋ Catat Transaksi</Link>
        </div>
      </div>

      {error && <div className="alert alert-danger">⚠️ {error}</div>}

      {/* Daftar transaksi */}
      <div className="card" style={{ padding: 0 }}>
        <div className="card-header" style={{ padding: 16 }}>
          <div className="card-title"><span className="nav-icon">📒</span> Riwayat Transaksi</div>
          <span className="text-sm text-muted">{filtered.length} catatan</span>
        </div>

        {loading ? (
          <p className="text-muted text-center py-4">Memuat...</p>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="nav-icon" style={{ fontSize: 40 }}>💸</div>
            <h3>Belum ada transaksi</h3>
            <p className="text-sm">Catat pemasukan atau pengeluaran pertama Anda.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Tanggal</th><th>Keterangan</th><th>Kategori</th><th>Jenis</th><th>Jumlah</th></tr>
              </thead>
              <tbody>
                {filtered.map((d) => (
                  <tr key={d.id}>
                    <td>{d.tanggal}</td>
                    <td className="font-bold">{d.keterangan}</td>
                    <td><span className="badge badge-neutral">{d.kategori}</span></td>
                    <td>
                      <span className={`badge ${d.jenis === 'masuk' ? 'badge-success' : 'badge-danger'}`}>
                        {d.jenis === 'masuk' ? '↑ Masuk' : '↓ Keluar'}
                      </span>
                    </td>
                    <td className={`font-bold ${d.jenis === 'masuk' ? 'text-success' : 'text-danger'}`}>
                      {d.jenis === 'masuk' ? '+' : '−'}{formatRupiah(d.jumlah)}
                    </td>
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
