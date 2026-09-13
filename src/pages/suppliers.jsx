import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../utils/supabaseClient'
import { useAuth } from '../components/AuthProvider'
import AppLayout from '../components/AppLayout'
import { logAudit } from '../utils/audit'
import Icon from '../components/Icons'

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
  const [editRow, setEditRow] = useState(null)
  const [msg, setMsg] = useState('')

  const hapusSupplier = async (s) => {
    if (!confirm(`Hapus supplier "${s.nama}"?`)) return
    await supabase.from('suppliers').delete().eq('id', s.id)
    logAudit({ aksi: 'hapus_supplier', user, sheetTarget: 'suppliers', detail: { nama: s.nama } })
    setMsg(` Supplier ${s.nama} dihapus`)
    fetchData()
    setTimeout(() => setMsg(''), 3000)
  }

  const simpanEditSupplier = async () => {
    if (!editRow) return
    if (!editRow.nama?.trim()) { alert('Nama tidak boleh kosong'); return }
    await supabase.from('suppliers').update({
      nama: editRow.nama.trim(), kontak: editRow.kontak || null,
      bahan_utama: editRow.bahan_utama || null, alamat: editRow.alamat || null,
      rating: Number(editRow.rating) || 0,
    }).eq('id', editRow.id)
    logAudit({ aksi: 'ubah_supplier', user, sheetTarget: 'suppliers', detail: { nama: editRow.nama } })
    setMsg(' Data supplier diperbarui')
    setEditRow(null)
    fetchData()
    setTimeout(() => setMsg(''), 3000)
  }

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
          <input className="form-control" style={{ maxWidth: 280, flex: 1 }} placeholder="Cari nama/bahan utama..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <Link href="/suppliers/tambah" className="btn btn-primary">＋ Supplier</Link>
        </div>
      </div>

      {msg && <div className="alert alert-success">{msg}</div>}
      {error && <div className="alert alert-danger"> {error}</div>}

      {editRow && (
        <div className="card" style={{ border: '2px solid var(--primary)' }}>
          <div className="card-header">
            <div className="card-title"><Icon name="sliders" size={16} /> Ubah Supplier</div>
            <button className="btn btn-sm btn-outline" onClick={() => setEditRow(null)}><Icon name="close" size={13} /></button>
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
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Bahan Utama</label>
              <input className="form-control" value={editRow.bahan_utama} onChange={(e) => setEditRow({ ...editRow, bahan_utama: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Alamat</label>
              <input className="form-control" value={editRow.alamat} onChange={(e) => setEditRow({ ...editRow, alamat: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Rating (1-5)</label>
              <input className="form-control" type="number" min="0" max="5" value={editRow.rating}
                onChange={(e) => setEditRow({ ...editRow, rating: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button className="btn btn-outline" onClick={() => setEditRow(null)}>Batal</button>
            <button className="btn btn-primary" onClick={simpanEditSupplier}> Simpan</button>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
        <div className="card-header" style={{ padding: 16 }}>
          <div className="card-title"><Icon name="truck" size={16} /> Daftar Supplier</div>
          <span className="text-sm text-muted">{filtered.length} supplier</span>
        </div>

        {loading ? (
          <p className="text-muted text-center py-4">Memuat...</p>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="nav-icon" style={{ fontSize: 40 }}></div>
            <h3>Belum ada supplier</h3>
            <p className="text-sm">Tambahkan pemasok bahan baku Anda.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Nama</th><th>Bahan Utama</th><th>Kontak</th><th>Rating</th><th>Pembelian</th><th>Total</th><th>Terakhir</th><th></th></tr>
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
                    <td className="text-right">
                      <div className="flex gap-1 justify-end">
                        <button className="btn btn-sm btn-outline"
                          onClick={() => setEditRow({ id: s.id, nama: s.nama, kontak: s.kontak || '', bahan_utama: s.bahan_utama || '', alamat: s.alamat || '', rating: s.rating || 0 })}><Icon name="sliders" size={13} /></button>
                        <button className="btn btn-sm btn-danger" onClick={() => hapusSupplier(s)}><Icon name="close" size={13} /></button>
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
