import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../utils/supabaseClient'
import { useAuth } from '../../components/AuthProvider'
import AppLayout from '../../components/AppLayout'
import { logAudit } from '../../utils/audit'
import Icon from '../../components/Icons'
import { StatCard, SkeletonStat, SkeletonRows, EmptyBlock } from '../../components/DashboardWidgets'

const formatRupiah = (v) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v || 0)

const hariIni = () => new Date().toISOString().slice(0, 10)
const tglID = (v) => v ? new Date(v).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

export default function HutangPiutang() {
  const { user } = useAuth()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')

  const [tab, setTab] = useState('piutang')
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')

  const [form, setForm] = useState({
    jenis: 'piutang', nama_customer: '', jumlah: '', jatuh_tempo: '',
    keterangan: '', tanggal: hariIni(),
  })

  const [bayar, setBayar] = useState(null) // { row, jumlah, metode, tanggal }
  const [kolomKurang, setKolomKurang] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true); setError('')
    const { data, error } = await supabase
      .from('receivables_payables').select('*').order('tanggal', { ascending: false })
    if (error) {
      // Kolom `dibayar` belum ada -> beri instruksi jelas, jangan tampilkan error mentah
      if (/dibayar/.test(error.message) || error.code === '42703') {
        setKolomKurang(true)
        setError('')
      } else {
        setError(error.message)
      }
      setData([])
    } else {
      setKolomKurang(false)
      setData(data || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Auto-tandai lewat tempo
  useEffect(() => {
    const now = hariIni()
    const lewat = data.filter((d) => d.status === 'aktif' && d.jatuh_tempo && d.jatuh_tempo < now)
    lewat.forEach((d) => supabase.from('receivables_payables').update({ status: 'lewat_tempo' }).eq('id', d.id))
    if (lewat.length) setTimeout(fetchData, 600)
  }, [data])

  const sisa = (row) => Math.max(0, Number(row.jumlah || 0) - Number(row.dibayar || 0))

  const daftar = data.filter((d) => d.jenis === tab)
  const filtered = daftar.filter((d) => {
    const okS = !statusFilter || d.status === statusFilter
    const okQ = !search || (d.nama_customer || '').toLowerCase().includes(search.toLowerCase()) ||
      (d.keterangan || '').toLowerCase().includes(search.toLowerCase())
    return okS && okQ
  })

  const stat = useMemo(() => {
    const hitung = (jenis) => {
      const rows = data.filter((d) => d.jenis === jenis)
      const total = rows.reduce((s, r) => s + Number(r.jumlah || 0), 0)
      const lunas = rows.filter((r) => r.status === 'lunas')
      const aktif = rows.filter((r) => r.status !== 'lunas')
      return {
        total, n: rows.length,
        sudahLunas: lunas.reduce((s, r) => s + Number(r.jumlah || 0), 0),
        belum: aktif.reduce((s, r) => s + Number(r.jumlah || 0), 0),
        aktifN: aktif.length,
        lewatTempo: rows.filter((r) => r.status === 'lewat_tempo').length,
      }
    }
    return { piutang: hitung('piutang'), hutang: hitung('hutang') }
  }, [data])

  const simpan = async (e) => {
    e.preventDefault()
    if (!form.nama_customer.trim()) { setError('Nama wajib diisi'); return }
    const jumlah = Number(form.jumlah)
    if (!jumlah || jumlah <= 0) { setError('Jumlah harus lebih dari 0'); return }
    setSaving(true); setError('')
    try {
      const { error } = await supabase.from('receivables_payables').insert({
        jenis: form.jenis,
        nama_customer: form.nama_customer.trim(),
        jumlah,
        jatuh_tempo: form.jatuh_tempo || null,
        keterangan: form.keterangan || null,
        tanggal: form.tanggal || hariIni(),
        status: 'aktif',
      })
      if (error) throw error
      logAudit({ aksi: form.jenis === 'piutang' ? 'tambah_piutang' : 'tambah_hutang', user,
        sheetTarget: 'receivables_payables', detail: { nama: form.nama_customer, jumlah } })
      setMsg(` ${form.jenis === 'piutang' ? 'Piutang' : 'Hutang'} dicatat`)
      setForm({ ...form, nama_customer: '', jumlah: '', jatuh_tempo: '', keterangan: '' })
      fetchData()
    } catch (err) { setError(err.message) }
    finally { setSaving(false); setTimeout(() => setMsg(''), 3000) }
  }

  const simpanBayar = async () => {
    if (!bayar) return
    const nominal = Number(bayar.jumlah) || 0
    if (nominal <= 0) { setError('Jumlah bayar harus lebih dari 0'); return }
    setSaving(true); setError('')
    try {
      const row = bayar.row
      const sudah = Number(row.dibayar || 0)
      const total = Number(row.jumlah || 0)
      const baru = Math.min(total, sudah + nominal)
      const lunas = baru >= total

      const { error } = await supabase.from('receivables_payables').update({
        dibayar: baru,
        status: lunas ? 'lunas' : 'aktif',
        tgl_lunas: lunas ? (bayar.tanggal || hariIni()) : null,
        metode_bayar: bayar.metode || null,
      }).eq('id', row.id)
      if (error) throw error

      // Catat ke cashflow
      const masuk = row.jenis === 'piutang'
      await supabase.from('cashflow').insert({
        tanggal: bayar.tanggal || hariIni(),
        keterangan: `${masuk ? 'Terima piutang' : 'Bayar hutang'} — ${row.nama_customer || '-'}`,
        kategori: masuk ? 'Piutang' : 'Hutang',
        jenis: masuk ? 'masuk' : 'keluar',
        jumlah: nominal, saldo: 0,
      })

      logAudit({ aksi: 'bayar_' + row.jenis, user, sheetTarget: 'receivables_payables',
        detail: { nama: row.nama_customer, bayar: nominal, lunas } })

      setMsg(lunas ? ' Lunas!' : ` Pembayaran dicatat (sisa ${formatRupiah(total - baru)})`)
      setBayar(null)
      fetchData()
    } catch (err) { setError(err.message) }
    finally { setSaving(false); setTimeout(() => setMsg(''), 4000) }
  }

  const ubahStatus = async (row, status) => {
    await supabase.from('receivables_payables').update({
      status, tgl_lunas: status === 'lunas' ? hariIni() : null,
    }).eq('id', row.id)
    logAudit({ aksi: 'ubah_status_' + row.jenis, user, sheetTarget: 'receivables_payables', detail: { nama: row.nama_customer, status } })
    fetchData()
  }

  const hapus = async (row) => {
    if (!confirm(`Hapus catatan ${row.nama_customer}?`)) return
    await supabase.from('receivables_payables').delete().eq('id', row.id)
    fetchData()
  }

  const BADGE = { aktif: 'badge-info', lunas: 'badge-success', lewat_tempo: 'badge-danger' }
  const LABEL = { aktif: 'Aktif', lunas: 'Lunas', lewat_tempo: 'Lewat Tempo' }

  return (
    <AppLayout title="Hutang & Piutang" subtitle="Catat tagihan dan kewajiban">
      {msg && <div className="alert alert-success">{msg}</div>}
      {error && <div className="alert alert-danger"> {error}</div>}
      {kolomKurang && (
        <div className="alert alert-warning">
          <b> Perlu 1 langkah di Supabase</b><br />
          Halaman ini butuh kolom <code>dibayar</code> pada tabel <code>receivables_payables</code>.
          Buka <b>Supabase → SQL Editor → New query</b>, tempel isi
          <code> supabase/migrations/004_add_missing_columns.sql</code>, lalu klik <b>Run</b>.
          Setelah itu klik <b>Muat Ulang</b>.
          <button className="btn btn-sm btn-outline mt-2" onClick={fetchData}> Muat Ulang</button>
        </div>
      )}

      {loading ? (
        <div className="metrics-grid">
          <SkeletonStat /><SkeletonStat /><SkeletonStat /><SkeletonStat />
        </div>
      ) : (
        <div className="metrics-grid">
          <StatCard label="Piutang Belum Dibayar" value={formatRupiah(stat.piutang.belum)}
            icon="banknote" tone="warning" hint={`${stat.piutang.aktifN} tagihan aktif`} />
          <StatCard label="Hutang Belum Dibayar" value={formatRupiah(stat.hutang.belum)}
            icon="wallet" tone="danger" hint={`${stat.hutang.aktifN} kewajiban aktif`} />
          <StatCard label="Posisi Bersih" value={formatRupiah(stat.piutang.belum - stat.hutang.belum)}
            icon="handshake" tone={stat.piutang.belum - stat.hutang.belum >= 0 ? 'primary' : 'danger'}
            hint="piutang − hutang" />
          <StatCard label="Lewat Tempo" value={stat.piutang.lewatTempo + stat.hutang.lewatTempo}
            icon="alert" tone={stat.piutang.lewatTempo + stat.hutang.lewatTempo > 0 ? 'danger' : ''}
            hint="perlu tindakan" />
        </div>
      )}

      {/* Form */}
      <form onSubmit={simpan}>
        <div className="card">
          <div className="card-header"><div className="card-title"><Icon name="sliders" size={16} /> Catat Baru</div></div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Jenis</label>
              <div className="flex gap-2">
                <button type="button" className={`btn ${form.jenis === 'piutang' ? 'btn-primary' : 'btn-outline'}`} style={{ flex: 1 }}
                  onClick={() => setForm({ ...form, jenis: 'piutang' })}> Piutang (orang utang ke kita)</button>
                <button type="button" className={`btn ${form.jenis === 'hutang' ? 'btn-danger' : 'btn-outline'}`} style={{ flex: 1 }}
                  onClick={() => setForm({ ...form, jenis: 'hutang' })}> Hutang (kita utang)</button>
              </div>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Nama Pelanggan / Supplier *</label>
              <input className="form-control" value={form.nama_customer}
                onChange={(e) => setForm({ ...form, nama_customer: e.target.value })} placeholder="Nama" />
            </div>
            <div className="form-group">
              <label className="form-label">Jumlah (Rp) *</label>
              <input className="form-control" type="number" value={form.jumlah}
                onChange={(e) => setForm({ ...form, jumlah: e.target.value })} placeholder="0" />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Tanggal</label>
              <input className="form-control" type="date" value={form.tanggal}
                onChange={(e) => setForm({ ...form, tanggal: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Jatuh Tempo (opsional)</label>
              <input className="form-control" type="date" value={form.jatuh_tempo}
                onChange={(e) => setForm({ ...form, jatuh_tempo: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Keterangan</label>
              <input className="form-control" value={form.keterangan}
                onChange={(e) => setForm({ ...form, keterangan: e.target.value })} placeholder="mis. belanja tempo 7 hari" />
            </div>
          </div>

          <div className="flex justify-end">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <><span className="spinner" /> Menyimpan...</> : <><Icon name="plus" size={15} /> Catat</>}
            </button>
          </div>
        </div>
      </form>

      {/* Modal bayar */}
      {bayar && (
        <div className="card" style={{ border: '2px solid var(--primary)' }}>
          <div className="card-header">
            <div className="card-title"><Icon name="banknote" size={16} /> Bayar — {bayar.row.nama_customer}</div>
            <button className="btn btn-sm btn-outline" onClick={() => setBayar(null)}><Icon name="close" size={13} /></button>
          </div>
          <div className="text-sm text-muted mb-3">
            {bayar.row.jenis === 'piutang' ? 'Menerima pembayaran' : 'Membayar'}:{' '}
            <b>{formatRupiah(bayar.row.jumlah)}</b> · sisa {formatRupiah(bayar.row.jumlah - (bayar.row.dibayar || 0))}
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Jumlah Bayar</label>
              <input className="form-control" type="number" value={bayar.jumlah}
                onChange={(e) => setBayar({ ...bayar, jumlah: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Metode</label>
              <select className="form-control" value={bayar.metode} onChange={(e) => setBayar({ ...bayar, metode: e.target.value })}>
                <option value="cash">Tunai</option>
                <option value="transfer">Transfer</option>
                <option value="qris">QRIS</option>
                <option value="ewallet">E-Wallet</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Tanggal</label>
              <input className="form-control" type="date" value={bayar.tanggal}
                onChange={(e) => setBayar({ ...bayar, tanggal: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button className="btn btn-outline" onClick={() => setBayar({ ...bayar, jumlah: String(bayar.row.jumlah - (bayar.row.dibayar || 0)) })}>
              Lunasi Semua
            </button>
            <button className="btn btn-primary" onClick={simpanBayar} disabled={saving}>
              {saving ? 'Menyimpan...' : ' Simpan Pembayaran'}
            </button>
          </div>
        </div>
      )}

      {/* Tabs + daftar */}
      <div className="card" style={{ padding: 0 }}>
        <div className="card-header" style={{ padding: 16 }}>
          <div className="flex gap-2">
            <button className={`btn btn-sm ${tab === 'piutang' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('piutang')}>
               Piutang ({stat.piutang.n})
            </button>
            <button className={`btn btn-sm ${tab === 'hutang' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('hutang')}>
               Hutang ({stat.hutang.n})
            </button>
          </div>
        </div>

        <div style={{ padding: '0 16px 12px' }}>
          <div className="flex flex-wrap gap-2">
            <input className="form-control" style={{ maxWidth: 220 }} placeholder="Cari nama/keterangan..."
              value={search} onChange={(e) => setSearch(e.target.value)} />
            <select className="form-control" style={{ maxWidth: 150 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">Semua Status</option>
              <option value="aktif">Aktif</option>
              <option value="lewat_tempo">Lewat Tempo</option>
              <option value="lunas">Lunas</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 16 }}>
            <SkeletonRows rows={5} />
          </div>
        ) : filtered.length === 0 ? (
            <EmptyBlock icon={tab === 'piutang' ? 'banknote' : 'wallet'}
              title={`Belum ada ${tab}`}
              message={`Catat ${tab} pelanggan atau supplier Anda.`} />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Tanggal</th><th>Nama</th><th>Keterangan</th><th className="text-right">Jumlah</th><th className="text-right">Sisa</th><th>Jatuh Tempo</th><th>Status</th><th></th></tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const sisaRp = r.jumlah - (r.dibayar || 0)
                    return (
                      <tr key={r.id}>
                        <td className="text-muted text-sm">{tglID(r.tanggal)}</td>
                        <td className="font-bold">{r.nama_customer || '—'}</td>
                        <td className="text-sm text-muted">{r.keterangan || '—'}</td>
                        <td className="text-right font-bold">{formatRupiah(r.jumlah)}</td>
                        <td className="text-right">
                          {r.status === 'lunas'
                            ? <span className="text-success"> 0</span>
                            : <b className="text-danger">{formatRupiah(sisaRp)}</b>}
                        </td>
                        <td className="text-sm">{r.jatuh_tempo ? tglID(r.jatuh_tempo) : '—'}</td>
                        <td><span className={`badge ${BADGE[r.status] || 'badge-neutral'}`}>{LABEL[r.status] || r.status}</span></td>
                        <td className="text-right">
                          <div className="flex gap-1 justify-end">
                            {r.status !== 'lunas' && (
                              <button className="btn btn-sm btn-primary" title="Catat pembayaran"
                                onClick={() => setBayar({ row: r, jumlah: String(sisaRp), metode: 'cash', tanggal: hariIni() })}><Icon name="banknote" size={13} /></button>
                            )}
                            {r.status === 'lunas' && (
                              <button className="btn btn-sm btn-outline" onClick={() => ubahStatus(r, 'aktif')}>Buka</button>
                            )}
                            <button className="btn btn-sm btn-danger" onClick={() => hapus(r)}><Icon name="close" size={13} /></button>
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
    </AppLayout>
  )
}
