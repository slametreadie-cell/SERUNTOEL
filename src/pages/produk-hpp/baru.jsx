import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../utils/supabaseClient'
import { useAuth } from '../../components/AuthProvider'
import AppLayout from '../../components/AppLayout'

const formatRupiah = (v) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v || 0)

const MODE_REKOM = {
  kompetitif: 0.25,
  standar: 0.40,
  premium: 0.60,
}

export default function ProdukBaru() {
  const router = useRouter()
  const { user } = useAuth()
  const { id } = router.query
  const isEdit = !!id

  const [kategoriList, setKategoriList] = useState([])
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Form state
  const [form, setForm] = useState({
    nama_produk: '',
    kategori: '',
    stok_produk: 0,
    target_batch: 1,
    hasil_per_batch: 1,
    mode_harga: 'otomatis',
    margin: 40,
    harga_manual: 0,
    pajak_persen: 0,
    foto_url: '',
  })

  // Rincian HPP
  const [bahanRows, setBahanRows] = useState([{ nama: '', qty: 0, harga: 0 }])
  const [kemasanRows, setKemasanRows] = useState([{ nama: '', qty: 0, harga: 0 }])
  const [opRows, setOpRows] = useState([{ nama: '', qty: 0, harga: 0 }])
  const [fotoFile, setFotoFile] = useState(null)
  const [fotoPreview, setFotoPreview] = useState('')
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    const loadKategori = async () => {
      const { data } = await supabase.from('product_categories').select('*').order('nama')
      setKategoriList(data || [])
    }
    loadKategori()
  }, [])

  // Load existing product if editing
  useEffect(() => {
    if (!id) return
    const load = async () => {
      const { data, error } = await supabase.from('products').select('*').eq('id', id).single()
      if (error) {
        setError(error.message)
      } else if (data) {
        setForm({
          nama_produk: data.nama_produk || '',
          kategori: data.kategori || '',
          stok_produk: data.stok_produk || 0,
          target_batch: 1,
          hasil_per_batch: data.jumlah_produksi || 1,
          mode_harga: 'otomatis',
          margin: Math.round((data.margin || 0)),
          harga_manual: data.harga_jual || 0,
          pajak_persen: 0,
          foto_url: data.foto_url || '',
        })
        if (data.rincian_json && data.rincian_json.bahan) setBahanRows(data.rincian_json.bahan)
        if (data.rincian_json && data.rincian_json.kemasan) setKemasanRows(data.rincian_json.kemasan)
        if (data.rincian_json && data.rincian_json.operasional) setOpRows(data.rincian_json.operasional)
        if (data.foto_url) setFotoPreview(data.foto_url)
      }
      setLoading(false)
    }
    load()
  }, [id])

  // ===== Kalkulasi HPP (sama seperti aplikasi lama) =====
  const sumRows = (rows) => rows.reduce((s, r) => s + (Number(r.qty) || 0) * (Number(r.harga) || 0), 0)

  const totalSebelumPajak = sumRows(bahanRows) + sumRows(kemasanRows) + sumRows(opRows)
  const pajakNominal = totalSebelumPajak * (Number(form.pajak_persen) || 0) / 100
  const totalDenganPajak = totalSebelumPajak + pajakNominal
  const hasilPerBatch = Math.max(1, Number(form.hasil_per_batch) || 1)
  const hppPerUnit = totalDenganPajak / hasilPerBatch

  let hargaJual, marginEfektif
  if (form.mode_harga === 'manual') {
    hargaJual = Number(form.harga_manual) || 0
    marginEfektif = hppPerUnit > 0 ? ((hargaJual - hppPerUnit) / hppPerUnit) * 100 : 0
  } else {
    const m = (Number(form.margin) || 40) / 100
    hargaJual = hppPerUnit * (1 + m)
    marginEfektif = m * 100
  }

  const rugi = hargaJual < hppPerUnit && hppPerUnit > 0

  const updateRow = (setter, rows, idx, field, value) => {
    const next = rows.map((r, i) => (i === idx ? { ...r, [field]: value } : r))
    setter(next)
  }
  const addRow = (setter, rows) => setter([...rows, { nama: '', qty: 0, harga: 0 }])
  const removeRow = (setter, rows, idx) => {
    if (rows.length <= 1) return
    setter(rows.filter((_, i) => i !== idx))
  }

  const handleFoto = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFotoFile(file)
    setFotoPreview(URL.createObjectURL(file))
  }

  const uploadFoto = async () => {
    if (!fotoFile) return form.foto_url
    setUploading(true)
    try {
      const ext = fotoFile.name.split('.').pop()
      const fileName = `${user.id}/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('product-photos').upload(fileName, fotoFile, {
        cacheControl: '3600',
        upsert: false,
      })
      if (error) throw error
      const { data } = supabase.storage.from('product-photos').getPublicUrl(fileName)
      return data.publicUrl
    } catch (e) {
      throw new Error('Gagal upload foto: ' + e.message)
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    try {
      // Upload foto dulu jika ada
      let fotoUrl = form.foto_url
      if (fotoFile) {
        fotoUrl = await uploadFoto()
      }

      const rincian = {
        bahan: bahanRows.filter((r) => r.nama),
        kemasan: kemasanRows.filter((r) => r.nama),
        operasional: opRows.filter((r) => r.nama),
        total_sebelum_pajak: totalSebelumPajak,
        pajak_persen: Number(form.pajak_persen) || 0,
        pajak_nominal: pajakNominal,
        total_hpp: totalDenganPajak,
      }

      const payload = {
        nama_produk: form.nama_produk,
        kategori: form.kategori || null,
        stok_produk: Number(form.stok_produk) || 0,
        jumlah_produksi: hasilPerBatch,
        total_hpp: totalDenganPajak,
        hpp_per_unit: hppPerUnit,
        harga_jual: hargaJual,
        margin: marginEfektif,
        rincian_json: rincian,
        foto_url: fotoUrl || null,
      }

      let res
      if (isEdit) {
        res = await supabase.from('products').update(payload).eq('id', id)
      } else {
        res = await supabase.from('products').insert(payload)
      }

      if (res.error) throw res.error

      router.push('/produk-hpp')
    } catch (err) {
      setError(err.message || 'Gagal menyimpan produk')
      setSaving(false)
    }
  }

  const RowEditor = ({ title, rows, setter, color }) => (
    <div>
      <div className="card-title mb-2" style={{ fontSize: 14 }}>
        <span style={{ color }}>●</span> {title}
      </div>
      {rows.map((r, i) => (
        <div className="form-row mb-2" key={i} style={{ gridTemplateColumns: '1fr 80px 130px 40px', gap: 8 }}>
          <input className="form-control" placeholder="Nama" value={r.nama} onChange={(e) => updateRow(setter, rows, i, 'nama', e.target.value)} />
          <input className="form-control" type="number" placeholder="Qty" value={r.qty} onChange={(e) => updateRow(setter, rows, i, 'qty', e.target.value)} />
          <input className="form-control" type="number" placeholder="Harga" value={r.harga} onChange={(e) => updateRow(setter, rows, i, 'harga', e.target.value)} />
          <button type="button" className="btn btn-sm btn-danger" onClick={() => removeRow(setter, rows, i)}>✕</button>
        </div>
      ))}
      <button type="button" className="btn btn-sm btn-outline" onClick={() => addRow(setter, rows)}>＋ Tambah Baris</button>
    </div>
  )

  if (loading) {
    return <AppLayout title="Produk"><div className="card"><p className="text-muted">Memuat...</p></div></AppLayout>
  }

  return (
    <AppLayout title={isEdit ? 'Edit Produk' : 'Produk Baru'} subtitle="Kalkulasi HPP otomatis">
      <form onSubmit={handleSubmit}>
        {error && <div className="alert alert-danger">⚠️ {error}</div>}

        <div className="grid-2">
          {/* ===== Kolom kiri: Info Produk ===== */}
          <div className="card">
            <div className="card-header"><div className="card-title"><span className="nav-icon">📦</span> Informasi Produk</div></div>

            <div className="form-group">
              <label className="form-label">Nama Produk *</label>
              <input className="form-control" required value={form.nama_produk} onChange={(e) => setForm({ ...form, nama_produk: e.target.value })} placeholder="Contoh: Abon Ikan Kemasan 100g" />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Kategori</label>
                <select className="form-control" value={form.kategori} onChange={(e) => setForm({ ...form, kategori: e.target.value })}>
                  <option value="">— Pilih Kategori —</option>
                  {kategoriList.map((k) => <option key={k.id} value={k.nama}>{k.nama}</option>)}
                  <option value="Lainnya">Lainnya</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Stok Awal</label>
                <input className="form-control" type="number" value={form.stok_produk} onChange={(e) => setForm({ ...form, stok_produk: e.target.value })} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Foto Produk</label>
              <div className="flex items-center gap-3">
                <div className="foto-box" onClick={() => document.getElementById('fotoInput').click()}>
                  {fotoPreview ? <img src={fotoPreview} alt="preview" /> : <span className="text-muted">📷<br /><small>Klik untuk upload</small></span>}
                </div>
                <input id="fotoInput" type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFoto} />
                <div className="text-sm text-muted">
                  <p>Format: JPG/PNG</p>
                  <p>Maks 5MB</p>
                  {fotoPreview && <button type="button" className="btn btn-sm btn-outline mt-2" onClick={() => { setFotoFile(null); setFotoPreview(''); setForm({ ...form, foto_url: '' }) }}>Hapus Foto</button>}
                </div>
              </div>
            </div>
          </div>

          {/* ===== Kolom kanan: Kalkulasi HPP ===== */}
          <div className="card">
            <div className="card-header"><div className="card-title"><span className="nav-icon">🧮</span> Kalkulasi HPP</div></div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Target Batch</label>
                <input className="form-control" type="number" value={form.target_batch} onChange={(e) => setForm({ ...form, target_batch: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Hasil per Batch (unit)</label>
                <input className="form-control" type="number" value={form.hasil_per_batch} onChange={(e) => setForm({ ...form, hasil_per_batch: e.target.value })} />
              </div>
            </div>

            <div className="mb-4">
              <RowEditor title="Bahan Baku" rows={bahanRows} setter={setBahanRows} color="#0D9488" />
            </div>
            <div className="mb-4">
              <RowEditor title="Kemasan" rows={kemasanRows} setter={setKemasanRows} color="#3B82F6" />
            </div>
            <div className="mb-4">
              <RowEditor title="Biaya Operasional" rows={opRows} setter={setOpRows} color="#F59E0B" />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Pajak (%)</label>
                <input className="form-control" type="number" value={form.pajak_persen} onChange={(e) => setForm({ ...form, pajak_persen: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Mode Harga</label>
                <select className="form-control" value={form.mode_harga} onChange={(e) => setForm({ ...form, mode_harga: e.target.value })}>
                  <option value="otomatis">Otomatis (margin)</option>
                  <option value="manual">Manual</option>
                  <option value="rekomendasi">Rekomendasi</option>
                </select>
              </div>
            </div>

            {form.mode_harga === 'otomatis' && (
              <div className="form-group">
                <label className="form-label">Margin (%)</label>
                <input className="form-control" type="number" value={form.margin} onChange={(e) => setForm({ ...form, margin: e.target.value })} />
              </div>
            )}
            {form.mode_harga === 'manual' && (
              <div className="form-group">
                <label className="form-label">Harga Jual Manual</label>
                <input className="form-control" type="number" value={form.harga_manual} onChange={(e) => setForm({ ...form, harga_manual: e.target.value })} />
              </div>
            )}
            {form.mode_harga === 'rekomendasi' && (
              <div className="flex gap-2 flex-wrap">
                {Object.entries(MODE_REKOM).map(([k, m]) => (
                  <button key={k} type="button" className="btn btn-sm btn-outline capitalize" onClick={() => setForm({ ...form, mode_harga: 'otomatis', margin: Math.round(m * 100) })}>
                    {k} (+{Math.round(m * 100)}%)
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ===== Ringkasan HPP (sticky) ===== */}
        <div className={`card ${rugi ? '' : ''}`} style={{ position: 'sticky', bottom: 16, border: rugi ? '2px solid var(--danger)' : '2px solid var(--primary)', zIndex: 10 }}>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex gap-4 flex-wrap">
              <div>
                <div className="text-xs text-muted">Total Biaya</div>
                <div className="font-bold" style={{ fontSize: 20 }}>{formatRupiah(totalDenganPajak)}</div>
              </div>
              <div>
                <div className="text-xs text-muted">HPP / Unit</div>
                <div className="font-bold" style={{ fontSize: 20 }}>{formatRupiah(hppPerUnit)}</div>
              </div>
              <div>
                <div className="text-xs text-muted">Harga Jual</div>
                <div className={`font-extrabold ${rugi ? 'text-danger' : 'text-primary'}`} style={{ fontSize: 24 }}>{formatRupiah(hargaJual)}</div>
              </div>
              <div>
                <div className="text-xs text-muted">Margin</div>
                <div className={`font-bold ${marginEfektif >= 40 ? 'text-success' : marginEfektif >= 20 ? 'text-primary' : 'text-danger'}`} style={{ fontSize: 20 }}>{Math.round(marginEfektif)}%</div>
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn btn-outline" onClick={() => router.push('/produk-hpp')}>Batal</button>
              <button type="submit" className="btn btn-primary" disabled={saving || uploading}>
                {saving || uploading ? <><span className="spinner" /> Menyimpan...</> : '💾 Simpan Produk'}
              </button>
            </div>
          </div>
          {rugi && <div className="alert alert-danger mt-3 mb-0" style={{ marginBottom: 0 }}>⚠️ Harga jual lebih rendah dari HPP — Anda akan RUGI {formatRupiah(hppPerUnit - hargaJual)} per unit!</div>}
        </div>
      </form>

      <style jsx>{`
        .foto-box {
          width: 120px; height: 120px;
          border: 2px dashed var(--border);
          border-radius: var(--radius-sm);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; overflow: hidden; text-align: center;
          transition: all .2s;
          background: var(--bg);
        }
        .foto-box:hover { border-color: var(--primary); }
        .foto-box img { width: 100%; height: 100%; object-fit: cover; }
      `}</style>
    </AppLayout>
  )
}
