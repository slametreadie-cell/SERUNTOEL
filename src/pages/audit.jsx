import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../utils/supabaseClient'
import { useAuth } from '../components/AuthProvider'
import AppLayout from '../components/AppLayout'

const formatWaktu = (v) => {
  if (!v) return '—'
  const d = new Date(v)
  return d.toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const AKSI_BADGE = {
  transaksi: 'badge-success',
  tambah_produk: 'badge-info',
  ubah_produk: 'badge-warning',
  hapus_produk: 'badge-danger',
  tambah_bahan: 'badge-info',
  pembelian: 'badge-warning',
  cashflow: 'badge-neutral',
}

export default function Audit() {
  const { user } = useAuth()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [aksiFilter, setAksiFilter] = useState('')

  const hapusLog = async (d) => {
    if (!confirm('Hapus catatan aktivitas ini?')) return
    await supabase.from('audit_logs').delete().eq('id', d.id)
    fetchData()
  }

  const bersihkanLog = async () => {
    if (!confirm('Hapus SEMUA log lebih dari 30 hari?\n\nTindakan ini tidak bisa dibatalkan.')) return
    const batas = new Date(Date.now() - 30 * 86400000).toISOString()
    await supabase.from('audit_logs').delete().lt('tanggal', batas)
    alert('✅ Log lama dibersihkan')
    fetchData()
  }

  const fetchData = useCallback(async () => {
    setLoading(true); setError('')
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('tanggal', { ascending: false })
      .limit(500)
    if (error) setError(error.message)
    else setData(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const aksiList = useMemo(() => {
    const s = new Set(data.map((d) => d.aksi).filter(Boolean))
    return [...s].sort()
  }, [data])

  const filtered = data.filter((d) => {
    const matchAksi = !aksiFilter || d.aksi === aksiFilter
    const hay = `${d.aksi || ''} ${d.user_email || ''} ${JSON.stringify(d.detail_json || {})}`.toLowerCase()
    const matchSearch = !search || hay.includes(search.toLowerCase())
    return matchAksi && matchSearch
  })

  return (
    <AppLayout title="Audit Log" subtitle="Riwayat aktivitas sistem">
      <div className="card" style={{ padding: 16 }}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2" style={{ flex: 1 }}>
            <input className="form-control" style={{ maxWidth: 240 }} placeholder="🔍 Cari aktivitas..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <select className="form-control" style={{ maxWidth: 190 }} value={aksiFilter} onChange={(e) => setAksiFilter(e.target.value)}>
              <option value="">Semua Aksi</option>
              {aksiList.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-outline" onClick={fetchData}>🔄 Muat Ulang</button>
            <button className="btn btn-outline" onClick={bersihkanLog}>🧹 Bersihkan &gt;30 hari</button>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-danger">⚠️ {error}</div>}

      <div className="card" style={{ padding: 0 }}>
        <div className="card-header" style={{ padding: 16 }}>
          <div className="card-title"><span className="nav-icon">🔐</span> Aktivitas</div>
          <span className="text-sm text-muted">{filtered.length} catatan</span>
        </div>

        {loading ? (
          <p className="text-muted text-center py-4">Memuat...</p>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="nav-icon" style={{ fontSize: 40 }}>🔐</div>
            <h3>Belum ada aktivitas</h3>
            <p className="text-sm">Catatan muncul saat ada transaksi, produk, atau pembelian baru.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Waktu</th><th>Aksi</th><th>Pengguna</th><th>Detail</th><th></th></tr>
              </thead>
              <tbody>
                {filtered.map((d) => (
                  <tr key={d.id}>
                    <td className="text-muted" style={{ whiteSpace: 'nowrap' }}>{formatWaktu(d.tanggal)}</td>
                    <td><span className={`badge ${AKSI_BADGE[d.aksi] || 'badge-neutral'}`}>{d.aksi}</span></td>
                    <td>{d.user_email || '—'}</td>
                    <td className="text-xs text-muted" style={{ maxWidth: 340, wordBreak: 'break-word' }}>
                      {d.detail_json && Object.keys(d.detail_json).length
                        ? JSON.stringify(d.detail_json).slice(0, 160)
                        : '—'}
                    </td>
                    <td className="text-right">
                      <button className="btn btn-sm btn-danger" onClick={() => hapusLog(d)}>✕</button>
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
