import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../utils/supabaseClient'
import { useAuth } from '../components/AuthProvider'
import AppLayout from '../components/AppLayout'
import { logAudit } from '../utils/audit'
import Icon from '../components/Icons'

const formatRupiah = (v) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v || 0)

const tglID = (v) => v ? new Date(v).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
const hariIni = () => new Date().toISOString().slice(0, 10)

export default function Reseller() {
  const { user } = useAuth()
  const [data, setData] = useState([])
  const [transaksi, setTransaksi] = useState([])
  const [diskonPersen, setDiskonPersen] = useState(10)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [search, setSearch] = useState('')

  const [form, setForm] = useState({ nama: '', kontak: '', alamat: '', tier: 'reguler', catatan: '', tgl_gabung: hariIni() })

  const fetchData = useCallback(async () => {
    setLoading(true); setError('')
    const [rRes, tRes, cRes] = await Promise.all([
      supabase.from('resellers').select('*').order('total_belanja', { ascending: false }),
      supabase.from('transactions').select('customer, total_bayar, tanggal').eq('channel', 'reseller').order('tanggal', { ascending: false }).limit(300),
      supabase.from('configuration').select('key, value').eq('key', 'diskon_reseller'),
    ])
    if (rRes.error) setError(rRes.error.message)
    setData(rRes.data || [])
    setTransaksi(tRes.data || [])
    const dp = Number(cRes.data?.[0]?.value)
    if (Number.isFinite(dp) && dp > 0) setDiskonPersen(dp)
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const simpanDiskon = async () => {
    setSaving(true)
    try {
      const { data: existing } = await supabase.from('configuration').select('id').eq('key', 'diskon_reseller').maybeSingle()
      if (existing) await supabase.from('configuration').update({ value: String(diskonPersen) }).eq('id', existing.id)
      else await supabase.from('configuration').insert({ key: 'diskon_reseller', value: String(diskonPersen), keterangan: 'Diskon harga untuk channel reseller (%)' })
      logAudit({ aksi: 'ubah_diskon_reseller', user, sheetTarget: 'configuration', detail: { diskon_reseller: diskonPersen } })
      setMsg(` Diskon reseller diset ${diskonPersen}%`)
    } catch (e) { setError(e.message) }
    finally { setSaving(false); setTimeout(() => setMsg(''), 3000) }
  }

  const simpan = async (e) => {
    e.preventDefault()
    if (!form.nama.trim()) { setError('Nama reseller wajib diisi'); return }
    setSaving(true); setError('')
    try {
      const { error } = await supabase.from('resellers').insert({
        nama: form.nama.trim(), kontak: form.kontak || null, alamat: form.alamat || null,
        tier: form.tier || 'reguler', catatan: form.catatan || null,
        tgl_gabung: form.tgl_gabung || hariIni(), total_transaksi: 0, total_belanja: 0,
      })
      if (error) throw error
      logAudit({ aksi: 'tambah_reseller', user, sheetTarget: 'resellers', detail: { nama: form.nama, tier: form.tier } })
      setMsg(' Reseller ditambahkan')
      setForm({ nama: '', kontak: '', alamat: '', tier: 'reguler', catatan: '', tgl_gabung: hariIni() })
      fetchData()
    } catch (err) { setError(err.message) }
    finally { setSaving(false); setTimeout(() => setMsg(''), 3000) }
  }

  const hapus = async (r) => {
    if (!confirm(`Hapus reseller ${r.nama}?`)) return
    await supabase.from('resellers').delete().eq('id', r.id)
    logAudit({ aksi: 'hapus_reseller', user, sheetTarget: 'resellers', detail: { nama: r.nama } })
    fetchData()
  }

  const filtered = data.filter((r) =>
    !search || (r.nama || '').toLowerCase().includes(search.toLowerCase()) ||
    (r.kontak || '').includes(search) || (r.tier || '').toLowerCase().includes(search.toLowerCase())
  )

  const stat = useMemo(() => {
    const omzetReseller = transaksi.reduce((s, t) => s + Number(t.total_bayar || 0), 0)
    return {
      total: data.length,
      omzet: omzetReseller,
      trx: transaksi.length,
      rata: transaksi.length ? omzetReseller / transaksi.length : 0,
    }
  }, [data, transaksi])

  return (
    <AppLayout title="Reseller" subtitle="Mitra penjual & harga khusus">
      {msg && <div className="alert alert-success">{msg}</div>}
      {error && <div className="alert alert-danger"> {error}</div>}

      <div className="metrics-grid">
        <div className="metric-card"><div className="metric-label">Total Reseller</div><div className="metric-value text-primary">{stat.total}</div></div>
        <div className="metric-card"><div className="metric-label">Omzet Reseller</div><div className="metric-value text-success">{formatRupiah(stat.omzet)}</div></div>
        <div className="metric-card"><div className="metric-label">Transaksi Reseller</div><div className="metric-value">{stat.trx}</div></div>
        <div className="metric-card"><div className="metric-label">Rata-rata / Transaksi</div><div className="metric-value">{formatRupiah(stat.rata)}</div></div>
      </div>

      {/* Pengaturan harga reseller */}
      <div className="card">
        <div className="card-header"><div className="card-title"><span className="nav-icon"></span> Harga Khusus Reseller</div></div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Diskon Otomatis (%)</label>
            <input className="form-control" type="number" value={diskonPersen} onChange={(e) => setDiskonPersen(e.target.value)} />
            <div className="text-xs text-muted mt-1">
              Diterapkan otomatis di POS saat channel <b>Reseller</b> dipilih. Contoh: harga {formatRupiah(100000)} →{' '}
              <b>{formatRupiah(100000 - Math.round(100000 * (Number(diskonPersen) || 0) / 100))}</b>
            </div>
          </div>
          <div className="form-group" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" onClick={simpanDiskon} disabled={saving}>
              {saving ? <><span className="spinner" /> Menyimpan...</> : ' Simpan Diskon'}
            </button>
          </div>
        </div>
      </div>

      {/* Form tambah */}
      <form onSubmit={simpan}>
        <div className="card">
          <div className="card-header"><div className="card-title"><Icon name="box" size={16} /> Tambah Reseller</div></div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Nama *</label>
              <input className="form-control" value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} placeholder="Nama toko / orang" />
            </div>
            <div className="form-group">
              <label className="form-label">Kontak</label>
              <input className="form-control" value={form.kontak} onChange={(e) => setForm({ ...form, kontak: e.target.value })} placeholder="No. HP / WA" />
            </div>
            <div className="form-group">
              <label className="form-label">Tier</label>
              <select className="form-control" value={form.tier} onChange={(e) => setForm({ ...form, tier: e.target.value })}>
                <option value="reguler">Reguler</option>
                <option value="grosir">Grosir</option>
                <option value="agen">Agen</option>
                <option value="distributor">Distributor</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Alamat</label>
              <input className="form-control" value={form.alamat} onChange={(e) => setForm({ ...form, alamat: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Tanggal Gabung</label>
              <input className="form-control" type="date" value={form.tgl_gabung} onChange={(e) => setForm({ ...form, tgl_gabung: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Catatan</label>
            <input className="form-control" value={form.catatan} onChange={(e) => setForm({ ...form, catatan: e.target.value })} placeholder="mis. ambil tiap minggu" />
          </div>
          <div className="flex justify-end">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <><span className="spinner" /> Menyimpan...</> : '＋ Tambah Reseller'}
            </button>
          </div>
        </div>
      </form>

      {/* Daftar */}
      <div className="card" style={{ padding: 0 }}>
        <div className="card-header" style={{ padding: 16 }}>
          <div className="card-title"><Icon name="handshake" size={16} /> Daftar Reseller</div>
          <input className="form-control" style={{ maxWidth: 220 }} placeholder="Cari..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {loading ? <p className="text-muted text-center py-4">Memuat...</p>
          : filtered.length === 0 ? (
            <div className="empty-state">
              <div className="nav-icon" style={{ fontSize: 40 }}></div>
              <h3>Belum ada reseller</h3>
              <p className="text-sm">Daftarkan mitra penjual untuk mendapat harga khusus.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Nama</th><th>Kontak</th><th>Tier</th><th>Gabung</th><th className="text-right">Trx</th><th className="text-right">Total Belanja</th><th></th></tr></thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <div className="font-bold">{r.nama}</div>
                        {r.catatan && <div className="text-xs text-muted">{r.catatan}</div>}
                      </td>
                      <td>{r.kontak || '—'}</td>
                      <td><span className="badge badge-info">{r.tier || 'reguler'}</span></td>
                      <td className="text-muted text-sm">{tglID(r.tgl_gabung)}</td>
                      <td className="text-right">{r.total_transaksi || 0}</td>
                      <td className="text-right font-bold text-primary">{formatRupiah(r.total_belanja)}</td>
                      <td className="text-right"><button className="btn btn-sm btn-danger" onClick={() => hapus(r)}><Icon name="close" size={13} /></button></td>
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
