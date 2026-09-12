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

export default function Suppliers() {
  const { user } = useAuth()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .order('total_belanja', { ascending: false })
    if (error) setError(error.message)
    else setData(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const filtered = data.filter((s) => {
    return !search || (s.nama || '').toLowerCase().includes(search.toLowerCase()) || (s.bahan_utama || '').toLowerCase().includes(search.toLowerCase())
  })

  return (
    <AppLayout title="Supplier" subtitle="Pemasok bahan baku">
      <div className="card" style={{ padding: 16 }}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <input className="form-control" style={{ maxWidth: 280, flex: 1 }} placeholder="🔍 Cari nama/bahan utama..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <Link href="/suppliers/tambah" className="btn btn-primary">＋ Supplier</Link>
        </div>
      </div>

      {error && <div className="alert alert-danger">⚠️ {error}</div>}

      <div className="card" style={{ padding: 0 }}>
        <div className="card-header" style={{ padding: 16 }}>
          <div className="card-title"><span className="nav-icon">🏭</span> Daftar Supplier</div>
          <span className="text-sm text-muted">{filtered.length} supplier</span>
        </div>

        {loading ? (
          <p className="text-muted text-center py-4">Memuat...</p>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="nav-icon" style={{ fontSize: 40 }}>🏭</div>
            <h3>Belum ada supplier</h3>
            <p className="text-sm">Tambahkan pemasok bahan baku Anda.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Nama</th><th>Bahan Utama</th><th>Kontak</th><th>Rating</th><th>Pembelian</th><th>Total</th><th>Terakhir</th></tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id}>
                    <td className="font-bold">{s.nama}</td>
                    <td>{s.bahan_utama || '—'}</td>
                    <td>{s.kontak || '—'}</td>
                    <td><span className="badge badge-warning">{'⭐'.repeat(Math.min(5, s.rating || 0)) || '—'}</span></td>
                    <td>{s.total_pembelian || 0}x</td>
                    <td className="text-primary font-bold">{formatRupiah(s.total_belanja)}</td>
                    <td className="text-muted">{formatTanggal(s.last_purchase)}</td>
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
