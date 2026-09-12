import { useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../utils/supabaseClient'
import { useAuth } from '../../components/AuthProvider'
import AppLayout from '../../components/AppLayout'

export default function TambahPelanggan() {
  const router = useRouter()
  const { user } = useAuth()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    nama: '',
    kontak: '',
    channel: 'offline',
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    try {
      const { error } = await supabase.from('customers').insert({
        nama: form.nama.trim(),
        kontak: form.kontak || null,
        channel: form.channel,
      })
      if (error) throw error
      router.push('/customers')
    } catch (err) {
      setError(err.message || 'Gagal menyimpan')
      setSaving(false)
    }
  }

  return (
    <AppLayout title="Tambah Pelanggan" subtitle="Daftarkan pelanggan baru">
      <form onSubmit={handleSubmit}>
        {error && <div className="alert alert-danger">⚠️ {error}</div>}

        <div className="card" style={{ maxWidth: 560 }}>
          <div className="card-header"><div className="card-title"><span className="nav-icon">👤</span> Data Pelanggan</div></div>

          <div className="form-group">
            <label className="form-label">Nama *</label>
            <input className="form-control" required value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} placeholder="Nama pelanggan" />
          </div>

          <div className="form-group">
            <label className="form-label">Kontak (HP/WA/Email)</label>
            <input className="form-control" value={form.kontak} onChange={(e) => setForm({ ...form, kontak: e.target.value })} placeholder="08xx / email" />
          </div>

          <div className="form-group">
            <label className="form-label">Channel</label>
            <select className="form-control" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>
              <option value="offline">Offline (datang ke toko)</option>
              <option value="online">Online (marketplace/medsos)</option>
              <option value="reseller">Reseller</option>
            </select>
          </div>

          <div className="flex gap-2 justify-end mt-3">
            <button type="button" className="btn btn-outline" onClick={() => router.push('/customers')}>Batal</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <><span className="spinner" /> Menyimpan...</> : '💾 Simpan'}
            </button>
          </div>
        </div>
      </form>
    </AppLayout>
  )
}
