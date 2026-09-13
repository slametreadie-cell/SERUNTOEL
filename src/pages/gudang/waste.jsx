import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../utils/supabaseClient'
import { useAuth } from '../../components/AuthProvider'
import AppLayout from '../../components/AppLayout'
import { logAudit } from '../../utils/audit'
import Icon from '../../components/Icons'

const formatRupiah = (v) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v || 0)

const hariIni = () => new Date().toISOString().slice(0, 10)
const tglID = (v) => v ? new Date(v).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

const ALASAN = ['Rusak / basi', 'Tumpah', 'Salah masak', 'Kadaluarsa', 'Susut penyimpanan', 'Retur pelanggan', 'Lainnya']

export default function Waste() {
  const { user } = useAuth()
  const [data, setData] = useState([])
  const [produk, setProduk] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [search, setSearch] = useState('')
  const [dari, setDari] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 29); return d.toISOString().slice(0, 10)
  })
  const [sampai, setSampai] = useState(hariIni())

  const [form, setForm] = useState({ tanggal: hariIni(), produk_id: '', qty_waste: '', alasan: ALASAN[0], petugas: '' })

  const fetchData = useCallback(async () => {
    setLoading(true); setError('')
    const [wRes, pRes] = await Promise.all([
      supabase.from('waste_logs').select('*')
        .gte('tanggal', dari).lte('tanggal', sampai)
        .order('tanggal', { ascending: false }),
      supabase.from('products').select('id, nama_produk, hpp_per_unit').order('nama_produk'),
    ])
    if (wRes.error) setError(wRes.error.message)
    setData(wRes.data || [])
    setProduk(pRes.data || [])
    setLoading(false)
  }, [dari, sampai])

  useEffect(() => { fetchData() }, [fetchData])

  const simpan = async (e) => {
    e.preventDefault()
    const p = produk.find((x) => x.id === form.produk_id)
    if (!p) { setError('Pilih produk dulu'); return }
    const qty = Number(form.qty_waste)
    if (!qty || qty <= 0) { setError('Qty waste harus lebih dari 0'); return }

    setSaving(true); setError('')
    try {
      const hpp = (Number(p.hpp_per_unit) || 0) * qty
      const { error } = await supabase.from('waste_logs').insert({
        tanggal: form.tanggal || hariIni(),
        produk_id: p.id, nama_produk: p.nama_produk,
        qty_waste: qty, alasan: form.alasan || null,
        biaya_hpp: hpp, petugas: form.petugas || user?.email || null,
      })
      if (error) throw error

      // kurangi stok produk
      const { data: fresh } = await supabase.from('products').select('stok_produk').eq('id', p.id).single()
      const stokBaru = Math.max(0, (fresh?.stok_produk || 0) - qty)
      await supabase.from('products').update({ stok_produk: stokBaru }).eq('id', p.id)

      logAudit({ aksi: 'waste', user, sheetTarget: 'waste_logs',
        detail: { produk: p.nama_produk, qty, alasan: form.alasan, biaya: hpp } })

      setMsg(` Waste dicatat — kerugian ${formatRupiah(hpp)}`)
      setForm({ ...form, produk_id: '', qty_waste: '', petugas: '' })
      fetchData()
    } catch (err) { setError(err.message) }
    finally { setSaving(false); setTimeout(() => setMsg(''), 4000) }
  }

  const hapus = async (w) => {
    if (!confirm(`Hapus catatan waste ${w.nama_produk}? Stok tidak dikembalikan.`)) return
    await supabase.from('waste_logs').delete().eq('id', w.id)
    fetchData()
  }

  const filtered = data.filter((w) =>
    !search || (w.nama_produk || '').toLowerCase().includes(search.toLowerCase()) ||
    (w.alasan || '').toLowerCase().includes(search.toLowerCase())
  )

  const stat = useMemo(() => {
    const biaya = filtered.reduce((s, w) => s + Number(w.biaya_hpp || 0), 0)
    const qty = filtered.reduce((s, w) => s + (w.qty_waste || 0), 0)
    const perAlasan = {}
    filtered.forEach((w) => { perAlasan[w.alasan || 'Lainnya'] = (perAlasan[w.alasan || 'Lainnya'] || 0) + 1 })
    const teratas = Object.entries(perAlasan).sort((a, b) => b[1] - a[1])[0]
    return { biaya, qty, n: filtered.length, teratas: teratas ? teratas[0] : '—' }
  }, [filtered])

  return (
    <AppLayout title="Waste Log" subtitle="Catat produk rusak & kerugian">
      {msg && <div className="alert alert-success">{msg}</div>}
      {error && <div className="alert alert-danger"> {error}</div>}

      <div className="metrics-grid">
        <div className="metric-card"><div className="metric-label">Total Kerugian</div><div className="metric-value text-danger">{formatRupiah(stat.biaya)}</div></div>
        <div className="metric-card"><div className="metric-label">Total Qty Waste</div><div className="metric-value">{stat.qty}</div></div>
        <div className="metric-card"><div className="metric-label">Jumlah Catatan</div><div className="metric-value">{stat.n}</div></div>
        <div className="metric-card"><div className="metric-label">Alasan Terbanyak</div><div className="metric-value" style={{ fontSize: 15 }}>{stat.teratas}</div></div>
      </div>

      <form onSubmit={simpan}>
        <div className="card">
          <div className="card-header"><div className="card-title"><Icon name="trash" size={16} /> Catat Waste Baru</div></div>
          <div className="form-row">
            <div className="form-group" style={{ flex: 2 }}>
              <label className="form-label">Produk *</label>
              <select className="form-control" value={form.produk_id} onChange={(e) => setForm({ ...form, produk_id: e.target.value })}>
                <option value="">— Pilih produk —</option>
                {produk.map((p) => (
                  <option key={p.id} value={p.id}>{p.nama_produk} (HPP {formatRupiah(p.hpp_per_unit)})</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Qty *</label>
              <input className="form-control" type="number" value={form.qty_waste}
                onChange={(e) => setForm({ ...form, qty_waste: e.target.value })} placeholder="0" />
            </div>
            <div className="form-group">
              <label className="form-label">Tanggal</label>
              <input className="form-control" type="date" value={form.tanggal} onChange={(e) => setForm({ ...form, tanggal: e.target.value })} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Alasan</label>
              <select className="form-control" value={form.alasan} onChange={(e) => setForm({ ...form, alasan: e.target.value })}>
                {ALASAN.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Petugas</label>
              <input className="form-control" value={form.petugas} onChange={(e) => setForm({ ...form, petugas: e.target.value })} placeholder={user?.email || 'Nama petugas'} />
            </div>
          </div>
          {form.produk_id && form.qty_waste && (
            <div className="alert alert-warning">
              Perkiraan kerugian:{' '}
              <b>{formatRupiah((Number(produk.find((x) => x.id === form.produk_id)?.hpp_per_unit) || 0) * (Number(form.qty_waste) || 0))}</b>
              {' '}· stok produk akan berkurang {form.qty_waste}
            </div>
          )}
          <div className="flex justify-end">
            <button type="submit" className="btn btn-danger" disabled={saving}>
              {saving ? <><span className="spinner" /> Menyimpan...</> : ' Catat Waste'}
            </button>
          </div>
        </div>
      </form>

      <div className="card" style={{ padding: 0 }}>
        <div className="card-header" style={{ padding: 16 }}>
          <div className="card-title"><Icon name="clipboard" size={16} /> Riwayat Waste</div>
        </div>
        <div style={{ padding: '0 16px 12px' }} className="flex flex-wrap gap-2">
          <input className="form-control" type="date" style={{ maxWidth: 165 }} value={dari} onChange={(e) => setDari(e.target.value)} />
          <span className="text-muted text-sm">s/d</span>
          <input className="form-control" type="date" style={{ maxWidth: 165 }} value={sampai} onChange={(e) => setSampai(e.target.value)} />
          <input className="form-control" style={{ maxWidth: 200 }} placeholder="Cari produk/alasan..."
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {loading ? <p className="text-muted text-center py-4">Memuat...</p>
          : filtered.length === 0 ? (
            <div className="empty-state">
              <div className="nav-icon" style={{ fontSize: 40 }}></div>
              <h3>Belum ada waste</h3>
              <p className="text-sm">Bagus! Tidak ada produk terbuang pada periode ini.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Tanggal</th><th>Produk</th><th className="text-right">Qty</th><th>Alasan</th><th className="text-right">Kerugian</th><th>Petugas</th><th></th></tr></thead>
                <tbody>
                  {filtered.map((w) => (
                    <tr key={w.id}>
                      <td className="text-muted text-sm">{tglID(w.tanggal)}</td>
                      <td className="font-bold">{w.nama_produk}</td>
                      <td className="text-right font-bold">{w.qty_waste}</td>
                      <td><span className="badge badge-warning">{w.alasan || '—'}</span></td>
                      <td className="text-right text-danger font-bold">{formatRupiah(w.biaya_hpp)}</td>
                      <td className="text-muted text-xs">{w.petugas || '—'}</td>
                      <td className="text-right"><button className="btn btn-sm btn-danger" onClick={() => hapus(w)}><Icon name="close" size={13} /></button></td>
                    </tr>
                  ))}
                  <tr style={{ background: 'var(--bg)' }}>
                    <td colSpan={2} className="font-extrabold">TOTAL</td>
                    <td className="text-right font-extrabold">{stat.qty}</td>
                    <td></td>
                    <td className="text-right font-extrabold text-danger">{formatRupiah(stat.biaya)}</td>
                    <td colSpan={2}></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
      </div>
    </AppLayout>
  )
}
