import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../utils/supabaseClient'
import { useAuth } from '../../components/AuthProvider'
import AppLayout from '../../components/AppLayout'
import Icon from '../../components/Icons'

const formatRupiah = (v) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v || 0)

export default function TambahBahan() {
  const router = useRouter()
  const { user } = useAuth()
  const [suppliers, setSuppliers] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    nama_bahan: '',
    satuan: 'kg',
    stok_awal: 0,
    stok_minimum: 5,
    harga: 0,
    supplier_id: '',
    keterangan: '',
  })

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('suppliers').select('id, nama').order('nama')
      setSuppliers(data || [])
    }
    load()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    try {
      const qty = Number(form.stok_awal) || 0
      const harga = Number(form.harga) || 0

      // 1. Cek apakah bahan sudah ada
      const { data: existing } = await supabase
        .from('ingredients')
        .select('id, stok_sisa, nama_bahan')
        .ilike('nama_bahan', form.nama_bahan.trim())

      let bahanId

      if (existing && existing.length > 0) {
        // Update stok bahan yang sudah ada
        bahanId = existing[0].id
        const stokBaru = (existing[0].stok_sisa || 0) + qty
        const { error: upErr } = await supabase
          .from('ingredients')
          .update({ stok_sisa: stokBaru, stok_minimum: Number(form.stok_minimum) || 5 })
          .eq('id', bahanId)
        if (upErr) throw upErr
      } else {
        // Buat bahan baru
        const { data: ins, error: insErr } = await supabase
          .from('ingredients')
          .insert({
            nama_bahan: form.nama_bahan.trim(),
            satuan: form.satuan,
            stok_sisa: qty,
            stok_minimum: Number(form.stok_minimum) || 5,
            stok_rutin: qty,
          })
          .select('id')
          .single()
        if (insErr) throw insErr
        bahanId = ins.id
      }

      // 2. Catat harga bahan (jika harga diisi)
      if (harga > 0) {
        const { error: priceErr } = await supabase.from('ingredient_prices').insert({
          bahan_id: bahanId,
          nama_bahan: form.nama_bahan.trim(),
          harga,
          satuan: form.satuan,
          supplier_id: form.supplier_id || null,
          keterangan: form.keterangan,
        })
        if (priceErr) throw priceErr
      }

      // 3. Catat pembelian (jika qty > 0)
      if (qty > 0) {
        const { error: beliErr } = await supabase.from('supplier_purchases').insert({
          bahan_id: bahanId,
          nama_bahan: form.nama_bahan.trim(),
          supplier_id: form.supplier_id || null,
          qty,
          harga,
          total: qty * harga,
          keterangan: form.keterangan,
        })
        if (beliErr) throw beliErr
      }

      router.push('/inventory')
    } catch (err) {
      setError(err.message || 'Gagal menyimpan')
      setSaving(false)
    }
  }

  return (
    <AppLayout title="Tambah Bahan" subtitle="Catat stok & pembelian bahan baku">
      <form onSubmit={handleSubmit}>
        {error && <div className="alert alert-danger"> {error}</div>}

        <div className="card">
          <div className="card-header"><div className="card-title"><Icon name="pot" size={16} /> Informasi Bahan</div></div>

          <div className="form-group">
            <label className="form-label">Nama Bahan *</label>
            <input className="form-control" required value={form.nama_bahan} onChange={(e) => setForm({ ...form, nama_bahan: e.target.value })} placeholder="Contoh: Tepung Tapioka, Daging Ayam, dll" />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Satuan</label>
              <select className="form-control" value={form.satuan} onChange={(e) => setForm({ ...form, satuan: e.target.value })}>
                <option value="kg">kg</option>
                <option value="gram">gram</option>
                <option value="liter">liter</option>
                <option value="ml">ml</option>
                <option value="pcs">pcs</option>
                <option value="pack">pack</option>
                <option value="ikat">ikat</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Stok Awal / Masuk</label>
              <input className="form-control" type="number" value={form.stok_awal} onChange={(e) => setForm({ ...form, stok_awal: e.target.value })} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Stok Minimum (peringatan)</label>
              <input className="form-control" type="number" value={form.stok_minimum} onChange={(e) => setForm({ ...form, stok_minimum: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Harga Beli / Satuan</label>
              <input className="form-control" type="number" value={form.harga} onChange={(e) => setForm({ ...form, harga: e.target.value })} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Supplier</label>
              <select className="form-control" value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}>
                <option value="">— Tanpa supplier —</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.nama}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Keterangan</label>
              <input className="form-control" value={form.keterangan} onChange={(e) => setForm({ ...form, keterangan: e.target.value })} placeholder="Opsional" />
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <button type="button" className="btn btn-outline" onClick={() => router.push('/inventory')}>Batal</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <><span className="spinner" /> Menyimpan...</> : ' Simpan Bahan'}
            </button>
          </div>
        </div>
      </form>
    </AppLayout>
  )
}
