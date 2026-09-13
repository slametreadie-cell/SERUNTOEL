import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../utils/supabaseClient'
import { useAuth } from '../../components/AuthProvider'
import AppLayout from '../../components/AppLayout'
import { logAudit } from '../../utils/audit'
import Icon from '../../components/Icons'

const formatRupiah = (v) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v || 0)

export default function DuplikatProduk() {
  const { user } = useAuth()
  const [produk, setProduk] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [search, setSearch] = useState('')
  const [sumber, setSumber] = useState(null)
  const [hasil, setHasil] = useState([])

  const [form, setForm] = useState({ nama_produk: '', harga_jual: '', hpp_per_unit: '', stok_produk: '0', kategori: '' })

  const fetchData = useCallback(async () => {
    setLoading(true); setError('')
    const { data, error } = await supabase.from('products').select('*').order('nama_produk')
    if (error) setError(error.message)
    else setProduk(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const pilih = (p) => {
    setSumber(p)
    setForm({
      nama_produk: `${p.nama_produk} (Copy)`,
      harga_jual: String(p.harga_jual ?? ''),
      hpp_per_unit: String(p.hpp_per_unit ?? ''),
      stok_produk: '0',
      kategori: p.kategori || '',
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const duplikat = async (e) => {
    e.preventDefault()
    if (!sumber) { setError('Pilih produk sumber dulu'); return }
    if (!form.nama_produk.trim()) { setError('Nama produk baru wajib diisi'); return }
    setSaving(true); setError('')
    try {
      const { data, error } = await supabase.from('products').insert({
        nama_produk: form.nama_produk.trim(),
        kategori: form.kategori || null,
        harga_jual: Number(form.harga_jual) || 0,
        hpp_per_unit: Number(form.hpp_per_unit) || 0,
        stok_produk: Number(form.stok_produk) || 0,
        jumlah_produksi: 0,
        total_hpp: 0,
        margin: sumber.margin || 0,
        rincian_json: sumber.rincian_json || {},
        foto_url: sumber.foto_url || null,
      }).select().single()
      if (error) throw error

      logAudit({ aksi: 'duplikat_produk', user, sheetTarget: 'products',
        detail: { dari: sumber.nama_produk, ke: form.nama_produk } })

      setMsg(` Produk "${form.nama_produk}" dibuat dari "${sumber.nama_produk}"`)
      setHasil((prev) => [{ nama: data.nama_produk, dari: sumber.nama_produk }, ...prev])
      setSumber(null)
      fetchData()
    } catch (err) { setError(err.message) }
    finally { setSaving(false); setTimeout(() => setMsg(''), 5000) }
  }

  const hapus = async (p) => {
    if (!confirm(`Hapus produk ${p.nama_produk}?`)) return
    await supabase.from('products').delete().eq('id', p.id)
    fetchData()
  }

  const filtered = produk.filter((p) =>
    !search || (p.nama_produk || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.kategori || '').toLowerCase().includes(search.toLowerCase()))

  return (
    <AppLayout
      title="Duplikat Produk"
      subtitle="Buat produk baru dari produk yang mirip"
      actions={<Link href="/produk-hpp" className="btn btn-outline btn-sm">← Produk & HPP</Link>}
    >
      {msg && <div className="alert alert-success">{msg}</div>}
      {error && <div className="alert alert-danger"> {error}</div>}

      {sumber && (
        <form onSubmit={duplikat}>
          <div className="card" style={{ border: '2px solid var(--primary)' }}>
            <div className="card-header">
              <div className="card-title"><Icon name="fileText" size={16} /> Duplikat dari: {sumber.nama_produk}</div>
              <button type="button" className="btn btn-sm btn-outline" onClick={() => setSumber(null)}><Icon name="close" size={13} /></button>
            </div>
            <div className="text-sm text-muted mb-3">
              Foto, margin, dan rincian HPP ikut disalin. Sesuaikan nama, harga, dan stok di bawah.
            </div>

            <div className="form-row">
              <div className="form-group" style={{ flex: 2 }}>
                <label className="form-label">Nama Produk Baru *</label>
                <input className="form-control" value={form.nama_produk} onChange={(e) => setForm({ ...form, nama_produk: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Kategori</label>
                <input className="form-control" value={form.kategori} onChange={(e) => setForm({ ...form, kategori: e.target.value })} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">HPP / Unit (Rp)</label>
                <input className="form-control" type="number" value={form.hpp_per_unit} onChange={(e) => setForm({ ...form, hpp_per_unit: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Harga Jual (Rp)</label>
                <input className="form-control" type="number" value={form.harga_jual} onChange={(e) => setForm({ ...form, harga_jual: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Stok Awal</label>
                <input className="form-control" type="number" value={form.stok_produk} onChange={(e) => setForm({ ...form, stok_produk: e.target.value })} />
              </div>
            </div>

            {(() => {
              const hpp = Number(form.hpp_per_unit) || 0
              const jual = Number(form.harga_jual) || 0
              const laba = jual - hpp
              const margin = jual > 0 ? (laba / jual) * 100 : 0
              return (
                <div className={`alert ${laba >= 0 ? 'alert-info' : 'alert-danger'}`}>
                  Laba per unit <b>{formatRupiah(laba)}</b> · margin <b>{margin.toFixed(1)}%</b>
                </div>
              )
            })()}

            <div className="flex gap-2 justify-end">
              <button type="button" className="btn btn-outline" onClick={() => setSumber(null)}>Batal</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? <><span className="spinner" /> Membuat...</> : ' Buat Duplikat'}
              </button>
            </div>
          </div>
        </form>
      )}

      {hasil.length > 0 && (
        <div className="card">
          <div className="card-header"><div className="card-title"><Icon name="checkSquare" size={16} /> Baru Dibuat</div></div>
          {hasil.map((h, i) => (
            <div key={i} className="text-sm" style={{ padding: '6px 0', borderBottom: '1px dashed var(--border)' }}>
              <b>{h.nama}</b> <span className="text-muted">dari {h.dari}</span>
            </div>
          ))}
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
        <div className="card-header" style={{ padding: 16 }}>
          <div className="card-title"><Icon name="box" size={16} /> Pilih Produk Sumber</div>
          <input className="form-control" style={{ maxWidth: 240 }} placeholder="Cari produk..."
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {loading ? <p className="text-muted text-center py-4">Memuat...</p>
          : filtered.length === 0 ? (
            <div className="empty-state">
              <div className="nav-icon" style={{ fontSize: 40 }}></div>
              <h3>Belum ada produk</h3>
              <p className="text-sm">Tambahkan produk dulu di menu Produk & HPP.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Nama</th><th>Kategori</th><th className="text-right">HPP</th><th className="text-right">Harga Jual</th><th className="text-right">Stok</th><th></th></tr></thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr key={p.id}>
                      <td className="font-bold">{p.nama_produk}</td>
                      <td><span className="badge badge-neutral">{p.kategori || '—'}</span></td>
                      <td className="text-right">{formatRupiah(p.hpp_per_unit)}</td>
                      <td className="text-right font-bold text-primary">{formatRupiah(p.harga_jual)}</td>
                      <td className="text-right">{p.stok_produk || 0}</td>
                      <td className="text-right">
                        <div className="flex gap-1 justify-end">
                          <button className="btn btn-sm btn-primary" onClick={() => pilih(p)}> Duplikat</button>
                          <Link href={`/produk-hpp/${p.id}`} className="btn btn-sm btn-outline">Lihat</Link>
                          <button className="btn btn-sm btn-danger" onClick={() => hapus(p)}><Icon name="close" size={13} /></button>
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
