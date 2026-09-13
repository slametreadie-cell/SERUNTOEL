import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../utils/supabaseClient'
import { useAuth } from '../components/AuthProvider'
import AppLayout from '../components/AppLayout'
import { logAudit } from '../utils/audit'
import Icon from '../components/Icons'

const formatRupiah = (v) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v || 0)

const hariIni = () => new Date().toISOString().slice(0, 10)
const tglID = (v) => v ? new Date(v).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

const STATUS_ABSEN = {
  hadir: { l: 'Hadir', cls: 'badge-success' },
  izin: { l: 'Izin', cls: 'badge-info' },
  sakit: { l: 'Sakit', cls: 'badge-warning' },
  alpa: { l: 'Alpa', cls: 'badge-danger' },
}

const JABATAN = ['Kasir', 'Produksi', 'Packing', 'Marketing', 'Gudang', 'Admin', 'Kurir', 'Lainnya']

export default function Karyawan() {
  const { user } = useAuth()
  const [tab, setTab] = useState('karyawan')
  const [karyawan, setKaryawan] = useState([])
  const [absen, setAbsen] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [search, setSearch] = useState('')

  const [form, setForm] = useState({ nama: '', kontak: '', jabatan: JABATAN[0], gaji: '', tgl_masuk: hariIni(), shift: '', catatan: '' })
  const [tanggalAbsen, setTanggalAbsen] = useState(hariIni())
  const [editId, setEditId] = useState(null)

  const fetchData = useCallback(async () => {
    setLoading(true); setError('')
    const [kRes, aRes] = await Promise.all([
      supabase.from('employees').select('*').order('nama'),
      supabase.from('attendance').select('*').gte('tanggal', new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10)).order('tanggal', { ascending: false }),
    ])
    if (kRes.error) setError(kRes.error.message)
    setKaryawan(kRes.data || [])
    setAbsen(aRes.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const simpanKaryawan = async (e) => {
    e.preventDefault()
    if (!form.nama.trim()) { setError('Nama wajib diisi'); return }
    setSaving(true); setError('')
    try {
      const payload = {
        nama: form.nama.trim(), kontak: form.kontak || null,
        jabatan: form.jabatan || null, gaji: Number(form.gaji) || 0,
        tgl_masuk: form.tgl_masuk || null, shift: form.shift || null,
        catatan: form.catatan || null, status: 'aktif',
      }
      if (editId) {
        const { error } = await supabase.from('employees').update(payload).eq('id', editId)
        if (error) throw error
      } else {
        const { error } = await supabase.from('employees').insert(payload)
        if (error) throw error
      }
      logAudit({ aksi: editId ? 'ubah_karyawan' : 'tambah_karyawan', user, sheetTarget: 'employees',
        detail: { nama: payload.nama, jabatan: payload.jabatan } })
      setMsg(editId ? ' Data karyawan diperbarui' : ' Karyawan ditambahkan')
      setForm({ nama: '', kontak: '', jabatan: JABATAN[0], gaji: '', tgl_masuk: hariIni(), shift: '', catatan: '' })
      setEditId(null)
      fetchData()
    } catch (err) { setError(err.message) }
    finally { setSaving(false); setTimeout(() => setMsg(''), 3000) }
  }

  const editKaryawan = (k) => {
    setEditId(k.id)
    setForm({
      nama: k.nama || '', kontak: k.kontak || '', jabatan: k.jabatan || JABATAN[0],
      gaji: String(k.gaji ?? ''), tgl_masuk: k.tgl_masuk ? k.tgl_masuk.slice(0, 10) : hariIni(),
      shift: k.shift || '', catatan: k.catatan || '',
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const hapusKaryawan = async (k) => {
    if (!confirm(`Hapus karyawan ${k.nama}? Absensinya juga terhapus.`)) return
    await supabase.from('employees').delete().eq('id', k.id)
    fetchData()
  }

  const tandaiAbsen = async (k, status) => {
    const tgl = tanggalAbsen
    const { data: ada } = await supabase.from('attendance').select('id')
      .eq('karyawan_id', k.id).eq('tanggal', tgl).limit(1).maybeSingle()
    if (ada) {
      await supabase.from('attendance').update({ status, nama: k.nama }).eq('id', ada.id)
    } else {
      await supabase.from('attendance').insert({
        tanggal: tgl, karyawan_id: k.id, nama: k.nama, status,
      })
    }
    logAudit({ aksi: 'absen', user, sheetTarget: 'attendance', detail: { nama: k.nama, tanggal: tgl, status } })
    fetchData()
  }

  const absenHari = (k) => absen.find((a) => a.karyawan_id === k.id && a.tanggal === tanggalAbsen)

  const filtered = karyawan.filter((k) =>
    !search || (k.nama || '').toLowerCase().includes(search.toLowerCase()) ||
    (k.jabatan || '').toLowerCase().includes(search.toLowerCase()))

  const stat = useMemo(() => {
    const aktif = karyawan.filter((k) => k.status !== 'nonaktif')
    return {
      total: karyawan.length,
      aktif: aktif.length,
      payroll: aktif.reduce((s, k) => s + Number(k.gaji || 0), 0),
      hadirHariIni: absen.filter((a) => a.tanggal === tanggalAbsen && a.status === 'hadir').length,
    }
  }, [karyawan, absen, tanggalAbsen])

  const rekapAbsen = useMemo(() => {
    const m = {}
    absen.forEach((a) => {
      if (!m[a.karyawan_id]) m[a.karyawan_id] = { hadir: 0, izin: 0, sakit: 0, alpa: 0 }
      m[a.karyawan_id][a.status] = (m[a.karyawan_id][a.status] || 0) + 1
    })
    return m
  }, [absen])

  return (
    <AppLayout title="Karyawan & Absensi" subtitle="Data tim dan kehadiran">
      {msg && <div className="alert alert-success">{msg}</div>}
      {error && <div className="alert alert-danger"> {error}</div>}

      <div className="metrics-grid">
        <div className="metric-card"><div className="metric-label">Total Karyawan</div><div className="metric-value text-primary">{stat.total}</div></div>
        <div className="metric-card"><div className="metric-label">Aktif</div><div className="metric-value text-success">{stat.aktif}</div></div>
        <div className="metric-card"><div className="metric-label">Payroll / Bulan</div><div className="metric-value">{formatRupiah(stat.payroll)}</div></div>
        <div className="metric-card"><div className="metric-label">Hadir {tglID(tanggalAbsen)}</div><div className="metric-value">{stat.hadirHariIni}</div></div>
      </div>

      <div className="card" style={{ padding: 8 }}>
        <div className="flex flex-wrap gap-2">
          {[{ k: 'karyawan', l: ' Data Karyawan' }, { k: 'absensi', l: ' Absensi Hari Ini' }, { k: 'rekap', l: ' Rekap 30 Hari' }].map((t) => (
            <button key={t.k} className={`btn btn-sm ${tab === t.k ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab(t.k)}>{t.l}</button>
          ))}
        </div>
      </div>

      {/* ===== KARYAWAN ===== */}
      {tab === 'karyawan' && (
        <>
          <form onSubmit={simpanKaryawan}>
            <div className="card">
              <div className="card-header">
                <div className="card-title"><Icon name="userCheck" size={16} /> {editId ? 'Ubah Karyawan' : 'Tambah Karyawan'}</div>
                {editId && <button type="button" className="btn btn-sm btn-outline" onClick={() => { setEditId(null); setForm({ nama: '', kontak: '', jabatan: JABATAN[0], gaji: '', tgl_masuk: hariIni(), shift: '', catatan: '' }) }}>Batal</button>}
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Nama *</label>
                  <input className="form-control" value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Kontak</label>
                  <input className="form-control" value={form.kontak} onChange={(e) => setForm({ ...form, kontak: e.target.value })} placeholder="No. HP" />
                </div>
                <div className="form-group">
                  <label className="form-label">Jabatan</label>
                  <select className="form-control" value={form.jabatan} onChange={(e) => setForm({ ...form, jabatan: e.target.value })}>
                    {JABATAN.map((j) => <option key={j} value={j}>{j}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Gaji / Bulan (Rp)</label>
                  <input className="form-control" type="number" value={form.gaji} onChange={(e) => setForm({ ...form, gaji: e.target.value })} placeholder="0" />
                </div>
                <div className="form-group">
                  <label className="form-label">Tanggal Masuk</label>
                  <input className="form-control" type="date" value={form.tgl_masuk} onChange={(e) => setForm({ ...form, tgl_masuk: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Shift</label>
                  <input className="form-control" value={form.shift} onChange={(e) => setForm({ ...form, shift: e.target.value })} placeholder="mis. Pagi / Sore" />
                </div>
              </div>
              <div className="flex justify-end">
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <><span className="spinner" /> Menyimpan...</> : editId ? ' Perbarui' : '＋ Tambah Karyawan'}
                </button>
              </div>
            </div>
          </form>

          <div className="card" style={{ padding: 0 }}>
            <div className="card-header" style={{ padding: 16 }}>
              <div className="card-title"><Icon name="clipboard" size={16} /> Daftar Karyawan</div>
              <input className="form-control" style={{ maxWidth: 220 }} placeholder="Cari..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            {loading ? <p className="text-muted text-center py-4">Memuat...</p>
              : filtered.length === 0 ? (
                <div className="empty-state">
                  <div className="nav-icon" style={{ fontSize: 40 }}></div>
                  <h3>Belum ada karyawan</h3>
                  <p className="text-sm">Tambahkan data tim Anda.</p>
                </div>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead><tr><th>Nama</th><th>Kontak</th><th>Jabatan</th><th>Shift</th><th>Masuk</th><th className="text-right">Gaji</th><th></th></tr></thead>
                    <tbody>
                      {filtered.map((k) => (
                        <tr key={k.id}>
                          <td className="font-bold">{k.nama}</td>
                          <td>{k.kontak || '—'}</td>
                          <td><span className="badge badge-neutral">{k.jabatan || '—'}</span></td>
                          <td className="text-sm">{k.shift || '—'}</td>
                          <td className="text-sm text-muted">{tglID(k.tgl_masuk)}</td>
                          <td className="text-right font-bold">{formatRupiah(k.gaji)}</td>
                          <td className="text-right">
                            <div className="flex gap-1 justify-end">
                              <button className="btn btn-sm btn-outline" onClick={() => editKaryawan(k)}><Icon name="sliders" size={13} /></button>
                              <button className="btn btn-sm btn-danger" onClick={() => hapusKaryawan(k)}><Icon name="close" size={13} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
          </div>
        </>
      )}

      {/* ===== ABSENSI ===== */}
      {tab === 'absensi' && (
        <div className="card">
          <div className="card-header">
            <div className="card-title"><Icon name="calendar" size={16} /> Absensi</div>
            <input className="form-control" type="date" style={{ maxWidth: 180 }} value={tanggalAbsen} onChange={(e) => setTanggalAbsen(e.target.value)} />
          </div>

          {karyawan.length === 0 ? (
            <p className="text-muted text-sm">Belum ada karyawan. Tambahkan dulu di tab Data Karyawan.</p>
          ) : (
            <div className="absen-list">
              {karyawan.map((k) => {
                const a = absenHari(k)
                return (
                  <div key={k.id} className="absen-row">
                    <div className="flex-1">
                      <div className="font-bold">{k.nama}</div>
                      <div className="text-xs text-muted">{k.jabatan || '—'}</div>
                    </div>
                    <div className="absen-btns">
                      {Object.entries(STATUS_ABSEN).map(([key, v]) => (
                        <button key={key} type="button"
                          className={`btn btn-sm ${a?.status === key ? 'btn-primary' : 'btn-outline'}`}
                          onClick={() => tandaiAbsen(k, key)}>{v.l}</button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ===== REKAP ===== */}
      {tab === 'rekap' && (
        <div className="card" style={{ padding: 0 }}>
          <div className="card-header" style={{ padding: 16 }}>
            <div className="card-title"><Icon name="barChart" size={16} /> Rekap Absensi (30 hari terakhir)</div>
          </div>
          {karyawan.length === 0 ? (
            <p className="text-muted text-sm" style={{ padding: 16 }}>Belum ada data.</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Nama</th><th>Jabatan</th><th className="text-right">Hadir</th><th className="text-right">Izin</th><th className="text-right">Sakit</th><th className="text-right">Alpa</th><th className="text-right">Total</th></tr></thead>
                <tbody>
                  {karyawan.map((k) => {
                    const r = rekapAbsen[k.id] || { hadir: 0, izin: 0, sakit: 0, alpa: 0 }
                    const total = r.hadir + r.izin + r.sakit + r.alpa
                    return (
                      <tr key={k.id}>
                        <td className="font-bold">{k.nama}</td>
                        <td className="text-sm text-muted">{k.jabatan || '—'}</td>
                        <td className="text-right text-success font-bold">{r.hadir}</td>
                        <td className="text-right">{r.izin}</td>
                        <td className="text-right text-warning">{r.sakit}</td>
                        <td className="text-right text-danger font-bold">{r.alpa}</td>
                        <td className="text-right">{total}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .absen-list { display: flex; flex-direction: column; gap: 8px; }
        .absen-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;
          padding: 10px 12px; border: 1px solid var(--border); border-radius: var(--radius-sm); }
        .absen-btns { display: flex; gap: 4px; flex-wrap: wrap; }
      `}</style>
    </AppLayout>
  )
}
