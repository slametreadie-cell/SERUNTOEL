import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../utils/supabaseClient'
import { useAuth } from '../components/AuthProvider'
import AppLayout from '../components/AppLayout'
import { logAudit } from '../utils/audit'

const hariIni = () => new Date().toISOString().slice(0, 10)
const tglID = (v) => v ? new Date(v).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

const NUTRISI = [
  { k: 'kalori', l: 'Kalori', u: 'kkal' },
  { k: 'protein', l: 'Protein', u: 'g' },
  { k: 'lemak', l: 'Lemak', u: 'g' },
  { k: 'karbohidrat', l: 'Karbohidrat', u: 'g' },
  { k: 'gula', l: 'Gula', u: 'g' },
  { k: 'natrium', l: 'Natrium', u: 'mg' },
  { k: 'serat', l: 'Serat', u: 'g' },
]

const KOSONG = { produk_id: '', takaran_saji: '100 g', kalori: '', protein: '', lemak: '', karbohidrat: '', gula: '', natrium: '', serat: '', keterangan: '' }

export default function LabelGizi() {
  const { user } = useAuth()
  const [data, setData] = useState([])
  const [produk, setProduk] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [search, setSearch] = useState('')
  const [form, setForm] = useState(KOSONG)
  const [editId, setEditId] = useState(null)
  const [cetak, setCetak] = useState(null)

  const fetchData = useCallback(async () => {
    setLoading(true); setError('')
    const [nRes, pRes] = await Promise.all([
      supabase.from('nutrition_labels').select('*').order('tanggal', { ascending: false }),
      supabase.from('products').select('id, nama_produk').order('nama_produk'),
    ])
    if (nRes.error) setError(nRes.error.message)
    setData(nRes.data || [])
    setProduk(pRes.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const pilihProduk = (id) => {
    const p = produk.find((x) => x.id === id)
    setForm((f) => ({ ...f, produk_id: id }))
  }

  const simpan = async (e) => {
    e.preventDefault()
    const p = produk.find((x) => x.id === form.produk_id)
    if (!p) { setError('Pilih produk dulu'); return }
    setSaving(true); setError('')
    try {
      const payload = {
        produk_id: p.id, nama_produk: p.nama_produk,
        takaran_saji: form.takaran_saji || null,
        kalori: Number(form.kalori) || 0, protein: Number(form.protein) || 0,
        lemak: Number(form.lemak) || 0, karbohidrat: Number(form.karbohidrat) || 0,
        gula: Number(form.gula) || 0, natrium: Number(form.natrium) || 0,
        serat: Number(form.serat) || 0, keterangan: form.keterangan || null,
        tanggal: hariIni(),
      }
      if (editId) {
        const { error } = await supabase.from('nutrition_labels').update(payload).eq('id', editId)
        if (error) throw error
      } else {
        const { error } = await supabase.from('nutrition_labels').insert(payload)
        if (error) throw error
      }
      logAudit({ aksi: editId ? 'ubah_label_gizi' : 'tambah_label_gizi', user, sheetTarget: 'nutrition_labels',
        detail: { produk: p.nama_produk, kalori: payload.kalori } })
      setMsg(editId ? '✅ Label diperbarui' : '✅ Label gizi disimpan')
      setForm(KOSONG); setEditId(null)
      fetchData()
    } catch (err) { setError(err.message) }
    finally { setSaving(false); setTimeout(() => setMsg(''), 3000) }
  }

  const edit = (row) => {
    setEditId(row.id)
    setForm({
      produk_id: row.produk_id || '', takaran_saji: row.takaran_saji || '', kalori: String(row.kalori ?? ''),
      protein: String(row.protein ?? ''), lemak: String(row.lemak ?? ''), karbohidrat: String(row.karbohidrat ?? ''),
      gula: String(row.gula ?? ''), natrium: String(row.natrium ?? ''), serat: String(row.serat ?? ''),
      keterangan: row.keterangan || '',
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const hapus = async (row) => {
    if (!confirm(`Hapus label ${row.nama_produk}?`)) return
    await supabase.from('nutrition_labels').delete().eq('id', row.id)
    fetchData()
  }

  const filtered = data.filter((d) =>
    !search || (d.nama_produk || '').toLowerCase().includes(search.toLowerCase()))

  const stat = useMemo(() => ({
    total: data.length,
    rataKalori: data.length ? Math.round(data.reduce((s, d) => s + Number(d.kalori || 0), 0) / data.length) : 0,
    tertinggi: data.length ? Math.max(...data.map((d) => Number(d.kalori || 0))) : 0,
  }), [data])

  return (
    <AppLayout title="Label Gizi" subtitle="Informasi nilai gizi produk">
      {msg && <div className="alert alert-success">{msg}</div>}
      {error && <div className="alert alert-danger">⚠️ {error}</div>}

      <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
        <div className="metric-card"><div className="metric-label">Produk Berlabel</div><div className="metric-value text-primary">{stat.total}</div></div>
        <div className="metric-card"><div className="metric-label">Rata-rata Kalori</div><div className="metric-value">{stat.rataKalori} <span className="text-xs text-muted">kkal</span></div></div>
        <div className="metric-card"><div className="metric-label">Kalori Tertinggi</div><div className="metric-value text-warning">{stat.tertinggi} <span className="text-xs text-muted">kkal</span></div></div>
      </div>

      <form onSubmit={simpan}>
        <div className="card">
          <div className="card-header">
            <div className="card-title"><div className="nav-icon">🥗</div> {editId ? 'Ubah Label Gizi' : 'Buat Label Gizi'}</div>
            {editId && <button type="button" className="btn btn-sm btn-outline" onClick={() => { setEditId(null); setForm(KOSONG) }}>Batal Edit</button>}
          </div>

          <div className="form-row">
            <div className="form-group" style={{ flex: 2 }}>
              <label className="form-label">Produk *</label>
              <select className="form-control" value={form.produk_id} onChange={(e) => pilihProduk(e.target.value)}>
                <option value="">— Pilih produk —</option>
                {produk.map((p) => <option key={p.id} value={p.id}>{p.nama_produk}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Takaran Saji</label>
              <input className="form-control" value={form.takaran_saji} onChange={(e) => setForm({ ...form, takaran_saji: e.target.value })} placeholder="mis. 100 g / 1 porsi" />
            </div>
          </div>

          <div className="nutri-grid">
            {NUTRISI.map((n) => (
              <div className="form-group" key={n.k}>
                <label className="form-label">{n.l} <span className="text-xs text-muted">({n.u})</span></label>
                <input className="form-control" type="number" step="0.1" value={form[n.k]}
                  onChange={(e) => setForm({ ...form, [n.k]: e.target.value })} placeholder="0" />
              </div>
            ))}
          </div>

          <div className="form-group">
            <label className="form-label">Keterangan</label>
            <input className="form-control" value={form.keterangan} onChange={(e) => setForm({ ...form, keterangan: e.target.value })}
              placeholder="mis. mengandung ikan, kacang" />
          </div>

          <div className="flex justify-end">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <><span className="spinner" /> Menyimpan...</> : editId ? '💾 Perbarui' : '＋ Simpan Label'}
            </button>
          </div>
        </div>
      </form>

      <div className="card" style={{ padding: 0 }}>
        <div className="card-header" style={{ padding: 16 }}>
          <div className="card-title"><span className="nav-icon">📋</span> Daftar Label</div>
          <input className="form-control" style={{ maxWidth: 220 }} placeholder="🔍 Cari produk..."
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {loading ? <p className="text-muted text-center py-4">Memuat...</p>
          : filtered.length === 0 ? (
            <div className="empty-state">
              <div className="nav-icon" style={{ fontSize: 40 }}>🥗</div>
              <h3>Belum ada label gizi</h3>
              <p className="text-sm">Buat label untuk mencantumkan informasi gizi pada kemasan.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Produk</th><th>Takaran</th>{NUTRISI.map((n) => <th key={n.k} className="text-right">{n.l}</th>)}<th></th></tr>
                </thead>
                <tbody>
                  {filtered.map((d) => (
                    <tr key={d.id}>
                      <td className="font-bold">{d.nama_produk}</td>
                      <td className="text-sm text-muted">{d.takaran_saji || '—'}</td>
                      {NUTRISI.map((n) => (
                        <td key={n.k} className="text-right">{Number(d[n.k] || 0).toLocaleString('id-ID')}</td>
                      ))}
                      <td className="text-right">
                        <div className="flex gap-1 justify-end">
                          <button className="btn btn-sm btn-outline" onClick={() => setCetak(d)}>🏷️</button>
                          <button className="btn btn-sm btn-outline" onClick={() => edit(d)}>✏️</button>
                          <button className="btn btn-sm btn-danger" onClick={() => hapus(d)}>✕</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>

      {/* Preview label */}
      {cetak && (
        <div className="card" style={{ border: '2px solid var(--primary)' }}>
          <div className="card-header">
            <div className="card-title"><span className="nav-icon">🏷️</span> Preview Label — {cetak.nama_produk}</div>
            <div className="flex gap-2">
              <button className="btn btn-sm btn-primary" onClick={() => window.print()}>🖨️ Cetak</button>
              <button className="btn btn-sm btn-outline" onClick={() => setCetak(null)}>✕</button>
            </div>
          </div>
          <div className="label-preview">
            <div className="lp-title">INFORMASI NILAI GIZI</div>
            <div className="lp-sub">{cetak.nama_produk}</div>
            <div className="lp-saji">Takaran saji: {cetak.takaran_saji || '100 g'}</div>
            <table className="lp-table">
              <tbody>
                <tr className="lp-head"><td>Zat Gizi</td><td className="text-right">Jumlah</td></tr>
                {NUTRISI.map((n) => (
                  <tr key={n.k}>
                    <td>{n.l}</td>
                    <td className="text-right"><b>{Number(cetak[n.k] || 0).toLocaleString('id-ID')}</b> {n.u}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {cetak.keterangan && <div className="lp-note">{cetak.keterangan}</div>}
            <div className="lp-foot">Diproduksi: {tglID(cetak.tanggal)}</div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @media print {
          .sidebar, .topbar, .no-print { display: none !important; }
        }
      `}</style>
      <style jsx>{`
        .nutri-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0 12px; }
        @media (min-width: 700px) { .nutri-grid { grid-template-columns: repeat(4, 1fr); } }
        .label-preview { max-width: 340px; margin: 0 auto; border: 2px solid #000; border-radius: 6px; padding: 12px; background: #fff; color: #000; }
        .lp-title { font-weight: 800; font-size: 16px; text-align: center; border-bottom: 6px solid #000; padding-bottom: 6px; }
        .lp-sub { font-weight: 700; text-align: center; padding: 6px 0; }
        .lp-saji { font-size: 12px; border-bottom: 1px solid #000; padding-bottom: 4px; margin-bottom: 6px; }
        .lp-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .lp-table td { padding: 3px 0; border-bottom: 1px solid #ddd; }
        .lp-head td { font-weight: 800; border-bottom: 2px solid #000; }
        .lp-note { font-size: 11px; margin-top: 6px; font-style: italic; }
        .lp-foot { font-size: 11px; margin-top: 8px; text-align: right; }
      `}</style>
    </AppLayout>
  )
}
