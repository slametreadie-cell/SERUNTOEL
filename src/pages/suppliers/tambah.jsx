import { useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../utils/supabaseClient'
import { useAuth } from '../../components/AuthProvider'
import AppLayout from '../../components/AppLayout'

export default function TambahSupplier() {
  const router = useRouter()
  const { user } = useAuth()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    nama: '',
    bahan_utama: '',
    kontak: '',
    alamat: '',
    rating: 0,
    catatan: '',
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    try {
      const { error } = await supabase.from('suppliers').insert({
        nama: form.nama.trim(),
        bahan_utama: form.bahan_utama || null,
        kontak: form.kontak || null,
        alamat: form.alamat || null,
        rating: Number(form.rating) || 0,
        catatan: form.catatan || null,
      })
      if (error) throw error
      router.push('/suppliers')
    } catch (err) {
      setError(err.message || 'Gagal menyimpan')
      setSaving(false)
    }
  }

  return (
    <AppLayout title="Tambah Supplier" subtitle="Daftarkan pemasok baru">
      <form onSubmit={handleSubmit}>
        {error && <div className="alert alert-danger">⚠️ {error}</div>}

        <div className="card" style={{ maxWidth: 560 }}>
          <div className="card-header"><div className="card-title"><span className="nav-icon">🏭</span> Data Supplier</div></div>

          <div className="form-group">
            <label className="form-label">Nama Supplier *</label>
            <input className="form-control" required value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} placeholder="Nama pemasok" />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Bahan Utama</label>
              <input className="form-control" value={form.bahan_utama} onChange={(e) => setForm({ ...form, bahan_utama: e.target.value })} placeholder="Contoh: Tepung, Daging" />
            </div>
            <div className="form-group">
              <label className="form-label">Rating (0-5)</label>
              <input className="form-control" type="number" min="0" max="5" value={form.rating} onChange={(e) => setForm({ ...form, rating: e.target.value })} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Kontak</label>
            <input className="form-control" value={form.kontak} onChange={(e) => setForm({ ...form, kontak: e.target.value })} placeholder="08xx / email" />
          </div>

          <div className="form-group">
            <label className="form-label">Alamat</label>
            <input className="form-control" value={form.alamat} onChange={(e) => setForm({ ...form, alamat: e.target.value })} placeholder="Alamat pemasok" />
          </div>

          <div className="form-group">
            <label className="form-label">Catatan</label>
            <textarea className="form-control" rows="3" value={form.catatan} onChange={(e) => setForm({ ...form, catatan: e.target.value })} placeholder="Opsional" />
          </div>

          <div className="flex gap-2 justify-end mt-3">
            <button type="button" className="btn btn-outline" onClick={() => router.push('/suppliers')}>Batal</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <><span className="spinner" /> Menyimpan...</> : '💾 Simpan'}
            </button>
          </div>
        </div>
      </form>
    </AppLayout>
  )
}
