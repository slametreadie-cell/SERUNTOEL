import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../utils/supabaseClient'
import { useAuth } from '../components/AuthProvider'
import AppLayout from '../components/AppLayout'
import { logAudit } from '../utils/audit'

const rp = (v) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v || 0)

const LEGAL_FIELDS = [
  { k: 'nama_usaha', l: 'Nama Usaha' },
  { k: 'bentuk_usaha', l: 'Bentuk Usaha (PT/CV/UMKM)' },
  { k: 'nib', l: 'NIB' },
  { k: 'npwp', l: 'NPWP' },
  { k: 'pirt', l: 'Nomor PIRT' },
  { k: 'halal', l: 'Sertifikat Halal' },
  { k: 'bpom', l: 'Nomor BPOM / MD' },
  { k: 'izin_lain', l: 'Izin Lainnya' },
]

const NOTIF_FIELDS = [
  { k: 'wa_aktif', l: 'Aktifkan Notifikasi WhatsApp', tipe: 'bool' },
  { k: 'fonnte_token', l: 'Token API Fonnte', tipe: 'pass', ket: 'Ambil di fonnte.com → Device → Token' },
  { k: 'wa_admin', l: 'Nomor WA Admin', tipe: 'text', ket: 'Format 08xxxxxxxxxx' },
  { k: 'notif_stok_minimum', l: 'Kirim Notif Stok Menipis', tipe: 'bool' },
  { k: 'notif_kadaluarsa', l: 'Kirim Notif Produk Kadaluarsa', tipe: 'bool' },
  { k: 'notif_target', l: 'Kirim Notif Target Tercapai', tipe: 'bool' },
]

const KIRIM_CONFIG = [
  { k: 'biaya_kirim', l: 'Biaya Kirim Default (Rp)' },
  { k: 'biaya_kirim_gratis_min', l: 'Gratis Ongkir Mulai (Rp)' },
  { k: 'radius_kirim_km', l: 'Radius Kirim (km)' },
]

export default function PengaturanLanjutan() {
  const { user } = useAuth()
  const [tab, setTab] = useState('legal')
  const [config, setConfig] = useState({})
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [tesStatus, setTesStatus] = useState('')

  const [userBaru, setUserBaru] = useState({ email: '', password: '', nama: '', role: 'kasir', lihat: false })
  const [editUser, setEditUser] = useState(null) // { id, email, nama, password, lihat }
  const [authUsers, setAuthUsers] = useState(null) // dari API admin
  const [prosesUser, setProsesUser] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [cfg, lg, nt, us] = await Promise.all([
        supabase.from('configuration').select('*'),
        supabase.from('legal_config').select('*'),
        supabase.from('notification_config').select('*'),
        supabase.from('users').select('*').order('created_at'),
      ])
      const map = {}
      ;(cfg.data || []).forEach((c) => { map[c.key] = c })
      ;(lg.data || []).forEach((c) => { map[`legal.${c.key}`] = c })
      ;(nt.data || []).forEach((c) => { map[`notif.${c.key}`] = c })
      setConfig(map)
      setUsers(us.data || [])
    } catch (e) { setError(e.message) }
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Ambil akun login (Supabase Auth) lewat API admin
  const muatAkunLogin = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return
      const r = await fetch('/api/admin/users?aksi=list', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const d = await r.json()
      if (!r.ok) { setAuthUsers({ error: d.error }); return }
      setAuthUsers(d.users || [])
    } catch (e) {
      setAuthUsers({ error: e.message })
    }
  }, [])

  useEffect(() => { muatAkunLogin() }, [muatAkunLogin])

  /** Panggil API admin dengan token sesi. */
  const apiAdmin = async (payload) => {
    const { data: { session } } = await supabase.auth.getSession()
    const r = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
      body: JSON.stringify(payload),
    })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(d.error || 'Gagal menghubungi server.')
    return d
  }

  const tambahAkunLogin = async (e) => {
    e.preventDefault()
    setError(''); setMsg('')
    if (!userBaru.email.trim() || !userBaru.password) { setError('Email dan password wajib diisi'); return }
    setProsesUser(true)
    try {
      await apiAdmin({
        aksi: 'create',
        email: userBaru.email, password: userBaru.password,
        nama: userBaru.nama, role: userBaru.role,
      })
      logAudit({ aksi: 'tambah_user', user, sheetTarget: 'users', detail: { email: userBaru.email, role: userBaru.role } })
      setMsg(`✅ Akun ${userBaru.email.trim().toLowerCase()} dibuat & bisa langsung login`)
      setUserBaru({ email: '', password: '', nama: '', role: 'kasir', lihat: false })
      await muatAkunLogin(); fetchData()
    } catch (err) { setError(err.message) }
    finally { setProsesUser(false); setTimeout(() => setMsg(''), 5000) }
  }

  const simpanEditUser = async () => {
    if (!editUser) return
    setError(''); setMsg(''); setProsesUser(true)
    try {
      await apiAdmin({
        aksi: 'update',
        id: editUser.id,
        email: editUser.email,
        password: editUser.password || undefined,
        nama: editUser.nama,
      })
      logAudit({ aksi: 'ubah_user', user, sheetTarget: 'users', detail: { email: editUser.email } })
      setMsg('✅ Akun diperbarui' + (editUser.password ? ' (password diganti)' : ''))
      setEditUser(null)
      await muatAkunLogin(); fetchData()
    } catch (err) { setError(err.message) }
    finally { setProsesUser(false); setTimeout(() => setMsg(''), 5000) }
  }

  const hapusAkunLogin = async (u) => {
    if (!confirm(`Hapus akun ${u.email}?\n\nAkun ini tidak akan bisa login lagi.`)) return
    setError(''); setMsg('')
    try {
      await apiAdmin({ aksi: 'delete', id: u.id, email: u.email })
      logAudit({ aksi: 'hapus_user', user, sheetTarget: 'users', detail: { email: u.email } })
      setMsg(`✅ Akun ${u.email} dihapus`)
      await muatAkunLogin(); fetchData()
    } catch (err) { setError(err.message) }
    setTimeout(() => setMsg(''), 4000)
  }

  const val = (key) => config[key]?.value ?? ''

  const simpanKey = async (tabel, key, value, keterangan) => {
    const full = `${tabel === 'configuration' ? '' : tabel === 'legal_config' ? 'legal.' : 'notif.'}${key}`
    const row = config[full]
    if (row) {
      await supabase.from(tabel).update({ value: String(value) }).eq('id', row.id)
    } else {
      await supabase.from(tabel).insert({ key, value: String(value), keterangan: keterangan || null })
    }
  }

  const simpanSemua = async (tabel, fields) => {
    setSaving(true); setError('')
    try {
      for (const f of fields) {
        const key = tabel === 'configuration' ? f.k : f.k
        await simpanKey(tabel, key, val(`${tabel === 'configuration' ? '' : tabel === 'legal_config' ? 'legal.' : 'notif.'}${key}`), f.ket)
      }
      logAudit({ aksi: `simpan_${tabel}`, user, sheetTarget: tabel, detail: { jumlah: fields.length } })
      setMsg('✅ Tersimpan')
      fetchData()
    } catch (e) { setError(e.message) }
    finally { setSaving(false); setTimeout(() => setMsg(''), 3000) }
  }

  const setLokal = (prefix, key, value) => {
    const full = `${prefix}${key}`
    setConfig((prev) => ({ ...prev, [full]: { ...(prev[full] || {}), key, value, id: prev[full]?.id } }))
  }

  const tesWA = async () => {
    const token = val('notif.fonnte_token')
    const nomor = val('notif.wa_admin').replace(/^0/, '62').replace(/\D/g, '')
    if (!token) { setTesStatus('❌ Token Fonnte belum diisi'); return }
    if (!nomor) { setTesStatus('❌ Nomor WA admin belum diisi'); return }
    setTesStatus('⏳ Mengirim...')
    try {
      const res = await fetch('https://api.fonnte.com/send', {
        method: 'POST',
        headers: { Authorization: token },
        body: new URLSearchParams({
          target: nomor,
          message: `✅ Tes notifikasi dari Seruntul\n\nKalau Anda menerima pesan ini, integrasi WhatsApp sudah berfungsi.\nWaktu: ${new Date().toLocaleString('id-ID')}`,
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (res.ok && (j.status === true || j.status === 'true')) setTesStatus('✅ Berhasil! Cek WhatsApp Anda.')
      else setTesStatus(`❌ Gagal: ${j.reason || j.detail || res.status}`)
    } catch (e) {
      setTesStatus(`❌ Error: ${e.message} (bisa jadi CORS — kirim pesan dari server tidak didukung browser)`)
    }
  }

  const tambahUser = async (e) => {
    e.preventDefault()
    if (!userBaru.email.trim()) { setError('Email wajib diisi'); return }
    setSaving(true); setError('')
    try {
      const { error } = await supabase.from('users').insert({
        email: userBaru.email.trim().toLowerCase(),
        nama: userBaru.nama || null,
        role: userBaru.role,
      })
      if (error) throw error
      logAudit({ aksi: 'tambah_user', user, sheetTarget: 'users', detail: { email: userBaru.email, role: userBaru.role } })
      setMsg('✅ User ditambahkan')
      setUserBaru({ email: '', nama: '', role: 'kasir' })
      fetchData()
    } catch (err) {
      setError(err.message.includes('duplicate') ? 'Email sudah terdaftar' : err.message)
    } finally { setSaving(false); setTimeout(() => setMsg(''), 3000) }
  }

  const ubahRole = async (u, role) => {
    // simpan role di tabel users (dibuat kalau barisnya belum ada)
    const ada = users.find((x) => x.email === u.email)
    if (ada) {
      await supabase.from('users').update({ role }).eq('id', ada.id)
    } else {
      await supabase.from('users').insert({ id: u.id, email: u.email, role })
    }
    logAudit({ aksi: 'ubah_role', user, sheetTarget: 'users', detail: { email: u.email, role } })
    setMsg(`✅ Role ${u.email} → ${role}`)
    fetchData()
    setTimeout(() => setMsg(''), 3000)
  }

  const ROLE_BADGE = { owner: 'badge-danger', admin: 'badge-warning', produksi: 'badge-info', kasir: 'badge-success', user: 'badge-neutral' }

  return (
    <AppLayout title="Pengaturan Lanjutan" subtitle="Legal, pengiriman, notifikasi, dan user">
      {msg && <div className="alert alert-success">{msg}</div>}
      {error && <div className="alert alert-danger">⚠️ {error}</div>}

      <div className="card" style={{ padding: 8 }}>
        <div className="flex flex-wrap gap-2">
          {[
            { k: 'legal', l: '📜 Legalitas Usaha' },
            { k: 'kirim', l: '🚚 Biaya Kirim' },
            { k: 'notif', l: '💬 Notifikasi WhatsApp' },
            { k: 'user', l: '👤 Manajemen User' },
            { k: 'sistem', l: '🛠️ Sistem & Sinkron' },
          ].map((t) => (
            <button key={t.k} className={`btn btn-sm ${tab === t.k ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab(t.k)}>{t.l}</button>
          ))}
        </div>
      </div>

      {/* ===== LEGAL ===== */}
      {tab === 'legal' && (
        <div className="card">
          <div className="card-header"><div className="card-title"><span className="nav-icon">📜</span> Legalitas Usaha</div></div>
          <p className="text-sm text-muted mb-3">Data ini dipakai untuk keperluan administrasi, label produk, dan pengajuan izin.</p>
          <div className="grid-2">
            {LEGAL_FIELDS.map((f) => (
              <div className="form-group" key={f.k}>
                <label className="form-label">{f.l}</label>
                <input className="form-control" value={val(`legal.${f.k}`)} placeholder="belum diisi"
                  onChange={(e) => setLokal('legal.', f.k, e.target.value)} />
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <button className="btn btn-primary" onClick={() => simpanSemua('legal_config', LEGAL_FIELDS)} disabled={saving}>
              {saving ? <><span className="spinner" /> Menyimpan...</> : '💾 Simpan'}
            </button>
          </div>
        </div>
      )}

      {/* ===== BIAYA KIRIM ===== */}
      {tab === 'kirim' && (
        <div className="card">
          <div className="card-header"><div className="card-title"><span className="nav-icon">🚚</span> Biaya Kirim / Ongkir</div></div>
          <div className="form-row">
            {KIRIM_CONFIG.map((f) => (
              <div className="form-group" key={f.k}>
                <label className="form-label">{f.l}</label>
                <input className="form-control" type="number" value={val(f.k)} placeholder="0"
                  onChange={(e) => setLokal('', f.k, e.target.value)} />
              </div>
            ))}
          </div>
          {val('biaya_kirim') !== '' && (
            <div className="alert alert-info">
              Contoh: pesan {rp(50000)}, ongkir {rp(val('biaya_kirim'))}.{' '}
              {Number(val('biaya_kirim_gratis_min')) > 0 && Number(val('biaya_kirim_gratis_min')) <= 50000
                ? 'Belanja Rp50.000 sudah GRATIS ONGKIR.'
                : `Gratis ongkir mulai ${rp(val('biaya_kirim_gratis_min'))}.`}
            </div>
          )}
          <div className="flex justify-end">
            <button className="btn btn-primary" onClick={() => simpanSemua('configuration', KIRIM_CONFIG)} disabled={saving}>
              {saving ? <><span className="spinner" /> Menyimpan...</> : '💾 Simpan'}
            </button>
          </div>
        </div>
      )}

      {/* ===== NOTIFIKASI WA ===== */}
      {tab === 'notif' && (
        <div className="card">
          <div className="card-header"><div className="card-title"><span className="nav-icon">💬</span> Notifikasi WhatsApp (Fonnte)</div></div>
          <p className="text-sm text-muted mb-3">
            Kirim notifikasi otomatis ke WhatsApp Anda: stok menipis, produk mendekati kedaluwarsa, atau target tercapai.
            Layanan pihak ketiga <b>Fonnte</b> dipakai untuk pengiriman.
          </p>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Status Notifikasi</label>
              <select className="form-control" value={val('notif.wa_aktif') || 'false'} onChange={(e) => setLokal('notif.', 'wa_aktif', e.target.value)}>
                <option value="true">Aktif</option>
                <option value="false">Nonaktif</option>
              </select>
            </div>
            <div className="form-group" style={{ flex: 2 }}>
              <label className="form-label">Token API Fonnte</label>
              <input className="form-control" type="password" value={val('notif.fonnte_token')} placeholder="token dari fonnte.com"
                onChange={(e) => setLokal('notif.', 'fonnte_token', e.target.value)} />
              <div className="text-xs text-muted mt-1">Login fonnte.com → Device → salin Token</div>
            </div>
            <div className="form-group">
              <label className="form-label">Nomor WA Admin</label>
              <input className="form-control" value={val('notif.wa_admin')} placeholder="08xxxxxxxxxx"
                onChange={(e) => setLokal('notif.', 'wa_admin', e.target.value)} />
            </div>
          </div>

          <div className="form-row">
            {NOTIF_FIELDS.filter((f) => f.k.startsWith('notif_')).map((f) => (
              <div className="form-group" key={f.k}>
                <label className="form-label">{f.l}</label>
                <select className="form-control" value={val(`notif.${f.k}`) || 'false'} onChange={(e) => setLokal('notif.', f.k, e.target.value)}>
                  <option value="true">Aktif</option>
                  <option value="false">Nonaktif</option>
                </select>
              </div>
            ))}
          </div>

          {tesStatus && <div className="alert alert-info">{tesStatus}</div>}

          <div className="flex flex-wrap gap-2 justify-end">
            <button className="btn btn-outline" onClick={tesWA}>🔔 Tes Kirim WA</button>
            <button className="btn btn-primary" onClick={() => simpanSemua('notification_config', NOTIF_FIELDS)} disabled={saving}>
              {saving ? <><span className="spinner" /> Menyimpan...</> : '💾 Simpan'}
            </button>
          </div>
        </div>
      )}

      {/* ===== USER ===== */}
      {tab === 'user' && (
        <>
          {/* Tambah akun login */}
          <form onSubmit={tambahAkunLogin}>
            <div className="card">
              <div className="card-header"><div className="card-title"><span className="nav-icon">👤</span> Tambah Akun Login</div></div>
              <p className="text-sm text-muted mb-3">
                Akun yang dibuat di sini <b>langsung bisa login</b> — tidak perlu buka Supabase lagi.
              </p>
              <div className="form-row">
                <div className="form-group" style={{ flex: 2 }}>
                  <label className="form-label">Email *</label>
                  <input className="form-control" type="email" value={userBaru.email}
                    onChange={(e) => setUserBaru({ ...userBaru, email: e.target.value })} placeholder="kasir@toko.com" />
                </div>
                <div className="form-group" style={{ flex: 2 }}>
                  <label className="form-label">Password *</label>
                  <div className="pw-wrap">
                    <input className="form-control" type={userBaru.lihat ? 'text' : 'password'} value={userBaru.password}
                      onChange={(e) => setUserBaru({ ...userBaru, password: e.target.value })} placeholder="min. 6 karakter" />
                    <button type="button" className="pw-toggle" tabIndex={-1}
                      onClick={() => setUserBaru({ ...userBaru, lihat: !userBaru.lihat })}>
                      {userBaru.lihat ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Nama</label>
                  <input className="form-control" value={userBaru.nama} onChange={(e) => setUserBaru({ ...userBaru, nama: e.target.value })} placeholder="Nama karyawan" />
                </div>
                <div className="form-group">
                  <label className="form-label">Role</label>
                  <select className="form-control" value={userBaru.role} onChange={(e) => setUserBaru({ ...userBaru, role: e.target.value })}>
                    <option value="owner">Owner — akses penuh</option>
                    <option value="admin">Admin</option>
                    <option value="kasir">Kasir</option>
                    <option value="produksi">Produksi</option>
                    <option value="user">User</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end">
                <button type="submit" className="btn btn-primary" disabled={prosesUser}>
                  {prosesUser ? <><span className="spinner" /> Membuat...</> : '＋ Buat Akun'}
                </button>
              </div>
            </div>
          </form>

          {/* Modal edit user */}
          {editUser && (
            <div className="card" style={{ border: '2px solid var(--primary)' }}>
              <div className="card-header">
                <div className="card-title"><span className="nav-icon">✏️</span> Ubah Akun — {editUser.email}</div>
                <button className="btn btn-sm btn-outline" onClick={() => setEditUser(null)}>✕</button>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="form-control" type="email" value={editUser.email}
                    onChange={(e) => setEditUser({ ...editUser, email: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Nama</label>
                  <input className="form-control" value={editUser.nama || ''}
                    onChange={(e) => setEditUser({ ...editUser, nama: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Password Baru (biarkan kosong kalau tidak diganti)</label>
                <div className="pw-wrap">
                  <input className="form-control" type={editUser.lihat ? 'text' : 'password'} value={editUser.password || ''}
                    onChange={(e) => setEditUser({ ...editUser, password: e.target.value })} placeholder="kosongkan jika tidak diubah" />
                  <button type="button" className="pw-toggle" tabIndex={-1}
                    onClick={() => setEditUser({ ...editUser, lihat: !editUser.lihat })}>
                    {editUser.lihat ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button className="btn btn-outline" onClick={() => setEditUser(null)}>Batal</button>
                <button className="btn btn-primary" onClick={simpanEditUser} disabled={prosesUser}>
                  {prosesUser ? <><span className="spinner" /> Menyimpan...</> : '💾 Simpan Perubahan'}
                </button>
              </div>
            </div>
          )}

          {/* Daftar akun login */}
          <div className="card" style={{ padding: 0 }}>
            <div className="card-header" style={{ padding: 16 }}>
              <div className="card-title"><span className="nav-icon">🔑</span> Akun Login</div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted">
                  {Array.isArray(authUsers) ? `${authUsers.length} akun` : '—'}
                </span>
                <button className="btn btn-sm btn-outline" onClick={muatAkunLogin}>🔄 Muat Ulang</button>
              </div>
            </div>

            {authUsers?.error ? (
              <div className="alert alert-warning" style={{ margin: 16 }}>
                ⚠️ {authUsers.error}
                <br />
                <span className="text-xs">
                  Pastikan <code>SUPABASE_SERVICE_ROLE_KEY</code> sudah diset di Vercel → Settings → Environment Variables.
                </span>
              </div>
            ) : !Array.isArray(authUsers) ? (
              <p className="text-muted text-center py-4">Memuat akun...</p>
            ) : authUsers.length === 0 ? (
              <div className="empty-state">
                <div className="nav-icon" style={{ fontSize: 40 }}>👤</div>
                <h3>Belum ada akun</h3>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Email</th><th>Nama</th><th>Role</th><th>Login Terakhir</th><th>Status</th><th></th></tr></thead>
                  <tbody>
                    {authUsers.map((u) => {
                      const info = users.find((x) => x.email === u.email)
                      const diriSendiri = u.email === user?.email
                      return (
                        <tr key={u.id}>
                          <td className="font-bold">
                            {u.email}
                            {diriSendiri && <span className="badge badge-info" style={{ marginLeft: 6 }}>Anda</span>}
                          </td>
                          <td>{u.nama || info?.nama || '—'}</td>
                          <td>
                            <select className="form-control" style={{ maxWidth: 120, padding: '4px 8px' }}
                              value={info?.role || 'user'} onChange={(e) => ubahRole({ email: u.email, id: u.id, role: info?.role }, e.target.value)}>
                              {['owner', 'admin', 'kasir', 'produksi', 'user'].map((r) => <option key={r} value={r}>{r}</option>)}
                            </select>
                          </td>
                          <td className="text-muted text-sm">
                            {u.login_terakhir ? new Date(u.login_terakhir).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'belum pernah'}
                          </td>
                          <td>
                            <span className={`badge ${u.terkonfirmasi ? 'badge-success' : 'badge-warning'}`}>
                              {u.terkonfirmasi ? 'Aktif' : 'Belum aktif'}
                            </span>
                          </td>
                          <td className="text-right">
                            <div className="flex gap-1 justify-end">
                              <button className="btn btn-sm btn-outline"
                                onClick={() => setEditUser({ id: u.id, email: u.email, nama: u.nama || info?.nama || '', password: '', lihat: false })}>
                                ✏️
                              </button>
                              {!diriSendiri && (
                                <button className="btn btn-sm btn-danger" onClick={() => hapusAkunLogin(u)}>✕</button>
                              )}
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
        </>
      )}

      {/* ===== SISTEM ===== */}
      {tab === 'sistem' && (
        <div className="card">
          <div className="card-header"><div className="card-title"><span className="nav-icon">🛠️</span> Sistem & Sinkronisasi</div></div>

          <div className="sys-row">
            <div>
              <div className="font-bold">☁️ Penyimpanan Cloud</div>
              <div className="text-sm text-muted">
                Semua data tersimpan otomatis di Supabase (cloud), bukan di laptop. Laptop mati atau ganti perangkat
                tidak menghilangkan data — cukup login dengan akun yang sama.
              </div>
            </div>
            <span className="badge badge-success">Aktif</span>
          </div>

          <div className="sys-row">
            <div>
              <div className="font-bold">🔐 Keamanan Data</div>
              <div className="text-sm text-muted">
                Akses database dikunci dengan Row Level Security: hanya pengguna yang sudah login yang bisa membaca & menulis.
              </div>
            </div>
            <span className="badge badge-success">Aktif</span>
          </div>

          <div className="sys-row">
            <div>
              <div className="font-bold">💾 Backup Manual</div>
              <div className="text-sm text-muted">
                Unduh salinan data penting (produk, transaksi, pelanggan) dalam format Excel untuk arsip pribadi.
              </div>
            </div>
            <button className="btn btn-sm btn-outline" onClick={() => exportBackup()}>⬇️ Unduh Backup</button>
          </div>

          <div className="sys-row">
            <div>
              <div className="font-bold">📱 Akses Mobile</div>
              <div className="text-sm text-muted">
                Buka <b>seruntoel.vercel.app</b> di HP, lalu pilih "Tambahkan ke Home Screen" agar seperti aplikasi.
              </div>
            </div>
            <span className="badge badge-info">Siap</span>
          </div>

          <div className="sys-row">
            <div>
              <div className="font-bold">🔄 Versi Aplikasi</div>
              <div className="text-sm text-muted">Seruntul Advanced · Next.js + Supabase</div>
            </div>
            <span className="badge badge-neutral">v1.0</span>
          </div>
        </div>
      )}

      <style jsx>{`
        .sys-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;
          padding: 12px 0; border-bottom: 1px solid var(--border); }
      `}</style>
    </AppLayout>
  )

  async function exportBackup() {
    const [p, t, c, i] = await Promise.all([
      supabase.from('products').select('*'),
      supabase.from('transactions').select('*'),
      supabase.from('customers').select('*'),
      supabase.from('ingredients').select('*'),
    ])
    const bagian = { Produk: p.data, Transaksi: t.data, Pelanggan: c.data, Bahan: i.data }
    const { exportCSV } = await import('../utils/export')
    let out = ''
    for (const [nama, rows] of Object.entries(bagian)) {
      if (!rows?.length) { out += `\n=== ${nama.toUpperCase()} ===\n(tidak ada data)\n`; continue }
      out += `\n=== ${nama.toUpperCase()} (${rows.length}) ===\n`
      const keys = Object.keys(rows[0])
      out += keys.join(';') + '\n'
      out += rows.map((r) => keys.map((k) => String(r[k] ?? '').replace(/[;\n]/g, ' ')).join(';')).join('\n') + '\n'
    }
    const blob = new Blob(['\uFEFF' + out], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `backup-seruntul_${new Date().toISOString().slice(0,10)}.csv`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1500)
  }
}
