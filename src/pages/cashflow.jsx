import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../utils/supabaseClient'
import { useAuth } from '../components/AuthProvider'
import AppLayout from '../components/AppLayout'
import { logAudit } from '../utils/audit'
import Icon from '../components/Icons'
import { StatCard, SkeletonStat, SkeletonRows, EmptyBlock } from '../components/DashboardWidgets'

const formatRupiah = (v) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v || 0)

const formatTanggal = (v) => {
  if (!v) return '—'
  return new Date(v).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

const KATEGORI_MASUK = ['Penjualan', 'Modal', 'Hutang', 'Piutang', 'Lainnya']
const KATEGORI_KELUAR = ['Pembelian Bahan', 'Operasional', 'Gaji', 'Sewa', 'Utilitas', 'Marketing', 'Lainnya']

export default function Cashflow() {
  const { user } = useAuth()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterJenis, setFilterJenis] = useState('')
  const [filterBulan, setFilterBulan] = useState('')
  const [search, setSearch] = useState('')
  const [editRow, setEditRow] = useState(null)
  const [msg, setMsg] = useState('')

  const hapusCatatan = async (d) => {
    if (!confirm(`Hapus catatan "${d.keterangan}"?`)) return
    await supabase.from('cashflow').delete().eq('id', d.id)
    logAudit({ aksi: 'hapus_cashflow', user, sheetTarget: 'cashflow', detail: { keterangan: d.keterangan, jumlah: d.jumlah } })
    setMsg(' Catatan dihapus')
    fetchData()
    setTimeout(() => setMsg(''), 3000)
  }

  const simpanEditCatatan = async () => {
    if (!editRow) return
    const jumlah = Number(editRow.jumlah)
    if (!jumlah || jumlah <= 0) { alert('Jumlah harus lebih dari 0'); return }
    await supabase.from('cashflow').update({
      tanggal: editRow.tanggal, keterangan: editRow.keterangan,
      kategori: editRow.kategori, jenis: editRow.jenis, jumlah,
    }).eq('id', editRow.id)
    logAudit({ aksi: 'ubah_cashflow', user, sheetTarget: 'cashflow', detail: { keterangan: editRow.keterangan } })
    setMsg(' Catatan diperbarui')
    setEditRow(null)
    fetchData()
    setTimeout(() => setMsg(''), 3000)
  }

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')
    const { data, error } = await supabase
      .from('cashflow')
      .select('*')
      .order('tanggal', { ascending: false })
      .order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setData(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Ringkasan
  const totalMasuk = data.filter((d) => d.jenis === 'masuk').reduce((s, d) => s + Number(d.jumlah || 0), 0)
  const totalKeluar = data.filter((d) => d.jenis === 'keluar').reduce((s, d) => s + Number(d.jumlah || 0), 0)
  const saldo = totalMasuk - totalKeluar

  // Daftar bulan tersedia untuk filter
  const bulanList = useMemo(() => {
    const s = new Set(data.map((d) => (d.tanggal || '').slice(0, 7)))
    return [...s].sort().reverse()
  }, [data])

  const filtered = data.filter((d) => {
    const matchJenis = !filterJenis || d.jenis === filterJenis
    const matchBulan = !filterBulan || (d.tanggal || '').startsWith(filterBulan)
    const matchSearch = !search || (d.keterangan || '').toLowerCase().includes(search.toLowerCase()) || (d.kategori || '').toLowerCase().includes(search.toLowerCase())
    return matchJenis && matchBulan && matchSearch
  })

  return (
    <AppLayout title="Cashflow" subtitle="Arus kas masuk & keluar">
      {/* Ringkasan */}
      {loading ? (
        <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
          <SkeletonStat /><SkeletonStat /><SkeletonStat />
        </div>
      ) : (
        <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
          <StatCard label="Uang Masuk" value={formatRupiah(totalMasuk)} icon="trendingUp"
            tone="primary" hint="total pemasukan" />
          <StatCard label="Uang Keluar" value={formatRupiah(totalKeluar)} icon="trendingDown"
            tone="danger" hint="total pengeluaran" />
          <StatCard label="Saldo" value={formatRupiah(saldo)} icon="wallet"
            tone={saldo >= 0 ? 'primary' : 'danger'} hint="masuk − keluar" />
        </div>
      )}

      {/* Toolbar */}
      <div className="card" style={{ padding: 16 }}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2" style={{ flex: 1 }}>
            <input className="form-control" style={{ maxWidth: 220 }} placeholder="Cari..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <select className="form-control" style={{ maxWidth: 150 }} value={filterJenis} onChange={(e) => setFilterJenis(e.target.value)}>
              <option value="">Semua Jenis</option>
              <option value="masuk">Masuk</option>
              <option value="keluar">Keluar</option>
            </select>
            <select className="form-control" style={{ maxWidth: 160 }} value={filterBulan} onChange={(e) => setFilterBulan(e.target.value)}>
              <option value="">Semua Bulan</option>
              {bulanList.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <Link href="/cashflow/tambah" className="btn btn-primary"><Icon name="plus" size={15} /> Catat Transaksi</Link>
        </div>
      </div>

      {msg && <div className="alert alert-success">{msg}</div>}
      {error && <div className="alert alert-danger"> {error}</div>}

      {editRow && (
        <div className="card" style={{ border: '2px solid var(--primary)' }}>
          <div className="card-header">
            <div className="card-title"><Icon name="sliders" size={16} /> Ubah Catatan</div>
            <button className="btn btn-sm btn-outline" onClick={() => setEditRow(null)}><Icon name="close" size={13} /></button>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Tanggal</label>
              <input className="form-control" type="date" value={(editRow.tanggal || '').slice(0,10)} onChange={(e) => setEditRow({ ...editRow, tanggal: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Jenis</label>
              <select className="form-control" value={editRow.jenis} onChange={(e) => setEditRow({ ...editRow, jenis: e.target.value })}>
                <option value="masuk">Masuk</option>
                <option value="keluar">Keluar</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Jumlah (Rp)</label>
              <input className="form-control" type="number" value={editRow.jumlah} onChange={(e) => setEditRow({ ...editRow, jumlah: e.target.value })} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Kategori</label>
              <input className="form-control" value={editRow.kategori || ''} onChange={(e) => setEditRow({ ...editRow, kategori: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Keterangan</label>
              <input className="form-control" value={editRow.keterangan || ''} onChange={(e) => setEditRow({ ...editRow, keterangan: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button className="btn btn-outline" onClick={() => setEditRow(null)}>Batal</button>
            <button className="btn btn-primary" onClick={simpanEditCatatan}> Simpan</button>
          </div>
        </div>
      )}

      {/* Daftar transaksi */}
      <div className="card" style={{ padding: 0 }}>
        <div className="card-header" style={{ padding: 16 }}>
          <div className="card-title"><Icon name="book" size={16} /> Riwayat Transaksi</div>
          <span className="text-sm text-muted">{filtered.length} catatan</span>
        </div>

        {loading ? (
          <div style={{ padding: 16 }}>
            <SkeletonRows rows={5} />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyBlock icon="wallet" title="Belum ada transaksi"
            message="Catat pemasukan atau pengeluaran pertama Anda." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Tanggal</th><th>Keterangan</th><th>Kategori</th><th>Jenis</th><th>Jumlah</th><th></th></tr>
              </thead>
              <tbody>
                {filtered.map((d) => (
                  <tr key={d.id}>
                    <td>{formatTanggal(d.tanggal)}</td>
                    <td className="font-bold">{d.keterangan}</td>
                    <td><span className="badge badge-neutral">{d.kategori}</span></td>
                    <td>
                      <span className={`badge ${d.jenis === 'masuk' ? 'badge-success' : 'badge-danger'}`}>
                        {d.jenis === 'masuk' ? '↑ Masuk' : '↓ Keluar'}
                      </span>
                    </td>
                    <td className={`font-bold ${d.jenis === 'masuk' ? 'text-success' : 'text-danger'}`}>
                      {d.jenis === 'masuk' ? '+' : '−'}{formatRupiah(d.jumlah)}
                    </td>
                    <td className="text-right">
                      <div className="flex gap-1 justify-end">
                        <button className="btn btn-sm btn-outline"
                          onClick={() => setEditRow({ id: d.id, tanggal: d.tanggal, keterangan: d.keterangan, kategori: d.kategori, jenis: d.jenis, jumlah: d.jumlah })}><Icon name="sliders" size={13} /></button>
                        <button className="btn btn-sm btn-danger" onClick={() => hapusCatatan(d)}><Icon name="close" size={13} /></button>
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
