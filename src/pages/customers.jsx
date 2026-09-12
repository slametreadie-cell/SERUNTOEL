import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../utils/supabaseClient'
import { useAuth } from '../components/AuthProvider'
import AppLayout from '../components/AppLayout'
import { logAudit } from '../utils/audit'

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
  const [editRow, setEditRow] = useState(null)
  const [msg, setMsg] = useState('')

  const hapusPelanggan = async (c) => {
    if (!confirm(`Hapus pelanggan "${c.nama}"?\n\nRiwayat transaksinya tetap tersimpan.`)) return
    await supabase.from('customers').delete().eq('id', c.id)
    logAudit({ aksi: 'hapus_pelanggan', user, sheetTarget: 'customers', detail: { nama: c.nama } })
    setMsg(`✅ Pelanggan ${c.nama} dihapus`)
    fetchData()
    setTimeout(() => setMsg(''), 3000)
  }

  const simpanEditPelanggan = async () => {
    if (!editRow) return
    if (!editRow.nama?.trim()) { alert('Nama tidak boleh kosong'); return }
    await supabase.from('customers').update({
      nama: editRow.nama.trim(), kontak: editRow.kontak || null, channel: editRow.channel || 'offline',
    }).eq('id', editRow.id)
    logAudit({ aksi: 'ubah_pelanggan', user, sheetTarget: 'customers', detail: { nama: editRow.nama } })
    setMsg('✅ Data pelanggan diperbarui')
    setEditRow(null)
    fetchData()
    setTimeout(() => setMsg(''), 3000)
  }

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

      {msg && <div className="alert alert-success">{msg}</div>}
      {error && <div className="alert alert-danger">⚠️ {error}</div>}

      {editRow && (
        <div className="card" style={{ border: '2px solid var(--primary)' }}>
          <div className="card-header">
            <div className="card-title"><span className="nav-icon">✏️</span> Ubah Pelanggan</div>
            <button className="btn btn-sm btn-outline" onClick={() => setEditRow(null)}>✕</button>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Nama</label>
              <input className="form-control" value={editRow.nama} onChange={(e) => setEditRow({ ...editRow, nama: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Kontak</label>
              <input className="form-control" value={editRow.kontak} onChange={(e) => setEditRow({ ...editRow, kontak: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Channel</label>
              <select className="form-control" value={editRow.channel} onChange={(e) => setEditRow({ ...editRow, channel: e.target.value })}>
                <option value="offline">Offline</option>
                <option value="online">Online</option>
                <option value="reseller">Reseller</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button className="btn btn-outline" onClick={() => setEditRow(null)}>Batal</button>
            <button className="btn btn-primary" onClick={simpanEditPelanggan}>💾 Simpan</button>
          </div>
        </div>
      )}

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
                <tr><th>Nama</th><th>Kontak</th><th>Channel</th><th>Transaksi</th><th>Total Belanja</th><th>Terakhir</th><th></th></tr>
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
                    <td className="text-right">
                      <div className="flex gap-1 justify-end">
                        <button className="btn btn-sm btn-outline"
                          onClick={() => setEditRow({ id: c.id, nama: c.nama, kontak: c.kontak || '', channel: c.channel || 'offline' })}>✏️</button>
                        <button className="btn btn-sm btn-danger" onClick={() => hapusPelanggan(c)}>✕</button>
                      </div>
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
