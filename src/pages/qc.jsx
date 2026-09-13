import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../utils/supabaseClient'
import { useAuth } from '../components/AuthProvider'
import AppLayout from '../components/AppLayout'
import { logAudit } from '../utils/audit'
import Icon from '../components/Icons'

const hariIni = () => new Date().toISOString().slice(0, 10)
const tglID = (v) => v ? new Date(v).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

const ITEM_DEFAULT = [
  'Kebersihan area & alat',
  'Bahan baku segar / tidak rusak',
  'Suhu penyimpanan sesuai',
  'Berat/ukuran produk konsisten',
  'Kemasan bersih & tersegel',
  'Label & tanggal produksi terpasang',
  'Rasa & tekstur sesuai standar',
  'Petugas pakai APD (masker/sarung tangan)',
]

const JENIS = ['Produksi Harian', 'Sanitasi', 'Bahan Baku', 'Kemasan', 'Pengiriman', 'Lainnya']

const RESULT_OPT = [
  { k: 'ok', l: '', cls: 'ok' },
  { k: 'no', l: '', cls: 'no' },
  { k: 'na', l: '–', cls: 'na' },
]

export default function QC() {
  const { user } = useAuth()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [detail, setDetail] = useState(null)
  const [editId, setEditId] = useState(null)

  const [form, setForm] = useState({ tanggal: hariIni(), jenis: JENIS[0], petugas: '' })
  const [items, setItems] = useState(ITEM_DEFAULT.map((label) => ({ label, hasil: 'ok', catatan: '' })))
  const [catatanAkhir, setCatatanAkhir] = useState('')
  const [itemBaru, setItemBaru] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true); setError('')
    const { data, error } = await supabase.from('qc_checklists').select('*').order('tanggal', { ascending: false })
    if (error) setError(error.message)
    else setData(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const setHasil = (idx, hasil) => setItems((prev) => prev.map((it, i) => i === idx ? { ...it, hasil } : it))
  const setCatatanItem = (idx, catatan) => setItems((prev) => prev.map((it, i) => i === idx ? { ...it, catatan } : it))
  const hapusItem = (idx) => setItems((prev) => prev.filter((_, i) => i !== idx))
  const tambahItem = () => {
    if (!itemBaru.trim()) return
    setItems((prev) => [...prev, { label: itemBaru.trim(), hasil: 'ok', catatan: '' }])
    setItemBaru('')
  }

  const ringkas = useMemo(() => {
    const ok = items.filter((i) => i.hasil === 'ok').length
    const no = items.filter((i) => i.hasil === 'no').length
    const na = items.filter((i) => i.hasil === 'na').length
    const dinilai = ok + no
    return { ok, no, na, total: items.length, persen: dinilai ? Math.round((ok / dinilai) * 100) : 0 }
  }, [items])

  const simpan = async () => {
    if (ringkas.total === 0) { setError('Tambahkan minimal 1 item pemeriksaan'); return }
    setSaving(true); setError('')
    try {
      const itemsObj = {}
      items.forEach((it, i) => { itemsObj[`item_${i + 1}`] = { label: it.label, hasil: it.hasil, catatan: it.catatan } })

      const payload = {
        tanggal: form.tanggal || hariIni(),
        petugas: form.petugas || user?.email || null,
        jenis: form.jenis,
        items_json: { items: itemsObj, ringkasan: ringkas },
        status: ringkas.no === 0 ? 'lulus' : 'perlu_perbaikan',
        catatan: catatanAkhir || null,
      }
      const { error } = editId
        ? await supabase.from('qc_checklists').update(payload).eq('id', editId)
        : await supabase.from('qc_checklists').insert(payload)
      if (error) throw error

      logAudit({ aksi: 'qc_checklist', user, sheetTarget: 'qc_checklists',
        detail: { jenis: form.jenis, ok: ringkas.ok, gagal: ringkas.no, persen: ringkas.persen } })

      setMsg(editId
        ? ' Pemeriksaan diperbarui'
        : ringkas.no === 0
          ? ` QC LULUS (${ringkas.persen}% sesuai)`
          : ` Tersimpan — ${ringkas.no} item perlu perbaikan`)
      setEditId(null)
      setItems(ITEM_DEFAULT.map((label) => ({ label, hasil: 'ok', catatan: '' })))
      setCatatanAkhir('')
      fetchData()
    } catch (e) { setError(e.message) }
    finally { setSaving(false); setTimeout(() => setMsg(''), 5000) }
  }

  const mulaiEdit = (row) => {
    const list = ambilItems(row)
    setEditId(row.id)
    setForm({ tanggal: (row.tanggal || '').slice(0, 10), jenis: row.jenis || JENIS[0], petugas: row.petugas || '' })
    setItems(list.length ? list.map((it) => ({ label: it.label, hasil: it.hasil || 'ok', catatan: it.catatan || '' })) : [])
    setCatatanAkhir(row.catatan || '')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const hapus = async (row) => {
    if (!confirm('Hapus catatan QC ini?')) return
    await supabase.from('qc_checklists').delete().eq('id', row.id)
    fetchData()
  }

  const ambilItems = (row) => {
    const raw = row.items_json || {}
    const list = raw.items ? Object.values(raw.items) : []
    return list.length ? list : Object.entries(raw)
      .filter(([k]) => k !== 'ringkasan')
      .map(([, v]) => (typeof v === 'object' ? v : { label: String(v), hasil: 'ok' }))
  }

  return (
    <AppLayout title="QC Checklist" subtitle="Kontrol kualitas produksi">
      {msg && <div className="alert alert-success">{msg}</div>}
      {error && <div className="alert alert-danger"> {error}</div>}

      {/* Form */}
      <div className="card">
        <div className="card-header"><div className="card-title"><Icon name="checkSquare" size={16} /> {editId ? 'Ubah Pemeriksaan' : 'Pemeriksaan Baru'}</div>
            {editId && <button className="btn btn-sm btn-outline" onClick={() => { setEditId(null); setItems(ITEM_DEFAULT.map((label) => ({ label, hasil: 'ok', catatan: '' }))); setCatatanAkhir('') }}>Batal Edit</button>}</div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Tanggal</label>
            <input className="form-control" type="date" value={form.tanggal} onChange={(e) => setForm({ ...form, tanggal: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Jenis Pemeriksaan</label>
            <select className="form-control" value={form.jenis} onChange={(e) => setForm({ ...form, jenis: e.target.value })}>
              {JENIS.map((j) => <option key={j} value={j}>{j}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Petugas</label>
            <input className="form-control" value={form.petugas} onChange={(e) => setForm({ ...form, petugas: e.target.value })} placeholder={user?.email || 'Nama petugas'} />
          </div>
        </div>

        {/* Skor */}
        <div className="score-bar">
          <div>
            <div className="text-xs text-muted">Skor Kepatuhan</div>
            <div className={`score-val ${ringkas.no === 0 ? 'text-success' : ringkas.persen >= 70 ? 'text-warning' : 'text-danger'}`}>
              {ringkas.persen}%
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <span className="badge badge-success"> {ringkas.ok} sesuai</span>
            <span className="badge badge-danger"> {ringkas.no} gagal</span>
            <span className="badge badge-neutral">– {ringkas.na} n/a</span>
          </div>
        </div>

        {/* Item list */}
        <div className="qc-list">
          {items.map((it, idx) => (
            <div key={idx} className={`qc-item ${it.hasil === 'no' ? 'qc-no' : ''}`}>
              <div className="qc-label">{it.label}</div>
              <div className="qc-btns">
                {RESULT_OPT.map((o) => (
                  <button key={o.k} type="button" className={`qc-btn ${o.cls} ${it.hasil === o.k ? 'sel' : ''}`}
                    onClick={() => setHasil(idx, o.k)}>{o.l}</button>
                ))}
              </div>
              <input className="form-control qc-note" placeholder="catatan" value={it.catatan}
                onChange={(e) => setCatatanItem(idx, e.target.value)} />
              <button type="button" className="btn btn-sm btn-danger" onClick={() => hapusItem(idx)}><Icon name="close" size={13} /></button>
            </div>
          ))}
        </div>

        <div className="flex gap-2 mt-2">
          <input className="form-control" placeholder="Tambah item pemeriksaan baru..." value={itemBaru}
            onChange={(e) => setItemBaru(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); tambahItem() } }} />
          <button type="button" className="btn btn-outline" onClick={tambahItem}>＋ Tambah</button>
        </div>

        <div className="form-group mt-3">
          <label className="form-label">Catatan Akhir</label>
          <input className="form-control" value={catatanAkhir} onChange={(e) => setCatatanAkhir(e.target.value)}
            placeholder="mis. perlu perbaikan kebersihan alat" />
        </div>

        <div className="flex justify-end">
          <button className="btn btn-primary" onClick={simpan} disabled={saving}>
            {saving ? <><span className="spinner" /> Menyimpan...</> : editId ? ' Perbarui' : ' Simpan Pemeriksaan'}
          </button>
        </div>
      </div>

      {/* Riwayat */}
      <div className="card" style={{ padding: 0 }}>
        <div className="card-header" style={{ padding: 16 }}>
          <div className="card-title"><Icon name="clipboard" size={16} /> Riwayat Pemeriksaan</div>
          <span className="text-sm text-muted">{data.length} catatan</span>
        </div>

        {loading ? <p className="text-muted text-center py-4">Memuat...</p>
          : data.length === 0 ? (
            <div className="empty-state">
              <div className="nav-icon" style={{ fontSize: 40 }}></div>
              <h3>Belum ada pemeriksaan QC</h3>
              <p className="text-sm">Lakukan pemeriksaan rutin untuk menjaga kualitas.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Tanggal</th><th>Jenis</th><th>Petugas</th><th>Hasil</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {data.map((row) => {
                    const rk = row.items_json?.ringkasan || {}
                    const no = rk.no || 0
                    return (
                      <tr key={row.id}>
                        <td className="text-muted text-sm">{tglID(row.tanggal)}</td>
                        <td className="font-bold">{row.jenis || '—'}</td>
                        <td className="text-sm">{row.petugas || '—'}</td>
                        <td>
                          <span className="badge badge-success">{rk.ok || 0} </span>{' '}
                          {no > 0 && <span className="badge badge-danger">{no} </span>}
                          <span className="badge badge-neutral ml-1">{rk.persen || 0}%</span>
                        </td>
                        <td>
                          <span className={`badge ${row.status === 'lulus' ? 'badge-success' : 'badge-warning'}`}>
                            {row.status === 'lulus' ? 'Lulus' : 'Perlu Perbaikan'}
                          </span>
                        </td>
                        <td className="text-right">
                          <div className="flex gap-1 justify-end">
                            <button className="btn btn-sm btn-outline" onClick={() => setDetail(detail?.id === row.id ? null : row)}>
                              {detail?.id === row.id ? 'Tutup' : 'Lihat'}
                            </button>
                            <button className="btn btn-sm btn-outline" onClick={() => mulaiEdit(row)}><Icon name="sliders" size={13} /></button>
                            <button className="btn btn-sm btn-danger" onClick={() => hapus(row)}><Icon name="close" size={13} /></button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

        {detail && (
          <div style={{ padding: 16, borderTop: '1px solid var(--border)' }}>
            <div className="font-bold mb-2">Detail: {detail.jenis} — {tglID(detail.tanggal)}</div>
            {ambilItems(detail).map((it, i) => (
              <div key={i} className="detail-row">
                <span className={`badge ${it.hasil === 'ok' ? 'badge-success' : it.hasil === 'no' ? 'badge-danger' : 'badge-neutral'}`}>
                  {it.hasil === 'ok' ? '' : it.hasil === 'no' ? '' : '–'}
                </span>
                <span className="flex-1">{it.label}</span>
                {it.catatan && <span className="text-xs text-muted">{it.catatan}</span>}
              </div>
            ))}
            {detail.catatan && <div className="text-sm text-muted mt-2">Catatan: {detail.catatan}</div>}
          </div>
        )}
      </div>

      <style jsx>{`
        .score-bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;
          border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 12px; background: var(--bg); margin-bottom: 12px; }
        .score-val { font-size: 26px; font-weight: 600; }
        .qc-list { display: flex; flex-direction: column; gap: 6px; }
        .qc-item { display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: center;
          padding: 8px 10px; border: 1px solid var(--border); border-radius: var(--radius-sm); }
        .qc-no { border-color: var(--danger); background: rgba(220,53,69,.05); }
        .qc-label { font-size: 13px; grid-column: 1 / -1; }
        @media (min-width: 760px) { .qc-item { grid-template-columns: 1fr auto 180px auto; } .qc-label { grid-column: auto; } }
        .qc-btns { display: flex; gap: 4px; }
        .qc-btn { width: 32px; height: 32px; border-radius: 8px; border: 1.5px solid var(--border);
          font-weight: 600; background: var(--card); transition: all .15s; }
        .qc-btn.sel.ok { border-color: var(--success, #16a34a); background: rgba(22,163,74,.12); color: var(--success, #16a34a); }
        .qc-btn.sel.no { border-color: var(--danger); background: rgba(220,53,69,.12); color: var(--danger); }
        .qc-btn.sel.na { border-color: var(--muted); background: var(--bg); }
        .qc-note { font-size: 12px; padding: 6px 8px; }
        .detail-row { display: flex; align-items: center; gap: 8px; padding: 5px 0; border-bottom: 1px dashed var(--border); font-size: 13px; }
      `}</style>
    </AppLayout>
  )
}
