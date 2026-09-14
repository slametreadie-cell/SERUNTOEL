import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../utils/supabaseClient'
import { useAuth } from '../../components/AuthProvider'
import AppLayout from '../../components/AppLayout'
import { logAudit } from '../../utils/audit'
import Icon from '../../components/Icons'
import { StatCard, SkeletonStat, SkeletonRows, EmptyBlock } from '../../components/DashboardWidgets'

const hariIni = () => new Date().toISOString().slice(0, 10)
const tglID = (v) => v ? new Date(v).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

const selisihHari = (tgl) => {
  if (!tgl) return null
  const a = new Date(tgl + 'T00:00:00'); const b = new Date(hariIni() + 'T00:00:00')
  return Math.round((a - b) / 86400000)
}

export default function Kadaluarsa() {
  const { user } = useAuth()
  const [data, setData] = useState([])
  const [produk, setProduk] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [filter, setFilter] = useState('semua')

  const [form, setForm] = useState({
    produk_id: '', batch_id: '', tgl_produksi: hariIni(),
    masa_simpan: '3', tgl_kadaluarsa: '', qty: '',
  })

  const fetchData = useCallback(async () => {
    setLoading(true); setError('')
    const [eRes, pRes] = await Promise.all([
      supabase.from('expired_products').select('*').order('tgl_kadaluarsa'),
      supabase.from('products').select('id, nama_produk').order('nama_produk'),
    ])
    if (eRes.error) setError(eRes.error.message)
    setData(eRes.data || [])
    setProduk(pRes.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Auto-update status berdasarkan tanggal
  useEffect(() => {
    const hari = hariIni()
    const perlu = data.filter((d) =>
      (d.status === 'aktif' && d.tgl_kadaluarsa && d.tgl_kadaluarsa < hari) ||
      (d.status === 'aktif' && (d.sisa_qty || 0) <= 0 && (d.qty || 0) > 0)
    )
    perlu.forEach((d) => {
      const kadaluarsa = d.tgl_kadaluarsa && d.tgl_kadaluarsa < hari
      supabase.from('expired_products')
        .update({ status: kadaluarsa ? 'kadaluarsa' : 'habis' }).eq('id', d.id)
    })
    if (perlu.length) setTimeout(fetchData, 700)
  }, [data])

  // Auto-hitung tgl_kadaluarsa dari produksi + masa simpan
  useEffect(() => {
    if (!form.tgl_produksi || !form.masa_simpan) return
    const d = new Date(form.tgl_produksi + 'T00:00:00')
    d.setDate(d.getDate() + (Number(form.masa_simpan) || 0))
    setForm((f) => ({ ...f, tgl_kadaluarsa: d.toISOString().slice(0, 10) }))
  }, [form.tgl_produksi, form.masa_simpan])

  const simpan = async (e) => {
    e.preventDefault()
    const p = produk.find((x) => x.id === form.produk_id)
    if (!p) { setError('Pilih produk dulu'); return }
    const qty = Number(form.qty)
    if (!qty || qty <= 0) { setError('Qty harus lebih dari 0'); return }

    setSaving(true); setError('')
    try {
      const { error } = await supabase.from('expired_products').insert({
        produk_id: p.id, nama_produk: p.nama_produk,
        batch_id: form.batch_id || `BATCH-${Date.now().toString().slice(-8)}`,
        tgl_produksi: form.tgl_produksi || hariIni(),
        masa_simpan: Number(form.masa_simpan) || 0,
        tgl_kadaluarsa: form.tgl_kadaluarsa || null,
        qty, sisa_qty: qty, status: 'aktif',
      })
      if (error) throw error
      logAudit({ aksi: 'tambah_batch', user, sheetTarget: 'expired_products',
        detail: { produk: p.nama_produk, qty, tgl_kadaluarsa: form.tgl_kadaluarsa } })
      setMsg(' Batch dicatat')
      setForm({ produk_id: '', batch_id: '', tgl_produksi: hariIni(), masa_simpan: '3', tgl_kadaluarsa: '', qty: '' })
      fetchData()
    } catch (err) { setError(err.message) }
    finally { setSaving(false); setTimeout(() => setMsg(''), 3000) }
  }

  const ubahSisa = async (row, val) => {
    const sisa = Math.max(0, Number(val) || 0)
    await supabase.from('expired_products').update({
      sisa_qty: sisa,
      status: sisa === 0 ? 'habis' : (row.tgl_kadaluarsa && row.tgl_kadaluarsa < hariIni() ? 'kadaluarsa' : 'aktif'),
    }).eq('id', row.id)
    fetchData()
  }

  const hapus = async (row) => {
    if (!confirm(`Hapus batch ${row.nama_produk}?`)) return
    await supabase.from('expired_products').delete().eq('id', row.id)
    fetchData()
  }

  // Klasifikasi
  const denganStatus = data.map((d) => {
    const sisaHari = selisihHari(d.tgl_kadaluarsa)
    let kondisi = 'aman'
    if (d.status === 'kadaluarsa' || (sisaHari !== null && sisaHari < 0)) kondisi = 'kadaluarsa'
    else if ((d.sisa_qty || 0) <= 0) kondisi = 'habis'
    else if (sisaHari !== null && sisaHari <= 2) kondisi = 'kritis'
    else if (sisaHari !== null && sisaHari <= 7) kondisi = 'peringatan'
    return { ...d, sisaHari, kondisi }
  })

  const filtered = denganStatus.filter((d) =>
    filter === 'semua' ? true : filter === 'perlu' ? ['kritis', 'kadaluarsa'].includes(d.kondisi) : d.kondisi === filter
  )

  const stat = useMemo(() => {
    const aktif = denganStatus.filter((d) => d.kondisi !== 'habis')
    return {
      total: denganStatus.length,
      kritis: denganStatus.filter((d) => d.kondisi === 'kritis').length,
      kadaluarsa: denganStatus.filter((d) => d.kondisi === 'kadaluarsa').length,
      sisa: aktif.reduce((s, d) => s + (d.sisa_qty || 0), 0),
    }
  }, [denganStatus])

  const BADGE = { aman: 'badge-success', peringatan: 'badge-info', kritis: 'badge-warning', kadaluarsa: 'badge-danger', habis: 'badge-neutral' }
  const LABEL = { aman: 'Aman', peringatan: '≤7 hari', kritis: '≤2 hari', kadaluarsa: 'Kadaluarsa', habis: 'Habis' }

  return (
    <AppLayout title="Produk Kadaluarsa" subtitle="Pantau masa simpan & batch produksi">
      {msg && <div className="alert alert-success">{msg}</div>}
      {error && <div className="alert alert-danger"> {error}</div>}

      <div className="metrics-grid">
        <StatCard label="Total Batch" value={stat.total} icon="box" tone="primary" />
        <StatCard label="Segera Kadaluarsa (≤2 hari)" value={stat.kritis} icon="calendar" tone="warning" />
        <StatCard label="Sudah Kadaluarsa" value={stat.kadaluarsa} icon="barChart" tone="danger" />
        <StatCard label="Total Sisa Qty" value={stat.sisa} icon="box" />
      </div>

      {stat.kritis + stat.kadaluarsa > 0 && (
        <div className="alert alert-warning">
           Ada <b>{stat.kritis + stat.kadaluarsa} batch</b> perlu tindakan segera. Prioritaskan menjual/mengolah batch terdekat kadaluarsa.
        </div>
      )}

      <form onSubmit={simpan}>
        <div className="card">
          <div className="card-header"><div className="card-title"><span className="nav-icon">⏳</span> Catat Batch Produksi</div></div>
          <div className="form-row">
            <div className="form-group" style={{ flex: 2 }}>
              <label className="form-label">Produk *</label>
              <select className="form-control" value={form.produk_id} onChange={(e) => setForm({ ...form, produk_id: e.target.value })}>
                <option value="">— Pilih produk —</option>
                {produk.map((p) => <option key={p.id} value={p.id}>{p.nama_produk}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Kode Batch (opsional)</label>
              <input className="form-control" value={form.batch_id} onChange={(e) => setForm({ ...form, batch_id: e.target.value })} placeholder="otomatis" />
            </div>
            <div className="form-group">
              <label className="form-label">Qty *</label>
              <input className="form-control" type="number" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} placeholder="0" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Tanggal Produksi</label>
              <input className="form-control" type="date" value={form.tgl_produksi} onChange={(e) => setForm({ ...form, tgl_produksi: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Masa Simpan (hari)</label>
              <input className="form-control" type="number" value={form.masa_simpan} onChange={(e) => setForm({ ...form, masa_simpan: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Tanggal Kadaluarsa</label>
              <input className="form-control" type="date" value={form.tgl_kadaluarsa} onChange={(e) => setForm({ ...form, tgl_kadaluarsa: e.target.value })} />
              <div className="text-xs text-muted mt-1">Terisi otomatis dari produksi + masa simpan</div>
            </div>
          </div>
          <div className="flex justify-end">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <><span className="spinner" /> Menyimpan...</> : '＋ Catat Batch'}
            </button>
          </div>
        </div>
      </form>

      <div className="card" style={{ padding: 0 }}>
        <div className="card-header" style={{ padding: 16 }}>
          <div className="card-title"><Icon name="box" size={16} /> Daftar Batch</div>
          <div className="flex flex-wrap gap-2">
            {[
              { k: 'perlu', l: ' Perlu Tindakan' },
              { k: 'semua', l: 'Semua' },
              { k: 'aman', l: 'Aman' },
              { k: 'kadaluarsa', l: 'Kadaluarsa' },
            ].map((f) => (
              <button key={f.k} className={`btn btn-sm ${filter === f.k ? 'btn-primary' : 'btn-outline'}`} onClick={() => setFilter(f.k)}>{f.l}</button>
            ))}
          </div>
        </div>

        {loading ? <div className="p-3"><SkeletonRows rows={4} /></div>
          : filtered.length === 0 ? (
            <div className="empty-state">
              <div className="nav-icon" style={{ fontSize: 40 }}>⏳</div>
              <h3>Tidak ada batch</h3>
              <p className="text-sm">Catat batch produksi untuk memantau masa simpan.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Produk</th><th>Batch</th><th>Produksi</th><th>Kadaluarsa</th><th>Sisa Hari</th><th className="text-right">Qty</th><th className="text-right">Sisa</th><th>Status</th><th></th></tr>
                </thead>
                <tbody>
                  {filtered.map((d) => (
                    <tr key={d.id}>
                      <td className="font-bold">{d.nama_produk}</td>
                      <td className="text-xs text-muted">{d.batch_id || '—'}</td>
                      <td className="text-sm text-muted">{tglID(d.tgl_produksi)}</td>
                      <td className="text-sm">{tglID(d.tgl_kadaluarsa)}</td>
                      <td>
                        <b className={d.sisaHari === null ? '' : d.sisaHari < 0 ? 'text-danger' : d.sisaHari <= 2 ? 'text-warning' : 'text-success'}>
                          {d.sisaHari === null ? '—' : d.sisaHari < 0 ? `lewat ${Math.abs(d.sisaHari)}h` : `${d.sisaHari} hari`}
                        </b>
                      </td>
                      <td className="text-right">{d.qty}</td>
                      <td className="text-right">
                        <input className="form-control" type="number" style={{ maxWidth: 80, padding: '4px 8px', textAlign: 'right' }}
                          defaultValue={d.sisa_qty || 0} onBlur={(e) => ubahSisa(d, e.target.value)} />
                      </td>
                      <td><span className={`badge ${BADGE[d.kondisi]}`}>{LABEL[d.kondisi]}</span></td>
                      <td className="text-right"><button className="btn btn-sm btn-danger" onClick={() => hapus(d)}><Icon name="close" size={13} /></button></td>
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
