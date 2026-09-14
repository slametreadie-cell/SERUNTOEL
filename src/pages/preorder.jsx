import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../utils/supabaseClient'
import { useAuth } from '../components/AuthProvider'
import AppLayout from '../components/AppLayout'
import { logAudit } from '../utils/audit'
import Icon from '../components/Icons'
import { StatCard, SkeletonStat, SkeletonRows, EmptyBlock } from '../components/DashboardWidgets'

const formatRupiah = (v) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v || 0)

const hariIni = () => new Date().toISOString().slice(0, 10)
const tglID = (v) => v ? new Date(v).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

const STATUS = {
  pending: { label: 'Pending', cls: 'badge-neutral' },
  dp: { label: 'DP', cls: 'badge-warning' },
  lunas: { label: 'Lunas', cls: 'badge-info' },
  selesai: { label: 'Selesai', cls: 'badge-success' },
  batal: { label: 'Batal', cls: 'badge-danger' },
}

export default function PreOrder() {
  const { user } = useAuth()
  const [data, setData] = useState([])
  const [produk, setProduk] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')

  const [form, setForm] = useState({
    nama_customer: '', kontak: '', produk: '', qty: '1', harga: '',
    dp: '0', tgl_target: '', tgl_order: hariIni(),
  })

  const fetchData = useCallback(async () => {
    setLoading(true); setError('')
    const [oRes, pRes] = await Promise.all([
      supabase.from('pre_orders').select('*').order('tgl_order', { ascending: false }),
      supabase.from('products').select('id, nama_produk, harga_jual').order('nama_produk'),
    ])
    if (oRes.error) setError(oRes.error.message)
    setData(oRes.data || [])
    setProduk(pRes.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const pilihProduk = (val) => {
    const p = produk.find((x) => x.nama_produk === val)
    setForm((f) => ({
      ...f, produk: val,
      harga: p ? String(p.harga_jual || '') : f.harga,
    }))
  }

  const totalForm = (Number(form.qty) || 0) * (Number(form.harga) || 0)
  const sisaForm = Math.max(0, totalForm - (Number(form.dp) || 0))

  const simpan = async (e) => {
    e.preventDefault()
    if (!form.nama_customer.trim()) { setError('Nama pelanggan wajib diisi'); return }
    if (!form.produk.trim()) { setError('Produk wajib diisi'); return }
    const qty = Number(form.qty) || 0
    const harga = Number(form.harga) || 0
    if (qty <= 0 || harga <= 0) { setError('Qty dan harga harus lebih dari 0'); return }
    const total = qty * harga
    const dp = Number(form.dp) || 0
    if (dp > total) { setError('DP tidak boleh melebihi total'); return }

    setSaving(true); setError('')
    try {
      const { error } = await supabase.from('pre_orders').insert({
        tgl_order: form.tgl_order || hariIni(),
        nama_customer: form.nama_customer.trim(),
        kontak: form.kontak || null,
        produk: form.produk.trim(),
        qty, harga, total, dp, sisa: total - dp,
        status: dp >= total && total > 0 ? 'lunas' : dp > 0 ? 'dp' : 'pending',
        tgl_target: form.tgl_target || null,
      })
      if (error) throw error
      logAudit({ aksi: 'tambah_preorder', user, sheetTarget: 'pre_orders',
        detail: { customer: form.nama_customer, produk: form.produk, qty, total } })
      setMsg(' Pre-order dicatat')
      setForm({ nama_customer: '', kontak: '', produk: '', qty: '1', harga: '', dp: '0', tgl_target: '', tgl_order: hariIni() })
      fetchData()
    } catch (err) { setError(err.message) }
    finally { setSaving(false); setTimeout(() => setMsg(''), 3000) }
  }

  const [bayar, setBayar] = useState(null)

  const simpanBayar = async () => {
    if (!bayar) return
    const nominal = Number(bayar.jumlah) || 0
    if (nominal <= 0) { setError('Jumlah harus lebih dari 0'); return }
    setSaving(true)
    try {
      const row = bayar.row
      const dpBaru = Math.min(row.total, (Number(row.dp) || 0) + nominal)
      const sisa = row.total - dpBaru
      const { error } = await supabase.from('pre_orders').update({
        dp: dpBaru, sisa,
        status: sisa <= 0 ? 'lunas' : 'dp',
      }).eq('id', row.id)
      if (error) throw error

      await supabase.from('cashflow').insert({
        tanggal: hariIni(),
        keterangan: `Pembayaran pre-order — ${row.nama_customer || '-'} (${row.produk})`,
        kategori: 'Penjualan', jenis: 'masuk', jumlah: nominal, saldo: 0,
      })
      logAudit({ aksi: 'bayar_preorder', user, sheetTarget: 'pre_orders', detail: { customer: row.nama_customer, nominal } })
      setMsg(sisa <= 0 ? ' Pre-order lunas!' : ` Pembayaran dicatat (sisa ${formatRupiah(sisa)})`)
      setBayar(null)
      fetchData()
    } catch (e) { setError(e.message) }
    finally { setSaving(false); setTimeout(() => setMsg(''), 4000) }
  }

  const ubahStatus = async (row, status) => {
    await supabase.from('pre_orders').update({ status }).eq('id', row.id)
    logAudit({ aksi: 'ubah_preorder', user, sheetTarget: 'pre_orders', detail: { customer: row.nama_customer, status } })
    fetchData()
  }

  const hapus = async (row) => {
    if (!confirm(`Hapus pre-order ${row.nama_customer}?`)) return
    await supabase.from('pre_orders').delete().eq('id', row.id)
    fetchData()
  }

  const filtered = data.filter((d) => {
    const okS = !statusFilter || d.status === statusFilter
    const okQ = !search || (d.nama_customer || '').toLowerCase().includes(search.toLowerCase()) ||
      (d.produk || '').toLowerCase().includes(search.toLowerCase())
    return okS && okQ
  })

  const stat = useMemo(() => {
    const aktif = data.filter((d) => ['pending', 'dp'].includes(d.status))
    return {
      total: data.length,
      aktif: aktif.length,
      belumLunas: aktif.reduce((s, d) => s + Number(d.sisa || 0), 0),
      omzet: data.filter((d) => d.status !== 'batal').reduce((s, d) => s + Number(d.total || 0), 0),
    }
  }, [data])

  return (
    <AppLayout title="Pre-Order" subtitle="Pesanan pelanggan sebelum produksi">
      {msg && <div className="alert alert-success">{msg}</div>}
      {error && <div className="alert alert-danger"> {error}</div>}

      <div className="metrics-grid">
        <StatCard label="Total Pre-Order" value={stat.total} icon="box" tone="primary" />
        <StatCard label="Masih Aktif" value={stat.aktif} icon="barChart" tone="warning" />
        <StatCard label="Belum Dibayar" value={formatRupiah(stat.belumLunas)} icon="barChart" tone="danger" />
        <StatCard label="Nilai Pesanan" value={formatRupiah(stat.omzet)} icon="wallet" tone="success" />
      </div>

      <form onSubmit={simpan}>
        <div className="card">
          <div className="card-header"><div className="card-title"><Icon name="calendar" size={16} /> Catat Pre-Order</div></div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Nama Pelanggan *</label>
              <input className="form-control" value={form.nama_customer} onChange={(e) => setForm({ ...form, nama_customer: e.target.value })} placeholder="Nama" />
            </div>
            <div className="form-group">
              <label className="form-label">Kontak</label>
              <input className="form-control" value={form.kontak} onChange={(e) => setForm({ ...form, kontak: e.target.value })} placeholder="No. HP / WA" />
            </div>
            <div className="form-group">
              <label className="form-label">Target Ambil</label>
              <input className="form-control" type="date" value={form.tgl_target} onChange={(e) => setForm({ ...form, tgl_target: e.target.value })} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group" style={{ flex: 2 }}>
              <label className="form-label">Produk *</label>
              <input className="form-control" list="daftar-produk" value={form.produk}
                onChange={(e) => pilihProduk(e.target.value)} placeholder="Ketik atau pilih produk" />
              <datalist id="daftar-produk">
                {produk.map((p) => <option key={p.id} value={p.nama_produk} />)}
              </datalist>
            </div>
            <div className="form-group">
              <label className="form-label">Qty *</label>
              <input className="form-control" type="number" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Harga Satuan *</label>
              <input className="form-control" type="number" value={form.harga} onChange={(e) => setForm({ ...form, harga: e.target.value })} placeholder="0" />
            </div>
            <div className="form-group">
              <label className="form-label">DP (Rp)</label>
              <input className="form-control" type="number" value={form.dp} onChange={(e) => setForm({ ...form, dp: e.target.value })} />
            </div>
          </div>

          {totalForm > 0 && (
            <div className="alert alert-info">
              Total <b>{formatRupiah(totalForm)}</b> · DP <b>{formatRupiah(Number(form.dp) || 0)}</b> · Sisa <b className="text-danger">{formatRupiah(sisaForm)}</b>
            </div>
          )}

          <div className="flex justify-end">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <><span className="spinner" /> Menyimpan...</> : '＋ Catat Pre-Order'}
            </button>
          </div>
        </div>
      </form>

      {bayar && (
        <div className="card" style={{ border: '2px solid var(--primary)' }}>
          <div className="card-header">
            <div className="card-title"><Icon name="banknote" size={16} /> Pembayaran — {bayar.row.nama_customer}</div>
            <button className="btn btn-sm btn-outline" onClick={() => setBayar(null)}><Icon name="close" size={13} /></button>
          </div>
          <div className="text-sm text-muted mb-3">Sisa tagihan: <b>{formatRupiah(bayar.row.sisa)}</b></div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Jumlah Bayar</label>
              <input className="form-control" type="number" value={bayar.jumlah} onChange={(e) => setBayar({ ...bayar, jumlah: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button className="btn btn-outline" onClick={() => setBayar({ ...bayar, jumlah: String(bayar.row.sisa) })}>Lunasi Semua</button>
            <button className="btn btn-primary" onClick={simpanBayar} disabled={saving}> Simpan</button>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
        <div className="card-header" style={{ padding: 16 }}>
          <div className="card-title"><Icon name="clipboard" size={16} /> Daftar Pre-Order</div>
          <div className="flex flex-wrap gap-2">
            <input className="form-control" style={{ maxWidth: 200 }} placeholder="Cari..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <select className="form-control" style={{ maxWidth: 140 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">Semua Status</option>
              {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
        </div>

        {loading ? <div className="p-3"><SkeletonRows rows={4} /></div>
          : filtered.length === 0 ? (
            <EmptyBlock icon="barChart" title="Belum ada pre-order" message="Catat pesanan pelanggan sebelum produksi." />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Order</th><th>Pelanggan</th><th>Produk</th><th className="text-right">Qty</th><th className="text-right">Total</th><th className="text-right">DP</th><th className="text-right">Sisa</th><th>Target</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {filtered.map((d) => (
                    <tr key={d.id}>
                      <td className="text-muted text-sm">{tglID(d.tgl_order)}</td>
                      <td>
                        <div className="font-bold">{d.nama_customer}</div>
                        {d.kontak && <div className="text-xs text-muted">{d.kontak}</div>}
                      </td>
                      <td>{d.produk}</td>
                      <td className="text-right">{d.qty}</td>
                      <td className="text-right font-bold">{formatRupiah(d.total)}</td>
                      <td className="text-right text-success">{formatRupiah(d.dp)}</td>
                      <td className="text-right text-danger font-bold">{formatRupiah(d.sisa)}</td>
                      <td className="text-sm">{tglID(d.tgl_target)}</td>
                      <td><span className={`badge ${STATUS[d.status]?.cls || 'badge-neutral'}`}>{STATUS[d.status]?.label || d.status}</span></td>
                      <td className="text-right">
                        <div className="flex gap-1 justify-end">
                          {Number(d.sisa) > 0 && d.status !== 'batal' && (
                            <button className="btn btn-sm btn-primary" onClick={() => setBayar({ row: d, jumlah: String(d.sisa) })}><Icon name="banknote" size={13} /></button>
                          )}
                          {d.status === 'lunas' && (
                            <button className="btn btn-sm btn-outline" onClick={() => ubahStatus(d, 'selesai')}> Selesai</button>
                          )}
                          {d.status !== 'batal' && d.status !== 'selesai' && (
                            <button className="btn btn-sm btn-outline" onClick={() => ubahStatus(d, 'batal')}>Batal</button>
                          )}
                          <button className="btn btn-sm btn-danger" onClick={() => hapus(d)}><Icon name="close" size={13} /></button>
                        </div>
                      </td>
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
