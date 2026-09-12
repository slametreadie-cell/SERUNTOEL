import { useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../utils/supabaseClient'
import { useAuth } from '../../components/AuthProvider'
import AppLayout from '../../components/AppLayout'

const KATEGORI_MASUK = ['Penjualan', 'Modal', 'Hutang', 'Piutang', 'Lainnya']
const KATEGORI_KELUAR = ['Pembelian Bahan', 'Operasional', 'Gaji', 'Sewa', 'Utilitas', 'Marketing', 'Lainnya']

export default function TambahCashflow() {
  const router = useRouter()
  const { user } = useAuth()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const today = new Date().toISOString().slice(0, 10)

  const [form, setForm] = useState({
    tanggal: today,
    jenis: 'masuk',
    kategori: 'Penjualan',
    jumlah: '',
    keterangan: '',
  })

  const kategoriList = form.jenis === 'masuk' ? KATEGORI_MASUK : KATEGORI_KELUAR

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    try {
      const jumlah = Number(form.jumlah)
      if (!jumlah || jumlah <= 0) {
        setError('Jumlah harus lebih dari 0')
        setSaving(false)
        return
      }

      const { error } = await supabase.from('cashflow').insert({
        tanggal: form.tanggal,
        jenis: form.jenis,
        kategori: form.kategori,
        jumlah,
        keterangan: form.keterangan || form.kategori,
      })

      if (error) throw error
      router.push('/cashflow')
    } catch (err) {
      setError(err.message || 'Gagal menyimpan')
      setSaving(false)
    }
  }

  return (
    <AppLayout title="Catat Transaksi" subtitle="Tambah pemasukan atau pengeluaran">
      <form onSubmit={handleSubmit}>
        {error && <div className="alert alert-danger">⚠️ {error}</div>}

        <div className="card" style={{ maxWidth: 560 }}>
          <div className="card-header"><div className="card-title"><span className="nav-icon">💸</span> Detail Transaksi</div></div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Jenis</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={`btn ${form.jenis === 'masuk' ? 'btn-primary' : 'btn-outline'}`}
                  style={{ flex: 1 }}
                  onClick={() => setForm({ ...form, jenis: 'masuk', kategori: 'Penjualan' })}
                >
                  ↑ Masuk
                </button>
                <button
                  type="button"
                  className={`btn ${form.jenis === 'keluar' ? 'btn-danger' : 'btn-outline'}`}
                  style={{ flex: 1 }}
                  onClick={() => setForm({ ...form, jenis: 'keluar', kategori: 'Pembelian Bahan' })}
                >
                  ↓ Keluar
                </button>
              </div>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Tanggal</label>
              <input className="form-control" type="date" value={form.tanggal} onChange={(e) => setForm({ ...form, tanggal: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Jumlah (Rp)</label>
              <input className="form-control" type="number" required value={form.jumlah} onChange={(e) => setForm({ ...form, jumlah: e.target.value })} placeholder="0" />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Kategori</label>
              <select className="form-control" value={form.kategori} onChange={(e) => setForm({ ...form, kategori: e.target.value })}>
                {kategoriList.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Keterangan</label>
              <input className="form-control" value={form.keterangan} onChange={(e) => setForm({ ...form, keterangan: e.target.value })} placeholder="Contoh: Jual abon 10 pcs" />
            </div>
          </div>

          <div className="flex gap-2 justify-end mt-3">
            <button type="button" className="btn btn-outline" onClick={() => router.push('/cashflow')}>Batal</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <><span className="spinner" /> Menyimpan...</> : '💾 Simpan'}
            </button>
          </div>
        </div>
      </form>
    </AppLayout>
  )
}
