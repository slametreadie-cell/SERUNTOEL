import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../utils/supabaseClient'
import { useAuth } from '../components/AuthProvider'
import AppLayout from '../components/AppLayout'
import { logAudit } from '../utils/audit'

const formatRupiah = (v) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v || 0)

export default function Inventory() {
  const { user } = useAuth()

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
        <div className="metric-card">
          <div className="metric-label">Bahan Baku</div>
          <div className="metric-value text-primary">{bahan.length}</div>
          <div className="text-sm text-muted mt-2">{bahanKritis} kritis</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Produk Jadi</div>
          <div className="metric-value text-primary">{produkJadi.length}</div>
          <div className="text-sm text-muted mt-2">{produkKritis} stok menipis</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Total Pembelian</div>
          <div className="metric-value text-primary">{pembelian.length}</div>
          <div className="text-sm text-muted mt-2">transaksi</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-3" style={{ overflowX: 'auto' }}>
        {[
          { key: 'bahan', label: '🧂 Bahan Baku' },
          { key: 'produk', label: '📦 Produk Jadi' },
          { key: 'pembelian', label: '🛒 Pembelian' },
        ].map((t) => (
          <button key={t.key} className={`btn btn-sm ${tab === t.key ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="card" style={{ padding: 16 }}>
        <input
          className="form-control"
          placeholder={`🔍 Cari ${tab === 'bahan' ? 'bahan baku' : tab === 'produk' ? 'produk jadi' : 'pembelian'}...`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && <div className="alert alert-danger">⚠️ {error}</div>}

      {loading ? (
        <div className="card"><p className="text-muted text-center">Memuat...</p></div>
      ) : (
        <>
          {/* ===== TAB: BAHAN BAKU ===== */}
          {tab === 'bahan' && (
            <div className="card" style={{ padding: 0 }}>
              <div className="card-header" style={{ padding: 16 }}>
                <div className="card-title"><span className="nav-icon">🧂</span> Daftar Bahan Baku</div>
                <Link href="/inventory/tambah-bahan" className="btn btn-primary btn-sm">＋ Bahan</Link>
              </div>
              {bahanFiltered.length === 0 ? (
                <div className="empty-state">
                  <div className="nav-icon" style={{ fontSize: 40 }}>🧺</div>
                  <h3>Belum ada bahan baku</h3>
                  <p className="text-sm">Bahan baku otomatis tercatat saat Anda membuat resep/HPP produk.</p>
                </div>
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
                              <button className="btn btn-sm btn-danger" onClick={() => hapusBahan(b)}>✕</button>
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
                <div className="card-title"><span className="nav-icon">📦</span> Stok Produk Jadi</div>
              </div>
              {produkFiltered.length === 0 ? (
                <div className="empty-state">
                  <div className="nav-icon" style={{ fontSize: 40 }}>📦</div>
                  <h3>Belum ada produk</h3>
                  <p className="text-sm">Tambahkan produk di menu Produk & HPP.</p>
                </div>
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
                <div className="card-title"><span className="nav-icon">🛒</span> Riwayat Pembelian</div>
                <Link href="/inventory/tambah-bahan" className="btn btn-primary btn-sm">＋ Pembelian</Link>
              </div>
              {pembelian.length === 0 ? (
                <div className="empty-state">
                  <div className="nav-icon" style={{ fontSize: 40 }}>🛒</div>
                  <h3>Belum ada pembelian</h3>
                  <p className="text-sm">Catat pembelian bahan dari supplier.</p>
                </div>
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
                            <button className="btn btn-sm btn-danger" onClick={() => hapusPembelian(p)}>✕</button>
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
