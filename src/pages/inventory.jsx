import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../utils/supabaseClient'
import { useAuth } from '../components/AuthProvider'
import AppLayout from '../components/AppLayout'
import { logAudit } from '../utils/audit'
import Icon from '../components/Icons'
import { StatCard, SkeletonRows, EmptyBlock, StockBar } from '../components/DashboardWidgets'

const formatRupiah = (v) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v || 0)

export default function Inventory() {
  const { user } = useAuth()

  const simpanEditBahan = async () => {
    if (!editBahan) return
    if (!editBahan.nama_bahan?.trim()) { alert('Nama bahan tidak boleh kosong'); return }
    await supabase.from('ingredients').update({
      nama_bahan: editBahan.nama_bahan.trim(),
      satuan: editBahan.satuan || 'pcs',
      stok_minimum: Number(editBahan.stok_minimum) || 0,
      status: editBahan.status || 'aktif',
    }).eq('id', editBahan.id)
    logAudit({ aksi: 'ubah_bahan', user, sheetTarget: 'ingredients', detail: { nama: editBahan.nama_bahan } })
    setEditBahan(null)
    fetchData()
  }

  const [editBahan, setEditBahan] = useState(null)

  const hapusBahan = async (b) => {
    if (!confirm(`Hapus bahan "${b.nama_bahan}"?\n\nRiwayat harga & pembeliannya ikut terhapus.`)) return
    const { error } = await supabase.from('ingredients').delete().eq('id', b.id)
    if (error) { alert('Gagal menghapus: ' + error.message); return }
    logAudit({ aksi: 'hapus_bahan', user, sheetTarget: 'ingredients', detail: { nama: b.nama_bahan } })
    fetchData()
  }

  const hapusPembelian = async (row) => {
    if (!confirm('Hapus catatan pembelian ini?')) return
    await supabase.from('supplier_purchases').delete().eq('id', row.id)
    fetchData()
  }
  const [tab, setTab] = useState('bahan')
  const [bahan, setBahan] = useState([])
  const [produkJadi, setProdukJadi] = useState([])
  const [pembelian, setPembelian] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [bahanRes, produkRes, beliRes] = await Promise.all([
        supabase.from('ingredients').select('*').order('nama_bahan'),
        supabase.from('products').select('id, nama_produk, kategori, stok_produk, harga_jual').order('nama_produk'),
        supabase.from('supplier_purchases').select('*, suppliers(nama)').order('tanggal', { ascending: false }).limit(50),
      ])
      if (bahanRes.error) throw bahanRes.error
      if (produkRes.error) throw produkRes.error
      if (beliRes.error) throw beliRes.error
      setBahan(bahanRes.data || [])
      setProdukJadi(produkRes.data || [])
      setPembelian(beliRes.data || [])
    } catch (e) {
      setError(e.message || 'Gagal memuat data inventory')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const filterBySearch = (list, field) =>
    !search ? list : list.filter((x) => (x[field] || '').toLowerCase().includes(search.toLowerCase()))

  const bahanFiltered = filterBySearch(bahan, 'nama_bahan')
  const produkFiltered = filterBySearch(produkJadi, 'nama_produk')

  const bahanKritis = bahan.filter((b) => (b.stok_sisa || 0) <= (b.stok_minimum || 5)).length
  const produkKritis = produkJadi.filter((p) => (p.stok_produk || 0) <= 5).length

  return (
    <AppLayout title="Inventory" subtitle="Stok bahan baku, produk jadi, dan riwayat pembelian">
      {/* Metric */}
      <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
        <StatCard label="Bahan Baku" value={loading ? '...' : bahan.length} icon="pot"
          tone="primary" hint={`${bahanKritis} perlu restock`} />
        <StatCard label="Produk Jadi" value={loading ? '...' : produkJadi.length} icon="box"
          tone={produkKritis > 0 ? 'warning' : 'primary'} hint={`${produkKritis} stok menipis`} />
        <StatCard label="Total Pembelian" value={loading ? '...' : pembelian.length} icon="truck"
          hint="catatan pembelian" />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-3" style={{ overflowX: 'auto' }}>
        {[
          { key: 'bahan', label: 'Bahan Baku', icon: 'pot' },
          { key: 'produk', label: 'Produk Jadi', icon: 'box' },
          { key: 'pembelian', label: 'Pembelian', icon: 'truck' },
        ].map((t) => (
          <button key={t.key} className={`btn btn-sm ${tab === t.key ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setTab(t.key)} aria-pressed={tab === t.key}>
            <Icon name={t.icon} size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="card" style={{ padding: 16 }}>
        <div className="search-wrap">
          <Icon name="search" size={15} className="search-icon" />
          <input
            className="form-control"
            placeholder={`Cari ${tab === 'bahan' ? 'bahan baku' : tab === 'produk' ? 'produk jadi' : 'pembelian'}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Cari data inventory"
          />
        </div>
      </div>

      {error && (
        <div className="alert alert-danger" role="alert">
          <Icon name="alert" size={16} />
          {error}
        </div>
      )}

      {editBahan && (
        <div className="card" style={{ border: '2px solid var(--primary)' }}>
          <div className="card-header">
            <div className="card-title">
              <Icon name="sliders" size={16} /> Ubah Bahan — {editBahan.nama_bahan}
            </div>
            <button className="btn btn-sm btn-outline" onClick={() => setEditBahan(null)} aria-label="Tutup form">
              <Icon name="close" size={14} />
            </button>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Nama Bahan</label>
              <input className="form-control" value={editBahan.nama_bahan}
                onChange={(e) => setEditBahan({ ...editBahan, nama_bahan: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Satuan</label>
              <select className="form-control" value={editBahan.satuan}
                onChange={(e) => setEditBahan({ ...editBahan, satuan: e.target.value })}>
                {['kg','gram','liter','ml','pcs','pack','ikat','lusin','box'].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Stok Minimum</label>
              <input className="form-control" type="number" value={editBahan.stok_minimum}
                onChange={(e) => setEditBahan({ ...editBahan, stok_minimum: e.target.value })} />
            </div>
          </div>
          <p className="text-xs text-muted">
            Untuk mengubah <b>jumlah stok</b>, gunakan menu <b>Stok &amp; Opname</b> agar selisihnya tercatat.
          </p>
          <div className="flex gap-2 justify-end">
            <button className="btn btn-outline" onClick={() => setEditBahan(null)}>Batal</button>
            <button className="btn btn-primary" onClick={simpanEditBahan}>
              <Icon name="checkSquare" size={15} /> Simpan
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="card">
          <SkeletonRows rows={6} />
        </div>
      ) : (
        <>
          {/* ===== TAB: BAHAN BAKU ===== */}
          {tab === 'bahan' && (
            <div className="card" style={{ padding: 0 }}>
              <div className="card-header" style={{ padding: 16 }}>
                <div className="card-title">
                  <Icon name="pot" size={16} /> Daftar Bahan Baku
                </div>
                <Link href="/inventory/tambah-bahan" className="btn btn-primary btn-sm">
                  <Icon name="plus" size={14} /> Bahan
                </Link>
              </div>
              {bahanFiltered.length === 0 ? (
                <EmptyBlock
                  icon="pot"
                  title={search ? 'Bahan tidak ditemukan' : 'Belum ada bahan baku'}
                  message={search ? 'Coba kata kunci lain.' : 'Bahan baku otomatis tercatat saat Anda membuat resep/HPP produk.'}
                  action={
                    !search ? (
                      <Link href="/inventory/tambah-bahan" className="btn btn-primary mt-3">
                        Tambah Bahan
                      </Link>
                    ) : null
                  }
                />
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr><th>Bahan</th><th>Satuan</th><th>Stok Sisa</th><th>Min.</th><th>Status</th><th></th></tr>
                    </thead>
                    <tbody>
                      {bahanFiltered.map((b) => {
                        const kritis = (b.stok_sisa || 0) <= (b.stok_minimum || 5)
                        return (
                          <tr key={b.id}>
                            <td className="font-bold">{b.nama_bahan}</td>
                            <td>{b.satuan || 'pcs'}</td>
                            <td className={kritis ? 'text-danger font-bold' : 'font-bold'}>{b.stok_sisa}</td>
                            <td className="text-muted">{b.stok_minimum || 5}</td>
                            <td>
                              <span className={`badge ${kritis ? 'badge-danger' : 'badge-success'}`}>
                                {kritis ? 'Kritis' : 'Aman'}
                              </span>
                            </td>
                            <td className="text-right">
                              <div className="flex gap-1 justify-end">
                                <button className="btn btn-sm btn-outline"
                                  onClick={() => setEditBahan({ id: b.id, nama_bahan: b.nama_bahan, satuan: b.satuan || 'pcs', stok_minimum: b.stok_minimum || 0, status: b.status || 'aktif' })}
                                  aria-label={`Ubah ${b.nama_bahan}`}>
                                  <Icon name="sliders" size={13} />
                                </button>
                                <button className="btn btn-sm btn-danger" onClick={() => hapusBahan(b)}
                                  aria-label={`Hapus ${b.nama_bahan}`}>
                                  <Icon name="trash" size={13} />
                                </button>
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
          )}

          {/* ===== TAB: PRODUK JADI ===== */}
          {tab === 'produk' && (
            <div className="card" style={{ padding: 0 }}>
              <div className="card-header" style={{ padding: 16 }}>
                <div className="card-title">
                  <Icon name="box" size={16} /> Stok Produk Jadi
                </div>
              </div>
              {produkFiltered.length === 0 ? (
                <EmptyBlock
                  icon="box"
                  title={search ? 'Produk tidak ditemukan' : 'Belum ada produk'}
                  message={search ? 'Coba kata kunci lain.' : 'Tambahkan produk di menu Produk & HPP.'}
                />
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr><th>Produk</th><th>Kategori</th><th>Harga</th><th>Stok</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                      {produkFiltered.map((p) => {
                        const kritis = (p.stok_produk || 0) <= 5
                        return (
                          <tr key={p.id}>
                            <td className="font-bold">{p.nama_produk}</td>
                            <td>{p.kategori || '—'}</td>
                            <td>{formatRupiah(p.harga_jual)}</td>
                            <td className={kritis ? 'text-danger font-bold' : 'font-bold'}>{p.stok_produk}</td>
                            <td>
                              <span className={`badge ${kritis ? 'badge-danger' : 'badge-success'}`}>
                                {kritis ? 'Menipis' : 'Aman'}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ===== TAB: PEMBELIAN ===== */}
          {tab === 'pembelian' && (
            <div className="card" style={{ padding: 0 }}>
              <div className="card-header" style={{ padding: 16 }}>
                <div className="card-title">
                  <Icon name="truck" size={16} /> Riwayat Pembelian
                </div>
                <Link href="/inventory/tambah-bahan" className="btn btn-primary btn-sm">
                  <Icon name="plus" size={14} /> Pembelian
                </Link>
              </div>
              {pembelian.length === 0 ? (
                <EmptyBlock
                  icon="truck"
                  title="Belum ada pembelian"
                  message="Catat pembelian bahan dari supplier agar harga & stok ikut terbarui."
                  action={
                    <Link href="/inventory/tambah-bahan" className="btn btn-primary mt-3">
                      Catat Pembelian
                    </Link>
                  }
                />
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr><th>Tanggal</th><th>Bahan</th><th>Supplier</th><th>Qty</th><th>Total</th><th></th></tr>
                    </thead>
                    <tbody>
                      {pembelian.map((p) => (
                        <tr key={p.id}>
                          <td>{p.tanggal}</td>
                          <td className="font-bold">{p.nama_bahan || '—'}</td>
                          <td>{p.suppliers?.nama || '—'}</td>
                          <td>{p.qty}</td>
                          <td className="text-primary font-bold">{formatRupiah(p.total)}</td>
                          <td className="text-right">
                            <button className="btn btn-sm btn-danger" onClick={() => hapusPembelian(p)}
                              aria-label="Hapus catatan pembelian">
                              <Icon name="trash" size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </AppLayout>
  )
}
