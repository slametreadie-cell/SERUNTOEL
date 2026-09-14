import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { supabase } from '../utils/supabaseClient'
import { useAuth } from '../components/AuthProvider'
import AppLayout from '../components/AppLayout'
import { logAudit } from '../utils/audit'
import Icon from '../components/Icons'
import { StatCard, SkeletonStat, EmptyBlock } from '../components/DashboardWidgets'

const formatRupiah = (v) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v || 0)

export default function ProdukHPP() {
  const { user } = useAuth()

  const hapusProduk = async (row, e) => {
    if (e) e.stopPropagation()
    if (!confirm(`Hapus produk "${row.nama_produk}"?\n\nTindakan ini tidak bisa dibatalkan.`)) return
    const { error } = await supabase.from('products').delete().eq('id', row.id)
    if (error) { alert('Gagal menghapus: ' + error.message); return }
    logAudit({ aksi: 'hapus_produk', user, sheetTarget: 'products', detail: { nama: row.nama_produk } })
    fetchData()
  }
  const router = useRouter()
  const [produk, setProduk] = useState([])
  const [kategori, setKategori] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterKategori, setFilterKategori] = useState('')
  const [search, setSearch] = useState('')
  const [view, setView] = useState('grid')
  const [sortBy, setSortBy] = useState('terbaru')

  const fetchProduk = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*, product_categories(nama)')
        .order('created_at', { ascending: false })

      if (error) throw error
      setProduk(data || [])
    } catch (e) {
      setError(e.message || 'Gagal memuat produk')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchKategori = useCallback(async () => {
    const { data } = await supabase.from('product_categories').select('*').order('nama')
    setKategori(data || [])
  }, [])

  useEffect(() => {
    fetchProduk()
    fetchKategori()
  }, [fetchProduk, fetchKategori])

  // Filter & sort
  let filtered = produk.filter((p) => {
    const matchKat = !filterKategori || p.kategori === filterKategori || p.kategori_id === filterKategori
    const matchSearch = !search || (p.nama_produk || '').toLowerCase().includes(search.toLowerCase())
    return matchKat && matchSearch
  })

  if (sortBy === 'nama') filtered = [...filtered].sort((a, b) => (a.nama_produk || '').localeCompare(b.nama_produk))
  else if (sortBy === 'harga_tinggi') filtered = [...filtered].sort((a, b) => (b.harga_jual || 0) - (a.harga_jual || 0))
  else if (sortBy === 'harga_rendah') filtered = [...filtered].sort((a, b) => (a.harga_jual || 0) - (b.harga_jual || 0))
  else if (sortBy === 'margin') filtered = [...filtered].sort((a, b) => (b.margin || 0) - (a.margin || 0))
  else if (sortBy === 'stok') filtered = [...filtered].sort((a, b) => (a.stok_produk || 0) - (b.stok_produk || 0))

  const totalProduk = filtered.length
  const nilaiStok = filtered.reduce((s, p) => s + (p.harga_jual || 0) * (p.stok_produk || 0), 0)
  const stokRendah = filtered.filter((p) => (p.stok_produk || 0) <= 5).length

  return (
    <AppLayout title="Produk & HPP" subtitle="Kelola produk, kalkulasi HPP, dan harga jual">
      {/* Ringkasan KPI */}
      <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
        <StatCard label="Total Produk" value={totalProduk} icon="box" tone="primary" />
        <StatCard label="Nilai Stok" value={formatRupiah(nilaiStok)} icon="wallet" tone="success" />
        <StatCard label="Stok Menipis" value={stokRendah} icon="alert" tone="danger" />
      </div>

      {/* Toolbar */}
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2" style={{ flex: 1 }}>
            <input
              className="form-control"
              style={{ maxWidth: 240 }}
              placeholder="Cari produk..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select className="form-control" style={{ maxWidth: 180 }} value={filterKategori} onChange={(e) => setFilterKategori(e.target.value)}>
              <option value="">Semua Kategori</option>
              {kategori.map((k) => (
                <option key={k.id} value={k.nama}>{k.nama}</option>
              ))}
            </select>
            <select className="form-control" style={{ maxWidth: 170 }} value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="terbaru">Terbaru</option>
              <option value="nama">Nama A-Z</option>
              <option value="harga_tinggi">Harga Tertinggi</option>
              <option value="harga_rendah">Harga Terendah</option>
              <option value="margin">Margin Tertinggi</option>
              <option value="stok">Stok Tersedikit</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button className={`btn btn-sm ${view === 'grid' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setView('grid')}>▦</button>
            <button className={`btn btn-sm ${view === 'table' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setView('table')}><Icon name="menu" size={13} /></button>
            <Link href="/produk-hpp/duplikat" className="btn btn-outline"> Duplikat</Link>
            <Link href="/produk-hpp/baru" className="btn btn-primary">＋ Produk Baru</Link>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-danger"> {error}</div>}

      {loading ? (
        <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
          <SkeletonStat /><SkeletonStat /><SkeletonStat />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <EmptyBlock
            icon="box"
            title="Belum ada produk"
            message="Tambahkan produk pertama Anda untuk mulai menghitung HPP."
            action={<Link href="/produk-hpp/baru" className="btn btn-primary mt-3">＋ Tambah Produk</Link>}
          />
        </div>
      ) : view === 'grid' ? (
        <div className="product-grid">
          {filtered.map((p) => (
            <Link key={p.id} href={`/produk-hpp/${p.id}`} className="product-card">
              <div className="product-img-wrap">
                {p.foto_url ? (
                  <img src={p.foto_url} alt={p.nama_produk} />
                ) : (
                  <div className="product-img-placeholder"></div>
                )}
              </div>
              <div className="product-body">
                <div className="product-name">{p.nama_produk}</div>
                <div className="product-category">{p.kategori || 'Tanpa kategori'}</div>
                <div className="product-price">{formatRupiah(p.harga_jual)}</div>
                <div className="product-meta">
                  <span>Stok: <b className={p.stok_produk <= 5 ? 'text-danger' : ''}>{p.stok_produk}</b></span>
                  <span className={`badge ${p.margin >= 40 ? 'badge-success' : p.margin >= 20 ? 'badge-warning' : 'badge-danger'}`}>
                    {Math.round(p.margin || 0)}% margin
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Produk</th>
                  <th>Kategori</th>
                  <th>HPP/Unit</th>
                  <th>Harga Jual</th>
                  <th>Margin</th>
                  <th>Stok</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} onClick={() => router.push(`/produk-hpp/${p.id}`)} style={{ cursor: 'pointer' }}>
                    <td className="font-bold">{p.nama_produk}</td>
                    <td>{p.kategori || '—'}</td>
                    <td>{formatRupiah(p.hpp_per_unit)}</td>
                    <td className="text-primary font-bold">{formatRupiah(p.harga_jual)}</td>
                    <td>{Math.round(p.margin || 0)}%</td>
                    <td className={p.stok_produk <= 5 ? 'text-danger font-bold' : ''}>{p.stok_produk}</td>
                    <td className="text-right">
                      <div className="flex gap-1 justify-end">
                        <button className="btn btn-sm btn-outline" title="Ubah produk"
                          onClick={(e) => { e.stopPropagation(); router.push(`/produk-hpp/${p.id}`) }}><Icon name="sliders" size={13} /></button>
                        <button className="btn btn-sm btn-danger" title="Hapus produk"
                          onClick={(e) => hapusProduk(p, e)}><Icon name="close" size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AppLayout>
  )
}
