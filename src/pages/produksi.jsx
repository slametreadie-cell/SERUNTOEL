import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../utils/supabaseClient'
import { useAuth } from '../components/AuthProvider'
import AppLayout from '../components/AppLayout'

const formatRupiah = (v) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v || 0)

export default function Produksi() {
  const { user } = useAuth()
  const [produk, setProduk] = useState([])
  const [bahan, setBahan] = useState([])
  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')

  // Form resep
  const [produkId, setProdukId] = useState('')
  const [bahanId, setBahanId] = useState('')
  const [qty, setQty] = useState('')
  const [batchList, setBatchList] = useState([]) // bahan sementara untuk resep baru

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [pRes, bRes, rRes, prRes] = await Promise.all([
      supabase.from('products').select('id, nama_produk, hpp_per_unit, harga_jual, jumlah_produksi').order('nama_produk'),
      supabase.from('ingredients').select('*').order('nama_bahan'),
      supabase.from('recipes').select('*').order('created_at', { ascending: false }),
      supabase.from('ingredient_prices').select('bahan_id, harga, satuan, tanggal').order('tanggal', { ascending: false }),
    ])
    setProduk(pRes.data || [])
    setRecipes(rRes.data || [])

    // Harga terakhir per bahan (baris pertama = terbaru, karena sudah diurut desc)
    const hargaMap = {}
    ;(prRes.data || []).forEach((p) => {
      if (p.bahan_id && hargaMap[p.bahan_id] === undefined) hargaMap[p.bahan_id] = Number(p.harga) || 0
    })

    setBahan((bRes.data || []).map((b) => ({
      ...b,
      harga_terakhir: hargaMap[b.id] ?? 0,
    })))
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const bahanMap = useMemo(() => {
    const m = {}
    bahan.forEach((b) => { m[b.id] = b })
    return m
  }, [bahan])

  const tambahKeBatch = () => {
    if (!bahanId) { setError('Pilih bahan dulu'); return }
    const b = bahanMap[bahanId]
    if (!b) return
    setError('')
    setBatchList((prev) => [...prev, {
      bahan_id: b.id,
      nama_bahan: b.nama_bahan,
      satuan: b.satuan || 'pcs',
      qty: Number(qty) || 1,
      harga_satuan: Number(b.harga_terakhir) || 0,
    }])
    setBahanId(''); setQty('')
  }

  const hapusDariBatch = (idx) => setBatchList((prev) => prev.filter((_, i) => i !== idx))

  const totalBiayaBatch = batchList.reduce((s, b) => s + b.qty * b.harga_satuan, 0)

  const simpanResep = async () => {
    if (!produkId) { setError('Pilih produk dulu'); return }
    if (batchList.length === 0) { setError('Tambahkan minimal 1 bahan'); return }
    setSaving(true); setError('')
    try {
      const p = produk.find((x) => x.id === produkId)
      const payload = {
        produk_id: produkId,
        nama_produk: p?.nama_produk || '',
        bahan_baku_json: batchList,
      }

      // Upsert: 1 resep per produk
      const { data: existing } = await supabase
        .from('recipes').select('id').eq('produk_id', produkId).limit(1).maybeSingle()

      if (existing) {
        const { error } = await supabase.from('recipes').update(payload).eq('id', existing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('recipes').insert(payload)
        if (error) throw error
      }

      setMsg('✅ Resep disimpan')
      setProdukId(''); setBatchList([])
      fetchData()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
      setTimeout(() => setMsg(''), 3000)
    }
  }

  const editResep = (r) => {
    setProdukId(r.produk_id || '')
    setBatchList(Array.isArray(r.bahan_baku_json) ? r.bahan_baku_json : [])
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const hapusResep = async (id) => {
    if (!confirm('Hapus resep ini?')) return
    await supabase.from('recipes').delete().eq('id', id)
    fetchData()
  }

  return (
    <AppLayout title="Resep Produksi" subtitle="Komposisi bahan per produk">
      {msg && <div className="alert alert-success">{msg}</div>}
      {error && <div className="alert alert-danger">⚠️ {error}</div>}

      <div className="card">
        <div className="card-header"><div className="card-title"><span className="nav-icon">🍲</span> {batchList.length && produkId ? 'Ubah Resep' : 'Buat Resep Baru'}</div></div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Produk</label>
            <select className="form-control" value={produkId} onChange={(e) => setProdukId(e.target.value)}>
              <option value="">— Pilih produk —</option>
              {produk.map((p) => <option key={p.id} value={p.id}>{p.nama_produk}</option>)}
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group" style={{ flex: 2 }}>
            <label className="form-label">Bahan Baku</label>
            <select className="form-control" value={bahanId} onChange={(e) => setBahanId(e.target.value)}>
              <option value="">— Pilih bahan —</option>
              {bahan.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nama_bahan} ({b.satuan || 'pcs'}) — {formatRupiah(b.harga_terakhir)}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Qty</label>
            <input className="form-control" type="number" step="0.01" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0" />
          </div>
          <div className="form-group" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-outline" onClick={tambahKeBatch}>＋ Tambah</button>
          </div>
        </div>

        {batchList.length > 0 && (
          <div className="table-wrap mt-2">
            <table className="table">
              <thead><tr><th>Bahan</th><th className="text-right">Qty</th><th className="text-right">Harga</th><th className="text-right">Subtotal</th><th></th></tr></thead>
              <tbody>
                {batchList.map((b, idx) => (
                  <tr key={idx}>
                    <td className="font-bold">{b.nama_bahan}</td>
                    <td className="text-right">{b.qty} {b.satuan}</td>
                    <td className="text-right">{formatRupiah(b.harga_satuan)}</td>
                    <td className="text-right font-bold">{formatRupiah(b.qty * b.harga_satuan)}</td>
                    <td className="text-right"><button className="btn btn-sm btn-danger" onClick={() => hapusDariBatch(idx)}>✕</button></td>
                  </tr>
                ))}
                <tr style={{ background: 'var(--card-alt, rgba(0,0,0,0.03))' }}>
                  <td className="font-extrabold" colSpan={3}>TOTAL BIAYA BAHAN</td>
                  <td className="text-right font-extrabold text-primary">{formatRupiah(totalBiayaBatch)}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        <div className="flex gap-2 justify-end mt-3">
          {batchList.length > 0 && (
            <button type="button" className="btn btn-outline" onClick={() => { setBatchList([]); setProdukId('') }}>Bersihkan</button>
          )}
          <button type="button" className="btn btn-primary" onClick={simpanResep} disabled={saving || !batchList.length}>
            {saving ? <><span className="spinner" /> Menyimpan...</> : '💾 Simpan Resep'}
          </button>
        </div>
      </div>

      {/* Daftar resep */}
      <div className="card" style={{ padding: 0 }}>
        <div className="card-header" style={{ padding: 16 }}>
          <div className="card-title"><span className="nav-icon">📖</span> Daftar Resep</div>
          <span className="text-sm text-muted">{recipes.length} resep</span>
        </div>

        {loading ? (
          <p className="text-muted text-center py-4">Memuat...</p>
        ) : recipes.length === 0 ? (
          <div className="empty-state">
            <div className="nav-icon" style={{ fontSize: 40 }}>🍲</div>
            <h3>Belum ada resep</h3>
            <p className="text-sm">Buat resep untuk menghitung kebutuhan bahan tiap produk.</p>
          </div>
        ) : (
          <div style={{ padding: 16, display: 'grid', gap: 12 }}>
            {recipes.map((r) => {
              const items = Array.isArray(r.bahan_baku_json) ? r.bahan_baku_json : []
              const total = items.reduce((s, b) => s + Number(b.qty || 0) * Number(b.harga_satuan || 0), 0)
              return (
                <div key={r.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 14 }}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-extrabold">{r.nama_produk || '—'}</div>
                      <div className="text-xs text-muted">{items.length} bahan · biaya bahan {formatRupiah(total)}</div>
                    </div>
                    <div className="flex gap-2">
                      <button className="btn btn-sm btn-outline" onClick={() => editResep(r)}>✏️ Ubah</button>
                      <button className="btn btn-sm btn-danger" onClick={() => hapusResep(r.id)}>✕</button>
                    </div>
                  </div>
                  <div className="table-wrap mt-2">
                    <table className="table">
                      <thead><tr><th>Bahan</th><th className="text-right">Qty</th><th className="text-right">Subtotal</th></tr></thead>
                      <tbody>
                        {items.map((b, i) => (
                          <tr key={i}>
                            <td>{b.nama_bahan}</td>
                            <td className="text-right">{b.qty} {b.satuan}</td>
                            <td className="text-right">{formatRupiah(Number(b.qty || 0) * Number(b.harga_satuan || 0))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
