import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../utils/supabaseClient'
import { useAuth } from '../components/AuthProvider'
import AppLayout from '../components/AppLayout'
import { logAudit } from '../utils/audit'
import Icon from '../components/Icons'

const formatRupiah = (v) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v || 0)

const hariIni = () => new Date().toISOString().slice(0, 10)

export default function Voucher() {
  const { user } = useAuth()
  const [data, setData] = useState([])
  const [usage, setUsage] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [search, setSearch] = useState('')

  const [form, setForm] = useState({
    kode: '', tipe: 'persen', nilai: '', kategori: '', deskripsi: '',
    tanggal_mulai: hariIni(), tanggal_berakhir: '', aktif: true,
  })

  const fetchData = useCallback(async () => {
    setLoading(true); setError('')
    const [vRes, uRes] = await Promise.all([
      supabase.from('vouchers').select('*').order('created_at', { ascending: false }),
      supabase.from('voucher_usages').select('*').order('tanggal_pakai', { ascending: false }).limit(200),
    ])
    if (vRes.error) setError(vRes.error.message)
    else setData(vRes.data || [])
    setUsage(uRes.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const statusVoucher = (v) => {
    if (!v.aktif) return { label: 'Nonaktif', cls: 'badge-neutral' }
    const t = hariIni()
    if (v.tanggal_mulai && t < v.tanggal_mulai) return { label: 'Belum mulai', cls: 'badge-info' }
    if (v.tanggal_berakhir && t > v.tanggal_berakhir) return { label: 'Kedaluwarsa', cls: 'badge-danger' }
    return { label: 'Aktif', cls: 'badge-success' }
  }

  const simpan = async (e) => {
    e.preventDefault()
    const kode = (form.kode || '').trim().toUpperCase()
    if (!kode) { setError('Kode voucher wajib diisi'); return }
    const nilai = Number(form.nilai) || 0
    if (nilai <= 0) { setError('Nilai diskon harus lebih dari 0'); return }
    if (form.tipe === 'persen' && nilai > 100) { setError('Diskon persen maksimal 100%'); return }

    setSaving(true); setError('')
    try {
      const { error } = await supabase.from('vouchers').insert({
        kode, tipe: form.tipe, nilai,
        kategori: form.kategori || null,
        deskripsi: form.deskripsi || null,
        tanggal_mulai: form.tanggal_mulai || null,
        tanggal_berakhir: form.tanggal_berakhir || null,
        aktif: form.aktif, total_dipakai: 0,
      })
      if (error) throw error
      logAudit({ aksi: 'tambah_voucher', user, sheetTarget: 'vouchers', detail: { kode, tipe: form.tipe, nilai } })
      setMsg(' Voucher dibuat')
      setForm({ kode: '', tipe: 'persen', nilai: '', kategori: '', deskripsi: '', tanggal_mulai: hariIni(), tanggal_berakhir: '', aktif: true })
      fetchData()
    } catch (err) {
      setError(err.message.includes('duplicate') ? 'Kode voucher sudah dipakai' : err.message)
    } finally {
      setSaving(false)
      setTimeout(() => setMsg(''), 3000)
    }
  }

  const toggleAktif = async (v) => {
    await supabase.from('vouchers').update({ aktif: !v.aktif }).eq('id', v.id)
    fetchData()
  }

  const hapus = async (v) => {
    if (!confirm(`Hapus voucher ${v.kode}?`)) return
    await supabase.from('vouchers').delete().eq('id', v.id)
    logAudit({ aksi: 'hapus_voucher', user, sheetTarget: 'vouchers', detail: { kode: v.kode } })
    fetchData()
  }

  const filtered = data.filter((v) =>
    !search || (v.kode || '').toLowerCase().includes(search.toLowerCase()) ||
    (v.kategori || '').toLowerCase().includes(search.toLowerCase())
  )

  const totalPemakaian = data.reduce((s, v) => s + (v.total_dipakai || 0), 0)
  const totalDiskon = usage.reduce((s, u) => s + Number(u.diskon || 0), 0)
  const aktifCount = data.filter((v) => statusVoucher(v).label === 'Aktif').length

  return (
    <AppLayout title="Voucher & Promo" subtitle="Kelola kode diskon untuk pelanggan">
      {msg && <div className="alert alert-success">{msg}</div>}
      {error && <div className="alert alert-danger"> {error}</div>}

      <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
        <div className="metric-card">
          <div className="metric-label">Voucher Aktif</div>
          <div className="metric-value text-primary">{aktifCount}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Total Pemakaian</div>
          <div className="metric-value">{totalPemakaian}×</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Total Diskon Diberikan</div>
          <div className="metric-value text-danger">{formatRupiah(totalDiskon)}</div>
        </div>
      </div>

      {/* Form buat voucher */}
      <form onSubmit={simpan}>
        <div className="card">
          <div className="card-header"><div className="card-title"><Icon name="ticket" size={16} /> Buat Voucher Baru</div></div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Kode Voucher *</label>
              <input className="form-control" value={form.kode} placeholder="mis. PROMO10"
                onChange={(e) => setForm({ ...form, kode: e.target.value.toUpperCase() })} />
            </div>
            <div className="form-group">
              <label className="form-label">Tipe Diskon</label>
              <select className="form-control" value={form.tipe} onChange={(e) => setForm({ ...form, tipe: e.target.value })}>
                <option value="persen">Persen (%)</option>
                <option value="nominal">Nominal (Rp)</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Nilai *</label>
              <input className="form-control" type="number" value={form.nilai} placeholder={form.tipe === 'persen' ? '10' : '5000'}
                onChange={(e) => setForm({ ...form, nilai: e.target.value })} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Kategori (opsional)</label>
              <input className="form-control" value={form.kategori} placeholder="mis. Makanan"
                onChange={(e) => setForm({ ...form, kategori: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Mulai</label>
              <input className="form-control" type="date" value={form.tanggal_mulai}
                onChange={(e) => setForm({ ...form, tanggal_mulai: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Berakhir (opsional)</label>
              <input className="form-control" type="date" value={form.tanggal_berakhir}
                onChange={(e) => setForm({ ...form, tanggal_berakhir: e.target.value })} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Keterangan</label>
            <input className="form-control" value={form.deskripsi} placeholder="mis. Promo akhir bulan"
              onChange={(e) => setForm({ ...form, deskripsi: e.target.value })} />
          </div>

          <div className="flex gap-2 justify-end">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <><span className="spinner" /> Menyimpan...</> : '＋ Buat Voucher'}
            </button>
          </div>
        </div>
      </form>

      {/* Daftar voucher */}
      <div className="card" style={{ padding: 0 }}>
        <div className="card-header" style={{ padding: 16 }}>
          <div className="card-title"><Icon name="clipboard" size={16} /> Daftar Voucher</div>
          <input className="form-control" style={{ maxWidth: 220 }} placeholder="Cari kode..."
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {loading ? (
          <p className="text-muted text-center py-4">Memuat...</p>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="nav-icon" style={{ fontSize: 40 }}></div>
            <h3>Belum ada voucher</h3>
            <p className="text-sm">Buat voucher untuk menarik pelanggan.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Kode</th><th>Diskon</th><th>Periode</th><th className="text-right">Dipakai</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {filtered.map((v) => {
                  const st = statusVoucher(v)
                  return (
                    <tr key={v.id}>
                      <td>
                        <div className="font-extrabold">{v.kode}</div>
                        {v.deskripsi && <div className="text-xs text-muted">{v.deskripsi}</div>}
                      </td>
                      <td className="font-bold text-danger">
                        {v.tipe === 'persen' ? `${v.nilai}%` : formatRupiah(v.nilai)}
                      </td>
                      <td className="text-sm text-muted">
                        {v.tanggal_mulai || '—'} <br />s/d {v.tanggal_berakhir || '∞'}
                      </td>
                      <td className="text-right font-bold">{v.total_dipakai || 0}×</td>
                      <td><span className={`badge ${st.cls}`}>{st.label}</span></td>
                      <td className="text-right">
                        <div className="flex gap-1 justify-end">
                          <button className="btn btn-sm btn-outline" onClick={() => toggleAktif(v)}>
                            {v.aktif ? 'Nonaktifkan' : 'Aktifkan'}
                          </button>
                          <button className="btn btn-sm btn-danger" onClick={() => hapus(v)}><Icon name="close" size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Riwayat pemakaian */}
      <div className="card" style={{ padding: 0 }}>
        <div className="card-header" style={{ padding: 16 }}>
          <div className="card-title"><Icon name="fileText" size={16} /> Riwayat Pemakaian</div>
          <span className="text-sm text-muted">{usage.length} catatan</span>
        </div>
        {usage.length === 0 ? (
          <p className="text-muted text-sm" style={{ padding: 16 }}>Belum ada voucher yang dipakai.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Tanggal</th><th>Kode</th><th>Pelanggan</th><th className="text-right">Diskon</th></tr></thead>
              <tbody>
                {usage.map((u) => (
                  <tr key={u.id}>
                    <td className="text-muted text-sm">{new Date(u.tanggal_pakai).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="font-bold">{u.kode_voucher}</td>
                    <td>{u.customer || '—'}</td>
                    <td className="text-right text-danger font-bold">−{formatRupiah(u.diskon)}</td>
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
